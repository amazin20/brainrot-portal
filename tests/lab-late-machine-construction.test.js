import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {lateCassetteBulkheadGeometry,latePressureManifoldGeometry,installOpticalRailTruck} from '../src/game/LabLateMachineConstruction.js';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';

const close=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-5,`${label}: ${a} != ${b}`);
test('closed cassette walls and cast pressure heads retain the original exact solid envelopes',()=>{
 for(const size of [[.8,30,19],[22,4,.4],[.6,17,9],[46,15,.5],[3.5,.35,7.2]])for(const axis of ['x','y','z']){
  const g=lateCassetteBulkheadGeometry(...size,axis),s=g.boundingBox.getSize(new THREE.Vector3());
  size.forEach((n,i)=>close(s.getComponent(i),n,`cassette ${axis} dimension ${i}`));
  for(const attribute of ['position','normal','uv','color'])assert.ok([...g.attributes[attribute].array].every(Number.isFinite));
  g.dispose();
 }
 for(const [r,h]of [[.75,1.7],[1,1.7],[1.2,5.3]]){
  const g=latePressureManifoldGeometry(r,h),s=g.boundingBox.getSize(new THREE.Vector3());
  [r*2,h,r*2].forEach((n,i)=>close(s.getComponent(i),n,'manifold envelope'));
  assert.ok(g.index===null&&g.attributes.color.count===g.attributes.position.count);g.dispose();
 }
});

test('the optical truck fits beneath the actual deck, bears on the original rails, and follows the real moving parent',async()=>{
 const g=await createHeadlessGame();g.chamberEdition='foundation';g.puzzleProgression=true;
 try{
  await g.selectLevel(48,false);const l=g.firstLevel,k=l.workshop,truck=k.visualAuditLateRailTruck;
  assert.ok(truck);assert.equal(truck.wheels.length,4);
  const parent=l.carriage.group;assert.equal(truck.originalMovingParent,parent);
  const before={colliders:[...g.colliders],floors:[...g.floors],portals:[...g.portalPanels],camera:[...g.cameraBlockers],aim:[...g.aimBlockers]};
  assert.equal(installOpticalRailTruck(k,parent,truck.chassis.material),null,'installation is idempotent');
  const parts=[truck.chassis,...truck.wheels],union=new THREE.Box3();
  for(const mesh of parts){assert.equal(mesh.parent,parent);mesh.geometry.computeBoundingBox();mesh.updateMatrix();union.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrix));}
  assert.ok(truck.bounds.clone().expandByScalar(1e-5).containsBox(union),'truck exceeds disclosed under-deck bounds');
  const initial=truck.wheels.map(m=>m.rotation.z);parent.position.x+=1.34;l.renderUpdate(1);
  for(const [i,w]of truck.wheels.entries())assert.notEqual(w.rotation.z,initial[i]);
  for(const [key,registry]of [['colliders',g.colliders],['floors',g.floors],['portals',g.portalPanels],['camera',g.cameraBlockers],['aim',g.aimBlockers]])assert.deepEqual(registry,before[key]);
  assert.ok(g.colliders.some(c=>Math.abs(c.box.max.y-4.96)<1e-4),'authored rail top remains y4.96');
 }finally{g.physics?.dispose();g.portals?.dispose();}
});
