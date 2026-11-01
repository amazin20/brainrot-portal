from pathlib import Path, PurePosixPath
import os, io, json, re, hashlib, gzip, tarfile, shutil, time, datetime

W = Path('/workspace/scratch/c17b1f9ac2be')
OUT = W / 'durable-qa-proof-candidate-20261101'
REPO = W / 'brainrot-portal'
QA = W / 'qa-recovery-20261101'
LATEST_COMMIT = '1c3a221c21fbc6e7e346aab541b31c29a3377941'
LATEST_TREE = '6e958260cb2b7d4ec519dda3eea66e77b712745a'
ARCHIVE = OUT / 'historical-and-current-qa-evidence-v1.tar.gz'
START = time.monotonic()

def sha_file(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda: f.read(65536), b''): h.update(b)
    return h.hexdigest()

def dump(path, data):
    b = (json.dumps(data, sort_keys=True, indent=2, ensure_ascii=False) + '\n').encode()
    path.write_bytes(b)
    return b

def source_inventory(build):
    path = QA / build / 'source-manifest.json'
    rows = json.loads(path.read_text())
    assert len(rows) == 393
    for row in rows:
        p = REPO / row['filename']
        assert p.is_file() and not p.is_symlink()
        assert sha_file(p) == row['sha256'], 'Current MAIN source differs: ' + row['filename']
    names = ['index.html', 'vite.config.js', 'package.json', 'package-lock.json']
    for folder in ['src', 'public/models/runtime', 'public/draco', 'public/art']:
        for p in (REPO / folder).rglob('*'):
            assert not p.is_symlink()
            if p.is_file(): names.append(p.relative_to(REPO).as_posix())
    assert sorted(names) == [r['filename'] for r in rows]
    return {'manifestSha256': sha_file(path), 'sourceCount': len(rows), 'rows': rows}

assert not ARCHIVE.exists(), 'Fresh output only'
source_before = source_inventory('frozen-build5')
assert source_before['manifestSha256'] == '6740a831f72f8e34dc765414e4f8785c6d24c25ae6b6d069ce205ae2a12a4636'
old = {r['filename']: r['sha256'] for r in json.loads((QA / 'frozen-build4/source-manifest.json').read_text())}
changed = [r['filename'] for r in source_before['rows'] if old.get(r['filename']) != r['sha256']]
assert changed == ['src/game/LabOpticsArchitecture.js']

prior = json.loads((QA / 'proof-archive-plan/candidate-file-selection.json').read_text())
allowed_groups = {r['path'].split('/')[1] for r in prior['files']
                  if r['path'].startswith('qa-recovery-20261101/') and len(r['path'].split('/')) > 2
                  and r['disposition'].startswith('include')}
allowed_groups.update({'frozen-build5', 'native-build4-one-retry8-single-rooms-review5',
                       'native-visual-entry-collector-review6', 'native-build5-room32-material-review1',
                       'room32-rear-cover-material-proposal'})
# Older plan included closed v1 fragments here, but this family now also contains
# an active v2 writer. Never traverse/hash it; historical v1 belongs in its own
# later backup, not in this closed global proof candidate.
active_or_separately_archived = {'room44-live-integration-proposal',
    'room44-native-prestep-proposal', 'room44-signed-bridge-proposal',
    'room48-phase-proposal', 'room48-phase-proof-archive'}
allowed_groups.difference_update(active_or_separately_archived)
assert not allowed_groups.intersection(active_or_separately_archived)
allowed_harnesses = {
    'native-static-build3-batches-20261101', 'native-static-build4-batches-20261101',
    'native-static-build4-one-retry8-single-rooms-20261101',
    'native-static-build4-remaining-batches-20261101', 'native-static-build4-single-rooms-20261101',
    'native-static-build4-unpaused-single-rooms-20261101', 'native-static-prepared-20261101',
    'native-visual-entry-build4-single-rooms-20261101', 'native-visual-entry-build5-room32-20261101',
    'native-visual-entry-collector-prepared10-20261101',
    *{'native-static-headless-shell-prepared%d-20261101' % i for i in range(2, 10)},
}

references = [
    {'kind': 'already-durable-room44-source-and-all-original-evidence', 'gitCommit': LATEST_COMMIT,
     'gitPath': 'qa/recovery-20261101/prototypes/room44-signed-bridge-and-prestep-evidence-v1.tar.gz',
     'localPath': str(REPO / 'qa/recovery-20261101/prototypes/room44-signed-bridge-and-prestep-evidence-v1.tar.gz'),
     'bytes': 1208880, 'sha256': 'dbb85258032fd8789984dd00d17df2769302f3af53eb8e427af45013d70d16b1'},
    {'kind': 'already-durable-strict38-canonical-lossless-fixture', 'gitCommit': LATEST_COMMIT,
     'gitPath': 'tests/fixtures/room38-freight-current-contract.json.gz',
     'localPath': str(REPO / 'tests/fixtures/room38-freight-current-contract.json.gz'),
     'bytes': 860349, 'sha256': 'd3258a3c1cf7586819ec65ca43b5de38c40233929e0c0fccc5b5557b1031f04c',
     'uncompressedBytes': 35691659, 'uncompressedSha256': '7edd1be268e4b17d743498a3270d243e5b4a7227ce527032092f984ad48de6e6'},
    {'kind': 'already-durable-phase-source-and-empty-v1', 'gitCommit': LATEST_COMMIT,
     'gitPath': 'qa/recovery-20261101/prototypes/room48-phase-source-and-empty-evidence-v1.tar.gz',
     'localPath': str(QA / 'room48-phase-proof-archive/room48-phase-source-and-empty-evidence-v1.tar.gz'),
     'bytes': 2305034, 'sha256': '20ad5e9e5405d9cbd256698466bde8f515012d74c1801ed8dce256ce817fcab4'},
    {'kind': 'already-durable-phase-full-positive-and-return-v2-eight-parts', 'gitCommit': LATEST_COMMIT,
     'gitPath': 'qa/recovery-20261101/prototypes/phase-v2/room48-positive-return-v2.parts.json',
     'localPath': str(QA / 'room48-phase-proof-archive/room48-phase-positive-and-return-evidence-delta-v2.tar.gz'),
     'bytes': 15730061, 'sha256': '53ed8a5738c8eb373a94d29c1c11222f53f8ce1e2a823c0166f72481d6a18c98',
     'fullOriginalLoadedRawBytes': 114645635, 'fullOriginalReturnRawBytes': 220611156,
     'remoteParts': 8, 'wholeMechanismAccepted': False, 'contactQualityAccepted': False},
]
for r in references:
    p = Path(r['localPath'])
    assert p.stat().st_size == r['bytes'] and sha_file(p) == r['sha256']

phase_manifest_names = {'room48-phase-source-and-empty-evidence-v1.manifest.json',
                        'room48-phase-positive-and-return-evidence-delta-v2.manifest.json'}
excluded_groups = []
excluded_files = []

def include_file(p, rel):
    parts = rel.split('/')
    if p.is_symlink(): raise RuntimeError('Unreviewed symlink: ' + rel)
    if '.git' in parts or 'node_modules' in parts:
        return False, 'Dependency/Git internal'
    if re.match(r'qa-recovery-20261101/frozen-build\d+/dist/', rel):
        return False, 'Reproducible package copy; original manifest/log/receipt retained'
    if rel in ['qa-recovery-20261101/room38-strict-current-fixture2/room38-freight-current-contract.json',
               'qa-recovery-20261101/room38-strict-current-fixture2/room38-freight-current-contract.json.gz']:
        return False, 'Exact canonical fixture already durable in referenced Git gzip'
    if rel.startswith('qa-recovery-20261101/durable-source-backup/'):
        with p.open('rb') as f: prefix = f.read(4)
        if prefix == b'DIRC': return False, 'Temporary binary Git index'
    return True, None

def collect():
    rows = []
    for rootname in ['qa-recovery-20261101', 'qa-recovery']:
        root = W / rootname
        for child in sorted(root.iterdir()):
            if child.is_dir():
                if rootname == 'qa-recovery-20261101' and child.name == 'room48-phase-proof-archive':
                    paths = [child / n for n in sorted(phase_manifest_names)]
                elif (rootname == 'qa-recovery-20261101' and child.name in allowed_groups) or (rootname == 'qa-recovery' and child.name in allowed_harnesses):
                    paths = sorted(p for p in child.rglob('*') if p.is_file() or p.is_symlink())
                else:
                    excluded_groups.append({'path': child.relative_to(W).as_posix(),
                        'reason': 'Already-durable prototype reference or unrelated/active new source-only plan; no traversal/content freezing'})
                    continue
            elif child.is_file():
                paths = [child]
            else:
                continue
            for p in paths:
                rel = p.relative_to(W).as_posix()
                ok, reason = include_file(p, rel)
                if not ok:
                    excluded_files.append({'path': rel, 'bytes': p.stat().st_size, 'reason': reason})
                    continue
                pure = PurePosixPath(rel)
                assert not pure.is_absolute() and '..' not in pure.parts
                rows.append({'path': rel, 'bytes': p.stat().st_size, 'sha256': sha_file(p)})
    rows.sort(key=lambda r: r['path'])
    assert len(rows) == len({r['path'] for r in rows})
    return rows

rows = collect()
print('Frozen selection:', len(rows), 'files,', sum(r['bytes'] for r in rows), 'logical bytes', flush=True)

# Strong token patterns and sensitive literal JSON values; values never emitted.
patterns = {
    'private-key': rb'-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----',
    'github-token': rb'(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})',
    'aws-access-id': rb'(?:AKIA|ASIA)[0-9A-Z]{16}',
    'slack-token': rb'xox[baprs]-[A-Za-z0-9-]{10,}',
    'openai-like-key': rb'sk-(?:proj-)?[A-Za-z0-9_-]{20,}',
    'google-key': rb'AIza[0-9A-Za-z_-]{35}',
    'jwt': rb'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}',
    'url-credentials': rb'https?://[^\s/@:]+:[^\s/@]+@',
    'signed-url-secret': rb'[?&](?:X-Amz-Signature|X-Amz-Credential|sig|signature|access_token)=([^&\s"\']+)',
    'sensitive-literal': rb'["\'](?:password|passwd|access_token|refresh_token|api_key|secret_key|private_key|authorization|cookie|session_token|aws_secret_access_key)["\']\s*:\s*["\']([^"\']+)',
}
patterns = {k: re.compile(v, re.I if k == 'sensitive-literal' else 0) for k, v in patterns.items()}
findings = []
scanned_files = 0
scanned_bytes = 0
text_extensions = {'.json', '.jsonl', '.ndjson', '.mjs', '.js', '.py', '.md', '.patch', '.tap', '.log', '.txt'}

def scan_stream(name, f):
    global scanned_files, scanned_bytes
    scanned_files += 1
    carry = b''
    found = set()
    for block in iter(lambda: f.read(65536), b''):
        scanned_bytes += len(block)
        chunk = carry + block
        for label, pattern in patterns.items():
            if label not in found and pattern.search(chunk):
                found.add(label); findings.append({'path': name, 'pattern': label, 'value': 'REDACTED'})
        carry = chunk[-2048:]

for row in rows:
    p = W / row['path']
    if p.suffix in text_extensions:
        with p.open('rb') as f: scan_stream(row['path'], f)
    elif p.name.endswith('.tar.gz') and p.stat().st_size < 2 * 1024**2:
        with tarfile.open(p, 'r:gz') as t:
            for member in t.getmembers():
                if member.isreg() and Path(member.name).suffix in text_extensions:
                    with t.extractfile(member) as f: scan_stream(row['path'] + '::' + member.name, f)
assert not findings, 'Secret-like pattern requires ROOT review; no archive produced'
print('Scoped text scan:', scanned_files, 'files, no detected patterns', flush=True)

first_by_content = {}
for row in rows:
    key = (row['sha256'], row['bytes'])
    if key in first_by_content:
        row['tarKind'] = 'hardlink'; row['hardlinkTarget'] = first_by_content[key]
    else:
        row['tarKind'] = 'regular'; first_by_content[key] = row['path']
failed = []
for row in rows:
    if row['path'].endswith('/report.json') and row['bytes'] < 3_000_000:
        try:
            r = json.loads((W / row['path']).read_text())
            if r.get('pass') is False: failed.append({'path': row['path'], 'sha256': row['sha256']})
        except Exception: pass

metadata_time = datetime.datetime.now(datetime.timezone.utc).isoformat()
manifest = {'kind': 'EXACT_ORIGINAL_QA_FILE_INVENTORY', 'createdAt': metadata_time,
    'logicalFiles': len(rows), 'logicalFileBytes': sum(r['bytes'] for r in rows),
    'storedRegularFiles': len(first_by_content),
    'storedRegularBytes': sum(r['bytes'] for r in rows if r['tarKind'] == 'regular'),
    'hardlinkedWholeFileDuplicates': sum(r['tarKind'] == 'hardlink' for r in rows),
    'files': rows}
scope = {'kind': 'HISTORICAL_AND_CURRENT_TARGETED_QA_BACKUP_NOT_RELEASE_ACCEPTANCE', 'createdAt': metadata_time,
    'latestExternalBackupCommit': LATEST_COMMIT, 'latestExternalBackupTree': LATEST_TREE,
    'currentMainSource': {'build': 5, 'sourceCount': 393, 'manifestSha256': source_before['manifestSha256'],
        'changedFromBuild4': changed},
    'evidenceScope': ['Accepted18 ordinary-input headless cases across frozen snapshots; all older failed cases/logs also kept',
        'Historic build4 selected66checks plus strict38 complete before/after contracts and original failed attempts',
        'Every original native failed/partial/passed report and RAW image from selected historical families; originalFAIL flags never rewritten',
        'Build4 collector10 can pass entry guards while strictNetwork/report staysFAIL; neither is relabeled',
        'Current build5 material-only32 candidate: original393source/77dist/14GLB manifests, selectedcontract/lifecycle/pixellocality and native32twoformats',
        'Individual ROOT entry reviews are observations, not whole-room or all51 aesthetic approval'],
    'externalReferencesNotCopied': references,
    'frozenHistoricalFamilyAllowlist': sorted(allowed_groups),
    'frozenHarnessFamilyAllowlist': sorted(allowed_harnesses),
    'activeOrSeparatelyArchivedFamiliesExcludedWithoutTraversal': sorted(active_or_separately_archived),
    'excludedGroups': sorted({json.dumps(v, sort_keys=True) for v in excluded_groups}),
    'excludedFiles': excluded_files,
    'preservedOriginalTopLevelFailedReports': failed,
    'secretScan': {'scope': 'Strong token/sensitive-literal pattern scan of selected text and nested small reusable-source archive text; PNG visual data not OCR-scanned',
        'patterns': list(patterns), 'textFiles': scanned_files, 'textBytes': scanned_bytes, 'findings': findings},
    'archivePolicy': {'memberOrder': 'binary lexicographic', 'mtime': 0, 'gzipMtime': 0, 'gzipFilename': '',
        'uid': 0, 'gid': 0, 'fileModeOctal': '0644', 'duplicates': 'Hardlink only identical complete SHA256+length, to an earlier regular payload; every original path retained'},
    'portability': 'Original absolute provenance/config paths and fixture imports are preserved, not rewritten. Replaying requires matching pinned game/dependency source and a reviewed fresh environment; extraction alone is not fresh validation.',
    'currentWholeRoomVisualAccepted': False, 'all51UniqueAndExcellentAccepted': False, 'releaseAccepted': False,
    'runtimeLaunchedByArchiver': False, 'githubWriteByArchiver': False, 'mainWritesByArchiver': False}
manifest_bytes = dump(OUT / 'original-file-manifest.json', manifest)
scope_bytes = dump(OUT / 'scope-and-external-references.json', scope)
metadata = {'_original_file_manifest.json': manifest_bytes, '_scope_and_external_references.json': scope_bytes}
logical = {r['path']: r for r in rows}
all_names = sorted([*metadata, *logical])

def serialize(fileobj):
    with gzip.GzipFile(fileobj=fileobj, filename='', mode='wb', compresslevel=9, mtime=0) as gz:
        with tarfile.open(fileobj=gz, mode='w|', format=tarfile.PAX_FORMAT) as tar:
            for name in all_names:
                info = tarfile.TarInfo(name)
                info.mtime = 0; info.uid = 0; info.gid = 0; info.uname = ''; info.gname = ''; info.mode = 0o644
                if name in metadata:
                    data = metadata[name]; info.size = len(data); tar.addfile(info, io.BytesIO(data))
                else:
                    row = logical[name]
                    if row['tarKind'] == 'hardlink':
                        info.type = tarfile.LNKTYPE; info.linkname = row['hardlinkTarget']; info.size = 0; tar.addfile(info)
                    else:
                        info.size = row['bytes']
                        with (W / name).open('rb') as f: tar.addfile(info, f)

with ARCHIVE.open('xb') as f: serialize(f)
archive_sha = sha_file(ARCHIVE)
print('First deterministic serialization:', ARCHIVE.stat().st_size, archive_sha, flush=True)

class HashSink:
    def __init__(self): self.hash = hashlib.sha256(); self.count = 0
    def write(self, data): self.hash.update(data); self.count += len(data); return len(data)
    def flush(self): pass
    def tell(self): return self.count

sink = HashSink(); serialize(sink)
assert sink.count == ARCHIVE.stat().st_size and sink.hash.hexdigest() == archive_sha
print('Second serialization byte count and SHA exactly equal', flush=True)

stage = OUT / 'roundtrip-staging'
stage.mkdir(exist_ok=False)
with tarfile.open(ARCHIVE, 'r:gz') as tar:
    members = tar.getmembers()
    assert [m.name for m in members] == all_names
    prior_regular = set()
    for m in members:
        assert not PurePosixPath(m.name).is_absolute() and '..' not in PurePosixPath(m.name).parts
        assert m.mtime == 0 and m.uid == m.gid == 0 and m.uname == m.gname == '' and m.mode == 0o644
        if m.isreg(): prior_regular.add(m.name)
        else: assert m.islnk() and m.linkname in prior_regular and logical[m.name]['hardlinkTarget'] == m.linkname
    tar.extractall(stage, filter='data')
for name in all_names:
    p = stage / name
    assert p.is_file() and not p.is_symlink()
    expected = {'bytes': len(metadata[name]), 'sha256': hashlib.sha256(metadata[name]).hexdigest()} if name in metadata else logical[name]
    assert p.stat().st_size == expected['bytes'] and sha_file(p) == expected['sha256'], 'Actual extracted roundtrip mismatch: ' + name
for row in rows:
    p = W / row['path']
    assert p.stat().st_size == row['bytes'] and sha_file(p) == row['sha256'], 'Original source changed: ' + row['path']
source_after = source_inventory('frozen-build5')
assert source_before == source_after
for ref in references:
    assert sha_file(Path(ref['localPath'])) == ref['sha256']
# Rescan only the explicitly selected families, never unrelated active plans.
again = collect()
assert [(r['path'], r['bytes'], r['sha256']) for r in again] == [(r['path'], r['bytes'], r['sha256']) for r in rows], 'Selected historical file set changed'
shutil.rmtree(stage)
print('Actual extracted roundtrip and original/source immutability PASS', flush=True)

PART_SIZE = 2 * 1024**2
parts = []
if ARCHIVE.stat().st_size > PART_SIZE:
    partdir = OUT / 'parts'; partdir.mkdir(exist_ok=False)
    with ARCHIVE.open('rb') as f:
        offset = 0; index = 1
        for data in iter(lambda: f.read(PART_SIZE), b''):
            name = 'qa-evidence-v1.part-%03d' % index
            p = partdir / name
            with p.open('xb') as out: out.write(data)
            parts.append({'index': index, 'path': 'parts/' + name, 'offset': offset, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
            p.chmod(0o444); offset += len(data); index += 1
    h = hashlib.sha256(); total = 0
    for part in parts:
        p = OUT / part['path']; assert sha_file(p) == part['sha256']
        with p.open('rb') as f:
            for data in iter(lambda: f.read(65536), b''): h.update(data); total += len(data)
    assert total == ARCHIVE.stat().st_size and h.hexdigest() == archive_sha
part_manifest = {'kind': 'ORDERED_IMMUTABLE_2MiB_ARCHIVE_PARTS', 'archive': ARCHIVE.name,
    'archiveBytes': ARCHIVE.stat().st_size, 'archiveSha256': archive_sha, 'partBytes': PART_SIZE,
    'parts': parts, 'concatenationByteCountAndSha256Verified': True}
parts_bytes = dump(OUT / 'ordered-parts-manifest.json', part_manifest)
receipt = {'kind': 'DETERMINISTIC_QA_DURABLE_CANDIDATE_VERIFIED_NOT_UPLOADED',
    'createdAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'archive': ARCHIVE.name,
    'archiveBytes': ARCHIVE.stat().st_size, 'archiveSha256': archive_sha,
    'originalFileManifestSha256': hashlib.sha256(manifest_bytes).hexdigest(),
    'scopeSha256': hashlib.sha256(scope_bytes).hexdigest(),
    'partsManifestSha256': hashlib.sha256(parts_bytes).hexdigest(), 'parts': len(parts),
    'logicalOriginalFiles': len(rows), 'logicalOriginalBytes': manifest['logicalFileBytes'],
    'storedRegularBytes': manifest['storedRegularBytes'], 'wholeFileHardlinks': manifest['hardlinkedWholeFileDuplicates'],
    'originalFailedReportFilesPreserved': len(failed), 'allActualExtractedMemberLengthsAndSha256Match': True,
    'sourceFilesBeforeAfterByteExact': True, 'selectedFamilyInventoryBeforeAfterExact': True,
    'currentMain393Build5SourceBeforeAfterExact': True, 'secondSerializationExactlySameShaAndLength': True,
    'roundtripStagingRemoved': True, 'scopedSecretPatternFindings': findings,
    'allMemberPathsRetained': True, 'allOriginalFailureFlagsUnchanged': True,
    'rootRuntimeClosedBeforeArchiving': True, 'newRuntimeStarted': False, 'mainOrGitOrGithubWritten': False,
    'all51QualityAccepted': False, 'wholeRoomVisualAccepted': False, 'elapsedSeconds': time.monotonic() - START}
dump(OUT / 'verification-receipt.json', receipt)
ARCHIVE.chmod(0o444)
for name in ['original-file-manifest.json', 'scope-and-external-references.json', 'ordered-parts-manifest.json', 'verification-receipt.json']:
    (OUT / name).chmod(0o444)
print(json.dumps(receipt, indent=2), flush=True)
