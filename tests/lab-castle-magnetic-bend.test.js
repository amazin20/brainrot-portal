import test from 'node:test';
import assert from 'node:assert/strict';
import {Body,Box,Vec3,World} from 'cannon-es';
import {castleMagneticBendVelocity,createCastleMagneticBend} from '../src/game/LabCastleMagneticBend.js';

const V=(x=0,y=0,z=0)=>new Vec3(x,y,z);
function fixture({gravity=V(),velocity=V(15,0,0),position=V(-4,4,0)}={}){
 const world=new World({gravity}),body=new Body({mass:3.2,position,velocity,
  shape:new Box(V(.39,.39,.39)),linearDamping:0,angularDamping:0});world.addBody(body);
 const field=createCastleMagneticBend({body,centre:V(0,4,4),halfExtents:V(20,20,20),qB:V(0,12,0)});
 return{world,body,field};
}

test('a moving original-mass body turns through a real quarter arc without a target or position correction',()=>{
 const {world,body,field}=fixture(),identity=body,shape=body.shapes[0];
 const dt=(Math.PI/2)/(12/3.2)/120;
 for(let n=0;n<120;n++){
  const before=body.position.clone(),r=field.apply(dt);assert.ok(Math.abs(r.magneticWork)<1e-10);
  assert.ok(body.position.almostEquals(before,0));world.step(dt);
  assert.equal(body,identity);assert.equal(body.shapes[0],shape);
 }
 assert.ok(Math.abs(body.velocity.x)<1e-10&&Math.abs(body.velocity.z-15)<1e-10);
 assert.ok(Math.abs(body.position.x)<.04&&Math.abs(body.position.z-4)<.04);
 assert.ok(Math.abs(.5*body.mass*body.velocity.lengthSquared()-360)<1e-8);
});

test('reverse field sign reverses the bend; rest and field-parallel motion cannot be pulled to a receiver',()=>{
 const a=castleMagneticBendVelocity({velocity:V(15,0,0),mass:3.2,qB:V(0,12,0),dt:.2});
 const b=castleMagneticBendVelocity({velocity:V(15,0,0),mass:3.2,qB:V(0,-12,0),dt:.2});
 assert.ok(Math.abs(a.velocityAfter.x-b.velocityAfter.x)<1e-12&&Math.abs(a.velocityAfter.z+b.velocityAfter.z)<1e-12);
 for(const velocity of [V(),V(0,15,0)])assert.ok(castleMagneticBendVelocity({velocity,mass:3.2,qB:V(0,12,0),dt:30}).velocityAfter.almostEquals(velocity,1e-12));
});

test('arbitrary direction, mass and varying signed field schedules do not create kinetic energy',()=>{
 for(const mass of [.8,3.2,12]){
  let velocity=V(7,-3,11);const initial=.5*mass*velocity.lengthSquared();
  for(let i=0;i<3000;i++){
   const r=castleMagneticBendVelocity({velocity,mass,qB:V((i%3-1)*4,(i%2?1:-1)*12,2),dt:1/120});
   velocity=r.velocityAfter;assert.ok(Math.abs(r.kineticAfter-initial)<2e-8);
  }
 }
});

test('gravity changes vertical energy independently; magnetic operator does zero work',()=>{
 const {world,body,field}=fixture({gravity:V(0,-19.5,0)}),initial=.5*3.2*225+3.2*19.5*4;
 for(let i=0;i<60;i++){
  const r=field.apply(1/120);assert.ok(Math.abs(r.magneticWork)<1e-10);world.step(1/120);
  const total=.5*body.mass*body.velocity.lengthSquared()+body.mass*19.5*body.position.y;
  assert.ok(total<=initial+1e-8,'Ideal field cannot supply gravitational or kinetic energy');
 }
 assert.ok(body.velocity.y<0&&body.position.y<4);
});

test('finite volume, supply, owner and disposal do not alter unrelated bodies or poses',()=>{
 const {world,body,field}=fixture(),other=new Body({mass:3.2,velocity:V(0,0,8)});world.addBody(other);
 const originalCount=world.bodies.length,position=body.position.clone(),otherVelocity=other.velocity.clone();
 field.setEnabled(false);assert.equal(field.apply(1).applied,false);assert.ok(body.velocity.almostEquals(V(15,0,0),0));
 field.setEnabled(true);body.position.set(40,4,0);assert.equal(field.apply(1).applied,false);
 body.position.copy(position);field.apply(.01);assert.ok(body.position.almostEquals(position,0));assert.ok(other.velocity.almostEquals(otherVelocity,0));
 field.dispose();assert.equal(world.bodies.length,originalCount);assert.throws(()=>field.apply(.01),/disposed/);
});

test('invalid operator input is rejected without mutating caller vectors or body velocity',()=>{
 const velocity=V(1,2,3),before=velocity.clone();
 for(const patch of [{mass:0},{mass:NaN},{dt:-1},{dt:Infinity},{qB:V(Infinity,0,0)}]){
  assert.throws(()=>castleMagneticBendVelocity({velocity,mass:3.2,qB:V(0,12,0),dt:.1,...patch}),RangeError);
  assert.ok(velocity.almostEquals(before,0));
 }
 const {body,field}=fixture(),v=body.velocity.clone();assert.throws(()=>field.apply(NaN),RangeError);assert.ok(body.velocity.almostEquals(v,0));
});

test('duplicate calls cannot advance the field twice in one physics step; render-time zero dt spends no step',()=>{
 const {world,body,field}=fixture();const before=body.velocity.clone();
 field.apply(0);assert.ok(body.velocity.almostEquals(before,0));
 assert.equal(field.apply(1/120).applied,true);const once=body.velocity.clone();
 assert.equal(field.apply(1/120).duplicate,true);assert.ok(body.velocity.almostEquals(once,0));
 world.step(1/120);assert.equal(field.apply(1/120).applied,true);
 const position=body.position.clone();field.resetClock();assert.ok(body.position.almostEquals(position,0));
});
