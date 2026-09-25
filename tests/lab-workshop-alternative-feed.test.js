import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

const game=await createHeadlessGame();
game.chamberEdition='classic';
after(()=>{game.physics.dispose();game.portals.dispose();});

for(const [edition,aspect] of [['classic',9/16],['foundation',1.6],['classic',16/9]])test(`empty bridge and overhead cargo delivery complete ${edition} room 10 at aspect ${aspect}`,async()=>{
 game.chamberEdition=edition;game.camera.aspect=aspect;game.camera.updateProjectionMatrix();
 await game.selectLevel(9,false);
 const cargo=game.cargo,body=game.physics.cargoBody,events=[];
 const report=await runV8Journey(game,{
  journeyOptions:{route:'cargo-chute'},
  onMilestone:milestone=>events.push({
   name:milestone.name,
   bridge:game.firstLevel.state.freight.progress,
   lock:game.firstLevel.state['dock-lock'].engaged,
   cargoY:game.cargo.position.y,
   cargoPasses:game.physics.portalTransports,
  }),
 });
 assert.equal(report.pass,true);
 assert.equal(game.state,'won');
 assert.equal(report.respawns+report.resets,0);
 assert.equal(game.cargo,cargo);
 assert.equal(game.physics.cargoBody,body);
 assert.ok(events[0].bridge>.98);
 assert.equal(events[0].lock,false,'empty bridge did not unlock the hood');
 assert.ok(events[1].cargoPasses>events[0].cargoPasses,'the companion used the physical portal');
 assert.equal(events[1].lock,true,'receiver loaded only after cargo delivery');
 assert.ok(events[1].cargoY<3,'cargo reached the receiving floor below the hatch');
});
