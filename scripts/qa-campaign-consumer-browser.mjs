/** Run the existing native/architecture observer against the exact frozen
 * consumer package at its isolated campaign mount, without Vite fallbacks. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {verifyReleaseMetadata,verifyReleasePackage,sha256} from './lib/release-manifest.mjs';
import {serveFrozenCampaign} from './lib/frozen-campaign-server.mjs';

const root=path.resolve(process.env.SOURCE_DIR||'.'),directory=path.resolve(process.env.BUILD_DIR||'dist');
const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
assert.equal(commit,process.env.BUILD_COMMIT||process.env.GITHUB_SHA,'Exact source commit must be supplied');
assert.equal(execFileSync('git',['status','--porcelain','--untracked-files=no'],{cwd:root,encoding:'utf8'}).trim(),'','Consumer observer requires committed source/controller');
const infoBytes=fs.readFileSync(path.join(directory,'build-info.json')),info=JSON.parse(infoBytes);
verifyReleaseMetadata(info,{directory,commit,root,run:process.env.SOURCE_REVIEW_RUN_ID||info.run||null});
const files=verifyReleasePackage(info,directory),out=path.resolve(process.env.OUT_DIR||'qa/creative-browser');fs.mkdirSync(out,{recursive:true});
const mount=await serveFrozenCampaign(directory);
process.env.PAGE_URL=mount.url;process.env.START_SERVER='0';
fs.writeFileSync(path.join(out,'consumer-package-binding.json'),JSON.stringify({kind:'frozen-consumer-browser-package-binding',
 sourceCommit:commit,sourceTree:execFileSync('git',['rev-parse','HEAD^{tree}'],{cwd:root,encoding:'utf8'}).trim(),
 sourceInputsSha256:info.sourceInputsSha256,sourceInputFiles:info.sourceInputFiles,
 buildInfoBytes:infoBytes.length,buildInfoSha256:sha256(infoBytes),packageFilesSha256:info.packageFilesSha256,files,
 mode:process.env.CASE||'overview',levels:process.env.LEVELS||null,url:mount.url,
 sourceAccepted:false,publicationAccepted:false,liveSdkAccepted:false,moderationAccepted:false,
 scope:'Exact frozen consumer package and genuine production access gate; independent target fixtures contain only the prior completed canonical prefix. The Yandex original checker runs separately on the distinct review SDK package.'},null,2)+'\n');
try{await import('./qa-creative-browser.mjs');verifyReleasePackage(info,directory);}
finally{await new Promise(resolve=>mount.server.close(resolve));}
