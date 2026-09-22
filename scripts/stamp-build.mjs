import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {CAMPAIGN} from '../src/game/LabCampaignLevels.js';

const [version='v40-laboratory-33',directory='dist']=process.argv.slice(2);
const commit=process.env.BUILD_COMMIT||process.env.GITHUB_SHA;
assert.match(commit||'',/^[a-f0-9]{40}$/,'Build metadata requires the exact checked-out commit SHA');
assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),commit,'Metadata must describe the checked-out source');
assert.equal(version,'v40-laboratory-33','Unexpected publication version');
assert.equal(CAMPAIGN.length,33,'Unexpected campaign size');
assert.ok(fs.existsSync(path.join(directory,'index.html')),'Stamp an existing production package');
const info={commit,version,artVersion:'v40-research-laboratory',levels:CAMPAIGN.length,verified:true,status:'technical-candidate',
 verificationScope:'Automated source/package checks; route jobs gate publication',
 acceptance:{humanPlaytest:false,physicalDeviceBenchmark:false,liveYandex:false},
 features:{campaignRooms:33,campaignFinaleLevel:33,separateVelocityMode:false,openChamberReview:{version:'research-laboratory-v3',query:'edition=open',rooms:[24,28,30,31,32,33],separateSave:true}},
 repository:process.env.GITHUB_REPOSITORY,run:process.env.GITHUB_RUN_ID};
fs.writeFileSync(path.join(directory,'build-info.json'),JSON.stringify(info,null,2)+'\n');
console.log(`Stamped ${directory}: ${version} / ${commit}`);
