import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync,spawnSync} from 'node:child_process';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createHash} from 'node:crypto';
import {GROUPS,SEQUENCE,sha,digestRows,inventory,assertFrozenCheckout,assertSourcePackage,assertOrdinaryReport,assertNativeReport,assertCpuReport,
 assertShortcutReport,assertCastleShortcutReport,assertStorageReport,assertOverviewReport,assertMenuReport,assertAnimationReport,assertCastleInteriorReport,assertChapterAudioReport,assertNativeCameraReport,assertYandexBrowserReport} from './lib/campaign-v56-proof.mjs';
import {assertYandexPackage} from './lib/campaign-yandex-v56-proof.mjs';
import {validateExactR5Packet,validateExactR5TransportAcceptance} from './lib/campaign-v56-public-proof.mjs';

export const REPOSITORY='amazin20/brainrot-portal';
export const SOURCE_WORKFLOW='.github/workflows/campaign-polish-review.yml';
export const SOURCE_ARTIFACT_NAMES=Object.freeze(['campaign-polish-dist','campaign-polish-yandex',...Array.from({length:6},(_,i)=>'campaign-polish-cpu-'+i),
 ...Object.keys(GROUPS).map(part=>'campaign-polish-ordinary-'+part),...Object.keys(GROUPS).map(part=>'campaign-polish-native-'+part),
 'campaign-polish-shortcuts-early','campaign-polish-shortcuts-late','campaign-polish-castle-shortcuts','campaign-polish-presentation','campaign-polish-storage-isolation'].sort());
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const write=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');};
const hex=(value,length)=>assert.match(value||'',new RegExp('^[a-f0-9]{'+length+'}$'));
const integer=value=>assert.ok(Number.isSafeInteger(value)&&value>0);
export function normalizeJob(job){return Object.fromEntries(['id','name','status','conclusion','run_id','run_attempt','started_at','completed_at'].map(key=>[key,job[key]]).concat([
 ['steps',job.steps.map(step=>Object.fromEntries(['number','name','status','conclusion','started_at','completed_at'].map(key=>[key,step[key]])))]]));}
export function normalizeArtifact(artifact,jobId){return Object.fromEntries(['id','name','size_in_bytes','digest','expired','created_at','updated_at','expires_at'].map(key=>[key,artifact[key]]).concat([
 ['workflow_run',Object.fromEntries(['id','repository_id','head_repository_id','head_branch','head_sha'].map(key=>[key,artifact.workflow_run[key]]))],['jobId',jobId]]));}
export function sourceJobName(artifactName){
 const label=artifactName.replace(/^campaign-polish-/,'');if(['dist','yandex','presentation','storage-isolation','castle-shortcuts'].includes(label))return ['dist','yandex'].includes(label)?'build':label;
 const cpu=label.match(/^cpu-(\d)$/);if(cpu)return 'cpu ('+cpu[1]+')';
 const group=label.match(/^(ordinary|native)-(\w+)$/);if(group)return group[1]+' ('+group[2]+', '+GROUPS[group[2]].join(',')+')';
 if(label==='shortcuts-early')return 'shortcuts (early, 1-25)';if(label==='shortcuts-late')return 'shortcuts (late, 26-40,42-51)';throw Error('Unknown SOURCE artifact');
}
export function assertSourceProvider(provider,spec){
 const {run,gitCommit,jobs,artifacts}=provider;assert.equal(run.id,spec.sourceReview.runId);assert.equal(run.run_attempt,spec.sourceReview.runAttempt);
 assert.equal(run.head_sha,spec.sourceCommit);assert.equal(run.head_branch,spec.sourceBranch);assert.equal(run.path,spec.sourceWorkflow);assert.equal(run.event,'push');
 assert.equal(run.repository.full_name,REPOSITORY);assert.equal(run.status,'completed');assert.equal(run.conclusion,'success');
 assert.equal(gitCommit.sha,spec.sourceCommit);assert.equal(gitCommit.tree.sha,spec.sourceTree);assert.deepEqual(gitCommit.parents.map(p=>p.sha),[spec.sourceParent]);
 assert.equal(jobs.length,24);assert.equal(new Set(jobs.map(job=>job.id)).size,24);
 assert.deepEqual(jobs.map(job=>job.name).sort(),[...new Set(SOURCE_ARTIFACT_NAMES.map(sourceJobName))].sort());
 for(const job of jobs){assert.equal(job.run_id,run.id);assert.equal(job.run_attempt,run.run_attempt);assert.equal(job.head_sha,spec.sourceCommit);
  assert.equal(job.status,'completed');assert.equal(job.conclusion,'success');assert.ok(Date.parse(job.completed_at)>=Date.parse(job.started_at));
  assert.equal(job.steps.filter(step=>step.name==='Run actions/upload-artifact@v4'&&step.conclusion==='success').length,1);
 }
 assert.equal(artifacts.length,25);assert.equal(new Set(artifacts.map(artifact=>artifact.id)).size,25);assert.deepEqual(artifacts.map(a=>a.name).sort(),SOURCE_ARTIFACT_NAMES);
 let artifactBytes=0;const normalizedArtifacts=[];
 for(const artifact of artifacts){integer(artifact.id);integer(artifact.size_in_bytes);artifactBytes+=artifact.size_in_bytes;assert.ok(artifactBytes<=spec.limits.privateProofBytes);
  assert.match(artifact.digest||'',/^sha256:[a-f0-9]{64}$/);assert.equal(artifact.expired,false);assert.equal(artifact.workflow_run.id,run.id);
  assert.equal(artifact.workflow_run.head_sha,spec.sourceCommit);assert.equal(artifact.workflow_run.head_branch,spec.sourceBranch);
  assert.equal(artifact.workflow_run.repository_id,1354625251);assert.equal(artifact.workflow_run.head_repository_id,1354625251);
  const job=jobs.find(job=>job.name===sourceJobName(artifact.name));assert.ok(job);const upload=job.steps.find(step=>step.name===(artifact.name==='campaign-polish-yandex'?'Upload exact checked Yandex package':'Run actions/upload-artifact@v4'));
  const created=Date.parse(artifact.created_at);assert.ok(created>=Date.parse(upload.started_at)-2000&&created<=Date.parse(upload.completed_at)+2000,'Artifact is not from the actual successful job upload');
  normalizedArtifacts.push(normalizeArtifact(artifact,job.id));
 }
 return {jobs:jobs.map(normalizeJob).sort((a,b)=>a.id-b.id),artifacts:normalizedArtifacts.sort((a,b)=>a.id-b.id)};
}
export function assertFrozenPins(spec){
 assert.equal(spec.frozen,true);assert.equal(spec.sourceAccepted,true);assert.equal(spec.publicationAccepted,false);assert.equal(spec.repository,REPOSITORY);
 assert.equal(spec.sourceCommit,'a3c81ee59a9b2cbf1b23254857dd8c2a6f6b3c38');assert.equal(spec.sourceBranch,'upgrade/campaign-polish-20261013');assert.equal(spec.sourceWorkflow,SOURCE_WORKFLOW);
 for(const key of ['sourceCommit','sourceTree','sourceParent','controllerParent','modelOriginCommit'])hex(spec[key],40);
 assert.deepEqual(spec.sourceReview,{runId:38451783602,runAttempt:1});assert.equal(spec.namespace,'campaign-v56/');assert.equal(spec.publicURL,'https://amazin20.github.io/brainrot-portal/campaign-v56/');
 assert.equal(spec.sourceJobs.length,24);assert.equal(spec.sourceArtifacts.length,25);assert.equal(spec.baseline.publicationAccepted,true);assert.equal(spec.baseline.files,2038);assert.equal(spec.baseline.bytes,640738913);assert.equal(spec.baseline.inventorySha256,'3cd59f86100c7b9e87ebaf1b3b4b7d81aedaf66d2044895b5b9afa4367264f1e');
 const accepted=JSON.parse(checkedPinnedFile(spec.baseline.rootAudit));assert.equal(accepted.publicationAccepted,true);assert.equal(accepted.publicBytes.siteInventorySha256,spec.baseline.inventorySha256);
 const source=JSON.parse(checkedPinnedFile(spec.sourceRootAudit));assert.equal(source.sourceAccepted,true);assert.equal(source.publicationAccepted,false);for(const key of ['sourceCommit','sourceTree','sourceParent'])assert.deepEqual(source[key],spec[key]);assert.deepEqual({runId:Number(source.run),runAttempt:Number(source.runAttempt)},spec.sourceReview);return spec;
}
export function pins(){return assertFrozenPins(read('tools/campaign-v56-release.json'));}
export function current(){
 assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.GITHUB_REPOSITORY,REPOSITORY);assert.equal(process.env.GITHUB_REF,'refs/heads/main');assert.equal(process.env.GITHUB_EVENT_NAME,'push');
 const value={publisherCommit:process.env.GITHUB_SHA,publicationRun:Number(process.env.GITHUB_RUN_ID),publicationRunAttempt:Number(process.env.GITHUB_RUN_ATTEMPT)};
 hex(value.publisherCommit,40);integer(value.publicationRun);assert.equal(value.publicationRunAttempt,1,'Only a reviewed first-attempt publication is allowed');assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),value.publisherCommit);assert.equal(execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}),'');return value;
}
export async function request(resource,{binary=false}={}){
 assert.ok(process.env.GITHUB_TOKEN);const response=await fetch('https://api.github.com/repos/'+REPOSITORY+'/'+resource,{headers:{Authorization:'Bearer '+process.env.GITHUB_TOKEN,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(60000)});
 assert.ok(response.ok,'Actual provider GET failed: '+resource+' '+response.status);return binary?response:response.json();
}
export async function all(resource,key){const rows=[];for(let page=1;page<=50;page++){const d=await request(resource+(resource.includes('?')?'&':'?')+'per_page=100&page='+page),batch=key?d[key]:d;assert.ok(Array.isArray(batch));rows.push(...batch);if(batch.length<100)return rows;}throw Error('Provider pagination exceeded bound');}
export function assertLatestDeployment(rows,baseline,now,{phase='preparation',jobs=[]}={}){
 const prefix='https://github.com/'+REPOSITORY+'/actions/runs/'+now.publicationRun;
 const own=row=>row.sha===now.publisherCommit&&(row.logUrl===prefix||row.logUrl?.startsWith(prefix+'/'));
 const sorted=rows.slice().sort((a,b)=>b.id-a.id);assert.ok(sorted.length);
 if(['published','final'].includes(phase)){
  const latest=sorted[0],deploy=jobs.find(job=>job.name==='deploy');assert.ok(deploy);assert.equal(own(latest),true,'Latest deployment is not the exact current publisher/run');
  assert.equal(latest.logUrl,prefix+'/job/'+deploy.id);assert.ok(['in_progress','success'].includes(latest.state));
  assert.equal(deploy.steps.filter(step=>step.name==='Run actions/deploy-pages@v4'&&step.conclusion==='success').length,1,'The actual single deployment step has not succeeded');return latest;
 }
 for(const row of sorted){if(own(row)){assert.ok(['queued','pending','in_progress'].includes(row.state),'A prior current-run deployment cannot be published again');continue;}
  assert.equal(row.id,baseline.latestOriginalDeployment.id,'Unknown newer deployment blocks the exact baseline lease');assert.equal(row.sha,baseline.publisher);assert.equal(row.logUrl,baseline.latestOriginalDeployment.logUrl);assert.ok(['success','failure','error','inactive'].includes(row.state));return row;}
 throw Error('No exact independently accepted baseline deployment');
}
function checkedPinnedFile(pin){const bytes=fs.readFileSync(pin.path);assert.equal(bytes.length,pin.bytes);assert.equal(sha(bytes),pin.sha256);return bytes;}
async function actualBaselineProvider(spec){
 const c=spec.baseline.transportAcceptance,r=c.rescue;assert.ok(c&&r);
 const [run,jobs,artifact,gitCommit,rescueRun,rescueJobs,rescueArtifacts,rescueGit]=await Promise.all([
  request('actions/runs/'+c.publicationRun),all('actions/runs/'+c.publicationRun+'/attempts/1/jobs','jobs'),request('actions/artifacts/'+c.artifact.id),request('git/commits/'+c.publisher),
  request('actions/runs/'+r.run.id),all('actions/runs/'+r.run.id+'/attempts/1/jobs','jobs'),all('actions/runs/'+r.run.id+'/artifacts','artifacts'),request('git/commits/'+r.run.head_sha)]);
 const fetchLogs=async pins=>{const result=[];for(const pin of pins){const response=await request('actions/jobs/'+pin.jobId+'/logs',{binary:true});const data=Buffer.from(await response.arrayBuffer());assert.equal(data.length,pin.bytes);assert.equal(sha(data),pin.sha256);result.push({jobId:pin.jobId,data});}return result;};
 const originalLogs=await fetchLogs([{jobId:c.publicLog.id,bytes:c.publicLog.bytes,sha256:c.publicLog.sha256},{jobId:c.assemblyLog.id,bytes:c.assemblyLog.bytes,sha256:c.assemblyLog.sha256}]);
 const rescueLogs=await fetchLogs(r.logs);return {original:{run,jobs,artifact,gitCommit,logs:originalLogs},rescue:{run:rescueRun,jobs:rescueJobs,artifacts:rescueArtifacts,gitCommit:rescueGit,logs:rescueLogs}};
}
async function inspectedDeployments(){const rows=[];for(const d of (await all('deployments?environment=github-pages')).sort((a,b)=>b.id-a.id)){
 const statuses=await all('deployments/'+d.id+'/statuses'),latest=statuses.sort((a,b)=>b.id-a.id)[0];rows.push({id:d.id,sha:d.sha,state:latest?.state,logUrl:latest?.log_url,statusId:latest?.id});}return rows;}
export async function guard(phase){
 assert.ok(['preparation','deploy','published','final'].includes(phase));const spec=pins(),now=current();
 const [main,sourceRef,sourceRun,sourceGit,sourceJobs,sourceArtifacts,publisherGit,publicRun,baselineRun,baselineJobs,baselineArtifacts]=await Promise.all([
 request('git/ref/heads/main'),request('git/ref/heads/'+spec.sourceBranch),request('actions/runs/'+spec.sourceReview.runId),request('git/commits/'+spec.sourceCommit),all('actions/runs/'+spec.sourceReview.runId+'/attempts/1/jobs','jobs'),all('actions/runs/'+spec.sourceReview.runId+'/artifacts','artifacts'),request('git/commits/'+now.publisherCommit),request('actions/runs/'+now.publicationRun),request('actions/runs/'+spec.baseline.readonlyRun),all('actions/runs/'+spec.baseline.readonlyRun+'/attempts/1/jobs','jobs'),all('actions/runs/'+spec.baseline.readonlyRun+'/artifacts','artifacts')]);
 assert.equal(main.object.sha,now.publisherCommit);assert.equal(sourceRef.object.sha,spec.sourceCommit);assert.deepEqual(publisherGit.parents.map(p=>p.sha),[spec.controllerParent]);assert.equal(publicRun.head_sha,now.publisherCommit);assert.equal(publicRun.path,'.github/workflows/publish-campaign-v56.yml');
 const normalized=assertSourceProvider({run:sourceRun,gitCommit:sourceGit,jobs:sourceJobs,artifacts:sourceArtifacts},spec);assert.deepEqual(normalized.jobs,spec.sourceJobs);assert.deepEqual(normalized.artifacts,spec.sourceArtifacts);
 assert.equal(baselineRun.status,'completed');assert.equal(baselineRun.conclusion,'success');assert.equal(baselineRun.head_sha,spec.baseline.readonlyCommit);assert.equal(baselineJobs.length,1);assert.ok(baselineJobs.every(job=>job.status==='completed'&&job.conclusion==='success'));
 assert.deepEqual(baselineArtifacts.find(row=>row.id===spec.baseline.verificationArtifact.id),spec.baseline.verificationArtifact);
 const publisherPaths=fs.readdirSync('.github/workflows').filter(file=>/\.ya?ml$/.test(file)&&/actions\/deploy-pages|pages:\s*write/.test(fs.readFileSync('.github/workflows/'+file,'utf8'))).map(file=>'.github/workflows/'+file);
 for(const status of ['queued','in_progress','waiting'])for(const run of await all('actions/runs?status='+status,'workflow_runs'))if(run.id!==now.publicationRun&&publisherPaths.includes(run.path))throw Error('Other active Pages workflow '+run.id);
 if(phase==='preparation')for(const job of sourceJobs){const response=await request('actions/jobs/'+job.id+'/logs',{binary:true}),bytes=Buffer.from(await response.arrayBuffer());assert.ok(bytes.length>0&&bytes.length<20_000_000);fs.mkdirSync('proof/job-logs/source',{recursive:true});fs.writeFileSync('proof/job-logs/source/'+job.id+'.log',bytes);}
 const [latestMain,latestSource,rows,freshJobs]=await Promise.all([request('git/ref/heads/main'),request('git/ref/heads/'+spec.sourceBranch),inspectedDeployments(),all('actions/runs/'+now.publicationRun+'/attempts/1/jobs','jobs')]);assert.equal(latestMain.object.sha,now.publisherCommit);assert.equal(latestSource.object.sha,spec.sourceCommit);const accepted=assertLatestDeployment(rows,spec.baseline,now,{phase,jobs:freshJobs});
 write('proof/provider/deployments-'+phase+'.json',{publicationAccepted:false,...now,rows});write('proof/provider/source-run.json',sourceRun);write('proof/provider/source-git-commit.json',sourceGit);write('proof/provider/source-jobs.json',sourceJobs);write('proof/provider/source-artifacts.json',sourceArtifacts);write('proof/provider/public-run-'+phase+'.json',publicRun);write('proof/provider/public-jobs-'+phase+'.json',freshJobs);
 const baselineAcceptance={pass:true,publicationAccepted:true,readonlyRun:baselineRun.id,rootAudit:spec.baseline.rootAudit,inventorySha256:spec.baseline.inventorySha256};write('proof/baseline-independent-acceptance-'+phase+'.json',baselineAcceptance);write('proof/guard-'+phase+'.json',{pass:true,publicationAccepted:false,...now,sourceCommit:spec.sourceCommit,sourceTree:spec.sourceTree,sourceReview:spec.sourceReview,actualSourceJobs:normalized.jobs,actualSourceArtifacts:normalized.artifacts,acceptedDeployment:accepted,baselineIndependentAcceptance:baselineAcceptance});
}
export async function downloadOne(artifact,filename,maximum){
 const response=await request('actions/artifacts/'+artifact.id+'/zip',{binary:true});fs.mkdirSync(path.dirname(filename),{recursive:true});let bytes=0;const hash=createHash('sha256');
 const temporary=filename+'.partial';try{const stream=Readable.fromWeb(response.body),bounded=new Transform({transform(chunk,_encoding,callback){try{bytes+=chunk.length;assert.ok(bytes<=maximum);hash.update(chunk);callback(null,chunk);}catch(error){callback(error);}}});await pipeline(stream,bounded,fs.createWriteStream(temporary,{flags:'wx'}));
  assert.equal(bytes,artifact.size_in_bytes);assert.equal('sha256:'+hash.digest('hex'),artifact.digest);fs.renameSync(temporary,filename);
 }finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
}
async function download(){const spec=pins();const guardRecord=read('proof/guard-preparation.json');assert.equal(guardRecord.pass,true);assert.deepEqual(guardRecord.actualSourceArtifacts,spec.sourceArtifacts);
 for(const artifact of [...spec.sourceArtifacts,spec.baseline.verificationArtifact]){const filename='proof/downloads/'+artifact.id+'.zip';await downloadOne(artifact,filename,spec.limits.privateProofBytes);
  const output=artifact.id===spec.baseline.verificationArtifact.id?'proof/baseline-verification':'proof/review-artifacts/'+artifact.name;
  execFileSync('python3',['scripts/publish-campaign-v56.py','extract-zip','--zip',filename,'--output',output,'--expected-bytes',String(artifact.size_in_bytes),'--expected-sha256',artifact.digest.slice(7)],{stdio:'inherit'});
 }
}
export function imageChecker(root,receipts){return(filename,reported,dimensions)=>{
 const file=path.join(root,filename),raw=fs.readFileSync(file);const code="import json,sys\nfrom PIL import Image,ImageStat\np=Image.open(sys.argv[1]);p.load();p=p.convert('RGB');s=p.resize((64,36));print(json.dumps({'width':p.width,'height':p.height,'colors':len(s.getcolors(2305) or []),'maxChannelStd':max(ImageStat.Stat(s).stddev)}))";
 const pixels=JSON.parse(execFileSync(process.env.CODEX_PRIMARY_RUNTIME_PYTHON||'python3',['-c',code,file],{encoding:'utf8'}));assert.ok(pixels.width>=100&&pixels.height>=100&&pixels.colors>=4&&pixels.maxChannelStd>=1);
 if(reported?.pixels){for(const key of ['width','height','colors'])assert.equal(pixels[key],reported.pixels[key]);assert.ok(Math.abs(pixels.maxChannelStd-reported.pixels.maxChannelStd)<1e-9);}
 if(dimensions){assert.equal(pixels.width,dimensions.width);assert.equal(pixels.height,dimensions.height);}const receipt={file:filename,bytes:raw.length,sha256:sha(raw),pixels};receipts.push(receipt);return receipt;
};}
export function movieChecker(root){return(filename,expected)=>{
 const file=path.join(root,filename),probe=JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',file],{encoding:'utf8'}));assert.equal(probe.streams.length,1);assert.equal(path.resolve(probe.format.filename),path.resolve(file));probe.format.filename=filename;const stream=probe.streams[0];
 assert.equal(stream.codec_type,'video');assert.equal(stream.codec_name,'h264');assert.equal(stream.width,expected.width);assert.equal(stream.height,expected.height);assert.equal(Number(stream.nb_read_frames),expected.frames);assert.equal(stream.avg_frame_rate,expected.fps+'/1');assert.ok(Math.abs(Number(probe.format.duration)-expected.duration)<.001);
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-xerror','-i',file,'-f','null','-'],{stdio:['ignore','pipe','pipe'],maxBuffer:1024*1024});
 const statistics=execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-i',file,'-vf','scale=64:36,signalstats,metadata=mode=print:file=-','-f','null','-'],{encoding:'utf8',maxBuffer:4*1024*1024});
 const ranges=[...statistics.matchAll(/lavfi\.signalstats\.YMIN=([\d.]+)[\s\S]*?lavfi\.signalstats\.YMAX=([\d.]+)/g)].map(match=>Number(match[2])-Number(match[1]));assert.equal(ranges.length,expected.frames);assert.ok(ranges.every(range=>range>=12));
 const raw=fs.readFileSync(file);return {file:filename,bytes:raw.length,sha256:sha(raw),frames:expected.frames,fullyDecoded:true,minimumLumaRange:Math.min(...ranges),probe};
};}
export async function sourceAudit({spec,source='source',proof='proof',acceptance=true}={}){
 const provider={run:read(proof+'/provider/source-run.json'),gitCommit:read(proof+'/provider/source-git-commit.json'),jobs:read(proof+'/provider/source-jobs.json'),artifacts:read(proof+'/provider/source-artifacts.json')};
 provider.jobs=Array.isArray(provider.jobs)?provider.jobs:provider.jobs.jobs;provider.artifacts=Array.isArray(provider.artifacts)?provider.artifacts:provider.artifacts.artifacts;
 const actual=assertSourceProvider(provider,spec);if(spec.frozen){assert.deepEqual(actual.jobs,spec.sourceJobs);assert.deepEqual(actual.artifacts,spec.sourceArtifacts);}
 const artifact=name=>path.join(proof,'review-artifacts',name),artifactInventories=[];
 for(const row of actual.artifacts){const checked=JSON.parse(execFileSync('python3',['scripts/publish-campaign-v56.py','verify-extracted','--zip',proof+'/downloads/'+row.id+'.zip','--directory',artifact(row.name),'--expected-bytes',String(row.size_in_bytes),'--expected-sha256',row.digest.slice(7)],{encoding:'utf8',maxBuffer:10_000_000}));assert.equal(checked.pass,true);artifactInventories.push({artifactId:row.id,artifactName:row.name,...checked});}
 const packet=await assertSourcePackage(source,artifact('campaign-polish-dist'),spec),manifest=packet.manifest;
 const yandex=spec.namespace==='campaign-v56/'?assertYandexPackage({directory:artifact('campaign-polish-yandex'),source,spec,manifest}):undefined;
 const {assertCampaignBrowserState}=await import(pathToFileURL(path.resolve(source,'scripts/lib/campaign-browser-contract.mjs')));
 const {assertFoundation20Route}=await import(pathToFileURL(path.resolve(source,'scripts/lib/foundation20-native-proof.mjs')));
 const runtime=(observed,level)=>assertCampaignBrowserState(observed,level);const imageReceipts=[],sourceLogs=[],cpu=[],ordinary=[],native=[];
 const allFiles=fs.readdirSync(path.join(source,'tests')).filter(name=>name.endsWith('.test.js')&&!name.startsWith('lab-tower')).sort();
 assert.ok(allFiles.includes('lab-puzzle-progression50-early-pane.test.js'),'The actual seven-projectile Room50 regression is required');
 for(const job of actual.jobs){const raw=fs.readFileSync(proof+'/job-logs/source/'+job.id+'.log');assert.ok(raw.length>0&&raw.length<20_000_000);sourceLogs.push({jobId:job.id,bytes:raw.length,sha256:sha(raw)});}
 if(spec.sourceLogs?.length)assert.deepEqual(sourceLogs,spec.sourceLogs);
 for(let part=0;part<6;part++){const dir=artifact('campaign-polish-cpu-'+part),job=actual.jobs.find(job=>job.name==='cpu ('+part+')');cpu.push(assertCpuReport(read(dir+'/report.json'),fs.readFileSync(dir+'/full.tap','utf8'),fs.readFileSync(proof+'/job-logs/source/'+job.id+'.log','utf8'),{part,allFiles,sourceCommit:spec.sourceCommit}));}
 for(const [part,levels]of Object.entries(GROUPS)){ordinary.push({part,...assertOrdinaryReport(read(artifact('campaign-polish-ordinary-'+part)+'/report.json'),levels,manifest,spec.sourceCommit,{assertPhysical20:assertFoundation20Route})});
  const dir=artifact('campaign-polish-native-'+part);native.push({part,...assertNativeReport(read(dir+'/report.json'),levels,manifest,spec.sourceCommit,{assertRuntime:runtime,assertImage:imageChecker(dir,imageReceipts),assertPhysical20:assertFoundation20Route})});}
 const sourcePaths=execFileSync('git',['ls-tree','-r','--name-only',spec.sourceCommit,'src/game'],{cwd:source,encoding:'utf8'}).trim().split('\n').sort();
 const sources=Object.fromEntries(sourcePaths.map(file=>[file,sha(fs.readFileSync(path.join(source,file)))]));const harness=file=>sha(fs.readFileSync(path.join(source,'scripts',file)));
 const early=assertShortcutReport(read(artifact('campaign-polish-shortcuts-early')+'/report.json'),Array.from({length:25},(_,i)=>i+1),manifest,spec.sourceCommit,{sources,harnessSha256:harness('qa-campaign-shortcuts.mjs'),...(spec.namespace==='campaign-v56/'?{strict:true,cases:['empty-direct-sprint','held-direct-sprint','held-corner-jumps','early-release-finish-directed-shots','held-roof-chain']}:{})});
 const late=assertShortcutReport(read(artifact('campaign-polish-shortcuts-late')+'/report.json'),[...Array.from({length:15},(_,i)=>i+26),...GROUPS.fracture],manifest,spec.sourceCommit,{sources,harnessSha256:harness('qa-campaign-shortcuts.mjs'),...(spec.namespace==='campaign-v56/'?{strict:true,cases:['empty-direct-sprint','held-direct-sprint','held-corner-jumps','early-release-finish-directed-shots','held-roof-chain']}:{})});
 let targeted;
 if(spec.namespace==='campaign-v56/')targeted={room37:assertShortcutReport(read(artifact('campaign-polish-shortcuts-late')+'/room37-sidefeed.json'),[37],manifest,spec.sourceCommit,{sources,harnessSha256:harness('qa-campaign-shortcuts.mjs'),strict:true,cases:['magnetic-last-leg-hand-feed']}),room38:assertShortcutReport(read(artifact('campaign-polish-shortcuts-late')+'/room38-hoist.json'),[38],manifest,spec.sourceCommit,{sources,harnessSha256:harness('qa-campaign-shortcuts.mjs'),strict:true,cases:['freight-dispatch-running-board']})};
 const castle=assertCastleShortcutReport(read(artifact('campaign-polish-castle-shortcuts')+'/report.json'),manifest,spec.sourceCommit,{sources,harnessSha256:harness('qa-campaign-castle-shortcuts.mjs'),cases:['crown-high-gallery-locked-targeted-shots','crown-high-gallery-dropped-cargo-jamb-step','crown-cargo-slit-running-airdrop']});
 const presentation=artifact('campaign-polish-presentation');const menu=assertMenuReport(read(presentation+'/menu/report.json'),manifest,{assertImage:imageChecker(presentation+'/menu',imageReceipts)});
 const architecture=assertOverviewReport(read(presentation+'/architecture/report.json'),manifest,spec.sourceCommit,{assertRuntime:runtime,assertImage:imageChecker(presentation+'/architecture',imageReceipts),finalVisual:acceptance});
 const animation=assertAnimationReport(read(presentation+'/animation/report.json'),manifest,spec.sourceCommit,{assertRuntime:runtime,assertImage:imageChecker(presentation+'/animation',imageReceipts),assertMovie:movieChecker(presentation+'/animation'),finalVisual:acceptance});
 let castleInteriors,chapterAudio,nativeCamera;
 if(spec.namespace==='campaign-v56/'){const {SINGULARITY_ROOMS}=await import(pathToFileURL(path.resolve(source,'src/game/LabSingularityLayout.js')));castleInteriors=assertCastleInteriorReport(read(presentation+'/castle-interiors/report.json'),manifest,spec.sourceCommit,{rooms:SINGULARITY_ROOMS,assertImage:imageChecker(presentation+'/castle-interiors',imageReceipts)});chapterAudio=assertChapterAudioReport(read(presentation+'/chapter-audio/report.json'));const {CAMERA_PITCH_MIN,CAMERA_PITCH_MAX}=await import(pathToFileURL(path.resolve(source,'src/game/LabCamera.js')));nativeCamera=assertNativeCameraReport(read(presentation+'/camera-start/report.json'),manifest,spec.sourceCommit,{assertRuntime:runtime,assertImage:imageChecker(presentation+'/camera-start',imageReceipts),pitchMin:CAMERA_PITCH_MIN,pitchMax:CAMERA_PITCH_MAX});}
 const yandexBrowser=spec.namespace==='campaign-v56/'?assertYandexBrowserReport(read(artifact('campaign-polish-storage-isolation')+'/yandex-browser/sdk-production-proof.json'),{assertImage:imageChecker(artifact('campaign-polish-storage-isolation')+'/yandex-browser',imageReceipts)}):undefined;
 const storage=assertStorageReport(read(artifact('campaign-polish-storage-isolation')+'/report.json'),manifest,spec.sourceCommit);
 assertFrozenCheckout(source,spec);assert.deepEqual(inventory(artifact('campaign-polish-dist')),packet.files);
 for(const row of actual.artifacts){const sealed=JSON.parse(execFileSync('python3',['scripts/publish-campaign-v56.py','verify-extracted','--zip',proof+'/downloads/'+row.id+'.zip','--directory',artifact(row.name),'--expected-bytes',String(row.size_in_bytes),'--expected-sha256',row.digest.slice(7)],{encoding:'utf8',maxBuffer:10_000_000}));assert.deepEqual(sealed,artifactInventories.find(item=>item.artifactId===row.id&&item.artifactName===row.name)?Object.fromEntries(Object.entries(artifactInventories.find(item=>item.artifactId===row.id)).filter(([key])=>!['artifactId','artifactName'].includes(key))):null);}
 for(const log of sourceLogs){const raw=fs.readFileSync(proof+'/job-logs/source/'+log.jobId+'.log');assert.equal(raw.length,log.bytes);assert.equal(sha(raw),log.sha256);}
 const binding={kind:acceptance?'whole-fresh-campaign-v56-SOURCE-acceptance':'whole-fresh-campaign-v56-SOURCE-diagnostic',pass:true,automatedSourceContractAccepted:acceptance,sourceAccepted:acceptance&&spec.frozen===true&&spec.sourceAccepted===true,publicationAccepted:false,sourceCommit:spec.sourceCommit,sourceTree:spec.sourceTree,sourceParent:spec.sourceParent,sourceReview:spec.sourceReview,
  ...(yandex?{yandexPackage:yandex}:{}),candidateFiles:packet.files,candidateBytes:packet.bytes,candidateInventorySha256:packet.inventorySha256,actualSourceJobs:actual.jobs,actualSourceArtifacts:actual.artifacts,actualSourceLogs:sourceLogs,artifactInventories,
  cpu,ordinary,native,finiteShortcutAudit:{early,late,...(targeted?{targeted}:{}),castle},presentation:{menu,architecture,animation,...(castleInteriors?{castleInteriors,chapterAudio,nativeCamera}:{})},storage,...(yandexBrowser?{yandexBrowser}:{}),actualVisualMembers:imageReceipts,
  limitations:[spec.namespace==='campaign-v56/'?'All250 default ordinary shortcut probes executed with no setup or attack errors; this finite suite does not prove absence of every shortcut.':'Finite shortcut outcomes retain every unproven setup/error case.','Native routes provide51 finished frames, not51 route movies.','Software WebGL provides no human playtest or hardware/device benchmark.']};
 write(proof+'/source-binding.json',binding);return binding;
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 const [command,arg]=process.argv.slice(2);if(command==='guard')await guard(arg||'preparation');else if(command==='download')await download();
 else if(command==='verify-source')await sourceAudit({spec:pins()});else if(command==='audit-source-preparation'){const spec=read(process.env.CAMPAIGN_SPEC||'tools/campaign-v56-release.json');await sourceAudit({spec,source:process.env.SOURCE_DIR||'source',proof:process.env.PROOF_DIR||'proof',acceptance:process.env.DIAGNOSTIC_ONLY!=='1'});}
 else{const{dispatchPublic}=await import('./publish-campaign-v56-run.mjs');await dispatchPublic(command,arg,{pins,current,request,all,downloadOne,imageChecker,movieChecker,guard});}
}

