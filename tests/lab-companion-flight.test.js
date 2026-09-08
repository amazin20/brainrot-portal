import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LabCompanionRig } from '../src/game/LabCompanionRig.js';

function fixture() {
  const visual = new THREE.Group();
  visual.position.set(.2, -.4, .1);
  visual.rotation.set(.05, .3, -.02);
  visual.add(new THREE.Mesh(new THREE.BoxGeometry(.6, .5, .7), new THREE.MeshBasicMaterial()));
  const rig = new LabCompanionRig(visual);
  rig.reset();
  return { visual, rig };
}

function advance(rig, seconds, input, hz = 60) {
  const frames = Math.round(seconds * hz);
  for (let i = 0; i < frames; i++) rig.update({ dt: seconds / frames, elapsed: (i + 1) * seconds / frames,
    grounded: false, carrying: true, tumbling: true, ...input });
}

test('carried vertical flight braces the same fins and feet as equal-speed horizontal flight', () => {
  const horizontal = fixture().rig;
  advance(horizontal, 1, { speed: 16, velocity: new THREE.Vector3(16, 0, 0) });
  for (const vy of [-16, 16]) {
    const { rig, visual } = fixture();
    const position = visual.position.clone(), rotation = visual.quaternion.clone(), scale = visual.scale.clone();
    const geometry = rig.mesh.geometry;
    const attributes = Object.fromEntries(Object.entries(geometry.attributes).map(([key, attr]) => [key, attr.array.slice()]));
    advance(rig, 1, { speed: 0, velocity: new THREE.Vector3(0, vy, 0) });
    assert.ok(rig.flightBrace > .99, `vertical ${vy} m/s had no visible brace: ${rig.flightBrace}`);
    assert.ok(Math.abs(rig.flightBrace - horizontal.flightBrace) < 1e-12);
    for (const name of ['FinL', 'FinR', 'FootL', 'FootR']) {
      assert.ok(rig.bones[name].quaternion.angleTo(horizontal.bones[name].quaternion) < 1e-7, `${name} changed with flight axis`);
    }
    assert.deepEqual(visual.position, position);
    assert.deepEqual(visual.quaternion.toArray(), rotation.toArray());
    assert.deepEqual(visual.scale, scale);
    assert.equal(rig.mesh.geometry, geometry);
    for (const [key, array] of Object.entries(attributes)) assert.deepEqual(geometry.attributes[key].array, array);
    assert.equal(rig.walk, 0, 'airborne bracing must not start the walk cycle');
  }
});

test('vertical bracing stays quiet on ordinary falls, grounded support and free tumbling', () => {
  for (const input of [
    { speed: 0, velocity: new THREE.Vector3(0, -4, 0) },
    { speed: 0, velocity: new THREE.Vector3(0, -16, 0), grounded: true },
    { speed: 0, velocity: new THREE.Vector3(0, -16, 0), carrying: false },
  ]) {
    const { rig } = fixture();
    advance(rig, 1, input);
    assert.equal(rig.flightBrace, 0);
  }
  const { rig } = fixture();
  advance(rig, 1, { speed: 16 });
  assert.ok(rig.flightBrace > .99, 'older callers supplying only speed keep the existing brace');
  advance(rig, 1, { speed: 0, velocity: new THREE.Vector3(NaN, Infinity, 0) });
  for (const bone of Object.values(rig.bones)) assert.ok(bone.quaternion.toArray().every(Number.isFinite));
});

test('portal redirection keeps carried bracing continuous and contact releases it at every frame rate', () => {
  const samples = [];
  for (const hz of [30, 60, 144]) {
    const { rig } = fixture();
    advance(rig, 1, { speed: 16, velocity: new THREE.Vector3(16, 0, 0) }, hz);
    const before = rig.flightBrace;
    rig.update({ dt: 1 / hz, elapsed: 1 + 1 / hz, speed: 0, velocity: new THREE.Vector3(0, -16, 0), grounded: false, carrying: true });
    assert.ok(rig.flightBrace >= before, 'a direction change incorrectly released the brace');
    advance(rig, 1, { speed: 0, velocity: new THREE.Vector3(0, -16, 0), grounded: true }, hz);
    assert.ok(rig.flightBrace < .001, 'contact must release bracing even before sampled speed settles');
    samples.push(rig.flightBrace);
    rig.reset();
    assert.equal(rig.flightBrace, 0);
  }
  assert.ok(Math.max(...samples) - Math.min(...samples) < 1e-8);
});

test('game visuals carry actual vertical body velocity into the companion pose without writing physics', async () => {
  const { createHeadlessGame } = await import('../scripts/lab-headless.mjs');
  const game = await createHeadlessGame();
  try {
    game.resetRun(true);
    game.heldCube = game.cargo;
    game.physics.grounded = false;
    const body = game.physics.cargoBody;
    body.velocity.set(0, -16, 0);
    const before = [body.position.toArray(), body.quaternion.toArray(), body.velocity.toArray(), body.angularVelocity.toArray()];
    for (let i = 0; i < 60; i++) game.updateVisuals(1 / 60, 1);
    assert.ok(game.companionRig.flightBrace > .99, 'the game lost vertical velocity before updating the rig');
    assert.equal(game.physics.cargoBody, body);
    assert.deepEqual([body.position.toArray(), body.quaternion.toArray(), body.velocity.toArray(), body.angularVelocity.toArray()], before);
    game.physics.grounded = true;
    for (let i = 0; i < 60; i++) game.updateVisuals(1 / 60, 1);
    assert.ok(game.companionRig.flightBrace < .001);
  } finally {
    game.physics.dispose();
    game.portals.dispose();
  }
});
