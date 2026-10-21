/** Bind consumer, production Yandex and distinct TEST review bytes to one
 * committed source. This is provenance, never a human visual acceptance. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {verifyReleaseMetadata,verifyReleasePackage,sha256} from './lib/release-manifest.mjs';
import {RELEASE_VERSION} from '../src/game/ReleaseIdentity.js';

const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
assert.equal(commit,process.env.BUILD_COMMIT||process.env.GITHUB_SHA||commit);
assert.equal(execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim(),'');
assert.equal(execFileSync('git',['status','--porcelain','--untracked-files=all','--','src','public','index.html','vite.config.js','package.json','package-lock.json'],{encoding:'utf8'}).trim(),'');
const packages=['dist','dist-yandex','dist-yandex-review'].map(directory=>{
 const stamp=fs.readFileSync(path.join(directory,'build-info.json')),info=JSON.parse(stamp);
 verifyReleaseMetadata(info,{directory,commit});const files=verifyReleasePackage(info,directory);
 assert.equal(info.version,RELEASE_VERSION);assert.equal(info.levels,51);assert.equal(info.rooms.at(-1).stableLevel,41);assert.equal(info.verified,false);
 assert.ok(!files.some(row=>/debugcheck|yandex-games-debug-checker/.test(row.path)),'Upstream checker is a browser observer, never a shipped game asset');
 const review=files.filter(row=>/assets\/LabV8Journey-[A-Za-z0-9_-]+\.js$/.test(row.path));
 assert.equal(review.length,directory==='dist-yandex'?0:1,'Only declared review-capable entries include the actual route controller');
 const totalBytes=files.reduce((n,row)=>n+row.bytes,0);assert.ok(totalBytes<100_000_000);
 return{directory,sourceCommit:info.commit,sourceInputsSha256:info.sourceInputsSha256,packageFilesSha256:info.packageFilesSha256,buildInfoBytes:stamp.length,buildInfoSha256:sha256(stamp),totalBytes,files};
});
assert.equal(new Set(packages.map(row=>row.sourceInputsSha256)).size,1);
assert.equal(new Set(packages.map(row=>row.packageFilesSha256)).size,3,'Do not relabel consumer, production and TEST bytes as one package');
const out=path.resolve(process.env.OUT_DIR||'qa/v66-build');assert.ok(!fs.existsSync(out)||fs.readdirSync(out).length===0);fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({kind:'exact-source-visual-review-packages',pass:true,version:RELEASE_VERSION,sourceCommit:commit,runId:process.env.GITHUB_RUN_ID||null,runAttempt:process.env.GITHUB_RUN_ATTEMPT||null,packages,sourceAccepted:false,publicationAccepted:false,liveSdkAccepted:false,moderationAccepted:false},null,2)+'\n');
console.log('EXACT_SOURCE_VISUAL_PACKAGES',RELEASE_VERSION,commit,packages.map(row=>({directory:row.directory,bytes:row.totalBytes,sha256:row.packageFilesSha256})));
