import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {setTimeout as wait} from 'node:timers/promises';
import puppeteer from 'puppeteer-core';
import {CAMPAIGN} from '../src/game/LabCampaignLevels.js';
import {CAMPAIGN_ASSET_IDS} from '../src/game/labAssets.js';
import {runPortalEdgeBrowser} from './portal-edge-browser.mjs';
import {runFlightAudioBrowser} from './flight-audio-browser.mjs';
const base=(process.env.PAGE_URL||'').replace(/\/$/,'')+'/',expected=process.env.GITHUB_SHA;
assert.ok(base.startsWith('https://')&&expected,'Public URL and expected revision are required');
fs.mkdirSync('live-evidence',{recursive:true});
const report={pass:false,expected,base,models:[],puzzles:[],routes:[],campaignTransitions:[],legacyLinks:[],errors:[]};
let browser,page;
try{
 let info;
 for(let attempt=0;attempt<30;attempt++){
  try{const r=await fetch(base+'build-info.json?revision='+expected+'&attempt='+attempt,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(20000)});if(r.ok){info=await r.json();if(info.commit===expected)break;}}
  catch(error){console.log('Publication propagation:',String(error));}
  await wait(5000);
 }
 assert.equal(info?.commit,expected);assert.equal(info?.levels,CAMPAIGN.length);assert.equal(info?.version,'v40-laboratory-33');assert.equal(info?.levels,33);assert.equal(info?.artVersion,'v40-research-laboratory');report.build=info;
 const response=await fetch(base+'models/runtime/manifest.json?revision='+expected);assert.ok(response.ok);const manifest=await response.json();
 assert.deepEqual(manifest.models.map(m=>m.id).sort((a,b)=>a-b),[...CAMPAIGN_ASSET_IDS]);
 const source=JSON.parse(fs.readFileSync('public/models/runtime/manifest.json','utf8'));
 for(const model of manifest.models){
  const original=source.models.find(m=>m.id===model.id);assert.ok(original);assert.equal(model.outputSHA256,original.outputSHA256);
  const r=await fetch(base+'models/runtime/'+model.filename+'?revision='+expected,{signal:AbortSignal.timeout(20000)});assert.ok(r.ok);
  const bytes=Buffer.from(await r.arrayBuffer());assert.equal(createHash('sha256').update(bytes).digest('hex'),model.outputSHA256);assert.equal(bytes.length,model.outputBytes);
  report.models.push({id:model.id,bytes:bytes.length,verified:true});
 }
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,protocolTimeout:720000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 page=await browser.newPage();page.setDefaultTimeout(120000);await page.setViewport({width:960,height:600});page.on('pageerror',e=>report.errors.push(e.message));
 // All thirty-three routes pass the deployment gate. Recheck public transitions,
 // the rebuilt garden, new rooms and finale through the published package.
 for(const level of [1,9,10,20,24,26,27,28,29,30,31,32,33]){
  report.stage={level,step:'loading'};
  await page.goto(base+'?edition=classic&debug=1&level='+level+'&revision='+expected,{waitUntil:'networkidle2'});
  await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready');
  assert.equal(await page.$$eval('#level-select option',a=>a.length),CAMPAIGN.length);
  assert.equal(await page.title(),'БРЕЙНРОТ ПОРТАЛ — физическая 3D-головоломка');
  report.stage={level,step:'ordinary Play click'};
  // Wait for the animated button to become stable, without bypassing real input.
  await page.locator('#play-button').click();await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.state==='playing'&&window.__NESI_DEMO_GAME__.performanceMonitor.stats.fps>0);
  const puzzle=await page.evaluate(()=>{const l=window.__NESI_DEMO_GAME__.firstLevel;return {id:l.id,portalPuzzle:l.portalPuzzle,terminals:l.terminals?.length??0,bounds:l.bounds};});
  assert.equal(puzzle.id,CAMPAIGN[level-1].id);if(level>=20)assert.equal(puzzle.portalPuzzle,true);
  report.puzzles.push({level,...puzzle});
  await page.screenshot({path:`live-evidence/room-${level}-public-start.png`});
  report.stage={level,step:'ordinary route'};
  const route=await page.evaluate(()=>window.__NESI_RUN_LEVEL_ROUTE__());
  assert.ok(route.pass&&route.respawns===0&&route.resets===0);assert.equal(route.level,level);report.routes.push(route);
  await page.screenshot({path:`live-evidence/room-${level}-public-complete.png`});
  if(level===10||level===20||level===26||level===30){
   await page.waitForFunction(()=>!document.pointerLockElement&&getComputedStyle(document.querySelector('#win-screen')).opacity==='1');
   await page.locator('#play-again-button').click();
   await page.waitForFunction(index=>window.__NESI_DEMO_GAME__.levelIndex===index&&window.__NESI_DEMO_GAME__.state==='playing',{},level);
   const continuation=await page.evaluate(()=>({level:window.__NESI_DEMO_GAME__.levelIndex+1,epicMode:window.__NESI_DEMO_GAME__.epicMode}));
   assert.equal(continuation.level,level+1);assert.equal(continuation.epicMode,false);
   report.campaignTransitions.push({from:level,to:continuation.level,primaryButton:true});
  }
 }
 await page.waitForFunction(()=>!document.pointerLockElement&&getComputedStyle(document.querySelector('#win-screen')).opacity==='1');await page.locator('#play-again-button').click();
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.levelIndex===0&&window.__NESI_DEMO_GAME__.state==='playing');
 assert.equal(await page.$eval('#level-number',e=>e.textContent),'1');
 report.campaignTransitions.push({from:33,to:1,primaryButton:true});
 await page.screenshot({path:'live-evidence/campaign-wrap-to-room-1.png'});assert.deepEqual(report.errors,[]);
 for(const {query,level} of [{query:'mode=velocity&chapter=1',level:1},{query:'mode=velocity&chapter=2&return=21',level:21}]){
  await page.goto(base+'?debug=1&'+query+'&revision='+expected,{waitUntil:'networkidle2'});
  await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready');
  const migrated=await page.evaluate(()=>({level:window.__NESI_DEMO_GAME__.levelIndex+1,epicMode:window.__NESI_DEMO_GAME__.epicMode,
   mode:document.body.dataset.gameMode,velocityControls:document.querySelectorAll('[id^="velocity-"]').length,
   oldRouteHook:typeof window.__NESI_RUN_VELOCITY_ROUTE__,url:location.href}));
  assert.equal(migrated.level,level);assert.equal(migrated.epicMode,false);assert.equal(migrated.mode,'campaign');
  assert.equal(migrated.velocityControls,0);assert.equal(migrated.oldRouteHook,'undefined');
  for(const key of ['mode','chapter','return'])assert.equal(new URL(migrated.url).searchParams.has(key),false);
  report.legacyLinks.push({query,...migrated});
 }
 await page.close();
 report.portalEdge=await runPortalEdgeBrowser({browser,baseUrl:base,out:'live-evidence/portal-edge',capture:false});
 assert.equal(report.portalEdge.pass,true);
 report.flightAudio=await runFlightAudioBrowser({browser,baseUrl:base,out:'live-evidence/flight-audio',capture:false});
 assert.equal(report.flightAudio.pass,true);
 assert.deepEqual(report.errors,[]);report.pass=true;
 console.log('LIVE VERIFIED',expected,'v40 campaign: 33 rooms; public ordinary routes 1,9,10,20,24,26–33; transitions 10→11,20→21,26→27,30→31,33→1; live model hashes; room9 regressions; original companion present at every finish');
}catch(error){
 report.error=String(error);
 if(page&&!page.isClosed()){
  report.failure=await page.evaluate(()=>({url:location.href,state:window.__NESI_DEMO_GAME__?.state,level:window.__NESI_DEMO_GAME__?.levelIndex,
   fps:window.__NESI_DEMO_GAME__?.performanceMonitor?.stats?.fps,activeScreens:[...document.querySelectorAll('.screen--active')].map(e=>e.id)})).catch(e=>({probeError:String(e)}));
  await page.screenshot({path:'live-evidence/failure.png'}).catch(()=>{});
 }
 throw error;
}
finally{fs.writeFileSync('live-evidence/report.json',JSON.stringify(report,null,2));await browser?.close();}
