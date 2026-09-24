import test from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Vec3 } from 'cannon-es';
import { LabPhysics } from '../src/game/LabPhysics.js';

const bounds = (x, y = 0) => ({ min: { x: x - 1, y: y - .25, z: -1 },
  max: { x: x + 1, y: y + .25, z: 1 } });

test('distant static models return before a portal-delivered cargo can contact them', () => {
  const physics = new LabPhysics();
  try {
    physics.addStaticBox('start', bounds(0));
    for (let i = 0; i < 760; i++) physics.addStaticBox(`scenery-${i}`, bounds(100 + i * 3));
    const target = 'scenery-200', destination = 700;
    const body = physics.createCargo({ position: [0, 2, 0] });
    physics.step(1 / 120);
    assert.ok(physics.world.bodies.length < 20, 'far static bodies should not consume a Cannon step');
    assert.equal(physics.solids.get(target).inWorld, false);
    physics.teleportCargo({ position: new Vec3(destination, 2, 0), rotation: new Quaternion() });
    physics.step(1 / 120);
    assert.equal(physics.solids.get(target).inWorld, true, 'destination collider must return on the first step');
    assert.equal(physics.cargoBody, body);
    for (let i = 0; i < 120; i++) physics.step(1 / 120);
    assert.ok(body.position.y >= .62 && body.position.y < .68, `cargo rests on the destination: ${body.position.y}`);
    assert.equal(physics.solids.get('start').inWorld, false);
    assert.ok(physics.world.bodies.length < 20);
    assert.equal(physics.removeStaticBox('start'), true, 'an inactive collider can be removed cleanly');
    assert.equal(physics.solids.has('start'), false);
    for (let i = 0; i < 11; i++) physics.removeStaticBox(`scenery-${i}`);
    physics.step(1 / 120);
    assert.equal(physics.solids.size, 749);
    assert.equal(physics.world.bodies.length, 750, 'shrinking the room restores ordinary world registration');
  } finally { physics.dispose(); }
});

test('disabled distant solids remain noncolliding after reactivation', () => {
  const physics = new LabPhysics();
  try {
    physics.addStaticBox('start', bounds(0));
    for (let i = 0; i < 750; i++) physics.addStaticBox(`scenery-${i}`, bounds(100 + i * 3));
    const destination = 700, target = 'scenery-200';
    physics.createCargo({ position: [0, 2, 0] });
    physics.step(1 / 120);
    assert.equal(physics.solids.get(target).inWorld, false);
    assert.equal(physics.setStaticEnabled(target, false), true);
    physics.teleportCargo({ position: new Vec3(destination, 2, 0), rotation: new Quaternion() });
    for (let i = 0; i < 100; i++) physics.step(1 / 120);
    assert.equal(physics.solids.get(target).inWorld, true);
    assert.equal(physics.solids.get(target).body.collisionFilterMask, 0);
    assert.ok(physics.cargoBody.position.y < -.2, 'disabled floor still allows cargo to fall');
  } finally { physics.dispose(); }
});
