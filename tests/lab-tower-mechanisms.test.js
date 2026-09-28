import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makePortalFrame} from '../src/game/LabPortals.js';
import {TOWER_STAGES,towerPoint} from '../src/game/LabTowerLayout.js';
import {createTowerMechanism} from '../src/game/LabTowerMechanisms.js';
import {createTowerKeystones,KEYSTONE_FEED_MODES,KEYSTONE_SPECS} from '../src/game/LabTowerKeystones.js';

function harness(index){
 const definition=TOWER_STAGES[index],group=new THREE.Group(),colliders=[];
 const materials={dark:new THREE.MeshBasicMaterial(),ivory:new THREE.MeshBasicMaterial(),glass:new THREE.MeshBasicMaterial()};
 const game={colliders,portals:{ready:false,portals:[null,null]},heldCube:null,
  cargo:{position:new THREE.Vector3(...towerPoint(definition,5.1,0,definition.baseY+.58)),velocity:new THREE.Vector3()},
  physics:{grounded:true,cargoBody:{position:{x:0,y:0,z:0},velocity:{x:0,y:0,z:0},force:{x:0,y:0,z:0},mass:2,wakeUp(){}}}};
 Object.assign(game.physics.cargoBody.position,game.cargo.position);
 const housings=[];
 const box=(position,size,material,options)=>{
  assert.ok(material,'All housings use a registered stage material');
  assert.equal(options.solid,true,'Visible substantial machinery is physically collidable');
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);mesh.position.fromArray(position);
  mesh.updateWorldMatrix(true,false);const collider={mesh,box:new THREE.Box3().setFromObject(mesh),enabled:true};
  housings.push(mesh);colliders.push(collider);group.add(mesh);return mesh;
 };
 const mechanism=createTowerMechanism({game,definition,group,box,materials});
 function pair(output='panelOutputA'){
  const [dx,dz]=definition.direction,across=new THREE.Vector3(-dz,0,dx);
  game.portals.portals=[makePortalFrame(new THREE.Vector3(...definition.panelInput),across.clone().negate()),
   makePortalFrame(new THREE.Vector3(...definition[output]),across)];
  game.portals.ready=true;
 }
 return {game,definition,group,mechanism,pair,housings,
  dispose(){mechanism.dispose();housings.forEach(mesh=>mesh.geometry.dispose());Object.values(materials).forEach(mat=>mat.dispose());}};
}

test('two receivers respond to their own optical path through placed portals',()=>{
 const h=harness(4);
 try{
  assert.deepEqual([h.mechanism.update(1/120).beamA,h.mechanism.getSignals().beamB],[false,false]);
  h.pair('panelOutputA');assert.equal(h.mechanism.update(1/120).beamA,true);
  assert.equal(h.mechanism.getSignals().beamB,false);
  h.pair('panelOutputB');assert.equal(h.mechanism.update(1/120).beamA,false);
  assert.equal(h.mechanism.getSignals().beamB,true);
  h.game.portals.ready=false;
  assert.equal(h.mechanism.update(1/120).beamB,false,'Disconnected portals no longer power a receiver');
 }finally{h.dispose();}
});

test('real reflected ray requires the rotatable mirror',()=>{
 const h=harness(0);
 try{
  h.pair();assert.equal(h.mechanism.update(1/120).beamA,false);
  h.mechanism.setControl(true);
  for(let step=0;step<90;step++)h.mechanism.update(1/120);
  assert.equal(h.mechanism.getSignals().beamA,true);
  h.mechanism.setControl(false);
  for(let step=0;step<90;step++)h.mechanism.update(1/120);
  assert.equal(h.mechanism.getSignals().beamA,false);
 }finally{h.dispose();}
});

test('the turbine needs airflow through a real portal and applies directional force',()=>{
 const h=harness(3);
 try{
  assert.equal(h.mechanism.update(1/120).airA,false);
  h.pair();for(let step=0;step<80;step++)h.mechanism.update(1/120);
  assert.equal(h.mechanism.getSignals().airA,true);
  const [dx,dz]=h.definition.direction;
  const inside=new THREE.Vector3(...towerPoint(h.definition,17,0,h.definition.baseY+1));
  const a=h.mechanism.playerAcceleration(inside,new THREE.Vector3());
  assert.ok(a.x*dx+a.z*dz>6,'Moving air pushes the player along the outlet duct');
  h.game.physics.cargoBody.position={x:inside.x,y:inside.y,z:inside.z};
  h.mechanism.applyCargoForces(1/120);
  const force=h.game.physics.cargoBody.force;
  assert.ok(force.x*dx+force.z*dz>0,'The same wind acts on the original cargo body');
  h.game.portals.ready=false;h.mechanism.update(1/120);
  assert.equal(h.mechanism.getSignals().airA,false);
  assert.equal(h.mechanism.playerAcceleration(inside,new THREE.Vector3()).length(),0);
 }finally{h.dispose();}
});

test('cargo gravity signal requires the real free body reaching the upper sensor',()=>{
 const h=harness(5);
 try{
  assert.equal(h.mechanism.update(1/120).gravity,false);
  h.game.physics.grounded=false;h.mechanism.applyCargoForces(1/120);
  assert.equal(h.game.physics.cargoBody.force.y,0,'A falling cargo cannot arm the gravity lift');
  h.game.physics.grounded=true;
  h.mechanism.applyCargoForces(1/120);
  assert.ok(h.game.physics.cargoBody.force.y>h.game.physics.cargoBody.mass*19.5);
  h.game.heldCube=h.game.cargo;
  const before=h.game.physics.cargoBody.force.y;h.mechanism.applyCargoForces(1/120);
  assert.equal(h.game.physics.cargoBody.force.y,before,'A carried body cannot be levitated');
  h.game.heldCube=null;
  h.game.cargo.position.y=h.definition.baseY+3.5;
  assert.equal(h.mechanism.update(1/120).gravity,true);
  h.mechanism.setControl(true);
  h.game.physics.cargoBody.force.y=0;h.mechanism.applyCargoForces(1/120);
  assert.equal(h.game.physics.cargoBody.force.y,0,'The vent allows cargo to fall for retrieval');
  h.mechanism.reset();assert.equal(h.mechanism.getSignals().gravity,false);
 }finally{h.dispose();}
});

test('central spectrum requires three live wing feeds and two actual portal ray paths',()=>{
 const group=new THREE.Group(),colliders=[],rooms=TOWER_STAGES.map(definition=>({definition,
  panels:{input:new THREE.Group(),outputA:new THREE.Group()},
  mechanism:{getSignals:()=>({beamA:definition.index===0})}}));
 const materials={dark:new THREE.MeshBasicMaterial(),amber:new THREE.MeshBasicMaterial(),
  mint:new THREE.MeshBasicMaterial(),ivory:new THREE.MeshBasicMaterial()};
 const game={colliders,portals:{ready:false,portals:[null,null]},portalSurfaceIds:[null,null],
  playerPosition:new THREE.Vector3(),playerVelocity:new THREE.Vector3(),playerGrounded:true,
  cargo:{position:new THREE.Vector3(),velocity:new THREE.Vector3()},heldCube:null,teleportCount:0,
  cargoOnPad(target,radius){return Math.hypot(this.cargo.position.x-target.x,this.cargo.position.z-target.z)<radius
   &&this.cargo.position.y>target.y+.2&&this.cargo.position.y<target.y+.75;}};
 const box=(point,size,material,options={})=>{
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);mesh.position.fromArray(point);mesh.updateWorldMatrix(true,false);
  if(options.solid)colliders.push({mesh,box:new THREE.Box3().setFromObject(mesh),enabled:true});
  group.add(mesh);return mesh;
 };
 const makePanel=(deck,key,position,normal,width,height)=>{
  const n=new THREE.Vector3(...normal),front=new THREE.Vector3(...position);
  const size=Math.abs(n.x)>.9?[.32,height,width]:[width,height,.32];
  const mesh=box(front.clone().addScaledVector(n,-.16).toArray(),size,materials.ivory,{solid:true});
  mesh.userData.center=front;mesh.userData.normal=n;mesh.name=key;return mesh;
 };
 const k=createTowerKeystones({game,root:group,box,makePanel,materials,rooms});
 const ready=[true,false,false,false,false,false];
 try{
  assert.deepEqual(KEYSTONE_SPECS.map(spec=>spec.id),
   ['spectrum','counterbalance','crosswind','inversion','braid','crown']);
  assert.deepEqual(KEYSTONE_FEED_MODES[0].map(f=>f.mode),['beamA','transit','cargo']);
  const east=TOWER_STAGES[0],north=TOWER_STAGES[2],west=TOWER_STAGES[1];
  game.playerPosition.fromArray(towerPoint(east,34));k.update(1/120,ready);
  assert.deepEqual(k.getState(0).feeds,[true,false,false]);
  game.playerPosition.fromArray(towerPoint(north,30));
  game.portalSurfaceIds=[rooms[2].panels.input.uuid,rooms[2].panels.outputA.uuid];
  game.lastPortalTravel={entry:0,exit:1};game.teleportCount=1;
  k.update(1/120,ready);assert.deepEqual(k.getState(0).feeds,[true,true,false]);
  game.cargo.position.fromArray(towerPoint(west,5.1,0,west.baseY+.39));
  game.playerPosition.fromArray(towerPoint(west,33));k.update(1/120,ready);
  assert.deepEqual(k.getState(0).feeds,[true,true,true]);
  const input=group.getObjectByName('keystone-spectrum-input');
  const outputA=group.getObjectByName('keystone-spectrum-outputA');
  const outputB=group.getObjectByName('keystone-spectrum-outputB');
  assert.ok(input&&outputA&&outputB);
  game.portals.ready=true;
  game.portals.portals=[makePortalFrame(input.userData.center,input.userData.normal),
   makePortalFrame(outputA.userData.center,outputA.userData.normal)];
  k.update(1/120,ready);assert.deepEqual(k.getState(0).signals,{beamA:true});
  game.portals.portals[1]=makePortalFrame(outputB.userData.center,outputB.userData.normal);
  k.update(1/120,ready);assert.equal(k.getState(0).solved,true);
  k.reset();assert.deepEqual(k.getState(0).feeds,[false,false,false]);
 }finally{k.dispose();group.traverse(object=>{if(object.isMesh&&object.material&&Object.values(materials).includes(object.material))object.geometry.dispose();});
  Object.values(materials).forEach(material=>material.dispose());}
});

test('a keystone portal crossing before its gravity signal cannot satisfy transit retroactively',()=>{
 const root=new THREE.Group(),colliders=[],materials={dark:new THREE.MeshBasicMaterial(),
  amber:new THREE.MeshBasicMaterial(),mint:new THREE.MeshBasicMaterial(),ivory:new THREE.MeshBasicMaterial()};
 const rooms=TOWER_STAGES.map(definition=>({definition,
  panels:{input:new THREE.Group(),outputA:new THREE.Group()},
  mechanism:{getSignals:()=>({beamB:definition.index===11,beamA:definition.index===9})}}));
 const game={colliders,portals:{ready:false,portals:[null,null]},portalSurfaceIds:[null,null],teleportCount:0,
  playerPosition:new THREE.Vector3(),playerVelocity:new THREE.Vector3(),playerGrounded:true,
  cargo:{position:new THREE.Vector3(),velocity:new THREE.Vector3()},heldCube:null};
 const box=(p,size,material,options={})=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);
  mesh.position.fromArray(p);root.add(mesh);mesh.updateWorldMatrix(true,false);
  if(options.solid)colliders.push({mesh,box:new THREE.Box3().setFromObject(mesh),enabled:true});return mesh;};
 const makePanel=(deck,key,p,n,w,h)=>{const normal=new THREE.Vector3(...n);
  const mesh=box(new THREE.Vector3(...p).addScaledVector(normal,-.16).toArray(),[.32,h,w],materials.ivory,{solid:true});
  mesh.userData.center=new THREE.Vector3(...p);mesh.userData.normal=normal;mesh.name=key;return mesh;};
 const k=createTowerKeystones({game,root,box,makePanel,materials,rooms}),ready=[false,false,false,true,false,false];
 try{
  game.playerPosition.fromArray(towerPoint(TOWER_STAGES[11],34));k.update(1/120,ready);
  game.playerPosition.fromArray(towerPoint(TOWER_STAGES[9],32));k.update(1/120,ready);
  assert.deepEqual(k.getState(3).feeds,[true,true]);
  const input=root.getObjectByName('keystone-inversion-input');
  const output=root.getObjectByName('keystone-inversion-outputA');
  game.portalSurfaceIds=[input.uuid,output.uuid];game.lastPortalTravel={entry:0,exit:1};
  game.teleportCount++;k.update(1/120,ready);
  assert.equal(k.getState(3).signals.transit,undefined);
  game.cargo.position.set(0,3*8+3.5,0);k.update(1/120,ready);
  assert.equal(k.getState(3).signals.gravity,true);
  assert.equal(k.getState(3).signals.transit,undefined);
  game.teleportCount++;k.update(1/120,ready);
  assert.equal(k.getState(3).signals.transit,true);
 }finally{k.dispose();root.traverse(m=>{if(m.isMesh&&Object.values(materials).includes(m.material))m.geometry.dispose();});
  Object.values(materials).forEach(m=>m.dispose());}
});
