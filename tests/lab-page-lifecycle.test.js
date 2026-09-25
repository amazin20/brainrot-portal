import test from 'node:test';
import assert from 'node:assert/strict';
import { holdInterruptedGame, settleInterruptedGame } from '../src/game/LabPageLifecycle.js';

test('losing focus pauses before the external lock and returning never resumes implicitly', () => {
  const cargo = { id: 'the original companion' };
  const locks = new Set(), events = [];
  const game = { state: 'playing', externalBlocked: false, cargo,
    togglePause(force) {
      assert.equal(force, true);
      assert.equal(this.externalBlocked, false, 'pause must precede the external input lock');
      this.state = 'paused'; events.push('pause');
    },
  };
  const hold = (reason, active) => {
    active ? locks.add(reason) : locks.delete(reason);
    game.externalBlocked = locks.size > 0;
    events.push(`${reason}:${active}`);
  };

  holdInterruptedGame(game, hold, 'focus');
  holdInterruptedGame(game, hold, 'hidden');
  assert.deepEqual(events, ['pause', 'focus:true', 'hidden:true']);
  hold('focus', false);
  assert.equal(game.externalBlocked, true, 'visibility remains locked after focus returns');
  hold('hidden', false);
  assert.equal(game.state, 'paused', 'the player chooses when to resume');
  assert.equal(game.cargo, cargo);
  assert.deepEqual([...locks], []);
});

test('an already open SDK modal retains its own lock and a page interruption cannot override it', () => {
  const locks = new Set(['ad']), events = [];
  const game = { state: 'playing', externalBlocked: true,
    togglePause() { events.push('pause'); },
  };
  const hold = (reason, active) => {
    active ? locks.add(reason) : locks.delete(reason);
    game.externalBlocked = locks.size > 0;
  };
  holdInterruptedGame(game, hold, 'page');
  hold('page', false);
  assert.deepEqual([...locks], ['ad']);
  assert.deepEqual(events, []);
});

test('a hidden tab cannot start playing when an SDK advert closes before the player returns', () => {
  const locks = new Set(['ad']);
  let pendingPause = false, pauses = 0;
  const game = { state: 'playing', externalBlocked: true,
    togglePause(force) {
      assert.equal(force, true);
      assert.equal(this.externalBlocked, false);
      this.state = 'paused'; pauses++;
    },
  };
  const hold = (reason, active, deferPause = false) => {
    pendingPause ||= deferPause;
    active ? locks.add(reason) : locks.delete(reason);
    game.externalBlocked = locks.size > 0;
    if (!active) pendingPause = settleInterruptedGame(game, game.externalBlocked, pendingPause);
  };
  holdInterruptedGame(game, hold, 'hidden');
  hold('ad', false);
  assert.equal(game.externalBlocked, true);
  assert.equal(game.state, 'playing', 'a hidden ad cannot open a visible pause menu yet');
  hold('hidden', false);
  assert.equal(game.state, 'paused');
  assert.equal(pauses, 1);
});
