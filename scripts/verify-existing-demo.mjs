/** Independent read-only launch check. Never rebuilds or publishes a game.
 * Preserve progress before browser operations so a renderer stall is diagnosable. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import puppeteer from 'puppeteer-core';
import {waitForStartMenu,activate} from './lib/singularity-ui-check.mjs';
const root='https://amazin20.github.io/brainrot-portal/';
const expectedSource='6f1eec54d47fed7916f5346a218525292d15fd62';
const expectedPublication='37401009893';
const out=path.resolve('demo-launch-proof');fs.mkdirSync(out,{recursive:true});
const accepted=JSON.parse(fs.readFileSync('publication-input/expedition-release.json','utf8'));
assert.equal(accepted.sourceCommit,expectedSource);assert.equal(String(accepted.publicationRun),expectedPublication);
const report={pass:false,verificationRun:process.env.GITHUB_RUN_ID,verificationController:process.env.GITHUB_SHA,verifiedPublicationRun:expectedPublication,sourceCommit:expectedSource,phase:'identity',runtimeFiles:0,plays:[],errors:[],scope:'read-only exact runtime bytes, fresh desktop/mobile launches, pause, restart and reload; not a full gallery playback audit'};
const flush=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
const phase=value=>{report.phase=value;flush();console.log(value);};
const fetchJSON=async relative=>{const url=new URL(relative,root);url.searchParams.set('launch-check',String(Date.now()));const r=await fetch(url,{signal:AbortSignal.timeout(30000)});assert.equal(r.status,200);return r.json();};
let browser,page;
try{
 assert.deepEqual(await fetchJSON('expedition-release.json'),accepted);
 const info=await fetchJSON('build-info.json');assert.equal(info.commit,expectedSource);assert.equal(info.levels,51);assert.equal(info.version,'v50-expedition');report.version=info.version;report.levels=info.levels;flush();
 phase('hash all63 accepted runtime files');
 let next=0;await Promise.all(Array.from({length:4},async()=>{while(next<accepted.exactCandidateFiles.length){const f=accepted.exactCandidateFiles[next++];assert.ok(!f.path.startsWith('/')&&!f.path.split('/').includes('..'));const r=await fetch(new URL(f.path,root),{signal:AbortSignal.timeout(30000)});assert.equal(r.status,200);const b=Buffer.from(await r.arrayBuffer());assert.equal(b.length,f.bytes);assert.equal(createHash('sha256').update(b).digest('hex'),f.sha256,f.path);report.runtimeFiles++;flush();}}));
 phase('start independent browser');
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,protocolTimeout:60000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 for(const test of [{width:960,height:720,mobile:false,levels:[1,41,42,51]},{width:390,height:844,mobile:true,levels:[42,51]}]){
  for(const level of test.levels){
   phase(`fresh ${test.mobile?'mobile':'desktop'} room ${level}`);
   const context=await browser.createBrowserContext();page=await context.newPage();page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(30000);
   page.on('pageerror',error=>{report.errors.push(String(error));flush();});
   await page.setViewport({width:test.width,height:test.height,deviceScaleFactor:1,isMobile:test.mobile,hasTouch:test.mobile});
   await page.goto(root+'?edition=foundation&level='+level,{waitUntil:'domcontentloaded'});await page.bringToFront();await waitForStartMenu(page);
   assert.equal(await page.$$eval('#level-select option',nodes=>nodes.length),51);assert.equal(await page.$eval('#level-select',e=>Number(e.value)),level-1);
   assert.equal(await page.evaluate(()=>typeof window.__NESI_DEMO_GAME__),'undefined');
   await page.select('#quality-select','low');
   await page.$eval('#play-button',e=>e.addEventListener('click',event=>{document.documentElement.dataset.launchTrusted=String(event.isTrusted);},{once:true,capture:true}));
   await page.screenshot({path:path.join(out,`menu-${test.width}-${level}.png`)});
   await activate(page,'#play-button',test.mobile);
   await page.waitForFunction(level=>document.documentElement.dataset.runtimeState==='playing'&&Number(document.documentElement.dataset.levelIndex)===level-1,{},level);
   assert.equal(await page.evaluate(()=>document.documentElement.dataset.launchTrusted),'true');
   const row={level,width:test.width,height:test.height,mobile:test.mobile,trustedPlay:true,pause:false,restart:false,reload:false};report.plays.push(row);flush();
   await page.screenshot({path:path.join(out,`playing-${test.width}-${level}.png`)});
   if(test.mobile){
    const bounds=await page.evaluate(()=>['#joystick','#sprint-button','#jump-button',...Array.from({length:4},(_,i)=>`.lab-mobile button:nth-child(${i+1})`)].map(selector=>{const e=document.querySelector(selector),r=e?.getBoundingClientRect();return{selector,visible:!!r&&r.width>=40&&r.height>=40&&r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,hit:!!r&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};}));
    assert.ok(bounds.every(b=>b.visible&&b.hit));row.touchControls=bounds;
    await activate(page,'.lab-mobile button:nth-child(4)',true);
   }else await page.keyboard.press('Escape');
   await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='paused');row.pause=true;flush();
   await activate(page,'#restart-button',test.mobile);await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='playing');row.restart=true;flush();
   await page.reload({waitUntil:'domcontentloaded'});await page.bringToFront();await waitForStartMenu(page);assert.equal(await page.$eval('#level-select',e=>Number(e.value)),level-1);row.reload=true;flush();
   await context.close();page=null;
  }
 }
 assert.equal(report.runtimeFiles,63);assert.equal(report.plays.length,6);assert.deepEqual(report.errors,[]);report.pass=true;phase('complete');
}catch(error){report.error=String(error);report.stack=error.stack;flush();if(page){report.failureState=await page.evaluate(()=>({url:location.href,state:document.documentElement.dataset.runtimeState,level:document.documentElement.dataset.levelIndex,focused:document.hasFocus(),hidden:document.hidden})).catch(()=>null);flush();await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});}throw error;}
finally{flush();await browser?.close();}
