import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';

const rooms=(process.env.ROOMS||'1,2,3,4,5').split(',').map(Number);
assert.ok(rooms.every(n=>Number.isInteger(n)&&n>=1&&n<=5));
const out=process.env.OUT_DIR||'qa/foundation-browser',base=process.env.PAGE_URL||'http://127.0.0.1:4173/';
fs.mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',headless:true,protocolTimeout:600000,
 args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const summaries=[];
try{
 for(const room of rooms){
  const page=await browser.newPage(),errors=[];page.setDefaultTimeout(180000);await page.setViewport({width:1280,height:720});page.on('pageerror',e=>errors.push(String(e)));
  // Intentionally omit edition: this verifies what a new human actually opens.
  const url=new URL(base);url.search=`?debug=1${room===1?'':'&level='+room}`;
  await page.goto(url.href,{waitUntil:'networkidle2'});await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready');
  const info=await page.evaluate(async()=>{const r=await fetch('build-info.json',{cache:'no-store'});return r.json();});
  if(process.env.BUILD_COMMIT)assert.equal(info.commit,process.env.BUILD_COMMIT);
  assert.equal(info.features.defaultEdition,'foundation');assert.deepEqual(info.features.foundation.rooms,[1,2,3,4,5]);
  assert.equal(await page.evaluate(()=>window.__NESI_DEMO_GAME__.chamberEdition),'foundation');
  assert.deepEqual(await page.$$eval('#level-select option',a=>a.map(e=>Number(e.value))),[0,1,2,3,4]);
  assert.equal(await page.$eval('#level-select',e=>Number(e.value)),room-1);
  assert.match(await page.$eval('#campaign-count',e=>e.textContent),/первые 5/);
  const saved=await page.evaluate(()=>({classic:localStorage.getItem('brainrot-portal.preferences.v24'),legacy:localStorage.getItem('nesi.preferences.v8'),open:localStorage.getItem('brainrot-open-rebuild-v1:brainrot-portal.preferences.v24')}));
  await page.screenshot({path:path.join(out,`${room}-menu.png`)});
  await page.click('#play-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='playing');
  await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop(null);g.render();});
  await page.screenshot({path:path.join(out,`${room}-start.png`)});
  const cases=process.env.ONLY_NORMAL==='1'?[{}]:[{}, {alternate:true}, ...([1,5].includes(room)?[{recover:true}]:[])];
  try{
   for(const [index,options]of cases.entries()){
    await page.evaluate(({room,record})=>{
     const g=window.__NESI_DEMO_GAME__,update=g.updateVisuals.bind(g),gl=g.renderer.getContext(),link=gl.linkProgram.bind(gl);let frame=0,links=0;
     const e=window.__FOUNDATION_EVIDENCE__={frames:[],marks:[],newPrograms:0};
     const shot=()=>({frame,position:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),teleports:g.teleportCount,png:g.renderer.domElement.toDataURL('image/png').split(',')[1]});
     gl.linkProgram=(...a)=>{links++;return link(...a);};
     window.__NESI_CAPTURE_LEVEL_MARK__=m=>e.marks.push({...m,...shot()});
     g.updateVisuals=(...a)=>{update(...a);frame++;const p=g.playerPosition,l=g.firstLevel;
      const active=room===1?g.teleportCount>0:room===2?(g.heldCube&&p.x>-10&&p.x<10):room===3?(l.car&&!l.car.at(l.car.target)&&p.y>4):room===4?(!g.playerGrounded&&g.teleportCount>0):(l.cabin.position.y>.4&&l.cabin.position.y<5.8);
      if(record&&active&&frame%4===0&&e.frames.length<60){g.render();e.frames.push(shot());}
     };
     window.__FOUNDATION_RESTORE__=()=>{g.updateVisuals=update;gl.linkProgram=link;e.newPrograms=links;};
    },{room,record:index===0&&process.env.RECORD!=='0'});
    let route;try{route=await page.evaluate(async o=>window.__NESI_RUN_LEVEL_ROUTE__(o),options);}finally{await page.evaluate(()=>window.__FOUNDATION_RESTORE__());}
    const e=await page.evaluate(()=>window.__FOUNDATION_EVIDENCE__);
    const folder=path.join(out,`${room}-${index}-frames`);fs.mkdirSync(folder,{recursive:true});
    for(const [i,f]of e.frames.entries()){fs.writeFileSync(path.join(folder,`${String(i).padStart(5,'0')}.png`),Buffer.from(f.png,'base64'));delete f.png;}
    for(const [i,m]of e.marks.entries()){fs.writeFileSync(path.join(out,`${room}-${index}-mark-${i}.png`),Buffer.from(m.png,'base64'));delete m.png;}
    const result={room,options,source:info.commit,url:url.href,route,errors,...e,recording:'Native production WebGL, ordinary simulated-input route, 15 recorded frames per simulated second. Not a human playtest or device FPS benchmark.'};
    fs.writeFileSync(path.join(out,`${room}-${index}-report.json`),JSON.stringify(result,null,2));
    assert.equal(route.pass,true);assert.equal(route.level,room);assert.equal(route.resets,0);assert.equal(route.respawns,0);assert.deepEqual(errors,[]);
    assert.equal(e.newPrograms,0,'New in-play shader program: loading preparation regression');
    summaries.push({room,options,pass:true,source:info.commit,frames:e.frames.length,newPrograms:e.newPrograms});
    console.log('FOUNDATION VERIFIED',JSON.stringify(summaries.at(-1)));
   }
   const after=await page.evaluate(()=>({classic:localStorage.getItem('brainrot-portal.preferences.v24'),legacy:localStorage.getItem('nesi.preferences.v8'),open:localStorage.getItem('brainrot-open-rebuild-v1:brainrot-portal.preferences.v24')}));assert.deepEqual(after,saved,'Another edition save changed');
   // The real victory control must advance, including the end of this chapter.
   await page.waitForFunction(()=>!document.pointerLockElement&&getComputedStyle(document.querySelector('#win-screen')).opacity==='1');
   await page.locator('#play-again-button').click();
   await page.waitForFunction(next=>window.__NESI_DEMO_GAME__?.state==='playing'&&window.__NESI_DEMO_GAME__.levelIndex===next,{},room===5?0:room);
   if(room===5)assert.match(await page.$eval('#win-screen .muted',e=>e.textContent),/Первая глава/);
   await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop(null);g.render();});
   await page.screenshot({path:path.join(out,`${room}-next.png`)});
   fs.writeFileSync(path.join(out,`${room}-ui.json`),JSON.stringify({source:info.commit,defaultEntry:true,saveIsolated:true,transition:{from:room,to:room===5?1:room+1},errors},null,2));
  }catch(error){await page.screenshot({path:path.join(out,`${room}-failure.png`)});throw error;}finally{await page.close();}
 }
}finally{await browser.close();fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summaries,null,2));}
