import {SECOND_CHAPTER_EARLY_ATTACKS,observeSecondChapterEarlyAttack,assertSecondChapterEarlyAttacks} from './second-chapter-early-attacks.mjs';
import {SECOND_CHAPTER_LATE_ATTACKS,runSecondChapterLateAttack,assertSecondChapterLateAttacks} from './second-chapter-late-attacks.mjs';
import {runV8Journey} from '../../src/game/LabV8Journey.js';
import {createNativePortalMaterialIdentityGuard} from './native-portal-material-identity.mjs';

export const SECOND_CHAPTER_ATTACK_HARNESS_FILES=Object.freeze([
 'scripts/qa-second-chapter-attacks-browser.mjs','scripts/lib/second-chapter-attack-browser.mjs',
 'scripts/lib/second-chapter-early-attacks.mjs','scripts/lib/second-chapter-late-attacks.mjs',
 'scripts/lib/native-portal-material-identity.mjs','scripts/lib/singularity-ui-check.mjs',
 'scripts/qa-second-chapter-native.mjs','scripts/lib/second-chapter-native-proof.mjs',
 'scripts/lib/release-manifest.mjs','scripts/lib/frozen-campaign-server.mjs',
 'tests/second-chapter-attacks-browser.test.js',
]);
const need=(value,message)=>{if(!value)throw Error('Second-chapter browser attacks: '+message);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const integer=(value,min=0,max=100000000)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
// Provider identifiers are opaque positive safe integers, not frame/byte
// counters. GitHub's real run IDs already exceed the simulation's 1e8 cap.
const runInteger=value=>integer(value,1,Number.MAX_SAFE_INTEGER);
const SCOPES=Object.freeze({sourceCiAccepted:false,nativeAccepted:false,publicationAccepted:false,fullChapterAccepted:false,humanAccepted:false,allBypassesAccepted:false});

export function secondChapterAttackCatalogue(group){
 need(group==='early'||group==='later','exact early/later group required');
 return group==='early'?SECOND_CHAPTER_EARLY_ATTACKS.map(a=>({caseId:a.name,index:a.level-1})):SECOND_CHAPTER_LATE_ATTACKS.map(a=>({caseId:a.id,index:a.index}));
}

/** Read-only normal-spawn comparison for the actual level definitions, which
 * use arrays, and for callers holding the equivalent THREE.Vector3 values.
 * Keep this function closure-free: the UI observer transfers its exact code
 * into the page before loading the attack harness. */
export function readSecondChapterAttackStart(g){
 const coordinates=value=>{const a=value?.toArray?.()??value;return Array.isArray(a)?a.slice():null;};
 const valid=a=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite);
 const playerPosition=coordinates(g.playerPosition),cargoPosition=coordinates(g.cargo.position),expectedPlayerSpawn=coordinates(g.firstLevel.spawn),expectedCargoSpawn=coordinates(g.firstLevel.cargoSpawn);
 const distance=(actual,expected)=>valid(actual)&&valid(expected)?Math.hypot(...actual.map((n,i)=>n-expected[i])):null;
 const playerSpawnDistance=distance(playerPosition,expectedPlayerSpawn),cargoSpawnDistance=distance(cargoPosition,expectedCargoSpawn);
 return{playerPosition,cargoPosition,expectedPlayerSpawn,expectedCargoSpawn,playerSpawnDistance,cargoSpawnDistance,
  normalSpawn:playerSpawnDistance!==null&&playerSpawnDistance<1e-8,normalCargoSpawn:cargoSpawnDistance!==null&&cargoSpawnDistance<1e-8};
}

/** Read-only handles and byte identity. This is shared by every browser case;
 * the production driver independently checks the original cargo each frame. */
export function createSecondChapterAttackOriginalGuard(g){
 const refs={level:g.firstLevel,camera:g.camera,cameraRig:g.cameraRig,cameraRigUpdate:g.cameraRig.update,cameraRigReset:g.cameraRig.reset,renderer:g.renderer,canvas:g.renderer.domElement,player:g.playerGroup,visual:g.playerVisual,animator:g.animator,weapon:g.weapon,device:g.heldDevice,
  cargo:g.cargo,body:g.physics.cargoBody,cargoGroup:g.cargo.group,cargoVisual:g.cargo.visual,companionAnimator:g.companionAnimator,companionRig:g.companionRig};
 const world=g.physics.world,shape=refs.body.shapes[0],models=[['player',refs.visual],['weapon',refs.weapon],['cargo',refs.cargoVisual]],rows=[],bones=new Set();
 for(const[role,root]of models)root.traverse(mesh=>{if(!mesh.isMesh)return;const geometry=mesh.geometry,attributes=Object.entries(geometry.attributes).map(([name,attribute])=>({name,attribute,array:attribute.array??attribute.data?.array,count:attribute.count,itemSize:attribute.itemSize,normalized:attribute.normalized}));if(geometry.index)attributes.push({name:'$index',attribute:geometry.index,array:geometry.index.array,count:geometry.index.count,itemSize:geometry.index.itemSize,normalized:geometry.index.normalized});need(attributes.every(a=>ArrayBuffer.isView(a.array)),'actual authored typed geometry');const skeleton=mesh.skeleton,skeletonBones=skeleton?.bones.slice()??[];if(role==='player')skeletonBones.forEach(b=>bones.add(b));rows.push({role,mesh,geometry,attributes,skeleton,skeletonBones,material:mesh.material,vertices:geometry.attributes.position.count});});
 const playerVertices=rows.filter(r=>r.role==='player').reduce((n,r)=>n+r.vertices,0),animatorBones=refs.animator.bones,animatorEntries=Object.entries(animatorBones),lens={near:g.camera.near,far:g.camera.far,aspect:g.camera.aspect,zoom:g.camera.zoom};
 need(playerVertices===96753&&bones.size===15&&animatorEntries.length===15&&animatorEntries.every(([,b])=>bones.has(b)),'original96753/15 player');
 const materials=createNativePortalMaterialIdentityGuard(g,rows);let checks=0;
 const live=()=>{
  checks++;
  need(g.firstLevel===refs.level&&g.playerGroup===refs.player&&g.playerVisual===refs.visual&&g.animator===refs.animator&&g.weapon===refs.weapon&&g.heldDevice===refs.device&&g.cargo===refs.cargo&&g.physics.cargoBody===refs.body&&g.cargo.group===refs.cargoGroup&&g.cargo.visual===refs.cargoVisual&&g.companionAnimator===refs.companionAnimator&&g.companionRig===refs.companionRig,'original actor handles changed');
  need(refs.body.world===world&&world.bodies.includes(refs.body)&&refs.body.mass===3.2&&refs.body.type===1&&refs.body.shapes.length===1&&refs.body.shapes[0]===shape&&['x','y','z'].every(k=>shape.halfExtents[k]===.39),'original dynamic cargo shape changed');
  need(g.camera===refs.camera&&g.cameraRig===refs.cameraRig&&g.cameraRig.camera===refs.camera&&g.cameraRig.update===refs.cameraRigUpdate&&g.cameraRig.reset===refs.cameraRigReset&&g.renderer===refs.renderer&&g.renderer.domElement===refs.canvas&&Object.entries(lens).every(([k,v])=>g.camera[k]===v)&&Number.isFinite(g.camera.fov)&&g.camera.fov>0&&g.camera.fov<179,'production camera, renderer or rig changed');
  need(refs.animator.bones===animatorBones&&Object.keys(animatorBones).length===15&&animatorEntries.every(([name,b])=>animatorBones[name]===b),'original animator skeleton changed');
  for(const[role,root]of models){const meshes=[];root.traverse(m=>{if(m.isMesh)meshes.push(m);});const expected=rows.filter(r=>r.role===role);need(meshes.length===expected.length&&meshes.every(m=>expected.some(r=>r.mesh===m)),'original model membership changed');}
  for(const r of rows){need(r.mesh.geometry===r.geometry&&r.mesh.skeleton===r.skeleton&&r.skeletonBones.length===(r.skeleton?.bones.length??0)&&r.skeletonBones.every((b,i)=>r.skeleton.bones[i]===b),'original geometry/skin changed');need(Object.keys(r.geometry.attributes).length===r.attributes.filter(a=>a.name!=='$index').length,'authored attribute membership changed');for(const a of r.attributes){const current=a.name==='$index'?r.geometry.index:r.geometry.attributes[a.name];need(current===a.attribute&&(current.array??current.data?.array)===a.array&&current.count===a.count&&current.itemSize===a.itemSize&&current.normalized===a.normalized,'original typed geometry replaced');}}
  materials.assertMaterials();
 };
 const sha=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
 const appearanceHash=async()=>{live();const step=world.stepnumber,entries=[];for(const[index,r]of rows.entries())for(const a of r.attributes){const bytes=new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength);entries.push({role:r.role,meshIndex:index,name:a.name,count:a.count,itemSize:a.itemSize,normalized:a.normalized,bytes:bytes.byteLength,sha256:await sha(bytes)});}live();need(world.stepnumber===step,'geometry hashing advanced physics');return sha(new TextEncoder().encode(JSON.stringify(entries)));};
 return{refs,world,shape,live,appearanceHash,diagnostics:()=>({playerVertices,playerBones:bones.size,cargoMass:refs.body.mass,cargoHalfExtents:[.39,.39,.39],bodyId:refs.body.id,shapeId:shape.id,
  sameOriginalActorHandles:true,sameOriginalBuffers:true,sameOriginalCargoShape:true,identityChecks:checks,materialIdentity:materials.diagnostics()})};
}

/** Bundled from the frozen source, with ONLY runV8Journey externalized to the
 * exact compiled production package URL. No source code is served as a game. */
export async function observeSecondChapterBrowserAttack({group,caseId,capture={width:640,height:360}}){
 const catalogue=secondChapterAttackCatalogue(group),item=catalogue.find(a=>a.caseId===caseId),g=window.__NESI_DEMO_GAME__;
 need(item&&g&&g.state==='playing'&&g.chamberEdition==='foundation'&&g.levelIndex===item.index,'fresh normal room Play required');
 const start=readSecondChapterAttackStart(g);
 need(g.physics.world.stepnumber===0&&g.elapsed===0&&start.normalSpawn&&start.normalCargoSpawn&&!g.heldCube&&!g.portals.ready&&g.teleportCount===0,'unprepared original spawn at worldStep zero: '+JSON.stringify(start));
 need(capture.width===640&&capture.height===360,'exact ordinary canvas capture');
 const guard=createSecondChapterAttackOriginalGuard(g),world=guard.world,observed={postSteps:0,visualUpdates:0},resetCounts={resetRun:0,respawn:0,resetCargo:0,levelReset:0},old={visual:g.updateVisuals,reset:g.resetRun,respawn:g.respawn,cargoReset:g.physics.resetCargo,levelReset:g.firstLevel.reset};
 const initialGeometrySha256=await guard.appearanceHash();let previousWorldStep=0,observation=null,error=null,journey=null;
 const snapshot=()=>({worldStep:world.stepnumber,physicsSteps:observed.postSteps,visualFrames:observed.visualUpdates,state:g.state,edition:g.chamberEdition,index:g.levelIndex,id:g.firstLevel.id,
  player:g.playerPosition.toArray(),cargo:g.physics.cargoBody.position.toArray(),cargoBodyId:guard.refs.body.id,cargoShapeId:guard.shape.id,camera:g.camera.position.toArray(),cameraQuaternion:g.camera.quaternion.toArray(),cameraFov:g.camera.fov,teleports:g.teleportCount,actualProductionWinPredicate:g.firstLevel.isWon()});
 const canvas=document.createElement('canvas');canvas.width=capture.width;canvas.height=capture.height;const ctx=canvas.getContext('2d',{alpha:false});need(ctx,'actual native canvas readback');
 const captureCanvas=phase=>{
  guard.live();need(g.renderer.domElement.width===capture.width&&g.renderer.domElement.height===capture.height,'production canvas dimensions changed');const before=JSON.stringify(snapshot());g.render();need(before===JSON.stringify(snapshot()),'native capture changed gameplay or camera');guard.live();ctx.drawImage(g.renderer.domElement,0,0);
  const gl=g.renderer.getContext();need(g.renderer.isWebGLRenderer===true&&!gl.isContextLost(),'live production WebGL renderer');
  return{phase,width:capture.width,height:capture.height,state:snapshot(),includesHTML:false,renderer:{isWebGLRenderer:true,contextLost:false,version:gl.getParameter(gl.VERSION),calls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles},jpeg:canvas.toDataURL('image/jpeg',.86)};
 };
 const rejectReset=key=>function(){resetCounts[key]++;throw Error('Reset during native ordinary attack: '+key);};
 const postStep=()=>{need(world.stepnumber===previousWorldStep+1,'120Hz clock skipped a postStep');previousWorldStep=world.stepnumber;observed.postSteps++;need(observed.postSteps<=40000,'finite native attack physics budget exhausted');guard.live();};
 g.resetRun=rejectReset('resetRun');g.respawn=rejectReset('respawn');g.physics.resetCargo=rejectReset('resetCargo');if(typeof old.levelReset==='function')g.firstLevel.reset=rejectReset('levelReset');
 g.updateVisuals=function(...args){const result=old.visual.apply(this,args);observed.visualUpdates++;need(observed.visualUpdates<=20000,'finite native attack visual budget exhausted');guard.live();return result;};world.addEventListener('postStep',postStep);
 let startCapture=null,end=null,finalGeometrySha256=null;
 try{
  startCapture=captureCanvas('start');
  if(group==='early')observation=await observeSecondChapterEarlyAttack(g,SECOND_CHAPTER_EARLY_ATTACKS.find(a=>a.name===caseId),{nativeStart:true});
  else{
   const attack=SECOND_CHAPTER_LATE_ATTACKS.find(a=>a.id===caseId);
   journey=await runV8Journey(g,{journeyOptions:{nativeStart:true},scenario:async d=>{observation=await runSecondChapterLateAttack(d,attack);}});
   observation={...observation,journey:{pass:journey.pass,resets:journey.resets,respawns:journey.respawns,frames:journey.frames}};
  }
 }catch(err){error=String(err?.stack??err);}
 try{end=captureCanvas('end');finalGeometrySha256=await guard.appearanceHash();need(finalGeometrySha256===initialGeometrySha256,'authored geometry bytes changed');}catch(err){error??=String(err?.stack??err);}
 finally{world.removeEventListener('postStep',postStep);g.updateVisuals=old.visual;g.resetRun=old.reset;g.respawn=old.respawn;g.physics.resetCargo=old.cargoReset;if(typeof old.levelReset==='function')g.firstLevel.reset=old.levelReset;}
 return{caseId,index:item.index,nativeStart:true,observation,error,clock:{...observed,postStepStart:0,postStepFinish:world.stepnumber},resetCounts,
  modelIdentity:{...guard.diagnostics(),initialGeometrySha256,finalGeometrySha256},captures:{start:startCapture,end},final:snapshot()};
}

/** Pure immutable wrapper gate. Callers must independently bind the expected
 * source/controller/package/origin and all closed bytes before invoking it. */
export function assertSecondChapterAttacksBrowserDiagnostic(report,{group,source,controller,package:pkg,captureOrigin,pureReport,closedInventory}={}){
 need(report?.schemaVersion===1&&report.kind==='actual-second-chapter-ordinary-attacks-browser-diagnostic'&&report.pass===true,'successful native diagnostic identity');
 need(group==='early'||group==='later','expected group required');need(report.group===group,'bound group');
 for(const[k,v]of Object.entries(SCOPES))need(report[k]===v,'open acceptance scope '+k);
 need(source&&controller&&pkg&&typeof captureOrigin==='string','external expected identities required');
 need(same(report.source,source)&&same(report.controller,controller)&&same(report.package,pkg)&&report.captureOrigin===captureOrigin,'exact external identities/origin');
 need(report.completeServedPackageVerified===true&&report.sourceWorkingBytesUnchanged===true&&report.controllerWorkingBytesUnchanged===true&&report.harnessWorkingBytesUnchanged===true,'frozen input and complete HTTP observations');
 need(same(report.errors,[])&&report.humanPlaytest===false&&report.hardwareFPSMeasured===false&&report.allBypassesAccepted===false,'errors or widened scope');
 need(report.sourceReview&&runInteger(report.sourceReview.runId)&&runInteger(report.sourceReview.runAttempt),'explicit source run/attempt');
 need(report.captureRun&&runInteger(report.captureRun.runId)&&runInteger(report.captureRun.runAttempt),'separate actual capture run');
 need(report.providerRun&&/^[a-f0-9]{40}$/.test(report.providerRun.commit)&&runInteger(report.providerRun.runId)&&runInteger(report.providerRun.runAttempt)&&report.providerRun.runId===report.captureRun.runId&&report.providerRun.runAttempt===report.captureRun.runAttempt,'actual provider run/commit');
 need(/^\/(?:brainrot-portal\/)?campaign-v61\/$/.test(report.capturePath),'exact isolated production package path');
 const h=report.harness;need(h&&h.sourceHead===source.commit&&h.entry==='scripts/lib/second-chapter-attack-browser.mjs'&&h.onlyInterceptedRequest===h.url,'frozen harness provenance');
 need(digest(h.sha256)&&integer(h.bytes,1)&&h.filename==='attack-harness.js'&&h.url===captureOrigin+'/__v61-attack-harness__/'+h.sha256+'.js','exact narrow harness resource');
 need(Array.isArray(h.inputs)&&h.inputs.length>0&&h.inputs.every(f=>typeof f.path==='string'&&integer(f.bytes,1)&&digest(f.sha256))&&digest(h.inputsSha256),'complete compiled harness inputs');
 need(h.productionJourney?.url===captureOrigin+report.capturePath+pkg.journey.path&&h.productionJourney.sha256===pkg.journey.sha256&&h.productionJourney.bytes===pkg.journey.bytes,'actual compiled production journey binding');
 const cases=secondChapterAttackCatalogue(group);need(Array.isArray(report.caseObservations)&&report.caseObservations.length===cases.length,'all actual browser cases');
 need(pureReport&&same(report.pureReport,{filename:group+'-attacks-report.json',cases:cases.length,pass:true}),'pure proof member');
 if(group==='early')assertSecondChapterEarlyAttacks(pureReport);else assertSecondChapterLateAttacks(pureReport);
 need(Array.isArray(report.closedMedia)&&report.closedMedia.length===cases.length*2,'all actual start/end canvases');
 for(const[i,expected]of cases.entries()){
  const r=report.caseObservations[i],ui=r?.ui,c=r?.clock,m=r?.modelIdentity;
  need(r&&r.caseId===expected.caseId&&r.index===expected.index&&r.nativeStart===true&&r.error===null,'case identity/completed execution '+expected.caseId);
  need(same(r.observation,pureReport.cases[i]),'exact browser observation in pure proof '+expected.caseId);
  need(same(r.errors,[])&&Array.isArray(r.harnessRequests)&&r.harnessRequests.length===1&&r.harnessRequests[0].url===h.url&&r.harnessRequests[0].bytes===h.bytes&&r.harnessRequests[0].sha256===h.sha256,'one exact QA resource and no case browser errors '+expected.caseId);
  need(ui&&ui.control==='native #play-button click'&&ui.state==='playing'&&ui.level===expected.index+1&&ui.edition==='foundation'&&ui.normalSpawn===true&&ui.normalCargoSpawn===true&&ui.worldStep===0&&ui.elapsed===0&&ui.portalsReady===false&&ui.teleports===0,'fresh genuine Play '+expected.caseId);
  const vector=a=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite);
  need([ui.playerPosition,ui.cargoPosition,ui.expectedPlayerSpawn,ui.expectedCargoSpawn].every(vector),'retained actual/expected spawn coordinates '+expected.caseId);
  for(const[actual,wanted,distance]of [[ui.playerPosition,ui.expectedPlayerSpawn,ui.playerSpawnDistance],[ui.cargoPosition,ui.expectedCargoSpawn,ui.cargoSpawnDistance]])need(typeof distance==='number'&&Number.isFinite(distance)&&distance===Math.hypot(...actual.map((n,i)=>n-wanted[i]))&&distance<1e-8,'exact retained native spawn distance '+expected.caseId);
  need(c&&c.postStepStart===0&&c.postStepFinish===c.postSteps&&integer(c.visualUpdates,100,20000)&&c.postSteps===c.visualUpdates*2,'uninterrupted full native clock '+expected.caseId);
  need(c.visualUpdates===(group==='early'?r.observation.journeyFrames:r.observation.journey.frames),'native clock equals enclosing ordinary journey '+expected.caseId);
  need(Object.keys(r.resetCounts).length===4&&['resetRun','respawn','resetCargo','levelReset'].every(k=>r.resetCounts[k]===0),'zero post-Play resets '+expected.caseId);
  need(m&&m.playerVertices===96753&&m.playerBones===15&&m.cargoMass===3.2&&same(m.cargoHalfExtents,[.39,.39,.39])&&m.sameOriginalActorHandles===true&&m.sameOriginalBuffers===true&&m.sameOriginalCargoShape===true&&integer(m.bodyId)&&integer(m.shapeId),'same original model/cargo '+expected.caseId);
  need(digest(m.initialGeometrySha256)&&m.finalGeometrySha256===m.initialGeometrySha256&&integer(m.identityChecks,c.postSteps+c.visualUpdates+4)&&m.materialIdentity?.pass===true&&m.materialIdentity.originalActorHandles===2,'complete model identity observations '+expected.caseId);
  for(const[phase,frames]of [['start',0],['end',c.visualUpdates]]){
   const capture=r.captures?.[phase],name=`case-${String(i+1).padStart(2,'0')}-${phase}.jpg`,file=report.closedMedia.find(f=>f.filename===name);
   need(capture&&capture.phase===phase&&capture.filename===name&&capture.includesHTML===false&&capture.width===640&&capture.height===360&&capture.state.visualFrames===frames&&capture.state.worldStep===frames*2,'actual ordinary canvas '+name);
   need(capture.state.index===expected.index&&capture.state.cargoBodyId===m.bodyId&&capture.state.cargoShapeId===m.shapeId&&capture.state.actualProductionWinPredicate===false&&capture.state.state==='playing','actual unsolved native state '+name);
   need(capture.renderer?.isWebGLRenderer===true&&capture.renderer.contextLost===false&&capture.renderer.calls>0&&capture.renderer.triangles>0,'actual production WebGL '+name);
   need(file&&file.bytes===capture.bytes&&file.sha256===capture.sha256&&integer(file.bytes,1)&&digest(file.sha256)&&file.width===640&&file.height===360&&file.decoded===true&&file.colors>=4&&file.maxChannelStd>=1,'decoded closed JPG '+name);
  }
 }
 if(closedInventory){need(Array.isArray(closedInventory.files),'complete closed inventory');const names=closedInventory.files.map(f=>f.name);need(new Set(names).size===names.length,'unique closed inventory members');for(const row of closedInventory.files)need(integer(row.bytes,1)&&digest(row.sha256),'closed bytes '+row.name);for(const media of report.closedMedia)need(closedInventory.files.some(f=>f.name===media.filename&&f.bytes===media.bytes&&f.sha256===media.sha256),'bound closed media '+media.filename);const expected=['binding.json','served-package.json','native-browser.json','attack-harness.js','attack-harness-inputs.json',group+'-attacks-report.json','second-chapter-attacks-browser-report.json',...cases.flatMap((_,i)=>{const tag=String(i+1).padStart(2,'0');return[`case-${tag}-observation.json`,`case-${tag}-start.jpg`,`case-${tag}-end.jpg`];})];need(same([...names].sort(),expected.sort()),'exact closed whole-artifact membership');}
 return{pass:true,group,cases:cases.length,scope:'Only these complete ordinary-input browser attempts; no exhaustive bypass, human-discovery, device-FPS or full-chapter acceptance claim.'};
}
