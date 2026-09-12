import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runRoom18,room18Freight} from '../src/game/LabRoom18Journey.js';
const game=await createHeadlessGame();
after(()=>{game.physics.dispose();game.portals.dispose();});

test('room18 completes the shared-well delivery, turning flight and original-cargo return with public input',async()=>{
 await game.selectLevel(17,false);
 const cargo=game.cargo.group.uuid,body=game.physics.cargoBody.id;
 const report=await runV8Journey(game,{scenario:d=>runRoom18(d)});
 assert.equal(game.state,'won');assert.equal(report.resets+report.respawns,0);
 assert.equal(game.cargo.group.uuid,cargo);assert.equal(game.physics.cargoBody.id,body);
 assert.ok(game.teleportCount>=3);assert.ok(game.heldCube);
 assert.deepEqual(report.milestones.map(m=>m.name),['freight crosses the low throat','same well from the upper return','spent portal turns the ascent','return flight behind the entrance']);
 assert.ok(report.milestones[1].player[1]>19.9);
 assert.ok(report.milestones[2].cargo[1]>11&&report.milestones[2].cargo[2]<-1);
});

test('the loading floor and foundation cannot shoot directly into the hidden exit',async()=>{
 await game.selectLevel(17,false);
 const report=await runV8Journey(game,{scenario:d=>{
  d.walk(4,16.5);assert.throws(()=>d.aim(0,d.level.panels.home.getFrame().center),/Portal impact rejected/);
  assert.equal(game.portalShots.lastImpact.valid,false);
  d.walk(6,14);d.until(()=>game.playerGrounded,3,'Reach safe foundation');d.walk(1,25);
  assert.throws(()=>d.aim(0,d.level.panels.home.getFrame().center),/Portal impact rejected/);
  assert.equal(game.portalShots.lastImpact.valid,false);assert.equal(game.state,'playing');
 }});
 assert.equal(report.resets+report.respawns,0);assert.equal(game.teleportCount,0);
});

test('a player trying the cargo-only throat is blocked physically and can return without resetting',async()=>{
 await game.selectLevel(17,false);
 const report=await runV8Journey(game,{scenario:d=>{
  room18Freight(d);d.walk(1.5,9.15);const before=game.teleportCount;
  for(let n=0;n<300&&game.teleportCount===before;n++){d.worldMove(0,-.15);d.frame();}d.stop();
  assert.ok(game.teleportCount>before);d.until(()=>game.playerGrounded,4,'Cargo throat catches the standing traveller');
  for(let n=0;n<180;n++){d.worldMove(0,1);d.frame();}d.stop();
  assert.ok(game.playerPosition.z<-10.6,'The whole standing capsule must stay before the physical throat');
  assert.equal(game.state,'playing');assert.ok(game.cargo.position.z>-8,'The original cargo already crossed');
  d.enter(d.level.panels.freight);
  for(let n=0;n<150;n++){d.worldMove(1,0);d.frame();}d.stop();
  d.until(()=>game.playerGrounded&&game.playerPosition.y<.1,4,'Return to the foundation');
  d.walk(6,8);d.walk(1,21);d.walk(1,28);d.walk(-19.5,28);d.walk(-19.5,16.5);
  assert.ok(Math.abs(game.playerPosition.y-8)<.1,'Physical stair restores the loading floor');
 }});
 assert.equal(report.resets+report.respawns,0);assert.ok(game.teleportCount>=2);
});

// One additional human-scale timing sample; not a claim about every possible shot.
test('the turning shot tolerates 12 extra aim frames with the real weapon windup and charge flight',async()=>{
 await game.selectLevel(17,false);let fired=0;const fire=game.firePortal;
 game.firePortal=function(index){const accepted=fire.call(this,index);if(accepted&&!this.playerGrounded&&index===0){assert.ok(this.portalShots.queue.at(-1)?.delay>=.23);fired++;}return accepted;};
 try{const report=await runV8Journey(game,{scenario:d=>runRoom18(d,{aimDelayFrames:12})});assert.equal(game.state,'won');assert.equal(report.resets+report.respawns,0);assert.ok(fired>=1);}finally{game.firePortal=fire;}
});
