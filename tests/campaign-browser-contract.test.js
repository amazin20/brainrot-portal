import test from 'node:test';
import assert from 'node:assert/strict';
import {assertStampedCampaignInfo,assertCampaignBrowserState} from '../scripts/lib/campaign-browser-contract.mjs';
import {animationFrameStatistics} from '../scripts/lib/animation-frame-quality.mjs';
import {ACTIVE_FOUNDATION_RUNTIME_FLAGS,RELEASE_VERSION} from '../src/game/ReleaseIdentity.js';
import {FOUNDATION_SEQUENCE,foundationDisplayNumber} from '../src/game/LabCampaignSequence.js';
import {campaignSpec} from '../src/game/LabCampaignLevels.js';

const runtime={chamberEdition:'foundation',...ACTIVE_FOUNDATION_RUNTIME_FLAGS};
const commit='a'.repeat(40);
const packageInfo=()=>({commit,version:RELEASE_VERSION,runtimeConfig:{...runtime},rooms:FOUNDATION_SEQUENCE.map(index=>({stableLevel:index+1,level:foundationDisplayNumber(index),id:campaignSpec(runtime,index).id}))});
const observed=stableLevel=>({levelIndex:stableLevel-1,edition:'foundation',flags:{...ACTIVE_FOUNDATION_RUNTIME_FLAGS},
 id:campaignSpec(runtime,stableLevel-1).id,hudNumber:foundationDisplayNumber(stableLevel-1),optionNumber:foundationDisplayNumber(stableLevel-1),
 physicalRoom23:stableLevel===23,pilot43:stableLevel===43,progressionLevel:stableLevel>=44?stableLevel:null});

test('frozen browser evidence rejects another source, runtime configuration or visible castle mapping',()=>{
 assertStampedCampaignInfo(packageInfo(),commit);
 for(const change of [info=>info.commit='b'.repeat(40),info=>info.runtimeConfig.puzzleProgression=false,
  info=>info.rooms.at(-1).level=41,info=>info.rooms[49].id='echo-horizon']){
  const info=packageInfo();change(info);assert.throws(()=>assertStampedCampaignInfo(info,commit));
 }
});

test('live root inspection checks actual replacement builders and HUD numbers without turning flags on',()=>{
 for(const stableLevel of [9,23,43,50,51,41])assert.equal(assertCampaignBrowserState(observed(stableLevel),stableLevel),foundationDisplayNumber(stableLevel-1));
 for(const [level,change]of [[23,row=>row.physicalRoom23=false],[43,row=>row.pilot43=false],[51,row=>row.progressionLevel=null],
  [41,row=>row.hudNumber=41],[51,row=>row.optionNumber=51],[9,row=>row.flags.campaignSequencePresentation=false]]){
  const row=observed(level),before=JSON.stringify(row);change(row);
  const altered=JSON.stringify(row);assert.notEqual(altered,before);assert.throws(()=>assertCampaignBrowserState(row,level));assert.equal(JSON.stringify(row),altered);
 }
});

const decoded=(count=48,blank=-1)=>Array.from({length:count},(_,frame)=>`frame:${frame} pts:${frame} pts_time:${frame/15}\nlavfi.signalstats.YMIN=20\nlavfi.signalstats.YMAX=${frame===blank?20:180}`).join('\n');
test('an encodable blank animation, missing samples or undecoded pixels cannot pass visual evidence',()=>{
 assert.deepEqual(animationFrameStatistics(decoded(),{expectedFrames:48}),{frames:48,minimumLumaRange:160,allNonblank:true});
 assert.throws(()=>animationFrameStatistics(decoded(48,17),{expectedFrames:48}),/blank/);
 assert.throws(()=>animationFrameStatistics(decoded(8),{expectedFrames:8}),/omitted/);
 assert.throws(()=>animationFrameStatistics(decoded(),{expectedFrames:49}),/frame count/);
 assert.throws(()=>animationFrameStatistics(decoded().replaceAll('YMAX','MISSING'),{expectedFrames:48}),/statistics/);
});
