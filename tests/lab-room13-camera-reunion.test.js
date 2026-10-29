import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

function projectPlayer(game) {
  game.scene.updateMatrixWorld(true);
  const point = new THREE.Vector3();
  let vertices = 0, outside = 0, minY = Infinity, maxY = -Infinity;
  game.playerGroup.traverse(mesh => {
    if (!mesh.isMesh) return;
    if (mesh.isSkinnedMesh) mesh.skeleton.update();
    for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
      mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld).project(game.camera);
      vertices++; minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
      if (Math.abs(point.x) > 1 || Math.abs(point.y) > 1 || Math.abs(point.z) > 1) outside++;
    }
  });
  return {vertices, outside, minY, maxY};
}

for (const aspect of [16 / 9, 390 / 844]) test(`room13 ordinary reunion retains every original player vertex at aspect ${aspect}`, async t => {
  const g = await createHeadlessGame();
  g.chamberEdition = 'foundation'; g.camera.aspect = aspect; g.camera.updateProjectionMatrix();
  await g.selectLevel(12, true);
  const original = [g.playerGroup, g.cargo, g.physics.cargoBody, g.physics.cargoBody.shapes[0]];
  const fire = g.firePortal, shotFraming = [];
  g.firePortal = function(...args) {shotFraming.push(this.cameraRig.mechanismFramingEnabled);return fire.apply(this, args);};
  try {
    const route = await runV8Journey(g, {journeyOptions: {nativeStart: true}});
    assert.equal(g.state, 'won'); assert.equal(route.resets + route.respawns, 0);
    assert.deepEqual([g.playerGroup, g.cargo, g.physics.cargoBody, g.physics.cargoBody.shapes[0]], original);
    const bounds = projectPlayer(g);
    assert.equal(bounds.vertices, 96753);
    assert.equal(bounds.outside, 0, JSON.stringify({aspect, bounds, fov: g.camera.fov}));
    assert.ok(g.camera.fov <= 96);
    assert.ok(g.cameraRig.mechanismStats.candidates <= 12);
    assert.equal(g.cameraRig.mechanismFramingActive, true);
    assert.ok(shotFraming.length > 0 && shotFraming.every(enabled => !enabled), 'The original optical shoulder must remain unchanged for every route shot');
    const safe = g.camera.position.clone();
    g.cameraRig.constrain(g.cameraRig.playerPivot, safe);
    assert.ok(safe.distanceTo(g.camera.position) < 1e-8, 'The displayed lens crosses the retained chamber geometry');
    assert.ok(g.cameraRig.lookPoint.distanceTo(g.cameraRig.focus.clone().addScaledVector(g.cameraRig.forward, 16)) < 1e-9);
    t.diagnostic(JSON.stringify({aspect, bounds, frames: route.frames, fov: g.camera.fov}));
  } finally { g.firePortal = fire; g.firstLevel?.dispose(); g.physics.dispose(); g.portals.dispose(); }
});
