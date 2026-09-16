/** Regression route for the player's 2026-09-16 video. Use with the shipped
 * runV8Journey driver and installRoom21Aim. Every action is ordinary input;
 * no actor, portal, actuator, collider or victory state is assigned here.
 * A route result is an ATTEMPT, not a proof of intended-level completion. */
export function room21AirShotAttempt(d, { targetU = 1.4, fireAfterJump = 30,
  onFrame = () => {} } = {}) {
  if (!Number.isFinite(targetU) || Math.abs(targetU) > 2.7
    || !Number.isInteger(fireAfterJump) || fireAfterJump < 0 || fireAfterJump > 60) {
    throw new RangeError('Use a finite on-face aim and a bounded jump interval');
  }
  const { game: g, level, walk, aim, look, wait, pickup, mark } = d;
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const audit = { targetU, fireAfterJump, shot: null, shortcutWon: false,
    recovered: false, initial: { braked: level.cassette.braked, height: level.cassette.height } };
  const tick = phase => { d.frame(); onFrame(phase); };
  walk(0, 13); walk(0, 8.05);
  aim(0, level.panels['shared-well'].getFrame().center.clone().setZ(7.1));
  walk(-2, 12);
  const f = level.cassette.face.getFrame();
  const target = f.center.clone().addScaledVector(f.right, targetU);
  look(target); g.input.keys.add('ShiftLeft');
  let jumpFrame = null;
  mark('air-shot / running approach begins');
  for (let n = 0; n < 200; n++) {
    const point = target.clone().project(g.camera);
    g.yaw -= clamp(point.x, -1, 1) * .18;
    g.pitch = clamp(g.pitch + clamp(point.y, -1, 1) * .17, -1.25, 1.15);
    if (jumpFrame === null && g.playerPosition.x > 1.1) {
      g.input.jumpQueued = true; jumpFrame = n;
    }
    if (jumpFrame !== null && n === jumpFrame + fireAfterJump) {
      audit.shotOrigin = g.playerPosition.toArray();
      audit.requestAccepted = g.firePortal(1);
    }
    // Unit direction: diagonal movement must not invent extra input magnitude.
    d.worldMove(Math.SQRT1_2, -Math.SQRT1_2); tick('air-shot');
  }
  d.stop(); wait(.6);
  audit.shot = g.portalShots.lastImpact;
  audit.earlyPortal = !!g.portals.portals[1];
  mark('air-shot / actual projectile result and lower-floor landing');
  // The same lower route works whether the shot was accepted or obstructed.
  walk(0, -2); walk(0, 0); walk(-17, 0); walk(-17, 17.5); walk(-10, 17.5);
  walk(g.cargo.position.x - .8, g.cargo.position.z); pickup();
  audit.recovered = g.playerPosition.y > 9.9 && !!g.heldCube;
  mark('air-shot / walk back and recover the original companion');
  if (audit.earlyPortal) {
    walk(0, 12); walk(0, 8.05);
    const before = g.teleportCount;
    for (let i = 0; i < 360 && g.playerGrounded; i++) {
      d.worldMove(0, -.15); tick('joint-flight');
    }
    d.stop();
    for (let i = 0; i < 480 && (!g.playerGrounded || g.teleportCount === before); i++) tick('joint-flight');
    if (g.teleportCount === before) throw new Error('Attempt did not actually traverse the inlet');
    audit.landing = g.playerPosition.toArray();
    mark('air-shot / actual joint flight landing');
    if (g.playerPosition.y > 17.9 && g.playerPosition.x > -2.4) {
      walk(12, -8); d.until(() => g.state === 'won', 3, 'Joint shortcut arrival');
    }
    audit.shortcutWon = g.state === 'won' && level.isWon();
  }
  audit.final = { braked: level.cassette.braked, height: level.cassette.height,
    loaded: level.state.cargoSeat.loaded(), player: g.playerPosition.toArray(), cargo: g.cargo.position.toArray() };
  return audit;
}
