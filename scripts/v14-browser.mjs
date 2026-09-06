import fs from 'node:fs';import assert from 'node:assert/strict';import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage();page.setDefaultTimeout(120000);await page.setViewport({width:1280,height:800});
const errors=[];page.on('pageerror',e=>errors.push(e.message));const result={};
try{
 await page.goto('http://127.0.0.1:4173/?debug=1&level=10',{waitUntil:'networkidle2'});
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready');
 await page.click('#play-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.state==='playing');
 result.recovery=await page.evaluate(()=>window.__NESI_RUN_RECOVERY_ROUTE__());
 assert.ok(result.recovery.pass&&result.recovery.resets===0&&result.recovery.respawns===0);
 assert.ok(result.recovery.milestones.every(m=>m.teleports===0));
 result.areas=await page.evaluate(()=>window.__NESI_DEMO_GAME__.firstLevel.explorationSurfaces.map(s=>({name:s.name,width:s.width,height:s.height})));
 assert.ok(result.areas.length>=3);fs.mkdirSync('smoke-artifacts',{recursive:true});
 await page.screenshot({path:'smoke-artifacts/v14-recovered.png'});assert.deepEqual(errors,[]);
 console.log('PASS production WebGL: fall and climb back with no portal preparation, no reset.');
}finally{fs.mkdirSync('smoke-artifacts',{recursive:true});fs.writeFileSync('smoke-artifacts/v14-recovery.json',JSON.stringify({...result,errors},null,2));await browser.close();}
