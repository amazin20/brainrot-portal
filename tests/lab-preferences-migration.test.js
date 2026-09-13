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

test('appending rooms16–20 preserves all accepted progress and persists the new rooms without migration',()=>{
 const accepted=Array.from({length:15},(_,index)=>index),hints={0:1,11:3,12:2,14:1};
 const data=new Map([['brainrot-portal.preferences.v24',JSON.stringify({campaignRevision:'folded-junction-v28',
  quality:'low',volume:.25,muted:true,tutorial:false,completed:accepted,hints})]]);
 const storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
 const preferences=new LabPreferences(storage);
 assert.deepEqual(preferences.value.completed,accepted);assert.deepEqual(preferences.value.hints,hints);
 for(let index=15;index<20;index++){preferences.complete(index);preferences.unlockHint(index);}
 const reloaded=new LabPreferences(storage);
 assert.deepEqual(reloaded.value.completed,Array.from({length:20},(_,index)=>index));
 assert.deepEqual(reloaded.value.hints,{...hints,15:1,16:1,17:1,18:1,19:1});
 assert.equal(reloaded.value.quality,'low');assert.equal(reloaded.value.volume,.25);
 assert.equal(reloaded.value.muted,true);assert.equal(reloaded.value.tutorial,false);
 assert.equal(JSON.parse(data.get('brainrot-portal.preferences.v24')).campaignRevision,'folded-junction-v28');
});

test('v36 completion of all twenty rooms survives room21 without inventing new completion',()=>{
 const accepted=Array.from({length:20},(_,i)=>i),key='brainrot-portal.preferences.v24';
 const data=new Map([[key,JSON.stringify({campaignRevision:'folded-junction-v28',completed:accepted,quality:'low',volume:.2})]]);
 const storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
 const p=new LabPreferences(storage);assert.deepEqual(p.value.completed,accepted);assert.ok(!p.value.completed.includes(20));
 p.complete(19);assert.deepEqual(p.value.completed,accepted);p.complete(20);
 const reloaded=new LabPreferences(storage);assert.deepEqual(reloaded.value.completed,[...accepted,20]);
 assert.equal(reloaded.value.quality,'low');assert.equal(reloaded.value.volume,.2);
});
for(const invalid of [false,true])test(`failed ${invalid?'JSON parsing':'storage read'} cannot silently overwrite existing progress`,()=>{
 const original=invalid?'{damaged-data':JSON.stringify({campaignRevision:'folded-junction-v28',completed:[0,19]});
 let value=original,writes=0;
 const storage={getItem:()=>{if(!invalid)throw new Error('temporary read failure');return value;},setItem:(_,v)=>{writes++;value=v;}};
 const p=new LabPreferences(storage);p.save({volume:.4});p.complete(0);
 assert.equal(p.readFailed,true);assert.equal(p.value.volume,.4);assert.ok(p.value.completed.includes(0));
 assert.equal(writes,0);assert.equal(value,original);
});
