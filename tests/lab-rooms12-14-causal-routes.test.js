import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {ACTIVE_FOUNDATION_RUNTIME_FLAGS} from '../src/game/ReleaseIdentity.js';

async function verify(levelIndex,order,check){
 const game=await createHeadlessGame();
 if(levelIndex===13)Object.assign(game,{chamberEdition:'foundation',...ACTIVE_FOUNDATION_RUNTIME_FLAGS});
 await game.selectLevel(levelIndex,levelIndex===13);
 const body=game.physics.cargoBody;
 try{
  const report=await runV8Journey(game,{journeyOptions:{order,...(levelIndex===13?{nativeStart:true}:{})}});
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

// The former remote-island cargo address is historical. Current14scouts the
// actual separate passenger bay before free freight, then reuses that pair.
test('14: scout-first reaches the separate bay before the original free companion takes the unsupported contact turn',async()=>{
 await verify(13,'scout-first',(report,game)=>{
  const names=report.milestones.map(m=>m.name),scout=report.milestones.find(m=>m.name==='player scouts the separate glass-side travel bay'),delivered=report.milestones.find(m=>m.name==='light contact carries the original companion across the unsupported turn'),together=report.milestones.find(m=>m.name==='both travellers reach adjacent visible exit lanes');
  assert.ok(scout&&delivered&&together&&scout.cargo[1]<0&&scout.player[1]< -1&&delivered.cargo[2]< -2.45);
  assert.ok(names.indexOf(scout.name)<names.indexOf(delivered.name)&&names.indexOf(delivered.name)<names.indexOf(together.name));
  assert.equal(game.physics.portalTransports,0,'The optical mouth transports a field, never the complete original cargo');assert.ok(game.teleportCount>=3,'The actual scout return and final passenger crossing must occur');
 });
});
