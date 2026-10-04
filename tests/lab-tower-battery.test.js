import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runTowerJourney} from '../src/game/LabTowerJourney.js';

test('battery transfers the original companion between two contacts over a beam charged physical bridge',async()=>{
 const game=await createHeadlessGame();
 game.chamberEdition='foundation';
 await game.selectLevel(40,true);
 const level=game.firstLevel,companion=game.cargo,body=game.physics.cargoBody.id;
 const bridge=game.colliders.find(c=>c.mesh.name==='Battery / beam charged transfer bridge');
 const bridgeFloor=game.floors.find(f=>f.mesh===bridge?.mesh);
 try{
  assert.ok(bridge&&bridgeFloor,'The bridge needs a real floor and solid collider');
  assert.equal(bridge.enabled,false,'The bridge starts absent before the beam charges it');
  assert.equal(bridgeFloor.enabled,false);
  assert.equal(level.getTowerStageState(6).batteryBridgeOpen,false);
  const route=await runTowerJourney(game,{stopAfterDeck:2});
  assert.equal(route.partial,true);
  assert.equal(route.stagesCompleted,9);
  assert.equal(route.respawns,0);
  assert.equal(route.resets,0);
  assert.equal(route.cargoResets,0);
  assert.equal(route.stageEvents[6].id,'battery');
  const state=level.getTowerStageState(6);
  assert.deepEqual(state.signals,{cargo:true,beamA:true,batteryOutput:true,beamB:true});
  assert.equal(state.gateOpen,true);
  assert.equal(state.solved,true);
  assert.equal(state.batteryBridgeOpen,true);
  assert.equal(bridge.enabled,true);
  assert.equal(bridgeFloor.enabled,true);
  assert.equal(game.cargo,companion);
  assert.equal(game.physics.cargoBody.id,body);
  assert.equal(game.heldCube,companion);
  assert.ok(companion.position.distanceTo(game.playerPosition)<3.2);
 }finally{level.dispose?.();game.physics.dispose();game.portals.dispose();}
});
