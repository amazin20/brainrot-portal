import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import puppeteer, {TimeoutError} from 'puppeteer-core';
import {captureBrowserFrame} from './qa-browser-capture.mjs';
import {launchBrowserWithStartupRetry} from './lib/browser-startup.mjs';

const out = path.resolve(process.env.OUT_DIR || 'qa/creative-browser');
fs.mkdirSync(out, {recursive: true});
const levels = (process.env.LEVELS || Array.from({length:51}, (_,i)=>i+1).join(','))
  .split(',').map(Number);
assert.ok(levels.every(n=>Number.isInteger(n)&&n>=1&&n<=51));
const mode = process.env.CASE || 'overview';
assert.ok(['overview','route','rush'].includes(mode));
let server;
if(process.env.START_SERVER==='1') {
  const serverRoot=path.resolve(process.env.SERVER_ROOT||'.'),port=String(process.env.PORT||4173);
  server=spawn(process.execPath,[path.join(serverRoot,'node_modules/vite/bin/vite.js'),
    ...(process.env.SERVER_MODE==='preview'?['preview']:[]),'--host','127.0.0.1','--port',port],
    {cwd:serverRoot,stdio:'ignore'});
  for(let i=0;i<200;i++){
    if(server.exitCode!==null)throw Error('Preview server exited before readiness');
    try{const r=await fetch(`http://127.0.0.1:${port}/`);if(r.ok)break;}catch{}
    if(i===199)throw Error('Preview server did not become ready');
    await new Promise(resolve=>setTimeout(resolve,50));
  }
}
const browserStartup = [];
const launchBrowser = ()=>launchBrowserWithStartupRetry({
  launch: options => puppeteer.launch(options), TimeoutError,
  options: {
    executablePath:process.env.CHROME_PATH || '/usr/bin/chromium', headless:true,
    protocolTimeout:1800000,
    args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader'],
  },
  onAttempt: event => {
    browserStartup.push(event);
    fs.writeFileSync(path.join(out,'browser-startup.json'),JSON.stringify({sourceCommit:process.env.BUILD_COMMIT??null,attempts:browserStartup},null,2)+'\n');
    if(event.retry)console.warn('Browser CDP endpoint startup timed out; waiting for process cleanup before one fresh launch.');
  },
});
let browser=await launchBrowser();
async function bounded(promise,ms,label){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(`${label} timed out after ${ms}ms`)),ms);})]);}finally{clearTimeout(timer);}}
async function retireBrowser(){
  const old=browser;browser=undefined;sharedPage=undefined;if(!old)return;
  try{await bounded(old.close(),3000,'Owned browser shutdown');}
  catch{const child=old.process();if(child?.exitCode===null){try{process.kill(-child.pid,'SIGKILL');}catch{child.kill('SIGKILL');}}}
}
const report = {mode, rows:[], errors:[], limitations:[
  'Scripted production inputs and software WebGL are reproducible checks, not a human playtest or hardware FPS measurement.',
  'Overview camera placement is inspection only; it never counts as a solved route.',
  'A bounded rush attack cannot prove that every possible shortcut is absent.',
  'Route pass records gameplay assertions. Capture pass is reported separately; missing or blank readback never counts as visual evidence.',
]};
const save = ()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
const reuse = process.env.REUSE_PAGE!=='0';
let sharedPage, activeRouteRow, activeRouteToken;
try {
  for (const level of levels) {
    if(!browser)browser=await launchBrowser();
    const page = sharedPage || await browser.newPage(), firstVisit=!sharedPage;
    if(reuse)sharedPage=page;
    if(firstVisit)await page.exposeFunction('__NESI_REPORT_ROUTE_MARK__',({routeToken,mark})=>{
      // A timed-out evaluate is not cancelled. Bindings can still arrive after
      // its row has retired, so attribute progress to this exact invocation.
      if(!activeRouteRow||routeToken!==activeRouteToken)return;
      (activeRouteRow.routeProgress??=[]).push({...mark,wallSeconds:Number(((performance.now()-activeRouteRow.routeStarted)/1000).toFixed(2))});
      if(report.active)report.active.latestMilestone=mark;
      save();console.log(`MILESTONE room ${activeRouteRow.level}: ${mark.name??'unnamed'}`);
    });
    page.setDefaultTimeout(180000);
    await page.setViewport({width:960,height:540,deviceScaleFactor:1});
    await page.evaluateOnNewDocument(()=>{
      localStorage.setItem('brainrot-foundation-v1:brainrot-portal.preferences.v24',JSON.stringify({quality:'low',muted:true}));
    });
    const row = {level,pass:false,errors:[]};
    report.active={level,phase:'opening'};save();
    const onError=e=>row.errors.push(String(e));page.on('pageerror',onError);
    const started = performance.now();
    try {
      const url = new URL(process.env.PAGE_URL || 'http://127.0.0.1:4173/');
      url.search = `?edition=foundation&level=${level}&debug=1`;
      if(firstVisit||!reuse) {
      await page.goto(url.href,{waitUntil:'domcontentloaded'});
      report.active.phase='waiting-for-ready';save();
      await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready');
      await page.$eval('#play-button',e=>e.scrollIntoView({block:'center'}));
      await page.waitForFunction(()=>{
        const g=window.__NESI_DEMO_GAME__,m=document.querySelector('#start-screen'),b=document.querySelector('#play-button');
        if(g?.state!=='ready'||!m||m.inert||getComputedStyle(m).opacity!=='1')return false;
        const r=b.getBoundingClientRect();return b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
      });
      await page.select('#quality-select','low');
      await page.bringToFront(); await page.click('#play-button');
      await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='playing');
      } else {
        report.active.phase='changing-level';save();
        await page.evaluate(async level=>{
          const g=window.__NESI_DEMO_GAME__;await g.selectLevel(level-1,false);g.start();
          document.querySelectorAll('.screen').forEach(e=>e.classList.remove('screen--active'));
          document.body.dataset.playState='playing';
        },level);
      }
      if(mode!=='rush')await page.evaluate(mode=>{const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop(null);if(mode!=='route'){g.lastUiUpdate=-Infinity;g.animate(g.lastFrame);}},mode);
      row.start = await page.evaluate(()=>{
        const g=window.__NESI_DEMO_GAME__,d=g.diagnostics();
        return {id:g.firstLevel.id,title:g.firstLevel.title,position:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),
          floors:g.floors.length,colliders:g.colliders.length,panels:g.portalPanels.length,
          meshes:d.modelsLoaded,missingModels:d.missingModels,cargoUUID:g.cargo.group.uuid,cargoBodyId:g.physics.cargoBody.id,
          calls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles};
      });
      report.active={level,phase:'ready',start:row.start};save();
      console.log(`START WebGL ${mode} room ${level}: ready, cargo ${row.start.cargoUUID}/${row.start.cargoBodyId}`);
      row.captures={};
      assert.deepEqual(row.start.missingModels,[]);
      if(mode==='overview') {
        row.captures.start=await captureBrowserFrame(page,path.join(out,`${level}-start.jpg`));
        await page.evaluate(()=>{
          const g=window.__NESI_DEMO_GAME__;
          let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity,maxY=0;
          for(const f of g.floors){minX=Math.min(minX,f.minX);maxX=Math.max(maxX,f.maxX);minZ=Math.min(minZ,f.minZ);maxZ=Math.max(maxZ,f.maxZ);maxY=Math.max(maxY,f.y||0);}
          const cx=(minX+maxX)/2,cz=(minZ+maxZ)/2,span=Math.max(maxX-minX,maxZ-minZ,20);
          g.camera.position.set(cx+span*.56,maxY+span*.8,cz+span*.67);
          g.camera.lookAt(cx,maxY*.35,cz);g.camera.fov=65;g.camera.far=Math.max(500,span*4);
          g.camera.updateProjectionMatrix();g.camera.updateWorldMatrix(true,false);g.render();
        });
        row.captures.overview=await captureBrowserFrame(page,path.join(out,`${level}-overview.jpg`));
      } else if(mode==='route') {
        report.active.phase='ordinary-route';activeRouteRow=row;row.routeStarted=performance.now();activeRouteToken=`${level}-${row.routeStarted}`;save();
        row.route = await bounded(page.evaluate(async routeToken=>{
          const g=window.__NESI_DEMO_GAME__,cargo=g.cargo,bodyId=g.physics.cargoBody.id;
          const milestoneWrites=[];
          // Readback is deliberately deferred until the canonical route's proof
          // is persisted. Its returned milestones still retain real positions.
          window.__NESI_CAPTURE_LEVEL_MARK__=mark=>{
            const write=window.__NESI_REPORT_ROUTE_MARK__({routeToken,mark:{...mark,
              observedState:{state:g.state,player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),
                solvedIds:g.firstLevel.getTowerMetrics?.().solvedIds??[]}}});
            milestoneWrites.push(write);return write;
          };
          try{
            const result=await window.__NESI_RUN_LEVEL_ROUTE__();
            // The game hook is synchronous. Drain binding acknowledgements
            // before the Node runner retires this row or begins the next one.
            await Promise.all(milestoneWrites);
            return {pass:result.pass,state:g.state,frames:result.frames,teleports:g.teleportCount,
              resets:result.resets??result.cargoResets,respawns:result.respawns,
              sameCompanion:g.cargo===cargo&&g.physics.cargoBody.id===bodyId,
              cargoUUID:g.cargo.group.uuid,cargoBodyId:g.physics.cargoBody.id,milestones:result.milestones??result.events};
          }finally{
            delete window.__NESI_CAPTURE_LEVEL_MARK__;
            // Keep already emitted failure progress too, without replacing the
            // route's original exception with a secondary persistence error.
            await Promise.allSettled(milestoneWrites);
          }
        },activeRouteToken),Number(process.env.ROUTE_TIMEOUT_MS||(level===41?1200000:180000)),'Ordinary production route');
        assert.equal(row.route.pass,true);assert.equal(row.route.state,'won');
        assert.equal(row.route.sameCompanion,true);assert.equal(row.route.cargoUUID,row.start.cargoUUID);assert.equal(row.route.cargoBodyId,row.start.cargoBodyId);
        assert.equal(row.route.resets??0,0);assert.equal(row.route.respawns??0,0);
        assert.deepEqual(row.errors,[]);
        row.gameplayPassed=true;report.rows.push(row);report.active.phase='route-passed';save();
        console.log(`ROUTE PASS room ${level}: ${row.route.frames} frames, ${row.route.teleports} teleports, original ${row.route.cargoUUID}/${row.route.cargoBodyId}`);
        if(process.env.CAPTURE!=='0'){
          report.active.phase='capture-finish';save();
          row.captures.finish=await captureBrowserFrame(page,path.join(out,`${level}-finish.jpg`),{canvasOnly:true});
        }
      } else {
        // Trusted browser keyboard events exercise the live animation loop.
        await page.keyboard.down('ShiftLeft');await page.keyboard.down('KeyW');
        for(let i=0;i<6;i++){
          await page.keyboard.press('Space');
          await new Promise(resolve=>setTimeout(resolve,350));
        }
        await page.keyboard.up('KeyW');await page.keyboard.up('ShiftLeft');
        row.rush=await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;return {state:g.state,elapsed:g.elapsed,player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),teleports:g.teleportCount};});
        assert.notEqual(row.rush.state,'won','A direct sprint won without the puzzle');
        row.captures.rush=await captureBrowserFrame(page,path.join(out,`${level}-rush.jpg`));
      }
      row.capturePass=Object.keys(row.captures).length>0&&Object.values(row.captures).every(c=>c.ok);
      if(mode!=='route')assert.ok(row.capturePass,'A requested capture did not provide nonblank actual pixels');
      assert.deepEqual(row.errors,[]);row.pass=true;
    } catch(error) {
      row.error=String(error);report.errors.push({level,error:String(error)});
    } finally {
      activeRouteRow=undefined;activeRouteToken=undefined;delete row.routeStarted;
      row.wallSeconds=Number(((performance.now()-started)/1000).toFixed(2));
      if(!report.rows.includes(row))report.rows.push(row);delete report.active;save();page.off('pageerror',onError);
      const readbackFailed=Object.values(row.captures??{}).some(c=>!c.ok);
      if(readbackFailed||row.error)await retireBrowser();
      else if(!reuse){try{await bounded(page.close(),3000,'Owned page shutdown');}catch{await retireBrowser();}}
      console.log(`${row.pass?'PASS':'FAIL'} WebGL ${mode} room ${level}: ${row.error||row.start?.title||''}`);
    }
  }
  report.pass=report.rows.every(r=>r.pass);report.capturePass=report.rows.every(r=>r.capturePass);save();
  if(!report.pass)process.exitCode=1;
} finally {save();await retireBrowser();server?.kill('SIGTERM');}
