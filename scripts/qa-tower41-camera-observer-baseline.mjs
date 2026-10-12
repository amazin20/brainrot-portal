import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import puppeteer from 'puppeteer-core';
import {createTower41CameraObserverApi,TOWER41_CAMERA_OBSERVER_BROWSER_FACTORY} from './lib/tower41-camera-observer.mjs';
import {packageFiles,walkFiles} from './lib/release-manifest.mjs';
import {waitForStartMenu,playFromStartMenu} from './lib/singularity-ui-check.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const out=path.resolve(process.env.OUT_DIR||'qa/tower41-camera-observer-diagnostic');fs.mkdirSync(out,{recursive:true});
const pins=createTower41CameraObserverApi().PINS;
const frozenSource=read('qa/tower41-frozen-build/source.json'),frozenPackage=read('qa/tower41-frozen-build/package.json');
const info=read('dist/build-info.json'),sourceIdentity={...frozenSource,packageFilesSha256:frozenPackage.nativePackage.packageFilesSha256};
createTower41CameraObserverApi().validateIdentity(sourceIdentity,info);
assert.equal(sha(fs.readFileSync('dist/build-info.json')),frozenPackage.buildInfoSha256);
assert.deepEqual(packageFiles('dist'),frozenPackage.nativePackage.files,'Every frozen production package byte must match the accepted source receipt');
assert.equal(sha(JSON.stringify(packageFiles('dist'))),pins.packageFilesSha256);
assert.deepEqual(walkFiles('dist').map(file=>path.relative('dist',file).split(path.sep).join('/')).sort(),[...frozenPackage.nativePackage.files.map(file=>file.path),'build-info.json'].sort(),'No unreviewed package member may be served');
for(const [file,hash]of [['src/game/LabCamera.js','cd40640dafb2897a4a892e369eb77ec05114b6118bf5a01c946c978a3d324e1f'],['src/game/LabSingularityJourney.js',pins.journeySha256],['scripts/singularity-browser.mjs',pins.browserSeamSha256]])assert.equal(sha(fs.readFileSync(file)),hash,'Baseline game/camera/driver must stay frozen: '+file);
assert.match(process.env.GITHUB_SHA||'',/^[a-f0-9]{40}$/,'Actual diagnostic workflow commit required');
const harnessFiles=['.github/workflows/tower41-camera-observer-diagnostic.yml','scripts/qa-tower41-camera-observer-baseline.mjs','scripts/lib/tower41-camera-observer.mjs'].map(file=>({file,bytes:fs.statSync(file).size,sha256:sha(fs.readFileSync(file))}));
const identity={kind:'frozen-source-camera-diagnostic',diagnosticCommit:process.env.GITHUB_SHA,diagnosticRun:{runId:Number(process.env.GITHUB_RUN_ID),runAttempt:Number(process.env.GITHUB_RUN_ATTEMPT)},sourceIdentity,buildInfoSha256:frozenPackage.buildInfoSha256,harnessFiles};
fs.writeFileSync(path.join(out,'identity.json'),JSON.stringify(identity,null,2)+'\n');
const width=640,height=360,fps=4,stride=15,movie=path.join(out,'tower41-frozen-pendulum-prefix.mp4');
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH,headless:true,protocolTimeout:5_400_000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const encoder=spawn('ffmpeg',['-y','-hide_banner','-loglevel','error','-f','image2pipe','-vcodec','mjpeg','-framerate',String(fps),'-i','pipe:0','-an','-c:v','libx264','-preset','veryfast','-crf','25','-pix_fmt','yuv420p','-movflags','+faststart',movie],{stdio:['pipe','ignore','pipe']});
encoder.stderr.on('data',b=>process.stderr.write(b));const encoderExit=once(encoder,'exit');
let page,count=0,lastFrame=-1,terminal=false,first=null,last=null;
const errors=[];
try{
 page=await browser.newPage();page.setDefaultTimeout(180000);await page.setViewport({width,height,deviceScaleFactor:1});page.on('pageerror',error=>errors.push(String(error)));
 await page.evaluateOnNewDocument(()=>localStorage.setItem('brainrot-tower41-native-v2:brainrot-portal.preferences.v24',JSON.stringify({quality:'low',muted:true,tutorial:true,completed:[],hints:{},resumeLevel:40})));
 await page.exposeFunction('__CAMERA_OBSERVER_WRITE__',async batch=>{
  for(const item of batch){assert.equal(item.index,count,'Complete real native capture order required');assert.equal(terminal,false);if(item.terminal){assert.ok(item.visualFrame>lastFrame&&item.visualFrame<count*stride);terminal=true;}else assert.equal(item.visualFrame,count*stride);lastFrame=item.visualFrame;const bytes=Buffer.from(item.jpeg.slice(item.jpeg.indexOf(',')+1),'base64');if(!encoder.stdin.write(bytes))await once(encoder.stdin,'drain');first??=item.state;last=item.state;count++;}
  if(count%120===0)console.log('CAMERA_PREFIX_CAPTURE',count/fps,'seconds',last.solved.length,'machines');
 });
 const url=new URL(process.env.PAGE_URL||'http://127.0.0.1:4173/brainrot-portal/tower41-native-v2/');url.searchParams.set('debug','1');
 await page.goto(url.href,{waitUntil:'domcontentloaded'});await waitForStartMenu(page);const actualBuild=await page.evaluate(async()=>{const r=await fetch('build-info.json',{cache:'no-store'});if(!r.ok)throw Error('Missing actual build-info');return r.json();});assert.deepEqual(actualBuild,info);await playFromStartMenu(page,false,'low');
 await page.evaluate(()=>window.__NESI_DEMO_GAME__.renderer.setAnimationLoop(null));
 const observed=await page.evaluate(async({factoryText,sourceIdentity,buildInfo,width,height,stride})=>{
  const g=window.__NESI_DEMO_GAME__,api=(0,eval)('('+factoryText+')')();
  if(g.renderer.domElement.width!==width||g.renderer.domElement.height!==height)throw Error('Exact native canvas required');
  const observer=await api.install({game:g,sourceIdentity,buildInfo,options:{width,height}}),body=g.physics.cargoBody.id;
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{alpha:false});let frames=0,encoded=0,batch=[],lastCaptured=-1;
  const originalFrame=window.__SINGULARITY_FRAME__,originalFlush=window.__SINGULARITY_FLUSH__;
  const capture=(state,terminal=false)=>{
   if(g.renderer.domElement.width!==width||g.renderer.domElement.height!==height)throw Error('Native canvas changed');
   g.render();ctx.drawImage(g.renderer.domElement,0,0);const index=encoded++,jpeg=canvas.toDataURL('image/jpeg',.83);
   observer.bindEncodedSample({encodedFrame:index,visualFrame:frames,terminal});batch.push({index,visualFrame:frames,terminal,jpeg,state});lastCaptured=frames;
  };
  const captureHook=async state=>{if(state.cargoBodyId!==body)throw Error('Original body replaced');frames=state.visualFrame;if(frames%stride===0)capture(state);};
  const frameHook=observer.wrapFrameHook(captureHook),flush=async()=>{if(batch.length){const pending=batch;batch=[];await window.__CAMERA_OBSERVER_WRITE__(pending);}};
  observer.attachCallObservers();window.__SINGULARITY_FRAME__=frameHook;window.__SINGULARITY_FLUSH__=flush;
  try{
   const result=await window.__NESI_RUN_LEVEL_ROUTE__({stopAfter:'pendulum'});
   if(lastCaptured<result.frames-1){frames=result.frames-1;capture({state:g.state,player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),solved:g.firstLevel.getTowerMetrics().solvedIds,cargoBodyId:body,visualFrame:frames,seconds:result.seconds},true);}
   await flush();const observation=await observer.finish(result);return {result,observation,encodedFrames:encoded,nativeCanvas:{width:g.renderer.domElement.width,height:g.renderer.domElement.height}};
  }catch(error){window.__CAMERA_OBSERVER_FAILURE__={error:String(error),route:error.singularityReport??null,observerStatus:observer.status()};throw error;}
  finally{if(window.__SINGULARITY_FRAME__===frameHook)window.__SINGULARITY_FRAME__=originalFrame;if(window.__SINGULARITY_FLUSH__===flush)window.__SINGULARITY_FLUSH__=originalFlush;observer.dispose();}
 },{factoryText:TOWER41_CAMERA_OBSERVER_BROWSER_FACTORY,sourceIdentity,buildInfo:info,width,height,stride});
 encoder.stdin.end();const [exitCode]=await encoderExit;assert.equal(exitCode,0);assert.equal(count,observed.encodedFrames);assert.equal(observed.result.partial,true);assert.equal(observed.result.pass,false);assert.equal(last.state,'playing');assert.deepEqual(errors,[]);
 const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',movie],{encoding:'utf8'})),video=probe.streams.find(s=>s.codec_type==='video');assert.equal(video.codec_name,'h264');assert.equal(video.width,width);assert.equal(video.height,height);assert.equal(Number(video.nb_frames),count);assert.equal(video.avg_frame_rate,`${fps}/1`);assert.ok(Math.abs(Number(probe.format.duration)-count/fps)<.12);execFileSync('ffmpeg',['-v','error','-xerror','-i',movie,'-f','null','-'],{stdio:['ignore','ignore','pipe']});
 const report={...identity,runtimeObserved:true,diagnosticDataIntegrityPassed:true,accepted:false,knownSourceCropClosed:false,fullRoomAccepted:false,allCameraAccepted:false,...observed,errors,video:{file:path.basename(movie),bytes:fs.statSync(movie).size,sha256:sha(fs.readFileSync(movie)),width,height,fps,stride,frames:count,durationSeconds:count/fps,simulationSeconds:observed.result.seconds,lastVisualFrame:lastFrame,terminalCapture:terminal,fullMP4Decode:true,first,last},scope:'Actual frozen SOURCE native animated nine-machine ordinary prefix through Play, complete unpadded prefix video and read-only selected optical data; a diagnostic, not a completed castle, correction, device, occlusion or human acceptance.'};
 fs.writeFileSync(path.join(out,'observation.json'),JSON.stringify(report,null,2)+'\n');fs.writeFileSync(path.join(out,'ffprobe.json'),JSON.stringify(probe,null,2)+'\n');console.log('TOWER41_CAMERA_DIAGNOSTIC',JSON.stringify({dataIntegrityPassed:true,sourceCommit:sourceIdentity.sourceCommit,diagnosticCommit:identity.diagnosticCommit,frames:observed.result.frames,selectedSamples:observed.observation.records.length,selectedOutside:observed.observation.selectedSamplesOutside,videoFrames:count,knownSourceCropClosed:false}));
}catch(error){const detail=page?await page.evaluate(()=>window.__CAMERA_OBSERVER_FAILURE__||null).catch(()=>null):null;fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({error:String(error),detail,identity,errors,encodedFrames:count,lastVisualFrame:lastFrame},null,2)+'\n');throw error;}
finally{if(!encoder.stdin.writableEnded)encoder.stdin.end();await encoderExit.catch(()=>{});await browser.close();}
