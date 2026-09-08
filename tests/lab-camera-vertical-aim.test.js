import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LabCamera, CAMERA_PITCH_MIN, CAMERA_PITCH_MAX } from '../src/game/LabCamera.js';
import { createHeadlessGame } from '../scripts/lab-headless.mjs';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
function track(game, point) {
  const ndc = point.clone().project(game.camera);
  game.yaw -= THREE.MathUtils.clamp(ndc.x, -1, 1) * .22;
  game.pitch = THREE.MathUtils.clamp(game.pitch + THREE.MathUtils.clamp(ndc.y, -1, 1) * .19,
    CAMERA_PITCH_MIN, CAMERA_PITCH_MAX);
  return ndc;
}

test('ordinary mouse orbit can target the floor almost directly beneath a high traveller', () => {
  const camera = new THREE.PerspectiveCamera(62, 16 / 9, .06, 160);
  const rig = new LabCamera({ camera });
  const target = V(3.67, 21.23, 4), floor = V(4, .025, 4);
  const state = { camera, yaw: 0, pitch: -.167 };
  rig.reset(target, state.yaw, state.pitch);
  for (let n = 0; n < 240; n++) {
    track(state, floor);
    rig.update({ dt: 1 / 60, target, yaw: state.yaw, pitch: state.pitch });
  }
  const projected = floor.clone().project(camera);
  assert.ok(Math.abs(projected.x) < .012 && Math.abs(projected.y) < .012, projected.toArray().join(','));
  assert.ok(rig.pitch < -1.5, 'The old 66-degree limit cannot reach this floor');
  assert.ok(camera.position.distanceTo(target) > 6, 'Downward aim must not become a close-up inside the player');
  assert.ok(camera.up.y > .99);
});

test('a falling traveller can fire a real charge into the floor with production aiming', async () => {
  const game = await createHeadlessGame();
  try {
    await game.selectLevel(11, false); game.resetRun(true);
    // Isolated camera/shot regression fixture at the observed second-shot
    // position. From here gravity, orbit input, muzzle and impacts are live;
    // the complete ordinary level journey separately proves this is reachable.
    game.playerPosition.set(3.67, 21.23, 4);
    game.previousPlayerPosition.copy(game.playerPosition);
    game.playerGroup.position.copy(game.playerPosition);
    game.playerVelocity.set(0, 0, 0); game.playerGrounded = false;
    game.yaw = 0; game.pitch = -.167;
    game.cameraRig.reset(game.playerPosition, game.yaw, game.pitch);
    const floor = game.firstLevel.panels['return-floor'].getFrame().center;
    let fired = false, firingHeight = 0;
    for (let n = 0; n < 120; n++) {
      const projected = track(game, floor);
      if (!fired && Math.abs(projected.x) < .03 && Math.abs(projected.y) < .03) {
        firingHeight = game.playerPosition.y;
        assert.equal(game.firePortal(0), true);
        fired = true;
      }
      game.updatePlaying(1 / 120); game.updatePlaying(1 / 120); game.updateVisuals(1 / 60, 1);
      if (game.portalShots.lastImpact) break;
    }
    assert.equal(fired, true, 'Normal mouse orbit never reached the floor during the fall');
    assert.ok(firingHeight > 6, `The traveller had already landed before being able to aim: ${firingHeight}`);
    assert.equal(game.portalShots.lastImpact?.valid, true, JSON.stringify(game.portalShots.lastImpact));
    assert.equal(game.portalSurfaceIds[0], game.firstLevel.panels['return-floor'].mesh.uuid);
  } finally { game.physics.dispose(); game.portals.dispose(); }
});
