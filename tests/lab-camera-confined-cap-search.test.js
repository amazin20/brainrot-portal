import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {LabCamera} from '../src/game/LabCamera.js';
const V=(...p)=>new THREE.Vector3(...p);
function roomFixture(confined=true){
 const camera=new THREE.PerspectiveCamera(62,16/9,.1,130);
 const wall=new THREE.Mesh(new THREE.BoxGeometry(50,6.8,.5),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));wall.position.set(-48,39.4,10);
 const floor=new THREE.Mesh(new THREE.BoxGeometry(50,.5,46),wall.material);floor.position.set(-48,35.75,33);
 wall.updateMatrixWorld(true);floor.updateMatrixWorld(true);
 const rig=new LabCamera({camera,blockers:[wall,floor],fullBodyFraming:true});rig.configureSilhouette({enabled:true,confined});
 const target=V(-65,36,10.954938949803172);rig.reset(target,Math.PI,-.2);
 return{camera,rig,target,dispose(){wall.geometry.dispose();floor.geometry.dispose();wall.material.dispose();}};
}
function outsideEnvelope(camera,rig){let outside=0;for(const x of[-.85,.85])for(const y of[-1.52,1.52])for(const z of[-.85,.85]){const ndc=V(x,y,z).add(rig.playerPivot).project(camera);if(Math.abs(ndc.x)>1||Math.abs(ndc.y)>1||ndc.z< -1||ndc.z>1)outside++;}return outside;}
test('cap search measures the actual unchanged look axis and does not write camera or controls',()=>{
 const f=roomFixture();try{
  f.rig.lookPoint.copy(f.rig.playerPivot).add(V(0,-5.66,14.96));
  const old={eye:f.camera.position.toArray(),q:f.camera.quaternion.toArray(),fov:f.camera.fov,yaw:f.rig.yaw,pitch:f.rig.pitch};
  assert.ok(f.rig.silhouetteFovAt(f.rig.playerPivot.clone().add(V(0,4,0)))>120);
  assert.ok(f.rig.silhouetteFovAt(f.rig.playerPivot.clone().add(V(8,1.5,0)))<120);
  assert.deepEqual({eye:f.camera.position.toArray(),q:f.camera.quaternion.toArray(),fov:f.camera.fov,yaw:f.rig.yaw,pitch:f.rig.pitch},old);
 }finally{f.dispose();}
});
test('a settled upright floor look beside the real north-wall dimensions finds a swept finite-budget view',()=>{
 // Camera-only optical/collision fixture using measured room41 dimensions.
 // It does not place an actor in a gameplay route or establish reachability.
 const f=roomFixture();try{
  for(let i=0;i<240;i++)f.rig.update({dt:1/60,target:f.target,yaw:Math.PI,pitch:-.361891787616221});
  assert.equal(outsideEnvelope(f.camera,f.rig),0);
  assert.ok(f.camera.fov<=120);assert.ok(f.camera.position.distanceTo(f.rig.playerPivot)>3.6);
  const swept=f.camera.position.clone();f.rig.constrain(f.rig.playerPivot,swept);assert.ok(swept.distanceTo(f.camera.position)<1e-8);
  assert.ok(f.rig.lookPoint.distanceTo(f.rig.focus.clone().addScaledVector(f.rig.forward,16))<1e-9);

 }finally{f.dispose();}
});
test('a north-west corner retains the full envelope while the sparse aim ring rotates past the wall direction',()=>{
 // Optical/collision fixture with measured Room41 corner dimensions and the
 // failing aim-angle range. No actor route or gameplay flags are supplied.
 const f=roomFixture(),west=new THREE.Mesh(new THREE.BoxGeometry(.5,6.8,46),new THREE.MeshBasicMaterial({side:THREE.DoubleSide})),ceiling=new THREE.Mesh(new THREE.BoxGeometry(50,.5,46),west.material);
 west.position.set(-73,39.4,33);ceiling.position.set(-48,43.05,33);west.updateMatrixWorld(true);ceiling.updateMatrixWorld(true);f.rig.blockers.push(west,ceiling);
 try{
  for(let i=0;i<240;i++)f.rig.update({dt:1/60,target:f.target,yaw:9.617493401961537,pitch:.39980217184265915});
  for(let i=0;i<60;i++){
   const yaw=9.617493401961537+(9.739636441393216-9.617493401961537)*i/59;
   f.rig.update({dt:1/60,target:f.target,yaw,pitch:.20036084897553502});
   assert.equal(outsideEnvelope(f.camera,f.rig),0);assert.ok(f.camera.fov<=120);
   assert.ok(f.rig.lookPoint.distanceTo(f.rig.focus.clone().addScaledVector(f.rig.forward,16))<1e-9);
  }
 }finally{west.geometry.dispose();ceiling.geometry.dispose();west.material.dispose();f.dispose();}
});
