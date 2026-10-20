import test from 'node:test';
import assert from 'node:assert/strict';
import {FOUNDATION_SEQUENCE,FOUNDATION_SEQUENCE_REVISION,foundationDisplayNumber} from '../src/game/LabCampaignSequence.js';
import {CAMPAIGN_V63_STORAGE_PREFIX,CAMPAIGN_PREFERENCE_KEY} from '../src/game/LabCampaignStorage.js';
import {V62_IMPORTED_PREFERENCES,v61HistoricalPreferenceFixture} from '../scripts/lib/campaign-preferences-fixture.mjs';
import {assertAtlasAccess,assertCompactPause,assertMobileControls,assertMigrationPhase} from '../scripts/lib/player-access-browser-proof.mjs';

// Protocol fixtures only: none of these objects are browser observations or
// release evidence. Mutation cases establish what actual evidence must reject.
const clone=value=>structuredClone(value),ownKey=CAMPAIGN_V63_STORAGE_PREFIX+CAMPAIGN_PREFERENCE_KEY;
const atlas=(completed=[],next=0)=>FOUNDATION_SEQUENCE.map(index=>({index,number:foundationDisplayNumber(index),disabled:!completed.includes(index)&&index!==next,ariaDisabled:String(!completed.includes(index)&&index!==next),completed:completed.includes(index)}));
const pause=()=>({state:'paused',settingsSelectCount:0,levelMenuButtonCount:1,settingsOpen:false,hintVisible:true,focusId:'resume-button',rect:{width:358,height:410},viewport:{width:390,height:844}});
const mobile=()=>({state:'playing',viewport:{width:844,height:390},touchPoints:1,coarsePointer:true,canvas:{width:844,height:390},controls:[
  {name:'joystick',x:18,y:252,width:112,height:112,visible:true},
  {name:'sprint',x:632,y:300,width:56,height:56,visible:true},
  {name:'jump',x:704,y:282,width:72,height:72,visible:true},
  {name:'portal-blue',x:648,y:152,width:52,height:52,visible:true},
  {name:'portal-orange',x:708,y:152,width:52,height:52,visible:true},
  {name:'interact',x:648,y:212,width:52,height:52,visible:true},
  {name:'pause',x:708,y:212,width:52,height:52,visible:true},
]});
const historicalRaw=JSON.stringify(v61HistoricalPreferenceFixture(V62_IMPORTED_PREFERENCES));
function migration(phase){
  const preferences={...clone(V62_IMPORTED_PREFERENCES),...(phase==='initial'?{}:{volume:.37,tutorial:false}),...(['playing','reloaded'].includes(phase)?{resumeLevel:2,campaignSequenceRevision:FOUNDATION_SEQUENCE_REVISION}:{})};
  return {selectedIndex:2,runtimePreferences:preferences,ownRaw:phase==='initial'?null:JSON.stringify(v61HistoricalPreferenceFixture(preferences)),writes:['settings','playing'].includes(phase)?[{method:'setItem',key:ownKey}]:[],historicalRaw};
}

test('atlas requires the real51-room order, one first unfinished room and completed replays',()=>{
  assertAtlasAccess(atlas());
  assertAtlasAccess(atlas([0],1),[0]);
  const sparse=[...V62_IMPORTED_PREFERENCES.completed];
  assertAtlasAccess(atlas(sparse,2),sparse);
  assertAtlasAccess(atlas([...FOUNDATION_SEQUENCE],null),[...FOUNDATION_SEQUENCE]);
  for(const change of [
    rows=>{rows[1].disabled=false;rows[1].ariaDisabled='false';},
    rows=>{rows[0].disabled=true;rows[0].ariaDisabled='true';},
    rows=>{rows[0].ariaDisabled='true';},
    rows=>{rows[0].completed=true;},
    rows=>{rows.at(-1).number=41;},
    rows=>{rows[1].index=0;},
    rows=>{rows.pop();},
    rows=>{[rows[0],rows[1]]=[rows[1],rows[0]];},
  ]){const rows=atlas();change(rows);assert.throws(()=>assertAtlasAccess(rows));}
});

test('pause keeps one atlas action, collapsed settings, hints and bounded dimensions',()=>{
  assertCompactPause(pause());
  assertCompactPause({...pause(),viewport:{width:844,height:390},rect:{width:480,height:300}});
  for(const change of [
    value=>{value.settingsSelectCount=1;},value=>{value.levelMenuButtonCount=2;},
    value=>{value.settingsOpen=true;},value=>{value.hintVisible=false;},
    value=>{value.focusId='level-menu-button';},value=>{value.state='playing';},
    value=>{value.rect.width=391;},value=>{value.rect.height=651;},
    value=>{value.viewport.height=400;value.rect.height=341;},value=>{value.rect.width=NaN;},
  ]){const value=pause();change(value);assert.throws(()=>assertCompactPause(value));}
});

test('mobile requires all seven real reachable44px targets and the actual coarse full-viewport canvas',()=>{
  assertMobileControls(mobile());
  for(const change of [
    value=>{value.touchPoints=0;},value=>{value.coarsePointer=false;},
    value=>{value.state='paused';},value=>{value.canvas.height=200;},
    value=>{value.controls.pop();},value=>{value.controls[0].name='jump';},
    value=>{value.controls[1].visible=false;},value=>{value.controls[2].width=43.99;},
    value=>{value.controls[3].x=-1;},value=>{value.controls[4].y=370;},
    value=>{value.controls[5].height=Infinity;},value=>{value.controls[6].x=NaN;},
  ]){const value=mobile();change(value);assert.throws(()=>assertMobileControls(value));}
});

test('four migration phases preserve historical bytes while private persistence follows settings and Play',()=>{
  for(const phase of ['initial','settings','playing','reloaded']){
    const value=migration(phase),before=JSON.stringify(value);
    assertMigrationPhase(value,{phase,ownKey,historicalRaw});
    assert.equal(JSON.stringify(value),before,'A proof validator must not rewrite observations');
  }
  const reloaded=migration('reloaded');reloaded.writes=[{method:'setItem',key:ownKey}];
  assertMigrationPhase(reloaded,{phase:'reloaded',ownKey,historicalRaw});
});

test('migration rejects a fabricated initial private record, startup writes and unclamped selection',()=>{
  for(const change of [
    value=>{value.ownRaw='{}';},value=>{value.writes=[{method:'setItem',key:ownKey}];},
    value=>{value.selectedIndex=3;},value=>{value.runtimePreferences.resumeLevel=2;},
    value=>{value.historicalRaw+=' ';},value=>{value.runtimePreferences.completed.push(2);},
    value=>{delete value.runtimePreferences.hints['40'];},value=>{value.phase='playing';},
  ]){const value=migration('initial');change(value);assert.throws(()=>assertMigrationPhase(value,{phase:'initial',ownKey,historicalRaw}));}
  assert.throws(()=>assertMigrationPhase(migration('initial'),{phase:'initial',ownKey:'brainrot-campaign-v62:'+CAMPAIGN_PREFERENCE_KEY,historicalRaw}));
});

test('migration requires an actual private write and matching persisted hints, revisions and resume after Play',()=>{
  for(const phase of ['settings','playing','reloaded']){
    const mutations=[
      value=>{value.ownRaw=null;},
      value=>{value.writes=[{method:'removeItem',key:ownKey}];},
      value=>{value.writes=[{method:'setItem',key:'brainrot-campaign-v62:'+CAMPAIGN_PREFERENCE_KEY}];},
      value=>{const own=JSON.parse(value.ownRaw);own.hints['40']=0;value.ownRaw=JSON.stringify(own);},
      value=>{const own=JSON.parse(value.ownRaw);own.roomRevisions={};value.ownRaw=JSON.stringify(own);},
      value=>{value.runtimePreferences.volume=.29;},
      value=>{const own=JSON.parse(value.ownRaw);own.resumeLevel=phase==='settings'?2:3;value.ownRaw=JSON.stringify(own);},
    ];
    if(phase!=='reloaded')mutations.push(value=>{value.writes=[];});
    for(const change of mutations){const value=migration(phase);change(value);assert.throws(()=>assertMigrationPhase(value,{phase,ownKey,historicalRaw}));}
  }
});
