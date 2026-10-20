import assert from 'node:assert/strict';
import {LabPreferences,DEFAULT_PREFERENCES,CREATIVE_CAMPAIGN_REVISION,CREATIVE_REPLACED_INDICES} from '../../src/game/LabPreferences.js';
import {FOUNDATION_SEQUENCE,FOUNDATION_SEQUENCE_REVISION} from '../../src/game/LabCampaignSequence.js';
import {foundationCampaignPrefix,FOUNDATION_STORAGE_PREFIX,CAMPAIGN_PREFERENCE_KEY} from '../../src/game/LabCampaignStorage.js';
import {V61_ACCEPTED_ROOM_REVISIONS} from './campaign-preferences-fixture.mjs';

export const CAMPAIGN_ACCESS_FIXTURE_SCOPE='QA setup supplies the previously completed campaign prefix in the candidate own storage before construction; the current target is not completed. This is not a fresh guest full-campaign playthrough.';

/** Honest setup for one independently tested room under production gating.
 * This helper is never imported by the production game or shipped in its ZIP. */
export function campaignAccessFixture({levelIndex,pathname}={}){
  const position=FOUNDATION_SEQUENCE.indexOf(levelIndex);
  assert.ok(Number.isInteger(levelIndex)&&position>=0,'A real permanent foundation index is required');
  const prefix=foundationCampaignPrefix(pathname,{fullFoundationCampaign:true});
  assert.notEqual(prefix,FOUNDATION_STORAGE_PREFIX,'Use an actual candidate campaign mount, not an archive or development path');
  const completed=FOUNDATION_SEQUENCE.slice(0,position);
  const preferences={...DEFAULT_PREFERENCES,quality:'low',volume:0,muted:true,tutorial:false,
    completed,hints:{},resumeLevel:levelIndex,campaignSequenceRevision:FOUNDATION_SEQUENCE_REVISION,
    campaignRevision:CREATIVE_CAMPAIGN_REVISION,roomRevisions:{...V61_ACCEPTED_ROOM_REVISIONS}};
  const raw=JSON.stringify(preferences),key=prefix+CAMPAIGN_PREFERENCE_KEY,writes=[];
  // Exercise the real constructor. An obsolete fixture must fail rather than
  // silently losing prior progress through a migration or revision reset.
  const loaded=new LabPreferences({getItem:name=>name===CAMPAIGN_PREFERENCE_KEY?raw:null,setItem:(...args)=>writes.push(args)},
    {campaignRevision:CREATIVE_CAMPAIGN_REVISION,replacedIndices:CREATIVE_REPLACED_INDICES,roomRevisions:V61_ACCEPTED_ROOM_REVISIONS});
  assert.deepEqual(writes,[],'The fixture caused constructor persistence');
  assert.deepEqual(loaded.value.completed,completed,'The real constructor invalidated the fixture prefix');
  assert.equal(loaded.value.resumeLevel,levelIndex);
  assert.equal(loaded.value.completed.includes(levelIndex),false,'The target was already marked completed');
  assert.deepEqual(loaded.roomRevisions,V61_ACCEPTED_ROOM_REVISIONS);
  return {key,raw,preferences,completed:[...completed],targetIndex:levelIndex,targetCompleted:false,constructorWrites:0,scope:CAMPAIGN_ACCESS_FIXTURE_SCOPE};
}
