import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {campaignAccessFixture} from '../scripts/lib/campaign-access-fixture.mjs';
const {default:puppeteer}=await import(process.env.PUPPETEER_MODULE||'puppeteer-core');
const route=process.env.ROUTE||'retrieve-first';assert.ok(['retrieve-first','air-freight'].includes(route));
const out=process.env.OUT_DIR||`qa/crossflow-hangers-${route}`;
assert.ok(!fs.existsSync(out)||fs.readdirSync(out).length===0,'Never replace previous evidence');fs.mkdirSync(out,{recursive:true});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const fixture=campaignAccessFixture({levelIndex:25,pathname:'/campaign-v67/'});fixture.preferences.quality='balanced';fixture.raw=JSON.stringify(fixture.preferences);
const report={sourceCommit:process.env.BUILD_COMMIT,baselineCommit:'b71e8dc2d2bc62281f62eb7dc7c2da823470b9c9',fixture,route,rows:[],pass:false,
 scope:'Two frozen production builds, camera-only matched inspections, then ordinary input from genuine Play at zero physics steps. Original actors throughout, no route resets, no target completion preseed. Software WebGL is not physical-device FPS or human playtesting.'};
for(const [version,folder]of [['after','dist'],['before','baseline/dist']]){
 const files=fs.readdirSync(folder,{recursive:true}).filter(file=>fs.statSync(path.join(folder,file)).isFile()).sort();
 report[version+'Build']=Object.fromEntries(files.map(file=>[file,hash(fs.readFileSync(path.join(folder,file)))]));
}
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');save();
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,protocolTimeout:240000,
 args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 for(const version of ['before','after'])for(const [view,width,height]of [['wide',1280,720],['portrait',390,844]]){
  const row={version,view,viewport:{width,height},errors:[],consoleErrors:[],images:[],pass:false};report.rows.push(row);
  const page=await browser.newPage();await page.setViewport({width,height});
  page.on('pageerror',e=>row.errors.push(String(e.stack||e)));page.on('console',m=>{if(m.type()==='error')row.consoleErrors.push(m.text());});
  const image=(label,png)=>{const bytes=Buffer.from(png,'base64');assert.ok(bytes.length>10000);const file=`${version}-${view}-${label}.png`;fs.writeFileSync(path.join(out,file),bytes);row.images.push({file,sha256:hash(bytes),bytes:bytes.length});};
  try{
   await page.evaluateOnNewDocument(({key,raw})=>{localStorage.clear();localStorage.setItem(key,raw);},fixture);
   await page.goto(`http://127.0.0.1:${version==='before'?4174:4173}/campaign-v67/?edition=foundation&level=26&debug=1`,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready'&&!document.querySelector('#start-screen').inert&&getComputedStyle(document.querySelector('#start-screen')).opacity==='1',{timeout:180000});
   await page.evaluate(()=>{const r=window.__NESI_DEMO_GAME__.renderer;window.__HANGER_LOOP__=r.setAnimationLoop;r.setAnimationLoop=function(){return window.__HANGER_LOOP__.call(this,null);};r.setAnimationLoop(null);});
   await page.click('#play-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.state==='playing');
   row.inspections=[];
   for(const inspection of [{label:'lower-stop',eye:[-20,18.8,17],target:[-12,19.4,8],fov:60},{label:'upper-stop',eye:[19,20.9,-.5],target:[12,24,-8],fov:60}]){
    const result=await page.evaluate(inspection=>{
     const g=window.__NESI_DEMO_GAME__,c=g.camera,world=()=>({id:g.firstLevel.id,steps:g.physics.world.stepnumber,elapsed:g.elapsed,player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),state:g.state});
     const before=world(),original={p:c.position.clone(),q:c.quaternion.clone(),fov:c.fov};
     c.position.fromArray(inspection.eye);c.lookAt(...inspection.target);c.fov=inspection.fov;c.updateProjectionMatrix();c.updateMatrixWorld(true);g.render();
     const result={before,after:world(),camera:{p:c.position.toArray(),q:c.quaternion.toArray(),fov:c.fov},png:g.renderer.domElement.toDataURL('image/png').split(',')[1]};
     c.position.copy(original.p);c.quaternion.copy(original.q);c.fov=original.fov;c.updateProjectionMatrix();c.updateMatrixWorld(true);return result;
    },inspection);
    assert.equal(result.before.id,'crossflow-foundry');assert.equal(result.before.steps,0);assert.equal(result.before.elapsed,0);assert.equal(result.before.state,'playing');assert.deepEqual(result.before,result.after);
    image(inspection.label,result.png);delete result.png;row.inspections.push({label:inspection.label,...result});save();
   }
   assert.deepEqual(await page.evaluate(()=>window.__NESI_PREFS__.value.completed),fixture.completed);
   const result=await page.evaluate(async route=>{
    const g=window.__NESI_DEMO_GAME__,cargo=g.cargo,group=cargo.group,body=g.physics.cargoBody,shape=body.shapes[0],update=g.updatePlaying,reset=g.resetRun;
    let updates=0,resets=0;const pictures=[];
    g.renderer.setAnimationLoop=window.__HANGER_LOOP__;delete window.__HANGER_LOOP__;
    g.resetRun=function(...a){resets++;return reset.apply(this,a);};
    g.updatePlaying=function(...a){if(g.cargo!==cargo||g.cargo.group!==group||g.physics.cargoBody!==body||body.shapes[0]!==shape)throw Error('Original physical companion replaced');updates++;return update.apply(this,a);};
    window.__NESI_CAPTURE_LEVEL_MARK__=mark=>pictures.push({mark,png:g.renderer.domElement.toDataURL('image/png').split(',')[1]});
    try{const result=await window.__NESI_RUN_LEVEL_ROUTE__({nativeStart:true,route});return{result,updates,resets,pictures,state:g.state,sameOriginal:g.cargo===cargo&&g.cargo.group===group&&g.physics.cargoBody===body&&body.shapes[0]===shape};}
    catch(e){return{error:String(e.stack||e),updates,resets,pictures,state:g.state,player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray()};}
    finally{g.updatePlaying=update;g.resetRun=reset;delete window.__NESI_CAPTURE_LEVEL_MARK__;}
   },route);
   for(const [i,picture]of result.pictures.entries()){image(`route-${i+1}`,picture.png);delete picture.png;}row.route=result;save();
   assert.equal(result.error,undefined);assert.equal(result.result.pass,true);assert.equal(result.resets+result.result.resets+result.result.respawns,0);assert.equal(result.state,'won');assert.equal(result.sameOriginal,true);
   assert.deepEqual(await page.evaluate(()=>window.__NESI_PREFS__.value.completed),[...fixture.completed,25]);
   assert.deepEqual(row.errors,[]);assert.deepEqual(row.consoleErrors,[]);row.pass=true;
  }catch(e){row.failure=String(e.stack||e);console.error(version,view,route,row.failure);}finally{save();await page.close();}
 }
 for(const view of ['wide','portrait']){
  const rows=report.rows.filter(r=>r.view===view);assert.equal(rows.length,2);
  assert.deepEqual(rows[0].inspections,rows[1].inspections,'Both versions must use identical inspection poses and authored start state');
 }
 report.pass=report.rows.length===4&&report.rows.every(row=>row.pass);save();if(!report.pass)process.exitCode=1;
}finally{await browser.close();}
