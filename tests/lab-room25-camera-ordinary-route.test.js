import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {ACTIVE_FOUNDATION_RUNTIME_FLAGS} from '../src/game/ReleaseIdentity.js';

test('ordinary campaign Room25 aims at the actual optical front before firing and completes with the original cargo', async () => {
  // Reproduce the actual qa-campaign-ordinary entrypoint: its shared journey
  // has a separate convergence tolerance from the Room25-only native driver.
  const game = await createHeadlessGame();
  Object.assign(game, {chamberEdition: 'foundation', ...ACTIVE_FOUNDATION_RUNTIME_FLAGS});
  try {
    await game.selectLevel(24, false);
    const cargo = game.cargo, body = game.physics.cargoBody, shape = body.shapes[0];
    const fire = game.firePortal;let firstRelay = null;
    game.firePortal = function (index) {
      if (index === 1 && !firstRelay) {
        const panel = this.firstLevel.panels['lower-relay'], frame = panel.getFrame();
        const ndc = frame.center.clone().project(this.camera);
        assert.ok(Math.abs(ndc.x) < .001 && Math.abs(ndc.y) < .001, `ordinary aiming stopped beside the small front: ${ndc.toArray()}`);
        // Observe the production centre ray before request captures it. Never
        // override its target, panel, muzzle, camera, actors or hit acceptance.
        this.scene.updateMatrixWorld(true);this.camera.updateWorldMatrix(true, false);
        this.portalShots.ray.setFromCamera(new THREE.Vector2(), this.camera);
        const hit = this.portalShots.firstHit();
        assert.ok(hit && hit.face);assert.equal(hit.object.userData.portalable, true);
        const normal = hit.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();
        assert.ok(normal.dot(frame.normal) > .15, 'reticle reaches a housing edge instead of the real white front');
        assert.ok(hit.point.distanceTo(frame.center) < .2);
        firstRelay = {ndc: ndc.toArray(), point: hit.point.toArray()};
      }
      return fire.call(this, index);
    };
    const report = await runV8Journey(game);
    assert.ok(firstRelay);assert.equal(report.pass, true);assert.equal(game.state, 'won');
    assert.equal(report.resets, 0);assert.equal(report.respawns, 0);
    assert.equal(game.cargo, cargo);assert.equal(game.physics.cargoBody, body);assert.equal(body.shapes[0], shape);
    assert.ok(report.milestones.some(row => row.name === 'first optical receiver raised the loaded counterweight onto a physical balcony'));
    assert.ok(report.milestones.some(row => row.name === 'reverse overlook reveals the starting room'));
  } finally {game.firstLevel?.dispose?.();game.physics.dispose();game.portals.dispose();}
});
