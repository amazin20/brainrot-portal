import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';

const record=process.env.RECORD!=='0';
const rooms=(process.env.ROOMS||process.env.ROOM||'24,28,30').split(',').map(Number);
assert.ok(rooms.every(n=>[24,28,30].includes(n)),'Unknown rebuilt room');
const base=process.env.PAGE_URL||'http://127.0.0.1:4173/';
const out=process.env.OUT_DIR||'qa/open-browser';fs.mkdirSync(out,{recursive:true});
const executablePath=process.env.CHROME_PATH||'/usr/bin/chromium';
const browser=await puppeteer.launch({executablePath,headless:process.env.HEADED!=='1',protocolTimeout:600000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const reports=[];
try{
 for(const room of rooms){
  const page=await browser.newPage(),errors=[];page.setDefaultTimeout(120000);
  page.on('pageerror',error=>errors.push(String(error)));await page.setViewport({width:1440,height:900});
  const url=new URL(base);url.searchParams.set('edition','open');url.searchParams.set('debug','1');url.searchParams.set('level',String(room));
  await page.goto(url.href,{waitUntil:'networkidle2',timeout:120000});
  await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready');
  const info=await page.evaluate(async()=>{const r=await fetch('build-info.json',{cache:'no-store'});if(!r.ok)throw new Error('Build identity unavailable');return r.json();});
  if(process.env.BUILD_COMMIT)assert.equal(info.commit,process.env.BUILD_COMMIT,'Wrong production revision');
  const menu=await page.$$eval('#level-select option',items=>items.map(o=>Number(o.value)));assert.deepEqual(menu,[23,27,29]);
  const before=await page.evaluate(()=>({classic:localStorage.getItem('brainrot-portal.preferences.v24'),legacy:localStorage.getItem('nesi.preferences.v8')}));
  await page.click('#play-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='playing');
  await page.evaluate(()=>window.__NESI_DEMO_GAME__.renderer.setAnimationLoop(null));
  await page.select('#quality-select','high');
  await page.evaluate(()=>window.__NESI_DEMO_GAME__.render());
  await page.screenshot({path:path.join(out,`${room}-start.png`)});
  await page.evaluate(({room,record})=>{
   const g=window.__NESI_DEMO_GAME__,original=g.updateVisuals.bind(g);let frame=0;
   window.__OPEN_EVIDENCE__={marks:[],frames:[],quality:'high',fps:15,kind:'native ordinary-input route excerpts; recording rate is not measured game FPS'};
   const frameShot=(tag)=>({frame,time:g.elapsed/1000,tag,player:g.playerPosition.toArray(),velocity:g.playerVelocity.toArray(),cargo:g.cargo.position.toArray(),teleports:g.teleportCount,png:g.renderer.domElement.toDataURL('image/png').split(',')[1]});
   window.__NESI_CAPTURE_LEVEL_MARK__=mark=>window.__OPEN_EVIDENCE__.marks.push({...mark,...frameShot(mark.name)});
   g.updateVisuals=(...args)=>{original(...args);frame++;
    const car=g.firstLevel.car,moving=car&&car.position.distanceTo(car.stations[car.target])>.15;
    const interesting=room===30?(!g.playerGrounded&&g.playerPosition.y>12):room===24?(moving&&g.playerPosition.y>3):(g.firstLevel.floats[1].position.y>.4&&g.firstLevel.floats[1].position.y<5.9);
    if(record&&interesting&&frame%4===0&&window.__OPEN_EVIDENCE__.frames.length<150){g.render();window.__OPEN_EVIDENCE__.frames.push(frameShot('motion'));}
   };
   window.__OPEN_RESTORE__=()=>{g.updateVisuals=original;};
  },{room,record});
  const route=await page.evaluate(async room=>{
   try{return await window.__NESI_RUN_LEVEL_ROUTE__(room===24?{route:'ride-first'}:room===28?{route:'equal-head'}:{});}finally{window.__OPEN_RESTORE__();}
  },room);
  assert.equal(route.pass,true);assert.equal(route.resets,0);assert.equal(route.respawns,0);
  const evidence=await page.evaluate(()=>window.__OPEN_EVIDENCE__);
  const folder=path.join(out,`${room}-motion`);fs.mkdirSync(folder,{recursive:true});
  for(const [i,frame]of evidence.frames.entries()){fs.writeFileSync(path.join(folder,String(i).padStart(5,'0')+'.png'),Buffer.from(frame.png,'base64'));delete frame.png;}
  for(const [i,mark]of evidence.marks.entries()){fs.writeFileSync(path.join(out,`${room}-mark-${i}.png`),Buffer.from(mark.png,'base64'));delete mark.png;}
  const after=await page.evaluate(()=>({classic:localStorage.getItem('brainrot-portal.preferences.v24'),legacy:localStorage.getItem('nesi.preferences.v8')}));assert.deepEqual(after,before,'Original campaign save changed');
  assert.deepEqual(errors,[],'Browser page errors');
  // Inspect the assembled environment separately. This is not a route camera.
  await page.evaluate(room=>{const g=window.__NESI_DEMO_GAME__;const views={24:[[67,56,83],[0,13,0]],28:[[75,48,69],[0,10,-3]],30:[[-93,85,101],[9,24,0]]};g.cameraRig.restoreProjection?.();g.camera.position.fromArray(views[room][0]);g.camera.lookAt(...views[room][1]);g.camera.updateMatrixWorld(true);g.render();},room);
  await page.screenshot({path:path.join(out,`${room}-overview.png`)});
  const report={room,url:url.href,source:info.commit,route,errors,saveIsolated:true,overview:'separately positioned art-inspection camera',...evidence};
  fs.writeFileSync(path.join(out,`${room}-report.json`),JSON.stringify(report,null,2));reports.push({room,pass:true,frames:evidence.frames.length,source:info.commit});
  console.log('OPEN ROOM VERIFIED',JSON.stringify(reports.at(-1)));await page.close();
 }
}finally{await browser.close();fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify({base,reports},null,2));}
