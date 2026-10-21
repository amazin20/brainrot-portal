"""Append immutable v64 bytes to the exact accepted v63 public inventory.

Only the proven low-level archive/HTTP primitives are imported from the frozen
v63 controller. Its publication, recovery and acceptance functions are not used.
"""
import argparse
import concurrent.futures
import importlib.util
import json
import os
import pathlib
import shutil

CORE = pathlib.Path(__file__).with_name('publish-campaign-v63.py')
import hashlib
if hashlib.sha256(CORE.read_bytes()).hexdigest() != 'e6f431fb4e568e7a9196112523da2d9bde76d7d445f6e5dfe4fa5692ca6b6e3e':
    raise ValueError('Frozen low-level provider/archive primitives changed')
spec = importlib.util.spec_from_file_location('immutable_v63_io', CORE)
io = importlib.util.module_from_spec(spec); spec.loader.exec_module(io)
check, load, write, sha, encoded, name, rows_valid, inventory = (getattr(io, key) for key in
    ['check','load','write','sha','encoded','name','rows_valid','inventory'])
get, api, pages, safe_extract, verify_http, producer = (getattr(io, key) for key in
    ['get','api','pages','safe_extract','verify_http','producer'])
CONFIG='tools/campaign-v64-release.json'
PREFIX='campaign-v64/'
BASE=io.BASE
GROUPS=io.GROUPS
LIMITATIONS=[
 'Browser viewport/multitouch emulation and software WebGL do not establish physical phone FPS, thermals or human usability.',
 'Original Nioris checker applies to the separately bound Yandex REVIEW package with an explicit mock SDK; live ads and moderation remain unverified.',
 'Retained historical files are exact HTTP-hashed bytes; this is not new recording or full media decoding.',
 'Source51 uses separate target fixtures with completed prior prefixes. The legacy fixture reset is outside reported journey counters; this is not a continuous normal-Play campaign or universal zero-step/no-reset proof.',
 'Castle500 meaningful stages and15-minute human speedrun, full human discovery/uniqueness/art review remain open.',
 'Room17 widening camera transition is improved; instant narrowing portrait body clipping remains open.',
]

def config():
    c=load(CONFIG)
    check(c.get('frozen') is True and c.get('repository')==io.REPO and c.get('namespace')==PREFIX
          and c.get('version')=='v64-mobile-controls' and c.get('publicationAccepted') is False, 'Unfrozen/wrong v64 release pins')
    for key in ['sourceCommit','sourceTree','controllerParent']:io.hex_value(c[key],40)
    for key in ['sourceRun','sourceAttempt']:check(io.positive_safe_integer(c[key]),'Invalid Source run/attempt')
    check(c['sourceBranch']=='upgrade/mobile-controls-20261021'
          and c['sourceWorkflow']=='.github/workflows/mobile-controls-v64-review.yml','Unexpected Source workflow')
    check(len(c['expectedJobs'])==26 and len(set(c['expectedJobs']))==26,'Missing Source job contract')
    check(len(c['sourceArtifacts'])==29 and len({a['id'] for a in c['sourceArtifacts']})==29
          and sorted(a['name'] for a in c['sourceArtifacts'])==c['expectedArtifactNames'],'Missing exact Source artifact pins')
    return c

def source_provider(c):
    run=api('actions/runs/'+str(c['sourceRun']))
    jobs=pages('actions/runs/'+str(c['sourceRun'])+'/attempts/'+str(c['sourceAttempt'])+'/jobs')
    artifacts=pages('actions/runs/'+str(c['sourceRun'])+'/artifacts')
    check(run['id']==c['sourceRun'] and run['head_sha']==c['sourceCommit'] and run['head_branch']==c['sourceBranch']
          and run['path'].split('@')[0]==c['sourceWorkflow'] and run['run_attempt']==c['sourceAttempt']
          and run['status']=='completed' and run['conclusion']=='success','Source run is not the pinned successful run')
    check(sorted(j['name'] for j in jobs)==sorted(c['expectedJobs']) and len({j['id'] for j in jobs})==26
          and all(j['head_sha']==c['sourceCommit'] and j['run_id']==c['sourceRun'] and j['run_attempt']==c['sourceAttempt']
                  and j['status']=='completed' and j['conclusion']=='success' for j in jobs),'Source producer jobs differ or failed')
    actual=[{k:a[k] for k in ['id','name','size_in_bytes','digest']} for a in artifacts]
    check(sorted(actual,key=lambda a:a['id'])==sorted(c['sourceArtifacts'],key=lambda a:a['id'])
          and all(not a['expired'] and a['workflow_run']['id']==c['sourceRun']
                  and a['workflow_run']['head_sha']==c['sourceCommit'] for a in artifacts),'Source artifact metadata/provenance differs')
    return {'run':run,'jobs':jobs,'artifacts':artifacts}

def baseline(c):
    raw=pathlib.Path(c['baselineCatalog']).read_bytes()
    check(sha(raw)==c['baselineCatalogSha256']=='4dc766e1fdfd6f70e5abed02dee534dbc270f664a1cb4fe3c319167fbb1ecd02','Accepted v63 catalog changed')
    b=load(c['baselineCatalog']); rows=b['siteFiles']; rows_valid(rows)
    check(b['sourceAccepted'] is True and b['publicationAccepted'] is True and len(rows)==2686
          and sum(r['bytes'] for r in rows)==697909952
          and sha(encoded(rows))==c['baselineInventorySha256']=='2b94cf95c7e41a9d5d0d35cb305fb2ecb25a70e6884714c1f1460d97b767ffc8','Accepted v63 public inventory differs')
    check(not any(r['path'].startswith(PREFIX) for r in rows),'v64 is already present in the baseline')
    return rows

def source_receipt(c):
    pin=c['sourceAcceptance']; raw=pathlib.Path(pin['path']).read_bytes()
    check(sha(raw)==pin['sha256'],'Independent Root Source receipt changed')
    r=load(pin['path'])
    check(r.get('pass') is True and r.get('sourceAccepted') is True and r.get('publicationAccepted') is False
          and r['sourceCommit']==c['sourceCommit'] and r['sourceTree']==c['sourceTree']
          and r['sourceReview']=={'runId':c['sourceRun'],'runAttempt':c['sourceAttempt']},'Root Source receipt identity differs')
    check(r.get('masterTzAccepted') is False and r.get('liveSdkAccepted') is False
          and r.get('physicalPhonePerformanceAccepted') is False,'Receipt overstates scope')
    rows_valid(r['candidateFiles'],100_000_000)
    check(sum(row['bytes'] for row in r['candidateFiles'])==r['candidateBytes']
          and sha(encoded(r['candidateFiles']))==r['candidateInventorySha256'],'Root candidate inventory is inconsistent')
    return r

def lease(c,deployed=False,allow_pending=False):
    p=producer(); check(os.environ['GITHUB_REPOSITORY']==io.REPO and os.environ['GITHUB_REF']=='refs/heads/main','Wrong publisher origin')
    check(api('git/ref/heads/main')['object']['sha']==p['GITHUB_SHA'],'Main changed during publication')
    check([row['sha'] for row in api('git/commits/'+p['GITHUB_SHA'])['parents']]==[c['controllerParent']],'Publisher parent differs')
    check(api('git/ref/heads/'+c['sourceBranch'])['object']['sha']==c['sourceCommit']
          and api('git/commits/'+c['sourceCommit'])['tree']['sha']==c['sourceTree'],'Source branch/tree lease changed')
    deployments=sorted(pages('deployments?environment=github-pages'),key=lambda d:d['id'],reverse=True)
    check(deployments,'No Pages deployment'); d=deployments[0]; statuses=pages('deployments/'+str(d['id'])+'/statuses')
    own_url='https://github.com/'+io.REPO+'/actions/runs/'+p['GITHUB_RUN_ID']
    def own(value,states):return value['sha']==p['GITHUB_SHA'] and states and any(states[0].get(k,'').rstrip('/')==own_url or states[0].get(k,'').startswith(own_url+'/') for k in ['log_url','target_url'])
    if deployed:
        check(own(d,statuses) and statuses[0]['state']=='success' and d['id']>c['baselineDeployment']['id'],'Current successful deployment is not this run')
    else:
        if allow_pending and own(d,statuses):
            check(statuses[0]['state'] in ['queued','pending','in_progress'] and len(deployments)>1,'Wrong pending deployment')
            d=deployments[1]; statuses=pages('deployments/'+str(d['id'])+'/statuses')
        check({'id':d['id'],'sha':d['sha']}==c['baselineDeployment'] and statuses and statuses[0]['state']=='success','Accepted v63 deployment changed')
    return {'deployment':d,'statuses':statuses}

def artifact(c,pin):
    io.hex_value(pin['digest'].removeprefix('sha256:'),64)
    check(pin['digest'].startswith('sha256:') and 0<pin['size_in_bytes']<=100_000_000,'Invalid bounded artifact pin')
    archive=pathlib.Path('provider')/(str(pin['id'])+'.zip')
    get('https://api.github.com/repos/'+io.REPO+'/actions/artifacts/'+str(pin['id'])+'/zip',token=True,
        destination=archive,expected={'bytes':pin['size_in_bytes'],'sha256':pin['digest'][7:]})
    folder=pathlib.Path('provider')/pin['name']; rows=safe_extract(archive,folder,100_000_000)
    return {'metadata':pin,'zipSha256':sha(archive.read_bytes()),'files':rows,'folder':str(folder)}

def validate_source_reports(c,records):
    root=pathlib.Path('provider'); groups=GROUPS
    all_files=sorted(p.name for p in pathlib.Path('source/tests').iterdir() if p.name.endswith('.test.js') and not p.name.startswith('lab-tower'))
    covered=[];counts=0;checker_summaries=[]
    for part in range(12):
        r=load(root/('v64-cpu-'+str(part))/'report.json')
        wanted=['tests/'+f for i,f in enumerate(all_files) if i%12==part]
        check(r['sourceCommit']==c['sourceCommit'] and r['part']==part and r['parts']==12 and r['allFiles']==all_files
              and r['files']==wanted and r['pass'] is True and r['code']==0 and r['signal'] is None
              and r['counts']['tests']==r['counts']['pass']>0 and all(r['counts'][k]==0 for k in ['fail','cancelled','skipped','todo']),'CPU shard failed or overlaps')
        covered+=r['files'];counts+=r['counts']['tests']
    check(sorted(covered)==['tests/'+f for f in all_files] and len(covered)==len(set(covered)),'CPU coverage differs')
    for group,levels in groups.items():
        native=load(root/('v64-native-'+group)/'report.json')
        check(native['sourceCommit']==c['sourceCommit'] and native['mode']=='route' and native['pass'] is True
              and native['capturePass'] is True and native['errors']==[] and [r['level'] for r in native['rows']]==levels,'Native cohort failed')
        for row in native['rows']:
            route=row['route'];check(row['pass'] is True and row['capturePass'] is True and row['errors']==[]
                  and route['pass'] is True and route['state']=='won' and route['sameCompanion'] is True
                  and route['sameCargoShape'] is True and route['resets']==0 and route['respawns']==0,'Native original-body win failed')
        platform=load(root/('v64-checker-platform-'+group)/'platform-route-report.json')
        check(platform['binding']['source']['commit']==c['sourceCommit'] and platform['binding']['source']['tree']==c['sourceTree']
              and platform['pass'] is True and platform['levels']==levels and [r['level'] for r in platform['rows']]==levels,'Original checker cohort failed')
        for row in platform['rows']:
            check(row['pass'] is True and row['errors']==[] and row['route']['pass'] is True and row['finished']['state']=='won'
                  and row['finished']['actualProductionWin'] is True and row['finished']['cargoBodyId']==row['normalPlay']['cargoBodyId']
                  and row['finished']['cargoUUID']==row['normalPlay']['cargoUUID'] and row['finalFrame']['ok'] is True
                  and row['checker']['summary']['hardFailures']==0 and row['checker']['summary']['checked'] is True,'Checker route did not win with original body or had hard failures')
            folder=root/('v64-checker-platform-'+group)/('room-'+str(row['level']).zfill(2))/'checker'
            raw=(folder/'yandex-debug-checker-report.json').read_bytes();text=(folder/'yandex-debug-checker-report.txt').read_bytes()
            check(sha(raw)==row['checker']['reportSha256'] and sha(text)==row['checker']['originalTextSha256'],'Original checker capture bytes differ')
            diagnostic=load(folder/'yandex-debug-checker-report.json')
            check(diagnostic['pass'] is True and diagnostic['summary']==row['checker']['summary']
                  and diagnostic['originalReport'].encode()==text and diagnostic['checker']['sha256']=='adb1ca16e9b3172712d5eda9b64d6fd6792b5e00e85102a0bf0a2390b3239e00'
                  and diagnostic['context']=='mock-yandex-platform' and diagnostic['liveSdkAccepted'] is False,'Original checker source/text/context differs')
            check(all(diagnostic['identity'][key]==value for key,value in {'sourceCommit':c['sourceCommit'],'sourceTree':c['sourceTree'],
                  'runId':c['sourceRun'],'runAttempt':c['sourceAttempt'],'level':row['level']}.items()),'Original checker identity differs')
            statuses={key:sum(r['status']==key for r in diagnostic['rows']) for key in ['pass','fail','warn','not_verified']}
            check(sum(statuses.values())==len(diagnostic['rows'])>0 and statuses['fail']==0
                  and all(diagnostic['counts'][label]==statuses[key] for key,label in [('pass','PASS'),('fail','FAIL'),('warn','WARN'),('not_verified','N/V')])
                  and all(r['copiedLine'] in diagnostic['originalReport'].splitlines() for r in diagnostic['rows']),'Original checker row verdicts/copy do not match')
            checker_summaries.append({'level':row['level'],'reportSha256':sha(raw),'originalTextSha256':sha(text),**diagnostic['summary']})
    mobile=load(root/'v64-mobile-controls/report.json')
    check(mobile['pass'] is True and mobile['sourceCommit']==c['sourceCommit'] and mobile['errors']==[]
          and mobile['physicalPhoneTest'] is False and mobile['hardwareFpsMeasured'] is False and mobile.get('multitouch')
          and len(mobile['layouts'])>=8,'Mobile native input/geometry evidence failed')
    return {'cpuTests':counts,'cpuFiles':len(covered),'nativeRooms':51,'originalCheckerRooms':51,
            'originalCheckerSummaries':sorted(checker_summaries,key=lambda r:r['level']),
            'mobileLayouts':len(mobile['layouts'])}

def candidate(c,receipt):
    folder=pathlib.Path('provider/v64-dist'); actual=inventory(folder); info=load(folder/'build-info.json')
    check(actual==receipt['candidateFiles'],'Consumer differs from independently accepted inventory')
    check(info['commit']==info['gameCommit']==info['interfaceCommit']==c['sourceCommit'] and info['version']==c['version']
          and int(info['run'])==c['sourceRun'] and info['levels']==51 and info['verified'] is False,'Consumer build stamp differs')
    check([r for r in actual if r['path']!='build-info.json']==info['files']
          and sha(encoded(info['files']))==info['packageFilesSha256'],'Consumer manifest differs')
    check(len(info['sourceInputs'])==info['sourceInputFiles'] and sha(encoded(info['sourceInputs']))==info['sourceInputsSha256']
          and len({r['filename'] for r in info['sourceInputs']})==len(info['sourceInputs']),'Source input inventory differs')
    for row in info['sourceInputs']:
        check(sha((pathlib.Path('source')/name(row['filename'])).read_bytes())==row['sha256'],'Source input changed: '+row['filename'])
    check([r['stableLevel'] for r in info['rooms']]==list(range(1,41))+list(range(42,52))+[41]
          and info['features']['tower']['checkpoints'] is False,'Campaign order/checkpoint contract changed')
    check(info['features']['playerAccess']=={'completedReplay':True,'nextUncompleted':True,'productionQueryCannotSelectEdition':True,
          'hintsPerRoom':3,'rewardedHints':True,'freeDemoHints':True,'compactPauseAtlas':True},'Progression/hint/compact pause contract changed')
    return actual,info

def validate_append(prior,union):
    old=rows_valid(prior);new=rows_valid(union)
    check(all(new.get(k)==row for k,row in old.items()),'Historical public byte deleted or overwritten')
    additions=[r for r in union if r['path'] not in old]
    check(additions and all(r['path'].startswith(PREFIX) for r in additions),'Unexpected publication outside v64')
    return additions

def prepared_baseline(s,rows):
    expected={'files':len(rows),'bytes':sum(r['bytes'] for r in rows),'inventorySha256':sha(encoded(rows)),
              'method':'complete HTTP GET, exact length and SHA-256 for every file'}
    check(s['baseline']==expected,'Preparation does not retain the exact accepted baseline restore proof')
    return expected

def preparation(c):
    check(not pathlib.Path('pages').exists() and not pathlib.Path('provider').exists() and not pathlib.Path('proof').exists(),'Fresh publisher output required')
    prior=baseline(c);receipt=source_receipt(c);provider=source_provider(c);deployment=lease(c)
    write('proof/source-provider.json',provider)
    records=[]
    for pin in c['sourceArtifacts']:records.append(artifact(c,pin))
    validation=validate_source_reports(c,records);candidate_files,info=candidate(c,receipt)
    original_stamp=sha(pathlib.Path('provider/v64-dist/build-info.json').read_bytes())
    restored=verify_http(prior,'pages')
    check(inventory('pages')==prior,'Restored v63 differs')
    for target in [PREFIX,PREFIX+'index.html',PREFIX+'build-info.json']:get(BASE+target,absent=True)
    shutil.copytree('provider/v64-dist',pathlib.Path('pages')/PREFIX)
    yandex=load('provider/v64-yandex/report.json');archive=pathlib.Path('provider/v64-yandex/brainrot-portal-v64-yandex.zip')
    check(yandex['pass'] is True and yandex['sourceCommit']==c['sourceCommit'] and yandex['sourceTree']==c['sourceTree']
          and yandex['sha256']==sha(archive.read_bytes()) and yandex['compressedBytes']==archive.stat().st_size
          and yandex['workingTreeModified'] is False and yandex['builtFromCurrentSource'] is True,'Production Yandex ZIP differs')
    extras=pathlib.Path('pages')/PREFIX/'release';extras.mkdir()
    shutil.copyfile(archive,extras/archive.name)
    for filename in ['controls-844x390.png','controls-390x844.png','controls-three-fingers.png','report.json']:
        shutil.copyfile(pathlib.Path('provider/v64-mobile-controls')/filename,extras/filename)
    write(extras/'provenance.json',{'kind':'v64-append-only-source-provenance','publicationAccepted':False,'sourceCommit':c['sourceCommit'],
        'sourceTree':c['sourceTree'],'sourceReview':{'runId':c['sourceRun'],'runAttempt':c['sourceAttempt']},'producer':producer(),
        'sourceAcceptance':c['sourceAcceptance'],'sourceArtifacts':c['sourceArtifacts'],'baseline':restored,'limitations':LIMITATIONS})
    union=inventory('pages');additions=validate_append(prior,union)
    state={'kind':'v64-append-only-preparation','publicationAccepted':False,'producer':producer(),'configSha256':sha(pathlib.Path(CONFIG).read_bytes()),
        'sourceCommit':c['sourceCommit'],'sourceTree':c['sourceTree'],'sourceReview':{'runId':c['sourceRun'],'runAttempt':c['sourceAttempt']},
        'baseline':restored,'baselineDeployment':deployment,'candidateFiles':candidate_files,'originalBuildInfoSha256':original_stamp,
        'unionFiles':union,'addedFiles':additions,'sourceValidation':validation,'sourceArtifacts':records,'limitations':LIMITATIONS}
    write('proof/preparation.json',state)

def state(c):
    s=load('proof/preparation.json')
    check(s['producer']==producer() and s['configSha256']==sha(pathlib.Path(CONFIG).read_bytes()),'Preparation producer/config changed')
    return s

def main():
    parser=argparse.ArgumentParser();parser.add_argument('command',choices=['pins','prepare','before','public','final']);args=parser.parse_args();c=config()
    if args.command=='pins':
        with open(os.environ['GITHUB_OUTPUT'],'a') as out:
            out.write('source_commit='+c['sourceCommit']+'\nsource_run='+str(c['sourceRun'])+'\n')
        return
    if args.command=='prepare':preparation(c);return
    s=state(c);source_provider(c)
    if args.command=='before':
        d=lease(c,allow_pending=True);result=prepared_baseline(s,baseline(c))
        for target in [PREFIX,PREFIX+'index.html',PREFIX+'build-info.json']:get(BASE+target,absent=True)
        write('proof/before-deploy.json',{'publicationAccepted':False,'producer':producer(),'baselineFromPreparation':result,
              'scope':'Exact accepted baseline was fully fetched, hashed and restored in prepare before the Pages upload; this step rechecks its immutable summary and the live Source/Main/deployment lease.',
              'deployment':d})
    elif args.command=='public':
        d=lease(c,deployed=True);result=verify_http(s['unionFiles'])
        check(sha(get(BASE+PREFIX+'build-info.json'))==s['originalBuildInfoSha256'],'Public build stamp changed')
        write('proof/public-http.json',{'pass':True,'publicationAccepted':False,'producer':producer(),'union':result,'deployment':d})
    else:
        jobs=pages('actions/runs/'+os.environ['GITHUB_RUN_ID']+'/attempts/'+os.environ['GITHUB_RUN_ATTEMPT']+'/jobs')
        previous=[j for j in jobs if j['name']!='verify']
        check(sorted(j['name'] for j in previous)==['deploy','mobile','prepare','public-http']
              and all(j['status']=='completed' and j['conclusion']=='success' for j in previous),'Public producer missing or failed')
        http=load('proof/public-http.json');browser=load('proof/mobile/public-browser-report.json')
        check(http['pass'] is True and http['producer']==producer(),'Public HTTP proof invalid')
        check(http['union']=={'files':len(s['unionFiles']),'bytes':sum(r['bytes'] for r in s['unionFiles']),
              'inventorySha256':sha(encoded(s['unionFiles'])),'method':'complete HTTP GET, exact length and SHA-256 for every file'},'Public union differs from preparation')
        check(browser['pass'] is True and browser['publicationAccepted'] is False and browser['sourceCommit']==c['sourceCommit']
              and browser['producer']==producer(),'Public browser proof invalid')
        write('proof/final-publication.json',{'kind':'v64-public-technical-checks','technicalChecksPassed':True,'publicationAccepted':False,
              'requiresIndependentRootAcceptance':True,'producer':producer(),'sourceCommit':c['sourceCommit'],'sourceTree':c['sourceTree'],
              'sourceReview':{'runId':c['sourceRun'],'runAttempt':c['sourceAttempt']},'sourceValidation':s['sourceValidation'],
              'publicJobs':previous,'union':http['union'],'deployment':lease(c,deployed=True),'browser':browser,
              'nativeRouteScope':{'normalUiZeroStepStartProven':False,'resetCounterScope':io.LEGACY_ROUTE_RESET_COUNTER_SCOPE},
              'masterTzAccepted':False,'liveSdkAccepted':False,'moderationAccepted':False,'physicalPhonePerformanceAccepted':False,
              'humanPlaytest':False,'hardwareFPSMeasured':False,
              'historicalFilesPreserved':2686,'historicalBytesPreserved':697909952,'limitations':LIMITATIONS})

if __name__=='__main__':main()
