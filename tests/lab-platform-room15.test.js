import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

const game=await createHeadlessGame();
await game.selectLevel(14,false);
after(()=>{game.physics.dispose();game.portals.dispose();});

test('woven bridges complete through nine normal carried jumps and two real transfers',async()=>{
 const group=game.cargo.group,body=game.physics.cargoBody.id;
 const report=await runV8Journey(game);
 assert.equal(report.pass,true);assert.equal(game.state,'won');
 assert.equal(report.resets+report.respawns,0);
 assert.equal(game.cargo.group,group);assert.equal(game.physics.cargoBody.id,body);
 assert.equal(report.milestones.filter(m=>m.name==='jumped a broken gallery with the same friend').length,9);
 assert.ok(report.teleports>=2);
 assert.ok(game.firstLevel.goal.contains(game.playerPosition));assert.ok(game.firstLevel.goal.contains(game.cargo.position));
 assert.equal(game.firstLevel.terminals.length,0);assert.equal(game.firstLevel.gates.length,0);
});

test('missing the first bridge falls into the court and returns by the same stair without reset',async()=>{
 const report=await runV8Journey(game,{scenario:d=>{
  d.walk(-14.6,25.9);d.pickup();d.walk(-16,27.3);d.walk(-20,27.3);d.walk(-20,21.3);d.walk(-14,16);
  d.walk(-10.8,16);d.until(()=>game.playerGrounded&&game.playerPosition.y<.1,4,'A missed span did not return to the floor');
  assert.equal(game.heldCube,game.cargo);
  d.walk(game.playerPosition.x,24);d.walk(-16,24);d.walk(-16,27.3);d.walk(-20,27.3);d.walk(-20,21.3);
  assert.ok(Math.abs(game.playerPosition.y-3)<.1);assert.equal(game.teleportCount,0);
 }});
 assert.equal(report.pass,true);assert.equal(report.resets+report.respawns,0);
});
