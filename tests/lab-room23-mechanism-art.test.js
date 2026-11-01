import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {buildRoom23MechanismArt,ROOM23_MECHANISM_ART_REVISION} from '../src/game/LabRoom23MechanismArt.js';
import {gameplayContract} from './helpers/lab-art-contract.js';

const game=await createHeadlessGame();game.chamberEdition='foundation';game.room23PhysicalPrototype=true;
after(()=>{game.firstLevel?.dispose?.();game.physics?.dispose();game.portals?.dispose();});
const V=(...p)=>new THREE.Vector3(...p),M=()=>new THREE.Matrix4();
const bytes=array=>Buffer.from(array.buffer,array.byteOffset,array.byteLength);
function geometryDigest(geometry){
 const hash=createHash('sha256');
 for(const key of Object.keys(geometry.attributes).sort())hash.update(key).update(bytes(geometry.attributes[key].array));
 if(geometry.index)hash.update(bytes(geometry.index.array));return hash.digest('hex');
}
function assetsDigest(){
 const hash=createHash('sha256');for(const [id,root]of game.assets){hash.update(String(id));root.traverse(mesh=>{
  if(!mesh.isMesh)return;hash.update(geometryDigest(mesh.geometry));
  for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])hash.update(JSON.stringify(material.toJSON()));
 });}return hash.digest('hex');
}
function numericState(object){
 return Object.fromEntries(Object.entries(object).flatMap(([key,value])=>{
  if(['number','boolean','string'].includes(typeof value))return[[key,value]];
  if(value?.toArray&&('x'in value||'w'in value))return[[key,value.toArray()]];
  if(value?.elements&&Array.isArray(value.elements))return[[key,value.elements.slice()]];
  if(Array.isArray(value)&&value.every(n=>typeof n==='number'))return[[key,value.slice()]];
  return[];
 }));
}
function physicalState(){
 const p=game.physics,w=p.world;
 return{
  world:numericState(w),bodies:w.bodies.map(body=>({body,state:numericState(body),shapes:body.shapes.slice(),
   shapeState:body.shapes.map(numericState),offsets:body.shapeOffsets.map(v=>v.toArray()),rotations:body.shapeOrientations.map(q=>q.toArray())})),
  constraints:w.constraints.map(c=>({constraint:c,state:numericState(c),bodyA:c.bodyA,bodyB:c.bodyB,equations:c.equations.map(e=>({equation:e,state:numericState(e),bi:e.bi,bj:e.bj}))})),
  contactMaterials:w.contactmaterials.slice(),bodyBoxes:[...p.bodyBoxes].map(([key,value])=>({key,value,body:value.body,shapeIndex:value.shapeIndex,orientedBox:value.orientedBox})),
  subsystem:w.subsystems.slice(),solver:w.solver,solverSolve:w.solver.solve,
 };
}
function distances(mesh){
 if(!mesh.geometry)return null;mesh.geometry.computeBoundingBox();mesh.updateWorldMatrix(true,false);
 const center=mesh.geometry.boundingBox.getCenter(V()),radius=mesh.geometry.boundingBox.getSize(V()).length()+1;
 return[V(1,0,0),V(0,1,0),V(0,0,1)].flatMap(axis=>[-1,1].map(sign=>{
  const from=center.clone().addScaledVector(axis,radius*sign).applyMatrix4(mesh.matrixWorld),to=center.clone().applyMatrix4(mesh.matrixWorld);
  return new THREE.Raycaster(from,to.sub(from).normalize()).intersectObject(mesh,true).map(hit=>hit.distance);
 }));
}
function registeredSnapshot(){
 const all=new Set([...game.colliders.map(c=>c.mesh),...game.cameraBlockers,...game.aimBlockers,...game.portalPanels]);
 return new Map([...all].map(mesh=>[mesh,{geometry:mesh.geometry,geometryDigest:mesh.geometry?geometryDigest(mesh.geometry):null,parent:mesh.parent,children:mesh.children.slice(),
  visible:mesh.visible,matrix:mesh.matrix.clone(),bounds:new THREE.Box3().setFromObject(mesh),rays:distances(mesh)}]));
}

test('room23 closed observation construction leaves every existing physical/query owner and uploaded resource intact',async()=>{
 await game.selectLevel(22,true);const level=game.firstLevel,first=level.room23MechanismArt;
 assert.ok(level.room23PhysicalPrototype);assert.ok(first);assert.equal(first.mounts.length,2);
 const targets=first.mounts.map(owner=>owner.target);first.dispose();
 const before=gameplayContract(game),physics=physicalState(),registered=registeredSnapshot(),assets=assetsDigest();
 const registries=[game.colliders,game.floors,game.cameraBlockers,game.aimBlockers,game.portalPanels].map(list=>list.slice());
 const art=buildRoom23MechanismArt(level.workshop,targets);
 try{
  assert.equal(art.root.userData.revision,ROOM23_MECHANISM_ART_REVISION);
  assert.deepEqual(gameplayContract(game),before);assert.deepEqual(physicalState(),physics);
  for(const [index,list]of[game.colliders,game.floors,game.cameraBlockers,game.aimBlockers,game.portalPanels].entries())assert.deepEqual(list,registries[index]);
  for(const [mesh,snapshot]of registered){
   assert.equal(mesh.geometry,snapshot.geometry);assert.equal(geometryDigest(mesh.geometry),snapshot.geometryDigest);
   assert.equal(mesh.parent,snapshot.parent);assert.deepEqual(mesh.children,snapshot.children);assert.equal(mesh.visible,snapshot.visible);
   assert.deepEqual(mesh.matrix,snapshot.matrix);assert.deepEqual(new THREE.Box3().setFromObject(mesh),snapshot.bounds);
   assert.deepEqual(distances(mesh),snapshot.rays,'Original shot/camera/light ray triangles changed');
  }
  assert.equal(assetsDigest(),assets);assert.ok(level.balance.ownershipValid());
  assert.equal(art.stats.glassPanes,2);assert.equal(art.stats.extraColliders+art.stats.extraFloors+art.stats.extraLights,0);
  assert.equal(art.root.children.length,2);assert.equal(art.root.children.find(m=>m.material.transparent).material.depthWrite,false);
  for(const owner of art.mounts){
   const pane=owner.parts.filter(part=>part.kind==='glass');assert.equal(pane.length,1);
   assert.equal(pane[0].mesh.geometry.index.count,36,'Every observation pane must remain a complete closed box');
   const size=owner.bounds.getSize(V()),axis=size.x<size.z?'x':'z';
   assert.ok(Math.abs(owner.bounds.max[axis]-pane[0].bounds.max[axis]-.002)<1e-8,'Visible pane front drifted behind the original contact plane');
   assert.ok(Math.abs(pane[0].bounds.min[axis]-owner.bounds.min[axis]-.002)<1e-8,'Visible pane back drifted behind the original contact plane');
   for(const part of owner.parts)assert.ok(owner.bounds.clone().expandByScalar(.000001).containsBox(part.bounds));
  }
  const count=level.world.root.children.length;assert.equal(buildRoom23MechanismArt(level.workshop,targets),art);assert.equal(level.world.root.children.length,count);
  level.reset();level.renderUpdate(.5);assert.equal(assetsDigest(),assets);assert.ok(level.balance.ownershipValid());
  for(const [index,list]of[game.colliders,game.floors,game.cameraBlockers,game.aimBlockers,game.portalPanels].entries())assert.deepEqual(list,registries[index]);
  for(const target of targets){assert.equal(target.material.visible,false);assert.equal(target.userData.room23ObservationOwner,art.root.uuid);}
  assert.equal(art.root.parent,level.world.root);
 }finally{art.dispose();}
});

test('room23 art follows full source matrices without changing measured subtrees and releases only its own resources once',async()=>{
 await game.selectLevel(22,true);const level=game.firstLevel,first=level.room23MechanismArt,targets=first.mounts.map(o=>o.target);first.dispose();
 const originalMaterials=targets.map(t=>t.material),children=targets.map(t=>t.children.slice()),worldChildren=level.world.root.children.slice();
 const art=buildRoom23MechanismArt(level.workshop,targets),counts=new Map(),sourceCounts=new Map();
 for(const resource of art.root.ownedResources){counts.set(resource,0);resource.addEventListener('dispose',()=>counts.set(resource,counts.get(resource)+1));}
 for(const resource of new Set([...originalMaterials,...targets.map(t=>t.geometry)])){sourceCounts.set(resource,0);resource.addEventListener('dispose',()=>sourceCounts.set(resource,sourceCounts.get(resource)+1));}
 const source=targets[0],position=source.position.clone(),quaternion=source.quaternion.clone(),scale=source.scale.clone();
 source.position.add(V(.7,.4,-.2));source.quaternion.setFromAxisAngle(V(0,1,0),.27);source.scale.set(.96,1.02,.94);art.sync();
 const actual=M(),expected=M(),world=M();art.root.updateWorldMatrix(true,true);
 for(const owner of art.mounts)for(const part of owner.parts){
  part.mesh.getMatrixAt(part.index,actual);world.multiplyMatrices(art.root.matrixWorld,actual);expected.multiplyMatrices(owner.target.matrixWorld,part.matrix);
  for(let n=0;n<16;n++)assert.ok(Math.abs(world.elements[n]-expected.elements[n])<.00001);
 }
 source.position.copy(position);source.quaternion.copy(quaternion);source.scale.copy(scale);source.updateWorldMatrix(true,false);art.sync();
 art.dispose();art.dispose();assert.ok(art.disposed);assert.deepEqual(level.world.root.children,worldChildren);
 for(const [index,target]of targets.entries()){assert.equal(target.material,originalMaterials[index]);assert.deepEqual(target.children,children[index]);assert.equal(target.userData.room23ObservationOwner,undefined);}
 assert.ok([...counts.values()].every(n=>n===1),'Owned resource was leaked or disposed twice');
 assert.ok([...sourceCounts.values()].every(n=>n===0),'Original query or shared wall resources were disposed');
});
