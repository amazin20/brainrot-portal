import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';

test('updraft entry leaves a full camera boom behind the player, clear of the fan and rear wall',async()=>{
 const game=await createHeadlessGame();
 try{
  await game.selectLevel(7,false);game.resetRun(true);
  assert.ok(game.cameraRig.distance>6.4,'Camera is cramped at spawn');
  for(let n=0;n<60;n++){
   game.updatePlaying(1/120);game.updatePlaying(1/120);game.updateVisuals(1/60,1);
   assert.ok(game.cameraRig.distance>6.4,'Idle camera is retracted by scenery');
   assert.equal(game.heldCube,null);
  }
  assert.equal(game.firstLevel.state.enabled,false);
  assert.equal(game.firstLevel.index,7);
 }finally{game.physics.dispose();game.portals.dispose();}
});
