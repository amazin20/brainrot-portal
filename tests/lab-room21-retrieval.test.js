import test from 'node:test';
import assert from 'node:assert/strict';
import { room21ReceiverApproach } from '../src/game/LabRoom21Retrieval.js';

test('receiver waypoint retains capsule clearance for the exact failed WebGL cargo landing', () => {
  const cargo = { x: 18.198283754463706, z: 2.986203140019182 };
  const target = room21ReceiverApproach(cargo);
  assert.ok(cargo.x + 1 > 19.0699, 'The old target must reproduce the blocked side');
  assert.deepEqual(target, [18.8, cargo.z]);
  assert.ok(target[0] < 19.0699);
  assert.ok(Math.hypot(target[0] - cargo.x, target[1] - cargo.z) < 1.01);
  assert.deepEqual(cargo, { x: 18.198283754463706, z: 2.986203140019182 });
});

test('normal and edge waypoint samples stay inside the receiver and within pickup distance', () => {
  for (const x of [7.4, 9, 13.25, 17.5, 18.198283754463706, 19.05]) {
    for (const z of [2.4, 2.986203140019182, 6, 9.6]) {
      const target = room21ReceiverApproach({ x, z });
      assert.ok(target[0] >= 7.7 && target[0] <= 18.8);
      assert.ok(target[1] >= 2.65 && target[1] <= 9.35);
      assert.ok(Math.hypot(target[0] - x, target[1] - z) < 1.1);
    }
  }
});

test('invalid receiver coordinates fail before any movement is requested', () => {
  for (const position of [null, {}, { x: NaN, z: 6 }, { x: 10, z: Infinity }]) {
    assert.throws(() => room21ReceiverApproach(position), TypeError);
  }
});
