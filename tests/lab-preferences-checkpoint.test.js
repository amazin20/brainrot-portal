import test from 'node:test';
import assert from 'node:assert/strict';
import {LabPreferences} from '../src/game/LabPreferences.js';

const key='brainrot-portal.preferences.v24';
const initial={campaignRevision:'folded-junction-v28',completed:[0,1],hints:{0:2},quality:'low',volume:.3};

test('an ad checkpoint writes the entire current preferences before reload',()=>{
  const data=new Map([[key,JSON.stringify(initial)]]),writes=[];
  const storage={getItem:name=>data.get(name),setItem:(name,value)=>{writes.push([name,value]);data.set(name,value);}};
  const preferences=new LabPreferences(storage);
  assert.equal(writes.length,0);assert.equal(preferences.lastSaveSucceeded,false);
  preferences.value.resumeLevel=2;
  assert.equal(preferences.saveProgress(),true);assert.equal(writes.length,1);
  assert.equal(preferences.lastSaveSucceeded,true);assert.equal(preferences.persistenceFailure,null);
  const saved=JSON.parse(data.get(key));assert.equal(saved.resumeLevel,2);assert.deepEqual(saved.completed,[0,1]);assert.deepEqual(saved.hints,{0:2});
  const reloaded=new LabPreferences(storage);assert.equal(reloaded.value.resumeLevel,2);assert.equal(reloaded.value.volume,.3);
});

test('an unavailable or failed write stays usable in memory and cannot claim a saved checkpoint',()=>{
  for(const storage of [undefined,{getItem:()=>JSON.stringify(initial)},{getItem:()=>JSON.stringify(initial),setItem(){throw Error('quota exceeded');}}]){
    const preferences=new LabPreferences(storage);
    const value=preferences.save({completed:[0,1,2],volume:.4});
    assert.equal(value,preferences.value);assert.deepEqual(value.completed,[0,1,2]);
    assert.equal(preferences.saveProgress(),false);assert.equal(preferences.lastSaveSucceeded,false);
    assert.ok(['storage-unavailable','write-failed'].includes(preferences.persistenceFailure));
  }
});

test('a later successful checkpoint clears an earlier write failure',()=>{
  let blocked=true,saved=JSON.stringify(initial);
  const preferences=new LabPreferences({getItem:()=>saved,setItem:(_,value)=>{if(blocked)throw Error('temporary failure');saved=value;}});
  preferences.complete(2);assert.equal(preferences.persistenceFailure,'write-failed');
  blocked=false;assert.equal(preferences.saveProgress(),true);assert.equal(preferences.persistenceFailure,null);
  assert.deepEqual(JSON.parse(saved).completed,[0,1,2]);
});

test('a failed historical read cannot be turned into an empty checkpoint overwrite',()=>{
  for(const getItem of [()=>{throw Error('storage unavailable');},()=>'{broken JSON']){
    let writes=0;const preferences=new LabPreferences({getItem,setItem(){writes++;}});
    preferences.complete(0);
    assert.equal(preferences.saveProgress(),false);assert.equal(preferences.persistenceFailure,'read-failed');
    assert.equal(writes,0);assert.deepEqual(preferences.value.completed,[0]);
  }
});

test('a silently ignored or unreadable checkpoint cannot be reported as persisted',()=>{
 for(const mode of ['ignored','unreadable']){
  let reads=0;const storage={getItem:()=>{if(mode==='unreadable'&&reads++>0)throw Error('readback blocked');return JSON.stringify(initial);},setItem(){}};
  const preferences=new LabPreferences(storage);preferences.value.resumeLevel=2;
  assert.equal(preferences.saveProgress(),false);assert.equal(preferences.persistenceFailure,'verification-failed');assert.equal(preferences.value.resumeLevel,2);
 }
});
