import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runCreative34} from '../src/game/LabCreativeCounterweightJourney.js';

function samePosition(actual,expected,label){
 for(const key of ['x','y','z'])assert.ok(Math.abs(actual[key]-expected[key])<1e-9,`${label}: ${key}`);
}

test('34: restarting after a real pneumatic discharge restores the pressure machine and original cargo',async()=>{
 const game=await createHeadlessGame();
 try{
  game.chamberEdition='foundation';
  await game.selectLevel(33,false);
  const level=game.firstLevel,s=level.pressureState,physics=game.physics;
  const control=level.state['pneumatic-distributorControl'],cargo=game.cargo,cargoBody=physics.cargoBody;
  const doorBody=s.doorBody,doorPosition=doorBody.position.clone(),doorBox=level.doorCollider.box.clone();
  const seats=level.seat.map(part=>({part,position:part.mesh.position.clone(),box:part.collider.box.clone(),
   body:physics.solids.get(part.collider.mesh.uuid).body,
   physicalPosition:physics.solids.get(part.collider.mesh.uuid).body.position.clone()}));
  const spawn=Array.isArray(level.cargoSpawn)?{x:level.cargoSpawn[0],y:level.cargoSpawn[1],z:level.cargoSpawn[2]}:level.cargoSpawn;
  assert.ok(control&&doorBody.mass>0,'The authored distributor must drive a real dynamic door');

  const preparation=await runV8Journey(game,{scenario:d=>{
   runCreative34(d,{stopBeforeDelivery:true});
   assert.ok(s.coverage>.8&&s.pressure>95,'The original free cargo must seal the leak and charge the reservoir');
   assert.equal(s.mode,0);assert.ok(s.doorTravel<.1);assert.equal(game.heldCube,null);
   const chargedPressure=s.pressure;
   assert.equal(game.interact(),true,'The observer must operate the actual nearby distributor');
   assert.equal(s.mode,1);
   d.until(()=>s.doorTravel>5.8&&game.cargo.position.z< -15.5,8,'Physical pressure discharge did not move both the door and original cargo');
   assert.ok(s.pressure<chargedPressure,'Discharge must consume the stored pressure');
   assert.ok(doorBody.position.x>5.8&&level.doorCollider.box.min.x>doorBox.min.x+5.8);
   assert.ok(s.seatTravel>2.1&&s.coverage<.1,'The distributor must raise the real vent seat and release its cargo');
   for(const seat of seats){
    assert.ok(seat.part.mesh.position.y>seat.position.y+2.1);
    assert.ok(seat.body.position.y>seat.physicalPosition.y+2.1,'The visible raised seat must also move its physical body');
   }
   assert.equal(physics.cargoBody,cargoBody);assert.equal(game.cargo,cargo);
  }});
  assert.equal(preparation.pass,true);assert.equal(preparation.resets+preparation.respawns,0);

  // Inspect this restart immediately, before the full journey's fresh-run setup.
  game.resetRun(true);
  assert.equal(game.firstLevel,level);assert.equal(level.pressureState,s);
  assert.equal(level.state['pneumatic-distributorControl'],control,'Returned control references must remain live after restart');
  assert.equal(s.doorBody,doorBody);assert.equal(physics.cargoBody,cargoBody);assert.equal(game.cargo,cargo);
  assert.equal(game.state,'playing');assert.equal(game.heldCube,null);assert.equal(game.portals.ready,false);
  assert.equal(s.mode,0);assert.equal(s.pressure,0);assert.equal(s.coverage,0);
  assert.equal(s.seatTravel,0);assert.equal(s.doorTravel,0);
  samePosition(doorBody.position,doorPosition,'Door must return to its original physical guide position');
  assert.equal(doorBody.velocity.lengthSquared(),0);assert.equal(doorBody.force.lengthSquared(),0);
  assert.ok(level.doorCollider.box.equals(doorBox),'The player collision door must close with the rigid door');
  for(const seat of seats){
   samePosition(seat.part.mesh.position,seat.position,'Visible vent seat must return');
   samePosition(seat.body.position,seat.physicalPosition,'Physical vent seat must return');
   assert.equal(seat.body.velocity.lengthSquared(),0);
   assert.ok(seat.part.collider.box.equals(seat.box));
   assert.equal(physics.solids.get(seat.part.collider.mesh.uuid).remaining,0,'No pending discharge motion may survive restart');
  }
  samePosition(cargoBody.position,spawn,'Original cargo must return to its authored spawn');
  samePosition(game.cargo.position,spawn,'Game and rigid cargo poses must agree');
  assert.equal(cargoBody.velocity.lengthSquared(),0);assert.equal(cargoBody.angularVelocity.lengthSquared(),0);
  assert.deepEqual(cargoBody.quaternion.toArray(),[0,0,0,1]);
  const transports=physics.portalTransports;
  const report=await runV8Journey(game);
  assert.equal(report.pass,true,'The restarted puzzle must still be solvable');
  assert.equal(report.resets+report.respawns,0);assert.equal(game.state,'won');
  assert.equal(level.pressureState,s);assert.equal(s.doorBody,doorBody);
  assert.equal(physics.cargoBody,cargoBody);assert.equal(game.cargo,cargo);
  assert.ok(physics.portalTransports>transports,'The restored machine must carry the original cargo through a new complete cycle');
 }finally{game.firstLevel?.dispose?.();game.physics.dispose();game.portals.dispose();}
});
