import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import puppeteer from 'puppeteer-core';

// Renderer evidence complements the independent source-mesh numerical test.
// Front/side camera transforms below are diagnostic inspection only. The
// continuous clip always retains the production shoulder camera and inputs.
const out=path.resolve(process.env.EVIDENCE_OUT||'smoke-artifacts/visible-glove');
fs.mkdirSync(out,{recursive:true});
const base=new URL(process.env.DEMO_URL||'http://127.0.0.1:4196/');
const files=['src/game/LabCarrySurfaceContact.js','src/game/LabPlayerAnimator.js','src/game/LabPlayerAnimatorBase.js','src/game/LabGame.js'];
const report={scope:'Real production WebGL meshes. Ordinary room 9 pickup/run/jump/landing/stop with the normal camera. Front and side stills are explicitly diagnostic camera inspection, not a solution route. Software WebGL does not establish hardware frame rate.',source:Object.fromEntries(files.map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')])),errors:[],max:{left:0,right:0},samples:[]};
let server,browser;
try{
  const code=`import {createServer} from 'vite';const server=await createServer({server:{host:'127.0.0.1',port:${Number(base.port)},strictPort:true,hmr:false,watch:null}});await server.listen();`;
  server=spawn(process.execPath,['--input-type=module','-e',code],{stdio:'ignore'});
  for(let i=0;i<100;i++){
    try{if((await fetch(base)).ok)break;}catch{}
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH,headless:true,protocolTimeout:240000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-zygote']});
  const page=await browser.newPage();await page.setViewport({width:1280,height:720,deviceScaleFactor:1});
  page.on('pageerror',error=>report.errors.push(String(error.stack||error)));
  await page.evaluateOnNewDocument(()=>localStorage.setItem('brainrot-foundation-v1:brainrot-portal.preferences.v24',JSON.stringify({quality:'low',muted:true})));
  base.searchParams.set('edition','foundation');base.searchParams.set('level','9');base.searchParams.set('debug','1');
  await page.goto(base.href,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready',{timeout:120000});
  const result=await page.evaluate(async()=>{
    const g=window.__NESI_DEMO_GAME__,{LabVisibleGripProbe}=await import('/scripts/lib/lab-visible-grip.mjs');
    g.renderer.setAnimationLoop(null);const probe=new LabVisibleGripProbe(g),frames=[],samples=[];
    window.__NESI_CAPTURE_ANIMATION_FRAME__=frame=>{
      const grip=probe.sample();samples.push({...frame,grip});g.render();
      frames.push(g.renderer.domElement.toDataURL('image/jpeg',.86).split(',')[1]);
    };
    try{
      const route=await window.__NESI_RUN_ANIMATION_ROUTE__({fps:30,carrying:true});
      window.__NESI_CONTACT_PROBE__=probe;
      return {route,frames,samples,anchors:probe.anchors,contextLost:g.renderer.getContext().isContextLost()};
    }finally{delete window.__NESI_CAPTURE_ANIMATION_FRAME__;}
  });
  if(result.contextLost||!result.route.route.pass)throw Error('Production renderer route failed');
  report.route=result.route;report.anchors=result.anchors;report.samples=result.samples;
  for(const sample of result.samples)for(const side of ['left','right'])
    if(sample.grip[side].reachBlend>.999&&!sample.grip[side].clamped)report.max[side]=Math.max(report.max[side],sample.grip[side].distance);
  const frames=path.join(out,'normal-camera');fs.mkdirSync(frames,{recursive:true});
  result.frames.forEach((frame,i)=>fs.writeFileSync(path.join(frames,String(i).padStart(4,'0')+'.jpg'),Buffer.from(frame,'base64')));
  report.video=path.join(out,'held-friend-normal-camera.mp4');
  const encode=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-framerate','30','-i',frames+'/%04d.jpg','-c:v','libx264','-crf','20','-pix_fmt','yuv420p',report.video],{encoding:'utf8'});
  if(encode.status!==0)throw Error(encode.stderr);
  report.stills=[];
  for(const side of ['front','side']){
    const shot=await page.evaluate(side=>{
      const g=window.__NESI_DEMO_GAME__,camera=g.camera,probe=window.__NESI_CONTACT_PROBE__;
      const saved={position:camera.position.clone(),quaternion:camera.quaternion.clone(),fov:camera.fov};
      const focus=g.playerGroup.position.clone();focus.y+=1.25;
      const forward=g.cargo.group.position.clone().sub(g.playerGroup.position);forward.y=0;forward.normalize();
      const view=side==='front'?forward:forward.clone().set(forward.z,0,-forward.x);
      camera.position.copy(focus).addScaledVector(view,3.6);camera.position.y+=.2;camera.lookAt(focus);camera.updateMatrixWorld(true);g.render();
      const grip=probe.sample(),jpeg=g.renderer.domElement.toDataURL('image/jpeg',.95).split(',')[1],transform={position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),fov:camera.fov};
      camera.position.copy(saved.position);camera.quaternion.copy(saved.quaternion);camera.fov=saved.fov;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
      return {jpeg,grip,transform};
    },side);
    // A browser DOM label is captured with the real canvas, without changing
    // source geometry/materials or adding scene content to a contact patch.
    await page.evaluate(({side,jpeg})=>{
      const overlay=document.createElement('div');overlay.id='contact-inspection';Object.assign(overlay.style,{position:'fixed',inset:'0',zIndex:'99999',background:'#111'});
      const picture=document.createElement('img');picture.src='data:image/jpeg;base64,'+jpeg;Object.assign(picture.style,{width:'100%',height:'100%',objectFit:'contain'});
      const label=document.createElement('div');label.textContent=`DIAGNOSTIC ${side.toUpperCase()} CAMERA · VISIBLE GLOVE CONTACT · NOT A LEVEL SOLUTION`;Object.assign(label.style,{position:'absolute',left:'16px',top:'16px',padding:'10px 14px',background:'#071017e8',color:'#bff6ff',font:'bold 16px sans-serif',border:'1px solid #71ddeb',borderRadius:'8px'});
      overlay.append(picture,label);document.body.append(overlay);
    },{side,jpeg:shot.jpeg});
    const file=path.join(out,`diagnostic-contact-${side}.png`);await page.screenshot({path:file});await page.evaluate(()=>document.getElementById('contact-inspection').remove());
    report.stills.push({side,file,grip:shot.grip,camera:shot.transform});
  }
  report.pass=!report.errors.length&&Object.values(report.max).every(gap=>gap<=.02);
  if(!report.pass)throw Error('Strict production visible glove contact failed');
  console.log(JSON.stringify({pass:report.pass,max:report.max,frames:result.frames.length,video:report.video,stills:report.stills.map(s=>s.file)}));
}catch(error){report.pass=false;report.failure=String(error.stack||error);throw error;}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser?.close();server?.kill();}
