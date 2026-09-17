import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import puppeteer from 'puppeteer-core';
const tag=process.env.P03B_TAG??'after',out=process.env.EVIDENCE_OUT??'smoke-artifacts/p03b';
assert.match(tag,/^(before|after)$/);fs.mkdirSync(out,{recursive:true});
const frames=path.join(out,`frames-${tag}`);fs.mkdirSync(frames,{recursive:true});
const report={tag,commit:process.env.SOURCE_COMMIT??process.env.BUILD_COMMIT??null,pass:false,errors:[],samples:[],
 scope:'Native browser inspection of the actual complete cassette enclosure. Other room objects excluded only in the labelled inspection scene. Explicit poses, not a gameplay route. Normal game start is recorded separately.',
 video:{width:1280,height:720,encodedFps:30,audio:false,fullEnclosure:true}};
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',headless:true,protocolTimeout:180000,
 args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage();await page.setViewport({width:1280,height:720});page.setDefaultTimeout(120000);
 page.on('pageerror',e=>report.errors.push(e.message));
 const url=new URL(process.env.PAGE_URL??'http://127.0.0.1:4173/');url.searchParams.set('level','21');url.searchParams.set('smoke','1');url.searchParams.set('debug','1');
 await page.goto(url.href,{waitUntil:'networkidle2'});
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='playing'||document.documentElement.dataset.runtimeState==='error');
 assert.equal(await page.$eval('#error-detail',e=>e.textContent),'');
 await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop(null);g.renderer.setPixelRatio(1);g.renderer.setSize(1280,720);g.render();});
 await page.screenshot({path:path.join(out,`${tag}-normal-start.png`)});
 report.inspection=await page.evaluate(tag=>{
  const g=window.__NESI_DEMO_GAME__,c=g.firstLevel.cassette;
  const scene=new g.scene.constructor();scene.background=g.scene.background.clone();
  const camera=new g.camera.constructor(42,16/9,.1,150);camera.position.set(-26,14,2);camera.lookAt(-11.5,12,-6);
  const materials=new Set(['Cassette coated graphite','Cassette guide alloy','Cassette warm edge','Protected counterweight inspection glass']);
  const sources=[c.root,c.suspension.root];
  // All casing meshes stay present, including transparent collision glass.
  // Do not substitute idealized meshes or hide intersecting faces.
  g.scene.traverse(o=>{if(o.isMesh&&o.parent.name==='Tiled architectural shell'&&materials.has(o.material?.name))sources.push(o);});
  const glass=g.scene.getObjectByName('Counterweight inspection glass / solid');
  if(!sources.includes(glass))throw Error('Inspection omitted the glass under review');
  const pairs=[];
  for(const source of sources){
   const clone=source.clone(true);scene.add(clone);const a=[],b=[];source.traverse(o=>a.push(o));clone.traverse(o=>b.push(o));
   if(a.length!==b.length)throw Error('Hierarchy differs');pairs.push({source,clone,children:a.slice(1).map((o,i)=>[o,b[i+1]])});
  }
  g.scene.traverse(o=>{if(o.isLight){const light=o.clone();o.getWorldPosition(light.position);scene.add(light);if(light.target)scene.add(light.target);}});
  for(const e of document.body.children)if(!e.contains(g.renderer.domElement))e.style.visibility='hidden';
  if(getComputedStyle(g.renderer.domElement).visibility!=='visible')throw Error('Canvas hidden');
  const label=document.createElement('div');label.style.cssText='position:fixed;top:18px;left:18px;right:18px;padding:10px;background:#172a36eb;color:white;font:17px system-ui;z-index:999';
  label.textContent=`${tag==='before'?'ДО':'ПОСЛЕ'} · Заднее окно кассеты · корпус сохранён · технический осмотр, не прохождение`;document.body.append(label);
  const state=document.createElement('div');state.style.cssText='position:fixed;bottom:18px;left:18px;padding:8px;background:#172a36eb;color:white;font:17px system-ui;z-index:999';document.body.append(state);
  window.__P03B_REVIEW__=(height,detail=false)=>{
   c.pose(height);g.scene.updateMatrixWorld(true);
   for(const p of pairs){p.source.matrixWorld.decompose(p.clone.position,p.clone.quaternion,p.clone.scale);
    for(const [from,to] of p.children){to.position.copy(from.position);to.quaternion.copy(from.quaternion);to.scale.copy(from.scale);to.visible=from.visible;}}
   if(detail){camera.position.set(-21.5,12,-1);camera.lookAt(-13.1,10.5,-6);}
   else{camera.position.set(-26,14,2);camera.lookAt(-11.5,12,-6);}
   state.textContent=`Панель ${height.toFixed(2)} м · движение 3,5 м/с · та же камера до/после`;
   g.renderer.render(scene,camera);return{height,glassX:glass.position.x,camera:camera.position.toArray(),orientation:camera.quaternion.toArray()};
  };
  return {sourceCount:sources.length,glassIncluded:true,glassX:glass.position.x,normalGameState:g.state};
 },tag);
 assert.equal(report.inspection.glassX,tag==='before'?-12.8:-14.35);
 const travel=12/3.5,count=Math.ceil((travel*2+1.5)*30);
 for(let frame=0;frame<count;frame++){
  const t=frame/30,height=t<.5?15.8:t<.5+travel?15.8-(t-.5)*3.5:t<1+travel?3.8:t<1+2*travel?3.8+(t-1-travel)*3.5:15.8;
  const result=await page.evaluate(h=>window.__P03B_REVIEW__(h),Math.max(3.8,Math.min(15.8,height)));
  report.samples.push({frame,time:t,...result});await page.screenshot({path:path.join(frames,`${String(frame).padStart(6,'0')}.jpg`),type:'jpeg',quality:88});
 }
 for(const [name,height]of [['high',15.8],['middle',9.8],['low',3.8]]){
  await page.evaluate(h=>window.__P03B_REVIEW__(h,true),height);await page.screenshot({path:path.join(out,`${tag}-${name}.png`)});
 }
 assert.deepEqual(report.errors,[]);
 const movie=path.join(out,`${tag}-casing.mp4`);execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','30','-i',path.join(frames,'%06d.jpg'),'-c:v','libx264','-preset','fast','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',movie]);
 report.video.frames=count;report.video.seconds=count/30;report.video.sha256=createHash('sha256').update(fs.readFileSync(movie)).digest('hex');report.pass=true;
}catch(error){report.failure=error.stack;throw error;}
finally{fs.writeFileSync(path.join(out,`${tag}-browser.json`),JSON.stringify(report,null,2));await browser.close();}
