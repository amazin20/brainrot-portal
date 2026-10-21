import test from 'node:test';
import assert from 'node:assert/strict';
import {LabPreferences,CREATIVE_CAMPAIGN_REVISION,CREATIVE_REPLACED_INDICES} from '../src/game/LabPreferences.js';
import {V62_IMPORTED_PREFERENCES,V61_ACCEPTED_ROOM_REVISIONS} from '../scripts/lib/campaign-preferences-fixture.mjs';
import {campaignAccessFixture} from '../scripts/lib/campaign-access-fixture.mjs';
import {foundationCampaignPrefix,foundationCampaignStorage,isCampaignV67Path,CAMPAIGN_V67_STORAGE_PREFIX as own,CAMPAIGN_V66_STORAGE_PREFIX as prior,CAMPAIGN_V65_STORAGE_PREFIX as older,FOUNDATION_STORAGE_PREFIX,CAMPAIGN_PREFERENCE_KEY as key} from '../src/game/LabCampaignStorage.js';

const options={campaignRevision:CREATIVE_CAMPAIGN_REVISION,replacedIndices:CREATIVE_REPLACED_INDICES,roomRevisions:V61_ACCEPTED_ROOM_REVISIONS};
const raw=JSON.stringify({...V62_IMPORTED_PREFERENCES,campaignRevision:CREATIVE_CAMPAIGN_REVISION,roomRevisions:V61_ACCEPTED_ROOM_REVISIONS,completed:Array.from({length:51},(_,i)=>i),hints:{0:2,40:3},resumeLevel:40});
function fixture(entries=[]){const data=new Map([[prior+key,raw],[older+key,JSON.stringify({completed:[0]})],...entries]),writes=[];const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>{writes.push(k);data.set(k,v);}};return{data,writes,load:()=>new LabPreferences(foundationCampaignStorage(storage,{pathname:'/brainrot-portal/campaign-v67/',fullFoundationCampaign:true}),options)};}

test('all exact v67 public paths use own namespace; archives and lookalikes do not',()=>{
 for(const base of ['', '/brainrot-portal'])for(const suffix of ['', '/', '/index.html']){
  const path=base+'/campaign-v67'+suffix;assert.equal(isCampaignV67Path(path),true);assert.equal(foundationCampaignPrefix(path),own);
  assert.notEqual(campaignAccessFixture({levelIndex:40,pathname:path}).key,FOUNDATION_STORAGE_PREFIX+key);
 }
 for(const path of ['/campaign-v670/','/campaign-v67-extra/','/archive/campaign-v67/','/brainrot-portal/campaign-v67/game.html'])assert.equal(isCampaignV67Path(path),false);
 assert.equal(foundationCampaignPrefix('/campaign-v67/',{fullFoundationCampaign:false}),FOUNDATION_STORAGE_PREFIX);
});
test('v67 imports newest v66 all51 wins and castle hints, and checkpoints only its own record',()=>{
 const f=fixture(),p=f.load();assert.equal(p.value.completed.length,51);assert.equal(p.value.hints[40],3);assert.deepEqual(f.writes,[]);
 assert.equal(p.saveProgress(),true);assert.deepEqual(f.writes,[own+key]);assert.equal(f.data.get(prior+key),raw);
 assert.deepEqual(f.load().value,p.value);
});
test('corrupt own v67 progress never reimports a prior victory or overwrites a save',()=>{
 const f=fixture([[own+key,'{broken']]),p=f.load();assert.equal(p.readFailed,true);assert.equal(p.saveProgress(),false);
 assert.deepEqual(f.writes,[]);assert.equal(f.data.get(prior+key),raw);assert.equal(f.data.get(own+key),'{broken');
});
