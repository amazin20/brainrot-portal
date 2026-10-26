import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runCampaignShortcutCase,validPost35Prerequisites} from '../scripts/qa-campaign-shortcuts.mjs';
import {ACTIVE_FOUNDATION_RUNTIME_FLAGS} from '../src/game/ReleaseIdentity.js';

for(const name of ['held-corner-jumps','held-walkaround-detour'])test(`35: ${name} recognises the earned return only after both real latches and freight transport`,async()=>{
 const game=await createHeadlessGame();game.chamberEdition='foundation';Object.assign(game,ACTIVE_FOUNDATION_RUNTIME_FLAGS);
 try{
  await game.selectLevel(34,false);const body=game.physics.cargoBody,shape=body.shapes[0],cargo=game.cargo;
  const row=await runCampaignShortcutCase(game,name);
  assert.equal(row.outcome,'legitimate_post_prerequisite_solution',row.error);
  assert.equal(row.final.won,true);assert.equal(row.attackReached,true);
  assert.equal(row.sameCompanion,true);assert.equal(row.sameCargoShape,true);
  assert.equal(game.cargo,cargo);assert.equal(game.physics.cargoBody,body);assert.equal(body.shapes[0],shape);
  assert.equal(row.resets+row.respawns,0);assert.equal(validPost35Prerequisites(row),true);
  assert.deepEqual(row.prerequisitePhysics.sourceRoute.milestones,[
   'A real portal ray drives only the first sluice',
   'The first actual mechanical latch preserves the later entry return',
   'Both actual latches retain the sluices before the shared air pair is borrowed',
   'The original free companion leaves its sealed bay through the shared floor-to-middle pair',
  ]);
  if(name==='held-walkaround-detour'){
   assert.ok(row.walkaroundPlan.executed.length>0);
   assert.ok(row.walkaroundPlan.executed.some(step=>step.reached),'The candidate detour must actually move through production space');
  }
  const attacks=[
   ['unreviewed probe name',r=>{r.name='held-direct-sprint';}],
   ['different room',r=>{r.level=34;}],
   ['skipped first latch',r=>{r.prerequisitePhysics.freightArrival.firstLatched=false;}],
   ['skipped second latch',r=>{r.prerequisitePhysics.atAttackStart.secondLatched=false;}],
   ['door stayed closed',r=>{r.prerequisitePhysics.afterAttack.firstProgress=0;}],
   ['no actual freight transfer',r=>{const p=r.prerequisitePhysics;p.freightArrival.cargoTransports=p.initial.cargoTransports;}],
   ['cargo never reached middle court',r=>{r.prerequisitePhysics.freightArrival.cargoPosition[2]=-20;}],
   ['carried arrival substituted for free cargo',r=>{r.prerequisitePhysics.freightArrival.held=true;}],
   ['another portal used after prefix',r=>{r.prerequisitePhysics.afterAttack.cargoTransports++;}],
   ['replacement cargo body',r=>{r.prerequisitePhysics.afterAttack.sameCargoBody=false;}],
   ['missing causal milestone',r=>{r.prerequisitePhysics.sourceRoute.milestones.pop();}],
   ['attempt reset',r=>{r.resets=1;}],
  ];
  for(const [label,mutate]of attacks){const copy=structuredClone(row);mutate(copy);assert.equal(validPost35Prerequisites(copy),false,label);}
  if(process.env.ROOM35_SHORTCUT_REPORT)fs.appendFileSync(process.env.ROOM35_SHORTCUT_REPORT,JSON.stringify(row)+'\n');
 }finally{game.firstLevel?.dispose();game.physics.dispose();game.portals.dispose();}
});
