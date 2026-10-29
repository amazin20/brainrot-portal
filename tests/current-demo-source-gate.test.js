import test from 'node:test';
import assert from 'node:assert/strict';
import {selectCurrentSourceRun,assertCompleteSourceJobs,assertCompleteSourceSummary} from '../scripts/lib/current-demo-source-gate.mjs';
const options={source:'a'.repeat(40),branch:'upgrade/tz-completion-20261023',repository:'amazin20/brainrot-portal'};
const run=()=>({id:123,head_sha:options.source,head_branch:options.branch,head_repository:{full_name:options.repository},path:'.github/workflows/tz-completion-review.yml',event:'push',run_number:20,run_attempt:2,status:'completed',conclusion:'success'});
const jobs=()=>[...Array.from({length:16},(_,i)=>({name:`Active source regressions ${i+1}/16`,status:'completed',conclusion:'success'})),{name:'Verify no missing, repeated or unfinished regression shard',status:'completed',conclusion:'success'}];
function summary(){const rows=Array.from({length:16},(_,i)=>({index:i+1,files:2,tests:3,pass:3,fail:0,cancelled:0,skipped:0,todo:0}));return{sourceCommit:options.source,runId:'123',runAttempt:2,pass:true,shardCount:16,activeFileCount:32,rows,totals:{tests:48,pass:48,fail:0,cancelled:0,skipped:0,todo:0}};}
const receiptOptions={source:options.source,runId:123,runAttempt:2,activeFileCount:32};

test('only the exact canonical source validation is selected; the latest run and attempt win',()=>{
 const good=run(),older={...good,id:122,run_number:19},earlierAttempt={...good,run_attempt:1};
 assert.equal(selectCurrentSourceRun([older,earlierAttempt,good],options),good);
 for(const change of [r=>r.head_sha='b'.repeat(40),r=>r.head_branch='main',r=>r.head_repository.full_name='other/fork',r=>r.path='.github/workflows/current-demo-build.yml',r=>r.event='pull_request']){
  const wrong=structuredClone(good);change(wrong);assert.equal(selectCurrentSourceRun([wrong],options),null);
 }
});

test('all sixteen latest-attempt jobs and the complete-suite verifier must finish successfully',()=>{
 assert.doesNotThrow(()=>assertCompleteSourceJobs(run(),jobs()));
 for(const change of [r=>r.status='in_progress',r=>r.conclusion='failure',r=>r.run_attempt=0]){const r=run();change(r);assert.throws(()=>assertCompleteSourceJobs(r,jobs()));}
 for(const change of [j=>j.pop(),j=>j.splice(0,1),j=>j[0].conclusion='failure',j=>j[4].status='in_progress',j=>j[4].name=j[3].name]){const j=jobs();change(j);assert.throws(()=>assertCompleteSourceJobs(run(),j));}
});

test('the downloaded receipt binds every active file to the exact successful run attempt',()=>{
 const accepted=assertCompleteSourceSummary(summary(),receiptOptions);assert.equal(accepted.pass,true);
 for(const change of [s=>s.sourceCommit='b'.repeat(40),s=>s.runId='122',s=>s.runAttempt=1,s=>s.pass=false,s=>s.shardCount=15,s=>s.activeFileCount=31,s=>s.rows.pop(),s=>s.rows[1].index=1,s=>s.rows[0].files--,s=>s.totals.tests--]){
  const s=summary();change(s);assert.throws(()=>assertCompleteSourceSummary(s,receiptOptions));
 }
});

test('failed, cancelled, skipped or todo tests never permit publication',()=>{
 for(const key of ['fail','cancelled','skipped','todo']){
  const s=summary();s.totals[key]=s.rows[0][key]=1;assert.throws(()=>assertCompleteSourceSummary(s,receiptOptions));
 }
 const incomplete=summary();incomplete.totals.pass--;incomplete.rows[0].pass--;assert.throws(()=>assertCompleteSourceSummary(incomplete,receiptOptions));
});
