import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import {runRampExploration} from '../src/game/LabRampExplorationJourney.js';

const out=process.env.OUT_DIR||'qa/ramp-exploration';fs.mkdirSync(out,{recursive:true});
const bundle=fs.readdirSync('dist/assets').find(p=>/^LabV8Journey-.*\.js$/.test(p));
assert.ok(bundle,'Production input driver is missing');
const base=process.env.PAGE_URL||'http://127.0.0.1:4173/';
const url=new URL(base);url.search='?edition=open&level=30&debug=1';
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',headless:true,
 protocolTimeout:600000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage();page.setDefaultTimeout(180000);await page.setViewport({width:1280,height:720});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(url.href,{waitUntil:'networkidle2'});await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready');
 const build=await page.evaluate(async()=>{const r=await fetch('build-info.json',{cache:'no-store'});return r.json();});
 if(process.env.BUILD_COMMIT)assert.equal(build.commit,process.env.BUILD_COMMIT);
 let playAttempts=0;
 try{
  // Software WebGL can expose ready before the menu has finished becoming
  // the browser's hit target. Use trusted clicks only when Play is on top.
  for(;playAttempts<3;playAttempts++){
   if(await page.evaluate(()=>window.__NESI_DEMO_GAME__?.state)!=='ready')break;
   await page.waitForFunction(()=>{
    const button=document.querySelector('#play-button'),screen=button?.closest('.screen'),rect=button?.getBoundingClientRect();
    return screen?.classList.contains('screen--active')&&!screen.inert&&getComputedStyle(screen).opacity==='1'&&
      rect?.width>0&&rect?.height>0&&document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2)===button;
   },{timeout:30000});
   await page.locator('#play-button').click();
   if(await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state!=='ready',{timeout:12000}).then(()=>true,()=>false))break;
  }
  await page.waitForFunction(()=>['playing','error'].includes(window.__NESI_DEMO_GAME__?.state),{timeout:180000});
  assert.equal(await page.evaluate(()=>window.__NESI_DEMO_GAME__?.state),'playing');
 }catch(error){
  const diagnostic=await page.evaluate(()=>{
   const button=document.querySelector('#play-button'),screen=button?.closest('.screen'),rect=button?.getBoundingClientRect();
   const target=rect&&document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2);
   return {state:window.__NESI_DEMO_GAME__?.state,bodyState:document.body.dataset.playState,
    externalBlocked:window.__NESI_DEMO_GAME__?.externalBlocked,pointerLocked:!!document.pointerLockElement,
    screenActive:screen?.classList.contains('screen--active'),screenInert:screen?.inert,
    screenOpacity:screen&&getComputedStyle(screen).opacity,target:target?.id||target?.tagName,
    buttonRect:rect&&{x:rect.x,y:rect.y,width:rect.width,height:rect.height},
    errorText:document.querySelector('#error-detail')?.textContent};
  }).catch(e=>({captureFailure:String(e)}));
  fs.writeFileSync(path.join(out,'play-failure.json'),JSON.stringify({attempts:playAttempts,diagnostic,errors,failure:String(error.stack||error)},null,2));
  await page.screenshot({path:path.join(out,'play-failure.png')}).catch(()=>{});
  throw error;
 }
 const result=await page.evaluate(async({source,modulePath,record})=>{
  const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop(null);
  // Serialize our reviewed scenario, not a second, subtly different recorder.
  const scenario=(0,eval)('('+source+')');
  const {runV8Journey}=await import(modulePath);const frames=[],marks=[];let exploration;
  const framing={samples:0,outside:0,maxOverflow:0};
  const shot=()=>{g.render();return g.renderer.domElement.toDataURL('image/png').split(',')[1];};
  const report=await runV8Journey(g,{scenario:d=>{exploration=scenario(d,sample=>{
   let overflow=0;
   for(const y of [-.4,1.2,2.9]){const point=g.playerPosition.clone();point.y+=y;point.project(g.camera);overflow=Math.max(overflow,Math.abs(point.x)-1,Math.abs(point.y)-1,point.z>1?1:0);}
   framing.samples++;if(overflow>0)framing.outside++;framing.maxOverflow=Math.max(framing.maxOverflow,overflow);
   if(record&&sample.frame%4===0)frames.push({...sample,png:shot()});
  });},onMilestone:mark=>marks.push({...mark,png:shot()})});
  return {report,exploration,framing,frames,marks,quality:g.quality,final:g.playerPosition.toArray()};
 },{source:runRampExploration.toString(),modulePath:new URL('assets/'+bundle,base).href,record:process.env.RECORD!=='0'});
 assert.equal(result.report.pass,true);assert.equal(result.report.resets,0);assert.equal(result.report.respawns,0);assert.equal(result.report.teleports,0);
 assert.ok(result.exploration.jumps>=6);assert.ok(result.exploration.minimumSurfaceGap>=-.015);assert.deepEqual(errors,[]);
 fs.mkdirSync(path.join(out,'frames'),{recursive:true});
 for(const [i,f]of result.frames.entries()){fs.writeFileSync(path.join(out,'frames',String(i).padStart(5,'0')+'.png'),Buffer.from(f.png,'base64'));delete f.png;}
 for(const [i,m]of result.marks.entries()){fs.writeFileSync(path.join(out,`mark-${i}.png`),Buffer.from(m.png,'base64'));delete m.png;}
 const evidence={source:build.commit,url:url.href,...result,errors,
  scope:'Continuous ordinary-input exploration from spawn. No staged actor placement; not a puzzle walkthrough or a physical-device FPS measurement.',
  recording:'15 frames per simulated second, four two-second excerpts; intermediate walking is in the trace but not in the video.'};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(evidence,null,2));
 assert.equal(result.framing.samples,480);assert.equal(result.framing.outside,0,'Expanded animated subject envelope leaves the native viewport');
 console.log('RAMP EXPLORATION',JSON.stringify({pass:true,...result.exploration,frames:result.frames.length,source:build.commit}));
}finally{await browser.close();}
