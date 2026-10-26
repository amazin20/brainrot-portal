// Real browser/DOM review of touch targets and persisted look sensitivity.
// Emulated viewports and trusted browser input do not constitute device FPS or a phone playthrough.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const {default:puppeteer}=await import(process.env.PUPPETEER_MODULE||'puppeteer-core');
const repo=fileURLToPath(new URL('..',import.meta.url)),out=path.resolve(process.env.OUT_DIR||'qa/touch-settings'),port=Number(process.env.PORT||4294);
assert.ok(!fs.existsSync(out)||!fs.readdirSync(out).length,'Use an empty evidence directory');fs.mkdirSync(out,{recursive:true});
const sourceFiles=['index.html','src/main.js','src/styles.css','src/touch-controls.css','src/game/LabControls.js','src/game/LabPreferences.js','src/game/LabLookSensitivity.js','src/game/LabTower41Preview.js'];
const source=()=>Object.fromEntries(sourceFiles.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(repo,f))).digest('hex')]));
const report={scope:'Trusted Chromium touch/keyboard input and actual DOM; emulated viewport, no physical-device claim',sourceStart:source(),rows:[],errors:[]};
const save=()=>fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));save();
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:repo,stdio:['ignore','pipe','pipe']});
await new Promise((ok,no)=>{server.stdout.on('data',b=>{if(String(b).includes('Local:'))ok();});server.on('error',no);server.on('exit',c=>no(Error('vite exited '+c)));});
let browser;
try{
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'],protocolTimeout:240000});
 const page=await browser.newPage();await page.setViewport({width:390,height:844,deviceScaleFactor:1,isMobile:true,hasTouch:true});page.on('pageerror',e=>report.errors.push(String(e)));
 const ready=async()=>{await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready'&&!document.querySelector('#start-screen').inert,{timeout:180000});};
 await page.goto(`http://127.0.0.1:${port}/?edition=foundation&level=1&debug=1`,{waitUntil:'domcontentloaded'});await ready();
 const stored=()=>page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).sort().map(k=>[k,JSON.parse(localStorage.getItem(k))])));
 const before=await stored();
 await page.tap('#menu-settings-button');await page.focus('#menu-sensitivity');await page.keyboard.press('Home');for(let i=0;i<26;i++)await page.keyboard.press('ArrowRight');
 assert.equal(await page.$eval('#menu-sensitivity',e=>e.value),'155');
 assert.equal(await page.evaluate(()=>window.__NESI_DEMO_GAME__.lookSensitivity),1.55);
 await page.screenshot({path:out+'/390x844-sensitivity.png'});
 const after=await stored();
 for(const [key,value]of Object.entries(before))assert.deepEqual({...after[key],lookSensitivity:value.lookSensitivity},value,'Changing sensitivity must preserve every other saved field');
 await page.reload({waitUntil:'domcontentloaded'});await ready();
 assert.equal(await page.evaluate(()=>window.__NESI_DEMO_GAME__.lookSensitivity),1.55);
 assert.equal(await page.$eval('#menu-sensitivity-value',e=>e.value),'155%');report.persistence={value:1.55,reloaded:true,otherSavedFieldsUnchanged:true};
 // Freeze real Play's clock so UI/input checks cannot accidentally move actors.
 await page.evaluate(()=>{const r=window.__NESI_DEMO_GAME__.renderer;r.setAnimationLoop(null);window.__TOUCH_LOOP__=r.setAnimationLoop;r.setAnimationLoop=function(){return window.__TOUCH_LOOP__.call(this,null);};});
 await page.tap('#play-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='playing');
 const client=await page.createCDPSession();
 const gesture=async(points)=>{await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...points[0],id:1}]});for(const p of points.slice(1))await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...p,id:1}]});await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});};
 const pose=()=>page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;return{yaw:g.yaw,pitch:g.pitch};});
 const a=await pose();await gesture([{x:200,y:350},{x:220,y:360}]);const b=await pose();
 assert.ok(Math.abs(b.yaw-a.yaw+.155)<1e-9);assert.ok(Math.abs(b.pitch-a.pitch+.062)<1e-9);report.touchLook={sensitivity:1.55,deltaYaw:b.yaw-a.yaw,deltaPitch:b.pitch-a.pitch};
 await page.tap('.touch-button--pause');await page.tap('#pause-settings > summary');await page.focus('#look-sensitivity');await page.keyboard.press('Home');for(let i=0;i<10;i++)await page.keyboard.press('ArrowRight');
 assert.equal(await page.evaluate(()=>window.__NESI_DEMO_GAME__.lookSensitivity),.75);
 assert.equal(await page.$eval('#menu-sensitivity-value',e=>e.value),'75%');report.pauseSetting={value:.75,menuSynchronized:true};
 await page.tap('#resume-button');
 for(const [width,height]of [[390,844],[320,568],[844,390],[568,320]]){
  await page.setViewport({width,height,deviceScaleFactor:1,isMobile:true,hasTouch:true});
  await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;g.viewportResize();for(let n=0;n<20;n++)g.updateVisuals(1/60,1);g.render();});
  const rows=await page.evaluate(()=>[...document.querySelectorAll('#joystick,#sprint-button,#jump-button,.lab-mobile button')].map(e=>{const r=e.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{selector:e.id||e.className,label:e.getAttribute('aria-label'),x:r.x,y:r.y,w:r.width,h:r.height,hitOwnCenter:e===hit||e.contains(hit)};}));
  for(const row of rows){assert.ok(row.w>=44&&row.h>=44,row.selector+' minimum touch size');assert.ok(row.x>=0&&row.y>=0&&row.x+row.w<=width&&row.y+row.h<=height,row.selector+' within viewport');assert.ok(row.hitOwnCenter,row.selector+' receives own center');}
  const overlaps=rows.flatMap((a,i)=>rows.slice(i+1).filter(b=>Math.min(a.x+a.w,b.x+b.w)>Math.max(a.x,b.x)&&Math.min(a.y+a.h,b.y+b.h)>Math.max(a.y,b.y)).map(b=>[a.selector,b.selector]));assert.deepEqual(overlaps,[]);
  await page.tap('#sprint-button');assert.equal(await page.evaluate(()=>window.__NESI_DEMO_GAME__.input.mobileSprint),true);await page.tap('#sprint-button');assert.equal(await page.evaluate(()=>window.__NESI_DEMO_GAME__.input.mobileSprint),false);
  await page.screenshot({path:out+`/${width}x${height}-playing.png`});
  await page.tap('.touch-button--pause');assert.equal(await page.evaluate(()=>window.__NESI_DEMO_GAME__.state),'paused');await page.tap('#hint-button');
  const hints=await page.$eval('#hint-detail',e=>({visible:!e.hidden,text:e.textContent}));assert.ok(hints.visible);await page.screenshot({path:out+`/${width}x${height}-hints.png`});
  await page.tap('#resume-button');assert.equal(await page.evaluate(()=>window.__NESI_DEMO_GAME__.state),'playing');
  report.rows.push({width,height,targets:rows,overlaps,sprintToggle:true,pauseHintsResume:true});save();console.log('TOUCH_LAYOUT_PASS',width,height);
 }
 report.mouseScope='Mouse scaling and default behavior are covered by production-controller unit tests; this browser review sends touch input.';
 report.sourceEnd=source();assert.deepEqual(report.sourceEnd,report.sourceStart);assert.deepEqual(report.errors,[]);report.pass=true;save();
} catch(error){report.failure=String(error.stack||error);save();throw error;}finally{await browser?.close();server.kill();}
