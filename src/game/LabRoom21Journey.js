import * as THREE from 'three';
import { CAMERA_PITCH_MIN, CAMERA_PITCH_MAX } from './LabCamera.js';
const check = (condition, message) => { if (!condition) throw new Error(message); };
/** Route-only mouse-equivalent aiming. Do not move the camera/actors or place
 * portals directly. The shared heuristic can spin at a transported horizon;
 * acquire the target with bounded yaw/pitch input before screen-space feedback. */
export function room21Aim(d, index, point) {
  const { game, frame, stop, until } = d;
  stop();
  for (let n = 0; n < 60; n++) {
    const direction = point.clone().sub(game.playerPosition.clone().add(new THREE.Vector3(0, 1.4, 0)));
    const heading = Math.atan2(-direction.x, -direction.z);
    const elevation = Math.atan2(direction.y, Math.hypot(direction.x, direction.z));
    game.yaw += THREE.MathUtils.clamp(Math.atan2(Math.sin(heading-game.yaw), Math.cos(heading-game.yaw)), -.08, .08);
    game.pitch += THREE.MathUtils.clamp(elevation-game.pitch, -.05, .05);
    game.pitch = THREE.MathUtils.clamp(game.pitch, CAMERA_PITCH_MIN, CAMERA_PITCH_MAX);
    frame();
  }
  let acquired = false;
  for (let n = 0; n < 420; n++) {
    game.scene.updateMatrixWorld(true);
    const direction = point.clone().sub(game.camera.position);
    const ndc = point.clone().project(game.camera);
    const inFront = direction.dot(game.camera.getWorldDirection(new THREE.Vector3())) > 0;
    if (inFront && Math.abs(ndc.x) < .008 && Math.abs(ndc.y) < .008) { acquired = true; break; }
    if (!inFront) throw new Error('Room21 aim lost its target behind the camera');
    game.yaw -= THREE.MathUtils.clamp(ndc.x, -1, 1)*.065;
    game.pitch = THREE.MathUtils.clamp(game.pitch+THREE.MathUtils.clamp(ndc.y, -1, 1)*.055, CAMERA_PITCH_MIN, CAMERA_PITCH_MAX);
    frame();
  }
  check(acquired, 'Room21 aim did not converge: '+point.clone().project(game.camera).toArray());
  check(game.firePortal(index), 'Room21 shot request rejected');
  until(() => !game.portalShots.queue.length && !game.portalShots.active.length, 2, 'Room21 projectile arrival');
  check(game.portalShots.lastImpact?.valid, 'Room21 impact rejected: '+JSON.stringify(game.portalShots.lastImpact));
}
export function room21PrepareSource(d) {
  const { game, level, walk, aim, until, mark } = d;
  walk(-10, 17.5); walk(-24.7, 17.5); walk(-30, 17.5); walk(-30, 5.5);
  aim(0, level.panels['pressure-intake'].getFrame().center);
  walk(-30, -15); walk(-21, -15);
  aim(1, level.panels['drive-outlet'].getFrame().center);
  until(() => level.state.sourceDrive.car.progress > .99, 10, 'Air route did not raise source carriage');
  mark('air transmission lifts a real source carriage, independently of the cargo');
  walk(-30, -15); walk(-30, 17.5); walk(-24.7, 16.7);
  game.interact(); check(level.state.sourceDrive.brake, 'Source brake not engaged by E');
  game.clearPortals(); d.wait(.5);
  check(level.state.sourceDrive.car.progress > .99, 'Braked source lost its height when power portals were cleared');
  mark('mechanical brake retains height and releases the pair for transportation');
  walk(-24.7, 17.5); walk(-10, 17.5);
}
export function room21Climb(d) {
  const { game, level, walk, aim, until, mark } = d;
  walk(-10, 14);
  aim(1, level.panels['source-carriage'].getFrame().center);
  // Falling into the same well transports the traveller onto the retained
  // carriage; there is no walkable stair to the high source anymore.
  walk(-10, 11.65); const before = game.teleportCount;
  for (let n = 0; n < 300 && game.playerGrounded; n++) { d.worldMove(0, -.12); d.frame(); }
  d.until(() => game.teleportCount > before, 5, 'Source access portal missed');
  until(() => game.playerGrounded, 6, 'Source carriage landing');
  check(game.playerPosition.y > 17.7, 'Carriage was not prepared and retained');
  walk(-10, 14);
  mark('high source reached by reusing the shaft and the retained carriage');
}
export function room21Freight(d) {
  const { game, level, walk, aim, wait, pickup, until, mark } = d, p = level.panels;
  walk(0, 14); walk(0, -1);
  aim(1, p['freight-out'].getFrame().center);
  walk(-6, -1); walk(-6, 5); aim(0, p['shared-drop'].getFrame().center.clone().setZ(10.8));
  walk(-6, -1); walk(0, -1); walk(0, 14);
  walk(game.cargo.position.x + 1, game.cargo.position.z); pickup();
  walk(-10, 14); d.look(p['shared-drop'].getFrame().center.clone().setY(7));
  walk(-10, 11.65); wait(.5); mark('low freight fall into the shared shaft');
  const before = game.physics.portalTransports; game.interact();
  until(() => game.physics.portalTransports > before, 5, 'Cargo missed the shared drop');
  until(() => level.state.freightGuard.loaded, 7, 'Freight failed to load its receiving pocket');
  until(() => level.state.freightGuard.progress > .99, 4, 'Loaded guard must retract');
  mark('same cargo loads the pocket and opens the high trajectory');
}
export function room21Fling(d, { launchOffset = 0 } = {}) {
  const { game, level, walk, aim, worldMove, frame, stop, until, mark } = d;
  walk(-10 + launchOffset, 11.65);
  room21Aim(d, 1, level.panels['rising-out'].getFrame().center);
  const before = game.teleportCount;
  for (let n = 0; n < 300 && game.playerGrounded; n++) { worldMove(0, -.12); frame(); }
  stop(); until(() => game.teleportCount > before, 4, 'High drop missed');
  mark('fall momentum is redirected upward, without an airborne portal swap');
  until(() => game.playerGrounded, 6, 'Rising flight did not find a permanent landing');
  mark('gravity settles the traveller inside the receiving niche');
  check(Math.abs(game.playerPosition.y - 12) < .2 && game.playerPosition.x > 5.5,
    'Wrong receiving floor: ' + game.playerPosition.toArray());
}
export async function runRoom21(d, { order = 'cargo-first', recovery = false, launchOffset = 0 } = {}) {
  check(Number.isFinite(launchOffset) && Math.abs(launchOffset) <= .35, 'Launch variation outside reviewed range');
  check(['cargo-first', 'scout-first'].includes(order), 'Unknown gravity-pocket order');
  if (order === 'scout-first') room21PrepareSource(d);
  room21Freight(d);
  if (order === 'cargo-first') {
    room21PrepareSource(d);
    // Restore the shared entry after the energy route used both portals.
    d.walk(0, 14); d.walk(0, -1); d.walk(-6, -1); d.walk(-6, 5);
    d.aim(0, d.level.panels['shared-drop'].getFrame().center.clone().setZ(10.8));
    d.walk(-6, -1); d.walk(0, -1); d.walk(0, 14);
  }
  if (recovery) {
    // A deliberately insufficient source height is an ordinary failed attempt.
    // Keep the same parked load and recover by walking, never via respawn.
    const { game, level, walk, aim, frame, worldMove, stop, until, mark } = d;
    walk(-10, 11.65); aim(1, level.panels['rising-out'].getFrame().center);
    const before = game.teleportCount;
    for (let n = 0; n < 300 && game.playerGrounded; n++) { worldMove(0, -.12); frame(); }
    stop(); until(() => game.teleportCount > before, 4, 'Short fall missed');
    // Removing the pair after the transfer must not change a traveller in flight.
    game.clearPortals(); mark('deliberate short flight; both portals removed after transfer');
    until(() => game.playerGrounded, 8, 'Short attempt did not return to a safe floor');
    check(game.playerPosition.y < 12 && game.state === 'playing', 'Short launch unexpectedly solved the room');
    check(level.state.freightGuard.loaded, 'Recovery displaced the parked companion');
    mark('failed flight lands safely; cargo preparation remains physical and intact');
    walk(-6, -1); walk(-6, 5); aim(0, level.panels['shared-drop'].getFrame().center.clone().setZ(10.8));
    walk(-6, -1); walk(0, -1); walk(0, 14);
  }
  room21Climb(d); room21Fling(d, { launchOffset });
  const { game, level, walk, aim, wait, until, pickup, mark } = d;
  walk(15.9, -5); game.interact();
  check(level.state.freightHood.open, 'Service hood control unreachable');
  until(() => level.state.freightHood.progress > .99, 4, 'Service hood must physically expose cargo floor');
  mark('permanent niche grants physical access to the freight service hood');
  walk(11, -7); aim(1, level.panels['receiving-return'].getFrame().center);
  // Walk along the open inspection edge to see the actual landing, not a fixed
  // point that only works when the cargo hits the exact centre of its pocket.
  const viewingX = Math.max(8.25, Math.min(15.45, game.cargo.position.x));
  walk(viewingX, -3.2); walk(viewingX, -2.35);
  aim(0, game.cargo.position.clone().setY(level.panels['freight-cradle'].getFrame().center.y));
  until(() => game.cargo.position.y > 12, 6, 'Original cargo did not reach the permanent niche');
  mark('new line of sight releases the same cargo and restores the guard');
  wait(1.5); walk(game.cargo.position.x + 1, game.cargo.position.z); pickup();
  until(() => level.state.freightGuard.progress < .01, 4, 'Unloading did not raise return bridge');
  mark('unloading reverses the shared linkage and restores the return bridge');
  walk(13, -10); walk(13, -22.5); walk(14, -23);
  until(() => game.state === 'won', 5, 'Gravity-pocket reunion');
  mark('joint exit above the original freight route');
}
