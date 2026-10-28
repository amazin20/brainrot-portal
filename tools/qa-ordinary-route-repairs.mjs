// Production routes with pair deletion explicitly unavailable. Screenshots
// come only from real WebGL at the route's actual ordinary-control milestones.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {campaignAccessFixture} from '../scripts/lib/campaign-access-fixture.mjs';
const {default:puppeteer}=await import(process.env.PUPPETEER_MODULE||'puppeteer-core');
const out=process.env.REPAIR_OUT_DIR||'qa/chapter-native/ordinary-repairs';
assert.ok(!fs.existsSync(out)||fs.readdirSync(out).length===0,'Never overwrite earlier attempts');fs.mkdirSync(out,{recursive:true});
const report={sourceCommit:process.env.BUILD_COMMIT,scope:'Production software WebGL; real-control scripted routes, not human playtesting. Room49 retains one legacy setup reset before observation; room7 starts directly from Play. All pairs remain or are retargeted by shots, never deleted by debug API.',rows:[],pass:false};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');save();
for(const [level,name,width,height]of [[7,'wide',1280,720],[7,'portrait',390,844],[49,'wide',1280,720],[49,'portrait',390,844],[49,'9by16',450,800]]){
 const row={level,name,width,height,errors:[],consoleErrors:[],images:[],pass:false};report.rows.push(row);
 const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'],protocolTimeout:240000});
 try{
  const page=await browser.newPage();await page.setViewport({width,height});
  page.on('pageerror',e=>row.errors.push(String(e.stack||e)));page.on('console',m=>{if(m.type()==='error')row.consoleErrors.push(m.text());});
  const fixture=campaignAccessFixture({levelIndex:level-1,pathname:'/campaign-v67/'});fixture.preferences.quality='balanced';fixture.raw=JSON.stringify(fixture.preferences);row.fixture=fixture;
  await page.evaluateOnNewDocument(({key,raw})=>{localStorage.clear();localStorage.setItem(key,raw);},fixture);
  await page.goto(`${process.env.PAGE_ORIGIN||'http://127.0.0.1:4173'}/campaign-v67/?edition=foundation&level=${level}&debug=1`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready'&&!document.querySelector('#start-screen').inert&&getComputedStyle(document.querySelector('#start-screen')).opacity==='1',{timeout:180000});
  await page.evaluate(()=>{const r=window.__NESI_DEMO_GAME__.renderer;window.__REPAIR_LOOP__=r.setAnimationLoop;r.setAnimationLoop=function(){return window.__REPAIR_LOOP__.call(this,null);};r.setAnimationLoop(null);});
  await page.click('#play-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.state==='playing');
  assert.deepEqual(await page.evaluate(()=>window.__NESI_PREFS__.value.completed),fixture.completed);
  const result=await page.evaluate(async level=>{
   const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop=window.__REPAIR_LOOP__;delete window.__REPAIR_LOOP__;
   if(g.levelIndex!==level-1||g.physics.world.stepnumber!==0||g.elapsed!==0)throw Error('Not the untouched target Play spawn');
   const cargo=g.cargo,group=cargo.group,body=g.physics.cargoBody,shape=body.shapes[0],player=g.playerGroup,clear=g.clearPortals,update=g.updatePlaying,reset=g.resetRun,images=[];
   let observations=0,resets=0,deletions=0;
   g.clearPortals=()=>{deletions++;throw Error('Unavailable player action: pair deletion');};
   g.resetRun=function(...a){resets++;return reset.apply(this,a);};
   g.updatePlaying=function(...a){if(g.playerGroup!==player||g.cargo!==cargo||g.cargo.group!==group||g.physics.cargoBody!==body||body.shapes[0]!==shape)throw Error('Original actor replaced');observations++;return update.apply(this,a);};
   window.__NESI_CAPTURE_LEVEL_MARK__=mark=>images.push({mark,png:g.renderer.domElement.toDataURL('image/png').split(',')[1]});
   try{const route=await window.__NESI_RUN_LEVEL_ROUTE__(level===7?{nativeStart:true}:{});return{route,observations,resets,deletions,state:g.state,sameOriginal:g.cargo===cargo&&g.physics.cargoBody===body&&body.shapes[0]===shape,pairReady:g.portals.ready,images};}
   catch(e){return{error:String(e.stack||e),observations,resets,deletions,state:g.state,images};}
   finally{g.clearPortals=clear;g.updatePlaying=update;g.resetRun=reset;delete window.__NESI_CAPTURE_LEVEL_MARK__;}
  },level);
  for(const [i,image]of result.images.entries()){
   const bytes=Buffer.from(image.png,'base64');assert.ok(bytes.length>10000);const filename=`room-${level}-${name}-${String(i+1).padStart(2,'0')}.png`;
   fs.writeFileSync(path.join(out,filename),bytes);row.images.push({filename,mark:image.mark,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
  }
  delete result.images;row.result=result;save();assert.equal(result.error,undefined);assert.equal(result.route.pass,true);assert.equal(result.state,'won');assert.equal(result.deletions,0);assert.equal(result.route.resets+result.route.respawns,0);assert.equal(result.resets,level===7?0:1);assert.equal(result.sameOriginal,true);assert.equal(result.pairReady,true);
  assert.deepEqual(await page.evaluate(()=>window.__NESI_PREFS__.value.completed),[...fixture.completed,level-1]);assert.deepEqual(row.errors,[]);assert.deepEqual(row.consoleErrors,[]);row.pass=true;
  console.log('ORDINARY REPAIR PASS',level,name);
 }catch(e){row.failure=String(e.stack||e);console.error('ORDINARY REPAIR FAIL',level,name,row.failure);}finally{save();await browser.close();}
}
report.pass=report.rows.length===5&&report.rows.every(r=>r.pass);save();if(!report.pass)process.exitCode=1;
