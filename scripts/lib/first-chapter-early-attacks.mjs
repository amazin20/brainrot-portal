import * as THREE from 'three';
import {runV8Journey} from '../../src/game/LabV8Journey.js';
import {installRoom21Aim} from '../../src/game/LabRoom21Journey.js';

// These are bounded attempts in the actual ordinary game, not staged physics
// fixtures. A rejected approach is reported separately from a completed attack.
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
function mechanics(g){const l=g.firstLevel;return {
 hoistHeight:l.cargoHoist?.position.y,hoistTarget:l.cargoHoist?.target,
 carPosition:l.car?.position.toArray(),carTarget:l.car?.target,
 cabinHeight:l.cabin?.position.y,air:l.drive?.flow,wheelOmega:l.drive?.wheel.omega,
 projectedSegments:l.light?.segments.length,
};}
function snapshot(g){return {player:g.playerPosition.toArray(),velocity:g.playerVelocity.toArray(),
 cargo:g.cargo.position.toArray(),held:!!g.heldCube,grounded:g.playerGrounded,
 teleports:g.teleportCount,cargoTransports:g.physics.portalTransports,state:g.state,mechanics:mechanics(g),
 portals:g.portals.portals.map(p=>p?{surfaceId:p.surfaceId,position:p.position.toArray(),normal:p.normal.toArray()}:null)};}
function note(d,name,extra={}){d.e.events.push({physicsSteps:d.e.physicsSteps,name,...snapshot(d.game),...extra});}
function rush(d,x,z,seconds=4,{jumpEvery=0,interactEvery=0}={}){
 for(let n=0;n<seconds*60&&d.game.state==='playing';n++){
  const delta=V(x,0,z).sub(d.game.playerPosition);delta.y=0;
  if(delta.length()<.10&&!jumpEvery&&!interactEvery)break;
  delta.normalize();d.worldMove(delta.x,delta.z);d.game.input.keys.add('ShiftLeft');
  if(jumpEvery&&n%jumpEvery===0)d.game.input.jumpQueued=true;
  if(interactEvery&&n%interactEvery===0)d.game.interactQueued=true;
  d.frame();
 }d.stop();
}
function collect(d){
 if(d.game.heldCube)return;
 for(let n=0;n<8;n++){
  const p=d.game.cargo.position;d.walk(p.x+1.2,p.z);
  if(d.game.interact()&&d.game.heldCube){d.wait(.3);return;}
 }throw Error('Ordinary pickup did not reach the original companion');
}
function finishRush(d){const p=d.level.goal.position;rush(d,p.x,p.z,5,{jumpEvery:31});}
function shot(d,index,point,label,surface){
 d.look(point);const accepted=d.game.firePortal(index);
 if(accepted)d.until(()=>!d.game.portalShots.queue.length&&!d.game.portalShots.active.length,3,'Actual shot unresolved');
 const impact=d.game.portalShots.lastImpact;
 const portal=d.game.portals.portals[index],r={label,accepted,expectedSurfaceId:surface.mesh.uuid,actualSurfaceId:portal?.surfaceId??null,
  impact:impact?{valid:impact.valid,reason:impact.reason,surface:impact.surface,position:impact.position}:null};
 d.e.shots.push(r);note(d,label,{shot:r});return accepted&&impact?.valid&&r.expectedSurfaceId===r.actualSurfaceId;
}
function jumpToward(d,x,z,seconds=2.2,{coyote=false}={}){
 for(let n=0;n<seconds*60&&d.game.state==='playing';n++){
  const delta=V(x,0,z).sub(d.game.playerPosition);delta.y=0;delta.normalize();
  d.worldMove(delta.x,delta.z);d.game.input.keys.add('ShiftLeft');
  if(coyote?!d.game.playerGrounded&&d.game.coyoteTime>0:n===0)d.game.input.jumpQueued=true;
  d.frame();
 }d.stop();
}

export const earlyChapterAttacks=[
 {level:1,name:'unlinked-original-cargo-around-both-gallery-corners',run(d){
  collect(d);for(const [x,z]of[[-15,4],[-15,-7],[-15,-15],[15,4],[15,-7],[15,-15]])rush(d,x,z,3,{jumpEvery:29});
  note(d,'Both gallery corners attacked with the original carried companion and no apertures');finishRush(d);
 }},
 {level:1,name:'freight-dispatch-from-below-jump-and-interact',run(d){
  collect(d);d.walk(7,6);d.stop();d.wait(.3);if(!d.game.interact()||d.game.heldCube)throw Error('Real hoist cargo release failed');d.wait(.6);
  d.walk(11,-12);rush(d,11,-12,4,{jumpEvery:41,interactEvery:5});
  note(d,'Original cargo remains on the lower hoist while dispatch is attacked from under the permanent gallery');
  rush(d,7,3,3,{jumpEvery:29});finishRush(d);
 }},
 {level:2,name:'traveller-through-island-address-instead-of-projector',run(d){
  const p=d.level.panels;
  if(!shot(d,0,p['light-exit'].getFrame().center.clone().add(V(0,.25,0)),'Actual lower departure shot',p['light-exit']))return;
  if(!shot(d,1,p['island-turn'].getFrame().center.clone().add(V(0,.25,0)),'Actual island destination shot',p['island-turn']))return;
  collect(d);const before=d.game.teleportCount;
  rush(d,-26,8,3);note(d,'Direct traveller entrance without a routed projector',{crossed:d.game.teleportCount>before});
  rush(d,8,-9,2);jumpToward(d,8,8,2.6,{coyote:true});note(d,'Attempt to finish from an island reached by a traveller aperture, with no projected crossing');finishRush(d);
 }},
 {level:2,name:'dry-projector-chassis-and-high-frame-to-receiver',run(d){
  collect(d);for(const [x,z]of[[-18,3],[-10,-8],[-10,-12],[-7,-14],[-3,-14],[8,-14],[8,-8]])rush(d,x,z,3,{jumpEvery:31});
  note(d,'Actual source chassis, ceramic frame and island support attacked without either aperture');finishRush(d);
 }},
 {level:3,name:'stationary-left-berth-coyote-flight-with-original-cargo',run(d){
  const p=d.level.panels;d.aim(0,p['dispatch-entry'].getFrame().center);d.aim(1,d.level.car.panel.getFrame().center);collect(d);d.enter(p['dispatch-entry']);
  // Walk around the solid ceramic and through the open cabin mouth before
  // taking the run-up on the real departure gallery.
  d.walk(-10,-2);d.walk(-10,-17);d.walk(-20,-17);rush(d,-5.3,-17,2);
  note(d,'Original loaded traveller launches while the carriage remains at its first berth');
  jumpToward(d,16,-17,3,{coyote:true});rush(d,16,-17,5,{jumpEvery:29});finishRush(d);
 }},
 {level:3,name:'stationary-cabin-console-and-side-frame-roof-chain',run(d){
  const p=d.level.panels;d.aim(0,p['dispatch-entry'].getFrame().center);d.aim(1,d.level.car.panel.getFrame().center);collect(d);d.enter(p['dispatch-entry']);
  for(const [x,z]of[[-13,0],[-6.8,-1.7],[-6.8,-8],[-5.2,-17],[6,-17]])rush(d,x,z,3,{jumpEvery:31});
  note(d,'Cabin console, closed side guard and head frame attacked without pressing either destination control');finishRush(d);
 }},
 {level:4,name:'grounded-portal-entry-instead-of-earned-drop',run(d){
  const p=d.level.panels;d.walk(-17,12);d.aim(0,p['fall-entry'].getFrame().center);
  d.walk(-25,9);d.walk(-25,-16);d.walk(-15,-13.4);d.aim(1,p['inclined-exit'].getFrame().center);
  d.walk(-25,-16);d.walk(-25,9);collect(d);
  // Descend away from the aperture, then enter from its real recovery floor.
  d.walk(-11,5);d.until(()=>d.game.playerGrounded&&d.game.playerPosition.y< -3.9,6,'Physical lower recovery floor not reached');
  d.walk(-17,-1);note(d,'Original pair stands on the recovery floor before the low-energy portal entry');
  rush(d,-17,-8,2);note(d,'Ground-level fall-entry traversal resolved');rush(d,16,-17,5,{jumpEvery:31});finishRush(d);
 }},
 {level:4,name:'unlinked-ramp-to-inclined-portal-frame-and-receiving-shelf',run(d){
  collect(d);d.walk(-25,9);d.walk(-25,-16);
  for(const [x,z]of[[-15,-16],[-8,-16],[-8,-11],[0,-11],[8,-11]])rush(d,x,z,3,{jumpEvery:29});
  note(d,'Real high-ramp lip, inclined receiver frame and original companion tested without any apertures');finishRush(d);
 }},
 {level:5,name:'air-address-traveller-and-wheel-casing-without-lift',run(d){
  const p=d.level.panels;
  if(!shot(d,0,p['air-source'].getFrame().center.clone().add(V(0,-.65,0)),'Low real fan-side traveller entry',p['air-source']))return;
  d.walk(-28,6);d.walk(-28,-21);
  if(!shot(d,1,p['air-receiver'].getFrame().center.clone().add(V(0,.65,0)),'High real rotor-side traveller exit',p['air-receiver']))return;
  d.walk(-30,8);d.walk(-8,10);collect(d);rush(d,21,19,4);
  for(let n=0;n<180&&d.game.teleportCount===0;n++){d.worldMove(0,-1);d.game.input.keys.add('ShiftLeft');if(n%39===0)d.game.input.jumpQueued=true;d.frame();}d.stop();
  note(d,'Real fan/receiver aperture traversal tested with the passenger cabin unoccupied');
  for(const [x,z]of[[-18,-20],[-18,-16],[-20,-17]])rush(d,x,z,3,{jumpEvery:31});note(d,'Wheel housing-to-gallery roof chain without any loaded ascent');finishRush(d);
 }},
 {level:5,name:'permanent-light-supports-to-upper-gallery-without-air',run(d){
  collect(d);for(const [x,z]of[[-24,10],[-24,11],[-12.6,6.7],[-12.6,15.3],[-26.8,-6],[-13.2,-6],[-20,-15]])rush(d,x,z,3,{jumpEvery:29});
  note(d,'Projector foot, both light-aperture uprights and real cabin supports attacked with zero air or lift');finishRush(d);
 }},
];

export async function runEarlyChapterAttacks({game,onCase=()=>{},filter=()=>true}={}){
 if(!game)throw Error('An actual initialized headless Foundation game is required');
 const results=[];game.chamberEdition='foundation';
 for(const attack of earlyChapterAttacks.filter(filter)){
  await game.selectLevel(attack.level-1,false);
  const result=await observeEarlyChapterAttack(game,attack);results.push(result);await onCase(result);
 }
 return summarizeEarlyChapterAttacks(results);
}

/** Browser callers arrive through normal Play on a fresh page and request
 * nativeStart. This observer performs no level selection or actor staging. */
export async function observeEarlyChapterAttack(game,attack,{nativeStart=false}={}){
 if(!earlyChapterAttacks.includes(attack)||game.chamberEdition!=='foundation'||game.levelIndex!==attack.level-1||
   (nativeStart?game.state!=='playing':!['ready','playing'].includes(game.state)))
  throw Error('The exact ordinary Foundation attack must begin in its own active room');
 const e={physicsSteps:0,events:[],shots:[],projectileOutcomes:[],trajectory:[],resetEvents:[],maxHeight:-Infinity,maxHorizontalSpeed:0,
   airObserved:false,maxCabinHeight:0,maxCarTravel:0,routeStarted:false};
  const update=game.updatePlaying,respawn=game.respawn,resetRun=game.resetRun,resetCargo=game.physics.resetCargo;
  let report,error,identity,lastImpact=null;
  game.updatePlaying=function(dt){update.call(this,dt);e.physicsSteps++;e.maxHeight=Math.max(e.maxHeight,this.playerPosition.y);
   e.maxHorizontalSpeed=Math.max(e.maxHorizontalSpeed,Math.hypot(this.playerVelocity.x,this.playerVelocity.z));
   const l=this.firstLevel;e.airObserved||=!!l.drive?.flow;e.maxCabinHeight=Math.max(e.maxCabinHeight,l.cabin?.position.y??0);e.maxCarTravel=Math.max(e.maxCarTravel,l.car?Math.abs(l.car.position.x+16):0);
   const impact=this.portalShots.lastImpact;
   if(impact&&impact!==lastImpact){lastImpact=impact;e.projectileOutcomes.push({physicsSteps:e.physicsSteps,...impact,portalSurfaceId:this.portals.portals[impact.index]?.surfaceId??null});}
   if(e.physicsSteps%24===0)e.trajectory.push({physicsSteps:e.physicsSteps,...snapshot(this)});
  };
  game.respawn=function(...args){e.resetEvents.push({kind:'respawn',started:e.routeStarted,physicsSteps:e.physicsSteps});return respawn.apply(this,args);};
  game.resetRun=function(...args){e.resetEvents.push({kind:'resetRun',started:e.routeStarted,physicsSteps:e.physicsSteps});return resetRun.apply(this,args);};
  game.physics.resetCargo=function(...args){e.resetEvents.push({kind:'resetCargo',started:e.routeStarted,physicsSteps:e.physicsSteps});return resetCargo.apply(this,args);};
  try{report=await runV8Journey(game,{journeyOptions:{nativeStart},scenario:async base=>{
   e.routeStarted=true;identity={group:game.cargo.group.uuid,body:game.physics.cargoBody.id};
   const d={...base,e};installRoom21Aim(d);note(d,'Ordinary initialized route begins');await attack.run(d);note(d,'Bounded attempt ends');
  }});}catch(err){error=err.message;}finally{game.updatePlaying=update;game.respawn=respawn;game.resetRun=resetRun;game.physics.resetCargo=resetCargo;}
  const won=game.state==='won',rejectedShot=e.shots.some(s=>!s.accepted||!s.impact?.valid||s.expectedSurfaceId!==s.actualSurfaceId);
  return {level:attack.level,name:attack.name,nativeStart,won,error:error??null,
   verdict:won?'completed-requires-causal-review':error||rejectedShot?'approach-incomplete':'bounded-attempt-did-not-complete',
   identity:{initial:identity??null,final:{group:game.cargo.group.uuid,body:game.physics.cargoBody.id}},
   sameOriginalCargo:!!identity&&identity.group===game.cargo.group.uuid&&identity.body===game.physics.cargoBody.id,
   journeyFrames:report?.frames??null,journeyResets:report?.resets??null,journeyRespawns:report?.respawns??null,
   final:snapshot(game),evidence:e};
}

export function summarizeEarlyChapterAttacks(results){
 return {kind:'first-chapter-early-ordinary-attacks-v60',scope:'Finite ordinary-input attempts against actual Foundation rooms 1–5. Trajectories retained every 24 physics steps, with event states and all real projectile outcomes. No exhaustive bypass, browser rendering, device, or camera claim.',
  accepted:false,physicsHz:120,cases:results,counts:{cases:results.length,completed:results.filter(r=>r.won).length,
   incompleteApproaches:results.filter(r=>r.verdict==='approach-incomplete').length,interrupted:results.filter(r=>r.error).length,
   preservedOriginalCargo:results.filter(r=>r.sameOriginalCargo).length}};
}

/** Current finite noncompletion gate, also usable in a browser. It deliberately
 * refuses a newly found win: that requires causal review, not relabelling the
 * attempt as a blocked exploit. This does not assert exhaustive protection. */
export function assertEarlyChapterAttacks(report){
 const check=(ok,message)=>{if(!ok)throw Error('Early chapter attack proof: '+message);};
 const integer=(n,min=0,max=100000)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
 const finite=(n,min=-10000,max=10000)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
 const vector=v=>Array.isArray(v)&&v.length===3&&v.every(n=>finite(n));
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const snap=(s,label)=>{
  check(s&&vector(s.player)&&vector(s.velocity)&&vector(s.cargo),label+' finite actor state');
  check(typeof s.held==='boolean'&&typeof s.grounded==='boolean',label+' actor booleans');
  check(integer(s.teleports)&&integer(s.cargoTransports)&&s.state==='playing',label+' ordinary incomplete state');
  check(s.mechanics&&typeof s.mechanics==='object',label+' mechanics');
  for(const name of ['hoistHeight','hoistTarget','carTarget','cabinHeight','wheelOmega','projectedSegments'])
   if(s.mechanics[name]!==undefined)check(finite(s.mechanics[name]),label+' finite '+name);
  if(s.mechanics.carPosition!==undefined)check(vector(s.mechanics.carPosition),label+' finite carriage');
  if(s.mechanics.air!==undefined)check(typeof s.mechanics.air==='boolean',label+' air boolean');
  check(Array.isArray(s.portals)&&s.portals.length===2,label+' two aperture records');
  for(const p of s.portals)if(p!==null){check(p&&typeof p.surfaceId==='string'&&p.surfaceId.length>0&&vector(p.position)&&vector(p.normal),label+' actual aperture frame');check(Math.abs(Math.hypot(...p.normal)-1)<1e-5,label+' unit aperture normal');}
 };
 check(report?.kind==='first-chapter-early-ordinary-attacks-v60'&&report.accepted===false&&report.physicsHz===120,'honest current diagnostic identity');
 check(Array.isArray(report.cases)&&report.cases.length===earlyChapterAttacks.length,'all ten current attempts');
 check(same(report.counts,{cases:10,completed:0,incompleteApproaches:0,interrupted:0,preservedOriginalCargo:10}),'derived finite-attempt counts');
 for(let i=0;i<earlyChapterAttacks.length;i++){
  const expected=earlyChapterAttacks[i],r=report.cases[i],e=r?.evidence,label=expected.name;
  check(r?.name===expected.name&&r.level===expected.level,label+' exact case and order');
  check(r.won===false&&r.error===null&&r.verdict==='bounded-attempt-did-not-complete',label+' completed attack with no unreviewed win');
  check(typeof r.nativeStart==='boolean',label+' explicit start method');
  check(r.sameOriginalCargo===true&&r.identity?.initial&&same(r.identity.initial,r.identity.final),label+' original body and group identity');
  check(typeof r.identity.initial.group==='string'&&r.identity.initial.group.length>0&&integer(r.identity.initial.body),label+' finite original identity');
  check(integer(r.journeyFrames,100,20000)&&r.journeyResets===0&&r.journeyRespawns===0,label+' uninterrupted ordinary driver');
  check(e&&e.routeStarted===true&&e.physicsSteps===r.journeyFrames*2,label+' complete 120 Hz clock');
  check(finite(e.maxHeight,-10,40)&&finite(e.maxHorizontalSpeed,0,100),label+' finite motion extrema');
  check(e.airObserved===false&&e.maxCabinHeight===0&&e.maxCarTravel===0,label+' required ascent or carriage motion really omitted');
  check(Array.isArray(e.resetEvents),label+' actual reset observations');
  if(r.nativeStart)check(e.resetEvents.length===0,label+' fresh native Play does not reset');
  else check(e.resetEvents.length===3&&['resetRun','resetCargo','respawn'].every((kind,j)=>same(e.resetEvents[j],{kind,started:false,physicsSteps:0})),label+' only declared CPU pre-route initialization');
  check(Array.isArray(e.trajectory)&&e.trajectory.length===Math.floor(e.physicsSteps/24),label+' every retained trajectory sample');
  for(let j=0;j<e.trajectory.length;j++){
   const row=e.trajectory[j];check(row.physicsSteps===(j+1)*24,label+' ordered 24-step sampling');snap(row,label+' sample '+j);
   check(row.player[1]<=e.maxHeight+1e-7&&Math.hypot(row.velocity[0],row.velocity[2])<=e.maxHorizontalSpeed+1e-7,label+' observed extrema bound samples');
  }
  check(Array.isArray(e.events)&&e.events.length>=3&&e.events[0].name==='Ordinary initialized route begins'&&e.events.at(-1).name==='Bounded attempt ends',label+' actual completed scenario');
  let previous=0;for(const event of e.events){check(integer(event.physicsSteps,previous,e.physicsSteps),label+' event clock');previous=event.physicsSteps;snap(event,label+' event');}
  check(e.events.at(-1).physicsSteps===e.physicsSteps,label+' terminal event clock');snap(r.final,label+' final');
  for(const key of ['player','velocity','cargo','held','grounded','teleports','cargoTransports','state','mechanics','portals'])
   check(same(e.events.at(-1)[key],r.final[key]),label+' terminal '+key+' matches final observation');
  check(Array.isArray(e.projectileOutcomes)&&Array.isArray(e.shots),label+' retained actual projectile outcomes');
  const expectedShots=[0,0,2,0,2,2,2,0,2,0][i];check(e.projectileOutcomes.length===expectedShots,label+' all exact projectile outcomes');
  previous=0;for(const shot of e.projectileOutcomes){
   check(integer(shot.physicsSteps,previous,e.physicsSteps)&&integer(shot.index,0,1)&&integer(shot.sequence,1),label+' actual projectile clock');previous=shot.physicsSteps;
   check(shot.valid===true&&vector(shot.position)&&typeof shot.portalSurfaceId==='string'&&shot.portalSurfaceId.length>0,label+' valid actual projectile');
  }
  check(e.shots.length===([2,8].includes(i)?2:0),label+' addressed direct-transit shot count');
  for(const shot of e.shots)check(shot.accepted===true&&shot.impact?.valid===true&&vector(shot.impact.position)&&typeof shot.expectedSurfaceId==='string'&&shot.expectedSurfaceId===shot.actualSurfaceId,label+' exact intended physical ceramic was hit');
  if(expected.level===1)check(r.final.mechanics.hoistHeight===0&&r.final.mechanics.hoistTarget===0&&r.final.teleports===0,label+' unraised freight hoist');
  if(expected.level===2)check(r.final.mechanics.projectedSegments===1,label+' useful projected support omitted');
  if([2,4,5,6,8].includes(i))check(r.final.teleports>=1,label+' genuine traveller aperture entry observed');
  else check(r.final.teleports===0,label+' no unrequested traveller aperture crossing');
  if(expected.level===3)check(same(r.final.mechanics.carPosition,[-16,6,-10])&&r.final.mechanics.carTarget===0,label+' actual unchanged first berth');
  if(expected.level===5)check(r.final.mechanics.cabinHeight===0&&r.final.mechanics.air===false&&r.final.mechanics.wheelOmega===0,label+' no air, stored energy or passenger lift');
 }
 return report;
}
