import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runTowerJourney} from '../src/game/LabTowerJourney.js';
import {TOWER_STAGES,towerCoordinates} from '../src/game/LabTowerLayout.js';

test('The same companion crosses the broken skybridge twice and negotiates the accumulator maze',async()=>{
 const game=await createHeadlessGame();
 game.chamberEdition='foundation';
 await game.selectLevel(40,true);
 const companion=game.cargo,body=game.physics.cargoBody.id;
 try{
  // Duration enforcement remains the release verifier's independent gate;
  // this run isolates traversal, physical course evidence and companion identity.
  const report=await runTowerJourney(game,{enforceDuration:false});
  assert.equal(report.pass,true);
  assert.equal(report.stagesCompleted,18);
  assert.equal(report.respawns,0);
  assert.equal(report.resets,0);
  assert.equal(report.cargoResets,0);
  assert.equal(report.inputEvents.filter(event=>event.type==='jump'&&[10,11].includes(event.stage)).length,2,
   'The press course needs an outward and return jump with the original companion');
  const press=TOWER_STAGES.find(stage=>stage.id==='press');
  const jumps=report.inputEvents.filter(event=>event.type==='jump'&&[10,11].includes(event.stage));
  assert.deepEqual(jumps.map(event=>event.stage),[10,11],
   'One crossing leads to the reactor and the other returns from it');
  assert.ok(jumps.every(event=>{
   const {s,n}=towerCoordinates(press,event.player);
   return s>31&&s<35&&n>20&&event.player[1]>press.baseY+1;
  }), 'Both jump inputs occur from the actual raised bridge');
  assert.ok(report.stageEvents.some(event=>event.id==='confluence'),
   'The complete route reaches the reactor beyond the physical maze');
  assert.equal(game.cargo,companion);
  assert.equal(game.physics.cargoBody.id,body);
  assert.equal(game.heldCube,companion);
  assert.ok(companion.position.distanceTo(game.playerPosition)<3.2);
 }finally{game.firstLevel.dispose?.();game.physics.dispose();game.portals.dispose();}
});
