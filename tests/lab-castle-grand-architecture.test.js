import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {castleArcadeGeometry,castlePierGeometry,buildCastleGrandArchitecture} from '../src/game/LabCastleGrandArchitecture.js';
import {SingularityKit} from '../src/game/LabSingularityKit.js';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {ACTIVE_FOUNDATION_RUNTIME_FLAGS} from '../src/game/ReleaseIdentity.js';
import {castleContractHash} from './helpers/castle-building-contract.js';
import {disposeLabLevel} from '../src/game/LabLevelLifecycle.js';
const V=(...p)=>new THREE.Vector3(...p);
export const ORIGINAL_CASTLE_CONTRACT='4887f49f5792fa17edc32cd049ea425002b39a47d7bb155c60f841f9be412c44';

for(const [size,options]of [ [[32,6.8,.5],{}], [[.5,15,36],{}], [[6.8,8,.5],{}], [[.5,2.4,9],{}], [[166,114,1.2],{exterior:true}], [[34.7,.5,36.7],{roof:true}] ]){
 test(`Carved original envelope ${size}: finite closed faces, no coincident interior skin`,()=>{
  const geo=castleArcadeGeometry(size,options),p=geo.attributes.position,n=geo.attributes.normal;
  assert.deepEqual(geo.boundingBox.min.toArray(),[-.5,-.5,-.5]);assert.deepEqual(geo.boundingBox.max.toArray(),[.5,.5,.5]);
  const a=V(),b=V(),c=V();let volume=0;
  for(let i=0;i<p.count;i+=3){a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);assert.ok(a.clone().sub(b).cross(c.clone().sub(b)).lengthSq()>1e-20,'Degenerate carved face');volume+=a.dot(b.clone().cross(c))/6;}
  assert.ok(volume>.25&&volume<1.0001,`Bad closed volume ${volume}`);
  for(let i=0;i<n.count;i++)assert.ok(Math.abs(V().fromBufferAttribute(n,i).length()-1)<1e-6);
  const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.updateMatrixWorld(true);
  const axis=options.roof?1:size[0]<size[2]?0:2,others=[0,1,2].filter(a=>a!==axis);
  for(let i=0;i<45;i++){
   const origin=V(),direction=V();origin.setComponent(axis,1);direction.setComponent(axis,-1);
   origin.setComponent(others[0],-.47+(i*.137131% .94));
   // Avoid testing exactly on the shared diagonal of the flat back cap.
   // Three reports both adjacent triangles for an exact edge hit, not two skins.
   origin.setComponent(others[1],-.451+(i*.217733% .90));
   const hits=new THREE.Raycaster(origin,direction,0,2).intersectObject(mesh,false);
   assert.equal(hits.length,2,`Ray ${i} saw a hole or a second coplanar skin: ${hits.length}`);assert.ok(hits[1].distance-hits[0].distance>.35);
  }
  mesh.material.dispose();geo.dispose();
 });
}

test('Load piers retain both ends, full collars and nondegenerate chamfers',()=>{
 const geo=castlePierGeometry([2.2,112,2.2]),p=geo.attributes.position;
 assert.deepEqual(geo.boundingBox.min.toArray(),[-.5,-.5,-.5]);assert.deepEqual(geo.boundingBox.max.toArray(),[.5,.5,.5]);
 for(let i=0;i<p.count;i+=3){const a=V().fromBufferAttribute(p,i),b=V().fromBufferAttribute(p,i+1),c=V().fromBufferAttribute(p,i+2);assert.ok(b.sub(a).cross(c.sub(a)).lengthSq()>1e-20);}
 const values=Array.from({length:p.count},(_,i)=>Math.abs(p.getX(i)));assert.ok(values.some(n=>n<.49&&n>.43));geo.dispose();
});

function fixture(){
 const game={elapsed:0,scene:new THREE.Scene(),colliders:[],floors:[],aimBlockers:[],cameraBlockers:[],portalPanels:[]};const k=new SingularityKit(game);
 const wall=k.box([0,3.4,0],[32,6.8,.5],k.m.wall);wall.userData.castlePerimeterCoffer=true;wall.material.name='Castle wing wall / freight';
 const solved=new Set(),art=buildCastleGrandArchitecture({game,k,rooms:new Map(),solved});return{game,k,wall,solved,art};
}

test('Wing reaction reads real completion state and simulation time, independent of render rate',()=>{
 const sample=fps=>{const f=fixture();f.solved.add('freight');for(let i=1;i<=fps;i++){f.game.elapsed=i/fps;f.art.update();}const v=f.art.powers.get('freight');f.k.dispose();return v;};
 assert.ok(Math.abs(sample(30)-sample(60))<1e-9);assert.ok(Math.abs(sample(144)-sample(60))<1e-9);
 const f=fixture();f.game.elapsed=1;f.art.update();assert.equal(f.art.powers.get('freight'),0);
 f.solved.add('freight');f.game.elapsed=1.1;f.art.update();const value=f.art.powers.get('freight');assert.ok(value>0);
 for(let i=0;i<60;i++)f.art.update();assert.equal(f.art.powers.get('freight'),value,'Paused rendering advanced the state');
 f.solved.clear();f.game.elapsed=0;f.art.update();assert.equal(f.art.powers.get('freight'),0);assert.equal(f.art.wingMaterials.get('freight').emissiveIntensity,0);
 f.k.dispose();
});

test('New geometry and materials install once and remain owned by the original level lifetime',()=>{
 const f=fixture(),resources=[...f.k.geometries,...f.k.materials],counts=new Map(resources.map(o=>[o,0]));
 for(const o of resources)o.addEventListener('dispose',()=>counts.set(o,counts.get(o)+1));
 assert.equal(buildCastleGrandArchitecture({game:f.game,k:f.k,rooms:new Map(),solved:f.solved}),f.art);
 f.art.dispose();f.art.dispose();assert.ok(f.art.disposed);assert.ok([...counts.values()].every(n=>n===0));f.k.dispose();assert.ok([...counts.values()].every(n=>n===1));
});

test('The complete castle keeps every original collider, floor, portal, control, body and starting state',async()=>{
 const g=await createHeadlessGame();Object.assign(g,{chamberEdition:'foundation',...ACTIVE_FOUNDATION_RUNTIME_FLAGS});
 const assets=[];for(const a of g.assets.values())a.traverse(n=>{if(n.isMesh)assets.push([n,n.geometry,n.material]);});
 try{
  await g.selectLevel(40,true);assert.equal(castleContractHash(g),ORIGINAL_CASTLE_CONTRACT);
  const stats=g.firstLevel.structure.userData.castleGrandArchitecture.stats;assert.deepEqual([stats.exteriorWalls,stats.wingSlabs,stats.roofSlabs,stats.piers],[4,109,13,16]);assert.ok(stats.triangles<185000);assert.equal(stats.newColliders+stats.newLights,0);
  let count=0;g.firstLevel.structure.traverse(mesh=>{if(!mesh.userData.castleGrandFinish)return;count++;const c=mesh.userData.collider,b=new THREE.Box3().setFromObject(mesh);assert.ok(b.equals(c.box),'Rendered envelope differs from its original body');assert.equal(g.colliders.filter(x=>x.mesh===mesh).length,1);assert.equal(g.cameraBlockers.filter(x=>x===mesh).length,1);assert.equal(g.aimBlockers.filter(x=>x===mesh).length,1);});assert.equal(count,142);
  for(const [n,geo,mat]of assets){assert.equal(n.geometry,geo);assert.equal(n.material,mat);}
 }finally{disposeLabLevel(g);}
});
