import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resolveSupplementalProof,assertRecoveredRecordingOrigin,RECOVERY_CAPTURE_RUN,RECOVERY_CAPTURE_SHA,RECOVERY_SOURCE,RECOVERY_CANDIDATE_RUN,RECOVERY_WORKFLOW} from '../scripts/lib/expedition-recovery.mjs';
const config=JSON.parse(fs.readFileSync(new URL('../tools/expedition-release.json',import.meta.url)));
const options={recover:true,publicationRun:40000000001,controllerSHA:'a'.repeat(40)};
function fixture(){
 const proof={
  recoveryRun:{id:options.publicationRun,head_sha:options.controllerSHA,head_branch:'main',path:RECOVERY_WORKFLOW,status:'queued',conclusion:null},
  publicationRun:{id:RECOVERY_CAPTURE_RUN,head_sha:RECOVERY_CAPTURE_SHA,head_branch:'main',path:'.github/workflows/publish-expedition.yml',status:'completed',conclusion:'failure'},
  publicationJobs:[],publicationArtifacts:[],
 };
 for(const level of config.supplementalRecordingLevels){
  proof.publicationJobs.push({id:1000+level,run_id:RECOVERY_CAPTURE_RUN,head_sha:RECOVERY_CAPTURE_SHA,run_attempt:1,name:`Continuous supplemental walkthrough (${level})`,status:'completed',conclusion:'success',started_at:'2026-10-05T10:35:00Z',completed_at:'2026-10-05T10:36:00Z',steps:[{name:`Capture room ${level} with the unchanged source recorder`,conclusion:'success'},{name:'Upload capture',conclusion:'success'}]});
  proof.publicationArtifacts.push({id:2000+level,name:`expedition-supplemental-walkthrough-${level}`,digest:'sha256:'+'b'.repeat(64),expired:false,workflow_run:{id:RECOVERY_CAPTURE_RUN,head_sha:RECOVERY_CAPTURE_SHA,head_branch:'main'}});
 }
 return proof;
}
test('recovery retains truthful failed origin and separately identifies actual publishing run',()=>{
 const result=resolveSupplementalProof(fixture(),config,options);
 assert.equal(result.acceptedJobs.length,38);assert.equal(result.artifactManifest.length,38);
 assert.equal(result.publicationRun,RECOVERY_CAPTURE_RUN);assert.equal(result.controllerSHA,RECOVERY_CAPTURE_SHA);
 assert.equal(result.recovery.captureRunConclusion,'failure');assert.equal(result.recovery.publicationRun,options.publicationRun);
 assertRecoveredRecordingOrigin(result,{publicationRun:String(options.publicationRun)},config,options);
});
test('queued aggregate and inherited queued jobs do not erase completed real captures',()=>{
 const p=fixture();p.publicationJobs.push({...p.publicationJobs[0],id:98765,status:'queued',conclusion:null,steps:[],run_attempt:3});
 assert.equal(resolveSupplementalProof(p,config,options).acceptedJobs[0].id,1001);
});
test('ordinary publication does not gain permission to recover failures',()=>assert.throws(()=>resolveSupplementalProof(fixture(),config,{...options,recover:false})));
const mutations={
 'unrelated capture run':p=>p.publicationRun.id++,
 'different capture controller':p=>p.publicationRun.head_sha='c'.repeat(40),
 'wrong capture branch':p=>p.publicationRun.head_branch='other',
 'unfinished origin':p=>p.publicationRun.status='in_progress',
 'falsified successful origin':p=>p.publicationRun.conclusion='success',
 'different recovery run':p=>p.recoveryRun.id++,
 'different recovery controller':p=>p.recoveryRun.head_sha='d'.repeat(40),
 'wrong recovery workflow':p=>p.recoveryRun.path='other.yml',
 'missing completed capture':p=>p.publicationJobs.shift(),
 'failed capture':p=>p.publicationJobs[0].conclusion='failure',
 'skipped recorder':p=>p.publicationJobs[0].steps[0].conclusion='skipped',
 'failed step after capture':p=>p.publicationJobs[0].steps[1].conclusion='failure',
 'capture from another run':p=>p.publicationJobs[0].run_id++,
 'capture from different source controller':p=>p.publicationJobs[0].head_sha='e'.repeat(40),
 'missing capture artifact':p=>p.publicationArtifacts.shift(),
 'duplicate capture artifact':p=>p.publicationArtifacts.push(structuredClone(p.publicationArtifacts[0])),
 'expired artifact':p=>p.publicationArtifacts[0].expired=true,
 'invalid digest':p=>p.publicationArtifacts[0].digest='sha256:invalid',
 'foreign artifact run':p=>p.publicationArtifacts[0].workflow_run.id++,
 'foreign artifact controller':p=>p.publicationArtifacts[0].workflow_run.head_sha='f'.repeat(40),
};
for(const [name,mutate]of Object.entries(mutations))test('reject '+name,()=>{const p=fixture();mutate(p);assert.throws(()=>resolveSupplementalProof(p,config,options));});
test('reject replacement game source',()=>assert.throws(()=>resolveSupplementalProof(fixture(),{...config,sourceCommit:'9'.repeat(40)},options)));
test('reject substituted source acceptance run',()=>assert.throws(()=>resolveSupplementalProof(fixture(),{...config,candidateRun:RECOVERY_CANDIDATE_RUN+1},options)));
test('public proof binds new publisher and retains capture identity',()=>{
 const r=resolveSupplementalProof(fixture(),config,options);
 assert.throws(()=>assertRecoveredRecordingOrigin(r,{publicationRun:'40000000002'},config,options));
 assert.throws(()=>assertRecoveredRecordingOrigin(r,{publicationRun:options.publicationRun},config,{...options,controllerSHA:'0'.repeat(40)}));
 r.publicationRun++;
 assert.throws(()=>assertRecoveredRecordingOrigin(r,{publicationRun:options.publicationRun},config,options));
});
