/** Finite adversarial routes in authored rooms 47–51. The only writes that
 * affect play are ordinary movement, sprint/jump, yaw/pitch, E and projectile
 * inputs. No actor/body pose, velocity, portal frame or puzzle flag is assigned.
 * Failed preparation is reported separately from a physically blocked attack. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
import {createHeadlessGame} from './lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runExpansionBJourney} from '../src/game/LabExpansionJourneyB.js';
import {installRoom21Aim} from '../src/game/LabRoom21Journey.js';

const V=(...p)=>new THREE.Vector3(...p),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const levels=(process.env.ROOMS||'47,48,49,50,51').split(',').map(Number);
if(!levels.every(n=>Number.isInteger(n)&&n>=47&&n<=51))throw Error('ROOMS must contain authored rooms 47–51');
const output=process.env.OUT||'qa/speedrun-expansion-new.json';
function sourceHashes(){return Object.fromEntries(fs.readdirSync('src/game').filter(n=>n.endsWith('.js')).sort().map(n=>['src/game/'+n,sha(fs.readFileSync('src/game/'+n))]));}
const before=sourceHashes(),harnessPath=fileURLToPath(import.meta.url),harnessBefore=sha(fs.readFileSync(harnessPath));
const report={scope:'Finite new causal-omission and speedrun attacks from ordinary Play spawn in the real 120 Hz controller/Cannon simulation. This is headless physics evidence, not WebGL footage or exhaustive exploit proof.',
 inputPolicy:'Only movement, sprint/jump, yaw/pitch camera input, E and normal portal projectile/clear inputs. No assigned actor/body transforms, velocities, mechanism state, portal frames or win flags.',
 source:{commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),gameSourcesSha256:sha(JSON.stringify(before)),gameSources:before,harnessSha256:harnessBefore,started:new Date().toISOString()},rooms:[]};
const game=await createHeadlessGame();game.chamberEdition='foundation';let row;

function state(){
 const l=game.firstLevel,r={player:game.playerPosition.toArray(),cargo:game.cargo.position.toArray(),cargoUuid:game.cargo.group.uuid,cargoBodyId:game.physics.cargoBody.id,
  held:!!game.heldCube,playerGrounded:game.playerGrounded,won:game.state==='won',playerTeleports:game.teleportCount,cargoTeleports:game.physics.portalTransports};
 if(l.fuse)r.fuse={broken:l.fuse.broken,energy:l.fuse.energy};
 if(l.press)r.press={running:l.press.running,pinned:l.press.pinned,gap:l.press.gap,loaded:l.press.loaded(),door:l.door.progress,hood:l.roof.progress};
 if(l.head)r.head={angle:l.head.angle,arm:l.head.arm,lit:l.head.lit,clamped:l.head.clamped,door:l.door.progress,rayKinds:l.head.segments.map(s=>s.kind)};
 if(l.top)r.hinge={angle:l.top.angle,guard:l.bumper.progress};
 if(l.echoHorizon)r.echo={emitted:l.field.emitted,arrivals:l.field.arrivals,membranes:l.coincidence.membranes,latched:l.coincidence.latched};
 if(l.shuttle)r.relay={position:l.shuttle.position.toArray(),target:l.shuttle.target,braked:l.shuttle.braked,loaded:!!l.clutch.loaded(),at:[0,1,2].map(i=>l.shuttle.at(i))};
 return r;
}
function save(){fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');}
function note(label,extra={}){row.events.push({label,...extra,physicsStep:row.physicsSteps,simulationFrame:Math.ceil(row.physicsSteps/2),state:state()});}
function force(d,target,seconds,{jump=true,veer=0,sprint=true,everyE=0}={}){
 const began=state();if(sprint)game.input.keys.add('ShiftLeft');
 for(let f=0;f<seconds*60&&game.state==='playing';f++){
  const delta=target.clone().sub(game.playerPosition);delta.y=0;
  if(delta.length()<.16&&Math.abs(game.playerPosition.y-target.y)<.3)break;
  delta.normalize().applyAxisAngle(V(0,1,0),veer);d.worldMove(delta.x,delta.z);
  if(jump&&f%37===0)game.input.jumpQueued=true;
  if(everyE&&f%everyE===0)game.interact();d.frame();
 }d.stop();row.routes.push({target:target.toArray(),seconds,jump,veer,sprint,everyE,began,ended:state()});
}
function boundedWalk(d,x,z,seconds=12){
 try{d.walk(x,z,seconds);return true;}
 catch(error){if(!/Blocked walking|Walk timed out/.test(error.message))throw error;row.obstacles.push(error.message);d.stop();return false;}
}
function collect(d,{required=true}={}){
 if(game.heldCube)return true;
 for(const [dx,dz]of [[1.25,0],[-1.25,0],[0,1.25],[0,-1.25]]){
  const p=game.cargo.position.clone();if(!boundedWalk(d,p.x+dx,p.z+dz,6))continue;
  if(game.interact()&&game.heldCube){d.wait(.35);note('Original cargo collected through E');return true;}
 }
 row.obstacles.push('Original cargo cannot be collected from the physically reached position');
 if(required)throw Error('Preparation: original companion unreachable');return false;
}
function peekShot(d,index,point,label){
 if(game.heldCube){row.obstacles.push('Shot unavailable with ordinary occupied hands: '+label);return false;}
 d.look(point);const accepted=game.firePortal(index);
 if(accepted)d.until(()=>!game.portalShots.queue.length&&!game.portalShots.active.length,3,'Attack shot charge resolution');
 const receipt={label,from:game.playerPosition.toArray(),aim:point.toArray(),accepted,valid:!!(accepted&&game.portalShots.lastImpact?.valid),impact:accepted?game.portalShots.lastImpact:null};
 row.shots.push(receipt);return receipt.valid;
}
async function cut(d,mark){
 const signal=Symbol('causal-cut');let reached=false;
 const wrapped={...d,mark:name=>{d.mark(name);if(name===mark){reached=true;throw signal;}}};
 try{await runExpansionBJourney(wrapped);}catch(error){if(error!==signal)throw error;}
 if(!reached)throw Error('Preparation failed to reach causal cut '+mark);note('Authored input route cut before next causal action',{mark});
}
async function beforeDelivery(d){await runExpansionBJourney(d,{stopBeforeDelivery:true});note('Authored setup stopped before original cargo delivery');}
function pushFrames(d,x,z,count,{jumpEvery=0,releaseAt=null}={}){
 game.input.keys.add('ShiftLeft');for(let n=0;n<count&&game.state==='playing';n++){
  if(jumpEvery&&n%jumpEvery===0)game.input.jumpQueued=true;d.worldMove(x,z);d.frame();
  if(n===releaseAt){const accepted=game.interact();note('Moving jump release through E',{accepted,releaseAt});}
 }d.stop();
}
function enterJump(d,panel){
 const f=panel.getFrame(),before=game.teleportCount;d.walk(f.center.x+f.normal.x*1.35,f.center.z+f.normal.z*1.35);
 for(let n=0;n<240&&game.teleportCount===before;n++){if(n%45===0)game.input.jumpQueued=true;d.worldMove(-f.normal.x,-f.normal.z);d.frame();}
 d.stop();if(game.teleportCount===before)throw Error('Preparation: jump portal entry failed at '+game.playerPosition.toArray());
 d.until(()=>game.playerGrounded,4,'Preparation moving cabin landing');
}
function aroundGate(d,{z,left,right,goal},seconds=6){
 for(const x of [left+.15,0,right-.15]){
  force(d,V(x,game.playerPosition.y,z+.85),seconds,{veer:Math.sign(x)*.1});
  force(d,V(x,game.playerPosition.y,z-1.5),seconds,{veer:-Math.sign(x)*.2});
  if(game.state==='won')break;
 }force(d,goal,8,{veer:.12});
}
function apertureTraverse(d,panel,approach,{direction=1,targetY=0}={}){
 const f=panel.getFrame();
 for(const offset of [-.58,0,.58]){
  force(d,V(approach.x+offset,approach.y,approach.z),5,{jump:false});
  // The corner aim is a normal projectile fired while the player is unheld.
  const point=f.center.clone().addScaledVector(f.right,offset).addScaledVector(f.up,.18);
  if(!game.heldCube)peekShot(d,1,point,'cargo-only aperture corner '+offset);
  force(d,V(approach.x+offset,targetY,approach.z+direction*4),6,{veer:offset*.12});
 }note('Cargo-only aperture centre and both lateral corners attempted');
}
function supportChain(d,target,maxSteps=20){
 // Read existing solid roofs/floors to choose speculative jump targets only.
 // Every edge of the resulting route still needs real controller movement.
 const roofs=[...game.floors.filter(f=>f.enabled!==false).map(f=>({name:f.mesh?.name||'floor',x0:f.minX,x1:f.maxX,z0:f.minZ,z1:f.maxZ,y:f.y})),
  ...game.colliders.filter(c=>c.enabled!==false&&!c.walkablePlane).map(c=>({name:c.mesh?.name||'existing chassis/roof',x0:c.box.min.x,x1:c.box.max.x,z0:c.box.min.z,z1:c.box.max.z,y:c.box.max.y}))]
  .filter(s=>s.x1-s.x0>.08&&s.z1-s.z0>.08&&Number.isFinite(s.y)&&s.y>=game.playerPosition.y-.5&&s.y<=target.y+1);
 const p=game.playerPosition,inside=(s,q)=>q.x>=s.x0-.08&&q.x<=s.x1+.08&&q.z>=s.z0-.08&&q.z<=s.z1+.08;
 const queue=[],parent=new Map();for(let i=0;i<roofs.length;i++)if(inside(roofs[i],p)&&Math.abs(roofs[i].y-p.y)<.35){queue.push(i);parent.set(i,-1);}
 let selected=queue[0],goalFound=false;
 for(let n=0;n<queue.length;n++){
  const i=queue[n],a=roofs[i];if(selected===undefined||a.y>roofs[selected].y)selected=i;
  if(inside(a,target)&&Math.abs(a.y-target.y)<.35){selected=i;goalFound=true;break;}
  for(let j=0;j<roofs.length;j++){
   if(parent.has(j))continue;const b=roofs[j],dy=b.y-a.y;if(dy>1.6||dy<-.5)continue;
   const dx=Math.max(0,a.x0-b.x1,b.x0-a.x1),dz=Math.max(0,a.z0-b.z1,b.z0-a.z1);
   if(Math.hypot(dx,dz)>2.2)continue;parent.set(j,i);queue.push(j);
  }
 }
 const route=[];while(selected!==undefined&&selected!==-1){route.push(roofs[selected]);selected=parent.get(selected);}route.reverse();
 row.supportGraphs.push({goalFound,reachable:parent.size,route});
 for(const s of route.slice(1,maxSteps)){
  const insetX=Math.min(.18,(s.x1-s.x0)/2),insetZ=Math.min(.18,(s.z1-s.z0)/2);
  force(d,V(THREE.MathUtils.clamp(game.playerPosition.x,s.x0+insetX,s.x1-insetX),s.y,THREE.MathUtils.clamp(game.playerPosition.z,s.z0+insetZ,s.z1-insetZ)),5);
  if(Math.abs(game.playerPosition.y-s.y)>.5){row.obstacles.push('Physically rejected roof/chassis jump at '+s.name+' / targetY '+s.y);break;}
 }force(d,target,8,{veer:.1});
}

const attacks={
 47:[
  {name:'jump-release-free-cargo-into-fuse-without-gravity-portals',omitted:'Gravity well delivery and cargo portal launch',run:async d=>{
   collect(d);for(const [x,z]of [[-8,9],[-8,25.5],[-8,0],[0,0]])d.walk(x,z);
   force(d,V(0,0,-2.2),4,{jump:false});note('Ground manual impact position reached');
   for(let cycle=0;cycle<4&&game.state==='playing'&&!d.level.fuse.broken;cycle++){
    if(!collect(d,{required:false}))break;force(d,V(0,0,-1.8),3,{jump:false});
    game.input.jumpQueued=true;pushFrames(d,0,-1,100,{releaseAt:12});d.wait(.5);
   }aroundGate(d,{z:-4,left:-3.3,right:3.3,goal:d.level.goal.position});
  }},
  {name:'cargo-only-jet-aperture-centre-and-corner-player-traversal',omitted:'Original cargo fall that breaks safety sheet',run:async d=>{
   await beforeDelivery(d);for(const [x,z]of [[-16,9.1],[-8,9],[-8,25.5],[6,18],[6,0],[0,0]])d.walk(x,z);
   apertureTraverse(d,d.level.outlet,V(0,0,3.5),{direction:1,targetY:1.5});
   aroundGate(d,{z:-4,left:-3.3,right:3.3,goal:d.level.goal.position});
  }},
  {name:'unbroken-sheet-side-joints-with-carried-original-companion',omitted:'Every portal placement and fracture impact',run:async d=>{
   collect(d);for(const [x,z]of [[-8,9],[-8,25.5],[-8,0]])d.walk(x,z);
   for(const x of [-3.39,-3.0,3.0,3.39]){
    force(d,V(x,0,-2.5),6,{veer:.2});force(d,V(x,0,-6.5),6,{veer:-.2});
   }force(d,d.level.goal.position,10);
  }},
 ],
 48:[
  {name:'delivered-cargo-without-press-motor-inspection-housing-climb',omitted:'Motor activation and far pawl',run:async d=>{
   d.walk(-11,13);d.aim(1,d.level.mouth.getFrame().center);d.aim(0,d.level.feed.surface.getFrame().center.clone().add(V(-.6,0,-.05)));
   collect(d);d.walk(-17,18.3);d.stop();d.wait(.2);game.interact();d.wait(.65);d.until(()=>game.physics.portalTransports>0,5,'Prepared cargo feed did not cross');game.clearPortals();d.wait(1);
   note('Original cargo delivered, motor deliberately left idle');
   aroundGate(d,{z:2,left:-3,right:3,goal:V(8,0,-12)});
   for(const [x,z]of [[-3.3,-2.6],[0,-2.3],[3.3,-2.6]]){force(d,V(x,2.7,z),5,{everyE:45});}
   force(d,d.level.goal.position,6);
  }},
  {name:'cargo-jammed-open-door-without-far-pawl-retrieve-through-hood',omitted:'Far press stop and inspection hood opening',run:async d=>{
   await cut(d,'The original body physically jams the motor stroke');d.walk(0,7);d.walk(0,-1);note('Observer crossed jammed door; far pawl deliberately omitted');
   for(const [x,z]of [[-3.8,-2.4],[0,-2.0],[3.8,-2.4],[3.8,-5]])force(d,V(x,2.8,z),6,{everyE:19});
   collect(d,{required:false});force(d,V(8,0,-1),5);force(d,V(6,0,-12),6);force(d,d.level.goal.position,8);
  }},
  {name:'empty-motor-vent-corner-jump-rush-during-opening-transient',omitted:'Original cargo feed and physical jaw contact',run:async d=>{
   d.walk(-11,13);d.aim(1,d.level.mouth.getFrame().center);d.aim(0,d.level.feed.surface.getFrame().center.clone().add(V(-.6,0,-.05)));
   d.walk(-18,9.5);if(!game.interact())throw Error('Preparation: empty press motor control missed');note('Empty press transient activated; sprint begins without waiting');
   for(const x of [-7.4,-6.6,-3.15,0,3.15]){force(d,V(x,0,3.1),4,{jump:false});force(d,V(x,1.3,-.9),4,{veer:.1});}
   force(d,V(8,0,-12),8,{everyE:21});force(d,d.level.goal.position,8);
  }},
 ],
 49:[
  {name:'unclamped-live-reflection-recover-load-and-race-closing-door',omitted:'Mirror clamp that preserves actual reflected normal',run:async d=>{
   await cut(d,'Portal ray reflects from the cargo torqued live mirror normal');d.until(()=>d.level.door.progress>.98,5,'Preparation: live reflected door did not open fully');note('Unclamped door fully open before removal race');collect(d);note('Live load removed without clamping mirror');
   for(const [x,z]of [[8,6],[8,-7],[0,-7],[0,-22]])force(d,V(x,0,z),8,{jump:true});
  }},
  {name:'dark-clamped-mirror-portal-edge-reaim-without-correct-load',omitted:'Correct load moment before mirror clamp',run:async d=>{
   await beforeDelivery(d);d.walk(7,10.3);if(!game.interact())throw Error('Preparation: mirror clamp control missed');note('Wrong angle physically clamped');d.walk(8,12);d.walk(-12,12);d.walk(-12,3);
   const f=d.level.outlet.getFrame();for(const [x,y]of [[-2.9,-1.4],[-2.9,1.4],[2.9,-1.4],[2.9,1.4],[0,0]])peekShot(d,1,f.center.clone().addScaledVector(f.right,x).addScaledVector(f.up,y),'dark mirror outlet corner');
   collect(d,{required:false});aroundGate(d,{z:-13,left:-3,right:3,goal:d.level.goal.position});
  }},
  {name:'carry-original-load-around-dark-receiver-door-side-seams',omitted:'Optical portal pair, load steering and clamp',run:async d=>{
   collect(d);d.walk(8,6);d.walk(8,-7);aroundGate(d,{z:-13,left:-3,right:3,goal:d.level.goal.position});
   for(const x of [-3.4,3.4]){force(d,V(x,0,-11.7),4);force(d,V(x,0,-15),6,{veer:x<0?-.3:.3});}force(d,d.level.goal.position,8);
  }},
 ],
 50:[
  {name:'upright-hinge-west-service-route-north-dock-chassis-jump',omitted:'High-energy cargo impact and fallen structural bridge',run:async d=>{
   collect(d);for(const [x,z]of [[-23,11],[-23,-17],[-15,-17],[-15,3.25],[0,3.25]])d.walk(x,z);
   for(const x of [-10.5,10.5]){
    force(d,V(x,-4,-12),8,{veer:x<0?-.1:.1});force(d,V(x,-4,-18),6);supportChain(d,V(x,0,-20.5));
   }force(d,d.level.goal.position,8);
  }},
  {name:'grounded-jump-release-contact-above-hinge-guard-without-fall',omitted:'Gravity well and high aperture cargo impact',run:async d=>{
   collect(d);for(const [x,z]of [[-23,11],[-23,-17],[-15,-17],[-15,3.25],[0,3.25],[0,15.5],[8,15.5],[8,0],[0,0]])d.walk(x,z);
   for(let cycle=0;cycle<4&&d.level.top.angle>-.14;cycle++){
    collect(d,{required:false});force(d,V(0,0,-2.0),4,{jump:false});
    game.input.jumpQueued=true;pushFrames(d,0,-1,100,{releaseAt:16});d.wait(.8);
   }force(d,V(4.5,-4,-10),8,{veer:.15});force(d,d.level.goal.position,8);
  }},
  {name:'small-high-impact-aperture-prepared-pair-player-corner-entry',omitted:'Original falling companion that turns wall into a bridge',run:async d=>{
   await beforeDelivery(d);note('Impact portal pair prepared without gravity delivery');
   for(const [x,z]of [[-23,17],[-23,-17],[-15,-17],[-15,3.25],[0,3.25]])d.walk(x,z);
   const f=d.level.well.surface.getFrame();
   for(const offset of [-.55,0,.55]){force(d,V(f.center.x+offset,-4,f.center.z+2),5,{jump:false});force(d,V(f.center.x+offset,-4,f.center.z-2),7,{veer:offset*.1});}
   force(d,V(10,-4,-17),8);supportChain(d,d.level.goal.position);
  }},
 ],
 51:[
  {name:'one-live-membrane-cargo-jump-central-bulkhead',omitted:'Two live pressure arrivals and common latch',run:async d=>{
   d.walk(-1,14.7);d.aim(0,d.level.intake.getFrame().center);d.aim(1,d.level.short.getFrame().center);
   // Actually deliver, not just fire near a receiver. Re-aiming uses only
   // the camera and native charged portal projectile.
   for(let i=0;i<3&&!d.level.field.arrivals.length;i++){
    d.aim(1,d.level.short.getFrame().center);d.until(()=>d.level.charge.value>.99,3,'Load must recharge');game.interact();d.wait(3);
   }
   if(!d.level.field.arrivals.some(a=>a.receiver==='short'))throw Error('Preparation: near membrane was not reached');
   note('Actual near hit occurred without a far arrival');collect(d);d.walk(0,8);d.walk(0,-9.5);
   force(d,d.level.goal.position,10);supportChain(d,d.level.goal.position);
  }},
  {name:'departed-long-packet-pair-erased-wall-top-probe',omitted:'Second staggered pressure packet',run:async d=>{
   d.walk(-1,14.7);d.aim(0,d.level.intake.getFrame().center);d.aim(1,d.level.long.getFrame().center);
   d.until(()=>d.level.charge.value>.99,3,'Load must recharge');game.interact();
   d.until(()=>d.level.field.packets.some(p=>p.portalCrossings>0),3,'Packet did not depart');game.clearPortals();
   d.until(()=>d.level.field.arrivals.some(a=>a.receiver==='long'),6,'Departed packet was not physically received');
   note('Real long hit survived erased portals, without a short arrival');collect(d);d.walk(-21,8);d.walk(-21,-9.5);
   force(d,V(-21,0,-24),12,{veer:-.1});supportChain(d,d.level.goal.position);
  }},
  {name:'unpowered-east-bulkhead-and-signal-aperture-cargo-jump',omitted:'Striker and both transient receiver membranes',run:async d=>{
   collect(d);d.walk(21,8);d.walk(21,-9.5);note('Loaded player actually reached east structural wall');
   force(d,V(21,0,-24),12,{veer:.1});force(d,V(15,4.4,-8),7);supportChain(d,d.level.goal.position);
  }},
 ],
};

async function run(number,attack){
 await game.selectLevel(number-1,false);const cargo=game.cargo,body=game.physics.cargoBody;
 row={room:number,name:attack.name,omitted:attack.omitted,originalCargoUuid:cargo.group.uuid,originalCargoBodyId:body.id,
  started:new Date().toISOString(),sourceBefore:sha(JSON.stringify(sourceHashes())),harnessBefore:sha(fs.readFileSync(harnessPath)),frames:0,controlHookFrames:0,physicsSteps:0,events:[],routes:[],shots:[],supportGraphs:[],obstacles:[],samples:[],minPlayerZ:Infinity,maxPlayerY:-Infinity,maxFuseEnergy:0,minHingeAngle:0,maxDoorProgress:0};
 let proof,error=null,prepared=false,resets=0,respawns=0;const update=game.updatePlaying,resetCargo=game.physics.resetCargo,respawn=game.respawn,initial=state();
 game.respawn=function(...args){respawns++;return respawn.apply(this,args);};game.physics.resetCargo=function(...args){resets++;return resetCargo.apply(this,args);};
 game.updatePlaying=function(dt){const r=update.call(this,dt);row.physicsSteps++;row.minPlayerZ=Math.min(row.minPlayerZ,this.playerPosition.z);row.maxPlayerY=Math.max(row.maxPlayerY,this.playerPosition.y);
  row.maxFuseEnergy=Math.max(row.maxFuseEnergy,this.firstLevel.fuse?.energy||0);row.minHingeAngle=Math.min(row.minHingeAngle,this.firstLevel.top?.angle||0);row.maxDoorProgress=Math.max(row.maxDoorProgress,this.firstLevel.door?.progress||0);
  if(row.physicsSteps%120===0)row.samples.push({physicsStep:row.physicsSteps,state:state()});
  return r;};
 try{proof=await runV8Journey(game,{scenario:async base=>{
  resets=respawns=0;const d={...base,frame:()=>{base.frame();row.controlHookFrames++;}};installRoom21Aim(d);prepared=true;await attack.run(d);
 }});}catch(e){error=e.message;}finally{game.updatePlaying=update;game.respawn=respawn;game.physics.resetCargo=resetCargo;}
 row.initial=initial;row.final=state();row.error=error;row.sameOriginalCargo=game.cargo===cargo;row.sameOriginalBody=game.physics.cargoBody===body;
 row.frames=proof?.frames??Math.ceil(row.physicsSteps/2);row.resets=resets;row.respawns=respawns;row.finished=new Date().toISOString();
 row.sourceAfter=sha(JSON.stringify(sourceHashes()));row.harnessAfter=sha(fs.readFileSync(harnessPath));row.sourceStable=row.sourceBefore===row.sourceAfter;row.harnessStable=row.harnessBefore===row.harnessAfter;
 row.outcome=error?(/unexpected reset|identity changed/i.test(error)?'production-reset-or-identity-failure':'setup-or-driver-error'):
  row.final.won?'completed-requires-causal-review':'blocked-in-finite-attempt';
 row.preparationDriverInitialized=prepared;console.log('EXPANSION ATTACK',number,attack.name,row.outcome,error||'');return row;
}
try{
 for(const number of levels){const entry={number,attacks:[]};report.rooms.push(entry);
  for(const attack of attacks[number]){if(process.env.KIND&&!process.env.KIND.split(',').some(k=>attack.name.includes(k)))continue;entry.attacks.push(await run(number,attack));save();}
 }
}finally{
 const after=sourceHashes();report.source.finished=new Date().toISOString();report.source.gameSourcesAfterSha256=sha(JSON.stringify(after));report.source.harnessAfterSha256=sha(fs.readFileSync(harnessPath));
 report.source.changedGameFiles=Object.keys(before).filter(p=>before[p]!==after[p]);report.source.sourceStable=!report.source.changedGameFiles.length;report.source.harnessStable=report.source.harnessSha256===report.source.harnessAfterSha256;
 const all=report.rooms.flatMap(r=>r.attacks);report.summary={attacks:all.length,blockedFinite:all.filter(a=>a.outcome==='blocked-in-finite-attempt').length,completed:all.filter(a=>a.final.won).length,setupOrDriverErrors:all.filter(a=>a.outcome==='setup-or-driver-error').length,resetOrIdentityFailures:all.filter(a=>a.outcome==='production-reset-or-identity-failure').length,originalCargoPreserved:all.every(a=>a.sameOriginalCargo&&a.sameOriginalBody)};
 report.pass=all.length>0&&report.source.sourceStable&&report.source.harnessStable&&all.every(a=>a.sourceStable&&a.harnessStable&&a.outcome==='blocked-in-finite-attempt'&&a.sameOriginalCargo&&a.sameOriginalBody&&a.resets===0&&a.respawns===0);
 if(!report.pass)process.exitCode=1;
 save();game.firstLevel.dispose?.();game.physics.dispose();game.portals.dispose();console.log(JSON.stringify(report.summary));
}
