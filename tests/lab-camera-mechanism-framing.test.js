import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {LabCamera} from '../src/game/LabCamera.js';
import {MECHANISM_CAMERA_BUDGET, MECHANISM_CAMERA_FOV, MECHANISM_CAMERA_MAX_REAR, mechanismCameraArea} from '../src/game/LabMechanismCamera.js';
import {makePortalFrame, transformPortalPoint, portalRotation} from '../src/game/LabPortals.js';

const V = (...p) => new THREE.Vector3(...p);
function fixture({aspect = 16 / 9, blockers = [], currentBlocker, currentBlockersValid, fullBody = false} = {}) {
  const camera = new THREE.PerspectiveCamera(62, aspect, .1, 180);
  const rig = new LabCamera({camera, blockers});
  rig.configureSilhouette({enabled: fullBody, confined: fullBody});
  rig.configureMechanismFraming({enabled: true, currentBlocker, currentBlockersValid});
  const target = V();rig.reset(target, 0, -.2);
  const tick = (extra = {}) => rig.update({dt: 1 / 60, target, yaw: 0, pitch: -.2, mechanismFraming: true, ...extra});
  return {camera, rig, target, tick};
}
function box(size, position) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial({side: THREE.DoubleSide}));
  mesh.position.fromArray(position);mesh.updateMatrixWorld(true);return mesh;
}

test('vertical mechanism policy is limited to Room25 and the actual owned upper castle bay', () => {
  assert.equal(mechanismCameraArea({id: 'opposed-shadows', state: {optical: {machine: {}}}}, 24, V()), true);
  const room = {b: {x0: 10, x1: 30, z0: -20, z1: 0}, def: {at: [20, 18, -10], h: 22}};
  const castle = {singularity: true, rooms: new Map([['pendulum', room]]), machines: new Map([['pendulum', {state: {upperCell: {deckPart: {mesh: {position: V(27, 24, -10)}, half: V(6, .2, 2)}}}}]])};
  assert.equal(mechanismCameraArea(castle, 40, V(20, 18, -10)), true);
  for (const p of [V(9, 18, -10), V(20, 18, 1), V(20, 0, -10), V(20, 54, -10)]) assert.equal(mechanismCameraArea(castle, 40, p), false);
  assert.equal(mechanismCameraArea(castle, 39, V(20, 18, -10)), false);
  castle.machines.get('pendulum').state.upperCell = null;
  assert.equal(mechanismCameraArea(castle, 40, V(20, 18, -10)), false);
});

test('bounded full-body shoulder framing keeps the manual centre line on landscape and portrait screens', () => {
  for (const fullBody of [false, true]) for (const aspect of [16 / 9, .45, 3.2]) for (const pitch of [-1.56, -1.1, -.2, .4, .8, 1.15]) {
    const {camera, rig, tick} = fixture({aspect, fullBody});
    for (let n = 0; n < 240; n++) tick({pitch});
    const measured = rig.mechanismStats.final;
    assert.equal(measured.fits, true, `${fullBody}/${aspect}/${pitch}: ${JSON.stringify(measured)}`);
    assert.ok(camera.fov <= MECHANISM_CAMERA_FOV);
    assert.ok(camera.position.distanceTo(rig.focus) <= Math.hypot(MECHANISM_CAMERA_MAX_REAR, 3, 3.2) + 1e-8);
    assert.ok(rig.mechanismStats.candidates <= MECHANISM_CAMERA_BUDGET);
    assert.equal(rig.mechanismStats.cacheHit, true);
    assert.equal(rig.mechanismStats.candidates, 1);
    assert.ok(rig.lookPoint.distanceTo(rig.focus.clone().addScaledVector(rig.forward, 16)) < 1e-10);
    const centre = rig.lookPoint.clone().project(camera);
    assert.ok(Math.hypot(centre.x, centre.y) < 1e-12);
    const before = {eye: camera.position.clone(), rotation: camera.quaternion.clone(), fov: camera.fov};
    tick({pitch, dt: 0, aiming: true});
    assert.ok(before.eye.distanceTo(camera.position) < 1e-8);
    assert.ok(before.rotation.angleTo(camera.quaternion) < 1e-7);
    assert.equal(camera.fov, before.fov);
    assert.equal(rig.mechanismStats.candidates, 0);
    assert.ok(rig.queryStats.rays <= 45, 'zero-dt entered the legacy candidate search');
  }
});

test('every intermediate wall approach and release rechecks the near-plane volume within the fixed ray budget', () => {
  for (const aspect of [16 / 9, .45, 3.2]) {
    const wall = box([30, 12, .4], [0, 4, 10]);
    const {camera, rig, target, tick} = fixture({aspect, blockers: [wall]});
    for (let n = 0; n < 180; n++) tick();
    let previous = camera.position.clone(), maxDelta = 0;
    for (let n = 0; n < 360; n++) {
      target.z = n < 180 ? n / 180 * 5 : (360 - n) / 180 * 5;
      tick();
      assert.ok(camera.position.z < 9.55, 'lens crossed the blocking wall');
      const swept = camera.position.clone();rig.constrain(rig.playerPivot, swept, MECHANISM_CAMERA_FOV);
      assert.ok(swept.distanceTo(camera.position) < 1e-8, 'final near plane was not swept');
      assert.ok(rig.mechanismStats.candidates <= 12);
      assert.ok(rig.queryStats.rays <= 153, `unbounded camera rays: ${rig.queryStats.rays}`);
      maxDelta = Math.max(maxDelta, previous.distanceTo(camera.position));previous.copy(camera.position);
    }
    assert.ok(maxDelta < .3, `wall approach/release popped ${maxDelta} metres`);
    wall.geometry.dispose();wall.material.dispose();
  }
});

test('current-body query proxies and cache invalidation retain original blocker ownership and source poses', () => {
  const source = box([6, 5, .4], [0, 2, 3]);source.visible = false;
  const descriptor = {half: V(3, 2.5, .2), current: {center: V(20, 2, 3), quaternion: new THREE.Quaternion()}};
  let valid = true, hits = 0;
  const {camera, rig, tick} = fixture({blockers: [source], currentBlocker: o => o === source ? descriptor : null, currentBlockersValid: () => valid});
  rig.isBlocker = object => {assert.equal(object, source);hits++;return true;};
  const sourcePose = source.matrixWorld.toArray();
  for (let n = 0; n < 240; n++) tick();
  assert.equal(rig.mechanismStats.cacheHit, true);
  assert.equal(rig.currentBlocker, null);assert.equal(rig.currentBlockersValid, null);
  assert.notEqual(rig.queryBlockers[0], source);
  descriptor.current.center.set(0, 2, 3);valid = false;
  tick();
  assert.equal(rig.mechanismStats.currentBodiesValid, false);
  assert.equal(rig.mechanismStats.cacheHit, false);
  assert.ok(hits > 0);assert.ok(camera.position.z < 2.5);
  assert.deepEqual(source.matrixWorld.toArray(), sourcePose);
  source.geometry.dispose();source.material.dispose();rig.queryBlockers[0].geometry.dispose();
});

test('entering from a wider castle lens sweeps the actual near plane during the smooth FOV transition', () => {
  const wall = box([30, 12, .4], [0, 4, 3]);
  const {camera, rig, tick} = fixture({aspect: 3.2, blockers: [wall], fullBody: true});
  // Optical state fixture for the existing confined camera's120-degree cap.
  // This is not an actor route or a claim that this pose is gameplay-reachable.
  camera.fov = 120;camera.updateProjectionMatrix();
  tick();
  assert.ok(camera.fov > MECHANISM_CAMERA_FOV && camera.fov < 120, 'entry must preserve the continuous lens blend');
  const actual = camera.position.clone();rig.constrain(rig.playerPivot, actual, camera.fov);
  assert.ok(actual.distanceTo(camera.position) < 1e-8, 'actual wider near plane peers through the wall');
  assert.ok(rig.mechanismStats.candidates <= 12);assert.ok(rig.queryStats.rays <= 153);
  wall.geometry.dispose();wall.material.dispose();
});

test('a portal rigidly transports the active lens and centre shot before ordinary framing resumes', () => {
  const {camera, rig, target, tick} = fixture();
  for (let n = 0; n < 180; n++) tick({yaw: .25, pitch: .35});
  const entry = makePortalFrame(V(0, 1.32, 0), V(0, 0, 1));
  const exit = makePortalFrame(V(12, 2, -20), V(0, 1, 0), V(0, 0, 1));
  const eye = transformPortalPoint(camera.position, entry, exit);
  const rotation = portalRotation(entry, exit).multiply(camera.quaternion.clone());
  const destination = transformPortalPoint(target, entry, exit).addScaledVector(exit.normal, .48);
  const fov = camera.fov;
  const controls = rig.applyPortalTransform(entry, exit, {target: destination, yaw: .25, pitch: .35});
  assert.equal(rig.mechanismEscape, null);
  tick({dt: 0, target: destination, ...controls});
  assert.ok(camera.position.distanceTo(eye) < 1e-8);
  assert.ok(camera.quaternion.angleTo(rotation) < 1e-7);assert.equal(camera.fov, fov);
  for (let n = 0; n < 120; n++) {
    tick({target: destination, ...controls});
    assert.ok(rig.lookPoint.distanceTo(rig.focus.clone().addScaledVector(rig.forward, 16)) < 1e-9);
  }
});
