import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
const out='balance-evidence';fs.mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,protocolTimeout:120000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const report={pass:false,errors:[],note:'Model-isolation and inspection cameras are not passage evidence.'};
try{
 const page=await browser.newPage();page.setDefaultTimeout(90000);await page.setViewport({width:1280,height:800});page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/?debug=1&level=7',{waitUntil:'networkidle2'});await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready');await page.click('#play-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.state==='playing');
 await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop(null);g.resetRun(true);g.updateVisuals(1/60,1);g.render();});
 await page.screenshot({path:out+'/start.png'});
 for(const [name,at,target]of [['room-side',[11,7,10],[0,2,0]],['deck',[0,11,11],[0,2,0]]]){
  await page.evaluate(({at,target})=>{const g=window.__NESI_DEMO_GAME__;g.cameraRig.restoreProjection?.();g.camera.updateProjectionMatrix();g.camera.position.fromArray(at);g.camera.lookAt(...target);g.camera.updateMatrixWorld(true);g.render();},{at,target});await page.screenshot({path:out+'/'+name+'.png'});
 }
 await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;g.scene.children.forEach(o=>{if(!o.isLight)o.visible=false;});g.scene.add(g.model(34,8));g.scene.fog=null;g.cameraRig.restoreProjection?.();g.camera.updateProjectionMatrix();});
 for(const [name,at]of [['native-oblique',[8,6,9]],['native-side',[0,4,12]],['native-end',[-12,4,0]]]){
  await page.evaluate(at=>{const g=window.__NESI_DEMO_GAME__;g.camera.position.set(...at);g.camera.lookAt(0,1.5,0);g.camera.updateMatrixWorld(true);g.renderer.render(g.scene,g.camera);},at);await page.screenshot({path:out+'/'+name+'.png'});
 }
 if(report.errors.length)throw Error(report.errors.join('\n'));report.pass=true;
} catch(error){report.error=String(error);throw error;}finally{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
