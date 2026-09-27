import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import puppeteer from 'puppeteer-core';

const rooms=(process.env.ROOMS||'1,2,3,4,5').split(',').map(Number);
assert.ok(rooms.every(n=>Number.isInteger(n)&&n>=1&&n<=40));
// A post-campaign alternate is run only when its implemented option has been
// supplied by the route owner. Example: {"31":{"order":"companion-first"}}.
const postAlternates=JSON.parse(process.env.POST_ALTERNATES||'{}');
assert.ok(postAlternates&&typeof postAlternates==='object'&&!Array.isArray(postAlternates));
for(const [number,options]of Object.entries(postAlternates)){
 assert.ok(Number.isInteger(Number(number))&&Number(number)>=31&&Number(number)<=40);
 assert.ok(options&&typeof options==='object'&&!Array.isArray(options)&&Object.keys(options).length>0);
}
const out=process.env.OUT_DIR||'qa/foundation-browser',base=process.env.PAGE_URL||'http://127.0.0.1:4173/';
fs.mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',headless:true,protocolTimeout:600000,
 args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const summaries=[];
try{
 for(const room of rooms){
  const page=await browser.newPage(),errors=[];page.setDefaultTimeout(180000);await page.setViewport({width:1280,height:720});page.on('pageerror',e=>errors.push(String(e)));
  // Room 40 also exercises an unqualified deep link into the default edition.
  const unqualified=room===1||room===40;
  const url=new URL(base);url.search=`?debug=1${room===1?'':'&level='+room}${room>5&&!unqualified?'&edition=foundation':''}`;
  await page.goto(url.href,{waitUntil:'networkidle2'});await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready');
  const info=await page.evaluate(async()=>{const r=await fetch('build-info.json',{cache:'no-store'});return r.json();});
  if(process.env.BUILD_COMMIT)assert.equal(info.commit,process.env.BUILD_COMMIT);
  assert.equal(info.features.defaultEdition,'foundation');assert.deepEqual(info.features.foundation.rooms,Array.from({length:40},(_,i)=>i+1));
  assert.equal(await page.evaluate(()=>window.__NESI_DEMO_GAME__.chamberEdition),'foundation');
  assert.deepEqual(await page.$$eval('#level-select option',a=>a.map(e=>Number(e.value))),Array.from({length:40},(_,i)=>i));
  assert.equal(await page.$eval('#level-select',e=>Number(e.value)),room-1);
  assert.match(await page.$eval('#campaign-count',e=>e.textContent),/40 испытаний/);
  const saved=await page.evaluate(()=>({classic:localStorage.getItem('brainrot-portal.preferences.v24'),legacy:localStorage.getItem('nesi.preferences.v8'),open:localStorage.getItem('brainrot-open-rebuild-v1:brainrot-portal.preferences.v24')}));
  await page.screenshot({path:path.join(out,`${room}-menu.png`)});
  await page.waitForFunction(()=>{
   const g=window.__NESI_DEMO_GAME__,button=document.querySelector('#play-button'),menu=document.querySelector('#start-screen');
   if(g?.state!=='ready'||!button||!menu||menu.inert||getComputedStyle(menu).opacity!=='1')return false;
   const r=button.getBoundingClientRect();return button.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));
  });
  for(let attempt=0;attempt<3;attempt++){
   if(await page.evaluate(()=>window.__NESI_DEMO_GAME__?.state!=='ready'))break;
   await page.bringToFront();await page.focus('#play-button');await page.click('#play-button');
   try{await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state!=='ready',{timeout:12000});}
   catch(error){if(error.name!=='TimeoutError')throw error;}
  }
  if(await page.evaluate(()=>window.__NESI_DEMO_GAME__?.state==='ready')){
   await page.screenshot({path:path.join(out,`${room}-startup-failure.png`)});
   throw new Error(`Foundation room ${room}: visible Play button did not start the game after three trusted clicks`);
  }
  try{await page.waitForFunction(()=>['playing','error'].includes(window.__NESI_DEMO_GAME__?.state));}
  catch(error){await page.screenshot({path:path.join(out,`${room}-startup-failure.png`)});throw error;}
  if(await page.evaluate(()=>window.__NESI_DEMO_GAME__?.state!=='playing')){
   await page.screenshot({path:path.join(out,`${room}-startup-failure.png`)});
   throw new Error(`Foundation room ${room} did not enter play: ${JSON.stringify(await page.evaluate(()=>({state:window.__NESI_DEMO_GAME__?.state,error:document.querySelector('#error-detail')?.textContent})))}`);
  }
  await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop(null);g.render();});
  await page.screenshot({path:path.join(out,`${room}-start.png`)});
  const alternate=postAlternates[String(room)];
  const cases=process.env.ONLY_NORMAL==='1'?[{}]:room>=31?[{},...(alternate?[alternate]:[])]:room>5?[{}]:[{}, {alternate:true}, ...([1,5].includes(room)?[{recover:true}]:[])];
  try{
   for(const [index,options]of cases.entries()){
    const caseKind=index===0?'canonical':room===34&&options.route==='explore-service-first'?'service-recovery':'alternate';
    await page.evaluate(({room,record})=>{
     const g=window.__NESI_DEMO_GAME__,update=g.updateVisuals.bind(g),gl=g.renderer.getContext(),link=gl.linkProgram.bind(gl);let frame=0,links=0,previousTeleports=g.teleportCount,remaining=0;
     const e=window.__FOUNDATION_EVIDENCE__={frames:[],marks:[],newPrograms:0,capture:{videoFramesPerSecond:15,preRollFramesPerSecond:5,portalWindows:0,teleportEvents:[]}};
     const intro=[],preRoll=[];
     const shot=()=>({frame,position:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),teleports:g.teleportCount,png:g.renderer.domElement.toDataURL('image/png').split(',')[1]});
     gl.linkProgram=(...a)=>{links++;return link(...a);};
     window.__NESI_CAPTURE_LEVEL_MARK__=m=>e.marks.push({...m,...shot()});
     g.updateVisuals=(...a)=>{update(...a);frame++;const p=g.playerPosition,l=g.firstLevel;
      const active=room===1?g.teleportCount>0:room===2?(g.heldCube&&p.x>-10&&p.x<10):room===3?(l.car&&!l.car.at(l.car.target)&&p.y>4):room===4?(!g.playerGrounded&&g.teleportCount>0):room===5?(l.cabin.position.y>.4&&l.cabin.position.y<5.8):false;
      if(record&&room>=31&&g.teleportCount>previousTeleports){
       e.capture.teleportEvents.push({frame,teleports:g.teleportCount});
       if(e.capture.portalWindows<2&&e.frames.length<72){
        e.frames.push(...preRoll);e.capture.portalWindows++;remaining=27;
       }
      }
      previousTeleports=g.teleportCount;
      if(!record||frame%4!==0)return;
      if(room>=31){
       if(intro.length<45||remaining>0){g.render();const image=shot();
        if(intro.length<45)intro.push(image);
        if(remaining>0&&e.frames.length<96){e.frames.push(image);remaining--;}
        preRoll.push(image);if(preRoll.length>12)preRoll.shift();
       }else if(frame%12===0){g.render();preRoll.push(shot());if(preRoll.length>12)preRoll.shift();}
      }else if(active&&e.frames.length<60){g.render();e.frames.push(shot());}
     };
     window.__FOUNDATION_RESTORE__=()=>{
      g.updateVisuals=update;gl.linkProgram=link;e.newPrograms=links;
      if(record&&room>=31&&!e.frames.length){e.frames.push(...intro);e.capture.fallback='ordinary opening movement; no player portal traversal detected';}
     };
    },{room,record:process.env.RECORD!=='0'&&(index===0||room>=31)});
    let route,routeError;
    try{route=await page.evaluate(async o=>window.__NESI_RUN_LEVEL_ROUTE__(o),options);}
    catch(error){routeError=error;}
    finally{await page.evaluate(()=>window.__FOUNDATION_RESTORE__());}
    const e=await page.evaluate(()=>window.__FOUNDATION_EVIDENCE__);
    const folder=path.join(out,`${room}-${index}-frames`);fs.mkdirSync(folder,{recursive:true});
    e.frames=e.frames.map((f,i)=>{
     fs.writeFileSync(path.join(folder,`${String(i).padStart(5,'0')}.png`),Buffer.from(f.png,'base64'));
     const {png,...metadata}=f;return metadata;
    });
    e.marks=e.marks.map((m,i)=>{
     fs.writeFileSync(path.join(out,`${room}-${index}-mark-${i}.png`),Buffer.from(m.png,'base64'));
     const {png,...metadata}=m;return metadata;
    });
    let video;
    if(room>=31&&e.frames.length){
     const mp4=path.join(out,`${room}-${caseKind}-webgl.mp4`);
     const ffmpeg=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-framerate','15','-i',path.join(folder,'%05d.png'),'-c:v','libx264','-pix_fmt','yuv420p','-crf','24',mp4],{encoding:'utf8',timeout:120000});
     if(ffmpeg.error?.code==='ENOENT')video='PNG frames available; ffmpeg missing';
     else{assert.equal(ffmpeg.status,0,`ffmpeg failed: ${ffmpeg.stderr||ffmpeg.error}`);video=mp4;}
    }
    const result={room,caseKind,options,source:info.commit,url:url.href,route,routeError:routeError?String(routeError):null,errors,...e,video,
     recording:'Native production WebGL with simulated route input; 15 sampled frames per simulated second during movement segments, 5 around the waiting period before a portal event. This is neither a human playtest nor a device FPS benchmark.'};
    fs.writeFileSync(path.join(out,`${room}-${index}-report.json`),JSON.stringify(result,null,2));
    if(routeError)throw routeError;
    assert.equal(route.pass,true);assert.equal(route.level,room);assert.equal(route.resets,0);assert.equal(route.respawns,0);assert.deepEqual(errors,[]);
    assert.equal(e.newPrograms,0,'New in-play shader program: loading preparation regression');
    summaries.push({room,caseKind,options,pass:true,source:info.commit,frames:e.frames.length,portalWindows:e.capture.portalWindows,newPrograms:e.newPrograms,video});
    console.log('FOUNDATION VERIFIED',JSON.stringify(summaries.at(-1)));
   }
   const after=await page.evaluate(()=>({classic:localStorage.getItem('brainrot-portal.preferences.v24'),legacy:localStorage.getItem('nesi.preferences.v8'),open:localStorage.getItem('brainrot-open-rebuild-v1:brainrot-portal.preferences.v24')}));assert.deepEqual(after,saved,'Another edition save changed');
   // The real victory control advances room 30 into 31 and wraps after room 40.
   await page.waitForFunction(()=>!document.pointerLockElement&&getComputedStyle(document.querySelector('#win-screen')).opacity==='1');
   if(room===40)assert.match(await page.$eval('#win-screen .muted',e=>e.textContent),/40 испытаний кампании/);
   await page.locator('#play-again-button').click();
   await page.waitForFunction(next=>window.__NESI_DEMO_GAME__?.state==='playing'&&window.__NESI_DEMO_GAME__.levelIndex===next,{},room===40?0:room);
   await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop(null);g.render();});
   await page.screenshot({path:path.join(out,`${room}-next.png`)});
   fs.writeFileSync(path.join(out,`${room}-ui.json`),JSON.stringify({source:info.commit,defaultEntry:unqualified,saveIsolated:true,transition:{from:room,to:room===40?1:room+1},errors},null,2));
  }catch(error){await page.screenshot({path:path.join(out,`${room}-failure.png`)});throw error;}finally{await page.close();}
 }
}finally{await browser.close();fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summaries,null,2));}
