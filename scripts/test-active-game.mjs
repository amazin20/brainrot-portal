import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {activeGameTests,selectActiveTestShard,activeTestConcurrency} from './lib/active-game-tests.mjs';

const all=activeGameTests(),shard=selectActiveTestShard(all,process.env.ACTIVE_TEST_SHARD);
const concurrency=activeTestConcurrency(process.env.ACTIVE_TEST_CONCURRENCY);
if(process.env.ACTIVE_TEST_MANIFEST){
 const manifest={sourceCommit:process.env.BUILD_COMMIT??null,index:shard.index,count:shard.count,
  activeFiles:all,selectedFiles:shard.files,fileSha256:Object.fromEntries(all.map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')])),
  scope:'All existing active regressions; archived lab-tower*.test.js remain excluded exactly as before. This manifest records selection, not successful execution.'};
 fs.mkdirSync(path.dirname(process.env.ACTIVE_TEST_MANIFEST),{recursive:true});fs.writeFileSync(process.env.ACTIVE_TEST_MANIFEST,JSON.stringify(manifest,null,2)+'\n');
}
// Keep a bounded heap. Independent CI shards can each use one worker without
// serializing hundreds of entire-castle simulations behind one hour-long job.
const result=spawnSync(process.execPath,['--max-old-space-size=1024','--test','--test-reporter=tap',`--test-concurrency=${concurrency}`,...shard.files],{stdio:'inherit'});
if(process.env.ACTIVE_TEST_RESULT){
 fs.mkdirSync(path.dirname(process.env.ACTIVE_TEST_RESULT),{recursive:true});
 fs.writeFileSync(process.env.ACTIVE_TEST_RESULT,JSON.stringify({sourceCommit:process.env.BUILD_COMMIT??null,index:shard.index,count:shard.count,status:result.status,signal:result.signal,error:result.error?.message??null},null,2)+'\n');
}
if(result.error)throw result.error;
if(result.signal)throw new Error(`Active test process ended with ${result.signal}`);
process.exit(result.status??1);
