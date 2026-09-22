import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';

const rooms=(process.env.ROOMS||'31,32,33').split(',').map(Number);
assert.ok(rooms.every(n=>[31,32,33].includes(n)));
const base=process.env.PAGE_URL||'http://127.0.0.1:4173/';
const out=process.env.OUT_DIR||'qa/research-browser';fs.mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',headless:true,protocolTimeout:600000,
 args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try{
 for(const room of rooms){
  const page=await browser.newPage();page.setDefaultTimeout(180000);await page.setViewport({width:1280,height:720});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  const url=new URL(base);url.search=`?edition=open&debug=1&level=${room}`;
  await page.goto(url.href,{waitUntil:'networkidle2'});await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready');
  const build=await page.evaluate(async()=>{const r=await fetch('build-info.json',{cache:'no-store'});return r.json();});
  if(process.env.BUILD_COMMIT)assert.equal(build.commit,process.env.BUILD_COMMIT);
  assert.equal(build.levels,33);
  assert.deepEqual(await page.$$eval('#level-select option',a=>a.map(o=>Number(o.value))),[23,27,29,30,31,32]);
  const before=await page.evaluate(()=>localStorage.getItem('brainrot-portal.preferences.v24'));
  await page.click('#play-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='playing');
  await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop(null);g.render();});
  await page.screenshot({path:path.join(out,`${room}-start.png`)});
  await page.evaluate(({room,record})=>{
   const g=window.__NESI_DEMO_GAME__,update=g.updateVisuals.bind(g),gl=g.renderer.getContext(),link=gl.linkProgram.bind(gl);let frame=0,links=0;
   const e=window.__RESEARCH_EVIDENCE__={frames:[],marks:[],newPrograms:0,quality:g.quality};
   const shot=tag=>({frame,tag,player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),teleports:g.teleportCount,png:g.renderer.domElement.toDataURL('image/png').split(',')[1]});
   gl.linkProgram=(...a)=>{links++;return link(...a);};
   window.__NESI_CAPTURE_LEVEL_MARK__=m=>e.marks.push({...m,...shot(m.name)});
   g.updateVisuals=(...a)=>{update(...a);frame++;const p=g.playerPosition;
    const active=room===31?(g.heldCube&&p.x>-17&&p.x<3):room===32?(p.y>.2&&p.y<4):(!g.playerGrounded&&g.teleportCount>0);
    if(record&&active&&frame%4===0&&e.frames.length<75){g.render();e.frames.push(shot('ordinary movement'));}
   };
   window.__RESEARCH_RESTORE__=()=>{g.updateVisuals=update;gl.linkProgram=link;e.newPrograms=links;};
  },{room,record:process.env.RECORD!=='0'});
  const options=process.env.RECOVERY==='1'?{recover:true}:process.env.ALTERNATE==='1'?(room===31?{route:'scout-first',recover:true}:room===32?{route:'stored-energy'}:{recover:true}):{};
  let route;try{route=await page.evaluate(async o=>window.__NESI_RUN_LEVEL_ROUTE__(o),options);}finally{await page.evaluate(()=>window.__RESEARCH_RESTORE__());}
  assert.equal(route.pass,true);assert.equal(route.resets,0);assert.equal(route.respawns,0);assert.equal(route.level,room);assert.deepEqual(errors,[]);
  assert.equal(await page.evaluate(()=>localStorage.getItem('brainrot-portal.preferences.v24')),before);
  const evidence=await page.evaluate(()=>window.__RESEARCH_EVIDENCE__);
  const dir=path.join(out,`${room}-motion`);fs.mkdirSync(dir,{recursive:true});
  for(const [i,f]of evidence.frames.entries()){fs.writeFileSync(path.join(dir,String(i).padStart(5,'0')+'.png'),Buffer.from(f.png,'base64'));delete f.png;}
  for(const [i,m]of evidence.marks.entries()){fs.writeFileSync(path.join(out,`${room}-mark-${i}.png`),Buffer.from(m.png,'base64'));delete m.png;}
  // A separately labelled inspection camera is NOT route evidence.
  await page.evaluate(()=>{document.querySelectorAll('.screen').forEach(e=>e.classList.remove('screen--active'));});
  await page.evaluate(room=>{const g=window.__NESI_DEMO_GAME__,v={31:[[24,15,17],[-6,5,-7]],32:[[23,18,18],[-4,5,-10]],33:[[28,27,24],[-4,9,-3]]}[room];g.cameraRig.restoreProjection?.();g.camera.position.fromArray(v[0]);g.camera.lookAt(...v[1]);g.camera.updateMatrixWorld(true);g.render();},room);
  await page.screenshot({path:path.join(out,`${room}-inspection.png`)});
  const report={source:build.commit,room,url:url.href,route,options,errors,saveIsolated:true,...evidence,
   recording:'15 frames per simulated second, excerpts only; not hardware FPS or a human playtest',inspection:'separately positioned art camera'};
  fs.writeFileSync(path.join(out,`${room}-report.json`),JSON.stringify(report,null,2));
  results.push({room,pass:true,programs:evidence.newPrograms,frames:evidence.frames.length,source:build.commit});console.log('RESEARCH VERIFIED',JSON.stringify(results.at(-1)));await page.close();
 }
}finally{await browser.close();fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(results,null,2));}
