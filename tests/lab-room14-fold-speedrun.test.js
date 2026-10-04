import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {installRoom21Aim} from '../src/game/LabRoom21Journey.js';
import {runRoom14FoldAttack} from '../scripts/lib/room14-fold-speedrun.mjs';

for(const [label,options]of [
 ['reproduced jump5/E11',{jumpEvery:5,interactEvery:11}],
 ['jump7/E6',{jumpEvery:7,interactEvery:6}],
 ['jump11/E5',{jumpEvery:11,interactEvery:5}],
 ['precharged span rush after original cargo pickup',{jumpEvery:5,interactEvery:11,precharge:true}],
 ['free cargo push and bunnyhop',{jumpEvery:5,interactEvery:0,freePush:true}],
])test(`room14 counterweight blocks ${label} after genuine first crossing`,async()=>{
 const g=await createHeadlessGame();g.chamberEdition='foundation';await g.selectLevel(13,false);let evidence;
 try{
  const report=await runV8Journey(g,{scenario:async d=>{installRoom21Aim(d);evidence=await runRoom14FoldAttack(d,{...options,finish:false});}});
  assert.equal(report.resets,0);assert.equal(report.respawns,0);
  assert.equal(evidence.reachedStableIsland,true,'The attack must start after the genuine first light crossing');
  assert.equal(evidence.cargoTransportsAfterFold,evidence.cargoTransportsBefore,'No free freight portal was used');
  assert.ok(evidence.cargoAtFold[1]<11.8,'Original cargo must not reach the upper receiver through the folded span');
  if(!options.freePush)assert.equal(evidence.northFoldReached,false,'Unweighted 6.3 m span blocks the sprint attack physically');
  else assert.equal(evidence.northFoldReached,true,'Player alone may use the genuinely weighted stair while the cargo remains below');
  assert.equal(g.state,'playing');
 }finally{g.firstLevel.dispose();g.physics.dispose();g.portals.dispose();}
});
