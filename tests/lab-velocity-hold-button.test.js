import test from 'node:test';
import assert from 'node:assert/strict';
import { bindVelocityHoldButton } from '../src/game/LabVelocityHoldButton.js';

class Element {
  constructor() { this.listeners = new Map(); this.hidden = false; this.captured = new Set(); }
  addEventListener(type, callback) { const callbacks = this.listeners.get(type) || new Set(); callbacks.add(callback); this.listeners.set(type, callbacks); }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
  setPointerCapture(id) { if (this.captureError) throw this.captureError; this.captured.add(id); }
  hasPointerCapture(id) { return this.captured.has(id); }
  releasePointerCapture(id) { this.captured.delete(id); this.send('lostpointercapture', id); }
  send(type, pointerId) { for (const callback of this.listeners.get(type) || []) callback({ pointerId, preventDefault() {} }); }
}
function fixture(errorName) {
  const button = new Element(), scope = new Element(), document = new Element(), input = { keys: new Set() };
  if (errorName) button.captureError = Object.assign(new Error('capture unavailable'), { name: errorName });
  let active = true;
  const binding = bindVelocityHoldButton(button, { key: 'KeyQ', getInput: () => input, isActive: () => active, scope, document });
  return { button, scope, document, input, binding, deactivate: () => { active = false; } };
}

test('touch focus remains held when pointer capture is unavailable and releases off-button', () => {
  for (const reason of ['InvalidStateError', 'NotFoundError']) {
    const f = fixture(reason);
    assert.doesNotThrow(() => f.button.send('pointerdown', 7));
    assert.equal(f.input.keys.has('KeyQ'), true);
    f.scope.send('pointerup', 19); assert.equal(f.input.keys.has('KeyQ'), true, 'another finger released focus');
    f.button.send('pointerdown', 19); f.button.send('pointerup', 19);
    assert.equal(f.input.keys.has('KeyQ'), true, 'second touch stole gesture ownership');
    f.scope.send('pointerup', 7); assert.equal(f.input.keys.has('KeyQ'), false);
    f.binding.dispose();
  }
});

test('capture cancellation, pause reset, blur and hidden pages release held focus', () => {
  for (const method of ['cancel', 'lost', 'reset', 'blur', 'hidden']) {
    const f = fixture(); f.button.send('pointerdown', 3);
    assert.equal(f.input.keys.has('KeyQ'), true);
    if (method === 'cancel') f.scope.send('pointercancel', 3);
    if (method === 'lost') f.button.send('lostpointercapture', 3);
    if (method === 'reset') f.binding.reset();
    if (method === 'blur') f.scope.send('blur');
    if (method === 'hidden') { f.document.hidden = true; f.document.send('visibilitychange'); }
    assert.equal(f.input.keys.has('KeyQ'), false, method);
    f.deactivate(); f.button.send('pointerdown', 4); assert.equal(f.input.keys.has('KeyQ'), false);
    f.binding.dispose();
  }
});

test('unexpected capture errors remain visible and disposed controls do not rearm', () => {
  const broken = fixture('TypeError');
  assert.throws(() => broken.button.send('pointerdown', 1), { name: 'TypeError' });
  assert.equal(broken.input.keys.has('KeyQ'), false); broken.binding.dispose();
  const f = fixture(); f.button.send('pointerdown', 8); f.binding.dispose();
  assert.equal(f.input.keys.has('KeyQ'), false);
  f.button.send('pointerdown', 9); assert.equal(f.input.keys.has('KeyQ'), false);
});
