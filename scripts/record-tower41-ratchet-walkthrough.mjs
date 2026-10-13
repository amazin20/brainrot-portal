/** Continuous actual room41 canvas samples, including the ordinary freight
 * preparation. The bounded route ends playing; it does not declare a victory,
 * introduce padding, or claim the requested fifteen-minute master route. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {sha256,sourceIdentity,checkBuild,launchBrowser,startPreview,reviewURL,openQualification,observeTower41Route,assertObservedRoute,limitations} from './qa-tower41-ratchet-browser.mjs';

const identity=sourceIdentity(),{info,nativePackage}=checkBuild(),out=path.resolve(process.env.OUT_DIR||'qa/tower41-ratchet-walkthrough'),base=process.env.PAGE_URL||'http://127.0.0.1:4173/';
const scenario=process.env.SCENARIO||'qualification',fps=Number(process.env.CAPTURE_FPS||4),width=Number(process.env.CAPTURE_WIDTH||640),height=Number(process.env.CAPTURE_HEIGHT||360),stride=60/fps;
assert.ok(['qualification','held','fast-release','boarding'].includes(scenario));assert.ok([4,6,12].includes(fps));
assert.ok([width,height].every(v=>Number.isSafeInteger(v)&&v>=2&&v%2===0));
const stem='tower41-ratchet-'+scenario,frameDir=path.join(out,stem+'-frames'),movie=path.join(out,stem+'.mp4');fs.mkdirSync(frameDir,{recursive:true});
let server,browser,page,count=0,lastVisualFrame=-1,terminalSeen=false,cargoBodyId=null;const encodedSamples=[],errors=[];
const report={pass:false,level:41,...identity,scenario,nativePackage,limitations,errors,fullTowerAccepted:false,fullCameraAccepted:false,humanPlaytestAccepted:false,physicalDeviceAccepted:false,publicationAccepted:false};
const save=()=>fs.writeFileSync(path.join(out,stem+'.json'),JSON.stringify(report,null,2)+'\n');
try{
 server=await startPreview(base);browser=await launchBrowser();page=await browser.newPage();page.setDefaultTimeout(180000);await page.setViewport({width,height,deviceScaleFactor:1});page.on('pageerror',e=>errors.push(String(e)));
 await page.exposeFunction('__NESI_WRITE_RATCHET_FRAME__',(index,image,state)=>{
  assert.equal(index,count,'Actual encoded frame indices must be contiguous');assert.equal(state.encodedFrame,index);assert.equal(state.level,41);assert.equal(state.state,'playing');
  assert.equal(terminalSeen,false,'No encoded frame can follow the actual terminal sample');
  if(state.terminal){assert.ok(state.visualFrame>lastVisualFrame&&state.visualFrame<index*stride&&index*stride-state.visualFrame<stride);terminalSeen=true;}
  else assert.equal(state.visualFrame,index*stride,'Every regular capture interval must be retained');
  assert.ok(state.visualFrame>lastVisualFrame);lastVisualFrame=state.visualFrame;
  if(cargoBodyId===null)cargoBodyId=state.cargoBodyId;assert.equal(state.cargoBodyId,cargoBodyId);
  assert.equal(state.bodyVertexProjection.vertices,96753);assert.match(image,/^data:image\/jpeg;base64,/);
  const bytes=Buffer.from(image.slice(image.indexOf(',')+1),'base64');assert.equal(bytes[0],0xff);assert.equal(bytes[1],0xd8);assert.equal(bytes.at(-2),0xff);assert.equal(bytes.at(-1),0xd9);
  fs.writeFileSync(path.join(frameDir,String(index).padStart(6,'0')+'.jpg'),bytes);encodedSamples.push({index,visualFrame:state.visualFrame,terminal:state.terminal,bytes:bytes.length,sha256:sha256(bytes)});count++;
  if(count%120===0)console.log('TOWER41_RECORDING',JSON.stringify({encodedFrames:count,simulationSeconds:state.worldStep/120,visualFrame:state.visualFrame,held:state.held,solved:state.solved}));
 });
 await openQualification(page,reviewURL(base),info);
 report.observed=await page.evaluate(observeTower41Route,{scenario,record:true,stride,width,height});assertObservedRoute(report.observed,scenario);
 assert.equal(count,report.observed.encodedFrames);assert.equal(count,report.observed.cameraSamples.length);assert.equal(report.observed.lastEncodedVisual,report.observed.frames-1);
 assert.ok(count>fps*5,'The walkthrough must include the real approach and mechanism actions');assert.equal(report.observed.cameraSamples[0].visualFrame,0);assert.equal(report.observed.cameraSamples.at(-1).state,'playing');assert.deepEqual(errors,[]);
 const pixelLog=path.join(out,stem+'-native-pixels.txt');assert.match(pixelLog,/^[A-Za-z0-9_./-]+$/);
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-xerror','-framerate',String(fps),'-i',path.join(frameDir,'%06d.jpg'),'-vf',`scale=160:90,signalstats,metadata=mode=print:file=${pixelLog}`,'-f','null','-'],{timeout:180000,stdio:'inherit'});
 const pixelText=fs.readFileSync(pixelLog,'utf8'),minima=[...pixelText.matchAll(/lavfi\.signalstats\.YMIN=(\d+)/g)].map(m=>Number(m[1])),maxima=[...pixelText.matchAll(/lavfi\.signalstats\.YMAX=(\d+)/g)].map(m=>Number(m[1]));
 assert.equal(minima.length,count);assert.equal(maxima.length,count);const ranges=maxima.map((m,i)=>m-minima[i]);assert.ok(ranges.every(n=>n>12),'Every actual native sample must have nonblank luminance variation');fs.rmSync(pixelLog);
 for(const [name,index]of [['start',0],['middle',Math.floor(count/2)],['finish',count-1]])fs.copyFileSync(path.join(frameDir,String(index).padStart(6,'0')+'.jpg'),path.join(out,stem+'-'+name+'.jpg'));
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-xerror','-y','-framerate',String(fps),'-i',path.join(frameDir,'%06d.jpg'),'-frames:v',String(count),'-c:v','libx264','-preset','fast','-crf','27','-pix_fmt','yuv420p','-movflags','+faststart','-threads','2','-an',movie],{timeout:900000,stdio:'inherit'});
 const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=codec_name,width,height,avg_frame_rate,nb_frames,duration','-show_entries','format=duration,size','-of','json',movie],{encoding:'utf8'}));
 assert.equal(probe.streams?.[0]?.codec_name,'h264');assert.equal(probe.streams[0].width,width);assert.equal(probe.streams[0].height,height);assert.equal(Number(probe.streams[0].nb_frames),count);assert.equal(probe.streams[0].avg_frame_rate,`${fps}/1`);
 const duration=count/fps,durationToleranceSeconds=2/fps+1/120+.01;assert.ok(Math.abs(Number(probe.format.duration)-duration)<.1);assert.ok(Math.abs(duration-report.observed.seconds)<=durationToleranceSeconds,'Video must retain the declared1× simulation duration without padding');
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-xerror','-i',movie,'-f','null','-'],{timeout:300000,stdio:'inherit'});
 const bytes=fs.readFileSync(movie);assert.equal(Number(probe.format.size),bytes.length);
 report.video={filename:path.basename(movie),bytes:bytes.length,sha256:sha256(bytes),frames:count,fps,stride,width,height,durationSeconds:duration,durationToleranceSeconds,simulationSeconds:report.observed.seconds,preparationFrames:report.observed.route.preparation.frames,localFrames:report.observed.route.frames,lastVisualFrame:report.observed.frames-1,terminalSample:terminalSeen,nativeCanvas:{width,height},first:report.observed.cameraSamples[0],last:report.observed.cameraSamples.at(-1),pixelCheck:{frames:count,allNonblank:true,minimumLuminanceRange:Math.min(...ranges),fullMP4Decode:true},encodedSamples};
 report.pass=true;save();fs.rmSync(frameDir,{recursive:true});console.log('TOWER41_MOVIE',JSON.stringify({pass:true,sourceCommit:identity.sourceCommit,scenario,frames:count,durationSeconds:duration,sha256:report.video.sha256,fullTowerAccepted:false}));
}catch(error){report.failure=String(error?.stack||error);report.detail=page?await page.evaluate(()=>window.__NESI_RATCHET_FAILURE__||null).catch(()=>null):null;save();throw error;}
finally{await browser?.close();server?.kill();}
