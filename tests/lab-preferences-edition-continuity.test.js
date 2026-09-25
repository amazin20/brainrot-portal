import test from 'node:test';
import assert from 'node:assert/strict';
import { LabPreferences } from '../src/game/LabPreferences.js';
import { foundationStorage } from '../src/game/LabFoundationEdition.js';
import { openEditionStorage, OPEN_ROOM_INDICES } from '../src/game/LabOpenEdition.js';

test('all 30 campaign completions survive reload and edition switches without changing archive or research saves', () => {
  // The same guest's local storage is shared by all three public entry links.
  const records = new Map();
  const storage = { getItem: key => records.get(key), setItem: (key, value) => records.set(key, value) };
  const archive = new LabPreferences(storage);
  archive.complete(0); archive.complete(5); archive.complete(29); archive.complete(32); archive.unlockHint(29);
  const archiveRecord = records.get('brainrot-portal.preferences.v24');
  const campaignStorage = foundationStorage(storage);
  const campaign = new LabPreferences(campaignStorage);
  for (let index = 0; index < 30; index++) campaign.complete(index);
  campaign.unlockHint(0); campaign.unlockHint(29);
  const campaignRecord = records.get('brainrot-foundation-v1:brainrot-portal.preferences.v24');
  const researchStorage = openEditionStorage(storage);
  const research = new LabPreferences(researchStorage);
  for (const index of OPEN_ROOM_INDICES) research.complete(index);

  assert.deepEqual(new LabPreferences(campaignStorage).value.completed, Array.from({length:30}, (_,i) => i));
  assert.deepEqual(new LabPreferences(campaignStorage).value.hints, {0:1,29:1});
  assert.deepEqual(new LabPreferences(storage).value.completed, [0,5,29,32]);
  assert.deepEqual(new LabPreferences(storage).value.hints, {29:1});
  assert.deepEqual(new LabPreferences(researchStorage).value.completed, OPEN_ROOM_INDICES);
  assert.equal(records.get('brainrot-portal.preferences.v24'), archiveRecord);
  assert.equal(records.get('brainrot-foundation-v1:brainrot-portal.preferences.v24'), campaignRecord);
});
