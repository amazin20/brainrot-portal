"""Independent terminal PUBLIC acceptance; reads provider metadata and immutable proof.

Does not deploy, rebuild, capture browsers, or change the producer's deliberately
unaccepted receipt. Root acceptance requires all thirteen actual jobs to be done.
"""
import argparse, datetime, hashlib, json, math, os, pathlib, re, stat, subprocess, tempfile, zipfile
from PIL import Image, ImageStat

REPO='amazin20/brainrot-portal'
BASE='https://amazin20.github.io/brainrot-portal/'
PREFIX='campaign-v60/'
URL=BASE+PREFIX
WORKFLOW='.github/workflows/publish-campaign-v60.yml'
SOURCE_WORKFLOW='.github/workflows/first-chapter-review.yml'
SOURCE_BRANCH='upgrade/first-chapter-20261017'
CONFIG='tools/campaign-v60-release.json'
VERSION='v60-first-chapter'
OLD=(2362,669184499,'5a51e244761ba0947a1f4acfd99d98e04a29ea78d5e796cc4bf456e4c09381f8')
CATALOG_SHA='0bb2f2070aaea88e96e4f70da4b8c4634be9b4c8a2d8f425eac6ec04bba8c185'
OLD_DEPLOY={'id':7130303164,'sha':'29e252b92e848197c1051725e9838a4084f0aaf7'}
GROUPS={'early':list(range(1,11)),'energy':list(range(11,21)),'living':list(range(21,31)),'optics':list(range(31,41)),'fracture':list(range(42,52)),'castle':[41]}
ATTACK_GROUPS=('early','later')
ARTIFACT_JOBS={'github-pages':'prepare','v60-preparation':'prepare','v60-deployment-lease':'deploy','v60-public-http':'public-http','v60-public-entry':'entry','v60-final-public-proof':'verify',**{'v60-public-native-'+g:'native ('+g+')' for g in GROUPS},**{'v60-public-attacks-'+group:'attacks ('+group+')' for group in ATTACK_GROUPS}}
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
    rows.sort(key=lambda row:row['path'])
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
    expected={'prepare','deploy','public-http','entry','verify'}|{'native ('+g+')' for g in GROUPS}|{'attacks ('+group+')' for group in ATTACK_GROUPS}
    require(len(jobs)==len({j['id'] for j in jobs})==13 and {j['name'] for j in jobs}==expected,'Incomplete PUBLIC13-job cohort')
    for j in jobs:
        require(j['run_id']==run_id and j['run_attempt']==1 and j['head_sha']==commit and j['status']=='completed' and j['conclusion']=='success','Nonterminal/failed PUBLIC job')
        require(j['steps'] and all(s['status']=='completed' and s['conclusion'] in ('success','skipped') for s in j['steps']),'Failed/unfinished PUBLIC step')
    require(len(artifacts)==len({a['id'] for a in artifacts})==14 and {a['name'] for a in artifacts}==set(ARTIFACT_JOBS),'Incomplete PUBLIC14-artifact cohort')
    by_job={j['name']:j for j in jobs}
    for a in artifacts:
        require(a['expired'] is False and type(a['size_in_bytes']) is int and 0<a['size_in_bytes']<=2_000_000_000 and re.fullmatch('sha256:[a-f0-9]{64}',a['digest']),'Invalid/expired PUBLIC artifact')
        p=a['workflow_run'];require(p['id']==run_id and p['head_sha']==commit and p['head_branch']=='main' and p['repository_id']==p['head_repository_id']==1354625251,'Wrong PUBLIC artifact producer')
        action='Run actions/upload-pages-artifact@v3' if a['name']=='github-pages' else 'Run actions/upload-artifact@v4'
        uploads=[s for s in by_job[ARTIFACT_JOBS[a['name']]]['steps'] if s['name']==action and s['conclusion']=='success'];created=instant(a['created_at'])
        require(uploads and any(instant(s['started_at'])-datetime.timedelta(seconds=2)<=created<=instant(s['completed_at'])+datetime.timedelta(seconds=2) for s in uploads),'Artifact is not bound to a successful producer upload')
def check_job_logs(folder,jobs):
    root=folder/'logs';require(root.is_dir() and not root.is_symlink(),'Missing actual PUBLIC job logs')
    expected={str(j['id'])+'.log' for j in jobs};require({p.name for p in root.iterdir()}==expected,'PUBLIC raw job-log cohort differs')
    rows=[]
    for j in sorted(jobs,key=lambda v:v['id']):
        p=root/(str(j['id'])+'.log');require(p.is_file() and not p.is_symlink() and 0<p.stat().st_size<=25_000_000,'Invalid actual PUBLIC job log')
        data=p.read_bytes();text=data.decode('utf-8-sig');require(re.match(r'^\d{4}-\d{2}-\d{2}T',text) and 'Current runner version:' in text,'PUBLIC job log is not a complete raw runner log')
        rows.append({'id':j['id'],'name':j['name'],'bytes':len(data),'sha256':sha(data),'bomRetained':data.startswith(b'\xef\xbb\xbf')})
    return rows

def deployment(value,commit,run_id,baseline=False):
    d=value['deployment'];states=value['statuses'];require(states and states[0]['state']=='success','Pages deployment is not successful')
    if baseline:require(d['id']==OLD_DEPLOY['id'] and d['sha']==OLD_DEPLOY['sha'],'Historical deployment changed')
    else:
        run_url='https://github.com/'+REPO+'/actions/runs/'+str(run_id)
        require(d['sha']==commit and d['id']>OLD_DEPLOY['id'] and any(states[0].get(k,'').rstrip('/')==run_url or states[0].get(k,'').startswith(run_url+'/') for k in ('log_url','target_url')),'Pages deployment does not belong to the current PUBLIC run')
    require(d['environment']=='github-pages','Wrong deployment environment');return d['id']
def deployment_snapshot(folder, producer, c, verify_job, sealed_folder=None):
    """Authenticate exact CI API page bodies, without inventing an API collection."""
    folder = pathlib.Path(folder)
    actual = inventory(folder, 25_000_000)
    if sealed_folder is not None:
        require(actual == inventory(pathlib.Path(sealed_folder), 25_000_000), 'Copied CI deployment provider differs from sealed final proof')
    manifest = load(folder / 'manifest.json')
    require(manifest['schemaVersion'] == 1 and manifest['kind'] == 'actual-v60-ci-deployment-api-snapshot'
            and manifest['publicationAccepted'] is False and manifest['producer'] == producer,
            'Wrong actual CI deployment provider origin')
    require(manifest['sourceCommit'] == c['sourceCommit'] and manifest['sourceTree'] == c['sourceTree']
            and manifest['sourceReview'] == {'runId': c['sourceRun'], 'runAttempt': c['sourceAttempt']},
            'CI deployment provider belongs to another accepted Source')
    step_name = 'Validate actual prior producer statuses, all public routes and deployment ownership'
    steps = [v for v in verify_job['steps'] if v['name'] == step_name and v['status'] == 'completed' and v['conclusion'] == 'success']
    require(len(steps) == 1 and type(verify_job['id']) is int and verify_job['id'] > 0, 'Missing actual successful final provider-capture step')
    start, end = instant(manifest['captureStartedAt']), instant(manifest['captureCompletedAt'])
    require(start.tzinfo is not None and end.tzinfo is not None and instant(verify_job['started_at']) <= instant(steps[0]['started_at']) <= start <= end
            and instant(steps[0]['completed_at']) <= instant(verify_job['completed_at'])
            and end < instant(steps[0]['completed_at']) + datetime.timedelta(seconds=1)
            and end < instant(verify_job['completed_at']) + datetime.timedelta(seconds=1),
            'CI deployment API snapshot lies outside its actual successful final job')
    require(type(manifest['deploymentId']) is int and manifest['deploymentId'] > OLD_DEPLOY['id']
            and set(manifest['resources']) == {'deployments', 'statuses'}, 'Invalid CI deployment snapshot identity/resources')
    wanted = {'manifest.json'}; parsed = {}; records = []; previous = start
    for stem, endpoint in [('deployments', 'deployments?environment=github-pages'),
            ('statuses', 'deployments/' + str(manifest['deploymentId']) + '/statuses')]:
        resource = manifest['resources'][stem]; pages = resource['pages']; values = []
        require(resource['endpoint'] == endpoint and isinstance(pages, list) and 0 < len(pages) <= 100,
                'Wrong CI deployment API resource or incomplete pagination')
        for number, row in enumerate(pages, 1):
            relative = stem + '-page-' + str(number).zfill(3) + '.json'
            url = 'https://api.github.com/repos/' + REPO + '/' + endpoint + ('&' if '?' in endpoint else '?') + 'per_page=100&page=' + str(number)
            require(row['path'] == relative and row['page'] == number and row['requestURL'] == row['responseURL'] == url
                    and row['status'] == 200, 'CI deployment response is substituted or from another endpoint')
            requested, completed = instant(row['requestedAt']), instant(row['completedAt'])
            require(previous <= requested <= completed <= end, 'CI deployment API page clock differs')
            previous = completed; p = folder / relative
            require(p.is_file() and not p.is_symlink() and type(row['bytes']) is int and 0 < row['bytes'] <= 25_000_000
                    and p.stat().st_size == row['bytes'] and file_sha(p) == row['sha256'], 'CI deployment original raw response bytes differ')
            data = load(p)
            require(isinstance(data, list) and type(row['items']) is int and len(data) == row['items'] <= 100
                    and (len(data) == 100 if number < len(pages) else len(data) < 100),
                    'CI deployment API pagination is truncated or has a fabricated aggregate')
            require(all(isinstance(v, dict) and type(v.get('id')) is int and v['id'] > 0 for v in data),
                    'Invalid CI deployment/status API row identity')
            wanted.add(relative); values.extend(data)
            records.append({'path': relative, 'bytes': row['bytes'], 'sha256': row['sha256']})
        require(type(resource['items']) is int and resource['items'] == len(values)
                and len({v['id'] for v in values}) == len(values), 'CI deployment/status collection count or identity differs')
        parsed[stem] = values
    require({r['path'] for r in actual} == wanted, 'Extra or missing CI deployment raw response member')
    require(parsed['deployments'] and parsed['statuses'], 'Empty current deployment/status collection')
    latest = max(parsed['deployments'], key=lambda value: value['id'])
    require(latest['id'] == manifest['deploymentId'], 'CI snapshot selects a historical deployment')
    summary = {'origin': 'authenticated-final-ci-api-snapshot', 'independentPostCiDeploymentGet': False,
               'captureStartedAt': manifest['captureStartedAt'], 'captureCompletedAt': manifest['captureCompletedAt'],
               'verifyJobId': verify_job['id'], 'verifyStep': step_name, 'completedAtPrecisionSeconds': 1,
               'manifest': {'path': 'deployment-provider/manifest.json', 'bytes': (folder / 'manifest.json').stat().st_size,
                            'sha256': file_sha(folder / 'manifest.json')},
               'rawPages': records, 'deployments': len(parsed['deployments']), 'statuses': len(parsed['statuses']),
               'inventorySha256': sha(encoded(actual))}
    return {'deployment': latest, 'statuses': parsed['statuses']}, summary


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
    require(report['kind']=='actual-v60-public-bare-menu-save-isolation' and report['pass'] is True and report['publicationAccepted'] is False and report['producer']==producer and report['sourceCommit']==c['sourceCommit'] and report['publicURL']==URL and report['buildInfoSha256']==stamp and report['errors']==[] and not report.get('failure'),'PUBLIC entry failed or has another origin')
    require([v['state'] for v in report['checks']]==['ready','ready','playing','ready'],'Bare menu/Play/reload sequence missing')
    for i,v in enumerate(report['checks']):
        p=v['ownPreferences'];require(v['index']==3 and v['historicalUnchanged'] is True and p['completed']==[0,1,6,9,40] and p['hints']=={'1':2,'40':3} and p['resumeLevel']==3 and p['quality']=='low' and p['muted'] is True,'v59 whole-record save import or castle completion preservation changed')
        sequence=v['sequence'];require(sequence=={'stableIndices':list(range(40))+list(range(41,51))+[40],'numbers':list(range(1,52)),'castleLast':True},'PUBLIC castle is not the final displayed campaign room')
        require(p['volume']==(.29 if i==0 else .37) and p['tutorial'] is (i==0),'Own save preferences did not persist')
        require(isinstance(v['writes'],list) and (v['writes'] or i==3) and all(w['method'] in ('setItem','removeItem') and w['key'].startswith('brainrot-campaign-v60:') for w in v['writes']),'Missing own storage writes or historical namespace was written')
    names=['bare-menu.png','bare-playing.png','mobile-menu.png'];actual=[image(root/n) for n in names];require(report['captures']==actual,'Entry images differ from genuine decoded files')
    require(actual[0]['pixels']=={'width':1024,'height':768} and actual[2]['pixels']=={'width':360,'height':800},'Entry viewport pixels differ')
    require(len(report['network'])>10,'Insufficient entry response observations');check_network(report['network'],report['browserStampReads'],rows,stamp,1,True);return actual
def bind_controller(controller,tree,paths):
    require(tree['truncated'] is False and tree.get('sha') and len({r['path'] for r in tree['tree']})==len(tree['tree']),'Invalid/truncated controller API tree');by={r['path']:r for r in tree['tree']}
    for name in paths:
        p=controller/safe_name(name);require(p.is_file() and not p.is_symlink(),'Missing frozen controller member: '+name);b=p.read_bytes();g=hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
        require(by[name]['type']=='blob' and by[name]['sha']==g and by[name]['mode']=='100644','Local controller member differs from actual committed Git blob: '+name)

def check_attacks(root, source, c, producer, candidate, stamp, source_receipt, group, decode=None):
    """Authenticate a closed current ordinary-input browser attack packet."""
    root, source = pathlib.Path(root), pathlib.Path(source)
    report = load(root / 'first-chapter-attacks-browser-report.json')
    binding = load(root / 'public-binding.json')
    def record(relative):
        p = root / safe_name(relative)
        require(p.is_file() and not p.is_symlink(), 'Missing closed attack member')
        return {'path': relative, 'bytes': p.stat().st_size, 'sha256': file_sha(p)}
    require(group in ATTACK_GROUPS and report['schemaVersion'] == 1
            and report['kind'] == 'actual-first-chapter-ordinary-attacks-browser-diagnostic'
            and report['group'] == group and report['pass'] is True,
            'Wrong or failed current browser attack group')
    require(all(report[k] is False for k in ('sourceCiAccepted', 'nativeAccepted', 'publicationAccepted',
            'fullChapterAccepted', 'humanAccepted', 'allBypassesAccepted', 'humanPlaytest',
            'hardwareFPSMeasured', 'cameraAccepted', 'allRenderFramesMeasured'))
            and report['errors'] == [], 'Attack diagnostic widened its acceptance scope')
    s, origin, package = report['source'], report['controller'], report['package']
    require(s['commit'] == c['sourceCommit'] and s['tree'] == c['sourceTree']
            and s['sourceInputsSha256'] == source_receipt['sourceInputsSha256']
            and all(report[k] is True for k in ('sourceWorkingBytesUnchanged',
            'controllerWorkingBytesUnchanged', 'harnessWorkingBytesUnchanged', 'completeServedPackageVerified')),
            'Attack current frozen Source bytes differ')
    actual_run = {'runId': int(producer['GITHUB_RUN_ID']), 'runAttempt': int(producer['GITHUB_RUN_ATTEMPT'])}
    require(report['sourceReview'] == {'runId': c['sourceRun'], 'runAttempt': c['sourceAttempt']}
            and report['captureRun'] == actual_run and report['providerRun'] == dict(actual_run, commit=producer['GITHUB_SHA'])
            and report['captureOrigin'] == 'https://amazin20.github.io'
            and report['capturePath'] == '/brainrot-portal/campaign-v60/', 'Attack Source review or actual Public capture origin differs')
    require(origin['commit'] == c['sourceCommit'] and origin['tree'] == c['sourceTree']
            and origin['trackedWorkingTreeClean'] is True and origin['runId'] == actual_run['runId']
            and origin['runAttempt'] == actual_run['runAttempt'], 'Attack immutable Source controller differs')
    harness = origin['files']; paths = [r['path'] for r in harness]
    require(paths == sorted(set(paths)) and sha(encoded(harness)) == origin['filesSha256'],
            'Attack controller harness inventory differs')
    frozen = load(root / 'binding.json')
    require(frozen['source'] == s and frozen['controller'] == origin and frozen['package'] == package,
            'Attack initial frozen Source binding differs')
    source_harness = frozen['sourceHarness']
    require(sha(encoded(source_harness['files'])) == source_harness['filesSha256'], 'Attack Source harness digest differs')
    for row in harness + source_harness['files']:
        p = source / safe_name(row['path'])
        require(p.is_file() and not p.is_symlink() and p.stat().st_size == row['bytes']
                and file_sha(p) == row['sha256'], 'Attack frozen harness differs from current Source')
    payload = [r for r in candidate if r['path'] not in ('build-info.json', 'release-manifest.json')]
    stamp_row = next(r for r in candidate if r['path'] == 'build-info.json')
    require(package['commit'] == c['sourceCommit'] and package['buildInfoSha256'] == stamp == stamp_row['sha256']
            and package['buildInfoBytes'] == stamp_row['bytes'] and package['files'] == payload
            and package['packageFilesSha256'] == sha(encoded(payload))
            and package['fileCount'] == len(payload) and package['totalBytes'] == sum(r['bytes'] for r in payload),
            'Attack served package is not the accepted exact dist')
    journeys = [r for r in payload if re.fullmatch(r'assets/LabV8Journey-[A-Za-z0-9_-]+\.js', r['path'])]
    require(len(journeys) == 1 and package['journey'] == journeys[0] and package['originalRuntimeModels'] == 14, 'Attack compiled ordinary journey or original runtime models differ')
    served = load(root / 'served-package.json')
    require(served['sourceCommit'] == c['sourceCommit'] and served['sourceTree'] == c['sourceTree']
            and served['captureOrigin'] == report['captureOrigin'] and served['capturePath'] == report['capturePath']
            and served['allHTTPFilesVerified'] is True
            and served['files'] == [dict(r, status=200) for r in payload] + [dict(stamp_row, status=200)],
            'Attack complete actual HTTP package proof differs')
    pure_name = group + '-attacks-report.json'
    cases = report['caseObservations']; count = len(cases)
    require(count > 0 and report['pureReport'] == {'filename': pure_name, 'cases': count, 'pass': True},
            'Attack ordinary-input case cohort incomplete')
    require(binding['kind'] == 'actual-v60-public-attacks-binding' and binding['pass'] is True
            and binding['publicationAccepted'] is False and binding['group'] == group
            and binding['sourceCommit'] == c['sourceCommit'] and binding['sourceTree'] == c['sourceTree']
            and binding['producer'] == producer and binding['publicURL'] == URL
            and binding['buildInfoSha256'] == stamp and binding['freshPages'] == count,
            'Attack fresh actual Public producer differs')
    driver_name = 'scripts/qa-first-chapter-attacks-browser.mjs'
    require(binding['driver'] == {'path': driver_name, 'sha256': file_sha(source / driver_name)},
            'Attack driver bytes differ from immutable Source')
    for key, relative in [('sourceReport', 'first-chapter-attacks-browser-report.json'),
            ('pureReport', pure_name), ('closedMediaInventory', 'closed-media-member-inventory.json')]:
        require(binding[key] == record(relative), 'Attack retained proof raw bytes differ')
    wanted = {'binding.json', 'served-package.json', 'native-browser.json', 'attack-harness.js', 'attack-harness-inputs.json', pure_name, 'first-chapter-attacks-browser-report.json', 'closed-media-member-inventory.json', 'public-binding.json'}
    for i in range(1, count + 1):
        wanted.update({'case-' + str(i).zfill(2) + suffix for suffix in ('-observation.json', '-start.jpg', '-end.jpg')})
    require({r['path'] for r in inventory(root)} == wanted, 'Unexpected or missing closed attack artifact member')
    require(load(root / 'native-browser.json') == report['browser'] and re.fullmatch(r'(?:HeadlessChrome|Chrome)/\d+(?:\.\d+){3}', report['browser']['product']) and re.search(r'\b(?:HeadlessChrome|Chrome)/\d+', report['browser']['userAgent']), 'Attack actual browser witness differs')
    closed = load(root / 'closed-media-member-inventory.json')
    closed_rows = [dict(name=r['path'], bytes=r['bytes'], sha256=r['sha256'])
            for r in inventory(root) if r['path'] not in ('closed-media-member-inventory.json', 'public-binding.json')]
    require(closed['files'] == closed_rows, 'Attack closed artifact membership or bytes differ')
    descriptor = load(root / 'attack-harness-inputs.json')
    require(descriptor == report['harness'] and record('attack-harness.js')['bytes'] == descriptor['bytes']
            and record('attack-harness.js')['sha256'] == descriptor['sha256'], 'Attack compiled observer bundle differs')
    check_network(binding['network'], binding['browserStampReads'], candidate, stamp, count)
    image_names = sorted(r['filename'] for r in report['closedMedia'])
    require(len(image_names) == len(set(image_names)) == count * 2
            and image_names == sorted(p.relative_to(root).as_posix() for p in root.rglob('*.jpg')),
            'Attack genuine start/end canvas cohort differs')
    require([r['path'] for r in binding['decodedImages']] == image_names, 'Attack decoded canvas membership differs')
    images = []
    for relative in image_names:
        observed = next(r for r in binding['decodedImages'] if r['path'] == relative)
        actual = decode(root / relative) if decode else observed
        actual['path'] = relative
        require({k: actual[k] for k in ('path', 'bytes', 'sha256')} == record(relative)
                and actual['pixels'] == {'width': 640, 'height': 360}, 'Attack genuine decoded canvas bytes differ')
        images.append(actual)
    require(binding['decodedImages'] == images, 'Attack actual pixels differ from observed binding')
    for i, case in enumerate(cases):
        require(load(root / ('case-' + str(i + 1).zfill(2) + '-observation.json')) == case,
                'Attack individual case proof differs from complete report')
    return {'group': group, 'report': record('first-chapter-attacks-browser-report.json'),
            'binding': record('public-binding.json'), 'cases': count, 'retainedImages': len(images)}, images


NODE_GATES=r'''
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import{pathToFileURL}from'node:url';import{createHash}from'node:crypto';
const[source,proof,commit,sourceInputs,output,producerJSON]=process.argv.slice(1),read=p=>JSON.parse(fs.readFileSync(p));
const{assertCampaignBrowserState}=await import(pathToFileURL(path.join(source,'scripts/lib/campaign-browser-contract.mjs')));
const{EDITION_VERSION}=await import(pathToFileURL(path.join(source,'src/game/ReleaseIdentity.js')));
const{FOUNDATION_SEQUENCE,foundationDisplayNumber,nextFoundationIndex}=await import(pathToFileURL(path.join(source,'src/game/LabCampaignSequence.js')));
assert.deepEqual(FOUNDATION_SEQUENCE,[...Array.from({length:40},(_,i)=>i),...Array.from({length:10},(_,i)=>i+41),40]);
assert.equal(foundationDisplayNumber(40),51);assert.equal(nextFoundationIndex(50),40);assert.equal(nextFoundationIndex(40),null);
const{assertFoundation20Route}=await import(pathToFileURL(path.join(source,'scripts/lib/foundation20-native-proof.mjs')));
const{CASTLE_NATIVE_ORDER,assertCastleImpulsePhysicalProof}=await import(pathToFileURL(path.join(source,'scripts/lib/castle-impulse-native-proof.mjs')));
const{assertPendulumPhysicalProof}=await import(pathToFileURL(path.join(source,'scripts/lib/tower41-pendulum-proof.mjs')));
const{FIRST_CHAPTER_ATTACK_HARNESS_FILES,assertFirstChapterAttacksBrowserDiagnostic}=await import(pathToFileURL(path.join(source,'scripts/lib/first-chapter-attack-browser.mjs')));
const{compileFirstChapterAttackHarness}=await import(pathToFileURL(path.join(source,'scripts/qa-first-chapter-attacks-browser.mjs')));
const{freezeFirstChapterInputs}=await import(pathToFileURL(path.join(source,'scripts/qa-first-chapter-native.mjs')));
let rooms=0;const upper=[],impulses=[];for(const group of ['early','energy','living','optics','fracture','castle']){
 const dir=path.join(proof,'native-'+group),r=read(path.join(dir,'report.json')),binding=read(path.join(dir,'public-binding.json'));assert.deepEqual(r.package,{commit,version:'v60-first-chapter',editionVersion:EDITION_VERSION,sourceInputsSha256:sourceInputs});
 for(const row of r.rows){assertCampaignBrowserState(row.start,row.level);if(row.level===20)assertFoundation20Route(row.route.foundation20Proof);if(row.level===41){const marks=row.route.milestones,p=marks.find(m=>m.name==='Solved pendulum')?.physicsProof;const checked={level:41,...assertPendulumPhysicalProof(p,row.start.cargoBodyId)};assert.deepEqual(binding.novelProofs,[checked]);upper.push(checked);
  assert.deepEqual(marks.filter(m=>m.name.startsWith('Start ')).map(m=>m.name.slice(6)),CASTLE_NATIVE_ORDER);
  assert.deepEqual(marks.filter(m=>m.name.startsWith('Solved ')).map(m=>m.name.slice(7)),CASTLE_NATIVE_ORDER);assert.equal(CASTLE_NATIVE_ORDER.length,12);
  const impulse=marks.find(m=>m.name==='Solved impulse')?.physicsProof;assertCastleImpulsePhysicalProof(impulse,row.start.cargoBodyId);
  const summary={level:41,pass:true,originalCargoBodyId:row.start.cargoBodyId,originalCargoShapeId:impulse.impulseCell.originalCargoShapeId,worldStep:impulse.impulseCell.worldStep};
  assert.deepEqual(binding.impulsePhysicalProofs,[summary]);impulses.push(summary);
 }rooms++;}
 if(group!=='castle'){assert.deepEqual(binding.novelProofs,[]);assert.deepEqual(binding.impulsePhysicalProofs,[]);}
}
assert.equal(rooms,51);
const producer=JSON.parse(producerJSON),digest=b=>createHash('sha256').update(b).digest('hex'),fileRow=name=>{const b=fs.readFileSync(path.join(source,name));return{path:name,bytes:b.length,sha256:digest(b)};};
Object.assign(process.env,{BUILD_COMMIT:commit,GITHUB_RUN_ID:producer.GITHUB_RUN_ID,GITHUB_RUN_ATTEMPT:producer.GITHUB_RUN_ATTEMPT});
const core=freezeFirstChapterInputs(source,source);assert.equal(core.source.sourceInputsSha256,sourceInputs);
const files=[...new Set([...core.controller.files.map(r=>r.path),...FIRST_CHAPTER_ATTACK_HARNESS_FILES])].sort().map(fileRow),controller={...core.controller,files,filesSha256:digest(JSON.stringify(files))};
const sourceFiles=FIRST_CHAPTER_ATTACK_HARNESS_FILES.map(fileRow),sourceHarness={files:sourceFiles,filesSha256:digest(JSON.stringify(sourceFiles))},base=new URL('https://amazin20.github.io/brainrot-portal/campaign-v60/'),attackProofs=[];
for(const group of ['early','later']){
 const dir=path.join(proof,'attacks-'+group),report=read(path.join(dir,'first-chapter-attacks-browser-report.json')),binding=read(path.join(dir,'binding.json')),pureReport=read(path.join(dir,group+'-attacks-report.json')),closedInventory=read(path.join(dir,'closed-media-member-inventory.json'));
 assert.deepEqual(binding.source,core.source);assert.deepEqual(binding.sourceInputs,core.sourceInputs);assert.deepEqual(binding.controller,controller);assert.deepEqual(binding.sourceHarness,sourceHarness);
 const compiled=await compileFirstChapterAttackHarness({sourceRoot:source,base,journey:report.package.journey}),url=new URL('/__v60-attack-harness__/'+compiled.descriptor.sha256+'.js',base.origin).href;
 assert.deepEqual(fs.readFileSync(path.join(dir,'attack-harness.js')),compiled.bytes);assert.deepEqual(report.harness,{...compiled.descriptor,sourceHead:commit,url,onlyInterceptedRequest:url});
 for(const row of report.caseObservations){assert.deepEqual(row.errors,[]);assert.deepEqual(row.harnessRequests,[{url,bytes:compiled.bytes.length,sha256:compiled.descriptor.sha256}]);}
 assert.deepEqual(report.providerRun,{commit:producer.GITHUB_SHA,runId:Number(producer.GITHUB_RUN_ID),runAttempt:Number(producer.GITHUB_RUN_ATTEMPT)});
 const checked=assertFirstChapterAttacksBrowserDiagnostic(report,{group,source:core.source,controller,package:binding.package,captureOrigin:base.origin,pureReport,closedInventory});
 attackProofs.push({group,pass:true,immutablePureValidator:true,cases:checked.cases,originalCargo:true,closedInventory:true});
}
fs.writeFileSync(output,JSON.stringify({pass:true,rooms,upperPhysicalProofs:upper,impulsePhysicalProofs:impulses,castleFinal:true,attackProofs}));
'''

def check_attack_completion_log(text, group, source_commit, summary):
    markers = re.findall(r'FIRST_CHAPTER_ATTACKS_DIAGNOSTIC_COMPLETE (early|later) ([a-f0-9]{40}) (\d+) ([a-f0-9]{64})', text)
    require(markers == [(group, source_commit, str(summary['cases']), summary['report']['sha256'])],
            'Actual Public attack completion/hash is absent from its original producer log')


def source_chapter_checks(receipt):
    """Require Root's current ten complete films and both immutable attack groups."""
    movies = receipt['checks']['firstChapterContinuousNative']
    require(movies['rooms'] == 10 and movies['fullyDecoded'] is True and movies['fps'] == 12,
          'Source first chapter recordings are incomplete')
    rows = movies['rows']
    require(isinstance(rows, list) and all(type(r['level']) is int for r in rows) and [r['level'] for r in rows] == list(range(1, 11)),
          'Source first chapter movie cohort differs')
    for row in rows:
        require(type(row['frames']) is int and row['frames'] > 1 and row['fullyDecoded'] is True
              and row['sameOriginalShape'] is True and row['completeRoute'] is True,
              'Source complete native route or original cargo is unproved')
        require(type(row['movieBytes']) is int and 0 < row['movieBytes'] <= 40_000_000,
              'Source first chapter movie exceeds its exact bound')
        require(re.fullmatch('[a-f0-9]{64}', row['movieSha256']) and re.fullmatch('[a-f0-9]{64}', row['telemetrySha256']), 'Invalid Source native media hash')
        require(type(row['durationSeconds']) in (int, float) and type(row['simulationSeconds']) in (int, float)
              and row['durationSeconds'] == row['frames'] / 12 and row['simulationSeconds'] > 0
              and abs(row['durationSeconds'] - row['simulationSeconds']) <= 1 / 6,
              'Source first chapter movie cadence differs from actual simulation')
    attacks = receipt['checks']['firstChapterAttacks']
    require(attacks['groups'] == 2 and attacks['rooms'] == 10 and isinstance(attacks['groupResults'], list)
          and sorted(r['group'] for r in attacks['groupResults']) == ['early', 'later'],
          'Source first chapter attack cohort differs')
    for row in attacks['groupResults']:
        require(row['pass'] is True and row['immutablePureValidator'] is True
              and type(row['cases']) is int and row['cases'] > 0
              and row['originalCargo'] is True and row['closedInventory'] is True,
              'Source first chapter ordinary-input attacks are not independently proved')


def audit(args):
    controller=args.controller.resolve();source=args.source.resolve();p=args.provider.resolve();e=args.evidence.resolve();commit=args.controllercommit;run_id=args.run
    c=load(controller/CONFIG);require(c['schemaVersion']==1 and c['frozen'] is True and c['publicationAccepted'] is False and c['repository']==REPO and c['namespace']==PREFIX and c['version']==VERSION and c['sourceBranch']==SOURCE_BRANCH and c['sourceWorkflow']==SOURCE_WORKFLOW,'Controller release is not frozen v60')
    require(c['sourceAttempt']==1 and type(c['sourceRun']) is int and c['sourceRun']>0 and c['baselineCatalog']=='tools/campaign-v59-public-files.json' and c['baselineCatalogSha256']==CATALOG_SHA and c['baselineInventorySha256']==OLD[2] and c['baselineDeployment']==OLD_DEPLOY,'Frozen source/baseline pins differ')
    run=provider(p,'run');jobs=provider(p,'jobs','jobs');artifacts=provider(p,'artifacts','artifacts');validate_provider(run,jobs,artifacts,commit,run_id);raw_logs=check_job_logs(p,jobs)
    cm=provider(p,'controller-commit');ct=provider(p,'controller-tree');require(cm['sha']==commit and cm['tree']['sha']==ct['sha'] and [r['sha'] for r in cm['parents']]==[c['controllerParent']],'Actual controller commit/tree/parent differ')
    bind_controller(controller,ct,[WORKFLOW,'docs/campaign-v60-public-protocol.md','scripts/publish-campaign-v60.py','scripts/observe-campaign-v60-public.mjs','scripts/test_campaign_v60.py','tools/audit-public-v60.py','tools/test-audit-public-v60.py','tools/audit-source-v60.py','tools/test-audit-source-v60.py',CONFIG,c['sourceAcceptance']['path'],c['baselineCatalog']])
    require(file_sha(pathlib.Path(__file__).resolve())==file_sha(controller/'tools/audit-public-v60.py'),'Invoked Public Root auditor differs from the frozen committed auditor')
    require(provider(p,'main')['object']['sha']==commit and provider(p,'source')['object']['sha']==c['sourceCommit'],'Current main/source lease moved')
    sm=provider(p,'source-commit');require(sm['sha']==c['sourceCommit'] and sm['tree']['sha']==c['sourceTree'],'Actual source tree moved')
    require(subprocess.check_output(['git','-C',str(source),'rev-parse','HEAD']).decode().strip()==c['sourceCommit'] and subprocess.check_output(['git','-C',str(source),'rev-parse','HEAD^{tree}']).decode().strip()==c['sourceTree'],'Local immutable source differs')
    require(not subprocess.check_output(['git','-C',str(source),'status','--porcelain','--untracked-files=no']).strip(),'Local immutable source has tracked edits')
    root_path=controller/safe_name(c['sourceAcceptance']['path']);require(file_sha(root_path)==c['sourceAcceptance']['sha256'],'Independent source receipt raw SHA differs');sr=load(root_path)
    require(sr['sourceAccepted'] is True and sr['publicationAccepted'] is False and sr['sourceCommit']==c['sourceCommit'] and sr['sourceTree']==c['sourceTree'] and sr['run']==c['sourceRun'] and sr['runAttempt']==1,'Independent source receipt identity differs')
    require([v['sha'] for v in sm['parents']]==[sr['sourceParent']],'Actual source parent differs from accepted SOURCE receipt')
    for k in ('ordinaryRoutes','nativeRoutes'):require(all(sr['checks'][k][n]==51 for n in ('rooms','won','sameOriginalCompanion')) and sr['checks'][k]['resets']==sr['checks'][k]['respawns']==0,'Source original-companion acceptance incomplete')
    require(sr['checks']['nativeRoutes']['gameplayPassed']==sr['checks']['nativeRoutes']['capturesPassed']==51 and sr['checks']['cpu']['tests']==sr['checks']['cpu']['passed']>0 and sr['checks']['cpu']['failed']==0,'Source CPU/native acceptance incomplete')
    source_chapter_checks(sr)
    ip=sr['checks']['currentImmutablePureValidators'];require(ip['pass'] is ip['firstChapterNativePureValidator'] is ip['firstChapterAttacksPureValidator'] is True and ip['castleImpulseNativePureValidator'] is True and len(ip['impulsePhysicalProofs'])==2 and {v['kind'] for v in ip['impulsePhysicalProofs']}=={'ordinary','native'} and all(v['pass'] is True for v in ip['impulsePhysicalProofs']),'Source physical impulse completion acceptance missing')
    sourcerun=provider(p,'source-run');sourcejobs=provider(p,'source-jobs','jobs');sourceartifacts=provider(p,'source-artifacts','artifacts')
    require(sourcerun['id']==c['sourceRun'] and sourcerun['run_attempt']==1 and sourcerun['head_sha']==c['sourceCommit'] and sourcerun['head_branch']==SOURCE_BRANCH and sourcerun['path']==SOURCE_WORKFLOW and sourcerun['event']=='push' and sourcerun['repository']['full_name']==REPO and sourcerun['status']=='completed' and sourcerun['conclusion']=='success','SOURCE producer is not exact completed success')
    require(len(sourcejobs)==len({j['id'] for j in sourcejobs})==len(c['expectedJobs'])==32 and sorted(j['name'] for j in sourcejobs)==sorted(c['expectedJobs']),'SOURCE32-job cohort differs')
    for j in sourcejobs:require(j['run_id']==c['sourceRun'] and j['run_attempt']==1 and j['head_sha']==c['sourceCommit'] and j['status']=='completed' and j['conclusion']=='success' and all(s['status']=='completed' and s['conclusion'] in ('success','skipped') for s in j['steps']),'SOURCE job is not terminal success')
    require(len(sourceartifacts)==len({a['id'] for a in sourceartifacts})==len(c['sourceArtifacts'])==34 and sorted(map(compact_artifact,sourceartifacts),key=lambda a:a['id'])==sorted(c['sourceArtifacts'],key=lambda a:a['id']),'SOURCE34-artifact pins differ')
    for a in sourceartifacts:require(a['expired'] is False and a['workflow_run']['id']==c['sourceRun'] and a['workflow_run']['head_sha']==c['sourceCommit'] and a['workflow_run']['head_branch']==SOURCE_BRANCH,'SOURCE artifact producer/expiry differs')
    final_artifact=next(a for a in artifacts if a['name']=='v60-final-public-proof');proof=e/'v60-final-public-proof';sealed=verified_zip(e/'v60-final-public-proof.zip',proof,final_artifact)
    prepared=load(proof/'preparation.json');final=load(proof/'final-publication.json');http=load(proof/'public-http.json');producer={'GITHUB_REPOSITORY':REPO,'GITHUB_SHA':commit,'GITHUB_RUN_ID':str(run_id),'GITHUB_RUN_ATTEMPT':'1'}
    current,deployment_origin=deployment_snapshot(p/'deployment-provider',producer,c,next(j for j in jobs if j['name']=='verify'),proof/'deployment-provider');latest=current['deployment'];deployment(current,commit,run_id)
    require(final['deployment']==current,'Final deployment lease differs from retained canonical CI API response pages')
    require(prepared['publicationAccepted'] is False and prepared['producer']==producer and prepared['configSha256']==file_sha(controller/CONFIG),'Preparation has another publisher/config')
    baseline=load(controller/c['baselineCatalog']);old=baseline['siteFiles'];rows_valid(old);require(file_sha(controller/c['baselineCatalog'])==CATALOG_SHA and baseline['publicationAccepted'] is True and (len(old),sum(r['bytes'] for r in old),sha(encoded(old)))==OLD and not any(r['path'].startswith(PREFIX) for r in old),'Accepted2362-file baseline changed')
    candidate=prepared['candidateFiles'];rows_valid(candidate,100_000_000);require(candidate==sr['candidateFiles'] and sum(r['bytes'] for r in candidate)==sr['candidateBytes'] and sha(encoded(candidate))==sr['candidateInventorySha256'],'PUBLIC candidate differs from independently accepted SOURCE bytes')
    stamp=next(r for r in candidate if r['path']=='build-info.json')['sha256'];require(prepared['originalBuildInfoSha256']==stamp and prepared['baseline']==http_summary(old),'Build stamp or restored full baseline differs')
    sp=prepared['sourceProvider'];require(sp['run']==sourcerun and sorted(map(job_identity,sp['jobs']),key=lambda j:j['id'])==sorted(map(job_identity,sourcejobs),key=lambda j:j['id']) and sorted(map(compact_artifact,sp['artifacts']),key=lambda a:a['id'])==sorted(c['sourceArtifacts'],key=lambda a:a['id']),'Preparation source provider snapshot differs')
    archived=prepared['sourceArtifacts'];require(len(archived)==34 and len({r['provider']['id'] for r in archived})==34,'Preparation SOURCE archive closure incomplete')
    receipts={r['artifactId']:r for r in sr['sourceArtifacts']}
    for row in archived:
        pin=row['provider'];require(pin in c['sourceArtifacts'] and pin['id'] in receipts,'Unpinned prepared source archive');rows_valid(row['files'],2_000_000_000);r=receipts[pin['id']]
        require(row['inventorySha256']==sha(encoded(row['files']))==r['inventorySha256'] and len(row['files'])==r['files'] and sum(f['bytes'] for f in row['files'])==r['bytes'] and pin['size_in_bytes']==r['zipBytes'] and pin['digest']=='sha256:'+r['zipSha256'] and pin['name']==r['artifactName'],'Prepared archive differs from independently checked original ZIP')
        if pin['name']==c['distArtifact']:require(row['files']==candidate,'Prepared dist is not exact SOURCE candidate')
    deployment(prepared['deploymentBefore'],commit,run_id,True)
    provenance={'publicationAccepted':False,'sourceCommit':c['sourceCommit'],'sourceTree':c['sourceTree'],'sourceRun':c['sourceRun'],'sourceAttempt':1,'sourceAcceptance':c['sourceAcceptance'],'sourceArtifacts':c['sourceArtifacts'],'producer':producer,'originalBuildInfoSha256':stamp,'originalDistInventorySha256':sha(encoded(candidate))}
    pb=json.dumps(provenance,ensure_ascii=False,indent=2,allow_nan=False).encode()+b'\n';generated={'path':PREFIX+'publication-provenance.json','bytes':len(pb),'sha256':sha(pb)}
    union=sorted(old+[dict(r,path=PREFIX+r['path']) for r in candidate]+[generated],key=lambda r:r['path']);rows_valid(union);require(prepared['unionFiles']==union and len(union)==len(old)+len(candidate)+1,'PUBLIC append-only append changed the accepted baseline/candidate/provenance')
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
    attacks=[]
    for group in ATTACK_GROUPS:
        summary,images=check_attacks(proof/('attacks-'+group),source,c,producer,candidate,stamp,sr,group,decode=image)
        job=next(j for j in jobs if j['name']=='attacks ('+group+')')
        check_attack_completion_log((p/'logs'/(str(job['id'])+'.log')).read_text(encoding='utf-8-sig'),group,c['sourceCommit'],summary)
        attacks.append(summary);decoded+=images
    require(final['attackGroups']==list(ATTACK_GROUPS) and final['attackProofs']==attacks,'Final current attack case/report/media binding differs')
    with tempfile.TemporaryDirectory(prefix='v60-public-pure-') as temp:
        output=pathlib.Path(temp)/'pure.json'
        subprocess.run(['node','--input-type=module','-e',NODE_GATES,str(source),str(proof),c['sourceCommit'],sr['sourceInputsSha256'],str(output),encoded(producer).decode()],check=True,cwd=source,timeout=180);pure=load(output)
    require([(r['group'],r['cases']) for r in pure['attackProofs']]==[(r['group'],r['cases']) for r in attacks], 'Current immutable attack counts differ')
    require(verified_zip(e/'v60-final-public-proof.zip',proof,final_artifact)==sealed,'PUBLIC evidence changed during root audit')
    now=datetime.datetime.now(datetime.timezone.utc).isoformat();receipt={'schemaVersion':1,'kind':'independent-v60-root-public-acceptance','generatedAt':now,'sourceAccepted':True,'publicationAccepted':True,'sourceCommit':c['sourceCommit'],'sourceTree':c['sourceTree'],'sourceReview':{'runId':c['sourceRun'],'runAttempt':1},'publisherCommit':commit,'publicationRun':run_id,'publicationRunAttempt':1,'publicURL':URL,'sourceAcceptance':c['sourceAcceptance'],'configSha256':file_sha(controller/CONFIG),'finalProof':sealed,'deployment':{'id':latest['id'],'sha':latest['sha'],'state':'success'},'checks':{'terminalPublicJobs':13,'sourceJobs':32,'sourceArtifacts':34,'publisherArtifacts':14,'preservedBaselineFiles':2362,'preservedBaselineBytes':OLD[1],'preservedBaselineInventorySha256':OLD[2],'candidateFiles':len(candidate),'candidateBytes':sum(r['bytes'] for r in candidate),'publicFiles':len(union),'publicBytes':sum(r['bytes'] for r in union),'publicInventorySha256':sha(encoded(union)),'completeHTTP200ByteClosure':True,'deploymentProvider':deployment_origin,'nativeRoutes':{'rooms':51,'won':51,'sameOriginalCompanion':51,'resets':0,'respawns':0,'gameplayPassed':51,'capturesPassed':51},'decodedImages':len(decoded),'firstChapterAttacks':{'groups':2,'rooms':10,'groupResults':[dict(r,**p) for r,p in zip(attacks,pure['attackProofs'])]},'barePlayAndV59SaveImport':True,'previousCastleCompletionPreserved':True,'castleFinal':True,'ownNamespacePersistence':True,'immutableSourcePureValidators':pure},'rawJobLogs':raw_logs,'providerFiles':[{'path':r.name,'bytes':r.stat().st_size,'sha256':file_sha(r)} for r in sorted(p.glob('*.json'))],'scope':'Independent terminal review of the exact accepted SOURCE and append-only PUBLIC candidate, actual13/13 successful publisher jobs, fresh independent main/Source refs, final-CI canonical deployment API snapshot and authenticated complete HTTP byte closure.','limitations':[v for v in sr['limitations'] if 'publication acceptance' not in v.lower()]+['Deployment/status API pages are authenticated observations from the successful final CI job; no independent post-CI deployment GET is claimed. Fresh independent connector main and Source refs remain required.','No live Yandex SDK, advertising delivery or platform moderation acceptance.','PUBLIC uses51 finish frames,3 entry screenshots and two current finite first-chapter attack packets with decoded start/end media; current full12fps first10 films are independently bound through the accepted SOURCE package. Human/device/live-Yandex acceptance remains open.']}
    catalog={'schemaVersion':1,'generatedAt':now,'sourceAccepted':True,'publicationAccepted':True,'sourceCommit':c['sourceCommit'],'sourceTree':c['sourceTree'],'publisherCommit':commit,'publicationRun':run_id,'publicationRunAttempt':1,'siteUrl':BASE,'publicURL':URL,'siteFiles':union,'siteBytes':sum(r['bytes'] for r in union),'siteFilesSha256':sha(encoded(union)),'preservedBaselineFiles':old,'candidateFiles':candidate,'generatedFiles':[generated],'rootAcceptance':{'path':args.output_root_acceptance.name,'sha256':sha(json.dumps(receipt,ensure_ascii=False,indent=2,allow_nan=False).encode()+b'\n')}}
    for path,value in [(args.output_root_acceptance,receipt),(args.output_catalog,catalog)]:
        path.parent.mkdir(parents=True,exist_ok=True);temporary=path.with_suffix('.tmp');temporary.write_bytes(json.dumps(value,ensure_ascii=False,indent=2,allow_nan=False).encode()+b'\n');os.replace(temporary,path)
    return receipt

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    for key in ('provider','evidence','output-root-acceptance','output-catalog'):parser.add_argument('--'+key,type=pathlib.Path,required=True)
    parser.add_argument('--controllercommit',required=True);parser.add_argument('--run',type=int,required=True)
    here=pathlib.Path(__file__).resolve().parent;parser.add_argument('--controller',type=pathlib.Path,default=here/'v60-release-controller');parser.add_argument('--source',type=pathlib.Path,default=here/'first-chapter-upgrade');args=parser.parse_args()
    require(re.fullmatch('[a-f0-9]{40}',args.controllercommit) and args.run>0,'Exact controller commit/run are required');r=audit(args);print(json.dumps({'pass':True,'publicationAccepted':True,'checks':r['checks'],'receipt':str(args.output_root_acceptance),'catalog':str(args.output_catalog)},ensure_ascii=False))
if __name__=='__main__':main()
