import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LabGame } from '../src/game/LabGame.js';
import { LabPortals } from '../src/game/LabPortals.js';
import { LabPortalShots } from '../src/game/LabPortalShots.js';
import { applyVelocityFlightAssist, VELOCITY_ASSIST } from '../src/game/LabVelocityAssist.js';

const V = (...args) => new THREE.Vector3(...args);

function aimingFixture(epicMode = true) {
  const placements = [], targets = [];
  const game = {
    epicMode, scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(62, 1, .1, 500),
    state: 'playing', playerPosition: V(0, .6, 5), playerGrounded: false, facing: Math.PI,
    aimBlockers: [], colliders: [], portalPanels: [], isActiveBlocker: () => true,
    firstLevel: { getShotTargets: () => targets },
    placeOnPanel(slot, panel, point) { placements.push({ slot, panel, point }); return true; },
  };
  game.camera.position.set(0, 2, 5); game.camera.lookAt(V(0, 2, -20));
  const panel = (x, z, { portalable = true, width = 4, slot = 0 } = {}) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 6, .04), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    mesh.position.set(x, 2, z - .02);
    mesh.userData = { portalable, center: V(x, 2, z), normal: V(0, 0, 1) };
    game.scene.add(mesh); game.aimBlockers.push(mesh);
    if (portalable) { game.portalPanels.push(mesh); targets.push({ panel: mesh, slot }); }
    return mesh;
  };
  const shots = new LabPortalShots(game); game.portalShots = shots;
  return { game, panel, shots, targets, placements };
}

test('a modest reticle miss selects only the visible same-colour relay and still flies a real charge', () => {
  const f = aimingFixture(), panel = f.panel(6, -25);
  const assist = f.shots.getAssistTarget(0);
  assert.equal(assist.panel, panel); assert.ok(assist.angle > .15 && assist.angle < VELOCITY_ASSIST.aimAngle);
  assert.equal(f.shots.getAssistTarget(1), null);
  assert.equal(f.shots.request(0), true); assert.equal(f.placements.length, 0);
  for (let i = 0; i < 5; i++) f.shots.step(1 / 120);
  assert.equal(f.shots.active.length, 1); assert.equal(f.placements.length, 0);
  for (let i = 0; i < 25; i++) f.shots.step(1 / 120);
  assert.equal(f.placements.length, 1); assert.equal(f.placements[0].panel, panel);
});

test('assist never selects beyond its cone, behind the camera, through a wall, or off a portrait screen', () => {
  for (const position of [[12, -25], [0, 20], [0, -201]]) {
    const f = aimingFixture(); f.panel(...position); assert.equal(f.shots.getAssistTarget(0), null);
  }
  const hidden = aimingFixture(); hidden.panel(6, -25); hidden.panel(3, -10, { portalable: false, width: 7 });
  assert.equal(hidden.shots.getAssistTarget(0), null, 'the first blocker must be the exact target panel');
  const portrait = aimingFixture(); portrait.panel(6, -25);
  portrait.game.camera.aspect = .25; portrait.game.camera.updateProjectionMatrix();
  assert.equal(portrait.shots.getAssistTarget(0), null);
  const back = aimingFixture(), backPanel = back.panel(6, -25);
  backPanel.userData.normal.negate(); assert.equal(back.shots.getAssistTarget(0), null);
});

test('assist uses the closest visible expected relay, and campaign aiming stays exact', () => {
  const f = aimingFixture(); f.panel(7, -25); const closer = f.panel(-4, -25);
  assert.equal(f.shots.getAssistTarget(0).panel, closer);
  const legacy = aimingFixture(false); legacy.panel(6, -25);
  assert.equal(legacy.shots.getAssistTarget(0), null);
  assert.ok(Math.abs(legacy.shots.captureTarget(0).x) < 1e-8);
});

test('camera-visible assisted target remains blocked by the actual muzzle-side wall', () => {
  const f = aimingFixture(); f.panel(6, -25);
  // Third-person camera sees over this low wall; the actual muzzle cannot.
  const wall = new THREE.Mesh(new THREE.BoxGeometry(12, 1.5, .03), new THREE.MeshBasicMaterial());
  wall.position.set(0, .6, 2); wall.name = 'low muzzle blocker'; f.game.scene.add(wall); f.game.aimBlockers.push(wall);
  f.game.playerPosition.y = -.8;
  assert.ok(f.shots.getAssistTarget(0)); f.shots.request(0);
  for (let i = 0; i < 30; i++) f.shots.step(1 / 120);
  assert.equal(f.placements.length, 0); assert.equal(f.shots.lastImpact.surface, 'low muzzle blocker');
});

function flightFixture({ assist = true, x = 2.5 } = {}) {
  const game = new LabGame({ container: null, touch: false });
  Object.assign(game, {
    epicMode: true, scene: new THREE.Scene(), state: 'playing', playerGroup: new THREE.Group(), playerGrounded: false,
    cameraRig: { reset() {} }, audio: { jump() {}, land() {}, tone() {}, travel() {} },
    animator: { triggerJump() {}, triggerLanding() {} },
    input: { keys: new Set(), getMove: () => new THREE.Vector2(), consumeJump: () => false },
  });
  game.portals = new LabPortals({ scene: game.scene });
  const panel = new THREE.Mesh(new THREE.BoxGeometry(12, 12, .04), new THREE.MeshBasicMaterial());
  panel.position.set(0, 5, 0); game.scene.add(panel); panel.updateWorldMatrix(true, false);
  game.colliders.push({ mesh: panel, box: new THREE.Box3().setFromObject(panel), enabled: true });
  game.portals.place(0, V(0, 5, .04), V(0, 0, 1)); game.portals.place(1, V(20, 5, 0), V(1, 0, 0));
  game.portalSurfaceIds[0] = panel.uuid;
  game.firstLevel = { getFlightTarget: () => assist ? { panel, slot: 0 } : null };
  game.playerPosition.set(x, 5, 20); game.playerVelocity.set(0, 5, -40);
  game.respawn = () => { throw new Error('Unexpected respawn'); };
  return game;
}

test('bounded flight assistance catches a genuine 2.5 m miss through the production aperture at 30–240 Hz', () => {
  for (const hz of [30, 60, 120, 240]) {
    const game = flightFixture();
    for (let i = 0; i < hz * .6; i++) game.updatePlayer(1 / hz);
    assert.equal(game.teleportCount, 1, `missed assisted portal at ${hz} Hz`);
    assert.ok(game.playerVelocity.x > 39.99, 'normal approach momentum survives the real portal transform');
    game.portals.dispose();
  }
  const ordinary = flightFixture({ assist: false });
  for (let i = 0; i < 72; i++) ordinary.updatePlayer(1 / 120);
  assert.equal(ordinary.teleportCount, 0, 'this initial path really misses the original aperture'); ordinary.portals.dispose();
});

test('flight assist is a capped acceleration, never a position snap or a rear-facing rescue', () => {
  const game = flightFixture(), before = game.playerPosition.clone(), velocity = game.playerVelocity.clone();
  const acceleration = applyVelocityFlightAssist(game, 1 / 120);
  assert.ok(acceleration); assert.ok(acceleration.length() <= VELOCITY_ASSIST.acceleration + 1e-8);
  assert.deepEqual(game.playerPosition, before); assert.equal(game.playerVelocity.z, velocity.z);
  assert.ok(game.playerVelocity.distanceTo(velocity) <= VELOCITY_ASSIST.acceleration / 120 + 1e-8);
  for (const change of [
    () => { game.playerVelocity.z = 40; },
    () => { game.playerVelocity.z = -40; game.playerPosition.z = -2; },
    () => { game.playerPosition.z = 30; },
    () => { game.playerPosition.z = 20; game.playerPosition.x = 10; },
    () => { game.playerPosition.x = 2.5; game.portalSurfaceIds[0] = 'wrong panel'; },
    () => { game.epicMode = false; },
  ]) { change(); assert.equal(applyVelocityFlightAssist(game, 1 / 120), null); }
  game.portals.dispose();
});
