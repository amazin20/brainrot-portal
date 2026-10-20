/** Exact production ZIP runtime, with an explicit local SDK mock. No game QA
 * hooks, progression fixtures, actor writes or substituted game files. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {verifyReleaseMetadata,verifyReleasePackage,sha256,walkFiles} from './lib/release-manifest.mjs';
import {serveYandexReviewPackage,observePlatformPackageResponses} from './qa-campaign-platform-route.mjs';
import {installPinnedYandexChecker,captureYandexChecker,refreshOriginalYandexChecker,readOriginalYandexCheckerPanel,copyOriginalYandexCheckerReport} from './lib/yandex-debug-checker.mjs';
import {activate} from './lib/singularity-ui-check.mjs';

const scopes=Object.freeze({sourceAccepted:false,publicationAccepted:false,liveSdkAccepted:false,moderationAccepted:false});
const git=(root,args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const positive=(value,label)=>{const n=Number(value);assert.ok(Number.isSafeInteger(n)&&n>0,label+' requires actual CI run provenance');return n;};

export function bindProductionYandexRuntime({sourceRoot='.',directory='dist-yandex',archive='qa/yandex-package/brainrot-portal-v63-yandex.zip',packageReport='qa/yandex-package/report.json'}={}){
 const root=path.resolve(sourceRoot),commit=git(root,['rev-parse','HEAD']),tree=git(root,['rev-parse','HEAD^{tree}']);
 assert.equal(commit,process.env.BUILD_COMMIT||process.env.GITHUB_SHA);assert.equal(git(root,['status','--porcelain','--untracked-files=no']),'');
 const bytes=fs.readFileSync(path.join(directory,'build-info.json')),info=JSON.parse(bytes);verifyReleaseMetadata(info,{directory,commit,root,run:process.env.SOURCE_REVIEW_RUN_ID||info.run||null});
 const files=verifyReleasePackage(info,directory),zip=fs.readFileSync(archive),packaged=JSON.parse(fs.readFileSync(packageReport));
 assert.equal(packaged.pass,true);assert.equal(packaged.sourceCommit,commit);assert.equal(packaged.sourceTree,tree);assert.equal(packaged.workingTreeModified,false);assert.equal(packaged.builtFromCurrentSource,true);
 assert.equal(packaged.sourceInputsSha256,info.sourceInputsSha256);assert.equal(packaged.compressedBytes,zip.length);assert.equal(packaged.sha256,sha256(zip));
 const actual=walkFiles(directory).map(filename=>{const b=fs.readFileSync(filename);return{filename:path.relative(directory,filename).split(path.sep).join('/'),bytes:b.length,sha256:sha256(b)};});
 assert.deepEqual(actual,packaged.files,'The browser must open the actual extracted production archive inventory');
 assert.ok(!files.some(file=>/Journey|debugcheck|yandex-games-debug-checker/.test(file.path)),'Production must omit route/checker files');
 const html=fs.readFileSync(path.join(directory,'index.html'),'utf8');assert.match(html,/<script src="\/sdk\.js"><\/script>/);assert.doesNotMatch(html,/class="walkthrough-link"/);
 return {kind:'actual-production-yandex-archive-runtime-binding',...scopes,source:{commit,tree,sourceInputsSha256:info.sourceInputsSha256},
  runId:positive(process.env.GITHUB_RUN_ID,'GITHUB_RUN_ID'),runAttempt:positive(process.env.GITHUB_RUN_ATTEMPT,'GITHUB_RUN_ATTEMPT'),
  production:{buildInfoBytes:bytes.length,buildInfoSha256:sha256(bytes),packageFilesSha256:info.packageFilesSha256,files,archive:{filename:path.basename(archive),bytes:zip.length,sha256:sha256(zip)},archiveInventory:actual}};
}

function instrumentAudioContexts(){
 window.__LAB_PRODUCTION_AUDIO_CONTEXTS__=[];const NativeAudio=window.AudioContext||window.webkitAudioContext;
 if(NativeAudio){const Wrapped=function(...args){const context=new NativeAudio(...args);window.__LAB_PRODUCTION_AUDIO_CONTEXTS__.push(context);return context;};Wrapped.prototype=NativeAudio.prototype;window.AudioContext=Wrapped;}
}
/** A never-held fresh page has no pause attribute until the first real hold
 * event. Accept only that absence or the explicit released marker at startup;
 * subsequent SDK pause/resume checks still require exact true/false markers. */
export function isProductionSDKInitialMenuReady(){
 const marker=document.body.getAttribute('data-external-pause');
 return document.documentElement.dataset.runtimeState==='ready'&&(marker===null||marker==='false');
}
function readProductionSDKState(){
 const mock=window.__LAB_YANDEX_MOCK__,select=document.querySelector('#level-select');
 return {url:location.href,state:document.documentElement.dataset.runtimeState,levelIndex:Number(document.documentElement.dataset.levelIndex),
  edition:document.body.dataset.chamberEdition,externalPause:document.body.getAttribute('data-external-pause'),documentLang:document.documentElement.lang,
  documentHidden:document.hidden,documentHasFocus:document.hasFocus(),visibilityState:document.visibilityState,
  selected:select?Number(select.value):null,options:select?.options.length??0,enabledIndices:select?[...select.options].filter(option=>!option.disabled).map(option=>Number(option.value)):[],
  obsoletePauseSelect:!!document.querySelector('#settings-level-select'),walkthrough:!!document.querySelector('.walkthrough-link'),
  qaHooks:Object.fromEntries(['__NESI_DEMO_GAME__','__NESI_PLATFORM__','__NESI_PREFS__','__NESI_RUN_LEVEL_ROUTE__'].map(key=>[key,typeof window[key]])),
  audio:window.__LAB_PRODUCTION_AUDIO_CONTEXTS__.map(context=>({state:context.state,sampleRate:context.sampleRate})),
  mock:{kind:mock?.kind,liveSdk:mock?.liveSdk,liveAds:mock?.liveAds,log:mock?.log.map(row=>({...row}))??[]},
  error:document.querySelector('#error-detail')?.textContent??null};
}
function assertNoProductionHooks(value){for(const type of Object.values(value.qaHooks))assert.equal(type,'undefined','Production query exposed a game QA hook');assert.equal(value.walkthrough,false);assert.equal(value.obsoletePauseSelect,false);}

export async function runProductionYandexSDKBrowserQA({sourceRoot=process.env.SOURCE_DIR||'.',directory=process.env.YANDEX_DIR||'dist-yandex',outputDirectory=process.env.OUT_DIR||'qa/production-sdk'}={}){
 const binding=bindProductionYandexRuntime({sourceRoot,directory}),out=path.resolve(outputDirectory);fs.mkdirSync(out,{recursive:true});assert.deepEqual(fs.readdirSync(out),[],'Use a fresh production SDK artifact directory');
 const report={kind:'actual-production-yandex-sdk-browser-diagnostic',pass:false,...scopes,binding,cases:[],errors:[],
  scope:'Actual extracted production Yandex ZIP under a nested upload path. Original checker observes positive desktop/mobile sessions. Explicit local SDK callbacks and software WebGL are not live SDK/ad delivery, physical phone FPS or moderation approval.'};
 let browser;
 const save=()=>fs.writeFileSync(path.join(out,'sdk-production-proof.json'),JSON.stringify(report,null,2)+'\n');
 const phase=name=>{report.phase=name;save();};
 const mountOptions={pathname:'/uploads/yandex-check/game/'};
 try{
  const {default:puppeteer}=await import('puppeteer-core');browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:process.env.CHROME_HEADLESS==='shell'?'shell':true,pipe:process.env.CHROME_PIPE==='1',args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader'],protocolTimeout:180000});
  for(const scenario of ['sdk-rejected','desktop','mobile']){
   phase(scenario);const mobile=scenario==='mobile',mount=await serveYandexReviewPackage(directory,{...mountOptions,mobile,sdkOptions:{reject:scenario==='sdk-rejected',startupPause:scenario==='desktop',manualInterstitial:true}});
   const row={scenario,pass:false,...scopes,sdk:mount.sdk},page=await browser.newPage();report.cases.push(row);page.setDefaultTimeout(120000);
   try{
    await page.setViewport(mobile?{width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:1}:{width:1024,height:768,deviceScaleFactor:1});
    page.on('pageerror',error=>report.errors.push({scenario,error:String(error)}));
    await page.evaluateOnNewDocument(instrumentAudioContexts);await installPinnedYandexChecker(page,{sourceRoot});
    const network=observePlatformPackageResponses(page,{base:mount.url,binding:{review:binding.production},sdk:mount.sdk});
    const url=new URL(mount.url);url.search='?debug=1&level=51&pilot=progression&tower41preview=1&tower41ratchet=1&edition=classic';row.url=url.href;
    await page.goto(url.href,{waitUntil:'domcontentloaded'});
    if(scenario==='sdk-rejected'){
     await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='error');row.failedStartup=await page.evaluate(readProductionSDKState);assertNoProductionHooks(row.failedStartup);assert.match(row.failedStartup.error,/initialization rejected/);
     assert.equal(row.failedStartup.mock.log.filter(event=>['ready','start'].includes(event.event)).length,0);
     // Preserve the unchanged checker's own negative-session findings without
     // pretending that its static SDK detection proves successful startup.
     await page.evaluate(refreshOriginalYandexChecker,20000);const actual=await page.evaluate(readOriginalYandexCheckerPanel),text=await page.evaluate(copyOriginalYandexCheckerReport),scanned=Buffer.from(actual.scannedSource);delete actual.scannedSource;
     row.checker={kind:'original-checker-on-explicit-negative-sdk-session',...actual,sourceScan:{bytes:scanned.length,sha256:sha256(scanned)},originalReport:text,...scopes,positiveStartupAccepted:false};
     fs.writeFileSync(path.join(out,'sdk-rejected-original-checker.txt'),text);assert.equal(row.checker.timing.gameReady,0);
     row.network=await network.finish();row.pass=true;await page.evaluate(()=>window.YGDebugChecker.close());continue;
    }
    await page.waitForFunction(isProductionSDKInitialMenuReady);
    row.menu=await page.evaluate(readProductionSDKState);assertNoProductionHooks(row.menu);assert.equal(row.menu.options,51);assert.equal(row.menu.selected,0);assert.equal(row.menu.levelIndex,0);assert.equal(row.menu.edition,'foundation');assert.deepEqual(row.menu.enabledIndices,[0]);
    assert.equal(row.menu.mock.log.filter(event=>event.event==='ready').length,1);assert.equal(row.menu.mock.log.filter(event=>event.event==='sdk-language-get').length,1);assert.equal(row.menu.documentLang,'ru');
    await activate(page,'#play-button',mobile);await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='playing');await page.waitForFunction(()=>window.__LAB_PRODUCTION_AUDIO_CONTEXTS__[0]?.state==='running');
    row.play=await page.evaluate(readProductionSDKState);assertNoProductionHooks(row.play);
    assert.equal(row.play.mock.log.filter(event=>event.event==='fullscreen-request').length,mobile?1:0);
    await page.evaluate(()=>window.__LAB_YANDEX_MOCK__.events.game_api_pause());await page.waitForFunction(()=>document.body.dataset.externalPause==='true'&&window.__LAB_PRODUCTION_AUDIO_CONTEXTS__[0].state==='suspended');
    row.sdkPaused=await page.evaluate(readProductionSDKState);assert.equal(row.sdkPaused.mock.log.at(-1).event,'stop');
    await page.evaluate(()=>window.__LAB_YANDEX_MOCK__.events.game_api_resume());await page.waitForFunction(()=>document.body.dataset.externalPause==='false'&&window.__LAB_PRODUCTION_AUDIO_CONTEXTS__[0].state==='running');
    row.sdkResumed=await page.evaluate(readProductionSDKState);assert.equal(row.sdkResumed.mock.log.at(-1).event,'start');
    if(!mobile){
     await page.keyboard.press('Escape');await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='paused');await page.waitForFunction(()=>window.__LAB_PRODUCTION_AUDIO_CONTEXTS__[0].state==='suspended');
     await page.evaluate(()=>{const mock=window.__LAB_YANDEX_MOCK__;mock.events.game_api_pause();mock.events.game_api_resume();});
     row.manualPause=await page.evaluate(readProductionSDKState);assert.equal(row.manualPause.state,'paused');assert.equal(row.manualPause.audio[0].state,'suspended');
     // Immediate restart obeys the genuine five-minute ad cooldown.
     const beforeRestartAds=row.manualPause.mock.log.filter(event=>event.event==='interstitial-open').length;
     await activate(page,'#restart-button');await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='playing');
     row.immediateRestart=await page.evaluate(readProductionSDKState);assert.equal(row.immediateRestart.levelIndex,0);assert.equal(row.immediateRestart.mock.log.filter(event=>event.event==='interstitial-open').length,beforeRestartAds);
     await page.keyboard.press('Escape');await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='paused');
     await activate(page,'#level-menu-button');await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='ready');
     row.atlas=await page.evaluate(readProductionSDKState);assert.deepEqual(row.atlas.enabledIndices,[0]);assert.equal(await page.$eval('#campaign-back-button',button=>button.hidden),false);
     await activate(page,'#campaign-back-button');await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='playing');
     row.atlasBack=await page.evaluate(readProductionSDKState);assert.equal(row.atlasBack.levelIndex,0);
     // Explicit menu reentry into the same permitted room is a real transition
     // and exercises advertising without marking a future room completed.
     await page.keyboard.press('Escape');await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='paused');await activate(page,'#level-menu-button');await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='ready');
     await activate(page,'#play-button');await page.waitForFunction(()=>window.__LAB_YANDEX_MOCK__.finishInterstitial&&document.body.dataset.externalPause==='true'&&window.__LAB_PRODUCTION_AUDIO_CONTEXTS__[0].state==='suspended');
     row.interstitialOpen=await page.evaluate(readProductionSDKState);
     await page.evaluate(()=>{window.dispatchEvent(new Event('blur'));window.__LAB_YANDEX_MOCK__.finishInterstitial();});
     await page.waitForFunction(()=>document.documentElement.dataset.levelIndex==='0'&&document.body.dataset.externalPause==='true'&&window.__LAB_PRODUCTION_AUDIO_CONTEXTS__[0].state==='suspended');row.closedWhileBlurred=await page.evaluate(readProductionSDKState);
     await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='paused');
     await activate(page,'#resume-button');await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='playing'&&window.__LAB_PRODUCTION_AUDIO_CONTEXTS__[0].state==='running');row.afterFocusResume=await page.evaluate(readProductionSDKState);
    }
    const checker=await captureYandexChecker(page,{outputDirectory:path.join(out,scenario+'-checker'),identity:{sourceCommit:binding.source.commit,sourceTree:binding.source.tree,sourceInputsSha256:binding.source.sourceInputsSha256,runId:binding.runId,runAttempt:binding.runAttempt,level:1,productionPackageFilesSha256:binding.production.packageFilesSha256,productionArchiveSha256:binding.production.archive.sha256,scenario}});row.checker={summary:checker.summary,identity:checker.identity};
    await page.screenshot({path:path.join(out,scenario+'-playing.png')});
    if(!mobile){await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='ready'&&document.body.dataset.externalPause==='false');row.reloaded=await page.evaluate(readProductionSDKState);assertNoProductionHooks(row.reloaded);assert.equal(row.reloaded.selected,0);assert.deepEqual(row.reloaded.enabledIndices,[0]);}
    row.network=await network.finish();row.pass=true;
   }catch(error){row.failureObservation=await page.evaluate(readProductionSDKState).catch(()=>null);row.observedErrors=report.errors.filter(value=>value.scenario===scenario);throw error;
   }finally{await page.close();await new Promise(resolve=>mount.server.close(resolve));save();}
  }
  assert.deepEqual(report.errors,[]);assert.equal(report.cases.length,3);assert.ok(report.cases.every(row=>row.pass));report.pass=true;delete report.phase;
 }catch(error){report.failure=String(error?.stack||error);throw error;
 }finally{
  if(browser)await browser.close().catch(()=>{});
  const files=walkFiles(out).filter(filename=>!filename.endsWith('/sdk-production-proof.json')).map(filename=>{const bytes=fs.readFileSync(filename);return{path:path.relative(out,filename).split(path.sep).join('/'),bytes:bytes.length,sha256:sha256(bytes)};});report.artifacts={files,filesSha256:sha256(JSON.stringify(files)),fileCount:files.length};save();
 }
 return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await runProductionYandexSDKBrowserQA();
