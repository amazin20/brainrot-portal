import * as THREE from 'three';
import { runV8Journey } from './LabV8Journey.js';

const assert = (value, message) => { if (!value) throw Error(message); };

/** Debug/CI choreography from the authored room-nine spawn. The approach,
 * pickup, camera orbit, acceleration, jump and stop use ordinary controls.
 * Physics always runs at 120Hz; only the presentation sampling rate changes. */
export async function runAnimationJourney(game, { fps = 60, carrying = false,
  onMilestone = () => {}, onFrame = () => {} } = {}) {
  assert(game.levelIndex === 8, 'Animation inspection belongs to room 9');
  assert([30, 60, 120, 144].includes(fps), 'Unsupported animation sample rate');
  let motion;
  const route = await runV8Journey(game, { onMilestone, scenario: d => {
    const { walk, pickup, wait, stop, worldMove, frame, mark } = d;
    if (carrying) {
      const friend = game.cargo.position.clone();
      walk(friend.x + 1.2, friend.z);
      pickup();
    }
    walk(-4.7, 10.6); wait(.3);
    // Rotate via yaw/pitch input, allowing the production shoulder camera to
    // settle against the real room geometry. Never write its transform.
    const look = new THREE.Vector3(6, 1.6, 10.6);
    stop();
    for (let n = 0; n < 100; n++) {
      game.scene.updateMatrixWorld(true);
      if (look.clone().sub(game.camera.position).dot(game.camera.getWorldDirection(new THREE.Vector3())) < 0) {
        game.yaw += .18; frame(); continue;
      }
      const ndc = look.clone().project(game.camera);
      game.yaw -= THREE.MathUtils.clamp(ndc.x, -1, 1) * .22;
      game.pitch = THREE.MathUtils.clamp(game.pitch + THREE.MathUtils.clamp(ndc.y, -1, 1) * .19, -1.15, 1.15);
      frame();
    }
    wait(.2); mark(carrying ? 'held-friend animation inspection starts' : 'free animation inspection starts');
    const start = game.playerPosition.clone(), body = game.physics.cargoBody;
    motion = { fps, carrying, frames: 0, physicsSteps: 0, jumps: 0, landings: 0,
      maxHeight: start.y, maxGripError: 0, maxGroundContactError: 0,
      phases: [], start: start.toArray(), final: null, normalCamera: true };
    let wasGrounded = game.playerGrounded, jumpIssued = false;
    const states = new Set();
    try {
      for (let i = 0; i < fps * 3.2; i++) {
        const time = i / fps;
        if (time < 1.8) { worldMove(1, 0); game.input.keys.add('ShiftLeft'); }
        else stop();
        if (!jumpIssued && time >= .6) { game.input.jumpQueued = true; jumpIssued = true; }
        const needed = Math.floor((i + 1) * 120 / fps + 1e-8);
        while (motion.physicsSteps < needed) {
          game.updatePlaying(1 / 120); motion.physicsSteps++;
          assert(game.state === 'playing', 'Animation inspection unexpectedly ended the room');
          if (wasGrounded && !game.playerGrounded) motion.jumps++;
          if (!wasGrounded && game.playerGrounded) motion.landings++;
          wasGrounded = game.playerGrounded;
          motion.maxHeight = Math.max(motion.maxHeight, game.playerPosition.y);
        }
        game.updateVisuals(1 / fps, 1);
        const diagnostic = game.animator.diagnostics;
        assert(game.physics.cargoBody === body, 'Animation replaced the companion body');
        if (carrying) {
          assert(game.heldCube === game.cargo, 'Animation lost the held friend');
          motion.maxGripError = Math.max(motion.maxGripError,
            diagnostic.carryReach.leftError || 0, diagnostic.carryReach.rightError || 0);
        }
        for (const contact of Object.values(diagnostic.groundContact))
          if (contact.locked && contact.blend > .99) motion.maxGroundContactError = Math.max(motion.maxGroundContactError, contact.error);
        states.add(diagnostic.state);
        motion.frames++;
        onFrame({ frame: i, fps, carrying, time, grounded: game.playerGrounded,
          state: diagnostic.state, player: game.playerPosition.toArray(),
          feet: diagnostic.footContact, landing: diagnostic.landingSupport });
      }
    } finally { stop(); }
    motion.phases = [...states]; motion.final = game.playerPosition.toArray();
    motion.finalGrounded = game.playerGrounded;
    motion.endVelocity = game.playerVelocity.toArray();
    assert(motion.jumps === 1 && motion.landings === 1, 'Expected one ordinary jump and landing');
    assert(motion.maxHeight - start.y > .8, 'The ordinary jump never left the floor');
    assert(motion.finalGrounded && Math.hypot(game.playerVelocity.x, game.playerVelocity.z) < .03,
      'The locomotion did not recover to a settled stop');
    assert(!carrying || motion.maxGripError < .06, 'The companion visibly left a glove');
    mark(carrying ? 'held-friend jump and recovery complete' : 'free jump and recovery complete');
  } });
  assert(route.resets === 0 && route.respawns === 0, 'Animation inspection reset an actor');
  route.approachFrames = route.frames;
  route.frames += motion.physicsSteps / 2;
  route.presentationFrames = route.approachFrames + motion.frames;
  return { route, motion };
}
