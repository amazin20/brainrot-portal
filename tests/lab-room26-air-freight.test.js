import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

test('room26 delivers its original companion independently on the transverse current before the player follows',async()=>{
 const game=await createHeadlessGame();
 try{
  await game.selectLevel(25,false);
  const companion=game.cargo,body=game.physics.cargoBody;
  const report=await runV8Journey(game,{journeyOptions:{route:'air-freight'},onMilestone:mark=>{
   if(mark.name==='upper air current transports the free companion ahead of the player'){
    assert.ok(mark.cargo[2]>20&&mark.cargo[1]>19,'The companion is on the high physical collector');
    assert.ok(mark.cargo[2]>mark.player[2]+1,'The free companion arrived first while the player is still in the air current');
    assert.ok(!game.heldCube);assert.ok(game.physics.grounded);
   }
  }});
  assert.equal(report.pass,true);assert.equal(game.state,'won');
  assert.equal(report.resets+report.respawns,0);
  assert.equal(game.cargo,companion);assert.equal(game.physics.cargoBody,body);
  assert.ok(report.milestones.some(m=>m.name==='player follows and collects the original companion from the elevated air collector'));
 }finally{game.physics.dispose();game.portals.dispose();}
});
