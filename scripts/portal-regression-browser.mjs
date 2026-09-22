import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const out=process.env.OUT_DIR||'qa/portal-regression';fs.mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',headless:true,protocolTimeout:600000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const reports=[];
try{
 const page=await browser.newPage();page.setDefaultTimeout(180000);await page.setViewport({width:1280,height:720});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 const base=process.env.PAGE_URL||'http://127.0.0.1:4173/',url=new URL(base);url.search='?edition=open&level=24&debug=1';
 await page.goto(url.href,{waitUntil:'networkidle2'});await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready');
 const build=await page.evaluate(async()=>{const r=await fetch('build-info.json',{cache:'no-store'});return r.json();});
 if(process.env.BUILD_COMMIT)assert.equal(build.commit,process.env.BUILD_COMMIT);
 await page.click('#play-button');
 for(const [index,options]of [{returnTrip:true},{carry:true}].entries()){
  await page.evaluate(record=>{
   const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop(null);
   const gl=g.renderer.getContext(),link=gl.linkProgram.bind(gl),update=g.updateVisuals.bind(g);let links=0,frame=0;
   const evidence=window.__FLOOR_EVIDENCE__={frames:[],marks:[],samples:[],warmup:g.portalWarmup,quality:g.quality};
   gl.linkProgram=(...a)=>{links++;return link(...a);};
   window.__NESI_CAPTURE_LEVEL_MARK__=mark=>evidence.marks.push({...mark,png:g.renderer.domElement.toDataURL('image/png').split(',')[1]});
   g.updateVisuals=(...args)=>{update(...args);frame++;if(frame%4)return;
    const start=performance.now();g.render();evidence.samples.push({frame,ms:performance.now()-start,links,teleports:g.teleportCount});
    const pos=g.playerPosition;
    if(record&&g.portals.ready&&(Math.abs(pos.x-9)<3||g.teleportCount>0)&&evidence.frames.length<180)evidence.frames.push({frame,position:pos.toArray(),teleports:g.teleportCount,png:g.renderer.domElement.toDataURL('image/png').split(',')[1]});
   };
   window.__FLOOR_RESTORE__=()=>{g.updateVisuals=update;gl.linkProgram=link;return links;};
  },process.env.RECORD!=='0'&&index===0);
  const route=await page.evaluate(async options=>window.__NESI_RUN_FLOOR_PORTAL_ROUTE__(options),options);
  const evidence=await page.evaluate(()=>{window.__FLOOR_EVIDENCE__.newPrograms=window.__FLOOR_RESTORE__();return window.__FLOOR_EVIDENCE__;});
  assert.equal(route.pass,true);assert.equal(route.resets,0);assert.equal(route.respawns,0);assert.deepEqual(errors,[]);
  assert.equal(evidence.newPrograms,0,'Unexpected in-play shader compilation');
  const folder=path.join(out,`${index}-frames`);fs.mkdirSync(folder,{recursive:true});
  for(const [i,f]of evidence.frames.entries()){fs.writeFileSync(path.join(folder,String(i).padStart(5,'0')+'.png'),Buffer.from(f.png,'base64'));delete f.png;}
  for(const [i,m]of evidence.marks.entries()){fs.writeFileSync(path.join(out,`${index}-mark-${i}.png`),Buffer.from(m.png,'base64'));delete m.png;}
  reports.push({route,...evidence});console.log('FLOOR REGRESSION',JSON.stringify({index,pass:route.pass,teleports:route.teleports,programs:evidence.newPrograms,frames:evidence.frames.length}));
 }
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({source:build.commit,url:url.href,reports,errors,measurement:'Native WebGL ordinary simulated-input routes. 15 captured frames per simulated second, not device FPS.'},null,2));
}finally{await browser.close();}
