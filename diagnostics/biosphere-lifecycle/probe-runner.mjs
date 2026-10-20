import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {pathToFileURL,fileURLToPath} from 'node:url';

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
const summary={schemaVersion:1,kind:'v62-local-lifecycle-diagnostic',...noAcceptance,pass:false,producer,commit,tree,
 candidateCommit:manifest.candidateCommit,candidateTree:manifest.candidateTree,
 scope:'An isolated child commit builds its own real package and runs the candidate UI/storage code plus an unchanged extracted future observer entry against localhost. This proves neither Source CI acceptance nor canonical Public network/deployment acceptance.',
 steps:[],errors:[],bindings:[],limits:['P is a diagnostic child of C and its build stamp truthfully names P.','No canonical Public URL or network/deployment acceptance is exercised.','No accepted receipt or frozen controller configuration is constructed.','No puzzle passage, movie acceptance, camera acceptance, device FPS or live Yandex platform claim is made.']};
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
async function observerEntry(){
 const {serveFrozenCampaign}=await import(pathToFileURL(path.join(root,'scripts/lib/frozen-campaign-server.mjs')).href);
 const mounted=await serveFrozenCampaign(path.join(root,'dist'));
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
  const packageFiles=walk(path.join(root,'dist')).sort().map(file=>({path:path.relative(path.join(root,'dist'),file).split(path.sep).join('/'),bytes:fs.statSync(file).size,sha256:sha(fs.readFileSync(file))}));
  const packageInventorySha256=sha(Buffer.from(JSON.stringify(packageFiles)));
  const packageRoot=path.join(root,'node_modules/puppeteer-core');
  const ppJSON=JSON.parse(fs.readFileSync(path.join(packageRoot,'package.json')));assert.equal(ppJSON.version,'24.16.0');
  let entryPoint=ppJSON.exports?.['.']?.import;while(entryPoint&&typeof entryPoint==='object')entryPoint=entryPoint.default||entryPoint.node||entryPoint.import;
  assert.equal(typeof entryPoint,'string');const puppeteerModule=path.resolve(packageRoot,entryPoint);assert.ok(puppeteerModule.startsWith(packageRoot+path.sep));
  const facts={root,source:root,out:observerOut,base:mounted.url,commit,producer,buildInfoSha256:sha(infoBytes),packageFiles,packageInventorySha256,
   futureObserver:manifest.futureObserver,noAcceptance};
  fs.writeFileSync(path.join(observerOut,'local-binding.json'),JSON.stringify({kind:'local-extracted-observer-entry-binding',...noAcceptance,
   probeCommit:commit,candidateCommit:manifest.candidateCommit,producer,url:mounted.url,buildInfoSha256:sha(infoBytes),packageInventorySha256,
   futureObserver:manifest.futureObserver,helpersAndEntryUnchanged:true},null,2)+'\n');
  const prelude=`import assert from 'node:assert/strict';\nimport fs from 'node:fs';\nimport path from 'node:path';\nimport {createHash} from 'node:crypto';\nimport {pathToFileURL} from 'node:url';\nimport {spawnSync} from 'node:child_process';\nimport puppeteer from ${JSON.stringify(pathToFileURL(puppeteerModule).href)};\nconst facts=${JSON.stringify(facts)};\n`+String.raw`
const {root,source,out,base}=facts;
const config={sourceCommit:facts.commit};
const prepared={producer:facts.producer,originalBuildInfoSha256:facts.buildInfoSha256};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const pending=[],network=[],failures=[],stampReads=[];
const members=new Map(facts.packageFiles.map(r=>[new URL(r.path,base).href,r]));members.set(base,members.get(new URL('index.html',base).href));
const originalLaunch=puppeteer.launch.bind(puppeteer);let pageCount=0;
puppeteer.launch=async options=>{
 const browser=await originalLaunch(options),newPage=browser.newPage.bind(browser);
 browser.newPage=async(...args)=>{
  const page=await newPage(...args),pageNumber=++pageCount;await page.setCacheEnabled(false);
  page.on('response',response=>{const url=new URL(response.url());url.search='';url.hash='';const expected=members.get(url.href);if(!expected)return;
   pending.push((async()=>{assert.equal(response.status(),200);const bytes=await response.buffer();assert.equal(bytes.length,expected.bytes);assert.equal(sha(bytes),expected.sha256);
    network.push({page:pageNumber,url:url.href,status:response.status(),bytes:bytes.length,sha256:sha(bytes),fromCache:response.fromCache()});})().catch(e=>failures.push(String(e.stack||e))));});
  const goto=page.goto.bind(page);page.goto=async(...args)=>{
   assert.ok(String(args[0]).startsWith(base),'Diagnostic observer must remain on its local package mount');const result=await goto(...args);
   const actual=await page.evaluate(async url=>{const r=await fetch(url,{cache:'no-store'});return{url:r.url,status:r.status,body:await r.text()};},new URL('build-info.json',base).href);
   assert.equal(actual.url,new URL('build-info.json',base).href);assert.equal(actual.status,200);assert.equal(sha(Buffer.from(actual.body)),prepared.originalBuildInfoSha256);assert.equal(JSON.parse(actual.body).commit,config.sourceCommit);
   stampReads.push({page:pageNumber,url:actual.url,status:actual.status,sha256:sha(Buffer.from(actual.body))});return result;};return page;};return browser;
};
function save(file,value){fs.writeFileSync(path.join(out,file),JSON.stringify({...value,originalKind:value.kind,kind:'LOCALDIAGNOSTIC-extracted-future-observer-entry',...facts.noAcceptance,probeCommit:facts.commit,observerSha256:facts.futureObserver.sha256},null,2)+'\n');}
`;
  const module=prelude+'\n'+extracted+'\nawait entry();\n';
  const executedModule=path.join(observerOut,'executed-extraction.mjs');
  fs.writeFileSync(executedModule,module);
  await import(pathToFileURL(executedModule).href);
  const report=JSON.parse(fs.readFileSync(path.join(observerOut,'report.json')));assert.equal(report.pass,true);
  assert.equal(report.diagnosticClassification,'LOCALDIAGNOSTIC');assert.equal(report.publicationAccepted,false);
  summary.observerEntry={pass:true,observerSha256:manifest.futureObserver.sha256,extractedSha256:manifest.futureObserver.extractedSha256,
   localURL:mounted.url,packageInventorySha256,buildInfoSha256:sha(infoBytes)};
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
  try{await observerEntry();summary.steps.push({name:'future-observer-entry',pass:true});}catch(e){summary.steps.push({name:'future-observer-entry',pass:false,error:String(e.stack||e)});}
  const zipped=step('yandex-package',process.execPath,['scripts/package-yandex.mjs','--build',`--output=${path.join(out,'yandex-package/game.zip')}`,`--report=${path.join(out,'yandex-package/report.json')}`]);
  if(zipped){
   const extracted=step('yandex-extract',process.env.CODEX_PRIMARY_RUNTIME_PYTHON||'python3',['-m','zipfile','-e',path.join(out,'yandex-package/game.zip'),path.join(out,'yandex-extracted')]);
   if(extracted)step('yandex-nested-browser',process.execPath,['scripts/check-yandex-browser.mjs'],{YANDEX_DIR:path.join(out,'yandex-extracted'),OUT_DIR:path.join(out,'yandex-browser')});
  }
 }
 assert.equal(units,true,'Unit contracts failed');
 assert.equal(git('status','--porcelain','--untracked-files=no'),'','Tracked candidate/probe inputs changed');
 for(const r of manifest.candidateBindings)assert.equal(sha(fs.readFileSync(path.join(root,r.path))),r.sha256,r.path+' changed during diagnostics');
 assert.ok(summary.steps.length>=11);assert.ok(summary.steps.every(r=>r.pass),'One or more diagnostic steps failed');summary.pass=true;
}catch(e){summary.errors.push(String(e.stack||e));process.exitCode=1;}finally{
 classifyReports();summary.stage='finished';summary.files=walk(out).filter(file=>file!==path.join(out,'summary.json')).map(file=>({path:path.relative(out,file).split(path.sep).join('/'),bytes:fs.statSync(file).size,sha256:sha(fs.readFileSync(file))}));save();
}
