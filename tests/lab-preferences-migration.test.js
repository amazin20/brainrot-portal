import test from 'node:test';
import assert from 'node:assert/strict';
import {LabPreferences} from '../src/game/LabPreferences.js';

for(const [sourceKey,campaignRevision] of [
 ['nesi.preferences.v8',undefined],
 ['brainrot-portal.preferences.v24','reverse-perspective-v24'],
]) test(`replacement chamber preserves rooms1–11 and settings from ${campaignRevision||'legacy storage'}`,()=>{
 const data=new Map([[sourceKey,JSON.stringify({campaignRevision,quality:'low',volume:.2,muted:true,tutorial:false,
  completed:[0,6,10,11,19],hints:{6:2,10:1,11:3,19:2}})]]);
 const storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
 const preferences=new LabPreferences(storage);
 assert.deepEqual(preferences.value.completed,[0,6,10]);
 assert.deepEqual(preferences.value.hints,{6:2,10:1});
 assert.equal(preferences.value.quality,'low');assert.equal(preferences.value.volume,.2);assert.equal(preferences.value.muted,true);
 assert.equal(preferences.value.tutorial,false);
 assert.equal(JSON.parse(data.get('brainrot-portal.preferences.v24')).campaignRevision,'folded-junction-v28');
 preferences.complete(11);preferences.unlockHint(11);
 const reloaded=new LabPreferences(storage);
 assert.deepEqual(reloaded.value.completed,[0,6,10,11]);assert.equal(reloaded.value.hints[11],1);
 assert.ok(data.has('brainrot-portal.preferences.v24'));
});


test('adding rooms13–15 preserves accepted room12 completion, hints and user settings',()=>{
 const data=new Map([['brainrot-portal.preferences.v24',JSON.stringify({campaignRevision:'folded-junction-v28',
  quality:'high',volume:.35,muted:true,tutorial:false,completed:[0,6,10,11],hints:{6:2,11:3}})]]);
 const storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
 const preferences=new LabPreferences(storage);
 assert.deepEqual(preferences.value.completed,[0,6,10,11]);assert.deepEqual(preferences.value.hints,{6:2,11:3});
 assert.equal(preferences.value.quality,'high');assert.equal(preferences.value.volume,.35);
 assert.equal(preferences.value.muted,true);assert.equal(preferences.value.tutorial,false);
 for(const index of [12,13,14]){preferences.complete(index);preferences.unlockHint(index);}
 const reloaded=new LabPreferences(storage);
 assert.deepEqual(reloaded.value.completed,[0,6,10,11,12,13,14]);
 assert.deepEqual(reloaded.value.hints,{6:2,11:3,12:1,13:1,14:1});
 assert.equal(JSON.parse(data.get('brainrot-portal.preferences.v24')).campaignRevision,'folded-junction-v28');
});
