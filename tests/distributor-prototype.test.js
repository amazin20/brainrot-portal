import test from 'node:test';
import assert from 'node:assert/strict';
import { Vec3, Body, PointToPointConstraint } from 'cannon-es';
import { DistributorBench, DISTRIBUTOR_STEP } from '../src/prototypes/DistributorRig.js';

const run = (b, seconds = 12) => { for (let i = 0; i < Math.round(seconds / DISTRIBUTOR_STEP); i++) b.step(); return b.snapshot(); };
const state = (s, side) => {
  assert.ok(Math.abs(s.angle - side * .6) < .025, `not settled: ${JSON.stringify(s)}`);
  assert.ok(Math.abs(s.omega) < .012, 'residual angular speed');
  assert.ok(s.maxAngle < .66, 'physical end stop was passed');
  assert.ok(s.paddleContacts > 0, 'fixture never hit the real paddle');
  assert.ok(s.cargo.every(Number.isFinite) && s.cargo[1] > .35, 'cargo fell through recovery floor');
};
for (const side of [-1, 1]) for (const speed of [4, 8, 12]) for (const lever of [1.6, 1.8, 2]) {
  test(`real paddle impact side=${side}, speed=${speed}, lever=${lever}`, () => {
    const b = new DistributorBench(); try { b.launch({ side, speed, lever }); state(run(b), side); } finally { b.dispose(); }
  });
}
test('weak contact cannot select the neighbouring detent', () => {
  const b = new DistributorBench(); try {
    b.launch({ speed: .5, distance: .52 }); const s = run(b);
    assert.ok(s.paddleContacts > 0); assert.ok(s.maxAngle < .2); assert.ok(Math.abs(s.angle) < .025);
  } finally { b.dispose(); }
});
test('reverse impact uses the same persistent cargo and reaches the opposite stop', () => {
  const b = new DistributorBench(); try {
    const id = b.cargo.id;
    b.launch({ speed: 8 }); state(run(b), 1);
    b.launch({ side: -1, speed: 8, reset: false }); state(run(b), -1);
    b.launch({ side: 1, speed: 8, reset: false }); state(run(b), 1);
    assert.equal(b.cargo.id, id); assert.equal(b.world.bodies.length, 6);
  } finally { b.dispose(); }
});
test('large repeated impacts stay within physical stops and recover cargo', () => {
  const b = new DistributorBench(); try {
    for (let i = 0; i < 6; i++) {
      b.launch({ side: i % 2 ? -1 : 1, speed: 24, reset: i === 0 });
      const s = run(b); assert.ok(s.maxAngle < .67); assert.ok(Math.abs(s.omega) < .05);
      assert.ok(s.cargo[1] > .35 && Math.abs(s.cargo[0]) < 8 && Math.abs(s.cargo[2]) < 8);
    }
  } finally { b.dispose(); }
});
test('30/60/120 display Hz and a long frame produce identical fixed-step results', () => {
  const results = [];
  for (const hz of [30, 60, 120]) {
    const b = new DistributorBench(); try { b.launch({ speed: 8 }); for (let i = 0; i < hz * 12; i++) b.advance(1 / hz); results.push(b.snapshot()); } finally { b.dispose(); }
  }
  const b = new DistributorBench(); try { b.launch({ speed: 8 }); b.advance(.25); for (let i = 0; i < 705; i++) b.advance(1 / 60); results.push(b.snapshot()); } finally { b.dispose(); }
  for (const s of results) { assert.equal(s.steps, 1440); assert.ok(Math.abs(s.angle - results[0].angle) < 1e-12); assert.deepEqual(s.cargo, results[0].cargo); }
});
test('brake dissipates motion, release returns to a stable detent', () => {
  const b = new DistributorBench(); try {
    b.launch({ speed: 8 }); run(b, .25); const moving = Math.abs(b.rig.rotor.angularVelocity.y);
    b.rig.setBrake(true); run(b, 3); assert.ok(Math.abs(b.rig.rotor.angularVelocity.y) < moving / 30);
    b.rig.setBrake(false); state(run(b), 1);
  } finally { b.dispose(); }
});
test('unforced rotor plus elastic detent does not create growing energy', () => {
  const b = new DistributorBench(); try {
    b.cargo.position.set(5, .4, 5); b.rig.rotor.quaternion.setFromAxisAngle(new Vec3(0, 1, 0), .15);
    b.rig.rotor.angularVelocity.y = .15;
    const energy = () => .5 * b.rig.rotor.inertia.y * b.rig.rotor.angularVelocity.y ** 2 + b.rig.springEnergy;
    const start = energy(); let max = start;
    for (let i = 0; i < 2400; i++) { b.step(); max = Math.max(max, energy()); }
    assert.ok(max < start * 1.03); assert.ok(energy() < start * .01);
  } finally { b.dispose(); }
});
test('bounded-force held-cargo fixture does not tunnel or multiply bodies at paddle', () => {
  const b = new DistributorBench(); const hand = new Body({ mass: 0, position: new Vec3(1.8, 2.24, .55) });
  try {
    b.launch({ speed: 0, distance: .55 }); b.world.addBody(hand);
    const hold = new PointToPointConstraint(b.cargo, new Vec3(), hand, new Vec3(), 45); b.world.addConstraint(hold);
    run(b, 4); assert.ok(Math.abs(b.rig.angle) < .66); assert.ok(b.cargo.position.distanceTo(hand.position) < .35);
    b.world.removeConstraint(hold); b.world.removeBody(hand);
    run(b, 8); assert.equal(b.world.bodies.length, 6); assert.ok(b.cargo.position.y > .35);
  } finally { if (hand.world) b.world.removeBody(hand); b.dispose(); }
});
test('repeated reset/dispose leaves one cargo and no retained physics bodies or hinge', () => {
  const b = new DistributorBench(); const id = b.cargo.id;
  for (let i = 0; i < 20; i++) { b.launch({ side: i % 2 ? -1 : 1 }); run(b, .1); assert.equal(b.cargo.id, id); assert.equal(b.world.bodies.length, 6); }
  b.dispose(); b.dispose(); assert.equal(b.world.bodies.length, 0); assert.equal(b.world.constraints.length, 0);
  assert.throws(() => b.rig.beforeStep());
});
test('invalid frame and launch inputs cannot enter the simulation', () => {
  const b = new DistributorBench(); try {
    for (const value of [NaN, Infinity, -1, 2]) assert.throws(() => b.advance(value));
    assert.throws(() => b.launch({ speed: -1 })); assert.throws(() => b.launch({ side: 0 }));
    assert.throws(() => b.rig.beforeStep(.2));
  } finally { b.dispose(); }
});
