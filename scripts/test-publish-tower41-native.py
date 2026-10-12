"""Security and preservation checks for the append-only tower preview publisher."""
import argparse
import copy
import hashlib
import importlib.util
import io
import json
import pathlib
import stat
import tarfile
import tempfile
import unittest
from unittest import mock
import zipfile


SPEC = importlib.util.spec_from_file_location('publisher', pathlib.Path(__file__).with_name('publish-tower41-native.py'))
P = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(P)


def row(name, value):
    return {'path': name, 'bytes': len(value), 'sha256': hashlib.sha256(value).hexdigest()}


def save_isolation():
    prefixes = ['brainrot-foundation-v1:', 'brainrot-puzzle-pilot43-v1:', 'brainrot-puzzle-progression-v1:',
                'brainrot-puzzle-progression-next-v1:', 'brainrot-puzzle-progression-finale-v1:',
                'brainrot-tower41-ratchet-qualification-v1:', 'brainrot-tower41-native-v1:']
    key = 'brainrot-portal.preferences.v24'
    snapshot = {prefix + key: '{"completed":[0,42],"value":"старые байты"}' for prefix in prefixes}
    snapshot_hash = hashlib.sha256(json.dumps(snapshot, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
    names = ['after-load', 'after-settings', 'after-play', 'after-pause', 'after-resume', 'after-win', 'after-replay', 'after-reload']
    states = ['ready', 'ready', 'playing', 'paused', 'playing', 'won', 'playing', 'ready']
    phases = [{'phase': name, 'state': states[i], 'level': 41, 'preview': True, 'ratchetCell': False,
               'startChoices': [40], 'settingsChoices': [40], 'oldBytesUnchanged': True,
               'editionNavigationPresent': False, 'editionNavigationAnchors': [],
               'legacySnapshotSha256': snapshot_hash, 'namespaceUsed': True, 'ownPreferencesSha256': 'c' * 64,
               'ownResumeLevel': 40, 'ownCompleted': [] if i < 5 else [40], 'ownQuality': 'low'}
              for i, name in enumerate(names)]
    base = 'http://127.0.0.1:4173/brainrot-portal/tower41-native-v2/'
    bare = {'applicable': True, 'pass': True, 'url': base, 'pathname': '/brainrot-portal/tower41-native-v2/', 'search': '',
            'state': 'ready', 'level': 41, 'preview': True, 'edition': 'foundation', 'startChoices': [40], 'settingsChoices': [40],
            'editionNavigationPresent': False, 'editionNavigationAnchors': [], 'debugGameHook': 'undefined',
            'debugPreferencesHook': 'undefined', 'ratchetHook': 'undefined', 'oldBytesUnchanged': True,
            'legacySnapshotSha256': snapshot_hash, 'ownKey': P.STORAGE_PREFIX + key, 'ownPreferencesSha256': 'c' * 64,
            'settings': {'control': 'native-menu-quality-select', 'changedTo': 'balanced', 'restoredTo': 'low',
                         'ownQualityChanged': 'balanced', 'ownQualityRestored': 'low',
                         'beforeSha256': 'c' * 64, 'changedSha256': 'd' * 64, 'restoredSha256': 'c' * 64}}
    return {'pass': True, 'namespace': P.STORAGE_PREFIX, 'ownKey': P.STORAGE_PREFIX + key,
            'playerURL': base + P.QUERY, 'reviewURL': base + P.QUERY + '&debug=1', 'bareEntry': bare,
            'legacyPrefixes': prefixes, 'legacySnapshot': snapshot, 'phases': phases,
            'controls': {'settings': {'control': 'native-menu-quality-select', 'changedTo': 'high', 'restoredTo': 'low'},
                         'pauseResume': {'pass': True, 'pauseControl': 'native-escape-or-hud', 'resumeControl': 'focused-native-enter',
                                         'pointerLockExitFallback': False, 'pausedState': 'paused', 'resumedState': 'playing'},
                         'replay': {'pass': True, 'button': '#play-again-button', 'label': 'Пройти ещё раз', 'level': 41,
                                    'state': 'playing', 'solved': [], 'atSpawn': True},
                         'reload': {'pass': True, 'state': 'ready', 'level': 41, 'completed': [40], 'resumeLevel': 40}}}


def pendulum_proof():
    # Structural validator fixture only. It is never labelled browser or physics acceptance.
    original = 7
    bridge = {'id': 10, 'type': 1, 'mass': 15, 'position': [0, 0, 0], 'quaternion': [0, 0, 0, 1],
              'velocity': [0, 0, 0], 'angularVelocity': [0, 0, 0], 'inertia': [1, 2, 3], 'COMOffset': [1, 0, 0]}
    pawl = {**copy.deepcopy(bridge), 'id': 11, 'mass': 2}
    load = {'originalCargoBodyId': original, 'originalCargoShapeId': 70, 'cupBodyId': 10, 'cupShapeId': 102,
            'normalForce': 2, 'bridgeAngle': -.2, 'freeOriginal': True}
    cell = {**{flag: True for flag in ('ready', 'latched', 'catchArmed', 'bodiesPresent', 'constraintsPresent',
                                      'originalCargoPresent', 'originalCargoIdentityValid', 'originalCargoFree',
                                      'currentCollisionValid', 'unloadedRetained', 'readyForCrossing')},
            'disposed': False, 'loadContact': False, 'loadNormalForce': 0, 'loadContactCount': 0,
            'originalCargoRawContact': False, 'originalCargoRawContactCount': 0, 'originalCargoClearedCup': True,
            'worldStep': 100, 'contactStep': 100, 'loadedStep': 20, 'loadedTicks': 10, 'loadedNormalImpulse': .3,
            'lastLoadedNormalForce': 2, 'retainedStartStep': 30, 'retainedTicks': 71,
            'pawlContactCount': 1, 'pawlNormalForce': 3, 'seatContactCount': 1, 'seatNormalForce': 4,
            'angle': 0, 'pawlAngle': 0, 'bodyIds': [10, 11, 12, 13], 'constraintIds': [201, 202],
            'constraintEquationCounts': [5, 5], 'constraintMotorEnabled': [False, False],
            'constraintMotorEquationPresent': [False, False], 'originalCargoBodyId': original,
            'originalCargoShapeId': 70, 'cupShapeId': 102, 'deckShapeId': 101, 'pawlShapeId': 103,
            'pawlHeelShapeId': 104, 'seatBodyId': 12, 'seatShapeId': 105, 'bridge': bridge, 'pawl': pawl,
            'loadedWitness': {'first': {**load, 'worldStep': 10}, 'last': {**load, 'worldStep': 20}},
            'handCount': 1, 'handAngularImpulse': 1.2,
            'catchWitness': {**load, 'worldStep': 15, 'handCount': 1, 'angularImpulse': -1.2,
                             'action': 'close', 'qualifiedLoad': True, 'loadContact': True, 'loadedAtStep': 15,
                             'loadedStep': 15, 'loadNormalForce': 2, 'pawlBodyId': 11,
                             'angularMomentumBefore': 0, 'angularMomentumAfter': -1.2}}
    support = {'grounded': True, 'live': True, 'footprintInside': True, 'foot': [0, 0, 0], 'velocity': [0, 0, 0],
               'supportNormal': [0, 1, 0], 'supportHeight': 0, 'supportGap': 0, 'bodyId': 99, 'shapeId': 999,
               'shapeIndex': 0, 'colliderId': 'founded-test-floor', 'bodyPosition': [0, -.2, 0],
               'bounds': [[-6, -.4, -2], [6, 0, 2]],
               'bodyQuaternion': [0, 0, 0, 1], 'shapeHalf': [6, .2, 2]}
    checkpoints = []
    for name, x, step in [('near', -4, 61), ('mid', 0, 70), ('far', 4, 80)]:
        checkpoints.append({**copy.deepcopy(support), 'name': name, 'worldStep': step, 'kind': 'owned-oriented-deck',
                            'capsuleGrounded': True, 'originalCargoBodyId': original, 'bodyId': 10, 'shapeId': 101,
                            'localFoot': [x, .2, 0], 'shapeOffset': [0, 0, 0], 'foot': [x, .2, 0], 'supportHeight': .2, 'bodyPosition': [0, 0, 0],
                            'pose': {'center': [0, 0, 0], 'quaternion': [0, 0, 0, 1], 'step': step,
                                     'bounds': [[-6, -.2, -2], [6, .2, 2]]}})
    checkpoints.append({**copy.deepcopy(support), 'name': 'island', 'worldStep': 90, 'kind': 'founded-floor',
                        'bounds': [[-6, -.4, -2], [6, 0, 2]]})
    crossing = {'complete': True, 'supportedDeckSteps': 29, 'deckBodyId': 10, 'deckShapeIndex': 0,
                'originalCargoBodyId': original, 'nearLandingStep': 60, 'firstStep': 61, 'midStep': 70,
                'farStep': 80, 'islandStep': 90, 'nearLanding': {**copy.deepcopy(support), 'worldStep': 60, 'kind': 'founded-floor'},
                'checkpoints': checkpoints}
    return {'physicalLowerCatch': True, 'upperCatchKinematic': True, 'originalCargo': True,
            'lowerAngle': 0, 'upperHeight': 6, 'lowerPhysicalCell': cell, 'lowerCrossing': crossing}


class TemporaryTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.temporary.name)
        self.addCleanup(self.temporary.cleanup)

    def write(self, path, value):
        filename = self.root / path
        filename.parent.mkdir(parents=True, exist_ok=True)
        filename.write_bytes(value)
        return filename

    def zip(self, members, name='artifact.zip'):
        filename = self.root / name
        with zipfile.ZipFile(filename, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
            for entry, value in members:
                archive.writestr(entry, value)
        return filename

    def extract(self, filename, maximum=P.MAX_BYTES, output='out'):
        return P.extract_zip(filename, self.root / output, P.sha256_file(filename), filename.stat().st_size, maximum)


class PrimitiveTests(TemporaryTest):
    def test_identity_rejects_booleans_and_inexact_ids(self):
        for value in (True, False, 1.0, -1, 2 ** 53):
            with self.subTest(value=value), self.assertRaises(ValueError):
                P.integer(value, 'ID', 1)
        for value in ('0', '+1', '01', '1.0', 'NaN'):
            with self.subTest(value=value), self.assertRaises(ValueError):
                P.argument_integer(value, 'ID')

    def test_unsafe_paths(self):
        for name in ('../escape', '/absolute', 'a/../b', 'a//b', 'a/./b', 'C:drive', 'a\\b', 'a\x00b', 'a\nb', 'a\x7fb'):
            with self.subTest(name=name), self.assertRaises(ValueError):
                P.safe_name(name)

    def test_json_rejects_duplicate_nonfinite_and_overflow_numbers(self):
        for content in (b'{"a":1,"a":2}', b'{"nested":{"a":0,"a":1}}', b'{"a":NaN}', b'{"a":Infinity}', b'{"a":1e999}'):
            with self.subTest(content=content):
                filename = self.write('invalid.json', content)
                with self.assertRaises(ValueError):
                    P.read_json(filename)

    def test_inventory_rejects_symlink_and_parent_symlink(self):
        directory = self.root / 'data'
        directory.mkdir()
        self.write('data/file', b'original')
        (directory / 'link').symlink_to(directory / 'file')
        with self.assertRaisesRegex(ValueError, 'Non-regular'):
            P.inventory(directory)
        (self.root / 'parent-link').symlink_to(directory, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, 'symlink'):
            P.sha256_file(self.root / 'parent-link/file')

    def test_rows_reject_unsorted_duplicates_collisions_and_bool_sizes(self):
        valid = row('a', b'a')
        examples = [[row('b', b''), valid], [valid, valid], [valid, row('a/b', b'b')], [{**valid, 'bytes': True}]]
        for rows in examples:
            with self.subTest(rows=rows), self.assertRaises(ValueError):
                P.checked_rows(rows, 'test')

    def test_disjoint_roots_reject_nested_inputs_and_outputs(self):
        with self.assertRaisesRegex(ValueError, 'disjoint'):
            P.disjoint_roots(self.root / 'site', self.root / 'site/prefix')

    def test_generated_json_refuses_overwrite(self):
        filename = self.write('existing.json', b'old bytes')
        with self.assertRaisesRegex(ValueError, 'overwrite'):
            P.write_new_json(filename, {'new': True})
        self.assertEqual(filename.read_bytes(), b'old bytes')


class BareEntryTests(unittest.TestCase):
    def test_all_six_literal_native_paths_require_and_accept_actual_bare_evidence(self):
        for pathname in sorted(P.NATIVE_ENTRY_PATHS):
            isolated = save_isolation()
            base = 'https://example.test' + pathname
            isolated['playerURL'] = base + P.QUERY
            isolated['reviewURL'] = base + P.QUERY + '&debug=1'
            isolated['bareEntry']['url'] = base
            isolated['bareEntry']['pathname'] = pathname
            with self.subTest(pathname=pathname):
                self.assertIs(P.assert_preview_save_isolation(isolated), isolated)
                rejected = copy.deepcopy(isolated)
                rejected['bareEntry'] = copy.deepcopy(P.BARE_ENTRY_NOT_APPLICABLE)
                with self.assertRaisesRegex(ValueError, 'actual successful'):
                    P.assert_preview_save_isolation(rejected)

    def test_exact_explicit_local_root_nonapplicable_object_is_only_allowed_outside_native_paths(self):
        for pathname in ('/', '/local-review/', '/tower41-native-v2/nested/', '/other/tower41-native-v2/'):
            isolated = save_isolation()
            base = 'http://127.0.0.1:4173' + pathname
            isolated['playerURL'] = base + P.QUERY
            isolated['reviewURL'] = base + P.QUERY + '&debug=1'
            isolated['bareEntry'] = copy.deepcopy(P.BARE_ENTRY_NOT_APPLICABLE)
            with self.subTest(pathname=pathname):
                self.assertIs(P.assert_preview_save_isolation(isolated), isolated)
                for bare in (None, {'applicable': False}, {'applicable': False, 'reason': 'invented reason'},
                             {**P.BARE_ENTRY_NOT_APPLICABLE, 'pass': True}, {'applicable': True, 'pass': True}):
                    rejected = copy.deepcopy(isolated)
                    rejected['bareEntry'] = bare
                    with self.assertRaises(ValueError):
                        P.assert_preview_save_isolation(rejected)

    def test_default_http_port_origin_comparison_matches_browser_urls(self):
        isolated = save_isolation()
        pathname = '/tower41-native-v2/'
        isolated['playerURL'] = 'http://example.test:80' + pathname + P.QUERY
        isolated['reviewURL'] = 'http://example.test' + pathname + P.QUERY + '&debug=1'
        isolated['bareEntry']['url'] = 'http://example.test' + pathname
        isolated['bareEntry']['pathname'] = pathname
        self.assertIs(P.assert_preview_save_isolation(isolated), isolated)

    def test_missing_navigation_anchors_wrong_levels_missing_bare_and_private_hash_failures_are_rejected(self):
        cases = ('missing-phase-navigation', 'phase-navigation-present', 'phase-anchor', 'wrong-player-level', 'wrong-review-level',
                 'missing-player-url', 'review-origin', 'review-path', 'player-debug', 'player-smoke', 'player-ratchet', 'player-pilot',
                 'missing-review-debug', 'missing-bare', 'bare-na-on-namespace', 'bare-no-pass', 'bare-query', 'bare-fragment',
                 'bare-wrong-level', 'bare-wrong-edition', 'bare-old-navigation', 'bare-anchor', 'bare-debug-hook',
                 'bare-old-bytes-changed', 'bare-snapshot-hash', 'private-key', 'private-hash-invalid',
                 'private-hash-unchanged', 'private-restored-hash-wrong', 'private-quality-not-observed')
        for case in cases:
            isolated = save_isolation()
            bare = isolated['bareEntry']
            if case == 'missing-phase-navigation':
                isolated['phases'][3].pop('editionNavigationPresent')
            elif case == 'phase-navigation-present':
                isolated['phases'][3]['editionNavigationPresent'] = True
            elif case == 'phase-anchor':
                isolated['phases'][3]['editionNavigationAnchors'] = ['/?edition=foundation']
            elif case == 'wrong-player-level':
                isolated['playerURL'] = isolated['playerURL'].replace('level=41', 'level=42')
            elif case == 'wrong-review-level':
                isolated['reviewURL'] = isolated['reviewURL'].replace('level=41', 'level=42')
            elif case == 'missing-player-url':
                isolated.pop('playerURL')
            elif case == 'review-origin':
                isolated['reviewURL'] = isolated['reviewURL'].replace('127.0.0.1', 'example.test')
            elif case == 'review-path':
                isolated['reviewURL'] = isolated['reviewURL'].replace('/tower41-native-v2/', '/other/')
            elif case.startswith('player-'):
                name = {'player-debug': 'debug', 'player-smoke': 'smoke', 'player-ratchet': 'tower41ratchet', 'player-pilot': 'pilot'}[case]
                isolated['playerURL'] += '&' + name + '=1'
            elif case == 'missing-review-debug':
                isolated['reviewURL'] = isolated['reviewURL'].replace('&debug=1', '')
            elif case == 'missing-bare':
                isolated.pop('bareEntry')
            elif case == 'bare-na-on-namespace':
                isolated['bareEntry'] = copy.deepcopy(P.BARE_ENTRY_NOT_APPLICABLE)
            elif case == 'bare-no-pass':
                bare['pass'] = False
            elif case == 'bare-query':
                bare['url'] += '?level=41'
            elif case == 'bare-fragment':
                bare['url'] += '#invented'
            elif case == 'bare-wrong-level':
                bare['level'] = 42
            elif case == 'bare-wrong-edition':
                bare['edition'] = 'classic'
            elif case == 'bare-old-navigation':
                bare['editionNavigationPresent'] = True
            elif case == 'bare-anchor':
                bare['editionNavigationAnchors'] = ['../']
            elif case == 'bare-debug-hook':
                bare['debugGameHook'] = 'object'
            elif case == 'bare-old-bytes-changed':
                bare['oldBytesUnchanged'] = False
            elif case == 'bare-snapshot-hash':
                bare['legacySnapshotSha256'] = '0' * 64
            elif case == 'private-key':
                bare['ownKey'] = 'brainrot-foundation-v1:brainrot-portal.preferences.v24'
            elif case == 'private-hash-invalid':
                bare['ownPreferencesSha256'] = False
            elif case == 'private-hash-unchanged':
                bare['settings']['changedSha256'] = bare['settings']['beforeSha256']
            elif case == 'private-restored-hash-wrong':
                bare['settings']['restoredSha256'] = 'e' * 64
            else:
                bare['settings']['ownQualityChanged'] = bare['settings']['restoredTo']
            with self.subTest(case=case), self.assertRaises(ValueError):
                P.assert_preview_save_isolation(isolated)


class ZipTests(TemporaryTest):
    def test_exact_archive_extraction(self):
        filename = self.zip([('nested/', b''), ('nested/file', b'\x00\xffbinary')])
        rows = self.extract(filename)
        self.assertEqual(rows, [row('nested/file', b'\x00\xffbinary')])
        self.assertEqual((self.root / 'out/nested/file').read_bytes(), b'\x00\xffbinary')

    def test_wrong_digest_and_size_do_not_create_output(self):
        filename = self.zip([('file', b'safe')])
        for checksum, size in [('0' * 64, filename.stat().st_size), (P.sha256_file(filename), filename.stat().st_size + 1)]:
            with self.assertRaises(ValueError):
                P.extract_zip(filename, self.root / 'out', checksum, size, P.MAX_BYTES)
            self.assertFalse((self.root / 'out').exists())

    def test_traversal_duplicate_and_directory_collisions_validate_before_extract(self):
        examples = [[('../escape', b'x')], [('file', b'x'), ('file', b'y')],
                    [('a', b'x'), ('a/b', b'y')], [('a/', b''), ('a', b'x')], [('./file', b'x')], [('a/', b'data')]]
        for i, members in enumerate(examples):
            with self.subTest(members=members):
                filename = self.zip(members, 'bad' + str(i) + '.zip')
                with self.assertRaises(ValueError):
                    self.extract(filename, output='out' + str(i))
                self.assertFalse((self.root / ('out' + str(i))).exists())
        self.assertFalse((self.root / 'escape').exists())

    def test_zip_symlink_rejected_before_extract(self):
        entry = zipfile.ZipInfo('link')
        entry.create_system = 3
        entry.external_attr = (stat.S_IFLNK | 0o777) << 16
        filename = self.zip([(entry, '../other')])
        with self.assertRaisesRegex(ValueError, 'Non-regular'):
            self.extract(filename)
        self.assertFalse((self.root / 'out').exists())

    def test_zip_encryption_flag_rejected(self):
        filename = self.zip([('file', b'safe')])
        with zipfile.ZipFile(filename) as archive:
            entry = archive.infolist()[0]
            entry.flag_bits |= 1
            with self.assertRaisesRegex(ValueError, 'Encrypted'):
                P.zip_entries(mock.Mock(infolist=lambda: [entry]), P.MAX_BYTES)

    def test_zip_cap_includes_all_files_and_does_not_extract(self):
        filename = self.zip([('one', b'1234'), ('two', b'5678')])
        with self.assertRaisesRegex(ValueError, 'byte limit'):
            self.extract(filename, maximum=7)
        self.assertFalse((self.root / 'out').exists())

    def test_corrupt_crc_cleans_staging_and_preserves_destination_absence(self):
        filename = self.root / 'crc.zip'
        with zipfile.ZipFile(filename, 'w', compression=zipfile.ZIP_STORED) as archive:
            archive.writestr('file', b'UNIQUE_PAYLOAD')
        binary = filename.read_bytes().replace(b'UNIQUE_PAYLOAD', b'CORRUPT_BYTES!')
        filename.write_bytes(binary)
        with self.assertRaises(zipfile.BadZipFile):
            self.extract(filename)
        self.assertFalse((self.root / 'out').exists())
        self.assertEqual(list(self.root.glob('.out-staging-*')), [])

    def test_refuses_existing_output(self):
        filename = self.zip([('file', b'new')])
        self.write('out/untouched', b'old')
        with self.assertRaisesRegex(ValueError, 'overwrite'):
            self.extract(filename)
        self.assertEqual((self.root / 'out/untouched').read_bytes(), b'old')


class TarTests(TemporaryTest):
    def tar(self, members):
        filename = self.root / 'archive.tar'
        with tarfile.open(filename, 'w') as archive:
            for name, kind, data in members:
                entry = tarfile.TarInfo(name)
                entry.type = kind
                entry.size = len(data)
                if kind in (tarfile.SYMTYPE, tarfile.LNKTYPE):
                    entry.linkname = '../outside'
                archive.addfile(entry, io.BytesIO(data) if data else None)
        return filename

    def test_tar_regular_root_directory_and_file(self):
        filename = self.tar([('./', tarfile.DIRTYPE, b''), ('./nested', tarfile.DIRTYPE, b''), ('./nested/file', tarfile.REGTYPE, b'bytes')])
        with tarfile.open(filename, 'r:') as archive:
            self.assertEqual([name for _, name, _ in P.tar_entries(archive)], ['nested', 'nested/file'])

    def test_tar_unsafe_types_paths_duplicates_and_prefix_presence(self):
        examples = [[('../escape', tarfile.REGTYPE, b'x')], [('link', tarfile.SYMTYPE, b'')],
                    [('hard', tarfile.LNKTYPE, b'')], [('fifo', tarfile.FIFOTYPE, b'')],
                    [('a', tarfile.REGTYPE, b'x'), ('a/b', tarfile.REGTYPE, b'y')],
                    [('a', tarfile.REGTYPE, b'x'), ('./a', tarfile.REGTYPE, b'y')],
                    [('tower41-native-v2', tarfile.DIRTYPE, b'')], [('./', tarfile.DIRTYPE, b''), ('.', tarfile.DIRTYPE, b'')]]
        for members in examples:
            with self.subTest(members=members):
                filename = self.tar(members)
                with tarfile.open(filename, 'r:') as archive, self.assertRaises(ValueError):
                    P.tar_entries(archive)


class PipelineFixture(TemporaryTest):
    def setUp(self):
        super().setUp()
        self.args = argparse.Namespace(source='a' * 40, publisher='b' * 40, run='99', review_run='77', review_attempt='2',
                                       baseline=str(self.root / 'baseline'), candidate=str(self.root / 'candidate'),
                                       site=str(self.root / 'site'), proof=str(self.root / 'proof'), binding=str(self.root / 'proof/package-binding.json'))
        self.expected = P.identity(self.args)
        self.source_identity = {key: self.expected[key] for key in ('sourceCommit', 'sourceReview')}
        for name, content in [('index.html', b'OLD MAIN'), ('history/retained.bin', b'\x00\xffOLD HISTORY'),
                              ('puzzle-progression-finale/build-info.json', b'OLD FINALE BUILD'),
                              ('puzzle-progression-finale/preview-status.json', b'OLD FINALE STATUS'), ('build-info.json', b'OLD BUILD'),
                              ('tower41-native/index.html', b'OLD V1 PREVIEW'),
                              ('tower41-native/evidence/tower41-native.mp4', b'OLD V1 MOVIE'),
                              ('tower41-native/build-info.json', b'OLD V1 BUILD')]:
            self.write('baseline/' + name, content)
        self.before = P.inventory(self.root / 'baseline')
        for key, value in [('BASELINE_COUNT', len(self.before)), ('BASELINE_BYTES', sum(row['bytes'] for row in self.before)),
                           ('BASELINE_INVENTORY_SHA256', P.inventory_sha256(self.before))]:
            patcher = mock.patch.object(P, key, value)
            patcher.start()
            self.addCleanup(patcher.stop)
        self.isolation = save_isolation()
        info = {'commit': self.expected['sourceCommit'], 'gameCommit': self.expected['sourceCommit'],
                'interfaceCommit': self.expected['sourceCommit'], 'publisherCommit': None, 'run': '77',
                'version': 'v54-unified-campaign', 'levels': 51, 'verified': False, 'status': 'technical-candidate',
                'features': {'tower': {'stages': 11, 'checkpoints': False}}}
        self.write('candidate/index.html', b'<script src="./assets/game.js"></script>')
        self.write('candidate/assets/game.js', b'EXACT REVIEWED ORDINARY GAME')
        info_path = self.write('candidate/build-info.json', P.json_bytes(info))
        info_hash = P.sha256_file(info_path)
        # These are structural unit-test bytes, not a codec or native gameplay acceptance fixture.
        self.movie = b'FAKE UNIT-TEST MOVIE BYTES'
        movie_hash = hashlib.sha256(self.movie).hexdigest()
        video = {'filename': 'ordinary-castle.mp4', 'sha256': movie_hash, 'frames': 44, 'fps': 4,
                 'width': 640, 'height': 360, 'durationSeconds': 11, 'simulationSeconds': 11,
                 'first': {'state': 'playing', 'solved': []}, 'last': {'state': 'won'}}
        evidence = {'sourceCommit': self.expected['sourceCommit'], 'previewSaveIsolation': self.isolation, 'video': video,
                    'result': {'pass': True, 'sameCompanion': True, 'resets': 0, 'respawns': 0, 'cargoResets': 0,
                               'metrics': {'won': True, 'completedStages': 11}},
                    'observed': {'seenResets': 0, 'bodyId': 7, 'events': [{'id': 'pendulum', 'proof': pendulum_proof()}]}, 'errors': []}
        evidence_hash = hashlib.sha256(P.json_bytes(evidence)).hexdigest()
        receipts = {'source': {'source.json': self.source_identity, 'package.json': {**self.source_identity, 'pass': True, 'buildInfoSha256': info_hash}},
                    'cpu': {'report.json': {**self.source_identity, 'pass': True}},
                    'nativeContact': {'tower41-next-cell-contact/binding.json': {**self.source_identity, 'pass': True}},
                    'nativeCastle': {'binding.json': {**self.source_identity, 'pass': True, 'mechanisms': 11, 'sameCargo': True, 'resets': 0,
                                                       'buildInfoSha256': info_hash, 'evidenceSha256': evidence_hash,
                                                       'pendulum': P.assert_pendulum_physical_proof(pendulum_proof(), 7),
                                                       'video': {'file': video['filename'], 'bytes': len(self.movie),
                                                                 'sha256': movie_hash, 'fullMP4Decode': True},
                                                       'previewSaveIsolation': {'pass': True, 'namespace': P.STORAGE_PREFIX,
                                                                                'oldBytesUnchanged': True, 'phases': 8, 'replayLevel': 41}},
                                     'evidence.json': evidence, video['filename']: self.movie,
                                     'served-package.json': {**self.source_identity, 'pass': True,
                                                             'files': P.inventory(self.root / 'candidate')}},
                    'summary': {'jobs.json': {**self.source_identity, 'allRequiredJobsPassed': True,
                                             'jobs': {name: 'success' for name in P.JOB_NAMES if name != 'review-summary'}}}}
        artifacts = {}
        for i, (key, suffix) in enumerate(P.ARTIFACT_NAMES.items()):
            if key == 'build':
                rows = P.inventory(self.root / 'candidate')
            else:
                for name, receipt in receipts[key].items():
                    self.write('proof/review-artifacts/' + suffix + '/' + name,
                               receipt if isinstance(receipt, bytes) else P.json_bytes(receipt))
                rows = P.inventory(self.root / 'proof/review-artifacts' / suffix)
            artifacts[key] = {'id': 100 + i, 'name': f'tower41-next-cell-{suffix}-77-2', 'size_in_bytes': 200,
                              'digest': 'sha256:' + str(i) * 64, 'workflow_run': {'id': 77, 'head_sha': self.expected['sourceCommit']}, 'files': rows}
        jobs = []
        for i, name in enumerate(P.JOB_NAMES):
            content = ('provider raw job ' + name).encode()
            relative = f'job-logs/{200 + i}.log'
            self.write('proof/' + relative, content)
            jobs.append({'name': name, 'id': 200 + i, 'conclusion': 'success', 'rawLog': row(relative, content)})
        self.binding = {'schemaVersion': 1, 'kind': 'tower41-native-exact-review', **self.expected,
                        'preview': P.preview_scope(), 'previewSaveIsolation': self.isolation, 'artifacts': artifacts, 'jobs': jobs,
                        'pendulum': P.assert_pendulum_physical_proof(pendulum_proof(), 7)}
        copied_movie = {**self.source_identity, 'sourceArtifact': 'nativeCastle', 'sourcePath': video['filename'],
                        'path': P.SUPPLEMENTAL_VIDEO, 'bytes': len(self.movie), 'sha256': movie_hash}
        copied_report = {**self.source_identity, 'sourceArtifact': 'nativeCastle', 'sourcePath': 'evidence.json',
                         'path': P.SUPPLEMENTAL_REPORT, 'bytes': len(P.json_bytes(evidence)), 'sha256': evidence_hash}
        recording = {**self.source_identity, 'filename': P.SUPPLEMENTAL_VIDEO, 'report': P.SUPPLEMENTAL_REPORT,
                     'bytes': len(self.movie), 'sha256': movie_hash,
                     **{key: video[key] for key in ('frames', 'fps', 'width', 'height', 'durationSeconds', 'simulationSeconds')}}
        self.binding['supplemental'] = {'reviewedFiles': [copied_movie, copied_report], 'recording': recording}
        self.write_binding()

    def write_binding(self):
        self.write('proof/package-binding.json', P.json_bytes(self.binding))

    def assembled(self):
        with mock.patch('builtins.print'):
            P.assemble(self.args)
        return P.read_json(self.root / 'proof/manifest.json')


class PipelineTests(PipelineFixture):
    def test_append_preserves_every_old_file_and_all_exact_candidate_bytes(self):
        manifest = self.assembled()
        site = self.root / 'site'
        for before in self.before:
            self.assertEqual((site / before['path']).read_bytes(), (self.root / 'baseline' / before['path']).read_bytes())
        for candidate in self.binding['artifacts']['build']['files']:
            self.assertEqual((site / P.PREFIX / candidate['path']).read_bytes(), (self.root / 'candidate' / candidate['path']).read_bytes())
        self.assertEqual(P.check_manifest(manifest, 'published', self.expected), P.inventory(site))
        self.assertEqual(len(manifest['supplementalCopiedFiles']), 2)
        self.assertEqual(len(manifest['generatedFiles']), 3)
        self.assertEqual((site / P.PREFIX / P.SUPPLEMENTAL_VIDEO).read_bytes(), self.movie)
        self.assertEqual((site / P.PREFIX / P.SUPPLEMENTAL_REPORT).read_bytes(),
                         (self.root / 'proof/review-artifacts/native-castle/evidence.json').read_bytes())
        preflight = P.read_json(self.root / 'proof/baseline-manifest.json')
        self.assertEqual(P.check_manifest(preflight, 'preflight', self.expected), self.before)
        status = P.read_json(site / P.PREFIX / 'preview-status.json')
        self.assertEqual(status['mechanisms'], 11)
        self.assertTrue(status['technicalAcceptance'])
        for key in ('masterSpecComplete', 'replacement500StageTowerAccepted', 'humanPlaytestAccepted', 'physicalDeviceAccepted', 'fullCameraAccepted'):
            self.assertIs(status[key], False)

    def test_candidate_mutation_stops_before_site_creation(self):
        self.write('candidate/assets/game.js', b'MUTATED AFTER REVIEW')
        with self.assertRaisesRegex(ValueError, 'artifact bytes'):
            P.assemble(self.args)
        self.assertFalse((self.root / 'site').exists())

    def test_supplemental_movie_mutation_is_rejected_before_assembly(self):
        self.write('proof/review-artifacts/native-castle/ordinary-castle.mp4', b'ALTERED MOVIE')
        with self.assertRaisesRegex(ValueError, 'artifact bytes'):
            P.assemble(self.args)
        self.assertFalse((self.root / 'site').exists())

    def test_supplemental_wrong_source_escape_and_relabelled_frames_are_rejected(self):
        for mutation in ('report-source', 'destination-escape', 'source-escape', 'recording-source', 'duration', 'bool-frames', 'wrong-source-artifact'):
            changed = copy.deepcopy(self.binding)
            supplemental = changed['supplemental']
            if mutation == 'report-source':
                supplemental['reviewedFiles'][1]['sourceCommit'] = 'd' * 40
            elif mutation == 'destination-escape':
                supplemental['reviewedFiles'][0]['path'] = '../movie.mp4'
            elif mutation == 'source-escape':
                supplemental['reviewedFiles'][0]['sourcePath'] = '../movie.mp4'
            elif mutation == 'recording-source':
                supplemental['recording']['sourceReview']['runAttempt'] = 1
            elif mutation == 'duration':
                supplemental['recording']['durationSeconds'] = 900
            elif mutation == 'bool-frames':
                supplemental['recording']['frames'] = True
            else:
                supplemental['reviewedFiles'][0]['sourceArtifact'] = 'nativeContact'
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                P.binding_structure(changed, self.expected)

    def test_dist_collisions_with_all_supplemental_files_and_parent_paths_are_rejected(self):
        for path in (*sorted(P.SUPPLEMENTAL_TARGETS), 'evidence', 'walkthroughs.html/extra'):
            changed = copy.deepcopy(self.binding)
            changed['artifacts']['build']['files'].append(row(path, b'COLLISION'))
            changed['artifacts']['build']['files'].sort(key=lambda item: item['path'])
            with self.subTest(path=path), self.assertRaisesRegex(ValueError, 'collides'):
                P.binding_structure(changed, self.expected)

    def test_walkthrough_and_identity_only_claim_the_bounded_current_recording(self):
        content = P.generated_content(self.expected, self.binding)
        page = content['walkthroughs.html'].decode('utf-8')
        identity = json.loads(content[P.SUPPLEMENTAL_IDENTITY])
        self.assertEqual(set(content), {'preview-status.json', 'walkthroughs.html', P.SUPPLEMENTAL_IDENTITY})
        self.assertEqual(page.count('<video '), 1)
        self.assertIn('Текущий замок: 11 механизмов', page)
        self.assertIn('автоматическое прохождение', page)
        self.assertIn('./?edition=foundation&amp;level=41&amp;tower41preview=1', page)
        self.assertNotIn('level=42', page)
        self.assertNotIn('debug=1', page)
        self.assertNotIn('tower41ratchet=1', page)
        self.assertIn('не подтверждает новую башню на 500 этапов', page)
        self.assertEqual(identity['level'], 41)
        self.assertEqual(identity['recording'], self.binding['supplemental']['recording'])
        for key in ('humanPlaytestAccepted', 'physicalDeviceAccepted', 'fullCameraAccepted',
                    'replacement500StageTowerAccepted', 'minimum15MinuteSpeedrunAccepted'):
            self.assertIs(identity[key], False)

    def test_manifest_rejects_relabelled_supplemental_and_extra_generated_page(self):
        manifest = self.assembled()
        for mutation in ('report-hash', 'recording-source', 'extra-generated', 'relabelled-page'):
            changed = copy.deepcopy(manifest)
            if mutation == 'report-hash':
                changed['supplementalCopiedFiles'][0]['sha256'] = '0' * 64
            elif mutation == 'recording-source':
                changed['supplementalRecording']['sourceCommit'] = 'd' * 40
            elif mutation == 'extra-generated':
                changed['generatedFiles'].append(row(P.PREFIX + 'other-walkthrough.html', b'extra'))
            else:
                target = next(row for row in changed['generatedFiles'] if row['path'].endswith('walkthroughs.html'))
                target['sha256'] = hashlib.sha256(b'500-stage tower accepted').hexdigest()
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                P.check_manifest(changed, 'published', self.expected)

    def test_existing_native_namespace_rejected_even_when_empty(self):
        (self.root / 'baseline/tower41-native-v2').mkdir()
        with self.assertRaisesRegex(ValueError, 'already exists'):
            P.assemble(self.args)
        self.assertFalse((self.root / 'site').exists())

    def test_candidate_generated_status_collision_rejected(self):
        self.write('candidate/preview-status.json', b'candidate collision')
        self.binding['artifacts']['build']['files'] = P.inventory(self.root / 'candidate')
        self.write_binding()
        with self.assertRaisesRegex(ValueError, 'collides'):
            P.assemble(self.args)

    def test_mutated_old_bytes_and_wrong_baseline_inventory_rejected(self):
        self.write('baseline/history/retained.bin', b'SAME-NAMESPACE MUTATION')
        with self.assertRaisesRegex(ValueError, 'baseline'):
            P.assemble(self.args)
        self.assertFalse((self.root / 'site').exists())

    def test_raw_log_or_review_evidence_mutation_rejected(self):
        self.write('proof/job-logs/200.log', b'not the provider log')
        with self.assertRaisesRegex(ValueError, 'raw provider log changed'):
            P.assemble(self.args)

    def test_publication_binding_rejects_local_root_na_even_if_standalone_isolation_is_valid(self):
        isolated = copy.deepcopy(self.binding['previewSaveIsolation'])
        base = 'http://127.0.0.1:4173/'
        isolated['playerURL'] = base + P.QUERY
        isolated['reviewURL'] = base + P.QUERY + '&debug=1'
        isolated['bareEntry'] = copy.deepcopy(P.BARE_ENTRY_NOT_APPLICABLE)
        self.assertIs(P.assert_preview_save_isolation(isolated), isolated)
        changed = copy.deepcopy(self.binding)
        changed['previewSaveIsolation'] = isolated
        with self.assertRaisesRegex(ValueError, 'actual native namespace'):
            P.binding_structure(changed, self.expected)

    def test_native_served_package_must_bind_every_exact_build_file(self):
        filename = self.root / 'proof/review-artifacts/native-castle/served-package.json'
        served = P.read_json(filename)
        served['files'][0]['sha256'] = '0' * 64
        filename.write_bytes(P.json_bytes(served))
        self.binding['artifacts']['nativeCastle']['files'] = P.inventory(filename.parent)
        self.write_binding()
        with self.assertRaisesRegex(ValueError, 'served package differs'):
            P.assemble(self.args)
        self.assertFalse((self.root / 'site').exists())

    def test_exact_attempt_artifact_head_and_job_set_are_enforced(self):
        for mutation in ('artifact-attempt', 'artifact-head', 'job-failed', 'job-duplicate', 'artifact-id-bool'):
            changed = copy.deepcopy(self.binding)
            if mutation == 'artifact-attempt':
                changed['artifacts']['build']['name'] = 'tower41-next-cell-build-77-1'
            elif mutation == 'artifact-head':
                changed['artifacts']['cpu']['workflow_run']['head_sha'] = 'd' * 40
            elif mutation == 'job-failed':
                changed['jobs'][1]['conclusion'] = 'failure'
            elif mutation == 'job-duplicate':
                changed['jobs'][1] = changed['jobs'][0]
            else:
                changed['artifacts']['build']['id'] = True
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                P.binding_structure(changed, self.expected)

    def test_save_isolation_rejects_changed_bytes_missing_transitions_and_leaks(self):
        for mutation in ('old-bytes', 'phase-missing', 'namespace', 'extra-room', 'ratchet', 'replay', 'completed', 'hash'):
            changed = copy.deepcopy(self.isolation)
            if mutation == 'old-bytes':
                changed['phases'][6]['oldBytesUnchanged'] = False
            elif mutation == 'phase-missing':
                changed['phases'].pop()
            elif mutation == 'namespace':
                changed['namespace'] = 'brainrot-foundation-v1:'
            elif mutation == 'extra-room':
                changed['phases'][0]['startChoices'] = [40, 42]
            elif mutation == 'ratchet':
                changed['phases'][2]['ratchetCell'] = True
            elif mutation == 'replay':
                changed['controls']['replay']['solved'] = ['freight']
            elif mutation == 'completed':
                changed['phases'][7]['ownCompleted'] = [0, 40]
            else:
                changed['phases'][4]['legacySnapshotSha256'] = '0' * 64
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                P.assert_preview_save_isolation(changed)

    def test_manifest_rejects_old_mutation_extra_union_file_generated_hash_and_identity(self):
        manifest = self.assembled()
        for mutation in ('old', 'extra', 'generated', 'identity', 'bool-attempt', 'binding-attempt'):
            changed = copy.deepcopy(manifest)
            if mutation == 'old':
                changed['baselineFiles'][0]['sha256'] = '0' * 64
            elif mutation == 'extra':
                changed['siteFiles'].append(row('unreviewed.js', b'new'))
                changed['siteFiles'].sort(key=lambda value: value['path'])
            elif mutation == 'generated':
                changed['generatedFiles'][0]['sha256'] = '0' * 64
            elif mutation == 'identity':
                changed['sourceCommit'] = 'd' * 40
            elif mutation == 'bool-attempt':
                changed['sourceReview']['runAttempt'] = True
            else:
                changed['packageBinding']['artifacts']['summary']['name'] = 'tower41-next-cell-summary-77-1'
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                P.check_manifest(changed, 'published', self.expected)

    def test_assemble_refuses_existing_site_and_existing_manifest(self):
        self.write('site/existing', b'keep')
        with self.assertRaisesRegex(ValueError, 'overwrite'):
            P.assemble(self.args)
        self.assertEqual((self.root / 'site/existing').read_bytes(), b'keep')


class PendulumProofTests(TemporaryTest):
    def test_complete_retained_original_cargo_and_supported_crossing_witness_passes(self):
        proof = pendulum_proof()
        summary = P.assert_pendulum_physical_proof(proof, 7)
        self.assertEqual(summary, {'pass': True, 'originalCargoBodyId': 7, 'loadedStep': 20, 'retainedStartStep': 30,
                                  'currentStep': 100, 'supportedDeckSteps': 29, 'islandStep': 90,
                                  'physicalLowerCatch': True, 'upperCatchKinematic': True})
        self.assertEqual(P.pendulum_event({'observed': {'bodyId': 7, 'events': [{'id': 'pendulum', 'proof': proof}]}}), summary)

    def test_stale_contacts_held_foreign_motored_cells_and_false_catch_momentum_are_rejected(self):
        for path, value in [('originalCargo', False), ('twoPhysicalCatches', True),
                            ('lowerPhysicalCell.contactStep', 99), ('lowerPhysicalCell.originalCargoFree', False),
                            ('lowerPhysicalCell.currentCollisionValid', False), ('lowerPhysicalCell.originalCargoBodyId', 8),
                            ('lowerPhysicalCell.loadContact', True), ('lowerPhysicalCell.retainedTicks', 23),
                            ('lowerPhysicalCell.bridge.type', 4), ('lowerPhysicalCell.constraintMotorEnabled', [True, False]),
                            ('lowerPhysicalCell.constraintMotorEquationPresent', [True, False]),
                            ('lowerPhysicalCell.catchWitness.action', 'release'), ('lowerPhysicalCell.catchWitness.qualifiedLoad', False),
                            ('lowerPhysicalCell.catchWitness.angularImpulse', 1.2), ('lowerPhysicalCell.catchWitness.angularMomentumAfter', -.9),
                            ('lowerPhysicalCell.loadedWitness.first.freeOriginal', False), ('lowerPhysicalCell.pawlNormalForce', 0)]:
            with self.subTest(path=path):
                proof = pendulum_proof()
                target = proof
                keys = path.split('.')
                for key in keys[:-1]:
                    target = target[key]
                target[keys[-1]] = value
                with self.assertRaises(ValueError):
                    P.assert_pendulum_physical_proof(proof, 7)
        for value in [True, float('nan'), float('inf')]:
            proof = pendulum_proof(); proof['lowerPhysicalCell']['bridge']['inertia'][0] = value
            with self.assertRaises(ValueError):
                P.assert_pendulum_physical_proof(proof, 7)

    def test_support_pose_world_foot_normal_and_founded_floor_certificates_cannot_be_relabelled(self):
        for mutate in [lambda p: p['lowerCrossing']['checkpoints'][0]['pose'].update(center=[.01, 0, 0]),
                       lambda p: p['lowerCrossing']['checkpoints'][0].update(foot=[-3, .2, 0]),
                       lambda p: p['lowerCrossing']['checkpoints'][0].update(shapeOffset=[1, 0, 0]),
                       lambda p: p['lowerCrossing']['checkpoints'][0].update(supportNormal=[.1, 1, 0]),
                       lambda p: p['lowerCrossing']['nearLanding'].update(bodyPosition=[0, 0, 0]),
                       lambda p: p['lowerCrossing']['nearLanding'].update(shapeHalf=[5, .2, 2]),
                       lambda p: p['lowerCrossing']['nearLanding'].update(foot=[5.9, 0, 0]),
                       lambda p: p['lowerCrossing']['checkpoints'][3].update(bodyQuaternion=[0, 0, 1, 0])]:
            proof = pendulum_proof(); mutate(proof)
            with self.assertRaises(ValueError):
                P.assert_pendulum_physical_proof(proof, 7)

    def test_six_causal_count_angle_current_load_normal_and_current_bounds_forgeries_are_rejected(self):
        mutations = [lambda p: p['lowerPhysicalCell']['catchWitness'].update(bridgeAngle=.42),
                     lambda p: p['lowerPhysicalCell']['catchWitness'].update(loadedStep=10, loadedAtStep=10),
                     lambda p: p['lowerPhysicalCell'].update(loadedTicks=10000),
                     lambda p: p['lowerCrossing'].update(supportedDeckSteps=10000),
                     lambda p: p['lowerCrossing']['nearLanding'].update(supportNormal=[0, 100, 0]),
                     lambda p: p['lowerCrossing']['checkpoints'][0]['pose'].update(bounds=[[-50, -50, -50], [50, 50, 50]])]
        for mutate in mutations:
            proof = pendulum_proof(); mutate(proof)
            with self.assertRaises(ValueError):
                P.assert_pendulum_physical_proof(proof, 7)

    def test_airborne_out_of_order_wrong_deck_and_stale_pose_crossings_are_rejected(self):
        for mutate in [lambda p: p['lowerCrossing'].update(originalCargoBodyId=8),
                       lambda p: p['lowerCrossing'].update(midStep=60),
                       lambda p: p['lowerCrossing'].update(supportedDeckSteps=23),
                       lambda p: p['lowerCrossing']['nearLanding'].update(bodyId=10),
                       lambda p: p['lowerCrossing']['checkpoints'][0].update(grounded=False),
                       lambda p: p['lowerCrossing']['checkpoints'][0].update(live=False),
                       lambda p: p['lowerCrossing']['checkpoints'][0].update(bodyId=99),
                       lambda p: p['lowerCrossing']['checkpoints'][0].update(shapeIndex=1),
                       lambda p: p['lowerCrossing']['checkpoints'][0].update(supportGap=.02),
                       lambda p: p['lowerCrossing']['checkpoints'][0]['pose'].update(step=60),
                       lambda p: p['lowerCrossing']['checkpoints'][0].update(localFoot=[-5.9, .2, 0]),
                       lambda p: p['lowerCrossing']['checkpoints'][3].update(bodyId=12)]:
            proof = pendulum_proof(); mutate(proof)
            with self.assertRaises(ValueError):
                P.assert_pendulum_physical_proof(proof, 7)
        proof = pendulum_proof()
        for events in [[], [{'id': 'pendulum', 'proof': proof}] * 2, [{'id': 'pendulum', 'proof': None}]]:
            with self.assertRaises(ValueError):
                P.pendulum_event({'observed': {'bodyId': 7, 'events': events}})


class PendulumBindingTests(PipelineFixture):
    def test_relabelled_pendulum_binding_cannot_assemble(self):
        self.binding['pendulum']['supportedDeckSteps'] = 0
        self.write_binding()
        with self.assertRaisesRegex(ValueError, 'Pendulum binding differs'):
            self.assembled()
        self.assertFalse((self.root / 'site').exists())


class BaselineTests(PipelineFixture):
    def make_accepted_zip(self, modified=False):
        filename = self.root / 'accepted.tar'
        with tarfile.open(filename, 'w') as archive:
            for expected in self.before:
                content = (self.root / 'baseline' / expected['path']).read_bytes()
                if modified and expected['path'] == 'index.html':
                    content = b'X' * len(content)
                entry = tarfile.TarInfo('./' + expected['path'])
                entry.size = len(content)
                archive.addfile(entry, io.BytesIO(content))
        pages_zip = self.zip([('artifact.tar', filename.read_bytes())], 'pages.zip')
        patcher = mock.patch.object(P, 'BASELINE_ARTIFACT', {'id': 11693810063, 'bytes': pages_zip.stat().st_size,
                                                         'sha256': P.sha256_file(pages_zip)})
        patcher.start()
        self.addCleanup(patcher.stop)
        accepted = {'schemaVersion': 1, 'sourceCommit': P.BASELINE_SOURCE, 'publisherCommit': P.BASELINE_PUBLISHER,
                    'publicationRun': P.BASELINE_RUN, 'sourceReview': P.BASELINE_REVIEW, 'phase': 'published', 'siteFiles': self.before,
                    'siteBytes': P.BASELINE_BYTES, 'siteFilesSha256': P.BASELINE_INVENTORY_SHA256}
        self.write('accepted-publication/proof/manifest.json', P.json_bytes(accepted))
        self.write('accepted-publication/proof/public-bytes.json', P.json_bytes({
            **{key: accepted[key] for key in ('sourceCommit', 'publisherCommit', 'publicationRun', 'sourceReview')},
            'pass': True, 'phase': 'published', 'checked': P.BASELINE_COUNT, 'bytes': P.BASELINE_BYTES,
            'siteFilesSha256': P.BASELINE_INVENTORY_SHA256}))
        return argparse.Namespace(zip=str(pages_zip), accepted_proof=str(self.root / 'accepted-publication'),
                                  output=str(self.root / 'restored-baseline'))

    def test_pinned_zip_and_entire_tar_match_independently_accepted_proof(self):
        args = self.make_accepted_zip()
        with mock.patch('builtins.print'):
            P.baseline(args)
        self.assertEqual(P.inventory(self.root / 'restored-baseline'), self.before)

    def test_pinned_archive_with_wrong_inner_bytes_does_not_publish_partial_tree(self):
        args = self.make_accepted_zip(modified=True)
        with self.assertRaisesRegex(ValueError, 'baseline bytes differ'):
            P.baseline(args)
        self.assertFalse((self.root / 'restored-baseline').exists())
        self.assertEqual(list(self.root.glob('.restored-baseline-staging-*')), [])

    def test_wrong_accepted_proof_identity_does_not_extract(self):
        args = self.make_accepted_zip()
        filename = self.root / 'accepted-publication/proof/manifest.json'
        manifest = P.read_json(filename)
        manifest['sourceReview']['runAttempt'] = True
        filename.write_bytes(P.json_bytes(manifest))
        with self.assertRaisesRegex(ValueError, 'safe integer'):
            P.baseline(args)
        self.assertFalse((self.root / 'restored-baseline').exists())


class PrivateAcceptedProofTests(PipelineFixture):
    make_accepted_zip = BaselineTests.make_accepted_zip
    def make_private_proof(self, extra=()):
        self.make_accepted_zip()
        members = [(name, (self.root / 'accepted-publication/proof' / name).read_bytes())
                   for name in ('manifest.json', 'public-bytes.json')]
        members.extend([('downloads/previous-baseline.zip', b'PRIVATE ARCHIVE MUST NOT BE EXPANDED'),
                        ('public-native/old.mp4', b'PRIVATE MOVIE MUST NOT BE EXPANDED')])
        members.extend(extra)
        filename = self.zip(members, 'private-proof.zip')
        patcher = mock.patch.object(P, 'ACCEPTED_PROOF_ARTIFACT',
                                    {'id': 11752231330, 'bytes': filename.stat().st_size,
                                     'sha256': P.sha256_file(filename)})
        patcher.start()
        self.addCleanup(patcher.stop)
        return filename

    def test_selects_only_pinned_current_manifest_and_public_byte_receipt(self):
        filename = self.make_private_proof()
        rows = P.extract_accepted_proof(filename, self.root / 'selected')
        self.assertEqual([item['path'] for item in rows], ['manifest.json', 'public-bytes.json'])
        self.assertFalse((self.root / 'selected/downloads').exists())
        self.assertFalse((self.root / 'selected/public-native').exists())
        self.assertEqual(P.accepted_manifest(self.root / 'selected')[0], self.before)
        self.assertEqual(P.MAX_BYTES, 600_000_000)
        self.assertEqual(P.MAX_CANDIDATE_BYTES, 100_000_000)

    def test_unsafe_nonselected_member_and_duplicate_manifest_reject_before_output(self):
        for extra in [[('../ignored.txt', b'unsafe')], [('downloads', b'collision')],
                      [('proof/manifest.json', b'{}')]]:
            with self.subTest(extra=extra):
                filename = self.make_private_proof(extra)
                with self.assertRaises(ValueError):
                    P.extract_accepted_proof(filename, self.root / 'selected')
                self.assertFalse((self.root / 'selected').exists())
                self.assertEqual(list(self.root.glob('.selected-staging-*')), [])

    def test_private_pin_digest_size_and_current_public_byte_receipt_are_mandatory(self):
        filename = self.make_private_proof()
        for pin in [{**P.ACCEPTED_PROOF_ARTIFACT, 'bytes': filename.stat().st_size + 1},
                    {**P.ACCEPTED_PROOF_ARTIFACT, 'sha256': '0' * 64}]:
            with mock.patch.object(P, 'ACCEPTED_PROOF_ARTIFACT', pin), self.assertRaises(ValueError):
                P.extract_accepted_proof(filename, self.root / 'selected')
            self.assertFalse((self.root / 'selected').exists())
        self.make_accepted_zip()
        receipt = P.read_json(self.root / 'accepted-publication/proof/public-bytes.json')
        receipt['pass'] = False
        filename = self.zip([('manifest.json', (self.root / 'accepted-publication/proof/manifest.json').read_bytes()),
                             ('public-bytes.json', P.json_bytes(receipt))], 'failed-private.zip')
        with mock.patch.object(P, 'ACCEPTED_PROOF_ARTIFACT',
                               {'id': 11752231330, 'bytes': filename.stat().st_size, 'sha256': P.sha256_file(filename)}), self.assertRaises(ValueError):
            P.extract_accepted_proof(filename, self.root / 'selected')
        self.assertFalse((self.root / 'selected').exists())
        self.assertEqual(list(self.root.glob('.selected-staging-*')), [])

    def test_large_private_namespace_cap_is_separate_from_public_extractor(self):
        entries = []
        for name in ('retained/one.zip', 'retained/two.zip'):
            entry = zipfile.ZipInfo(name)
            entry.file_size = 400_000_000
            entry.compress_size = 400_000_000
            entries.append(entry)
        archive = mock.Mock(infolist=lambda: entries)
        self.assertEqual(len(P.zip_entries(archive, P.MAX_PRIVATE_PROOF_BYTES)), 2)
        with self.assertRaises(ValueError):
            P.zip_entries(archive, P.MAX_BYTES)
        filename = self.zip([('small', b'ordinary')])
        with self.assertRaises(ValueError):
            self.extract(filename, maximum=P.MAX_PRIVATE_PROOF_BYTES)
        self.assertFalse((self.root / 'out').exists())

    def test_old_preview_save_snapshot_is_required_and_never_the_active_v2_key(self):
        isolation = save_isolation()
        P.assert_preview_save_isolation(isolation)
        key = 'brainrot-tower41-native-v1:brainrot-portal.preferences.v24'
        self.assertIn(key, isolation['legacySnapshot'])
        self.assertNotEqual(key, isolation['ownKey'])
        for mutate in [lambda value: value['legacyPrefixes'].pop(),
                       lambda value: value['legacySnapshot'].pop(key),
                       lambda value: value.update(ownKey=key)]:
            changed = copy.deepcopy(isolation)
            mutate(changed)
            with self.assertRaises(ValueError):
                P.assert_preview_save_isolation(changed)


class VerificationPacketTests(PipelineFixture):
    def make_packet_input(self):
        manifest = self.assembled()
        evidence = P.read_json(self.root / 'proof/review-artifacts/native-castle/evidence.json')
        self.write('proof/public-native/evidence.json', P.json_bytes(evidence))
        self.write('proof/public-native/' + evidence['video']['filename'], self.movie)
        self.write('proof/public-bytes.json', P.json_bytes({**self.expected, 'pass': True, 'phase': 'published',
                   'checked': len(manifest['siteFiles']), 'bytes': manifest['siteBytes'], 'siteFilesSha256': manifest['siteFilesSha256']}))
        self.write('proof/public-native/screenshot.png', b'PRIVATE IMAGE')
        self.write('proof/downloads/old.zip', b'PRIVATE NESTED ARCHIVE')
        self.write('proof/review-artifacts/build/source-code.js', b'PRODUCTION CODE')
        return argparse.Namespace(**vars(self.args), output=str(self.root / 'verification-bundle'))

    def test_bounded_packet_keeps_current_metadata_logs_and_whole_unchanged_public_movie(self):
        args = self.make_packet_input()
        with mock.patch('builtins.print'):
            P.verification_bundle(args)
        output = self.root / 'verification-bundle'
        packet = P.read_json(output / 'verification-packet.json')
        self.assertTrue(packet['pass'])
        self.assertLessEqual(sum(row['bytes'] for row in P.inventory(output)), 100_000_000)
        self.assertEqual(packet['filesSha256'], P.inventory_sha256(packet['files']))
        self.assertTrue((output / 'package-binding.json').is_file())
        self.assertTrue((output / 'manifest.json').is_file())
        self.assertTrue((output / 'job-logs/200.log').is_file())
        self.assertEqual((output / packet['completePublicMovie']['path']).read_bytes(), self.movie)
        self.assertFalse((output / 'public-native/screenshot.png').exists())
        self.assertFalse((output / 'downloads').exists())
        self.assertFalse((output / 'review-artifacts/build').exists())
        for row in packet['files']:
            self.assertEqual((output / row['path']).read_bytes(), (self.root / 'proof' / row['path']).read_bytes())

    def test_packet_rejects_failed_public_bytes_stale_runtime_and_changed_movie(self):
        args = self.make_packet_input()
        for path, field, changed in [('public-bytes.json', 'pass', False),
                                     ('public-native/evidence.json', 'sourceCommit', 'f' * 40)]:
            filename = self.root / 'proof' / path
            original = filename.read_bytes()
            value = P.read_json(filename)
            value[field] = changed
            filename.write_bytes(P.json_bytes(value))
            with self.assertRaises(ValueError):
                P.verification_bundle(args)
            self.assertFalse(pathlib.Path(args.output).exists())
            filename.write_bytes(original)
        movie = self.root / 'proof/public-native/ordinary-castle.mp4'
        movie.write_bytes(self.movie + b'MUTATED')
        with self.assertRaises(ValueError):
            P.verification_bundle(args)
        self.assertFalse(pathlib.Path(args.output).exists())

    def test_packet_caps_and_unselected_symlink_are_enforced_before_copy(self):
        args = self.make_packet_input()
        for limit, value in [('MAX_VERIFICATION_BYTES', len(self.movie) - 1), ('MAX_VERIFICATION_METADATA_BYTES', 1)]:
            with mock.patch.object(P, limit, value), self.assertRaises(ValueError):
                P.verification_bundle(args)
            self.assertFalse(pathlib.Path(args.output).exists())
        (self.root / 'proof/ignored-image.png').symlink_to(self.root / 'proof/manifest.json')
        with self.assertRaises(ValueError):
            P.verification_bundle(args)
        self.assertFalse(pathlib.Path(args.output).exists())
        self.assertEqual(list(self.root.glob('.verification-bundle-staging-*')), [])


class FullVerificationTests(PipelineFixture):
    def test_all_accepted_and_appended_bytes_and_receipt_are_verified(self):
        manifest = self.assembled()
        args = argparse.Namespace(**vars(self.args), manifest=str(self.root / 'proof/manifest.json'),
                                  base='https://example.test/', phase='published', output=str(self.root / 'proof/post.json'))
        paths = []
        def verified(base, row):
            paths.append(row['path'])
            self.assertEqual(base, 'https://example.test')
            actual = (self.root / 'site' / row['path']).read_bytes()
            self.assertEqual(row, globals()['row'](row['path'], actual))
            return len(actual)
        with mock.patch.object(P, 'verify_row', side_effect=verified), mock.patch('builtins.print'):
            P.verify(args)
        report = P.read_json(self.root / 'proof/post.json')
        self.assertTrue(report['pass'])
        self.assertEqual(report['checked'], len(manifest['siteFiles']))
        self.assertEqual(report['bytes'], manifest['siteBytes'])
        self.assertEqual(set(paths), {row['path'] for row in manifest['siteFiles']})
        self.assertGreater(len(paths), report['checked'])

    def test_failure_writes_false_receipt_with_current_identity(self):
        self.assembled()
        args = argparse.Namespace(**vars(self.args), manifest=str(self.root / 'proof/manifest.json'),
                                  base='https://example.test/', phase='published', output=str(self.root / 'proof/failed.json'))
        with mock.patch.object(P, 'verify_row', side_effect=ValueError('public old file changed')), mock.patch.object(P.time, 'sleep'):
            with self.assertRaisesRegex(ValueError, 'public old file changed'):
                P.verify(args)
        report = P.read_json(self.root / 'proof/failed.json')
        self.assertIs(report['pass'], False)
        self.assertIs(report['mainSiteUnchanged'], False)
        for key, value in self.expected.items():
            self.assertEqual(report[key], value)


class HTTPTests(unittest.TestCase):
    class Response(io.BytesIO):
        def __init__(self, value, headers=None, status=200):
            super().__init__(value)
            self.headers = headers or {}
            self.status = status

    def test_streamed_hash_size_encoding_status_and_content_length(self):
        value = b'\x00binary bytes\xff'
        expected = row('tower41-native-v2/assets/spaces file.js', value)
        requests = []
        def opener(request, timeout):
            requests.append(request)
            self.assertEqual(timeout, 90)
            return self.Response(value, {'Content-Length': str(len(value))})
        self.assertEqual(P.verify_row('https://example.test/site', expected, opener), len(value))
        self.assertIn('spaces%20file.js?', requests[0].full_url)
        self.assertEqual(requests[0].get_header('Accept-encoding'), 'identity')
        for body, headers, status in [(value + b'x', {}, 200), (value[:-1], {}, 200), (b'x' * len(value), {}, 200),
                                      (value, {'Content-Encoding': 'gzip'}, 200), (value, {'Content-Length': '0'}, 200), (value, {}, 404)]:
            with self.subTest(headers=headers, status=status), self.assertRaises(ValueError):
                P.verify_row('https://example.test/site', expected, lambda request, timeout: self.Response(body, headers, status))

    def test_base_url_rejects_credentials_query_fragment_and_non_http(self):
        for base in ('file:///tmp/site', 'https://user:password@example.test/', 'https://example.test/?query=1',
                     'https://example.test/#fragment', 'https://example.test/\nmalformed'):
            with self.subTest(base=base), self.assertRaises(ValueError):
                P.checked_base(base)


if __name__ == '__main__':
    unittest.main(verbosity=2)
