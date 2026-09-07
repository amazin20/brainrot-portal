import fs from 'node:fs';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import {CAMPAIGN} from '../src/game/LabCampaignLevels.js';
const out='/mnt/data/NESI-v17-delivery',images=out+'/screenshots';fs.mkdirSync(images,{recursive:true});
const executablePath=['/usr/bin/chromium','/usr/bin/google-chrome','/usr/bin/chromium-browser'].find(p=>fs.existsSync(p));
if(!executablePath)throw Error('No Chromium binary available');
const report={mode:'Offline in-memory rendering of the self-contained HTML; no localhost navigation, no policy overrides.',renderer:'Chromium SwiftShader; not a user GPU benchmark',routes:[],pageErrors:[],unmappedNetwork:[],pass:false};
let browser;
try{
 browser=await puppeteer.launch({executablePath,headless:true,protocolTimeout:180000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage();await page.setViewport({width:1280,height:800});page.setDefaultTimeout(120000);
 page.on('pageerror',e=>report.pageErrors.push(e.message));
 page.on('request',r=>{if(/^https?:/.test(r.url()))report.unmappedNetwork.push(r.url());});
 await page.evaluate(()=>window.__NESI_REVIEW_QUERY__='debug=1');
 // All content was produced in the local workspace. No network resource is visited.
 await page.setContent(fs.readFileSync(out+'/NESI-20-levels.html','utf8'),{waitUntil:'load',timeout:180000});
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready');
 assert.equal(await page.$$eval('#level-select option',a=>a.length),20);assert.equal(CAMPAIGN.length,20);
 await page.screenshot({path:images+'/menu.png'});await page.locator('#play-button').click();
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.state==='playing');
 for(let i=0;i<20;i++){
  if(i){await page.waitForFunction(()=>!document.pointerLockElement&&!document.querySelector('#win-screen').inert);await page.locator('#play-again-button').click();await page.waitForFunction(index=>window.__NESI_DEMO_GAME__.levelIndex===index&&window.__NESI_DEMO_GAME__.state==='playing',{},i);}
  await page.screenshot({path:images+`/level-${i+1}-start.png`});
  const route=await page.evaluate(()=>window.__NESI_RUN_LEVEL_ROUTE__());
  assert.ok(route.pass&&route.respawns===0&&route.resets===0,`Course ${i+1} failed`);report.routes.push(route);
  assert.equal(await page.$eval('#level-number',e=>e.textContent),String(i+1));
  await page.screenshot({path:images+`/level-${i+1}-complete.png`});
  fs.writeFileSync(out+'/browser-verification.json',JSON.stringify(report,null,2));
 }
 assert.equal(await page.$('#quick-hint'),null);assert.equal(await page.$('#quick-settings'),null);
 report.modelFiles=await page.evaluate(()=>[...new Set(window.__NESI_LOCAL_REQUESTS__.filter(n=>n.endsWith('.glb')))]);
 assert.equal(report.modelFiles.length,18);
 assert.deepEqual(report.pageErrors,[]);assert.deepEqual(report.unmappedNetwork,[]);
 report.pass=true;
 const meta=JSON.parse(fs.readFileSync(out+'/verification.json'));meta.browserVerified=true;meta.browserVerification='browser-verification.json';meta.published=false;fs.writeFileSync(out+'/verification.json',JSON.stringify(meta,null,2));
 console.log('PASS: 20 actual Chromium routes; 18 embedded GLBs; no network dependency or page errors.');
}catch(e){report.error=String(e);console.error(e);process.exitCode=1;}finally{fs.writeFileSync(out+'/browser-verification.json',JSON.stringify(report,null,2));await browser?.close();}
