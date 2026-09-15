import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
const out='smoke-artifacts/room21-r2';fs.mkdirSync(out,{recursive:true});
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const report={commit:process.env.BUILD_COMMIT||null,scope:'Full ordinary routes in actual WebGL; screenshots are milestones, not a full 30fps video or a hardware benchmark.',routes:[],errors:[]};
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,protocolTimeout:600000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 for(const variant of ['cargo-first','scout-first','recovery']){
  const page=await browser.newPage();await page.setViewport({width:1280,height:720});page.setDefaultTimeout(120000);
  page.on('pageerror',e=>report.errors.push(String(e)));
  await page.goto((process.env.PAGE_URL||'http://127.0.0.1:4173/')+'?level=21&debug=1',{waitUntil:'networkidle2'});
  await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready');await page.click('#play-button');
  await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='playing');
  const result=await page.evaluate(async variant=>{
   const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop(null);g.renderer.setPixelRatio(1);g.renderer.setSize(1280,720);
   const images=[];window.__NESI_CAPTURE_LEVEL_MARK__=mark=>{g.render();images.push({mark,data:g.renderer.domElement.toDataURL('image/jpeg',.87)});};
   const route=await window.__NESI_RUN_LEVEL_ROUTE__(variant==='recovery'?{recovery:true}:{order:variant});
   return {route,images,won:g.firstLevel.isWon(),diagnostics:g.diagnostics(),render:{...g.renderer.info.render},memory:{...g.renderer.info.memory},
    mechanisms:{source:g.firstLevel.state.sourceDrive.car.progress,brake:g.firstLevel.state.sourceDrive.brake,hood:g.firstLevel.state.freightHood.progress,bridge:g.firstLevel.state.returnBridge.floor.y}};
  },variant);
  assert(result.won&&result.route.pass&&result.route.resets===0&&result.route.respawns===0);
  result.stills=result.images.map(({mark,data},i)=>{const file=`${variant}-${String(i).padStart(2,'0')}.jpg`,bytes=Buffer.from(data.split(',')[1],'base64');fs.writeFileSync(path.join(out,file),bytes);return{file,mark,sha256:sha(bytes)};});delete result.images;
  report.routes.push({variant,...result});await page.close();
 }
 assert.deepEqual(report.errors,[]);report.pass=true;
}catch(error){report.failure=error.stack;throw error;}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
