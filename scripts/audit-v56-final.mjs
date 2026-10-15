import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
export const PINS=JSON.parse(fs.readFileSync(path.join(root,'tools/v56-final-audit-pins.json')));
const read=file=>JSON.parse(fs.readFileSync(file));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const write=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');};
const git=(directory,...args)=>execFileSync('git',args,{cwd:directory,encoding:'utf8'}).trim();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const artifactFields=['id','name','size_in_bytes','digest','expired','workflow_run'];
export function assertArtifact(actual,pin){
 for(const key of artifactFields){
  if(key==='workflow_run'){for(const field of ['id','head_sha','head_branch','repository_id','head_repository_id'])assert.deepEqual(actual?.workflow_run?.[field],pin.workflow_run[field]);}
  else assert.deepEqual(actual?.[key],pin[key]);
 }assert.equal(actual.expired,false);
}
export function assertTerminal(run,jobs,log,pins=PINS){
 assert.equal(run.id,pins.publicationRun);assert.equal(run.head_sha,pins.publisherCommit);assert.equal(run.head_branch,'main');assert.equal(run.event,'push');assert.equal(run.run_attempt,1);assert.equal(run.path,'.github/workflows/publish-campaign-v56.yml');assert.equal(run.status,'completed');assert.equal(run.conclusion,'failure');
 assert.equal(jobs.length,11);assert.equal(new Set(jobs.map(job=>job.id)).size,11);
 const fields=['id','name','run_id','head_sha','run_attempt','status','conclusion'];const project=rows=>rows.map(job=>Object.fromEntries(fields.map(key=>[key,job[key]]).concat([['steps',job.steps.map(step=>Object.fromEntries(['number','name','status','conclusion'].map(key=>[key,step[key]])))]]))).sort((a,b)=>a.id-b.id);assert.deepEqual(project(jobs),project(pins.originalJobs));
 for(const job of jobs){assert.equal(job.run_id,run.id);assert.equal(job.head_sha,run.head_sha);assert.equal(job.run_attempt,1);assert.equal(job.status,'completed');assert.equal(job.conclusion,job.name==='verify'?'failure':'success');}
 const verifier=jobs.find(job=>job.name==='verify');assert.equal(verifier.id,pins.verifierJobId);
 assert.deepEqual(verifier.steps.filter(step=>step.conclusion==='failure').map(step=>[step.number,step.name]),[[9,'Verify all11 actual jobs and all8 complete original PUBLIC capture packets']]);
 assert.ok(verifier.steps.some(step=>step.number===10&&step.name==='Run actions/upload-artifact@v4'&&step.conclusion==='success'));
 assert.equal(log.length,pins.originalVerifierLog.bytes);assert.equal(sha(log),pins.originalVerifierLog.sha256);
 const text=log.toString('utf8');assert.match(text,/TypeError: fetch failed/);assert.match(text,/UND_ERR_SOCKET/);assert.match(text,/at async Object\.guard/);assert.match(text,/at async aggregate/);assert.match(text,/"checked": 2119/);
 return {originalCIConclusion:'failure',successfulProducerJobs:10,failedVerifierJob:verifier.id,failedStep:9,class:'socket-transport-after-complete-semantic-and-HTTP-checks',logBytes:log.length,logSha256:sha(log)};
}
export function assertArchived(run,jobs,pins=PINS){
 assert.equal(run.status,'in_progress');assert.equal(run.conclusion,null);assert.equal(run.id,pins.publicationRun);assert.equal(run.head_sha,pins.publisherCommit);assert.equal(run.run_attempt,1);assert.equal(run.head_branch,'main');assert.equal(run.event,'push');assert.equal(run.path,'.github/workflows/publish-campaign-v56.yml');
 const identity=rows=>rows.map(job=>[job.id,job.name,job.run_id,job.head_sha,job.run_attempt]).sort((a,b)=>a[0]-b[0]);assert.deepEqual(identity(jobs),identity(pins.originalJobs));for(const job of jobs)if(job.name!=='verify'){assert.equal(job.status,'completed');assert.equal(job.conclusion,'success');}
 assert.equal(jobs.find(job=>job.name==='verify')?.status,'in_progress');assert.equal(jobs.find(job=>job.name==='verify')?.conclusion,null);
}
export function assertHTTP(report,pins=PINS){
 assert.equal(report.pass,true);assert.equal(report.sourceAccepted,true);assert.equal(report.publicationAccepted,false);assert.equal(report.sourceCommit,pins.sourceCommit);assert.equal(report.mainSiteUnchanged,true);assert.equal(report.checkedFilesSha256,pins.siteInventorySha256);assert.equal(report.phase,'published');assert.equal(report.publicationRun,pins.publicationRun);assert.equal(report.publicationRunAttempt,1);assert.equal(report.publisherCommit,pins.publisherCommit);assert.equal(report.checked,pins.siteFiles);assert.equal(report.bytes,pins.siteBytes);assert.equal(report.siteFilesSha256,pins.siteInventorySha256);
}
async function response(resource,{binary=false,maximum=25000000}={}){
 assert.ok(process.env.GITHUB_TOKEN,'Actual read-only GitHub token required');
 for(let attempt=0;attempt<5;attempt++){
  try{const r=await fetch('https://api.github.com/repos/'+PINS.repository+'/'+resource,{headers:{Authorization:'Bearer '+process.env.GITHUB_TOKEN,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(30000)});
   if([429,500,502,503,504].includes(r.status)&&attempt<4){await r.body?.cancel();await sleep(1000*2**attempt);continue;}
   assert.ok(r.ok,'GitHub GET '+resource+' '+r.status);if(!binary)return await r.json();const chunks=[];let size=0;const reader=r.body.getReader();try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;assert.ok(size<=maximum,'Binary GET exceeded its pinned byte bound');chunks.push(Buffer.from(value));}return Buffer.concat(chunks,size);}finally{await reader.cancel().catch(()=>{});}
  }catch(error){if(attempt===4||error instanceof assert.AssertionError)throw error;await sleep(1000*2**attempt);}
 }throw Error('Bounded GET retries exhausted');
}
async function all(resource,key){const rows=[];for(let page=1;page<=30;page++){const value=await response(resource+(resource.includes('?')?'&':'?')+'per_page=100&page='+page),batch=key?value[key]:value;assert.ok(Array.isArray(batch));rows.push(...batch);if(batch.length<100)return rows;}throw Error('Bounded API pagination exhausted');}
async function download(pin,filename){
 if(fs.existsSync(filename)){assert.equal(fs.statSync(filename).size,pin.size_in_bytes);const bytes=fs.readFileSync(filename);assert.equal(bytes.length,pin.size_in_bytes);assert.equal('sha256:'+sha(bytes),pin.digest);return;}
 const bytes=await response('actions/artifacts/'+pin.id+'/zip',{binary:true,maximum:pin.size_in_bytes});assert.ok(bytes.length<=100000000);assert.equal(bytes.length,pin.size_in_bytes);assert.equal('sha256:'+sha(bytes),pin.digest);fs.mkdirSync(path.dirname(filename),{recursive:true});fs.writeFileSync(filename,bytes,{flag:'wx'});
}
export async function loadFrozen(publisher){
 assert.equal(git(publisher,'rev-parse','HEAD'),PINS.publisherCommit);assert.equal(git(publisher,'rev-parse','HEAD^{tree}'),PINS.publisherTree);assert.equal(git(publisher,'status','--porcelain','--untracked-files=no'),'');
 for(const pin of Object.values(PINS.frozenModules))assert.equal(git(publisher,'hash-object',pin.path),pin.blob,'Frozen publisher module changed');
 const original=path.join(publisher,PINS.frozenModules.run.path),bytes=fs.readFileSync(original),copy=path.join(publisher,'scripts/audit-v56-frozen-replay.mjs');
 assert.equal(fs.existsSync(copy),false);fs.writeFileSync(copy,Buffer.concat([bytes,Buffer.from('\nexport {captureEnvelopes,verifiedZip};\n')]));
 const replay=await import(pathToFileURL(copy)),main=await import(pathToFileURL(path.join(publisher,PINS.frozenModules.main.path)));
 assert.deepEqual(fs.readFileSync(original),bytes);assert.equal(git(publisher,'status','--porcelain','--untracked-files=no'),'');return {replay,main,originalSha256:sha(bytes),replaySha256:sha(fs.readFileSync(copy))};
}
async function liveLease(spec,auditOrigin){
 const [main,source,run,jobs,artifacts,auditRun,auditJobs]=await Promise.all([response('git/ref/heads/main'),response('git/ref/heads/'+spec.sourceBranch),response('actions/runs/'+PINS.publicationRun),all('actions/runs/'+PINS.publicationRun+'/attempts/1/jobs','jobs'),all('actions/runs/'+PINS.publicationRun+'/artifacts','artifacts'),response('actions/runs/'+auditOrigin.runId),all('actions/runs/'+auditOrigin.runId+'/attempts/1/jobs','jobs')]);
 assert.equal(main.object.sha,PINS.publisherCommit,'Main changed; read-only audit may not accept a different release');assert.equal(source.object.sha,PINS.sourceCommit);assert.equal(auditRun.head_sha,auditOrigin.commit);assert.equal(auditRun.head_branch,PINS.branch);assert.equal(auditRun.path,PINS.workflow);assert.equal(auditRun.run_attempt,1);assert.equal(auditRun.event,'push');assert.equal(auditRun.status,'in_progress');assert.equal(auditJobs.length,1);assert.equal(auditJobs[0].name,'audit');assert.equal(auditJobs[0].status,'in_progress');assert.equal(auditJobs[0].run_attempt,1);assert.equal(auditJobs[0].head_sha,auditOrigin.commit);
 const auditGit=await response('git/commits/'+auditOrigin.commit);assert.deepEqual(auditGit.parents.map(row=>row.sha),[PINS.publisherCommit]);
 for(const pin of PINS.artifacts)assertArtifact(artifacts.find(row=>row.id===pin.id),pin);
 const deployments=(await all('deployments?environment=github-pages')).sort((a,b)=>b.id-a.id);assert.ok(deployments.length>0);const latest=deployments[0],statuses=(await all('deployments/'+latest.id+'/statuses')).sort((a,b)=>b.id-a.id),status=statuses[0],deployJob=jobs.find(job=>job.name==='deploy');
 assert.equal(latest.sha,PINS.publisherCommit);assert.equal(status.state,'success');assert.equal(status.log_url,'https://github.com/'+PINS.repository+'/actions/runs/'+PINS.publicationRun+'/job/'+deployJob.id);assert.ok(deployJob.steps.some(step=>step.name==='Run actions/deploy-pages@v4'&&step.conclusion==='success'));
 const workflowFiles=fs.readdirSync('.github/workflows').filter(name=>/\.ya?ml$/.test(name)&&/actions\/deploy-pages|pages:\s*write/.test(fs.readFileSync('.github/workflows/'+name,'utf8'))).map(name=>'.github/workflows/'+name);
 for(const state of ['queued','in_progress','waiting'])for(const active of await all('actions/runs?status='+state,'workflow_runs'))if(workflowFiles.includes(active.path))throw Error('An active publisher blocks read-only final acceptance: '+active.id);
 return {main:main.object.sha,source:source.object.sha,originalRun:run,originalJobs:jobs,originalArtifacts:artifacts,auditRun,auditJob:auditJobs[0],deployment:latest,status};
}
export async function replayInputs({publisher,partial,prepared,archives,run,jobs}){
 const frozen=await loadFrozen(publisher),{main,replay}=frozen;process.chdir(publisher);
 const spec=main.pins(),archivedRun=read(path.join(partial,'provider-run-before-final.json')),archivedJobs=read(path.join(partial,'provider-jobs-before-final.json'));
 assertArchived(archivedRun,archivedJobs);replay.assertPublicCohort(archivedRun,archivedJobs,{now:{publicationRun:PINS.publicationRun,publisherCommit:PINS.publisherCommit}});
 assert.equal(spec.sourceCommit,PINS.sourceCommit);assert.deepEqual(read(path.join(partial,'source-binding.json')),read(path.join(prepared,'source-binding.json')));assert.deepEqual(read(path.join(partial,'package-binding.json')),read(path.join(prepared,'package-binding.json')));assert.deepEqual(read(path.join(partial,'publication-manifest.json')),read(path.join(prepared,'publication-manifest.json')));
 const manifest=read(path.join(partial,'publication-manifest.json'));assert.equal(manifest.siteFiles.length,PINS.siteFiles);assert.equal(manifest.siteBytes,PINS.siteBytes);assert.equal(manifest.siteFilesSha256,PINS.siteInventorySha256);assertHTTP(read(path.join(partial,'public-final.json')));
 assert.equal(fs.existsSync('proof'),false);fs.cpSync(prepared,'proof',{recursive:true});
 const closure=read('proof/public-input-closure.json');assert.equal(closure.kind,'bounded-complete-campaign-v56-public-input-closure');assert.equal(closure.pass,true);assert.equal(closure.publicationAccepted,false);assert.equal(closure.maximumBytes,25000000);
 const lib=await import(pathToFileURL(path.join(publisher,'scripts/lib/campaign-v56-proof.mjs'))),preparedRows=lib.inventory('proof',{maximum:25000000}).filter(row=>row.path!=='public-input-closure.json');assert.deepEqual(preparedRows,closure.files);assert.equal(lib.digestRows(preparedRows),closure.inventorySha256);assert.equal(preparedRows.reduce((n,row)=>n+row.bytes,0),closure.bytes);assert.deepEqual(lib.inventory('proof/review-artifacts/campaign-polish-dist'),manifest.candidateFiles);
 const result=[];
 for(const role of replay.PUBLIC_ROLES){const pin=PINS.artifacts.find(row=>row.name==='campaign-v56-public-'+role+'-'+PINS.publicationRun+'-1'),job=jobs.find(row=>row.name===replay.roleInfo(role).name),folder=path.join(partial,'public-'+role);
  replay.assertProducerArtifact(pin,job,{publicationRun:PINS.publicationRun,publisherCommit:PINS.publisherCommit});replay.verifiedZip(path.join(archives,pin.name+'.zip'),folder,pin);
  const envelopes=await replay.captureEnvelopes({pins:()=>spec,imageChecker:main.imageChecker,movieChecker:main.movieChecker},role,{folder,run:archivedRun,job,origin:read(path.join(folder,'origin.json')),validate:true});result.push({role,artifact:pin,jobId:job.id,envelopes});
 }
 assert.equal(result.length,8);assert.equal(git(publisher,'status','--porcelain','--untracked-files=no'),'');assert.equal(git(path.join(publisher,'source'),'status','--porcelain','--untracked-files=no'),'');return {spec,manifest,roles:result,frozenModules:{originalSha256:frozen.originalSha256,replaySha256:frozen.replaySha256},archivedRunStatus:'in_progress',freshOriginalRunStatus:run.status,freshOriginalRunConclusion:run.conclusion};
}
async function main(){
 assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.GITHUB_REPOSITORY,PINS.repository);assert.equal(process.env.GITHUB_REF,'refs/heads/'+PINS.branch);assert.equal(process.env.GITHUB_EVENT_NAME,'push');assert.equal(process.env.GITHUB_RUN_ATTEMPT,'1');assert.equal(process.env.GITHUB_JOB,'audit');
 const origin={kind:'read-only-audit',repository:PINS.repository,branch:PINS.branch,commit:process.env.GITHUB_SHA,runId:Number(process.env.GITHUB_RUN_ID),runAttempt:1,job:'audit'};assert.match(origin.commit,/^[a-f0-9]{40}$/);assert.ok(Number.isSafeInteger(origin.runId)&&origin.runId!==PINS.publicationRun);assert.equal(git(root,'rev-parse','HEAD'),origin.commit);
 const publisher=path.join(root,'publisher'),input=path.join(root,'audit-input'),output=path.join(root,'audit-output');fs.mkdirSync(input,{recursive:true});assert.equal(fs.existsSync(output),false);
 const frozenMain=await import(pathToFileURL(path.join(publisher,PINS.frozenModules.main.path)));process.chdir(publisher);const spec=frozenMain.pins(),before=await liveLease(spec,origin),verifierLog=await response('actions/jobs/'+PINS.verifierJobId+'/logs',{binary:true}),failure=assertTerminal(before.originalRun,before.originalJobs,verifierLog);
 for(const pin of PINS.artifacts.filter(row=>!row.name.includes('-deploy-'))){await download(pin,path.join(input,pin.name+'.zip'));}
 const partialPin=PINS.artifacts.find(row=>row.id===11980879139),preparedPin=PINS.artifacts.find(row=>row.id===11979950368),partial=path.join(input,'partial'),prepared=path.join(input,'prepared');
 for(const [pin,directory]of [[partialPin,partial],[preparedPin,prepared]])execFileSync('python3',['scripts/publish-campaign-v56.py','extract-zip','--zip',path.join(input,pin.name+'.zip'),'--output',directory,'--expected-bytes',String(pin.size_in_bytes),'--expected-sha256',pin.digest.slice(7)],{stdio:'pipe',maxBuffer:25000000});
 const proof=await replayInputs({publisher,partial,prepared,archives:input,run:before.originalRun,jobs:before.originalJobs});
 const verifier=await import(pathToFileURL(path.join(publisher,'scripts/audit-v56-frozen-replay.mjs')));verifier.verifiedZip(path.join(input,partialPin.name+'.zip'),partial,partialPin);verifier.verifiedZip(path.join(input,preparedPin.name+'.zip'),prepared,preparedPin);
 fs.mkdirSync(output);fs.cpSync(partial,path.join(output,'original-partial'),{recursive:true});fs.writeFileSync(path.join(output,'original-verifier-failure.log'),verifierLog);write(path.join(output,'provider-before.json'),before);write(path.join(output,'canonical-envelope-replay.json'),proof);
 // This repeats the complete GET audit of all2119 bytes; the original publisher
 // identity is passed explicitly as data, never installed into process.env.
 const httpCode="import importlib.util,sys\np=importlib.util.spec_from_file_location('frozen_publisher','scripts/publish-campaign-v56.py');m=importlib.util.module_from_spec(p);p.loader.exec_module(m)\ns=m.validate_pins(m.read_json('tools/campaign-v56-release.json'));expected=m.identity(s,sys.argv[3],int(sys.argv[4]),1);m.check_public(sys.argv[1],sys.argv[2],s,expected,'published')\n";
 execFileSync('python3',['-c',httpCode,path.join(partial,'publication-manifest.json'),path.join(output,'fresh-public-bytes.json'),PINS.publisherCommit,String(PINS.publicationRun)],{stdio:'inherit',timeout:600000,maxBuffer:25000000});
 assertHTTP(read(path.join(output,'fresh-public-bytes.json')));const after=await liveLease(spec,origin);assertTerminal(after.originalRun,after.originalJobs,verifierLog);assert.equal(after.deployment.id,before.deployment.id);write(path.join(output,'provider-after.json'),after);
 write(path.join(output,'readonly-final-audit.json'),{schemaVersion:1,kind:'v56-read-only-final-audit',pass:true,publicationAccepted:false,originalCIConclusion:'failure',originalPublication:{publisherCommit:PINS.publisherCommit,runId:PINS.publicationRun,runAttempt:1},auditOrigin:{...origin,jobId:after.auditJob.id},sourceAccepted:true,sourceCommit:PINS.sourceCommit,originalPartialArtifact:partialPin,preparedArtifact:preparedPin,failureClassification:failure,originalImmutableSnapshotReplayed:true,canonicalOriginalBytesUnmodified:true,originalCaptureRoles:8,ordinaryPublicWins:51,siteFiles:PINS.siteFiles,siteBytes:PINS.siteBytes,siteInventorySha256:PINS.siteInventorySha256,latestDeployment:{id:after.deployment.id,sha:after.deployment.sha,state:after.status.state},limitations:['Original publication CI remains failure; this separate read-only producer has not accepted its own terminal result.','No new browser capture, deployment, source build or original-attempt rerun.','Automated software WebGL evidence does not establish human playtests, device FPS, live Yandex SDK or moderation.']});
 const lib=await import(pathToFileURL(path.join(publisher,'scripts/lib/campaign-v56-proof.mjs'))),rows=lib.inventory(output,{maximum:100000000});write(path.join(output,'readonly-verification-packet.json'),{schemaVersion:1,kind:'v56-read-only-final-verification-packet',pass:true,publicationAccepted:false,auditOrigin:origin,originalPublicationRun:PINS.publicationRun,files:rows,bytes:rows.reduce((n,row)=>n+row.bytes,0),inventorySha256:lib.digestRows(rows)});lib.inventory(output,{maximum:100000000});
 console.log('READONLY_V56_FINAL_AUDIT_PASS '+JSON.stringify({publicationAccepted:false,originalCIConclusion:'failure',roles:8,files:PINS.siteFiles,bytes:PINS.siteBytes,auditOrigin:origin}));
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)await main();
