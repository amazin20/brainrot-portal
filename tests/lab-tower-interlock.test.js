import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runTowerJourney} from '../src/game/LabTowerJourney.js';

test('the fourth hub requires portal scouting, companion transit, redirected light and a two-person balance',async()=>{
 const game=await createHeadlessGame();game.chamberEdition='foundation';
 await game.selectLevel(40,true);
 const level=game.firstLevel,companion=game.cargo,body=game.physics.cargoBody.id;
 const weightGate=game.colliders.find(c=>c.mesh.name==='Tower interlock / weight access physical interlock');
 const rearGate=game.colliders.find(c=>c.mesh.name==='Tower interlock / rear release physical interlock');
 try{
  assert.ok(weightGate&&rearGate&&weightGate.enabled&&rearGate.enabled);
  assert.equal(level.getTowerInterlockState().solved,false);
  // The observer can shoot through the slit, but an upright player intersects
  // its actual sill or lintel at every height instead of walking into the rear.
  for(let foot=24;foot<=24.2;foot+=.1){
   const bodyBox=new THREE.Box3(new THREE.Vector3(-12.39,foot,24.8),
    new THREE.Vector3(-11.61,foot+2.4,25.2));
   assert.ok(game.colliders.some(c=>c.enabled&&c.mesh.name.startsWith('Tower interlock / observation')
    &&c.box.intersectsBox(bodyBox)));
  }
  const route=await runTowerJourney(game,{stopAfterTransitionDeck:3});
  const state=level.getTowerInterlockState();
  for(const signal of ['primed','crossed','loaded','emitterOn','beam','released','balanced','solved'])
   assert.equal(state[signal],true,`The ${signal} signal needs a real input`);
  assert.equal(weightGate.enabled,false);assert.equal(rearGate.enabled,false);
  assert.equal(route.stagesCompleted,12);assert.equal(route.keystoneEvents.length,4);
  assert.equal(route.ascentEvents.length,4);
  assert.ok(route.ascentEvents[3].activeMovementSeconds-route.keystoneEvents[3].activeMovementSeconds>75,
   'The fourth-hub route must involve sustained movement between different mechanisms');
  const inputs=route.inputEvents.filter(e=>e.stage===12);
  assert.ok(inputs.filter(e=>e.type==='shoot').length>=3);
  assert.ok(inputs.filter(e=>e.type==='pickup').length>=2);
  assert.ok(inputs.filter(e=>e.type==='drop').length>=2);
  assert.ok(inputs.filter(e=>e.type==='use').length>=2);
  const sidePanel=game.portalPanels.find(p=>p.name.includes('interlock-redirect'));
  assert.ok(sidePanel&&game.portals.portals.some(p=>p?.surfaceId===sidePanel.uuid),
   'The final optical signal must use the physically redirected portal');
  assert.equal(route.respawns,0);assert.equal(route.resets,0);assert.equal(route.cargoResets,0);
  assert.equal(game.cargo,companion);assert.equal(game.physics.cargoBody.id,body);
  assert.ok(game.heldCube&&game.cargo.position.distanceTo(game.playerPosition)<3.2);
  assert.equal(game.playerGrounded,true);

  game.restartCheckpoint();
  const reset=level.getTowerInterlockState();
  for(const signal of ['primed','crossed','loaded','emitterOn','beam','released','balanced','solved'])
   assert.equal(reset[signal],false,`Restart must clear ${signal}`);
  assert.equal(weightGate.enabled,true);assert.equal(rearGate.enabled,true);
  assert.equal(level.completedStages,0);
 }finally{game.firstLevel.dispose?.();game.physics.dispose();game.portals.dispose();}
});
