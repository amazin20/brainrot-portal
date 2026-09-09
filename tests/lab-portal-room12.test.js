import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {ROOM12_SPEC} from '../src/game/LabPortalRoom12.js';
import {runRoom12} from '../src/game/LabRoom12Journey.js';

const game=await createHeadlessGame();
after(()=>{game.physics.dispose();game.portals.dispose();});

for(const order of ['cargo-first','scout-first']) {
 test(`the folded junction completes ${order} with the same physical friend and no resets`,async()=>{
  await game.selectLevel(11,false);
  const body=game.physics.cargoBody,group=game.cargo.group;
  const airborne=[];
  const report=await runV8Journey(game,{scenario:d=>runRoom12(d,{order}),onMilestone(item){
   if(item.name==='spent portal becomes the lateral exit')airborne.push(!game.playerGrounded);
  }});
  assert.equal(report.pass,true);assert.equal(game.state,'won');
  assert.equal(report.resets+report.respawns,0);
  assert.equal(game.physics.cargoBody,body);assert.equal(game.cargo.group,group);
  assert.equal(game.firstLevel.id,ROOM12_SPEC.id);
  const freight=report.milestones.find(m=>m.name==='friend reaches the crossing dock');
  assert.ok(freight?.cargo[1]>8.9&&freight.cargo[2]>1.2,'The original body crosses the real low throat');
  const redirected=report.milestones.filter(m=>m.name==='spent portal becomes the lateral exit');
  assert.equal(redirected.length,order==='scout-first'?2:1);
  assert.ok(airborne.every(Boolean),'Portal replacement completes during real flight');
  const scout=report.milestones.find(m=>m.name==='scout reaches the empty dock');
  if(order==='scout-first') {
   assert.ok(scout&&scout.player[1]>8.9&&scout.cargo[1]<1);
   assert.ok(report.milestones.indexOf(scout)<report.milestones.indexOf(freight));
   assert.ok(report.milestones.some(m=>m.name==='scout returns through the lower passage'&&m.player[1]<.1));
  }else assert.equal(scout,undefined);
  assert.equal(game.firstLevel.terminals.length,0);
  assert.equal(game.firstLevel.getLaunch(),null);
 });
}
