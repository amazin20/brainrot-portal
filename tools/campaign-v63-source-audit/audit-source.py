"""Read-only draft audit of one exact v63 Source Actions attempt.

No downloads, route runs, builds, source writes, or acceptance receipt issuance.
Provider JSON/ZIPs/raw logs must already have been downloaded by Root. A passing
result remains sourceAccepted:false and publicationAccepted:false.
"""
import argparse
import datetime as dt
import hashlib
import itertools
import json
import math
import pathlib
import re
import stat
import subprocess
import sys
import tempfile
import zipfile
import yaml

REPOSITORY = 'amazin20/brainrot-portal'
BRANCH = 'upgrade/campaign-access-20261020'
WORKFLOW = '.github/workflows/player-access-review.yml'
VERSION = 'v63-player-access-optics'
GROUPS = {'early':list(range(1,11)), 'energy':list(range(11,21)),
          'living':list(range(21,31)), 'optics':list(range(31,41)),
          'fracture':list(range(42,52)), 'castle':[41]}
RESET_SCOPE = ('reported journey counters after legacy fixture initialization; '
               'the initial fixture reset is outside these counters; specialized '
               'drivers retain their own stricter proofs')

def require(value, message):
    if not value:
        raise AssertionError(message)

def sha(data):
    return hashlib.sha256(data).hexdigest()

def encoded(value):
    return json.dumps(value,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode()

def file_sha(file):
    h=hashlib.sha256()
    with pathlib.Path(file).open('rb') as stream:
        for block in iter(lambda:stream.read(1024*1024),b''):
            h.update(block)
    return h.hexdigest()

def load(file):
    # Reject duplicate JSON keys and nonfinite values rather than silently
    # interpreting a second, attacker-controlled identity field.
    file=pathlib.Path(file);require(file.is_file() and not file.is_symlink(),'Regular provider/report JSON file required')
    def pairs(rows):
        result={}
        for key,value in rows:
            require(key not in result,'Duplicate JSON key: '+key)
            result[key]=value
        return result
    def invalid(value):
        raise AssertionError('Nonfinite JSON value: '+value)
    def finite(value):
        result=float(value);require(math.isfinite(result),'Nonfinite JSON numeric literal');return result
    return json.loads(file.read_text(encoding='utf-8-sig'),object_pairs_hook=pairs,parse_constant=invalid,parse_float=finite)

def git(source,*args):
    return subprocess.check_output(['git','-C',str(source),*args]).decode().strip()

def safe_name(value):
    require(isinstance(value,str) and value and not value.startswith('/') and '\\' not in value and
            not re.match(r'^[A-Za-z]:',value),'Unsafe member path: '+repr(value))
    require(all(piece not in ('','.','..') for piece in value.split('/')) and
            all(ord(c)>=32 and ord(c)!=127 for c in value),'Noncanonical member path')
    require(len(value.encode())<=2048 and len(value.split('/'))<=64,'Oversized member path')
    return value

def inventory(directory,maximum=250_000_000):
    directory=pathlib.Path(directory)
    require(directory.is_dir() and not directory.is_symlink(),'Missing or linked evidence directory: '+str(directory))
    rows=[];total=0
    for file in sorted(directory.rglob('*')):
        require(not file.is_symlink(),'Symlink in evidence: '+str(file))
        if file.is_dir():
            continue
        require(file.is_file(),'Special evidence file')
        name=safe_name(file.relative_to(directory).as_posix());size=file.stat().st_size
        total+=size;require(total<=maximum,'Evidence exceeds byte budget')
        rows.append({'path':name,'bytes':size,'sha256':file_sha(file)})
    require(0<len(rows)<=20000,'Invalid evidence member count')
    return rows

def verified_zip(archive,directory,pin):
    archive=pathlib.Path(archive);directory=pathlib.Path(directory)
    require(archive.is_file() and not archive.is_symlink(),'Missing exact provider ZIP: '+str(archive))
    require(archive.stat().st_size==pin['size_in_bytes'] and
            'sha256:'+file_sha(archive)==pin['digest'],'Provider ZIP size/digest differs: '+pin['name'])
    actual=inventory(directory);rows=[];seen=set();dirs=set();total=0
    with zipfile.ZipFile(archive) as zipped:
        members=zipped.infolist();require(0<len(members)<=20000,'ZIP member limit')
        for member in members:
            name=safe_name(member.filename.rstrip('/') if member.is_dir() else member.filename)
            require(name not in seen,'Duplicate ZIP path');seen.add(name)
            mode=member.external_attr>>16
            require(stat.S_IFMT(mode) in (0,stat.S_IFREG,stat.S_IFDIR) and not member.flag_bits&1,'Special/encrypted ZIP member')
            require(0<=member.file_size<=250_000_000 and (not member.is_dir() or member.file_size==0),'ZIP size invalid')
            total+=member.file_size;require(total<=250_000_000,'ZIP decompression budget')
        names=[member.filename for member in members if not member.is_dir()]
        first={name.split('/')[0] for name in names}
        common=next(iter(first)) if len(first)==1 and all('/' in name for name in names) else None
        for member in members:
            name=member.filename.rstrip('/')
            if common:
                require(name==common and member.is_dir() or name.startswith(common+'/'),'Entry outside common root')
                if name==common:
                    continue
                name=name[len(common)+1:]
            safe_name(name)
            if member.is_dir():
                dirs.add(name);continue
            h=hashlib.sha256();size=0
            # Streaming to EOF also executes zipfile's actual CRC32 validation.
            with zipped.open(member) as stream:
                for block in iter(lambda:stream.read(1024*1024),b''):
                    size+=len(block);require(size<=member.file_size,'Expanded ZIP member exceeds declared size');h.update(block)
            require(size==member.file_size,'Truncated ZIP body')
            rows.append({'path':name,'bytes':size,'sha256':h.hexdigest()})
    rows.sort(key=lambda row:row['path']);require(rows==actual,'Extracted artifact closure differs: '+pin['name'])
    paths={row['path'] for row in rows}
    require(all(not any('/'.join(name.split('/')[:i]) in paths for i in range(1,len(name.split('/')))) for name in paths),'ZIP file/directory collision')
    parents={'/'.join(name.split('/')[:i]) for name in paths for i in range(1,len(name.split('/')))}
    actual_dirs={file.relative_to(directory).as_posix() for file in directory.rglob('*') if file.is_dir()}
    require(actual_dirs==dirs|parents,'Extra/missing extracted directory')
    return {'artifactId':pin['id'],'artifactName':pin['name'],'zipBytes':archive.stat().st_size,
            'zipSha256':file_sha(archive),'files':len(rows),'bytes':sum(row['bytes'] for row in rows),
            'inventorySha256':sha(encoded(rows))}

def extract_production(archive,directory):
    """Only a temporary copy of the already provider-bound production ZIP."""
    seen=set();total=0
    with zipfile.ZipFile(archive) as zipped:
        require(0<len(zipped.infolist())<=20000,'Production ZIP member limit')
        for member in zipped.infolist():
            name=safe_name(member.filename.rstrip('/') if member.is_dir() else member.filename)
            require(name not in seen,'Duplicate production ZIP path');seen.add(name)
            require(stat.S_IFMT(member.external_attr>>16) in (0,stat.S_IFREG,stat.S_IFDIR) and not member.flag_bits&1,'Special/encrypted production member')
            total+=member.file_size;require(0<=member.file_size<=100_000_000 and total<=100_000_000,'Production decompression budget')
            target=directory/name
            if member.is_dir():
                require(member.file_size==0,'Production directory body');target.mkdir(parents=True,exist_ok=True)
            else:
                target.parent.mkdir(parents=True,exist_ok=True)
                with zipped.open(member) as incoming,target.open('xb') as outgoing:
                    for block in iter(lambda:incoming.read(1024*1024),b''):
                        outgoing.write(block)

def pages(folder,field):
    folder=pathlib.Path(folder);require(folder.is_dir() and not folder.is_symlink(),'Regular provider page directory required')
    files=sorted(folder.glob('page-*.json'))
    require({file.name for file in folder.iterdir()}=={file.name for file in files},'Extra provider page directory member')
    require(files and [file.name for file in files]==[f'page-{i:03}.json' for i in range(1,len(files)+1)],'Missing/nonsequential '+field+' provider pages')
    rows=[];count=None
    for file in files:
        page=load(file);require(isinstance(page,dict) and isinstance(page.get(field),list),'Raw provider '+field+' page required')
        require(type(page.get('total_count')) is int and page['total_count']>0,'Provider total_count required')
        if count is None:
            count=page['total_count']
        require(page['total_count']==count and page[field],'Inconsistent/empty provider page')
        rows+=page[field]
    require(len(rows)==count,'Incomplete/duplicated '+field+' pagination')
    require(len({row['id'] for row in rows})==len(rows),'Duplicated '+field+' IDs')
    return rows,files

def workflow_roles(source):
    """Expand this exact frozen workflow, rather than pinning old job totals."""
    document=yaml.safe_load((pathlib.Path(source)/WORKFLOW).read_text())
    roles={}
    for job_id,job in document['jobs'].items():
        matrix=job.get('strategy',{}).get('matrix')
        require(not matrix or 'exclude' not in matrix,'Audit requires explicit matrix support for exclusions')
        if not matrix:
            variants=[{}]
        elif set(matrix)=={'include'}:
            variants=matrix['include']
        else:
            require('include' not in matrix,'Mixed matrix expansion not supported by this audited draft')
            keys=list(matrix);variants=[dict(zip(keys,values)) for values in itertools.product(*(matrix[key] for key in keys))]
        def expand(value,variant):
            value=str(value)
            for key,item in variant.items():
                value=value.replace('${{ matrix.'+key+' }}',str(item))
            require('${{' not in value,'Unresolved workflow matrix expression')
            return value
        for variant in variants:
            name=expand(job['name'],variant) if 'name' in job else job_id+(' ('+', '.join(map(str,variant.values()))+')' if variant else '')
            names=[expand(step['with']['name'],variant) for step in job['steps'] if str(step.get('uses','')).startswith('actions/upload-artifact@')]
            require(names and name not in roles,'Missing/duplicate workflow producer role')
            roles[name]=names
    require(len({name for names in roles.values() for name in names})==sum(map(len,roles.values())),'Duplicated workflow artifact name')
    return roles

def instant(value):
    return dt.datetime.fromisoformat(value.replace('Z','+00:00'))

WORKFLOW_GET_REJECTION='HTTPError: 400: GitHub Fetch URL is not an allowed public GitHub repository or search endpoint. (Response: None)'

def validate_workflow_unavailable(marker,run):
    require(set(marker)=={'schemaVersion','kind','requestedUrl','tool','actualToolResponse','sourceWorkflow','independentWorkflowMetadataGet','workflowDefinitionFromExactSourceTree'},'Unexpected workflow capability-marker fields or synthetic metadata state')
    require(marker.get('schemaVersion')==1 and marker.get('kind')=='workflow-metadata-get-unavailable','Explicit actual workflow capability-rejection marker required')
    require(marker.get('requestedUrl')==run['workflow_url'],'Workflow rejected URL differs from the actual run workflow_url')
    require(marker.get('tool')=='mcp__codex_apps__github_fetch','Wrong workflow metadata rejection tool')
    response=marker.get('actualToolResponse',{})
    require(response.get('isError') is True and response.get('structuredContent',{}).get('error_code')=='INVALID_ARGUMENT','Not the actual workflow capability rejection')
    require(response['structuredContent'].get('error')==WORKFLOW_GET_REJECTION and
            response.get('content')==[{'type':'text','text':WORKFLOW_GET_REJECTION}],'Preserve the exact observed workflow tool rejection')
    require(marker.get('independentWorkflowMetadataGet') is False and marker.get('workflowDefinitionFromExactSourceTree') is True,'Capability limitation must be explicit')
    bound=marker.get('sourceWorkflow',{})
    require(bound.get('path')==WORKFLOW and type(bound.get('bytes')) is int and bound['bytes']>0 and
            re.fullmatch(r'[a-f0-9]{64}',bound.get('sha256','')) and re.fullmatch(r'[a-f0-9]{40}',bound.get('gitBlob','')),'Exact source workflow byte/blob binding required')

def workflow_record(source,provider,run,commit):
    require(type(run.get('workflow_id')) is int and run['workflow_id']>0,'Actual provider workflow ID required')
    require(run.get('workflow_url')==f"https://api.github.com/repos/{REPOSITORY}/actions/workflows/{run['workflow_id']}",'Actual run workflow URL/ID differs')
    file=source/WORKFLOW;require(file.is_file() and not file.is_symlink(),'Exact committed workflow definition required')
    body=file.read_bytes();committed=subprocess.check_output(['git','-C',str(source),'show',commit+':'+WORKFLOW])
    require(body==committed,'Workflow definition differs from the exact Source tree')
    bound={'path':WORKFLOW,'bytes':len(body),'sha256':sha(body),'gitBlob':git(source,'rev-parse',commit+':'+WORKFLOW)}
    real=provider/'workflow.json';unavailable=provider/'workflow-metadata-unavailable.json'
    require(not real.is_symlink() and not unavailable.is_symlink(),'Workflow provider records must not be linked')
    require(real.exists()!=unavailable.exists(),'Provide either actual workflow.json or the explicit actual capability-rejection marker, never neither/both')
    if real.exists():
        metadata=load(real)
        summary={'independentWorkflowMetadataGet':True,'workflowDefinitionFromExactSourceTree':True,'workflowId':run['workflow_id'],'workflowUrl':run['workflow_url'],'sourceWorkflow':bound}
        return metadata,None,summary,real
    marker=load(unavailable);validate_workflow_unavailable(marker,run)
    require(marker['sourceWorkflow']==bound,'Capability fallback workflow hash/blob differs from exact committed Source bytes')
    summary={'independentWorkflowMetadataGet':False,'workflowDefinitionFromExactSourceTree':True,'workflowId':run['workflow_id'],'workflowUrl':run['workflow_url'],'sourceWorkflow':bound,
             'capabilityRejection':{'path':'provider/workflow-metadata-unavailable.json','bytes':unavailable.stat().st_size,'sha256':file_sha(unavailable),'tool':marker['tool'],'actualToolResponseSha256':sha(encoded(marker['actualToolResponse']))},
             'limitation':'The provider tool rejected the independent workflow metadata endpoint; workflow state was not independently fetched. Actual run path/ID/URL and exact Git-tree workflow bytes are verified.'}
    return None,marker,summary,unavailable

def validate_provider(run,jobs,artifacts,meta,workflow,commit,tree,parents,run_id,attempt,roles,workflow_unavailable=None):
    require(run['id']==run_id and run['run_attempt']==attempt and run['head_sha']==commit and
            run['head_branch']==BRANCH and run['path']==WORKFLOW and run['event']=='push','Wrong Source run identity')
    require(run['repository']['full_name']==REPOSITORY and run['status']=='completed' and run['conclusion']=='success','Source run is not completed successfully')
    require(type(run.get('workflow_id')) is int and run['workflow_id']>0 and run.get('workflow_url')==f"https://api.github.com/repos/{REPOSITORY}/actions/workflows/{run['workflow_id']}",'Wrong actual run workflow ID/URL')
    if workflow is not None:
        require(workflow_unavailable is None and workflow['id']==run['workflow_id'] and workflow['path']==WORKFLOW and workflow['state']=='active','Wrong workflow provider identity')
    else:
        require(workflow_unavailable is not None,'Missing independent workflow metadata and explicit capability rejection')
        validate_workflow_unavailable(workflow_unavailable,run)
    require(meta['sha']==commit and meta['tree']['sha']==tree and [parent['sha'] for parent in meta['parents']]==parents,'Provider commit/tree/parents differ')
    require(len(jobs)==len(roles) and {job['name'] for job in jobs}==set(roles),'Incomplete or extra Source job cohort')
    expected={name for names in roles.values() for name in names}
    require(len(artifacts)==len(expected) and {artifact['name'] for artifact in artifacts}==expected,'Incomplete or extra Source artifact cohort')
    mapping={}
    for job in jobs:
        require(job['run_id']==run_id and job['run_attempt']==attempt and job['head_sha']==commit and
                job['status']=='completed' and job['conclusion']=='success','Wrong/failed Source job')
        steps=job['steps'];require(steps and len({step['number'] for step in steps})==len(steps),'Empty/duplicate Source steps')
        require(all(step['status']=='completed' and step['conclusion']=='success' for step in steps),'Source job contains failed/skipped/unfinished steps')
        uploads=[step for step in steps if 'actions/upload-artifact@' in step['name']]
        require(len(uploads)==len(roles[job['name']]),'Wrong successful upload step count')
        for name in roles[job['name']]:
            mapping[name]=job
    for artifact in artifacts:
        require(artifact['expired'] is False and re.fullmatch(r'sha256:[a-f0-9]{64}',artifact['digest']) and
                type(artifact['size_in_bytes']) is int and 0<artifact['size_in_bytes']<=250_000_000,'Expired/invalid artifact')
        producer=artifact['workflow_run']
        require(producer['id']==run_id and producer['head_sha']==commit and producer['head_branch']==BRANCH and
                producer['repository_id']==run['repository']['id'] and producer['head_repository_id']==run['repository']['id'],'Wrong artifact producer')
        job=mapping[artifact['name']];created=instant(artifact['created_at'])
        uploads=[step for step in job['steps'] if 'actions/upload-artifact@' in step['name']]
        require(any(instant(step['started_at'])-dt.timedelta(seconds=2)<=created<=instant(step['completed_at'])+dt.timedelta(seconds=2) for step in uploads),'Artifact creation outside producer upload step')
    return mapping

def validate_logs(provider,jobs,artifacts,mapping,commit,run_id):
    logs={};pins=[];expected_ids={job['id'] for job in jobs}
    folder=provider/'logs';require(folder.is_dir() and not folder.is_symlink(),'Regular raw-log directory required')
    require({file.name for file in folder.iterdir()}=={str(value)+'.log' for value in expected_ids},'Missing, aliased or extra raw job logs')
    pattern=re.compile(r'Artifact (\S+) has been successfully uploaded! Final size is (\d+) bytes\. Artifact ID is (\d+)')
    artifact_by_id={artifact['id']:artifact for artifact in artifacts}
    for job in jobs:
        file=provider/'logs'/f"{job['id']}.log";require(file.is_file() and not file.is_symlink() and 0<file.stat().st_size<=50_000_000,'Missing/bounded raw log required')
        value=file.read_text(encoding='utf-8-sig');require(commit in value,'Raw producer checkout commit absent')
        events=list(pattern.finditer(value));wanted=[artifact for artifact in artifacts if mapping[artifact['name']]['id']==job['id']]
        require(len(events)==len(wanted),'Wrong raw producer upload count')
        require({int(event[3]) for event in events}=={artifact['id'] for artifact in wanted},'Artifact IDs not linked from actual producer log')
        for event in events:
            artifact=artifact_by_id[int(event[3])]
            require(event[1]==artifact['name'] and int(event[2])==artifact['size_in_bytes'],'Raw upload name/bytes differ from provider artifact')
            before=value[max(0,event.start()-2500):event.start()]
            require('SHA256 digest of uploaded artifact zip is '+artifact['digest'][7:] in before,'Raw upload digest differs')
            link=f"Artifact download URL: https://github.com/{REPOSITORY}/actions/runs/{run_id}/artifacts/{artifact['id']}"
            require(link in value[event.end():event.end()+1500],'Actual upload artifact link absent')
        logs[job['name']]=value;pins.append({'jobId':job['id'],'jobName':job['name'],'bytes':file.stat().st_size,'sha256':file_sha(file)})
    return logs,pins

def tap_counts(value):
    result={}
    for key in ['tests','pass','fail','cancelled','skipped','todo']:
        rows=re.findall(r'^# '+key+r' (\d+)$',value,re.M)
        require(len(rows)==1,'Missing/ambiguous TAP footer: '+key);result[key]=int(rows[0])
    require(result['tests']>0 and result['pass']==result['tests'] and all(result[key]==0 for key in ['fail','cancelled','skipped','todo']),'TAP failed/skipped/incomplete tests')
    return result

def stdout_contains(value,log):
    clean='\n'.join(re.sub(r'^\ufeff?\d{4}-\d\d-\d\dT[\d:.]+Z ','',line) for line in log.splitlines());position=0
    for line in value.splitlines():
        at=clean.find(line,position);require(at>=position,'Artifact TAP absent from actual producer stdout');position=at+len(line)

def audit_cpu(source,evidence,commit,logs):
    all_files=sorted(file.name for file in (source/'tests').iterdir() if file.name.endswith('.test.js') and not file.name.startswith('lab-tower'))
    require(all_files,'Empty current CPU partition');partition=[];total=0;shards=[]
    for part in range(12):
        directory=evidence/f'v63-cpu-{part}';report=load(directory/'report.json');tap=(directory/'full.tap').read_text()
        counts=tap_counts(tap);expected=['tests/'+name for index,name in enumerate(all_files) if index%12==part]
        require(report['sourceCommit']==commit and report['part']==part and report['parts']==12 and report['allFiles']==all_files and
                report['files']==expected and report['code']==0 and report['signal'] is None and report['pass'] is True and report['counts']==counts,'CPU shard/source/file/count closure differs')
        stdout_contains(tap,logs[f'cpu ({part})']);partition+=report['files'];total+=counts['tests'];shards.append({'part':part,'files':len(expected),'tests':counts['tests'],'tapSha256':file_sha(directory/'full.tap')})
    require(sorted(partition)==['tests/'+name for name in all_files] and len(set(partition))==len(partition),'CPU files omitted or duplicated')
    return {'tests':total,'passed':total,'failed':0,'skipped':0,'files':len(all_files),'disjointShards':12,'shards':shards,
            'fileSelection':'Actual qa-campaign-cpu-part.mjs policy: every tests/*.test.js except lab-tower*'}

def main(args):
    source=args.source.resolve();root=args.input.resolve();provider=root/'provider';evidence=root/'evidence'
    require(re.fullmatch(r'[a-f0-9]{40}',args.commit),'Exact source commit required')
    require(args.run>0 and args.attempt>0,'Positive actual run/attempt required')
    require(git(source,'rev-parse','HEAD')==args.commit,'Source checkout HEAD differs')
    require(not git(source,'status','--porcelain','--untracked-files=no'),'Tracked Source/controller modifications')
    require(not git(source,'status','--porcelain','--untracked-files=all','--','src','public','index.html','vite.config.js','package.json','package-lock.json'),'Untracked production Source inputs')
    tree=git(source,'rev-parse','HEAD^{tree}');parents=re.findall(r'^parent ([a-f0-9]{40})$',git(source,'cat-file','commit',args.commit),re.M)
    run=load(provider/'run.json');meta=load(provider/'commit.json');workflow,workflow_unavailable,workflow_provenance,workflow_file=workflow_record(source,provider,run,args.commit)
    jobs,job_pages=pages(provider/'jobs','jobs');artifacts,artifact_pages=pages(provider/'artifacts','artifacts');roles=workflow_roles(source)
    mapping=validate_provider(run,jobs,artifacts,meta,workflow,args.commit,tree,parents,args.run,args.attempt,roles,workflow_unavailable=workflow_unavailable)
    logs,log_pins=validate_logs(provider,jobs,artifacts,mapping,args.commit,args.run)
    require({file.name for file in (root/'archives').iterdir()}=={str(artifact['id'])+'.zip' for artifact in artifacts},'Missing/extra provider ZIP')
    require({file.name for file in evidence.iterdir()}=={artifact['name'] for artifact in artifacts},'Missing/extra extracted artifact')
    archives=[verified_zip(root/'archives'/f"{artifact['id']}.zip",evidence/artifact['name'],artifact) for artifact in sorted(artifacts,key=lambda value:value['name'])]
    cpu=audit_cpu(source,evidence,args.commit,logs)
    context={'source':str(source),'evidence':str(evidence),'commit':args.commit,'tree':tree,'runId':args.run,'runAttempt':args.attempt}
    with tempfile.TemporaryDirectory(prefix='v63-production-audit-') as temporary:
        production=pathlib.Path(temporary)
        extract_production(evidence/'v63-yandex/brainrot-portal-v63-yandex.zip',production)
        context['productionDirectory']=str(production)
        process=subprocess.run(['node',str(pathlib.Path(__file__).with_name('audit-evidence.mjs'))],input=json.dumps(context),text=True,capture_output=True)
    require(process.returncode==0,'Current immutable Node validators failed:\n'+process.stderr[-12000:])
    checks=json.loads(process.stdout);require(checks['pass'] is True,'Evidence validators did not pass')
    # Bind successful route/recording completion markers to each actual job log.
    for part,levels in GROUPS.items():
        ordinary_log=logs[f'ordinary ({part}, '+','.join(map(str,levels))+')']
        native_log=logs[f'native ({part}, '+','.join(map(str,levels))+')']
        platform_log=logs[f'checker-platform ({part}, '+','.join(map(str,levels))+')']
        for level in levels:
            require(re.search(r'ORDINARY PASS \d+ stable '+str(level)+r' ',ordinary_log),'Ordinary completion absent from actual producer stdout')
            require(f'ROUTE PASS room {level}: ' in native_log and f'PASS WebGL route room {level}: ' in native_log,'Consumer route/capture completion absent from actual producer stdout')
            require(f'YANDEX_PLATFORM_ROUTE_COMPLETE {level} {args.commit} {args.run} ' in platform_log,'Platform completion absent from actual producer stdout')
    for level in GROUPS['optics']:
        require(f'PASS WebGL overview room {level}: ' in logs['architecture'],'Architecture completion absent from actual producer stdout')
    for row in checks['opticsNative']['rooms']:
        require(f"OPTICS_NATIVE_DIAGNOSTIC_COMPLETE {row['room']} {args.commit} " in logs[f"films ({row['room']})"] and row['videoSha256'] in logs[f"films ({row['room']})"],'Movie completion/hash absent from actual producer stdout')
    files=checks.pop('candidateFiles');provider_files=[provider/'run.json',provider/'commit.json',workflow_file]+job_pages+artifact_pages
    result={'schemaVersion':1,'kind':'draft-v63-source-evidence-audit','generatedAt':dt.datetime.now(dt.timezone.utc).isoformat(),
            'pass':True,'sourceAccepted':False,'publicationAccepted':False,'sourceCommit':args.commit,'sourceTree':tree,
            'run':args.run,'runAttempt':args.attempt,'sourceReview':{'runId':args.run,'runAttempt':args.attempt},'version':VERSION,
            'candidateFiles':files,'candidateBytes':sum(row['bytes'] for row in files),'candidateInventorySha256':sha(encoded(files)),
            'checks':{**checks,'cpu':cpu,'provider':{'jobs':len(jobs),'artifacts':len(artifacts),'attempt':args.attempt,**workflow_provenance}},
            'sourceArtifacts':archives,'sourceLogs':log_pins,
            'sourceProvider':[{'path':file.relative_to(root).as_posix(),'bytes':file.stat().st_size,'sha256':file_sha(file)} for file in provider_files],
            'limitations':['Draft internal audit only; Root must review actual provider bytes before issuing any acceptance.',
               'Software WebGL scripted routes do not establish human discovery, physical-device performance, live ad delivery or moderation.',
               'Ordinary/native51 route counters exclude the historical legacy fixture reset. Only specialized native movies retain their stricter complete-start proofs.',
               'Checker WARN and NOT VERIFIED remain observed statuses; no fake PASS verdicts.']}
    require(not args.output.exists(),'Use a fresh audit output path; never overwrite an acceptance receipt')
    args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'pass':True,'sourceAccepted':False,'publicationAccepted':False,'jobs':len(jobs),'artifacts':len(artifacts),'cpuTests':cpu['tests'],'output':str(args.output)}))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    for name in ['source','input','output']:
        parser.add_argument('--'+name,type=pathlib.Path,required=True)
    parser.add_argument('--commit',required=True);parser.add_argument('--run',type=int,required=True);parser.add_argument('--attempt',type=int,required=True)
    try:
        main(parser.parse_args())
    except (AssertionError,KeyError,ValueError,zipfile.BadZipFile) as error:
        print('SOURCE AUDIT REJECTED: '+str(error),file=sys.stderr);sys.exit(1)
