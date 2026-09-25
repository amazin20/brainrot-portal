import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

for(const aspect of [16/9,9/16])test(`room 4 sends the companion before the player at aspect ${aspect}`,async()=>{
 const game=await createHeadlessGame();game.chamberEdition='foundation';
 try{
  await game.selectLevel(3,false);game.camera.aspect=aspect;game.camera.updateProjectionMatrix();
  const original=game.cargo,body=game.physics.cargoBody,order=[];
  const report=await runV8Journey(game,{journeyOptions:{alternate:true},onMilestone:mark=>{
   if(mark.name.includes('before the player')){
    assert.equal(game.teleportCount,0,'The companion must reach the shelf first');
    assert.ok(game.physics.portalTransports>0,'The companion must cross the real portal');
    assert.ok(game.physics.grounded&&game.cargo.position.y>15.2,'The shelf must physically catch the companion');
    order.push('companion');
   }else if(mark.name.includes('after a separate momentum flight')){
    assert.ok(game.teleportCount>0,'The player must make a separate traversal');
    order.push('player');
   }
  }});
  assert.deepEqual(order,['companion','player']);
  assert.ok(report.pass&&game.state==='won');
  assert.equal(report.respawns+report.resets,0);
  assert.equal(game.cargo,original);assert.equal(game.physics.cargoBody,body);
 }finally{game.physics?.dispose();game.portals?.dispose();}
});

test('room 4 returns from a missed attempt and still finishes',async()=>{
 const game=await createHeadlessGame();game.chamberEdition='foundation';
 try{
  await game.selectLevel(3,false);
  const report=await runV8Journey(game,{journeyOptions:{recover:true}});
  assert.ok(report.pass&&game.state==='won');
  assert.equal(report.respawns+report.resets,0);
  assert.ok(report.milestones.some(mark=>mark.name.includes('service floor')));
 }finally{game.physics?.dispose();game.portals?.dispose();}
});
