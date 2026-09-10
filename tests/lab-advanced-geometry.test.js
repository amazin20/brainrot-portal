import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {resolvePortalPlacement} from '../src/game/LabPortals.js';
import {runRoom14} from '../src/game/LabRoom14Journey.js';

const game = await createHeadlessGame();
after(() => { game.physics.dispose(); game.portals.dispose(); });

for (const number of [13, 14, 15]) test(`room ${number} has valid tiles and no duplicate coplanar walking decks`, async () => {
  await game.selectLevel(number - 1, false);
  const surfaces = game.firstLevel.world.surfaces, faces = new Map();
  for (const surface of surfaces) {
    assert.ok(Number.isFinite(surface.width) && surface.width > 0, `${surface.name}: invalid width`);
    assert.ok(Number.isFinite(surface.height) && surface.height > 0, `${surface.name}: invalid height`);
    const frame = surface.getFrame();
    const values = [...frame.center.toArray(), ...frame.normal.toArray(), surface.width, surface.height];
    assert.ok(values.every(Number.isFinite), `${surface.name}: nonfinite transform`);
    const key = values.map(value => value.toFixed(5)).join(',');
    assert.equal(faces.has(key), false, `${surface.name} duplicates the face of ${faces.get(key)}`);
    faces.set(key, surface.name);
  }
  // Ceramics intentionally overlay their backing. Moving optical lifts and
  // rerouted light sheets use separate live floor records and are not static decks.
  const floors = surfaces.filter(surface => surface.floor && !surface.portal);
  for (let i = 0; i < floors.length; i++) for (let j = i + 1; j < floors.length; j++) {
    const a = floors[i].floor, b = floors[j].floor;
    if (Math.abs(a.y - b.y) > 1e-6) continue;
    const dx = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
    const dz = Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ);
    assert.ok(dx <= 1e-6 || dz <= 1e-6,
      `${floors[i].name} overlaps ${floors[j].name} by ${dx}×${dz} m at y=${a.y}`);
  }
});

test('room13 return ceramic is hidden from sampled lower and optical-shelf viewpoints by the physical chamber turn', async () => {
  await game.selectLevel(12, false); game.scene.updateMatrixWorld(true);
  const panel = game.firstLevel.panels['receiving-return'], frame = panel.getFrame();
  const acceptedRay = (origin, target) => {
    const ray = game.portalShots.ray;
    ray.set(origin, target.clone().sub(origin).normalize()); ray.near = 0; ray.far = Infinity;
    const hit = game.portalShots.firstHit();
    if (hit?.object !== panel.mesh) return false;
    const normal = hit.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();
    return normal.dot(frame.normal) > .15 && ray.ray.direction.dot(frame.normal) < -.02
      && resolvePortalPlacement(panel.mesh, hit.point, {blockers: game.colliders}).ok;
  };
  const targets = [];
  for (const x of [-.99, 0, .99]) for (const y of [-.99, 0, .99]) targets.push(frame.center.clone()
    .addScaledVector(frame.right, x * frame.halfWidth).addScaledVector(frame.up, y * frame.halfHeight));
  const samples = (a, b) => {
    if (b - a < 1.1) return [(a + b) / 2];
    const values = [b - .55]; for (let v = a + .55; v < b - .45; v += 3) values.push(v);
    return [...new Set(values)];
  };
  const free = (x, y, z) => !game.colliders.some(collider => {
    if (!collider.enabled) return false;
    const box = collider.box;
    if (box.max.y < y + .32 || box.min.y > y + 2.39) return false;
    const dx = x - THREE.MathUtils.clamp(x, box.min.x, box.max.x);
    const dz = z - THREE.MathUtils.clamp(z, box.min.z, box.max.z);
    return dx * dx + dz * dz < .43 * .43;
  });
  let rays = 0; const areas = new Set();
  // Bounded adversarial muzzle viewpoints derived from the real lower floors.
  // This negative visibility check is separate from the ordinary win routes.
  for (const surface of game.firstLevel.world.surfaces) {
    const floor = surface.floor;
    if (!floor || surface.portal || floor.y > 6) continue;
    for (const x of samples(floor.minX, floor.maxX)) for (const z of samples(floor.minZ, floor.maxZ)) {
      if (!free(x, floor.y, z)) continue;
      areas.add(surface.name);
      for (const height of [1.4, 3.3]) for (const target of targets) {
        const origin = new THREE.Vector3(x, floor.y + height, z);
        assert.equal(acceptedRay(origin, target), false,
          `Early return ceramic sight from ${surface.name}: ${origin.toArray()} to ${target.toArray()}`);
        rays++;
      }
    }
  }
  for (const name of ['South arrival passage', 'West lower return', 'West optical return']) assert.ok(areas.has(name));
  assert.ok(rays > 1000 && rays < 20000, `The bounded visibility grid ran ${rays} rays`);
  assert.ok(acceptedRay(frame.center.clone().addScaledVector(frame.normal, 1.5), frame.center),
    'The original ceramic remains usable from its actual receiving chamber');
});

test('the east edge of the room14 arrival court remains solid under ordinary walking', async () => {
  await game.selectLevel(13, false);
  const report = await runV8Journey(game, {scenario: async d => {
    for (let frame = 0; frame < 600; frame++) { d.worldMove(1, 0); d.frame(); }
    d.wait(1);
    assert.ok(game.playerPosition.x > 17, 'The route must reach the formerly uncovered eastern strip');
    assert.ok(game.playerGrounded && game.playerPosition.y >= -.01, 'The lower court reaches its boundary without an invisible fall');
    d.walk(-15, 12);
  }});
  assert.equal(report.resets + report.respawns, 0);
});

test('room14 narrow stair requires separating the original carried friend at the stable island', async () => {
  await game.selectLevel(13, false);
  const body = game.physics.cargoBody, reached = Symbol('stable island');
  const report = await runV8Journey(game, {scenario: async d => {
    let tested = false;
    try {
      await runRoom14({...d, mark(name) {
        d.mark(name);
        if (name !== 'stable island reached') return;
        assert.ok(game.heldCube, 'The original friend arrives through the first real bridge');
        assert.throws(() => d.walk(-1.5, -5, 4), /timed out|Blocked/);
        assert.ok(game.heldCube && game.playerPosition.z > -3, 'The carried pair cannot skip the physical stair pinch');
        assert.equal(game.state, 'playing'); tested = true; throw reached;
      }});
    } catch (error) { if (error !== reached) throw error; }
    assert.ok(tested, 'The normal route must reach the intended negative case');
  }});
  assert.equal(report.resets + report.respawns, 0);
  assert.equal(game.physics.cargoBody, body);
});

test('switching away from a live light bridge removes its support from every collision and view registry', async () => {
  for (const nextLevel of [14, 12, 0]) {
    await game.selectLevel(13, false);
    const bridge = game.firstLevel.state.lightBridge;
    bridge.update();
    assert.ok(bridge.pieces.some(piece => piece.collider.enabled && piece.floor.enabled), 'A real support must be active before disposal');
    const oldPhysics = game.physics, oldFloors = game.firstLevel.world.floors;
    const pieces = [...bridge.pieces];
    await game.selectLevel(nextLevel, false);
    const counts = [game.colliders.length, game.floors.length, game.cameraBlockers.length, game.aimBlockers.length];
    bridge.update(); // A retained reference must never resurrect an old support.
    assert.deepEqual([game.colliders.length, game.floors.length, game.cameraBlockers.length, game.aimBlockers.length], counts);
    for (const {mesh, collider, floor} of pieces) {
      assert.equal(collider.enabled, false); assert.equal(floor.enabled, false);
      assert.equal(mesh.visible, false); assert.equal(mesh.parent, null);
      assert.equal(oldPhysics.solids.has(mesh.uuid), false);
      assert.equal(game.physics.solids.has(mesh.uuid), false);
      assert.equal(oldFloors.includes(floor), false);
      assert.equal(game.colliders.includes(collider), false);
      assert.equal(game.floors.includes(floor), false);
      assert.equal(game.cameraBlockers.includes(mesh), false);
      assert.equal(game.aimBlockers.includes(mesh), false);
    }
  }
});
