import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {LabPhysics} from '../src/game/LabPhysics.js';
import {airAcceleration} from '../src/game/LabAirForces.js';
import {createRoom14LightContact} from '../src/game/LabRoom14LightContact.js';
import {makePortalFrame,orientedBoxFitsPortal,uprightCapsuleFitsPortal} from '../src/game/LabPortals.js';

const V=(...p)=>new THREE.Vector3(...p);
function fixture({origin=[-1.5,.6,1.5],direction=[Math.SQRT1_2,0,-Math.SQRT1_2],length=4}={}){
 const physics=new LabPhysics(),cargo=physics.createCargo({position:[-5,.4,0],size:.78,mass:3.2});
 physics.addStaticBox('retained-floor',{min:[-12,-.5,-12],max:[12,0,12]},{friction:.64,restitution:.08});
 const game={physics,colliders:[],cameraBlockers:[],aimBlockers:[],portals:{ready:false}},root=new THREE.Group();
 const kit={game,world:{root},ticks:[],resets:[],state:{}};
 const field=createRoom14LightContact(kit,{origin,direction,span:[0,1,0],width:1,length});
 return {game,kit,field,physics,cargo,dispose(){field.dispose();physics.dispose();}};
}

test('room14 local light owns a true oblique body and the same finite rendered contact, ray and carry shape',()=>{
 const f=fixture();try{
  const p=f.field.pieces[0],cargo=f.cargo,shape=cargo.shapes[0];
  assert.ok(p.collider.enabled);assert.equal(p.mesh.visible,true);
  assert.ok(new THREE.Quaternion().copy(p.body.quaternion).angleTo(p.mesh.quaternion)<1e-12);
  assert.deepEqual(p.shape.halfExtents.toArray(),[2,.5,.07]);
  assert.ok(Math.abs(p.collider.orientedBox.current.quaternion.y)>.2);
  assert.equal(f.physics.solids.has(p.mesh.uuid),false);
  assert.equal(f.physics.bodyBoxes.get(p.mesh.uuid).body,p.body);
  assert.equal(f.physics.cargoSweepBoxes.get(p.mesh.uuid).shape,p.shape);
  assert.ok(f.game.cameraBlockers.includes(p.mesh)&&f.game.aimBlockers.includes(p.mesh));
  assert.equal(f.physics.inspectBodyBox(p.mesh.uuid,{bounds:p.collider.box,enabled:true}).valid,true);
  for(let n=0;n<4;n++){f.physics.step(1/120);assert.equal(f.physics.inspectBodyBox(p.mesh.uuid,{bounds:p.collider.box,enabled:true}).valid,true);}
  assert.equal(f.physics.cargoBody,cargo);assert.equal(cargo.shapes[0],shape);
 }finally{f.dispose();}
});

test('room14 configured light face supplies a real lateral contact impulse to the unchanged moving body',()=>{
 const f=fixture();try{
  const cargo=f.cargo,p=f.field.pieces[0],bodyId=cargo.id,shape=cargo.shapes[0];
  cargo.position.set(-4,.4,0);cargo.previousPosition.copy(cargo.position);let contact=false,minZ=0,oblique=false;
  const segments=[{a:V(-8,.5,0),direction:V(1,0,0),length:13}];
  for(let n=0;n<1200;n++){
   f.field.update();
   const acceleration=airAcceleration(segments,V().copy(cargo.position),V().copy(cargo.velocity),{radius:1.3,bodyRadius:.55});
   cargo.material.friction=acceleration.lengthSq()>0?.06:1;
   cargo.force.x+=acceleration.x*cargo.mass;cargo.force.z+=acceleration.z*cargo.mass;if(acceleration.lengthSq()>0)cargo.wakeUp();
   f.physics.step(1/120);minZ=Math.min(minZ,cargo.position.z);
   for(const c of f.physics.world.contacts)if(c.bi===p.body&&c.bj===cargo||c.bi===cargo&&c.bj===p.body){contact=true;oblique ||= Math.abs(c.ni.x)>.6&&Math.abs(c.ni.z)>.6;}
   for(const c of f.physics.lastCompoundCargoSweep?.corrections??[])if(c.registrationId===p.mesh.uuid&&c.guardBodyId===p.body.id&&c.shapeId===p.shape.id){contact=true;oblique ||= Math.abs(c.normal[0])>.6&&Math.abs(c.normal[2])>.6;}
  }
  assert.ok(contact&&oblique,'The actual registered Box contact or its CCD response must have the configured diagonal normal');
  assert.ok(minZ< -1,'Axial air alone must gain lateral motion through the physical face');
  assert.equal(f.field.materializationBlocked,false,'An established face stays solid when an ordinary moving original approaches');
  assert.ok(Math.abs(f.field.pieces[0].mesh.scale.x-4)<1e-10);
  assert.equal(cargo.id,bodyId);assert.equal(cargo.shapes[0],shape);assert.equal(cargo.mass,3.2);
 }finally{f.dispose();}
});

test('room14 unchanged ray updates reuse convex shapes and preserve contact history',()=>{
 const f=fixture();try{
  const p=f.field.pieces[0],update=p.shape.updateConvexPolyhedronRepresentation;let calls=0;
  p.shape.updateConvexPolyhedronRepresentation=function(...a){calls++;return update.apply(this,a);};
  f.physics.step(1/120);const before=JSON.stringify({previous:p.descriptor.previous.center.toArray(),step:p.descriptor.step,energy:f.cargo.velocity.lengthSquared()});
  for(let n=0;n<240;n++)f.field.update();
  assert.equal(calls,0);assert.equal(JSON.stringify({previous:p.descriptor.previous.center.toArray(),step:p.descriptor.step,energy:f.cargo.velocity.lengthSquared()}),before);
 }finally{f.dispose();}
});

test('room14 readdress wakes only a nearby sleeping original body when the finite sheet changes',()=>{
 const origin=[5,.6,1.5],f=fixture({origin});try{
  f.cargo.position.set(-3,.4,0);f.cargo.sleep();assert.equal(f.cargo.sleepState,2);
  origin[0]=6;f.field.update();assert.equal(f.cargo.sleepState,2,'A remote light readdress must not wake unrelated cargo');
  origin[0]=-4.5;f.field.update();assert.equal(f.cargo.sleepState,0,'A newly intersecting real solid must wake the original body');
 }finally{f.dispose();}
});

test('room14 a newly addressed field stops at the original stationary cargo instead of ejecting it',()=>{
 const origin=[5,.6,1.5],f=fixture({origin});try{
  f.cargo.position.set(-3,.4,0);f.cargo.previousPosition.copy(f.cargo.position);f.cargo.velocity.setZero();
  origin[0]=-4.5;f.field.update();assert.equal(f.field.materializationBlocked,true);
  const initial=f.cargo.position.clone(),body=f.cargo,shape=body.shapes[0];
  for(let n=0;n<120;n++){f.field.update();f.physics.step(1/120);}
  assert.ok(Math.hypot(body.position.x-initial.x,body.position.z-initial.z)<.001,'Field creation must not manufacture a lateral launch');
  assert.equal(f.physics.cargoBody,body);assert.equal(body.shapes[0],shape);
  for(let n=0;n<120;n++){body.force.z-=80;body.wakeUp();f.field.update();f.physics.step(1/120);}
  f.field.update();assert.equal(f.field.materializationBlocked,false);assert.ok(Math.abs(f.field.pieces[0].mesh.scale.x-4)<1e-10);
 }finally{f.dispose();}
});

test('room14 optical aperture passes a thin sheet but excludes the complete original cargo and player',()=>{
 const aperture=makePortalFrame(V(),V(1,0,0),V(0,1,0),{width:.30,height:1.1});
 assert.equal(uprightCapsuleFitsPortal(aperture,2.4,.44),false);
 for(let x=0;x<4;x++)for(let y=0;y<4;y++)for(let z=0;z<4;z++){
  const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(x*Math.PI/8,y*Math.PI/8,z*Math.PI/8));
  assert.equal(orientedBoxFitsPortal(aperture,V(),q,.39),false);
 }
});

test('room14 a blocked new field retains its already solid prefix during actual cargo approach',()=>{
 const origin=[5,.6,1.5],f=fixture({origin});try{
  f.cargo.position.set(-3,.4,0);f.cargo.previousPosition.copy(f.cargo.position);f.cargo.velocity.setZero();
  origin[0]=-4.5;f.field.update();assert.equal(f.field.materializationBlocked,true);
  const prefix=f.field.pieces[0].mesh.scale.x;
  assert.ok(prefix>0&&prefix<4);
  for(let n=0;n<120;n++){
   f.cargo.force.x-=50*Math.SQRT1_2;f.cargo.force.z+=50*Math.SQRT1_2;f.cargo.wakeUp();
   f.field.update();f.physics.step(1/120);
   assert.ok(f.field.pieces[0].mesh.scale.x>=prefix-1e-12,'An already real contact must not clip away on approach');
  }
 }finally{f.dispose();}
});

test('room14 disposal removes each owned body and all query owners without changing the retained world',()=>{
 const f=fixture(),bodies=f.field.pieces.map(p=>p.body),material=f.field.material,geometry=f.field.geometry;
 let materialDisposals=0,geometryDisposals=0;material.addEventListener('dispose',()=>materialDisposals++);geometry.addEventListener('dispose',()=>geometryDisposals++);
 f.field.dispose();f.field.dispose();
 assert.equal(f.physics.bodyBoxes.size,0);assert.equal(f.physics.cargoSweepBoxes.size,0);
 assert.ok(bodies.every(b=>!f.physics.world.bodies.includes(b)));
 assert.equal(f.game.colliders.length,0);assert.equal(f.game.cameraBlockers.length,0);assert.equal(f.game.aimBlockers.length,0);
 assert.equal(materialDisposals,1);assert.equal(geometryDisposals,1);assert.equal(f.physics.solids.size,1);assert.equal(f.physics.cargoBody,f.cargo);f.physics.dispose();
});
