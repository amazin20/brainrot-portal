import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateVisualAuditCameras} from '../scripts/qa-visual-audit-capture.mjs';

const actual=()=>JSON.parse(fs.readFileSync(new URL('../tools/visual-audit-v65-reference-cameras.json',import.meta.url),'utf8'));

test('visual reference covers every permanent room while preserving the actual new native start camera',()=>{
 const value=validateVisualAuditCameras(actual());assert.equal(value.levels.length,51);
 assert.equal(value.levels.find(row=>row.stableLevel===41).displayNumber,51);
 assert.equal(value.levels.find(row=>row.stableLevel===42).displayNumber,41);
 assert.ok(value.levels.every(row=>row.views.every(view=>view.kind!=='player-start')));
 assert.equal(value.levels.find(row=>row.stableLevel===41).views.filter(view=>view.kind.startsWith('castle-')).length,12);
});

test('capture validator rejects missing rooms, duplicate identities and invalid camera transforms',()=>{
 for(const mutate of [value=>value.levels.pop(),value=>value.levels[0].stableLevel=2,value=>value.levels[0].displayNumber=9,
  value=>value.levels[0].views[0].camera[0]=NaN,value=>value.levels[0].views[0].fov=200,value=>value.levels[0].views[0].kind='../outside',value=>value.levels[0].views[0].kind='player-start']){
  const value=actual();mutate(value);assert.throws(()=>validateVisualAuditCameras(value));
 }
});
