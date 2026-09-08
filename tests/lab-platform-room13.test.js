import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {jump13} from '../src/game/LabPlatformRoom13.js';

const game=await createHeadlessGame();
after(()=>{game.physics.dispose();game.portals.dispose();});

test('room 13: the authored start leaves the normal shoulder camera unobstructed',async()=>{
 await game.selectLevel(12,false);game.resetRun(true);
 for(let frame=1;frame<=60;frame++){
  game.updatePlaying(1/120);game.updatePlaying(1/120);game.updateVisuals(1/60,1);
  if(frame===30||frame===60){
   assert.equal(game.cameraRig.obstructed,false);
   assert.ok(game.cameraRig.distance>6,'The start must not compress the camera into the backpack');
  }
 }
});

test('room 13: six real carried jumps, two portal height changes and the same friend finish',async()=>{
 await game.selectLevel(12,false);
 const identity=game.physics.cargoBody.id;
 const report=await runV8Journey(game);
 assert.equal(report.pass,true);assert.equal(report.resets+report.respawns,0);
 assert.equal(report.teleports,2);assert.equal(game.state,'won');
 assert.equal(game.physics.cargoBody.id,identity);assert.equal(game.heldCube,game.cargo);
 const names=['first rising gap','turn around the lower court','lower viewing gallery',
  'north gallery gap','upper east terrace','east viewing gallery'];
 assert.deepEqual(report.milestones.filter(m=>names.includes(m.name)).map(m=>m.player[1]),[3.15,3.9,4.65,8.75,9.5,10.25]);
 assert.equal(game.firstLevel.terminals.length,0);
});

test('room 13: missing a terrace returns to the continuous court and the same stair',async()=>{
 await game.selectLevel(12,false);
 const report=await runV8Journey(game,{scenario:d=>{
  d.walk(-13,15);d.pickup();d.walk(-13,21.5);d.walk(-17,21.5);d.walk(-17,12);d.walk(-13.5,8);
  // Deliberately walk off: no jump, teleport, actor placement or reset.
  for(let n=0;n<36;n++){d.worldMove(1,0);d.frame();}
  d.stop();d.wait(1.4);assert.equal(game.playerGrounded,true);assert.equal(game.playerPosition.y,0);
  assert.equal(game.heldCube,game.cargo);
  d.walk(-12.05,13.8);d.walk(-12.05,21.7);d.walk(-17,21.7);d.walk(-17,12);d.walk(-14.3,8);
  assert.equal(game.playerPosition.y,2.4);
  jump13(d,-13.48,8,-9.8,8,3.15,'recovered first gap');
  assert.equal(game.heldCube,game.cargo);assert.equal(game.state,'playing');
 }});
 assert.equal(report.resets+report.respawns,0);assert.equal(report.teleports,0);
});

test('room 13: the ground court cannot shoot directly into the two recessed upper rooms',async()=>{
 await game.selectLevel(12,false);
 const report=await runV8Journey(game,{scenario:d=>{
  d.walk(-12,22);d.walk(17,22);d.walk(17,17);
  for(const name of ['north-gallery','roof-garden']){
   const point=d.level.panels[name].getFrame().center.clone().add(new THREE.Vector3(0,.4,0));
   assert.throws(()=>d.aim(1,point),/Portal impact rejected/);
   assert.equal(game.portalShots.lastImpact?.valid,false);
  }
  assert.equal(game.portals.portals[1],null);assert.equal(game.state,'playing');
 }});
 assert.equal(report.resets+report.respawns,0);
});

test('room 13: physical arrival wins without mechanism or portal-use flags, and requires both actors',async()=>{
 await game.selectLevel(12,false);game.resetRun(true);
 const goal=game.firstLevel.goal.position;
 // Explicit finish-condition fixtures; ordinary routes above never set poses.
 game.playerPosition.copy(goal);game.playerGrounded=true;
 assert.equal(game.firstLevel.isWon(),false);
 game.cargo.position.copy(goal).add(new THREE.Vector3(.7,.55,0));
 assert.equal(game.teleportCount,0);assert.equal(game.firstLevel.isWon(),true);
 game.playerGrounded=false;assert.equal(game.firstLevel.isWon(),false);
});
