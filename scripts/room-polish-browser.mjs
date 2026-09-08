import fs from 'node:fs';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
const out='room-evidence';fs.mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const report={pass:false,errors:[],note:'In-room views and ordinary-control route; not a hardware FPS benchmark.'};
try{
 const page=await browser.newPage();page.setDefaultTimeout(90000);await page.setViewport({width:1280,height:800});page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/?debug=1&level=11',{waitUntil:'networkidle2'});await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready');
 assert.equal(await page.$$eval('#level-select option',e=>e.length),12);
 await page.click('#play-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.state==='playing');
 await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop(null);g.resetRun(true);g.updateVisuals(1/60,1);g.render();});
 await page.screenshot({path:out+'/start.png'});
 report.fixtures=await page.evaluate(()=>window.__NESI_DEMO_GAME__.firstLevel.fixtures.map(f=>({id:f.id,position:f.art.position.toArray(),pivot:f.pivot?.getWorldPosition(f.art.position.clone()).toArray()})));
 // Cameras remain below the roof. These are diagnostic art views, NOT passage evidence.
 for(const [name,at,target]of [['room',[10,6.5,12],[-3,1,-3]],['blower',[-2,3.5,9],[-7.2,2,4]],['receiver',[.6,3.5,-1.5],[-5.4,2.1,-5]],['door',[1,3,-5],[0,1.8,-12]]]){
  await page.evaluate(({at,target})=>{const g=window.__NESI_DEMO_GAME__;g.camera.position.fromArray(at);g.camera.lookAt(...target);g.camera.updateMatrixWorld(true);g.render();},{at,target});await page.screenshot({path:out+'/'+name+'.png'});
 }
 const result=await page.evaluate(async()=>{
  const g=window.__NESI_DEMO_GAME__,render=g.render,update=g.updateVisuals,images=[],rotorFrames=[];
  let nextWork=5;
  g.render=function(){render.call(this);if(this.state==='playing')images.push(this.renderer.domElement.toDataURL());};
  // Capture the real impeller at consecutive points of the ordinary-control route.
  // The camera is restored immediately; simulation and controls are not modified.
  g.updateVisuals=function(...args){update.apply(this,args);const w=this.firstLevel.state.flywheel?.wheel;
   if(!w||w.work<nextWork||rotorFrames.length>=6)return;nextWork+=10;
   const p=this.camera.position.clone(),q=this.camera.quaternion.clone();
   this.camera.position.set(.6,3.5,-1.5);this.camera.lookAt(-5.4,2.1,-5);this.camera.updateMatrixWorld(true);render.call(this);
   rotorFrames.push(this.renderer.domElement.toDataURL());this.camera.position.copy(p);this.camera.quaternion.copy(q);this.camera.updateMatrixWorld(true);
  };
  try{return{route:await window.__NESI_RUN_LEVEL_ROUTE__(),images,rotorFrames};}finally{g.render=render;g.updateVisuals=update;}
 });
 report.route=result.route;result.images.forEach((s,i)=>fs.writeFileSync(out+`/action-${i}.png`,Buffer.from(s.split(',')[1],'base64')));
 result.rotorFrames.forEach((s,i)=>fs.writeFileSync(out+`/rotor-${i}.png`,Buffer.from(s.split(',')[1],'base64')));
 assert.equal(result.rotorFrames.length,6);assert.ok(result.route.pass&&result.route.respawns===0&&result.route.resets===0);
 await page.screenshot({path:out+'/complete.png'});assert.deepEqual(report.errors,[]);report.pass=true;
}catch(error){report.error=String(error);throw error;}finally{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
