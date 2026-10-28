import fs from 'node:fs';

/** Preserve the existing active-suite boundary. Sharding changes scheduling,
 * never the set of regressions: the archived lab-tower suite remains archived. */
export function activeGameTests(directory=new URL('../../tests/',import.meta.url)){
 const names=fs.readdirSync(directory).filter(name=>name.endsWith('.test.js')&&!name.startsWith('lab-tower')).sort();
 if(!names.length)throw new Error('No active game regression tests found');
 return names.map(name=>'tests/'+name);
}
export function selectActiveTestShard(files,value){
 if(value===undefined)return {index:1,count:1,files:[...files]};
 const match=/^([1-9]\d*)\/([1-9]\d*)$/.exec(value);
 if(!match)throw new Error('ACTIVE_TEST_SHARD must be INDEX/COUNT, both positive integers');
 const index=Number(match[1]),count=Number(match[2]);
 if(!Number.isSafeInteger(index)||!Number.isSafeInteger(count)||index>count||count>files.length)throw new Error('Invalid or empty active test shard');
 return {index,count,files:files.filter((_,i)=>i%count===index-1)};
}
export function activeTestConcurrency(value){
 if(value===undefined)return 2;
 if(!/^[1-4]$/.test(value))throw new Error('ACTIVE_TEST_CONCURRENCY must be an integer from 1 to 4');
 return Number(value);
}
