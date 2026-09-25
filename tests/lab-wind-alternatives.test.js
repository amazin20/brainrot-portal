import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

const game=await createHeadlessGame();
after(()=>{game.physics.dispose();game.portals.dispose();});

for(const aspect of [1.6,16/9])test(`room 11: physical friend turns the drive for left-wall airflow at aspect ${aspect}`,async()=>{
 await game.selectLevel(10,false);game.camera.aspect=aspect;game.camera.updateProjectionMatrix();
 const body=game.physics.cargoBody,cargo=game.cargo;
 const report=await runV8Journey(game,{journeyOptions:{route:'turntable-air'},onMilestone:mark=>{
  const s=game.firstLevel.state;
  if(mark.name.includes('friend turned')){
   assert.equal(s.driveTurn.loaded(),true);
   assert.ok(s.driveTurn.angle>3.08);
   assert.ok(s.flywheel.normal.x<-.99);
   assert.equal(s.flywheel.wheel.work,0);
  }
  if(mark.name.includes('west-wall stream')){
   assert.ok(s.ratchet.engaged&&s.flywheel.wheel.work>70);
   assert.ok(s.flywheel.normal.x<-.99);
   assert.ok(game.portals.portals.some(p=>p&&p.position.x < -13.5));
  }
 }});
 assert.ok(report.pass&&game.state==='won');
 assert.equal(report.resets+report.respawns,0);
 assert.equal(game.physics.cargoBody,body);assert.equal(game.cargo,cargo);
});

test('room 11 turntable follows real settled load, housing and inlet, and resets to canonical orientation',async()=>{
 await game.selectLevel(10,false);game.resetRun(true);
 const s=game.firstLevel.state,initial=s.flywheel.position.clone();
 assert.ok(!s.driveTurn.loaded());assert.equal(s.driveTurn.angle,0);
 const position=s.driveTurn.plate.position.clone();
 assert.ok(position.distanceTo(new THREE.Vector3(-5.2,.012,-1.4))<.001);
 for(let n=0;n<180;n++)game.updatePlaying(1/120);
 assert.equal(s.driveTurn.angle,0);assert.ok(s.flywheel.position.distanceTo(initial)<1e-8);
 assert.ok(s.flywheel.housing.box.equals(new THREE.Box3().setFromObject(s.flywheel.art.art)));
});

test('room 11 west-wall stream misses an unturned drive despite running fan and valid portals',async()=>{
 await game.selectLevel(10,false);
 const report=await runV8Journey(game,{scenario:d=>{
  d.aim(0,d.level.panels['wind-intake'].getFrame().center);
  d.walk(-3.5,-1);d.aim(1,new THREE.Vector3(-13.975,2.3,-5));
  d.walk(-3.4,4.7);game.interact();d.wait(9);
  const s=d.level.state;
  assert.equal(s.blower.enabled,true);assert.equal(s.driveTurn.loaded(),false);
  assert.equal(s.flywheel.power,false);assert.equal(s.flywheel.wheel.work,0);
  assert.equal(s.ratchet.engaged,false);assert.equal(game.state,'playing');
 }});
 assert.ok(report.pass);assert.equal(report.resets+report.respawns,0);
});
