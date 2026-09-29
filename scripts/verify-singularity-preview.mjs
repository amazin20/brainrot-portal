import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import puppeteer from 'puppeteer-core';
const config=JSON.parse(fs.readFileSync('tools/singularity-preview-release.json','utf8'));
const root=new URL(process.env.PAGE_URL||'https://amazin20.github.io/brainrot-portal/');
const preview=new URL('tower-singularity/',root),out=path.resolve('publication-proof');fs.mkdirSync(out,{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function bytes(url){const response=await fetch(url);assert.equal(response.status,200,`HTTP ${response.status}: ${url}`);return Buffer.from(await response.arrayBuffer());}
let release;
for(let attempt=0;attempt<60;attempt++){
 try{const u=new URL('preview-release.json',preview);u.searchParams.set('verify',String(Date.now()));const r=await fetch(u);if(r.ok){const value=await r.json();if(value.sourceCommit===config.sourceCommit&&value.mode===config.mode){release=value;break;}}}catch{}
 await new Promise(resolve=>setTimeout(resolve,5000));
}
assert.ok(release,'The exact preview did not become publicly available');
const base=JSON.parse(await bytes(new URL('build-info.json',root)));assert.equal(base.commit,config.baseCommit);
const info=JSON.parse(await bytes(new URL('build-info.json',preview)));assert.equal(info.commit,config.sourceCommit);assert.equal(info.features.tower.stages,13);
const html=await bytes(new URL('index.html',preview));assert.equal(hash(html),hash(fs.readFileSync('candidate/index.html')));
const bundle=html.toString().match(/src="([^"]+\.js)"/);assert.ok(bundle);
const js=await bytes(new URL(bundle[1],preview));assert.equal(hash(js),hash(fs.readFileSync(path.join('candidate',bundle[1]))));
const manifest=JSON.parse(await bytes(new URL('models/runtime/manifest.json',preview)));
for(const model of manifest.models){const data=await bytes(new URL('models/runtime/'+model.filename,preview));assert.equal(hash(data),model.outputSHA256);}
const proof={sourceCommit:config.sourceCommit,mode:config.mode,url:preview.href,baseCommit:base.commit,modelHashes:manifest.models.length,ordinaryMenu:false,ordinaryPlay:false,resetAfterSolvedPuzzle:false,video:null,errors:[]};
if(config.mode==='complete'){
 assert.ok(release.video);const movie=await bytes(new URL(release.video.filename,preview));assert.equal(hash(movie),release.video.sha256);assert.equal(movie.length,release.video.bytes);
 proof.video={sha256:hash(movie),bytes:movie.length,seekTimes:[]};
}
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,protocolTimeout:1_800_000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage();page.setDefaultTimeout(180000);await page.setViewport({width:960,height:540,deviceScaleFactor:1});page.on('pageerror',e=>proof.errors.push(String(e)));
 const gameURL=new URL(preview);gameURL.searchParams.set('level','41');gameURL.searchParams.set('edition','foundation');
 await page.goto(gameURL.href,{waitUntil:'networkidle2'});
 await page.waitForFunction(()=>{const b=document.querySelector('#play-button');const m=document.querySelector('#start-screen');return b&&!b.disabled&&m&&!m.inert&&getComputedStyle(m).opacity==='1';});
 assert.equal(await page.$eval('#level-select',e=>Number(e.value)),40);
 assert.match(await page.$eval('#level-select option[value="40"]',e=>e.textContent),/СИНГУЛЯРНОСТИ/);
 assert.equal(await page.evaluate(()=>typeof window.__NESI_DEMO_GAME__),'undefined','Ordinary user page must not enable the debug route');
 proof.ordinaryMenu=true;await page.select('#quality-select','low');await page.bringToFront();await page.click('#play-button');
 await page.waitForFunction(()=>{const m=document.querySelector('#start-screen');return !m||m.inert||getComputedStyle(m).opacity==='0';});
 await new Promise(resolve=>setTimeout(resolve,1500));await page.screenshot({path:path.join(out,'public-ordinary-game.png')});proof.ordinaryPlay=true;
 // A separate diagnostic visit observes a real solved puzzle and public reset.
 gameURL.searchParams.set('debug','1');await page.goto(gameURL.href,{waitUntil:'networkidle2'});await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready');
 await page.waitForFunction(()=>{const m=document.querySelector('#start-screen');return m&&!m.inert&&getComputedStyle(m).opacity==='1';});await page.bringToFront();await page.click('#play-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.state==='playing');
 const partial=await page.evaluate(async()=>window.__NESI_RUN_LEVEL_ROUTE__({order:['orrery'],stopAfter:'orrery'}));
 assert.equal(partial.partial,true);assert.deepEqual(partial.metrics.solvedIds,['orrery']);assert.equal(partial.resets+partial.respawns+partial.cargoResets,0);
 await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop(g.animate);});await page.bringToFront();await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.state==='paused');
 await page.waitForSelector('#restart-button',{visible:true});await page.waitForFunction(()=>!document.querySelector('#restart-button').closest('[inert]'));await page.click('#restart-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.state==='playing');
 const reset=await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;return {atSpawn:g.playerPosition.distanceTo(g.firstLevel.spawn)<.5,solved:g.firstLevel.getTowerMetrics().solvedIds,checkpoints:g.firstLevel.getTowerMetrics().checkpoints};});
 assert.equal(reset.atSpawn,true);assert.deepEqual(reset.solved,[]);assert.equal(reset.checkpoints,false);proof.resetAfterSolvedPuzzle=true;proof.publicPuzzleSeconds=partial.seconds;
 await page.goto(new URL('walkthrough.html',preview).href,{waitUntil:'domcontentloaded'});
 if(config.mode==='complete'){
  await page.waitForFunction(()=>{const v=document.querySelector('video');return v&&Number.isFinite(v.duration)&&v.duration>900;});
  const duration=await page.$eval('video',v=>v.duration);assert.ok(Math.abs(duration-release.video.durationSeconds)<.12);
  for(const fraction of [.2,.6,.99]){
   const time=duration*fraction;await page.$eval('video',(v,time)=>{v.muted=true;v.currentTime=time;},time);
   await page.waitForFunction(time=>{const v=document.querySelector('video');return !v.error&&!v.seeking&&v.readyState>=2&&Math.abs(v.currentTime-time)<1;},{timeout:90000},time);
   proof.video.seekTimes.push(await page.$eval('video',v=>v.currentTime));
  }
  await page.screenshot({path:path.join(out,'public-video-seeking.png')});
 }else assert.equal(await page.$('video'),null);
 assert.deepEqual(proof.errors,[]);proof.pass=true;
 fs.writeFileSync(path.join(out,'public-proof.json'),JSON.stringify(proof,null,2)+'\n');console.log('PUBLIC PREVIEW VERIFIED',JSON.stringify(proof));
}catch(error){proof.pass=false;proof.error=String(error);fs.writeFileSync(path.join(out,'public-proof.json'),JSON.stringify(proof,null,2)+'\n');throw error;}
finally{await browser.close();}
