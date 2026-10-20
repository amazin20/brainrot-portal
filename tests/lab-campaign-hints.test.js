import test from 'node:test';
import assert from 'node:assert/strict';
import {campaignSpec} from '../src/game/LabCampaignLevels.js';
import {FOUNDATION_SEQUENCE, CASTLE_LEVEL_INDEX} from '../src/game/LabCampaignSequence.js';
import {ACTIVE_FOUNDATION_RUNTIME_FLAGS} from '../src/game/ReleaseIdentity.js';
import {LabPreferences} from '../src/game/LabPreferences.js';
import {LabPlatform} from '../src/game/LabPlatform.js';
import {createHintProgress} from '../src/game/LabHintProgress.js';

const game = {chamberEdition: 'foundation', ...ACTIVE_FOUNDATION_RUNTIME_FLAGS};
const hintsFor = index => campaignSpec(game, index)?.hints;

test('the actual active fifty-one-room campaign has three authored hints per room', () => {
  assert.equal(FOUNDATION_SEQUENCE.length, 51);
  assert.equal(FOUNDATION_SEQUENCE.at(-1), CASTLE_LEVEL_INDEX);
  const triples = new Set();
  for (const index of FOUNDATION_SEQUENCE) {
    const spec = campaignSpec(game, index);
    assert.equal(spec.hints.length, 3, `three hints for ${spec.id}`);
    assert.equal(new Set(spec.hints).size, 3, `distinct tiers for ${spec.id}`);
    for (const text of spec.hints) {
      assert.equal(typeof text, 'string');
      assert.ok(text.trim().length >= 15, `non-placeholder hint for ${spec.id}`);
      assert.doesNotMatch(text, /TODO|undefined|\[object Object\]/);
    }
    triples.add(JSON.stringify(spec.hints));
  }
  assert.equal(triples.size, 51, 'rooms do not share a copied generic hint triple');
});

test('mock SDK rewards reveal and persist all three actual hints in every room without completing rooms', async () => {
  const saved = new Map();
  const storage = {getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value)};
  const preferences = new LabPreferences(storage);
  preferences.complete(0);
  let requestedAds = 0;
  // SDK callback fixture only: this test does not show or claim real adverts.
  const sdk = {adv: {showRewardedVideo({callbacks}) {
    requestedAds++;
    callbacks.onOpen(); callbacks.onRewarded(); callbacks.onClose();
  }}};
  const platform = new LabPlatform({sdk, demo: false});
  const hints = createHintProgress({platform, preferences, hintsFor});
  for (const index of FOUNDATION_SEQUENCE) {
    const texts = hintsFor(index);
    assert.deepEqual(hints.read(index).revealed, []);
    for (let tier = 1; tier <= 3; tier++) {
      const result = await hints.request(index);
      assert.equal(result.rewarded, true);
      assert.equal(result.index, index);
      assert.equal(result.count, tier);
      assert.deepEqual(hints.read(index).revealed, texts.slice(0, tier));
    }
    assert.equal((await hints.request(index)).reason, 'already-unlocked');
  }
  assert.equal(requestedAds, 153);
  assert.deepEqual(preferences.value.completed, [0], 'a hint never grants a room completion');
  const reloaded = new LabPreferences(storage);
  const restored = createHintProgress({platform, preferences: reloaded, hintsFor});
  for (const index of FOUNDATION_SEQUENCE) {
    assert.deepEqual(restored.read(index).revealed, hintsFor(index));
    assert.equal((await restored.request(index)).reason, 'already-unlocked');
  }
  assert.equal(requestedAds, 153, 'rereading earned hints after reload never requests another ad');
  assert.deepEqual(reloaded.value.completed, [0]);
});
