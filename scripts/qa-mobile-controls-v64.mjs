/** Actual compiled game + native CDP multi-touch. Viewport emulation and
 * simulated inset geometry are explicitly separate from physical phone QA. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import puppeteer from 'puppeteer-core';
import {serveFrozenCampaign} from './lib/frozen-campaign-server.mjs';
import {verifyReleaseMetadata,verifyReleasePackage} from './lib/release-manifest.mjs';
import {waitForStartMenu,activate} from './lib/singularity-ui-check.mjs';

const directory=path.resolve(process.env.SITE_DIR||'dist'),out=path.resolve(process.env.OUT_DIR||'qa/mobile-controls-v64');
const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
assert.equal(execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim(),'','Commit source before evidence');
const info=JSON.parse(fs.readFileSync(path.join(directory,'build-info.json')));
verifyReleaseMetadata(info,{directory,commit,root:process.cwd(),run:info.run||null});
const files=verifyReleasePackage(info,directory);assert.equal(info.version,'v64-mobile-controls');
fs.mkdirSync(out,{recursive:true});assert.deepEqual(fs.readdirSync(out),[],'Use a fresh evidence output');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const report={kind:'v64-mobile-controls-native-browser',pass:false,sourceCommit:commit,sourceInputsSha256:info.sourceInputsSha256,
  packageFilesSha256:info.packageFilesSha256,packageFiles:files.length,layouts:[],screenshots:[],errors:[],
  physicalPhoneTest:false,hardwareFpsMeasured:false,scope:'Compiled consumer game, actual native browser touch events, viewport emulation. Simulated inset case is a CSS geometry test, not a real notched device.'};
const selectors=['#joystick','#sprint-button','#jump-button','.touch-button--channel-1','.touch-button--channel-2','.touch-button--interact','.touch-button--pause'];
const geometry=async page=>page.evaluate(selectors=>({width:innerWidth,height:innerHeight,coarse:matchMedia('(pointer:coarse)').matches,
  controls:selectors.map(selector=>{const e=document.querySelector(selector),r=e.getBoundingClientRect(),s=getComputedStyle(e);return{selector,x:r.x,y:r.y,width:r.width,height:r.height,
    visible:s.display!=='none'&&s.visibility!=='hidden'&&!e.closest('[inert]'),hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)),label:e.getAttribute('aria-label')};}),
  aimUncovered:document.elementFromPoint(innerWidth/2,innerHeight/2)===document.querySelector('#game canvas')}),selectors);
function assertGeometry(g){
  assert.equal(g.coarse,true);assert.equal(g.aimUncovered,true,'Controls/lesson cover the aim point');
  for(const c of g.controls){assert.equal(c.visible,true,c.selector);assert.equal(c.hit,true,c.selector+' blocked');assert.ok(c.label?.length,c.selector+' unnamed');
    assert.ok(c.width>=44&&c.height>=44,c.selector+' too small');assert.ok(c.x>=0&&c.y>=0&&c.x+c.width<=g.width+.1&&c.y+c.height<=g.height+.1,c.selector+' outside viewport');}
  for(let i=0;i<g.controls.length;i++)for(let j=i+1;j<g.controls.length;j++){
    const a=g.controls[i],b=g.controls[j],w=Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x),h=Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y);
    assert.ok(w<=0||h<=0,'Overlapping controls: '+a.selector+' / '+b.selector);
  }
}
let browser,mount,page;
try{
 mount=process.env.PAGE_URL?null:await serveFrozenCampaign(directory);
 const base=new URL(process.env.PAGE_URL||mount.url);assert.equal(base.search,'');assert.equal(base.hash,'');report.url=base.href;
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:process.env.CHROME_HEADLESS==='shell'?'shell':true,
  protocolTimeout:180000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 report.browser=await browser.version();page=await browser.newPage();page.setDefaultTimeout(180000);
 page.on('pageerror',error=>report.errors.push(String(error.stack||error)));
 await page.setViewport({width:844,height:390,isMobile:true,hasTouch:true,deviceScaleFactor:1});
 const entry=new URL(base);entry.searchParams.set('debug','1');
 await page.goto(entry.href,{waitUntil:'domcontentloaded'});await waitForStartMenu(page);
 await activate(page,'#play-button',true);await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='playing');
 const screenshot=async name=>{await page.screenshot({path:path.join(out,name)});const bytes=fs.readFileSync(path.join(out,name));
  assert.equal(bytes.toString('hex',0,8),'89504e470d0a1a0a');report.screenshots.push({name,bytes:bytes.length,sha256:hash(bytes),width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)});};
 for(const[width,height]of[[844,390],[390,844],[360,800],[412,915],[800,360],[568,320],[915,412]]){
   await page.setViewport({width,height,isMobile:true,hasTouch:true,deviceScaleFactor:1});
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const g=await geometry(page);assertGeometry(g);report.layouts.push({kind:'emulated-viewport',...g});await screenshot(`controls-${width}x${height}.png`);
 }
 await page.setViewport({width:844,height:390,isMobile:true,hasTouch:true,deviceScaleFactor:1});
 const insetStyle=await page.addStyleTag({content:':root{--touch-left:58px;--touch-right:48px;--touch-top:32px;--touch-bottom:34px}'});
 const inset=await geometry(page);assertGeometry(inset);report.layouts.push({kind:'simulated-inset-css-geometry',...inset});
 assert.ok(inset.controls.every(c=>c.x>=58&&c.x+c.width<=844-48));await screenshot('controls-simulated-insets.png');
 await insetStyle.evaluate(e=>e.remove());
 // Use fresh measured targets; no synthetic DOM event or actor assignment.
 const g=await geometry(page),stick=g.controls.find(c=>c.selector==='#joystick'),jump=g.controls.find(c=>c.selector==='#jump-button');
 const p1={id:11,x:stick.x+stick.width/2+25,y:stick.y+stick.height/2},p2={id:22,x:470,y:170},p3={id:33,x:jump.x+jump.width/2,y:jump.y+jump.height/2};
 const cdp=await page.createCDPSession();
 const read=()=>{const g=window.__NESI_DEMO_GAME__;return{state:g.state,move:g.input.getMove().toArray(),yaw:g.yaw,look:g.controls.lookPointer?.id??null,
   stickPressed:document.querySelector('#joystick').dataset.pressed==='true',jumpPressed:document.querySelector('#jump-button').dataset.pressed==='true',
   anyPressed:document.querySelectorAll('[data-pressed="true"]').length,body:g.physics.cargoBody.id,cargo:g.cargo.group.uuid};};
 const before=await page.evaluate(read);
 report.multitouch={method:'native CDP touchStart/move/end, three actual fingers',before};
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p1,p2,p3]});
 const chord=await page.evaluate(read);assert.equal(chord.state,'playing');assert.ok(Math.hypot(...chord.move)>.1);assert.notEqual(chord.look,null);assert.equal(chord.stickPressed,true);assert.equal(chord.jumpPressed,true);
 report.multitouch.chord=chord;
 await screenshot('controls-three-fingers.png');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[p1,{...p2,x:p2.x+30},p3]});
 const moved=await page.evaluate(read);assert.ok(Math.abs(moved.yaw-chord.yaw)>.01);assert.ok(Math.hypot(...moved.move)>.1);
 report.multitouch.moved=moved;
 // CDP touchEnd lists the fingers being lifted, as Puppeteer's native
 // CdpTouchHandle.end does; it does not list the fingers still on the glass.
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[p3]});
 const partial=await page.evaluate(read);assert.equal(partial.jumpPressed,false);assert.equal(partial.stickPressed,true);assert.ok(Math.hypot(...partial.move)>.1);
 report.multitouch.partial=partial;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[p1,{...p2,x:p2.x+30}]});
 const released=await page.evaluate(read);assert.deepEqual(released.move,[0,0]);assert.equal(released.look,null);assert.equal(released.anyPressed,0);
 report.multitouch.released=released;
 await activate(page,'#sprint-button',true);assert.equal(await page.$eval('#sprint-button',e=>e.getAttribute('aria-pressed')),'true');
 await activate(page,'.touch-button--pause',true);await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='paused');
 const paused=await page.evaluate(()=>({state:window.__NESI_DEMO_GAME__.state,sprint:window.__NESI_DEMO_GAME__.input.mobileSprint,
  inert:document.querySelector('#mobile-controls').inert,pressed:document.querySelectorAll('[data-pressed="true"]').length}));
 assert.equal(paused.sprint,false);assert.equal(paused.inert,true);assert.equal(paused.pressed,0);
 await activate(page,'#resume-button',true);await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='playing');
 const resumed=await page.evaluate(read);assert.equal(resumed.body,before.body);assert.equal(resumed.cargo,before.cargo);
 report.pause={paused,resumed,sameOriginalCompanion:true};
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 report.reducedMotion=await page.$eval('#jump-button',e=>getComputedStyle(e).transitionDuration);assert.equal(report.reducedMotion,'0s');
 assert.deepEqual(report.errors,[]);report.pass=true;
}catch(error){report.errors.push(String(error.stack||error));if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw error;}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser?.close();if(mount)await new Promise(resolve=>mount.server.close(resolve));}
console.log(JSON.stringify({pass:report.pass,layouts:report.layouts.length,multitouch:!!report.multitouch,screenshots:report.screenshots.length,physicalPhoneTest:false}));
