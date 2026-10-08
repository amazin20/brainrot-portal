#!/usr/bin/env node
/** Prepare reviewable CI identity pins; publication still rechecks every gate. */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const REPOSITORY='amazin20/brainrot-portal';
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const same=(actual,expected,label)=>assert.deepEqual(actual,expected,label);
const positive=value=>assert.ok(Number.isSafeInteger(value)&&value>0);
const safeDirectory=value=>assert.match(value,/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export function validateRun(run,target,pending){
 same(run.id,pending.runId,'Wrong CI run');same(run.head_sha,target.sourceCommit,'Wrong CI source');
 same(run.path,pending.workflowPath,'Wrong CI workflow');same(run.run_attempt,1,'Reruns are not accepted');
 same(run.status,'completed','CI has not completed');same(run.conclusion,'success','CI is not successful');
 same(run.repository.full_name,REPOSITORY,'Wrong repository');
 same(run.head_commit.tree_id,target.sourceTree,'Wrong CI source tree');
 const reusable=run.referenced_workflows.filter(row=>row.path===REPOSITORY+'/.github/workflows/verified-build.yml@'+target.sourceCommit);
 same(reusable.length,1,'Wrong reusable workflow identity');same(reusable[0].sha,target.sourceCommit);
 assert.ok(Number.isFinite(Date.parse(run.updated_at)),'Missing completion timestamp');
}

export function validateTarget(target,pending,workflow){
 assert.match(target.sourceCommit,/^[a-f0-9]{40}$/);assert.match(target.sourceTree,/^[a-f0-9]{40}$/);
 positive(pending.runId);same(pending.sourceCommit,target.sourceCommit);same(pending.runAttempt,1);
 same(pending.workflowPath,'.github/workflows/unified-campaign-review.yml');
 same(target.expectedJobs,target.expectedJobNames.length);same(new Set(target.expectedJobNames).size,target.expectedJobs);
 same([...target.expectedJobNames].sort(),target.expectedJobNames,'Job names must be sorted');
 const inputs=[...target.inputArtifactsCore,...target.recordings.map(record=>({directory:record.directory,name:record.artifactName}))];
 same(inputs.length,target.expectedArtifacts);same(new Set(inputs.map(row=>row.name)).size,inputs.length);
 same(new Set(inputs.map(row=>row.directory)).size,inputs.length);inputs.forEach(row=>safeDirectory(row.directory));
 for(const [key,value] of Object.entries({SOURCE_SHA:target.sourceCommit,ACCEPTED_SOURCE_SHA:target.sourceCommit,REVIEW_RUN:String(pending.runId),REVIEW_ATTEMPT:'1',REVIEW_WORKFLOW_PATH:pending.workflowPath})){
  const rows=[...workflow.matchAll(new RegExp('^  '+key+': ([^\\n]+)$','gm'))];same(rows.length,1,'Missing/duplicate workflow env '+key);
  same(rows[0][1].trim().replace(/^['"]|['"]$/g,''),value,'Workflow env does not match target: '+key);
 }
 return inputs;
}

export function filteredArtifactResponse(envelope,{input,runId,source,listedArtifact}){
 const requestURL='https://api.github.com/repos/'+REPOSITORY+'/actions/runs/'+runId+'/artifacts?name='+encodeURIComponent(input.name)+'&per_page=100&page=1';
 const provenance=envelope.adapterProvenance;
 same(provenance.method,'github_fetch');same(provenance.repo_full_name,REPOSITORY);
 same(provenance.run_id,runId);same(provenance.name,input.name);same(provenance.request_url,requestURL);
 same(provenance.projection,'unmodified-json-content');
 assert.equal(typeof envelope.originalProviderResponse,'string');assert.ok(envelope.originalProviderResponse.length>0);
 const response=JSON.parse(envelope.originalProviderResponse);
 same(response,envelope.providerResponse,'Projected artifact response differs from original provider bytes');
 assert.ok(Array.isArray(response.artifacts),'Named API artifacts must be an array');
 same(response.total_count,1,'Named API response is not unique');same(response.artifacts.length,1,'Named API response is incomplete/duplicate');
 const artifact=response.artifacts[0];same(artifact.name,input.name);same(artifact.id,listedArtifact.id);
 same(artifact.workflow_run.id,runId);same(artifact.workflow_run.head_sha,source);same(artifact.expired,false);
 return artifact;
}

export async function prepareReviewPins({target,pending,workflow,api,archive,log,artifactMetadataMode='per-id',save=async()=>{}}){
 assert.ok(['per-id','filtered-run'].includes(artifactMetadataMode),'Unsupported artifact metadata mode');
 const inputs=validateTarget(target,pending,workflow);
 const apiPath='/repos/'+REPOSITORY;
 const runPath=apiPath+'/actions/runs/'+pending.runId;
 const run=await api(runPath,'run.json');validateRun(run,target,pending);await save('run.json',run);
 const commit=await api(apiPath+'/git/commits/'+target.sourceCommit,'commit.json');
 same(commit.sha,target.sourceCommit);same(commit.tree.sha,target.sourceTree);await save('commit.json',commit);
 for(const [file,pin,evidence] of [['verified-build.yml',target.sourceWorkflowSha256,'source-workflow.json'],['unified-campaign-review.yml',target.reviewWorkflowSha256,'review-workflow.json']]){
  const data=await api(apiPath+'/contents/.github/workflows/'+file+'?ref='+target.sourceCommit,evidence);
  same(data.encoding,'base64');same(data.path,'.github/workflows/'+file);
  same(digest(Buffer.from(data.content.replace(/\s/g,''),'base64')),pin,'Source workflow bytes changed');await save(evidence,data);
 }
 async function allPages(endpoint,key,stem){
  const rows=[];let total;
  for(let page=1;;page++){
   const data=await api(endpoint+(endpoint.includes('?')?'&':'?')+'per_page=100&page='+page,stem+'-page-'+page+'.json');
   assert.ok(Number.isSafeInteger(data.total_count)&&data.total_count>=0);assert.ok(Array.isArray(data[key]));
   if(total===undefined)total=data.total_count;else same(data.total_count,total,'API pagination changed');
   assert.ok(data[key].length<=100);rows.push(...data[key]);await save(stem+'-page-'+page+'.json',data);
   assert.ok(rows.length<=total,'API pagination contains extra entries');if(rows.length===total)return rows;
   assert.ok(data[key].length>0,'Incomplete API pagination');
  }
 }
 const jobs=await allPages(runPath+'/attempts/1/jobs','jobs','jobs');
 same(jobs.length,target.expectedJobs,'Incomplete exact-source job set');same(new Set(jobs.map(row=>row.id)).size,jobs.length);
 same(jobs.map(row=>row.name).sort(),target.expectedJobNames,'Wrong job names');
 for(const job of jobs){
  positive(job.id);same(job.run_id,pending.runId);same(job.head_sha,target.sourceCommit);same(job.run_attempt,1);
  same(job.status,'completed',job.name);same(job.conclusion,'success',job.name);
  assert.ok(Number.isFinite(Date.parse(job.completed_at)),job.name+' lacks completion time');
 }
 const listed=await allPages(runPath+'/artifacts','artifacts','artifacts');
 same(new Set(listed.map(row=>row.id)).size,listed.length,'Duplicate API artifact IDs');
 const artifactPins=[],artifactMetadataReads=[];
 for(const input of inputs){
  const selected=listed.filter(row=>row.name===input.name);same(selected.length,1,'Missing/duplicate required artifact '+input.name);
  const listedArtifact=selected[0];positive(listedArtifact.id);
  let file,artifact,original;
  if(artifactMetadataMode==='filtered-run'){
   file='artifact-name-'+input.directory+'.json';
   const endpoint=runPath+'/artifacts?name='+encodeURIComponent(input.name)+'&per_page=100&page=1';
   original=await api(endpoint,file);
   artifact=filteredArtifactResponse(original,{input,runId:pending.runId,source:target.sourceCommit,listedArtifact});
   artifactMetadataReads.push({id:artifact.id,name:input.name,directory:input.directory,method:'github_fetch',
    requestURL:original.adapterProvenance.request_url,originalResponseSha256:digest(Buffer.from(original.originalProviderResponse))});
  }else{
   file='artifact-'+listedArtifact.id+'.json';
   original=await api(apiPath+'/actions/artifacts/'+listedArtifact.id,file);artifact=original;
   artifactMetadataReads.push({id:artifact.id,name:input.name,directory:input.directory,method:'per-id-rest',
    requestURL:'https://api.github.com'+apiPath+'/actions/artifacts/'+listedArtifact.id});
  }
  for(const key of ['id','name','digest','size_in_bytes','expired'])same(artifact[key],listedArtifact[key],'Artifact list/detail mismatch');
  same(artifact.workflow_run.id,pending.runId);same(artifact.workflow_run.head_sha,target.sourceCommit);
  same(listedArtifact.workflow_run.id,pending.runId);same(listedArtifact.workflow_run.head_sha,target.sourceCommit);
  same(artifact.expired,false,input.name);positive(artifact.size_in_bytes);assert.match(artifact.digest,/^sha256:[a-f0-9]{64}$/);
  const pin={id:artifact.id,name:artifact.name,directory:input.directory,sizeBytes:artifact.size_in_bytes,digest:artifact.digest};
  const bytes=await archive(pin);same(bytes.length,pin.sizeBytes,'Wrong ZIP size: '+pin.name);
  same('sha256:'+digest(bytes),pin.digest,'Wrong ZIP bytes: '+pin.name);artifactPins.push(pin);await save(file,original);
 }
 same(new Set(artifactPins.map(row=>row.id)).size,inputs.length,'Required artifacts reused one ID');
 const logHashes=[];
 for(const job of [...jobs].sort((a,b)=>a.id-b.id)){
  const bytes=await log(job);const text=bytes.toString('utf8');
  assert.ok(new RegExp('git log -1 --format=%H\\r?\\n[^\\n]*'+target.sourceCommit).test(text),'Job did not check out exact source: '+job.name);
  logHashes.push({id:job.id,name:job.name,sourceCommit:target.sourceCommit,bytes:bytes.length,sha256:digest(bytes)});
 }
 const finalRun=await api(runPath,'run-final.json');validateRun(finalRun,target,pending);
 for(const key of ['id','head_sha','run_attempt','status','conclusion','path','updated_at'])same(finalRun[key],run[key],'Accepted run changed during pinning');
 await save('run-final.json',finalRun);await save('job-log-hashes.json',logHashes);
 return {
  sourceCommit:target.sourceCommit,runId:pending.runId,runAttempt:1,workflowPath:pending.workflowPath,conclusion:'success',
  completedAt:finalRun.updated_at,jobs:jobs.map(({id,name})=>({id,name})).sort((a,b)=>a.id-b.id),
  artifacts:artifactPins.sort((a,b)=>a.directory.localeCompare(b.directory)),
  metrics:{acceptedJobs:jobs.length,currentRecordingInputs:target.recordings.length,verifiedArchiveInputs:artifactPins.length},
  provenance:{sourceTree:target.sourceTree,sourceWorkflowSha256:target.sourceWorkflowSha256,reviewWorkflowSha256:target.reviewWorkflowSha256,
   jobLogHashes:logHashes,artifactMetadataMode,artifactMetadataReads},
  evidenceScope:'Exact successful attempt-one CI identities, source tree/workflow bytes, checkout logs and downloaded artifact ZIP checksums. Publication package/media/native/preservation gates remain mandatory; this is not human, device or live Yandex acceptance.'
 };
}

export async function main(args=process.argv.slice(2)){
 const options={};for(let i=0;i<args.length;i+=2){assert.ok(['--target','--pending','--workflow','--evidence-dir','--proof-dir','--output','--artifact-metadata-mode'].includes(args[i]),'Unknown option '+args[i]);assert.ok(args[i+1]);options[args[i].slice(2)]=args[i+1];}
 const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
 const targetPath=options.target||'docs/unified-publication-target.json';
 const pendingPath=options.pending||'docs/accepted-unified-review.json';
 const output=options.output||'proof/accepted-unified-review.json';
 const proofDir=options['proof-dir']||'proof/review-pins';
 const evidenceDir=options['evidence-dir'];
 const artifactMetadataMode=options['artifact-metadata-mode']||'per-id';
 assert.ok(['per-id','filtered-run'].includes(artifactMetadataMode));
 if(artifactMetadataMode==='filtered-run')assert.ok(evidenceDir,'Filtered connector responses require an explicit evidence bundle');
 assert.notEqual(path.resolve(output),path.resolve(pendingPath),'Write a reviewable output; do not overwrite current acceptance');
 const target=await read(targetPath),pending=await read(pendingPath);
 const workflow=await fs.readFile(options.workflow||'.github/workflows/publish-unified-campaign.yml','utf8');
 const headers={Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'Mozilla/5.0 brainrot-exact-review-pins'};
 if(process.env.GITHUB_TOKEN)headers.Authorization='Bearer '+process.env.GITHUB_TOKEN;
 const request=async endpoint=>{
  const response=await fetch('https://api.github.com'+endpoint,{headers,signal:AbortSignal.timeout(180000)});
  assert.ok(response.ok,'GitHub API HTTP '+response.status);return response;
 };
 const save=async(name,data)=>{await fs.mkdir(proofDir,{recursive:true});await fs.writeFile(path.join(proofDir,name),JSON.stringify(data,null,2)+'\n',{flag:'wx'});};
 const api=async(endpoint,name)=>evidenceDir?read(path.join(evidenceDir,name)):(await request(endpoint)).json();
 const archive=async pin=>{
  if(evidenceDir)return fs.readFile(path.join(evidenceDir,'archives',pin.directory+'.zip'));
  const response=await request('/repos/'+REPOSITORY+'/actions/artifacts/'+pin.id+'/zip');
  const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;assert.ok(size<=pin.sizeBytes,'Oversized ZIP');chunks.push(chunk);}
  const bytes=Buffer.concat(chunks);await fs.mkdir(path.join(proofDir,'archives'),{recursive:true});
  await fs.writeFile(path.join(proofDir,'archives',pin.directory+'.zip'),bytes,{flag:'wx'});return bytes;
 };
 const log=async job=>{
  const bytes=evidenceDir?await fs.readFile(path.join(evidenceDir,'job-'+job.id+'.log')):Buffer.from(await(await request('/repos/'+REPOSITORY+'/actions/jobs/'+job.id+'/logs')).arrayBuffer());
  await fs.mkdir(path.join(proofDir,'logs'),{recursive:true});await fs.writeFile(path.join(proofDir,'logs','job-'+job.id+'.log'),bytes,{flag:'wx'});return bytes;
 };
 const pins=await prepareReviewPins({target,pending,workflow,api,archive,log,save,artifactMetadataMode});
 pins.provenance.targetSha256=digest(await fs.readFile(targetPath));
 pins.provenance.publicationWorkflowSha256=digest(Buffer.from(workflow));
 await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,JSON.stringify(pins,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({output,sourceCommit:pins.sourceCommit,runId:pins.runId,jobs:pins.jobs.length,artifacts:pins.artifacts.length,conclusion:pins.conclusion}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
