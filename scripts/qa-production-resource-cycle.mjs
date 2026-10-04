import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import puppeteer from 'puppeteer-core';
import {captureBrowserFrame} from './qa-browser-capture.mjs';

// Run against a frozen ordinary production build, not Vite's mutable dev
// server. The explicit existing QA entry exposes the real renderer; Yandex's
// production entry correctly has no harness and is checked separately.
const source=path.resolve(process.env.SERVER_ROOT||'.');
const build=path.resolve(source,process.env.BUILD_DIR||'dist');
const out=path.resolve(process.env.OUT_DIR||'qa/production-resource-cycle');
fs.mkdirSync(out,{recursive:true});
const base=process.env.PAGE_URL||`http://127.0.0.1:${process.env.PORT||4185}/`;
const sequence=[1,12,21,28,30,35,40,41,1],cycles=10,warmFrames=3;
const expansion=process.env.EXPANSION_CHECK==='0'?[]:[42,43,44,45,46,47,48,49,50,51];
const memoryKeys=['geometries','textures'];
const tolerance=.10;
const report={pass:false,phase:'initializing',scope:'Compiled ordinary production JavaScript and native WebGL via explicit QA entry; level-start resource lifecycle and activated fracture route 47, not hardware FPS',
  directory:build,url:base,sequence,cycles,warmFrames,expandedStartupLevels:expansion,
  samples:[],expansionSamples:[],plateau:[],controls:{},errors:[],failedRequests:[],consoleErrors:[],
  limitations:[
    'renderer.info.memory reports object counts, not VRAM bytes, heap size or GPU performance.',
    'Three explicit manual display frames follow each production room initialization; the initializer may also compile and warm its own portal resources.',
    'Room starts and repeated disposal are exercised; room 47 also completes its real-input fracture route and tears down all 16 activated fragments. Every other dynamic puzzle state requires separate route tests.',
    'The non-Yandex production build exposes its existing opt-in QA harness; the exact Yandex release disables it and needs its separate SDK/UI checks.',
    'Software SwiftShader is reproducible native WebGL evidence, not physical-device certification.',
  ]};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
const phase=value=>{report.phase=value;save();};
async function bounded(promise,ms,label){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(`${label} timed out after ${ms} ms`)),ms);})]);}finally{clearTimeout(timer);}}
function compareCounts(reference,sample,label,{programs=true}={}){
  const keys=[...memoryKeys,...(programs?['programs']:[])],deltas={};
  for(const key of keys){const first=reference.counts[key],next=sample.counts[key],growth=first?next/first-1:next===0?0:Infinity;deltas[key]={baseline:first,observed:next,growth};
    assert.ok(growth<=tolerance+1e-12,`${label}: ${key} grew ${first}→${next} (${(growth*100).toFixed(2)}%), above 10%`);}
  return deltas;
}
let server,browser,page;const consoleReads=[];
try{
  assert.ok(fs.existsSync(path.join(build,'index.html')),'Build the frozen ordinary production dist before running resource cycles');
  const scripts=fs.readdirSync(path.join(build,'assets')).filter(name=>name.endsWith('.js')).sort();
  report.build={scripts:scripts.map(name=>({name,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(build,'assets',name))).digest('hex')})),
    info:fs.existsSync(path.join(build,'build-info.json'))?JSON.parse(fs.readFileSync(path.join(build,'build-info.json'))):null};
  if(process.env.START_SERVER!=='0'){
    const port=new URL(base).port;assert.ok(port&&['127.0.0.1','localhost'].includes(new URL(base).hostname),'Owned preview requires a loopback URL with a port');
    server=spawn(process.execPath,[path.join(source,'node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port',port,'--strictPort','--outDir',build],{cwd:source,stdio:['ignore','pipe','pipe']});
    let log='';server.stdout.on('data',chunk=>{log=(log+chunk).slice(-3000);});server.stderr.on('data',chunk=>{log=(log+chunk).slice(-3000);});
    let ready=false;for(let i=0;i<200;i++){
      if(server.exitCode!==null)throw Error('Owned preview exited: '+log);
      try{if((await fetch(base)).ok){ready=true;break;}}catch{}
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    assert.ok(ready,'Owned preview did not become ready');
  }
  browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',headless:true,protocolTimeout:180000,
    args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-zygote']});
  report.browser=await browser.version();page=await browser.newPage();page.setDefaultTimeout(180000);
  await page.setViewport({width:854,height:480,deviceScaleFactor:1});
  page.on('pageerror',error=>report.errors.push(String(error)));
  page.on('requestfailed',request=>{if(!request.url().endsWith('/favicon.ico'))report.failedRequests.push({url:request.url(),error:request.failure()?.errorText});});
  page.on('response',response=>{if(response.status()>=400&&!response.url().endsWith('/favicon.ico'))report.errors.push(`${response.status()} ${response.url()}`);});
  page.on('console',message=>{if(message.type()==='error'){
    const row={phase:report.phase,text:message.text(),arguments:[]};report.consoleErrors.push(row);
    // Puppeteer can represent Error objects as "JSHandle@error". Read their
    // actual messages so only the deliberate loss error can be exempted.
    consoleReads.push(Promise.all(message.args().map(argument=>argument.evaluate(value=>String(value?.message??value))
      .catch(error=>'Unreadable console argument: '+String(error)))).then(values=>{row.arguments=values;}));
  }});
  await page.evaluateOnNewDocument(()=>{
    const key='brainrot-foundation-v1:brainrot-portal.preferences.v24';
    if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({quality:'low',muted:true,resumeLevel:0}));
  });
  const url=new URL(base);url.search='?edition=foundation&debug=1';
  phase('ordinary-production-start');await page.goto(url.href,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='ready');
  assert.equal(await page.evaluate(()=>!!window.__NESI_DEMO_GAME__?.renderer),true,'Build has no existing QA harness; use the ordinary production build, not Yandex or modified source');
  await page.bringToFront();await page.$eval('#play-button',node=>node.scrollIntoView({block:'center'}));
  await page.waitForFunction(()=>{const b=document.querySelector('#play-button'),r=b.getBoundingClientRect();return !b.closest('.screen').inert&&b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));});
  await page.click('#play-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='playing');
  await page.evaluate(()=>window.__NESI_DEMO_GAME__.renderer.setAnimationLoop(null));
  async function warmRoom(level){
    return bounded(page.evaluate(async({level,warmFrames})=>{
      const g=window.__NESI_DEMO_GAME__;if(!g)throw Error('Production controller disappeared');
      if(g.levelIndex!==level-1)await g.selectLevel(level-1,false);
      g.renderer.setAnimationLoop(null);g.resetRun(true);
      for(let n=0;n<warmFrames;n++){g.updatePlaying(1/120);g.updatePlaying(1/120);g.updateVisuals(1/60,1);g.render();}
      const gl=g.renderer.getContext();if(gl.isContextLost())throw Error('Unexpected WebGL loss during room cycle');
      let nodes=0;g.scene.traverse(()=>nodes++);
      return {level:g.levelIndex+1,id:g.firstLevel.id,state:g.state,
        counts:{geometries:g.renderer.info.memory.geometries,textures:g.renderer.info.memory.textures,programs:g.renderer.info.programs?.length??0},
        cacheAssets:g.assets.size,sceneNodes:nodes,physicsBodies:g.physics.world.bodies.length,constraints:g.physics.world.constraints.length,
        colliders:g.colliders.length,portals:g.portalPanels.length,calls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles,
        rendered:gl.drawingBufferWidth>0&&gl.drawingBufferHeight>0&&g.renderer.info.render.calls>0,missingModels:g.diagnostics().missingModels};
    },{level,warmFrames}),180000,`Room ${level} initialization and three manual frames`);
  }
  const references=new Map();
  for(let cycle=1;cycle<=cycles;cycle++)for(let visit=0;visit<sequence.length;visit++){
    const level=sequence[visit];phase(`cycle-${cycle}-room-${level}-visit-${visit}`);
    const sample={cycle,visit,...await warmRoom(level)};assert.equal(sample.level,level);assert.equal(sample.rendered,true);assert.deepEqual(sample.missingModels,[]);
    report.samples.push(sample);
    // Cycle one uploads each chapter's shared source assets. Cycle two is
    // the postwarm baseline; repeated room 1 visits are still compared.
    if(cycle===2&&!references.has(level))references.set(level,sample);
    if(cycle>=2){const reference=references.get(level);report.plateau.push({cycle,visit,level,deltas:compareCounts(reference,sample,`cycle ${cycle} room ${level}`)});
      assert.equal(sample.physicsBodies,reference.physicsBodies,`room ${level} retained physics bodies`);assert.equal(sample.constraints,reference.constraints,`room ${level} retained constraints`);
      assert.equal(sample.sceneNodes,reference.sceneNodes,`room ${level} retained scene objects`);}
    save();console.log(JSON.stringify({cycle,level,counts:sample.counts,physicsBodies:sample.physicsBodies}));
  }
  for(let pass=1;pass<=2;pass++)for(const level of expansion){
    phase(`expansion-startup-pass-${pass}-room-${level}`);const sample={pass,...await warmRoom(level)};
    assert.equal(sample.rendered,true);assert.deepEqual(sample.missingModels,[]);report.expansionSamples.push(sample);
    if(pass===2){const first=report.expansionSamples.find(row=>row.pass===1&&row.level===level);compareCounts(first,sample,`expansion startup room ${level}`);
      assert.equal(sample.physicsBodies,first.physicsBodies);assert.equal(sample.constraints,first.constraints);assert.equal(sample.sceneNodes,first.sceneNodes);}
    save();
  }
  const returned=await warmRoom(1);report.returnAfterExpansion=returned;
  compareCounts(references.get(1),returned,'room 1 after expansion startup',{programs:false});
  phase('activated-fracture-route');report.controls.fracture={startup:await warmRoom(47)};
  const fracture=await bounded(page.evaluate(async()=>{
    const g=window.__NESI_DEMO_GAME__,cargoUUID=g.cargo.group.uuid,cargoBody=g.physics.cargoBody.id;
    const milestones=[];window.__NESI_CAPTURE_LEVEL_MARK__=mark=>milestones.push({name:mark.name,
      fragmentBodies:g.firstLevel.fuse.bodies.length,physicsBodies:g.physics.world.bodies.length,
      constraints:g.physics.world.constraints.length,counts:{...g.renderer.info.memory},calls:g.renderer.info.render.calls});
    try{
      const route=await window.__NESI_RUN_LEVEL_ROUTE__();g.renderer.setAnimationLoop(null);
      window.__RESOURCE_FRACTURE_WORLD__=g.physics.world;
      const fragmentIDs=g.firstLevel.fuse.bodies.map(body=>body.id);
      return {route,milestones,cargoUUIDBefore:cargoUUID,cargoUUIDAfter:g.cargo.group.uuid,
        cargoBodyBefore:cargoBody,cargoBodyAfter:g.physics.cargoBody.id,broken:g.firstLevel.fuse.broken,
        fragmentIDs,liveFragmentBodies:g.physics.world.bodies.filter(body=>fragmentIDs.includes(body.id)).length,
        state:g.state,counts:{...g.renderer.info.memory}};
    }finally{delete window.__NESI_CAPTURE_LEVEL_MARK__;}
  }),180000,'Ordinary input route 47 and actual fracture activation');
  report.controls.fracture.activation=fracture;
  assert.equal(fracture.route.pass,true);assert.equal(fracture.state,'won');assert.equal(fracture.broken,true);
  assert.equal(fracture.route.resets,0);assert.equal(fracture.route.respawns,0);
  assert.equal(fracture.cargoUUIDAfter,fracture.cargoUUIDBefore);assert.equal(fracture.cargoBodyAfter,fracture.cargoBodyBefore);
  assert.equal(fracture.fragmentIDs.length,16);assert.equal(fracture.liveFragmentBodies,16);
  assert.ok(fracture.milestones.some(row=>row.fragmentBodies===16&&row.calls>0),'No native production milestone rendered the activated fracture');save();
  if(process.env.CAPTURE_DEBRIS==='1'){
    phase('activated-fracture-final-native-capture');report.controls.fracture.finalCapture=await captureBrowserFrame(page,path.join(out,'47-activated-final.jpg'));
    assert.equal(report.controls.fracture.finalCapture.ok,true,'Activated route final native readback failed');save();
  }
  // The actual win-screen button restores the ordinary playing UI and tears
  // down the fracture room. Direct controller selection alone would leave the
  // win overlay in front of the pause/restart controls tested below.
  phase('ordinary-post-fracture-transition');await page.click('#play-again-button');
  await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='playing'&&window.__NESI_DEMO_GAME__.levelIndex===47);
  report.controls.fracture.ordinaryNextLevel=await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop(null);return g.levelIndex+1;});
  assert.equal(report.controls.fracture.ordinaryNextLevel,48);save();
  phase('activated-fracture-disposal');report.controls.fracture.returned=await warmRoom(1);
  compareCounts(references.get(1),report.controls.fracture.returned,'room 1 after activated fracture disposal',{programs:false});
  report.controls.fracture.retiredWorld=await page.evaluate(()=>{const world=window.__RESOURCE_FRACTURE_WORLD__;
    const result={bodies:world.bodies.length,constraints:world.constraints.length};delete window.__RESOURCE_FRACTURE_WORLD__;return result;});
  assert.equal(report.controls.fracture.retiredWorld.bodies,0,'Fracture bodies remained in the disposed production physics world');
  assert.equal(report.controls.fracture.retiredWorld.constraints,0);
  report.controls.fracture.rebuiltStartup=await warmRoom(47);
  compareCounts(report.controls.fracture.startup,report.controls.fracture.rebuiltStartup,'room 47 startup after activated fracture');
  assert.equal(report.controls.fracture.rebuiltStartup.physicsBodies,report.controls.fracture.startup.physicsBodies);
  assert.equal(report.controls.fracture.rebuiltStartup.constraints,report.controls.fracture.startup.constraints);
  assert.equal(report.controls.fracture.rebuiltStartup.sceneNodes,report.controls.fracture.startup.sceneNodes);
  await warmRoom(1);save();
  phase('quality-switches');report.controls.quality=[];
  for(const quality of ['low','balanced','high','low']){
    await page.select('#quality-select',quality);
    const sample=await page.evaluate(({quality,warmFrames})=>{const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop(null);for(let n=0;n<warmFrames;n++)g.render();
      return {quality,profile:{...g.quality},shadows:g.renderer.shadowMap.enabled,counts:{...g.renderer.info.memory},contextLost:g.renderer.getContext().isContextLost(),calls:g.renderer.info.render.calls};},{quality,warmFrames});
    assert.equal(sample.contextLost,false);assert.ok(sample.calls>0);assert.equal(sample.shadows,quality!=='low');report.controls.quality.push(sample);save();
  }
  phase('pause-freeze');await page.click('#pause-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.state==='paused');
  report.controls.pause=await page.evaluate(()=>{
    const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop(null);
    const pose=()=>({elapsed:g.elapsed,visualTime:g.visualTime,player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),quaternion:g.cargo.quaternion.toArray(),
      worldTime:g.physics.world.time,bodies:g.physics.world.bodies.map(b=>[b.id,...[b.position.x,b.position.y,b.position.z,b.quaternion.x,b.quaternion.y,b.quaternion.z,b.quaternion.w,b.velocity.x,b.velocity.y,b.velocity.z]])});
    const before=pose(),now=performance.now();g.lastFrame=now;
    for(let n=1;n<=3;n++)g.animate(now+n*100);
    return {state:g.state,before,after:pose(),manualPausedFrames:3};
  });
  assert.equal(report.controls.pause.state,'paused');assert.deepEqual(report.controls.pause.after,report.controls.pause.before,'Paused manual display frames advanced actors, physics or permitted visual time');save();
  phase('ordinary-restart');const original=await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;return {level:g.levelIndex,cargoUUID:g.cargo.group.uuid,cargoBody:g.physics.cargoBody.id};});
  await page.click('#restart-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.state==='playing');
  report.controls.restart=await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop(null);return {level:g.levelIndex,cargoUUID:g.cargo.group.uuid,cargoBody:g.physics.cargoBody.id,teleports:g.teleportCount,held:!!g.heldCube,elapsed:g.elapsed};});
  assert.equal(report.controls.restart.level,original.level);assert.equal(report.controls.restart.cargoUUID,original.cargoUUID);assert.equal(report.controls.restart.cargoBody,original.cargoBody);
  assert.equal(report.controls.restart.teleports,0);assert.equal(report.controls.restart.held,false);assert.ok(report.controls.restart.elapsed<2000);save();
  // Use the ordinary paused level control to persist a NONDEFAULT room. The
  // reload proof would be meaningless if it only returned to default room 1.
  phase('context-recovery-room-selection');await page.click('#pause-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.state==='paused');
  await page.select('#settings-level-select','11');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.levelIndex===11&&window.__NESI_DEMO_GAME__.state==='playing');
  await page.evaluate(()=>window.__NESI_DEMO_GAME__.renderer.setAnimationLoop(null));
  report.controls.context={};phase('native-context-loss');
  report.controls.context.supported=await page.evaluate(()=>{
    const g=window.__NESI_DEMO_GAME__,canvas=g.renderer.domElement,gl=g.renderer.getContext(),extension=gl.getExtension('WEBGL_lose_context');
    window.__RESOURCE_CONTEXT_EVENTS__=[];canvas.addEventListener('webglcontextlost',event=>window.__RESOURCE_CONTEXT_EVENTS__.push({type:event.type,prevented:event.defaultPrevented}));
    canvas.addEventListener('webglcontextrestored',event=>window.__RESOURCE_CONTEXT_EVENTS__.push({type:event.type}));
    if(extension){window.__RESOURCE_CONTEXT_EXTENSION__=extension;extension.loseContext();}return !!extension;
  });
  if(report.controls.context.supported){
    await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='error');
    report.controls.context.loss=await page.evaluate(()=>({events:window.__RESOURCE_CONTEXT_EVENTS__,state:window.__NESI_DEMO_GAME__.state,error:document.querySelector('#error-detail').textContent,
      retryAccessible:!document.querySelector('#error-screen').inert,contextLost:window.__NESI_DEMO_GAME__.renderer.getContext().isContextLost()}));
    assert.equal(report.controls.context.loss.contextLost,true);assert.equal(report.controls.context.loss.retryAccessible,true);assert.match(report.controls.context.loss.error,/3D/);
    phase('native-context-restore');await page.evaluate(()=>window.__RESOURCE_CONTEXT_EXTENSION__.restoreContext());
    await page.waitForFunction(()=>window.__RESOURCE_CONTEXT_EVENTS__.some(event=>event.type==='webglcontextrestored'),{timeout:30000});
    report.controls.context.nativeRestored=await page.evaluate(()=>({events:window.__RESOURCE_CONTEXT_EVENTS__,contextLost:window.__NESI_DEMO_GAME__.renderer.getContext().isContextLost(),applicationState:window.__NESI_DEMO_GAME__.state}));
    assert.equal(report.controls.context.nativeRestored.contextLost,false);
    report.controls.context.inPlaceApplicationRecovery=report.controls.context.nativeRestored.applicationState!=='error';
    phase('ordinary-context-recovery-reload');await page.click('#reload-button');
    await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='ready'&&window.__NESI_DEMO_GAME__?.levelIndex===11);
    report.controls.context.reload=await page.evaluate(()=>({selectedLevel:document.querySelector('#level-select').value,state:window.__NESI_DEMO_GAME__.state,
      contextLost:window.__NESI_DEMO_GAME__.renderer.getContext().isContextLost(),errorScreenInert:document.querySelector('#error-screen').inert}));
    assert.equal(report.controls.context.reload.selectedLevel,'11');assert.equal(report.controls.context.reload.contextLost,false);assert.equal(report.controls.context.reload.errorScreenInert,true);
    await page.click('#play-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.state==='playing');
    await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop(null);g.render();});
    report.controls.context.final=await page.evaluate(()=>({level:window.__NESI_DEMO_GAME__.levelIndex+1,state:window.__NESI_DEMO_GAME__.state,calls:window.__NESI_DEMO_GAME__.renderer.info.render.calls,contextLost:window.__NESI_DEMO_GAME__.renderer.getContext().isContextLost()}));
    assert.equal(report.controls.context.final.level,12);assert.equal(report.controls.context.final.contextLost,false);assert.ok(report.controls.context.final.calls>0);
  }else report.limitations.push('WEBGL_lose_context unavailable: context loss/restore/reload could not be verified in this browser.');
  await bounded(Promise.all(consoleReads),5000,'Production console Error readback');
  report.expectedContextErrors=report.consoleErrors.filter(row=>row.phase==='native-context-loss'&&[row.text,...row.arguments].some(value=>value.includes('Браузер остановил 3D-графику')));
  report.unexpectedConsoleErrors=report.consoleErrors.filter(row=>!report.expectedContextErrors.includes(row));
  assert.deepEqual(report.errors,[],'Unexpected page/runtime or resource errors');assert.deepEqual(report.failedRequests,[],'A production resource request failed');
  assert.deepEqual(report.unexpectedConsoleErrors,[],'Unexpected production console errors');
  report.coverage={coreVisits:report.samples.length,completedCycles:cycles,postWarmBaselineCycle:2,comparedCoreLevels:[...references.keys()],extraStartupVisits:report.expansionSamples.length,
    activatedFracture:{room:47,routeFrames:fracture.route.frames,independentBodies:16,disposedWorldBodies:report.controls.fracture.retiredWorld.bodies},qualitySwitches:4,pausedFrames:3};
  report.pass=true;phase('complete');console.log(JSON.stringify({pass:true,coverage:report.coverage,context:report.controls.context.final??null}));
}catch(error){report.failure=error.stack||String(error);phase('failed');if(page)report.lastState=await bounded(page.evaluate(()=>({url:location.href,runtime:document.documentElement.dataset.runtimeState,error:document.querySelector('#error-detail')?.textContent,
  level:window.__NESI_DEMO_GAME__?.levelIndex,state:window.__NESI_DEMO_GAME__?.state})),3000,'failure-state readback').catch(()=>null);throw error;
}finally{
  save();if(browser)await bounded(browser.close(),5000,'Owned browser shutdown').catch(()=>{const process=browser.process();if(process?.exitCode===null)process.kill('SIGKILL');});server?.kill();
}
