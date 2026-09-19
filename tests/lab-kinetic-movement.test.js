import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LabGame } from '../src/game/LabGame.js';
import { LabPortals } from '../src/game/LabPortals.js';
import { KINETIC_MOVEMENT, updateKineticVelocity } from '../src/game/LabKineticMovement.js';

function fixture({ ground = true, epic = true } = {}) {
  const game = new LabGame({ container: null, touch: false });
  const move = new THREE.Vector2();
  Object.assign(game, {
    epicMode: epic, scene: new THREE.Scene(), state: 'playing', move,
    playerGroup: new THREE.Group(), playerGrounded: ground,
    firstLevel: { momentum: false }, // Epic physics does not rely on legacy level flags.
    cameraRig: { reset() {} },
    audio: { jump() {}, land() {}, tone() {}, travel() {} },
    animator: { triggerJump() {}, triggerLanding() {} },
    input: { keys: new Set(), getMove: () => move,
      consumeJump: () => { const jump = game.jumpQueued; game.jumpQueued = false; return jump; } },
  });
  game.portals = new LabPortals({ scene: game.scene });
  if (ground) game.floors.push({ minX: -10000, maxX: 10000, minZ: -10000, maxZ: 10000, y: 0 });
  else game.playerPosition.y = 40;
  game.respawn = () => { throw new Error('Unexpected respawn'); };
  return game;
}
function wall(game, x, y, z, width, height, depth) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), new THREE.MeshBasicMaterial());
  mesh.position.set(x, y, z); game.scene.add(mesh); mesh.updateWorldMatrix(true, false);
  game.colliders.push({ mesh, box: new THREE.Box3().setFromObject(mesh), enabled: true });
  return mesh;
}
function pair(game) {
  const source = wall(game, 0, 5, 0, 10, 10, .04);
  game.portals.place(0, new THREE.Vector3(0, 5, .04), new THREE.Vector3(0, 0, 1));
  game.portals.place(1, new THREE.Vector3(20, 5, 0), new THREE.Vector3(1, 0, 0));
  game.portalSurfaceIds[0] = source.uuid;
}
function run(game, seconds, hz = 120) {
  for (let i = 0; i < seconds * hz - 1e-8; i++) game.updatePlayer(1 / hz);
}

test('epic cruise and sprint accelerate to 7.8 / 15 m/s; release and reverse input brake deliberately', () => {
  for (const sprint of [false, true]) {
    const game = fixture(); game.move.set(0, -1);
    if (sprint) game.input.keys.add('ShiftLeft');
    run(game, 1);
    assert.ok(Math.abs(-game.playerVelocity.z - (sprint ? 15 : 7.8)) < 1e-8);
    game.move.set(0, 0); run(game, .5);
    assert.ok(game.playerVelocity.length() < 1e-8);
    game.move.set(0, -1); run(game, 1);
    game.move.set(0, 1); run(game, 1);
    assert.ok(game.playerVelocity.z > 7.7, 'reverse must eventually run the other way');
    game.portals.dispose();
  }
});

test('airborne momentum remains exact with no input, while steering changes heading without collapsing speed', () => {
  const game = fixture({ ground: false }); game.playerVelocity.set(30, 0, -20);
  const before = game.playerVelocity.clone(); run(game, .5);
  assert.equal(game.playerVelocity.x, before.x);
  assert.equal(game.playerVelocity.z, before.z);
  const speed = Math.hypot(before.x, before.z);
  game.move.set(1, 0); run(game, .5);
  assert.ok(game.playerVelocity.x > before.x);
  assert.ok(Math.abs(Math.hypot(game.playerVelocity.x, game.playerVelocity.z) - speed) < 1e-8);
  game.portals.dispose();
});

test('ground slide retains over 96% momentum, has no free boost, and jump happens on the input tick', () => {
  const game = fixture(); game.playerVelocity.z = -30; game.input.keys.add('KeyC');
  run(game, 1);
  assert.equal(game.kinetic.sliding, true);
  assert.ok(-game.playerVelocity.z > 28.8 && -game.playerVelocity.z < 30);
  game.jumpQueued = true; game.updatePlayer(1 / 120);
  assert.equal(game.playerGrounded, false);
  assert.equal(game.kinetic.sliding, false);
  assert.equal(game.jumpWindup, 0);
  assert.ok(game.playerPosition.y > .07);
  assert.ok(game.playerVelocity.y > 9.4);
  assert.ok(-game.playerVelocity.z > 28.8, 'slide jump must keep horizontal momentum');
  game.portals.dispose();
});

test('movement speed and steering agree across 30, 60, 120 and 240 Hz', () => {
  const samples = [30, 60, 120, 240].map(hz => {
    const game = fixture(); game.move.set(0, -1);
    run(game, 2, hz);
    const groundDistance = -game.playerPosition.z;
    game.playerGrounded = false; game.playerVelocity.set(30, 0, -20); game.move.set(1, 0);
    for (let i = 0; i < hz; i++) updateKineticVelocity(game, 1 / hz, game.move);
    const velocity = game.playerVelocity.clone(); game.portals.dispose();
    return { groundDistance, velocity };
  });
  for (const sample of samples) {
    assert.ok(Math.abs(sample.groundDistance - samples[2].groundDistance) < .12);
    assert.ok(sample.velocity.distanceTo(samples[2].velocity) < 1e-8);
  }
});

test('swept full-body contacts stop 48 m/s at a thin wall and keep tangential momentum', () => {
  for (const hz of [30, 60, 120, 240]) {
    const game = fixture({ ground: false }); game.playerPosition.set(0, 2, 1);
    game.playerVelocity.set(9, 0, -48); wall(game, 0, 5, 0, 10, 10, .02);
    run(game, .2, hz);
    assert.ok(game.playerPosition.z >= .4399, `tunnelled at ${hz} Hz`);
    assert.equal(game.playerVelocity.z, 0);
    assert.equal(game.playerVelocity.x, 9);
    assert.ok(game.playerPosition.x > 1.7);
    game.portals.dispose();
  }
});

test('real high-speed portal transit rotates momentum and air release preserves the fling', () => {
  for (const hz of [30, 60, 120, 240]) {
    const game = fixture({ ground: false }); pair(game);
    game.playerPosition.set(0, 3.8, .6); game.playerVelocity.set(0, 0, -48);
    run(game, .1, hz);
    assert.equal(game.teleportCount, 1, `portal missed at ${hz} Hz`);
    assert.ok(game.playerVelocity.x > 47.999);
    assert.ok(Math.abs(game.playerVelocity.z) < 1e-8);
    assert.equal(game.playerGrounded, false);
    assert.ok(game.playerPosition.x > 23);
    game.portals.dispose();
  }
});

test('world contact before the source portal wins; thin destination obstacles receive the remaining sweep', () => {
  const blocked = fixture({ ground: false }); pair(blocked);
  wall(blocked, 0, 5, .85, 8, 10, .02);
  blocked.playerPosition.set(0, 3.8, 1.5); blocked.playerVelocity.set(0, 0, -48);
  blocked.updatePlayer(1 / 30);
  assert.equal(blocked.teleportCount, 0);
  assert.ok(blocked.playerPosition.z > 1.28);
  blocked.portals.dispose();

  const exit = fixture({ ground: false }); pair(exit);
  wall(exit, 21.15, 5, 0, .02, 10, 8);
  exit.playerPosition.set(0, 3.8, .6); exit.playerVelocity.set(0, 0, -48);
  exit.updatePlayer(1 / 30);
  assert.equal(exit.teleportCount, 1);
  assert.ok(exit.playerPosition.x < 20.711 && exit.playerPosition.x > 20.69);
  assert.equal(exit.playerVelocity.x, 0);
  exit.portals.dispose();
});

test('speed safety cap includes environmental impulses and legacy campaign movement keeps its exact baseline', () => {
  const epic = fixture({ ground: false }); epic.firstLevel.playerAcceleration = () => new THREE.Vector3(100000, 0, 0);
  epic.updatePlayer(1 / 120);
  assert.ok(Math.abs(epic.playerVelocity.length() - KINETIC_MOVEMENT.maximumSpeed) < 1e-8);
  epic.portals.dispose();
  for (const sprint of [false, true]) {
    const game = fixture({ epic: false }); game.move.set(0, -1);
    if (sprint) game.input.keys.add('ShiftLeft');
    run(game, 3);
    assert.ok(Math.abs(-game.playerVelocity.z - (sprint ? 5 : 3.3)) < 1e-8);
    assert.equal(game.kinetic, undefined);
    game.portals.dispose();
  }
});
