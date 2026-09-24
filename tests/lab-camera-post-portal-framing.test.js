import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createHeadlessGame } from '../scripts/lab-headless.mjs';
import { runV8Journey } from '../src/game/LabV8Journey.js';
import { LabCamera } from '../src/game/LabCamera.js';
import { makePortalFrame, transformPortalPoint } from '../src/game/LabPortals.js';

const headNdc = (game, point) => point.clone().add(new THREE.Vector3(0, 1.2, 0)).project(game.camera);
const inFrame = point => Math.abs(point.x) < .9 && Math.abs(point.y) < .9 && point.z > -1 && point.z < 1;

test('classic floor-to-wall flights frame the original traveller on their first rendered frame', async () => {
  const game = await createHeadlessGame();
  try {
    game.chamberEdition = 'classic';
    for (const [index, expectedTeleports] of [[2, 1], [26, 2]]) {
      await game.selectLevel(index, false);
      game.camera.aspect = 1.6;
      game.camera.updateProjectionMatrix();
      const updateVisuals = game.updateVisuals;
      const samples = [];
      game.updateVisuals = function (...args) {
        updateVisuals.apply(this, args);
        if (this.teleportCount !== 1 || samples.length >= 10) return;
        samples.push({
          physical: headNdc(this, this.playerPosition),
          visual: headNdc(this, this.playerGroup.position),
          assist: this.cameraRig.portalFramingActive,
        });
      };
      try {
        const report = await runV8Journey(game);
        assert.equal(report.pass, true, `level ${index + 1} must still reach the real exit`);
        assert.equal(report.teleports, expectedTeleports);
        assert.equal(report.resets + report.respawns, 0);
        assert.equal(samples.length, 10, `level ${index + 1} did not cross the first portal`);
        for (const [frame, sample] of samples.entries()) {
          assert.equal(sample.assist, true, `level ${index + 1} frame ${frame + 1} lost recovery framing`);
          assert.ok(inFrame(sample.physical), `level ${index + 1} frame ${frame + 1} physical head: ${sample.physical.toArray()}`);
          assert.ok(inFrame(sample.visual), `level ${index + 1} frame ${frame + 1} rendered head: ${sample.visual.toArray()}`);
        }
      } finally {
        game.updateVisuals = updateVisuals;
      }
    }
  } finally {
    game.firstLevel.dispose?.();
    game.physics.dispose();
    game.portals.dispose();
  }
});

test('ordinary, flat-portal and already-framed tilted views receive no correction', () => {
  for (const exitUp of [null, new THREE.Vector3(1, 0, 0)]) {
    const camera = new THREE.PerspectiveCamera(62, 1.6, .06, 160);
    const rig = new LabCamera({ camera });
    const start = new THREE.Vector3();
    rig.reset(start, 0, -.2);
    rig.update({ dt: 1 / 60, target: start, yaw: 0, pitch: -.2 });
    assert.equal(rig.portalFramingActive, false, 'ordinary walking enabled portal framing');

    const entry = makePortalFrame(new THREE.Vector3(0, 1.2, 0), new THREE.Vector3(0, 0, 1));
    const exit = makePortalFrame(new THREE.Vector3(0, 1.2, -20), new THREE.Vector3(0, 0, -1), exitUp ?? undefined);
    const destination = transformPortalPoint(start, entry, exit);
    const controls = rig.applyPortalTransform(entry, exit, { target: destination });
    rig.update({ dt: 1 / 60, target: destination, ...controls });
    assert.equal(rig.portalFramingActive, false, exitUp ? 'framed tilted view was changed' : 'flat portal was changed');
    assert.ok(rig.lookPoint.distanceTo(rig.focus.clone().addScaledVector(rig.forward, 16)) < 1e-8,
      'unneeded correction changed the camera aim');
  }
});
