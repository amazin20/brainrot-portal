import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import puppeteer from 'puppeteer-core';
import {captureBrowserFrame} from './qa-browser-capture.mjs';

const out=path.resolve(process.env.OUT_DIR||'qa/creative-viewport-browser');
fs.mkdirSync(out,{recursive:true});
const report={rows:[],errors:[],limitations:[
  'Actual production UI, resize observer, quality controls and WebGL canvas are used; no route or actor state is changed.',
  'Software WebGL does not measure hardware FPS. Pixel capture is reported independently from DOM bounds and hit tests.',
]};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
let server,browser;
async function bounded(promise,ms,label){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(`${label} timed out after ${ms}ms`)),ms);})]);}finally{clearTimeout(timer);}}
async function closeOwnedBrowser(){const old=browser;browser=undefined;if(!old)return;try{await bounded(old.close(),3000,'Owned Chrome close');}catch{const child=old.process();if(child?.exitCode===null){try{process.kill(-child.pid,'SIGKILL');}catch{child.kill('SIGKILL');}}}}
async function waitScreen(page,id){await page.waitForFunction(id=>{const e=document.getElementById(id);return e&&!e.inert&&e.classList.contains('screen--active')&&getComputedStyle(e).opacity==='1'&&getComputedStyle(e).visibility==='visible';},{timeout:60000},id);}
async function scrollAndWaitHit(page,selector){
 await page.$eval(selector,e=>e.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));
 await page.waitForFunction(selector=>{const e=document.querySelector(selector);if(!e||e.closest('[inert]'))return false;const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.x>=0&&r.y>=0&&r.x+r.width<=innerWidth+.5&&r.y+r.height<=innerHeight+.5&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));},{timeout:60000},selector);
}
async function waitTutorial(page){await page.waitForFunction(()=>{const e=document.querySelector('.lab-tutorial');return window.__NESI_DEMO_GAME__?.state==='playing'&&e&&!e.hidden&&getComputedStyle(e).display!=='none'&&e.textContent.trim();},{timeout:60000});}
async function diagnose(page){return await bounded(page.evaluate(()=>{
 const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2),s=getComputedStyle(e);return {x:r.x,y:r.y,width:r.width,height:r.height,hidden:e.hidden,inert:!!e.closest('[inert]'),display:s.display,visibility:s.visibility,opacity:s.opacity,hit:!!hit&&e.contains(hit),hitElement:hit?{tag:hit.tagName,id:hit.id,className:String(hit.className)}:null};};
 const g=window.__NESI_DEMO_GAME__;
 return {state:g?.state,bodyState:document.body.dataset.playState,viewport:{width:innerWidth,height:innerHeight,fine:matchMedia('(pointer:fine)').matches,coarse:matchMedia('(pointer:coarse)').matches,none:matchMedia('(pointer:none)').matches,visual:visualViewport?{width:visualViewport.width,height:visualViewport.height,scale:visualViewport.scale,offsetTop:visualViewport.offsetTop}:null},canvas:rect(g?.renderer?.domElement),pauseScreen:rect(document.querySelector('#pause-screen')),pauseCard:rect(document.querySelector('.pause-card')),quality:rect(document.querySelector('#quality-select')),resume:rect(document.querySelector('#resume-button')),tutorial:rect(document.querySelector('.lab-tutorial')),mobilePause:rect(document.querySelector('.lab-mobile button:last-child'))};
 }),5000,'UI failure DOM diagnostics').catch(error=>({error:String(error)}));}
try{
 if(process.env.START_SERVER==='1'){
  const root=path.resolve(process.env.SERVER_ROOT||'.'),port=String(process.env.PORT||4184);
  server=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),...(process.env.SERVER_MODE==='preview'?['preview']:[]),'--host','127.0.0.1','--port',port],{cwd:root,stdio:'ignore'});
  for(let i=0;i<200;i++){try{if((await fetch(`http://127.0.0.1:${port}/`)).ok)break;}catch{}if(server.exitCode!==null||i===199)throw Error('QA Vite server failed');await new Promise(r=>setTimeout(r,50));}
 }
 const profiles=[
  {name:'desktop',mobile:false,sizes:[[2560,900],[900,900]]},
  {name:'mobile',mobile:true,sizes:[[390,844],[844,390],[390,844]]},
 ];
 for(const profile of profiles){
  browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',headless:true,protocolTimeout:180000,
   args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage();page.setDefaultTimeout(60000);
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.setViewport({width:profile.sizes[0][0],height:profile.sizes[0][1],deviceScaleFactor:1,isMobile:profile.mobile,hasTouch:profile.mobile});
  await page.evaluateOnNewDocument(()=>localStorage.setItem('brainrot-foundation-v1:brainrot-portal.preferences.v24',JSON.stringify({quality:'low',muted:true,tutorial:true})));
  const url=new URL(process.env.PAGE_URL||'http://127.0.0.1:4184/');url.search='?edition=foundation&level=1&debug=1';
  report.active={profile:profile.name,phase:'opening'};save();
  await page.goto(url.href,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready');
  await page.$eval('#play-button',e=>e.scrollIntoView({block:'center'}));
  await page.waitForFunction(()=>{const b=document.querySelector('#play-button'),r=b.getBoundingClientRect();return b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));});
  await page.click('#play-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='playing');
  await waitTutorial(page);
  for(let sizeIndex=0;sizeIndex<profile.sizes.length;sizeIndex++){
   const [width,height]=profile.sizes[sizeIndex];
   await page.setViewport({width,height,deviceScaleFactor:1,isMobile:profile.mobile,hasTouch:profile.mobile});
   for(const quality of ['low','balanced','high']){
    const row={profile:profile.name,sizeIndex,width,height,quality,pass:false,timings:{}};
    report.active={...row,phase:'changing-quality'};save();
    async function phase(name,action){
     row.phase=name;report.active.phase=name;report.active.phaseStartedAt=new Date().toISOString();save();
     const start=performance.now();try{return await action();}finally{row.timings[name]={milliseconds:Number((performance.now()-start).toFixed(1))};save();}
    }
    try{
     await phase('pause-ready',async()=>{
      if(profile.mobile)await page.click('.lab-mobile button:last-child');else await page.keyboard.press('Escape');
      await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='paused');await waitScreen(page,'pause-screen');
     });
     await phase('quality-select',async()=>{
      await scrollAndWaitHit(page,'#quality-select');
      row.qualityControl=await page.$eval('#quality-select',e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {visible:r.width>0&&r.height>0,hit:e.contains(hit),rect:{x:r.x,y:r.y,width:r.width,height:r.height},hitElement:hit?{tag:hit.tagName,id:hit.id}:null};});
      assert.equal(row.qualityControl.visible,true);assert.equal(row.qualityControl.hit,true);await page.select('#quality-select',quality);
     });
     await phase('resume',async()=>{await scrollAndWaitHit(page,'#resume-button');await page.click('#resume-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='playing');});
     await phase('tutorial',()=>waitTutorial(page));
     await phase('buffer-ready',()=>page.waitForFunction(()=>{const g=window.__NESI_DEMO_GAME__,r=g.renderer.domElement.getBoundingClientRect();return Math.abs(g.camera.aspect-r.width/r.height)<1e-5&&Math.abs(g.renderer.domElement.width-r.width*g.renderer.getPixelRatio())<=1&&Math.abs(g.renderer.domElement.height-r.height*g.renderer.getPixelRatio())<=1;}));
     row.metrics=await page.evaluate(()=>{
      const g=window.__NESI_DEMO_GAME__,canvas=g.renderer.domElement;
      const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
      const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&!e.closest('[inert]');};
      const actions=[...document.querySelectorAll('.lab-mobile button,#pause-button,#jump-button,#sprint-button,#joystick')].filter(visible).map(e=>{
       const r=rect(e),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
       return {id:e.id||e.getAttribute('aria-label'),rect:r,inBounds:r.x>=0&&r.y>=0&&r.x+r.width<=innerWidth+.5&&r.y+r.height<=innerHeight+.5,hit:e.contains(hit)};
      });
      const t=document.querySelector('.lab-tutorial'),tutorial=t&&visible(t)?{rect:rect(t),text:t.textContent}:null;
      const overlaps=tutorial?actions.map(a=>({id:a.id,area:Math.max(0,Math.min(a.rect.x+a.rect.width,tutorial.rect.x+tutorial.rect.width)-Math.max(a.rect.x,tutorial.rect.x))*Math.max(0,Math.min(a.rect.y+a.rect.height,tutorial.rect.y+tutorial.rect.height)-Math.max(a.rect.y,tutorial.rect.y))})):[];
      return {state:g.state,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio,coarse:matchMedia('(pointer: coarse)').matches,fine:matchMedia('(pointer:fine)').matches,none:matchMedia('(pointer:none)').matches},canvas:rect(canvas),container:rect(g.container),cameraAspect:g.camera.aspect,
       buffer:{width:canvas.width,height:canvas.height},pixelRatio:g.renderer.getPixelRatio(),quality:g.quality,qualitySelect:document.querySelector('#quality-select').value,actions,tutorial,overlaps,
       calls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles,bodyScrollWidth:document.body.scrollWidth,bodyScrollHeight:document.body.scrollHeight};
     });
     const m=row.metrics,ratio=m.canvas.width/m.canvas.height;
     assert.equal(m.viewport.coarse,profile.mobile);assert.equal(m.viewport.width,width);assert.equal(m.viewport.height,height);
     assert.equal(m.qualitySelect,quality);assert.ok(Math.abs(m.cameraAspect-ratio)<1e-5);
     assert.ok(Math.abs(m.buffer.width-m.canvas.width*m.pixelRatio)<=1);assert.ok(Math.abs(m.buffer.height-m.canvas.height*m.pixelRatio)<=1);
     if(!profile.mobile)assert.ok(ratio<=2+1e-5,'Desktop canvas aspect exceeds 2');
     assert.ok(m.actions.every(a=>a.inBounds&&a.hit),'Visible action is outside viewport or occluded');
     if(profile.mobile)assert.equal(m.actions.length,7,'Expected four mechanism actions plus joystick/jump/sprint');
     assert.ok(m.tutorial&&m.tutorial.text.trim(),'Production tutorial must be visible');assert.ok(m.overlaps.every(o=>o.area===0),'Tutorial overlaps an action');
     assert.deepEqual(errors,[]);row.pass=true;
    }catch(error){
     row.error=String(error);report.errors.push({profile:profile.name,width,height,quality,error:String(error)});row.failureDOM=await diagnose(page);
     if(quality==='high'&&String(error).includes('Timeout'))row.stopRequested='High graphics did not settle within the finite software UI bound';
     // Recover only with the visible production button. The failed assertion
     // remains failed; the next row gets an independent native UI attempt.
     if(!row.stopRequested&&row.failureDOM.state==='paused'){
      try{await waitScreen(page,'pause-screen');await scrollAndWaitHit(page,'#resume-button');await page.click('#resume-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='playing');await waitTutorial(page);row.recovery={method:'native visible Resume click',state:'playing'};}
      catch(error){row.recovery={method:'native visible Resume click',error:String(error),DOM:await diagnose(page)};}
     }
    }
    report.rows.push(row);save();console.log(`${row.pass?'PASS':'FAIL'} viewport ${profile.name} ${width}x${height} ${quality}: ${row.error||`${row.metrics.buffer.width}x${row.metrics.buffer.height}, ${row.metrics.actions.length} actions`}`);
    if(row.stopRequested)throw Error(`${row.stopRequested}: ${profile.name} ${width}x${height} ${row.phase}`);
   }
  }
  if(process.env.CAPTURE!=='0'){
   report.active.phase='capture';save();
   report[`${profile.name}Capture`]=await captureBrowserFrame(page,path.join(out,`${profile.name}-ui.jpg`));save();
  }
  await closeOwnedBrowser();
 }
 delete report.active;report.pass=report.rows.length===15&&report.rows.every(r=>r.pass);save();if(!report.pass)process.exitCode=1;
}catch(error){report.error=String(error);report.pass=false;save();throw error;}
finally{await closeOwnedBrowser();server?.kill('SIGTERM');save();}
