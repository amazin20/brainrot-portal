import assert from 'node:assert/strict';
import {CREATIVE_CAMPAIGN_REVISION} from '../../src/game/LabPreferences.js';

// Accepted v61 full-campaign saves already carry these room revisions. Keep
// this historical fixture explicit: missing/stale mechanism revisions must
// continue to invalidate their progress in the real preferences constructor.
export const V61_ACCEPTED_ROOM_REVISIONS=Object.freeze({
  16:'cable-supported-architecture-v1',22:'counterweight-dynamic-v1',32:'siphon-observatory-v1',
  42:'spatial-progression43-v1',43:'spatial-progression44-v1',44:'spatial-progression45-v1',
  45:'spatial-progression46-v1',46:'spatial-progression47-v1',47:'spatial-progression48-v1',
  48:'spatial-progression49-v1',49:'spatial-progression50-v1',50:'spatial-progression51-v1',
});

export function v61HistoricalPreferenceFixture(preferences={}){
  return {...preferences,campaignRevision:CREATIVE_CAMPAIGN_REVISION,roomRevisions:{...V61_ACCEPTED_ROOM_REVISIONS}};
}

export const V62_IMPORTED_PREFERENCES=Object.freeze({
  completed:Object.freeze([0,1,6,9,10,14,19,20,22,25,28,29,40]),
  hints:Object.freeze({1:2,14:1,22:2,29:1,40:3}),resumeLevel:3,
  quality:'low',volume:.29,muted:true,tutorial:true,
});
const OWN_KEY='brainrot-campaign-v62:brainrot-portal.preferences.v24';

/** Validate observed lifecycle evidence. Valid historical saves are read
 * through until an ordinary setting/Play action creates the private record. */
export function assertCampaignPreferenceLifecycleObservation(value,{phase,requireWrites=false,requireRuntime=false}={}){
  assert.ok(phase==='historical-read-through'||phase==='own-persisted','Explicit preference lifecycle phase required');
  assert.equal(value?.phase,phase,'Preference lifecycle phase differs');
  const expected={...V62_IMPORTED_PREFERENCES,...(phase==='own-persisted'?{volume:.37,tutorial:false}:{})};
  assert.ok(value.dom&&typeof value.dom==='object','Observed preference DOM required');
  assert.equal(value.dom.selectedLevel,3);assert.deepEqual(value.dom.completedIndices,V62_IMPORTED_PREFERENCES.completed);
  assert.equal(value.dom.completedCount,13);assert.equal(value.dom.totalRooms,51);
  assert.equal(value.dom.completedText,'13 из 51 пройдено');
  assert.deepEqual(value.dom.settings,{quality:expected.quality,volume:expected.volume,muted:expected.muted,tutorial:expected.tutorial});
  assert.ok(Array.isArray(value.writes),'Observed storage writes required');
  if(phase==='historical-read-through'){
    assert.equal(value.ownRaw,null,'Read-through must not invent a private record');
    assert.equal(value.ownPreferences,null,'Read-through must not synthesize private preferences');
    assert.deepEqual(value.writes,[],'Valid historical startup must not write');
  }else{
    assert.equal(typeof value.ownRaw,'string','A real persisted private JSON record is required');
    const parsed=JSON.parse(value.ownRaw);assert.ok(parsed&&typeof parsed==='object'&&!Array.isArray(parsed));
    assert.deepEqual(value.ownPreferences,parsed,'Persisted preferences must match the actual JSON bytes');
    for(const[key,wanted]of Object.entries(expected))assert.deepEqual(parsed[key],wanted,'Persisted preference differs: '+key);
    assert.equal(parsed.campaignRevision,CREATIVE_CAMPAIGN_REVISION);
    assert.deepEqual(parsed.roomRevisions,V61_ACCEPTED_ROOM_REVISIONS);
    assert.ok(value.writes.every(write=>write.method==='setItem'&&write.key===OWN_KEY),'Only private preference setItem writes are allowed');
    if(requireWrites)assert.ok(value.writes.length>0,'The ordinary action must actually persist private preferences');
  }
  if(requireRuntime){
    assert.ok(value.runtimePreferences&&typeof value.runtimePreferences==='object','Source runtime preferences required');
    for(const[key,wanted]of Object.entries(expected))assert.deepEqual(value.runtimePreferences[key],wanted,'Runtime preference differs: '+key);
  }
  return value.ownPreferences;
}

// Closure-free read-only page function shared by the real observers and their
// regression harnesses. It reads actual option markers, counter and controls.
export function readCampaignPreferenceLifecycleObservation({phase,writeLog,includeRuntime=false}){
  const ownRaw=localStorage.getItem('brainrot-campaign-v62:brainrot-portal.preferences.v24');
  const completedText=document.querySelector('#campaign-completed').textContent.trim();
  const count=completedText.match(/^(\d+) из (\d+) пройдено$/);
  const value={phase,ownRaw,ownPreferences:ownRaw===null?null:JSON.parse(ownRaw),writes:window[writeLog]??[],dom:{
    selectedLevel:Number(document.querySelector('#level-select').value),
    completedIndices:[...document.querySelector('#level-select').options].filter(option=>option.textContent.trim().endsWith('✓')).map(option=>Number(option.value)),
    completedText,completedCount:count?Number(count[1]):null,totalRooms:count?Number(count[2]):null,
    settings:{quality:document.querySelector('#quality-select').value,volume:Number(document.querySelector('#volume-control').value)/100,
      muted:document.querySelector('#mute-toggle').checked,tutorial:document.querySelector('#tutorial-toggle').checked},
  }};
  if(includeRuntime)value.runtimePreferences={...window.__NESI_PREFS__.value};
  return value;
}
