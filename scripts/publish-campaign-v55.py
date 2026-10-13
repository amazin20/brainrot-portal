"""Byte-preserving campaign-v55 assembly and complete public GET verification.

Production commands require frozen, independently accepted SOURCE and baseline
pins. Small expected inventories can be injected only into pure test functions;
the command line always uses the exact 1957-file production baseline.
"""
import argparse
import collections
import concurrent.futures
import hashlib
import json
import math
import os
import pathlib
import re
import shutil
import stat
import struct
import subprocess
import tarfile
import tempfile
import time
import urllib.parse
import urllib.request
import zipfile

REPOSITORY = 'amazin20/brainrot-portal'
PUBLIC_BASE = 'https://amazin20.github.io/brainrot-portal/'
NAMESPACE = 'campaign-v55/'
LIMITS = {'candidateBytes': 100_000_000, 'siteBytes': 700_000_000,
          'boundedVerificationBytes': 100_000_000, 'metadataBytes': 25_000_000,
          'privateProofBytes': 2_000_000_000}
BASELINE = {'files': 1957, 'bytes': 633_671_648,
            'inventorySha256': 'd76664e04f5ac2f2b161d9af10da1aa2299df13cfec51a243659d2b732be13c6'}
MAX_ENTRIES = 10_000
CHUNK = 1024 * 1024
METADATA_SUFFIXES = ('.json', '.jsonl', '.tap', '.txt', '.log')
GROUPS = {'early': list(range(1, 11)), 'energy': list(range(11, 21)),
          'living': list(range(21, 31)), 'optics': list(range(31, 41)),
          'fracture': list(range(42, 52)), 'castle': [41]}
BROWSER_STEP = 'Run export CHROME_PATH="$(command -v google-chrome || command -v chromium)"'
SOURCE_ROLES = {'build': ('campaign-polish-dist', ['Run npm run build', 'Run node scripts/stamp-build.mjs',
                                               'Run node scripts/v8-package-check.mjs']),
                'castle-shortcuts': ('campaign-polish-castle-shortcuts', ['Run node scripts/qa-campaign-castle-shortcuts.mjs']),
                'presentation': ('campaign-polish-presentation', [BROWSER_STEP] * 3),
                'storage-isolation': ('campaign-polish-storage-isolation', [BROWSER_STEP])}
for part in range(6):
    SOURCE_ROLES['cpu (' + str(part) + ')'] = ('campaign-polish-cpu-' + str(part), ['Run node scripts/qa-campaign-cpu-part.mjs'])
for group, levels in GROUPS.items():
    suffix = ' (' + group + ', ' + ','.join(map(str, levels)) + ')'
    SOURCE_ROLES['ordinary' + suffix] = ('campaign-polish-ordinary-' + group, ['Run node scripts/qa-campaign-ordinary.mjs'])
    SOURCE_ROLES['native' + suffix] = ('campaign-polish-native-' + group, [BROWSER_STEP])
for group, levels in (('early', '1-25'), ('late', '26-40,42-51')):
    SOURCE_ROLES['shortcuts (' + group + ', ' + levels + ')'] = ('campaign-polish-shortcuts-' + group,
        ['Run node scripts/qa-campaign-shortcuts.mjs --levels=' + levels + ' --out=qa/shortcuts-' + group + '/report.json'])


def require(condition, message):
    if not condition:
        raise ValueError(message)


def integer(value, label, minimum=0, maximum=2**53-1):
    require(type(value) is int and minimum <= value <= maximum, label + ' is not a bounded integer')
    return value


def digest(value, label='SHA-256'):
    require(isinstance(value, str) and re.fullmatch('[0-9a-f]{64}', value), label + ' is not an exact SHA-256')
    return value


def commit(value, label='commit'):
    require(isinstance(value, str) and re.fullmatch('[0-9a-f]{40}', value), label + ' is not an exact Git SHA')
    return value


def exact_equal(left, right):
    if type(left) is not type(right):
        return False
    if isinstance(left, dict):
        return left.keys() == right.keys() and all(exact_equal(left[key], right[key]) for key in left)
    if isinstance(left, list):
        return len(left) == len(right) and all(exact_equal(a, b) for a, b in zip(left, right))
    return left == right


def safe_name(value):
    require(isinstance(value, str) and value and not value.startswith('/') and '\\' not in value,
            'Unsafe member path: ' + repr(value))
    require(not any(ord(c) < 32 or ord(c) == 127 or 0xD800 <= ord(c) <= 0xDFFF for c in value),
            'Control/null/invalid character in member path')
    require(len(value.encode('utf-8')) <= 2048 and len(value.split('/')) <= 64, 'Member path length/depth exceeds bound')
    require(all(part not in ('', '.', '..') for part in value.split('/')) and
            not re.match('^[A-Za-z]:', value), 'Noncanonical or drive-qualified member path: ' + value)
    return value


def no_symlinks(value):
    path = pathlib.Path(os.path.abspath(value))
    for item in (path, *path.parents):
        require(not item.is_symlink(), 'Path or parent is a symlink: ' + str(item))
        if item.exists():
            require(stat.S_ISREG(item.lstat().st_mode) or stat.S_ISDIR(item.lstat().st_mode),
                    'Special filesystem path: ' + str(item))
    return path


def ordinary_file(value):
    path = no_symlinks(value)
    require(path.is_file() and stat.S_ISREG(path.lstat().st_mode), 'Expected ordinary file: ' + str(path))
    return path


def ordinary_directory(value):
    path = no_symlinks(value)
    require(path.is_dir() and stat.S_ISDIR(path.lstat().st_mode), 'Expected ordinary directory: ' + str(path))
    return path


def disjoint_roots(*values):
    paths = [no_symlinks(value) for value in values]
    for index, left in enumerate(paths):
        for right in paths[index+1:]:
            require(left != right and left not in right.parents and right not in left.parents,
                    'Input/output roots overlap: ' + str(left) + ' / ' + str(right))
    return paths


def sha256_file(value):
    result = hashlib.sha256()
    with ordinary_file(value).open('rb') as stream:
        for chunk in iter(lambda: stream.read(CHUNK), b''):
            result.update(chunk)
    return result.hexdigest()


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + '\n').encode('utf-8')


def read_json(value):
    file = ordinary_file(value)
    require(file.stat().st_size <= LIMITS['metadataBytes'], 'Metadata exceeds 25 MB')
    def pairs(items):
        result = {}
        for key, item in items:
            require(key not in result, 'Duplicate JSON key: ' + key)
            result[key] = item
        return result
    def finite(value):
        number = float(value)
        require(math.isfinite(number), 'Non-finite JSON number')
        return number
    def invalid(value):
        raise ValueError('Non-finite JSON constant: ' + value)
    return json.loads(file.read_text(encoding='utf-8'), object_pairs_hook=pairs,
                      parse_float=finite, parse_constant=invalid)


def write_new(value, content):
    path = no_symlinks(value)
    require(not path.exists(), 'Refuse to overwrite: ' + str(path))
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('xb') as stream:
        stream.write(content)


def inventory_sha256(rows):
    return hashlib.sha256(json.dumps(rows, ensure_ascii=False, separators=(',', ':'),
                                   allow_nan=False).encode('utf-8')).hexdigest()


def checked_rows(rows, label, maximum=LIMITS['siteBytes'], *, nonempty=True):
    require(isinstance(rows, list) and (rows or not nonempty) and len(rows) <= MAX_ENTRIES, label + ' needs a bounded inventory')
    seen, total, previous = {}, 0, None
    for row in rows:
        require(isinstance(row, dict) and set(row) == {'path', 'bytes', 'sha256'}, label + ' invalid row')
        name = safe_name(row['path'])
        require(name not in seen and (previous is None or previous < name), label + ' duplicate/unsorted path')
        total += integer(row['bytes'], label + ' bytes', maximum=maximum)
        require(total <= maximum, label + ' exceeds byte limit')
        if name.endswith(METADATA_SUFFIXES):
            require(row['bytes'] <= LIMITS['metadataBytes'], label + ' oversized metadata')
        digest(row['sha256'], label + ' hash')
        previous, seen[name] = name, row
    for name in seen:
        require(all('/'.join(name.split('/')[:i]) not in seen for i in range(1, len(name.split('/')))),
                label + ' file/directory collision: ' + name)
    return seen


def inventory(value, maximum=LIMITS['siteBytes'], *, nonempty=True):
    root = ordinary_directory(value)
    rows, total, count = [], 0, 0
    for file in sorted(root.rglob('*')):
        count += 1
        require(count <= MAX_ENTRIES * 2, 'Too many filesystem entries')
        mode = file.lstat().st_mode
        require(stat.S_ISDIR(mode) or stat.S_ISREG(mode), 'Symlink/special inventory member: ' + str(file))
        if stat.S_ISREG(mode):
            size = integer(file.stat().st_size, 'File size', maximum=maximum)
            total += size
            require(total <= maximum, 'Inventory exceeds byte limit')
            rows.append({'path': safe_name(file.relative_to(root).as_posix()), 'bytes': size,
                         'sha256': sha256_file(file)})
    rows.sort(key=lambda row: row['path'])
    checked_rows(rows, 'Local inventory', maximum, nonempty=nonempty)
    return rows


def namespace(entries, label):
    seen = {}
    require(len(entries) <= MAX_ENTRIES * 2, label + ' has too many members')
    for _, name, directory in entries:
        require(name not in seen, label + ' duplicate normalized member: ' + name)
        seen[name] = directory
    for name in seen:
        require(all(seen.get('/'.join(name.split('/')[:i]), True) for i in range(1, len(name.split('/')))),
                label + ' file/directory collision: ' + name)
    require(any(not directory for directory in seen.values()), label + ' contains no files')


def zip_entries(archive, maximum):
    entries, total = [], 0
    for member in archive.infolist():
        require(member.orig_filename == member.filename, 'Null/noncanonical ZIP member name')
        directory = member.is_dir()
        name = safe_name(member.filename[:-1] if directory else member.filename)
        kind = stat.S_IFMT(member.external_attr >> 16)
        require(kind in (0, stat.S_IFDIR if directory else stat.S_IFREG), 'ZIP symlink/special member: ' + name)
        require(not member.flag_bits & 1, 'Encrypted ZIP is unsupported')
        require(member.compress_type in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED), 'Unsupported ZIP compression')
        integer(member.compress_size, 'Compressed ZIP member size', maximum=maximum)
        total += integer(member.file_size, 'ZIP member size', maximum=maximum)
        require(total <= maximum and (not directory or member.file_size == 0), 'ZIP exceeds size limit or has directory data')
        require(not directory or member.CRC == 0, 'ZIP empty-directory CRC differs')
        if name.endswith(METADATA_SUFFIXES):
            require(member.file_size <= LIMITS['metadataBytes'], 'ZIP metadata exceeds 25 MB')
        entries.append((member, name, directory))
        require(len(entries) <= MAX_ENTRIES * 2, 'ZIP has too many members')
    namespace(entries, 'ZIP')
    # upload-artifact may retain a sole common directory. Strip precisely one
    # common top-level directory, never arbitrary shared character prefixes.
    files = [name for _, name, directory in entries if not directory]
    first = {name.split('/')[0] for name in files}
    common = next(iter(first)) if len(first) == 1 and all('/' in name for name in files) else None
    if common:
        require(all(name == common and directory or name.startswith(common + '/')
                    for _, name, directory in entries), 'ZIP has entries outside common root')
        entries = [(member, name[len(common)+1:], directory) for member, name, directory in entries
                   if name != common]
        namespace(entries, 'ZIP after common-root normalization')
    return entries, common


def preflight_zip_directory(value):
    """Bound the central-directory allocation before constructing ZipFile."""
    file = ordinary_file(value)
    size = file.stat().st_size
    with file.open('rb') as stream:
        stream.seek(max(0, size - 65_557))
        tail = stream.read(65_557)
        position = tail.rfind(b'PK\x05\x06')
        require(position >= 0 and position + 22 <= len(tail), 'ZIP end record missing')
        end = max(0, size - 65_557) + position
        fields = struct.unpack('<4s4H2IH', tail[position:position+22])
        _, disk, central_disk, entries_disk, count, central_bytes, central_offset, comment = fields
        require(end + 22 + comment == size and disk == central_disk == 0, 'ZIP end/trailing bytes/multidisk differs')
        central_end_limit = end
        if end >= 20:
            stream.seek(end-20)
            locator = stream.read(20)
            if locator[:4] == b'PK\x06\x07':
                _, locator_disk, zip64_offset, disks = struct.unpack('<4sIQI', locator)
                require(locator_disk == 0 and disks == 1 and zip64_offset + 56 <= end-20, 'Invalid ZIP64 locator')
                stream.seek(zip64_offset)
                record = stream.read(56)
                require(len(record) == 56 and record[:4] == b'PK\x06\x06', 'ZIP64 end record missing')
                _, record_size, _, _, disk64, central_disk64, entries_disk, count, central_bytes, central_offset = struct.unpack('<4sQ2H2I4Q', record)
                require(44 <= record_size <= LIMITS['metadataBytes'] and zip64_offset + 12 + record_size == end-20 and
                        disk64 == central_disk64 == 0, 'Invalid/oversized ZIP64 end record')
                central_end_limit = zip64_offset
        require(0 < count <= MAX_ENTRIES*2 and entries_disk == count, 'ZIP entry count exceeds bound')
        require(0 < central_bytes <= LIMITS['metadataBytes'] and central_offset + central_bytes <= central_end_limit,
                'ZIP central directory exceeds bound')
        stream.seek(central_offset)
        finish, actual = central_offset + central_bytes, 0
        while stream.tell() < finish:
            header = stream.read(46)
            require(len(header) == 46 and header[:4] == b'PK\x01\x02', 'Invalid ZIP central directory header')
            fields = struct.unpack('<4s6H3I5H2I', header)
            name_size, extra_size, comment_size = fields[10:13]
            require(0 < name_size <= 4096 and stream.tell() + name_size + extra_size + comment_size <= finish,
                    'ZIP member metadata exceeds directory bound')
            stream.seek(name_size + extra_size + comment_size, 1)
            actual += 1
            require(actual <= MAX_ENTRIES*2, 'ZIP member storm exceeds count bound')
        require(stream.tell() == finish and actual == count, 'ZIP central directory count/extent differs')


def preflight_tar(value):
    """Bound raw GNU/PAX extension bodies before tarfile automatically reads them."""
    file = ordinary_file(value)
    size, count, metadata_bytes, ordinary_bytes, chain = file.stat().st_size, 0, 0, 0, 0
    pending, global_pax, long_name = {}, {}, None
    with file.open('rb') as stream:
        while True:
            header = stream.read(512)
            require(len(header) == 512, 'Truncated TAR header/terminator')
            if header == b'\0'*512:
                require(not pending and chain == 0, 'Dangling TAR extension')
                require(stream.read(512) == b'\0'*512, 'TAR needs two zero terminator blocks')
                for chunk in iter(lambda: stream.read(CHUNK), b''):
                    require(not chunk.strip(b'\0'), 'Nonzero trailing TAR bytes')
                break
            member = tarfile.TarInfo.frombuf(header, 'utf-8', 'surrogateescape')
            count += 1
            require(count <= MAX_ENTRIES*2, 'TAR header storm exceeds count bound')
            integer(member.size, 'Raw TAR member bytes', maximum=LIMITS['siteBytes'])
            require(stream.tell() + ((member.size+511)//512)*512 <= size, 'TAR declared body exceeds archive')
            if member.type in (tarfile.GNUTYPE_LONGNAME, tarfile.XHDTYPE, tarfile.XGLTYPE):
                chain += 1
                require(chain <= 16 and 0 < member.size <= 4096, 'TAR extended-header chain/body exceeds bound')
                metadata_bytes += member.size
                require(metadata_bytes <= LIMITS['metadataBytes'], 'TAR aggregate extended metadata exceeds bound')
                body = stream.read(member.size)
                require(len(body) == member.size, 'Truncated TAR extension body')
                if member.type == tarfile.GNUTYPE_LONGNAME:
                    require(body.endswith(b'\0'), 'GNU long name must terminate with null')
                    long_name = body.rstrip(b'\0').decode('utf-8', errors='surrogateescape')
                else:
                    position, values = 0, {}
                    while position < len(body):
                        space = body.find(b' ', position)
                        require(space > position and body[position:space].isdigit(), 'Invalid PAX record length')
                        length = int(body[position:space])
                        require(length > space-position+2 and position+length <= len(body), 'PAX record exceeds body')
                        record = body[space+1:position+length]
                        require(record.endswith(b'\n') and b'=' in record, 'Invalid PAX key/value')
                        key, val = record[:-1].split(b'=', 1)
                        require(key not in values and not key.startswith(b'GNU.sparse') and key != b'linkpath',
                                'Duplicate/sparse/link PAX metadata')
                        values[key] = val
                        position += length
                    if member.type == tarfile.XGLTYPE:
                        global_pax.update(values)
                    else:
                        pending.update(values)
                stream.seek((-member.size) % 512, 1)
                continue
            require(member.type in (tarfile.REGTYPE, tarfile.AREGTYPE, tarfile.DIRTYPE), 'TAR link/special member')
            merged = global_pax | pending
            if b'size' in merged:
                require(merged[b'size'].isdigit() and int(merged[b'size']) == member.size, 'PAX size disagrees with raw bounded body')
            require(not member.isdir() or member.size == 0, 'TAR directory body is nonempty')
            resolved = merged.get(b'path')
            resolved = resolved.decode('utf-8', errors='surrogateescape') if resolved else long_name or member.name
            resolved = resolved[2:] if resolved.startswith('./') else resolved
            if not (member.isdir() and resolved in ('', '.')):
                safe_name(resolved.rstrip('/') if member.isdir() else resolved)
            if resolved.endswith(METADATA_SUFFIXES):
                require(member.size <= LIMITS['metadataBytes'], 'TAR metadata member exceeds limit before extraction')
            ordinary_bytes += member.size
            require(ordinary_bytes <= LIMITS['siteBytes'], 'TAR ordinary bodies exceed site limit')
            pending, chain, long_name = {}, 0, None
            stream.seek(((member.size+511)//512)*512, 1)


def staging_directory(value):
    output = no_symlinks(value)
    require(not output.exists(), 'Output already exists: ' + str(output))
    output.parent.mkdir(parents=True, exist_ok=True)
    return pathlib.Path(tempfile.mkdtemp(prefix='.' + output.name + '-stage-', dir=output.parent))


def stream_to_file(source, destination, expected_size, expected_sha=None):
    destination.parent.mkdir(parents=True, exist_ok=True)
    size, hashed = 0, hashlib.sha256()
    with destination.open('xb') as target:
        for chunk in iter(lambda: source.read(CHUNK), b''):
            size += len(chunk)
            require(size <= expected_size, 'Archive/copy member exceeds declared bytes')
            target.write(chunk)
            hashed.update(chunk)
    require(size == expected_size, 'Truncated archive/copy member')
    if expected_sha:
        require(hashed.hexdigest() == expected_sha, 'Copied file hash changed')


def extract_zip(zip_path, output, expected_bytes, expected_sha256, maximum=LIMITS['privateProofBytes']):
    archive_file, output = disjoint_roots(zip_path, output)
    archive_file = ordinary_file(archive_file)
    integer(expected_bytes, 'Provider ZIP bytes', 1, maximum)
    digest(expected_sha256, 'Provider ZIP hash')
    require(archive_file.stat().st_size == expected_bytes and sha256_file(archive_file) == expected_sha256,
            'Provider ZIP size/hash differs')
    preflight_zip_directory(archive_file)
    temporary = staging_directory(output)
    try:
        with zipfile.ZipFile(archive_file) as archive:
            entries, common = zip_entries(archive, maximum)
            for member, name, directory in entries:
                target = temporary / name
                if directory:
                    target.mkdir(parents=True, exist_ok=True)
                else:
                    with archive.open(member) as source:
                        # ZipExtFile verifies CRC when the complete member is read.
                        stream_to_file(source, target, member.file_size)
        rows = inventory(temporary, maximum)
        require(not output.exists(), 'Output appeared during extraction')
        temporary.rename(output)
        return {'pass': True, 'zipBytes': expected_bytes, 'zipSha256': expected_sha256,
                'commonRoot': common, 'files': rows, 'bytes': sum(row['bytes'] for row in rows),
                'inventorySha256': inventory_sha256(rows)}
    finally:
        if temporary.exists():
            shutil.rmtree(temporary)


def verify_extracted(zip_path, directory, expected_bytes, expected_sha256, maximum=LIMITS['privateProofBytes']):
    archive_file, directory = disjoint_roots(zip_path, directory)
    archive_file, directory = ordinary_file(archive_file), ordinary_directory(directory)
    integer(expected_bytes, 'Provider ZIP bytes', 1, maximum)
    digest(expected_sha256, 'Provider ZIP hash')
    require(archive_file.stat().st_size == expected_bytes and sha256_file(archive_file) == expected_sha256,
            'Provider ZIP size/hash differs on extracted verification')
    preflight_zip_directory(archive_file)
    rows, expected_directories = [], set()
    with zipfile.ZipFile(archive_file) as archive:
        entries, common = zip_entries(archive, maximum)
        for member, name, directory_member in entries:
            components = name.split('/')
            expected_directories.update('/'.join(components[:i]) for i in range(1, len(components)))
            if directory_member:
                expected_directories.add(name)
                continue
            hashed, size = hashlib.sha256(), 0
            with archive.open(member) as stream:
                for chunk in iter(lambda: stream.read(CHUNK), b''):
                    size += len(chunk)
                    require(size <= member.file_size, 'ZIP member grew during complete CRC verification')
                    hashed.update(chunk)
            require(size == member.file_size, 'Truncated ZIP member during complete CRC verification')
            rows.append({'path': name, 'bytes': size, 'sha256': hashed.hexdigest()})
    rows.sort(key=lambda row: row['path'])
    checked_rows(rows, 'Verified ZIP members', maximum)
    actual = inventory(directory, maximum)
    require(exact_equal(rows, actual), 'Extracted directory has deleted/extra/changed member bytes')
    actual_directories = {path.relative_to(directory).as_posix() for path in directory.rglob('*') if path.is_dir()}
    require(actual_directories == expected_directories, 'Extracted directory namespace differs from normalized ZIP')
    return {'pass': True, 'zipBytes': expected_bytes, 'zipSha256': expected_sha256, 'commonRoot': common,
            'files': rows, 'bytes': sum(row['bytes'] for row in rows), 'inventorySha256': inventory_sha256(rows)}


def source_review(value, label):
    require(isinstance(value, dict), label + ' is missing')
    run = integer(value.get('runId'), label + ' run', 1)
    integer(value.get('runAttempt'), label + ' attempt', 1)
    require(set(value) in ({'runId', 'runAttempt'}, {'runId', 'runAttempt', 'url'}), label + ' contains unapproved fields')
    if 'url' in value:
        require(value['url'] == 'https://github.com/' + REPOSITORY + '/actions/runs/' + str(run), label + ' URL differs')
    return value


def validate_pins(pins, *, baseline_expected=None):
    expected = BASELINE if baseline_expected is None else baseline_expected
    require(isinstance(pins, dict) and type(pins.get('schemaVersion')) is int and pins['schemaVersion'] == 1, 'Invalid pins schema')
    require(pins.get('frozen') is True and pins.get('sourceAccepted') is True and
            pins.get('publicationAccepted') is False, 'Pins are provisional or claim PUBLIC acceptance')
    require(pins.get('repository') == REPOSITORY and pins.get('namespace') == NAMESPACE and
            pins.get('publicURL') == PUBLIC_BASE + NAMESPACE, 'Repository/namespace/public URL differs')
    require(pins.get('sourceBranch') == 'upgrade/campaign-polish-20261013' and
            pins.get('sourceWorkflow') == '.github/workflows/campaign-polish-review.yml', 'SOURCE workflow/branch differs')
    for key in ('sourceCommit', 'sourceTree', 'sourceParent', 'controllerParent'):
        commit(pins.get(key), key)
    require(pins['sourceCommit'] != pins['sourceParent'], 'SOURCE parent equals head')
    source_review(pins.get('sourceReview'), 'SOURCE review')
    require(pins.get('modelOriginCommit') == '3f2e83127dfd5800068854a98843d73eb9377609', 'Accepted model origin differs')
    require(exact_equal(pins.get('limits'), LIMITS), 'Resource limits differ')
    baseline = pins.get('baseline')
    require(isinstance(baseline, dict) and baseline.get('publicationAccepted') is True,
            'Baseline has no independent PUBLIC acceptance')
    for key in ('files', 'bytes', 'inventorySha256'):
        require(baseline.get(key) == expected[key], 'Exact baseline ' + key + ' differs')
    integer(baseline['files'], 'Baseline files', 1, MAX_ENTRIES)
    integer(baseline['bytes'], 'Baseline bytes', 1, LIMITS['siteBytes'])
    digest(baseline['inventorySha256'], 'Baseline inventory hash')
    require(baseline.get('publisher') == pins['controllerParent'], 'Controller parent is not accepted baseline publisher')
    commit(baseline.get('tree'), 'Baseline tree')
    integer(baseline.get('runId'), 'Baseline run', 1)
    integer(baseline.get('runAttempt'), 'Baseline attempt', 1)
    pages = baseline.get('pagesArtifact')
    require(isinstance(pages, dict) and pages.get('name') == 'github-pages', 'Accepted Pages artifact missing')
    integer(pages.get('id'), 'Pages artifact ID', 1)
    integer(pages.get('size_in_bytes'), 'Pages artifact bytes', 1, LIMITS['privateProofBytes'])
    require(isinstance(pages.get('digest'), str) and pages['digest'].startswith('sha256:'), 'Pages artifact digest missing')
    digest(pages['digest'][7:], 'Pages artifact digest')
    require(pages.get('expired') is False, 'Accepted Pages artifact expired')
    require(pages.get('workflow_run', {}).get('id') == baseline['runId'] and
            pages.get('workflow_run', {}).get('head_sha') == baseline['publisher'], 'Pages artifact producer differs')
    audit = pins.get('sourceRootAudit')
    require(isinstance(audit, dict) and audit.get('sourceAccepted') is True and audit.get('publicationAccepted') is False,
            'Independent SOURCE root audit pin missing')
    for key in ('sourceCommit', 'sourceTree', 'sourceParent', 'sourceReview'):
        require(exact_equal(audit.get(key), pins[key]), 'Independent SOURCE root audit identity differs: ' + key)
    jobs, artifacts, logs = pins.get('sourceJobs'), pins.get('sourceArtifacts'), pins.get('sourceLogs')
    require(isinstance(jobs, list) and len(jobs) == 24 and isinstance(artifacts, list) and len(artifacts) == 24 and
            isinstance(logs, list) and len(logs) == 24, 'Complete 24 SOURCE jobs/artifacts/logs required')
    job_ids = [integer(job.get('id'), 'SOURCE job ID', 1) for job in jobs]
    require(len(set(job_ids)) == 24 and {job.get('name') for job in jobs} == set(SOURCE_ROLES), 'Missing/duplicate/unexpected SOURCE job role')
    jobs_by_id = {job['id']: job for job in jobs}
    for job in jobs:
        integer(job.get('run_id'), 'SOURCE job run', 1)
        integer(job.get('run_attempt'), 'SOURCE job attempt', 1)
        require(job.get('status') == 'completed' and job.get('conclusion') == 'success' and
                job.get('run_id') == pins['sourceReview']['runId'] and
                job.get('run_attempt') == pins['sourceReview']['runAttempt'], 'SOURCE job incomplete/wrong producer')
        require(isinstance(job.get('steps'), list) and job['steps'], 'SOURCE job has no actual steps')
        previous, successful = 0, []
        for step in job['steps']:
            number = integer(step.get('number'), 'SOURCE step number', 1)
            require(number > previous and isinstance(step.get('name'), str) and step['name'] and
                    step.get('status') == 'completed' and step.get('conclusion') in ('success', 'skipped'),
                    'SOURCE step number/name/status/conclusion differs')
            previous = number
            if step['conclusion'] == 'success':
                successful.append(step['name'])
        required = ['Run actions/checkout@v4', 'Run actions/setup-node@v4', 'Run npm ci',
                    'Run actions/upload-artifact@v4'] + SOURCE_ROLES[job['name']][1]
        actual_counts = collections.Counter(successful)
        for name, minimum in collections.Counter(required).items():
            require(actual_counts[name] == minimum, 'SOURCE mandatory step missing/duplicated/skipped: ' + name)
    require(len({artifact.get('id') for artifact in artifacts}) == 24 and
            {artifact.get('name') for artifact in artifacts} == {role[0] for role in SOURCE_ROLES.values()},
            'Missing/duplicate/unexpected SOURCE artifact role')
    artifact_job_ids = []
    for artifact in artifacts:
        integer(artifact.get('id'), 'SOURCE artifact ID', 1)
        integer(artifact.get('size_in_bytes'), 'SOURCE artifact bytes', 1, LIMITS['privateProofBytes'])
        require(isinstance(artifact.get('digest'), str) and artifact['digest'].startswith('sha256:'), 'SOURCE artifact digest absent')
        digest(artifact['digest'][7:], 'SOURCE artifact digest')
        require(artifact.get('expired') is False and artifact.get('workflow_run', {}).get('id') == pins['sourceReview']['runId'] and
                artifact.get('workflow_run', {}).get('head_sha') == pins['sourceCommit'] and
                artifact.get('workflow_run', {}).get('head_branch') == pins['sourceBranch'], 'SOURCE artifact producer differs')
        artifact_job_ids.append(integer(artifact.get('jobId'), 'SOURCE artifact job', 1))
        require(artifact['jobId'] in jobs_by_id and
                artifact['name'] == SOURCE_ROLES[jobs_by_id[artifact['jobId']]['name']][0], 'SOURCE artifact/job role differs')
    require(set(artifact_job_ids) == set(job_ids) and len(set(artifact_job_ids)) == 24, 'SOURCE artifact/job bijection missing')
    require({log.get('jobId') for log in logs} == set(job_ids) and len({log.get('jobId') for log in logs}) == 24,
            'Complete SOURCE log/job bijection missing')
    for log in logs:
        integer(log.get('bytes'), 'SOURCE log bytes', 1, LIMITS['metadataBytes'])
        digest(log.get('sha256'), 'SOURCE log hash')
    return pins


def check_baseline(rows, *, baseline_expected=None):
    expected = BASELINE if baseline_expected is None else baseline_expected
    checked_rows(rows, 'Accepted baseline')
    require(len(rows) == expected['files'] and sum(row['bytes'] for row in rows) == expected['bytes'] and
            inventory_sha256(rows) == expected['inventorySha256'], 'Exact accepted baseline inventory differs')
    require(not any(row['path'] == NAMESPACE[:-1] or row['path'].startswith(NAMESPACE) for row in rows),
            'Candidate namespace already exists in baseline')
    return rows


def extract_baseline(zip_path, output, pins, *, baseline_expected=None):
    validate_pins(pins, baseline_expected=baseline_expected)
    archive_file, output = disjoint_roots(zip_path, output)
    artifact = pins['baseline']['pagesArtifact']
    require(ordinary_file(archive_file).stat().st_size == artifact['size_in_bytes'] and
            sha256_file(archive_file) == artifact['digest'][7:], 'Accepted Pages ZIP size/hash differs')
    preflight_zip_directory(archive_file)
    temporary = staging_directory(output)
    try:
        with zipfile.ZipFile(archive_file) as archive:
            entries, _ = zip_entries(archive, LIMITS['privateProofBytes'])
            files = [(member, name) for member, name, directory in entries if not directory]
            require(len(files) == 1 and files[0][1] == 'artifact.tar', 'Pages ZIP must contain sole artifact.tar')
            tar_path = temporary / 'artifact.tar'
            with archive.open(files[0][0]) as source:
                stream_to_file(source, tar_path, files[0][0].file_size)
        site = temporary / 'site'
        site.mkdir()
        preflight_tar(tar_path)
        with tarfile.open(tar_path, mode='r:') as archive:
            entries, total, root_seen = [], 0, False
            for member in archive:
                require(member.type in (tarfile.REGTYPE, tarfile.AREGTYPE, tarfile.DIRTYPE) and not member.sparse,
                        'TAR link/special/sparse member: ' + member.name)
                integer(member.size, 'TAR member bytes', maximum=LIMITS['siteBytes'])
                if member.name in ('.', './'):
                    require(member.isdir() and not root_seen and member.size == 0, 'Duplicate/invalid TAR root')
                    root_seen = True
                    continue
                name = member.name[2:] if member.name.startswith('./') else member.name
                name = safe_name(name.rstrip('/') if member.isdir() else name)
                total += member.size
                require(total <= LIMITS['siteBytes'] and (not member.isdir() or member.size == 0), 'TAR size limit/directory data')
                entries.append((member, name, member.isdir()))
                require(len(entries) <= MAX_ENTRIES*2, 'Pages TAR has too many members')
            namespace(entries, 'Pages TAR')
            expected = BASELINE if baseline_expected is None else baseline_expected
            regular = [(member, name) for member, name, directory in entries if not directory]
            require(len(regular) == expected['files'] and total == expected['bytes'], 'Pages TAR count/bytes differ')
            for member, name, directory in entries:
                target = site / name
                if directory:
                    target.mkdir(parents=True, exist_ok=True)
                else:
                    source = archive.extractfile(member)
                    require(source is not None, 'TAR member body absent')
                    with source:
                        stream_to_file(source, target, member.size)
        rows = check_baseline(inventory(site), baseline_expected=baseline_expected)
        require(not output.exists(), 'Baseline output appeared during extraction')
        site.rename(output)
        return {'pass': True, 'files': len(rows), 'bytes': sum(row['bytes'] for row in rows),
                'inventorySha256': inventory_sha256(rows), 'pagesArtifact': artifact,
                'baselinePublisher': pins['baseline']['publisher'], 'baselineRun': pins['baseline']['runId']}
    finally:
        shutil.rmtree(temporary)


def identity(pins, publisher, run, attempt):
    commit(publisher, 'PUBLIC publisher')
    integer(run, 'PUBLIC run', 1)
    integer(attempt, 'PUBLIC attempt', 1)
    require(publisher != pins['controllerParent'] and publisher != pins['sourceCommit'], 'PUBLIC publisher must be new controller commit')
    return {key: pins[key] for key in ('sourceCommit', 'sourceTree', 'sourceParent', 'sourceReview')} | {
        'publisherCommit': publisher, 'publicationRun': run, 'publicationRunAttempt': attempt,
        'publicationURL': 'https://github.com/' + REPOSITORY + '/actions/runs/' + str(run)}


def production_identity(pins, publisher, run, attempt):
    expected = identity(pins, publisher, run, attempt)
    require(os.environ.get('GITHUB_SHA') == publisher and os.environ.get('GITHUB_RUN_ID') == str(run) and
            os.environ.get('GITHUB_RUN_ATTEMPT') == str(attempt), 'Arguments do not equal inherited actual PUBLIC GitHub tuple')
    require(os.environ.get('GITHUB_REPOSITORY') == REPOSITORY and os.environ.get('GITHUB_REF') == 'refs/heads/main',
            'PUBLIC command must run in actual repository main workflow')
    actual = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
    require(actual == publisher, 'Checked-out controller does not equal actual PUBLIC publisher')
    parent = subprocess.check_output(['git', 'rev-parse', 'HEAD^'], text=True).strip()
    require(parent == pins['controllerParent'], 'Actual PUBLIC controller is not direct child of accepted baseline')
    require(subprocess.check_output(['git', 'status', '--porcelain', '--untracked-files=no'], text=True).strip() == '',
            'Actual PUBLIC controller tracked bytes are modified')
    return expected


def check_identity(pins, expected):
    require(isinstance(expected, dict) and exact_equal(expected, identity(pins, expected.get('publisherCommit'),
            expected.get('publicationRun'), expected.get('publicationRunAttempt'))), 'Complete PUBLIC identity differs')
    return expected


def check_binding(binding, pins, rows):
    require(isinstance(binding, dict) and binding.get('pass') is True and binding.get('sourceAccepted') is True and
            binding.get('publicationAccepted') is False, 'Complete accepted SOURCE binding required')
    for key in ('sourceCommit', 'sourceTree', 'sourceParent', 'sourceReview'):
        require(exact_equal(binding.get(key), pins[key]), 'SOURCE binding identity differs: ' + key)
    for pin_key, binding_key in (('sourceJobs', 'actualSourceJobs'), ('sourceArtifacts', 'actualSourceArtifacts'),
                                 ('sourceLogs', 'actualSourceLogs')):
        require(exact_equal(binding.get(binding_key), pins[pin_key]), 'Pinned complete SOURCE provenance differs: ' + binding_key)
    checked_rows(binding.get('candidateFiles'), 'Bound candidate', LIMITS['candidateBytes'])
    integer(binding.get('candidateBytes'), 'Bound candidate bytes', 1, LIMITS['candidateBytes'])
    digest(binding.get('candidateInventorySha256'), 'Bound candidate inventory hash')
    require(exact_equal(rows, binding['candidateFiles']) and binding.get('candidateBytes') == sum(row['bytes'] for row in rows) and
            binding.get('candidateInventorySha256') == inventory_sha256(rows), 'SOURCE package binding differs from all actual dist bytes')
    require(isinstance(binding.get('finiteShortcutAudit'), dict) and binding['finiteShortcutAudit'],
            'Explicit finite shortcut uncertainty audit absent')
    require(len(json_bytes(binding)) <= LIMITS['metadataBytes'], 'SOURCE binding exceeds metadata limit')
    return binding


def source_info(pins, binding, expected, binding_hash):
    return {'schemaVersion': 1, 'kind': 'campaign-v55-technical-source-review', **expected,
            'repository': REPOSITORY, 'namespace': NAMESPACE, 'version': 'v55-castle-finale',
            'sourceAccepted': True, 'publicationAccepted': False,
            'candidateBytes': binding['candidateBytes'], 'candidateInventorySha256': binding['candidateInventorySha256'],
            'packageBindingSha256': binding_hash, 'modelOriginCommit': pins['modelOriginCommit'],
            'sourceRootAudit': pins['sourceRootAudit'], 'finiteShortcutAudit': binding['finiteShortcutAudit'],
            'scope': 'Accepted exact SOURCE24-job technical checks. Finite shortcut setup/errors remain UNPROVEN. '
                     'This metadata does not declare PUBLIC, human-playtest, hardware or live-platform acceptance.'}


def check_dist_metadata(dist, pins, candidate):
    metadata = read_json(dist / 'build-info.json')
    require(metadata.get('commit') == pins['sourceCommit'] and metadata.get('gameCommit') == pins['sourceCommit'] and
            metadata.get('interfaceCommit') == pins['sourceCommit'] and metadata.get('publisherCommit') is None,
            'Dist source identity differs')
    require(metadata.get('run') == str(pins['sourceReview']['runId']) and metadata.get('verified') is False and
            metadata.get('version') == 'v55-castle-finale', 'Dist SOURCE run/version/acceptance differs')
    require(exact_equal(metadata.get('runtimeConfig'), {'chamberEdition': 'foundation', 'puzzleProgression': True,
                                             'campaignSequencePresentation': True, 'room23PhysicalPrototype': True}),
            'Dist campaign runtime differs')
    require([room.get('stableLevel') for room in metadata.get('rooms', [])] == list(range(1, 41)) + list(range(42, 52)) + [41] and
            [room.get('level') for room in metadata['rooms']] == list(range(1, 52)), 'Dist room order differs')
    require(all(type(room.get('stableLevel')) is int and type(room.get('level')) is int for room in metadata['rooms']),
            'Dist room number types differ')
    files = [row for row in candidate if row['path'] not in ('build-info.json', 'release-manifest.json')]
    require(exact_equal(metadata.get('files'), files) and metadata.get('packageFilesSha256') == inventory_sha256(files),
            'Stamped complete package inventory differs from actual dist bytes')
    return metadata


def assemble_site(baseline, dist, binding_file, output, proof, pins, expected, *, baseline_expected=None):
    validate_pins(pins, baseline_expected=baseline_expected)
    check_identity(pins, expected)
    baseline, dist, output, proof = disjoint_roots(baseline, dist, output, proof)
    baseline, dist = ordinary_directory(baseline), ordinary_directory(dist)
    before = check_baseline(inventory(baseline), baseline_expected=baseline_expected)
    candidate = inventory(dist, LIMITS['candidateBytes'])
    require(not any(row['path'] == 'source-review.json' for row in candidate), 'Dist collides with generated SOURCE review')
    check_dist_metadata(dist, pins, candidate)
    binding_file = ordinary_file(binding_file)
    binding = check_binding(read_json(binding_file), pins, candidate)
    binding_hash = sha256_file(binding_file)
    review = source_info(pins, binding, expected, binding_hash)
    review_bytes = json_bytes(review)
    require(len(review_bytes) <= LIMITS['metadataBytes'], 'Generated SOURCE review exceeds metadata limit')
    generated = [{'path': NAMESPACE + 'source-review.json', 'bytes': len(review_bytes),
                  'sha256': hashlib.sha256(review_bytes).hexdigest()}]
    appended = sorted([{'path': NAMESPACE + row['path'], 'bytes': row['bytes'], 'sha256': row['sha256']}
                       for row in candidate] + generated, key=lambda row: row['path'])
    after = sorted(before + appended, key=lambda row: row['path'])
    checked_rows(after, 'Complete append-only union', LIMITS['siteBytes'])
    temporary = staging_directory(output)
    try:
        for root, rows, prefix in ((baseline, before, ''), (dist, candidate, NAMESPACE)):
            for row in rows:
                with ordinary_file(root / row['path']).open('rb') as stream:
                    stream_to_file(stream, temporary / (prefix + row['path']), row['bytes'], row['sha256'])
        write_new(temporary / generated[0]['path'], review_bytes)
        require(inventory(temporary, LIMITS['siteBytes']) == after and inventory(baseline, LIMITS['siteBytes']) == before and
                inventory(dist, LIMITS['candidateBytes']) == candidate, 'Assembly changed immutable input or output bytes')
        require(sha256_file(binding_file) == binding_hash, 'SOURCE binding changed during assembly')
        manifest = {'schemaVersion': 1, 'kind': 'campaign-v55-append-only-publication-candidate', **expected,
                    'repository': REPOSITORY, 'namespace': NAMESPACE, 'publicBase': PUBLIC_BASE,
                    'sourceAccepted': True, 'publicationAccepted': False, 'baseline': pins['baseline'],
                    'preservedAllBaselineBytes': True, 'baselineFiles': before,
                    'baselineBytes': sum(row['bytes'] for row in before), 'baselineFilesSha256': inventory_sha256(before),
                    'candidateFiles': candidate, 'candidateBytes': sum(row['bytes'] for row in candidate),
                    'candidateInventorySha256': inventory_sha256(candidate), 'generatedFiles': generated,
                    'appendedFiles': appended, 'siteFiles': after, 'siteBytes': sum(row['bytes'] for row in after),
                    'siteFilesSha256': inventory_sha256(after), 'packageBindingSha256': binding_hash,
                    'packageBinding': binding, 'sourceInfo': review}
        manifest_bytes = json_bytes(manifest)
        require(len(manifest_bytes) <= LIMITS['metadataBytes'], 'Publication manifest exceeds metadata limit')
        existing = inventory(proof, LIMITS['privateProofBytes'], nonempty=False) if proof.exists() else []
        require(not any(row['path'] == 'publication-manifest.json' for row in existing), 'Publication manifest already exists')
        additional = len(manifest_bytes) + (0 if any(row['path'] == 'package-binding.json' for row in existing)
                                          else binding_file.stat().st_size)
        require(sum(row['bytes'] for row in existing) + additional <= LIMITS['privateProofBytes'],
                'Complete private proof would exceed 2 GB')
        proof.mkdir(parents=True, exist_ok=True)
        retained = proof / 'package-binding.json'
        if retained.exists():
            require(sha256_file(retained) == binding_hash and retained.read_bytes() == binding_file.read_bytes(),
                    'Existing retained package binding differs')
        else:
            write_new(retained, binding_file.read_bytes())
        write_new(proof / 'publication-manifest.json', manifest_bytes)
        inventory(proof, LIMITS['privateProofBytes'])
        require(not output.exists(), 'Site output appeared during assembly')
        temporary.rename(output)
        return manifest
    finally:
        if temporary.exists():
            shutil.rmtree(temporary)


def check_manifest(manifest, pins, expected, *, baseline_expected=None):
    validate_pins(pins, baseline_expected=baseline_expected)
    check_identity(pins, expected)
    require(type(manifest.get('schemaVersion')) is int and manifest['schemaVersion'] == 1 and manifest.get('kind') == 'campaign-v55-append-only-publication-candidate',
            'Publication manifest schema/kind differs')
    for key, value in expected.items():
        require(exact_equal(manifest.get(key), value), 'PUBLIC manifest identity differs: ' + key)
    require(manifest.get('repository') == REPOSITORY and manifest.get('namespace') == NAMESPACE and
            manifest.get('publicBase') == PUBLIC_BASE and manifest.get('sourceAccepted') is True and
            manifest.get('publicationAccepted') is False and manifest.get('preservedAllBaselineBytes') is True and
            exact_equal(manifest.get('baseline'), pins['baseline']), 'Publication manifest scope/baseline differs')
    before = check_baseline(manifest.get('baselineFiles'), baseline_expected=baseline_expected)
    candidate = manifest.get('candidateFiles')
    checked_rows(candidate, 'Manifest candidate', LIMITS['candidateBytes'])
    require(not any(row['path'] == 'source-review.json' for row in candidate), 'Manifest candidate review collision')
    binding = check_binding(manifest.get('packageBinding'), pins, candidate)
    binding_hash = digest(manifest.get('packageBindingSha256'), 'Retained binding hash')
    review = source_info(pins, binding, expected, binding_hash)
    require(exact_equal(manifest.get('sourceInfo'), review), 'Identifying SOURCE review differs')
    content = json_bytes(review)
    generated = [{'path': NAMESPACE + 'source-review.json', 'bytes': len(content),
                  'sha256': hashlib.sha256(content).hexdigest()}]
    appended = sorted([{'path': NAMESPACE + row['path'], 'bytes': row['bytes'], 'sha256': row['sha256']}
                       for row in candidate] + generated, key=lambda row: row['path'])
    after = sorted(before + appended, key=lambda row: row['path'])
    checked_rows(after, 'Manifest complete union', LIMITS['siteBytes'])
    require(exact_equal(manifest.get('generatedFiles'), generated) and exact_equal(manifest.get('appendedFiles'), appended) and
            exact_equal(manifest.get('siteFiles'), after), 'Manifest is not the exact authorized append-only union')
    for key, value in {'baselineBytes': sum(row['bytes'] for row in before), 'baselineFilesSha256': inventory_sha256(before),
                       'candidateBytes': sum(row['bytes'] for row in candidate), 'candidateInventorySha256': inventory_sha256(candidate),
                       'siteBytes': sum(row['bytes'] for row in after), 'siteFilesSha256': inventory_sha256(after)}.items():
        require(exact_equal(manifest.get(key), value), 'Manifest measured totals/hash differs: ' + key)
    return before, after


def verify_row(row, *, opener=urllib.request.urlopen, nonce=None):
    safe_name(row['path'])
    query = urllib.parse.urlencode({'campaign-v55-byte-check': str(time.time_ns()) if nonce is None else str(nonce)})
    url = PUBLIC_BASE + urllib.parse.quote(row['path'], safe='/') + '?' + query
    request = urllib.request.Request(url, headers={'Cache-Control': 'no-cache, no-store', 'Pragma': 'no-cache',
                                                  'Accept-Encoding': 'identity', 'User-Agent': 'brainrot-campaign-v55-byte-check'})
    hashed, size = hashlib.sha256(), 0
    with opener(request, timeout=90) as response:
        require(response.status == 200, 'Public HTTP status differs: ' + row['path'])
        require(response.geturl() == url, 'Public GET redirected: ' + row['path'])
        require(response.headers.get('Content-Encoding', 'identity').lower() in ('identity', '') and
                response.headers.get('Content-Range') is None, 'Public response is encoded/partial')
        length = response.headers.get('Content-Length')
        require(length is None or re.fullmatch('[0-9]+', length) and int(length) == row['bytes'], 'Public Content-Length differs')
        for chunk in iter(lambda: response.read(CHUNK), b''):
            size += len(chunk)
            require(size <= row['bytes'], 'Public file grew: ' + row['path'])
            hashed.update(chunk)
    require(size == row['bytes'] and hashed.hexdigest() == row['sha256'], 'Public complete file bytes/hash differs: ' + row['path'])
    return size


def check_public(manifest_file, output, pins, expected, phase, *, baseline_expected=None,
                 opener=urllib.request.urlopen, sleeper=time.sleep):
    require(phase in ('preflight', 'published'), 'Unknown verification phase')
    manifest_file, output = disjoint_roots(manifest_file, output)
    report = {'schemaVersion': 1, 'kind': 'campaign-v55-complete-public-byte-verification', 'pass': False,
              **expected, 'phase': phase, 'siteUrl': PUBLIC_BASE, 'checked': 0,
              'mainSiteUnchanged': False, 'sourceAccepted': True, 'publicationAccepted': False,
              'scope': 'Complete GET checks of all accepted baseline bytes during PRE and every union byte during POST.'}
    if baseline_expected is not None:
        report.update({'testFixture': True, 'sourceAccepted': False,
                       'scope': 'SYNTHETIC ISOLATED TEST FIXTURE; no actual SOURCE or PUBLIC acceptance.'})
    require(not output.exists(), 'Verification output already exists')
    try:
        report_manifest_hash = sha256_file(manifest_file)
        manifest = read_json(manifest_file)
        before, after = check_manifest(manifest, pins, expected, baseline_expected=baseline_expected)
        binding_file = manifest_file.parent / 'package-binding.json'
        require(sha256_file(binding_file) == manifest['packageBindingSha256'] and
                exact_equal(read_json(binding_file), manifest['packageBinding']), 'Retained SOURCE binding bytes differ')
        rows = before if phase == 'preflight' else after
        def one(row):
            for attempt in range(4):
                try:
                    return verify_row(row, opener=opener, nonce=str(expected['publicationRun']) + '-' + str(time.time_ns()))
                except Exception:
                    if attempt == 3:
                        raise
                    sleeper(2**attempt)
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
            lengths = list(executor.map(one, rows))
        row_map = {row['path']: row for row in rows}
        identities = ['build-info.json']
        if phase == 'published':
            identities += [NAMESPACE + 'build-info.json', NAMESPACE + 'source-review.json']
        for name in identities:
            require(name in row_map, 'Missing identifying public file: ' + name)
            one(row_map[name])
        # Rechecking source-review's exact generated bytes authenticates all
        # SOURCE and PUBLIC identities; no metadata-only acceptance shortcut.
        require(sha256_file(manifest_file) == report_manifest_hash and
                sha256_file(binding_file) == manifest['packageBindingSha256'] and
                exact_equal(read_json(binding_file), manifest['packageBinding']),
                'Manifest or binding changed during complete GET verification')
        report.update({'pass': True, 'checked': len(rows), 'bytes': sum(lengths), 'mainSiteUnchanged': True,
                       'baselineFilesSha256': manifest['baselineFilesSha256'], 'siteFilesSha256': manifest['siteFilesSha256'],
                       'checkedFilesSha256': inventory_sha256(rows), 'packageBindingSha256': manifest['packageBindingSha256'],
                       'identifyingFilesRechecked': identities})
        print(json.dumps(report))
        return report
    except Exception as error:
        report['error'] = str(error)
        raise
    finally:
        write_new(output, json_bytes(report))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    extraction = commands.add_parser('extract-zip')
    for flag in ('zip', 'output', 'expected-bytes', 'expected-sha256'):
        extraction.add_argument('--' + flag, required=True)
    extracted = commands.add_parser('verify-extracted')
    for flag in ('zip', 'directory', 'expected-bytes', 'expected-sha256'):
        extracted.add_argument('--' + flag, required=True)
    baseline = commands.add_parser('baseline')
    for flag in ('zip', 'output', 'pins'):
        baseline.add_argument('--' + flag, required=True)
    assembly = commands.add_parser('assemble')
    for flag in ('baseline', 'dist', 'source-binding', 'output', 'proof', 'pins', 'publisher', 'run', 'attempt'):
        assembly.add_argument('--' + flag, required=True)
    verification = commands.add_parser('check-public')
    for flag in ('manifest', 'output', 'pins', 'publisher', 'run', 'attempt'):
        verification.add_argument('--' + flag, required=True)
    verification.add_argument('--phase', required=True, choices=('preflight', 'published'))
    args = parser.parse_args()
    if args.command in ('extract-zip', 'verify-extracted'):
        require(re.fullmatch('[0-9]+', args.expected_bytes), 'Expected ZIP bytes is not numeric')
        if args.command == 'extract-zip':
            result = extract_zip(args.zip, args.output, int(args.expected_bytes), args.expected_sha256)
        else:
            result = verify_extracted(args.zip, args.directory, int(args.expected_bytes), args.expected_sha256)
        print(json.dumps(result))
        return
    pins = validate_pins(read_json(args.pins))
    if args.command == 'baseline':
        print(json.dumps(extract_baseline(args.zip, args.output, pins)))
        return
    require(re.fullmatch('[0-9]+', args.run) and re.fullmatch('[0-9]+', args.attempt), 'PUBLIC run/attempt is not numeric')
    expected = production_identity(pins, args.publisher, int(args.run), int(args.attempt))
    if args.command == 'assemble':
        manifest = assemble_site(args.baseline, args.dist, args.source_binding, args.output, args.proof, pins, expected)
        print(json.dumps({'pass': True, **expected, 'baselineFiles': len(manifest['baselineFiles']),
                          'candidateBytes': manifest['candidateBytes'], 'siteFiles': len(manifest['siteFiles']),
                          'siteBytes': manifest['siteBytes'], 'siteFilesSha256': manifest['siteFilesSha256'],
                          'publicationAccepted': False}))
    else:
        check_public(args.manifest, args.output, pins, expected, args.phase)


if __name__ == '__main__':
    main()
