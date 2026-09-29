import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import puppeteer from 'puppeteer-core';
const out=path.resolve('qa/singularity-additional');fs.mkdirSync(out,{recursive:true});
const source='b1bf88fb90b85e3b0786c651fcd2ba2edcf92696',url='https://amazin20.github.io/brainrot-portal/tower-singularity/?edition=foundation&level=41&debug=1';
const order=['reservoir','echo','archive','transmission','drydock','migrant','orrery','parallax','optics','accumulator','magnet','inertia','inversion'];
const evidence={sourceCommit:source,url,pass:false,errors:[],method:'Additional ordinary-input route on the public production demo, followed by a separate mid-attempt reload check. No actor placement, puzzle-state assignment or video recording.'};
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,protocolTimeout:1800000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
let page;
async function start(){
 await page.goto(url,{waitUntil:'networkidle2'});await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready');
 const info=await page.evaluate(async()=>{const r=await fetch('build-info.json',{cache:'no-store'});return r.json();});assert.equal(info.commit,source);
 await page.select('#quality-select','low');await page.waitForFunction(()=>{const m=document.querySelector('#start-screen');return m&&!m.inert&&getComputedStyle(m).opacity==='1';});await page.bringToFront();await page.click('#play-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.state==='playing');
}
try{
 page=await browser.newPage();page.setDefaultTimeout(180000);await page.setViewport({width:960,height:540,deviceScaleFactor:1});page.on('pageerror',e=>evidence.errors.push(String(e)));
 await start();evidence.alternative=await page.evaluate(async order=>window.__NESI_RUN_LEVEL_ROUTE__({order}),order);
 const r=evidence.alternative;assert.equal(r.pass,true);assert.equal(r.metrics.won,true);assert.deepEqual(r.metrics.solvedIds,order);assert.equal(r.metrics.completedStages,13);assert.equal(r.resets+r.respawns+r.cargoResets,0);assert.equal(r.sameCompanion,true);assert.equal(r.metrics.checkpoints,false);
 assert.ok(r.metrics.events.findIndex(e=>e.id==='archive')<r.metrics.events.findIndex(e=>e.id==='optics'),'Upper hall must precede later ground halls');
 await page.evaluate(()=>window.__NESI_DEMO_GAME__.render());await page.screenshot({path:path.join(out,'public-alternative-victory.png')});
 console.log('PUBLIC ALTERNATIVE PASS',r.seconds,r.activeSeconds);
 await start();evidence.partial=await page.evaluate(async()=>window.__NESI_RUN_LEVEL_ROUTE__({order:['orrery'],stopAfter:'orrery'}));assert.deepEqual(evidence.partial.metrics.solvedIds,['orrery']);assert.equal(evidence.partial.partial,true);
 // Reload directly while a solved wing remains in the unfinished attempt.
 // Do not restart first: that would fail to test the checkpoint boundary.
 await page.reload({waitUntil:'networkidle2'});await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready');
 evidence.afterReload=await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;return {state:g.state,level:g.levelIndex+1,atSpawn:g.playerPosition.distanceTo(g.firstLevel.spawn)<.5,metrics:g.firstLevel.getTowerMetrics()};});
 assert.equal(evidence.afterReload.level,41);assert.equal(evidence.afterReload.atSpawn,true);assert.deepEqual(evidence.afterReload.metrics.solvedIds,[]);assert.equal(evidence.afterReload.metrics.completedStages,0);assert.equal(evidence.afterReload.metrics.checkpoints,false);
 assert.deepEqual(evidence.errors,[]);evidence.pass=true;
}catch(error){evidence.error=String(error);if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw error;}
finally{fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2)+'\n');await browser.close();}
