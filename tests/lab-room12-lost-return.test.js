import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runRoom12} from '../src/game/LabPortalRoom12.js';

const game = await createHeadlessGame();
after(() => { game.physics.dispose(); game.portals.dispose(); });

test('room 12 recovers a lost court-return portal through a second physical fall and completes the level', async () => {
  await game.selectLevel(11, false);
  const report = await runV8Journey(game, {scenario: async d => {
    const reached = Symbol('far exit placed');
    let ready = false;
    try {
      await runRoom12({...d, mark(name) {
        if (name === 'the airborne angle exposes the final exit') { ready = true; throw reached; }
      }});
    } catch (error) {
      if (error !== reached) throw error;
    }
    assert.ok(ready);

    // Miss the normal return using ordinary air movement, then walk into it
    // without the stored falling speed. This really reaches the enclosed bay.
    for (let n = 0; n < 90 && !game.playerGrounded; n++) { d.worldMove(1, 0); d.frame(); }
    d.stop();
    d.until(() => game.playerGrounded, 3, 'Land beside the court return');
    assert.ok(game.playerPosition.y < .1);
    d.walk(7, 7); d.walk(4, 7);
    const lowEntry = game.teleportCount;
    for (let n = 0; n < 180 && game.teleportCount === lowEntry; n++) { d.worldMove(0, -.3); d.frame(); }
    d.stop();
    assert.equal(game.teleportCount, lowEntry + 1);
    assert.ok(game.lastPortalTravel.speed < 10);
    d.until(() => game.playerGrounded, 4, 'The low-energy flight reaches the bay floor');
    assert.ok(game.playerPosition.y < .1 && game.playerPosition.z < 0);
    assert.ok(game.cargo.position.y > 11.9);

    // Deliberately spend the court portal, the opposite colour from the usual
    // recovery. Both portals are now inside the bay; no external pair survives.
    const farPortal = game.portals.portals[0];
    d.aim(1, new THREE.Vector3(16.5, .025, -12.3));
    assert.equal(game.portals.portals[0], farPortal);
    assert.ok(game.portals.portals[1].position.z < 0);
    const returnPoint = game.portals.portals[1].position.clone();
    d.walk(17.1, -17); d.walk(17.1, -15);
    const loopStart = game.teleportCount;
    for (let n = 0; n < 180 && game.teleportCount === loopStart; n++) { d.worldMove(0, .3); d.frame(); }
    d.stop();
    assert.equal(game.teleportCount, loopStart + 1);
    const firstSpeed = game.lastPortalTravel.speed;

    // Brake the first low-speed wall exit backward, so its real fall lands in
    // the offset floor portal. The second exit inherits the gained speed.
    for (let n = 0; n < 420; n++) {
      if (game.teleportCount === loopStart + 1) {
        const p = game.playerPosition, velocity = game.playerVelocity;
        d.worldMove(THREE.MathUtils.clamp((returnPoint.x - p.x) * 1.8 - velocity.x * 1.2, -1, 1), -1);
      } else d.stop();
      d.frame();
      if (game.playerGrounded && game.playerPosition.z > 0 && game.playerPosition.y > 11.9) break;
    }
    assert.equal(game.teleportCount, loopStart + 2);
    assert.ok(game.lastPortalTravel.speed > firstSpeed + 15, 'The second fall must supply the escape energy');
    assert.ok(game.playerPosition.z > 0 && game.playerPosition.y > 11.9,
      'The original player must physically cross the front of the launch bay');
    d.walk(17, 6);
    d.until(() => game.playerGrounded && Math.abs(game.playerPosition.y - 12) < .1, 3, 'Receiving deck');
    d.walk(game.cargo.position.x - 1.1, game.cargo.position.z);
    d.pickup();
    d.walk(21, 21);
    d.until(() => game.state === 'won', 3, 'Both original travellers complete the alternative route');
  }});
  assert.equal(report.pass, true);
  assert.equal(report.teleports, 6);
  assert.equal(report.resets + report.respawns, 0);
  assert.equal(game.state, 'won');
});
