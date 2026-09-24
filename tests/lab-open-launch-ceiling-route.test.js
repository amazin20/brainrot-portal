import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

test('open 30: the same far catch can turn the original pair into a lateral landing or a ceiling descent',async()=>{
 const game=await createHeadlessGame();game.chamberEdition='open';
 const arrivals=[];
 try{
  for(const route of ['airborne-double-rewire','ceiling-descent']){
   await game.selectLevel(29,false);
   const originalBody=game.physics.cargoBody;
   const panels=game.firstLevel.panels;
   const snapshots=[];
   const report=await runV8Journey(game,{
    journeyOptions:{route},
    onMilestone:m=>snapshots.push({name:m.name,teleports:m.teleports,player:m.player,cargo:m.cargo,
     velocity:game.playerVelocity.toArray(),entryId:game.portalSurfaceIds[0],exitId:game.portalSurfaceIds[1],connected:game.velocityCompanion.connected})
   });
   assert.equal(report.pass,true);assert.equal(game.state,'won');
   assert.equal(report.resets+report.respawns,0);
   assert.equal(game.physics.cargoBody,originalBody,'the original companion must survive both journeys');
   assert.equal(report.teleports,2);
   const flight=snapshots.find(s=>s.name==='far catch opens on the exterior flight');
   const approach=snapshots.find(s=>s.name==='exterior viewpoint reveals terminal addresses');
   const arrival=snapshots.find(s=>s.name==='distant screen transfers the same two travellers');
   const ending=snapshots.find(s=>s.name==='both at exit');
   assert.ok(flight&&approach&&arrival&&ending,'each solution traverses the complete flight');
   assert.equal(flight.teleports,1);assert.equal(arrival.teleports,2);
   assert.equal(approach.entryId,panels['far-catch'].mesh.uuid);
   assert.equal(arrival.entryId,panels['far-catch'].mesh.uuid);
   assert.equal(arrival.exitId,panels[route==='ceiling-descent'?'terminal-ceiling':'terminal-outlet'].mesh.uuid);
   assert.ok(arrival.connected&&ending.connected,'the same tether carries the real companion');
   assert.ok(Math.hypot(arrival.player[0]-arrival.cargo[0],arrival.player[2]-arrival.cargo[2])<2,
    'the original companion exits within tether distance');
   arrivals.push(arrival);
  }
  const [side,ceiling]=arrivals;
  assert.ok(side.velocity[0]<-20&&Math.abs(side.velocity[0])>Math.abs(side.velocity[1]),
   'the wall receiver turns the incoming flight into lateral movement');
  assert.ok(ceiling.velocity[1]<-25&&Math.abs(ceiling.velocity[1])>Math.abs(ceiling.velocity[0])*10,
   'the ceiling receiver converts that same flight into a vertical descent');
  assert.ok(side.player[2]<-15&&ceiling.player[2]>-18,
   'the pair crosses different receiving volumes before reaching the same goal');
 }finally{game.firstLevel.dispose?.();game.physics.dispose();game.portals.dispose();}
});
