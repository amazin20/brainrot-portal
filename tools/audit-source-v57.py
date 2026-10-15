"""Independent read-only acceptance of one exact v57 SOURCE Actions attempt.

Does not run routes, rebuild, publish, change source, or claim human/device tests.
Only after every gate passes is the source-acceptance receipt written atomically.
"""
import argparse, datetime, hashlib, json, math, os, pathlib, re, stat, subprocess, tempfile, zipfile
from PIL import Image, ImageStat

REPOSITORY='amazin20/brainrot-portal'
BRANCH='upgrade/physical-power-20261015'
WORKFLOW='.github/workflows/physical-power-review.yml'
VERSION='v57-physical-power'
BASE='a3c81ee59a9b2cbf1b23254857dd8c2a6f6b3c38'
LIMIT=100_000_000
GROUPS={'early':list(range(1,11)),'energy':list(range(11,21)),'living':list(range(21,31)),'optics':list(range(31,41)),'fracture':list(range(42,52)),'castle':[41]}
SEQUENCE=list(range(1,41))+list(range(42,52))+[41]
FLAGS={'chamberEdition':'foundation','puzzleProgression':True,'campaignSequencePresentation':True,'room23PhysicalPrototype':True}
PHYSICS_FILES=['tests/'+n for n in ['lab-room25-optics.test.js','lab-room25-continuous-drive.test.js','lab-room25-required-drive.test.js','lab-room25-passenger-lifts.test.js','lab-room25-passenger-aperture.test.js','lab-room25-optical-adversarial-v57.test.js','room25-native-driver.test.js','lab-singularity-upper-lift.test.js','lab-castle-upper-adversarial-v57.test.js']]

def require(value,message):
    if not value:raise AssertionError(message)
def sha(data):return hashlib.sha256(data).hexdigest()
def file_sha(p):
    h=hashlib.sha256()
    with pathlib.Path(p).open('rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
    return h.hexdigest()
def encoded(v):return json.dumps(v,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode()
def load(p):return json.loads(pathlib.Path(p).read_text(encoding='utf-8-sig'))
def read_provider(folder,names):
    for n in names:
        p=folder/n
        if p.exists():
            d=load(p)
            for key in ['structuredContent','content']:
                if isinstance(d,dict) and key in d and len(d)<=3:
                    v=d[key]
                    if isinstance(v,str):
                        try:d=json.loads(v)
                        except json.JSONDecodeError:pass
                    elif isinstance(v,dict):d=v
            return d,p
    raise AssertionError('Missing provider file: '+str(names))
def git(source,*args,binary=False):
    b=subprocess.check_output(['git','-C',str(source),*args]);return b if binary else b.decode().strip()
def identity(source,commit):
    require(git(source,'rev-parse','HEAD')==commit,'Source checkout is not the requested commit')
    require(not git(source,'status','--porcelain','--untracked-files=no'),'Tracked source modifications')
    require(not git(source,'status','--porcelain','--untracked-files=all','--','src','public','index.html','vite.config.js','package.json','package-lock.json'),'Untracked production input')
    subprocess.run(['git','-C',str(source),'merge-base','--is-ancestor',BASE,commit],check=True)
    raw=git(source,'cat-file','commit',commit)
    return git(source,'rev-parse','HEAD^{tree}'),re.findall(r'^parent ([a-f0-9]{40})$',raw,re.M)
def safe_name(value):
    require(isinstance(value,str) and value and not value.startswith('/') and '\\' not in value and not re.match(r'^[A-Za-z]:',value),'Unsafe ZIP/member path')
    require(all(p not in ('','.','..') for p in value.split('/')) and all(ord(c)>=32 and ord(c)!=127 for c in value),'Noncanonical ZIP/member path')
    require(len(value.encode())<=2048 and len(value.split('/'))<=64,'Oversized member path')
    return value
def inventory(root,maximum=LIMIT):
    root=pathlib.Path(root);require(root.is_dir() and not root.is_symlink(),'Missing/linked evidence directory')
    rows=[];total=0
    for p in sorted(root.rglob('*')):
        require(not p.is_symlink(),'Symlink in evidence')
        if p.is_dir():continue
        require(p.is_file(),'Special evidence file');n=safe_name(p.relative_to(root).as_posix());total+=p.stat().st_size;require(total<=maximum,'Evidence exceeds byte budget')
        rows.append({'path':n,'bytes':p.stat().st_size,'sha256':file_sha(p)})
    require(rows and len(rows)<=10000,'Invalid evidence member count');return rows
def verified_zip(archive,directory,pin):
    require(not archive.is_symlink() and archive.is_file(),'Missing exact provider ZIP')
    require(archive.stat().st_size==pin['size_in_bytes'] and 'sha256:'+file_sha(archive)==pin['digest'],'Provider ZIP digest/size mismatch: '+pin['name'])
    actual=inventory(directory,250_000_000);rows=[];seen=set();total=0;dirs=set()
    with zipfile.ZipFile(archive) as z:
        members=z.infolist();require(0<len(members)<=20000,'ZIP member limit')
        for m in members:
            name=safe_name(m.filename.rstrip('/') if m.is_dir() else m.filename)
            require(name not in seen,'Duplicate ZIP path');seen.add(name)
            mode=m.external_attr>>16;kind=stat.S_IFMT(mode)
            require(kind in (0,stat.S_IFREG,stat.S_IFDIR) and not m.flag_bits&1,'Special/encrypted ZIP entry')
            require(m.file_size>=0 and m.file_size<=250_000_000 and (not m.is_dir() or m.file_size==0),'ZIP member size')
            total+=m.file_size;require(total<=250_000_000,'ZIP decompression budget')
        names=[m.filename for m in members if not m.is_dir()];first={n.split('/')[0] for n in names};common=next(iter(first)) if len(first)==1 and all('/' in n for n in names) else None
        for m in members:
            name=m.filename.rstrip('/')
            if common:
                require(name==common and m.is_dir() or name.startswith(common+'/'),'Entry outside normalized common root')
                if name==common:continue
                name=name[len(common)+1:]
            safe_name(name)
            if m.is_dir():dirs.add(name);continue
            h=hashlib.sha256();size=0
            with z.open(m) as f:
                for b in iter(lambda:f.read(1024*1024),b''):size+=len(b);require(size<=m.file_size,'ZIP expanded beyond declared size');h.update(b)
            require(size==m.file_size,'Truncated ZIP body');rows.append({'path':name,'bytes':size,'sha256':h.hexdigest()})
    rows.sort(key=lambda r:r['path']);require(rows==actual,'Deleted, changed or extra extracted artifact member: '+pin['name'])
    paths={r['path'] for r in rows}
    require(all(not any('/'.join(n.split('/')[:i]) in paths for i in range(1,len(n.split('/')))) for n in paths),'File/directory namespace collision')
    actual_dirs={p.relative_to(directory).as_posix() for p in directory.rglob('*') if p.is_dir()}
    parents={str(pathlib.PurePosixPath(n).parent) for n in paths}
    for n in paths:
        parents.update('/'.join(n.split('/')[:i]) for i in range(1,len(n.split('/'))))
    require(actual_dirs==((dirs|parents)-{'.'}),'Extra/missing extracted directory')
    return {'artifactId':pin['id'],'artifactName':pin['name'],'zipBytes':archive.stat().st_size,'zipSha256':file_sha(archive),'files':len(rows),'bytes':sum(r['bytes'] for r in rows),'inventorySha256':sha(encoded(rows))}
def expected_roles():
    roles={'build':['physical-power-dist','physical-power-yandex','physical-power-build'],'physics':['physical-power-physics'],'room25-native':['physical-power-room25-native'],'presentation':['physical-power-presentation']}
    for i in range(6):roles[f'cpu ({i})']=[f'physical-power-cpu-{i}']
    for part,levels in GROUPS.items():
        for kind in ['ordinary','native']:roles[f'{kind} ({part}, '+','.join(map(str,levels))+')']=[f'physical-power-{kind}-{part}']
    return roles
def instant(s):return datetime.datetime.fromisoformat(s.replace('Z','+00:00'))
def validate_provider(run,jobs,artifacts,commit_meta,commit,tree,parents,run_id):
    require(run['id']==run_id and run['run_attempt']==1 and run['head_sha']==commit and run['head_branch']==BRANCH and run['path']==WORKFLOW and run['event']=='push','Wrong SOURCE run identity')
    require(run['repository']['full_name']==REPOSITORY and run['status']=='completed' and run['conclusion']=='success','SOURCE attempt has not completed successfully')
    require(commit_meta['sha']==commit and commit_meta['tree']['sha']==tree and [p['sha'] for p in commit_meta['parents']]==parents,'Provider commit/tree/parents differ from checkout')
    roles=expected_roles();require(len(jobs)==22 and len({j['id'] for j in jobs})==22 and {j['name'] for j in jobs}==set(roles),'Incomplete SOURCE22-job cohort')
    require(len(artifacts)==24 and len({a['id'] for a in artifacts})==24 and {a['name'] for a in artifacts}=={a for names in roles.values() for a in names},'Incomplete SOURCE24-artifact cohort')
    mapping={}
    for job in jobs:
        require(job['run_id']==run_id and job['run_attempt']==1 and job['head_sha']==commit and job['status']=='completed' and job['conclusion']=='success','Wrong/failed SOURCE job')
        require(all(s['status']=='completed' and s['conclusion'] in ('success','skipped') for s in job['steps']),'Unfinished/failed SOURCE job step')
        uploads=[s for s in job['steps'] if s['name']=='Run actions/upload-artifact@v4' and s['conclusion']=='success']
        require(len(uploads)==len(roles[job['name']]),'Incorrect artifact upload count')
        for name in roles[job['name']]:mapping[name]=job
    for artifact in artifacts:
        require(artifact['expired'] is False and re.fullmatch('sha256:[a-f0-9]{64}',artifact['digest']) and 0<artifact['size_in_bytes']<=250_000_000,'Expired/invalid artifact')
        producer=artifact['workflow_run'];require(producer['id']==run_id and producer['head_sha']==commit and producer['head_branch']==BRANCH and producer['repository_id']==1354625251 and producer['head_repository_id']==1354625251,'Wrong artifact producer')
        uploads=[s for s in mapping[artifact['name']]['steps'] if s['name']=='Run actions/upload-artifact@v4' and s['conclusion']=='success'];created=instant(artifact['created_at'])
        require(any(instant(s['started_at'])-datetime.timedelta(seconds=2)<=created<=instant(s['completed_at'])+datetime.timedelta(seconds=2) for s in uploads),'Artifact upload time outside successful producer step')
    return mapping
def tap_counts(tap):
    counts={}
    for key in ['tests','pass','fail','cancelled','skipped','todo']:
        values=re.findall(r'^# '+key+r' (\d+)$',tap,re.M);require(len(values)==1,'Missing/ambiguous TAP footer '+key);counts[key]=int(values[0])
    require(counts['tests']>0 and counts['tests']==counts['pass'] and all(counts[k]==0 for k in ['fail','cancelled','skipped','todo']),'TAP includes failed/skipped/unfinished tests');return counts
def stdout_contains(tap,log):
    clean='\n'.join(re.sub(r'^\ufeff?\d{4}-\d\d-\d\dT[\d:.]+Z ','',s) for s in log.splitlines());position=0
    for line in tap.splitlines():
        at=clean.find(line,position);require(at>=position,'Artifact TAP line absent from actual producer stdout');position=at+len(line)
def check_browser_record(path,source,commit,tree,parents,run,levels,frames):
    checked=load(path/'checked.json');report=path/'report.json'
    require(checked['pass'] is True and checked['sourceAccepted'] is False and checked['publicationAccepted'] is False and checked['sourceCommit']==commit and checked['sourceTree']==tree and checked['sourceParent']==parents[0] and checked['sourceReview']=={'runId':run,'runAttempt':1} and checked['version']==VERSION and checked['levels']==levels,'Wrong independently checked browser source identity')
    require(checked['sourceReport']=={'path':'report.json','bytes':report.stat().st_size,'sha256':file_sha(report)},'Checked browser report drift')
    require([r['file'] for r in checked['decodedImages']]==[pathlib.Path(r['path']).name for r in frames],'Checked frames differ from actual captures')
    for expected,actual in zip(checked['decodedImages'],frames):
        for k in ['width','height','bytes','sha256','colors']:require(expected[k]==actual[k],'Checked image bytes/pixels differ')
        require(abs(expected['maxChannelStd']-actual['maxChannelStd'])<1e-8,'Checked image luminance differs')

def image(p):
    require(p.is_file() and not p.is_symlink(),'Missing genuine frame')
    with Image.open(p) as im:
        im.load();rgb=im.convert('RGB');sample=rgb.resize((64,36));colors=len(sample.getcolors(2305) or []);std=max(ImageStat.Stat(sample).stddev)
        require(im.width>=100 and im.height>=100 and colors>=4 and std>=1,'Blank/invalid actual pixels')
        return {'path':str(p),'width':im.width,'height':im.height,'bytes':p.stat().st_size,'sha256':file_sha(p),'colors':colors,'maxChannelStd':std}

def check_runtime_assets(source,directory,files):
    # vite.config.js publishes exact selected GLB/decoder bytes and compacts the
    # complete source catalogue to14 active models (the59 GLBs are unchanged).
    original=load(source/'public/models/runtime/manifest.json');published=load(directory/'models/runtime/manifest.json')
    script="import{pathToFileURL}from'node:url';const{CAMPAIGN_ASSETS}=await import(pathToFileURL(process.argv[1]));process.stdout.write(JSON.stringify(CAMPAIGN_ASSETS.map(a=>a.id)))"
    active=json.loads(subprocess.check_output(['node','--input-type=module','-e',script,str((source/'src/game/labAssets.js').resolve())]))
    selected=[row['id'] for row in published['models']];require(len(active)==len(set(active))==len(selected)==len(set(selected))==14 and sorted(selected)==sorted(active),'Invalid active model IDs')
    models=[row for row in original['models'] if row['id'] in active]
    expected={'version':8,'totalBytes':sum(row['outputBytes'] for row in models),'totalTriangles':sum(row['triangles'] for row in models),'models':[{k:row[k] for k in ['id','filename','outputBytes','outputSHA256','triangles']} for row in models]}
    require(len(models)==14 and (directory/'models/runtime/manifest.json').read_bytes()==encoded(expected),'Published runtime catalogue differs from exact source compaction')
    for row in files:
        if row['path'].startswith(('models/runtime/','draco/')) and row['path']!='models/runtime/manifest.json':require((directory/row['path']).read_bytes()==(source/'public'/row['path']).read_bytes(),'Changed packaged original model/decoder: '+row['path'])

NODE_GATES=r'''
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
const [source,evidence,commit,run,probeFile,output]=process.argv.slice(1),read=p=>JSON.parse(fs.readFileSync(p));
const load=p=>import(pathToFileURL(path.join(source,p)));const dist=path.join(evidence,'physical-power-dist'),m=read(path.join(dist,'build-info.json'));
const {verifyReleaseMetadata,buildSourceInputs}=await load('scripts/lib/release-manifest.mjs');verifyReleaseMetadata(m,{directory:dist,commit,root:source,run});
const {verifyCampaignPackage}=await load('scripts/v8-package-check.mjs');verifyCampaignPackage(dist);
const {assertCampaignBrowserState}=await load('scripts/lib/campaign-browser-contract.mjs'),{assertFoundation20Route}=await load('scripts/lib/foundation20-native-proof.mjs'),{assertPendulumPhysicalProof}=await load('scripts/lib/tower41-pendulum-proof.mjs'),{assertRoom25NativeDiagnostic}=await load('scripts/lib/room25-native-proof.mjs');
const upper=[];for(const kind of ['ordinary','native']){
 const report=read(path.join(evidence,'physical-power-'+kind+'-castle/report.json')),row=report.rows[0],marks=kind==='native'?row.route.milestones:row.milestones,proof=marks.find(x=>x.name==='Solved pendulum')?.physicsProof;
 upper.push({kind,...assertPendulumPhysicalProof(proof,kind==='native'?row.start.cargoBodyId:proof.lowerPhysicalCell.originalCargoBodyId)});
}
for(const part of ['early','energy','living','optics','fracture','castle']){
 const report=read(path.join(evidence,'physical-power-native-'+part+'/report.json'));for(const row of report.rows){assertCampaignBrowserState(row.start,row.level);if(row.level===20)assertFoundation20Route(row.route.foundation20Proof);}
 const ordinary=read(path.join(evidence,'physical-power-ordinary-'+part+'/report.json'));for(const row of ordinary.rows)if(row.stableLevel===20)assertFoundation20Route(row.foundation20Proof);
}
const dir=path.join(evidence,'physical-power-room25-native'),report=read(path.join(dir,'room25-native-report.json')),binding=read(path.join(dir,'binding.json')),rows=fs.readFileSync(path.join(dir,'room25-telemetry.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
assertRoom25NativeDiagnostic(report,{binding,rows,movieMetadata:read(probeFile)});assert.equal(binding.source.commit,commit);assert.equal(binding.source.tree,m.sourceTree??binding.source.tree);assert.equal(binding.controller.commit,commit);assert.equal(binding.controller.runId,Number(run));assert.equal(binding.controller.runAttempt,1);assert.deepEqual(binding.sourceInputs,buildSourceInputs(source));assert.deepEqual(binding.package.files,m.files);
for(const p of ['physical-power-presentation/architecture/report.json'])for(const row of read(path.join(evidence,p)).rows)assertCampaignBrowserState(row.start,row.level);
fs.writeFileSync(output,JSON.stringify({pass:true,sourceManifestInputs:m.sourceInputFiles,sourceInputsSha256:m.sourceInputsSha256,upperPhysicalProofs:upper,room25NativePureValidator:true}));
'''

def native_movie(evidence,source,commit,tree,run):
    directory=evidence/'physical-power-room25-native';report=load(directory/'room25-native-report.json');binding=load(directory/'binding.json');movie=directory/'room25-required.mp4';telemetry=directory/'room25-telemetry.jsonl'
    require(report['source']['commit']==commit and report['source']['tree']==tree and binding['controller']['commit']==commit and binding['controller']['tree']==tree,'Room25 proof uses another source/controller')
    require(binding['controller']['runId']==run and binding['controller']['runAttempt']==1 and binding['controller']['trackedWorkingTreeClean'] is True,'Room25 controller has another producer')
    harness=['scripts/qa-room25-required-native.mjs','scripts/freeze-room25-native-diagnostic.mjs','scripts/lib/room25-native-driver.mjs','scripts/lib/room25-native-proof.mjs']
    expected=[{'path':n,'bytes':(source/n).stat().st_size,'sha256':file_sha(source/n)} for n in harness];require(binding['controller']['files']==expected and binding['controller']['filesSha256']==sha(encoded(expected)),'Room25 controller bytes differ')
    models=[n for n in git(source,'ls-tree','-r','--name-only','HEAD').splitlines() if n.endswith('.glb')];require(binding['source']['originalModels']==[{'path':n,'bytes':(source/n).stat().st_size,'sha256':file_sha(source/n)} for n in models],'Room25 frozen model identity differs')
    dist=evidence/'physical-power-dist';info=load(dist/'build-info.json');info_bytes=(dist/'build-info.json').read_bytes();require(binding['package']['buildInfoBytes']==len(info_bytes) and binding['package']['buildInfoSha256']==sha(info_bytes),'Native served metadata differs')
    served=load(directory/'served-package.json');require(served['sourceCommit']==commit and served['sourceTree']==tree and served['allHTTPFilesVerified'] is True and served['files']==[dict(row,status=200) for row in info['files']]+[{'path':'build-info.json','bytes':len(info_bytes),'sha256':sha(info_bytes),'status':200}],'Room25 browser did not serve the exact candidate closure')
    for key,p in [('video',movie),('telemetry',telemetry)]:require(report[key]['bytes']==p.stat().st_size and report[key]['sha256']==file_sha(p),'Room25 media bytes differ')
    closed=load(directory/'closed-media-member-inventory.json')['files'];require({r['name'] for r in closed}=={'room25-required.mp4','room25-telemetry.jsonl','room25-native-report.json','ffprobe.json','room25-native-pixels.log'},'Incomplete closed native media inventory')
    for row in closed:p=directory/safe_name(row['name']);require(p.stat().st_size==row['bytes'] and file_sha(p)==row['sha256'],'Changed closed native media member')
    metadata=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_streams','-show_format','-of','json',str(movie)]))
    rows=[json.loads(s) for s in telemetry.read_text().splitlines()];stream=metadata['streams'][0];require(len(metadata['streams'])==1 and int(stream['nb_read_frames'])==len(rows),'Actual decoded frame count differs')
    decoded=subprocess.check_output(['ffmpeg','-hide_banner','-loglevel','error','-xerror','-i',str(movie),'-vf','scale=160:90,signalstats,metadata=mode=print:file=-','-f','null','-'],timeout=300,text=True)
    mins=re.findall(r'lavfi\.signalstats\.YMIN=([\d.]+)',decoded);maxs=re.findall(r'lavfi\.signalstats\.YMAX=([\d.]+)',decoded);require(len(mins)==len(maxs)==len(rows) and all(float(b)-float(a)>12 for a,b in zip(mins,maxs)),'Blank, truncated or undecodable native MP4')
    states=[r['state'] for r in rows];names=[m['name'] for m in report['route']['milestones']];wanted=['retargeted portal removes current freight mirror supply and gravity returns the original support','ordinary lower-floor portal restores light and raises the same original load','first optical receiver raised the loaded counterweight onto a physical balcony','balcony retrieval reverses both linked shadows without a cargo portal','reverse overlook reveals the starting room'];indices=[names.index(n) for n in wanted];require(indices==sorted(indices) and len(set(indices))==5,'Native current-power phases not causal')
    marks={m['name']:m for m in report['route']['milestones']};cut=marks[wanted[0]];restored=marks[wanted[1]];gallery=marks['permanent gallery keeps height after losing light'];require(gallery['physicsSteps']<cut['physicsSteps'] and cut['freight']['height']<gallery['freight']['height']-.01,'Dark freight height did not actually decrease from the previous gallery witness');require(not cut['freight']['motorLit'] and cut['freight']['lastForce']['motorForce']==0 and cut['freight']['velocity']<-.2,'Optical cut is not a real zero-force gravity return')
    require(restored['freight']['height']>8.95 and restored['freight']['motorLit'] and restored['physicsSteps']>cut['physicsSteps'],'Relight did not restore the actual carriage')
    between=[s for s in states if cut['physicsSteps']<=s['physicsSteps']<=restored['physicsSteps']];require(any(not s['freight']['motorLit'] and s['freight']['velocity']<-.2 for s in between),'No retained dark descending movie sample');dark=[s['freight']['height'] for s in between if not s['freight']['motorLit']];require(len(dark)>1 and any(h<max(dark[:i])-.01 for i,h in enumerate(dark) if i>0) and restored['freight']['height']>min(dark)+1,'Movie telemetry does not prove actual gravity displacement and subsequent restored ascent');require(any(s['freight']['motorLit'] and s['freight']['lastForce']['motorForce']>0 and s['freight']['velocity']>.2 for s in between),'No retained lit ascent movie sample')
    passenger_ids=None
    for state in states:
        freight=state['freight'];force=freight['lastForce']
        if force:
            require(0<=force['motorForce']<=260+1e-8 and force['motorPower']<=400+1e-8,'Unbounded native freight force/power')
            if not force['motorLit']:require(force['motorForce']==0,'Dark freight supplies positive force')
        cars=state['passengerLifts']['cars'];ids=[c['bodyId'] for c in cars];require(len(ids)==2 and len(set(ids))==2,'Missing two distinct actual passenger bodies')
        passenger_ids=passenger_ids or ids;require(ids==passenger_ids,'Passenger bodies were replaced')
        for car in cars:
            f=car['lastForce']
            if f:
                require(0<=f['motorForce']<=360+1e-8 and abs(f['motorPower'])<=730+1e-8 and f['dampingPower']<=1e-8 and abs(f['forceBalanceY'])<1e-8,'Invalid passenger force witness')
                if not f['powered']:require(f['motorForce']==0,'Dark passenger motor supplies force')
    return {'frames':len(rows),'durationSeconds':len(rows)/4,'simulationSeconds':report['route']['seconds'],'fullyDecoded':True,'originalCargoBodyId':report['route']['bodyId'],'sameOriginalShape':True,'opticalCutGravityReturnAndRelight':True,'twoDynamicPassengerBodies':passenger_ids,'movieBytes':movie.stat().st_size,'movieSha256':file_sha(movie),'telemetrySha256':file_sha(telemetry)},metadata

def audit(args):
    source=args.source.resolve();provider=args.provider.resolve();evidence=args.evidence.resolve();commit=args.commit;run_id=args.run;tree,parents=identity(source,commit)
    workflow=git(source,'show',commit+':'+WORKFLOW);tests=re.search(r'tests=\(([^)]+)\)',workflow);require(tests and tests.group(1).split()==PHYSICS_FILES,'Independent physics gate differs from immutable workflow')
    run,run_path=read_provider(provider,['run.json','source-run.json']);jobs,jobs_path=read_provider(provider,['jobs.json','source-jobs.json']);jobs=jobs.get('jobs',jobs) if isinstance(jobs,dict) else jobs
    artifacts,artifacts_path=read_provider(provider,['artifacts.json','source-artifacts.json']);artifacts=artifacts.get('artifacts',artifacts) if isinstance(artifacts,dict) else artifacts
    meta,meta_path=read_provider(provider,['commit.json','git.json','source-git.json','source-git-commit.json']);mapping=validate_provider(run,jobs,artifacts,meta,commit,tree,parents,run_id)
    archives=[verified_zip(evidence/(a['name']+'.zip'),evidence/a['name'],a) for a in artifacts]
    logs={}
    for job in jobs:
        p=provider/'logs'/f"{job['id']}.log";require(p.is_file() and 0<p.stat().st_size<=25_000_000,'Missing actual producer log');logs[job['name']]=p.read_text(encoding='utf-8-sig')
    manifest=load(evidence/'physical-power-dist/build-info.json');files=inventory(evidence/'physical-power-dist');payload=[r for r in files if r['path'] not in ('build-info.json','release-manifest.json')]
    require(manifest['commit']==manifest['gameCommit']==manifest['interfaceCommit']==commit and manifest['publisherCommit'] is None and manifest['run']==str(run_id) and manifest['version']==VERSION and manifest['verified'] is False,'Wrong stamped source/run/version')
    require(manifest['runtimeConfig']==FLAGS and [r['stableLevel'] for r in manifest['rooms']]==SEQUENCE and [r['level'] for r in manifest['rooms']]==list(range(1,52)),'Stale campaign/runtime/order')
    require(manifest['files']==payload and manifest['packageFilesSha256']==sha(encoded(payload)) and manifest['sourceInputFiles']>=331,'Manifest package/input closure differs')
    for row in manifest['sourceInputs']:require(file_sha(source/safe_name(row['filename']))==row['sha256'],'Changed source input')
    require(sha(encoded(manifest['sourceInputs']))==manifest['sourceInputsSha256'],'Source input digest differs')
    build=load(evidence/'physical-power-build/report.json');require(build['pass'] is True and build['sourceAccepted'] is False and build['publicationAccepted'] is False and build['sourceCommit']==commit and build['sourceTree']==tree and build['sourceParent']==parents[0] and build['sourceReview']=={'runId':run_id,'runAttempt':1} and build['version']==VERSION and build['dist']=={'files':files,'bytes':sum(r['bytes'] for r in files),'inventorySha256':sha(encoded(files))},'Build closure does not match exact candidate')
    original_models=git(source,'ls-tree','-r','--name-only',BASE).splitlines();original_models=[n for n in original_models if n.endswith('.glb')];require(len(original_models)==59,'Original model inventory changed')
    for n in original_models:require((source/n).read_bytes()==git(source,'show',BASE+':'+n,binary=True),'Original GLB replaced: '+n)
    require(len([r for r in files if re.fullmatch(r'models/runtime/model-\d+.*\.glb',r['path'])])==14,'Active14model inventory differs')
    check_runtime_assets(source,evidence/'physical-power-dist',files)
    all_tests=sorted(p.name for p in (source/'tests').iterdir() if p.name.endswith('.test.js') and not p.name.startswith('lab-tower'));cpu_total=0;partition=[]
    for part in range(6):
        d=evidence/f'physical-power-cpu-{part}';r=load(d/'report.json');tap=(d/'full.tap').read_text();counts=tap_counts(tap)
        require(r['sourceCommit']==commit and r['part']==part and r['parts']==6 and r['allFiles']==all_tests and r['files']==['tests/'+n for i,n in enumerate(all_tests) if i%6==part] and r['code']==0 and r['signal'] is None and r['pass'] is True and r['counts']==counts,'Wrong CPU shard/file/count closure');stdout_contains(tap,logs[f'cpu ({part})']);cpu_total+=counts['tests'];partition+=r['files']
    require(len(partition)==len(set(partition))==len(all_tests),'CPU test partitions overlap or omit tests')
    physics=evidence/'physical-power-physics';r=load(physics/'report.json');tap=(physics/'full.tap').read_text();counts=tap_counts(tap);require(r['sourceCommit']==commit and r['sourceTree']==tree and r['sourceReview']=={'runId':run_id,'runAttempt':1} and r['pass'] is True and r['counts']==counts,'Wrong novel physics report');require(r['files']==[{'path':p,'sha256':file_sha(source/p)} for p in PHYSICS_FILES],'Missing required current physical regression');stdout_contains(tap,logs['physics'])
    decoded=[];ordinary=[];native=[];room_by_stable={r['stableLevel']:r for r in manifest['rooms']}
    for part,levels in GROUPS.items():
        r=load(evidence/f'physical-power-ordinary-{part}/report.json');require(r['sourceCommit']==commit and r['pass'] is True and r['runtime']==FLAGS and r['selected']==levels and [x['stableLevel'] for x in r['rows']]==levels and not r.get('active') and not r.get('failure'),'Wrong ordinary group')
        for row in r['rows']:require(row['number']==room_by_stable[row['stableLevel']]['level'] and row['id']==room_by_stable[row['stableLevel']]['id'] and type(row['frames']) in (int,float) and math.isfinite(row['frames']) and row['frames']>0 and row['pass'] is True and row['state']=='won' and row['sameOriginal'] is True and row['resets']==row['respawns']==0 and row.get('cargoResets',0) in (None,0) and not row.get('error'),'Ordinary win/cargo/reset failure');ordinary.append(row)
        d=evidence/f'physical-power-native-{part}';group_frames=[];r=load(d/'report.json');require(r['sourceCommit']==commit and r['pass'] is True and r['capturePass'] is True and r['strictCapture'] is True and r['mode']=='route' and r['errors']==[] and [x['level'] for x in r['rows']]==levels and not r.get('active'),'Wrong native group')
        require(r['package']=={k:manifest[k] for k in ['commit','version','editionVersion','sourceInputsSha256']},'Wrong native package stamp')
        for row in r['rows']:
            route=row['route'];capture=row['captures']['finish'];
            if row['level']==20:require(route.get('cargoResets')==0,'Room20 cargo reset evidence missing')
            require(row['pass'] is True and row['gameplayPassed'] is True and row['capturePass'] is True and row['errors']==[] and row['start']['missingModels']==[],'Native failed or missing production models')
            require(row['visibleRoom']==room_by_stable[row['level']]['level'] and list(row['captures'])==['finish'] and type(route['frames']) in (int,float) and math.isfinite(route['frames']) and route['frames']>0 and route['pass'] is True and route['state']=='won' and route['sameCompanion'] is True and route['sameCargoShape'] is True and route['cargoUUID']==row['start']['cargoUUID'] and route['cargoBodyId']==row['start']['cargoBodyId'] and all(route.get(k) in (None,0) for k in ['resets','respawns','cargoResets']),'Native changed cargo/shape or reset')
            require(capture['ok'] is True and capture['includesHTML'] is False and capture['renderer']['calls']>0 and capture['renderer']['triangles']>0 and capture['frame']['state']=='won' and capture['frame']['levelIndex']==row['level']-1 and capture['frame']['cargoUUID']==row['start']['cargoUUID'] and capture['frame']['cargoBodyId']==row['start']['cargoBodyId'],'Substituted/unbound finish pixels')
            frame=image(d/f"{row['level']}-finish.jpg");decoded.append(frame);group_frames.append(frame);native.append(row)
        check_browser_record(d,source,commit,tree,parents,run_id,levels,group_frames)
    require(sorted(x['stableLevel'] for x in ordinary)==sorted(x['level'] for x in native)==list(range(1,52)),'Campaign does not cover all51rooms')
    stages=['freight','sluice','optics','hoist','archive','flywheel','magnet','migrant','pendulum','inertia','crown']
    for marks in [next(r for r in ordinary if r['stableLevel']==41)['milestones'],next(r for r in native if r['level']==41)['route']['milestones']]:require([m['name'][7:] for m in marks if m.get('name','').startswith('Solved ')]==stages,'Castle route omitted/reordered a required physical stage')
    presentation=evidence/'physical-power-presentation';overview=load(presentation/'architecture/report.json');require(overview['package']=={k:manifest[k] for k in ['commit','version','editionVersion','sourceInputsSha256']} and overview['sourceCommit']==commit and overview['pass'] is True and overview['capturePass'] is True and overview['inspectionQuality']=='balanced' and overview['strictCapture'] is True and overview['errors']==[] and [x['level'] for x in overview['rows']]==[25,41],'Missing changed interior checks')
    for row in overview['rows']:
        require(row['pass'] is True and row['capturePass'] is True and row['errors']==[] and row['start']['quality']=='balanced' and row['start']['shadows'] is True and not row['framing']['geometryVisibilityChanged'],'Invalid changed interior view')
        for kind in ['start','overview']:require(row['captures'][kind]['ok'] is True,'Missing changed interior canvas');decoded.append(image(presentation/'architecture'/f"{row['level']}-{kind}.jpg"))
    check_browser_record(presentation/'architecture',source,commit,tree,parents,run_id,[25,41],decoded[-4:])
    menu=load(presentation/'menu/report.json');sizes=[(1440,900),(1024,768),(360,800),(390,844),(412,915),(844,390)];require(menu['package']=={k:manifest[k] for k in ['commit','version','editionVersion','sourceInputsSha256']} and menu['pass'] is True and menu['errors']==[] and [(r['width'],r['height']) for r in menu['viewports']]==sizes,'Incomplete responsive menu')
    for row,(w,h) in zip(menu['viewports'],sizes):require(row['pass'] is True and row['reach']['pass'] is True and row['scrollWidth']<=w+2,'Menu clipping/reach failure');frame=image(presentation/'menu'/f'menu-{w}x{h}.png');require((frame['width'],frame['height'])==(w,h),'Wrong menu pixels');decoded.append(frame)
    storage=load(presentation/'storage/report.json');require(storage['package']=={k:manifest[k] for k in ['commit','version','editionVersion','sourceInputsSha256']} and storage['sourceCommit']==commit and storage['pass'] is True and storage['errors']==[] and len(storage['checks'])==3 and re.fullmatch(r'http://127\.0\.0\.1:\d+/campaign-v57/',storage['url']),'Wrong v57 save isolation')
    for key,volume,tutorial in [('imported',.29,True),('reloaded',.37,False)]:
        s=storage[key];require(s['completed']==[0,1,6,9] and s['hints']=={'1':2} and s['resumeLevel']==3 and s['volume']==volume and s['tutorial'] is tutorial and s['quality']=='low' and s['muted'] is True,'Save import/reload regression')
    yandex=evidence/'physical-power-yandex';yr=load(yandex/'report.json');archive=yandex/'brainrot-portal-v57-yandex.zip';require(yr['pass'] is True and yr['sourceCommit']==commit and yr['sourceTree']==tree and yr['run']==str(run_id) and yr['runAttempt']=='1' and yr['workingTreeModified'] is False and yr['builtFromCurrentSource'] is True and yr['compressedBytes']==archive.stat().st_size and yr['sha256']==file_sha(archive) and yr['unpackedBytes']<=LIMIT and yr['limitBytes']==LIMIT and yr['levels']==51 and yr['models']==14,'Wrong Yandex source package')
    with zipfile.ZipFile(archive) as z:
        members=z.infolist();require(0<len(members)<=10000 and sum(m.file_size for m in members)<=LIMIT and all(stat.S_IFMT(m.external_attr>>16) in (0,stat.S_IFREG) and not m.flag_bits&1 for m in members),'Unsafe or oversized nested Yandex ZIP');require(z.testzip() is None,'Yandex ZIP CRC failure');require(all(not m.is_dir() for m in members) and len({m.filename for m in members})==len(members),'Duplicate/directory Yandex member');actual=[{'filename':safe_name(m.filename),'bytes':m.file_size,'sha256':sha(z.read(m))} for m in sorted(members,key=lambda m:m.filename)];require(actual==yr['files'] and sum(m['bytes'] for m in actual)==yr['unpackedBytes']<=LIMIT,'Yandex ZIP/report differs')
        require(any(m['filename']=='index.html' for m in actual) and all(not re.search(r'(^|/)(qa|scripts|docs|tools)/|\.(mp4|webm|map|md)$|(?:Journey|LabEvidence|Capture)[^/]*\.(?:js|json)$',m['filename'],re.I) for m in actual),'QA/review media shipped in Yandex')
        ym=json.loads(z.read('build-info.json'));require(ym['commit']==commit and ym['version']==VERSION and ym['levels']==51 and ym['runtimeConfig']==FLAGS and ym['sourceInputsSha256']==manifest['sourceInputsSha256'] and ym['run']==str(run_id),'Yandex manifest source differs')
        for row in actual:
            if row['filename'].startswith(('models/runtime/','draco/')):require(row['sha256']==next(x['sha256'] for x in files if x['path']==row['filename']),'Yandex model/decoder changed')
    sdk=load(presentation/'yandex-browser/sdk-production-proof.json');require(sdk['pass'] is True and sdk['errors']==[] and sdk['phase']=='mobile-start' and len(sdk['checks'])==3 and sdk['desktopPlayLog']==['ready','start','stop','start','stop','ad-open','ad-close','start'] and sdk['mobileLog']==['ready','fullscreen-request','start','stop','start'],'Mock SDK/start/pause integration failed')
    for n in ['desktop-menu.png','mobile-playing.png']:decoded.append(image(presentation/'yandex-browser'/n))
    require(build['yandex']=={'filename':archive.name,'bytes':archive.stat().st_size,'sha256':file_sha(archive),'unpackedBytes':yr['unpackedBytes']},'Build/Yandex archive closure differs')
    movie,metadata=native_movie(evidence,source,commit,tree,run_id)
    require('ROOM25_NATIVE_DIAGNOSTIC_COMPLETE '+commit in logs['room25-native'] and movie['movieSha256'] in logs['room25-native'],'Native completion/movie hash absent from actual producer log')
    with tempfile.TemporaryDirectory(prefix='v57-pure-proof-') as temporary:
        temp=pathlib.Path(temporary);probe=temp/'probe.json';probe.write_text(json.dumps(metadata));out=temp/'pure-gates.json'
        subprocess.run(['node','--input-type=module','-e',NODE_GATES,str(source),str(evidence),commit,str(run_id),str(probe),str(out)],cwd=source,check=True,timeout=120);pure=load(out)
    identity(source,commit)
    # Seal inputs again after every decoder and pure validator has finished.
    for pin,expected in zip(artifacts,archives):require(verified_zip(evidence/(pin['name']+'.zip'),evidence/pin['name'],pin)==expected,'Evidence changed during acceptance')
    receipt={'schemaVersion':1,'kind':'independent-v57-source-acceptance','generatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceAccepted':True,'publicationAccepted':False,'sourceCommit':commit,'sourceTree':tree,'sourceParent':parents[0] if len(parents)==1 else None,'sourceReview':{'runId':run_id,'runAttempt':1},'run':run_id,'runAttempt':1,'version':VERSION,'edition':'foundation','sourceInputsSha256':manifest['sourceInputsSha256'],'sourceInputFiles':manifest['sourceInputFiles'],'checks':{'provider':{'jobs':22,'successfulJobs':22,'artifacts':24,'attempt':1},'cpu':{'tests':cpu_total,'passed':cpu_total,'failed':0,'files':len(all_tests),'disjointShards':6},'novelPhysics':{'files':len(PHYSICS_FILES),'tests':counts['tests'],'passed':counts['pass'],'failed':0},'ordinaryRoutes':{'rooms':51,'won':51,'sameOriginalCompanion':51,'resets':0,'respawns':0},'nativeRoutes':{'rooms':51,'gameplayPassed':51,'capturesPassed':51,'won':51,'sameOriginalCompanion':51,'resets':0,'respawns':0},'decodedImages':len(decoded),'changedRoomInteriorFrames':4,'responsiveMenuFrames':6,'saveIsolationV57':True,'mockedYandexSdk':True,'room25ContinuousNative':movie,'currentImmutablePureValidators':pure},'packages':{'dist':{'files':len(files),'bytes':sum(r['bytes'] for r in files),'inventorySha256':sha(encoded(files))},'yandex':{'filename':archive.name,'bytes':archive.stat().st_size,'sha256':file_sha(archive),'unpackedBytes':yr['unpackedBytes']}},'sourceLogs':[{'jobId':job['id'],'bytes':(provider/'logs'/f"{job['id']}.log").stat().st_size,'sha256':file_sha(provider/'logs'/f"{job['id']}.log")} for job in jobs],'candidateFiles':files,'candidateBytes':sum(r['bytes'] for r in files),'candidateInventorySha256':sha(encoded(files)),'sourceArtifacts':archives,'sourceProvider':{'run':{'path':str(run_path),'sha256':file_sha(run_path)},'jobs':{'path':str(jobs_path),'sha256':file_sha(jobs_path)},'commit':{'path':str(meta_path),'sha256':file_sha(meta_path)},'artifacts':{'path':str(artifacts_path),'sha256':file_sha(artifacts_path)}},'scope':'Exact completed SOURCE attempt:22jobs/24archives,51ordinary+51production-native wins, original assets, finite physical regressions, real Room25 MP4 and immutable current upper-contact/ride witnesses. No public acceptance.','limitations':['Automated software WebGL and scripted input; human puzzle discovery and physical-device FPS remain unmeasured.','Only Room25 has a continuous current MP4;51 native wins and the castle upper mechanism are backed by finish frames and physical event witnesses, not full-route movies.','The retained Room25 movie samples4fps;120Hz force evidence is authenticated aggregate observations, not a retained complete120Hz trace.','Finite regressions do not prove closure of every bypass.','No live Yandex SDK, advertising delivery, platform moderation or publication acceptance.','The castle is not500 unique stages; the historical500-stage and proved15-minute human-speedrun requirements remain open.']}
    args.output.parent.mkdir(parents=True,exist_ok=True);temporary=args.output.with_suffix('.tmp');temporary.write_text(json.dumps(receipt,ensure_ascii=False,indent=2,allow_nan=False)+'\n');os.replace(temporary,args.output)
    return receipt

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    for name in ['source','provider','evidence','output']:parser.add_argument('--'+name,type=pathlib.Path,required=True)
    parser.add_argument('--commit',required=True);parser.add_argument('--run',type=int,required=True);args=parser.parse_args();require(re.fullmatch('[a-f0-9]{40}',args.commit) and args.run>0,'Exact SOURCE commit and run are required')
    receipt=audit(args);print(json.dumps({'pass':True,'sourceAccepted':True,'publicationAccepted':False,'sourceCommit':args.commit,'sourceReview':receipt['sourceReview'],'checks':receipt['checks'],'receipt':str(args.output)},ensure_ascii=False))
if __name__=='__main__':main()
