import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {LabPreferences,CREATIVE_CAMPAIGN_REVISION,CREATIVE_REPLACED_INDICES} from '../src/game/LabPreferences.js';
import {PROGRESSION_INDICES} from '../src/game/LabPuzzleProgression.js';
import {v61HistoricalPreferenceFixture,V61_ACCEPTED_ROOM_REVISIONS} from '../scripts/lib/campaign-preferences-fixture.mjs';
import {foundationCampaignStorage,foundationCampaignPrefix,isCampaignV62Path,CAMPAIGN_V62_STORAGE_PREFIX as own,CAMPAIGN_V61_STORAGE_PREFIX,CAMPAIGN_V60_STORAGE_PREFIX,CAMPAIGN_V59_STORAGE_PREFIX,CAMPAIGN_V58_STORAGE_PREFIX,CAMPAIGN_V57_STORAGE_PREFIX,CAMPAIGN_V56_STORAGE_PREFIX,CAMPAIGN_V55_STORAGE_PREFIX,FOUNDATION_STORAGE_PREFIX,CAMPAIGN_PREFERENCE_KEY as key} from '../src/game/LabCampaignStorage.js';

const legacy='nesi.preferences.v8';
const predecessors=[CAMPAIGN_V61_STORAGE_PREFIX,CAMPAIGN_V60_STORAGE_PREFIX,CAMPAIGN_V59_STORAGE_PREFIX,CAMPAIGN_V58_STORAGE_PREFIX,CAMPAIGN_V57_STORAGE_PREFIX,CAMPAIGN_V56_STORAGE_PREFIX,CAMPAIGN_V55_STORAGE_PREFIX,FOUNDATION_STORAGE_PREFIX];
const completed=Array.from({length:51},(_,index)=>index);
const hints={1:2,14:1,22:2,29:1,40:3};
const record=(volume=.29)=>JSON.stringify(v61HistoricalPreferenceFixture({completed,hints,resumeLevel:29,quality:'low',volume,muted:true,tutorial:false}));
// Execute the actual bootstrap constructor options, rather than a reduced copy
// that could silently omit the room-revision invalidation used in the browser.
const bootstrap=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const optionsStart=bootstrap.indexOf('\n  foundationEdition.enabled?{campaignRevision:');
const optionsEnd=bootstrap.indexOf('),holds=new Set();',optionsStart);
assert.ok(optionsStart>=0&&optionsEnd>optionsStart,'Locate the actual bootstrap LabPreferences options');
const runtimeOptions=Function('foundationEdition','fullFoundationCampaign','CREATIVE_CAMPAIGN_REVISION','CREATIVE_REPLACED_INDICES','PROGRESSION_INDICES',
 `return (${bootstrap.slice(optionsStart,optionsEnd).trim()});`)({enabled:true},true,CREATIVE_CAMPAIGN_REVISION,CREATIVE_REPLACED_INDICES,PROGRESSION_INDICES);
function fixture(entries=[]){
 const data=new Map(entries),writes=[];
 const storage={getItem:name=>data.get(name)??null,setItem:(name,value)=>{writes.push(name);data.set(name,value);}};
 const adapter=()=>foundationCampaignStorage(storage,{pathname:'/brainrot-portal/campaign-v62/',fullFoundationCampaign:true});
 return{data,writes,adapter,preferences:()=>new LabPreferences(adapter(),runtimeOptions)};
}

test('v62 imports all51 v61 completions including biosphere and castle, while every historical byte remains intact',()=>{
 assert.deepEqual(runtimeOptions.roomRevisions,V61_ACCEPTED_ROOM_REVISIONS);
 const entries=predecessors.map((prefix,index)=>[prefix+key,record(.29+index*.05)]),f=fixture(entries),p=f.preferences();
 assert.equal(f.adapter().getItem(key),entries[0][1]);assert.deepEqual(p.value.completed,completed);assert.deepEqual(p.value.hints,hints);
 for(const [name,value]of Object.entries({resumeLevel:29,quality:'low',volume:.29,muted:true,tutorial:false}))assert.equal(p.value[name],value);
 assert.deepEqual(f.writes,[]);p.save({volume:.37});assert.deepEqual(f.writes,[own+key]);
 for(const [name,bytes]of entries)assert.equal(f.data.get(name),bytes);
 f.data.set(CAMPAIGN_V61_STORAGE_PREFIX+key,'{changed old source');
 const reload=f.preferences();assert.deepEqual(reload.value.completed,completed);assert.deepEqual(reload.value.hints,hints);assert.equal(reload.value.volume,.37);
});

test('actual bootstrap still invalidates missing or stale room23 mechanism revision without touching v61 bytes',()=>{
 for(const revision of [undefined,'counterweight-before-dynamic']){
  const previous=v61HistoricalPreferenceFixture({completed,hints,resumeLevel:22,quality:'low',volume:.29,muted:true,tutorial:false});
  if(revision===undefined)delete previous.roomRevisions[22];else previous.roomRevisions[22]=revision;
  const bytes=JSON.stringify(previous),f=fixture([[CAMPAIGN_V61_STORAGE_PREFIX+key,bytes]]),p=f.preferences();
  assert.deepEqual(p.value.completed,completed.filter(index=>index!==22));
  assert.deepEqual(p.value.hints,{1:2,14:1,29:1,40:3});
  assert.equal(p.value.resumeLevel,22);assert.equal(p.value.volume,.29);
  assert.deepEqual(f.writes,[own+key]);assert.equal(f.data.get(CAMPAIGN_V61_STORAGE_PREFIX+key),bytes);
  assert.deepEqual(p.roomRevisions,V61_ACCEPTED_ROOM_REVISIONS);
  const reload=f.preferences();assert.deepEqual(reload.value.completed,p.value.completed);assert.deepEqual(reload.value.hints,p.value.hints);
  assert.deepEqual(f.writes,[own+key]);assert.equal(f.data.get(CAMPAIGN_V61_STORAGE_PREFIX+key),bytes);
 }
});

test('presentation fixture retains completed22 and hint22, while the old malformed fixture reproduces their invalidation',()=>{
 const expected={completed:[0,1,6,9,10,14,19,20,22,25,28,29,40],hints,resumeLevel:3,quality:'low',volume:.29,muted:true,tutorial:true};
 for(const valid of [true,false]){
  const previous=v61HistoricalPreferenceFixture(expected);if(!valid)delete previous.roomRevisions;
  const bytes=JSON.stringify(previous),f=fixture([[CAMPAIGN_V61_STORAGE_PREFIX+key,bytes]]),p=f.preferences();
  assert.deepEqual(p.value.completed,valid?expected.completed:expected.completed.filter(index=>index!==22));
  assert.deepEqual(p.value.hints,valid?hints:{1:2,14:1,29:1,40:3});
  for(const name of ['resumeLevel','quality','volume','muted','tutorial'])assert.equal(p.value[name],expected[name]);
  assert.equal(f.data.get(CAMPAIGN_V61_STORAGE_PREFIX+key),bytes);assert.ok(f.writes.every(name=>name===own+key));
 }
});

test('v62 selects one newest whole namespace and applies old castle migration only before v59',()=>{
 for(let start=0;start<predecessors.length;start++)for(const priorKey of [key,legacy]){
  const prefix=predecessors[start],raw=record(.42),entries=[[prefix+priorKey,raw],...predecessors.slice(start+1).map(name=>[name+key,record(.91)])],f=fixture(entries),p=f.preferences();
  assert.deepEqual(p.value.completed,start<=2?completed:completed.filter(index=>index!==40));
  assert.deepEqual(p.value.hints,start<=2?hints:{1:2,14:1,22:2,29:1});assert.equal(p.value.resumeLevel,29);assert.equal(p.value.volume,.42);
  p.save({volume:.5});assert.deepEqual(f.writes,[own+key]);for(const [name,bytes]of entries)assert.equal(f.data.get(name),bytes);
 }
});

test('corrupt own or newest v62 predecessor never downgrades progress or overwrites the damaged data',()=>{
 for(const prefix of [own,CAMPAIGN_V61_STORAGE_PREFIX,CAMPAIGN_V60_STORAGE_PREFIX,CAMPAIGN_V59_STORAGE_PREFIX])for(const name of [key,legacy]){
  const f=fixture([[prefix+name,'{damaged newest'],[CAMPAIGN_V58_STORAGE_PREFIX+key,record(.99)]]),p=f.preferences();
  assert.equal(p.readFailed,true);p.save({volume:.8});assert.deepEqual(f.writes,[]);assert.equal(f.data.get(prefix+name),'{damaged newest');
 }
});

test('v62 own legacy data does not mix missing keys with another edition',()=>{
 const f=fixture([[own+legacy,record(.72)],[CAMPAIGN_V61_STORAGE_PREFIX+key,record(.99)]]);
 assert.equal(f.adapter().getItem(key),null);assert.deepEqual(f.preferences().value.completed,completed);assert.equal(f.preferences().value.volume,.72);
 f.preferences().save({volume:.73});assert.ok(f.writes.every(name=>name===own+key));assert.equal(f.data.get(CAMPAIGN_V61_STORAGE_PREFIX+key),record(.99));
});

test('only exact v62 entry paths activate its namespace, while historical and preview paths retain theirs',()=>{
 for(const base of ['','/brainrot-portal'])for(const suffix of ['','/','/index.html']){
  const path=base+'/campaign-v62'+suffix;assert.equal(isCampaignV62Path(path),true);assert.equal(foundationCampaignPrefix(path),own);assert.equal(foundationCampaignPrefix(path,{fullFoundationCampaign:false}),FOUNDATION_STORAGE_PREFIX);
 }
 for(const path of ['/campaign-v62/assets/index.js','/campaign-v62-old/','/campaign-v62//','/other/campaign-v62/','/%63ampaign-v62/','/brainrot-portal/campaign-v62/index.html/']){
  assert.equal(isCampaignV62Path(path),false);assert.equal(foundationCampaignPrefix(path),FOUNDATION_STORAGE_PREFIX);
 }
 assert.equal(foundationCampaignPrefix('/campaign-v61/'),CAMPAIGN_V61_STORAGE_PREFIX);
 assert.equal(foundationCampaignPrefix('/campaign-v60/'),CAMPAIGN_V60_STORAGE_PREFIX);
});
