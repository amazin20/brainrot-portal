import test from 'node:test';
import assert from 'node:assert/strict';
import {PUBLICATION_TARGET as target,recordingStem,historicalPrefix,sourceGeneration,NATIVE_SHARD_CASES,NATIVE_TOTAL_CASES} from '../scripts/lib/unified-publication-config.mjs';

test('Target descriptors require all51jobs, seven current movies, eleven inputs and48 native cases',()=>{
 assert.equal(target.expectedJobNames.length,51);assert.equal(target.recordings.length,7);
 assert.equal(target.expectedArtifacts,target.inputArtifactsCore.length+target.recordings.length);
 assert.equal(target.expectedArtifacts,11);assert.equal(NATIVE_SHARD_CASES,24);assert.equal(NATIVE_TOTAL_CASES,48);
 assert.ok(target.native.levels.includes(47));
 const manual=target.recordings.find(record=>record.id==='47-manual-impact');
 assert.equal(manual.level,47);assert.equal(manual.alternative,'manual-impact');assert.equal(manual.fps,12);
});
test('every public movie stem derives from the exact source generation without stale I/K names',()=>{
 const stems=target.recordings.map(record=>recordingStem(record));
 assert.equal(new Set(stems).size,target.recordings.length);
 assert.ok(stems.every(stem=>stem.startsWith('v54-'+target.sourceCommit.slice(0,7)+'-')));
 assert.ok(stems.every(stem=>!stem.includes('8f2132c')));
 assert.ok(stems.every(stem=>!stem.includes('ae819c7')));
 assert.ok(stems.some(stem=>stem.endsWith('47-manual-impact')));
});
test('source substitution changes all seven names and replacement history together',()=>{
 const next='0123456789abcdef0123456789abcdef01234567';
 for(const record of target.recordings)assert.notEqual(recordingStem(record,next),recordingStem(record));
 assert.equal(historicalPrefix(next),'publication-history/578c31e-before-0123456');
 assert.notEqual(historicalPrefix(next),historicalPrefix());
});
test('an unresolved or malformed source cannot generate public movie or history paths',()=>{
 for(const source of ['unresolved-source',null,'a'.repeat(39),'G'.repeat(40),'../'+target.sourceCommit]){
  assert.throws(()=>sourceGeneration(source));assert.throws(()=>recordingStem(target.recordings[0],source));assert.throws(()=>historicalPrefix(source));
 }
});
