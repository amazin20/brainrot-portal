import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {verifyGallery} from '../scripts/verify-unified-public.mjs';

const root = new URL('https://example.test/brainrot-portal/');
const out = '/tmp/unified-gallery-observability';
const duration = 108.36666666666666;
const requestedTime = duration * .2;
const plain = value => structuredClone(value);
const ranges = values => ({
  length: values.length,
  start(index) { return values[index][0]; },
  end(index) { return values[index][1]; },
});

function fakeVideo(id, seconds, seekState = {}) {
  let time = 0;
  const video = {
    tagName: 'VIDEO', dataset: {recording: id},
    currentSrc: new URL(`walkthroughs/v54-level-${id}.mp4`, root).href,
    duration: seconds, videoWidth: 854, videoHeight: 480,
    readyState: 1, networkState: 2, paused: true, seeking: false, error: null,
    seekable: ranges([[0, seconds]]), buffered: ranges([[0, 3]]),
    closest() { return {textContent: `${id} · Принятое непрерывное прохождение`}; },
    load() {},
    async play() { this.paused = false; this.readyState = 4; },
    pause() { this.paused = true; },
    advance(seconds) { time += seconds; },
  };
  video.src = video.currentSrc;
  Object.defineProperty(video, 'currentTime', {
    enumerable: true,
    get() { return time; },
    set(value) {
      time = value;
      if (value > 0) {
        Object.assign(video, {readyState: 1, seeking: false, ...seekState});
        time += seekState.offset ?? 0;
      }
    },
  });
  return video;
}

function galleryFixture({seekState, screenshotError = false} = {}) {
  const videos = [
    fakeVideo('17', duration, seekState),
    fakeVideo('17-lower', 116.91666666666667),
    fakeVideo('1', 8.833333333333334),
  ];
  const events = [], waits = [], timers = [];
  const report = {errors: []};
  const failure = Object.assign(new Error('Deliberate first seek failure'), {name: 'TimeoutError'});
  const location = {href: new URL('walkthroughs.html', root).href};
  const find = selector => {
    const id = selector.match(/\[data-recording="([^"]+)"\]/)?.[1];
    return videos.find(video => video.dataset.recording === id) ?? null;
  };
  const document = {
    hidden: false, documentElement: {dataset: {runtimeState: 'menu', levelIndex: '0'}},
    body: {dataset: {externalPause: 'false'}},
    hasFocus: () => true,
    querySelector: find,
    querySelectorAll(selector) { return selector === 'video' ? videos : find(selector) ? [find(selector)] : []; },
    createElement() { assert.fail('A failed seek must not attempt frame decoding'); },
  };
  const sandbox = vm.createContext({
    document, location, URL,
    setTimeout(callback, milliseconds) {
      timers.push(milliseconds);
      for (const video of videos) if (!video.paused) video.advance(.7);
      callback(); return timers.length;
    },
  });
  const invoke = async (callback, args) => {
    sandbox.callbackArgs = args;
    const result = await vm.runInContext(`(${callback.toString()})(...callbackArgs)`, sandbox);
    return plain(result);
  };
  const page = {
    isClosed: () => false,
    setDefaultTimeout(value) { events.push({type: 'defaultTimeout', value}); },
    on(name) { events.push({type: 'listener', name}); },
    async setViewport(viewport) { events.push({type: 'viewport', viewport}); },
    async goto(url) { location.href = url; events.push({type: 'goto', url}); },
    async waitForSelector(selector) { assert.ok(find(selector), `Missing fixture target: ${selector}`); },
    async $eval(selector, callback, ...args) {
      const element = find(selector); assert.ok(element, `Missing fixture target: ${selector}`);
      return invoke(callback, [element, ...args]);
    },
    async $$eval(selector, callback, ...args) { return invoke(callback, [document.querySelectorAll(selector), ...args]); },
    async evaluate(callback, ...args) { return invoke(callback, args); },
    async waitForFunction(callback, options, ...args) {
      const result = await invoke(callback, args);
      const seek = args.length === 2 && typeof args[1] === 'number';
      waits.push({kind: seek ? 'seek' : 'metadata', callback, options, args, result});
      if (seek) throw failure;
      assert.equal(result, true, 'Metadata must be accepted before reproducing seek failure');
    },
    async screenshot(options) {
      events.push({type: 'screenshot', ...options});
      if (screenshotError) throw new Error('Screenshot unavailable');
    },
  };
  const context = {
    closed: false,
    async newPage() { return page; },
    async close() { this.closed = true; events.push({type: 'contextClosed'}); },
  };
  const browser = {async createBrowserContext() { return context; }};
  return {browser, page, context, videos, report, failure, events, waits, timers, invoke};
}

async function reachFirstSeek(t, fixture = galleryFixture()) {
  t.mock.method(console, 'log', () => {});
  await assert.rejects(verifyGallery(fixture.browser, {root, out, report: fixture.report}), error => error === fixture.failure);
  assert.equal(fixture.waits.length, 2, 'The real gallery function must reach metadata then first seek');
  return fixture;
}

test('first seek failure retains incremental playback and before/after media evidence', async t => {
  const fixture = await reachFirstSeek(t);
  const gallery = fixture.report.gallery;
  assert.deepEqual(gallery.progress, {stage: 'current-seek', recording: '17', fraction: .2, requestedTime});
  assert.equal(gallery.currentRecordings.length, 1);
  const recording = gallery.currentRecordings[0];
  assert.equal(recording.id, '17'); assert.equal(recording.completed, false);
  assert.equal(recording.src, new URL('walkthroughs/v54-level-17.mp4', root).href);
  assert.equal(recording.duration, duration);
  assert.ok(recording.actualPlaybackSeconds > .1);
  assert.deepEqual(recording.decodedSeekFrames, []);
  assert.equal(recording.seekAttempts.length, 1);
  const attempt = recording.seekAttempts[0];
  assert.equal(attempt.fraction, .2); assert.equal(attempt.requestedTime, requestedTime); assert.equal(attempt.completed, false);
  assert.equal(attempt.before.currentTime, .7); assert.equal(attempt.before.seeking, false); assert.equal(attempt.before.paused, true);
  assert.equal(attempt.afterAssignment.currentTime, requestedTime);
  assert.equal(attempt.afterAssignment.seeking, false);
  assert.equal(attempt.afterAssignment.readyState, 1);
  assert.equal(attempt.afterReady, undefined);
  for (const state of [recording.afterPlayback, attempt.before, attempt.afterAssignment]) {
    assert.deepEqual(state.seekable, [{start: 0, end: duration}]);
    assert.deepEqual(state.buffered, [{start: 0, end: 3}]);
  }
  assert.deepEqual(fixture.timers, [1200], 'Playback advance comes from the actual timed playback callback');
  assert.equal(fixture.waits[1].options.timeout, 90000);
  assert.deepEqual(fixture.waits[1].args, ['[data-recording="17"]', requestedTime]);
});

test('failure snapshot retains every video, including unvisited media and error codes', async t => {
  const fixture = galleryFixture();
  Object.assign(fixture.videos[1], {error: {code: 4, message: 'Unsupported media'}, networkState: 3});
  fixture.videos[2].advance(2.5);
  fixture.videos[2].seekable = ranges([]);
  fixture.videos[2].buffered = ranges([[0, 1], [2, 2.7]]);
  await reachFirstSeek(t, fixture);
  const failure = fixture.report.failureState;
  assert.equal(failure.url, new URL('walkthroughs.html', root).href);
  assert.equal(failure.hidden, false); assert.equal(failure.focused, true);
  assert.equal(failure.media.length, 3);
  assert.deepEqual(failure.media.map(item => item.recording), ['17', '17-lower', '1']);
  for (const item of failure.media) {
    for (const field of ['src', 'duration', 'currentTime', 'seeking', 'paused', 'readyState', 'networkState', 'width', 'height', 'seekable', 'buffered', 'error']) {
      assert.ok(Object.hasOwn(item, field), `Failure media is missing ${field}`);
    }
    assert.equal(item.width, 854); assert.equal(item.height, 480);
  }
  assert.equal(failure.media[0].currentTime, requestedTime);
  assert.equal(failure.media[0].readyState, 1);
  assert.deepEqual(failure.media[1].error, {code: 4, message: 'Unsupported media'});
  assert.equal(failure.media[1].networkState, 3);
  assert.equal(failure.media[2].currentTime, 2.5);
  assert.deepEqual(failure.media[2].seekable, []);
  assert.deepEqual(failure.media[2].buffered, [{start: 0, end: 1}, {start: 2, end: 2.7}]);
});

test('first seek failure closes its context and screenshot failure cannot mask the media failure', async t => {
  const fixture = await reachFirstSeek(t, galleryFixture({screenshotError: true}));
  assert.equal(fixture.context.closed, true);
  assert.equal(fixture.report.activePage, null);
  assert.deepEqual(fixture.report.errors, []);
  assert.deepEqual(fixture.events.filter(event => event.type === 'screenshot').map(event => event.path), [out + '/failure.png']);
});

for (const [name, seekState, expected] of [
  ['metadata-only data at the exact requested timestamp', {readyState: 1, seeking: false}, false],
  ['a seek still in progress despite decoded data', {readyState: 2, seeking: true}, false],
  ['decoded data at the wrong timestamp', {readyState: 2, seeking: false, offset: .13}, false],
  ['a media decode error despite otherwise ready data', {readyState: 2, seeking: false, error: {code: 3, message: 'Decode failed'}}, false],
  ['current decoded data with a completed exact seek', {readyState: 2, seeking: false}, true],
  ['current decoded data within the existing timestamp tolerance', {readyState: 2, seeking: false, offset: .11}, true],
]) {
  test(`real seek predicate ${expected ? 'accepts' : 'rejects'} ${name}`, async t => {
    const fixture = await reachFirstSeek(t, galleryFixture({seekState}));
    const seek = fixture.waits.find(wait => wait.kind === 'seek');
    assert.equal(seek.result, expected);
    assert.equal(seek.options.timeout, 90000);
    assert.equal(await fixture.invoke(seek.callback, seek.args), expected);
    assert.equal(fixture.report.gallery.currentRecordings[0].completed, false, 'A deliberate wait failure must never mark a recording complete');
    assert.deepEqual(fixture.report.gallery.currentRecordings[0].decodedSeekFrames, []);
  });
}
