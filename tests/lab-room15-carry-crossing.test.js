import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

test('room15 carries the original companion through the transverse field instead of retrieving it with a final portal pair',async()=>{
 const game=await createHeadlessGame();
 try{
  await game.selectLevel(14,false);
  const companion=game.cargo,body=game.physics.cargoBody;
  const report=await runV8Journey(game,{journeyOptions:{order:'carry-crossing'}});
  assert.equal(game.state,'won');assert.equal(report.pass,true);
  assert.equal(report.resets+report.respawns,0);
  assert.equal(game.cargo,companion);assert.equal(game.physics.cargoBody,body);
  assert.ok(game.heldCube,'The companion reaches the goal in the player’s arms');
  assert.equal(report.teleports,1,'The freight extraction is the only portal transport; no final cargo retrieval is used');
  assert.ok(report.milestones.some(m=>m.name==='both travellers enter the transverse field together'));
  assert.ok(!report.milestones.some(m=>m.name==='field released over the receiver'));
 }finally{game.physics.dispose();game.portals.dispose();}
});
