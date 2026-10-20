import test from 'node:test';
import assert from 'node:assert/strict';
import {FOUNDATION_SEQUENCE,CASTLE_LEVEL_INDEX} from '../src/game/LabCampaignSequence.js';
import {LabPreferences,CREATIVE_CAMPAIGN_REVISION} from '../src/game/LabPreferences.js';
import {deriveCampaignAccess,canAccessCampaignLevel,resolveCampaignLevel} from '../src/game/LabCampaignAccess.js';

test('a new player can launch only the first room, including through a direct late-room request',()=>{
  const preferences=Object.freeze({completed:Object.freeze([]),resumeLevel:40});
  const access=deriveCampaignAccess(preferences);
  assert.deepEqual(access.accessibleIndices,[0]);
  assert.deepEqual(access.completedIndices,[]);
  assert.equal(access.nextIndex,0);
  assert.equal(access.allCompleted,false);
  assert.equal(canAccessCampaignLevel(0,preferences),true);
  for(const requested of [1,39,40,41,50,999,-1,NaN,'0',null,undefined]){
    assert.equal(canAccessCampaignLevel(requested,preferences),false);
    assert.equal(resolveCampaignLevel(requested,preferences),0);
  }
  assert.deepEqual(preferences,{completed:[],resumeLevel:40});
});

test('each real campaign win opens exactly one next room and the castle is the fifty-first',()=>{
  const preferences={completed:[]};
  for(const [position,index] of FOUNDATION_SEQUENCE.entries()){
    const before=deriveCampaignAccess(preferences);
    assert.equal(before.nextIndex,index);
    assert.deepEqual(before.accessibleIndices,FOUNDATION_SEQUENCE.slice(0,position+1));
    assert.equal(canAccessCampaignLevel(CASTLE_LEVEL_INDEX,preferences),position===50);
    preferences.completed.push(index);
    const after=deriveCampaignAccess(preferences);
    assert.equal(after.nextIndex,FOUNDATION_SEQUENCE[position+1]??null);
    assert.equal(after.allCompleted,position===50);
  }
  assert.deepEqual(deriveCampaignAccess(preferences).accessibleIndices,FOUNDATION_SEQUENCE);
  assert.equal(resolveCampaignLevel(40,preferences),40);
  assert.equal(resolveCampaignLevel(-1,preferences),0);
});

test('sparse accepted historical completions remain replayable without opening their intervening rooms',()=>{
  const preferences=Object.freeze({
    completed:Object.freeze([0,1,6,9,10,14,19,20,22,25,28,29,40]),
    hints:Object.freeze({'1':2,'14':1,'22':2,'29':1,'40':3}),
    resumeLevel:3,
  });
  const access=deriveCampaignAccess(preferences);
  assert.equal(access.nextIndex,2);
  assert.deepEqual(access.completedIndices,[0,1,6,9,10,14,19,20,22,25,28,29,40]);
  assert.deepEqual(access.accessibleIndices,[0,1,2,6,9,10,14,19,20,22,25,28,29,40]);
  assert.equal(canAccessCampaignLevel(40,preferences),true);
  for(const index of [3,4,5,7,8,21,23,24,26,27,30,39,41,50])assert.equal(canAccessCampaignLevel(index,preferences),false);
  assert.equal(resolveCampaignLevel(preferences.resumeLevel,preferences),2);
  assert.equal(resolveCampaignLevel(6,preferences),6);
  // Access does not overwrite a historically saved resume choice or spoilers.
  assert.equal(preferences.resumeLevel,3);
  assert.equal(preferences.hints['40'],3);
});

test('a completed late replay cannot skip an earlier gap through the normal next-room request',()=>{
  const preferences={completed:[0,1,6]};
  assert.equal(resolveCampaignLevel(6,preferences),6);
  assert.equal(resolveCampaignLevel(7,preferences),2);
  preferences.completed.push(2);
  assert.equal(resolveCampaignLevel(7,preferences),3);
  assert.equal(resolveCampaignLevel(1,preferences),1);
});

test('unlocking survives a real preference save and reload without a second access record',()=>{
  const key='brainrot-portal.preferences.v24',writes=[];
  let raw=JSON.stringify({campaignRevision:CREATIVE_CAMPAIGN_REVISION,completed:[],hints:{},volume:.29,muted:true,quality:'low',tutorial:false,roomRevisions:{'0':'retained-room'}});
  const storage={getItem:name=>name===key?raw:null,setItem:(name,value)=>{writes.push({name,value});raw=value;}};
  const preferences=new LabPreferences(storage,{campaignRevision:CREATIVE_CAMPAIGN_REVISION});
  const initial=raw;
  assert.equal(deriveCampaignAccess(preferences.value).nextIndex,0);
  assert.equal(resolveCampaignLevel(50,preferences.value),0);
  assert.equal(writes.length,0);
  assert.equal(raw,initial);
  preferences.complete(0);
  assert.equal(writes.length,1);
  assert.equal(writes[0].name,key);
  const afterWin=raw;
  const reloaded=new LabPreferences(storage,{campaignRevision:CREATIVE_CAMPAIGN_REVISION});
  assert.deepEqual(deriveCampaignAccess(reloaded.value).accessibleIndices,[0,1]);
  assert.equal(reloaded.value.volume,.29);
  assert.equal(reloaded.value.muted,true);
  assert.equal(reloaded.value.quality,'low');
  assert.equal(reloaded.value.tutorial,false);
  assert.deepEqual(reloaded.roomRevisions,{'0':'retained-room'});
  assert.equal(writes.length,1);
  assert.equal(raw,afterWin);
  assert.equal(Object.hasOwn(JSON.parse(raw),'unlocked'),false);
});

test('unrelated and malformed completions cannot open rooms in an edition or reordered selection',()=>{
  const sequence=Object.freeze([3,9,1]);
  const preferences=Object.freeze({completed:Object.freeze([9,9,40,'3',NaN,-1,99])});
  assert.deepEqual(deriveCampaignAccess(preferences,sequence),{
    sequence:[3,9,1],completedIndices:[9],accessibleIndices:[3,9],nextIndex:3,allCompleted:false,
  });
  assert.equal(resolveCampaignLevel(1,preferences,sequence),3);
  assert.equal(resolveCampaignLevel(9,preferences,sequence),9);
  assert.deepEqual(deriveCampaignAccess({completed:'all'},sequence).accessibleIndices,[3]);
  assert.deepEqual(deriveCampaignAccess(null,sequence).accessibleIndices,[3]);
});

test('the access projection cannot mutate campaign order or save data through returned arrays',()=>{
  const preferences={completed:[0],hints:{'0':2},resumeLevel:1};
  const before=JSON.stringify(preferences),sequence=[...FOUNDATION_SEQUENCE];
  const access=deriveCampaignAccess(preferences,sequence);
  assert.throws(()=>access.sequence.reverse(),TypeError);
  assert.throws(()=>access.completedIndices.push(50),TypeError);
  assert.throws(()=>access.accessibleIndices.push(40),TypeError);
  assert.deepEqual(sequence,FOUNDATION_SEQUENCE);
  assert.equal(JSON.stringify(preferences),before);
  assert.equal(deriveCampaignAccess({},[]).nextIndex,null);
  assert.equal(deriveCampaignAccess({},[]).allCompleted,false);
  assert.equal(resolveCampaignLevel(0,{},[]),null);
  assert.throws(()=>deriveCampaignAccess({},[0,0]),TypeError);
  assert.throws(()=>deriveCampaignAccess({},[0,1.5]),TypeError);
  assert.throws(()=>deriveCampaignAccess({},Array(1)),TypeError);
});
