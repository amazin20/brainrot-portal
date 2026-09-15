const check = (condition, message) => { if (!condition) throw new Error(message); };
export function room21Climb(d) {
  const { walk, mark } = d;
  walk(-34,15.5); walk(-34,-5.5); walk(-30,-5.5);
  walk(-30,5);walk(-30,14);walk(-10,14);
  check(d.game.playerPosition.y>17.9,'High source not reached');
  mark('high source reached across the physically docked bridge');
}
export function room21PrepareSource(d) {
  const { level, walk, aim, until, mark } = d, p=level.panels;
  walk(0,14); aim(0,p['drive-intake'].getFrame().center);
  aim(1,p['drive-out'].getFrame().center);
  until(()=>level.state.sourceDrive.latched,20,'Air-driven bridge did not dock');
  mark('airflow docked the source bridge; the physical pawl retains height');
}
export function room21RestoreWell(d) {
  const {walk,aim,level}=d;
  walk(0,14);walk(0,-1);walk(-6,-1);walk(-6,5);
  aim(0,level.panels['shared-drop'].getFrame().center.clone().setZ(10.8));
  walk(-6,-1);walk(0,-1);walk(0,14);
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
  check(['cargo-first','source-first','scout-first'].includes(order),'Unknown order');
  if(order!=='cargo-first') { room21PrepareSource(d);room21Freight(d); }
  else { room21Freight(d);room21PrepareSource(d); }
  room21RestoreWell(d);
  if(recovery) {
    const {game,level,walk,aim,frame,worldMove,stop,until,mark}=d;
    walk(-10,11.65);aim(1,level.panels['rising-out'].getFrame().center);
    const before=game.teleportCount;
    for(let n=0;n<300&&game.playerGrounded;n++){worldMove(0,-.12);frame();}
    stop();until(()=>game.teleportCount>before,4,'Short fall missed');
    game.clearPortals();mark('short attempt with both portals erased after transfer');
    until(()=>game.playerGrounded,8,'No safe lower return');
    check(game.state==='playing'&&level.state.freightGuard.loaded,'Preparation lost on miss');
    check(level.state.sourceDrive.latched,'Source latch lost on miss');
    mark('failed flight lands safely; both independent preparations remain');
    d.walk(-6,-1);d.walk(-6,5);d.aim(0,level.panels['shared-drop'].getFrame().center.clone().setZ(10.8));
    d.walk(-6,-1);d.walk(0,-1);d.walk(0,14);
  }
  room21Climb(d);room21Fling(d,{launchOffset});
  const {game,level,walk,aim,until,pickup,mark,wait,frame,worldMove,stop}=d;
  // This is the first permanent dock, not the finish. Only its service side
  // reveals the white face that turns the next fall toward the high north dock.
  walk(19,-7);walk(19,-15);
  aim(1,level.panels['second-rise'].getFrame().center);
  check(game.portalShots.lastImpact.surface==='second-rise / collision','Wrong final surface');
  mark('service-side view prepares a different trajectory through the same shaft');
  walk(19,-4);walk(18.5,4);walk(game.cargo.position.x+1,game.cargo.position.z);
  pickup();mark('same friend retrieved by the service descent; original guard closes');
  walk(18.5,4);walk(19,12);wait(1);
  until(()=>game.playerGrounded&&game.playerPosition.y<1,5,'Freight return court not reached');
  walk(18,22.8);walk(2.9,22.8);walk(2.9,-1);walk(0,-1);walk(0,14);
  check(level.state.sourceDrive.latched,'Returning pair lost the retained source bridge');
  check(level.state.freightGuard.progress<.01,'Original guard should close after unloading');
  room21Climb(d);walk(-10+launchOffset,11.65);
  const before=game.teleportCount;
  for(let n=0;n<300&&game.playerGrounded;n++){worldMove(0,-.12);frame();}
  stop();until(()=>game.teleportCount>before,5,'Second well entry missed');
  mark('second high fall transports both through the reconfigured portal pair');
  until(()=>game.playerGrounded,8,'Final catch dock missed');
  check(game.playerPosition.y>19.9,'Incorrect final height '+game.playerPosition.toArray());
  walk(32,-34);until(()=>game.state==='won',3,'Joint final arrival');
  mark('both at final dock after physically reusing the central well');
}
