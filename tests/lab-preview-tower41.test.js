import test from 'node:test';
import assert from 'node:assert/strict';
import {LabPreferences,DEFAULT_PREFERENCES} from '../src/game/LabPreferences.js';
import {readFoundationEdition} from '../src/game/LabFoundationEdition.js';
import {normalizeTower41PreviewEntry,isTower41NativePreviewPath,readTower41Preview,readTower41EntryFlags,createTower41PreviewPreferences,tower41PreviewStorage,TOWER41_PREVIEW_STORAGE_PREFIX,TOWER41_PREVIEW_LEGACY_STORAGE_PREFIXES,TOWER41_PREVIEW_LEVEL_INDEX,TOWER41_PREVIEW_INDICES} from '../src/game/LabTower41Preview.js';

const KEY='brainrot-portal.preferences.v24',LEGACY_KEY='nesi.preferences.v8';
const OLD_PREFIXES=['','brainrot-foundation-v1:','brainrot-open-rebuild-v1:','brainrot-puzzle-pilot43-v1:','brainrot-puzzle-progression-v1:','brainrot-puzzle-progression-next-v1:','brainrot-puzzle-progression-finale-v1:','brainrot-tower41-ratchet-qualification-v1:',...TOWER41_PREVIEW_LEGACY_STORAGE_PREFIXES];
function memoryStorage(initial=[]){
 const data=new Map(initial),reads=[],writes=[];
 const storage={getItem(key){reads.push(key);return data.get(key)??null;},setItem(key,value){writes.push({key,value});data.set(key,value);}};
 return {data,reads,writes,storage};
}
function previousRecords(){
 return OLD_PREFIXES.flatMap((prefix,i)=>[KEY,LEGACY_KEY].map(key=>[prefix+key,JSON.stringify({
  quality:'high',volume:.21,muted:true,tutorial:false,completed:[0,40,42,50],hints:{40:3,50:2},resumeLevel:50,
  campaignRevision:'historical-byte-preservation-'+i,roomRevisions:{40:'old-tower'},unrecognized:{keep:'exact bytes'},key,
 },null,2)]));
}
function unchanged(previous,current){for(const [key,value]of previous)assert.equal(current.get(key),value,key);}

test('literal standalone namespace entries force only ordinary room41 and private storage flags',()=>{
 const paths=['/tower41-native-v2','/tower41-native-v2/','/tower41-native-v2/index.html','/brainrot-portal/tower41-native-v2','/brainrot-portal/tower41-native-v2/','/brainrot-portal/tower41-native-v2/index.html'];
 const entries=['','edition=classic&level=42','edition=open&level=51&tower41preview=0','edition=foundation&level=1&pilot=progression&tower41ratchet=1&debug=1','mode=velocity&chapter=2&return=21&smoke=1','edition=classic&edition=open&level=42&level=51&tower41preview=0&tower41preview=false'];
 for(const pathname of paths)for(const entry of entries){
  const original=new URLSearchParams(entry),before=original.toString(),normalized=normalizeTower41PreviewEntry(original,{pathname});
  assert.equal(isTower41NativePreviewPath(pathname),true);assert.equal(original.toString(),before,'Caller query must not be mutated');assert.notEqual(normalized,original);
  assert.deepEqual(readFoundationEdition(normalized),{enabled:true,levelIndex:40});assert.equal(normalized.get('tower41preview'),'1');
  assert.deepEqual(readTower41EntryFlags(normalized),{preview:true,debug:original.get('debug')==='1'||original.get('smoke')==='1',tower41Qualification:false,puzzlePilot43:false,puzzleProgression:false});
  for(const name of ['edition','level','tower41preview'])assert.equal(normalized.getAll(name).length,1,'Conflicting native entry parameters must collapse to one effective value');
  for(const [name,value]of original)if(!['edition','level','tower41preview'].includes(name))assert.equal(normalized.get(name),value,'Unrelated entry parameters retain their behavior');
 }
});

test('other paths, local root opt-in and Yandex retain the existing entry boundaries',()=>{
 const paths=['/tower41-native','/tower41-native/','/tower41-native/index.html','/brainrot-portal/tower41-native/','/','/index.html','/brainrot-portal/','/brainrot-portal/index.html','/tower41-native-v2/walkthroughs.html','/brainrot-portal/tower41-native-v2/assets/index.js','/tower41-native-v2-extra/','/other/tower41-native-v2/','/publication-history/old/tower41-native-v2/','/brainrot-portal/tower41-native-v2/extra','/brainrot-portal/%74ower41-native/'];
 const queries=['','edition=classic&level=42','mode=velocity&return=11','edition=foundation&level=41&tower41preview=1&debug=1'];
 for(const pathname of paths)for(const query of queries){const original=new URLSearchParams(query),normalized=normalizeTower41PreviewEntry(original,{pathname});assert.equal(isTower41NativePreviewPath(pathname),false);assert.equal(normalized.toString(),original.toString());assert.deepEqual(readTower41EntryFlags(normalized),readTower41EntryFlags(original));}
 for(const pathname of ['/tower41-native-v2/','/brainrot-portal/tower41-native-v2/index.html'])for(const query of queries){const original=new URLSearchParams(query),normalized=normalizeTower41PreviewEntry(original,{pathname,yandex:true});assert.equal(normalized.toString(),original.toString());assert.deepEqual(readTower41EntryFlags(normalized,{yandex:true}),readTower41EntryFlags(original,{yandex:true}));}
 assert.equal(readTower41EntryFlags(normalizeTower41PreviewEntry('?edition=foundation&level=41&tower41preview=1',{pathname:'/'})).preview,true);
});

test('ordinary tower preview copies only foundation settings and never rewrites any historical edition',()=>{
 const fixture=memoryStorage(previousRecords()),before=new Map(fixture.data);
 const preview=createTower41PreviewPreferences(fixture.storage);
 assert.ok(preview instanceof LabPreferences);
 assert.deepEqual(preview.value,{quality:'high',volume:.21,muted:true,tutorial:false,completed:[],hints:{},resumeLevel:null});
 preview.complete(40);preview.save({resumeLevel:40,quality:'low',volume:.83,muted:false,tutorial:true});
 assert.deepEqual(preview.value.completed,[40]);
 unchanged(before,fixture.data);
 assert.ok(fixture.writes.length>0);
 assert.ok(fixture.writes.every(({key})=>key.startsWith(TOWER41_PREVIEW_STORAGE_PREFIX)));
 assert.ok(fixture.reads.every(key=>key.startsWith(TOWER41_PREVIEW_STORAGE_PREFIX)||key.startsWith('brainrot-foundation-v1:')));
 assert.equal(fixture.data.size,before.size+1);
 const reloaded=createTower41PreviewPreferences(fixture.storage);
 assert.deepEqual(reloaded.value,preview.value);
 unchanged(before,fixture.data);
});

test('saved native progress and preferences are independent from changing foundation data',()=>{
 const fixture=memoryStorage(previousRecords()),preview=createTower41PreviewPreferences(fixture.storage);
 preview.complete(40);preview.save({resumeLevel:40,quality:'low',volume:.9,muted:false,tutorial:true});
 const ownValue={...preview.value};
 fixture.data.set('brainrot-foundation-v1:'+KEY,JSON.stringify({quality:'balanced',volume:.02,muted:true,tutorial:false,completed:[1,2],hints:{1:3},resumeLevel:1}));
 const before=new Map(fixture.data);
 assert.deepEqual(createTower41PreviewPreferences(fixture.storage).value,ownValue);
 unchanged(before,fixture.data);
 // The actual preferences adapter cannot resolve an unprefixed historic key.
 assert.equal(tower41PreviewStorage(fixture.storage).getItem(KEY),fixture.data.get(TOWER41_PREVIEW_STORAGE_PREFIX+KEY));
});

test('missing foundation settings use defaults without consulting another edition',()=>{
 const records=previousRecords().filter(([key])=>!key.startsWith('brainrot-foundation-v1:'));
 const fixture=memoryStorage(records),before=new Map(fixture.data),preview=createTower41PreviewPreferences(fixture.storage);
 assert.deepEqual(preview.value,DEFAULT_PREFERENCES);
 preview.complete(40);
 unchanged(before,fixture.data);
 assert.ok(fixture.reads.every(key=>key.startsWith(TOWER41_PREVIEW_STORAGE_PREFIX)||key.startsWith('brainrot-foundation-v1:')));
});

test('foundation legacy settings are read directly and only seed the new namespace',()=>{
 const fixture=memoryStorage([['brainrot-foundation-v1:'+LEGACY_KEY,JSON.stringify({quality:'low',volume:2,muted:true,tutorial:false,completed:[40],hints:{40:3},resumeLevel:40})]]);
 const before=new Map(fixture.data),preview=createTower41PreviewPreferences(fixture.storage);
 assert.deepEqual(preview.value,{quality:'low',volume:1,muted:true,tutorial:false,completed:[],hints:{},resumeLevel:null});
 unchanged(before,fixture.data);
});

for(const raw of ['{broken','null','[]','false','"not a preference record"'])test(`corrupt native reads stay untouched and session changes remain usable: ${raw}`,()=>{
 const fixture=memoryStorage([...previousRecords(),[TOWER41_PREVIEW_STORAGE_PREFIX+KEY,raw]]),before=new Map(fixture.data);
 const preview=createTower41PreviewPreferences(fixture.storage);
 assert.equal(preview.readFailed,true);assert.deepEqual(preview.value,DEFAULT_PREFERENCES);
 preview.complete(40);preview.save({quality:'high',resumeLevel:40});
 assert.deepEqual(preview.value.completed,[40]);assert.equal(preview.value.quality,'high');
 assert.equal(fixture.writes.length,0);unchanged(before,fixture.data);
});

for(const raw of ['{broken','null','[]'])test(`corrupt historical settings cannot erase or import tower progress: ${raw}`,()=>{
 const fixture=memoryStorage(previousRecords());fixture.data.set('brainrot-foundation-v1:'+KEY,raw);
 const before=new Map(fixture.data),preview=createTower41PreviewPreferences(fixture.storage);
 assert.deepEqual(preview.value,DEFAULT_PREFERENCES);preview.complete(40);
 assert.deepEqual(createTower41PreviewPreferences(fixture.storage).value.completed,[40]);
 unchanged(before,fixture.data);
});

test('blocked reads prevent all writes while allowing session preferences',()=>{
 let writes=0;
 const preview=createTower41PreviewPreferences({getItem(){throw Error('blocked read');},setItem(){writes++;}});
 assert.equal(preview.readFailed,true);preview.complete(40);preview.save({volume:.4,muted:true,resumeLevel:40});
 assert.deepEqual(preview.value.completed,[40]);assert.equal(preview.value.volume,.4);assert.equal(writes,0);
});

test('blocked writes and absent storage retain functional session state',()=>{
 const fixture=memoryStorage(previousRecords()),before=new Map(fixture.data);
 const blocked={getItem:fixture.storage.getItem,setItem(){throw Error('blocked write');}};
 for(const storage of [blocked,undefined]){
  const preview=createTower41PreviewPreferences(storage);preview.complete(40);preview.save({quality:'low',resumeLevel:40});
  assert.deepEqual(preview.value.completed,[40]);assert.equal(preview.value.quality,'low');assert.equal(preview.value.resumeLevel,40);
 }
 unchanged(before,fixture.data);
});

test('actual entry flags keep native tower isolated from all gameplay modifiers',()=>{
 assert.equal(TOWER41_PREVIEW_LEVEL_INDEX,40);assert.deepEqual(TOWER41_PREVIEW_INDICES,[40]);assert.ok(Object.isFrozen(TOWER41_PREVIEW_INDICES));
 for(const edition of ['', 'foundation'])for(const level of ['1','41','43','51','999'])for(const pilot of ['', '43','progression'])for(const debug of ['', '1']){
  const q=new URLSearchParams({tower41preview:'1',level,tower41ratchet:'1',pilot,debug});if(edition)q.set('edition',edition);
  assert.equal(readTower41Preview(q),true);
  assert.deepEqual(readTower41EntryFlags(q),{preview:true,debug:debug==='1',tower41Qualification:false,puzzlePilot43:false,puzzleProgression:false});
 }
 for(const edition of ['classic','open','unknown']){
  const q=new URLSearchParams({edition,level:'41',tower41preview:'1',tower41ratchet:'1',pilot:'43',debug:'1'});
  assert.equal(readTower41Preview(q),false);assert.deepEqual(readTower41EntryFlags(q),{preview:false,debug:true,tower41Qualification:false,puzzlePilot43:false,puzzleProgression:false});
 }
 assert.equal(readTower41Preview('?mode=velocity&tower41preview=1'),false);
});

test('ordinary previous links and every Yandex flag combination keep their existing boundaries',()=>{
 for(const flag of ['', '0','true','2']){
  const q=new URLSearchParams({edition:'foundation',level:'41',tower41preview:flag,tower41ratchet:'1',debug:'1'});
  assert.deepEqual(readTower41EntryFlags(q),{preview:false,debug:true,tower41Qualification:true,puzzlePilot43:false,puzzleProgression:false});
 }
 assert.deepEqual(readTower41EntryFlags('?edition=foundation&level=41'),{preview:false,debug:false,tower41Qualification:false,puzzlePilot43:false,puzzleProgression:false});
 assert.equal(readTower41EntryFlags('?edition=foundation&level=43&pilot=43').puzzlePilot43,true);
 assert.equal(readTower41EntryFlags('?edition=foundation&pilot=progression').puzzleProgression,true);
 for(const pilot of ['','43','progression'])for(const flag of ['','1']){
  const q=new URLSearchParams({edition:'foundation',level:'41',tower41preview:flag,tower41ratchet:'1',pilot,debug:'1',smoke:'1'});
  assert.deepEqual(readTower41EntryFlags(q,{yandex:true}),{preview:false,debug:false,tower41Qualification:false,puzzlePilot43:false,puzzleProgression:false});
  assert.deepEqual(readFoundationEdition(q),{enabled:true,levelIndex:40});
 }
 assert.equal(readTower41EntryFlags('?edition=foundation&level=41&tower41preview=1&smoke=1').debug,true);
});
