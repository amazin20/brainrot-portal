import test from 'node:test';
import assert from 'node:assert/strict';
import {SINGULARITY_ROOMS,validateSingularityLayout} from '../src/game/LabSingularityLayout.js';
import {pourVolumes} from '../src/game/LabSingularityLevel.js';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runSingularityJourney} from '../src/game/LabSingularityJourney.js';

test('The folded castle has cross-wing dependencies at every elevation and no repeated causal rule',()=>{
 assert.equal(validateSingularityLayout(),true);
 assert.deepEqual([...new Set(SINGULARITY_ROOMS.map(r=>r.at[1]))].sort((a,b)=>a-b),[0,18,36,54,72]);
 assert.equal(new Set(SINGULARITY_ROOMS.map(r=>r.rule)).size,SINGULARITY_ROOMS.length);
 for(const[a,b]of [['freight','hoist'],['sluice','archive'],['optics','archive'],['flywheel','migrant'],['magnet','migrant'],['migrant','pendulum'],['pendulum','inertia']])assert.ok(SINGULARITY_ROOMS.find(r=>r.id===b).requires.includes(a));
 assert.equal(SINGULARITY_ROOMS.find(r=>r.id==='crown').requires.length,SINGULARITY_ROOMS.length-1);
});

test('The new 10/7/3 hydraulic stock reaches 5/5 without a fabricated partial-pour command',()=>{
 const capacities=[10,7,3],queue=[[10,0,0]],seen=new Map([['10,0,0',0]]);
 for(let n=0;n<queue.length;n++)for(let a=0;a<3;a++)for(let b=0;b<3;b++)if(a!==b){const next=pourVolumes(queue[n],capacities,a,b);assert.equal(next.reduce((s,v)=>s+v),10);next.forEach((v,i)=>assert.ok(v>=0&&v<=capacities[i]));const key=next.join(',');if(!seen.has(key)){seen.set(key,seen.get(queue[n].join(','))+1);queue.push(next);}}
 assert.ok(seen.has('5,5,0'));assert.ok(seen.get('5,5,0')>=5);
});

test('Independent lower wings work in another ordinary input order while upper physical locks stay closed',async()=>{
 const game=await createHeadlessGame();game.chamberEdition='foundation';await game.selectLevel(40,true);
 try{const original=game.cargo,body=game.physics.cargoBody.id;const report=await runSingularityJourney(game,{order:['optics','sluice','freight'],stopAfter:'freight'});
  assert.equal(report.partial,true);assert.deepEqual(report.metrics.solvedIds,['optics','sluice','freight']);assert.equal(report.resets+report.respawns+report.cargoResets,0);assert.equal(report.sameCompanion,true);
  assert.equal(game.cargo,original);assert.equal(game.physics.cargoBody.id,body);assert.equal(game.firstLevel.terminals.find(t=>t.id==='migrant:rail').action(),false);assert.equal(game.firstLevel.terminals.find(t=>t.id==='pendulum:catch-a').action(),false);
  assert.ok(report.metrics.events.find(e=>e.id==='optics').proof.portalReflection);assert.ok(report.metrics.events.find(e=>e.id==='freight').proof.carriedPortalCrossings>=1);
 }finally{game.firstLevel.dispose();game.physics.dispose();game.portals.dispose();}
});
