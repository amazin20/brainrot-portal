import fs from 'node:fs';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import {CAMPAIGN} from '../src/game/LabCampaignLevels.js';
import {ALL_LAB_ASSETS} from '../src/game/labAssets.js';
const root=process.env.PAGE_URL||'http://127.0.0.1:4173/',out=process.env.EVIDENCE_OUT||'smoke-artifacts';
const first=Number(process.env.NESI_FIRST??1),last=Number(process.env.NESI_LAST??CAMPAIGN.length);
assert.ok(Number.isInteger(first)&&Number.isInteger(last)&&first>=1&&first<=last&&last<=CAMPAIGN.length,'NESI_FIRST/NESI_LAST must select a valid inclusive course range');
function flag(name,fallback){
 const value=process.env[name];if(value===undefined)return fallback;
 assert.match(value,/^(true|false|1|0)$/i,`${name} must be true/false or 1/0`);
 return /^(true|1)$/i.test(value);
}
const checkUI=flag('NESI_UI',first===1),capturePuzzle=flag('NESI_CAPTURE_PUZZLE',true);
// Native excerpts from observable milestones of the same ordinary routes.
// These windows never change the route, the camera or any physical state.
const capturePlans={
 12:[['crossing flight',150]],
 13:[['live weight turns the mirror',90],['weighted ray lifts the crossing',90],['the return side of the light',90]],
 14:[['first woven crossing',90],['folded upper return',90],['perpendicular light crossing',90]],
 15:[['reverse freight extraction',90],['ascending countercurrent',90],['airborne lane exchange',90]],
};
const expectedIds=[...new Set(CAMPAIGN.slice(first-1,last).flatMap(level=>level.assets))].sort((a,b)=>a-b);
const expectedFiles=ALL_LAB_ASSETS.filter(asset=>expectedIds.includes(asset.id)).map(asset=>asset.file).sort();
assert.equal(expectedFiles.length,expectedIds.length,'Every selected course dependency must exist in the source asset catalog');
function startUrl(level){const url=new URL(root);url.searchParams.set('debug','1');url.searchParams.set('level',String(level));return url.href;}
fs.mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,timeout:60000,protocolTimeout:720000,
 args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage();await page.setViewport({width:1280,height:800});page.setDefaultTimeout(120000);
const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('.glb'))requests.push(r.url());});
const report={renderer:'CI Chromium / SwiftShader; NOT a user-device FPS benchmark',baseUrl:root,range:{first,last},ui:checkUI,
 capturePuzzle,puzzleClips:[],routes:[],errors};
const ready=()=>page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready');
const shot=name=>page.screenshot({path:`${out}/${name}.png`});
async function clickMenu(selector){
 await page.waitForFunction(selector=>{
   const e=document.querySelector(selector),screen=e?.closest('.screen');
   return e&&!e.disabled&&(!screen||(!screen.inert&&getComputedStyle(screen).opacity==='1'))&&!document.pointerLockElement;
 },{},selector);
 await page.locator(selector).click();
}
const uiState=()=>page.evaluate(()=>({level:window.__NESI_DEMO_GAME__?.levelIndex,state:window.__NESI_DEMO_GAME__?.state,
 blocked:window.__NESI_DEMO_GAME__?.externalBlocked,focused:document.hasFocus(),hidden:document.hidden,locked:!!document.pointerLockElement,
 body:document.body.dataset.playState,win:document.querySelector('#win-screen')?.className,pause:document.querySelector('#pause-screen')?.className,
 button:document.querySelector('#play-again-button')?.textContent,error:document.querySelector('#error-detail')?.textContent}));
try{
 await page.goto(startUrl(first),{waitUntil:'networkidle2'});await ready();
 assert.equal(await page.$$eval('#level-select option',a=>a.length),CAMPAIGN.length);
 assert.equal(await page.title(),'БРЕЙНРОТ ПОРТАЛ — физическая 3D-головоломка');
 if(first===1)assert.equal(requests.length,4);
 await shot('menu');await page.click('#play-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.state==='playing');
 if(first===1)await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.performanceMonitor.stats.fps>0);
 await shot(`level-${first}-start`);
 report.initial=await page.evaluate(()=>({models:window.__NESI_DEMO_GAME__.assets.size,fps:document.querySelector('.lab-fps').textContent,
  oldHudHidden:getComputedStyle(document.querySelector('#hud')).display==='none',audioState:window.__NESI_DEMO_GAME__.audio.context?.state}));
 assert.ok(report.initial.oldHudHidden);
 if(first===1){assert.equal(report.initial.models,4);assert.equal(report.initial.audioState,'running');}
 for(let index=first-1;index<last;index++){
   if(index>first-1){await clickMenu('#play-again-button');await page.waitForFunction(i=>window.__NESI_DEMO_GAME__?.levelIndex===i&&window.__NESI_DEMO_GAME__.state==='playing',{},index);await shot(`level-${index+1}-start`);}
   const clipRequests=capturePlans[index+1]||[];
   const captured=await page.evaluate(async ({capturePuzzle,clipRequests})=>{
     const g=window.__NESI_DEMO_GAME__,original=g.render,originalVisuals=g.updateVisuals,images=[],clips=[];
     const requests=new Map(clipRequests);
     let active=null;
     g.render=function(){original.call(this);if(this.levelIndex>=5&&this.state==='playing')images.push(this.renderer.domElement.toDataURL('image/png'));};
     window.__NESI_CAPTURE_LEVEL_MARK__=mark=>{
       if(!capturePuzzle||!requests.has(mark.name))return;
       active={name:mark.name,maxFrames:requests.get(mark.name),startElapsed:g.elapsed,step:0,frames:[]};clips.push(active);
     };
     // Sample the same ordinary route at 15 simulation Hz. Markers merely
     // select recording windows; they cannot move the player or camera.
     if(capturePuzzle&&requests.size)g.updateVisuals=function(...args){
       const result=originalVisuals.apply(this,args);
       if(active&&active.frames.length<active.maxFrames&&args[0]>0&&this.state==='playing'&&active.step++%4===0){
         original.call(this);active.frames.push(this.renderer.domElement.toDataURL('image/png'));
       }
       return result;
     };
     try{return {route:await window.__NESI_RUN_LEVEL_ROUTE__(),images,clips,
       width:g.renderer.domElement.width,height:g.renderer.domElement.height};}
     catch(error){return {failure:String(error),images,clips,
       width:g.renderer.domElement.width,height:g.renderer.domElement.height};}
     finally{g.render=original;g.updateVisuals=originalVisuals;delete window.__NESI_CAPTURE_LEVEL_MARK__;}
   },{capturePuzzle,clipRequests});
   captured.images.forEach((image,k)=>fs.writeFileSync(`${out}/level-${index+1}-mechanic-${k+1}.png`,Buffer.from(image.split(',')[1],'base64')));
   if(captured.failure)throw Error(captured.failure);
   if(capturePuzzle&&clipRequests.length){
     assert.deepEqual(captured.clips.map(c=>c.name),clipRequests.map(([name])=>name),`Room ${index+1} must record each agreed physical milestone`);
     for(const clip of captured.clips){
       const directory=`room-${index+1}-`+clip.name.replaceAll(' ','-');fs.mkdirSync(`${out}/${directory}`,{recursive:true});
       assert.ok(clip.frames.length>=24,`Record a readable interval of ${clip.name}`);
       clip.frames.forEach((image,k)=>fs.writeFileSync(`${out}/${directory}/${String(k).padStart(3,'0')}.png`,Buffer.from(image.split(',')[1],'base64')));
       report.puzzleClips.push({level:index+1,name:clip.name,directory,frames:clip.frames.length,simulationFps:15,startElapsed:clip.startElapsed,width:captured.width,height:captured.height,
         method:'Every fourth 60 Hz update within the same ordinary route, selected by observable milestones; standard third-person camera'});
     }
   }
   const result=captured.route;report.routes.push(result);console.log('Browser course',index+1,'passed',result.frames,'frames');assert.ok(result.pass&&result.resets===0&&result.respawns===0);
   assert.equal(await page.$eval('#level-number',e=>e.textContent),String(index+1));
   assert.equal(await page.$('#quick-hint'),null);assert.equal(await page.$('#quick-settings'),null);await shot(`level-${index+1}-complete`);
   // Preserve rooms1–11 art inspection separately. Rooms12–15 use their
   // standard-camera route milestones and sampled movement above.
   if(index<11){
   // Art-only overview: camera changes are explicitly not passage evidence.
   await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__,l=g.firstLevel;g.cameraRig.restoreProjection?.();g.camera.updateProjectionMatrix();
     document.querySelector('#win-screen').style.visibility='hidden';
     const b=l.bounds,cx=(b.minX+b.maxX)/2,cz=(b.minZ+b.maxZ)/2;
     // These two repaired mechanisms need an in-room art view, not the opaque roof.
     if(g.levelIndex===6){g.camera.position.set(-12,4,0);g.camera.lookAt(0,.7,0);}
     else if(g.levelIndex===7){g.camera.position.set(6,9,8);g.camera.lookAt(-1,3,0);}
     else{g.camera.position.set(cx+15,22,cz+23);g.camera.lookAt(cx,2,cz);}
     g.camera.updateMatrixWorld(true);g.render();});
   await shot(`level-${index+1}-overview`);
   await page.$eval('#win-screen',e=>e.style.visibility='');
   }
 }
 const requestedFiles=[...new Set(requests.map(url=>new URL(url).pathname.split('/').at(-1)))].sort();
 assert.deepEqual(requestedFiles,expectedFiles,'Only the union of selected courses may be downloaded');
 assert.equal(requests.length,expectedFiles.length,'cached models must not download twice during the route range');
 const loadedIds=await page.evaluate(()=>[...window.__NESI_DEMO_GAME__.assets.keys()].sort((a,b)=>a-b));
 assert.deepEqual(loadedIds,expectedIds);report.assets={ids:loadedIds,files:requestedFiles,requests:requests.length};
 if(checkUI){
 console.log('Returning to first course',await uiState());
 // A shard can end before the campaign's last room, so its Next button need
 // not wrap. Open the ordinary first-course menu before the shared UI checks.
 await page.goto(startUrl(1),{waitUntil:'networkidle2'});await ready();await page.click('#play-button');
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.levelIndex===0&&window.__NESI_DEMO_GAME__.state==='playing');
 await page.evaluate(()=>document.exitPointerLock?.());await page.waitForFunction(()=>!document.pointerLockElement);
 if(await page.evaluate(()=>window.__NESI_DEMO_GAME__.state==='playing'))await page.keyboard.press('Escape');
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.state==='paused');
 await page.select('#quality-select','low');await page.$eval('#volume-control',e=>{e.value='25';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.click('#mute-toggle');
 await page.click('#hint-button');await page.click('#hint-unlock');await page.waitForFunction(()=>window.__NESI_PREFS__.value.hints[0]===1);await shot('settings');
 report.settings=await page.evaluate(()=>({value:window.__NESI_PREFS__.value,shadows:window.__NESI_DEMO_GAME__.renderer.shadowMap.enabled,
  audio:window.__NESI_DEMO_GAME__.audio.context.state,blocked:window.__NESI_DEMO_GAME__.externalBlocked}));
 assert.equal(report.settings.value.volume,.25);assert.equal(report.settings.value.muted,true);assert.equal(report.settings.shadows,false);assert.equal(report.settings.audio,'suspended');
 // Actual settings selector, not a private level-switch fixture.
 await page.select('#settings-level-select','3');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.levelIndex===3&&window.__NESI_DEMO_GAME__.state==='playing');
 await page.reload({waitUntil:'networkidle2'});await ready();const saved=await page.evaluate(()=>window.__NESI_PREFS__.value);assert.equal(saved.quality,'low');assert.equal(saved.hints[0],1);assert.equal(saved.muted,true);
 report.persistence=true;
 // Ordinary keyboard run, turn, stop/settle and jump. Rendered simulation
 // frames at 30 Hz; this is not a realtime GPU performance measurement.
 await page.setViewport({width:960,height:600});await page.click('#play-button');await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop(null);g.resetRun(true);});
 fs.mkdirSync(`${out}/walk-frames`,{recursive:true});
 const walkSamples=[];
 for(let f=0;f<120;f++){
   if(f===0){await page.keyboard.down('Shift');await page.keyboard.down('w');}
   if(f===22){await page.keyboard.up('w');await page.keyboard.up('Shift');await page.keyboard.down('d');}
   if(f===36)await page.keyboard.up('d');
   if(f===80)await page.keyboard.press('Space');
   const sample=await page.evaluate(()=>{
     const g=window.__NESI_DEMO_GAME__;for(let i=0;i<4;i++)g.updatePlaying(1/120);g.updateVisuals(1/30,1);g.render();
     return {speed:Math.hypot(g.playerVelocity.x,g.playerVelocity.z),grounded:g.playerGrounded,
       forward:g.animator.groundFollow?.forward??0,right:g.animator.groundFollow?.right??0};
   });
   walkSamples.push({frame:f,...sample});
   await page.screenshot({path:`${out}/walk-frames/${String(f).padStart(3,'0')}.png`});
 }
 report.walkFrames=120;report.walkSimulationFps=30;
 report.walkInputWindows=[{name:'run',firstFrame:0,lastFrame:21,keys:['Shift','w']},
   {name:'turn',firstFrame:22,lastFrame:35,keys:['d']},
   {name:'stop and settle',firstFrame:36,lastFrame:79,keys:[]},
   {name:'jump and landing',firstFrame:80,lastFrame:119,pressedAtStart:'Space'}];
 report.walkFollowThrough={maxAbsForward:Math.max(...walkSamples.map(s=>Math.abs(s.forward))),
   maxAbsRight:Math.max(...walkSamples.map(s=>Math.abs(s.right))),samples:walkSamples};
 assert.ok(walkSamples.slice(0,80).every(s=>s.grounded),'Run, turn and stop capture must remain on the arrival floor');
 assert.ok(walkSamples.slice(0,22).some(s=>s.speed>4),'The capture must reach a real sprint through keyboard input');
 assert.ok(walkSamples[79].speed<.01,'The capture must include a completed stop before jumping');
 assert.ok(walkSamples.slice(80).some(s=>!s.grounded),'The keyboard jump must leave the floor');
 // Narrow-screen controls and settings remain inside viewport.
 await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:1});await page.reload({waitUntil:'networkidle2'});await ready();
 await page.click('#play-button');await page.evaluate(()=>document.exitPointerLock?.());await page.waitForFunction(()=>!document.pointerLockElement);if(await page.evaluate(()=>window.__NESI_DEMO_GAME__.state==='playing'))await page.keyboard.press('Escape');await shot('mobile-settings');assert.equal(await page.$eval('#settings-level-select',e=>!!e.getBoundingClientRect().width),true);
 }
 assert.deepEqual(errors,[]);
 assert.equal(report.routes.length,last-first+1);report.pass=true;
 fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));console.log(`Campaign WebGL: courses ${first}–${last}, lazy assets${checkUI?', menus, sound and persistence':''} passed.`);
}catch(error){
 report.failure={error:String(error),state:null};console.error('Browser failure',report.failure);
 // A busy renderer must not turn one timeout into two more long diagnostic waits.
 report.failure.state=await bounded(uiState(),10000).catch(()=>null);
 await bounded(shot('browser-failure'),10000).catch(()=>{});throw error;
}finally{
 fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));
 await bounded(browser.close(),10000).catch(()=>browser.process()?.kill('SIGKILL'));
}
async function bounded(promise,ms){
 let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Diagnostic timeout')),ms);})]);}
 finally{clearTimeout(timer);}
}
