import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runBalanceJumpAttempt} from '../src/game/LabExtendedJourney.js';

const game=await createHeadlessGame();
await game.selectLevel(6,false);
after(()=>{game.physics.dispose();game.portals.dispose();});

test('recorded room-7 carry jumping cannot bypass the receiving balcony',async()=>{
 let attempt;
 const report=await runV8Journey(game,{scenario:d=>{attempt=runBalanceJumpAttempt(d);}});
 assert.equal(attempt.reached,false,JSON.stringify(attempt));
 assert.equal(attempt.cargoHeld,true,'The correction must not drop or replace the companion');
 assert.equal(attempt.teleports,0);
 assert.equal(report.resets+report.respawns,0);
});

test('counterweight settings and repeated jumps cannot replace the lever load',async()=>{
 const bypasses=[];
 for(const carry of [false,true])for(const counter of [0,1,2])for(const sprint of [false,true])for(const jumpEvery of [0,8,20,40]){
  let attempt;
  const settings={carry,counter,sprint,jumpEvery};
  await runV8Journey(game,{scenario:d=>{attempt=runBalanceJumpAttempt(d,settings);}});
  if(attempt.reached)bypasses.push({...settings,...attempt});
 }
 assert.deepEqual(bypasses,[],'A traveller reached the receiving balcony without using the gravity-powered portal flight');
});

test('room-7 gravity flight and portal retrieval complete with the same friend',async()=>{
 const originalGroup=game.cargo.group,originalBody=game.physics.cargoBody.id;
 const report=await runV8Journey(game);
 assert.equal(report.pass,true);
 assert.equal(report.resets+report.respawns,0);
 assert.equal(game.state,'won');
 assert.equal(game.cargo.group,originalGroup);assert.equal(game.physics.cargoBody.id,originalBody);
 assert.ok(game.firstLevel.goal.contains(game.playerPosition));assert.ok(game.firstLevel.goal.contains(game.cargo.position));
 assert.ok(game.playerGrounded&&game.playerPosition.distanceTo(game.cargo.position)<3.3);
 assert.ok(report.milestones.some(m=>m.name==='landed on the upper receiving balcony'));
 assert.ok(report.milestones.some(m=>m.name==='gravity speed redirected by the tilting portal'));
});
