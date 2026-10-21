/** Actual public smoke only. Never intercepts/replaces game responses or SDK. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';

/** Decode the real canvas image, independently of the varied HTML HUD.
 * Check its centre as well as the whole image: edge widgets, borders, and
 * transparent/default WebGL buffers cannot provide the nonblank evidence. */
export function validateGameCanvasPixels(file){
 const code=`import json,sys\nfrom PIL import Image,ImageStat\np=Image.open(sys.argv[1]).convert('RGBA')\nw,h=p.size\ndef sample(image):\n s=image.resize((64,36))\n rgb=s.convert('RGB')\n return {'colors':len(rgb.getcolors(2305) or []),'maxChannelStd':max(ImageStat.Stat(rgb).stddev),'opaqueFraction':sum(a>=250 for a in s.getchannel('A').getdata())/(64*36)}\ncentral=p.crop((int(w*.18),int(h*.15),int(w*.82),int(h*.85)))\nprint(json.dumps({'width':w,'height':h,'whole':sample(p),'central':sample(central)}))`;
 const result=spawnSync(process.env.CODEX_PRIMARY_RUNTIME_PYTHON||'python3',['-c',code,file],{encoding:'utf8',timeout:10000,maxBuffer:1048576});
 assert.equal(result.status,0,'Game canvas image decode failed: '+String(result.stderr||result.error||''));
 const pixels=JSON.parse(result.stdout);
 assert.ok(pixels.width>=100&&pixels.height>=100,'Invalid game canvas dimensions');
 for(const area of ['whole','central'])assert.ok(pixels[area].colors>=16&&pixels[area].maxChannelStd>=3&&pixels[area].opaqueFraction>=.98,
  'Blank or invalid actual game canvas '+area+': '+JSON.stringify(pixels));
 return pixels;
}

export async function captureActualGameCanvas(page,file){
 const shot=await page.evaluate(()=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('Actual game canvas animation-frame capture timed out')),45000);
  requestAnimationFrame(()=>{
   try{
    const canvases=document.querySelectorAll('#game canvas');if(canvases.length!==1)throw Error('Expected one actual game canvas');
    const canvas=canvases[0],gl=canvas.getContext('webgl2')||canvas.getContext('webgl');
    if(!gl||gl.isContextLost())throw Error('Actual game WebGL context is absent or lost');
    if(canvas.width<100||canvas.height<100||canvas.width*canvas.height>10000000)throw Error('Invalid actual WebGL canvas dimensions');
    // This observes the ordinary native render in its animation frame. It
    // neither invokes a QA/game bridge nor composites any HTML onto pixels.
    resolve({data:canvas.toDataURL('image/png'),width:canvas.width,height:canvas.height});
   }catch(error){reject(error);}finally{clearTimeout(timer);}
  });
 }));
 assert.ok(shot.data.startsWith('data:image/png;base64,'),'Actual game canvas did not produce PNG');
 const bytes=Buffer.from(shot.data.split(',')[1],'base64');fs.writeFileSync(file,bytes);
 let pixels;try{pixels=validateGameCanvasPixels(file);}catch(error){fs.renameSync(file,file+'.invalid');throw error;}
 assert.equal(pixels.width,shot.width);assert.equal(pixels.height,shot.height);
 return {ok:true,includesHTML:false,selector:'#game canvas',method:'actual WebGL canvas PNG in native animation frame',file,
  bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),pixels};
}

export async function runPublicNativeSmoke(){
const config=JSON.parse(fs.readFileSync('tools/campaign-v66-release.json'));
const state=JSON.parse(fs.readFileSync('proof/preparation.json'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const producer=Object.fromEntries(['GITHUB_REPOSITORY','GITHUB_SHA','GITHUB_RUN_ID','GITHUB_RUN_ATTEMPT'].map(key=>[key,process.env[key]]));
assert.deepEqual(state.producer,producer);assert.equal(state.configSha256,hash(fs.readFileSync('tools/campaign-v66-release.json')));
assert.equal(state.sourceCommit,config.sourceCommit);assert.equal(state.sourceTree,config.sourceTree);
const base='https://amazin20.github.io/brainrot-portal/',candidate=new URL('campaign-v66/',base).href;
const expected=new Map(state.unionFiles.map(row=>[new URL(row.path,base).href,row]));
expected.set(base,expected.get(new URL('index.html',base).href));expected.set(candidate,expected.get(new URL('index.html',candidate).href));
const source=path.resolve('source'),out=path.resolve('proof/native');assert.ok(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const require=createRequire(path.join(source,'package.json')),modulePath=require.resolve('puppeteer-core');
assert.equal(JSON.parse(fs.readFileSync(path.join(source,'node_modules/puppeteer-core/package.json'))).version,'24.16.0');
const{default:puppeteer}=await import(pathToFileURL(modulePath).href);
const{waitForStartMenu,activate}=await import(pathToFileURL(path.join(source,'scripts/lib/singularity-ui-check.mjs')).href);
const{captureBrowserFrame}=await import(pathToFileURL(path.join(source,'scripts/qa-browser-capture.mjs')).href);
const network=[],errors=[],cases=[];let browser,rootRedirectObserved=false;
const report=()=>({kind:'v66-actual-public-native-smoke',pass:errors.length===0&&cases.length===2,publicationAccepted:false,
 sourceCommit:config.sourceCommit,sourceTree:config.sourceTree,producer,rootRedirectObserved,
 normalGuestNoQaBridge:cases.length===2&&cases.every(row=>row.qaBridge==='undefined'),cases,network,errors,
 masterTzAccepted:false,humanPlaytest:false,physicalPhonePerformanceAccepted:false,hardwareFPSMeasured:false,liveSdkAccepted:false,moderationAccepted:false,
 scope:'Fresh ordinary desktop and touch guests on actual public response bodies; root redirect, progression gate, native Play, rendered frame and compact pause. No full campaign replay or physical phone claim.'});
try{
 for(const mode of ['desktop','mobile']){
  browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,protocolTimeout:180000,
   args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage(),pending=new Set(),number=cases.length+1;page.setDefaultTimeout(180000);
  await page.setCacheEnabled(false);await page._client().send('Network.enable',{maxTotalBufferSize:134217728,maxResourceBufferSize:67108864,enableDurableMessages:true});
  await page.setViewport(mode==='desktop'?{width:1280,height:720,deviceScaleFactor:1}:{width:844,height:390,deviceScaleFactor:1,isMobile:true,hasTouch:true});
  page.on('pageerror',error=>errors.push(mode+': '+String(error.stack||error)));page.on('error',error=>errors.push(mode+' renderer: '+String(error)));
  page.on('response',response=>{
   const task=(async()=>{
    const url=new URL(response.url());if(['blob:','data:'].includes(url.protocol))return;url.search='';url.hash='';
    if(url.origin===new URL(base).origin&&url.pathname.endsWith('/favicon.ico')&&response.status()===404)return;
    const row=expected.get(url.href);assert.ok(row,'Response outside accepted public inventory: '+response.url());assert.equal(response.status(),200);assert.equal(response.fromCache(),false);
    const bytes=await response.buffer();assert.equal(bytes.length,row.bytes);assert.equal(hash(bytes),row.sha256,'Public response mismatch: '+url.href);
    network.push({page:number,mode,url:url.href,status:200,bytes:bytes.length,sha256:hash(bytes),fromCache:false});
   })().catch(error=>errors.push(String(error.stack||error))).finally(()=>pending.delete(task));pending.add(task);
  });
  const entry=mode==='desktop'?base+'?level=51':candidate;
  await page.goto(entry,{waitUntil:'domcontentloaded'});await waitForStartMenu(page);await page.waitForFunction(url=>location.href.startsWith(url),{},candidate);
  if(mode==='desktop'){rootRedirectObserved=page.url()===candidate+'?level=51';assert.equal(rootRedirectObserved,true);}
  const ready=await page.evaluate(()=>({state:document.documentElement.dataset.runtimeState,index:Number(document.documentElement.dataset.levelIndex),
   qaBridge:typeof window.__NESI_DEMO_GAME__,selected:Number(document.querySelector('#level-select').value),
   options:[...document.querySelector('#level-select').options].map(o=>({value:o.value,disabled:o.disabled}))}));
  assert.equal(ready.index,0);assert.equal(ready.selected,0);assert.equal(ready.qaBridge,'undefined');assert.equal(ready.options.length,51);assert.equal(ready.options.filter(o=>!o.disabled).length,1);
  const stamp=await page.evaluate(async url=>{const r=await fetch(url,{cache:'no-store'});return{status:r.status,body:await r.text()};},candidate+'build-info.json');
  assert.equal(stamp.status,200);assert.equal(hash(Buffer.from(stamp.body)),state.originalBuildInfoSha256);assert.equal(JSON.parse(stamp.body).commit,config.sourceCommit);
  await activate(page,'#play-button',mode==='mobile');await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='playing');
  await page.waitForFunction(()=>{const start=document.querySelector('#start-screen'),canvas=document.querySelector('#game canvas');return start?.inert&&getComputedStyle(start).opacity==='0'&&canvas?.width>0&&canvas?.height>0;});
  const frame=await captureBrowserFrame(page,path.join(out,mode+'-ordinary-play.jpg'),{timeoutMs:60000,canvasOnly:false});assert.equal(frame.ok,true);assert.equal(frame.includesHTML,true);
  const gameCanvas=await captureActualGameCanvas(page,path.join(out,mode+'-actual-game-canvas.png'));assert.equal(gameCanvas.includesHTML,false);
  if(mode==='desktop')await page.keyboard.press('Escape');else await activate(page,'.lab-mobile button:nth-child(4)',true);
  await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='paused');
  const paused=await page.evaluate(()=>({state:document.documentElement.dataset.runtimeState,selects:document.querySelector('#pause-screen').querySelectorAll('select#level-select').length,
   atlasButton:!!document.querySelector('#level-menu-button'),settingsOpen:document.querySelector('#pause-settings').open}));
  assert.equal(paused.selects,0);assert.equal(paused.atlasButton,true);assert.equal(paused.settingsOpen,false);
  await activate(page,'#level-menu-button',mode==='mobile');await waitForStartMenu(page);await activate(page,'#campaign-back-button',mode==='mobile');
  await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='playing');
  await page.waitForNetworkIdle({idleTime:250,timeout:180000});while(pending.size)await Promise.all([...pending]);assert.deepEqual(errors,[]);
  assert.ok(network.some(row=>row.page===number&&row.url===candidate)&&network.some(row=>row.page===number&&row.url.endsWith('.glb')),'No actual verified consumer/model responses');
  cases.push({mode,url:page.url(),qaBridge:ready.qaBridge,ready,paused,returnedFromAtlas:true,frame,gameCanvas,buildInfoSha256:hash(Buffer.from(stamp.body))});
  await browser.close();browser=null;
 }
 assert.equal(report().pass,true);fs.writeFileSync(path.join(out,'public-browser-report.json'),JSON.stringify(report(),null,2)+'\n');
}catch(error){errors.push(String(error.stack||error));fs.writeFileSync(path.join(out,'public-browser-report.json'),JSON.stringify(report(),null,2)+'\n');throw error;}
finally{await browser?.close();}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await runPublicNativeSmoke();
