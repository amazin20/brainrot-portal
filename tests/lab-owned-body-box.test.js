import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Body,Box,Sphere,Vec3} from 'cannon-es';
import {LabPhysics} from '../src/game/LabPhysics.js';
import {createOrientedBoxContact,syncOrientedBoxContact} from '../src/game/LabOrientedBoxContact.js';
import {auditSingularityContacts} from '../scripts/singularity-adversarial-audit.mjs';

function fixture({register=true,dynamic=true}={}){
 const physics=new LabPhysics();physics.createCargo({position:[0,1,0]});
 const body=new Body({mass:dynamic?2:0,position:new Vec3(3,2,5),collisionFilterGroup:1,collisionFilterMask:2});
 body.quaternion.setFromAxisAngle(new Vec3(0,0,1),.43);
 const half=new Vec3(1.2,.25,.4),offset=new Vec3(.7,-.2,.3),shape=new Box(half);
 body.addShape(shape,offset);physics.world.addBody(body);
 const orientedBox=createOrientedBoxContact(body,new THREE.Vector3(half.x,half.y,half.z),new THREE.Vector3(offset.x,offset.y,offset.z),physics.world.stepnumber);
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(half.x*2,half.y*2,half.z*2),new THREE.MeshBasicMaterial());
 mesh.name='owned real Box fixture';mesh.position.copy(orientedBox.current.center);mesh.quaternion.copy(orientedBox.current.quaternion);mesh.updateWorldMatrix(true,false);
 const collider={mesh,box:new THREE.Box3().setFromObject(mesh),enabled:true,kinematic:dynamic,orientedBox};mesh.userData.collider=collider;
 const game={physics,colliders:[collider],cameraBlockers:[mesh],aimBlockers:[mesh],playerPosition:new THREE.Vector3(),playerGrounded:false,
  firstLevel:{singularity:true,rooms:new Map(),structure:new THREE.Group(),getTowerMetrics:()=>({solvedIds:[]})}};
 const registration={body,shapeIndex:0,orientedBox},id=mesh.uuid;
 if(register)physics.registerBodyBox(id,registration);
 const dispose=()=>{physics.dispose();mesh.geometry.dispose();mesh.material.dispose();};
 return {physics,body,shape,offset,orientedBox,mesh,collider,game,registration,id,dispose};
}

test('owned Box registration binds the actual shape without adding a proxy or entering static sweeps',()=>{
 const f=fixture({register:false});
 try{
  const bodies=[...f.physics.world.bodies],shapes=[...f.body.shapes],position=f.body.position.clone(),quaternion=f.body.quaternion.clone();
  assert.equal(f.physics.registerBodyBox(f.id,f.registration),true);
  assert.deepEqual(f.physics.world.bodies,bodies);assert.deepEqual(f.body.shapes,shapes);
  assert.deepEqual(f.body.position,position);assert.deepEqual(f.body.quaternion,quaternion);
  const entry=f.physics.bodyBoxes.get(f.id);assert.equal(entry.body,f.body);assert.equal(entry.shape,f.shape);assert.equal(entry.shapeIndex,0);assert.equal(entry.orientedBox,f.orientedBox);
  assert.equal(f.physics.solids.has(f.id),false);assert.equal(f.physics.cargoSweepBoxes.size,0);
  assert.equal(f.physics.inspectBodyBox(f.id,{orientedBox:f.collider.orientedBox,bounds:f.collider.box}).valid,true);
  assert.throws(()=>f.physics.addStaticBox(f.id,{min:[0,0,0],max:[1,1,1]}),/already exists/);
  assert.throws(()=>f.physics.addStaticRamp(f.id,{minX:0,maxX:1,minZ:0,maxZ:1,lowY:0,highY:1}),/already exists/);
  assert.throws(()=>f.physics.registerBodyBox(f.id,f.registration),/unique/);
  assert.throws(()=>f.physics.registerBodyBox('second-id',f.registration),/already registered/);
  assert.equal(f.physics.removeBodyBox(f.id),true);assert.equal(f.physics.removeBodyBox(f.id),false);
  assert.equal(f.physics.world.bodies.includes(f.body),true,'Removing metadata must not remove the shared physical owner');
  f.physics.registerBodyBox(f.id,f.registration);
  const removeBody=f.physics.world.removeBody.bind(f.physics.world);f.physics.world.removeBody=body=>{assert.equal(f.physics.bodyBoxes.size,0,'Ownership metadata must be cleared before owner bodies leave the world');return removeBody(body);};
  f.physics.dispose();assert.equal(f.physics.bodyBoxes.size,0);assert.equal(f.physics.world.bodies.length,0);
 }finally{f.dispose();}
});

for(const dynamic of [false,true])test(`castle registry audit accepts a live actual ${dynamic?'dynamic':'static'} compound Box with exact visible/ray/contact ownership`,()=>{
 const f=fixture({dynamic});try{const report=auditSingularityContacts(f.game);assert.equal(report.pass,true,JSON.stringify(report.failures));assert.equal(report.registry.ownedBodyBoxes,1);}finally{f.dispose();}
});

const invalidRegistrations=[
 ['unowned world body',f=>f.physics.world.removeBody(f.body),'body-not-in-world'],
 ['missing actual shape',f=>f.registration.shapeIndex=1,'shape-identity'],
 ['wrong descriptor body',f=>f.orientedBox.body=new Body(),'oriented-box-identity'],
 ['wrong local half',f=>f.orientedBox.half.x+=.1,'local-shape-contact'],
 ['wrong local offset',f=>f.orientedBox.offset.x+=.1,'local-shape-contact'],
 ['unsupported local rotation',f=>f.body.shapeOrientations[0].setFromAxisAngle(new Vec3(0,1,0),.1),'local-shape-orientation'],
 ['nonfinite body pose',f=>f.body.position.x=NaN,'finite-body-pose'],
 ['nonfinite contact bounds',f=>f.orientedBox.current.bounds.min.x=NaN,'contact-bounds'],
 ['stale step',f=>f.orientedBox.step--,'stale-contact-step'],
 ['disabled body mask',f=>f.body.collisionFilterMask=0,'cargo-contact-mask'],
 ['disabled actual shape',f=>f.shape.collisionResponse=false,'cargo-contact-mask'],
];
for(const [name,mutate,reason]of invalidRegistrations)test(`owned Box registration rejects ${name}`,()=>{
 const f=fixture({register:false});try{mutate(f);assert.throws(()=>f.physics.registerBodyBox(f.id,f.registration),new RegExp(reason));assert.equal(f.physics.bodyBoxes.size,0);}finally{f.dispose();}
});

test('owned Box registration rejects a duplicate historical static id and non-Box shapes',()=>{
 const f=fixture({register:false});try{
  f.physics.addStaticBox(f.id,{min:[0,0,0],max:[1,1,1]});assert.throws(()=>f.physics.registerBodyBox(f.id,f.registration),/unique/);
  f.physics.removeStaticBox(f.id);f.body.removeShape(f.shape);f.body.addShape(new Sphere(.5));assert.throws(()=>f.physics.registerBodyBox(f.id,f.registration),/shape-identity/);
 }finally{f.dispose();}
});

const corruptions=[
 ['removed world body',f=>f.physics.world.removeBody(f.body)],
 ['wrong world owner',f=>f.body.world=null],
 ['wrong shape owner',f=>f.shape.body=null],
 ['replaced actual shape',f=>{f.body.removeShape(f.shape);f.body.addShape(new Box(new Vec3(1.2,.25,.4)),f.offset);}],
 ['mutated actual half',f=>f.shape.halfExtents.x+=.1],
 ['mutated actual offset',f=>f.body.shapeOffsets[0].x+=.1],
 ['unsupported local orientation',f=>f.body.shapeOrientations[0].setFromAxisAngle(new Vec3(0,0,1),.1)],
 ['unregistered oriented tag',f=>f.physics.removeBodyBox(f.id)],
 ['different contact descriptor',f=>f.collider.orientedBox=createOrientedBoxContact(f.body,f.orientedBox.half,f.orientedBox.offset,f.physics.world.stepnumber)],
 ['stale live pose',f=>f.body.position.x+=.2],
 ['stale contact step',f=>f.physics.world.stepnumber++],
 ['disabled body collision',f=>f.body.collisionFilterMask=0],
 ['disabled shape collision',f=>f.shape.collisionResponse=false],
 ['disabled collider but live shape',f=>f.collider.enabled=false],
 ['mismatched visible geometry',f=>f.mesh.scale.x=1.2],
 ['nonfinite visible pose',f=>f.mesh.position.x=NaN],
 ['missing camera blocker',f=>f.game.cameraBlockers.length=0],
 ['missing projectile blocker',f=>f.game.aimBlockers.length=0],
 ['duplicate static metadata',f=>f.physics.solids.set(f.id,{body:f.body,half:f.shape.halfExtents,target:f.body.position,remaining:0,inWorld:true})],
 ['orphan owned metadata',f=>f.game.colliders.length=0],
 ['forged registry id',f=>f.physics.bodyBoxes.get(f.id).id='other-id'],
 ['duplicate shape owner',f=>f.physics.bodyBoxes.set('other-id',{...f.physics.bodyBoxes.get(f.id),id:'other-id'})],
];
for(const [name,mutate]of corruptions)test(`castle registry audit fails closed for ${name}`,()=>{
 const f=fixture();try{mutate(f);const report=auditSingularityContacts(f.game);assert.equal(report.pass,false,'Corruption must not be accepted');assert.ok(report.failures.some(failure=>['registry','owned-body-box','owned-body-registry'].includes(failure.kind)),JSON.stringify(report.failures));}finally{f.dispose();}
});

test('owned Box audit follows a real rotated body after resynchronization and unregisters before owner removal',()=>{
 const f=fixture();try{
  f.body.position.set(5,3,-2);f.body.quaternion.setFromAxisAngle(new Vec3(0,0,1),1.1);
  f.physics.world.stepnumber++;syncOrientedBoxContact(f.orientedBox,f.body,f.physics.world.stepnumber);
  f.mesh.position.copy(f.orientedBox.current.center);f.mesh.quaternion.copy(f.orientedBox.current.quaternion);f.mesh.updateWorldMatrix(true,false);f.collider.box.setFromObject(f.mesh);
  assert.equal(auditSingularityContacts(f.game).pass,true);
  assert.equal(f.physics.removeBodyBox(f.id),true);assert.equal(f.physics.bodyBoxes.size,0);
  f.physics.world.removeBody(f.body);assert.equal(f.physics.bodyBoxes.size,0);
 }finally{f.dispose();}
});
