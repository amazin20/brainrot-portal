import test from 'node:test';
import assert from 'node:assert/strict';
import {LabPreferences,CREATIVE_CAMPAIGN_REVISION} from '../src/game/LabPreferences.js';
import {foundationCampaignStorage,foundationCampaignPrefix,isCampaignV58Path,CAMPAIGN_V58_STORAGE_PREFIX as own,CAMPAIGN_V57_STORAGE_PREFIX,CAMPAIGN_V56_STORAGE_PREFIX,CAMPAIGN_V55_STORAGE_PREFIX,FOUNDATION_STORAGE_PREFIX,CAMPAIGN_PREFERENCE_KEY as key} from '../src/game/LabCampaignStorage.js';

const legacy='nesi.preferences.v8';
const predecessors=[CAMPAIGN_V57_STORAGE_PREFIX,CAMPAIGN_V56_STORAGE_PREFIX,CAMPAIGN_V55_STORAGE_PREFIX,FOUNDATION_STORAGE_PREFIX];
const record=(completed=[0,1,6],volume=.29)=>JSON.stringify({campaignRevision:CREATIVE_CAMPAIGN_REVISION,completed,hints:{1:2},resumeLevel:3,quality:'low',volume,muted:true,tutorial:true});
function fixture(entries=[]){
 const data=new Map(entries),writes=[];
 const storage={getItem:name=>data.get(name)??null,setItem:(name,value)=>{writes.push(name);data.set(name,value);}};
 return {data,writes,preferences:()=>new LabPreferences(foundationCampaignStorage(storage,{pathname:'/brainrot-portal/campaign-v58/',fullFoundationCampaign:true}),{campaignRevision:CREATIVE_CAMPAIGN_REVISION})};
}

test('v58 reads the complete newest save and persists only its own progress across reloads',()=>{
 const entries=predecessors.map((prefix,i)=>[prefix+key,record([0,1,6+i],.29+i*.1)]),f=fixture(entries),p=f.preferences();
 assert.deepEqual(p.value.completed,[0,1,6]);assert.deepEqual(p.value.hints,{1:2});assert.equal(p.value.resumeLevel,3);assert.equal(p.value.quality,'low');assert.equal(p.value.volume,.29);assert.equal(p.value.muted,true);assert.equal(p.value.tutorial,true);assert.deepEqual(f.writes,[]);
 p.complete(8);p.save({volume:.37,tutorial:false});assert.ok(f.writes.length>0&&f.writes.every(name=>name===own+key));
 for(const[name,value]of entries)assert.equal(f.data.get(name),value);
 f.data.set(CAMPAIGN_V57_STORAGE_PREFIX+key,'{damaged predecessor after migration');
 const reloaded=f.preferences();assert.deepEqual(reloaded.value.completed,[0,1,6,8]);assert.equal(reloaded.value.volume,.37);assert.equal(reloaded.value.tutorial,false);assert.equal(reloaded.value.resumeLevel,3);
});

test('v58 imports one whole preceding namespace, including its legacy key, without mixing older fields',()=>{
 for(let start=0;start<predecessors.length;start++)for(const priorKey of [key,legacy]){
  const prefix=predecessors[start],f=fixture([[prefix+priorKey,record([start+3],.42)],...predecessors.slice(start+1).map(p=>[p+key,record([49],.91)])]);
  const p=f.preferences();assert.deepEqual(p.value.completed,[start+3]);assert.equal(p.value.volume,.42);p.save({volume:.5});assert.deepEqual(f.writes,[own+key]);assert.equal(f.data.get(prefix+priorKey),record([start+3],.42));
 }
});

test('v58 never downgrades corrupt current or newest previous data to an older valid save',()=>{
 for(const broken of [own,CAMPAIGN_V57_STORAGE_PREFIX]){
  const f=fixture([[broken+key,'{damaged newest'],[CAMPAIGN_V56_STORAGE_PREFIX+key,record([50],.99)]]),p=f.preferences();
  assert.equal(p.readFailed,true);p.save({volume:.8});assert.deepEqual(f.writes,[]);assert.equal(f.data.get(broken+key),'{damaged newest');
 }
 const f=fixture([[own+legacy,record([19],.72)],[CAMPAIGN_V57_STORAGE_PREFIX+key,record([50],.99)]]);
 assert.deepEqual(f.preferences().value.completed,[19]);assert.equal(f.preferences().value.volume,.72);
});

test('only exact v58 entry paths select the new namespace and preview opts remain isolated',()=>{
 for(const base of ['','/brainrot-portal'])for(const suffix of ['','/','/index.html']){
  const path=base+'/campaign-v58'+suffix;assert.equal(isCampaignV58Path(path),true);assert.equal(foundationCampaignPrefix(path),own);assert.equal(foundationCampaignPrefix(path,{fullFoundationCampaign:false}),FOUNDATION_STORAGE_PREFIX);
 }
 for(const path of ['/campaign-v58/assets/index.js','/campaign-v58-old/','/campaign-v58//','/other/campaign-v58/','/%63ampaign-v58/','/brainrot-portal/campaign-v58/index.html/']){
  assert.equal(isCampaignV58Path(path),false);assert.equal(foundationCampaignPrefix(path),FOUNDATION_STORAGE_PREFIX);
 }
});
