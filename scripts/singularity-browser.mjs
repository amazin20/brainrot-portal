import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import puppeteer from 'puppeteer-core';
import {SINGULARITY_ROOMS} from '../src/game/LabSingularityLayout.js';
import {assertUpgradeInfo,assertUpgradeEvidence,captureFormat} from './lib/singularity-upgrade-proof.mjs';
import {verifySingularityUI,waitForStartMenu,playFromStartMenu} from './lib/singularity-ui-check.mjs';
const out=path.resolve(process.env.OUT_DIR||'qa/singularity');fs.mkdirSync(out,{recursive:true});
const record=process.env.RECORD==='1',route=record||process.env.ROUTE==='1';
const {fps,stride,width,height,durationToleranceSeconds}=captureFormat({fps:Number(process.env.CAPTURE_FPS||12),width:Number(process.env.CAPTURE_WIDTH||960),height:Number(process.env.CAPTURE_HEIGHT||540)});
const graphicsPreset=process.env.GRAPHICS_PRESET||'low',routeOptions=JSON.parse(process.env.ROUTE_OPTIONS||'{}');
assert.ok(['low','balanced','high'].includes(graphicsPreset));assert.ok(routeOptions&&typeof routeOptions==='object'&&!Array.isArray(routeOptions));
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',headless:true,protocolTimeout:18_000_000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],movie=path.join(out,'tower-singularity.mp4');let encoder=null,encoderExit=null,count=0,first=null,last=null,page,lastVisualFrame=-1,terminalCaptured=false;
// Capture only the actual production canvas. CDP's compositor screenshot can
// stall software WebGL even when synchronous canvas readback remains healthy.
async function saveCanvasPng(filename){
 const capture=await page.evaluate(()=>{
  const g=window.__NESI_DEMO_GAME__;if(!g)throw Error('No gameplay canvas available');
  const snapshot=()=>[g.state,g.elapsed,...g.playerPosition.toArray(),...g.cargo.position.toArray(),g.firstLevel.completedStages],before=snapshot();
  g.render();const c=document.createElement('canvas');c.width=g.renderer.domElement.width;c.height=g.renderer.domElement.height;const ctx=c.getContext('2d',{alpha:false});ctx.drawImage(g.renderer.domElement,0,0);
  const png=c.toDataURL('image/png');if(JSON.stringify(before)!==JSON.stringify(snapshot()))throw Error('Canvas capture advanced gameplay');
  return {png,width:c.width,height:c.height};
 });
 assert.equal(capture.width,width);assert.equal(capture.height,height);
 fs.writeFileSync(path.join(out,filename),Buffer.from(capture.png.slice(capture.png.indexOf(',')+1),'base64'));
}
if(record){encoder=spawn('ffmpeg',['-y','-hide_banner','-loglevel','error','-f','image2pipe','-vcodec','mjpeg','-framerate',String(fps),'-i','pipe:0','-an','-c:v','libx264','-preset','veryfast','-crf','25','-pix_fmt','yuv420p','-movflags','+faststart',movie],{stdio:['pipe','ignore','pipe']});encoder.stderr.on('data',b=>process.stderr.write(b));encoderExit=once(encoder,'exit');}
try{
 page=await browser.newPage();page.setDefaultTimeout(180000);await page.setViewport({width,height,deviceScaleFactor:1});page.on('pageerror',e=>errors.push(String(e)));
 await page.evaluateOnNewDocument(graphicsPreset=>localStorage.setItem('brainrot-foundation-v1:brainrot-portal.preferences.v24',JSON.stringify({quality:graphicsPreset,muted:true,tutorial:true})),graphicsPreset);
 await page.exposeFunction('__SINGULARITY_WRITE__',async batch=>{
  for(const f of batch){assert.equal(f.index,count);assert.equal(terminalCaptured,false,'No frame may follow the final won sample');
   if(f.terminal){assert.equal(f.state.state,'won');assert.ok(f.visualFrame>lastVisualFrame&&f.visualFrame<count*stride&&count*stride-f.visualFrame<stride,'Final won sample must lie within the next capture interval');terminalCaptured=true;}
   else assert.equal(f.visualFrame,count*stride);
   lastVisualFrame=f.visualFrame;const bytes=Buffer.from(f.jpeg.slice(f.jpeg.indexOf(',')+1),'base64');first??=f.state;last=f.state;
   if(count===0)fs.writeFileSync(path.join(out,'gameplay-start.jpg'),bytes);
   if(f.state.solved.length>=Math.ceil(SINGULARITY_ROOMS.length/2)&&!fs.existsSync(path.join(out,'gameplay-middle.jpg')))fs.writeFileSync(path.join(out,'gameplay-middle.jpg'),bytes);
   if(!encoder.stdin.write(bytes))await once(encoder.stdin,'drain');count++;
  }
  if(count%120===0)console.log('CAPTURE',count/fps,'seconds;',last.solved.length,'machines');
 });
 const url=new URL(process.env.PAGE_URL||'http://127.0.0.1:4173/');url.searchParams.set('level','41');url.searchParams.set('edition','foundation');url.searchParams.set('debug','1');
 await page.goto(url.href,{waitUntil:'domcontentloaded'});await waitForStartMenu(page);
 const info=await page.evaluate(async()=>{const r=await fetch('build-info.json');if(!r.ok)throw Error('Missing build identity');return r.json();});
 if(process.env.BUILD_COMMIT)assert.equal(info.commit,process.env.BUILD_COMMIT);const tower=assertUpgradeInfo(info,SINGULARITY_ROOMS);
 await playFromStartMenu(page,false,graphicsPreset);
 await page.evaluate(()=>window.__NESI_DEMO_GAME__.renderer.setAnimationLoop(null));
 const nativeCanvas=await page.evaluate(()=>{const c=window.__NESI_DEMO_GAME__.renderer.domElement;return {width:c.width,height:c.height};});assert.deepEqual(nativeCanvas,{width,height},'Capture dimensions must match the actual production canvas');
 const renderBenchmark=await page.evaluate(({width,height})=>{const g=window.__NESI_DEMO_GAME__,snapshot=()=>[g.elapsed,...g.playerPosition.toArray(),...g.cargo.position.toArray(),g.firstLevel.completedStages],before=snapshot();const c=document.createElement('canvas');c.width=width;c.height=height;const ctx=c.getContext('2d',{alpha:false});const render=()=>{g.render();ctx.drawImage(g.renderer.domElement,0,0);c.toDataURL('image/jpeg',.83);};const warmupMs=[],times=[];for(let i=0;i<5;i++){const t=performance.now();render();(i<2?warmupMs:times).push(performance.now()-t);}if(JSON.stringify(before)!==JSON.stringify(snapshot()))throw Error('Render inspection advanced gameplay');return {warmupMs,timesMs:times,meanMs:times.reduce((s,x)=>s+x,0)/times.length,width,height,drawCalls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles,method:'Software-renderer/readback cost at frozen ordinary start after two warmup frames; not hardware FPS.'};},{width,height});
 fs.writeFileSync(path.join(out,'render-benchmark.json'),JSON.stringify(renderBenchmark,null,2));console.log('RENDER COST',JSON.stringify(renderBenchmark));await saveCanvasPng('ordinary-start.png');
 if(!route){
  const samples=await page.evaluate(()=>{
   const g=window.__NESI_DEMO_GAME__,r=[...g.firstLevel.rooms.values()].map(r=>({id:r.def.id,position:[r.def.at[0]+Math.min(10,r.def.w*.2),r.def.at[1]+Math.min(9,r.def.h*.65),r.def.at[2]+Math.min(15,r.def.d*.35)],target:[...r.def.at]}));
   const overrides={freight:{position:[-29,7.4,53],target:[-48,4,33]},sluice:{position:[63,10,55],target:[42,5,29]},optics:{position:[-19,10,-28],target:[-49,4,-42]},hoist:{position:[62,22,-18],target:[42,12,-39]},archive:{position:[-25,27,44],target:[-47,23,29]},flywheel:{position:[-34,28,-21],target:[-48,23,-45]},magnet:{position:[65,29,51],target:[45,24,37]},migrant:{position:[56,45,-15],target:[38,40,-34]},pendulum:{position:[-26,51,52],target:[-52,42,33]},inertia:{position:[-17,68,-18],target:[-52,59,-39]},crown:{position:[-35,86,42],target:[-53,77,27]}};for(const s of r)if(overrides[s.id])Object.assign(s,overrides[s.id]);r.unshift({id:'atrium',position:[8,61,52],target:[0,28,-18]});return r;
  });
  for(const s of samples){await page.evaluate(s=>{const g=window.__NESI_DEMO_GAME__;g.camera.position.fromArray(s.position);g.camera.lookAt(...s.target);g.camera.fov=72;g.camera.updateProjectionMatrix();g.camera.updateWorldMatrix(true,false);},s);await saveCanvasPng(`inspection-${s.id}.png`);}
  fs.writeFileSync(path.join(out,'inspection.json'),JSON.stringify({sourceCommit:info.commit,version:info.version,graphicsPreset,width,height,rooms:samples.map(s=>s.id),method:'Camera-only architectural inspections from the actual production canvas; DOM controls are checked separately. These images do not assert a completed playthrough.',errors},null,2));
  await verifySingularityUI(browser,{url,info,out});
 }else{
  const report=await page.evaluate(async ({record,stride,width,height,routeOptions})=>{
   const g=window.__NESI_DEMO_GAME__,body=g.physics.cargoBody.id,events=[],telemetry=[];let frames=0,encoded=0,batch=[],lastCaptured=-1,lastSolved=0,seenResets=0;
   const oldPhysics=g.updatePlaying,oldReset=g.resetRun;
   g.resetRun=function(...a){seenResets++;return oldReset.apply(this,a);};
   g.updatePlaying=function(dt,...args){const result=oldPhysics.call(this,dt,...args);const n=g.firstLevel.completedStages;if(n!==lastSolved){if(n!==lastSolved+1)throw Error('Progress jumped');events.push(g.firstLevel.getTowerMetrics().events.at(-1));lastSolved=n;}return result;};
   const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{alpha:false});
   const capture=(state,terminal=false)=>{if(g.renderer.domElement.width!==width||g.renderer.domElement.height!==height)throw Error('Production canvas dimensions changed during recording');g.render();ctx.drawImage(g.renderer.domElement,0,0);batch.push({index:encoded++,visualFrame:frames,terminal,jpeg:canvas.toDataURL('image/jpeg',.83),state});lastCaptured=frames;};
   window.__SINGULARITY_FRAME__=async state=>{if(state.cargoBodyId!==body||seenResets)throw Error('Original attempt changed');frames=state.visualFrame;if(record&&frames%stride===0)capture(state);if(frames%60===0)telemetry.push(state);};
   window.__SINGULARITY_FLUSH__=async()=>{if(batch.length){const pending=batch;batch=[];await window.__SINGULARITY_WRITE__(pending);}};
   try{
    const result=await window.__NESI_RUN_LEVEL_ROUTE__(routeOptions);
    // Include the actual final won state when it falls between regular samples.
    // No extra physics, animation frames or stationary padding are introduced.
    if(record&&lastCaptured<result.frames-1){frames=result.frames-1;capture({state:g.state,player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),solved:g.firstLevel.getTowerMetrics().solvedIds,cargoBodyId:body,visualFrame:frames,seconds:result.seconds},true);}
    await window.__SINGULARITY_FLUSH__();return {result,observed:{events,telemetry,seenResets,bodyId:body},encodedFrames:encoded};
   }catch(error){window.__SINGULARITY_FAILURE__={error:String(error),report:error.singularityReport,events,telemetry};throw error;}
   finally{g.updatePlaying=oldPhysics;g.resetRun=oldReset;delete window.__SINGULARITY_FRAME__;delete window.__SINGULARITY_FLUSH__;}
  },{record,stride,width,height,routeOptions});
  assert.equal(report.result.pass,true);assert.equal(report.result.metrics.completedStages,tower.stages);assert.equal(report.observed.events.length,tower.stages);assert.equal(new Set(report.observed.events.map(e=>e.id)).size,tower.stages);assert.equal(report.observed.seenResets,0);assert.equal(report.result.sameCompanion,true);
  await saveCanvasPng('ordinary-victory.png');
  const proof={sourceCommit:info.commit,version:info.version,graphicsPreset,routeOptions,rooms:tower.rooms,capture:{method:'Synchronous actual production-canvas readback; DOM controls are checked separately.',nativeCanvas,width,height,fps,stride},method:'Continuous ordinary scripted input through production physics. No actor placement, no puzzle-state assignment, no resets. Not a human playtest or a minimum-time proof.',...report,errors};
  if(record){encoder.stdin.end();const [code]=await encoderExit;encoder=null;assert.equal(code,0);assert.equal(count,report.encodedFrames);assert.equal(last.state,'won');
   const metadata=JSON.parse(execFileSync('ffprobe',['-v','quiet','-show_streams','-show_format','-of','json',movie],{encoding:'utf8'}));const video=metadata.streams.find(s=>s.codec_type==='video');assert.equal(video.codec_name,'h264');assert.equal(video.width,width);assert.equal(video.height,height);assert.equal(Number(video.nb_frames),count);assert.equal(video.avg_frame_rate,`${fps}/1`);assert.ok(Math.abs(Number(metadata.format.duration)-count/fps)<.12);
   proof.video={filename:path.basename(movie),sha256:createHash('sha256').update(fs.readFileSync(movie)).digest('hex'),frames:count,fps,stride,durationSeconds:count/fps,durationToleranceSeconds,simulationSeconds:report.result.seconds,terminalSample:terminalCaptured,lastVisualFrame,width,height,nativeCanvas,first,last};
  }
  assertUpgradeEvidence(proof,info,{record});
  fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify(proof,null,2));console.log('VERIFIED',info.commit,report.result.seconds,report.result.activeSeconds,count);
 }
 assert.deepEqual(errors,[]);
}catch(error){console.error(error);const detail=page?await page.evaluate(()=>window.__SINGULARITY_FAILURE__||null).catch(()=>null):null;fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({error:String(error),detail,capture:{width,height,fps,stride},errors},null,2));if(page)await saveCanvasPng('failure.png').catch(()=>{});throw error;}
finally{if(encoder){encoder.stdin.end();await encoderExit.catch(()=>{});}await browser.close();}
