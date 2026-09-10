import test from 'node:test';
import assert from 'node:assert/strict';
import { createHeadlessGame } from '../scripts/lab-headless.mjs';
import { runV8Journey } from '../src/game/LabV8Journey.js';

test('the upper light crossing leaves room for a visible, collision-safe camera during the boarding jump', async () => {
  const game = await createHeadlessGame();
  await game.selectLevel(13, false);
  game.camera.aspect = 1.6; game.camera.updateProjectionMatrix();
  const update = game.updateVisuals;
  let awaitingPickup = false, active = false, crossing = false;
  let frames = 0, crossingFrames = 0, unseen = 0, longestUnseen = 0, minimum = Infinity;
  game.updateVisuals = function (...args) {
    update.apply(this, args);
    if (awaitingPickup && this.heldCube) active = true;
    if (!active || crossingFrames >= 120) return;
    frames++;
    if (crossing) crossingFrames++;
    const pivot = this.cameraRig.playerPivot;
    minimum = Math.min(minimum, this.camera.position.distanceTo(pivot));
    const screen = pivot.clone().project(this.camera);
    const visible = Math.abs(screen.x) < 1 && Math.abs(screen.y) < 1
      && screen.z > -1 && screen.z < 1;
    unseen = visible ? 0 : unseen + 1;
    longestUnseen = Math.max(longestUnseen, unseen);
    const swept = this.camera.position.clone();
    this.cameraRig.constrain(pivot, swept);
    assert.ok(swept.distanceTo(this.camera.position) < 1e-7,
      'The final camera position crossed a receiver wall or the light bridge');
  };
  try {
    const report = await runV8Journey(game, {
      onMilestone(item) {
        if (item.name === 'independent upper delivery') awaitingPickup = true;
        if (item.name === 'perpendicular light crossing') crossing = true;
      },
    });
    assert.equal(report.pass, true);
    assert.equal(report.respawns + report.resets, 0);
    assert.equal(crossingFrames, 120, 'The ordinary route must reach the boarding jump');
    assert.ok(frames > crossingFrames, 'Observe the corner pickup before the boarding marker too');
    assert.ok(minimum >= 2.2, `The camera entered the character: ${minimum} m`);
    // The original cramped receiver pushed the camera above the actor and
    // hid its pivot for 83 frames, despite an ordinary -0.216 rad mouse pitch.
    assert.ok(longestUnseen <= 8,
      `The boarding jump hid the traveller for ${longestUnseen / 60} seconds`);
  } finally {
    game.firstLevel.dispose(); game.physics.dispose(); game.portals.dispose();
  }
});
