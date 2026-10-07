import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Vec3} from 'cannon-es';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {OpenChamber} from '../src/game/LabOpenArchitecture.js';
import {disposeLabLevel} from '../src/game/LabLevelLifecycle.js';

const V=(...p)=>new THREE.Vector3(...p),EPS=1e-5;
const names={
 31:/^(Rack guide lifting inspection roof|Rack inspection (lower leaf|upper leaf|cheek)|Cargo-driven rack contact)$/,
 32:/^(Cargo shadow guide wall|Cargo-shadow inspection cover)$/,
 33:/^(Perforated cistern inspection basket)$/,
 34:/^(Pneumatic vent seat|Pressure-driven guided door)$/,
 39:/^(Thermal door leaf|Continuously expanding thermal rod|Thermal expansion pointer|Thermal energy thermometer)$/,
};
const counts={31:6,32:3,33:1,34:5,39:5};
const worldBox=mesh=>new THREE.Box3().setFromObject(mesh);
function sameBox(a,b,label){assert.ok(a.min.distanceTo(b.min)<EPS&&a.max.distanceTo(b.max)<EPS,label);}
function vertices(mesh){return mesh.geometry.index?.count??mesh.geometry.attributes.position.count;}
function bodyBox(body,position=body.position){
 const min=new Vec3(),max=new Vec3();body.shapes[0].calculateWorldAABB(position,body.quaternion,min,max);
 return new THREE.Box3(V(min.x,min.y,min.z),V(max.x,max.y,max.z));
}
function mechanics(g){
 const l=g.firstLevel,s=l.pressureState,t=l.thermal;
 return JSON.stringify({state:g.state,time:l.workshop.time,player:g.playerPosition.toArray(),playerVelocity:g.playerVelocity.toArray(),cargo:g.cargo.position.toArray(),cargoVelocity:g.cargo.velocity.toArray(),cargoQuaternion:g.cargo.quaternion.toArray(),transports:g.physics.portalTransports,
  bodies:g.physics.world.bodies.map(b=>({id:b.id,type:b.type,p:b.position.toArray(),q:b.quaternion.toArray(),v:b.velocity.toArray(),w:b.angularVelocity.toArray(),f:b.force.toArray(),torque:b.torque.toArray()})),
  solids:[...g.physics.solids].map(([id,p])=>({id,target:p.target.toArray(),remaining:p.remaining})),
  hydraulic:l.circuit&&[l.circuit.source,l.circuit.tube,l.circuit.ram,l.circuit.returning,l.basket.height,l.basket.target],pressure:s&&[s.mode,s.pressure,s.coverage,s.seatTravel,s.doorTravel],thermal:t&&[t.temperature,t.energy,t.extension,t.powered,t.remote],optics:l.optics&&{...l.optics},rack:l.rack&&[l.rack.stroke,l.rack.latched],spring:l.spring&&[l.spring.compression,l.spring.held]});
}
function neutralRenders(g){
 const before=mechanics(g);
 for(const alpha of [0,.25,.5,1]){g.firstLevel.renderUpdate(alpha);g.updateVisuals(0,alpha,0);assert.equal(mechanics(g),before,'Render/interpolation must not advance or rewrite physical mechanism state');}
}
async function built(n){
 const g=await createHeadlessGame();g.chamberEdition='foundation';let captured;
 const original=OpenChamber.prototype.flush;
 OpenChamber.prototype.flush=function(){
  if(this.index!==n-1)return original.call(this);
  const meshes=[];this.world.root.traverse(m=>{if(m.isMesh&&names[n].test(m.name))meshes.push(m);});
  assert.equal(meshes.length,counts[n],'The production build must contain every authored moving piece before batching');
  const parts=meshes.map(mesh=>{const part={mesh,geometry:mesh.geometry,disposed:0,closed:worldBox(mesh),material:mesh.material,staticVertices:0};mesh.geometry.addEventListener('dispose',()=>part.disposed++);return part;});
  for(const part of parts){
   const bin=this.artBins.get(part.material)??[];
   assert.ok(!bin.includes(part.mesh),part.mesh.name+' must be excluded from the static assembly');
   part.staticVertices=bin.filter(m=>m.castShadow===part.mesh.castShadow&&m.receiveShadow===part.mesh.receiveShadow).reduce((sum,m)=>sum+vertices(m),0);
  }
  const result=original.call(this);
  for(const part of parts){
   assert.equal(this.world.root.getObjectById(part.mesh.id),part.mesh,part.mesh.name+' must survive flush attached to the rendered room');
   const merged=this.world.root.children.filter(m=>m.isMesh&&m.name.startsWith('Manufactured architecture /')&&m.material===part.material&&m.castShadow===part.mesh.castShadow&&m.receiveShadow===part.mesh.receiveShadow);
   assert.equal(merged.reduce((sum,m)=>sum+vertices(m),0),part.staticVertices,'The merged static assembly must contain no frozen copy of '+part.mesh.name);
   assert.equal(part.disposed,0,'A live mechanism geometry must not be disposed by flush');
  }
  captured={parts,root:this.world.root};return result;
 };
 try{await g.selectLevel(n-1,false);}finally{OpenChamber.prototype.flush=original;}
 assert.ok(captured);return {g,...captured};
}
function validate(g,root,parts,{syncPhase=false}={}){
 const l=g.firstLevel;
 for(const part of parts){
  const {mesh}=part;assert.equal(root.getObjectById(mesh.id),mesh,mesh.name+' must remain in the live scene');assert.equal(g.scene.getObjectById(mesh.id),mesh);assert.equal(mesh.visible,true);assert.equal(mesh.geometry,part.geometry);assert.equal(part.disposed,0);
  const box=worldBox(mesh);
  let collider,body;
  if(mesh.name==='Cargo-driven rack contact'){collider=l.rack.collider;body=l.rack.body;}
  else if(mesh.name==='Perforated cistern inspection basket'){collider=g.colliders.find(c=>c.kinematic&&c.box.min.distanceTo(box.min)<EPS&&c.box.max.distanceTo(box.max)<EPS);}
  else if(mesh.name==='Pressure-driven guided door'){collider=l.doorCollider;body=l.pressureState.doorBody;assert.equal(g.physics.solids.has(collider.mesh.uuid),false,'The guided dynamic door must not regain a duplicate Cannon proxy');}
  else collider=g.colliders.find(c=>c.kinematic&&c.box.min.distanceTo(box.min)<EPS&&c.box.max.distanceTo(box.max)<EPS);
  if(collider){
   sameBox(box,collider.box,mesh.name+' live geometry must match its player-collision bounds');
   sameBox(box,worldBox(collider.mesh),mesh.name+' live geometry must match its actual camera/projectile proxy');
   const solid=g.physics.solids.get(collider.mesh.uuid);
   if(solid){sameBox(box,bodyBox(solid.body,solid.target),mesh.name+' must match its Cannon shape at the scheduled kinematic target');}
   if(body&&syncPhase)sameBox(box,bodyBox(body),mesh.name+' must follow its actual guided Cannon body at the production synchronization phase');
  }else assert.equal(l.index,38,'Every moving physical part must have its live collision proxy; only the three thermal indicators are decoration');
 }
}
function rayHitsProxy(g,collider){
 const ray=new THREE.Raycaster(V(0,1.4,-3),V(0,0,-1),0,12);
 return ray.intersectObject(collider.mesh,false).length>0;
}

for(const n of [31,32,33,34,39])test(`${n}: moving mechanisms survive static assembly, real actuation, render interpolation and restart`,async()=>{
 const {g,root,parts}=await built(n),cargo=g.cargo,cargoBody=g.physics.cargoBody;
 const initial=parts.map(p=>worldBox(p.mesh)),sharedLight=g.firstLevel.workshop.m.light,lightColor=sharedLight.color.clone();
 const doorBody=g.firstLevel.pressureState?.doorBody;
 let samples=0,moved=new Set();const update=g.firstLevel.update;
 g.firstLevel.update=function(dt){const result=update.call(this,dt);validate(g,root,parts,{syncPhase:true});samples++;parts.forEach((p,i)=>{const box=worldBox(p.mesh);if(box.min.distanceTo(initial[i].min)>.05||box.max.distanceTo(initial[i].max)>.05)moved.add(p.mesh.uuid);});return result;};
 try{
  validate(g,root,parts);if(n===34)assert.ok(rayHitsProxy(g,g.firstLevel.doorCollider),'Closed pressure door must block its real camera/projectile ray');
  if(n===39){const bar=parts.find(p=>p.mesh.name==='Thermal energy thermometer').mesh;assert.notEqual(bar.material,sharedLight,'Temperature color must belong to the thermometer alone');}
  const report=await runV8Journey(g,{onMilestone:()=>{
   validate(g,root,parts);neutralRenders(g);
   if(n===34&&g.firstLevel.pressureState.doorTravel>5.8)assert.equal(rayHitsProxy(g,g.firstLevel.doorCollider),false,'The actual opening must release the camera/projectile ray');
   if(n===39)assert.ok(sharedLight.color.equals(lightColor),'Heating the gauge must not tint the static laboratory lights');
  }});
  assert.ok(report.pass);assert.equal(g.state,'won');assert.equal(report.resets+report.respawns,0);assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,cargoBody);assert.ok(samples>60);assert.equal(moved.size,parts.length,'Every authored moving part must visibly move during the production route');
  validate(g,root,parts);neutralRenders(g);
  g.resetRun(true);validate(g,root,parts,{syncPhase:true});parts.forEach((p,i)=>sameBox(worldBox(p.mesh),initial[i],p.mesh.name+' must visibly return to its original closed/cold pose'));assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,cargoBody);
  if(n===34){assert.equal(g.firstLevel.pressureState.doorBody,doorBody);assert.ok(rayHitsProxy(g,g.firstLevel.doorCollider),'Reset must restore the actual closed ray proxy');}
  if(n===39)assert.ok(sharedLight.color.equals(lightColor));
 }finally{g.firstLevel.update=update;disposeLabLevel(g);parts.forEach(p=>assert.equal(p.disposed,1,p.mesh.name+' geometry must be released once on level disposal'));}
});

test('39: changing the temperature color owns one material and releases it on a real level switch',async()=>{
 const {g,parts}=await built(39),bar=parts.find(p=>p.mesh.name==='Thermal energy thermometer').mesh,material=bar.material;
 let disposed=0;material.addEventListener('dispose',()=>disposed++);
 try{
  await runV8Journey(g);assert.equal(disposed,0,'A live gauge must keep its own material');
  g.resetRun(true);assert.equal(disposed,0,'Restart must reuse the live gauge material');
  await g.selectLevel(34,false);assert.equal(disposed,1,'The regular level lifecycle must release the isolated gauge material exactly once');assert.equal(g.scene.getObjectById(bar.id),undefined);
 }finally{disposeLabLevel(g);}
});
