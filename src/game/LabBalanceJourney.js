import * as THREE from 'three';
/** Ordinary-control solutions and attempted shortcuts for the rebuilt rocker.
 * The route never assigns actor poses, velocities, mechanism state or portals.
 * Even the launch gets its speed from walking off the tower's real landing. */
const check = (value, message) => { if (!value) throw new Error(message); };

function collect(d) {
  const { game, walk, pickup } = d, c = game.cargo.position.clone();
  walk(c.x, c.z + 1.1); pickup();
}

function serviceApproach(d) {
  d.walk(8, 11.5); d.walk(8, 5.8); d.walk(8, 5.25);
}

function loadingApproach(d) {
  serviceApproach(d);
  d.walk(2.3, 5.25); d.walk(2.3, 3.55);
  d.game.input.jumpQueued = true; d.walk(0, 3.55);
}

function inspectRocker(d) {
  const point = new THREE.Vector3(0, 2.1, 0);
  d.stop();
  for (let n = 0; n < 75; n++) {
    const { game } = d; game.scene.updateMatrixWorld(true);
    if (point.clone().sub(game.camera.position).dot(game.camera.getWorldDirection(new THREE.Vector3())) < 0) {
      game.yaw += .18; d.frame(); continue;
    }
    const ndc = point.clone().project(game.camera);
    game.yaw -= THREE.MathUtils.clamp(ndc.x, -1, 1) * .22;
    game.pitch = THREE.MathUtils.clamp(game.pitch + THREE.MathUtils.clamp(ndc.y, -1, 1) * .19, -1.15, 1.15);
    d.frame();
  }
}

export async function runBalanceJourney(d) {
  const { game, level, walk, wait, aim, until, frame, worldMove, stop, mark, pickup } = d;
  check(level.index === 6, 'The inertial rocker route requires room 7');
  const p = level.panels;

  // Prepare the floor address from the safe lower service passage, then
  // return to the visible load tray with the same physical companion.
  walk(-11.7, 8); walk(-11.7, -10.8);
  aim(0, p['balance-drop'].getFrame().center);
  walk(-11.7, 8); walk(6, 12.6); collect(d); loadingApproach(d);
  walk(0, 2.4);
  for (let n = 0; n < 12; n++) { worldMove(0, .18); frame(); }
  stop(); wait(.25); game.interact();
  check(!game.heldCube, 'The friend could not be placed on the rocker');
  game.input.jumpQueued = true; walk(-3.7, 2.5);
  until(() => game.playerGrounded && game.playerPosition.y < .1, 3, 'Could not leave the loading tray');
  inspectRocker(d); wait(1.5);
  until(() => level.state.angle > .36, 8, 'The far load did not establish the launch angle');
  mark('loaded friend sets the moving portal launch angle');
  // Use the open aisle west of the dock column so the ordinary shoulder
  // camera and muzzle both have a clear line at 16:10 as well as 16:9.
  walk(-5.5, 6); aim(1, p['balance-launch'].getFrame().center);

  // Climb the enclosed stair. The last slow walk preserves a modest horizontal
  // speed over the floor address; ordinary inertia continues during the fall.
  walk(-11.7, 8); walk(-15.5, 8); walk(-15.5, 5.8); walk(-15.5, -11.1);
  walk(-11.7, -11.25); walk(-11.7, -12);
  const before = game.teleportCount;
  for (let n = 0; n < 240 && game.teleportCount === before; n++) {
    worldMove(0, -.43);
    frame();
  }
  stop(); check(game.teleportCount > before, 'The fall missed its prepared floor portal');
  mark('gravity speed redirected by the tilting portal');
  until(() => game.playerGrounded, 5, 'The redirected flight did not land');
  check(game.playerPosition.y > 8.1 && game.playerPosition.z > 7.2, 'The flight missed the upper receiving balcony');
  mark('landed on the upper receiving balcony');

  // This horizontal receiver is hidden by its own solid floor from every
  // lower approach. The player can now repurpose the pair to retrieve cargo.
  walk(-2.2, 9.2); aim(1, p['lever-receiver'].getFrame().center);
  walk(-1.8, 7.75);
  const loadFrame = p['lever-load'].getFrame();
  aim(0, loadFrame.center.clone().addScaledVector(loadFrame.up, .32));
  until(() => game.cargo.position.y > 8.6, 8, 'The friend did not leave the load tray through the new pair');
  mark('retrieved the original friend through the load tray');
  wait(1.2);
  const c = game.cargo.position.clone(); walk(c.x - 1.05, c.z);
  if (game.state === 'playing') pickup();
  walk(0, 12.3);
}

/** Tries the recorded style of shortcut in the new topology: carry the friend
 * onto the mechanism, keep jumping, and run toward the receiving balcony.
 * Reaching the balcony is determined by physical position and support only. */
export function runBalanceJumpAttempt(d, { carry = true, counter = 2, sprint = true, jumpEvery = 8, maxFrames = 420 } = {}) {
  const { game, level, walk, wait, frame, worldMove, stop } = d;
  check(level.index === 6, 'The rocker bypass attempt requires room 7');
  if (counter !== level.state.counterIndex) {
    const control = level.terminals[0]; check(control, 'The rocker counterweight control is missing');
    serviceApproach(d); walk(control.position.x, control.position.z + 1);
    for (let n = 0; n < 3 && level.state.counterIndex !== counter; n++) { game.interact(); wait(.3); }
    wait(2);
    walk(8, 5.25); walk(8, 11.5);
  }
  if (carry) collect(d);
  loadingApproach(d);
  if (sprint) game.input.keys.add('ShiftLeft');
  let reached = false, maxY = game.playerPosition.y, frames = 0;
  for (; frames < maxFrames; frames++) {
    if (jumpEvery && frames % jumpEvery === 0) game.input.jumpQueued = true;
    worldMove(0, 1); frame(); maxY = Math.max(maxY, game.playerPosition.y);
    if (game.playerGrounded && game.playerPosition.y >= 8.15 && game.playerPosition.z >= 7.3) { reached = true; break; }
  }
  stop();
  return { reached, maxY, frames, player: game.playerPosition.toArray(), angle: level.state.angle,
    cargoHeld: game.heldCube === game.cargo, teleports: game.teleportCount };
}
