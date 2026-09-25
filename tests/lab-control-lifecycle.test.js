import test from 'node:test';
import assert from 'node:assert/strict';
import { InputController } from '../src/game/InputController.js';
import { LabGame } from '../src/game/LabGame.js';

// Real game methods and real Three vectors; explicit event/capture doubles.
// The separate browser scenario verifies actual DOM and multi-touch dispatch.
class Target {
  constructor() { this.listeners = new Map(); this.captures = new Set(); this.style = {}; }
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
  }
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
  emit(type, event = {}) {
    for (const fn of [...this.listeners.get(type) ?? []]) fn({ preventDefault() {}, ...event });
  }
  count() { return [...this.listeners.values()].reduce((n, set) => n + set.size, 0); }
  setPointerCapture(id) { this.captures.add(id); }
  hasPointerCapture(id) { return this.captures.has(id); }
  releasePointerCapture(id) { if (this.captures.delete(id)) this.emit('lostpointercapture', { pointerId: id }); }
  getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; }
}
function fixture(t) {
  const oldWindow = globalThis.window, oldDocument = globalThis.document;
  const scope = new Target(), doc = new Target(), canvas = new Target();
  const joystick = new Target(), joystickKnob = new Target(), jumpButton = new Target();
  globalThis.window = scope; globalThis.document = doc;
  doc.hidden = false; doc.exitPointerLock = () => { doc.pointerLockElement = null; };
  canvas.requestPointerLock = () => { doc.pointerLockElement = canvas; };
  const game = new LabGame({ container: null, touch: { joystick, joystickKnob, jumpButton } });
  game.renderer = { domElement: canvas }; game.state = 'playing';
  game.input = new InputController({ ...game.touch, isActive: () => game.state === 'playing' && !game.externalBlocked });
  const shots = [], celebrations = [], cancellations = [];
  game.firePortal = index => shots.push(index);
  game.animator = { trigger: name => celebrations.push(name) };
  game.portalShots = { cancelBuffered: reason => cancellations.push(reason) };
  game.setupControls();
  t.after(() => {
    game.disposeControls();
    if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow;
    if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument;
  });
  const look = (type, id, x = 100, y = 100) => canvas.emit(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y });
  return { game, scope, doc, canvas, joystick, joystickKnob, jumpButton, shots, celebrations, cancellations, look };
}

test('first look finger survives a second finger, its movement, and its release', t => {
  const f = fixture(t); f.look('pointerdown', 1);
  f.look('pointermove', 1, 120); assert.equal(f.game.yaw, -.1);
  f.look('pointerdown', 2, 400); f.look('pointermove', 2, 500);
  assert.equal(f.game.controls.lookPointer.id, 1); assert.equal(f.game.yaw, -.1);
  f.look('pointerup', 2); f.look('pointermove', 1, 160);
  assert.ok(Math.abs(f.game.yaw + .3) < 1e-12);
  assert.equal(f.canvas.captures.size, 1);
});

for (const ending of ['pointercancel', 'lostpointercapture']) test(`${ending} cancels only its owner and requires a fresh gesture`, t => {
  const f = fixture(t); f.look('pointerdown', 1); f.look(ending, 2);
  assert.equal(f.game.controls.lookPointer.id, 1);
  f.look(ending, 1); f.look('pointermove', 1, 900);
  assert.equal(f.game.yaw, 0); assert.equal(f.game.controls.lookPointer, null);
  f.look('pointerdown', 3, 800); f.look('pointermove', 3, 820);
  assert.equal(f.game.yaw, -.1);
});

test('external pause rejects mouse, touch, action, celebration, joystick and jump input', t => {
  const f = fixture(t); f.doc.pointerLockElement = f.canvas;
  f.game.externalBlocked = true;
  f.scope.emit('mousemove', { movementX: 100, movementY: 50 });
  f.look('pointerdown', 1); f.look('pointermove', 1, 900);
  f.canvas.emit('pointerdown', { button: 0, pointerType: 'mouse' });
  for (const code of ['KeyE', 'KeyV', 'KeyW', 'Space']) f.scope.emit('keydown', { code });
  f.joystick.emit('pointerdown', { pointerId: 2, clientX: 81, clientY: 50 });
  f.jumpButton.emit('pointerdown');
  assert.equal(f.game.yaw, 0); assert.equal(f.game.interactQueued, false);
  assert.deepEqual(f.shots, []); assert.deepEqual(f.celebrations, []);
  assert.equal(f.game.input.getMove().lengthSq(), 0); assert.equal(f.game.input.consumeJump(), false);
  assert.equal(f.game.controls.lookPointer, null); assert.equal(f.game.input.joystickPointer, null);
});

test('menu pause releases both captures and queued commands without deleting physical velocity', t => {
  const f = fixture(t); f.look('pointerdown', 1);
  f.joystick.emit('pointerdown', { pointerId: 2, clientX: 81, clientY: 50 });
  f.scope.emit('keydown', { code: 'Space' }); f.scope.emit('keydown', { code: 'KeyE' });
  f.game.jumpBuffer = .12; f.game.playerVelocity.set(2, 9, -3);
  f.game.togglePause(true);
  assert.equal(f.game.state, 'paused'); assert.equal(f.game.controls.lookPointer, null);
  assert.equal(f.game.input.joystickPointer, null); assert.equal(f.game.input.consumeJump(), false);
  assert.equal(f.game.interactQueued, false); assert.equal(f.game.jumpBuffer, 0);
  assert.deepEqual(f.game.playerVelocity.toArray(), [2, 9, -3]);
  assert.equal(f.canvas.captures.size + f.joystick.captures.size, 0);
  assert.deepEqual(f.cancellations, ['paused']);
  f.game.togglePause(false);
  f.look('pointermove', 1, 1000);
  f.joystick.emit('pointermove', { pointerId: 2, clientX: 81, clientY: 50 });
  assert.equal(f.game.yaw, 0); assert.equal(f.game.input.getMove().lengthSq(), 0);
});

test('blocked drag is discarded even when externalBlocked is set without a menu callback', t => {
  const f = fixture(t); f.look('pointerdown', 1);
  f.game.externalBlocked = true; f.look('pointermove', 1, 700);
  f.game.externalBlocked = false; f.look('pointermove', 1, 800);
  assert.equal(f.game.yaw, 0); assert.equal(f.game.controls.lookPointer, null);
});

test('held keyboard repeat cannot resurrect movement or jump after a pause', t => {
  const f = fixture(t); f.scope.emit('keydown', { code: 'KeyW' });
  assert.equal(f.game.input.getMove().y, -1);
  f.game.togglePause(true); f.game.togglePause(false);
  f.scope.emit('keydown', { code: 'KeyW', repeat: true });
  f.scope.emit('keydown', { code: 'Space', repeat: true });
  assert.equal(f.game.input.getMove().lengthSq(), 0); assert.equal(f.game.input.consumeJump(), false);
  f.scope.emit('keyup', { code: 'KeyW' }); f.scope.emit('keydown', { code: 'KeyW' });
  assert.equal(f.game.input.getMove().y, -1);
});

test('a fresh jump still queues exactly one action after resume', t => {
  const f = fixture(t); f.game.togglePause(true); f.jumpButton.emit('pointerdown');
  f.game.togglePause(false); assert.equal(f.game.input.consumeJump(), false);
  f.jumpButton.emit('pointerdown'); assert.equal(f.game.input.consumeJump(), true);
  assert.equal(f.game.input.consumeJump(), false);
});

test('focus/visibility loss cancels action and look as well as movement', t => {
  const f = fixture(t);
  for (const event of ['blur', 'visibilitychange']) {
    f.game.state = 'playing'; f.look('pointerdown', 1);
    f.scope.emit('keydown', { code: 'KeyE' });
    if (event === 'blur') f.scope.emit(event); else { f.doc.hidden = true; f.doc.emit(event); }
    assert.equal(f.game.state, 'paused'); assert.equal(f.game.controls.lookPointer, null);
    assert.equal(f.game.interactQueued, false);
  }
});

test('mouse sensitivity and portal button mapping stay unchanged; shooting does not move camera', t => {
  const f = fixture(t); f.doc.pointerLockElement = f.canvas;
  f.scope.emit('mousemove', { movementX: 50, movementY: 10 });
  assert.equal(f.game.yaw, -.1); assert.ok(Math.abs(f.game.pitch + .168) < 1e-12);
  for (const button of [0, 2]) f.canvas.emit('pointerdown', { pointerType: 'mouse', button });
  assert.deepEqual(f.shots, [0, 1]); assert.equal(f.game.yaw, -.1); assert.ok(Math.abs(f.game.pitch + .168) < 1e-12);
});

test('pointer-lock cursor recenter does not swing the camera, while the first real move still works', t => {
  const f = fixture(t);
  f.scope.emit('mousemove', { movementX: 289, movementY: 571, timeStamp: 1000 });
  f.doc.pointerLockElement = f.canvas;
  f.doc.emit('pointerlockchange', { timeStamp: 1002 });
  f.scope.emit('mousemove', { movementX: -289, movementY: -571, timeStamp: 1003 });
  assert.equal(f.game.yaw, 0); assert.equal(f.game.pitch, -.15);
  f.scope.emit('mousemove', { movementX: 15, movementY: -8, timeStamp: 1004 });
  assert.equal(f.game.yaw, -.03);
  assert.ok(Math.abs(f.game.pitch + .1356) < 1e-12);

  f.doc.pointerLockElement = null;
  f.doc.emit('pointerlockchange', { timeStamp: 2000 });
  f.scope.emit('mousemove', { movementX: 10, movementY: 10, timeStamp: 2001 });
  f.doc.pointerLockElement = f.canvas;
  f.doc.emit('pointerlockchange', { timeStamp: 2002 });
  f.scope.emit('mousemove', { movementX: 3, movementY: 2, timeStamp: 2003 });
  assert.equal(f.game.yaw, -.036);
  assert.ok(Math.abs(f.game.pitch + .1392) < 1e-12);
});

test('ending an uncaptured gesture outside the canvas still releases it', t => {
  const f = fixture(t); f.canvas.setPointerCapture = undefined;
  f.look('pointerdown', 1); f.scope.emit('pointerup', { pointerId: 1 });
  assert.equal(f.game.controls.lookPointer, null);
});

test('failed browser capture leaves no poisoned pointer owner', t => {
  const f = fixture(t);
  f.canvas.setPointerCapture = () => { const e = new Error('pointer ended'); e.name = 'NotFoundError'; throw e; };
  assert.doesNotThrow(() => f.look('pointerdown', 1)); assert.equal(f.game.controls.lookPointer, null);
  f.joystick.setPointerCapture = f.canvas.setPointerCapture;
  assert.doesNotThrow(() => f.joystick.emit('pointerdown', { pointerId: 2, clientX: 81, clientY: 50 }));
  assert.equal(f.game.input.joystickPointer, null); assert.equal(f.game.input.getMove().lengthSq(), 0);
});

test('reinstalling controls does not duplicate actions; final teardown is idempotent', t => {
  const f = fixture(t); const count = f.scope.count() + f.canvas.count() + f.doc.count();
  f.game.setupControls(); assert.equal(f.scope.count() + f.canvas.count() + f.doc.count(), count);
  f.scope.emit('keydown', { code: 'KeyV' }); assert.equal(f.celebrations.length, 1);
  f.look('pointerdown', 1); f.game.disposeControls(); f.game.disposeControls();
  for (const target of [f.scope, f.canvas, f.doc, f.joystick, f.jumpButton]) assert.equal(target.count(), 0);
  f.scope.emit('keydown', { code: 'KeyV' }); assert.equal(f.celebrations.length, 1);
  assert.equal(f.canvas.captures.size, 0);
});

test('mobile portal, interaction and pause buttons keep exactly one handler after controls are reinstalled', t => {
  const f = fixture(t), buttons = Array.from({ length: 4 }, () => new Target());
  let interactions = 0;
  f.game.interact = () => { interactions++; return true; };
  f.game.mobileActionButtons = [
    { button: buttons[0], action: () => f.game.firePortal(0) },
    { button: buttons[1], action: () => f.game.firePortal(1) },
    { button: buttons[2], action: () => f.game.interact() },
    { button: buttons[3], action: () => f.game.togglePause(true) },
  ];
  f.game.setupControls();
  for (const button of buttons.slice(0, 3)) button.emit('pointerdown');
  assert.deepEqual(f.shots, [0, 1]); assert.equal(interactions, 1);

  f.game.setupControls();
  for (const button of buttons.slice(0, 3)) button.emit('pointerdown');
  assert.deepEqual(f.shots, [0, 1, 0, 1]); assert.equal(interactions, 2);
  buttons[3].emit('pointerdown'); assert.equal(f.game.state, 'paused');
  for (const button of buttons) button.emit('pointerdown');
  assert.deepEqual(f.shots, [0, 1, 0, 1]); assert.equal(interactions, 2);
  f.game.togglePause(false); f.game.disposeControls();
  for (const button of buttons) assert.equal(button.count(), 0);
});

for (const stop of ['won', 'external']) test(`fixed-step loop stops immediately after ${stop} instead of executing more gameplay`, t => {
  const f = fixture(t); let steps = 0;
  f.game.updatePlaying = () => { steps++; if (stop === 'won') f.game.state = 'won'; else f.game.externalBlocked = true; };
  f.game.updateVisuals = () => {}; f.game.render = () => {};
  f.game.lastFrame = 0; f.game.animate(100);
  assert.equal(steps, 1);
});
