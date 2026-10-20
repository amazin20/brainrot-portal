import test from 'node:test';
import assert from 'node:assert/strict';
import {LabPlatform} from '../src/game/LabPlatform.js';
import {LabPreferences} from '../src/game/LabPreferences.js';
import {createHintProgress} from '../src/game/LabHintProgress.js';

const ROOM_HINTS = [['Заметь свет.', 'Свяжи две панели.', 'Забери спутника.'],
  ['Найди привод.', 'Подай воздух.', 'Дождись остановки.']];

function fixture({demo = false, timeout = 1000, isAvailable = () => true} = {}) {
  const memory = new Map(), requests = [], holds = [];
  const storage = {getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value)};
  const preferences = new LabPreferences(storage);
  const sdk = {adv: {showRewardedVideo: ({callbacks}) => requests.push(callbacks)}};
  const platform = new LabPlatform({sdk, demo, timeout, hold: (...value) => holds.push(value)});
  const hints = createHintProgress({platform, preferences, hintsFor: index => ROOM_HINTS[index], isAvailable});
  return {hints, preferences, platform, requests, memory, storage, holds};
}

test('reading a room only shows its previously earned hints and never opens an advert', () => {
  const f = fixture();
  f.preferences.unlockHint(0);
  assert.deepEqual(f.hints.read(0).revealed, ['Заметь свет.']);
  assert.equal(f.hints.read(0).count, 1);
  assert.equal(f.hints.read(1).count, 0);
  assert.equal(f.requests.length, 0);
});

test('only confirmed onRewarded unlocks one persisted hint despite duplicate callbacks', async () => {
  const f = fixture(), pending = f.hints.request(0), callbacks = f.requests[0];
  assert.equal(f.hints.read(0).count, 0);
  callbacks.onOpen();
  callbacks.onRewarded(); callbacks.onRewarded();
  assert.equal(f.hints.read(0).count, 1);
  callbacks.onClose(); callbacks.onClose();
  const result = await pending;
  assert.equal(result.rewarded, true);
  assert.equal(result.rewardConfirmed, true);
  assert.equal(result.count, 1);
  assert.equal(new LabPreferences(f.storage).value.hints[0], 1);
  assert.equal(f.requests.length, 1);
  assert.deepEqual(f.holds.at(-1), ['ad', false]);
});

for (const close of ['onClose', 'onError']) {
  test(`${close} without a confirmed view leaves the next hint unopened`, async () => {
    const f = fixture(), pending = f.hints.request(0), callbacks = f.requests[0];
    callbacks.onOpen(); callbacks[close]();
    callbacks.onRewarded();
    assert.equal((await pending).rewarded, false);
    assert.equal(f.hints.read(0).count, 0);
    assert.equal(f.preferences.value.hints[0], undefined);
    assert.equal(f.hints.busy, false);
  });
}

test('an unavailable production SDK does not grant or spend a hint', async () => {
  const f = fixture();
  f.platform.sdk = {};
  const result = await f.hints.request(0);
  assert.equal(result.reason, 'unavailable');
  assert.equal(result.rewarded, false);
  assert.equal(f.hints.read(0).count, 0);
});

test('a silent SDK timeout and its late reward cannot unlock a hint', async () => {
  const f = fixture({timeout: 5}), pending = f.hints.request(0), callbacks = f.requests[0];
  const result = await pending;
  assert.equal(result.reason, 'timeout');
  callbacks.onRewarded(); callbacks.onClose();
  assert.equal(f.hints.read(0).count, 0);
  assert.equal(f.hints.busy, false);
});

test('simultaneous clicks for the same or another room share one pending request', async () => {
  const f = fixture(), first = f.hints.request(0);
  assert.equal((await f.hints.request(0)).reason, 'busy');
  assert.equal((await f.hints.request(1)).reason, 'busy');
  assert.equal(f.requests.length, 1);
  f.requests[0].onOpen(); f.requests[0].onRewarded(); f.requests[0].onClose();
  await first;
  assert.equal(f.hints.read(0).count, 1);
  assert.equal(f.hints.read(1).count, 0);
});

test('a changed current room cannot redirect an already requested hint reward', async () => {
  let current = 0;
  const f = fixture({isAvailable: index => index === current});
  const pending = f.hints.request(current);
  current = 1;
  f.requests[0].onOpen(); f.requests[0].onRewarded(); f.requests[0].onClose();
  const result = await pending;
  assert.equal(result.index, 0);
  assert.equal(f.hints.read(0).count, 1);
  assert.equal(f.hints.read(1).count, 0);
});

test('a request cannot consume a second tier if its captured tier was already unlocked', async () => {
  const f = fixture(), pending = f.hints.request(0);
  f.preferences.unlockHint(0);
  f.requests[0].onOpen(); f.requests[0].onRewarded(); f.requests[0].onClose();
  const result = await pending;
  assert.equal(result.rewardConfirmed, true);
  assert.equal(result.unlocked, false);
  assert.equal(result.reason, 'already-unlocked');
  assert.equal(result.count, 1);
});

test('all earned hints remain readable without another advert, including after reload', async () => {
  const f = fixture();
  for (let i = 0; i < 3; i++) f.preferences.unlockHint(0);
  assert.equal(f.hints.read(0).canUnlock, false);
  assert.deepEqual(f.hints.read(0).revealed, ROOM_HINTS[0]);
  assert.equal((await f.hints.request(0)).reason, 'already-unlocked');
  const restored = new LabPreferences(f.storage);
  const hints = createHintProgress({platform: f.platform, preferences: restored, hintsFor: index => ROOM_HINTS[index]});
  assert.deepEqual(hints.read(0).revealed, ROOM_HINTS[0]);
  assert.equal((await hints.request(0)).reason, 'already-unlocked');
  assert.equal(f.requests.length, 0);
});

test('an inactive or inaccessible room cannot request an advert', async () => {
  const f = fixture({isAvailable: index => index === 0});
  assert.equal(f.hints.read(1).canUnlock, false);
  assert.equal((await f.hints.request(1)).reason, 'inactive');
  assert.equal((await f.hints.request(-1)).reason, 'unavailable');
  assert.equal(f.requests.length, 0);
});

test('destroying the hint owner before the reward prevents a late preference write', async () => {
  const f = fixture(), pending = f.hints.request(0);
  f.requests[0].onOpen();
  f.hints.dispose();
  f.requests[0].onRewarded(); f.requests[0].onClose();
  assert.equal((await pending).rewarded, false);
  assert.equal(f.hints.read(0).count, 0);
  assert.equal((await f.hints.request(0)).reason, 'disposed');
  assert.equal(f.requests.length, 1);
});

test('disposing the SDK owner rejects late rewarded callbacks', async () => {
  const f = fixture(), pending = f.hints.request(0);
  f.platform.dispose();
  f.requests[0].onRewarded(); f.requests[0].onClose();
  assert.equal((await pending).rewarded, false);
  assert.equal(f.hints.read(0).count, 0);
  assert.equal(f.hints.busy, false);
});

test('a recoverable request exception leaves the hint available for a later attempt', async () => {
  const f = fixture();
  f.platform.hint = () => { throw new Error('SDK failure'); };
  assert.equal((await f.hints.request(0)).reason, 'error');
  assert.equal(f.hints.read(0).count, 0);
  assert.equal(f.hints.busy, false);
});

test('an explicitly marked no-ad demo remains free without pretending to show an advert', async () => {
  const f = fixture({demo: true});
  const result = await f.hints.request(0);
  assert.equal(result.rewarded, true);
  assert.equal(result.demo, true);
  assert.equal(result.reason, 'free-demo');
  assert.equal(f.requests.length, 0);
  assert.equal(f.hints.read(0).count, 1);
});
