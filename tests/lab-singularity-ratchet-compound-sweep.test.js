import test from 'node:test';
import assert from 'node:assert/strict';
import {Body,Box,Quaternion,Vec3} from 'cannon-es';
import {LabPhysics} from '../src/game/LabPhysics.js';
import {compoundCargoBoxPose,compoundCargoBoxSeparation,sweepCompoundCargoBox,resolveCompoundCargoSweep,COMPOUND_CARGO_SWEEP_SKIN} from '../src/game/LabCompoundCargoSweep.js';

const V=(...p)=>new Vec3(...p),Q=(angle=0)=>new Quaternion().setFromAxisAngle(V(0,1,0),angle);
const close=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
function guard(physics,half,position=[0,0,0],{offset=[0,0,0],quaternion=Q(),shapeQuaternion=Q()}={}){
 const body=new Body({mass:0,position:V(...position),quaternion,collisionFilterGroup:1,collisionFilterMask:2});
 body.addShape(new Box(V(...half)),V(...offset),shapeQuaternion);physics.world.addBody(body);return body;
}
const separation=(cargo,wall)=>compoundCargoBoxSeparation(compoundCargoBoxPose(cargo,0),compoundCargoBoxPose(wall,0)).gap;

test('compound CCD registry leaves default empty physics identical to the legacy integration',()=>{
 const a=new LabPhysics(),b=new LabPhysics();try{
  a.createCargo({position:[0,3,0],velocity:[3,1,-4],angularVelocity:[1,2,3]});b.createCargo({position:[0,3,0],velocity:[3,1,-4],angularVelocity:[1,2,3]});
  for(let i=0;i<120;i++){a.step(1/120);b.step(1/120);}
  assert.deepEqual(a.cargoBody.position,b.cargoBody.position);assert.deepEqual(a.cargoBody.quaternion,b.cargoBody.quaternion);
  assert.deepEqual(a.cargoBody.velocity,b.cargoBody.velocity);assert.deepEqual(a.cargoBody.angularVelocity,b.cargoBody.angularVelocity);
  assert.equal(a.cargoSweepBoxes.size,0);assert.equal(a.compoundCargoSweepCorrections,0);assert.equal(a.lastCompoundCargoSweep,null);
 }finally{a.dispose();b.dispose();}
});

for(const [name,half,position,cargoPosition,velocity,coordinate,limit] of [
 ['pane',[.06,3,2],[0,0,0],[-.47,0,0],[22,0,0],'x',-.45],
 ['roof',[2,.125,2],[0,2.925,0],[0,2.39,0],[0,8.4076,0],'y',2.41],
])test(`native 120Hz high-speed clean-start cargo stays outside the full ${name} Box`,()=>{
 const physics=new LabPhysics({gravity:0});try{
  const wall=guard(physics,half,position),body=physics.createCargo({position:cargoPosition,velocity});
  physics.registerCargoSweepBox(name,{body:wall,shapeIndex:0});
  const originalBody=body,originalShape=body.shapes[0],worldBodyCount=physics.world.bodies.length;
  assert.ok(separation(body,wall)>.0199);physics.step(1/120);
  assert.equal(body,originalBody);assert.equal(body.shapes[0],originalShape);assert.equal(body.mass,3.2);assert.equal(physics.world.bodies.length,worldBodyCount);
  assert.ok(body.position[coordinate]<=limit+1e-8);assert.ok(separation(body,wall)>=-1e-8);
  const receipt=physics.lastCompoundCargoSweep;assert.ok(receipt.corrections.length>0);
  assert.equal(receipt.worldStep,1);assert.equal(receipt.cannonContactEquationsAdded,0);assert.ok(receipt.maxResidualPenetration<1e-8);
  assert.ok(receipt.corrections.every(c=>c.toi>0&&c.toi<1&&c.step===1&&c.guardBodyId===wall.id&&c.shapeIndex===0&&!c.cannonContactEquation));
  assert.equal(physics.world.contacts.some(c=>c.bi===wall||c.bj===wall),false,'Clean start has no initial Cannon contacts; CCD is separate geometry response');
 }finally{physics.dispose();}
});

test('full OBB cargo corners reach an offset oriented compound shape, not its body centre or AABB',()=>{
 const physics=new LabPhysics({gravity:0});try{
  const wall=guard(physics,[.05,2,.12],[4,0,3],{offset:[0,0,2],quaternion:Q(Math.PI/4),shapeQuaternion:Q(Math.PI/6)});
  const shape=compoundCargoBoxPose(wall,0),normal=shape.axes[0],body=physics.createCargo({position:shape.center.vadd(normal.scale(.8)).toArray(),quaternion:Q(-Math.PI/7)});
  const start={position:body.position.clone(),quaternion:body.quaternion.clone()},target=shape.center.vsub(normal.scale(.8));body.position.copy(target);body.velocity.copy(normal.scale(-10));
  const result=resolveCompoundCargoSweep(body,start,[{id:'actual offset shape',body:wall,shapeIndex:0}]);
  assert.ok(result.corrections.length>0);assert.ok(separation(body,wall)>=-1e-8);
  assert.ok(body.position.vsub(shape.center).dot(normal)>0,'The box remains on the initial actual face side');
  assert.ok(shape.center.distanceTo(wall.position)>1.9,'The actual shape offset was used');
 }finally{physics.dispose();}
});

test('endpoint-clear translating cargo cannot pass through a thin Box face',()=>{
 const physics=new LabPhysics({gravity:0});try{
  const wall=guard(physics,[.01,1,1]),body=physics.createCargo({position:[-2,0,0]});
  const start=compoundCargoBoxPose(body,0);body.position.set(2,0,0);const end=compoundCargoBoxPose(body,0),shape=compoundCargoBoxPose(wall,0);
  assert.ok(compoundCargoBoxSeparation(start,shape).gap>0);assert.ok(compoundCargoBoxSeparation(end,shape).gap>0);
  const hit=sweepCompoundCargoBox(start,end,shape);assert.ok(hit);close(hit.t,(2-.4)/4);
  const result=resolveCompoundCargoSweep(body,{position:start.center,quaternion:start.quaternion},[{id:'thin',body:wall,shapeIndex:0}]);
  assert.ok(result.corrections.length>0);assert.ok(body.position.x<-.4);assert.ok(separation(body,wall)>=0);
 }finally{physics.dispose();}
});

test('an exactly touching cargo moving into a face has a real t=0 CCD response',()=>{
 const physics=new LabPhysics({gravity:0});try{
  const wall=guard(physics,[.06,1,1]),body=physics.createCargo({position:[-.45,0,0]});
  const start={position:body.position.clone(),quaternion:body.quaternion.clone()};body.position.x=-.3;body.velocity.x=20;
  const result=resolveCompoundCargoSweep(body,start,[{id:'touching inward',body:wall,shapeIndex:0}]);
  assert.ok(result.corrections.length>0);close(result.corrections[0].toi,0);assert.ok(result.corrections[0].normalImpulse>0);
  assert.ok(body.position.x<=-.45);assert.ok(separation(body,wall)>=0);assert.equal(body.aabbNeedsUpdate,true);
 }finally{physics.dispose();}
});

test('a centred high-speed full-face impact removes inward velocity without arbitrary corner torque',()=>{
 const physics=new LabPhysics({gravity:0});try{
  const wall=guard(physics,[.06,3,2]),body=physics.createCargo({position:[-.47,0,0],velocity:[22,0,0]});physics.registerCargoSweepBox('centred face',{body:wall,shapeIndex:0});
  physics.step(1/120);const response=physics.lastCompoundCargoSweep.corrections[0];
  assert.ok(response.closestFeaturePairs>=4);close(response.point[1],0);close(response.point[2],0);
  assert.ok(body.velocity.length()<1e-8);assert.ok(body.angularVelocity.length()<1e-8,'A symmetric flat face cannot acquire torque from arbitrary closest-vertex ordering');
  assert.ok(response.normalImpulse>70);assert.ok(response.penetrationBefore>.15);assert.equal(response.penetrationAfter,0);
  assert.ok(body.velocity.length()<=physics.maxLinearSpeed&&body.angularVelocity.length()<=18,'Actual post-native-cap response remains valid');
 }finally{physics.dispose();}
});

test('simultaneous compound wedge contacts cannot return an uncertified penetrating endpoint',()=>{
 const physics=new LabPhysics({gravity:0});try{
  const pane=guard(physics,[.06,3,4]),other=guard(physics,[.08,3,.4994936050847173],[-.8599839875241742,0,.34302437771111727],{quaternion:new Quaternion(0,.0975837585689383,0,.995227315774421)}),body=physics.createCargo({position:[-.46,0,-.42]});
  const previous={position:body.position.clone(),quaternion:body.quaternion.clone()};assert.ok(separation(body,pane)>0);assert.ok(separation(body,other)>0);
  body.position.vadd(V(.129636,0,.129636),body.position);body.velocity.set(22/Math.SQRT2,0,22/Math.SQRT2);
  const result=resolveCompoundCargoSweep(body,previous,[{id:'pane',body:pane,shapeIndex:0},{id:'wedge',body:other,shapeIndex:0}],{maxLinearSpeed:22,maxAngularSpeed:18});
  assert.ok(result.corrections.length>0);assert.ok(result.maxResidualPenetration<1e-8);assert.ok(separation(body,pane)>=-1e-8);assert.ok(separation(body,other)>=-1e-8);
  if(result.budgetFallback)assert.ok(result.maxResidualBeforeFallback>COMPOUND_CARGO_SWEEP_SKIN,'The safe budget stop is recorded independently of successful collision resolution');
 }finally{physics.dispose();}
});

test('a real rotating corner remains non-inward after the actual native angular speed cap',()=>{
 const physics=new LabPhysics({gravity:0});try{
  const wall=guard(physics,[.06,3,4]),yaw=.01,body=physics.createCargo({position:[-(.06+.39*(Math.cos(yaw)+Math.sin(yaw))+.02),0,0],quaternion:Q(yaw),velocity:[22,0,0],angularVelocity:[0,18,0]});physics.registerCargoSweepBox('corner cap',{body:wall,shapeIndex:0});
  assert.ok(separation(body,wall)>.019);physics.step(1/120);const result=physics.lastCompoundCargoSweep;
  assert.ok(result.corrections.length>0);assert.ok(body.velocity.length()<=22+1e-8);assert.ok(body.angularVelocity.length()<=18+1e-8);
  for(const row of result.corrections)assert.ok(row.relativeNormalVelocityAfterNativeLimits>=-1e-8);
  assert.ok(result.maxResidualPenetration<1e-8);
 }finally{physics.dispose();}
});

test('tiny clear rotation about a pane normal retains a certified whole-path separating plane',()=>{
 const physics=new LabPhysics({gravity:0});try{
  const wall=guard(physics,[.06,3,4]),body=physics.createCargo({position:[-.450015,0,0]});
  const start=compoundCargoBoxPose(body,0);body.position.z=.18;body.quaternion.setFromAxisAngle(V(1,0,0),.001);const end=compoundCargoBoxPose(body,0);
  assert.equal(sweepCompoundCargoBox(start,end,compoundCargoBoxPose(wall,0)),null);
 }finally{physics.dispose();}
});

test('an earlier upward CCD impact cannot invent support after cargo leaves a finite guard edge',()=>{
 const physics=new LabPhysics({gravity:0});try{
  const wall=guard(physics,[.5,.06,.5]),body=physics.createCargo({position:[0,.6,0]});
  const before={position:body.position.clone(),quaternion:body.quaternion.clone()};body.position.set(1.5,.3,0);body.velocity.set(20,-3,0);
  const result=resolveCompoundCargoSweep(body,before,[{id:'finite deck',body:wall,shapeIndex:0}]);
  assert.ok(result.corrections.some(c=>c.normal[1]>.45));assert.equal(result.supported,false);assert.ok(body.position.x>1);
 }finally{physics.dispose();}
});

test('rotating cube corner cannot cross a small real Box when both orientations are clear',()=>{
 const physics=new LabPhysics({gravity:0});try{
  const wall=guard(physics,[.015,.2,.015],[.52,0,0]),body=physics.createCargo({position:[0,0,0]});
  const before={position:body.position.clone(),quaternion:Q(0)},a=compoundCargoBoxPose(body,0,before.position,before.quaternion);
  body.quaternion.copy(Q(Math.PI/2));body.angularVelocity.set(0,10,0);const end=compoundCargoBoxPose(body,0),shape=compoundCargoBoxPose(wall,0);
  assert.ok(compoundCargoBoxSeparation(a,shape).gap>0);assert.ok(compoundCargoBoxSeparation(end,shape).gap>0);
  const middle=compoundCargoBoxPose(body,0,body.position,Q(Math.PI/4));assert.ok(compoundCargoBoxSeparation(middle,shape).gap<0);
  const hit=sweepCompoundCargoBox(a,end,shape);assert.ok(hit?.rotating);assert.ok(hit.t>0&&hit.t<.5);
  const result=resolveCompoundCargoSweep(body,before,[{id:'corner',body:wall,shapeIndex:0}]);
  assert.ok(result.corrections.some(c=>c.rotating));assert.ok(separation(body,wall)>=-1e-8);assert.ok(Math.abs(body.quaternion.y)<Math.sin(Math.PI/4));
  assert.ok(Number.isFinite(body.velocity.length())&&Number.isFinite(body.angularVelocity.length()));
 }finally{physics.dispose();}
});

test('a genuinely tangent translating box and a clear diagonal path generate no CCD response',()=>{
 const physics=new LabPhysics({gravity:0});try{
  const wall=guard(physics,[1,1,1]),body=physics.createCargo({position:[-2,0,1.39]});
  const before={position:body.position.clone(),quaternion:body.quaternion.clone()};body.position.set(2,0,1.39);body.velocity.set(4,0,0);
  const target=body.position.clone(),v=body.velocity.clone(),result=resolveCompoundCargoSweep(body,before,[{id:'tangent',body:wall,shapeIndex:0}]);
  assert.equal(result.corrections.length,0);assert.deepEqual(body.position,target);assert.deepEqual(body.velocity,v);
  const diagonal=guard(physics,[3,.2,.08],[0,0,0],{quaternion:Q(Math.PI/4)});
  body.position.set(2,0,1);const start=compoundCargoBoxPose(body,0);body.position.set(2,0,2);const end=compoundCargoBoxPose(body,0);
  assert.equal(sweepCompoundCargoBox(start,end,compoundCargoBoxPose(diagonal,0)),null,'Empty volume inside the rotated box AABB does not block cargo');
 }finally{physics.dispose();}
});

test('portal-disabled masks and removed actual shape ownership bypass only the opt-in registry',()=>{
 const physics=new LabPhysics({gravity:0});try{
  const wall=guard(physics,[.06,3,2]),body=physics.createCargo({position:[-.47,0,0],velocity:[22,0,0]});physics.registerCargoSweepBox('disabled',{body:wall,shapeIndex:0});wall.collisionFilterMask=0;
  physics.step(1/120);assert.ok(body.position.x>-.45);assert.equal(physics.compoundCargoSweepCorrections,0);
  assert.equal(physics.removeCargoSweepBox('disabled'),true);assert.equal(physics.removeCargoSweepBox('disabled'),false);
  assert.equal(physics.world.bodies.includes(wall),true,'Unregistering removes no real body');
  wall.collisionFilterMask=2;physics.registerCargoSweepBox('removed body',{body:wall,shapeIndex:0});physics.world.removeBody(wall);physics.step(1/120);assert.equal(physics.compoundCargoSweepCorrections,0);
 }finally{physics.dispose();}
});

test('true shape masks and response flags are respected independently of the compound body mask',()=>{
 for(const disable of [
  (wall,cargo)=>{wall.shapes[0].collisionFilterMask=0;},
  (wall,cargo)=>{cargo.shapes[0].collisionFilterMask=0;},
  (wall,cargo)=>{wall.shapes[0].collisionResponse=false;},
  (wall,cargo)=>{cargo.shapes[0].collisionResponse=false;},
 ]){
  const physics=new LabPhysics({gravity:0});try{
   const wall=guard(physics,[.06,3,2]),body=physics.createCargo({position:[-.47,0,0],velocity:[22,0,0]});physics.registerCargoSweepBox('disabled shape',{body:wall,shapeIndex:0});disable(wall,body);
   physics.step(1/120);assert.ok(body.position.x>-.45);assert.equal(physics.compoundCargoSweepCorrections,0);
  }finally{physics.dispose();}
 }
});

test('registry rejects dynamic mechanisms, wrong shape indices and duplicate shapes and cleans disposal',()=>{
 const physics=new LabPhysics();
 const wall=guard(physics,[1,1,1]),dynamic=new Body({mass:1,shape:new Box(V(1,1,1))});physics.world.addBody(dynamic);
 assert.throws(()=>physics.registerCargoSweepBox('dynamic',{body:dynamic,shapeIndex:0}),/static/);
 assert.throws(()=>physics.registerCargoSweepBox('absent',{body:wall,shapeIndex:1}),/Box/);
 assert.equal(physics.registerCargoSweepBox('owned',{body:wall,shapeIndex:0}),true);
 assert.throws(()=>physics.registerCargoSweepBox('other',{body:wall,shapeIndex:0}),/already registered/);
 assert.throws(()=>physics.registerCargoSweepBox('owned',{body:wall,shapeIndex:0}),/unique/);
 assert.equal(physics.world.bodies.length,2);physics.dispose();assert.equal(physics.cargoSweepBoxes.size,0);assert.equal(physics.lastCompoundCargoSweep,null);
 close(COMPOUND_CARGO_SWEEP_SKIN,1e-5);
});

test('registration and release preserve the original native acquired pose and momentum',()=>{
 const physics=new LabPhysics({gravity:0});try{
  const wall=guard(physics,[.06,3,2],[4,0,0]),body=physics.createCargo({position:[0,0,0],velocity:[20,8,0],angularVelocity:[1,2,3]});
  physics.setCarryTarget([0,0,0]);physics.registerCargoSweepBox('distant',{body:wall,shapeIndex:0});
  const before={position:body.position.clone(),quaternion:body.quaternion.clone(),velocity:body.velocity.clone(),angularVelocity:body.angularVelocity.clone()};
  physics.release();assert.deepEqual(body.position,before.position);assert.deepEqual(body.quaternion,before.quaternion);assert.deepEqual(body.velocity,before.velocity);assert.deepEqual(body.angularVelocity,before.angularVelocity);
  assert.equal(physics.compoundCargoSweepCorrections,0);assert.equal(physics.carryTarget,null);
 }finally{physics.dispose();}
});
