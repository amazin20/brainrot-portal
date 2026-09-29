import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import puppeteer from 'puppeteer-core';
const out=path.resolve(process.env.OUT_DIR||'qa/singularity');fs.mkdirSync(out,{recursive:true});
const record=process.env.RECORD==='1',route=record||process.env.ROUTE==='1',fps=12,stride=5;
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',headless:true,protocolTimeout:18_000_000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],movie=path.join(out,'tower-singularity.mp4');let encoder=null,encoderExit=null,count=0,first=null,last=null,page;
if(record){encoder=spawn('ffmpeg',['-y','-hide_banner','-loglevel','error','-f','image2pipe','-vcodec','mjpeg','-framerate',String(fps),'-i','pipe:0','-an','-c:v','libx264','-preset','veryfast','-crf','25','-pix_fmt','yuv420p','-movflags','+faststart',movie],{stdio:['pipe','ignore','pipe']});encoder.stderr.on('data',b=>process.stderr.write(b));encoderExit=once(encoder,'exit');}
try{
 page=await browser.newPage();page.setDefaultTimeout(180000);await page.setViewport({width:960,height:540,deviceScaleFactor:1});page.on('pageerror',e=>errors.push(String(e)));
 await page.exposeFunction('__SINGULARITY_WRITE__',async batch=>{
  for(const f of batch){assert.equal(f.index,count);assert.equal(f.visualFrame,count*stride);const bytes=Buffer.from(f.jpeg.slice(f.jpeg.indexOf(',')+1),'base64');first??=f.state;last=f.state;
   if(count===0)fs.writeFileSync(path.join(out,'gameplay-start.jpg'),bytes);
   if(f.state.solved.length>=6&&!fs.existsSync(path.join(out,'gameplay-middle.jpg')))fs.writeFileSync(path.join(out,'gameplay-middle.jpg'),bytes);
   if(!encoder.stdin.write(bytes))await once(encoder.stdin,'drain');count++;
  }
  if(count%120===0)console.log('CAPTURE',count/fps,'seconds;',last.solved.length,'machines');
 });
 const url=new URL(process.env.PAGE_URL||'http://127.0.0.1:4173/');url.searchParams.set('level','41');url.searchParams.set('edition','foundation');url.searchParams.set('debug','1');
 await page.goto(url.href,{waitUntil:'networkidle2'});await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready');
 const info=await page.evaluate(async()=>{const r=await fetch('build-info.json');if(!r.ok)throw Error('Missing build identity');return r.json();});
 if(process.env.BUILD_COMMIT)assert.equal(info.commit,process.env.BUILD_COMMIT);assert.equal(info.version,'v45-singularity');
 await page.select('#quality-select','low');await page.waitForFunction(()=>{const m=document.querySelector('#start-screen');return m&&!m.inert&&getComputedStyle(m).opacity==='1';});await page.bringToFront();await page.click('#play-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.state==='playing');
 await page.evaluate(()=>window.__NESI_DEMO_GAME__.renderer.setAnimationLoop(null));
 const renderBenchmark=await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__,before=[g.elapsed,...g.playerPosition.toArray(),g.firstLevel.completedStages];const c=document.createElement('canvas');c.width=960;c.height=540;const ctx=c.getContext('2d',{alpha:false});const render=()=>{g.render();ctx.drawImage(g.renderer.domElement,0,0,960,540);c.toDataURL('image/jpeg',.83);};render();const times=[];for(let i=0;i<8;i++){const t=performance.now();render();times.push(performance.now()-t);}const after=[g.elapsed,...g.playerPosition.toArray(),g.firstLevel.completedStages];if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Render inspection advanced gameplay');return {timesMs:times,meanMs:times.reduce((s,x)=>s+x,0)/times.length,drawCalls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles,method:'Software-renderer/readback cost at frozen ordinary start; not hardware FPS.'};});
 fs.writeFileSync(path.join(out,'render-benchmark.json'),JSON.stringify(renderBenchmark,null,2));console.log('RENDER COST',JSON.stringify(renderBenchmark));await page.screenshot({path:path.join(out,'ordinary-start.png')});
 if(!route){
  const samples=await page.evaluate(()=>{
   const g=window.__NESI_DEMO_GAME__,r=[...g.firstLevel.rooms.values()].map(r=>({id:r.def.id,position:[r.def.at[0]+Math.min(10,r.def.w*.2),r.def.at[1]+Math.min(9,r.def.h*.65),r.def.at[2]+Math.min(15,r.def.d*.35)],target:[...r.def.at]}));
   const overrides={drydock:{position:[42,14,-51],target:[66,5,-31]},accumulator:{position:[47,8,117],target:[48,2,84]},archive:{position:[5,23,-29],target:[-12,18,-49]},echo:{position:[1,10,111],target:[-14,2,92]},reservoir:{position:[-87,12,48],target:[-88,4,27]}};for(const s of r)if(overrides[s.id])Object.assign(s,overrides[s.id]);r.unshift({id:'atrium',position:[6,35,48],target:[0,29,-3]});return r;
  });
  for(const s of samples){await page.evaluate(s=>{const g=window.__NESI_DEMO_GAME__;g.camera.position.fromArray(s.position);g.camera.lookAt(...s.target);g.camera.fov=72;g.camera.updateProjectionMatrix();g.camera.updateWorldMatrix(true,false);g.render();},s);await page.screenshot({path:path.join(out,`inspection-${s.id}.png`)});}
  fs.writeFileSync(path.join(out,'inspection.json'),JSON.stringify({sourceCommit:info.commit,method:'Camera-only architectural inspections. These images do not assert a completed playthrough.',errors},null,2));
 }else{
  const report=await page.evaluate(async ({record,stride})=>{
   const g=window.__NESI_DEMO_GAME__,body=g.physics.cargoBody.id,events=[],telemetry=[];let frames=0,encoded=0,batch=[],lastCaptured=-1,lastSolved=0,seenResets=0;
   const oldPhysics=g.updatePlaying,oldReset=g.resetRun;
   g.resetRun=function(...a){seenResets++;return oldReset.apply(this,a);};
   g.updatePlaying=function(dt,...args){const result=oldPhysics.call(this,dt,...args);const n=g.firstLevel.completedStages;if(n!==lastSolved){if(n!==lastSolved+1)throw Error('Progress jumped');events.push(g.firstLevel.getTowerMetrics().events.at(-1));lastSolved=n;}return result;};
   const canvas=document.createElement('canvas');canvas.width=960;canvas.height=540;const ctx=canvas.getContext('2d',{alpha:false});
   const capture=state=>{g.render();ctx.drawImage(g.renderer.domElement,0,0,960,540);batch.push({index:encoded++,visualFrame:frames,jpeg:canvas.toDataURL('image/jpeg',.83),state});lastCaptured=frames;};
   window.__SINGULARITY_FRAME__=async state=>{if(state.cargoBodyId!==body||seenResets)throw Error('Original attempt changed');frames=state.visualFrame;if(record&&frames%stride===0)capture(state);if(frames%60===0)telemetry.push(state);};
   window.__SINGULARITY_FLUSH__=async()=>{if(batch.length){const pending=batch;batch=[];await window.__SINGULARITY_WRITE__(pending);}};
   try{
    const result=await window.__NESI_RUN_LEVEL_ROUTE__();
    if(record&&lastCaptured<result.frames-1){for(let f=result.frames;f%stride!==0;f++){g.updateVisuals(1/60,1);}frames=Math.ceil(result.frames/stride)*stride;g.updateVisuals(1/60,1);capture({state:g.state,player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),solved:g.firstLevel.getTowerMetrics().solvedIds,cargoBodyId:body});}
    await window.__SINGULARITY_FLUSH__();return {result,observed:{events,telemetry,seenResets,bodyId:body},encodedFrames:encoded};
   }catch(error){window.__SINGULARITY_FAILURE__={error:String(error),report:error.singularityReport,events,telemetry};throw error;}
   finally{g.updatePlaying=oldPhysics;g.resetRun=oldReset;delete window.__SINGULARITY_FRAME__;delete window.__SINGULARITY_FLUSH__;}
  },{record,stride});
  assert.equal(report.result.pass,true);assert.equal(report.result.metrics.completedStages,13);assert.equal(report.observed.events.length,13);assert.equal(new Set(report.observed.events.map(e=>e.id)).size,13);assert.equal(report.observed.seenResets,0);assert.equal(report.result.sameCompanion,true);
  await page.evaluate(()=>window.__NESI_DEMO_GAME__.render());await page.screenshot({path:path.join(out,'ordinary-victory.png')});
  const proof={sourceCommit:info.commit,version:info.version,method:'Continuous ordinary scripted input through production physics. No actor placement, no puzzle-state assignment, no resets. Not a human playtest or a minimum-time proof.',...report,errors};
  if(record){encoder.stdin.end();const [code]=await encoderExit;encoder=null;assert.equal(code,0);assert.equal(count,report.encodedFrames);assert.equal(last.state,'won');
   const metadata=JSON.parse(execFileSync('ffprobe',['-v','quiet','-show_streams','-show_format','-of','json',movie],{encoding:'utf8'}));const video=metadata.streams.find(s=>s.codec_type==='video');assert.equal(video.codec_name,'h264');assert.equal(video.width,960);assert.equal(video.height,540);assert.ok(Math.abs(Number(metadata.format.duration)-count/fps)<.12);
   proof.video={filename:path.basename(movie),sha256:createHash('sha256').update(fs.readFileSync(movie)).digest('hex'),frames:count,fps,durationSeconds:count/fps,width:960,height:540,first,last};
  }
  fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify(proof,null,2));console.log('VERIFIED',info.commit,report.result.seconds,report.result.activeSeconds,count);
 }
 assert.deepEqual(errors,[]);
}catch(error){console.error(error);const detail=page?await page.evaluate(()=>window.__SINGULARITY_FAILURE__||null).catch(()=>null):null;fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({error:String(error),detail,errors},null,2));if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw error;}
finally{if(encoder){encoder.stdin.end();await encoderExit.catch(()=>{});}await browser.close();}
