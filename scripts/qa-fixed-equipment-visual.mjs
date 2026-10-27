// Frozen production builds. Inspection moves only the camera; route captures
// use the ordinary input driver and preserve both original physical actors.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {campaignAccessFixture} from './lib/campaign-access-fixture.mjs';
const {default:puppeteer}=await import(process.env.PUPPETEER_MODULE||'puppeteer-core');
const level=Number(process.env.STABLE_LEVEL),out=process.env.OUT_DIR||`qa/fixed-equipment-${level}`;
assert.ok([11,42,43].includes(level));fs.mkdirSync(out,{recursive:true});
const shot={11:{id:'stored-wind',eye:[-5,4.4,-5],at:[-11.6,3.2,-11.4]},42:{id:'expansion-differential-valves',eye:[26.7,15.7,27.6],at:[33,18.6,34.2]},43:{id:'puzzle-pilot43-return-and-release',eye:[-1,5,23],at:[-8,6,13]}}[level];
const fixture=campaignAccessFixture({levelIndex:level-1,pathname:'/campaign-v67/'});fixture.preferences.quality='balanced';fixture.raw=JSON.stringify(fixture.preferences);
const report={level,expectedId:shot.id,fixture,sourceCommit:process.env.BUILD_COMMIT,baselineCommit:'6c634dec2bc6098d5cb374bbf6b25492fa59e30d',scope:'Native software WebGL of two frozen ordinary production builds. Matched static camera inspection and scripted real-input routes, not human playtesting or hardware FPS. An isolated prior-completed-prefix save admits the still-uncompleted target through the unchanged production gate. Late route drivers perform one normal setup reset before observation; no resets are allowed during the observed route.',rows:[],pass:false};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');save();
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'],protocolTimeout:240000});
try{
 for(const version of ['before','after'])for(const [view,width,height]of [['wide',1280,720],['portrait',390,844]]){
  const page=await browser.newPage();await page.setViewport({width,height});
  const row={version,view,width,height,pass:false,pageErrors:[],consoleErrors:[],images:[]};report.rows.push(row);
  page.on('pageerror',e=>row.pageErrors.push(String(e)));page.on('console',m=>{if(m.type()==='error')row.consoleErrors.push(m.text());});
  const image=(stem,data)=>{const bytes=Buffer.from(data,'base64'),file=`${version}-${view}-${stem}.png`;assert.ok(bytes.length>10000,'Empty capture');fs.writeFileSync(path.join(out,file),bytes);row.images.push({file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length});};
  try{
   await page.evaluateOnNewDocument(({key,raw})=>{localStorage.clear();localStorage.setItem(key,raw);},{key:fixture.key,raw:fixture.raw});
   await page.goto(`http://127.0.0.1:${version==='before'?4174:4173}/campaign-v67/?edition=foundation&level=${level}&debug=1`,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready'&&!document.querySelector('#start-screen').inert&&getComputedStyle(document.querySelector('#start-screen')).opacity==='1',{timeout:180000});
   assert.deepEqual(await page.evaluate(()=>window.__NESI_PREFS__.value.completed),fixture.completed);
   const inspection=await page.evaluate(({shot})=>{
    const g=window.__NESI_DEMO_GAME__,r=g.renderer;window.__MOUNT_ORIGINAL_LOOP__=r.setAnimationLoop;
    r.setAnimationLoop=function(){return window.__MOUNT_ORIGINAL_LOOP__.call(this,null);};r.setAnimationLoop(null);
    const state=()=>({player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),steps:g.physics.world.stepnumber,id:g.firstLevel.id});const before=state(),camera=g.camera,p=camera.position.clone(),q=camera.quaternion.clone(),fov=camera.fov;
    camera.position.fromArray(shot.eye);camera.lookAt(...shot.at);camera.fov=56;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);g.render();
    const result={before,after:state(),camera:{p:camera.position.toArray(),q:camera.quaternion.toArray(),fov:camera.fov},png:r.domElement.toDataURL('image/png').split(',')[1]};
    camera.position.copy(p);camera.quaternion.copy(q);camera.fov=fov;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);return result;
   },{shot});
   assert.equal(inspection.before.id,shot.id);assert.deepEqual(inspection.before,inspection.after);assert.equal(inspection.before.steps,0);image('inspection',inspection.png);delete inspection.png;row.inspection=inspection;save();
   await page.click('#play-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.state==='playing');
   const result=await page.evaluate(async level=>{
    const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop=window.__MOUNT_ORIGINAL_LOOP__;delete window.__MOUNT_ORIGINAL_LOOP__;
    const body=g.physics.cargoBody,shape=body.shapes[0],cargo=g.cargo,group=cargo.group,update=g.updatePlaying,reset=g.resetRun;let updates=0,resets=0;const pictures=[];
    g.resetRun=function(...a){resets++;return reset.apply(this,a);};
    g.updatePlaying=function(...a){if(g.cargo!==cargo||g.cargo.group!==group||g.physics.cargoBody!==body||body.shapes[0]!==shape)throw Error('Original physical actor changed');updates++;return update.apply(this,a);};
    window.__NESI_CAPTURE_LEVEL_MARK__=mark=>pictures.push({mark,camera:{p:g.camera.position.toArray(),q:g.camera.quaternion.toArray(),fov:g.camera.fov},png:g.renderer.domElement.toDataURL('image/png').split(',')[1]});
    try{const route=await window.__NESI_RUN_LEVEL_ROUTE__(level===11?{nativeStart:true}:{});return{route,pictures,updates,setupResets:resets,state:g.state,sameOriginal:g.cargo===cargo&&g.physics.cargoBody===body&&body.shapes[0]===shape};}
    catch(e){return{error:String(e.stack||e),pictures,updates,setupResets:resets,state:g.state,position:g.playerPosition.toArray()};}
    finally{g.updatePlaying=update;g.resetRun=reset;delete window.__NESI_CAPTURE_LEVEL_MARK__;}
   },level);
   for(let i=0;i<result.pictures.length;i++){const p=result.pictures[i];image(`route-${String(i+1).padStart(2,'0')}`,p.png);delete p.png;}row.result=result;save();
   assert.equal(result.error,undefined);assert.equal(result.route.pass,true);assert.equal(result.route.resets+result.route.respawns,0);assert.equal(result.setupResets,level===11?0:1);assert.equal(result.state,'won');assert.deepEqual(await page.evaluate(()=>window.__NESI_PREFS__.value.completed),[...fixture.completed,level-1]);assert.equal(result.sameOriginal,true);assert.deepEqual(row.pageErrors,[]);assert.deepEqual(row.consoleErrors,[]);row.pass=true;
  }catch(e){row.failure=String(e.stack||e);console.error('CASE FAIL',version,view,level,row.failure);}finally{save();await page.close();}
 }
 const wide=report.rows.filter(r=>r.view==='wide'&&r.inspection);if(wide.length===2){assert.deepEqual(wide[0].inspection.camera,wide[1].inspection.camera);assert.deepEqual(wide[0].inspection.before,wide[1].inspection.before);}
 report.pass=report.rows.length===4&&report.rows.filter(r=>r.version==='after').every(r=>r.pass);save();if(!report.pass)process.exitCode=1;
}finally{await browser.close();}
