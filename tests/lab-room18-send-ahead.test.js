import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

test('room18 sends the original companion through the final portal before the player follows',async()=>{
 const game=await createHeadlessGame();
 try{
  await game.selectLevel(17,false);
  const companion=game.cargo,body=game.physics.cargoBody;
  const report=await runV8Journey(game,{journeyOptions:{order:'send-ahead'},onMilestone:mark=>{
   if(mark.name==='original companion reaches the hidden exit ahead of the player'){
    assert.ok(mark.cargo[1]>7&&mark.cargo[2]>19,'The companion reached actual hidden receiving geometry');
    assert.ok(mark.player[1]>10.9&&mark.player[2]<0,'The player is still on the separate sending gallery');
    assert.ok(!game.heldCube);
   }
  }});
  assert.equal(report.pass,true);assert.equal(game.state,'won');
  assert.equal(report.resets+report.respawns,0);
  assert.equal(game.cargo,companion);assert.equal(game.physics.cargoBody,body);
  assert.ok(game.physics.portalTransports>=2,'The companion used both the initial freight and final return portals');
  assert.ok(report.milestones.some(m=>m.name==='original companion reaches the hidden exit ahead of the player'));
 }finally{game.physics.dispose();game.portals.dispose();}
});
