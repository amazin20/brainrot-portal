/** Production UI review. No debug globals, actor setters or forged completion. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import puppeteer from 'puppeteer-core';
import {activate,waitForStartMenu} from './lib/singularity-ui-check.mjs';
const out=path.resolve(process.env.OUT_DIR||'qa/atlas-browser');fs.mkdirSync(out,{recursive:true});
const port=process.env.PORT||'4196',base=process.env.PAGE_URL||`http://127.0.0.1:${port}/`;
const server=process.env.PAGE_URL?null:spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',port],{stdio:'ignore'});
const report={pass:false,scope:'Production menu, genuine pointer/touch activation, settings persistence, real loading and screenshots. Not a hardware FPS benchmark.',cases:[],errors:[]};let browser,page;
try{
 for(let i=0;i<200;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,50));}
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH,headless:true,protocolTimeout:240000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const cases=[{width:1440,height:900,level:1},{width:1024,height:768,level:11},{width:390,height:844,level:21},{width:844,height:390,level:31},{width:360,height:800,level:41},{width:1440,height:900,level:51}];
 for(const [index,c]of cases.entries()){
  const touch=c.width<500||c.height<500;page=await browser.newPage();page.setDefaultTimeout(120000);
  page.on('pageerror',e=>report.errors.push(e.message));await page.setViewport({...c,deviceScaleFactor:1,isMobile:touch,hasTouch:touch});
  await page.evaluateOnNewDocument(()=>{const key='brainrot-foundation-v1:brainrot-portal.preferences.v24';if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({quality:'low',muted:true}));});
  const url=new URL(base);url.search=`?edition=foundation&level=${c.level}`;
  await page.goto(url.href,{waitUntil:'domcontentloaded'});await waitForStartMenu(page);
  assert.equal(await page.evaluate(()=>typeof window.__NESI_DEMO_GAME__),'undefined');
  const info=await page.evaluate(async()=>await(await fetch('build-info.json')).json());report.sourceCommit=info.commit;report.version=info.version;
  assert.equal(info.levels,51);assert.equal(await page.$$eval('.sector-tabs [data-sector]',xs=>xs.length),6);
  const nodes=await page.$$eval('.sector-nodes .room-node',xs=>xs.map(e=>Number(e.dataset.level)));assert.deepEqual(nodes,c.level===51?[51]:Array.from({length:10},(_,i)=>c.level+i));
  assert.equal(await page.$eval('#level-select',e=>Number(e.value)),c.level-1);
  const bounds=await page.$eval('#start-screen',e=>({width:e.clientWidth,scroll:e.scrollWidth}));assert.ok(bounds.scroll<=bounds.width+2,'Horizontal overflow');
  await page.$eval('#start-screen',e=>e.scrollTo(0,0));await page.screenshot({path:path.join(out,`chapter-${c.level}-${c.width}.png`)});
  for(const level of [nodes[0],nodes.at(-1)])await activate(page,`.room-node[data-level="${level}"]`,touch);
  assert.equal(await page.$eval('#level-select',e=>Number(e.value)),nodes.at(-1)-1);
  await activate(page,'#menu-settings-button',touch);await page.waitForSelector('#menu-settings[open]');
  await page.screenshot({path:path.join(out,`settings-${c.width}-${c.level}.png`)});
  const previous=await page.$eval('#menu-tutorial',e=>e.checked);await activate(page,'#menu-tutorial',touch);
  assert.equal(await page.$eval('#tutorial-toggle',e=>e.checked),!previous);
  await activate(page,'#menu-settings-done',touch);assert.equal(await page.evaluate(()=>document.activeElement?.id),'menu-settings-button');
  await activate(page,'#menu-settings-button',touch);assert.equal(await page.$eval('#menu-tutorial',e=>e.checked),!previous);
  await page.keyboard.press('Escape');assert.equal(await page.$eval('#menu-settings',e=>e.open),false);
  await activate(page,`.room-node[data-level="${c.level}"]`,touch);await activate(page,'#play-button',touch);
  await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='playing');
  await page.screenshot({path:path.join(out,`playing-${c.level}-${c.width}.png`)});
  if(touch)await activate(page,'.lab-mobile button:nth-child(4)',true);else await page.keyboard.press('Escape');
  await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='paused');await activate(page,'#level-menu-button',touch);await waitForStartMenu(page);
  await page.reload({waitUntil:'domcontentloaded'});await waitForStartMenu(page);await activate(page,'#menu-settings-button',touch);
  assert.equal(await page.$eval('#menu-tutorial',e=>e.checked),!previous,'Setting did not survive reload');await activate(page,'#menu-settings-done',touch);
  report.cases.push({...c,nodes,settings:true,nativePlay:true,pauseToMap:true,reloaded:true,noHorizontalOverflow:true,debugGlobalsAbsent:true});
  fs.writeFileSync(path.join(out,'progress.json'),JSON.stringify(report,null,2));await page.close();page=null;
 }
 // Cold loading keyframe: hold the real model requests, rather than inventing
 // a progress value or adding a delay to the production game.
 page=await browser.newPage();await page.setViewport({width:1440,height:900});await page.setRequestInterception(true);const held=[];
 page.on('request',r=>r.url().includes('/models/')?held.push(r):r.continue());
 await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForSelector('#loading.screen--active');
 await page.screenshot({path:path.join(out,'actual-loading.png')});
 assert.ok(held.length>0,'Loading image must correspond to outstanding real model requests');for(const r of held)await r.continue();await page.setRequestInterception(false);await waitForStartMenu(page);
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 assert.equal(await page.$eval('.mission-art-orbit',e=>getComputedStyle(e).animationName),'none');report.reducedMotion=true;report.realLoadingCapture=true;
 assert.deepEqual(report.errors,[]);report.pass=true;
}catch(error){report.error=String(error);report.stack=error.stack;await page?.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});process.exitCode=1;}
finally{await browser?.close();server?.kill();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
