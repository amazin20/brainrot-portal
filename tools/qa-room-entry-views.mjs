// Real production WebGL entry views. Optional variants move only normal orbit
// inputs at zero physics steps; they are labelled inspections, not saved views.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {serveFrozenCampaign} from '../scripts/lib/frozen-campaign-server.mjs';
import {campaignAccessFixture} from '../scripts/lib/campaign-access-fixture.mjs';

const {default:puppeteer}=await import(process.env.PUPPETEER_MODULE||'puppeteer-core');
const root=fileURLToPath(new URL('..',import.meta.url));
const out=path.resolve(process.env.OUT_DIR||path.join(root,'qa/entry-views'));
const dist=path.resolve(process.env.DIST_DIR||path.join(root,'dist'));
const levels=(process.env.LEVELS||'36').split(',').map(Number);
const kinds=(process.env.KINDS||'wide,portrait').split(',');
const variants=JSON.parse(process.env.CAMERA_VARIANTS||'[]');
assert.ok(levels.length&&levels.every(n=>Number.isInteger(n)&&n>=1&&n<=51));
assert.ok(kinds.length&&kinds.every(k=>['wide','portrait'].includes(k)));
assert.ok(variants.every(v=>/^[a-z0-9-]+$/.test(v.name)&&Number.isFinite(v.yaw)&&Number.isFinite(v.pitch)));
assert.ok(!fs.existsSync(out)||fs.readdirSync(out).length===0,'Choose an empty output folder; preserve previous attempts.');
fs.mkdirSync(out,{recursive:true});
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const inventory=()=>Object.fromEntries(fs.readdirSync(dist,{recursive:true}).filter(f=>fs.statSync(path.join(dist,f)).isFile()).sort().map(f=>[f,hash(fs.readFileSync(path.join(dist,f)))]));
const report={kind:'production-zero-step-entry-views',sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
  sourceFiles:Object.fromEntries(['src/game/LabCreativeFinalRooms.js','src/game/LabCamera.js'].map(f=>[f,hash(fs.readFileSync(path.join(root,f)))])),
  build:inventory(),scope:'Native production WebGL entry and optional ordinary orbit inspections; no route, hardware FPS or whole-room aesthetic acceptance.',rows:[],pass:false};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
save();
const mounted=await serveFrozenCampaign(dist);
try{
 for(const level of levels)for(const kind of kinds){
  const viewport=kind==='wide'?{width:1280,height:720}:{width:390,height:844};
  const row={level,kind,viewport,views:[],errors:[],pass:false};report.rows.push(row);save();
  let browser;
  try{
   browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,
    args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'],protocolTimeout:180000});
   const page=await browser.newPage();await page.setViewport({...viewport,deviceScaleFactor:1});
   page.on('pageerror',e=>row.errors.push(String(e.stack||e)));
   page.on('console',m=>{if(m.type()==='error')row.errors.push(m.text());});
   const fixture=campaignAccessFixture({levelIndex:level-1,pathname:new URL(mounted.url).pathname});
   fixture.preferences.quality='balanced';fixture.raw=JSON.stringify(fixture.preferences);
   await page.evaluateOnNewDocument(({key,raw})=>{localStorage.setItem(key,raw);},fixture);
   await page.goto(`${mounted.url}?edition=foundation&level=${level}&debug=1`,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready'&&!document.querySelector('#start-screen').inert&&getComputedStyle(document.querySelector('#start-screen')).opacity==='1',{timeout:180000});
   await page.evaluate(()=>{const r=window.__NESI_DEMO_GAME__.renderer,loop=r.setAnimationLoop;r.setAnimationLoop=()=>loop.call(r,null);loop.call(r,null);});
   await page.click('#play-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='playing');
   for(const view of [{name:'spawn'},...variants]){
    const result=await page.evaluate(view=>{
     const g=window.__NESI_DEMO_GAME__;
     const state=()=>({level:g.levelIndex+1,id:g.firstLevel.id,state:g.state,steps:g.physics.world.stepnumber,elapsed:g.elapsed,
      player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),bodyId:g.physics.cargoBody.id,shapeId:g.physics.cargoBody.shapes[0].id});
     const before=state();
     if(view.name!=='spawn'){g.yaw=view.yaw;g.pitch=view.pitch;g.cameraRig.reset(g.playerPosition,g.yaw,g.pitch);}
     g.updateVisuals(0,1,0);g.render();
     const gl=g.renderer.getContext(),extension=gl.getExtension('WEBGL_debug_renderer_info');
     return {before,after:state(),yaw:g.yaw,pitch:g.pitch,camera:{position:g.camera.position.toArray(),quaternion:g.camera.quaternion.toArray(),fov:g.camera.fov},
      renderer:{webgl:g.renderer.isWebGLRenderer,contextLost:gl.isContextLost(),name:extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)},
      png:g.renderer.domElement.toDataURL('image/png').split(',')[1]};
    },view);
    assert.equal(result.before.level,level);assert.equal(result.before.steps,0);assert.equal(result.before.elapsed,0);assert.equal(result.before.state,'playing');
    assert.deepEqual(result.after,result.before);assert.equal(result.renderer.webgl,true);assert.equal(result.renderer.contextLost,false);
    const bytes=Buffer.from(result.png,'base64');delete result.png;assert.ok(bytes.length>10000,'Blank or missing WebGL readback');
    const filename=`room-${level}-${kind}-${view.name}.png`,uiFilename=`room-${level}-${kind}-${view.name}-ui.png`;
    fs.writeFileSync(path.join(out,filename),bytes);await page.screenshot({path:path.join(out,uiFilename)});
    row.views.push({name:view.name,...result,filename,uiFilename,bytes:bytes.length,sha256:hash(bytes)});save();
   }
   assert.deepEqual(await page.evaluate(()=>window.__NESI_PREFS__.value.completed),fixture.completed);
   assert.deepEqual(row.errors,[]);row.pass=true;
   console.log(JSON.stringify({event:'entry-complete',level,kind,views:row.views.length}));
  }catch(error){row.failure=String(error.stack||error);console.error(row.failure);}
  finally{if(browser)await browser.close();save();}
 }
 assert.deepEqual(inventory(),report.build,'The served production package changed during capture');
 report.pass=report.rows.every(row=>row.pass)&&report.rows.length===levels.length*kinds.length;save();
 if(!report.pass)process.exitCode=1;
}finally{await new Promise(resolve=>mounted.server.close(resolve));}
