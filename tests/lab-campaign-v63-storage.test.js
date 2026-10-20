import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {LabPreferences,CREATIVE_CAMPAIGN_REVISION,CREATIVE_REPLACED_INDICES} from '../src/game/LabPreferences.js';
import {PROGRESSION_INDICES} from '../src/game/LabPuzzleProgression.js';
import {deriveCampaignAccess,resolveCampaignLevel} from '../src/game/LabCampaignAccess.js';
import {V62_IMPORTED_PREFERENCES,V61_ACCEPTED_ROOM_REVISIONS} from '../scripts/lib/campaign-preferences-fixture.mjs';
import {foundationCampaignStorage,foundationCampaignPrefix,isCampaignV63Path,CAMPAIGN_V63_STORAGE_PREFIX as own,CAMPAIGN_V62_STORAGE_PREFIX,CAMPAIGN_V61_STORAGE_PREFIX,CAMPAIGN_V60_STORAGE_PREFIX,CAMPAIGN_V59_STORAGE_PREFIX,CAMPAIGN_V58_STORAGE_PREFIX,CAMPAIGN_V57_STORAGE_PREFIX,CAMPAIGN_V56_STORAGE_PREFIX,CAMPAIGN_V55_STORAGE_PREFIX,FOUNDATION_STORAGE_PREFIX,CAMPAIGN_PREFERENCE_KEY as key} from '../src/game/LabCampaignStorage.js';

const legacy='nesi.preferences.v8';
const predecessors=[CAMPAIGN_V62_STORAGE_PREFIX,CAMPAIGN_V61_STORAGE_PREFIX,CAMPAIGN_V60_STORAGE_PREFIX,CAMPAIGN_V59_STORAGE_PREFIX,CAMPAIGN_V58_STORAGE_PREFIX,CAMPAIGN_V57_STORAGE_PREFIX,CAMPAIGN_V56_STORAGE_PREFIX,CAMPAIGN_V55_STORAGE_PREFIX,FOUNDATION_STORAGE_PREFIX];
const completed=Array.from({length:51},(_,index)=>index);
const hints={1:2,14:1,22:2,29:1,40:3};
const record=(changes={})=>JSON.stringify({...V62_IMPORTED_PREFERENCES,campaignRevision:CREATIVE_CAMPAIGN_REVISION,roomRevisions:{...V61_ACCEPTED_ROOM_REVISIONS},...changes});

// Exercise the real bootstrap constructor options, including mechanism revision
// checks. A valid accepted v62 record must not cause a migration write at start.
const bootstrap=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const optionsStart=bootstrap.indexOf('\n  foundationEdition.enabled?{campaignRevision:');
const optionsEnd=bootstrap.indexOf('),holds=new Set();',optionsStart);
assert.ok(optionsStart>=0&&optionsEnd>optionsStart,'Locate the actual bootstrap LabPreferences options');
const runtimeOptions=Function('foundationEdition','fullFoundationCampaign','CREATIVE_CAMPAIGN_REVISION','CREATIVE_REPLACED_INDICES','PROGRESSION_INDICES',
 `return (${bootstrap.slice(optionsStart,optionsEnd).trim()});`)({enabled:true},true,CREATIVE_CAMPAIGN_REVISION,CREATIVE_REPLACED_INDICES,PROGRESSION_INDICES);

function fixture(entries=[]){
 const data=new Map(entries),writes=[];
 const storage={getItem:name=>data.get(name)??null,setItem:(name,value)=>{writes.push(name);data.set(name,value);}};
 const adapter=()=>foundationCampaignStorage(storage,{pathname:'/brainrot-portal/campaign-v63/',fullFoundationCampaign:true});
 return{data,writes,adapter,preferences:()=>new LabPreferences(adapter(),runtimeOptions)};
}

test('v63 reads the whole accepted v62 sparse record without startup writes or an invented frontier field',()=>{
 assert.deepEqual(runtimeOptions.roomRevisions,V61_ACCEPTED_ROOM_REVISIONS);
 const bytes=record(),f=fixture([[CAMPAIGN_V62_STORAGE_PREFIX+key,bytes],[CAMPAIGN_V61_STORAGE_PREFIX+key,record({volume:.99})]]),p=f.preferences();
 assert.equal(f.adapter().getItem(key),bytes);
 for(const [name,value]of Object.entries(V62_IMPORTED_PREFERENCES))assert.deepEqual(p.value[name],value);
 assert.equal(p.value.completed.length,13);assert.equal(p.value.resumeLevel,3);
 assert.deepEqual(f.writes,[]);assert.equal(f.data.has(own+key),false);
 const access=deriveCampaignAccess(p.value),launchIndex=resolveCampaignLevel(p.value.resumeLevel,p.value);
 assert.equal(access.nextIndex,2);assert.equal(launchIndex,2);
 assert.equal(p.value.resumeLevel,3,'Access inspection preserves the historical bookmark');
 assert.deepEqual(f.writes,[]);
 // Persistence here represents the normal launch save, not a browser Play
 // observation. The browser runner independently proves the actual launch.
 p.save({resumeLevel:launchIndex});
 assert.deepEqual(f.writes,[own+key]);assert.equal(f.data.get(CAMPAIGN_V62_STORAGE_PREFIX+key),bytes);
 const saved=JSON.parse(f.data.get(own+key));
 assert.equal(saved.resumeLevel,2);assert.deepEqual(saved.completed,V62_IMPORTED_PREFERENCES.completed);
 assert.deepEqual(saved.hints,V62_IMPORTED_PREFERENCES.hints);assert.equal(Object.hasOwn(saved,'frontier'),false);
 f.data.set(CAMPAIGN_V62_STORAGE_PREFIX+key,'{damaged after own save');
 const reload=f.preferences();assert.equal(reload.value.resumeLevel,2);assert.deepEqual(reload.value.completed,V62_IMPORTED_PREFERENCES.completed);
 assert.deepEqual(f.writes,[own+key]);
});

test('v63 keeps all51 accepted v62 completions, expanded castle hints and settings intact',()=>{
 const entries=predecessors.map((prefix,index)=>[prefix+key,record({completed,hints,resumeLevel:40,volume:.29+index*.05})]);
 const f=fixture(entries),p=f.preferences();
 assert.deepEqual(p.value.completed,completed);assert.deepEqual(p.value.hints,hints);assert.equal(p.value.resumeLevel,40);
 assert.equal(p.value.quality,'low');assert.equal(p.value.volume,.29);assert.equal(p.value.muted,true);assert.equal(p.value.tutorial,true);
 assert.deepEqual(f.writes,[]);p.unlockHint(0);assert.deepEqual(f.writes,[own+key]);
 for(const [name,bytes]of entries)assert.equal(f.data.get(name),bytes);
 const reload=f.preferences();assert.deepEqual(reload.value.completed,completed);assert.deepEqual(reload.value.hints,{...hints,0:1});
 assert.deepEqual(f.writes,[own+key]);
});

test('v63 chooses each newest whole predecessor, with castle migration only for pre-v59 records',()=>{
 for(let start=0;start<predecessors.length;start++)for(const priorKey of [key,legacy]){
  const prefix=predecessors[start],raw=record({completed,hints,resumeLevel:40,volume:.42});
  const entries=[[prefix+priorKey,raw],...predecessors.slice(start+1).map(name=>[name+key,record({completed:[8],hints:{8:1},volume:.91})])];
  const f=fixture(entries),p=f.preferences();
  assert.deepEqual(p.value.completed,start<=3?completed:completed.filter(index=>index!==40));
  assert.deepEqual(p.value.hints,start<=3?hints:{1:2,14:1,22:2,29:1});
  assert.equal(p.value.resumeLevel,40);assert.equal(p.value.volume,.42);assert.deepEqual(f.writes,[]);
  p.save({volume:.5});assert.deepEqual(f.writes,[own+key]);
  for(const [name,bytes]of entries)assert.equal(f.data.get(name),bytes);
 }
});

test('v63 corrupt own or newest predecessor blocks older import and every unsafe write',()=>{
 for(const prefix of [own,...predecessors])for(const priorKey of [key,legacy]){
  const older=predecessors.slice(predecessors.indexOf(prefix)+1).map(name=>[name+key,record({volume:.99})]);
  const f=fixture([[prefix+priorKey,'{damaged newest'],...older]),p=f.preferences();
  assert.equal(p.readFailed,true);p.save({volume:.8});p.complete(2);p.unlockHint(2);
  assert.deepEqual(f.writes,[]);assert.equal(f.data.get(prefix+priorKey),'{damaged newest');
  for(const [name,bytes]of older)assert.equal(f.data.get(name),bytes);
 }
});

test('v63 own primary and legacy keys never mix missing keys with older namespaces',()=>{
 for(const prefix of [own,CAMPAIGN_V62_STORAGE_PREFIX,CAMPAIGN_V61_STORAGE_PREFIX]){
  const bytes=record({volume:.72}),f=fixture([[prefix+legacy,bytes],[CAMPAIGN_V60_STORAGE_PREFIX+key,record({volume:.99})]]);
  assert.equal(f.adapter().getItem(key),null);
  const p=f.preferences();assert.deepEqual(p.value.completed,V62_IMPORTED_PREFERENCES.completed);assert.equal(p.value.volume,.72);
  assert.deepEqual(f.writes,[]);p.save({volume:.73});assert.deepEqual(f.writes,[own+key]);
  assert.equal(f.data.get(prefix+legacy),bytes);assert.equal(f.data.get(CAMPAIGN_V60_STORAGE_PREFIX+key),record({volume:.99}));
 }
});

test('only exact v63 entry paths activate its namespace and historical paths retain their prefix',()=>{
 for(const base of ['','/brainrot-portal'])for(const suffix of ['','/','/index.html']){
  const path=base+'/campaign-v63'+suffix;assert.equal(isCampaignV63Path(path),true);assert.equal(foundationCampaignPrefix(path),own);
  assert.equal(foundationCampaignPrefix(path,{fullFoundationCampaign:false}),FOUNDATION_STORAGE_PREFIX);
 }
 for(const path of ['/campaign-v63/assets/index.js','/campaign-v63-old/','/campaign-v63//','/other/campaign-v63/','/%63ampaign-v63/','/brainrot-portal/campaign-v63/index.html/','/campaign-v63/?debug=1','/campaign-v63/#rooms']){
  assert.equal(isCampaignV63Path(path),false);assert.equal(foundationCampaignPrefix(path),FOUNDATION_STORAGE_PREFIX);
 }
 for(let index=0;index<predecessors.length-1;index++)assert.equal(foundationCampaignPrefix(`/campaign-v${62-index}/`),predecessors[index]);
 assert.equal(foundationCampaignStorage(undefined,{pathname:'/campaign-v63/',fullFoundationCampaign:true}),undefined);
});

test('v63 blocked reads cannot persist an empty private or historical record',()=>{
 let writes=0;const storage={getItem(){throw Error('blocked');},setItem(){writes++;}};
 const p=new LabPreferences(foundationCampaignStorage(storage,{pathname:'/campaign-v63/',fullFoundationCampaign:true}),runtimeOptions);
 assert.equal(p.readFailed,true);p.save({volume:.4});assert.equal(writes,0);
});
