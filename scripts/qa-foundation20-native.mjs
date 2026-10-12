import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import puppeteer from 'puppeteer-core';
import {checkBuild,sourceIdentity} from './qa-tower41-ratchet-browser.mjs';
import {waitForStartMenu,playFromStartMenu,activate} from './lib/singularity-ui-check.mjs';
import {FOUNDATION20_PREFIX,FOUNDATION20_LEGACY_PREFIXES,assertFoundation20NativeReport} from './lib/foundation20-native-proof.mjs';
import {createNativePortalMaterialIdentityGuard} from './lib/native-portal-material-identity.mjs';

const out=path.resolve(process.env.OUT_DIR||'qa/foundation20-native');fs.mkdirSync(out,{recursive:true});
const fps=Number(process.env.CAPTURE_FPS||4),width=Number(process.env.CAPTURE_WIDTH||640),height=Number(process.env.CAPTURE_HEIGHT||360);
assert.ok([4,6,12,30,60].includes(fps));assert.ok([width,height].every(n=>Number.isInteger(n)&&n>=240&&n<=1920&&n%2===0));
const stride=60/fps,quality=process.env.GRAPHICS_PRESET||'low',routeOptions=JSON.parse(process.env.ROUTE_OPTIONS||'{}');
assert.ok(['low','balanced','high'].includes(quality));assert.equal(routeOptions.stopAt??null,null,'Native acceptance requires the complete ordinary route');
assert.equal(routeOptions.demonstrateLoadedHook??true,true,'The native route must demonstrate the same finite E before and after physical unloading');
const identity=sourceIdentity(),frozen=checkBuild(process.env.BUILD_DIR||'dist'),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const preferenceKey='brainrot-portal.preferences.v24',ownKey=FOUNDATION20_PREFIX+preferenceKey;
const legacyPrefixes=[...FOUNDATION20_LEGACY_PREFIXES],movie=path.join(out,'foundation20-physical.mp4'),telemetryFile=path.join(out,'foundation20-telemetry.jsonl');
fs.writeFileSync(telemetryFile,'');
const isolation={pass:false,namespace:FOUNDATION20_PREFIX,ownKey,legacyPrefixes,legacySnapshot:null,legacySnapshotSha256:null,phases:[],controls:{}};
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,protocolTimeout:5400000,
 args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
let page,encoder=null,encoderExit=null,count=0,first=null,last=null,lastVisualFrame=-1,terminalCaptured=false;
const errors=[];
const readPreferences=async()=>page.evaluate(({prefixes,key,preferenceKey})=>{
 const legacy=Object.fromEntries(Object.keys(localStorage).filter(k=>prefixes.some(p=>k.startsWith(p))).sort().map(k=>[k,localStorage.getItem(k)]));
 const raw=localStorage.getItem(key),own=raw?JSON.parse(raw):null,g=window.__NESI_DEMO_GAME__;
 return {url:location.href,pathname:location.pathname,search:location.search,hash:location.hash,state:document.documentElement.dataset.runtimeState,level:Number(document.documentElement.dataset.levelIndex)+1,
  edition:document.body.dataset.chamberEdition,entry:document.body.dataset.physicalReviewEntry,
  startChoices:[...document.querySelector('#level-select').options].map(o=>Number(o.value)),settingsChoices:[...document.querySelector('#settings-level-select').options].map(o=>Number(o.value)),
  editionNavigationPresent:Boolean(document.querySelector('.edition-navigation')),editionNavigationAnchors:[...document.querySelectorAll('.edition-navigation a')].map(a=>a.getAttribute('href')),debugGameHook:typeof window.__NESI_DEMO_GAME__,debugPreferencesHook:typeof window.__NESI_PREFS__,debugRouteHook:typeof window.__NESI_RUN_FOUNDATION20_PHYSICAL_ROUTE__,
  legacy,ownRaw:raw,own,namespaceUsed:g?window.__NESI_PREFS__?.storage?.getItem(preferenceKey)===raw:null};
},{prefixes:legacyPrefixes,key:ownKey,preferenceKey});
async function phase(name){
 const r=await readPreferences();assert.deepEqual(r.legacy,isolation.legacySnapshot,'Preserve every pre-existing save byte during '+name);
 assert.ok(r.ownRaw);assert.equal(r.namespaceUsed,true);assert.equal(r.level,20);assert.equal(r.edition,'foundation');assert.equal(r.entry,'foundation20-physical-v1');
 assert.deepEqual(r.startChoices,[19]);assert.deepEqual(r.settingsChoices,[19]);assert.equal(r.editionNavigationPresent,false);
 const p={phase:name,state:r.state,level:r.level,edition:r.edition,entry:r.entry,startChoices:r.startChoices,settingsChoices:r.settingsChoices,
  editionNavigationPresent:r.editionNavigationPresent,editionNavigationAnchors:r.editionNavigationAnchors,oldBytesUnchanged:true,legacySnapshotSha256:hash(JSON.stringify(r.legacy)),namespaceUsed:true,
  ownPreferencesSha256:hash(r.ownRaw),ownCompleted:r.own.completed,ownResumeLevel:r.own.resumeLevel,ownQuality:r.own.quality};
 isolation.phases.push(p);return p;
}
async function changeSettings(){
 await activate(page,'#menu-settings-button');await page.waitForFunction(()=>document.querySelector('#menu-settings').open);
 const before=await readPreferences(),alternate=before.own.quality==='low'?'balanced':'low';await page.select('#menu-quality',alternate);
 const changed=await readPreferences();assert.equal(changed.own.quality,alternate);assert.deepEqual(changed.legacy,isolation.legacySnapshot);
 await page.select('#menu-quality',before.own.quality);await activate(page,'#menu-settings-done');await page.waitForFunction(()=>!document.querySelector('#menu-settings').open);
 const restored=await readPreferences();assert.equal(restored.ownRaw,before.ownRaw);assert.deepEqual(restored.legacy,isolation.legacySnapshot);
 return {control:'native-menu-quality-select',changedTo:alternate,restoredTo:before.own.quality,beforeSha256:hash(before.ownRaw),changedSha256:hash(changed.ownRaw),restoredSha256:hash(restored.ownRaw)};
}
try{
 page=await browser.newPage();page.setDefaultTimeout(180000);await page.setViewport({width,height,deviceScaleFactor:1});
 page.on('pageerror',error=>errors.push(String(error)));page.on('error',error=>errors.push('Renderer: '+String(error)));
 await page.evaluateOnNewDocument(({prefixes,key,preferenceKey,quality})=>{
  for(const prefix of prefixes)if(localStorage.getItem(prefix+preferenceKey)===null){
   const peer=prefix==='brainrot-tower41-native-v3:';
   localStorage.setItem(prefix+preferenceKey,JSON.stringify({quality:'balanced',volume:.65,muted:true,tutorial:true,resumeLevel:prefix.includes('tower41-native')?40:42,
    completed:prefix.includes('tower41-native')?[40]:[0,1,42],hints:peer?{}:{42:2},
    campaignRevision:peer?'tower41-native-v3':'creative-campaign-v48',roomRevisions:peer?{}:{16:'cable-supported-architecture-v1',32:'siphon-observatory-v1',50:'echo-horizon-v1'}}));
  }
  if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify({quality,volume:.65,muted:true,tutorial:true,resumeLevel:19,completed:[],hints:{},campaignRevision:'foundation20-physical-v1',roomRevisions:{}}));
  window.__FOUNDATION20_INITIAL_LEGACY_SAVES__=Object.fromEntries(Object.keys(localStorage).filter(k=>prefixes.some(p=>k.startsWith(p))).sort().map(k=>[k,localStorage.getItem(k)]));
 },{prefixes:legacyPrefixes,key:ownKey,preferenceKey,quality});
 const base=new URL(process.env.PAGE_URL||'http://127.0.0.1:4173/brainrot-portal/foundation20-physical-v1/');
 assert.match(base.pathname,/\/(?:brainrot-portal\/)?foundation20-physical-v1\/?(?:index\.html)?$/,'Review the actual dedicated Foundation20 entry');
 base.search='';base.hash='';await page.goto(base.href,{waitUntil:'domcontentloaded'});await waitForStartMenu(page);
 const bare=await readPreferences();assert.equal(bare.url,base.href);assert.equal(bare.search,'');
 const beforeBareApplication=await page.evaluate(()=>window.__FOUNDATION20_INITIAL_LEGACY_SAVES__);
 assert.deepEqual(bare.legacy,beforeBareApplication,'The first bare entry must preserve every sentinel byte written before application startup');
 isolation.legacySnapshot=beforeBareApplication;isolation.legacySnapshotSha256=hash(JSON.stringify(beforeBareApplication));
 for(const prefix of legacyPrefixes)assert.equal(typeof bare.legacy[prefix+preferenceKey],'string');
 const settings=await changeSettings();isolation.bareEntry={pass:true,applicable:true,url:bare.url,pathname:bare.pathname,search:bare.search,hash:bare.hash,state:bare.state,level:bare.level,edition:bare.edition,entry:bare.entry,
  startChoices:bare.startChoices,settingsChoices:bare.settingsChoices,editionNavigationPresent:bare.editionNavigationPresent,editionNavigationAnchors:bare.editionNavigationAnchors,
  debugGameHook:bare.debugGameHook,debugPreferencesHook:bare.debugPreferencesHook,debugRouteHook:bare.debugRouteHook,
  legacySnapshotSha256:isolation.legacySnapshotSha256,oldBytesUnchanged:true,ownKey,ownPreferencesSha256:settings.restoredSha256,settings};
 const url=new URL(base);url.searchParams.set('debug','1');isolation.playerURL=base.href;isolation.reviewURL=url.href;
 await page.goto(url.href,{waitUntil:'domcontentloaded'});await waitForStartMenu(page);await phase('after-load');
 const info=await page.evaluate(async()=>{const r=await fetch('build-info.json',{cache:'no-store'});if(!r.ok)throw Error('Missing build identity');return r.json();});
 assert.equal(info.commit,identity.sourceCommit);assert.deepEqual(info,frozen.info);
 isolation.controls.settings=await changeSettings();await phase('after-settings');
 await playFromStartMenu(page,false,quality);await page.evaluate(()=>window.__NESI_DEMO_GAME__.renderer.setAnimationLoop(null));await phase('after-play');
 // Observe native pause/resume controls before the separate uninterrupted route.
 await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop(g.animate);});await page.keyboard.press('Escape');
 let pointerLockExitFallback=false;
 try{await page.waitForFunction(()=>!document.pointerLockElement,{timeout:5000});}catch(e){if(e.name!=='TimeoutError')throw e;await page.evaluate(()=>document.exitPointerLock());pointerLockExitFallback=true;}
 if(await page.evaluate(()=>window.__NESI_DEMO_GAME__.state==='playing'))await activate(page,'#pause-button');
 await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='paused');await page.waitForFunction(()=>{const s=document.querySelector('#pause-screen');return !s.inert&&getComputedStyle(s).opacity==='1';});await phase('after-pause');
 await page.focus('#resume-button');await page.keyboard.press('Enter');await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='playing');
 await page.evaluate(()=>window.__NESI_DEMO_GAME__.renderer.setAnimationLoop(null));await phase('after-resume');
 isolation.controls.pauseResume={pass:true,pauseControl:'native-escape-or-hud',resumeControl:'focused-native-enter',pointerLockExitFallback};
 assert.deepEqual(await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;return {edition:g.chamberEdition,index:g.levelIndex,id:g.firstLevel.id,creativeEarly:g.firstLevel.creativeEarly};}),{edition:'foundation',index:19,id:'foundation-portal-tension',creativeEarly:20});
 assert.deepEqual(await page.evaluate(()=>{const c=window.__NESI_DEMO_GAME__.renderer.domElement;return {width:c.width,height:c.height};}),{width,height});
 encoder=spawn('ffmpeg',['-y','-hide_banner','-loglevel','error','-f','image2pipe','-vcodec','mjpeg','-framerate',String(fps),'-i','pipe:0','-an','-c:v','libx264','-preset','veryfast','-crf','25','-pix_fmt','yuv420p','-movflags','+faststart',movie],{stdio:['pipe','ignore','pipe']});
 encoder.stderr.on('data',bytes=>process.stderr.write(bytes));encoderExit=once(encoder,'exit');
 await page.exposeFunction('__FOUNDATION20_WRITE__',async batch=>{
  for(const f of batch){
   assert.equal(f.index,count);assert.equal(terminalCaptured,false);
   if(f.terminal){assert.equal(f.state.state,'won');assert.ok(f.visualFrame>lastVisualFrame&&f.visualFrame<count*stride&&count*stride-f.visualFrame<stride);terminalCaptured=true;}
   else assert.equal(f.visualFrame,count*stride);
   assert.match(f.jpeg,/^data:image\/jpeg;base64,/);const bytes=Buffer.from(f.jpeg.slice(f.jpeg.indexOf(',')+1),'base64');
   assert.equal(bytes[0],255);assert.equal(bytes[1],216);assert.equal(bytes.at(-2),255);assert.equal(bytes.at(-1),217);
   lastVisualFrame=f.visualFrame;first??=f.state;last=f.state;fs.appendFileSync(telemetryFile,JSON.stringify({index:count,terminal:f.terminal,state:f.state})+'\n');
   if(!encoder.stdin.write(bytes))await once(encoder.stdin,'drain');count++;
  }
  if(count%120===0)console.log('FOUNDATION20_CAPTURE',count/fps,'seconds',last?.rope?.opening);
 });
 const native=await page.evaluate(async({stride,width,height,routeOptions,materialGuardSource})=>{
  const g=window.__NESI_DEMO_GAME__,body=g.physics.cargoBody.id,observed={samples:0,bodyId:body,originalIdentityFailures:0,slackSamples:0,slackNonzeroForceSamples:0,
   completedPostSteps:0,forceSamples:0,postStepsStart:g.physics.world.stepnumber,postStepsFinish:g.physics.world.stepnumber,
   maxEndpointMagnitudeError:0,maxCouplingPower:-Infinity,retainingContactSamples:0,maxRetainingForce:0},milestones=[];
  let batch=[],encoded=0,lastCaptured=-1,lastState=null;
  const refs={player:g.playerGroup,visual:g.playerVisual,animator:g.animator,weapon:g.weapon,device:g.heldDevice,
   cargo:g.cargo,body:g.physics.cargoBody,cargoGroup:g.cargo.group,cargoVisual:g.cargo.visual,companionAnimator:g.companionAnimator,companionRig:g.companionRig};
  const cargoShapes=refs.body.shapes.slice();
  if(cargoShapes.length!==1||!cargoShapes[0].halfExtents||['x','y','z'].some(axis=>cargoShapes[0].halfExtents[axis]!==.39))throw Error('The original single .78m cargo Box is required');
  const models=[['player',refs.visual],['weapon',refs.weapon],['cargo',refs.cargoVisual]],rows=[],bones=new Set();
  for(const [role,root]of models)root.traverse(mesh=>{if(!mesh.isMesh)return;
   const geometry=mesh.geometry,attributes=Object.entries(geometry.attributes).map(([name,attribute])=>({name,attribute,array:attribute.array??attribute.data?.array,count:attribute.count,itemSize:attribute.itemSize,normalized:attribute.normalized}));
   if(geometry.index)attributes.push({name:'$index',attribute:geometry.index,array:geometry.index.array,count:geometry.index.count,itemSize:geometry.index.itemSize,normalized:geometry.index.normalized});
   if(attributes.some(a=>!ArrayBuffer.isView(a.array)))throw Error('Actual typed geometry required');
   const skeleton=mesh.skeleton,skeletonBones=skeleton?.bones.slice()??[];if(role==='player')skeletonBones.forEach(b=>bones.add(b));
   rows.push({role,mesh,geometry,attributes,skeleton,skeletonBones,material:mesh.material,vertices:geometry.attributes.position.count});
  });
  const playerVertices=rows.filter(r=>r.role==='player').reduce((n,r)=>n+r.vertices,0);
  if(playerVertices!==96753||bones.size!==15||refs.body.mass!==3.2)throw Error('All original player vertices/bones and original cargo required');
  const materialGuard=(0,eval)('('+materialGuardSource+')')(g,rows);
  const animatorBones=refs.animator.bones,animatorEntries=Object.entries(animatorBones);if(animatorEntries.length!==15||animatorEntries.some(([,b])=>!bones.has(b)))throw Error('Actual original animator skeleton required');
  const liveIdentity=()=>{
   if(g.playerGroup!==refs.player||g.playerVisual!==refs.visual||g.animator!==refs.animator||g.weapon!==refs.weapon||g.heldDevice!==refs.device||g.cargo!==refs.cargo||g.physics.cargoBody!==refs.body||g.cargo.group!==refs.cargoGroup||g.cargo.visual!==refs.cargoVisual||g.companionAnimator!==refs.companionAnimator||g.companionRig!==refs.companionRig)throw Error('Original avatar, weapon or companion was replaced');
   if(refs.body.mass!==3.2||refs.body.type!==1||refs.body.world!==g.physics.world||!g.physics.world.bodies.includes(refs.body)||refs.body.shapes.length!==cargoShapes.length||cargoShapes.some((shape,i)=>refs.body.shapes[i]!==shape)||['x','y','z'].some(axis=>cargoShapes[0].halfExtents[axis]!==.39))throw Error('Original cargo physical shape/world ownership changed');
   if(refs.animator.bones!==animatorBones||Object.keys(animatorBones).length!==15||animatorEntries.some(([name,b])=>animatorBones[name]!==b))throw Error('Original animated skeleton replaced');
   for(const [role,root]of models){const current=[];root.traverse(m=>{if(m.isMesh)current.push(m);});const expected=rows.filter(r=>r.role===role);if(current.length!==expected.length||current.some(m=>!expected.some(r=>r.mesh===m)))throw Error('Original model mesh membership changed');}
   for(const r of rows){
    if(r.mesh.geometry!==r.geometry||r.mesh.skeleton!==r.skeleton||r.skeletonBones.length!==(r.skeleton?.bones.length??0)||r.skeletonBones.some((b,i)=>r.skeleton.bones[i]!==b))throw Error('Original mesh geometry/skin replaced');
    if(Object.keys(r.geometry.attributes).length!==r.attributes.filter(a=>a.name!=='$index').length)throw Error('Original attribute membership changed');
    for(const a of r.attributes){const current=a.name==='$index'?r.geometry.index:r.geometry.attributes[a.name];if(current!==a.attribute||(current.array??current.data?.array)!==a.array||current.count!==a.count||current.itemSize!==a.itemSize||current.normalized!==a.normalized)throw Error('Original geometry buffer replaced');}
   }
   materialGuard.assertMaterials();
  };
  const appearanceHash=async()=>{
   liveIdentity();const step=g.physics.world.stepnumber,entries=[];
   for(const [index,r]of rows.entries())for(const a of r.attributes){
    const bytes=new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength),digest=await crypto.subtle.digest('SHA-256',bytes);
    entries.push({role:r.role,meshIndex:index,name:a.name,count:a.count,itemSize:a.itemSize,normalized:a.normalized,bytes:bytes.byteLength,sha256:[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('')});
   }
   liveIdentity();if(g.physics.world.stepnumber!==step)throw Error('Appearance hashing advanced physics');
   const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(entries)));return [...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
  };
  const initialGeometrySha256=await appearanceHash();
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{alpha:false});
  const capture=(state,terminal=false)=>{
   if(g.renderer.domElement.width!==width||g.renderer.domElement.height!==height)throw Error('Actual production canvas dimensions changed');
   g.render();materialGuard.assertMaterials();ctx.drawImage(g.renderer.domElement,0,0);batch.push({index:encoded++,visualFrame:state.visualFrame,terminal,state,jpeg:canvas.toDataURL('image/jpeg',.83)});lastCaptured=state.visualFrame;
  };
  const magnitude=v=>v?Math.hypot(...v):0;
  const physicsObserver=()=>{
   const step=g.physics.world.stepnumber;if(step!==observed.postStepsFinish+1)throw Error('Actual ordinary physics clock skipped a postStep');
   observed.postStepsFinish=step;observed.completedPostSteps++;observed.forceSamples++;
   const d=g.firstLevel.nearHook.diagnostics(),force=d.lastCableForce,far=g.firstLevel.stopFinger.diagnostics();
   if(force?.slack){observed.slackSamples++;if(d.tension!==0||magnitude(force.nearForce)!==0||magnitude(force.farForce)!==0)observed.slackNonzeroForceSamples++;}
   if(force?.nearForce&&force?.farForce)observed.maxEndpointMagnitudeError=Math.max(observed.maxEndpointMagnitudeError,Math.abs(magnitude(force.nearForce)-magnitude(force.farForce)));
   if(Number.isFinite(d.slip?.lastForce?.totalCouplingPower))observed.maxCouplingPower=Math.max(observed.maxCouplingPower,d.slip.lastForce.totalCouplingPower);
   if(d.tension===0&&far.retainingContacts>0){observed.retainingContactSamples++;observed.maxRetainingForce=Math.max(observed.maxRetainingForce,far.retainingForce);}
  };
  g.physics.world.addEventListener('postStep',physicsObserver);
  window.__NESI_CAPTURE_FOUNDATION20_MARK__=mark=>milestones.push({...mark,encodedFrame:Math.max(0,encoded-1)});
  window.__FOUNDATION20_FRAME__=async state=>{
   observed.samples++;lastState=state;liveIdentity();
   if(state.cargoBodyId!==body||state.cargoMass!==3.2||state.cargoDynamic!==true)observed.originalIdentityFailures++;
   if(state.visualFrame%stride===0)capture(state);
  };
  window.__FOUNDATION20_FLUSH__=async()=>{if(batch.length){const pending=batch;batch=[];await window.__FOUNDATION20_WRITE__(pending);}};
  try{
   const route=await window.__NESI_RUN_FOUNDATION20_PHYSICAL_ROUTE__(routeOptions);
   if(lastCaptured<route.frames-1)capture(lastState,true);
   await window.__FOUNDATION20_FLUSH__();const finalGeometrySha256=await appearanceHash();if(finalGeometrySha256!==initialGeometrySha256)throw Error('Original geometry bytes changed during ordinary route');
   observed.modelIdentity={pass:true,playerVertices,bones:bones.size,cargoMass:refs.body.mass,cargoBodyId:body,cargoShapeId:cargoShapes[0].id,cargoHalfExtents:[.39,.39,.39],sameOriginalCargoShape:true,playerRootUuid:refs.player.uuid,playerVisualUuid:refs.visual.uuid,cargoUuid:refs.cargoGroup.uuid,cargoVisualUuid:refs.cargoVisual.uuid,weaponUuid:refs.weapon.uuid,
    sameOriginalActorReferences:true,sameOriginalSkins:true,sameOriginalCargoVisual:true,sameOriginalWeapon:true,observedVisualFrames:observed.samples,initialGeometrySha256,finalGeometrySha256,
    materialIdentity:materialGuard.diagnostics(),
    scope:'Actual original avatar including its authored backpack, original weapon and companion mesh/skin/attribute references on every route frame; all original geometry bytes hashed before/after. No lens acceptance is inferred.'};
   return {route,observed,milestones,encodedFrames:encoded};
  }catch(e){window.__FOUNDATION20_FAILURE__={error:String(e),route:e.foundation20Report,observed,milestones,lastState};throw e;}
  finally{g.physics.world.removeEventListener('postStep',physicsObserver);await window.__FOUNDATION20_FLUSH__();delete window.__FOUNDATION20_FRAME__;delete window.__FOUNDATION20_FLUSH__;delete window.__NESI_CAPTURE_FOUNDATION20_MARK__;}
 },{stride,width,height,routeOptions,materialGuardSource:createNativePortalMaterialIdentityGuard.toString()});
 encoder.stdin.end();const [code]=await encoderExit;encoder=null;assert.equal(code,0);assert.equal(count,native.encodedFrames);assert.equal(last.state,'won');
 const metadata=JSON.parse(execFileSync('ffprobe',['-v','quiet','-show_streams','-show_format','-of','json',movie],{encoding:'utf8'}));
 const pixels=path.join(out,'foundation20-native-pixels.log');assert.match(pixels,/^[A-Za-z0-9_./-]+$/);
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-xerror','-i',movie,'-vf',`scale=160:90,signalstats,metadata=mode=print:file=${pixels}`,'-f','null','-'],{timeout:300000,stdio:'inherit'});
 const pixelText=fs.readFileSync(pixels,'utf8'),minima=[...pixelText.matchAll(/lavfi\.signalstats\.YMIN=(\d+)/g)].map(m=>Number(m[1])),maxima=[...pixelText.matchAll(/lavfi\.signalstats\.YMAX=(\d+)/g)].map(m=>Number(m[1]));
 assert.equal(minima.length,count);assert.equal(maxima.length,count);const ranges=maxima.map((v,i)=>v-minima[i]);assert.ok(ranges.every(v=>v>12));
 const won=await phase('after-win');assert.equal(won.state,'won');
 const label=await page.$eval('#play-again-button',button=>button.textContent);assert.match(label,/Пройти ещё раз/);await activate(page,'#play-again-button');
 await page.waitForFunction(()=>document.documentElement.dataset.runtimeState==='playing');await page.evaluate(()=>window.__NESI_DEMO_GAME__.renderer.setAnimationLoop(null));await phase('after-replay');
 const replay=await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__,spawn=g.firstLevel.spawn.toArray?.()??g.firstLevel.spawn;return {atSpawn:Math.hypot(...g.playerPosition.toArray().map((n,i)=>n-spawn[i]))<.5,opening:g.firstLevel.rope.opening,handCount:g.firstLevel.nearHook.diagnostics().handCount};});
 assert.equal(replay.atSpawn,true);assert.ok(Math.abs(replay.opening)<.01);assert.equal(replay.handCount,0);isolation.controls.replay={pass:true,button:'#play-again-button',label,...replay};
 await page.reload({waitUntil:'domcontentloaded'});await waitForStartMenu(page);const reload=await phase('after-reload');assert.equal(reload.state,'ready');isolation.controls.reload={pass:true,state:reload.state,level:reload.level,completed:reload.ownCompleted,resumeLevel:reload.ownResumeLevel};
 const own20=(await readPreferences()).ownRaw,peerURL=new URL(base);peerURL.pathname=peerURL.pathname.replace('foundation20-physical-v1','tower41-native-v3');
 await page.goto(peerURL.href,{waitUntil:'domcontentloaded'});await waitForStartMenu(page);const peer=await readPreferences();
 const peerInfo=await page.evaluate(async()=>{const r=await fetch('build-info.json',{cache:'no-store'});if(!r.ok)throw Error('Missing peer build identity');return r.json();});assert.deepEqual(peerInfo,frozen.info);
 assert.equal(peer.ownRaw,own20);assert.deepEqual(peer.legacy,isolation.legacySnapshot);assert.equal(peer.level,41);assert.equal(peer.entry,'tower41-native-v3');assert.deepEqual(peer.startChoices,[40]);assert.deepEqual(peer.settingsChoices,[40]);
 for(const name of ['debugGameHook','debugPreferencesHook','debugRouteHook'])assert.equal(peer[name],'undefined');
 await page.reload({waitUntil:'domcontentloaded'});await waitForStartMenu(page);const peerReload=await readPreferences();assert.equal(peerReload.ownRaw,own20);assert.deepEqual(peerReload.legacy,isolation.legacySnapshot);assert.equal(peerReload.level,41);assert.equal(peerReload.entry,'tower41-native-v3');assert.equal(peerReload.state,'ready');
 isolation.crossEntry={pass:true,url:peer.url,entry:peer.entry,level:peer.level,state:peer.state,startChoices:peer.startChoices,settingsChoices:peer.settingsChoices,
  debugGameHook:peer.debugGameHook,debugPreferencesHook:peer.debugPreferencesHook,debugRouteHook:peer.debugRouteHook,
  own20BytesUnchanged:true,peerBytesUnchanged:true,reloadVerified:true,legacySnapshotSha256:hash(JSON.stringify(peerReload.legacy)),own20Sha256:hash(own20),sourceCommit:peerInfo.commit};
 isolation.pass=true;
 const movieBytes=fs.readFileSync(movie),telemetryBytes=fs.readFileSync(telemetryFile);
 const report={pass:true,...identity,nativePackage:frozen.nativePackage,buildInfo:info,routeOptions,graphicsPreset:quality,route:native.route,observed:native.observed,milestones:native.milestones,
  saveIsolation:isolation,capture:{method:'continuous production WebGL canvas readback at actual ordinary route frame intervals',fps,stride,width,height},
  video:{filename:path.basename(movie),bytes:movieBytes.length,sha256:hash(movieBytes),frames:count,fps,stride,width,height,durationSeconds:count/fps,simulationSeconds:native.route.seconds,
   terminalSample:terminalCaptured,lastVisualFrame,first,last,fullMP4Decode:true,pixelCheck:{frames:count,allNonblank:true,minimumLuminanceRange:Math.min(...ranges),method:'Full MP4 decoded with FFmpeg -xerror; every frame YMAX−YMIN >12 at 160×90',logFilename:path.basename(pixels),logBytes:Buffer.byteLength(pixelText),logSha256:hash(pixelText)}},
  telemetry:{filename:path.basename(telemetryFile),bytes:telemetryBytes.length,sha256:hash(telemetryBytes),samples:count,scope:'Every actual encoded native frame, including a final off-stride real won sample'},
  errors,publicationAccepted:false,humanPlaytest:false,hardwareFPSMeasured:false,
  method:'One continuous automatic route using ordinary movement, look, portal charges and finite E impulses in the production build; no actor placement, puzzle flags, reset or padded frames.'};
 assertFoundation20NativeReport(report,{sourceCommit:identity.sourceCommit,sourceReview:identity.sourceReview,nativePackage:frozen.nativePackage,movieMetadata:metadata});
 fs.writeFileSync(path.join(out,'foundation20-native-report.json'),JSON.stringify(report,null,2)+'\n');console.log('FOUNDATION20_NATIVE_VERIFIED',identity.sourceCommit,native.route.seconds,count,report.video.sha256);
}catch(error){
 const detail=page?await page.evaluate(()=>window.__FOUNDATION20_FAILURE__??null).catch(()=>null):null;
 fs.writeFileSync(path.join(out,'foundation20-native-failure.json'),JSON.stringify({pass:false,...identity,error:String(error),detail,saveIsolation:isolation,errors,capturedFrames:count},null,2)+'\n');throw error;
}finally{if(encoder){encoder.stdin.end();await encoderExit.catch(()=>{});}await browser.close();}
