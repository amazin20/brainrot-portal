import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runBalanceJumpAttempt} from '../src/game/LabExtendedJourney.js';

const game=await createHeadlessGame();
await game.selectLevel(6,false);
after(()=>{game.physics.dispose();game.portals.dispose();});

test('recorded room-7 carry jumping cannot bypass the load-balanced crossing',async()=>{
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
 assert.deepEqual(bypasses,[],'A traveller reached the intermediate gallery without placing a load on the far lever arm');
});

test('room-7 ordinary load placement and portal retrieval remain completable',async()=>{
 const report=await runV8Journey(game);
 assert.equal(report.pass,true);
 assert.equal(report.resets+report.respawns,0);
 assert.equal(game.state,'won');
 assert.ok(report.milestones.some(m=>m.name==='crossed a load-balanced physical deck'));
});
