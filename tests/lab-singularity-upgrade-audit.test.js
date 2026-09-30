import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {LabGame} from '../src/game/LabGame.js';
import {SingularityKit} from '../src/game/LabSingularityKit.js';
import {terminalAccessible} from '../src/game/LabPuzzleMechanics.js';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runSingularityJourney} from '../src/game/LabSingularityJourney.js';
import {auditSingularityContacts} from '../scripts/singularity-adversarial-audit.mjs';

const V=(...p)=>new THREE.Vector3(...p);
function fixture(){const game=new LabGame({container:null,touch:false});game.scene=new THREE.Scene();game.portals={ready:false};return {game,k:new SingularityKit(game)};}
function capsulePath(game,start,direction,steps=80){
 const position=V(...start),velocity=V(...direction).multiplyScalar(6);game.playerGrounded=false;
 for(let n=0;n<steps;n++){const previous=position.clone();position.addScaledVector(V(...direction),.05);game.resolveBody(position,previous,velocity,.43,2.4,false);}
 return position;
}

test('expanded cathedral physically blocks room shells and locked doors while retaining real ring apertures',async()=>{
 const game=await createHeadlessGame();game.chamberEdition='foundation';await game.selectLevel(40,true);
 try{
  const report=auditSingularityContacts(game);
  assert.ok(report.contacts.length>=32,'Every added and original room must be contacted from both sides');
  assert.ok(report.apertures.length>=3,'Open rings must retain their physical apertures');
  assert.ok(report.dependencies.length>=4,'Probe all existing dependency doors');
  assert.equal(report.pass,true,JSON.stringify(report.failures));
 }finally{game.firstLevel.dispose();game.physics.dispose();game.portals.dispose();}
});

test('machine drum corners are free air, drum faces stop a travelling capsule, and rings can be crossed through their centre',()=>{
 const {game,k}=fixture();
 try{
  k.drum([0,1.2,0],2,2.4,k.m.steel);
  const free=V(1.9,0,1.9),before=free.clone();game.resolveBody(free,before,V(),.43,2.4,false);
  assert.ok(free.distanceTo(before)<1e-8,'A round drum must not be an invisible enclosing square');
  const stopped=capsulePath(game,[0,0,3.2],[0,0,-1]);assert.ok(stopped.z>2.42,stopped.toArray().join(','));
  const drumColliders=game.colliders.splice(0);k.ring([0,1.5,0],3,k.m.copper,{normal:[0,0,1],tube:.2});
  const crossed=capsulePath(game,[0,0,2],[0,0,-1]);assert.ok(crossed.z<-1.9,'A torus opening must not contain a disc collider');
  const rim=capsulePath(game,[3,0,2],[0,0,-1]);assert.ok(rim.z>.6,'The same ring must stop a capsule against its actual rim');
  game.colliders.push(...drumColliders);
 }finally{k.dispose();}
});

test('ordinary control access is rejected through a thin wall and restored by physically opening that wall',()=>{
 const {game,k}=fixture();
 try{
  let operated=0;const terminal=k.control('audit-control',[0,0,0],()=>{operated++;return true;},'audit');
  const wall=k.box([0,1.5,.75],[4,3,.12],k.m.wall);game.playerPosition.set(0,0,1.6);
  assert.equal(terminalAccessible(game,terminal),false);assert.equal(k.nearest(),undefined);assert.equal(operated,0);
  k.enable(wall,false);assert.equal(terminalAccessible(game,terminal),true);assert.equal(k.nearest(),terminal);k.nearest().action();assert.equal(operated,1);
 }finally{k.dispose();}
});

test('a whole-run restart restores real archive wall poses after an ordinary solved route',async()=>{
 const game=await createHeadlessGame();game.chamberEdition='foundation';await game.selectLevel(40,true);
 const level=game.firstLevel,companion=game.cargo,body=game.physics.cargoBody.id;
 const room=level.rooms.get('archive'),dynamic=game.colliders.filter(c=>c.kinematic&&c.box.min.y>=room.def.at[1]&&c.box.max.y<=room.def.at[1]+room.def.h&&c.box.getCenter(V()).x>room.b.x0&&c.box.getCenter(V()).x<room.b.x1&&c.box.getCenter(V()).z>room.b.z0&&c.box.getCenter(V()).z<room.b.z1);
 const initial=new Map(dynamic.map(c=>[c.mesh.uuid,[...c.box.min.toArray(),...c.box.max.toArray()]]));
 const controlVisuals=level.structure.children.filter(o=>o.isMesh&&((Math.abs(o.scale.x-.5)<1e-8&&Math.abs(o.scale.y-.018)<1e-8)||(Math.abs(o.scale.x-.08)<1e-8&&Math.abs(o.scale.y-.32)<1e-8)));
 const controlInitial=new Map(controlVisuals.map(o=>[o.uuid,{material:o.material,rotation:o.quaternion.clone()}]));
 try{
  assert.ok(dynamic.length>=2,'Capture actual sliding wall collisions');
  const report=await runSingularityJourney(game,{order:['reservoir','echo','archive'],stopAfter:'archive'});
  assert.equal(report.resets+report.respawns+report.cargoResets,0);assert.equal(level.machines.get('archive').state.A,true);assert.equal(level.machines.get('archive').state.B,true);
  assert.ok(dynamic.some(c=>[...c.box.min.toArray(),...c.box.max.toArray()].some((v,i)=>Math.abs(v-initial.get(c.mesh.uuid)[i])>1)),'The ordinary route must move an actual collision wall');
  game.resetRun(true);assert.equal(level.machines.get('archive').state.A,false);assert.equal(level.machines.get('archive').state.B,false);
  for(const c of dynamic){const expected=initial.get(c.mesh.uuid),actual=[...c.box.min.toArray(),...c.box.max.toArray()];assert.ok(actual.every((v,i)=>Math.abs(v-expected[i])<1e-7),`Restart left archive geometry displaced: ${actual} vs ${expected}`);const item=game.physics.solids.get(c.mesh.uuid),centre=c.box.getCenter(V());assert.ok(V(item.target.x,item.target.y,item.target.z).distanceTo(centre)<1e-7);}
  assert.deepEqual(level.getTowerMetrics().solvedIds,[]);assert.equal(game.portals.ready,false);assert.equal(game.cargo,companion);assert.equal(game.physics.cargoBody.id,body);
  assert.ok(controlVisuals.length>=level.terminals.length*2,'Capture actual console screens and actuators');
  for(const mesh of controlVisuals){const initial=controlInitial.get(mesh.uuid);assert.equal(mesh.material,initial.material,'Restart left a stale console signal');assert.ok(mesh.quaternion.angleTo(initial.rotation)<1e-7,'Restart left a control lever tipped');}
 }finally{level.dispose();game.physics.dispose();game.portals.dispose();}
});
