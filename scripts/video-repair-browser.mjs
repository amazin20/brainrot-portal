import fs from 'node:fs';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
const out='video-repair-evidence';fs.mkdirSync(out,{recursive:true});
const report={pass:false,errors:[],networkFailures:[],note:'Real production GLBs/rendering. Stress cases use explicit reachable starting fixtures; the positive room route uses normal controls and actual travelling shots. Not a user-GPU FPS benchmark.'};
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,timeout:60000,protocolTimeout:240000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
let page;
const image=(name,data)=>fs.writeFileSync(`${out}/${name}.png`,Buffer.from(data.split(',')[1],'base64'));
try{
 page=await browser.newPage();await page.setViewport({width:960,height:600});page.setDefaultTimeout(120000);
 page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',e=>{if(e.type()==='error'&&!e.text().startsWith('Failed to load resource:'))report.errors.push(e.text());});
 page.on('response',r=>{if(r.status()>=400)report.networkFailures.push({url:r.url(),status:r.status()});});
 await page.goto('http://127.0.0.1:4173/?debug=1&level=11',{waitUntil:'networkidle2'});await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready');
 await page.click('#play-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.state==='playing');
 await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop(null);});
 const controls=await page.evaluate(()=>({mobile:[...document.querySelectorAll('.lab-mobile button')].map(e=>e.textContent),hint:document.querySelector('.control-grid').textContent}));
 assert.ok(!controls.mobile.some(t=>t==='◎'||t==='X'));assert.ok(!controls.hint.includes('удерживать прицел')&&!controls.hint.includes('сбросить пару'));report.controls=controls;
 report.carry=[];
 for(const fps of [30,60,144]){
  const result=await page.evaluate(fps=>{
   const g=window.__NESI_DEMO_GAME__;g.resetRun(true);g.playerPosition.set(1.5,0,8.6);g.previousPlayerPosition.copy(g.playerPosition);g.facing=Math.PI;g.updateVisuals(0,1);g.interact();
   const body=g.physics.cargoBody,geometry=g.assets.get(2),images=[];let acc=0,maxBody=0,maxHand=0,losses=0,resets=0;
   const reset=g.resetRun;g.resetRun=function(...args){resets++;return reset.apply(this,args);};
   try{for(let frame=0;frame<fps*10;frame++){
    const t=frame/fps;if(t>1){g.input.keys.add('KeyW');g.input.keys.add('ShiftLeft');g.yaw=t<4?t*4:-t*6;}
    if(frame%Math.round(fps*.7)===0&&t>1)g.input.jumpQueued=true;
    acc+=1/fps;while(acc>=1/120){g.updatePlaying(1/120);acc-=1/120;}g.updateVisuals(1/fps,acc*120);
    if(g.heldCube!==g.cargo||g.physics.cargoBody!==body||g.assets.get(2)!==geometry)losses++;
    if(t>1&&g.physics.carryTarget){maxBody=Math.max(maxBody,g.physics.carryTarget.position.distanceTo(body.position));const h=g.animator.diagnostics.carryReach;maxHand=Math.max(maxHand,h.leftError||0,h.rightError||0);}
    if(fps===60&&frame>=65&&frame<155){g.render();images.push(g.renderer.domElement.toDataURL());}
   }}finally{g.resetRun=reset;g.input.keys.clear();}
   return{fps,maxBody,maxHand,losses,resets,images};
  },fps);
  result.images.forEach((data,i)=>image(`carry-${fps}-${String(i).padStart(3,'0')}`,data));delete result.images;
  report.carry.push(result);assert.equal(result.losses,0);assert.equal(result.resets,0);assert.ok(result.maxBody<.004,JSON.stringify(result));assert.ok(result.maxHand<.06,JSON.stringify(result));
 }
 report.wind=await page.evaluate(()=>{
  const g=window.__NESI_DEMO_GAME__,step=()=>{g.updatePlaying(1/120);g.updatePlaying(1/120);g.updateVisuals(1/60,1);};
  g.resetRun(true);g.playerPosition.set(-2,0,4);g.previousPlayerPosition.copy(g.playerPosition);g.firstLevel.state.blower.enabled=true;
  const px=g.playerPosition.x;for(let n=0;n<75;n++)step();const playerDistance=g.playerPosition.x-px;
  g.resetRun(true);g.playerPosition.set(-2,0,8);g.previousPlayerPosition.copy(g.playerPosition);g.physics.resetCargo([-2,.4,4]);g.cargo.position.set(-2,.4,4);g.companionBehavior.reanchor(g.cargo.position);g.firstLevel.state.blower.enabled=true;
  const body=g.physics.cargoBody,x=g.cargo.position.x;for(let n=0;n<150;n++)step();g.render();
  return{playerDistance,friendDistance:g.cargo.position.x-x,sameBody:g.physics.cargoBody===body,image:g.renderer.domElement.toDataURL()};
 });image('physical-wind',report.wind.image);delete report.wind.image;assert.ok(report.wind.playerDistance>1&&report.wind.friendDistance>1&&report.wind.sameBody);
 const route=await page.evaluate(async()=>{
  const g=window.__NESI_DEMO_GAME__,update=g.updateVisuals,images=[];let frames=0,shots=0;const fire=g.firePortal;
  g.firePortal=function(...args){const result=fire.apply(this,args);if(result){shots++;frames=72;}return result;};
  g.updateVisuals=function(...args){update.apply(this,args);if(frames>0){frames--;this.render();images.push(this.renderer.domElement.toDataURL());}};
  try{return{route:await window.__NESI_RUN_LEVEL_ROUTE__(),images,shots,terminals:g.firstLevel.terminals.length,automaticDoor:g.firstLevel.state.ratchet.engaged};}
  finally{g.updateVisuals=update;g.firePortal=fire;}
 });
 route.images.forEach((data,i)=>image(`shot-${String(i).padStart(3,'0')}`,data));delete route.images;report.route=route;
 assert.ok(route.route.pass&&route.route.resets===0&&route.route.respawns===0&&route.automaticDoor);assert.equal(route.terminals,1);assert.ok(route.shots>=2);
 await page.screenshot({path:out+'/automatic-door-complete.png'});
 // The altered open-top test enclosure is examined in-room, not from outside
 // the roof. This is art review only, not a positive passage shortcut fixture.
 await page.evaluate(async()=>{const g=window.__NESI_DEMO_GAME__;await g.selectLevel(8,false);g.renderer.setAnimationLoop(null);g.resetRun(true);document.querySelector('#win-screen').classList.remove('screen--active');g.updateVisuals(1/60,1);g.render();});
 await page.screenshot({path:out+'/room9-enclosure.png'});
 const optional=new Set(['/favicon.ico','/.well-known/appspecific/com.chrome.devtools.json']);report.optionalRequests=report.networkFailures.filter(r=>r.status===404&&optional.has(new URL(r.url).pathname));
 assert.deepEqual(report.networkFailures.filter(r=>!report.optionalRequests.includes(r)),[]);assert.deepEqual(report.errors,[]);report.pass=true;
 console.log('Video repair production WebGL passed',JSON.stringify({...report,networkFailures:undefined}));
}catch(error){report.error=String(error);await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});throw error;}
finally{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
