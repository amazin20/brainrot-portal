import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LabPhysics } from '../src/game/LabPhysics.js';
import { LabVelocityCompanion } from '../src/game/LabVelocityCompanion.js';
import { LabPortals, transformPortalPoint } from '../src/game/LabPortals.js';

function fixture() {
  const physics = new LabPhysics();
  physics.createCargo({ position: [-.86, 10.6, .32], size: .78 });
  const group = new THREE.Group();
  const game = { physics, epicMode: true, state: 'playing', facing: Math.PI,
    playerPosition: new THREE.Vector3(0, 10, 0), playerVelocity: new THREE.Vector3(),
    playerGroup: new THREE.Group(), scene: new THREE.Scene(), heldCube: null,
    cargo: { group, position: new THREE.Vector3().copy(physics.cargoBody.position),
      quaternion: new THREE.Quaternion(), velocity: new THREE.Vector3() },
    callbacks: { onToast(text) { game.message = text; } },
  };
  game.playerGroup.position.copy(game.playerPosition);
  game.cargo.group.position.copy(game.cargo.position);
  const helper = new LabVelocityCompanion(game);
  return { game, physics, helper, dispose() { helper.dispose(); physics.dispose(); } };
}

function tick(f, dt = 1 / 120) {
  f.game.playerPosition.addScaledVector(f.game.playerVelocity, dt);
  f.helper.update(dt); f.physics.step(dt);
  const state = f.physics.sample(1);
  f.game.cargo.position.copy(state.position); f.game.cargo.velocity.copy(state.velocity);
  f.game.cargo.quaternion.copy(state.quaternion);
}

test('stabilizer only connects a nearby unobstructed real companion and leaves hands free', () => {
  const f = fixture();
  f.game.epicMode = false;
  assert.equal(f.helper.interact(), false);
  f.game.epicMode = true;
  f.game.playerPosition.x = 8;
  assert.equal(f.helper.interact(), false);
  f.game.playerPosition.x = 0;
  const wall = new THREE.Mesh(new THREE.BoxGeometry(.15, 4, 4), new THREE.MeshBasicMaterial());
  wall.position.set(-.4, 11, 0); f.game.scene.add(wall); f.game.cameraBlockers = [wall];
  assert.equal(f.helper.interact(), false, 'connection must not cross a wall');
  f.game.cameraBlockers = [];
  const identity = f.physics.cargoBody;
  assert.equal(f.helper.interact(), true);
  assert.equal(f.game.heldCube, null, 'existing shooting gate must stay open');
  assert.equal(f.physics.cargoBody, identity);
  assert.ok(f.physics.carryTarget);
  assert.match(f.game.message, /Руки свободны/);
  assert.equal(f.helper.interact(), true, 'E during flight must not silently drop the friend');
  assert.equal(f.helper.connected, true);
  wall.geometry.dispose(); wall.material.dispose(); f.dispose();
});

test('same dynamic body accompanies 52 m/s flight and turning without a trailing speed cap', () => {
  const f = fixture(), identity = f.physics.cargoBody;
  const initialType = identity.type;
  assert.equal(f.helper.connect(), true);
  for (let i = 0; i < 60; i++) tick(f);
  let maximumGap = 0;
  for (let i = 0; i < 360; i++) {
    const angle = Math.min(Math.PI / 2, i / 360 * Math.PI / 2);
    f.game.playerVelocity.set(52 * Math.sin(angle), 0, -52 * Math.cos(angle));
    tick(f);
    maximumGap = Math.max(maximumGap, f.game.cargo.position.distanceTo(f.game.playerPosition));
  }
  assert.equal(f.physics.cargoBody, identity);
  assert.equal(identity.type, initialType, 'body must remain dynamic');
  assert.ok(f.game.playerPosition.distanceTo(new THREE.Vector3(0, 10, 0)) > 130);
  assert.ok(maximumGap < 2, `friend drifted ${maximumGap} m`);
  assert.equal(f.helper.isNear(), true);
  assert.equal(f.physics.portalTransports, 0, 'following is physical, never repeated teleports');
  f.dispose();
});

test('higher tether speed retains swept solid contacts and finish checks actual body position', () => {
  const f = fixture();
  f.physics.addStaticBox('thin-wall', new THREE.Box3(new THREE.Vector3(-5, 0, -5.02), new THREE.Vector3(5, 20, -5)));
  f.helper.connect();
  for (let i = 0; i < 60; i++) tick(f);
  f.game.playerVelocity.z = -52;
  for (let i = 0; i < 60; i++) tick(f);
  assert.ok(f.physics.cargoBody.position.z > -4.66, 'friend tunneled through a closed wall');
  assert.equal(f.helper.isNear(), false, 'flag alone must not count as bringing the friend');
  assert.equal(f.physics.portalTransports, 0);
  f.dispose();
});

test('real portal transform rotates body, momentum and tether frame once before following continues', () => {
  const f = fixture(), identity = f.physics.cargoBody;
  const portals = new LabPortals({ scene: f.game.scene });
  portals.place(0, new THREE.Vector3(0, 11.2, -1), new THREE.Vector3(0, 0, 1));
  portals.place(1, new THREE.Vector3(80, 16.2, -20), new THREE.Vector3(1, 0, 0));
  f.helper.connect();
  for (let i = 0; i < 60; i++) tick(f);
  f.game.playerVelocity.set(0, 0, -52);
  tick(f);
  const current = new THREE.Vector3(0, 11.2, -1.2), previous = new THREE.Vector3(0, 11.2, -.8);
  const travel = portals.tryTeleport(current, previous, f.game.playerVelocity, .43);
  assert.ok(travel);
  const [entry, exit] = portals.portals;
  const destination = transformPortalPoint(f.game.cargo.position, entry, exit);
  const before = new THREE.Vector3().copy(identity.velocity);
  f.physics.teleportCargo({ position: destination, rotation: travel.rotation });
  f.game.playerPosition.copy(travel.position).add(new THREE.Vector3(0, -1.2, 0));
  f.game.playerVelocity.copy(travel.velocity);
  f.helper.onPortalTransport(travel.rotation);
  assert.ok(new THREE.Vector3().copy(identity.velocity).distanceTo(before.applyQuaternion(travel.rotation)) < 1e-8);
  assert.ok(f.helper.forward.x > .999);
  assert.equal(f.physics.portalTransports, 1);
  for (let i = 0; i < 120; i++) tick(f);
  assert.equal(f.physics.cargoBody, identity);
  assert.equal(f.helper.isNear(), true);
  assert.equal(f.physics.portalTransports, 1);
  portals.dispose(); f.dispose();
});

test('checkpoint and full restart preserve companion identity and restore campaign physics settings', () => {
  const f = fixture(), identity = f.physics.cargoBody, baseSpeed = f.physics.maxLinearSpeed;
  f.helper.connect();
  f.game.playerPosition.set(110, 32, -85); f.game.facing = Math.PI / 2;
  assert.equal(f.helper.recover(), true);
  assert.equal(f.physics.cargoBody, identity);
  assert.equal(f.helper.connected, true);
  assert.equal(f.helper.isNear(), true);
  assert.equal(f.physics.portalTransports, 0);
  f.helper.renderUpdate(2);
  assert.equal(f.helper.visual.visible, true);
  assert.equal(f.helper.line.visible, true);
  f.helper.reset();
  assert.equal(f.helper.connected, false);
  assert.equal(f.physics.carryTarget, null);
  assert.equal(f.physics.maxLinearSpeed, baseSpeed);
  assert.equal(f.helper.isNear(), false);
  assert.equal(f.physics.cargoBody, identity);
  f.helper.dispose();
  assert.equal(f.helper.visual.parent, null);
  assert.equal(f.helper.connect(), false);
  f.dispose();
});
