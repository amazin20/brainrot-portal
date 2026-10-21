/** Every requested stable room is opened through normal campaign access with
 * only a declared completed-prior-prefix QA save. The actual compiled route
 * drives ordinary controls. The unchanged upstream checker observes every page.
 * This is a TEST Yandex build with a local SDK mock, never live-platform proof. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildSourceInputs,verifyReleaseMetadata,verifyReleasePackage,sha256,walkFiles} from './lib/release-manifest.mjs';
import {campaignAccessFixture} from './lib/campaign-access-fixture.mjs';
import {FOUNDATION_SEQUENCE,foundationDisplayNumber} from '../src/game/LabCampaignSequence.js';
import {waitForStartMenu,activate} from './lib/singularity-ui-check.mjs';
import {captureBrowserFrame} from './qa-browser-capture.mjs';
import {assertFoundation20Route} from './lib/foundation20-native-proof.mjs';
import {installPinnedYandexChecker,captureYandexChecker,YANDEX_CHECKER_PIN} from './lib/yandex-debug-checker.mjs';
import {createMockYandexSDKSource,readMockYandexSDKObservation} from './lib/yandex-review-sdk.mjs';
import {RELEASE_VERSION} from '../src/game/ReleaseIdentity.js';
import {installCanvasTextObserver,readCanvasTextObservation} from './lib/canvas-text-observer.mjs';

const git=(root,args)=>execFileSync('git',args,{cwd:root,maxBuffer:32000000,encoding:'utf8'}).trim();
const positive=(value,label)=>{const n=Number(value);assert.ok(Number.isSafeInteger(n)&&n>0,label+' must identify an actual positive CI run/attempt');return n;};
const openScopes=Object.freeze({sourceAccepted:false,publicationAccepted:false,liveSdkAccepted:false,moderationAccepted:false});
const controllerPaths=Object.freeze(['scripts/qa-campaign-platform-route.mjs','scripts/lib/canvas-text-observer.mjs','scripts/lib/yandex-debug-checker.mjs','scripts/lib/yandex-review-sdk.mjs','scripts/lib/campaign-access-fixture.mjs','scripts/qa-browser-capture.mjs','qa/vendor/yandex-games-debug-checker/debugcheck.js','qa/vendor/yandex-games-debug-checker/LICENSE','qa/vendor/yandex-games-debug-checker/upstream.json']);

export function parsePlatformRouteLevels(value){
 const result=value?String(value).split(',').map(text=>Number(text.trim())):FOUNDATION_SEQUENCE.map(index=>index+1);
 assert.ok(result.length>0&&result.length<=51&&new Set(result).size===result.length,'Unique explicit stable levels required');
 for(const room of result)assert.ok(Number.isSafeInteger(room)&&room>=1&&room<=51,'Stable level outside 1–51');return result;
}

export function bindPlatformReviewPackages({sourceRoot=process.cwd(),directory='dist-yandex-review',consumerDirectory='dist'}={}){
 const root=path.resolve(sourceRoot),commit=git(root,['rev-parse','HEAD']),tree=git(root,['rev-parse','HEAD^{tree}']);
 assert.match(commit,/^[a-f0-9]{40}$/);assert.match(tree,/^[a-f0-9]{40}$/);
 if(process.env.BUILD_COMMIT||process.env.GITHUB_SHA)assert.equal(commit,process.env.BUILD_COMMIT||process.env.GITHUB_SHA);
 assert.equal(git(root,['status','--porcelain','--untracked-files=no']),'','Commit source and checker controller before evidence capture');
 assert.equal(git(root,['status','--porcelain','--untracked-files=all','--','src','public','index.html','vite.config.js','package.json','package-lock.json']),'','Only committed production inputs are allowed');
 const sourceInputs=buildSourceInputs(root),sourceInputsSha256=sha256(JSON.stringify(sourceInputs));
 const bind=(buildDirectory,mode)=>{
  const full=path.resolve(buildDirectory),bytes=fs.readFileSync(path.join(full,'build-info.json')),info=JSON.parse(bytes);
  assert.equal(info.commit,commit);assert.equal(info.sourceInputsSha256,sourceInputsSha256);
  verifyReleaseMetadata(info,{directory:full,commit,root,run:process.env.SOURCE_REVIEW_RUN_ID||info.run||null});
  const files=verifyReleasePackage(info,full);
  assert.ok(!files.some(file=>/debugcheck|yandex-games-debug-checker/.test(file.path)),'Original checker must not be shipped in either game package');
  return {mode,commit,buildInfoBytes:bytes.length,buildInfoSha256:sha256(bytes),sourceInputsSha256,
   packageFilesSha256:info.packageFilesSha256,files,fileCount:files.length,totalBytes:files.reduce((n,file)=>n+file.bytes,0),info};
 };
 const review=bind(directory,'yandex-review-test'),consumer=bind(consumerDirectory,'consumer');
 assert.notEqual(review.packageFilesSha256,consumer.packageFilesSha256,'Declare the distinct TEST Yandex package; do not relabel consumer bytes');
 const journeys=review.files.filter(file=>/^assets\/LabV8Journey-[A-Za-z0-9_-]+\.js$/.test(file.path));assert.equal(journeys.length,1,'One actual compiled QA ordinary-input route is required');
 const controllerFiles=controllerPaths.map(filename=>{const bytes=fs.readFileSync(path.join(root,filename));assert.deepEqual(bytes,execFileSync('git',['show','HEAD:'+filename],{cwd:root}));return{path:filename,bytes:bytes.length,sha256:sha256(bytes)};});
 return {kind:'yandex-review-campaign-package-binding',...openScopes,source:{commit,tree,sourceInputsSha256,sourceInputFiles:sourceInputs.length},
  controller:{commit,tree,files:controllerFiles,filesSha256:sha256(JSON.stringify(controllerFiles)),trackedWorkingTreeClean:true},
  runId:positive(process.env.GITHUB_RUN_ID,'GITHUB_RUN_ID'),runAttempt:positive(process.env.GITHUB_RUN_ATTEMPT,'GITHUB_RUN_ATTEMPT'),
  sourceReviewRunId:positive(process.env.SOURCE_REVIEW_RUN_ID||review.info.run,'SOURCE_REVIEW_RUN_ID'),
  sourceReviewRunAttempt:positive(process.env.SOURCE_REVIEW_RUN_ATTEMPT||process.env.GITHUB_RUN_ATTEMPT,'SOURCE_REVIEW_RUN_ATTEMPT'),
  review:{...review,info:undefined},consumer:{...consumer,info:undefined},journey:journeys[0],checker:YANDEX_CHECKER_PIN};
}

/** No bundle rewriting, SDK fallback or substitute asset. Only /sdk.js is a
 * declared locally generated TEST SDK; all game bytes are frozen inventories. */
export async function serveYandexReviewPackage(directory,{pathname='/campaign-'+RELEASE_VERSION.split('-')[0]+'/',mobile=false,sdkOptions={}}={}){
 assert.match(pathname,/^\/(?:[a-zA-Z0-9_-]+\/)+$/);const root=path.resolve(directory),sdkSource=createMockYandexSDKSource({mobile,...sdkOptions});
 const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.glb':'model/gltf-binary','.wasm':'application/wasm','.webp':'image/webp','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.ogg':'audio/ogg','.mp3':'audio/mpeg'};
 const server=http.createServer((request,response)=>{
  try{
   const url=new URL(request.url,'http://localhost');
   if(url.pathname==='/sdk.js'){const bytes=Buffer.from(sdkSource);response.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Content-Length':bytes.length,'Cache-Control':'public, max-age=3600','X-Lab-Test-SDK':'explicit-mock'});response.end(bytes);return;}
   if(!url.pathname.startsWith(pathname))throw Error('Outside frozen TEST package');
   const relative=decodeURIComponent(url.pathname.slice(pathname.length))||'index.html',file=path.resolve(root,relative);
   assert.ok(file.startsWith(root+path.sep)&&fs.lstatSync(file).isFile()&&!fs.lstatSync(file).isSymbolicLink());
   response.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':fs.statSync(file).size,'Cache-Control':'public, max-age=3600'});fs.createReadStream(file).pipe(response);
  }catch{response.writeHead(404,{'Content-Length':0}).end();}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 return {server,url:`http://127.0.0.1:${server.address().port}${pathname}`,pathname,sdk:{kind:'explicit-local-test-sdk',bytes:Buffer.byteLength(sdkSource),sha256:sha256(sdkSource),liveSdk:false,liveAds:false}};
}

/** Hash the bytes actually received by this page, including the checker's
 * numeric _dc source-scan requests. A failed/empty CDP body is a hard failure. */
export function observePlatformPackageResponses(page,{base,binding,sdk}){
 const root=new URL(base),files=new Map(binding.review.files.map(file=>[file.path,file])),rows=[],failures=[],pending=new Set();
 files.set('build-info.json',{path:'build-info.json',bytes:binding.review.buildInfoBytes,sha256:binding.review.buildInfoSha256});
 const onResponse=response=>{
  const job=(async()=>{
   const url=new URL(response.url());if(['data:','blob:'].includes(url.protocol))return;
   assert.equal(url.origin,root.origin,'Unexpected external response');
   const sdkResponse=url.pathname==='/sdk.js';assert.ok(sdkResponse||url.pathname.startsWith(root.pathname),'Response outside frozen package');
   const relative=sdkResponse?'/sdk.js':decodeURIComponent(url.pathname.slice(root.pathname.length))||'index.html',expected=sdkResponse?sdk:files.get(relative);
   // Entry probes deliberately include forged legacy selectors to verify the
   // production gate. They belong only to the main index document; linked
   // Runtime GLBs carry the loader's exact frozen content-hash prefix. Other
   // linked assets and SDK responses may carry only the numeric cachebuster.
   const entryKeys=new Set(['edition','level','debug','pilot','tower41preview','tower41ratchet']);
   const versionedModel=/^models\/runtime\/[^/]+\.glb$/.test(relative)&&url.searchParams.getAll('v').length===1;
   const query=[...url.searchParams];assert.ok(query.every(([key,value])=>key==='_dc'&&/^\d+$/.test(value)||relative==='index.html'&&entryKeys.has(key)||key==='v'&&versionedModel&&value===expected?.sha256?.slice(0,12)),'Unexpected unverified response query: '+url.href);
   if(relative==='favicon.ico'&&response.status()===404)return;
   assert.ok(expected,'Response absent from frozen inventory: '+relative);assert.equal(response.status(),200,'Non-200 actual package response');
   const bytes=await response.buffer();assert.equal(bytes.length,expected.bytes,'Actual response byte length differs: '+relative);assert.equal(sha256(bytes),expected.sha256,'Actual response bytes differ: '+relative);
   rows.push({url:url.href,path:relative,status:response.status(),bytes:bytes.length,sha256:sha256(bytes),fromCache:response.fromCache(),checkerSourceScan:url.searchParams.has('_dc'),mockSdk:sdkResponse});
  })().catch(error=>failures.push(response.url()+': '+String(error?.stack||error)));
  pending.add(job);void job.finally(()=>pending.delete(job));
 };
 page.on('response',onResponse);
 return {async finish(){await Promise.all([...pending]);page.off('response',onResponse);assert.deepEqual(failures,[],'Actual response body verification failed');
  assert.ok(rows.some(row=>row.path==='index.html')&&rows.some(row=>row.path==='/sdk.js'));
  assert.ok(rows.some(row=>row.path==='index.html'&&row.checkerSourceScan)&&rows.some(row=>row.path.endsWith('.js')&&row.checkerSourceScan),'Original checker did not scan actual linked package bytes');
  return {kind:'actual-browser-response-body-hashes',allReceivedBytesMatched:true,responses:rows,responseCount:rows.length,totalObservedBytes:rows.reduce((n,row)=>n+row.bytes,0)};},rows,failures};
}

function readRouteState(){
 const g=window.__NESI_DEMO_GAME__;if(!g)throw Error('TEST-only actual game handle absent');
 return {levelIndex:g.levelIndex,id:g.firstLevel.id,state:g.state,worldStep:g.physics.world.stepnumber,elapsed:g.elapsed,
  cargoUUID:g.cargo.group.uuid,cargoBodyId:g.physics.cargoBody.id,cargoMass:g.physics.cargoBody.mass,
  actualProductionWin:g.firstLevel.isWon(),player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),
  normalPlayerSpawnDistance:g.playerPosition.distanceTo(g.firstLevel.spawn?.toArray?g.firstLevel.spawn:{x:g.firstLevel.spawn[0],y:g.firstLevel.spawn[1],z:g.firstLevel.spawn[2]}),
  normalCargoSpawnDistance:g.cargo.position.distanceTo(g.firstLevel.cargoSpawn?.toArray?g.firstLevel.cargoSpawn:{x:g.firstLevel.cargoSpawn[0],y:g.firstLevel.cargoSpawn[1],z:g.firstLevel.cargoSpawn[2]}),
  completed:window.__NESI_PREFS__.value.completed.slice(),selectedLevel:Number(document.querySelector('#level-select').value),
  platformDemo:window.__NESI_PLATFORM__?.demo??null};
}

function readRewardedHintUI({level,key}){
 const g=window.__NESI_DEMO_GAME__,platform=window.__NESI_PLATFORM__,mock=window.__LAB_YANDEX_MOCK__,raw=localStorage.getItem(key),saved=raw===null?null:JSON.parse(raw);
 return {levelIndex:g.levelIndex,state:g.state,runtimeState:document.documentElement.dataset.runtimeState,worldStep:g.physics.world.stepnumber,
  externalPause:document.body.dataset.externalPause,externalBlocked:g.externalBlocked,platformBusy:platform.busy,adLocks:platform.adLocks.size,
  audioContextState:g.audio.context?.state??null,audioAudible:g.audio.audible,audioBlocks:[...g.audio.blocks].sort(),
  savedRaw:raw,savedHintCount:saved?.hints?.[level-1]??0,runtimeHintCount:window.__NESI_PREFS__.value.hints[level-1]??0,
  hintsHidden:document.querySelector('#hint-detail').hidden,hintText:document.querySelector('#hint-text').textContent,
  revealedParagraphs:document.querySelectorAll('#hint-text p').length,unlockDisabled:document.querySelector('#hint-unlock').disabled,
  status:document.querySelector('#ad-status').textContent,rewardedOpenCount:mock.log.filter(row=>row.event==='rewarded-open').length,
  rewardedConfirmedCount:mock.log.filter(row=>row.event==='rewarded-confirmed').length,duplicateConfirmedCount:mock.log.filter(row=>row.event==='rewarded-confirmed-duplicate').length,
  sdkLog:mock.log.map(row=>({...row}))};
}

/** The fixed-clock observer disables automatic frames. Escape is queued by
 * the real InputController and consumed by production animate, before physics.
 * One zero-delta frame processes that actual queued input without advancing a
 * room; pointer-lock loss may already have opened the ordinary pause dialog. */
export async function pauseFrozenRouteThroughNativeInput(page){
 const read=()=>{const g=window.__NESI_DEMO_GAME__;return{state:g.state,worldStep:g.physics.world.stepnumber,elapsed:g.elapsed,pauseQueued:g.input.pauseQueued,pointerLocked:!!document.pointerLockElement};};
 const before=await page.evaluate(read);await page.evaluate(()=>document.exitPointerLock?.());
 await page.waitForFunction(()=>!document.pointerLockElement);
 const afterPointerLockExit=await page.evaluate(read);let afterKeyboard=null,clockTick=null;
 if(afterPointerLockExit.state==='playing'){
  await page.keyboard.press('Escape');afterKeyboard=await page.evaluate(read);
  clockTick=await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__,before={state:g.state,worldStep:g.physics.world.stepnumber,elapsed:g.elapsed,pauseQueued:g.input.pauseQueued};
   const consumed=g.state==='playing'&&g.input.pauseQueued===true;if(consumed)g.animate(g.lastFrame);
   return{consumed,method:'production animate(lastFrame), zero delta, actual native Escape queue',before,after:{state:g.state,worldStep:g.physics.world.stepnumber,elapsed:g.elapsed,pauseQueued:g.input.pauseQueued}};});
 }
 await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='paused');const after=await page.evaluate(read);
 assert.equal(after.state,'paused');assert.equal(after.worldStep,before.worldStep,'Pause input advanced physics');assert.equal(after.elapsed,before.elapsed,'Pause input advanced elapsed time');
 return {control:'native Escape or ordinary pointer-lock-loss pause',before,afterPointerLockExit,afterKeyboard,clockTick,after};
}

/** Each transaction begins with a real hint-button click. Only explicit local
 * SDK callbacks are controlled; game hint state/storage/lifecycle are observed. */
export async function observeRewardedHintUI(page,{level,key}){
 const args={level,key},proof={kind:'actual-rewarded-hint-ui-with-explicit-sdk-mock',level,liveAds:false,transactions:[]};
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.audio.context?.state==='running');
 proof.pause=await pauseFrozenRouteThroughNativeInput(page);
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.audio.context?.state==='suspended');
 await activate(page,'#hint-button');
 const initial=await page.evaluate(readRewardedHintUI,args);assert.equal(initial.runtimeHintCount,0);assert.equal(initial.savedHintCount,0);assert.equal(initial.hintsHidden,false);assert.equal(initial.revealedParagraphs,0);proof.before=initial;
 for(const outcome of ['close','error','reward']){
  await page.evaluate(outcome=>{const mock=window.__LAB_YANDEX_MOCK__;mock.manualRewarded=true;mock.rewardedOutcome=outcome;mock.duplicateRewarded=outcome==='reward';},outcome);
  const before=await page.evaluate(readRewardedHintUI,args);await activate(page,'#hint-unlock');
  await page.waitForFunction(()=>window.__LAB_YANDEX_MOCK__.finishRewarded&&window.__NESI_PLATFORM__.busy&&document.body.dataset.externalPause==='true');
  await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.audio.context?.state==='suspended');
  const during=await page.evaluate(readRewardedHintUI,args);
  assert.equal(during.state,'paused');assert.equal(during.externalPause,'true');assert.equal(during.externalBlocked,true);assert.ok(during.adLocks>0);assert.equal(during.audioAudible,false);assert.equal(during.unlockDisabled,true);
  assert.equal(during.runtimeHintCount,0);assert.equal(during.savedRaw,before.savedRaw);assert.equal(during.rewardedOpenCount,before.rewardedOpenCount+1);
  // Finish the observed SDK request, including a deliberately duplicated
  // confirmation in the reward case. The adapter must grant only one tier.
  await page.evaluate(()=>window.__LAB_YANDEX_MOCK__.finishRewarded());
  await page.waitForFunction(()=>!window.__NESI_PLATFORM__.busy&&document.body.dataset.externalPause==='false'&&!document.querySelector('#hint-unlock').disabled);
  const after=await page.evaluate(readRewardedHintUI,args);assert.equal(after.state,'paused');assert.equal(after.runtimeState,'paused');assert.equal(after.externalBlocked,false);assert.equal(after.audioAudible,false);assert.equal(after.audioContextState,'suspended');assert.equal(after.adLocks,0);
  const expected=outcome==='reward'?1:0;assert.equal(after.runtimeHintCount,expected);assert.equal(after.savedHintCount,expected);assert.equal(after.revealedParagraphs,expected);
  if(outcome!=='reward')assert.equal(after.savedRaw,before.savedRaw,'Unconfirmed close/error persisted an unopened hint');
  else{assert.equal(after.rewardedConfirmedCount,before.rewardedConfirmedCount+1);assert.equal(after.duplicateConfirmedCount,before.duplicateConfirmedCount+1);}
  assert.equal(after.worldStep,proof.before.worldStep,'Paused hints advanced route physics');proof.transactions.push({outcome,before,during,after});
 }
 await activate(page,'#hint-button');proof.reread=await page.evaluate(readRewardedHintUI,args);
 assert.equal(proof.reread.revealedParagraphs,1);assert.equal(proof.reread.rewardedOpenCount,proof.transactions.at(-1).after.rewardedOpenCount);assert.equal(proof.reread.savedRaw,proof.transactions.at(-1).after.savedRaw);
 await activate(page,'#resume-button');await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='playing');
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.audio.context?.state==='running');proof.resumed=await page.evaluate(readRewardedHintUI,args);
 assert.equal(proof.resumed.state,'playing');assert.equal(proof.resumed.externalPause,'false');assert.equal(proof.resumed.externalBlocked,false);assert.equal(proof.resumed.runtimeHintCount,1);assert.equal(proof.resumed.worldStep,proof.before.worldStep);
 proof.pass=true;return proof;
}

export async function runCampaignPlatformRoutes({sourceRoot=process.cwd(),directory=process.env.YANDEX_REVIEW_DIR||'dist-yandex-review',consumerDirectory=process.env.CONSUMER_DIR||'dist',outputDirectory=process.env.OUT_DIR||'qa/campaign-platform-routes',levels=parsePlatformRouteLevels(process.env.LEVELS),browser:givenBrowser}={}){
 const out=path.resolve(outputDirectory);assert.ok(!fs.existsSync(out)||fs.readdirSync(out).length===0,'Use a fresh output directory');fs.mkdirSync(out,{recursive:true});
 const binding=bindPlatformReviewPackages({sourceRoot,directory,consumerDirectory}),mount=await serveYandexReviewPackage(directory),report={kind:'mock-yandex-original-checker-campaign-routes',pass:false,...openScopes,binding,levels,rows:[],
  scope:'Every listed actual compiled ordinary-input route plus the unchanged upstream checker on a fresh page of the distinct Yandex REVIEW TEST build. Explicit mock SDK. Existing legacy route initialization resets are outside its own route counters; this is not an all-room continuous/native no-reset claim.',sdk:mount.sdk};
 let browser=givenBrowser,page;
 try{
  if(!browser){const {default:puppeteer}=await import('puppeteer-core');browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader'],protocolTimeout:7200000});}
  for(const level of levels){
   const roomOut=path.join(out,'room-'+String(level).padStart(2,'0'));fs.mkdirSync(roomOut);const errors=[];
   const row={level,displayNumber:foundationDisplayNumber(level-1),pass:false,...openScopes};report.rows.push(row);
   page=await browser.newPage();page.setDefaultTimeout(180000);await page.setCacheEnabled(false);
   await page._client().send('Network.enable',{maxTotalBufferSize:134217728,maxResourceBufferSize:67108864,enableDurableMessages:true});
   await page.setViewport({width:640,height:360,deviceScaleFactor:1});
   page.on('pageerror',error=>errors.push(String(error)));page.on('error',error=>errors.push('Renderer: '+String(error)));
   const fixture=campaignAccessFixture({levelIndex:level-1,pathname:mount.pathname});
   fixture.preferences={...fixture.preferences,muted:false,volume:.29};fixture.raw=JSON.stringify(fixture.preferences);row.fixture=fixture;
   assert.ok(!fixture.completed.includes(level-1));assert.deepEqual(fixture.completed,FOUNDATION_SEQUENCE.slice(0,FOUNDATION_SEQUENCE.indexOf(level-1)));
   await page.evaluateOnNewDocument(({key,raw})=>{if(window!==window.top)return;localStorage.clear();localStorage.setItem(key,raw);},{key:fixture.key,raw:fixture.raw});
   row.checkerInstallation=await installPinnedYandexChecker(page,{sourceRoot});
   await page.evaluateOnNewDocument(installCanvasTextObserver);
   const network=observePlatformPackageResponses(page,{base:mount.url,binding,sdk:mount.sdk});
   const url=new URL(mount.url);url.searchParams.set('edition','foundation');url.searchParams.set('level',String(level));url.searchParams.set('debug','1');row.url=url.href;
   await page.goto(url.href,{waitUntil:'domcontentloaded'});await waitForStartMenu(page);
   row.beforePlay=await page.evaluate(readRouteState);assert.equal(row.beforePlay.levelIndex,level-1);assert.deepEqual(row.beforePlay.completed,fixture.completed);assert.equal(row.beforePlay.selectedLevel,level-1);assert.equal(row.beforePlay.platformDemo,false);
   await page.select('#quality-select','low');
   // Stop the automatic render clock before the genuine Play action. The
   // existing trusted route owns its fixed-rate ordinary input clock afterward.
   await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__,renderer=g.renderer,original=renderer.setAnimationLoop;
    original.call(renderer,null);window.__LAB_PLATFORM_SCHEDULER_ORIGINAL__=original;
    renderer.setAnimationLoop=function(callback){return original.call(this,callback===g.animate?null:callback);};});
   await activate(page,'#play-button');await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='playing');
   row.normalPlay=await page.evaluate(readRouteState);assert.equal(row.normalPlay.worldStep,0);assert.equal(row.normalPlay.elapsed,0);assert.ok(row.normalPlay.normalPlayerSpawnDistance<1e-8&&row.normalPlay.normalCargoSpawnDistance<1e-8);
   row.hintTransactions=await observeRewardedHintUI(page,{level,key:fixture.key});
   row.scheduler='Automatic render scheduling suppressed before genuine Play and hint pause/resume; actual route uses its own fixed-rate ordinary input clock.';
   await page.evaluate(()=>{window.__NESI_DEMO_GAME__.renderer.setAnimationLoop=window.__LAB_PLATFORM_SCHEDULER_ORIGINAL__;delete window.__LAB_PLATFORM_SCHEDULER_ORIGINAL__;});
   row.route=await page.evaluate(async level=>{
    const name=level===20?'__NESI_RUN_FOUNDATION20_PHYSICAL_ROUTE__':'__NESI_RUN_LEVEL_ROUTE__';
    if(typeof window[name]!=='function')throw Error('TEST actual compiled route hook absent: '+name);return window[name]();
   },level);
   if(level===20)assertFoundation20Route(row.route);
   row.finished=await page.evaluate(readRouteState);assert.equal(row.route.pass,true);assert.equal(row.finished.state,'won');assert.equal(row.finished.actualProductionWin,true);assert.equal(row.finished.levelIndex,level-1);
   assert.equal(row.finished.cargoUUID,row.normalPlay.cargoUUID);assert.equal(row.finished.cargoBodyId,row.normalPlay.cargoBodyId);assert.equal(row.finished.cargoMass,3.2);
   row.finalFrame=await captureBrowserFrame(page,path.join(roomOut,'finished-canvas.jpg'),{timeoutMs:60000,canvasOnly:true});assert.equal(row.finalFrame.ok,true);
   row.canvasText=await page.evaluate(readCanvasTextObservation);
   fs.writeFileSync(path.join(roomOut,'canvas-text.json'),JSON.stringify(row.canvasText,null,2)+'\n');
   assert.equal(row.canvasText.present,true);assert.equal(row.canvasText.installed,true);assert.equal(row.canvasText.instrumentationIntact,true);
   assert.equal(row.canvasText.overflow,false);assert.equal(row.canvasText.unrecordedTextCalls,0);assert.equal(row.canvasText.fontUnavailableCalls,0);assert.equal(row.canvasText.observationErrors,0);
   const checker=await captureYandexChecker(page,{outputDirectory:path.join(roomOut,'checker'),identity:{sourceCommit:binding.source.commit,sourceTree:binding.source.tree,sourceInputsSha256:binding.source.sourceInputsSha256,runId:binding.runId,runAttempt:binding.runAttempt,level,displayNumber:row.displayNumber,reviewPackageFilesSha256:binding.review.packageFilesSha256,consumerPackageFilesSha256:binding.consumer.packageFilesSha256,controllerFilesSha256:binding.controller.filesSha256}});
   row.checker={directory:'checker',summary:checker.summary,reportSha256:sha256(fs.readFileSync(path.join(roomOut,'checker/yandex-debug-checker-report.json'))),originalTextSha256:sha256(fs.readFileSync(path.join(roomOut,'checker/yandex-debug-checker-report.txt')))};
   row.sdk=await page.evaluate(readMockYandexSDKObservation);assert.equal(row.sdk.platformDemo,false);assert.ok(row.sdk.log.some(event=>event.event==='init')&&row.sdk.log.some(event=>event.event==='ready')&&row.sdk.log.some(event=>event.event==='start'));
   row.network=await network.finish();assert.deepEqual(errors,[]);row.errors=errors;row.pass=true;
   fs.writeFileSync(path.join(roomOut,'route-report.json'),JSON.stringify(row,null,2)+'\n');
   console.log('YANDEX_PLATFORM_ROUTE_COMPLETE',level,binding.source.commit,binding.runId,JSON.stringify(row.checker.summary));await page.close();page=null;
  }
  assert.equal(report.rows.length,levels.length);assert.ok(report.rows.every(row=>row.pass));report.pass=true;
 }catch(error){report.failure=String(error?.stack||error);if(page){
  const last=report.rows.at(-1);if(last?.fixture)last.failureObservation=await page.evaluate(readRewardedHintUI,{level:last.level,key:last.fixture.key}).catch(()=>null);
  await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});
 }throw error;
 }finally{
  if(page)await page.close().catch(()=>{});if(browser&&!givenBrowser)await browser.close().catch(()=>{});await new Promise(resolve=>mount.server.close(resolve));
  const inventory=walkFiles(out).filter(file=>!['platform-route-report.json','artifact-inventory.json'].includes(path.basename(file))).map(file=>{const bytes=fs.readFileSync(file);return{path:path.relative(out,file).split(path.sep).join('/'),bytes:bytes.length,sha256:sha256(bytes)};});
  report.artifacts={files:inventory,filesSha256:sha256(JSON.stringify(inventory)),fileCount:inventory.length};
  fs.writeFileSync(path.join(out,'platform-route-report.json'),JSON.stringify(report,null,2)+'\n');
 }
 return report;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await runCampaignPlatformRoutes();
