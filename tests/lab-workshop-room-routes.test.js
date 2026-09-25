import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runWorkshopJourney} from '../src/game/LabWorkshopJourney.js';

const game=await createHeadlessGame();
after(()=>{game.physics.dispose();game.portals.dispose();});

for(const index of [8,9])test(`rebuilt room ${index+1} completes with normal controls and the same companion`,async()=>{
 await game.selectLevel(index,false);
 const report=await runV8Journey(game);
 assert.equal(report.pass,true);assert.equal(report.resets+report.respawns,0);
 assert.equal(game.state,'won');assert.equal(game.heldCube,game.cargo);
});

for(const aspect of [1.6,16/9])test(`room 9: carrying the original friend through the wall into the spring drop wins at aspect ${aspect}`,async()=>{
 await game.selectLevel(8,false);game.camera.aspect=aspect;game.camera.updateProjectionMatrix();
 const cargo=game.cargo,body=game.physics.cargoBody;
 const report=await runV8Journey(game,{journeyOptions:{route:'carried-front-drop'}});
 assert.equal(report.pass,true);assert.equal(report.resets+report.respawns,0);
 assert.equal(game.state,'won');assert.equal(game.cargo,cargo);assert.equal(game.physics.cargoBody,body);
 assert.ok(report.teleports>=1,'The player must carry the friend through the front-wall portal');
 assert.ok(report.milestones.some(m=>m.name==='carried friend through front wall then dropped onto spring'));
 assert.equal(game.firstLevel.workshop.state.piston.latched,true);
});

test('the raised spring cup requires falling momentum, not a gently resting load',async()=>{
 await game.selectLevel(8,false);game.resetRun(true);
 const s=game.firstLevel.workshop.state.piston;
 // Explicit negative fixture: place the original body just above the real
 // cup surface. The former fixed height was below this rebuilt mechanism.
 const p=new THREE.Vector3(0,s.restY+.51,-5);
 game.physics.resetCargo({position:p});game.cargo.position.copy(p);game.cargo.velocity.set(0,0,0);
 let peak=0;
 for(let n=0;n<480;n++){game.updatePlaying(1/120);peak=Math.max(peak,s.compression);}
 assert.equal(s.latched,false);assert.ok(peak>.05&&peak<.68,`Compression ${peak} must show actual load contact without latching`);
});

function approach(d){d.walk(-9.5,11);d.walk(-9.5,5.6);d.walk(-5.4,5.6);d.walk(-2.9,4.7);}

test('an empty bridge and repeated jumps do not enter the closed freight hood or unlock it',async()=>{
 await game.selectLevel(9,false);
 const report=await runV8Journey(game,{scenario:d=>{
  const s=d.level.workshop.state;approach(d);d.walk(-5.4,4.7);game.interact();d.wait(5);
  assert.equal(s.freight.progress,1);assert.equal(s['dock-lock'].engaged,false);
  d.walk(-2.8,4.7);d.walk(-1.55,2);
  for(let n=0;n<300;n++){
   if(n%8===0)game.input.jumpQueued=true;d.worldMove(1,0);d.frame();
   const p=game.playerPosition;
   if(p.x>0&&p.x<7.6&&p.z>.3&&p.z<2.7)assert.ok(p.y>=3.18,`Player entered the closed hood at ${p.toArray()}`);
  }
  d.stop();assert.equal(s['dock-lock'].engaged,false);assert.equal(game.state,'playing');
 }});
 assert.equal(report.resets+report.respawns,0);
});

test('the receiving panel refuses an early portal whose aperture intersects the closed hood',async()=>{
 await game.selectLevel(9,false);
 await runV8Journey(game,{scenario:d=>{
  approach(d);d.walk(-2.8,4.7);
  assert.throws(()=>d.aim(1,d.level.panels['unloading-dock'].getFrame().center),/Portal impact rejected/);
  assert.equal(game.portalShots.lastImpact?.reason,'placement');
  assert.equal(game.portalShots.lastImpact?.surface,'unloading-dock / collision');
  assert.equal(d.level.workshop.state['dock-lock'].engaged,false);
  assert.equal(game.state,'playing');
 }});
});

for(const edition of ['foundation','classic'])test(`${edition} room 10 recovers from an empty bridge trip, then wins with the original cargo`,async()=>{
 game.chamberEdition=edition;await game.selectLevel(9,false);
 const cargo=game.cargo,body=game.physics.cargoBody;
 const report=await runV8Journey(game,{scenario:async d=>{
  const bridge=d.level.workshop.state.freight,lock=d.level.workshop.state['dock-lock'];
  d.walk(-9.5,11);d.walk(-9.5,5.6);d.walk(-5.4,5.6);d.walk(-5.4,4.7);
  game.interact();d.wait(5);
  assert.ok(bridge.progress>.98);assert.equal(lock.engaged,false);
  game.interact();d.wait(5);
  assert.ok(bridge.progress<.02);assert.equal(lock.engaged,false);
  d.walk(-5.4,5.6);d.walk(-9.5,5.6);d.walk(-9.5,11);
  await runWorkshopJourney(d);
  assert.equal(game.state,'won');
 }});
 assert.equal(report.pass,true);assert.equal(report.resets+report.respawns,0);
 assert.equal(game.cargo,cargo);assert.equal(game.physics.cargoBody,body);
});
