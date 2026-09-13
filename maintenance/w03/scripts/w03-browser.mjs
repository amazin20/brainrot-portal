import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import puppeteer from 'puppeteer-core';
const scenario=process.env.W03_SCENARIO||'cargo-first';
assert.ok(['cargo-first','scout-first','recovery'].includes(scenario));
const record=process.env.W03_VIDEO==='1',out=process.env.EVIDENCE_OUT||`smoke-artifacts/w03-${scenario}`;
fs.mkdirSync(out,{recursive:true});
const result={commit:process.env.BUILD_COMMIT||null,scenario,scope:'Ordinary room21 commands; actual Chromium WebGL, same companion; not a human difficulty or physical-device benchmark.',
 video:record?{width:1280,height:720,encodedFps:30,physicsHz:120,displayUpdateHz:60,audio:false,method:'Sequential native WebGL frames encoded with WebCodecs VP8. No wall-clock time-lapse or dropped-frame resampling.'}:null,errors:[],milestones:[]};
const movieRaw=path.join(out,'route.ivf');let packets=0,marks=0;
function header(count){const b=Buffer.alloc(32);b.write('DKIF');b.writeUInt16LE(32,6);b.write('VP80',8);b.writeUInt16LE(1280,12);b.writeUInt16LE(720,14);b.writeUInt32LE(30,16);b.writeUInt32LE(1,20);b.writeUInt32LE(count,24);return b;}
if(record)fs.writeFileSync(movieRaw,header(0));
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,protocolTimeout:1800000,
 args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage();await page.setViewport({width:1280,height:720,deviceScaleFactor:1});page.setDefaultTimeout(120000);
 page.on('pageerror',e=>result.errors.push(e.message));
 await page.exposeFunction('__W03_WRITE_CHUNKS__',chunks=>{
  for(const chunk of chunks){const index=Math.round(chunk.timestamp*30/1e6);assert.equal(index,packets,'Native video frames must be sequential');
   const bytes=Buffer.from(chunk.bytes,'base64'),h=Buffer.alloc(12);h.writeUInt32LE(bytes.length);h.writeBigUInt64LE(BigInt(index),4);fs.appendFileSync(movieRaw,Buffer.concat([h,bytes]));packets++;}
 });
 await page.exposeFunction('__W03_MARK__',(mark,png)=>{
  const file=`${String(marks++).padStart(2,'0')}.png`;fs.writeFileSync(path.join(out,file),Buffer.from(png.split(',')[1],'base64'));
  result.milestones.push({...mark,file});console.log('MARK',mark.name,mark.player);
 });
 const url=new URL(process.env.PAGE_URL||'http://127.0.0.1:4173/');url.searchParams.set('debug','1');url.searchParams.set('level','21');
 await page.goto(url.href,{waitUntil:'networkidle2'});await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready');
 await page.click('#play-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='playing');
 result.runtime=await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop(null);return{quality:g.quality,loading:g.loadingProfile,models:g.assets.size,canvas:[g.renderer.domElement.width,g.renderer.domElement.height]};});
 assert.deepEqual(result.runtime.canvas,[1280,720]);
 await page.screenshot({path:path.join(out,'start.png')});
 result.route=await page.evaluate(async({record,scenario})=>{
  const game=window.__NESI_DEMO_GAME__;let encoder,failure=null,encoded=0,outputs=0,chunks=[];
  const base64=data=>{let s='';for(let i=0;i<data.length;i+=32768)s+=String.fromCharCode(...data.subarray(i,i+32768));return btoa(s);};
  const send=async()=>{if(chunks.length){const batch=chunks;chunks=[];await window.__W03_WRITE_CHUNKS__(batch);}};
  const capture=async()=>{
   if(!record)return;
   if(failure)throw failure;
   game.render();const frame=new VideoFrame(game.renderer.domElement,{timestamp:Math.round(encoded*1e6/30)});
   try{encoder.encode(frame,{keyFrame:encoded%60===0});encoded++;}finally{frame.close();}
   if(encoder.encodeQueueSize>6||encoded%60===0){await encoder.flush();await send();}
  };
  if(record){
   if(typeof VideoEncoder!=='function')throw Error('WebCodecs unavailable: cannot claim complete video');
   const config={codec:'vp8',width:1280,height:720,bitrate:4000000,framerate:30,latencyMode:'realtime'};
   const support=await VideoEncoder.isConfigSupported(config);if(!support.supported)throw Error('VP8 encoding unavailable');
   encoder=new VideoEncoder({output:chunk=>{const data=new Uint8Array(chunk.byteLength);chunk.copyTo(data);chunks.push({timestamp:chunk.timestamp,bytes:base64(data)});outputs++;},error:e=>{failure=e;}});
   encoder.configure(config);
  }
  try{
   const options=scenario==='recovery'?{recovery:true,interrupt:true,eraseInFlight:true}:{order:scenario};
   const route=await window.__NESI_RUN_ROOM21_RECORDED__({...options,
    onFrame:async frame=>{if(frame%2===0)await capture();else if(!record&&frame%240===1)await new Promise(r=>setTimeout(r,0));},
    onMilestone:async mark=>{game.render();await window.__W03_MARK__(mark,game.renderer.domElement.toDataURL('image/png'));}});
   if(record){if(route.frames%2)await capture();await encoder.flush();await send();if(failure)throw failure;if(outputs!==encoded)throw Error(`Video lost frames ${outputs}/${encoded}`);route.videoFrames=encoded;}
   return route;
  }finally{encoder?.close();}
 },{record,scenario});
 assert.ok(result.route.pass);assert.equal(result.route.respawns,0);assert.equal(result.route.resets,0);
 assert.equal(await page.evaluate(()=>window.__NESI_DEMO_GAME__.state),'won');
 await page.screenshot({path:path.join(out,'joint-exit.png')});
 assert.deepEqual(result.errors,[]);
 if(record){
  assert.equal(packets,result.route.videoFrames);const fd=fs.openSync(movieRaw,'r+');fs.writeSync(fd,header(packets),0,32,0);fs.closeSync(fd);
  const mp4=path.join(out,'room21-'+scenario+'.mp4');
  execFileSync('ffmpeg',['-y','-loglevel','error','-i',movieRaw,'-c:v','libx264','-preset','fast','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',mp4]);
  const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=width,height,nb_read_frames,r_frame_rate:format=duration','-of','json',mp4],{encoding:'utf8'}));
  assert.equal(Number(probe.streams[0].nb_read_frames),packets);assert.equal(probe.streams[0].width,1280);assert.equal(probe.streams[0].height,720);
  result.video={...result.video,frames:packets,duration:Number(probe.format.duration),sha256:crypto.createHash('sha256').update(fs.readFileSync(mp4)).digest('hex'),file:path.basename(mp4)};
 }
 result.pass=true;
}catch(error){result.failure=error.stack;throw error;}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(result,null,2));await browser.close();}
