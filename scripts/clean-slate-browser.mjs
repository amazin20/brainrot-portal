import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
const order=process.env.ORDER||'cargo-first',root=process.env.PAGE_URL||'http://127.0.0.1:4173/';
const out=`smoke-artifacts/clean-slate-${order}`;fs.mkdirSync(out,{recursive:true});
const report={commit:process.env.GITHUB_SHA,order,pass:false,errors:[],scope:'Full deterministic ordinary-input route in real WebGL; milestone screenshots, NOT full video or human difficulty acceptance.'};
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,protocolTimeout:900000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
let page;
try{
 page=await browser.newPage();page.setDefaultTimeout(120000);await page.setViewport({width:1280,height:720});
 page.on('pageerror',e=>report.errors.push(e.message));await page.goto(root+'?level=21&debug=1&smoke=1',{waitUntil:'networkidle2'});
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='playing'||document.documentElement.dataset.runtimeState==='error');
 const error=await page.$eval('#error-detail',e=>e.textContent);assert.equal(error,'','Game failed to initialize: '+error);
 await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop(null);g.renderer.setPixelRatio(1);g.render();});
 await page.screenshot({path:path.join(out,'start.png')});
 const result=await page.evaluate(async order=>{
  const g=window.__NESI_DEMO_GAME__,frames=[];
  // Use the shipped production route helper; no direct actor or mechanism edits.
  window.__NESI_CAPTURE_LEVEL_MARK__=m=>{
   g.render();frames.push({name:m.name,image:g.renderer.domElement.toDataURL('image/png'),player:m.player,cargo:m.cargo});
  };
  let route;
  try{route=await window.__NESI_RUN_LEVEL_ROUTE__(order==='recovery'?{recovery:true}:{order});}
  finally{delete window.__NESI_CAPTURE_LEVEL_MARK__;}
  return {route,frames};
 },order);
 report.route=result.route;
 report.milestones=result.frames.map((f,i)=>{const file=`${String(i).padStart(2,'0')}.png`;fs.writeFileSync(path.join(out,file),Buffer.from(f.image.split(',')[1],'base64'));return {name:f.name,file,player:f.player,cargo:f.cargo};});
 await page.screenshot({path:path.join(out,'complete.png')});
 assert.ok(result.route.pass);assert.equal(result.route.resets,0);assert.equal(result.route.respawns,0);assert.deepEqual(report.errors,[]);report.pass=true;
}catch(e){report.failure=e.stack;if(page){await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});report.startup=await page.evaluate(()=>({state:document.documentElement.dataset.runtimeState,error:document.querySelector('#error-detail')?.textContent})).catch(()=>null);}throw e;}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
