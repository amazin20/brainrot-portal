import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import { CAMPAIGN_FINALE, VELOCITY_CHAPTERS,
  LabVelocityProgress, VELOCITY_PROGRESS_KEY } from '../src/game/LabVelocityChapters.js';
import {readCampaignRoute,nextCampaignLevel} from '../src/game/LabCampaignRoute.js';
import {LabPreferences} from '../src/game/LabPreferences.js';

test('room 30 is the numbered finale with no campaign interludes', () => {
  assert.equal(CAMPAIGN_FINALE.level, 30);
  assert.equal(CAMPAIGN_FINALE.status, 'available');
  assert.equal(CAMPAIGN_FINALE.publicMode, false);
  for (const prototype of VELOCITY_CHAPTERS) {
    assert.equal(prototype.afterLevel, undefined);
    assert.equal(prototype.returnLevel, undefined);
  }
  for (let index = 0; index < 29; index++) assert.equal(nextCampaignLevel(index, 30), index + 1);
  assert.equal(nextCampaignLevel(29, 30), 0);
  assert.equal(nextCampaignLevel(99, 30), 0);
});

test('old speed links open the campaign menu and retain valid continuation bookmarks', () => {
  for (const chapter of [1, 2]) {
    const route = readCampaignRoute(`?mode=velocity&chapter=${chapter}&v=old`, 30);
    assert.equal(route.levelIndex, 0);
    assert.equal(route.legacyVelocityLink, true);
    assert.equal(route.search, '?v=old');
    const returning = readCampaignRoute(`?mode=velocity&chapter=${chapter}&return=${chapter * 10 + 1}&debug=1`, 30);
    assert.equal(returning.levelIndex, chapter * 10);
    assert.equal(new URLSearchParams(returning.search).get('debug'), '1');
    assert.equal(new URLSearchParams(returning.search).get('mode'), null);
  }
  for (const link of ['?mode=velocity&chapter=1&return=21', '?mode=velocity&chapter=2&return=https://example.com', '?mode=velocity&chapter=1&return=11.0']) {
    assert.equal(readCampaignRoute(link, 30).levelIndex, 0);
  }
  assert.equal(readCampaignRoute('?mode=velocity&chapter=2&return=21&level=22',30).levelIndex,21);
});

test('public level links accept only available numbered rooms', () => {
  for (let level=1;level<=30;level++) assert.equal(readCampaignRoute(`?level=${level}`,30).levelIndex,level-1);
  for (const level of ['0','31','100','-1','2.5','Infinity','NaN']) {
    assert.equal(readCampaignRoute(`?level=${level}`,30).levelIndex,0);
  }
  assert.deepEqual(readCampaignRoute('',30),{levelIndex:0,legacyVelocityLink:false,search:''});
});

test('public menu and entry expose only the campaign', () => {
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  assert.doesNotMatch(html,/mode=velocity|velocity-link|velocity-chapters|Скоростные главы/);
  assert.doesNotMatch(main,/getVelocityInterlude|velocityChapterURL|__NESI_RUN_VELOCITY_ROUTE__/);
  assert.match(main,/game\.epicMode=false/);
  assert.match(main,/nextCampaignLevel\(game\.levelIndex,CAMPAIGN\.length\)/);
});

test('adding numbered rooms preserves existing campaign and retired prototype progress', () => {
  const old={campaignRevision:'folded-junction-v28',completed:[0,9,19,20],hints:{9:1,20:2},quality:'low',volume:.4,muted:true,tutorial:false};
  const speed='{"completed":["velocity-flow-v1","velocity-cascade-v1"]}';
  const records=new Map([['brainrot-portal.preferences.v24',JSON.stringify(old)],[VELOCITY_PROGRESS_KEY,speed]]);
  const storage={getItem:key=>records.get(key),setItem:(key,value)=>records.set(key,value)};
  const prefs=new LabPreferences(storage);
  assert.deepEqual(prefs.value.completed,old.completed);
  assert.deepEqual(prefs.value.hints,old.hints);
  assert.equal(prefs.value.quality,'low');
  for(let index=21;index<=28;index++)prefs.complete(index);
  assert.deepEqual(new LabPreferences(storage).value.completed,[0,9,19,20,21,22,23,24,25,26,27,28]);
  assert.equal(records.get(VELOCITY_PROGRESS_KEY),speed);
  assert.equal(new LabPreferences(storage).value.completed.includes(29),false);
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
