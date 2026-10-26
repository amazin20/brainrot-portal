/** Local source review. Initial cameras come from genuine Play; the other
 * cameras are explicitly declared inspection fixtures, never gameplay proof. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const repo=path.resolve(process.env.SOURCE_ROOT||fileURLToPath(new URL('..',import.meta.url)));
const out=path.resolve(process.env.OUT_DIR||'qa/campaign-visual-dev');
const port=Number(process.env.PORT||4251);
const levels=(process.env.LEVELS||Array.from({length:51},(_,i)=>i+1).join(',')).split(',').map(Number);
assert.ok(levels.length&&new Set(levels).size===levels.length&&levels.every(n=>Number.isInteger(n)&&n>=1&&n<=51));
assert.ok(!fs.existsSync(out)||fs.readdirSync(out).length===0,'Use a new directory; retain failed evidence');
fs.mkdirSync(out,{recursive:true});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const source=()=>Object.fromEntries(['src','public','index.html'].flatMap(entry=>{
 const full=path.join(repo,entry);return fs.statSync(full).isDirectory()?fs.readdirSync(full,{recursive:true}).filter(f=>fs.statSync(path.join(full,f)).isFile()).map(f=>entry+'/'+f):[entry];
}).sort().map(f=>[f,hash(fs.readFileSync(path.join(repo,f)))]));
const reference=JSON.parse(fs.readFileSync(path.join(repo,'tools/visual-audit-v65-reference-cameras.json')));
const report={kind:'local-campaign-visual-review',controllerSha256:hash(fs.readFileSync(fileURLToPath(import.meta.url))),sourceStart:source(),levels,
 scope:'Actual WebGL and authored scene/fog. Genuine Play at wide viewport; portrait uses the ordinary camera reset after a resize at the same zero-step state. Other views are declared camera-only interior fixtures. No physical-device performance or ordinary-route acceptance.',rows:[],errors:[],pass:false};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');save();
const server=spawn('node',['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:repo,stdio:['ignore','pipe','pipe']});
await new Promise((resolve,reject)=>{server.stdout.on('data',b=>{if(String(b).includes('Local:'))resolve();});server.once('error',reject);server.once('exit',c=>reject(Error('Server exit '+c)));});
let browser;
try{
 const {default:puppeteer}=await import(process.env.PUPPETEER_MODULE||'puppeteer-core');
 for(const n of levels){
  // Retire the entire WebGL process between rooms. This prevents an earlier
  // renderer/context from compromising a later room's first-frame readiness.
  browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,protocolTimeout:180000,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage(),row={n,displayNumber:reference.levels.find(l=>l.stableLevel===n).displayNumber,views:[],errors:[]};report.rows.push(row);save();
  await page.bringToFront();
  page.on('pageerror',e=>{row.errors.push(String(e.stack||e));save();});
  try{
   await page.setViewport({width:1280,height:720,deviceScaleFactor:1});
   await page.goto(`http://127.0.0.1:${port}/?edition=foundation&level=${n}&debug=1`,{waitUntil:'domcontentloaded',timeout:90000});
   await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready'&&!document.querySelector('#start-screen').inert&&getComputedStyle(document.querySelector('#start-screen')).opacity==='1',{timeout:120000});
   await page.evaluate(()=>{const r=window.__NESI_DEMO_GAME__.renderer,original=r.setAnimationLoop;window.__REVIEW_LOOP__=original;r.setAnimationLoop=function(){return original.call(this,null);};original.call(r,null);});
   await page.click('#play-button');
   await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='playing');
   await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop=window.__REVIEW_LOOP__;delete window.__REVIEW_LOOP__;});
   row.loading=await page.evaluate(()=>({profile:window.__NESI_DEMO_GAME__.loadingProfile,warmup:window.__NESI_DEMO_GAME__.portalWarmup,visibility:document.visibilityState}));
   const views=[{kind:'player-start-wide'},...reference.levels.find(l=>l.stableLevel===n).views.slice(0,2),{kind:'player-start-portrait'}];
   for(const view of views){
    const portrait=view.kind==='player-start-portrait';
    if(portrait)await page.setViewport({width:390,height:844,deviceScaleFactor:1});
    const result=await page.evaluate(view=>{
     const g=window.__NESI_DEMO_GAME__,c=g.camera;
     if(view.kind==='player-start-portrait'){
      g.cameraRig.reset(g.playerPosition,g.yaw,g.pitch);g.updateVisuals(0,1,0);
     }else if(view.kind==='player-start-wide')g.updateVisuals(0,1,0);
     else{c.position.fromArray(view.camera);if(view.target)c.lookAt(c.position.clone().fromArray(view.target));else c.quaternion.fromArray(view.quaternion);c.fov=view.fov;c.updateProjectionMatrix();g.cameraRig.mainClippingPlanes=[];}
     g.render();
     return{png:g.renderer.domElement.toDataURL('image/png').split(',')[1],state:{id:g.firstLevel.id,index:g.levelIndex,state:g.state,worldStep:g.physics.world.stepnumber,elapsed:g.elapsed,player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),bodyId:g.physics.cargoBody.id,shapeId:g.physics.cargoBody.shapes[0].id,camera:{position:c.position.toArray(),quaternion:c.quaternion.toArray(),fov:c.fov},fog:g.scene.fog?{color:g.scene.fog.color.getHex(),near:g.scene.fog.near,far:g.scene.fog.far}:null,viewport:[g.renderer.domElement.width,g.renderer.domElement.height]}};
    },view);
    assert.equal(result.state.index,n-1);assert.equal(result.state.worldStep,0);assert.equal(result.state.elapsed,0);assert.equal(result.state.state,'playing');
    if(row.views.length)for(const k of ['player','cargo','bodyId','shapeId','fog'])assert.deepEqual(result.state[k],row.views[0].state[k],'Camera fixture changed '+k);
    const filename=`room-${String(n).padStart(2,'0')}-${view.kind}.png`,bytes=Buffer.from(result.png,'base64');fs.writeFileSync(path.join(out,filename),bytes);
    row.views.push({filename,sha256:hash(bytes),bytes:bytes.length,fixture:view,state:result.state});save();
   }
   assert.deepEqual(row.errors,[]);row.pass=true;console.log('CAPTURED',n,row.views.length);save();
  }catch(error){
   row.failure=String(error.stack||error);try{row.failureState=await page.evaluate(()=>({state:window.__NESI_DEMO_GAME__?.state,inert:document.querySelector('#start-screen')?.inert,opacity:document.querySelector('#start-screen')&&getComputedStyle(document.querySelector('#start-screen')).opacity,text:document.body.innerText.slice(0,3000)}));}catch{}
   report.errors.push({n,error:row.failure});save();throw error;
  }finally{await page.close();await browser.close();browser=null;}
 }
 report.sourceEnd=source();report.sourceDrift=Object.keys({...report.sourceStart,...report.sourceEnd}).filter(k=>report.sourceStart[k]!==report.sourceEnd[k]);
 report.pass=report.rows.length===levels.length&&report.rows.every(r=>r.pass)&&!report.sourceDrift.length&&!report.errors.length;save();assert.equal(report.pass,true);
}finally{if(browser)await browser.close();server.kill();save();}
