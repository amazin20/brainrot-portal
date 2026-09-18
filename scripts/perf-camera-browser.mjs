import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import puppeteer from 'puppeteer-core';

const tag=process.env.PERF_TAG||'after',out=process.env.EVIDENCE_OUT||'smoke-artifacts/perf-browser';
assert.match(tag,/^(before|after)$/);fs.mkdirSync(out,{recursive:true});
const report={tag,source:process.env.SOURCE_COMMIT||null,pass:false,errors:[],
 scope:'Chromium/SwiftShader CPU profiling on the complete ordinary room21 route. Low graphics identical in both runs. NOT real-device FPS or GPU acceptance.',
 video:{width:1280,height:720,encodedFps:30,displayHz:60,physicsHz:120,audio:false,
 note:'Native successive frames from the joint-exit window; fixed simulation, not device frame-rate evidence.'}};
const stats=a=>{const s=[...a].sort((x,y)=>x-y);return{count:s.length,median:s[Math.floor(s.length*.5)]??0,p95:s[Math.floor(s.length*.95)]??0,max:s.at(-1)??0,total:s.reduce((a,b)=>a+b,0)};};
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,protocolTimeout:900000,
 args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage();await page.setViewport({width:1280,height:720});page.setDefaultTimeout(120000);
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.evaluateOnNewDocument(()=>localStorage.setItem('brainrot-portal.preferences.v24',JSON.stringify({quality:'low',muted:true,tutorial:true})));
 await page.goto(new URL('?level=21&debug=1&smoke=1',process.env.PAGE_URL||'http://127.0.0.1:4173/').href,{waitUntil:'networkidle2'});
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='playing');
 await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop(null);g.renderer.setPixelRatio(1);g.renderer.setSize(1280,720);g.render();});
 report.browser=await browser.version();await page.screenshot({path:path.join(out,`${tag}-start.png`)});
 const data=await page.evaluate(async()=>{
  const g=window.__NESI_DEMO_GAME__,rig=g.cameraRig,update=rig.update,intersect=rig.raycaster.intersectObjects,visual=g.updateVisuals;
  const samples=[],trace=[],frames=[];let cameraTime=0,rays=0,roots=0,tick=0,exitTick=null;
  rig.update=function(...a){const t=performance.now();try{return update.apply(this,a);}finally{cameraTime+=performance.now()-t;}};
  rig.raycaster.intersectObjects=function(objects,...a){rays++;roots+=objects.length;return intersect.call(this,objects,...a);};
  g.updateVisuals=function(...a){
   cameraTime=rays=roots=0;const t=performance.now(),result=visual.apply(this,a),elapsed=performance.now()-t;
   samples.push({tick,camera:cameraTime,visual:elapsed,rays,roots,avoid:rig.avoidanceActive});
   trace.push([...g.playerPosition,...g.playerVelocity,...g.cargo.position,...g.camera.position,...g.camera.quaternion,g.camera.fov,g.teleportCount,g.state,!!g.heldCube]);
   if(g.teleportCount===4&&exitTick===null)exitTick=tick;
   if(exitTick!==null&&tick-exitTick<120&&(tick-exitTick)%2===0){
    g.render();frames.push({tick,relativeTick:tick-exitTick,image:g.renderer.domElement.toDataURL('image/jpeg',.9),
     render:{...g.renderer.info.render},memory:{...g.renderer.info.memory}});
   }
   tick++;return result;
  };
  try{return{route:await window.__NESI_RUN_LEVEL_ROUTE__(),samples,trace,frames,quality:g.quality,blockers:rig.blockers.length};}
  finally{rig.update=update;rig.raycaster.intersectObjects=intersect;g.updateVisuals=visual;}
 });
 assert.ok(data.route.pass);assert.equal(data.route.resets+data.route.respawns,0);
 report.route=data.route;report.quality=data.quality;report.blockers=data.blockers;
 report.traceDigest=crypto.createHash('sha256').update(JSON.stringify(data.trace)).digest('hex');
 report.samples=data.samples;const warm=data.samples.slice(120);
 report.cameraMs=stats(warm.map(s=>s.camera));report.avoidingCameraMs=stats(warm.filter(s=>s.avoid).map(s=>s.camera));
 report.visualCpuMs=stats(warm.map(s=>s.visual));report.rootVisits=stats(warm.map(s=>s.roots));
 const dir=path.join(out,`${tag}-frames`);fs.mkdirSync(dir,{recursive:true});
 assert.equal(data.frames.length,60);assert.ok(data.frames.every((f,i)=>f.relativeTick===i*2));
 report.frames=data.frames.map(({image,...s})=>({...s,pixelHash:crypto.createHash('sha256').update(Buffer.from(image.split(',')[1],'base64')).digest('hex')}));
 data.frames.forEach((f,i)=>fs.writeFileSync(path.join(dir,`${String(i).padStart(5,'0')}.jpg`),Buffer.from(f.image.split(',')[1],'base64')));
 fs.copyFileSync(path.join(dir,'00018.jpg'),path.join(out,`${tag}-joint-exit.jpg`));
 execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','30','-i',path.join(dir,'%05d.jpg'),'-c:v','libx264','-preset','fast','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',path.join(out,`${tag}-joint-exit.mp4`)]);
 assert.deepEqual(report.errors,[]);report.pass=true;
} catch(error){report.failure=error.stack;throw error;}
finally{fs.writeFileSync(path.join(out,`${tag}.json`),JSON.stringify(report,null,2));await browser.close();}
