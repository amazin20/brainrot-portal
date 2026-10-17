"""Independent read-only acceptance of one exact v60 SOURCE Actions attempt.

Does not run routes, rebuild the game, publish, change source, or claim human/device tests.
The small frozen QA observer is independently recompiled in memory for byte comparison.
Only after every gate passes is the source-acceptance receipt written atomically.
"""
import argparse, datetime, hashlib, json, math, os, pathlib, re, stat, subprocess, tempfile, zipfile
from PIL import Image, ImageStat

REPOSITORY='amazin20/brainrot-portal'
BRANCH='upgrade/first-chapter-20261017'
WORKFLOW='.github/workflows/first-chapter-review.yml'
VERSION='v60-first-chapter'
BASE='c79dbe271588c639d9881f9591efc330f947ea0f'
LIMIT=100_000_000
GROUPS={'early':list(range(1,11)),'energy':list(range(11,21)),'living':list(range(21,31)),'optics':list(range(31,41)),'fracture':list(range(42,52)),'castle':[41]}
SEQUENCE=list(range(1,41))+list(range(42,52))+[41]
FLAGS={'chamberEdition':'foundation','puzzleProgression':True,'campaignSequencePresentation':True,'room23PhysicalPrototype':True}
PHYSICS_FILES=['tests/'+n for n in ['lab-room25-optics.test.js','lab-room25-continuous-drive.test.js','lab-room25-required-drive.test.js','lab-room25-passenger-lifts.test.js','lab-room25-passenger-aperture.test.js','lab-room25-optical-adversarial-v57.test.js','room25-native-driver.test.js','lab-singularity-upper-lift.test.js','lab-castle-upper-adversarial-v57.test.js','lab-castle-impulse-cell.test.js','lab-castle-impulse-branch.test.js','lab-castle-impulse-behavior.test.js']]

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
    rows.sort(key=lambda r:r['path'])
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
    roles={'build':['first-chapter-dist','first-chapter-yandex','first-chapter-build'],'presentation':['first-chapter-presentation']}
    for i in range(6):roles[f'cpu ({i})']=[f'first-chapter-cpu-{i}']
    for part,levels in GROUPS.items():
        for kind in ['ordinary','native']:roles[f'{kind} ({part}, '+','.join(map(str,levels))+')']=[f'first-chapter-{kind}-{part}']
    for group in ['early','later']:roles[f'attacks ({group})']=[f'first-chapter-attacks-{group}']
    for room in range(1,11):roles[f'films ({room})']=[f'first-chapter-film-{room}']
    return roles

def workflow_contract(text):
    # Parse the immutable producer workflow, then close its expanded matrix
    # against the independently declared required scope. No synthetic receipt.
    import yaml
    data=yaml.safe_load(text);trigger=data.get('on',data.get(True))
    require(trigger=={'push':{'branches':[BRANCH]}},'SOURCE workflow trigger differs')
    require(data.get('permissions')=={'contents':'read'},'SOURCE workflow permissions differ')
    require(data.get('concurrency')=={'group':'first-chapter-review-${{ github.sha }}','cancel-in-progress':True},'SOURCE concurrency must isolate immutable commits')
    jobs=data.get('jobs',{});require(set(jobs)=={'build','cpu','ordinary','native','presentation','attacks','films'},'Unexpected/missing SOURCE job declaration')
    roles={}
    for base,job in jobs.items():
        require(not any(k in job for k in ['if','continue-on-error','name']),'Conditional/soft/custom SOURCE job')
        matrix=job.get('strategy',{}).get('matrix');rows=[{}]
        if matrix is not None:
            require(job['strategy'].get('fail-fast') is False,'SOURCE matrix may cancel siblings')
            require('exclude' not in matrix,'SOURCE matrix excludes required cases')
            if 'include' in matrix:
                require(set(matrix)=={'include'},'Unexpected SOURCE include matrix axes');rows=matrix['include']
                require(base in ['ordinary','native'] and rows==[{'part':p,'rooms':','.join(map(str,levels))} for p,levels in GROUPS.items()],'Wrong ordinary/native full51 matrix')
            else:
                require(len(matrix)==1,'Unexpected SOURCE matrix axes');key,values=next(iter(matrix.items()));rows=[{key:v} for v in values]
                wanted={'cpu':('part',list(range(6))),'attacks':('group',['early','later']),'films':('room',list(range(1,11)))}
                require(base in wanted and (key,values)==wanted[base],'Missing/duplicate/wrong SOURCE matrix cases')
        else:require(base in ['build','presentation'],'Required SOURCE matrix absent')
        steps=job.get('steps',[]);checkouts=[s for s in steps if s.get('uses')=='actions/checkout@v4']
        require(len(checkouts)==1 and checkouts[0].get('with')=={'ref':'${{ github.sha }}','fetch-depth':0,'persist-credentials':False},'SOURCE job checkout must freeze exact commit')
        uploads=[s for s in steps if s.get('uses')=='actions/upload-artifact@v4'];require(uploads,'SOURCE job has no artifact upload')
        for row in rows:
            name=base+(' ('+', '.join(str(v) for v in row.values())+')' if row else '')
            require(name not in roles,'Duplicate expanded SOURCE job');names=[]
            for step in uploads:
                settings=step.get('with',{});require(settings.get('retention-days')==14 and settings.get('if-no-files-found')=='error','SOURCE artifact retention/missing-file policy differs')
                value=settings.get('name','')
                for key,entry in row.items():value=value.replace('${{ matrix.'+key+' }}',str(entry))
                require(re.fullmatch(r'first-chapter-[a-z0-9-]+',value),'Unexpanded/invalid SOURCE artifact name');names.append(value)
            roles[name]=names
    require(roles==expected_roles(),'Immutable workflow expanded scope differs from required SOURCE scope')
    return roles

def instant(s):return datetime.datetime.fromisoformat(s.replace('Z','+00:00'))
def validate_provider(run,jobs,artifacts,commit_meta,commit,tree,parents,run_id):
    require(run['id']==run_id and run['run_attempt']==1 and run['head_sha']==commit and run['head_branch']==BRANCH and run['path']==WORKFLOW and run['event']=='push','Wrong SOURCE run identity')
    require(run['repository']['full_name']==REPOSITORY and run['status']=='completed' and run['conclusion']=='success','SOURCE attempt has not completed successfully')
    require(commit_meta['sha']==commit and commit_meta['tree']['sha']==tree and [p['sha'] for p in commit_meta['parents']]==parents,'Provider commit/tree/parents differ from checkout')
    roles=expected_roles();job_count=len(roles);artifact_count=sum(map(len,roles.values()));require(len(jobs)==job_count and len({j['id'] for j in jobs})==job_count and {j['name'] for j in jobs}==set(roles),'Incomplete SOURCE job cohort')
    require(len(artifacts)==artifact_count and len({a['id'] for a in artifacts})==artifact_count and {a['name'] for a in artifacts}=={a for names in roles.values() for a in names},'Incomplete SOURCE artifact cohort')
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

HISTORICAL_ROOT_SHA256='ae075c138226ac4fd5172a076b29582c1bb77211d9c903b0a487b5202da4c35e'

def same_file_record(record,file,name=None):
    require(isinstance(record,dict) and file.is_file() and not file.is_symlink(),'Missing bound file')
    require(record.get('bytes')==file.stat().st_size and record.get('sha256')==file_sha(file),'Bound file size/hash differs: '+file.name)
    if name is not None:require(record.get('filename',record.get('name'))==name,'Bound filename differs')

def closed_media(directory,wanted):
    index=load(directory/'closed-media-member-inventory.json');rows=index['files']
    require(len(rows)==len(wanted) and {r['name'] for r in rows}==set(wanted),'Missing/extra closed media member')
    for row in rows:same_file_record(row,directory/safe_name(row['name']),row['name'])
    return rows

def check_http_binding(directory,binding,manifest,info_bytes,commit,tree):
    require(binding['source']['commit']==commit and binding['source']['tree']==tree,'Capture source commit/tree differs')
    require(binding['source']['sourceInputsSha256']==manifest['sourceInputsSha256'] and binding['source']['sourceInputFiles']==manifest['sourceInputFiles'] and binding['sourceInputs']==manifest['sourceInputs'],'Capture source input closure differs')
    package=binding['package'];require(package['commit']==commit and package['files']==manifest['files'] and package['buildInfoBytes']==len(info_bytes) and package['buildInfoSha256']==sha(info_bytes),'Capture package metadata/files differ')
    served=load(directory/'served-package.json')
    require(served['sourceCommit']==commit and served['sourceTree']==tree and served['allHTTPFilesVerified'] is True and served['files']==[dict(row,status=200) for row in manifest['files']]+[{'path':'build-info.json','bytes':len(info_bytes),'sha256':sha(info_bytes),'status':200}],'Capture did not serve every exact candidate HTTP body')

def movie_probe_and_decode(movie,frames,fps,width,height):
    metadata=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_streams','-show_format','-of','json',str(movie)],timeout=300))
    require(len(metadata['streams'])==1,'Unexpected native media streams');stream=metadata['streams'][0]
    require(stream['codec_type']=='video' and stream['codec_name']=='h264' and stream['width']==width and stream['height']==height,'Wrong native codec/dimensions')
    require(stream['r_frame_rate']==stream['avg_frame_rate']==f'{fps}/1' and int(stream['nb_frames'])==int(stream['nb_read_frames'])==frames,'Actual native cadence/frame count differs')
    require(abs(float(stream['duration'])-frames/fps)<1e-5 and abs(float(metadata['format']['duration'])-frames/fps)<1e-5,'Actual native duration differs')
    decoded=subprocess.check_output(['ffmpeg','-hide_banner','-loglevel','error','-xerror','-i',str(movie),'-vf','scale=160:90,signalstats,metadata=mode=print:file=-','-f','null','-'],timeout=300,text=True)
    mins=re.findall(r'lavfi\.signalstats\.YMIN=([\d.]+)',decoded);maxs=re.findall(r'lavfi\.signalstats\.YMAX=([\d.]+)',decoded)
    require(len(mins)==len(maxs)==frames and all(float(b)-float(a)>12 for a,b in zip(mins,maxs)),'Blank/truncated/undecodable native frame')
    return metadata

def verify_decoded_keyframe(movie,keyframe,index):
    # Compare actual decoded RGB, rather than trusting a declared MP4 SHA on an
    # unrelated still. PNG compression metadata need not match across decoders.
    with tempfile.TemporaryDirectory(prefix='v60-keyframe-') as temporary:
        target=pathlib.Path(temporary)/'frame.png'
        subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-xerror','-i',str(movie),'-vf',f'select=eq(n\\,{index})','-vsync','0','-frames:v','1','-pix_fmt','rgb24',str(target)],check=True,timeout=300)
        with Image.open(target) as actual,Image.open(keyframe) as retained:
            actual.load();retained.load();require(actual.size==retained.size and actual.convert('RGB').tobytes()==retained.convert('RGB').tobytes(),'Retained keyframe is not its exact decoded movie frame')

def first_chapter_film(evidence,source,commit,tree,run,manifest,logs,level):
    directory=evidence/f'first-chapter-film-{level}';tag=f'{level:02d}'
    movie_name=f'room-{tag}-full.mp4';trace_name=f'room-{tag}-telemetry.jsonl';pixel_name=f'room-{tag}-native-pixels.log'
    key_names=[f'room-{tag}-keyframe-{i:02d}.png' for i in range(1,4)]
    media=[movie_name,trace_name,'first-chapter-native-report.json','ffprobe.json',pixel_name,*key_names]
    wanted={'binding.json','served-package.json','native-browser.json','native-ui-play.json','closed-media-member-inventory.json',*media}
    require({r['path'] for r in inventory(directory,80_000_000)}==wanted,'Unexpected/missing first-chapter full-movie artifact member')
    report=load(directory/'first-chapter-native-report.json');binding=load(directory/'binding.json');movie=directory/movie_name;trace=directory/trace_name
    require(report['source']==binding['source'] and report['controller']==binding['controller'] and report['package']==binding['package'],'First-chapter report differs from initial binding')
    check_http_binding(directory,binding,manifest,(evidence/'first-chapter-dist/build-info.json').read_bytes(),commit,tree)
    c=binding['controller'];require(c['commit']==commit and c['tree']==tree and c['runId']==run and c['runAttempt']==1 and c['trackedWorkingTreeClean'] is True,'First-chapter native controller/producer differs')
    models=[n for n in git(source,'ls-tree','-r','--name-only',commit).splitlines() if n.endswith('.glb')]
    require(len(models)==59 and binding['source']['originalModels']==[{'path':n,'bytes':(source/n).stat().st_size,'sha256':file_sha(source/n)} for n in models],'First-chapter original model freeze differs')
    package=binding['package'];journeys=[r for r in manifest['files'] if re.fullmatch(r'assets/LabV8Journey-[A-Za-z0-9_-]+\.js',r['path'])]
    require(len(journeys)==1 and package['journey']==journeys[0] and package['fileCount']==len(manifest['files']) and package['totalBytes']==sum(r['bytes'] for r in manifest['files']) and package['packageFilesSha256']==manifest['packageFilesSha256'] and package['originalRuntimeModels']==14,'Native production journey/package closure differs')
    require(load(directory/'native-ui-play.json')==report['ui'] and load(directory/'native-browser.json')==report['browser'],'First-chapter actual browser/UI witnesses differ')
    require(report['route']['level']==level and report['route']['id']==next(r['id'] for r in manifest['rooms'] if r['stableLevel']==level),'Native movie is for another room')
    same_file_record(report['video'],movie,movie_name);same_file_record(report['telemetry'],trace,trace_name)
    require(0<movie.stat().st_size<=40_000_000 and 0<trace.stat().st_size<=12_000_000 and (directory/'first-chapter-native-report.json').stat().st_size<=8_000_000,'First-chapter native media budget exceeded')
    closed_media(directory,media)
    rows=[json.loads(line) for line in trace.read_text().splitlines()];encoded(rows)
    require(1<len(rows)<=3602 and report['telemetry']['samples']==len(rows),'First-chapter retained samples differ')
    metadata=movie_probe_and_decode(movie,len(rows),12,640,360)
    stored_probe=load(directory/'ffprobe.json');require(stored_probe['streams'][0]['nb_frames']==metadata['streams'][0]['nb_frames'] and stored_probe['streams'][0]['r_frame_rate']=='12/1','Producer ffprobe differs from independently counted media')
    same_file_record(report['video']['pixelCheck'],directory/pixel_name,pixel_name)
    pixel_text=(directory/pixel_name).read_text();mins=re.findall(r'lavfi\.signalstats\.YMIN=([\d.]+)',pixel_text);maxs=re.findall(r'lavfi\.signalstats\.YMAX=([\d.]+)',pixel_text)
    ranges=[float(b)-float(a) for a,b in zip(mins,maxs)]
    require(len(mins)==len(maxs)==len(rows) and all(v>12 for v in ranges) and report['video']['pixelCheck']['minimumLuminanceRange']==min(ranges),'Producer all-frame luminance witness differs')
    keyframes=report['keyframes'];indices=[math.floor((len(rows)-1)*.25),math.floor((len(rows)-1)*.6),len(rows)-1]
    require(len(keyframes)==3 and [k['filename'] for k in keyframes]==key_names,'Missing first-chapter actual movie keyframes')
    images=[]
    for record,name,index in zip(keyframes,key_names,indices):
        require(record['encodedFrame']==index and record['visualFrame']==rows[index]['state']['visualFrame'] and record['movieSha256']==file_sha(movie),'Keyframe movie/index binding differs')
        same_file_record(record,directory/name,name);frame=image(directory/name);require((frame['width'],frame['height'])==(640,360),'Wrong first-chapter keyframe pixels');verify_decoded_keyframe(movie,directory/name,index);images.append(frame)
    marker=re.findall(r'FIRST_CHAPTER_NATIVE_DIAGNOSTIC_COMPLETE (\d+) ([a-f0-9]{40}) ([\d.e+\-]+) (\d+) ([a-f0-9]{64})',logs[f'films ({level})'])
    require(len(marker)==1 and int(marker[0][0])==level and marker[0][1]==commit and float(marker[0][2])==report['route']['seconds'] and int(marker[0][3])==len(rows) and marker[0][4]==file_sha(movie),'Native completion/movie hash absent from actual producer stdout')
    return {'level':level,'frames':len(rows),'durationSeconds':len(rows)/12,'simulationSeconds':report['route']['seconds'],'fullyDecoded':True,'sameOriginalShape':True,'completeRoute':True,'movieBytes':movie.stat().st_size,'movieSha256':file_sha(movie),'telemetrySha256':file_sha(trace)},metadata,images

def historical_media_compatibility(source,commit,receipt_path,evidence):
    require(receipt_path.is_file() and not receipt_path.is_symlink() and file_sha(receipt_path)==HISTORICAL_ROOT_SHA256,'Wrong immutable historical Root receipt')
    receipt=load(receipt_path);require(receipt['sourceAccepted'] is True and receipt['publicationAccepted'] is False and receipt['sourceCommit']==BASE and receipt['sourceTree']=='b59e227168d3d02a0893f02136acc20bb0c81c9f' and receipt['sourceReview']=={'runId':38964231823,'runAttempt':1} and receipt['version']=='v59-castle-impulse','Historical media is not the accepted v59 source')
    names=git(source,'ls-tree','-r','--name-only',BASE).splitlines()
    mechanics=[n for n in names if re.fullmatch(r'src/game/(?:LabRoom25[^/]*|LabPortalRoom25|LabSingularity[^/]*|LabCastleImpulse[^/]*|LabCompanionBehavior|LabPhysics)\.js',n)]
    require(len(mechanics)>=15,'Historical mechanics compatibility inventory incomplete')
    for name in mechanics:require((source/name).read_bytes()==git(source,'show',BASE+':'+name,binary=True),'Historical room mechanics changed: '+name)
    rows=[]
    for role,key,filename in [('room25-native','room25ContinuousNative','room25-required.mp4'),('castle-native','castleContinuousNative','castle-required.mp4')]:
        name='castle-impulse-'+role;pin=next(r for r in receipt['sourceArtifacts'] if r['artifactName']==name)
        actual_pin={'id':pin['artifactId'],'name':name,'size_in_bytes':pin['zipBytes'],'digest':'sha256:'+pin['zipSha256']}
        require(verified_zip(evidence/(name+'.zip'),evidence/name,actual_pin)==pin,'Historical exact archive closure changed')
        old=receipt['checks'][key];movie=evidence/name/filename
        require(old['fullyDecoded'] is True and old['sameOriginalShape'] is True and movie.stat().st_size==old['movieBytes'] and file_sha(movie)==old['movieSha256'],'Historical original movie differs')
        rows.append({'kind':role,'label':'compatibleHistorical','currentV60Capture':False,'sourceCommit':BASE,'sourceReview':receipt['sourceReview'],'movieBytes':old['movieBytes'],'movieSha256':old['movieSha256'],'historicallyFullyDecoded':True})
    return {'label':'compatibleHistorical','currentV60Capture':False,'currentSourceCommit':commit,'historicalSourceCommit':BASE,'historicalRootReceiptSha256':HISTORICAL_ROOT_SHA256,'unchangedMechanics':[{'path':n,'sha256':file_sha(source/n)} for n in mechanics],'rows':rows,'scope':'Accepted v59 movies retain their exact original bytes and identity. Unchanged mechanism source and fresh v60 route regressions establish bounded compatibility; these are not current-v60 visual captures.'}


def first_chapter_attacks(evidence,commit,tree,run,manifest,logs,group):
    directory=evidence/('first-chapter-attacks-'+group);report_file=directory/'first-chapter-attacks-browser-report.json'
    report=load(report_file);binding=load(directory/'binding.json');pure=load(directory/(group+'-attacks-report.json'));cases=report['caseObservations']
    require(report['group']==group and report['sourceReview']==report['captureRun']=={'runId':run,'runAttempt':1},'Wrong actual attack source/capture run')
    require(report['providerRun']=={'commit':commit,'runId':run,'runAttempt':1},'Attack provider commit/run differs from actual Actions cohort')
    require(report['captureOrigin']=='http://127.0.0.1:4173' and report['capturePath']=='/campaign-v60/','Wrong actual source attack mount')
    require(report['source']==binding['source'] and report['controller']==binding['controller'] and report['package']==binding['package'],'Attack wrapper differs from initial freeze')
    require(report['controller']['commit']==commit and report['controller']['tree']==tree and report['controller']['runId']==run and report['controller']['runAttempt']==1 and report['controller']['trackedWorkingTreeClean'] is True,'Attack controller belongs to another producer')
    check_http_binding(directory,binding,manifest,(evidence/'first-chapter-dist/build-info.json').read_bytes(),commit,tree)
    require(len(cases)==len(pure['cases']) and len(cases)>0,'Incomplete browser attack case set')
    wanted={'binding.json','served-package.json','native-browser.json','attack-harness.js','attack-harness-inputs.json',group+'-attacks-report.json','first-chapter-attacks-browser-report.json','closed-media-member-inventory.json'}
    for index in range(1,len(cases)+1):wanted.update({f'case-{index:02d}-observation.json',f'case-{index:02d}-start.jpg',f'case-{index:02d}-end.jpg'})
    require({r['path'] for r in inventory(directory,100_000_000)}==wanted,'Missing/extra actual browser attack artifact member')
    closed=load(directory/'closed-media-member-inventory.json');require(closed['files']==[{'name':r['path'],'bytes':r['bytes'],'sha256':r['sha256']} for r in inventory(directory,100_000_000) if r['path']!='closed-media-member-inventory.json'],'Attack artifact closed inventory differs')
    require(load(directory/'native-browser.json')==report['browser'],'Actual browser attack product differs')
    require(load(directory/'attack-harness-inputs.json')==report['harness'],'Compiled attack harness input inventory differs')
    same_file_record(report['harness'],directory/'attack-harness.js','attack-harness.js')
    require(sha(encoded(report['harness']['inputs']))==report['harness']['inputsSha256'],'Compiled attack input digest differs')
    images=[]
    for index,case in enumerate(cases,1):
        require(load(directory/f'case-{index:02d}-observation.json')==case and case['observation']==pure['cases'][index-1],'Actual case/pure observation differs')
        for phase in ['start','end']:
            name=f'case-{index:02d}-{phase}.jpg';capture=case['captures'][phase];same_file_record(capture,directory/name,name)
            frame=image(directory/name);require((frame['width'],frame['height'])==(640,360),'Wrong actual attack canvas dimensions')
            declared=next(r for r in report['closedMedia'] if r['filename']==name)
            for key in ['width','height','bytes','sha256','colors']:require(declared[key]==frame[key],'Attack decoded pixels differ from declaration')
            require(abs(declared['maxChannelStd']-frame['maxChannelStd'])<1e-8,'Attack decoded luminance differs');images.append(frame)
    marker=re.findall(r'FIRST_CHAPTER_ATTACKS_DIAGNOSTIC_COMPLETE (early|later) ([a-f0-9]{40}) (\d+) ([a-f0-9]{64})',logs['attacks ('+group+')'])
    require(marker==[(group,commit,str(len(cases)),file_sha(report_file))],'Actual attack completion/hash absent from producer stdout')
    return {'group':group,'pass':True,'immutablePureValidator':True,'cases':len(cases),'originalCargo':True,'closedInventory':True,'reportSha256':file_sha(report_file)},images

NODE_GATES=r'''
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
const [source,evidence,commit,run,probesFile,output]=process.argv.slice(1),read=p=>JSON.parse(fs.readFileSync(p));
const load=p=>import(pathToFileURL(path.join(source,p)));const dist=path.join(evidence,'first-chapter-dist'),manifest=read(path.join(dist,'build-info.json'));
const {verifyReleaseMetadata,buildSourceInputs}=await load('scripts/lib/release-manifest.mjs');verifyReleaseMetadata(manifest,{directory:dist,commit,root:source,run});
const {verifyCampaignPackage}=await load('scripts/v8-package-check.mjs');verifyCampaignPackage(dist);
const sourceInputs=buildSourceInputs(source),filesFor=names=>names.map(p=>{const bytes=fs.readFileSync(path.join(source,p));return {path:p,bytes:bytes.length,sha256:hash(bytes)};});
const {assertCampaignBrowserState}=await load('scripts/lib/campaign-browser-contract.mjs'),{assertFoundation20Route}=await load('scripts/lib/foundation20-native-proof.mjs'),{assertPendulumPhysicalProof}=await load('scripts/lib/tower41-pendulum-proof.mjs'),{assertCastleImpulsePhysicalProof}=await load('scripts/lib/castle-impulse-native-proof.mjs');
const upper=[],impulsePhysicalProofs=[];let nativeBrowserStates=0,foundation20Routes=0;
for(const part of ['early','energy','living','optics','fracture','castle']){
 const native=read(path.join(evidence,'first-chapter-native-'+part+'/report.json'));for(const row of native.rows){assertCampaignBrowserState(row.start,row.level);nativeBrowserStates++;if(row.level===20){assertFoundation20Route(row.route.foundation20Proof);foundation20Routes++;}}
 const ordinary=read(path.join(evidence,'first-chapter-ordinary-'+part+'/report.json'));for(const row of ordinary.rows)if(row.stableLevel===20){assertFoundation20Route(row.foundation20Proof);foundation20Routes++;}
}
assert.equal(nativeBrowserStates,51);assert.equal(foundation20Routes,2);
for(const kind of ['ordinary','native']){
 const report=read(path.join(evidence,'first-chapter-'+kind+'-castle/report.json')),row=report.rows[0],marks=kind==='native'?row.route.milestones:row.milestones;
 const pendulum=marks.find(x=>x.name==='Solved pendulum')?.physicsProof;upper.push({kind,...assertPendulumPhysicalProof(pendulum,kind==='native'?row.start.cargoBodyId:pendulum.lowerPhysicalCell.originalCargoBodyId)});
 const proof=marks.find(x=>x.name==='Solved impulse')?.physicsProof,bodyId=kind==='native'?row.start.cargoBodyId:proof?.impulseCell?.originalCargoBodyId;
 assertCastleImpulsePhysicalProof(proof,bodyId);impulsePhysicalProofs.push({kind,pass:true,originalCargoBodyId:bodyId,originalCargoShapeId:proof.impulseCell.originalCargoShapeId,worldStep:proof.impulseCell.worldStep});
}
for(const row of read(path.join(evidence,'first-chapter-presentation/architecture/report.json')).rows)assertCampaignBrowserState(row.start,row.level);
const {assertFirstChapterNativeDiagnostic,FIRST_CHAPTER_NATIVE_HARNESS_FILES}=await load('scripts/lib/first-chapter-native-proof.mjs'),probes=read(probesFile),nativeFiles=filesFor(FIRST_CHAPTER_NATIVE_HARNESS_FILES);
for(let level=1;level<=10;level++){
 const dir=path.join(evidence,'first-chapter-film-'+level),r=read(path.join(dir,'first-chapter-native-report.json')),b=read(path.join(dir,'binding.json')),tag=String(level).padStart(2,'0'),rows=fs.readFileSync(path.join(dir,'room-'+tag+'-telemetry.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
 assertFirstChapterNativeDiagnostic(r,{binding:b,rows,movieMetadata:probes[level]});assert.deepEqual(b.sourceInputs,sourceInputs);assert.deepEqual(b.controller.files,nativeFiles);assert.equal(b.controller.filesSha256,hash(JSON.stringify(nativeFiles)));assert.deepEqual(b.package.files,manifest.files);
}
const {FIRST_CHAPTER_ATTACK_HARNESS_FILES,assertFirstChapterAttacksBrowserDiagnostic,firstChapterAttackCatalogue}=await load('scripts/lib/first-chapter-attack-browser.mjs');
const {compileFirstChapterAttackHarness}=await load('scripts/qa-first-chapter-attacks-browser.mjs');
const attackFiles=filesFor(FIRST_CHAPTER_ATTACK_HARNESS_FILES),controllerFiles=filesFor([...new Set([...FIRST_CHAPTER_NATIVE_HARNESS_FILES,...FIRST_CHAPTER_ATTACK_HARNESS_FILES])].sort()),attacks=[];
for(const group of ['early','later']){
 const dir=path.join(evidence,'first-chapter-attacks-'+group),r=read(path.join(dir,'first-chapter-attacks-browser-report.json')),b=read(path.join(dir,'binding.json')),pureReport=read(path.join(dir,group+'-attacks-report.json')),closedInventory=read(path.join(dir,'closed-media-member-inventory.json'));
 assert.deepEqual(b.sourceInputs,sourceInputs);assert.deepEqual(b.controller.files,controllerFiles);assert.equal(b.controller.filesSha256,hash(JSON.stringify(controllerFiles)));assert.deepEqual(b.sourceHarness.files,attackFiles);assert.equal(b.sourceHarness.filesSha256,hash(JSON.stringify(attackFiles)));assert.deepEqual(b.package.files,manifest.files);
 const rebuilt=await compileFirstChapterAttackHarness({sourceRoot:source,base:new URL(r.captureOrigin+r.capturePath),journey:b.package.journey});Object.assign(rebuilt.descriptor,{sourceHead:commit,url:r.harness.url,onlyInterceptedRequest:r.harness.url});assert.deepEqual(rebuilt.descriptor,r.harness);assert.deepEqual(rebuilt.bytes,fs.readFileSync(path.join(dir,'attack-harness.js')));
 const checked=assertFirstChapterAttacksBrowserDiagnostic(r,{group,source:b.source,controller:b.controller,package:b.package,captureOrigin:r.captureOrigin,pureReport,closedInventory});assert.equal(checked.cases,firstChapterAttackCatalogue(group).length);attacks.push({group,cases:checked.cases,pass:true});
}
fs.writeFileSync(output,JSON.stringify({pass:true,nativeBrowserStates,foundation20Routes,sourceManifestInputs:manifest.sourceInputFiles,sourceInputsSha256:manifest.sourceInputsSha256,upperPhysicalProofs:upper,castleImpulseNativePureValidator:true,impulsePhysicalProofs,firstChapterNativePureValidator:true,firstChapterAttacksPureValidator:true,firstChapterAttackGroups:attacks}));
'''

def audit(args):
    source=args.source.resolve();provider=args.provider.resolve();evidence=args.evidence.resolve();commit=args.commit;run_id=args.run;tree,parents=identity(source,commit)
    workflow=git(source,'show',commit+':'+WORKFLOW);roles=workflow_contract(workflow);job_count=len(roles);artifact_count=sum(map(len,roles.values()))
    run,run_path=read_provider(provider,['run.json','source-run.json']);jobs,jobs_path=read_provider(provider,['jobs.json','source-jobs.json'])
    require(isinstance(jobs,dict) and jobs.get('total_count')==len(jobs.get('jobs',[]))==job_count,'Truncated/noncanonical source jobs provider');jobs=jobs['jobs']
    artifacts,artifacts_path=read_provider(provider,['artifacts.json','source-artifacts.json'])
    require(isinstance(artifacts,dict) and artifacts.get('total_count')==len(artifacts.get('artifacts',[]))==artifact_count,'Truncated/noncanonical source artifacts provider');artifacts=artifacts['artifacts']
    meta,meta_path=read_provider(provider,['commit.json','git-commit.json','git.json','source-git.json','source-git-commit.json']);mapping=validate_provider(run,jobs,artifacts,meta,commit,tree,parents,run_id)
    archives=[verified_zip(evidence/(a['name']+'.zip'),evidence/a['name'],a) for a in artifacts]
    require({p.name for p in (provider/'logs').glob('*.log')}=={str(j['id'])+'.log' for j in jobs},'Missing/extra raw source job log')
    logs={}
    for job in jobs:
        p=provider/'logs'/f"{job['id']}.log";require(p.is_file() and 0<p.stat().st_size<=25_000_000,'Missing actual producer log');logs[job['name']]=p.read_text(encoding='utf-8-sig')
    manifest=load(evidence/'first-chapter-dist/build-info.json');files=inventory(evidence/'first-chapter-dist');payload=[r for r in files if r['path'] not in ('build-info.json','release-manifest.json')]
    require(manifest['commit']==manifest['gameCommit']==manifest['interfaceCommit']==commit and manifest['publisherCommit'] is None and manifest['run']==str(run_id) and manifest['version']==VERSION and manifest['verified'] is False,'Wrong stamped source/run/version')
    require(manifest['origins']=={'game':BASE,'previousPublication':'29e252b92e848197c1051725e9838a4084f0aaf7'},'Wrong accepted game/publication origin')
    require(all(r.get('presentationRevision')=='first-chapter-service-frames-v1' for r in manifest['rooms'][:10]),'Missing current first-chapter art revision')
    require(manifest['runtimeConfig']==FLAGS and [r['stableLevel'] for r in manifest['rooms']]==SEQUENCE and [r['level'] for r in manifest['rooms']]==list(range(1,52)),'Stale campaign/runtime/order')
    require(manifest['files']==payload and manifest['packageFilesSha256']==sha(encoded(payload)) and manifest['sourceInputFiles']>=331,'Manifest package/input closure differs')
    for row in manifest['sourceInputs']:require(file_sha(source/safe_name(row['filename']))==row['sha256'],'Changed source input')
    require(sha(encoded(manifest['sourceInputs']))==manifest['sourceInputsSha256'],'Source input digest differs')
    build=load(evidence/'first-chapter-build/report.json');require(build['pass'] is True and build['sourceAccepted'] is False and build['publicationAccepted'] is False and build['sourceCommit']==commit and build['sourceTree']==tree and build['sourceParent']==parents[0] and build['sourceReview']=={'runId':run_id,'runAttempt':1} and build['version']==VERSION and build['dist']=={'files':files,'bytes':sum(r['bytes'] for r in files),'inventorySha256':sha(encoded(files))},'Build closure does not match exact candidate')
    original_models=git(source,'ls-tree','-r','--name-only',BASE).splitlines();original_models=[n for n in original_models if n.endswith('.glb')];require(len(original_models)==59,'Original model inventory changed')
    for n in original_models:require((source/n).read_bytes()==git(source,'show',BASE+':'+n,binary=True),'Original GLB replaced: '+n)
    require(len([r for r in files if re.fullmatch(r'models/runtime/model-\d+.*\.glb',r['path'])])==14,'Active14model inventory differs')
    check_runtime_assets(source,evidence/'first-chapter-dist',files)
    all_tests=sorted(p.name for p in (source/'tests').iterdir() if p.name.endswith('.test.js') and not p.name.startswith('lab-tower'));cpu_total=0;partition=[]
    for part in range(6):
        d=evidence/f'first-chapter-cpu-{part}';r=load(d/'report.json');tap=(d/'full.tap').read_text();counts=tap_counts(tap)
        require(r['sourceCommit']==commit and r['part']==part and r['parts']==6 and r['allFiles']==all_tests and r['files']==['tests/'+n for i,n in enumerate(all_tests) if i%6==part] and r['code']==0 and r['signal'] is None and r['pass'] is True and r['counts']==counts,'Wrong CPU shard/file/count closure');stdout_contains(tap,logs[f'cpu ({part})']);cpu_total+=counts['tests'];partition+=r['files']
    require(len(partition)==len(set(partition))==len(all_tests),'CPU test partitions overlap or omit tests')
    require(set(PHYSICS_FILES)<=set(partition),'Required unchanged physical regressions are absent from current CPU shards')
    decoded=[];ordinary=[];native=[];room_by_stable={r['stableLevel']:r for r in manifest['rooms']}
    for part,levels in GROUPS.items():
        r=load(evidence/f'first-chapter-ordinary-{part}/report.json');require(r['sourceCommit']==commit and r['pass'] is True and r['runtime']==FLAGS and r['selected']==levels and [x['stableLevel'] for x in r['rows']]==levels and not r.get('active') and not r.get('failure'),'Wrong ordinary group')
        for row in r['rows']:require(row['number']==room_by_stable[row['stableLevel']]['level'] and row['id']==room_by_stable[row['stableLevel']]['id'] and type(row['frames']) in (int,float) and math.isfinite(row['frames']) and row['frames']>0 and row['pass'] is True and row['state']=='won' and row['sameOriginal'] is True and row['resets']==row['respawns']==0 and row.get('cargoResets',0) in (None,0) and not row.get('error'),'Ordinary win/cargo/reset failure');ordinary.append(row)
        d=evidence/f'first-chapter-native-{part}';group_frames=[];r=load(d/'report.json');require(r['sourceCommit']==commit and r['pass'] is True and r['capturePass'] is True and r['strictCapture'] is True and r['mode']=='route' and r['errors']==[] and [x['level'] for x in r['rows']]==levels and not r.get('active'),'Wrong native group')
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
    stages=['freight','sluice','optics','hoist','archive','flywheel','magnet','migrant','pendulum','inertia','impulse','crown']
    for marks in [next(r for r in ordinary if r['stableLevel']==41)['milestones'],next(r for r in native if r['level']==41)['route']['milestones']]:require([m['name'][7:] for m in marks if m.get('name','').startswith('Solved ')]==stages,'Castle route omitted/reordered a required physical stage')
    presentation=evidence/'first-chapter-presentation';overview=load(presentation/'architecture/report.json');require(overview['package']=={k:manifest[k] for k in ['commit','version','editionVersion','sourceInputsSha256']} and overview['sourceCommit']==commit and overview['pass'] is True and overview['capturePass'] is True and overview['inspectionQuality']=='balanced' and overview['strictCapture'] is True and overview['errors']==[] and [x['level'] for x in overview['rows']]==list(range(1,11)),'Missing changed interior checks')
    for row in overview['rows']:
        require(row['pass'] is True and row['capturePass'] is True and row['errors']==[] and row['start']['quality']=='balanced' and row['start']['shadows'] is True and not row['framing']['geometryVisibilityChanged'],'Invalid changed interior view')
        for kind in ['start','overview']:require(row['captures'][kind]['ok'] is True,'Missing changed interior canvas');decoded.append(image(presentation/'architecture'/f"{row['level']}-{kind}.jpg"))
    check_browser_record(presentation/'architecture',source,commit,tree,parents,run_id,list(range(1,11)),decoded[-20:])
    menu=load(presentation/'menu/report.json');sizes=[(1440,900),(1024,768),(360,800),(390,844),(412,915),(844,390)];require(menu['package']=={k:manifest[k] for k in ['commit','version','editionVersion','sourceInputsSha256']} and menu['pass'] is True and menu['errors']==[] and [(r['width'],r['height']) for r in menu['viewports']]==sizes,'Incomplete responsive menu')
    for row,(w,h) in zip(menu['viewports'],sizes):require(row['pass'] is True and row['reach']['pass'] is True and row['scrollWidth']<=w+2,'Menu clipping/reach failure');frame=image(presentation/'menu'/f'menu-{w}x{h}.png');require((frame['width'],frame['height'])==(w,h),'Wrong menu pixels');decoded.append(frame)
    storage=load(presentation/'storage/report.json');require(storage['package']=={k:manifest[k] for k in ['commit','version','editionVersion','sourceInputsSha256']} and storage['sourceCommit']==commit and storage['pass'] is True and storage['errors']==[] and len(storage['checks'])==3 and re.fullmatch(r'http://127\.0\.0\.1:\d+/campaign-v60/',storage['url']),'Wrong v60 save isolation')
    for key,volume,tutorial in [('imported',.29,True),('reloaded',.37,False)]:
        s=storage[key];require(s['completed']==[0,1,6,9,40] and s['hints']=={'1':2,'40':3} and s['resumeLevel']==3 and s['volume']==volume and s['tutorial'] is tutorial and s['quality']=='low' and s['muted'] is True,'Save import/reload regression')
    yandex=evidence/'first-chapter-yandex';yr=load(yandex/'report.json');archive=yandex/'brainrot-portal-v60-yandex.zip';require(yr['pass'] is True and yr['sourceCommit']==commit and yr['sourceTree']==tree and yr['run']==str(run_id) and yr['runAttempt']=='1' and yr['workingTreeModified'] is False and yr['builtFromCurrentSource'] is True and yr['compressedBytes']==archive.stat().st_size and yr['sha256']==file_sha(archive) and yr['unpackedBytes']<=LIMIT and yr['limitBytes']==LIMIT and yr['levels']==51 and yr['models']==14,'Wrong Yandex source package')
    with zipfile.ZipFile(archive) as z:
        members=z.infolist();require(0<len(members)<=10000 and sum(m.file_size for m in members)<=LIMIT and all(stat.S_IFMT(m.external_attr>>16) in (0,stat.S_IFREG) and not m.flag_bits&1 for m in members),'Unsafe or oversized nested Yandex ZIP');require(z.testzip() is None,'Yandex ZIP CRC failure');require(all(not m.is_dir() for m in members) and len({m.filename for m in members})==len(members),'Duplicate/directory Yandex member');actual=[{'filename':safe_name(m.filename),'bytes':m.file_size,'sha256':sha(z.read(m))} for m in sorted(members,key=lambda m:m.filename)];require(actual==yr['files'] and sum(m['bytes'] for m in actual)==yr['unpackedBytes']<=LIMIT,'Yandex ZIP/report differs')
        require(any(m['filename']=='index.html' for m in actual) and all(not re.search(r'(^|/)(qa|scripts|docs|tools)/|\.(mp4|webm|map|md)$|(?:Journey|LabEvidence|Capture)[^/]*\.(?:js|json)$',m['filename'],re.I) for m in actual),'QA/review media shipped in Yandex')
        ym=json.loads(z.read('build-info.json'));require(ym['commit']==commit and ym['version']==VERSION and ym['levels']==51 and ym['runtimeConfig']==FLAGS and ym['sourceInputsSha256']==manifest['sourceInputsSha256'] and ym['run']==str(run_id),'Yandex manifest source differs')
        for row in actual:
            if row['filename'].startswith(('models/runtime/','draco/')):require(row['sha256']==next(x['sha256'] for x in files if x['path']==row['filename']),'Yandex model/decoder changed')
    sdk=load(presentation/'yandex-browser/sdk-production-proof.json');require(sdk['pass'] is True and sdk['errors']==[] and sdk['phase']=='mobile-start' and len(sdk['checks'])==3 and sdk['desktopPlayLog']==['ready','start','stop','start','stop','ad-open','ad-close','start'] and sdk['mobileLog']==['ready','fullscreen-request','start','stop','start'],'Mock SDK/start/pause integration failed')
    for n in ['desktop-menu.png','mobile-playing.png']:decoded.append(image(presentation/'yandex-browser'/n))
    require(build['yandex']=={'filename':archive.name,'bytes':archive.stat().st_size,'sha256':file_sha(archive),'unpackedBytes':yr['unpackedBytes']},'Build/Yandex archive closure differs')
    films=[];probes={}
    for level in range(1,11):
        film,probe,frames=first_chapter_film(evidence,source,commit,tree,run_id,manifest,logs,level);films.append(film);probes[level]=probe;decoded.extend(frames)
    attacks=[]
    for group in ['early','later']:
        result,frames=first_chapter_attacks(evidence,commit,tree,run_id,manifest,logs,group);attacks.append(result);decoded.extend(frames)
    historical=historical_media_compatibility(source,commit,args.historical_source_acceptance.resolve(),args.historical_evidence.resolve())
    with tempfile.TemporaryDirectory(prefix='v60-pure-proof-') as temporary:
        temp=pathlib.Path(temporary);probe_file=temp/'probes.json';probe_file.write_text(json.dumps(probes));out=temp/'pure-gates.json'
        subprocess.run(['node','--input-type=module','-e',NODE_GATES,str(source),str(evidence),commit,str(run_id),str(probe_file),str(out)],cwd=source,check=True,timeout=180);pure=load(out)
    require(pure['firstChapterAttackGroups']==[{'group':r['group'],'cases':r['cases'],'pass':True} for r in attacks],'Current pure attack catalog differs from retained case set')
    identity(source,commit)
    # Re-seal all exact inputs after independent decoders and current validators.
    for pin,expected in zip(artifacts,archives):require(verified_zip(evidence/(pin['name']+'.zip'),evidence/pin['name'],pin)==expected,'Evidence changed during acceptance')
    require(file_sha(args.historical_source_acceptance)==HISTORICAL_ROOT_SHA256,'Historical Root receipt changed during acceptance')
    checks={'provider':{'jobs':job_count,'successfulJobs':job_count,'artifacts':artifact_count,'attempt':1},
      'cpu':{'tests':cpu_total,'passed':cpu_total,'failed':0,'files':len(all_tests),'disjointShards':6,'requiredLegacyPhysicsFiles':len(PHYSICS_FILES)},
      'ordinaryRoutes':{'rooms':51,'won':51,'sameOriginalCompanion':51,'resets':0,'respawns':0},
      'nativeRoutes':{'rooms':51,'gameplayPassed':51,'capturesPassed':51,'won':51,'sameOriginalCompanion':51,'resets':0,'respawns':0},
      'decodedImages':len(decoded),'changedRoomInteriorFrames':20,'responsiveMenuFrames':6,'saveIsolationV60':True,'mockedYandexSdk':True,
      'firstChapterContinuousNative':{'rooms':10,'fullyDecoded':True,'fps':12,'rows':films},
      'firstChapterAttacks':{'groups':2,'rooms':10,'groupResults':attacks},
      'compatibleHistoricalMedia':historical,'currentImmutablePureValidators':pure}
    receipt={'schemaVersion':1,'kind':'independent-v60-source-acceptance','generatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
      'sourceAccepted':True,'publicationAccepted':False,'sourceCommit':commit,'sourceTree':tree,'sourceParent':parents[0] if len(parents)==1 else None,
      'sourceReview':{'runId':run_id,'runAttempt':1},'run':run_id,'runAttempt':1,'version':VERSION,'edition':'foundation',
      'sourceInputsSha256':manifest['sourceInputsSha256'],'sourceInputFiles':manifest['sourceInputFiles'],'checks':checks,
      'packages':{'dist':{'files':len(files),'bytes':sum(r['bytes'] for r in files),'inventorySha256':sha(encoded(files))},'yandex':{'filename':archive.name,'bytes':archive.stat().st_size,'sha256':file_sha(archive),'unpackedBytes':yr['unpackedBytes']}},
      'sourceLogs':[{'jobId':job['id'],'bytes':(provider/'logs'/f"{job['id']}.log").stat().st_size,'sha256':file_sha(provider/'logs'/f"{job['id']}.log")} for job in jobs],
      'candidateFiles':files,'candidateBytes':sum(r['bytes'] for r in files),'candidateInventorySha256':sha(encoded(files)),'sourceArtifacts':archives,
      'sourceProvider':{'run':{'path':str(run_path),'sha256':file_sha(run_path)},'jobs':{'path':str(jobs_path),'sha256':file_sha(jobs_path)},'commit':{'path':str(meta_path),'sha256':file_sha(meta_path)},'artifacts':{'path':str(artifacts_path),'sha256':file_sha(artifacts_path)}},
      'scope':'Exact immutable SOURCE workflow cohort, all six CPU shards, 51 ordinary and 51 native wins, 10 independent complete12fps first-chapter movies, current bounded browser attacks, original assets and current physical witnesses. No public acceptance.',
      'limitations':['Scripted software WebGL input; human discovery, human challenge and physical-device FPS remain unmeasured.',
       'Only the first10 rooms have fresh complete v60 native movies. Other current native wins retain finish stills; historical v59 full Room25/castle movies remain explicitly historical.',
       'Movies retain12fps canvas frames;120Hz counters and identity guards do not constitute a full120Hz retained geometry trace.',
       'The enumerated bounded attacks do not establish closure of every bypass or every successful alternative.',
       'No live Yandex SDK, ads delivery, moderation or public acceptance is claimed.']}
    args.output.parent.mkdir(parents=True,exist_ok=True);temporary=args.output.with_suffix('.tmp');temporary.write_text(json.dumps(receipt,ensure_ascii=False,indent=2,allow_nan=False)+'\n');os.replace(temporary,args.output)
    return receipt

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    for name in ['source','provider','evidence','output','historical-source-acceptance','historical-evidence']:parser.add_argument('--'+name,type=pathlib.Path,required=True)
    parser.add_argument('--commit',required=True);parser.add_argument('--run',type=int,required=True);args=parser.parse_args();require(re.fullmatch('[a-f0-9]{40}',args.commit) and args.run>0,'Exact SOURCE commit and run are required')
    receipt=audit(args);print(json.dumps({'pass':True,'sourceAccepted':True,'publicationAccepted':False,'sourceCommit':args.commit,'sourceReview':receipt['sourceReview'],'checks':receipt['checks'],'receipt':str(args.output)},ensure_ascii=False))
if __name__=='__main__':main()
