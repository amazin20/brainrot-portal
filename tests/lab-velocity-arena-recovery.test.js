import test from 'node:test';
import assert from 'node:assert/strict';
import { createHeadlessGame } from '../scripts/lab-headless.mjs';

test('a novice who enters the well before opening the exit returns with the same friend', async () => {
  const game = await createHeadlessGame();
  try {
    game.epicMode = true; game.velocityChapter = 1;
    await game.selectLevel(0, true);
    const body = game.physics.cargoBody, model = game.cargo.group;
    for (const attach of [false, true]) {
      game.resetRun(true);
      if (attach) assert.equal(game.interact(), true);
      assert.equal(game.portals.ready, false, 'only the automatic blue entry is installed');
      for (let i = 0; i < 120 * 8 && game.velocityRun.retries === 0; i++) {
        game.input.keys.clear();
        if (game.playerGrounded) {
          game.input.keys.add('KeyW'); game.input.keys.add('ShiftLeft');
        }
        game.updatePlaying(1 / 120);
      }
      assert.equal(game.velocityRun.retries, 1, 'bottom of the well must not strand the player');
      assert.equal(game.velocityRun.segment, 0);
      assert.equal(game.teleportCount, 0);
      assert.ok(game.playerPosition.distanceTo(game.firstLevel.segments[0].start) < .02);
      assert.equal(game.physics.cargoBody, body);
      assert.equal(game.cargo.group, model);
      assert.equal(game.velocityCompanion.connected, attach);
      assert.ok(game.cargo.position.distanceTo(game.playerPosition) < 2);
      assert.equal(game.heldCube, null);
    }
  } finally {
    game.velocityCompanion?.dispose(); game.physics.dispose(); game.portals.dispose();
  }
});
