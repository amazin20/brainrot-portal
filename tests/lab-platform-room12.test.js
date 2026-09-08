import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {ROOM12_SPEC,runRoom12} from '../src/game/LabPlatformRoom12.js';
const game=await createHeadlessGame();
after(()=>{game.physics.dispose();game.portals.dispose();});
test('the split atrium has a complete ordinary jump and gravity route with the same companion',async()=>{
 await game.selectLevel(11,false);
 assert.equal(game.firstLevel.id,ROOM12_SPEC.id);
 const result=await runV8Journey(game,{scenario:runRoom12});
 assert.equal(game.state,'won');assert.ok(result.pass);
 assert.equal(result.resets,0);assert.equal(result.respawns,0);assert.ok(result.teleports>=1);
 assert.ok(result.milestones.filter(x=>/gap/.test(x.name)).length>=10);
 assert.equal(game.firstLevel.terminals.length,0);assert.equal(game.firstLevel.getLaunch(),null);
});
test('a missed western jump lands on the real court and returns by the same stair',async()=>{
 await game.selectLevel(11,false);
 const result=await runV8Journey(game,{scenario:d=>{
  d.walk(-17.3,28);d.pickup();d.walk(-17,26.4);d.walk(-17,14.7);
  d.walk(-16.45,10.8);d.until(()=>game.playerGrounded&&game.playerPosition.y<.1,4,'Court recovery');
  assert.equal(game.state,'playing');assert.ok(game.heldCube);
  d.walk(-11,11);d.walk(-11,28);d.walk(-17,28);d.walk(-17,26.4);d.walk(-17,14.7);
  assert.ok(game.playerGrounded&&Math.abs(game.playerPosition.y-5.5)<.12);
 }});
 assert.ok(result.pass);assert.equal(result.resets,0);assert.equal(result.respawns,0);
});
