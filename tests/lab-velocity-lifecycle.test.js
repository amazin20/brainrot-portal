import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LabGame } from '../src/game/LabGame.js';
import { LabPhysics } from '../src/game/LabPhysics.js';
import { LabPortals } from '../src/game/LabPortals.js';
import { LabPortalShots } from '../src/game/LabPortalShots.js';
import { LabVelocityCompanion } from '../src/game/LabVelocityCompanion.js';
import { disposeLabLevel } from '../src/game/LabLevelLifecycle.js';

const V = (...args) => new THREE.Vector3(...args);
function fixture(t, epicMode = true) {
  const game = new LabGame({ container: null, touch: false }), cameraDeltas = [];
  Object.assign(game, {
    epicMode, scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(62, 1, .1, 200),
    state: 'playing', playerGroup: new THREE.Group(), prompt: { textContent: '' }, materials: {},
    audio: { jump() {}, land() {}, pickup() {}, tone() {}, travel() {}, flight() {} },
    animator: { reset() {}, update() {}, trigger() {}, triggerLanding() {}, triggerJump() {} },
    heldDevice: { reset() {}, update() {} }, companionAnimator: { reset() {}, update() {}, trigger() {} },
    cameraRig: { reset() {}, update({ dt }) { cameraDeltas.push(dt); } },
    input: { keys: new Set(), getMove: () => new THREE.Vector2(), consumeJump: () => false,
      consumePause: () => false, consumeRestart: () => false },
  });
  game.playerPosition.set(0, 10, 0); game.previousPlayerPosition.copy(game.playerPosition);
  game.firstLevel = { spawn: [0, 10, 0], cargoSpawn: [-.86, 11.18, .32], reset() {}, getObjective: () => '',
    cargoOnAnyPad: () => false, getLaunch: () => null, update() {}, isWon: () => false };
  const cargoGroup = new THREE.Group(); game.scene.add(cargoGroup);
  game.cargo = { group: cargoGroup, position: V(-.86, 11.18, .32), velocity: V(), quaternion: new THREE.Quaternion() };
  game.cubes = [game.cargo]; game.cargo.group.position.copy(game.cargo.position);
  game.physics = new LabPhysics(); game.physics.createCargo({ position: game.cargo.position, size: .78 });
  game.portals = new LabPortals({ scene: game.scene });
  game.portalShots = new LabPortalShots(game);
  if (epicMode) game.velocityCompanion = new LabVelocityCompanion(game);
  game.render = () => {};
  t.after(() => { game.velocityCompanion?.dispose(); game.physics?.dispose(); game.portals?.dispose(); });
  return { game, cameraDeltas };
}

test('Q slows only airborne velocity simulation while camera input uses real frame time', t => {
  const { game, cameraDeltas } = fixture(t);
  let simulated = 0;
  game.updatePlaying = dt => { simulated += dt; };
  game.playerGrounded = false; game.input.keys.add('KeyQ');
  for (let i = 1; i <= 60; i++) game.animate(i * 1000 / 60);
  assert.ok(Math.abs(simulated - .28) <= 1 / 120);
  assert.equal(game.velocityFocus, true);
  assert.ok(cameraDeltas.every(dt => Math.abs(dt - 1 / 60) < 1e-8));
  for (const change of [
    () => { game.playerGrounded = true; },
    () => { game.playerGrounded = false; game.externalBlocked = true; },
    () => { game.externalBlocked = false; game.state = 'paused'; },
    () => { game.state = 'playing'; game.epicMode = false; },
  ]) { change(); assert.equal(game.getVelocityTimeScale(), 1); }
});

test('zero-time visual refresh after animation cannot reuse a stale camera delta', t => {
  const { game, cameraDeltas } = fixture(t);
  game.updatePlaying = () => {}; game.animate(1000 / 60);
  game.updateVisuals(0, 1);
  assert.equal(cameraDeltas.at(-1), 0);
  game.state = 'paused'; game.updateVisuals(1 / 60, 1);
  assert.equal(cameraDeltas.at(-1), 0, 'a paused direct render freezes the camera too');
});

test('checkpoint recovery clears queued actions, momentum and focus while restoring the same friend body', t => {
  const { game } = fixture(t), body = game.physics.cargoBody, model = game.cargo.group;
  assert.equal(game.velocityCompanion.connect(), true);
  game.firstLevel.restoreCheckpoint = () => ({ position: V(25, 35, -10), yaw: Math.PI / 2, pitch: -.2, connected: true });
  game.portalShots.request(1); game.playerVelocity.set(20, -35, 8); game.playerGrounded = false;
  game.input.keys.add('KeyQ'); game.velocityFocus = true; game.interactQueued = true;
  game.jumpBuffer = .1; game.jumpWindup = .04; game.accumulator = .007; game.launchTime = 1;
  game.shotPoseTime = .1; game.aimHeld = true; game.aimingTime = .1;
  game.windStrength = 1; game.lastLanding = 1; game.lastCompanionState = 'getting_up';
  assert.equal(game.restartCheckpoint(), true);
  assert.equal(game.physics.cargoBody, body); assert.equal(game.cargo.group, model);
  assert.equal(game.velocityCompanion.connected, true); assert.equal(game.velocityCompanion.isNear(), true);
  assert.deepEqual(game.playerPosition.toArray(), [25, 35, -10]); assert.equal(game.playerVelocity.length(), 0);
  assert.equal(game.portalShots.queue.length, 0); assert.equal(game.portalShots.active.length, 0);
  assert.equal(game.input.keys.size, 0); assert.equal(game.velocityFocus, false); assert.equal(game.getVelocityTimeScale(), 1);
  assert.equal(game.accumulator, 0); assert.equal(game.jumpWindup, 0); assert.equal(game.interactQueued, false);
  assert.equal(game.aimHeld, false); assert.equal(game.aimingTime, 0);
  assert.equal(game.windStrength, 0); assert.equal(game.lastLanding, 0); assert.equal(game.lastCompanionState, null);
});

test('production player portal crossing transports a connected friend exactly once without occupying hands', t => {
  const { game } = fixture(t), body = game.physics.cargoBody;
  game.playerPosition.set(0, 3.8, .4); game.previousPlayerPosition.copy(game.playerPosition);
  game.playerVelocity.set(0, 0, -40); game.playerGrounded = false;
  game.velocityCompanion.recover(); body.velocity.set(0, 0, -40);
  const size = { width: 2.2, height: 2.8 };
  game.portals.place(0, V(0, 5, .04), V(0, 0, 1), undefined, size);
  game.portals.place(1, V(20, 10, 0), V(1, 0, 0), undefined, size);
  game.updatePlayer(1 / 120); game.updatePlayer(1 / 120);
  assert.equal(game.teleportCount, 1); assert.equal(game.physics.portalTransports, 1);
  assert.equal(game.physics.cargoBody, body); assert.equal(game.heldCube, null);
  assert.ok(body.velocity.x > 39.99); assert.ok(Math.abs(body.velocity.z) < 1e-8);
  assert.ok(game.velocityCompanion.forward.x > .99);
  game.updateCubes(1 / 120);
  assert.equal(game.physics.portalTransports, 1, 'cargo update cannot apply a second portal transform');
  assert.equal(game.velocityCompanion.isNear(), true);
});

test('leaving a velocity level disconnects and disposes its helper before the old physics world', t => {
  const { game } = fixture(t), helper = game.velocityCompanion, physics = game.physics;
  const ordinaryCap = physics.maxLinearSpeed;
  assert.equal(helper.connect(), true); assert.ok(physics.maxLinearSpeed > ordinaryCap);
  let observed = null;
  game.firstLevel.dispose = () => { observed = { connected: helper.connected, cap: physics.maxLinearSpeed, worldAlive: game.physics === physics }; };
  game.levelRoots = [game.cargo.group, game.portalShots.root, helper.visual];
  disposeLabLevel(game);
  assert.deepEqual(observed, { connected: false, cap: ordinaryCap, worldAlive: true });
  assert.equal(helper.disposed, true); assert.equal(helper.visual.parent, null);
  assert.equal(game.velocityCompanion, null); assert.equal(game.physics, null); assert.equal(game.portals, null);
  assert.equal(game.cubes.length, 0);
});

test('ordinary campaign respawn and reset keep full-room semantics and original cargo speed', t => {
  const { game } = fixture(t, false), body = game.physics.cargoBody, speed = game.physics.maxLinearSpeed;
  let resets = 0, checkpoints = 0;
  game.firstLevel.reset = () => { resets++; };
  game.firstLevel.restoreCheckpoint = () => { checkpoints++; return { position: V(90, 90, 90) }; };
  game.input.keys.add('KeyQ'); game.playerGrounded = false; game.respawn();
  assert.equal(resets, 1); assert.equal(checkpoints, 0);
  assert.deepEqual(game.playerPosition.toArray(), [0, 10, 0]);
  assert.equal(game.physics.cargoBody, body); assert.equal(game.physics.maxLinearSpeed, speed);
  assert.equal(game.velocityCompanion, undefined); assert.equal(game.getVelocityTimeScale(), 1);
});
