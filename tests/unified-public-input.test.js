import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  sameSnapshotGeometry,
  targetReachable,
  assertMatrix,
  nativeActivate,
  nativeRoomSector,
  selectNativeMapRoom,
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
// Exact accepted L menu source: LabCampaignThemes.js at 8d2c01e,
// SHA-256 a062c274ef590ec0c25e09aaa7b23b4961508d2026ab638246f82526f5222a8e.
// Public labels are emitted by LabCampaignMenu.js from these real ranges.
const acceptedTabs=[
 {sector:'0',label:'Лаборатория открытия, комнаты 1–10'},
 {sector:'1',label:'Медный энергоблок, комнаты 11–20'},
 {sector:'2',label:'Биосфера, комнаты 21–30'},
 {sector:'3',label:'Ночная обсерватория, комнаты 31–40'},
 {sector:'4',label:'Золотой разлом, комнаты 41–50'},
 {sector:'5',label:'За горизонтом, комнаты 51–51'},
];
function nativeMapModel(touch=false){
 const state={sector:0,selected:1},inputs=[];
 const page={
  async $$eval(selector){assert.equal(selector,'.sector-tabs [data-sector]');return clone(acceptedTabs);},
  async $eval(selector){
   if(selector==='#level-select')return state.selected-1;
   const level=Number(selector.match(/data-level="(\d+)"/)?.[1]);assert.equal(level,state.selected);return 'true';
  },
 };
 const activate=async selector=>{
  const sector=selector.match(/data-sector="(\d+)"/),room=selector.match(/data-level="(\d+)"/);
  const exists=!!sector||(!!room&&nativeRoomSector(acceptedTabs,Number(room[1]))===state.sector);
  const fixture=fakePage({measure:()=>snapshot(exists?{}:{rect:null,visible:false,hit:false})});
  const input=touch?'tap':'click',click=touch?fixture.page.touchscreen.tap:fixture.page.mouse.click;
  const handle=touch?fixture.page.touchscreen:fixture.page.mouse;
  handle[input]=async(...args)=>{await click(...args);if(sector)state.sector=Number(sector[1]);else state.selected=Number(room[1]);};
  inputs.push({selector,fixture});return nativeActivate(fixture.page,selector,touch,fixture.options);
 };
 return {page,activate,state,inputs};
}

test('public sector labels cover all 51 actual L room memberships, including 41–50 and the separate epilogue',()=>{
 const expected=[...Array(10).fill(0),...Array(10).fill(1),...Array(10).fill(2),...Array(10).fill(3),...Array(10).fill(4),5];
 expected.forEach((sector,index)=>assert.equal(nativeRoomSector(acceptedTabs,index+1),sector));
 // Old archive layout is also resolved from its public labels without a
 // special room>=42 formula leaking into the current menu.
 const archive=clone(acceptedTabs);archive[4].label='Складчатый замок, комнаты 41–41';archive[5].label='За пределами, комнаты 42–51';
 assert.equal(nativeRoomSector(archive,46),5);assert.equal(nativeRoomSector(acceptedTabs,46),4);
});
for(const room of [42,46,47,50,51])test(`native map selects actual room ${room} through its public sector and genuine stable input`,async()=>{
 const model=nativeMapModel();const result=await selectNativeMapRoom(model.page,room,model.activate);
 assert.equal(model.state.selected,room);assert.equal(result.sector,room===51?5:4);
 assert.equal(model.inputs.length,2);
 for(const {fixture} of model.inputs){assert.equal(nativeEvents(fixture).length,1);assert.equal(fixture.samples.length,5);for(let i=1;i<4;i++)assert.ok(fixture.samples[i].time-fixture.samples[i-1].time>=100);}
});
test('touch map uses the same actual room46 membership and stable trusted tap protocol',async()=>{
 const model=nativeMapModel(true);await selectNativeMapRoom(model.page,46,model.activate);
 assert.equal(model.state.selected,46);assert.deepEqual(model.inputs.flatMap(({fixture})=>nativeEvents(fixture).map(event=>event.type)),['tap','tap']);
});
test('actual failed PRE sequence selects epilogue then correctly refuses its absent room46 target',async()=>{
 const model=nativeMapModel();await model.activate('.sector-tabs [data-sector="5"]');
 await assert.rejects(model.activate('.room-node[data-level="46"]'),/four stable 100 ms geometry measurements/);
 assert.equal(model.state.sector,5);assert.equal(model.state.selected,1);
 assert.equal(model.inputs[1].fixture.samples.length,80);assert.deepEqual(nativeEvents(model.inputs[1].fixture),[]);
});
test('native map resolver rejects invalid room inputs before any native activation',async()=>{
 for(const room of [0,52,-1,1.5,NaN,'46']){
  const model=nativeMapModel();await assert.rejects(selectNativeMapRoom(model.page,room,model.activate));assert.deepEqual(model.inputs,[]);
 }
});
test('native map requires a unique labelled sector rather than guessing missing or overlapping public ranges',()=>{
 assert.throws(()=>nativeRoomSector(acceptedTabs.slice(0,4),46));
 const ambiguous=clone(acceptedTabs);ambiguous[5].label='Другой сектор, комнаты 46–51';assert.throws(()=>nativeRoomSector(ambiguous,46));
 const missing=clone(acceptedTabs);delete missing[4].label;assert.throws(()=>nativeRoomSector(missing,46));
 const duplicate=clone(acceptedTabs);duplicate[5].sector='4';assert.throws(()=>nativeRoomSector(duplicate,46));
});
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
  return [root, chapter].flatMap(base => [1, 17, 33, 41, 46, 47, 50, 51].flatMap(level => [
    {width: 1280, height: 800, touch: false},
    {width: 390, height: 844, touch: true},
    {width: 736, height: 414, touch: true},
  ].map(viewport => ({
    level, url: new URL('?level=' + level, base).href, ...viewport,
    selectedThroughMap: true, pauseRestartResumeReturnPlay: true, reloadAndReplay: true, nativeTrustedPlay: true,
  }))));
}

test('matrix requires all eight rooms, both public URLs and all three viewports', () => {
  const rows = completeMatrix();
  assert.equal(rows.length, 48);
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

for(const shard of ['root','chapter'])test(`exact ${shard} shard accepts 24 cases and rejects foreign cases`,()=>{
 const rows=completeMatrix().filter(row=>new URL(row.url).pathname.endsWith('/chapter-atlas/')===(shard==='chapter'));
 const options={root,chapter,routeKeys:[shard]};
 assert.equal(rows.length,24);assert.equal(assertMatrix(rows,options).verified,24);
 assert.throws(()=>assertMatrix(rows.slice(1),options));
 const foreign=completeMatrix().filter(row=>new URL(row.url).pathname.endsWith('/chapter-atlas/')!==(shard==='chapter'));
 assert.throws(()=>assertMatrix(foreign,options));
});
test('matrix rejects unknown, repeated and empty shard selections',()=>{
 for(const routeKeys of [[],['root','root'],['other'],['root','chapter','root']])assert.throws(()=>assertMatrix(completeMatrix(),{root,chapter,routeKeys}));
});
