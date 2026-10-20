import test, {after, beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Ray, RaycastResult, Vec3} from 'cannon-es';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {LabCamera} from '../src/game/LabCamera.js';
import {disposeLabLevel} from '../src/game/LabLevelLifecycle.js';

// These are finite component probes of the physical Box, not gameplay routes
// or a comparison with the paddle's intentionally rounded visible corners.
const game = await createHeadlessGame();
game.chamberEdition = 'foundation';
await game.selectLevel(35, false);
after(() => disposeLabLevel(game));
beforeEach(() => game.firstLevel.rotor.reset());

const V = (...p) => new THREE.Vector3(...p);
const A = [[-5, 2, -1], [-5, 2, -9]];
const B = [[-4, 2, -2], [-12, 2, -2]];

function fixture() {
  const level = game.firstLevel, rotor = level.rotor;
  const collider = game.colliders.find(({mesh}) => {
    const p = mesh.geometry?.parameters;
    return mesh.userData.collisionProxy && mesh.position.distanceTo(V(-8, 2, -5)) < 1e-6
      && Math.abs(p?.width - 8) < 1e-5 && Math.abs(p?.height - 3) < 1e-5
      && Math.abs(p?.depth - .65) < 1e-5 && mesh.raycast !== THREE.Mesh.prototype.raycast;
  });
  assert.ok(collider, 'The actual room36 paddle must retain its physical query proxy');
  assert.equal(game.physics.solids.has(collider.mesh.uuid), false, 'The former static body stays removed');
  assert.equal(rotor.body.world, game.physics.world);
  return {level, rotor, body: rotor.body, collider, mesh: collider.mesh};
}

function pose(body, yaw) {
  body.quaternion.setFromAxisAngle(new Vec3(0, 1, 0), yaw);
  body.aabbNeedsUpdate = true;
}

function raycaster(from, to) {
  const start = V(...from), end = V(...to);
  return new THREE.Raycaster(start, end.sub(start).normalize(), 0, V(...from).distanceTo(V(...to)));
}

function physicalHit(body, from, to) {
  const ray = new Ray(new Vec3(...from), new Vec3(...to)), result = new RaycastResult();
  ray.mode = Ray.CLOSEST;
  ray.skipBackfaces = true;
  ray.intersectBody(body, result);
  return result.hasHit ? result : null;
}

function compareRay({body, mesh}, from, to, label = '') {
  const expected = physicalHit(body, from, to);
  const actual = raycaster(from, to).intersectObject(mesh, false)[0] ?? null;
  assert.equal(!!actual, !!expected, `Physical Box hit presence: ${label} ${from} -> ${to}`);
  if (expected) {
    assert.ok(Math.abs(actual.distance - expected.distance) < 2e-5,
      `Physical Box distance: ${label}: ${actual.distance} / ${expected.distance}`);
    assert.ok(actual.point.distanceTo(V(expected.hitPointWorld.x, expected.hitPointWorld.y, expected.hitPointWorld.z)) < 2e-5);
  }
  return actual;
}

function state({level, rotor, body, collider}) {
  const xyz = value => [value.x, value.y, value.z];
  return {
    body: {position: xyz(body.position), quaternion: [...xyz(body.quaternion), body.quaternion.w],
      velocity: xyz(body.velocity), angularVelocity: xyz(body.angularVelocity), force: xyz(body.force),
      torque: xyz(body.torque), sleep: body.sleepState, aabbNeedsUpdate: body.aabbNeedsUpdate,
      mass: body.mass, group: body.collisionFilterGroup, mask: body.collisionFilterMask,
      shape: xyz(body.shapes[0].halfExtents), offset: xyz(body.shapeOffsets[0]),
      orientation: [...xyz(body.shapeOrientations[0]), body.shapeOrientations[0].w]},
    rotor: [rotor.angle, rotor.omega, rotor.previousAngle],
    bridge: [...level.bridge.position],
    bridgeStation: {...level.bridge.stations[1]},
    colliderBounds: [...collider.box.min, ...collider.box.max],
    cargo: [...game.cargo.position], bodies: game.physics.world.bodies.map(b => b.id),
    physics: game.physics,
  };
}

function probes() {
  const rays = [];
  for (const y of [.51, 2, 3.49, 4]) {
    for (const x of [-12.2, -11.8, -10.8, -9.7, -8.3, -7.1, -6.2, -5.1, -4.1, -3.8])
      rays.push([[x, y, -12], [x, y, 2]]);
    for (const z of [-9.2, -8.8, -7.8, -6.7, -5.3, -4.1, -3.2, -2.1, -1.1, -.8])
      rays.push([[-15, y, z], [-1, y, z]]);
  }
  return rays;
}

test('room36 proxy agrees with Cannon Box for 400 finite rays across five rotor phases without changing mechanics', () => {
  const f = fixture();
  let hits = 0, misses = 0;
  for (const yaw of [0, .19, .47, 1.0, Math.PI / 2]) {
    pose(f.body, yaw);
    const before = state(f);
    for (const [from, to] of probes()) {
      if (compareRay(f, from, to, `yaw=${yaw}`)) hits++; else misses++;
    }
    assert.deepEqual(state(f), before, 'Querying must not step, reset or change mechanics or collider AABBs');
  }
  assert.ok(hits > 0 && misses > 0);
});

test('the production portal first-hit path clears the old face and detects the newly rotated face', () => {
  const f = fixture(), blockers = game.aimBlockers;
  // Keep the production first-hit predicate and query; isolate its subject
  // from unrelated room walls so both diagnostic rays test this component.
  game.aimBlockers = [f.mesh];
  function first([from, to]) {
    const query = raycaster(from, to);
    game.portalShots.ray.set(query.ray.origin, query.ray.direction);
    game.portalShots.ray.near = query.near;
    game.portalShots.ray.far = query.far;
    return game.portalShots.firstHit();
  }
  try {
    const old = first(A);
    assert.ok(old);
    assert.ok(Math.abs(old.distance - 3.675) < 2e-5);
    assert.equal(first(B), undefined);
    pose(f.body, Math.PI / 2);
    const before = state(f);
    assert.equal(first(A), undefined, 'Old axis-aligned face no longer blocks this ray');
    const current = first(B);
    assert.ok(current);
    assert.ok(Math.abs(current.distance - physicalHit(f.body, ...B).distance) < 2e-5);
    assert.deepEqual(state(f), before);
  } finally { game.aimBlockers = blockers; }
});

test('a query after an actual physics step uses the current Box before the next room update', () => {
  const f = fixture();
  const art = game.scene.getObjectByName('Angular impact paddle');
  assert.ok(art);
  assert.equal(art.quaternion.y, 0);
  f.body.angularVelocity.y = 2;
  game.physics.step(1 / 30);
  assert.ok(Math.abs(f.body.quaternion.y) > .02);
  assert.equal(art.quaternion.y, 0, 'No subsequent rotor.update has copied the physical pose to art');
  assert.equal(f.rotor.angle, 0);
  const before = state(f);
  const hit = compareRay(f, [-4.2, 2, -12], [-4.2, 2, 2]);
  assert.ok(hit && Math.abs(hit.distance - 6.675) > .05, 'The distance differs from the initial proxy face');
  for (const [from, to] of probes()) compareRay(f, from, to, 'after physics.step');
  assert.deepEqual(state(f), before);
});

test('nonuniform rotated parents retain the exact current physical world matrix, including shear in local space', () => {
  const f = fixture(), parent = f.mesh.parent, wrapper = new THREE.Group();
  parent.add(wrapper); wrapper.add(f.mesh);
  try {
    pose(f.body, .83);
    for (const [position, rotation, scale] of [
      [[7, -3, 11], [.23, .61, -.18], [2, .7, 1.4]],
      [[-9, 5, -8], [-.37, -.81, .29], [.6, 1.9, 2.3]],
    ]) {
      wrapper.position.fromArray(position); wrapper.rotation.set(...rotation); wrapper.scale.fromArray(scale);
      const before = state(f);
      for (const [from, to] of probes()) compareRay(f, from, to, 'transformed parent');
      const size = f.mesh.geometry.boundingBox.getSize(V()), h = f.body.shapes[0].halfExtents;
      // The proxy's Float32 vertex extent is not necessarily its constructor
      // size (.65 is rounded); map that actual extent to Cannon's exact Box.
      const expected = new THREE.Matrix4().compose(V(f.body.position.x, f.body.position.y, f.body.position.z),
        new THREE.Quaternion(f.body.quaternion.x, f.body.quaternion.y, f.body.quaternion.z, f.body.quaternion.w),
        V(h.x * 2 / size.x, h.y * 2 / size.y, h.z * 2 / size.z));
      f.mesh.updateWorldMatrix(true, false);
      f.mesh.matrixWorld.elements.forEach((value, i) => assert.ok(Math.abs(value - expected.elements[i]) < 2e-10));
      assert.equal(f.mesh.matrixAutoUpdate, false);
      assert.deepEqual(state(f), before);
    }
  } finally { parent.add(f.mesh); wrapper.removeFromParent(); }
});

test('camera broad phase begun before rotation preserves both full-list nine-ray constraint outcomes', () => {
  const f = fixture();
  const rig = new LabCamera({camera: new THREE.PerspectiveCamera(62, 16 / 9, .1, 150),
    blockers: [f.mesh], isBlocker: mesh => game.isActiveBlocker(mesh)});
  for (const [ray, expected] of [[A, false], [B, true]]) {
    pose(f.body, 0); compareRay(f, ...A);
    rig.broadPhase.begin(rig.blockers);
    assert.equal(rig.broadPhase.entries[0].bounded, false, 'A current-pose query must remain uncullable');
    pose(f.body, Math.PI / 2);
    const origin = V(...ray[0]), destination = V(...ray[1]);
    const optimized = destination.clone(), raysBefore = rig.queryStats.rays;
    const result = rig.constrain(origin, optimized);
    assert.equal(rig.queryStats.rays - raysBefore, 9);
    rig.broadPhase.end();
    const full = destination.clone(), fullResult = rig.constrain(origin, full);
    assert.equal(result, expected);
    assert.equal(result, fullResult);
    assert.ok(optimized.distanceTo(full) < 1e-10);
  }
});

test('invalid ownership, removed bodies and invalid physical state fail explicitly without creating physics', () => {
  const f = fixture(), physics = game.physics, body = f.body, owner = f.rotor.owner;
  const query = () => raycaster(...A).intersectObject(f.mesh, false);
  try {
    game.physics = null;
    assert.throws(query, /owner is no longer active/);
    assert.equal(game.physics, null, 'Ray queries must never allocate a replacement physics owner');
    game.physics = physics;
    f.rotor.owner = null; assert.throws(query, /owner is no longer active/); f.rotor.owner = owner;
    f.rotor.body = null; assert.throws(query, /owner is no longer active/); f.rotor.body = body;
    physics.world.removeBody(body);
    assert.throws(query, /owner is no longer active/);
    physics.world.addBody(body);
    const shape = body.shapes[0];
    try { body.shapes[0] = null; assert.throws(query, /original physical Box/); }
    finally { body.shapes[0] = shape; }
    const x = body.position.x;
    try { body.position.x = NaN; assert.throws(query, /finite physical pose/); }
    finally { body.position.x = x; }
    compareRay(f, ...A);
  } finally {
    game.physics = physics; f.rotor.owner = owner; f.rotor.body = body;
    if (!body.world) physics.world.addBody(body);
  }
});

test('reset is immediately queryable and a real room replacement releases the old binding', async () => {
  const f = fixture(), originalBody = f.body, bound = f.mesh.raycast, oldPhysics = game.physics;
  pose(f.body, 1.1); f.rotor.update(0); compareRay(f, ...B);
  f.rotor.reset();
  assert.equal(f.rotor.body, originalBody);
  assert.equal(f.mesh.raycast, bound);
  assert.equal(f.rotor.angle, 0);
  assert.ok(compareRay(f, ...A));
  assert.equal(compareRay(f, ...B), null);
  await game.selectLevel(35, false);
  assert.equal(f.mesh.raycast, THREE.Mesh.prototype.raycast);
  assert.equal(f.mesh.matrixAutoUpdate, true);
  const next = fixture();
  assert.notEqual(game.physics, oldPhysics);
  assert.notEqual(next.body, originalBody);
  assert.notEqual(next.mesh, f.mesh);
  assert.ok(compareRay(next, ...A));
});
