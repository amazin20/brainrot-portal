import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
const require=createRequire('/tmp/atlas-browser/package.json');
const puppeteer=require('puppeteer-core');
const out=path.resolve(process.env.OUT_DIR||'atlas-proof/browser');fs.mkdirSync(out,{recursive:true});
const root=path.resolve(process.env.SITE_DIR||'site');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.glb':'model/gltf-binary','.wasm':'application/wasm','.jpg':'image/jpeg','.webp':'image/webp','.mp4':'video/mp4'};
let server;
if(!process.env.PAGE_URL){server=http.createServer((req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}const stat=fs.statSync(file);if(!stat.isFile())throw Error();res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':stat.size});fs.createReadStream(file).pipe(res);}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));}
const base=process.env.PAGE_URL||`http://127.0.0.1:${server.address().port}/`;
const report={pass:false,url:base,interfaceVersion:'v51-atlas',errors:[],selections:[],layouts:[],launches:[],retainedEditions:[],settings:false,keyboard:false,reducedMotion:false};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
const phase=name=>{report.phase=name;save();console.log('ATLAS CHECK:',name);};
let browser,active;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function ready(page){await page.bringToFront();await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='ready'&&document.querySelector('#start-screen.atlas-menu.screen--active')&&document.querySelectorAll('#level-select option').length===51,{timeout:180000});await page.waitForFunction(()=>document.querySelectorAll('.sector-tabs [data-atlas-tab]').length===6);await sleep(250);}
async function click(page,selector,touch=false){await page.$eval(selector,e=>e.scrollIntoView({block:'center',inline:'center',behavior:'instant'}));if(touch)await page.tap(selector);else await page.click(selector);}
async function selected(page,level){await page.waitForFunction(n=>Number(document.querySelector('#level-select').value)===n-1&&document.querySelector('#selected-room-number').textContent.endsWith(String(n).padStart(2,'0')),{timeout:15000},level);const text=await page.evaluate(()=>({title:document.querySelector('#selected-room-title').textContent,option:document.querySelector('#level-select').selectedOptions[0].textContent}));assert.equal(text.title,text.option.replace(/^\d+\s*·\s*/,'').replace(/\s*✓$/,''));}
async function newPage(viewport){const page=await browser.newPage();active=page;await page.setViewport({...viewport,deviceScaleFactor:1});page.setDefaultTimeout(90000);page.on('pageerror',e=>{report.errors.push(String(e));save();});return page;}
async function pause(page,touch){
 // Pointer-locked desktop input targets the canvas. Use the game's real
 // Escape shortcut there; coarse pointers have a dedicated native pause key.
 if(touch)await click(page,'.lab-mobile button:nth-child(4)',true);else await page.keyboard.press('Escape');
 await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='paused'&&getComputedStyle(document.querySelector('#pause-screen')).opacity==='1');
}
async function launch(page,level,touch=false){
 phase(`launch ${level}, ${page.viewport().width}px, ${touch?'touch':'desktop'}`);
 await page.$eval('#play-button',e=>e.addEventListener('click',event=>document.documentElement.dataset.atlasTrustedPlay=String(event.isTrusted),{once:true,capture:true}));
 await click(page,'#play-button',touch);
 await page.waitForFunction(n=>document.documentElement.dataset.runtimeState==='playing'&&Number(document.documentElement.dataset.levelIndex)===n-1,{timeout:180000},level);
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.atlasTrustedPlay),'true');
 assert.equal(await page.evaluate(()=>typeof window.__NESI_DEMO_GAME__),'undefined');
 await sleep(450);await page.screenshot({path:path.join(out,`playing-${page.viewport().width}-${level}.png`)});
 await pause(page,touch);
 await click(page,'#resume-button',touch);await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='playing');
 await pause(page,touch);
 await click(page,'#restart-button',touch);await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='playing');
 await pause(page,touch);
 await click(page,'#level-menu-button',touch);await ready(page);await selected(page,level);
 report.launches.push({width:page.viewport().width,height:page.viewport().height,level,touch,trustedPlay:true,pauseResumeRestartReturn:true});save();
}
try{
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,protocolTimeout:600000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 phase('initial menu and native settings');
 const page=await newPage({width:1440,height:900});
 await page.goto(base+'?edition=foundation&level=1',{waitUntil:'domcontentloaded'});await ready(page);
 await click(page,'[aria-label="Открыть настройки"]');await page.waitForFunction(()=>document.querySelector('#atlas-dialog').open);
 await page.select('#quality-select','low');await click(page,'#mute-toggle');
 await page.$eval('#volume-control',e=>{e.value='37';e.dispatchEvent(new Event('input',{bubbles:true}));});
 const before=await page.evaluate(()=>({quality:document.querySelector('#quality-select').value,muted:document.querySelector('#mute-toggle').checked,volume:document.querySelector('#volume-control').value}));
 await page.screenshot({path:path.join(out,'settings-desktop.png')});
 await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#atlas-dialog').open);
 await page.reload({waitUntil:'domcontentloaded'});await ready(page);
 assert.deepEqual(await page.evaluate(()=>({quality:document.querySelector('#quality-select').value,muted:document.querySelector('#mute-toggle').checked,volume:document.querySelector('#volume-control').value})),before);report.settings=true;
 phase('all51 native selections');
 for(let chapter=0;chapter<6;chapter++){
  await click(page,`.sector-tabs button[data-sector="${chapter}"]`);
  const levels=await page.$$eval('.room-node',es=>es.map(e=>Number(e.dataset.level)));
  for(const level of levels){await click(page,`.room-node[data-level="${level}"]`);await selected(page,level);report.selections.push(level);}
  save();
 }
 assert.deepEqual([...new Set(report.selections)].sort((a,b)=>a-b),Array.from({length:51},(_,i)=>i+1));
 phase('keyboard and responsive layouts');
 await click(page,'.sector-tabs button[data-sector="0"]');await click(page,'.room-node[data-level="1"]');await page.focus('.room-node[data-level="1"]');await page.keyboard.press('ArrowRight');await selected(page,2);
 await page.keyboard.press('ArrowDown');await selected(page,9);report.keyboard=true;
 await click(page,'.sector-tabs button[data-sector="5"]');await click(page,'.room-node[data-level="42"]');
 await page.waitForFunction(()=>{const i=document.querySelector('.atlas-preview-image');return i.complete&&i.naturalWidth>0;});
 for(const [width,height] of [[1920,1080],[1440,900],[960,540],[844,390],[768,1024],[640,800],[620,800],[600,800],[390,844],[360,640],[320,640]]){
  await page.setViewport({width,height,deviceScaleFactor:1});await sleep(250);
  const layout=await page.evaluate(()=>{const e=document.querySelector('#start-screen');return {width:innerWidth,height:innerHeight,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth,scrollHeight:e.scrollHeight,buttons:[...e.querySelectorAll('button')].filter(b=>getComputedStyle(b).display!=='none').map(b=>({label:b.getAttribute('aria-label')||b.textContent.trim(),width:b.getBoundingClientRect().width}))};});
  assert.ok(layout.scrollWidth<=layout.clientWidth+2,'Horizontal overflow at '+width+': '+layout.scrollWidth);report.layouts.push(layout);save();
  if([1440,960,390].includes(width)){await page.evaluate(()=>document.querySelector('#start-screen').scrollTop=0);await page.screenshot({path:path.join(out,`menu-${width}.png`)});}
 }
 await page.setViewport({width:1440,height:900,deviceScaleFactor:1});
 phase('actual animation and reduced motion');
 const animationTime=()=>page.$eval('.atlas-route-energy',e=>e.getAnimations()[0]?.currentTime);
 const t0=await animationTime();await sleep(200);const t1=await animationTime();assert.ok(Number.isFinite(t0)&&t1>t0);report.motion={pathAnimationAdvanced:true,beforeMilliseconds:t0,afterMilliseconds:t1};
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 await click(page,'.sector-tabs button[data-sector="2"]');await sleep(100);
 assert.equal(await page.$eval('.atlas-route-energy',e=>getComputedStyle(e).display),'none');report.reducedMotion=true;
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
 for(const level of [1,41,42,51]){const chapter=level<=10?0:level===41?4:5;await click(page,`.sector-tabs button[data-sector="${chapter}"]`);await click(page,`.room-node[data-level="${level}"]`);await selected(page,level);await launch(page,level);}
 await page.close();
 for(const [width,height,level] of [[390,844,42],[844,390,51]]){
  const mobile=await newPage({width,height,isMobile:true,hasTouch:true});await mobile.goto(base+`?edition=foundation&level=${level}`,{waitUntil:'domcontentloaded'});await ready(mobile);await selected(mobile,level);
  await mobile.screenshot({path:path.join(out,`mobile-menu-${width}-${level}.png`)});
  await click(mobile,'[aria-label="Открыть настройки"]',true);await mobile.waitForFunction(()=>document.querySelector('#atlas-dialog').open);await click(mobile,'[aria-label="Закрыть окно"]',true);
  await launch(mobile,level,true);await mobile.reload({waitUntil:'domcontentloaded'});await ready(mobile);await selected(mobile,level);await mobile.close();
 }
 const permalink=await newPage({width:960,height:700});await permalink.goto(base+'tower-singularity/?edition=foundation&level=51',{waitUntil:'domcontentloaded'});await ready(permalink);await selected(permalink,51);await launch(permalink,51);await permalink.close();
 phase('retained edition menus');
 for(const edition of ['classic','open']){
  const legacy=await newPage({width:960,height:700});await legacy.goto(base+`?edition=${edition}&level=1`,{waitUntil:'domcontentloaded'});await legacy.bringToFront();
  await legacy.waitForFunction(()=>document.documentElement.dataset.runtimeState==='ready'&&document.querySelector('#start-screen.screen--active'),{timeout:180000});
  const status=await legacy.evaluate(()=>({atlasEnabled:document.documentElement.classList.contains('atlas-enabled'),originalHero:!!document.querySelector('#start-screen .hero-panel'),rooms:document.querySelectorAll('#level-select option').length,selected:Number(document.querySelector('#level-select').value)}));
  assert.equal(status.atlasEnabled,false);assert.equal(status.originalHero,true);assert.ok(status.rooms>0);assert.equal(status.selected,0);if(edition==='classic')assert.equal(status.rooms,33);
  report.retainedEditions.push({edition,...status});save();await legacy.close();
 }
 assert.deepEqual(report.errors,[]);report.pass=true;phase('complete');console.log('ATLAS MENU VERIFIED',JSON.stringify(report));
}catch(error){report.error=String(error);report.stack=error.stack;save();if(active&&!active.isClosed()){report.state=await active.evaluate(()=>({url:location.href,runtime:document.documentElement.dataset.runtimeState,ui:document.documentElement.dataset.interfaceVersion,detail:document.querySelector('#error-detail')?.textContent,selection:document.querySelector('#level-select')?.value})).catch(()=>null);await active.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});}throw error;
}finally{save();await browser?.close();if(server)await new Promise(r=>server.close(r));}
