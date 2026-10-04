import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

test('35: carrying through live airflow doors retains both real causes without requiring either latch',async()=>{
 const g=await createHeadlessGame();g.chamberEdition='foundation';await g.selectLevel(34,false);
 const cargo=g.cargo,body=g.physics.cargoBody,seen=[];
 try{
  const report=await runV8Journey(g,{journeyOptions:{route:'carry-with-live-flow'},onMilestone:m=>{
   if(m.name==='A real portal ray drives only the first sluice'||m.name.startsWith('Both travellers finish with actual airflow'))
    seen.push({name:m.name,powered:g.firstLevel.powered(),first:g.firstLevel.first.progress,second:g.firstLevel.second.progress,
     firstLatched:g.firstLevel.isFirstLatched(),secondLatched:g.firstLevel.isLatched()});
  }});
  assert.ok(report.pass);assert.equal(g.state,'won');assert.equal(report.resets+report.respawns,0);
  assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);assert.ok(g.heldCube);
  assert.equal(g.physics.portalTransports,0);assert.equal(g.teleportCount,0);
  assert.equal(seen.length,2);assert.deepEqual(seen[0].powered,[true,false]);assert.ok(seen[0].first>.9);
  assert.deepEqual(seen[1].powered,[false,true]);assert.ok(seen[1].second>.9);
  assert.ok(seen.every(s=>!s.firstLatched&&!s.secondLatched));
 }finally{g.physics.dispose();g.portals.dispose();}
});
