import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import puppeteer from 'puppeteer-core';

const root=process.env.PAGE_URL||'http://127.0.0.1:4173/';
const out=process.env.EVIDENCE_OUT||'smoke-artifacts/p02';fs.mkdirSync(out,{recursive:true});
const report={commit:process.env.GITHUB_SHA||null,pass:false,errors:[],
 scope:'Actual full brake-first route, with a separate inspection camera for two load-link excerpts. Route camera, inputs, objects and physics remain unchanged. Excerpts are NOT a full playthrough or a hardware FPS measurement.',
 video:{width:1280,height:720,encodedFps:30,physicsHz:120,audio:false,inspectionCamera:true}};
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,
 protocolTimeout:900000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage();await page.setViewport({width:1280,height:720});page.setDefaultTimeout(120000);
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(new URL('?level=21&debug=1&smoke=1',root).href,{waitUntil:'networkidle2'});
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='playing'||document.documentElement.dataset.runtimeState==='error');
 assert.equal(await page.$eval('#error-detail',e=>e.textContent),'');
 await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop(null);g.renderer.setPixelRatio(1);g.renderer.setSize(1280,720);g.render();});
 await page.screenshot({path:path.join(out,'normal-start.png')});
 const result=await page.evaluate(async()=>{
  const g=window.__NESI_DEMO_GAME__,link=g.firstLevel.state.loadLink;
  if(!link)throw Error('No P02 load link in this build');
  const visual=g.updateVisuals,render=g.render,ring=[],clips=[],milestones=[];
  const observer=new g.camera.constructor(43,16/9,.1,130);
  observer.position.set(1.7,16.5,24);observer.lookAt(-.5,11.9,2.7);
  let tick=0,lastLoad=false,active=null;
  const inspect=()=>{
   const original=g.camera,portalCamera=g.portals.camera;
   try{g.camera=observer;g.portals.camera=observer;render.call(g);
    return {image:g.renderer.domElement.toDataURL('image/jpeg',.87),elapsed:g.elapsed,load:link.loaded,
     indication:link.value,brake:g.firstLevel.cassette.braked,height:g.firstLevel.cassette.height,
     player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),calls:g.renderer.info.render.calls};
   }finally{g.camera=original;g.portals.camera=portalCamera;}
  };
  g.updateVisuals=function(...args){
   const value=visual.apply(this,args);
   if(args[0]>0&&g.state==='playing'&&tick++%2===0){
    const load=link.loaded;
    if(!active&&load!==lastLoad&&clips.length<2){active={kind:load?'load':'unload',frames:[...ring],remaining:110};clips.push(active);}
    lastLoad=load;
    // Only retain image frames around two actual contact transitions.
    const frame=inspect();ring.push(frame);if(ring.length>30)ring.shift();
    if(active){active.frames.push(frame);if(--active.remaining===0)active=null;}
   }
   return value;
  };
  window.__NESI_CAPTURE_LEVEL_MARK__=m=>{
   if(/weight holds|recovered;|both on upper/.test(m.name)){
    render.call(g);milestones.push({name:m.name,image:g.renderer.domElement.toDataURL('image/png'),load:link.loaded,value:link.value});
   }
  };
  try{
   const route=await window.__NESI_RUN_LEVEL_ROUTE__({order:'brake-first'});
   return {route,clips,milestones,observer:{position:observer.position.toArray(),quaternion:observer.quaternion.toArray()}};
  }finally{g.updateVisuals=visual;delete window.__NESI_CAPTURE_LEVEL_MARK__;render.call(g);}
 });
 report.route=result.route;report.observer=result.observer;
 assert.ok(result.route.pass);assert.equal(result.route.resets,0);assert.equal(result.route.respawns,0);
 assert.deepEqual(result.clips.map(c=>c.kind),['load','unload']);
 const framesDir=path.join(out,'frames');fs.mkdirSync(framesDir,{recursive:true});let frameIndex=0;
 report.clips=[];
 for(const clip of result.clips){
  assert.equal(clip.remaining,0,'Incomplete visual window');
  assert.ok(clip.frames.length>=120);
  const last=clip.frames.at(-1);assert.equal(last.load,clip.kind==='load');
  assert.ok(clip.kind==='load'?last.indication>.999:last.indication<.001);
  report.clips.push({kind:clip.kind,frames:clip.frames.length,first:clip.frames[0].elapsed,last:last.elapsed,
   samples:clip.frames.map(({image,...sample})=>sample)});
  for(const frame of clip.frames)fs.writeFileSync(path.join(framesDir,String(frameIndex++).padStart(6,'0')+'.jpg'),Buffer.from(frame.image.split(',')[1],'base64'));
  fs.writeFileSync(path.join(out,clip.kind+'-detail.jpg'),Buffer.from(clip.frames.at(-1).image.split(',')[1],'base64'));
 }
 result.milestones.forEach((f,i)=>fs.writeFileSync(path.join(out,`normal-${i}.png`),Buffer.from(f.image.split(',')[1],'base64')));
 await page.screenshot({path:path.join(out,'normal-complete.png')});
 assert.deepEqual(report.errors,[]);
 const movie=path.join(out,'load-link.mp4');
 execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','30','-i',path.join(framesDir,'%06d.jpg'),'-c:v','libx264','-preset','fast','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',movie]);
 report.video.frames=frameIndex;report.video.seconds=frameIndex/30;
 report.video.sha256=crypto.createHash('sha256').update(fs.readFileSync(movie)).digest('hex');report.pass=true;
}catch(error){report.failure=error.stack;throw error;}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
