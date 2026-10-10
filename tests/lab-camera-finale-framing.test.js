import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LabCamera, CAMERA_PITCH_MIN, CAMERA_PITCH_MAX } from '../src/game/LabCamera.js';
import { createHeadlessGame } from '../scripts/lab-headless.mjs';
import { makePortalFrame, transformPortalPoint, portalRotation } from '../src/game/LabPortals.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const aspects = [640 / 360, 390 / 844];
function fixture(aspect = aspects[0], options = {}) {
  const camera = new THREE.PerspectiveCamera(62, aspect, .06, 160);
  const rig = new LabCamera({ camera, fullBodyFraming: true, ...options });
  const target = V();
  rig.reset(target, 0, -.2);
  return { camera, rig, target };
}
function settle(rig, target, pitch, aiming = false) {
  for (let n = 0; n < 180; n++) rig.update({ dt: 1 / 60, target, yaw: 0, pitch, aiming });
}
function projectMesh(root, camera) {
  root.updateWorldMatrix(true, true);
  let vertices = 0, outside = 0, minY = Infinity, maxY = -Infinity, maxX = 0;
  const point = V();
  root.traverse(mesh => {
    if (!mesh.isMesh) return;
    if (mesh.isSkinnedMesh) mesh.skeleton.update();
    for (let n = 0; n < mesh.geometry.attributes.position.count; n++) {
      mesh.getVertexPosition(n, point).applyMatrix4(mesh.matrixWorld).project(camera);
      vertices++;
      minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
      maxX = Math.max(maxX, Math.abs(point.x));
      if (Math.abs(point.x) > 1 || Math.abs(point.y) > 1 || point.z < -1 || point.z > 1) outside++;
    }
  });
  return { vertices, outside, minY, maxY, maxX };
}

test('the accepted upward freight pitch reproduces the cropped feet until the chamber opts in', () => {
  const { camera, rig, target } = fixture(aspects[0], { fullBodyFraming: false });
  settle(rig, target, .9062922649045352);
  assert.ok(target.clone().project(camera).y < -2,
    'The measured room50 0.906292 rad aim must reproduce the old bottom crop');
  assert.equal(camera.fov, 62);
  rig.configureSilhouette({ enabled: true });
  settle(rig, target, .9062922649045352);
  const feet = target.clone().project(camera);
  assert.ok(feet.y > -.85 && feet.y < -.6, feet.toArray().join(','));
  assert.ok(camera.fov < 82);
  assert.ok(rig.lookPoint.distanceTo(rig.focus.clone().addScaledVector(rig.forward, 16)) < 1e-9,
    'Framing must not substitute a new centre-ray target');
});

test('settled high and low aim frames every original player vertex and the original carried companion on landscape and portrait', async () => {
  const game = await createHeadlessGame();
  const player = game.playerGroup, companion = game.cargo.group;
  const ids = [player.uuid, companion.uuid, game.physics.cargoBody.id];
  player.position.set(0, 0, 0); player.rotation.set(0, Math.PI, 0);
  // This is an isolated optical fixture, not proof of gameplay reachability.
  // Use the uploaded meshes and their live production skeletal rest pose.
  companion.position.set(0, 1.1, -.72); companion.quaternion.identity();
  try {
    for (const aspect of aspects) for (const pitch of [CAMERA_PITCH_MIN, -.2, .35, .6, .9062922649045352, CAMERA_PITCH_MAX]) {
      const { camera, rig, target } = fixture(aspect);
      settle(rig, target, pitch, true);
      const skin = projectMesh(player, camera), cargo = projectMesh(companion, camera);
      assert.equal(skin.vertices, 96753, 'Do not replace the accepted uploaded player');
      assert.equal(skin.outside, 0, JSON.stringify({ aspect, pitch, skin }));
      assert.ok(cargo.vertices > 1000);
      assert.equal(cargo.outside, 0, JSON.stringify({ aspect, pitch, cargo }));
      assert.ok(camera.fov < 82 && camera.fov >= 59.5);
      assert.deepEqual([player.uuid, companion.uuid, game.physics.cargoBody.id], ids);
    }
  } finally { game.physics.dispose(); game.portals.dispose(); }
});

test('ordinary orbit still centres distant high freight and nearly vertical floor shots on both viewports', () => {
  for (const aspect of aspects) for (const [target, point] of [
    [V(), V(0, 17, -14)],
    [V(3.67, 21.23, 4), V(4, .025, 4)],
  ]) {
    const { camera, rig } = fixture(aspect);
    let yaw = 0, pitch = -.2;
    rig.reset(target, yaw, pitch);
    for (let n = 0; n < 600; n++) {
      const screen = point.clone().project(camera);
      yaw -= THREE.MathUtils.clamp(screen.x, -1, 1) * .18;
      pitch = THREE.MathUtils.clamp(pitch + THREE.MathUtils.clamp(screen.y, -1, 1) * .17,
        CAMERA_PITCH_MIN, CAMERA_PITCH_MAX);
      rig.update({ dt: 1 / 60, target, yaw, pitch });
    }
    const screen = point.clone().project(camera);
    assert.ok(Math.abs(screen.x) < .012 && Math.abs(screen.y) < .012,
      JSON.stringify({ aspect, point: point.toArray(), screen: screen.toArray() }));
    const centre = new THREE.Raycaster(); centre.setFromCamera(new THREE.Vector2(), camera);
    assert.ok(centre.ray.direction.distanceTo(camera.getWorldDirection(V())) < 1e-10,
      'The production screen-centre ray must remain the visible optical axis');
    if (point.y < 1) assert.ok(rig.pitch < -1.5, 'Keep the nearly vertical floor aim range');
  }
});

test('an abrupt high aim recovers framing within half a second and never jumps on a frozen frame', () => {
  const { camera, rig, target } = fixture();
  const baseline = fixture(aspects[0], { fullBodyFraming: false });
  let baselineMaxStep = 0, baselinePrevious = baseline.camera.position.clone();
  let missed = 0, longest = 0, maxStep = 0, previous = camera.position.clone();
  for (let n = 0; n < 120; n++) {
    rig.update({ dt: 1 / 60, target, yaw: 0, pitch: .9062922649045352 });
    baseline.rig.update({ dt: 1 / 60, target, yaw: 0, pitch: .9062922649045352 });
    baselineMaxStep = Math.max(baselineMaxStep, baselinePrevious.distanceTo(baseline.camera.position));
    baselinePrevious.copy(baseline.camera.position);
    const feet = target.clone().project(camera);
    missed = feet.y < -1 ? missed + 1 : 0; longest = Math.max(longest, missed);
    maxStep = Math.max(maxStep, previous.distanceTo(camera.position)); previous.copy(camera.position);
  }
  assert.ok(longest < 30, `Recovery hid the feet for ${longest} frames`);
  // The accepted orbit itself already moves 0.981386 m on the second frame
  // of this deliberately abrupt 63-degree input change. The framing assist
  // must not add a larger one-frame translation to that existing response.
  assert.ok(maxStep <= baselineMaxStep + 1e-7,
    `Framing step ${maxStep} m exceeded the retained orbit ${baselineMaxStep} m`);
  const before = { position: camera.position.clone(), rotation: camera.quaternion.clone(), fov: camera.fov,
    backoff: rig.upwardBackoff, backoffVelocity: rig.upwardBackoffVelocity };
  for (let n = 0; n < 180; n++) rig.update({ dt: 0, target, yaw: 2, pitch: CAMERA_PITCH_MIN, aiming: true });
  assert.ok(before.position.distanceTo(camera.position) < 1e-8);
  assert.ok(before.rotation.angleTo(camera.quaternion) < 1e-7);
  assert.equal(camera.fov, before.fov);
  assert.equal(rig.upwardBackoff, before.backoff);
  assert.equal(rig.upwardBackoffVelocity, before.backoffVelocity);
});

test('high-aim framing retains the exact transported lens and its exit constraint at zero elapsed time', () => {
  const { camera, rig, target } = fixture();
  settle(rig, target, .9);
  const entry = makePortalFrame(V(0, 1.2, 0), V(0, 0, 1));
  const exit = makePortalFrame(V(12, 3, -20), V(.4, .8, .2).normalize(), V(0, 0, 1));
  const before = { position: camera.position.clone(), rotation: camera.quaternion.clone(),
    fov: camera.fov, backoff: rig.upwardBackoff };
  const destination = transformPortalPoint(target, entry, exit);
  const controls = rig.applyPortalTransform(entry, exit, { target: destination });
  const expected = transformPortalPoint(before.position, entry, exit);
  const rotation = portalRotation(entry, exit).multiply(before.rotation);
  assert.ok(camera.position.distanceTo(expected) < 1e-9);
  assert.ok(camera.quaternion.angleTo(rotation) < 1e-7);
  rig.update({ dt: 0, target: destination, ...controls });
  assert.ok(camera.position.distanceTo(expected) < 1e-9, 'A framing retreat rebuilt the transported boom');
  assert.ok(camera.quaternion.angleTo(rotation) < 1e-7);
  assert.equal(camera.fov, before.fov); assert.equal(rig.upwardBackoff, before.backoff);
  for (let n = 0; n < 180; n++) {
    rig.update({ dt: 1 / 60, target: destination, ...controls });
    const swept = camera.position.clone(); rig.constrain(rig.playerPivot, swept);
    assert.ok(swept.distanceTo(camera.position) < 1e-8);
    assert.ok([...camera.position, ...camera.quaternion, camera.fov].every(Number.isFinite));
  }
  assert.ok(camera.up.y > .99);
});

test('a blocked retreat keeps the camera and near-plane sweep on the player side of the wall', t => {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(60, 20, .2),
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  wall.position.set(0, 7, 3); wall.updateMatrixWorld(true);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(60, .2, 60),
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  floor.position.set(0, -.1, 0); floor.updateMatrixWorld(true);
  t.after(() => [wall, floor].forEach(mesh => { mesh.geometry.dispose(); mesh.material.dispose(); }));
  const { camera, rig, target } = fixture(aspects[0], { blockers: [wall, floor] });
  for (let n = 0; n < 180; n++) {
    rig.update({ dt: 1 / 60, target, yaw: 0, pitch: .9 });
    const swept = camera.position.clone(); rig.constrain(rig.playerPivot, swept);
    assert.ok(swept.distanceTo(camera.position) < 1e-8, 'Framing bypassed the final sweep');
    assert.ok(camera.position.z < 2.66, 'Framing retreated through the backing wall');
    assert.ok(camera.position.y > .24, 'Framing crossed the floor near-plane margin');
    assert.ok(camera.position.distanceTo(rig.playerPivot) > 2.2, 'The lens entered the original body');
  }
  assert.equal(rig.obstructed, true);
  // In this deliberately narrow fixture no long upward retreat is possible;
  // collision safety wins. It does not claim the whole silhouette can fit.
});
