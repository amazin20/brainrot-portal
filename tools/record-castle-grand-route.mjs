// Silent proof video from actual native game pixels. Simulation time is never
// skipped, delayed or padded; sampled frames retain their physical-step log.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {campaignAccessFixture} from '../scripts/lib/campaign-access-fixture.mjs';
const {default:puppeteer}=await import(process.env.PUPPETEER_MODULE||'puppeteer-core');
const out=process.env.OUT_DIR||'qa/castle-movie';fs.mkdirSync(out,{recursive:true});
const source=process.env.BUILD_COMMIT;assert.match(source||'',/^[a-f0-9]{40}$/);
const fps=6,stride=10,width=960,height=540,file=path.join(out,'castle-ordinary-route.mp4');
assert.ok(!fs.existsSync(file),'Never overwrite an existing recording');
const report={sourceCommit:source,scope:'Silent native software-WebGL recording of the scripted ordinary castle route. Six sampled frames per simulated second; not measured game FPS or a human speedrun. No inserted idle, cuts, actor replacement or checkpoint recovery.',recordedClockUnit:'seconds',fps,width,height,frames:0,errors:[],consoleErrors:[],pass:false};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');save();
const log=fs.openSync(path.join(out,'encoder.log'),'w'),frames=fs.createWriteStream(path.join(out,'frames.jsonl'));
const encoder=spawn('ffmpeg',['-hide_banner','-loglevel','warning','-f','image2pipe','-framerate',String(fps),'-vcodec','png','-i','pipe:0','-an','-c:v','libx264','-threads','2','-preset','veryfast','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart',file],{stdio:['pipe','ignore',log]});
let encodeError=null;encoder.stdin.on('error',e=>{encodeError=e;});encoder.on('error',e=>{encodeError=e;});
const exit=new Promise(resolve=>encoder.on('close',code=>resolve(code)));
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'],protocolTimeout:2100000});
try{
 const page=await browser.newPage();await page.setViewport({width,height});page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});
 await page.exposeFunction('__WRITE_CASTLE_FRAME__',async(sample,png)=>{
  if(encodeError)throw encodeError;
  assert.ok(Math.abs(sample.seconds-sample.steps/120)<.001,'Recorded seconds must match the original 120 Hz simulation clock');
  const bytes=Buffer.from(png,'base64');assert.ok(bytes.length>10000&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
  frames.write(JSON.stringify({...sample,videoFrame:report.frames,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')})+'\n');
  await new Promise((resolve,reject)=>encoder.stdin.write(bytes,e=>e?reject(e):resolve()));
  report.frames++;if(report.frames%120===0){save();console.log('Recorded native frames',report.frames,'simulated seconds',sample.seconds);}
 });
 const fixture=campaignAccessFixture({levelIndex:40,pathname:'/campaign-v67/'});fixture.preferences.quality='balanced';fixture.raw=JSON.stringify(fixture.preferences);report.fixture=fixture;
 await page.evaluateOnNewDocument(({key,raw})=>{localStorage.clear();localStorage.setItem(key,raw);},fixture);
 await page.goto('http://127.0.0.1:4173/campaign-v67/?edition=foundation&level=41&debug=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready'&&!document.querySelector('#start-screen').inert&&getComputedStyle(document.querySelector('#start-screen')).opacity==='1',{timeout:180000});
 await page.evaluate(()=>{const r=window.__NESI_DEMO_GAME__.renderer;window.__MOVIE_LOOP__=r.setAnimationLoop;r.setAnimationLoop=function(){return window.__MOVIE_LOOP__.call(this,null);};r.setAnimationLoop(null);});
 await page.click('#play-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.state==='playing');
 assert.deepEqual(await page.evaluate(()=>window.__NESI_PREFS__.value.completed),fixture.completed);
 const result=await page.evaluate(async({stride,width,height})=>{
  const g=window.__NESI_DEMO_GAME__,r=g.renderer;
  if(g.levelIndex!==40||g.elapsed!==0||g.physics.world.stepnumber!==0||g.firstLevel.completedStages!==0)throw Error('Recording did not start at untouched Play');
  if(r.domElement.width!==width||r.domElement.height!==height)throw Error('Unexpected native canvas size');
  r.setAnimationLoop=window.__MOVIE_LOOP__;delete window.__MOVIE_LOOP__;
  const cargo=g.cargo,group=cargo.group,body=g.physics.cargoBody,shape=body.shapes[0],player=g.playerGroup,update=g.updatePlaying,clear=g.clearPortals;let updates=0,deletions=0,last=-1;
  // LabGame.elapsed is milliseconds; the route report uses seconds.
  const sample=()=>({steps:g.physics.world.stepnumber,seconds:g.elapsed/1000,elapsedMilliseconds:g.elapsed,player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),solved:g.firstLevel.getTowerMetrics().solvedIds,state:g.state});
  const capture=async visualFrame=>{g.render();await window.__WRITE_CASTLE_FRAME__({...sample(),visualFrame},r.domElement.toDataURL('image/png').split(',')[1]);last=visualFrame;};
  g.clearPortals=()=>{deletions++;throw Error('Pair deletion unavailable to the player');};
  g.updatePlaying=function(...a){if(g.cargo!==cargo||g.cargo.group!==group||g.physics.cargoBody!==body||body.shapes[0]!==shape||g.playerGroup!==player)throw Error('Original actor replaced');updates++;return update.apply(this,a);};
  window.__SINGULARITY_FRAME__=async s=>{if((s.visualFrame+1)%stride===0)await capture(s.visualFrame);};
  try{await capture(-1);const route=await window.__NESI_RUN_LEVEL_ROUTE__();if(last!==route.frames-1)await capture(route.frames-1);return{route,updates,deletions,state:g.state,sameOriginal:g.cargo===cargo&&g.physics.cargoBody===body&&body.shapes[0]===shape};}
  catch(e){return{error:String(e.stack||e),route:e.singularityReport,updates,deletions,state:g.state};}
  finally{g.updatePlaying=update;g.clearPortals=clear;delete window.__SINGULARITY_FRAME__;}
 },{stride,width,height});
 report.result=result;save();
 assert.equal(result.error,undefined);assert.equal(result.state,'won');assert.equal(result.route.pass,true);assert.equal(result.route.resets+result.route.respawns+result.route.cargoResets+result.deletions,0);assert.equal(result.sameOriginal,true);assert.equal(result.route.metrics.completedStages,12);
 assert.deepEqual(await page.evaluate(()=>window.__NESI_PREFS__.value.completed),[...fixture.completed,40]);
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.consoleErrors,[]);
 encoder.stdin.end();assert.equal(await exit,0);if(encodeError)throw encodeError;
 const probe=spawnSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height,r_frame_rate,nb_frames,duration','-of','json',file],{encoding:'utf8'});assert.equal(probe.status,0);report.video=JSON.parse(probe.stdout).streams[0];
 assert.equal(report.video.width,width);assert.equal(report.video.height,height);assert.equal(Number(report.video.nb_frames),report.frames);assert.equal(report.video.r_frame_rate,`${fps}/1`);
 assert.ok(Math.abs(Number(report.video.duration)-result.route.seconds)<2/fps+.02,'Video time differs from the actual simulated route');
 const bytes=fs.readFileSync(file);report.video.bytes=bytes.length;report.video.sha256=crypto.createHash('sha256').update(bytes).digest('hex');report.pass=true;
}catch(e){report.failure=String(e.stack||e);process.exitCode=1;console.error(e);}
finally{await browser.close();if(!encoder.stdin.writableEnded)encoder.stdin.end();await exit;frames.end();fs.closeSync(log);save();}
