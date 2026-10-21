/** Exact production package startup and recovery with an explicit local SDK.
 * Observers capture real menu frames and ready()/native Play ordering. They
 * neither substitute game bytes nor expose a game runtime handle. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {verifyReleaseMetadata,verifyReleasePackage,sha256,walkFiles} from './lib/release-manifest.mjs';
import {createMockYandexSDKSource} from './lib/yandex-review-sdk.mjs';
import {installPinnedYandexChecker,captureYandexChecker} from './lib/yandex-debug-checker.mjs';
import {activate} from './lib/singularity-ui-check.mjs';
import {QUALITY_PRESETS} from '../src/game/LabPreferences.js';

const scopes={sourceAccepted:false,publicationAccepted:false,liveSdkAccepted:false,liveAdsAccepted:false,moderationAccepted:false,physicalPhoneTest:false,hardwareFpsMeasured:false};
const git=args=>execFileSync('git',args,{encoding:'utf8'}).trim();
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');

function bindPackage(directory,archive,packageReport){
 const commit=git(['rev-parse','HEAD']),tree=git(['rev-parse','HEAD^{tree}']);
 assert.equal(git(['status','--porcelain','--untracked-files=no']),'','Commit source before evidence');
 const local=process.env.LOCAL_DIAGNOSTIC==='1',runId=local?null:Number(process.env.GITHUB_RUN_ID),runAttempt=local?null:Number(process.env.GITHUB_RUN_ATTEMPT);
 if(!local){assert.ok(Number.isSafeInteger(runId)&&runId>0);assert.ok(Number.isSafeInteger(runAttempt)&&runAttempt>0);assert.equal(commit,process.env.BUILD_COMMIT||process.env.GITHUB_SHA);}
 const stamp=fs.readFileSync(path.join(directory,'build-info.json')),info=JSON.parse(stamp);
 verifyReleaseMetadata(info,{directory,commit,root:process.cwd(),run:info.run||null});
 const files=verifyReleasePackage(info,directory),zip=fs.readFileSync(archive),packaged=JSON.parse(fs.readFileSync(packageReport));
 assert.equal(packaged.pass,true);assert.equal(packaged.sourceCommit,commit);assert.equal(packaged.sourceTree,tree);
 assert.equal(packaged.workingTreeModified,false);assert.equal(packaged.builtFromCurrentSource,true);
 assert.equal(packaged.sourceInputsSha256,info.sourceInputsSha256);assert.equal(packaged.compressedBytes,zip.length);assert.equal(packaged.sha256,sha256(zip));
 assert.deepEqual(walkFiles(directory).map(filename=>{const bytes=fs.readFileSync(filename);return{filename:path.relative(directory,filename).split(path.sep).join('/'),bytes:bytes.length,sha256:sha256(bytes)};}),packaged.files);
 assert.ok(!files.some(row=>/Journey|debugcheck|yandex-games-debug-checker/.test(row.path)));
 assert.equal(info.version,'v65-checker-readiness');assert.equal(info.levels,51);
 return{localDiagnostic:local,sourceCommit:commit,sourceTree:tree,runId,runAttempt,sourceInputsSha256:info.sourceInputsSha256,
  packageFilesSha256:info.packageFilesSha256,buildInfoBytes:stamp.length,buildInfoSha256:sha256(stamp),files,
  archive:{name:path.basename(archive),bytes:zip.length,sha256:sha256(zip)}};
}

async function servePackage(directory,{reject=false}={}){
 const root=path.resolve(directory),prefix='/uploads/checker-readiness/game/';let rejectSdk=reject;
 const sources={normal:Buffer.from(createMockYandexSDKSource()),rejected:Buffer.from(createMockYandexSDKSource({reject:true}))};
 const sdkSources=Object.entries(sources).map(([name,bytes])=>({name,bytes:bytes.length,sha256:sha256(bytes),liveSdk:false,liveAds:false}));
 const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.glb':'model/gltf-binary','.wasm':'application/wasm','.webp':'image/webp','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'};
 const server=http.createServer((request,response)=>{try{
  const url=new URL(request.url,'http://localhost');
  if(url.pathname==='/sdk.js'){const bytes=sources[rejectSdk?'rejected':'normal'];response.writeHead(200,{'Content-Type':types['.js'],'Content-Length':bytes.length,'Cache-Control':'no-store','X-Lab-Test-SDK':'explicit-mock'});response.end(bytes);return;}
  assert.ok(url.pathname.startsWith(prefix));const relative=decodeURIComponent(url.pathname.slice(prefix.length))||'index.html',file=path.resolve(root,relative);
  assert.ok(file.startsWith(root+path.sep)&&fs.lstatSync(file).isFile()&&!fs.lstatSync(file).isSymbolicLink());
  response.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':fs.statSync(file).size,'Cache-Control':'no-store'});fs.createReadStream(file).pipe(response);
 }catch{response.writeHead(404,{'Content-Length':0}).end();}});
 await new Promise((resolve,rejectListen)=>{server.once('error',rejectListen);server.listen(0,'127.0.0.1',resolve);});
 return{server,url:`http://127.0.0.1:${server.address().port}${prefix}`,sdkSources,allowSdk(){rejectSdk=false;}};
}

function observeNetwork(page,mount,binding){
 const base=new URL(mount.url),files=new Map(binding.files.map(row=>[row.path,row]));files.set('build-info.json',{bytes:binding.buildInfoBytes,sha256:binding.buildInfoSha256});
 const rows=[],failures=[],pending=new Set();
 const handler=response=>{const job=(async()=>{
  const url=new URL(response.url());if(['data:','blob:'].includes(url.protocol))return;
  assert.equal(url.origin,base.origin);if(url.pathname.endsWith('/favicon.ico')&&response.status()===404)return;
  const sdk=url.pathname==='/sdk.js';assert.ok(sdk||url.pathname.startsWith(base.pathname));
  const relative=sdk?'/sdk.js':decodeURIComponent(url.pathname.slice(base.pathname.length))||'index.html';
  assert.ok([...url.searchParams].every(([key,value])=>key==='_dc'&&/^\d+$/.test(value)||relative==='index.html'&&['debug','level','edition','pilot','tower41preview','tower41ratchet'].includes(key)||key==='v'&&/^models\/runtime\/.+\.glb$/.test(relative)&&value===files.get(relative)?.sha256.slice(0,12)));
  assert.equal(response.status(),200);const bytes=await response.buffer(),digest=sha256(bytes);
  const pin=sdk?mount.sdkSources.find(row=>row.bytes===bytes.length&&row.sha256===digest):files.get(relative);
  assert.ok(pin,'Unknown package/SDK response');assert.equal(bytes.length,pin.bytes);assert.equal(digest,pin.sha256);
  rows.push({url:url.href,path:relative,status:200,bytes:bytes.length,sha256:digest,fromCache:response.fromCache(),explicitMockSdk:sdk,checkerScan:url.searchParams.has('_dc')});
 })().catch(error=>failures.push(response.url()+'\n'+String(error.stack||error)));pending.add(job);void job.finally(()=>pending.delete(job));};
 page.on('response',handler);
 const drain=async()=>{
  await page.waitForNetworkIdle({idleTime:250,timeout:180000});
  while(pending.size)await Promise.all([...pending]);
  assert.deepEqual(failures,[],'Every actual response body must be verified before navigation or target invalidation');
  return{allReceivedBytesMatched:true,responseCount:rows.length};
 };
 return{drain,async finish(){await drain();page.off('response',handler);assert.ok(rows.some(r=>r.path==='index.html')&&rows.some(r=>r.path==='/sdk.js')&&rows.some(r=>r.path.endsWith('.js')&&!r.explicitMockSdk));return{allReceivedBytesMatched:true,rows};}};
}

/** Test-only, closure-free observation. No game state or layout is changed. */
function observeReadyPresentation(){
 const probe={frames:[],visibleFrameCount:0,readyCalls:[]};window.__LAB_READY_PRESENTATION_OBSERVER__=probe;
 const read=()=>{
  const menu=document.querySelector('#start-screen'),button=document.querySelector('#play-button'),loading=document.querySelector('#loading'),canvas=document.querySelector('#game canvas'),r=menu?.getBoundingClientRect(),c=canvas?.getBoundingClientRect(),s=menu&&getComputedStyle(menu);
  return{time:performance.now(),runtimeState:document.documentElement.dataset.runtimeState,fonts:document.fonts?.status??null,
   menu:menu?{inert:menu.inert,ariaHidden:menu.getAttribute('aria-hidden'),opacity:Number(s.opacity),visibility:s.visibility,display:s.display,width:r.width,height:r.height}:null,
   button:button?{disabled:button.disabled,inertAncestor:!!button.closest('[inert]')}:null,
   loadingHidden:loading?.getAttribute('aria-hidden')==='true',quality:document.querySelector('#quality-select')?.value,
   canvas:canvas?{width:canvas.width,height:canvas.height,cssWidth:c.width,cssHeight:c.height}:null,
   devicePixelRatio,documentLang:document.documentElement.lang,
   qaHooks:Object.fromEntries(['__NESI_DEMO_GAME__','__NESI_PLATFORM__','__NESI_PREFS__','__NESI_RUN_LEVEL_ROUTE__','YGDebugCheckerConfig'].map(key=>[key,typeof window[key]]))};
 };
 const sample=()=>{const state=read();if(state.menu?.opacity===1&&state.menu.visibility==='visible'&&state.menu.display!=='none'&&state.menu.width>0&&state.menu.height>0){probe.visibleFrameCount++;probe.frames.push(state);if(probe.frames.length>12)probe.frames.shift();}requestAnimationFrame(sample);};requestAnimationFrame(sample);
 let api;
 Object.defineProperty(window,'YaGames',{configurable:true,get(){return api;},set(value){api=value;const init=value.init;value.init=async function(...args){const sdk=await init.apply(this,args),ready=sdk.features.LoadingAPI.ready;sdk.features.LoadingAPI.ready=function(...args){probe.readyCalls.push({...read(),visibleFrameCount:probe.visibleFrameCount,priorVisibleFrames:probe.frames.map(row=>({...row}))});return ready.apply(this,args);};return sdk;};}});
}

function blockRenderer(){const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return /^webgl2?$/.test(kind)?null:get.call(this,kind,...args);};}
function readState(){
 const mock=window.__LAB_YANDEX_MOCK__;
 return{state:document.documentElement.dataset.runtimeState,error:document.querySelector('#error-detail')?.textContent,
  errorVisible:document.querySelector('#error-screen')?.getAttribute('aria-hidden')==='false',
  readyProbe:window.__LAB_READY_PRESENTATION_OBSERVER__,mockLog:mock?.log.map(row=>({...row}))??[],
  qaHooks:Object.fromEntries(['__NESI_DEMO_GAME__','__NESI_PLATFORM__','__NESI_PREFS__','__NESI_RUN_LEVEL_ROUTE__','YGDebugCheckerConfig'].map(key=>[key,typeof window[key]])),
  selected:Number(document.querySelector('#level-select')?.value),enabledIndices:[...document.querySelectorAll('#level-select option')].filter(o=>!o.disabled).map(o=>Number(o.value))};
}
function assertProduction(state){for(const value of Object.values(state.qaHooks))assert.equal(value,'undefined','Production must not expose runtime hooks or review resolver config');}
function assertReady(state){
 assertProduction(state);assert.equal(state.state,'ready');assert.equal(state.selected,0);assert.deepEqual(state.enabledIndices,[0]);assert.equal(state.readyProbe.readyCalls.length,1);
 const actual=state.readyProbe.readyCalls[0];assert.equal(actual.fonts,'loaded');assert.equal(actual.menu.opacity,1);assert.equal(actual.menu.visibility,'visible');assert.equal(actual.menu.inert,false);assert.equal(actual.menu.ariaHidden,'false');assert.equal(actual.button.inertAncestor,false);assert.equal(actual.button.disabled,false);assert.equal(actual.loadingHidden,true);assert.equal(actual.documentLang,'ru');assert.equal(actual.runtimeState,'ready');
 assert.ok(actual.visibleFrameCount>=1&&actual.priorVisibleFrames.some(frame=>frame.time<actual.time),'Menu must have an independently observed full visible frame before ready');
 const ratio=Math.min(actual.devicePixelRatio,QUALITY_PRESETS[actual.quality].pixelRatio);assert.equal(actual.canvas.width,Math.floor(actual.canvas.cssWidth*ratio));assert.equal(actual.canvas.height,Math.floor(actual.canvas.cssHeight*ratio));
 for(const type of Object.values(actual.qaHooks))assert.equal(type,'undefined');assert.equal(state.mockLog.filter(row=>row.event==='ready').length,1);assert.equal(state.mockLog.filter(row=>row.event==='start').length,0);
}

export async function runCheckerReadinessQA({directory=process.env.YANDEX_DIR||'dist-yandex',archive=process.env.YANDEX_ARCHIVE||'qa/v65-yandex/brainrot-portal-v65-yandex.zip',packageReport=process.env.YANDEX_PACKAGE_REPORT||'qa/v65-yandex/report.json',outputDirectory=process.env.OUT_DIR||'qa/checker-readiness'}={}){
 const binding=bindPackage(directory,archive,packageReport),out=path.resolve(outputDirectory);fs.mkdirSync(out,{recursive:true});assert.deepEqual(fs.readdirSync(out),[]);
 const report={kind:'v65-production-ready-and-recovery',pass:false,...scopes,binding,cases:[],errors:[],scope:'Exact extracted production ZIP; explicit local SDK, unchanged original checker on positive startup, independent rAF/menu/ready observations and native Play/retry. No live SDK/ad or physical device approval.'};let browser;
 const save=()=>write(path.join(out,'report.json'),report);
 try{
  const{default:puppeteer}=await import('puppeteer-core');browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:process.env.CHROME_HEADLESS==='shell'?'shell':true,protocolTimeout:180000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  for(const scenario of ['positive','renderer-unavailable','sdk-rejected']){
   const mount=await servePackage(directory,{reject:scenario==='sdk-rejected'}),page=await browser.newPage(),row={scenario,pass:false,sdkSources:mount.sdkSources};report.cases.push(row);page.setDefaultTimeout(180000);await page.setCacheEnabled(false);
   // Use the same CDP session as Puppeteer's HTTPResponse.buffer(). Keep
   // actual bodies available across startup/retry without substituting bytes.
   await page._client().send('Network.enable',{maxTotalBufferSize:134217728,maxResourceBufferSize:67108864,enableDurableMessages:true});
   await page.setViewport({width:960,height:640,deviceScaleFactor:1.5});
   page.on('pageerror',error=>report.errors.push({scenario,error:String(error.stack||error)}));
   try{
    await page.evaluateOnNewDocument(observeReadyPresentation);const blocked=scenario==='renderer-unavailable'?await page.evaluateOnNewDocument(blockRenderer):null;
    const original=scenario==='positive'&&!binding.localDiagnostic?await installPinnedYandexChecker(page):null;
    const network=observeNetwork(page,mount,binding);await page.goto(mount.url+'?debug=1&level=51&edition=classic',{waitUntil:'domcontentloaded'});
    if(scenario!=='positive'){
     await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='error');row.failed=await page.evaluate(readState);assertProduction(row.failed);assert.equal(row.failed.errorVisible,true);assert.match(row.failed.error,/[А-Яа-яЁё]/);assert.doesNotMatch(row.failed.error,/WebGL|THREE|initialization rejected|Error creating|stack|TypeError|ReferenceError/i);assert.equal(row.failed.readyProbe.readyCalls.length,0);assert.ok(!row.failed.mockLog.some(event=>['ready','start'].includes(event.event)));
     await page.screenshot({path:path.join(out,scenario+'-error.png')});
     if(blocked)await page.removeScriptToEvaluateOnNewDocument(blocked.identifier);mount.allowSdk();
     row.beforeNativeRetryNetwork=await network.drain();
     await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),activate(page,'#reload-button')]);
    }
    await page.waitForFunction(()=>window.__LAB_READY_PRESENTATION_OBSERVER__?.readyCalls.length===1);row.ready=await page.evaluate(readState);assertReady(row.ready);await page.screenshot({path:path.join(out,scenario+'-ready.png')});
    row.beforeNativePlayNetwork=await network.drain();
    await activate(page,'#play-button');await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='playing');row.play=await page.evaluate(readState);assertProduction(row.play);assert.ok(row.play.mockLog.some(event=>event.event==='start'));assert.equal(row.play.readyProbe.readyCalls.length,1);
    if(scenario==='positive'){
     await page.keyboard.press('Escape');await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='paused');
     await activate(page,'#level-menu-button');await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='ready');
     row.beforeFailedCheckpoint=await page.evaluate(()=>({saved:Object.fromEntries(Object.keys(localStorage).filter(key=>key.endsWith('brainrot-portal.preferences.v24')).map(key=>[key,localStorage.getItem(key)])),ads:window.__LAB_YANDEX_MOCK__.log.filter(row=>row.event==='interstitial-open').length}));
     await page.evaluate(()=>{
      const original=Storage.prototype.setItem,probe={blockedWrites:0,original};window.__LAB_STORAGE_FAILURE_OBSERVER__=probe;
      Storage.prototype.setItem=function(key,value){if(String(key).endsWith('brainrot-portal.preferences.v24')){probe.blockedWrites++;throw new DOMException('Explicit test storage rejection','QuotaExceededError');}return original.call(this,key,value);};
     });
     await activate(page,'#play-button');await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='playing');
     row.failedCheckpoint=await page.evaluate(()=>({blockedWrites:window.__LAB_STORAGE_FAILURE_OBSERVER__.blockedWrites,saved:Object.fromEntries(Object.keys(localStorage).filter(key=>key.endsWith('brainrot-portal.preferences.v24')).map(key=>[key,localStorage.getItem(key)])),ads:window.__LAB_YANDEX_MOCK__.log.filter(row=>row.event==='interstitial-open').length,state:document.documentElement.dataset.runtimeState}));
     await page.evaluate(()=>{Storage.prototype.setItem=window.__LAB_STORAGE_FAILURE_OBSERVER__.original;});
     assert.ok(row.failedCheckpoint.blockedWrites>0);assert.deepEqual(row.failedCheckpoint.saved,row.beforeFailedCheckpoint.saved);assert.equal(row.failedCheckpoint.ads,row.beforeFailedCheckpoint.ads);assert.equal(row.failedCheckpoint.state,'playing');
    }
    if(original){const checker=await captureYandexChecker(page,{outputDirectory:path.join(out,'production-original-checker'),identity:{sourceCommit:binding.sourceCommit,sourceTree:binding.sourceTree,runId:binding.runId,runAttempt:binding.runAttempt,level:1,productionPackageFilesSha256:binding.packageFilesSha256,productionArchiveSha256:binding.archive.sha256}});row.originalChecker={summary:checker.summary,counts:checker.counts};}
    row.network=await network.finish();row.pass=true;
   }catch(error){row.failureObservation=await page.evaluate(readState).catch(()=>null);throw error;}
   finally{await page.close();await new Promise(resolve=>mount.server.close(resolve));save();}
  }
  assert.deepEqual(report.errors,[]);assert.ok(report.cases.every(row=>row.pass));report.pass=true;
 }catch(error){report.failure=String(error.stack||error);throw error;}
 finally{await browser?.close().catch(()=>{});save();}
 return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await runCheckerReadinessQA();
