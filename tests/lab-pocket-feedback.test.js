import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { pocketBrakeFeedback } from '../src/game/LabPocketFeedback.js';
import { createHeadlessGame } from '../scripts/lab-headless.mjs';

for (const braked of [true, false]) for (const loaded of [true, false]) {
  test(`feedback follows actual brake=${braked}, load=${loaded}`, () => {
    const state = Object.freeze({ braked });
    const result = pocketBrakeFeedback(state, loaded);
    assert.equal(result.key, 'E');
    assert.ok(result.text.includes(braked ? 'Тормоз зажат.' : 'Тормоз отпущен.'));
    assert.ok(result.text.includes(loaded ? 'На приёмнике есть груз.' : 'Приёмник пуст.'));
    assert.ok(result.text.endsWith(braked ? 'Отпустить тормоз.' : 'Зажать тормоз.'));
    assert.doesNotMatch(result.text, /портал|падени|перелёт|сервис|противовес|решени/i);
  });
}
test('feedback rejects missing or nonboolean state instead of inventing a status', () => {
  for (const [state, load] of [[null, false], [{}, false], [{ braked: 1 }, true], [{ braked: false }, 1]]) {
    assert.throws(() => pocketBrakeFeedback(state, load), TypeError);
  }
});

const game = await createHeadlessGame();
await game.selectLevel(20, false);
after(() => { game.physics.dispose(); game.portals.dispose(); });
function atBrake() {
  game.resetRun(true);
  // Explicit local interaction fixture, NOT a claimed level playthrough.
  game.playerPosition.set(-15.5, 4, -12.2);
  game.previousPlayerPosition.copy(game.playerPosition);
  game.playerGrounded = true;
  game.state = 'playing';
  game.externalBlocked = false;
  return game.firstLevel;
}
test('actual E action emits one switch sound and immediately updates local state text', () => {
  const level = atBrake(), before = level.cassette.height;
  const audio = game.audio, events = [];
  game.audio = { mechanism: name => events.push(name) };
  try {
    assert.match(level.getContextLesson()[2], /Тормоз зажат/);
    assert.equal(game.interact(), true);
    assert.equal(level.cassette.braked, false);
    assert.match(level.getContextLesson()[2], /Тормоз отпущен/);
    assert.equal(level.cassette.height, before);
    assert.deepEqual(events, ['switch']);
    assert.equal(game.interact(), true);
    assert.equal(level.cassette.braked, true);
    assert.deepEqual(events, ['switch', 'switch']);
  } finally { game.audio = audio; }
});
test('nearby readout uses live supported load, never a stale actuator cache or held cargo', () => {
  const level = atBrake(), seat = level.state.cargoSeat;
  game.cargo.position.copy(seat.surface.getFrame().center).y += .39;
  game.cargo.velocity.set(0, 0, 0); game.cargo.quaternion.identity();
  assert.equal(seat.loaded(), true);
  assert.equal(level.cassette.loaded, false, 'fixture deliberately precedes actuator tick');
  assert.match(level.nearbyInteraction().text, /На приёмнике есть груз/);
  game.heldCube = game.cargo;
  assert.match(level.nearbyInteraction().text, /Приёмник пуст/);
  game.heldCube = null;
  game.cargo.position.y += 1;
  assert.match(level.nearbyInteraction().text, /Приёмник пуст/);
});
test('state context takes priority over generic portal teaching only at a reachable console', () => {
  const level = atBrake();
  game.tutorial.seen.clear(); game.tutorial.feedback = null;
  assert.equal(game.tutorial.update().id, 'room21-cassette-brake');
  game.playerPosition.set(-9, 10, 13);
  assert.equal(level.getContextLesson(), null);
  assert.notEqual(game.tutorial.update()?.id, 'room21-cassette-brake');
});
test('closed geometry blocks the state prompt by the same rule as terminal interaction', () => {
  const level = atBrake();
  const obstacle = { enabled: true, box: new THREE.Box3(
    new THREE.Vector3(-16.25, 3.5, -13), new THREE.Vector3(-16.05, 6, -11.4)) };
  game.colliders.push(obstacle);
  try {
    assert.equal(level.getContextLesson(), null);
    assert.equal(level.nearbyInteraction(), null);
  } finally { game.colliders.splice(game.colliders.indexOf(obstacle), 1); }
});
test('carrying, disabled teaching and pauses keep their established priorities', () => {
  atBrake();
  game.heldCube = game.cargo;
  assert.equal(game.tutorial.update().id, 'room-put-down');
  game.heldCube = null;
  game.tutorial.enabled = false; assert.equal(game.tutorial.update(), null);
  game.tutorial.enabled = true;
  game.externalBlocked = true; assert.equal(game.tutorial.update(), null);
  game.externalBlocked = false;
  game.state = 'paused'; assert.equal(game.tutorial.update(), null);
});
test('reads and resets do not move the cassette, add geometry, duplicate cargo or play switch sounds', () => {
  const level = atBrake(), id = game.physics.cargoBody.id;
  const snapshot = () => JSON.stringify({
    height: level.cassette.height, braked: level.cassette.braked,
    player: game.playerPosition.toArray(), cargo: game.cargo.position.toArray(),
    colliders: game.colliders.map(c => [c.box.min.toArray(), c.box.max.toArray()]),
    bodies: game.physics.world.bodies.length, surfaces: game.portalPanels.length,
    roots: game.scene.children.length,
  });
  const before = snapshot();
  for (let i = 0; i < 500; i++) level.getContextLesson();
  assert.equal(snapshot(), before);
  const events = [], audio = game.audio; game.audio = { mechanism: n => events.push(n) };
  try {
    for (let i = 0; i < 8; i++) {
      level.cassette.toggleBrake(); game.resetRun(true);
      assert.equal(level.cassette.braked, true);
      assert.equal(game.physics.cargoBody.id, id);
    }
    assert.deepEqual(events, []);
  } finally { game.audio = audio; }
});
