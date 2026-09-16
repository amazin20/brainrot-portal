import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import puppeteer from 'puppeteer-core';
const out=process.env.EVIDENCE_OUT||'smoke-artifacts/p03',tag=process.env.P03_TAG||'after';
assert.match(tag,/^(before|after)$/);fs.mkdirSync(out,{recursive:true});
const frames=path.join(out,`frames-${tag}`);fs.mkdirSync(frames,{recursive:true});
const report={tag,commit:process.env.SOURCE_COMMIT||process.env.BUILD_COMMIT||null,pass:false,errors:[],
 scope:'Native Chromium rendering of actual game meshes in an isolated cutaway scene. The outer casing is omitted only from this inspection; poses are explicit visual fixtures, not gameplay or a full route.',
 video:{width:1280,height:720,encodedFps:30,audio:false,cutaway:true},samples:[]};
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,
 protocolTimeout:180000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage();await page.setViewport({width:1280,height:720});page.setDefaultTimeout(120000);
 page.on('pageerror',e=>report.errors.push(e.message));
 const url=new URL(process.env.PAGE_URL||'http://127.0.0.1:4173/');url.searchParams.set('level','21');url.searchParams.set('debug','1');url.searchParams.set('smoke','1');
 await page.goto(url.href,{waitUntil:'networkidle2'});
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='playing'||document.documentElement.dataset.runtimeState==='error');
 assert.equal(await page.$eval('#error-detail',e=>e.textContent),'');
 await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop(null);g.renderer.setPixelRatio(1);g.renderer.setSize(1280,720);g.render();});
 await page.screenshot({path:path.join(out,`${tag}-normal-start.png`)});
 const manifest=await page.evaluate(tag=>{
  const g=window.__NESI_DEMO_GAME__,c=g.firstLevel.cassette;
  const review=new g.scene.constructor();review.background=g.scene.background?.clone();
  const camera=new g.camera.constructor(45,16/9,.1,150);camera.position.set(-26,16,28);camera.lookAt(-10,12,-6);
  // The source objects are never reparented or edited by the cutaway renderer.
  // Only their authored poses are copied; the production game retains casing.
  const sources=[c.root];
  if(c.suspension)sources.push(c.suspension.root);
  g.scene.traverse(o=>{
   if(!o.isMesh)return;
   const p=o.position;
   const rail=p.x===-10&&[12.025,.18,24.3].includes(p.y);
   const oldBallast=!c.suspension&&p.x===-11.9&&p.z===-6;
   const oldRope=!c.suspension&&p.x===-10&&[-9.65,-2.35].includes(p.z);
   if(rail||oldBallast||oldRope)sources.push(o);
  });
  const pairs=[];
  for(const source of sources){
   const clone=source.clone(true);review.add(clone);
   const originals=[],copies=[];source.traverse(o=>originals.push(o));clone.traverse(o=>copies.push(o));
   if(originals.length!==copies.length)throw Error('Clone hierarchy mismatch');
   pairs.push({source,clone,children:originals.slice(1).map((o,i)=>[o,copies[i+1]])});
  }
  g.scene.traverse(o=>{if(o.isLight){const light=o.clone();o.getWorldPosition(light.position);review.add(light);if(light.target)review.add(light.target);}});
  // Omit normal HUD in this labelled inspection, without altering any game state.
  for(const e of [...document.body.children])if(!e.contains(g.renderer.domElement))e.style.visibility='hidden';
  if(getComputedStyle(g.renderer.domElement).visibility!=='visible')throw Error('Inspection canvas hidden by an ancestor');
  const label=document.createElement('div');label.style.cssText='position:fixed;left:22px;top:18px;right:22px;padding:12px 16px;border-radius:8px;background:#132a35eb;color:#f3f7ef;font:18px system-ui;z-index:999;pointer-events:none';
  label.textContent=`${tag==='before'?'ДО':'ПОСЛЕ'} · Подвес кассеты · технический разрез, корпус скрыт · не прохождение`;document.body.append(label);
  const status=document.createElement('div');status.style.cssText='position:fixed;left:22px;bottom:22px;padding:8px 14px;background:#132a35eb;color:#f3f7ef;font:17px system-ui;z-index:999';document.body.append(status);
  let meshes=0,triangles=0;review.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});
  window.__P03_REVIEW__=height=>{
   c.pose(height);g.scene.updateMatrixWorld(true);
   for(const p of pairs){p.source.matrixWorld.decompose(p.clone.position,p.clone.quaternion,p.clone.scale);
    for(const [from,to]of p.children){to.position.copy(from.position);to.quaternion.copy(from.quaternion);to.scale.copy(from.scale);to.visible=from.visible;}}
   status.textContent=`Высота панели ${height.toFixed(2)} м · штатный ход 3,8–15,8 м`;
   g.renderer.render(review,camera);
   return {height,weightY:c.suspension?.weights.position.y??4+(15.8-height)*.78,
    calls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles};
  };
  return {meshes,triangles,camera:{position:camera.position.toArray(),quaternion:camera.quaternion.toArray()},suspension:Boolean(c.suspension)};
 },tag);
 report.inspection=manifest;assert.equal(manifest.suspension,tag==='after');
 // Exact 3.5 m/s travel with half-second end holds. Encoded 30 Hz is NOT FPS.
 const travel=12/3.5,duration=travel*2+1.5,count=Math.ceil(duration*30);
 for(let i=0;i<count;i++){
  const t=i/30;
  const height=t<.5?15.8:t<.5+travel?15.8-(t-.5)*3.5:t<1+travel?3.8:t<1+2*travel?3.8+(t-1-travel)*3.5:15.8;
  const sample=await page.evaluate(h=>window.__P03_REVIEW__(h),Math.min(15.8,Math.max(3.8,height)));report.samples.push({frame:i,time:t,...sample});
  await page.screenshot({path:path.join(frames,`${String(i).padStart(6,'0')}.jpg`),type:'jpeg',quality:88});
  if(i===Math.round((.5+travel/2)*30))await page.screenshot({path:path.join(out,`${tag}-mid-travel.png`)});
 }
 assert.deepEqual(report.errors,[]);
 const movie=path.join(out,`${tag}-suspension.mp4`);
 execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','30','-i',path.join(frames,'%06d.jpg'),'-c:v','libx264','-preset','fast','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',movie]);
 report.video.frames=count;report.video.seconds=count/30;report.video.sha256=crypto.createHash('sha256').update(fs.readFileSync(movie)).digest('hex');report.pass=true;
} catch(error){report.failure=error.stack;throw error;}
finally{fs.writeFileSync(path.join(out,`${tag}.json`),JSON.stringify(report,null,2));await browser.close();}
