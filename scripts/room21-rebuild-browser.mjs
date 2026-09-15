import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import puppeteer from 'puppeteer-core';
const variant=process.env.ROOM21_ORDER||'cargo-first';
assert.ok(['cargo-first','source-first','recovery'].includes(variant));
const out=`smoke-artifacts/room21-rebuild-${variant}`;fs.mkdirSync(out,{recursive:true});
const base=process.env.PAGE_URL||'http://127.0.0.1:4173/';
const chunk=fs.readdirSync('dist/assets').filter(n=>/^LabV8Journey-.*\.js$/.test(n));assert.equal(chunk.length,1);
const report={commit:process.env.BUILD_COMMIT||null,variant,errors:[],pass:false,
 scope:'Complete ordinary route in production WebGL build. Milestone images and a separate excerpt of each transfer; NOT a complete playthrough video, novice timing or hardware FPS.'};
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,
 protocolTimeout:1200000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage();page.setDefaultTimeout(120000);await page.setViewport({width:1280,height:720});
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(`${base}?level=21&debug=1&smoke=1`,{waitUntil:'networkidle2'});
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='playing');
 await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop(null);g.renderer.setPixelRatio(1);g.renderer.setSize(1280,720);g.visualTime=0;g.render();});
 await page.screenshot({path:path.join(out,'start.png')});
 const data=await page.evaluate(async({url,variant})=>{
  const {runV8Journey}=await import(url);if(typeof runV8Journey!=='function')throw Error('Route export missing');
  const g=window.__NESI_DEMO_GAME__,original=g.updateVisuals,images=[],clips=[],trace=[];
  let previous=0,remaining=0,clip=0,frames=0;
  const recordClips=variant==='cargo-first';
  g.updateVisuals=function(dt,alpha){
   original.call(this,dt,alpha);
   if(this.teleportCount>previous){previous=this.teleportCount;remaining=180;clip=previous;frames=0;}
   if(recordClips&&remaining>0){remaining--;if((frames++%2)===0){this.render();clips.push({clip,index:(frames-1)/2,image:this.renderer.domElement.toDataURL('image/jpeg',.86),
    player:this.playerPosition.toArray(),cargo:this.cargo.position.toArray(),elapsed:this.elapsed});}}
  };
  try{
   const route=await runV8Journey(g,{journeyOptions:variant==='recovery'?{recovery:true}:{order:variant},onMilestone:m=>{
    g.render();images.push({name:m.name,image:g.renderer.domElement.toDataURL('image/png')});
    trace.push({...m,elapsed:g.elapsed,sourceLatched:g.firstLevel.state.sourceDrive.latched,guard:g.firstLevel.state.freightGuard.progress});
   }});
   return {route,images,clips,trace,won:g.firstLevel.isWon(),cargoBodyId:g.physics.cargoBody.id,models:g.diagnostics().modelsLoaded};
  }finally{g.updateVisuals=original;}
 },{url:new URL(`assets/${chunk[0]}`,base).href,variant});
 report.route=data.route;report.trace=data.trace;report.won=data.won;report.cargoBodyId=data.cargoBodyId;
 report.milestones=data.images.map((m,i)=>{const file=`${String(i).padStart(2,'0')}-milestone.png`;fs.writeFileSync(path.join(out,file),Buffer.from(m.image.split(',')[1],'base64'));return {name:m.name,file};});
 for(const m of data.clips){const dir=path.join(out,`clip-${m.clip}`);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,`${String(m.index).padStart(5,'0')}.jpg`),Buffer.from(m.image.split(',')[1],'base64'));}
 report.clips=[];
 for(const clip of [...new Set(data.clips.map(c=>c.clip))]){
  const movie=path.join(out,`transfer-${clip}.mp4`);
  execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','30','-i',path.join(out,`clip-${clip}`,'%05d.jpg'),'-c:v','libx264','-preset','fast','-crf','22','-pix_fmt','yuv420p','-movflags','+faststart',movie]);
  report.clips.push({clip,frames:data.clips.filter(c=>c.clip===clip).length,encodedFps:30,width:1280,height:720,audio:false,sha256:crypto.createHash('sha256').update(fs.readFileSync(movie)).digest('hex')});
 }
 await page.screenshot({path:path.join(out,'complete.png')});
 assert.equal(data.route.pass,true);assert.equal(data.won,true);assert.equal(data.route.resets,0);assert.equal(data.route.respawns,0);assert.deepEqual(report.errors,[]);report.pass=true;
}catch(e){report.error=e.stack;throw e;}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
