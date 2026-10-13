import * as THREE from 'three';
import { CAMERA_PITCH_MIN, CAMERA_PITCH_MAX } from './LabCamera.js';

const V=(...p)=>new THREE.Vector3(...p),UP=V(0,1,0);
const check=(condition,message)=>{if(!condition)throw Error(message);};
const angle=value=>Math.atan2(Math.sin(value),Math.cos(value));

/** Read only the current physics and manufactured mechanism. These samples
 * observe a route; none of them is an input to the puzzle or its win rule. */
export function foundation20PhysicalSample(game) {
 const level=game.firstLevel,rope=level?.rope,near=level?.nearHook;
 const d=near?.diagnostics?.()??{};
 const finite=value=>Number.isFinite(value)?value:null;
 const contact=level?.stopFinger?.diagnostics?.()??d.farContact??d.fingerContact??d.retainingContact??null;
 return {
  state:game.state,edition:game.chamberEdition,level:game.levelIndex+1,id:level?.id,
  worldStep:game.physics?.world?.stepnumber,elapsedMilliseconds:game.elapsed,cargoBodyId:game.physics?.cargoBody?.id,
  cargoMass:game.physics?.cargoBody?.mass,cargoDynamic:game.physics?.cargoBody?.type===1,
  player:game.playerPosition.toArray(),cargo:game.cargo.position.toArray(),held:Boolean(game.heldCube),
  portalTransports:game.physics?.portalTransports,playerTransports:game.teleportCount,
  rope:{opening:finite(rope?.opening??d.opening),tension:finite(rope?.tension??d.tension),stretch:finite(rope?.stretch??d.stretch),
   length:finite(rope?.path?.length??d.cablePath?.length),currentPair:Boolean(rope?.currentPath?.()),
   unilateral:d.lastCableForce?.unilateral??null,slack:d.lastCableForce?.slack??null,
   nearForce:d.lastCableForce?.nearForce??null,farForce:d.lastCableForce?.farForce??null,
   pinTravel:finite(rope?.pinTravel??d.pinTravel)},
  nearHook:{angle:finite(d.hookAngle??near?.hookAngle),bearingForce:finite(d.bearingForce),bearingContacts:d.bearingContacts??null,
   captureForce:finite(d.captureForce),captureContacts:d.captureContacts??null,
   handCount:d.handCount??null,lastHand:d.lastHand??null,
   couplingPower:finite(d.slip?.lastForce?.totalCouplingPower??d.slip?.lastForce?.totalPower),
   couplingTorque:finite(d.slip?.lastForce?.torque??d.slip?.lastForce?.tau),
   originalFree:d.originalFree??null,ownedPartsValid:d.ownedPartsValid??null,bodiesPresent:d.bodiesPresent??null},
  farContact:contact,
 };
}

/** Continuous ordinary-input Foundation room 20 route. Start at the normal
 * Play spawn. The route never resets the attempt or assigns actor/body poses,
 * portals, mechanism targets, collision masks, puzzle signals or victory. */
export async function runFoundation20PhysicalJourney(game,{onMilestone=()=>{},onFrame=null,stopAt=null,
 order='cargo-first',recovery=false,recoveryPhase='before-near-release',portalOffsets=null,demonstrateLoadedHook=true}={}) {
 const level=game.firstLevel;
 check(game.chamberEdition==='foundation'&&game.levelIndex===19&&level?.id==='foundation-portal-tension'&&level.creativeEarly===20,
  'Foundation20 physical route requires the actual Foundation builder at index 19');
 const spawn=level.spawn.toArray?.()??level.spawn;
 check(game.state==='playing'&&game.playerPosition.distanceTo(V(...spawn))<.5&&!game.portals.ready,
  'Start Foundation20 from its untouched normal Play spawn');
 check(level.nearHook&&level.rope&&level.feed&&level.outlet,'Foundation20 physical mechanism is missing');
 check([null,'pair-prepared','cargo-hanging','near-hook-released','finger-held','cargo-recovered'].includes(stopAt),'Unknown Foundation20 cut');
 check(['cargo-first','scout-first'].includes(order),'Unknown Foundation20 preparation order');
 check(['before-near-release','after-near-release'].includes(recoveryPhase),'Unknown Foundation20 recovery phase');
 if(portalOffsets!==null){
  check(portalOffsets&&typeof portalOffsets==='object'&&!Array.isArray(portalOffsets),'Actual portal shot offset vectors required');
  for(const name of ['feed','outlet'])check(Array.isArray(portalOffsets[name])&&portalOffsets[name].length===3&&portalOffsets[name].every(value=>Number.isFinite(value)&&Math.abs(value)<=.3),'Reviewed finite manufactured-panel offset '+name);
  check(portalOffsets.feed[1]===0&&portalOffsets.outlet[2]===0,'Offset charge targets must remain on their actual floor/wall planes');
 }
 const original={move:game.input.getMove,reset:game.resetRun,respawn:game.respawn,cargoReset:game.physics.resetCargo};
 const companion=game.cargo,body=game.physics.cargoBody,move=new THREE.Vector2();
 check(body.mass===3.2&&body.type===1,'Use the original free 3.2 kg companion');
 const report={kind:'ordinary-foundation20-physical-route',edition:'foundation',level:20,id:level.id,pass:false,
  frames:0,physicsSteps:0,seconds:0,activeSeconds:0,distance:0,shots:0,interactions:0,resets:0,respawns:0,cargoResets:0,
  cargoBodyId:body.id,cargoMass:body.mass,sameCompanion:false,milestones:[],actions:[],maxIdleSeconds:0,order,recovery,recoveryPhase,portalOffsets};
 let idle=0,previousYaw=game.yaw,previousPitch=game.pitch;
 game.input.getMove=()=>move.clone();
 game.resetRun=function(...args){report.resets++;return original.reset.apply(this,args);};
 game.respawn=function(...args){report.respawns++;return original.respawn.apply(this,args);};
 game.physics.resetCargo=function(...args){report.cargoResets++;return original.cargoReset.apply(this,args);};
 const S=()=>({...foundation20PhysicalSample(game),frame:report.frames,seconds:report.physicsSteps/120});
 function stop(){move.set(0,0);game.input.keys.clear();}
 function worldMove(x,z){const p=V(x,0,z).applyAxisAngle(UP,-game.yaw);move.set(p.x,p.z);}
 async function frame(){
  const before=game.playerPosition.clone();
  for(let i=0;i<2&&game.state==='playing';i++){game.updatePlaying(1/120);report.physicsSteps++;}
  game.updateVisuals(1/60,1);
  const distance=before.distanceTo(game.playerPosition);report.distance+=distance;
  const active=distance>.0001||Math.abs(angle(game.yaw-previousYaw))+Math.abs(game.pitch-previousPitch)>.0001;
  report.activeSeconds+=active?1/60:0;idle=active?0:idle+1/60;report.maxIdleSeconds=Math.max(idle,report.maxIdleSeconds);
  previousYaw=game.yaw;previousPitch=game.pitch;
  check(game.cargo===companion&&game.physics.cargoBody===body,'Original companion identity changed');
  check(!report.resets&&!report.respawns&&!report.cargoResets,'Foundation20 ordinary attempt reset');
  check(body.mass===3.2&&body.type===1,'Original dynamic cargo properties changed');
  const sample={...S(),visualFrame:report.frames};
  if(onFrame)await onFrame(sample);
  report.frames++;
  if(report.frames%120===0){
   await globalThis.__FOUNDATION20_FLUSH__?.();
   if(typeof window!=='undefined'&&typeof window.requestAnimationFrame==='function')await new Promise(resolve=>setTimeout(resolve,0));
  }
 }
 async function wait(seconds){stop();for(let n=0;n<Math.ceil(seconds*60);n++)await frame();}
 async function until(predicate,seconds,label){stop();for(let n=0;n<seconds*60;n++){if(predicate())return;await frame();}check(predicate(),`${label}: ${JSON.stringify(S())}`);}
 async function walk(x,z,{seconds=30,tolerance=.11}={}){
  report.actions.push({kind:'walk',target:[x,z],frame:report.frames});let best=Infinity,stuck=0;
  for(let n=0;n<seconds*60&&game.state==='playing';n++){
   const dx=x-game.playerPosition.x,dz=z-game.playerPosition.z,d=Math.hypot(dx,dz);
   if(d<tolerance){stop();return;}
   if(d<best-.012){best=d;stuck=0;}else stuck++;
   check(stuck<420,`Blocked walking to ${x},${z}: ${JSON.stringify(S())}`);
   const pace=Math.min(1,d*1.5);worldMove(dx/Math.max(.001,d)*pace,dz/Math.max(.001,d)*pace);await frame();
  }
  stop();check(game.state==='won'||Math.hypot(game.playerPosition.x-x,game.playerPosition.z-z)<.3,`Walking timeout ${x},${z}: ${JSON.stringify(S())}`);
 }
 async function look(point){
  stop();point=point.clone();
  for(let n=0;n<360;n++){
   game.scene.updateMatrixWorld(true);
   if(point.clone().sub(game.camera.position).dot(game.camera.getWorldDirection(V()))<0){game.yaw+=.16;await frame();continue;}
   const p=point.clone().project(game.camera),tolerance=Math.min(.005,.04/Math.max(1,point.distanceTo(game.camera.position)));
   if(n>24&&Math.abs(p.x)<tolerance&&Math.abs(p.y)<tolerance)return;
   game.yaw-=THREE.MathUtils.clamp(p.x,-1,1)*.18;
   game.pitch=THREE.MathUtils.clamp(game.pitch+THREE.MathUtils.clamp(p.y,-1,1)*.17,CAMERA_PITCH_MIN,CAMERA_PITCH_MAX);await frame();
  }
  throw Error('Cannot aim at actual Foundation20 point '+point.toArray());
 }
 async function shot(slot,patch,point=patch.getFrame().center){
  check(!game.heldCube,'Set companion down before an ordinary portal shot');await look(point);
  check(game.firePortal(slot),'Ordinary portal input rejected');report.shots++;report.actions.push({kind:'shot',slot,surface:patch.name,requestedPoint:point.toArray(),...S()});
  await until(()=>!game.portalShots.queue.length&&!game.portalShots.active.length,3,'Portal charge unresolved');
  check(game.portalShots.lastImpact?.valid,'Portal impact rejected '+JSON.stringify(game.portalShots.lastImpact));
  check(game.portals.portals[slot]?.surfaceId===patch.mesh.uuid,'Charge hit a different actual surface '+patch.name);
 }
 async function interaction(id){
  check(game.interact(),'Ordinary E missed '+id);report.interactions++;report.actions.push({kind:'interact',id,...S()});
 }
 async function pickup(){await interaction('original-companion');check(game.heldCube,'Original companion pickup failed');await wait(.55);}
 function mark(name){const m={name,...S()};report.milestones.push(m);onMilestone(m,game);}
 async function inspect(){
  await walk(-15,28.5);await walk(-21,28.5);await walk(-21,27);await walk(-21,19);await walk(-21,8);await walk(-16.4,6.5);
  await shot(1,level.outlet,level.outlet.getFrame().center.clone().add(V(...(portalOffsets?.outlet??[0,0,0]))));mark('standing charge traverses both actual inspection slits');
 }
 async function descend(){await walk(-21,8);await walk(-21,19);await walk(-21,27);await walk(-21,28.5);await walk(-15,28.5);}
 async function floor(){const p=level.feed.surface.getFrame().center.clone().add(V(...(portalOffsets?.feed??[0,0,0])));await walk(p.x,p.z+4);await shot(0,level.feed.surface,p);}
 async function nearHand(label){
  await walk(6,4.5);await interaction('near-hook-control');await wait(1);mark(label);
 }
 async function cutCable(){
  const recoverySurface=level.recovery?.surface??level.panels?.['rope-recovery-floor'];
  check(recoverySurface,'Actual independent recovery floor is missing');
  await walk(-9,22);await shot(1,recoverySurface);
  check(!level.rope.currentPath(),'Recovery charge left a connected far cable branch');
 }
 try {
  report.start=S();await wait(.5);
  if(demonstrateLoadedHook){
   await until(()=>foundation20PhysicalSample(game).nearHook.bearingForce>1,3,'Initial hook did not carry the real closing spring');
   const before=foundation20PhysicalSample(game);await nearHand('same finite E slips while the near hook carries the closing spring');
   const after=foundation20PhysicalSample(game);
   check(before.nearHook.bearingForce>1&&after.rope.opening<.15&&Math.abs(after.nearHook.angle)<.2,'Unloaded portal pair bypassed the physically loaded near hook');
  }
  if(order==='cargo-first'){await floor();await inspect();await descend();}
  else{await inspect();await descend();await floor();}
  mark('current manufactured portal pair prepared');if(stopAt==='pair-prepared')return report;
  await walk(-3,25);await walk(game.cargo.position.x+1.2,game.cargo.position.z);await pickup();
  const entry=portalOffsets?game.portals.portals[0].position.clone():level.feed.surface.getFrame().center;
  await walk(entry.x,entry.z+6);await look(V(entry.x,2,entry.z-8));await walk(entry.x,entry.z+(portalOffsets ? .85 : 1.25));await wait(.45);
  const before=game.physics.portalTransports;await interaction('release-original-companion');check(!game.heldCube,'Original release left cargo carried');await wait(.65);
  await walk(entry.x,entry.z+4);
  if(game.physics.portalTransports===before){
   const resting=game.cargo.position.clone().setY(entry.y);await shot(0,level.feed.surface,resting);
  }
  await until(()=>game.physics.portalTransports>before&&game.cargo.position.z< -8,6,'Original free cargo missed the guarded far portal');
  mark('same original free 3.2 kg companion reaches the weight pocket');
  await until(()=>level.rope.opening>.48&&foundation20PhysicalSample(game).nearHook.bearingForce<1,18,'Actual gravity cable did not unload the bearing face');
  mark('true current cable tension unloads the physically loaded near hook');if(stopAt==='cargo-hanging')return report;
  if(recovery&&recoveryPhase==='before-near-release'){
   await cutCable();await wait(4);check(level.rope.opening<.15,'Erased branch did not return the still captured gate');
   check(game.cargo.position.z< -8,'Recovery restarted or moved the original cargo out of its pocket');
   mark('ordinary recovery shot removes tension; the still closed near hook and spring return the gate');
   await floor();await inspect();await descend();
   await until(()=>level.rope.opening>.48&&foundation20PhysicalSample(game).nearHook.bearingForce<1,18,'Restored actual branch did not unload the same hook');
   mark('restored current pair reloads the same original free cargo without a reset');
  }
  await nearHand('same finite E withdraws the now unloaded near hook');
  await until(()=>level.rope.opening>6.95,24,'The physically released gate train did not reach the crossing');
  mark('actual cable force advances the same two-leaf gate train');if(stopAt==='near-hook-released')return report;
  if(recovery&&recoveryPhase==='after-near-release'){
   const handCount=foundation20PhysicalSample(game).nearHook.handCount;
   await cutCable();await wait(4);
   check(level.rope.opening<.15,'Removing the cable after release did not return the unretained train');
   check(game.cargo.position.z< -8,'Post-release recovery lost the same original cargo from the far pocket');
   mark('ordinary post-release recovery shot removes tension; the unretained spring returns the same train');
   await floor();await inspect();await descend();
   await until(()=>level.rope.opening>6.95,24,'Restoring the real pair did not recover the unretained train after release');
   check(foundation20PhysicalSample(game).nearHook.handCount===handCount,'Post-release recovery supplied an unrequested additional hook impulse');
   mark('restored current pair reopens the already released hook and same train without a new E or reset');
  }
  await walk(2,7);await walk(2,-3);await walk(7,-3);await interaction('far-retaining-finger');await wait(1);
  mark('ordinary far E inserts the manufactured retaining finger');
  await walk(2,-3);await walk(2,7);await cutCable();await wait(3);
  check(level.rope.tension===0&&level.rope.opening>6.6,'Removing actual tension did not leave the train physically retained');
  mark('far solid contact retains the gate train after actual cable force falls to zero');if(stopAt==='finger-held')return report;
  await walk(-3,24);await walk(-3,8);await walk(2,7);await walk(2,-3);await walk(7,-3);
  await walk(9,-3);await walk(9,-12);await walk(-7,-12);await walk(-12,-14);
  await walk(Math.min(game.cargo.position.x+1.2,-12.2),Math.max(game.cargo.position.z,-20.15));await pickup();
  mark('same original cargo recovered through the grounded side service opening');if(stopAt==='cargo-recovered')return report;
  await walk(-12,-14);await walk(-7,-14);await walk(16,-14);await walk(16,-3);await walk(16,6);await walk(16,23);
  await until(()=>game.state==='won',3,'Actual shared goal did not accept both travellers');mark('both travellers return through the physically retained linked door');
  report.pass=true;report.sameCompanion=game.cargo===companion&&game.physics.cargoBody===body;return report;
 } catch(error) {
  error.foundation20Report=report;throw error;
 } finally {
  report.seconds=report.physicsSteps/120;report.finish=S();report.teleports=game.teleportCount;
  stop();game.input.getMove=original.move;game.resetRun=original.reset;game.respawn=original.respawn;game.physics.resetCargo=original.cargoReset;
 }
}
