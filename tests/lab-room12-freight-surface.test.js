import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {resolvePortalPlacement} from '../src/game/LabPortals.js';
import {runV8Journey} from '../src/game/LabV8Journey.js';

const game = await createHeadlessGame();
after(() => { game.physics.dispose(); game.portals.dispose(); });

test('all six junction ceramics accept complete portals at their visible edges and corners', async () => {
  await game.selectLevel(11, false); game.scene.updateMatrixWorld(true);
  assert.equal(Object.keys(game.firstLevel.panels).length, 6);
  for (const [name, panel] of Object.entries(game.firstLevel.panels)) {
    const frame = panel.getFrame(), bounds = panel.mesh.userData.portalBounds;
    const orientation = panel.mesh.getWorldQuaternion(new THREE.Quaternion());
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(orientation);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(orientation);
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) {
      const point = frame.center.clone()
        .addScaledVector(right, -bounds.halfWidth + .01 + (2 * bounds.halfWidth - .02) * x / 4)
        .addScaledVector(up, -bounds.halfHeight + .01 + (2 * bounds.halfHeight - .02) * y / 4);
      const placement = resolvePortalPlacement(panel.mesh, point, {blockers: game.colliders});
      assert.equal(placement.ok, true, `${name}: visible ceramic at ${point.toArray()} rejected: ${placement.reason}`);
      assert.ok(Math.abs(placement.position.clone().sub(frame.center).dot(frame.normal)) < 1e-6);
    }
    // Successful authored bounds never exempt a genuinely occupied aperture.
    const occupied = frame.center.clone().addScaledVector(frame.normal, .35);
    const obstacle = {box: new THREE.Box3().setFromCenterAndSize(occupied, new THREE.Vector3(.7, .7, .7))};
    assert.equal(resolvePortalPlacement(panel.mesh, frame.center, {blockers: [...game.colliders, obstacle]}).reason,
      'obstructed', `${name} ignored a real obstacle`);
  }
});

test('ordinary camera aiming from the folded ledge places the cargo portal through the real sight slot', async () => {
  await game.selectLevel(11, false);
  const report = await runV8Journey(game, {scenario: d => {
    const p = d.level.panels;
    d.walk(10, 14.5); d.walk(-14.5, 14.5); d.walk(-14.5, 12);
    d.aim(0, p['access-low'].getFrame().center);
    d.aim(1, p['access-high'].getFrame().center);
    d.enter(p['access-low']);
    d.until(() => game.playerGrounded, 3, 'Reach the actual ledge');
    d.walk(-15, -8); d.walk(-9, -8);
    d.aim(1, p.cargo.getFrame().center);
    assert.equal(game.portalShots.lastImpact.valid, true);
    assert.equal(game.portalSurfaceIds[1], p.cargo.mesh.uuid);
    assert.equal(game.teleportCount, 1);
  }});
  assert.equal(report.pass, true); assert.equal(report.resets + report.respawns, 0);
});
