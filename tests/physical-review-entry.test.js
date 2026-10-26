import test from 'node:test';
import assert from 'node:assert/strict';
import {readPhysicalReviewEntry,normalizePhysicalReviewQuery,createPhysicalReviewPreferences} from '../src/game/LabPhysicalReviewEntry.js';
import {readFoundationEdition} from '../src/game/LabFoundationEdition.js';
import {readTower41EntryFlags} from '../src/game/LabTower41Preview.js';

const key='brainrot-portal.preferences.v24';
const oldPrefixes=['','brainrot-foundation-v1:','brainrot-open-rebuild-v1:','brainrot-puzzle-pilot43-v1:','brainrot-puzzle-progression-v1:','brainrot-puzzle-progression-next-v1:','brainrot-puzzle-progression-finale-v1:','brainrot-tower41-native-v1:','brainrot-tower41-native-v2:','brainrot-tower41-ratchet-qualification-v1:'];
function fixture(){
 const data=new Map(oldPrefixes.map((prefix,i)=>[prefix+key,JSON.stringify({quality:'low',volume:.21,muted:true,tutorial:false,completed:[19,40,50],hints:{19:3,40:2},resumeLevel:50,campaignRevision:'history-'+i,extra:{bytes:'preserve'}},null,2)]));
 const writes=[];
 return {data,writes,storage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>{writes.push(k);data.set(k,v);}}};
}

test('released physical entries force their own ordinary chamber without enabling alternate puzzles',()=>{
 for(const [id,level,tower]of [['foundation20-physical-v1',20,false],['tower41-native-v3',41,true]]){
  for(const base of ['', '/brainrot-portal'])for(const suffix of ['', '/', '/index.html']){
   const pathname=`${base}/${id}${suffix}`,entry=readPhysicalReviewEntry(pathname);
   assert.equal(entry.levelIndex,level-1);assert.deepEqual(entry.indices,[level-1]);assert.ok(Object.isFrozen(entry.indices));
   const input=new URLSearchParams('edition=classic&edition=open&level=51&level=1&pilot=progression&tower41ratchet=1&tower41preview=1&mode=velocity&debug=1');
   const before=input.toString(),query=normalizePhysicalReviewQuery(input,entry);
   assert.equal(input.toString(),before);
   assert.deepEqual(readFoundationEdition(query),{enabled:true,levelIndex:level-1});
   assert.deepEqual(readTower41EntryFlags(query),{preview:tower,debug:true,tower41Qualification:false,puzzlePilot43:false,puzzleProgression:false});
   assert.equal(query.getAll('edition').length,1);assert.equal(query.getAll('level').length,1);
   assert.equal(readPhysicalReviewEntry(pathname,{yandex:true}),null);
  }
 }
});

test('archive paths and unrelated assets never activate a new physical entry',()=>{
 for(const path of ['/','/brainrot-portal/','/tower41-native-v2/','/brainrot-portal/tower41-native-v2/','/foundation20-physical-v1-extra/','/other/foundation20-physical-v1/','/brainrot-portal/foundation20-physical-v1/assets/index.js','/publication-history/tower41-native-v3/','/brainrot-portal/tower41-native-v3/extra']){
  assert.equal(readPhysicalReviewEntry(path),null);
  const original='edition=classic&level=51&pilot=progression';
  assert.equal(normalizePhysicalReviewQuery(original,null).toString(),original);
 }
});

test('new room20 and room41 saves reload independently while every historical byte is preserved',()=>{
 const f=fixture(),before=new Map(f.data);
 const room=readPhysicalReviewEntry('/foundation20-physical-v1/'),tower=readPhysicalReviewEntry('/tower41-native-v3/');
 const roomPrefs=createPhysicalReviewPreferences(f.storage,room),towerPrefs=createPhysicalReviewPreferences(f.storage,tower);
 for(const prefs of [roomPrefs,towerPrefs])assert.deepEqual(prefs.value,{quality:'low',volume:.21,lookSensitivity:1,muted:true,tutorial:false,completed:[],hints:{},resumeLevel:null});
 roomPrefs.complete(19);roomPrefs.save({resumeLevel:19,quality:'high'});
 towerPrefs.complete(40);towerPrefs.save({resumeLevel:40,quality:'balanced'});
 assert.deepEqual(createPhysicalReviewPreferences(f.storage,room).value,roomPrefs.value);
 assert.deepEqual(createPhysicalReviewPreferences(f.storage,tower).value,towerPrefs.value);
 assert.deepEqual(roomPrefs.value.completed,[19]);assert.deepEqual(towerPrefs.value.completed,[40]);
 for(const [k,v]of before)assert.equal(f.data.get(k),v,k);
 assert.ok(f.writes.every(k=>k.startsWith(room.storagePrefix)||k.startsWith(tower.storagePrefix)));
});

test('broken or inaccessible new saves cannot overwrite historical data or leak into the other new room',()=>{
 const room=readPhysicalReviewEntry('/foundation20-physical-v1/'),tower=readPhysicalReviewEntry('/tower41-native-v3/');
 const f=fixture();f.data.set(room.storagePrefix+key,'{broken');const before=new Map(f.data);
 const damaged=createPhysicalReviewPreferences(f.storage,room);
 assert.equal(damaged.readFailed,true);damaged.complete(19);damaged.save({quality:'high'});
 for(const [k,v]of before)assert.equal(f.data.get(k),v,k);
 assert.deepEqual(createPhysicalReviewPreferences(f.storage,tower).value.completed,[]);
 let writes=0;
 const blocked=createPhysicalReviewPreferences({getItem(){throw Error('blocked');},setItem(){writes++;}},room);
 blocked.complete(19);assert.deepEqual(blocked.value.completed,[19]);assert.equal(writes,0);
 assert.throws(()=>createPhysicalReviewPreferences(f.storage,{...room}),/Unknown physical chamber entry/);
});
