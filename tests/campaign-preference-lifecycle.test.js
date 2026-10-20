import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {LabPreferences,CREATIVE_CAMPAIGN_REVISION,CREATIVE_REPLACED_INDICES} from '../src/game/LabPreferences.js';
import {PROGRESSION_INDICES} from '../src/game/LabPuzzleProgression.js';
import {foundationCampaignStorage,CAMPAIGN_PREFERENCE_KEY} from '../src/game/LabCampaignStorage.js';
import {V62_IMPORTED_PREFERENCES,v61HistoricalPreferenceFixture,readCampaignPreferenceLifecycleObservation,assertCampaignPreferenceLifecycleObservation} from '../scripts/lib/campaign-preferences-fixture.mjs';

const ownPrefix='brainrot-campaign-v62:',ownKey=ownPrefix+CAMPAIGN_PREFERENCE_KEY;
const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const start=main.indexOf('\n  foundationEdition.enabled?{campaignRevision:'),end=main.indexOf('),holds=new Set();',start);
assert.ok(start>=0&&end>start);
const options=Function('foundationEdition','fullFoundationCampaign','CREATIVE_CAMPAIGN_REVISION','CREATIVE_REPLACED_INDICES','PROGRESSION_INDICES',
 `return (${main.slice(start,end).trim()});`)({enabled:true},true,CREATIVE_CAMPAIGN_REVISION,CREATIVE_REPLACED_INDICES,PROGRESSION_INDICES);
const runner=fs.readFileSync(new URL('../scripts/qa-campaign-save-isolation.mjs',import.meta.url),'utf8');
const blockStart=runner.indexOf('function assertIsolated(value){'),blockEnd=runner.indexOf('async function ready(',blockStart);
assert.ok(blockStart>=0&&blockEnd>blockStart);
function fixture(){
 const oldRecord={['brainrot-campaign-v61:'+CAMPAIGN_PREFERENCE_KEY]:JSON.stringify(v61HistoricalPreferenceFixture(V62_IMPORTED_PREFERENCES))};
 const data=new Map(Object.entries(oldRecord));let writes=[],preferences;
 const storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>{data.set(key,value);writes.push({method:'setItem',key});}};
 const load=()=>preferences=new LabPreferences(foundationCampaignStorage(storage,{pathname:'/campaign-v62/',fullFoundationCampaign:true}),options);
 load();
 const readDOM=selector=>{
  const p=preferences.value;
  if(selector==='#level-select')return{value:String(p.resumeLevel),options:Array.from({length:51},(_,index)=>({value:String(index),textContent:`${index+1} room${p.completed.includes(index)?' ✓':''}`}))};
  if(selector==='#campaign-completed')return{textContent:`${p.completed.length} из 51 пройдено`};
  if(selector==='#quality-select')return{value:p.quality};
  if(selector==='#volume-control')return{value:String(p.volume*100)};
  if(selector==='#mute-toggle')return{checked:p.muted};
  if(selector==='#tutorial-toggle')return{checked:p.tutorial};
  throw new Error('Unexpected DOM selector: '+selector);
 };
 const page={evaluate:async(fn,args)=>JSON.parse(JSON.stringify(vm.runInNewContext(`(${fn.toString()})(args)`,{
  args,localStorage:storage,document:{querySelector:readDOM},window:{__NESI_PREFS__:preferences,__CAMPAIGN_STORAGE_WRITES__:writes},
 })))};
 const snapshot=async()=>({historical:Object.fromEntries(Object.keys(oldRecord).map(key=>[key,storage.getItem(key)])),own:storage.getItem(ownKey),writes:structuredClone(writes)});
 const report={preferenceLifecycle:[]};
 // Execute the real runner's observer/assertion block. The page bridge models
 // serialization only; the constructor, adapter, collector and validator are real.
 const observe=Function('assert','oldRecord','ownPrefix','snapshot','readCampaignPreferenceLifecycleObservation','assertCampaignPreferenceLifecycleObservation','report',
  runner.slice(blockStart,blockEnd)+';return observeLifecycle;')(assert,oldRecord,ownPrefix,snapshot,readCampaignPreferenceLifecycleObservation,assertCampaignPreferenceLifecycleObservation,report);
 return{page,report,observe,data,oldRecord,get preferences(){return preferences;},reload(){writes=[];load();}};
}

test('actual Source observer proves read-through then ordinary settings persistence, Play and reload',async()=>{
 const f=fixture();await f.observe(f.page,'initial','historical-read-through');
 assert.equal(f.data.get(ownKey),undefined);assert.equal(f.report.preferenceLifecycle[0].ownPreferences,null);
 f.preferences.save({volume:.37});f.preferences.save({tutorial:false});
 await f.observe(f.page,'settings','own-persisted',true);
 f.preferences.save({resumeLevel:3,campaignSequenceRevision:'fifty-rooms-then-castle-v1'});
 await f.observe(f.page,'playing','own-persisted',true);
 f.reload();await f.observe(f.page,'reloaded','own-persisted');
 assert.deepEqual(f.report.preferenceLifecycle.map(value=>value.stage),['initial','settings','playing','reloaded']);
 assert.deepEqual(f.report.preferenceLifecycle.map(value=>value.phase),['historical-read-through','own-persisted','own-persisted','own-persisted']);
 for(const[key,bytes]of Object.entries(f.oldRecord))assert.equal(f.data.get(key),bytes);
 assert.deepEqual(f.report.preferenceLifecycle.at(-1).writes,[]);
});

test('shared real page collector supports bare entry without synthesizing private preferences or runtime hints',async()=>{
 const f=fixture(),value=await f.page.evaluate(readCampaignPreferenceLifecycleObservation,{phase:'historical-read-through',writeLog:'__CAMPAIGN_STORAGE_WRITES__'});
 assert.equal(Object.hasOwn(value,'runtimePreferences'),false);
 assert.equal(assertCampaignPreferenceLifecycleObservation(value,{phase:'historical-read-through'}),null);
 assert.equal(value.ownRaw,null);assert.equal(value.ownPreferences,null);assert.deepEqual(value.writes,[]);
});

test('lifecycle rejects absent phase, synthetic initial own record and false DOM progress/settings',async()=>{
 const f=fixture();await f.observe(f.page,'initial','historical-read-through');const original=f.report.preferenceLifecycle[0];
 const mutations=[value=>delete value.phase,value=>{value.ownRaw='{}';value.ownPreferences={};},value=>value.dom.completedIndices.splice(value.dom.completedIndices.indexOf(22),1),
  value=>value.dom.completedCount=12,value=>value.dom.completedText='12 из 51 пройдено',value=>value.dom.selectedLevel=0,value=>value.dom.settings.volume=.21,
  value=>value.writes.push({method:'setItem',key:ownKey}),value=>value.runtimePreferences.hints[22]=0];
 for(const mutate of mutations){const value=structuredClone(original);mutate(value);assert.throws(()=>assertCampaignPreferenceLifecycleObservation(value,{phase:'historical-read-through',requireRuntime:true}));}
});

test('lifecycle rejects absent persisted bytes, wrong progress/hints/revisions and non-private or absent writes',async()=>{
 const f=fixture();f.preferences.save({volume:.37,tutorial:false});await f.observe(f.page,'settings','own-persisted',true);const original=f.report.preferenceLifecycle[0];
 const alterRecord=(value,mutate)=>{mutate(value.ownPreferences);value.ownRaw=JSON.stringify(value.ownPreferences);};
 const mutations=[value=>{value.ownRaw=null;value.ownPreferences=null;},value=>alterRecord(value,p=>p.completed=p.completed.filter(index=>index!==22)),
  value=>alterRecord(value,p=>delete p.hints[22]),value=>alterRecord(value,p=>p.roomRevisions[22]='stale'),value=>value.ownPreferences.volume=.29,
  value=>value.writes=[{method:'setItem',key:'brainrot-campaign-v61:'+CAMPAIGN_PREFERENCE_KEY}],value=>value.writes=[{method:'clear',key:''}],
  value=>value.writes=[{method:'removeItem',key:ownKey}],value=>value.writes=[],value=>value.dom.completedIndices=[]];
 for(const mutate of mutations){const value=structuredClone(original);mutate(value);assert.throws(()=>assertCampaignPreferenceLifecycleObservation(value,{phase:'own-persisted',requireWrites:true,requireRuntime:true}));}
});
