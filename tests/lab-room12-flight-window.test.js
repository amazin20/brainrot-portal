import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runRoom12} from '../src/game/LabPortalRoom12.js';
import {CAMERA_PITCH_MIN, CAMERA_PITCH_MAX} from '../src/game/LabCamera.js';

const game = await createHeadlessGame();
const V = (...p) => new THREE.Vector3(...p);
after(() => { game.physics.dispose(); game.portals.dispose(); });

async function reachGravityReturn(d) {
  const reached = Symbol('gravity return');
  try {
    await runRoom12({...d, mark(name) {
      d.mark(name);
      if (name === 'gravity returns the player above the atrium') throw reached;
    }});
  } catch (error) {
    if (error === reached) return;
    throw error;
  }
  assert.fail('Ordinary controls did not reach the vertical return');
}

// These are discrete timing samples, not a claim that every intermediate
// angle/timing succeeds. The two rising samples hit the old deep jambs even
// though the actual crosshair selected ceramic; the falling sample guards
// the existing later opportunity. No actors, portal poses or walls are moved.
for (const clickAfterFrames of [49, 67, 109]) {
  test(`room 12 accepts the real airborne click after ${clickAfterFrames} frames and completes the route`, async () => {
    await game.selectLevel(11, false);
    const report = await runV8Journey(game, {scenario: async d => {
      await reachGravityReturn(d);
      const panel = d.level.panels['far-exit'];
      const centre = panel.getFrame().center;
      const before = game.teleportCount;
      let clicked = false;
      let impact = null;
      for (let frame = 1; frame <= 210 && game.teleportCount === before && !game.playerGrounded; frame++) {
        const p = game.playerPosition, velocity = game.playerVelocity;
        d.worldMove(
          THREE.MathUtils.clamp((4 - p.x) * 1.8 - velocity.x * 1.2, -1, 1),
          THREE.MathUtils.clamp((4 - p.z) * 1.8 - velocity.z * 1.2, -1, 1),
        );
        game.scene.updateMatrixWorld(true);
        const direction = centre.clone().sub(game.camera.position);
        if (direction.dot(game.camera.getWorldDirection(V())) < 0) game.yaw += .11;
        else {
          const ndc = centre.clone().project(game.camera);
          game.yaw -= THREE.MathUtils.clamp(ndc.x, -1, 1) * .26;
          game.pitch = THREE.MathUtils.clamp(game.pitch + THREE.MathUtils.clamp(ndc.y, -1, 1) * .26,
            CAMERA_PITCH_MIN, CAMERA_PITCH_MAX);
        }
        d.frame();
        if (frame === clickAfterFrames) {
          assert.equal(game.firePortal(0), true);
          const queued = game.portalShots.queue[0];
          assert.ok(queued?.delay >= .23, 'Keep the real weapon preparation delay');
          assert.ok(Math.abs(queued.point.z - centre.z) < .001,
            'The actual camera ray must choose the final ceramic, not an intended point behind a wall');
          clicked = true;
        }
        if (clicked && !game.portalShots.queue.length && !game.portalShots.active.length) {
          impact = game.portalShots.lastImpact;
          break;
        }
      }
      assert.ok(clicked);
      assert.equal(impact?.valid, true, JSON.stringify(impact));
      assert.equal(impact?.surface, 'far-exit / collision');
      d.stop();
      d.until(() => game.teleportCount > before, 4, 'The placed portal receives the falling player');
      d.until(() => game.playerGrounded, 4, 'The redirected flight lands');
      assert.ok(game.playerPosition.x > 12 && game.playerPosition.z > 0 && game.playerPosition.y > 11.9,
        `Actual receiving gallery required: ${game.playerPosition.toArray()}`);
      d.walk(game.cargo.position.x - 1.1, game.cargo.position.z);
      d.pickup();
      d.walk(21, 21);
      d.until(() => game.state === 'won', 3, 'Both original travellers reach the exit');
    }});
    assert.equal(report.pass, true);
    assert.equal(report.teleports, 4);
    assert.equal(report.resets + report.respawns, 0);
    assert.equal(game.state, 'won');
  });
}
