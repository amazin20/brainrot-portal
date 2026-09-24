import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

test('23: west coupling raises the player and original companion together before the return car is freed',async()=>{
 const game=await createHeadlessGame();await game.selectLevel(22,false);
 const originalBody=game.physics.cargoBody,snapshots=[];
 try{
  const report=await runV8Journey(game,{
   journeyOptions:{order:'coupled-west-first'},
   onMilestone:m=>snapshots.push({name:m.name,player:m.player,cargo:m.cargo,coupling:game.firstLevel.balance.coupling,portals:game.portals.portals.filter(Boolean).length})
  });
  assert.equal(game.state,'won');assert.equal(report.resets+report.respawns,0);
  assert.equal(game.physics.cargoBody,originalBody);
  const start=snapshots.find(m=>m.name==='west coupling carries original companion and player on the same first carriage');
  const braked=snapshots.find(m=>m.name==='permanent gallery preserves first ascent and brake clamps both cars');
  const stored=snapshots.find(m=>m.name==='original load rests outside either moving car');
  const upper=snapshots.find(m=>m.name==='upper apron joins the returning gallery');
  assert.ok(start&&braked&&stored&&upper);
  assert.equal(start.coupling,'west');assert.equal(start.portals,0,'The first journey uses the loaded car, not a cargo portal');
  assert.ok(start.player[1]<1&&start.cargo[1]<1&&braked.player[1]>9.9&&braked.cargo[1]>10);
  assert.ok(stored.cargo[1]>10&&stored.cargo[1]<11&&upper.player[1]>19.9);
  assert.ok(!snapshots.some(m=>m.name==='original freight loads the opposite coupled carriage'));
 }finally{game.firstLevel.dispose?.();game.physics.dispose();game.portals.dispose();}
});
