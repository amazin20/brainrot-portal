import test from 'node:test';
import assert from 'node:assert/strict';
import {SOURCE_REVIEW_REQUIRED_JOBS,assertRequiredReviewJobs,assertServedPackageProof,assertFoundation20CaptureTelemetry} from '../scripts/qa-tower41-next-cell-source.mjs';

test('current source summary requires the actual complete jobset including ordinary Foundation20',()=>{
 const jobs=Object.fromEntries(SOURCE_REVIEW_REQUIRED_JOBS.map(name=>[name,'success']));
 assert.equal(assertRequiredReviewJobs(jobs),jobs);
 for(const name of Object.keys(jobs)){
  const missing={...jobs};delete missing[name];assert.throws(()=>assertRequiredReviewJobs(missing));
  for(const status of ['queued','in_progress','cancelled','skipped','failure'])assert.throws(()=>assertRequiredReviewJobs({...jobs,[name]:status}));
 }
 const replaced={...jobs};delete replaced['native-foundation20'];replaced['static-foundation20']='success';assert.throws(()=>assertRequiredReviewJobs(replaced));
 assert.throws(()=>assertRequiredReviewJobs({...jobs,'review-summary':'success'}));
 assert.throws(()=>assertRequiredReviewJobs([]));
});

test('native served-package proof binds every file and the exact source run attempt',()=>{
 const identity={sourceCommit:'a'.repeat(40),sourceReview:{runId:12,runAttempt:2}},files=[{path:'assets/game.js',bytes:17,sha256:'b'.repeat(64)},{path:'build-info.json',bytes:31,sha256:'c'.repeat(64)}];
 const expected={...identity,files},proof={pass:true,...structuredClone(expected)};assert.equal(assertServedPackageProof(proof,expected),proof);
 for(const mutate of [p=>p.pass=false,p=>p.sourceCommit='d'.repeat(40),p=>p.sourceReview.runAttempt=1,p=>p.sourceReview.runId=11,p=>p.files.pop(),p=>p.files.push({path:'extra.js',bytes:1,sha256:'f'.repeat(64)}),p=>p.files[0].sha256='f'.repeat(64),p=>p.files[0].bytes=18,p=>p.files[0].path='../assets/game.js']){const bad=structuredClone(proof);mutate(bad);assert.throws(()=>assertServedPackageProof(bad,expected));}
});


test('native Foundation20 telemetry binds consecutive captured rows and the exact real terminal frame',()=>{
 const state=(visualFrame,end=false)=>({visualFrame,worldStep:100+2*(visualFrame+1),seconds:2*(visualFrame+1)/120,state:end?'won':'playing',cargoBodyId:45,cargoMass:3.2,cargoDynamic:true,edition:'foundation',level:20,id:'foundation-portal-tension'});
 const rows=[{index:0,terminal:false,state:state(0)},{index:1,terminal:false,state:state(15)},{index:2,terminal:true,state:state(20,true)}],serialize=rows=>Buffer.from(rows.map(row=>JSON.stringify(row)).join('\n')+'\n');
 const proof={route:{frames:21,physicsSteps:42,seconds:42/120,cargoBodyId:45},video:{frames:3,fps:4,stride:15,terminalSample:true,lastVisualFrame:20,first:rows[0].state,last:rows[2].state},telemetry:{samples:3}};
 assert.deepEqual(assertFoundation20CaptureTelemetry(serialize(rows),proof),{samples:3,lastVisualFrame:20,terminalSample:true,worldStepOffset:100});
 for(const mutate of [r=>r.reverse(),r=>r.pop(),r=>r[1].index=0,r=>r[1].state.visualFrame=16,r=>r[1].state.cargoBodyId=46,r=>r[1].state.cargoMass=4,r=>r[1].state.edition='classic',r=>r[1].state.worldStep++,r=>r[1].state.seconds+=1/120,r=>r[2].terminal=false,r=>r[2].state.state='playing']){const bad=structuredClone(rows);mutate(bad);assert.throws(()=>assertFoundation20CaptureTelemetry(serialize(bad),proof));}
 assert.throws(()=>assertFoundation20CaptureTelemetry(Buffer.from(serialize(rows).toString().trimEnd()),proof));
 assert.throws(()=>assertFoundation20CaptureTelemetry(serialize(rows),{...proof,telemetry:{samples:2}}));
 const regularRows=[{index:0,terminal:false,state:state(0)},{index:1,terminal:false,state:{...state(15,true),seconds:31/120,worldStep:131}}],regularProof={route:{frames:16,physicsSteps:31,seconds:31/120,cargoBodyId:45},video:{frames:2,fps:4,stride:15,terminalSample:false,lastVisualFrame:15,first:regularRows[0].state,last:regularRows[1].state},telemetry:{samples:2}};
 assert.deepEqual(assertFoundation20CaptureTelemetry(serialize(regularRows),regularProof),{samples:2,lastVisualFrame:15,terminalSample:false,worldStepOffset:100},'A real win on the first physics tick of a regular capture must not require padded steps or a fake terminal event');
});
