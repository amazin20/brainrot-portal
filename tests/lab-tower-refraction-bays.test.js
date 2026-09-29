import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runTowerJourney} from '../src/game/LabTowerJourney.js';

test('Refraction redirects a live ray from two physically separated bays with the original companion',
 {timeout:240000},async()=>{
  const game=await createHeadlessGame();game.chamberEdition='foundation';
  await game.selectLevel(40,true);
  const level=game.firstLevel,companion=game.cargo,body=game.physics.cargoBody.id;
  const pane=game.colliders.find(c=>c.mesh.name==='Refraction / retractable ray window');
  let beforeActive=null,afterActive=null;
  try{
   assert.ok(pane?.enabled&&pane.opticallyTransparent,
    'The real partition blocks the player while transmitting only the first optical beam');
   assert.equal(level.getTowerStageState(11).gateOpen,false);
   const route=await runTowerJourney(game,{stopAfterDeck:3,onMilestone:milestone=>{
    if(milestone.name.startsWith('Solved ПРЕСС'))beforeActive=level.getTowerMetrics().activeSeconds;
    if(milestone.name.startsWith('Solved ПЕРЕСТРОЙКА'))afterActive=level.getTowerMetrics().activeSeconds;
   }});
   assert.equal(route.partial,true);assert.equal(route.stagesCompleted,12);
   assert.equal(route.keystoneEvents.length,4);
   const state=level.getTowerStageState(11);
   assert.deepEqual(Object.keys(state.signals),['mirror','beamA','chamberTurn','beamB']);
   assert.equal(state.gateOpen,true);assert.equal(state.solved,true);
   assert.ok(route.inputEvents.filter(e=>e.type==='shoot'&&e.stage===11).length>=3,
    'Both optical outputs require separate real portal shots from the two chambers');
   assert.equal(pane.enabled,false,'The confirmed second receiver opens the physical return');
   assert.ok(afterActive-beforeActive>30,'The two-bay route must take substantial active player input');
   assert.equal(route.resets,0);assert.equal(route.respawns,0);assert.equal(route.cargoResets,0);
   assert.equal(game.cargo,companion);assert.equal(game.physics.cargoBody.id,body);
   level.reset();assert.equal(pane.enabled,true);
   assert.equal(level.getTowerStageState(11).signals.chamberTurn,undefined);
  }finally{level.dispose?.();game.physics.dispose();game.portals.dispose();}
 });
