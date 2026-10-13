import test from 'node:test';
import assert from 'node:assert/strict';
import {LabPreferences,CREATIVE_CAMPAIGN_REVISION} from '../src/game/LabPreferences.js';
import {foundationCampaignStorage,foundationCampaignPrefix,isCampaignV55Path,isCampaignV56Path,CAMPAIGN_V55_STORAGE_PREFIX,CAMPAIGN_V56_STORAGE_PREFIX,FOUNDATION_STORAGE_PREFIX,CAMPAIGN_PREFERENCE_KEY} from '../src/game/LabCampaignStorage.js';
import {readTower41EntryFlags} from '../src/game/LabTower41Preview.js';
const key=CAMPAIGN_PREFERENCE_KEY,legacy='nesi.preferences.v8';
const record=()=>JSON.stringify({campaignRevision:CREATIVE_CAMPAIGN_REVISION,completed:[0,1,39],hints:{1:2},resumeLevel:39,quality:'low',volume:.21,muted:true,tutorial:false});
function fixture(entries=[]){const data=new Map(entries),writes=[];return{data,writes,storage:{getItem:key=>data.get(key)??null,setItem:(key,value)=>{writes.push(key);data.set(key,value);}}};}
const candidate=f=>foundationCampaignStorage(f.storage,{pathname:'/campaign-v55/',fullFoundationCampaign:true});

test('only the exact candidate entry and its GitHub project prefix use the isolated campaign namespace',()=>{
 for(const base of ['','/brainrot-portal'])for(const suffix of ['','/','/index.html']){
  const path=base+'/campaign-v55'+suffix;assert.equal(isCampaignV55Path(path),true);
  assert.equal(foundationCampaignPrefix(path),CAMPAIGN_V55_STORAGE_PREFIX);
  assert.equal(foundationCampaignPrefix(path,{fullFoundationCampaign:false}),FOUNDATION_STORAGE_PREFIX);
 }
 for(const path of ['/','/brainrot-portal/','/campaign-v55/extra','/campaign-v55/assets/index.js','/campaign-v55-old/','/other/campaign-v55/','/publication-history/campaign-v55/','/campaign-v55//','/%63ampaign-v55/']){
  assert.equal(isCampaignV55Path(path),false);assert.equal(foundationCampaignPrefix(path),FOUNDATION_STORAGE_PREFIX);
 }
});

test('a first candidate visit imports old progress by reading and saves only into its own namespace',()=>{
 const historical=record(),f=fixture([[FOUNDATION_STORAGE_PREFIX+key,historical],['brainrot-open-rebuild-v1:'+key,'old research bytes']]);
 const prefs=new LabPreferences(candidate(f),{campaignRevision:CREATIVE_CAMPAIGN_REVISION});
 assert.deepEqual(prefs.value.completed,[0,1,39]);assert.deepEqual(prefs.value.hints,{1:2});assert.equal(prefs.value.volume,.21);
 assert.deepEqual(f.writes,[]);
 prefs.save({volume:.37});prefs.complete(7);
 assert.ok(f.writes.every(name=>name.startsWith(CAMPAIGN_V55_STORAGE_PREFIX)));
 assert.equal(f.data.get(FOUNDATION_STORAGE_PREFIX+key),historical);assert.equal(f.data.get('brainrot-open-rebuild-v1:'+key),'old research bytes');
 const own=f.data.get(CAMPAIGN_V55_STORAGE_PREFIX+key);
 f.data.set(FOUNDATION_STORAGE_PREFIX+key,JSON.stringify({completed:[5],volume:.99}));
 const again=new LabPreferences(candidate(f),{campaignRevision:CREATIVE_CAMPAIGN_REVISION});
 assert.deepEqual(again.value.completed,[0,1,39,7]);assert.equal(again.value.volume,.37);assert.equal(f.data.get(CAMPAIGN_V55_STORAGE_PREFIX+key),own);
});

test('own legacy records outrank historical primary records and corrupt own data never re-imports historical progress',()=>{
 for(const [ownKey,ownRecord]of [[legacy,record()],[key,'{broken']]){
  const f=fixture([[FOUNDATION_STORAGE_PREFIX+key,JSON.stringify({completed:[50],volume:.99})],[CAMPAIGN_V55_STORAGE_PREFIX+ownKey,ownRecord]]);
  const before=new Map(f.data),prefs=new LabPreferences(candidate(f),{campaignRevision:CREATIVE_CAMPAIGN_REVISION});
  if(ownKey===legacy){assert.deepEqual(prefs.value.completed,[0,1,39]);assert.equal(prefs.value.volume,.21);}
  else{assert.equal(prefs.readFailed,true);prefs.save({volume:.4});assert.equal(f.data.get(CAMPAIGN_V55_STORAGE_PREFIX+key),ownRecord);}
  assert.equal(f.data.get(FOUNDATION_STORAGE_PREFIX+key),before.get(FOUNDATION_STORAGE_PREFIX+key));
 }
});

test('root and opted-in previews keep their existing storage boundaries',()=>{
 const f=fixture([[FOUNDATION_STORAGE_PREFIX+key,record()]]);
 foundationCampaignStorage(f.storage,{pathname:'/',fullFoundationCampaign:true}).setItem(key,'root update');
 assert.deepEqual(f.writes,[FOUNDATION_STORAGE_PREFIX+key]);
 for(const query of ['tower41preview=1','debug=1&level=41&tower41ratchet=1','pilot=43','pilot=progression']){
  const flags=readTower41EntryFlags('?edition=foundation&'+query),full=!flags.preview&&!flags.tower41Qualification&&!flags.puzzlePilot43&&!flags.puzzleProgression;
  assert.equal(full,false);assert.equal(foundationCampaignPrefix('/campaign-v55/',{fullFoundationCampaign:full}),FOUNDATION_STORAGE_PREFIX);
 }
 assert.equal(foundationCampaignStorage(undefined,{pathname:'/campaign-v55/',fullFoundationCampaign:true}),undefined);
});

test('blocked reads cannot turn an imported candidate into a write over historical data',()=>{
 let writes=0;const storage={getItem(){throw Error('blocked');},setItem(){writes++;}};
 const prefs=new LabPreferences(foundationCampaignStorage(storage,{pathname:'/campaign-v55/',fullFoundationCampaign:true}));
 assert.equal(prefs.readFailed,true);prefs.save({volume:.4});assert.equal(writes,0);
});

test('v56 imports the latest v55 progress and leaves both previous editions intact',()=>{
 const historical=record(),previous=JSON.stringify({campaignRevision:CREATIVE_CAMPAIGN_REVISION,completed:[0,1,39,43],resumeLevel:43,volume:.44,muted:false,quality:'high'});
 const f=fixture([[FOUNDATION_STORAGE_PREFIX+key,historical],[CAMPAIGN_V55_STORAGE_PREFIX+key,previous]]);
 const v56=()=>foundationCampaignStorage(f.storage,{pathname:'/brainrot-portal/campaign-v56/',fullFoundationCampaign:true});
 const prefs=new LabPreferences(v56(),{campaignRevision:CREATIVE_CAMPAIGN_REVISION});
 assert.deepEqual(prefs.value.completed,[0,1,39,43]);assert.equal(prefs.value.volume,.44);assert.deepEqual(f.writes,[]);
 prefs.complete(45);prefs.save({volume:.52});
 assert.ok(f.writes.every(name=>name.startsWith(CAMPAIGN_V56_STORAGE_PREFIX)));
 assert.equal(f.data.get(FOUNDATION_STORAGE_PREFIX+key),historical);assert.equal(f.data.get(CAMPAIGN_V55_STORAGE_PREFIX+key),previous);
 f.data.set(CAMPAIGN_V55_STORAGE_PREFIX+key,'{bad subsequent source');
 const again=new LabPreferences(v56(),{campaignRevision:CREATIVE_CAMPAIGN_REVISION});
 assert.deepEqual(again.value.completed,[0,1,39,43,45]);assert.equal(again.value.volume,.52);
});

test('v56 keeps its exact entry boundary and never reimports over corrupt own progress',()=>{
 for(const base of ['','/brainrot-portal'])for(const suffix of ['','/','/index.html']){
  const path=base+'/campaign-v56'+suffix;assert.equal(isCampaignV56Path(path),true);assert.equal(isCampaignV55Path(path),false);
  assert.equal(foundationCampaignPrefix(path),CAMPAIGN_V56_STORAGE_PREFIX);
  assert.equal(foundationCampaignPrefix(path,{fullFoundationCampaign:false}),FOUNDATION_STORAGE_PREFIX);
 }
 for(const path of ['/campaign-v56/assets/a.js','/other/campaign-v56/','/campaign-v56-old/','/campaign-v56//'])assert.equal(foundationCampaignPrefix(path),FOUNDATION_STORAGE_PREFIX);
 const f=fixture([[CAMPAIGN_V55_STORAGE_PREFIX+key,record()],[CAMPAIGN_V56_STORAGE_PREFIX+key,'{broken own record']]);
 const prefs=new LabPreferences(foundationCampaignStorage(f.storage,{pathname:'/campaign-v56/',fullFoundationCampaign:true}));
 assert.equal(prefs.readFailed,true);prefs.save({volume:.4});assert.deepEqual(f.writes,[]);
});

test('v56 falls back to Foundation for a first visit and imports v55 legacy saves before older primary saves',()=>{
 for(const previous of [null,legacy]){
  const historical=record(),latest=JSON.stringify({campaignRevision:CREATIVE_CAMPAIGN_REVISION,completed:[2,6],resumeLevel:6,volume:.81});
  const entries=[[FOUNDATION_STORAGE_PREFIX+key,historical]];
  if(previous)entries.push([CAMPAIGN_V55_STORAGE_PREFIX+previous,latest]);
  const f=fixture(entries),prefs=new LabPreferences(foundationCampaignStorage(f.storage,{pathname:'/campaign-v56/',fullFoundationCampaign:true}),{campaignRevision:CREATIVE_CAMPAIGN_REVISION});
  assert.equal(prefs.readFailed,false);assert.deepEqual(prefs.value.completed,previous?[2,6]:[0,1,39]);
  assert.equal(prefs.value.volume,previous ? .81 : .21);
  prefs.save({volume:.5});assert.deepEqual(f.writes,[CAMPAIGN_V56_STORAGE_PREFIX+key]);
  for(const[name,bytes]of entries)assert.equal(f.data.get(name),bytes);
 }
});

test('v56 own legacy progress wins and an unreadable v55 save never silently downgrades to Foundation',()=>{
 const historical=record(),own=JSON.stringify({campaignRevision:CREATIVE_CAMPAIGN_REVISION,completed:[8],volume:.73});
 const f=fixture([[FOUNDATION_STORAGE_PREFIX+key,historical],[CAMPAIGN_V55_STORAGE_PREFIX+key,'{corrupt v55'],[CAMPAIGN_V56_STORAGE_PREFIX+legacy,own]]);
 const create=()=>new LabPreferences(foundationCampaignStorage(f.storage,{pathname:'/campaign-v56/',fullFoundationCampaign:true}),{campaignRevision:CREATIVE_CAMPAIGN_REVISION});
 const prefs=create();assert.equal(prefs.readFailed,false);assert.deepEqual(prefs.value.completed,[8]);assert.equal(prefs.value.volume,.73);
 f.data.delete(CAMPAIGN_V56_STORAGE_PREFIX+legacy);
 const imported=create();assert.equal(imported.readFailed,true);imported.save({volume:.9});assert.deepEqual(f.writes,[]);
 assert.equal(f.data.get(FOUNDATION_STORAGE_PREFIX+key),historical);assert.equal(f.data.get(CAMPAIGN_V55_STORAGE_PREFIX+key),'{corrupt v55');
});
