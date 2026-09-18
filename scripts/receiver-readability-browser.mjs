import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import puppeteer from 'puppeteer-core';
const tag=process.env.RECEIVER_TAG||'after',out=process.env.EVIDENCE_OUT||'smoke-artifacts/receiver';
const root=process.env.PAGE_URL||'http://127.0.0.1:4173/';fs.mkdirSync(out,{recursive:true});
const report={source:process.env.SOURCE_COMMIT||null,tag,pass:false,errors:[],
 scope:'Production WebGL / low quality. Normal camera approach before delivery; ordinary full brake-first route. Detail clips use a labelled inspection camera, never alter route inputs/actors. Not hardware FPS.',
 video:{width:1280,height:720,fps:30,audio:false,inspectionCamera:true}};
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,protocolTimeout:900000,
 args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage();await page.setViewport({width:1280,height:720});page.setDefaultTimeout(120000);
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.evaluateOnNewDocument(()=>localStorage.setItem('brainrot-portal.preferences.v24',JSON.stringify({quality:'low',muted:true,tutorial:true})));
 await page.goto(new URL('?level=21&debug=1&smoke=1',root).href,{waitUntil:'networkidle2'});
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='playing');
 await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop(null);g.renderer.setPixelRatio(1);g.renderer.setSize(1280,720);g.render();});
 await page.screenshot({path:path.join(out,`${tag}-start.png`)});
 // Ordinary walking and yaw/pitch only: no coordinate assignment to actors/lens.
 report.observation=await page.evaluate(()=>{
  const g=window.__NESI_DEMO_GAME__,V=g.playerPosition.constructor,Vec2=g.input.getMove().constructor;
  const saved=g.input.getMove,move=new Vec2();g.input.getMove=()=>move.clone();
  const frame=()=>{g.updatePlaying(1/120);g.updatePlaying(1/120);g.updateVisuals(1/60,1);};
  try{
   for(let i=0;i<1100;i++){
    const delta=new V(0,0,7.85).sub(g.playerPosition);delta.y=0;if(delta.length()<.11)break;
    delta.normalize().multiplyScalar(Math.min(1,Math.hypot(g.playerPosition.x,g.playerPosition.z-7.85)*1.5)).applyAxisAngle(new V(0,1,0),-g.yaw);move.set(delta.x,delta.z);frame();
   }
   move.set(0,0);const point=new V(12.5,3.10,8.5);
   for(let i=0;i<360;i++){
    g.scene.updateMatrixWorld(true);if(point.clone().sub(g.camera.position).dot(g.camera.getWorldDirection(new V()))<0){g.yaw+=.16;frame();continue;}
    const p=point.clone().project(g.camera);if(i>24&&Math.abs(p.x)<.005&&Math.abs(p.y)<.005)break;
    g.yaw-=Math.max(-1,Math.min(1,p.x))*.18;g.pitch=Math.max(-1.56,Math.min(1.15,g.pitch+Math.max(-1,Math.min(1,p.y))*.17));frame();
   }
   g.render();return{player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),held:!!g.heldCube,load:g.firstLevel.state.cargoSeat.loaded(),teleports:g.teleportCount,
    camera:g.camera.position.toArray(),quality:g.quality};
  }finally{g.input.getMove=saved;}
 });
 assert.equal(report.observation.load,false);assert.equal(report.observation.teleports,0);
 assert.ok(Math.hypot(report.observation.player[0],report.observation.player[2]-7.85)<.2);
 await page.screenshot({path:path.join(out,`${tag}-before-delivery-normal.png`)});
 const result=await page.evaluate(async()=>{
  const g=window.__NESI_DEMO_GAME__,originalVisual=g.updateVisuals,originalRender=g.render;
  const observer=new g.camera.constructor(55,16/9,.1,130);
  observer.position.set(19.15,7.95,9.75);observer.lookAt(13,3.1,6);
  let tick=0,previous=false,active=null;const clips=[],ring=[],normal=[];
  const sample=()=>{
   const old=g.camera,oldPortal=g.portals.camera;
   try{g.camera=observer;g.portals.camera=observer;originalRender.call(g);
    return{image:g.renderer.domElement.toDataURL('image/jpeg',.88),tick,time:g.elapsed/1000,
     loaded:g.firstLevel.state.cargoSeat.loaded(),indication:g.firstLevel.state.receiverDeck?.value??g.firstLevel.state.loadLink.value,
     loadLink:g.firstLevel.state.loadLink.value,cargo:g.cargo.position.toArray(),height:g.firstLevel.cassette.height,held:!!g.heldCube};
   }finally{g.camera=old;g.portals.camera=oldPortal;}
  };
  g.updateVisuals=function(...args){const r=originalVisual.apply(this,args);if(args[0]>0&&g.state==='playing'&&tick++%2===0){
   const loaded=g.firstLevel.state.cargoSeat.loaded();
   if(!active&&((clips.length===0&&loaded&&!previous)||(clips.length===1&&!loaded&&g.heldCube))){active={kind:clips.length?'unload':'load',frames:[...ring],remaining:60};clips.push(active);}
   previous=loaded;
   const near=(clips.length===0&&g.physics.portalTransports>0)||(clips.length===1&&g.playerPosition.distanceTo(g.cargo.position)<3.5);
   if(active||near){const s=sample();ring.push(s);if(ring.length>15)ring.shift();if(active){active.frames.push(s);if(--active.remaining===0)active=null;}}else ring.length=0;
  }return r;};
  window.__NESI_CAPTURE_LEVEL_MARK__=m=>{if(/weight holds|cargo recovered;|both on upper/.test(m.name)){originalRender.call(g);normal.push({name:m.name,image:g.renderer.domElement.toDataURL('image/png')});}};
  try{return{route:await window.__NESI_RUN_LEVEL_ROUTE__({order:'brake-first'}),clips,normal};}
  finally{g.updateVisuals=originalVisual;delete window.__NESI_CAPTURE_LEVEL_MARK__;originalRender.call(g);}
 });
 report.route=result.route;assert.ok(result.route.pass);assert.equal(result.route.resets+result.route.respawns,0);
 assert.deepEqual(result.clips.map(c=>c.kind),['load','unload']);
 const directory=path.join(out,`${tag}-frames`);fs.mkdirSync(directory,{recursive:true});let index=0;report.clips=[];
 for(const clip of result.clips){
  assert.equal(clip.remaining,0);const last=clip.frames.at(-1);
  assert.ok(clip.kind==='load'?last.indication>.99:last.indication<.01);
  if(tag==='after')for(const s of clip.frames)assert.ok(Math.abs(s.indication-s.loadLink)<1e-9);
  report.clips.push({kind:clip.kind,frames:clip.frames.length,samples:clip.frames.map(({image,...s})=>s)});
  for(const s of clip.frames)fs.writeFileSync(path.join(directory,`${String(index++).padStart(5,'0')}.jpg`),Buffer.from(s.image.split(',')[1],'base64'));
  fs.writeFileSync(path.join(out,`${tag}-${clip.kind}.jpg`),Buffer.from(last.image.split(',')[1],'base64'));
 }
 for(const [i,s]of result.normal.entries())fs.writeFileSync(path.join(out,`${tag}-normal-${i}.png`),Buffer.from(s.image.split(',')[1],'base64'));
 execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','30','-i',path.join(directory,'%05d.jpg'),'-vf',`drawtext=text='${tag} - receiver inspection - low graphics - silent':fontsize=20:fontcolor=white:box=1:boxcolor=black@0.75:x=18:y=18`,
  '-c:v','libx264','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',path.join(out,`${tag}-receiver.mp4`)]);
 report.video.frames=index;report.video.seconds=index/30;assert.deepEqual(report.errors,[]);report.pass=true;
}catch(error){report.failure=error.stack;throw error;}
finally{fs.writeFileSync(path.join(out,`${tag}.json`),JSON.stringify(report,null,2));await browser.close();}
