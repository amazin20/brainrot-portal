import test from 'node:test';
import assert from 'node:assert/strict';
import { getVelocityChapter, getVelocityInterlude, velocityChapterURL, readVelocityRoute,
  LabVelocityProgress, VELOCITY_PROGRESS_KEY } from '../src/game/LabVelocityChapters.js';

test('speed interludes follow rooms 10 and 20 without renumbering the campaign', () => {
  for (let index = 0; index < 21; index++) {
    const chapter = getVelocityInterlude(index);
    if (index === 9 || index === 19) {
      assert.equal(chapter.chapter, index === 9 ? 1 : 2);
      assert.equal(chapter.returnLevel, index + 2);
    } else assert.equal(chapter, null);
  }
  assert.equal(getVelocityInterlude('9'), null);
});

test('chapter deep links return only to the matching next room', () => {
  for (const chapter of [1, 2]) {
    const direct = readVelocityRoute(velocityChapterURL(chapter));
    assert.equal(direct.chapter.chapter, chapter); assert.equal(direct.returnLevel, null);
    const interlude = readVelocityRoute(velocityChapterURL(chapter, { returnToCampaign: true }));
    assert.equal(interlude.returnLevel, chapter * 10 + 1);
  }
  for (const link of ['?chapter=1&return=21', '?chapter=2&return=https://example.com', '?chapter=999&return=999', '?chapter=1&return=11.0']) {
    assert.equal(readVelocityRoute(link).returnLevel, null);
  }
  assert.equal(getVelocityChapter(-1).chapter, 1);
});

test('chapter completion never reads or changes campaign save data', () => {
  const records = new Map([['brainrot-portal.preferences.v24', '{"completed":[9,19],"hints":{"7":2}}']]);
  const before = records.get('brainrot-portal.preferences.v24');
  const storage = { getItem: key => records.get(key), setItem: (key, value) => records.set(key, value) };
  const progress = new LabVelocityProgress(storage);
  progress.complete(1); progress.complete(1); progress.complete(2);
  assert.equal(progress.value.completed.length, 2);
  assert.equal(records.get('brainrot-portal.preferences.v24'), before);
  const restored = new LabVelocityProgress(storage);
  assert.equal(restored.has(1), true); assert.equal(restored.has(2), true);
  assert.equal(records.size, 2);
});

test('blocked or corrupt storage remains playable and never replaces an unreadable record', () => {
  for (const raw of ['{', 'null', '[]']) {
    let writes = 0;
    const progress = new LabVelocityProgress({ getItem: () => raw, setItem: () => writes++ });
    progress.complete(2);
    assert.equal(progress.has(2), true); assert.equal(writes, 0);
  }
  const blocked = new LabVelocityProgress({ getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } });
  assert.doesNotThrow(() => blocked.complete(1)); assert.equal(blocked.has(1), true);
  const records = new Map([[VELOCITY_PROGRESS_KEY, '{"completed":["unknown",9,"velocity-flow-v1","velocity-flow-v1"]}']]);
  assert.deepEqual(new LabVelocityProgress({ getItem: key => records.get(key) }).value.completed, ['velocity-flow-v1']);
});
