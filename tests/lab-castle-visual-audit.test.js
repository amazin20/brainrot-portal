import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {SingularityKit} from '../src/game/LabSingularityKit.js';
import {SINGULARITY_ROOMS} from '../src/game/LabSingularityLayout.js';
import {castleMachineCasingGeometry,buildCastleAuditConstruction,finishVisualAuditCastle} from '../src/game/LabVisualAuditCastle.js';
import {castlePerimeterCofferGeometry} from '../src/game/LabCastleMaterials.js';
const V=(...p)=>new THREE.Vector3(...p);

test('castle coffer frame volumes do not duplicate any exterior coplanar face',()=>{
 for(const size of [[32,6.8,.5],[.5,15,36],[6.8,8,.5],[32,3,.5],[.5,2.4,9]])for(const monumental of [false,true]){
  const geometry=castlePerimeterCofferGeometry(size,{monumental}),p=geometry.attributes.position,faces=[];
  assert.ok(geometry.boundingBox.min.distanceTo(V(-.5,-.5,-.5))<1e-6);assert.ok(geometry.boundingBox.max.distanceTo(V(.5,.5,.5))<1e-6);
  // Each primitive contributes two adjacent triangles per closed box face.
  // Coplanar front/side rectangles must only meet along their boundaries.
  for(let i=0;i<p.count;i+=6)for(let axis=0;axis<3;axis++)for(const side of [-1,1]){
   if(!Array.from({length:6},(_,j)=>i+j).every(j=>Math.abs(p.getComponent(j,axis)-side*.5)<1e-6))continue;
   const bounds=[0,1,2].filter(a=>a!==axis).map(a=>[Math.min(...Array.from({length:6},(_,j)=>p.getComponent(i+j,a))),Math.max(...Array.from({length:6},(_,j)=>p.getComponent(i+j,a)))]);
   faces.push({axis,side,bounds});
  }
  for(let i=0;i<faces.length;i++)for(let j=i+1;j<faces.length;j++){
   const a=faces[i],b=faces[j];if(a.axis!==b.axis||a.side!==b.side)continue;
   assert.ok(a.bounds.some((r,k)=>Math.min(r[1],b.bounds[k][1])-Math.max(r[0],b.bounds[k][0])<1e-6),'coffer overlaps its own external frame');
  }
  geometry.dispose();
 }
});

test('migrant suspension follows the actual carriage without enlarging its physical deck and disposes once',()=>{
 const game={scene:new THREE.Scene(),colliders:[],floors:[],cameraBlockers:[],aimBlockers:[],portalPanels:[]},k=new SingularityKit(game);
 const def=SINGULARITY_ROOMS.find(r=>r.id==='migrant'),[x,y,z]=def.at,room={def,b:{x0:x-def.w/2,x1:x+def.w/2,z0:z-def.d/2,z1:z+def.d/2}};
 const platform=k.floor(x-9,x-3,z-4,z+4,y+3,k.m.ivory,{dynamic:true}),rail=k.decor([x,y+10,z],[30,.4,.5],k.m.copper);
 const before=platform.userData.collider.box.clone(),registries=Object.fromEntries(['colliders','floors','cameraBlockers','aimBlockers','portalPanels'].map(key=>[key,[...game[key]]]));
 const result=buildCastleAuditConstruction({game,k,rooms:new Map([['migrant',room]]),machines:new Map(),edges:[]});
 assert.equal(result.carriageChassis,1);assert.equal(result.carriageSuspensions,4);assert.equal(result.perFrameCallbacks,1);
 k.sync(platform,0,true);assert.ok(platform.userData.collider.box.equals(before));assert.equal(platform.children.length,0);
 for(const [key,values]of Object.entries(registries))assert.deepEqual(game[key],values);
 let renders=0;const initial=platform.position.clone(),level={tower:true,singularity:true,structure:k.root,renderUpdate(){renders++;},reset(){k.move(platform,initial.toArray(),0);},dispose(){k.dispose();}};
 finishVisualAuditCastle(game,level,40,[k.root]);const follower=k.root.userData.castleVisualFollowers[0];
 const assertAnchors=()=>{
  follower.mount.updateWorldMatrix(true,true);
  assert.ok(follower.mount.getWorldScale(V()).distanceTo(V(1,1,1))<1e-9,'metre-authored suspension inherits the deck dimensions as scale');
  for(const anchorX of [-2.65,2.65]){
   for(const side of [-1,1]){
    const lower=V(anchorX,.20,side*3.55).applyMatrix4(follower.mount.matrixWorld);
    assert.ok(lower.distanceTo(V(platform.position.x+anchorX,platform.userData.floor.y,platform.position.z+side*3.55))<1e-9,'suspension foot misses the actual walking deck');
   }
   const upper=V(anchorX,7,0).applyMatrix4(follower.mount.matrixWorld);
   assert.ok(upper.distanceTo(V(platform.position.x+anchorX,rail.position.y-rail.scale.y/2,rail.position.z))<1e-9,'suspension head misses the underside of the actual rail');
  }
 };
 assertAnchors();
 k.move(platform,initial.clone().add(V(11,0,0)).toArray(),0);level.renderUpdate();follower.mount.updateWorldMatrix(true,true);platform.updateWorldMatrix(true,false);
 assert.equal(renders,1);assertAnchors();assert.equal(platform.children.length,0);
 level.reset();assertAnchors();
 const geometries=new Set([platform.geometry,...follower.mount.children.map(m=>m.geometry)]);let disposals=0;
 for(const geometry of geometries)geometry.addEventListener('dispose',()=>disposals++);
 level.dispose();level.dispose();assert.equal(disposals,geometries.size);assert.equal(k.root.parent,null);assert.equal(game.colliders.length,0);
});

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

test('real source projector stays completely behind the original beam plane with physical box and barrel contacts',()=>{
 const game={scene:new THREE.Scene(),colliders:[],floors:[],cameraBlockers:[],aimBlockers:[],portalPanels:[]},k=new SingularityKit(game);
 const def=SINGULARITY_ROOMS.find(r=>r.id==='optics'),[x,y,z]=def.at;
 const room={def,b:{x0:x-def.w/2,x1:x+def.w/2,z0:z-def.d/2,z1:z+def.d/2},P:(a,b,c=0)=>[x+a,y+c,z+b]};
 const report=buildCastleAuditConstruction({game,k,rooms:new Map([['optics',room]]),machines:new Map([['optics',{state:{intake:{}}}]]),edges:[]});
 assert.equal(report.opticalProjectors,1);assert.equal(report.extraColliders,17);assert.equal(game.floors.length,0);
 const ray=new THREE.Ray(V(...report.projector.source),V(1,0,0));
 for(const collider of game.colliders){assert.ok(collider.box.max.x<report.projector.source[0]-.005,'emitter contact intrudes in front of the ray origin');assert.equal(ray.intersectBox(collider.box,V()),null);}
 assert.ok(Math.abs(report.projector.bodyBounds[1])<1e-7,'projector must be founded at the real room floor');
 k.dispose();
});

test('magnetic copper winding is visible outside its core but remains inside the old physical horseshoe envelope',()=>{
 const game={scene:new THREE.Scene(),colliders:[],floors:[],cameraBlockers:[],aimBlockers:[],portalPanels:[]},k=new SingularityKit(game);
 const def=SINGULARITY_ROOMS.find(r=>r.id==='magnet'),[x,y,z]=def.at;
 const room={def,b:{x0:x-def.w/2,x1:x+def.w/2,z0:z-def.d/2,z1:z+def.d/2}};
 k.ring([x,y+4.8,z],3,k.m.cyan,{normal:[1,0,0],tube:.24,arc:Math.PI});
 buildCastleAuditConstruction({game,k,rooms:new Map([['magnet',room]]),machines:new Map(),edges:[]});
 const winding=k.meshes.find(m=>m.userData.castleCoilEnvelope),p=winding.geometry.attributes.position;
 let outsideCore=false;
 for(let i=0;i<p.count;i++){
  const distance=Math.hypot(Math.hypot(p.getX(i),p.getY(i))-3,p.getZ(i));
  assert.ok(distance<=.24+1e-4,'winding escapes original torus tube');assert.ok(p.getY(i)>=-1e-5,'winding escapes the original open-end planes');
  outsideCore||=distance>.16;
 }
 assert.equal(outsideCore,true,'winding remains buried in the core');k.dispose();
});

test('wing-coloured internal walls receive closed casings while the real perimeter survives static batching',()=>{
 const game={scene:new THREE.Scene(),colliders:[],floors:[],cameraBlockers:[],aimBlockers:[],portalPanels:[]},k=new SingularityKit(game);
 const def=SINGULARITY_ROOMS.find(r=>r.id==='archive'),[x,y,z]=def.at;
 const room={def,b:{x0:x-def.w/2,x1:x+def.w/2,z0:z-def.d/2,z1:z+def.d/2}};
 const material=k.mat(0xd1b3b5,.8,.02);material.name='Castle wing wall / archive';
 const outer=k.box([room.b.x0,y+4.7,z],[.6,9.4,14],material),inner=k.box([x-3,y+4.7,z],[.6,9.4,14],material);
 const contacts=[...game.colliders],bounds=inner.userData.collider.box.clone(),outerGeometry=outer.geometry;
 buildCastleAuditConstruction({game,k,rooms:new Map([['archive',room]]),machines:new Map(),edges:[]});
 assert.equal(outer.geometry,outerGeometry);assert.equal(outer.material,material);assert.equal(inner.userData.castleAuditCasing,true);
 assert.equal(inner.material.name,'Castle equipment / shared casing');assert.ok(inner.geometry.boundingBox.min.equals(V(-.5,-.5,-.5)));
 k.batch();assert.deepEqual(game.colliders,contacts);assert.ok(inner.userData.collider.box.equals(bounds));
 assert.ok(k.root.children.some(mesh=>mesh.visible&&mesh.material===inner.material&&mesh.name==='Machined architectural construction / joined by finish'),'finished internal panel was lost during merge');
 assert.ok(k.root.children.some(mesh=>mesh.visible&&mesh.material===material&&mesh.isInstancedMesh),'real perimeter was lost during merge');
 k.dispose();
});
