import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import puppeteer from 'puppeteer-core';
const tag=process.env.BUG_TAG||'after',out=process.env.EVIDENCE_OUT||'smoke-artifacts/video-portals';
assert.match(tag,/^(before|after)$/);fs.mkdirSync(out,{recursive:true});
const report={source:process.env.SOURCE_COMMIT,tag,pass:false,errors:[],
 scope:'User-video symptom regressions. Floor case initializes a labelled capsule/rim fixture in the real room; wall shot and traversal use normal movement/aim/fire without actor assignment after reset. Full campaign tested separately. Not hardware FPS.',
 video:{width:1280,height:720,fps:30,audio:false,graphics:'low'}};
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,protocolTimeout:300000,
 args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage();await page.setViewport({width:1280,height:720});page.setDefaultTimeout(120000);
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.evaluateOnNewDocument(()=>localStorage.setItem('brainrot-portal.preferences.v24',JSON.stringify({quality:'low',muted:true,tutorial:true})));
 await page.goto(new URL('?level=21&debug=1&smoke=1',process.env.PAGE_URL||'http://127.0.0.1:4173/').href,{waitUntil:'networkidle2'});
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='playing');
 const data=await page.evaluate(async tag=>{
  const g=window.__NESI_DEMO_GAME__,V=g.playerPosition.constructor,V2=g.input.getMove().constructor;
  g.renderer.setAnimationLoop(null);g.renderer.setPixelRatio(1);g.renderer.setSize(1280,720);
  const banner=document.createElement('div');banner.style.cssText='position:fixed;bottom:16px;left:18px;right:18px;padding:10px;background:#10202cee;color:white;font:19px sans-serif;z-index:100;pointer-events:none';document.body.append(banner);
  const result={clips:[],floor:{},wall:{}};let clip=null,display=0;
  const image=()=>g.renderer.domElement.toDataURL('image/jpeg',.9);
  const snap=()=>({player:g.playerPosition.toArray(),velocity:g.playerVelocity.toArray(),camera:g.camera.position.toArray(),teleports:g.teleportCount,grounded:g.playerGrounded,contact:!!g.portalFootContact});
  const step=()=>{if(g.state==='playing'){g.updatePlaying(1/120);g.updatePlaying(1/120);}g.updateVisuals(1/60,1);if(clip&&display++%2===0){g.render();clip.frames.push({image:image(),...snap()});}};
  const start=(name,label)=>{clip={name,label,frames:[]};result.clips.push(clip);display=0;banner.textContent=`${tag==='before'?'ДО':'ПОСЛЕ'} · ${label}`;};
  // Exact numerical fixture, not a claimed recording of the user's inputs.
  g.resetRun(true);g.yaw=0;
  const panel=g.firstLevel.panels['shared-well'];
  for(const [index,z] of [[0,-1],[1,7]])if(!g.placeOnPanel(index,panel.mesh,new V(0,.025,z)))throw Error('fixture placement');
  g.playerPosition.set(.8175,.025,7);g.previousPlayerPosition.copy(g.playerPosition);g.playerGroup.position.copy(g.playerPosition);
  g.playerVelocity.set(0,0,0);g.playerGrounded=true;g.cameraRig.reset(g.playerPosition,0,-.75);g.pitch=-.75;g.updateVisuals(0,1);
  result.floor.initial=snap();start('rim','Тест края напольного портала · без ввода движения');
  for(let i=0;i<60;i++)step();result.floor.final=snap();clip=null;
  // From now on no actor or lens coordinate assignment: reset, walk, aim, fire.
  g.resetRun(true);const oldMove=g.input.getMove,move=new V2();g.input.getMove=()=>move.clone();
  const stop=()=>{move.set(0,0);g.input.keys.clear();};
  const walk=(x,z)=>{
   for(let i=0;i<1200;i++){const d=new V(x,0,z).sub(g.playerPosition);d.y=0;if(d.length()<.11){stop();return;}
    const pace=Math.min(1,d.length()*1.5);d.normalize().multiplyScalar(pace).applyAxisAngle(new V(0,1,0),-g.yaw);move.set(d.x,d.z);step();}
   throw Error('walking stalled');
  };
  const look=point=>{
   stop();for(let i=0;i<360;i++){g.scene.updateMatrixWorld(true);
    if(point.clone().sub(g.camera.position).dot(g.camera.getWorldDirection(new V()))<0){g.yaw+=.16;step();continue;}
    const p=point.clone().project(g.camera);if(i>24&&Math.abs(p.x)<.005&&Math.abs(p.y)<.005)return;
    g.yaw-=Math.max(-1,Math.min(1,p.x))*.18;g.pitch=Math.max(-1.56,Math.min(1.15,g.pitch+Math.max(-1,Math.min(1,p.y))*.17));step();
   }
  };
  const fire=(index,point)=>{look(point);if(!g.firePortal(index))throw Error('input rejected');for(let i=0;i<180&&(g.portalShots.queue.length||g.portalShots.active.length);i++)step();return{...g.portalShots.lastImpact};};
  try{
   for(let i=0;i<30;i++)step();walk(-10,14);look(new V(-14.8,10.5,14));
   start('low-shot','Низкий выстрел в белую панель · обычное управление');
   result.wall.shot=fire(0,new V(-14.8,10.5,14));
   result.wall.placed=g.portals.portals[0]?.position.toArray()??null;
   for(let i=0;i<45;i++)step();clip=null;
   if(result.wall.shot.valid){
    walk(-14,13);const second=fire(1,g.firstLevel.panels['brake-bay'].getFrame().center);
    if(!second.valid)throw Error('return pair rejected');
    walk(-13.45,14);start('entry','Проход с пола без прыжка');
    for(let i=0;i<180&&g.teleportCount===0;i++){
     const v=new V(-1,0,0).applyAxisAngle(new V(0,1,0),-g.yaw);move.set(v.x,v.z);step();}
    stop();for(let i=0;i<30;i++)step();result.wall.arrival=snap();clip=null;
   }
  }finally{g.input.getMove=oldMove;stop();banner.remove();g.render();}
  return result;
 },tag);
 report.floor=data.floor;report.wall=data.wall;report.clips=[];
 assert.equal(report.floor.initial.teleports,0);
 if(tag==='after'){assert.ok(report.floor.final.teleports>0);assert.equal(report.wall.shot.valid,true);assert.equal(report.wall.arrival.teleports,1);}
 else{assert.equal(report.floor.final.teleports,0);assert.equal(report.wall.shot.valid,false);}
 for(const clip of data.clips){
  const dir=path.join(out,`${tag}-${clip.name}-frames`);fs.mkdirSync(dir,{recursive:true});
  for(const [i,f]of clip.frames.entries())fs.writeFileSync(path.join(dir,`${String(i).padStart(5,'0')}.jpg`),Buffer.from(f.image.split(',')[1],'base64'));
  const label=`${tag} - ${clip.name} - native regression - silent`;
  const file=path.join(out,`${tag}-${clip.name}.mp4`);
  execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','30','-i',path.join(dir,'%05d.jpg'),'-vf',`drawtext=text='${label}':fontsize=20:fontcolor=white:box=1:boxcolor=black@0.75:x=20:y=h-45`,
   '-c:v','libx264','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',file]);
  fs.copyFileSync(path.join(dir,`${String(clip.frames.length-1).padStart(5,'0')}.jpg`),path.join(out,`${tag}-${clip.name}.jpg`));
  report.clips.push({name:clip.name,label:clip.label,frames:clip.frames.map(({image,...f})=>f)});
 }
 assert.deepEqual(report.errors,[]);report.pass=true;
}catch(error){report.failure=error.stack;throw error;}
finally{fs.writeFileSync(path.join(out,`${tag}.json`),JSON.stringify(report,null,2));await browser.close();}
