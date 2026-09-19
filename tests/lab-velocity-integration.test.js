import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runVelocityJourney} from '../src/game/LabVelocityEvidence.js';
import {LabGame} from '../src/game/LabGame.js';

// Full body/portal/companion integration uses the actual source assets and the
// same 120 Hz simulation as production. No physics state is injected.
test('both speed chapters accept coarse ordinary shots and finish with the original companion',async()=>{
 const game=await createHeadlessGame();game.epicMode=true;
 try{
  for(const chapter of [1,2]){
   game.velocityChapter=chapter;await game.selectLevel(0,true);
   const report=await runVelocityJourney(game,{renderFps:30});
   assert.equal(report.teleports,chapter===1?3:4);assert.equal(report.companionFinishedTogether,true);
   assert.equal(report.diagnostics.retries,0);assert.ok(report.peakSpeed>30);
   assert.ok(report.requests.every(shot=>shot.aimDegrees>3.8&&shot.aimDegrees<6.2));
   assert.ok(report.impacts.every(impact=>impact.valid));
  }
 }finally{game.velocityCompanion?.dispose();game.physics.dispose();game.portals.dispose();}
});

test('missing an exit, retrying, and missing a checkpoint route retain earned progress and the same friend',async()=>{
 const game=await createHeadlessGame();game.epicMode=true;game.velocityChapter=1;
 try{
  await game.selectLevel(0,true);
  const report=await runVelocityJourney(game,{renderFps:30,forgetFirstExit:true,retryCheckpoint:true,missAtCheckpoint:true});
  assert.deepEqual(report.retries.map(retry=>retry.kind),['unlinked-intake','manual','missed-route']);
  assert.equal(report.retries[0].after.segment,0);assert.equal(report.retries[0].after.chain,0);
  for(const retry of report.retries.slice(1)){assert.equal(retry.after.segment,1);assert.equal(retry.after.chain,1);}
  assert.equal(report.companionRetained,true);assert.equal(report.companionFinishedTogether,true);
  assert.equal(report.teleports,3);assert.equal(report.diagnostics.checkpoints,3);
 }finally{game.velocityCompanion?.dispose();game.physics.dispose();game.portals.dispose();}
});

test('focus changes simulation time only while playing airborne in a speed chapter',()=>{
 const g={epicMode:true,state:'playing',playerGrounded:false,externalBlocked:false,input:{keys:new Set(['KeyQ'])}};
 const scale=()=>LabGame.prototype.getVelocityTimeScale.call(g);
 assert.equal(scale(),.28);
 for(const [key,value] of [['epicMode',false],['state','paused'],['playerGrounded',true],['externalBlocked',true]]){
  const previous=g[key];g[key]=value;assert.equal(scale(),1,key);g[key]=previous;
 }
 g.input.keys.clear();assert.equal(scale(),1);
});
