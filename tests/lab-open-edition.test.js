import test from 'node:test';import assert from 'node:assert/strict';
import {readOpenEdition,nextOpenRoom,openEditionStorage,OPEN_ROOM_INDICES} from '../src/game/LabOpenEdition.js';
import {LabPreferences} from '../src/game/LabPreferences.js';
test('review edition accepts its replacements plus the new research chapter and keeps old links unchanged',()=>{
 assert.equal(readOpenEdition('?level=24').enabled,false);
 for(const n of [24,28,30,31,32,33])assert.deepEqual(readOpenEdition('?edition=open&level='+n),{enabled:true,levelIndex:n-1});
 for(const v of ['','0','NaN','99','1','24.5'])assert.equal(readOpenEdition('?edition=open&level='+v).levelIndex,23);
 assert.deepEqual(OPEN_ROOM_INDICES.map(nextOpenRoom),[27,29,30,31,32,23]);
});
test('review completion never reads or replaces any classic preferences or spoiler hints',()=>{
 const data=new Map(),accesses=[],storage={getItem:k=>{accesses.push(k);return data.get(k);},setItem:(k,v)=>data.set(k,v)};
 const old=new LabPreferences(storage);old.complete(23);old.unlockHint(23);const snapshot=new Map(data);accesses.length=0;
 const fresh=new LabPreferences(openEditionStorage(storage));assert.deepEqual(fresh.value.completed,[]);assert.deepEqual(fresh.value.hints,{});fresh.complete(27);fresh.unlockHint(27);
 for(const [key,value]of snapshot)assert.equal(data.get(key),value);
 assert.ok(accesses.every(k=>k.startsWith('brainrot-open-rebuild-v1:')));
 assert.deepEqual(new LabPreferences(openEditionStorage(storage)).value.completed,[27]);
});
test('blocked review storage cannot trigger an empty replacement write',()=>{
 let writes=0;const p=new LabPreferences(openEditionStorage({getItem(){throw Error('blocked');},setItem(){writes++;}}));p.complete(23);assert.equal(writes,0);assert.equal(p.readFailed,true);
});
