// Source-bound native screenshots. Only the camera moves during inspection.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {campaignAccessFixture} from '../scripts/lib/campaign-access-fixture.mjs';
const {default:puppeteer}=await import(process.env.PUPPETEER_MODULE||'puppeteer-core');
const levels=String(process.env.LEVELS||'21,22,23,24,25').split(',').map(Number);
assert.ok(levels.length&&levels.every(n=>Number.isInteger(n)&&n>=1&&n<=51));
assert.equal(new Set(levels).size,levels.length);
const out=process.env.OUT_DIR||'qa/chapter-native',origin=process.env.PAGE_ORIGIN||'http://127.0.0.1:4173';
assert.ok(!fs.existsSync(out)||fs.readdirSync(out).length===0,'Retain earlier attempts in another folder');fs.mkdirSync(out,{recursive:true});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const files=fs.readdirSync('dist',{recursive:true}).filter(f=>fs.statSync(path.join('dist',f)).isFile()).sort();
const build=Object.fromEntries(files.map(f=>[f,hash(fs.readFileSync(path.join('dist',f)))]));
const refs=JSON.parse(fs.readFileSync('tools/visual-audit-v65-reference-cameras.json'));
const report={sourceCommit:process.env.BUILD_COMMIT,scope:'Native production WebGL. Inspection moves only the camera at zero physics steps. Rooms 31–40 then use normal-input routes from Play, preserving original actors. Prior-prefix save does not complete the target. No hardware-performance or human-playtest claim.',build,rows:[],pass:false};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');save();
if(levels.includes(31)){
 const result=spawnSync(process.execPath,['--test','--test-concurrency=1','tests/lab-optics-architecture.test.js','tests/lab-optics-art.test.js','tests/lab-campaign-themes.test.js'],{encoding:'utf8',maxBuffer:16*1024*1024});
 fs.writeFileSync(path.join(out,'optics-structural.tap'),(result.stdout||'')+(result.stderr||''));
 if(result.error||result.status!==0)throw result.error||new Error('Optics structural acceptance failed');
}
for(const level of levels){
 const row={level,errors:[],consoleErrors:[],views:[],pass:false};report.rows.push(row);
 const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'],protocolTimeout:180000});
 try{
  const page=await browser.newPage();await page.setViewport({width:1280,height:720});
  page.on('pageerror',e=>row.errors.push(String(e.stack||e)));page.on('console',m=>{if(m.type()==='error')row.consoleErrors.push(m.text());});
  const fixture=campaignAccessFixture({levelIndex:level-1,pathname:'/campaign-v67/'});fixture.preferences.quality='balanced';fixture.raw=JSON.stringify(fixture.preferences);row.fixture=fixture;
  await page.evaluateOnNewDocument(({key,raw})=>{localStorage.clear();localStorage.setItem(key,raw);},fixture);
  await page.goto(`${origin}/campaign-v67/?edition=foundation&level=${level}&debug=1`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready'&&!document.querySelector('#start-screen').inert&&getComputedStyle(document.querySelector('#start-screen')).opacity==='1',{timeout:180000});
  await page.evaluate(()=>{const r=window.__NESI_DEMO_GAME__.renderer,loop=r.setAnimationLoop;window.__OPTICS_REVIEW_LOOP__=loop;r.setAnimationLoop=function(){return loop.call(this,null);};loop.call(r,null);});
  await page.click('#play-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.state==='playing');
  await page.evaluate(()=>{const c=window.__NESI_DEMO_GAME__.camera;window.__OPTICS_START_CAMERA__={p:c.position.clone(),q:c.quaternion.clone(),fov:c.fov};});
  const reference=refs.levels.find(r=>r.stableLevel===level);row.displayNumber=reference.displayNumber;
  for(const view of [{kind:'start'},...reference.views.slice(0,2)]){
   const result=await page.evaluate(view=>{
    const g=window.__NESI_DEMO_GAME__,c=g.camera,world=()=>({id:g.firstLevel.id,index:g.levelIndex,steps:g.physics.world.stepnumber,state:g.state,elapsed:g.elapsed,player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),cargoBody:g.physics.cargoBody.id,cargoShape:g.physics.cargoBody.shapes[0].id});
    const before=world();if(view.camera){c.position.fromArray(view.camera);c.lookAt(...view.target);c.fov=view.fov;c.updateProjectionMatrix();}else g.updateVisuals(0,1,0);
    c.updateMatrixWorld(true);g.render();return{before,after:world(),camera:{p:c.position.toArray(),q:c.quaternion.toArray(),fov:c.fov},architecture:g.firstLevel.opticsArchitecture?.stats,render:{calls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles},png:g.renderer.domElement.toDataURL('image/png').split(',')[1]};
   },view);
   assert.equal(result.before.index,level-1);assert.equal(result.before.steps,0);assert.equal(result.before.elapsed,0);assert.equal(result.before.state,'playing');assert.deepEqual(result.before,result.after);
   const bytes=Buffer.from(result.png,'base64');delete result.png;assert.ok(bytes.length>10000);
   const filename=`room-${level}-${view.kind}.png`;fs.writeFileSync(path.join(out,filename),bytes);row.views.push({...result,filename,sha256:hash(bytes),bytes:bytes.length,fixture:view});save();
  }
  assert.deepEqual(await page.evaluate(()=>window.__NESI_PREFS__.value.completed),fixture.completed);
  if(level>=31&&level<=40){
   const route=await page.evaluate(async()=>{
    const g=window.__NESI_DEMO_GAME__,c=g.camera,start=window.__OPTICS_START_CAMERA__;
    c.position.copy(start.p);c.quaternion.copy(start.q);c.fov=start.fov;c.updateProjectionMatrix();c.updateMatrixWorld(true);
    g.renderer.setAnimationLoop=window.__OPTICS_REVIEW_LOOP__;delete window.__OPTICS_REVIEW_LOOP__;delete window.__OPTICS_START_CAMERA__;
    const cargo=g.cargo,group=cargo.group,body=g.physics.cargoBody,shape=body.shapes[0],update=g.updatePlaying,reset=g.resetRun;let observations=0,resets=0;
    g.resetRun=function(...a){resets++;return reset.apply(this,a);};
    g.updatePlaying=function(...a){if(g.cargo!==cargo||g.cargo.group!==group||g.physics.cargoBody!==body||body.shapes[0]!==shape)throw Error('Original traveller replaced');observations++;return update.apply(this,a);};
    try{const result=await window.__NESI_RUN_LEVEL_ROUTE__({nativeStart:true});g.render();return{result,state:g.state,observations,resets,sameOriginal:g.cargo===cargo&&g.physics.cargoBody===body&&body.shapes[0]===shape,png:g.renderer.domElement.toDataURL('image/png').split(',')[1]};}
    catch(e){return{error:String(e.stack||e),state:g.state,observations,resets,player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray()};}
    finally{g.updatePlaying=update;g.resetRun=reset;}
   });
   if(route.png){const bytes=Buffer.from(route.png,'base64');delete route.png;const filename=`room-${level}-won.png`;fs.writeFileSync(path.join(out,filename),bytes);route.image={filename,bytes:bytes.length,sha256:hash(bytes)};}
   row.route=route;save();assert.equal(route.error,undefined);assert.equal(route.result.pass,true);assert.equal(route.result.resets+route.result.respawns+route.resets,0);assert.equal(route.state,'won');assert.equal(route.sameOriginal,true);
   assert.deepEqual(await page.evaluate(()=>window.__NESI_PREFS__.value.completed),[...fixture.completed,level-1]);
  }

  assert.deepEqual(row.errors,[]);assert.deepEqual(row.consoleErrors,[]);row.pass=true;console.log('CAPTURED',level,row.views.length);
 }catch(e){row.failure=String(e.stack||e);console.error('CAPTURE FAILED',level,row.failure);}finally{save();await browser.close();}
}
assert.deepEqual(Object.fromEntries(files.map(f=>[f,hash(fs.readFileSync(path.join('dist',f)))])),build,'Frozen build changed during review');
report.pass=report.rows.length===levels.length&&report.rows.every(row=>row.pass);save();if(!report.pass)process.exitCode=1;
