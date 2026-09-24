import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

for(const [edition,aspect] of [['classic',16/9],['foundation',1.6],['foundation',9/16]]){
 test(`room18 ${edition}: freight opens a sight shutter for a direct pre-addressed flight at ${aspect}`,async()=>{
  const game=await createHeadlessGame();
  try{
   game.chamberEdition=edition;await game.selectLevel(17,false);game.camera.aspect=aspect;game.camera.updateProjectionMatrix();
   const cargo=game.cargo,body=game.physics.cargoBody,marks=[];
   const report=await runV8Journey(game,{journeyOptions:{order:'direct-turn'},onMilestone:(mark,g)=>marks.push({name:mark.name,player:g.playerPosition.clone(),cargo:g.cargo.position.clone(),teleports:g.teleportCount,loaded:g.firstLevel.state.sightShutter.loaded,progress:g.firstLevel.state.sightShutter.progress,held:!!g.heldCube})});
   assert.equal(report.pass,true);assert.equal(game.state,'won');assert.equal(report.resets+report.respawns,0);
   assert.equal(game.cargo,cargo);assert.equal(game.physics.cargoBody,body);
   assert.ok(game.physics.portalTransports>=2,'The original free companion must travel through the low channel and return route');
   assert.equal(report.teleports,2,'Direct flight needs one fewer player portal crossing than the rebound route');
   const sight=marks.find(m=>m.name==='freight holds the sight shutter open while the turn is addressed from the upper lip');
   assert.ok(sight&&sight.loaded&&sight.progress>.95&&sight.teleports===0);
   assert.ok(sight.player.y>19.9&&sight.cargo.y>10.9&&!sight.held);
   const flight=marks.find(m=>m.name==='pre-addressed single flight reaches the transverse gallery without a rebound shot');
   assert.ok(flight&&flight.teleports===1&&flight.player.y>10.9&&flight.player.y<11.1);
  }finally{game.physics.dispose();game.portals.dispose();}
 });
}

test('room18 turn is hidden from the upper approach until the original freight loads its shelf',async()=>{
 const game=await createHeadlessGame();
 try{
  await game.selectLevel(17,false);
  const report=await runV8Journey(game,{scenario:d=>{
   const {walk,until,level}=d;
   walk(6,14);until(()=>game.playerGrounded,3,'Foundation landing');walk(6,8);walk(1,21);walk(1,28);walk(-19.5,28);walk(-19.5,16.5);
   walk(20,16.5);walk(20,-17.5);walk(-1.5,-17.5);walk(-1.5,-14);walk(-1.5,6);
   assert.equal(level.state.sightShutter.loaded,false);
   assert.throws(()=>d.aim(1,level.panels.turn.getFrame().center),/Portal impact rejected/);
   assert.equal(game.portalShots.lastImpact.valid,false);
   assert.ok(Math.abs(game.portalShots.lastImpact.position[2]-4.2)<.3,'The closed physical shutter must block this exact line of sight');
   walk(-1.5,-8);
   assert.throws(()=>d.aim(1,level.panels.turn.getFrame().center),/Portal impact rejected/);
   assert.equal(game.portalShots.lastImpact.valid,false);
   assert.ok(game.portalShots.lastImpact.position[2]<-3,'The upper freight duct must screen the turn from the north corridor');
   assert.equal(game.state,'playing');
  }});
  assert.equal(report.resets+report.respawns,0);assert.equal(report.teleports,0);
 }finally{game.physics.dispose();game.portals.dispose();}
});

test('room18 original rebound and send-ahead return still complete in portrait view',async()=>{
 const game=await createHeadlessGame();
 try{
  game.chamberEdition='foundation';await game.selectLevel(17,false);game.camera.aspect=9/16;game.camera.updateProjectionMatrix();
  for(const order of ['portal-first','send-ahead']){
   const cargo=game.cargo,body=game.physics.cargoBody;
   const report=await runV8Journey(game,{journeyOptions:{order}});
   assert.equal(report.pass,true);assert.equal(game.state,'won');assert.equal(report.resets+report.respawns,0);
   assert.equal(game.cargo,cargo);assert.equal(game.physics.cargoBody,body);
   assert.equal(report.teleports,3);
  }
 }finally{game.physics.dispose();game.portals.dispose();}
});
