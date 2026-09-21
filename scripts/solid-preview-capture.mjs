import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const out=process.env.EVIDENCE_OUT||'smoke-artifacts/solid-models';fs.mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,protocolTimeout:180000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage();await page.setViewport({width:1280,height:800});page.setDefaultTimeout(120000);
const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message);});
for(const level of [30,27,28,29,24]){
 await page.goto(`http://127.0.0.1:4173/?debug=1&level=${level}`,{waitUntil:'networkidle2'});
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready');await page.click('#play-button');
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='playing');
 await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;g.render();});
 await page.screenshot({path:`${out}/level-${level}-start.png`});
 console.log('captured',level,await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;return {quality:g.quality,colliders:g.colliders.length,triangles:g.renderer.info.render.triangles,calls:g.renderer.info.render.calls};}));
}
await browser.close();if(errors.length)throw new Error(errors.join('\n'));
