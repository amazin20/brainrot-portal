/** Append a separately reviewed Tower41 preview; never rewrite accepted public bytes. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {Readable, Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {pathToFileURL} from 'node:url';

export const PINS = Object.freeze({
  repository:'amazin20/brainrot-portal', publicBase:'https://amazin20.github.io/brainrot-portal/',
  branch:'upgrade/tower41-preview-nav-20261012', reviewPath:'.github/workflows/tower41-next-cell-review.yml',
  // Fill only after independent exact-attempt source, logs, package and movie acceptance.
  sourceCommit:'58a71ddfc9bf704bef4c97fe13d16401c5a5f9f2', sourceTree:'ce2f93de147e96b991e62a0ba3e81a8b63efaec7', sourceParent:'9f00a4ee1c99d94f6e922e763fbd40d2f3dd79b7', reviewRun:38243168335, reviewAttempt:1,
  controllerPath:'.github/workflows/publish-puzzle-progression-finale.yml',
  baselinePublisher:'569918af19c4dafdc0f9450e668733c474e8ff56', baselineRun:38116282717,
  canonicalSource:'8d2c01eacd86fe9235a35e7ec5f624ba62c3b29e', finaleSource:'0e257837ca157d59d29c2e892e9a81e4f21fc5a1',
  baselineFiles:1623, baselineBytes:531927136,
  baselineInventorySha256:'896e685b9e70a572f8c6d486f6a73f8704e6c24fe15495ca814eb008d40bfe26',
  baselineArtifact:{id:11693810063,name:'github-pages',size_in_bytes:494948351,digest:'sha256:509e9d069bcf57de4b0a3cc9a57e533872524bc07783d3a7e46130ddda928264'},
  baselineProof:{id:11692978754,name:'puzzle-progression-finale-camera-publication-proof-38116282717-1',size_in_bytes:12625985,digest:'sha256:828314f3a440f5e06a9bb37c93c0cf2738ce0cf0c17fcafa5c44b9bb484df050'},
  namespace:'tower41-native/', query:'?edition=foundation&level=41&tower41preview=1',
  storagePrefix:'brainrot-tower41-native-v1:', artifactStem:'tower41-next-cell',
});
export const JOB_NAMES=Object.freeze(['build','cpu','native-contact','native-castle','review-summary']);
export const CONTROLLER_CHANGES=Object.freeze([
  {filename:PINS.controllerPath,status:'modified'},
  ...['publish-tower41-native.mjs','publish-tower41-native.py','test-publish-tower41-native.mjs','test-publish-tower41-native.py'].map(file=>({filename:'scripts/'+file,status:'added'})),
]);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const write=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');};
const git=(directory,...args)=>execFileSync('git',['-C',directory,...args],{encoding:'utf8'}).trim();
export function positive(value){assert.ok((typeof value==='number'&&Number.isSafeInteger(value))||(typeof value==='string'&&/^[1-9][0-9]*$/.test(value)));const n=Number(value);assert.ok(Number.isSafeInteger(n)&&n>0);return n;}
export function identity(){
  assert.match(PINS.sourceCommit,/^[a-f0-9]{40}$/,'Pending source cannot publish');positive(PINS.reviewRun);positive(PINS.reviewAttempt);
  assert.equal(process.env.BUILD_COMMIT,PINS.sourceCommit);assert.equal(positive(process.env.SOURCE_REVIEW_RUN_ID),PINS.reviewRun);assert.equal(positive(process.env.SOURCE_REVIEW_RUN_ATTEMPT),PINS.reviewAttempt);
  const publisher=process.env.GITHUB_SHA;assert.match(publisher||'',/^[a-f0-9]{40}$/);
  return {sourceCommit:PINS.sourceCommit,sourceReview:{runId:PINS.reviewRun,runAttempt:PINS.reviewAttempt},publisherCommit:publisher,publicationRun:positive(process.env.GITHUB_RUN_ID)};
}
export function checkReview(run,jobs,expected){
  assert.equal(run.id,expected.sourceReview.runId);assert.equal(run.run_attempt,expected.sourceReview.runAttempt);assert.equal(run.head_sha,expected.sourceCommit);
  assert.equal(run.head_branch,PINS.branch);assert.equal(run.path,PINS.reviewPath);assert.equal(run.event,'push');assert.equal(run.status,'completed');assert.equal(run.conclusion,'success');
  assert.equal(jobs.length,5);assert.deepEqual(jobs.map(j=>j.name).sort(),[...JOB_NAMES].sort());
  assert.equal(new Set(jobs.map(j=>j.id)).size,5);
  for(const job of jobs){positive(job.id);assert.equal(job.run_id,run.id);assert.equal(job.run_attempt,run.run_attempt);assert.equal(job.head_sha,run.head_sha);assert.equal(job.status,'completed');assert.equal(job.conclusion,'success');}
}
export function checkController(commit,publisher){
  assert.equal(commit.sha,publisher);assert.deepEqual(commit.parents.map(p=>p.sha),[PINS.baselinePublisher],'Publisher must be one leased direct child of current main');
  assert.deepEqual(commit.files.map(({filename,status})=>({filename,status})).sort((a,b)=>a.filename.localeCompare(b.filename)),[...CONTROLLER_CHANGES].sort((a,b)=>a.filename.localeCompare(b.filename)),'Only the same controller and its tested helpers may change');
  for(const file of commit.files)assert.equal(file.previous_filename,undefined,'Renamed publication paths forbidden');
}
export function checkArtifact(artifact,{name,runId,sourceCommit,pinned}={}){
  positive(artifact.id);assert.equal(artifact.name,name);assert.equal(artifact.expired,false);assert.equal(artifact.workflow_run.id,runId);assert.equal(artifact.workflow_run.head_sha,sourceCommit);
  positive(artifact.size_in_bytes);assert.ok(artifact.size_in_bytes<=600_000_000);assert.match(artifact.digest||'',/^sha256:[a-f0-9]{64}$/);
  if(pinned)for(const [key,value]of Object.entries(pinned))assert.equal(artifact[key],value,'Pinned accepted artifact '+key);
}
export function checkJobLog(bytes,job,expected){
  const log=bytes.toString('utf8');assert.equal(Buffer.from(log).compare(bytes),0,'Provider log must be complete UTF-8');
  const markers=log.split(/\r?\n/).map(line=>line.replace(/^\d{4}-\d\d-\d\dT\S+\s+/,'')).filter(line=>line.startsWith('TOWER41_NEXT_JOB ')).map(line=>JSON.parse(line.slice('TOWER41_NEXT_JOB '.length)));
  const names=job.name==='review-summary'?['build','cpu','native-contact','native-castle']:[job.name];
  assert.equal(markers.length,names.length,'Every provider log needs exact standalone source/job markers');assert.deepEqual(markers.map(m=>m.job).sort(),names.sort());
  for(const marker of markers){assert.equal(marker.sourceCommit,expected.sourceCommit);assert.deepEqual(marker.sourceReview,expected.sourceReview);assert.equal(marker.status,'success');}
  return {bytes:bytes.length,sha256:sha(bytes)};
}
export function checkDeployments(rows,publisher,runId){
  for(const row of rows){
    const own=row.sha===publisher&&new RegExp('/actions/runs/'+runId+'(?:/|$)').test(row.logUrl||'');if(own)continue;
    assert.ok(row.state&&!['queued','pending','in_progress'].includes(row.state),'Overlapping Pages publication');
    if(['failure','error','inactive'].includes(row.state))continue;
    assert.equal(row.state,'success');assert.equal(row.sha,PINS.baselinePublisher,'Public site advanced beyond pinned baseline');
    assert.ok(new RegExp('/actions/runs/'+PINS.baselineRun+'(?:/|$)').test(row.logUrl||''),'Accepted deployment source changed');return row;
  }
  throw Error('No current accepted Pages deployment');
}
export function inventory(root){
  const walk=directory=>fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{const file=path.join(directory,entry.name);assert.equal(entry.isSymbolicLink(),false);if(entry.isDirectory())return walk(file);assert.equal(entry.isFile(),true);return [file];});
  return walk(root).sort().map(file=>({path:path.relative(root,file).split(path.sep).join('/'),bytes:fs.statSync(file).size,sha256:sha(fs.readFileSync(file))}));
}
export function supplementalRecording(evidence,artifactFiles,expected){
  assert.equal(evidence.sourceCommit,expected.sourceCommit);assert.match(evidence.video?.filename||'',/^[A-Za-z0-9_-]+\.mp4$/);
  assert.equal(evidence.result?.pass,true);assert.equal(evidence.result.metrics.won,true);assert.equal(evidence.result.metrics.completedStages,11);assert.equal(evidence.result.sameCompanion,true);
  assert.equal(evidence.result.resets+evidence.result.respawns+evidence.result.cargoResets,0);assert.equal(evidence.observed.seenResets,0);
  assert.equal(evidence.video.fps,4);assert.equal(evidence.video.width,640);assert.equal(evidence.video.height,360);positive(evidence.video.frames);
  assert.equal(evidence.video.durationSeconds,evidence.video.frames/evidence.video.fps);assert.equal(evidence.video.simulationSeconds,evidence.result.seconds);assert.ok(Number.isFinite(evidence.result.seconds)&&evidence.result.seconds>0);
  const videoRows=artifactFiles.filter(row=>row.path===evidence.video.filename),reportRows=artifactFiles.filter(row=>row.path==='evidence.json');assert.equal(videoRows.length,1);assert.equal(reportRows.length,1);
  const video=videoRows[0],report=reportRows[0];assert.equal(video.sha256,evidence.video.sha256);positive(video.bytes);positive(report.bytes);
  const sourceIdentity={sourceCommit:expected.sourceCommit,sourceReview:expected.sourceReview};
  return {reviewedFiles:[{sourceArtifact:'nativeCastle',sourcePath:video.path,path:'evidence/tower41-native.mp4',bytes:video.bytes,sha256:video.sha256,...sourceIdentity},{sourceArtifact:'nativeCastle',sourcePath:report.path,path:'evidence/tower41-native-report.json',bytes:report.bytes,sha256:report.sha256,...sourceIdentity}],recording:{...sourceIdentity,filename:'evidence/tower41-native.mp4',report:'evidence/tower41-native-report.json',bytes:video.bytes,sha256:video.sha256,frames:evidence.video.frames,fps:evidence.video.fps,width:evidence.video.width,height:evidence.video.height,durationSeconds:evidence.video.durationSeconds,simulationSeconds:evidence.video.simulationSeconds}};
}
async function request(resource,{binary=false}={}){
  assert.ok(process.env.GITHUB_TOKEN);const response=await fetch('https://api.github.com/repos/'+PINS.repository+'/'+resource,{headers:{Authorization:'Bearer '+process.env.GITHUB_TOKEN,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(binary?600000:60000)});
  assert.ok(response.ok,'GitHub HTTP '+response.status+' '+resource);return binary?response:response.json();
}
async function all(resource,key){const rows=[];for(let page=1;page<=50;page++){const result=await request(resource+(resource.includes('?')?'&':'?')+'per_page=100&page='+page),batch=key?result[key]:result;assert.ok(Array.isArray(batch));rows.push(...batch);if(batch.length<100)return rows;}throw Error('Provider pagination exceeded bounded inspection');}
async function guard(phase){
  assert.ok(['prepare','deploy'].includes(phase));const expected=identity();assert.equal(process.env.GITHUB_REPOSITORY,PINS.repository);assert.equal(process.env.GITHUB_REF,'refs/heads/main');
  assert.equal(git('.', 'rev-parse','HEAD'),expected.publisherCommit);assert.equal(git('.', 'status','--porcelain','--untracked-files=no'),'');
  assert.equal(git('source','rev-parse','HEAD'),expected.sourceCommit);assert.equal(git('source','status','--porcelain','--untracked-files=no'),'');
  assert.equal(git('source','rev-parse','HEAD^{tree}'),PINS.sourceTree);assert.equal(git('source','rev-parse','HEAD^'),PINS.sourceParent);
  for(const row of CONTROLLER_CHANGES){assert.equal(fs.lstatSync(row.filename).isFile(),true);assert.equal(fs.lstatSync(row.filename).isSymbolicLink(),false);assert.match(git('.','ls-files','--stage','--',row.filename),/^100644 [a-f0-9]{40} 0\t/);}
  const [main,head,controller,run,baseline,jobs,deployments,reviewArtifacts,baselineArtifact,baselineProof]=await Promise.all([
    request('git/ref/heads/main'),request('git/ref/heads/'+PINS.branch),request('commits/'+expected.publisherCommit),request('actions/runs/'+expected.sourceReview.runId),
    request('actions/runs/'+PINS.baselineRun),all('actions/runs/'+expected.sourceReview.runId+'/attempts/'+expected.sourceReview.runAttempt+'/jobs','jobs'),all('deployments?environment=github-pages'),
    all('actions/runs/'+expected.sourceReview.runId+'/artifacts','artifacts'),request('actions/artifacts/'+PINS.baselineArtifact.id),request('actions/artifacts/'+PINS.baselineProof.id),
  ]);
  assert.equal(main.object.sha,expected.publisherCommit);assert.equal(head.object.sha,expected.sourceCommit);checkController(controller,expected.publisherCommit);checkReview(run,jobs,expected);
  assert.equal(baseline.head_sha,PINS.baselinePublisher);assert.equal(baseline.path,PINS.controllerPath);assert.equal(baseline.head_branch,'main');assert.equal(baseline.run_attempt,1);assert.equal(baseline.status,'completed');assert.equal(baseline.conclusion,'success');
  const checkedArtifacts=[];for(const kind of ['build','source','cpu','native-contact','native-castle','summary']){const name=PINS.artifactStem+'-'+kind+'-'+expected.sourceReview.runId+'-'+expected.sourceReview.runAttempt,matching=reviewArtifacts.filter(a=>a.name===name);assert.equal(matching.length,1,'Exactly one source artifact from this attempt required');checkArtifact(matching[0],{name,runId:expected.sourceReview.runId,sourceCommit:expected.sourceCommit});checkedArtifacts.push({kind,artifact:matching[0]});}
  for(const [kind,artifact,pinned]of [['baseline',baselineArtifact,PINS.baselineArtifact],['accepted-publication',baselineProof,PINS.baselineProof]]){checkArtifact(artifact,{name:pinned.name,runId:PINS.baselineRun,sourceCommit:PINS.baselinePublisher,pinned});checkedArtifacts.push({kind,artifact});}
  const inspected=[];for(const deployment of deployments.sort((a,b)=>b.id-a.id)){const statuses=await all('deployments/'+deployment.id+'/statuses'),latest=statuses.sort((a,b)=>b.id-a.id)[0];inspected.push({id:deployment.id,sha:deployment.sha,state:latest?.state,logUrl:latest?.log_url,statusId:latest?.id});const own=deployment.sha===expected.publisherCommit&&new RegExp('/actions/runs/'+expected.publicationRun+'(?:/|$)').test(latest?.log_url||'');if(!own&&latest?.state==='success')break;}
  const acceptedDeployment=checkDeployments(inspected,expected.publisherCommit,expected.publicationRun);
  const publisherPaths=fs.readdirSync('.github/workflows').filter(file=>/actions\/deploy-pages|pages:\s*write/.test(fs.readFileSync('.github/workflows/'+file,'utf8'))).map(file=>'.github/workflows/'+file);
  for(const state of ['queued','in_progress'])for(const other of await all('actions/runs?status='+state,'workflow_runs'))if(other.id!==expected.publicationRun&&publisherPaths.includes(other.path))throw Error('Other active Pages workflow '+other.id);
  const logs=[];for(const job of jobs){const response=await request('actions/jobs/'+job.id+'/logs',{binary:true});const bytes=Buffer.from(await response.arrayBuffer());assert.ok(bytes.length>0&&bytes.length<20_000_000);const receipt=checkJobLog(bytes,job,expected),filename='proof/job-logs/'+job.id+'.log';fs.mkdirSync(path.dirname(filename),{recursive:true});if(fs.existsSync(filename))assert.equal(sha(fs.readFileSync(filename)),receipt.sha256,'Accepted provider log changed');else fs.writeFileSync(filename,bytes,{flag:'wx'});logs.push({name:job.name,id:job.id,conclusion:job.conclusion,rawLog:{path:'job-logs/'+job.id+'.log',...receipt}});}
  const metadata=[];for(const [name,commit]of [['build-info.json',PINS.canonicalSource],['puzzle-progression-finale/build-info.json',PINS.finaleSource]]){const response=await fetch(PINS.publicBase+name+'?tower41publisher='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(60000)});assert.ok(response.ok);const bytes=Buffer.from(await response.arrayBuffer()),value=JSON.parse(bytes);assert.equal(value.commit,commit);metadata.push({path:name,bytes:bytes.length,sha256:sha(bytes)});}
  if(phase==='deploy'){
    const binding=read('proof/package-binding.json'),manifest=read('proof/manifest.json'),pre=read('proof/predeploy-public-bytes.json');for(const proof of [binding,manifest,pre])for(const [key,value]of Object.entries(expected))assert.deepEqual(proof[key],value);
    const downloaded=read('proof/downloaded-inputs.json');for(const [key,value]of Object.entries(expected))assert.deepEqual(downloaded[key],value);assert.equal(downloaded.pass,true);assert.equal(downloaded.inputs.length,checkedArtifacts.length);
    for(const {kind,artifact}of checkedArtifacts){const retained=downloaded.inputs.filter(row=>row.kind===kind);assert.equal(retained.length,1);for(const key of ['id','name','size_in_bytes','digest'])assert.equal(retained[0].artifact[key],artifact[key],'Retained source artifact provenance changed');assert.equal(retained[0].artifact.workflow_run.id,artifact.workflow_run.id);assert.equal(retained[0].artifact.workflow_run.head_sha,artifact.workflow_run.head_sha);}
    assert.deepEqual(binding.jobs,logs,'Review job log provenance changed since assembly');assert.equal(pre.pass,true);assert.equal(pre.phase,'preflight');assert.equal(pre.checked,PINS.baselineFiles);assert.equal(pre.bytes,PINS.baselineBytes);
    assert.equal(pre.baselineFilesSha256,PINS.baselineInventorySha256);assert.equal(manifest.baselineFilesSha256,PINS.baselineInventorySha256);
  }
  // Check heads and current attempt again after potentially slow provider-log downloads.
  for(const state of ['queued','in_progress'])for(const other of await all('actions/runs?status='+state,'workflow_runs'))if(other.id!==expected.publicationRun&&publisherPaths.includes(other.path))throw Error('Other Pages workflow appeared during guard '+other.id);
  const [lastMain,lastHead,lastRun,lastDeployments]=await Promise.all([request('git/ref/heads/main'),request('git/ref/heads/'+PINS.branch),request('actions/runs/'+expected.sourceReview.runId),all('deployments?environment=github-pages')]);
  assert.equal(lastMain.object.sha,expected.publisherCommit);assert.equal(lastHead.object.sha,expected.sourceCommit);assert.equal(lastRun.run_attempt,expected.sourceReview.runAttempt);assert.equal(lastRun.conclusion,'success');
  const finalInspected=[];for(const deployment of lastDeployments.sort((a,b)=>b.id-a.id)){const statuses=await all('deployments/'+deployment.id+'/statuses'),latest=statuses.sort((a,b)=>b.id-a.id)[0];finalInspected.push({id:deployment.id,sha:deployment.sha,state:latest?.state,logUrl:latest?.log_url,statusId:latest?.id});const own=deployment.sha===expected.publisherCommit&&new RegExp('/actions/runs/'+expected.publicationRun+'(?:/|$)').test(latest?.log_url||'');if(!own&&latest?.state==='success')break;}
  const finalAccepted=checkDeployments(finalInspected,expected.publisherCommit,expected.publicationRun);assert.equal(finalAccepted.id,acceptedDeployment.id,'Accepted deployment changed during review guards');
  write('proof/github-guard-'+phase+'.json',{pass:true,phase,...expected,jobs:logs,artifacts:checkedArtifacts,acceptedDeployment:finalAccepted,inspectedDeployments:finalInspected,baselinePublication:baseline,sourceReviewRun:run,metadata,checkedAt:new Date().toISOString()});
}
async function downloadOne(artifact,filename){
  assert.equal(fs.existsSync(filename),false);fs.mkdirSync(path.dirname(filename),{recursive:true});const response=await request('actions/artifacts/'+artifact.id+'/zip',{binary:true});let size=0;const hash=createHash('sha256');
  const meter=new Transform({transform(bytes,encoding,done){try{size+=bytes.length;assert.ok(size<=artifact.size_in_bytes);hash.update(bytes);done(null,bytes);}catch(error){done(error);}}});
  await pipeline(Readable.fromWeb(response.body),meter,fs.createWriteStream(filename,{flags:'wx'}));assert.equal(size,artifact.size_in_bytes);assert.equal('sha256:'+hash.digest('hex'),artifact.digest);
}
async function download(){
  const expected=identity(),artifacts=await all('actions/runs/'+expected.sourceReview.runId+'/artifacts','artifacts'),rows=[];
  for(const kind of ['build','source','cpu','native-contact','native-castle','summary']){
    const name=PINS.artifactStem+'-'+kind+'-'+expected.sourceReview.runId+'-'+expected.sourceReview.runAttempt,matched=artifacts.filter(a=>a.name===name);assert.equal(matched.length,1);
    const artifact=matched[0];checkArtifact(artifact,{name,runId:expected.sourceReview.runId,sourceCommit:expected.sourceCommit});const filename='proof/downloads/'+kind+'.zip';await downloadOne(artifact,filename);rows.push({kind,filename,artifact});
  }
  for(const [kind,pinned]of [['baseline',PINS.baselineArtifact],['accepted-publication',PINS.baselineProof]]){const artifact=await request('actions/artifacts/'+pinned.id);checkArtifact(artifact,{name:pinned.name,runId:PINS.baselineRun,sourceCommit:PINS.baselinePublisher,pinned});const filename='proof/downloads/'+kind+'.zip';await downloadOne(artifact,filename);rows.push({kind,filename,artifact});}
  const run=await request('actions/runs/'+expected.sourceReview.runId);assert.equal(run.run_attempt,expected.sourceReview.runAttempt);assert.equal(run.conclusion,'success');write('proof/downloaded-inputs.json',{pass:true,...expected,inputs:rows});
}
function sourceEnv(){return {...process.env,GITHUB_SHA:PINS.sourceCommit,GITHUB_REF:'refs/heads/'+PINS.branch,GITHUB_RUN_ID:String(PINS.reviewRun),GITHUB_RUN_ATTEMPT:String(PINS.reviewAttempt),BUILD_COMMIT:PINS.sourceCommit,SOURCE_REVIEW_RUN_ID:String(PINS.reviewRun),SOURCE_REVIEW_RUN_ATTEMPT:String(PINS.reviewAttempt)};}
function runSource(...args){execFileSync(process.execPath,['scripts/qa-tower41-next-cell-source.mjs',...args],{cwd:'source',env:sourceEnv(),stdio:'inherit'});}
function installTree(from,to){assert.equal(fs.existsSync(to),false,'Refuse evidence overwrite');inventory(from);fs.mkdirSync(path.dirname(to),{recursive:true});fs.cpSync(from,to,{recursive:true,errorOnExist:true});assert.deepEqual(inventory(from),inventory(to));}
async function restore(reuse=false){
  const expected=identity(),receipt=read('proof/downloaded-inputs.json');for(const [key,value]of Object.entries(expected))assert.deepEqual(receipt[key],value);assert.equal(receipt.pass,true);
  const artifactRecords={};for(const item of receipt.inputs){
    if(item.kind==='baseline')continue;const output='proof/review-artifacts/'+item.kind;
    if(!reuse)execFileSync('python3',['scripts/publish-tower41-native.py','extract','--zip',item.filename,'--output',output,'--digest',item.artifact.digest,'--bytes',String(item.artifact.size_in_bytes),'--max-bytes','600000000'],{stdio:'inherit'});
    else {const archiveBytes=fs.readFileSync(item.filename);assert.equal(archiveBytes.length,item.artifact.size_in_bytes);assert.equal('sha256:'+sha(archiveBytes),item.artifact.digest);}
    artifactRecords[item.kind]={...item.artifact,files:inventory(output)};
  }
  installTree('proof/review-artifacts/build','source/dist');installTree('proof/review-artifacts/source','source/qa/tower41-next-cell-build');installTree('proof/review-artifacts/cpu','source/qa/tower41-next-cell-cpu');
  installTree('proof/review-artifacts/native-contact/tower41-next-cell-contact','source/qa/tower41-next-cell-contact');installTree('proof/review-artifacts/native-contact/tower41-next-cell-contact-movie','source/qa/tower41-next-cell-contact-movie');
  installTree('proof/review-artifacts/native-castle','source/qa/tower41-next-cell-castle');installTree('proof/review-artifacts/summary','source/qa/tower41-next-cell-summary');
  const bindingFiles=['source/qa/tower41-next-cell-contact/binding.json','source/qa/tower41-next-cell-castle/binding.json'];const priorBindingBytes=bindingFiles.map(file=>fs.readFileSync(file));
  runSource('source');runSource('verify-package');runSource('contact');runSource('castle');
  for(const [index,file]of bindingFiles.entries())assert.deepEqual(fs.readFileSync(file),priorBindingBytes[index],'The independent native binding must exactly match its retained reviewed receipt');
  const source=read('source/qa/tower41-next-cell-build/source.json'),pkg=read('source/qa/tower41-next-cell-build/package.json'),summary=read('source/qa/tower41-next-cell-summary/jobs.json');
  for(const record of [source,pkg,summary]){assert.equal(record.sourceCommit,expected.sourceCommit);assert.deepEqual(record.sourceReview,expected.sourceReview);}
  assert.equal(source.tree,git('source','rev-parse','HEAD^{tree}'));assert.equal(pkg.tree,source.tree);assert.equal(pkg.sourceInputsSha256,source.sourceInputsSha256);assert.equal(pkg.buildInfoSha256,sha(fs.readFileSync('source/dist/build-info.json')));
  assert.equal(summary.allRequiredJobsPassed,true);assert.deepEqual(summary.jobs,{'build':'success','cpu':'success','native-contact':'success','native-castle':'success'});
  assert.equal(pkg.fullTowerAccepted,false);assert.equal(pkg.publicationAccepted,false);assert.equal(pkg.runtimeModels.canonicalRecords.length,14);assert.ok(pkg.totalBytes>0&&pkg.totalBytes<=100_000_000);
  assert.equal(source.baseline.main,PINS.baselinePublisher);assert.equal(source.baseline.acceptedSource,PINS.finaleSource);assert.equal(source.baseline.canonicalSource,PINS.canonicalSource);
  for(const [field,filename]of [['canonicalMetadata','build-info.json'],['acceptedMetadata','puzzle-progression-finale/build-info.json']]){const row=read('proof/github-guard-prepare.json').metadata.find(row=>row.path===filename);assert.deepEqual(source.baseline[field],{bytes:row.bytes,sha256:row.sha256},'Reviewed baseline metadata changed before assembly');}
  const frozenCore=await import(pathToFileURL(path.resolve('source/scripts/lib/release-manifest.mjs')).href);assert.equal(source.sourceInputsSha256,sha(JSON.stringify(frozenCore.buildSourceInputs(path.resolve('source')))));
  for(const verifier of source.verifiers)assert.equal(sha(fs.readFileSync(path.join('source',verifier.file))),verifier.sha256);
  const cpu=read('source/qa/tower41-next-cell-cpu/report.json'),cpuBytes=fs.readFileSync('source/qa/tower41-next-cell-cpu/active-tests.log');assert.equal(cpu.log.bytes,cpuBytes.length);assert.equal(cpu.log.sha256,sha(cpuBytes));assert.equal(cpu.packageFilesSha256,pkg.nativePackage.packageFilesSha256);
  const module=await import(pathToFileURL(path.resolve('source/scripts/qa-tower41-next-cell-source.mjs')).href);assert.deepEqual(cpu.actual,module.parseTap(cpuBytes.toString('utf8')));
  const castle=read('source/qa/tower41-next-cell-castle/evidence.json');assert.equal(castle.previewSaveIsolation?.pass,true,'Exact native preview save/replay proof is mandatory');
  module.assertPreviewSaveIsolation(castle.previewSaveIsolation);assert.equal(castle.previewSaveIsolation.namespace,PINS.storagePrefix);
  assert.equal(castle.previewSaveIsolation.bareEntry.applicable,true,'The exact source review must already exercise the bare standalone namespace');assert.equal(castle.previewSaveIsolation.bareEntry.pass,true);
  assert.equal(castle.previewSaveIsolation.bareEntry.url,'http://127.0.0.1:4173/brainrot-portal/tower41-native/');
  const served=read('source/qa/tower41-next-cell-castle/served-package.json');assert.equal(served.pass,true);assert.equal(served.sourceCommit,expected.sourceCommit);assert.deepEqual(served.sourceReview,expected.sourceReview);assert.deepEqual(served.files,artifactRecords.build.files,'The recorded namespace must serve the entire exact reviewed build');
  const guard=read('proof/github-guard-prepare.json');
  const binding={schemaVersion:1,kind:'tower41-native-exact-review',...expected,artifacts:{build:artifactRecords.build,source:artifactRecords.source,cpu:artifactRecords.cpu,nativeContact:artifactRecords['native-contact'],nativeCastle:artifactRecords['native-castle'],summary:artifactRecords.summary},jobs:guard.jobs,coreSource:{tree:source.tree,sourceInputsSha256:source.sourceInputsSha256,sourceInputFiles:source.sourceInputFiles,verifiers:source.verifiers},packageFilesSha256:pkg.nativePackage.packageFilesSha256,buildInfoSha256:pkg.buildInfoSha256,preview:{path:PINS.namespace,query:PINS.query,storagePrefix:PINS.storagePrefix,levels:[41],ordinaryCastle:true,ratchetCell:false,saveIsolationAccepted:true},previewSaveIsolation:castle.previewSaveIsolation,supplemental:supplementalRecording(castle,artifactRecords['native-castle'].files,expected),fullTowerAccepted:false,fullCameraAccepted:false,humanPlaytestAccepted:false,physicalDeviceAccepted:false};
  const productionBytes=artifactRecords.build.files.reduce((sum,row)=>sum+row.bytes,0),supplementalCopiedBytes=binding.supplemental.reviewedFiles.reduce((sum,row)=>sum+row.bytes,0);
  console.log('TOWER41_NATIVE_MEASURED_BUDGET '+JSON.stringify({baselineBytes:PINS.baselineBytes,productionBytes,supplementalCopiedBytes,subtotalBytes:PINS.baselineBytes+productionBytes+supplementalCopiedBytes,maximumSiteBytes:600000000,generatedBytes:'Measured and enforced separately by the Python assembly manifest.'}));
  assert.deepEqual(inventory('source/dist'),artifactRecords.build.files,'Reviewed production bytes must remain unchanged');
  if(reuse)assert.deepEqual(read('proof/package-binding.json'),binding,'Retained exact package and evidence binding changed');else write('proof/package-binding.json',binding);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const [command,arg]=process.argv.slice(2);if(command==='guard')await guard(arg);else if(command==='download')await download();else if(command==='restore')await restore();else if(command==='restore-retained')await restore(true);else throw Error('Use guard prepare|deploy, download, restore, restore-retained');
}
