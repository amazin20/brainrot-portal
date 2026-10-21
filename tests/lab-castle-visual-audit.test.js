import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {SingularityKit} from '../src/game/LabSingularityKit.js';
import {SINGULARITY_ROOMS} from '../src/game/LabSingularityLayout.js';
import {castleMachineCasingGeometry,buildCastleAuditConstruction,finishVisualAuditCastle} from '../src/game/LabVisualAuditCastle.js';
const V=(...p)=>new THREE.Vector3(...p);

test('closed castle casings retain exact original bounds and finite normals at every equipment orientation',()=>{
 for(const size of [[.6,9.4,21],[17,9.4,.6],[12,.4,4],[.24,24.4,.24]])for(const axis of ['x','y','z']){
  const geometry=castleMachineCasingGeometry(size,{axis,bays:3});
  for(const v of [...geometry.attributes.position.array,...geometry.attributes.normal.array])assert.ok(Number.isFinite(v));
  assert.deepEqual(geometry.boundingBox.min.toArray(),[-.5,-.5,-.5]);assert.deepEqual(geometry.boundingBox.max.toArray(),[.5,.5,.5]);
  if(axis==='y')for(let i=0;i<geometry.attributes.position.count;i++)if(geometry.attributes.normal.getY(i)>.9)
   assert.equal(geometry.attributes.position.getY(i),.5,'moving walking face was recessed below its real contact plane');
  geometry.dispose();
 }
 assert.throws(()=>castleMachineCasingGeometry([1,0,2]),RangeError);
});

test('all twelve castle wings gain finish while contacts, portal identities and moving box bounds remain unchanged',()=>{
 const game={scene:new THREE.Scene(),colliders:[],floors:[],cameraBlockers:[],aimBlockers:[],portalPanels:[]};
 const k=new SingularityKit(game),rooms=new Map(),machines=new Map(),panels=[];
 for(const def of SINGULARITY_ROOMS){
  const [x,y,z]=def.at,b={x0:x-def.w/2,x1:x+def.w/2,z0:z-def.d/2,z1:z+def.d/2};
  rooms.set(def.id,{def,b});
  const mesh=k.box([x,y+3,z],[8,6,.6],k.m.steel,{dynamic:true});panels.push(mesh);
 }
 const portal=k.box([-43,2.4,45],[4.8,4.8,.24],k.m.ceramic,{dynamic:true});k.panels.push(portal);game.portalPanels.push(portal);
 const crown=rooms.get('crown');machines.set('crown',{state:{contact:[-57,72,39],socket:[-57,72,33]}});
 const registries=Object.fromEntries(['colliders','floors','cameraBlockers','aimBlockers','portalPanels'].map(key=>[key,[...game[key]]]));
 const before=new Map(panels.map(mesh=>[mesh,mesh.userData.collider.box.clone()])),portalGeometry=portal.geometry;
 const result=buildCastleAuditConstruction({game,k,rooms,machines,edges:[]});
 assert.equal(Object.keys(result.sections).length,12);assert.ok(Object.values(result.sections).every(n=>n>0));
 assert.equal(result.extraColliders+result.extraLights+result.perFrameCallbacks,0);assert.equal(result.finaleMeshes,9);
 assert.ok(result.sharedEquipmentFinishes<=3);
 const finale=k.meshes.filter(mesh=>mesh.name.startsWith('Castle finale /'));
 assert.equal(finale.length,9);assert.ok(finale.every(mesh=>mesh.material.transparent&&!mesh.material.depthWrite&&!mesh.userData.collider));
 for(const [key,values]of Object.entries(registries))assert.deepEqual(game[key],values,'changed '+key);
 for(const mesh of panels){k.sync(mesh,0,true);assert.ok(mesh.userData.collider.box.equals(before.get(mesh)),'changed moving contact box');assert.equal(mesh.children.length,0);}
 assert.equal(portal.geometry,portalGeometry);assert.equal(buildCastleAuditConstruction({game,k,rooms,machines}),result);
 const level={tower:true,singularity:true,structure:k.root};assert.equal(finishVisualAuditCastle(game,level,40,[k.root]),level);assert.equal(level.visualAuditCastle,result);
 k.dispose();assert.equal(k.root.parent,null);assert.equal(game.colliders.length,0);
});

test('integral castle work-bay finish does not bridge an authored floor opening',()=>{
 const game={scene:new THREE.Scene(),colliders:[],floors:[],cameraBlockers:[],aimBlockers:[],portalPanels:[]},k=new SingularityKit(game);
 const def=SINGULARITY_ROOMS[0],[x,y,z]=def.at,room={def,b:{x0:x-def.w/2,x1:x+def.w/2,z0:z-def.d/2,z1:z+def.d/2}};
 k.floor(x-16,x-12,z,z+18,y);k.floor(x-8,x-4,z,z+18,y);
 const floors=[...game.floors],colliders=[...game.colliders];
 buildCastleAuditConstruction({game,k,rooms:new Map([[def.id,room]]),machines:new Map(),edges:[]});k.batchFloors();
 const pit=V(x-10,y,z+8),triangle=new THREE.Triangle(),plane=new THREE.Plane(),a=V(),b=V(),c=V();
 for(const mesh of k.root.children.filter(mesh=>mesh.name==='Unioned floors / no coincident tops')){
  const p=mesh.geometry.attributes.position;
  for(let i=0;i<p.count;i+=3){a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);triangle.set(a,b,c);triangle.getPlane(plane);if(Math.abs(plane.distanceToPoint(pit))<1e-6)assert.equal(triangle.containsPoint(pit),false,'visual bay creates a visible floor across the live pit');}
 }
 assert.deepEqual(game.floors,floors);assert.deepEqual(game.colliders,colliders);k.dispose();
});
