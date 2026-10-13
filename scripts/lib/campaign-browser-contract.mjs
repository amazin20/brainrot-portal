import assert from 'node:assert/strict';
import {ACTIVE_FOUNDATION_RUNTIME_FLAGS,RELEASE_VERSION} from '../../src/game/ReleaseIdentity.js';
import {campaignSpec} from '../../src/game/LabCampaignLevels.js';
import {FOUNDATION_SEQUENCE,foundationDisplayNumber} from '../../src/game/LabCampaignSequence.js';

export function assertStampedCampaignInfo(info,expectedCommit){
 assert.equal(info.commit,expectedCommit,'The browser package is not the requested source commit');
 assert.equal(info.version,RELEASE_VERSION,'The browser package has a different release identity');
 assert.deepEqual(info.runtimeConfig,{chamberEdition:'foundation',...ACTIVE_FOUNDATION_RUNTIME_FLAGS},'Stamped runtime flags differ from the active campaign');
 assert.deepEqual(info.rooms.map(room=>room.stableLevel),FOUNDATION_SEQUENCE.map(index=>index+1),'Stamped stable room order differs');
 for(const room of info.rooms){
  assert.equal(room.level,foundationDisplayNumber(room.stableLevel-1),'Stamped visible room number differs');
  assert.equal(room.id,campaignSpec(info.runtimeConfig,room.stableLevel-1).id,'Stamped room variant differs');
 }
 return {commit:info.commit,version:info.version,editionVersion:info.editionVersion,sourceInputsSha256:info.sourceInputsSha256};
}

export async function readStampedCampaignInfo(base,expectedCommit=process.env.BUILD_COMMIT){
 if(!expectedCommit)return null; // Local development can intentionally be unstamped.
 const response=await fetch(new URL('build-info.json',base));
 assert.equal(response.ok,true,'The requested frozen browser package has no build stamp');
 return assertStampedCampaignInfo(await response.json(),expectedCommit);
}

/** Observe the live game and the actual human-facing HUD/selector. These
 * assertions do not modify flags or manufacture a successful room variant. */
export function assertCampaignBrowserState(observed,stableLevel){
 assert.equal(observed.levelIndex,stableLevel-1,'The browser opened a different stable room');
 assert.equal(observed.edition,'foundation','The browser opened another edition');
 assert.deepEqual(observed.flags,ACTIVE_FOUNDATION_RUNTIME_FLAGS,'The browser did not activate the root campaign flags');
 assert.equal(observed.id,campaignSpec({chamberEdition:'foundation',...ACTIVE_FOUNDATION_RUNTIME_FLAGS},stableLevel-1).id,'The browser built another room variant');
 const number=foundationDisplayNumber(stableLevel-1);
 assert.equal(observed.hudNumber,number,'The HUD uses a stale or incorrect campaign number');
 assert.equal(observed.optionNumber,number,'The selector uses a stale or incorrect campaign number');
 if(stableLevel===23)assert.equal(observed.physicalRoom23,true,'The root campaign did not build the new physical room23');
 if(stableLevel===43)assert.equal(observed.pilot43,true,'The root campaign retained the old room43');
 if(stableLevel>=44&&stableLevel<=51)assert.equal(observed.progressionLevel,stableLevel,'The root campaign retained an older late-room variant');
 return number;
}
