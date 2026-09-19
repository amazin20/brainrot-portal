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

test('a prepared exit without E restores the checkpoint camera immediately and permits the next real flight', async () => {
  const game = await createHeadlessGame();
  try {
    game.epicMode = true; game.velocityChapter = 1;
    await game.selectLevel(0, true);
    const body = game.physics.cargoBody, model = game.cargo.group;
    const segment = game.firstLevel.segments[0];
    // Only fixture placement is direct: movement, failure and recovery use the
    // normal physics loop. Deliberately omit the ordinary E interaction.
    assert.equal(game.placeOnPanel(1, segment.exit.mesh, segment.exit.mesh.userData.center), true);
    assert.equal(game.velocityCompanion.connected, false);
    for (let i = 0; i < 120 * 8 && !game.velocityRun.retries; i++) {
      game.input.keys.clear();
      if (game.playerGrounded) {
        game.input.keys.add('KeyW'); game.input.keys.add('ShiftLeft');
      }
      game.updatePlaying(1 / 120);
      if (!game.velocityRun.retries && i % 2 === 0) game.updateVisuals(1 / 60, 1);
    }
    const checkpoint = game.firstLevel.getCheckpoint();
    assert.equal(game.velocityRun.retries, 1);
    assert.equal(game.velocityRun.segment, 0); assert.equal(game.velocityRun.chain, 0);
    assert.equal(game.physics.cargoBody, body); assert.equal(game.cargo.group, model);
    assert.ok(game.playerPosition.distanceTo(checkpoint.position) < 1e-8);
    assert.equal(game.portalVisualOffset.length(), 0, 'old transit must not overwrite the restored visual pose');
    assert.ok(game.portalVisualRotation.angleTo(model.quaternion.clone().identity()) < 1e-8);
    assert.equal(game.yaw, checkpoint.yaw); assert.equal(game.pitch, checkpoint.pitch);
    assert.equal(game.cameraRig.portalExit, null);
    assert.ok(game.camera.position.distanceTo(checkpoint.position) < 12);
    game.updateVisuals(1 / 60, 1);
    assert.ok(game.playerGroup.position.distanceTo(checkpoint.position) < 1e-8, 'the very first rendered frame stays at the station');
    assert.ok(game.camera.position.distanceTo(checkpoint.position) < 12);
    assert.equal(game.velocityCompanion.connected, false);

    // The novice can now press E and repeat without resetting or correcting a
    // secretly reversed camera. Holding W still leads toward the real intake.
    assert.equal(game.interact(), true);
    assert.equal(game.velocityCompanion.connected, true);
    assert.equal(game.placeOnPanel(1, segment.exit.mesh, segment.exit.mesh.userData.center), true);
    for (let i = 0; i < 120 * 12 && game.velocityRun.segment === 0; i++) {
      game.input.keys.clear();
      if (game.playerGrounded && game.velocityRun.phase !== 'flight') {
        game.input.keys.add('KeyW'); game.input.keys.add('ShiftLeft');
      }
      game.updatePlaying(1 / 120);
      if (i % 2 === 0) game.updateVisuals(1 / 60, 1);
    }
    assert.equal(game.velocityRun.segment, 1, 'ordinary forward input and momentum must reach the next station');
    assert.equal(game.velocityRun.retries, 1); assert.equal(game.velocityRun.chain, 1);
    assert.equal(game.physics.cargoBody, body); assert.equal(game.cargo.group, model);
    assert.equal(game.velocityCompanion.isNear(), true);
  } finally {
    game.velocityCompanion?.dispose(); game.physics.dispose(); game.portals.dispose();
  }
});
