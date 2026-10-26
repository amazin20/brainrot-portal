import * as THREE from 'three';
import {runV8Journey} from '../../src/game/LabV8Journey.js';
import {room12Access,room12FreightAim,room12CollectFreight,aimRoom12} from '../../src/game/LabRoom12Journey.js';
import {room13Access,room13Light} from '../../src/game/LabRoom13Journey.js';
import {runRoom14} from '../../src/game/LabRoom14Journey.js';
import {room15Extract,room15Ascend} from '../../src/game/LabRoom15Journey.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const check=(ok,message)=>{if(!ok)throw Error(message);};
const vector=value=>value?.toArray?.()??Array.from(value??[]);
const copy=value=>value===undefined?null:JSON.parse(JSON.stringify(value));
function snapshot(g){
 const s=g.firstLevel.state??{},b=g.physics.cargoBody;
 return {player:vector(g.playerPosition),velocity:vector(g.playerVelocity),cargo:vector(g.cargo.position),cargoVelocity:[b.velocity.x,b.velocity.y,b.velocity.z],held:Boolean(g.heldCube),grounded:Boolean(g.playerGrounded),state:g.state,won:g.state==='won',teleports:g.teleportCount,cargoTransports:g.physics.portalTransports,worldStep:g.physics.world.stepnumber,
  causes:{fanEnabled:s.blower?.enabled??null,drivePower:s.flywheel?.power??null,driveWork:s.flywheel?.wheel.work??null,ratchet:s.ratchet?.engaged??null,mirrorLoaded:s.optical?.loaded??null,opticalReceivers:s.optical?[...s.optical.receivers]:null,northCage:s['north-cage']?.position.y??null,southCage:s['south-cage']?.position.y??null,stairOffset:s.counterweightStair?.offset??null,stairSupported:s.counterweightStair?.supported??null,lightSegments:s.lightBridge?.segments.length??null,funnelReversed:s.funnel?.reversed??null,funnelSegments:s.funnel?.segments.map(p=>({a:vector(p.a),b:vector(p.b),direction:vector(p.direction)}))??null}};
}
function rush(d,x,y,z,seconds=5,{jumpEvery=31,interactEvery=0}={}){
 const g=d.game;g.input.keys.add('ShiftLeft');
 for(let n=0;n<Math.ceil(seconds*60)&&g.state==='playing';n++){
  const delta=V(x,y,z).sub(g.playerPosition);delta.y=0;if(delta.lengthSq()>1e-10)delta.normalize();d.worldMove(delta.x,delta.z);
  if(jumpEvery&&n%jumpEvery===0){g.input.jumpQueued=true;d.evidence.jumpInputs++;}
  if(interactEvery&&n%interactEvery===0){g.interact();d.evidence.interactInputs++;}
  d.frame();
 }
 d.stop();
}
async function prefix14(d,at){
 const cut=Symbol(at);let reached=false;
 try{await runRoom14({...d,mark:name=>{d.mark(name);if(name===at){reached=true;throw cut;}}});}catch(error){if(error!==cut)throw error;}
 check(reached,'The real room14 approach did not reach '+at);
}

export const SECOND_CHAPTER_EARLY_ATTACKS=[
 {level:11,name:'unpowered-door-jambs-and-partition-crown',run(d){
  d.walk(1,7.5);d.pickup();d.walk(3,-9.5);d.beginTarget('same companion at the closed unpowered partition',!d.level.state.ratchet.engaged&&d.level.state.flywheel.wheel.work===0&&d.game.heldCube);
  for(const [x,z]of [[2.6,-14],[-2.6,-14],[0,-16]])rush(d,x,9,z,3.5,{jumpEvery:19});
  d.mark('both jambs and crown approached without drive work');
 }},
 {level:11,name:'paired-idle-air-source-and-door-crossing',run(d){
  d.aim(0,d.level.panels['wind-intake'].getFrame().center);d.aim(1,d.level.panels['wind-outlet'].getFrame().center);d.walk(1,7.5);d.pickup();d.walk(-3,-9.5);
  d.beginTarget('portal pair addresses the idle fan while the real latch stays down',d.game.portals.ready&&!d.level.state.blower.enabled&&!d.level.state.ratchet.engaged);
  for(const x of [-3,0,3])rush(d,x,0,-16,3,{jumpEvery:23});d.mark('paired apertures supplied no mechanical work');
 }},
 {level:12,name:'lower-return-cargo-jumps-under-receiving-dock',run(d){
  d.walk(d.game.cargo.position.x-.9,d.game.cargo.position.z);d.pickup();d.walk(4,12);d.walk(4,5.5);
  d.beginTarget('original carried companion below the elevated receiving dock',d.game.heldCube&&d.game.playerPosition.y<.2&&d.level.goal.position.y>8.9);
  for(const [x,z]of [[7,5.5],[10,4],[14,4]])rush(d,x,9,z,3.5,{jumpEvery:17});d.mark('direct lower approach exercised the nine metre separation');
 }},
 {level:12,name:'jumping-owner-at-shared-freight-throat',run(d){
  room12Access(d,{carry:true});d.walk(-15,-8);d.walk(-15,14);d.walk(-10,14);d.game.interact();d.wait(.8);
  d.walk(-15,14);d.walk(-15,-8);d.walk(-9,-8);room12FreightAim(d);d.walk(-9,-7.2);aimRoom12(d,0,V(-10,.025,9.8));d.walk(-15,-8);d.walk(-15,14);
  room12CollectFreight(d);d.walk(-10,11.65);
  d.beginTarget('same loaded traveller at the genuine freight drop',d.game.heldCube&&d.game.playerPosition.y>6.9&&d.game.portals.ready);
  rush(d,-10,7,9.8,5,{jumpEvery:19});rush(d,10,9,4,5,{jumpEvery:23});d.mark('owner attempts the cargo route using repeated ordinary jumps');
 }},
 {level:13,name:'release-mirror-during-partial-south-ascent',run(d){
  room13Access(d);d.walk(-16,-15.2);d.walk(-16,-12);d.walk(-12,-6);d.walk(-12,-2);d.walk(-14,3);d.walk(-10,3);d.look(d.level.panels['mirror-cradle'].getFrame().center.clone().add(V(0,2,0)));d.walk(-10,.85);d.wait(.7);d.game.interact();d.wait(1.8);
  const portrait=d.game.camera.aspect<1;
  check(d.level.state.optical.loaded,'The real companion did not load the mirror');room13Light(d,{settleSeconds:portrait?.4:2});
  // In portrait the camera's real sight to the lower mirror passes through
  // the cab floor from the rear. Reach its front edge during early ascent,
  // then jump for the shot while the cage is still below the upper gallery.
  if(portrait)d.walk(-11.8,9.2);
  d.until(()=>d.game.playerPosition.y>8.2,12,'Partial optical ascent');
  d.beginTarget('live southern lift has not completed its ascent',d.level.state.optical.receivers[1]&&d.level.state['south-cage'].position.y<11.9);
  if(portrait){d.game.input.jumpQueued=true;d.evidence.jumpInputs++;d.frame();}
  d.aim(0,d.level.panels['mirror-cradle'].getFrame().center);d.wait(2);d.mark('ordinary floor shot releases the shared mirror and light address');rush(d,-10,12,14.5,4,{jumpEvery:19});d.mark('attempted continued ascent after the physical ray was lost');
 }},
 {level:13,name:'unloaded-north-gallery-receiver-leap',run(d){
  room13Access(d,{carry:false});d.walk(-16,-15.2);d.walk(-16,-12);d.walk(-12,-6);room13Light(d,{branch:'north'});d.until(()=>d.game.playerPosition.y>11.98,12,'Genuine unloaded northern ascent');d.walk(-10,-14.5);d.walk(7,-14.5);
  d.beginTarget('unloaded mirror raised the northern gallery while the friend remains below',!d.level.state.optical.loaded&&d.game.cargo.position.y<1&&d.game.playerPosition.y>11.9);
  for(const [x,z]of [[9,-10],[13,2.5],[9,2.5]])rush(d,x,12,z,3.5,{jumpEvery:17});d.mark('north dividing wall and receiving enclosure attacked from the earned gallery');
 }},
 {level:14,name:'unloaded-fold-sprint-with-carried-companion',async run(d){
  await prefix14(d,'stable island reached');d.walk(-1.5,0);
  d.beginTarget('first light crossing completed while the stair has no free load',d.game.heldCube&&d.game.playerPosition.y>7.3&&!d.level.state.counterweightStair.supported&&d.level.state.counterweightStair.offset<-7.1);
  rush(d,-1.5,12,-12.7,10,{jumpEvery:13});d.mark('carried-companion sprint and repeated jumps meet the lowered fold');
 }},
 {level:14,name:'west-landing-jump-before-light-is-routed',async run(d){
  await prefix14(d,'light landing reached');d.walk(-13.5,0);
  d.beginTarget('real west landing reached before the source sheet is routed',d.game.heldCube&&d.game.playerPosition.y>5.9&&d.level.state.lightBridge.segments.length===1);
  rush(d,-1.5,7.4,0,5,{jumpEvery:17});d.mark('first air gap approached without its projected support');
 }},
 {level:15,name:'front-freight-observation-jump-and-grab',run(d){
  d.walk(-20,18.3);d.walk(-20,9);d.walk(-20,-4);d.walk(-14.5,-4);d.walk(-14.5,-4.5);
  d.beginTarget('normal lower return reaches the occupied freight observation slot',d.game.playerPosition.y<.2&&d.game.cargo.position.y>2&&!d.game.heldCube&&d.game.teleportCount===0);
  for(let n=0;n<480&&d.game.state==='playing'&&!d.game.heldCube;n++){
   const delta=d.game.cargo.position.clone().sub(d.game.playerPosition);delta.y=0;delta.normalize();d.worldMove(delta.x,delta.z);d.game.input.keys.add('ShiftLeft');
   if(n%29===0){d.game.input.jumpQueued=true;d.evidence.jumpInputs++;}if(n%7===0){d.game.interact();d.evidence.interactInputs++;}d.frame();
  }d.stop();d.mark('jumping grab attempts through the real double observation slot');check(!d.game.heldCube,'Original companion retrieved before the freight field was routed');
 }},
 {level:15,name:'upper-pocket-loaded-jump-around-dividing-spine',run(d){
  room15Extract(d);room15Ascend(d,{carry:true});d.walk(d.game.cargo.position.x-1,d.game.cargo.position.z);d.pickup();d.walk(-4,0);
  d.beginTarget('original companion retrieved on the earned upper lift pocket',d.game.heldCube&&d.game.playerPosition.y>11.9&&d.game.playerPosition.y<12.2);
  for(const [x,z]of [[-1.5,-4],[4,-7],[14,-12]])rush(d,x,14,z,4,{jumpEvery:19});d.mark('loaded traveller attacks the spine without the transverse field');
 }},
];

function geometryWitness(roots){
 const items=[];for(const root of roots)root.traverse(node=>{if(!node.isMesh)return;const geometry=node.geometry;items.push({node,geometry,index:geometry.index?.array??null,attributes:Object.entries(geometry.attributes).map(([name,a])=>[name,a.array])});});
 return {count:items.length,same:()=>items.every(({node,geometry,index,attributes})=>node.geometry===geometry&&(geometry.index?.array??null)===index&&attributes.every(([name,array])=>geometry.attributes[name]?.array===array))};
}

/** Observe finite ordinary-input shortcuts from the untouched Play spawn.
 * Prefix journeys only approach the attack; no actor/actuator pose is assigned.
 * A thrown approach or shot is retained as failure and never called blocked. */
export async function observeSecondChapterEarlyAttack(game,entry,{nativeStart=true}={}){
 check(SECOND_CHAPTER_EARLY_ATTACKS.includes(entry),'Use an actual second chapter early catalogue entry');
 const original={cargo:game.cargo,group:game.cargo.group,player:game.playerGroup,body:game.physics.cargoBody,shape:game.physics.cargoBody.shapes[0],world:game.physics.world},geometry=geometryWitness([game.playerGroup,game.cargo.group]);
 const initial=snapshot(game),start=game.physics.world.stepnumber,spawn=vector(game.firstLevel.spawn),cargoSpawn=vector(game.firstLevel.cargoSpawn);
 const distance=(actual,expected)=>actual.length===3&&expected.length===3?Math.hypot(...actual.map((x,i)=>x-expected[i])):Infinity;
 const row={level:entry.level,name:entry.name,pass:false,completed:false,error:null,nativeStart,normalSpawn:game.state==='playing'&&start===0&&game.elapsed===0&&distance(initial.player,spawn)<1e-8&&distance(initial.cargo,cargoSpawn)<1e-8&&!game.heldCube&&!game.portals.ready&&game.teleportCount===0,approachComplete:false,targetStarted:false,targetFrames:0,physicsSteps:0,simulationSeconds:0,jumpInputs:0,interactInputs:0,resets:0,respawns:0,shots:[],milestones:[],trajectory:[{phase:'start',...initial}],initial,peak:{playerY:initial.player[1],cargoY:initial.cargo[1]},geometryMeshes:geometry.count};
 const oldUpdate=game.updatePlaying,oldReset=game.resetRun,oldRespawn=game.respawn,oldCargoReset=game.physics.resetCargo;let journey;
 const identity=()=>game.cargo===original.cargo&&game.cargo.group===original.group&&game.playerGroup===original.player&&game.physics.cargoBody===original.body&&game.physics.world===original.world&&game.physics.cargoBody.shapes[0]===original.shape;
 game.resetRun=function(...args){row.resets++;return oldReset.apply(this,args);};game.respawn=function(...args){row.respawns++;return oldRespawn.apply(this,args);};game.physics.resetCargo=function(...args){row.resets++;return oldCargoReset.apply(this,args);};
 game.updatePlaying=function(dt){oldUpdate.call(this,dt);row.physicsSteps++;row.simulationSeconds+=dt;row.peak.playerY=Math.max(row.peak.playerY,this.playerPosition.y);row.peak.cargoY=Math.max(row.peak.cargoY,this.cargo.position.y);check(identity(),'Original actor/body/world replaced');check(geometry.same(),'Original actor mesh buffers replaced');check(row.resets===0&&row.respawns===0,'Attack reset or respawned after Play');if(row.physicsSteps%24===0)row.trajectory.push({phase:row.targetStarted?'target':'approach',...snapshot(this)});};
 try{
  check(nativeStart&&row.normalSpawn,'Attack must start at the original zero-step Play spawn');
  check(game.levelIndex===entry.level-1&&game.chamberEdition==='foundation','Attack is attached to the wrong campaign room');
  journey=await runV8Journey(game,{journeyOptions:{nativeStart:true},scenario:async base=>{
   const d={...base,evidence:row};
   d.frame=()=>{base.frame();if(row.targetStarted)row.targetFrames++;};
   d.aim=(index,point)=>{
    const candidates=Object.values(game.firstLevel.panels).filter(panel=>{const f=panel.getFrame(),v=point.clone().sub(f.center);return Math.abs(v.dot(f.normal))<.06&&Math.abs(v.dot(f.right))<=(f.halfWidth??panel.width/2)+.01&&Math.abs(v.dot(f.up))<=(f.halfHeight??panel.height/2)+.01;});
    const expected=candidates.length===1?candidates[0]:null;
    const shot={index,aim:vector(point),from:vector(game.playerPosition),physicsStepBefore:game.physics.world.stepnumber,expectedSurfaceId:expected?.mesh.uuid??null,actualSurfaceId:null,accepted:false,impact:null,error:null};row.shots.push(shot);
    try{check(expected,'Charged shot must identify exactly one real addressed ceramic');base.aim(index,point);shot.accepted=true;shot.impact=copy(game.portalShots.lastImpact);shot.physicsStepAfter=game.physics.world.stepnumber;shot.actualSurfaceId=game.portals.portals[index]?.surfaceId??null;check(shot.impact?.valid&&shot.actualSurfaceId===shot.expectedSurfaceId,'Portal charge did not hit the addressed production ceramic');}
    catch(error){shot.error=String(error.message??error);throw error;}
   };
   d.mark=name=>{base.mark(name);row.milestones.push({name,phase:row.targetStarted?'target':'approach',...snapshot(game)});};
   d.beginTarget=(name,condition)=>{check(condition,'Incomplete real approach: '+name);check(!row.targetStarted,'Attack target already started');row.approachComplete=row.targetStarted=true;d.mark(name);};
   await entry.run(d);d.mark('Bounded attempt ends');
  }});
  row.journey={pass:journey.pass,frames:journey.frames,resets:journey.resets,respawns:journey.respawns};row.journeyFrames=journey.frames;row.completed=game.state==='won';row.final=snapshot(game);row.worldStepDelta=game.physics.world.stepnumber-start;row.sameCargo=game.cargo===original.cargo&&game.cargo.group===original.group;row.sameBody=game.physics.cargoBody===original.body&&game.physics.cargoBody.shapes[0]===original.shape;row.sameGeometry=geometry.same();
  row.pass=Boolean(journey.pass&&row.approachComplete&&row.targetStarted&&row.targetFrames>=120&&!row.completed&&!row.resets&&!row.respawns&&identity()&&geometry.same()&&row.physicsSteps===row.worldStepDelta&&row.shots.every(s=>s.accepted&&s.impact?.valid&&s.actualSurfaceId===s.expectedSurfaceId&&!s.error));
 }catch(error){row.error=String(error.message??error);row.final=snapshot(game);row.worldStepDelta=game.physics.world.stepnumber-start;row.sameCargo=game.cargo===original.cargo&&game.cargo.group===original.group;row.sameBody=game.physics.cargoBody===original.body&&game.physics.cargoBody.shapes[0]===original.shape;row.sameGeometry=geometry.same();row.completed=game.state==='won';}
 finally{game.updatePlaying=oldUpdate;game.resetRun=oldReset;game.respawn=oldRespawn;game.physics.resetCargo=oldCargoReset;}
 return row;
}

export function summarizeSecondChapterEarlyAttacks(cases){return {group:'early',edition:'foundation',scope:'Ten finite ordinary-input attempts in rooms 11–15; no exhaustive bypass claim.',cases,counts:{attempts:cases.length,completed:cases.filter(c=>c.completed).length,errors:cases.filter(c=>c.error).length,physicsSteps:cases.reduce((sum,c)=>sum+c.physicsSteps,0),targetFrames:cases.reduce((sum,c)=>sum+c.targetFrames,0)}};}
function assertFinite(value,path='report'){
 if(typeof value==='number')check(Number.isFinite(value),'Nonfinite '+path);
 else if(Array.isArray(value))value.forEach((v,i)=>assertFinite(v,path+'['+i+']'));
 else if(value&&typeof value==='object')for(const [key,v]of Object.entries(value))assertFinite(v,path+'.'+key);
}
export function assertSecondChapterEarlyAttacks(report){
 check(report?.group==='early'&&report.edition==='foundation','Wrong early attack report group');check(Array.isArray(report.cases)&&report.cases.length===SECOND_CHAPTER_EARLY_ATTACKS.length,'Missing early attack cases');assertFinite(report);
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),vector=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
 const snap=s=>{check(s&&vector(s.player)&&vector(s.velocity)&&vector(s.cargo)&&vector(s.cargoVelocity),'Missing finite original actor state');check(typeof s.held==='boolean'&&typeof s.grounded==='boolean'&&s.state==='playing'&&s.won===false,'Snapshot is not an ordinary unsolved state');check(Number.isSafeInteger(s.worldStep)&&s.worldStep>=0&&Number.isSafeInteger(s.teleports)&&s.teleports>=0&&Number.isSafeInteger(s.cargoTransports)&&s.cargoTransports>=0,'Invalid actual production step or transit count');check(s.causes&&typeof s.causes==='object','Missing actual mechanical consequences');};
 const seen=new Set();for(const [i,row]of report.cases.entries()){
  const entry=SECOND_CHAPTER_EARLY_ATTACKS[i];check(entry.level===row.level&&entry.name===row.name&&!seen.has(row.name),'Unknown, duplicate or reordered early attack');seen.add(row.name);
  check(row.pass===true&&row.error===null&&!row.completed,'Attack failed or completed the room: '+row.name);check(row.nativeStart===true&&row.normalSpawn===true,'Attack did not use the untouched native Play spawn');check(row.approachComplete===true&&row.targetStarted===true&&row.targetFrames>=120&&row.jumpInputs>=1,'Attack never exercised its real target');
  check(row.sameCargo===true&&row.sameBody===true&&row.sameGeometry===true&&row.geometryMeshes>0,'Attack replaced an original actor or geometry');check(row.resets===0&&row.respawns===0&&row.journey?.pass===true&&row.journey.resets===0&&row.journey.respawns===0,'Attack used reset/recovery');
  check(Number.isSafeInteger(row.physicsSteps)&&row.physicsSteps>0&&row.physicsSteps===row.worldStepDelta&&row.journeyFrames===row.journey.frames&&row.physicsSteps===row.journeyFrames*2,'Attack clock does not bind to the production world');check(Math.abs(row.simulationSeconds-row.physicsSteps/120)<1e-6,'Attack simulation duration mismatch');
  check(Array.isArray(row.shots)&&row.shots.length===[0,2,0,4,5,4,3,2,0,4][i]&&row.shots.every(s=>s.accepted===true&&s.impact?.valid===true&&typeof s.expectedSurfaceId==='string'&&s.actualSurfaceId===s.expectedSurfaceId&&s.error===null),'Rejected/incomplete or missing charged shot');
  let lastShot=0;for(const shot of row.shots){check(Number.isSafeInteger(shot.physicsStepBefore)&&shot.physicsStepBefore>=lastShot&&Number.isSafeInteger(shot.physicsStepAfter)&&shot.physicsStepAfter>shot.physicsStepBefore&&shot.physicsStepAfter<=row.physicsSteps,'Actual charged projectile clock');lastShot=shot.physicsStepAfter;}
  check(row.trajectory.length===Math.floor(row.physicsSteps/24)+1&&row.milestones.some(m=>m.phase==='target'),'Missing retained 24-step attack observations');
  for(const[j,s]of row.trajectory.entries()){snap(s);check(s.worldStep===j*24,'Actual ordered physics trajectory');check(s.player[1]<=row.peak.playerY+1e-7&&s.cargo[1]<=row.peak.cargoY+1e-7,'Observed peak does not bound the trajectory');}
  let last=0;for(const event of row.milestones){snap(event);check(event.worldStep>=last&&event.worldStep<=row.physicsSteps,'Ordered actual milestone clock');last=event.worldStep;}
  const terminal=row.milestones.at(-1);check(terminal?.name==='Bounded attempt ends'&&terminal.phase==='target'&&terminal.worldStep===row.physicsSteps,'Incomplete bounded target execution');
  snap(row.initial);snap(row.final);check(row.initial.worldStep===0&&row.final.worldStep===row.physicsSteps,'Initial/final actual physics clock');
  for(const key of Object.keys(row.final))check(same(terminal[key],row.final[key]),'Terminal snapshot differs from actual final '+key);
  if(row.level===11)check(row.final.causes.fanEnabled===false&&row.final.causes.drivePower===false&&row.final.causes.driveWork===0&&row.final.causes.ratchet===false&&row.final.teleports===0&&row.final.player[2]>-12&&row.final.held,'Closed mechanical partition no longer arrested the unpowered loaded traveller');
  if(i===2)check(row.final.teleports===0&&row.peak.playerY<2&&row.final.player[1]<2&&row.final.held,'Lower dock attempt did not omit the real nine metre crossing');
  if(i===3)check(row.final.teleports>=2&&row.final.cargoTransports>=2&&row.final.player[0]>7&&row.final.player[1]>8.9&&row.final.player[2]<.2&&row.final.held,'Actual cargo-height traveller or low freight-mouth arrest missing');
  if(i===4){const start=row.milestones.find(m=>m.name==='live southern lift has not completed its ascent');check(start?.causes.mirrorLoaded===true&&start.causes.opticalReceivers[1]===true&&start.causes.southCage>8&&row.final.causes.mirrorLoaded===false&&same(row.final.causes.opticalReceivers,[false,false])&&row.final.causes.southCage<start.causes.southCage-.5&&row.final.cargoTransports>start.cargoTransports,'Releasing the physical mirror no longer releases the same powered lift');}
  if(i===5)check(row.final.causes.mirrorLoaded===false&&same(row.final.causes.opticalReceivers,[true,false])&&row.final.causes.southCage===6&&row.final.cargo[1]<1&&!row.final.held,'Unloaded northern route gained the southern power or original companion');
  if(row.level===14)check(row.final.causes.stairSupported===false&&row.final.causes.stairOffset===-7.2&&row.final.held,'Carried companion supplied an undeclared counterweight');
  if(i===6)check(row.final.player[2]>-4&&row.final.player[1]<10&&row.final.causes.lightSegments===2,'Lowered folded stair failed to arrest the loaded sprint');
  if(i===7)check(row.final.causes.lightSegments===1&&row.final.player[1]<2,'Unrouted first light crossing retained a useful projected support');
  if(i===8)check(!row.final.held&&row.final.cargo[1]>2&&row.final.teleports===0&&row.final.cargoTransports===0&&row.peak.playerY>1.4,'Original companion escaped the unpowered freight duct or full jumps were not exercised');
  if(i===9)check(row.final.held&&row.final.teleports===0&&row.final.causes.funnelSegments.some(s=>s.direction[1]>.8)&&row.final.causes.funnelSegments.every(s=>Math.abs(s.direction[0])<.9||s.a[1]<3),'Upper loaded jump gained an unrequested transverse air route');
 }
 check(report.counts?.attempts===report.cases.length&&report.counts.completed===0&&report.counts.errors===0&&report.counts.physicsSteps===report.cases.reduce((sum,c)=>sum+c.physicsSteps,0),'Early attack summary does not match raw cases');return true;
}
