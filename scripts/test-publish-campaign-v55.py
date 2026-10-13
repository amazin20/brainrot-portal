"""Isolated synthetic mutation tests; no SOURCE/PUBLIC acceptance fixtures."""
import copy
import contextlib
import hashlib
import importlib.util
import io
import json
import pathlib
import stat
import struct
import subprocess
import sys
import tarfile
import tempfile
import unittest
import urllib.parse
import warnings
import zipfile
from unittest import mock

SCRIPT = pathlib.Path(__file__).with_name('publish-campaign-v55.py')
spec = importlib.util.spec_from_file_location('campaign_v55_publisher', SCRIPT)
publisher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)
TEST_SCOPE = 'SYNTHETIC ISOLATED TEST FIXTURE; never actual SOURCE or PUBLIC acceptance.'


def fixture_pins(baseline_expected):
    source, tree, parent, controller = ('1'*40, '2'*40, '3'*40, '4'*40)
    review = {'runId': 123, 'runAttempt': 1,
              'url': 'https://github.com/amazin20/brainrot-portal/actions/runs/123'}
    roles = list(publisher.SOURCE_ROLES.items())
    jobs = [{'id': i+100, 'name': name, 'status': 'completed', 'conclusion': 'success',
             'run_id': 123, 'run_attempt': 1, 'started_at': '2026-10-13T00:00:00Z',
             'completed_at': '2026-10-13T00:01:00Z',
             'steps': [{'number': number, 'name': step, 'status': 'completed', 'conclusion': 'success',
                        'started_at': '2026-10-13T00:00:01Z', 'completed_at': '2026-10-13T00:00:02Z'}
                       for number, step in enumerate(['Run actions/checkout@v4', 'Run actions/setup-node@v4', 'Run npm ci'] +
                                                     role[1] + ['Run actions/upload-artifact@v4'], 1)]}
            for i, (name, role) in enumerate(roles)]
    artifacts = [{'id': i+200, 'name': role[0], 'size_in_bytes': 100,
                  'digest': 'sha256:'+'a'*64, 'expired': False, 'created_at': '2026-10-13T00:00:01Z',
                  'updated_at': '2026-10-13T00:00:02Z', 'expires_at': '2026-10-23T00:00:00Z',
                  'workflow_run': {'id': 123, 'repository_id': 1, 'head_repository_id': 1,
                                   'head_branch': 'upgrade/campaign-polish-20261013', 'head_sha': source},
                  'jobId': i+100} for i, (_, role) in enumerate(roles)]
    return {'schemaVersion': 1, 'frozen': True, 'sourceAccepted': True, 'publicationAccepted': False,
            'repository': publisher.REPOSITORY, 'sourceBranch': 'upgrade/campaign-polish-20261013',
            'sourceWorkflow': '.github/workflows/campaign-polish-review.yml', 'sourceCommit': source,
            'sourceTree': tree, 'sourceParent': parent, 'sourceReview': review, 'sourceJobs': jobs,
            'sourceArtifacts': artifacts,
            'sourceLogs': [{'jobId': job['id'], 'bytes': 50, 'sha256': 'b'*64} for job in jobs],
            'sourceRootAudit': {'sourceAccepted': True, 'publicationAccepted': False, 'sourceCommit': source,
                                'sourceTree': tree, 'sourceParent': parent, 'sourceReview': review, 'scope': TEST_SCOPE},
            'modelOriginCommit': '3f2e83127dfd5800068854a98843d73eb9377609', 'namespace': publisher.NAMESPACE,
            'publicURL': publisher.PUBLIC_BASE+publisher.NAMESPACE, 'controllerParent': controller,
            'baseline': {'publisher': controller, 'tree': '6'*40, 'runId': 122, 'runAttempt': 1,
                         'publicationAccepted': True, **baseline_expected,
                         'pagesArtifact': {'id': 500, 'name': 'github-pages', 'size_in_bytes': 100,
                                           'digest': 'sha256:'+'c'*64, 'expired': False,
                                           'workflow_run': {'id': 122, 'head_sha': controller}},
                         'scope': TEST_SCOPE}, 'limits': dict(publisher.LIMITS), 'scope': TEST_SCOPE}


class FakeResponse:
    def __init__(self, request, content, *, status=200, headers=None, url=None):
        self.status = status
        self.headers = {'Content-Length': str(len(content)), **(headers or {})}
        self.url = request.full_url if url is None else url
        self.content = io.BytesIO(content)

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.content.close()

    def geturl(self):
        return self.url

    def read(self, amount=-1):
        return self.content.read(amount)


class PublisherTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='campaign-v55-synthetic-test-')
        self.root = pathlib.Path(self.temp.name)
        self.baseline = self.root/'baseline'
        self.dist = self.root/'dist'
        self.baseline.mkdir()
        self.dist.mkdir()
        for name, content in {'index.html': b'old home\n', 'build-info.json': b'{"old":true}\n',
                              'legacy/movie.bin': b'original legacy binary bytes\x00\xff'}.items():
            path = self.baseline/name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
        rows = publisher.inventory(self.baseline)
        self.baseline_expected = {'files': len(rows), 'bytes': sum(row['bytes'] for row in rows),
                                  'inventorySha256': publisher.inventory_sha256(rows)}
        self.pins = fixture_pins(self.baseline_expected)
        (self.dist/'index.html').write_bytes(b'new candidate html\n')
        files = publisher.inventory(self.dist)
        order = list(range(1, 41))+list(range(42, 52))+[41]
        metadata = {'commit': self.pins['sourceCommit'], 'gameCommit': self.pins['sourceCommit'],
                    'interfaceCommit': self.pins['sourceCommit'], 'publisherCommit': None, 'run': '123',
                    'verified': False, 'version': 'v55-castle-finale',
                    'runtimeConfig': {'chamberEdition': 'foundation', 'puzzleProgression': True,
                                      'campaignSequencePresentation': True, 'room23PhysicalPrototype': True},
                    'rooms': [{'stableLevel': level, 'level': number} for number, level in enumerate(order, 1)],
                    'files': files, 'packageFilesSha256': publisher.inventory_sha256(files), 'scope': TEST_SCOPE}
        (self.dist/'build-info.json').write_bytes(publisher.json_bytes(metadata))
        candidate = publisher.inventory(self.dist)
        self.binding = {'pass': True, 'sourceAccepted': True, 'publicationAccepted': False,
                        **{key: self.pins[key] for key in ('sourceCommit', 'sourceTree', 'sourceParent', 'sourceReview')},
                        'candidateFiles': candidate, 'candidateBytes': sum(row['bytes'] for row in candidate),
                        'candidateInventorySha256': publisher.inventory_sha256(candidate),
                        'actualSourceJobs': self.pins['sourceJobs'], 'actualSourceArtifacts': self.pins['sourceArtifacts'],
                        'actualSourceLogs': self.pins['sourceLogs'],
                        'finiteShortcutAudit': {'scope': TEST_SCOPE, 'unproven': [{'status': 'UNPROVEN', 'case': 'synthetic'}]},
                        'scope': TEST_SCOPE}
        self.binding_file = self.root/'source-binding.json'
        self.binding_file.write_bytes(publisher.json_bytes(self.binding))
        self.expected = publisher.identity(self.pins, '5'*40, 124, 1)
        self.site, self.proof = self.root/'site', self.root/'proof'

    def tearDown(self):
        self.temp.cleanup()

    def assemble(self):
        return publisher.assemble_site(self.baseline, self.dist, self.binding_file, self.site, self.proof,
                                       self.pins, self.expected, baseline_expected=self.baseline_expected)

    def mutate_binding(self, callback):
        binding = copy.deepcopy(self.binding)
        callback(binding)
        self.binding_file.write_bytes(publisher.json_bytes(binding))

    def zip_file(self, members, name='input.zip', compression=zipfile.ZIP_STORED):
        output = self.root/name
        with warnings.catch_warnings():
            warnings.simplefilter('ignore', UserWarning)
            with zipfile.ZipFile(output, 'w', compression=compression) as archive:
                for member, content in members:
                    archive.writestr(member, content)
        return output

    def extract(self, archive, suffix='extracted', **kwargs):
        return publisher.extract_zip(archive, self.root/suffix, archive.stat().st_size,
                                     publisher.sha256_file(archive), **kwargs)

    def pages_zip(self, members=None, *, extra=False, name='pages.zip', format=tarfile.DEFAULT_FORMAT):
        data = io.BytesIO()
        with tarfile.open(fileobj=data, mode='w', format=format) as archive:
            if members is None:
                for file in sorted(self.baseline.rglob('*')):
                    if file.is_file():
                        body = file.read_bytes()
                        member = tarfile.TarInfo('./'+file.relative_to(self.baseline).as_posix())
                        member.size = len(body)
                        archive.addfile(member, io.BytesIO(body))
            else:
                for member, body in members:
                    archive.addfile(member, io.BytesIO(body))
        zip_path = self.zip_file([('artifact.tar', data.getvalue())]+([('extra.txt', b'extra')] if extra else []), name)
        artifact = self.pins['baseline']['pagesArtifact']
        artifact['size_in_bytes'] = zip_path.stat().st_size
        artifact['digest'] = 'sha256:'+publisher.sha256_file(zip_path)
        return zip_path

    def opener(self, request, timeout):
        path = urllib.parse.unquote(urllib.parse.urlsplit(request.full_url).path[len('/brainrot-portal/'):])
        return FakeResponse(request, (self.site/path).read_bytes())

    def check_public(self, phase, opener=None, suffix=None):
        with contextlib.redirect_stdout(io.StringIO()):
            return publisher.check_public(self.proof/'publication-manifest.json', self.proof/(suffix or phase+'.json'),
                                          self.pins, self.expected, phase, baseline_expected=self.baseline_expected,
                                          opener=opener or self.opener, sleeper=lambda _: None)

    def test_fixture_cannot_enter_production_pins_or_cli(self):
        with self.assertRaisesRegex(ValueError, 'Exact baseline'):
            publisher.validate_pins(self.pins)
        path = self.root/'synthetic-pins.json'
        path.write_bytes(publisher.json_bytes(self.pins))
        result = subprocess.run([sys.executable, str(SCRIPT), 'assemble', '--baseline', str(self.baseline),
                                 '--dist', str(self.dist), '--source-binding', str(self.binding_file), '--output', str(self.site),
                                 '--proof', str(self.proof), '--pins', str(path), '--publisher', '5'*40,
                                 '--run', '124', '--attempt', '1'], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Exact baseline', result.stderr)
        self.assertFalse(self.site.exists())

    def test_valid_zip_common_root_and_exact_bytes(self):
        archive = self.zip_file([('wrapper/', b''), ('wrapper/report.json', b'{"test":true}\n'),
                                 ('wrapper/full.tap', b'complete synthetic TAP\n')])
        result = self.extract(archive)
        self.assertEqual(result['commonRoot'], 'wrapper')
        self.assertEqual((self.root/'extracted'/'report.json').read_bytes(), b'{"test":true}\n')
        self.assertEqual([row['path'] for row in result['files']], ['full.tap', 'report.json'])
        self.assertFalse((self.root/'extracted'/'wrapper').exists())

    def test_zip_path_duplicate_and_file_directory_attacks(self):
        variants = [[(name, b'bad')] for name in ('../outside', '/absolute', 'C:/drive', 'a\\b', 'a//b', 'a/./b', 'a/../b')]
        variants += [[('duplicate', b'one'), ('duplicate', b'two')], [('a', b'file'), ('a/b', b'child')]]
        for index, members in enumerate(variants):
            with self.subTest(members=members):
                archive = self.zip_file(members, 'bad-'+str(index)+'.zip')
                with self.assertRaises(ValueError):
                    self.extract(archive, 'failed-'+str(index))
                self.assertFalse((self.root/('failed-'+str(index))).exists())

    def test_zip_symlink_special_file_and_directory_data(self):
        for index, mode in enumerate((stat.S_IFLNK, stat.S_IFIFO, stat.S_IFCHR, stat.S_IFSOCK)):
            with self.subTest(mode=mode):
                member = zipfile.ZipInfo('member')
                member.create_system = 3
                member.external_attr = (mode | 0o777) << 16
                archive = self.zip_file([(member, b'data')], 'special-'+str(index)+'.zip')
                with self.assertRaisesRegex(ValueError, 'special'):
                    self.extract(archive, 'special-'+str(index))
        archive = self.zip_file([('directory/', b'forbidden directory body')], 'directory-data.zip')
        with self.assertRaises(ValueError):
            self.extract(archive)

    def test_zip_crc_and_provider_corruption(self):
        archive = self.zip_file([('file.bin', b'unique-payload-123')])
        raw = archive.read_bytes().replace(b'unique-payload-123', b'unique-payload-124', 1)
        archive.write_bytes(raw)
        with self.assertRaises(zipfile.BadZipFile):
            self.extract(archive)
        self.assertFalse((self.root/'extracted').exists())
        archive = self.zip_file([('file.bin', b'correct')], 'provider.zip')
        with self.assertRaisesRegex(ValueError, 'Provider ZIP'):
            publisher.extract_zip(archive, self.root/'wrong-provider', archive.stat().st_size, '0'*64)

    def test_zip_null_encryption_compression_and_limits(self):
        archive = self.zip_file([('abcde', b'body')])
        archive.write_bytes(archive.read_bytes().replace(b'abcde', b'ab\x00de'))
        with self.assertRaises(ValueError):
            self.extract(archive, 'null')
        archive = self.zip_file([('encrypted', b'body')], 'encrypted.zip')
        data = bytearray(archive.read_bytes())
        for signature, offset in ((b'PK\x03\x04', 6), (b'PK\x01\x02', 8)):
            start = data.index(signature)
            data[start+offset:start+offset+2] = struct.pack('<H', 1)
        archive.write_bytes(data)
        with self.assertRaisesRegex(ValueError, 'Encrypted'):
            self.extract(archive, 'encrypted')
        archive = self.zip_file([('file', b'body')], 'bzip.zip', zipfile.ZIP_BZIP2)
        with self.assertRaisesRegex(ValueError, 'compression'):
            self.extract(archive, 'bzip')
        archive = self.zip_file([('bomb.bin', b'0'*2048)], 'bomb.zip', zipfile.ZIP_DEFLATED)
        with self.assertRaisesRegex(ValueError, 'bounded integer|limit'):
            self.extract(archive, 'bomb', maximum=1024)
        archive = self.zip_file([('report.json', b'x'*129)], 'meta.zip')
        with mock.patch.dict(publisher.LIMITS, metadataBytes=128):
            with self.assertRaisesRegex(ValueError, 'metadata'):
                self.extract(archive, 'meta')

    def test_verify_extracted_rejects_all_member_and_directory_drift(self):
        archive = self.zip_file([('wrapper/report.json', b'{"synthetic":true}\n'), ('wrapper/frames/0.bin', b'frame')])
        result = self.extract(archive)
        output = self.root/'extracted'
        fresh = publisher.verify_extracted(archive, output, archive.stat().st_size, publisher.sha256_file(archive))
        self.assertEqual(fresh['files'], result['files'])
        mutations = [('changed', output/'frames/0.bin', b'other'),
                     ('deleted', output/'frames/0.bin', None), ('extra', output/'unclaimed.bin', b'unclaimed')]
        for name, file, payload in mutations:
            with self.subTest(mutation=name):
                old = file.read_bytes() if file.exists() else None
                if payload is None:
                    file.unlink()
                else:
                    file.write_bytes(payload)
                with self.assertRaisesRegex(ValueError, 'deleted/extra/changed'):
                    publisher.verify_extracted(archive, output, archive.stat().st_size, publisher.sha256_file(archive))
                if old is None:
                    file.unlink()
                else:
                    file.write_bytes(old)
        (output/'unexpected-empty-directory').mkdir()
        with self.assertRaisesRegex(ValueError, 'namespace differs'):
            publisher.verify_extracted(archive, output, archive.stat().st_size, publisher.sha256_file(archive))

    def test_zip_preflight_count_forgeries_and_valid_zip64(self):
        archive = self.zip_file([('one', b'one'), ('two', b'two')])
        data = bytearray(archive.read_bytes())
        end = data.rindex(b'PK\x05\x06')
        data[end+8:end+12] = struct.pack('<2H', 1, 1)
        archive.write_bytes(data)
        with self.assertRaisesRegex(ValueError, 'count/extent'):
            self.extract(archive, 'forged-count')
        archive = self.zip_file([('one', b'1'), ('two', b'2'), ('three', b'3')], 'storm.zip')
        with mock.patch.object(publisher, 'MAX_ENTRIES', 1):
            with self.assertRaisesRegex(ValueError, 'count exceeds'):
                self.extract(archive, 'storm')
        archive = self.zip_file([('zip64.bin', b'valid zip64')], 'zip64.zip')
        raw = archive.read_bytes()
        end = raw.rindex(b'PK\x05\x06')
        fields = struct.unpack('<4s4H2IH', raw[end:end+22])
        count, central_bytes, central_offset = fields[4:7]
        record = struct.pack('<4sQ2H2I4Q', b'PK\x06\x06', 44, 45, 45, 0, 0, count, count, central_bytes, central_offset)
        locator = struct.pack('<4sIQI', b'PK\x06\x07', 0, end, 1)
        final = struct.pack('<4s4H2IH', b'PK\x05\x06', 0, 0, 65535, 65535, 0xffffffff, 0xffffffff, 0)
        archive.write_bytes(raw[:end]+record+locator+final)
        self.extract(archive, 'zip64')
        self.assertEqual((self.root/'zip64/zip64.bin').read_bytes(), b'valid zip64')

    def test_path_depth_and_length_are_bounded_before_namespace_work(self):
        for name in ('a/'*64+'last', 'x'*2049):
            with self.subTest(nameLength=len(name)):
                with self.assertRaisesRegex(ValueError, 'length/depth'):
                    publisher.safe_name(name)

    def test_pages_valid_gnu_long_names_and_hidden_metadata_limits(self):
        path = self.baseline/('legacy/'+'x'*105+'/report.bin')
        path.parent.mkdir(parents=True)
        path.write_bytes(b'long-path original byte fixture')
        rows = publisher.inventory(self.baseline)
        expected = {'files': len(rows), 'bytes': sum(row['bytes'] for row in rows),
                    'inventorySha256': publisher.inventory_sha256(rows)}
        self.pins = fixture_pins(expected)
        archive = self.pages_zip(name='gnu-pages.zip', format=tarfile.GNU_FORMAT)
        result = publisher.extract_baseline(archive, self.root/'gnu-restored', self.pins, baseline_expected=expected)
        self.assertEqual(result['inventorySha256'], expected['inventorySha256'])
        for index, kind in enumerate((tarfile.GNUTYPE_LONGNAME, tarfile.XHDTYPE)):
            member = tarfile.TarInfo('hidden-extension')
            member.type, member.size = kind, 4097
            archive = self.pages_zip([(member, b'x'*4096+b'\0')], name='oversized-extension-'+str(index)+'.zip')
            with self.assertRaisesRegex(ValueError, 'extended-header'):
                publisher.extract_baseline(archive, self.root/('oversized-extension-'+str(index)), self.pins, baseline_expected=expected)

    def test_production_identity_rejects_wrong_parent_or_dirty_controller(self):
        env = {'GITHUB_SHA': '5'*40, 'GITHUB_RUN_ID': '124', 'GITHUB_RUN_ATTEMPT': '1',
               'GITHUB_REPOSITORY': publisher.REPOSITORY, 'GITHUB_REF': 'refs/heads/main'}
        with mock.patch.dict(publisher.os.environ, env, clear=True):
            with mock.patch.object(publisher.subprocess, 'check_output', side_effect=['5'*40+'\n', '9'*40+'\n']):
                with self.assertRaisesRegex(ValueError, 'direct child'):
                    publisher.production_identity(self.pins, '5'*40, 124, 1)
            with mock.patch.object(publisher.subprocess, 'check_output', side_effect=['5'*40+'\n', '4'*40+'\n', ' M tracked.py\n']):
                with self.assertRaisesRegex(ValueError, 'tracked bytes'):
                    publisher.production_identity(self.pins, '5'*40, 124, 1)

    def test_scalar_type_aliases_cannot_replace_runtime_or_provenance(self):
        metadata = publisher.read_json(self.dist/'build-info.json')
        metadata['runtimeConfig']['puzzleProgression'] = 1
        (self.dist/'build-info.json').write_bytes(publisher.json_bytes(metadata))
        with self.assertRaisesRegex(ValueError, 'runtime differs'):
            publisher.check_dist_metadata(self.dist, self.pins, publisher.inventory(self.dist))
        pins = copy.deepcopy(self.pins)
        pins['limits']['siteBytes'] = float(pins['limits']['siteBytes'])
        with self.assertRaisesRegex(ValueError, 'Resource limits'):
            publisher.validate_pins(pins, baseline_expected=self.baseline_expected)

    def test_output_overlap_existing_and_symlink_rejected(self):
        archive = self.zip_file([('safe', b'bytes')])
        existing = self.root/'existing'
        existing.mkdir()
        with self.assertRaisesRegex(ValueError, 'already exists'):
            self.extract(archive, 'existing')
        link = self.root/'link'
        link.symlink_to(existing, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, 'symlink'):
            self.extract(archive, 'link/child')
        with self.assertRaisesRegex(ValueError, 'overlap'):
            publisher.extract_zip(archive, archive, archive.stat().st_size, publisher.sha256_file(archive))

    def test_pages_tar_baseline_exact_inventory(self):
        archive = self.pages_zip()
        result = publisher.extract_baseline(archive, self.root/'restored', self.pins,
                                            baseline_expected=self.baseline_expected)
        self.assertEqual(result['files'], 3)
        self.assertEqual(publisher.inventory(self.root/'restored'), publisher.inventory(self.baseline))
        with self.assertRaisesRegex(ValueError, 'Exact baseline'):
            publisher.extract_baseline(archive, self.root/'production-refused', self.pins)

    def test_pages_tar_link_traversal_duplicates_and_extra_zip_file(self):
        for index, kind in enumerate((tarfile.SYMTYPE, tarfile.LNKTYPE, tarfile.FIFOTYPE, tarfile.CHRTYPE, tarfile.GNUTYPE_SPARSE)):
            with self.subTest(kind=kind):
                member = tarfile.TarInfo('bad')
                member.type = kind
                member.linkname = '../outside'
                archive = self.pages_zip([(member, b'')], name='tar-special-'+str(index)+'.zip')
                with self.assertRaisesRegex(ValueError, 'special|sparse'):
                    publisher.extract_baseline(archive, self.root/('tar-special-'+str(index)), self.pins,
                                               baseline_expected=self.baseline_expected)
        for index, names in enumerate((['../outside'], ['x', './x'], ['x', 'x/child'])):
            members = []
            for name in names:
                member = tarfile.TarInfo(name)
                member.size = 1
                members.append((member, b'x'))
            archive = self.pages_zip(members, name='tar-unsafe-'+str(index)+'.zip')
            with self.assertRaises(ValueError):
                publisher.extract_baseline(archive, self.root/('tar-unsafe-'+str(index)), self.pins,
                                           baseline_expected=self.baseline_expected)
        archive = self.pages_zip(extra=True, name='extra-pages.zip')
        with self.assertRaisesRegex(ValueError, 'sole artifact.tar'):
            publisher.extract_baseline(archive, self.root/'extra-pages', self.pins, baseline_expected=self.baseline_expected)

    def test_pages_tar_wrong_exact_bytes_and_namespace(self):
        old = (self.baseline/'legacy/movie.bin').read_bytes()
        (self.baseline/'legacy/movie.bin').write_bytes(b'X'+old[1:])
        archive = self.pages_zip()
        with self.assertRaisesRegex(ValueError, 'inventory differs'):
            publisher.extract_baseline(archive, self.root/'corrupt-baseline', self.pins,
                                       baseline_expected=self.baseline_expected)
        rows = [{'path': 'campaign-v55/existing', 'bytes': 1, 'sha256': hashlib.sha256(b'x').hexdigest()}]
        expected = {'files': 1, 'bytes': 1, 'inventorySha256': publisher.inventory_sha256(rows)}
        with self.assertRaisesRegex(ValueError, 'namespace'):
            publisher.check_baseline(rows, baseline_expected=expected)

    def test_frozen_identity_and_complete_provenance_mutants(self):
        mutants = [lambda p: p.update(frozen=False), lambda p: p.update(sourceAccepted=False),
                   lambda p: p.update(publicationAccepted=True), lambda p: p['baseline'].update(publicationAccepted=False),
                   lambda p: p.update(namespace='old-root/'), lambda p: p.update(publicURL='https://other.invalid/'),
                   lambda p: p['sourceRootAudit'].update(sourceCommit='9'*40),
                   lambda p: p.update(sourceJobs=p['sourceJobs'][:-1]),
                   lambda p: p['sourceJobs'][0].update(conclusion='failure'),
                   lambda p: p['sourceJobs'][0].update(name='unrelated-job'),
                   lambda p: p['sourceJobs'][0]['steps'][0].update(conclusion='failure'),
                   lambda p: p['sourceJobs'][0]['steps'][3].update(conclusion='skipped'),
                   lambda p: p['sourceArtifacts'][0].update(name='unrelated-artifact'),
                   lambda p: p['sourceArtifacts'][0].update(jobId=999),
                   lambda p: p['sourceArtifacts'][0]['workflow_run'].update(head_sha='9'*40),
                   lambda p: p.update(sourceLogs=p['sourceLogs'][:-1]),
                   lambda p: p['sourceLogs'][0].update(jobId=101),
                   lambda p: p['sourceReview'].update(url='https://other.invalid/actions/runs/123'),
                   lambda p: p['limits'].update(candidateBytes=200_000_000)]
        for index, mutate in enumerate(mutants):
            with self.subTest(mutant=index):
                pins = copy.deepcopy(self.pins)
                mutate(pins)
                with self.assertRaises(ValueError):
                    publisher.validate_pins(pins, baseline_expected=self.baseline_expected)

    def test_assembly_preserves_every_baseline_and_dist_byte(self):
        before, candidate = publisher.inventory(self.baseline), publisher.inventory(self.dist)
        manifest = self.assemble()
        for row in before:
            self.assertEqual((self.site/row['path']).read_bytes(), (self.baseline/row['path']).read_bytes())
        for row in candidate:
            self.assertEqual((self.site/publisher.NAMESPACE/row['path']).read_bytes(), (self.dist/row['path']).read_bytes())
        self.assertEqual(manifest['siteFiles'], publisher.inventory(self.site))
        review = publisher.read_json(self.site/'campaign-v55/source-review.json')
        self.assertFalse(review['publicationAccepted'])
        self.assertEqual(review['finiteShortcutAudit'], self.binding['finiteShortcutAudit'])
        publisher.check_manifest(manifest, self.pins, self.expected, baseline_expected=self.baseline_expected)

    def test_assembly_rejects_corrupted_or_unbound_bytes(self):
        for index, mutation in enumerate(('baseline', 'dist', 'extra', 'generated-collision', 'stamp')):
            with self.subTest(mutation=mutation):
                baseline = self.root/('baseline-'+str(index))
                dist = self.root/('dist-'+str(index))
                import shutil
                shutil.copytree(self.baseline, baseline)
                shutil.copytree(self.dist, dist)
                if mutation == 'baseline':
                    (baseline/'index.html').write_bytes(b'corrupt baseline')
                elif mutation == 'dist':
                    (dist/'index.html').write_bytes(b'corrupt dist')
                elif mutation == 'extra':
                    (dist/'unbound.bin').write_bytes(b'unbound')
                elif mutation == 'generated-collision':
                    (dist/'source-review.json').write_bytes(b'{}')
                else:
                    metadata = publisher.read_json(dist/'build-info.json')
                    metadata['commit'] = '9'*40
                    (dist/'build-info.json').write_bytes(publisher.json_bytes(metadata))
                output = self.root/('failed-site-'+str(index))
                with self.assertRaises(ValueError):
                    publisher.assemble_site(baseline, dist, self.binding_file, output, self.root/('failed-proof-'+str(index)),
                                            self.pins, self.expected, baseline_expected=self.baseline_expected)
                self.assertFalse(output.exists())

    def test_binding_and_public_manifest_mutants(self):
        mutants = [lambda b: b.update(sourceCommit='9'*40), lambda b: b.update(sourceTree='9'*40),
                   lambda b: b['sourceReview'].update(runAttempt=2), lambda b: b.update(publicationAccepted=True),
                   lambda b: b.update(candidateBytes=b['candidateBytes']+1),
                   lambda b: b.update(candidateInventorySha256='0'*64),
                   lambda b: b.update(actualSourceLogs=b['actualSourceLogs'][:-1]),
                   lambda b: b['sourceReview'].update(runAttempt=1.0),
                   lambda b: b['actualSourceJobs'][0]['steps'][0].update(number=1.0),
                   lambda b: b.update(finiteShortcutAudit={})]
        candidate = publisher.inventory(self.dist)
        for index, mutate in enumerate(mutants):
            with self.subTest(binding=index):
                binding = copy.deepcopy(self.binding)
                mutate(binding)
                with self.assertRaises(ValueError):
                    publisher.check_binding(binding, self.pins, candidate)
        manifest = self.assemble()
        mutations = [lambda m: m.update(publisherCommit='8'*40), lambda m: m.update(publicationRun=999),
                     lambda m: m.update(namespace='different/'), lambda m: m.update(publicationAccepted=True),
                     lambda m: m.update(siteFiles=m['siteFiles'][1:]),
                     lambda m: m['baselineFiles'][0].update(sha256='0'*64),
                     lambda m: m['appendedFiles'][0].update(path='old-root/hijack'),
                     lambda m: m['sourceInfo'].update(sourceCommit='9'*40),
                     lambda m: m.update(siteBytes=m['siteBytes']+1)]
        for index, mutate in enumerate(mutations):
            with self.subTest(manifest=index):
                altered = copy.deepcopy(manifest)
                mutate(altered)
                with self.assertRaises(ValueError):
                    publisher.check_manifest(altered, self.pins, self.expected, baseline_expected=self.baseline_expected)

    def test_complete_public_preflight_and_published_gets(self):
        manifest = self.assemble()
        for phase, expected_count in (('preflight', 3), ('published', len(manifest['siteFiles']))):
            urls = []
            def opened(request, timeout):
                urls.append(request.full_url)
                self.assertEqual(request.get_header('Accept-encoding'), 'identity')
                return self.opener(request, timeout)
            report = self.check_public(phase, opened)
            self.assertTrue(report['pass'])
            self.assertEqual(report['checked'], expected_count)
            self.assertFalse(report['publicationAccepted'])
            self.assertEqual(len(urls), expected_count+(1 if phase == 'preflight' else 3))
            self.assertEqual(len(urls), len(set(urls)))

    def test_public_retry_has_fresh_query_and_failure_receipt(self):
        self.assemble()
        calls = []
        def corrupted(request, timeout):
            calls.append(request.full_url)
            return FakeResponse(request, b'wrong public bytes')
        with self.assertRaises(ValueError):
            self.check_public('preflight', corrupted, 'failed.json')
        receipt = publisher.read_json(self.proof/'failed.json')
        self.assertFalse(receipt['pass'])
        self.assertFalse(receipt['mainSiteUnchanged'])
        self.assertEqual(len(calls), 12)
        self.assertEqual(len(calls), len(set(calls)))
        seen = set()
        def first_stale(request, timeout):
            path = urllib.parse.urlsplit(request.full_url).path
            if path not in seen:
                seen.add(path)
                return FakeResponse(request, b'stale')
            return self.opener(request, timeout)
        report = self.check_public('preflight', first_stale, 'retried.json')
        self.assertTrue(report['pass'])
        self.assertEqual(report['checked'], 3)

    def test_public_redirect_encoding_partial_length_and_hash_mutants(self):
        content = b'exact bytes'
        row = {'path': 'synthetic.bin', 'bytes': len(content), 'sha256': hashlib.sha256(content).hexdigest()}
        variants = [{'status': 206}, {'url': 'https://other.invalid/file'}, {'headers': {'Content-Encoding': 'gzip'}},
                    {'headers': {'Content-Range': 'bytes 0-10/20'}}, {'headers': {'Content-Length': '999'}},
                    {'content': b'wrong bytes'}, {'content': content+b'extra'}, {'content': content[:-1]}]
        for index, variant in enumerate(variants):
            with self.subTest(response=index):
                def opened(request, timeout):
                    options = dict(variant)
                    body = options.pop('content', content)
                    return FakeResponse(request, body, **options)
                with self.assertRaises(ValueError):
                    publisher.verify_row(row, opener=opened)

    def test_public_refuses_manifest_or_retained_binding_substitution(self):
        self.assemble()
        retained = self.proof/'package-binding.json'
        retained.write_bytes(retained.read_bytes()+b' ')
        calls = []
        def opened(request, timeout):
            calls.append(request.full_url)
            return self.opener(request, timeout)
        with self.assertRaisesRegex(ValueError, 'binding bytes'):
            self.check_public('preflight', opened, 'wrong-binding.json')
        self.assertEqual(calls, [])

    def test_public_mid_get_raw_binding_mutation_rejected(self):
        self.assemble()
        retained = self.proof/'package-binding.json'
        changed = False
        def opened(request, timeout):
            nonlocal changed
            if not changed:
                retained.write_bytes(retained.read_bytes()+b' ')
                changed = True
            return self.opener(request, timeout)
        with self.assertRaisesRegex(ValueError, 'changed during'):
            self.check_public('published', opened, 'mid-get-binding-mutation.json')
        receipt = publisher.read_json(self.proof/'mid-get-binding-mutation.json')
        self.assertFalse(receipt['pass'])
        self.assertTrue(receipt['testFixture'])

    def test_json_duplicates_nonfinite_and_resource_limits(self):
        for index, raw in enumerate((b'{"x":1,"x":2}', b'{"x":NaN}', b'{"x":1e999}')):
            path = self.root/('invalid-'+str(index)+'.json')
            path.write_bytes(raw)
            with self.assertRaises(ValueError):
                publisher.read_json(path)
        rows = [{'path': 'file', 'bytes': 11, 'sha256': '0'*64}]
        with self.assertRaises(ValueError):
            publisher.checked_rows(rows, 'Synthetic limit', maximum=10)
        with mock.patch.dict(publisher.LIMITS, candidateBytes=10):
            self.pins['limits'] = dict(publisher.LIMITS)
            with self.assertRaises(ValueError):
                self.assemble()
        self.assertFalse(self.site.exists())

    def test_site_union_limit_and_private_proof_limit(self):
        manifest = self.assemble()
        site2, proof2 = self.root/'site2', self.root/'proof2'
        with mock.patch.dict(publisher.LIMITS, siteBytes=manifest['siteBytes']-1):
            pins = copy.deepcopy(self.pins)
            pins['limits'] = dict(publisher.LIMITS)
            with self.assertRaises(ValueError):
                publisher.assemble_site(self.baseline, self.dist, self.binding_file, site2, proof2, pins, self.expected,
                                        baseline_expected=self.baseline_expected)
        self.assertFalse(site2.exists())
        private_limit = sum(row['bytes'] for row in publisher.inventory(self.proof))-1
        with mock.patch.dict(publisher.LIMITS, privateProofBytes=private_limit):
            pins = copy.deepcopy(self.pins)
            pins['limits'] = dict(publisher.LIMITS)
            with self.assertRaises(ValueError):
                publisher.assemble_site(self.baseline, self.dist, self.binding_file, site2, proof2, pins, self.expected,
                                        baseline_expected=self.baseline_expected)
        self.assertFalse(site2.exists())


if __name__ == '__main__':
    unittest.main(verbosity=2)
