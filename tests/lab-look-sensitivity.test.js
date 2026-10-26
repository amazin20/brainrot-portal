import test from 'node:test';
import assert from 'node:assert/strict';
import { LabPreferences, sanitizePreferences } from '../src/game/LabPreferences.js';
import { LabControls } from '../src/game/LabControls.js';
import { CAMERA_PITCH_MIN, CAMERA_PITCH_MAX } from '../src/game/LabCamera.js';
import { createTower41PreviewPreferences } from '../src/game/LabTower41Preview.js';

class Target extends EventTarget {
  emit(type, values = {}) { const event = new Event(type); Object.assign(event, values); this.dispatchEvent(event); }
  setPointerCapture() {}
}
function fixture(sensitivity) {
  const canvas = new Target(), scope = new Target(), doc = new Target();
  const game = { renderer: { domElement: canvas }, state: 'playing', lookSensitivity: sensitivity, yaw: 0, pitch: 0 };
  doc.pointerLockElement = canvas;
  const controls = new LabControls(game, { scope, document: doc });
  return { canvas, scope, doc, game, controls };
}
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`);

test('sensitivity migrates old saves at the original response and bounds corrupt values', () => {
  for (const value of [undefined, null, NaN, Infinity, '2']) assert.equal(sanitizePreferences({ lookSensitivity: value }).lookSensitivity, 1);
  assert.equal(sanitizePreferences({ lookSensitivity: -100 }).lookSensitivity, .25);
  assert.equal(sanitizePreferences({ lookSensitivity: 100 }).lookSensitivity, 2);
  assert.equal(sanitizePreferences({ lookSensitivity: .65 }).lookSensitivity, .65);
});

test('a changed sensitivity survives reload without changing progress, hints or audio', () => {
  const data = new Map(), storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
  const preferences = new LabPreferences(storage);
  preferences.save({ completed: [0, 3, 8], hints: { 3: 2 }, volume: .35, muted: true, resumeLevel: 8 });
  preferences.save({ lookSensitivity: 1.55 });
  const reloaded = new LabPreferences(storage);
  assert.deepEqual(reloaded.value, preferences.value);
  assert.equal(reloaded.value.lookSensitivity, 1.55);
  assert.deepEqual(reloaded.value.completed, [0, 3, 8]);
  assert.deepEqual(reloaded.value.hints, { 3: 2 });
  assert.equal(reloaded.value.volume, .35); assert.equal(reloaded.value.muted, true);
});

test('isolated physical previews inherit sensitivity as a personal setting without importing progress', () => {
  const key = 'brainrot-foundation-v1:brainrot-portal.preferences.v24';
  const previous = JSON.stringify({ lookSensitivity: 1.4, completed: [0, 40], hints: { 40: 3 }, resumeLevel: 40 });
  const data = new Map([[key, previous]]), storage = { getItem: k => data.get(k), setItem: (k, value) => data.set(k, value) };
  const preview = createTower41PreviewPreferences(storage);
  assert.equal(preview.value.lookSensitivity, 1.4);
  assert.deepEqual(preview.value.completed, []); assert.deepEqual(preview.value.hints, {}); assert.equal(preview.value.resumeLevel, null);
  assert.equal(data.get(key), previous);
  preview.save({ lookSensitivity: .6 });
  assert.equal(createTower41PreviewPreferences(storage).value.lookSensitivity, .6);
  assert.equal(data.get(key), previous);
});

test('mouse and touch retain their own original rates and apply the same saved multiplier', () => {
  for (const sensitivity of [undefined, .25, 1, 1.55, 2]) {
    const f = fixture(sensitivity), multiplier = sensitivity ?? 1;
    f.scope.emit('mousemove', { movementX: 40, movementY: 20 });
    close(f.game.yaw, -.08 * multiplier); close(f.game.pitch, -.036 * multiplier);
    f.game.yaw = f.game.pitch = 0;
    f.canvas.emit('pointerdown', { pointerType: 'touch', pointerId: 1, clientX: 100, clientY: 100 });
    f.canvas.emit('pointermove', { pointerId: 1, clientX: 140, clientY: 120 });
    close(f.game.yaw, -.2 * multiplier); close(f.game.pitch, -.08 * multiplier);
    f.controls.dispose();
  }
});

test('a sensitivity change applies to the next gesture delta without a jump or stale drag', () => {
  const f = fixture(1);
  f.canvas.emit('pointerdown', { pointerType: 'touch', pointerId: 1, clientX: 100, clientY: 100 });
  f.canvas.emit('pointermove', { pointerId: 1, clientX: 120, clientY: 110 });
  f.game.lookSensitivity = .5;
  close(f.game.yaw, -.1); close(f.game.pitch, -.04);
  f.canvas.emit('pointermove', { pointerId: 1, clientX: 140, clientY: 120 });
  close(f.game.yaw, -.15); close(f.game.pitch, -.06);
  f.canvas.emit('pointerup', { pointerId: 1 });
  f.canvas.emit('pointermove', { pointerId: 1, clientX: 2000, clientY: 2000 });
  close(f.game.yaw, -.15); close(f.game.pitch, -.06);
  f.controls.dispose();
});

test('sensitivity never bypasses pitch bounds or pause and external hold gates', () => {
  const f = fixture(2);
  f.scope.emit('mousemove', { movementX: 0, movementY: 10000 }); assert.equal(f.game.pitch, CAMERA_PITCH_MIN);
  f.scope.emit('mousemove', { movementX: 0, movementY: -10000 }); assert.equal(f.game.pitch, CAMERA_PITCH_MAX);
  for (const hold of ['paused', 'external']) {
    f.game.state = hold === 'paused' ? 'paused' : 'playing'; f.game.externalBlocked = hold === 'external';
    f.scope.emit('mousemove', { movementX: 100, movementY: 100 });
    f.canvas.emit('pointerdown', { pointerType: 'touch', pointerId: 1, clientX: 100, clientY: 100 });
    f.canvas.emit('pointermove', { pointerId: 1, clientX: 500, clientY: 500 });
    assert.equal(f.game.yaw, 0); assert.equal(f.game.pitch, CAMERA_PITCH_MAX);
  }
  f.controls.dispose();
});
