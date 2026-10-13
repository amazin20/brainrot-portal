import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {buildSourceInputs,verifyReleaseMetadata,verifyReleasePackage} from './lib/release-manifest.mjs';
import {ROOM25_SOURCE,ROOM25_BOUNDS,ROOM25_OPEN_SCOPES} from './lib/room25-native-proof.mjs';
export const ROOM25_HARNESS_FILES=Object.freeze(['.github/workflows/room25-required-native-diagnostic.yml','scripts/qa-room25-required-native.mjs','scripts/freeze-room25-native-diagnostic.mjs','scripts/lib/room25-native-driver.mjs','scripts/lib/room25-native-proof.mjs','tests/room25-native-contract.test.js','tests/room25-native-driver.test.js']);
const hash=b=>createHash('sha256').update(b).digest('hex'),git=(root,args)=>execFileSync('git',args,{cwd:root,maxBuffer:32000000}),readjson=p=>JSON.parse(fs.readFileSync(p,'utf8'));
export function freezeRoom25Source(sourceRoot,controllerRoot=process.cwd(),{requireControllerClean=true}={}){
 const source=path.resolve(sourceRoot),controller=path.resolve(controllerRoot);
 assert.equal(git(source,['rev-parse','HEAD']).toString().trim(),ROOM25_SOURCE.commit);assert.equal(git(source,['rev-parse','HEAD^{tree}']).toString().trim(),ROOM25_SOURCE.tree);
 assert.equal(git(source,['status','--porcelain','--untracked-files=no']).toString().trim(),'','Frozen source tracked files changed');
 assert.equal(git(source,['status','--porcelain','--untracked-files=all','--','src','public','index.html','vite.config.js','package.json','package-lock.json']).toString().trim(),'','Frozen production build inputs changed');
 const inputs=buildSourceInputs(source);assert.equal(inputs.length,322);const models=[];
 for(const name of git(source,['ls-tree','-r','--name-only',ROOM25_SOURCE.commit]).toString().trim().split('\n').filter(n=>n.endsWith('.glb'))){
  const bytes=fs.readFileSync(path.join(source,name)),original=git(source,['show',ROOM25_SOURCE.baseline+':'+name]);assert.deepEqual(bytes,original,'Original GLB changed: '+name);models.push({path:name,bytes:bytes.length,sha256:hash(bytes)});
 }
 assert.equal(models.length,59);const harness=ROOM25_HARNESS_FILES.map(name=>{const bytes=fs.readFileSync(path.join(controller,name));return {path:name,bytes:bytes.length,sha256:hash(bytes)};});
 const status=git(controller,['status','--porcelain','--untracked-files=no']).toString().trim();if(requireControllerClean){assert.equal(status,'','Committed diagnostic controller required');for(const entry of harness)assert.deepEqual(fs.readFileSync(path.join(controller,entry.path)),git(controller,['show','HEAD:'+entry.path]),'Harness bytes must match the literal committed controller');}
 return {kind:'room25-native-diagnostic-exact-input-freeze',...ROOM25_OPEN_SCOPES,
  source:{commit:ROOM25_SOURCE.commit,tree:ROOM25_SOURCE.tree,originalGlbBaseline:ROOM25_SOURCE.baseline,sourceInputsSha256:hash(JSON.stringify(inputs)),sourceInputFiles:inputs.length,originalModels:models},
  controller:{commit:git(controller,['rev-parse','HEAD']).toString().trim(),tree:git(controller,['rev-parse','HEAD^{tree}']).toString().trim(),files:harness,filesSha256:hash(JSON.stringify(harness)),runId:Number(process.env.GITHUB_RUN_ID||0),runAttempt:Number(process.env.GITHUB_RUN_ATTEMPT||0),trackedWorkingTreeClean:status===''},
  sourceInputs:inputs,scope:'Read-only native diagnostic of the literal frozen Room25 prototype. This freeze is not native, release, full CI, human or whole-room acceptance.'};
}
export function bindRoom25Package(frozen,sourceRoot,directory){
 const build=path.resolve(directory),info=readjson(path.join(build,'build-info.json'));assert.equal(info.commit,ROOM25_SOURCE.commit);verifyReleaseMetadata(info,{directory:build,commit:ROOM25_SOURCE.commit,root:path.resolve(sourceRoot)});const files=verifyReleasePackage(info,build);
 const journey=files.filter(f=>/^assets\/LabRoom25Journey-[A-Za-z0-9_-]+\.js$/.test(f.path));assert.equal(journey.length,1,'One genuine compiled production Room25 journey required');
 const manifests=readjson(path.join(build,'models/runtime/manifest.json'));assert.equal(manifests.models.length,14);
 for(const m of manifests.models){const file=files.find(f=>f.path==='models/runtime/'+m.filename);assert.ok(file);assert.equal(file.bytes,m.outputBytes);assert.equal(file.sha256,m.outputSHA256);assert.equal(frozen.source.originalModels.find(f=>f.path==='public/models/runtime/'+m.filename)?.sha256,file.sha256);}
 return {...frozen,package:{commit:info.commit,buildInfoBytes:fs.statSync(path.join(build,'build-info.json')).size,buildInfoSha256:hash(fs.readFileSync(path.join(build,'build-info.json'))),packageFilesSha256:info.packageFilesSha256,fileCount:files.length,totalBytes:files.reduce((n,f)=>n+f.bytes,0),files,journey:journey[0],originalRuntimeModels:14},captureBounds:ROOM25_BOUNDS};
}
export function assertRoom25InputsUnchanged(before,after){assert.deepEqual(after.source,before.source);assert.deepEqual(after.sourceInputs,before.sourceInputs);assert.deepEqual(after.controller,before.controller);return true;}
export function writeRoom25ArtifactInventory(directory){
 const out=path.resolve(directory),name='actual-artifact-member-inventory.json';
 const files=fs.readdirSync(out).filter(n=>n!==name).sort().map(n=>{assert.ok(!/\.(?:png|jpe?g)$/i.test(n),'Separate still image artifact forbidden: '+n);const p=path.join(out,n),s=fs.lstatSync(p);assert.ok(s.isFile()&&!s.isSymbolicLink());assert.ok(s.size<=ROOM25_BOUNDS.movieBytes);return {path:n,bytes:s.size,sha256:hash(fs.readFileSync(p))};});
 const membersTotalBytes=files.reduce((n,f)=>n+f.bytes,0);let inventoryBytes=0,bytes;
 for(let attempt=0;attempt<10;attempt++){bytes=Buffer.from(JSON.stringify({files,membersTotalBytes,inventoryMember:{path:name,bytes:inventoryBytes},totalBytes:membersTotalBytes+inventoryBytes,sourceCommit:ROOM25_SOURCE.commit,actualProviderZipDownloaded:false,actualProviderZipAccepted:false,...ROOM25_OPEN_SCOPES,scope:'All closed flat artifact members; total includes this inventory. Self hash is deliberately excluded, and provider ZIP bytes remain unverified.'},null,2)+'\n');if(bytes.length===inventoryBytes)break;inventoryBytes=bytes.length;}
 assert.equal(bytes.length,inventoryBytes,'Inventory byte count failed to converge');assert.ok(membersTotalBytes+inventoryBytes<=ROOM25_BOUNDS.artifactBytes);fs.writeFileSync(path.join(out,name),bytes);return JSON.parse(bytes);
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname)){
 const mode=process.argv[2]||'freeze',source=process.env.SOURCE_DIR||'../source',out=path.resolve(process.env.OUT_DIR||'qa/room25-native-diagnostic');fs.mkdirSync(out,{recursive:true});
 if(mode==='freeze'){const f=freezeRoom25Source(source);fs.writeFileSync(path.join(out,'input-freeze.json'),JSON.stringify(f,null,2)+'\n');console.log('ROOM25_INPUT_FREEZE',f.source.commit,f.controller.commit,f.source.sourceInputsSha256);}
 else if(mode==='package'){const f=readjson(path.join(out,'input-freeze.json')),after=freezeRoom25Source(source);assertRoom25InputsUnchanged(f,after);const b=bindRoom25Package(f,source,process.env.BUILD_DIR||'../source/dist');fs.writeFileSync(path.join(out,'binding.json'),JSON.stringify(b,null,2)+'\n');console.log('ROOM25_PACKAGE_BINDING',b.package.fileCount,b.package.totalBytes,b.package.journey.sha256);}
 else if(mode==='verify'){const b=readjson(path.join(out,'binding.json'));assertRoom25InputsUnchanged(b,freezeRoom25Source(source));const after=bindRoom25Package(b,source,process.env.BUILD_DIR||'../source/dist');assert.deepEqual(after.package,b.package);console.log('ROOM25_INPUTS_AND_PACKAGE_UNCHANGED',b.source.commit,b.controller.commit);}
 else if(mode==='inventory'){const inventory=writeRoom25ArtifactInventory(out);console.log('ROOM25_ACTUAL_MEMBER_INVENTORY',inventory.files.length,inventory.totalBytes);}
 else throw Error('Unknown diagnostic freeze command');
}
