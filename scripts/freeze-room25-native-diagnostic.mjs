import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {buildSourceInputs,verifyReleaseMetadata,verifyReleasePackage} from './lib/release-manifest.mjs';
import {ROOM25_BOUNDS,ROOM25_OPEN_SCOPES} from './lib/room25-native-proof.mjs';

const hash=b=>createHash('sha256').update(b).digest('hex');
const git=(root,args)=>execFileSync('git',args,{cwd:root,maxBuffer:32000000}).toString().trim();
export const ROOM25_HARNESS_FILES=Object.freeze(['scripts/qa-room25-required-native.mjs','scripts/freeze-room25-native-diagnostic.mjs','scripts/lib/room25-native-driver.mjs','scripts/lib/room25-native-proof.mjs']);

/** Bind this observation to the currently checked-out source and all inputs.
 * No historical prototype SHA, artifact or controller is accepted as evidence. */
export function freezeRoom25Source(sourceRoot=process.cwd(),controllerRoot=process.cwd()){
 const source=path.resolve(sourceRoot),controller=path.resolve(controllerRoot);
 const commit=git(source,['rev-parse','HEAD']),tree=git(source,['rev-parse','HEAD^{tree}']);
 assert.match(commit,/^[a-f0-9]{40}$/);assert.match(tree,/^[a-f0-9]{40}$/);
 if(process.env.BUILD_COMMIT||process.env.GITHUB_SHA)assert.equal(commit,process.env.BUILD_COMMIT||process.env.GITHUB_SHA,'Record only the exact requested current source');
 assert.equal(git(source,['status','--porcelain','--untracked-files=no']),'','Native proof requires committed source bytes');
 assert.equal(git(source,['status','--porcelain','--untracked-files=all','--','src','public','index.html','vite.config.js','package.json','package-lock.json']),'','Untracked production inputs must be committed');
 const inputs=buildSourceInputs(source),models=git(source,['ls-tree','-r','--name-only','HEAD']).split('\n').filter(name=>name.endsWith('.glb')).map(name=>{
  const bytes=fs.readFileSync(path.join(source,name));return {path:name,bytes:bytes.length,sha256:hash(bytes)};
 });
 assert.equal(models.length,59,'Preserve the complete original model inventory');
 const harness=ROOM25_HARNESS_FILES.map(name=>{const bytes=fs.readFileSync(path.join(controller,name));return {path:name,bytes:bytes.length,sha256:hash(bytes)};});
 assert.equal(git(controller,['status','--porcelain','--untracked-files=no']),'','Native controller must be committed');
 for(const entry of harness)assert.deepEqual(fs.readFileSync(path.join(controller,entry.path)),execFileSync('git',['show','HEAD:'+entry.path],{cwd:controller}));
 return {kind:'room25-current-native-input-freeze',...ROOM25_OPEN_SCOPES,
  source:{commit,tree,sourceInputsSha256:hash(JSON.stringify(inputs)),sourceInputFiles:inputs.length,originalModels:models},
  controller:{commit:git(controller,['rev-parse','HEAD']),tree:git(controller,['rev-parse','HEAD^{tree}']),files:harness,filesSha256:hash(JSON.stringify(harness)),runId:Number(process.env.GITHUB_RUN_ID||0),runAttempt:Number(process.env.GITHUB_RUN_ATTEMPT||0),trackedWorkingTreeClean:true},
  sourceInputs:inputs,scope:'Exact current-build optical carriage route, current force clock, native canvas and original model identity. Human discovery and exhaustive routes are outside this observation.'};
}
export function bindRoom25Package(frozen,sourceRoot,directory){
 const build=path.resolve(directory),info=JSON.parse(fs.readFileSync(path.join(build,'build-info.json'),'utf8'));
 assert.equal(info.commit,frozen.source.commit);verifyReleaseMetadata(info,{directory:build,commit:frozen.source.commit,root:path.resolve(sourceRoot),run:process.env.SOURCE_REVIEW_RUN_ID||info.run||null});
 const files=verifyReleasePackage(info,build),journey=files.filter(f=>/^assets\/LabRoom25Journey-[A-Za-z0-9_-]+\.js$/.test(f.path));
 assert.equal(journey.length,1,'One actual compiled Room25 journey required');
 const manifest=JSON.parse(fs.readFileSync(path.join(build,'models/runtime/manifest.json'),'utf8'));assert.equal(manifest.models.length,14);
 for(const m of manifest.models){const file=files.find(f=>f.path==='models/runtime/'+m.filename);assert.ok(file);assert.equal(file.bytes,m.outputBytes);assert.equal(file.sha256,m.outputSHA256);assert.equal(frozen.source.originalModels.find(f=>f.path==='public/models/runtime/'+m.filename)?.sha256,file.sha256);}
 const infoBytes=fs.readFileSync(path.join(build,'build-info.json'));
 return {...frozen,package:{commit:info.commit,buildInfoBytes:infoBytes.length,buildInfoSha256:hash(infoBytes),packageFilesSha256:info.packageFilesSha256,fileCount:files.length,totalBytes:files.reduce((n,f)=>n+f.bytes,0),files,journey:journey[0],originalRuntimeModels:14},captureBounds:ROOM25_BOUNDS};
}
export function assertRoom25InputsUnchanged(before,after){assert.deepEqual(after.source,before.source);assert.deepEqual(after.sourceInputs,before.sourceInputs);assert.deepEqual(after.controller,before.controller);return true;}
