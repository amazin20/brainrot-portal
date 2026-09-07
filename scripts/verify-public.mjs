import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {setTimeout as wait} from 'node:timers/promises';
import puppeteer from 'puppeteer-core';
import {runPortalShotBrowser} from './portal-shot-browser.mjs';
const base=(process.env.PAGE_URL||'').replace(/\/$/,'')+'/',expected=process.env.GITHUB_SHA;
assert.ok(base.startsWith('https://')&&expected,'Public URL and expected revision are required');
fs.mkdirSync('live-evidence',{recursive:true});
const report={pass:false,expected,base,models:[],errors:[]};
let browser;
try{
 let info;
 for(let attempt=0;attempt<30;attempt++){
  try{const response=await fetch(base+'build-info.json?revision='+expected+'&attempt='+attempt,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(20000)});if(response.ok){info=await response.json();if(info.commit===expected)break;}}
  catch(error){console.log('Publication propagation:',String(error));}
  await wait(5000);
 }
 assert.equal(info?.commit,expected);assert.equal(info?.levels,20);assert.equal(info?.version,'v20-shot-contact');report.build=info;
 const response=await fetch(base+'models/runtime/manifest.json?revision='+expected);assert.ok(response.ok);const manifest=await response.json();assert.equal(manifest.models.length,18);
 const source=JSON.parse(fs.readFileSync('public/models/runtime/manifest.json','utf8'));
 for(const model of manifest.models){
  const original=source.models.find(m=>m.id===model.id);assert.ok(original);assert.equal(model.outputSHA256,original.outputSHA256);
  const r=await fetch(base+'models/runtime/'+model.filename+'?revision='+expected,{signal:AbortSignal.timeout(20000)});assert.ok(r.ok);
  const bytes=Buffer.from(await r.arrayBuffer());assert.equal(createHash('sha256').update(bytes).digest('hex'),model.outputSHA256);assert.equal(bytes.length,model.outputBytes);
  report.models.push({id:model.id,bytes:bytes.length,verified:true});
 }
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage();page.setDefaultTimeout(120000);await page.setViewport({width:1280,height:800});page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(base+'?debug=1&level=11&revision='+expected,{waitUntil:'networkidle2'});
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready');
 assert.equal(await page.$$eval('#level-select option',a=>a.length),20);assert.equal(await page.$eval('#level-select',e=>e.value),'10');
 await page.click('#play-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.state==='playing'&&window.__NESI_DEMO_GAME__.performanceMonitor.stats.fps>0);
 report.room11=await page.evaluate(()=>{const l=window.__NESI_DEMO_GAME__.firstLevel;return {fan:l.state.blower.art.id,drive:l.state.flywheel.art.id,airflow:l.readability?.airflow?.mesh.name,terminals:l.terminals.length,travellingShots:typeof window.__NESI_DEMO_GAME__.portalShots?.request==='function'};});
 assert.equal(report.room11.terminals,1);assert.equal(report.room11.travellingShots,true);assert.equal(report.room11.fan,31);assert.equal(report.room11.drive,35);assert.equal(report.room11.airflow,'Soft advected airflow');
 await page.screenshot({path:'live-evidence/level-11-public-start.png'});
 report.route=await page.evaluate(()=>window.__NESI_RUN_LEVEL_ROUTE__());assert.ok(report.route.pass&&report.route.respawns===0&&report.route.resets===0);assert.equal(report.route.level,11);
 await page.screenshot({path:'live-evidence/level-11-public-complete.png'});
 await page.waitForFunction(()=>!document.pointerLockElement&&getComputedStyle(document.querySelector('#win-screen')).opacity==='1');await page.locator('#play-again-button').click();
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.levelIndex===11&&window.__NESI_DEMO_GAME__.state==='playing');
 assert.equal(await page.$eval('#level-number',e=>e.textContent),'12');assert.equal(await page.$('#quick-hint'),null);assert.equal(await page.$('#quick-settings'),null);
 await page.screenshot({path:'live-evidence/level-12-public-start.png'});assert.deepEqual(report.errors,[]);
 report.shots=await runPortalShotBrowser({browser,baseUrl:base,out:'live-evidence/portal-shots'});report.pass=true;
 console.log('LIVE VERIFIED',expected,'20 selectable levels, 18 exact models, actual level 11 completed and next-level button opened 12');
}catch(error){report.error=String(error);throw error;}
finally{fs.writeFileSync('live-evidence/report.json',JSON.stringify(report,null,2));await browser?.close();}
