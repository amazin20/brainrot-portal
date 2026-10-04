import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runTowerJourney} from '../src/game/LabTowerJourney.js';

test('Windway requires a portal-fed airborne jump and far-side landing before its physical gate opens',
 {timeout:120000},async()=>{
  const game=await createHeadlessGame();
  game.chamberEdition='foundation';
  await game.selectLevel(40,true);
  const level=game.firstLevel,original=game.cargo,body=game.physics.cargoBody.id;
  const spillway=game.colliders.find(c=>c.mesh.name==='Windway / solid crosswind spillway');
  const returnInterlock=game.colliders.find(c=>c.mesh.name==='Windway / landing interlock');
  try{
   assert.ok(spillway?.enabled,'The pre-gate barrier physically closes the main aisle');
   assert.ok(returnInterlock?.enabled,'The ground return cannot bypass the flight before landing');
   assert.equal(level.getTowerStageState(7).signals.airLanding,undefined);
   assert.equal(level.getTowerStageState(7).gateOpen,false);
   const route=await runTowerJourney(game,{stopAfterDeck:2});
   assert.equal(route.partial,true);
   assert.equal(route.stagesCompleted,9);
   assert.ok(route.inputEvents.some(e=>e.type==='jump'&&e.stage===7),
    'The wing is crossed by an ordinary jump input');
   assert.ok(route.teleports>=2,'Windway includes a real player transit after the light and air route');
   assert.equal(level.getTowerStageState(7).signals.airLanding,true);
   assert.equal(level.getTowerStageState(7).solved,true);
   assert.equal(spillway.enabled,true,'The permanent obstacle remains solid after landing');
   assert.equal(returnInterlock.enabled,false,'Landing opens the physical return shutter');
   assert.equal(route.resets,0);assert.equal(route.respawns,0);assert.equal(route.cargoResets,0);
   assert.equal(game.cargo,original);assert.equal(game.physics.cargoBody.id,body);
   level.reset();
   assert.equal(level.getTowerStageState(7).signals.airLanding,undefined);
   assert.equal(returnInterlock.enabled,true,'Restart seals the return throat');
  }finally{
   level.dispose?.();game.physics.dispose();game.portals.dispose();
  }
 });
