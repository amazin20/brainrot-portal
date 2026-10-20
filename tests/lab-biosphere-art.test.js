import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {installBiosphereArt,BIOSPHERE_ART_REVISION} from '../src/game/LabBiosphereArt.js';
import {gameplayContract} from './helpers/lab-art-contract.js';
import {room23PhysicalFixture} from './fixtures/room23-physical-fixture.js';

const game=await createHeadlessGame();game.chamberEdition='foundation';game.room23PhysicalPrototype=true;
after(()=>{game.firstLevel?.dispose?.();game.physics?.dispose();game.portals?.dispose();});
const V=(...v)=>new THREE.Vector3(...v),M=()=>new THREE.Matrix4();
const bytes=array=>Buffer.from(array.buffer,array.byteOffset,array.byteLength);
function rayDistances(mesh){
 if(!mesh.isMesh||!mesh.geometry)return null;
 mesh.geometry.computeBoundingBox();mesh.updateWorldMatrix(true,true);
 const box=mesh.geometry.boundingBox,center=box.getCenter(V()),radius=box.getSize(V()).length()+1,result=[];
 for(const axis of [V(1,0,0),V(0,1,0),V(0,0,1)])for(const sign of [-1,1]){
  const origin=center.clone().addScaledVector(axis,radius*sign).applyMatrix4(mesh.matrixWorld),target=center.clone().applyMatrix4(mesh.matrixWorld);
  result.push(new THREE.Raycaster(origin,target.sub(origin).normalize()).intersectObject(mesh,true).map(hit=>Math.round(hit.distance*1e8)/1e8));
 }
 return result;
}
function assetDigest(){
 const hash=createHash('sha256');
 for(const [id,root]of game.assets){hash.update(String(id));root.traverse(mesh=>{
  if(!mesh.isMesh)return;
  for(const key of Object.keys(mesh.geometry.attributes).sort())hash.update(key).update(bytes(mesh.geometry.attributes[key].array));
  if(mesh.geometry.index)hash.update(bytes(mesh.geometry.index.array));
  for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])hash.update(JSON.stringify(material.toJSON()));
 });}
 return hash.digest('hex');
}
async function bare(index){await game.selectLevel(index,true);game.firstLevel.biosphereArt?.dispose();return game.firstLevel;}
function originalSnapshot(g){
 const meshes=new Set([...g.colliders.map(c=>c.mesh),...g.cameraBlockers,...g.aimBlockers,...g.portalPanels]);
 return new Map([...meshes].map(mesh=>[mesh,{
  geometry:mesh.geometry,children:mesh.children.slice(),visible:mesh.visible,parent:mesh.parent,
  local:mesh.matrix.clone(),bounds:new THREE.Box3().setFromObject(mesh),rays:rayDistances(mesh),
 }]));
}
function assertFollower(art){
 art.updateWorldMatrix(true,true);const actual=M(),world=M(),expected=M();
 for(const owner of art.mounts){
  owner.target.updateWorldMatrix(true,false);
  for(const part of owner.parts){
   part.mesh.getMatrixAt(part.index,actual);world.multiplyMatrices(art.matrixWorld,actual);expected.multiplyMatrices(owner.target.matrixWorld,part.matrix);
   for(let n=0;n<16;n++)assert.ok(Math.abs(world.elements[n]-expected.elements[n])<.00002,`${owner.name} failed to follow its actual source matrix`);
   assert.ok(owner.bounds.clone().expandByScalar(.00001).containsBox(part.bounds),`${owner.name} escaped its closed original chassis`);
  }
 }
}
for(const index of [20,21,22,25,28])test(`room ${index+1}: new manufactured forms preserve original physics owners, measured subtrees and GLB buffers`,async()=>{
 const level=await bare(index),before=gameplayContract(game),originals=originalSnapshot(game),assets=assetDigest();
 const bodies=game.physics.world.bodies.slice(),shapes=bodies.map(body=>body.shapes.slice()),constraints=game.physics.world.constraints.slice();
 const portalMaterials=game.portalPanels.map(mesh=>[mesh,mesh.material]);
 installBiosphereArt(game,level);const art=level.biosphereArt;
 assert.equal(art.userData.revision,BIOSPHERE_ART_REVISION);assert.ok(art.mounts.length>=1);
 assert.deepEqual(gameplayContract(game),before,'Art changed actual collision, aim, portal frames, interaction or mechanism state');
 assert.deepEqual(game.physics.world.bodies,bodies);assert.deepEqual(game.physics.world.constraints,constraints);
 for(let n=0;n<bodies.length;n++)assert.deepEqual(bodies[n].shapes,shapes[n]);
 for(const [mesh,snapshot]of originals){
  assert.equal(mesh.geometry,snapshot.geometry);assert.equal(mesh.parent,snapshot.parent);assert.equal(mesh.visible,snapshot.visible);
  assert.deepEqual(mesh.children,snapshot.children);assert.deepEqual(new THREE.Box3().setFromObject(mesh),snapshot.bounds);
  assert.deepEqual(mesh.matrix,snapshot.local);
  assert.deepEqual(rayDistances(mesh),snapshot.rays,'An original collision/aim/portal ray hit moved');
 }
 for(const [mesh,material]of portalMaterials)assert.equal(mesh.material,material,'The white portal ceramic material must remain exactly the original');
 assert.equal(assetDigest(),assets,'Supplied asset geometry, index buffers or master materials changed');
 assert.equal(art.userData.stats.extraLights,0);assert.equal(art.userData.stats.extraColliders,0);assert.equal(art.userData.stats.independentClocks,0);
 assert.ok(art.userData.stats.parts>=14&&art.userData.stats.parts<=160);assert.ok(art.userData.stats.batches<=4);
 assertFollower(art);
 const childCount=level.world.root.children.length;installBiosphereArt(game,level);assert.equal(level.biosphereArt,art);assert.equal(level.world.root.children.length,childCount);
});

test('room 23 machined drive geometry stays inside both original round contact discs',async()=>{
 const level=await bare(22);installBiosphereArt(game,level);const art=level.biosphereArt,p=V();
 const drives=art.mounts.filter(owner=>owner.cylindrical);assert.equal(drives.length,2);assert.equal(art.userData.stats.driveDiscs,2);
 for(const owner of drives)for(const part of owner.parts){
  const vertices=part.mesh.geometry.attributes.position;
  for(let n=0;n<vertices.count;n++){
   p.fromBufferAttribute(vertices,n).applyMatrix4(part.matrix);
   assert.ok(Math.hypot(p.x,p.z)<=.400001,'A decorative square corner escaped the actual circular rim');
   assert.ok(Math.abs(p.y)<=.040001,'A face fitting intrudes into the real clutch or brake contact gap');
  }
 }
 assert.ok(drives.every(owner=>owner.parts[0].mesh.geometry.type==='LatheGeometry'),'The drive requires actual recessed rotational geometry');
});

test('moving gate batches follow complete translated, rotated and scaled source matrices without a private clock',async()=>{
 const level=await bare(28);installBiosphereArt(game,level);const art=level.biosphereArt,owner=art.mounts[0];
 const position=owner.target.position.clone(),rotation=owner.target.quaternion.clone(),scale=owner.target.scale.clone();
 owner.target.position.add(V(1.3,3.1,-.4));owner.target.quaternion.setFromAxisAngle(V(0,1,0),.39);owner.target.scale.set(.94,1.03,.88);
 level.renderUpdate(.37);assertFollower(art);
 const matrices=art.children.map(mesh=>Array.from(mesh.instanceMatrix.array));level.renderUpdate(.37);
 assert.deepEqual(art.children.map(mesh=>Array.from(mesh.instanceMatrix.array)),matrices);
 owner.target.position.copy(position);owner.target.quaternion.copy(rotation);owner.target.scale.copy(scale);owner.target.updateWorldMatrix(true,true);level.renderUpdate(1);
});

test('real moving shutter and lift updates keep their registered boxes exactly on the original meshes',async()=>{
 for(const index of [20,21,25,28]){
  const level=await bare(index);installBiosphereArt(game,level);const art=level.biosphereArt;
  const children=new Map(art.mounts.map(owner=>[owner.target,owner.target.children.slice()]));
  // Equal declared component stimuli exercise the original state updates;
  // this is a renderer/physics regression probe, not an ordinary-input route.
  if(index===20){level.cassette.height=level.cassette.high;level.serviceCar.update(0);}
  if(index===21){level.shutters.progress=.65;level.shutters.update(0);}
  if(index===25){level.state.shutter.height=6.4;level.update(0);}
  if(index===28){level.state.gardenLatch.engaged=true;level.update(.4);}
  level.renderUpdate(.5);assertFollower(art);
  for(const owner of art.mounts){
   assert.deepEqual(owner.target.children,children.get(owner.target));
   const collider=game.colliders.find(c=>c.mesh===owner.target);
   if(collider)assert.deepEqual(collider.box,new THREE.Box3().setFromObject(owner.target));
  }
 }
});

test('physical Room23 dynamic cars, clutch and real passenger retain ownership under the new visual layer',()=>{
 const baseline=room23PhysicalFixture(),upgraded=room23PhysicalFixture();
 // This fixture declares body positions explicitly. Its comparison concerns
 // component dynamics only and makes no ordinary Play or route acceptance claim.
 const makeLevel=f=>({world:{root:f.game.scene},index:22,room23PhysicalPrototype:true,balance:f.machine,renderUpdate(){},reset(){f.machine.reset();},dispose(){f.machine.dispose();}});
 upgraded.game.chamberEdition='foundation';const level=makeLevel(upgraded);installBiosphereArt(upgraded.game,level);
 const original=upgraded.original,shape=upgraded.shape;
 try{
  baseline.step(1);upgraded.step(1);baseline.machine.requestClutch(true);upgraded.machine.requestClutch(true);
  baseline.step(2);upgraded.step(2);baseline.machine.requestBrake(false);upgraded.machine.requestBrake(false);
  baseline.step(.75);upgraded.step(.75);level.renderUpdate(.5);assertFollower(level.biosphereArt);
  assert.equal(upgraded.machine.ownershipValid(),true);assert.equal(upgraded.original,original);assert.equal(upgraded.original.shapes[0],shape);
  const bodyState=f=>f.machine.bodies.map(body=>[body.mass,...body.position.toArray(),...body.velocity.toArray(),...body.quaternion.toArray(),...body.angularVelocity.toArray()]);
  assert.deepEqual(bodyState(upgraded),bodyState(baseline));
  assert.deepEqual(upgraded.machine.energy(),baseline.machine.energy());
 }finally{level.biosphereArt?.dispose();baseline.dispose();upgraded.dispose();}
});

test('explicit art release restores local source materials and disposes only owned GPU resources exactly once',async()=>{
 const level=await bare(25),mesh=level.state.shutter.mesh,material=mesh.material;
 const oldRender=level.renderUpdate,oldReset=level.reset,oldDispose=level.dispose;
 installBiosphereArt(game,level);const art=level.biosphereArt,resources=new Map(art.ownedResources.map(resource=>[resource,0]));
 for(const resource of resources.keys())resource.addEventListener('dispose',()=>resources.set(resource,resources.get(resource)+1));
 let sourceDisposed=0;material.addEventListener('dispose',()=>sourceDisposed++);
 assert.notEqual(mesh.material,material);assert.equal(mesh.material.visible,false);assert.equal(mesh.visible,true);
 art.dispose();art.dispose();assert.equal(level.biosphereArt,undefined);assert.equal(art.parent,null);assert.equal(art.children.length,0);
 assert.equal(mesh.material,material);assert.equal(level.renderUpdate,oldRender);assert.equal(level.reset,oldReset);assert.equal(level.dispose,oldDispose);
 assert.equal(sourceDisposed,0);assert.ok([...resources.values()].every(count=>count===1));
});

test('normal level disposal releases the art before invoking its earlier physical owner once',async()=>{
 const level=await bare(22),previous=level.dispose;let calls=0;
 level.dispose=function(...args){calls++;return previous?.apply(this,args);};
 installBiosphereArt(game,level);const art=level.biosphereArt,resources=new Map(art.ownedResources.map(resource=>[resource,0]));
 for(const resource of resources.keys())resource.addEventListener('dispose',()=>resources.set(resource,resources.get(resource)+1));
 level.dispose();level.dispose();assert.equal(calls,1);assert.ok([...resources.values()].every(count=>count===1));
});

test('already authored rooms and historical nonphysical Room23 retain their existing presentation',async()=>{
 for(const index of [19,23,24,26,27,29,30]){
  const level=await bare(index),children=level.world.root.children.slice();installBiosphereArt(game,level);
  assert.equal(level.biosphereArt,undefined);assert.deepEqual(level.world.root.children,children);
 }
 game.room23PhysicalPrototype=false;
 try{const level=await bare(22),children=level.world.root.children.slice();installBiosphereArt(game,level);assert.equal(level.biosphereArt,undefined);assert.deepEqual(level.world.root.children,children);}
 finally{game.room23PhysicalPrototype=true;}
});
