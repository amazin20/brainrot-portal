import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {LabCamera} from '../src/game/LabCamera.js';

for(const [width,height]of [[320,568],[390,844],[414,896]])for(const aiming of [false,true])test(`ordinary portrait shoulder retains the character envelope at ${width}x${height}, aiming=${aiming}`,()=>{
 const camera=new THREE.PerspectiveCamera(62,width/height,.06,160),rig=new LabCamera({camera}),target=new THREE.Vector3();
 rig.reset(target,0,-.12);
 for(const x of [-.8,.8])for(const y of [0,2.5]){
  const p=new THREE.Vector3(x,y,.4).project(camera);
  assert.ok(Math.abs(p.x)<.95&&Math.abs(p.y)<.95,'The first spawn frame must already contain the character');
 }
 for(let i=0;i<120;i++)rig.update({dt:1/60,target,yaw:0,pitch:-.12,aiming});
 assert.equal(rig.fullBodyFraming,false,'Ordinary rooms must also use the narrow-screen shoulder');
 camera.updateMatrixWorld(true);
 for(const x of [-.8,.8])for(const y of [0,2.5])for(const z of [-.4,.4]){
  const p=new THREE.Vector3(x,y,z).project(camera);
  assert.ok(Math.abs(p.x)<.95,`Character side clipped at NDC x=${p.x}`);
  assert.ok(Math.abs(p.y)<.95,`Character head/foot clipped at NDC y=${p.y}`);
  if(aiming)assert.ok(p.x<-.01,'The retained hero envelope must leave the centre aiming ray clear');
 }
});


test('portrait retreat retains the real blocker sweep at a wall behind the player',()=>{
 const camera=new THREE.PerspectiveCamera(62,390/844,.06,160);
 const wall=new THREE.Mesh(new THREE.BoxGeometry(20,12,.3),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
 wall.position.set(0,4,5);wall.updateMatrixWorld(true);
 const rig=new LabCamera({camera,blockers:[wall]}),target=new THREE.Vector3();rig.reset(target,0,-.12);
 for(let i=0;i<120;i++)rig.update({dt:1/60,target,yaw:0,pitch:-.12});
 assert.ok(camera.position.z<4.7,'A longer portrait boom must not enter or cross the wall');
 const swept=camera.position.clone();rig.constrain(rig.playerPivot,swept);
 assert.ok(swept.distanceTo(camera.position)<1e-7,'The final portrait lens has not been swept');
 wall.geometry.dispose();wall.material.dispose();
});

test('landscape and square viewports retain the same physical camera path',()=>{
 const rigs=[16/9,4/3,1].map(aspect=>{const camera=new THREE.PerspectiveCamera(62,aspect,.06,160),rig=new LabCamera({camera});rig.reset(new THREE.Vector3(),0,-.12);return{camera,rig};});
 for(let frame=0;frame<120;frame++){
  const input={dt:1/60,target:new THREE.Vector3(frame/300,0,-frame/400),yaw:frame/600,pitch:-.12,aiming:frame>40};
  rigs.forEach(({rig})=>rig.update(input));
  for(const {camera}of rigs.slice(1)){assert.deepEqual(camera.position.toArray(),rigs[0].camera.position.toArray());assert.deepEqual(camera.quaternion.toArray(),rigs[0].camera.quaternion.toArray());assert.equal(camera.fov,rigs[0].camera.fov);}
 }
});

test('specialized silhouette and mechanism policies keep their authored portrait distance',()=>{
 for(const mode of ['silhouette','mechanism']){
  const camera=new THREE.PerspectiveCamera(62,390/844,.06,160),rig=new LabCamera({camera});
  if(mode==='silhouette')rig.configureSilhouette({enabled:true});else rig.configureMechanismFraming({enabled:true});
  rig.reset(new THREE.Vector3(),0,-.12);assert.equal(rig.distance,6.5);
 }
});
