import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {sha,inventory} from './campaign-v56-proof.mjs';

/** Recheck the exact SOURCE-produced upload archive, never rebuilding its runtime. */
export function assertYandexPackage({directory,source,spec,manifest}){
 directory=path.resolve(directory);source=path.resolve(source);
 assert.deepEqual(fs.readdirSync(directory).sort(),['brainrot-portal-v56-yandex.zip','report.json']);
 for(const filename of fs.readdirSync(directory)){const stat=fs.lstatSync(path.join(directory,filename));assert.equal(stat.isSymbolicLink(),false);assert.equal(stat.isFile(),true);assert.ok(stat.size>0&&stat.size<=(filename.endsWith('.zip')?100000000:25000000));}
 const report=JSON.parse(fs.readFileSync(path.join(directory,'report.json'))),archive=path.join(directory,'brainrot-portal-v56-yandex.zip'),raw=fs.readFileSync(archive);
 assert.equal(report.pass,true);assert.equal(report.workingTreeModified,false);assert.equal(report.builtFromCurrentSource,true);
 assert.equal(report.scope,'Archive structure, files, hashes and 51-level model coverage; not live SDK, hardware FPS or moderation approval');assert.equal(report.sdkScript,'/sdk.js supplied by the Yandex upload host, not included');
 for(const key of ['sourceCommit','sourceTree','sourceParent'])assert.equal(report[key],spec[key]);
 assert.equal(report.run,String(spec.sourceReview.runId));assert.equal(report.runAttempt,String(spec.sourceReview.runAttempt));assert.equal(report.archiveFilename,path.basename(archive));
 assert.equal(report.limitBytes,100000000);assert.ok(raw.length>0&&raw.length<=report.limitBytes);assert.equal(report.compressedBytes,raw.length);assert.equal(report.sha256,sha(raw));
 assert.equal(report.levels,51);assert.equal(report.models,14);assert.ok(report.modelBytes>0&&report.modelBytes<4000000);
 assert.equal(report.sourceInputFiles,manifest.sourceInputFiles);assert.equal(report.sourceInputsSha256,manifest.sourceInputsSha256);
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'campaign-v56-yandex-verification-'));
 try{
  // Reject a declared decompression bomb before the bounded archive helper writes any entry.
  const preflight="import sys,zipfile\nz=zipfile.ZipFile(sys.argv[1]);r=z.infolist();assert 5<len(r)<=10000;assert 'index.html' in z.namelist(),'The upload ZIP must have literal root index.html';assert all(not p.is_dir() for p in r);assert sum(p.file_size for p in r)<=100000000;assert all(p.file_size<=100000000 for p in r);assert z.testzip() is None\n";
  execFileSync(process.env.CODEX_PRIMARY_RUNTIME_PYTHON||'python3',['-c',preflight,archive],{stdio:'pipe',maxBuffer:1000000});
  const extracted=path.join(temporary,'runtime');
  execFileSync(process.env.CODEX_PRIMARY_RUNTIME_PYTHON||'python3',[new URL('../publish-campaign-v56.py',import.meta.url).pathname,'extract-zip','--zip',archive,'--output',extracted,'--expected-bytes',String(raw.length),'--expected-sha256',report.sha256],{stdio:'pipe',maxBuffer:1000000});
  const actual=inventory(extracted,{maximum:100000000}).map(({path:filename,...rest})=>({filename,...rest}));
  assert.deepEqual(actual,report.files);assert.equal(actual.reduce((sum,row)=>sum+row.bytes,0),report.unpackedBytes);assert.ok(report.unpackedBytes<=100000000);
  // The frozen source's existing platform package checker independently checks
  // every referenced resource, all51 room/model dependencies and absence of QA.
  const checkedReport=path.join(temporary,'checked-report.json');
  execFileSync(process.execPath,[path.join(source,'scripts/package-yandex.mjs'),'--input='+extracted,'--output='+path.join(temporary,path.basename(archive)),'--report='+checkedReport],{
   cwd:source,env:{...process.env,GITHUB_RUN_ID:String(spec.sourceReview.runId),GITHUB_RUN_ATTEMPT:String(spec.sourceReview.runAttempt)},stdio:'pipe',maxBuffer:5000000});
  const checked=JSON.parse(fs.readFileSync(checkedReport));
  assert.equal(checked.pass,true);assert.equal(checked.workingTreeModified,false);assert.deepEqual(checked.files,actual);assert.equal(checked.sourceInputsSha256,report.sourceInputsSha256);assert.equal(checked.unpackedBytes,report.unpackedBytes);
  for(const key of ['sourceCommit','sourceTree','sourceParent','run','runAttempt','archiveFilename','sourceInputFiles','levels','models','modelBytes','sdkScript','scope'])assert.equal(checked[key],report[key]);
  for(const file of actual.filter(row=>row.filename.startsWith('models/')||row.filename.startsWith('draco/'))){
   const ordinary=manifest.files.find(row=>row.path===file.filename);assert.ok(ordinary,'Yandex model/decoder absent from accepted public source');assert.equal(ordinary.bytes,file.bytes);assert.equal(ordinary.sha256,file.sha256);
  }
  assert.equal(fs.statSync(archive).size,raw.length);assert.equal(sha(fs.readFileSync(archive)),report.sha256);
  return {pass:true,sourceCommit:spec.sourceCommit,sourceReview:spec.sourceReview,archiveFilename:report.archiveFilename,zipBytes:raw.length,zipSha256:report.sha256,unpackedBytes:report.unpackedBytes,files:actual.length,levels:51,models:14,modelBytes:report.modelBytes,qaModulesAbsent:true,
   scope:'Exact SOURCE-produced ZIP CRC/inventory/resources/model coverage; frozen package checker independently rerun. SDK mocks and real moderation remain separate evidence.'};
 }finally{fs.rmSync(temporary,{recursive:true,force:true});}
}
