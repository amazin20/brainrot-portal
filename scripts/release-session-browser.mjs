import assert from 'node:assert/strict';
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import {waitForStartMenu} from './lib/singularity-ui-check.mjs';
import {reachStartPlay,playFromReachableMenu} from './lib/release-session-ui.mjs';
const out='qa/release-session';fs.mkdirSync(out,{recursive:true});
const root=process.env.PAGE_URL||'http://127.0.0.1:4173/';
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const result={pass:false,checks:[],errors:[],playControls:[]};let page;
try{
 page=await browser.newPage();page.setDefaultTimeout(180000);await page.setViewport({width:1280,height:720});
 page.on('pageerror',e=>result.errors.push(String(e)));
 const visit=async search=>{await page.goto(root+search,{waitUntil:'domcontentloaded'});await waitForStartMenu(page);};
 await visit('?edition=foundation&level=2&debug=1');
 result.playControls.push(await playFromReachableMenu(page));
 assert.equal(await page.evaluate(()=>window.__NESI_PREFS__.value.resumeLevel),1);
 await visit('');
 assert.equal(await page.$eval('#level-select',e=>e.value),'1');
 assert.match(await page.$eval('#play-button',e=>e.textContent),/Продолжить/);
 assert.equal(await page.$eval('#hint-button',e=>getComputedStyle(e).display),'none');
 assert.equal(await page.evaluate(()=>!!window.__NESI_DEMO_GAME__),false);
 await page.screenshot({path:out+'/resume-desktop.png'});result.checks.push('normal entry resumes room 2; no debug globals or solution button');
 await visit('?edition=foundation&level=1&debug=1');
 assert.equal(await page.$eval('#level-select',e=>e.value),'0');
 const completedBefore=await page.evaluate(()=>window.__NESI_PREFS__.value.completed);
 assert.deepEqual(completedBefore,[]);result.checks.push('explicit room link wins without granting completion');
 result.playControls.push(await playFromReachableMenu(page));
 const route=await page.evaluate(()=>window.__NESI_RUN_LEVEL_ROUTE__());assert.equal(route.pass,true);
 assert.equal(await page.evaluate(()=>window.__NESI_PREFS__.value.resumeLevel),1);
 await visit('');assert.equal(await page.$eval('#level-select',e=>e.value),'1');result.checks.push('ordinary victory persists the next room');
 await page.setViewport({width:844,height:390,isMobile:true,hasTouch:true});
 // Changing mobile emulation can reload Chromium: await the actual menu again.
 await visit('');
 result.landscapeMenu=await reachStartPlay(page,true);
 await page.screenshot({path:out+'/resume-mobile.png'});
 result.landscapePlay=await playFromReachableMenu(page,true);
 assert.equal(await page.evaluate(()=>typeof window.__NESI_DEMO_GAME__),'undefined');
 result.checks.push('landscape mobile Play is reachable by ordinary scrolling and starts via a trusted tap');
 await visit('?debug=1');result.playControls.push(await playFromReachableMenu(page,true));
 const supported=await page.evaluate(()=>{const gl=window.__NESI_DEMO_GAME__.renderer.getContext(),ext=gl.getExtension('WEBGL_lose_context');ext?.loseContext();return !!ext;});
 assert.ok(supported);await page.waitForFunction(()=>document.body.dataset.playState==='error');
 assert.equal(await page.$eval('#error-screen',e=>e.inert),false);
 assert.match(await page.$eval('#error-detail',e=>e.textContent),/3D/);
 await page.screenshot({path:out+'/graphics-recovery.png'});
 await page.tap('#reload-button');await waitForStartMenu(page);
 assert.equal(await page.$eval('#level-select',e=>e.value),'1');result.checks.push('lost WebGL context has a working reload and retained room');
 assert.deepEqual(result.errors,[]);result.pass=true;
}catch(error){result.error=String(error);if(page)await page.screenshot({path:out+'/failure.png'}).catch(()=>{});throw error;}
finally{fs.writeFileSync(out+'/report.json',JSON.stringify(result,null,2));await browser.close();}
