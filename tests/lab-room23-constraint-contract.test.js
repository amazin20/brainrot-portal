import test from 'node:test';
import assert from 'node:assert/strict';
import {room23PhysicalFixture} from './fixtures/room23-physical-fixture.js';

// Explicit in-memory corruption diagnostics for the opt-in prototype.
// These are not ordinary-input bypasses or evidence of a complete Play route.
const winding=m=>m.constraints.find(c=>c.equations.some(e=>Object.hasOwn(e,'home')));
const guide=m=>m.constraints.find(c=>c.equations.some(e=>Object.hasOwn(e,'anchor')));
const bearings=m=>m.constraints.filter(c=>Object.hasOwn(c,'axisA'));

function closesBeforeWork(mutate){
 const f=room23PhysicalFixture();try{
  f.step(1);const before=f.machine.diagnostics(),original=f.original,shape=f.shape;
  mutate(f.machine);assert.equal(f.machine.ownershipValid(),false,'Changed authored local facts must be rejected before integration');
  f.step(.1);const after=f.machine.diagnostics();
  assert.match(after.fault,/current owned/);assert.equal(after.forceCount,before.forceCount);
  assert.equal(after.traveller.forceCount,before.traveller.forceCount);
  assert.equal(f.original,original);assert.equal(original.shapes[0],shape);
  assert.ok(Math.abs(after.west.y-before.west.y)<.001,'A corrupted winding home must not inject the prior constraint impulse');
 }finally{f.dispose();}
}

test('23 authored winding home corruption closes before the prior seven-metre impulse',()=>{
 closesBeforeWork(m=>{winding(m).equations[0].home+=10;});
});

test('23 winding scalar definition, callback, fixed force bounds and constant Jacobians are owned',()=>{
 for(const mutate of [
  e=>{e.sign=-e.sign;},e=>{e.radius*=2;},e=>{e.angle=()=>0;},
  e=>{e.minForce=e.maxForce=0;},e=>{e.maxForce*=2;},
  e=>{e.jacobianElementA.spatial.y=0;},e=>{e.jacobianElementB.rotational.x=0;},
  e=>{e.jacobianElementA.spatial=e.jacobianElementA.spatial.clone();},
 ])closesBeforeWork(m=>mutate(winding(m).equations[0]));
});

test('23 shaft guide anchors, axes and force bounds remain the authored local definition',()=>{
 for(const mutate of [e=>{e.key='x';},e=>{e.anchor+=1;},e=>{e.minForce=e.maxForce=0;},
  e=>{e.jacobianElementA.spatial.y+=1;}])closesBeforeWork(m=>mutate(guide(m).equations[0]));
});

test('23 both bearings retain fixed pivot/axis values, identities and force bounds',()=>{
 for(const index of [0,1])for(const key of ['pivotA','pivotB','axisA','axisB']){
  closesBeforeWork(m=>{bearings(m)[index][key].y+=1;});
  closesBeforeWork(m=>{bearings(m)[index][key]=bearings(m)[index][key].clone();});
 }
 for(const index of [0,1])closesBeforeWork(m=>{bearings(m)[index].equations[0].maxForce*=2;});
});

test('23 normal physical ascent keeps live drum angle and contact-driven friction limits valid',()=>{
 const f=room23PhysicalFixture();try{
  const m=f.machine,original=f.original,shape=f.shape,e=winding(m).equations[0],angleCallback=e.angle;
  const contactFriction=m.constraints.filter(c=>c.equations.length===1&&!Object.hasOwn(c.equations[0],'home'));
  const initialLimits=contactFriction.map(c=>c.equations[0].maxForce),initialAngle=e.angle();
  const observe=()=>assert.equal(m.ownershipValid(),true);
  f.step(3,observe);m.requestClutch(true);f.step(6,observe);m.requestBrake(false);f.step(12,observe);
  assert.equal(e.angle,angleCallback);assert.ok(e.angle()>initialAngle+30);
  assert.ok(contactFriction.some((c,i)=>Math.abs(c.equations[0].maxForce-initialLimits[i])>.01));
  assert.ok(m.height>9.99);assert.ok(f.game.playerPosition.y>9.99);
  assert.equal(f.original,original);assert.equal(original.shapes[0],shape);assert.equal(m.diagnostics().fault,null);
  assert.equal(m.diagnostics().fullOrdinaryRouteAccepted,false);
 }finally{f.dispose();}
});
