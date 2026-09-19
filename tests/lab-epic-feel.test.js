import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LabCamera } from '../src/game/LabCamera.js';
import { LabEpicDirector, epicSpeedIntensity, sampleEpicStreak, sampleEpicImpact } from '../src/game/LabEpicDirector.js';
import { makePortalFrame, portalRotation, transformPortalPoint } from '../src/game/LabPortals.js';
import { createHeadlessGame } from '../scripts/lab-headless.mjs';

function cameraFixture(epic = false) {
  const camera = new THREE.PerspectiveCamera(62, 16 / 9, .06, 200);
  const rig = new LabCamera({ camera, epic });
  const target = new THREE.Vector3();
  rig.reset(target, 0, -.2);
  const tick = (options = {}) => rig.update({ dt: 1 / 60, target, yaw: 0, pitch: -.2, ...options });
  return { camera, rig, tick, target };
}

test('epic lens responds to vertical launch speed, stays bounded and never adds shot recoil', () => {
  const ordinary = cameraFixture(), epic = cameraFixture(true), control = cameraFixture(true);
  assert.equal(epic.camera.fov, 68);
  for (let i = 0; i < 240; i++) {
    const velocity = new THREE.Vector3(0, 40, 0);
    ordinary.tick({ velocity }); epic.tick({ velocity, shooting: i % 5 === 0 }); control.tick({ velocity });
    assert.ok(epic.camera.fov >= 68 && epic.camera.fov <= 82);
    assert.equal(epic.camera.fov, control.camera.fov);
    assert.deepEqual(epic.camera.position.toArray(), control.camera.position.toArray());
    assert.ok(epic.camera.quaternion.angleTo(control.camera.quaternion) < 1e-7);
    assert.deepEqual(epic.camera.up.toArray(), [0, 1, 0]);
  }
  assert.equal(ordinary.camera.fov, 62);
  assert.ok(epic.camera.fov > 81.99);
  assert.ok(epic.camera.position.distanceTo(epic.rig.focus) > ordinary.camera.position.distanceTo(ordinary.rig.focus) + 1);
  for (let i = 0; i < 240; i++) epic.tick({ velocity: new THREE.Vector3(0, 80, 0), dynamicFov: false });
  assert.ok(Math.abs(epic.camera.fov - 68) < .0001, 'reduced lens motion must ignore velocity');
  assert.ok(Math.abs(epic.rig.epicFraming - .35) < .0001);
  epic.rig.configureEpic({ enabled: false }).reset(epic.target);
  assert.equal(epic.camera.fov, 62);
});

test('epic portal crossing preserves the exact transported lens and speed framing', () => {
  const { camera, rig, tick, target } = cameraFixture(true);
  for (let i = 0; i < 180; i++) tick({ velocity: new THREE.Vector3(0, 20, -25) });
  const entry = makePortalFrame(new THREE.Vector3(0, 1.2, 0), new THREE.Vector3(0, 0, 1));
  const exit = makePortalFrame(new THREE.Vector3(0, 0, -50), new THREE.Vector3(0, 1, 0));
  const expectedPosition = transformPortalPoint(camera.position, entry, exit);
  const expectedRotation = portalRotation(entry, exit).multiply(camera.quaternion.clone());
  const fov = camera.fov, framing = rig.epicFraming;
  const destination = transformPortalPoint(target, entry, exit).addScaledVector(exit.normal, .5);
  const controls = rig.applyPortalTransform(entry, exit, { target: destination });
  rig.update({ dt: 0, target: destination, ...controls });
  assert.ok(camera.position.distanceTo(expectedPosition) < 1e-8);
  assert.ok(camera.quaternion.angleTo(expectedRotation) < 1e-7);
  assert.equal(camera.fov, fov); assert.equal(rig.epicFraming, framing);
});

test('edge streaks never touch the central aiming area and invalid speeds produce no intensity', () => {
  for (const speed of [undefined, NaN, Infinity, -20, 0, 8]) assert.equal(epicSpeedIntensity(speed), 0);
  assert.equal(epicSpeedIntensity(36), 1); assert.equal(epicSpeedIntensity(1000), 1);
  for (let frame = 0; frame < 100; frame++) for (let i = 0; i < 28; i++) {
    const line = sampleEpicStreak(i, frame / 60, 1);
    assert.ok(Math.hypot(line.x0, line.y0) >= .679999999);
    assert.ok(Math.hypot(line.x1, line.y1) > Math.hypot(line.x0, line.y0));
    assert.ok(line.alpha >= 0 && line.alpha <= .36);
  }
});

test('director is headless safe, respects pause and reduced motion, and clears all event state', () => {
  const events = [];
  const audio = { epicMotion: (...args) => events.push(['motion', ...args]), resetEpicMotion: () => events.push(['reset']), epicPassage: () => events.push(['portal']) };
  const director = new LabEpicDirector({ audio });
  const motion = { dt: 1 / 60, velocity: { x: 0, y: 30, z: 20 }, enabled: true, active: true, grounded: false };
  director.update(motion); director.portal(36); director.land(25);
  assert.ok(director.amount > 0 && director.portalPulse > 0 && director.landingPulse > 0);
  director.update({ ...motion, active: false });
  assert.equal(director.amount, 0); assert.equal(director.portalPulse, 0); assert.equal(director.landingPulse, 0);
  assert.equal(director.impactStrength, 0); assert.ok(director.impactAge > .48);
  const before = events.length; director.portal(30); assert.equal(events.length, before);
  director.configure({ reducedMotion: true }); director.update(motion);
  assert.equal(director.context, null);
  director.reset(); assert.equal(director.amount, 0);
  director.dispose(); director.dispose();
  const count = events.length; director.update(motion); assert.equal(events.length, count);
});

test('graphic portal impacts protect aiming, end promptly and stay off during pause or reduced motion', () => {
  for (let i = 0; i < 24; i++) for (const age of [0, .025, .15, .3, .48, 1]) {
    const line = sampleEpicImpact(i, age);
    assert.ok(Math.hypot(line.x0, line.y0) >= .719999, 'impact must leave the targeting area empty');
    assert.ok(Math.hypot(line.x1, line.y1) >= Math.hypot(line.x0, line.y0) - 1e-10);
    assert.ok(line.alpha >= 0 && line.alpha <= .72);
    if (age >= .48) assert.equal(line.alpha, 0);
  }
  const director = new LabEpicDirector();
  let draws = 0; director.draw = () => draws++;
  const frame = { dt: 1/60, enabled: true, active: true, velocity: { x: 40 } };
  director.update(frame); director.portal(40, 3);
  assert.equal(director.crossings, 3);
  for (let i = 0; i < 30; i++) director.update(frame);
  assert.ok(director.impactAge > .48);
  director.configure({ reducedMotion: true });
  const before = draws; director.portal(40); director.update(frame); assert.equal(draws, before);
  director.configure({ reducedMotion: false, speedLines: false });
  director.update(frame); assert.equal(draws, before);
  director.update({ ...frame, active: false });
  director.portal(40); assert.equal(director.impactStrength, 0);
  director.dispose();
});

test('epic sprint leans forward and slide lowers into a stable crouch without moving the capsule', async () => {
  const game = await createHeadlessGame(), animator = game.animator;
  const position = game.playerPosition.clone(), velocity = game.playerVelocity.clone();
  try {
    const motion = { dt: 1 / 60, speed: 15, velocity: { x: 0, y: 0, z: -15 }, grounded: true, weapon: true };
    for (let i = 0; i < 90; i++) animator.update(motion);
    const normal = animator.bones.Body.rotation.x;
    animator.reset();
    for (let i = 0; i < 90; i++) animator.update({ ...motion, epic: true });
    assert.ok(animator.bones.Body.rotation.x > normal + .08, 'sprinting must visibly lean into travel');
    const sprintHeight = animator.bones.Body.position.z;
    for (let i = 0; i < 120; i++) animator.update({ ...motion, epic: true, sliding: true });
    assert.ok(animator.epicSlide > .999);
    assert.ok(animator.bones.Body.position.z > sprintHeight + .035, 'source +Z lowers the pelvis');
    assert.ok(animator.footContact.L < .001 && animator.footContact.R < .001, 'sliding boots must release world locks');
    assert.ok(animator.bones.ThighL.quaternion.angleTo(animator.bones.ThighR.quaternion) > .25, 'slide needs a clear leading leg');
    const before = animator.bones.Body.quaternion.clone();
    animator.update({ ...motion, epic: true, sliding: false });
    assert.ok(animator.bones.Body.quaternion.angleTo(before) < .07, 'slide release must not snap');
    for (let i = 0; i < 120; i++) animator.update({ ...motion, epic: false, speed: 0 });
    assert.ok(animator.epicSlide < .001 && animator.epicSprint < .001);
    for (const bone of Object.values(animator.bones)) {
      assert.ok(bone.quaternion.toArray().every(Number.isFinite));
      assert.deepEqual(bone.scale.toArray(), [1, 1, 1]);
    }
    assert.ok(game.playerPosition.equals(position)); assert.ok(game.playerVelocity.equals(velocity));
  } finally { game.physics.dispose(); game.portals.dispose(); }
});
