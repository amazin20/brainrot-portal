import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';

// This observer adds network observations, never game controls or source edits.
const base='https://amazin20.github.io/brainrot-portal/campaign-v60/';
const root=process.cwd(),source=path.resolve(process.env.SOURCE_DIR||'source');
const config=JSON.parse(fs.readFileSync('tools/campaign-v60-release.json'));
const prepared=JSON.parse(fs.readFileSync('proof/preparation.json'));
const out=path.resolve(process.env.OUT_DIR||'proof/entry');fs.mkdirSync(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
assert.equal(config.frozen,true);assert.equal(prepared.producer.GITHUB_SHA,process.env.GITHUB_SHA);
assert.equal(prepared.producer.GITHUB_RUN_ID,process.env.GITHUB_RUN_ID);
assert.equal(prepared.configSha256,sha(fs.readFileSync('tools/campaign-v60-release.json')));
const members=new Map(prepared.candidateFiles.map(r=>[new URL(r.path,base).href,r]));
members.set(base,members.get(new URL('index.html',base).href));
const mode=process.argv[2]||'entry',pending=[],network=[],failures=[],stampReads=[];
assert.ok(['entry','routes','attacks'].includes(mode));
const packageRoot=path.join(source,'node_modules/puppeteer-core');
const ppJSON=JSON.parse(fs.readFileSync(path.join(packageRoot,'package.json')));
assert.equal(ppJSON.version,'24.16.0');
let entryPoint=ppJSON.exports?.['.']?.import;while(entryPoint&&typeof entryPoint==='object')entryPoint=entryPoint.default||entryPoint.node||entryPoint.import;
assert.equal(typeof entryPoint,'string');const modulePath=path.resolve(packageRoot,entryPoint);assert.ok(modulePath.startsWith(packageRoot+path.sep));
const driverName=mode==='attacks'?'scripts/qa-first-chapter-attacks-browser.mjs':'scripts/qa-creative-browser.mjs';
const driverURL=pathToFileURL(path.join(source,driverName)).href;
const resolved=spawnSync(process.execPath,['--experimental-import-meta-resolve','--input-type=module','-e',
 'process.stdout.write(import.meta.resolve("puppeteer-core",process.argv[1]))',driverURL],{encoding:'utf8'});
assert.equal(resolved.status,0,resolved.stderr);assert.equal(resolved.stdout.trim(),pathToFileURL(modulePath).href,'Source driver and observer must use the same ESM Puppeteer');
const {default:puppeteer}=await import(pathToFileURL(modulePath).href);
const originalLaunch=puppeteer.launch.bind(puppeteer);
let pageCount=0;
puppeteer.launch=async options=>{
 const browser=await originalLaunch(options),newPage=browser.newPage.bind(browser),createContext=browser.createBrowserContext.bind(browser),seen=new WeakSet();
 const observePage=async page=>{
  if(seen.has(page))return page;seen.add(page);const pageNumber=++pageCount;await page.setCacheEnabled(false);
  page.on('response',response=>{
   const url=new URL(response.url());url.search='';url.hash='';const expected=members.get(url.href);
   if(!expected)return;
   const task=(async()=>{
    assert.equal(response.status(),200,'Candidate response is not an actual 200');
    const bytes=await response.buffer();assert.equal(bytes.length,expected.bytes);assert.equal(sha(bytes),expected.sha256);
    network.push({page:pageNumber,url:url.href,status:response.status(),bytes:bytes.length,sha256:sha(bytes),fromCache:response.fromCache()});
   })().catch(e=>failures.push(String(e.stack||e)));
   pending.push(task);
  });
  const goto=page.goto.bind(page);
  page.goto=async(...args)=>{
   assert.ok(String(args[0]).startsWith(base),'Native driver attempted a different public origin');
   const result=await goto(...args);
   const actual=await page.evaluate(async url=>{
    const r=await fetch(url,{cache:'no-store'});return{url:r.url,status:r.status,body:await r.text()};
   },new URL('build-info.json',base).href);
   assert.equal(actual.url,new URL('build-info.json',base).href);assert.equal(actual.status,200);
   assert.equal(sha(Buffer.from(actual.body)),prepared.originalBuildInfoSha256);
   assert.equal(JSON.parse(actual.body).commit,config.sourceCommit);
   stampReads.push({page:pageNumber,url:actual.url,status:actual.status,sha256:sha(Buffer.from(actual.body))});
   return result;
  };
  return page;
 };
 browser.newPage=async(...args)=>observePage(await newPage(...args));
 browser.createBrowserContext=async(...args)=>{const context=await createContext(...args),contextNewPage=context.newPage.bind(context);context.newPage=async(...pageArgs)=>observePage(await contextNewPage(...pageArgs));return context;};
 return browser;
};
function save(file,value){fs.writeFileSync(path.join(out,file),JSON.stringify(value,null,2)+'\n');}
function decodeFrame(file,{relative=false}={}){
 const r=spawnSync(process.env.CODEX_PRIMARY_RUNTIME_PYTHON||'python3',['-c',
  'import json,sys;from PIL import Image,ImageStat;i=Image.open(sys.argv[1]).convert("RGB");s=i.resize((64,36));assert i.width>=100 and i.height>=100 and max(ImageStat.Stat(s).stddev)>1;print(json.dumps({"width":i.width,"height":i.height}))',file],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);const b=fs.readFileSync(file);return{path:relative?path.relative(out,file).split(path.sep).join('/'):path.basename(file),bytes:b.length,sha256:sha(b),pixels:JSON.parse(r.stdout)};
}
function member(name){
 assert.equal(typeof name,'string');assert.ok(name&&!name.includes('\\')&&!name.startsWith('/')&&!name.split('/').some(v=>!v||v==='.'||v==='..'));
 const p=path.resolve(out,name);assert.ok(p.startsWith(out+path.sep));assert.equal(fs.lstatSync(p).isFile(),true);assert.equal(fs.lstatSync(p).isSymbolicLink(),false);return p;
}
function fileRecord(name){const p=member(name),b=fs.readFileSync(p);return{path:name,bytes:b.length,sha256:sha(b)};}
function retainedImages(){
 const names=[];function visit(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);assert.equal(entry.isSymbolicLink(),false);if(entry.isDirectory())visit(p);else{assert.equal(entry.isFile(),true);if(p.endsWith('.jpg'))names.push(p);}}}
 visit(path.join(out,'stills'));return names.sort().map(p=>decodeFrame(p,{relative:true}));
}
async function entry(){
 const {CREATIVE_CAMPAIGN_REVISION}=await import(pathToFileURL(path.join(source,'src/game/LabPreferences.js')).href);
 const key='brainrot-portal.preferences.v24',own='brainrot-campaign-v60:'+key;
 const prefixes=['','brainrot-foundation-v1:','brainrot-open-rebuild-v1:','brainrot-campaign-v55:','brainrot-campaign-v56:','brainrot-campaign-v57:','brainrot-campaign-v58:','brainrot-campaign-v59:'];
 const historical=Object.fromEntries(prefixes.flatMap((prefix,n)=>[key,'nesi.preferences.v8'].map(k=>[prefix+k,JSON.stringify({
  campaignRevision:CREATIVE_CAMPAIGN_REVISION,completed:prefix==='brainrot-campaign-v59:'?[0,1,6,9,40]:[0],
  hints:prefix==='brainrot-campaign-v59:'?{1:2,40:3}:{1:1},resumeLevel:prefix==='brainrot-campaign-v59:'?3:5,
  quality:'low',volume:prefix==='brainrot-campaign-v59:'?.29:.11,muted:true,tutorial:true,namespace:n})])));
 const report={kind:'actual-v60-public-bare-menu-save-isolation',pass:false,publicationAccepted:false,producer:prepared.producer,
  sourceCommit:config.sourceCommit,publicURL:base,buildInfoSha256:prepared.originalBuildInfoSha256,checks:[],captures:[],errors:[]};
 let browser;
 try{
  browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH,headless:true,protocolTimeout:180000,
   args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage();await page.setViewport({width:1024,height:768});
  page.on('pageerror',e=>report.errors.push(String(e.stack||e)));
  const seed=await page.evaluateOnNewDocument(entries=>{for(const[k,v]of entries)localStorage.setItem(k,v);},Object.entries(historical));
  await page.evaluateOnNewDocument(()=>{window.__V60_STORAGE_WRITES__=[];for(const method of ['setItem','removeItem','clear']){
   const original=Storage.prototype[method];Storage.prototype[method]=function(...args){window.__V60_STORAGE_WRITES__.push({method,key:String(args[0]??'')});return original.apply(this,args);};}});
  const ready=()=>page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='ready'&&document.documentElement.dataset.gameReady==='true'&&getComputedStyle(document.querySelector('#start-screen')).opacity==='1',{timeout:180000});
  const inspect=async state=>{
   const v=await page.evaluate(({keys,own})=>({url:location.href,debug:!!window.__NESI_DEMO_GAME__||!!window.__NESI_PREFS__,state:document.documentElement.dataset.runtimeState,
    index:Number(document.documentElement.dataset.levelIndex),edition:document.body.dataset.chamberEdition,
    numbers:[...document.querySelector('#level-select').options].map(o=>Number(o.textContent.match(/^\d+/)?.[0])),
    stableIndices:[...document.querySelector('#level-select').options].map(o=>Number(o.value)),
    history:Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),own:localStorage.getItem(own),writes:window.__V60_STORAGE_WRITES__}),{keys:Object.keys(historical),own});
   assert.equal(v.url,base);assert.equal(v.debug,false);assert.equal(v.state,state);assert.equal(v.index,3);assert.equal(v.edition,'foundation');
   assert.deepEqual(v.numbers,Array.from({length:51},(_,i)=>i+1));
   assert.deepEqual(v.stableIndices,[...Array.from({length:40},(_,i)=>i),...Array.from({length:10},(_,i)=>i+41),40]);
   assert.equal(v.stableIndices.at(-1),40);assert.equal(v.numbers.at(-1),51);assert.deepEqual(v.history,historical);
   assert.ok(v.writes.every(w=>w.method!=='clear'&&w.key.startsWith('brainrot-campaign-v60:')));
   const prefs=JSON.parse(v.own);assert.deepEqual(prefs.completed,[0,1,6,9,40]);assert.deepEqual(prefs.hints,{1:2,40:3});assert.equal(prefs.resumeLevel,3);
   report.checks.push({state,index:v.index,ownPreferences:prefs,historicalUnchanged:true,writes:v.writes,sequence:{stableIndices:v.stableIndices,numbers:v.numbers,castleLast:true}});return prefs;
  };
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.removeScriptToEvaluateOnNewDocument(seed.identifier);await ready();
  assert.equal((await inspect('ready')).volume,.29);
  await page.screenshot({path:path.join(out,'bare-menu.png')});report.captures.push(decodeFrame(path.join(out,'bare-menu.png')));
  await page.click('#menu-settings-button');await page.waitForFunction(()=>document.querySelector('#menu-settings').open);
  await page.$eval('#menu-volume',e=>{e.value='37';e.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.click('#menu-tutorial');await page.click('#menu-settings-done');assert.equal((await inspect('ready')).volume,.37);
  await page.$eval('#play-button',e=>e.scrollIntoView({block:'center'}));await page.click('#play-button');
  await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='playing',{timeout:180000});await inspect('playing');
  await (await page.$('#game canvas')).screenshot({path:path.join(out,'bare-playing.png')});report.captures.push(decodeFrame(path.join(out,'bare-playing.png')));
  await page.reload({waitUntil:'domcontentloaded'});await ready();const prefs=await inspect('ready');assert.equal(prefs.volume,.37);assert.equal(prefs.tutorial,false);
  await page.setViewport({width:360,height:800});await page.$eval('#play-button',e=>e.scrollIntoView({block:'center'}));
  await page.screenshot({path:path.join(out,'mobile-menu.png')});report.captures.push(decodeFrame(path.join(out,'mobile-menu.png')));
  await Promise.all(pending);assert.deepEqual(report.errors,[]);assert.deepEqual(failures,[]);assert.ok(network.length>10&&stampReads.length>0);
  report.pass=true;report.network=network;report.browserStampReads=stampReads;save('report.json',report);
 }catch(e){report.failure=String(e.stack||e);save('report.json',report);throw e;}finally{await browser?.close();}
}
if(mode==='entry')await entry();
else if(mode==='routes'){
 const driver=path.join(source,'scripts/qa-creative-browser.mjs');
 const driverSha=sha(fs.readFileSync(driver));
 Object.assign(process.env,{PAGE_URL:base,BUILD_COMMIT:config.sourceCommit,START_SERVER:'0',CASE:'route',STRICT_CAPTURE:'1',REUSE_PAGE:'0',OUT_DIR:out});
 // The source's actual module and ordinary production hooks perform all moves.
 await import(pathToFileURL(driver).href);await Promise.all(pending);
 assert.deepEqual(failures,[]);const report=JSON.parse(fs.readFileSync(path.join(out,'report.json')));
 const levels=process.env.LEVELS.split(',').map(Number);assert.deepEqual(report.rows.map(r=>r.level),levels);
 assert.equal(report.sourceCommit,config.sourceCommit);assert.equal(report.package.commit,config.sourceCommit);assert.deepEqual(report.errors,[]);
 assert.equal(report.pass,true);assert.equal(report.capturePass,true);const images=[],novelProofs=[],impulsePhysicalProofs=[];
 for(const row of report.rows){
  const route=row.route,capture=row.captures.finish;
  assert.equal(row.pass,true);assert.equal(row.gameplayPassed,true);assert.equal(row.capturePass,true);assert.deepEqual(row.errors,[]);
  assert.equal(route.pass,true);assert.equal(route.state,'won');assert.equal(route.sameCompanion,true);assert.equal(route.sameCargoShape,true);
  assert.equal(route.cargoUUID,row.start.cargoUUID);assert.equal(route.cargoBodyId,row.start.cargoBodyId);
  assert.equal(route.resets??0,0);assert.equal(route.respawns??0,0);assert.equal(route.cargoResets??0,0);
  assert.equal(capture.ok,true);assert.equal(capture.includesHTML,false);assert.equal(capture.frame.state,'won');
  assert.equal(capture.frame.levelIndex,row.level-1);assert.equal(capture.frame.cargoUUID,row.start.cargoUUID);assert.equal(capture.frame.cargoBodyId,row.start.cargoBodyId);
  images.push(decodeFrame(path.join(out,`${row.level}-finish.jpg`)));
  if(row.level===41){
   const proof=route.milestones.find(m=>m.name==='Solved pendulum')?.physicsProof;
   assert.equal(proof?.physicalUpperCatch,true);assert.equal(proof?.twoPhysicalCatches,true);assert.equal(Object.hasOwn(proof,'upperCatchKinematic'),false);
   const {assertPendulumPhysicalProof}=await import(pathToFileURL(path.join(source,'scripts/lib/tower41-pendulum-proof.mjs')).href);
   novelProofs.push({level:41,...assertPendulumPhysicalProof(proof,row.start.cargoBodyId)});
   const {CASTLE_NATIVE_ORDER,assertCastleImpulsePhysicalProof}=await import(pathToFileURL(path.join(source,'scripts/lib/castle-impulse-native-proof.mjs')).href);
   const starts=route.milestones.filter(m=>m.name.startsWith('Start ')).map(m=>m.name.slice(6));
   const solved=route.milestones.filter(m=>m.name.startsWith('Solved ')).map(m=>m.name.slice(7));
   assert.deepEqual(starts,CASTLE_NATIVE_ORDER);assert.deepEqual(solved,CASTLE_NATIVE_ORDER);assert.equal(solved.length,12);
   const impulse=route.milestones.find(m=>m.name==='Solved impulse')?.physicsProof;
   assertCastleImpulsePhysicalProof(impulse,row.start.cargoBodyId);
   impulsePhysicalProofs.push({level:41,pass:true,originalCargoBodyId:row.start.cargoBodyId,
    originalCargoShapeId:impulse.impulseCell.originalCargoShapeId,worldStep:impulse.impulseCell.worldStep});
  }
 }
 assert.equal(pageCount,levels.length);assert.equal(stampReads.length,levels.length);
 for(let n=1;n<=pageCount;n++)assert.ok(network.some(r=>r.page===n&&r.url.endsWith('/index.html'))||network.some(r=>r.page===n&&r.url.endsWith('.js')));
 assert.equal(driverSha,sha(fs.readFileSync(driver)),'Observer modified the frozen source driver');
 save('public-binding.json',{pass:true,publicationAccepted:false,publicURL:base,sourceCommit:config.sourceCommit,producer:prepared.producer,
  driver:{path:'scripts/qa-creative-browser.mjs',sha256:driverSha},buildInfoSha256:prepared.originalBuildInfoSha256,
  freshPages:pageCount,browserStampReads:stampReads,network,decodedImages:images,novelProofs,impulsePhysicalProofs,
  scope:'Read-only response digest observer around the unchanged source QA module; actual production routes and WebGL captures.'});
}
else{
 const group=process.env.GROUP;assert.ok(['early','later'].includes(group));
 const driver=path.join(source,driverName),driverSha=sha(fs.readFileSync(driver));
 Object.assign(process.env,{PAGE_URL:base,BUILD_COMMIT:config.sourceCommit,START_SERVER:'0',SOURCE_DIR:source,CONTROLLER_DIR:source,
  BUILD_DIR:path.join(source,'dist'),SOURCE_REVIEW_RUN_ID:String(config.sourceRun),SOURCE_REVIEW_RUN_ATTEMPT:String(config.sourceAttempt),OUT_DIR:out});
 // The frozen source runner owns all ordinary inputs and its narrowly pinned
 // QA module response. This observer only binds actual package responses.
 const {runFirstChapterAttacksBrowserQA}=await import(pathToFileURL(driver).href);
 await runFirstChapterAttacksBrowserQA();await Promise.all(pending);assert.deepEqual(failures,[]);
 const report=JSON.parse(fs.readFileSync(member('first-chapter-attacks-browser-report.json')));
 assert.equal(report.kind,'actual-first-chapter-ordinary-attacks-browser-diagnostic');assert.equal(report.group,group);assert.equal(report.pass,true);
 assert.equal(report.publicationAccepted,false);assert.equal(report.humanAccepted,false);
 assert.equal(report.source.commit,config.sourceCommit);assert.equal(report.source.tree,config.sourceTree);
 assert.deepEqual(report.sourceReview,{runId:config.sourceRun,runAttempt:config.sourceAttempt});
 assert.equal(report.controller.commit,config.sourceCommit);assert.equal(report.controller.runId,Number(process.env.GITHUB_RUN_ID));
 assert.equal(report.controller.runAttempt,Number(process.env.GITHUB_RUN_ATTEMPT));
 assert.deepEqual(report.providerRun,{commit:process.env.GITHUB_SHA,runId:Number(process.env.GITHUB_RUN_ID),runAttempt:Number(process.env.GITHUB_RUN_ATTEMPT)});
 assert.equal(report.package.buildInfoSha256,prepared.originalBuildInfoSha256);
 assert.equal(pageCount,report.caseObservations.length);assert.equal(stampReads.length,pageCount);
 for(let n=1;n<=pageCount;n++)assert.ok(network.some(r=>r.page===n&&(r.url.endsWith('/index.html')||r.url.endsWith('.js'))));
 const images=report.closedMedia.map(r=>r.filename).sort().map(name=>decodeFrame(member(name),{relative:true}));
 assert.equal(images.length,pageCount*2);assert.equal(driverSha,sha(fs.readFileSync(driver)),'Observer modified frozen attack runner');
 save('public-binding.json',{schemaVersion:1,kind:'actual-v60-public-attacks-binding',pass:true,publicationAccepted:false,
  group,publicURL:base,sourceCommit:config.sourceCommit,sourceTree:config.sourceTree,producer:prepared.producer,
  driver:{path:driverName,sha256:driverSha},buildInfoSha256:prepared.originalBuildInfoSha256,
  freshPages:pageCount,browserStampReads:stampReads,network,decodedImages:images,
  sourceReport:fileRecord('first-chapter-attacks-browser-report.json'),pureReport:fileRecord(group+'-attacks-report.json'),closedMediaInventory:fileRecord('closed-media-member-inventory.json'),
  scope:'Unchanged frozen Source attack runner on the exact Public package; actual response digests and retained native canvas bytes.'});
}
assert.equal(root,process.cwd());
