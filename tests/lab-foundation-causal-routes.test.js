import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

async function room(number,options={},aspect=16/9){
 const game=await createHeadlessGame();game.chamberEdition='foundation';
 await game.selectLevel(number-1,false);
 game.camera.aspect=aspect;game.camera.updateProjectionMatrix();
 const snapshots=[];
 const report=await runV8Journey(game,{journeyOptions:options,onMilestone:(mark,g)=>{
  const outgoing=g.firstLevel.light?.segments[1];
  snapshots.push({name:mark.name,player:g.playerPosition.clone(),cargo:g.cargo.position.clone(),
   teleports:g.teleportCount,hoistAtTop:g.firstLevel.cargoHoist?.at(1),
   lightDirection:outgoing?.direction.clone(),lightStart:outgoing?.a.clone()});
 }});
 assert.equal(report.pass,true);assert.equal(report.resets,0);assert.equal(report.respawns,0);
 return {game,report,snapshots};
}

test('room 1: the portal carries both travellers, or the player dispatches the staged companion separately',async()=>{
 const direct=await room(1),freight=await room(1,{alternate:true});
 assert.equal(direct.report.teleports,1);
 assert.equal(direct.snapshots.some(s=>s.hoistAtTop),false);
 const staged=freight.snapshots[0],dispatched=freight.snapshots[1];
 assert.equal(staged.teleports,0);assert.ok(staged.cargo.y<1);
 assert.equal(dispatched.teleports,1);assert.ok(dispatched.player.y>=4);
 assert.ok(dispatched.cargo.y>4);assert.equal(dispatched.hoistAtTop,true);
 assert.equal(freight.game.state,'won');
});

test('room 2: direct crossing and island switching change where the same light bridge supports travel',async()=>{
 const direct=await room(2),staged=await room(2,{alternate:true});
 const straight=direct.snapshots[0],island=staged.snapshots[0],turned=staged.snapshots[1];
 assert.ok(straight.lightDirection.x>.95);assert.ok(Math.abs(straight.lightStart.z-8)<2);
 assert.ok(island.lightDirection.x>.95);assert.ok(Math.abs(island.lightStart.z+9)<2);
 assert.ok(turned.lightDirection.z>.95);assert.ok(turned.player.y>2.9&&turned.cargo.y>3.1);
 assert.ok(turned.player.x>=4&&turned.player.x<=12&&turned.player.z>=-13&&turned.player.z<=-5);
 assert.equal(staged.game.state,'won');
});

test('both distinct routes remain playable through ordinary input in portrait framing',async()=>{
 for(const number of [1,2]){
  const {game,report}=await room(number,{alternate:true},9/16);
  assert.equal(game.state,'won');assert.equal(report.level,number);
 }
});
