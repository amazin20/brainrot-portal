import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Body, Box, Quaternion, Sphere, Vec3} from 'cannon-es';
import {LabPhysics} from '../src/game/LabPhysics.js';
import {exactTransitBoxPose, sweepExactTransitBox, resolveExactBoxPortalTransit} from '../src/game/LabExactBoxTransit.js';

const V = (...a) => new Vec3(...a), near = (a, b, e = 1e-10) => assert.ok(Math.abs(a-b) <= e, `${a} != ${b}`);
const make = (position, half = [.39,.39,.39], q = new Quaternion()) => {
  const b = new Body({position: V(...position), quaternion: q, mass: 1}); b.addShape(new Box(V(...half))); return b;
};
const pose = (position, half, q) => exactTransitBoxPose(make(position, half, q));
const snapshot = p => ({position:p.cargoBody.position.toArray(), velocity:p.cargoBody.velocity.toArray(),
  angular:p.cargoBody.angularVelocity.toArray(), previous:p.cargoBody.previousPosition.toArray(),
  interpolated:p.cargoBody.interpolatedPosition.toArray(), dirty:p.world.broadphase.dirty,
  target:p.carryTarget?.position.toArray(), contacts:p.portalTransitContacts});
const world = callback => { const p = new LabPhysics({gravity:0}); try { return callback(p); } finally { p.dispose(); } };

test('the exact swept interval reaches a thin real Box at analytic first contact', () => {
  const a = pose([-3,0,0]), end = pose([3,0,0]), wall = pose([0,0,0],[1,2,2]);
  const hit = sweepExactTransitBox(a,end,wall);
  near(hit.t, (3-1.39)/6); hit.normal.toArray().forEach((v,i)=>near(v,[-1,0,0][i])); assert.equal(hit.overlap,false);
});

test('touching away and tangential travel stay clear; touching inward hits at zero', () => {
  const wall = pose([0,0,0],[1,1,1]);
  assert.equal(sweepExactTransitBox(pose([-1.39,0,0]),pose([-3,0,0]),wall),null);
  assert.equal(sweepExactTransitBox(pose([-3,1.39,0]),pose([3,1.39,0]),wall),null);
  const hit = sweepExactTransitBox(pose([-1.39,0,0]),pose([0,0,0]),wall);
  near(hit.t,0); hit.normal.toArray().forEach((v,i)=>near(v,[-1,0,0][i]));
});

test('edge-cross separation rejects skew thin Boxes when all six face axes overlap', () => {
  const s = Math.SQRT1_2, n = 1/Math.sqrt(3);
  const a = {half:V(2,.1,.1),center:V(0,0,0),axes:[V(s,s,0),V(-s,s,0),V(0,0,1)]};
  const b = {half:V(2,.1,.1),center:V(n*.5,-n*.5,n*.5),axes:[V(0,s,s),V(1,0,0),V(0,s,-s)]};
  const support = (box,axis) => box.axes.reduce((r,e,i)=>r+[box.half.x,box.half.y,box.half.z][i]*Math.abs(e.dot(axis)),0);
  for (const axis of [...a.axes,...b.axes]) assert.ok(Math.abs(a.center.vsub(b.center).dot(axis)) < support(a,axis)+support(b,axis));
  assert.equal(sweepExactTransitBox(a,{...a,center:V(.1,.1,0)},b),null,'A genuine edge-cross separating plane must be tested');
});

test('native local offset and local orientation both contribute to the Box pose', () => {
  const bodyQ = new Quaternion(); bodyQ.setFromAxisAngle(V(0,1,0),Math.PI/2);
  const shapeQ = new Quaternion(); shapeQ.setFromAxisAngle(V(1,0,0),Math.PI/3);
  const body = new Body({mass:1,position:V(4,5,6),quaternion:bodyQ}), shape = new Box(V(.2,.3,.4));
  body.addShape(shape,V(1,2,3),shapeQ);
  const actual = exactTransitBoxPose(body);
  for (const key of ['x','y','z']) near(actual.center[key],bodyQ.vmult(V(1,2,3)).vadd(body.position)[key]);
  const expected = bodyQ.mult(shapeQ).vmult(V(0,0,1));
  for (const key of ['x','y','z']) near(actual.axes[2][key],expected[key]);
  assert.equal(actual.shape,shape); assert.deepEqual(actual.half.toArray(),[.2,.3,.4]);
});

test('a rotated cargo passes a coarse expanded-AABB corner without a false vertical impulse', () => {
  const run = mode => world(p => {
    p.addStaticBox('corner',{min:[.47,-.1,.47],max:[.53,.1,.53]});
    const q = new Quaternion(); q.setFromAxisAngle(V(0,1,0),Math.PI/4);
    const body = p.createCargo({position:[0,1,0],quaternion:q,velocity:[0,2,0],angularVelocity:[1,2,3]}), shape = body.shapes[0];
    const result = p.resolveCargoTransit([0,-1,0],{mode});
    assert.equal(p.cargoBody,body); assert.equal(body.shapes[0],shape); assert.equal(body.mass,3.2);
    assert.deepEqual(body.angularVelocity.toArray(),[1,2,3]);
    return {result,position:body.position.toArray(),velocity:body.velocity.toArray()};
  });
  const coarse = run(null), exact = run('oriented-sat-v1');
  assert.ok(coarse.result.contacts>0,'The legacy corner counterfactual must exhibit the actual false contact');
  assert.equal(exact.result.contacts,0); assert.deepEqual(exact.position,[0,1,0]); assert.deepEqual(exact.velocity,[0,2,0]);
});

test('a real impact retains tangent/angular velocity and synchronizes interpolation on the same body', () => world(p => {
  p.addStaticBox('wall',{min:[0,-3,-3],max:[.02,3,3]});
  const body = p.createCargo({position:[2,1,.5],velocity:[5,2,3],angularVelocity:[1,2,3]}), shape=body.shapes[0];
  const r=p.resolveCargoTransit([-2,0,0],{mode:'oriented-sat-v1'});
  assert.ok(r.contacts>0); near(body.position.x,-.3901); near(body.position.y,1); near(body.position.z,.5);
  assert.deepEqual(body.velocity.toArray(),[0,2,3]); assert.deepEqual(body.angularVelocity.toArray(),[1,2,3]);
  assert.equal(body.shapes[0],shape); assert.deepEqual(body.previousPosition,body.position); assert.deepEqual(body.interpolatedPosition,body.position);
}));

test('initial penetration escapes along deterministic shortest SAT face', () => world(p => {
  p.addStaticBox('wall',{min:[0,-3,-3],max:[.02,3,3]});
  const body=p.createCargo({position:[-.1,0,0],velocity:[1,2,0]});
  const r=p.resolveCargoTransit([-.1,0,0],{mode:'oriented-sat-v1'});
  assert.ok(r.contacts>0); near(body.position.x,-.3901); assert.deepEqual(body.velocity.toArray(),[0,2,0]);
}));

test('ignored owners and ramps retain legacy policy; moving Boxes use their pending endpoint', () => world(p => {
  p.addStaticBox('ignored',{min:[-1,-2,-2],max:[-.9,2,2]});
  p.addStaticRamp('ramp',{minX:-2,maxX:2,minZ:-2,maxZ:2,lowY:0,highY:1});
  p.addStaticBox('moving',{min:[-5,-3,-3],max:[-4.98,3,3]},{kinematic:true});
  p.updateStaticBox('moving',{min:[0,-3,-3],max:[.02,3,3]},1/120);
  const body=p.createCargo({position:[2,0,0],velocity:[5,2,3]});
  const r=p.resolveCargoTransit([-2,0,0],{ignoreIds:['ignored'],mode:'oriented-sat-v1'});
  assert.ok(r.contacts>0); near(body.position.x,-.3901);
}));

test('unsupported eligible ownership makes atomic fallback before any transit mutation', () => world(p => {
  p.addStaticBox('valid-first',{min:[0,-3,-3],max:[.02,3,3]});
  const unsupported=new Body({mass:0,shape:new Sphere(1),position:V(100,0,0),collisionFilterMask:2});
  p.world.addBody(unsupported); p.solids.set('unsupported',{body:unsupported,half:V(1,1,1),target:unsupported.position.clone(),remaining:0,inWorld:true});
  p.createCargo({position:[2,0,0],velocity:[5,2,3]});
  const before=snapshot(p);
  assert.equal(resolveExactBoxPortalTransit(p,V(-2,0,0)),null); assert.deepEqual(snapshot(p),before);
  const r=p.resolveCargoTransit([-2,0,0],{mode:'oriented-sat-v1'});
  assert.ok(r.contacts>0); near(p.cargoBody.position.x,-.3901); assert.equal(r.mode,undefined,'Unsupported opt-in invokes the existing legacy result');
}));

test('exact geometry uses native half extents and rejects a stale registry atomically', () => world(p => {
  const wall=p.addStaticBox('wall',{min:[0,-3,-3],max:[.02,3,3]});
  const body=p.createCargo({position:[2,0,0],size:.8});
  const r=p.resolveCargoTransit([-2,0,0],{mode:'oriented-sat-v1'}); near(body.position.x,-.4001); near(r.extent.x,.4);
  // Production registration shares this Vec3 with the native Box. Make an
  // explicitly stale independent registry value before mutating native size.
  assert.equal(p.solids.get('wall').half,wall.shapes[0].halfExtents);
  p.solids.get('wall').half=p.solids.get('wall').half.clone();
  wall.shapes[0].halfExtents.x=.02;
  const before=snapshot(p); assert.equal(resolveExactBoxPortalTransit(p,V(-2,0,0)),null); assert.deepEqual(snapshot(p),before);
}));

test('a missing eligible native owner atomically delegates to the same legacy failure', () => world(p => {
  p.addStaticBox('valid-first',{min:[0,-3,-3],max:[.02,3,3]});
  p.createCargo({position:[2,0,0],velocity:[5,2,3]});
  p.solids.set('missing-owner',{half:V(1,1,1)});
  try {
    const before=snapshot(p);
    assert.equal(resolveExactBoxPortalTransit(p,V(-2,0,0)),null); assert.deepEqual(snapshot(p),before);
    assert.throws(()=>p.resolveCargoTransit([-2,0,0],{mode:'oriented-sat-v1'}),TypeError);
    assert.deepEqual(snapshot(p),before,'No earlier valid-owner contact may be applied before legacy rejects the missing body');
  } finally { p.solids.delete('missing-owner'); }
}));

test('the default transit implementation is unchanged after removing only its opt-in dispatch', () => {
  const source=fs.readFileSync(new URL('../src/game/LabPhysics.js',import.meta.url),'utf8');
  const begin=source.indexOf('  resolveCargoTransit('),end=source.indexOf('\n  setCarryTarget(',begin);
  const dispatch="  resolveCargoTransit(from, { ignoreIds = [], mode = null } = {}) {\n    if (mode === 'oriented-sat-v1') {\n      const exact = resolveExactBoxPortalTransit(this, Array.isArray(from) ? new Vec3(...from) : from, {ignoreIds});\n      if (exact !== null) return exact;\n    }";
  assert.equal(source.indexOf(dispatch),begin);
  const legacy=source.slice(begin,end).replace(dispatch,'  resolveCargoTransit(from, { ignoreIds = [] } = {}) {');
  assert.equal(legacy,fs.readFileSync(new URL('./fixtures/room33-legacy-transit-method.txt',import.meta.url),'utf8'));
});
