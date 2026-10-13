import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import puppeteer, {TimeoutError} from 'puppeteer-core';
import {captureBrowserFrame} from './qa-browser-capture.mjs';
import {launchBrowserWithStartupRetry} from './lib/browser-startup.mjs';
import {readStampedCampaignInfo,assertCampaignBrowserState} from './lib/campaign-browser-contract.mjs';
import {ACTIVE_FOUNDATION_RUNTIME_FLAGS} from '../src/game/ReleaseIdentity.js';
import {foundationCampaignPrefix,CAMPAIGN_PREFERENCE_KEY} from '../src/game/LabCampaignStorage.js';
import {assertFoundation20Route} from './lib/foundation20-native-proof.mjs';

const out = path.resolve(process.env.OUT_DIR || 'qa/creative-browser');
fs.mkdirSync(out, {recursive: true});
const levels = (process.env.LEVELS || Array.from({length:51}, (_,i)=>i+1).join(','))
  .split(',').map(Number);
assert.ok(levels.every(n=>Number.isInteger(n)&&n>=1&&n<=51));
const mode = process.env.CASE || 'overview';
const strictCapture=process.env.STRICT_CAPTURE==='1';
assert.ok(['overview','route','rush'].includes(mode));
const inspectionQuality=mode==='overview'?(process.env.INSPECTION_QUALITY||'balanced'):'low';
assert.ok(['low','balanced','high'].includes(inspectionQuality),'Invalid INSPECTION_QUALITY');

// Serialized into the actual frozen runtime by Puppeteer. Only the camera is
// changed: roofs, walls, actors, mechanisms and their visibility stay intact.
function frameInteriorOverview(g) {
  const level=g.firstLevel,kit=level.workshop,world=level.world||kit?.world;
  const vector=(x=0,y=0,z=0)=>g.playerPosition.clone().set(x,y,z);
  const floors=g.floors.filter(f=>f.enabled!==false&&Number.isFinite(f.y));
  const largestFloor=floors.reduce((a,b)=>(b.maxX-b.minX)*(b.maxZ-b.minZ)>(a.maxX-a.minX)*(a.maxZ-a.minZ)?b:a);
  const bounds=kit?.roomEnvelope||kit?.bounds||level.bounds||largestFloor;
  const width=bounds.maxX-bounds.minX,depth=bounds.maxZ-bounds.minZ;
  const roofSurfaces=(world?.surfaces||[]).filter(s=>s.normal.y<-.99&&s.width>=width*.9&&s.height>=depth*.9);
  const roofSlabs=g.colliders.filter(c=>c.enabled!==false&&c.box.max.x-c.box.min.x>=width*.95&&c.box.max.z-c.box.min.z>=depth*.95&&c.box.max.y-c.box.min.y<3&&c.box.min.y>largestFloor.y+3);
  const roof=Math.min(kit?.roomEnvelope?.roof??Infinity,kit?.ceiling??Infinity,
    ...roofSurfaces.map(s=>s.collider.box.min.y),...roofSlabs.map(c=>c.box.min.y));
  const base=kit?.roomEnvelope?.base??largestFloor.y;
  if(!Number.isFinite(roof)||roof-base<4)throw Error('No genuine room roof/headroom for interior inspection');
  const solids=g.colliders.filter(c=>c.enabled!==false&&!c.mesh.material?.transparent);
  const ray=g.raycaster.ray.clone(),hit=vector();
  const clear=(eye,point)=>{
    const delta=point.clone().sub(eye),distance=delta.length();ray.set(eye,delta.normalize());
    return !solids.some(c=>ray.intersectBox(c.box,hit)&&eye.distanceTo(hit)<distance-.12);
  };
  const targets=[],keys=new Set();
  const add=(point,kind)=>{
    if(point.x<bounds.minX+1||point.x>bounds.maxX-1||point.z<bounds.minZ+1||point.z>bounds.maxZ-1||point.y<base||point.y>roof-1)return;
    const key=kind+'/'+point.toArray().map(n=>Math.round(n/2)).join('/');
    if(!keys.has(key)){keys.add(key);targets.push({point,kind});}
  };
  for(const f of floors)if(f.y>=base-.1&&(f.maxX-f.minX)*(f.maxZ-f.minZ)>=12){
    // Continuous recovery floors also run under closed partitions. A grid
    // finds their genuinely visible aisles instead of assuming four corners
    // and a centre are exposed. Raised decks keep five bounded samples each.
    const samples=f===largestFloor?[.15,.325,.5,.675,.85].flatMap(u=>[.15,.325,.5,.675,.85].map(v=>[u,v])):[[.5,.5],[.2,.2],[.8,.2],[.2,.8],[.8,.8]];
    for(const [u,v]of samples)add(vector(f.minX+(f.maxX-f.minX)*u,f.y+.16,f.minZ+(f.maxZ-f.minZ)*v),'floor');
  }
  for(const panel of g.portalPanels){
    const f=panel.userData.portalFrame?.()||{center:panel.userData.center,normal:panel.userData.normal};
    if(f.center&&f.normal)add(f.center.clone().addScaledVector(f.normal,.16),'portal');
  }
  if(targets.length<4)throw Error('Insufficient genuine playable inspection targets');
  const focus=targets.reduce((sum,t)=>sum.add(t.point),vector()).multiplyScalar(1/targets.length);
  const eyes=[];
  // The castle has opaque roofs on individual wings too. Inspect its occupied
  // atrium between storeys rather than photographing those wing roofs from 98m.
  if(level.tower){
    const galleries=floors.filter(f=>f.minX>=-10&&f.maxX<=18&&f.y>=0&&f.maxZ-f.minZ>30);
    const heights=[...new Set(galleries.map(f=>f.y+8))];
    for(const y of heights)for(const x of [5,9])for(const z of [-45,25])eyes.push(vector(x,y,z));
  }else for(const y of [roof-2.5,base+(roof-base)*.65,base+(roof-base)*.4]){
    for(const [u,v]of [[.12,.12],[.88,.12],[.12,.88],[.88,.88],[.5,.12],[.5,.88],[.12,.5],[.88,.5]])eyes.push(vector(bounds.minX+width*u,y,bounds.minZ+depth*v));
  }
  g.scene.updateMatrixWorld(true);g.camera.fov=78;g.camera.far=Math.max(500,Math.max(width,depth)*4);g.camera.updateProjectionMatrix();
  const candidates=[];
  for(const eye of eyes){
    if(eye.y>=roof-1||solids.some(c=>c.box.clone().expandByScalar(.3).containsPoint(eye)))continue;
    const visible=targets.filter(t=>clear(eye,t.point));
    if(visible.length<4)continue;
    const localFocus=visible.reduce((sum,t)=>sum.add(t.point),vector()).multiplyScalar(1/visible.length);
    for(const aim of [focus,localFocus]){
      g.camera.position.copy(eye);g.camera.lookAt(aim);g.camera.updateMatrixWorld(true);
      const framed=visible.filter(t=>{const p=t.point.clone().project(g.camera);return Math.abs(p.x)<.9&&Math.abs(p.y)<.82&&p.z>-1&&p.z<1;});
      const score=framed.reduce((sum,t)=>sum+(t.kind==='portal'?4:1),0);
      candidates.push({eye:eye.clone(),aim:aim.clone(),framed,score});
    }
  }
  candidates.sort((a,b)=>b.score-a.score);
  // Collider rays choose candidates cheaply; actual rendered geometry then
  // checks the finalists, including non-colliding cladding and instanced art.
  const meshes=[];g.scene.traverseVisible(o=>{if(o.isMesh&&!o.userData.collisionProxy)meshes.push(o);});
  const cast=g.raycaster.clone?.()||new g.raycaster.constructor();
  const renderedClear=(eye,t)=>{
    const delta=t.point.clone().sub(eye);cast.set(eye,delta.clone().normalize());cast.far=delta.length()-.12;
    return !cast.intersectObjects(meshes,false).some(h=>{
      const material=Array.isArray(h.object.material)?h.object.material[h.face?.materialIndex??0]:h.object.material;
      return material?.visible!==false&&!(material?.transparent&&material.opacity<.95);
    });
  };
  let chosen;
  for(const candidate of candidates.slice(0,8)){
    const observed=candidate.framed.filter(t=>renderedClear(candidate.eye,t));
    const floorCount=observed.filter(t=>t.kind==='floor').length,portalCount=observed.filter(t=>t.kind==='portal').length;
    const score=floorCount+portalCount*4;
    if(floorCount>=3&&(!chosen||score>chosen.score))chosen={...candidate,observed,floorCount,portalCount,score};
  }
  if(!chosen)throw Error('No unobstructed interior overview of at least three genuine playable floor points');
  g.camera.position.copy(chosen.eye);g.camera.lookAt(chosen.aim);g.camera.updateWorldMatrix(true,false);
  return {kind:'interior-camera-inspection',bounds:{minX:bounds.minX,maxX:bounds.maxX,minZ:bounds.minZ,maxZ:bounds.maxZ,base,roof},
    eye:chosen.eye.toArray(),target:chosen.aim.toArray(),roofClearance:roof-chosen.eye.y,fov:g.camera.fov,
    candidates:candidates.length,visibleFloorPoints:chosen.floorCount,visiblePortalPoints:chosen.portalCount,
    observedTargets:chosen.observed.map(t=>({kind:t.kind,point:t.point.toArray()})),geometryVisibilityChanged:false};
}
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
const report = {mode,strictCapture,inspectionQuality,sourceCommit:process.env.BUILD_COMMIT??null, rows:[], errors:[], limitations:[
  'Scripted production inputs and software WebGL are reproducible checks, not a human playtest or hardware FPS measurement.',
  'Overview camera placement is inspection only; it never counts as a solved route.',
  'An interior overview shows an unobstructed view sector, not every surface behind opaque partitions; pixel captures still require visual review.',
  'A bounded rush attack cannot prove that every possible shortcut is absent.',
  'Route pass records gameplay assertions. Capture pass is reported separately; missing or blank readback never counts as visual evidence.',
]};
const save = ()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
const reuse = process.env.REUSE_PAGE!=='0';
let sharedPage, activeRouteRow, activeRouteToken;
try {
  report.package=await readStampedCampaignInfo(process.env.PAGE_URL||'http://127.0.0.1:4173/');save();
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
    const preferenceKey=foundationCampaignPrefix(new URL(process.env.PAGE_URL||'http://127.0.0.1:4173/').pathname)+CAMPAIGN_PREFERENCE_KEY;
    await page.evaluateOnNewDocument(({key,quality})=>localStorage.setItem(key,JSON.stringify({quality,muted:true})),{key:preferenceKey,quality:inspectionQuality});
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
      await page.select('#quality-select',inspectionQuality);
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
      row.start = await page.evaluate(flagNames=>{
        const g=window.__NESI_DEMO_GAME__,d=g.diagnostics();
        return {id:g.firstLevel.id,title:g.firstLevel.title,position:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),
          levelIndex:g.levelIndex,edition:g.chamberEdition,flags:Object.fromEntries(flagNames.map(key=>[key,g[key]])),
          hudNumber:Number(document.querySelector('#level-number').textContent),
          optionNumber:Number(document.querySelector(`#level-select option[value="${g.levelIndex}"]`).textContent.match(/^\d+/)?.[0]),
          physicalRoom23:Boolean(g.firstLevel.room23PhysicalPrototype),pilot43:Boolean(g.firstLevel.pilot43),progressionLevel:g.firstLevel.puzzleProgression??null,
          floors:g.floors.length,colliders:g.colliders.length,panels:g.portalPanels.length,
          meshes:d.modelsLoaded,missingModels:d.missingModels,cargoUUID:g.cargo.group.uuid,cargoBodyId:g.physics.cargoBody.id,
          calls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles,
          cameraPosition:g.camera.position.toArray(),cameraFocus:g.cameraRig.focus.toArray(),
          cameraPlayerPivot:g.cameraRig.playerPivot.toArray(),
          cameraDistance:g.camera.position.distanceTo(g.cameraRig.playerPivot),
          cameraFocusDistance:g.camera.position.distanceTo(g.cameraRig.focus),
          cameraObstructed:Boolean(g.cameraRig.obstructed),cameraFov:g.camera.fov,
          quality:document.querySelector('#quality-select').value,shadows:Boolean(g.renderer.shadowMap.enabled)};
      },Object.keys(ACTIVE_FOUNDATION_RUNTIME_FLAGS));
      row.visibleRoom=assertCampaignBrowserState(row.start,level);
      report.active={level,phase:'ready',start:row.start};save();
      console.log(`START WebGL ${mode} room ${level}: ready, cargo ${row.start.cargoUUID}/${row.start.cargoBodyId}`);
      row.captures={};
      assert.deepEqual(row.start.missingModels,[]);
      assert.equal(row.start.quality,inspectionQuality);
      assert.equal(row.start.shadows,inspectionQuality!=='low');
      if(mode==='overview') {
        row.captures.start=await captureBrowserFrame(page,path.join(out,`${level}-start.jpg`));
        row.framing=await page.evaluate(frameInteriorOverview.toString()+`;frameInteriorOverview(window.__NESI_DEMO_GAME__)`);
        await page.evaluate(()=>window.__NESI_DEMO_GAME__.render());
        row.captures.overview=await captureBrowserFrame(page,path.join(out,`${level}-overview.jpg`));
      } else if(mode==='route') {
        report.active.phase='ordinary-route';activeRouteRow=row;row.routeStarted=performance.now();activeRouteToken=`${level}-${row.routeStarted}`;save();
        row.route = await bounded(page.evaluate(async({routeToken,physical20})=>{
          const g=window.__NESI_DEMO_GAME__,cargo=g.cargo,body=g.physics.cargoBody,bodyId=body.id,shapes=[...body.shapes];
          const milestoneWrites=[];
          // Readback is deliberately deferred until the canonical route's proof
          // is persisted. Its returned milestones still retain real positions.
          const recordMark=mark=>{
            const write=window.__NESI_REPORT_ROUTE_MARK__({routeToken,mark:{...mark,
              observedState:{state:g.state,player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),
                solvedIds:g.firstLevel.getTowerMetrics?.().solvedIds??[]}}});
            milestoneWrites.push(write);return write;
          };
          window.__NESI_CAPTURE_LEVEL_MARK__=recordMark;
          if(physical20)window.__NESI_CAPTURE_FOUNDATION20_MARK__=recordMark;
          try{
            if(physical20&&typeof window.__NESI_RUN_FOUNDATION20_PHYSICAL_ROUTE__!=='function')throw Error('The frozen root package lacks the actual Foundation20 physical route hook');
            const result=physical20?await window.__NESI_RUN_FOUNDATION20_PHYSICAL_ROUTE__():await window.__NESI_RUN_LEVEL_ROUTE__();
            // The game hook is synchronous. Drain binding acknowledgements
            // before the Node runner retires this row or begins the next one.
            await Promise.all(milestoneWrites);
            return {pass:result.pass,kind:result.kind??'ordinary-v8-route',state:g.state,frames:result.frames,teleports:g.teleportCount,
              resets:result.resets??result.cargoResets,respawns:result.respawns,
              cargoResets:result.cargoResets??null,
              sameCompanion:g.cargo===cargo&&g.physics.cargoBody===body&&g.physics.cargoBody.id===bodyId,
              sameCargoShape:g.physics.cargoBody.shapes.length===shapes.length&&shapes.every((shape,index)=>g.physics.cargoBody.shapes[index]===shape),
              foundation20Proof:physical20?result:null,
              cargoUUID:g.cargo.group.uuid,cargoBodyId:g.physics.cargoBody.id,milestones:result.milestones??result.events};
          }finally{
            delete window.__NESI_CAPTURE_LEVEL_MARK__;
            if(physical20)delete window.__NESI_CAPTURE_FOUNDATION20_MARK__;
            // Keep already emitted failure progress too, without replacing the
            // route's original exception with a secondary persistence error.
            await Promise.allSettled(milestoneWrites);
          }
        },{routeToken:activeRouteToken,physical20:level===20}),Number(process.env.ROUTE_TIMEOUT_MS||(level===41?1200000:180000)),'Ordinary production route');
        assert.equal(row.route.pass,true);assert.equal(row.route.state,'won');
        assert.equal(row.route.sameCompanion,true);assert.equal(row.route.cargoUUID,row.start.cargoUUID);assert.equal(row.route.cargoBodyId,row.start.cargoBodyId);
        assert.equal(row.route.sameCargoShape,true);
        assert.equal(row.route.resets??0,0);assert.equal(row.route.respawns??0,0);
        if(level===20){assertFoundation20Route(row.route.foundation20Proof);assert.equal(row.route.cargoResets,0);}
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
      if(mode!=='route'||strictCapture)assert.ok(row.capturePass,'A requested capture did not provide nonblank actual pixels');
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
