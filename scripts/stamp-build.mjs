import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {CAMPAIGN} from '../src/game/LabCampaignLevels.js';
import {FOUNDATION_INDICES} from '../src/game/LabFoundationEdition.js';
import {TOWER_STAGE_COUNT} from '../src/game/LabTowerLayout.js';

const [version='v44-tower-variety',directory='dist']=process.argv.slice(2);
const commit=process.env.BUILD_COMMIT||process.env.GITHUB_SHA;
assert.match(commit||'',/^[a-f0-9]{40}$/,'Build metadata requires the exact checked-out commit SHA');
assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),commit,'Metadata must describe the checked-out source');
assert.equal(execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim(),'','Do not attribute a modified worktree to a committed SHA');
assert.equal(version,'v44-tower-variety','Unexpected publication version');
assert.equal(CAMPAIGN.length,33,'Unexpected campaign size');
assert.equal(FOUNDATION_INDICES.length,41,'Unexpected default campaign size');
assert.equal(TOWER_STAGE_COUNT,18,'The final Tower must contain eighteen authored puzzle wings');
assert.ok(fs.existsSync(path.join(directory,'index.html')),'Stamp an existing production package');
const info={commit,version,artVersion:'v44-tower-variety',levels:FOUNDATION_INDICES.length,verified:true,status:'technical-candidate',
 verificationScope:'Automated source/package checks; route jobs gate publication',
 acceptance:{humanPlaytest:false,physicalDeviceBenchmark:false,liveYandex:false},
 features:{defaultEdition:'foundation',foundation:{version:'foundation-v3',rooms:FOUNDATION_INDICES.map(i=>i+1),redesignedOpening:[1,2,3,4,5],newChapter:[31,32,33,34,35,36,37,38,39,40],separateSave:true},archiveQuery:'edition=classic',archiveRooms:CAMPAIGN.length,campaignRooms:FOUNDATION_INDICES.length,campaignFinaleLevel:41,tower:{level:41,stages:TOWER_STAGE_COUNT,decks:6,branchesPerDeck:3,keystones:6,checkpoints:false,minimumActiveSeconds:900,query:'edition=foundation&level=41'},separateVelocityMode:false,openChamberReview:{version:'research-laboratory-v3',query:'edition=open',rooms:[24,28,30,31,32,33],separateSave:true}},
 repository:process.env.GITHUB_REPOSITORY,run:process.env.GITHUB_RUN_ID};
fs.writeFileSync(path.join(directory,'build-info.json'),JSON.stringify(info,null,2)+'\n');
console.log(`Stamped ${directory}: ${version} / ${commit}`);
