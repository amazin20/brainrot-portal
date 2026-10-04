import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

export async function waitForStartMenu(page){
 await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='ready');
 await page.waitForFunction(()=>{const b=document.querySelector('#play-button'),m=document.querySelector('#start-screen');return b&&!b.disabled&&m&&!m.inert&&getComputedStyle(m).opacity==='1';});
}
async function activate(page,selector,touch=false){
 await page.$eval(selector,e=>e.scrollIntoView({block:'center'}));
 await page.bringToFront();
 await page.waitForFunction(selector=>{const e=document.querySelector(selector),r=e?.getBoundingClientRect();return !!r&&r.width>0&&r.height>0&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));},{},selector);
 if(touch)await page.tap(selector);else await page.click(selector);
}
export async function playFromStartMenu(page,touch=false,quality='low'){
 await waitForStartMenu(page);await page.select('#quality-select',quality);await activate(page,'#play-button',touch);
 await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='playing');
}
async function controlBounds(page,selectors){
 const bounds=await page.evaluate(selectors=>selectors.map(selector=>{const e=document.querySelector(selector),r=e?.getBoundingClientRect(),style=e&&getComputedStyle(e);return {selector,x:r?.x,y:r?.y,width:r?.width,height:r?.height,visible:!!r&&r.width>0&&r.height>0&&style.visibility!=='hidden'&&style.display!=='none',inViewport:!!r&&r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,hit:!!r&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};}),selectors);
 for(const b of bounds){assert.ok(b.visible&&b.inViewport&&b.hit,'Mobile action is hidden, clipped or obstructed: '+b.selector);assert.ok(b.width>=40&&b.height>=40,'Mobile touch target too small: '+b.selector);}
 return bounds;
}
export async function verifySingularityUI(browser,{url,info,out}){
 const ordinary=new URL(url);ordinary.searchParams.set('edition','foundation');ordinary.searchParams.set('level','41');ordinary.searchParams.delete('debug');ordinary.searchParams.delete('smoke');
 const proof={sourceCommit:info.commit,version:info.version,url:ordinary.href,ordinaryMenu:false,ordinaryPlay:false,mobile:[],resetAfterSolvedPuzzle:false,reloadAfterSolvedPuzzle:false,errors:[]};
 fs.mkdirSync(out,{recursive:true});
 const checkIdentity=async page=>{const d=await page.evaluate(async()=>{const r=await fetch('build-info.json',{cache:'no-store'});return r.json();});assert.equal(d.commit,info.commit);assert.equal(d.version,info.version);};
 const monitor=page=>{page.on('pageerror',e=>proof.errors.push(String(e)));page.on('error',e=>proof.errors.push('Renderer: '+String(e)));};
 let page;
 try{
  page=await browser.newPage();page.setDefaultTimeout(180000);await page.setViewport({width:960,height:540,deviceScaleFactor:1});monitor(page);
  await page.goto(ordinary.href,{waitUntil:'domcontentloaded'});await waitForStartMenu(page);await checkIdentity(page);
  assert.equal(await page.$eval('#level-select',e=>Number(e.value)),40);
  assert.match(await page.$eval('#level-select option[value="40"]',e=>e.textContent),/СКЛАДЧАТЫЙ ЗАМОК/i);
  assert.equal(await page.evaluate(()=>typeof window.__NESI_DEMO_GAME__),'undefined');proof.ordinaryMenu=true;
  await playFromStartMenu(page);proof.ordinaryPlay=true;await page.screenshot({path:path.join(out,'ordinary-desktop.png')});await page.close();page=null;
  for(const viewport of [{width:390,height:844},{width:844,height:390}]){
   page=await browser.newPage();page.setDefaultTimeout(180000);await page.setViewport({...viewport,deviceScaleFactor:1,isMobile:true,hasTouch:true});monitor(page);
   await page.goto(ordinary.href,{waitUntil:'domcontentloaded'});await waitForStartMenu(page);await checkIdentity(page);
   assert.equal(await page.evaluate(()=>typeof window.__NESI_DEMO_GAME__),'undefined');
   assert.equal(await page.evaluate(()=>matchMedia('(pointer: coarse)').matches),true);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Mobile page overflows horizontally');
   await page.screenshot({path:path.join(out,`mobile-${viewport.width}-menu.png`)});await playFromStartMenu(page,true);
   const bounds=await controlBounds(page,['#joystick','#sprint-button','#jump-button','.lab-mobile button:nth-child(1)','.lab-mobile button:nth-child(2)','.lab-mobile button:nth-child(3)','.lab-mobile button:nth-child(4)']);
   await page.screenshot({path:path.join(out,`mobile-${viewport.width}-playing.png`)});
   await activate(page,'.lab-mobile button:nth-child(4)',true);await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='paused');
   await activate(page,'#restart-button',true);await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='playing');
   await activate(page,'.lab-mobile button:nth-child(4)',true);await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='paused');
   await activate(page,'#resume-button',true);await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='playing');
   proof.mobile.push({...viewport,ordinaryMenu:true,ordinaryPlay:true,pauseRestartResume:true,bounds});await page.close();page=null;
  }
  const diagnostic=new URL(ordinary);diagnostic.searchParams.set('debug','1');page=await browser.newPage();page.setDefaultTimeout(180000);await page.setViewport({width:960,height:540,deviceScaleFactor:1});monitor(page);
  await page.goto(diagnostic.href,{waitUntil:'domcontentloaded'});await playFromStartMenu(page);
  const stages=await page.evaluate(()=>window.__NESI_DEMO_GAME__.firstLevel.totalStages);assert.equal(stages,info.features.tower.stages);proof.towerStages=stages;
  const partial=await page.evaluate(async()=>window.__NESI_RUN_LEVEL_ROUTE__({order:['freight'],stopAfter:'freight'}));
  assert.equal(partial.partial,true);assert.deepEqual(partial.metrics.solvedIds,['freight']);assert.equal(partial.resets+partial.respawns+partial.cargoResets,0);
  // The deterministic route wrapper stops the render loop. Restore ordinary
  // live input before using the desktop's documented Escape pause action.
  await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop(g.animate);});
  await page.keyboard.press('Escape');await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='paused');
  await activate(page,'#restart-button');await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='playing');
  const reset=await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;return {atSpawn:g.playerPosition.distanceTo(g.firstLevel.spawn)<.5,solved:g.firstLevel.getTowerMetrics().solvedIds,checkpoints:g.firstLevel.getTowerMetrics().checkpoints};});
  assert.equal(reset.atSpawn,true);assert.deepEqual(reset.solved,[]);assert.equal(reset.checkpoints,false);proof.resetAfterSolvedPuzzle=true;
  const second=await page.evaluate(async()=>window.__NESI_RUN_LEVEL_ROUTE__({order:['freight'],stopAfter:'freight'}));assert.deepEqual(second.metrics.solvedIds,['freight']);
  // Runtime readiness is the load contract. Audio/network activity after
  // unloading a live WebGL scene is not a reliable navigation-idle signal.
  await page.reload({waitUntil:'domcontentloaded'});await waitForStartMenu(page);
  const reloaded=await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;return {level:g.levelIndex+1,atSpawn:g.playerPosition.distanceTo(g.firstLevel.spawn)<.5,metrics:g.firstLevel.getTowerMetrics()};});
  assert.equal(reloaded.level,41);assert.equal(reloaded.atSpawn,true);assert.deepEqual(reloaded.metrics.solvedIds,[]);assert.equal(reloaded.metrics.checkpoints,false);
  assert.equal(reloaded.metrics.totalStages,info.features.tower.stages);
  proof.reloadAfterSolvedPuzzle=true;proof.publicPuzzleSeconds=partial.seconds;assert.deepEqual(proof.errors,[]);proof.pass=true;
  await page.screenshot({path:path.join(out,'after-partial-reload.png')});
 }catch(error){proof.pass=false;proof.error=String(error);if(page)await page.screenshot({path:path.join(out,'ui-failure.png')}).catch(()=>{});throw error;}
 finally{fs.writeFileSync(path.join(out,'ui-proof.json'),JSON.stringify(proof,null,2)+'\n');if(page)await page.close();}
 return proof;
}
