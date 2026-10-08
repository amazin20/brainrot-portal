import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL,fileURLToPath} from 'node:url';
import puppeteer from 'puppeteer-core';
import {PIN,ORDER,LIMITS,angle,infrastructureRoute,assertMemoryPhase} from './lib/castle41-native-plan.mjs';
import {verifyFrozenL} from './verify-l-castle41-package.mjs';

const sourceRoot=path.resolve(process.env.FROZEN_SOURCE||'frozen-source');
const packageRoot=path.resolve(process.env.FROZEN_PACKAGE||'qa/frozen-l/package');
const out=path.resolve(process.env.OUT_DIR||'qa/castle41-native');fs.mkdirSync(out,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex');
const identity=await verifyFrozenL({sourceRoot,packageRoot,archive:path.resolve(process.env.FROZEN_ARCHIVE||'qa/frozen-l/campaign-browser.zip'),
 downloadProof:process.env.DOWNLOAD_PROOF?path.resolve(process.env.DOWNLOAD_PROOF):null});
const researchRoot=fileURLToPath(new URL('../',import.meta.url)),git=(...a)=>execFileSync('git',a,{cwd:researchRoot,encoding:'utf8'}).trim();
const {buildSourceInputs}=await import(pathToFileURL(path.join(sourceRoot,'scripts/lib/release-manifest.mjs')).href);
assert.equal(hash(JSON.stringify(buildSourceInputs(researchRoot))),PIN.sourceInputsSha256,'Checker branch altered production inputs');
const checkerFiles=['.github/workflows/castle41-native-capture.yml','scripts/lib/castle41-native-plan.mjs','scripts/fetch-l-castle41-package.py','scripts/verify-l-castle41-package.mjs','scripts/qa-castle41-native.mjs','tests/castle41-native-plan.test.js'];
git('ls-files','--error-unmatch',...checkerFiles);git('diff','--quiet','HEAD','--',...checkerFiles);
const checkerIdentity={commit:git('rev-parse','HEAD'),tree:git('rev-parse','HEAD^{tree}'),base:PIN.commit,
 files:Object.fromEntries(checkerFiles.map(f=>[f,hash(fs.readFileSync(path.join(researchRoot,f)))]))};
const {captureBrowserFrame}=await import(pathToFileURL(path.join(sourceRoot,'scripts/qa-browser-capture.mjs')).href);
const report={schema:1,status:'running',identity,checkerIdentity,limits:LIMITS,captures:[],observations:[],route:null,errors:[],
 batchProfile:{calls:0,visualFrames:0,wallMs:0,largestBatch:0,renderPolicy:'No detour batch render; unchanged frozen helper renders the current observer once immediately before each native readback. Wall time includes CDP and simulation; it is not GPU or hardware FPS.'},
 method:'One original attempt. Existing frozen production canonical driver is parked only at awaited between-stage flushes. Observation detours use trusted keyboard and locked mouse input through unchanged controls.',
 limitations:['Software WebGL images are not hardware FPS or a human playtest.','18 finite stills are not a continuous video. Projection/framing metadata does not prove pixel visibility or absence of occlusion.',
  'Canonical production driver temporarily adapts getMove and its own camera intent as in L; only observation views use trusted native mouse. Detour ticks are counted separately and included in independent total counts.',
  'No restart acceptance, portrait acceptance, portal-view archive acceptance, 500-stage acceptance or complete master-TZ acceptance is claimed.']};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');save();
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',headless:true,protocolTimeout:LIMITS.wallMs,
 args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
let page,mouse={x:480,y:270},pressed=new Set(),captures=0,stageBusy=false;
const deadline=Date.now()+LIMITS.wallMs;
const bounded=()=>assert.ok(Date.now()<deadline,'Standalone capture wall limit reached');
async function read(details=false){return page.evaluate(details=>{
 const g=window.__NESI_DEMO_GAME__,q=window.__ARCHIVE_REVIEW__,l=g.firstLevel;g.scene.updateMatrixWorld(true);
 const v=x=>x?.toArray?.()??[x.x,x.y,x.z],batches=[];
 if(details)l.structure.traverse(x=>{if(x.isInstancedMesh&&x.visible)batches.push(x);});
 const mesh=object=>{
  const c=object.userData.collider,s=g.physics.solids.get(object.uuid);
  const representations=[];
  if(!object.visible)for(const batch of batches){if(batch.geometry!==object.geometry||batch.material!==object.material)continue;
   const matrix=object.matrixWorld.clone();for(let i=0;i<batch.count;i++){batch.getMatrixAt(i,matrix);
    const world=batch.matrixWorld.clone().multiply(matrix),error=Math.max(...world.elements.map((v,j)=>Math.abs(v-object.matrixWorld.elements[j])));
    if(error<1e-5)representations.push({batchUUID:batch.uuid,batchName:batch.name,instance:i,worldMatrix:world.toArray(),maxMatrixError:error});}}
  return {name:object.name,uuid:object.uuid,visible:object.visible,parentAttached:!!object.parent,position:v(object.position),quaternion:v(object.quaternion),scale:v(object.scale),world:object.matrixWorld.toArray(),
   geometryUUID:object.geometry?.uuid,material:object.material?{uuid:object.material.uuid,type:object.material.type,color:object.material.color?.getHex(),emissive:object.material.emissive?.getHex()}:null,
   staticBatchRepresentations:representations,
   instances:object.instanceMatrix?Array.from(object.instanceMatrix.array):null,
   collider:c?{enabled:c.enabled!==false,kinematic:c.kinematic,min:v(c.box.min),max:v(c.box.max)}:null,
   body:s?{id:s.body.id,type:s.body.type,position:v(s.body.position),velocity:v(s.body.velocity),target:v(s.target),remaining:s.remaining,inWorld:s.inWorld}:null};};
 const parts=[];if(details)l.structure.traverse(x=>{if(x.name?.startsWith('Archive physical memory /'))parts.push(mesh(x));});
 const leaves=details?q.leaves.map(c=>mesh(c.mesh)):[],low=Math.min(...q.leaves.map(c=>c.box.max.z)),high=Math.max(...q.leaves.map(c=>c.box.min.z));
 const water=l.machines.get('sluice').state,light=l.machines.get('optics').state;
 return {phase:q.phase,state:g.state,level:g.levelIndex,elapsed:g.elapsed,visualTime:g.visualTime,animationFrames:g.animationFrames,levelSeconds:l.getTowerMetrics().seconds,
  counters:{...q.counters},resets:q.counters.resets,respawns:q.counters.respawns,cargoResets:q.counters.cargoResets,
  sameCargoObject:g.cargo===q.cargo,sameBodyObject:g.physics.cargoBody===q.body,samePhysicsObject:g.physics===q.physics,samePlayerPositionObject:g.playerPosition===q.player,
  cargoUUID:g.cargo.group.uuid,bodyId:g.physics.cargoBody.id,player:v(g.playerPosition),playerVelocity:v(g.playerVelocity),grounded:g.playerGrounded,
  cargo:v(g.cargo.position),cargoQuaternion:v(g.physics.cargoBody.quaternion),cargoBodyPosition:v(g.physics.cargoBody.position),cargoBodyVelocity:v(g.physics.cargoBody.velocity),
  cargoBodyAngularVelocity:v(g.physics.cargoBody.angularVelocity),cargoBodyForce:v(g.physics.cargoBody.force),
  held:!!g.heldCube,teleports:g.teleportCount,keys:[...g.input.keys],moveAdapter:q.detour?'original production getMove':'canonical production driver or original getMove',
  locked:document.pointerLockElement===g.renderer.domElement,yaw:g.yaw,pitch:g.pitch,
  camera:{position:v(g.camera.position),quaternion:v(g.camera.quaternion),fov:g.camera.fov,aspect:g.camera.aspect},
  canvas:{width:g.renderer.domElement.width,height:g.renderer.domElement.height},
  water:{volumes:[...water.volumes],flowing:water.flowing,height:water.height},light:{turned:light.turned,beamPowered:light.beamPowered,lit:light.lit},
  memory:l.archiveMemory.diagnostics(),doorGap:Math.max(0,high-low),parts,leaves,solved:l.getTowerMetrics().solvedIds,
  events:l.getTowerMetrics().events.map(e=>({id:e.id,seconds:e.seconds})),renderDiagnostics:{calls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles,submissions:q.renderSubmissions}};
},details);}
function stableSnapshot(s){const {renderDiagnostics,...rest}=s;return rest;}
async function step(n=1){bounded();const started=performance.now();await page.evaluate(n=>{
 const g=window.__NESI_DEMO_GAME__,q=window.__ARCHIVE_REVIEW__;
 if(!q.detour||g.input.getMove!==q.originalMove)throw Error('Detour must use original production input');
 if(document.pointerLockElement!==g.renderer.domElement)throw Error('Lost native pointer lock');
 for(let i=0;i<n;i++){if(g.state!=='playing'||g.externalBlocked)throw Error('Ordinary attempt inactive');
  for(let s=0;s<2;s++)g.updatePlaying(1/120);g.updateVisuals(1/60,1);}
 // Every physics/visual/camera tick is retained. The unchanged frozen helper
 // renders this current observer once immediately before the still readback.
},n);report.batchProfile.calls++;report.batchProfile.visualFrames+=n;
 report.batchProfile.wallMs+=performance.now()-started;report.batchProfile.largestBatch=Math.max(report.batchProfile.largestBatch,n);}
async function keys(next){const wanted=new Set(next);
 for(const key of pressed)if(!wanted.has(key))await page.keyboard.up(key);
 for(const key of wanted)if(!pressed.has(key))await page.keyboard.down(key);
 pressed=wanted;}
async function stop(){await keys([]);}
async function settle(){await stop();for(let i=0;i<LIMITS.settleVisualFrames;i+=6){const s=await read();
 if(i>=24&&Math.hypot(s.playerVelocity[0],s.playerVelocity[2])<.012&&s.grounded)return;await step(6);}
 throw Error('Ordinary feet did not settle on support');}
async function mouseDelta(dx,dy){bounded();const before=await read();assert.equal(before.locked,true);
 mouse={x:mouse.x+Math.round(dx),y:mouse.y+Math.round(dy)};await page.mouse.move(mouse.x,mouse.y);
 const after=await read();assert.equal(after.locked,true);
 if(Math.abs(dx)>=2)assert.ok(Math.abs(angle(after.yaw-before.yaw))>.0001,'Trusted mouse did not reach production yaw handler');}
async function heading(yaw,pitch=-.14){await stop();for(let i=0;i<LIMITS.aimIterations;i++){
 const s=await read(),h=angle(yaw-s.yaw),v=pitch-s.pitch;if(Math.abs(h)<.006&&Math.abs(v)<.006)return;
 await mouseDelta(Math.max(-200,Math.min(200,-h/.002)),Math.max(-120,Math.min(120,-v/.0018)));await step(2);}
 throw Error('Native heading did not converge');}
async function walk(target){const actions={kind:'walk',target,start:await read(),ticks:0};let best=Infinity,stuck=0;
 await settle();let s=await read();await heading(Math.atan2(-(target[0]-s.player[0]),-(target[2]-s.player[2])));
 for(let frames=0;frames<LIMITS.legVisualFrames;){s=await read();const dx=target[0]-s.player[0],dz=target[2]-s.player[2],d=Math.hypot(dx,dz);
  if(d<.25&&Math.abs(target[1]-s.player[1])<.65){await settle();actions.end=await read();report.observations.push(actions);return;}
  if(d<best-.004){best=d;stuck=0;}else stuck+=d<1?1:4;assert.ok(stuck<480,'Blocked ordinary walk '+JSON.stringify({target,player:s.player}));
  const h=angle(Math.atan2(-dx,-dz)-s.yaw);
  if(Math.abs(h)>.18){await settle();await heading(Math.atan2(-dx,-dz));continue;}
  if(Math.abs(h)>.004)await mouseDelta(Math.max(-24,Math.min(24,-h/.002)),0);
  await keys(d>1.5?['w','Shift']:['w']);const n=d>.9?4:1;await step(n);frames+=n;actions.ticks+=n;
 }
 throw Error('Ordinary movement leg timed out '+target);
}
async function travel(target){const {player,edges}=await page.evaluate(()=>({player:window.__NESI_DEMO_GAME__.playerPosition.toArray(),edges:window.__NESI_DEMO_GAME__.firstLevel.edges}));
 for(const p of infrastructureRoute(player,target,edges))await walk(p);}
async function aim(target){await settle();const attempts=[];for(let i=0;i<LIMITS.aimIterations;i++){
 await step(6);const e=await page.evaluate(target=>{
  const g=window.__NESI_DEMO_GAME__,v=g.playerPosition.clone().fromArray(target).sub(g.camera.position).applyQuaternion(g.camera.quaternion.clone().invert());
  const ndc=g.playerPosition.clone().fromArray(target).project(g.camera);
  return {horizontal:Math.atan2(v.x,-v.z),vertical:Math.atan2(v.y,Math.hypot(v.x,v.z)),ndc:ndc.toArray(),yaw:g.yaw,pitch:g.pitch};},target);
 attempts.push(e);if(Math.abs(e.horizontal)<.009&&Math.abs(e.vertical)<.009&&e.ndc[2]<1){await step(12);return attempts;}
 await mouseDelta(Math.max(-220,Math.min(220,e.horizontal*.82/.002)),Math.max(-150,Math.min(150,-e.vertical*.82/.0018)));
 }throw Error('Ordinary camera cannot frame target '+JSON.stringify({target,last:attempts.at(-1)}));}
async function capture(id,phase,target=null){bounded();assert.ok(++captures<=LIMITS.captures);
 await page.evaluate(phase=>{window.__ARCHIVE_REVIEW__.phase=phase;},phase);let aimAttempts=null;if(target)aimAttempts=await aim(target);
 const before=await read(true);if(phase!=='victory')assertMemoryPhase(phase,before);
 const file=path.join(out,id+'.jpg'),pixels=await captureBrowserFrame(page,file,{canvasOnly:true});const after=await read(true);
 const unchanged=JSON.stringify(stableSnapshot(before))===JSON.stringify(stableSnapshot(after));
 const renderSubmissions=after.renderDiagnostics.submissions-before.renderDiagnostics.submissions;
 const projections=await page.evaluate(()=>{
  const g=window.__NESI_DEMO_GAME__,m=g.firstLevel.archiveMemory,points=[...m.assemblies.flatMap(a=>[a.bolt,a.pawl,a.shoe]),m.teeth,...m.sources];
  return points.map(x=>({name:x.name,centreNdc:x.getWorldPosition(g.playerPosition.clone()).project(g.camera).toArray(),visibleFlag:x.visible}));});
 const row={id,phase,target,aimAttempts,before,after,unchanged,renderSubmissions,projections,capture:pixels,imageSha256:pixels.ok?hash(fs.readFileSync(file)):null,
  pixelVisibility:'Requires actual image review; visible flags/projected centres do not establish occlusion or readable gear detail.'};
 report.captures.push(row);fs.writeFileSync(path.join(out,id+'.json'),JSON.stringify(row,null,2)+'\n');save();
 assert.equal(pixels.ok,true,'Native capture failed '+id);assert.equal(unchanged,true,'Readback advanced physical/current observer state '+id);
 assert.equal(renderSubmissions,1,'Readback must render the current observer exactly once '+id);
 console.log('NATIVE STILL',id,row.imageSha256);
}
async function archiveViews(phase){await travel([-10,18,30]);await capture(phase+'-archive-wide',phase,[-20.6,23.9,30]);
 await walk([-17,18,30]);await capture(phase+'-optical-teeth',phase,[-20.4,24,24.8]);await capture(phase+'-hydraulic-teeth',phase,[-20.4,24,35.2]);}
async function opticalApproach(){await travel([-13,0,-41]);for(const p of [[-18,0,-41],[-26,0,-29],[-63,0,-29],[-63,0,-30.5]])await walk(p);}
async function opticalLeave(){for(const p of [[-63,0,-29],[-26,0,-29],[-18,0,-41],[-13,0,-41]])await walk(p);}
async function waterApproach(){await travel([21,0,39]);for(const p of [[26,0,39],[26,0,47.5],[29,0,47.5]])await walk(p);}
async function waterLeave(){for(const p of [[26,0,47.5],[26,0,39],[21,0,39]])await walk(p);}
async function pressE(label){await stop();const before=await read();await page.keyboard.press('e');await step(18);const after=await read();
 report.observations.push({kind:'trusted-E',label,before,after});save();}
async function observe(phase){assert.equal(stageBusy,false,'Nested detour');stageBusy=true;
 const resume=await read();await page.evaluate(phase=>{window.__ARCHIVE_REVIEW__.phase=phase;},phase);
 try{
  if(phase==='zero'){await archiveViews('zero');await travel(resume.player);}
  else if(phase==='one-sided'){
   await waterApproach();await capture('one-sided-water-source','one-sided',[44,4,39]);await waterLeave();
   await archiveViews('one-sided');await travel(resume.player);
  }else if(phase==='both-latched'){
   await travel([-13,0,-41]);await walk([-18,0,-41]);await walk([-26,0,-29]);await walk([-32,0,-29]);
   await capture('both-latched-optical-source','both-latched',[-44.85,2.4,-53]);await walk([-26,0,-29]);await walk([-18,0,-41]);await walk([-13,0,-41]);
   await archiveViews('both-latched');
   await opticalApproach();await aim([-63,1,-32]);await pressE('optics:mirror off');
   assert.equal((await read()).light.turned,false);await opticalLeave();
   await walk([-18,0,-41]);await walk([-26,0,-29]);await walk([-32,0,-29]);
   // First source has switched off; hydraulic still powered. Capture this
   // honest intermediate state without mislabelling it as both-off.
   const intermediate=await read();assert.equal(intermediate.memory.inputs.optical,0);
   await aim([-44.85,2.4,-53]);await capture('optical-source-after-E','both-latched-off-optics');
   await walk([-26,0,-29]);await walk([-18,0,-41]);await walk([-13,0,-41]);
   await waterApproach();await aim([29,1,49]);await pressE('sluice:0-2 source loss');
   for(let i=0;i<600;i+=6){const s=await read();if(!s.water.flowing&&s.water.height< -4.97)break;await step(6);}
   await capture('both-off-water-source','both-off',[44,4,39]);await waterLeave();await archiveViews('both-off');
   await walk([-28,18,30]);await capture('both-off-door-exit','exit',[-20.6,23.9,30]);await walk([-10,18,30]);await travel(resume.player);
  }else throw Error('Unexpected observation phase');
  const finished=await read();assert.ok(Math.hypot(...finished.player.map((v,i)=>v-resume.player[i]))<.65,'Detour did not ordinarily return to route handoff');
  report.observations.push({kind:'between-stage-detour',phase,startCounters:resume.counters,endCounters:finished.counters,returnedPlayer:finished.player});save();return {ok:true};
 }catch(error){report.errors.push(String(error));save();return {ok:false,error:String(error)};}
 finally{await stop();stageBusy=false;}
}

try{
 page=await browser.newPage();page.setDefaultTimeout(180000);await page.setViewport({width:960,height:540,deviceScaleFactor:1});
 page.on('pageerror',e=>{report.errors.push(String(e));save();});
 await page.evaluateOnNewDocument(()=>localStorage.setItem('brainrot-foundation-v1:brainrot-portal.preferences.v24',JSON.stringify({quality:'low',muted:true})));
 await page.exposeFunction('__ARCHIVE_OBSERVE__',observe);
 const url=new URL(process.env.PAGE_URL||'http://127.0.0.1:4173/');url.search='?edition=foundation&level=41&debug=1';
 await page.goto(url.href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready');
 await page.select('#quality-select','low');await page.bringToFront();await page.click('#play-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='playing');
 await page.evaluate(()=>window.__NESI_DEMO_GAME__.renderer.setAnimationLoop(null));
 assert.equal(await page.evaluate(async()=>{const r=await fetch('build-info.json');return r.ok?await r.text():null;}),fs.readFileSync(path.join(packageRoot,'build-info.json'),'utf8'));
 if(!await page.evaluate(()=>document.pointerLockElement===window.__NESI_DEMO_GAME__.renderer.domElement))await page.mouse.click(mouse.x,mouse.y);
 await page.waitForFunction(()=>document.pointerLockElement===window.__NESI_DEMO_GAME__.renderer.domElement);
 await page.mouse.move(mouse.x,mouse.y);
 await page.evaluate(({limits})=>{
  const g=window.__NESI_DEMO_GAME__;if(g.levelIndex!==40||!g.firstLevel.singularity||g.firstLevel.completedStages!==0)throw Error('Wrong/used production castle');
  const leaves=g.colliders.filter(c=>c.kinematic&&Math.abs(c.box.min.x+21.23)<.01&&Math.abs(c.box.max.x+20.77)<.01&&Math.abs(c.box.min.y-18)<.01&&Math.abs(c.box.max.y-22.7)<.01&&Math.abs(c.box.max.z-c.box.min.z-3.2)<.01);
  if(leaves.length!==2)throw Error('Expected original paired archive leaves');
  const q={limits,phase:'zero',detour:true,cargo:g.cargo,body:g.physics.cargoBody,physics:g.physics,player:g.playerPosition,leaves,
   initialElapsed:g.elapsed,originalMove:g.input.getMove,originalUpdate:g.updatePlaying,originalVisual:g.updateVisuals,originalRender:g.render,renderSubmissions:0,originalReset:g.resetRun,originalRespawn:g.respawn,originalCargoReset:g.physics.resetCargo,
   pending:[],milestones:[],inputEvents:[],counters:{physicsSteps:0,visualFrames:0,detourPhysicsSteps:0,detourVisualFrames:0,routeVisualFrames:0,resets:0,respawns:0,cargoResets:0}};
  window.__ARCHIVE_REVIEW__=q;
  q.assert=()=>{if(g.cargo!==q.cargo||g.physics.cargoBody!==q.body||g.physics!==q.physics||g.playerPosition!==q.player)throw Error('Original actor/physics identity changed');
   if(q.counters.resets+q.counters.respawns+q.counters.cargoResets)throw Error('Original attempt restarted');
   if(q.counters.visualFrames>limits.totalVisualFrames||q.counters.detourVisualFrames>limits.detourVisualFrames)throw Error('Finite native frame limit reached');};
  g.updatePlaying=function(dt,...a){if(dt!==1/120)throw Error('Unexpected physics tick');q.counters.physicsSteps++;if(q.detour)q.counters.detourPhysicsSteps++;const r=q.originalUpdate.call(this,dt,...a);q.assert();return r;};
  g.updateVisuals=function(dt,...a){if(dt!==1/60)throw Error('Unexpected visual tick');q.counters.visualFrames++;if(q.detour)q.counters.detourVisualFrames++;const r=q.originalVisual.call(this,dt,...a);q.assert();return r;};
  g.render=function(...a){q.renderSubmissions++;return q.originalRender.apply(this,a);};
  for(const [object,key,original,counter]of [[g,'resetRun',q.originalReset,'resets'],[g,'respawn',q.originalRespawn,'respawns'],[g.physics,'resetCargo',q.originalCargoReset,'cargoResets']])
   object[key]=function(...a){q.counters[counter]++;return original.apply(this,a);};
  for(const type of ['keydown','keyup','mousemove'])document.addEventListener(type,event=>{
   if(!q.detour)return;if(q.inputEvents.length>=20000)throw Error('Finite input event limit reached');
   q.inputEvents.push({type,code:event.code??null,movementX:event.movementX??0,movementY:event.movementY??0,trusted:event.isTrusted,
    locked:document.pointerLockElement===g.renderer.domElement,phase:q.phase,visualFrame:q.counters.visualFrames});
  },true);
  window.__NESI_CAPTURE_LEVEL_MARK__=mark=>{q.milestones.push({...mark,totalVisualFrame:q.counters.visualFrames});
   if(mark.name==='Solved sluice')q.pending.push('one-sided');if(mark.name==='Solved optics')q.pending.push('both-latched');};
  window.__SINGULARITY_FRAME__=()=>{if(q.detour)throw Error('Route frame during native detour');q.counters.routeVisualFrames++;q.assert();};
  window.__SINGULARITY_FLUSH__=async()=>{
   if(!q.pending.length)return;if(q.detour)throw Error('Recursive observation flush');const driven=g.input.getMove;
   if(g.input.keys.size)throw Error('Between-stage handoff still holds movement keys');
   // Park the already-awaiting driver. Restore its saved production input for
   // trusted observation controls, then restore exactly its adapter reference.
   g.input.getMove=q.originalMove;q.detour=true;
   try{while(q.pending.length){const result=await window.__ARCHIVE_OBSERVE__(q.pending.shift());if(!result.ok)throw Error(result.error);}}
   finally{q.detour=false;q.phase='canonical';g.input.getMove=driven;}q.assert();
  };
 },{limits:LIMITS});
 report.bootstrap=await read();assert.ok(Math.hypot(report.bootstrap.player[0],report.bootstrap.player[1],report.bootstrap.player[2]-54)<.1,'Authored spawn was not retained');
 assert.deepEqual(report.bootstrap.canvas,{width:960,height:540},'Actual desktop production canvas dimensions');
 report.bootstrapScope='Normal URL selection and trusted Play occur before observer counters. Original identities refer to this fresh ordinary browser attempt, not UUIDs from an earlier CI session. No reset/respawn/cargoReset is permitted after this bootstrap.';
 report.browser={version:await browser.version(),headless:true,requestedBackend:'Chromium ANGLE SwiftShader software WebGL; no CPU scene substitute',
  actual:await page.evaluate(()=>{const gl=window.__NESI_DEMO_GAME__.renderer.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info');return {
   version:gl.getParameter(gl.VERSION),shadingLanguage:gl.getParameter(gl.SHADING_LANGUAGE_VERSION),vendor:gl.getParameter(e?e.UNMASKED_VENDOR_WEBGL:gl.VENDOR),renderer:gl.getParameter(e?e.UNMASKED_RENDERER_WEBGL:gl.RENDERER)};})};
 const initial=await observe('zero');assert.equal(initial.ok,true,initial.error);
 await page.evaluate(()=>{const q=window.__ARCHIVE_REVIEW__;q.phase='canonical';q.detour=false;});
 report.route=await page.evaluate(()=>window.__NESI_RUN_LEVEL_ROUTE__());
 assert.equal(report.route.pass,true);assert.equal(report.route.sameCompanion,true);assert.deepEqual(report.route.metrics.solvedIds,ORDER);
 await capture('ordinary-victory','victory');assert.equal(captures,LIMITS.captures);
 report.final=await read();report.observer=await page.evaluate(()=>{const q=window.__ARCHIVE_REVIEW__;return {milestones:q.milestones,inputEvents:q.inputEvents,initialElapsed:q.initialElapsed,counters:q.counters,pending:q.pending};});
 assert.deepEqual(report.observer.pending,[]);assert.equal(report.observer.counters.routeVisualFrames,report.route.frames);
 assert.equal(report.observer.counters.visualFrames,report.observer.counters.routeVisualFrames+report.observer.counters.detourVisualFrames);
 assert.equal(report.batchProfile.visualFrames,report.observer.counters.detourVisualFrames,'Missing/extra detour batch ticks');
 assert.ok(Math.abs((report.final.elapsed-report.observer.initialElapsed)/1000-report.observer.counters.physicsSteps/120)<1e-5,'Missing/extra simulation ticks');
 assert.ok(report.observer.inputEvents.some(e=>e.type==='mousemove'&&e.trusted&&e.locked&&(e.movementX||e.movementY)),'No trusted ordinary camera input');
 assert.ok(report.observer.inputEvents.filter(e=>e.type==='keydown').every(e=>e.trusted),'Untrusted observation keys');
 assert.equal(report.observer.inputEvents.filter(e=>e.type==='keydown'&&e.code==='KeyE').length,2,'Exactly two source-off E presses');
 assert.deepEqual(report.errors,[]);report.identityAfter=await verifyFrozenL({sourceRoot,packageRoot,archive:path.resolve(process.env.FROZEN_ARCHIVE||'qa/frozen-l/campaign-browser.zip')});
 report.status='executed-technical-capture-needs-image-review';report.executed={canonicalRoute:true,ordinaryObservationDetours:true,nativeReadbacks:captures,actualImageReview:false,humanPlaytest:false,hardwareBenchmark:false,masterTZ500:false};save();
 console.log('CASTLE41 NATIVE',PIN.commit,captures,report.observer.counters.visualFrames);
}catch(error){report.status='failed';report.errors.push(String(error));if(page){report.failure=await read().catch(()=>null);
 await captureBrowserFrame(page,path.join(out,'failure-current.jpg'),{canvasOnly:true}).catch(()=>{});
 report.observer=await page.evaluate(()=>{const q=window.__ARCHIVE_REVIEW__;return q?{counters:q.counters,milestones:q.milestones,inputEvents:q.inputEvents,pending:q.pending}:null;}).catch(()=>null);}
 save();throw error;
}finally{if(page)await stop().catch(()=>{});await browser.close();}
