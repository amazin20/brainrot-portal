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

test('room10 receiver frame has founded load shoes and exact solid sections outside the original apertures and moving deck',async()=>{
 const edition=game.chamberEdition;game.chamberEdition='foundation';
 try{
  await game.selectLevel(9,false);game.resetRun(true);
  const {freightReceiverFrame:parts,freight}=game.firstLevel.state;
  assert.equal(parts.length,34);
  // The original overhead side ties live above the traveller's jump/head
  // envelope. Guard the real low passage, and separately the full moving
  // glass well, rather than declaring that entire space up to the roof empty.
  const hoodClear=new THREE.Box3(new THREE.Vector3(-.53+1e-5,1.82,-.03+1e-5),new THREE.Vector3(8.13-1e-5,5.8,3.03-1e-5));
  const hangerClear=new THREE.Box3(new THREE.Vector3(.52+1e-5,5.94,-.48+1e-5),new THREE.Vector3(4.48-1e-5,11.96,3.48-1e-5));
  const wellSweep=new THREE.Box3(new THREE.Vector3(1.48,3.22,.33),new THREE.Vector3(3.52,8.82,2.37));
  freight.model.setProgress(0);const retracted=freight.model.deck.bounds();
  freight.model.setProgress(1);const swept=freight.model.deck.bounds().union(retracted);
  swept.min.y=1.58;swept.max.y=1.82;freight.model.setProgress(0);
  const expected={
   'overhead hanger':[4,[.30,6.04,.30]],'overhead cross-head':[4,[4.56,.30,.30]],'overhead side tie':[4,[.30,.30,4.56]],
   'overhead lower shoe':[4,[.46,.40,.46]],'overhead upper junction':[4,[.46,.45,.46]],
   'founded hood upright':[4,[.30,7.4,.30]],'hood load girder':[2,[9.26,.30,.30]],
   'founded hood shoe':[4,[.60,.24,.60]],'hood upper junction':[4,[.46,.45,.46]],
  };
  for(const [role,[count,size]]of Object.entries(expected)){
   const selected=parts.filter(m=>m.userData.freightFrameRole===role);assert.equal(selected.length,count,role);
   for(const mesh of selected){
    const c=game.colliders.find(c=>c.mesh===mesh);assert.ok(c?.enabled,'Every drawn steel body must own a live physical box');
    assert.ok(game.cameraBlockers.includes(mesh)&&game.aimBlockers.includes(mesh));assert.ok(!game.portalPanels.includes(mesh));
    const b=new THREE.Box3().setFromObject(mesh),span=b.getSize(new THREE.Vector3());
    for(let a=0;a<3;a++)assert.ok(Math.abs(span.getComponent(a)-size[a])<1e-5);
    assert.ok(b.min.distanceTo(c.box.min)<1e-5&&b.max.distanceTo(c.box.max)<1e-5);
    assert.equal(b.intersectsBox(hoodClear),false,role+' enters the hood passage');
    if(role.startsWith('overhead'))assert.equal(b.intersectsBox(hangerClear),false,role+' enters the overhead cargo opening');
    assert.equal(b.intersectsBox(wellSweep),false,role+' enters the raised cargo well sweep');
    assert.equal(b.intersectsBox(swept),false,role+' enters the real deck swept volume');
    if(role==='founded hood shoe')assert.ok(Math.abs(b.min.y-(mesh.position.x<0?0:1.82))<1e-5,'A load shoe must sit on its real floor or bank');
   }
  }
 }finally{game.chamberEdition=edition;}
});

test('rigid room10 deck supports the actual falling cargo at the rendered plane across its exposed width and length',async()=>{
 await game.selectLevel(9,false);game.resetRun(true);
 const bridge=game.firstLevel.workshop.state.freight;
 // Explicit contact fixture, separate from the ordinary-control playthroughs:
 // extend this same real body, then drop the original cube onto nine points.
 bridge.target=1;for(let n=0;n<660;n++)game.updatePlaying(1/120);
 assert.equal(bridge.progress,1);
 const half=game.physics.cargoSize/2;
 for(const x of [-.85,0,.85])for(const z of [0,2.4,4.8]){
  const point=new THREE.Vector3(x,bridge.model.deck.top,z).applyMatrix4(bridge.model.moving.matrixWorld);
  game.physics.resetCargo({position:point.clone().add(new THREE.Vector3(0,half+.4,0))});
  game.cargo.position.copy(game.physics.cargoBody.position);game.cargo.velocity.set(0,0,0);
  for(let n=0;n<300;n++)game.updatePlaying(1/120);
  const body=game.physics.cargoBody,bottom=body.position.y-half,visible=bridge.model.deck.heightAt(body.position.x,body.position.z);
  assert.ok(Number.isFinite(visible));assert.ok(Math.abs(bottom-visible)<.012,`Cube floats or sinks by ${bottom-visible}m at ${x},${z}`);
  assert.ok(Math.abs(body.velocity.y)<.05,'The flat walking plate should give a stable resting contact');
 }
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
