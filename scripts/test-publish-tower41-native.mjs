import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {PINS,JOB_NAMES,CONTROLLER_CHANGES,positive,identity,checkReview,checkController,checkArtifact,checkJobLog,checkDeployments,inventory,supplementalRecording} from './publish-tower41-native.mjs';
const expected={sourceCommit:'a'.repeat(40),sourceReview:{runId:42,runAttempt:2}};
const clone=value=>structuredClone(value);
const review=()=>({id:42,run_attempt:2,head_sha:expected.sourceCommit,head_branch:PINS.branch,path:PINS.reviewPath,event:'push',status:'completed',conclusion:'success'});
const jobs=()=>JOB_NAMES.map((name,index)=>({name,id:index+100,run_id:42,run_attempt:2,head_sha:expected.sourceCommit,status:'completed',conclusion:'success'}));
const controller=()=>({sha:'b'.repeat(40),parents:[{sha:PINS.baselinePublisher}],files:CONTROLLER_CHANGES.map(row=>({...row}))});
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
test('accept only five independent successful jobs of this source and current exact attempt',()=>{
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
  for(const mutate of [v=>v.parents.push({sha:PINS.baselinePublisher}),v=>v.parents[0].sha='d'.repeat(40),v=>v.files.pop(),v=>v.files.push({filename:'src/main.js',status:'modified'}),v=>v.files[0].status='added',v=>v.files[1].previous_filename='old-name.mjs']){const value=controller();mutate(value);assert.throws(()=>checkController(value,'b'.repeat(40)));}
});
test('artifact checksum, exact source, run and expiry are mandatory',()=>{
  const pinned={id:7,name:'build-42-2',size_in_bytes:20,digest:'sha256:'+'e'.repeat(64)};
  const value={...pinned,expired:false,workflow_run:{id:42,head_sha:expected.sourceCommit}};
  const options={name:pinned.name,runId:42,sourceCommit:expected.sourceCommit,pinned};checkArtifact(value,options);
  for(const mutate of [v=>v.id=8,v=>v.name='build-42-1',v=>v.expired=true,v=>v.workflow_run.id=43,v=>v.workflow_run.head_sha='f'.repeat(40),v=>v.size_in_bytes=600_000_001,v=>v.digest='sha256:bad']){const changed=clone(value);mutate(changed);assert.throws(()=>checkArtifact(changed,options));}
});
const marker=(job,status='success',identity=expected)=>'TOWER41_NEXT_JOB '+JSON.stringify({job,status,...identity});
test('provider markers must be complete standalone exact-attempt source receipts',()=>{
  const job={name:'cpu'};checkJobLog(Buffer.from('2026-10-12T01:02:03.123Z '+marker('cpu')+'\n'),job,expected);
  for(const invalid of [marker('build'),marker('cpu','failure'),marker('cpu','success',{...expected,sourceReview:{runId:42,runAttempt:1}}),marker('cpu')+'\n'+marker('cpu'),'shell echo '+marker('cpu'),marker('cpu')+' trailing',Buffer.from([0xff,0xfe])])assert.throws(()=>checkJobLog(Buffer.isBuffer(invalid)?invalid:Buffer.from(invalid),job,expected));
});
test('summary log must independently bind each of the four required job results once',()=>{
  const lines=['build','cpu','native-contact','native-castle'].map(name=>marker(name));checkJobLog(Buffer.from(lines.join('\n')),{name:'review-summary'},expected);
  assert.throws(()=>checkJobLog(Buffer.from(lines.slice(1).join('\n')),{name:'review-summary'},expected));
  assert.throws(()=>checkJobLog(Buffer.from([...lines,lines[0]].join('\n')),{name:'review-summary'},expected));
});
test('latest deployment must belong to the accepted current baseline without overlaps',()=>{
  const accepted={sha:PINS.baselinePublisher,state:'success',logUrl:'https://github.com/amazin20/brainrot-portal/actions/runs/'+PINS.baselineRun+'/job/123'};
  checkDeployments([accepted],'b'.repeat(40),99);
  checkDeployments([{sha:'b'.repeat(40),state:'in_progress',logUrl:'https://github.com/amazin20/brainrot-portal/actions/runs/99/job/12'},accepted],'b'.repeat(40),99);
  for(const row of [{...accepted,state:'pending'},{...accepted,state:'in_progress'},{...accepted,sha:'c'.repeat(40)},{...accepted,logUrl:'https://github.com/amazin20/brainrot-portal/actions/runs/100/job/1'}])assert.throws(()=>checkDeployments([row,accepted],'b'.repeat(40),99));
});
test('an inventory cannot silently follow a link or include a special file',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'tower41-publisher-'));
  try{fs.writeFileSync(path.join(root,'ordinary'),'retained');assert.equal(inventory(root).length,1);fs.symlinkSync(path.join(root,'ordinary'),path.join(root,'link'));assert.throws(()=>inventory(root));}finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('player publication URL is ordinary preview with isolated saves and no debug or ratchet flags',()=>{
  const url=new URL(PINS.publicBase+PINS.namespace+PINS.query);
  assert.equal(url.pathname,'/brainrot-portal/tower41-native/');assert.equal(url.searchParams.get('edition'),'foundation');assert.equal(url.searchParams.get('level'),'41');assert.equal(url.searchParams.get('tower41preview'),'1');assert.equal(url.searchParams.has('debug'),false);assert.equal(url.searchParams.has('tower41ratchet'),false);assert.equal(url.searchParams.has('pilot'),false);
});
test('walkthrough supplements bind only the actual reviewed ordinary movie and unaltered report',()=>{
  const evidence={sourceCommit:expected.sourceCommit,video:{filename:'tower-singularity.mp4',sha256:'c'.repeat(64),frames:100,fps:4,width:640,height:360,durationSeconds:25,simulationSeconds:24.95},result:{pass:true,metrics:{won:true,completedStages:11},sameCompanion:true,resets:0,respawns:0,cargoResets:0,seconds:24.95},observed:{seenResets:0}};
  const rows=[{path:'evidence.json',bytes:70,sha256:'d'.repeat(64)},{path:'tower-singularity.mp4',bytes:100,sha256:'c'.repeat(64)}];
  const value=supplementalRecording(evidence,rows,expected);assert.deepEqual(value.reviewedFiles.map(row=>row.path),['evidence/tower41-native.mp4','evidence/tower41-native-report.json']);assert.equal(value.recording.durationSeconds,25);assert.deepEqual(value.recording.sourceReview,expected.sourceReview);
  for(const mutate of [v=>v.sourceCommit='b'.repeat(40),v=>v.video.filename='../different.mp4',v=>v.video.sha256='e'.repeat(64),v=>v.video.durationSeconds=900,v=>v.result.respawns=1,v=>v.result.sameCompanion=false,v=>v.result.metrics.completedStages=500]){const changed=clone(evidence);mutate(changed);assert.throws(()=>supplementalRecording(changed,rows,expected));}
  assert.throws(()=>supplementalRecording(evidence,rows.slice(1),expected));assert.throws(()=>supplementalRecording(evidence,[...rows,clone(rows[0])],expected));
});
