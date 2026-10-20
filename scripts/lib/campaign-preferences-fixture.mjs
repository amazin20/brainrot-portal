import {CREATIVE_CAMPAIGN_REVISION} from '../../src/game/LabPreferences.js';

// Accepted v61 full-campaign saves already carry these room revisions. Keep
// this historical fixture explicit: missing/stale mechanism revisions must
// continue to invalidate their progress in the real preferences constructor.
export const V61_ACCEPTED_ROOM_REVISIONS=Object.freeze({
  16:'cable-supported-architecture-v1',22:'counterweight-dynamic-v1',32:'siphon-observatory-v1',
  42:'spatial-progression43-v1',43:'spatial-progression44-v1',44:'spatial-progression45-v1',
  45:'spatial-progression46-v1',46:'spatial-progression47-v1',47:'spatial-progression48-v1',
  48:'spatial-progression49-v1',49:'spatial-progression50-v1',50:'spatial-progression51-v1',
});

export function v61HistoricalPreferenceFixture(preferences={}){
  return {...preferences,campaignRevision:CREATIVE_CAMPAIGN_REVISION,roomRevisions:{...V61_ACCEPTED_ROOM_REVISIONS}};
}
