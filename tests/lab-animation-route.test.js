import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createHeadlessGame } from '../scripts/lab-headless.mjs';
import { runAnimationJourney } from '../src/game/LabAnimationJourney.js';

const game = await createHeadlessGame();
after(() => { game.physics.dispose(); game.portals.dispose(); });

test('ordinary player and held-friend jump routes preserve physics across render sampling rates', async () => {
  await game.selectLevel(8, false);
  for (const carrying of [false, true]) {
    let reference;
    for (const fps of [30, 60, 120, 144]) {
      const { route, motion } = await runAnimationJourney(game, { carrying, fps });
      assert.ok(route.pass && route.resets === 0 && route.respawns === 0);
      assert.equal(motion.physicsSteps, 384);
      assert.equal(motion.jumps, 1); assert.equal(motion.landings, 1);
      assert.ok(motion.finalGrounded && motion.maxHeight > 1);
      assert.ok(motion.phases.includes('jump') && motion.phases.includes('fall') && motion.phases.includes('landing'));
      if (carrying) assert.ok(motion.maxGripError < 1e-7);
      reference ||= motion;
      assert.deepEqual(motion.final, reference.final);
      assert.equal(motion.maxHeight, reference.maxHeight);
    }
  }
});
