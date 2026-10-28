import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {campaignAccessFixture} from '../../scripts/lib/campaign-access-fixture.mjs';
const {default:puppeteer}=await import(process.env.PUPPETEER_MODULE||'puppeteer-core');
const origin=process.env.DEMO_BASE||'http://127.0.0.1:4173/campaign-v67/';
const expected=process.env.EXPECTED_COMMIT||process.env.GITHUB_SHA;
const out=process.env.DEMO_PROOF_DIR||'evidence/demo-smoke';fs.mkdirSync(out,{recursive:true});
const report={sourceCommit:expected,base:origin,scope:'Native software-WebGL startup smoke; two fresh guest viewports, progression lock, pause/resume and seeded access to remastered rooms. Not all-level acceptance or a real mobile device.',rows:[],pass:false};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');save();
const response=await fetch(new URL('build-info.json?probe='+Date.now(),origin));assert.ok(response.ok);
const info=await response.json();assert.equal(info.commit,expected);assert.equal(info.levels,51);assert.equal(info.verified,false);
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'],protocolTimeout:180000});
try{
 for(const [name,width,height,touch,level]of [['guest-desktop',1280,720,false,null],['guest-touch',390,844,true,null],['locked-castle',1280,720,false,41],['biosphere',1280,720,false,21],['optics',1280,720,false,31],['castle',1280,720,false,41]]){
  const context=await browser.createBrowserContext(),page=await context.newPage();
  const row={name,errors:[],consoleErrors:[],failedRequests:[],pass:false};report.rows.push(row);
  try{
   await page.setViewport({width,height,isMobile:touch,hasTouch:touch,deviceScaleFactor:1});
   page.on('pageerror',e=>row.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')row.consoleErrors.push(m.text());});
   page.on('requestfailed',r=>row.failedRequests.push({url:r.url(),reason:r.failure()?.errorText}));
   const fixture=level&&name!=='locked-castle'?campaignAccessFixture({levelIndex:level-1,pathname:new URL(origin).pathname}):null;
   if(fixture){fixture.preferences.quality='balanced';fixture.raw=JSON.stringify(fixture.preferences);row.fixture={targetIndex:fixture.targetIndex,targetCompleted:false,completed:fixture.completed};
    await page.evaluateOnNewDocument(({key,raw})=>localStorage.setItem(key,raw),fixture);}
   const url=new URL(origin);url.searchParams.set('probe',expected);if(level){url.searchParams.set('debug','1');url.searchParams.set('level',String(level));}
   await page.goto(url.href,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='ready'&&!document.querySelector('#start-screen').inert&&getComputedStyle(document.querySelector('#start-screen')).opacity==='1',{timeout:180000});
   assert.equal(await page.$eval('#level-select',e=>e.options.length),51);
   assert.ok((await page.$eval('#demo-build-label',e=>e.textContent)).includes(expected.slice(0,7)));
   const selected=await page.$eval('#level-select',e=>Number(e.value));assert.equal(selected,fixture?level-1:0);
   if(name==='locked-castle')assert.equal(await page.evaluate(()=>window.__NESI_DEMO_GAME__.levelIndex),0);
   if(!level)assert.equal(await page.evaluate(()=>typeof window.__NESI_DEMO_GAME__),'undefined','Ordinary UI must not expose the debug game');
   await page.screenshot({path:path.join(out,name+'-menu.png')});
   await page.click('#play-button');await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='playing',{timeout:180000});
   if(fixture){row.art=await page.evaluate(()=>{const l=window.__NESI_DEMO_GAME__.firstLevel;return{id:l.id,biosphere:l.biosphereArchitecture?.stats,optics:l.opticsArchitecture?.stats,castle:l.structure?.userData.castleGrandArchitecture?.stats};});
    assert.ok(name==='biosphere'?row.art.biosphere:name==='optics'?row.art.optics:row.art.castle,'Requested remaster absent from running build');
    assert.deepEqual(await page.evaluate(()=>window.__NESI_PREFS__.value.completed),fixture.completed,'Startup cannot award a completion');}
   await page.waitForFunction(()=>document.querySelector('#game canvas')?.width>0);
   const screenshot=path.join(out,name+'-playing.png');await page.screenshot({path:screenshot});
   const bytes=fs.readFileSync(screenshot);assert.ok(bytes.length>15000);row.screenshot={file:path.basename(screenshot),bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
   if(!level){await page.keyboard.press('Escape');await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='paused');
    await page.click('#resume-button');await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='playing');}
   assert.deepEqual(row.errors,[]);assert.deepEqual(row.consoleErrors,[]);assert.deepEqual(row.failedRequests,[]);row.pass=true;
  }catch(e){row.failure=String(e.stack||e);console.error(name,row.failure);}finally{save();await context.close();}
 }
}finally{await browser.close();}
report.pass=report.rows.length===6&&report.rows.every(r=>r.pass);save();if(!report.pass)process.exitCode=1;
