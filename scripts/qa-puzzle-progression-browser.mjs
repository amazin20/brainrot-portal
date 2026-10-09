import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import puppeteer from 'puppeteer-core';

const level=Number(process.env.LEVEL);
assert.ok([44,45,46].includes(level),'LEVEL must identify a rebuilt room 44–46');
const sourceReview={runId:Number(process.env.SOURCE_REVIEW_RUN_ID||process.env.GITHUB_RUN_ID||0),runAttempt:Number(process.env.SOURCE_REVIEW_RUN_ATTEMPT||process.env.GITHUB_RUN_ATTEMPT||0)};
assert.ok(Object.values(sourceReview).every(n=>Number.isSafeInteger(n)&&n>=0),'Finite source review identity required');
const out=path.resolve(process.env.OUT_DIR||`qa/puzzle-progression-browser-${level}`);
fs.mkdirSync(out,{recursive:true});
const base=process.env.PAGE_URL||'http://127.0.0.1:4173/';
const errors=[],shots=[],report={pass:false,level,sourceCommit:process.env.BUILD_COMMIT||null,sourceReview,errors,shots,
 limitations:['Scripted production controls and software WebGL; human puzzle discovery and physical-device FPS are not measured.']};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
let server,browser,page;
const focusDiagnostics=async()=>page?await page.evaluate(()=>({state:window.__NESI_DEMO_GAME__?.state,hasFocus:document.hasFocus(),hidden:document.hidden,
 activeElement:document.activeElement?.id||document.activeElement?.tagName,pointerLocked:Boolean(document.pointerLockElement),
 externalBlocked:window.__NESI_DEMO_GAME__?.externalBlocked,externalPause:document.body.dataset.externalPause})).catch(error=>({unavailable:String(error)})):null;
try{
 if(process.env.START_SERVER==='1'){
  server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4173'],{stdio:'ignore'});
  for(let n=0;n<200;n++){
   if(server.exitCode!==null)throw Error('Preview server stopped');
   try{if((await fetch(base)).ok)break;}catch{}
   assert(n<199,'Preview did not start');await new Promise(r=>setTimeout(r,50));
  }
 }
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,protocolTimeout:600000,
  args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 page=await browser.newPage();page.setDefaultTimeout(180000);
 await page.setViewport({width:960,height:540,deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(String(e)));
 const originalKey='brainrot-foundation-v1:brainrot-portal.preferences.v24';
 const originalSave=JSON.stringify({quality:'low',muted:true,tutorial:true,completed:[0,1,42],resumeLevel:42,campaignRevision:'creative-campaign-v48',roomRevisions:{16:'cable-supported-architecture-v1',32:'siphon-observatory-v1',50:'echo-horizon-v1'}});
 await page.evaluateOnNewDocument(({originalKey,originalSave})=>{
  localStorage.setItem(originalKey,originalSave);
  const key='brainrot-puzzle-progression-v1:brainrot-portal.preferences.v24';
  if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({quality:'low',muted:true,tutorial:true}));
 },{originalKey,originalSave});
 await page.exposeFunction('__NESI_SAVE_PILOT_FRAME__',(name,data,state)=>{
  assert.match(name,/^[a-z0-9-]+$/);assert.match(data,/^data:image\/jpeg;base64,/);
  const file=name+'.jpg';fs.writeFileSync(path.join(out,file),Buffer.from(data.slice(data.indexOf(',')+1),'base64'));
  shots.push({file,...state});save();
 });
 const url=new URL(base);url.searchParams.set('edition','foundation');url.searchParams.set('level',String(level));url.searchParams.set('pilot','progression');url.searchParams.set('debug','1');
 await page.goto(url.href,{waitUntil:'networkidle2'});
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready');
 const info=await page.evaluate(async()=>{const r=await fetch('build-info.json');if(!r.ok)throw Error('Missing build metadata');return r.json();});
 if(process.env.BUILD_COMMIT)assert.equal(info.commit,process.env.BUILD_COMMIT);
 report.build=info.commit;
 assert.equal(await page.evaluate(()=>window.__NESI_DEMO_GAME__.firstLevel.puzzleProgression),level);
 assert.equal(await page.$eval('#level-select',e=>e.options.length),4);
 assert.equal(await page.$eval('#level-select',e=>Number(e.value)),level-1);
 assert.match(await page.$eval('#campaign-count',e=>e.textContent),/43–46/);
 await page.waitForFunction(()=>{const e=document.querySelector('#start-screen');return !e.inert&&getComputedStyle(e).opacity==='1';});
 await page.$eval('#play-button',e=>e.scrollIntoView({block:'center'}));
 await page.click('#play-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='playing');
 const route=await page.evaluate(async()=>{
  const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop(null);
  const identity=g.cargo.group.uuid,body=g.physics.cargoBody.id,writes=[];
  const cargoObject=g.cargo,bodyObject=g.physics.cargoBody,playerRoot=g.playerGroup,playerVisual=g.playerVisual,animator=g.animator;
  const sourceMeshes=[];playerVisual.traverse(mesh=>{if(mesh.isMesh)sourceMeshes.push({mesh,geometry:mesh.geometry,uuid:mesh.uuid,vertices:mesh.geometry.attributes.position?.count||0,bones:mesh.skeleton?.bones.length||0});});
  const vertices=sourceMeshes.reduce((n,m)=>n+m.vertices,0),bones=Math.max(0,...sourceMeshes.map(m=>m.bones));
  if(vertices<1000||bones<10)throw Error('Original rigged player geometry is required');
  const visual=g.updateVisuals,resetRun=g.resetRun,resetCargo=g.physics.resetCargo,respawn=g.respawn;
  let observedFrames=0;const initialization={resetRun:0,resetCargo:0,respawn:0};
  const noteReset=key=>{if(observedFrames!==0)throw Error('In-route '+key+' is not permitted');initialization[key]++;};
  g.resetRun=function(...a){noteReset('resetRun');return resetRun.apply(this,a);};
  g.physics.resetCargo=function(...a){noteReset('resetCargo');return resetCargo.apply(this,a);};
  g.respawn=function(...a){noteReset('respawn');return respawn.apply(this,a);};
  g.updateVisuals=function(...a){const result=visual.apply(this,a);if(a[0]>0){
   if(g.cargo!==cargoObject||g.physics.cargoBody!==bodyObject||g.playerGroup!==playerRoot||g.playerVisual!==playerVisual||g.animator!==animator)throw Error('Original actors changed');
   if(sourceMeshes.some(m=>m.mesh.geometry!==m.geometry||m.geometry.attributes.position.count!==m.vertices))throw Error('Original player mesh changed');
   observedFrames++;
  }return result;};
  const capture=name=>{
   g.render();writes.push(window.__NESI_SAVE_PILOT_FRAME__(name,g.renderer.domElement.toDataURL('image/jpeg',.9),{
    state:g.state,player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),camera:g.camera.position.toArray(),
    calls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles,width:g.renderer.domElement.width,height:g.renderer.domElement.height}));
  };
  capture('start');let index=0;
  window.__NESI_CAPTURE_LEVEL_MARK__=mark=>capture('step-'+String(++index).padStart(2,'0'));
  try{
   const result=await window.__NESI_RUN_LEVEL_ROUTE__();capture('finish');await Promise.all(writes);
   return {...result,state:g.state,sameCompanion:g.cargo.group.uuid===identity&&g.physics.cargoBody.id===body,modelIdentity:{pass:true,observedFrames,playerRootUuid:playerRoot.uuid,playerVertices:vertices,bones,cargoUuid:identity,cargoBodyId:body,initialization,routeResets:0,routeRespawns:0}};
  }finally{g.updateVisuals=visual;g.resetRun=resetRun;g.physics.resetCargo=resetCargo;g.respawn=respawn;delete window.__NESI_CAPTURE_LEVEL_MARK__;await Promise.allSettled(writes);}
 });
 report.route=route;report.modelIdentity=route.modelIdentity;save();assert.equal(route.pass,true);assert.equal(route.state,'won');assert.equal(route.sameCompanion,true);
 assert.equal(route.level,level);assert.equal(route.resets,0);assert.equal(route.respawns,0);assert.ok(route.milestones.length>=5);
 assert.equal(route.modelIdentity.observedFrames,route.frames);
 assert.deepEqual(route.modelIdentity.initialization,{resetRun:1,resetCargo:1,respawn:1});
 assert.equal(await page.evaluate(key=>localStorage.getItem(key),originalKey),originalSave,'Progression must preserve campaign progress');
 report.originalProgressUnchanged=true;
 console.log('PROGRESSION_STAGE',JSON.stringify({stage:'route',pass:true,frames:route.frames,teleports:route.teleports,shots:shots.length}));
 await page.click('#play-again-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='playing');
 const nextIndex=level===46?42:level;
 assert.equal(await page.evaluate(()=>window.__NESI_DEMO_GAME__.levelIndex),nextIndex);report.nextRoomPassed=true;
 // Re-enter through the actual level menu; no direct scene selection fixture.
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!document.pointerLockElement,{timeout:5000}).catch(async error=>{if(error.name!=='TimeoutError')throw error;await page.evaluate(()=>document.exitPointerLock());});
 if(await page.evaluate(()=>window.__NESI_DEMO_GAME__?.state==='playing'))await page.click('#pause-button');
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='paused');
 await page.waitForFunction(()=>{const e=document.querySelector('#pause-screen');return !e.inert&&getComputedStyle(e).opacity==='1';});
 await page.click('#level-menu-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready');
 await page.waitForFunction(()=>{const e=document.querySelector('#start-screen');return !e.inert&&getComputedStyle(e).opacity==='1';});
 await page.click(`.room-node[data-level="${level}"]`);
 await page.focus('#play-button');await page.keyboard.press('Enter');
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='playing');
 assert.equal(await page.evaluate(()=>window.__NESI_DEMO_GAME__.levelIndex),level-1);
 assert.equal(await page.evaluate(()=>window.__NESI_DEMO_GAME__.firstLevel.puzzleProgression),level);report.replayPassed=true;
 console.log('PROGRESSION_STAGE',JSON.stringify({stage:'replay',pass:true}));
 await page.bringToFront();
 report.pauseControl='escape-or-hud';
 report.pauseBeforeFocus=await page.evaluate(()=>({hasFocus:document.hasFocus(),activeElement:document.activeElement?.id||document.activeElement?.tagName,
  pointerLocked:Boolean(document.pointerLockElement),externalBlocked:window.__NESI_DEMO_GAME__?.externalBlocked,
  externalPause:document.body.dataset.externalPause,state:window.__NESI_DEMO_GAME__?.state}));
 await page.keyboard.press('Escape');
 try{await page.waitForFunction(()=>!document.pointerLockElement,{timeout:5000});}
 catch(error){
  if(error.name!=='TimeoutError')throw error;
  const locked=await page.evaluate(()=>Boolean(document.pointerLockElement));
  if(locked){await page.evaluate(()=>document.exitPointerLock());report.pointerLockExitFallback=true;
   await page.waitForFunction(()=>!document.pointerLockElement,{timeout:5000});}
 }
 report.pauseControlUsed='escape';
 if(await page.evaluate(()=>window.__NESI_DEMO_GAME__?.state==='playing')){
  await page.click('#pause-button');report.pauseControlUsed='hud';
 }
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='paused',{timeout:30000});
 console.log('PROGRESSION_STAGE',JSON.stringify({stage:'pause',pass:true,used:report.pauseControlUsed,before:report.pauseBeforeFocus}));
 await page.waitForFunction(()=>{
  const screen=document.querySelector('#pause-screen'),button=document.querySelector('#resume-button'),style=getComputedStyle(screen);
  return !document.pointerLockElement&&!screen.inert&&style.opacity==='1'&&style.visibility==='visible'&&!button.disabled;
 },{timeout:30000});
 await page.bringToFront();await page.focus('#resume-button');
 report.resumeControl='focused-native-enter';report.resumeBeforeFocus=await focusDiagnostics();
 console.log('PROGRESSION_STAGE',JSON.stringify({stage:'resume-input',control:report.resumeControl,before:report.resumeBeforeFocus}));
 await page.keyboard.press('Enter');
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='playing',{timeout:30000});report.pauseResumePassed=true;
 console.log('PROGRESSION_STAGE',JSON.stringify({stage:'resume',pass:true,control:report.resumeControl}));
 await page.evaluate(()=>window.__NESI_DEMO_GAME__.renderer.setAnimationLoop(null));
 await page.setViewport({width:390,height:844,deviceScaleFactor:1});
 await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;g.viewportResize();g.render();});
 await page.screenshot({path:path.join(out,'mobile.png')});report.mobileControls=await page.$eval('#mobile-controls',e=>!e.inert);assert.equal(report.mobileControls,true);
 const pixelCode=`import json,sys\nfrom PIL import Image,ImageStat\nr=[]\nfor p in sys.argv[1:]:\n im=Image.open(p).convert('RGB');s=im.resize((64,36));v=max(ImageStat.Stat(s).stddev);assert v>2,(p,v);r.append({'file':p.split('/')[-1],'width':im.width,'height':im.height,'std':v})\nprint(json.dumps(r))`;
 report.pixels=JSON.parse(execFileSync(process.env.CODEX_PRIMARY_RUNTIME_PYTHON||'python3',['-c',pixelCode,...shots.map(s=>path.join(out,s.file)),path.join(out,'mobile.png')],{encoding:'utf8'}));
 assert.deepEqual(errors,[]);report.pass=true;save();console.log(JSON.stringify({pass:true,routeFrames:route.frames,teleports:route.teleports,shots:shots.length}));
}catch(e){report.failure=String(e?.stack||e);report.failureFocus=await focusDiagnostics();save();
 console.error('PROGRESSION_FAILURE',JSON.stringify({sourceCommit:report.sourceCommit,failure:String(e),focus:report.failureFocus,
  pauseControl:report.pauseControl,pauseControlUsed:report.pauseControlUsed,pauseBeforeFocus:report.pauseBeforeFocus,
  resumeControl:report.resumeControl,resumeBeforeFocus:report.resumeBeforeFocus}));throw e;}
finally{await browser?.close();server?.kill();}
