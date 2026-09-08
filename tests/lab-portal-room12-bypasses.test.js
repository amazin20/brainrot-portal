import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {resolvePortalPlacement} from '../src/game/LabPortals.js';
import {runV8Journey} from '../src/game/LabV8Journey.js';

const game = await createHeadlessGame();
const V = (...p) => new THREE.Vector3(...p);
after(() => { game.physics.dispose(); game.portals.dispose(); });

function acceptedRay(origin, target, panel) {
  game.portalShots.ray.set(origin, target.clone().sub(origin).normalize());
  game.portalShots.ray.far = Infinity;
  const hit = game.portalShots.firstHit();
  if (hit?.object !== panel.mesh) return false;
  return resolvePortalPlacement(panel.mesh, hit.point, {blockers: game.colliders}).ok;
}

test('room 12 hides every sampled final-panel edge from reachable stationary and jumping viewpoints', async () => {
  await game.selectLevel(11, false);
  game.scene.updateMatrixWorld(true);
  const panel = game.firstLevel.panels['far-exit'];
  const centre = panel.getFrame().center;
  const bounds = panel.mesh.userData.portalBounds;
  // Explicit adversarial muzzle fixtures, not a positive walkthrough. They
  // include the original ground-corner, balcony, apron and diagonal-seam
  // counterexamples. A generous 3.3m muzzle covers an ordinary ground jump.
  const feet = [
    [-29, 0, 36], [-26.5, 0, 36], [-23.5, 0, 33], [-20.5, 0, 27],
    [-2.5, 0, 33], [-2.5, 0, 36], [.5, 0, 36], [9.5, 0, 24], [9.5, 0, 36],
    [-12, 0, 15], [4, 0, 4], [4, 0, 30], [24, 0, -30], [26, 0, -10], [30, 0, 20],
    [-28, 8, 9], [-18, 8, 18.5], [-16.6, 8, 8.55], [-28, 8, 19],
    [-15.5, 6, 18.5], [-13.5, 6, 20.5], [-13.5, 6, 22.5], [-8.5, 6, 22.5],
    [-27, 8.5, 7], [-27, 15, -9], [-27, 21.5, -25],
    [-28, 22, -31], [-12.6, 22, -26.5], [-16, 22, -29],
    [21.5, 12, 7.5], [24, 12, 10], [26.5, 12, 12],
    // Probe the exact upper-deck/stair corners as well as the original
    // broader fixtures after widening the aerial sight windows.
    [-28.8, 22, -31.8], [-12.1, 22, -31.8], [-12.1, 22, -26.1], [-28.8, 22, -26.1],
    [-25.1, 21, -24], [-28.9, 18, -18],
    [-16.1, 8, 8.1], [-16.1, 8, 19.9], [-28.9, 8, 19.9],
  ];
  const targets = [];
  // Test visible pixels up to the outer ceramic edges, not just legal portal
  // centres: placement can move an edge hit inward to fit a complete portal.
  for (let x = 0; x <= 12; x++) for (let y = 0; y <= 12; y++) targets.push(V(
    centre.x - bounds.halfWidth + .01 + (2 * bounds.halfWidth - .02) * x / 12,
    centre.y - bounds.halfHeight + .01 + (2 * bounds.halfHeight - .02) * y / 12,
    centre.z,
  ));
  let rays = 0;
  for (const [x, y, z] of feet) for (const muzzleHeight of [1.4, 3.3]) {
    const origin = V(x, y + muzzleHeight, z);
    for (const target of targets) {
      assert.equal(acceptedRay(origin, target, panel), false,
        `Premature final portal from ${origin.toArray()} toward ${target.toArray()}`);
      rays++;
    }
  }
  assert.equal(rays, 13858);
  // This enclosed pit is reached after entering the flight bay. Its ceramic
  // remains usable for recovery; the test must not demand a hidden shot ban.
  assert.ok(acceptedRay(V(16.5, 1.4, -10), centre, panel));
});

test('the former carried-friend freight shortcut reaches the real vestibule but cannot cross its sides or low arch', async () => {
  await game.selectLevel(11, false);
  const report = await runV8Journey(game, {scenario: async d => {
    const {level, aim, enter, walk, pickup, until, worldMove, frame, wait, mark} = d;
    aim(0, level.panels.entry.getFrame().center);
    aim(1, level.panels.observation.getFrame().center);
    enter(level.panels.entry);
    walk(-19, 14);
    aim(1, V(25, 14.5, 6));
    walk(-15, 14);
    until(() => game.playerGrounded && game.playerPosition.y < .1, 4, 'Return to friend');
    walk(-20, 28.1);
    pickup();
    enter(level.panels.entry);
    walk(24, 10);
    assert.equal(game.teleportCount, 2, 'The negative route must first reach the actual freight vestibule');
    assert.ok(game.heldCube);
    assert.ok(Math.abs(game.playerPosition.y - 12) < .05);
    mark('the original two-portal shortcut reaches its formerly open side');
    const attempts = [
      {name: 'west observation slit', x: -1, z: 0, inside: p => p.x > 20.9},
      {name: 'east side', x: 1, z: 0, inside: p => p.x < 27.1},
      {name: 'low freight arch', x: 0, z: 1, inside: p => p.z < 14},
    ];
    for (const attempt of attempts) {
      game.input.keys.add('ShiftLeft');
      for (let n = 0; n < 180; n++) {
        if (n % 30 === 0) game.input.jumpQueued = true;
        worldMove(attempt.x, attempt.z);
        frame();
        assert.ok(attempt.inside(game.playerPosition), `Standing capsule escaped via ${attempt.name}`);
        assert.equal(game.state, 'playing');
        assert.ok(game.heldCube, 'An attempted shortcut must keep the same friend');
      }
      wait(.5);
      walk(24, 10);
    }
  }});
  assert.equal(report.pass, true);
  assert.equal(report.resets + report.respawns, 0);
  assert.equal(report.teleports, 2);
});
