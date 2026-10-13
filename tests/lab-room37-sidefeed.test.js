import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {ACTIVE_FOUNDATION_RUNTIME_FLAGS} from '../src/game/ReleaseIdentity.js';

for(const jumpFrames of [0,16,25,35])test(`37: final duct rejects manual third-coil loading after ${jumpFrames} jump frames`,async()=>{
 const game=await createHeadlessGame();game.chamberEdition='foundation';Object.assign(game,ACTIVE_FOUNDATION_RUNTIME_FLAGS);
 try{
  await game.selectLevel(36,false);
  const report=await runV8Journey(game,{scenario:d=>{
   const level=game.firstLevel;
   d.walk(game.cargo.position.x+1.1,game.cargo.position.z);d.pickup();
   d.walk(16,10);d.walk(16,-3);
   for(let n=0;n<90;n++){d.worldMove(0,-1);d.frame();}
   d.stop();d.wait(.4);
   if(jumpFrames){
    game.input.jumpQueued=true;
    for(let n=0;n<jumpFrames;n++){d.worldMove(0,-1);d.frame();}
    d.stop();
   }
   assert.equal(game.interact(),true);assert.equal(game.heldCube,null);
   d.wait(1);d.walk(16,1);d.walk(8,.2);
   assert.equal(game.interact(),true);assert.equal(level.getMagnet(),2);
   let enteredReceiver=false,doorOpened=false;
   for(let n=0;n<900;n++){
    d.frame();enteredReceiver ||= level.receiver.loaded();doorOpened ||= level.door.progress>.01;
   }
   assert.equal(enteredReceiver,false,'Manual loading must not skip the two bends and their first two coils');
   assert.equal(doorOpened,false,'The remote cargo socket must leave the real exit door closed');
   assert.equal(game.state,'playing');assert.equal(game.teleportCount,0);assert.equal(game.physics.portalTransports,0);
   assert.equal(game.heldCube,null);
  }});
  assert.equal(report.respawns+report.resets,0);
 }finally{game.firstLevel?.dispose?.();game.physics?.dispose();game.portals?.dispose();}
});
