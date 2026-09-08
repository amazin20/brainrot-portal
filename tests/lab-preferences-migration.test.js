import test from 'node:test';
import assert from 'node:assert/strict';
import {LabPreferences} from '../src/game/LabPreferences.js';

test('renamed campaign preserves rooms1–11 and settings without old-room12 spoilers',()=>{
 const data=new Map([['nesi.preferences.v8',JSON.stringify({quality:'low',volume:.2,muted:true,
  completed:[0,6,10,11,19],hints:{6:2,10:1,11:3,19:2}})]]);
 const storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
 const preferences=new LabPreferences(storage);
 assert.deepEqual(preferences.value.completed,[0,6,10]);
 assert.deepEqual(preferences.value.hints,{6:2,10:1});
 assert.equal(preferences.value.quality,'low');assert.equal(preferences.value.volume,.2);assert.equal(preferences.value.muted,true);
 preferences.complete(11);preferences.unlockHint(11);
 const reloaded=new LabPreferences(storage);
 assert.deepEqual(reloaded.value.completed,[0,6,10,11]);assert.equal(reloaded.value.hints[11],1);
 assert.ok(data.has('brainrot-portal.preferences.v24'));
});
