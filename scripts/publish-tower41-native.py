"""Append the exact reviewed ordinary room 41 build without changing accepted Pages bytes."""
import argparse
import concurrent.futures
import hashlib
import html
import json
import math
import os
import pathlib
import re
import shutil
import stat
import tarfile
import tempfile
import time
import urllib.parse
import urllib.request
import zipfile


MAX_BYTES = 600_000_000
MAX_PRIVATE_PROOF_BYTES = 2_000_000_000
MAX_VERIFICATION_BYTES = 100_000_000
MAX_VERIFICATION_METADATA_BYTES = 25_000_000
MAX_CANDIDATE_BYTES = 100_000_000
MAX_ENTRIES = 20_000
MAX_SAFE_INTEGER = 2 ** 53 - 1
BASELINE_RUN = 38251739817
BASELINE_PUBLISHER = '300e898c169a281bd3e0054e2c4b39bb055649e0'
BASELINE_SOURCE = '58a71ddfc9bf704bef4c97fe13d16401c5a5f9f2'
BASELINE_REVIEW = {'runId': 38243168335, 'runAttempt': 1}
BASELINE_ARTIFACT = {'id': 11748151358, 'bytes': 521571734,
                     'sha256': 'ed5032d4ce2565c36a5cf1d6a4fbbb5ce0d155571f30c483dce6bb01878afc6d'}
ACCEPTED_PROOF_ARTIFACT = {'id': 11752231330, 'bytes': 631746277,
                         'sha256': '46009cc59b9612e84db53b81999d9878280f7dd3b82afb66a1cc560f08f1f599'}
BASELINE_COUNT = 1706
BASELINE_BYTES = 561674513
BASELINE_INVENTORY_SHA256 = '70ae091efbbad883c3d4eb5c1655b3a9bd55b403da19cfcad409f5c2faff2c70'
PREFIX = 'tower41-native-v2/'
QUERY = '?edition=foundation&level=41&tower41preview=1'
STORAGE_PREFIX = 'brainrot-tower41-native-v2:'
JOB_NAMES = ('build', 'cpu', 'native-contact', 'native-castle', 'review-summary')
ARTIFACT_NAMES = {'build': 'build', 'source': 'source', 'cpu': 'cpu',
                  'nativeContact': 'native-contact', 'nativeCastle': 'native-castle', 'summary': 'summary'}
SUPPLEMENTAL_VIDEO = 'evidence/tower41-native.mp4'
SUPPLEMENTAL_REPORT = 'evidence/tower41-native-report.json'
SUPPLEMENTAL_IDENTITY = 'evidence/tower41-native-identity.json'
SUPPLEMENTAL_TARGETS = {'preview-status.json', 'walkthroughs.html', SUPPLEMENTAL_IDENTITY,
                        SUPPLEMENTAL_VIDEO, SUPPLEMENTAL_REPORT}
NATIVE_ENTRY_PATHS = frozenset(('/tower41-native-v2', '/tower41-native-v2/', '/tower41-native-v2/index.html',
                               '/brainrot-portal/tower41-native-v2', '/brainrot-portal/tower41-native-v2/',
                               '/brainrot-portal/tower41-native-v2/index.html'))
BARE_ENTRY_NOT_APPLICABLE = {'applicable': False,
                             'reason': 'The configured browser review base is outside the standalone tower41-native entry namespace.'}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def integer(value, label, minimum=0, maximum=MAX_SAFE_INTEGER):
    require(type(value) is int and minimum <= value <= maximum,
            label + ' must be a finite safe integer')
    return value


def argument_integer(value, label):
    require(isinstance(value, str) and re.fullmatch(r'[1-9][0-9]*', value), label + ' must be positive')
    return integer(int(value), label, 1)


def digest(value, label):
    require(isinstance(value, str) and re.fullmatch(r'[0-9a-f]{64}', value), label + ' needs an exact SHA-256')
    return value


def commit(value, label):
    require(isinstance(value, str) and re.fullmatch(r'[0-9a-f]{40}', value), label + ' needs an exact commit')
    return value


def identity(args):
    return {'sourceCommit': commit(args.source, 'Source'),
            'publisherCommit': commit(args.publisher, 'Publisher'),
            'publicationRun': argument_integer(args.run, 'Publication run'),
            'sourceReview': {'runId': argument_integer(args.review_run, 'Review run'),
                             'runAttempt': argument_integer(args.review_attempt, 'Review attempt')}}


def exact_identity(value, expected, label):
    require(isinstance(value, dict), label + ' must be an object')
    for key in ('sourceCommit', 'publisherCommit', 'publicationRun'):
        if key in expected:
            require(type(value.get(key)) is type(expected[key]) and value.get(key) == expected[key],
                    label + ' stale identity: ' + key)
    review = value.get('sourceReview')
    require(isinstance(review, dict) and set(review) == {'runId', 'runAttempt'}, label + ' needs exact sourceReview')
    integer(review['runId'], label + ' review run', 1)
    integer(review['runAttempt'], label + ' review attempt', 1)
    require(review == expected['sourceReview'], label + ' stale review run or attempt')


def safe_name(name):
    require(isinstance(name, str), 'A path must be text')
    while name.startswith('./'):
        name = name[2:]
    require(bool(name) and not name.startswith('/') and '\\' not in name, 'Unsafe path: ' + repr(name))
    require(not any(ord(c) < 32 or ord(c) == 127 or 0xD800 <= ord(c) <= 0xDFFF for c in name),
            'Control/null/invalid character in path')
    require(all(part not in ('', '.', '..') for part in name.split('/')), 'Unsafe path: ' + name)
    require(not re.match(r'^[A-Za-z]:', name), 'Drive-qualified path: ' + name)
    return name


def no_symlinks(path):
    path = pathlib.Path(os.path.abspath(path))
    for item in (path, *path.parents):
        require(not item.is_symlink(), 'A path or parent is a symlink: ' + str(item))
    return path


def ordinary_file(path):
    path = no_symlinks(path)
    require(path.is_file() and stat.S_ISREG(path.lstat().st_mode), 'Expected an ordinary file: ' + str(path))
    return path


def ordinary_directory(path):
    path = no_symlinks(path)
    require(path.is_dir() and stat.S_ISDIR(path.lstat().st_mode), 'Expected an ordinary directory: ' + str(path))
    return path


def disjoint_roots(*paths):
    checked = [no_symlinks(path) for path in paths]
    for i, left in enumerate(checked):
        for right in checked[i + 1:]:
            require(left != right and left not in right.parents and right not in left.parents,
                    'Input/output roots must be disjoint: ' + str(left) + ' / ' + str(right))
    return checked


def sha256_file(filename):
    filename = ordinary_file(filename)
    result = hashlib.sha256()
    with filename.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            result.update(chunk)
    return result.hexdigest()


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + '\n').encode('utf-8')


def write_new_json(filename, value):
    filename = no_symlinks(filename)
    require(not filename.exists(), 'Refuse to overwrite a generated proof: ' + str(filename))
    filename.parent.mkdir(parents=True, exist_ok=True)
    with filename.open('xb') as stream:
        stream.write(json_bytes(value))


def read_json(filename):
    filename = ordinary_file(filename)
    require(filename.stat().st_size <= 50_000_000, 'Oversized JSON: ' + str(filename))
    def invalid(value):
        raise ValueError('Non-finite JSON number: ' + value)
    def finite_float(value):
        parsed = float(value)
        require(math.isfinite(parsed), 'Non-finite JSON number: ' + value)
        return parsed
    def pairs(values):
        result = {}
        for key, value in values:
            require(key not in result, 'Duplicate JSON key: ' + key)
            result[key] = value
        return result
    with filename.open(encoding='utf-8') as stream:
        return json.load(stream, parse_constant=invalid, parse_float=finite_float, object_pairs_hook=pairs)


def checked_rows(value, label, maximum=MAX_BYTES, nonempty=True):
    require(isinstance(value, list) and (value or not nonempty), label + ' needs a file inventory')
    require(len(value) <= MAX_ENTRIES, label + ' has too many files')
    seen, total, previous = {}, 0, None
    for row in value:
        require(isinstance(row, dict) and set(row) == {'path', 'bytes', 'sha256'}, label + ' invalid file row')
        name = safe_name(row['path'])
        require(name == row['path'] and name not in seen, label + ' duplicate/noncanonical path: ' + name)
        require(previous is None or previous < name, label + ' inventory must be sorted by path')
        previous = name
        total += integer(row['bytes'], label + ' file size', maximum=maximum)
        require(total <= maximum, label + ' inventory exceeds byte limit')
        digest(row['sha256'], label + ' file hash')
        seen[name] = row
    for name in seen:
        require(all('/'.join(name.split('/')[:i]) not in seen for i in range(1, len(name.split('/')))),
                label + ' directory/file collision: ' + name)
    return seen


def inventory(root, maximum=MAX_BYTES):
    root = ordinary_directory(root)
    rows, total, count = [], 0, 0
    for filename in sorted(root.rglob('*')):
        count += 1
        require(count <= MAX_ENTRIES * 2, 'Inventory has too many entries')
        mode = filename.lstat().st_mode
        require(stat.S_ISREG(mode) or stat.S_ISDIR(mode), 'Non-regular inventory path: ' + str(filename))
        if stat.S_ISREG(mode):
            size = integer(filename.stat().st_size, 'File size', maximum=maximum)
            total += size
            require(total <= maximum, 'Inventory exceeds byte limit')
            rows.append({'path': safe_name(filename.relative_to(root).as_posix()),
                         'bytes': size, 'sha256': sha256_file(filename)})
    rows.sort(key=lambda row: row['path'])
    checked_rows(rows, 'Local inventory', maximum)
    return rows


def inventory_sha256(rows):
    return hashlib.sha256(json.dumps(rows, ensure_ascii=False, separators=(',', ':')).encode('utf-8')).hexdigest()


def archive_namespace(entries, label):
    kinds = {}
    require(len(entries) <= MAX_ENTRIES * 2, label + ' has too many entries')
    for entry, name, directory in entries:
        require(name not in kinds, label + ' duplicate entry: ' + name)
        kinds[name] = 'directory' if directory else 'file'
    for name in kinds:
        require(all(kinds.get('/'.join(name.split('/')[:i])) != 'file' for i in range(1, len(name.split('/')))),
                label + ' directory/file collision: ' + name)
    return kinds


def zip_entries(archive, maximum):
    entries, total = [], 0
    for entry in archive.infolist():
        require(entry.orig_filename == entry.filename, 'Noncanonical/null ZIP member name')
        original = entry.filename[:-1] if entry.is_dir() else entry.filename
        name = safe_name(original)
        require(name == original, 'Noncanonical ZIP member name: ' + original)
        kind = stat.S_IFMT(entry.external_attr >> 16)
        require(kind in (0, stat.S_IFDIR if entry.is_dir() else stat.S_IFREG), 'Non-regular ZIP entry: ' + name)
        require(not entry.flag_bits & 1, 'Encrypted ZIP is unsupported')
        require(entry.compress_type in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED), 'Unsupported ZIP compression')
        integer(entry.compress_size, 'ZIP compressed size', maximum=maximum)
        total += integer(entry.file_size, 'ZIP file size', maximum=maximum)
        require(total <= maximum, 'ZIP exceeds uncompressed byte limit')
        require(not entry.is_dir() or entry.file_size == 0, 'ZIP directory has file bytes')
        entries.append((entry, name, entry.is_dir()))
        require(len(entries) <= MAX_ENTRIES * 2, 'ZIP has too many entries')
    kinds = archive_namespace(entries, 'ZIP')
    require(any(kind == 'file' for kind in kinds.values()), 'ZIP has no files')
    return entries


def stream_to_file(source, destination, declared_size):
    destination.parent.mkdir(parents=True, exist_ok=True)
    written = 0
    with destination.open('xb') as target:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            written += len(chunk)
            require(written <= declared_size, 'Archive member exceeds declared size')
            target.write(chunk)
    require(written == declared_size, 'Truncated archive member')


def staging_directory(output):
    output = no_symlinks(output)
    require(not output.exists(), 'Refuse to overwrite an extraction/output directory: ' + str(output))
    output.parent.mkdir(parents=True, exist_ok=True)
    return pathlib.Path(tempfile.mkdtemp(prefix='.' + output.name + '-staging-', dir=output.parent))


def extract_zip(archive_file, output, expected_digest, expected_bytes, maximum):
    archive_file = ordinary_file(archive_file)
    output = no_symlinks(output)
    require(type(maximum) is int and 0 < maximum <= MAX_BYTES, 'Invalid ZIP byte limit')
    require(archive_file.stat().st_size == expected_bytes and expected_bytes <= MAX_BYTES, 'ZIP size mismatch or oversized ZIP')
    require(sha256_file(archive_file) == expected_digest, 'ZIP hash mismatch')
    require(not output.exists(), 'Refuse to overwrite an extraction directory')
    temporary = None
    try:
        with zipfile.ZipFile(archive_file) as archive:
            entries = zip_entries(archive, maximum)
            temporary = staging_directory(output)
            for entry, name, directory in entries:
                destination = temporary / name
                if directory:
                    destination.mkdir(parents=True, exist_ok=True)
                else:
                    with archive.open(entry) as source:
                        stream_to_file(source, destination, entry.file_size)
        rows = inventory(temporary, maximum)
        temporary.rename(output)
        temporary = None
        return rows
    finally:
        if temporary is not None:
            shutil.rmtree(temporary)


def extract_accepted_proof(archive_file, output):
    """Inspect every private archive member, then restore only the accepted manifest and byte receipt."""
    archive_file = ordinary_file(archive_file)
    output = no_symlinks(output)
    require(archive_file.stat().st_size == ACCEPTED_PROOF_ARTIFACT['bytes'] and
            archive_file.stat().st_size <= MAX_PRIVATE_PROOF_BYTES, 'Accepted private proof ZIP size mismatch')
    require(sha256_file(archive_file) == ACCEPTED_PROOF_ARTIFACT['sha256'], 'Accepted private proof ZIP hash mismatch')
    require(not output.exists(), 'Refuse to overwrite an accepted proof directory')
    temporary = None
    try:
        with zipfile.ZipFile(archive_file) as archive:
            # Namespace, types, collisions and the full private byte cap are checked before selecting anything.
            entries = zip_entries(archive, MAX_PRIVATE_PROOF_BYTES)
            selected = []
            for suffix in ('manifest.json', 'public-bytes.json'):
                matching = [(entry, name) for entry, name, directory in entries
                            if not directory and name in (suffix, 'proof/' + suffix)]
                require(len(matching) == 1, 'Accepted private proof needs exactly one ' + suffix)
                selected.extend(matching)
            require(all(entry.file_size <= 50_000_000 for entry, _ in selected), 'Accepted private proof JSON exceeds limit')
            temporary = staging_directory(output)
            for entry, name in selected:
                with archive.open(entry) as source:
                    stream_to_file(source, temporary / name, entry.file_size)
        rows = inventory(temporary)
        accepted_manifest(temporary)
        temporary.rename(output)
        temporary = None
        return rows
    finally:
        if temporary is not None:
            shutil.rmtree(temporary)


def extract_accepted(args):
    rows = extract_accepted_proof(args.zip, args.output)
    print(json.dumps({'pass': True, 'zipSha256': ACCEPTED_PROOF_ARTIFACT['sha256'],
                      'zipBytes': ACCEPTED_PROOF_ARTIFACT['bytes'], 'allMembersInspected': True,
                      'privateMaximumBytes': MAX_PRIVATE_PROOF_BYTES, 'files': len(rows),
                      'bytes': sum(row['bytes'] for row in rows), 'filesSha256': inventory_sha256(rows)}))


def extract(args):
    require(isinstance(args.digest, str) and re.fullmatch(r'sha256:[0-9a-f]{64}', args.digest), 'An exact provider digest is required')
    maximum = argument_integer(args.max_bytes, 'ZIP byte limit')
    rows = extract_zip(args.zip, args.output, args.digest[7:], argument_integer(args.bytes, 'ZIP bytes'), maximum)
    print(json.dumps({'pass': True, 'zipSha256': args.digest[7:], 'zipBytes': int(args.bytes),
                      'files': len(rows), 'bytes': sum(row['bytes'] for row in rows), 'filesSha256': inventory_sha256(rows)}))


def check_baseline(rows):
    checked_rows(rows, 'Accepted baseline')
    require(len(rows) == BASELINE_COUNT, 'Accepted baseline file count mismatch')
    require(sum(row['bytes'] for row in rows) == BASELINE_BYTES, 'Accepted baseline byte count mismatch')
    require(inventory_sha256(rows) == BASELINE_INVENTORY_SHA256, 'Accepted baseline inventory hash mismatch')
    require(not any(row['path'] == PREFIX[:-1] or row['path'].startswith(PREFIX) for row in rows),
            'Native preview namespace already exists')


def accepted_manifest(root):
    root = ordinary_directory(root)
    filename = root / 'proof/manifest.json'
    if not filename.exists():
        filename = root / 'manifest.json'
    manifest = read_json(filename)
    exact_identity(manifest, {'sourceCommit': BASELINE_SOURCE, 'publisherCommit': BASELINE_PUBLISHER,
                             'publicationRun': BASELINE_RUN, 'sourceReview': BASELINE_REVIEW}, 'Accepted publication manifest')
    require(type(manifest.get('schemaVersion')) is int and manifest['schemaVersion'] == 1 and manifest.get('phase') == 'published',
            'Accepted proof schema/phase mismatch')
    check_baseline(manifest.get('siteFiles'))
    require(manifest.get('siteBytes') == BASELINE_BYTES and
            manifest.get('siteFilesSha256') == BASELINE_INVENTORY_SHA256, 'Accepted manifest site totals/hash mismatch')
    receipt = read_json(filename.with_name('public-bytes.json'))
    exact_identity(receipt, {'sourceCommit': BASELINE_SOURCE, 'publisherCommit': BASELINE_PUBLISHER,
                            'publicationRun': BASELINE_RUN, 'sourceReview': BASELINE_REVIEW}, 'Accepted public byte receipt')
    require(receipt.get('pass') is True and receipt.get('phase') == 'published' and
            type(receipt.get('checked')) is int and receipt['checked'] == BASELINE_COUNT and
            type(receipt.get('bytes')) is int and receipt['bytes'] == BASELINE_BYTES and
            receipt.get('siteFilesSha256') == BASELINE_INVENTORY_SHA256, 'Accepted public byte receipt incomplete')
    return manifest['siteFiles'], sha256_file(filename)


def tar_entries(archive):
    entries, total, root_seen = [], 0, False
    for entry in archive:
        require(entry.type in (tarfile.REGTYPE, tarfile.AREGTYPE, tarfile.DIRTYPE), 'Non-regular TAR member: ' + entry.name)
        integer(entry.size, 'TAR member size', maximum=MAX_BYTES)
        if entry.name in ('.', './'):
            require(entry.isdir() and not root_seen and entry.size == 0, 'Invalid/duplicate TAR root')
            root_seen = True
            continue
        name = safe_name(entry.name.rstrip('/') if entry.isdir() else entry.name)
        require(not entry.isdir() or entry.size == 0, 'TAR directory has file bytes')
        total += entry.size
        require(total <= MAX_BYTES, 'TAR exceeds byte limit')
        require(name != PREFIX[:-1] and not name.startswith(PREFIX), 'Native preview namespace already exists in TAR')
        entries.append((entry, name, entry.isdir()))
        require(len(entries) <= MAX_ENTRIES * 2, 'TAR has too many entries')
    archive_namespace(entries, 'TAR')
    return entries


def baseline(args):
    archive_file, proof, output = disjoint_roots(args.zip, args.accepted_proof, args.output)
    rows, manifest_hash = accepted_manifest(proof)
    archive_file = ordinary_file(archive_file)
    require(archive_file.stat().st_size == BASELINE_ARTIFACT['bytes'], 'Accepted Pages ZIP size mismatch')
    require(sha256_file(archive_file) == BASELINE_ARTIFACT['sha256'], 'Accepted Pages ZIP hash mismatch')
    require(not output.exists(), 'Refuse to overwrite a baseline directory')
    temporary = None
    try:
        with zipfile.ZipFile(archive_file) as archive:
            entries = zip_entries(archive, MAX_BYTES)
            files = [(entry, name) for entry, name, directory in entries if not directory]
            require(len(files) == 1 and files[0][1].endswith('.tar'), 'Accepted ZIP needs exactly one ordinary TAR')
            temporary = staging_directory(output)
            tar_path = temporary / 'archive.tar'
            with archive.open(files[0][0]) as source:
                stream_to_file(source, tar_path, files[0][0].file_size)
        site = temporary / 'site'
        with tarfile.open(tar_path, mode='r:') as archive:
            entries = tar_entries(archive)
            file_entries = [(entry, name) for entry, name, directory in entries if not directory]
            require(len(file_entries) == BASELINE_COUNT and sum(entry.size for entry, _ in file_entries) == BASELINE_BYTES,
                    'Accepted TAR file count/byte inventory mismatch')
            require({name: entry.size for entry, name in file_entries} == {row['path']: row['bytes'] for row in rows},
                    'Accepted TAR namespace differs from accepted proof')
            site.mkdir()
            for entry, name, directory in entries:
                destination = site / name
                if directory:
                    destination.mkdir(parents=True, exist_ok=True)
                else:
                    source = archive.extractfile(entry)
                    require(source is not None, 'Missing TAR file data')
                    with source:
                        stream_to_file(source, destination, entry.size)
        require(inventory(site) == rows, 'Accepted baseline bytes differ from accepted proof')
        site.rename(output)
        print(json.dumps({'pass': True, 'files': BASELINE_COUNT, 'bytes': BASELINE_BYTES,
                          'filesSha256': BASELINE_INVENTORY_SHA256, 'pagesArtifact': BASELINE_ARTIFACT,
                          'acceptedProofArtifact': ACCEPTED_PROOF_ARTIFACT, 'acceptedManifestSha256': manifest_hash}))
    finally:
        if temporary is not None:
            shutil.rmtree(temporary)


def preview_scope():
    return {'path': PREFIX, 'query': QUERY, 'storagePrefix': STORAGE_PREFIX, 'levels': [41],
            'ordinaryCastle': True, 'ratchetCell': False, 'saveIsolationAccepted': True}


def require_preview(value, label, include_acceptance=True):
    require(isinstance(value, dict), label + ' missing ordinary-preview scope')
    expected = preview_scope()
    if not include_acceptance:
        expected.pop('saveIsolationAccepted')
    for key, item in expected.items():
        require(type(value.get(key)) is type(item) and value.get(key) == item, label + ' scope mismatch: ' + key)
    require(all(type(level) is int for level in value['levels']), label + ' levels must be actual integers')


def unique_suffix(root, rows, suffix, label):
    matches = [row['path'] for row in rows if row['path'] == suffix or row['path'].endswith('/' + suffix)]
    require(len(matches) == 1, label + ' needs exactly one ' + suffix)
    return root / matches[0]


def preview_url(value, label):
    require(isinstance(value, str) and not any(ord(character) < 32 or ord(character) == 127 for character in value),
            label + ' needs an actual URL')
    parsed = urllib.parse.urlsplit(value)
    require(parsed.scheme in ('http', 'https') and parsed.hostname and parsed.username is None and parsed.password is None,
            label + ' needs an absolute HTTP(S) URL')
    # WHATWG URL origin comparison ignores an explicitly written default port.
    port = parsed.port
    origin = (parsed.scheme, parsed.hostname, port if port is not None else (443 if parsed.scheme == 'https' else 80))
    parsed = parsed._replace(path=parsed.path or '/')
    params = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
    return parsed, origin, params


def assert_preview_entry_navigation(isolation, snapshot_hash):
    player, player_origin, player_params = preview_url(isolation.get('playerURL'), 'Player entry')
    review, review_origin, review_params = preview_url(isolation.get('reviewURL'), 'Review entry')
    require(review_origin == player_origin and review.path == player.path, 'Review entry origin/path differs from player entry')
    def first(params, name):
        return next((value for key, value in params if key == name), None)
    for name, value in (('edition', 'foundation'), ('level', '41'), ('tower41preview', '1')):
        require(first(player_params, name) == value and first(review_params, name) == value,
                'Player/review ordinary preview flag mismatch: ' + name)
    require(not any(name in ('debug', 'smoke', 'tower41ratchet', 'pilot') for name, _ in player_params),
            'Player entry must omit debug, smoke, qualification and pilot flags')
    require(first(review_params, 'debug') == '1', 'Review entry must declare its debug observation flag')
    bare = isolation.get('bareEntry')
    if player.path not in NATIVE_ENTRY_PATHS:
        require(bare == BARE_ENTRY_NOT_APPLICABLE, 'A local-root review must use the exact explicit nonapplicable bare-entry object')
        require(type(bare.get('applicable')) is bool, 'Bare-entry applicability must be boolean')
        return
    require(isinstance(bare, dict) and bare.get('applicable') is True and bare.get('pass') is True,
            'A native namespace review requires actual successful bare-entry evidence')
    bare_url, bare_origin, _ = preview_url(bare.get('url'), 'Bare entry')
    require(bare_origin == player_origin and bare_url.path == player.path and bare_url.query == '' and bare_url.fragment == '' and
            bare.get('pathname') == bare_url.path and bare.get('search') == '', 'Bare entry must use the same path with no query or fragment')
    require(bare.get('state') == 'ready' and type(bare.get('level')) is int and bare['level'] == 41 and
            bare.get('preview') is True and bare.get('edition') == 'foundation', 'Bare entry did not open the private ready room 41')
    for name in ('startChoices', 'settingsChoices'):
        require(bare.get(name) == [40] and all(type(value) is int for value in bare[name]), 'Bare entry menu offers unrelated rooms')
    require(bare.get('editionNavigationPresent') is False and bare.get('editionNavigationAnchors') == [],
            'Bare entry exposes old edition navigation')
    for name in ('debugGameHook', 'debugPreferencesHook', 'ratchetHook'):
        require(bare.get(name) == 'undefined', 'Bare player entry exposes debug or qualification hooks')
    require(bare.get('oldBytesUnchanged') is True and bare.get('legacySnapshotSha256') == snapshot_hash and
            bare.get('ownKey') == STORAGE_PREFIX + 'brainrot-portal.preferences.v24', 'Bare entry changed prior saves or used another namespace')
    digest(bare.get('ownPreferencesSha256'), 'Bare private preferences hash')
    settings = bare.get('settings')
    require(isinstance(settings, dict) and settings.get('control') == 'native-menu-quality-select' and
            isinstance(settings.get('changedTo'), str) and isinstance(settings.get('restoredTo'), str) and
            settings['changedTo'] != settings['restoredTo'] and settings.get('ownQualityChanged') == settings['changedTo'] and
            settings.get('ownQualityRestored') == settings['restoredTo'], 'Bare native quality change and restoration were not observed')
    for name in ('beforeSha256', 'changedSha256', 'restoredSha256'):
        digest(settings.get(name), 'Bare private settings ' + name)
    require(settings['beforeSha256'] != settings['changedSha256'] and settings['beforeSha256'] == settings['restoredSha256'] and
            bare['ownPreferencesSha256'] == settings['restoredSha256'], 'Bare native settings did not change and restore actual private save bytes')


def assert_preview_save_isolation(isolation):
    require(isinstance(isolation, dict) and isolation.get('pass') is True, 'Preview save isolation did not pass')
    key = 'brainrot-portal.preferences.v24'
    prefixes = ['brainrot-foundation-v1:', 'brainrot-puzzle-pilot43-v1:', 'brainrot-puzzle-progression-v1:',
                'brainrot-puzzle-progression-next-v1:', 'brainrot-puzzle-progression-finale-v1:',
                'brainrot-tower41-ratchet-qualification-v1:', 'brainrot-tower41-native-v1:']
    require(isolation.get('namespace') == STORAGE_PREFIX and isolation.get('ownKey') == STORAGE_PREFIX + key and
            isolation.get('legacyPrefixes') == prefixes, 'Preview save namespaces changed')
    snapshot = isolation.get('legacySnapshot')
    require(isinstance(snapshot, dict) and all(isinstance(snapshot.get(prefix + key), str) for prefix in prefixes) and
            all(isinstance(name, str) and any(name.startswith(prefix) for prefix in prefixes) and isinstance(value, str)
                for name, value in snapshot.items()), 'Actual legacy save snapshot missing')
    snapshot_hash = hashlib.sha256(json.dumps(snapshot, ensure_ascii=False, separators=(',', ':')).encode('utf-8')).hexdigest()
    assert_preview_entry_navigation(isolation, snapshot_hash)
    phases = ['after-load', 'after-settings', 'after-play', 'after-pause', 'after-resume', 'after-win', 'after-replay', 'after-reload']
    states = ['ready', 'ready', 'playing', 'paused', 'playing', 'won', 'playing', 'ready']
    observed = isolation.get('phases')
    require(isinstance(observed, list) and len(observed) == len(phases), 'All eight save transitions are required')
    for i, phase in enumerate(observed):
        require(isinstance(phase, dict) and phase.get('phase') == phases[i] and phase.get('state') == states[i],
                'Preview save transition order/state mismatch')
        require(type(phase.get('level')) is int and phase['level'] == 41 and phase.get('preview') is True and
                phase.get('ratchetCell') is False, 'Save proof used the wrong room or qualification cell')
        for field in ('startChoices', 'settingsChoices'):
            require(phase.get(field) == [40] and all(type(value) is int for value in phase[field]), 'Preview menu offers unrelated rooms')
        require(phase.get('editionNavigationPresent') is False and phase.get('editionNavigationAnchors') == [],
                'Every observed preview phase must omit old edition navigation')
        require(phase.get('oldBytesUnchanged') is True and phase.get('namespaceUsed') is True and
                phase.get('legacySnapshotSha256') == snapshot_hash, 'A save transition changed prior save bytes')
        digest(phase.get('ownPreferencesSha256'), 'Own preview preferences hash')
        require(type(phase.get('ownResumeLevel')) is int and phase['ownResumeLevel'] == 40, 'Preview save resumed another room')
        completed = phase.get('ownCompleted')
        require(completed == ([] if i < 5 else [40]) and all(type(value) is int for value in completed), 'Preview completion leaked between namespaces')
    controls = isolation.get('controls')
    require(isinstance(controls, dict), 'Native save controls missing')
    settings = controls.get('settings', {})
    require(settings.get('control') == 'native-menu-quality-select' and
            isinstance(settings.get('changedTo'), str) and isinstance(settings.get('restoredTo'), str) and
            settings['changedTo'] != settings['restoredTo'] and observed[1].get('ownQuality') == settings['restoredTo'],
            'Actual native settings change/restore missing')
    pause = controls.get('pauseResume', {})
    require(pause.get('pass') is True and pause.get('pauseControl') == 'native-escape-or-hud' and
            pause.get('resumeControl') == 'focused-native-enter' and type(pause.get('pointerLockExitFallback')) is bool and
            pause.get('pausedState') == 'paused' and pause.get('resumedState') == 'playing', 'Native pause/resume proof missing')
    replay = controls.get('replay', {})
    require(replay.get('pass') is True and replay.get('button') == '#play-again-button' and
            isinstance(replay.get('label'), str) and 'Пройти ещё раз' in replay['label'] and
            type(replay.get('level')) is int and replay['level'] == 41 and replay.get('state') == 'playing' and
            replay.get('solved') == [] and replay.get('atSpawn') is True, 'Native replay did not reset room 41 at spawn')
    reload = controls.get('reload')
    require(reload == {'pass': True, 'state': 'ready', 'level': 41, 'completed': [40], 'resumeLevel': 40} and
            type(reload.get('level')) is int and type(reload.get('resumeLevel')) is int and
            all(type(value) is int for value in reload['completed']), 'Native reload did not retain own completion')
    return isolation


def assert_pendulum_physical_proof(proof, original_cargo_body_id):
    """Independently reject incomplete, stale or synthetic lower-catch witness schemas."""
    integer(original_cargo_body_id, 'Original cargo body ID')
    require(isinstance(proof, dict) and proof.get('physicalLowerCatch') is True and
            proof.get('upperCatchKinematic') is True and proof.get('originalCargo') is True and
            'twoPhysicalCatches' not in proof, 'Pendulum must declare only the lower catch physical')
    cell, crossing = proof.get('lowerPhysicalCell'), proof.get('lowerCrossing')
    require(isinstance(cell, dict) and isinstance(crossing, dict), 'Pendulum physical cell/crossing witnesses missing')
    def measured(value, label, positive=False):
        require(type(value) in (int, float) and math.isfinite(value) and (not positive or value > 0),
                'Pendulum needs a finite ' + ('positive ' if positive else '') + label)
        return value
    def vector(value, count, label):
        require(isinstance(value, list) and len(value) == count, 'Pendulum needs exact ' + label)
        for component in value:
            measured(component, label)
        return value
    def unique_ids(value, count, label):
        require(isinstance(value, list) and len(value) == count, 'Pendulum needs exact ' + label)
        for item in value:
            integer(item, label)
        require(len(set(value)) == count, 'Pendulum repeated ' + label)
        return value
    def quaternion(value, label):
        vector(value, 4, label)
        require(abs(sum(component * component for component in value) - 1) < 1e-5,
                'Pendulum non-normalized ' + label)
    def close_vector(actual, expected, label):
        require(len(actual) == len(expected) and all(abs(a - b) < 1e-5 for a, b in zip(actual, expected)),
                'Pendulum recorded support pose differs: ' + label)
    def rotate(value, orientation):
        x, y, z = value
        qx, qy, qz, qw = orientation
        tx, ty, tz = 2 * (qy * z - qz * y), 2 * (qz * x - qx * z), 2 * (qx * y - qy * x)
        return [x + qw * tx + qy * tz - qz * ty,
                y + qw * ty + qz * tx - qx * tz,
                z + qw * tz + qx * ty - qy * tx]
    for flag in ('ready', 'latched', 'catchArmed', 'bodiesPresent', 'constraintsPresent', 'originalCargoPresent',
                 'originalCargoIdentityValid', 'originalCargoFree', 'currentCollisionValid', 'unloadedRetained', 'readyForCrossing'):
        require(cell.get(flag) is True, 'Pendulum flag missing: ' + flag)
    for flag in ('disposed', 'loadContact', 'originalCargoRawContact'):
        require(cell.get(flag) is False, 'Pendulum invalid retained flag: ' + flag)
    require(cell.get('originalCargoClearedCup') is True, 'Pendulum original cargo has not cleared the cup')
    for key in ('loadNormalForce', 'loadContactCount', 'originalCargoRawContactCount'):
        require(type(cell.get(key)) in (int, float) and cell[key] == 0, 'Pendulum retains cargo contact: ' + key)
    integer(cell.get('worldStep'), 'Pendulum current step', 1)
    require(type(cell.get('contactStep')) is int and cell['contactStep'] == cell['worldStep'], 'Pendulum retention contacts are stale')
    integer(cell.get('loadedStep'), 'Pendulum loaded step', 1)
    integer(cell.get('loadedTicks'), 'Pendulum loaded ticks', 2)
    measured(cell.get('loadedNormalImpulse'), 'loaded normal impulse', True)
    measured(cell.get('lastLoadedNormalForce'), 'last loaded normal force', True)
    integer(cell.get('retainedStartStep'), 'Pendulum retained start step', 1)
    integer(cell.get('retainedTicks'), 'Pendulum retained ticks', 24)
    require(cell['loadedStep'] < cell['retainedStartStep'] and
            cell['retainedStartStep'] + cell['retainedTicks'] - 1 == cell['worldStep'], 'Pendulum unload retention interval is inconsistent')
    for key in ('pawlContactCount', 'seatContactCount'):
        integer(cell.get(key), 'Pendulum ' + key, 1)
    for key in ('pawlNormalForce', 'seatNormalForce'):
        measured(cell.get(key), key, True)
    measured(cell.get('angle'), 'bridge angle'); measured(cell.get('pawlAngle'), 'pawl angle')
    require(abs(cell['angle']) < .055 and abs(cell['pawlAngle']) < .07 and
            type(proof.get('lowerAngle')) in (int, float) and proof['lowerAngle'] == cell['angle'], 'Pendulum retained angles differ')
    upper = measured(proof.get('upperHeight'), 'upper height')
    require(5.78 < upper <= 6.01, 'Pendulum upper authored lift has not reached its catch')
    body_ids = unique_ids(cell.get('bodyIds'), 4, 'body IDs')
    unique_ids(cell.get('constraintIds'), 2, 'constraint IDs')
    require(cell.get('constraintEquationCounts') == [5, 5] and
            all(type(value) is int for value in cell['constraintEquationCounts']), 'Pendulum hinge equations differ')
    require(cell.get('constraintMotorEnabled') == [False, False] and
            all(type(value) is bool for value in cell['constraintMotorEnabled']) and
            cell.get('constraintMotorEquationPresent') == [False, False] and
            all(type(value) is bool for value in cell['constraintMotorEquationPresent']), 'Pendulum hinge motor or motor equation present')
    require(type(cell.get('originalCargoBodyId')) is int and cell['originalCargoBodyId'] == original_cargo_body_id and
            original_cargo_body_id not in body_ids, 'Pendulum original cargo identity differs from the full route')
    integer(cell.get('originalCargoShapeId'), 'Original cargo shape ID')
    for key in ('cupShapeId', 'deckShapeId', 'pawlShapeId', 'pawlHeelShapeId', 'seatBodyId', 'seatShapeId'):
        integer(cell.get(key), 'Pendulum ' + key)
    require(len({cell[key] for key in ('cupShapeId', 'deckShapeId', 'pawlShapeId', 'pawlHeelShapeId', 'seatShapeId')}) == 5 and
            cell['seatBodyId'] in body_ids, 'Pendulum support shape/body identities are ambiguous')
    for name in ('bridge', 'pawl'):
        body = cell.get(name); require(isinstance(body, dict), 'Pendulum missing ' + name + ' body')
        integer(body.get('id'), 'Pendulum ' + name + ' body ID')
        require(body['id'] in body_ids and type(body.get('type')) is int and body['type'] == 1,
                'Pendulum unowned or nondynamic ' + name + ' body')
        measured(body.get('mass'), name + ' mass', True)
        for field in ('position', 'velocity', 'angularVelocity', 'inertia'):
            vector(body.get(field), 3, name + ' ' + field)
        require(all(value > 0 for value in body['inertia']), 'Pendulum body inertia must be positive')
        body_orientation = vector(body.get('quaternion'), 4, name + ' quaternion')
        require(abs(sum(value * value for value in body_orientation) - 1) < 1e-5, 'Pendulum body quaternion is not normalized')
    require(cell['bridge']['id'] != cell['pawl']['id'] and abs(cell['bridge']['angularVelocity'][2]) < .10,
            'Pendulum retained bridge motion/identity is invalid')
    eccentric = vector(cell['bridge'].get('COMOffset'), 3, 'bridge eccentric centre of mass')
    require(math.hypot(*eccentric) > .1, 'Pendulum gravity requires a real eccentric centre of mass')
    loaded = cell.get('loadedWitness'); require(isinstance(loaded, dict), 'Pendulum loaded witnesses missing')
    for name in ('first', 'last'):
        witness = loaded.get(name); require(isinstance(witness, dict), 'Pendulum missing loaded ' + name)
        integer(witness.get('worldStep'), 'Pendulum loaded witness step', 1)
        for field, expected in (('originalCargoBodyId', original_cargo_body_id), ('originalCargoShapeId', cell['originalCargoShapeId']),
                                ('cupBodyId', cell['bridge']['id']), ('cupShapeId', cell['cupShapeId'])):
            require(type(witness.get(field)) is int and witness[field] == expected, 'Pendulum loaded witness identity differs: ' + field)
        measured(witness.get('normalForce'), 'loaded witness normal force', True)
        measured(witness.get('bridgeAngle'), 'loaded witness bridge angle')
        require(witness.get('freeOriginal') is True, 'Pendulum loaded witness used held or substituted cargo')
    require(loaded['first']['worldStep'] <= loaded['last']['worldStep'] and loaded['last']['worldStep'] == cell['loadedStep'] and
            type(loaded['last'].get('normalForce')) in (int, float) and loaded['last']['normalForce'] == cell['lastLoadedNormalForce'],
            'Pendulum last actual load witness differs')
    require(cell['loadedTicks'] <= loaded['last']['worldStep'] - loaded['first']['worldStep'] + 1,
            'Pendulum load ticks exceed distinct completed load steps')
    hand = cell.get('catchWitness'); require(isinstance(hand, dict), 'Pendulum native hand catch witness missing')
    integer(hand.get('worldStep'), 'Pendulum catch step', 1); integer(hand.get('handCount'), 'Pendulum catch hand count', 1)
    integer(cell.get('handCount'), 'Pendulum current hand count', 1)
    require(hand['handCount'] == cell['handCount'], 'Pendulum hand count differs')
    impulse = measured(hand.get('angularImpulse'), 'bounded native hand angular impulse')
    measured(cell.get('handAngularImpulse'), 'cell native hand angular impulse', True)
    require(impulse < 0 and abs(impulse) <= 1.2 and abs(impulse) == cell['handAngularImpulse'] and
            hand.get('action') == 'close' and hand.get('qualifiedLoad') is True and hand.get('loadContact') is True,
            'Pendulum catch was not closed under actual load with a bounded native impulse')
    integer(hand.get('loadedStep'), 'Pendulum catch loaded step', 1)
    require(type(hand.get('loadedAtStep')) is int and hand['loadedAtStep'] == hand['loadedStep'], 'Pendulum catch qualification step differs')
    measured(hand.get('loadNormalForce'), 'catch loaded normal force', True)
    for key, expected in (('originalCargoBodyId', original_cargo_body_id), ('originalCargoShapeId', cell['originalCargoShapeId']),
                          ('cupBodyId', cell['bridge']['id']), ('cupShapeId', cell['cupShapeId']), ('pawlBodyId', cell['pawl']['id'])):
        require(type(hand.get(key)) is int and hand[key] == expected, 'Pendulum catch exact identity differs: ' + key)
    before = measured(hand.get('angularMomentumBefore'), 'catch angular momentum before')
    after = measured(hand.get('angularMomentumAfter'), 'catch angular momentum after')
    require(abs(after - before - impulse) < 1e-7, 'Pendulum catch angular impulse did not produce the measured momentum change')
    require(loaded['first']['worldStep'] <= hand['loadedStep'] <= hand['worldStep'] <= cell['loadedStep'], 'Pendulum catch/load causal order differs')
    measured(hand.get('bridgeAngle'), 'native catch bridge angle')
    require(hand['loadedStep'] == hand['worldStep'] and hand['bridgeAngle'] < -.08,
            'Pendulum native catch needs current loaded contact and the qualified lowered angle')
    require(crossing.get('complete') is True, 'Pendulum actual supported crossing incomplete')
    integer(crossing.get('supportedDeckSteps'), 'Pendulum supported deck steps', 24)
    require(type(crossing.get('deckBodyId')) is int and crossing['deckBodyId'] == cell['bridge']['id'] and
            type(crossing.get('deckShapeIndex')) is int and crossing['deckShapeIndex'] == 0, 'Pendulum crossing support differs from actual deck')
    require(type(crossing.get('originalCargoBodyId')) is int and crossing['originalCargoBodyId'] == original_cargo_body_id,
            'Pendulum crossing substituted the original cargo')
    steps = [integer(crossing.get(key), 'Pendulum crossing ' + key, 1)
             for key in ('nearLandingStep', 'firstStep', 'midStep', 'farStep', 'islandStep')]
    require(steps[0] >= cell['retainedStartStep'] + 23 and all(step <= cell['worldStep'] for step in steps) and
            all(steps[index] > steps[index - 1] for index in range(1, len(steps))), 'Pendulum unloaded supported crossing order differs')
    require(crossing['supportedDeckSteps'] <= crossing['islandStep'] - crossing['firstStep'],
            'Pendulum support ticks exceed distinct completed traversal steps')
    witnesses = crossing.get('checkpoints')
    require(isinstance(witnesses, list) and [w.get('name') for w in witnesses] == ['near', 'mid', 'far', 'island'],
            'Pendulum exact near/mid/far/island support witnesses missing')
    def support_witness(witness):
        require(isinstance(witness, dict) and all(witness.get(flag) is True for flag in ('grounded', 'live', 'footprintInside')),
                'Pendulum crossing support is stale or airborne')
        for key in ('foot', 'velocity', 'supportNormal', 'bodyPosition', 'shapeHalf'):
            vector(witness.get(key), 3, 'support ' + key)
        vector(witness.get('bodyQuaternion'), 4, 'support body quaternion')
        require(all(value > 0 for value in witness['shapeHalf']), 'Pendulum support half extents must be positive')
        height = measured(witness.get('supportHeight'), 'current support height')
        gap = measured(witness.get('supportGap'), 'current support gap')
        require(abs(gap) < .003 and abs(witness['foot'][1] - height - gap) < 1e-7 and witness['supportNormal'][1] > .65,
                'Pendulum current support gap/normal differs')
        for key in ('bodyId', 'shapeId', 'shapeIndex'):
            integer(witness.get(key), 'Pendulum support ' + key)
        require(isinstance(witness.get('colliderId'), str) and witness['colliderId'], 'Pendulum current support collider ID missing')
    def founded_witness(witness):
        require(witness.get('kind') == 'founded-floor' and witness['bodyId'] not in body_ids and witness['shapeIndex'] == 0,
                'Pendulum landing must be a separately founded floor')
        quaternion(witness['bodyQuaternion'], 'founded floor quaternion')
        close_vector(witness['bodyQuaternion'], [0, 0, 0, 1], 'founded floor identity orientation')
        bounds = witness.get('bounds')
        require(isinstance(bounds, list) and len(bounds) == 2, 'Pendulum founded floor bounds missing')
        for bound in bounds:
            vector(bound, 3, 'founded floor bound')
        close_vector([(lower + upper) / 2 for lower, upper in zip(*bounds)], witness['bodyPosition'], 'founded floor centre')
        close_vector([(upper - lower) / 2 for lower, upper in zip(*bounds)], witness['shapeHalf'], 'founded floor half extents')
        close_vector(witness['supportNormal'], [0, 1, 0], 'founded floor current support normal')
        require(bounds[0][0] + .43 <= witness['foot'][0] <= bounds[1][0] - .43 and
                bounds[0][2] + .43 <= witness['foot'][2] <= bounds[1][2] - .43 and
                abs(witness['supportHeight'] - bounds[1][1]) < .003, 'Pendulum capsule is outside its founded supporting floor')
    landing = crossing.get('nearLanding'); support_witness(landing)
    require(type(landing.get('worldStep')) is int and landing['worldStep'] == steps[0] and landing.get('kind') == 'founded-floor' and
            landing['bodyId'] not in body_ids, 'Pendulum initial landing must be a separately founded floor')
    founded_witness(landing)
    for index, witness in enumerate(witnesses):
        support_witness(witness)
        require(type(witness.get('worldStep')) is int and witness['worldStep'] == steps[index + 1], 'Pendulum crossing support witness step differs')
        if index < 3:
            require(witness.get('kind') == 'owned-oriented-deck' and witness.get('capsuleGrounded') is True and
                    type(witness.get('originalCargoBodyId')) is int and witness['originalCargoBodyId'] == original_cargo_body_id and
                    witness['bodyId'] == cell['bridge']['id'] and witness['shapeId'] == cell['deckShapeId'] and
                    witness['shapeIndex'] == 0, 'Pendulum crossing witness used another supporting object')
            local = vector(witness.get('localFoot'), 3, 'crossing local foot')
            vector(witness.get('shapeOffset'), 3, 'crossing shape offset')
            require(witness['shapeHalf'] == [6, .2, 2] and abs(local[2]) < 2 - .43 and abs(local[0]) < 6 - .43 and
                    abs(local[1] - .2) < .003, 'Pendulum capsule was outside the actual deck face')
            pose = witness.get('pose'); require(isinstance(pose, dict), 'Pendulum current collision pose missing')
            vector(pose.get('center'), 3, 'current deck collision centre'); vector(pose.get('quaternion'), 4, 'current deck collision quaternion')
            require(type(pose.get('step')) is int and pose['step'] == witness['worldStep'], 'Pendulum deck collision pose is stale')
            quaternion(witness['bodyQuaternion'], 'deck body quaternion'); quaternion(pose['quaternion'], 'deck collision quaternion')
            close_vector(pose['quaternion'], witness['bodyQuaternion'], 'deck body/collision orientation')
            close_vector([value + origin for value, origin in zip(rotate(witness['shapeOffset'], witness['bodyQuaternion']), witness['bodyPosition'])],
                         pose['center'], 'actual deck shape centre')
            close_vector([value + origin for value, origin in zip(rotate(local, pose['quaternion']), pose['center'])], witness['foot'], 'actual deck foot')
            close_vector(rotate([0, 1, 0], pose['quaternion']), witness['supportNormal'], 'actual deck support normal')
            axes = [rotate(axis, pose['quaternion']) for axis in ([1, 0, 0], [0, 1, 0], [0, 0, 1])]
            extents = [sum(abs(axis[index]) * witness['shapeHalf'][axis_index] for axis_index, axis in enumerate(axes))
                       for index in range(3)]
            bounds = pose.get('bounds')
            require(isinstance(bounds, list) and len(bounds) == 2, 'Pendulum current rotated deck bounds missing')
            for bound in bounds:
                vector(bound, 3, 'rotated current deck bound')
            close_vector(bounds[0], [centre - extent for centre, extent in zip(pose['center'], extents)], 'current deck minimum bound')
            close_vector(bounds[1], [centre + extent for centre, extent in zip(pose['center'], extents)], 'current deck maximum bound')
        else:
            founded_witness(witness)
    require(witnesses[0]['localFoot'][0] <= -3 and witnesses[1]['localFoot'][0] >= -.9 and witnesses[2]['localFoot'][0] >= 3,
            'Pendulum near/middle/far crossing geometry differs')
    return {'pass': True, 'originalCargoBodyId': original_cargo_body_id, 'loadedStep': cell['loadedStep'],
            'retainedStartStep': cell['retainedStartStep'], 'currentStep': cell['worldStep'],
            'supportedDeckSteps': crossing['supportedDeckSteps'], 'islandStep': crossing['islandStep'],
            'physicalLowerCatch': True, 'upperCatchKinematic': True}


def pendulum_event(evidence):
    require(isinstance(evidence, dict) and isinstance(evidence.get('observed'), dict), 'Pendulum route observations missing')
    observed = evidence['observed']; events = observed.get('events')
    require(isinstance(events, list), 'Pendulum route event list missing')
    matching = [event for event in events if isinstance(event, dict) and event.get('id') == 'pendulum']
    require(len(matching) == 1, 'Pendulum requires exactly one completed full-route event')
    return assert_pendulum_physical_proof(matching[0].get('proof'), observed.get('bodyId'))


def binding_structure(binding, expected):
    exact_identity(binding, expected, 'Package binding')
    require(type(binding.get('schemaVersion')) is int and binding['schemaVersion'] == 1 and
            binding.get('kind') == 'tower41-native-exact-review', 'Package binding schema/kind mismatch')
    require_preview(binding.get('preview'), 'Package binding')
    assert_preview_save_isolation(binding.get('previewSaveIsolation'))
    bare = binding['previewSaveIsolation'].get('bareEntry')
    require(isinstance(bare, dict) and bare.get('applicable') is True and bare.get('pass') is True,
            'Publication binding requires an actual native namespace bare-entry observation')
    artifacts = binding.get('artifacts')
    require(isinstance(artifacts, dict) and set(artifacts) == set(ARTIFACT_NAMES), 'Exactly six exact-review artifacts are required')
    ids = set()
    review = expected['sourceReview']
    for key, suffix in ARTIFACT_NAMES.items():
        artifact = artifacts[key]
        require(isinstance(artifact, dict) and set(artifact) >= {'id', 'name', 'size_in_bytes', 'digest', 'workflow_run', 'files'},
                'Incomplete artifact provider metadata')
        artifact_id = integer(artifact['id'], key + ' artifact ID', 1)
        require(artifact_id not in ids, 'Duplicate artifact provider ID')
        ids.add(artifact_id)
        integer(artifact['size_in_bytes'], key + ' artifact bytes', 1, MAX_BYTES)
        require(isinstance(artifact['digest'], str) and re.fullmatch(r'sha256:[0-9a-f]{64}', artifact['digest']), 'Artifact digest missing')
        require(artifact['name'] == f'tower41-next-cell-{suffix}-{review["runId"]}-{review["runAttempt"]}', 'Stale artifact name: ' + key)
        workflow = artifact['workflow_run']
        require(isinstance(workflow, dict) and type(workflow.get('id')) is int and workflow['id'] == review['runId'] and
                workflow.get('head_sha') == expected['sourceCommit'], 'Stale artifact provider workflow identity: ' + key)
        checked_rows(artifact['files'], key + ' artifact inventory', MAX_CANDIDATE_BYTES if key == 'build' else MAX_BYTES)
    jobs = binding.get('jobs')
    require(isinstance(jobs, list) and len(jobs) == len(JOB_NAMES), 'Exactly five successful review jobs required')
    names, job_ids, logs = set(), set(), set()
    for job in jobs:
        require(isinstance(job, dict) and job.get('name') in JOB_NAMES and job['name'] not in names and
                job.get('conclusion') == 'success', 'Missing/duplicate/unsuccessful review job')
        names.add(job['name'])
        job_id = integer(job.get('id'), 'Review job ID', 1)
        require(job_id not in job_ids, 'Duplicate review job ID')
        job_ids.add(job_id)
        row = job.get('rawLog')
        require(isinstance(row, dict) and set(row) == {'path', 'bytes', 'sha256'}, 'Raw provider log metadata missing')
        name = safe_name(row['path'])
        require(name == row['path'] and name not in logs and not name.startswith('review-artifacts/') and
                name not in ('manifest.json', 'baseline-manifest.json', 'package-binding.json'), 'Raw log path collides with proof')
        logs.add(name)
        integer(row['bytes'], 'Raw log size', 1, MAX_CANDIDATE_BYTES)
        digest(row['sha256'], 'Raw log hash')
    supplemental_structure(binding, expected)
    return artifacts


def positive_number(value, label):
    require(type(value) in (int, float) and math.isfinite(value) and value > 0, label + ' must be finite and positive')
    return value


def supplemental_structure(binding, expected):
    supplemental = binding.get('supplemental')
    require(isinstance(supplemental, dict) and set(supplemental) == {'reviewedFiles', 'recording'}, 'Exact supplemental recording binding required')
    files = supplemental.get('reviewedFiles')
    require(isinstance(files, list) and len(files) == 2, 'Exactly two copied native recording files are required')
    source_expected = {key: expected[key] for key in ('sourceCommit', 'sourceReview')}
    destinations, sources = set(), set()
    artifact_rows = checked_rows(binding.get('artifacts', {}).get('nativeCastle', {}).get('files'), 'Supplemental source artifact')
    for copied in files:
        require(isinstance(copied, dict) and set(copied) == {'sourceArtifact', 'sourcePath', 'path', 'bytes', 'sha256', 'sourceCommit', 'sourceReview'},
                'Invalid supplemental copied-file binding')
        exact_identity(copied, source_expected, 'Supplemental copied file')
        require(copied.get('sourceArtifact') == 'nativeCastle', 'Supplemental copy must use the exact reviewed ordinary castle artifact')
        source_path = safe_name(copied.get('sourcePath'))
        target_path = safe_name(copied.get('path'))
        require(source_path == copied['sourcePath'] and target_path == copied['path'] and
                target_path in (SUPPLEMENTAL_VIDEO, SUPPLEMENTAL_REPORT), 'Supplemental copy escaped its assigned evidence path')
        require(target_path not in destinations and source_path not in sources, 'Duplicate supplemental copied path')
        destinations.add(target_path)
        sources.add(source_path)
        integer(copied.get('bytes'), 'Supplemental copied bytes', 1, MAX_CANDIDATE_BYTES)
        digest(copied.get('sha256'), 'Supplemental copied hash')
        require(artifact_rows.get(source_path) == {key: copied[key] for key in ('bytes', 'sha256')} | {'path': source_path},
                'Supplemental copy differs from exact reviewed artifact inventory')
    require(destinations == {SUPPLEMENTAL_VIDEO, SUPPLEMENTAL_REPORT}, 'Supplemental movie/report targets mismatch')
    recording = supplemental.get('recording')
    require(isinstance(recording, dict) and set(recording) == {'sourceCommit', 'sourceReview', 'filename', 'report', 'bytes', 'sha256',
                                                            'frames', 'fps', 'width', 'height', 'durationSeconds', 'simulationSeconds'},
            'Exact recording identity and measured fields are required')
    exact_identity(recording, source_expected, 'Supplemental recording')
    require(recording.get('filename') == SUPPLEMENTAL_VIDEO and recording.get('report') == SUPPLEMENTAL_REPORT, 'Supplemental recording target mismatch')
    movie = next(row for row in files if row['path'] == SUPPLEMENTAL_VIDEO)
    require(type(recording.get('bytes')) is int and recording['bytes'] == movie['bytes'] and recording.get('sha256') == movie['sha256'],
            'Supplemental recording bytes/hash differ from reviewed movie')
    integer(recording.get('frames'), 'Recording frames', 1)
    require(type(recording.get('fps')) is int and recording['fps'] == 4 and
            type(recording.get('width')) is int and recording['width'] == 640 and
            type(recording.get('height')) is int and recording['height'] == 360, 'Recording capture must retain reviewed 4 fps / 640×360')
    duration = positive_number(recording.get('durationSeconds'), 'Recording duration')
    simulation = positive_number(recording.get('simulationSeconds'), 'Recording simulation duration')
    require(abs(duration - recording['frames'] / recording['fps']) < 1e-6, 'Recording duration differs from actual encoded frames')
    require(abs(duration - simulation) <= 2 / recording['fps'] + 1 / 120 + .01, 'Recording duration differs from actual simulation time')
    candidate = checked_rows(binding.get('artifacts', {}).get('build', {}).get('files'), 'Supplemental candidate inventory')
    for target in SUPPLEMENTAL_TARGETS:
        require(all(target != name and not target.startswith(name + '/') and not name.startswith(target + '/') for name in candidate),
                'Candidate collides with supplemental publication path: ' + target)
    return supplemental


def supplemental_copied_rows(binding):
    return sorted([{'path': PREFIX + copied['path'], 'bytes': copied['bytes'], 'sha256': copied['sha256']}
                   for copied in binding['supplemental']['reviewedFiles']], key=lambda row: row['path'])


def check_supplemental_evidence(binding, proof, castle_evidence, castle_receipt, expected):
    supplemental = supplemental_structure(binding, expected)
    source_root = ordinary_directory(proof / 'review-artifacts/native-castle')
    files = {copied['path']: copied for copied in supplemental['reviewedFiles']}
    video, report = files[SUPPLEMENTAL_VIDEO], files[SUPPLEMENTAL_REPORT]
    evidence_path = unique_suffix(source_root, binding['artifacts']['nativeCastle']['files'], 'evidence.json', 'Supplemental report')
    require(report['sourcePath'] == evidence_path.relative_to(source_root).as_posix(), 'Copied supplemental report is not the actual native evidence')
    source_video = castle_evidence.get('video')
    require(isinstance(source_video, dict) and isinstance(source_video.get('filename'), str), 'Actual native movie metadata missing')
    original_name = safe_name(source_video['filename'])
    require(original_name == source_video['filename'] and '/' not in original_name, 'Actual native movie must retain its original filename')
    require(video['sourcePath'] == original_name, 'Copied movie is not the native evidence movie')
    for copied in (video, report):
        source = ordinary_file(source_root / copied['sourcePath'])
        require(source.stat().st_size == copied['bytes'] and sha256_file(source) == copied['sha256'], 'Supplemental source bytes changed after review')
    require(video['sha256'] == source_video.get('sha256') and report['sha256'] == castle_receipt.get('evidenceSha256'),
            'Supplemental movie/report hashes differ from native receipt')
    recording = supplemental['recording']
    for key in ('frames', 'fps', 'width', 'height', 'durationSeconds', 'simulationSeconds'):
        require(type(source_video.get(key)) in (int, float) and source_video[key] == recording[key], 'Supplemental recording relabels native ' + key)
    native_video = castle_receipt.get('video')
    require(isinstance(native_video, dict) and native_video.get('file') == original_name and
            type(native_video.get('bytes')) is int and native_video['bytes'] == video['bytes'] and
            native_video.get('sha256') == video['sha256'] and native_video.get('fullMP4Decode') is True,
            'Copied native movie lacks the retained full-decode receipt')
    require(source_video.get('first', {}).get('state') == 'playing' and source_video.get('first', {}).get('solved') == [] and
            source_video.get('last', {}).get('state') == 'won', 'Supplemental movie must cover actual initial play through victory')
    result = castle_evidence.get('result', {})
    require(result.get('pass') is True and result.get('sameCompanion') is True and
            result.get('metrics', {}).get('won') is True and type(result.get('metrics', {}).get('completedStages')) is int and
            result['metrics']['completedStages'] == 11, 'Supplemental recording lacks the current eleven-mechanism victory')
    for key in ('resets', 'respawns', 'cargoResets'):
        require(type(result.get(key)) is int and result[key] == 0, 'Supplemental ordinary movie includes resets/respawns')
    require(type(castle_evidence.get('observed', {}).get('seenResets')) is int and castle_evidence['observed']['seenResets'] == 0 and
            castle_evidence.get('errors') == [], 'Supplemental route contains observed resets or browser errors')
    return supplemental


def check_binding(binding, proof, candidate, expected):
    binding_structure(binding, expected)
    artifacts = binding.get('artifacts')
    require(isinstance(artifacts, dict) and set(artifacts) == set(ARTIFACT_NAMES), 'Exactly six exact-review artifacts are required')
    ids, inventory_hashes = set(), {}
    for key, suffix in ARTIFACT_NAMES.items():
        artifact = artifacts[key]
        require(isinstance(artifact, dict), 'Artifact metadata must be an object')
        require(set(artifact) >= {'id', 'name', 'size_in_bytes', 'digest', 'workflow_run', 'files'}, 'Incomplete artifact provider metadata')
        artifact_id = integer(artifact['id'], key + ' artifact ID', 1)
        require(artifact_id not in ids, 'Duplicate artifact provider ID')
        ids.add(artifact_id)
        integer(artifact['size_in_bytes'], key + ' artifact bytes', 1, MAX_BYTES)
        require(isinstance(artifact['digest'], str) and re.fullmatch(r'sha256:[0-9a-f]{64}', artifact['digest']),
                key + ' artifact provider digest missing')
        review = expected['sourceReview']
        require(artifact['name'] == f'tower41-next-cell-{suffix}-{review["runId"]}-{review["runAttempt"]}', 'Stale artifact name: ' + key)
        workflow = artifact['workflow_run']
        require(isinstance(workflow, dict) and type(workflow.get('id')) is int and workflow['id'] == review['runId'] and
                workflow.get('head_sha') == expected['sourceCommit'], 'Stale artifact provider workflow identity: ' + key)
        artifact_rows = artifact['files']
        checked_rows(artifact_rows, key + ' artifact inventory', MAX_CANDIDATE_BYTES if key == 'build' else MAX_BYTES)
        root = candidate if key == 'build' else proof / 'review-artifacts' / ARTIFACT_NAMES[key]
        require(inventory(root, MAX_CANDIDATE_BYTES if key == 'build' else MAX_BYTES) == artifact_rows,
                'Persisted artifact bytes differ from binding: ' + key)
        inventory_hashes[key] = inventory_sha256(artifact_rows)
    jobs = binding.get('jobs')
    require(isinstance(jobs, list) and len(jobs) == len(JOB_NAMES), 'Exactly five successful review jobs required')
    names, job_ids, log_paths = set(), set(), set()
    for job in jobs:
        require(isinstance(job, dict) and job.get('name') in JOB_NAMES and job.get('name') not in names and
                job.get('conclusion') == 'success', 'Missing/duplicate/unsuccessful review job')
        names.add(job['name'])
        job_id = integer(job.get('id'), 'Review job ID', 1)
        require(job_id not in job_ids, 'Duplicate review job ID')
        job_ids.add(job_id)
        row = job.get('rawLog')
        require(isinstance(row, dict) and set(row) == {'path', 'bytes', 'sha256'}, 'A retained raw provider log is required')
        name = safe_name(row['path'])
        require(name == row['path'] and name not in log_paths, 'Duplicate/noncanonical raw-log path')
        require(not name.startswith('review-artifacts/') and name not in ('manifest.json', 'baseline-manifest.json', 'package-binding.json'),
                'Raw log path collides with proof data')
        log_paths.add(name)
        size = integer(row['bytes'], 'Raw log size', 1, MAX_CANDIDATE_BYTES)
        digest(row['sha256'], 'Raw log hash')
        filename = ordinary_file(proof / name)
        require(filename.stat().st_size == size and sha256_file(filename) == row['sha256'], 'Retained raw provider log changed')
    require(names == set(JOB_NAMES), 'Exact required job set mismatch')
    source_expected = {key: expected[key] for key in ('sourceCommit', 'sourceReview')}
    evidence_paths = {'source': ('source.json', 'package.json'), 'cpu': ('report.json',),
                      'nativeContact': ('binding.json',), 'nativeCastle': ('binding.json', 'evidence.json', 'served-package.json'),
                      'summary': ('jobs.json',)}
    receipts = {}
    for key, suffixes in evidence_paths.items():
        root = proof / 'review-artifacts' / ARTIFACT_NAMES[key]
        for suffix in suffixes:
            filename = unique_suffix(root, artifacts[key]['files'], suffix, key)
            receipt = read_json(filename)
            if key == 'nativeCastle' and suffix == 'evidence.json':
                require(isinstance(receipt, dict) and receipt.get('sourceCommit') == expected['sourceCommit'], 'Castle evidence stale source')
            else:
                exact_identity(receipt, source_expected, key + '/' + suffix)
            receipts[key + '/' + suffix] = receipt
    for key in ('cpu/report.json', 'nativeContact/binding.json', 'nativeCastle/binding.json'):
        require(receipts[key].get('pass') is True, 'Reviewed evidence did not pass: ' + key)
    castle = receipts['nativeCastle/binding.json']
    require(type(castle.get('mechanisms')) is int and castle['mechanisms'] == 11 and
            castle.get('sameCargo') is True and type(castle.get('resets')) is int and castle['resets'] == 0,
            'Ordinary eleven-mechanism castle proof missing')
    castle_evidence = receipts['nativeCastle/evidence.json']
    pendulum = pendulum_event(castle_evidence)
    require(castle.get('pendulum') == pendulum and binding.get('pendulum') == pendulum, 'Pendulum binding differs from the exact physical witness')
    served = receipts['nativeCastle/served-package.json']
    require(served.get('pass') is True and served.get('files') == artifacts['build']['files'],
            'Native castle served package differs from the complete exact reviewed build')
    require(castle_evidence.get('previewSaveIsolation') == binding['previewSaveIsolation'], 'Save proof differs from exact reviewed native evidence')
    evidence_path = unique_suffix(proof / 'review-artifacts/native-castle', artifacts['nativeCastle']['files'], 'evidence.json', 'Castle')
    require(castle.get('evidenceSha256') == sha256_file(evidence_path), 'Castle binding differs from native evidence bytes')
    require(castle.get('previewSaveIsolation') == {'pass': True, 'namespace': STORAGE_PREFIX, 'oldBytesUnchanged': True,
                                                  'phases': 8, 'replayLevel': 41}, 'Castle save summary differs from reviewed proof')
    summary = receipts['summary/jobs.json']
    require(summary.get('allRequiredJobsPassed') is True and summary.get('jobs') ==
            {name: 'success' for name in JOB_NAMES if name != 'review-summary'}, 'Summary did not accept exact four upstream jobs')
    info = read_json(candidate / 'build-info.json')
    require(info.get('commit') == expected['sourceCommit'] and info.get('publisherCommit', 'missing') is None,
            'Reviewed build source/publisher stamp changed')
    require(info.get('gameCommit') == expected['sourceCommit'] and info.get('interfaceCommit') == expected['sourceCommit'] and
            info.get('run') == str(expected['sourceReview']['runId']), 'Reviewed build source/run mismatch')
    require(info.get('version') == 'v54-unified-campaign' and type(info.get('levels')) is int and info['levels'] == 51 and
            info.get('verified') is False and info.get('status') == 'technical-candidate', 'Reviewed build technical scope mismatch')
    tower = info.get('features', {}).get('tower', {})
    require(type(tower.get('stages')) is int and tower['stages'] == 11 and tower.get('checkpoints') is False,
            'Reviewed ordinary castle scope mismatch')
    if 'tower41NativePreview' in info.get('features', {}):
        require_preview(info['features']['tower41NativePreview'], 'Reviewed build', include_acceptance=False)
        require(info['features']['tower41NativePreview'].get('optIn') is True, 'Reviewed preview must be opt-in')
    require(castle.get('buildInfoSha256') == sha256_file(candidate / 'build-info.json') and
            receipts['source/package.json'].get('buildInfoSha256') == castle['buildInfoSha256'], 'Reviewed build metadata differs between jobs')
    check_supplemental_evidence(binding, proof, castle_evidence, castle, expected)
    require((candidate / 'index.html').is_file(), 'Reviewed package has no index.html')
    require(not (candidate / 'preview-status.json').exists(), 'Candidate collides with generated preview status')
    require(set(artifacts['build']['files'][0]) == {'path', 'bytes', 'sha256'}, 'Invalid candidate inventory')
    return inventory_hashes


def status_record(expected, binding):
    return {'schemaVersion': 1, **expected, 'path': PREFIX, 'query': QUERY, 'storagePrefix': STORAGE_PREFIX,
            'levels': [41], 'ordinaryCastle': True, 'ratchetCell': False, 'optIn': True,
            'appendOnly': True, 'mainSiteUnchanged': True, 'baselinePublicationRun': BASELINE_RUN,
            'mechanisms': 11, 'technicalAcceptance': True, 'saveIsolationAccepted': True,
            'masterSpecComplete': False, 'replacement500StageTowerAccepted': False,
            'humanPlaytestAccepted': False, 'physicalDeviceAccepted': False, 'fullCameraAccepted': False,
            'nativeEscapeAccepted': False, 'firstVisitSettingsMigrationAccepted': False,
            'classicSaveIsolationObserved': False,
            'saveIsolationScope': 'Seven snapshotted existing save namespaces remained byte-identical through eight observed load, settings, play, pause, resume, win, replay and reload phases. The preview preference key was seeded before loading.',
            'pauseScope': 'Observed native pause/resume controls; pointer-lock exit fallback may initiate auto-pause.',
            'sourcePackageFilesSha256': inventory_sha256(binding['artifacts']['build']['files']),
            'walkthroughs': 'walkthroughs.html',
            'currentWalkthrough': {**binding['supplemental']['recording'], 'identity': SUPPLEMENTAL_IDENTITY},
            'supplementalNamespaceOnly': True,
            'scope': 'Exact reviewed ordinary eleven-mechanism room 41 preview; technical review only.'}


def walkthrough_identity(expected, binding):
    files = {row['path']: row for row in binding['supplemental']['reviewedFiles']}
    return {'schemaVersion': 1, **expected, 'level': 41,
            'recording': binding['supplemental']['recording'],
            'report': {'filename': SUPPLEMENTAL_REPORT, 'bytes': files[SUPPLEMENTAL_REPORT]['bytes'],
                       'sha256': files[SUPPLEMENTAL_REPORT]['sha256']},
            'copiedFromExactReviewedArtifact': True, 'automaticContinuousRoute': True,
            'mechanisms': 11, 'humanPlaytestAccepted': False, 'physicalDeviceAccepted': False,
            'fullCameraAccepted': False, 'replacement500StageTowerAccepted': False,
            'minimum15MinuteSpeedrunAccepted': False,
            'scope': 'One continuous automated ordinary-input route through the current eleven-mechanism castle, using the reviewed movie and report bytes. No acceptance of human discovery, all-camera framing, physical devices, a replacement 500-stage tower or a 15-minute speedrun.'}


def walkthrough_html(expected, binding):
    recording = binding['supplemental']['recording']
    seconds = recording['durationSeconds']
    duration = f'{int(seconds // 60)}:{int(seconds % 60):02d}'
    play = html.escape('./' + QUERY, quote=True)
    review = expected['sourceReview']
    return f'''<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; media-src 'self'; base-uri 'none'; form-action 'none'">
<title>Прохождение уровня 41 · Замок</title>
<style>
*{{box-sizing:border-box}}body{{margin:0;background:#0a111d;color:#edf3ff;font:16px/1.6 system-ui,-apple-system,sans-serif}}
main{{max-width:1100px;margin:auto;padding:48px 24px 64px}}header{{display:flex;gap:24px;align-items:center;justify-content:space-between;margin-bottom:28px}}
.eyebrow{{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#a4badc;margin:0 0 8px}}h1{{font-size:clamp(28px,5vw,46px);line-height:1.12;margin:0;font-weight:750}}
.button{{display:inline-block;background:#f0b984;color:#152032;font-weight:750;padding:12px 20px;border-radius:12px;text-decoration:none;white-space:nowrap}}
.panel{{border:1px solid #2b3c56;border-radius:20px;overflow:hidden;background:#121e30;box-shadow:0 20px 80px #0005}}video{{display:block;width:100%;height:auto;background:#060b12;aspect-ratio:16/9}}
.description{{padding:24px 28px}}h2{{font-size:20px;margin:0 0 10px}}p{{margin:0 0 14px;color:#becbe0}}.facts{{display:flex;gap:12px;flex-wrap:wrap;margin:0 0 22px}}
.facts span{{padding:6px 12px;border-radius:99px;background:#1f304a;color:#dce8fa;font-size:14px}}.scope{{border-left:3px solid #d4a27b;padding-left:16px;color:#b8c4d9}}
.links{{display:flex;gap:20px;flex-wrap:wrap;margin-top:22px}}a{{color:#a9caff}}a:focus-visible{{outline:3px solid #f0b984;outline-offset:5px}}details{{margin-top:26px;color:#9aacc7;font-size:13px}}summary{{cursor:pointer}}code{{overflow-wrap:anywhere}}
@media(max-width:640px){{main{{padding:28px 16px 40px}}header{{align-items:flex-start;flex-direction:column}}.description{{padding:20px}}.button{{width:100%;text-align:center}}}}
</style>
</head>
<body><main>
<header><div><p class="eyebrow">Брейнрот Портал · Уровень 41</p><h1>Прохождение замка</h1></div><a class="button" href="{play}">Играть в уровень 41</a></header>
<section class="panel" aria-labelledby="walkthrough-title">
<video controls preload="metadata" playsinline width="{recording['width']}" height="{recording['height']}" aria-label="Автоматическая непрерывная запись прохождения уровня 41">
<source src="{SUPPLEMENTAL_VIDEO}" type="video/mp4"><a href="{SUPPLEMENTAL_VIDEO}">Открыть запись прохождения</a>
</video>
<div class="description"><h2 id="walkthrough-title">Текущий замок: 11 механизмов</h2>
<div class="facts"><span>Уровень 41</span><span>{duration}</span><span>{recording['width']} × {recording['height']}</span><span>{recording['fps']} кадра/с</span></div>
<p>Непрерывное автоматическое прохождение обычными игровыми действиями: от начала попытки до победы, с тем же Брейнротом и без сбросов.</p>
<p class="scope">Это техническая запись текущего замка из 11 механизмов. Она не подтверждает новую башню на 500 этапов, минимум 15 минут спидрана, прохождение человеком, работу на физическом устройстве или качество камеры во всех ситуациях.</p>
<div class="links"><a href="{SUPPLEMENTAL_VIDEO}" download>Скачать видео</a><a href="{SUPPLEMENTAL_REPORT}">Отчёт исходной записи</a><a href="{SUPPLEMENTAL_IDENTITY}">Данные проверки записи</a></div>
<details><summary>Версия и проверка</summary><p>Исходный код: <code>{expected['sourceCommit']}</code><br>Проверка: {review['runId']}, попытка {review['runAttempt']}<br>SHA-256 видео: <code>{recording['sha256']}</code></p></details>
</div></section>
</main></body></html>
'''.encode('utf-8')


def generated_content(expected, binding):
    return {'preview-status.json': json_bytes(status_record(expected, binding)),
            'walkthroughs.html': walkthrough_html(expected, binding),
            SUPPLEMENTAL_IDENTITY: json_bytes(walkthrough_identity(expected, binding))}


def content_inventory(content):
    return sorted([{'path': PREFIX + name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
                   for name, data in content.items()], key=lambda row: row['path'])


def assemble(args):
    baseline_root, candidate, site, proof = disjoint_roots(args.baseline, args.candidate, args.site, args.proof)
    proof = ordinary_directory(proof)
    require(not site.exists(), 'Refuse to overwrite an existing publication site')
    binding_file = ordinary_file(args.binding)
    require(binding_file == proof / 'package-binding.json', 'Binding must be retained at proof/package-binding.json')
    expected = identity(args)
    before = inventory(baseline_root)
    check_baseline(before)
    require(not (baseline_root / PREFIX[:-1]).exists(), 'Native preview namespace already exists')
    binding = read_json(binding_file)
    artifact_hashes = check_binding(binding, proof, candidate, expected)
    candidate_rows = inventory(candidate, MAX_CANDIDATE_BYTES)
    status = status_record(expected, binding)
    content = generated_content(expected, binding)
    generated = content_inventory(content)
    supplemental_copies = supplemental_copied_rows(binding)
    added = sorted([{**row, 'path': PREFIX + row['path']} for row in candidate_rows] + generated + supplemental_copies,
                   key=lambda row: row['path'])
    after_expected = sorted(before + added, key=lambda row: row['path'])
    checked_rows(after_expected, 'Append-only union')
    require(not (proof / 'manifest.json').exists() and not (proof / 'baseline-manifest.json').exists(), 'Publication manifest already exists')
    temporary = staging_directory(site)
    try:
        shutil.copytree(baseline_root, temporary, dirs_exist_ok=True)
        shutil.copytree(candidate, temporary / PREFIX)
        for copied in binding['supplemental']['reviewedFiles']:
            source = ordinary_file(proof / 'review-artifacts/native-castle' / copied['sourcePath'])
            with source.open('rb') as stream:
                stream_to_file(stream, temporary / PREFIX / copied['path'], copied['bytes'])
        for name, data in content.items():
            destination = temporary / PREFIX / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            with destination.open('xb') as stream:
                stream.write(data)
        after = inventory(temporary)
        require(after == after_expected, 'Assembly changed reviewed or accepted bytes')
        require(inventory(baseline_root) == before and inventory(candidate, MAX_CANDIDATE_BYTES) == candidate_rows,
                'An input changed during assembly')
        manifest = {**status, 'phase': 'published', 'preview': preview_scope(),
                    'baselinePublisherCommit': BASELINE_PUBLISHER, 'baselineSourceCommit': BASELINE_SOURCE,
                    'baselineSourceReview': BASELINE_REVIEW, 'baselinePagesArtifact': BASELINE_ARTIFACT,
                    'acceptedProofArtifact': ACCEPTED_PROOF_ARTIFACT,
                    'baselineFiles': before, 'baselineBytes': BASELINE_BYTES, 'baselineFilesSha256': BASELINE_INVENTORY_SHA256,
                    'candidateFiles': candidate_rows, 'candidateBytes': sum(row['bytes'] for row in candidate_rows),
                    'candidateFilesSha256': inventory_sha256(candidate_rows), 'addedFiles': added,
                    'addedBytes': sum(row['bytes'] for row in added), 'generatedFiles': generated,
                    'supplementalCopiedFiles': supplemental_copies,
                    'supplementalCopiedBytes': sum(row['bytes'] for row in supplemental_copies),
                    'supplementalRecording': binding['supplemental']['recording'],
                    'siteFiles': after, 'siteBytes': sum(row['bytes'] for row in after), 'siteFilesSha256': inventory_sha256(after),
                    'packageBindingSha256': sha256_file(binding_file), 'reviewArtifactFilesSha256': artifact_hashes,
                    'packageBinding': binding}
        check_manifest(manifest, 'published', expected)
        temporary.rename(site)
        temporary = None
        write_new_json(proof / 'manifest.json', manifest)
        preflight = {**manifest, 'phase': 'preflight', 'siteFiles': before, 'siteBytes': BASELINE_BYTES,
                     'siteFilesSha256': BASELINE_INVENTORY_SHA256}
        write_new_json(proof / 'baseline-manifest.json', preflight)
        print(json.dumps({'pass': True, **expected, 'appendOnly': True, 'preservedFiles': len(before),
                          'preservedBytes': BASELINE_BYTES, 'addedFiles': len(added), 'addedBytes': manifest['addedBytes'],
                          'siteFilesSha256': manifest['siteFilesSha256']}))
    finally:
        if temporary is not None:
            shutil.rmtree(temporary)


def check_manifest(manifest, phase, expected):
    exact_identity(manifest, expected, 'Publication manifest')
    require(manifest.get('phase') == phase and phase in ('preflight', 'published'), 'Proof phase mismatch')
    binding = manifest.get('packageBinding')
    binding_structure(binding, expected)
    require_preview(manifest.get('preview'), 'Manifest')
    for key, value in status_record(expected, binding).items():
        require(type(manifest.get(key)) is type(value) and manifest.get(key) == value, 'Manifest scope mismatch: ' + key)
    for key, value in {'baselinePublisherCommit': BASELINE_PUBLISHER, 'baselineSourceCommit': BASELINE_SOURCE,
                       'baselineSourceReview': BASELINE_REVIEW, 'baselinePagesArtifact': BASELINE_ARTIFACT,
                       'acceptedProofArtifact': ACCEPTED_PROOF_ARTIFACT}.items():
        require(type(manifest.get(key)) is type(value) and manifest.get(key) == value, 'Manifest baseline pin mismatch: ' + key)
    exact_identity({'sourceCommit': BASELINE_SOURCE, 'sourceReview': manifest['baselineSourceReview']},
                   {'sourceCommit': BASELINE_SOURCE, 'sourceReview': BASELINE_REVIEW}, 'Manifest baseline review')
    for key in ('baselinePagesArtifact', 'acceptedProofArtifact'):
        integer(manifest[key].get('id'), key + ' ID', 1)
        integer(manifest[key].get('bytes'), key + ' bytes', 1,
                MAX_PRIVATE_PROOF_BYTES if key == 'acceptedProofArtifact' else MAX_BYTES)
    baseline_rows = manifest.get('baselineFiles')
    check_baseline(baseline_rows)
    require(type(manifest.get('baselineBytes')) is int and manifest['baselineBytes'] == BASELINE_BYTES and
            manifest.get('baselineFilesSha256') == BASELINE_INVENTORY_SHA256, 'Manifest baseline totals/hash mismatch')
    candidate_rows = manifest.get('candidateFiles')
    candidate = checked_rows(candidate_rows, 'Manifest candidate', MAX_CANDIDATE_BYTES)
    require('index.html' in candidate and 'build-info.json' in candidate and 'preview-status.json' not in candidate,
            'Manifest candidate missing entry or contains generated status')
    require(binding.get('artifacts', {}).get('build', {}).get('files') == candidate_rows, 'Manifest candidate differs from exact build artifact')
    require(type(manifest.get('candidateBytes')) is int and manifest['candidateBytes'] == sum(row['bytes'] for row in candidate_rows) and
            manifest.get('candidateFilesSha256') == inventory_sha256(candidate_rows), 'Candidate totals/hash mismatch')
    added_rows = manifest.get('addedFiles')
    added = checked_rows(added_rows, 'Manifest appended files')
    require(all(name.startswith(PREFIX) for name in added), 'Appended file escaped native namespace')
    baseline_map = checked_rows(baseline_rows, 'Manifest baseline')
    require(not (set(added) & set(baseline_map)), 'Appended namespace overwrites accepted files')
    generated = content_inventory(generated_content(expected, binding))
    supplemental_copies = supplemental_copied_rows(binding)
    expected_added = sorted([{**row, 'path': PREFIX + row['path']} for row in candidate_rows] + generated + supplemental_copies,
                           key=lambda row: row['path'])
    require(added_rows == expected_added and manifest.get('generatedFiles') == generated, 'Generated or reviewed appended bytes changed')
    require(manifest.get('supplementalCopiedFiles') == supplemental_copies and type(manifest.get('supplementalCopiedBytes')) is int and
            manifest['supplementalCopiedBytes'] == sum(row['bytes'] for row in supplemental_copies) and
            manifest.get('supplementalRecording') == binding['supplemental']['recording'], 'Supplemental movie/report inventory or identity changed')
    require(type(manifest.get('addedBytes')) is int and manifest['addedBytes'] == sum(row['bytes'] for row in added_rows), 'Appended byte count mismatch')
    union = sorted(baseline_rows + added_rows, key=lambda row: row['path'])
    checked_rows(union, 'Complete union')
    public_rows = manifest.get('siteFiles')
    checked_rows(public_rows, 'Public phase inventory')
    require(public_rows == (baseline_rows if phase == 'preflight' else union), 'Public phase inventory differs from append-only union')
    require(type(manifest.get('siteBytes')) is int and manifest['siteBytes'] == sum(row['bytes'] for row in public_rows) and
            manifest.get('siteFilesSha256') == inventory_sha256(public_rows), 'Public inventory totals/hash mismatch')
    require(manifest.get('packageBindingSha256') == hashlib.sha256(json_bytes(binding)).hexdigest(), 'Manifest binding digest mismatch')
    artifact_hashes = manifest.get('reviewArtifactFilesSha256')
    require(isinstance(artifact_hashes, dict) and set(artifact_hashes) == set(ARTIFACT_NAMES), 'Manifest artifact inventories missing')
    for key in ARTIFACT_NAMES:
        rows = binding.get('artifacts', {}).get(key, {}).get('files')
        checked_rows(rows, key + ' manifest review inventory')
        require(artifact_hashes[key] == inventory_sha256(rows), 'Manifest reviewed artifact inventory hash mismatch')
    return public_rows


def checked_base(value):
    parsed = urllib.parse.urlsplit(value)
    require(parsed.scheme in ('http', 'https') and parsed.hostname and parsed.username is None and
            parsed.password is None and not parsed.query and not parsed.fragment, 'Verification needs a plain HTTP(S) site URL')
    require(not any(ord(c) < 32 or ord(c) == 127 for c in value), 'Unsafe site URL')
    return value.rstrip('/')


def verify_row(base, row, opener=urllib.request.urlopen):
    url = base + '/' + urllib.parse.quote(row['path'], safe='/') + '?tower41-byte-check=' + str(time.time_ns())
    request = urllib.request.Request(url, headers={'Cache-Control': 'no-cache', 'Accept-Encoding': 'identity',
                                                  'User-Agent': 'brainrot-tower41-byte-check'})
    result, length = hashlib.sha256(), 0
    with opener(request, timeout=90) as response:
        require(response.status == 200, 'Public file HTTP ' + str(response.status) + ': ' + row['path'])
        require(response.headers.get('Content-Encoding', 'identity').lower() in ('identity', ''), 'Encoded HTTP content is unsupported')
        header_length = response.headers.get('Content-Length')
        if header_length is not None:
            require(re.fullmatch(r'[0-9]+', header_length) and int(header_length) == row['bytes'], 'Public Content-Length mismatch: ' + row['path'])
        for chunk in iter(lambda: response.read(1024 * 1024), b''):
            length += len(chunk)
            require(length <= row['bytes'], 'Unexpected public bytes: ' + row['path'])
            result.update(chunk)
    require(length == row['bytes'], 'Public size changed: ' + row['path'])
    require(result.hexdigest() == row['sha256'], 'Public hash changed: ' + row['path'])
    return length


def verify(args):
    expected = identity(args)
    output = no_symlinks(args.output)
    require(not output.exists(), 'Verification receipt already exists')
    report = {'pass': False, **expected, 'phase': args.phase, 'checked': 0, 'siteUrl': args.base,
              'appendOnly': True, 'mainSiteUnchanged': False,
              'scope': 'Every listed accepted file byte during PRE, and every listed accepted plus appended byte during POST.'}
    try:
        base = checked_base(args.base)
        manifest = read_json(args.manifest)
        rows = check_manifest(manifest, args.phase, expected)
        proof = ordinary_file(args.manifest).parent
        binding_file = proof / 'package-binding.json'
        require(sha256_file(binding_file) == manifest['packageBindingSha256'] and read_json(binding_file) == manifest['packageBinding'],
                'Retained package binding differs from manifest')
        def one(row):
            for attempt in range(4):
                try:
                    return verify_row(base, row)
                except Exception:
                    if attempt == 3:
                        raise
                    time.sleep(2 ** attempt)
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
            lengths = list(executor.map(one, rows))
        # Recheck the identifying public bytes after the full inventory to catch a concurrent publication.
        row_map = {row['path']: row for row in rows}
        endpoints = ['build-info.json', 'puzzle-progression-finale/build-info.json', 'puzzle-progression-finale/preview-status.json']
        if args.phase == 'published':
            endpoints.extend([PREFIX + 'build-info.json', PREFIX + 'preview-status.json'])
        for path in endpoints:
            require(path in row_map, 'Missing identifying public file: ' + path)
            one(row_map[path])
        report.update({'pass': True, 'checked': len(lengths), 'bytes': sum(lengths), 'mainSiteUnchanged': True,
                       'baselineFilesSha256': BASELINE_INVENTORY_SHA256, 'siteFilesSha256': manifest['siteFilesSha256'],
                       'packageBindingSha256': manifest['packageBindingSha256']})
        print(json.dumps(report))
    except Exception as error:
        report['error'] = str(error)
        raise
    finally:
        write_new_json(output, report)


def verification_bundle(args):
    """Retain current acceptance metadata and one complete public movie without archives or production copies."""
    expected = identity(args)
    proof, output = disjoint_roots(args.proof, args.output)
    proof = ordinary_directory(proof)
    require(not output.exists(), 'Refuse to overwrite verification packet')
    manifest = read_json(proof / 'manifest.json')
    site_rows = check_manifest(manifest, 'published', expected)
    byte_receipt = read_json(proof / 'public-bytes.json')
    exact_identity(byte_receipt, expected, 'Verification public byte receipt')
    require(byte_receipt.get('pass') is True and byte_receipt.get('phase') == 'published' and
            type(byte_receipt.get('checked')) is int and byte_receipt['checked'] == len(site_rows) and
            type(byte_receipt.get('bytes')) is int and byte_receipt['bytes'] == manifest['siteBytes'] and
            byte_receipt.get('siteFilesSha256') == manifest['siteFilesSha256'], 'Verification requires successful complete public bytes')
    public = read_json(proof / 'public-native/evidence.json')
    require(public.get('sourceCommit') == expected['sourceCommit'] and public.get('result', {}).get('pass') is True,
            'Verification requires current successful actual public evidence')
    pendulum_event(public)
    video = public.get('video')
    require(isinstance(video, dict) and isinstance(video.get('filename'), str) and
            re.fullmatch(r'[A-Za-z0-9_-]+\.mp4', video['filename']), 'Verification needs an ordinary public MP4 basename')
    video_name = 'public-native/' + video['filename']
    movie = ordinary_file(proof / video_name)
    require(movie.stat().st_size > 0 and movie.stat().st_size <= MAX_VERIFICATION_BYTES and
            sha256_file(movie) == digest(video.get('sha256'), 'Verification public movie hash'), 'Verification public movie bytes changed')
    selected, total = [], movie.stat().st_size
    # Every retained path is checked even when its payload is not selected for transport.
    for filename in sorted(proof.rglob('*')):
        mode = filename.lstat().st_mode
        require(stat.S_ISREG(mode) or stat.S_ISDIR(mode), 'Non-regular retained proof path: ' + str(filename))
        if stat.S_ISDIR(mode):
            continue
        name = safe_name(filename.relative_to(proof).as_posix())
        if name.startswith('downloads/') or name.startswith('review-artifacts/build/'):
            continue
        if filename.suffix not in ('.json', '.log', '.txt', '.csv'):
            continue
        size = integer(filename.stat().st_size, 'Verification metadata file size', maximum=MAX_VERIFICATION_METADATA_BYTES)
        total += size
        require(total <= MAX_VERIFICATION_BYTES and len(selected) < MAX_ENTRIES, 'Verification packet exceeds bounded transport budget')
        selected.append((filename, name))
    require(any(name == 'manifest.json' for _, name in selected) and any(name == 'package-binding.json' for _, name in selected),
            'Verification packet lacks identity/packet metadata')
    selected.append((movie, video_name))
    selected.sort(key=lambda pair: pair[1])
    rows = [{'path': name, 'bytes': filename.stat().st_size, 'sha256': sha256_file(filename)} for filename, name in selected]
    checked_rows(rows, 'Verification packet', MAX_VERIFICATION_BYTES)
    record = {'schemaVersion': 1, 'kind': 'tower41-native-public-verification-packet', **expected,
              'pass': True, 'files': rows, 'bytes': total, 'filesSha256': inventory_sha256(rows),
              'maximumBytes': MAX_VERIFICATION_BYTES, 'fullPrivateProofRequiredForFinalAcceptance': True,
              'completePublicMovie': {'path': video_name, 'bytes': movie.stat().st_size, 'sha256': video['sha256']},
              'imagesIncluded': False, 'productionIncluded': False, 'sourceCodeIncluded': False,
              'nestedArchivesIncluded': False}
    record_bytes = json_bytes(record)
    require(total + len(record_bytes) <= MAX_VERIFICATION_BYTES, 'Verification packet receipt exceeds bounded transport budget')
    temporary = None
    try:
        temporary = staging_directory(output)
        for filename, name in selected:
            target = temporary / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(filename, target)
        require(inventory(temporary, MAX_VERIFICATION_BYTES) == rows, 'Verification packet copy bytes differ')
        write_new_json(temporary / 'verification-packet.json', record)
        inventory(temporary, MAX_VERIFICATION_BYTES)
        temporary.rename(output)
        temporary = None
        print(json.dumps({'pass': True, 'files': len(rows) + 1, 'bytes': total + len(record_bytes),
                          'filesSha256': record['filesSha256'], 'completePublicMovie': record['completePublicMovie']}))
    finally:
        if temporary is not None:
            shutil.rmtree(temporary)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    extraction = sub.add_parser('extract')
    for flag in ('zip', 'output', 'digest', 'bytes'):
        extraction.add_argument('--' + flag, required=True)
    extraction.add_argument('--max-bytes', default=str(MAX_CANDIDATE_BYTES))
    private_extraction = sub.add_parser('extract-accepted')
    for flag in ('zip', 'output'):
        private_extraction.add_argument('--' + flag, required=True)
    baseline_parser = sub.add_parser('baseline')
    for flag in ('zip', 'accepted-proof', 'output'):
        baseline_parser.add_argument('--' + flag, required=True)
    assembly = sub.add_parser('assemble')
    for flag in ('baseline', 'candidate', 'site', 'proof', 'binding', 'source', 'publisher', 'run', 'review-run', 'review-attempt'):
        assembly.add_argument('--' + flag, required=True)
    verification = sub.add_parser('verify')
    for flag in ('base', 'manifest', 'output', 'source', 'publisher', 'run', 'review-run', 'review-attempt'):
        verification.add_argument('--' + flag, required=True)
    verification.add_argument('--phase', required=True, choices=('preflight', 'published'))
    bundle = sub.add_parser('verification-bundle')
    for flag in ('proof', 'output', 'source', 'publisher', 'run', 'review-run', 'review-attempt'):
        bundle.add_argument('--' + flag, required=True)
    args = parser.parse_args()
    {'extract': extract, 'extract-accepted': extract_accepted, 'baseline': baseline, 'assemble': assemble, 'verify': verify, 'verification-bundle': verification_bundle}[args.command](args)


if __name__ == '__main__':
    main()
