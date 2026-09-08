import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

const game=await createHeadlessGame();
await game.selectLevel(13,false);
after(()=>{game.physics.dispose();game.portals.dispose();});

test('room 14 crosses two perpendicular gravity flights and seven real jumps with the original companion',async()=>{
 for(const aspect of [16/9,16/10]){
  game.camera.aspect=aspect;game.camera.updateProjectionMatrix();
  const body=game.physics.cargoBody.id,group=game.cargo.group;
  const flights=[];
  const report=await runV8Journey(game,{onMilestone:(m,g)=>{
   if(m.name.includes('gravity redirected'))flights.push({speed:g.playerVelocity.length(),velocity:g.playerVelocity.clone()});
  }});
  assert.equal(report.pass,true);assert.equal(report.resets+report.respawns,0);
  assert.equal(game.state,'won');assert.equal(game.cargo.group,group);assert.equal(game.physics.cargoBody.id,body);
  assert.equal(report.milestones.filter(m=>/^jump [1-7] /.test(m.name)).length,7);
  assert.equal(flights.length,2);assert.ok(flights.every(f=>f.speed>15),'Speed must come from the long fall');
  assert.ok(flights[0].velocity.x>15);assert.ok(flights[1].velocity.z<-15);
  assert.ok(game.firstLevel.goal.contains(game.playerPosition));assert.ok(game.firstLevel.goal.contains(game.cargo.position));
  assert.equal(game.firstLevel.terminals.length,0);assert.equal(game.firstLevel.getLaunch(),null);
 }
});

test('a missed gallery fall returns to the stair under ordinary controls without losing the friend',async()=>{
 const body=game.physics.cargoBody.id;
 const report=await runV8Journey(game,{scenario:async d=>{
  const {walk,pickup,until}=d;
  walk(-2,25.1);pickup();walk(-20,24);walk(-20,2);walk(-23.5,2);walk(-23.5,22);walk(-17,22);
  assert.ok(game.playerGrounded&&game.playerPosition.y>6.9);
  walk(-17,17.5);until(()=>game.playerGrounded,3,'Safe gallery floor');
  assert.ok(game.playerPosition.y>=0&&game.playerPosition.y<.04);assert.equal(game.heldCube,game.cargo);
  walk(-20,17.5);walk(-20,2);walk(-23.5,2);walk(-23.5,22);
  assert.ok(game.playerGrounded&&game.playerPosition.y>6.9);
 }});
 assert.equal(report.resets+report.respawns,0);assert.equal(game.physics.cargoBody.id,body);
});

test('walking into the lower portal cannot substitute for the gallery gravity run',async()=>{
 const report=await runV8Journey(game,{scenario:async d=>{
  const {walk,aim,pickup,worldMove,frame,stop,until,level}=d;
  walk(-4,21);aim(1,level.panels['gallery-launch-east'].getFrame().center);
  walk(-17,23);aim(0,level.panels['gallery-drop-east'].getFrame().center);
  walk(-2,25.1);pickup();walk(-17,22);walk(-17,20.3);
  const before=game.teleportCount;
  for(let n=0;n<300&&game.teleportCount===before;n++){worldMove(0,-.43);frame();}
  stop();assert.ok(game.teleportCount>before);
  until(()=>game.playerGrounded,4,'Low-speed portal landing');
  assert.ok(game.playerPosition.y>=0&&game.playerPosition.y<.04);assert.notEqual(game.state,'won');
  assert.equal(game.heldCube,game.cargo);
 }});
 assert.equal(report.resets+report.respawns,0);
});
