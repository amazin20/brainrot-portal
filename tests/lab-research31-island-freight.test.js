import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

for(const [edition,aspect] of [['classic',16/9],['open',9/16]]){
 test(`room 31 ${edition}: original companion reaches permanent island independently at ${aspect}`,async()=>{
  const game=await createHeadlessGame();game.chamberEdition=edition;await game.selectLevel(30,false);
  game.camera.aspect=aspect;game.camera.updateProjectionMatrix();
  const cargoId=game.cargo.group.uuid,body=game.physics.cargoBody.id,marks=[];
  const report=await runV8Journey(game,{journeyOptions:{route:'island-freight'},onMilestone:(m,g)=>marks.push({name:m.name,player:g.playerPosition.clone(),cargo:g.cargo.position.clone(),held:!!g.heldCube,transports:g.physics.portalTransports})});
  assert.equal(report.pass,true);assert.equal(game.state,'won');assert.equal(report.resets,0);assert.equal(report.respawns,0);
  assert.equal(game.cargo.group.uuid,cargoId);assert.equal(game.physics.cargoBody.id,body);
  assert.equal(report.teleports,0,'The player should use the light bridge without entering either freight portal');
  assert.ok(game.physics.portalTransports>=1,'The free original companion must traverse a portal');
  assert.equal(marks[0].name,'original companion reaches the island before the light crossing');
  assert.ok(marks[0].player.x<-16&&marks[0].cargo.x>-2&&marks[0].cargo.y>6&&!marks[0].held);
  assert.equal(marks[1].name,'player and original companion reunite after separate routes');
  assert.ok(marks[1].held);
 });
}
