import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {setTimeout as wait} from 'node:timers/promises';
import puppeteer from 'puppeteer-core';
import {CAMPAIGN} from '../src/game/LabCampaignLevels.js';
import {CAMPAIGN_ASSET_IDS} from '../src/game/labAssets.js';
import {runPortalEdgeBrowser} from './portal-edge-browser.mjs';
const base=(process.env.PAGE_URL||'').replace(/\/$/,'')+'/',expected=process.env.GITHUB_SHA;
assert.ok(base.startsWith('https://')&&expected,'Public URL and expected revision are required');
fs.mkdirSync('live-evidence',{recursive:true});
const report={pass:false,expected,base,models:[],errors:[]};
let browser;
try{
 let info;
 for(let attempt=0;attempt<30;attempt++){
  try{const r=await fetch(base+'build-info.json?revision='+expected+'&attempt='+attempt,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(20000)});if(r.ok){info=await r.json();if(info.commit===expected)break;}}
  catch(error){console.log('Publication propagation:',String(error));}
  await wait(5000);
 }
 assert.equal(info?.commit,expected);assert.equal(info?.levels,CAMPAIGN.length);assert.equal(info?.version,'v25-atrium-refinement');assert.equal(info?.levels,12);report.build=info;
 const response=await fetch(base+'models/runtime/manifest.json?revision='+expected);assert.ok(response.ok);const manifest=await response.json();
 assert.deepEqual(manifest.models.map(m=>m.id).sort((a,b)=>a-b),[...CAMPAIGN_ASSET_IDS]);
 const source=JSON.parse(fs.readFileSync('public/models/runtime/manifest.json','utf8'));
 for(const model of manifest.models){
  const original=source.models.find(m=>m.id===model.id);assert.ok(original);assert.equal(model.outputSHA256,original.outputSHA256);
  const r=await fetch(base+'models/runtime/'+model.filename+'?revision='+expected,{signal:AbortSignal.timeout(20000)});assert.ok(r.ok);
  const bytes=Buffer.from(await r.arrayBuffer());assert.equal(createHash('sha256').update(bytes).digest('hex'),model.outputSHA256);assert.equal(bytes.length,model.outputBytes);
  report.models.push({id:model.id,bytes:bytes.length,verified:true});
 }
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,protocolTimeout:300000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage();page.setDefaultTimeout(120000);await page.setViewport({width:960,height:600});page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(base+'?debug=1&level=12&revision='+expected,{waitUntil:'networkidle2'});
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready');
 assert.equal(await page.$$eval('#level-select option',a=>a.length),12);
 assert.equal(await page.title(),'БРЕЙНРОТ ПОРТАЛ — физическая 3D-головоломка');
 await page.click('#play-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.state==='playing'&&window.__NESI_DEMO_GAME__.performanceMonitor.stats.fps>0);
 report.puzzle=await page.evaluate(()=>{const l=window.__NESI_DEMO_GAME__.firstLevel;return {id:l.id,portalPuzzle:l.portalPuzzle,terminals:l.terminals.length,bounds:l.bounds};});
 assert.equal(report.puzzle.id,CAMPAIGN[11].id);assert.equal(report.puzzle.portalPuzzle,true);assert.equal(report.puzzle.terminals,0);
 await page.screenshot({path:'live-evidence/room-12-public-start.png'});
 report.route=await page.evaluate(()=>window.__NESI_RUN_LEVEL_ROUTE__());assert.ok(report.route.pass&&report.route.respawns===0&&report.route.resets===0);assert.equal(report.route.level,12);
 await page.screenshot({path:'live-evidence/room-12-public-complete.png'});
 await page.waitForFunction(()=>!document.pointerLockElement&&getComputedStyle(document.querySelector('#win-screen')).opacity==='1');await page.locator('#play-again-button').click();
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.levelIndex===0&&window.__NESI_DEMO_GAME__.state==='playing');
 assert.equal(await page.$eval('#level-number',e=>e.textContent),'1');
 await page.screenshot({path:'live-evidence/campaign-wrap-to-room-1.png'});assert.deepEqual(report.errors,[]);await page.close();
 report.portalEdge=await runPortalEdgeBrowser({browser,baseUrl:base,out:'live-evidence/portal-edge',capture:false});
 assert.equal(report.portalEdge.pass,true);report.pass=true;
 console.log('LIVE VERIFIED',expected,'v25: БРЕЙНРОТ ПОРТАЛ, 12 rooms, reverse-perspective ordinary route, campaign wrap, live model hashes and room9 jump/turn portal regressions');
}catch(error){report.error=String(error);throw error;}
finally{fs.writeFileSync('live-evidence/report.json',JSON.stringify(report,null,2));await browser?.close();}
