const check = (condition, message) => { if (!condition) throw new Error(message); };
export function room21Climb(d) {
  const { walk, mark } = d;
  walk(-19.2, 14); walk(-19.2, -5.5); walk(-15.2, -5.5);
  walk(-15.2, 5); walk(-15.2, 14); walk(-10, 14);
  mark('high source reached through the independent observation gallery');
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
  aim(1, level.panels['rising-out'].getFrame().center);
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
  if (order === 'scout-first') {
    room21Climb(d); d.mark('upper route inspected while cargo remains on the starting balcony');
    d.walk(-15.2, 14); d.walk(-15.2, 5); d.walk(-15.2, -5.5); d.walk(-19.2, -5.5); d.walk(-19.2, 14);
  }
  room21Freight(d);
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
  walk(11, -7); aim(1, level.panels['receiving-return'].getFrame().center);
  walk(11.5, -2.6);
  aim(0, game.cargo.position.clone().setY(level.panels['freight-cradle'].getFrame().center.y));
  until(() => game.cargo.position.y > 12, 6, 'Original cargo did not reach the permanent niche');
  mark('new line of sight releases the same cargo and restores the guard');
  wait(1.5); walk(game.cargo.position.x + 1, game.cargo.position.z); pickup();
  walk(14, -5); until(() => game.state === 'won', 5, 'Gravity-pocket reunion');
  mark('joint exit above the original freight route');
}
