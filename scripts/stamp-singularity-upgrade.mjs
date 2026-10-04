import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {SINGULARITY_ROOMS,SINGULARITY_SPEC,validateSingularityLayout} from '../src/game/LabSingularityLayout.js';
import {CAMPAIGN} from '../src/game/LabCampaignLevels.js';
import {FOUNDATION_INDICES} from '../src/game/LabFoundationEdition.js';
import {assertUpgradeInfo,UPGRADE_VERSION} from './lib/singularity-upgrade-proof.mjs';

const directory=process.argv[2]||'dist',commit=process.env.BUILD_COMMIT||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),commit,'Stamp the checked-out revision');
assert.equal(execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim(),'','Commit the finished source before stamping');
assert.equal(validateSingularityLayout(),true);assert.ok(fs.existsSync(path.join(directory,'index.html')));
const rooms=SINGULARITY_ROOMS.map(({id,name,rule,requires})=>({id,name,rule,requires:[...requires]}));
const info={commit,version:UPGRADE_VERSION,artVersion:UPGRADE_VERSION,run:process.env.GITHUB_RUN_ID||null,levels:FOUNDATION_INDICES.length,
 verified:false,verificationScope:'Exact source and package; source, campaign, production WebGL, UI and continuous video gate publication',
 acceptance:{humanPlaytest:false,physicalDeviceBenchmark:false,liveYandex:false},
 features:{defaultEdition:'foundation',archiveRooms:CAMPAIGN.length,foundation:{version:'creative-campaign-v4',rooms:FOUNDATION_INDICES.map(i=>i+1),rebuiltRooms:[31,32,33,34,36,37,39,40,41],closedShortcutRooms:[14,16,32,41],physicsClosingApertureRecovery:true,separateSave:true},
  tower:{level:41,stages:rooms.length,independentHalls:rooms.filter(r=>!r.requires.length).length,rooms,
   title:SINGULARITY_SPEC.name,uniqueRules:new Set(rooms.map(r=>r.rule)).size,checkpoints:false,layout:'folded-vertical-castle',query:'edition=foundation&level=41'}}};
assertUpgradeInfo(info,SINGULARITY_ROOMS);fs.writeFileSync(path.join(directory,'build-info.json'),JSON.stringify(info,null,2)+'\n');
console.log(`Stamped ${directory}: ${UPGRADE_VERSION} / ${commit}`);
