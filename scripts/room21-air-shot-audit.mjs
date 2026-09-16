import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHeadlessGame } from './lab-headless.mjs';
import { runV8Journey } from '../src/game/LabV8Journey.js';
import { installRoom21Aim } from '../src/game/LabRoom21Journey.js';
import { room21AirShotAttempt } from './room21-air-shot-scenario.mjs';
const game = await createHeadlessGame(); await game.selectLevel(20, false);
const out = process.env.EVIDENCE_OUT || 'smoke-artifacts/room21-air-shot';
fs.mkdirSync(out, { recursive: true });
const expectBlocked = process.env.EXPECT_BLOCKED !== '0';
const report = { commit: process.env.BUILD_COMMIT || null, expectBlocked, pass: false,
  scope: 'Ordinary-input attempts inspired by the supplied clip, from a clean start. Not an exact reconstruction of its unknown preceding state or exhaustive shortcut search.', cases: [] };
try {
  for (const targetU of [.7, 1.4, 2]) {
    let attempt;
    const route = await runV8Journey(game, { scenario: d => {
      installRoom21Aim(d); attempt = room21AirShotAttempt(d, { targetU });
    } });
    report.cases.push({ attempt, route });
    assert.equal(attempt.earlyPortal, !expectBlocked);
    assert.equal(attempt.shortcutWon, !expectBlocked);
    assert.equal(attempt.recovered, true);
    assert.equal(attempt.final.braked, true);
    assert.equal(attempt.final.height, game.firstLevel.cassette.high);
    assert.equal(attempt.final.loaded, false);
    assert.equal(route.resets + route.respawns, 0);
    console.log(JSON.stringify({ targetU, shot: attempt.shot?.reason, shortcutWon: attempt.shortcutWon, frames: route.frames }));
  }
  report.pass = true;
} finally {
  fs.writeFileSync(`${out}/attempts.json`, JSON.stringify(report, null, 2));
  game.physics.dispose(); game.portals.dispose();
}
