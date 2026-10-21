import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {finishVisualAuditMiddle,conveyorChevronGeometry} from '../src/game/LabVisualAuditMiddle.js';
import {gameplayContract} from './helpers/lab-art-contract.js';

const game=await createHeadlessGame();game.chamberEdition='foundation';
after(()=>{game.firstLevel?.dispose?.();game.physics?.dispose();game.portals?.dispose();});
const V=(...a)=>new THREE.Vector3(...a);

for(let index=17;index<=33;index++)test(`visual audit ${index+1}: exact gameplay owners and measured collision subtrees survive the authored models`,async()=>{
 await game.selectLevel(index,true);const level=game.firstLevel;
 finishVisualAuditMiddle(game,level,index);level.visualAuditMiddle.root.dispose();
 delete level.workshop.visualAuditMiddle;delete level.visualAuditMiddle;
 const before=gameplayContract(game),originals=new Map();
 for(const mesh of new Set([...game.colliders.map(c=>c.mesh),...game.aimBlockers,...game.cameraBlockers,...game.portalPanels])){
  originals.set(mesh,{geometry:mesh.geometry,children:mesh.children.slice(),bounds:new THREE.Box3().setFromObject(mesh),matrix:mesh.matrix.clone()});
 }
 const bodies=game.physics.world.bodies.slice(),constraints=game.physics.world.constraints.slice(),portalMaterials=game.portalPanels.map(m=>[m,m.material]);
 finishVisualAuditMiddle(game,level,index);const art=level.visualAuditMiddle;
 assert.deepEqual(gameplayContract(game),before);
 assert.deepEqual(game.physics.world.bodies,bodies);assert.deepEqual(game.physics.world.constraints,constraints);
 for(const [mesh,snapshot]of originals){assert.equal(mesh.geometry,snapshot.geometry);assert.deepEqual(mesh.children,snapshot.children);assert.deepEqual(new THREE.Box3().setFromObject(mesh),snapshot.bounds);assert.deepEqual(mesh.matrix,snapshot.matrix);}
 for(const [mesh,material]of portalMaterials)assert.equal(mesh.material,material);
 if(index!==28)assert.ok(art.stats.parts>=17,`Room ${index+1} did not receive its intended machinery`);
 if(index===28)assert.equal(art.stats.gravityMarkers,40);
 assert.ok(art.stats.batches<=5);assert.equal(art.stats.extraColliders,0);assert.equal(art.stats.extraLights,0);
 const count=level.world.root.children.length;finishVisualAuditMiddle(game,level,index);assert.equal(level.world.root.children.length,count);
 const actual=new THREE.Matrix4(),expected=new THREE.Matrix4(),world=new THREE.Matrix4();
 level.renderUpdate(.37);art.root.updateWorldMatrix(true,true);
 for(const mount of art.root.mounts){
  mount.target.updateWorldMatrix(true,false);
  for(const part of mount.parts){
   assert.ok(mount.bounds.clone().expandByScalar(.0001).containsBox(part.bounds));
   part.mesh.getMatrixAt(part.index,actual);world.multiplyMatrices(art.root.matrixWorld,actual);expected.multiplyMatrices(mount.target.matrixWorld,part.matrix);
   for(let i=0;i<16;i++)assert.ok(Math.abs(world.elements[i]-expected.elements[i])<.00003,`${mount.name} does not follow its source`);
  }
 }
 const matrices=art.root.children.filter(m=>m.isInstancedMesh).map(m=>Array.from(m.instanceMatrix.array));
 level.renderUpdate(.37);assert.deepEqual(art.root.children.filter(m=>m.isInstancedMesh).map(m=>Array.from(m.instanceMatrix.array)),matrices,'A render-only call advanced a private mechanism clock');
});

for(const [index,count,flag]of [[20,56,'recoveryStairRiser'],[21,28,'freightStairRiser']])test(`room${index+1} final post-premium stair has one visible tread above a closed recessed riser while original six-face collision owners remain exact`,async()=>{
 await game.selectLevel(index,true);finishVisualAuditMiddle(game,game.firstLevel,index);
 const art=game.firstLevel.visualAuditMiddle,mounts=art.root.mounts.filter(m=>m.target.userData[flag]);
 assert.equal(mounts.length,count);assert.equal(art.stats.stairRisers,count);
 for(const mount of mounts){
  const source=mount.target,geometry=source.geometry;
  assert.equal(geometry.type,'BoxGeometry','Premium must not recreate a rounded coincident top');
  assert.equal(geometry.index.count,36);assert.equal(geometry.groups.length,6,'The original physical/ray box must stay closed');
  assert.equal(source.material.visible,false);assert.equal(source.userData.keepMaterial,true);
  assert.equal(mount.parts.length,1);
  const part=mount.parts[0];assert.equal(part.mesh.geometry.type,'BoxGeometry');assert.equal(part.mesh.geometry.index.count,36);
  assert.ok(part.bounds.max.y<=mount.bounds.max.y-.1199);
  for(const axis of ['x','z']){assert.ok(part.bounds.max[axis]<=mount.bounds.max[axis]-.0199);assert.ok(part.bounds.min[axis]>=mount.bounds.min[axis]+.0199);}
  const collider=game.colliders.find(c=>c.mesh===source);assert.ok(collider);assert.deepEqual(collider.box,new THREE.Box3().setFromObject(source));
 }
});

test('room30 substantial piers meet the existing soffits and only the actual receiver gates have physical collars',async()=>{
 await game.selectLevel(29,true);const level=game.firstLevel,{supports,paths,flows}=level.launchArt;
 assert.equal(supports.length,16);assert.equal(flows.length,7);
 const structure=level.workshop.solidModels.find(b=>b.model.name==='Launch hall structure, cladding and flight markers');assert.ok(structure);
 for(const support of supports){
  const [minX,maxX,minZ,maxZ,y]=support.deck;
  assert.ok(support.x-2.3>minX&&support.x+2.3<maxX&&support.z-2>minZ&&support.z+2<maxZ);
  assert.equal(support.base,0);assert.equal(support.top,y-.58);assert.deepEqual(support.shaft,[2.8,2.6]);
  const shaft=structure.colliders.find(c=>Math.abs(c.box.min.x-(support.x-1.4))<.001&&Math.abs(c.box.max.x-(support.x+1.4))<.001&&Math.abs(c.box.min.z-(support.z-1.3))<.001&&Math.abs(c.box.min.y-.8)<.001&&Math.abs(c.box.max.y-(y-1.2))<.001);
  assert.ok(shaft,'The broad rendered shaft needs its corresponding real solid envelope');
 }
 for(const path of paths){assert.equal(path.bindings.length,0);assert.ok(path.rings.every(m=>m.userData.projectedFlightGuide));assert.equal(path.flow.path.length,6);assert.ok(path.flow.mesh.material.transparent);assert.equal(path.flow.mesh.material.depthWrite,false);}
 const physicalCollars=level.workshop.solidModels.filter(b=>b.model.name==='Segmented flight collar');assert.equal(physicalCollars.length,5,'Only the four real receiving collars and the finish gate remain solid');
 const plates=level.visualAuditMiddle.root.mounts.filter(m=>m.surface);
 assert.equal(plates.length,level.world.surfaces.filter(s=>s.floor||s.portal).length);
 assert.equal(level.premiumBrowser3DArt.userData.stats.sourceSurfaces,0,'Premium must not regenerate a second cassette skin over the closed plates');
 for(const mount of plates){
  assert.equal(mount.target,mount.surface.mesh);assert.equal(mount.target.visible,false);assert.equal(mount.surface.group.userData.keepMaterial,true);
  assert.equal(mount.parts.length,1);assert.equal(mount.parts[0].mesh.geometry.type,'BoxGeometry');assert.equal(mount.parts[0].mesh.geometry.index.count,36);
  assert.ok(Math.abs(mount.bounds.max.z-mount.parts[0].bounds.max.z-.006)<.000001);
  assert.ok(mount.surface.group.children.filter(m=>m.isInstancedMesh).every(m=>!m.visible));
  const material=mount.parts[0].mesh.material;assert.equal(material.type,'MeshStandardMaterial');
  const shader={vertexShader:'#include <project_vertex>',fragmentShader:'#include <map_fragment>'};material.onBeforeCompile(shader);
  assert.match(shader.vertexShader,/instanceMatrix\*platePosition/);assert.match(shader.fragmentShader,/fwidth\(plateCell\)/);assert.match(shader.fragmentShader,/plateFade/);
 }
 const before=flows.map(f=>({time:f.time,distance:f.distance}));level.renderUpdate(.4);level.renderUpdate(.4);assert.deepEqual(flows.map(f=>({time:f.time,distance:f.distance})),before,'Projection rendering must not advance a private clock');
 level.reset();assert.ok(flows.every(f=>f.path.length>0&&f.time===0&&f.distance===0));
});

test('ordinary physical room23 receives two actual car undersides and real guide shoes without changing body ownership or portal pan geometry',async()=>{
 const previous=game.room23PhysicalPrototype;game.room23PhysicalPrototype=true;
 try{
  await game.selectLevel(22,true);const level=game.firstLevel,machine=level.balance;finishVisualAuditMiddle(game,level,22);
  assert.equal(level.room23PhysicalPrototype,true);assert.equal(machine.ownershipValid(),true);
  const art=level.visualAuditMiddle;assert.equal(art.stats.physicalCarChassis,2);assert.ok(art.stats.parts>=150);
  assert.ok(machine.cars.every(car=>art.root.mounts.some(m=>m.target===car.surface.backing)));
  assert.ok(art.root.mounts.every(m=>!m.target.userData.portalable&&!m.target.userData.portalTile));
  const bodies=machine.bodies.slice(),shapes=bodies.map(b=>b.shapes.slice()),portals=game.portalPanels.map(m=>[m,m.material,m.geometry]);
  for(let n=0;n<60;n++){game.updatePlayer(1/120);game.physics.step(1/120);level.renderUpdate(.5);}
  assert.equal(machine.ownershipValid(),true);assert.deepEqual(machine.bodies,bodies);
  for(let i=0;i<bodies.length;i++)assert.deepEqual(bodies[i].shapes,shapes[i]);
  for(const [mesh,material,geometry]of portals){assert.equal(mesh.material,material);assert.equal(mesh.geometry,geometry);}
 }finally{game.room23PhysicalPrototype=previous;}
});

test('belt chevrons reverse with the actual traction setting while original colliders and portal surfaces remain exact',async()=>{
 await game.selectLevel(26,true);const level=game.firstLevel,belt=level.state.conveyors;
 const slats=[];level.world.root.traverse(m=>{if(m.isInstancedMesh&&m.name.endsWith('travelling belt slats'))slats.push(m);});
 assert.equal(slats.length,2);assert.ok(slats.every(m=>m.geometry.name==='Conveyor directional chevron'));
 const before=gameplayContract(game),m=new THREE.Matrix4(),q=new THREE.Quaternion(),s=V(),p=V();
 belt.reversed=true;level.renderUpdate(1);slats[0].getMatrixAt(0,m);m.decompose(p,q,s);assert.ok(Math.abs(q.y)<.0001);
 belt.reversed=false;level.renderUpdate(1);slats[0].getMatrixAt(0,m);m.decompose(p,q,s);assert.ok(Math.abs(Math.abs(q.y)-1)<.0001);
 belt.reversed=true;assert.deepEqual(gameplayContract(game),before);
 const g=conveyorChevronGeometry(4.6);g.computeBoundingBox();assert.ok(g.boundingBox.getSize(V()).x<4.6);assert.ok(g.boundingBox.getSize(V()).z>.35);g.dispose();
});
