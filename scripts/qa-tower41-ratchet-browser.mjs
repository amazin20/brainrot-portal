/** Bounded room41 physical-cell review from the exact production WebGL build.
 * Its scripted controls are ordinary gameplay inputs. It is not an acceptance
 * of the complete castle, camera, human puzzle discovery or a physical device. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {verifyReleasePackage,verifyReleaseMetadata} from './lib/release-manifest.mjs';

export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export const qualificationKey='brainrot-tower41-ratchet-qualification-v1:brainrot-portal.preferences.v24';
export const oldSavePrefixes=['brainrot-foundation-v1:','brainrot-puzzle-pilot43-v1:','brainrot-puzzle-progression-v1:','brainrot-puzzle-progression-next-v1:','brainrot-puzzle-progression-finale-v1:'];
export const limitations=[
 'One opt-in physical cell in the existing eleven-mechanism castle; no replacement tower or 500-stage acceptance.',
 'Scripted ordinary controls and software WebGL; human discovery, hardware FPS and physical-device touch are not measured.',
 'Live original-player vertices are measured at the declared native samples; cropping and occlusion remain reported findings, not full-camera acceptance.',
];
export function sourceIdentity(){
 const commit=process.env.BUILD_COMMIT||process.env.GITHUB_SHA;
 assert.match(commit||'',/^[a-f0-9]{40}$/,'Exact BUILD_COMMIT required');
 const review={runId:Number(process.env.SOURCE_REVIEW_RUN_ID||process.env.GITHUB_RUN_ID||0),runAttempt:Number(process.env.SOURCE_REVIEW_RUN_ATTEMPT||process.env.GITHUB_RUN_ATTEMPT||0)};
 assert.ok(Object.values(review).every(n=>Number.isSafeInteger(n)&&n>=0),'Finite source review identity required');
 return {sourceCommit:commit,sourceReview:review};
}
export function checkBuild(directory='dist'){
 const identity=sourceIdentity(),info=JSON.parse(fs.readFileSync(path.join(directory,'build-info.json'),'utf8'));
 assert.equal(info.commit,identity.sourceCommit);verifyReleaseMetadata(info,{directory,commit:identity.sourceCommit});
 const files=verifyReleasePackage(info,directory);
 const models=JSON.parse(fs.readFileSync(path.join(directory,'models/runtime/manifest.json'),'utf8'));
 assert.equal(models.models.length,14,'The original fourteen runtime GLBs are required');
 assert.equal(new Set(models.models.map(m=>m.id)).size,14);
 for(const model of models.models){
  const bytes=fs.readFileSync(path.join(directory,'models/runtime',model.filename));
  assert.equal(bytes.length,model.outputBytes);assert.equal(sha256(bytes),model.outputSHA256);
 }
 assert.equal(info.features.tower.stages,11);assert.equal(info.features.tower.checkpoints,false);
 return {info,nativePackage:{sourceCommit:identity.sourceCommit,packageFilesSha256:info.packageFilesSha256,fileCount:files.length,totalBytes:files.reduce((n,f)=>n+f.bytes,0),files,
  runtimeManifestSHA256:sha256(fs.readFileSync(path.join(directory,'models/runtime/manifest.json'))),modelHashes:models.models.map(({id,filename,outputSHA256,outputBytes})=>({id,filename,sha256:outputSHA256,bytes:outputBytes}))}};
}
export async function launchBrowser(){
 const {default:puppeteer}=await import('puppeteer-core');
 return puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,protocolTimeout:5400000,
  args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
}
export async function startPreview(base){
 if(process.env.START_SERVER!=='1')return null;
 const url=new URL(base);assert.equal(url.hostname,'127.0.0.1');
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',url.port||'4173','--strictPort'],{stdio:'ignore'});
 try{for(let i=0;i<200;i++){
  assert.equal(server.exitCode,null,'Preview stopped before readiness');
  try{if((await fetch(new URL('build-info.json',url))).ok)return server;}catch{}
  assert.ok(i<199,'Preview did not become ready');await new Promise(r=>setTimeout(r,50));
 }}catch(error){server.kill();throw error;}
}
export function reviewURL(base,{optIn=true,debug=true}={}){
 const url=new URL(base);url.searchParams.set('edition','foundation');url.searchParams.set('level','41');url.searchParams.delete('pilot');
 if(debug)url.searchParams.set('debug','1');else url.searchParams.delete('debug');url.searchParams.delete('smoke');
 if(optIn)url.searchParams.set('tower41ratchet','1');else url.searchParams.delete('tower41ratchet');return url;
}
export async function seedSaves(page){
 const save=JSON.stringify({quality:'low',volume:.65,muted:true,tutorial:true,completed:[0,1,42],hints:{},resumeLevel:42,campaignRevision:'creative-campaign-v48',roomRevisions:{16:'cable-supported-architecture-v1',32:'siphon-observatory-v1',50:'echo-horizon-v1'}});
 const saves=Object.fromEntries(oldSavePrefixes.map(prefix=>[prefix+'brainrot-portal.preferences.v24',save]));
 await page.evaluateOnNewDocument(({saves,key})=>{for(const [name,value]of Object.entries(saves))if(localStorage.getItem(name)===null)localStorage.setItem(name,value);if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify({quality:'low',volume:.65,muted:true,tutorial:true}));},{saves,key:qualificationKey});
 return saves;
}
export async function assertSaves(page,saves){
 const observed=await page.evaluate(keys=>Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)])),Object.keys(saves));
 assert.deepEqual(observed,saves,'Qualification must preserve every prior save byte');return {pass:true,keys:Object.keys(saves)};
}
export async function waitMenu(page){
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready');
 await page.waitForFunction(()=>{const s=document.querySelector('#start-screen'),b=document.querySelector('#play-button');return !s.inert&&getComputedStyle(s).opacity==='1'&&!b.disabled;});
}
export async function activate(page,selector,touch=false){
 await page.bringToFront();await page.$eval(selector,e=>e.scrollIntoView({block:'center'}));
 await page.waitForFunction(selector=>{const e=document.querySelector(selector),r=e?.getBoundingClientRect(),screen=e?.closest('.screen');return document.hasFocus()&&!document.hidden&&!document.pointerLockElement&&!e?.disabled&&!e?.closest('[inert]')&&r?.width>0&&r?.height>0&&(!screen||getComputedStyle(screen).opacity==='1')&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));},{},selector);
 if(touch)await page.tap(selector);else await page.click(selector);
}
export async function openQualification(page,url,info,{touch=false}={}){
 await seedSaves(page);await page.goto(url.href,{waitUntil:'domcontentloaded'});await waitMenu(page);
 const build=await page.evaluate(async()=>{const r=await fetch('build-info.json',{cache:'no-store'});if(!r.ok)throw Error('Missing exact build metadata');return r.json();});assert.deepEqual(build,info);
 assert.equal(await page.$eval('#level-select',e=>Number(e.value)),40);
 const before=await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;return {state:g.state,cell:Boolean(g.firstLevel.ratchetCell),enabled:g.tower41RatchetQualification,hook:typeof window.__NESI_RUN_TOWER41_RATCHET_ROUTE__,stages:g.firstLevel.totalStages,solved:g.firstLevel.getTowerMetrics().solvedIds};});
 assert.deepEqual(before,{state:'ready',cell:true,enabled:true,hook:'function',stages:11,solved:[]});
 await page.select('#quality-select','low');await activate(page,'#play-button',touch);
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='playing');
 await page.evaluate(()=>window.__NESI_DEMO_GAME__.renderer.setAnimationLoop(null));return before;
}

/** This entire function executes in the real browser. Preparation and the
 * local driver both call the wrapped production visual update, so no ordinary
 * approach frames disappear from the measured route or recording. */
export async function observeTower41Route({scenario,record,stride,width,height}){
 const g=window.__NESI_DEMO_GAME__;if(g.state!=='playing'||!g.firstLevel.ratchetCell)throw Error('Actual opted-in Play required');
 const cargo=g.cargo,body=g.physics.cargoBody,cargoGroup=cargo.group,cargoVisual=cargo.visual,companionAnimator=g.companionAnimator,companionRig=g.companionRig,playerPosition=g.playerPosition,root=g.playerGroup,visual=g.playerVisual,animator=g.animator,cell=g.firstLevel.ratchetCell;
 const sourceMeshes=[];visual.traverse(mesh=>{if(mesh.isMesh)sourceMeshes.push({mesh,geometry:mesh.geometry,positionAttribute:mesh.geometry.attributes.position,skinIndexAttribute:mesh.geometry.attributes.skinIndex,skinWeightAttribute:mesh.geometry.attributes.skinWeight,skeleton:mesh.skeleton,skeletonBones:mesh.skeleton?.bones.slice()??[],vertices:mesh.geometry.attributes.position?.count||0,bones:mesh.skeleton?.bones.length||0});});
 const cargoMeshes=[];cargoVisual.traverse(mesh=>{if(mesh.isMesh)cargoMeshes.push({mesh,geometry:mesh.geometry,positionAttribute:mesh.geometry.attributes.position});});
 const vertices=sourceMeshes.reduce((n,m)=>n+m.vertices,0),bones=Math.max(0,...sourceMeshes.map(m=>m.bones));
 if(vertices!==96753||bones!==15||body.mass!==3.2)throw Error('Original player96753/15 and original cargo3.2kg required');
 cell.ensure();if(cell.bodies.length!==4||JSON.stringify(cell.constraints.map(c=>c.equations.length))!==JSON.stringify([5,5]))throw Error('Actual four-body cell and five-equation guide/hinge required');
 const old={visual:g.updateVisuals,reset:g.resetRun,respawn:g.respawn,cargoReset:g.physics.resetCargo,cellReset:cell.reset};
 const resets={resetRun:0,respawn:0,resetCargo:0,mechanismReset:0},cameraSamples=[],milestones=[],writes=[],nativeTraySamples=new Map(),stepStart=g.physics.world.stepnumber;
 let frames=0,encoded=0,lastEncodedVisual=-1,completedPostSteps=0,previousPostStep=stepStart;
 const identity=()=>{if(g.cargo!==cargo||g.physics.cargoBody!==body||body.mass!==3.2||cargo.group!==cargoGroup||cargo.visual!==cargoVisual||g.companionAnimator!==companionAnimator||g.companionRig!==companionRig||g.playerPosition!==playerPosition||g.playerGroup!==root||g.playerVisual!==visual||g.animator!==animator||g.firstLevel.ratchetCell!==cell||sourceMeshes.some(m=>m.mesh.geometry!==m.geometry||m.mesh.geometry.attributes.position!==m.positionAttribute||m.mesh.geometry.attributes.position.count!==m.vertices||m.mesh.geometry.attributes.skinIndex!==m.skinIndexAttribute||m.mesh.geometry.attributes.skinWeight!==m.skinWeightAttribute||m.mesh.skeleton!==m.skeleton||m.skeleton?.bones.length!==m.bones&&m.bones!==0||m.skeletonBones.some((bone,i)=>m.mesh.skeleton.bones[i]!==bone))||cargoMeshes.some(m=>m.mesh.geometry!==m.geometry||m.mesh.geometry.attributes.position!==m.positionAttribute))throw Error('A measured original actor, skin, cargo visual or mechanism was replaced');};
 const snapshot=()=>({state:g.state,player:g.playerPosition.toArray(),cargo:body.position.toArray(),cargoVelocity:body.velocity.toArray(),cargoQuaternion:body.quaternion.toArray(),cargoAngularVelocity:body.angularVelocity.toArray(),held:g.heldCube===cargo,cargoBodyId:body.id,worldStep:g.physics.world.stepnumber,teleports:g.teleportCount,solved:g.firstLevel.getTowerMetrics().solvedIds,cell:cell.diagnostics(),camera:g.camera.position.toArray(),cameraFov:g.camera.fov});
 // Independently reconstruct the actual Cannon tray's finite upper face.
 // This observation uses the true body/shape transforms, not floorHeight or
 // the journey's reported support flag, and never writes an actor pose.
 function observeNativeTray(){
  const rack=cell.rack,shape=rack.shapes[0],offset=rack.shapeOffsets[0],shapeOrientation=rack.shapeOrientations[0];
  if(!shape.halfExtents)throw Error('The actual original tray must remain a Cannon Box');
  const bodyQuaternion=g.playerGroup.quaternion.clone().set(...rack.quaternion.toArray()),q=bodyQuaternion.clone().multiply(g.playerGroup.quaternion.clone().set(...shapeOrientation.toArray()));
  const centre=g.playerPosition.clone().set(...offset.toArray()).applyQuaternion(bodyQuaternion).add(g.playerPosition.clone().set(...rack.position.toArray())),normal=g.playerPosition.clone().set(0,1,0).applyQuaternion(q),face=centre.clone().addScaledVector(normal,shape.halfExtents.y);
  const height=normal.y>.5?face.y-(normal.x*(g.playerPosition.x-face.x)+normal.z*(g.playerPosition.z-face.z))/normal.y:null;
  const local=height===null?null:g.playerPosition.clone().set(g.playerPosition.x,height,g.playerPosition.z).sub(centre).applyQuaternion(q.clone().invert());
  const inFootprint=Boolean(local&&Math.abs(local.x)<=shape.halfExtents.x+1e-7&&Math.abs(local.z)<=shape.halfExtents.z+1e-7);
  const sample={step:g.physics.world.stepnumber,player:g.playerPosition.toArray(),grounded:g.playerGrounded,held:g.heldCube===cargo,bodyId:rack.id,shapeId:shape.id,bodyPosition:rack.position.toArray(),bodyQuaternion:rack.quaternion.toArray(),shapeOffset:offset.toArray(),shapeQuaternion:shapeOrientation.toArray(),halfExtents:shape.halfExtents.toArray(),normal:normal.toArray(),height,inFootprint};
  if(![...sample.player,...sample.bodyPosition,...sample.bodyQuaternion,...sample.shapeOffset,...sample.shapeQuaternion,...sample.halfExtents,...sample.normal].every(Number.isFinite)||(height!==null&&!Number.isFinite(height)))throw Error('Nonfinite true tray support geometry');
  nativeTraySamples.set(sample.step,sample);
 }
 function measure(){
  const before=snapshot();g.render();if(JSON.stringify(before)!==JSON.stringify(snapshot()))throw Error('Native capture advanced or rewrote gameplay');
  const projection={vertices:0,minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity,minDepth:Infinity,behindCount:0,outsideLensCount:0,insideLens:false,source:'every live skinned original-player vertex at this actual native sample'};
  const vertex=g.playerPosition.clone(),view=g.playerPosition.clone();
  for(const row of sourceMeshes){row.mesh.skeleton?.update();for(let i=0;i<row.vertices;i++){
   row.mesh.getVertexPosition(i,vertex).applyMatrix4(row.mesh.matrixWorld);view.copy(vertex).applyMatrix4(g.camera.matrixWorldInverse);vertex.project(g.camera);
   if(![vertex.x,vertex.y,vertex.z,view.z].every(Number.isFinite))throw Error('Nonfinite live original-model projection');
   projection.vertices++;projection.minX=Math.min(projection.minX,vertex.x);projection.maxX=Math.max(projection.maxX,vertex.x);projection.minY=Math.min(projection.minY,vertex.y);projection.maxY=Math.max(projection.maxY,vertex.y);projection.minDepth=Math.min(projection.minDepth,-view.z);
   if(view.z>=0)projection.behindCount++;if(view.z>=0||Math.abs(vertex.x)>1||Math.abs(vertex.y)>1||vertex.z< -1||vertex.z>1)projection.outsideLensCount++;
  }}
  if(projection.vertices!==96753)throw Error('A live original-model vertex was omitted');projection.insideLens=projection.outsideLensCount===0;return projection;
 }
 const capture=(visualFrame,terminal=false)=>{
  identity();if(g.renderer.domElement.width!==width||g.renderer.domElement.height!==height)throw Error('Actual production canvas dimensions changed');
  const bodyVertexProjection=measure(),state={...snapshot(),level:41,encodedFrame:encoded,visualFrame,terminal,bodyVertexProjection};
  cameraSamples.push(state);writes.push(window.__NESI_WRITE_RATCHET_FRAME__(encoded++,g.renderer.domElement.toDataURL('image/jpeg',.84),state));lastEncodedVisual=visualFrame;
 };
 const mark=name=>{const bodyVertexProjection=measure(),state={name,visualFrame:Math.max(0,frames-1),...snapshot(),bodyVertexProjection};milestones.push(state);if(!record)writes.push(window.__NESI_WRITE_RATCHET_SHOT__(`step-${String(milestones.length).padStart(2,'0')}`,g.renderer.domElement.toDataURL('image/jpeg',.9),state));};
 function postStep(){const step=g.physics.world.stepnumber;if(step!==previousPostStep+1)throw Error('Actual native physics steps are not consecutive');previousPostStep=step;completedPostSteps++;}
 for(const [key,target,method]of [['resetRun',g,'resetRun'],['respawn',g,'respawn'],['resetCargo',g.physics,'resetCargo'],['mechanismReset',cell,'reset']]){const previous=target[method];target[method]=function(...a){resets[key]++;throw Error('In-route '+key+' is not permitted');};}
 g.physics.world.addEventListener('postStep',postStep);
 g.updateVisuals=function(dt,...args){const result=old.visual.call(this,dt,...args);if(dt>0){if(Math.abs(dt-1/60)>1e-12)throw Error('The continuous native route must use actual60Hz visual updates');identity();if(g.state!=='playing')throw Error('The bounded cell must remain in ordinary playing state');observeNativeTray();if(record&&frames%stride===0)capture(frames);frames++;}return result;};
 window.__NESI_CAPTURE_RATCHET_MARK__=m=>mark(m.name);
 try{
  if(!record)mark('Ordinary Play start');
  const route=await window.__NESI_RUN_TOWER41_RATCHET_ROUTE__({scenario});
  if(record&&lastEncodedVisual<frames-1)capture(frames-1,true);
  if(!record)mark('Bounded qualification finished');await Promise.all(writes);
  identity();const final=snapshot();
  if(route.pass!==true||route.sameCargo!==true||Object.values(resets).some(n=>n!==0)||route.resets||route.respawns||route.cargoResets||route.mechanismResets)throw Error('The bounded original-cargo route was not successful and uninterrupted');
  if(frames!==route.frames+route.preparation.frames||completedPostSteps!==route.physicsTicks+route.preparation.physicsSteps||completedPostSteps!==frames*2)throw Error('Preparation or local native steps were omitted');
  if(final.state!=='playing'||JSON.stringify(final.solved)!==JSON.stringify(['freight'])||g.firstLevel.totalStages!==11||g.firstLevel.getTowerMetrics().checkpoints!==false)throw Error('The qualification changed original castle progression');
  let boardingSupportReview=null;
  if(scenario==='qualification'||scenario==='boarding'){
   const boarding=route.boarding,boarded=boarding.samples.filter(s=>s.boarded===true);
   if(boarding.attemptOutcome!=='ACTUAL_TRAY_BOARDING_OBSERVED'||boarded.length===0||boarded.length!==boarding.actualBoardedSamples)throw Error('Actual elevated tray boarding was not reached');
   const independentlyObserved=boarded.map(sample=>{
    const observed=nativeTraySamples.get(sample.step),support=sample.actualTraySupport;
    if(!observed||!support||!observed.grounded||!observed.held||!observed.inFootprint||observed.player[1]<=cell.centre.y+.1||observed.normal[1]<=.5||Math.abs(observed.player[1]-observed.height)>=.015||support.bodyId!==observed.bodyId||support.shapeId!==observed.shapeId||JSON.stringify(sample.player)!==JSON.stringify(observed.player)||Math.abs(support.height-observed.height)>1e-8||support.normal.some((n,i)=>Math.abs(n-observed.normal[i])>1e-8))throw Error('Reported boarding is not supported by the actual finite Cannon tray face');
    return observed;
   });
   boardingSupportReview={pass:true,actualBoardedSamples:boarded.length,attemptOutcome:boarding.attemptOutcome,bodyId:cell.rack.id,shapeId:cell.rack.shapes[0].id,samples:independentlyObserved,method:'Independently reconstructed true Cannon Box upper face at each actual boarding visual step; positive elevated finite-footprint support and matching body, shape, normal and height. Existing castle floor samples do not qualify.'};
  }
  return {route,scenario,frames,physicsSteps:completedPostSteps,seconds:completedPostSteps/120,stepStart,stepEnd:final.worldStep,encodedFrames:encoded,lastEncodedVisual,milestones,cameraSamples,final,resets,
   modelIdentity:{pass:true,playerVertices:vertices,bones,playerRootUuid:root.uuid,playerVisualUuid:visual.uuid,cargoUuid:cargoGroup.uuid,cargoVisualUuid:cargoVisual.uuid,cargoBodyId:body.id,cargoMass:body.mass,sameOriginalActorReferences:true,sameOriginalSkins:true,sameOriginalCargoVisual:true,observedVisualFrames:frames},
   cellIdentity:{bodyIds:cell.bodies.map(b=>b.id),rackBodyId:cell.rack.id,trayShapeId:cell.rack.shapes[0].id,constraintEquations:cell.constraints.map(c=>c.equations.length),originalCargoBodyId:cell.originalCargoBody.id},boardingSupportReview,
   cameraReview:{sampleCount:record?cameraSamples.length:milestones.length,outsideSamples:(record?cameraSamples:milestones).filter(s=>!s.bodyVertexProjection.insideLens).map(s=>({visualFrame:s.visualFrame,encodedFrame:s.encodedFrame??null,name:s.name??null,bodyVertexProjection:s.bodyVertexProjection})),fullCameraAccepted:false},
   fullTowerAccepted:false,humanPlaytestAccepted:false,physicalDeviceAccepted:false,publicationAccepted:false};
 }catch(error){await Promise.allSettled(writes);window.__NESI_RATCHET_FAILURE__={error:String(error),scenario,frames,physicsSteps:completedPostSteps,resets,route:error.ratchetInputReport??error.singularityReport??null,final:snapshot()};throw error;}
 finally{g.physics.world.removeEventListener('postStep',postStep);g.updateVisuals=old.visual;g.resetRun=old.reset;g.respawn=old.respawn;g.physics.resetCargo=old.cargoReset;cell.reset=old.cellReset;delete window.__NESI_CAPTURE_RATCHET_MARK__;}
}
export function assertObservedRoute(observed,scenario){
 assert.equal(observed.route.pass,true);assert.equal(observed.scenario,scenario);assert.equal(observed.modelIdentity.pass,true);
 assert.equal(observed.modelIdentity.playerVertices,96753);assert.equal(observed.modelIdentity.bones,15);assert.equal(observed.modelIdentity.cargoMass,3.2);
 assert.equal(observed.frames,observed.route.frames+observed.route.preparation.frames);assert.equal(observed.physicsSteps,observed.frames*2);
 assert.deepEqual(observed.resets,{resetRun:0,respawn:0,resetCargo:0,mechanismReset:0});assert.deepEqual(observed.final.solved,['freight']);
 assert.equal(observed.final.state,'playing');assert.equal(observed.route.preparation.resets+observed.route.preparation.respawns+observed.route.preparation.cargoResets,0);
 assert.equal(observed.fullTowerAccepted,false);assert.equal(observed.publicationAccepted,false);assert.equal(observed.cameraReview.fullCameraAccepted,false);
 if(scenario==='qualification'||scenario==='held'){
  assert.equal(observed.route.heldContact.status,'CONTACT_OBSERVED');assert.ok(observed.route.heldContact.actualHeldPositiveContactTicks>0);
  assert.equal(observed.route.heldContact.passedBoundedContact,true);assert.equal(observed.route.heldContact.fullServoResistanceAccepted,false);
 }
 if(scenario==='qualification'||scenario==='fast-release'){
  const release=observed.route.fastRelease;assert.equal(release.pass,true);assert.ok(Number.isFinite(release.releaseSpeed)&&release.releaseSpeed>0);
  for(const key of ['bodyPosition','bodyVelocity','bodyAngularVelocity','bodyQuaternion'])assert.deepEqual(release.release.after[key],release.release.before[key],'Native E must preserve the original cargo '+key);
  assert.equal(release.release.after.carryTarget,null);
 }
 if(scenario==='qualification'||scenario==='boarding'){
  assert.equal(observed.route.boarding.pass,true);assert.equal(observed.route.boarding.fullBoardingResistanceAccepted,false);
  assert.deepEqual(observed.route.boarding.completedMechanismsAfter,observed.route.boarding.completedMechanismsBefore);
  assert.equal(observed.route.boarding.attemptOutcome,'ACTUAL_TRAY_BOARDING_OBSERVED');assert.ok(observed.route.boarding.actualBoardedSamples>0);
  assert.equal(observed.boardingSupportReview.pass,true);assert.equal(observed.boardingSupportReview.actualBoardedSamples,observed.route.boarding.actualBoardedSamples);
  assert.equal(observed.boardingSupportReview.bodyId,observed.cellIdentity.rackBodyId);assert.equal(observed.boardingSupportReview.shapeId,observed.cellIdentity.trayShapeId);
 }
}
export async function pauseResume(page){
 await page.bringToFront();await page.evaluate(()=>window.__NESI_DEMO_GAME__.renderer.setAnimationLoop(window.__NESI_DEMO_GAME__.animate));
 await page.keyboard.press('Escape');let pointerLockExitFallback=false;
 try{await page.waitForFunction(()=>!document.pointerLockElement,{timeout:5000});}catch(error){if(error.name!=='TimeoutError')throw error;await page.evaluate(()=>document.exitPointerLock());pointerLockExitFallback=true;}
 let pauseControlUsed='escape';if(await page.evaluate(()=>window.__NESI_DEMO_GAME__.state==='playing')){await activate(page,'#pause-button');pauseControlUsed='hud';}
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.state==='paused');
 await page.waitForFunction(()=>{const s=document.querySelector('#pause-screen');return !s.inert&&getComputedStyle(s).opacity==='1';});
 await page.bringToFront();await page.focus('#resume-button');await page.keyboard.press('Enter');
 await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.state==='playing');
 // Production Resume requests pointer lock again. Observe that legitimate
 // state instead of waiting for an unlock that no player action requested.
 const resumeObservation=await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;const observed={state:g.state,pointerLocked:Boolean(document.pointerLockElement),pointerLockedToGameplayCanvas:document.pointerLockElement===g.renderer.domElement,hasFocus:document.hasFocus(),externalBlocked:g.externalBlocked};g.renderer.setAnimationLoop(null);return observed;});
 assert.equal(resumeObservation.state,'playing');
 return {pass:true,pauseControlUsed,pointerLockExitFallback,resumeControl:'focused-native-enter',resumeObservation};
}
async function mobileReview(browser,url,info,out,viewport,errors){
 const page=await browser.newPage();page.setDefaultTimeout(180000);page.on('pageerror',e=>errors.push('mobile: '+String(e)));
 try{
  await page.setViewport({...viewport,deviceScaleFactor:1,isMobile:true,hasTouch:true});const saves=await seedSaves(page);await openQualification(page,url,info,{touch:true});
  assert.equal(await page.evaluate(()=>matchMedia('(pointer: coarse)').matches),true);
  // Reach the original companion with the existing ordinary freight route;
  // native E below acts on that same body rather than an input-only mock.
  const preparation=await page.evaluate(()=>window.__NESI_RUN_LEVEL_ROUTE__({order:['freight'],stopAfter:'freight'}));
  assert.equal(preparation.partial,true);assert.equal(preparation.resets+preparation.respawns+preparation.cargoResets,0);
  const beforeE=await page.evaluate(()=>({held:Boolean(window.__NESI_DEMO_GAME__.heldCube),id:window.__NESI_DEMO_GAME__.physics.cargoBody.id}));assert.equal(beforeE.held,false);
  await page.tap('.lab-mobile button[aria-label="Взять или поставить друга, использовать механизм"]');
  const afterE=await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;for(let i=0;i<30;i++){g.updatePlaying(1/120);g.updatePlaying(1/120);g.updateVisuals(1/60,1);}return {held:g.heldCube===g.cargo,id:g.physics.cargoBody.id};});
  assert.deepEqual(afterE,{held:true,id:beforeE.id});
  const bounds=await page.evaluate(()=>['#joystick','#sprint-button','#jump-button','.lab-mobile button:nth-child(1)','.lab-mobile button:nth-child(2)','.lab-mobile button:nth-child(3)','.lab-mobile button:nth-child(4)'].map(selector=>{const e=document.querySelector(selector),r=e.getBoundingClientRect();return {selector,width:r.width,height:r.height,inViewport:r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};}));
  for(const b of bounds)assert.ok(b.width>=40&&b.height>=40&&b.inViewport&&b.hit,'Actual visible touch target: '+b.selector);
  const stick=await (await page.$('#joystick')).boundingBox(),cdp=await page.createCDPSession(),point={x:stick.x+stick.width/2,y:stick.y+stick.height/2,id:7,radiusX:1,radiusY:1,force:1};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...point,x:point.x+26}]});
  await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.input.mobileMove.x>.3);
  const movement=await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__,before=g.playerPosition.clone(),input=g.input.getMove().toArray();for(let i=0;i<30;i++){g.updatePlaying(1/120);g.updatePlaying(1/120);g.updateVisuals(1/60,1);}return {input,horizontalDistance:Math.hypot(g.playerPosition.x-before.x,g.playerPosition.z-before.z),state:g.state};});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.input.mobileMove.lengthSq()===0);await cdp.detach();
  assert.ok(movement.input[0]>.3&&movement.horizontalDistance>.1&&movement.state==='playing');
  const jumpStart=await page.evaluate(()=>window.__NESI_DEMO_GAME__.playerPosition.y);await page.tap('#jump-button');
  const jumpPeak=await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;let peak=g.playerPosition.y;for(let i=0;i<45;i++){g.updatePlaying(1/120);g.updatePlaying(1/120);g.updateVisuals(1/60,1);peak=Math.max(peak,g.playerPosition.y);}return peak;});assert.ok(jumpPeak>jumpStart+.2);
  await page.tap('#sprint-button');assert.equal(await page.evaluate(()=>window.__NESI_DEMO_GAME__.input.mobileSprint),true);await page.tap('#sprint-button');assert.equal(await page.evaluate(()=>window.__NESI_DEMO_GAME__.input.mobileSprint),false);
  await page.tap('.lab-mobile button[aria-label="Приостановить игру"]');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.state==='paused');await activate(page,'#resume-button',true);await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.state==='playing');
  await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop(null);g.render();});const filename=`mobile-${viewport.width}x${viewport.height}.png`;await page.screenshot({path:path.join(out,filename)});
  const oldSaves=await assertSaves(page,saves);return {pass:true,emulated:true,viewport,bounds,preparationFrames:preparation.frames,nativeE:{before:beforeE,after:afterE},movement,jumpStart,jumpPeak,sprintToggle:true,pauseResume:true,stickReleased:true,oldSaves,filename};
 }finally{await page.close();}
}
export async function runBrowserQA(){
 const identity=sourceIdentity(),{info,nativePackage}=checkBuild(),out=path.resolve(process.env.OUT_DIR||'qa/tower41-ratchet-browser'),base=process.env.PAGE_URL||'http://127.0.0.1:4173/',scenario=process.env.SCENARIO||'qualification';
 assert.ok(['qualification','held','fast-release','boarding'].includes(scenario));fs.mkdirSync(out,{recursive:true});
 const errors=[],shots=[],report={pass:false,level:41,...identity,scenario,nativePackage,errors,shots,limitations,fullTowerAccepted:false,fullCameraAccepted:false,humanPlaytestAccepted:false,physicalDeviceAccepted:false,publicationAccepted:false};
 const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');let server,browser,page;
 try{
  server=await startPreview(base);browser=await launchBrowser();page=await browser.newPage();page.setDefaultTimeout(180000);await page.setViewport({width:960,height:540,deviceScaleFactor:1});page.on('pageerror',e=>errors.push(String(e)));
  const saves=await seedSaves(page);await page.goto(reviewURL(base,{optIn:false}).href,{waitUntil:'domcontentloaded'});await waitMenu(page);
  report.defaultCastle=await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;return {cell:Boolean(g.firstLevel.ratchetCell),hook:typeof window.__NESI_RUN_TOWER41_RATCHET_ROUTE__,stages:g.firstLevel.totalStages,solved:g.firstLevel.getTowerMetrics().solvedIds};});assert.deepEqual(report.defaultCastle,{cell:false,hook:'undefined',stages:11,solved:[]});
  report.defaultOldSaves=await assertSaves(page,saves);
  await page.goto(reviewURL(base,{debug:false}).href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='ready');
  report.ordinaryFlagRejected=await page.evaluate(()=>typeof window.__NESI_DEMO_GAME__==='undefined'&&typeof window.__NESI_RUN_TOWER41_RATCHET_ROUTE__==='undefined');assert.equal(report.ordinaryFlagRejected,true);await assertSaves(page,saves);
  const url=reviewURL(base);report.start=await openQualification(page,url,info);
  await page.exposeFunction('__NESI_WRITE_RATCHET_SHOT__',(name,image,state)=>{assert.match(name,/^step-\d{2,}$/);assert.match(image,/^data:image\/jpeg;base64,/);const file=name+'.jpg',bytes=Buffer.from(image.slice(image.indexOf(',')+1),'base64');fs.writeFileSync(path.join(out,file),bytes);shots.push({file,bytes:bytes.length,sha256:sha256(bytes),...state});});
  report.observed=await page.evaluate(observeTower41Route,{scenario,record:false,stride:15,width:960,height:540});assertObservedRoute(report.observed,scenario);assert.ok(shots.length>=5);
  report.oldSaves=await assertSaves(page,saves);report.pauseResume=await pauseResume(page);
  // The resumed desktop can own pointer lock, so the next ordinary pause is
  // Escape. A HUD click is not a valid hit target while the canvas owns it.
  await page.bringToFront();await page.evaluate(()=>window.__NESI_DEMO_GAME__.renderer.setAnimationLoop(window.__NESI_DEMO_GAME__.animate));await page.keyboard.press('Escape');
  let restartPointerLockExitFallback=false;try{await page.waitForFunction(()=>!document.pointerLockElement,{timeout:5000});}catch(error){if(error.name!=='TimeoutError')throw error;await page.evaluate(()=>document.exitPointerLock());restartPointerLockExitFallback=true;}
  await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.state==='paused');await page.waitForFunction(()=>!document.pointerLockElement);
  report.restartPause={control:'native-escape',pointerLockExitFallback:restartPointerLockExitFallback,state:await page.evaluate(()=>window.__NESI_DEMO_GAME__.state)};
  await activate(page,'#restart-button');await page.waitForFunction(()=>window.__NESI_DEMO_GAME__.state==='playing');
  await page.evaluate(()=>window.__NESI_DEMO_GAME__.renderer.setAnimationLoop(null));
  report.restart=await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;return {atSpawn:g.playerPosition.distanceTo(g.firstLevel.spawn)<.5,solved:g.firstLevel.getTowerMetrics().solvedIds,checkpoints:g.firstLevel.getTowerMetrics().checkpoints,cell:Boolean(g.firstLevel.ratchetCell)};});assert.deepEqual(report.restart,{atSpawn:true,solved:[],checkpoints:false,cell:true});
  report.oldSavesAfterRestart=await assertSaves(page,saves);
  await page.reload({waitUntil:'domcontentloaded'});await waitMenu(page);report.reload=await page.evaluate(()=>({state:window.__NESI_DEMO_GAME__.state,solved:window.__NESI_DEMO_GAME__.firstLevel.getTowerMetrics().solvedIds,cell:Boolean(window.__NESI_DEMO_GAME__.firstLevel.ratchetCell)}));assert.deepEqual(report.reload,{state:'ready',solved:[],cell:true});await assertSaves(page,saves);await page.close();page=null;
  report.mobile=[];for(const viewport of [{width:390,height:844},{width:844,height:390}])report.mobile.push(await mobileReview(browser,url,info,out,viewport,errors));
  const pixelCode='import json,sys\nfrom PIL import Image,ImageStat\nr=[]\nfor p in sys.argv[1:]:\n im=Image.open(p).convert("RGB");v=max(ImageStat.Stat(im.resize((64,36))).stddev);assert v>2,(p,v);r.append({"file":p.split("/")[-1],"width":im.width,"height":im.height,"std":v})\nprint(json.dumps(r))';
  report.pixels=JSON.parse(execFileSync(process.env.CODEX_PRIMARY_RUNTIME_PYTHON||'python3',['-c',pixelCode,...shots.map(s=>path.join(out,s.file)),...report.mobile.map(m=>path.join(out,m.filename))],{encoding:'utf8'}));
  assert.deepEqual(errors,[]);report.pass=true;save();console.log('TOWER41_NATIVE',JSON.stringify({pass:true,scenario,frames:report.observed.frames,physicsSteps:report.observed.physicsSteps,shots:shots.length,fullTowerAccepted:false}));
 }catch(error){report.failure=String(error?.stack||error);report.detail=page?await page.evaluate(()=>window.__NESI_RATCHET_FAILURE__||null).catch(()=>null):null;save();throw error;}
 finally{await browser?.close();server?.kill();}
 return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await runBrowserQA();
