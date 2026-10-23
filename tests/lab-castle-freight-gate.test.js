import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Body,Box,Vec3} from 'cannon-es';
import {LabPhysics} from '../src/game/LabPhysics.js';
import {SingularityKit} from '../src/game/LabSingularityKit.js';
import {buildCastleFreightGate} from '../src/game/LabCastleFreightGate.js';

const DT=1/120,V=(...v)=>new THREE.Vector3(...v);
const penetrates=(a,b)=>['x','y','z'].every(axis=>Math.min(a.max[axis],b.max[axis])-Math.max(a.min[axis],b.min[axis])>1e-6);

// These deliberately prepared contact/geometry fixtures are not ordinary-input
// journeys. The real production gate, Cannon contacts and original body are
// retained; no load, progress, solved flag or portal is assigned by the tests.
function fixture({latePhysics=false}={}){
 const game={scene:new THREE.Scene(),colliders:[],floors:[],cameraBlockers:[],aimBlockers:[],portalPanels:[],
  cargo:new THREE.Object3D(),heldCube:null,playerPosition:V(14,0,-14),playerVelocity:V(),playerGrounded:true};
 const k=new SingularityKit(game);k.floor(-17,17,-18,18,0);
 const physics=new LabPhysics();
 if(!latePhysics){game.physics=physics;physics.createCargo({position:[14,1,-14]});}
 const room={def:{id:'freight',at:[0,0,0],w:34,d:36,h:15},P:(x,z=0,y=0)=>[x,y,z]},events=[];
 const gate=buildCastleFreightGate({game,k,room,
  standing:(p,r=1.2)=>game.playerGrounded&&Math.hypot(game.playerPosition.x-p[0],game.playerPosition.z-p[2])<r&&Math.abs(game.playerPosition.y-p[1])<.3,
  complete:(id,proof)=>events.push({id,proof}),
  plate:(p,size,material)=>k.box([p[0],p[1]+.028,p[2]],[size,.035,size],material,{solid:false,dynamic:true}),
  sign:()=>({update(){}}),
 });
 let initialWithoutPhysics=null;
 if(latePhysics){gate.update(DT);initialWithoutPhysics=gate.diagnostics();game.physics=physics;physics.createCargo({position:[14,1,-14]});}
 for(const c of game.colliders)physics.addStaticBox(c.mesh.uuid,c.box,{kinematic:c.kinematic});
 const cargo=physics.cargoBody,shape=cargo.shapes[0];
 const sync=()=>{game.cargo.position.copy(cargo.position);game.cargo.quaternion.copy(cargo.quaternion);};
 function placeCargo(p){
  game.heldCube=null;physics.release();cargo.position.set(...p);cargo.previousPosition.copy(cargo.position);cargo.interpolatedPosition.copy(cargo.position);
  cargo.quaternion.set(0,0,0,1);cargo.previousQuaternion.copy(cargo.quaternion);cargo.interpolatedQuaternion.copy(cargo.quaternion);
  cargo.velocity.setZero();cargo.angularVelocity.setZero();cargo.force.setZero();cargo.torque.setZero();cargo.aabbNeedsUpdate=true;cargo.wakeUp();physics.world.broadphase.dirty=true;sync();
 }
 function step(seconds=DT,observe=()=>{}){for(let i=0;i<Math.round(seconds/DT);i++){gate.update(DT);physics.step(DT);sync();observe();}}
 function until(predicate,seconds,message){for(let i=0;i<Math.ceil(seconds/DT)&&!predicate();i++)step();assert.ok(predicate(),message+' '+JSON.stringify(gate.diagnostics()));}
 function loadInner(){placeCargo([-10,1,8]);until(()=>gate.state.innerLoaded,2,'Original free cargo did not load the inner tray');}
 function open(){loadInner();assert.equal(gate.toggle(),true);until(()=>gate.state.progress===1,5,'Loaded return gate did not open');}
 sync();return{game,k,physics,room,gate,cargo,shape,events,initialWithoutPhysics,sync,step,until,placeCargo,loadInner,open,
  dispose(){k.dispose();physics.dispose();}};
}

function positiveTrayContacts(f,mesh){
 const solid=f.physics.solids.get(mesh.uuid),support=solid.body,shape=support.shapes[0];
 return f.physics.world.contacts.filter(c=>c.enabled!==false&&c.multiplier>1e-6&&[c.bi,c.bj].includes(f.cargo)&&[c.bi,c.bj].includes(support)&&[c.si,c.sj].includes(f.shape)&&[c.si,c.sj].includes(shape)&&(c.bi===f.cargo?-c.ni.y:c.ni.y)>.65);
}

function assertRegisteredPose(f,mesh){
 const c=mesh.userData.collider,s=f.physics.solids.get(mesh.uuid),centre=c.box.getCenter(V()),half=c.box.getSize(V()).multiplyScalar(.5);
 assert.ok(s?.inWorld&&s.body.world===f.physics.world);assert.ok(centre.distanceTo(V().copy(s.body.position))<1e-7);
 assert.ok(half.distanceTo(V().copy(s.body.shapes[0].halfExtents))<1e-7);assert.equal(s.body.collisionResponse,true);assert.equal(c.enabled,true);
}

test('empty waiting, coincident airborne cargo and repeated controls cannot release the freight gate',()=>{
 const f=fixture();try{
  for(let i=0;i<15;i++){assert.equal(f.gate.toggle(),false);f.step(.1);}
  assert.equal(f.gate.state.progress,0);assert.equal(f.gate.state.boltLift,0);assert.equal(f.gate.state.passable,false);assert.equal(f.events.length,0);
  f.placeCargo([-10,6,8]);assert.equal(f.gate.state.innerLoaded,false);assert.equal(f.gate.toggle(),false);
  assert.equal(f.gate.passiveSupport(),false);
 }finally{f.dispose();}
});

test('the load release is an actual positive contact with the original free body and the finite tray',()=>{
 const f=fixture();try{
  f.loadInner();assert.ok(positiveTrayContacts(f,f.gate.state.receiverMesh).length>0);assert.equal(f.gate.passiveSupport(),true);
  const d=f.gate.diagnostics();assert.equal(d.innerLoad.originalCargoBodyId,f.cargo.id);assert.equal(d.innerLoad.originalCargoShapeId,f.shape.id);
  assert.ok(d.innerLoad.normalForce>0);assert.ok(d.innerLoad.contacts>0);assert.equal(d.innerLoad.worldStep,f.physics.world.stepnumber);
  assert.equal(d.readsAchievements,false);assert.equal(d.checkpoint,false);assert.equal(f.gate.toggle(),true);
  f.until(()=>f.gate.state.progress>.2,3,'The real load did not release and move the gate');
  assert.ok(f.gate.state.boltLift>.95);assert.equal(f.physics.cargoBody,f.cargo);assert.equal(f.cargo.shapes[0],f.shape);
 }finally{f.dispose();}
});

test('held cargo, a carry servo and disabled body/shape/support responses invalidate a retained contact immediately',()=>{
 const f=fixture();try{
  f.loadInner();const support=f.physics.solids.get(f.gate.state.receiverMesh.uuid).body;
  f.game.heldCube=f.game.cargo;assert.equal(f.gate.state.innerLoaded,false);assert.equal(f.gate.toggle(),false);f.game.heldCube=null;
  f.physics.setCarryTarget([-10,1,8]);assert.equal(f.gate.state.innerLoaded,false);assert.equal(f.gate.toggle(),false);f.physics.release();f.step(.1);
  for(const object of [f.cargo,f.shape,support,support.shapes[0]]){
   assert.equal(f.gate.state.innerLoaded,true);object.collisionResponse=false;
   assert.equal(f.gate.state.innerLoaded,false);assert.equal(f.gate.passiveSupport(),false);assert.equal(f.gate.toggle(),false);
   object.collisionResponse=true;f.step(DT);
  }
  const mask=support.collisionFilterMask;support.collisionFilterMask=0;assert.equal(f.gate.state.innerLoaded,false);support.collisionFilterMask=mask;f.step(DT);
  const before=f.cargo.position.clone();f.cargo.position.y+=3;f.cargo.aabbNeedsUpdate=true;
  assert.equal(f.gate.state.innerLoaded,false,'A same-step vertical move cannot reuse an old contact multiplier');
  f.cargo.position.copy(before);f.cargo.aabbNeedsUpdate=true;f.step(DT);assert.equal(f.gate.state.innerLoaded,true);
 }finally{f.dispose();}
});

test('a foreign physical body, render identity or removed tray cannot impersonate the original supported cargo',()=>{
 const f=fixture();try{
  f.loadInner();const foreign=new Body({mass:f.cargo.mass,position:f.cargo.position.clone()});foreign.addShape(new Box(new Vec3(...f.shape.halfExtents.toArray())));f.physics.world.addBody(foreign);
  f.physics.cargoBody=foreign;assert.equal(f.gate.state.innerLoaded,false);assert.equal(f.gate.toggle(),false);f.physics.cargoBody=f.cargo;f.physics.world.removeBody(foreign);
  const original=f.game.cargo;f.game.cargo=new THREE.Object3D();assert.equal(f.gate.state.innerLoaded,false);f.game.cargo=original;f.step(DT);
  f.cargo.shapes[0]=new Box(new Vec3(...f.shape.halfExtents.toArray()));assert.equal(f.gate.state.innerLoaded,false,'An identical replacement shape is not the original supported shape');f.cargo.shapes[0]=f.shape;f.step(DT);
  const solid=f.physics.solids.get(f.gate.state.receiverMesh.uuid);f.physics.world.removeBody(solid.body);
  assert.equal(f.gate.state.innerLoaded,false);assert.equal(f.gate.toggle(),false);f.physics.world.addBody(solid.body);f.step(DT);assert.equal(f.gate.state.innerLoaded,true);
 }finally{f.dispose();}
});

test('the old aiming slit remains optically open while the closed return doorway is opaque',()=>{
 const f=fixture(),ray=new THREE.Raycaster();try{
  f.k.root.updateMatrixWorld(true,true);
  const solids=f.game.colliders.map(c=>c.mesh);
  ray.set(V(2,2,-10),V(-1,0,0));ray.far=4;
  assert.equal(ray.intersectObjects(solids,false).length,0,'A new fitting seals the original finite sight slit');
  ray.set(V(2,2,8),V(-1,0,0));
  assert.ok(ray.intersectObjects(solids,false).some(h=>f.gate.state.leaves.includes(h.object)),'The closed gate must block the same standing-height optical ray');
  assert.ok(f.gate.state.leaves.every(m=>!f.game.portalPanels.includes(m)&&!m.material.transparent));
 }finally{f.dispose();}
});

test('both complete orthogonal strokes continuously clear fixed geometry and retain live matching collider bodies',()=>{
 const f=fixture();try{
  const fixed=f.game.colliders.filter(c=>!c.kinematic),leaves=f.gate.state.leaves;
  f.loadInner();assert.equal(f.gate.toggle(),true);let samples=0,sawOutward=false,sawLateral=false;
  const inspect=()=>{
   const before=leaves.map(mesh=>mesh.userData.collider.box.clone()),prior=f.gate.state.progress;
   f.step(DT);const progress=f.gate.state.progress;
   if(progress===prior)return;
   samples++;if(progress<=.2)sawOutward=true;else sawLateral=true;
   for(let i=0;i<leaves.length;i++){
    const sweep=before[i].union(leaves[i].userData.collider.box);
    for(const obstacle of fixed)assert.equal(penetrates(sweep,obstacle.box),false,`Swept leaf penetrates ${obstacle.mesh.name} at ${progress}`);
    assertRegisteredPose(f,leaves[i]);
   }
  };
  for(let i=0;i<700&&f.gate.state.progress<1;i++)inspect();
  assert.equal(f.gate.state.progress,1);assert.equal(f.gate.state.passable,true);assert.ok(samples>100&&sawOutward&&sawLateral);
  f.placeCargo([14,1,-14]);assert.equal(f.gate.toggle(),true);
  for(let i=0;i<700&&f.gate.state.progress>0;i++)inspect();
  assert.equal(f.gate.state.progress,0);assert.equal(f.gate.state.passable,false);
 }finally{f.dispose();}
});

test('opening stops before its first outward stroke can push a player into the receiving chamber',()=>{
 const f=fixture();try{
  f.loadInner();assert.equal(f.gate.toggle(),true);f.game.playerPosition.set(-.95,0,6.85);
  f.step(2);assert.equal(f.gate.state.blocked,true);assert.ok(f.gate.state.progress<.2);
  const actor=new THREE.Box3(V(-.95-.43,0,6.85-.43),V(-.95+.43,2.4,6.85+.43));
  for(const mesh of f.gate.state.leaves)assert.equal(penetrates(actor,mesh.userData.collider.box),false,'An occupied outward sweep must stop before collision');
  f.game.playerPosition.set(14,0,-14);f.until(()=>f.gate.state.progress===1,5,'Opening did not recover after the player cleared its sweep');
 }finally{f.dispose();}
});

for(const occupant of ['player','free cargo','held cargo','carry target'])test(`closing retains the passage while occupied by ${occupant}`,()=>{
 const f=fixture();try{
  f.open();f.placeCargo([14,1,-14]);
  if(occupant==='player')f.game.playerPosition.set(0,0,8);
  else if(occupant==='free cargo')f.placeCargo([0,.6,8]);
  else if(occupant==='held cargo'){f.placeCargo([0,1.4,8]);f.game.heldCube=f.game.cargo;}
  else f.physics.setCarryTarget([0,1.4,8]);
  assert.equal(f.gate.toggle(),true);f.step(.5);
  assert.equal(f.gate.state.blocked,true);assert.equal(f.gate.state.progress,1);assert.equal(f.gate.state.passable,true);
  f.game.playerPosition.set(14,0,-14);f.placeCargo([14,1,-14]);
  f.until(()=>f.gate.state.progress===0,5,'Closing did not recover when the entire passage was clear');
 }finally{f.dispose();}
});

test('an opened load latch retains without cargo, reverses mid-stroke, and requires a fresh load after fully closing',()=>{
 const f=fixture();try{
  f.open();f.placeCargo([14,1,-14]);f.step(.5);assert.equal(f.gate.state.innerLoaded,false);assert.equal(f.gate.state.progress,1);
  assert.equal(f.gate.toggle(),true);f.until(()=>f.gate.state.progress<.65,2,'Closing did not move');
  const partial=f.gate.state.progress;assert.equal(f.gate.toggle(),true);f.step(.2);assert.ok(f.gate.state.progress>partial,'The unseated gate must permit a genuine reverse without another load');
  assert.equal(f.gate.toggle(),true);f.until(()=>f.gate.state.progress===0,5,'The reversed gate did not close');f.step(.5);
  assert.equal(f.gate.state.boltLift,0);assert.equal(f.gate.toggle(),false,'A fully seated bolt needs the original load again');
 }finally{f.dispose();}
});

test('only the physically returned free original and a separate standing traveller complete the freight exchange',()=>{
 const f=fixture();try{
  f.open();assert.equal(f.events.length,0,'Opening alone is not completion');
  f.placeCargo([8,1,12]);f.until(()=>f.gate.state.returnLoaded,2,'Original cargo did not load the return tray');
  assert.ok(positiveTrayContacts(f,f.gate.state.returnMesh).length>0);f.step(.1);assert.equal(f.events.length,0,'The traveller must reach the separate contact');
  f.game.playerPosition.fromArray(f.gate.state.contact);f.game.playerGrounded=false;f.step(.1);assert.equal(f.events.length,0);
  f.game.playerGrounded=true;f.step(DT);assert.equal(f.events.length,1);assert.equal(f.events[0].id,'freight');
  const proof=f.events[0].proof;assert.equal(proof.physicalLoadRelease.originalCargoBodyId,f.cargo.id);assert.equal(proof.returnedOriginalLoad.originalCargoBodyId,f.cargo.id);
  assert.ok(proof.physicalLoadRelease.normalForce>0&&proof.returnedOriginalLoad.normalForce>0);assert.equal(proof.readsAchievements,false);f.step(.1);assert.equal(f.events.length,1);
 }finally{f.dispose();}
});

test('whole-attempt reset restores leaf and bolt poses without changing the original body or adding resources',()=>{
 const f=fixture();try{
  const {gate}=f,closed=gate.state.leaves.map(m=>m.position.toArray()),bolt=gate.state.bolt.position.toArray();
  const bodies=[...f.physics.world.bodies],colliders=[...f.game.colliders],body=f.cargo,shape=f.shape;
  f.open();f.placeCargo([14,1,-14]);gate.reset();
  assert.equal(gate.state.progress,0);assert.equal(gate.state.boltLift,0);assert.equal(gate.state.requestedOpen,false);assert.equal(gate.state.blocked,false);assert.equal(gate.state.passable,false);
  for(let i=0;i<closed.length;i++)assert.ok(gate.state.leaves[i].position.distanceTo(V(...closed[i]))<1e-10);
  assert.ok(gate.state.bolt.position.distanceTo(V(...bolt))<1e-10);
  for(const mesh of [...gate.state.leaves,gate.state.bolt])assertRegisteredPose(f,mesh);
  assert.equal(f.physics.cargoBody,body);assert.equal(body.shapes[0],shape);assert.deepEqual(f.physics.world.bodies,bodies);assert.deepEqual(f.game.colliders,colliders);
  gate.reset();assert.equal(gate.toggle(),false);assert.equal(f.events.length,0);
 }finally{f.dispose();}
});


test('an initial positive-dt update before physics exists remains locked and binds the eventual original body',()=>{
 const f=fixture({latePhysics:true});try{
  assert.equal(f.initialWithoutPhysics.progress,0);assert.equal(f.initialWithoutPhysics.boltLift,0);assert.equal(f.initialWithoutPhysics.originalCargoBodyId,null);
  assert.equal(f.gate.state.innerLoaded,false);assert.equal(f.gate.toggle(),false);
  f.loadInner();assert.equal(f.gate.diagnostics().originalCargoBodyId,f.cargo.id);assert.equal(f.gate.toggle(),true);
  f.until(()=>f.gate.state.progress===1,5,'The lazily initialized original body did not open its own gate');
 }finally{f.dispose();}
});

test('zero, negative and non-finite dt cannot advance a released gate or rewrite its contact witnesses',()=>{
 const f=fixture();try{
  f.loadInner();assert.equal(f.gate.toggle(),true);f.step(.6);
  const before={progress:f.gate.state.progress,boltLift:f.gate.state.boltLift,step:f.physics.world.stepnumber,inner:f.gate.diagnostics().innerLoad,leaves:f.gate.state.leaves.map(m=>m.position.toArray())};
  for(const dt of [0,-1,NaN,Infinity,-Infinity])f.gate.update(dt);
  assert.equal(f.gate.state.progress,before.progress);assert.equal(f.gate.state.boltLift,before.boltLift);assert.equal(f.physics.world.stepnumber,before.step);
  assert.deepEqual(f.gate.diagnostics().innerLoad,before.inner);assert.deepEqual(f.gate.state.leaves.map(m=>m.position.toArray()),before.leaves);
 }finally{f.dispose();}
});

test('the visible retaining bolt travels through an actually open guide without penetrating fixed metal',()=>{
 const f=fixture();try{
  const bolt=f.gate.state.bolt,fixed=f.game.colliders.filter(c=>!c.kinematic);
  f.loadInner();assert.equal(f.gate.toggle(),true);let moved=0;
  for(let i=0;i<600&&f.gate.state.progress<1;i++){
   const before=bolt.userData.collider.box.clone();f.step(DT);const after=bolt.userData.collider.box;
   if(!before.equals(after)){
    moved++;const sweep=before.union(after);
    for(const c of fixed)assert.equal(penetrates(sweep,c.box),false,'The real bolt enters solid '+c.mesh.name);
    assertRegisteredPose(f,bolt);
   }
   if(f.gate.state.progress>0)for(const leaf of f.gate.state.leaves)assert.ok(after.min.y>leaf.userData.collider.box.max.y+.01,'The bolt must physically clear both leaves before their stroke starts');
  }
  assert.ok(moved>20);assert.equal(f.gate.state.progress,1);
 }finally{f.dispose();}
});


test('a real load on the near return tray cannot replace opening the gate and releasing its far-side interlock',()=>{
 const f=fixture();try{
  f.placeCargo([8,1,12]);f.until(()=>f.gate.state.returnLoaded,2,'The near tray must actually be loaded for this counterfactual');
  assert.ok(positiveTrayContacts(f,f.gate.state.returnMesh).length>0);
  f.game.playerPosition.fromArray(f.gate.state.contact);f.step(.5);
  assert.equal(f.gate.state.passable,false);assert.equal(f.gate.state.innerLoaded,false);assert.equal(f.gate.toggle(),false);assert.equal(f.events.length,0);
 }finally{f.dispose();}
});

function closeLeavesBeforeBoltSeats(f){
 f.open();f.placeCargo([14,1,-14]);assert.equal(f.gate.toggle(),true);
 f.until(()=>f.gate.state.progress===0,5,'The empty leaves did not return to their closed rebate');
 assert.equal(f.gate.state.boltLift,1,'This fixture samples the real frame between leaf seating and bolt descent');
}

// These are explicit high-pose geometry samples, with one gate update before
// Cannon advances. The raising samples deliberately probe the guarded upper
// channel; its fixed cheeks prevent an ordinary traveller from entering it.
// They verify protective behavior, not ordinary-input reachability.
for(const direction of ['raising','lowering'])for(const occupant of ['player','free cargo','held cargo','carry target'])test(`a prepared ${direction} bolt intrusion by ${occupant} stops and resumes without moving the occupant`,()=>{
 const f=fixture();try{
  if(direction==='raising'){f.loadInner();assert.equal(f.gate.toggle(),true);}
  else closeLeavesBeforeBoltSeats(f);
  const high=direction==='raising',center=[-.98,high?5.22:3.95,8];let actor;
  if(occupant==='player'){
   f.game.playerPosition.set(-1,high?4.8:1.8,8);const p=f.game.playerPosition;
   actor=new THREE.Box3(V(p.x-.48,p.y,p.z-.48),V(p.x+.48,p.y+2.4,p.z+.48));
  }else if(occupant==='carry target'){
   f.physics.setCarryTarget(center);const h=f.shape.halfExtents;
   actor=new THREE.Box3(V(...center).sub(V(h.x,h.y,h.z)),V(...center).add(V(h.x,h.y,h.z)));
  }else{
   f.placeCargo(center);if(occupant==='held cargo')f.game.heldCube=f.game.cargo;
   f.cargo.updateAABB();actor=new THREE.Box3(V().copy(f.cargo.aabb.lowerBound),V().copy(f.cargo.aabb.upperBound));
  }
  const before=f.gate.state.bolt.userData.collider.box.clone(),lift=f.gate.state.boltLift,progress=f.gate.state.progress;
  const bodyPose=f.cargo.position.clone(),playerPose=f.game.playerPosition.clone();
  assert.equal(penetrates(actor,before),false,'The prepared actor starts clear of the current real pin');
  f.gate.update(.2);
  assert.equal(f.gate.state.blocked,true);assert.equal(f.gate.state.boltLift,lift);assert.equal(f.gate.state.progress,progress);
  assert.ok(f.gate.state.bolt.userData.collider.box.equals(before));assert.equal(penetrates(actor,f.gate.state.bolt.userData.collider.box),false);
  assert.equal(f.cargo.position.distanceTo(bodyPose),0);assert.ok(f.game.playerPosition.equals(playerPose));
  f.game.playerPosition.set(14,0,-14);f.placeCargo([14,1,-14]);
  f.until(()=>f.gate.state.boltLift===(high?1:0),2,'The bolt did not resume after the interference cleared');
  assert.equal(f.gate.state.blocked,false);assertRegisteredPose(f,f.gate.state.bolt);
 }finally{f.dispose();}
});

test('a genuinely supported high free cargo stops the descending pin before contact and remains on its prepared pedestal',()=>{
 const f=fixture();try{
  closeLeavesBeforeBoltSeats(f);
  // This extra founded support is a clearly identified stack fixture, not a
  // modification to the level. Its top supports the free original body while
  // its own volume remains completely clear of the bolt and leaf sweeps.
  const support=f.k.box([-1.1,1.78,8],[.7,3.56,.7],f.k.m.dark);support.name='Prepared high cargo support fixture';
  f.physics.addStaticBox(support.uuid,support.userData.collider.box);
  const supportBody=f.physics.solids.get(support.uuid).body;
  f.placeCargo([-.98,3.95,8]);
  f.until(()=>f.gate.state.blocked,.6,'The descending pin ignored the actually supported high cargo');
  f.step(.3,()=>{
   f.cargo.updateAABB();const actor=new THREE.Box3(V().copy(f.cargo.aabb.lowerBound),V().copy(f.cargo.aabb.upperBound));
   assert.equal(penetrates(actor,f.gate.state.bolt.userData.collider.box),false,'The protected pin entered the actual high cargo bounds');
  });
  const contacts=f.physics.world.contacts.filter(c=>c.enabled!==false&&c.multiplier>1e-6&&[c.bi,c.bj].includes(f.cargo)&&[c.bi,c.bj].includes(supportBody)&&(c.bi===f.cargo?-c.ni.y:c.ni.y)>.65);
  assert.ok(contacts.length>0,'The free original must carry a real positive support impulse on the stack fixture');
  assert.equal(f.game.heldCube,null);assert.equal(f.physics.carryTarget,null);assert.equal(f.gate.state.progress,0);assert.ok(f.gate.state.boltLift>0);
  assert.ok(Math.abs(f.cargo.position.x+.98)<.03&&Math.abs(f.cargo.position.y-3.95)<.03,'The bolt displaced the supported original body');
  f.placeCargo([14,1,-14]);f.until(()=>f.gate.state.boltLift===0,2,'The pin did not finish seating after the high stack cleared');
 }finally{f.dispose();}
});

test('a rotated high carry target reserves its actual oriented extent before the descending pin reaches it',()=>{
 const f=fixture();try{
  closeLeavesBeforeBoltSeats(f);
  const target=[-1.05,3.88,8],q=new THREE.Quaternion().setFromAxisAngle(V(0,0,1),Math.PI/4);
  f.physics.setCarryTarget(target,{quaternion:q});
  const h=f.shape.halfExtents,axisAlignedTop=target[1]+h.y+.04,rotatedTop=target[1]+(h.x+h.y)*Math.SQRT1_2+.04;
  const nextPinBottom=4.32+.65*(1-3*.05)-.45;
  assert.ok(axisAlignedTop<nextPinBottom&&rotatedTop>nextPinBottom,'Only the rotated extent should intersect this sampled stroke');
  f.gate.update(.05);assert.equal(f.gate.state.blocked,true);assert.equal(f.gate.state.boltLift,1);
  assert.ok(f.cargo.position.x>10,'This interference must come from the proposed grip, independently of the distant real body');
  f.physics.release();f.until(()=>f.gate.state.boltLift===0,2,'The pin did not resume after the rotated grip was removed');
 }finally{f.dispose();}
});

test('tray perimeter lights remain below and outside both real load surfaces and the readout has a founded load path',()=>{
 const f=fixture();try{
  const lamps=f.k.meshes.filter(mesh=>mesh.material===f.k.m.idle);
  assert.equal(lamps.length,8);for(const mesh of lamps){
   const b=new THREE.Box3().setFromObject(mesh);assert.ok(b.max.y<.14);assert.equal(mesh.userData.collider,undefined);
   for(const tray of [f.gate.state.receiverMesh,f.gate.state.returnMesh]){
    const t=tray.userData.collider.box,overlapX=Math.min(b.max.x,t.max.x)-Math.max(b.min.x,t.min.x),overlapZ=Math.min(b.max.z,t.max.z)-Math.max(b.min.z,t.min.z);
    assert.ok(overlapX<=0||overlapZ<=0,'A false luminous floor covers a genuine contact pan');
   }
  }
  const named=name=>f.gate.state.parts.filter(mesh=>mesh.name==='Freight return / '+name);
  const [readout]=named('founded return readout'),arms=named('readout wall suspension'),walls=named('founded partition');
  assert.ok(readout&&arms.length===2);assert.ok(readout.userData.collider.box.min.y>4.2);
  const guideTop=Math.max(...named('bolt guide wall mounting').map(mesh=>mesh.userData.collider.box.max.y));
  assert.ok(readout.userData.collider.box.min.y>guideTop+.3,'The readout hides the guide and visible bolt release behind a solid apron');
  for(const arm of arms){
   assert.ok(penetrates(arm.userData.collider.box,readout.userData.collider.box),'A suspension fails to join the actual readout body');
   assert.ok(walls.some(w=>penetrates(arm.userData.collider.box,w.userData.collider.box)),'A suspension is not embedded in a founded partition');
   assert.ok(arm.userData.collider.box.min.y>6.3);assertRegisteredPose(f,arm);
  }
 }finally{f.dispose();}
});
