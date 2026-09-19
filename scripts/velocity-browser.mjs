import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const out=process.env.EVIDENCE_OUT||'smoke-artifacts/velocity';
const framesDir=path.join(out,'frames');fs.mkdirSync(framesDir,{recursive:true});
const base=process.env.PAGE_URL||'http://127.0.0.1:4173/';
const url=new URL(base);url.searchParams.set('mode','velocity');url.searchParams.set('debug','1');
const report={commit:process.env.BUILD_COMMIT||null,pass:false,errors:[],consoleErrors:[],frames:[],screenshots:[],
 scope:'Production WebGL build; native menu, movement and pause inputs, then an automated route using production physics and timed projectile placement. Video is rendered at 30 simulation frames/second, without time ramps. SwiftShader rendering speed is not device FPS. No video audio track.'};
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,
 protocolTimeout:1200000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
let page;
try{
 page=await browser.newPage();page.setDefaultTimeout(120000);await page.setViewport({width:1280,height:720,deviceScaleFactor:1});
 page.on('pageerror',error=>report.errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push(message.text());});
 await page.goto(url.href,{waitUntil:'networkidle2'});
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready');
 const menu=await page.evaluate(()=>({mode:document.body.dataset.gameMode,title:document.title,
  campaignCount:document.querySelector('#level-select').options.length,
  arena:window.__NESI_DEMO_GAME__.firstLevel.id,missing:window.__NESI_DEMO_GAME__.failures,
  hook:typeof window.__NESI_RUN_VELOCITY_ROUTE__}));
 assert.equal(menu.mode,'velocity');assert.equal(menu.arena,'velocity-relay');assert.equal(menu.campaignCount,21);
 assert.deepEqual(menu.missing,[]);assert.equal(menu.hook,'function');report.menu=menu;
 await page.screenshot({path:path.join(out,'menu.png')});report.screenshots.push('menu.png');
 await page.click('#play-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='playing');
 await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;g.renderer.setPixelRatio(1);g.renderer.setSize(1280,720);});
 const initialZ=await page.evaluate(()=>window.__NESI_DEMO_GAME__.playerPosition.z);
 await page.keyboard.down('Shift');await page.keyboard.down('w');
 await page.waitForFunction(z=>window.__NESI_DEMO_GAME__.playerPosition.z<z-.2,{timeout:15000},initialZ);
 await page.keyboard.up('w');await page.keyboard.up('Shift');
 report.nativeMovement=await page.evaluate(()=>({z:window.__NESI_DEMO_GAME__.playerPosition.z,speed:window.__NESI_DEMO_GAME__.playerVelocity.length()}));
 await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.state==='paused');
 report.pause=await page.evaluate(()=>({visible:document.querySelector('#pause-screen').classList.contains('screen--active'),
  keys:window.__NESI_DEMO_GAME__.input.keys.size,position:window.__NESI_DEMO_GAME__.playerPosition.toArray()}));
 assert.equal(report.pause.visible,true);assert.equal(report.pause.keys,0);
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
  window.__NESI_CAPTURE_VELOCITY_FRAME__=async()=>{
   const time=g.elapsed/1000;if(time+1e-6<nextCapture)return;nextCapture=time+1/30;
   g.render();ctx.drawImage(g.renderer.domElement,0,0,1280,720);
   const motion=g.epicDirector?.canvas;if(motion&&motion.style.display!=='none')ctx.drawImage(motion,0,0,1280,720);
   await window.__NESI_WRITE_VELOCITY_FRAME__({image:output.toDataURL('image/jpeg',.88),time,
    position:g.playerPosition.toArray(),speed:g.playerVelocity.length(),teleports:g.teleportCount,
    stage:g.velocityRun?.stage,stageName:g.velocityRun?.name,hudStage:document.querySelector('#velocity-stage').textContent,
    fov:g.camera.fov,drawCalls:g.renderer.info.render.calls});
  };
  try{
   const route=await window.__NESI_RUN_VELOCITY_ROUTE__();
   return {route,state:g.state,run:{...g.velocityRun},diagnostics:g.diagnostics(),
    completed:window.__NESI_PREFS__.value.completed,contextLost:g.renderer.getContext().isContextLost()};
  }finally{delete window.__NESI_CAPTURE_VELOCITY_FRAME__;}
 });
 report.route=data.route;report.run=data.run;report.finalState=data.state;report.contextLost=data.contextLost;
 report.renderInfo={models:data.diagnostics.modelsLoaded,missing:data.diagnostics.missingModels};
 await page.screenshot({path:path.join(out,'complete.png')});report.screenshots.push('complete.png');
 assert.equal(data.state,'won');assert.equal(data.run.finished,true);assert.equal(data.run.validRoute,true);
 assert.ok(data.run.chain>=3);assert.ok(data.run.airborneShots>=4);assert.ok(data.run.peakSpeed>=25);
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
 report.pass=true;
}catch(error){report.error=error.stack;throw error;}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
