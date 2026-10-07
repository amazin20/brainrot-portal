import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  sameSnapshotGeometry,
  targetReachable,
  assertMatrix,
  nativeActivate,
} from '../scripts/lib/unified-public-input.mjs';

const clone = value => structuredClone(value);
const rectangle = (left = 80, top = 100, width = 60, height = 52) => ({
  left, top, right: left + width, bottom: top + height, width, height,
});
function snapshot(overrides = {}) {
  return {
    rect: rectangle(),
    clips: [{id: 'menu', ...rectangle(0, 0, 390, 844), clipX: true, clipY: true}],
    scrolls: [{id: 'menu', top: 0, left: 0}],
    viewport: {width: 390, height: 844},
    hit: true,
    visible: true,
    focused: true,
    hidden: false,
    pointerLocked: false,
    externalPause: false,
    inert: false,
    disabled: false,
    opacity: 1,
    scrollAction: null,
    ...overrides,
  };
}

function fakePage({measure, snapshots, wheelEffect, swipeEffect, trust = {trusted: true, target: true}} = {}) {
  const events = [], samples = [], state = {top: 0, left: 0, now: 0};
  let measures = 0, armed = false, activated = false;
  const record = (type, data = {}) => events.push({type, ...data, time: state.now});
  const page = {
    async bringToFront() { record('bringToFront'); },
    mouse: {
      async move(x, y) { record('mouseMove', {x, y}); },
      async wheel(delta) { record('wheel', delta); wheelEffect?.(delta, state); },
      async click(x, y) { assert.ok(armed, 'Trust listener must precede the click'); record('click', {x, y}); activated = true; },
    },
    touchscreen: {
      async touchStart(x, y) {
        record('touchStart', {x, y});
        let endX = x, endY = y;
        return {
          async move(nextX, nextY) { endX = nextX; endY = nextY; record('touchMove', {x: nextX, y: nextY}); },
          async end() { record('touchEnd'); swipeEffect?.({startX: x, startY: y, endX, endY}, state); },
        };
      },
      async tap(x, y) { assert.ok(armed, 'Trust listener must precede the tap'); record('tap', {x, y}); activated = true; },
    },
  };
  const options = {
    async wait(milliseconds) { assert.ok(milliseconds >= 0); record('wait', {milliseconds}); state.now += milliseconds; },
    async measure() {
      const index = measures++;
      const value = measure ? measure(index, state) : snapshots?.[Math.min(index, snapshots.length - 1)] ?? snapshot();
      const fresh = clone(value);
      samples.push({snapshot: fresh, time: state.now}); record('measure', {index}); return fresh;
    },
    async armTrust() { assert.equal(armed, false, 'Trust evidence must be armed once'); armed = true; record('armTrust'); },
    async readTrust() { assert.ok(activated, 'Trust evidence must follow native activation'); record('readTrust'); return clone(trust); },
    async onEvidence(value) { record('evidence', {value}); },
  };
  return {page, options, events, samples, state};
}

const nativeEvents = fixture => fixture.events.filter(event => ['click', 'tap'].includes(event.type));
const scrollIntent = (axis = 'y') => ({id: 'menu', x: 150, y: 400, axis, direction: 1, distance: 200});
const inaccessible = state => snapshot({
  rect: rectangle(80, 1000, 60, 52),
  scrolls: [{id: 'menu', top: state.top, left: state.left}],
  scrollAction: scrollIntent(),
});

test('input helper never uses DOM scrolling or programmatic DOM activation', () => {
  const source = fs.readFileSync(new URL('../scripts/lib/unified-public-input.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\.scrollIntoView\s*\(/);
  assert.doesNotMatch(source, /\.scroll(?:Top|Left)\s*(?:=(?!=)|\+=|-=|\+\+|--)/);
  assert.doesNotMatch(source, /\.dispatchEvent\s*\(/);
});

test('geometry equality permits only the configured quarter-pixel tolerance', () => {
  const first = snapshot(), within = clone(first), beyond = clone(first);
  for (const key of ['left', 'right', 'top', 'bottom']) within.rect[key] += .25;
  beyond.rect.left += .251;
  assert.equal(sameSnapshotGeometry(first, clone(first)), true);
  assert.equal(sameSnapshotGeometry(first, within), true);
  assert.equal(sameSnapshotGeometry(first, beyond), false);
  assert.equal(sameSnapshotGeometry(first, beyond, .3), true);
});

for (const [name, mutate] of [
  ['target dimensions', value => { value.rect.width += 1; }],
  ['ancestor clipping coordinates', value => { value.clips[0].top += 1; }],
  ['ancestor clipping axes', value => { value.clips[0].clipY = false; }],
  ['ancestor identity', value => { value.clips[0].id = 'other-menu'; }],
  ['actual vertical scroll position', value => { value.scrolls[0].top += 1; }],
  ['actual horizontal scroll position', value => { value.scrolls[0].left += 1; }],
  ['scroll container identity', value => { value.scrolls[0].id = 'other-menu'; }],
  ['viewport size', value => { value.viewport.height += 1; }],
]) {
  test(`geometry stability rejects drifting ${name}`, () => {
    const first = snapshot(), changed = clone(first); mutate(changed);
    assert.equal(sameSnapshotGeometry(first, changed), false);
  });
}

test('reachability accepts a fully visible, unobstructed 44 by 44 target', () => {
  assert.equal(targetReachable(snapshot({rect: rectangle(80, 100, 44, 44)})), true);
});

for (const [name, change] of [
  ['width below 44px', {rect: rectangle(80, 100, 43.99, 52)}],
  ['height below 44px', {rect: rectangle(80, 100, 60, 43.99)}],
  ['viewport clipping', {rect: rectangle(370, 100, 60, 52)}],
  ['ancestor clipping', {clips: [{id: 'menu', ...rectangle(0, 0, 100, 844), clipX: true, clipY: true}]}],
  ['obstructed center', {hit: false}],
  ['CSS invisibility', {visible: false}],
  ['hidden document', {hidden: true}],
  ['unfocused document', {focused: false}],
  ['pointer lock', {pointerLocked: true}],
  ['external pause', {externalPause: true}],
  ['inert target', {inert: true}],
  ['disabled target', {disabled: true}],
  ['transparent target', {opacity: 0}],
]) {
  test(`reachability rejects ${name}`, () => assert.equal(targetReachable(snapshot(change)), false));
}

test('desktop activation requires four stable samples spaced by 100ms and a fresh final check', async () => {
  const fixture = fakePage();
  await nativeActivate(fixture.page, '#play', false, fixture.options);
  assert.equal(fixture.samples.length, 5, 'Four stable samples and a final fresh sample');
  for (let index = 1; index < 4; index++) {
    assert.ok(fixture.samples[index].time - fixture.samples[index - 1].time >= 100);
  }
  assert.equal(nativeEvents(fixture).length, 1);
  assert.equal(nativeEvents(fixture)[0].type, 'click');
  assert.equal(fixture.events.filter(event => event.type === 'wheel').length, 0);
  const types = fixture.events.map(event => event.type);
  assert.ok(types.lastIndexOf('measure') < types.indexOf('click'));
  assert.ok(types.indexOf('armTrust') < types.indexOf('click'));
  assert.ok(types.indexOf('click') < types.indexOf('readTrust'));
});

test('touch activation taps only after the same fresh reachability check', async () => {
  const fixture = fakePage();
  await nativeActivate(fixture.page, '#play', true, fixture.options);
  assert.equal(fixture.samples.length, 5);
  assert.deepEqual(nativeEvents(fixture).map(event => event.type), ['tap']);
});

for (const [name, fresh] of [
  ['obstruction', snapshot({hit: false})],
  ['ancestor clipping', snapshot({clips: [{id: 'menu', ...rectangle(0, 0, 100, 844), clipX: true, clipY: true}]})],
  ['undersized target', snapshot({rect: rectangle(80, 100, 43, 52)})],
  ['target drift', snapshot({rect: rectangle(81, 100, 60, 52)})],
  ['lost focus', snapshot({focused: false})],
]) {
  test(`fresh final measurement rejects ${name} without native activation`, async () => {
    const fixture = fakePage({snapshots: [snapshot(), snapshot(), snapshot(), snapshot(), fresh]});
    await assert.rejects(nativeActivate(fixture.page, '#play', false, fixture.options));
    assert.deepEqual(nativeEvents(fixture), []);
  });
}

for (const [name, measure] of [
  ['cumulative sub-tolerance target drift', index => snapshot({rect: rectangle(80 + index * .2, 100, 60, 52)})],
  ['scroll position drift', index => snapshot({scrolls: [{id: 'menu', top: index, left: 0}]})],
  ['clip rectangle drift', index => snapshot({clips: [{id: 'menu', ...rectangle(0, index, 390, 844), clipX: true, clipY: true}]})],
]) {
  test(`four-sample stability rejects ${name} before clicking`, async () => {
    const fixture = fakePage({measure});
    fixture.options.maxStabilityMeasurements = 8;
    await assert.rejects(nativeActivate(fixture.page, '#play', false, fixture.options));
    assert.deepEqual(nativeEvents(fixture), []);
    assert.equal(fixture.samples.length, 8, 'Stability search must honor the bounded measurement budget');
  });
}

test('desktop scroll uses native wheel and verifies the measured scrollTop before clicking', async () => {
  const fixture = fakePage({
    wheelEffect: (delta, state) => { state.top += delta.deltaY; },
    measure: (index, state) => snapshot({
      rect: rectangle(80, 900 - state.top, 60, 52),
      scrolls: [{id: 'menu', top: state.top, left: 0}],
      scrollAction: state.top ? null : scrollIntent(),
    }),
  });
  await nativeActivate(fixture.page, '#play', false, fixture.options);
  assert.equal(fixture.events.filter(event => event.type === 'wheel').length, 1);
  assert.ok(fixture.state.top > .25);
  assert.equal(nativeEvents(fixture).length, 1);
});

test('touch scroll uses exactly eight native moves per swipe and measured scrollTop changes', async () => {
  const fixture = fakePage({
    swipeEffect: (gesture, state) => { state.top += gesture.startY - gesture.endY; },
    measure: (index, state) => snapshot({
      rect: rectangle(80, 900 - state.top, 60, 52),
      scrolls: [{id: 'menu', top: state.top, left: 0}],
      scrollAction: state.top ? null : scrollIntent(),
    }),
  });
  await nativeActivate(fixture.page, '#play', true, fixture.options);
  assert.equal(fixture.events.filter(event => event.type === 'touchStart').length, 1);
  assert.equal(fixture.events.filter(event => event.type === 'touchMove').length, 8);
  assert.equal(fixture.events.filter(event => event.type === 'touchEnd').length, 1);
  assert.ok(fixture.state.top > .25);
  assert.deepEqual(nativeEvents(fixture).map(event => event.type), ['tap']);
});

for (const touch of [false, true]) {
  test(`${touch ? 'touch' : 'desktop'} requires scroll movement in the intended container`, async () => {
    const fixture = fakePage({
      wheelEffect: (delta, state) => { state.top += 200; },
      swipeEffect: (gesture, state) => { state.top += 200; },
      measure: (index, state) => snapshot({
        rect: state.top ? rectangle() : rectangle(80, 1000, 60, 52),
        scrolls: [{id: 'menu', top: 0, left: 0}, {id: 'unrelated', top: state.top, left: 0}],
        scrollAction: state.top ? null : scrollIntent(),
      }),
    });
    await assert.rejects(nativeActivate(fixture.page, '#play', touch, fixture.options));
    assert.deepEqual(nativeEvents(fixture), []);
    assert.equal(fixture.events.filter(event => event.type === (touch ? 'touchStart' : 'wheel')).length, 1);
  });

  test(`${touch ? 'touch' : 'desktop'} horizontal scrolling verifies scrollLeft on the requested axis`, async () => {
    const fixture = fakePage({
      wheelEffect: (delta, state) => { state.left += delta.deltaX; },
      swipeEffect: (gesture, state) => { state.left += gesture.startX - gesture.endX; },
      measure: (index, state) => snapshot({
        rect: rectangle(420 - state.left, 100, 60, 52),
        scrolls: [{id: 'menu', top: 0, left: state.left}],
        scrollAction: state.left ? null : scrollIntent('x'),
      }),
    });
    await nativeActivate(fixture.page, '#play', touch, fixture.options);
    assert.ok(fixture.state.left > .25);
    assert.equal(nativeEvents(fixture).length, 1);
    if (touch) assert.equal(fixture.events.filter(event => event.type === 'touchMove').length, 8);
  });

  test(`${touch ? 'touch' : 'desktop'} rejects motion on the wrong scroll axis`, async () => {
    const fixture = fakePage({
      wheelEffect: (delta, state) => { state.left += 200; },
      swipeEffect: (gesture, state) => { state.left += 200; },
      measure: (index, state) => inaccessible(state),
    });
    await assert.rejects(nativeActivate(fixture.page, '#play', touch, fixture.options));
    assert.deepEqual(nativeEvents(fixture), []);
  });

  test(`${touch ? 'touch' : 'desktop'} rejects scroll motion equal to the .25px tolerance`, async () => {
    const fixture = fakePage({
      wheelEffect: (delta, state) => { state.top += .25; },
      swipeEffect: (gesture, state) => { state.top += .25; },
      measure: (index, state) => inaccessible(state),
    });
    await assert.rejects(nativeActivate(fixture.page, '#play', touch, fixture.options));
    assert.deepEqual(nativeEvents(fixture), []);
  });
}

for (const touch of [false, true]) {
  test(`${touch ? 'touch' : 'desktop'} rejects scroll intent when measured scrollTop does not change`, async () => {
    const fixture = fakePage({measure: (index, state) => inaccessible(state)});
    await assert.rejects(nativeActivate(fixture.page, '#play', touch, fixture.options));
    assert.deepEqual(nativeEvents(fixture), []);
    assert.equal(fixture.events.filter(event => event.type === (touch ? 'touchStart' : 'wheel')).length, 1);
    if (touch) assert.equal(fixture.events.filter(event => event.type === 'touchMove').length, 8);
  });

  test(`${touch ? 'touch' : 'desktop'} exhausts at exactly twenty native scroll attempts`, async () => {
    const fixture = fakePage({
      wheelEffect: (delta, state) => { state.top += delta.deltaY; },
      swipeEffect: (gesture, state) => { state.top += gesture.startY - gesture.endY; },
      measure: (index, state) => inaccessible(state),
    });
    await assert.rejects(nativeActivate(fixture.page, '#play', touch, fixture.options));
    assert.deepEqual(nativeEvents(fixture), []);
    assert.equal(fixture.events.filter(event => event.type === (touch ? 'touchStart' : 'wheel')).length, 20);
    if (touch) {
      assert.equal(fixture.events.filter(event => event.type === 'touchMove').length, 160);
      assert.equal(fixture.events.filter(event => event.type === 'touchEnd').length, 20);
    }
  });
}

for (const [name, trust] of [
  ['synthetic click', {trusted: false, target: true}],
  ['different target', {trusted: true, target: false}],
]) {
  test(`activation rejects ${name} trust evidence`, async () => {
    const fixture = fakePage({trust});
    await assert.rejects(nativeActivate(fixture.page, '#play', false, fixture.options));
    assert.equal(nativeEvents(fixture).length, 1);
    assert.equal(fixture.events.filter(event => event.type === 'readTrust').length, 1);
  });
}

const root = new URL('https://example.test/game/');
const chapter = new URL('chapter-atlas/', root);
function completeMatrix() {
  return [root, chapter].flatMap(base => [1, 17, 33, 41, 51].flatMap(level => [
    {width: 1280, height: 800, touch: false},
    {width: 390, height: 844, touch: true},
    {width: 736, height: 414, touch: true},
  ].map(viewport => ({
    level, url: new URL('?level=' + level, base).href, ...viewport,
    pauseRestartResumeReturnPlay: true, reloadAndReplay: true, nativeTrustedPlay: true,
  }))));
}

test('matrix requires all five rooms, both public URLs and all three viewports', () => {
  const rows = completeMatrix();
  assert.equal(rows.length, 30);
  assert.doesNotThrow(() => assertMatrix(rows, {root, chapter}));
});

for (const [name, mutate] of [
  ['missing run', rows => rows.pop()],
  ['duplicated run replacing another run', rows => { rows[29] = clone(rows[28]); }],
  ['unrequested room', rows => { rows[0].level = 2; }],
  ['wrong viewport', rows => { rows[0].width = 1279; }],
  ['wrong touch capability', rows => { rows[1].touch = false; }],
  ['different origin', rows => { rows[0].url = 'https://other.test/game/?level=1'; }],
  ['wrong public path', rows => { rows[0].url = 'https://example.test/game-preview/?level=1'; }],
  ['missing pause/restart proof', rows => { rows[0].pauseRestartResumeReturnPlay = false; }],
  ['missing replay proof', rows => { rows[0].reloadAndReplay = false; }],
  ['missing trusted native play proof', rows => { rows[0].nativeTrustedPlay = false; }],
]) {
  test(`matrix rejects ${name}`, () => {
    const rows = completeMatrix(); mutate(rows);
    assert.throws(() => assertMatrix(rows, {root, chapter}));
  });
}
