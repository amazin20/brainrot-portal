import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const out=process.env.EVIDENCE_OUT||'smoke-artifacts/velocity';
const framesDir=path.join(out,'frames');fs.mkdirSync(framesDir,{recursive:true});
const base=process.env.PAGE_URL||'http://127.0.0.1:4173/';
const url=new URL(base);url.searchParams.set('mode','velocity');url.searchParams.set('chapter','1');url.searchParams.set('debug','1');
const report={commit:process.env.BUILD_COMMIT||null,pass:false,errors:[],consoleErrors:[],frames:[],screenshots:[],
 scope:'Production WebGL build; native menu, E companion connection, movement, Q and pause inputs, then both chapters through production physics and real coarse-aim projectiles. Chapter 1 video is continuous at 30 simulation frames/second. SwiftShader rendering speed is not device FPS. No video audio track.'};
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,
 protocolTimeout:1200000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
async function verifyMobile(){
 const mobile=await browser.newPage();mobile.setDefaultTimeout(120000);
 await mobile.setViewport({width:390,height:844,deviceScaleFactor:1,isMobile:true,hasTouch:true});
 mobile.on('pageerror',error=>report.errors.push(error.message));
 const mobileURL=new URL(url);mobileURL.searchParams.set('chapter','1');mobileURL.searchParams.delete('return');
 report.mobile={pass:false};
 const screenshot=async name=>{await mobile.screenshot({path:path.join(out,name)});report.screenshots.push(name);};
 try{
  await mobile.goto(mobileURL.href,{waitUntil:'networkidle2'});
  await mobile.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready');
  await mobile.evaluate(()=>{
   const describe=element=>element?element.id||element.className||element.tagName:null;
   window.__VELOCITY_MOBILE_EVENTS__=[];
   window.__VELOCITY_MOBILE_STATE__=()=>{
    const g=window.__NESI_DEMO_GAME__,button=document.querySelector('#velocity-focus'),r=button.getBoundingClientRect();
    return {state:g?.state,externalBlocked:g?.externalBlocked,keys:[...g.input.keys],
     visibility:document.visibilityState,activeElement:describe(document.activeElement),
     pointerLockElement:describe(document.pointerLockElement),externalPause:document.body.dataset.externalPause,
     focus:{x:r.x+r.width/2,y:r.y+r.height/2,left:r.left,right:r.right,top:r.top,bottom:r.bottom,
      hit:describe(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}};
   };
   const record=(event,phase)=>{
    const events=window.__VELOCITY_MOBILE_EVENTS__;if(events.length>=160)return;
    events.push({type:event.type,phase,target:describe(event.target),pointerType:event.pointerType,
     pointerId:event.pointerId,buttons:event.buttons,clientX:event.clientX,clientY:event.clientY,
     touches:event.touches?[...event.touches].map(t=>({identifier:t.identifier,x:t.clientX,y:t.clientY})):undefined,
     defaultPrevented:event.defaultPrevented,time:performance.now(),...window.__VELOCITY_MOBILE_STATE__()});
   };
   for(const type of ['pointerdown','pointerup','pointercancel','gotpointercapture','lostpointercapture','touchstart','touchend','touchcancel']){
    window.addEventListener(type,event=>{record(event,'capture');setTimeout(()=>record(event,'after-dispatch'),0);},true);
   }
  });
  await mobile.$eval('#play-button',button=>button.scrollIntoView({block:'center'}));
  await mobile.click('#play-button');await mobile.waitForFunction(()=>window.__NESI_DEMO_GAME__.state==='playing');
  Object.assign(report.mobile,await mobile.evaluate(()=>{
   const selectors=['#joystick','#velocity-sprint','#velocity-focus','#jump-button','#velocity-pause',
    '.lab-mobile button:nth-child(1)','.lab-mobile button:nth-child(3)'];
   return {coarse:matchMedia('(pointer:coarse)').matches,width:innerWidth,height:innerHeight,
    afterStart:window.__VELOCITY_MOBILE_STATE__(),
    controls:selectors.map(selector=>{const element=document.querySelector(selector),r=element.getBoundingClientRect();
     const x=r.x+r.width/2,y=r.y+r.height/2,top=document.elementFromPoint(x,y);
     return {selector,x,y,left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,
      visible:getComputedStyle(element).display!=='none',hit:element===top||element.contains(top)};})};
  }));
  await screenshot('mobile-start.png');
  assert.equal(report.mobile.coarse,true);assert.equal(report.mobile.controls.length,7);
  assert.equal(report.mobile.afterStart.pointerLockElement,null,'Touch controls must not acquire desktop pointer lock');
  for(const c of report.mobile.controls){assert.ok(c.visible&&c.width>0&&c.height>0&&c.hit,`Mobile control inaccessible: ${c.selector}`);
   assert.ok(c.left>=0&&c.top>=0&&c.right<=390&&c.bottom<=844,`Mobile control outside viewport: ${c.selector}`);}
  for(let i=0;i<report.mobile.controls.length;i++)for(let j=i+1;j<report.mobile.controls.length;j++){
   const a=report.mobile.controls[i],b=report.mobile.controls[j];
   assert.ok(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top,`Overlapping mobile controls: ${a.selector}, ${b.selector}`);
  }
  const friend=report.mobile.controls.find(c=>c.selector==='.lab-mobile button:nth-child(3)');
  await mobile.touchscreen.tap(friend.x,friend.y);await mobile.waitForFunction(()=>window.__NESI_DEMO_GAME__.velocityCompanion.connected);
  report.mobile.beforeFocus=await mobile.evaluate(()=>window.__VELOCITY_MOBILE_STATE__());
  await screenshot('mobile.png');
  const focus=report.mobile.beforeFocus.focus;
  await mobile.touchscreen.touchStart(focus.x,focus.y);
  await mobile.waitForFunction(()=>window.__NESI_DEMO_GAME__.input.keys.has('KeyQ'),{timeout:10000});
  report.mobile.duringFocus=await mobile.evaluate(()=>window.__VELOCITY_MOBILE_STATE__());
  await mobile.touchscreen.touchEnd();
  await mobile.waitForFunction(()=>!window.__NESI_DEMO_GAME__.input.keys.has('KeyQ'),{timeout:10000});
  report.mobile.afterRelease=await mobile.evaluate(()=>window.__VELOCITY_MOBILE_STATE__());
  assert.equal(report.mobile.duringFocus.state,'playing');assert.equal(report.mobile.duringFocus.pointerLockElement,null);
  assert.deepEqual(report.errors,[]);report.mobile.pass=true;
 }catch(error){
  report.mobile.error=error.stack;
  await screenshot('mobile-failure.png').catch(()=>{});throw error;
 }finally{
  report.mobile.events=await mobile.evaluate(()=>window.__VELOCITY_MOBILE_EVENTS__||[]).catch(()=>[]);
  report.mobile.final=await mobile.evaluate(()=>window.__VELOCITY_MOBILE_STATE__?.()).catch(()=>null);
  await mobile.touchscreen.touchEnd().catch(()=>{});await mobile.close();
 }
}
let page;
try{
 // Run native touch checks before the expensive continuous WebGL recording.
 await verifyMobile();
 page=await browser.newPage();page.setDefaultTimeout(120000);await page.setViewport({width:1280,height:720,deviceScaleFactor:1});
 page.on('pageerror',error=>report.errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push(message.text());});
 await page.goto(url.href,{waitUntil:'networkidle2'});
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready');
 const menu=await page.evaluate(()=>({mode:document.body.dataset.gameMode,title:document.title,
  campaignCount:document.querySelector('#level-select').options.length,
  arena:window.__NESI_DEMO_GAME__.firstLevel.id,chapter:window.__NESI_DEMO_GAME__.velocityChapter,
  segments:window.__NESI_DEMO_GAME__.firstLevel.segments.length,missing:window.__NESI_DEMO_GAME__.failures,
  campaignCompleted:[...window.__NESI_PREFS__.value.completed],
  hook:typeof window.__NESI_RUN_VELOCITY_ROUTE__}));
 assert.equal(menu.mode,'velocity');assert.equal(menu.chapter,1);assert.equal(menu.segments,3);assert.equal(menu.campaignCount,21);
 assert.deepEqual(menu.missing,[]);assert.equal(menu.hook,'function');report.menu=menu;
 await page.screenshot({path:path.join(out,'menu.png')});report.screenshots.push('menu.png');
 await page.click('#play-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='playing');
 await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;g.renderer.setPixelRatio(1);g.renderer.setSize(1280,720);});
 await page.keyboard.press('e');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.velocityCompanion.connected);
 report.nativeCompanion=await page.evaluate(()=>({connected:window.__NESI_DEMO_GAME__.velocityCompanion.connected,handsFree:!window.__NESI_DEMO_GAME__.heldCube}));
 assert.equal(report.nativeCompanion.handsFree,true);
 const initialPosition=await page.evaluate(()=>window.__NESI_DEMO_GAME__.playerPosition.toArray());
 await page.keyboard.down('Shift');await page.keyboard.down('w');
 await page.waitForFunction(p=>{const g=window.__NESI_DEMO_GAME__;return Math.hypot(g.playerPosition.x-p[0],g.playerPosition.z-p[2])>.2;},{timeout:15000},initialPosition);
 await page.keyboard.up('w');await page.keyboard.up('Shift');
 report.nativeMovement=await page.evaluate(()=>({z:window.__NESI_DEMO_GAME__.playerPosition.z,speed:window.__NESI_DEMO_GAME__.playerVelocity.length()}));
 await page.keyboard.down('q');await page.keyboard.press('Escape');await page.keyboard.up('q');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.state==='paused');
 report.pause=await page.evaluate(()=>({visible:document.querySelector('#pause-screen').classList.contains('screen--active'),
  keys:window.__NESI_DEMO_GAME__.input.keys.size,focus:window.__NESI_DEMO_GAME__.velocityFocus,
  timeScale:window.__NESI_DEMO_GAME__.getVelocityTimeScale(),position:window.__NESI_DEMO_GAME__.playerPosition.toArray()}));
 assert.equal(report.pause.visible,true);assert.equal(report.pause.keys,0);assert.equal(report.pause.focus,false);assert.equal(report.pause.timeScale,1);
 await page.click('#resume-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.state==='playing');
 await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop(null);g.resetRun(true);g.updateVisuals(1/60,1);g.render();});
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('#pause-screen')).opacity==='0');
 const velocityUi=await page.evaluate(()=>({levelHidden:document.querySelector('#level-number').hidden,
  tutorialHidden:getComputedStyle(document.querySelector('.lab-tutorial')).display==='none',
  levelMenuHidden:document.querySelector('#level-menu-button').hidden}));
 assert.ok(velocityUi.levelHidden&&velocityUi.tutorialHidden&&velocityUi.levelMenuHidden);report.velocityUi=velocityUi;
 await page.screenshot({path:path.join(out,'start.png')});report.screenshots.push('start.png');

 const crossings=new Set();
 await page.exposeFunction('__NESI_WRITE_VELOCITY_FRAME__',async data=>{
  const index=report.frames.length,filename=`${String(index).padStart(5,'0')}.jpg`;
  fs.writeFileSync(path.join(framesDir,filename),Buffer.from(data.image.split(',')[1],'base64'));
  report.frames.push({index,time:data.time,position:data.position,speed:data.speed,teleports:data.teleports,
   stage:data.stage,fov:data.fov,drawCalls:data.drawCalls});
  if([1,2].includes(data.teleports)&&!crossings.has(data.teleports)){
   assert.equal(data.hudStage,data.stageName,'The current flight instruction must update on the crossing frame');
   crossings.add(data.teleports);const file=`crossing-${data.teleports}.png`;
   await page.screenshot({path:path.join(out,file)});report.screenshots.push(file);
  }
 });
 const data=await page.evaluate(async()=>{
  const g=window.__NESI_DEMO_GAME__,output=document.createElement('canvas');
  output.width=1280;output.height=720;const ctx=output.getContext('2d',{alpha:false});
  let nextCapture=0;
  window.__NESI_CAPTURE_VELOCITY_FRAME__=async sample=>{
   const time=sample.time;if(time+1e-6<nextCapture)return;nextCapture=time+1/30;
   g.render();ctx.drawImage(g.renderer.domElement,0,0,1280,720);
   const motion=g.epicDirector?.canvas;if(motion&&motion.style.display!=='none')ctx.drawImage(motion,0,0,1280,720);
   await window.__NESI_WRITE_VELOCITY_FRAME__({image:output.toDataURL('image/jpeg',.88),time,
    position:g.playerPosition.toArray(),speed:g.playerVelocity.length(),teleports:g.teleportCount,
    stage:g.velocityRun?.stage,stageName:g.firstLevel.getGuidance().title,hudStage:document.querySelector('#velocity-stage').textContent,
    fov:g.camera.fov,drawCalls:g.renderer.info.render.calls});
  };
  try{
   const route=await window.__NESI_RUN_VELOCITY_ROUTE__({renderFps:30});
   return {route,state:g.state,run:{...g.velocityRun},diagnostics:g.diagnostics(),
    completed:window.__NESI_PREFS__.value.completed,contextLost:g.renderer.getContext().isContextLost()};
  }finally{delete window.__NESI_CAPTURE_VELOCITY_FRAME__;}
 });
 report.route=data.route;report.run=data.run;report.finalState=data.state;report.contextLost=data.contextLost;
 report.renderInfo={models:data.diagnostics.modelsLoaded,missing:data.diagnostics.missingModels};
 await page.screenshot({path:path.join(out,'complete.png')});report.screenshots.push('complete.png');
 assert.equal(data.state,'won');assert.equal(data.run.finished,true);
 assert.equal(data.route.teleports,3);assert.equal(data.route.requests.length,3);assert.ok(data.run.peakSpeed>=25);
 assert.equal(data.route.companionFinishedTogether,true);assert.deepEqual(data.completed,menu.campaignCompleted);
 assert.equal(data.contextLost,false);assert.deepEqual(report.errors,[]);
 assert.ok(!report.consoleErrors.some(message=>/THREE\.WebGLProgram|GL_INVALID|shader error/i.test(message)),JSON.stringify(report.consoleErrors));
 assert.ok(report.frames.length>60,'A continuous route recording is required');
 assert.equal(crossings.size,2);assert.ok(report.frames.every(frame=>Number.isFinite(frame.speed)&&frame.position.every(Number.isFinite)));
 for(let i=1;i<report.frames.length;i++)assert.ok(Math.abs(report.frames[i].time-report.frames[i-1].time-1/30)<.002,'Video frames must represent consecutive 30 Hz simulation samples');
 const movie=path.join(out,'velocity-run.mp4');
 execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','30','-i',path.join(framesDir,'%05d.jpg'),
  '-c:v','libx264','-preset','fast','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',movie]);
 report.video={file:'velocity-run.mp4',fps:30,width:1280,height:720,frames:report.frames.length,
  duration:report.frames.length/30,audio:false,sha256:crypto.createHash('sha256').update(fs.readFileSync(movie)).digest('hex')};
 // The second chapter exercises its own geometry and fourth flight. Only
 // chapter 1 is recorded as a continuous video.
 url.searchParams.set('chapter','2');url.searchParams.set('return','21');
 await page.goto(url.href,{waitUntil:'networkidle2'});
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready');
 report.chapter2=await page.evaluate(async()=>{
  const g=window.__NESI_DEMO_GAME__,route=await window.__NESI_RUN_VELOCITY_ROUTE__({renderFps:30});
  return {route,state:g.state,contextLost:g.renderer.getContext().isContextLost(),
   campaignCompleted:[...window.__NESI_PREFS__.value.completed],
   completedChapters:JSON.parse(localStorage.getItem('brainrot-portal.velocity-chapters.v1')).completed,
   continueLabel:document.querySelector('#play-again-button').textContent};
 });
 assert.equal(report.chapter2.route.teleports,4);assert.equal(report.chapter2.route.companionFinishedTogether,true);
 assert.equal(report.chapter2.state,'won');assert.equal(report.chapter2.contextLost,false);
 assert.deepEqual(report.chapter2.campaignCompleted,menu.campaignCompleted);
 assert.deepEqual(report.chapter2.completedChapters.sort(),['velocity-cascade-v1','velocity-flow-v1']);
 assert.match(report.chapter2.continueLabel,/21/);
 await page.screenshot({path:path.join(out,'chapter-2-complete.png')});report.screenshots.push('chapter-2-complete.png');

 assert.deepEqual(report.errors,[]);
 report.pass=true;
}catch(error){report.error=error.stack;throw error;}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
