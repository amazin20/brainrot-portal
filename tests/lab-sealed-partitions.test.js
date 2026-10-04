import test from 'node:test';
import assert from 'node:assert/strict';
import {runSealedPartitionCases} from '../scripts/lib/sealed-partition-cases.mjs';
test('authored closed partitions reject actual destination shots and fast capsule attacks while explicit apertures remain usable',async()=>{
 const report=await runSealedPartitionCases();assert.equal(report.pass,true,JSON.stringify(report.results.filter(r=>!r.pass)));
});
