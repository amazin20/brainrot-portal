import test from 'node:test';
import assert from 'node:assert/strict';
import { createHeadlessGame } from '../scripts/lab-headless.mjs';
import { runV8Journey } from '../src/game/LabV8Journey.js';
import { LabGame } from '../src/game/LabGame.js';

test('the ordinary atrium route keeps the camera outside the player and inside entry walls', async () => {
  const game = await createHeadlessGame();
  try {
    await game.selectLevel(11, false);
    game.camera.aspect = 1.6; game.camera.updateProjectionMatrix();
    const update = game.updateVisuals;
    let minimum = Infinity, frames = 0;
    game.updateVisuals = function (...args) {
      update.apply(this, args); frames++;
      const distance = this.camera.position.distanceTo(this.cameraRig.playerPivot);
      minimum = Math.min(minimum, distance);
      assert.ok(distance >= 2.2, `Camera entered the body at frame ${frames}: ${distance}`);
      if (!this.cameraRig.portalExit) {
        assert.ok(this.camera.position.z < 37.01,
          `The ordinary boom escaped through an entrance wall at frame ${frames}`);
      }
    };
    const report = await runV8Journey(game);
    assert.equal(report.pass, true); assert.equal(report.resets + report.respawns, 0);
    assert.ok(frames > 4000); assert.ok(minimum >= 2.2);
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
