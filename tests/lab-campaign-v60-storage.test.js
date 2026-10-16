import test from 'node:test';
import assert from 'node:assert/strict';
import {LabPreferences,CREATIVE_CAMPAIGN_REVISION} from '../src/game/LabPreferences.js';
import {foundationCampaignStorage,foundationCampaignPrefix,isCampaignV60Path,CAMPAIGN_V60_STORAGE_PREFIX as own,CAMPAIGN_V59_STORAGE_PREFIX,CAMPAIGN_V58_STORAGE_PREFIX,CAMPAIGN_V57_STORAGE_PREFIX,CAMPAIGN_V56_STORAGE_PREFIX,CAMPAIGN_V55_STORAGE_PREFIX,FOUNDATION_STORAGE_PREFIX,CAMPAIGN_PREFERENCE_KEY as key} from '../src/game/LabCampaignStorage.js';

const legacy='nesi.preferences.v8';
const predecessors=[CAMPAIGN_V59_STORAGE_PREFIX,CAMPAIGN_V58_STORAGE_PREFIX,CAMPAIGN_V57_STORAGE_PREFIX,CAMPAIGN_V56_STORAGE_PREFIX,CAMPAIGN_V55_STORAGE_PREFIX,FOUNDATION_STORAGE_PREFIX];
const record=(volume=.29)=>JSON.stringify({campaignRevision:CREATIVE_CAMPAIGN_REVISION,completed:[0,1,6,9,40],hints:{1:2,40:3},resumeLevel:3,quality:'low',volume,muted:true,tutorial:true});
function fixture(entries=[]){
 const data=new Map(entries),writes=[];
 const storage={getItem:name=>data.get(name)??null,setItem:(name,value)=>{writes.push(name);data.set(name,value);}};
 return {data,writes,preferences:()=>new LabPreferences(foundationCampaignStorage(storage,{pathname:'/brainrot-portal/campaign-v60/',fullFoundationCampaign:true}),{campaignRevision:CREATIVE_CAMPAIGN_REVISION})};
}

test('v60 preserves every v59 completion including the expanded castle and writes only its own record',()=>{
 const entries=predecessors.map((prefix,i)=>[prefix+key,record(.29+i*.1)]),f=fixture(entries),p=f.preferences();
 assert.deepEqual(p.value.completed,[0,1,6,9,40]);assert.deepEqual(p.value.hints,{1:2,40:3});
 assert.equal(p.value.volume,.29);assert.equal(p.value.resumeLevel,3);assert.equal(p.value.quality,'low');assert.equal(p.value.muted,true);assert.equal(p.value.tutorial,true);
 p.complete(8);p.save({volume:.37,tutorial:false});assert.ok(f.writes.length>0&&f.writes.every(name=>name===own+key));
 for(const[name,value]of entries)assert.equal(f.data.get(name),value);
 f.data.set(CAMPAIGN_V59_STORAGE_PREFIX+key,'{damaged after migration');
 const reload=f.preferences();assert.deepEqual(reload.value.completed,[0,1,6,9,40,8]);assert.deepEqual(reload.value.hints,{1:2,40:3});assert.equal(reload.value.volume,.37);assert.equal(reload.value.tutorial,false);
});

test('v60 chooses one complete preceding namespace and retains v59 legacy-key castle progress',()=>{
 for(let start=0;start<predecessors.length;start++)for(const priorKey of [key,legacy]){
  const prefix=predecessors[start],raw=record(.42),f=fixture([[prefix+priorKey,raw],...predecessors.slice(start+1).map(p=>[p+key,record(.91)])]),p=f.preferences();
  assert.deepEqual(p.value.completed,start===0?[0,1,6,9,40]:[0,1,6,9]);
  assert.deepEqual(p.value.hints,start===0?{1:2,40:3}:{1:2});assert.equal(p.value.volume,.42);
  p.save({volume:.5});assert.deepEqual(f.writes,[own+key]);assert.equal(f.data.get(prefix+priorKey),raw);
 }
});

test('corrupt own or newest historical v60 imports never downgrade to older data',()=>{
 for(const broken of [own,CAMPAIGN_V59_STORAGE_PREFIX]){
  const f=fixture([[broken+key,'{damaged newest'],[CAMPAIGN_V58_STORAGE_PREFIX+key,record(.99)]]),p=f.preferences();
  assert.equal(p.readFailed,true);p.save({volume:.8});assert.deepEqual(f.writes,[]);assert.equal(f.data.get(broken+key),'{damaged newest');
 }
 const f=fixture([[own+legacy,record(.72)],[CAMPAIGN_V59_STORAGE_PREFIX+key,record(.99)]]);
 assert.deepEqual(f.preferences().value.completed,[0,1,6,9,40]);assert.equal(f.preferences().value.volume,.72);
});

test('only exact v60 entry paths activate the new isolated namespace',()=>{
 for(const base of ['','/brainrot-portal'])for(const suffix of ['','/','/index.html']){
  const path=base+'/campaign-v60'+suffix;assert.equal(isCampaignV60Path(path),true);assert.equal(foundationCampaignPrefix(path),own);assert.equal(foundationCampaignPrefix(path,{fullFoundationCampaign:false}),FOUNDATION_STORAGE_PREFIX);
 }
 for(const path of ['/campaign-v60/assets/index.js','/campaign-v60-old/','/campaign-v60//','/other/campaign-v60/','/%63ampaign-v60/','/brainrot-portal/campaign-v60/index.html/']){
  assert.equal(isCampaignV60Path(path),false);assert.equal(foundationCampaignPrefix(path),FOUNDATION_STORAGE_PREFIX);
 }
 assert.equal(foundationCampaignPrefix('/campaign-v59/'),CAMPAIGN_V59_STORAGE_PREFIX);
});
