import test from 'node:test';
import assert from 'node:assert/strict';
import {SINGULARITY_ROOMS,validateSingularityLayout} from '../src/game/LabSingularityLayout.js';
import {pourVolumes} from '../src/game/LabSingularityLevel.js';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runSingularityJourney} from '../src/game/LabSingularityJourney.js';

test('Singularity has eleven different physical rules distributed over five castle storeys',()=>{
 assert.equal(validateSingularityLayout(),true);
 assert.equal(SINGULARITY_ROOMS.length,11);
 assert.equal(new Set(SINGULARITY_ROOMS.map(r=>r.rule)).size,11);
 assert.equal(SINGULARITY_ROOMS.filter(r=>r.requires.length===0).length,3);
 assert.equal(new Set(SINGULARITY_ROOMS.filter(r=>r.requires.length).map(r=>r.at[1])).size,5);
 assert.ok(SINGULARITY_ROOMS.every(r=>r.w>=32&&r.d>=32));
});
test('Dependency validation rejects cycles, missing rooms and copied rule descriptors',()=>{
 assert.throws(()=>validateSingularityLayout([{id:'a',rule:'a',requires:['b']}]),/Missing/);
 assert.throws(()=>validateSingularityLayout([{id:'a',rule:'a',requires:['b']},{id:'b',rule:'b',requires:['a']}]),/Cyclic/);
 assert.throws(()=>validateSingularityLayout([{id:'a',rule:'a',requires:[]},{id:'b',rule:'a',requires:[]}]),/Duplicated puzzle/);
});
test('Every reachable 8/5/3 vessel state conserves eight units and respects real capacities',()=>{
 const capacities=[8,5,3],queue=[[8,0,0]],seen=new Map([['8,0,0',0]]);
 for(let n=0;n<queue.length;n++)for(let a=0;a<3;a++)for(let b=0;b<3;b++)if(a!==b){
  const state=queue[n],next=pourVolumes(state,capacities,a,b);
  assert.equal(next.reduce((a,b)=>a+b),8);next.forEach((v,i)=>assert.ok(v>=0&&v<=capacities[i]));
  const key=next.join(',');if(!seen.has(key)){seen.set(key,seen.get(state.join(','))+1);queue.push(next);}
 }
 assert.equal(seen.get('4,4,0'),7);assert.ok(seen.size>10);
 assert.throws(()=>pourVolumes([8,0,0],capacities,0,0),RangeError);
});
test('The actual first puzzle, whole-attempt reset and disposal retain the original companion',async()=>{
 const game=await createHeadlessGame();game.chamberEdition='foundation';await game.selectLevel(40,true);
 const level=game.firstLevel,body=game.physics.cargoBody.id,companion=game.cargo;
 try{
  assert.equal(level.singularity,true);assert.equal(level.id,'tower-singularity');
  assert.equal(level.getTowerMetrics().checkpoints,false);
  for(const id of ['archive:slide-a','migrant:rail','pendulum:catch-a'])assert.equal(level.terminals.find(t=>t.id===id).action(),false);
  const report=await runSingularityJourney(game,{order:['freight'],stopAfter:'freight'});
  assert.equal(report.partial,true);assert.deepEqual(report.metrics.solvedIds,['freight']);assert.equal(report.resets,0);assert.equal(report.respawns,0);
  game.resetRun();assert.deepEqual(level.getTowerMetrics().solvedIds,[]);assert.equal(level.getTowerMetrics().won,false);
  assert.equal(level.machines.get('pendulum').state.A,false);assert.equal(level.machines.get('pendulum').state.B,false);
  assert.deepEqual(level.machines.get('sluice').state.volumes,[10,0,0]);
  assert.equal(level.machines.get('hoist').state.locked,false);assert.equal(level.machines.get('magnet').state.passed,false);
  assert.equal(game.cargo,companion);assert.equal(game.physics.cargoBody.id,body);assert.ok(game.playerPosition.distanceTo(level.spawn)<.01);
  const panels=[...game.portalPanels];level.dispose();assert.ok(panels.every(p=>!game.portalPanels.includes(p)));
 }finally{level.dispose();game.physics.dispose();game.portals.dispose();}
});

test('All eleven castle mechanisms and the sealed crown are reachable in one ordinary-input attempt',async()=>{
 const game=await createHeadlessGame();game.chamberEdition='foundation';await game.selectLevel(40,true);
 try {
  const report=await runSingularityJourney(game);
  assert.equal(report.pass,true);assert.equal(game.state,'won');assert.equal(report.sameCompanion,true);
  assert.equal(report.resets+report.respawns+report.cargoResets,0);
  assert.equal(report.metrics.completedStages,SINGULARITY_ROOMS.length);
  assert.deepEqual(new Set(report.metrics.solvedIds),new Set(SINGULARITY_ROOMS.map(r=>r.id)));
  assert.equal(new Set(report.metrics.events.map(e=>e.rule)).size,SINGULARITY_ROOMS.length);
  assert.ok(report.teleports>=6);assert.ok(report.shots>=12);
  assert.ok(report.actions.some(a=>a.kind==='walk')&&report.actions.some(a=>a.kind==='shoot')&&report.actions.some(a=>a.kind==='use'));assert.ok(report.jumps>=2);const fling=report.metrics.events.find(e=>e.id==='inertia').proof;assert.ok(fling.portalEntries>=1&&fling.maxSpeed>15&&fling.landed,'The balcony must be reached through a real energetic portal fall');assert.ok(report.distance>400);assert.ok(report.metrics.events.find(e=>e.id==='hoist').proof.cargoPortalTransports>=1);assert.ok(report.metrics.events.find(e=>e.id==='crown').proof.independentLoads);assert.equal(new Set(report.metrics.events.map(e=>e.rule)).size,11);
  assert.equal(report.metrics.checkpoints,false);
 } finally {game.firstLevel.dispose();game.physics.dispose();game.portals.dispose();}
});
