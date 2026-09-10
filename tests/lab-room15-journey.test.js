import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runRoom15} from '../src/game/LabRoom15Journey.js';
const game=await createHeadlessGame();
after(()=>{game.physics.dispose();game.portals.dispose();});
for(const [order,aspect] of [['cargo-first',1.6],['scout-first',16/9]])test(`countercurrent ${order} completes at aspect ${aspect} with the original friend`,async()=>{
 await game.selectLevel(14,false);game.camera.aspect=aspect;game.camera.updateProjectionMatrix();
 const cuts=[];const body=game.physics.cargoBody,group=game.cargo.group,report=await runV8Journey(game,{scenario:d=>runRoom15(d,{order}),onMilestone:m=>{if(m.name==='field released over the receiver')cuts.push({airborne:!game.playerGrounded,segments:game.firstLevel.state.funnel.segments.length});}});
 assert.equal(report.pass,true);assert.equal(game.state,'won');assert.equal(report.resets+report.respawns,0);
 assert.equal(game.physics.cargoBody,body);assert.equal(game.cargo.group,group);
 assert.equal(cuts.length,1);assert.ok(cuts[0].airborne&&cuts[0].segments===1,'An ordinary charged shot cuts the routed field during flight: '+JSON.stringify(cuts));
 assert.ok(game.physics.portalTransports>=2,'Cargo really passes through freight and retrieval portals');
 assert.ok(report.milestones.some(m=>m.name==='upper pocket and new viewpoint'&&m.player[1]>11.9));
 assert.ok(report.milestones.some(m=>m.name==='airborne lane exchange'&&m.player[1]>17));
 if(order==='scout-first'){
  const scout=report.milestones.find(m=>m.name==='scout finds the empty receiver');
  assert.ok(scout&&scout.player[1]>=14&&scout.cargo[1]<3,'Exploration precedes extraction of the same friend');
 }
});
