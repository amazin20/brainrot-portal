import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runRoom16} from '../src/game/LabRoom16Journey.js';
for(const order of ['cargo-first','scout-first'])test(`room16 ${order} transports the original weight before the returning light crossing`,async()=>{
 const game=await createHeadlessGame();
 try{await game.selectLevel(15,false);const r=await runV8Journey(game,{scenario:d=>runRoom16(d,{order,supportPause:order==='scout-first'?20:0}),onMilestone:()=>{}});assert.ok(r.pass);assert.equal(r.resets,0);assert.equal(r.respawns,0);assert.equal(game.state,'won');}
 finally{game.physics.dispose();game.portals.dispose();}
});
