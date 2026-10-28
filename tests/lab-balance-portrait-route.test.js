import test from 'node:test';
import assert from 'node:assert/strict';
import { createHeadlessGame } from '../scripts/lab-headless.mjs';
import { runV8Journey } from '../src/game/LabV8Journey.js';

// Real uploaded meshes, production shoulder camera, swept shots and physics.
// The route supplies ordinary movement/look/interact inputs only; pair deletion is unavailable.
const game = await createHeadlessGame();
game.chamberEdition = 'foundation';

for (const [name, aspect] of [['portrait', 390 / 844], ['wide', 16 / 9]]) {
  test(`room 7 ${name} retrieves the original friend through clear camera sightlines`, { timeout: 180000 }, async () => {
    game.camera.aspect = aspect;
    game.camera.updateProjectionMatrix();
    await game.selectLevel(6, true);
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
      throw new Error('Pair deletion is not an ordinary player action');
    };
    try {
      const report = await runV8Journey(game,{journeyOptions:{nativeStart:true}});
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
      assert.equal(closures.length, 0);
      assert.equal(game.portals.ready,true,'The real retrieval pair must remain open');
      assert.equal(game.portals.portals[0].surfaceId,game.firstLevel.panels['lever-load'].mesh.uuid);
      assert.equal(game.portals.portals[1].surfaceId,game.firstLevel.panels['lever-receiver'].mesh.uuid);
      assert.ok(report.milestones.some(m=>m.name==='retrieved the original friend through the load tray'&&m.cargo[1]>8.6));
    } finally {
      shots.captureTarget = captureTarget;
      shots.impact = impact;
      game.clearPortals = clearPortals;
    }
  });
}

test.after(() => { game.firstLevel.dispose(); game.physics.dispose(); game.portals.dispose(); });
