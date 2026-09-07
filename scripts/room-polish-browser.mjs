import fs from 'node:fs';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
const out='room-evidence';fs.mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const report={pass:false,errors:[],note:'In-room views and ordinary-control route; not a hardware FPS benchmark.'};
try{
 const page=await browser.newPage();page.setDefaultTimeout(90000);await page.setViewport({width:1280,height:800});page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/?debug=1&level=11',{waitUntil:'networkidle2'});await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready');
 assert.equal(await page.$$eval('#level-select option',e=>e.length),20);
 await page.click('#play-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.state==='playing');
 await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop(null);g.resetRun(true);g.updateVisuals(1/60,1);g.render();});
 await page.screenshot({path:out+'/start.png'});
 report.fixtures=await page.evaluate(()=>window.__NESI_DEMO_GAME__.firstLevel.fixtures.map(f=>({id:f.id,position:f.art.position.toArray(),pivot:f.pivot?.getWorldPosition(f.art.position.clone()).toArray()})));
 // Diagnostic cameras stay inside the room, below its ceiling. They are not walkthrough evidence.
 for(const [name,at,target]of [['room',[11,7,12],[0,1,-3]],['blower',[-4,4,10],[-10,1.5,5]],['receiver',[6,4,-2],[0,1.6,-8]],['winch',[8,3,-3],[5,1,-8]]]){
  await page.evaluate(({at,target})=>{const g=window.__NESI_DEMO_GAME__;g.camera.position.fromArray(at);g.camera.lookAt(...target);g.camera.updateMatrixWorld(true);g.render();},{at,target});await page.screenshot({path:out+'/'+name+'.png'});
 }
 const result=await page.evaluate(async()=>{const g=window.__NESI_DEMO_GAME__,render=g.render,images=[];g.render=function(){render.call(this);if(this.state==='playing')images.push(this.renderer.domElement.toDataURL());};try{return{route:await window.__NESI_RUN_LEVEL_ROUTE__(),images};}finally{g.render=render;}});
 report.route=result.route;result.images.forEach((s,i)=>fs.writeFileSync(out+`/action-${i}.png`,Buffer.from(s.split(',')[1],'base64')));assert.ok(result.route.pass&&result.route.respawns===0&&result.route.resets===0);
 await page.screenshot({path:out+'/complete.png'});assert.deepEqual(report.errors,[]);report.pass=true;
}catch(error){report.error=String(error);throw error;}finally{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
