import gzip, hashlib, io, json, os, re, tarfile, time
from pathlib import Path

BASE = Path('/workspace/scratch/c17b1f9ac2be')
QA = BASE / 'qa-recovery-20261101'
OUT = BASE / 'continuation-proof9-candidate'
assert not OUT.exists()
OUT.mkdir()
OBJECTS = OUT / 'snapshot-objects'
OBJECTS.mkdir()
sha = lambda data: hashlib.sha256(data).hexdigest()
roots = [QA / name for name in [
    'ceiling-floor-source-plan-31-40',
    'observatory-static-fields-proposal-v1',
    'observatory-static-fields-proposal-v3-shared-floor',
    'native-build6-all9-root-review',
    'room36-entry-framing-source-proposal-20261101',
    'native-build7-room36-entry-review1',
    'room44-live-integration-proposal',
    'room44-raised-station-proposal-v4',
    'room35-capstan-integration-source-plan',
    'room32-native-ordinary-waypoints-prepared-v1',
    'room32-native-ordinary-waypoints-prepared-v2',
    'native-build6-room32-canonical-waypoints-review1',
    'room48-phase-proposal/contact-quality-v2-source',
]]
roots += [QA / f'native-build6-room{n}-review1' for n in [31,32,33,34,36,37,38,39,40]]
roots += [BASE / 'qa-recovery' / name for name in [
    'native-visual-entry-build6-20261101',
    'native-visual-entry-build7-room36-20261101',
]]
paths = set()
for root in roots:
    assert root.is_dir(), str(root)
    for path in root.rglob('*'):
        assert not path.is_symlink(), str(path)
        if path.is_file():
            paths.add(path)
for number in [6,7]:
    paths.update(path for path in (QA / f'frozen-build{number}').iterdir() if path.is_file())
paths.update(QA / name for name in [
    'run-bounded-command.py', 'build-frozen6.py', 'build-frozen7.py',
    'closed-evidence-cache-advice-receipt.json',
])
started = time.monotonic()
manifest = []
secret_pattern = re.compile(rb'AKIA[A-Z0-9]{16}|gh[pousr]_[A-Za-z0-9]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|sk-proj-[A-Za-z0-9_-]{20,}')
for path in sorted(paths):
    relative = path.relative_to(BASE).as_posix()
    stat_before = path.stat()
    data = path.read_bytes()
    stat_after = path.stat()
    assert (stat_before.st_size,stat_before.st_mtime_ns) == (stat_after.st_size,stat_after.st_mtime_ns), relative
    assert not secret_pattern.search(data), 'Potential secret in ' + relative
    digest = sha(data)
    obj = OBJECTS / digest
    if not obj.exists():
        obj.write_bytes(data)
        assert sha(obj.read_bytes()) == digest
    manifest.append(dict(path=relative,bytes=len(data),sha256=digest))
scope = dict(
    kind='CONTINUATION_SOURCE_AND_UNEDITED_EVIDENCE_POINT_IN_TIME_SNAPSHOT',
    productionSource='Build7/source4930c03b: shared surface fields plus trial36 cargoZ/yaw/pitch. Trial36 is not final visual acceptance.',
    staticFields='13existing contracts PASS, complete immutable current38 bytes equal. All18build6 entry guards PASS; strict network14PASS/4FAIL remain unchanged.',
    room36='13contracts and2ordinary routes PASS; fresh2format entry guards PASS. ROOT rejects excessive top-down trial1 as final composition; next source proposal pending.',
    room44='Actual LabPhysics owned-component and query/GLB negative guards, with full positive/negative raw. Original4s loaded spring-return FAIL480steps retained. Raised-stationV4 SOURCE ONLY, no execution/whole-room acceptance.',
    room32='First native route QA attempt FAIL with erroneous static-friction guard and6GiB abort; no PNG or route acceptance. Complete source, failures and prelaunch error preserved. V3 source repair excluded.',
    room35='Existing capstan continuation source plan only; actual long-wrap full-aperture clearance remains SOURCE_BLOCKED.',
    room48='New joint-native-GS candidate source snapshot only. Final review/root whole-read/parser/real execution remain pending. Prior73fc component335MBfullraw are referenced in earlier durable archives and not duplicated.',
    excluded=['dist copies/dependencies/executables/git indexes','active room32V3 source repair','earlier155MB and335MB proof already backed in preceding archive parts'],
    published=False,releaseAccepted=False,all51UniqueAndExcellentAccepted=False)
(OUT/'original-file-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
(OUT/'scope.json').write_text(json.dumps(scope,indent=2)+'\n')
contents = (json.dumps(dict(files=manifest,scope=scope),indent=2)+'\n').encode()

def info(name, size=0):
    row = tarfile.TarInfo(name)
    row.mode = 0o644
    row.mtime = row.uid = row.gid = 0
    row.uname = row.gname = ''
    row.size = size
    return row

def serialize(target):
    first = {}
    with target.open('wb') as sink, gzip.GzipFile(fileobj=sink,mode='wb',filename='',mtime=0,compresslevel=9) as compressed, tarfile.open(fileobj=compressed,mode='w|',format=tarfile.PAX_FORMAT) as archive:
        archive.addfile(info('CONTENTS.json',len(contents)),io.BytesIO(contents))
        for row in manifest:
            item = info(row['path'])
            if row['sha256'] in first:
                item.type = tarfile.LNKTYPE
                item.linkname = first[row['sha256']]
                archive.addfile(item)
            else:
                first[row['sha256']] = row['path']
                item.size = row['bytes']
                with (OBJECTS/row['sha256']).open('rb') as source:
                    archive.addfile(item,source)

archive = OUT/'continuation-proof9.tar.gz'
serialize(archive)
restored = OUT/'roundtrip'
restored.mkdir()
expected = {row['path']:row for row in manifest}
members = []
with tarfile.open(archive,mode='r|gz') as source:
    for member in source:
        assert not member.name.startswith('/') and '..' not in Path(member.name).parts
        if member.name == 'CONTENTS.json':
            assert source.extractfile(member).read() == contents
            continue
        assert member.name in expected and member.name not in members
        target = restored/member.name
        target.parent.mkdir(parents=True,exist_ok=True)
        if member.islnk():
            assert member.linkname in members
            os.link(restored/member.linkname,target)
        else:
            assert member.isfile()
            with target.open('wb') as sink:
                stream = source.extractfile(member)
                while chunk := stream.read(1024*1024):
                    sink.write(chunk)
        members.append(member.name)
        assert target.stat().st_size == expected[member.name]['bytes']
        with target.open('rb') as stream:
            assert hashlib.file_digest(stream,'sha256').hexdigest() == expected[member.name]['sha256']
assert set(members) == set(expected)
repeat = OUT/'continuation-proof9.repeat.tar.gz'
serialize(repeat)
with archive.open('rb') as stream:
    digest = hashlib.file_digest(stream,'sha256').hexdigest()
with repeat.open('rb') as stream:
    assert hashlib.file_digest(stream,'sha256').hexdigest() == digest
for row in manifest:
    with (BASE/row['path']).open('rb') as stream:
        assert hashlib.file_digest(stream,'sha256').hexdigest() == row['sha256'], 'Original changed during snapshot: '+row['path']
parts = OUT/'parts'
parts.mkdir()
part_rows = []
with archive.open('rb') as stream:
    number = 0
    while data := stream.read(2*1024*1024):
        number += 1
        name = f'continuation-proof9.part-{number:03}'
        (parts/name).write_bytes(data)
        part_rows.append(dict(path='parts/'+name,bytes=len(data),sha256=sha(data)))
assert sha(b''.join((OUT/row['path']).read_bytes() for row in part_rows)) == digest
receipt = dict(archiveSha256=digest,archiveBytes=archive.stat().st_size,logicalFiles=len(manifest),logicalBytes=sum(row['bytes']for row in manifest),uniquePayloads=len({row['sha256']for row in manifest}),rawPngFiles=sum(row['path'].endswith('.png')for row in manifest),allMembersRoundtripVerified=True,secondSerializationByteExact=True,originalSourceAndEvidenceUnchanged=True,secretMatches=0,seconds=time.monotonic()-started,parts=part_rows,scope=scope)
(OUT/'verification-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({key:value for key,value in receipt.items() if key not in ['parts','scope']}))
