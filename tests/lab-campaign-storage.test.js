import test from 'node:test';
import assert from 'node:assert/strict';
import {LabPreferences,CREATIVE_CAMPAIGN_REVISION} from '../src/game/LabPreferences.js';
import {foundationCampaignStorage,foundationCampaignPrefix,isCampaignV55Path,CAMPAIGN_V55_STORAGE_PREFIX,FOUNDATION_STORAGE_PREFIX,CAMPAIGN_PREFERENCE_KEY} from '../src/game/LabCampaignStorage.js';
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
