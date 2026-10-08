import assert from 'node:assert/strict';
import fs from 'node:fs';

export const PUBLICATION_TARGET=JSON.parse(fs.readFileSync(new URL('../../docs/unified-publication-target.json',import.meta.url)));
const target=PUBLICATION_TARGET;
assert.ok(target.recordings.length>0);
assert.equal(new Set(target.recordings.map(record=>record.id)).size,target.recordings.length);
assert.equal(new Set(target.recordings.map(record=>record.directory)).size,target.recordings.length);
assert.equal(new Set(target.recordings.map(record=>record.artifactName)).size,target.recordings.length);
for(const record of target.recordings){
 assert.match(record.id,/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
 assert.ok(Number.isInteger(record.level)&&record.level>=1&&record.level<=51);
 assert.ok([4,12,30].includes(record.fps));assert.equal(typeof record.alternative,'string');
}
assert.equal(target.expectedJobs,target.expectedJobNames.length);
assert.equal(new Set(target.expectedJobNames).size,target.expectedJobs);
assert.equal(target.expectedArtifacts,target.inputArtifactsCore.length+target.recordings.length);
assert.deepEqual(target.native.routeKeys,['root','chapter']);
assert.ok(target.native.levels.length>0);
assert.equal(new Set(target.native.levels).size,target.native.levels.length);
for(const level of target.native.levels)assert.ok(Number.isInteger(level)&&level>=1&&level<=51);
assert.ok(target.native.viewports.length>0);
assert.equal(new Set(target.native.viewports.map(viewport=>JSON.stringify(viewport))).size,target.native.viewports.length);
for(const viewport of target.native.viewports){
 assert.ok(Number.isInteger(viewport.width)&&viewport.width>0&&Number.isInteger(viewport.height)&&viewport.height>0);
 assert.equal(typeof viewport.touch,'boolean');
}

export function sourceGeneration(source){assert.match(source,/^[a-f0-9]{40}$/);return source.slice(0,7);}
export function recordingStem(record,source=target.sourceCommit){return 'v54-'+sourceGeneration(source)+'-level-'+record.id;}
export function historicalPrefix(source=target.sourceCommit){
 assert.equal((target.baseline.archivePrefixTemplate.match(/\{sourceShort\}/g)||[]).length,1);
 return target.baseline.archivePrefixTemplate.replace('{sourceShort}',sourceGeneration(source));
}
export const NATIVE_SHARD_CASES=target.native.levels.length*target.native.viewports.length;
export const NATIVE_TOTAL_CASES=NATIVE_SHARD_CASES*target.native.routeKeys.length;
