/** Two genuine WebGL frames of the same closed freight shutter.
 * Required: BEFORE_ROOT, AFTER_ROOT, AFTER_COMMIT, OUT_DIR.
 * Optional: CHROME_PATH, PUPPETEER_MODULE, PORT, READY_TIMEOUT.
 * Each source gets a fresh browser. This is a camera inspection fixture,
 * never a route or physical-device performance claim. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

for(const name of ['BEFORE_ROOT','AFTER_ROOT','AFTER_COMMIT','OUT_DIR'])assert.ok(process.env[name],`${name} is required`);
const out=path.resolve(process.env.OUT_DIR),port=Number(process.env.PORT||4253);
const readyTimeout=Number(process.env.READY_TIMEOUT||180000);
assert.ok(Number.isInteger(port)&&port>0&&port<65536);
assert.ok(!fs.existsSync(out)||fs.readdirSync(out).length===0,'Use a new output directory; retain failed evidence');
fs.mkdirSync(out,{recursive:true});
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const git=(repo,...args)=>execFileSync('git',args,{cwd:repo,encoding:'utf8'}).trim();
const source=repo=>Object.fromEntries(['src','public','index.html'].flatMap(entry=>{
 const full=path.join(repo,entry);return fs.statSync(full).isDirectory()?fs.readdirSync(full,{recursive:true}).filter(f=>fs.statSync(path.join(full,f)).isFile()).map(f=>entry+'/'+f):[entry];
}).sort().map(f=>[f,hash(fs.readFileSync(path.join(repo,f)))]));
const sources=[
 {label:'before',repo:path.resolve(process.env.BEFORE_ROOT),expectedCommit:process.env.BEFORE_COMMIT||'901ff9d43dff2642b8125a4ac36540ae863ec9f5',bandHeight:4.95},
 {label:'after',repo:path.resolve(process.env.AFTER_ROOT),expectedCommit:process.env.AFTER_COMMIT,bandHeight:.37},
];
// Derived from the actual closed lower gate: centre [0,2.7,12], height5.4,
// width6 along Z. The camera stays in the west court above its y=0 floor.
// Both full jambs and the connection lamp fit inside this declared frame.
const fixture=Object.freeze({kind:'lower-freight-gate-detail',camera:[-9,4.3,15.2],target:[-.35,2.7,12],fov:48,viewport:[1280,800]});
const report={kind:'room22-freight-gate-before-after',controllerSha256:hash(fs.readFileSync(fileURLToPath(import.meta.url))),fixture,
 scope:'Actual WebGL after native Play at world step0. Only the declared camera and its clipping state change. Original actors, mechanism displacement, scene, lighting and fog remain authored. No route or device-performance claim.',rows:[],pass:false};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');save();
const {default:puppeteer}=await import(process.env.PUPPETEER_MODULE||'puppeteer-core');
async function stopServer(server){
 if(!server.pid||server.exitCode!==null||server.signalCode!==null)return;
 await new Promise(resolve=>{
  const timeout=setTimeout(()=>server.kill('SIGKILL'),10000);
  server.once('exit',()=>{clearTimeout(timeout);resolve();});server.kill();
 });
}

for(const entry of sources){
 const row={label:entry.label,sourceCommit:git(entry.repo,'rev-parse','HEAD'),sourceTree:git(entry.repo,'rev-parse','HEAD^{tree}'),trackedWorkingTreeClean:git(entry.repo,'status','--porcelain','--untracked-files=no')==='',sourceStart:source(entry.repo),pageErrors:[],console:[],requestFailures:[],serverLog:'',pass:false};
 report.rows.push(row);save();
 assert.equal(row.sourceCommit,entry.expectedCommit);assert.equal(row.trackedWorkingTreeClean,true,'Capture an immutable source checkout');
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:entry.repo,stdio:['ignore','pipe','pipe']});
 let browser,page;
 try{
  await new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>reject(Error('Vite did not become ready')),30000);
   const log=b=>{row.serverLog=(row.serverLog+String(b)).slice(-12000);save();};
   server.stderr.on('data',log);server.stdout.on('data',b=>{log(b);if(String(b).includes('Local:')){clearTimeout(timeout);resolve();}});
   server.once('error',e=>{clearTimeout(timeout);reject(e);});server.once('exit',code=>{clearTimeout(timeout);reject(Error('Vite exited '+code));});
  });
  browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,protocolTimeout:180000,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  page=await browser.newPage();await page.bringToFront();
  page.on('pageerror',error=>{row.pageErrors.push(String(error.stack||error));save();});
  page.on('console',message=>{if(['error','warning','warn'].includes(message.type())){row.console.push({type:message.type(),text:message.text()});save();}});
  page.on('requestfailed',request=>{row.requestFailures.push({url:request.url(),error:request.failure()?.errorText});save();});
  await page.setViewport({width:fixture.viewport[0],height:fixture.viewport[1],deviceScaleFactor:1});
  await page.goto(`http://127.0.0.1:${port}/?edition=foundation&level=22&debug=1`,{waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready'&&!document.querySelector('#start-screen').inert&&getComputedStyle(document.querySelector('#start-screen')).opacity==='1',{timeout:readyTimeout});
  await page.evaluate(()=>{
   const g=window.__NESI_DEMO_GAME__,r=g.renderer,original=r.setAnimationLoop;
   window.__GATE_REVIEW_LOOP__=original;r.setAnimationLoop=function(){return original.call(this,null);};original.call(r,null);
   window.__GATE_CONTEXT_LOSSES__=0;r.domElement.addEventListener('webglcontextlost',()=>window.__GATE_CONTEXT_LOSSES__++);
  });
  await page.click('#play-button');
  await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='playing',{timeout:30000});
  const result=await page.evaluate(fixture=>{
   const g=window.__NESI_DEMO_GAME__,c=g.camera,l=g.firstLevel;
   g.renderer.setAnimationLoop=window.__GATE_REVIEW_LOOP__;delete window.__GATE_REVIEW_LOOP__;
   g.updateVisuals(0,1,0);
   const original={level:l,cargo:g.cargo,player:g.playerPosition,body:g.physics.cargoBody,shapes:g.physics.cargoBody.shapes.slice()};
   const state=()=>({id:l.id,index:g.levelIndex,state:g.state,worldStep:g.physics.world.stepnumber,elapsed:g.elapsed,player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),cargoQuaternion:g.cargo.quaternion.toArray(),bodyPosition:g.physics.cargoBody.position.toArray(),bodyQuaternion:g.physics.cargoBody.quaternion.toArray(),bodyId:g.physics.cargoBody.id,shapeIds:g.physics.cargoBody.shapes.map(s=>s.id),bodyCount:g.physics.world.bodies.length,
    background:g.scene.background?.isColor?g.scene.background.getHex():null,fog:g.scene.fog?{color:g.scene.fog.color.getHex(),near:g.scene.fog.near,far:g.scene.fog.far}:null,
    mechanism:{progress:l.shutters.progress,loaded:l.shutters.loaded,lower:l.shutters.lower.mesh.position.toArray(),upper:l.shutters.upper.mesh.position.toArray(),lowerCollider:{min:l.shutters.lower.collider.box.min.toArray(),max:l.shutters.lower.collider.box.max.toArray()},upperCollider:{min:l.shutters.upper.collider.box.min.toArray(),max:l.shutters.upper.collider.box.max.toArray()}}});
   const before=state(),cameraBefore={position:c.position.toArray(),quaternion:c.quaternion.toArray(),fov:c.fov,clippingPlanes:g.cameraRig.mainClippingPlanes.length};
   c.position.fromArray(fixture.camera);c.lookAt(c.position.clone().fromArray(fixture.target));c.fov=fixture.fov;c.updateProjectionMatrix();g.cameraRig.mainClippingPlanes=[];
   // Keep render and canvas readback in this same synchronous task: a later
   // evaluate can see an already cleared default WebGL framebuffer.
   g.render();const png=g.renderer.domElement.toDataURL('image/png').split(',')[1];
   const band=l.freightArchitecture.bands[0],p=band.geometry.parameters;
   return {png,before,after:state(),cameraBefore,camera:{position:c.position.toArray(),quaternion:c.quaternion.toArray(),fov:c.fov,aspect:c.aspect},viewport:[g.renderer.domElement.width,g.renderer.domElement.height],band:{position:band.position.toArray(),size:[p.width,p.height,p.depth],material:band.material.type,color:band.material.color.getHex()},ownership:{sameLevel:g.firstLevel===original.level,sameCargo:g.cargo===original.cargo,samePlayer:g.playerPosition===original.player,sameBody:g.physics.cargoBody===original.body,sameShapes:g.physics.cargoBody.shapes.length===original.shapes.length&&g.physics.cargoBody.shapes.every((s,i)=>s===original.shapes[i])},loading:{profile:g.loadingProfile,warmup:g.portalWarmup,visibility:document.visibilityState},contextLosses:window.__GATE_CONTEXT_LOSSES__};
  },fixture);
  const {png,...metadata}=result;Object.assign(row,metadata);
  assert.equal(result.after.id,'opposed-freight-lock');assert.equal(result.after.index,21);assert.equal(result.after.state,'playing');assert.equal(result.after.worldStep,0);assert.equal(result.after.elapsed,0);
  assert.equal(result.after.mechanism.progress,0);assert.deepEqual(result.before,result.after,'Camera inspection changed the authored state');
  assert.ok(Object.values(result.ownership).every(Boolean),'Capture replaced an original actor, body or shape');
  assert.deepEqual(result.viewport,fixture.viewport);assert.deepEqual(result.band.size,[.05,entry.bandHeight,5.4]);assert.equal(result.contextLosses,0);assert.deepEqual(row.pageErrors,[]);
  assert.deepEqual(row.console.filter(message=>message.type==='error'),[],'Rendering or resource error was reported by the browser');
  const bytes=Buffer.from(png,'base64');assert.ok(bytes.length>10000,'Empty or invalid image');
  row.filename=`room22-gate-${entry.label}.png`;row.sha256=hash(bytes);row.bytes=bytes.length;fs.writeFileSync(path.join(out,row.filename),bytes);
  row.sourceEnd=source(entry.repo);row.sourceDrift=Object.keys({...row.sourceStart,...row.sourceEnd}).filter(f=>row.sourceStart[f]!==row.sourceEnd[f]);assert.deepEqual(row.sourceDrift,[]);
  row.pass=true;save();console.log('CAPTURED',entry.label,row.filename,row.bytes);
 }catch(error){
  row.failure=String(error.stack||error);
  if(page){
   try{row.failureState=await page.evaluate(()=>({state:window.__NESI_DEMO_GAME__?.state,visibility:document.visibilityState,inert:document.querySelector('#start-screen')?.inert,opacity:document.querySelector('#start-screen')&&getComputedStyle(document.querySelector('#start-screen')).opacity,text:document.body.innerText.slice(0,3000),contextLosses:window.__GATE_CONTEXT_LOSSES__}));}catch{}
   try{await page.screenshot({path:path.join(out,`failure-${entry.label}.png`)});}catch{}
  }
  save();throw error;
 }finally{
  try{if(browser)await browser.close();}finally{await stopServer(server);save();}
 }
}
try{
 const [before,after]=report.rows;
 for(const key of ['camera','viewport'])assert.deepEqual(before[key],after[key],`Comparison changed ${key}`);
 for(const key of ['id','index','state','worldStep','elapsed','player','cargo','cargoQuaternion','bodyPosition','bodyQuaternion','bodyCount','background','fog','mechanism'])assert.deepEqual(before.after[key],after.after[key],`Versions differ in ${key}`);
 for(const key of ['position','material','color'])assert.deepEqual(before.band[key],after.band[key],`Signal changed ${key}`);
 report.pass=report.rows.length===2&&report.rows.every(row=>row.pass);save();assert.equal(report.pass,true);
}catch(error){report.comparisonError=String(error.stack||error);save();throw error;}
