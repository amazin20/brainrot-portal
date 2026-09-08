import * as THREE from 'three';
import { runV8Journey } from './LabV8Journey.js';

const check = (value, message) => { if (!value) throw Error(message); };

/** Recorded September 8 floor-rim regression, from room 9's ordinary spawn.
 * Only walking, mouse orbit, portal shots and E pickup are used. The same
 * scenario is shared by Node physics verification and browser video capture. */
export async function runPortalEdgeJourney(game, { offset = .7, sprint = false,
  carrying = false, reverse = false, jump = false, turn = false,
  onFrame = () => {}, onMilestone = () => {} } = {}) {
  check(game.levelIndex === 8, 'Portal edge inspection belongs to room 9');
  let travel;
  const route = await runV8Journey(game, { onMilestone, scenario: d => {
    const { walk, wait, aim, pickup, stop, worldMove, frame, mark } = d;
    walk(-5, 9);
    aim(0, game.firstLevel.panels['work-left'].getFrame().center);
    walk(-7, 9);
    aim(1, game.firstLevel.panels['loading-floor'].getFrame().center);
    if (carrying) {
      walk(-4, 10.5);
      const friend = game.cargo.position.clone();
      walk(friend.x, friend.z + 1.1); pickup();
      walk(-4, 10.5);
    }
    const entry = game.portals.portals[reverse ? 0 : 1];
    const start = reverse ? new THREE.Vector3(-9.1, 0, entry.position.z)
      : new THREE.Vector3(entry.position.x + offset, 0, entry.position.z + 3);
    walk(start.x, start.z); wait(.2);
    // Establish the user's looking-down orbit through ordinary mouse controls.
    game.yaw = reverse ? Math.PI / 2 : 0; game.pitch = -.5; wait(.6);
    mark(reverse ? 'wall to floor return starts' : 'floor rim approach starts');
    travel = { offset, sprint, carrying, reverse, jump, turn, frames: 0, minY: 0,
      minCameraDistance: Infinity, teleports: 0, start: game.playerPosition.toArray() };
    const before = game.teleportCount, identity = game.physics.cargoBody;
    let after = 0;
    for (let n = 0; n < 240; n++) {
      if (sprint) game.input.keys.add('ShiftLeft');
      if (jump && n === 0) game.input.jumpQueued = true;
      // This is W in the chosen orbit until passage; afterwards move away from
      // the exit so repeated re-entry cannot obscure the individual contact.
      if (game.teleportCount === before) worldMove(reverse ? -1 : 0, reverse ? 0 : -1);
      else {
        after++;
        // Reproduce looking around during horizon recovery using mouse orbit
        // input. Older evidence deliberately held the exit-facing orbit still.
        if (turn && after > 8 && after < 30) game.yaw += .14;
        worldMove(reverse ? 0 : 1, reverse ? 1 : 0);
      }
      frame();
      travel.frames++;
      travel.minY = Math.min(travel.minY, game.playerPosition.y);
      const pivot = game.playerGroup.position.clone().add(new THREE.Vector3(0, 1.32, 0));
      travel.minCameraDistance = Math.min(travel.minCameraDistance, game.camera.position.distanceTo(pivot));
      check(game.physics.cargoBody === identity, 'Portal edge replaced the friend body');
      check(!carrying || game.heldCube === game.cargo, 'Portal edge dropped the held friend');
      onFrame({ frame: n, offset, sprint, carrying, reverse, jump, turn, after,
        teleports: game.teleportCount - before, pitch: game.pitch,
        player: game.playerPosition.toArray(), camera: game.camera.position.toArray(),
        cameraUp: game.camera.up.toArray(), portalClipped: !!game.cameraRig.portalExit });
      if (after > 90 && game.playerGrounded) break;
    }
    stop();
    travel.teleports = game.teleportCount - before;
    travel.final = game.playerPosition.toArray();
    travel.finalPitch = game.pitch;
    check(travel.teleports > 0, 'The ordinary walk did not pass the linked aperture');
    check(travel.minY > -1.3, 'The traveller escaped below the portal throat');
    check(game.playerGrounded, 'The traveller did not return to physical support');
    mark(reverse ? 'wall to floor return complete' : 'floor rim traversal complete');
  } });
  return { route, travel };
}
