import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import puppeteer from 'puppeteer-core';

const out=path.resolve(process.env.OUT_DIR||'qa/puzzle-pilot43-browser');
fs.mkdirSync(out,{recursive:true});
const base=process.env.PAGE_URL||'http://127.0.0.1:4173/';
const errors=[],shots=[],report={pass:false,sourceCommit:process.env.BUILD_COMMIT||null,errors,shots,
 limitations:['Scripted production controls and software WebGL; human puzzle discovery and physical-device FPS are not measured.']};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
let server,browser;
try{
 if(process.env.START_SERVER==='1'){
  server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4173'],{stdio:'ignore'});
  for(let n=0;n<200;n++){
   if(server.exitCode!==null)throw Error('Preview server stopped');
   try{if((await fetch(base)).ok)break;}catch{}
   assert(n<199,'Preview did not start');await new Promise(r=>setTimeout(r,50));
  }
 }
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,protocolTimeout:600000,
  args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage();page.setDefaultTimeout(180000);
 await page.setViewport({width:960,height:540,deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(String(e)));
 const originalKey='brainrot-foundation-v1:brainrot-portal.preferences.v24';
 const originalSave=JSON.stringify({quality:'low',muted:true,tutorial:true,completed:[0,1,42],resumeLevel:42,campaignRevision:'creative-campaign-v48',roomRevisions:{16:'cable-supported-architecture-v1',32:'siphon-observatory-v1',50:'echo-horizon-v1'}});
 await page.evaluateOnNewDocument(({originalKey,originalSave})=>{
  localStorage.setItem(originalKey,originalSave);
  const key='brainrot-puzzle-pilot43-v1:brainrot-portal.preferences.v24';
  if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({quality:'low',muted:true,tutorial:true}));
 },{originalKey,originalSave});
 await page.exposeFunction('__NESI_SAVE_PILOT_FRAME__',(name,data,state)=>{
  assert.match(name,/^[a-z0-9-]+$/);assert.match(data,/^data:image\/jpeg;base64,/);
  const file=name+'.jpg';fs.writeFileSync(path.join(out,file),Buffer.from(data.slice(data.indexOf(',')+1),'base64'));
  shots.push({file,...state});save();
 });
 const url=new URL(base);url.searchParams.set('edition','foundation');url.searchParams.set('level','43');url.searchParams.set('pilot','43');url.searchParams.set('debug','1');
 await page.goto(url.href,{waitUntil:'networkidle2'});
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready');
 const info=await page.evaluate(async()=>{const r=await fetch('build-info.json');if(!r.ok)throw Error('Missing build metadata');return r.json();});
 if(process.env.BUILD_COMMIT)assert.equal(info.commit,process.env.BUILD_COMMIT);
 report.build=info.commit;
 assert.equal(await page.evaluate(()=>window.__NESI_DEMO_GAME__.firstLevel.pilot43),true);
 assert.equal(await page.$eval('#level-select',e=>e.options.length),1);
 assert.equal(await page.$eval('#level-select',e=>e.value),'42');
 assert.match(await page.$eval('.edition-navigation',e=>e.textContent),/Прежняя комната 43/);
 await page.waitForFunction(()=>{const e=document.querySelector('#start-screen');return !e.inert&&getComputedStyle(e).opacity==='1';});
 await page.$eval('#play-button',e=>e.scrollIntoView({block:'center'}));
 await page.click('#play-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='playing');
 const route=await page.evaluate(async()=>{
  const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop(null);
  const identity=g.cargo.group.uuid,body=g.physics.cargoBody.id,writes=[];
  const capture=name=>{
   g.render();writes.push(window.__NESI_SAVE_PILOT_FRAME__(name,g.renderer.domElement.toDataURL('image/jpeg',.9),{
    state:g.state,player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),camera:g.camera.position.toArray(),
    calls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles,width:g.renderer.domElement.width,height:g.renderer.domElement.height}));
  };
  capture('start');let index=0;
  window.__NESI_CAPTURE_LEVEL_MARK__=mark=>capture('step-'+String(++index).padStart(2,'0'));
  try{
   const result=await window.__NESI_RUN_LEVEL_ROUTE__();capture('finish');await Promise.all(writes);
   return {...result,state:g.state,sameCompanion:g.cargo.group.uuid===identity&&g.physics.cargoBody.id===body};
  }finally{delete window.__NESI_CAPTURE_LEVEL_MARK__;await Promise.allSettled(writes);}
 });
 report.route=route;save();assert.equal(route.pass,true);assert.equal(route.state,'won');assert.equal(route.sameCompanion,true);
 assert.equal(route.resets,0);assert.equal(route.respawns,0);assert.ok(route.milestones.length>=3);
 assert.equal(await page.evaluate(key=>localStorage.getItem(key),originalKey),originalSave,'Pilot must preserve campaign progress');
 report.originalProgressUnchanged=true;
 await page.click('#play-again-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='playing');
 assert.equal(await page.evaluate(()=>window.__NESI_DEMO_GAME__.firstLevel.pilot43),true);
 assert.equal(await page.evaluate(()=>window.__NESI_DEMO_GAME__.levelIndex),42);report.replayPassed=true;
 await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='paused');
 await page.click('#resume-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='playing');report.pauseResumePassed=true;
 await page.evaluate(()=>window.__NESI_DEMO_GAME__.renderer.setAnimationLoop(null));
 await page.setViewport({width:390,height:844,deviceScaleFactor:1});
 await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;g.viewportResize();g.render();});
 await page.screenshot({path:path.join(out,'mobile.png')});report.mobileControls=await page.$eval('#mobile-controls',e=>!e.inert);
 const pixelCode=`import json,sys\nfrom PIL import Image,ImageStat\nr=[]\nfor p in sys.argv[1:]:\n im=Image.open(p).convert('RGB');s=im.resize((64,36));v=max(ImageStat.Stat(s).stddev);assert v>2,(p,v);r.append({'file':p.split('/')[-1],'width':im.width,'height':im.height,'std':v})\nprint(json.dumps(r))`;
 report.pixels=JSON.parse(execFileSync(process.env.CODEX_PRIMARY_RUNTIME_PYTHON||'python3',['-c',pixelCode,...shots.map(s=>path.join(out,s.file))],{encoding:'utf8'}));
 assert.deepEqual(errors,[]);report.pass=true;save();console.log(JSON.stringify({pass:true,routeFrames:route.frames,teleports:route.teleports,shots:shots.length}));
}catch(e){report.failure=String(e?.stack||e);save();throw e;}
finally{await browser?.close();server?.kill();}
