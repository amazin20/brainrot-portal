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
  branch:'upgrade/foundation20-physical-20261013-r5', reviewPath:'.github/workflows/tower41-next-cell-review.yml',
  // Fill only after independent exact-attempt source, logs, package and movie acceptance.
  sourceCommit:'3f2e83127dfd5800068854a98843d73eb9377609', sourceTree:'8a00a9e62642865d83c71039d72bf028dea46256', sourceParent:'5e552e9c3ac248b535d619741f15e99e29979cbf', reviewRun:38348119403, reviewAttempt:1,
  controllerPath:'.github/workflows/publish-puzzle-progression-finale.yml',
  controllerParent:'4ba2c891597394edae778c17ec2a266d8dba691a',
  baselinePublisher:'a74b64fe6d861baa94bbba7c6311794e6d520534', baselineRun:38300647905,
  canonicalSource:'8d2c01eacd86fe9235a35e7ec5f624ba62c3b29e', finaleSource:'0e257837ca157d59d29c2e892e9a81e4f21fc5a1',
  baselineFiles:1789, baselineBytes:592794475,
  baselineInventorySha256:'f7728df3a5cfdcaf1d49de047260baa20c72a3b35090213e8ff5cae43763fc72',
  baselineArtifact:{id:11770184490,name:'github-pages',size_in_bytes:549474265,digest:'sha256:573ab6c76a18ba5d2811fa2d3cd299a58772352b967e03370d16023eb9cf0363'},
  baselineProof:{id:11773770811,name:'tower41-native-publication-proof-38300647905-1',size_in_bytes:1265969704,digest:'sha256:a1acac27c2786f8b2c087245a55f75fb3bff9a2bc57df4edd9aba9262e5c6838'},
  baselineVerification:{id:11773576422,name:'tower41-native-verification-38300647905-1',size_in_bytes:38902095,digest:'sha256:d68fa5d19ca851451cdd050ec88e242e3bf75adfcb3f96a0b76b3a3508adf90e'},
  legacyPreviewSource:'58a71ddfc9bf704bef4c97fe13d16401c5a5f9f2', previousPreviewSource:'5e552e9c3ac248b535d619741f15e99e29979cbf',
  namespace:'tower41-native-v3/', query:'?edition=foundation&level=41&tower41preview=1',
  storagePrefix:'brainrot-tower41-native-v3:', artifactStem:'tower41-next-cell',
});
export const RECOVERY=Object.freeze({
  publisher:'387f00791b1b469c83d5a8ab680e12f669ff00d2',tree:'181b7044186a93ca840e06e600cd46684ab6d82f',run:38358383551,attempt:1,
  source:'3f2e83127dfd5800068854a98843d73eb9377609',sourceTree:'8a00a9e62642865d83c71039d72bf028dea46256',reviewRun:38348119403,reviewAttempt:1,
  files:1957,bytes:633671648,inventorySha256:'d76664e04f5ac2f2b161d9af10da1aa2299df13cfec51a243659d2b732be13c6',bindingSha256:'987db6be44dc54062f6e721cc0bcd67c80e0f466a27f0b62e636ec93f567c2bc',
  logs:Object.freeze([{id:115166511119,bytes:369831,sha256:'3313af5b6a953505b4ae08d51afcf13b9d73a60c04970589ddc4878e7a385dc3'},{id:115167206215,bytes:270632,sha256:'61ea61f79ac9f409f7b885836ca544c2de297d44400c68d1392c99ca24c4d22b'}]),
  pages:Object.freeze({id:11793193869,name:'github-pages',size_in_bytes:584433012,digest:'sha256:a75f0531e43459a5e0cb51352a83fb9b2044e585db9b91cc2f611898f2a66c1d'}),
  artifacts:Object.freeze([{id:11793193869,name:'github-pages',size_in_bytes:584433012,digest:'sha256:a75f0531e43459a5e0cb51352a83fb9b2044e585db9b91cc2f611898f2a66c1d'},
    {id:11793588970,name:'tower41-native-publication-proof-38358383551-1',size_in_bytes:739530543,digest:'sha256:71d97ead31457db704b7a6cc92c4075d8fa8074ebab1fac603ad5fefccbc4cac'},
    {id:11793158974,name:'tower41-native-prepared-38358383551-1',size_in_bytes:739485474,digest:'sha256:18ef6d89dd3749b3498303c1f6745effc3d782187656c95b4a14610d12da9543'}]),
});
export const MAX_SITE_BYTES=700_000_000;
export const MAX_SOURCE_ARTIFACT_BYTES=600_000_000;
export const MAX_PRIVATE_PROOF_BYTES=2_000_000_000;
export const ENTRIES=Object.freeze([
  Object.freeze({id:'foundation20',namespace:'foundation20-physical-v1/',level:20,storagePrefix:'brainrot-foundation20-physical-v1:',artifact:'nativeFoundation20',artifactKind:'native-foundation20',query:''}),
  Object.freeze({id:'tower41',namespace:PINS.namespace,level:41,storagePrefix:PINS.storagePrefix,artifact:'nativeCastle',artifactKind:'native-castle',query:PINS.query}),
]);
export const JOB_NAMES=Object.freeze(['build','cpu','native-contact','native-castle','native-foundation20','review-summary']);
export const CONTROLLER_CHANGES=Object.freeze([
  {filename:PINS.controllerPath,status:'modified'},
  ...['publish-tower41-native.mjs','test-publish-tower41-native.mjs'].map(file=>({filename:'scripts/'+file,status:'modified'})),
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
  assert.equal(jobs.length,JOB_NAMES.length);assert.deepEqual(jobs.map(j=>j.name).sort(),[...JOB_NAMES].sort());
  assert.equal(new Set(jobs.map(j=>j.id)).size,JOB_NAMES.length);
  for(const job of jobs){positive(job.id);assert.equal(job.run_id,run.id);assert.equal(job.run_attempt,run.run_attempt);assert.equal(job.head_sha,run.head_sha);assert.equal(job.status,'completed');assert.equal(job.conclusion,'success');}
}
export function assertVerifierContract(records,required){
  assert.ok(Array.isArray(required)&&required.length>0&&new Set(required).size===required.length,'An exact unique active verifier dependency list is required');
  assert.ok(Array.isArray(records));assert.deepEqual(records.map(row=>row.file),required,'Every exact active verifier dependency must be frozen once');
  assert.equal(new Set(records.map(row=>row.file)).size,records.length,'Duplicate frozen verifier dependency');
  for(const row of records){assert.deepEqual(Object.keys(row).sort(),['file','sha256']);assert.match(row.sha256,/^[a-f0-9]{64}$/);}
  return records;
}
export function checkController(commit,publisher){
  assert.equal(commit.sha,publisher);assert.deepEqual(commit.parents.map(p=>p.sha),[PINS.controllerParent],'Publisher must be one leased direct child of current main');
  assert.deepEqual(commit.files.map(({filename,status})=>({filename,status})).sort((a,b)=>a.filename.localeCompare(b.filename)),[...CONTROLLER_CHANGES].sort((a,b)=>a.filename.localeCompare(b.filename)),'Only the same controller and its tested helpers may change');
  for(const file of commit.files)assert.equal(file.previous_filename,undefined,'Renamed publication paths forbidden');
}
export function checkArtifact(artifact,{name,runId,sourceCommit,pinned}={}){
  positive(artifact.id);assert.equal(artifact.name,name);assert.equal(artifact.expired,false);assert.equal(artifact.workflow_run.id,runId);assert.equal(artifact.workflow_run.head_sha,sourceCommit);
  const privateProof=Object.entries(PINS.baselineProof).every(([key,value])=>pinned?.[key]===value);
  positive(artifact.size_in_bytes);assert.ok(artifact.size_in_bytes<=(privateProof?MAX_PRIVATE_PROOF_BYTES:MAX_SOURCE_ARTIFACT_BYTES),'Only the exact provider-pinned old private proof may exceed the archive budget');assert.match(artifact.digest||'',/^sha256:[a-f0-9]{64}$/);
  if(pinned)for(const [key,value]of Object.entries(pinned))assert.equal(artifact[key],value,'Pinned accepted artifact '+key);
}
export function checkJobLog(bytes,job,expected){
  const log=bytes.toString('utf8');assert.equal(Buffer.from(log).compare(bytes),0,'Provider log must be complete UTF-8');
  const markers=log.split(/\r?\n/).map(line=>line.replace(/^\d{4}-\d\d-\d\dT\S+\s+/,'')).filter(line=>line.startsWith('TOWER41_NEXT_JOB ')).map(line=>JSON.parse(line.slice('TOWER41_NEXT_JOB '.length)));
  const names=job.name==='review-summary'?JOB_NAMES.filter(name=>name!=='review-summary'):[job.name];
  assert.equal(markers.length,names.length,'Every provider log needs exact standalone source/job markers');assert.deepEqual(markers.map(m=>m.job).sort(),names.sort());
  for(const marker of markers){assert.equal(marker.sourceCommit,expected.sourceCommit);assert.deepEqual(marker.sourceReview,expected.sourceReview);assert.equal(marker.status,'success');}
  return {bytes:bytes.length,sha256:sha(bytes)};
}
export function checkDeployments(rows,publisher,runId,lease){
  assert.ok(lease&&lease.pass===true&&lease.kind==='exact-failed-after-deploy-R5-recovery-lease'&&lease.publicationAccepted===false&&lease.sourceAccepted===true,'A complete authenticated failed-publication recovery lease is required');
  for(const [key,value]of Object.entries({failedPublisher:RECOVERY.publisher,failedTree:RECOVERY.tree,failedRun:RECOVERY.run,failedAttempt:1,sourceCommit:RECOVERY.source,sourceTree:RECOVERY.sourceTree,currentFiles:RECOVERY.files,currentBytes:RECOVERY.bytes,currentInventorySha256:RECOVERY.inventorySha256,failedBindingSha256:RECOVERY.bindingSha256}))assert.equal(lease[key],value,'The exact authenticated recovery lease changed: '+key);
  assert.deepEqual(lease.sourceReview,{runId:RECOVERY.reviewRun,runAttempt:RECOVERY.reviewAttempt});
  for(const [key,phase,count,bytes,digest]of [['preflight','preflight',PINS.baselineFiles,PINS.baselineBytes,PINS.baselineInventorySha256],['published','published',RECOVERY.files,RECOVERY.bytes,RECOVERY.inventorySha256]]){const row=lease[key];assert.equal(row?.pass,true);assert.equal(row?.phase,phase);assert.equal(row?.mainSiteUnchanged,true);assert.equal(row?.publisherCommit,RECOVERY.publisher);assert.equal(row?.publicationRun,RECOVERY.run);assert.equal(row?.sourceCommit,RECOVERY.source);assert.deepEqual(row?.sourceReview,lease.sourceReview);assert.equal(row?.checked,count);assert.equal(row?.bytes,bytes);assert.equal(row?.siteFilesSha256,digest);assert.equal(row?.packageBindingSha256,RECOVERY.bindingSha256);}
  for(const row of rows){
    const runURL=id=>new RegExp('^https://github\\.com/'+PINS.repository+'/actions/runs/'+id+'(?:/|$)');
    const own=row.sha===publisher&&runURL(runId).test(row.logUrl||'');if(own)continue;
    assert.ok(row.state&&!['queued','pending','in_progress'].includes(row.state),'Overlapping Pages publication');
    assert.equal(row.sha,RECOVERY.publisher,'A newer unknown deployment cannot replace the exact failed-after-deploy recovery lease');
    assert.ok(['success','failure','error','inactive'].includes(row.state),'Only the authenticated failed-after-deploy row may retain an unsuccessful environment status');
    assert.ok(runURL(RECOVERY.run).test(row.logUrl||''),'Recovery deployment run changed');return row;
  }
  throw Error('No current accepted Pages deployment');
}
export function checkFailedRecovery(run,jobs,commit,artifacts,logs){
  assert.equal(PINS.sourceCommit,RECOVERY.source);assert.equal(PINS.sourceTree,RECOVERY.sourceTree);assert.equal(PINS.reviewRun,RECOVERY.reviewRun);assert.equal(PINS.reviewAttempt,RECOVERY.reviewAttempt);
  assert.equal(run.id,RECOVERY.run);assert.equal(run.run_attempt,RECOVERY.attempt);assert.equal(run.head_sha,RECOVERY.publisher);assert.equal(run.head_commit.tree_id,RECOVERY.tree);assert.equal(run.status,'completed');assert.equal(run.conclusion,'failure');assert.equal(run.event,'push');assert.equal(run.path,PINS.controllerPath);assert.equal(run.head_branch,'main');
  assert.equal(commit.sha,RECOVERY.publisher);assert.equal(commit.tree.sha,RECOVERY.tree);assert.deepEqual(commit.parents.map(p=>p.sha),[PINS.baselinePublisher]);
  assert.equal(jobs.length,2);assert.deepEqual(jobs.map(j=>j.id).sort(),RECOVERY.logs.map(j=>j.id).sort());
  for(const job of jobs){assert.equal(job.run_id,RECOVERY.run);assert.equal(job.run_attempt,1);assert.equal(job.head_sha,RECOVERY.publisher);assert.equal(job.status,'completed');}
  const first=jobs.find(j=>j.id===RECOVERY.logs[0].id),last=jobs.find(j=>j.id===RECOVERY.logs[1].id);assert.equal(first.conclusion,'success');assert.equal(last.conclusion,'failure');
  assert.equal(first.name,'Assemble the exact reviewed preview without changing the current site');assert.equal(last.name,'Verify every existing byte, append the preview and execute its actual public ordinary journey');
  assert.deepEqual(last.steps.filter(s=>s.conclusion==='failure').map(s=>s.name),['Complete the actual public Foundation20 ordinary hook, cable, far stop and cargo return']);
  for(const name of ['Verify all 1789 existing public files and their 592794475 exact bytes','Run actions/deploy-pages@v4','Verify the union of every unchanged old file and every added preview file']){const found=last.steps.filter(s=>s.name===name);assert.equal(found.length,1);assert.equal(found[0].status,'completed');assert.equal(found[0].conclusion,'success');}
  const pages=artifacts.filter(a=>a.name==='github-pages');assert.equal(pages.length,1);checkArtifact(pages[0],{name:RECOVERY.pages.name,runId:RECOVERY.run,sourceCommit:RECOVERY.publisher,pinned:RECOVERY.pages});
  assert.equal(artifacts.length,RECOVERY.artifacts.length);for(const pin of RECOVERY.artifacts){const matches=artifacts.filter(a=>a.id===pin.id);assert.equal(matches.length,1);const a=matches[0];for(const key of ['id','name','size_in_bytes','digest'])assert.equal(a[key],pin[key]);assert.equal(a.expired,false);assert.equal(a.workflow_run.id,RECOVERY.run);assert.equal(a.workflow_run.head_sha,RECOVERY.publisher);assert.ok(a.size_in_bytes<=MAX_PRIVATE_PROOF_BYTES);}
  assert.equal(logs.length,2);for(const pin of RECOVERY.logs){const row=logs.find(r=>r.id===pin.id);assert.ok(row);assert.equal(row.bytes.length,pin.bytes);assert.equal(sha(row.bytes),pin.sha256);}
  const text=logs.find(r=>r.id===last.id).bytes.toString('utf8');assert.ok(text.includes('Release definitions or configuration differ from the pinned source'));assert.ok(text.includes("+   run: '"+RECOVERY.reviewRun+"'"));assert.ok(text.includes("-   run: '"+RECOVERY.run+"'"));
  const receipts=text.split(/\r?\n/).map(l=>l.replace(/^(?:\uFEFF)?\d{4}-\d\d-\d\dT\S+ ?/,'')).filter(l=>l.startsWith('{')).flatMap(l=>{try{return [JSON.parse(l)];}catch{return [];}}).filter(r=>['preflight','published'].includes(r.phase));assert.equal(receipts.length,2);
  for(const [index,phase]of ['preflight','published'].entries()){const r=receipts[index];assert.equal(r.phase,phase);assert.equal(r.pass,true);assert.equal(r.mainSiteUnchanged,true);assert.equal(r.sourceCommit,RECOVERY.source);assert.deepEqual(r.sourceReview,{runId:RECOVERY.reviewRun,runAttempt:RECOVERY.reviewAttempt});assert.equal(r.publisherCommit,RECOVERY.publisher);assert.equal(r.publicationRun,RECOVERY.run);assert.equal(r.checked,index?RECOVERY.files:PINS.baselineFiles);assert.equal(r.bytes,index?RECOVERY.bytes:PINS.baselineBytes);assert.equal(r.siteFilesSha256,index?RECOVERY.inventorySha256:PINS.baselineInventorySha256);}
  assert.equal(receipts[1].packageBindingSha256,RECOVERY.bindingSha256);
  return {pass:true,kind:'exact-failed-after-deploy-R5-recovery-lease',publicationAccepted:false,sourceAccepted:true,failedPublisher:RECOVERY.publisher,failedTree:RECOVERY.tree,failedRun:RECOVERY.run,failedAttempt:1,sourceCommit:RECOVERY.source,sourceTree:RECOVERY.sourceTree,sourceReview:{runId:RECOVERY.reviewRun,runAttempt:1},currentFiles:RECOVERY.files,currentBytes:RECOVERY.bytes,currentInventorySha256:RECOVERY.inventorySha256,failedBindingSha256:RECOVERY.bindingSha256,preflight:receipts[0],published:receipts[1]};
}
async function recoveryLease(){
  const [run,jobs,commit,artifacts]=await Promise.all([request('actions/runs/'+RECOVERY.run),all('actions/runs/'+RECOVERY.run+'/attempts/1/jobs','jobs'),request('git/commits/'+RECOVERY.publisher),all('actions/runs/'+RECOVERY.run+'/artifacts','artifacts')]);
  const logs=[];for(const pin of RECOVERY.logs){const response=await request('actions/jobs/'+pin.id+'/logs',{binary:true}),bytes=Buffer.from(await response.arrayBuffer());logs.push({id:pin.id,bytes});const filename='proof/recovery-job-logs/'+pin.id+'.log';fs.mkdirSync(path.dirname(filename),{recursive:true});if(fs.existsSync(filename))assert.deepEqual(fs.readFileSync(filename),bytes);else fs.writeFileSync(filename,bytes,{flag:'wx'});}
  const lease=checkFailedRecovery(run,jobs,commit,artifacts,logs);write('proof/recovery-failed-provider.json',{run,jobs,commit,artifacts,lease});return lease;
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
export function assertFoundation20CameraDescriptor(camera,artifactFiles,frames,scope){
  assert.ok(camera&&typeof camera==='object'&&!Array.isArray(camera),'Every current native20 report needs its actual camera descriptor');
  assert.deepEqual(Object.keys(camera).sort(),['filename','bytes','sha256','diagnosticVerified','samples','allOriginalSamplesInsideLens','allEligibleSamplesInsideLens','independentIndexedSkinReconstruction','meshFlagEligibilityOnly','unsupportedClippingRefused','cameraAccepted','scope'].sort(),'Exact bounded native20 camera descriptor fields required');
  assert.equal(camera.filename,'foundation20-native-camera.json');
  assert.equal(typeof camera.bytes,'number');positive(camera.bytes);assert.ok(camera.bytes<=25_000_000,'Complete native20 camera file exceeds25M');assert.match(camera.sha256,/^[a-f0-9]{64}$/);
  positive(frames);assert.equal(typeof camera.samples,'number');assert.equal(camera.samples,frames);assert.ok(camera.samples<=6001,'Native20 capture count exceeds the terminal-inclusive record budget');
  for(const key of ['diagnosticVerified','allOriginalSamplesInsideLens','allEligibleSamplesInsideLens','meshFlagEligibilityOnly','unsupportedClippingRefused'])assert.equal(camera[key],true,key);
  for(const key of ['independentIndexedSkinReconstruction','cameraAccepted'])assert.equal(camera[key],false,key);
  assert.equal(typeof scope,'string');assert.ok(scope.length>0,'Externally frozen native20 scope required');assert.equal(camera.scope,scope,'Native20 scope must match the frozen source observer');
  assert.ok(Array.isArray(artifactFiles));const rows=artifactFiles.filter(row=>row.path===camera.filename);assert.equal(rows.length,1,'Exactly one actual complete native20 camera artifact member required');
  assert.equal(rows[0].bytes,camera.bytes);assert.equal(rows[0].sha256,camera.sha256);
  return camera;
}
export function supplementalFoundation20(report,artifactFiles,expected,cameraScope){
  assert.equal(report.pass,true);assert.equal(report.sourceCommit,expected.sourceCommit);assert.deepEqual(report.sourceReview,expected.sourceReview);
  assert.equal(report.route?.kind,'ordinary-foundation20-physical-route');assert.equal(report.route.edition,'foundation');assert.equal(report.route.level,20);assert.equal(report.route.id,'foundation-portal-tension');assert.equal(report.route.pass,true);assert.equal(report.route.sameCompanion,true);assert.equal(report.route.cargoMass,3.2);
  for(const key of ['resets','respawns','cargoResets'])assert.equal(report.route[key],0);
  assert.deepEqual(report.errors,[]);assert.equal(report.video?.filename,'foundation20-physical.mp4');assert.equal(report.video.fullMP4Decode,true);
  for(const [key,value]of Object.entries({fps:4,width:640,height:360}))assert.equal(report.video[key],value);
  positive(report.video.frames);assert.equal(report.video.durationSeconds,report.video.frames/report.video.fps);assert.equal(report.video.simulationSeconds,report.route.seconds);
  assertFoundation20CameraDescriptor(report.cameraDiagnostic,artifactFiles,report.video.frames,cameraScope);
  const movie=artifactFiles.filter(row=>row.path===report.video.filename),evidence=artifactFiles.filter(row=>row.path==='foundation20-native-report.json');assert.equal(movie.length,1);assert.equal(evidence.length,1);assert.equal(movie[0].sha256,report.video.sha256);assert.equal(movie[0].bytes,report.video.bytes);positive(movie[0].bytes);positive(evidence[0].bytes);
  const sourceIdentity={sourceCommit:expected.sourceCommit,sourceReview:expected.sourceReview};
  return {reviewedFiles:[{sourceArtifact:'nativeFoundation20',sourcePath:movie[0].path,path:'evidence/foundation20-physical.mp4',bytes:movie[0].bytes,sha256:movie[0].sha256,...sourceIdentity},{sourceArtifact:'nativeFoundation20',sourcePath:evidence[0].path,path:'evidence/foundation20-native-report.json',bytes:evidence[0].bytes,sha256:evidence[0].sha256,...sourceIdentity}],recording:{...sourceIdentity,filename:'evidence/foundation20-physical.mp4',report:'evidence/foundation20-native-report.json',bytes:movie[0].bytes,sha256:movie[0].sha256,...Object.fromEntries(['frames','fps','width','height','durationSeconds','simulationSeconds'].map(key=>[key,report.video[key]]))}};
}
async function request(resource,{binary=false}={}){
  assert.ok(process.env.GITHUB_TOKEN);const response=await fetch('https://api.github.com/repos/'+PINS.repository+'/'+resource,{headers:{Authorization:'Bearer '+process.env.GITHUB_TOKEN,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(binary?600000:60000)});
  assert.ok(response.ok,'GitHub HTTP '+response.status+' '+resource);return binary?response:response.json();
}
async function all(resource,key){const rows=[];for(let page=1;page<=50;page++){const result=await request(resource+(resource.includes('?')?'&':'?')+'per_page=100&page='+page),batch=key?result[key]:result;assert.ok(Array.isArray(batch));rows.push(...batch);if(batch.length<100)return rows;}throw Error('Provider pagination exceeded bounded inspection');}
export async function readPublicMetadata(url,{fetcher=globalThis.fetch,wait=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds)),now=Date.now,logRetry=receipt=>console.warn('TOWER41_PUBLIC_METADATA_RETRY',JSON.stringify(receipt))}={}){
  const address=new URL(url),transientStatus=new Set([408,429,500,502,503,504]),transientCode=new Set(['ECONNRESET','ETIMEDOUT','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_BODY_TIMEOUT','UND_ERR_SOCKET']);
  const retry=async(attempt,status,response=null)=>{
    let delayMs=1000*2**(attempt-1);const raw=response?.headers?.get('retry-after');
    if(typeof raw==='string'&&raw.trim()){
      const text=raw.trim(),milliseconds=/^\d+$/.test(text)?Number(text)*1000:Date.parse(text)-now();
      if(Number.isFinite(milliseconds))delayMs=Math.max(delayMs,Math.min(5000,Math.max(0,milliseconds)));
    }
    logRetry({url:address.origin+address.pathname,status,attempt,nextAttempt:attempt+1,maximumAttempts:4,delayMs});await wait(delayMs);
  };
  for(let attempt=1;attempt<=4;attempt++){
    let response,bytes;
    try{
      response=await fetcher(url,{method:'GET',cache:'no-store',signal:AbortSignal.timeout(60000)});
      if(response.ok)bytes=Buffer.from(await response.arrayBuffer());
    }catch(error){
      const code=error?.code||error?.cause?.code,transient=error?.name==='TimeoutError'||error?.cause?.name==='TimeoutError'||transientCode.has(code);
      if(!transient||attempt===4)throw error;
      await retry(attempt,transientCode.has(code)?code:'TimeoutError');continue;
    }
    if(!response.ok&&transientStatus.has(response.status)&&attempt<4){
      try{await response.body?.cancel();}catch{}
      await retry(attempt,response.status,response);continue;
    }
    assert.ok(response.ok,'Public metadata HTTP '+response.status+' '+address.pathname);
    // Full bytes are read afresh; JSON, hash and pinned identity checks remain outside retries.
    return bytes;
  }
}
async function guard(phase){
  assert.ok(['prepare','deploy'].includes(phase));const expected=identity();assert.equal(process.env.GITHUB_REPOSITORY,PINS.repository);assert.equal(process.env.GITHUB_REF,'refs/heads/main');
  assert.equal(git('.', 'rev-parse','HEAD'),expected.publisherCommit);assert.equal(git('.', 'status','--porcelain','--untracked-files=no'),'');
  assert.equal(git('source','rev-parse','HEAD'),expected.sourceCommit);assert.equal(git('source','status','--porcelain','--untracked-files=no'),'');
  assert.equal(git('source','rev-parse','HEAD^{tree}'),PINS.sourceTree);assert.equal(git('source','rev-parse','HEAD^'),PINS.sourceParent);
  for(const row of CONTROLLER_CHANGES){assert.equal(fs.lstatSync(row.filename).isFile(),true);assert.equal(fs.lstatSync(row.filename).isSymbolicLink(),false);assert.match(git('.','ls-files','--stage','--',row.filename),/^100644 [a-f0-9]{40} 0\t/);}
  const [main,head,controller,run,baseline,jobs,deployments,reviewArtifacts,baselineArtifact,baselineProof,baselineVerification]=await Promise.all([
    request('git/ref/heads/main'),request('git/ref/heads/'+PINS.branch),request('commits/'+expected.publisherCommit),request('actions/runs/'+expected.sourceReview.runId),
    request('actions/runs/'+PINS.baselineRun),all('actions/runs/'+expected.sourceReview.runId+'/attempts/'+expected.sourceReview.runAttempt+'/jobs','jobs'),all('deployments?environment=github-pages'),
    all('actions/runs/'+expected.sourceReview.runId+'/artifacts','artifacts'),request('actions/artifacts/'+PINS.baselineArtifact.id),request('actions/artifacts/'+PINS.baselineProof.id),request('actions/artifacts/'+PINS.baselineVerification.id),
  ]);
  assert.equal(main.object.sha,expected.publisherCommit);assert.equal(head.object.sha,expected.sourceCommit);checkController(controller,expected.publisherCommit);checkReview(run,jobs,expected);
  assert.equal(baseline.head_sha,PINS.baselinePublisher);assert.equal(baseline.path,PINS.controllerPath);assert.equal(baseline.head_branch,'main');assert.equal(baseline.run_attempt,1);assert.equal(baseline.status,'completed');assert.equal(baseline.conclusion,'success');
  const checkedArtifacts=[];for(const kind of ['build','source','cpu','native-contact','native-castle','native-foundation20','summary']){const name=PINS.artifactStem+'-'+kind+'-'+expected.sourceReview.runId+'-'+expected.sourceReview.runAttempt,matching=reviewArtifacts.filter(a=>a.name===name);assert.equal(matching.length,1,'Exactly one source artifact from this attempt required');checkArtifact(matching[0],{name,runId:expected.sourceReview.runId,sourceCommit:expected.sourceCommit});checkedArtifacts.push({kind,artifact:matching[0]});}
  checkArtifact(baselineProof,{name:PINS.baselineProof.name,runId:PINS.baselineRun,sourceCommit:PINS.baselinePublisher,pinned:PINS.baselineProof});
  for(const [kind,artifact,pinned]of [['baseline',baselineArtifact,PINS.baselineArtifact],['accepted-publication',baselineVerification,PINS.baselineVerification]]){checkArtifact(artifact,{name:pinned.name,runId:PINS.baselineRun,sourceCommit:PINS.baselinePublisher,pinned});checkedArtifacts.push({kind,artifact});}
  const inspected=[];for(const deployment of deployments.sort((a,b)=>b.id-a.id)){const statuses=await all('deployments/'+deployment.id+'/statuses'),latest=statuses.sort((a,b)=>b.id-a.id)[0];inspected.push({id:deployment.id,sha:deployment.sha,state:latest?.state,logUrl:latest?.log_url,statusId:latest?.id});const own=deployment.sha===expected.publisherCommit&&new RegExp('/actions/runs/'+expected.publicationRun+'(?:/|$)').test(latest?.log_url||'');if(!own&&latest?.state==='success')break;}
  write('proof/recovery-inspected-deployments-'+phase+'.json',{kind:'actual-provider-recovery-deployment-diagnostic',publicationAccepted:false,...expected,rows:inspected});console.log('TOWER41_RECOVERY_DEPLOYMENTS '+JSON.stringify({phase,rows:inspected}));
  const recovery=await recoveryLease();const acceptedDeployment=checkDeployments(inspected,expected.publisherCommit,expected.publicationRun,recovery);
  const publisherPaths=fs.readdirSync('.github/workflows').filter(file=>/actions\/deploy-pages|pages:\s*write/.test(fs.readFileSync('.github/workflows/'+file,'utf8'))).map(file=>'.github/workflows/'+file);
  for(const state of ['queued','in_progress'])for(const other of await all('actions/runs?status='+state,'workflow_runs'))if(other.id!==expected.publicationRun&&publisherPaths.includes(other.path))throw Error('Other active Pages workflow '+other.id);
  const logs=[];for(const job of jobs){const response=await request('actions/jobs/'+job.id+'/logs',{binary:true});const bytes=Buffer.from(await response.arrayBuffer());assert.ok(bytes.length>0&&bytes.length<20_000_000);const receipt=checkJobLog(bytes,job,expected),filename='proof/job-logs/'+job.id+'.log';fs.mkdirSync(path.dirname(filename),{recursive:true});if(fs.existsSync(filename))assert.equal(sha(fs.readFileSync(filename)),receipt.sha256,'Accepted provider log changed');else fs.writeFileSync(filename,bytes,{flag:'wx'});logs.push({name:job.name,id:job.id,conclusion:job.conclusion,rawLog:{path:'job-logs/'+job.id+'.log',...receipt}});}
  const metadata=[];for(const [name,commit]of [['build-info.json',PINS.canonicalSource],['puzzle-progression-finale/build-info.json',PINS.finaleSource],['tower41-native/build-info.json',PINS.legacyPreviewSource],['tower41-native-v2/build-info.json',PINS.previousPreviewSource]]){const bytes=await readPublicMetadata(PINS.publicBase+name+'?tower41publisher='+Date.now()),value=JSON.parse(bytes);assert.equal(value.commit,commit);metadata.push({path:name,bytes:bytes.length,sha256:sha(bytes)});}
  if(phase==='deploy'){
    const binding=read('proof/package-binding.json'),manifest=read('proof/manifest.json'),pre=read('proof/predeploy-public-bytes.json');for(const proof of [binding,manifest,pre])for(const [key,value]of Object.entries(expected))assert.deepEqual(proof[key],value);
    const downloaded=read('proof/downloaded-inputs.json');for(const [key,value]of Object.entries(expected))assert.deepEqual(downloaded[key],value);assert.equal(downloaded.pass,true);assert.equal(downloaded.inputs.length,checkedArtifacts.length);
    for(const {kind,artifact}of checkedArtifacts){const retained=downloaded.inputs.filter(row=>row.kind===kind);assert.equal(retained.length,1);for(const key of ['id','name','size_in_bytes','digest'])assert.equal(retained[0].artifact[key],artifact[key],'Retained source artifact provenance changed');assert.equal(retained[0].artifact.workflow_run.id,artifact.workflow_run.id);assert.equal(retained[0].artifact.workflow_run.head_sha,artifact.workflow_run.head_sha);}
    assert.deepEqual(binding.jobs,logs,'Review job log provenance changed since assembly');assert.equal(pre.pass,true);assert.equal(pre.phase,'preflight');assert.equal(pre.checked,RECOVERY.files);assert.equal(pre.bytes,RECOVERY.bytes);
    assert.equal(pre.baselineFilesSha256,RECOVERY.inventorySha256);assert.equal(manifest.baselineFilesSha256,RECOVERY.inventorySha256);
  }
  // Check heads and current attempt again after potentially slow provider-log downloads.
  for(const state of ['queued','in_progress'])for(const other of await all('actions/runs?status='+state,'workflow_runs'))if(other.id!==expected.publicationRun&&publisherPaths.includes(other.path))throw Error('Other Pages workflow appeared during guard '+other.id);
  const [lastMain,lastHead,lastRun,lastDeployments]=await Promise.all([request('git/ref/heads/main'),request('git/ref/heads/'+PINS.branch),request('actions/runs/'+expected.sourceReview.runId),all('deployments?environment=github-pages')]);
  assert.equal(lastMain.object.sha,expected.publisherCommit);assert.equal(lastHead.object.sha,expected.sourceCommit);assert.equal(lastRun.run_attempt,expected.sourceReview.runAttempt);assert.equal(lastRun.conclusion,'success');
  const finalInspected=[];for(const deployment of lastDeployments.sort((a,b)=>b.id-a.id)){const statuses=await all('deployments/'+deployment.id+'/statuses'),latest=statuses.sort((a,b)=>b.id-a.id)[0];finalInspected.push({id:deployment.id,sha:deployment.sha,state:latest?.state,logUrl:latest?.log_url,statusId:latest?.id});const own=deployment.sha===expected.publisherCommit&&new RegExp('/actions/runs/'+expected.publicationRun+'(?:/|$)').test(latest?.log_url||'');if(!own&&latest?.state==='success')break;}
  write('proof/recovery-final-inspected-deployments-'+phase+'.json',{kind:'actual-provider-recovery-final-deployment-diagnostic',publicationAccepted:false,...expected,rows:finalInspected});
  const finalAccepted=checkDeployments(finalInspected,expected.publisherCommit,expected.publicationRun,recovery);assert.equal(finalAccepted.id,acceptedDeployment.id,'Accepted deployment changed during review guards');
  write('proof/github-guard-'+phase+'.json',{pass:true,phase,...expected,jobs:logs,artifacts:checkedArtifacts,acceptedDeployment:finalAccepted,inspectedDeployments:finalInspected,recoveryLease:recovery,baselinePublication:baseline,sourceReviewRun:run,metadata,baselineFullPrivateProof:{artifact:baselineProof,providerRetentionAndDigestBound:true,archiveBytesDownloaded:false,nestedArchiveAudited:false},checkedAt:new Date().toISOString()});
}
async function downloadOne(artifact,filename){
  assert.equal(fs.existsSync(filename),false);fs.mkdirSync(path.dirname(filename),{recursive:true});const response=await request('actions/artifacts/'+artifact.id+'/zip',{binary:true});let size=0;const hash=createHash('sha256');
  const meter=new Transform({transform(bytes,encoding,done){try{size+=bytes.length;assert.ok(size<=artifact.size_in_bytes);hash.update(bytes);done(null,bytes);}catch(error){done(error);}}});
  await pipeline(Readable.fromWeb(response.body),meter,fs.createWriteStream(filename,{flags:'wx'}));assert.equal(size,artifact.size_in_bytes);assert.equal('sha256:'+hash.digest('hex'),artifact.digest);
}
async function download(){
  const expected=identity(),artifacts=await all('actions/runs/'+expected.sourceReview.runId+'/artifacts','artifacts'),rows=[];
  for(const kind of ['build','source','cpu','native-contact','native-castle','native-foundation20','summary']){
    const name=PINS.artifactStem+'-'+kind+'-'+expected.sourceReview.runId+'-'+expected.sourceReview.runAttempt,matched=artifacts.filter(a=>a.name===name);assert.equal(matched.length,1);
    const artifact=matched[0];checkArtifact(artifact,{name,runId:expected.sourceReview.runId,sourceCommit:expected.sourceCommit});const filename='proof/downloads/'+kind+'.zip';await downloadOne(artifact,filename);rows.push({kind,filename,artifact});
  }
  for(const [kind,pinned]of [['baseline',PINS.baselineArtifact],['accepted-publication',PINS.baselineVerification]]){const artifact=await request('actions/artifacts/'+pinned.id);checkArtifact(artifact,{name:pinned.name,runId:PINS.baselineRun,sourceCommit:PINS.baselinePublisher,pinned});const filename='proof/downloads/'+kind+'.zip';await downloadOne(artifact,filename);rows.push({kind,filename,artifact});}
  const run=await request('actions/runs/'+expected.sourceReview.runId);assert.equal(run.run_attempt,expected.sourceReview.runAttempt);assert.equal(run.conclusion,'success');write('proof/downloaded-inputs.json',{pass:true,...expected,inputs:rows});
}
function sourceEnv(){return {...process.env,GITHUB_SHA:PINS.sourceCommit,GITHUB_REF:'refs/heads/'+PINS.branch,GITHUB_RUN_ID:String(PINS.reviewRun),GITHUB_RUN_ATTEMPT:String(PINS.reviewAttempt),BUILD_COMMIT:PINS.sourceCommit,SOURCE_REVIEW_RUN_ID:String(PINS.reviewRun),SOURCE_REVIEW_RUN_ATTEMPT:String(PINS.reviewAttempt)};}
function runSource(...args){execFileSync(process.execPath,['scripts/qa-tower41-next-cell-source.mjs',...args],{cwd:'source',env:sourceEnv(),stdio:'inherit'});}
function installTree(from,to){assert.equal(fs.existsSync(to),false,'Refuse evidence overwrite');inventory(from);fs.mkdirSync(path.dirname(to),{recursive:true});fs.cpSync(from,to,{recursive:true,errorOnExist:true});assert.deepEqual(inventory(from),inventory(to));}
async function restore(reuse=false){
  const expected=identity(),receipt=read('proof/downloaded-inputs.json');for(const [key,value]of Object.entries(expected))assert.deepEqual(receipt[key],value);assert.equal(receipt.pass,true);
  const artifactRecords={};for(const item of receipt.inputs){
    if(item.kind==='baseline')continue;const output='proof/review-artifacts/'+item.kind;
    if(!reuse){
      if(item.kind==='accepted-publication')execFileSync('python3',['scripts/publish-tower41-native.py','extract-accepted','--zip',item.filename,'--output',output],{stdio:'inherit'});
      else execFileSync('python3',['scripts/publish-tower41-native.py','extract','--zip',item.filename,'--output',output,'--digest',item.artifact.digest,'--bytes',String(item.artifact.size_in_bytes),'--max-bytes',String(MAX_SOURCE_ARTIFACT_BYTES)],{stdio:'inherit'});
    }
    else {const archiveBytes=fs.readFileSync(item.filename);assert.equal(archiveBytes.length,item.artifact.size_in_bytes);assert.equal('sha256:'+sha(archiveBytes),item.artifact.digest);}
    artifactRecords[item.kind]={...item.artifact,files:inventory(output)};
  }
  installTree('proof/review-artifacts/build','source/dist');installTree('proof/review-artifacts/source','source/qa/tower41-next-cell-build');installTree('proof/review-artifacts/cpu','source/qa/tower41-next-cell-cpu');
  installTree('proof/review-artifacts/native-contact/tower41-next-cell-contact','source/qa/tower41-next-cell-contact');installTree('proof/review-artifacts/native-contact/tower41-next-cell-contact-movie','source/qa/tower41-next-cell-contact-movie');
  installTree('proof/review-artifacts/native-castle','source/qa/tower41-next-cell-castle');installTree('proof/review-artifacts/summary','source/qa/tower41-next-cell-summary');
  installTree('proof/review-artifacts/native-foundation20','source/qa/tower41-next-cell-foundation20');
  const bindingFiles=['source/qa/tower41-next-cell-contact/binding.json','source/qa/tower41-next-cell-castle/binding.json','source/qa/tower41-next-cell-foundation20/binding.json'];const priorBindingBytes=bindingFiles.map(file=>fs.readFileSync(file));
  runSource('source');runSource('verify-package');runSource('contact');runSource('castle');runSource('foundation20');
  for(const [index,file]of bindingFiles.entries())assert.deepEqual(fs.readFileSync(file),priorBindingBytes[index],'The independent native binding must exactly match its retained reviewed receipt');
  const source=read('source/qa/tower41-next-cell-build/source.json'),pkg=read('source/qa/tower41-next-cell-build/package.json'),summary=read('source/qa/tower41-next-cell-summary/jobs.json');
  for(const record of [source,pkg,summary]){assert.equal(record.sourceCommit,expected.sourceCommit);assert.deepEqual(record.sourceReview,expected.sourceReview);}
  assert.equal(source.tree,git('source','rev-parse','HEAD^{tree}'));assert.equal(pkg.tree,source.tree);assert.equal(pkg.sourceInputsSha256,source.sourceInputsSha256);assert.equal(pkg.buildInfoSha256,sha(fs.readFileSync('source/dist/build-info.json')));
  assert.equal(summary.allRequiredJobsPassed,true);assert.deepEqual(summary.jobs,Object.fromEntries(JOB_NAMES.filter(name=>name!=='review-summary').map(name=>[name,'success'])));
  assert.deepEqual(source.reviewContract,{jobs:[...JOB_NAMES],artifactKinds:['build','source','cpu','native-contact','native-castle','native-foundation20','summary']});
  assert.equal(pkg.fullTowerAccepted,false);assert.equal(pkg.publicationAccepted,false);assert.equal(pkg.runtimeModels.canonicalRecords.length,14);assert.ok(pkg.totalBytes>0&&pkg.totalBytes<=100_000_000);
  assert.equal(source.baseline.main,PINS.baselinePublisher);assert.equal(source.baseline.acceptedSource,PINS.finaleSource);assert.equal(source.baseline.canonicalSource,PINS.canonicalSource);assert.equal(source.baseline.legacyPreviewSource,PINS.legacyPreviewSource);assert.equal(source.baseline.previousPreviewSource,PINS.previousPreviewSource);
  for(const [field,filename]of [['canonicalMetadata','build-info.json'],['acceptedMetadata','puzzle-progression-finale/build-info.json'],['legacyPreviewMetadata','tower41-native/build-info.json'],['previousPreviewMetadata','tower41-native-v2/build-info.json']]){const row=read('proof/github-guard-prepare.json').metadata.find(row=>row.path===filename);assert.deepEqual(source.baseline[field],{bytes:row.bytes,sha256:row.sha256},'Reviewed baseline metadata changed before assembly');}
  const frozenCore=await import(pathToFileURL(path.resolve('source/scripts/lib/release-manifest.mjs')).href);assert.equal(source.sourceInputsSha256,sha(JSON.stringify(frozenCore.buildSourceInputs(path.resolve('source')))));
  for(const verifier of source.verifiers)assert.equal(sha(fs.readFileSync(path.join('source',verifier.file))),verifier.sha256);
  const cpu=read('source/qa/tower41-next-cell-cpu/report.json'),cpuBytes=fs.readFileSync('source/qa/tower41-next-cell-cpu/active-tests.log');assert.equal(cpu.log.bytes,cpuBytes.length);assert.equal(cpu.log.sha256,sha(cpuBytes));assert.equal(cpu.packageFilesSha256,pkg.nativePackage.packageFilesSha256);
  const module=await import(pathToFileURL(path.resolve('source/scripts/qa-tower41-next-cell-source.mjs')).href);assert.deepEqual(cpu.actual,module.parseTap(cpuBytes.toString('utf8')));
  assert.deepEqual([...module.SOURCE_REVIEW_JOBS],[...JOB_NAMES]);assert.deepEqual([...module.SOURCE_REVIEW_ARTIFACT_KINDS],source.reviewContract.artifactKinds);
  assertVerifierContract(source.verifiers,[...module.SOURCE_REVIEW_VERIFIERS]);
  const castle=read('source/qa/tower41-next-cell-castle/evidence.json');assert.equal(castle.previewSaveIsolation?.pass,true,'Exact native preview save/replay proof is mandatory');
  module.assertPreviewSaveIsolation(castle.previewSaveIsolation);assert.equal(castle.previewSaveIsolation.namespace,PINS.storagePrefix);
  assert.equal(castle.previewSaveIsolation.bareEntry.applicable,true,'The exact source review must already exercise the bare standalone namespace');assert.equal(castle.previewSaveIsolation.bareEntry.pass,true);
  assert.equal(castle.previewSaveIsolation.bareEntry.url,'http://127.0.0.1:4173/brainrot-portal/tower41-native-v3/');
  const physical=await import(pathToFileURL(path.resolve('source/scripts/lib/tower41-pendulum-proof.mjs')).href);
  const pendulumEvents=castle.observed.events.filter(event=>event.id==='pendulum');assert.equal(pendulumEvents.length,1);
  const pendulum=physical.assertPendulumPhysicalProof(pendulumEvents[0].proof,castle.observed.bodyId);
  assert.deepEqual(read('source/qa/tower41-next-cell-castle/binding.json').pendulum,pendulum,'Retained native pendulum binding differs');
  const served=read('source/qa/tower41-next-cell-castle/served-package.json');assert.equal(served.pass,true);assert.equal(served.sourceCommit,expected.sourceCommit);assert.deepEqual(served.sourceReview,expected.sourceReview);assert.deepEqual(served.files,artifactRecords.build.files,'The recorded namespace must serve the entire exact reviewed build');
  const foundation20Report=read('source/qa/tower41-next-cell-foundation20/foundation20-native-report.json'),foundation20Receipt=read('source/qa/tower41-next-cell-foundation20/binding.json');
  const foundation20Module=await import(pathToFileURL(path.resolve('source/scripts/lib/foundation20-native-proof.mjs')));
  foundation20Module.assertFoundation20NativeReport(foundation20Report,{sourceCommit:expected.sourceCommit,sourceReview:expected.sourceReview,nativePackage:pkg.nativePackage});
  const {createFoundation20NativeCameraObserverApi}=await import(pathToFileURL(path.resolve('source/scripts/lib/foundation20-native-camera-observer.mjs')));
  const camera20Pins={sourceCommit:source.sourceCommit,sourceReview:source.sourceReview,tree:source.tree,sourceInputsSha256:source.sourceInputsSha256,packageFilesSha256:pkg.nativePackage.packageFilesSha256,
    journeySha256:sha(fs.readFileSync('source/src/game/LabFoundation20PhysicalJourney.js')),browserSeamSha256:sha(fs.readFileSync('source/scripts/qa-foundation20-native.mjs')),
    cameraObserverSha256:sha(fs.readFileSync('source/scripts/lib/foundation20-native-camera-observer.mjs')),cameraProofSha256:sha(fs.readFileSync('source/scripts/lib/foundation20-native-camera-proof.mjs'))};
  const camera20Scope=createFoundation20NativeCameraObserverApi(camera20Pins).scope;
  assertFoundation20CameraDescriptor(foundation20Report.cameraDiagnostic,artifactRecords['native-foundation20'].files,foundation20Report.video.frames,camera20Scope);
  assert.deepEqual(foundation20Report.cameraDiagnostic,foundation20Receipt.cameraDiagnostic,'Source native20 report and retained independent camera binding must match');
  const served20=read('source/qa/tower41-next-cell-foundation20/served-package.json');assert.equal(served20.pass,true);assert.equal(served20.sourceCommit,expected.sourceCommit);assert.deepEqual(served20.sourceReview,expected.sourceReview);assert.deepEqual(served20.files,artifactRecords.build.files,'Both ordinary rooms must serve the whole one exact reviewed build');
  assert.equal(foundation20Receipt.pass,true);assert.equal(foundation20Receipt.sourceCommit,expected.sourceCommit);assert.deepEqual(foundation20Receipt.sourceReview,expected.sourceReview);assert.equal(foundation20Receipt.packageFilesSha256,pkg.nativePackage.packageFilesSha256);
  const bare20=foundation20Report.saveIsolation.bareEntry;assert.equal(bare20.pass,true);assert.equal(bare20.url,'http://127.0.0.1:4173/brainrot-portal/foundation20-physical-v1/');assert.equal(bare20.search,'');assert.equal(bare20.level,20);
  const guard=read('proof/github-guard-prepare.json');
  const binding={schemaVersion:1,kind:'foundation20-and-tower41-native-exact-review',...expected,artifacts:{build:artifactRecords.build,source:artifactRecords.source,cpu:artifactRecords.cpu,nativeContact:artifactRecords['native-contact'],nativeCastle:artifactRecords['native-castle'],nativeFoundation20:artifactRecords['native-foundation20'],summary:artifactRecords.summary},jobs:guard.jobs,coreSource:{tree:source.tree,sourceInputsSha256:source.sourceInputsSha256,sourceInputFiles:source.sourceInputFiles,verifiers:source.verifiers},packageFilesSha256:pkg.nativePackage.packageFilesSha256,buildInfoSha256:pkg.buildInfoSha256,entries:ENTRIES,preview:{path:PINS.namespace,query:PINS.query,storagePrefix:PINS.storagePrefix,levels:[41],ordinaryCastle:true,ratchetCell:false,saveIsolationAccepted:true},previewSaveIsolation:castle.previewSaveIsolation,pendulum,cameraObservation:castle.cameraObservation,supplemental:supplementalRecording(castle,artifactRecords['native-castle'].files,expected),foundation20:{saveIsolation:foundation20Report.saveIsolation,receipt:foundation20Receipt,supplemental:supplementalFoundation20(foundation20Report,artifactRecords['native-foundation20'].files,expected,camera20Scope)},baselineFullPrivateProof:guard.baselineFullPrivateProof,fullTowerAccepted:false,fullCameraAccepted:false,humanPlaytestAccepted:false,physicalDeviceAccepted:false};
  const productionBytes=artifactRecords.build.files.reduce((sum,row)=>sum+row.bytes,0),supplementalCopiedBytes=[binding.supplemental,binding.foundation20.supplemental].flatMap(value=>value.reviewedFiles).reduce((sum,row)=>sum+row.bytes,0);
  console.log('TOWER41_NATIVE_MEASURED_BUDGET '+JSON.stringify({baselineBytes:PINS.baselineBytes,productionBytes,productionCopies:ENTRIES.length,supplementalCopiedBytes,subtotalBytes:PINS.baselineBytes+productionBytes*ENTRIES.length+supplementalCopiedBytes,maximumSiteBytes:MAX_SITE_BYTES,generatedBytes:'Measured and enforced separately by the Python assembly manifest.'}));
  assert.deepEqual(inventory('source/dist'),artifactRecords.build.files,'Reviewed production bytes must remain unchanged');
  if(reuse)assert.deepEqual(read('proof/package-binding.json'),binding,'Retained exact package and evidence binding changed');else write('proof/package-binding.json',binding);
  const deployedBinding={...binding,publisherCommit:RECOVERY.publisher,publicationRun:RECOVERY.run},deployedBytes=Buffer.from(JSON.stringify(deployedBinding,null,2)+'\n');assert.equal(sha(deployedBytes),RECOVERY.bindingSha256,'Reconstructed actual failed-deployment binding differs');
  if(reuse)assert.deepEqual(fs.readFileSync('proof/failed-deployed-package-binding.json'),deployedBytes);else fs.writeFileSync('proof/failed-deployed-package-binding.json',deployedBytes,{flag:'wx'});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const [command,arg]=process.argv.slice(2);if(command==='guard')await guard(arg);else if(command==='download')await download();else if(command==='restore')await restore();else if(command==='restore-retained')await restore(true);else throw Error('Use guard prepare|deploy, download, restore, restore-retained');
}
