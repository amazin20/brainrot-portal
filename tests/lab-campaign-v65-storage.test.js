import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {LabPreferences,CREATIVE_CAMPAIGN_REVISION,CREATIVE_REPLACED_INDICES} from '../src/game/LabPreferences.js';
import {PROGRESSION_INDICES} from '../src/game/LabPuzzleProgression.js';
import {V62_IMPORTED_PREFERENCES,V61_ACCEPTED_ROOM_REVISIONS} from '../scripts/lib/campaign-preferences-fixture.mjs';
import {foundationCampaignStorage,foundationCampaignPrefix,CAMPAIGN_V65_STORAGE_PREFIX as own,CAMPAIGN_V64_STORAGE_PREFIX as prior,CAMPAIGN_PREFERENCE_KEY as key} from '../src/game/LabCampaignStorage.js';

const source=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const start=source.indexOf('\n  foundationEdition.enabled?{campaignRevision:'),end=source.indexOf('),holds=new Set();',start);
assert.ok(start>=0&&end>start);
const options=Function('foundationEdition','fullFoundationCampaign','CREATIVE_CAMPAIGN_REVISION','CREATIVE_REPLACED_INDICES','PROGRESSION_INDICES',`return (${source.slice(start,end).trim()});`)({enabled:true},true,CREATIVE_CAMPAIGN_REVISION,CREATIVE_REPLACED_INDICES,PROGRESSION_INDICES);
const raw=JSON.stringify({...V62_IMPORTED_PREFERENCES,campaignRevision:CREATIVE_CAMPAIGN_REVISION,roomRevisions:V61_ACCEPTED_ROOM_REVISIONS,completed:Array.from({length:51},(_,i)=>i),hints:{0:2,40:3},resumeLevel:40});
function fixture(extra=[]){const data=new Map([[prior+key,raw],...extra]),writes=[];const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>{writes.push(k);data.set(k,v);}};return{data,writes,load:()=>new LabPreferences(foundationCampaignStorage(storage,{pathname:'/brainrot-portal/campaign-v65/',fullFoundationCampaign:true}),options)};}
test('v65 imports all51 v64 wins and castle hints without writes, then checkpoints only its own record',()=>{
 const f=fixture(),p=f.load();assert.equal(foundationCampaignPrefix('/brainrot-portal/campaign-v65/'),own);
 assert.equal(p.value.completed.length,51);assert.equal(p.value.hints[40],3);assert.deepEqual(f.writes,[]);
 assert.equal(p.saveProgress(),true);assert.deepEqual(f.writes,[own+key]);assert.equal(f.data.get(prior+key),raw);
 const reloaded=f.load();assert.deepEqual(reloaded.value,p.value);assert.deepEqual(f.writes,[own+key]);
});
test('a corrupt own v65 record cannot fall back to v64 or overwrite either record before an advert',()=>{
 const f=fixture([[own+key,'{broken']]),p=f.load();assert.equal(p.readFailed,true);assert.equal(p.saveProgress(),false);
 assert.deepEqual(f.writes,[]);assert.equal(f.data.get(prior+key),raw);assert.equal(f.data.get(own+key),'{broken');
});
