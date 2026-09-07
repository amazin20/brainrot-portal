import test from 'node:test';
import assert from 'node:assert/strict';
import { LabFlywheelDynamics, LabCounterweightDynamics, LabSpringLatchDynamics } from '../src/game/LabTactileDynamics.js';
const close = (a, b, epsilon = 1e-8) => assert.ok(Math.abs(a - b) <= epsilon, `${a} != ${b}`);

test('flywheel: no wind and no stored energy cannot perform lifting work', () => {
  const wheel = new LabFlywheelDynamics();
  for (let i = 0; i < 600; i++) wheel.step(1 / 120);
  assert.equal(wheel.energy, 0); assert.equal(wheel.performWork(100), 0);
});

test('flywheel: wind builds energy; work consumes rather than duplicates it', () => {
  const wheel = new LabFlywheelDynamics();
  for (let i = 0; i < 240; i++) wheel.step(1 / 120, { torque: 18 });
  const before = wheel.energy; assert.ok(before > 10);
  close(wheel.performWork(10), 10); close(wheel.energy, before - 10);
  close(wheel.performWork(1e6), before - 10); close(wheel.energy, 0);
});

test('flywheel: removing wind allows coast-down and a brake dissipates faster', () => {
  const free = new LabFlywheelDynamics(), braked = new LabFlywheelDynamics();
  free.applyAngularImpulse(64); braked.applyAngularImpulse(64);
  const initial = free.energy;
  for (let i = 0; i < 120; i++) { free.step(1 / 120); braked.step(1 / 120, { brake: true }); }
  assert.ok(free.energy > 0 && free.energy < initial);
  assert.ok(braked.energy < free.energy * .2);
  close(free.energy + free.dissipated, initial, 1e-6);
  close(braked.energy + braked.dissipated, initial, 1e-6);
});

test('flywheel: constant wind has equivalent response at 30, 60 and 120 Hz', () => {
  const results = [30, 60, 120].map(hz => {
    const wheel = new LabFlywheelDynamics();
    for (let i = 0; i < hz * 3; i++) wheel.step(1 / hz, { torque: 12 });
    return wheel.snapshot();
  });
  for (const result of results) { close(result.speed, results[0].speed); close(result.angle, results[0].angle); }
});

test('counterweight: tray displacement preserves total cable travel', () => {
  const hoist = new LabCounterweightDynamics({ initialPosition: 3 }); hoist.setBrake(false);
  for (let i = 0; i < 120; i++) {
    const state = hoist.step(1 / 120, { rightLoad: 6 });
    close(state.leftHeight + state.rightHeight, 6);
    assert.ok(state.leftHeight >= 0 && state.leftHeight <= 6);
  }
  assert.ok(hoist.position > 3);
});

test('counterweight: exchanging live loads reverses motion; brake holds the actual coordinate', () => {
  const hoist = new LabCounterweightDynamics({ initialPosition: 2 }); hoist.setBrake(false);
  for (let i = 0; i < 60; i++) hoist.step(1 / 120, { rightLoad: 5 });
  const raised = hoist.position; assert.ok(raised > 2);
  hoist.setBrake(true);
  for (let i = 0; i < 120; i++) hoist.step(1 / 120, { leftLoad: 9 });
  close(hoist.position, raised); assert.equal(hoist.velocity, 0);
  hoist.setBrake(false);
  for (let i = 0; i < 120; i++) hoist.step(1 / 120, { leftLoad: 9 });
  assert.ok(hoist.position < raised);
});

test('counterweight: equal loads do not make an unpowered tray rise', () => {
  const hoist = new LabCounterweightDynamics({ initialPosition: 2.75 }); hoist.setBrake(false);
  for (let i = 0; i < 1200; i++) hoist.step(1 / 120, { leftLoad: 3, rightLoad: 3 });
  close(hoist.position, 2.75); close(hoist.velocity, 0);
});

test('spring latch: weak impact returns; sufficient physical impulse engages the catch', () => {
  const weak = new LabSpringLatchDynamics(), strong = new LabSpringLatchDynamics();
  weak.applyImpulse(2); strong.applyImpulse(55);
  for (let i = 0; i < 600; i++) { weak.step(1 / 120); strong.step(1 / 120); }
  assert.equal(weak.latched, false); close(weak.compression, 0, .001);
  assert.equal(strong.latched, true); close(strong.compression, strong.catchAt);
  strong.release();
  for (let i = 0; i < 600; i++) strong.step(1 / 120);
  assert.equal(strong.latched, false); close(strong.compression, 0, .001);
});

test('mechanisms: invalid parameters and deltas cannot corrupt mechanical state', () => {
  assert.throws(() => new LabFlywheelDynamics({ inertia: 0 }), RangeError);
  assert.throws(() => new LabCounterweightDynamics({ trayMass: -1 }), RangeError);
  assert.throws(() => new LabSpringLatchDynamics({ catchAt: 2, stroke: 1 }), RangeError);
  for (const mechanism of [new LabFlywheelDynamics(), new LabCounterweightDynamics(), new LabSpringLatchDynamics()]) {
    const before = mechanism.snapshot();
    assert.throws(() => mechanism.step(NaN), TypeError);
    assert.throws(() => mechanism.step(-1), RangeError);
    assert.throws(() => mechanism.step(2), RangeError);
    assert.deepEqual(mechanism.snapshot(), before);
    const copy = mechanism.snapshot(); copy.velocity = NaN; copy.speed = NaN;
    assert.ok(Object.values(mechanism.snapshot()).every(value => typeof value !== 'number' || Number.isFinite(value)));
  }
});
