import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

async function verify(levelIndex,order,check){
 const game=await createHeadlessGame();
 await game.selectLevel(levelIndex,false);
 const body=game.physics.cargoBody;
 try{
  const report=await runV8Journey(game,{journeyOptions:{order}});
  assert.equal(game.state,'won');
  assert.equal(report.respawns+report.resets,0);
  assert.equal(game.physics.cargoBody,body,'The original companion completes the route');
  check(report,game);
 }finally{
  game.firstLevel.dispose?.();game.physics.dispose();game.portals.dispose();
 }
}

test('12: freight travels directly from the original entry while the player takes a different shaft',async()=>{
 await verify(11,'remote-freight',(report,game)=>{
  const names=report.milestones.map(m=>m.name);
  const entry=report.milestones.find(m=>m.name==='folded underpass');
  const delivered=report.milestones.find(m=>m.name==='companion delivered directly from the entrance to the receiving dock');
  assert.ok(entry&&delivered&&entry.cargo[1]<1&&delivered.cargo[1]>8.9);
  assert.ok(names.indexOf(delivered.name)<names.indexOf('crossing flight'));
  assert.ok(!names.includes('shared shaft delivery'),'This route must not silently run the canonical freight path');
  assert.ok(game.physics.portalTransports>0);
 });
});

test('13: companion and player ride the unweighted north lift before the companion loads the mirror',async()=>{
 await verify(12,'north-with-companion',(report,game)=>{
  const names=report.milestones.map(m=>m.name);
  const north=report.milestones.find(m=>m.name==='Both travellers reach north observation without loading the mirror');
  const mirror=report.milestones.find(m=>m.name==='North address dispatches the original companion onto the live mirror');
  assert.ok(north&&mirror&&north.cargo[1]>11.9&&mirror.cargo[1]<8);
  assert.ok(names.indexOf(north.name)<names.indexOf(mirror.name));
  assert.ok(!names.includes('live weight turns the mirror'),'The north route must avoid the canonical southern-first solution');
  assert.ok(game.physics.portalTransports>0);
 });
});

test('14: player crosses the first light bridge alone, then retrieves the friend through the remote entry portal',async()=>{
 await verify(13,'remote-companion',(report,game)=>{
  const names=report.milestones.map(m=>m.name);
  const first=report.milestones.find(m=>m.name==='stable island reached');
  const delivered=report.milestones.find(m=>m.name==='companion follows through the remote island address');
  const upper=report.milestones.find(m=>m.name==='independent upper delivery');
  assert.ok(first&&delivered&&upper&&first.cargo[1]<1&&delivered.cargo[1]>7.8&&upper.cargo[1]>12);
  assert.ok(names.indexOf(first.name)<names.indexOf(delivered.name)&&names.indexOf(delivered.name)<names.indexOf(upper.name));
  assert.ok(!names.includes('scout returns through the lower passage'));
  assert.ok(game.physics.portalTransports>=2,'The same free companion crosses both cargo routes');
 });
});
