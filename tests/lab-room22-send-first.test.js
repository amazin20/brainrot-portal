import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

test('room22 sends its original companion through the high pair before the observer follows',async()=>{
 const game=await createHeadlessGame();
 try{
  await game.selectLevel(21,false);
  const companion=game.cargo,body=game.physics.cargoBody;
  const report=await runV8Journey(game,{journeyOptions:{order:'send-freight-first'},onMilestone:mark=>{
   if(mark.name==='the original companion enters the high receiver while the player remains on the east gallery'){
    assert.ok(mark.cargo[1]>13.5&&mark.cargo[0]<-4);
    assert.ok(mark.player[1]<9&&mark.player[0]>15);
    assert.equal(game.heldCube,null);
   }
  }});
  assert.equal(report.pass,true);assert.equal(game.state,'won');
  assert.equal(report.resets+report.respawns,0);
  assert.equal(game.cargo,companion);assert.equal(game.physics.cargoBody,body);
  assert.ok(game.physics.portalTransports>=2,'The companion used both the load recovery and the high return aperture');
 }finally{game.physics.dispose();game.portals.dispose();}
});
