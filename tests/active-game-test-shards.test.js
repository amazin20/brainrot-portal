import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {activeGameTests,selectActiveTestShard,activeTestConcurrency} from '../scripts/lib/active-game-tests.mjs';

test('sharded enumeration retains every old active test and no archived tower fixture',()=>{
 const before=fs.readdirSync(new URL('./',import.meta.url)).filter(n=>n.endsWith('.test.js')&&!n.startsWith('lab-tower')).sort().map(n=>'tests/'+n);
 assert.deepEqual(activeGameTests(),before);assert.ok(before.includes('tests/active-game-test-shards.test.js'));
});
for(const count of [1,2,8,16,32])test(`${count} test shards cover the whole suite exactly once, in stable order`,()=>{
 const files=activeGameTests(),parts=Array.from({length:count},(_,i)=>selectActiveTestShard(files,`${i+1}/${count}`));
 const union=parts.flatMap(p=>p.files);assert.equal(new Set(union).size,files.length);assert.deepEqual(union.sort(),files);
 assert.ok(parts.every(p=>p.files.length>0));assert.ok(Math.max(...parts.map(p=>p.files.length))-Math.min(...parts.map(p=>p.files.length))<=1);
 for(const p of parts)assert.deepEqual(p.files,files.filter((_,i)=>i%count===p.index-1));
});
test('invalid shard configuration fails instead of silently skipping tests',()=>{
 const files=activeGameTests();
 for(const bad of ['', '0/16','1/0','17/16','2','-1/16','1/2/3',' 1/16','1.5/16',`1/${files.length+1}`,'1/9007199254740993'])assert.throws(()=>selectActiveTestShard(files,bad));
 assert.deepEqual(selectActiveTestShard(files).files,files);
});
test('worker configuration preserves old default and rejects unbounded concurrency',()=>{
 assert.equal(activeTestConcurrency(),2);assert.equal(activeTestConcurrency('1'),1);
 for(const value of ['0','-1','5','999','1.1','two',''])assert.throws(()=>activeTestConcurrency(value));
});
