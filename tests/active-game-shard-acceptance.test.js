import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {activeGameTests,selectActiveTestShard} from '../scripts/lib/active-game-tests.mjs';
function fixture(change=()=>{},jobResult='success'){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'brainrot-shards-')),all=activeGameTests(),count=4,source='a'.repeat(40);
 const hashes=Object.fromEntries(all.map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
 try{
  for(let index=1;index<=count;index++){
   const directory=path.join(root,`active-regressions-${index}`);fs.mkdirSync(directory);
   fs.writeFileSync(path.join(directory,'manifest.json'),JSON.stringify({sourceCommit:source,index,count,activeFiles:all,selectedFiles:selectActiveTestShard(all,`${index}/${count}`).files,fileSha256:hashes}));
   fs.writeFileSync(path.join(directory,'result.json'),JSON.stringify({sourceCommit:source,index,count,status:0,signal:null}));
   // Synthetic TAP belongs only to this validator unit fixture, never to a game report.
   fs.writeFileSync(path.join(directory,'active-tests.tap'),'TAP version 13\nok 1 - validator unit fixture\n1..1\n# tests 1\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 1\n');
  }
  change(root);
  const output=path.join(root,'summary.json');
  const r=spawnSync(process.execPath,['scripts/verify-active-test-shards.mjs'],{encoding:'utf8',env:{...process.env,BUILD_COMMIT:source,SHARD_ARTIFACT_DIR:root,ACTIVE_TEST_SHARD_COUNT:String(count),ACTIVE_TEST_SUMMARY:output,TEST_JOBS_RESULT:jobResult}});
  return{status:r.status,summary:fs.existsSync(output)?JSON.parse(fs.readFileSync(output)):null,stderr:r.stderr};
 }finally{fs.rmSync(root,{recursive:true,force:true});}
}
function edit(root,file,change){const p=path.join(root,'active-regressions-1',file),j=JSON.parse(fs.readFileSync(p));change(j);fs.writeFileSync(p,JSON.stringify(j));}
test('complete matching manifests and finished successful TAP are accepted',()=>{const r=fixture();assert.equal(r.status,0,r.stderr);assert.equal(r.summary.activeFileCount,activeGameTests().length);assert.equal(r.summary.shardCount,4);});
for(const [label,change]of [
 ['missing shard',root=>fs.rmSync(path.join(root,'active-regressions-4'),{recursive:true})],
 ['omitted test',root=>edit(root,'manifest.json',j=>j.selectedFiles.pop())],
 ['repeated test',root=>edit(root,'manifest.json',j=>j.selectedFiles.push(j.selectedFiles[0]))],
 ['wrong source',root=>edit(root,'manifest.json',j=>j.sourceCommit='b'.repeat(40))],
 ['changed test bytes',root=>edit(root,'manifest.json',j=>j.fileSha256[j.selectedFiles[0]]='0'.repeat(64))],
 ['cancelled runner',root=>edit(root,'result.json',j=>{j.status=null;j.signal='SIGTERM';})],
 ['partial TAP',root=>fs.writeFileSync(path.join(root,'active-regressions-1/active-tests.tap'),'TAP version 13\nok 1 - unfinished fixture\n')],
 ['failed TAP',root=>{const p=path.join(root,'active-regressions-1/active-tests.tap');fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace('# fail 0','# fail 1'));}],
])test(`acceptance rejects ${label}`,()=>{const r=fixture(change);assert.notEqual(r.status,0);assert.equal(r.summary,null);});
test('a failed Actions job cannot be replaced by apparently successful artifacts',()=>{const r=fixture(()=>{},'failure');assert.notEqual(r.status,0);assert.equal(r.summary,null);});
