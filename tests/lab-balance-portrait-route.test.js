import test from 'node:test';
import assert from 'node:assert/strict';
import { createHeadlessGame } from '../scripts/lab-headless.mjs';
import { runV8Journey } from '../src/game/LabV8Journey.js';

// Real uploaded meshes, production shoulder camera, swept shots and physics.
// The route supplies ordinary movement/look/interact/clear inputs only.
const game = await createHeadlessGame();
game.chamberEdition = 'foundation';

for (const [name, aspect] of [['portrait', 390 / 844], ['wide', 16 / 9]]) {
  test(`room 7 ${name} retrieves the original friend through clear camera sightlines`, { timeout: 180000 }, async () => {
    game.camera.aspect = aspect;
    game.camera.updateProjectionMatrix();
    await game.selectLevel(6, false);
    const body = game.physics.cargoBody, shape = body.shapes[0], cargo = game.cargo.group;
    const shots = game.portalShots, captures = [], impacts = [], closures = [];
    const captureTarget = shots.captureTarget, impact = shots.impact, clearPortals = game.clearPortals;
    shots.captureTarget = function (index) {
      const point = captureTarget.call(this, index);
      captures.push({ index, object: this.firstHit()?.object, point: point.clone() });
      return point;
    };
    shots.impact = function (...args) {
      const result = impact.apply(this, args);
      impacts.push({ ...this.lastImpact });
      return result;
    };
    game.clearPortals = function (...args) {
      closures.push({ playerY: this.playerPosition.y, cargoY: this.cargo.position.y });
      return clearPortals.apply(this, args);
    };
    try {
      const report = await runV8Journey(game);
      assert.equal(report.pass, true);
      assert.equal(game.state, 'won');
      assert.equal(report.respawns, 0);
      assert.equal(report.resets, 0);
      assert.equal(game.cargo.group, cargo);
      assert.equal(game.physics.cargoBody, body);
      assert.equal(body.shapes[0], shape);
      assert.equal(captures.length, 4);
      assert.equal(captures[2].object, game.firstLevel.panels['lever-receiver'].mesh,
        'Receiver click must see its real floor, rather than the dock guard');
      assert.equal(captures[3].object, game.firstLevel.panels['lever-load'].mesh,
        'Lower-tray click must see the moving tray, rather than the upper floor');
      assert.equal(impacts.length, 4);
      assert.ok(impacts.every(hit => hit.valid && hit.reason === 'placed'));
      assert.equal(closures.length, 1);
      assert.ok(closures[0].playerY >= 8.2 && closures[0].cargoY > 8.6,
        'Close the pair only after the original friend has physically exited above the dock');
    } finally {
      shots.captureTarget = captureTarget;
      shots.impact = impact;
      game.clearPortals = clearPortals;
    }
  });
}

test.after(() => { game.firstLevel.dispose(); game.physics.dispose(); game.portals.dispose(); });
