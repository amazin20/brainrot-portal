// DEV visual regression: trusted Play followed by ordinary production inputs.
// Canvas samples retain the real camera; this does not measure hardware FPS.
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const {default:puppeteer}=await import(process.env.PUPPETEER_MODULE||'puppeteer-core');
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
const repo=fileURLToPath(new URL('..',import.meta.url)),out=path.resolve(process.env.OUT_DIR||'qa/early-ordinary-visual'),port=Number(process.env.PORT||4205);
assert.ok(!fs.existsSync(out)||fs.readdirSync(out).length===0,'Preserve earlier evidence: choose an empty output directory');
fs.mkdirSync(out,{recursive:true});
function source(){const p=repo+'/src/game';const r=Object.fromEntries(fs.readdirSync(p,{recursive:true}).filter(f=>fs.statSync(path.join(p,f)).isFile()).sort().map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(p,f))).digest('hex')]));r['../styles.css']=crypto.createHash('sha256').update(fs.readFileSync(repo+'/src/styles.css')).digest('hex');return r;}
const requested=process.env.CASES?.split(',')??['wide','portrait'].flatMap(k=>Array.from({length:10},(_,i)=>k+':'+(i+1)));
const controllerSha256=crypto.createHash('sha256').update(fs.readFileSync(fileURLToPath(import.meta.url))).digest('hex');
const report={controllerSha256,requested,scope:'Ordinary production routes from trusted Play at two viewport sizes; actual camera and WebGL canvas samples at milestones; software renderer, no hardware FPS or human acceptance',sourceStart:source(),rows:[],errors:[]},save=()=>fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));save();
const server=spawn('node',['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:repo,stdio:['ignore','pipe','pipe']});
await new Promise((resolve,reject)=>{server.stdout.on('data',b=>{if(String(b).includes('Local:'))resolve();});server.on('error',reject);server.on('exit',c=>reject(Error('server exit '+c)));});
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'],protocolTimeout:240000});
try{
 for(const [kind,width,height]of [['wide',1280,720],['portrait',390,844]])for(let n=1;n<=10;n++){
  if(!requested.includes(kind+':'+n))continue;
  const page=await browser.newPage();await page.setViewport({width,height});page.on('pageerror',e=>report.errors.push({n,kind,error:String(e)}));const started=Date.now();
  try{
   console.log(JSON.stringify({event:'start',n,kind}));
   await page.goto(`http://127.0.0.1:${port}/?edition=foundation&level=${n}&debug=1`,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready'&&!document.querySelector('#start-screen').inert&&getComputedStyle(document.querySelector('#start-screen')).opacity==='1',{timeout:180000});
   await page.evaluate(()=>{const r=window.__NESI_DEMO_GAME__.renderer;window.__EARLY_REVIEW_LOOP__=r.setAnimationLoop;r.setAnimationLoop=function(){return window.__EARLY_REVIEW_LOOP__.call(this,null);};r.setAnimationLoop(null);});
   await page.click('#play-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='playing');
   const row=await page.evaluate(async()=>{
    const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop=window.__EARLY_REVIEW_LOOP__;delete window.__EARLY_REVIEW_LOOP__;const originalBody=g.physics.cargoBody,originalShape=originalBody.shapes[0],originalCargo=g.cargo.group,oldVisual=g.updateVisuals,images=[],samples=[];let visualFrames=0;
    g.updateVisuals=function(...a){if(g.physics.cargoBody!==originalBody||originalBody.shapes[0]!==originalShape||g.cargo.group!==originalCargo)throw Error('Original companion changed');visualFrames++;return oldVisual.apply(this,a);};
    try{
     const {runV8Journey}=await import('/src/game/LabV8Journey.js');
     const route=await runV8Journey(g,{journeyOptions:{nativeStart:true},onMilestone:item=>{
      g.render();const sample={...item,worldStep:g.physics.world.stepnumber,heldOriginal:g.heldCube===g.cargo,bodyId:originalBody.id,shapeId:originalShape.id,camera:{p:g.camera.position.toArray(),q:g.camera.quaternion.toArray(),fov:g.camera.fov},beamSegments:g.firstLevel.state?.segments?.map(s=>({a:s.a.toArray(),b:s.b.toArray()}))};samples.push(sample);images.push(g.renderer.domElement.toDataURL('image/png').split(',')[1]);
     }});
     return{route,samples,images,visualFrames,state:g.state,originalBodyId:originalBody.id,originalShapeId:originalShape.id,sameOriginal:g.physics.cargoBody===originalBody&&originalBody.shapes[0]===originalShape&&g.cargo.group===originalCargo};
    }finally{g.updateVisuals=oldVisual;}
   });
   const stem=`room-${String(n).padStart(2,'0')}-${kind}`;row.files=row.images.map((b,i)=>{const file=`${stem}-${String(i+1).padStart(2,'0')}.png`;fs.writeFileSync(out+'/'+file,Buffer.from(b,'base64'));return file;});delete row.images;
   row.n=n;row.kind=kind;row.width=width;row.height=height;row.wallSeconds=(Date.now()-started)/1000;report.rows.push(row);save();
   console.log(JSON.stringify({event:'finish',n,kind,pass:row.route.pass,state:row.state,frames:row.route.frames,images:row.files.length,resets:row.route.resets,respawns:row.route.respawns,wallSeconds:row.wallSeconds}));
   if(!row.route.pass||row.state!=='won'||!row.sameOriginal||row.route.resets||row.route.respawns||!row.files.length)throw Error('Incomplete ordinary route');
  }finally{await page.close();}
 }
 report.sourceEnd=source();report.sourceDrift=Object.keys(report.sourceStart).filter(k=>report.sourceStart[k]!==report.sourceEnd[k]);report.pass=report.rows.length===requested.length&&!report.errors.length&&!report.sourceDrift.length;save();if(!report.pass)throw Error('Ordinary visual set incomplete');
}catch(e){report.sourceEnd=source();report.sourceDrift=Object.keys(report.sourceStart).filter(k=>report.sourceStart[k]!==report.sourceEnd[k]);report.pass=false;report.failure=String(e.stack||e);save();throw e;}finally{await browser.close();server.kill();}
