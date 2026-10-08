// Exact-source/package/HTTP provenance for the two native research jobs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {buildSourceInputs,sha256,verifyReleasePackage} from './lib/release-manifest.mjs';
import {RELEASE_VERSION} from '../src/game/ReleaseIdentity.js';
const directory=process.env.PACKAGE_DIR||'dist',commit=process.env.BUILD_COMMIT;
assert.match(commit||'',/^[a-f0-9]{40}$/);
assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),commit);
const info=JSON.parse(fs.readFileSync(path.join(directory,'build-info.json')));
assert.equal(info.commit,commit);assert.equal(info.version,RELEASE_VERSION);assert.equal(info.verified,false);
assert.equal(info.sourceInputsSha256,sha256(JSON.stringify(buildSourceInputs())));verifyReleasePackage(info,directory);
const expected={
 'models/runtime/model-01-player.glb':'e5b09ff0281377b679d6fdd505fa1ed89550bb662e94e7f593ed67ee50a66a91',
 'models/runtime/model-02-cargo.glb':'65763c87e7f14cc807cffa8fc2adc364e8421dae819271a0c406a6b0d2c8c697',
};
const modelProof={};
for(const [file,hash] of Object.entries(expected)){
 assert.equal(sha256(fs.readFileSync(path.join('public',file))),hash,'Retain original L runtime actor bytes');
 assert.equal(sha256(fs.readFileSync(path.join(directory,file))),hash,'Package original runtime actor bytes');
 if(process.env.PAGE_URL){const response=await fetch(new URL(file,process.env.PAGE_URL),{cache:'no-store'});assert.equal(response.status,200);assert.equal(sha256(Buffer.from(await response.arrayBuffer())),hash,'Browser server must serve the exact runtime actor bytes');}
 modelProof[file]={sha256:hash,sourceAndPackageEqual:true,httpEqual:!!process.env.PAGE_URL};
}
if(process.env.PAGE_URL){const response=await fetch(new URL('build-info.json',process.env.PAGE_URL),{cache:'no-store'});assert.equal(response.status,200);assert.deepEqual(await response.json(),info);}
const report={sourceCommit:commit,sourceInputsSha256:info.sourceInputsSha256,packageFilesSha256:info.packageFilesSha256,version:info.version,verified:false,models:modelProof,scope:'Exact research package provenance; no recording or production acceptance is asserted'};
const output=process.env.PROVENANCE_OUT||'qa/camera-native-package.json';fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
