"""Publication tests use the producer schemas and never access the live site."""
import contextlib
import copy
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import shutil
import stat
import sys
import tempfile
import types
import unittest
from unittest import mock
import warnings
import zipfile


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('unified_publication', ROOT / 'scripts/unified-publication.py')
publication = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(publication)
SOURCE = '8f2132cabdee6225bc9ebe34356a3bb1cf643dfe'
TARGET = publication.read(ROOT / 'docs/unified-publication-target.json')


def put(root, name, value):
    path = Path(root) / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(value)
    return path


def make_zip(filename, rows):
    with warnings.catch_warnings():
        warnings.simplefilter('ignore', UserWarning)
        with zipfile.ZipFile(filename, 'w', zipfile.ZIP_DEFLATED) as archive:
            for name, value in rows:
                archive.writestr(name, value)


class SyntheticRelease:
    """Frozen browser/platform packages and 977 independently preserved files."""
    def __init__(self, root):
        self.root = Path(root)
        self.inputs = self.root / 'inputs'
        self.browser = self.inputs / 'browser'
        self.site = self.root / 'site'
        self.proof = self.root / 'proof'
        self.baseline = self.root / 'baseline'
        self.config = self.root / 'config.json'
        self.baseline_config = self.root / 'baseline.json'
        self.target_config = self.root / 'target.json'
        publication.write(self.target_config, {**TARGET, 'sourceCommit': SOURCE})
        self.rooms = [{'level': level, 'stableId': f'foundation-{level:03}', 'id': f'room-{level}'} for level in range(1, 52)]
        put(self.browser, 'index.html', b'<html>accepted game</html>')
        put(self.browser, 'assets/game-v54.js', b'/* immutable source and interface */')
        put(self.browser, 'models/companion.glb', b'exact accepted companion')
        put(self.browser, 'walkthroughs.html', b'<html>build-time gallery</html>')
        self.info = {
            'schemaVersion': 1, 'commit': SOURCE, 'gameCommit': SOURCE,
            'interfaceCommit': SOURCE, 'publisherCommit': None,
            'version': 'v54-unified-campaign', 'levels': 51,
            'verified': False, 'rooms': self.rooms,
            'files': publication.inventory(self.browser),
            'packageFilesSha256': '1' * 64, 'sourceInputsSha256': '2' * 64,
        }
        publication.write(self.browser / 'build-info.json', self.info)
        publication.write(self.browser / 'release-manifest.json', self.info)
        self.platform_dir = self.root / 'platform-expanded'
        put(self.platform_dir, 'index.html', b'<html>SDK platform package</html>')
        put(self.platform_dir, 'assets/game-platform.js', b'platform runtime')
        platform_files = publication.inventory(self.platform_dir)
        publication.write(self.platform_dir / 'build-info.json', {**self.info, 'files': platform_files})
        self.yandex = self.inputs / 'yandex/artifacts/brainrot-portal-yandex.zip'
        self.yandex.parent.mkdir(parents=True)
        make_zip(self.yandex, [(row['path'], (self.platform_dir / row['path']).read_bytes()) for row in publication.inventory(self.platform_dir)])
        self.platform = {
            'commit': SOURCE, 'rooms': self.rooms, 'sourceInputsSha256': self.info['sourceInputsSha256'],
            'files': platform_files, 'platformArchive': {
                'filename': self.yandex.name, 'bytes': self.yandex.stat().st_size,
                'sha256': publication.sha(self.yandex),
            },
        }
        self.platform_path = self.inputs / 'yandex/artifacts/yandex-release-manifest.json'
        publication.write(self.platform_path, self.platform)
        self.technical = {
            'pass': True, 'commit': SOURCE, 'levels': 51, 'version': self.info['version'],
            'buildInfoSha256': publication.sha(self.browser / 'build-info.json'),
            'packageFilesSha256': self.info['packageFilesSha256'],
            'sourceInputsSha256': self.info['sourceInputsSha256'],
            'recordingRequested': True, 'checks': {'package': {'result': 'success'}, 'recording': {'result': 'success'}},
            'platformManifestSha256': publication.sha(self.platform_path),
            'platformArchive': self.platform['platformArchive'],
        }
        self.technical_path = self.inputs / 'acceptance/technical-ci.json'
        publication.write(self.technical_path, self.technical)
        self.recordings = {}
        for folder, level, fps, alternative in [
            ('recording-17', 17, 30, ''), ('recording-17-lower', 17, 12, 'lower-branch'), ('recording-1', 1, 30, ''),
            ('recording-46', 46, 12, ''), ('recording-47-manual-impact', 47, 12, 'manual-impact'), ('recording-50', 50, 12, ''), ('recording-50-free-cargo-bridge', 50, 12, 'free-cargo-bridge'),
        ]:
            # Actual recording producer stores optional alternative and relative filenames.
            directory = self.inputs / folder
            stem = f'level-{level:02}' + ('-alternate' if alternative else '')
            frames = fps * 7
            movie = put(directory, stem + '.mp4', b'video:' + folder.encode())
            put(directory, stem + '.jpg', b'poster:' + folder.encode())
            put(directory, stem + '-finish.jpg', b'finish:' + folder.encode())
            evidence = {
                'level': level, 'sourceCommit': SOURCE, 'edition': 'foundation',
                'fps': fps, 'frameCount': frames, 'durationSeconds': frames / fps,
                'width': 800, 'height': 450, 'continuous': True,
                'firstFrame': {'visualFrame': 0, 'state': 'playing', 'cargoBodyId': 10},
                'lastFrame': {'visualFrame': (frames - 1) * (60 // fps), 'state': 'won', 'cargoBodyId': 10},
                'route': {'pass': True, 'resets': 0, 'respawns': 0},
                'pixelCheck': {'frames': frames, 'allNonblank': True, 'minimumLuminanceRange': 20},
                'video': movie.name, 'poster': stem + '.jpg', 'finishPoster': stem + '-finish.jpg',
                'bytes': movie.stat().st_size, 'sha256': publication.sha(movie),
            }
            if alternative:
                evidence['alternative'] = alternative
            evidence_path = directory / (stem + '.json')
            publication.write(evidence_path, evidence)
            self.recordings[folder] = (evidence_path, evidence, {'streams': [{'codec_name': 'h264'}]})
        self.originals = {
            'index.html': b'old root runtime', 'build-info.json': b'old root metadata',
            'walkthroughs.html': b'<video src="walkthroughs/level-01.mp4"></video>',
            'walkthroughs/level-01.mp4': b'original v50 motion',
            'walkthroughs/level-01.json': b'{"version":"v50"}',
            'assets/old.js': b'old bundle preserved for history',
            'chapter-atlas/index.html': b'old chapter runtime',
            'chapter-atlas/build-info.json': b'old chapter metadata',
            'chapter-atlas/walkthroughs.html': b'<video src="walkthroughs/level-33.mp4"></video>',
            'chapter-atlas/walkthroughs/level-33.mp4': b'original v53 siphon',
            'chapter-atlas/walkthroughs/level-33.json': b'{"version":"v53"}',
            'chapter-atlas/walkthroughs/level-51.mp4': b'original echo video',
            'publication-history/previous/runtime.js': b'archived accepted runtime',
            'walkthroughs-v50.html': b'original v50 gallery already preserved',
            'chapter-atlas/walkthroughs-v53.html': b'original v53 gallery already preserved',
            'publication-receipt.json': b'previous F receipt',
            'chapter-atlas/publication-receipt.json': b'previous F chapter receipt',
            'brainrot-portal-yandex-v54.zip': b'previous F platform archive',
            'walkthroughs/v54-level-17.mp4': b'previous F canonical video',
            'walkthroughs/v54-level-17-lower.mp4': b'previous F alternate video',
            'walkthroughs/v54-level-1.mp4': b'previous F motion video',
        }
        for index in range(977 - len(self.originals)):
            self.originals[f'history/preserved-{index:04}.bin'] = f'historical file {index}'.encode()
        for name, value in self.originals.items():
            put(self.baseline, name, value)
        publication.write(self.baseline_config, {'siteFiles': publication.inventory(self.baseline), 'publicationConclusion': 'success',
            'gameCommit': TARGET['baseline']['sourceCommit'], 'interfaceCommit': TARGET['baseline']['sourceCommit'],
            'publisherCommit': TARGET['baseline']['publisherCommit'], 'publicationRun': TARGET['baseline']['publicationRun']})
        publication.write(self.config, {
            'sourceCommit': SOURCE, 'runId': 37725409355, 'runAttempt': 1, 'conclusion': 'success',
            'jobs': [{'id': index+1, 'name': name} for index,name in enumerate(TARGET['expectedJobNames'])],
            'artifacts': [{'id': index+1, 'name': f'synthetic-input-{index}', 'digest': 'sha256:' + '3' * 64, 'directory': f'input-{index}'} for index in range(TARGET['expectedArtifacts'])],
        })

    def fetch(self, rows, base, destination=None):
        self.assert_baseline(rows)
        if destination:
            shutil.copytree(self.baseline, destination)
        return {'pass': True, 'checked': len(rows), 'bytes': sum(row['bytes'] for row in rows), 'streams': 6}

    def assert_baseline(self, rows):
        assert rows == publication.inventory(self.baseline)

    def verify_recording(self, root, source, level, fps, alternative, proof):
        result = self.recordings[root.name]
        assert (source, level, fps, alternative) == (SOURCE, result[1]['level'], result[1]['fps'], result[1].get('alternative', ''))
        return result

    def assemble(self, fetch=None):
        with mock.patch.object(publication, 'CONFIG', self.config), mock.patch.object(publication, 'BASELINE', self.baseline_config), mock.patch.object(publication, 'TARGET', self.target_config), \
                mock.patch.object(publication, 'fetch_inventory', side_effect=fetch or self.fetch), \
                mock.patch.object(publication, 'verify_recording', side_effect=self.verify_recording), contextlib.redirect_stdout(io.StringIO()):
            publication.assemble(types.SimpleNamespace(inputs=str(self.inputs), site=str(self.site), proof=str(self.proof), publisher='a' * 40))


class UnifiedPublicationTests(unittest.TestCase):
    def test_extract_rejects_traversal_symlinks_duplicates_and_excess_size(self):
        link = zipfile.ZipInfo('models/alias.glb')
        link.create_system = 3
        link.external_attr = (stat.S_IFLNK | 0o777) << 16
        payloads = [
            ([('../outside', b'escape')], 500_000_000),
            ([('/absolute', b'escape')], 500_000_000),
            ([('dir\\outside', b'escape')], 500_000_000),
            ([(link, b'../outside')], 500_000_000),
            ([('same', b'first'), ('same', b'second')], 500_000_000),
            ([('oversized', b'1234')], 3),
        ]
        with tempfile.TemporaryDirectory() as temporary:
            for index, (members, limit) in enumerate(payloads):
                with self.subTest(index=index):
                    archive = Path(temporary) / f'{index}.zip'
                    make_zip(archive, members)
                    with self.assertRaises(AssertionError):
                        publication.extract(archive, Path(temporary) / f'unpacked-{index}', limit)
            self.assertFalse((Path(temporary) / 'outside').exists())

    def test_unpack_requires_exact_pinned_archive_before_extracting(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            archive = root / 'inputs/zips/browser.zip'
            archive.parent.mkdir(parents=True)
            make_zip(archive, [('index.html', b'accepted bytes')])
            config = root / 'config.json'
            pin = {'id': 1, 'name': 'campaign-browser', 'digest': 'sha256:' + publication.sha(archive), 'directory': 'browser'}
            publication.write(config, {'artifacts': [pin]})
            args = ['unified-publication.py', 'unpack', '--inputs', str(root / 'inputs'), '--proof', str(root / 'proof')]
            with mock.patch.object(publication, 'CONFIG', config), mock.patch.object(sys, 'argv', args):
                publication.main()
                self.assertEqual((root / 'inputs/browser/index.html').read_bytes(), b'accepted bytes')
                self.assertEqual(publication.read(root / 'proof/artifact-inputs.json'), [pin])
                shutil.rmtree(root / 'inputs/browser')
                # Keep the expected hash while altering the exact artifact bytes.
                make_zip(archive, [('index.html', b'replaced bytes')])
                with self.assertRaises(AssertionError):
                    publication.main()
                self.assertFalse((root / 'inputs/browser').exists())

    def test_recording_accepts_producer_schema_and_rejects_changed_body(self):
        with tempfile.TemporaryDirectory() as temporary:
            release = SyntheticRelease(temporary)
            release.proof.mkdir()
            path, evidence, _ = release.recordings['recording-17-lower']
            probe = {'streams': [{'codec_name': 'h264', 'width': evidence['width'], 'height': evidence['height'],
                                  'nb_frames': str(evidence['frameCount']), 'avg_frame_rate': '12/1'}],
                     'format': {'duration': str(evidence['durationSeconds'])}}

            def ffmpeg(args, **kwargs):
                signal = Path(args[args.index('-vf') + 1].split('file=', 1)[1])
                signal.write_text('lavfi.signalstats.YMIN=10\nlavfi.signalstats.YMAX=80\n' * evidence['frameCount'])

            with mock.patch.object(publication.subprocess, 'check_output', return_value=json.dumps(probe).encode()), \
                    mock.patch.object(publication.subprocess, 'run', side_effect=ffmpeg):
                found, verified, _ = publication.verify_recording(path.parent, SOURCE, 17, 12, 'lower-branch', release.proof)
                self.assertEqual(found, path)
                self.assertEqual(verified, evidence)
                modified = copy.deepcopy(evidence)
                modified['lastFrame']['cargoBodyId'] = 11
                publication.write(path, modified)
                with self.assertRaises(AssertionError):
                    publication.verify_recording(path.parent, SOURCE, 17, 12, 'lower-branch', release.proof)

    def test_assembly_preserves_history_and_delivers_same_package_in_both_entries(self):
        with tempfile.TemporaryDirectory() as temporary:
            release = SyntheticRelease(temporary)
            release.assemble()
            replaced = {'index.html', 'build-info.json', 'walkthroughs.html', 'chapter-atlas/index.html',
                        'chapter-atlas/build-info.json', 'chapter-atlas/walkthroughs.html',
                        'publication-receipt.json', 'chapter-atlas/publication-receipt.json'}
            for name, original in release.originals.items():
                if name not in replaced:
                    self.assertEqual((release.site / name).read_bytes(), original, name)
            self.assertEqual((release.site / 'walkthroughs-v54-578c31e.html').read_bytes(), release.originals['walkthroughs.html'])
            self.assertEqual((release.site / 'chapter-atlas/walkthroughs-v54-578c31e.html').read_bytes(), release.originals['chapter-atlas/walkthroughs.html'])
            self.assertFalse((release.site / 'chapter-atlas/walkthroughs-v50.html').exists())
            for row in publication.inventory(release.browser):
                if row['path'] != 'walkthroughs.html':
                    for prefix in ['', 'chapter-atlas']:
                        self.assertEqual((release.site / prefix / row['path']).read_bytes(), (release.browser / row['path']).read_bytes())
            for prefix in ['', 'chapter-atlas']:
                gallery = (release.site / prefix / 'walkthroughs.html').read_text()
                self.assertIn('href="/brainrot-portal/walkthroughs-v50.html"', gallery)
                self.assertIn('href="/brainrot-portal/chapter-atlas/walkthroughs-v53.html"', gallery)
                for record in TARGET['recordings']:
                    folder, stem = record['directory'], publication.recording_stem(record, SOURCE)
                    original, evidence, _ = release.recordings[folder]
                    self.assertEqual((release.site / prefix / 'walkthroughs' / (stem + '.json')).read_bytes(), original.read_bytes())
                    self.assertEqual((release.site / prefix / 'walkthroughs' / (stem + '.mp4')).read_bytes(), (original.parent / evidence['video']).read_bytes())
            manifest = publication.read(release.proof / 'manifest.json')
            self.assertEqual(manifest['siteFiles'], publication.inventory(release.site))
            self.assertEqual(manifest['successfulJobs'], TARGET['expectedJobs'])
            self.assertEqual(manifest['publicationPaths'], ['', 'chapter-atlas/'])
            self.assertEqual((release.site / 'brainrot-portal-yandex-8f2132c.zip').read_bytes(), release.yandex.read_bytes())
            self.assertEqual((release.site / 'publication-receipt.json').read_bytes(), (release.site / 'chapter-atlas/publication-receipt.json').read_bytes())
            # Every replaced F byte, including receipts and build identities, has
            # a checksum-identical historical copy; old media stays in place.
            archived = manifest['archivedReplacements']
            self.assertEqual({row['originalPath'] for row in archived}, replaced)
            for row in archived:
                self.assertEqual((release.site / row['archivePath']).read_bytes(), release.originals[row['originalPath']])
                self.assertEqual(publication.sha(release.site / row['archivePath']), row['sha256'])
            self.assertEqual((release.site / 'walkthroughs-v50.html').read_bytes(), release.originals['walkthroughs-v50.html'])
            self.assertEqual((release.site / 'chapter-atlas/walkthroughs-v53.html').read_bytes(), release.originals['chapter-atlas/walkthroughs-v53.html'])
            self.assertEqual((release.site / 'brainrot-portal-yandex-v54.zip').read_bytes(), release.originals['brainrot-portal-yandex-v54.zip'])

    def test_assembly_rejects_pending_or_incomplete_review_and_old_baseline(self):
        for kind in ['pending', 'missing-job', 'foreign-job', 'missing-artifact', 'old-baseline']:
            with self.subTest(kind=kind), tempfile.TemporaryDirectory() as temporary:
                release = SyntheticRelease(temporary)
                config = publication.read(release.config)
                if kind == 'pending':
                    config['conclusion'] = 'pending'
                elif kind == 'missing-job':
                    config['jobs'].pop()
                elif kind == 'foreign-job':
                    config['jobs'][0]['name'] = 'Successful unrelated job'
                elif kind == 'missing-artifact':
                    config['artifacts'].pop()
                else:
                    baseline = publication.read(release.baseline_config)
                    baseline['siteFiles'] = baseline['siteFiles'][:880]
                    publication.write(release.baseline_config, baseline)
                publication.write(release.config, config)
                fetch = mock.Mock(side_effect=AssertionError('Incomplete inputs must fail before touching live publication'))
                with self.assertRaises(AssertionError):
                    release.assemble(fetch)
                fetch.assert_not_called()
                self.assertFalse(release.site.exists())

    def test_baseline_adoption_requires_pinned_successful_F_and_manifest_hash(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            target = copy.deepcopy(TARGET)
            manifest = {'gameCommit': target['baseline']['sourceCommit'], 'interfaceCommit': target['baseline']['sourceCommit'],
                        'publisherCommit': target['baseline']['publisherCommit'], 'publicationRun': target['baseline']['publicationRun'],
                        'reviewConclusion': 'success', 'siteFiles': [{'path': f'history/{index}.bin'} for index in range(977)]}
            original = root / 'original.json'
            publication.write(original, manifest)
            archive = root / 'inputs/zips/baseline-publication.zip'
            archive.parent.mkdir(parents=True)
            make_zip(archive, [('manifest.json', original.read_bytes())])
            pin = {**target['baseline']['proofArtifact'], 'sizeBytes': archive.stat().st_size, 'digest': 'sha256:' + publication.sha(archive)}
            target['baseline'].update(proofArtifact=pin, manifestSha256=publication.sha(original))
            target_path, accepted_path = root / 'target.json', root / 'accepted.json'
            publication.write(target_path, target)
            gate = {'publicationRun': target['baseline']['publicationRun'], 'publisherCommit': target['baseline']['publisherCommit'],
                    'publicationConclusion': 'success', 'runAttempt': 1, 'artifact': pin}
            gate_path = root / 'proof/baseline-artifact.json'
            publication.write(gate_path, gate)
            args = types.SimpleNamespace(inputs=str(root / 'inputs'), proof=str(root / 'proof'))
            with mock.patch.object(publication, 'TARGET', target_path), mock.patch.object(publication, 'BASELINE', accepted_path), contextlib.redirect_stdout(io.StringIO()):
                publication.adopt_baseline(args)
                accepted = publication.read(accepted_path)
                self.assertEqual(accepted['publicationConclusion'], 'success')
                self.assertEqual(len(accepted['siteFiles']), 977)
                shutil.rmtree(root / 'inputs/baseline-publication')
                accepted_path.unlink()
                gate['publicationConclusion'] = 'failure'
                publication.write(gate_path, gate)
                with self.assertRaises(AssertionError):
                    publication.adopt_baseline(args)
                self.assertFalse(accepted_path.exists())
                gate['publicationConclusion'] = 'success'
                publication.write(gate_path, gate)
                target['baseline']['manifestSha256'] = '0' * 64
                publication.write(target_path, target)
                with self.assertRaises(AssertionError):
                    publication.adopt_baseline(args)
                self.assertFalse(accepted_path.exists())

    def test_assembly_rejects_tampered_game_or_acceptance_before_live_fetch(self):
        for kind in ['browser', 'technical', 'platform', 'platform-zip']:
            with self.subTest(kind=kind), tempfile.TemporaryDirectory() as temporary:
                release = SyntheticRelease(temporary)
                if kind == 'browser':
                    put(release.browser, 'assets/game-v54.js', b'changed runtime')
                elif kind == 'technical':
                    publication.write(release.technical_path, {**release.technical, 'buildInfoSha256': '0' * 64})
                elif kind == 'platform':
                    publication.write(release.platform_path, {**release.platform, 'commit': '0' * 40})
                    publication.write(release.technical_path, {**release.technical, 'platformManifestSha256': publication.sha(release.platform_path)})
                else:
                    make_zip(release.yandex, [('index.html', b'swapped platform')])
                fetch = mock.Mock(side_effect=AssertionError('Live baseline must not be touched'))
                with self.assertRaises(AssertionError):
                    release.assemble(fetch)
                fetch.assert_not_called()
                self.assertFalse(release.site.exists())

    def test_public_fetch_checks_hash_and_removes_partial_download(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            accepted = b'accepted remote evidence'
            row = {'path': 'walkthroughs/history.json', 'bytes': len(accepted), 'sha256': hashlib.sha256(accepted).hexdigest()}

            class Response(io.BytesIO):
                status = 200

            with mock.patch.object(publication.urllib.request, 'urlopen', side_effect=lambda *args, **kwargs: Response(accepted)):
                report = publication.fetch_inventory([row], 'https://example.test/game/', root / 'good')
                self.assertTrue(report['pass'])
                self.assertEqual((root / 'good' / row['path']).read_bytes(), accepted)
            with mock.patch.object(publication.urllib.request, 'urlopen', side_effect=lambda *args, **kwargs: Response(b'X' * len(accepted))), \
                    mock.patch.object(publication.time, 'sleep'):
                with self.assertRaises(AssertionError):
                    publication.fetch_inventory([row], 'https://example.test/game/', root / 'bad')
                self.assertFalse((root / 'bad' / row['path']).exists())
                self.assertFalse((root / 'bad' / (row['path'] + '.download')).exists())


if __name__ == '__main__':
    unittest.main()
