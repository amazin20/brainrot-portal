import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LabCamera } from '../src/game/LabCamera.js';
import { createHeadlessGame } from '../scripts/lab-headless.mjs';
import { runV8Journey } from '../src/game/LabV8Journey.js';
import { LabGame } from '../src/game/LabGame.js';

test('a ceiling above a blocked boom retains a swept lateral escape outside the body', () => {
  const camera = new THREE.PerspectiveCamera(62, 1.6, .06, 160);
  const backing = new THREE.Mesh(new THREE.BoxGeometry(12, 8, .2), new THREE.MeshBasicMaterial());
  backing.position.set(0, 3, 1.1);
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(12, .3, 12), new THREE.MeshBasicMaterial());
  ceiling.position.set(0, 2.8, 0);
  const rig = new LabCamera({ camera, blockers: [backing, ceiling] });
  const target = new THREE.Vector3();
  try {
    rig.reset(target, 0, -.2);
    for (let frame = 0; frame < 120; frame++) {
      rig.update({ dt: 1 / 60, target, yaw: 0, pitch: -.2 });
      assert.ok(camera.position.distanceTo(rig.playerPivot) >= 2.2, 'Ceiling forced the lens into the body');
      assert.ok(camera.position.z < .76 && camera.position.y < 2.41, 'Escape crossed the backing or ceiling');
      const swept = camera.position.clone();
      rig.constrain(rig.playerPivot, swept);
      assert.ok(swept.distanceTo(camera.position) < 1e-8, 'Final lateral position failed its near-plane sweep');
    }
  } finally {
    for (const mesh of [backing, ceiling]) { mesh.geometry.dispose(); mesh.material.dispose(); }
  }
});

test('the ordinary folded junction route keeps the camera outside the player and inside entry walls', async () => {
  const game = await createHeadlessGame();
  try {
    await game.selectLevel(11, false);
    game.camera.aspect = 1.6; game.camera.updateProjectionMatrix();
    const update = game.updateVisuals;
    let minimum = Infinity, frames = 0;
    let crossingFrames = 0, unseenFrames = 0, longestUnseen = 0;
    game.updateVisuals = function (...args) {
      update.apply(this, args); frames++;
      const distance = this.camera.position.distanceTo(this.cameraRig.playerPivot);
      minimum = Math.min(minimum, distance);
      assert.ok(distance >= 2.2, `Camera entered the body at frame ${frames}: ${distance}`);
      if (!this.cameraRig.portalExit) {
        assert.ok(this.camera.position.z < 17.01,
          `The ordinary boom escaped through an entrance wall at frame ${frames}`);
      }
      // Ordinary floor-to-wall flight, with the real collision escape and
      // transported horizon. The previous upward escape hid the whole body
      // for 0.6 seconds despite maintaining a safe boom distance.
      if (this.teleportCount === 3 && crossingFrames < 60) {
        crossingFrames++;
        const subject = this.cameraRig.playerPivot.clone().project(this.camera);
        const visible = Math.abs(subject.x) < 1 && Math.abs(subject.y) < 1
          && subject.z > -1 && subject.z < 1;
        unseenFrames = visible ? 0 : unseenFrames + 1;
        longestUnseen = Math.max(longestUnseen, unseenFrames);
      }
    };
    const report = await runV8Journey(game);
    assert.equal(report.pass, true); assert.equal(report.resets + report.respawns, 0);
    assert.ok(frames > 2000); assert.ok(minimum >= 2.2);
    assert.equal(crossingFrames, 60, 'The ordinary route did not reach its lateral flight');
    assert.ok(longestUnseen <= 8,
      `The collision escape hid the traveller for ${longestUnseen / 60} seconds`);
  } finally { game.physics.dispose(); game.portals.dispose(); }
});

test('main world clipping is isolated from portal textures and restored after rendering', () => {
  const original = [], main = [{}], calls = [];
  const renderer = { clippingPlanes: original,
    render() { calls.push('main'); assert.equal(this.clippingPlanes, main); },
  };
  const game = { renderer, cameraRig: { mainClippingPlanes: main },
    portals: { render() { calls.push('portal'); assert.equal(renderer.clippingPlanes, original); } },
  };
  LabGame.prototype.render.call(game);
  assert.deepEqual(calls, ['portal', 'main']); assert.equal(renderer.clippingPlanes, original);
  renderer.render = () => { throw new Error('render fixture'); };
  assert.throws(() => LabGame.prototype.render.call(game), /render fixture/);
  assert.equal(renderer.clippingPlanes, original);
});
