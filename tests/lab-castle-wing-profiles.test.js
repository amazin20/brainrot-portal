import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {CASTLE_WING_ARCHITECTURE,castleArcadeGeometry,buildCastleGrandArchitecture} from '../src/game/LabCastleGrandArchitecture.js';
import {SingularityKit} from '../src/game/LabSingularityKit.js';

const V=(...p)=>new THREE.Vector3(...p);
const wings=Object.keys(CASTLE_WING_ARCHITECTURE);
function digest(geometry){const p=geometry.attributes.position.array;return createHash('sha256').update(Buffer.from(p.buffer,p.byteOffset,p.byteLength)).digest('hex');}

for(const wing of wings)test(`castle ${wing}: large wall and ceiling fields remain closed inside all original contact planes`,()=>{
 for(const [size,roof]of[[[32,6.8,.5],false],[[.5,15,36],false],[[6.8,2.4,.5],false],[[34.7,.5,36.7],true]]){
  const geometry=castleArcadeGeometry(size,{wing,roof}),p=geometry.attributes.position,n=geometry.attributes.normal;
  assert.deepEqual(geometry.boundingBox.min.toArray(),[-.5,-.5,-.5]);assert.deepEqual(geometry.boundingBox.max.toArray(),[.5,.5,.5]);
  assert.equal(geometry.userData.castleWingProfile.wing,wing);assert.ok(p.count/3<12000,'Unbounded architectural tessellation');
  let volume=0;const a=V(),b=V(),c=V();
  for(let i=0;i<p.count;i+=3){
   a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);
   assert.ok(a.toArray().concat(b.toArray(),c.toArray()).every(Number.isFinite));
   assert.ok(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq()>1e-20,'Degenerate carved face');
   volume+=a.dot(b.clone().cross(c))/6;
  }
  assert.ok(volume>.25&&volume<1.0001,`Invalid closed architectural volume ${volume}`);
  for(let i=0;i<n.count;i++)assert.ok(Math.abs(V().fromBufferAttribute(n,i).length()-1)<1e-6);
  const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.updateMatrixWorld(true);
  const axis=roof?1:size[0]<size[2]?0:2,others=[0,1,2].filter(a=>a!==axis);
  for(let i=0;i<90;i++){
   const origin=V(),direction=V();origin.setComponent(axis,1);direction.setComponent(axis,-1);
   origin.setComponent(others[0],-.473+(i*.137131%.946));origin.setComponent(others[1],-.451+(i*.217733%.902));
   const hits=new THREE.Raycaster(origin,direction,0,2).intersectObject(mesh,false);
   assert.equal(hits.length,2,`${wing}/${size}: ray${i} crossed a hole or overlapping skin (${hits.length} hits)`);
   assert.ok(hits[1].distance-hits[0].distance>.35,'A recess erased the continuous closed core');
  }
  mesh.material.dispose();geometry.dispose();
 }
});

test('all twelve wings have distinct large geometry with one identical comparison palette',()=>{
 assert.equal(wings.length,12);
 for(const roof of[false,true]){
  const hashes=new Set();for(const wing of wings){const g=castleArcadeGeometry(roof?[34,.5,36]:[36,15,.5],{wing,roof});hashes.add(digest(g));g.dispose();}
  assert.equal(hashes.size,12,'Room distinction must exist in geometry, not only in labels or vertex colour');
 }
});

test('common exterior and non-wing ceiling retain their established geometry',()=>{
 for(const [size,options]of[[[166,114,1.2],{exterior:true}],[[34.7,.5,36.7],{roof:true}]]){
  const a=castleArcadeGeometry(size,options),b=castleArcadeGeometry(size,{...options,wing:options.exterior?'freight':null});
  assert.equal(digest(a),digest(b));assert.equal(a.userData.castleWingProfile,null);a.dispose();b.dispose();
 }
});

test('profile installation preserves every existing owner and assigns only the twelve exact room ceilings',()=>{
 const game={elapsed:0,scene:new THREE.Scene(),colliders:[],floors:[],aimBlockers:[],cameraBlockers:[],portalPanels:[]};
 const k=new SingularityKit(game),rooms=new Map(),walls=[],ceilings=[];
 for(const [index,id]of wings.entries()){
  const x=index*50,def={id,at:[x,0,0],w:32,d:36,h:26};rooms.set(id,{def,b:{x0:x-16,x1:x+16,z0:-18,z1:18}});
  const wall=k.box([x,3.4,0],[32,6.8,.5],k.mat(0x879997));wall.material.name='Castle wing wall / '+id;wall.userData.castlePerimeterCoffer=true;walls.push(wall);
  const roof=k.box([x,26.25,0],[32.7,.5,36.7],k.m.dark);roof.userData.castleRoofFinish=true;ceilings.push(roof);
 }
 const common=k.box([0,40,100],[34,.5,36],k.m.dark);common.userData.castleRoofFinish=true;
 const originals=k.static.map(mesh=>({mesh,parent:mesh.parent,children:mesh.children.slice(),matrix:mesh.matrixWorld.clone(),collider:mesh.userData.collider,bounds:mesh.userData.collider.box.clone()}));
 const registries=[game.colliders,game.floors,game.aimBlockers,game.cameraBlockers,game.portalPanels].map(list=>list.slice());
 const art=buildCastleGrandArchitecture({game,k,rooms,solved:new Set()});
 try{
  assert.equal(Object.keys(art.stats.wingProfiles).length,12);assert.equal(Object.keys(art.stats.roofProfiles).length,12);
  assert.equal(art.stats.roofSlabs,13);assert.equal(common.geometry.userData.castleWingProfile,null);
  for(const [index,mesh]of ceilings.entries())assert.equal(mesh.geometry.userData.castleWingProfile.wing,wings[index]);
  for(const record of originals){
   assert.equal(record.mesh.parent,record.parent);assert.deepEqual(record.mesh.children,record.children);assert.deepEqual(record.mesh.matrixWorld,record.matrix);
   assert.equal(record.mesh.userData.collider,record.collider);assert.deepEqual(record.collider.box,record.bounds);
   assert.deepEqual(new THREE.Box3().setFromObject(record.mesh),record.bounds);
  }
  for(const [index,list]of[game.colliders,game.floors,game.aimBlockers,game.cameraBlockers,game.portalPanels].entries())assert.deepEqual(list,registries[index]);
  assert.equal(art.stats.newColliders+art.stats.newLights,0);assert.ok(art.stats.triangles<90000);
 }finally{k.dispose();}
});
