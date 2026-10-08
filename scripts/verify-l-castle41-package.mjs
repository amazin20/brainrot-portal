import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {PIN} from './lib/castle41-native-plan.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
export async function verifyFrozenL({sourceRoot,packageRoot,archive,downloadProof=null}){
 const git=(...a)=>execFileSync('git',a,{cwd:sourceRoot,encoding:'utf8'}).trim();
 assert.equal(git('rev-parse','HEAD'),PIN.commit);assert.equal(git('rev-parse','HEAD^{tree}'),PIN.tree);
 assert.equal(git('status','--porcelain','--untracked-files=all'),'','Frozen source checkout must be clean');
 const fileHash=f=>hash(fs.readFileSync(path.join(sourceRoot,f)));
 assert.equal(fileHash(PIN.workflow),PIN.workflowSha256);
 assert.equal(fileHash('scripts/qa-browser-capture.mjs'),PIN.captureHelperSha256);
 assert.equal(fileHash('src/game/LabControls.js'),PIN.controlsSha256);
 assert.equal(fileHash('src/game/InputController.js'),PIN.inputSha256);
 assert.equal(hash(fs.readFileSync(archive)),PIN.outerSha256);assert.equal(fs.statSync(archive).size,PIN.artifactBytes);
 const bytes=fs.readFileSync(path.join(packageRoot,'build-info.json')),info=JSON.parse(bytes);
 assert.equal(hash(bytes),PIN.buildInfoSha256);assert.equal(info.commit,PIN.commit);assert.equal(info.gameCommit,PIN.commit);assert.equal(info.interfaceCommit,PIN.commit);
 assert.equal(info.run,String(PIN.run));assert.equal(info.platformArchive,null);
 const {buildSourceInputs,verifyReleasePackage,verifyReleaseMetadata}=await import(pathToFileURL(path.join(sourceRoot,'scripts/lib/release-manifest.mjs')).href);
 const inputs=buildSourceInputs(sourceRoot);assert.equal(inputs.length,PIN.sourceInputFiles);assert.equal(hash(JSON.stringify(inputs)),PIN.sourceInputsSha256);
 assert.equal(info.sourceInputsSha256,PIN.sourceInputsSha256);assert.equal(info.packageFilesSha256,PIN.packageFilesSha256);
 const files=verifyReleasePackage(info,packageRoot);
 verifyReleaseMetadata(info,{directory:packageRoot,commit:PIN.commit,platformArchive:null,root:sourceRoot,run:String(PIN.run)});
 let downloaded=null;if(downloadProof){downloaded=JSON.parse(fs.readFileSync(downloadProof));assert.deepEqual(downloaded.pin,PIN);
  assert.equal(downloaded.outerZipSha256,PIN.outerSha256);assert.equal(downloaded.safeExtraction,true);assert.equal(downloaded.run.head_sha,PIN.commit);assert.equal(downloaded.run.run_attempt,PIN.attempt);}
 return {pin:PIN,sourceHead:PIN.commit,sourceTree:PIN.tree,sourceClean:true,sourceInputFiles:inputs.length,
  sourceInputsSha256:hash(JSON.stringify(inputs)),workflowSha256:fileHash(PIN.workflow),inputSha256:fileHash('src/game/InputController.js'),controlsSha256:fileHash('src/game/LabControls.js'),
  outerZipSha256:hash(fs.readFileSync(archive)),buildInfoSha256:hash(bytes),packageFilesSha256:hash(JSON.stringify(files)),packageFiles:files.length,downloaded};
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname)){
 const [sourceRoot,packageRoot,archive,downloadProof,out]=process.argv.slice(2);assert.ok(sourceRoot&&packageRoot&&archive&&out,'source package outerZIP downloadProof output required');
 const result=await verifyFrozenL({sourceRoot:path.resolve(sourceRoot),packageRoot:path.resolve(packageRoot),archive:path.resolve(archive),downloadProof:downloadProof==='-'?null:path.resolve(downloadProof)});
 fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log('Frozen L verified:',result.outerZipSha256,result.sourceInputsSha256);
}
