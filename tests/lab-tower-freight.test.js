import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runTowerJourney} from '../src/game/LabTowerJourney.js';

test('A powered side hoist delivers the original rigid companion to an upper receiving deck',async()=>{
 const game=await createHeadlessGame();game.chamberEdition='foundation';await game.selectLevel(40,true);
 const level=game.firstLevel,stage=level.towerStages[1],body=game.physics.cargoBody,
  originalId=body.id,warehouse=level.getTowerFreightState();
 try{
  game.playerPosition.fromArray(stage.cargoPad);
  game.cargo.position.copy(game.playerPosition).add(new THREE.Vector3(0,.7,0));
  level.update(1/120);
  game.playerPosition.fromArray(stage.control);
  assert.equal(game.interact(),true);
  assert.equal(level.getTowerStageState(1).signals.control,true);
  assert.equal(level.getTowerStageState(1).gateOpen,false);
  game.playerPosition.fromArray([warehouse.sender[0],0,warehouse.sender[2]-2]);
  game.previousPlayerPosition.copy(game.playerPosition);
  game.physics.resetCargo({position:new THREE.Vector3(
   warehouse.sender[0],.57,warehouse.sender[2])});
  let lifted=false,delivered=false;
  for(let tick=0;tick<960;tick++){
   game.updatePlaying(1/120);
   if(game.cargo.position.y>3.8)lifted=true;
   if(level.getTowerStageState(1).signals.delivery){delivered=true;break;}
  }
  assert.equal(game.state,'playing');
  assert.equal(body.id,originalId,'No replacement load may stand in for the companion');
  assert.equal(lifted,true,'The physical body must rise through the open shaft');
  assert.equal(delivered,true,'The body must settle on the upper plate under production physics');
  assert.equal(level.getTowerStageState(1).gateOpen,false,'Delivery alone cannot skip retrieval');
  assert.ok(game.floors.some(f=>f.y===4&&f.minX<warehouse.receiver[0]
   &&f.maxX>warehouse.receiver[0]&&f.minZ<warehouse.receiver[2]&&f.maxZ>warehouse.receiver[2]),
   'The receiver stands on a solid upper deck');
 }finally{game.firstLevel.dispose();game.physics.dispose();game.portals.dispose();}
});

test('The second warehouse route carries the same companion up a stair without arming the hoist',async()=>{
 const game=await createHeadlessGame();game.chamberEdition='foundation';await game.selectLevel(40,true);
 const level=game.firstLevel,original=game.cargo,body=game.physics.cargoBody.id;
 try{
  const route=await runTowerJourney(game,{branchOrder:[1,0,2],
   freightRoute:'carry',stopAfterDeck:0});
  assert.equal(route.partial,true);
  assert.equal(route.stageEvents[0].id,'freight');
  const freightEnd=route.milestones.find(m=>m.name.startsWith('Solved ПРОТИВОВЕСНЫЙ'));
  assert.ok(freightEnd?.activeMovementSeconds>=30,
   'The alternative should be an active, substantial physical traversal');
  assert.deepEqual(level.getTowerStageState(1).signals,
   {cargo:true,control:true,delivery:true,recovered:true});
  assert.equal(level.getTowerFreightState().armed,false,
   'The carry route must remain independent of the lower hoist');
  assert.equal(game.cargo,original);assert.equal(game.physics.cargoBody.id,body);
  assert.equal(route.resets,0);assert.equal(route.cargoResets,0);
 }finally{game.firstLevel.dispose();game.physics.dispose();game.portals.dispose();}
});
