import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {campaignAccessFixture} from '../scripts/lib/campaign-access-fixture.mjs';
const {default:puppeteer}=await import(process.env.PUPPETEER_MODULE||'puppeteer-core');
const out=process.env.OUT_DIR||'qa/castle-grand';fs.mkdirSync(out,{recursive:true});
const reference=JSON.parse(fs.readFileSync('tools/visual-audit-v65-reference-cameras.json')).levels.find(r=>r.stableLevel===41);
const views=[{kind:'start'},
 {kind:'atrium',camera:[7,6,54],target:[-1,29,-10],fov:70},
 {kind:'upper-atrium',camera:[7,77,54],target:[-12,53,-20],fov:70},
 ...reference.views.filter(v=>v.kind.startsWith('castle-'))];
const report={candidateCommit:process.env.BUILD_COMMIT,baselineCommit:'6f4b9b58a5f51efb99492e20d54349fd5fee9add',scope:'Native software WebGL. Static inspection changes only the camera, not actors or physics. Optional route uses the production ordinary-input castle driver with original-actor and reset guards. No human or hardware performance claim.',rows:[],pass:false};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');save();
const fixture=campaignAccessFixture({levelIndex:40,pathname:'/campaign-v67/'});fixture.preferences.quality='balanced';fixture.raw=JSON.stringify(fixture.preferences);report.fixture=fixture;
function image(data,name){const bytes=Buffer.from(data,'base64');assert.ok(bytes.length>10000);fs.writeFileSync(path.join(out,name),bytes);return{file:name,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};}
for(const version of ['before','after']){
 const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'],protocolTimeout:900000});
 const row={version,errors:[],consoleErrors:[],views:[],pass:false};report.rows.push(row);
 try{
  const page=await browser.newPage();await page.setViewport({width:1280,height:720});page.on('pageerror',e=>row.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')row.consoleErrors.push(m.text());});
  await page.evaluateOnNewDocument(({key,raw})=>{localStorage.clear();localStorage.setItem(key,raw);},fixture);
  await page.goto(`http://127.0.0.1:${version==='before'?4174:4173}/campaign-v67/?edition=foundation&level=41&debug=1`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready'&&!document.querySelector('#start-screen').inert&&getComputedStyle(document.querySelector('#start-screen')).opacity==='1',{timeout:180000});
  await page.evaluate(()=>{const r=window.__NESI_DEMO_GAME__.renderer;window.__CASTLE_REVIEW_LOOP__=r.setAnimationLoop;r.setAnimationLoop=function(){return window.__CASTLE_REVIEW_LOOP__.call(this,null);};r.setAnimationLoop(null);});
  await page.click('#play-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.state==='playing');
  await page.evaluate(()=>{const c=window.__NESI_DEMO_GAME__.camera;window.__CASTLE_REVIEW_CAMERA__={p:c.position.clone(),q:c.quaternion.clone(),fov:c.fov};});
  for(const view of views){
   const result=await page.evaluate(view=>{
    const g=window.__NESI_DEMO_GAME__,c=g.camera,s=()=>({id:g.firstLevel.id,steps:g.physics.world.stepnumber,elapsed:g.elapsed,player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),solved:g.firstLevel.getTowerMetrics().solvedIds,state:g.state});const before=s();
    if(view.camera){c.position.fromArray(view.camera);c.lookAt(...view.target);c.fov=view.fov;c.updateProjectionMatrix();}else g.updateVisuals(0,1,0);
    c.updateMatrixWorld(true);g.render();return{before,after:s(),camera:{p:c.position.toArray(),q:c.quaternion.toArray(),fov:c.fov},render:{calls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles},stats:g.firstLevel.structure.userData.castleGrandArchitecture?.stats,png:g.renderer.domElement.toDataURL('image/png').split(',')[1]};
   },view);
   assert.equal(result.before.id,'tower-singularity');assert.equal(result.before.steps,0);assert.equal(result.before.elapsed,0);assert.deepEqual(result.before,result.after);assert.deepEqual(result.before.solved,[]);
   const png=result.png;delete result.png;row.views.push({...result,kind:view.kind,...image(png,`${version}-${view.kind}.png`)});save();
  }
  assert.deepEqual(await page.evaluate(()=>window.__NESI_PREFS__.value.completed),fixture.completed);
  if(version==='after'&&process.env.CASTLE_FULL_ROUTE==='1'){
   const result=await page.evaluate(async()=>{
    const g=window.__NESI_DEMO_GAME__,c=g.camera,s=window.__CASTLE_REVIEW_CAMERA__;c.position.copy(s.p);c.quaternion.copy(s.q);c.fov=s.fov;c.updateProjectionMatrix();c.updateMatrixWorld(true);g.renderer.setAnimationLoop=window.__CASTLE_REVIEW_LOOP__;delete window.__CASTLE_REVIEW_LOOP__;delete window.__CASTLE_REVIEW_CAMERA__;
    const cargo=g.cargo,group=cargo.group,body=g.physics.cargoBody,shape=body.shapes[0],player=g.playerGroup,update=g.updatePlaying,clear=g.clearPortals;let observations=0,deletions=0;const captures=[];
    g.clearPortals=()=>{deletions++;throw Error('Pair deletion is not an ordinary player action');};
    g.updatePlaying=function(...args){if(g.cargo!==cargo||g.cargo.group!==group||g.physics.cargoBody!==body||body.shapes[0]!==shape||g.playerGroup!==player)throw Error('Original actor replaced');observations++;return update.apply(this,args);};
    window.__NESI_CAPTURE_LEVEL_MARK__=mark=>captures.push({mark,png:g.renderer.domElement.toDataURL('image/png').split(',')[1]});
    try{const route=await window.__NESI_RUN_LEVEL_ROUTE__({nativeStart:true});g.render();return{route,state:g.state,observations,deletions,sameOriginal:g.cargo===cargo&&g.physics.cargoBody===body,metrics:g.firstLevel.getTowerMetrics(),captures,png:g.renderer.domElement.toDataURL('image/png').split(',')[1]};}
    catch(e){return{error:String(e.stack||e),state:g.state,observations,deletions,captures,metrics:g.firstLevel.getTowerMetrics()};}
    finally{g.updatePlaying=update;g.clearPortals=clear;delete window.__NESI_CAPTURE_LEVEL_MARK__;}
   });
   row.route=result;
   for(const [i,c]of (result.captures||[]).entries()){c.image=image(c.png,`route-${String(i+1).padStart(2,'0')}.png`);delete c.png;}
   if(result.png){result.image=image(result.png,'after-won.png');delete result.png;}save();
   assert.equal(result.error,undefined);assert.equal(result.state,'won');assert.equal(result.route.pass,true);assert.equal(result.route.resets+result.route.respawns+result.route.cargoResets+result.deletions,0);assert.equal(result.sameOriginal,true);assert.equal(result.metrics.completedStages,12);
   assert.deepEqual(await page.evaluate(()=>window.__NESI_PREFS__.value.completed),[...fixture.completed,40]);
  }
  assert.deepEqual(row.errors,[]);assert.deepEqual(row.consoleErrors,[]);row.pass=true;
 }catch(e){row.failure=String(e.stack||e);console.error(version,row.failure);}finally{save();await browser.close();}
}
if(report.rows.every(r=>r.pass))for(let i=0;i<views.length;i++){assert.deepEqual(report.rows[0].views[i].camera,report.rows[1].views[i].camera);assert.deepEqual(report.rows[0].views[i].before,report.rows[1].views[i].before);}
report.pass=report.rows.length===2&&report.rows.every(r=>r.pass);save();if(!report.pass)process.exitCode=1;
