import assert from 'node:assert/strict';
import {FOUNDATION_SEQUENCE,FOUNDATION_SEQUENCE_REVISION,foundationDisplayNumber} from '../../src/game/LabCampaignSequence.js';
import {deriveCampaignAccess} from '../../src/game/LabCampaignAccess.js';
import {CAMPAIGN_V63_STORAGE_PREFIX,CAMPAIGN_PREFERENCE_KEY} from '../../src/game/LabCampaignStorage.js';
import {CREATIVE_CAMPAIGN_REVISION} from '../../src/game/LabPreferences.js';
import {V62_IMPORTED_PREFERENCES,V61_ACCEPTED_ROOM_REVISIONS} from './campaign-preferences-fixture.mjs';

// These functions validate retained observations. They do not run a browser,
// manufacture DOM/storage evidence, or grant release/platform acceptance.
const object=(value,message)=>assert.ok(value&&typeof value==='object'&&!Array.isArray(value),message);
const positive=(value,message)=>assert.ok(Number.isFinite(value)&&value>0,message);
const viewport=value=>{object(value,'Actual viewport required');positive(value.width,'Invalid viewport width');positive(value.height,'Invalid viewport height');};

export function assertAtlasAccess(rows,completed=[]){
  assert.ok(Array.isArray(rows)&&rows.length===FOUNDATION_SEQUENCE.length,'All51 actual atlas rows required');
  assert.ok(Array.isArray(completed),'Actual completed-index array required');
  assert.deepEqual(rows.map(row=>row.index),FOUNDATION_SEQUENCE,'Atlas order or permanent indices differ');
  assert.equal(new Set(rows.map(row=>row.index)).size,51,'Duplicate atlas room');
  const access=deriveCampaignAccess({completed}),allowed=new Set(access.accessibleIndices),passed=new Set(access.completedIndices);
  for(const row of rows){
    object(row,'Actual atlas row required');
    assert.equal(row.number,foundationDisplayNumber(row.index),'Atlas display number differs');
    assert.equal(row.disabled,!allowed.has(row.index),'Atlas disabled state differs: '+row.index);
    assert.equal(row.ariaDisabled,String(row.disabled),'Atlas aria-disabled differs: '+row.index);
    assert.equal(row.completed,passed.has(row.index),'Atlas completed marker differs: '+row.index);
  }
  return rows;
}

export function assertCompactPause(value){
  object(value,'Actual compact pause observation required');
  assert.equal(value.state,'paused');
  assert.equal(value.settingsSelectCount,0,'Pause must not contain the old level select');
  assert.equal(value.levelMenuButtonCount,1,'Pause must have one atlas navigation button');
  assert.equal(value.settingsOpen,false,'Secondary settings must initially be collapsed');
  assert.equal(value.hintVisible,true,'Hints must remain reachable from pause');
  assert.equal(value.focusId,'resume-button','Pause focus must start on Resume');
  viewport(value.viewport);object(value.rect,'Actual pause rectangle required');
  positive(value.rect.width,'Invalid pause width');positive(value.rect.height,'Invalid pause height');
  assert.ok(value.rect.width<=value.viewport.width+1e-6,'Pause exceeds viewport width');
  assert.ok(value.rect.height<=Math.min(value.viewport.height*.85,650)+1e-6,'Pause is not compact within the viewport');
  return value;
}

export const PLAYER_MOBILE_CONTROL_NAMES=Object.freeze(['joystick','sprint','jump','portal-blue','portal-orange','interact','pause']);
export function assertMobileControls(value){
  object(value,'Actual mobile controls observation required');
  assert.equal(value.state,'playing');viewport(value.viewport);
  assert.ok(Number.isInteger(value.touchPoints)&&value.touchPoints>0,'A real touch-capable browser profile is required');
  assert.equal(value.coarsePointer,true,'Coarse-pointer media query must be observed');
  object(value.canvas,'Actual canvas rectangle required');
  assert.equal(value.canvas.width,value.viewport.width,'Canvas CSS width differs from mobile viewport');
  assert.equal(value.canvas.height,value.viewport.height,'Canvas CSS height differs from mobile viewport');
  assert.ok(Array.isArray(value.controls),'Actual mobile control rectangles required');
  const names=value.controls.map(control=>control.name);
  assert.equal(new Set(names).size,names.length,'Duplicate mobile control name');
  for(const name of PLAYER_MOBILE_CONTROL_NAMES)assert.ok(names.includes(name),'Missing mobile control: '+name);
  for(const control of value.controls){
    object(control,'Actual mobile control required');
    assert.ok(typeof control.name==='string'&&control.name.length>0,'Invalid mobile control name');
    assert.equal(control.visible,true,'Hidden mobile control: '+control.name);
    assert.ok([control.x,control.y,control.width,control.height].every(Number.isFinite),'Nonfinite mobile rectangle: '+control.name);
    assert.ok(control.width>=44&&control.height>=44,'Mobile target is smaller than44CSSpx: '+control.name);
    assert.ok(control.x>=-1e-6&&control.y>=-1e-6&&control.x+control.width<=value.viewport.width+1e-6&&control.y+control.height<=value.viewport.height+1e-6,'Mobile control is outside viewport: '+control.name);
  }
  return value;
}

function assertPreferenceFields(record,expected,label){
  object(record,label+' preferences required');
  for(const[key,wanted]of Object.entries(expected))assert.deepEqual(record[key],wanted,label+' preference differs: '+key);
  if(Object.hasOwn(record,'campaignSequenceRevision'))assert.equal(record.campaignSequenceRevision,FOUNDATION_SEQUENCE_REVISION,label+' campaign order revision differs');
}

export function assertMigrationPhase(value,{phase,ownKey,historicalRaw}={}){
  assert.ok(['initial','settings','playing','reloaded'].includes(phase),'Explicit migration phase required');
  assert.equal(ownKey,CAMPAIGN_V63_STORAGE_PREFIX+CAMPAIGN_PREFERENCE_KEY,'The private v63 preference key is required');
  assert.equal(typeof historicalRaw,'string','Actual historical raw JSON required');
  const historical=JSON.parse(historicalRaw);
  assertPreferenceFields(historical,V62_IMPORTED_PREFERENCES,'Historical');
  assert.equal(historical.campaignRevision,CREATIVE_CAMPAIGN_REVISION,'Historical campaign revision differs');
  assert.deepEqual(historical.roomRevisions,V61_ACCEPTED_ROOM_REVISIONS,'Historical room revisions differ');
  object(value,'Actual migration observation required');
  if(Object.hasOwn(value,'phase'))assert.equal(value.phase,phase,'Observed migration phase differs');
  assert.equal(value.selectedIndex,2,'The actual selection must clamp to the first unfinished room');
  assert.equal(value.historicalRaw,historicalRaw,'Historical raw save bytes changed');
  const expected={...V62_IMPORTED_PREFERENCES,...(phase==='initial'?{}:{volume:.37,tutorial:false}),...(['playing','reloaded'].includes(phase)?{resumeLevel:2}:{})};
  assertPreferenceFields(value.runtimePreferences,expected,'Runtime');
  assert.ok(Array.isArray(value.writes),'Actual storage write log required');
  assert.ok(value.writes.every(write=>write&&write.method==='setItem'&&write.key===ownKey),'Only private v63 preference setItem writes are allowed');
  if(phase==='initial'){
    assert.equal(value.ownRaw,null,'Historical startup must not create a private record');
    assert.deepEqual(value.writes,[],'Historical startup must not write');
  }else{
    assert.equal(typeof value.ownRaw,'string','Actual private JSON bytes required');
    const own=JSON.parse(value.ownRaw);
    assertPreferenceFields(own,expected,'Persisted');
    assert.equal(own.campaignRevision,CREATIVE_CAMPAIGN_REVISION,'Persisted campaign revision differs');
    assert.deepEqual(own.roomRevisions,V61_ACCEPTED_ROOM_REVISIONS,'Persisted room revisions differ');
    for(const[key,wanted]of Object.entries(value.runtimePreferences))assert.deepEqual(own[key],wanted,'Persisted/runtime preference mismatch: '+key);
    if(phase==='settings'||phase==='playing')assert.ok(value.writes.length>0,'The ordinary action must actually write private preferences');
  }
  return value;
}
