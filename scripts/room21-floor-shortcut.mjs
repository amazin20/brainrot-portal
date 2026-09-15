import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as THREE from 'three';
import { createHeadlessGame } from './lab-headless.mjs';
import { runV8Journey } from '../src/game/LabV8Journey.js';
import { room21Climb } from '../src/game/LabRoom21Journey.js';
import { CAMERA_PITCH_MIN, CAMERA_PITCH_MAX } from '../src/game/LabCamera.js';

// Acceptance probe, NOT a production movement restriction. Default expectation
// is that the demonstrated shortcut is absent; v37 intentionally fails it.
// --expect=reproduced confirms the original defect before redesigning the room.
const expected = process.argv.find(a => a.startsWith('--expect='))?.slice(9) ?? 'blocked';
assert.ok(['blocked', 'reproduced'].includes(expected), 'Use --expect=blocked or --expect=reproduced');
const output = process.argv.find(a => a.startsWith('--out='))?.slice(6) ?? 'qa/room21-floor-shortcut.json';
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const report = {
  sourceCommit: process.env.BUILD_COMMIT ?? null,
  scope: 'Node production physics and source models; ordinary movement, aiming, shots and carrying. Not a pixel-identical replay of the user recording, WebGL evidence, human solving time or a device benchmark.',
  expected, shots: [], maxGuardProgress: 0, guardEverLoaded: false, peakPlayerY: 0,
  sourceHashes: Object.fromEntries(['src/game/LabPortalRoom21.js', 'src/game/LabGame.js', 'src/game/LabPortals.js', 'src/game/LabV8Journey.js', 'scripts/room21-floor-shortcut.mjs'].map(file => [file, sha(fs.readFileSync(file))])),
};
let game;
try {
  game = await createHeadlessGame();
  await game.selectLevel(20, false);
  const update = game.updatePlaying;
  game.updatePlaying = function(dt) {
    const result = update.call(this, dt), guard = this.firstLevel.state.freightGuard;
    report.maxGuardProgress = Math.max(report.maxGuardProgress, guard.progress);
    report.guardEverLoaded ||= guard.loaded;
    report.peakPlayerY = Math.max(report.peakPlayerY, this.playerPosition.y);
    return result;
  };
  report.route = await runV8Journey(game, { scenario: d => {
    const aimLikePlayer = (index, point, surface) => {
      d.stop();
      // Use the real player's pitch range. The old route driver's narrower
      // -1.15 limit does not cover all downward views available to a human.
      for (let n = 0; n < 480; n++) {
        game.scene.updateMatrixWorld(true);
        if (point.clone().sub(game.camera.position).dot(game.camera.getWorldDirection(new THREE.Vector3())) < 0) {
          game.yaw += .18; d.frame(); continue;
        }
        const ndc = point.clone().project(game.camera);
        if (n > 20 && Math.abs(ndc.x) < .006 && Math.abs(ndc.y) < .006) break;
        game.yaw -= THREE.MathUtils.clamp(ndc.x, -1, 1) * .22;
        game.pitch = THREE.MathUtils.clamp(game.pitch + THREE.MathUtils.clamp(ndc.y, -1, 1) * .19,
          CAMERA_PITCH_MIN, CAMERA_PITCH_MAX);
        d.frame();
      }
      assert.ok(game.firePortal(index), 'Shot request rejected');
      d.until(() => !game.portalShots.queue.length && !game.portalShots.active.length, 2, 'Shot completion');
      report.shots.push({ ...game.portalShots.lastImpact });
      assert.ok(game.portalShots.lastImpact?.valid, 'Target shot rejected');
      assert.equal(game.portalShots.lastImpact.surface, surface, 'A valid shot on the wrong surface is not the intended experiment');
    };
    // Safe ordinary access establishes the bottom entry; no actor is repositioned.
    d.walk(0, 14); d.walk(0, -1); d.walk(-6, -1); d.walk(-6, 5);
    d.aim(0, game.firstLevel.panels['shared-drop'].getFrame().center.clone().setZ(10.8));
    assert.equal(game.portalShots.lastImpact.surface, 'shared-drop / collision');
    report.shots.push({ ...game.portalShots.lastImpact });
    d.walk(-6, -1); d.walk(0, -1); d.walk(0, 14); d.walk(-10, 11.65);
    aimLikePlayer(1, new THREE.Vector3(10.4, 7.38, 1.8), 'freight-cradle / collision');
    d.mark('receiving cradle is reachable by a shot before any cargo preparation');
    d.walk(game.cargo.position.x + 1, game.cargo.position.z); d.pickup();
    room21Climb(d); d.walk(-10, 11.65); d.wait(.4);
    const before = game.teleportCount;
    for (let n = 0; n < 300 && game.playerGrounded; n++) { d.worldMove(0, -.12); d.frame(); }
    d.until(() => game.teleportCount > before, 5, 'Floor transfer');
    d.mark('carried pair exits directly from the empty cradle');
    // Ordinary airborne steering; no velocity, body position or win flag writes.
    for (let n = 0; n < 550 && game.state === 'playing'; n++) {
      const dx = 14 - game.playerPosition.x, dz = -5 - game.playerPosition.z;
      const length = Math.max(1, Math.hypot(dx, dz));
      d.worldMove(dx / length, dz / length); d.frame();
    }
    d.mark('end of shortcut attempt');
  } });
  report.final = { state: game.state, player: game.playerPosition.toArray(), cargo: game.cargo.position.toArray(),
    held: Boolean(game.heldCube), jointGoal: game.firstLevel.isWon(), teleports: game.teleportCount };
  // runV8Journey.scenario calls return pass for completed experiments even if
  // there was no victory. Here victory is checked explicitly and separately.
  report.shortcutReproduced = game.state === 'won' && game.firstLevel.isWon()
    && game.teleportCount === 1 && report.route.resets === 0 && report.route.respawns === 0
    && report.maxGuardProgress === 0 && !report.guardEverLoaded;
  report.acceptancePass = !report.shortcutReproduced;
  assert.equal(report.shortcutReproduced, expected === 'reproduced', 'Room21 bypass acceptance failed');
} catch (error) {
  // Unexpected fixture errors must never masquerade as proof the bypass is fixed.
  report.error = error.stack; process.exitCode = 1;
} finally {
  game?.physics.dispose(); game?.portals.dispose();
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ expected, shortcutReproduced: report.shortcutReproduced,
    acceptancePass: report.acceptancePass, output, error: report.error ?? null }, null, 2));
}
