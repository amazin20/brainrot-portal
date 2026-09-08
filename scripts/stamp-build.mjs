import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {CAMPAIGN} from '../src/game/LabCampaignLevels.js';

const [version='v26-flight-feel',directory='dist']=process.argv.slice(2);
const commit=process.env.BUILD_COMMIT||process.env.GITHUB_SHA;
assert.match(commit||'',/^[a-f0-9]{40}$/,'Build metadata requires the exact checked-out commit SHA');
assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),commit,'Metadata must describe the checked-out source');
assert.equal(version,'v26-flight-feel','Unexpected publication version');
assert.equal(CAMPAIGN.length,12,'Unexpected campaign size');
assert.ok(fs.existsSync(path.join(directory,'index.html')),'Stamp an existing production package');
const info={commit,version,levels:CAMPAIGN.length,verified:true,
 repository:process.env.GITHUB_REPOSITORY,run:process.env.GITHUB_RUN_ID};
fs.writeFileSync(path.join(directory,'build-info.json'),JSON.stringify(info,null,2)+'\n');
console.log(`Stamped ${directory}: ${version} / ${commit}`);
