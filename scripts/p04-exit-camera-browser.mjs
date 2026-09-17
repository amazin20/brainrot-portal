import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import puppeteer from 'puppeteer-core';
const tag=process.env.P04_TAG??'after',out=process.env.EVIDENCE_OUT??'smoke-artifacts/p04';
assert.match(tag,/^(before|after)$/);fs.mkdirSync(out,{recursive:true});
const report={tag,commit:process.env.SOURCE_COMMIT??process.env.BUILD_COMMIT??null,pass:false,errors:[],
 scope:'Ordinary complete room21 route. Unmodified game camera, all room geometry present. Clips contain native consecutive 30 Hz samples of 60 Hz display/120 Hz physics. Known solution, not a human playtest or device benchmark.',
 audio:false,width:1280,height:720,encodedFps:30,physicsHz:120,displayHz:60};
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',headless:true,
 protocolTimeout:1200000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage();await page.setViewport({width:1280,height:720});page.setDefaultTimeout(120000);
 page.on('pageerror',e=>report.errors.push(e.message));
 const url=new URL(process.env.PAGE_URL??'http://127.0.0.1:4173/');
 url.searchParams.set('level','21');url.searchParams.set('debug','1');url.searchParams.set('smoke','1');
 await page.goto(url.href,{waitUntil:'networkidle2'});
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='playing');
 await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop(null);g.renderer.setPixelRatio(1);g.renderer.setSize(1280,720);});
 const capture=await page.evaluate(async tag=>{
  const g=window.__NESI_DEMO_GAME__,update=g.updateVisuals,V=g.playerPosition.constructor,point=new V();
  const samples=[],clips=[],inputs=[];let frame=0,previous=0,active=null;
  const label=document.createElement('div');label.style.cssText='position:fixed;left:16px;top:16px;padding:8px 12px;background:#152d39e8;color:white;font:16px system-ui;z-index:999;pointer-events:none';
  document.body.append(label);
  // Diagnostic source measurement only: no pose, material or camera changes.
  function skin(){
   let retained=0,outside=0,portalClipped=0;const min=[Infinity,Infinity],max=[-Infinity,-Infinity];
   g.playerGroup.traverse(m=>{
    if(!m.isMesh)return;for(let n=m;n;n=n.parent)if(!n.visible)return;
    if(m.isSkinnedMesh)m.skeleton.update();const mat=Array.isArray(m.material)?m.material[0]:m.material;
    if(!mat.visible)return;const planes=[...g.cameraRig.mainClippingPlanes,...(mat.clippingPlanes||[])];
    for(let i=0;i<m.geometry.attributes.position.count;i++){
     m.getVertexPosition(i,point).applyMatrix4(m.matrixWorld);
     if(planes.some(p=>p.distanceToPoint(point)<0)){portalClipped++;continue;}
     retained++;point.project(g.camera);
     min[0]=Math.min(min[0],point.x);min[1]=Math.min(min[1],point.y);max[0]=Math.max(max[0],point.x);max[1]=Math.max(max[1],point.y);
     if(Math.abs(point.x)>1||Math.abs(point.y)>1||point.z < -1||point.z>1)outside++;
    }
   });return {retained,outside,portalClipped,min,max};
  }
  g.updateVisuals=function(...args){
   update.apply(this,args);frame++;
   const event=g.teleportCount;
   const v=g.input.getMove();inputs.push([frame,g.yaw,g.pitch,v.x,v.y,!!g.heldCube]);
   if(!active && g.playerVelocity.y < -12 && (event===2||event===3&&g.heldCube)){
    const id=event+1;if(!clips.some(c=>c.event===id)){active={event:id,startFrame:frame,crossFrame:null,frames:[],ticks:[]};clips.push(active);}
   }
   if(event!==previous){
    if(event>=3&&event<=4){if(!active){active={event,startFrame:frame,crossFrame:null,frames:[],ticks:[]};clips.push(active);}active.crossFrame=frame;}
    previous=event;
   }
   if(!active)return;
   if(active.crossFrame!==null&&frame-active.crossFrame>=120){active=null;return;}
   g.scene.updateMatrixWorld(true);g.portalActors.update();
   const rig=g.cameraRig,swept=g.camera.position.clone();rig.constrain(rig.playerPivot,swept);
   const after=active.crossFrame===null?null:(frame-active.crossFrame)/60;
   const sample={frame,event:active.event,after,held:!!g.heldCube,player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),
    camera:g.camera.position.toArray(),orientation:g.camera.quaternion.toArray(),fov:g.camera.fov,boom:rig.distance,
    clipping:rig.mainClippingPlanes.map(p=>[...p.normal.toArray(),p.constant]),sweepError:swept.distanceTo(g.camera.position),skin:skin()};
   samples.push(sample);
   if((frame-active.startFrame)%2===0){
    label.textContent=`${tag==='before'?'ДО':'ПОСЛЕ'} · ${active.event===3?'Вылет без спутника':'Совместный вылет'} · обычная камера · без звука`;
    g.render();active.frames.push(g.renderer.domElement.toDataURL('image/jpeg',.9));active.ticks.push(frame);
   }
  };
  try{return {route:await window.__NESI_RUN_LEVEL_ROUTE__(),samples,clips,inputs};}
  catch(e){return{failure:String(e),samples,clips,inputs};}
  finally{g.updateVisuals=update;label.remove();}
 },tag);
 if(capture.failure)throw Error(capture.failure);
 report.route=capture.route;report.samples=capture.samples;
 report.inputDigest=createHash('sha256').update(JSON.stringify(capture.inputs)).digest('hex');
 report.summary=[3,4].map(event=>{
  const a=capture.samples.filter(s=>s.event===event&&s.after!==null),early=a.filter(s=>s.after<.4);
  return{event,held:a[0]?.held,earlyFrames:early.length,earlyLost:early.filter(s=>s.skin.outside>0).length,
   earlyMaxOutsideFraction:Math.max(...early.map(s=>s.skin.outside/Math.max(1,s.skin.retained))),
   earlyMinRetained:Math.min(...early.map(s=>s.skin.retained)),
   laterLost:a.filter(s=>s.after>=.4&&s.skin.outside>0).length,
   unsafeFrames:a.filter(s=>s.sweepError>1e-7).length};
 });
 report.clips=[];
 for(const clip of capture.clips){
  assert.ok(clip.crossFrame!==null&&clip.frames.length>=60,'Entire exit-lens window must be recorded');
  assert.ok(clip.ticks.every((t,i)=>!i||t-clip.ticks[i-1]===2),'Gap in native frame sequence');
  const dir=path.join(out,`${tag}-frames-${clip.event}`);fs.mkdirSync(dir,{recursive:true});
  clip.frames.forEach((data,i)=>fs.writeFileSync(path.join(dir,`${String(i).padStart(6,'0')}.jpg`),Buffer.from(data.split(',')[1],'base64')));
  const movie=path.join(out,`${tag}-exit-${clip.event}.mp4`);
  execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','30','-i',path.join(dir,'%06d.jpg'),'-c:v','libx264','-preset','fast','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',movie]);
  report.clips.push({event:clip.event,frames:clip.frames.length,seconds:clip.frames.length/30,ticks:clip.ticks,
   file:path.basename(movie),sha256:createHash('sha256').update(fs.readFileSync(movie)).digest('hex')});
  for(const offset of [0,4,12,24,36]){
   const i=clip.ticks.reduce((best,t,k)=>Math.abs(t-(clip.crossFrame+offset))<Math.abs(clip.ticks[best]-(clip.crossFrame+offset))?k:best,0);
   fs.copyFileSync(path.join(dir,`${String(i).padStart(6,'0')}.jpg`),path.join(out,`${tag}-event${clip.event}-tick${offset}.jpg`));
  }
 }
 assert.ok(report.route.pass&&report.route.resets===0&&report.route.respawns===0);
 assert.deepEqual(report.errors,[]);
 if(tag==='after')for(const s of report.summary){
  assert.equal(s.earlyFrames,24);assert.equal(s.earlyLost,0,JSON.stringify(s));assert.ok(s.earlyMinRetained>500);assert.equal(s.unsafeFrames,0);
 }
 report.pass=true;
}catch(error){report.failure=error.stack;throw error;}
finally{fs.writeFileSync(path.join(out,`${tag}-report.json`),JSON.stringify(report,null,2));await browser.close();}
