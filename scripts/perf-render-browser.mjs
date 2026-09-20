import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import puppeteer from 'puppeteer-core';

// Run this SAME script against the immutable baseline and candidate builds.
// Fixed input route, camera poses and graphics settings. SwiftShader timings
// are diagnostic only; draw calls, pixels and world-pose equality are gates.
const tag=process.env.PERF_TAG||'after',out=process.env.EVIDENCE_OUT||'smoke-artifacts/render-browser';
assert.match(tag,/^(before|after)$/);fs.mkdirSync(out,{recursive:true});
const report={tag,source:process.env.SOURCE_COMMIT||null,pass:false,errors:[],
 scope:'Ordinary room21, same 60Hz route and high graphics at 1280×720 in Chromium SwiftShader. NOT user-device FPS.',samples:[]};
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,protocolTimeout:900000,
 args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage();await page.setViewport({width:1280,height:720});page.setDefaultTimeout(120000);
 page.on('pageerror',error=>report.errors.push(error.message));
 await page.evaluateOnNewDocument(()=>localStorage.setItem('brainrot-portal.preferences.v24',JSON.stringify({quality:'high',muted:true,tutorial:true})));
 await page.goto(new URL('?level=21&debug=1&smoke=1',process.env.PAGE_URL||'http://127.0.0.1:4173/').href,{waitUntil:'networkidle2'});
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='playing');
 report.browser=await browser.version();
 const data=await page.evaluate(async checkDpi=>{
  const game=window.__NESI_DEMO_GAME__,renderer=game.renderer;
  renderer.setAnimationLoop(null);renderer.setPixelRatio(1);renderer.setSize(1280,720);game.render();
  const samples=[],trace=[],visual=game.updateVisuals,sceneUpdate=game.scene.updateMatrixWorld;
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=72;const context=canvas.getContext('2d',{willReadFrequently:true});
  let tick=0,matrices=0,lastTeleport=0,lastReady=false,firstLinkedTick=null,dpi=null;
  game.scene.updateMatrixWorld=function(...args){matrices++;return sceneUpdate.apply(this,args);};
  function capture(reason){
   game.render(); // same warmup policy; initialize shadows before capture
   matrices=0;const start=performance.now();game.render();const renderMs=performance.now()-start;
   context.drawImage(renderer.domElement,0,0,128,72);
   const pixels=Array.from(context.getImageData(0,0,128,72).data);
   samples.push({tick,reason,renderMs,sceneUpdates:matrices,render:{...renderer.info.render},memory:{...renderer.info.memory},
    portals:{...game.portals.diagnostics},image:renderer.domElement.toDataURL('image/png'),pixels,
    pose:[...game.playerPosition,...game.playerVelocity,...game.cargo.position,...game.camera.position,...game.camera.quaternion,game.camera.fov,game.teleportCount,game.state,!!game.heldCube]});
   if(checkDpi&&!dpi&&game.portals.diagnostics.visible>0){
    const visible=game.portals.diagnostics.visible;
    renderer.setPixelRatio(1.5);game.render();game.render();context.drawImage(renderer.domElement,0,0,128,72);
    dpi={tick,visible,before:pixels,after:Array.from(context.getImageData(0,0,128,72).data),image:renderer.domElement.toDataURL('image/png')};
    renderer.setPixelRatio(1);game.render();
   }
  }
  game.updateVisuals=function(...args){
   const result=visual.apply(this,args);
   trace.push([...game.playerPosition,...game.playerVelocity,...game.cargo.position,...game.camera.position,...game.camera.quaternion,game.camera.fov,game.teleportCount,game.state,!!game.heldCube]);
   if(game.portals.ready&&!lastReady)firstLinkedTick=tick;
   const reason=tick===120?'start':firstLinkedTick!==null&&tick===firstLinkedTick+45?'first-linked':game.teleportCount!==lastTeleport?'crossing':tick%900===0?'route':null;
   if(reason&&samples.length<22)capture(reason);
   lastTeleport=game.teleportCount;lastReady=game.portals.ready;tick++;return result;
  };
  try{return{route:await window.__NESI_RUN_LEVEL_ROUTE__(),samples,trace,quality:game.quality,dpi};}
  finally{game.updateVisuals=visual;game.scene.updateMatrixWorld=sceneUpdate;}
 },tag==='after');
 assert.ok(data.route.pass);assert.equal(data.route.resets+data.route.respawns,0);assert.ok(data.samples.length>=6);
 report.route=data.route;report.quality=data.quality;report.traceDigest=crypto.createHash('sha256').update(JSON.stringify(data.trace)).digest('hex');
 for(const [index,{image,...sample}] of data.samples.entries()){
  const filename=`${tag}-${String(index).padStart(2,'0')}-${sample.reason}.png`,bytes=Buffer.from(image.split(',')[1],'base64');
  fs.writeFileSync(path.join(out,filename),bytes);report.samples.push({...sample,filename,pixelHash:crypto.createHash('sha256').update(bytes).digest('hex')});
 }
 report.totalDraws=report.samples.reduce((sum,s)=>sum+s.render.calls,0);
 report.totalTriangles=report.samples.reduce((sum,s)=>sum+s.render.triangles,0);
 report.totalSceneUpdates=report.samples.reduce((sum,s)=>sum+s.sceneUpdates,0);
 if(tag==='after'){
  // The viewport setters use logical pixels even for a render target. Exercise
  // the corrected high-DPI path in WebGL at the very same final world pose.
  const dpi=data.dpi;assert.ok(dpi?.visible>0,'DPR check must contain a live portal');
  let sum=0,changed=0;
  for(let i=0;i<dpi.before.length;i++){if(i%4===3)continue;const delta=Math.abs(dpi.before[i]-dpi.after[i]);sum+=delta;if(delta>32)changed++;}
  report.hiDpi={tick:dpi.tick,visible:dpi.visible,ratios:[1,1.5],mean:sum/(128*72*3),largeDifferenceFraction:changed/(128*72*3)};
  fs.writeFileSync(path.join(out,'after-dpr-1.5.png'),Buffer.from(dpi.image.split(',')[1],'base64'));
  assert.ok(report.hiDpi.mean<4&&report.hiDpi.largeDifferenceFraction<.035,'DPR must preserve portal framing');
 }
 if(process.env.REFERENCE_REPORT){
  const before=JSON.parse(fs.readFileSync(process.env.REFERENCE_REPORT,'utf8'));
  assert.equal(report.traceDigest,before.traceDigest,'same physics and camera trajectory');
  assert.equal(report.samples.length,before.samples.length,'same sampled instants');
  report.comparison={drawReduction:1-report.totalDraws/before.totalDraws,triangleReduction:1-report.totalTriangles/before.totalTriangles,
   sceneUpdateReduction:1-report.totalSceneUpdates/before.totalSceneUpdates,pixels:[]};
  for(let i=0;i<report.samples.length;i++){
   const a=before.samples[i],b=report.samples[i];assert.equal(a.tick,b.tick);assert.deepEqual(a.pose,b.pose);
   let sum=0,changed=0,max=0;
   for(let k=0;k<a.pixels.length;k++){if(k%4===3)continue;const delta=Math.abs(a.pixels[k]-b.pixels[k]);sum+=delta;if(delta>32)changed++;max=Math.max(max,delta);}
   const mean=sum/(128*72*3),largeDifferenceFraction=changed/(128*72*3);
   report.comparison.pixels.push({tick:b.tick,mean,max,largeDifferenceFraction});
   assert.ok(mean<4&&largeDifferenceFraction<.035,`visible image changed at tick ${b.tick}: mean ${mean}, large fraction ${largeDifferenceFraction}`);
  }
  assert.ok(report.comparison.drawReduction>0,'optimization must reduce actual same-route draw submissions');
  assert.ok(report.comparison.sceneUpdateReduction>0,'portal passes must share scene updates');
 }
 assert.deepEqual(report.errors,[]);report.pass=true;
 console.log(JSON.stringify({tag,pass:true,samples:report.samples.length,totalDraws:report.totalDraws,totalTriangles:report.totalTriangles,totalSceneUpdates:report.totalSceneUpdates,comparison:report.comparison}));
}catch(error){report.failure=error.stack;throw error;}
finally{fs.writeFileSync(path.join(out,`${tag}.json`),JSON.stringify(report,null,2));await browser.close();}
