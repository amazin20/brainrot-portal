// Source-bound native screenshots. Only the camera moves during inspection.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
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
const report={sourceCommit:process.env.BUILD_COMMIT,scope:'Native production WebGL. Initial ordinary camera and two declared inspection cameras; zero physics steps. Prior-prefix access fixture does not complete the target. No ordinary-route or hardware-performance claim.',build,rows:[],pass:false};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');save();
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
  await page.evaluate(()=>{const r=window.__NESI_DEMO_GAME__.renderer,loop=r.setAnimationLoop;r.setAnimationLoop=function(){return loop.call(this,null);};loop.call(r,null);});
  await page.click('#play-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.state==='playing');
  const reference=refs.levels.find(r=>r.stableLevel===level);row.displayNumber=reference.displayNumber;
  for(const view of [{kind:'start'},...reference.views.slice(0,2)]){
   const result=await page.evaluate(view=>{
    const g=window.__NESI_DEMO_GAME__,c=g.camera,world=()=>({id:g.firstLevel.id,index:g.levelIndex,steps:g.physics.world.stepnumber,state:g.state,elapsed:g.elapsed,player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),cargoBody:g.physics.cargoBody.id,cargoShape:g.physics.cargoBody.shapes[0].id});
    const before=world();if(view.camera){c.position.fromArray(view.camera);c.lookAt(...view.target);c.fov=view.fov;c.updateProjectionMatrix();}else g.updateVisuals(0,1,0);
    c.updateMatrixWorld(true);g.render();return{before,after:world(),camera:{p:c.position.toArray(),q:c.quaternion.toArray(),fov:c.fov},png:g.renderer.domElement.toDataURL('image/png').split(',')[1]};
   },view);
   assert.equal(result.before.index,level-1);assert.equal(result.before.steps,0);assert.equal(result.before.elapsed,0);assert.equal(result.before.state,'playing');assert.deepEqual(result.before,result.after);
   const bytes=Buffer.from(result.png,'base64');delete result.png;assert.ok(bytes.length>10000);
   const filename=`room-${level}-${view.kind}.png`;fs.writeFileSync(path.join(out,filename),bytes);row.views.push({...result,filename,sha256:hash(bytes),bytes:bytes.length,fixture:view});save();
  }
  assert.deepEqual(await page.evaluate(()=>window.__NESI_PREFS__.value.completed),fixture.completed);
  assert.deepEqual(row.errors,[]);assert.deepEqual(row.consoleErrors,[]);row.pass=true;console.log('CAPTURED',level,row.views.length);
 }catch(e){row.failure=String(e.stack||e);console.error('CAPTURE FAILED',level,row.failure);}finally{save();await browser.close();}
}
report.pass=report.rows.length===levels.length&&report.rows.every(row=>row.pass);save();if(!report.pass)process.exitCode=1;
