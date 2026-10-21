/** Main-owned observer around the exact Source mobile driver. Records actual
 * response bodies from live targets; never rewrites game or SDK bytes. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=process.cwd(),source=path.resolve('source'),out=path.resolve('proof/mobile');
const config=JSON.parse(fs.readFileSync('tools/campaign-v64-release.json'));
const state=JSON.parse(fs.readFileSync('proof/preparation.json'));
const producer=Object.fromEntries(['GITHUB_REPOSITORY','GITHUB_SHA','GITHUB_RUN_ID','GITHUB_RUN_ATTEMPT'].map(key=>[key,process.env[key]]));
const hash=value=>createHash('sha256').update(value).digest('hex');
assert.deepEqual(state.producer,producer);assert.equal(state.configSha256,hash(fs.readFileSync('tools/campaign-v64-release.json')));
const base='https://amazin20.github.io/brainrot-portal/campaign-v64/';
const expected=new Map(state.candidateFiles.map(row=>[new URL(row.path,base).href,row]));
expected.set(base,expected.get(new URL('index.html',base).href));
const packageRoot=path.join(source,'node_modules/puppeteer-core'),metadata=JSON.parse(fs.readFileSync(path.join(packageRoot,'package.json')));
assert.equal(metadata.version,'24.16.0');let entry=metadata.exports?.['.']?.import;
while(entry&&typeof entry==='object')entry=entry.default||entry.node||entry.import;
assert.equal(typeof entry,'string');const modulePath=path.resolve(packageRoot,entry);
assert.ok(modulePath.startsWith(packageRoot+path.sep));
const sourceDriver=path.join(source,'scripts/qa-mobile-controls-v64.mjs');
const resolved=spawnSync(process.execPath,['--experimental-import-meta-resolve','--input-type=module','-e',
 'process.stdout.write(import.meta.resolve("puppeteer-core",process.argv[1]))',pathToFileURL(sourceDriver).href],{encoding:'utf8'});
assert.equal(resolved.status,0,resolved.stderr);assert.equal(resolved.stdout.trim(),pathToFileURL(modulePath).href);
const {default:puppeteer}=await import(pathToFileURL(modulePath).href);
const launch=puppeteer.launch.bind(puppeteer),network=[],failures=[],stampReads=[];
let pageCount=0;
function observeBrowser(browser){
 const originalNewPage=browser.newPage.bind(browser),originalClose=browser.close.bind(browser),live=new Map();
 const drain=async p=>{
   const s=live.get(p);if(!s)return;if(s.draining)return s.draining;
   s.draining=(async()=>{
     await p.waitForNetworkIdle({idleTime:250,timeout:180000});
     while(s.pending.size)await Promise.all([...s.pending]);
     assert.deepEqual(failures,[],'Candidate response body failed before target invalidation');
   })();
   try{await s.draining;}finally{s.draining=null;}
 };
 browser.newPage=async(...args)=>{
   const p=await originalNewPage(...args),number=++pageCount,s={pending:new Set(),draining:null};live.set(p,s);
   p.on('pageerror',error=>failures.push('Public page '+number+' runtime error: '+String(error.stack||error)));
   await p.setCacheEnabled(false);
   await p._client().send('Network.enable',{maxTotalBufferSize:134217728,maxResourceBufferSize:67108864,enableDurableMessages:true});
   p.on('response',response=>{
     const actual=new URL(response.url());actual.search='';actual.hash='';const row=expected.get(actual.href);
     if(!row){
       if(['data:','blob:'].includes(actual.protocol)||actual.origin===new URL(base).origin&&actual.pathname.endsWith('/favicon.ico')&&response.status()===404)return;
       failures.push('Response outside the frozen candidate inventory: '+response.url());return;
     }
     const task=(async()=>{
       assert.equal(response.status(),200);assert.equal(response.fromCache(),false);const bytes=await response.buffer();
       assert.equal(bytes.length,row.bytes,'Actual candidate response length differs: '+actual.href);
       assert.equal(hash(bytes),row.sha256,'Actual candidate response differs: '+actual.href);
       network.push({page:number,url:actual.href,status:response.status(),bytes:bytes.length,sha256:hash(bytes),fromCache:response.fromCache()});
     })().catch(error=>failures.push(String(error.stack||error))).finally(()=>s.pending.delete(task));s.pending.add(task);
   });
   const go=p.goto.bind(p);p.goto=async(url,...rest)=>{
     assert.ok(String(url).startsWith(base),'Source driver attempted a different site');await drain(p);
     const result=await go(url,...rest);
     const stamp=await p.evaluate(async url=>{const response=await fetch(url,{cache:'no-store'});return{status:response.status,url:response.url,body:await response.text()};},new URL('build-info.json',base).href);
     assert.equal(stamp.status,200);assert.equal(stamp.url,new URL('build-info.json',base).href);
     assert.equal(hash(Buffer.from(stamp.body)),state.originalBuildInfoSha256);assert.equal(JSON.parse(stamp.body).commit,config.sourceCommit);
     stampReads.push({page:number,url:stamp.url,status:stamp.status,sha256:hash(Buffer.from(stamp.body))});return result;
   };
   const close=p.close.bind(p);p.close=async(...rest)=>{try{await drain(p);}finally{await close(...rest);live.delete(p);}};
   return p;
 };
 browser.close=async(...args)=>{
   let error;try{for(const p of live.keys())if(!p.isClosed())await drain(p);}catch(e){error=e;}
   finally{await originalClose(...args);live.clear();}if(error)throw error;
 };
 return browser;
}
puppeteer.launch=async(...args)=>observeBrowser(await launch(...args));
fs.mkdirSync(out,{recursive:true});assert.deepEqual(fs.readdirSync(out),[]);
let desktop,ordinaryMobile,browser;
try{
 // Run the exact Source script unchanged, with its local stamped package as
 // comparison and all actions directed at the genuinely published URL.
 process.chdir(source);
 Object.assign(process.env,{PAGE_URL:base,SITE_DIR:path.join(source,'dist'),OUT_DIR:path.join(out,'mobile')});
 await import(pathToFileURL(sourceDriver).href);
 process.chdir(root);
 const mobile=JSON.parse(fs.readFileSync(path.join(out,'mobile/report.json')));
 assert.equal(mobile.pass,true);assert.equal(mobile.url,base);assert.equal(mobile.sourceCommit,config.sourceCommit);
 // A separate fresh ordinary guest must still be gated and have no QA bridge.
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,
   protocolTimeout:180000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await browser.newPage();p.setDefaultTimeout(180000);await p.setViewport({width:1280,height:800});
 await p.goto(base+'?level=51',{waitUntil:'domcontentloaded'});
 const {waitForStartMenu,activate}=await import(pathToFileURL(path.join(source,'scripts/lib/singularity-ui-check.mjs')).href);
 await waitForStartMenu(p);
 const ready=await p.evaluate(()=>({state:document.documentElement.dataset.runtimeState,index:Number(document.documentElement.dataset.levelIndex),
   bridge:typeof window.__NESI_DEMO_GAME__,selected:Number(document.querySelector('#level-select').value),options:[...document.querySelector('#level-select').options].map(o=>({value:o.value,disabled:o.disabled}))}));
 assert.equal(ready.index,0);assert.equal(ready.selected,0);assert.equal(ready.bridge,'undefined');assert.equal(ready.options.length,51);
 assert.equal(ready.options.filter(o=>!o.disabled).length,1);
 await activate(p,'#play-button');await p.waitForFunction(()=>document.documentElement.dataset.runtimeState==='playing');
 await p.keyboard.press('Escape');await p.waitForFunction(()=>document.documentElement.dataset.runtimeState==='paused');
 const paused=await p.evaluate(()=>({state:document.documentElement.dataset.runtimeState,selects:document.querySelector('#pause-screen').querySelectorAll('select#level-select').length,
   menu:!!document.querySelector('#level-menu-button'),settingsOpen:document.querySelector('#pause-settings').open}));
 assert.equal(paused.selects,0);assert.equal(paused.menu,true);assert.equal(paused.settingsOpen,false);
 await activate(p,'#level-menu-button');await waitForStartMenu(p);
 assert.equal(await p.$eval('#campaign-back-button',e=>e.hidden),false);
 await activate(p,'#campaign-back-button');await p.waitForFunction(()=>document.documentElement.dataset.runtimeState==='playing');
 await p.screenshot({path:path.join(out,'ordinary-desktop.png')});desktop={ready,paused,atlasReturn:true};
 await browser.close();browser=null;
 // A fresh ordinary mobile browser has no diagnostic query or QA bridge.
 // These clean captures show the same actual published consumer controls.
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:process.env.CHROME_HEADLESS==='shell'?'shell':true,
   protocolTimeout:180000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const phone=await browser.newPage();phone.setDefaultTimeout(180000);
 await phone.setViewport({width:844,height:390,isMobile:true,hasTouch:true,deviceScaleFactor:1});
 await phone.goto(base,{waitUntil:'domcontentloaded'});await waitForStartMenu(phone);
 assert.equal(await phone.evaluate(()=>typeof window.__NESI_DEMO_GAME__),'undefined');
 await activate(phone,'#play-button',true);await phone.waitForFunction(()=>document.documentElement.dataset.runtimeState==='playing');
 ordinaryMobile={freshBrowser:true,url:base,qaBridge:'undefined',state:'playing',screenshots:[]};
 for(const [width,height,name]of [[844,390,'public-ordinary-mobile-landscape.png'],[390,844,'public-ordinary-mobile-portrait.png']]){
   await phone.setViewport({width,height,isMobile:true,hasTouch:true,deviceScaleFactor:1});
   await phone.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   assert.equal(await phone.evaluate(()=>document.documentElement.dataset.runtimeState),'playing');
   assert.equal(await phone.evaluate(()=>typeof window.__NESI_DEMO_GAME__),'undefined');
   await phone.screenshot({path:path.join(out,name)});const bytes=fs.readFileSync(path.join(out,name));
   assert.equal(bytes.toString('hex',0,8),'89504e470d0a1a0a');
   ordinaryMobile.screenshots.push({name,bytes:bytes.length,sha256:hash(bytes),width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)});
 }
 await browser.close();browser=null;
 assert.deepEqual(failures,[]);assert.ok(pageCount>=2&&stampReads.length>=2);
 for(let i=1;i<=pageCount;i++)assert.ok(network.some(row=>row.page===i&&row.url===base)&&network.some(row=>row.page===i&&row.url.endsWith('.js')),'Actual page lacks verified HTML/JS');
 const report={kind:'v64-actual-public-ui-and-mobile','pass':true,publicationAccepted:false,sourceCommit:config.sourceCommit,producer,
   mobileReportSha256:hash(fs.readFileSync(path.join(out,'mobile/report.json'))),desktop,ordinaryMobile,pageCount,network,stampReads,
   sourceDriver:{path:'scripts/qa-mobile-controls-v64.mjs',sha256:hash(fs.readFileSync(sourceDriver))},
   physicalPhoneTest:false,hardwareFpsMeasured:false,liveSdkAccepted:false,
   scope:'Actual public HTTP response bytes and native ordinary/mobile inputs. Source51 routes are inherited only through exact package bytes; this public job does not re-run all51.'};
 fs.writeFileSync(path.join(out,'public-browser-report.json'),JSON.stringify(report,null,2)+'\n');
}catch(error){
 process.chdir(root);fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({pass:false,publicationAccepted:false,producer,error:String(error.stack||error),network,failures,stampReads},null,2)+'\n');throw error;
}finally{process.chdir(root);await browser?.close();}
