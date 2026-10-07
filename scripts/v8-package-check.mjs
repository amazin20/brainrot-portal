import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {CAMPAIGN_ASSET_IDS} from '../src/game/labAssets.js';
import {CAMPAIGN,FOUNDATION_LATE_SPECS,campaignSpec} from '../src/game/LabCampaignLevels.js';
import {FOUNDATION_INDICES} from '../src/game/LabFoundationEdition.js';
import {OPEN_ROOM_INDICES} from '../src/game/LabOpenEdition.js';
import {TOWER_SPEC} from '../src/game/LabSingularityLevel.js';

export function campaignPackageExpectations(){
 // These are preserved archive contracts, not the changing default campaign.
 // Deriving their count from an accidentally truncated array would weaken the
 // legacy guard; only foundation/late coverage follows the active registry.
 assert.equal(CAMPAIGN.length,33,'Retain all thirty-three classic archive rooms');
 assert.deepEqual([...OPEN_ROOM_INDICES],[23,27,29,30,31,32],'Retain the six explicitly numbered open-edition rooms');
 const classic=CAMPAIGN.map((_,index)=>campaignSpec({chamberEdition:'classic'},index));
 const foundation=FOUNDATION_INDICES.map(index=>campaignSpec({chamberEdition:'foundation'},index));
 const open=OPEN_ROOM_INDICES.map(index=>campaignSpec({chamberEdition:'open'},index));
 for(const [edition,rooms] of Object.entries({classic,foundation,open})){
  assert.ok(rooms.length&&rooms.every(Boolean),`Every ${edition} registry entry needs an active definition`);
  assert.equal(new Set(rooms.map(room=>room.id)).size,rooms.length,`${edition} identifiers must be unique`);
  assert.ok(rooms.every(room=>room.assets.every(id=>CAMPAIGN_ASSET_IDS.includes(id))),`${edition} declares an unavailable runtime asset`);
 }
 assert.equal(classic[11].id,'folded-junction','Retain the archived room 12 identity');
 assert.equal(classic[14].id,'countercurrent-weave','Retain the archived room 15 identity');
 assert.equal(classic[20].id,'gravity-pocket','Retain the archived room 21 identity');
 assert.equal(foundation[17].id,'conductive-cargo-circuit');
 assert.equal(foundation[19].id,'foundation-portal-tension');
 const firstLate=foundation.indexOf(FOUNDATION_LATE_SPECS[0]);
 assert.ok(firstLate>=0,'The late registry must belong to the default campaign');
 assert.deepEqual(foundation.slice(firstLate),FOUNDATION_LATE_SPECS,'Every declared late room must be present, in order');
 assert.equal(new Set(FOUNDATION_LATE_SPECS.map(room=>room.id)).size,FOUNDATION_LATE_SPECS.length);
 assert.ok(FOUNDATION_LATE_SPECS.every(room=>!classic.some(archive=>archive.id===room.id)),'Do not silently substitute archive puzzles into the late campaign');
 assert.equal(foundation.filter(room=>room===TOWER_SPEC).length,1,'Keep the current Singularity Tower exactly once');
 assert.equal(foundation[40],TOWER_SPEC,'Keep the Tower at stable room 41; later rooms remain after it');
 const assetIds=[...new Set([...classic,...foundation,...open].flatMap(room=>room.assets))].sort((a,b)=>a-b);
 assert.deepEqual(assetIds,[...CAMPAIGN_ASSET_IDS],'Declared editions and the active loader must agree on every model');
 return {classic,foundation,open,late:FOUNDATION_LATE_SPECS,assetIds};
}

export function verifyCampaignPackage(directory='dist'){
 const root=path.resolve(directory),expected=campaignPackageExpectations();
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'models/runtime/manifest.json')));
 assert.deepEqual(manifest.models.map(model=>model.id).sort((a,b)=>a-b),expected.assetIds,'Package every active model exactly once');
 let actualBytes=0;
 for(const model of manifest.models){
  assert.equal(path.basename(model.filename),model.filename,'Model paths must stay inside the runtime directory');
  const bytes=fs.readFileSync(path.join(root,'models/runtime',model.filename));
  assert.ok(bytes.length>1000,'A runtime GLB is truncated');
  assert.equal(bytes.length,model.outputBytes,`Runtime model ${model.id} byte count changed`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),model.outputSHA256,`Runtime model ${model.id} hash changed`);
  actualBytes+=bytes.length;
 }
 assert.equal(actualBytes,manifest.totalBytes,'The model budget must describe actual packaged bytes');
 assert.ok(actualBytes<4_000_000,'Preserve the active model budget');
 for(const retired of ['models/model-01-player.glb','model-screens','concepts'])assert.ok(!fs.existsSync(path.join(root,retired)),`Do not ship source/reference files: ${retired}`);
 assert.ok(fs.readFileSync(path.join(root,'index.html'),'utf8').includes('settings-level-select'));
 return {pass:true,models:manifest.models.length,modelBytes:actualBytes,editions:{foundation:expected.foundation.length,classic:expected.classic.length,open:expected.open.length},lateRooms:expected.late.length};
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){
 const result=verifyCampaignPackage(process.argv[2]||'dist');
 console.log('Package verified:',JSON.stringify(result));
}
