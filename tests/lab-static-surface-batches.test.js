import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {batchStaticSurfaceFinishes} from '../src/game/LabStaticSurfaceBatches.js';

function fixture(){
 const root=new THREE.Group(),material=new THREE.MeshStandardMaterial(),tile=new THREE.BoxGeometry(1,1,.1);
 const game={colliders:[],cameraBlockers:[],aimBlockers:[],portalPanels:[]};
 const level={game,world:{root,surfaces:[]}};
 function surface(x,{moving=false,portal=false,protectedBacking=false}={}){
  const group=new THREE.Group();group.position.set(x,2,-3);group.rotation.y=.4;root.add(group);
  const backing=new THREE.Mesh(new THREE.BoxGeometry(1.2,1.7,.08),material);backing.position.z=-.2;group.add(backing);
  const mesh=new THREE.Mesh(tile,material);mesh.visible=false;group.add(mesh);game.colliders.push({mesh});
  const tiles=new THREE.InstancedMesh(tile,material,2);tiles.setMatrixAt(0,new THREE.Matrix4().makeTranslation(0,0,0));tiles.setMatrixAt(1,new THREE.Matrix4().makeTranslation(0,1,0));
  tiles.setColorAt(0,new THREE.Color(.5,.7,.9));tiles.setColorAt(1,new THREE.Color(.9,.7,.5));group.add(tiles);
  if(protectedBacking)game.aimBlockers.push(backing);
  const s={group,backing,mesh,collider:{kinematic:moving},portal};level.world.surfaces.push(s);return s;
 }
 return {level,surface};
}
function vertices(root){
 root.updateMatrixWorld(true);const points=[],matrix=new THREE.Matrix4(),instance=new THREE.Matrix4(),p=new THREE.Vector3(),color=new THREE.Color();
 root.traverseVisible(mesh=>{
  if(!mesh.isMesh)return;const a=mesh.geometry.attributes.position;
  for(let i=0;i<(mesh.isInstancedMesh?mesh.count:1);i++){
   matrix.copy(mesh.matrixWorld);if(mesh.isInstancedMesh){mesh.getMatrixAt(i,instance);matrix.multiply(instance);}
   color.setRGB(1,1,1);if(mesh.instanceColor)mesh.getColorAt(i,color);
   for(let j=0;j<a.count;j++){p.fromBufferAttribute(a,j).applyMatrix4(matrix);points.push([...p,...color].map(v=>Math.round(v*1e4)).join(','));}
  }
 });return points.sort();
}
test('static batches preserve world-space geometry, instance color, material and interaction identity',()=>{
 const {level,surface}=fixture();surface(1);surface(3);surface(5);
 const before=vertices(level.world.root),colliders=[...level.game.colliders],materials=level.world.surfaces.map(s=>s.backing.material);
 batchStaticSurfaceFinishes(level);
 assert.deepEqual(vertices(level.world.root),before);assert.deepEqual(level.game.colliders,colliders);
 level.world.surfaces.forEach((s,i)=>assert.equal(s.backing.material,materials[i]));
 assert.ok(level.staticSurfaceBatches.userData.stats.savedDraws>=4);
 const count=level.world.root.children.length;batchStaticSurfaceFinishes(level);assert.equal(level.world.root.children.length,count);
});
test('moving, portal-bearing and registered ray surfaces remain live and unbatched',()=>{
 const {level,surface}=fixture();surface(1);surface(3);
 const moving=surface(2,{moving:true}),portal=surface(4,{portal:true}),protectedSurface=surface(5,{protectedBacking:true});
 batchStaticSurfaceFinishes(level);
 for(const s of [moving,portal]){assert.equal(s.backing.visible,true);assert.equal(s.backing.matrixAutoUpdate,true);}
 assert.equal(protectedSurface.backing.visible,true);
 moving.group.position.y+=4;level.world.root.updateMatrixWorld(true);
 assert.equal(moving.backing.getWorldPosition(new THREE.Vector3()).y,6);
});
test('distant chunks remain independently culled rather than creating one whole-room batch',()=>{
 const {level,surface}=fixture();surface(1);surface(3);surface(80);surface(82);batchStaticSurfaceFinishes(level);
 const batches=level.staticSurfaceBatches.children;assert.ok(batches.length>=2);
 for(const mesh of batches)assert.ok(mesh.boundingBox.max.x-mesh.boundingBox.min.x<12);
});
test('hidden authored surfaces are not made visible by a batch outside their group',()=>{
 const {level,surface}=fixture();surface(1);surface(3);
 const hidden=surface(5);hidden.group.visible=false;
 const before=vertices(level.world.root);batchStaticSurfaceFinishes(level);
 assert.deepEqual(vertices(level.world.root),before);
 assert.equal(hidden.backing.userData.staticBatchSource,undefined);
});
test('detailed imported treads retain independent frustum culling',()=>{
 const {level,surface}=fixture(),a=surface(1),b=surface(3);
 const detailed=new THREE.SphereGeometry(1,32,24),meshes=[];
 for(const s of [a,b]){const mesh=s.group.children.find(n=>n.isInstancedMesh);mesh.geometry=detailed;meshes.push(mesh);}
 batchStaticSurfaceFinishes(level);
 assert.ok(meshes.every(m=>m.visible&&!m.userData.staticBatchSource));
 assert.ok(level.staticSurfaceBatches.userData.stats.savedDraws>0,'Cheap backings are still consolidated');
});
