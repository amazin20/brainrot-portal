import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runRoom27} from '../src/game/LabRoom27Journey.js';
const game=await createHeadlessGame();
after(()=>{game.physics.dispose();game.portals.dispose();});

for(const aspect of [1.6,16/9])for(const gravityReturn of [false,true])test(`room27: ${gravityReturn?'gravity return':'upper belt'} is a complete original-cargo route at aspect ${aspect}`,async()=>{
 game.camera.aspect=aspect;game.camera.updateProjectionMatrix();await game.selectLevel(26,false);
 const body=game.physics.cargoBody,id=game.cargo.group.uuid;
 const report=await runV8Journey(game,{scenario:d=>runRoom27(d,{gravityReturn})});
 assert.equal(game.state,'won');assert.equal(report.pass,true);assert.equal(report.resets+report.respawns,0);
 assert.equal(game.physics.cargoBody,body);assert.equal(game.cargo.group.uuid,id);assert.ok(game.physics.portalTransports>=2);
 assert.ok(report.milestones.some(m=>m.name===(gravityReturn?'the observation loop supplies an alternative gravity-powered bridge':'belt momentum becomes the final bridge')));
 assert.ok(game.firstLevel.goal.contains(game.playerPosition)&&game.firstLevel.goal.contains(game.cargo.position));
});

test('room27: a missed first landing is recoverable using the existing pair and original load',async()=>{
 game.camera.aspect=1.6;game.camera.updateProjectionMatrix();await game.selectLevel(26,false);
 const report=await runV8Journey(game,{scenario:d=>runRoom27(d,{recoverFirst:true,inspectEastFirst:true})});
 assert.equal(game.state,'won');assert.equal(report.resets+report.respawns,0);assert.equal(report.teleports,3);
 assert.ok(report.milestones.some(m=>m.name==='a missed side street returns to the shared plaza'&&m.player[1]<.2));
});

test('room27: contact traction is tangent-only, reversible and absent in air or on a stopped belt',async()=>{
 await game.selectLevel(26,false);game.resetRun(true);const s=game.firstLevel.state.conveyors,p=new THREE.Vector3(-13,.08,0),v=new THREE.Vector3(4,2,0);
 const forward=s.acceleration(p,v);assert.equal(forward.x,0);assert.equal(forward.y,0);assert.ok(forward.z>0);
 s.reversed=false;assert.ok(s.acceleration(p,v).z<0);
 assert.equal(s.acceleration(p.clone().add(new THREE.Vector3(0,1,0)),v).lengthSq(),0);
 assert.equal(s.acceleration(p,v,{grounded:false}).lengthSq(),0);
 assert.equal(s.acceleration(new THREE.Vector3(-7,.08,0),v).lengthSq(),0);
 s.braked=true;assert.equal(s.acceleration(p,v).lengthSq(),0);
});

test('room27: the original unheld cargo is accelerated by actual belt contact and stops on the ordinary side plaza',async()=>{
 await game.selectLevel(26,false);
 const report=await runV8Journey(game,{scenario:d=>{
  const {walk,pickup,wait}=d,s=d.level.state.conveyors;
  walk(-21,11);walk(-19,11);game.interact();wait(.1);assert.equal(s.braked,true);
  walk(-21,19);walk(game.cargo.position.x+1,game.cargo.position.z);pickup();
  walk(-21,19);walk(-21,3);walk(-13,3);walk(-13,2);game.interact();wait(.8);assert.equal(game.heldCube,null);
  const before=game.cargo.position.clone(),body=game.physics.cargoBody;
  walk(-21,2);walk(-21,11);walk(-19,11);game.interact();d.stop();
  let peak=0;for(let n=0;n<180;n++){d.frame();peak=Math.max(peak,body.velocity.z);}
  assert.equal(s.braked,false);assert.ok(game.cargo.position.z>before.z+8);assert.ok(peak>12,`Live contact peak ${peak}`);
  wait(3);assert.ok(game.cargo.position.z>15);assert.ok(Math.abs(body.velocity.z)<.6);
 }});
 assert.equal(report.resets+report.respawns,0);
});
