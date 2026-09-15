import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Isolate the actual controller body from WebGL and the DOM. Vector2 and event
// targets below are explicit test doubles, not a browser/device playthrough.
const source = readFileSync(new URL('../src/game/InputController.js', import.meta.url), 'utf8');
const isolatedSource = source.replace(/^import \* as THREE from 'three';\s*/m, '')
  .replace('export class InputController', 'globalThis.InputController = class InputController');

class Vector2 {
  constructor(x = 0, y = 0) { this.set(x, y); }
  set(x, y) { this.x = x; this.y = y; return this; }
  lengthSq() { return this.x * this.x + this.y * this.y; }
  normalize() { const length = Math.sqrt(this.lengthSq()) || 1; return this.set(this.x / length, this.y / length); }
}

class Target {
  constructor() {
    this.listeners = new Map(); this.captures = new Set(); this.style = {};
    this.rect = { left: 0, top: 0, width: 100, height: 100 };
  }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  emit(type, details = {}) {
    const event = { preventDefault() {}, ...details };
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(event);
  }
  setPointerCapture(id) { this.captures.add(id); }
  hasPointerCapture(id) { return this.captures.has(id); }
  releasePointerCapture(id) {
    if (this.captures.delete(id)) this.emit('lostpointercapture', { pointerId: id });
  }
  getBoundingClientRect() { return this.rect; }
  listenerCount() { return [...this.listeners.values()].reduce((sum, listeners) => sum + listeners.size, 0); }
}

function fixture() {
  const window = new Target(), document = new Target(); document.hidden = false;
  const joystick = new Target(), joystickKnob = new Target(), jumpButton = new Target();
  const context = vm.createContext({ THREE: { Vector2 }, window, document });
  vm.runInContext(isolatedSource, context, { filename: 'InputController.js' });
  const input = new context.InputController({ joystick, joystickKnob, jumpButton });
  return { input, window, document, joystick, joystickKnob, jumpButton };
}

function startStick(f, pointerId = 1) {
  f.joystick.emit('pointerdown', { pointerId, clientX: 81, clientY: 50 });
  assert.equal(f.input.getMove().x, 1);
}
function assertNeutral(f) {
  assert.equal(f.input.getMove().lengthSq(), 0);
  assert.equal(f.input.joystickPointer, null);
  assert.equal(f.joystickKnob.style.transform, 'translate(0, 0)');
}

test('blur clears keyboard, touch movement, capture and queued one-shot input', () => {
  const f = fixture(); startStick(f);
  for (const code of ['KeyW', 'Space', 'KeyR', 'Escape']) f.window.emit('keydown', { code });
  f.window.emit('blur');
  assertNeutral(f); assert.equal(f.input.keys.size, 0); assert.equal(f.joystick.captures.size, 0);
  assert.equal(f.input.consumeJump(), false); assert.equal(f.input.consumeRestart(), false);
  assert.equal(f.input.consumePause(), false);
});

test('hiding a tab clears input even without a window blur event', () => {
  const f = fixture(); startStick(f); f.jumpButton.emit('pointerdown');
  f.document.hidden = true; f.document.emit('visibilitychange');
  assertNeutral(f); assert.equal(f.input.consumeJump(), false);
  f.document.hidden = false; f.document.emit('visibilitychange');
  assertNeutral(f);
});

test('a visible visibilitychange does not cancel active input', () => {
  const f = fixture(); startStick(f);
  f.document.emit('visibilitychange');
  assert.equal(f.input.getMove().x, 1); assert.equal(f.input.joystickPointer, 1);
});

test('lost capture ends the owning joystick without waiting for pointerup', () => {
  const f = fixture(); startStick(f);
  f.joystick.releasePointerCapture(1);
  assertNeutral(f);
  f.joystick.emit('pointermove', { pointerId: 1, clientX: 81, clientY: 50 });
  assertNeutral(f);
});

test('a second pointer cannot steal or end the first joystick pointer', () => {
  const f = fixture(); startStick(f);
  f.joystick.emit('pointerdown', { pointerId: 2, clientX: 19, clientY: 50 });
  f.joystick.emit('pointermove', { pointerId: 2, clientX: 19, clientY: 50 });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) f.joystick.emit(type, { pointerId: 2 });
  assert.equal(f.input.joystickPointer, 1); assert.equal(f.input.getMove().x, 1);
  f.joystick.emit('pointerup', { pointerId: 1 }); assertNeutral(f);
});

test('pointer cancellation is idempotent and the next touch works', () => {
  const f = fixture(); startStick(f, 0);
  f.joystick.emit('pointercancel', { pointerId: 0 });
  f.joystick.emit('pointercancel', { pointerId: 0 }); assertNeutral(f);
  startStick(f, 3); assert.equal(f.input.joystickPointer, 3);
});

test('reset safely handles reentrant lostpointercapture during release', () => {
  const f = fixture(); startStick(f);
  f.input.reset(); f.input.reset();
  assertNeutral(f); assert.equal(f.joystick.captures.size, 0);
});

test('an already expired pointer cannot interrupt the reset', () => {
  const f = fixture(); startStick(f);
  f.joystick.hasPointerCapture = undefined;
  f.joystick.releasePointerCapture = () => { const error = new Error('expired'); error.name = 'NotFoundError'; throw error; };
  assert.doesNotThrow(() => f.input.reset()); assertNeutral(f);
});

test('zero-size controls produce neutral movement instead of NaN', () => {
  const f = fixture(); f.joystick.rect.width = 0;
  f.joystick.emit('pointerdown', { pointerId: 1, clientX: 0, clientY: 50 });
  assertNeutral(f); assert.equal(f.joystick.captures.size, 0);
});

test('keyboard diagonals remain normalized and key release still works', () => {
  const f = fixture();
  f.window.emit('keydown', { code: 'KeyW' }); f.window.emit('keydown', { code: 'KeyD' });
  assert.ok(Math.abs(f.input.getMove().lengthSq() - 1) < 1e-12);
  f.window.emit('keyup', { code: 'KeyW' }); assert.equal(f.input.getMove().x, 1);
  f.window.emit('keyup', { code: 'KeyD' }); assert.equal(f.input.getMove().lengthSq(), 0);
});

test('touch jump and keyboard one-shot actions remain consumable exactly once', () => {
  const f = fixture(); f.jumpButton.emit('pointerdown');
  assert.equal(f.input.consumeJump(), true); assert.equal(f.input.consumeJump(), false);
  for (const [code, consume] of [['Space', 'consumeJump'], ['KeyR', 'consumeRestart'], ['Escape', 'consumePause']]) {
    f.window.emit('keydown', { code }); assert.equal(f.input[consume](), true);
    f.window.emit('keydown', { code, repeat: true }); assert.equal(f.input[consume](), false);
  }
});

test('dispose removes every controller listener and can be repeated', () => {
  const f = fixture(); startStick(f); f.input.dispose(); f.input.dispose();
  for (const target of [f.window, f.document, f.joystick, f.jumpButton]) assert.equal(target.listenerCount(), 0);
  f.window.emit('keydown', { code: 'KeyW' }); f.jumpButton.emit('pointerdown');
  f.joystick.emit('pointerdown', { pointerId: 2, clientX: 81, clientY: 50 });
  assertNeutral(f); assert.equal(f.input.consumeJump(), false);
});
