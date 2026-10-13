import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {sha} from './lib/campaign-v55-proof.mjs';
import {PUBLIC_ROLES,roleInfo,assertObservedPayload,assertPublicCohort,assertProducerArtifact} from './publish-campaign-v55-run.mjs';
import {assertLatestDeployment} from './publish-campaign-v55.mjs';
const copy=value=>structuredClone(value);
const now={publisherCommit:'1'.repeat(40),publicationRun:123,publicationRunAttempt:1};
const url='https://amazin20.github.io/brainrot-portal/campaign-v55/?edition=foundation&level=20&debug=1';
test('The eight capture producers cover51 physical rooms exactly once',()=>{
 assert.equal(PUBLIC_ROLES.length,8);const rooms=PUBLIC_ROLES.filter(role=>role.startsWith('native-')).flatMap(role=>roleInfo(role).levels);assert.equal(rooms.length,51);assert.deepEqual(rooms.slice().sort((a,b)=>a-b),Array.from({length:51},(_,i)=>i+1));assert.throws(()=>roleInfo('native-unknown'));
});
test('Retained pixels bind to PUBLIC winning body and actual room start; substitutions fail',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'public-pixel-control-'));try{const bytes=Buffer.from('isolated-pixel-binding-fixture');fs.writeFileSync(root+'/20-finish.jpg',bytes);const start={levelIndex:19,cargoUUID:'original',cargoBodyId:165};
 const report={rows:[{level:20,start}]},frame={...start,state:'won'},observed={observations:[{phase:'after',approved:true,url,frame:start},{phase:'after',approved:true,url,frame,capture:{bytes:bytes.length,sha256:sha(bytes)}}]};
 assert.deepEqual(assertObservedPayload(observed,{directory:root,report,part:'native',expectedURLs:[url]}),{observedRetainedImages:1,observedRoomStarts:1});
 for(const change of [v=>v.observations[1].capture.sha256='0'.repeat(64),v=>v.observations[1].url=url.replace('level=20','level=19'),v=>v.observations[1].frame.cargoBodyId=166,v=>v.observations[1].frame.state='ready',v=>v.observations.forEach(event=>event.frame.levelIndex=18)]){const mutant=copy(observed);change(mutant);assert.throws(()=>assertObservedPayload(mutant,{directory:root,report,part:'native',expectedURLs:[url]}));}
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('The current verifier cannot claim its own completed success; all ten producers must succeed',()=>{
 const run={id:123,head_sha:now.publisherCommit,run_attempt:1,event:'push',head_branch:'main',path:'.github/workflows/publish-campaign-v55.yml'};
 const jobs=['assemble','deploy',...PUBLIC_ROLES.map(role=>roleInfo(role).name),'verify'].map((name,index)=>({id:index+1,name,run_id:123,run_attempt:1,head_sha:now.publisherCommit,status:name==='verify'?'in_progress':'completed',conclusion:name==='verify'?null:'success'}));
 assertPublicCohort(run,jobs,{now});for(const mutate of [v=>v.pop(),v=>v[2].conclusion='failure',v=>v[10].status='completed',v=>v[4].run_id=124]){const mutant=copy(jobs);mutate(mutant);assert.throws(()=>assertPublicCohort(run,mutant,{now}));}
});
test('Artifact digest and upload time bind to the exact successful actual producer step',()=>{
 const job={steps:[{name:'Run actions/upload-artifact@v4',conclusion:'success',started_at:'2026-10-13T10:00:00Z',completed_at:'2026-10-13T10:00:10Z'}]},pin={expired:false,digest:'sha256:'+'2'.repeat(64),created_at:'2026-10-13T10:00:05Z',workflow_run:{id:123,head_sha:now.publisherCommit,head_branch:'main',repository_id:1354625251,head_repository_id:1354625251}};
 assertProducerArtifact(pin,job,now);for(const mutate of [v=>v.workflow_run.id=124,v=>v.workflow_run.head_sha='3'.repeat(40),v=>v.created_at='2026-10-13T09:00:00Z',v=>v.digest='missing']){const mutant=copy(pin);mutate(mutant);assert.throws(()=>assertProducerArtifact(mutant,job,now));}assert.throws(()=>assertProducerArtifact(pin,{steps:[{...job.steps[0],name:'different upload'}]},now));
});
test('Exact failed R5 baseline is retained behind current pending row; unknown newer row blocks',()=>{
 const baseline={publisher:'4'.repeat(40),latestOriginalDeployment:{id:100,logUrl:'old-exact-run'}},old={id:100,sha:baseline.publisher,state:'failure',logUrl:'old-exact-run'},own={id:101,sha:now.publisherCommit,state:'pending',logUrl:'https://github.com/amazin20/brainrot-portal/actions/runs/123'};
 assert.deepEqual(assertLatestDeployment([old,own],baseline,now),old);assert.throws(()=>assertLatestDeployment([old,{id:102,sha:'5'.repeat(40),state:'success',logUrl:'unknown'}],baseline,now));assert.throws(()=>assertLatestDeployment([old,{...own,state:'success'}],baseline,now));
});
test('Post capture lease requires actual sole deployment step success in current run/job',()=>{
 const row={id:102,sha:now.publisherCommit,state:'in_progress',logUrl:'https://github.com/amazin20/brainrot-portal/actions/runs/123/job/77'},jobs=[{id:77,name:'deploy',steps:[{name:'Run actions/deploy-pages@v4',conclusion:'success'}]}];
 assert.deepEqual(assertLatestDeployment([row],{},now,{phase:'final',jobs}),row);assert.throws(()=>assertLatestDeployment([{...row,logUrl:row.logUrl.replace('/77','/78')}],{},now,{phase:'final',jobs}));assert.throws(()=>assertLatestDeployment([row],{},now,{phase:'final',jobs:[{...jobs[0],steps:[]}]}));
});
