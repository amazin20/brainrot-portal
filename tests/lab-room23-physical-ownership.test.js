import test from 'node:test';
import assert from 'node:assert/strict';
import {Body,Box,Equation,Vec3} from 'cannon-es';
import {room23PhysicalFixture} from './fixtures/room23-physical-fixture.js';

// Explicit corruption of actual initialized Cannon components, not ordinary
// player input, a normal Play journey, or accepted SOURCE/native/public proof.
function loaded(){const f=room23PhysicalFixture();f.step(1);f.machine.requestClutch(true);f.step(2);f.machine.requestBrake(false);f.step(.1);assert.equal(f.machine.ownershipValid(),true);return f;}
function closedAfter(mutate){const f=loaded();try{
 const before=f.machine.diagnostics(),oldOriginal=f.original,oldShape=f.shape;
 mutate(f);assert.equal(f.machine.ownershipValid(),false,'Corruption must be observable immediately, before a physics step');
 f.step(.05);const after=f.machine.diagnostics();
 assert.equal(after.ownershipValid,false);assert.match(after.fault,/current owned/);
 assert.equal(after.forceCount,before.forceCount);assert.equal(after.traveller.forceCount,before.traveller.forceCount);
 assert.ok(f.machine.constraints.every(c=>!f.game.physics.world.constraints.includes(c)||c.equations.every(e=>e.enabled===false)),'Owned equations must be disabled or a malformed owned constraint detached before further actuator work');
 const poses=[...f.machine.bodies,oldOriginal,f.machine.traveller.body].map(b=>[b,...b.position.toArray(),...b.quaternion.toArray()]);
 f.machine.reset();assert.equal(f.machine.diagnostics().forceCount,before.forceCount);
 for(const [b,...pose]of poses)assert.deepEqual([...b.position.toArray(),...b.quaternion.toArray()],pose,'Faulted reset must not repair or assign a pose');
 assert.equal(f.machine.originalCargoBody,oldOriginal);assert.equal(f.machine.originalCargoShape,oldShape);
}finally{f.dispose();}}

const exactPeerCases=[
 ['input rotor mask zero',f=>f.machine.inputRotor.collisionFilterMask=0],
 ['output drum response disabled',f=>f.machine.drumBody.collisionResponse=false],
 ['input rotor static type',f=>f.machine.inputRotor.type=Body.STATIC],
 ['real traveller mass one',f=>{f.machine.traveller.body.mass=1;f.machine.traveller.body.updateMassProperties();}],
 ['all traveller shape masks zero',f=>f.machine.traveller.body.shapes.forEach(s=>s.collisionFilterMask=0)],
 ['same original mass one',f=>{f.original.mass=1;f.original.updateMassProperties();}],
 ['same-size original shape replacement',f=>{f.original.removeShape(f.original.shapes[0]);f.original.addShape(new Box(new Vec3(.39,.39,.39)));}],
 ['winding constraint removed',f=>f.game.physics.world.removeConstraint(f.machine.constraints.find(c=>c.constructor.name==='WindingConstraint'))],
 ['real traveller body removed',f=>f.game.physics.world.removeBody(f.machine.traveller.body)],
 ['registered car disabled control',f=>f.machine.parts.find(p=>p.kind==='car').collider.enabled=false],
];
for(const [name,mutate]of exactPeerCases)test('23 ownership exact peer corruption: '+name,()=>closedAfter(mutate));

test('23 ownership checks every authored machine body, shape and local factor',()=>{
 for(const select of [m=>m.foundedBody,m=>m.cars[0].body,m=>m.cars[0].panBody,m=>m.cars[1].body,m=>m.cars[1].panBody,m=>m.inputRotor,m=>m.drumBody,m=>m.forkBody,m=>m.jawBodies[0],m=>m.jawBodies[1]]){
  for(const mutate of [(f,b)=>f.game.physics.world.removeBody(b),(f,b)=>b.collisionFilterMask=0,(f,b)=>b.collisionResponse=false,(f,b)=>b.shapes[0].collisionFilterMask=0,(f,b)=>b.shapes[0].collisionResponse=false])closedAfter(f=>mutate(f,select(f.machine)));
 }
 for(const [select,mutate]of [[m=>m.forkBody,b=>b.linearFactor.set(0,0,0)],[m=>m.jawBodies[0],b=>b.angularFactor.x=1],[m=>m.drumBody,b=>b.fixedRotation=true],[m=>m.inputRotor,b=>b.invMass=1],[m=>m.cars[0].body,b=>b.shapeOffsets[0].y+=.1],[m=>m.cars[0].body,b=>b.shapes[0].halfExtents.y+=.1],[m=>m.drumBody,b=>b.shapes[0].vertices[0].y+=.1],[m=>m.inputRotor,b=>b.angularDamping=.9]])closedAfter(f=>mutate(select(f.machine)));
});

test('23 ownership checks same original and traveller current definition beyond stored IDs',()=>{
 for(const mutate of [f=>f.original.collisionFilterMask=0,f=>f.original.collisionResponse=false,f=>f.original.collisionFilterGroup=4,
  f=>f.original.shapes[0].collisionResponse=false,f=>f.original.shapes[0].collisionFilterMask=0,f=>f.original.linearFactor.y=0,
  f=>f.original.type=Body.STATIC,f=>f.game.physics.world.removeBody(f.original),f=>f.original.position.x=NaN,
  f=>f.machine.traveller.body.type=Body.STATIC,f=>f.machine.traveller.body.collisionFilterMask=0,
  f=>f.machine.traveller.body.collisionResponse=false,f=>f.machine.traveller.body.fixedRotation=false,
  f=>f.machine.traveller.body.shapes[0].radius=.1,f=>f.machine.traveller.body.shapes[0].collisionFilterGroup=0,
  f=>f.machine.traveller.body.linearFactor.z=0,f=>f.game.physics.playerProxy.remaining=1])closedAfter(mutate);
});

test('23 ownership checks all constraint/equation membership, wiring and authored enabled rows',()=>{
 const f=room23PhysicalFixture(),length=f.machine.constraints.length;f.dispose();
 for(let index=0;index<length;index++){
  for(const mutate of [(f,c)=>f.game.physics.world.removeConstraint(c),(f,c)=>c.bodyA=f.original,(f,c)=>c.equations[0].bi=f.original,
   (f,c)=>c.equations[0].enabled=!c.equations[0].enabled,(f,c)=>c.equations[0]=new Equation(c.bodyA,c.bodyB),
   (f,c)=>c.equations=c.equations.slice(),(f,c)=>c.equations[0]=null,(f,c)=>c.bodyB=null,(f,c)=>c.collideConnected=!c.collideConnected])closedAfter(f=>mutate(f,f.machine.constraints[index]));
 }
 for(const select of [m=>m.constraints.flatMap(c=>c.equations).find(e=>e.constructor.name==='RotationalMotorEquation'),
  m=>m.constraints.flatMap(c=>c.equations).filter(e=>e.constructor.name==='RotationalMotorEquation')[1]])closedAfter(f=>select(f.machine).enabled=true);
});

test('23 ownership cannot forge aperture state or repair a changed current registry reference',()=>{
 for(const mutate of [f=>{const p=f.machine.parts.find(p=>p.kind==='car');p.opened=true;p.shape.collisionFilterMask=12;},
  f=>{const p=f.machine.parts.find(p=>p.kind==='car');p.collider.orientedBox.body=f.original;},
  f=>{const p=f.machine.parts.find(p=>p.kind==='car');p.collider.orientedBox={...p.collider.orientedBox};}])closedAfter(mutate);
});

test('23 ownership held original, release grace and owned aperture callback keep authored masks',()=>{
 const f=room23PhysicalFixture();try{
  f.step(.2);const m=f.machine,p=m.parts.find(p=>p.kind==='car');
  f.game.portalOpensCollider=collider=>collider===p.collider;f.step(.02);assert.equal(p.opened,true);assert.equal(p.shape.collisionFilterMask,12);assert.equal(m.ownershipValid(),true);
  f.game.portalOpensCollider=()=>false;f.step(.02);assert.equal(p.opened,false);assert.equal(p.shape.collisionFilterMask,-1);assert.equal(m.ownershipValid(),true);
  f.game.heldCube=f.game.cargo;f.game.physics.setCarryTarget(f.original.position);assert.equal(f.original.collisionFilterMask,1);assert.equal(m.ownershipValid(),true);
  const hand=m.traveller.handJoint;assert.ok(hand&&f.game.physics.world.constraints.includes(hand));
  f.game.physics.release();f.game.heldCube=null;assert.equal(m.traveller.handJoint,null);assert.equal(m.ownershipValid(),true);
  f.game.physics.releasePlayerGrace=true;f.original.collisionFilterMask=1;assert.equal(m.ownershipValid(),true);
  f.game.physics.releasePlayerGrace=false;f.original.collisionFilterMask=5;assert.equal(m.ownershipValid(),true);
 }finally{f.dispose();}
});

test('23 ownership hand constraint faults cannot fall back to a shared kinematic/carry servo',()=>{
 for(const corrupt of [(f,hand)=>f.game.physics.world.removeConstraint(hand),(f,hand)=>hand.equations[0].enabled=false,(f,hand)=>hand.bodyB=f.machine.inputRotor,
  (f,hand)=>hand.equations[0].maxForce=10000,(f,hand)=>hand.pivotA.x+=1,(f,hand)=>hand.pivotB.y=1]){
  const f=loaded();try{
   f.game.heldCube=f.game.cargo;f.game.physics.setCarryTarget(f.original.position);const hand=f.machine.traveller.handJoint,before=f.machine.diagnostics();assert.ok(hand);
   corrupt(f,hand);assert.equal(f.machine.ownershipValid(),false);f.step(.05);const after=f.machine.diagnostics();
   assert.match(after.fault,/current owned/);assert.equal(after.forceCount,before.forceCount);assert.equal(after.traveller.forceCount,before.traveller.forceCount);assert.equal(after.traveller.handJointOwned,false);
   assert.equal(f.game.physics.setCarryTarget(f.original.position),false);assert.equal(f.game.physics.setPlayerProxy({}),null);
  }finally{f.dispose();}
 }
});

test('23 ownership disposal uses captured owners and preserves foreign replacement containers',()=>{
 const f=loaded();try{
  const originalBodies=[...f.machine.bodies,f.machine.traveller.body],originalConstraints=[...f.machine.constraints],p=f.machine.parts.find(p=>p.kind==='car');
  const foreignBody=new Body({mass:1,shape:new Box(new Vec3(.1,.1,.1))});f.game.physics.world.addBody(foreignBody);f.machine.bodies.push(foreignBody);
  const foreignRegistry={...f.game.physics.bodyBoxes.get(p.mesh.uuid),body:foreignBody};f.game.physics.bodyBoxes.set(p.mesh.uuid,foreignRegistry);
  const foreignProxy={body:foreignBody,target:foreignBody.position.clone(),remaining:0};f.game.physics.playerProxy=foreignProxy;
  f.step(.02);assert.match(f.machine.diagnostics().fault,/current owned/);f.machine.parts.length=0;f.machine.constraints.length=0;f.machine.bodies.length=0;
  f.machine.dispose();assert.ok(originalBodies.every(b=>!f.game.physics.world.bodies.includes(b)));assert.ok(originalConstraints.every(c=>!f.game.physics.world.constraints.includes(c)));
  assert.ok(f.game.physics.world.bodies.includes(foreignBody));assert.equal(f.game.physics.bodyBoxes.get(p.mesh.uuid),foreignRegistry);assert.equal(f.game.physics.playerProxy,foreignProxy);
  assert.equal(f.game.physics.world.subsystems.length,0);assert.equal(Object.hasOwn(f.game.physics,'_advanceKinematic'),false);
 }finally{f.dispose();}
});

test('23 ownership rejects malformed live Cannon containers before any further actuator supply',()=>{
 const cases=[
  [f=>f.original,'position',false],
  [f=>f.machine.traveller.body,'velocity',false],
  ...['position','quaternion','velocity','angularVelocity','force','torque'].map(key=>[f=>f.machine.inputRotor,key,false]),
  ...['position','quaternion','velocity','angularVelocity','force','torque'].map(key=>[f=>f.machine.drumBody,key,true]),
 ];
 for(const [select,key,sameType]of cases){
  const f=loaded(),body=select(f),saved=body[key],before=f.machine.diagnostics();
  try{
   body[key]=sameType?saved.clone():{x:saved.x,y:saved.y,z:saved.z,...(key==='quaternion'?{w:saved.w}:{})};
   const malformed=body[key];assert.equal(f.machine.ownershipValid(),false,'Numeric equality cannot replace the captured live Cannon container');
   // A deliberately malformed Cannon body may itself throw during integration.
   // The guard must reject it without installing a replacement or supplying
   // another actuator step; this fixture restores it only during cleanup.
   try{f.step(.05);}catch(error){assert.ok(error instanceof TypeError);}
   const after=f.machine.diagnostics();assert.match(after.fault,/current owned/);assert.equal(after.ownershipValid,false);
   assert.equal(after.forceCount,before.forceCount);assert.equal(after.traveller.forceCount,before.traveller.forceCount);
   assert.ok(f.machine.constraints.every(c=>!f.game.physics.world.constraints.includes(c)||c.equations.every(e=>e.enabled===false)));
   f.machine.reset();assert.equal(body[key],malformed,'A faulted reset must not repair a malformed live container');
  }finally{body[key]=saved;f.dispose();}
 }
});

test('23 ownership rejects zero and non-unit actual body quaternions without pose repair',()=>{
 for(const select of [f=>f.original,f=>f.machine.traveller.body,f=>f.machine.inputRotor,f=>f.machine.drumBody]){
  for(const q of [[0,0,0,0],[0,0,0,2]])closedAfter(f=>select(f).quaternion.set(...q));
 }
});

test('23 ownership binds authored winding, shaft and static custom Jacobian definitions',()=>{
 const winding=f=>f.machine.constraints.find(c=>c.constructor.name==='WindingConstraint').equations[0];
 const shaft=f=>f.machine.constraints.find(c=>c.constructor.name==='ShaftAxialGuide').equations[0];
 const disc=f=>f.machine.constraints.find(c=>c.constructor.name==='DiscFrictionConstraint').equations[0];
 for(const [select,mutate]of [
  [winding,e=>e.home+=1],[winding,e=>e.sign*=-1],[winding,e=>e.radius*=2],[winding,e=>e.angle=()=>0],
  [shaft,e=>e.key='x'],[shaft,e=>e.anchor+=1],
  ...[winding,shaft,disc].flatMap(select=>[
   [select,e=>e.jacobianElementA.spatial.y+=1],[select,e=>e.jacobianElementB.rotational.x+=1],
   [select,e=>e.jacobianElementA.spatial=e.jacobianElementA.spatial.clone()],
   [select,e=>e.a*=2],[select,e=>e.b=0],[select,e=>e.eps*=2],
   [select,e=>e.computeB=()=>0],[select,e=>e.computeGiMGt=()=>1],[select,e=>e.computeGW=()=>0],
  ]),
 ])closedAfter(f=>mutate(select(f)));
 for(const kind of ['HingeConstraint','WindingConstraint','DiscFrictionConstraint','ShaftAxialGuide'])closedAfter(f=>{
  const c=f.machine.constraints.find(c=>c.constructor.name===kind);c.update=()=>{};
 });
});

test('23 ownership fault shutdown is idempotent and never re-enables authored rows',()=>{
 const f=loaded();try{
  f.original.quaternion.set(0,0,0,0);f.step(.05);
  const count=f.machine.diagnostics().forceCount,remaining=f.game.physics.world.constraints.slice();
  for(let i=0;i<5;i++){f.game.updatePlayer(1/120);f.machine.reset();f.machine.diagnostics();}
  assert.equal(f.machine.diagnostics().forceCount,count);assert.deepEqual(f.game.physics.world.constraints,remaining);
  assert.ok(f.machine.constraints.every(c=>!f.game.physics.world.constraints.includes(c)||c.equations.every(e=>!e.enabled)));
 }finally{f.dispose();}
});

test('23 ownership binds both authored bearing axes, pivots and fixed equation solver parameters',()=>{
 for(const index of [0,1]){
  for(const key of ['axisA','axisB','pivotA','pivotB']){
   closedAfter(f=>{const c=f.machine.constraints.filter(c=>c.constructor.name==='HingeConstraint')[index];c[key].x+=.1;});
   closedAfter(f=>{const c=f.machine.constraints.filter(c=>c.constructor.name==='HingeConstraint')[index];c[key]=c[key].clone();});
  }
  for(const key of ['a','b','eps','minForce','maxForce'])closedAfter(f=>{
   const e=f.machine.constraints.filter(c=>c.constructor.name==='HingeConstraint')[index].equations[0];e[key]+=.1;
  });
 }
 for(const kind of ['WindingConstraint','ShaftAxialGuide']){
  for(const key of ['minForce','maxForce'])closedAfter(f=>{
   const e=f.machine.constraints.find(c=>c.constructor.name===kind).equations[0];e[key]+=.1;
  });
 }
});
