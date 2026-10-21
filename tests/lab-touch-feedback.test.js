import test from 'node:test';
import assert from 'node:assert/strict';
import { bindTouchFeedback, touchButtonContent } from '../src/game/LabTouchPresentation.js';

// Exercise the production presentation module with explicit event/DOM doubles.
// These tests verify pointer bookkeeping, not a physical-phone playthrough.
class Target {
  constructor() { this.listeners = new Map(); this.attributes = new Map(); }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  emit(type, pointerId) {
    for (const listener of [...this.listeners.get(type) ?? []]) listener({ pointerId });
  }
}

function fixture() {
  const scope = new Target(), blue = new Target(), amber = new Target(), jump = new Target();
  const owner = {
    active: true,
    listeners: [],
    listen(target, type, listener) {
      target.addEventListener(type, listener);
      this.listeners.push({ target, type, listener });
    },
    dispose() {
      for (const { target, type, listener } of this.listeners) target.removeEventListener(type, listener);
    },
  };
  const feedback = bindTouchFeedback(owner, [blue, amber, jump], scope);
  const pressed = target => target.getAttribute('data-pressed') === 'true';
  return { scope, blue, amber, jump, owner, feedback, pressed };
}

test('different fingers keep portal and jump feedback independent through bubbled releases', () => {
  const f = fixture();
  f.blue.emit('pointerdown', 0); f.amber.emit('pointerdown', 7); f.jump.emit('pointerdown', 9);
  assert.ok(f.pressed(f.blue) && f.pressed(f.amber) && f.pressed(f.jump));
  f.amber.emit('pointerup', 7); f.scope.emit('pointerup', 7);
  assert.equal(f.pressed(f.amber), false);
  assert.ok(f.pressed(f.blue) && f.pressed(f.jump));
  f.scope.emit('pointerup', 0);
  assert.equal(f.pressed(f.blue), false); assert.equal(f.pressed(f.jump), true);
  f.jump.emit('pointerup', 9); f.scope.emit('pointerup', 9);
  assert.equal(f.pressed(f.jump), false);
});

test('two fingers on one button retain feedback until both end', () => {
  const f = fixture();
  f.blue.emit('pointerdown', 1); f.blue.emit('pointerdown', 2);
  f.blue.emit('pointerup', 1);
  assert.equal(f.pressed(f.blue), true);
  f.scope.emit('pointercancel', 2);
  assert.equal(f.pressed(f.blue), false);
});

for (const ending of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  test(`${ending} removes its owner's feedback and ignores a foreign pointer`, () => {
    const f = fixture();
    f.blue.emit('pointerdown', 1); f.jump.emit('pointerdown', 2);
    f.blue.emit(ending, 50);
    assert.ok(f.pressed(f.blue) && f.pressed(f.jump));
    f.blue.emit(ending, 1);
    assert.equal(f.pressed(f.blue), false); assert.equal(f.pressed(f.jump), true);
    f.blue.emit(ending, 1);
    assert.equal(f.pressed(f.jump), true);
  });
}

test('an outside pointer cancellation releases only its button', () => {
  const f = fixture();
  f.blue.emit('pointerdown', 1); f.jump.emit('pointerdown', 2);
  f.scope.emit('pointercancel', 1);
  assert.equal(f.pressed(f.blue), false); assert.equal(f.pressed(f.jump), true);
});

test('blur clears all feedback and the next gesture works', () => {
  const f = fixture();
  f.blue.emit('pointerdown', 1); f.amber.emit('pointerdown', 2); f.jump.emit('pointerdown', 3);
  f.scope.emit('blur');
  for (const target of [f.blue, f.amber, f.jump]) assert.equal(f.pressed(target), false);
  f.scope.emit('pointerup', 1); f.blue.emit('pointerdown', 4);
  assert.equal(f.pressed(f.blue), true);
});

test('pause reset clears old owners and inactive controls never show new feedback', () => {
  const f = fixture();
  f.blue.emit('pointerdown', 1); f.jump.emit('pointerdown', 2);
  f.owner.active = false; f.feedback.reset(); f.feedback.reset();
  f.amber.emit('pointerdown', 3);
  for (const target of [f.blue, f.amber, f.jump]) assert.equal(f.pressed(target), false);
  f.owner.active = true;
  f.blue.emit('pointerdown', 1);
  f.scope.emit('pointerup', 2);
  assert.equal(f.pressed(f.blue), true);
  f.blue.emit('pointerup', 1);
  assert.equal(f.pressed(f.blue), false);
});

test('feedback listeners belong to the control owner and stop after disposal', () => {
  const f = fixture();
  f.feedback.reset(); f.owner.dispose();
  f.blue.emit('pointerdown', 1); f.jump.emit('pointerdown', 2);
  assert.equal(f.pressed(f.blue), false); assert.equal(f.pressed(f.jump), false);
  for (const target of [f.scope, f.blue, f.amber, f.jump]) {
    assert.equal([...target.listeners.values()].reduce((sum, listeners) => sum + listeners.size, 0), 0);
  }
});

test('button illustrations stay decorative so the parent button supplies one accessible action name', () => {
  for (const kind of ['portal', 'interact', 'pause', 'jump', 'sprint']) {
    const content = touchButtonContent(kind, 'Действие', kind === 'portal' ? '1' : '');
    assert.match(content, /^<svg\b[^>]*aria-hidden="true"[^>]*focusable="false"/);
    assert.match(content, /<span class="touch-label" aria-hidden="true">Действие<\/span>$/);
    assert.doesNotMatch(content, /<(?:button|a|input)\b|tabindex|<title\b/);
    if (kind === 'portal') assert.match(content, /<span class="touch-channel" aria-hidden="true">1<\/span>/);
  }
  assert.throws(() => touchButtonContent('unknown', 'Действие'), /Unknown touch icon/);
});
