import fs from 'node:fs';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
const out='airflow-evidence';fs.mkdirSync(out,{recursive:true});
const report={pass:false,errors:[],networkFailures:[],resourceMessages:[],note:'Actual production route; diagnostic cameras for airflow closeups, not a device FPS benchmark.'};
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage();await page.setViewport({width:1280,height:800});page.setDefaultTimeout(90000);
 page.on('pageerror',e=>report.errors.push(String(e)));
 page.on('response',r=>{if(r.status()>=400)report.networkFailures.push({url:r.url(),status:r.status()});});
 page.on('requestfailed',r=>report.networkFailures.push({url:r.url(),error:r.failure()?.errorText}));
 page.on('console',e=>{if(e.type()!=='error')return;
  if(e.text().startsWith('Failed to load resource:'))report.resourceMessages.push({text:e.text(),location:e.location()});
  else report.errors.push(e.text());
 });
 await page.goto('http://127.0.0.1:4173/?debug=1&level=11',{waitUntil:'networkidle2'});
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready');await page.click('#play-button');
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='playing');
 await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop(null);g.render();});
 await page.screenshot({path:out+'/start.png'});
 report.roles=await page.evaluate(()=>{const l=window.__NESI_DEMO_GAME__.firstLevel;return {fan:l.state.blower.art.id,drive:l.state.flywheel.art.id,effect:l.readability.airflow.mesh.name};});
 assert.equal(report.roles.fan,31);assert.equal(report.roles.drive,35);assert.equal(report.roles.effect,'Soft advected airflow');
 const result=await page.evaluate(async()=>{
  const g=window.__NESI_DEMO_GAME__,update=g.updateVisuals,render=g.render,images=[],views=[];let samples=0;
  g.updateVisuals=function(...args){update.apply(this,args);const s=this.firstLevel.state;
   if(!s.flywheel.power||samples>=120)return;
   samples++;const p=this.camera.position.clone(),q=this.camera.quaternion.clone();
   this.camera.position.set(1,6.3,14);this.camera.lookAt(3,2,-.5);this.camera.updateMatrixWorld(true);render.call(this);
   images.push(this.renderer.domElement.toDataURL());
   if(samples===30){for(const [at,target]of [[[1,3.8,9],[-8.3,2.1,4]],[[2,3.2,-.3],[-5.4,2.1,-5]],[[9,3,1],[14,2.1,4]]]){
    this.camera.position.fromArray(at);this.camera.lookAt(...target);this.camera.updateMatrixWorld(true);render.call(this);views.push(this.renderer.domElement.toDataURL());}}
   this.camera.position.copy(p);this.camera.quaternion.copy(q);this.camera.updateMatrixWorld(true);
  };
  try{return {route:await window.__NESI_RUN_LEVEL_ROUTE__(),images,views};}finally{g.updateVisuals=update;}
 });
 result.images.forEach((x,i)=>fs.writeFileSync(`${out}/flow-${String(i).padStart(3,'0')}.png`,Buffer.from(x.split(',')[1],'base64')));
 result.views.forEach((x,i)=>fs.writeFileSync(`${out}/view-${i}.png`,Buffer.from(x.split(',')[1],'base64')));
 Object.assign(report,{route:result.route,frames:result.images.length,views:result.views.length});
 assert.ok(result.route.pass&&result.route.respawns===0&&result.route.resets===0);assert.ok(result.images.length>=90);
 // Chromium may request its optional site icon or DevTools discovery file.
 // Preserve their precise URLs; NEVER ignore a missing game model/script/texture.
 const optional=new Set(['/favicon.ico','/.well-known/appspecific/com.chrome.devtools.json']);
 report.optionalRequests=report.networkFailures.filter(r=>r.status===404&&optional.has(new URL(r.url).pathname));
 assert.deepEqual(report.networkFailures.filter(r=>!report.optionalRequests.includes(r)),[]);
 assert.ok(report.resourceMessages.every(m=>report.optionalRequests.some(r=>r.url===m.location.url)),'Unexplained console resource failure');
 assert.deepEqual(report.errors,[]);report.pass=true;console.log(JSON.stringify(report));
}catch(error){report.error=String(error);throw error;}
finally{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
