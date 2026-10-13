import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {PINS,RECOVERY,ENTRIES,JOB_NAMES,CONTROLLER_CHANGES,positive,identity,checkReview,assertVerifierContract,checkController,checkArtifact,checkJobLog,checkDeployments,inventory,supplementalRecording,supplementalFoundation20,assertFoundation20CameraDescriptor,readPublicMetadata} from './publish-tower41-native.mjs';
const expected={sourceCommit:'a'.repeat(40),sourceReview:{runId:42,runAttempt:2}};
const clone=value=>structuredClone(value);
const review=()=>({id:42,run_attempt:2,head_sha:expected.sourceCommit,head_branch:PINS.branch,path:PINS.reviewPath,event:'push',status:'completed',conclusion:'success'});
const jobs=()=>JOB_NAMES.map((name,index)=>({name,id:index+100,run_id:42,run_attempt:2,head_sha:expected.sourceCommit,status:'completed',conclusion:'success'}));
const controller=()=>({sha:'b'.repeat(40),parents:[{sha:PINS.controllerParent}],files:CONTROLLER_CHANGES.map(row=>({...row}))});
test('the actual public20 shell launch binds the frozen source stamp and preserves a separate real PUBLIC producer',()=>{
  const workflow=fs.readFileSync('.github/workflows/publish-puzzle-progression-finale.yml','utf8');
  const step=workflow.split('      - name: Complete the actual public Foundation20 ordinary hook, cable, far stop and cargo return\n')[1]?.split('\n      - name: ')[0];
  assert.ok(step);
  for(const [field,context]of [['PUBLIC_PRODUCER_RUN_ID','github.run_id'],['PUBLIC_PRODUCER_RUN_ATTEMPT','github.run_attempt'],['PUBLIC_PRODUCER_HEAD_SHA','github.sha']])assert.ok(step.includes(field+": '${{ "+context+" }}'"));
  assert.equal(/^\s+GITHUB_(RUN_ID|RUN_ATTEMPT|SHA|REF):/m.test(step),false,'GitHub reserved YAML env cannot select source metadata');
  const match=step.match(/        run: \|\n([\s\S]*)$/);assert.ok(match);
  const body=match[1].split('\n').map(line=>line.replace(/^          /,'')).join('\n');
  const command='timeout --signal=TERM --kill-after=10s 1800s node scripts/qa-foundation20-native.mjs';
  assert.equal(body.split(command).length,2,'Exactly one unchanged frozen recorder command must remain');
  const probe=`node --input-type=module -e 'console.log(JSON.stringify({run:process.env.GITHUB_RUN_ID,attempt:process.env.GITHUB_RUN_ATTEMPT,sha:process.env.GITHUB_SHA,producerRun:process.env.PUBLIC_PRODUCER_RUN_ID,producerAttempt:process.env.PUBLIC_PRODUCER_RUN_ATTEMPT,producerSha:process.env.PUBLIC_PRODUCER_HEAD_SHA,producerUrl:process.env.PUBLIC_PRODUCER_URL}))'`;
  const env={...process.env,GITHUB_RUN_ID:'99',GITHUB_RUN_ATTEMPT:'2',GITHUB_SHA:'b'.repeat(40),SOURCE_REVIEW_RUN_ID:'42',SOURCE_REVIEW_RUN_ATTEMPT:'1',BUILD_COMMIT:'a'.repeat(40),PUBLIC_PRODUCER_RUN_ID:'99',PUBLIC_PRODUCER_RUN_ATTEMPT:'2',PUBLIC_PRODUCER_HEAD_SHA:'b'.repeat(40),PUBLIC_PRODUCER_URL:'https://github.com/amazin20/brainrot-portal/actions/runs/99'};
  const original=spawnSync('bash',['-e','-c',probe],{env,encoding:'utf8'});assert.equal(original.status,0);assert.equal(JSON.parse(original.stdout).run,'99','Actual inherited GitHub runner ignores source-only YAML intent');
  const fixed=spawnSync('bash',['-e','-c',body.replace(command,probe)],{env,encoding:'utf8'});assert.equal(fixed.status,0,fixed.stderr);
  const actual=JSON.parse(fixed.stdout.trim().split('\n').at(-1));assert.deepEqual(actual,{run:'42',attempt:'1',sha:'a'.repeat(40),producerRun:'99',producerAttempt:'2',producerSha:'b'.repeat(40),producerUrl:env.PUBLIC_PRODUCER_URL});
  assert.notEqual(actual.run,actual.producerRun);
  for(const field of ['PUBLIC_PRODUCER_RUN_ID','PUBLIC_PRODUCER_RUN_ATTEMPT','PUBLIC_PRODUCER_HEAD_SHA']){const bad=spawnSync('bash',['-e','-c',body.replace(command,probe)],{env:{...env,[field]:'wrong'},encoding:'utf8'});assert.notEqual(bad.status,0,'Mismatched actual PUBLIC origin must fail before capture');}
});
test('numeric pins reject booleans, zero, lossy numbers and decorated strings',()=>{
  assert.equal(positive('42'),42);assert.equal(positive(42),42);
  for(const invalid of [true,false,0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'0','042','42.0','42junk',undefined])assert.throws(()=>positive(invalid));
});
test('identity blocks pending pins and binds every accepted environment field exactly',()=>{
  const valid={BUILD_COMMIT:PINS.sourceCommit,SOURCE_REVIEW_RUN_ID:String(PINS.reviewRun),SOURCE_REVIEW_RUN_ATTEMPT:String(PINS.reviewAttempt),GITHUB_SHA:'b'.repeat(40),GITHUB_RUN_ID:'99'};
  const previous=Object.fromEntries(Object.keys(valid).map(key=>[key,process.env[key]]));
  try{
    Object.assign(process.env,valid);
    if(PINS.reviewRun===0||PINS.reviewAttempt===0)assert.throws(()=>identity(),'Pending review pins cannot form a publication identity');
    else {
      assert.deepEqual(identity(),{sourceCommit:PINS.sourceCommit,sourceReview:{runId:PINS.reviewRun,runAttempt:PINS.reviewAttempt},publisherCommit:'b'.repeat(40),publicationRun:99});
      for(const [key,value]of [['BUILD_COMMIT','f'.repeat(40)],['SOURCE_REVIEW_RUN_ID',String(PINS.reviewRun+1)],['SOURCE_REVIEW_RUN_ID','0'],['SOURCE_REVIEW_RUN_ATTEMPT',String(PINS.reviewAttempt+1)],['SOURCE_REVIEW_RUN_ATTEMPT','0'],['GITHUB_SHA','short'],['GITHUB_RUN_ID','0'],['GITHUB_RUN_ID','99junk']]){Object.assign(process.env,valid);process.env[key]=value;assert.throws(()=>identity(),key+' cannot rebind accepted publication evidence');}
    }
  }finally{for(const [key,value]of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
test('accept only six independent successful jobs of this source and current exact attempt',()=>{
  checkReview(review(),jobs(),expected);
  for(const [key,value]of [['id',43],['run_attempt',1],['head_sha','c'.repeat(40)],['head_branch','main'],['path','other.yml'],['event','workflow_dispatch'],['status','in_progress'],['conclusion','failure']]){const valueRun=review();valueRun[key]=value;assert.throws(()=>checkReview(valueRun,jobs(),expected));}
});
test('missing, duplicate, skipped and stale review jobs are rejected',()=>{
  assert.throws(()=>checkReview(review(),jobs().slice(1),expected));
  const duplicate=jobs();duplicate[4]=clone(duplicate[3]);assert.throws(()=>checkReview(review(),duplicate,expected));
  for(const [key,value]of [['id',100],['name','gate'],['run_id',41],['run_attempt',1],['head_sha','d'.repeat(40)],['status','in_progress'],['conclusion','skipped']]){const valueJobs=jobs();valueJobs[2][key]=value;assert.throws(()=>checkReview(review(),valueJobs,expected));}
});
test('main may change only the same controller and its tested helper files in one leased commit',()=>{
  checkController(controller(),'b'.repeat(40));
  for(const mutate of [v=>v.parents.push({sha:PINS.controllerParent}),v=>v.parents[0].sha='d'.repeat(40),v=>v.parents[0].sha=PINS.baselinePublisher,v=>v.files.pop(),v=>v.files.push({filename:'src/main.js',status:'modified'}),v=>v.files[0].status='added',v=>v.files[1].previous_filename='old-name.mjs']){const value=controller();mutate(value);assert.throws(()=>checkController(value,'b'.repeat(40)));}
});
test('artifact checksum, exact source, run and expiry are mandatory',()=>{
  const pinned={id:7,name:'build-42-2',size_in_bytes:20,digest:'sha256:'+'e'.repeat(64)};
  const value={...pinned,expired:false,workflow_run:{id:42,head_sha:expected.sourceCommit}};
  const options={name:pinned.name,runId:42,sourceCommit:expected.sourceCommit,pinned};checkArtifact(value,options);
  for(const mutate of [v=>v.id=8,v=>v.name='build-42-1',v=>v.expired=true,v=>v.workflow_run.id=43,v=>v.workflow_run.head_sha='f'.repeat(40),v=>v.size_in_bytes=600_000_001,v=>v.digest='sha256:bad']){const changed=clone(value);mutate(changed);assert.throws(()=>checkArtifact(changed,options));}
});
const marker=(job,status='success',identity=expected)=>'TOWER41_NEXT_JOB '+JSON.stringify({job,status,...identity});
test('only the fully pinned accepted private proof can exceed 600MB without relaxing source and Pages budgets',()=>{
  const value={...PINS.baselineProof,expired:false,workflow_run:{id:PINS.baselineRun,head_sha:PINS.baselinePublisher}};
  const options={name:PINS.baselineProof.name,runId:PINS.baselineRun,sourceCommit:PINS.baselinePublisher,pinned:PINS.baselineProof};
  checkArtifact(value,options);
  assert.throws(()=>checkArtifact(value,{...options,pinned:undefined}));
  assert.throws(()=>checkArtifact(value,{...options,pinned:{...PINS.baselineProof,id:PINS.baselineProof.id+1}}));
  assert.throws(()=>checkArtifact({...value,size_in_bytes:2_000_000_001},options));
});
test('provider markers must be complete standalone exact-attempt source receipts',()=>{
  const job={name:'cpu'};checkJobLog(Buffer.from('2026-10-12T01:02:03.123Z '+marker('cpu')+'\n'),job,expected);
  for(const invalid of [marker('build'),marker('cpu','failure'),marker('cpu','success',{...expected,sourceReview:{runId:42,runAttempt:1}}),marker('cpu')+'\n'+marker('cpu'),'shell echo '+marker('cpu'),marker('cpu')+' trailing',Buffer.from([0xff,0xfe])])assert.throws(()=>checkJobLog(Buffer.isBuffer(invalid)?invalid:Buffer.from(invalid),job,expected));
});
test('summary log must independently bind each of the five required job results once',()=>{
  const lines=JOB_NAMES.filter(name=>name!=='review-summary').map(name=>marker(name));checkJobLog(Buffer.from(lines.join('\n')),{name:'review-summary'},expected);
  assert.throws(()=>checkJobLog(Buffer.from(lines.slice(1).join('\n')),{name:'review-summary'},expected));
  assert.throws(()=>checkJobLog(Buffer.from([...lines,lines[0]].join('\n')),{name:'review-summary'},expected));
});
test('latest deployment must belong only to the exact failed-after-deploy recovery lease without overlaps',()=>{
  const accepted={sha:RECOVERY.publisher,state:'success',logUrl:'https://github.com/amazin20/brainrot-portal/actions/runs/'+RECOVERY.run+'/job/123'};
  checkDeployments([accepted],'b'.repeat(40),99);
  checkDeployments([{sha:'b'.repeat(40),state:'in_progress',logUrl:'https://github.com/amazin20/brainrot-portal/actions/runs/99/job/12'},accepted],'b'.repeat(40),99);
  for(const row of [{...accepted,state:'pending'},{...accepted,state:'in_progress'},{...accepted,sha:'c'.repeat(40)},{...accepted,sha:PINS.baselinePublisher},{...accepted,logUrl:'https://github.com/amazin20/brainrot-portal/actions/runs/100/job/1'}])assert.throws(()=>checkDeployments([row,accepted],'b'.repeat(40),99));
});
test('an inventory cannot silently follow a link or include a special file',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'tower41-publisher-'));
  try{fs.writeFileSync(path.join(root,'ordinary'),'retained');assert.equal(inventory(root).length,1);fs.symlinkSync(path.join(root,'ordinary'),path.join(root,'link'));assert.throws(()=>inventory(root));}finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('player publication URL is ordinary preview with isolated saves and no debug or ratchet flags',()=>{
  const url=new URL(PINS.publicBase+PINS.namespace+PINS.query);
  assert.equal(url.pathname,'/brainrot-portal/tower41-native-v3/');assert.equal(url.searchParams.get('edition'),'foundation');assert.equal(url.searchParams.get('level'),'41');assert.equal(url.searchParams.get('tower41preview'),'1');assert.equal(url.searchParams.has('debug'),false);assert.equal(url.searchParams.has('tower41ratchet'),false);assert.equal(url.searchParams.has('pilot'),false);
});
test('walkthrough supplements bind only the actual reviewed ordinary movie and unaltered report',()=>{
  const evidence={sourceCommit:expected.sourceCommit,video:{filename:'tower-singularity.mp4',sha256:'c'.repeat(64),frames:100,fps:4,width:640,height:360,durationSeconds:25,simulationSeconds:24.95},result:{pass:true,metrics:{won:true,completedStages:11},sameCompanion:true,resets:0,respawns:0,cargoResets:0,seconds:24.95},observed:{seenResets:0}};
  const rows=[{path:'evidence.json',bytes:70,sha256:'d'.repeat(64)},{path:'tower-singularity.mp4',bytes:100,sha256:'c'.repeat(64)}];
  const value=supplementalRecording(evidence,rows,expected);assert.deepEqual(value.reviewedFiles.map(row=>row.path),['evidence/tower41-native.mp4','evidence/tower41-native-report.json']);assert.equal(value.recording.durationSeconds,25);assert.deepEqual(value.recording.sourceReview,expected.sourceReview);
  for(const mutate of [v=>v.sourceCommit='b'.repeat(40),v=>v.video.filename='../different.mp4',v=>v.video.sha256='e'.repeat(64),v=>v.video.durationSeconds=900,v=>v.result.respawns=1,v=>v.result.sameCompanion=false,v=>v.result.metrics.completedStages=500]){const changed=clone(evidence);mutate(changed);assert.throws(()=>supplementalRecording(changed,rows,expected));}
  assert.throws(()=>supplementalRecording(evidence,rows.slice(1),expected));assert.throws(()=>supplementalRecording(evidence,[...rows,clone(rows[0])],expected));
});

test('two actual bare namespaces use distinct own saves and preserve the immutable v2 path',()=>{
  assert.deepEqual(ENTRIES.map(entry=>entry.namespace),['foundation20-physical-v1/','tower41-native-v3/']);
  assert.deepEqual(ENTRIES.map(entry=>entry.level),[20,41]);
  assert.equal(new Set(ENTRIES.map(entry=>entry.storagePrefix)).size,2);
  for(const entry of ENTRIES){const url=new URL(PINS.publicBase+entry.namespace);assert.equal(url.search,'');assert.ok(!url.pathname.includes('native-v2'));}
});
// Protocol metadata fixtures only: no manufactured row is native evidence.
const camera20Scope='Actual Foundation20 encoded native capture and terminal; the frozen producer measures all original current skin vertices. Eligibility covers object/material/layer flags only, with unsupported main or player material clipping refused. Independent Node checks schema, clocks, finite cache shape/padding, ranges and extrema reprojection; it does not reconstruct all indexed skin vertices. NDC bounds do not establish pixel visibility, occlusion, every-render-frame coverage or camera acceptance.';
function camera20Fixture(frames=40){
 const camera={filename:'foundation20-native-camera.json',bytes:1000,sha256:'9'.repeat(64),diagnosticVerified:true,samples:frames,allOriginalSamplesInsideLens:true,allEligibleSamplesInsideLens:true,independentIndexedSkinReconstruction:false,meshFlagEligibilityOnly:true,unsupportedClippingRefused:true,cameraAccepted:false,scope:camera20Scope};
 return {camera,rows:[{path:camera.filename,bytes:camera.bytes,sha256:camera.sha256}]};
}
test('room20 supplements reject classic rooms, foreign cargo, resets, swapped source and movie metadata',()=>{
 const {camera,rows:cameraRows}=camera20Fixture();
 const report={pass:true,sourceCommit:expected.sourceCommit,sourceReview:expected.sourceReview,errors:[],cameraDiagnostic:camera,route:{kind:'ordinary-foundation20-physical-route',edition:'foundation',level:20,id:'foundation-portal-tension',pass:true,sameCompanion:true,cargoMass:3.2,resets:0,respawns:0,cargoResets:0,seconds:10},video:{filename:'foundation20-physical.mp4',bytes:100,sha256:'c'.repeat(64),frames:40,fps:4,width:640,height:360,durationSeconds:10,simulationSeconds:10,fullMP4Decode:true}};
 const rows=[{path:'foundation20-native-report.json',bytes:90,sha256:'d'.repeat(64)},{path:'foundation20-physical.mp4',bytes:100,sha256:'c'.repeat(64)},...cameraRows];
 const value=supplementalFoundation20(report,rows,expected,camera20Scope);assert.equal(value.reviewedFiles[0].sourceArtifact,'nativeFoundation20');assert.equal(value.recording.filename,'evidence/foundation20-physical.mp4');assert.equal(value.reviewedFiles.length,2,'Raw camera evidence is retained in proof, while public supplemental copies remain the whole movie and report');
 for(const mutate of [v=>v.route.edition='classic',v=>v.route.id='braided-exchange',v=>v.route.sameCompanion=false,v=>v.route.cargoMass=4,v=>v.route.resets=1,v=>v.sourceReview.runAttempt=1,v=>v.video.filename='tower-singularity.mp4',v=>v.video.sha256='e'.repeat(64),v=>v.video.bytes++,v=>v.video.fullMP4Decode=false,v=>v.video.simulationSeconds=999,v=>delete v.cameraDiagnostic]){const changed=clone(report);mutate(changed);assert.throws(()=>supplementalFoundation20(changed,rows,expected,camera20Scope));}
 assert.throws(()=>supplementalFoundation20(report,rows.slice(1),expected,camera20Scope));assert.throws(()=>supplementalFoundation20(report,[...rows,clone(rows[1])],expected,camera20Scope));
 assert.throws(()=>supplementalFoundation20(report,rows.slice(0,2),expected,camera20Scope),'Report pass=true cannot waive a missing whole raw camera member');
});
for(const [label,mutate]of Object.entries({
 missingDescriptor:f=>f.camera=null,
 missingRaw:f=>f.rows=[],
 duplicateRaw:f=>f.rows.push(clone(f.rows[0])),
 splicedRawHash:f=>f.rows[0].sha256='8'.repeat(64),
 splicedRawBytes:f=>f.rows[0].bytes++,
 foreignFile:f=>f.camera.filename='camera-observation.json',
 countMismatch:f=>f.camera.samples++,
 nonIntegerCount:f=>f.camera.samples=40.5,
 originalCrop:f=>f.camera.allOriginalSamplesInsideLens=false,
 eligibleCrop:f=>f.camera.allEligibleSamplesInsideLens=false,
 unverified:f=>f.camera.diagnosticVerified=false,
 unsupportedClip:f=>f.camera.unsupportedClippingRefused=false,
 inferredEligibility:f=>f.camera.meshFlagEligibilityOnly=false,
 falseIndexedSkin:f=>f.camera.independentIndexedSkinReconstruction=true,
 falseCameraAcceptance:f=>f.camera.cameraAccepted=true,
 scopeOverclaim:f=>f.camera.scope+=' Full-room, all-frame pixel visibility and human camera acceptance.',
 extraAcceptance:f=>f.camera.fullCameraAccepted=true,
 missingScope:f=>delete f.camera.scope,
 stringBytes:f=>f.camera.bytes=String(f.camera.bytes),
 oversized:f=>{f.camera.bytes=25000001;f.rows[0].bytes=f.camera.bytes;},
}))test('mandatory room20 camera descriptor rejects '+label,()=>{
 const f=camera20Fixture();mutate(f);assert.throws(()=>assertFoundation20CameraDescriptor(f.camera,f.rows,40,camera20Scope));
});
test('native20 descriptor accepts only the actual bounded member and externally frozen scope',()=>{
 const f=camera20Fixture();assert.equal(assertFoundation20CameraDescriptor(f.camera,f.rows,40,camera20Scope),f.camera);
 assert.throws(()=>assertFoundation20CameraDescriptor(f.camera,f.rows,40,undefined));
 assert.throws(()=>assertFoundation20CameraDescriptor(f.camera,f.rows,40,'foreign frozen observer scope'));
 const tooMany=camera20Fixture(6002);assert.throws(()=>assertFoundation20CameraDescriptor(tooMany.camera,tooMany.rows,6002,camera20Scope));
});


test('frozen verifier ABI cannot omit a serialized native helper or substitute a stale dependency list',()=>{
 const required=['scripts/qa-foundation20-native.mjs','scripts/lib/foundation20-native-camera-observer.mjs','scripts/lib/foundation20-native-camera-proof.mjs','scripts/lib/native-portal-material-identity.mjs','scripts/lib/tower41-native-camera-observer.mjs'];
 const records=required.map(file=>({file,sha256:'a'.repeat(64)}));assert.equal(assertVerifierContract(records,required),records);
 for(const mutate of [v=>v.splice(1,1),v=>v.push(clone(v[0])),v=>v.reverse(),v=>v[1].file='scripts/lib/retired-material-identity.mjs',v=>v[1].sha256='bad',v=>v[1].sha256=null,v=>v[1].sourceCommit='a'.repeat(40)]){const value=clone(records);mutate(value);assert.throws(()=>assertVerifierContract(value,required));}
 assert.throws(()=>assertVerifierContract(records,[...required,required[0]]));
 for(const file of ['scripts/lib/foundation20-native-camera-observer.mjs','scripts/lib/foundation20-native-camera-proof.mjs'])assert.throws(()=>assertVerifierContract(records.filter(row=>row.file!==file),required),'The dynamically required native20 sampler/helper cannot be omitted');
});

const metadataURL=PINS.publicBase+'build-info.json?tower41publisher=diagnostic';
const metadataBytes=Buffer.from(JSON.stringify({commit:PINS.canonicalSource}));
function publicReadFixture(steps){
 const calls=[],delays=[],logs=[];let cancelled=0,bodyReads=0;
 const options={
  fetcher:async(url,options)=>{
   calls.push({url,options});assert.ok(calls.length<=steps.length,'Unexpected additional GET');const step=steps[calls.length-1];
   if(step.error)throw step.error;
   return {ok:step.status>=200&&step.status<300,status:step.status,headers:new Headers(step.retryAfter===undefined?{}:{'retry-after':step.retryAfter}),body:{cancel:async()=>{cancelled++;}},arrayBuffer:async()=>{bodyReads++;if(step.bodyError)throw step.bodyError;return step.bytes??metadataBytes;}};
  },wait:async milliseconds=>{delays.push(milliseconds);},logRetry:receipt=>{logs.push(receipt);},now:()=>Date.parse('2026-10-13T00:00:00Z'),
 };
 return {options,calls,delays,logs,get cancelled(){return cancelled;},get bodyReads(){return bodyReads;}};
}
const transientError=(code,nested=false)=>nested?Object.assign(new Error('Diagnostic body transport failure'),{cause:{code}}):Object.assign(new Error('Diagnostic transport failure'),{code});
test('public metadata 503 retry reads a fresh complete response with cache bypass and fresh timeout',async()=>{
 const fixture=publicReadFixture([{status:503},{status:200}]);const bytes=await readPublicMetadata(metadataURL,fixture.options);
 assert.deepEqual(bytes,metadataBytes);assert.equal(JSON.parse(bytes).commit,PINS.canonicalSource);assert.equal(fixture.calls.length,2);assert.deepEqual(fixture.delays,[1000]);assert.equal(fixture.cancelled,1);assert.equal(fixture.bodyReads,1);
 assert.notEqual(fixture.calls[0].options.signal,fixture.calls[1].options.signal);
 for(const call of fixture.calls){assert.equal(call.url,metadataURL);assert.equal(call.options.method,'GET');assert.equal(call.options.cache,'no-store');assert.ok(call.options.signal instanceof AbortSignal);assert.equal(call.options.headers,undefined);}
});
test('public metadata persistent 503 terminates after four GETs and bounded backoff',async()=>{
 const fixture=publicReadFixture(Array.from({length:4},()=>({status:503})));
 await assert.rejects(readPublicMetadata(metadataURL,fixture.options),/Public metadata HTTP 503/);assert.equal(fixture.calls.length,4);assert.deepEqual(fixture.delays,[1000,2000,4000]);assert.equal(fixture.logs.length,3);assert.equal(fixture.cancelled,3);assert.equal(fixture.bodyReads,0);
});
test('public metadata permanent HTTP errors do not retry or read error payloads',async()=>{
 for(const status of [401,403,404,501]){const fixture=publicReadFixture([{status}]);await assert.rejects(readPublicMetadata(metadataURL,fixture.options),new RegExp('Public metadata HTTP '+status));assert.equal(fixture.calls.length,1);assert.deepEqual(fixture.delays,[]);assert.deepEqual(fixture.logs,[]);assert.equal(fixture.bodyReads,0);}
});
test('malformed successful public metadata JSON stays outside retries',async()=>{
 const fixture=publicReadFixture([{status:200,bytes:Buffer.from('{invalid JSON')}]);
 await assert.rejects(async()=>JSON.parse(await readPublicMetadata(metadataURL,fixture.options)),SyntaxError);assert.equal(fixture.calls.length,1);assert.deepEqual(fixture.delays,[]);
});
test('successful public metadata with a wrong pin stays outside retries',async()=>{
 const fixture=publicReadFixture([{status:200,bytes:Buffer.from(JSON.stringify({commit:'f'.repeat(40)}))}]);
 await assert.rejects(async()=>assert.equal(JSON.parse(await readPublicMetadata(metadataURL,fixture.options)).commit,PINS.canonicalSource),assert.AssertionError);assert.equal(fixture.calls.length,1);assert.deepEqual(fixture.delays,[]);
});
test('public metadata transient body failure refetches instead of reusing the failed body',async()=>{
 const fixture=publicReadFixture([{status:200,bodyError:transientError('UND_ERR_BODY_TIMEOUT',true)},{status:200}]);
 assert.deepEqual(await readPublicMetadata(metadataURL,fixture.options),metadataBytes);assert.equal(fixture.calls.length,2);assert.equal(fixture.bodyReads,2);assert.deepEqual(fixture.delays,[1000]);assert.equal(fixture.logs[0].status,'UND_ERR_BODY_TIMEOUT');
});
test('public metadata retry classification is limited to reset and timeout transport failures',async()=>{
 const fixture=publicReadFixture([{error:transientError('ECONNRESET')},{error:Object.assign(new Error('Diagnostic timeout'),{name:'TimeoutError'})},{status:200}]);
 assert.deepEqual(await readPublicMetadata(metadataURL,fixture.options),metadataBytes);assert.deepEqual(fixture.delays,[1000,2000]);
 for(const error of [transientError('ENOTFOUND'),transientError('EINVAL'),Object.assign(new Error('Diagnostic abort'),{name:'AbortError'}),new TypeError('Diagnostic nontransport error')]){const permanent=publicReadFixture([{error}]);await assert.rejects(readPublicMetadata(metadataURL,permanent.options),value=>value===error);assert.equal(permanent.calls.length,1);assert.deepEqual(permanent.delays,[]);}
});
test('public metadata Retry-After respects its five second cap and minimum backoff',async()=>{
 for(const [retryAfter,delay]of [['60',5000],['Tue, 13 Oct 2026 00:01:00 GMT',5000],['0',1000],['invalid',1000]]){const fixture=publicReadFixture([{status:429,retryAfter},{status:200}]);await readPublicMetadata(metadataURL,fixture.options);assert.deepEqual(fixture.delays,[delay]);}
});
test('public metadata transient HTTP set permits a fourth fresh successful response',async()=>{
 for(const status of [408,429,500,502,503,504]){const fixture=publicReadFixture([{status},{status:200}]);assert.deepEqual(await readPublicMetadata(metadataURL,fixture.options),metadataBytes);assert.equal(fixture.calls.length,2);}
 const fixture=publicReadFixture([{status:408},{status:429},{status:502},{status:200}]);await readPublicMetadata(metadataURL,fixture.options);assert.equal(fixture.calls.length,4);assert.deepEqual(fixture.delays,[1000,2000,4000]);assert.equal(new Set(fixture.calls.map(call=>call.options.signal)).size,4);
});
test('public metadata retry receipts and terminal HTTP errors omit query and URL credentials',async()=>{
 const address=new URL(metadataURL);address.username='private-user';address.password='private-password';address.search='?access_token=private-token';const fixture=publicReadFixture([{status:503},{status:200}]);await readPublicMetadata(address.href,fixture.options);
 assert.equal(fixture.logs[0].url,PINS.publicBase+'build-info.json');assert.doesNotMatch(JSON.stringify(fixture.logs),/private-|access_token|tower41publisher/);
 const terminal=publicReadFixture([{status:404}]);await assert.rejects(readPublicMetadata(address.href,terminal.options),error=>{assert.doesNotMatch(error.message,/private-|access_token|tower41publisher/);return true;});
});
