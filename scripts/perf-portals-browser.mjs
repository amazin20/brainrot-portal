import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import puppeteer from 'puppeteer-core';

const tag=process.env.PERF_TAG||'after',out=process.env.EVIDENCE_OUT||'smoke-artifacts/portal-browser';
assert.match(tag,/^(before|after)$/);fs.mkdirSync(out,{recursive:true});
const report={tag,source:process.env.SOURCE_COMMIT,pass:false,errors:[],levels:[],
 scope:'Production Chromium/SwiftShader, identical quality and known-solution routes. GPU-completion timings include software rendering and forced synchronization; NOT device FPS. Native frames compare appearance.',
 video:{width:1280,height:720,encodedFps:30,audio:false}};
const hash=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,protocolTimeout:900000,
 args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage();await page.setViewport({width:1280,height:720});page.setDefaultTimeout(120000);
 page.on('pageerror',e=>report.errors.push(e.message));report.browser=await browser.version();
 await page.evaluateOnNewDocument(()=>localStorage.setItem('brainrot-portal.preferences.v24',JSON.stringify({quality:'low',muted:true,tutorial:true})));
 await page.goto(new URL('?level=1&debug=1&smoke=1',process.env.PAGE_URL||'http://127.0.0.1:4173/').href,{waitUntil:'networkidle2'});
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.portalActors);
 for(const level of [1,4,5,12,21]){
  const data=await page.evaluate(async level=>{
   const g=window.__NESI_DEMO_GAME__;await g.selectLevel(level-1,false);g.renderer.setAnimationLoop(null);
   const frames=[],trace=[],movie=[];let tick=0,joint=null;
   const visual=g.updateVisuals,gl=g.renderer.getContext();
   const capture=name=>{
    // Prime current-pose shadows/programs, then measure three frozen renders.
    // Rendering never advances the actors, mechanism or the simulation clock.
    g.render();gl.finish();const times=[];
    for(let i=0;i<3;i++){const t=performance.now();g.render();gl.finish();times.push(performance.now()-t);}
    return{name,tick,player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),camera:g.camera.position.toArray(),
     render:{...g.renderer.info.render},portal:{...g.portals.diagnostics},times,
     image:g.renderer.domElement.toDataURL('image/png'),memory:{...g.renderer.info.memory}};
   };
   window.__NESI_CAPTURE_LEVEL_MARK__=mark=>{if(frames.length<4&&g.portals.diagnostics.passes>0)frames.push(capture(mark.name));};
   g.updateVisuals=function(...args){const r=visual.apply(this,args);
    trace.push([...g.playerPosition,...g.playerVelocity,...g.cargo.position,...g.camera.position,...g.camera.quaternion,g.camera.fov,g.teleportCount,g.state,!!g.heldCube]);
    if(level===21&&g.teleportCount===4&&joint===null)joint=tick;
    if(joint!==null&&tick-joint<120&&(tick-joint)%2===0){g.render();movie.push({tick,image:g.renderer.domElement.toDataURL('image/jpeg',.9),render:{...g.renderer.info.render}});}
    tick++;return r;};
   try{return{level,route:await window.__NESI_RUN_LEVEL_ROUTE__(),frames,trace,movie,quality:g.quality};}
   finally{g.updateVisuals=visual;delete window.__NESI_CAPTURE_LEVEL_MARK__;}
  },level);
  assert.ok(data.route.pass);assert.equal(data.route.resets+data.route.respawns,0);
  const saveFrame=(s,file)=>{const buffer=Buffer.from(s.image.split(',')[1],'base64');fs.writeFileSync(path.join(out,file),buffer);const{image,...row}=s;return{...row,file,hash:hash(buffer)};};
  const frames=data.frames.map((s,i)=>saveFrame(s,`${tag}-level${level}-${i}.png`));
  const result={level,route:data.route,traceDigest:hash(JSON.stringify(data.trace)),frames,quality:data.quality};
  if(data.movie.length){
   assert.equal(data.movie.length,60);const dir=path.join(out,`${tag}-movie`);fs.mkdirSync(dir,{recursive:true});
   result.movie=data.movie.map((s,i)=>saveFrame(s,`${tag}-movie/${String(i).padStart(5,'0')}.jpg`));
   execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','30','-i',path.join(dir,'%05d.jpg'),'-c:v','libx264','-preset','fast','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',path.join(out,`${tag}-portal-flight.mp4`)]);
  }
  report.levels.push(result);console.log(JSON.stringify({tag,level,pass:result.route.pass,frames:frames.map(s=>({calls:s.render.calls,triangles:s.render.triangles,passes:s.portal.passes,nested:s.portal.nested}))}));
  fs.writeFileSync(path.join(out,`${tag}.json`),JSON.stringify(report,null,2));
 }
 // Explicit synthetic render fixture: facing portals guarantee a recursive
 // view regardless of which optional camera directions a route happened to use.
 // No fixture actor placement is counted as campaign passage evidence.
 report.nestedFixture=await page.evaluate(()=>{
  const g=window.__NESI_DEMO_GAME__,scene=new g.scene.constructor(),camera=new g.camera.constructor(60,16/9,.1,100),V=g.playerPosition.constructor;
  camera.position.set(0,1.5,5);camera.lookAt(0,1.5,0);camera.updateMatrixWorld(true);
  const p=new g.portals.constructor({scene,camera,renderer:g.renderer,maxResolution:896,samples:2});
  p.place(0,new V(0,1.5,0),new V(0,0,1));p.place(1,new V(0,1.5,10),new V(0,0,-1));
  const material=p.portals[0].rim.material.clone(),objects=[];
  for(let x=-25;x<=25;x+=2)for(let z=-12;z<=24;z+=6)objects.push(g.box(x,1,z,.8,1.8,.8,material,{parent:scene,solid:false,camera:false,aim:false}));
  try{g.renderer.info.reset();p.render(0);g.renderer.render(scene,camera);g.renderer.getContext().finish();return{render:{...g.renderer.info.render},portal:{...p.diagnostics},image:g.renderer.domElement.toDataURL('image/png')};}
  finally{p.dispose();for(const o of objects)o.geometry.dispose();material.dispose();}
 });
 const fixtureBytes=Buffer.from(report.nestedFixture.image.split(',')[1],'base64');delete report.nestedFixture.image;
 fs.writeFileSync(path.join(out,`${tag}-recursive-fixture.png`),fixtureBytes);report.nestedFixture.hash=hash(fixtureBytes);
 assert.ok(report.nestedFixture.portal.nested>0);assert.deepEqual(report.errors,[]);report.pass=true;
}catch(error){report.failure=error.stack;throw error;}
finally{fs.writeFileSync(path.join(out,`${tag}.json`),JSON.stringify(report,null,2));await browser.close();}
