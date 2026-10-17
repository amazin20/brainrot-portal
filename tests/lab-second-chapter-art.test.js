import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {LabGame} from '../src/game/LabGame.js';
import {LabPhysics} from '../src/game/LabPhysics.js';
import {LabPortals} from '../src/game/LabPortals.js';
import {disposeLabLevel} from '../src/game/LabLevelLifecycle.js';
import {buildRoom12} from '../src/game/LabPortalRoom12.js';
import {buildRoom13} from '../src/game/LabPortalRoom13.js';
import {buildRoom14} from '../src/game/LabPortalRoom14.js';
import {buildRoom15} from '../src/game/LabPortalRoom15.js';
import {installSecondChapterArt,SECOND_CHAPTER_ART_REVISION} from '../src/game/LabSecondChapterArt.js';
import {gameplayContract} from './helpers/lab-art-contract.js';

const game=await createHeadlessGame();game.chamberEdition='foundation';
after(()=>{game.firstLevel?.dispose?.();game.physics?.dispose();game.portals?.dispose();});
const V=(...p)=>new THREE.Vector3(...p),M=()=>new THREE.Matrix4();
const bytes=array=>Buffer.from(array.buffer,array.byteOffset,array.byteLength);
function assetBuffers(){
 const hash=createHash('sha256');
 for(const [id,root]of game.assets){hash.update(String(id));root.traverse(node=>{
  if(!node.isMesh)return;
  for(const key of Object.keys(node.geometry.attributes).sort())hash.update(key).update(bytes(node.geometry.attributes[key].array));
  if(node.geometry.index)hash.update(bytes(node.geometry.index.array));
 });}
 return hash.digest('hex');
}
function originalMaterials(){
 const hash=createHash('sha256');for(const [id,root]of game.assets){hash.update(String(id));root.traverse(node=>{
  for(const material of Array.isArray(node.material)?node.material:[node.material])if(material)hash.update(JSON.stringify(material.toJSON()));
 });}return hash.digest('hex');
}
async function bare(index){
 await game.selectLevel(index,true);const l=game.firstLevel;l.secondChapterArt?.dispose();return l;
}
function rayDistances(mesh){
 const bounds=mesh.geometry.boundingBox??(mesh.geometry.computeBoundingBox(),mesh.geometry.boundingBox),center=bounds.getCenter(V()),radius=bounds.getSize(V()).length()+1,result=[];
 mesh.updateWorldMatrix(true,true);
 for(const axis of [V(1,0,0),V(0,1,0),V(0,0,1)])for(const sign of [-1,1]){
  const origin=center.clone().addScaledVector(axis,radius*sign).applyMatrix4(mesh.matrixWorld),target=center.clone().applyMatrix4(mesh.matrixWorld);
  const caster=new THREE.Raycaster(origin,target.sub(origin).normalize());
  result.push(caster.intersectObject(mesh,true).map(hit=>Math.round(hit.distance*1e8)/1e8));
 }return result;
}
function assertFollower(art){
 art.updateWorldMatrix(true,true);const actual=M(),expected=M(),world=M();
 for(const owner of art.mounts){
  owner.target.updateWorldMatrix(true,false);
  for(const entry of owner.parts){
   entry.mesh.getMatrixAt(entry.index,actual);world.multiplyMatrices(art.matrixWorld,actual);expected.multiplyMatrices(owner.target.matrixWorld,entry.matrix);
   for(let n=0;n<16;n++)assert.ok(Math.abs(world.elements[n]-expected.elements[n])<.00002,`${owner.name} detached from actual pose at element ${n}`);
   assert.ok(owner.bounds.clone().expandByScalar(.00001).containsBox(entry.bounds),`${owner.name} escaped original volume`);
  }
 }
}

for(let index=10;index<20;index++)test(`room ${index+1}: manufactured models preserve actual physics, aim targets, source buffers and working geometry`,async()=>{
 const l=await bare(index),before=gameplayContract(game),assetHash=assetBuffers(),materialHash=originalMaterials();
 const bodies=game.physics.world.bodies.slice(),shapes=bodies.map(body=>body.shapes.slice()),geometry=new Map(),children=new Map(),raycasts=new Map();
 for(const collider of game.colliders){geometry.set(collider.mesh,collider.mesh.geometry);children.set(collider.mesh,collider.mesh.children.slice());raycasts.set(collider.mesh,rayDistances(collider.mesh));}
 installSecondChapterArt(game,l);const art=l.secondChapterArt;
 assert.ok(art);assert.equal(art.userData.revision,SECOND_CHAPTER_ART_REVISION);
 assert.equal(art.userData.stats.extraColliders,0);assert.equal(art.userData.stats.extraLights,0);assert.equal(art.userData.stats.independentClocks,0);
 assert.ok(art.userData.stats.chassis+art.userData.stats.pedestals>=1);
 assert.ok(art.userData.stats.parts>=12&&art.userData.stats.parts<=320);assert.equal(art.userData.stats.batches,3);
 assert.deepEqual(gameplayContract(game),before,'Manufactured coat changed physical registry, current state, ray target or interaction frame');
 assert.deepEqual(game.physics.world.bodies,bodies);
 for(let n=0;n<bodies.length;n++)assert.deepEqual(bodies[n].shapes,shapes[n]);
 for(const [mesh,old]of geometry){assert.equal(mesh.geometry,old);assert.deepEqual(mesh.children,children.get(mesh));assert.deepEqual(rayDistances(mesh),raycasts.get(mesh));}
 assert.equal(assetBuffers(),assetHash,'A supplied GLB vertex/index buffer changed');assert.equal(originalMaterials(),materialHash,'A supplied GLB master material changed');
 assertFollower(art);
 const count=l.world.root.children.length;installSecondChapterArt(game,l);assert.equal(l.world.root.children.length,count);assert.equal(l.secondChapterArt,art);
});

test('a new presentation survives real updates and preserves room 18 and 20 live physical ownership',async()=>{
 for(const index of [10,13,15,16,17,18,19]){
  const l=await bare(index);installSecondChapterArt(game,l);const art=l.secondChapterArt;
  const initialBounds=art.mounts.map(m=>new THREE.Box3().setFromObject(m.target));
  for(let step=0;step<45;step++)game.updatePlaying(1/120);
  l.renderUpdate(.37);assertFollower(art);
  // The same current source subtrees determine collider bounds. No render
  // descendant was added to a measured device, door, leaf or load beam.
  for(const owner of art.mounts){
   const oldBox=owner.bounds.clone().applyMatrix4(owner.target.matrixWorld);
   const measured=new THREE.Box3().setFromObject(owner.target);
   assert.ok(measured.containsBox(oldBox.clone().expandByScalar(-.00001)));
  }
  if(index===17){assert.ok(l.circuit.owner===game.physics);assert.ok(l.electrodes.every(e=>e.body.world===game.physics.world));}
  if(index===19){assert.equal(l.nearHook.liveOwnership().valid,true);assert.equal(l.stopFinger.diagnostics().liveOwnership,true);}
  assert.equal(initialBounds.length,art.mounts.length);
 }
});

test('moving render attachments use the current full source matrix and never advance a private clock',async()=>{
 const l=await bare(19);installSecondChapterArt(game,l);const art=l.secondChapterArt;
 const owner=art.mounts[0],originalMatrix=owner.target.matrix.clone(),position=owner.target.position.clone(),rotation=owner.target.quaternion.clone(),scale=owner.target.scale.clone();
 // Explicit render fixture, not a traversal or physics proof: arbitrary
 // translated/rotated/scaled source matrices expose accidental world/local
 // mixing, cached rest poses and translation-only followers.
 owner.target.position.add(V(1.7,.4,-.3));owner.target.quaternion.setFromAxisAngle(V(0,1,0),.41);owner.target.scale.set(.9,1.1,.95);
 l.renderUpdate(.5);assertFollower(art);
 const captured=art.children.map(mesh=>Array.from(mesh.instanceMatrix.array));l.renderUpdate(.5);
 assert.deepEqual(art.children.map(mesh=>Array.from(mesh.instanceMatrix.array)),captured,'Render alone advanced an autonomous animation');
 owner.target.position.copy(position);owner.target.quaternion.copy(rotation);owner.target.scale.copy(scale);owner.target.matrix.copy(originalMatrix);owner.target.updateWorldMatrix(true,true);l.renderUpdate(1);
});

test('art release restores original local materials and owns every GPU resource exactly once',async()=>{
 const l=await bare(17),oldRender=l.renderUpdate,oldReset=l.reset,oldDispose=l.dispose;
 const material=l.door.mesh.material,children=l.door.mesh.children.slice();installSecondChapterArt(game,l);const art=l.secondChapterArt;
 const resources=new Map(art.ownedResources.map(resource=>[resource,0]));
 for(const resource of resources.keys())resource.addEventListener('dispose',()=>resources.set(resource,resources.get(resource)+1));
 assert.notEqual(l.door.mesh.material,material);assert.equal(l.door.mesh.material.visible,false);
 art.dispose();art.dispose();assert.equal(l.secondChapterArt,undefined);assert.equal(art.parent,null);assert.equal(art.children.length,0);
 assert.equal(l.door.mesh.material,material);assert.deepEqual(l.door.mesh.children,children);assert.equal(l.renderUpdate,oldRender);assert.equal(l.reset,oldReset);assert.equal(l.dispose,oldDispose);
 assert.ok([...resources.values()].every(count=>count===1));
 l.renderUpdate(.3);assert.ok([...resources.values()].every(count=>count===1));
});

test('other chapters and editions receive no second-chapter render layer',async()=>{
 const l=await bare(9),count=l.world.root.children.length;installSecondChapterArt(game,l);assert.equal(l.secondChapterArt,undefined);assert.equal(l.world.root.children.length,count);
 const oldEdition=game.chamberEdition;game.chamberEdition='open';l.index=10;installSecondChapterArt(game,l);assert.equal(l.secondChapterArt,undefined);l.index=9;game.chamberEdition=oldEdition;
});

function pairedRawRoom(room){
 const g=new LabGame({container:null,touch:false});g.chamberEdition='foundation';g.assets=game.assets;g.levelIndex=room-1;
 g.scene=new THREE.Scene();g.camera=game.camera.clone();g.materials=Object.fromEntries(Object.entries(game.materials).map(([key,mat])=>[key,mat.clone()]));
 g.audio=game.audio;g.label=()=>new THREE.Object3D();g.cargo={position:V(100,100,100),velocity:V(),quaternion:new THREE.Quaternion()};
 g.portals=new LabPortals({scene:g.scene,camera:g.camera,renderer:null,maxResolution:64,samples:0});
 const level=[buildRoom12,buildRoom13,buildRoom14,buildRoom15][room-12](g,room-1);g.firstLevel=level;
 g.playerPosition.fromArray(level.spawn);g.previousPlayerPosition.copy(g.playerPosition);g.cargo.position.fromArray(level.cargoSpawn);g.playerGrounded=false;
 g.physics=new LabPhysics({fixedStep:1/120});
 for(const c of g.colliders)g.physics.addStaticBox(c.mesh.uuid,c.box,{kinematic:!!c.kinematic,enabled:c.enabled!==false});
 g.physics.createCargo({position:g.cargo.position,size:.78,mass:3.2});level.reset();g.levelRoots=[...g.scene.children];return g;
}
function routePair(g,a,b){for(const [index,name]of [a,b].entries()){const f=g.firstLevel.panels[name].getFrame();g.portals.place(index,f.center,f.normal,f.up);}}
function stimulate(g,room,frame){
 const l=g.firstLevel;
 if(frame===0){
  if(room===12)routePair(g,'shared-drop','final');
  if(room===13)routePair(g,'light-intake','light-output');
  if(room===14)routePair(g,'light-source','weave-west');
  if(room===15)routePair(g,'intake','freight');
 }
 // Explicit equal fixtures exercise the real weight/beam/field mechanisms;
 // these are physics regression probes, not ordinary-player movie evidence.
 if(room===13)g.cargo.position.copy(frame<100?l.panels['mirror-cradle'].getFrame().center.clone().add(V(0,.39,0)):V(100,100,100));
 if(room===14){const at=l.state.counterweightStair.island.center;g.cargo.position.copy(frame<100?at.clone().add(V(0,.39,0)):V(100,100,100));if(frame===100)routePair(g,'light-source','weave-north');}
 if(room===15){l.state.funnel.reversed=frame>=80;l.state.funnel.enabled=frame<190;if(frame===140)routePair(g,'intake','lift');}
 l.update(1/60);l.renderUpdate((frame%5)/4);
}
for(const room of [12,13,14,15])test(`liked room ${room}: actual mirror, lift, stair and field mechanics remain equal during activation, rerouting and release`,()=>{
 const baseline=pairedRawRoom(room),upgraded=pairedRawRoom(room);
 try{
  assert.deepEqual(gameplayContract(upgraded),gameplayContract(baseline));installSecondChapterArt(upgraded,upgraded.firstLevel);
  assert.deepEqual(gameplayContract(upgraded),gameplayContract(baseline));let observedMotion=false;
  for(let frame=0;frame<240;frame++){
   stimulate(baseline,room,frame);stimulate(upgraded,room,frame);
   if(frame%30===0||frame===239)assert.deepEqual(gameplayContract(upgraded),gameplayContract(baseline),`Mechanics diverged at frame ${frame}`);
   if(room===13)observedMotion ||= baseline.firstLevel.state['north-cage'].progress>0||baseline.firstLevel.state['south-cage'].progress>0;
   if(room===14)observedMotion ||= baseline.firstLevel.state.counterweightStair.offset> -7.1;
   if(room===15)observedMotion ||= baseline.firstLevel.state.funnel.segments.length>1;
  }
  if(room>12)assert.ok(observedMotion,'Must exercise the actual powered/moving mechanism');
 }finally{disposeLabLevel(baseline);disposeLabLevel(upgraded);}
});

test('normal repeated level disposal invokes the earlier mechanism owner once',async()=>{
 const l=await bare(17),previous=l.dispose;let calls=0;l.dispose=function(...args){calls++;return previous?.apply(this,args);};
 installSecondChapterArt(game,l);const art=l.secondChapterArt,resources=new Map(art.ownedResources.map(resource=>[resource,0]));
 for(const resource of resources.keys())resource.addEventListener('dispose',()=>resources.set(resource,resources.get(resource)+1));
 l.dispose();l.dispose();assert.equal(calls,1);assert.ok([...resources.values()].every(count=>count===1));
});
