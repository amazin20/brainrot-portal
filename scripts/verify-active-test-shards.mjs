import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {activeGameTests,selectActiveTestShard} from './lib/active-game-tests.mjs';

const root=process.env.SHARD_ARTIFACT_DIR||'shard-artifacts',count=Number(process.env.ACTIVE_TEST_SHARD_COUNT||16),source=process.env.BUILD_COMMIT;
assert.ok(Number.isSafeInteger(count)&&count>0&&source,'Expected exact source and shard count');
const expected=activeGameTests(),seen=[],rows=[];
const sha=filename=>crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
const expectedHashes=Object.fromEntries(expected.map(filename=>[filename,sha(filename)]));
for(let index=1;index<=count;index++){
 const directory=path.join(root,`active-regressions-${index}`),manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'))),result=JSON.parse(fs.readFileSync(path.join(directory,'result.json')));
 assert.equal(manifest.sourceCommit,source);assert.equal(manifest.index,index);assert.equal(manifest.count,count);
 assert.deepEqual(manifest.activeFiles,expected);assert.deepEqual(manifest.fileSha256,expectedHashes);
 const selected=selectActiveTestShard(expected,`${index}/${count}`).files;assert.deepEqual(manifest.selectedFiles,selected);seen.push(...selected);
 assert.equal(result.sourceCommit,source);assert.equal(result.index,index);assert.equal(result.count,count);assert.equal(result.status,0);assert.equal(result.signal,null);
 const tap=fs.readFileSync(path.join(directory,'active-tests.tap'),'utf8'),values={};
 for(const key of ['tests','pass','fail','cancelled','skipped','todo']){
  const matches=[...tap.matchAll(new RegExp(`^# ${key} (\\d+)$`,'gm'))];assert.equal(matches.length,1,`Missing or ambiguous ${key} summary in shard ${index}`);values[key]=Number(matches[0][1]);
 }
 assert.ok(/^# duration_ms [\d.]+$/m.test(tap)&&values.tests>0,'Incomplete TAP');assert.equal(values.fail,0);assert.equal(values.cancelled,0);
 rows.push({index,files:selected.length,...values,tapSha256:sha(path.join(directory,'active-tests.tap'))});
}
assert.equal(new Set(seen).size,expected.length);assert.deepEqual(seen.sort(),expected);assert.equal(process.env.TEST_JOBS_RESULT,'success');
const totals=Object.fromEntries(['tests','pass','fail','cancelled','skipped','todo'].map(k=>[k,rows.reduce((n,r)=>n+r[k],0)]));
const summary={sourceCommit:source,runId:process.env.GITHUB_RUN_ID??null,runAttempt:process.env.GITHUB_RUN_ATTEMPT===undefined?null:Number(process.env.GITHUB_RUN_ATTEMPT),pass:true,activeFileCount:expected.length,shardCount:count,totals,rows,scope:'Every active test file appears exactly once; each shard completed successfully. Not a WebGL all-room, live SDK, human playtest or hardware acceptance.'};
fs.writeFileSync(process.env.ACTIVE_TEST_SUMMARY||'active-suite-summary.json',JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary,null,2));
