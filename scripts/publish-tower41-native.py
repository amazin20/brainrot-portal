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


MAX_BYTES = 700_000_000
MAX_PRIVATE_PROOF_BYTES = 2_000_000_000
MAX_VERIFICATION_BYTES = 100_000_000
MAX_VERIFICATION_METADATA_BYTES = 25_000_000
MAX_CANDIDATE_BYTES = 100_000_000
MAX_ENTRIES = 20_000
MAX_SAFE_INTEGER = 2 ** 53 - 1
BASELINE_RUN = 38300647905
BASELINE_PUBLISHER = 'a74b64fe6d861baa94bbba7c6311794e6d520534'
BASELINE_SOURCE = '5e552e9c3ac248b535d619741f15e99e29979cbf'
BASELINE_REVIEW = {'runId': 38291320140, 'runAttempt': 1}
BASELINE_ARTIFACT = {'id': 11770184490, 'bytes': 549474265,
                     'sha256': '573ab6c76a18ba5d2811fa2d3cd299a58772352b967e03370d16023eb9cf0363'}
ACCEPTED_PROOF_ARTIFACT = {'id': 11773576422, 'bytes': 38902095,
                         'sha256': 'd68fa5d19ca851451cdd050ec88e242e3bf75adfcb3f96a0b76b3a3508adf90e'}
BASELINE_FULL_PRIVATE_ARTIFACT = {'id': 11773770811, 'bytes': 1265969704,
                                'sha256': 'a1acac27c2786f8b2c087245a55f75fb3bff9a2bc57df4edd9aba9262e5c6838'}
BASELINE_COUNT = 1789
BASELINE_BYTES = 592794475
BASELINE_INVENTORY_SHA256 = 'f7728df3a5cfdcaf1d49de047260baa20c72a3b35090213e8ff5cae43763fc72'
RECOVERY = {'failedPublisher': '387f00791b1b469c83d5a8ab680e12f669ff00d2',
            'failedTree': '181b7044186a93ca840e06e600cd46684ab6d82f', 'failedRun': 38358383551, 'failedAttempt': 1,
            'sourceCommit': '3f2e83127dfd5800068854a98843d73eb9377609',
            'sourceTree': '8a00a9e62642865d83c71039d72bf028dea46256',
            'sourceReview': {'runId': 38348119403, 'runAttempt': 1},
            'currentFiles': 1957, 'currentBytes': 633671648,
            'currentInventorySha256': 'd76664e04f5ac2f2b161d9af10da1aa2299df13cfec51a243659d2b732be13c6',
            'failedBindingSha256': '987db6be44dc54062f6e721cc0bcd67c80e0f466a27f0b62e636ec93f567c2bc'}
RECOVERY_KIND = 'exact-failed-after-deploy-R5-byte-identical-recovery'
PREFIX = 'tower41-native-v3/'
QUERY = '?edition=foundation&level=41&tower41preview=1'
STORAGE_PREFIX = 'brainrot-tower41-native-v3:'
JOB_NAMES = ('build', 'cpu', 'native-contact', 'native-castle', 'native-foundation20', 'review-summary')
ARTIFACT_NAMES = {'build': 'build', 'source': 'source', 'cpu': 'cpu',
                  'nativeContact': 'native-contact', 'nativeCastle': 'native-castle', 'nativeFoundation20': 'native-foundation20', 'summary': 'summary'}
SUPPLEMENTAL_VIDEO = 'evidence/tower41-native.mp4'
SUPPLEMENTAL_REPORT = 'evidence/tower41-native-report.json'
SUPPLEMENTAL_IDENTITY = 'evidence/tower41-native-identity.json'
SUPPLEMENTAL_TARGETS = {'preview-status.json', 'walkthroughs.html', SUPPLEMENTAL_IDENTITY,
                        SUPPLEMENTAL_VIDEO, SUPPLEMENTAL_REPORT}
NATIVE_ENTRY_PATHS = frozenset(('/tower41-native-v3', '/tower41-native-v3/', '/tower41-native-v3/index.html',
                               '/brainrot-portal/tower41-native-v3', '/brainrot-portal/tower41-native-v3/',
                               '/brainrot-portal/tower41-native-v3/index.html'))
FOUNDATION20_PREFIX = 'foundation20-physical-v1/'
FOUNDATION20_STORAGE_PREFIX = 'brainrot-foundation20-physical-v1:'
FOUNDATION20_VIDEO = 'evidence/foundation20-physical.mp4'
FOUNDATION20_REPORT = 'evidence/foundation20-native-report.json'
FOUNDATION20_CAMERA_FILE = 'foundation20-native-camera.json'
FOUNDATION20_CAMERA_SCOPE = ('Actual Foundation20 encoded native capture and terminal; the frozen producer measures all original current skin vertices. '
    'Eligibility covers object/material/layer flags only, with unsupported main or player material clipping refused. '
    'Independent Node checks schema, clocks, finite cache shape/padding, ranges and extrema reprojection; it does not reconstruct all indexed skin vertices. '
    'NDC bounds do not establish pixel visibility, occlusion, every-render-frame coverage or camera acceptance.')
FOUNDATION20_CAMERA_FIELDS = {'filename', 'bytes', 'sha256', 'diagnosticVerified', 'samples',
    'allOriginalSamplesInsideLens', 'allEligibleSamplesInsideLens', 'independentIndexedSkinReconstruction',
    'meshFlagEligibilityOnly', 'unsupportedClippingRefused', 'cameraAccepted', 'scope'}
FOUNDATION20_CAMERA_PIN_FIELDS = {'sourceCommit', 'sourceReview', 'tree', 'sourceInputsSha256',
    'packageFilesSha256', 'journeySha256', 'browserSeamSha256', 'cameraObserverSha256', 'cameraProofSha256'}
ENTRIES = (
    {'id': 'foundation20', 'namespace': FOUNDATION20_PREFIX, 'level': 20,
     'storagePrefix': FOUNDATION20_STORAGE_PREFIX, 'artifact': 'nativeFoundation20',
     'artifactKind': 'native-foundation20', 'query': ''},
    {'id': 'tower41', 'namespace': PREFIX, 'level': 41, 'storagePrefix': STORAGE_PREFIX,
     'artifact': 'nativeCastle', 'artifactKind': 'native-castle', 'query': QUERY},
)
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
    """Read every pinned bounded packet member; restore the old accepted manifest and byte receipt.

    The separately provider-pinned old full-private archive is not downloaded or
    described as audited by this transport operation.
    """
    archive_file = ordinary_file(archive_file)
    output = no_symlinks(output)
    require(archive_file.stat().st_size == ACCEPTED_PROOF_ARTIFACT['bytes'] and
            archive_file.stat().st_size <= MAX_VERIFICATION_BYTES, 'Accepted bounded verification ZIP size mismatch')
    require(sha256_file(archive_file) == ACCEPTED_PROOF_ARTIFACT['sha256'], 'Accepted bounded verification ZIP hash mismatch')
    require(not output.exists(), 'Refuse to overwrite an accepted proof directory')
    temporary = None
    try:
        with zipfile.ZipFile(archive_file) as archive:
            entries = zip_entries(archive, MAX_VERIFICATION_BYTES)
            temporary = staging_directory(output)
            packet_entries = [(entry, name) for entry, name, directory in entries
                              if not directory and name == 'verification-packet.json']
            require(len(packet_entries) == 1, 'Accepted bounded archive needs one verification packet')
            entry, name = packet_entries[0]
            require(entry.file_size <= MAX_VERIFICATION_METADATA_BYTES, 'Accepted verification packet metadata exceeds limit')
            packet_file = temporary / name
            with archive.open(entry) as source:
                stream_to_file(source, packet_file, entry.file_size)
            packet = read_json(packet_file)
            baseline_identity = {'sourceCommit': BASELINE_SOURCE, 'publisherCommit': BASELINE_PUBLISHER,
                                 'publicationRun': BASELINE_RUN, 'sourceReview': BASELINE_REVIEW}
            exact_identity(packet, baseline_identity, 'Accepted bounded verification packet')
            require(packet.get('schemaVersion') == 1 and type(packet['schemaVersion']) is int and
                    packet.get('kind') == 'tower41-native-public-verification-packet' and packet.get('pass') is True and
                    packet.get('imagesIncluded') is False and packet.get('nestedArchivesIncluded') is False,
                    'Accepted verification packet schema/scope mismatch')
            declared_rows = packet.get('files')
            checked_rows(declared_rows, 'Accepted bounded packet members', MAX_VERIFICATION_BYTES)
            actual_rows = []
            for item, member, directory in entries:
                if directory or member == 'verification-packet.json':
                    continue
                require(not member.startswith('downloads/') and
                        pathlib.PurePosixPath(member).suffix in ('.json', '.log', '.txt', '.csv', '.mp4'),
                        'Unexpected bounded verification member: ' + member)
                count, checksum = 0, hashlib.sha256()
                with archive.open(item) as source:
                    for data in iter(lambda: source.read(1024 * 1024), b''):
                        count += len(data)
                        require(count <= item.file_size, 'Accepted bounded member exceeded declared bytes')
                        checksum.update(data)
                require(count == item.file_size, 'Accepted bounded member byte count mismatch')
                actual_rows.append({'path': member, 'bytes': count, 'sha256': checksum.hexdigest()})
            actual_rows.sort(key=lambda row: row['path'])
            require(actual_rows == declared_rows and packet.get('filesSha256') == inventory_sha256(actual_rows) and
                    type(packet.get('bytes')) is int and packet['bytes'] == sum(row['bytes'] for row in actual_rows),
                    'Accepted bounded packet member bytes/hash/inventory mismatch')
            selected = []
            for suffix in ('manifest.json', 'public-bytes.json'):
                matching = [(entry, name) for entry, name, directory in entries
                            if not directory and name in (suffix, 'proof/' + suffix)]
                require(len(matching) == 1, 'Accepted private proof needs exactly one ' + suffix)
                selected.extend(matching)
            require(all(entry.file_size <= 50_000_000 for entry, _ in selected), 'Accepted private proof JSON exceeds limit')
            for entry, name in selected:
                with archive.open(entry) as source:
                    stream_to_file(source, temporary / name, entry.file_size)
            packet_file.unlink()
            write_new_json(temporary / 'transport-audit.json', {
                'schemaVersion': 1, 'kind': 'accepted-baseline-bounded-transport-audit', **baseline_identity,
                'pass': True, 'artifact': ACCEPTED_PROOF_ARTIFACT,
                'allMemberNamespaceTypesAndBytesVerified': True, 'memberFiles': len(actual_rows) + 1,
                'memberFilesSha256': inventory_sha256(actual_rows),
                'fullPrivateProofProviderPin': BASELINE_FULL_PRIVATE_ARTIFACT,
                'fullPrivateArchiveBytesDownloaded': False, 'fullPrivateNestedArchiveAudited': False,
            })
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
                      'zipBytes': ACCEPTED_PROOF_ARTIFACT['bytes'], 'allMemberNamespaceTypesAndBytesVerified': True,
                      'maximumBytes': MAX_VERIFICATION_BYTES, 'files': len(rows),
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
    require(not any(row['path'] == entry['namespace'][:-1] or row['path'].startswith(entry['namespace'])
                    for entry in ENTRIES for row in rows),
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
        require(all(name != entry['namespace'][:-1] and not name.startswith(entry['namespace']) for entry in ENTRIES),
                'Native preview namespace already exists in TAR')
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
                'brainrot-tower41-ratchet-qualification-v1:', 'brainrot-tower41-native-v1:', 'brainrot-tower41-native-v2:',
                'brainrot-foundation20-physical-v1:']
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
    peer = isolation.get('crossEntry')
    require(isinstance(peer, dict) and peer.get('pass') is True, 'Castle actual peer entry/reload proof missing')
    peer_url, peer_origin, _ = preview_url(peer.get('url'), 'Castle peer bare entry')
    _, own_origin, _ = preview_url(isolation['bareEntry']['url'] if isolation['bareEntry'].get('applicable') else isolation['playerURL'], 'Castle own entry')
    require(peer_origin == own_origin and peer_url.path == '/brainrot-portal/foundation20-physical-v1/' and
            peer_url.query == '' and peer_url.fragment == '' and peer.get('pathname') == peer_url.path and
            peer.get('search') == '' and peer.get('hash') == '' and peer.get('entry') == 'foundation20-physical-v1' and
            peer.get('edition') == 'foundation' and peer.get('state') == 'ready' and peer.get('level') == 20 and
            type(peer['level']) is int and peer.get('startChoices') == [19] and peer.get('settingsChoices') == [19] and
            peer.get('editionNavigationPresent') is False and peer.get('editionNavigationAnchors') == [],
            'Castle cross-entry visit used a different path/edition/menu')
    for field in ('debugGameHook', 'debugPreferencesHook', 'debugRouteHook'):
        require(peer.get(field) == 'undefined', 'Castle peer bare entry exposed a debug hook')
    require(peer.get('own41BytesUnchanged') is True and peer.get('peerBytesUnchanged') is True and peer.get('reloadVerified') is True and
            peer.get('legacySnapshotSha256') == snapshot_hash and peer.get('own41Sha256') == observed[-1]['ownPreferencesSha256'],
            'Castle cross-entry visit/reload changed own41 or preserved saves')
    return isolation


def assert_foundation20_save_isolation(isolation):
    require(isinstance(isolation, dict) and isolation.get('pass') is True, 'Room20 native save isolation did not pass')
    key = 'brainrot-portal.preferences.v24'
    prefixes = ['brainrot-foundation-v1:', 'brainrot-puzzle-pilot43-v1:', 'brainrot-puzzle-progression-v1:',
                'brainrot-puzzle-progression-next-v1:', 'brainrot-puzzle-progression-finale-v1:',
                'brainrot-tower41-ratchet-qualification-v1:', 'brainrot-tower41-native-v1:',
                'brainrot-tower41-native-v2:', 'brainrot-tower41-native-v3:']
    require(isolation.get('namespace') == FOUNDATION20_STORAGE_PREFIX and
            isolation.get('ownKey') == FOUNDATION20_STORAGE_PREFIX + key and isolation.get('legacyPrefixes') == prefixes,
            'Room20 native save namespaces changed')
    snapshot = isolation.get('legacySnapshot')
    require(isinstance(snapshot, dict) and all(isinstance(snapshot.get(prefix + key), str) for prefix in prefixes) and
            all(isinstance(name, str) and any(name.startswith(prefix) for prefix in prefixes) and isinstance(value, str)
                for name, value in snapshot.items()), 'Room20 actual preserved save snapshot missing')
    snapshot_hash = hashlib.sha256(json.dumps(snapshot, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
    require(isolation.get('legacySnapshotSha256') == snapshot_hash, 'Room20 preserved snapshot hash mismatch')
    bare = isolation.get('bareEntry')
    require(isinstance(bare, dict) and bare.get('pass') is True, 'Room20 actual bare entry missing')
    url, _, _ = preview_url(bare.get('url'), 'Room20 bare entry')
    require(url.path in ('/foundation20-physical-v1/', '/brainrot-portal/foundation20-physical-v1/') and
            url.query == '' and url.fragment == '' and bare.get('search') == '' and bare.get('pathname') == url.path,
            'Room20 bare entry used a different path/query')
    require(bare.get('state') == 'ready' and bare.get('level') == 20 and type(bare['level']) is int and
            bare.get('edition') == 'foundation' and bare.get('entry') == 'foundation20-physical-v1',
            'Room20 bare entry did not open its actual Foundation room')
    require(bare.get('legacySnapshotSha256') == snapshot_hash and bare.get('oldBytesUnchanged') is True,
            'Room20 bare entry changed preserved save bytes')
    for name in ('debugGameHook', 'debugPreferencesHook', 'debugRouteHook'):
        require(bare.get(name) == 'undefined', 'Room20 bare entry exposes a debug hook')
    settings = bare.get('settings')
    require(isinstance(settings, dict), 'Room20 bare native settings proof missing')
    for name in ('beforeSha256', 'changedSha256', 'restoredSha256'):
        digest(settings.get(name), 'Room20 bare settings ' + name)
    require(settings['beforeSha256'] == settings['restoredSha256'] and settings['beforeSha256'] != settings['changedSha256'],
            'Room20 native settings did not change/restore actual private bytes')
    phases = ['after-load', 'after-settings', 'after-play', 'after-pause', 'after-resume', 'after-win', 'after-replay', 'after-reload']
    states = ['ready', 'ready', 'playing', 'paused', 'playing', 'won', 'playing', 'ready']
    observed = isolation.get('phases')
    require(isinstance(observed, list) and len(observed) == len(phases), 'Room20 requires all eight native save phases')
    for item in [bare] + observed:
        require(isinstance(item, dict) and item.get('level') == 20 and type(item['level']) is int and
                item.get('edition') == 'foundation' and item.get('entry') == 'foundation20-physical-v1',
                'Room20 save proof used another room/edition')
        require(item.get('startChoices') == [19] and item.get('settingsChoices') == [19] and
                type(item['startChoices'][0]) is int and type(item['settingsChoices'][0]) is int and
                item.get('editionNavigationPresent') is False, 'Room20 native menu leaked unrelated rooms')
        require(item.get('oldBytesUnchanged') is True and item.get('legacySnapshotSha256') == snapshot_hash,
                'Room20 save transition changed preserved bytes')
    for i, item in enumerate(observed):
        require(item.get('phase') == phases[i] and item.get('state') == states[i] and item.get('namespaceUsed') is True and
                item.get('ownResumeLevel') == 19 and type(item['ownResumeLevel']) is int and
                item.get('ownCompleted') == ([] if i < 5 else [19]), 'Room20 native save phase state/order/completion mismatch')
        digest(item.get('ownPreferencesSha256'), 'Room20 own save hash')
    controls = isolation.get('controls')
    require(isinstance(controls, dict) and controls.get('pauseResume', {}).get('pass') is True and
            controls.get('replay', {}).get('pass') is True and controls['replay'].get('atSpawn') is True and
            controls.get('reload', {}).get('pass') is True, 'Room20 actual pause/replay/reload controls missing')
    peer = isolation.get('crossEntry')
    require(isinstance(peer, dict) and peer.get('pass') is True, 'Room20 actual peer entry/reload proof missing')
    peer_url, peer_origin, _ = preview_url(peer.get('url'), 'Room20 peer bare entry')
    _, own_origin, _ = preview_url(bare['url'], 'Room20 own bare entry')
    require(peer_origin == own_origin and peer_url.path == url.path.replace('foundation20-physical-v1', 'tower41-native-v3') and
            peer_url.query == '' and peer_url.fragment == '' and peer.get('entry') == 'tower41-native-v3' and
            peer.get('state') == 'ready' and peer.get('level') == 41 and type(peer['level']) is int and
            peer.get('startChoices') == [40] and peer.get('settingsChoices') == [40], 'Room20 cross-entry visit used another path/menu')
    for field in ('debugGameHook', 'debugPreferencesHook', 'debugRouteHook'):
        require(peer.get(field) == 'undefined', 'Peer bare entry exposed a debug hook')
    require(peer.get('own20BytesUnchanged') is True and peer.get('peerBytesUnchanged') is True and
            peer.get('reloadVerified') is True and peer.get('legacySnapshotSha256') == snapshot_hash and
            peer.get('own20Sha256') == observed[-1]['ownPreferencesSha256'], 'Cross-entry visit/reload changed own20 or preserved saves')
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
            binding.get('kind') == 'foundation20-and-tower41-native-exact-review', 'Package binding schema/kind mismatch')
    require(binding.get('entries') == list(ENTRIES), 'Exactly the two current ordinary entry bindings are required')
    foundation20 = binding.get('foundation20')
    require(isinstance(foundation20, dict) and set(foundation20) == {'saveIsolation', 'receipt', 'supplemental'},
            'Room20 requires actual native save, receipt and full recording binding')
    assert_foundation20_save_isolation(foundation20['saveIsolation'])
    foundation20_supplemental_structure(binding, expected)
    room20_receipt = foundation20['receipt']
    exact_identity(room20_receipt, {key: expected[key] for key in ('sourceCommit', 'sourceReview')}, 'Room20 binding receipt')
    require(room20_receipt.get('pass') is True and room20_receipt.get('edition') == 'foundation' and
            type(room20_receipt.get('level')) is int and room20_receipt['level'] == 20 and
            room20_receipt.get('roomId') == 'foundation-portal-tension' and room20_receipt.get('sameCargo') is True and
            type(room20_receipt.get('resets')) is int and room20_receipt['resets'] == 0 and
            room20_receipt.get('packageFilesSha256') == binding.get('packageFilesSha256') and
            room20_receipt.get('buildInfoSha256') == binding.get('buildInfoSha256') and
            room20_receipt.get('video', {}).get('fullMP4Decode') is True, 'Room20 actual source receipt scope/binding changed')
    digest(room20_receipt.get('reportSha256'), 'Room20 report binding hash')
    foundation20_camera_descriptor(room20_receipt.get('cameraDiagnostic'))
    retained = binding.get('baselineFullPrivateProof')
    require(isinstance(retained, dict) and retained.get('providerRetentionAndDigestBound') is True and
            retained.get('archiveBytesDownloaded') is False and retained.get('nestedArchiveAudited') is False,
            'Old full-private proof must remain honestly provider-bound without a byte-audit claim')
    artifact = retained.get('artifact')
    require(isinstance(artifact, dict) and artifact.get('id') == BASELINE_FULL_PRIVATE_ARTIFACT['id'] and
            artifact.get('name') == f'tower41-native-publication-proof-{BASELINE_RUN}-1' and
            artifact.get('size_in_bytes') == BASELINE_FULL_PRIVATE_ARTIFACT['bytes'] and
            artifact.get('digest') == 'sha256:' + BASELINE_FULL_PRIVATE_ARTIFACT['sha256'] and
            artifact.get('expired') is False and artifact.get('workflow_run', {}).get('id') == BASELINE_RUN and
            artifact.get('workflow_run', {}).get('head_sha') == BASELINE_PUBLISHER,
            'Old full-private provider artifact pin changed')
    require_preview(binding.get('preview'), 'Package binding')
    assert_preview_save_isolation(binding.get('previewSaveIsolation'))
    require(binding['previewSaveIsolation']['crossEntry'].get('sourceCommit') == expected['sourceCommit'],
            'Castle peer entry did not serve the same exact source commit')
    bare = binding['previewSaveIsolation'].get('bareEntry')
    require(isinstance(bare, dict) and bare.get('applicable') is True and bare.get('pass') is True,
            'Publication binding requires an actual native namespace bare-entry observation')
    artifacts = binding.get('artifacts')
    require(isinstance(artifacts, dict) and set(artifacts) == set(ARTIFACT_NAMES), 'Exactly seven exact-review artifacts are required')
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
    require(isinstance(jobs, list) and len(jobs) == len(JOB_NAMES), 'Exactly six successful review jobs required')
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


def supplemental_structure(binding, expected, *, artifact_key="nativeCastle", video_target=SUPPLEMENTAL_VIDEO, report_target=SUPPLEMENTAL_REPORT):
    supplemental = binding.get('supplemental')
    require(isinstance(supplemental, dict) and set(supplemental) == {'reviewedFiles', 'recording'}, 'Exact supplemental recording binding required')
    files = supplemental.get('reviewedFiles')
    require(isinstance(files, list) and len(files) == 2, 'Exactly two copied native recording files are required')
    source_expected = {key: expected[key] for key in ('sourceCommit', 'sourceReview')}
    destinations, sources = set(), set()
    artifact_rows = checked_rows(binding.get('artifacts', {}).get(artifact_key, {}).get('files'), 'Supplemental source artifact')
    for copied in files:
        require(isinstance(copied, dict) and set(copied) == {'sourceArtifact', 'sourcePath', 'path', 'bytes', 'sha256', 'sourceCommit', 'sourceReview'},
                'Invalid supplemental copied-file binding')
        exact_identity(copied, source_expected, 'Supplemental copied file')
        require(copied.get('sourceArtifact') == artifact_key, 'Supplemental copy must use the exact reviewed ordinary castle artifact')
        source_path = safe_name(copied.get('sourcePath'))
        target_path = safe_name(copied.get('path'))
        require(source_path == copied['sourcePath'] and target_path == copied['path'] and
                target_path in (video_target, report_target), 'Supplemental copy escaped its assigned evidence path')
        require(target_path not in destinations and source_path not in sources, 'Duplicate supplemental copied path')
        destinations.add(target_path)
        sources.add(source_path)
        integer(copied.get('bytes'), 'Supplemental copied bytes', 1, MAX_CANDIDATE_BYTES)
        digest(copied.get('sha256'), 'Supplemental copied hash')
        require(artifact_rows.get(source_path) == {key: copied[key] for key in ('bytes', 'sha256')} | {'path': source_path},
                'Supplemental copy differs from exact reviewed artifact inventory')
    require(destinations == {video_target, report_target}, 'Supplemental movie/report targets mismatch')
    recording = supplemental.get('recording')
    require(isinstance(recording, dict) and set(recording) == {'sourceCommit', 'sourceReview', 'filename', 'report', 'bytes', 'sha256',
                                                            'frames', 'fps', 'width', 'height', 'durationSeconds', 'simulationSeconds'},
            'Exact recording identity and measured fields are required')
    exact_identity(recording, source_expected, 'Supplemental recording')
    require(recording.get('filename') == video_target and recording.get('report') == report_target, 'Supplemental recording target mismatch')
    movie = next(row for row in files if row['path'] == video_target)
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
    for target in {'preview-status.json', 'walkthroughs.html', SUPPLEMENTAL_IDENTITY, video_target, report_target}:
        require(all(target != name and not target.startswith(name + '/') and not name.startswith(target + '/') for name in candidate),
                'Candidate collides with supplemental publication path: ' + target)
    return supplemental


def foundation20_supplemental_structure(binding, expected):
    view = dict(binding, supplemental=binding['foundation20']['supplemental'])
    return supplemental_structure(view, expected, artifact_key='nativeFoundation20',
                                  video_target=FOUNDATION20_VIDEO, report_target=FOUNDATION20_REPORT)


def supplemental_copied_rows(binding):
    values = [(PREFIX, binding['supplemental']), (FOUNDATION20_PREFIX, binding['foundation20']['supplemental'])]
    return sorted([{'path': prefix + copied['path'], 'bytes': copied['bytes'], 'sha256': copied['sha256']}
                   for prefix, supplemental in values for copied in supplemental['reviewedFiles']], key=lambda row: row['path'])


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


def foundation20_camera_descriptor(value, samples=None):
    """Only the bounded original-geometry diagnostic is mandatory; no camera acceptance."""
    require(isinstance(value, dict) and set(value) == FOUNDATION20_CAMERA_FIELDS,
            'Room20 needs the exact mandatory camera diagnostic descriptor')
    require(value['filename'] == FOUNDATION20_CAMERA_FILE, 'Room20 camera raw basename changed')
    integer(value['bytes'], 'Room20 camera bytes', 1, MAX_VERIFICATION_METADATA_BYTES)
    digest(value['sha256'], 'Room20 camera hash')
    integer(value['samples'], 'Room20 camera samples', 1, 6001)
    if samples is not None:
        require(type(samples) is int and value['samples'] == samples, 'Room20 camera omits encoded captures')
    for key in ('diagnosticVerified', 'allOriginalSamplesInsideLens', 'allEligibleSamplesInsideLens',
                'meshFlagEligibilityOnly', 'unsupportedClippingRefused'):
        require(value[key] is True, 'Room20 camera diagnostic contradicts ' + key)
    for key in ('independentIndexedSkinReconstruction', 'cameraAccepted'):
        require(value[key] is False, 'Room20 camera diagnostic overclaims ' + key)
    require(value['scope'] == FOUNDATION20_CAMERA_SCOPE, 'Room20 camera diagnostic scope changed')
    return value


def foundation20_camera_pins(value, binding, source, package, expected):
    require(isinstance(value, dict) and set(value) == FOUNDATION20_CAMERA_PIN_FIELDS,
            'Room20 camera needs all nine external source identity fields')
    exact_identity(value, {key: expected[key] for key in ('sourceCommit', 'sourceReview')}, 'Room20 camera source')
    commit(value['tree'], 'Room20 camera source tree')
    for key in FOUNDATION20_CAMERA_PIN_FIELDS - {'sourceCommit', 'sourceReview', 'tree'}:
        digest(value[key], 'Room20 camera ' + key)
    core = binding.get('coreSource')
    require(isinstance(core, dict) and source.get('tree') == package.get('tree') == core.get('tree') == value['tree'] and
            source.get('sourceInputsSha256') == package.get('sourceInputsSha256') == core.get('sourceInputsSha256') == value['sourceInputsSha256'] and
            source.get('sourceInputFiles') == core.get('sourceInputFiles') and
            source.get('verifiers') == core.get('verifiers'), 'Room20 camera changed frozen core source pins')
    integer(core.get('sourceInputFiles'), 'Room20 frozen source input count', 1)
    require(package.get('nativePackage', {}).get('packageFilesSha256') == binding.get('packageFilesSha256') == value['packageFilesSha256'],
            'Room20 camera changed frozen package pin')
    verifiers = core.get('verifiers')
    require(isinstance(verifiers, list) and verifiers, 'Room20 camera frozen verifier hashes missing')
    mapped = {}
    for row in verifiers:
        require(isinstance(row, dict) and set(row) == {'file', 'sha256'} and row['file'] not in mapped,
                'Room20 duplicate or malformed frozen verifier')
        digest(row['sha256'], 'Frozen verifier hash');mapped[row['file']] = row['sha256']
    for key, filename in [('browserSeamSha256', 'scripts/qa-foundation20-native.mjs'),
                          ('cameraObserverSha256', 'scripts/lib/foundation20-native-camera-observer.mjs'),
                          ('cameraProofSha256', 'scripts/lib/foundation20-native-camera-proof.mjs')]:
        require(value[key] == mapped.get(filename), 'Room20 camera changed frozen helper: ' + filename)
    # Journey is a frozen source input checked by the SOURCE Node gate, not an invented extra verifier.
    return value


def foundation20_camera_packet_summary(descriptor, observation, report, telemetry_file, source_identity):
    """Recheck complete capture/summary semantics. Frozen Node owns finite skin/cache/reprojection checks."""
    video, route = report.get('video', {}), report.get('route', {})
    foundation20_camera_descriptor(descriptor, video.get('frames'))
    header_fields = {'kind', 'runtimeObserved', 'accepted', 'cameraAccepted', 'nativeOpticalAccepted',
        'allRenderFramesObserved', 'pixelOcclusionAccepted', 'sourceIdentity', 'config', 'identity', 'recordEncoding',
        'records', 'observedFrames', 'driverRouteFrameCount', 'finalLoopFrameIndex', 'finalClock', 'outputJSONBytes',
        'producerMeasuredOriginalVertices', 'independentIndexedSkinReconstruction', 'meshFlagEligibilityOnly', 'unsupportedClippingRefused', 'scope'}
    require(isinstance(observation, dict) and set(observation) == header_fields and
            observation.get('kind') == 'foundation20-native-camera-observation-v1' and
            observation.get('sourceIdentity') == source_identity, 'Room20 camera raw source identity or room differs')
    for key in ('runtimeObserved', 'producerMeasuredOriginalVertices', 'meshFlagEligibilityOnly', 'unsupportedClippingRefused'):
        require(observation.get(key) is True, 'Room20 raw diagnostic contradicts ' + key)
    for key in ('accepted', 'cameraAccepted', 'nativeOpticalAccepted', 'allRenderFramesObserved',
                'pixelOcclusionAccepted', 'independentIndexedSkinReconstruction'):
        require(observation.get(key) is False, 'Room20 raw diagnostic overclaims ' + key)
    require(observation.get('scope') == FOUNDATION20_CAMERA_SCOPE, 'Room20 raw diagnostic scope changed')
    require(observation.get('outputJSONBytes') == descriptor['bytes'] and type(observation['outputJSONBytes']) is int,
            'Room20 whole raw size contradicts descriptor')
    config = observation.get('config')
    require(isinstance(config, dict) and set(config) == {'fps', 'width', 'height', 'maxRecords', 'maxFrames', 'maxPayloadBytes', 'stride'},
            'Room20 capture config missing')
    for key, value in [('fps', 4), ('stride', 15), ('width', 640), ('height', 360)]:
        require(type(video.get(key)) is int and type(config.get(key)) is int and video[key] == config[key] == value,
                'Room20 camera capture format changed: ' + key)
    integer(config['maxRecords'], 'Room20 camera record budget', 1, 6001)
    integer(config['maxFrames'], 'Room20 camera frame budget', 1, 90000)
    integer(config['maxPayloadBytes'], 'Room20 camera byte budget', 1024, MAX_VERIFICATION_METADATA_BYTES)
    require(descriptor['bytes'] <= config['maxPayloadBytes'], 'Room20 raw exceeds its declared budget')
    frames = integer(route.get('frames'), 'Room20 camera route frames', 1, config['maxFrames'])
    steps = integer(route.get('physicsSteps'), 'Room20 camera route steps', 1)
    require(steps in (frames*2, frames*2-1) and route.get('seconds') == steps/120 and route.get('pass') is True,
            'Room20 camera route clock differs')
    terminal = (frames-1) % 15 != 0
    require(video.get('terminalSample') is terminal and video.get('lastVisualFrame') == frames-1 and
            descriptor['samples'] == (frames-1)//15+1+int(terminal), 'Room20 camera final encoded sample changed')
    for key in ('observedFrames', 'driverRouteFrameCount'):
        require(type(observation.get(key)) is int and observation[key] == frames, 'Room20 observed frame count differs')
    require(type(observation.get('finalLoopFrameIndex')) is int and observation['finalLoopFrameIndex'] == frames-1,
            'Room20 final loop index differs')
    model, encoding = observation.get('identity'), observation.get('recordEncoding')
    require(isinstance(model, dict) and isinstance(encoding, dict), 'Room20 original geometry identity missing')
    require(type(model.get('playerVertices')) is int and model['playerVertices'] == 96753 and
            type(model.get('bones')) is int and model['bones'] == 15 and
            model.get('sameOriginalActorAndSkinAndLoadedAssets') is True and
            model.get('packageRuntimeGLBCount') == 14 and type(model['packageRuntimeGLBCount']) is int and
            model.get('packageModelBytesExternallyPinned') is True and model.get('authoredMaterialIdentity', {}).get('pass') is True,
            'Room20 original actor or package geometry changed')
    digest(model.get('initialAppearanceSha256'), 'Room20 original appearance')
    require(model.get('finalAppearanceSha256') == model['initialAppearanceSha256'], 'Room20 original appearance changed')
    loaded = model.get('loadedAssetModels');require(isinstance(loaded, list) and loaded and
            type(model.get('runtimeLoadedModelCount')) is int and model['runtimeLoadedModelCount'] == len(loaded),
            'Room20 actually loaded model identity changed')
    meshes, bones = model.get('meshes'), model.get('boneDictionary')
    require(isinstance(meshes, list) and meshes and isinstance(bones, list) and len(bones) == 15 and
            len({b.get('uuid') for b in bones}) == 15 and all(isinstance(b.get('uuid'), str) for b in bones),
            'Room20 original mesh/bone dictionary changed')
    require(set(encoding) == {'kind', 'extremaOrder', 'extremaTuple', 'eligibilityTuple', 'boneTuple', 'skinMatricesTuple',
                             'meshDictionary', 'boneDictionary', 'constants'} and
            encoding.get('kind') == 'foundation20-lossless-native-camera-v1' and encoding.get('meshDictionary') == meshes and
            encoding.get('boneDictionary') == bones and encoding.get('constants') == {'sourceCommit': source_identity['sourceCommit'],
                'nativeCanvas': {'width': 640, 'height': 360}, 'appearanceSha256': model['initialAppearanceSha256'], 'scope': FOUNDATION20_CAMERA_SCOPE},
            'Room20 lossless codec/source/appearance binding changed')
    extrema = ['minX', 'maxX', 'minY', 'maxY', 'minDepth', 'maxDepth']
    for key, value in [('extremaOrder', extrema), ('extremaTuple', ['meshIndex', 'vertex', 'world', 'ndc', 'depth']),
                       ('eligibilityTuple', ['meshIndex', 'objectVisible', 'materialVisible', 'layerMatch', 'renderEligible']),
                       ('boneTuple', ['boneIndex', 'localPosition', 'localQuaternion', 'localScale', 'matrixWorld']),
                       ('skinMatricesTuple', ['meshIndex', 'preparedBoneMatrices'])]:
        require(encoding.get(key) == value, 'Room20 lossless codec tuple changed: ' + key)
    mesh_ids = set();total = 0;main_index = None
    for index, mesh in enumerate(meshes):
        require(isinstance(mesh, dict) and set(mesh) == {'meshUuid', 'vertices', 'bones', 'skinned'} and
                isinstance(mesh['meshUuid'], str) and mesh['meshUuid'] not in mesh_ids and type(mesh['skinned']) is bool,
                'Room20 original mesh dictionary malformed')
        mesh_ids.add(mesh['meshUuid']);total += integer(mesh['vertices'], 'Room20 original mesh vertices', 1, 96753)
        integer(mesh['bones'], 'Room20 original mesh bones', 0, 15)
        if mesh['meshUuid'] == model.get('mainBodyMeshUuid'):
            require(mesh['skinned'] is True and mesh['vertices'] == 69777, 'Room20 original main body changed');main_index = index
    require(total == 96753 and main_index is not None, 'Room20 original vertex union changed')
    records = observation.get('records');require(isinstance(records, list) and len(records) == descriptor['samples'] <= config['maxRecords'],
            'Room20 raw omits or repeats encoded camera samples')
    telemetry_file = ordinary_file(telemetry_file)
    integer(telemetry_file.stat().st_size, 'Room20 complete JSONL byte budget', 1, MAX_VERIFICATION_METADATA_BYTES)
    td = report.get('telemetry', {})
    require(td.get('filename') == 'foundation20-telemetry.jsonl' and type(td.get('bytes')) is int and
            td['bytes'] == telemetry_file.stat().st_size and td.get('sha256') == sha256_file(telemetry_file),
            'Room20 actual complete telemetry bytes changed')
    def parse_pairs(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result, 'Duplicate Room20 JSONL key');result[key] = value
        return result
    text = telemetry_file.read_text(encoding='utf-8');lines = text.splitlines()
    require(len(lines) == len(records) and all(line.strip() for line in lines), 'Room20 telemetry must retain every encoded row')
    telemetry = [json.loads(line, object_pairs_hook=parse_pairs, parse_constant=lambda value: (_ for _ in ()).throw(ValueError('Nonfinite Room20 JSONL'))) for line in lines]
    def finite(value):
        if isinstance(value, dict):
            for x in value.values():finite(x)
        elif isinstance(value, list):
            for x in value:finite(x)
        elif type(value) in (int, float):require(math.isfinite(value), 'Room20 nonfinite diagnostic number')
    finite(observation);finite(telemetry)
    offset = observation.get('finalClock', {}).get('worldStepOffset');integer(offset, 'Room20 actual world offset', 0)
    observed = report.get('observed')
    require(isinstance(observed, dict) and all(type(observed.get(key)) is int and observed[key] == value for key, value in
        {'samples': frames, 'completedPostSteps': steps, 'forceSamples': steps, 'postStepsStart': offset, 'postStepsFinish': offset+steps}.items()),
        'Room20 camera world offset or force clock differs from this actual producer report')
    row_fields = {'encodedBinding', 'worldStep', 'worldStepOffset', 'routePhysicsSteps', 'routeSeconds', 'state', 'player', 'cargo',
        'controls', 'camera', 'bones', 'skinMatrices', 'projection', 'mainBodyProjection', 'eligibleProjection', 'eligibility',
        'clipping', 'conservativeEnvelope', 'materialProvenance', 'readPurity'}
    def projection(p, vertices, allowed, near):
        require(isinstance(p, dict) and type(p.get('vertices')) is int and p['vertices'] == vertices and p.get('insideLens') is True and
                all(type(p.get(k)) is int and p[k] == 0 for k in ('outsideLensCount', 'behindCount', 'nearCount')),
                'Room20 original/eligible vertices are outside the lens')
        for k in extrema:require(type(p.get(k)) in (int, float) and math.isfinite(p[k]), 'Room20 finite projection extrema missing')
        require(-1 <= p['minX'] <= p['maxX'] <= 1 and -1 <= p['minY'] <= p['maxY'] <= 1 and
                near < p['minDepth'] <= p['maxDepth'], 'Room20 zero counts contradict cropped or near/behind extrema')
        witnesses = p.get('extremaWitnesses');require(isinstance(witnesses, dict) and set(witnesses) == set(extrema), 'Room20 six original extrema required')
        for key, w in witnesses.items():
            require(isinstance(w, list) and len(w) == 5 and type(w[0]) is int and w[0] in allowed,
                    'Room20 extrema belongs to another mesh scope')
            integer(w[1], 'Room20 original vertex witness', 0, meshes[w[0]]['vertices']-1)
            require(isinstance(w[2], list) and len(w[2]) == 3 and isinstance(w[3], list) and len(w[3]) == 3 and
                    all(type(n) in (int, float) and math.isfinite(n) for n in w[2]+w[3]+[w[4]]), 'Room20 finite original witness missing')
            require(all(-1 <= n <= 1 for n in w[3]) and near < w[4] and
                    p['minX'] <= w[3][0] <= p['maxX'] and p['minY'] <= w[3][1] <= p['maxY'] and
                    p['minDepth'] <= w[4] <= p['maxDepth'], 'Room20 outside extrema contradict declared inside lens')
            require(p[key] == (w[4] if key.endswith('Depth') else w[3][0 if key.endswith('X') else 1]), 'Room20 extrema value contradicts original witness')
    for index, (row, t) in enumerate(zip(records, telemetry)):
        require(isinstance(row, dict) and set(row) == row_fields and isinstance(t, dict) and isinstance(t.get('state'), dict), 'Room20 actual capture row malformed')
        b = row['encodedBinding'];state = t['state'];is_terminal = terminal and index == len(records)-1;vf = frames-1 if is_terminal else index*15
        n = steps if index == len(records)-1 else 2*(vf+1);status = 'won' if index == len(records)-1 else 'playing'
        expected_binding = {'encodedFrame': index, 'visualFrame': vf, 'driverFrame': vf, 'worldStep': offset+n,
            'routeSeconds': n/120, 'state': status, 'terminal': is_terminal, 'source': 'actual post-render encoder capture event'}
        require(b == expected_binding and all(type(b.get(key)) is int for key in ('encodedFrame', 'visualFrame', 'driverFrame', 'worldStep')) and
                b.get('terminal') is is_terminal and type(b.get('routeSeconds')) in (int, float) and
                type(t.get('index')) is int and t['index'] == index and t.get('terminal') is is_terminal and
                all(state.get(key) == value and type(state.get(key)) is int for key, value in
                    {'visualFrame': vf, 'frame': vf, 'worldStep': offset+n}.items()) and
                type(state.get('seconds')) in (int, float) and state['seconds'] == n/120 and state.get('state') == status and
                all(type(row.get(key)) is int for key in ('worldStep', 'worldStepOffset', 'routePhysicsSteps')) and
                type(row.get('routeSeconds')) in (int, float) and
                row['worldStep'] == offset+n and row['worldStepOffset'] == offset and row['routePhysicsSteps'] == n and
                row['routeSeconds'] == n/120 and row['state'] == status and row['player'] == state.get('player') and row['cargo'] == state.get('cargo'),
                'Room20 camera/JSONL capture clocks or original actor were spliced')
        camera = row['camera'];require(isinstance(camera, dict), 'Room20 current lens missing')
        near = positive_number(camera.get('near'), 'Room20 actual lens near');require(positive_number(camera.get('fov'), 'Room20 actual FOV') <= 120,
                'Room20 lens exceeds finite FOV')
        require(camera.get('aspect') == 640/360 and positive_number(camera.get('far'), 'Room20 actual lens far') > near, 'Room20 lens format changed')
        require(len(row.get('bones', [])) == 15 and len(row.get('skinMatrices', [])) == sum(m['skinned'] for m in meshes), 'Room20 original bones/cache omitted')
        eligibility = row['eligibility'];require(isinstance(eligibility, list) and len(eligibility) == len(meshes), 'Room20 mesh eligibility omitted')
        eligible = set()
        for j, e in enumerate(eligibility):
            require(isinstance(e, list) and len(e) == 5 and type(e[0]) is int and e[0] == j and all(type(v) is bool for v in e[1:]) and
                    e[4] == (e[1] and e[2] and e[3]), 'Room20 object/material/layer eligibility contradicts flags')
            if e[4]:eligible.add(j)
        projection(row['projection'], 96753, set(range(len(meshes))), near);projection(row['mainBodyProjection'], 69777, {main_index}, near)
        if eligible:projection(row['eligibleProjection'], sum(meshes[j]['vertices'] for j in eligible), eligible, near)
        else:require(row['eligibleProjection'] is None, 'Room20 empty eligibility union fabricated')
        clipping = row['clipping'];require(isinstance(clipping, dict) and clipping.get('mainPlanes') == [] and
                clipping.get('unsupportedClippingRefused') is True and clipping.get('meshFlagEligibilityOnly') is True and
                camera.get('rig', {}).get('clipping') == [], 'Room20 unsupported actual clipping was accepted')
        materials = clipping.get('playerMaterials');require(isinstance(materials, list) and len(materials) == len(meshes), 'Room20 original material clipping omitted')
        for j, item in enumerate(materials):
            require(item.get('meshUuid') == meshes[j]['meshUuid'] and isinstance(item.get('materials'), list) and item['materials'] and
                    all(m.get('planes') == [] for m in item['materials']), 'Room20 unsupported original material clipping')
        require(row['materialProvenance'].get('pass') is True and isinstance(row['readPurity'], dict) and
            set(row['readPurity']) == {'physicalStateUnchanged', 'lensAndLocalAppearancePoseUnchanged',
                                      'preparedMatricesUnchanged', 'noForcedMatrixSkeletonRenderOrPhysicsUpdates'} and
            all(value is True for value in row['readPurity'].values()),
            'Room20 geometry read purity changed')
    last = records[-1];require(observation['finalClock'] == {'visualFrame': frames-1, 'worldStep': last['worldStep'],
        'worldStepOffset': offset, 'routePhysicsSteps': last['routePhysicsSteps'], 'routeSeconds': last['routeSeconds'], 'state': last['state']},
        'Room20 final clock is not the exact six-key last encoded capture')
    require(last['routePhysicsSteps'] == steps and last['state'] == 'won', 'Room20 terminal camera clock differs from victory')
    return source_identity


def check_foundation20_camera(binding, proof, report, receipt, expected):
    source_root = ordinary_directory(proof / 'review-artifacts/native-foundation20')
    exact_identity(report, {key: expected[key] for key in ('sourceCommit', 'sourceReview')}, 'Room20 source camera report')
    require(receipt == binding['foundation20']['receipt'] and receipt.get('reportSha256') == sha256_file(source_root / 'foundation20-native-report.json'),
            'Room20 source camera receipt/report bytes differ from binding')
    descriptor = foundation20_camera_descriptor(report.get('cameraDiagnostic'), report.get('video', {}).get('frames'))
    require(receipt.get('cameraDiagnostic') == descriptor and binding['foundation20']['receipt'].get('cameraDiagnostic') == descriptor,
            'Room20 camera report/receipt/package descriptor differs')
    raw = ordinary_file(unique_suffix(source_root, binding['artifacts']['nativeFoundation20']['files'], FOUNDATION20_CAMERA_FILE, 'Room20 camera'))
    require(raw == source_root / FOUNDATION20_CAMERA_FILE and raw.stat().st_size == descriptor['bytes'] and
            sha256_file(raw) == descriptor['sha256'], 'Room20 mandatory source camera bytes/hash changed')
    raw_row = next(row for row in binding['artifacts']['nativeFoundation20']['files'] if row['path'] == FOUNDATION20_CAMERA_FILE)
    require(raw_row == {'path': FOUNDATION20_CAMERA_FILE, 'bytes': descriptor['bytes'], 'sha256': descriptor['sha256']},
            'Room20 source raw descriptor differs from artifact inventory')
    observation = read_json(raw)
    source = read_json(unique_suffix(proof / 'review-artifacts/source', binding['artifacts']['source']['files'], 'source.json', 'Room20 source'))
    package = read_json(unique_suffix(proof / 'review-artifacts/source', binding['artifacts']['source']['files'], 'package.json', 'Room20 package'))
    for suffix in ('source.json', 'package.json'):
        filename = ordinary_file(unique_suffix(proof / 'review-artifacts/source', binding['artifacts']['source']['files'], suffix, 'Room20 source'))
        relative = filename.relative_to(proof / 'review-artifacts/source').as_posix()
        inventory_row = next(row for row in binding['artifacts']['source']['files'] if row['path'] == relative)
        require(inventory_row == {'path': relative, 'bytes': filename.stat().st_size, 'sha256': sha256_file(filename)},
                'Room20 external camera source/package inventory bytes changed')
    for name, value in [('source', source), ('package', package)]:
        exact_identity(value, {key: expected[key] for key in ('sourceCommit', 'sourceReview')}, 'Room20 camera ' + name)
    pins = foundation20_camera_pins(observation.get('sourceIdentity'), binding, source, package, expected)
    foundation20_camera_packet_summary(descriptor, observation, report, source_root / 'foundation20-telemetry.jsonl', pins)
    return pins


def check_foundation20_evidence(binding, proof, report, receipt, expected):
    source_expected = {key: expected[key] for key in ('sourceCommit', 'sourceReview')}
    exact_identity(report, source_expected, 'Room20 ordinary native report')
    require(report.get('pass') is True and report.get('errors') == [], 'Room20 native report did not pass')
    route = report.get('route')
    require(isinstance(route, dict) and route.get('kind') == 'ordinary-foundation20-physical-route' and
            route.get('edition') == 'foundation' and type(route.get('level')) is int and route['level'] == 20 and
            route.get('id') == 'foundation-portal-tension' and route.get('pass') is True and
            route.get('sameCompanion') is True and route.get('cargoMass') == 3.2,
            'Room20 proof is not the actual ordinary Foundation physical room')
    for key in ('resets', 'respawns', 'cargoResets'):
        require(type(route.get(key)) is int and route[key] == 0, 'Room20 ordinary route includes resets/respawns')
    require(receipt.get('pass') is True and receipt.get('edition') == 'foundation' and receipt.get('level') == 20 and
            type(receipt['level']) is int and receipt.get('roomId') == route['id'] and receipt.get('sameCargo') is True and
            receipt.get('cargoBodyId') == route.get('cargoBodyId') and receipt.get('resets') == 0,
            'Room20 bound receipt is not the actual Foundation original cargo route')
    require(receipt == binding['foundation20']['receipt'] and report.get('saveIsolation') == binding['foundation20']['saveIsolation'],
            'Room20 native report/receipt differs from package binding')
    require(receipt.get('previewSaveIsolation') == {'pass': True, 'namespace': FOUNDATION20_STORAGE_PREFIX,
                                                 'oldBytesUnchanged': True, 'phases': 8, 'replayLevel': 20,
                                                 'crossEntry': {'pass': True, 'level': 41, 'entry': 'tower41-native-v3',
                                                                'own20BytesUnchanged': True, 'peerBytesUnchanged': True, 'reloadVerified': True}},
            'Room20 native save summary changed')
    assert_foundation20_save_isolation(report['saveIsolation'])
    supplemental = foundation20_supplemental_structure(binding, expected)
    source_root = ordinary_directory(proof / 'review-artifacts/native-foundation20')
    for copied in supplemental['reviewedFiles']:
        source = ordinary_file(source_root / copied['sourcePath'])
        require(source.stat().st_size == copied['bytes'] and sha256_file(source) == copied['sha256'],
                'Room20 source movie/report bytes changed')
    report_file = ordinary_file(source_root / 'foundation20-native-report.json')
    require(receipt.get('reportSha256') == sha256_file(report_file), 'Room20 binding changed actual report bytes')
    require(receipt.get('buildInfoSha256') == binding.get('buildInfoSha256') and
            receipt.get('packageFilesSha256') == binding.get('packageFilesSha256'), 'Room20 source package/build binding changed')
    report_video = report.get('video')
    recording = supplemental['recording']
    require(isinstance(report_video, dict) and report_video.get('filename') == 'foundation20-physical.mp4' and
            report_video.get('fullMP4Decode') is True and report_video.get('last', {}).get('state') == 'won',
            'Room20 complete decoded ordinary movie missing')
    for name in ('bytes', 'sha256', 'frames', 'fps', 'width', 'height', 'durationSeconds', 'simulationSeconds'):
        require(report_video.get(name) == recording[name] and type(report_video[name]) is type(recording[name]),
                'Room20 supplemental movie relabels actual native metadata: ' + name)
    require(receipt.get('video') == {'file': report_video['filename'], 'bytes': report_video['bytes'],
                                  'sha256': report_video['sha256'], 'fullMP4Decode': True}, 'Room20 retained movie decode binding changed')
    telemetry = report.get('telemetry')
    require(isinstance(telemetry, dict) and telemetry.get('filename') == 'foundation20-telemetry.jsonl',
            'Room20 complete telemetry descriptor missing')
    telemetry_file = ordinary_file(source_root / telemetry['filename'])
    require(type(telemetry.get('bytes')) is int and telemetry['bytes'] == telemetry_file.stat().st_size and
            telemetry.get('sha256') == sha256_file(telemetry_file) and
            all(receipt.get('telemetry', {}).get(key) == value for key, value in
                {'file': telemetry['filename'], 'bytes': telemetry['bytes'], 'sha256': telemetry['sha256']}.items()),
            'Room20 complete telemetry bytes/hash changed')
    pixel = report_video.get('pixelCheck')
    require(isinstance(pixel, dict) and pixel.get('logFilename') == 'foundation20-native-pixels.log',
            'Room20 actual per-frame decoded pixel log descriptor missing')
    pixel_file = ordinary_file(source_root / pixel['logFilename'])
    require(type(pixel.get('logBytes')) is int and pixel['logBytes'] == pixel_file.stat().st_size and
            pixel.get('logSha256') == sha256_file(pixel_file), 'Room20 actual pixel log bytes/hash changed')
    minima = [int(value) for value in re.findall(r'lavfi\.signalstats\.YMIN=(\d+)', pixel_file.read_text())]
    maxima = [int(value) for value in re.findall(r'lavfi\.signalstats\.YMAX=(\d+)', pixel_file.read_text())]
    require(len(minima) == report_video['frames'] and len(maxima) == report_video['frames'],
            'Room20 actual pixel log lacks a sample for every encoded frame')
    ranges = [high - low for low, high in zip(minima, maxima)]
    require(all(value > 12 for value in ranges) and min(ranges) == pixel.get('minimumLuminanceRange') and
            receipt.get('pixelLog') == {'file': pixel['logFilename'], 'bytes': pixel['logBytes'], 'sha256': pixel['logSha256'],
                                        'frames': report_video['frames'], 'allNonblank': True, 'minimumLuminanceRange': min(ranges)},
            'Room20 complete decoded pixel witness changed')
    require(receipt.get('servedPackageSha256') == sha256_file(source_root / 'served-package.json') and
            receipt.get('peerServedPackageSha256') == sha256_file(source_root / 'peer-served-package.json'),
            'Room20 source/peer served package receipts changed')
    check_foundation20_camera(binding, proof, report, receipt, expected)
    return supplemental


def check_binding(binding, proof, candidate, expected):
    binding_structure(binding, expected)
    artifacts = binding.get('artifacts')
    require(isinstance(artifacts, dict) and set(artifacts) == set(ARTIFACT_NAMES), 'Exactly seven exact-review artifacts are required')
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
    require(isinstance(jobs, list) and len(jobs) == len(JOB_NAMES), 'Exactly six successful review jobs required')
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
                      'nativeContact': ('binding.json',), 'nativeCastle': ('binding.json', 'evidence.json', 'served-package.json', 'peer-served-package.json'),
                      'nativeFoundation20': ('binding.json', 'foundation20-native-report.json', 'served-package.json', 'peer-served-package.json'),
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
    camera = castle_evidence.get('cameraObservation')
    require(isinstance(camera, dict) and camera.get('file') == 'camera-observation.json' and
            binding.get('cameraObservation') == camera and castle.get('cameraObservation') == camera,
            'Castle live-camera descriptor differs from the frozen native evidence')
    integer(camera.get('bytes'), 'Castle live-camera bytes', 1, MAX_VERIFICATION_METADATA_BYTES)
    digest(camera.get('sha256'), 'Castle live-camera hash')
    camera_file = ordinary_file(proof / 'review-artifacts/native-castle' / camera['file'])
    require(camera_file.stat().st_size == camera['bytes'] and sha256_file(camera_file) == camera['sha256'],
            'Castle complete live-camera observation bytes/hash changed')
    pendulum = pendulum_event(castle_evidence)
    require(castle.get('pendulum') == pendulum and binding.get('pendulum') == pendulum, 'Pendulum binding differs from the exact physical witness')
    served = receipts['nativeCastle/served-package.json']
    require(served.get('pass') is True and served.get('files') == artifacts['build']['files'],
            'Native castle served package differs from the complete exact reviewed build')
    require(receipts['nativeCastle/peer-served-package.json'].get('pass') is True and
            receipts['nativeCastle/peer-served-package.json'].get('files') == artifacts['build']['files'],
            'Native castle peer entry differs from the complete exact reviewed build')
    require(castle_evidence.get('previewSaveIsolation') == binding['previewSaveIsolation'], 'Save proof differs from exact reviewed native evidence')
    evidence_path = unique_suffix(proof / 'review-artifacts/native-castle', artifacts['nativeCastle']['files'], 'evidence.json', 'Castle')
    require(castle.get('evidenceSha256') == sha256_file(evidence_path), 'Castle binding differs from native evidence bytes')
    require(castle.get('previewSaveIsolation') == {'pass': True, 'namespace': STORAGE_PREFIX, 'oldBytesUnchanged': True,
                                                  'phases': 8, 'replayLevel': 41,
                                                  'crossEntry': {'pass': True, 'level': 20, 'entry': 'foundation20-physical-v1',
                                                                 'own41BytesUnchanged': True, 'peerBytesUnchanged': True, 'reloadVerified': True}},
            'Castle save summary differs from reviewed proof')
    summary = receipts['summary/jobs.json']
    require(summary.get('allRequiredJobsPassed') is True and summary.get('jobs') ==
            {name: 'success' for name in JOB_NAMES if name != 'review-summary'}, 'Summary did not accept exact five upstream jobs')
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
    foundation20_receipt = receipts['nativeFoundation20/binding.json']
    foundation20_report = receipts['nativeFoundation20/foundation20-native-report.json']
    served20 = receipts['nativeFoundation20/served-package.json']
    require(served20.get('pass') is True and served20.get('files') == artifacts['build']['files'],
            'Room20 served package differs from the one entire exact reviewed build')
    require(receipts['nativeFoundation20/peer-served-package.json'].get('pass') is True and
            receipts['nativeFoundation20/peer-served-package.json'].get('files') == artifacts['build']['files'],
            'Room20 cross-entry visit must serve the one entire exact reviewed peer build')
    check_foundation20_evidence(binding, proof, foundation20_report, foundation20_receipt, expected)
    declared_entries = [{'path': entry['namespace'], 'level': entry['level'], 'levels': [entry['level']],
                         'savePrefix': entry['storagePrefix'], 'ordinaryControls': True} for entry in ENTRIES]
    require(info.get('features', {}).get('standaloneEntries') == declared_entries,
            'Source build metadata must declare exactly both actual new native entries')
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
            'saveIsolationScope': 'Nine snapshotted save namespaces, including the other new entry, remained byte-identical through eight observed load, settings, play, pause, resume, win, replay and reload phases. The own preference key was seeded before loading.',
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


def foundation20_generated_content(expected, binding):
    recording = binding['foundation20']['supplemental']['recording']
    report_row = next(row for row in binding['foundation20']['supplemental']['reviewedFiles'] if row['path'] == FOUNDATION20_REPORT)
    identity_record = {'schemaVersion': 1, **expected, 'level': 20, 'edition': 'foundation',
                       'recording': recording, 'report': {'filename': FOUNDATION20_REPORT, 'bytes': report_row['bytes'],
                                                         'sha256': report_row['sha256']},
                       'copiedFromExactReviewedArtifact': True, 'automaticContinuousRoute': True,
                       'humanPlaytestAccepted': False, 'physicalDeviceAccepted': False,
                       'replacement500StageTowerAccepted': False}
    status = {'schemaVersion': 1, **expected, 'path': FOUNDATION20_PREFIX, 'levels': [20],
              'storagePrefix': FOUNDATION20_STORAGE_PREFIX, 'ordinaryControls': True,
              'technicalAcceptance': True, 'saveIsolationAccepted': True, 'appendOnly': True,
              'masterSpecComplete': False, 'humanPlaytestAccepted': False, 'physicalDeviceAccepted': False,
              'sourcePackageFilesSha256': inventory_sha256(binding['artifacts']['build']['files']),
              'currentWalkthrough': {**recording, 'identity': SUPPLEMENTAL_IDENTITY},
              'scope': 'Ordinary Foundation20 near hook, unilateral cable, physical far contact and cargo return.'}
    webpage = f'''<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Комната 20 · Полное прохождение</title><style>body{{font-family:system-ui,sans-serif;background:#101625;color:#eef4ff;max-width:960px;margin:40px auto;padding:0 20px}}a{{color:#92cfff}}video{{width:100%;background:#080c15;border-radius:12px}}p{{line-height:1.6}}code{{overflow-wrap:anywhere}}</style>
<main><a href="./">← Играть в комнату 20</a><h1>Комната 20 · Трос и два стопора</h1>
<p>Полное автоматическое прохождение обычным управлением: ближний крюк, подвес друга, дальний стопор и возвращение к выходу.</p>
<video controls preload="metadata" playsinline src="{FOUNDATION20_VIDEO}"></video><p><a href="{FOUNDATION20_VIDEO}">Скачать полное видео</a></p>
<p>Видео длится {recording['durationSeconds']:.2f} с. Это техническая проверка прохождения; человеческая проверка исследования и физических устройств остаётся открытой.</p>
<details><summary>Версия и проверка</summary><p>Исходный код: <code>{html.escape(expected['sourceCommit'])}</code><br>SHA-256 видео: <code>{recording['sha256']}</code></p></details></main></html>'''
    return {'preview-status.json': json_bytes(status), 'walkthroughs.html': webpage.encode(),
            SUPPLEMENTAL_IDENTITY: json_bytes(identity_record)}


def generated_entry_content(expected, binding):
    return {**{PREFIX + name: data for name, data in generated_content(expected, binding).items()},
            **{FOUNDATION20_PREFIX + name: data for name, data in foundation20_generated_content(expected, binding).items()}}


def content_inventory(content):
    return sorted([{'path': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
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
    require(all(not (baseline_root / entry['namespace'][:-1]).exists() for entry in ENTRIES), 'Native preview namespace already exists')
    binding = read_json(binding_file)
    artifact_hashes = check_binding(binding, proof, candidate, expected)
    candidate_rows = inventory(candidate, MAX_CANDIDATE_BYTES)
    status = status_record(expected, binding)
    content = generated_entry_content(expected, binding)
    generated = content_inventory(content)
    supplemental_copies = supplemental_copied_rows(binding)
    added = sorted([{**row, 'path': entry['namespace'] + row['path']} for entry in ENTRIES for row in candidate_rows] + generated + supplemental_copies,
                   key=lambda row: row['path'])
    after_expected = sorted(before + added, key=lambda row: row['path'])
    checked_rows(after_expected, 'Append-only union', MAX_BYTES)
    require(not (proof / 'manifest.json').exists() and not (proof / 'baseline-manifest.json').exists(), 'Publication manifest already exists')
    temporary = staging_directory(site)
    try:
        shutil.copytree(baseline_root, temporary, dirs_exist_ok=True)
        for entry in ENTRIES:
            shutil.copytree(candidate, temporary / entry['namespace'])
        for entry, supplemental in [(ENTRIES[0], binding['foundation20']['supplemental']), (ENTRIES[1], binding['supplemental'])]:
            for copied in supplemental['reviewedFiles']:
                source = ordinary_file(proof / 'review-artifacts' / entry['artifactKind'] / copied['sourcePath'])
                with source.open('rb') as stream:
                    stream_to_file(stream, temporary / entry['namespace'] / copied['path'], copied['bytes'])
        for name, data in content.items():
            destination = temporary / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            with destination.open('xb') as stream:
                stream.write(data)
        after = inventory(temporary)
        require(after == after_expected, 'Assembly changed reviewed or accepted bytes')
        require(inventory(baseline_root) == before and inventory(candidate, MAX_CANDIDATE_BYTES) == candidate_rows,
                'An input changed during assembly')
        manifest = {**status, 'phase': 'published', 'preview': preview_scope(),
                    'entries': list(ENTRIES), 'candidateCopies': len(ENTRIES),
                    'baselinePublisherCommit': BASELINE_PUBLISHER, 'baselineSourceCommit': BASELINE_SOURCE,
                    'baselineSourceReview': BASELINE_REVIEW, 'baselinePagesArtifact': BASELINE_ARTIFACT,
                    'acceptedProofArtifact': ACCEPTED_PROOF_ARTIFACT,
                    'baselineFullPrivateArtifact': BASELINE_FULL_PRIVATE_ARTIFACT,
                    'baselineFullPrivateArchiveBytesDownloaded': False, 'baselineFullPrivateNestedArchiveAudited': False,
                    'baselineFiles': before, 'baselineBytes': BASELINE_BYTES, 'baselineFilesSha256': BASELINE_INVENTORY_SHA256,
                    'candidateFiles': candidate_rows, 'candidateBytes': sum(row['bytes'] for row in candidate_rows),
                    'candidateFilesSha256': inventory_sha256(candidate_rows), 'addedFiles': added,
                    'addedBytes': sum(row['bytes'] for row in added), 'generatedFiles': generated,
                    'supplementalCopiedFiles': supplemental_copies,
                    'supplementalCopiedBytes': sum(row['bytes'] for row in supplemental_copies),
                    'supplementalRecording': binding['supplemental']['recording'],
                    'foundation20SupplementalRecording': binding['foundation20']['supplemental']['recording'],
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


def check_recovery_lease(value):
    require(isinstance(value, dict) and value.get('pass') is True and value.get('publicationAccepted') is False and
            value.get('sourceAccepted') is True and value.get('kind') == 'exact-failed-after-deploy-R5-recovery-lease',
            'Exact failed-after-deploy recovery provenance required; failed PUBLIC is never accepted')
    for key, expected in RECOVERY.items():
        require(type(value.get(key)) is type(expected) and value[key] == expected, 'Pinned recovery lease changed: ' + key)
    exact_identity(value, {'sourceCommit': RECOVERY['sourceCommit'], 'sourceReview': RECOVERY['sourceReview']}, 'Recovery exact source lease')
    for key, count, size, digest_value in [('preflight', BASELINE_COUNT, BASELINE_BYTES, BASELINE_INVENTORY_SHA256),
                                         ('published', RECOVERY['currentFiles'], RECOVERY['currentBytes'], RECOVERY['currentInventorySha256'])]:
        receipt = value.get(key)
        exact_identity(receipt, {'sourceCommit': RECOVERY['sourceCommit'], 'publisherCommit': RECOVERY['failedPublisher'],
                       'publicationRun': RECOVERY['failedRun'], 'sourceReview': RECOVERY['sourceReview']}, 'Failed recovery ' + key)
        require(receipt.get('phase') == key and receipt.get('pass') is True and receipt.get('mainSiteUnchanged') is True and
                type(receipt.get('checked')) is int and receipt['checked'] == count and receipt.get('bytes') == size and
                receipt.get('siteFilesSha256') == digest_value, 'Actual failed-run PRE/POST full byte proof differs')
    require(value['published'].get('packageBindingSha256') == RECOVERY['failedBindingSha256'], 'Failed-run exact binding hash changed')
    return value


def check_recovery_manifest(manifest, phase, expected):
    exact_identity(manifest, expected, 'Recovery manifest')
    require(manifest.get('kind') == RECOVERY_KIND and phase in ('preflight', 'published') and manifest.get('phase') == phase,
            'Exact typed R5 recovery manifest required')
    require(expected['sourceCommit'] == RECOVERY['sourceCommit'] and expected['sourceReview'] == RECOVERY['sourceReview'] and
            expected['publisherCommit'] != RECOVERY['failedPublisher'], 'Recovery must retain the exact accepted R5 source in a fresh publisher')
    check_recovery_lease(manifest.get('recoveryLease'))
    binding = manifest.get('packageBinding');binding_structure(binding, expected)
    require(binding['coreSource']['tree'] == RECOVERY['sourceTree'], 'Recovery cannot substitute another source tree')
    retained = manifest.get('retainedFailedPackageBinding');old = dict(binding)
    old.update(publisherCommit=RECOVERY['failedPublisher'], publicationRun=RECOVERY['failedRun'])
    require(retained == old and manifest.get('retainedFailedPackageBindingSha256') == RECOVERY['failedBindingSha256'],
            'Retained failed publication identities and byte binding must remain unchanged')
    original = manifest.get('originalBaselineFiles');check_baseline(original)
    candidate = manifest.get('candidateFiles');checked_rows(candidate, 'Recovery exact source package', MAX_CANDIDATE_BYTES)
    require(candidate == binding['artifacts']['build']['files'], 'Recovery candidate differs from the exact accepted source package')
    old_identity = {'sourceCommit': RECOVERY['sourceCommit'], 'publisherCommit': RECOVERY['failedPublisher'],
                    'publicationRun': RECOVERY['failedRun'], 'sourceReview': RECOVERY['sourceReview']}
    generated = content_inventory(generated_entry_content(old_identity, retained))
    copies = supplemental_copied_rows(retained)
    reconstructed = sorted(original + [{**row, 'path': entry['namespace'] + row['path']} for entry in ENTRIES for row in candidate] + generated + copies,
                           key=lambda row: row['path'])
    checked_rows(reconstructed, 'Every retained current R5 public byte', MAX_BYTES)
    require(len(reconstructed) == RECOVERY['currentFiles'] and sum(row['bytes'] for row in reconstructed) == RECOVERY['currentBytes'] and
            inventory_sha256(reconstructed) == RECOVERY['currentInventorySha256'], 'Exact old1789 plus real R5 prefixes must reconstruct the current1957 union')
    require(manifest.get('baselineFiles') == reconstructed == manifest.get('siteFiles') and
            manifest.get('baselineBytes') == manifest.get('siteBytes') == RECOVERY['currentBytes'] and
            manifest.get('baselineFilesSha256') == manifest.get('siteFilesSha256') == RECOVERY['currentInventorySha256'],
            'Recovery PRE and POST must retain every current1957 byte')
    require(manifest.get('addedFiles') == [] and type(manifest.get('addedBytes')) is int and manifest['addedBytes'] == 0 and
            type(manifest.get('candidateCopies')) is int and manifest['candidateCopies'] == 0 and
            manifest.get('retainedCandidateCopies') == 2 and manifest.get('retainedPrefixGeneratedFiles') == generated and
            manifest.get('retainedSupplementalCopiedFiles') == copies, 'Recovery must reuse exact existing prefixes without overwriting proof identities')
    require(manifest.get('entries') == list(ENTRIES) and manifest.get('allCurrentPublicBytesUnchanged') is True and
            manifest.get('failedPublicAcceptanceWaived') is False, 'Recovery cannot waive fresh PUBLIC recording acceptance')
    for key, value in status_record(expected, binding).items():
        require(type(manifest.get(key)) is type(value) and manifest[key] == value, 'Recovery scope changed: ' + key)
    return reconstructed


def assemble_recovery(args):
    baseline_root, candidate, site, proof = disjoint_roots(args.baseline, args.candidate, args.site, args.proof)
    proof = ordinary_directory(proof);require(not site.exists(), 'Refuse overwrite of recovery site')
    expected = identity(args);binding_file = ordinary_file(args.binding)
    require(binding_file == proof / 'package-binding.json', 'Recovery uses the genuine current source binding')
    binding = read_json(binding_file);artifact_hashes = check_binding(binding, proof, candidate, expected)
    original = inventory(baseline_root);check_baseline(original)
    candidate_rows = inventory(candidate, MAX_CANDIDATE_BYTES)
    failed_file = ordinary_file(proof / 'failed-deployed-package-binding.json')
    require(sha256_file(failed_file) == RECOVERY['failedBindingSha256'], 'Full reconstructed failed binding bytes differ from actual POST hash')
    retained = read_json(failed_file);old = dict(binding);old.update(publisherCommit=RECOVERY['failedPublisher'], publicationRun=RECOVERY['failedRun'])
    require(retained == old, 'Recovery must retain the exact deployed source and historical prefix identities')
    lease = check_recovery_lease(read_json(proof / 'recovery-failed-provider.json')['lease'])
    old_identity = {'sourceCommit': RECOVERY['sourceCommit'], 'publisherCommit': RECOVERY['failedPublisher'],
                    'publicationRun': RECOVERY['failedRun'], 'sourceReview': RECOVERY['sourceReview']}
    content = generated_entry_content(old_identity, retained);temporary = staging_directory(site)
    try:
        shutil.copytree(baseline_root, temporary, dirs_exist_ok=True)
        for entry in ENTRIES:shutil.copytree(candidate, temporary / entry['namespace'])
        for entry, supplemental in [(ENTRIES[0], retained['foundation20']['supplemental']), (ENTRIES[1], retained['supplemental'])]:
            for copied in supplemental['reviewedFiles']:
                source = ordinary_file(proof / 'review-artifacts' / entry['artifactKind'] / copied['sourcePath'])
                require(source.stat().st_size == copied['bytes'] and sha256_file(source) == copied['sha256'], 'Retained actual source supplement differs')
                with source.open('rb') as stream:stream_to_file(stream, temporary / entry['namespace'] / copied['path'], copied['bytes'])
        for name, data in content.items():
            destination = temporary / name;destination.parent.mkdir(parents=True, exist_ok=True)
            with destination.open('xb') as stream:stream.write(data)
        rows = inventory(temporary)
        manifest = {**status_record(expected, binding), 'kind': RECOVERY_KIND, 'phase': 'published', 'entries': list(ENTRIES),
                    'recoveryLease': lease, 'allCurrentPublicBytesUnchanged': True, 'failedPublicAcceptanceWaived': False,
                    'originalBaselineFiles': original, 'candidateFiles': candidate_rows, 'candidateCopies': 0, 'retainedCandidateCopies': 2,
                    'retainedPrefixGeneratedFiles': content_inventory(content), 'retainedSupplementalCopiedFiles': supplemental_copied_rows(retained),
                    'retainedFailedPackageBinding': retained, 'retainedFailedPackageBindingSha256': sha256_file(failed_file),
                    'baselineFiles': rows, 'baselineBytes': RECOVERY['currentBytes'], 'baselineFilesSha256': RECOVERY['currentInventorySha256'],
                    'siteFiles': rows, 'siteBytes': RECOVERY['currentBytes'], 'siteFilesSha256': RECOVERY['currentInventorySha256'],
                    'addedFiles': [], 'addedBytes': 0, 'reviewArtifactFilesSha256': artifact_hashes,
                    'packageBinding': binding, 'packageBindingSha256': sha256_file(binding_file)}
        check_recovery_manifest(manifest, 'published', expected)
        require(inventory(baseline_root) == original and inventory(candidate, MAX_CANDIDATE_BYTES) == candidate_rows, 'Recovery changed an immutable input')
        temporary.rename(site);temporary = None
        write_new_json(proof / 'manifest.json', manifest);write_new_json(proof / 'baseline-manifest.json', {**manifest, 'phase': 'preflight'})
        print(json.dumps({'pass': True, **expected, 'kind': RECOVERY_KIND, 'preservedFiles': len(rows), 'preservedBytes': RECOVERY['currentBytes'],
                          'addedFiles': 0, 'siteFilesSha256': RECOVERY['currentInventorySha256'], 'freshPublicCapturesStillRequired': True}))
    finally:
        if temporary is not None:shutil.rmtree(temporary)


def check_manifest(manifest, phase, expected):
    if isinstance(manifest, dict) and manifest.get('kind') == RECOVERY_KIND:
        return check_recovery_manifest(manifest, phase, expected)
    exact_identity(manifest, expected, 'Publication manifest')
    require(manifest.get('phase') == phase and phase in ('preflight', 'published'), 'Proof phase mismatch')
    binding = manifest.get('packageBinding')
    binding_structure(binding, expected)
    require_preview(manifest.get('preview'), 'Manifest')
    require(manifest.get('entries') == list(ENTRIES) and type(manifest.get('candidateCopies')) is int and
            manifest['candidateCopies'] == len(ENTRIES), 'Manifest current entry/package copies mismatch')
    require(manifest.get('baselineFullPrivateArtifact') == BASELINE_FULL_PRIVATE_ARTIFACT and
            manifest.get('baselineFullPrivateArchiveBytesDownloaded') is False and
            manifest.get('baselineFullPrivateNestedArchiveAudited') is False,
            'Manifest must preserve honest old full-private provider binding')
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
    require(all(any(name.startswith(entry['namespace']) for entry in ENTRIES) for name in added), 'Appended file escaped native namespace')
    baseline_map = checked_rows(baseline_rows, 'Manifest baseline')
    require(not (set(added) & set(baseline_map)), 'Appended namespace overwrites accepted files')
    generated = content_inventory(generated_entry_content(expected, binding))
    supplemental_copies = supplemental_copied_rows(binding)
    expected_added = sorted([{**row, 'path': entry['namespace'] + row['path']} for entry in ENTRIES for row in candidate_rows] + generated + supplemental_copies,
                           key=lambda row: row['path'])
    require(added_rows == expected_added and manifest.get('generatedFiles') == generated, 'Generated or reviewed appended bytes changed')
    require(manifest.get('supplementalCopiedFiles') == supplemental_copies and type(manifest.get('supplementalCopiedBytes')) is int and
            manifest['supplementalCopiedBytes'] == sum(row['bytes'] for row in supplemental_copies) and
            manifest.get('supplementalRecording') == binding['supplemental']['recording'], 'Supplemental movie/report inventory or identity changed')
    require(manifest.get('foundation20SupplementalRecording') == binding['foundation20']['supplemental']['recording'],
            'Room20 supplemental recording identity changed')
    require(type(manifest.get('addedBytes')) is int and manifest['addedBytes'] == sum(row['bytes'] for row in added_rows), 'Appended byte count mismatch')
    union = sorted(baseline_rows + added_rows, key=lambda row: row['path'])
    checked_rows(union, 'Complete union', MAX_BYTES)
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
            endpoints.extend([entry['namespace'] + filename for entry in ENTRIES for filename in ('build-info.json', 'preview-status.json')])
        for path in endpoints:
            require(path in row_map, 'Missing identifying public file: ' + path)
            one(row_map[path])
        report.update({'pass': True, 'checked': len(lengths), 'bytes': sum(lengths), 'mainSiteUnchanged': True,
                       'baselineFilesSha256': manifest['baselineFilesSha256'], 'siteFilesSha256': manifest['siteFilesSha256'],
                       'packageBindingSha256': manifest['packageBindingSha256']})
        print(json.dumps(report))
    except Exception as error:
        report['error'] = str(error)
        raise
    finally:
        write_new_json(output, report)


def assert_public_castle_packet_report(public, expected):
    """Recheck route and save semantics before a packet can declare pass."""
    require(isinstance(public, dict) and public.get('sourceCommit') == expected['sourceCommit'] and
            public.get('errors') == [], 'Public castle has stale source or runtime errors')
    result, observed = public.get('result'), public.get('observed')
    require(isinstance(result, dict) and isinstance(observed, dict) and result.get('pass') is True and
            result.get('sameCompanion') is True, 'Public castle lacks the same original completed route')
    for name in ('resets', 'respawns', 'cargoResets'):
        require(type(result.get(name)) is int and result[name] == 0, 'Public castle reset counter changed: ' + name)
    require(type(observed.get('seenResets')) is int and observed['seenResets'] == 0,
            'Public castle observed a reset')
    ids = ['freight', 'sluice', 'optics', 'hoist', 'archive', 'flywheel', 'magnet', 'migrant', 'pendulum', 'inertia', 'crown']
    metrics = result.get('metrics')
    require(isinstance(metrics, dict) and metrics.get('won') is True and metrics.get('checkpoints') is False and
            type(metrics.get('completedStages')) is int and metrics['completedStages'] == len(ids) and
            metrics.get('solvedIds') == ids, 'Public castle omitted or relabelled a completed mechanism')
    events = observed.get('events')
    require(isinstance(events, list) and len(events) == len(ids) and
            all(isinstance(event, dict) for event in events) and [event.get('id') for event in events] == ids,
            'Public castle requires every actual ordinary mechanism event in order')
    integer(observed.get('bodyId'), 'Public castle original cargo body', 1)
    frames = integer(result.get('frames'), 'Public castle visual frames', 1)
    steps = integer(result.get('physicsSteps'), 'Public castle physics steps', 1)
    require(steps in (frames * 2, frames * 2 - 1) and
            positive_number(result.get('seconds'), 'Public castle seconds') == steps / 120,
            'Public castle actual 120Hz clock changed')
    isolation = assert_preview_save_isolation(public.get('previewSaveIsolation'))
    require(isolation['bareEntry'].get('url') == 'https://amazin20.github.io/brainrot-portal/tower41-native-v3/' and
            isolation['crossEntry'].get('sourceCommit') == expected['sourceCommit'],
            'Public castle must observe both actual public bare entries from the same source')
    video = public.get('video')
    require(isinstance(video, dict), 'Public castle complete movie metadata missing')
    count = integer(video.get('frames'), 'Public castle encoded frames', 1)
    for name, value in (('fps', 4), ('stride', 15), ('width', 640), ('height', 360)):
        require(type(video.get(name)) is int and video[name] == value, 'Public castle capture format changed: ' + name)
    terminal = (frames - 1) % video['stride'] != 0
    require(video.get('terminalSample') is terminal and type(video.get('lastVisualFrame')) is int and
            video['lastVisualFrame'] == frames - 1 and
            count == (frames - 1) // video['stride'] + 1 + int(terminal),
            'Public castle movie omitted or padded actual captures')
    require(video.get('durationSeconds') == count / video['fps'] and
            video.get('simulationSeconds') == result['seconds'] and
            abs(video['durationSeconds'] - result['seconds']) <= 2 / video['fps'] + 1 / 120 + .01,
            'Public castle movie was relabelled or stretched')
    require(video.get('first', {}).get('state') == 'playing' and video['first'].get('solved') == [] and
            video.get('last', {}).get('state') == 'won' and video['last'].get('solved') == ids,
            'Public castle must record the real initial and final states')
    return result, observed, video


def assert_public_foundation20_packet_report(report, expected):
    """Reject contradictory current20 route, timeline and capture declarations."""
    exact_identity(report, {key: expected[key] for key in ('sourceCommit', 'sourceReview')}, 'Public room20 native report')
    require(report.get('pass') is True and report.get('errors') == [], 'Public room20 report has runtime errors')
    route, observed, video = report.get('route'), report.get('observed'), report.get('video')
    require(isinstance(route, dict) and route.get('kind') == 'ordinary-foundation20-physical-route' and
            route.get('edition') == 'foundation' and type(route.get('level')) is int and route['level'] == 20 and
            route.get('id') == 'foundation-portal-tension' and route.get('pass') is True and
            route.get('sameCompanion') is True and route.get('cargoMass') == 3.2,
            'Public room20 is not the same original ordinary physical route')
    for name in ('resets', 'respawns', 'cargoResets'):
        require(type(route.get(name)) is int and route[name] == 0, 'Public room20 reset counter changed: ' + name)
    frames = integer(route.get('frames'), 'Public room20 visual frames', 301)
    steps = integer(route.get('physicsSteps'), 'Public room20 physics steps', 1)
    require(steps in (2*frames, 2*frames-1) and positive_number(route.get('seconds'), 'Public room20 seconds') == steps/120,
            'Public room20 actual route clock changed')
    require(isinstance(observed, dict) and observed.get('samples') == frames and type(observed['samples']) is int and
            observed.get('bodyId') == route.get('cargoBodyId') and
            all(type(observed.get(name)) is int and observed[name] == steps for name in ('completedPostSteps', 'forceSamples')) and
            type(observed.get('postStepsStart')) is int and type(observed.get('postStepsFinish')) is int and
            observed['postStepsStart'] >= 0 and observed['postStepsFinish'] - observed['postStepsStart'] == steps,
            'Public room20 omitted actual world steps or force observations')
    body_id = integer(route.get('cargoBodyId'), 'Public room20 original cargo body', 0)
    start, finish, milestones = route.get('start'), route.get('finish'), route.get('milestones')
    require(isinstance(start, dict) and isinstance(finish, dict) and isinstance(milestones, list),
            'Public room20 actual route timeline missing')
    for point in [start] + milestones + [finish]:
        require(isinstance(point, dict) and point.get('cargoBodyId') == body_id and type(point['cargoBodyId']) is int and
                point.get('cargoMass') == 3.2 and point.get('cargoDynamic') is True and point.get('edition') == 'foundation' and
                type(point.get('level')) is int and point['level'] == 20 and point.get('id') == route['id'],
                'Public room20 timeline replaced the actor or room')
        frame = integer(point.get('frame'), 'Public room20 timeline frame', 0, frames)
        seconds = point.get('seconds');require(type(seconds) in (int, float) and math.isfinite(seconds) and seconds >= 0,
                                             'Public room20 timeline time invalid')
        count = round(seconds*120)
        require(abs(count-seconds*120) < 1e-7 and count == (steps if frame == frames else frame*2) and
                type(point.get('worldStep')) is int and point['worldStep'] == observed['postStepsStart']+count,
                'Public room20 timeline contradicts its actual world clock')
    names = ['same finite E slips while the near hook carries the closing spring',
             'true current cable tension unloads the physically loaded near hook',
             'same finite E withdraws the now unloaded near hook',
             'actual cable force advances the same two-leaf gate train',
             'far solid contact retains the gate train after actual cable force falls to zero',
             'same original cargo recovered through the grounded side service opening',
             'both travellers return through the physically retained linked door']
    selected = []
    for name in names:
        matches = [point for point in milestones if point.get('name') == name]
        require(len(matches) == 1, 'Public room20 requires exactly one causal milestone: ' + name)
        selected.append(matches[0])
    require(all(left['frame'] < right['frame'] for left, right in zip(selected, selected[1:])),
            'Public room20 causal timeline was reordered')
    require(start.get('state') == 'playing' and start['frame'] == 0 and start['seconds'] == 0 and
            finish.get('state') == 'won' and finish.get('held') is True and finish['frame'] == frames and
            finish['seconds'] == route['seconds'] and selected[-1].get('state') == 'won',
            'Public room20 omitted actual initial or final cargo return')
    require(isinstance(video, dict) and video.get('filename') == 'foundation20-physical.mp4' and
            video.get('fullMP4Decode') is True, 'Public room20 lacks the decoded ordinary movie')
    count = integer(video.get('frames'), 'Public room20 encoded frames', 1)
    for name, value in (('fps', 4), ('stride', 15), ('width', 640), ('height', 360)):
        require(type(video.get(name)) is int and video[name] == value, 'Public room20 capture format changed: ' + name)
    terminal = (frames-1) % video['stride'] != 0
    require(video.get('terminalSample') is terminal and type(video.get('lastVisualFrame')) is int and
            video['lastVisualFrame'] == frames-1 and count == (frames-1)//video['stride']+1+int(terminal) and
            video.get('durationSeconds') == count/video['fps'] and video.get('simulationSeconds') == route['seconds'] and
            abs(video['durationSeconds']-route['seconds']) <= 2/video['fps']+1/120+.01,
            'Public room20 movie clocks were relabelled or padded')
    for point in (video.get('first'), video.get('last')):
        require(isinstance(point, dict) and type(point.get('cargoBodyId')) is int and point['cargoBodyId'] == body_id and
                point.get('cargoMass') == 3.2 and point.get('cargoDynamic') is True and point.get('edition') == 'foundation' and
                type(point.get('level')) is int and point['level'] == 20 and point.get('id') == route['id'],
                'Public room20 encoded first/last actor was replaced')
    require(video['first'].get('state') == 'playing' and video['first'].get('visualFrame') == 0 and
            video['last'].get('state') == 'won' and video['last'].get('visualFrame') == frames-1 and
            video['last'].get('seconds') == route['seconds'], 'Public room20 encoded endpoints contradict the route')
    assert_foundation20_save_isolation(report.get('saveIsolation'))
    require(report['saveIsolation']['bareEntry']['url'] == 'https://amazin20.github.io/brainrot-portal/foundation20-physical-v1/',
            'Public room20 omitted its actual bare public entry')
    return video


def assert_public_camera_packet_summary(camera, observation, result, observed, video, expected):
    """Bind the scoped summary to retained optical rows; the Node gate verifies all geometry."""
    fields = {'file', 'bytes', 'sha256', 'pass', 'sampleRateHz', 'encodedSamples', 'verticesPerSample', 'bones',
              'measuredVertexSamples', 'maxFov', 'allEncodedOriginalSkinSamplesInside', 'originalCargoBodyId',
              'geometryBytesUnchanged', 'readOnlyPurity', 'ordinaryAimInputs', 'scope', 'allCameraAccepted'}
    require(isinstance(camera, dict) and set(camera) == fields and camera.get('pass') is True and
            camera.get('allCameraAccepted') is False, 'Public camera descriptor makes an unsupported acceptance claim')
    require(isinstance(observation, dict) and observation.get('kind') == 'actual-complete-native-camera-observer' and
            observation.get('runtimeObserved') is True and observation.get('accepted') is False and
            observation.get('allCameraAccepted') is False and observation.get('fullRoomAccepted') is False and
            observation.get('allEncodedSamplesInside') is True and
            observation.get('encodedSamplesOutside') == [], 'Public camera raw observation contradicts its declared scope')
    integrity, resets = observation.get('dataIntegrity'), observation.get('resetCounters')
    require(isinstance(integrity, dict) and all(integrity.get(key) is True for key in
                ('everyActualNativeCaptureBound', 'allActualFramesAndWorldStepsObserved', 'readPurityGuardsPassed')),
            'Public camera capture/world-clock or read-only integrity contradicts its summary')
    require(isinstance(resets, dict) and len(resets) == 5 and
            all(type(value) is int and value == 0 for value in resets.values()), 'Public camera observed a reset')
    identity = observation.get('sourceIdentity')
    exact_identity(identity, {key: expected[key] for key in ('sourceCommit', 'sourceReview')}, 'Public camera source')
    model = observation.get('identity')
    require(isinstance(model, dict) and type(model.get('cargoBodyId')) is int and model['cargoBodyId'] == observed['bodyId'] and
            type(model.get('vertices')) is int and model['vertices'] == 96753 and
            type(model.get('bones')) is int and model['bones'] == 15, 'Public camera omitted the original actor')
    digest(model.get('initialAppearanceSha256'), 'Public camera original appearance hash')
    require(model.get('finalAppearanceSha256') == model['initialAppearanceSha256'], 'Public camera appearance changed')
    route = observation.get('route')
    require(isinstance(route, dict) and route.get('pass') is True and route.get('sameCompanion') is True and
            all(route.get(key) == result[key] for key in ('frames', 'physicsSteps', 'seconds')) and
            route.get('solvedIds') == result['metrics']['solvedIds'], 'Public camera observed a different route')
    rows, bindings = observation.get('records'), observation.get('encodedBindings')
    require(isinstance(rows, list) and isinstance(bindings, list) and len(rows) == len(bindings) == video['frames'],
            'Public camera requires one optical row for every encoded frame')
    max_fov = 0
    for index, (sample, binding) in enumerate(zip(rows, bindings)):
        terminal = video['terminalSample'] and index == len(rows) - 1
        require(isinstance(sample, dict) and isinstance(binding, dict) and type(binding.get('encodedFrame')) is int and
                binding['encodedFrame'] == index and binding.get('terminal') is terminal and
                type(binding.get('visualFrame')) is int and
                binding['visualFrame'] == (result['frames'] - 1 if terminal else index * video['stride']) and
                sample.get('encodedBinding') == binding and type(sample.get('visualFrame')) is int and sample['visualFrame'] == binding['visualFrame'],
                'Public camera capture row was omitted or relabelled')
        projection = sample.get('bodyVertexProjection')
        require(isinstance(projection, dict) and projection.get('insideLens') is True and
                type(projection.get('vertices')) is int and projection['vertices'] == 96753 and
                type(projection.get('bones')) is int and projection['bones'] == 15 and
                all(type(projection.get(key)) is int and projection[key] == 0 for key in
                    ('outsideLensCount', 'behindCount', 'nearCount')), 'Public camera skin is outside the lens')
        lens = sample.get('camera')
        require(isinstance(lens, dict), 'Public camera actual lens missing')
        fov = positive_number(lens.get('fov'), 'Public camera FOV')
        require(fov <= 120, 'Public camera exceeds its finite lens budget')
        max_fov = max(max_fov, fov)
    require(camera.get('sampleRateHz') == video['fps'] and type(camera.get('encodedSamples')) is int and
            camera['encodedSamples'] == len(rows) and type(camera.get('verticesPerSample')) is int and
            camera['verticesPerSample'] == 96753 and type(camera.get('bones')) is int and camera['bones'] == 15 and
            type(camera.get('measuredVertexSamples')) is int and camera['measuredVertexSamples'] == len(rows) * 96753 and
            camera.get('maxFov') == max_fov and type(camera.get('originalCargoBodyId')) is int and camera['originalCargoBodyId'] == observed['bodyId'] and
            all(camera.get(key) is True for key in ('allEncodedOriginalSkinSamplesInside', 'geometryBytesUnchanged',
                                                  'readOnlyPurity', 'ordinaryAimInputs')) and
            isinstance(camera.get('scope'), str) and len(camera['scope']) > 0,
            'Public camera scoped summary differs from its actual retained samples')


def verification_bundle(args):
    """Retain current metadata and both complete public movies without images, archives or production copies."""
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
    result, observed, video = assert_public_castle_packet_report(public, expected)
    pendulum_event(public)
    camera = public.get('cameraObservation')
    require(isinstance(camera, dict) and camera.get('file') == 'camera-observation.json',
            'Verification requires the actual full public castle live-camera observation')
    integer(camera.get('bytes'), 'Public camera bytes', 1, MAX_VERIFICATION_METADATA_BYTES)
    public_camera = ordinary_file(proof / 'public-native' / camera['file'])
    require(public_camera.stat().st_size == camera['bytes'] and
            sha256_file(public_camera) == digest(camera.get('sha256'), 'Public camera hash'),
            'Public camera observation bytes/hash changed')
    assert_public_camera_packet_summary(camera, read_json(public_camera), result, observed, video, expected)
    video = public.get('video')
    require(isinstance(video, dict) and isinstance(video.get('filename'), str) and
            re.fullmatch(r'[A-Za-z0-9_-]+\.mp4', video['filename']), 'Verification needs an ordinary public MP4 basename')
    video_name = 'public-native/' + video['filename']
    movie = ordinary_file(proof / video_name)
    require(movie.stat().st_size > 0 and movie.stat().st_size <= MAX_VERIFICATION_BYTES and
            sha256_file(movie) == digest(video.get('sha256'), 'Verification public movie hash'), 'Verification public movie bytes changed')
    room20 = read_json(proof / 'public-foundation20/foundation20-native-report.json')
    video20 = assert_public_foundation20_packet_report(room20, expected)
    binding = read_json(proof / 'package-binding.json')
    require(binding == manifest.get('packageBinding') and sha256_file(proof / 'package-binding.json') == manifest.get('packageBindingSha256'),
            'Verification Room20 binding differs from the accepted package manifest')
    source20_root = proof / 'review-artifacts/native-foundation20'
    source20_report = read_json(source20_root / 'foundation20-native-report.json')
    source20_receipt = read_json(source20_root / 'binding.json')
    source20_identity = check_foundation20_camera(binding, proof, source20_report, source20_receipt, expected)
    descriptor20 = foundation20_camera_descriptor(room20.get('cameraDiagnostic'), video20['frames'])
    public20_camera = ordinary_file(proof / 'public-foundation20' / FOUNDATION20_CAMERA_FILE)
    require(public20_camera.stat().st_size == descriptor20['bytes'] and sha256_file(public20_camera) == descriptor20['sha256'],
            'Public room20 mandatory camera bytes/hash changed')
    foundation20_camera_packet_summary(descriptor20, read_json(public20_camera), room20,
        proof / 'public-foundation20/foundation20-telemetry.jsonl', source20_identity)
    video20_name = 'public-foundation20/' + video20['filename']
    movie20 = ordinary_file(proof / video20_name)
    require(type(video20.get('bytes')) is int and video20['bytes'] == movie20.stat().st_size and
            0 < movie20.stat().st_size <= MAX_VERIFICATION_BYTES and
            sha256_file(movie20) == digest(video20.get('sha256'), 'Verification public20 movie hash'),
            'Verification public20 movie bytes changed')
    movies = [(movie20, video20_name), (movie, video_name)]
    selected, total = [], sum(filename.stat().st_size for filename, _ in movies)
    require(total <= MAX_VERIFICATION_BYTES, 'Both full public movies exceed the combined bounded packet budget')
    # Every retained path is checked even when its payload is not selected for transport.
    for filename in sorted(proof.rglob('*')):
        mode = filename.lstat().st_mode
        require(stat.S_ISREG(mode) or stat.S_ISDIR(mode), 'Non-regular retained proof path: ' + str(filename))
        if stat.S_ISDIR(mode):
            continue
        name = safe_name(filename.relative_to(proof).as_posix())
        if name.startswith('downloads/') or name.startswith('review-artifacts/build/'):
            continue
        if filename.suffix not in ('.json', '.log', '.txt', '.csv', '.jsonl'):
            continue
        size = integer(filename.stat().st_size, 'Verification metadata file size', maximum=MAX_VERIFICATION_METADATA_BYTES)
        total += size
        require(total <= MAX_VERIFICATION_BYTES and len(selected) < MAX_ENTRIES, 'Verification packet exceeds bounded transport budget')
        selected.append((filename, name))
    require(any(name == 'manifest.json' for _, name in selected) and any(name == 'package-binding.json' for _, name in selected),
            'Verification packet lacks identity/packet metadata')
    require({'review-artifacts/native-foundation20/' + FOUNDATION20_CAMERA_FILE,
             'public-foundation20/' + FOUNDATION20_CAMERA_FILE,
             'review-artifacts/native-foundation20/foundation20-telemetry.jsonl',
             'public-foundation20/foundation20-telemetry.jsonl'} <= {name for _, name in selected},
            'Verification packet must retain both complete Room20 camera raws and JSONL streams')
    selected.extend(movies)
    selected.sort(key=lambda pair: pair[1])
    rows = [{'path': name, 'bytes': filename.stat().st_size, 'sha256': sha256_file(filename)} for filename, name in selected]
    checked_rows(rows, 'Verification packet', MAX_VERIFICATION_BYTES)
    record = {'schemaVersion': 1, 'kind': 'foundation20-and-tower41-native-public-verification-packet', **expected,
              'pass': True, 'files': rows, 'bytes': total, 'filesSha256': inventory_sha256(rows),
              'maximumBytes': MAX_VERIFICATION_BYTES, 'fullPrivateProofRequiredForFinalAcceptance': True,
              'passScope': 'This bounded packet binds current public verification metadata, the completed public HTTP byte verification receipt and both complete public movies. It does not accept unread private archive payloads.',
              'fullPrivateProofRequirementScope': 'Provider retention and digest binding of prior and current publication proof artifacts must be checked separately. Archive payload and nested-archive audits are not claimed by this packet.',
              'fullPrivateArchiveBytesDownloaded': False, 'fullPrivateNestedArchiveAudited': False, 'privateArchiveAccepted': False,
              'independentPublicUnionReconstructionRequiredForCheckpointAcceptance': True,
              'completePublicMovie': {'path': video_name, 'bytes': movie.stat().st_size, 'sha256': video['sha256']},
              'completePublicMovies': [{'entry': 'foundation20', 'path': video20_name, 'bytes': movie20.stat().st_size, 'sha256': video20['sha256']},
                                      {'entry': 'tower41', 'path': video_name, 'bytes': movie.stat().st_size, 'sha256': video['sha256']}],
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
    recovery_assembly = sub.add_parser('assemble-recovery')
    for flag in ('baseline', 'candidate', 'site', 'proof', 'binding', 'source', 'publisher', 'run', 'review-run', 'review-attempt'):
        recovery_assembly.add_argument('--' + flag, required=True)
    verification = sub.add_parser('verify')
    for flag in ('base', 'manifest', 'output', 'source', 'publisher', 'run', 'review-run', 'review-attempt'):
        verification.add_argument('--' + flag, required=True)
    verification.add_argument('--phase', required=True, choices=('preflight', 'published'))
    bundle = sub.add_parser('verification-bundle')
    for flag in ('proof', 'output', 'source', 'publisher', 'run', 'review-run', 'review-attempt'):
        bundle.add_argument('--' + flag, required=True)
    args = parser.parse_args()
    {'extract': extract, 'extract-accepted': extract_accepted, 'baseline': baseline, 'assemble': assemble, 'assemble-recovery': assemble_recovery, 'verify': verify, 'verification-bundle': verification_bundle}[args.command](args)


if __name__ == '__main__':
    main()
