import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {installOpticsArt,OPTICS_ART_REVISION} from '../src/game/LabOpticsArt.js';
import {gameplayContract,sceneWorkload} from './helpers/lab-art-contract.js';

const game=await createHeadlessGame();game.chamberEdition='foundation';
after(()=>{game.firstLevel?.dispose?.();game.physics?.dispose();game.portals?.dispose();});
const V=(...v)=>new THREE.Vector3(...v),M=()=>new THREE.Matrix4();
async function bare(index){await game.selectLevel(index,true);game.firstLevel.opticsArt?.dispose();return game.firstLevel;}
function assetDigest(){
 const hash=createHash('sha256');
 for(const [id,root]of game.assets){hash.update(String(id));root.traverse(mesh=>{
  if(!mesh.isMesh)return;
  for(const key of Object.keys(mesh.geometry.attributes).sort()){const a=mesh.geometry.attributes[key].array;hash.update(key).update(Buffer.from(a.buffer,a.byteOffset,a.byteLength));}
  if(mesh.geometry.index){const a=mesh.geometry.index.array;hash.update(Buffer.from(a.buffer,a.byteOffset,a.byteLength));}
  for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])hash.update(JSON.stringify(material.toJSON()));
 });}
 return hash.digest('hex');
}
function collisionOwners(){
 return new Map([...new Set([...game.colliders.map(c=>c.mesh),...game.cameraBlockers,...game.aimBlockers,...game.portalPanels])].map(mesh=>[mesh,{
  geometry:mesh.geometry,parent:mesh.parent,children:mesh.children.slice(),visible:mesh.visible,
  matrix:mesh.matrix.clone(),bounds:new THREE.Box3().setFromObject(mesh),
 }]));
}
function followers(art){
 art.updateWorldMatrix(true,true);const actual=M(),world=M(),expected=M(),vertex=V();
 for(const owner of art.mounts){
  owner.target.updateWorldMatrix(true,false);
  for(const part of owner.parts){
   part.mesh.getMatrixAt(part.index,actual);world.multiplyMatrices(art.matrixWorld,actual);expected.multiplyMatrices(owner.target.matrixWorld,part.matrix);
   for(let n=0;n<16;n++)assert.ok(Math.abs(world.elements[n]-expected.elements[n])<.00002,`${owner.name}: follower lost its actual source matrix`);
   assert.ok(owner.bounds.clone().expandByScalar(.00001).containsBox(part.bounds));
   if(owner.cylindrical||owner.roundedRadius)for(let n=0;n<part.mesh.geometry.attributes.position.count;n++){
    vertex.fromBufferAttribute(part.mesh.geometry.attributes.position,n).applyMatrix4(part.matrix);
    if(owner.cylindrical){
     assert.ok(Math.hypot(vertex.x,vertex.z)<=owner.radius+.00001,'A manufactured corner escaped the actual round casting');
     assert.ok(Math.abs(vertex.y)<=owner.height/2+.00001);
    }
    if(owner.roundedRadius){
     const radius=owner.roundedRadius,center=owner.bounds.getCenter(V()),half=owner.bounds.getSize(V()).multiplyScalar(.5).subScalar(radius);
     const excess=Math.hypot(Math.max(0,Math.abs(vertex.x-center.x)-half.x),Math.max(0,Math.abs(vertex.y-center.y)-half.y),Math.max(0,Math.abs(vertex.z-center.z)-half.z));
     assert.ok(excess<=radius+.00001,'A thermal facade corner escaped its authored rounded-box envelope');
    }
   }
  }
 }
}

for(const index of [34,38])test(`room ${index+1}: manufactured optics models preserve original closed owners, physics and supplied GLB buffers`,async()=>{
 const level=await bare(index),before=gameplayContract(game),owners=collisionOwners(),assets=assetDigest(),workload=sceneWorkload(game);
 const bodies=game.physics.world.bodies.slice(),shapes=bodies.map(body=>body.shapes.slice()),constraints=game.physics.world.constraints.slice();
 const portals=game.portalPanels.map(mesh=>[mesh,mesh.material]);
 installOpticsArt(game,level);const art=level.opticsArt;
 assert.equal(art.userData.revision,OPTICS_ART_REVISION);assert.equal(art.mounts.length,2);
 assert.deepEqual(gameplayContract(game),before,'Visual machinery changed an actual collision, aim, portal, interaction or mechanism owner');
 assert.deepEqual(game.physics.world.bodies,bodies);assert.deepEqual(game.physics.world.constraints,constraints);
 for(let n=0;n<bodies.length;n++)assert.deepEqual(bodies[n].shapes,shapes[n]);
 for(const [mesh,snapshot]of owners){
  assert.equal(mesh.geometry,snapshot.geometry);assert.equal(mesh.parent,snapshot.parent);assert.equal(mesh.visible,snapshot.visible);
  assert.deepEqual(mesh.children,snapshot.children);assert.deepEqual(mesh.matrix,snapshot.matrix);assert.deepEqual(new THREE.Box3().setFromObject(mesh),snapshot.bounds);
 }
 for(const [mesh,material]of portals)assert.equal(mesh.material,material);
 assert.equal(assetDigest(),assets);
 assert.equal(art.userData.stats.extraLights,0);assert.equal(art.userData.stats.extraColliders,0);assert.equal(art.userData.stats.independentClocks,0);
 assert.ok(art.userData.stats.parts>=30&&art.userData.stats.parts<=180);assert.ok(art.userData.stats.batches<=4);
 assert.equal(sceneWorkload(game).lights,workload.lights);followers(art);
 const count=level.world.root.children.length;installOpticsArt(game,level);assert.equal(level.opticsArt,art);assert.equal(level.world.root.children.length,count);
});

test('room35 receivers show the real drive position, current airflow and retained latch without a private clock',async()=>{
 const level=await bare(34);installOpticsArt(game,level);const art=level.opticsArt;
 // Declared component stimuli test visual state coupling; this does not claim
 // to be an ordinary player route or a new source of mechanical power.
 level.first.progress=.65;level.second.progress=.25;level.powered()[0]=true;
 level.renderUpdate(.3);
 assert.equal(art.readouts[0].rotor.rotation.z,.65*Math.PI*1.5);assert.equal(art.readouts[1].rotor.rotation.z,.25*Math.PI*1.5);
 assert.equal(art.readouts[0].material.color.getHex(),0x9ce7ed);assert.equal(art.readouts[1].material.color.getHex(),0x354e59);
 const positions=art.readouts.map(r=>r.rotor.rotation.z),matrices=art.children.map(mesh=>Array.from(mesh.instanceMatrix.array));
 level.renderUpdate(.3);assert.deepEqual(art.readouts.map(r=>r.rotor.rotation.z),positions);assert.deepEqual(art.children.map(mesh=>Array.from(mesh.instanceMatrix.array)),matrices);
 level.first.progress=.95;level.terminals.find(t=>t.kind==='first-latch').action();level.powered()[0]=false;level.renderUpdate(.6);
 assert.equal(level.isFirstLatched(),true);assert.equal(art.readouts[0].material.color.getHex(),0xe3b577);
 assert.equal(art.readouts[0].rotor.rotation.z,.95*Math.PI*1.5);
 level.reset();level.renderUpdate(.3);assert.ok(art.readouts.every(r=>r.rotor.rotation.z===0&&r.material.color.getHex()===0x354e59));
});

test('thermal models follow full moving source matrices while the original heat bar, expanding rod and pointer remain intact',async()=>{
 const level=await bare(38),names=['Thermal energy thermometer','Continuously expanding thermal rod','Thermal expansion pointer'];
 const originals=names.map(name=>level.world.root.getObjectByName(name)),snapshots=originals.map(mesh=>({geometry:mesh.geometry,material:mesh.material,parent:mesh.parent,children:mesh.children.slice(),matrix:mesh.matrix.clone()}));
 installOpticsArt(game,level);const art=level.opticsArt,target=level.first.mesh;
 assert.ok(art.mounts.every(owner=>owner.roundedRadius===.08),'Thermal facade keeps the authored rounded-box envelope guard');
 const old={position:target.position.clone(),quaternion:target.quaternion.clone(),scale:target.scale.clone()};
 target.position.add(V(1.1,3.4,-.5));target.quaternion.setFromAxisAngle(V(0,1,0),.37);target.scale.set(.92,1.04,.84);level.renderUpdate(.4);followers(art);
 const matrices=art.children.map(mesh=>Array.from(mesh.instanceMatrix.array));level.renderUpdate(.4);assert.deepEqual(art.children.map(mesh=>Array.from(mesh.instanceMatrix.array)),matrices);
 for(let n=0;n<originals.length;n++){const mesh=originals[n],snapshot=snapshots[n];assert.equal(mesh.geometry,snapshot.geometry);assert.equal(mesh.material,snapshot.material);assert.equal(mesh.parent,snapshot.parent);assert.deepEqual(mesh.children,snapshot.children);assert.deepEqual(mesh.matrix,snapshot.matrix);}
 target.position.copy(old.position);target.quaternion.copy(old.quaternion);target.scale.copy(old.scale);target.updateWorldMatrix(true,true);
});

test('optics art release restores source materials and releases only its owned GPU resources once',async()=>{
 const level=await bare(34),oldRender=level.renderUpdate,oldReset=level.reset,oldDispose=level.dispose;
 installOpticsArt(game,level);const art=level.opticsArt,resources=new Map(art.ownedResources.map(resource=>[resource,0]));
 for(const resource of resources.keys())resource.addEventListener('dispose',()=>resources.set(resource,resources.get(resource)+1));
 art.dispose();art.dispose();assert.equal(level.opticsArt,undefined);assert.equal(art.parent,null);assert.equal(art.children.length,0);
 assert.equal(level.renderUpdate,oldRender);assert.equal(level.reset,oldReset);assert.equal(level.dispose,oldDispose);assert.ok([...resources.values()].every(count=>count===1));
});

test('authored rooms33/34/36/37/38 retain their original authored presentation',async()=>{
 for(const index of [32,33,35,36,37]){
  const level=await bare(index),children=level.world.root.children.slice();installOpticsArt(game,level);
  assert.equal(level.opticsArt,undefined);assert.deepEqual(level.world.root.children,children);
 }
});
