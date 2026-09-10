import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

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
