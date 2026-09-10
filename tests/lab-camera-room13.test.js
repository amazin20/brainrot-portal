import test from 'node:test';
import assert from 'node:assert/strict';
import { createHeadlessGame } from '../scripts/lab-headless.mjs';
import { runV8Journey } from '../src/game/LabV8Journey.js';

test('walking around the optical access panel releases its clipping plane before inspecting the mirror', async () => {
  const game = await createHeadlessGame();
  await game.selectLevel(12, false);
  game.camera.aspect = 1.6; game.camera.updateProjectionMatrix();
  const update = game.updateVisuals;
  let inspect = false, frames = 0, checkedMarker = false;
  const mirror = game.firstLevel.panels['mirror-cradle'].getFrame().center.clone();
  game.updateVisuals = function (...args) {
    update.apply(this, args);
    if (!inspect || frames >= 180) return;
    frames++;
    for (const plane of this.cameraRig.mainClippingPlanes) {
      assert.ok(plane.distanceToPoint(this.cameraRig.playerPivot) >= 0,
        'An old exit plane discarded the player while placing the mirror load');
      assert.ok(plane.distanceToPoint(mirror) >= 0,
        'An old exit plane discarded the mirror despite correct camera aim');
    }
  };
  try {
    const report = await runV8Journey(game, { onMilestone(item) {
      if (item.name !== 'live weight turns the mirror') return;
      checkedMarker = true; inspect = true;
      assert.equal(game.cameraRig.portalExit, null, 'The player has walked around the old exit');
      assert.equal(game.cameraRig.mainClippingPlanes.length, 0,
        'The visible mirror station must not retain the access clipping plane');
      for (const point of [game.cameraRig.playerPivot, mirror.clone().add({ x: 0, y: 2, z: 0 })]) {
        const screen = point.clone().project(game.camera);
        assert.ok(Math.abs(screen.x) < 1 && Math.abs(screen.y) < 1 && screen.z > -1 && screen.z < 1,
          'Ordinary mouse orbit must frame both player and mirror');
      }
    } });
    assert.equal(report.pass, true);
    assert.equal(report.resets + report.respawns, 0);
    assert.ok(checkedMarker); assert.equal(frames, 180);
  } finally {
    game.firstLevel.dispose?.(); game.physics.dispose(); game.portals.dispose();
  }
});
