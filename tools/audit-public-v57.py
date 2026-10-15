"""Independent terminal PUBLIC acceptance; reads provider metadata and immutable proof.

Does not deploy, rebuild, capture browsers, or change the producer's deliberately
unaccepted receipt. Root acceptance requires all eleven actual jobs to be done.
"""
import argparse, datetime, hashlib, json, math, os, pathlib, re, stat, subprocess, tempfile, zipfile
from PIL import Image, ImageStat

REPO='amazin20/brainrot-portal'
BASE='https://amazin20.github.io/brainrot-portal/'
PREFIX='campaign-v57/'
URL=BASE+PREFIX
WORKFLOW='.github/workflows/publish-campaign-v57.yml'
SOURCE_WORKFLOW='.github/workflows/physical-power-review.yml'
SOURCE_BRANCH='upgrade/physical-power-20261015'
CONFIG='tools/campaign-v57-release.json'
VERSION='v57-physical-power'
OLD=(2119,647805522,'a5e8625856ced4cfa99fd46c957d7155b52f104f54a8479af15d7b139f0e61ac')
CATALOG_SHA='1111dff70a645853526cccbb5831704e39e96fdc9daf12cbfb3899ff94ee591f'
OLD_DEPLOY={'id':7094450003,'sha':'8184c23bfac7d97261e90e4dae4477a651e8bfaf'}
GROUPS={'early':list(range(1,11)),'energy':list(range(11,21)),'living':list(range(21,31)),'optics':list(range(31,41)),'fracture':list(range(42,52)),'castle':[41]}
ARTIFACT_JOBS={'github-pages':'prepare','v57-preparation':'prepare','v57-deployment-lease':'deploy','v57-public-http':'public-http','v57-public-entry':'entry','v57-final-public-proof':'verify',**{'v57-public-native-'+g:'native ('+g+')' for g in GROUPS}}
LIMIT=800_000_000

def require(value,message):
    if not value:raise AssertionError(message)
def sha(data):return hashlib.sha256(data).hexdigest()
def encoded(value):return json.dumps(value,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode()
def file_sha(path):
    h=hashlib.sha256()
    with pathlib.Path(path).open('rb') as f:
        for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
    return h.hexdigest()
def load(path):
    def pairs(items):
        result={}
        for key,value in items:require(key not in result,'Duplicate JSON key');result[key]=value
        return result
    data=pathlib.Path(path).read_bytes();require(len(data)<=25_000_000,'Oversized JSON metadata')
    return json.loads(data,object_pairs_hook=pairs,parse_constant=lambda _:require(False,'Nonfinite JSON'))
def provider(folder,name,collection=None):
    value=load(folder/(name+'.json'))
    return value.get(collection,value) if collection and isinstance(value,dict) else value
def safe_name(name):
    require(isinstance(name,str) and name and not name.startswith('/') and '\\' not in name and not re.match(r'^[A-Za-z]:',name),'Unsafe member path')
    require(all(p not in ('','.','..') for p in name.split('/')) and all(ord(c)>=32 and ord(c)!=127 for c in name),'Noncanonical member path')
    require(len(name.encode())<2048 and len(name.split('/'))<=64,'Oversized member path');return name
def rows_valid(rows,maximum=LIMIT):
    require(isinstance(rows,list) and 0<len(rows)<=10000,'Invalid inventory')
    names=[];total=0
    for row in rows:
        require(set(row)=={'path','bytes','sha256'} and type(row['bytes']) is int and 0<=row['bytes']<=maximum and re.fullmatch('[a-f0-9]{64}',row['sha256']),'Invalid inventory row')
        names.append(safe_name(row['path']));total+=row['bytes']
    require(names==sorted(set(names)) and total<=maximum,'Unsorted/duplicate/oversized inventory')
    paths=set(names);require(all(not any('/'.join(n.split('/')[:i]) in paths for i in range(1,len(n.split('/')))) for n in paths),'File/directory collision');return {r['path']:r for r in rows}
def inventory(root,maximum=LIMIT):
    require(root.is_dir() and not root.is_symlink(),'Missing proof directory');rows=[]
    for p in sorted(root.rglob('*')):
        require(not p.is_symlink() and (p.is_file() or p.is_dir()),'Special proof member')
        if p.is_file():rows.append({'path':safe_name(p.relative_to(root).as_posix()),'bytes':p.stat().st_size,'sha256':file_sha(p)})
    rows_valid(rows,maximum);return rows
def verified_zip(archive,root,descriptor):
    require(archive.is_file() and not archive.is_symlink() and archive.stat().st_size==descriptor['size_in_bytes'] and 'sha256:'+file_sha(archive)==descriptor['digest'],'Final provider ZIP digest/size mismatch')
    actual=inventory(root);seen=set();rows=[];directories=set();total=0
    with zipfile.ZipFile(archive) as z:
        members=z.infolist();require(0<len(members)<=20000,'ZIP member count')
        for m in members:
            n=safe_name(m.filename.rstrip('/') if m.is_dir() else m.filename);mode=stat.S_IFMT(m.external_attr>>16)
            require(m.orig_filename==m.filename and n not in seen and mode in (0,stat.S_IFDIR if m.is_dir() else stat.S_IFREG) and not m.flag_bits&1 and m.compress_type in (zipfile.ZIP_STORED,zipfile.ZIP_DEFLATED),'Unsafe ZIP member');seen.add(n)
            total+=m.file_size;require(total<=LIMIT and 0<=m.file_size<=LIMIT and (not m.is_dir() or m.file_size==m.CRC==0),'Oversized ZIP member')
            if m.is_dir():directories.add(n);continue
            h=hashlib.sha256();count=0
            with z.open(m) as f:
                for block in iter(lambda:f.read(1024*1024),b''):count+=len(block);require(count<=m.file_size,'ZIP overflow');h.update(block)
            require(count==m.file_size,'ZIP truncation');rows.append({'path':n,'bytes':count,'sha256':h.hexdigest()})
    rows.sort(key=lambda r:r['path']);require(rows==actual,'Final extracted ZIP membership/content mismatch')
    parents={'/'.join(n.split('/')[:i]) for n in seen for i in range(1,len(n.split('/')))}
    require({p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_dir()}==directories|parents,'Extra/missing proof directory')
    return {'artifactId':descriptor['id'],'artifactName':descriptor['name'],'zipBytes':archive.stat().st_size,'zipSha256':file_sha(archive),'files':len(rows),'bytes':sum(r['bytes'] for r in rows),'inventorySha256':sha(encoded(rows))}
def compact_artifact(a):return {k:a[k] for k in ('id','name','size_in_bytes','digest')}
def instant(value):return datetime.datetime.fromisoformat(value.replace('Z','+00:00'))
def job_identity(j):return {k:j[k] for k in ('id','name','run_id','run_attempt','head_sha','status','conclusion')}
def validate_provider(run,jobs,artifacts,commit,run_id):
    require(run['id']==run_id and run['run_attempt']==1 and run['head_sha']==commit and run['head_branch']=='main' and run['event']=='push' and run['path']==WORKFLOW and run['repository']['full_name']==REPO,'Wrong PUBLIC run identity')
    require(run['status']=='completed' and run['conclusion']=='success','PUBLIC run is not terminal success')
    expected={'prepare','deploy','public-http','entry','verify'}|{'native ('+g+')' for g in GROUPS}
    require(len(jobs)==len({j['id'] for j in jobs})==11 and {j['name'] for j in jobs}==expected,'Incomplete PUBLIC11-job cohort')
    for j in jobs:
        require(j['run_id']==run_id and j['run_attempt']==1 and j['head_sha']==commit and j['status']=='completed' and j['conclusion']=='success','Nonterminal/failed PUBLIC job')
        require(j['steps'] and all(s['status']=='completed' and s['conclusion'] in ('success','skipped') for s in j['steps']),'Failed/unfinished PUBLIC step')
    require(len(artifacts)==len({a['id'] for a in artifacts})==12 and {a['name'] for a in artifacts}==set(ARTIFACT_JOBS),'Incomplete PUBLIC12-artifact cohort')
    by_job={j['name']:j for j in jobs}
    for a in artifacts:
        require(a['expired'] is False and type(a['size_in_bytes']) is int and 0<a['size_in_bytes']<=2_000_000_000 and re.fullmatch('sha256:[a-f0-9]{64}',a['digest']),'Invalid/expired PUBLIC artifact')
        p=a['workflow_run'];require(p['id']==run_id and p['head_sha']==commit and p['head_branch']=='main' and p['repository_id']==p['head_repository_id']==1354625251,'Wrong PUBLIC artifact producer')
        action='Run actions/upload-pages-artifact@v3' if a['name']=='github-pages' else 'Run actions/upload-artifact@v4'
        uploads=[s for s in by_job[ARTIFACT_JOBS[a['name']]]['steps'] if s['name']==action and s['conclusion']=='success'];created=instant(a['created_at'])
        require(uploads and any(instant(s['started_at'])-datetime.timedelta(seconds=2)<=created<=instant(s['completed_at'])+datetime.timedelta(seconds=2) for s in uploads),'Artifact is not bound to a successful producer upload')
def deployment(value,commit,run_id,baseline=False):
    d=value['deployment'];states=value['statuses'];require(states and states[0]['state']=='success','Pages deployment is not successful')
    if baseline:require(d['id']==OLD_DEPLOY['id'] and d['sha']==OLD_DEPLOY['sha'],'Historical deployment changed')
    else:
        run_url='https://github.com/'+REPO+'/actions/runs/'+str(run_id)
        require(d['sha']==commit and d['id']>OLD_DEPLOY['id'] and any(states[0].get(k,'').rstrip('/')==run_url or states[0].get(k,'').startswith(run_url+'/') for k in ('log_url','target_url')),'Pages deployment does not belong to the current PUBLIC run')
    require(d['environment']=='github-pages','Wrong deployment environment');return d['id']
def http_summary(rows):return {'files':len(rows),'bytes':sum(r['bytes'] for r in rows),'inventorySha256':sha(encoded(rows)),'method':'complete HTTP GET, exact length and SHA-256 for every file'}
def image(path):
    require(path.is_file() and not path.is_symlink(),'Missing actual pixels')
    with Image.open(path) as im:
        im.load();sample=im.convert('RGB').resize((64,36));require(im.width>=100 and im.height>=100 and max(ImageStat.Stat(sample).stddev)>1,'Blank/invalid actual pixels')
        return {'path':path.name,'bytes':path.stat().st_size,'sha256':file_sha(path),'pixels':{'width':im.width,'height':im.height}}
def check_network(network,stamps,rows,stamp,pages,entry=False):
    expected={URL+r['path']:r for r in rows};expected[URL]=expected[URL+'index.html'];require(network and stamps,'Missing browser response observations')
    for row in network:
        require(type(row['page']) is int and 1<=row['page']<=pages and row['url'] in expected and row['status']==200 and row['fromCache'] is False,'Wrong browser response origin/status/cache')
        require(row['bytes']==expected[row['url']]['bytes'] and row['sha256']==expected[row['url']]['sha256'],'Browser response differs from exact SOURCE package')
    for row in stamps:require(type(row['page']) is int and 1<=row['page']<=pages and row['url']==URL+'build-info.json' and row['status']==200 and row['sha256']==stamp,'Stale browser build stamp')
    if not entry:
        require(len(stamps)==pages and [r['page'] for r in stamps]==list(range(1,pages+1)),'Pages were reused or metadata reads omitted')
        require(all(any(r['page']==n and (r['url'].endswith('/index.html') or r['url'].endswith('.js')) for r in network) for n in range(1,pages+1)),'No original HTML/JS response for a fresh route page')
def check_entry(report,root,c,producer,rows,stamp):
    require(report['kind']=='actual-v57-public-bare-menu-save-isolation' and report['pass'] is True and report['publicationAccepted'] is False and report['producer']==producer and report['sourceCommit']==c['sourceCommit'] and report['publicURL']==URL and report['buildInfoSha256']==stamp and report['errors']==[] and not report.get('failure'),'PUBLIC entry failed or has another origin')
    require([v['state'] for v in report['checks']]==['ready','ready','playing','ready'],'Bare menu/Play/reload sequence missing')
    for i,v in enumerate(report['checks']):
        p=v['ownPreferences'];require(v['index']==3 and v['historicalUnchanged'] is True and p['completed']==[0,1,6] and p['hints']=={'1':2} and p['resumeLevel']==3 and p['quality']=='low' and p['muted'] is True,'v56 save import changed')
        require(p['volume']==(.29 if i==0 else .37) and p['tutorial'] is (i==0),'Own save preferences did not persist')
        require(v['writes'] and all(w['method'] in ('setItem','removeItem') and w['key'].startswith('brainrot-campaign-v57:') for w in v['writes']),'Historical namespace was written')
    names=['bare-menu.png','bare-playing.png','mobile-menu.png'];actual=[image(root/n) for n in names];require(report['captures']==actual,'Entry images differ from genuine decoded files')
    require(actual[0]['pixels']=={'width':1024,'height':768} and actual[2]['pixels']=={'width':360,'height':800},'Entry viewport pixels differ')
    require(len(report['network'])>10,'Insufficient entry response observations');check_network(report['network'],report['browserStampReads'],rows,stamp,1,True);return actual
def bind_controller(controller,tree,paths):
    require(tree['truncated'] is False and tree.get('sha') and len({r['path'] for r in tree['tree']})==len(tree['tree']),'Invalid/truncated controller API tree');by={r['path']:r for r in tree['tree']}
    for name in paths:
        p=controller/safe_name(name);require(p.is_file() and not p.is_symlink(),'Missing frozen controller member: '+name);b=p.read_bytes();g=hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
        require(by[name]['type']=='blob' and by[name]['sha']==g and by[name]['mode']=='100644','Local controller member differs from actual committed Git blob: '+name)

NODE_GATES=r'''
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import{pathToFileURL}from'node:url';
const[source,proof,commit,sourceInputs,output]=process.argv.slice(1),read=p=>JSON.parse(fs.readFileSync(p));
const{assertCampaignBrowserState}=await import(pathToFileURL(path.join(source,'scripts/lib/campaign-browser-contract.mjs')));
const{EDITION_VERSION}=await import(pathToFileURL(path.join(source,'src/game/ReleaseIdentity.js')));
const{assertFoundation20Route}=await import(pathToFileURL(path.join(source,'scripts/lib/foundation20-native-proof.mjs')));
const{assertPendulumPhysicalProof}=await import(pathToFileURL(path.join(source,'scripts/lib/tower41-pendulum-proof.mjs')));
let rooms=0;const upper=[];for(const group of ['early','energy','living','optics','fracture','castle']){
 const dir=path.join(proof,'native-'+group),r=read(path.join(dir,'report.json')),binding=read(path.join(dir,'public-binding.json'));assert.deepEqual(r.package,{commit,version:'v57-physical-power',editionVersion:EDITION_VERSION,sourceInputsSha256:sourceInputs});
 for(const row of r.rows){assertCampaignBrowserState(row.start,row.level);if(row.level===20)assertFoundation20Route(row.route.foundation20Proof);if(row.level===41){const p=row.route.milestones.find(m=>m.name==='Solved pendulum')?.physicsProof;const checked={level:41,...assertPendulumPhysicalProof(p,row.start.cargoBodyId)};assert.deepEqual(binding.novelProofs,[checked]);upper.push(checked);}rooms++;}
 if(group!=='castle')assert.deepEqual(binding.novelProofs,[]);
}
assert.equal(rooms,51);fs.writeFileSync(output,JSON.stringify({pass:true,rooms,upperPhysicalProofs:upper}));
'''

def audit(args):
    controller=args.controller.resolve();source=args.source.resolve();p=args.provider.resolve();e=args.evidence.resolve();commit=args.controllercommit;run_id=args.run
    c=load(controller/CONFIG);require(c['schemaVersion']==1 and c['frozen'] is True and c['publicationAccepted'] is False and c['repository']==REPO and c['namespace']==PREFIX and c['version']==VERSION and c['sourceBranch']==SOURCE_BRANCH and c['sourceWorkflow']==SOURCE_WORKFLOW,'Controller release is not frozen v57')
    require(c['sourceAttempt']==1 and type(c['sourceRun']) is int and c['sourceRun']>0 and c['baselineCatalog']=='tools/campaign-v56-public-files.json' and c['baselineCatalogSha256']==CATALOG_SHA and c['baselineInventorySha256']==OLD[2] and c['baselineDeployment']==OLD_DEPLOY,'Frozen source/baseline pins differ')
    run=provider(p,'run');jobs=provider(p,'jobs','jobs');artifacts=provider(p,'artifacts','artifacts');validate_provider(run,jobs,artifacts,commit,run_id)
    cm=provider(p,'controller-commit');ct=provider(p,'controller-tree');require(cm['sha']==commit and cm['tree']['sha']==ct['sha'] and [r['sha'] for r in cm['parents']]==[c['controllerParent']],'Actual controller commit/tree/parent differ')
    bind_controller(controller,ct,[WORKFLOW,'scripts/publish-campaign-v57.py','scripts/observe-campaign-v57-public.mjs',CONFIG,c['sourceAcceptance']['path'],c['baselineCatalog']])
    require(provider(p,'main')['object']['sha']==commit and provider(p,'source')['object']['sha']==c['sourceCommit'],'Current main/source lease moved')
    sm=provider(p,'source-commit');require(sm['sha']==c['sourceCommit'] and sm['tree']['sha']==c['sourceTree'],'Actual source tree moved')
    require(subprocess.check_output(['git','-C',str(source),'rev-parse','HEAD']).decode().strip()==c['sourceCommit'] and subprocess.check_output(['git','-C',str(source),'rev-parse','HEAD^{tree}']).decode().strip()==c['sourceTree'],'Local immutable source differs')
    require(not subprocess.check_output(['git','-C',str(source),'status','--porcelain','--untracked-files=no']).strip(),'Local immutable source has tracked edits')
    root_path=controller/safe_name(c['sourceAcceptance']['path']);require(file_sha(root_path)==c['sourceAcceptance']['sha256'],'Independent source receipt raw SHA differs');sr=load(root_path)
    require(sr['sourceAccepted'] is True and sr['publicationAccepted'] is False and sr['sourceCommit']==c['sourceCommit'] and sr['sourceTree']==c['sourceTree'] and sr['run']==c['sourceRun'] and sr['runAttempt']==1,'Independent source receipt identity differs')
    require([v['sha'] for v in sm['parents']]==[sr['sourceParent']],'Actual source parent differs from accepted SOURCE receipt')
    for k in ('ordinaryRoutes','nativeRoutes'):require(all(sr['checks'][k][n]==51 for n in ('rooms','won','sameOriginalCompanion')) and sr['checks'][k]['resets']==sr['checks'][k]['respawns']==0,'Source original-companion acceptance incomplete')
    require(sr['checks']['nativeRoutes']['gameplayPassed']==sr['checks']['nativeRoutes']['capturesPassed']==51 and sr['checks']['cpu']['tests']==sr['checks']['cpu']['passed']>0 and sr['checks']['cpu']['failed']==0,'Source CPU/native acceptance incomplete')
    sourcerun=provider(p,'source-run');sourcejobs=provider(p,'source-jobs','jobs');sourceartifacts=provider(p,'source-artifacts','artifacts')
    require(sourcerun['id']==c['sourceRun'] and sourcerun['run_attempt']==1 and sourcerun['head_sha']==c['sourceCommit'] and sourcerun['head_branch']==SOURCE_BRANCH and sourcerun['path']==SOURCE_WORKFLOW and sourcerun['event']=='push' and sourcerun['repository']['full_name']==REPO and sourcerun['status']=='completed' and sourcerun['conclusion']=='success','SOURCE producer is not exact completed success')
    require(len(sourcejobs)==len({j['id'] for j in sourcejobs})==len(c['expectedJobs'])==22 and sorted(j['name'] for j in sourcejobs)==sorted(c['expectedJobs']),'SOURCE22-job cohort differs')
    for j in sourcejobs:require(j['run_id']==c['sourceRun'] and j['run_attempt']==1 and j['head_sha']==c['sourceCommit'] and j['status']=='completed' and j['conclusion']=='success' and all(s['status']=='completed' and s['conclusion'] in ('success','skipped') for s in j['steps']),'SOURCE job is not terminal success')
    require(len(sourceartifacts)==len({a['id'] for a in sourceartifacts})==len(c['sourceArtifacts'])==24 and sorted(map(compact_artifact,sourceartifacts),key=lambda a:a['id'])==sorted(c['sourceArtifacts'],key=lambda a:a['id']),'SOURCE24-artifact pins differ')
    for a in sourceartifacts:require(a['expired'] is False and a['workflow_run']['id']==c['sourceRun'] and a['workflow_run']['head_sha']==c['sourceCommit'] and a['workflow_run']['head_branch']==SOURCE_BRANCH,'SOURCE artifact producer/expiry differs')
    deployments=provider(p,'deployments');require(deployments and len({d['id'] for d in deployments})==len(deployments),'Missing actual deployment collection');latest=max(deployments,key=lambda d:d['id']);current={'deployment':latest,'statuses':provider(p,'statuses')};deployment(current,commit,run_id)
    final_artifact=next(a for a in artifacts if a['name']=='v57-final-public-proof');proof=e/'v57-final-public-proof';sealed=verified_zip(e/'v57-final-public-proof.zip',proof,final_artifact)
    prepared=load(proof/'preparation.json');final=load(proof/'final-publication.json');http=load(proof/'public-http.json');producer={'GITHUB_REPOSITORY':REPO,'GITHUB_SHA':commit,'GITHUB_RUN_ID':str(run_id),'GITHUB_RUN_ATTEMPT':'1'}
    require(prepared['publicationAccepted'] is False and prepared['producer']==producer and prepared['configSha256']==file_sha(controller/CONFIG),'Preparation has another publisher/config')
    baseline=load(controller/c['baselineCatalog']);old=baseline['siteFiles'];rows_valid(old);require(file_sha(controller/c['baselineCatalog'])==CATALOG_SHA and baseline['publicationAccepted'] is True and (len(old),sum(r['bytes'] for r in old),sha(encoded(old)))==OLD and not any(r['path'].startswith(PREFIX) for r in old),'Accepted2119-file baseline changed')
    candidate=prepared['candidateFiles'];rows_valid(candidate,100_000_000);require(candidate==sr['candidateFiles'] and len(candidate)==80 and sum(r['bytes'] for r in candidate)==sr['candidateBytes'] and sha(encoded(candidate))==sr['candidateInventorySha256'],'PUBLIC candidate differs from independently accepted SOURCE bytes')
    stamp=next(r for r in candidate if r['path']=='build-info.json')['sha256'];require(prepared['originalBuildInfoSha256']==stamp and prepared['baseline']==http_summary(old),'Build stamp or restored full baseline differs')
    sp=prepared['sourceProvider'];require(sp['run']==sourcerun and sorted(map(job_identity,sp['jobs']),key=lambda j:j['id'])==sorted(map(job_identity,sourcejobs),key=lambda j:j['id']) and sorted(map(compact_artifact,sp['artifacts']),key=lambda a:a['id'])==sorted(c['sourceArtifacts'],key=lambda a:a['id']),'Preparation source provider snapshot differs')
    archived=prepared['sourceArtifacts'];require(len(archived)==24 and len({r['provider']['id'] for r in archived})==24,'Preparation SOURCE archive closure incomplete')
    receipts={r['artifactId']:r for r in sr['sourceArtifacts']}
    for row in archived:
        pin=row['provider'];require(pin in c['sourceArtifacts'] and pin['id'] in receipts,'Unpinned prepared source archive');rows_valid(row['files'],2_000_000_000);r=receipts[pin['id']]
        require(row['inventorySha256']==sha(encoded(row['files']))==r['inventorySha256'] and len(row['files'])==r['files'] and sum(f['bytes'] for f in row['files'])==r['bytes'] and pin['size_in_bytes']==r['zipBytes'] and pin['digest']=='sha256:'+r['zipSha256'] and pin['name']==r['artifactName'],'Prepared archive differs from independently checked original ZIP')
        if pin['name']==c['distArtifact']:require(row['files']==candidate,'Prepared dist is not exact SOURCE candidate')
    deployment(prepared['deploymentBefore'],commit,run_id,True)
    provenance={'publicationAccepted':False,'sourceCommit':c['sourceCommit'],'sourceTree':c['sourceTree'],'sourceRun':c['sourceRun'],'sourceAttempt':1,'sourceAcceptance':c['sourceAcceptance'],'sourceArtifacts':c['sourceArtifacts'],'producer':producer,'originalBuildInfoSha256':stamp,'originalDistInventorySha256':sha(encoded(candidate))}
    pb=json.dumps(provenance,ensure_ascii=False,indent=2,allow_nan=False).encode()+b'\n';generated={'path':PREFIX+'publication-provenance.json','bytes':len(pb),'sha256':sha(pb)}
    union=sorted(old+[dict(r,path=PREFIX+r['path']) for r in candidate]+[generated],key=lambda r:r['path']);rows_valid(union);require(prepared['unionFiles']==union and len(union)==2200,'PUBLIC2200-file append changed the accepted baseline/candidate/provenance')
    require(http['pass'] is True and http['publicationAccepted'] is False and http['producer']==producer and http['union']==http_summary(union),'Full actual HTTP200 byte closure differs');require(deployment(http['deployment'],commit,run_id)==latest['id'],'HTTP deployment differs from current deployment')
    require(final['technicalChecksPassed'] is True and final['publicationAccepted'] is False and final['requiresIndependentRootAcceptance'] is True and final['producer']==producer and final['sourceCommit']==c['sourceCommit'] and final['sourceTree']==c['sourceTree'] and final['sourceReview']==c['sourceRun'] and final['sourceArtifacts']==c['sourceArtifacts'],'Producer final receipt identity differs')
    require(final['originalBuildInfoSha256']==stamp and final['originalDistInventorySha256']==sha(encoded(candidate)) and final['unionInventorySha256']==sha(encoded(union)) and final['publicRooms']==list(range(1,52)),'Producer final inventory/room union differs')
    require(sorted(map(job_identity,final['sourceJobs']),key=lambda j:j['id'])==sorted(map(job_identity,sourcejobs),key=lambda j:j['id']) and sorted(map(job_identity,final['publicJobs']),key=lambda j:j['id'])==sorted((job_identity(j) for j in jobs if j['name']!='verify'),key=lambda j:j['id']),'Final producer job snapshot differs from actual terminal provider')
    require(deployment(final['deployment'],commit,run_id)==latest['id'],'Final deployment differs from actual current deployment')
    decoded=check_entry(load(proof/'entry/report.json'),proof/'entry',c,producer,candidate,stamp);won=[]
    for group,levels in GROUPS.items():
        root=proof/('native-'+group);report=load(root/'report.json');binding=load(root/'public-binding.json')
        package=report['package'];require(set(package)=={'commit','version','editionVersion','sourceInputsSha256'} and package['commit']==c['sourceCommit'] and package['version']==VERSION and package['sourceInputsSha256']==sr['sourceInputsSha256'] and report['sourceCommit']==c['sourceCommit'] and report['pass'] is True and report['capturePass'] is True and report['strictCapture'] is True and report['mode']=='route' and report['errors']==[] and not report.get('active') and [r['level'] for r in report['rows']]==levels,'Wrong native PUBLIC package/group/pass')
        require(binding['pass'] is True and binding['publicationAccepted'] is False and binding['sourceCommit']==c['sourceCommit'] and binding['producer']==producer and binding['publicURL']==URL and binding['buildInfoSha256']==stamp and binding['freshPages']==len(levels),'Native PUBLIC fresh-page binding differs')
        require(binding['driver']=={'path':'scripts/qa-creative-browser.mjs','sha256':file_sha(source/'scripts/qa-creative-browser.mjs')},'Native driver bytes differ from immutable source')
        check_network(binding['network'],binding['browserStampReads'],candidate,stamp,len(levels));images=[]
        for row in report['rows']:
            route=row['route'];start=row['start'];capture=row['captures']['finish'];require(row['pass'] is True and row['gameplayPassed'] is True and row['capturePass'] is True and row['errors']==[] and start['missingModels']==[],'Failed native PUBLIC route/models')
            require(list(row['captures'])==['finish'] and type(route['frames']) in (int,float) and math.isfinite(route['frames']) and route['frames']>0 and route['pass'] is True and route['state']=='won' and route['sameCompanion'] is True and route['sameCargoShape'] is True and route['cargoUUID']==start['cargoUUID'] and route['cargoBodyId']==start['cargoBodyId'] and all(route.get(k) in (None,0) for k in ('resets','respawns','cargoResets')),'PUBLIC route changed original cargo or reset')
            require(capture['ok'] is True and capture['includesHTML'] is False and capture['renderer']['calls']>0 and capture['renderer']['triangles']>0 and capture['frame']['state']=='won' and capture['frame']['levelIndex']==row['level']-1 and capture['frame']['cargoUUID']==start['cargoUUID'] and capture['frame']['cargoBodyId']==start['cargoBodyId'],'PUBLIC finish frame is substituted or unbound')
            images.append(image(root/(str(row['level'])+'-finish.jpg')));won.append(row['level'])
        require(binding['decodedImages']==images,'Native PUBLIC actual pixels differ from sealed binding');decoded+=images
    require(sorted(won)==list(range(1,52)) and len(decoded)==54,'Incomplete PUBLIC51-route/54-frame union')
    with tempfile.TemporaryDirectory(prefix='v57-public-pure-') as temp:
        output=pathlib.Path(temp)/'pure.json';subprocess.run(['node','--input-type=module','-e',NODE_GATES,str(source),str(proof),c['sourceCommit'],sr['sourceInputsSha256'],str(output)],check=True,cwd=source,timeout=120);pure=load(output)
    require(verified_zip(e/'v57-final-public-proof.zip',proof,final_artifact)==sealed,'PUBLIC evidence changed during root audit')
    now=datetime.datetime.now(datetime.timezone.utc).isoformat();receipt={'schemaVersion':1,'kind':'independent-v57-root-public-acceptance','generatedAt':now,'sourceAccepted':True,'publicationAccepted':True,'sourceCommit':c['sourceCommit'],'sourceTree':c['sourceTree'],'sourceReview':{'runId':c['sourceRun'],'runAttempt':1},'publisherCommit':commit,'publicationRun':run_id,'publicationRunAttempt':1,'publicURL':URL,'sourceAcceptance':c['sourceAcceptance'],'configSha256':file_sha(controller/CONFIG),'finalProof':sealed,'deployment':{'id':latest['id'],'sha':latest['sha'],'state':'success'},'checks':{'terminalPublicJobs':11,'sourceJobs':22,'sourceArtifacts':24,'publisherArtifacts':12,'preservedBaselineFiles':2119,'preservedBaselineBytes':OLD[1],'preservedBaselineInventorySha256':OLD[2],'candidateFiles':len(candidate),'candidateBytes':sum(r['bytes'] for r in candidate),'publicFiles':len(union),'publicBytes':sum(r['bytes'] for r in union),'publicInventorySha256':sha(encoded(union)),'completeHTTP200ByteClosure':True,'nativeRoutes':{'rooms':51,'won':51,'sameOriginalCompanion':51,'resets':0,'respawns':0,'gameplayPassed':51,'capturesPassed':51},'decodedImages':54,'barePlayAndV56SaveImport':True,'ownNamespacePersistence':True,'immutableSourcePureValidators':pure},'providerFiles':[{'path':r.name,'bytes':r.stat().st_size,'sha256':file_sha(r)} for r in sorted(p.glob('*.json'))],'scope':'Independent terminal review of the exact accepted SOURCE and append-only PUBLIC candidate, actual11/11 successful publisher jobs, current deployment and authenticated complete HTTP byte closure.','limitations':[v for v in sr['limitations'] if 'publication acceptance' not in v.lower()]+['No live Yandex SDK, advertising delivery or platform moderation acceptance.','PUBLIC uses51 finish frames and3 entry screenshots; it does not add a continuous full-campaign movie or human/device/live-Yandex acceptance.']}
    catalog={'schemaVersion':1,'generatedAt':now,'sourceAccepted':True,'publicationAccepted':True,'sourceCommit':c['sourceCommit'],'sourceTree':c['sourceTree'],'publisherCommit':commit,'publicationRun':run_id,'publicationRunAttempt':1,'siteUrl':BASE,'publicURL':URL,'siteFiles':union,'siteBytes':sum(r['bytes'] for r in union),'siteFilesSha256':sha(encoded(union)),'preservedBaselineFiles':old,'candidateFiles':candidate,'generatedFiles':[generated],'rootAcceptance':{'path':args.output_root_acceptance.name,'sha256':sha(json.dumps(receipt,ensure_ascii=False,indent=2,allow_nan=False).encode()+b'\n')}}
    for path,value in [(args.output_root_acceptance,receipt),(args.output_catalog,catalog)]:
        path.parent.mkdir(parents=True,exist_ok=True);temporary=path.with_suffix('.tmp');temporary.write_bytes(json.dumps(value,ensure_ascii=False,indent=2,allow_nan=False).encode()+b'\n');os.replace(temporary,path)
    return receipt

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    for key in ('provider','evidence','output-root-acceptance','output-catalog'):parser.add_argument('--'+key,type=pathlib.Path,required=True)
    parser.add_argument('--controllercommit',required=True);parser.add_argument('--run',type=int,required=True)
    here=pathlib.Path(__file__).resolve().parent;parser.add_argument('--controller',type=pathlib.Path,default=here/'v57-release-controller');parser.add_argument('--source',type=pathlib.Path,default=here/'physical-upgrade');args=parser.parse_args()
    require(re.fullmatch('[a-f0-9]{40}',args.controllercommit) and args.run>0,'Exact controller commit/run are required');r=audit(args);print(json.dumps({'pass':True,'publicationAccepted':True,'checks':r['checks'],'receipt':str(args.output_root_acceptance),'catalog':str(args.output_catalog)},ensure_ascii=False))
if __name__=='__main__':main()
