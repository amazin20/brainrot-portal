import test from 'node:test';
import assert from 'node:assert/strict';
import {traceManifoldRoute,integrateFulcrum} from '../src/game/LabSingularityExpansion.js';
import {SINGULARITY_ROOMS,validateSingularityLayout} from '../src/game/LabSingularityLayout.js';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runSingularityJourney} from '../src/game/LabSingularityJourney.js';

test('Annex pipes permit both real branches, a longer connected path, and reject a closed loop',()=>{
 assert.deepEqual(traceManifoldRoute([1,2,0]),{path:['feed','a','b','sink'],terminal:'sink',powered:true});
 assert.deepEqual(traceManifoldRoute([2,0,1]),{path:['feed','a','c','sink'],terminal:'sink',powered:true});
 assert.equal(traceManifoldRoute([1,1,1]).powered,true);
 assert.equal(traceManifoldRoute([1,1,2]).terminal,'cycle');
 assert.equal(traceManifoldRoute([0,2,1]).terminal,'vent');
 assert.throws(()=>traceManifoldRoute([3,0,0]),RangeError);
 assert.equal(validateSingularityLayout(),true);
 for(const [annex,upper]of [['manifold','migrant'],['eclipse','inertia'],['fulcrum','inversion']])assert.ok(SINGULARITY_ROOMS.find(r=>r.id===upper).requires.includes(annex));
});

test('A continuous lever reverses with actual load position and retains height under its mechanical brake',()=>{
 const s={travel:0,velocity:0,torque:0};for(let i=0;i<600;i++)integrateFulcrum(s,{occupied:true,leverArm:2,armed:true},1/120);
 assert.equal(s.travel,1);assert.ok(s.torque>0);
 for(let i=0;i<120;i++)integrateFulcrum(s,{occupied:true,leverArm:18,armed:true,locked:true},1/120);
 assert.equal(s.travel,1);
 for(let i=0;i<600;i++)integrateFulcrum(s,{occupied:true,leverArm:18,armed:true},1/120);
 assert.equal(s.travel,0);assert.ok(s.torque<0);
});

for(const annexVariant of ['direct','alternate'])test(`Three annex halls have a real collision-respecting ${annexVariant} route`,async()=>{
 const game=await createHeadlessGame();game.chamberEdition='foundation';await game.selectLevel(40,true);
 try{
  const report=await runSingularityJourney(game,{order:annexVariant==='direct'?['manifold','eclipse','fulcrum']:['eclipse','fulcrum','manifold'],stopAfter:annexVariant==='direct'?'fulcrum':'manifold',annexVariant});
  assert.equal(report.partial,true);assert.deepEqual(new Set(report.metrics.solvedIds),new Set(['manifold','eclipse','fulcrum']));
  assert.equal(report.resets+report.respawns+report.cargoResets,0);assert.equal(report.sameCompanion,true);
  assert.ok(report.metrics.events.find(e=>e.id==='fulcrum').proof.leverArmRange[1]>12);
 }finally{game.firstLevel.dispose();game.physics.dispose();game.portals.dispose();}
});
