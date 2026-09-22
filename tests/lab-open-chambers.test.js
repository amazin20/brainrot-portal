import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {CAMPAIGN,campaignSpec} from '../src/game/LabCampaignLevels.js';
import {OPEN_ROOM_INDICES} from '../src/game/LabOpenEdition.js';
let shared;
async function scene(room,aspect=16/9){shared??=await createHeadlessGame();shared.chamberEdition='open';shared.camera.aspect=aspect;shared.camera.updateProjectionMatrix();await shared.selectLevel(room-1,false);return shared;}
for(const [room,options,aspect]of [[24,{route:'portal-first'},16/9],[24,{route:'ride-first',recover:true},16/10],[28,{route:'equal-head'},16/9],[28,{route:'full-east',interrupt:true},16/10],[30,{},16/9],[30,{},16/10]]){
 test(`rebuilt room ${room}: original companion and ordinary route ${JSON.stringify(options)} / aspect ${aspect}`,async()=>{
  const g=await scene(room,aspect),report=await runV8Journey(g,{journeyOptions:options});assert.equal(report.pass,true);assert.equal(g.state,'won');assert.equal(report.resets,0);assert.equal(report.respawns,0);assert.notEqual(report.id,CAMPAIGN[room-1].id);
 });
}
test('new deck and ramp dimensions are measured in world space, not declared by a display label',async()=>{
 for(const i of OPEN_ROOM_INDICES){const g=await scene(i+1),l=g.firstLevel;assert.equal(l.openChamber,true);assert.equal(campaignSpec(g,i).id,l.id);
  for(const d of l.clearance.decks){assert.ok(d.maxX-d.minX>=8,d.name);assert.ok(d.maxZ-d.minZ>=8,d.name);}
  for(const r of g.ramps)assert.ok(r.maxX-r.minX>=8);
  assert.equal(g.camera.far,380);
 }
});
test('tilted portal frame leaves its actual centre visible and blocks its manufactured rim',async()=>{
 const g=await scene(30),surface=g.firstLevel.panels['inclined-outlet'],f=surface.getFrame();g.scene.updateMatrixWorld(true);
 const cameraPoint=new THREE.Vector3(-25.4,55.2,18.5),ray=new THREE.Raycaster(cameraPoint,f.center.clone().sub(cameraPoint).normalize());
 const hits=ray.intersectObjects(g.aimBlockers,true).filter(h=>g.isActiveBlocker(h.object));assert.equal(hits[0].object,surface.mesh);
 assert.ok(surface.frameColliders.length>40);
 const side=f.center.clone().addScaledVector(f.right,surface.width/2+.3),from=side.clone().addScaledVector(f.normal,5);
 ray.set(from,f.normal.clone().negate());assert.ok(ray.intersectObjects(g.aimBlockers,true).some(h=>h.object.name.includes('segmented frame')));
});
test('carrier fixed-step collider and aperture follow its real transform, render interpolation is read-only',async()=>{
 const g=await scene(24),car=g.firstLevel.car;car.braked=false;car.target=1;for(let i=0;i<120;i++)car.update(1/120);
 const before=car.panel.collider.box.clone(),point=car.position.clone(),frame=car.panel.getFrame();assert.ok(Math.abs(frame.center.x-car.position.x)<1e-7);assert.ok(Math.abs(frame.center.y-car.position.y-2.85)<1e-7);
 car.render(.25);assert.deepEqual(car.panel.collider.box,before);assert.deepEqual(car.position,point);car.update(0);assert.ok(car.panel.collider.box.distanceToPoint(car.panel.getFrame().center)<.001);
});
test('a low platform or unlocked exit alone cannot create a win without the actual two bodies',async()=>{
 for(const room of [24,28,30]){const g=await scene(room),l=g.firstLevel;assert.equal(l.isWon(),false);
  const goal=l.goal??l.exit;assert.equal(g.state,'ready');assert.equal(g.teleportCount,0);assert.equal(g.firstLevel.puzzleGeometry.noProgressFlags,true);
 }
});
test('returning to the classic campaign restores the original layout and ordinary camera range',async()=>{
 const g=await scene(24);g.chamberEdition='classic';await g.selectLevel(23,false);assert.equal(g.firstLevel.id,CAMPAIGN[23].id);assert.notEqual(g.firstLevel.openChamber,true);assert.equal(g.camera.far,130);
});
test('hands-free flight receives its own tether/focus lesson instead of the ordinary carry restriction',async()=>{
 const g=await scene(30);g.state='playing';g.playerPosition.copy(g.cargo.position).add(new THREE.Vector3(1,0,0));assert.equal(g.firstLevel.getContextLesson()[0],'open-tether');
 g.velocityCompanion.connected=true;g.playerGrounded=false;g.playerVelocity.set(20,20,0);assert.equal(g.firstLevel.getContextLesson()[0],'open-flight-focus');
});
