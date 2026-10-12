import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import puppeteer from 'puppeteer-core';
import {SINGULARITY_ROOMS} from '../src/game/LabSingularityLayout.js';
import {assertUpgradeInfo,assertUpgradeEvidence,captureFormat} from './lib/singularity-upgrade-proof.mjs';
import {verifySingularityUI,waitForStartMenu,playFromStartMenu,activate} from './lib/singularity-ui-check.mjs';
import {TOWER41_PREVIEW_STORAGE_PREFIX,isTower41NativePreviewPath} from '../src/game/LabTower41Preview.js';
import {oldSavePrefixes,qualificationKey} from './qa-tower41-ratchet-browser.mjs';
const out=path.resolve(process.env.OUT_DIR||'qa/singularity');fs.mkdirSync(out,{recursive:true});
const record=process.env.RECORD==='1',route=record||process.env.ROUTE==='1';
const preview=process.env.TOWER41_PREVIEW==='1',preferenceKey='brainrot-portal.preferences.v24';
const previewKey=TOWER41_PREVIEW_STORAGE_PREFIX+preferenceKey;
const preservedPrefixes=[...oldSavePrefixes,qualificationKey.slice(0,-preferenceKey.length)];
const previewSaveIsolation=preview?{pass:false,namespace:TOWER41_PREVIEW_STORAGE_PREFIX,ownKey:previewKey,legacyPrefixes:preservedPrefixes,legacySnapshot:null,phases:[],controls:{}}:null;
let preservedSaves=null;
const {fps,stride,width,height,durationToleranceSeconds}=captureFormat({fps:Number(process.env.CAPTURE_FPS||12),width:Number(process.env.CAPTURE_WIDTH||960),height:Number(process.env.CAPTURE_HEIGHT||540)});
const graphicsPreset=process.env.GRAPHICS_PRESET||'low',routeOptions=JSON.parse(process.env.ROUTE_OPTIONS||'{}');
assert.ok(['low','balanced','high'].includes(graphicsPreset));assert.ok(routeOptions&&typeof routeOptions==='object'&&!Array.isArray(routeOptions));
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',headless:true,protocolTimeout:18_000_000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],movie=path.join(out,'tower-singularity.mp4');let encoder=null,encoderExit=null,count=0,first=null,last=null,page,lastVisualFrame=-1,terminalCaptured=false;
async function observeBareNativeEntry(base){
 if(!isTower41NativePreviewPath(base.pathname))return {applicable:false,reason:'The configured browser review base is outside the standalone tower41-native entry namespace.'};
 const bare=new URL(base);bare.search='';bare.hash='';await page.goto(bare.href,{waitUntil:'domcontentloaded'});await waitForStartMenu(page);
 preservedSaves=await page.evaluate(()=>window.__TOWER41_PREVIEW_INITIAL_LEGACY_SAVES__);
 const baselineHash=createHash('sha256').update(JSON.stringify(preservedSaves)).digest('hex');
 const read=async()=>{
  const observed=await page.evaluate(({prefixes,key})=>{
   const legacy=Object.fromEntries(Object.keys(localStorage).filter(key=>prefixes.some(prefix=>key.startsWith(prefix))).sort().map(key=>[key,localStorage.getItem(key)])),raw=localStorage.getItem(key);
   return {url:location.href,pathname:location.pathname,search:location.search,state:document.documentElement.dataset.runtimeState,level:Number(document.documentElement.dataset.levelIndex)+1,preview:document.body.dataset.tower41Preview,edition:document.body.dataset.chamberEdition,startChoices:[...document.querySelector('#level-select').options].map(option=>Number(option.value)),settingsChoices:[...document.querySelector('#settings-level-select').options].map(option=>Number(option.value)),editionNavigationPresent:Boolean(document.querySelector('.edition-navigation')),editionNavigationAnchors:[...document.querySelectorAll('.edition-navigation a')].map(anchor=>anchor.getAttribute('href')),debugGameHook:typeof window.__NESI_DEMO_GAME__,debugPreferencesHook:typeof window.__NESI_PREFS__,ratchetHook:typeof window.__NESI_RUN_TOWER41_RATCHET_ROUTE__,legacy,ownRaw:raw,ownQuality:raw?JSON.parse(raw).quality:null};
  },{prefixes:preservedPrefixes,key:previewKey});
  assert.equal(observed.url,bare.href);assert.equal(observed.search,'');assert.equal(observed.state,'ready');assert.equal(observed.level,41);assert.equal(observed.preview,'true');assert.equal(observed.edition,'foundation');assert.deepEqual(observed.startChoices,[40]);assert.deepEqual(observed.settingsChoices,[40]);assert.equal(observed.editionNavigationPresent,false);assert.deepEqual(observed.editionNavigationAnchors,[]);
  assert.equal(observed.debugGameHook,'undefined');assert.equal(observed.debugPreferencesHook,'undefined');assert.equal(observed.ratchetHook,'undefined');assert.deepEqual(observed.legacy,preservedSaves);assert.ok(observed.ownRaw);
  return {...observed,ownPreferencesSha256:createHash('sha256').update(observed.ownRaw).digest('hex')};
 };
 const before=await read();const alternate=before.ownQuality==='low'?'balanced':'low';
 await activate(page,'#menu-settings-button');await page.waitForFunction(()=>document.querySelector('#menu-settings').open);await page.select('#menu-quality',alternate);
 const changed=await read();assert.equal(changed.ownQuality,alternate);assert.notEqual(changed.ownPreferencesSha256,before.ownPreferencesSha256);
 await page.select('#menu-quality',before.ownQuality);await activate(page,'#menu-settings-done');await page.waitForFunction(()=>!document.querySelector('#menu-settings').open);
 const restored=await read();assert.equal(restored.ownQuality,before.ownQuality);assert.equal(restored.ownPreferencesSha256,before.ownPreferencesSha256);
 return {applicable:true,pass:true,url:bare.href,pathname:restored.pathname,search:restored.search,state:restored.state,level:restored.level,preview:true,edition:restored.edition,startChoices:restored.startChoices,settingsChoices:restored.settingsChoices,editionNavigationPresent:restored.editionNavigationPresent,editionNavigationAnchors:restored.editionNavigationAnchors,debugGameHook:restored.debugGameHook,debugPreferencesHook:restored.debugPreferencesHook,ratchetHook:restored.ratchetHook,oldBytesUnchanged:true,legacySnapshotSha256:baselineHash,ownKey:previewKey,ownPreferencesSha256:restored.ownPreferencesSha256,settings:{control:'native-menu-quality-select',changedTo:alternate,restoredTo:before.ownQuality,ownQualityChanged:changed.ownQuality,ownQualityRestored:restored.ownQuality,beforeSha256:before.ownPreferencesSha256,changedSha256:changed.ownPreferencesSha256,restoredSha256:restored.ownPreferencesSha256},scope:'Actual no-query and no-debug native namespace entry, player-facing DOM and localStorage, with one native menu quality change and restoration before the separate debug whole-castle route.'};
}
async function previewCheckpoint(phase){
 const observed=await page.evaluate(({prefixes,key,preferenceKey})=>{
  const g=window.__NESI_DEMO_GAME__,legacy=Object.fromEntries(Object.keys(localStorage).filter(key=>prefixes.some(prefix=>key.startsWith(prefix))).sort().map(key=>[key,localStorage.getItem(key)])),raw=localStorage.getItem(key);
  return {legacy,ownRaw:raw,own:raw?JSON.parse(raw):null,preferencesReadMatchesOwn:window.__NESI_PREFS__?.storage?.getItem(preferenceKey)===raw,state:g?.state,level:(g?.levelIndex??-1)+1,preview:g?.tower41Preview===true,previewAttribute:document.body.dataset.tower41Preview,ratchetCell:Boolean(g?.firstLevel?.ratchetCell),ratchetHook:typeof window.__NESI_RUN_TOWER41_RATCHET_ROUTE__,startChoices:[...document.querySelector('#level-select').options].map(option=>Number(option.value)),settingsChoices:[...document.querySelector('#settings-level-select').options].map(option=>Number(option.value)),editionNavigationPresent:Boolean(document.querySelector('.edition-navigation')),editionNavigationAnchors:[...document.querySelectorAll('.edition-navigation a')].map(anchor=>anchor.getAttribute('href')),solved:g?.firstLevel?.getTowerMetrics().solvedIds};
 },{prefixes:preservedPrefixes,key:previewKey,preferenceKey});
 assert.deepEqual(observed.legacy,preservedSaves,'Every pre-existing namespace byte must survive '+phase);
 assert.equal(observed.preview,true);assert.equal(observed.previewAttribute,'true');assert.equal(observed.level,41);assert.equal(observed.ratchetCell,false);assert.equal(observed.ratchetHook,'undefined');
 assert.deepEqual(observed.startChoices,[40]);assert.deepEqual(observed.settingsChoices,[40]);assert.equal(observed.preferencesReadMatchesOwn,true,'Runtime preferences must use the isolated preview namespace');assert.ok(observed.ownRaw);
 assert.equal(observed.editionNavigationPresent,false,'The isolated preview must not expose navigation into an old save namespace');assert.deepEqual(observed.editionNavigationAnchors,[]);
 const result={phase,state:observed.state,level:observed.level,preview:true,ratchetCell:false,startChoices:observed.startChoices,settingsChoices:observed.settingsChoices,editionNavigationPresent:observed.editionNavigationPresent,editionNavigationAnchors:observed.editionNavigationAnchors,oldBytesUnchanged:true,legacySnapshotSha256:createHash('sha256').update(JSON.stringify(observed.legacy)).digest('hex'),ownPreferencesSha256:createHash('sha256').update(observed.ownRaw).digest('hex'),namespaceUsed:true,ownCompleted:observed.own.completed,ownResumeLevel:observed.own.resumeLevel,ownQuality:observed.own.quality,solved:observed.solved};
 previewSaveIsolation.phases.push(result);fs.writeFileSync(path.join(out,'preview-save-isolation.json'),JSON.stringify(previewSaveIsolation,null,2)+'\n');return result;
}
async function previewSettingsAndPause(){
 await activate(page,'#menu-settings-button');await page.waitForFunction(()=>document.querySelector('#menu-settings').open);
 const alternate=graphicsPreset==='low'?'balanced':'low';await page.select('#menu-quality',alternate);
 assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).quality,previewKey),alternate);
 await page.select('#menu-quality',graphicsPreset);await activate(page,'#menu-settings-done');await page.waitForFunction(()=>!document.querySelector('#menu-settings').open);
 previewSaveIsolation.controls.settings={control:'native-menu-quality-select',changedTo:alternate,restoredTo:graphicsPreset};await previewCheckpoint('after-settings');
 await playFromStartMenu(page,false,graphicsPreset);await page.evaluate(()=>window.__NESI_DEMO_GAME__.renderer.setAnimationLoop(null));await previewCheckpoint('after-play');
 await page.bringToFront();await page.evaluate(()=>window.__NESI_DEMO_GAME__.renderer.setAnimationLoop(window.__NESI_DEMO_GAME__.animate));await page.keyboard.press('Escape');
 let pointerLockExitFallback=false;
 try{await page.waitForFunction(()=>!document.pointerLockElement,{timeout:5000});}catch(error){if(error.name!=='TimeoutError')throw error;await page.evaluate(()=>document.exitPointerLock());pointerLockExitFallback=true;}
 if(await page.evaluate(()=>window.__NESI_DEMO_GAME__.state==='playing'))await activate(page,'#pause-button');
 await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='paused');await page.waitForFunction(()=>{const screen=document.querySelector('#pause-screen');return !screen.inert&&getComputedStyle(screen).opacity==='1';});
 const paused=await previewCheckpoint('after-pause');assert.equal(paused.state,'paused');
 await page.focus('#resume-button');await page.keyboard.press('Enter');await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='playing');await page.evaluate(()=>window.__NESI_DEMO_GAME__.renderer.setAnimationLoop(null));
 const resumed=await previewCheckpoint('after-resume');assert.equal(resumed.state,'playing');previewSaveIsolation.controls.pauseResume={pass:true,pauseControl:'native-escape-or-hud',pointerLockExitFallback,resumeControl:'focused-native-enter',pausedState:paused.state,resumedState:resumed.state};
}
async function previewVictoryReplayReload(){
 const won=await previewCheckpoint('after-win');assert.equal(won.state,'won');assert.deepEqual(won.ownCompleted,[40]);assert.equal(won.ownResumeLevel,40);
 const label=await page.$eval('#play-again-button',button=>button.textContent);assert.match(label,/Пройти ещё раз/);
 await activate(page,'#play-again-button');await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='playing');await page.evaluate(()=>window.__NESI_DEMO_GAME__.renderer.setAnimationLoop(null));
 const replay=await previewCheckpoint('after-replay');assert.equal(replay.state,'playing');assert.deepEqual(replay.solved,[]);
 const replayAtSpawn=await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;return g.playerPosition.distanceTo(g.firstLevel.spawn)<.5;});assert.equal(replayAtSpawn,true);
 previewSaveIsolation.controls.replay={pass:true,button:'#play-again-button',label,level:replay.level,state:replay.state,solved:replay.solved,atSpawn:replayAtSpawn};
 await page.reload({waitUntil:'domcontentloaded'});await waitForStartMenu(page);const reload=await previewCheckpoint('after-reload');assert.equal(reload.state,'ready');assert.deepEqual(reload.solved,[]);assert.deepEqual(reload.ownCompleted,[40]);assert.equal(reload.ownResumeLevel,40);
 previewSaveIsolation.controls.reload={pass:true,state:reload.state,level:reload.level,completed:reload.ownCompleted,resumeLevel:reload.ownResumeLevel};previewSaveIsolation.pass=true;
 fs.writeFileSync(path.join(out,'preview-save-isolation.json'),JSON.stringify(previewSaveIsolation,null,2)+'\n');
}
// Capture only the actual production canvas. CDP's compositor screenshot can
// stall software WebGL even when synchronous canvas readback remains healthy.
async function saveCanvasPng(filename){
 const capture=await page.evaluate(()=>{
  const g=window.__NESI_DEMO_GAME__;if(!g)throw Error('No gameplay canvas available');
  const snapshot=()=>[g.state,g.elapsed,...g.playerPosition.toArray(),...g.cargo.position.toArray(),g.firstLevel.completedStages],before=snapshot();
  g.render();const c=document.createElement('canvas');c.width=g.renderer.domElement.width;c.height=g.renderer.domElement.height;const ctx=c.getContext('2d',{alpha:false});ctx.drawImage(g.renderer.domElement,0,0);
  const png=c.toDataURL('image/png');if(JSON.stringify(before)!==JSON.stringify(snapshot()))throw Error('Canvas capture advanced gameplay');
  return {png,width:c.width,height:c.height};
 });
 assert.equal(capture.width,width);assert.equal(capture.height,height);
 fs.writeFileSync(path.join(out,filename),Buffer.from(capture.png.slice(capture.png.indexOf(',')+1),'base64'));
}
if(record){encoder=spawn('ffmpeg',['-y','-hide_banner','-loglevel','error','-f','image2pipe','-vcodec','mjpeg','-framerate',String(fps),'-i','pipe:0','-an','-c:v','libx264','-preset','veryfast','-crf','25','-pix_fmt','yuv420p','-movflags','+faststart',movie],{stdio:['pipe','ignore','pipe']});encoder.stderr.on('data',b=>process.stderr.write(b));encoderExit=once(encoder,'exit');}
try{
 page=await browser.newPage();page.setDefaultTimeout(180000);await page.setViewport({width,height,deviceScaleFactor:1});page.on('pageerror',e=>errors.push(String(e)));
 if(preview)await page.evaluateOnNewDocument(({graphicsPreset,prefixes,key,preferenceKey})=>{
  for(const prefix of prefixes)if(localStorage.getItem(prefix+preferenceKey)===null)localStorage.setItem(prefix+preferenceKey,JSON.stringify({quality:'balanced',volume:.65,muted:true,tutorial:true,completed:[0,1,42],hints:{42:2},resumeLevel:42,campaignRevision:'creative-campaign-v48',roomRevisions:{16:'cable-supported-architecture-v1',32:'siphon-observatory-v1',50:'echo-horizon-v1'}}));
  window.__TOWER41_PREVIEW_INITIAL_LEGACY_SAVES__=Object.fromEntries(Object.keys(localStorage).filter(key=>prefixes.some(prefix=>key.startsWith(prefix))).sort().map(key=>[key,localStorage.getItem(key)]));
  if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify({quality:graphicsPreset,muted:true,tutorial:true,completed:[],hints:{},resumeLevel:40}));
 },{graphicsPreset,prefixes:preservedPrefixes,key:previewKey,preferenceKey});
 else await page.evaluateOnNewDocument(graphicsPreset=>localStorage.setItem('brainrot-foundation-v1:brainrot-portal.preferences.v24',JSON.stringify({quality:graphicsPreset,muted:true,tutorial:true})),graphicsPreset);
 await page.exposeFunction('__SINGULARITY_WRITE__',async batch=>{
  for(const f of batch){assert.equal(f.index,count);assert.equal(terminalCaptured,false,'No frame may follow the final won sample');
   if(f.terminal){assert.equal(f.state.state,'won');assert.ok(f.visualFrame>lastVisualFrame&&f.visualFrame<count*stride&&count*stride-f.visualFrame<stride,'Final won sample must lie within the next capture interval');terminalCaptured=true;}
   else assert.equal(f.visualFrame,count*stride);
   lastVisualFrame=f.visualFrame;const bytes=Buffer.from(f.jpeg.slice(f.jpeg.indexOf(',')+1),'base64');first??=f.state;last=f.state;
   if(count===0)fs.writeFileSync(path.join(out,'gameplay-start.jpg'),bytes);
   if(f.state.solved.length>=Math.ceil(SINGULARITY_ROOMS.length/2)&&!fs.existsSync(path.join(out,'gameplay-middle.jpg')))fs.writeFileSync(path.join(out,'gameplay-middle.jpg'),bytes);
   if(!encoder.stdin.write(bytes))await once(encoder.stdin,'drain');count++;
  }
  if(count%120===0)console.log('CAPTURE',count/fps,'seconds;',last.solved.length,'machines');
 });
 const base=new URL(process.env.PAGE_URL||'http://127.0.0.1:4173/');
 if(preview){previewSaveIsolation.bareEntry=await observeBareNativeEntry(base);fs.writeFileSync(path.join(out,'preview-save-isolation.json'),JSON.stringify(previewSaveIsolation,null,2)+'\n');}
 const url=new URL(base);url.searchParams.set('level','41');url.searchParams.set('edition','foundation');url.searchParams.set('debug','1');
 if(preview){url.searchParams.set('tower41preview','1');url.searchParams.delete('tower41ratchet');url.searchParams.delete('pilot');assert.equal(route,true,'Preview isolation proof requires the real whole castle route');const playerURL=new URL(url);playerURL.searchParams.delete('debug');playerURL.searchParams.delete('smoke');previewSaveIsolation.playerURL=playerURL.href;previewSaveIsolation.reviewURL=url.href;}
 await page.goto(url.href,{waitUntil:'domcontentloaded'});await waitForStartMenu(page);
 const info=await page.evaluate(async()=>{const r=await fetch('build-info.json');if(!r.ok)throw Error('Missing build identity');return r.json();});
 if(process.env.BUILD_COMMIT)assert.equal(info.commit,process.env.BUILD_COMMIT);const tower=assertUpgradeInfo(info,SINGULARITY_ROOMS);
 if(preview){const currentBaseline=await page.evaluate(()=>window.__TOWER41_PREVIEW_INITIAL_LEGACY_SAVES__);if(preservedSaves)assert.deepEqual(currentBaseline,preservedSaves,'The bare-entry legacy snapshot must survive the separate debug route navigation');else preservedSaves=currentBaseline;assert.equal(Object.keys(preservedSaves).length>=preservedPrefixes.length,true);previewSaveIsolation.legacySnapshot=preservedSaves;await previewCheckpoint('after-load');await previewSettingsAndPause();}
 else await playFromStartMenu(page,false,graphicsPreset);
 await page.evaluate(()=>window.__NESI_DEMO_GAME__.renderer.setAnimationLoop(null));
 const nativeCanvas=await page.evaluate(()=>{const c=window.__NESI_DEMO_GAME__.renderer.domElement;return {width:c.width,height:c.height};});assert.deepEqual(nativeCanvas,{width,height},'Capture dimensions must match the actual production canvas');
 const renderBenchmark=await page.evaluate(({width,height})=>{const g=window.__NESI_DEMO_GAME__,snapshot=()=>[g.elapsed,...g.playerPosition.toArray(),...g.cargo.position.toArray(),g.firstLevel.completedStages],before=snapshot();const c=document.createElement('canvas');c.width=width;c.height=height;const ctx=c.getContext('2d',{alpha:false});const render=()=>{g.render();ctx.drawImage(g.renderer.domElement,0,0);c.toDataURL('image/jpeg',.83);};const warmupMs=[],times=[];for(let i=0;i<5;i++){const t=performance.now();render();(i<2?warmupMs:times).push(performance.now()-t);}if(JSON.stringify(before)!==JSON.stringify(snapshot()))throw Error('Render inspection advanced gameplay');return {warmupMs,timesMs:times,meanMs:times.reduce((s,x)=>s+x,0)/times.length,width,height,drawCalls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles,method:'Software-renderer/readback cost at frozen ordinary start after two warmup frames; not hardware FPS.'};},{width,height});
 fs.writeFileSync(path.join(out,'render-benchmark.json'),JSON.stringify(renderBenchmark,null,2));console.log('RENDER COST',JSON.stringify(renderBenchmark));await saveCanvasPng('ordinary-start.png');
 if(!route){
  const samples=await page.evaluate(()=>{
   const g=window.__NESI_DEMO_GAME__,r=[...g.firstLevel.rooms.values()].map(r=>({id:r.def.id,position:[r.def.at[0]+Math.min(10,r.def.w*.2),r.def.at[1]+Math.min(9,r.def.h*.65),r.def.at[2]+Math.min(15,r.def.d*.35)],target:[...r.def.at]}));
   const overrides={freight:{position:[-29,7.4,53],target:[-48,4,33]},sluice:{position:[63,10,55],target:[42,5,29]},optics:{position:[-19,10,-28],target:[-49,4,-42]},hoist:{position:[62,22,-18],target:[42,12,-39]},archive:{position:[-25,27,44],target:[-47,23,29]},flywheel:{position:[-34,28,-21],target:[-48,23,-45]},magnet:{position:[65,29,51],target:[45,24,37]},migrant:{position:[56,45,-15],target:[38,40,-34]},pendulum:{position:[-26,51,52],target:[-52,42,33]},inertia:{position:[-17,68,-18],target:[-52,59,-39]},crown:{position:[-35,86,42],target:[-53,77,27]}};for(const s of r)if(overrides[s.id])Object.assign(s,overrides[s.id]);r.unshift({id:'atrium',position:[8,61,52],target:[0,28,-18]});return r;
  });
  for(const s of samples){await page.evaluate(s=>{const g=window.__NESI_DEMO_GAME__;g.camera.position.fromArray(s.position);g.camera.lookAt(...s.target);g.camera.fov=72;g.camera.updateProjectionMatrix();g.camera.updateWorldMatrix(true,false);},s);await saveCanvasPng(`inspection-${s.id}.png`);}
  fs.writeFileSync(path.join(out,'inspection.json'),JSON.stringify({sourceCommit:info.commit,version:info.version,graphicsPreset,width,height,rooms:samples.map(s=>s.id),method:'Camera-only architectural inspections from the actual production canvas; DOM controls are checked separately. These images do not assert a completed playthrough.',errors},null,2));
  await verifySingularityUI(browser,{url,info,out});
 }else{
  const report=await page.evaluate(async ({record,stride,width,height,routeOptions})=>{
   const g=window.__NESI_DEMO_GAME__,body=g.physics.cargoBody.id,events=[],telemetry=[];let frames=0,encoded=0,batch=[],lastCaptured=-1,lastSolved=0,seenResets=0;
   const oldPhysics=g.updatePlaying,oldReset=g.resetRun;
   g.resetRun=function(...a){seenResets++;return oldReset.apply(this,a);};
   g.updatePlaying=function(dt,...args){const result=oldPhysics.call(this,dt,...args);const n=g.firstLevel.completedStages;if(n!==lastSolved){if(n!==lastSolved+1)throw Error('Progress jumped');events.push(g.firstLevel.getTowerMetrics().events.at(-1));lastSolved=n;}return result;};
   const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{alpha:false});
   const capture=(state,terminal=false)=>{if(g.renderer.domElement.width!==width||g.renderer.domElement.height!==height)throw Error('Production canvas dimensions changed during recording');g.render();ctx.drawImage(g.renderer.domElement,0,0);batch.push({index:encoded++,visualFrame:frames,terminal,jpeg:canvas.toDataURL('image/jpeg',.83),state});lastCaptured=frames;};
   window.__SINGULARITY_FRAME__=async state=>{if(state.cargoBodyId!==body||seenResets)throw Error('Original attempt changed');frames=state.visualFrame;if(record&&frames%stride===0)capture(state);if(frames%60===0)telemetry.push(state);};
   window.__SINGULARITY_FLUSH__=async()=>{if(batch.length){const pending=batch;batch=[];await window.__SINGULARITY_WRITE__(pending);}};
   try{
    const result=await window.__NESI_RUN_LEVEL_ROUTE__(routeOptions);
    // Include the actual final won state when it falls between regular samples.
    // No extra physics, animation frames or stationary padding are introduced.
    if(record&&lastCaptured<result.frames-1){frames=result.frames-1;capture({state:g.state,player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),solved:g.firstLevel.getTowerMetrics().solvedIds,cargoBodyId:body,visualFrame:frames,seconds:result.seconds},true);}
    await window.__SINGULARITY_FLUSH__();return {result,observed:{events,telemetry,seenResets,bodyId:body},encodedFrames:encoded};
   }catch(error){window.__SINGULARITY_FAILURE__={error:String(error),report:error.singularityReport,events,telemetry};throw error;}
   finally{g.updatePlaying=oldPhysics;g.resetRun=oldReset;delete window.__SINGULARITY_FRAME__;delete window.__SINGULARITY_FLUSH__;}
  },{record,stride,width,height,routeOptions});
  assert.equal(report.result.pass,true);assert.equal(report.result.metrics.completedStages,tower.stages);assert.equal(report.observed.events.length,tower.stages);assert.equal(new Set(report.observed.events.map(e=>e.id)).size,tower.stages);assert.equal(report.observed.seenResets,0);assert.equal(report.result.sameCompanion,true);
  await saveCanvasPng('ordinary-victory.png');
  const proof={sourceCommit:info.commit,version:info.version,graphicsPreset,routeOptions,rooms:tower.rooms,capture:{method:'Synchronous actual production-canvas readback; DOM controls are checked separately.',nativeCanvas,width,height,fps,stride},method:'Continuous ordinary scripted input through production physics. No actor placement, no puzzle-state assignment, no resets. Not a human playtest or a minimum-time proof.',...report,errors};
  if(record){encoder.stdin.end();const [code]=await encoderExit;encoder=null;assert.equal(code,0);assert.equal(count,report.encodedFrames);assert.equal(last.state,'won');
   const metadata=JSON.parse(execFileSync('ffprobe',['-v','quiet','-show_streams','-show_format','-of','json',movie],{encoding:'utf8'}));const video=metadata.streams.find(s=>s.codec_type==='video');assert.equal(video.codec_name,'h264');assert.equal(video.width,width);assert.equal(video.height,height);assert.equal(Number(video.nb_frames),count);assert.equal(video.avg_frame_rate,`${fps}/1`);assert.ok(Math.abs(Number(metadata.format.duration)-count/fps)<.12);
   proof.video={filename:path.basename(movie),sha256:createHash('sha256').update(fs.readFileSync(movie)).digest('hex'),frames:count,fps,stride,durationSeconds:count/fps,durationToleranceSeconds,simulationSeconds:report.result.seconds,terminalSample:terminalCaptured,lastVisualFrame,width,height,nativeCanvas,first,last};
  }
  if(preview){await previewVictoryReplayReload();proof.previewSaveIsolation=previewSaveIsolation;}
  assertUpgradeEvidence(proof,info,{record});
  fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify(proof,null,2));console.log('VERIFIED',info.commit,report.result.seconds,report.result.activeSeconds,count);
 }
 assert.deepEqual(errors,[]);
}catch(error){console.error(error);const detail=page?await page.evaluate(()=>window.__SINGULARITY_FAILURE__||null).catch(()=>null):null;fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({error:String(error),detail,capture:{width,height,fps,stride},errors,...(preview?{previewSaveIsolation}:{})},null,2));if(page)await saveCanvasPng('failure.png').catch(()=>{});throw error;}
finally{if(encoder){encoder.stdin.end();await encoderExit.catch(()=>{});}await browser.close();}
