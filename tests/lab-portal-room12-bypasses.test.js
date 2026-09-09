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
  const ray = game.portalShots.ray;
  ray.set(origin, target.clone().sub(origin).normalize()); ray.near = 0; ray.far = Infinity;
  const hit = game.portalShots.firstHit();
  if (hit?.object !== panel.mesh) return false;
  const normal = hit.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();
  const face = panel.getFrame().normal;
  return normal.dot(face) > .15 && ray.ray.direction.dot(face) < -.02
    && resolvePortalPlacement(panel.mesh, hit.point, {blockers: game.colliders}).ok;
}

test('the folded stairs and high walk hide sampled final-panel edges from standing and jumping viewpoints', async () => {
  await game.selectLevel(11, false); game.scene.updateMatrixWorld(true);
  const panel = game.firstLevel.panels.final, frame = panel.getFrame();
  const bounds = panel.mesh.userData.portalBounds, orientation = panel.mesh.getWorldQuaternion(new THREE.Quaternion());
  const right = V(1, 0, 0).applyQuaternion(orientation), up = V(0, 1, 0).applyQuaternion(orientation);
  const targets = [];
  for (let x = 0; x <= 8; x++) for (let y = 0; y <= 8; y++) targets.push(frame.center.clone()
    .addScaledVector(right, -bounds.halfWidth + .01 + (2 * bounds.halfWidth - .02) * x / 8)
    .addScaledVector(up, -bounds.halfHeight + .01 + (2 * bounds.halfHeight - .02) * y / 8));
  const span = width => width < 1.1 ? [0] : [...new Set([-(width / 2 - .5), 0,
    ...Array.from({length: Math.max(0, Math.floor((width - 1) / 3))}, (_, i) => -(width / 2 - .5) + (i + 1) * 3),
    width / 2 - .5])];
  const free = ([x, y, z]) => !game.colliders.some(c => {
    if (!c.enabled || (c.walkablePlane && !c.solidUnderside)) return false;
    const b = c.box;
    // A following low stair riser is legal for the actual step controller.
    if (b.max.y < y + .32 || b.min.y > y + 2.4 - .01) return false;
    const dx = x - THREE.MathUtils.clamp(x, b.min.x, b.max.x), dz = z - THREE.MathUtils.clamp(z, b.min.z, b.max.z);
    return dx * dx + dz * dz < .43 * .43;
  });
  let rays = 0;
  const areas = new Set();
  // These are explicit adversarial viewpoints, not a positive walkthrough.
  // Derive them from current floors so old atrium or old straight-stair
  // coordinates cannot survive after the geometry they tested is removed.
  for (const surface of game.firstLevel.world.surfaces) {
    if (surface.portal || surface.normal.y < .99 || ['Receiving dock', 'Freight throat floor', 'Launch pocket recovery'].includes(surface.name)) continue;
    const centre = surface.getFrame().center;
    for (const x of span(surface.width)) for (const z of span(surface.height)) {
      const feet = [centre.x + x, centre.y, centre.z + z];
      if (!free(feet)) continue;
      areas.add(surface.name);
      for (const height of [1.4, 3.3]) for (const target of targets) {
        const origin = V(...feet).add(V(0, height, 0));
        assert.equal(acceptedRay(origin, target, panel), false,
          `Early final portal from ${surface.name}: ${origin.toArray()} toward ${target.toArray()}`);
        rays++;
      }
    }
  }
  for (const name of ['Spine stair', 'Folded return stair', 'Over the freight tube', 'Same-shaft high lip']) assert.ok(areas.has(name));
  assert.ok(rays > 50000, `A useful edge/viewpoint grid is required: ${rays}`);
  assert.ok(acceptedRay(V(4, 21, 1), frame.center, panel), 'The actual high airborne sightline remains open');
  assert.ok(acceptedRay(V(-12, 18.4, 3), frame.center, panel), 'Recovery inside the pocket remains physical');
});

function reachLedge(d, carry) {
  const p = d.level.panels;
  d.walk(10, 14.5); d.walk(-14.5, 14.5); d.walk(-14.5, 12);
  d.aim(0, p['access-low'].getFrame().center); d.aim(1, p['access-high'].getFrame().center);
  if (carry) {
    d.walk(-14.5, 14.5); d.walk(11, 14.5); d.walk(11, 11); d.pickup();
    d.walk(11, 14.5); d.walk(-14.5, 14.5); d.walk(-14.5, 12);
  }
  d.enter(p['access-low']); d.until(() => game.playerGrounded, 3, 'The original traveller reaches the folded ledge');
}

function pressAgainst(d, x, z, boundary, label) {
  game.input.keys.add('ShiftLeft');
  for (let n = 0; n < 240; n++) {
    if (n % 30 === 0) game.input.jumpQueued = true;
    d.worldMove(x, z); d.frame();
    assert.ok(boundary(game.playerPosition), `${label}: ${game.playerPosition.toArray()}`);
    assert.equal(game.state, 'playing'); assert.ok(game.heldCube, 'The same carried companion remains present');
  }
  d.wait(.5);
}

test('a carried friend reaches the actual upper corridor but cannot drop through its sides or low sight window', async () => {
  await game.selectLevel(11, false);
  const report = await runV8Journey(game, {scenario: d => {
    reachLedge(d, true);
    d.walk(-15.5, -8); d.walk(-15.5, -12.5); d.walk(1.5, -12.5); d.walk(1.5, -2.5);
    d.walk(5, -2.5); d.walk(5, -9.3); d.walk(8, -9.3); d.walk(8, 4);
    assert.ok(game.playerPosition.y > 17.9); assert.equal(game.teleportCount, 1);
    pressAgainst(d, 1, 0, p => p.x < 9 && p.y > 17.9, 'Upper east wall must stop the former direct goal drop');
    d.walk(8, 4); d.walk(8, 14); d.walk(5.5, 14); d.walk(5.5, 12.3);
    pressAgainst(d, 0, -1, p => p.z > 11.4 && p.y > 17.9, 'The low aiming window must not admit the standing capsule');
  }});
  assert.equal(report.pass, true); assert.equal(report.teleports, 1); assert.equal(report.resets + report.respawns, 0);
});

test('the original carried friend can enter the cargo tube but its low throat and sight slot block the standing player', async () => {
  await game.selectLevel(11, false);
  const report = await runV8Journey(game, {scenario: d => {
    reachLedge(d, false);
    d.walk(-15, -8); d.walk(-9, -8); d.aim(1, d.level.panels.cargo.getFrame().center);
    d.walk(-15, -8); d.walk(-15, 14); d.walk(-6, 14);
    d.until(() => game.playerGrounded && game.playerPosition.y < .1, 4, 'Return by the actual lower floor');
    d.walk(11, 14); d.walk(game.cargo.position.x - 1.1, game.cargo.position.z); d.pickup();
    d.walk(11, 14.5); d.walk(-14.5, 14.5); d.walk(-14.5, 12);
    d.enter(d.level.panels['access-low']); d.until(() => game.playerGrounded, 3, 'Cargo tube floor');
    d.walk(10, -4); assert.ok(Math.abs(game.playerPosition.y - 9) < .1); assert.equal(game.teleportCount, 2);
    pressAgainst(d, -1, 0, p => p.x > 6.9, 'The west sight slot remains lower than the capsule');
    d.walk(10, -4);
    pressAgainst(d, 0, 1, p => p.z < .4, 'The freight throat admits the free body but not its carrier');
  }});
  assert.equal(report.pass, true); assert.equal(report.teleports, 2); assert.equal(report.resets + report.respawns, 0);
});
