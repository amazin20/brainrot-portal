import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

const game=await createHeadlessGame();
after(()=>{game.physics.dispose();game.portals.dispose();});

async function prove(number,journeyOptions,milestone){
 await game.selectLevel(number-1,false);
 const cargo=game.cargo,body=game.physics.cargoBody,causes=[];
 const report=await runV8Journey(game,{journeyOptions,onMilestone:(step,g)=>{
  if(step.name!==milestone)return;
  causes.push({cargo:g.cargo.position.clone(),portalIds:[...g.portalSurfaceIds],
   hoist:g.firstLevel.state.counterweightHoist?.height,
   optical:g.firstLevel.state.optical&&{...g.firstLevel.state.optical.receivers,loaded:g.firstLevel.state.optical.loaded},
   gravity:g.firstLevel.state.gravity&&{source:g.firstLevel.state.gravity.source.up,crown:g.firstLevel.state.gravity.crown.up}});
 }});
 assert.equal(report.pass,true);assert.equal(game.state,'won');
 assert.equal(report.resets+report.respawns,0);
 assert.equal(game.cargo,cargo);assert.equal(game.physics.cargoBody,body);
 assert.equal(causes.length,1,`physical event '${milestone}' not observed`);
 return {report,event:causes[0]};
}

test('25: ordinary freight portal and light powered plate hoist each complete both optical lifts',async()=>{
 const canonical=await prove(25,{},'cargo retrieval opens the other beam');
 const alternate=await prove(25,{order:'receiver-hoist'},'first optical receiver raised the loaded counterweight onto a physical balcony');
 assert.equal(canonical.event.hoist,0);
 assert.equal(alternate.event.optical.loaded,true);
 assert.equal(alternate.event.optical[0],true);
 assert.ok(alternate.event.hoist>8.95);
 assert.ok(alternate.event.cargo.y>9.1);
 assert.equal(alternate.event.portalIds.includes(game.firstLevel.panels['shadow-counterweight'].mesh.uuid),false);
 assert.equal(canonical.report.milestones.some(step=>step.name.includes('balcony retrieval')),false);
 assert.ok(alternate.report.milestones.some(step=>step.name.includes('balcony retrieval')));
});

test('29: ceiling passage or reversed field direct garden catch each reunite the same companion',async()=>{
 const canonical=await prove(29,{},'the companion crosses a passage too low for its observer');
 assert.ok(canonical.event.cargo.y>15);
 assert.equal(canonical.event.gravity.crown,true);
 const alternate=await prove(29,{gardenCatch:true},'reversed crown gravity catches the directly routed traveller on the garden floor');
 assert.ok(alternate.event.cargo.y<10.8);
 assert.equal(alternate.event.gravity.source,true);
 assert.equal(alternate.event.gravity.crown,false);
 assert.equal(alternate.event.portalIds.includes(game.firstLevel.panels['garden-return'].mesh.uuid),true);
 assert.equal(alternate.event.portalIds.includes(game.firstLevel.panels['crown-ceiling'].mesh.uuid),false);
});
