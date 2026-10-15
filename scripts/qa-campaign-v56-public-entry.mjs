import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';

export const PUBLIC_CAMPAIGN_URL='https://amazin20.github.io/brainrot-portal/campaign-v56/';
const PRIVATE_PREFIX='brainrot-campaign-v56:';
const KEY='brainrot-portal.preferences.v24';
const LEGACY_KEY='nesi.preferences.v8';
const HISTORICAL_PREFIXES=['','brainrot-foundation-v1:','brainrot-open-rebuild-v1:','brainrot-puzzle-pilot43-v1:',
 'brainrot-puzzle-progression-finale-v1:','brainrot-foundation20-physical-v1:','brainrot-tower41-native-v2:','brainrot-tower41-native-v3:','brainrot-campaign-v55:'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

export function assertBareEntry(value,{localPreparation=false}={}){
 const url=new URL(value);assert.equal(url.search,'','Bare entry proof must have no query');assert.equal(url.hash,'');
 if(localPreparation){assert.equal(url.hostname,'127.0.0.1');assert.equal(url.protocol,'http:');assert.equal(url.pathname,'/campaign-v56/');}
 else assert.equal(url.href,PUBLIC_CAMPAIGN_URL,'The actual candidate public entry is required');
 return url;
}
export function assertIsolatedStorage(observed,historical){
 assert.deepEqual(observed.historical,historical,'Candidate changed a historical save byte');
 assert.ok(observed.writes.every(row=>row.method!=='clear'&&['setItem','removeItem'].includes(row.method)&&row.key.startsWith(PRIVATE_PREFIX)),
  'Candidate wrote outside its private save namespace');
 assert.ok(observed.own,'Candidate did not persist its own preferences');
 const prefs=JSON.parse(observed.own);assert.deepEqual(prefs.completed,[0,1,6]);assert.deepEqual(prefs.hints,{1:2});
 assert.equal(prefs.resumeLevel,3);return prefs;
}
export function assertBareRuntime(observed,{state='ready',expectedURL=PUBLIC_CAMPAIGN_URL}={}){
 assert.equal(observed.location,expectedURL);
 assert.equal(observed.debugExposed,false,'Bare launch unexpectedly exposes a debug runtime');
 assert.equal(observed.runtimeState,state);assert.equal(observed.gameReady,'true');assert.ok(observed.modelsLoaded>0);
 assert.equal(observed.edition,'foundation');assert.equal(observed.preview,'false');assert.equal(observed.physicalEntry,'');
 assert.equal(observed.gameMode,'campaign');assert.equal(observed.levelIndex,3);assert.equal(observed.visibleRoom,4);
 assert.equal(observed.selectedIndex,3);assert.equal(observed.hudNumber,4);
 assert.deepEqual(observed.indices,[...Array.from({length:40},(_,i)=>i),...Array.from({length:10},(_,i)=>i+41),40]);
 assert.deepEqual(observed.numbers,Array.from({length:51},(_,i)=>i+1));return observed;
}
function decodeFrame(filename){
 const result=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-i',filename,'-vf','scale=64:36,signalstats,metadata=mode=print:file=-','-f','null','-'],{encoding:'utf8',maxBuffer:1024*1024});
 assert.equal(result.status,0,'Public frame failed independent decode: '+result.stderr);
 const min=Number(result.stdout.match(/lavfi\.signalstats\.YMIN=([\d.]+)/)?.[1]);
 const max=Number(result.stdout.match(/lavfi\.signalstats\.YMAX=([\d.]+)/)?.[1]);
 assert.ok(Number.isFinite(min)&&Number.isFinite(max)&&max-min>=12,'Actual public WebGL frame is blank');
 const bytes=fs.readFileSync(filename);return {file:path.basename(filename),bytes:bytes.length,sha256:sha(bytes),lumaRange:max-min};
}

async function main(){
 const localPreparation=process.env.PUBLIC_ORIGIN_MODE==='local-preparation';
 const base=assertBareEntry(process.env.PAGE_URL||PUBLIC_CAMPAIGN_URL,{localPreparation});
 const source=path.resolve(process.env.SOURCE_DIR||'source');
 const sourceCommit=process.env.EXPECTED_SOURCE_COMMIT,sourceTree=process.env.EXPECTED_SOURCE_TREE;
 assert.match(sourceCommit||'',/^[a-f0-9]{40}$/);assert.match(sourceTree||'',/^[a-f0-9]{40}$/);
 const sourceReview={runId:Number(process.env.EXPECTED_SOURCE_RUN),runAttempt:Number(process.env.EXPECTED_SOURCE_ATTEMPT)};
 assert.ok(Number.isSafeInteger(sourceReview.runId)&&sourceReview.runId>0);assert.ok(Number.isSafeInteger(sourceReview.runAttempt)&&sourceReview.runAttempt>0);
 const producerOrigin=localPreparation?{kind:'local-preparation'}:{kind:'github-actions',repository:process.env.GITHUB_REPOSITORY,
  headSha:process.env.GITHUB_SHA,runId:Number(process.env.GITHUB_RUN_ID),runAttempt:Number(process.env.GITHUB_RUN_ATTEMPT),job:process.env.GITHUB_JOB};
 if(!localPreparation){assert.equal(producerOrigin.repository,'amazin20/brainrot-portal');assert.match(producerOrigin.headSha||'',/^[a-f0-9]{40}$/);
  assert.ok(Number.isSafeInteger(producerOrigin.runId)&&producerOrigin.runId>0);assert.ok(Number.isSafeInteger(producerOrigin.runAttempt)&&producerOrigin.runAttempt>0);
  assert.ok(producerOrigin.job);assert.notEqual(producerOrigin.runId,sourceReview.runId,'SOURCE stamp and actual PUBLIC producer must remain distinct');}
 const out=path.resolve(process.env.OUT_DIR||'proof/public-bare-entry');fs.mkdirSync(out,{recursive:true});
 const report={kind:'campaign-v56-bare-entry-and-historical-save-isolation',pass:false,publicationAccepted:false,localPreparation,
  sourceCommit,sourceTree,sourceReview,producerOrigin,url:base.href,checks:[],errors:[],captures:[],storageObservations:[],runtimeObservations:[],
  scope:'Bare URL, ordinary menu settings, trusted Play and reload on actual candidate bytes; does not assert puzzle completion or hardware FPS.'};
 const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');let browser;
 try{
  const {readStampedCampaignInfo}=await import(pathToFileURL(path.join(source,'scripts/lib/campaign-browser-contract.mjs')));
  const {CREATIVE_CAMPAIGN_REVISION}=await import(pathToFileURL(path.join(source,'src/game/LabPreferences.js')));
  report.package=await readStampedCampaignInfo(base,sourceCommit);assert.ok(report.package);save();
  const require=createRequire(path.join(source,'package.json'));const puppeteerModule=require('puppeteer-core');const puppeteer=puppeteerModule.default??puppeteerModule;
  browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH,headless:true,protocolTimeout:180000,
   args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage();await page.setViewport({width:1024,height:768,deviceScaleFactor:1});
  page.on('pageerror',error=>report.errors.push(String(error.stack||error)));
  const historical=Object.fromEntries(HISTORICAL_PREFIXES.flatMap((prefix,index)=>[KEY,LEGACY_KEY].map(key=>[prefix+key,JSON.stringify({
   campaignRevision:CREATIVE_CAMPAIGN_REVISION,completed:[0,1,6],hints:{1:2},resumeLevel:3,quality:'low',volume:.21,muted:true,tutorial:true,historicalNamespace:index},null,2)])));
  report.seededHistoricalRecords=historical;
  const seed=await page.evaluateOnNewDocument(entries=>{for(const[key,value]of entries)localStorage.setItem(key,value);},Object.entries(historical));
  await page.evaluateOnNewDocument(()=>{window.__PUBLIC_CAMPAIGN_STORAGE_WRITES__=[];
   for(const method of ['setItem','removeItem','clear']){const original=Storage.prototype[method];Storage.prototype[method]=function(...args){
    window.__PUBLIC_CAMPAIGN_STORAGE_WRITES__.push({method,key:method==='clear'?'':String(args[0])});return original.apply(this,args);};}});
  const snapshot=()=>page.evaluate(({keys,ownKey})=>({historical:Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)])),
   own:localStorage.getItem(ownKey),writes:window.__PUBLIC_CAMPAIGN_STORAGE_WRITES__}),{keys:Object.keys(historical),ownKey:PRIVATE_PREFIX+KEY});
  const runtime=()=>page.evaluate(()=>({location:location.href,debugExposed:!!window.__NESI_DEMO_GAME__||!!window.__NESI_PREFS__,
   runtimeState:document.documentElement.dataset.runtimeState,gameReady:document.documentElement.dataset.gameReady,
   modelsLoaded:Number(document.documentElement.dataset.modelsLoaded),levelIndex:Number(document.documentElement.dataset.levelIndex),visibleRoom:Number(document.documentElement.dataset.visibleRoom),
   edition:document.body.dataset.chamberEdition,preview:document.body.dataset.tower41Preview,physicalEntry:document.body.dataset.physicalReviewEntry,gameMode:document.body.dataset.gameMode,
   selectedIndex:Number(document.querySelector('#level-select').value),hudNumber:Number(document.querySelector('#level-number').textContent),
   indices:[...document.querySelector('#level-select').options].map(option=>Number(option.value)),numbers:[...document.querySelector('#level-select').options].map(option=>Number(option.textContent.match(/^\d+/)?.[0]))}));
  const checkRuntime=async state=>{const value=await runtime();assertBareRuntime(value,{state,expectedURL:base.href});report.runtimeObservations.push(value);};
  const checkStorage=async phase=>{const observed=await snapshot();report.storageObservations.push({phase,...observed});return assertIsolatedStorage(observed,historical);};
  const ready=async()=>{await page.bringToFront();await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='ready'&&document.documentElement.dataset.gameReady==='true'&&getComputedStyle(document.querySelector('#start-screen')).opacity==='1',{timeout:180000});};
  await page.goto(base.href,{waitUntil:'domcontentloaded',timeout:60000});await page.removeScriptToEvaluateOnNewDocument(seed.identifier);await ready();await checkRuntime('ready');
  const imported=await checkStorage('imported');assert.equal(imported.volume,.21);assert.equal(imported.tutorial,true);
  report.checks.push('Bare URL imports historical progress without modifying any of18 historical records');
  await page.screenshot({path:path.join(out,'bare-menu.png')});report.captures.push(decodeFrame(path.join(out,'bare-menu.png')));save();
  await page.click('#menu-settings-button');await page.waitForFunction(()=>document.querySelector('#menu-settings').open);
  await page.$eval('#menu-volume',input=>{input.value='37';input.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.click('#menu-tutorial');await page.click('#menu-settings-done');
  const settings=await checkStorage('settings');assert.equal(settings.volume,.37);assert.equal(settings.tutorial,false);
  await page.$eval('#play-button',button=>button.scrollIntoView({block:'center'}));await page.click('#play-button');
  await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='playing',{timeout:120000});await checkRuntime('playing');
  await checkStorage('playing');const canvas=await page.$('#game canvas');assert.ok(canvas);await canvas.screenshot({path:path.join(out,'bare-playing.png')});
  report.captures.push(decodeFrame(path.join(out,'bare-playing.png')));report.checks.push('Trusted Play starts imported room4 and writes only private campaign preferences');save();
  await page.reload({waitUntil:'domcontentloaded'});await ready();await checkRuntime('ready');
  const reloaded=await checkStorage('reloaded');assert.equal(reloaded.volume,.37);assert.equal(reloaded.tutorial,false);
  report.persistedPreferences=reloaded;report.historicalRecords=Object.keys(historical).map(key=>({key,bytes:Buffer.byteLength(historical[key]),sha256:sha(Buffer.from(historical[key]))}));
  report.checks.push('Reload preserves imported progress, room4 and changed settings while all historical bytes remain unchanged');
  assert.deepEqual(report.errors,[]);report.pass=true;save();console.log('CAMPAIGN_V56_PUBLIC_BARE_ENTRY '+JSON.stringify(report));
 }catch(error){report.failure=String(error.stack||error);save();throw error;}
 finally{await browser?.close();save();}
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)await main();

