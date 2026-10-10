"""CPU-only fixtures for safe archives and exact-source publication byte proofs."""
import argparse
import contextlib
import copy
import functools
import hashlib
import http.server
import importlib.util
import io
import json
import pathlib
import stat
import tarfile
import tempfile
import threading
import unittest
import warnings
import zipfile
from unittest.mock import patch


SCRIPT = pathlib.Path(__file__).with_name('publish-puzzle-progression-finale.py')
spec = importlib.util.spec_from_file_location('publication', SCRIPT)
pub = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pub)
SOURCE, PUBLISHER = 'a' * 40, 'b' * 40
REVIEW = {'runId': 37770000001, 'runAttempt': 2}
RUN = 37770000002
EXPECTED = {'sourceCommit': SOURCE, 'publisherCommit': PUBLISHER,
            'publicationRun': RUN, 'sourceReview': REVIEW}


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode()


def tar_bytes(entries):
    target = io.BytesIO()
    with tarfile.open(fileobj=target, mode='w') as archive:
        for name, value, kind in entries:
            entry = tarfile.TarInfo(name)
            entry.type = kind
            if kind == tarfile.REGTYPE:
                entry.size = len(value)
                archive.addfile(entry, io.BytesIO(value))
            else:
                if kind in (tarfile.SYMTYPE, tarfile.LNKTYPE):
                    entry.linkname = '../escape'
                archive.addfile(entry)
    return target.getvalue()


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


@contextlib.contextmanager
def local_server(directory):
    handler = functools.partial(QuietHandler, directory=str(directory))
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield 'http://127.0.0.1:' + str(server.server_port)
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


class PublicationFixtures(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = pathlib.Path(self.temp.name)
        self.archive = self.root / 'baseline'
        self.archive.mkdir()
        self.candidate = self.root / 'candidate'
        self.candidate.mkdir()
        self.site, self.proof = self.root / 'site', self.root / 'proof'
        self.baseline = {
            'build-info.json': json_bytes({'commit': pub.BASELINE_SOURCE, 'publisherCommit': None}),
            'puzzle-pilot/build-info.json': json_bytes({'commit': pub.PRIOR_PILOT_SOURCE,
                                                     'version': 'v54-puzzle-pilot43-v1', 'publisherCommit': None}),
            'puzzle-pilot/evidence/level-43.mp4': b'old pilot movie\x00\x80',
            'puzzle-pilot/preview-status.json': json_bytes({'sourceCommit': pub.PRIOR_PILOT_SOURCE, 'publisherCommit': pub.PRIOR_PILOT_PUBLISHER}),
            'puzzle-progression/build-info.json': json_bytes({'commit': pub.PRIOR_PROGRESSION_SOURCE, 'publisherCommit': None, 'sourceReview': pub.PRIOR_PROGRESSION_REVIEW}),
            'puzzle-progression/preview-status.json': json_bytes({'sourceCommit': pub.PRIOR_PROGRESSION_SOURCE, 'publisherCommit': pub.PRIOR_PROGRESSION_PUBLISHER, 'publicationRun': pub.PRIOR_PROGRESSION_PUBLICATION_RUN, 'sourceReview': pub.PRIOR_PROGRESSION_REVIEW}),
            'puzzle-progression/evidence/level-44.mp4': b'accepted rooms 44-46 movie',
            'puzzle-progression-next/build-info.json': json_bytes({'commit': pub.PRIOR_NEXT_SOURCE, 'publisherCommit': None, 'sourceReview': pub.PRIOR_NEXT_REVIEW}),
            'puzzle-progression-next/preview-status.json': json_bytes({'sourceCommit': pub.PRIOR_NEXT_SOURCE, 'publisherCommit': pub.PRIOR_NEXT_PUBLISHER, 'publicationRun': pub.PRIOR_NEXT_PUBLICATION_RUN, 'sourceReview': pub.PRIOR_NEXT_REVIEW}),
            'puzzle-progression-next/evidence/level-47.mp4': b'accepted rooms 47-49 movie',
            'index.html': b'accepted game\x00\xff',
            'assets/old.bin': bytes(range(256)),
        }
        self.baseline_patches = [patch.object(pub, 'BASELINE_FILES', len(self.baseline)),
                                 patch.object(pub, 'BASELINE_BYTES', sum(map(len, self.baseline.values())))]
        for operation in self.baseline_patches:
            operation.start()
            self.addCleanup(operation.stop)
        self.write_baseline()
        self.rooms = []
        for level in pub.LEVELS:
            movie = b'exact movie ' + str(level).encode()
            digest = hashlib.sha256(movie).hexdigest()
            report = {'sourceCommit': SOURCE, 'sourceReview': REVIEW, 'level': level,
                      'sha256': digest, 'bytes': len(movie), 'continuous': True,
                      'firstFrame': {'visualFrame': 0}, 'lastFrame': {'state': 'won'},
                      'route': {'pass': True, 'level': level, 'resets': 0, 'respawns': 0, 'teleports': 0, 'frames': 72, 'sameCompanion': True},
                      'pixelCheck': {'allNonblank': True}, 'fps': 4, 'width': 640, 'height': 360,
                      'frameCount': 24, 'durationSeconds': 6, 'method': 'fixture ordinary route',
                      'milestones': ['start', 'mechanism', 'victory'],
                      'decode': {'pass': True, 'method': 'fixture full final movie decode'}}
            walkthrough = {key: report[key] for key in ('sourceCommit', 'sourceReview', 'sha256',
                           'continuous', 'fps', 'durationSeconds', 'method')}
            walkthrough.update({'video': f'evidence/level-{level}.mp4', 'report': f'evidence/level-{level}.json',
                                'poster': f'evidence/level-{level}.jpg'})
            self.rooms.append({'level': level, 'id': 'room-' + str(level), 'title': 'Комната ' + str(level),
                               'currentWalkthrough': walkthrough})
            self.write_candidate(f'evidence/level-{level}.mp4', movie)
            self.write_candidate(f'evidence/level-{level}.jpg', b'first native poster')
            self.write_candidate(f'evidence/level-{level}-finish.jpg', b'victory native poster')
            self.write_candidate_json(f'evidence/level-{level}.json', report)
            self.write_candidate_json(f'evidence/browser-report-{level}.json',
                                      {'pass': True, 'sourceCommit': SOURCE, 'sourceReview': REVIEW, 'level': level,
                                       'route': report['route'], 'modelIdentity': {'pass': True, 'observedFrames': 72, 'playerVertices': 96753, 'bones': 15, 'playerRootUuid': 'original-player', 'cargoUuid': 'original-cargo', 'cargoBodyId': 42, 'initialization': {'resetRun': 1, 'resetCargo': 1, 'respawn': 1}, 'routeResets': 0, 'routeRespawns': 0},
                                       'originalProgressUnchanged': True, 'previousPilotProgressUnchanged': True, 'previousProgressionUnchanged': True, 'previousProgressionNextUnchanged': True, 'mobileTouchInput': {'pass': True, 'emulated': True, 'coarsePointer': True, 'viewport': {'width': 390, 'height': 844}, 'movement': {'input': [1, 0], 'before': [0, 3, 0], 'after': [.4, 3, 0], 'distance': .4, 'horizontalDistance': .4, 'state': 'playing'}, 'jumpStart': 3, 'jumpPeak': 3.8, 'sprintToggle': True, 'pauseResume': True, 'stickReleased': True}, 'pauseResumePassed': True,
                                       'replayPassed': True, 'mobileControls': True, 'nextRoomPassed': True,
                                       'pixels': ['start', 'journey', 'victory']})
        self.metadata = {'commit': SOURCE, 'publisherCommit': None, 'version': pub.VERSION, 'sourceReview': REVIEW,
                         'features': {'puzzleProgression': {'optIn': True, 'levels': pub.LEVELS, 'reviewedLevels': pub.LEVELS, 'playableLevels': pub.PLAYABLE_LEVELS, 'revision': pub.REVISION, 'query': pub.QUERY, 'storagePrefix': pub.STORAGE_PREFIX, 'rooms': self.rooms}}}
        self.write_candidate_json('build-info.json', self.metadata)
        self.receipt = {'pass': True, 'sourceCommit': SOURCE, 'sourceReview': REVIEW, 'requiredLevels': pub.LEVELS,
                        'cpu': {'pass': True, 'testCount': 1605, 'sourceCommit': SOURCE, 'sourceReview': REVIEW,
                                'passed': 1605, 'failed': 0, 'cancelled': 0, 'skipped': 0, 'todo': 0, 'allActiveGameTests': True, 'logSha256': 'd' * 64},
                        'native': [{'pass': True, 'level': level, 'sourceCommit': SOURCE, 'sourceReview': REVIEW,
                                    'report': f'evidence/browser-report-{level}.json'}
                                   for level in pub.LEVELS],
                        'recordings': [{'pass': True, 'level': room['level'], 'sourceCommit': SOURCE,
                                        'sourceReview': REVIEW, 'sha256': room['currentWalkthrough']['sha256'],
                                        'decode': {'pass': True, 'method': 'fixture full final movie decode'}}
                                       for room in self.rooms]}
        self.write_candidate_json('evidence/review-receipt.json', self.receipt)
        self.write_candidate('index.html', b'new opt-in game')
        self.write_candidate('assets/game.js', b'new game bytes')
        base_files = [row for row in pub.inventory(self.candidate)
                      if not row['path'].startswith('evidence/')
                      and row['path'] not in ('build-info.json', 'release-manifest.json')]
        base_digest = hashlib.sha256(json.dumps(base_files, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
        self.base_package = {'pass': True, 'sourceCommit': SOURCE, 'sourceReview': REVIEW,
                             'files': base_files, 'filesSha256': base_digest}
        self.receipt['basePackage'] = self.base_package
        self.metadata['features']['puzzleProgression']['testedGamePackageSha256'] = base_digest
        self.write_candidate_json('evidence/review-receipt.json', self.receipt)
        for level in pub.LEVELS:
            self.mutate_json(self.candidate / f'evidence/browser-report-{level}.json',
                             lambda row: row.update(nativePackage=self.base_package))
            self.mutate_json(self.candidate / f'evidence/level-{level}.json',
                             lambda row: row.update(nativePackage=self.base_package))
        self.metadata['files'] = [row for row in pub.inventory(self.candidate)
                                  if row['path'] not in ('build-info.json', 'release-manifest.json')]
        self.metadata['packageFilesSha256'] = hashlib.sha256(json.dumps(
            self.metadata['files'], ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
        self.write_candidate_json('build-info.json', self.metadata)
        self.args = argparse.Namespace(baseline=str(self.archive), candidate=str(self.candidate),
                                      site=str(self.site), proof=str(self.proof), source=SOURCE,
                                      publisher=PUBLISHER, run=str(RUN), review_run=str(REVIEW['runId']),
                                      review_attempt=str(REVIEW['runAttempt']), baseline_run=str(pub.BASELINE_RUN),
                                      baseline_source=pub.BASELINE_SOURCE, baseline_publisher=pub.BASELINE_PUBLISHER)

    def write_baseline(self, entries=None):
        if entries is None:
            entries = [('./', b'', tarfile.DIRTYPE), ('./puzzle-pilot/', b'', tarfile.DIRTYPE)]
            entries += [(name, value, tarfile.REGTYPE) for name, value in self.baseline.items()]
        (self.archive / 'artifact.tar').write_bytes(tar_bytes(entries))

    def write_candidate(self, name, value):
        filename = self.candidate / name
        filename.parent.mkdir(parents=True, exist_ok=True)
        filename.write_bytes(value)

    def write_candidate_json(self, name, value):
        self.write_candidate(name, json_bytes(value))

    def mutate_json(self, filename, mutate):
        value = pub.read_json(filename)
        mutate(value)
        pub.write_json(filename, value)

    def restamp_candidate_files(self):
        metadata = pub.read_json(self.candidate / 'build-info.json')
        metadata['files'] = [row for row in pub.inventory(self.candidate)
                             if row['path'] not in ('build-info.json', 'release-manifest.json')]
        metadata['packageFilesSha256'] = hashlib.sha256(json.dumps(
            metadata['files'], ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
        self.write_candidate_json('build-info.json', metadata)

    def assemble(self):
        with contextlib.redirect_stdout(io.StringIO()):
            pub.assemble(self.args)
        return pub.read_json(self.proof / 'manifest.json')

    def verification_args(self, base, phase='published'):
        return argparse.Namespace(base=base, phase=phase, manifest=str(self.proof / (
            'manifest.json' if phase == 'published' else 'baseline-manifest.json')),
            output=str(self.root / ('verify-' + phase + '.json')), source=SOURCE, publisher=PUBLISHER,
            run=str(RUN), review_run=str(REVIEW['runId']), review_attempt=str(REVIEW['runAttempt']))

    def test_accepted_baseline_and_tested_candidate_are_preserved_byte_for_byte(self):
        candidate_before = pub.inventory(self.candidate)
        manifest = self.assemble()
        for name, value in self.baseline.items():
            self.assertEqual((self.site / name).read_bytes(), value)
        for row in candidate_before:
            self.assertEqual(pub.sha256_file(self.site / pub.PREFIX / row['path']), row['sha256'])
        self.assertEqual(manifest['publisherCommit'], PUBLISHER)
        self.assertNotEqual(manifest['publisherCommit'], manifest['sourceCommit'])
        self.assertEqual(manifest['sourceReview'], REVIEW)
        self.assertEqual(manifest['candidateFiles'], candidate_before)
        self.assertEqual(self.base_package['files'], [row for row in candidate_before
                         if not row['path'].startswith('evidence/')
                         and row['path'] not in ('build-info.json', 'release-manifest.json')])
        self.assertEqual(len(manifest['siteFiles']), len(self.baseline) + len(candidate_before) + 2)
        self.assertTrue(all(row['path'].startswith(pub.PREFIX) for row in manifest['progressionFiles']))
        self.assertEqual(pub.read_json(self.site / pub.PREFIX / 'build-info.json')['publisherCommit'], None)
        page = (self.site / pub.PREFIX / 'walkthroughs.html').read_text()
        for level in pub.LEVELS:
            self.assertIn(f'evidence/level-{level}.mp4', page)
            self.assertIn(f'level={level}&amp;pilot=progression', page)
        self.assertEqual(manifest['query'], '?edition=foundation&level=50&pilot=progression')

    def test_every_public_byte_is_checked_for_both_expected_phases(self):
        manifest = self.assemble()
        with local_server(self.site) as base, contextlib.redirect_stdout(io.StringIO()):
            for phase in ('preflight', 'published'):
                args = self.verification_args(base, phase)
                pub.verify(args)
                report = pub.read_json(pathlib.Path(args.output))
                self.assertTrue(report['pass'])
                self.assertEqual(report['phase'], phase)
                rows = manifest['preservedFiles'] if phase == 'preflight' else manifest['siteFiles']
                self.assertEqual(report['checked'], len(rows))
                self.assertEqual(report['bytes'], sum(row['bytes'] for row in rows))
                self.assertEqual(report['sourceCommit'], SOURCE)
                self.assertEqual(report['publisherCommit'], PUBLISHER)
                self.assertEqual(report['sourceReview'], REVIEW)

    def test_unsafe_tar_namespace_is_rejected_before_extraction(self):
        cases = [
            [('..' + '/outside', b'x', tarfile.REGTYPE)],
            [('/absolute', b'x', tarfile.REGTYPE)],
            [('a\\b', b'x', tarfile.REGTYPE)],
            [('C:/drive', b'x', tarfile.REGTYPE)],
            [('a//b', b'x', tarfile.REGTYPE)],
            [('dup', b'one', tarfile.REGTYPE), ('./dup', b'two', tarfile.REGTYPE)],
            [('dir/', b'', tarfile.DIRTYPE), ('dir', b'', tarfile.DIRTYPE)],
            [('link', b'', tarfile.SYMTYPE)],
            [('hardlink', b'', tarfile.LNKTYPE)],
            [('fifo', b'', tarfile.FIFOTYPE)],
            [('a', b'file', tarfile.REGTYPE), ('a/b', b'child', tarfile.REGTYPE)],
            [('a/b', b'child', tarfile.REGTYPE), ('a', b'file', tarfile.REGTYPE)],
            [('a/', b'', tarfile.DIRTYPE), ('a', b'file', tarfile.REGTYPE)],
            [(pub.PREFIX, b'', tarfile.DIRTYPE)],
            [(pub.PREFIX + 'injected', b'x', tarfile.REGTYPE)],
        ]
        for index, entries in enumerate(cases):
            with self.subTest(index=index):
                self.write_baseline(entries)
                with self.assertRaises(ValueError):
                    pub.extract_baseline(self.archive / 'artifact.tar', self.site)
                self.assertFalse(self.site.exists())
        self.assertFalse((self.root / 'outside').exists())

    def test_invalid_tar_sizes_are_rejected(self):
        for size in (-1, float('nan'), float('inf'), pub.MAX_BASELINE_BYTES + 1):
            with self.subTest(size=size):
                entry = tarfile.TarInfo('file')
                entry.size = size
                archive = unittest.mock.MagicMock()
                archive.__enter__.return_value = archive
                archive.__iter__.return_value = iter([entry])
                with patch.object(pub.tarfile, 'open', return_value=archive), self.assertRaises(ValueError):
                    pub.extract_baseline(self.archive / 'artifact.tar', self.site)
                self.assertFalse(self.site.exists())

    def test_existing_site_or_proof_is_never_overwritten(self):
        for name in ('site', 'proof'):
            with self.subTest(name=name):
                location = getattr(self, name)
                location.mkdir()
                sentinel = location / 'keep'
                sentinel.write_bytes(b'keep')
                if name == 'proof':
                    (location / 'manifest.json').write_bytes(b'old proof')
                with self.assertRaises(ValueError):
                    pub.assemble(self.args)
                self.assertEqual(sentinel.read_bytes(), b'keep')
                sentinel.unlink()
                (location / 'manifest.json').unlink(missing_ok=True)
                location.rmdir()

    def test_existing_guard_proof_directory_keeps_receipts_during_assembly(self):
        self.proof.mkdir()
        receipt = self.proof / 'downloaded-review-inputs.json'
        receipt.write_bytes(b'accepted exact archive checksums')
        self.assemble()
        self.assertEqual(receipt.read_bytes(), b'accepted exact archive checksums')
        self.assertTrue((self.proof / 'manifest.json').is_file())

    def test_input_public_site_and_private_proof_paths_cannot_overlap(self):
        for attribute, value in [('site', str(self.candidate / 'site')),
                                  ('proof', str(self.site / 'proof')),
                                  ('proof', str(self.candidate / 'proof'))]:
            with self.subTest(attribute=attribute, value=value):
                args = copy.copy(self.args)
                setattr(args, attribute, value)
                with self.assertRaisesRegex(ValueError, 'disjoint'):
                    pub.assemble(args)
                self.assertFalse(self.site.exists())

    def test_baseline_count_and_size_are_pinned(self):
        rows = [{'path': key, 'bytes': len(value), 'sha256': hashlib.sha256(value).hexdigest()}
                for key, value in self.baseline.items()]
        with self.assertRaisesRegex(ValueError, 'count'):
            pub.check_baseline(rows[:-1])
        wrong = copy.deepcopy(rows)
        wrong[0]['bytes'] += 1
        with self.assertRaisesRegex(ValueError, 'byte count'):
            pub.check_baseline(wrong)

    def test_baseline_metadata_and_prior_pilot_source_are_pinned(self):
        for filename, key, value in [('build-info.json', 'commit', SOURCE),
                                      ('build-info.json', 'publisherCommit', PUBLISHER),
                                      ('puzzle-pilot/build-info.json', 'commit', SOURCE)]:
            with self.subTest(filename=filename, key=key):
                original = self.baseline[filename]
                metadata = json.loads(original)
                metadata[key] = value
                self.baseline[filename] = json_bytes(metadata)
                self.write_baseline()
                with patch.object(pub, 'BASELINE_BYTES', sum(map(len, self.baseline.values()))), self.assertRaises(ValueError):
                    pub.assemble(self.args)
                shutil = __import__('shutil')
                shutil.rmtree(self.site)
                self.baseline[filename] = original

    def test_every_walkthrough_native_report_and_receipt_is_same_exact_review(self):
        cases = [
            ('evidence/level-50.json', lambda row: row.update(sourceCommit='c' * 40)),
            ('evidence/level-51.json', lambda row: row['sourceReview'].update(runAttempt=1)),
            ('evidence/level-51.json', lambda row: row['sourceReview'].update(runId=REVIEW['runId'] - 1)),
            ('evidence/browser-report-50.json', lambda row: row.update({'pass': False})),
            ('evidence/browser-report-51.json', lambda row: row['sourceReview'].update(runAttempt=1)),
            ('evidence/browser-report-51.json', lambda row: row.update(sourceCommit='c' * 40)),
            ('evidence/review-receipt.json', lambda row: row.update(sourceCommit='c' * 40)),
            ('evidence/review-receipt.json', lambda row: row['native'][1]['sourceReview'].update(runAttempt=1)),
            ('evidence/review-receipt.json', lambda row: row['recordings'][1].update(sha256='f' * 64)),
            ('evidence/review-receipt.json', lambda row: row['cpu'].update(testCount=1604, passed=1604)),
            ('evidence/review-receipt.json', lambda row: row['cpu'].update(passed=1604)),
            ('evidence/review-receipt.json', lambda row: row['cpu'].update(cancelled=1)),
            ('evidence/review-receipt.json', lambda row: row['cpu'].update(skipped=1)),
            ('evidence/review-receipt.json', lambda row: row['cpu'].update(todo=1)),
            ('evidence/review-receipt.json', lambda row: row['cpu'].pop('todo')),
            ('evidence/review-receipt.json', lambda row: row['cpu'].update(testCount=1536)),
            ('evidence/review-receipt.json', lambda row: row['cpu'].update(sourceCommit='c' * 40)),
            ('evidence/review-receipt.json', lambda row: row['cpu']['sourceReview'].update(runAttempt=1)),
            ('evidence/level-50.json', lambda row: row['decode'].update({'pass': False})),
            ('evidence/browser-report-51.json', lambda row: row['modelIdentity'].update({'pass': False})),
            ('build-info.json', lambda row: row['sourceReview'].update(runAttempt=1)),
            ('build-info.json', lambda row: row['features']['puzzleProgression']['rooms'][1]['currentWalkthrough']['sourceReview'].update(runAttempt=1)),
        ]
        for filename, mutate in cases:
            with self.subTest(filename=filename):
                path = self.candidate / filename
                original = path.read_bytes()
                self.mutate_json(path, mutate)
                with self.assertRaises(ValueError):
                    pub.assemble(self.args)
                self.assertFalse(self.site.exists())
                path.write_bytes(original)

    def test_incomplete_routes_changed_movies_and_extra_movies_are_rejected(self):
        for key, value in [('teleports', -1), ('respawns', 1), ('resets', 1)]:
            path = self.candidate / 'evidence/level-50.json'
            original = path.read_bytes()
            self.mutate_json(path, lambda row: row['route'].update({key: value}))
            with self.assertRaises(ValueError):
                pub.check_candidate(self.candidate, EXPECTED)
            path.write_bytes(original)
        movie = self.candidate / 'evidence/level-51.mp4'
        original = movie.read_bytes()
        movie.write_bytes(original + b'tamper')
        with self.assertRaisesRegex(ValueError, 'hash'):
            pub.check_candidate(self.candidate, EXPECTED)
        movie.write_bytes(original)
        self.write_candidate('evidence/unreviewed.mp4', b'stale movie')
        with self.assertRaisesRegex(ValueError, 'Every progression movie'):
            pub.check_candidate(self.candidate, EXPECTED)

    def test_candidate_links_and_special_files_are_rejected(self):
        (self.candidate / 'escape').symlink_to(self.root / 'elsewhere')
        with self.assertRaisesRegex(ValueError, 'non-regular'):
            pub.assemble(self.args)
        self.assertFalse(self.site.exists())

    def test_legitimate_portal_traversals_are_accepted(self):
        path = self.candidate / 'evidence/level-51.json'
        self.mutate_json(path, lambda row: row['route'].update(teleports=1))
        self.mutate_json(self.candidate / 'evidence/browser-report-51.json', lambda row: row['route'].update(teleports=1))
        metadata = pub.read_json(self.candidate / 'build-info.json')
        metadata['files'] = [row for row in pub.inventory(self.candidate)
                             if row['path'] not in ('build-info.json', 'release-manifest.json')]
        metadata['packageFilesSha256'] = hashlib.sha256(json.dumps(
            metadata['files'], ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
        self.write_candidate_json('build-info.json', metadata)
        pub.check_candidate(self.candidate, EXPECTED)

    def test_candidate_package_rejects_extra_missing_changed_files_and_digest(self):
        metadata_file = self.candidate / 'build-info.json'
        original = metadata_file.read_bytes()
        self.mutate_json(metadata_file, lambda row: row.update(packageFilesSha256='f' * 64))
        with self.assertRaisesRegex(ValueError, 'digest'):
            pub.check_candidate(self.candidate, EXPECTED)
        metadata_file.write_bytes(original)
        asset = self.candidate / 'assets/game.js'
        asset_original = asset.read_bytes()
        for operation in ('extra', 'missing', 'changed'):
            with self.subTest(operation=operation):
                if operation == 'extra':
                    self.write_candidate('assets/unreviewed.js', b'extra')
                elif operation == 'missing':
                    asset.unlink()
                else:
                    asset.write_bytes(b'tampered game')
                with self.assertRaisesRegex(ValueError, 'stamped package inventory|single tested base package'):
                    pub.check_candidate(self.candidate, EXPECTED)
                asset.write_bytes(asset_original)
                (self.candidate / 'assets/unreviewed.js').unlink(missing_ok=True)

    def test_single_cpu_game_package_is_bound_to_native_rooms_movies_and_final_assets(self):
        pub.check_candidate(self.candidate, EXPECTED)
        for level in pub.LEVELS:
            browser = pub.read_json(self.candidate / f'evidence/browser-report-{level}.json')
            recording = pub.read_json(self.candidate / f'evidence/level-{level}.json')
            self.assertEqual(browser['nativePackage'], self.base_package)
            self.assertEqual(recording['nativePackage'], self.base_package)
        self.assertEqual(self.metadata['features']['puzzleProgression']['testedGamePackageSha256'],
                         self.base_package['filesSha256'])
        self.write_candidate('assets/game.js', b'rebuilt game under the same source')
        self.restamp_candidate_files()
        with self.assertRaisesRegex(ValueError, 'Final game files differ from the single tested base package'):
            pub.check_candidate(self.candidate, EXPECTED)

    def test_single_build_receipt_native_and_movie_proofs_reject_substitution(self):
        cases = [('evidence/review-receipt.json', lambda row: row['basePackage'].update(sourceCommit='c' * 40), 'stale source'),
                 ('evidence/review-receipt.json', lambda row: row['basePackage']['sourceReview'].update(runAttempt=1), 'stale review'),
                 ('evidence/review-receipt.json', lambda row: row['basePackage'].update(filesSha256='f' * 64), 'file digest'),
                 ('build-info.json', lambda row: row['features']['puzzleProgression'].update(testedGamePackageSha256='f' * 64), 'Metadata tested'),
                 ('evidence/browser-report-50.json', lambda row: row['nativePackage'].update(filesSha256='f' * 64), 'same single base package'),
                 ('evidence/level-51.json', lambda row: row['nativePackage'].update(filesSha256='f' * 64), 'same single base package')]
        metadata_path = self.candidate / 'build-info.json'
        original_metadata = metadata_path.read_bytes()
        for name, mutate, error in cases:
            with self.subTest(name=name, error=error):
                filename = self.candidate / name
                original = filename.read_bytes()
                self.mutate_json(filename, mutate)
                self.restamp_candidate_files()
                with self.assertRaisesRegex(ValueError, error):
                    pub.check_candidate(self.candidate, EXPECTED)
                filename.write_bytes(original)
                metadata_path.write_bytes(original_metadata)

    def test_browser_mobile_controls_must_be_verified(self):
        filename = self.candidate / 'evidence/browser-report-50.json'
        original = filename.read_bytes()
        for value in (False, None):
            with self.subTest(value=value):
                def change(row):
                    if value is None:
                        row.pop('mobileControls')
                    else:
                        row['mobileControls'] = value
                self.mutate_json(filename, change)
                with self.assertRaisesRegex(ValueError, 'mobileControls failed'):
                    pub.check_candidate(self.candidate, EXPECTED)
                filename.write_bytes(original)

    def test_browser_next_room_transition_must_be_verified(self):
        filename = self.candidate / 'evidence/browser-report-51.json'
        original = filename.read_bytes()
        for value in (False, None):
            with self.subTest(value=value):
                def change(row):
                    if value is None:
                        row.pop('nextRoomPassed')
                    else:
                        row['nextRoomPassed'] = value
                self.mutate_json(filename, change)
                with self.assertRaisesRegex(ValueError, 'nextRoomPassed failed'):
                    pub.check_candidate(self.candidate, EXPECTED)
                filename.write_bytes(original)

    def test_source_publisher_run_review_and_phase_bind_the_manifest(self):
        manifest = self.assemble()
        for attribute, value in [('source', 'c' * 40), ('publisher', 'c' * 40), ('run', str(RUN + 1)),
                                  ('review_run', str(REVIEW['runId'] + 1)), ('review_attempt', '3'),
                                  ('phase', 'preflight')]:
            with self.subTest(attribute=attribute):
                args = self.verification_args('http://127.0.0.1')
                setattr(args, attribute, value)
                with self.assertRaises(ValueError):
                    pub.check_manifest(manifest, args, pub.identity(args))

    def test_stale_proof_fails_before_network_and_writes_bound_failure_report(self):
        self.assemble()
        args = self.verification_args('http://127.0.0.1:1')
        args.publisher = 'c' * 40
        with patch.object(pub.urllib.request, 'urlopen') as network, self.assertRaisesRegex(ValueError, 'Stale publication proof'):
            pub.verify(args)
        network.assert_not_called()
        report = pub.read_json(pathlib.Path(args.output))
        self.assertFalse(report['pass'])
        self.assertEqual(report['publisherCommit'], args.publisher)
        self.assertEqual(report['sourceReview'], REVIEW)
        self.assertEqual(report['checked'], 0)

    def test_manifests_reject_inventory_tampering_and_new_files_outside_isolation(self):
        original = self.assemble()
        cases = [lambda row: row['siteFiles'].pop(),
                 lambda row: row['preservedFiles'].append(copy.deepcopy(row['preservedFiles'][0])),
                 lambda row: row['progressionFiles'][0].update(path='outside/file'),
                 lambda row: row['candidateFiles'][0].update(sha256='f' * 64),
                 lambda row: row['preservedFiles'][0].update(bytes=float('nan')),
                 lambda row: row['progressionFiles'][0].update(path='../escape'),
                 lambda row: row.update(preservedBytes=1)]
        args = self.verification_args('http://127.0.0.1')
        for mutate in cases:
            with self.subTest(mutate=mutate):
                manifest = copy.deepcopy(original)
                mutate(manifest)
                with self.assertRaises(ValueError):
                    pub.check_manifest(manifest, args, EXPECTED)

    def test_changed_public_byte_fails_and_writes_failure_report(self):
        self.assemble()
        changed = self.site / 'assets/old.bin'
        changed.write_bytes(b'x' * 256)
        with local_server(self.site) as base, patch.object(pub.time, 'sleep'):
            args = self.verification_args(base)
            with self.assertRaisesRegex(ValueError, 'Public hash changed'):
                pub.verify(args)
        report = pub.read_json(pathlib.Path(args.output))
        self.assertFalse(report['pass'])
        self.assertFalse(report['mainSiteUnchanged'])
        self.assertIn('assets/old.bin', report['error'])

    def test_current_public_metadata_rejects_stale_source_publisher_and_review(self):
        manifest = self.assemble()
        cases = [('build-info.json', lambda row: row.update(commit=SOURCE)),
                 ('puzzle-pilot/build-info.json', lambda row: row.update(commit=SOURCE)),
                 (pub.PREFIX + 'build-info.json', lambda row: row.update(commit='c' * 40)),
                 (pub.PREFIX + 'preview-status.json', lambda row: row.update(publisherCommit='c' * 40)),
                 (pub.PREFIX + 'preview-status.json', lambda row: row['sourceReview'].update(runAttempt=1)),
                 (pub.PREFIX + 'evidence/level-51.json', lambda row: row['sourceReview'].update(runId=1))]
        with local_server(self.site) as base:
            args = self.verification_args(base)
            for name, mutate in cases:
                with self.subTest(name=name):
                    filename = self.site / name
                    original = filename.read_bytes()
                    self.mutate_json(filename, mutate)
                    with self.assertRaises(ValueError):
                        pub.check_public_metadata(args, EXPECTED, manifest)
                    filename.write_bytes(original)

    def test_preserved_progression_metadata_is_separate_from_new_candidate(self):
        manifest = self.assemble()
        cases = [('puzzle-progression/build-info.json', lambda row: row.update(commit=SOURCE)),
                 ('puzzle-progression/preview-status.json', lambda row: row.update(publisherCommit=PUBLISHER)),
                 ('puzzle-progression/preview-status.json', lambda row: row['sourceReview'].update(runAttempt=2)),
                 ('puzzle-progression/preview-status.json', lambda row: row.update(publisherCommit=pub.BASELINE_PUBLISHER)),
                 ('puzzle-progression/preview-status.json', lambda row: row.update(publicationRun=pub.BASELINE_RUN)),
                 ('puzzle-progression-next/build-info.json', lambda row: row.update(commit=SOURCE)),
                 ('puzzle-progression-next/build-info.json', lambda row: row['sourceReview'].update(runAttempt=2)),
                 ('puzzle-progression-next/preview-status.json', lambda row: row.update(publisherCommit=pub.PRIOR_PROGRESSION_PUBLISHER)),
                 ('puzzle-progression-next/preview-status.json', lambda row: row.update(publicationRun=pub.PRIOR_PROGRESSION_PUBLICATION_RUN)),
                 ('puzzle-progression-next/preview-status.json', lambda row: row['sourceReview'].update(runAttempt=2)),
                 ('puzzle-pilot/preview-status.json', lambda row: row.update(publisherCommit=pub.BASELINE_PUBLISHER))]
        with local_server(self.site) as base:
            args = self.verification_args(base)
            for name, mutate in cases:
                filename = self.site / name
                original = filename.read_bytes()
                self.mutate_json(filename, mutate)
                with self.subTest(name=name), self.assertRaises(ValueError):
                    pub.check_public_metadata(args, EXPECTED, manifest)
                filename.write_bytes(original)

    def test_actor_reset_and_unobserved_frames_are_rejected(self):
        filename = self.candidate / 'evidence/browser-report-50.json'
        original = filename.read_bytes()
        mutations = [lambda row: row['modelIdentity'].update(routeResets=1),
                     lambda row: row['modelIdentity'].update(routeRespawns=1),
                     lambda row: row['modelIdentity'].update(observedFrames=71),
                     lambda row: row['modelIdentity']['initialization'].update(resetCargo=2),
                     lambda row: row['route'].update(sameCompanion=False),
                     lambda row: row['route'].update(frames=0)]
        for mutate in mutations:
            filename.write_bytes(original)
            self.mutate_json(filename, mutate)
            self.restamp_candidate_files()
            with self.assertRaises(ValueError):
                pub.check_candidate(self.candidate, EXPECTED)
        filename.write_bytes(original)

    def test_native_touch_needs_observed_input_motion_and_jump(self):
        filename = self.candidate / 'evidence/browser-report-50.json'
        original = filename.read_bytes()
        mutations = [lambda row: row.update(previousProgressionUnchanged=False),
                     lambda row: row.update(previousPilotProgressUnchanged=False),
                     lambda row: row.pop('previousPilotProgressUnchanged'),
                     lambda row: row.update(previousProgressionNextUnchanged=False),
                     lambda row: row.pop('previousProgressionNextUnchanged'),
                     lambda row: row.update(mobileTouchInput={'pass': True}),
                     lambda row: row['mobileTouchInput']['movement'].update(input=[0, 0]),
                     lambda row: row['mobileTouchInput']['movement'].update(distance=0),
                     lambda row: row['mobileTouchInput']['movement'].update(after=[0, 3, 0]),
                     lambda row: row['mobileTouchInput']['movement'].update(after=[0, 3.4, 0], distance=.4, horizontalDistance=0),
                     lambda row: row['mobileTouchInput']['movement'].update(horizontalDistance=.5),
                     lambda row: row['mobileTouchInput']['movement'].pop('horizontalDistance'),
                     lambda row: row['mobileTouchInput'].update(jumpPeak=3.1),
                     lambda row: row['mobileTouchInput'].update(sprintToggle=False),
                     lambda row: row['mobileTouchInput'].update(stickReleased=False)]
        for mutate in mutations:
            filename.write_bytes(original)
            self.mutate_json(filename, mutate)
            self.restamp_candidate_files()
            with self.assertRaises(ValueError):
                pub.check_candidate(self.candidate, EXPECTED)
        filename.write_bytes(original)

    def test_playable_and_freshly_reviewed_scopes_cannot_be_conflated(self):
        for key, value in [('reviewedLevels', pub.PLAYABLE_LEVELS), ('playableLevels', pub.LEVELS),
                           ('revision', 'puzzle-progression-next-v1'),
                           ('query', '?edition=foundation&level=47&pilot=progression'),
                           ('storagePrefix', 'brainrot-puzzle-progression-next-v1:')]:
            with self.subTest(key=key):
                altered = copy.deepcopy(self.metadata)
                altered['features']['puzzleProgression'][key] = value
                self.write_candidate_json('build-info.json', altered)
                with self.assertRaises(ValueError):
                    pub.check_candidate(self.candidate, EXPECTED)

    def test_invalid_json_duplicate_keys_and_nonfinite_numbers_are_rejected(self):
        filename = self.root / 'bad.json'
        for value in ('{"sourceCommit":"a","sourceCommit":"b"}', '{"n":NaN}', '{"n":Infinity}'):
            filename.write_text(value)
            with self.assertRaises(ValueError):
                pub.read_json(filename)

    def test_review_identity_requires_numeric_safe_integers(self):
        for field, value in [('runId', '37770000001'), ('runId', True), ('runAttempt', 0),
                             ('runId', 2 ** 53), ('runAttempt', float('nan'))]:
            review = {**REVIEW, field: value}
            with self.subTest(field=field, value=value), self.assertRaises(ValueError):
                pub.check_review(review, REVIEW, 'fixture')


class ZipFixtures(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = pathlib.Path(self.temp.name)
        self.filename = self.root / 'accepted.zip'
        self.output = self.root / 'prepared'
        self.args = argparse.Namespace(zip=str(self.filename), output=str(self.output))

    def make_zip(self, entries):
        with warnings.catch_warnings():
            warnings.simplefilter('ignore', UserWarning)
            with zipfile.ZipFile(self.filename, 'w') as archive:
                for name, data, mode in entries:
                    entry = zipfile.ZipInfo(name)
                    entry.create_system = 3
                    entry.external_attr = mode << 16
                    archive.writestr(entry, data)

    @contextlib.contextmanager
    def fixture_pins(self):
        with patch.object(pub, 'BASELINE_ZIP_BYTES', self.filename.stat().st_size), \
             patch.object(pub, 'BASELINE_ZIP_SHA256', pub.sha256_file(self.filename)):
            yield

    def test_exact_accepted_zip_is_prepared_without_rewriting_tar(self):
        data = tar_bytes([('index.html', b'accepted', tarfile.REGTYPE)])
        self.make_zip([('artifact.tar', data, stat.S_IFREG | 0o644)])
        with self.fixture_pins(), contextlib.redirect_stdout(io.StringIO()):
            pub.prepare_baseline(self.args)
        self.assertEqual((self.output / 'artifact.tar').read_bytes(), data)

    def test_original_zip_digest_and_size_are_pinned(self):
        self.make_zip([('artifact.tar', b'tar', stat.S_IFREG | 0o644)])
        with self.fixture_pins():
            with patch.object(pub, 'BASELINE_ZIP_BYTES', self.filename.stat().st_size + 1), self.assertRaisesRegex(ValueError, 'size'):
                pub.prepare_baseline(self.args)
            with patch.object(pub, 'BASELINE_ZIP_SHA256', '0' * 64), self.assertRaisesRegex(ValueError, 'hash'):
                pub.prepare_baseline(self.args)
        self.assertFalse(self.output.exists())

    def test_zip_traversal_duplicates_links_and_collisions_are_rejected(self):
        regular, directory = stat.S_IFREG | 0o644, stat.S_IFDIR | 0o755
        cases = [
            [('../artifact.tar', b'tar', regular)],
            [('/artifact.tar', b'tar', regular)],
            [('a\\artifact.tar', b'tar', regular)],
            [('artifact.tar', b'a', regular), ('./artifact.tar', b'b', regular)],
            [('link.tar', b'../outside', stat.S_IFLNK | 0o777)],
            [('fifo.tar', b'', stat.S_IFIFO | 0o644)],
            [('a', b'file', regular), ('a/artifact.tar', b'tar', regular)],
            [('a/', b'', directory), ('a', b'file', regular)],
            [('one.tar', b'a', regular), ('two.tar', b'b', regular)],
            [('not-a-tar.txt', b'a', regular)],
        ]
        for index, entries in enumerate(cases):
            with self.subTest(index=index):
                self.make_zip(entries)
                with self.fixture_pins(), self.assertRaises(ValueError):
                    pub.prepare_baseline(self.args)
                self.assertFalse(self.output.exists())

    def test_existing_baseline_destination_is_not_overwritten(self):
        self.make_zip([('artifact.tar', b'tar', stat.S_IFREG | 0o644)])
        self.output.mkdir()
        (self.output / 'keep').write_bytes(b'keep')
        with self.fixture_pins(), self.assertRaises(ValueError):
            pub.prepare_baseline(self.args)
        self.assertEqual((self.output / 'keep').read_bytes(), b'keep')

    def test_candidate_artifact_digest_and_every_package_byte_are_preserved(self):
        self.make_zip([('build-info.json', b'{"commit":"candidate"}', stat.S_IFREG | 0o644),
                       ('assets/game.js', b'game bytes', stat.S_IFREG | 0o644)])
        args = argparse.Namespace(zip=str(self.filename), output=str(self.output),
                                  digest='sha256:' + pub.sha256_file(self.filename),
                                  bytes=str(self.filename.stat().st_size))
        with contextlib.redirect_stdout(io.StringIO()):
            pub.prepare_package(args)
        self.assertEqual((self.output / 'assets/game.js').read_bytes(), b'game bytes')
        self.assertEqual((self.output / 'build-info.json').read_bytes(), b'{"commit":"candidate"}')

    def test_candidate_artifact_hash_size_and_unsafe_namespace_are_rejected(self):
        regular = stat.S_IFREG | 0o644
        self.make_zip([('build-info.json', b'{}', regular)])
        args = argparse.Namespace(zip=str(self.filename), output=str(self.output),
                                  digest='sha256:' + pub.sha256_file(self.filename), bytes=None)
        with patch.object(args, 'digest', 'sha256:' + '0' * 64), self.assertRaisesRegex(ValueError, 'hash'):
            pub.prepare_package(args)
        with patch.object(args, 'bytes', str(self.filename.stat().st_size + 1)), self.assertRaisesRegex(ValueError, 'size'):
            pub.prepare_package(args)
        for entries in [[('../escape', b'exploit', regular)],
                        [('link', b'../escape', stat.S_IFLNK | 0o777)],
                        [('dup', b'one', regular), ('./dup', b'two', regular)],
                        [('a', b'file', regular), ('a/b', b'child', regular)]]:
            with self.subTest(entries=entries):
                self.make_zip(entries)
                args.digest = 'sha256:' + pub.sha256_file(self.filename)
                with self.assertRaises(ValueError):
                    pub.prepare_package(args)
                self.assertFalse(self.output.exists())

    def test_retained_baseline_can_raise_package_byte_limit_with_absolute_bound(self):
        self.make_zip([('accepted-pages.zip', b'large retained ZIP fixture' * 4, stat.S_IFREG | 0o644)])
        args = argparse.Namespace(zip=str(self.filename), output=str(self.output),
                                  digest='sha256:' + pub.sha256_file(self.filename), bytes=None,
                                  max_uncompressed_bytes=None)
        with patch.object(pub, 'MAX_CANDIDATE_BYTES', 50), self.assertRaisesRegex(ValueError, 'Oversized'):
            pub.prepare_package(args)
        args.max_uncompressed_bytes = str(pub.MAX_BASELINE_BYTES + 1)
        with self.assertRaisesRegex(ValueError, 'absolute'):
            pub.prepare_package(args)
        args.max_uncompressed_bytes = '600000000'
        with patch.object(pub, 'MAX_CANDIDATE_BYTES', 50), contextlib.redirect_stdout(io.StringIO()):
            pub.prepare_package(args)
        self.assertEqual((self.output / 'accepted-pages.zip').read_bytes(), b'large retained ZIP fixture' * 4)


if __name__ == '__main__':
    unittest.main()
