import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {pathToFileURL,fileURLToPath} from 'node:url';
import http from 'node:http';

// This file exists only on the isolated diagnostic child commit. Nothing here
// is an acceptance issuer, publisher, alternate production URL or game hook.
const root=process.cwd(),here=path.dirname(fileURLToPath(import.meta.url));
const out=path.join(root,'qa/lifecycle-probe');fs.mkdirSync(out,{recursive:true});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const manifest=JSON.parse(fs.readFileSync(path.join(here,'manifest.json')));
const commit=git('rev-parse','HEAD'),tree=git('rev-parse','HEAD^{tree}');
const noAcceptance={diagnosticClassification:'LOCALDIAGNOSTIC',sourceAccepted:false,publicationAccepted:false,humanAccepted:false,publicAccepted:false};
const producer={GITHUB_SHA:process.env.GITHUB_SHA||null,GITHUB_RUN_ID:process.env.GITHUB_RUN_ID||null,GITHUB_RUN_ATTEMPT:process.env.GITHUB_RUN_ATTEMPT||null};
const summary={schemaVersion:1,kind:'v62-local-lifecycle-diagnostic',diagnosticIteration:3,...noAcceptance,pass:false,producer,commit,tree,
 candidateCommit:manifest.candidateCommit,candidateTree:manifest.candidateTree,
 scope:'An isolated child commit builds its real package and runs candidate UI/storage code plus network-body controls. A read-only canonical v61 model request binds a header control; only a decisive observed header difference permits the unchanged extracted future observer entry on a labeled local header mirror. This proves neither Source CI acceptance nor canonical v62 Public network/deployment acceptance.',
 steps:[],errors:[],bindings:[],limits:['P is a diagnostic child of C and its build stamp truthfully names P.','The read-only canonical v61 model is a cache/byte control; canonical v62 Public acceptance and deployment remain unproven.','No accepted receipt or frozen controller configuration is constructed.','No puzzle passage, movie acceptance, camera acceptance, device FPS or live Yandex platform claim is made.']};
const save=()=>fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summary,null,2)+'\n');
save();
assert.equal(manifest.kind,'v62-isolated-lifecycle-probe-inputs');
assert.deepEqual(manifest.acceptance,noAcceptance);
assert.match(manifest.candidateCommit,/^[a-f0-9]{40}$/);
assert.equal(git('rev-parse',`${manifest.candidateCommit}^{tree}`),manifest.candidateTree);
assert.deepEqual(git('show','-s','--format=%P','HEAD').split(' '),[manifest.candidateCommit]);
assert.deepEqual(git('diff','--name-only',manifest.candidateCommit,'HEAD').split('\n').filter(Boolean).sort(),[...manifest.probePaths].sort());
for(const record of manifest.candidateBindings){
 const bytes=fs.readFileSync(path.join(root,record.path));
 assert.equal(bytes.length,record.bytes,record.path+' length');assert.equal(sha(bytes),record.sha256,record.path+' sha256');
 const original=execFileSync('git',['show',`${manifest.candidateCommit}:${record.path}`],{cwd:root});
 assert.deepEqual(bytes,original,record.path+' differs from C');
 summary.bindings.push(record);
}
const observerFile=path.join(here,'public-observer.sha-bound.mjs'),observerBytes=fs.readFileSync(observerFile);
assert.equal(observerBytes.length,manifest.futureObserver.bytes);assert.equal(sha(observerBytes),manifest.futureObserver.sha256);
const matrixFile=path.join(root,manifest.matrixModule.path),matrixBytes=fs.readFileSync(matrixFile);
assert.equal(matrixBytes.length,manifest.matrixModule.bytes);assert.equal(sha(matrixBytes),manifest.matrixModule.sha256);
const originalPlayer=fs.readFileSync(path.join(root,manifest.canonicalV61Model.sourcePath));
assert.equal(originalPlayer.length,manifest.canonicalV61Model.bytes);assert.equal(sha(originalPlayer),manifest.canonicalV61Model.sha256);
assert.equal(git('status','--porcelain','--untracked-files=no'),'');
if(process.argv[2]==='--initialize'){summary.stage='initialized-before-dependency-install';save();process.exit(0);}
assert.equal(process.argv[2],'--run');assert.equal(process.env.GITHUB_SHA,commit);assert.equal(process.env.BUILD_COMMIT,commit);
assert.equal(Number(process.env.GITHUB_RUN_ATTEMPT),1,'A fresh diagnostic cohort is required');
assert.ok(process.env.CHROME_PATH&&fs.existsSync(process.env.CHROME_PATH),'Actual Chrome executable required');

function step(name,command,args=[],env={}){
 const log=path.join(out,name+'.log'),fd=fs.openSync(log,'w');let result;
 try{result=spawnSync(command,args,{cwd:root,env:{...process.env,...env},stdio:['ignore',fd,fd],timeout:600000});}finally{fs.closeSync(fd);}
 const row={name,command:[command,...args],status:result.status,signal:result.signal??null,
  log:{path:path.relative(out,log),bytes:fs.statSync(log).size,sha256:sha(fs.readFileSync(log))},pass:result.status===0&&!result.error};
 if(result.error)row.error=String(result.error.stack||result.error);
 summary.steps.push(row);save();console.log(JSON.stringify({diagnosticClassification:'LOCALDIAGNOSTIC',step:name,pass:row.pass,status:row.status}));return row.pass;
}
function walk(directory){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(e=>{
 const file=path.join(directory,e.name);assert.equal(e.isSymbolicLink(),false);return e.isDirectory()?walk(file):[file];
});}
function classifyReports(){
 // Preserve the actual source-produced bytes, then expose a clearly marked
 // diagnostic envelope. This never changes the candidate runners or package.
 for(const file of walk(out).filter(p=>p.endsWith('.json')&&p!==path.join(out,'summary.json')&&!p.startsWith(path.join(out,'yandex-extracted')+path.sep))){
  const bytes=fs.readFileSync(file);let value;try{value=JSON.parse(bytes);}catch{continue;}
  if(!value||typeof value!=='object'||Array.isArray(value))continue;
  if(value.diagnosticClassification==='LOCALDIAGNOSTIC')continue;
  const original=file+'.original-bytes';fs.writeFileSync(original,bytes);
  fs.writeFileSync(file,JSON.stringify({...value,...noAcceptance,originalDiagnosticBytes:{path:path.relative(out,original).split(path.sep).join('/'),bytes:bytes.length,sha256:sha(bytes)}},null,2)+'\n');
 }
}
async function serveDiagnosticObservedHeaderPackage(directory,cacheControl){
 assert.equal(typeof cacheControl,'string');assert.ok(cacheControl.length>0&&cacheControl.length<=512&&!/[\r\n]/.test(cacheControl));
 const files=new Map(walk(directory).map(file=>[path.relative(directory,file).split(path.sep).join('/'),{file,bytes:fs.statSync(file).size}]));
 const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.glb':'model/gltf-binary','.wasm':'application/wasm','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.ogg':'audio/ogg','.mp3':'audio/mpeg'};
 const prefix='/campaign-v62/',server=http.createServer((req,res)=>{
  try{
   const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);assert.ok(pathname.startsWith(prefix));
   const relative=pathname.slice(prefix.length)+(pathname.endsWith('/')?'index.html':'');assert.ok(relative&&!relative.includes('\\')&&!relative.split('/').some(x=>!x||x==='.'||x==='..'));
   const entry=files.get(relative);assert.ok(entry);res.writeHead(200,{'Content-Type':types[path.extname(relative)]||'application/octet-stream','Content-Length':entry.bytes,'Cache-Control':cacheControl});fs.createReadStream(entry.file).pipe(res);
  }catch{res.writeHead(404).end();}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 return {server,url:`http://127.0.0.1:${server.address().port}${prefix}`,cacheControl};
}
async function observerEntry(matrix){
 assert.equal(matrix.diagnosticClassification,'LOCALDIAGNOSTIC');assert.equal(matrix.pass,true);
 for(const flag of ['sourceAccepted','publicationAccepted','humanAccepted','publicAccepted'])assert.equal(matrix[flag],false);
 const {classifyMatrix}=await import(pathToFileURL(matrixFile).href);
 assert.deepEqual(matrix.decisiveCacheHeader,classifyMatrix(matrix.cases,matrix.publicHeaderBinding),'Header decision differs from the pinned classifier and actual measured rows');
 assert.equal(matrix.puppeteer.version,'24.16.0');assert.equal(matrix.browser.executablePath,process.env.CHROME_PATH);
 const loaderBinding=manifest.candidateBindings.find(row=>row.path==='src/game/LabAssetLoader.js');
 assert.equal(matrix.actualSource.path,loaderBinding.path);assert.equal(matrix.actualSource.bytes,loaderBinding.bytes);assert.equal(matrix.actualSource.sha256,loaderBinding.sha256);
 assert.equal(matrix.decisiveCacheHeader.decisive,true,'Cache policy has not been established as a decisive control');
 assert.equal(matrix.decisiveCacheHeader.negativeControlsPassed,true,'Transport negative controls must remain rejected');
 const header=matrix.publicHeaderBinding;assert.equal(header.status,200);assert.equal(header.matchesExactC,true);
 assert.equal(header.sourceDistRelativePath,'models/runtime/model-01-player.glb');
 assert.equal(header.url,manifest.canonicalV61Model.url);assert.equal(header.bytes,manifest.canonicalV61Model.bytes);assert.equal(header.sha256,manifest.canonicalV61Model.sha256);
 assert.equal(matrix.decisiveCacheHeader.cacheControl,header.cacheControl);
 const mounted=await serveDiagnosticObservedHeaderPackage(path.join(root,'dist'),header.cacheControl);
 try{
  const observerOut=path.join(out,'future-observer-entry');fs.mkdirSync(observerOut,{recursive:true});
  const infoBytes=fs.readFileSync(path.join(root,'dist/build-info.json')),info=JSON.parse(infoBytes);
  assert.equal(info.commit,commit);assert.equal(info.verified,false);
  const text=observerBytes.toString('utf8');
  const begin=text.indexOf('\nfunction decodeFrame('),end=text.indexOf("\nif(mode==='entry')await entry();");
  assert.ok(begin>=0&&end>begin,'Actual observer extraction markers changed');
  assert.equal(text.indexOf('\nfunction decodeFrame(',begin+1),-1);
  assert.equal(text.indexOf("\nif(mode==='entry')await entry();",end+1),-1);
  const extracted=text.slice(begin+1,end);
  assert.equal(sha(Buffer.from(extracted)),manifest.futureObserver.extractedSha256,'Future observer entry/helper bytes changed');
  assert.ok(extracted.includes('async function entry(){'));
  assert.ok(extracted.includes('assertCampaignPreferenceLifecycleObservation'));
  const networkBegin=text.indexOf('\nconst originalLaunch=puppeteer.launch.bind(puppeteer);'),networkEnd=text.indexOf('\nfunction save(file,value){');
  assert.ok(networkBegin>=0&&networkEnd>networkBegin,'Actual network observer extraction markers changed');
  assert.equal(text.indexOf('\nconst originalLaunch=puppeteer.launch.bind(puppeteer);',networkBegin+1),-1);
  assert.equal(text.indexOf('\nfunction save(file,value){',networkEnd+1),-1);
  const networkObserver=text.slice(networkBegin+1,networkEnd+1);
  assert.equal(sha(Buffer.from(networkObserver)),manifest.futureObserver.networkObserverSha256,'Future network observer bytes changed');
  const packageFiles=walk(path.join(root,'dist')).sort().map(file=>({path:path.relative(path.join(root,'dist'),file).split(path.sep).join('/'),bytes:fs.statSync(file).size,sha256:sha(fs.readFileSync(file))}));
  const packageInventorySha256=sha(Buffer.from(JSON.stringify(packageFiles)));
  const packageRoot=path.join(root,'node_modules/puppeteer-core');
  const ppJSON=JSON.parse(fs.readFileSync(path.join(packageRoot,'package.json')));assert.equal(ppJSON.version,'24.16.0');
  let entryPoint=ppJSON.exports?.['.']?.import;while(entryPoint&&typeof entryPoint==='object')entryPoint=entryPoint.default||entryPoint.node||entryPoint.import;
  assert.equal(typeof entryPoint,'string');const puppeteerModule=path.resolve(packageRoot,entryPoint);assert.ok(puppeteerModule.startsWith(packageRoot+path.sep));
  const facts={root,source:root,out:observerOut,base:mounted.url,commit,producer,buildInfoSha256:sha(infoBytes),packageFiles,packageInventorySha256,
   futureObserver:manifest.futureObserver,noAcceptance,diagnosticOnlyPublicHeaderMirror:{canonicalURL:header.url,canonicalBytes:header.bytes,canonicalSha256:header.sha256,observedCacheControl:header.cacheControl}};
  fs.writeFileSync(path.join(observerOut,'local-binding.json'),JSON.stringify({kind:'local-extracted-observer-entry-binding',...noAcceptance,
   probeCommit:commit,candidateCommit:manifest.candidateCommit,producer,url:mounted.url,buildInfoSha256:sha(infoBytes),packageInventorySha256,
   futureObserver:manifest.futureObserver,helpersAndEntryUnchanged:true,networkObserverUnchanged:true,diagnosticOnlyPublicHeaderMirror:facts.diagnosticOnlyPublicHeaderMirror},null,2)+'\n');
  const prelude=`import assert from 'node:assert/strict';\nimport fs from 'node:fs';\nimport path from 'node:path';\nimport {createHash} from 'node:crypto';\nimport {pathToFileURL} from 'node:url';\nimport {spawnSync} from 'node:child_process';\nimport puppeteer from ${JSON.stringify(pathToFileURL(puppeteerModule).href)};\nconst facts=${JSON.stringify(facts)};\n`+String.raw`
const {root,source,out,base}=facts;
const config={sourceCommit:facts.commit};
const prepared={producer:facts.producer,originalBuildInfoSha256:facts.buildInfoSha256};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const pending=[],network=[],failures=[],stampReads=[];
const members=new Map(facts.packageFiles.map(r=>[new URL(r.path,base).href,r]));members.set(base,members.get(new URL('index.html',base).href));
`;
  const diagnosticSave=String.raw`
function save(file,value){fs.writeFileSync(path.join(out,file),JSON.stringify({...value,originalKind:value.kind,kind:'LOCALDIAGNOSTIC-extracted-future-observer-entry',...facts.noAcceptance,probeCommit:facts.commit,observerSha256:facts.futureObserver.sha256},null,2)+'\n');}
`;
  const module=prelude+'\n'+networkObserver+'\n'+diagnosticSave+'\n'+extracted+'\nawait entry();\n';
  const executedModule=path.join(observerOut,'executed-extraction.mjs');
  fs.writeFileSync(executedModule,module);
  await import(pathToFileURL(executedModule).href);
  const report=JSON.parse(fs.readFileSync(path.join(observerOut,'report.json')));assert.equal(report.pass,true);
  assert.equal(report.diagnosticClassification,'LOCALDIAGNOSTIC');assert.equal(report.publicationAccepted,false);
  summary.observerEntry={pass:true,observerSha256:manifest.futureObserver.sha256,extractedSha256:manifest.futureObserver.extractedSha256,networkObserverSha256:manifest.futureObserver.networkObserverSha256,
   localURL:mounted.url,packageInventorySha256,buildInfoSha256:sha(infoBytes),diagnosticOnlyPublicHeaderMirror:facts.diagnosticOnlyPublicHeaderMirror};
 }finally{await new Promise(resolve=>mounted.server.close(resolve));}
}

try{
 const units=step('unit-contracts',process.execPath,['--test',...manifest.unitTests]);
 const built=step('build','npm',['run','build']);
 const stamped=built&&step('stamp',process.execPath,['scripts/stamp-build.mjs']);
 if(stamped){
  step('package-check',process.execPath,['scripts/v8-package-check.mjs']);
  step('platform-check',process.execPath,['scripts/check-yandex-platform.mjs']);
  step('source-menu',process.execPath,['scripts/qa-campaign-menu.mjs'],{PRODUCTION:'1',OUT_DIR:path.join(out,'source-menu')});
  step('source-storage',process.execPath,['scripts/qa-campaign-save-isolation.mjs'],{SITE_DIR:'dist',OUT_DIR:path.join(out,'source-storage')});
  const matrixPass=step('network-body-matrix',process.execPath,[matrixFile,'--source-root',root,'--dist',path.join(root,'dist'),'--out',path.join(out,'network-body-matrix'),'--chrome-path',process.env.CHROME_PATH]);
  try{
   assert.equal(matrixPass,true,'Network body diagnostic matrix did not complete');
   const matrix=JSON.parse(fs.readFileSync(path.join(out,'network-body-matrix/network-body-matrix.json')));
   summary.networkBodyMatrix={pass:matrix.pass,decisiveCacheHeader:matrix.decisiveCacheHeader,publicHeaderBinding:matrix.publicHeaderBinding};
   await observerEntry(matrix);summary.steps.push({name:'future-observer-entry',pass:true});
  }catch(e){summary.steps.push({name:'future-observer-entry',pass:false,error:String(e.stack||e)});}
  const zipped=step('yandex-package',process.execPath,['scripts/package-yandex.mjs','--build',`--output=${path.join(out,'yandex-package/game.zip')}`,`--report=${path.join(out,'yandex-package/report.json')}`]);
  if(zipped){
   const extracted=step('yandex-extract',process.env.CODEX_PRIMARY_RUNTIME_PYTHON||'python3',['-m','zipfile','-e',path.join(out,'yandex-package/game.zip'),path.join(out,'yandex-extracted')]);
   if(extracted)step('yandex-nested-browser',process.execPath,['scripts/check-yandex-browser.mjs'],{YANDEX_DIR:path.join(out,'yandex-extracted'),OUT_DIR:path.join(out,'yandex-browser')});
  }
 }
 assert.equal(units,true,'Unit contracts failed');
 assert.equal(git('status','--porcelain','--untracked-files=no'),'','Tracked candidate/probe inputs changed');
 for(const r of manifest.candidateBindings)assert.equal(sha(fs.readFileSync(path.join(root,r.path))),r.sha256,r.path+' changed during diagnostics');
 assert.ok(summary.steps.length>=12);assert.ok(summary.steps.every(r=>r.pass),'One or more diagnostic steps failed');summary.pass=true;
}catch(e){summary.errors.push(String(e.stack||e));process.exitCode=1;}finally{
 classifyReports();summary.stage='finished';summary.files=walk(out).filter(file=>file!==path.join(out,'summary.json')).map(file=>({path:path.relative(out,file).split(path.sep).join('/'),bytes:fs.statSync(file).size,sha256:sha(fs.readFileSync(file))}));save();
}
