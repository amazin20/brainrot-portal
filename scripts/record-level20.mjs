import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn, execFileSync} from 'node:child_process';
import {once} from 'node:events';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');

const FPS=Number(process.env.CAPTURE_FPS||15);
assert.ok(FPS===15||FPS===30,'CAPTURE_FPS must be 15 or 30');
const STEP=60/FPS, WIDTH=1280, HEIGHT=800;
const ROOT=process.env.PAGE_URL||'http://127.0.0.1:4173/';
const OUTPUT=path.resolve(process.env.OUTPUT_VIDEO||process.env.VIDEO_OUT||'/workspace/scratch/9ec00ebc2e4d/level-20-walkthrough.mp4');
const REPORT=path.resolve(process.env.OUTPUT_REPORT||process.env.REPORT_OUT||'/tmp/level20-record-report.json');
const REPO=path.resolve(process.env.GAME_SOURCE_DIR||process.cwd());
const EXPECTED=process.env.SOURCE_COMMIT||process.env.GAME_COMMIT||'1ee48a5383db71227773e54bfce92e1d7ff1cf32';
const PROGRESS=Number(process.env.PROGRESS_EVERY||150);
const HOLD_FRAMES=2*FPS;
const BINDING='__NESI_FULL_ROUTE_CAPTURE__';
const startedAt=Date.now();
const report={pass:false,status:'starting',sourceCommit:EXPECTED,sourceTree:null,buildInfo:null,
  page:ROOT,level:20,width:WIDTH,height:HEIGHT,fps:FPS,jpegQuality:.92,
  method:'Continuous native game-canvas frames from the complete ordinary level route. Standard third-person camera; game simulation at 60 Hz and physics at 120 Hz; captured at the specified simulation FPS. No actor/mechanism state or win flags injected.',
  audio:'No audio track: deterministic offline simulation capture.',
  startHoldSeconds:2,endHoldSeconds:2,routeFrames:0,totalVideoFrames:0,simulationUpdates:0,
  lastSimulationTime:0,marks:[],browserErrors:[],maxEncoderBufferBytes:0,output:OUTPUT,
  startedAt:new Date(startedAt).toISOString()};
let browser,context,page,cdp,encoder,encoderExit,encoderFailure,streamFailure;
let done=false,ffmpegLog='',heartbeat;
fs.mkdirSync(path.dirname(OUTPUT),{recursive:true});fs.mkdirSync(path.dirname(REPORT),{recursive:true});
const shotDir=path.resolve(process.env.CAPTURE_CHECKFRAMES_DIR||path.join(path.dirname(OUTPUT),'checkframes'));fs.mkdirSync(shotDir,{recursive:true});
function checkpoint(){
  report.elapsedWallSeconds=+(Date.now()/1000-startedAt/1000).toFixed(1);
  fs.writeFileSync(REPORT+'.tmp',JSON.stringify(report,null,2));fs.renameSync(REPORT+'.tmp',REPORT);
}
function progress(kind='progress'){
  checkpoint();console.log(JSON.stringify({kind,status:report.status,routeFrames:report.routeFrames,
    totalVideoFrames:report.totalVideoFrames,simulationSeconds:+report.lastSimulationTime.toFixed(2),
    elapsedWallSeconds:report.elapsedWallSeconds,encoderBufferBytes:encoder?.stdin.writableLength||0,
    lastMark:report.marks.at(-1)?.name??null}));
}
function sendFrame(bytes){
  if(encoderFailure||streamFailure)throw encoderFailure||streamFailure;
  encoder.stdin.write(bytes);
  report.totalVideoFrames++;
  report.maxEncoderBufferBytes=Math.max(report.maxEncoderBufferBytes,encoder.stdin.writableLength);
  // Encoding should outrun SwiftShader. Refuse unbounded host buffering if it does not.
  if(encoder.stdin.writableLength>256*1024*1024)throw Error('Encoder backlog exceeded 256 MB');
}
async function sendHold(bytes){
  for(let n=0;n<HOLD_FRAMES;n++){
    sendFrame(bytes);
    if(encoder.stdin.writableNeedDrain)await once(encoder.stdin,'drain');
  }
}
function discoverChrome(){
  if(process.env.CHROME_PATH)return process.env.CHROME_PATH;
  const candidates=['/tmp/level20-browser/chrome-linux64/chrome','/tmp/level20-browser/chrome-linux/chrome',
    '/tmp/level20-browser/chrome','/usr/bin/google-chrome','/usr/bin/chromium'];
  for(const candidate of candidates)if(fs.existsSync(candidate))return candidate;
  throw Error('Set CHROME_PATH to the downloaded Chromium executable');
}
async function terminateCapture(error){
  streamFailure??=error;
  try{await cdp?.send('Runtime.terminateExecution');}catch{}
}
try{
  const actualCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:REPO,encoding:'utf8'}).trim();
  report.recordingCommit=actualCommit;
  report.sourceTree=execFileSync('git',['rev-parse',EXPECTED+'^{tree}'],{cwd:REPO,encoding:'utf8'}).trim();
  const gamePaths=['src','public','package.json','package-lock.json','vite.config.js'];
  execFileSync('git',['diff','--exit-code',EXPECTED,'--',...gamePaths],{cwd:REPO,encoding:'utf8'});
  report.sourceWorkingTree=execFileSync('git',['status','--porcelain','--untracked-files=no','--',...gamePaths],{cwd:REPO,encoding:'utf8'}).trim();
  assert.equal(report.sourceWorkingTree,'','Game source must have no tracked modifications');
  const metadata=await fetch(new URL('build-info.json',ROOT),{signal:AbortSignal.timeout(15000)});
  if(metadata.ok){
    const type=metadata.headers.get('content-type')||'';
    if(type.includes('json')){
      report.buildInfo=await metadata.json();
      const buildCommit=report.buildInfo.commit??report.buildInfo.sourceCommit;
      if(buildCommit)assert.equal(buildCommit,EXPECTED,'Served build metadata must match the recorded source');
    }
  }
  const executablePath=discoverChrome();report.browserExecutable=executablePath;
  browser=await chromium.launch({executablePath,headless:true,timeout:120000,
    args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader',
      '--disable-background-timer-throttling','--disable-renderer-backgrounding']});
  context=await browser.newContext({viewport:{width:WIDTH,height:HEIGHT},deviceScaleFactor:1});
  page=await context.newPage();page.setDefaultTimeout(120000);page.setDefaultNavigationTimeout(120000);
  page.on('pageerror',error=>{report.browserErrors.push(String(error));console.error('Browser error:',String(error));});
  cdp=await context.newCDPSession(page);await cdp.send('Runtime.enable');
  await cdp.send('Runtime.addBinding',{name:BINDING});
  cdp.on('Runtime.bindingCalled',event=>{
    if(event.name!==BINDING||streamFailure)return;
    try{
      const item=JSON.parse(event.payload);
      if(item.kind==='mark'){
        report.marks.push({...item,videoSeconds:2+item.update/60});delete report.marks.at(-1).kind;
        progress('milestone');return;
      }
      if(item.kind!=='frame')throw Error('Unknown capture binding message');
      assert.equal(item.index,report.routeFrames,'Capture frame sequence must be contiguous');
      const bytes=Buffer.from(item.jpeg,'base64');
      sendFrame(bytes);report.routeFrames++;report.simulationUpdates=item.update;
      report.lastSimulationTime=item.update/60;
      if(item.index===0||item.index%(FPS*30)===0)fs.writeFileSync(path.join(shotDir,`route-${String(item.index).padStart(6,'0')}.jpg`),bytes);
      if(report.routeFrames%PROGRESS===0)progress();
    }catch(error){console.error('Capture stream failure:',error);void terminateCapture(error);}
  });
  const url=new URL(ROOT);url.searchParams.set('debug','1');url.searchParams.set('level','20');
  report.url=url.href;await page.goto(url.href,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready');
  assert.equal(await page.evaluate(()=>window.__NESI_DEMO_GAME__.levelIndex),19);
  await page.click('#play-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.state==='playing');
  await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop(null);g.resetRun(true);g.render();});
  await page.waitForFunction(()=>[...document.querySelectorAll('.screen')].every(e=>getComputedStyle(e).opacity==='0'));
  const initial=await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;return {state:g.state,level:g.levelIndex+1,
    player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),elapsedMs:g.elapsed,
    canvasWidth:g.renderer.domElement.width,canvasHeight:g.renderer.domElement.height,
    camera:{position:g.camera.position.toArray(),quaternion:g.camera.quaternion.toArray()}};});
  assert.equal(initial.canvasWidth,WIDTH);assert.equal(initial.canvasHeight,HEIGHT);report.initial=initial;
  const initialJPEG=await page.screenshot({type:'jpeg',quality:92,path:path.join(shotDir,'start.jpg')});
  encoder=spawn(process.env.FFMPEG_PATH||'ffmpeg',['-hide_banner','-loglevel','warning','-y',
    '-f','image2pipe','-framerate',String(FPS),'-vcodec','mjpeg','-i','pipe:0',
    '-an','-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p',
    '-movflags','+faststart',OUTPUT],{stdio:['pipe','ignore','pipe']});
  encoder.stdin.on('error',error=>{streamFailure??=error;void terminateCapture(error);});
  encoder.stderr.on('data',chunk=>{ffmpegLog=(ffmpegLog+chunk.toString()).slice(-12000);});
  encoderExit=new Promise((resolve,reject)=>{
    encoder.on('error',error=>{encoderFailure=error;reject(error);void terminateCapture(error);});
    encoder.on('close',(code,signal)=>{
      if(code===0)resolve();else{const error=Error(`ffmpeg exited ${code??signal}: ${ffmpegLog}`);encoderFailure=error;reject(error);void terminateCapture(error);}
    });
  });
  // Keep encoder rejection handled until the main recording flow awaits it.
  encoderExit.catch(()=>{});
  await sendHold(initialJPEG);report.status='recording';progress('started');
  heartbeat=setInterval(()=>progress('heartbeat'),30000);heartbeat.unref();
  // Playwright evaluation deliberately has no short test timeout. The route can
  // take much longer than real time on a software renderer. It streams each
  // captured JPEG through a raw CDP binding instead of retaining frames in JS.
  const capture=await page.evaluate(async ({step,bindingName})=>{
    const g=window.__NESI_DEMO_GAME__,originalVisuals=g.updateVisuals,originalRender=g.render;
    const oldMark=window.__NESI_CAPTURE_LEVEL_MARK__;let updates=0,frames=0;
    window.__NESI_CAPTURE_LEVEL_MARK__=mark=>{
      window[bindingName](JSON.stringify({kind:'mark',...mark,update:updates,elapsedMs:g.elapsed,captureFrames:frames}));
      oldMark?.(mark);
    };
    g.updateVisuals=function(...args){
      const result=originalVisuals.apply(this,args);
      if(args[0]>0){
        updates++;
        if((updates-1)%step===0){
          originalRender.call(this);
          const jpeg=this.renderer.domElement.toDataURL('image/jpeg',.92).split(',')[1];
          window[bindingName](JSON.stringify({kind:'frame',index:frames++,update:updates,elapsedMs:this.elapsed,jpeg}));
        }
      }
      return result;
    };
    try{
      const route=await window.__NESI_RUN_LEVEL_ROUTE__();
      return {route,frames,updates,state:g.state,elapsedMs:g.elapsed,player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),
        heldCube:!!g.heldCube,level:g.levelIndex+1};
    }finally{
      g.updateVisuals=originalVisuals;
      if(oldMark===undefined)delete window.__NESI_CAPTURE_LEVEL_MARK__;else window.__NESI_CAPTURE_LEVEL_MARK__=oldMark;
      originalRender.call(g);
    }
  },{step:STEP,bindingName:BINDING});
  assert.equal(streamFailure,undefined);
  // Runtime binding events precede this evaluation's result on the same CDP
  // connection; allow an event-loop turn before the final count assertion.
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(report.routeFrames,capture.frames,'All streamed route frames must reach the encoder');
  assert.equal(capture.frames,Math.ceil(capture.updates/STEP));
  assert.equal(capture.route.frames,capture.updates,'Every game simulation update must be accounted for');
  assert.equal(capture.route.pass,true);assert.equal(capture.route.resets,0);assert.equal(capture.route.respawns,0);
  assert.equal(capture.state,'won');assert.equal(capture.level,20);assert.deepEqual(report.browserErrors,[]);
  report.route=capture.route;report.final=capture;delete report.final.route;
  report.simulationUpdates=capture.updates;report.lastSimulationTime=capture.updates/60;
  report.simulatedRouteSeconds=capture.updates/60;report.status='finalizing';progress('route-complete');
  await page.waitForFunction(()=>{const e=document.querySelector('#win-screen');return e?.classList.contains('screen--active')&&getComputedStyle(e).opacity==='1';});
  const finalJPEG=await page.screenshot({type:'jpeg',quality:92,path:path.join(shotDir,'complete.jpg')});
  await sendHold(finalJPEG);encoder.stdin.end();await encoderExit;
  const probe=JSON.parse(execFileSync(process.env.FFPROBE_PATH||'ffprobe',['-v','error','-show_streams','-show_format','-of','json',OUTPUT],{encoding:'utf8'}));
  const video=probe.streams.find(s=>s.codec_type==='video');assert.ok(video);
  assert.equal(video.codec_name,'h264');assert.equal(video.pix_fmt,'yuv420p');assert.equal(video.width,WIDTH);assert.equal(video.height,HEIGHT);
  assert.equal(Number(video.nb_frames),report.totalVideoFrames);
  report.video={bytes:fs.statSync(OUTPUT).size,frames:Number(video.nb_frames),duration:Number(probe.format.duration),
    width:video.width,height:video.height,codec:video.codec_name,pixelFormat:video.pix_fmt,rFrameRate:video.r_frame_rate};
  report.ffmpegWarnings=ffmpegLog;report.checkframes=shotDir;report.pass=true;report.status='complete';done=true;progress('complete');
}catch(error){
  report.status='failed';report.error=String(error?.stack||error);report.ffmpegWarnings=ffmpegLog;
  checkpoint();console.error(report.error);process.exitCode=1;
}finally{
  if(heartbeat)clearInterval(heartbeat);
  if(!done&&encoder&&!encoder.killed){encoder.stdin.destroy();encoder.kill('SIGTERM');}
  if(browser){
    const closed=browser.close().catch(()=>{});
    await Promise.race([closed,new Promise(resolve=>setTimeout(resolve,10000))]);
  }
  checkpoint();
}
