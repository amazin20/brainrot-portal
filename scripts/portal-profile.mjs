import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const label=process.env.PROFILE_LABEL||'before',out=process.env.OUT_DIR||'qa/portal-profile';fs.mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',headless:true,protocolTimeout:600000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage();await page.setViewport({width:1280,height:720});page.setDefaultTimeout(180000);const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:4173/?edition=open&level=24&debug=1',{waitUntil:'networkidle2'});
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready');await page.click('#play-button');await page.evaluate(()=>window.__NESI_DEMO_GAME__.renderer.setAnimationLoop(null));
 const data=await page.evaluate(async()=>{
  const {runV8Journey}=await import('/src/game/LabV8Journey.js');const {installRoom21Aim}=await import('/src/game/LabRoom21Journey.js');
  const g=window.__NESI_DEMO_GAME__,gl=g.renderer.getContext();let phase='idle',frame=0,links=0;const samples=[];
  const link=gl.linkProgram.bind(gl);gl.linkProgram=(...a)=>{links++;return link(...a);};
  const render=g.render.bind(g),update=g.updateVisuals.bind(g);
  const snap=()=>{const start=performance.now(),prior=links;render();const cpu=performance.now()-start;gl.finish();samples.push({phase,frame,cpu,total:performance.now()-start,links:links-prior,programs:g.renderer.info.programs.length,passes:g.portals.diagnostics.passes,triangles:g.renderer.info.render.triangles,calls:g.renderer.info.render.calls,active:g.portalActors.diagnostics.active,clip:g.cameraRig.mainClippingPlanes.length,teleports:g.teleportCount});};
  g.updateVisuals=(...args)=>{update(...args);frame++;if(frame%4===0)snap();};
  let route;
  try{route=await runV8Journey(g,{scenario:d=>{installRoom21Aim(d);phase='first-shot';d.aim(0,g.firstLevel.panels.departure.getFrame().center.clone().addScaledVector(g.firstLevel.panels.departure.getFrame().up,-.85));phase='link';d.aim(1,g.firstLevel.car.panel.getFrame().center.clone().addScaledVector(g.firstLevel.car.panel.getFrame().up,-.85));phase='wall-traverse';d.enter(g.firstLevel.panels.departure);phase='after';d.wait(.5);d.mark('wall crossing');}});}finally{g.updateVisuals=update;gl.linkProgram=link;}
  return {renderer:gl.getParameter(gl.RENDERER),samples,route,linkedPrograms:links,colliders:g.colliders.length,measurement:'Synchronous renderer CPU submission plus gl.finish GPU completion in software WebGL; not real-device RAF FPS'};
 });data.errors=errors;data.source=process.env.PROFILE_SOURCE;fs.writeFileSync(`${out}/${label}.json`,JSON.stringify(data,null,2));await page.screenshot({path:`${out}/${label}.png`});console.log(JSON.stringify({errors,links:data.linkedPrograms,count:data.samples.length,pass:data.route.pass}));
}finally{await browser.close();}
