import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runRoom24} from '../src/game/LabRoom24Journey.js';
const g=await createHeadlessGame();after(()=>{g.physics.dispose();g.portals.dispose();});
for(const route of ['carry-through','counterweight'])for(const aspect of [1.6,16/9])test(`garden ${route} keeps the original companion through real portals at aspect ${aspect}`,async()=>{
 await g.selectLevel(23,false);g.camera.aspect=aspect;g.camera.updateProjectionMatrix();const body=g.physics.cargoBody;let capture;
 const report=await runV8Journey(g,{scenario:d=>runRoom24({...d,mark(name){
  if(name==='the same aperture starts its courtyard orbit')capture={frame:g.portals.portals[1],surface:d.level.panels['revolving-door'].mesh,position:g.portals.portals[1].position.clone(),local:d.level.gardenDoor.group.worldToLocal(g.portals.portals[1].position.clone())};
  if(name==='carried friend explores south balcony and the manual turning drive'){
   assert.equal(g.portals.portals[1],capture.frame);assert.ok(g.portals.portals[1].position.distanceTo(capture.position)>7.5);assert.ok(g.portals.portals[1].position.distanceTo(d.level.gardenDoor.group.localToWorld(capture.local.clone()))<.06);assert.ok(g.portals.portals[1].normal.x<-.999);assert.equal(d.level.gardenDoor.loaded,false);assert.equal(d.level.gardenDoor.manualTurn,true);
  }
  if(name==='the same portal pair lifts its original counterweight'){assert.equal(d.level.gardenDoor.loaded,false);assert.equal(d.level.gardenDoor.manualTurn,false);assert.equal(d.level.gardenDoor.braked,true);assert.ok(g.cargo.position.y>6);}
  d.mark(name);
 }},{route,recovery:true})});
 assert.equal(g.state,'won');assert.equal(report.resets+report.respawns,0);assert.equal(g.physics.cargoBody,body);assert.ok(g.heldCube);assert.ok(report.teleports>=2);
 const door=g.firstLevel.gardenDoor;assert.ok(door.panel.collider.box.equals(new THREE.Box3().setFromObject(door.panel.mesh)));assert.equal(g.colliders.some(c=>c.mesh===door.panel.backing),false);
});
test('garden brake arrests the actual architectural pose and release reverses it, with no invisible second collider',async()=>{
 await g.selectLevel(23,false);g.resetRun(true);const door=g.firstLevel.gardenDoor,initial=door.panel.getFrame();
 // Isolated actuator fixture: these writes are not route evidence.
 door.manualTurn=true;for(let i=0;i<90;i++)door.update(1/60);const midway=door.angle;assert.ok(midway<-.7&&midway>-.9);door.braked=true;door.manualTurn=false;for(let i=0;i<240;i++)door.update(1/60);assert.equal(door.angle,midway);
 door.braked=false;for(let i=0;i<180;i++)door.update(1/60);assert.equal(door.angle,0);assert.ok(door.panel.getFrame().center.distanceTo(initial.center)<1e-10);
 door.manualTurn=true;for(let i=0;i<240;i++)door.update(1/60);const end=door.panel.getFrame();assert.ok(end.center.distanceTo(initial.center)>7.99);assert.ok(end.normal.x<-.999);assert.equal(door.panel.collider.kinematic,true);
 g.resetRun(true);assert.equal(door.manualTurn,false);assert.equal(door.braked,false);assert.equal(door.angle,0);
});
test('garden floors have distinct heights or non-overlapping footprints',async()=>{
 await g.selectLevel(23,false);const surfaces=g.firstLevel.world.surfaces.filter(s=>s.floor);
 for(let i=0;i<surfaces.length;i++)for(let j=i+1;j<surfaces.length;j++){
  const a=surfaces[i].floor,b=surfaces[j].floor;if(Math.abs(a.y-b.y)>.0001)continue;
  const dx=Math.min(a.maxX,b.maxX)-Math.max(a.minX,b.minX),dz=Math.min(a.maxZ,b.maxZ)-Math.max(a.minZ,b.minZ);
  assert.ok(dx<=.0001||dz<=.0001,`${surfaces[i].name} overlaps ${surfaces[j].name}`);
 }
});

test('a fall and erased pair can be recovered from the real lower court while the same companion waits above',async()=>{
 await g.selectLevel(23,false);g.camera.aspect=1.6;g.camera.updateProjectionMatrix();const body=g.physics.cargoBody;
 const report=await runV8Journey(g,{journeyOptions:{route:'carry-through',recovery:'ground-return'}});
 assert.equal(g.state,'won');assert.equal(report.resets+report.respawns,0);assert.equal(g.physics.cargoBody,body);assert.ok(report.milestones.some(m=>m.name==='fall and erased pair recovered through the low mechanical release'));
});
for(const aspect of [1.6,16/9])test(`canonical garden route without rehearsal or portal reset at aspect ${aspect}`,async()=>{
 await g.selectLevel(23,false);g.camera.aspect=aspect;g.camera.updateProjectionMatrix();const body=g.physics.cargoBody;
 const report=await runV8Journey(g);assert.equal(g.state,'won');assert.equal(report.resets+report.respawns,0);assert.equal(g.physics.cargoBody,body);
});
