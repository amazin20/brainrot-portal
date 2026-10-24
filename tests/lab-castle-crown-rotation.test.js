import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Body,Box,Vec3} from 'cannon-es';
import {LabPhysics} from '../src/game/LabPhysics.js';
import {SingularityKit} from '../src/game/LabSingularityKit.js';
import {LabGame} from '../src/game/LabGame.js';
import {boxIntersectsOrientedCollider,capsuleBoxContact} from '../src/game/LabOrientedBoxContact.js';
import {buildCastleCrownRotation} from '../src/game/LabCastleCrownRotation.js';

const DT=1/120,V=(...v)=>new THREE.Vector3(...v);

// Deliberately prepared geometry/contact fixtures. Actor staging here is not
// ordinary input or a full castle route; real production mechanisms, Cannon
// support equations and the original cargo/body/shape remain in use.
function fixture({latePhysics=false,available=()=>true}={}){
 const game={scene:new THREE.Scene(),colliders:[],floors:[],cameraBlockers:[],aimBlockers:[],portalPanels:[],
  cargo:new THREE.Object3D(),heldCube:null,playerPosition:V(13,72,13),previousPlayerPosition:V(13,72,13),playerVelocity:V(),playerGrounded:true};
 game.markPortalSurface=LabGame.prototype.markPortalSurface;
 const physics=new LabPhysics(),k=new SingularityKit(game),events=[];
 const room={def:{id:'crown',at:[0,72,0],w:32,d:38,h:19},P:(x,z=0,y=0)=>[x,72+y,z]};
 k.floor(-16,16,-19,19,72);
 if(!latePhysics){game.physics=physics;physics.createCargo({position:[13,73,14]});}
 const crown=buildCastleCrownRotation({game,k,room,available,
  standing:(p,r=1.2)=>game.playerGrounded&&Math.hypot(game.playerPosition.x-p[0],game.playerPosition.z-p[2])<r&&Math.abs(game.playerPosition.y-p[1])<.3,
  complete:(id,proof)=>events.push({id,proof}),
  plate:(p,size,material)=>k.box([p[0],p[1]+.065,p[2]],[size,.035,size],material,{solid:false,dynamic:true}),sign:()=>({update(){}}),
 });
 let initialWithoutPhysics=null;
 if(latePhysics){crown.update(DT);initialWithoutPhysics=crown.diagnostics();game.physics=physics;physics.createCargo({position:[13,73,14]});}
 for(const c of game.colliders)if(!physics.solids.has(c.mesh.uuid)&&!physics.bodyBoxes.has(c.mesh.uuid))physics.addStaticBox(c.mesh.uuid,c.box,{kinematic:c.kinematic});
 const cargo=physics.cargoBody,shape=cargo.shapes[0];
 const sync=()=>{game.cargo.position.copy(cargo.position);game.cargo.quaternion.copy(cargo.quaternion);};
 function placeCargo(p){game.heldCube=null;physics.release();cargo.position.set(...p);cargo.previousPosition.copy(cargo.position);cargo.interpolatedPosition.copy(cargo.position);cargo.quaternion.set(0,0,0,1);cargo.previousQuaternion.copy(cargo.quaternion);cargo.interpolatedQuaternion.copy(cargo.quaternion);cargo.velocity.setZero();cargo.angularVelocity.setZero();cargo.force.setZero();cargo.torque.setZero();cargo.aabbNeedsUpdate=true;cargo.wakeUp();physics.world.broadphase.dirty=true;sync();}
 function step(seconds=DT,observe=()=>{}){for(let i=0;i<Math.round(seconds/DT);i++){crown.update(DT);physics.step(DT);crown.syncPose();sync();observe();}}
 function until(predicate,seconds,message){for(let i=0;i<Math.ceil(seconds/DT)&&!predicate();i++)step();assert.ok(predicate(),message+' '+JSON.stringify(crown.diagnostics()));}
 function open(index){assert.equal(crown.state.toggle(index),true);until(()=>Math.abs(crown.state.rotors[index].angle-Math.PI/2)<1e-8,8,'Crown rotor did not open');}
 function load(){const p=crown.state.socket;placeCargo([p[0],p[1]+1,p[2]]);until(()=>positiveSupport().length>0,2,'Original free cargo did not load the actual final tray');}
 function positiveSupport(){const e=physics.solids.get(crown.state.receiverMesh.uuid),support=e?.body,supportShape=support?.shapes[0];return physics.world.contacts.filter(c=>c.enabled!==false&&c.multiplier>1e-6&&[c.bi,c.bj].includes(cargo)&&[c.bi,c.bj].includes(support)&&[c.si,c.sj].includes(shape)&&[c.si,c.sj].includes(supportShape)&&(c.bi===cargo?-c.ni.y:c.ni.y)>.65);}
 crown.update(0);crown.syncPose();sync();
 return{game,physics,k,room,crown,cargo,shape,events,step,until,open,load,positiveSupport,placeCargo,initialWithoutPhysics,
  dispose(){crown.dispose();k.dispose();physics.dispose();}};
}

function ownedPose(f,rotor){
 const {mesh,collider,body}=rotor,box=collider.orientedBox,entry=f.physics.bodyBoxes.get(mesh.uuid);
 assert.ok(body&&box&&entry,'A visible rotor needs a current real Cannon Box ownership record');
 assert.equal(f.physics.solids.has(mesh.uuid),false,'A rotating real Box cannot retain a duplicate AABB body');
 assert.equal(entry.body,body);assert.equal(entry.shape,body.shapes[entry.shapeIndex]);assert.equal(box.body,body);
 const inspection=f.physics.inspectBodyBox(mesh.uuid,{orientedBox:box,bounds:collider.box,enabled:true});assert.equal(inspection.valid,true,JSON.stringify(inspection.errors));
 assert.ok(mesh.position.distanceTo(box.current.center)<1e-8);assert.ok(mesh.quaternion.angleTo(box.current.quaternion)<1e-7);
 assert.ok(new THREE.Box3().setFromObject(mesh).min.distanceTo(collider.box.min)<1e-6);assert.ok(new THREE.Box3().setFromObject(mesh).max.distanceTo(collider.box.max)<1e-6);
 assert.equal(mesh.children.length,0,'Decorative descendants must not enlarge the physical envelope');
}
function firstRay(f,from,target){f.game.scene.updateMatrixWorld(true);const ray=new THREE.Raycaster(V(...from),target.clone().sub(V(...from)).normalize());return ray.intersectObjects(f.game.aimBlockers,true).find(h=>h.object.visible!==false||h.object.userData.collisionProxy)?.object;}

for(const latePhysics of [false,true])test(`crown owns two actual oriented rotors and retains original cargo after ${latePhysics?'late':'normal'} physics creation`,()=>{
 const f=fixture({latePhysics});try{
  assert.equal(f.crown.state.rotors.length,2);f.step(DT);
  for(const rotor of f.crown.state.rotors)ownedPose(f,rotor);
  assert.equal(f.physics.cargoBody,f.cargo);assert.equal(f.cargo.shapes[0],f.shape);
  assert.equal(f.events.length,0);assert.equal(f.crown.passiveSupport(),false);
 }finally{f.dispose();}
});

test('the first real shutter blocks the receiver shot, then its rotated open section exposes the unchanged portal',()=>{
 const f=fixture();try{
  const target=f.crown.state.outlet.frame().center.clone().add(V(0,-.4,0)),eye=f.room.P(12,-10,2);
  assert.equal(firstRay(f,eye,target),f.crown.state.rotors[0].mesh,'The new physical shutter must actually obstruct the initial shot');
  // Sample the entire exposed sight slit against the whole white receiver,
  // including corner shots which could otherwise look around a short blade.
  const face=f.crown.state.outlet.frame();for(const z of [-10.69,-10,-9.31])for(const y of [1.41,2,3.29])for(const a of [-2.39,-1.2,0,1.2,2.39])for(const b of [-2.39,0,2.39]){const hit=firstRay(f,f.room.P(.36,z,y),face.center.clone().addScaledVector(face.right,a).addScaledVector(face.up,b));assert.notEqual(hit,f.crown.state.outlet.mesh,'An extreme sight-line bypassed the closed opaque section');}
  f.open(0);assert.equal(firstRay(f,eye,target),f.crown.state.outlet.mesh,'Rotating the physical shutter must expose the real white receiver');
 }finally{f.dispose();}
});

test('both complete rotor strokes retain exact contact shapes and clear every fixed physical member',()=>{
 const f=fixture();try{
  const rotors=f.crown.state.rotors,fixed=f.game.colliders.filter(c=>c.enabled!==false&&!rotors.some(r=>r.collider===c));let samples=0;
  const inspect=()=>{for(const rotor of rotors){ownedPose(f,rotor);for(const obstacle of fixed)assert.equal(boxIntersectsOrientedCollider(rotor.collider.orientedBox,obstacle.box.clone().expandByScalar(-1e-6)),false,`Rotor intersects ${obstacle.mesh.name||'a fixed physical member'}`);}samples++;};
  for(let i=0;i<2;i++){assert.equal(f.crown.state.toggle(i),true);for(let j=0;j<8/DT&&Math.abs(rotors[i].angle-Math.PI/2)>1e-8;j++)f.step(DT,inspect);assert.ok(Math.abs(rotors[i].angle-Math.PI/2)<1e-8);assert.equal(f.crown.state.toggle(i),true);for(let j=0;j<8/DT&&rotors[i].angle>1e-8;j++)f.step(DT,inspect);assert.ok(rotors[i].angle<1e-8);}
  assert.ok(samples>100,'Continuous closing sweeps need real intermediate poses');assert.equal(f.events.length,0);
 }finally{f.dispose();}
});

test('the second closed rotor stops the actual capsule and its rotated section leaves the new west doorway passable',()=>{
 const f=fixture();try{
  const rotor=f.crown.state.rotors[1],resolve=()=>{
   const previous=V(-9,72,1.8),position=V(-9,72,6.5),velocity=V(0,0,10);
   const fake={colliders:[rotor.collider],floors:[],heldCube:null,playerGrounded:false,groundedByCollider:false,groundedByOrientedCollider:false};
   LabGame.prototype.resolveBody.call(fake,position,previous,velocity,.43,2.4,false);return position;
  };
  assert.ok(resolve().z<4-.15,'The actual closed oriented slab must stop the capsule');
  f.open(1);assert.ok(resolve().distanceTo(V(-9,72,6.5))<1e-7,'The open gate cannot keep an obsolete axis-aligned blocking envelope');
 }finally{f.dispose();}
});

for(const index of [0,1])for(const closing of [false,true])for(const actor of ['player','free','held','carryTarget'])test(`rotor ${index+1} reserves its ${closing?'closing':'opening'} sweep for ${actor} and resumes without moving the actor`,()=>{
 const f=fixture();try{
  const rotor=f.crown.state.rotors[index],p=index===0?[-2,72,-4]:[-6.1,72,2.1];if(closing)f.open(index);const beforeAngle=rotor.angle;
  if(actor==='player')f.game.playerPosition.fromArray(p);
  else if(actor==='carryTarget'){
   f.game.heldCube=f.game.cargo;f.physics.setCarryTarget([p[0],p[1]+.65,p[2]],{quaternion:new THREE.Quaternion().setFromAxisAngle(V(0,1,0),Math.PI/4)});
  }else{f.placeCargo([p[0],p[1]+.53,p[2]]);if(actor==='held')f.game.heldCube=f.game.cargo;}
  // Both endpoint configurations are clear; this actor occupies the real
  // diagonal arc between them, rather than an existing illegal overlap.
  for(const angle of [0,Math.PI/2]){const sample={...rotor.collider.orientedBox,current:{...rotor.collider.orientedBox.current,quaternion:new THREE.Quaternion().setFromAxisAngle(V(0,1,0),angle)}};assert.ok(capsuleBoxContact(V(...p),.48,2.4,sample).depth<0);}
  const before={player:f.game.playerPosition.clone(),cargo:f.cargo.position.clone(),velocity:f.cargo.velocity.clone(),target:f.physics.carryTarget?.position.clone()};
  assert.equal(f.crown.state.toggle(index),true);f.crown.update(DT);
  assert.equal(rotor.angle,beforeAngle);assert.equal(rotor.blocked,true);
  assert.equal(f.game.playerPosition.distanceTo(before.player),0);assert.ok(f.cargo.position.almostEquals(before.cargo));assert.ok(f.cargo.velocity.almostEquals(before.velocity));
  if(before.target)assert.ok(f.physics.carryTarget.position.almostEquals(before.target));
  f.game.playerPosition.set(13,72,13);f.placeCargo([13,73,14]);f.crown.update(DT);
  assert.ok(closing?rotor.angle<beforeAngle:rotor.angle>beforeAngle,'A clear swept volume must allow the requested move to resume');assert.equal(rotor.blocked,false);
 }finally{f.dispose();}
});


test('a genuinely floor-supported original blocks a closing sweep without hidden teleport or motion',()=>{
 const f=fixture();try{
  f.open(1);f.placeCargo([-6.1,73,2.1]);f.step(1);
  const floor=f.game.floors[0].mesh,support=f.physics.solids.get(floor.uuid).body;
  const contacts=f.physics.world.contacts.filter(c=>c.enabled!==false&&c.multiplier>1e-6&&[c.bi,c.bj].includes(f.cargo)&&[c.bi,c.bj].includes(support)&&(c.bi===f.cargo?-c.ni.y:c.ni.y)>.65);
  assert.ok(contacts.length>0,'This safety fixture must use a real load contact on the physical room floor');
  const rotor=f.crown.state.rotors[1],angle=rotor.angle,position=f.cargo.position.clone(),velocity=f.cargo.velocity.clone();
  assert.equal(f.crown.state.toggle(1),true);f.crown.update(DT);
  assert.equal(rotor.angle,angle);assert.equal(rotor.blocked,true);assert.ok(f.cargo.position.almostEquals(position));assert.ok(f.cargo.velocity.almostEquals(velocity));
  f.placeCargo([13,73,14]);f.crown.update(DT);assert.ok(rotor.angle<angle);assert.equal(rotor.blocked,false);
 }finally{f.dispose();}
});

test('actual original free tray support and a grounded neighbour complete the crown without an angle or achievement flag',()=>{
 const f=fixture();try{
  f.load();assert.equal(f.crown.passiveSupport(),true);assert.equal(f.events.length,0);
  f.game.playerPosition.fromArray(f.crown.state.contact);f.game.playerGrounded=false;f.step(DT);assert.equal(f.events.length,0);
  f.game.playerGrounded=true;f.step(DT);assert.equal(f.events.length,1);assert.equal(f.events[0].id,'crown');
  const proof=f.events[0].proof,w=proof.originalLoad,tray=f.physics.solids.get(f.crown.state.receiverMesh.uuid).body;
  assert.equal(proof.independentLoads,true);assert.equal(proof.originalCargo,true);assert.equal(proof.spatialMechanism,true);
  assert.equal(w.originalCargoBodyId,f.cargo.id);assert.equal(w.originalCargoShapeId,f.shape.id);assert.equal(w.supportBodyId,tray.id);assert.equal(w.supportShapeId,tray.shapes[0].id);assert.equal(w.freeOriginal,true);assert.ok(w.normalForce>0&&w.contacts>0);
  assert.ok(f.crown.state.rotors.every(r=>r.angle===0),'Prepared contact fixture intentionally bypasses geography, not a completion flag');
  f.step(.2);assert.equal(f.events.length,1,'One retained contact cannot repeatedly complete the same mechanism');
 }finally{f.dispose();}
});

test('held, servo-driven, foreign, unsupported and disabled cargo never substitute for the actual original free crown load',()=>{
 for(const kind of ['held','servo','foreign','shape','body-response','shape-response','cargo-shape-mask','support-response','support-shape-response','support-mask','support-shape-mask','support-pose','support-shape','removed-support','removed-cargo','registry','world-owner','static-original','massless-original','airborne','stale-pose']){
  const f=fixture();try{
   f.load();f.game.playerPosition.fromArray(f.crown.state.contact);
   const tray=f.physics.solids.get(f.crown.state.receiverMesh.uuid).body;
   if(kind==='held')f.game.heldCube=f.game.cargo;
   if(kind==='servo')f.physics.setCarryTarget([f.cargo.position.x,f.cargo.position.y,f.cargo.position.z]);
   if(kind==='foreign')f.game.cargo=new THREE.Object3D();
   if(kind==='shape')f.cargo.shapes[0]=new Box(new Vec3(.39,.39,.39));
   if(kind==='body-response')f.cargo.collisionResponse=false;
   if(kind==='shape-response')f.shape.collisionResponse=false;
   if(kind==='cargo-shape-mask')f.shape.collisionFilterMask=0;
   if(kind==='support-response')tray.collisionResponse=false;
   if(kind==='support-shape-response')tray.shapes[0].collisionResponse=false;
   if(kind==='support-mask')tray.collisionFilterMask=0;
   if(kind==='support-shape-mask')tray.shapes[0].collisionFilterMask=0;
   if(kind==='support-pose')tray.position.y+=.3;
   if(kind==='support-shape')tray.shapes[0]=new Box(new Vec3(1.6,.07,1.6));
   if(kind==='removed-support')f.physics.removeStaticBox(f.crown.state.receiverMesh.uuid);
   if(kind==='removed-cargo')f.physics.world.removeBody(f.cargo);
   if(kind==='registry')f.physics.solids.delete(f.crown.state.receiverMesh.uuid);
   if(kind==='world-owner')f.game.physics=new LabPhysics();
   if(kind==='static-original')f.cargo.type=Body.STATIC;
   if(kind==='massless-original')f.cargo.mass=0;
   if(kind==='airborne'||kind==='stale-pose'){f.cargo.position.y+=kind==='airborne'?3:.3;f.cargo.aabbNeedsUpdate=true;}
   assert.equal(f.crown.passiveSupport(),false,kind);f.crown.update(DT);assert.equal(f.events.length,0,kind);
  }finally{f.dispose();}
 }
});

test('whole-attempt reset restores both owned poses and retains bodies, shape identities and resources',()=>{
 const f=fixture();try{
  const rotors=f.crown.state.rotors,closed=rotors.map(r=>({position:r.mesh.position.clone(),quaternion:r.mesh.quaternion.clone()})),bodies=rotors.map(r=>r.body),geometries=[...f.k.geometries],materials=[...f.k.materials];
  f.open(0);f.open(1);f.crown.reset();f.crown.syncPose();
  rotors.forEach((r,i)=>{assert.equal(r.angle,0);assert.equal(r.target,0);assert.equal(r.blocked,false);assert.equal(r.body,bodies[i]);assert.ok(r.mesh.position.distanceTo(closed[i].position)<1e-8);assert.ok(r.mesh.quaternion.angleTo(closed[i].quaternion)<1e-7);ownedPose(f,r);});
  assert.deepEqual([...f.k.geometries],geometries);assert.deepEqual([...f.k.materials],materials);assert.equal(f.physics.cargoBody,f.cargo);assert.equal(f.cargo.shapes[0],f.shape);
  const ids=rotors.map(r=>r.mesh.uuid);f.crown.dispose();f.crown.dispose();assert.ok(bodies.every(b=>!f.physics.world.bodies.includes(b)));assert.ok(ids.every(id=>!f.physics.bodyBoxes.has(id)));assert.ok(rotors.every(r=>r.collider.enabled===false&&!r.collider.orientedBox));assert.equal(f.physics.cargoBody,f.cargo);
 }finally{f.dispose();}
});

test('unavailable crown controls reject input and invalid dt cannot manufacture rotor motion or completion',()=>{
 const locked=fixture({available:()=>false});try{assert.equal(locked.crown.state.toggle(0),false);assert.equal(locked.crown.state.toggle(1),false);locked.step(.2);assert.ok(locked.crown.state.rotors.every(r=>r.angle===0));assert.equal(locked.events.length,0);}finally{locked.dispose();}
 const f=fixture();try{assert.equal(f.crown.state.toggle(0),true);for(const dt of [0,-.1,NaN,Infinity]){f.crown.update(dt);assert.ok(f.crown.state.rotors.every(r=>r.angle===0));assert.equal(f.events.length,0);}}finally{f.dispose();}
});
