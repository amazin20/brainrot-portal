// Additional finite input-only attack coverage for foundation rooms 1–14.
// This is a headless production-physics audit, not a render or human playtest.
// Actor/portal/mechanism poses, velocities and success flags are never assigned.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import * as THREE from 'three';
import {createHeadlessGame} from './lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {installRoom21Aim} from '../src/game/LabRoom21Journey.js';
import {campaignSpec} from '../src/game/LabCampaignLevels.js';
import {runRoom14FoldAttack} from './lib/room14-fold-speedrun.mjs';

const numbers=(process.env.ROOMS||'1,2,3,4,5,6,7,8,9,10,11,12,13,14').split(',').map(Number);
if(!numbers.every(n=>Number.isInteger(n)&&n>=1&&n<=14))throw Error('ROOMS must be 1–14');
const g=await createHeadlessGame();g.chamberEdition='foundation';
function fingerprint(){const files=fs.readdirSync('src/game',{recursive:true}).filter(f=>f.endsWith('.js')).sort(),h=createHash('sha256');for(const file of files){h.update(file);h.update(fs.readFileSync(path.join('src/game',file)));}return h.digest('hex');}
const digest=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const summary={edition:'foundation',scope:'New finite input-only speedrun attack patterns; outcomes distinguish blocked physical attempts from setup failures. No absence-of-all-exploits claim.',source:{commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),started:new Date().toISOString(),gameSourcesSha256:fingerprint(),harnessSha256:digest('scripts/qa-speedrun-early-new.mjs'),foldHarnessSha256:digest('scripts/lib/room14-fold-speedrun.mjs')},rooms:[]};
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);

function runTowards(d,target,seconds,{jumpEvery=35,interactEvery=0,tangent=0}={}){
 d.game.input.keys.add('ShiftLeft');
 for(let n=0;n<Math.ceil(seconds*60)&&d.game.state==='playing';n++){
  const delta=target.clone().sub(d.game.playerPosition);delta.y=0;
  if(delta.length()<.17&&!interactEvery)break;
  delta.normalize();if(tangent)delta.applyAxisAngle(V(0,1,0),tangent);
  d.worldMove(delta.x,delta.z);
  if(jumpEvery&&n%jumpEvery===0)d.game.input.jumpQueued=true;
  if(interactEvery&&n%interactEvery===0)d.game.interactQueued=true;
  d.frame();
 }
 d.stop();
}
function collect(d){
 if(d.game.heldCube)return;
 for(const [x,z]of [[1.25,0],[-1.25,0],[0,1.25],[0,-1.25]]){
  const c=d.game.cargo.position;runTowards(d,V(c.x+x,0,c.z+z),4,{jumpEvery:0});
  d.game.interact();d.wait(.4);if(d.game.heldCube)return;
 }
 throw Error('Setup could not reach and pick up the original cargo by movement input');
}
function perimeter(d,clockwise){
 collect(d);const b=d.level.bounds,margin=.67;
 const corners=[V(b.minX+margin,0,b.maxZ-margin),V(b.minX+margin,0,b.minZ+margin),V(b.maxX-margin,0,b.minZ+margin),V(b.maxX-margin,0,b.maxZ-margin)];
 if(!clockwise)corners.reverse();
 for(const point of corners)runTowards(d,point,8,{jumpEvery:22});
 runTowards(d,d.level.goal.position,8,{jumpEvery:22});d.mark('Outer wall and every exterior corner attacked with the original carried cargo');
}
function cargoWedge(d){
 collect(d);const target=d.level.goal.position;
 d.look(target.clone().add(V(0,1.2,0)));
 // Push the original companion against the obstruction, release above its
 // corner during jumping, try to land on it, and pick it back up in motion.
 runTowards(d,target,5,{jumpEvery:27});
 for(let cycle=0;cycle<9&&d.game.state==='playing';cycle++){
  d.game.input.jumpQueued=true;d.worldMove(0,0);d.frame();
  if(d.game.heldCube)d.game.interact();
  runTowards(d,target,1.05,{jumpEvery:8,interactEvery:11,tangent:(cycle%2?1:-1)*Math.PI/7});
 }
 if(!d.game.heldCube)collect(d);
 runTowards(d,target,6,{jumpEvery:12});d.mark('Cargo wedging, repeated buffered jumps and airborne pickup/release attempted');
}
async function ordinary(d){
 const n=d.level.index+1;
 if(n<=5){const {runFoundationJourney}=await import('../src/game/LabFoundationJourney.js');return runFoundationJourney(d);}
 if(n<=8){const {runExtendedStages}=await import('../src/game/LabExtendedJourney.js');return runExtendedStages(d);}
 if(n<=11){const {runWorkshopJourney}=await import('../src/game/LabWorkshopJourney.js');return runWorkshopJourney(d);}
 const m=await import(`../src/game/LabRoom${n}Journey.js`);return m[`runRoom${n}`](d);
}
async function reach(d,milestone){
 const stopped=Symbol('attack-cut');let reached=false;
 try{await ordinary({...d,mark:name=>{d.mark(name);if(name===milestone){reached=true;throw stopped;}}});}
 catch(e){if(e!==stopped)throw e;}
 if(!reached)throw Error('Setup milestone absent: '+milestone);
}

function highEdgePair(d){
 installRoom21Aim(d);
 const panels=Object.values(d.level.panels).filter(p=>p?.getFrame),goal=d.level.goal.position;
 const near=panels.filter(p=>p.getFrame().center.distanceTo(d.game.playerPosition)<24)
  .sort((a,b)=>a.getFrame().center.distanceTo(d.game.playerPosition)-b.getFrame().center.distanceTo(d.game.playerPosition));
 const far=[...panels].sort((a,b)=>a.getFrame().center.distanceTo(goal)-b.getFrame().center.distanceTo(goal));
 let pair;
 // Shoot just inside each upper/side ceramic edge, instead of the centres in
 // the earlier audit. A shot failure is recorded and another real shot tried.
 for(const outlet of far.slice(0,3)){
  const f=outlet.getFrame();
  for(const offset of [[0,.88],[.88,.88],[-.88,.88]]){
   const at=f.center.clone().addScaledVector(f.right,(f.halfWidth||outlet.width/2||2)*offset[0]).addScaledVector(f.up,(f.halfHeight||outlet.height/2||2)*offset[1]);
   try{d.aim(1,at);}catch(e){d.evidence.shots.push({panel:outlet.name,offset,accepted:false,error:e.message});continue;}
   d.evidence.shots.push({panel:outlet.name,offset,accepted:true,position:d.game.portals.portals[1]?.position.toArray()});
   for(const inlet of near.slice(0,3)){
    if(inlet===outlet)continue;
    try{d.aim(0,inlet.getFrame().center);}catch(e){d.evidence.shots.push({panel:inlet.name,accepted:false,error:e.message});continue;}
    pair={inlet,outlet};break;
   }
   if(pair)break;
  }
  if(pair)break;
 }
 if(!pair){d.evidence.noAcceptedPair=true;return;}
 collect(d);
 const f=pair.inlet.getFrame(),front=f.center.clone().addScaledVector(f.normal,1.2);
 runTowards(d,front,8,{jumpEvery:19});const before=d.game.teleportCount;
 for(let n=0;n<360&&d.game.state==='playing'&&d.game.teleportCount===before;n++){
  d.game.input.keys.add('ShiftLeft');d.worldMove(-f.normal.x,-f.normal.z);
  if(n%13===0)d.game.input.jumpQueued=true;d.frame();
 }
 d.stop();
 if(d.game.teleportCount>before){
  d.evidence.pairTraversal=true;
  d.game.clearPortals();d.evidence.clearedAfterTraversal=true;
 }
 runTowards(d,goal,12,{jumpEvery:19});
 d.mark('Highest accepted edge exit followed by immediate portal clearing and jumping sprint');
}

const extra={
 1:[['under-gallery-console-midjump',d=>{
  collect(d);runTowards(d,V(11,0,-12),12,{jumpEvery:12});
  if(d.game.heldCube)d.game.interact();
  for(let n=0;n<300;n++){d.game.input.jumpQueued=n%7===0;d.game.interactQueued=n%5===0;d.frame();}
  d.evidence.hoistHeight=d.level.cargoHoist.position.y;collect(d);runTowards(d,d.level.goal.position,6);
 }]],
 2:[['permanent-service-island-jump-with-no-projection',d=>{
  collect(d);for(const [x,z]of [[-11,3],[-9,3],[-9,-3],[-9,-9],[8,-9],[8,8],[16,8]])runTowards(d,V(x,0,z),8,{jumpEvery:17});
  d.evidence.lightSegments=d.level.light.segments.length;
 }]],
 3:[['empty-car-upper-frame-jump-without-dispatch',d=>{
  installRoom21Aim(d);const p=d.level.panels,cf=d.level.car.panel.getFrame();
  d.aim(0,p['dispatch-entry'].getFrame().center);d.aim(1,cf.center.clone().addScaledVector(cf.up,1.6));collect(d);
  const f=p['dispatch-entry'].getFrame();runTowards(d,f.center.clone().addScaledVector(f.normal,1),7,{jumpEvery:0});
  for(let n=0;n<180;n++){d.worldMove(-f.normal.x,-f.normal.z);if(n%19===0)d.game.input.jumpQueued=true;d.frame();}d.stop();
  d.evidence.carProgress=d.level.car.progress;runTowards(d,V(5,10,-17),12,{jumpEvery:7});runTowards(d,d.level.goal.position,5,{jumpEvery:7});
 }]],
 4:[...[-1,0,1].map(offset=>['lower-floor-jump-fling-high-outlet-'+offset,d=>{
  installRoom21Aim(d);const p=d.level.panels;
  // The launcher must be sighted from its real front on the inspection
  // balcony. Return down the ramp before the attack: the launch itself uses
  // only the lower service floor drop, omitting the 14 m falling impulse.
  d.walk(-17,12);d.aim(0,p['fall-entry'].getFrame().center);
  collect(d);d.walk(-25,9);d.walk(-25,-16);d.walk(-20,-16);d.game.interact();d.wait(.8);d.walk(-15,-13.4);
  d.aim(1,p['inclined-exit'].getFrame().center.clone().addScaledVector(p['inclined-exit'].getFrame().up,offset*.15));
  collect(d);d.walk(-25,-16);d.walk(-25,9);d.walk(-17,12);runTowards(d,V(-17,0,-6),12,{jumpEvery:offset===0?0:9});
  d.evidence.afterLowFling=d.game.playerPosition.toArray();
  runTowards(d,V(6,15,-15),10,{jumpEvery:9});runTowards(d,d.level.goal.position,7,{jumpEvery:9});
 }])],
 5:[['jump-through-lowest-light-source-without-motor',d=>{
  installRoom21Aim(d);const p=d.level.panels;
  d.walk(-30,7);d.walk(-30,-24);d.aim(1,p['light-exit'].getFrame().center);d.walk(-30,7);d.walk(-22,7);
  d.aim(0,p['light-source'].getFrame().center.clone().addScaledVector(p['light-source'].getFrame().up,-.9));collect(d);
  runTowards(d,V(-14,0,11),13,{jumpEvery:5});runTowards(d,d.level.goal.position,10,{jumpEvery:5});
  d.evidence.motorHeight=d.level.cabin.position.y;
 }]],
 6:[['outer-servo-through-wall-midjump-without-pilot',d=>{
  for(const [x,z]of [[-3,0],[3,-7]])runTowards(d,V(x,0,z),9,{jumpEvery:11,interactEvery:6});
  d.evidence.mirrorTarget=d.level.state.target;d.evidence.pilotLit=d.level.state.pilotLit;collect(d);runTowards(d,d.level.goal.position,12,{jumpEvery:11});
 }]],
 7:[['receiver-floor-lower-side-shot-before-rocker-load',d=>{
  installRoom21Aim(d);d.walk(-11.7,8);d.walk(-11.7,-10.8);
  try{d.aim(1,d.level.panels['lever-receiver'].getFrame().center.clone().add(V(1.7,0,1.7)));d.evidence.receiverAccepted=true;}catch(e){d.evidence.receiverAccepted=false;d.evidence.rejected=e.message;}
  d.walk(-11.7,8);collect(d);runTowards(d,d.level.goal.position,12,{jumpEvery:7});
 }]],
 8:[['jump-through-pair-with-fan-off',d=>{
  installRoom21Aim(d);d.aim(0,d.level.panels['air-intake'].getFrame().center);d.walk(0,3);d.aim(1,d.level.panels['air-up'].getFrame().center);collect(d);
  const f=d.level.panels['air-intake'].getFrame();runTowards(d,f.center.clone().addScaledVector(f.normal,1.1),10,{jumpEvery:7});
  for(let n=0;n<300;n++){d.game.input.keys.add('ShiftLeft');d.worldMove(-f.normal.x,-f.normal.z);if(n%7===0)d.game.input.jumpQueued=true;d.frame();}d.stop();
  d.evidence.fanEnabled=d.level.state.enabled;runTowards(d,d.level.goal.position,12,{jumpEvery:7});
 }]],
 9:[['stomp-spring-and-touch-service-before-cargo-impact',d=>{
  collect(d);d.look(V(0,2,-5));runTowards(d,V(0,0,-5),12,{jumpEvery:7,interactEvery:9});
  d.evidence.springLatched=d.level.workshop.state.piston.latched;collect(d);runTowards(d,d.level.goal.position,10,{jumpEvery:7});
 }]],
 10:[['empty-dock-fast-reverse-before-cargo-latch',d=>{
  const s=d.level.workshop.state;
  for(const [x,z]of [[-9.5,11],[-9.5,5.6],[-5.4,5.6],[-5.4,4.7]])d.walk(x,z);
  for(let n=0;n<12;n++){d.game.interact();d.wait(.13);}
  d.evidence.freightProgress=s.freight.progress;d.evidence.receiverEngaged=s['dock-lock'].engaged;
  for(const [x,z]of [[-5.4,5.6],[-9.5,5.6],[-9.5,11]])d.walk(x,z);collect(d);
  for(const [x,z]of [[-9.5,5.6],[-2.9,4.7],[5.2,4.2],[7,-9.5],[0,-16]])runTowards(d,V(x,0,z),7,{jumpEvery:8});
 }]],
 11:[...[-1,1].map(sign=>['closed-ratchet-'+(sign<0?'west':'east')+'-wall-pinch',d=>{
  collect(d);const b=d.level.bounds;
  const x=sign<0?b.minX+.46:b.maxX-.46;
  runTowards(d,V(x,0,-10.7),12,{jumpEvery:7});
  for(let n=0;n<360;n++){d.game.input.keys.add('ShiftLeft');d.worldMove(sign*.5,-1);d.game.input.jumpQueued=n%6===0;d.frame();}
  d.stop();d.evidence.ratchetEngaged=d.level.workshop.state.ratchet.engaged;runTowards(d,d.level.goal.position,7,{jumpEvery:7});
 }])],
 12:[['cargo-drop-after-access-then-jump-into-final-without-climb',async d=>{
  await reach(d,'folded underpass');collect(d);runTowards(d,V(4,0,1),9,{jumpEvery:5,interactEvery:13});runTowards(d,d.level.goal.position,12,{jumpEvery:5});
 }]],
 13:[['upper-access-aperture-jump-to-north-gallery-without-optics',d=>{
  installRoom21Aim(d);const p=d.level.panels;
  d.walk(-15.5,16);d.aim(0,p['access-low'].getFrame().center);d.walk(-8.5,16);d.walk(-8.5,-18);d.walk(4,-18);
  d.aim(1,p['access-high'].getFrame().center.clone().add(V(0,2.12,0)));d.walk(-8.5,-18);d.walk(-8.5,16);collect(d);d.walk(-15.5,16);d.enter(p['access-low']);
  runTowards(d,V(-10,12,-14.5),8,{jumpEvery:5});runTowards(d,V(7,12,-14.5),8,{jumpEvery:5});runTowards(d,d.level.goal.position,12,{jumpEvery:5});
  d.evidence.opticalReceivers=d.level.state.optical.receivers;
 }]],
 14:[['carried-friend-fold-with-airborne-release-repickup',d=>runRoom14FoldAttack(d)],
  ['precharged-stair-cargo-pickup-and-E-jump-rush',d=>runRoom14FoldAttack(d,{finish:false,precharge:true})],
  ['free-cargo-push-up-fold-with-bunnyhop',d=>runRoom14FoldAttack(d,{finish:false,freePush:true,interactEvery:0})]],
};

async function attempt(number,name,scenario){
 await g.selectLevel(number-1,false);
 const evidence={shots:[],maxY:-Infinity,maxSpeed:0,teleportPeak:0,milestones:[],physicsSteps:0,simulationSeconds:0,scenarioStarted:false,respawnEvents:[]};let report,error;
 const updater=g.updatePlaying;
 const respawner=g.respawn;
 g.updatePlaying=function(dt){evidence.physicsSteps++;evidence.simulationSeconds+=dt;updater.call(this,dt);evidence.maxY=Math.max(evidence.maxY,this.playerPosition.y);evidence.maxSpeed=Math.max(evidence.maxSpeed,this.playerVelocity.length());evidence.teleportPeak=Math.max(evidence.teleportPeak,this.teleportCount);};
 g.respawn=function(...args){evidence.respawnEvents.push({physicsStep:evidence.physicsSteps,simulationSeconds:evidence.simulationSeconds,scenarioStarted:evidence.scenarioStarted,player:this.playerPosition.toArray(),cargo:this.cargo.position.toArray()});return respawner.apply(this,args);};
 try{report=await runV8Journey(g,{scenario:async base=>{
  evidence.scenarioStarted=true;
  const d={...base,evidence,frame:()=>{base.frame();evidence.maxY=Math.max(evidence.maxY,g.playerPosition.y);evidence.maxSpeed=Math.max(evidence.maxSpeed,g.playerVelocity.length());evidence.teleportPeak=Math.max(evidence.teleportPeak,g.teleportCount);},mark:name=>{evidence.milestones.push(name);base.mark(name);}};
  installRoom21Aim(d);await scenario(d);
 }});}catch(e){error=e.message;}finally{g.updatePlaying=updater;g.respawn=respawner;}
 const blockedKind=error?.includes('unexpected reset')?'reset-aborted-physical-attempt':error?.includes('Rejected shot')?'blocked-by-shot-validation':error?'incomplete-approach-or-setup':'blocked-within-finite-attempt';
 const result={name,completed:g.state==='won',outcome:g.state==='won'?'completed-needs-causal-review':blockedKind,frames:report?.frames??Math.ceil(evidence.physicsSteps/2),frameCountSource:report?'journey-driver-frames':'counted-production-physics-steps-divided-by-two',teleports:g.teleportCount,player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),error:error||null,evidence};
 if(number===1&&result.completed&&g.teleportCount>0&&name==='highest-ceramic-edge-exit-clear-in-flight'){
  result.outcome='completed-with-required-introductory-pair';result.causalReview='Introductory room requires paired travel to the gallery; upper aperture use still performed that physical transfer with the original companion.';
 }
 return result;
}
try{
 for(const number of numbers){
  const room={number,title:campaignSpec(g,number-1).title,attacks:[]};
  const attacks=[['clockwise-perimeter-corner-hop-carry',d=>perimeter(d,true)],['counterclockwise-perimeter-corner-hop-carry',d=>perimeter(d,false)],['cargo-wedge-airborne-pickup-buffers',cargoWedge],['highest-ceramic-edge-exit-clear-in-flight',highEdgePair],...(extra[number]||[])];
  for(const [name,scenario]of attacks){
   if(process.env.ATTACK&&!name.includes(process.env.ATTACK))continue;
   const r=await attempt(number,name,scenario);room.attacks.push(r);console.log('NEW ATTACK',number,name,r.completed,r.error||r.outcome);
  }
  room.suspectedShortcuts=room.attacks.filter(a=>a.completed&&!a.causalReview).map(a=>a.name);summary.rooms.push(room);
 }
}finally{
 g.physics.dispose();g.portals.dispose();
 summary.counts={roomsAttempted:summary.rooms.length,attacks:summary.rooms.reduce((s,r)=>s+r.attacks.length,0),completedWithRequiredMechanic:summary.rooms.reduce((s,r)=>s+r.attacks.filter(a=>a.causalReview).length,0),suspectedShortcuts:summary.rooms.reduce((s,r)=>s+r.suspectedShortcuts.length,0),incompleteApproaches:summary.rooms.reduce((s,r)=>s+r.attacks.filter(a=>a.error).length,0)};
 summary.counts.blockedSpeculativeShots=summary.rooms.reduce((s,r)=>s+r.attacks.filter(a=>a.outcome==='blocked-by-shot-validation').length,0);
 summary.counts.resetAbortedPhysicalAttempts=summary.rooms.reduce((s,r)=>s+r.attacks.filter(a=>a.outcome==='reset-aborted-physical-attempt').length,0);
 summary.counts.setupOrDriverErrors=summary.rooms.reduce((s,r)=>s+r.attacks.filter(a=>a.outcome==='incomplete-approach-or-setup').length,0);
 summary.source.finishedGameSourcesSha256=fingerprint();summary.source.unchangedDuringRun=summary.source.finishedGameSourcesSha256===summary.source.gameSourcesSha256;
 summary.source.finishedHarnessSha256=digest('scripts/qa-speedrun-early-new.mjs');summary.source.finishedFoldHarnessSha256=digest('scripts/lib/room14-fold-speedrun.mjs');
 summary.source.harnessUnchangedDuringRun=summary.source.finishedHarnessSha256===summary.source.harnessSha256&&summary.source.finishedFoldHarnessSha256===summary.source.foldHarnessSha256;summary.source.finished=new Date().toISOString();
 const out=process.env.OUT||'qa/speedrun-early-new.json';fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(summary,null,2));
 console.log('NEW AUDIT SUMMARY',JSON.stringify(summary.counts));
 if(summary.counts.suspectedShortcuts||summary.counts.setupOrDriverErrors||!summary.source.unchangedDuringRun||!summary.source.harnessUnchangedDuringRun)process.exitCode=1;
}
