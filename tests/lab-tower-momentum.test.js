import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runTowerJourney} from '../src/game/LabTowerJourney.js';
import {TOWER_STAGES} from '../src/game/LabTowerLayout.js';

test('The first-deck shaft uses a real fall to land the same two travellers on its raised shelf',async()=>{
 const game=await createHeadlessGame();game.chamberEdition='foundation';
 await game.selectLevel(40,true);
 const originalCargo=game.cargo,bodyId=game.physics.cargoBody.id;
 try{
  const route=await runTowerJourney(game,{branchOrder:[2,0,1],stopAfterStage:'exchange'});
  assert.equal(route.partial,true);
  assert.deepEqual(route.stageEvents.map(event=>event.id),['exchange']);
  assert.equal(route.flings.length,1);
  assert.equal(route.flings[0].stageId,'exchange');
  assert.ok(route.flings[0].speed>11.5);
  assert.ok(route.flings[0].landing[1]>2&&route.flings[0].landing[1]<2.1);
  assert.equal(route.teleports,1);
  assert.equal(route.resets,0);assert.equal(route.respawns,0);
  assert.equal(game.cargo,originalCargo);assert.equal(game.physics.cargoBody.id,bodyId);
  assert.equal(game.firstLevel.getTowerStageState(TOWER_STAGES[2].index).solved,true);
  assert.equal(game.firstLevel.getTowerMetrics().checkpoints,false);
  game.restartCheckpoint();
  assert.equal(game.firstLevel.getTowerStageState(TOWER_STAGES[2].index).solved,false);
  assert.equal(game.firstLevel.getTowerStageState(TOWER_STAGES[2].index).signals.kinetic,undefined);
 }finally{game.firstLevel.dispose?.();game.physics.dispose();game.portals.dispose();}
});
