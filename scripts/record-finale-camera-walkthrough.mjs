/** Record one complete ordinary route through a default-campaign chamber.
 *
 * The existing debug route drives the production physics, interaction and
 * third-person camera. This tool samples configured intervals of 60 Hz updates and
 * renders the actual WebGL canvas; it never moves actors or camera for a shot.
 * The 4/6/12/30/60 fps MP4 is a simulation-time walkthrough, not a measured device FPS
 * or a human playtest. Run against the production build with ?debug=1.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const level=Number(process.env.LEVEL);
assert.ok([50,51].includes(level),'Camera review records only finale50–51');
const alternative=process.env.ALTERNATIVE_ROUTE||null;
const alternatives=new Map([[17,'lower-branch'],[47,'manual-impact'],[48,'staged-cargo'],[49,'unlit-mirror'],[50,'free-cargo-bridge'],[51,'missed-echo-recovery']]);
if(alternative)assert.equal(alternative,alternatives.get(level),'The requested alternative must belong to this room');
const out=path.resolve(process.env.OUT_DIR||'qa/walkthroughs');
const base=process.env.PAGE_URL||'http://127.0.0.1:4173/';
const fps=Number(process.env.CAPTURE_FPS||12);assert.ok([4,6,12,30,60].includes(fps));
const size={width:Number(process.env.CAPTURE_WIDTH||854),height:Number(process.env.CAPTURE_HEIGHT||480)},visualHz=60,stride=visualHz/fps;
const stem=`level-${String(level).padStart(2,'0')}${alternative?'-alternate':''}`;
const frameDir=path.join(out,`${stem}-frames`);
const movie=path.join(out,`${stem}.mp4`);
fs.mkdirSync(frameDir,{recursive:true});
const bytesHash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
let frameCount=0,firstFrame=null,lastFrame=null,cargoBodyId=null;
const errors=[];
const browser=await puppeteer.launch({
 // A single browser call contains the complete route and can exceed 30 min
 // for the longest chambers under software WebGL rendering on CI.
 executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,protocolTimeout:5400000,
 args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader'],
});
try{
 const page=await browser.newPage();
 page.setDefaultTimeout(180000);
 await page.setViewport({...size,deviceScaleFactor:1});
 page.on('pageerror',error=>errors.push(String(error)));
 await page.exposeFunction('__NESI_WRITE_WALKTHROUGH_FRAME__',(index,image,state)=>{
  assert.equal(index,frameCount,'Capture indices must be contiguous');
  assert.equal(state.visualFrame,index*stride,'Do not skip a visual frame interval');
  assert.equal(state.level,level,'The recorded level changed mid-route');
  assert.ok(['playing','won'].includes(state.state),'Only actual gameplay and victory may be recorded');
  if(cargoBodyId===null)cargoBodyId=state.cargoBodyId;
  assert.equal(state.cargoBodyId,cargoBodyId,'The real companion body must persist through the route');
  assert.match(image,/^data:image\/jpeg;base64,/,'Only native WebGL JPEG frames are accepted');
  const imageBytes=Buffer.from(image.slice(image.indexOf(',')+1),'base64');
  assert.equal(imageBytes[0],0xff);assert.equal(imageBytes[1],0xd8);
  assert.equal(imageBytes.at(-2),0xff);assert.equal(imageBytes.at(-1),0xd9);
  fs.writeFileSync(path.join(frameDir,`${String(index).padStart(6,'0')}.jpg`),imageBytes);
  firstFrame??=state;lastFrame=state;frameCount++;
  if(frameCount%240===0)console.log(`${stem}: ${frameCount} frames, ${(frameCount/fps).toFixed(0)} s of simulation`);
 });
 const url=new URL(base);url.searchParams.set('edition','foundation');url.searchParams.set('level',String(level));url.searchParams.set('pilot','progression');url.searchParams.set('debug','1');
 await page.goto(url.href,{waitUntil:'networkidle2'});
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready');
 await page.evaluate(()=>window.__NESI_DEMO_GAME__.renderer.setAnimationLoop(null));
 const info=await page.evaluate(async()=>{const response=await fetch('build-info.json',{cache:'no-store'});assertResponse(response);return response.json();
  function assertResponse(response){if(!response.ok)throw Error(`Build-info HTTP ${response.status}`);}});
 assert.equal(info.features.defaultEdition,'foundation');
 assert.equal(info.levels,51);
 if(process.env.BUILD_COMMIT)assert.equal(info.commit,process.env.BUILD_COMMIT);
 assert.equal(await page.evaluate(()=>window.__NESI_DEMO_GAME__.chamberEdition),'foundation');
 assert.equal(await page.$eval('#level-select',element=>Number(element.value)),level-1);
 const title=await page.$eval(`#level-select option[value="${level-1}"]`,element=>element.textContent.replace(/^\s*\d+\s*·\s*/, '').replace(/\s*✓\s*$/,'').trim());
 assert.ok(title,`Room ${level} needs a visible menu title`);
 await page.waitForFunction(()=>{const screen=document.querySelector('#start-screen');return !screen.inert&&getComputedStyle(screen).opacity==='1';});
 for(let attempt=0;attempt<3;attempt++){
  if(await page.evaluate(()=>window.__NESI_DEMO_GAME__?.state!=='ready'))break;
  await page.bringToFront();await page.$eval('#play-button',e=>e.scrollIntoView({block:'center'}));await page.focus('#play-button');await page.click('#play-button');
  await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state!=='ready',{timeout:12000}).catch(error=>{
   if(error.name!=='TimeoutError')throw error;
  });
 }
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='playing');
 const capture=await page.evaluate(async({level,stride,alternative})=>{
  const game=window.__NESI_DEMO_GAME__,g=game,original=game.updateVisuals,writeFrames=[],milestones=[],cameraSamples=[];
  const originalCargo=game.cargo,originalBody=game.physics.cargoBody,originalPlayer=game.playerVisual,sourceMeshes=[];
  originalPlayer.traverse(mesh=>{if(mesh.isMesh)sourceMeshes.push({mesh,geometry:mesh.geometry,vertices:mesh.geometry.attributes.position?.count||0,bones:mesh.skeleton?.bones.length||0});});
  const vertices=sourceMeshes.reduce((n,m)=>n+m.vertices,0),bones=Math.max(0,...sourceMeshes.map(m=>m.bones));
  if(vertices!==96753||bones!==15)throw Error('Exact original skinned player96753/15 required');
  const targetRegion={center:[9.926224685,6.28,-10.4976406],halfExtents:[1.15,.75,1.15],teleports:3};
  function measureBody(){
   g.render();
   // Measure the live skinned vertices of the actual rendered actor at each
   // encoded sample. No authored bounds proxy or actor/camera pose write.
   const bodyVertexProjection={vertices:0,minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity,
    minDepth:Infinity,behindCount:0,outsideLensCount:0,insideLens:false,
    source:'every live skinned original-player vertex at this actual native visual sample'};
   const vertex=g.playerPosition.clone(),viewVertex=g.playerPosition.clone();
   for(const row of sourceMeshes){
    row.mesh.skeleton?.update();
    for(let i=0;i<row.vertices;i++){
     row.mesh.getVertexPosition(i,vertex).applyMatrix4(row.mesh.matrixWorld);
     viewVertex.copy(vertex).applyMatrix4(g.camera.matrixWorldInverse);vertex.project(g.camera);
     if(![vertex.x,vertex.y,vertex.z,viewVertex.z].every(Number.isFinite))throw Error('Non-finite live vertex projection');
     bodyVertexProjection.vertices++;
     bodyVertexProjection.minX=Math.min(bodyVertexProjection.minX,vertex.x);bodyVertexProjection.maxX=Math.max(bodyVertexProjection.maxX,vertex.x);
     bodyVertexProjection.minY=Math.min(bodyVertexProjection.minY,vertex.y);bodyVertexProjection.maxY=Math.max(bodyVertexProjection.maxY,vertex.y);
     bodyVertexProjection.minDepth=Math.min(bodyVertexProjection.minDepth,-viewVertex.z);
     if(viewVertex.z>=0)bodyVertexProjection.behindCount++;
     if(viewVertex.z>=0||Math.abs(vertex.x)>1||Math.abs(vertex.y)>1||vertex.z< -1||vertex.z>1)bodyVertexProjection.outsideLensCount++;
    }
   }
   if(bodyVertexProjection.vertices!==vertices)throw Error('Encoded sample omitted original model vertices');
   bodyVertexProjection.insideLens=bodyVertexProjection.outsideLensCount===0;
   return {bodyVertexProjection};
  }

  game.renderer.setAnimationLoop(null);
  let visualFrame=0,encodedFrame=0,lastCapturedState=null;
  window.__NESI_CAPTURE_LEVEL_MARK__=mark=>milestones.push({...mark,encodedFrame:Math.max(0,encodedFrame-1)});
  game.updateVisuals=function(...args){
   const result=original.apply(this,args);
   if(args[0]>0){
    if(game.cargo!==originalCargo||game.physics.cargoBody!==originalBody||game.playerVisual!==originalPlayer||sourceMeshes.some(m=>m.mesh.geometry!==m.geometry))throw Error('Recording replaced original actors');
    if(visualFrame%stride===0){
     lastCapturedState=this.state;
     const {bodyVertexProjection}=measureBody();
     cameraSamples.push({encodedFrame,visualFrame,player:game.playerPosition.toArray(),teleports:game.teleportCount,camera:game.camera.position.toArray(),cameraFov:game.camera.fov,bodyVertexProjection});
     const state={visualFrame,level:this.levelIndex+1,state:this.state,cargoBodyId:this.physics.cargoBody.id};
     writeFrames.push(window.__NESI_WRITE_WALKTHROUGH_FRAME__(encodedFrame++,this.renderer.domElement.toDataURL('image/jpeg',.84),state));
    }
    visualFrame++;
   }
   return result;
  };
  try{
   const route=await window.__NESI_RUN_LEVEL_ROUTE__(alternative?{alternative}:{});
   // The route can finish between sampled frames. Capture its normal victory
   // presentation at the next regular configured capture sample without changing play.
   for(let n=0;n<stride&&lastCapturedState!=='won';n++)game.updateVisuals(1/60,1);
   await Promise.all(writeFrames);
   const outsideSamples=cameraSamples.filter(s=>!s.bodyVertexProjection.insideLens).map(s=>s.visualFrame);
   const gallerySamples=cameraSamples.filter(s=>level===50&&s.teleports===targetRegion.teleports&&targetRegion.center.every((c,i)=>Math.abs(s.player[i]-c)<=targetRegion.halfExtents[i]));
   const galleryTargetOutsideSamples=gallerySamples.filter(s=>!s.bodyVertexProjection.insideLens).map(s=>s.visualFrame);
   const cameraSampleReview={measuredVerticesPerSample:vertices,bones,sampleCount:cameraSamples.length,allSamplesInside:outsideSamples.length===0,outsideSamples,galleryApplicable:level===50,targetRegion,galleryTargetSampleCount:gallerySamples.length,galleryTargetOutsideSamples,samples:cameraSamples,pass:level!==50||(gallerySamples.length>=1&&galleryTargetOutsideSamples.length===0),scope:'Every actual encoded sample at the declared capture rate uses all original live skinned vertices. Closure is gated only in the fixed east-gallery region; unrecorded render frames, occlusion, devices and full camera acceptance are separate.'};
   return {route,milestones,cameraSampleReview,frames:encodedFrame,width:game.renderer.domElement.width,height:game.renderer.domElement.height,visualFrames:visualFrame};
  }finally{game.updateVisuals=original;delete window.__NESI_CAPTURE_LEVEL_MARK__;await Promise.allSettled(writeFrames);}
 },{level,stride,alternative});
 assert.equal(capture.route.pass,true,'The ordinary route must reach the exit');
 assert.equal(capture.cameraSampleReview.sampleCount,frameCount);assert.equal(capture.cameraSampleReview.pass,true,'Actual recorded east-gallery original body must remain within lens');
 assert.equal(capture.route.level,level);
 assert.equal(capture.route.resets,0);assert.equal(capture.route.respawns,0);
 if(alternative)assert.equal(capture.route.alternative,alternative,'The recording must execute the declared alternative');
 if(level===41){assert.equal(capture.route.cargoResets,0);assert.equal(capture.route.sameCompanion,true);assert.equal(capture.route.metrics.checkpoints,false);assert.equal(capture.route.metrics.completedStages,info.features.tower.stages);}
 assert.deepEqual(errors,[]);
 assert.equal(capture.width,size.width);assert.equal(capture.height,size.height);
 assert.equal(frameCount,capture.frames,'Every sampled frame must arrive before encoding');
 assert.ok(frameCount>fps*5,'A full room route must contain more than five seconds');
 assert.equal(firstFrame.visualFrame,0);
 assert.equal(lastFrame.state,'won','The completed frame must show victory');
 assert.ok(capture.milestones.length>0,'A complete route needs observed journey milestones');
 const firstFile=path.join(frameDir,'000000.jpg'),lastFile=path.join(frameDir,`${String(frameCount-1).padStart(6,'0')}.jpg`);
 // Check every native frame, including idle/moving intervals, before encoding.
 const pixelLog=path.join(out,`${stem}-native-pixels.txt`);
 assert.match(pixelLog,/^[A-Za-z0-9_./-]+$/,'Native-frame review path must be filter-safe');
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-framerate',String(fps),'-i',path.join(frameDir,'%06d.jpg'),
  '-vf',`scale=160:90,signalstats,metadata=mode=print:file=${pixelLog}`,'-f','null','-'],{timeout:180000,stdio:'inherit'});
 const pixelText=fs.readFileSync(pixelLog,'utf8');
 const minima=[...pixelText.matchAll(/lavfi\.signalstats\.YMIN=(\d+)/g)].map(m=>Number(m[1]));
 const maxima=[...pixelText.matchAll(/lavfi\.signalstats\.YMAX=(\d+)/g)].map(m=>Number(m[1]));
 assert.equal(minima.length,frameCount);assert.equal(maxima.length,frameCount);
 const ranges=maxima.map((value,index)=>value-minima[index]);
 assert.ok(ranges.every(value=>value>12),'Every native JPEG frame must have nonblank luminance variation');
 const pixelCheck={frames:frameCount,allNonblank:true,minimumLuminanceRange:Math.min(...ranges),method:'Every actual JPEG decoded by FFmpeg at 160×90; YMAX−YMIN > 12'};
 fs.rmSync(pixelLog);
 fs.copyFileSync(firstFile,path.join(out,`${stem}.jpg`));
 fs.copyFileSync(lastFile,path.join(out,`${stem}-finish.jpg`));
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-framerate',String(fps),'-i',path.join(frameDir,'%06d.jpg'),
  '-frames:v',String(frameCount),'-c:v','libx264','-preset','fast','-crf','27','-pix_fmt','yuv420p','-movflags','+faststart',
  '-threads','2','-an',movie],{timeout:900000,stdio:'inherit'});
 const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries',
  'stream=codec_name,width,height,avg_frame_rate,nb_frames,duration','-show_entries','format=duration,size','-of','json',movie],{encoding:'utf8'}));
 assert.equal(probe.streams?.[0]?.codec_name,'h264');
 assert.equal(probe.streams[0].width,size.width);assert.equal(probe.streams[0].height,size.height);
 assert.equal(Number(probe.streams[0].nb_frames),frameCount);
 const [rateNumerator,rateDenominator]=probe.streams[0].avg_frame_rate.split('/').map(Number);
 assert.ok(Number.isFinite(rateNumerator)&&Number.isFinite(rateDenominator)&&rateDenominator>0,'MP4 average frame rate must be finite');
 assert.ok(Math.abs(rateNumerator/rateDenominator-fps)<1e-9,'MP4 frame rate must match the declared capture rate');
 assert.ok(Math.abs(Number(probe.format.duration)-frameCount/fps)<.1,'MP4 duration must match the sampled route');
 const result={level,title:alternative?`${title} · Альтернативный путь`:title,...(alternative?{alternative}:{}),sourceCommit:info.commit,edition:'foundation',route:capture.route,frameCount,
  fps,width:size.width,height:size.height,durationSeconds:frameCount/fps,firstFrame,lastFrame,
  continuous:true,pixelCheck,cameraSampleReview:capture.cameraSampleReview,milestones:capture.milestones,sha256:bytesHash(movie),bytes:fs.statSync(movie).size,
  video:`${stem}.mp4`,poster:`${stem}.jpg`,finishPoster:`${stem}-finish.jpg`,
  method:`Production WebGL, normal third-person camera and ordinary input-only route, continuous ${fps} fps from 60 Hz visual/120 Hz physics simulation; silent recording, not measured hardware FPS or a human playtest.`};
 fs.writeFileSync(path.join(out,`${stem}.json`),JSON.stringify(result,null,2));
 fs.rmSync(frameDir,{recursive:true});
 console.log('WALKTHROUGH VERIFIED',JSON.stringify({level,frames:frameCount,durationSeconds:result.durationSeconds,bytes:result.bytes,sha256:result.sha256}));
}finally{await browser.close();}
