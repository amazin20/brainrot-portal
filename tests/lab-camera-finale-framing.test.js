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
  // Use the uploaded source meshes and their rest transforms. The headless
  // loader omits skin weights/animation; native animated framing is separate.
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

test('the recorded third-portal retraction fits feet immediately and rechecks the widened near plane', t => {
  // Optical replay of final camera states from the unchanged ordinary room50
  // route at visual steps 7485–7507, plus the falling candidate's limiting
  // steps 7526–7527. No actor state is injected into a route.
  // Headless GLB omits native skin weights: these measured lens/foot anchors
  // do not certify the animated native model or every encoded movie frame.
  const samples = [
    [[8.934864,7.382784,-10.488547],[2.609266,9.804020,-8.174467],[-.111562,-.618614,.127054,.767286],62.660755],
    [[9.027722,7.255838,-10.489971],[6.693060,9.353669,-9.673830],[-.096615,-.635348,.120713,.756589],62.658046],
    [[9.120569,7.123700,-10.491171],[6.770172,9.190197,-9.718610],[-.086930,-.638553,.114929,.755966],62.655523],
    [[9.584689,6.384074,-10.494851],[7.162356,8.213757,-9.930454],[-.044726,-.651311,.094762,.751541],62.645397],
    [[9.926171,6.281085,-10.496599],[7.370214,7.412343,-10.057087],[-.014478,-.659538,.076342,.747644],62.569444],
    [[9.948261,6.280919,-10.496758],[7.351323,7.351889,-10.072231],[-.011195,-.660551,.073471,.747094],62.544242],
    [[10.015518,6.280242,-10.497411],[7.047941,7.320947,-10.145495],[.004516,-.666199,.053256,.743856],62.332005],
    [[9.584352,6.382957,-10.490945],[7.228084,8.680123,-9.966731],[-.054463,-.651173,.086556,.752008],88],
    [[9.677160,6.282497,-10.491374],[7.289172,8.564788,-9.992520],[-.049285,-.652892,.082114,.751373],88],
  ];
  let oldCrops = 0, overBudget = 0;
  for (const aspect of aspects) for (const [foot, eye, rotation, fov] of samples) {
    const { camera, rig, target } = fixture(aspect);
    target.fromArray(foot); rig.playerPivot.copy(target).y += 1.32;
    rig.focus.copy(rig.playerPivot);
    camera.position.fromArray(eye); camera.quaternion.fromArray(rotation).normalize();
    camera.up.copy(V(0, 1, 0).applyQuaternion(camera.quaternion));
    camera.fov = fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    rig.lookPoint.copy(camera.position).addScaledVector(camera.getWorldDirection(V()), 16);
    if (target.clone().project(camera).y < -1) oldCrops++;
    const before = { eye: camera.position.clone(), axis: camera.getWorldDirection(V()), fov };
    rig.configureSilhouette({ enabled: false }); rig.fitSilhouetteLens(1 / 60);
    assert.equal(camera.fov, fov, 'Default campaign lens must remain exact');
    rig.configureSilhouette({ enabled: true }); rig.fovVelocity = -4;
    rig.fitSilhouetteLens(0);
    assert.equal(camera.fov, fov); assert.equal(rig.fovVelocity, -4);
    rig.fitSilhouetteLens(1 / 60);
    assert.ok(camera.position.distanceTo(before.eye) < 1e-9);
    assert.ok(camera.getWorldDirection(V()).distanceTo(before.axis) < 1e-6,
      'Fitting the final lens changed its centre ray');
    assert.ok(camera.fov >= fov && camera.fov <= 102);
    for (const x of [-.2, .2]) for (const z of [-.2, .2]) {
      const feet = target.clone().add(V(x, -.1, z)).project(camera);
      assert.ok(Math.abs(feet.x) < 1 && Math.abs(feet.y) < 1,
          JSON.stringify({ aspect, foot, feet: feet.toArray(), fov: camera.fov }));
      assert.ok(feet.toArray().every(Number.isFinite));
    }
    // A narrower aspect with the same landscape eye can demand more than
    // this finite lens for conservative empty body-envelope corners. This
    // stress case is not the aspect-aware ordinary portrait trajectory.
    for (const x of [-.65, .65]) for (const y of [-.2, 2.84]) for (const z of [-.65, .65]) {
      const corner = target.clone().add(V(x, y, z)).project(camera);
      if (Math.abs(corner.x) > 1 || Math.abs(corner.y) > 1) {
        assert.equal(camera.fov, 102); overBudget++;
      }
    }
    const fitted = { fov: camera.fov, velocity: rig.fovVelocity };
    rig.fitSilhouetteLens(0);
    assert.deepEqual({ fov: camera.fov, velocity: rig.fovVelocity }, fitted);
  }
  assert.ok(oldCrops >= 6, 'Replay must retain the old obstructed foot crop witness');
  assert.ok(overBudget > 0, 'Retain an explicit finite obstruction-budget limit');

  const wall = new THREE.Mesh(new THREE.BoxGeometry(20, 20, .2),
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  wall.position.set(0, 2, 3); wall.updateMatrixWorld(true);
  t.after(() => { wall.geometry.dispose(); wall.material.dispose(); });
  const { camera, rig } = fixture(3.2, { blockers: [wall] });
  camera.near = .2; camera.fov = 62; camera.position.set(0, 2, 2.5);
  rig.lookPoint.set(0, 4, -10); camera.up.set(0, 1, 0);
  camera.lookAt(rig.lookPoint); camera.updateMatrixWorld(true); camera.updateProjectionMatrix();
  rig.constrain(rig.playerPivot, camera.position);
  camera.lookAt(rig.lookPoint); camera.updateMatrixWorld(true);
  const oldEye = camera.position.clone();
  rig.fitSilhouetteLens(1 / 60);
  assert.ok(camera.fov > 70);
  assert.ok(oldEye.distanceTo(camera.position) > .05,
    'The larger near-plane radius was not checked after widening');
  const swept = camera.position.clone(); rig.constrain(rig.playerPivot, swept);
  assert.ok(swept.distanceTo(camera.position) < 1e-9);
  assert.equal(rig.distanceVelocity, 0);
  assert.ok(Math.abs(rig.distance - camera.position.distanceTo(rig.focus)) < 1e-9);
});
