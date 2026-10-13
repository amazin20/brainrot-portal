import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {pins as releasePins,request as originalRequest,downloadOne as originalDownloadOne,imageChecker,movieChecker,assertSourceProvider,assertLatestDeployment} from './publish-campaign-v55.mjs';
import {retryReadonlyGet} from './lib/campaign-v55-readonly-get.mjs';
import {PUBLIC_ROLES,roleInfo,assertProducerArtifact} from './publish-campaign-v55-run.mjs';
import {sha,inventory,digestRows,assertSourcePackage} from './lib/campaign-v55-proof.mjs';
import {validateCanonicalCaptures} from './lib/campaign-v55-canonical-capture.mjs';
import {assertOriginalFailedProvider,assertArchivedProducerRun} from './lib/campaign-v55-readonly-provider.mjs';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const write=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');};
const config=()=>read('tools/campaign-v55-readonly.json');
const request=(resource,options)=>retryReadonlyGet(()=>originalRequest(resource,options));
const downloadOne=(pin,file,maximum)=>retryReadonlyGet(()=>originalDownloadOne(pin,file,maximum));
async function all(resource,key){const rows=[];for(let page=1;page<=50;page++){const value=await request(resource+(resource.includes('?')?'&':'?')+'per_page=100&page='+page),batch=key?value[key]:value;assert.ok(Array.isArray(batch));rows.push(...batch);if(batch.length<100)return rows;}throw Error('Provider pagination exceeded original bound');}
const getLog=resource=>retryReadonlyGet(async()=>{const response=await originalRequest(resource,{binary:true});return Buffer.from(await response.arrayBuffer());});
function target(c){return{publisherCommit:c.originalProvider.run.head_sha,publicationRun:c.originalProvider.run.id,publicationRunAttempt:1};}
export async function fetchOriginal(c){
 const [run,jobs,artifacts,gitCommit,log]=await Promise.all([request('actions/runs/38387082981'),all('actions/runs/38387082981/attempts/1/jobs','jobs'),all('actions/runs/38387082981/artifacts','artifacts'),request('git/commits/ba3218f7855e7cbff8170ec1f692a0fd786794a6'),getLog('actions/jobs/115271204608/logs')]);
 return{run,jobs,artifacts,gitCommit,log};
}
async function transportIdentity(c){
 assert.equal(c.frozen,true);assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.GITHUB_REPOSITORY,'amazin20/brainrot-portal');assert.equal(process.env.GITHUB_EVENT_NAME,'push');assert.equal(process.env.GITHUB_REF,'refs/heads/'+c.branch);assert.equal(process.env.GITHUB_RUN_ATTEMPT,'1');assert.equal(process.env.GITHUB_JOB,'restore');
 const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();assert.equal(head,process.env.GITHUB_SHA);assert.equal(execFileSync('git',['rev-parse','HEAD^'],{encoding:'utf8'}).trim(),c.controllerParent);assert.equal(execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}),'');
 const run=await request('actions/runs/'+process.env.GITHUB_RUN_ID);assert.equal(run.head_sha,head);assert.equal(run.head_branch,c.branch);assert.equal(run.run_attempt,1);assert.equal(run.event,'push');assert.equal(run.path,'.github/workflows/restore-campaign-v55-public-packet.yml');assert.equal(run.status,'in_progress');assert.equal(run.conclusion,null);assert.notEqual(run.id,38387082981);
 const jobs=await all('actions/runs/'+run.id+'/attempts/1/jobs','jobs');assert.equal(jobs.length,1);assert.equal(jobs[0].name,'restore');assert.equal(jobs[0].status,'in_progress');assert.equal(jobs[0].head_sha,head);
 return{kind:'actual-read-only-campaign-v55-postprocessing-producer',repository:process.env.GITHUB_REPOSITORY,controllerCommit:head,controllerTree:execFileSync('git',['rev-parse','HEAD^{tree}'],{encoding:'utf8'}).trim(),runId:run.id,runAttempt:1,branch:c.branch,event:'push',workflow:run.path,jobId:jobs[0].id,jobURL:jobs[0].html_url,sourceStampIsNotProducer:true,noDeploymentOrBrowserReplay:true};
}
async function deploymentRows(){const rows=[];for(const d of (await all('deployments?environment=github-pages')).sort((a,b)=>b.id-a.id)){
 const statuses=await all('deployments/'+d.id+'/statuses'),s=statuses.sort((a,b)=>b.id-a.id)[0];rows.push({id:d.id,sha:d.sha,state:s?.state,logUrl:s?.log_url,statusId:s?.id});}return rows;}
export async function guard(c,phase,{producer}={}){
 const spec=releasePins();for(const key of ['sourceCommit','sourceTree','sourceParent','sourceReview'])assert.deepEqual(c[key],spec[key]);
 const original=await fetchOriginal(c),classification=assertOriginalFailedProvider(original,c);
 const [main,sourceRef,sourceRun,sourceGit,sourceJobs,sourceArtifacts,rows]=await Promise.all([request('git/ref/heads/main'),request('git/ref/heads/'+spec.sourceBranch),request('actions/runs/'+spec.sourceReview.runId),request('git/commits/'+spec.sourceCommit),all('actions/runs/'+spec.sourceReview.runId+'/attempts/1/jobs','jobs'),all('actions/runs/'+spec.sourceReview.runId+'/artifacts','artifacts'),deploymentRows()]);
 assert.equal(main.object.sha,c.controllerParent);assert.equal(sourceRef.object.sha,spec.sourceCommit);const normalized=assertSourceProvider({run:sourceRun,gitCommit:sourceGit,jobs:sourceJobs,artifacts:sourceArtifacts},spec);assert.deepEqual(normalized.jobs,spec.sourceJobs);assert.deepEqual(normalized.artifacts,spec.sourceArtifacts);
 const latest=assertLatestDeployment(rows,spec.baseline,target(c),{phase:'final',jobs:original.jobs});assert.equal(latest.id,c.deployment.id);assert.equal(latest.sha,c.deployment.sha);assert.equal(latest.logUrl,c.deployment.logUrl);assert.equal(latest.state,'success');
 // Pages publishers are forbidden while this read-only proof is assembled.
 const publishers=fs.readdirSync('.github/workflows').filter(file=>/\.ya?ml$/.test(file)&&/actions\/deploy-pages|pages:\s*write/.test(fs.readFileSync('.github/workflows/'+file,'utf8'))).map(file=>'.github/workflows/'+file);
 for(const status of ['queued','in_progress','waiting'])for(const r of await all('actions/runs?status='+status,'workflow_runs'))assert.ok(!publishers.includes(r.path),'Other active Pages publisher '+r.id);
 const receipt={kind:'exact-failed-verifier-read-only-recovery-lease',pass:true,publicationAccepted:false,phase,...target(c),sourceCommit:spec.sourceCommit,sourceTree:spec.sourceTree,sourceReview:spec.sourceReview,originalClassification:classification,originalCIConclusion:'failure',actualReadOnlyProducer:producer??null,acceptedDeployment:latest,rows};
 write('proof/readonly-guard-'+phase+'.json',receipt);write('proof/original-failed-run.json',original.run);write('proof/original-jobs.json',original.jobs);write('proof/original-artifacts.json',original.artifacts);fs.writeFileSync('proof/original-verifier-failure.log',original.log);return{original,receipt};
}
async function preservePreviousFailure(c){const pin=c.previousReadonlyFailure;assert.equal(pin.partialArtifactAccepted,false);const [run,job,log]=await Promise.all([request('actions/runs/'+pin.runId),request('actions/jobs/'+pin.jobId),getLog('actions/jobs/'+pin.jobId+'/logs')]);assert.equal(run.head_sha,pin.controllerCommit);assert.equal(run.status,'completed');assert.equal(run.conclusion,'failure');assert.equal(run.run_attempt,1);assert.equal(job.run_id,pin.runId);assert.equal(job.conclusion,'failure');assert.equal(job.steps.find(step=>step.number===8).conclusion,'failure');assert.equal(job.steps.filter(step=>step.conclusion==='failure').length,1);assert.equal(log.length,pin.logBytes);assert.equal(sha(log),pin.logSha256);assert.ok(log.toString('utf8').includes("code: 'UND_ERR_SOCKET'"));write('proof/previous-readonly-failure.json',{...pin,actualRun:run,actualJob:job,originalCIConclusion:'failure',scope:'Previous read-only attempt remains failed; its partial packet is not accepted.'});}
function safeExtract(pin,zip,folder){
 const args=['--zip',zip,'--expected-bytes',String(pin.size_in_bytes),'--expected-sha256',pin.digest.slice(7)];execFileSync('python3',['scripts/publish-campaign-v55.py','extract-zip',...args,'--output',folder],{stdio:'inherit'});return verifyZip(pin,zip,folder);
}
function verifyZip(pin,zip,folder){return JSON.parse(execFileSync('python3',['scripts/publish-campaign-v55.py','verify-extracted','--zip',zip,'--directory',folder,'--expected-bytes',String(pin.size_in_bytes),'--expected-sha256',pin.digest.slice(7)],{encoding:'utf8',maxBuffer:25_000_000}));}
async function obtain(pin,folder,maximum){const zip='downloads/'+pin.id+'.zip';await downloadOne(pin,zip,maximum);safeExtract(pin,zip,folder);return zip;}
export async function validateRestored(c,original){
 const spec=releasePins(),binding=read('proof/source-binding.json');assert.equal(binding.sourceAccepted,true);assert.equal(binding.publicationAccepted,false);
 const packet=await assertSourcePackage('source','proof/review-artifacts/campaign-polish-dist',spec);assert.deepEqual(packet.files,binding.candidateFiles);assert.equal(packet.bytes,7053707);
 const ctx={pins:()=>spec,imageChecker,movieChecker},envelopes=[];
 for(const role of PUBLIC_ROLES){const folder='proof/public-'+role,provider=read(folder+'/provider-after.json'),job=original.jobs.find(job=>job.name===roleInfo(role).name);
  assertArchivedProducerRun(provider.run,original.run);for(const key of ['id','name','run_id','run_attempt','head_sha','html_url'])assert.deepEqual(provider.job[key],job[key]);assert.equal(provider.job.status,'in_progress');assert.equal(provider.job.conclusion,null);
  const origin=read(folder+'/origin.json');envelopes.push({role,jobId:job.id,originalProducerRunSnapshotUsed:true,envelopes:await validateCanonicalCaptures(ctx,role,{folder,run:provider.run,job,origin,validate:true})});
 }
 const manifest=read('proof/publication-manifest.json'),post=read('proof/deploy-original/public-bytes.json');assert.equal(post.pass,true);assert.equal(post.publisherCommit,c.controllerParent);assert.equal(post.publicationRun,38387082981);assert.equal(post.checked,2038);assert.equal(post.bytes,640738913);assert.equal(post.siteFilesSha256,c.site.inventorySha256);assert.equal(manifest.siteFilesSha256,c.site.inventorySha256);assert.equal(manifest.siteFiles.length,2038);
 return{kind:'exact-canonical-original-PUBLIC-payload-validation',pass:true,publicationAccepted:false,originalCIConclusion:'failure',...target(c),sourceCommit:spec.sourceCommit,sourceTree:spec.sourceTree,sourceReview:spec.sourceReview,ordinaryPublicWins:51,architectureFrames:102,animationMovies:2,animationJPEGs:96,heldAngleStills:6,menuFrames:6,bareEntryAndHistoricalSaveIsolation:true,captures:envelopes,wholeSiteFiles:2038,wholeSiteBytes:640738913,wholeSiteInventory:c.site.inventorySha256,baselineFiles:1957,baselineBytes:633671648,baselineInventory:spec.baseline.inventorySha256,limitations:binding.limitations};
}
async function restore(){
 const c=config(),producer=await transportIdentity(c),initial=await guard(c,'before',{producer});const original=initial.original;write('proof/actual-readonly-producer.json',producer);await preservePreviousFailure(c);
 const prepared=original.artifacts.find(row=>row.name==='campaign-v55-prepared-38387082981-1'),deploy=original.artifacts.find(row=>row.name==='campaign-v55-deploy-38387082981-1');assertProducerArtifact(prepared,original.jobs.find(job=>job.name==='assemble'),target(c));assertProducerArtifact(deploy,original.jobs.find(job=>job.name==='deploy'),target(c));
 // Preparation is extracted beside proof then copied; proof already holds the
 // authenticated recovery receipts and cannot be replaced or silently merged.
 await obtain(prepared,'prepared-original',25_000_000);for(const entry of fs.readdirSync('prepared-original')){assert.equal(fs.existsSync('proof/'+entry),false);fs.cpSync('prepared-original/'+entry,'proof/'+entry,{recursive:true});}
 await obtain(deploy,'proof/deploy-original',25_000_000);const receipts=[];let total=0;
 for(const role of PUBLIC_ROLES){const pin=original.artifacts.find(row=>row.name==='campaign-v55-public-'+role+'-38387082981-1');assertProducerArtifact(pin,original.jobs.find(job=>job.name===roleInfo(role).name),target(c));total+=pin.size_in_bytes;assert.ok(total<=100_000_000);const zip=await obtain(pin,'proof/public-'+role,100_000_000);receipts.push({role,artifact:pin,zip});}
 const validation=await validateRestored(c,original);write('proof/canonical-public-validation.json',validation);
 const output='proof/public-verification';assert.equal(fs.existsSync(output),false);fs.mkdirSync(output,{recursive:true});for(const role of PUBLIC_ROLES)fs.cpSync('proof/public-'+role,output+'/public-'+role,{recursive:true});
 for(const name of ['source-binding.json','package-binding.json','publication-manifest.json','canonical-public-validation.json','actual-readonly-producer.json','previous-readonly-failure.json','original-failed-run.json','original-jobs.json','original-artifacts.json','original-verifier-failure.log','readonly-guard-before.json'])fs.copyFileSync('proof/'+name,output+'/'+name);
 for(const name of ['public-preflight.json','public-bytes.json','guard-published.json'])fs.copyFileSync('proof/deploy-original/'+name,output+'/'+name);
 // Import the unchanged byte-check helper directly. Its target remains the
 // original PUBLIC run; a separate receipt retains the real read-only producer.
 execFileSync('python3',['scripts/verify-campaign-v55-readonly-bytes.py','--manifest','proof/publication-manifest.json','--output',output+'/public-final-readonly.json','--producer','proof/actual-readonly-producer.json'],{stdio:'inherit'});
 for(const job of original.jobs){const raw=await getLog('actions/jobs/'+job.id+'/logs');assert.ok(raw.length>0&&raw.length<20_000_000);fs.mkdirSync(output+'/job-logs',{recursive:true});fs.writeFileSync(output+'/job-logs/'+job.id+'.log',raw);}
 const final=await guard(c,'after',{producer});for(const name of ['readonly-guard-after.json','original-failed-run.json','original-jobs.json','original-artifacts.json'])fs.copyFileSync('proof/'+name,output+'/'+name);
 write(output+'/public-postprocessing-acceptance.json',{...validation,originalFailureClassification:final.receipt.originalClassification,actualReadOnlyProducer:producer,sourceRootAudit:releasePins().sourceRootAudit,baselineRootAudit:releasePins().baseline.rootAudit,scope:'Original ten deployment/capture jobs succeeded; original final verifier failed only on movie transport path plus consequent missing packet. All immutable captures are independently revalidated at their canonical original paths. Original CI remains failure; this read-only job is still running and cannot claim its own success.'});
 for(const row of receipts)verifyZip(row.artifact,row.zip,'proof/public-'+row.role);const files=inventory(output,{maximum:100_000_000});write(output+'/verification-packet.json',{kind:'campaign-v55-read-only-public-verification-packet',schemaVersion:1,pass:true,publicationAccepted:false,originalCIConclusion:'failure',...target(c),sourceCommit:c.sourceCommit,sourceTree:c.sourceTree,sourceReview:c.sourceReview,actualReadOnlyProducer:producer,files,bytes:files.reduce((n,row)=>n+row.bytes,0),inventorySha256:digestRows(files),maximumBytes:100_000_000});inventory(output,{maximum:100_000_000});
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){assert.equal(process.argv[2],'restore');await restore();}
