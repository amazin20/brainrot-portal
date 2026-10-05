import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import puppeteer from 'puppeteer-core';

const out=path.resolve(process.env.EVIDENCE_OUT||'smoke-artifacts/animation-presentation');
fs.mkdirSync(out,{recursive:true});
const report={scope:'Production WebGL room 9; ordinary movement/pickup/jump/stop controls. Software WebGL is visual evidence, not a hardware FPS measurement.',errors:[],routes:[]};
const base=new URL(process.env.DEMO_URL||'http://127.0.0.1:4193/');
let server;
if(process.env.START_SERVER==='1'){
  // Parallel source work must not HMR-reload a continuous evidence recording.
  const serverCode=`import {createServer} from 'vite';const server=await createServer({server:{host:'127.0.0.1',port:${Number(base.port)},strictPort:true,hmr:false,watch:null}});await server.listen();`;
  server=spawn(process.execPath,['--input-type=module','-e',serverCode],{stdio:'ignore'});
  for(let i=0;i<100;i++){
    try{if((await fetch(base)).ok)break;}catch{}
    await new Promise(resolve=>setTimeout(resolve,50));
  }
}
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH,headless:true,protocolTimeout:180000,
  args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-zygote']});
try{
  const page=await browser.newPage();await page.setViewport({width:960,height:540,deviceScaleFactor:1});
  page.on('pageerror',error=>report.errors.push(String(error.stack||error)));
  await page.evaluateOnNewDocument(()=>localStorage.setItem('brainrot-foundation-v1:brainrot-portal.preferences.v24',JSON.stringify({quality:'low',muted:true})));
  const url=new URL(base);
  url.searchParams.set('edition','foundation');url.searchParams.set('level','9');url.searchParams.set('debug','1');
  await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready',{timeout:120000});
  await page.evaluate(()=>window.__NESI_DEMO_GAME__.renderer.setAnimationLoop(null));
  for(const carrying of process.env.CARRYING==='1'?[true]:process.env.CARRYING==='0'?[false]:[false,true]){
    const name=carrying?'held-friend-jump':'free-jump',folder=path.join(out,name);fs.mkdirSync(folder,{recursive:true});
    const result=await page.evaluate(async carrying=>{
      const g=window.__NESI_DEMO_GAME__,frames=[];
      window.__NESI_CAPTURE_ANIMATION_FRAME__=sample=>{
        g.render();
        frames.push({sample,jpeg:g.renderer.domElement.toDataURL('image/jpeg',.82).split(',')[1]});
      };
      try{return {route:await window.__NESI_RUN_ANIMATION_ROUTE__({fps:15,carrying}),frames,contextLost:g.renderer.getContext().isContextLost()};}
      finally{delete window.__NESI_CAPTURE_ANIMATION_FRAME__;}
    },carrying);
    if(result.contextLost||!result.route.route.pass)throw Error(name+' did not finish in the production renderer');
    for(const [i,frame] of result.frames.entries())fs.writeFileSync(path.join(folder,String(i).padStart(4,'0')+'.jpg'),Buffer.from(frame.jpeg,'base64'));
    const video=path.join(out,name+'.mp4');
    const encode=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-framerate','15','-i',folder+'/%04d.jpg','-c:v','libx264','-crf','20','-pix_fmt','yuv420p',video],{encoding:'utf8'});
    if(encode.status!==0)throw Error(encode.stderr);
    report.routes.push({name,video,frames:result.frames.length,...result.route});
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify({name,frames:result.frames.length,motion:result.route.motion}));
  }
  if(report.errors.length)throw Error(report.errors.join('\n'));
  report.pass=true;
}catch(error){report.pass=false;report.failure=String(error.stack||error);throw error;}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();server?.kill();}
