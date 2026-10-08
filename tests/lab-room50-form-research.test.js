import test from 'node:test';
import assert from 'node:assert/strict';
import {runRoom50Research} from '../scripts/prototypes/run-room50-engine.mjs';
import {runRoom50ResearchNegatives} from '../scripts/prototypes/check-room50-engine-negative.mjs';

test('50 research: two actual floor/cargo plans jointly win with the original body through compatible production portals',async()=>{
 const short=await runRoom50Research('short'),long=await runRoom50Research('long'),recovery=await runRoom50Research('long-recovery');
 for(const route of [short,long,recovery]){
  assert.equal(route.pass,true);assert.equal(route.state,'won');assert.equal(route.resets+route.respawns,0);
  assert.equal(route.playerTransfers,0);assert.equal(route.cargoIdentityPreserved,true);assert.equal(route.minPlayerY,4);assert.equal(route.otherFormFrames,0);
 }
 assert.equal(short.cargoTransfers,2);assert.equal(long.cargoTransfers,1);assert.equal(recovery.cargoTransfers,2);assert.deepEqual(recovery.finalAngles,[-Math.PI/2,0]);
 assert.deepEqual(short.finalAngles,[0,0]);assert.deepEqual(long.finalAngles,[-Math.PI/2,0]);
});

test('50 research: ordinary initial shots including jumps cannot acquire R in the finite probe and no load means no assembly',async()=>{
 const r=await runRoom50ResearchNegatives();assert.equal(r.shots.length,48);assert.equal(r.initialReturnShots,0);
 assert.equal(r.cargoTransfers+r.playerTransfers,0);assert.equal(r.resets+r.respawns,0);assert.equal(r.identityPreserved,true);
});
