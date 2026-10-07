import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {RELEASE_VERSION} from '../src/game/ReleaseIdentity.js';
import {createReleaseManifest} from './lib/release-manifest.mjs';

const [requestedVersion=RELEASE_VERSION,directory='dist']=process.argv.slice(2);
const commit=process.env.BUILD_COMMIT||process.env.GITHUB_SHA;
assert.match(commit||'',/^[a-f0-9]{40}$/,'Build metadata requires the exact checked-out commit SHA');
assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),commit,'Metadata must describe the checked-out source');
assert.equal(execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim(),'','Do not attribute a modified worktree to a committed SHA');
assert.equal(execFileSync('git',['status','--porcelain','--untracked-files=all','--','src','public','index.html','vite.config.js','package.json','package-lock.json'],{encoding:'utf8'}).trim(),'','Untracked build inputs must be committed before stamping');
// Older reusable workflows still pass v44. Accept that invocation during the
// migration, but never label the current 51-room campaign as the retired build.
assert.ok([RELEASE_VERSION,'v44-tower-variety'].includes(requestedVersion),'Unexpected publication version');
assert.ok(fs.existsSync(path.join(directory,'index.html')),'Stamp an existing production package');
const info=createReleaseManifest({directory,commit});
assert.equal(info.version,RELEASE_VERSION,'The explicit release identity must describe this build');
assert.equal(info.verified,false,'A metadata stamp cannot declare independent CI acceptance');
fs.writeFileSync(path.join(directory,'build-info.json'),JSON.stringify(info,null,2)+'\n');
console.log(`Stamped ${directory}: ${info.version} / ${commit}`);
