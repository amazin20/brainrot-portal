import fs from 'node:fs';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
const out='airflow-evidence';fs.mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
const page=await browser.newPage();await page.setViewport({width:1280,height:800});page.setDefaultTimeout(45000);
const errors=[];page.on('pageerror',e=>{errors.push(String(e));console.log('ERROR',String(e));});page.on('console',e=>{if(e.type()==='error'){errors.push(e.text());console.log('CONSOLE',e.text());}});
await page.goto('http://127.0.0.1:4173/?debug=1&level=11',{waitUntil:'networkidle2'});
await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready');await page.click('#play-button');
await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='playing');
await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop(null);g.render();});
await page.screenshot({path:out+'/start.png'});
const result=await page.evaluate(async()=>{
 const g=window.__NESI_DEMO_GAME__,update=g.updateVisuals,render=g.render,images=[];let samples=0,views=[];
 g.updateVisuals=function(...args){update.apply(this,args);const s=this.firstLevel.state,w=s.flywheel.wheel;
  if(!s.flywheel.power||samples>=90)return;
  samples++;const p=this.camera.position.clone(),q=this.camera.quaternion.clone();
  this.camera.position.set(8,5.0,11);this.camera.lookAt(-2.8,1.8,-.5);this.camera.updateMatrixWorld(true);render.call(this);
  images.push(this.renderer.domElement.toDataURL());
  if(samples===30){for(const [at,target]of [[[1,3.8,9],[-8.3,2.1,4]],[[2,3.2,-.3],[-5.4,2.1,-5]],[[9,3,1],[14,2.1,4]]]){
   this.camera.position.fromArray(at);this.camera.lookAt(...target);this.camera.updateMatrixWorld(true);render.call(this);views.push(this.renderer.domElement.toDataURL());}}
  this.camera.position.copy(p);this.camera.quaternion.copy(q);this.camera.updateMatrixWorld(true);
 };
 try{return {route:await window.__NESI_RUN_LEVEL_ROUTE__(),images,views};}finally{g.updateVisuals=update;}
});
result.images.forEach((x,i)=>fs.writeFileSync(`${out}/flow-${String(i).padStart(3,'0')}.png`,Buffer.from(x.split(',')[1],'base64')));
result.views.forEach((x,i)=>fs.writeFileSync(`${out}/view-${i}.png`,Buffer.from(x.split(',')[1],'base64')));
const report={route:result.route,errors,frames:result.images.length,views:result.views.length};fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));
assert.ok(result.route.pass&&result.route.respawns===0&&result.route.resets===0);assert.ok(result.images.length>=60);assert.deepEqual(errors,[]);console.log(JSON.stringify(report));
}finally{await browser.close();}
