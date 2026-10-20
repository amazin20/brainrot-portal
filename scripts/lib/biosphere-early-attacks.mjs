import * as THREE from 'three';
import {runV8Journey} from '../../src/game/LabV8Journey.js';
import {installRoom21Aim,room21Freight} from '../../src/game/LabRoom21Journey.js';
import {runRoom22} from '../../src/game/LabRoom22Journey.js';
import {runRoom23PhysicalJourney} from '../../src/game/LabRoom23PhysicalJourney.js';
import {runRoom24} from '../../src/game/LabRoom24Journey.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const check=(ok,message)=>{if(!ok)throw Error('Biosphere finite attack: '+message);};
const copy=v=>v===undefined?null:JSON.parse(JSON.stringify(v));
export const BIOSPHERE_ATTACK_OPEN_SCOPES=Object.freeze({sourceCiAccepted:false,nativeAccepted:false,publicationAccepted:false,fullChapterAccepted:false,humanAccepted:false,allBypassesAccepted:false});
export function biosphereCause(g){
 const l=g.firstLevel,s=l.state??{};
 if(g.levelIndex===20)return {loaded:s.cargoSeat.loaded(),braked:l.cassette.braked,cassetteHeight:l.cassette.height,serviceHeight:l.serviceCar.floor.y};
 if(g.levelIndex===21)return {loaded:l.shutters.loaded,progress:l.shutters.progress,lowerY:l.shutters.lower.mesh.position.y,upperY:l.shutters.upper.mesh.position.y};
 if(g.levelIndex===22){const a=l.balance.diagnostics();return {clutch:a.clutchCommand,brake:a.brakeCommand,clutchNormal:a.clutchNormal,brakeNormal:a.brakeNormal,sourceInput:a.sourceInput,westY:a.west.y,eastY:a.east.y,westLoad:a.west.normalLoad,eastLoad:a.east.normalLoad,ownership:a.ownershipValid,fault:a.fault};}
 if(g.levelIndex===23)return {angle:l.gardenDoor.angle,loaded:l.gardenDoor.loaded,braked:l.gardenDoor.braked,manualTurn:l.gardenDoor.manualTurn};
 if(g.levelIndex===24)return {loaded:s.optical.loaded,travel:s.optical.travel,motorLit:s.optical.motorLit,receivers:[...s.optical.receivers],hoistHeight:s.counterweightHoist.height,hoistVelocity:s.counterweightHoist.velocity,driveEnabled:s.counterweightHoist.enabled??s.counterweightHoist.motorEnabled??null};
 if(g.levelIndex===25)return {loaded:s.load.loaded(),shutterOpen:s.shutter.open,shutterY:s.shutter.height,liftSegments:s.liftFlow.segments.map(p=>({a:p.a.toArray(),b:p.b.toArray(),direction:p.direction.toArray()})),crossingReversed:s.crossingFlow.reversed};
 if(g.levelIndex===26)return {reversed:s.conveyors.reversed,braked:s.conveyors.braked};
 if(g.levelIndex===27)return {levels:[...s.tides.levels],flow:s.tides.flow,connection:s.tides.connection?.map(e=>({basin:e.basin,sill:e.sill}))??null,coralY:s['coral-float'].position.y,lagoonY:s['lagoon-float'].position.y};
 if(g.levelIndex===28)return {sourceUp:s.gravity.source.up,crownUp:s.gravity.crown.up,latch:s.gardenLatch.engaged,shutterY:s.gardenLatch.shutter.position.y};
 return {tilt:s.tilt.angle,eastTilt:s.eastTilt.angle,connected:Boolean(g.velocityCompanion?.connected)};
}
function snapshot(g){const b=g.physics.cargoBody;return {worldStep:g.physics.world.stepnumber,player:g.playerPosition.toArray(),velocity:g.playerVelocity.toArray(),cargo:g.cargo.position.toArray(),cargoVelocity:[b.velocity.x,b.velocity.y,b.velocity.z],held:Boolean(g.heldCube),grounded:Boolean(g.playerGrounded),state:g.state,won:g.state==='won',teleports:g.teleportCount,cargoTransports:g.physics.portalTransports,causes:biosphereCause(g)};}
export function biosphereRush(d,x,z,frames=360,{jumpEvery=47,interactEvery=0}={}){
 const g=d.game,r={requested:[x,z],requestedFrames:frames,frames:0,jumpRequests:0,interactRequests:0,takeoffs:0,from:g.playerPosition.toArray(),to:null,min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
 g.input.keys.add('ShiftLeft');
 for(let n=0;n<frames&&g.state==='playing';n++){
  const delta=V(x,0,z).sub(g.playerPosition);delta.y=0;if(delta.lengthSq()>1e-9)delta.normalize();d.worldMove(delta.x,delta.z);
  if(jumpEvery&&n%jumpEvery===0){g.input.jumpQueued=true;d.evidence.jumpInputs++;r.jumpRequests++;}
  if(interactEvery&&n%interactEvery===0){g.interact();r.interactRequests++;}
  d.frame();r.frames++;const p=g.playerPosition.toArray();for(let a=0;a<3;a++){r.min[a]=Math.min(r.min[a],p[a]);r.max[a]=Math.max(r.max[a],p[a]);}if(!g.playerGrounded&&g.playerVelocity.y>3)r.takeoffs++;
 }d.stop();r.to=g.playerPosition.toArray();return r;
}
export async function biospherePrefix(d,route,name,options={}){
 const cut=Symbol(name);let reached=false;
 try{await route({...d,mark:value=>{d.mark(value);if(value===name){reached=true;throw cut;}}},options);}catch(error){if(error!==cut)throw error;}
 check(reached,'Actual ordinary prefix did not reach '+name);
}
const entries=[
 [21,'braked-cassette-hidden-edge-charges',d=>{
  installRoom21Aim(d);room21Freight(d);d.walk(0,7.85);d.aim(0,d.level.panels['shared-well'].getFrame().center.clone().setZ(7.1));
  d.beginTarget('same cargo loads receiver but independent cassette brake was never released',d.level.state.cargoSeat.loaded()&&d.level.cassette.braked);
  const shots=[];for(const side of[-1,1]){const f=d.level.panels['moving-cassette'].getFrame();d.look(f.center.clone().addScaledVector(f.right,side*.8));check(d.game.firePortal(1),'ordinary hidden cassette charge rejected');d.until(()=>d.game.portalShots.queue.length===0&&d.game.portalShots.active.length===0,3,'hidden cassette charge unresolved');shots.push({valid:d.game.portalShots.lastImpact?.valid??false});}return {shots,rush:biosphereRush(d,0,2,480),omitted:'independent physical cassette brake'};
 }],
 [21,'lower-receiver-partition-loaded-jump',d=>{
  d.walk(d.game.cargo.position.x-1,d.game.cargo.position.z);d.pickup();d.walk(0,12);d.walk(3.7,12);d.until(()=>d.game.playerGrounded,5,'ordinary departure edge landing');d.walk(4.4,6);d.beginTarget('original held load faces full-height receiver partition from lower recovery floor',d.game.heldCube&&d.game.playerPosition.y<.2&&!d.level.state.cargoSeat.loaded());
  return {rush:biosphereRush(d,13,6,480,{jumpEvery:23,interactEvery:31}),omitted:'free cargo freight mouth and receiver support'};
 }],
 [22,'closed-ground-shutter-loaded-jamb-jumps',d=>{
  d.walk(-16,17);d.pickup();d.walk(-8,12);d.walk(-1.15,12);d.beginTarget('held original load at closed lower opposed gate',d.game.heldCube&&!d.level.shutters.loaded&&d.level.shutters.progress<.01);
  return {rush:biosphereRush(d,7,12,420,{jumpEvery:23}),omitted:'released freight weight'};
 }],
 [22,'upper-opposed-shutter-still-loaded',async d=>{
  await biospherePrefix(d,runRoom22,'inspection stair joins the permanent gallery');d.walk(12,3);d.walk(12,-6.7);d.beginTarget('earned upper gallery meets opposite gate while original remains on lower plate',d.game.playerPosition.y>6.9&&d.level.shutters.loaded&&d.level.shutters.progress>.99);
  return {rush:biosphereRush(d,12,-18,420,{jumpEvery:29}),omitted:'retrieval that reverses the two real shutters'};
 }],
 [23,'empty-pan-clutch-and-passenger-jumps',d=>{
  installRoom21Aim(d);d.walk(-7.5,5.6);check(d.game.interact(),'ground clutch E missed');d.wait(1);d.walk(-8.5,3);d.walk(-8.5,-1);d.walk(-5.5,-1);d.walk(-5.5,1);check(d.game.interact(),'aboard brake E missed');d.wait(2);
  d.beginTarget('real passenger stands on west cabin with no original freight contact on east pan',d.level.balance.diagnostics().east.normalLoad<1&&d.level.balance.clutchRequested&&!d.level.balance.brakeRequested);
  return {rush:biosphereRush(d,-5.5,3,480,{jumpEvery:43}),omitted:'real raised east freight load'};
 }],
 [23,'loaded-east-pan-without-clutch',async d=>{
  const cut=Symbol('loaded-east');let reached=false;try{await runRoom23PhysicalJourney({...d,mark:name=>{d.mark(name);if(name==='normal-spawn original loads actual raised east freight pan'){reached=true;throw cut;}}});}catch(error){if(error!==cut)throw error;}check(reached,'east freight delivery prefix missing');
  d.walk(-8.5,3);d.walk(-8.5,-1);d.walk(-5.5,-1);d.walk(-5.5,1);check(d.game.interact(),'ordinary aboard brake release missed');d.wait(1);d.beginTarget('actual raised east original load exists but physical clutch stays disengaged',d.level.balance.diagnostics().east.normalLoad>50&&!d.level.balance.clutchRequested&&!d.level.balance.brakeRequested);
  return {rush:biosphereRush(d,-5.5,3,480,{jumpEvery:53}),omitted:'ground clutch engagement'};
 }],
 [24,'unturned-courtyard-diagonal-corner-jump',async d=>{
  await biospherePrefix(d,runRoom24,'the same aperture starts its courtyard orbit');d.walk(d.game.cargo.position.x-.9,d.game.cargo.position.z);d.pickup();d.walk(0,3);d.beginTarget('same original on south balcony while moving doorway still has its unturned orientation',d.game.playerPosition.y>5.9&&Math.abs(d.level.gardenDoor.angle)<.02&&d.game.heldCube);
  return {rush:biosphereRush(d,-8,-8,480,{jumpEvery:19}),omitted:'worm drive or real turning counterweight'};
 }],
 [24,'ground-pavilion-skirt-and-side-jumps',d=>{
  d.walk(11,18);d.pickup();d.walk(18,10);d.walk(18,-6);d.walk(16,-10.6);d.beginTarget('original load reaches tall destination pavilion skirt from lower recovery garden',d.game.playerPosition.y<.2&&d.game.heldCube&&d.level.goal.position.y>14.9);
  return {rush:biosphereRush(d,16,-18,480,{jumpEvery:17,interactEvery:43}),omitted:'rotated courtyard, reverse perch and high receiver'};
 }],
 [25,'unloaded-shadow-ray-and-passenger-jump',d=>{
  d.walk(-7,6);d.walk(17,6);d.walk(17,12);d.aim(0,d.level.panels['light-intake'].getFrame().center);d.walk(17,6);d.walk(-20,6);d.walk(-20,-10);d.walk(-15.2,-10.7);d.aim(1,d.level.panels['lower-relay'].getFrame().center);d.walk(-14,-10);
  d.beginTarget('same original stays on its normal floor and never compresses the linked shadow plate',!d.game.heldCube&&!d.level.state.optical.loaded&&d.level.state.optical.travel<.01);
  return {rush:biosphereRush(d,-14,-13,480,{jumpEvery:31}),omitted:'real weight clearing the first optical path'};
 }],
 [25,'loaded-lit-hoist-without-motor-switch',d=>{
  d.walk(-14,9);d.pickup();d.walk(-14,8.7);d.walk(-7,8.7);d.game.input.jumpQueued=true;d.evidence.jumpInputs++;d.walk(-7,10);d.walk(-7,13.8);d.walk(-7,12.7);d.wait(.5);d.game.interact();d.wait(1.2);check(d.level.state.optical.loaded,'original did not settle on real freight plate');d.until(()=>d.level.state.optical.travel>.85,15,'physical shadow travel');
  d.walk(-7,6);d.walk(17,6);d.walk(17,12);d.aim(0,d.level.panels['light-intake'].getFrame().center);d.aim(0,d.level.panels['light-intake'].getFrame().center.clone().add(d.level.panels['light-intake'].getFrame().center.clone().sub(d.game.portals.portals[0].position)));
  d.walk(17,6);d.walk(-20,6);d.walk(-20,-10);d.walk(-14,-10);d.walk(-15.2,-10.7);d.aim(1,d.level.panels['lower-relay'].getFrame().center);d.wait(.2);d.walk(-14,-10);
  d.beginTarget('real load and reflected motor light present while ground switch remains unused',d.level.state.optical.loaded&&d.level.state.optical.motorLit&&d.level.state.counterweightHoist.height<.2);
  return {rush:biosphereRush(d,-14,-13,480,{jumpEvery:41}),omitted:'ordinary lower optical freight motor switch'};
 }],
];
const earlyImpacts=[[true,true,true,false,false],[],[],[],[],[true,true],[true,true,true],[],[true,true],[true,true,true]];
export const BIOSPHERE_EARLY_ATTACKS=Object.freeze(entries.map(([level,name,run],i)=>Object.freeze({id:name,index:level-1,level,name,run,impacts:Object.freeze(earlyImpacts[i])})));
function geometryWitness(roots){const items=[];for(const root of roots)root.traverse(node=>{if(node.isMesh){const geometry=node.geometry;items.push({node,geometry,index:geometry.index?.array??null,attributes:Object.entries(geometry.attributes).map(([name,a])=>[name,a.array])});}});return {count:items.length,same:()=>items.every(({node,geometry,index,attributes})=>node.geometry===geometry&&(geometry.index?.array??null)===index&&attributes.every(([name,array])=>geometry.attributes[name]?.array===array))};}
export async function observeBiosphereAttempt(game,entry,catalogue){
 check(catalogue.includes(entry),'use an immutable original catalogue entry');const b=game.physics.cargoBody,w=game.physics.world,original={cargo:game.cargo,group:game.cargo.group,player:game.playerGroup,body:b,shape:b.shapes[0],world:w},geometry=geometryWitness([game.playerGroup,game.cargo.group]);
 const initial=snapshot(game),at=(a,b)=>Array.isArray(b)&&a.length===b.length&&Math.hypot(...a.map((n,i)=>n-b[i]))<1e-8,coords=v=>v?.toArray?.()??v;
 const r={...BIOSPHERE_ATTACK_OPEN_SCOPES,id:entry.id,index:entry.index,level:entry.level,name:entry.name,pass:false,completed:false,won:false,error:null,nativeStart:true,normalSpawn:game.state==='playing'&&w.stepnumber===0&&game.elapsed===0&&at(initial.player,coords(game.firstLevel.spawn))&&at(initial.cargo,coords(game.firstLevel.cargoSpawn))&&!game.heldCube&&!game.portals.ready&&game.portals.portals.every(p=>!p)&&game.teleportCount===0&&game.portalShots.queue.length===0&&game.portalShots.active.length===0,approachComplete:false,targetStarted:false,targetFrames:0,physicsSteps:0,simulationSeconds:0,jumpInputs:0,interactInputs:0,resets:0,respawns:0,shots:[],milestones:[],trajectory:[{phase:'start',...initial}],initial,peak:{playerY:initial.player[1],cargoY:initial.cargo[1]},geometryMeshes:geometry.count,attempt:null};
 const old={update:game.updatePlaying,reset:game.resetRun,respawn:game.respawn,cargoReset:game.physics.resetCargo,interact:game.interact,fire:game.firePortal};let previous=0,impact=game.portalShots.lastImpact;
 const identity=()=>game.cargo===original.cargo&&game.cargo.group===original.group&&game.playerGroup===original.player&&game.physics.cargoBody===original.body&&game.physics.world===original.world&&b.shapes.length===1&&b.shapes[0]===original.shape&&b.mass===3.2&&b.type===1;
 game.resetRun=function(...a){r.resets++;return old.reset.apply(this,a);};game.respawn=function(...a){r.respawns++;return old.respawn.apply(this,a);};game.physics.resetCargo=function(...a){r.resets++;return old.cargoReset.apply(this,a);};game.interact=function(...a){r.interactInputs++;return old.interact.apply(this,a);};
 game.firePortal=function(index,...a){const shot={index,worldStep:w.stepnumber,from:game.playerPosition.toArray(),requested:false,impact:null,impactStep:null};r.shots.push(shot);shot.requested=old.fire.call(this,index,...a);return shot.requested;};
 game.updatePlaying=function(dt){old.update.call(this,dt);r.physicsSteps++;r.simulationSeconds+=dt;check(w.stepnumber===previous+1,'production physics world skipped or reset');previous=w.stepnumber;check(identity()&&geometry.same(),'original actor/body/shape/world/geometry replaced');check(!r.resets&&!r.respawns,'attempt reset or respawned');check(r.physicsSteps<=60000,'finite 500s attempt budget exceeded');r.peak.playerY=Math.max(r.peak.playerY,this.playerPosition.y);r.peak.cargoY=Math.max(r.peak.cargoY,this.cargo.position.y);if(game.portalShots.lastImpact!==impact){impact=game.portalShots.lastImpact;const pending=r.shots.find(s=>s.impact===null&&s.requested);if(pending){pending.impact=copy(impact);pending.impactStep=w.stepnumber;}}if(r.physicsSteps%24===0)r.trajectory.push({phase:r.targetStarted?'target':'approach',...snapshot(game)});};
 try{
  check(r.normalSpawn&&game.levelIndex===entry.index&&game.chamberEdition==='foundation','must start from exact zero-step normal Play');
  const journey=await runV8Journey(game,{journeyOptions:{nativeStart:true},scenario:async base=>{
   const d={...base,evidence:r};d.frame=()=>{base.frame();if(r.targetStarted)r.targetFrames++;};d.mark=name=>{base.mark(name);r.milestones.push({name,phase:r.targetStarted?'target':'approach',...snapshot(game)});};d.beginTarget=(name,condition)=>{check(condition,'incomplete actual target approach: '+name);check(!r.targetStarted,'target already started');r.approachComplete=r.targetStarted=true;d.mark(name);};
   r.attempt=await entry.run(d);d.mark('Bounded attempt ends');
  }});r.journey={pass:journey.pass,frames:journey.frames,resets:journey.resets,respawns:journey.respawns};r.journeyFrames=journey.frames;
  r.pass=Boolean(journey.pass&&r.approachComplete&&r.targetStarted&&r.targetFrames>=120&&game.state==='playing'&&!r.resets&&!r.respawns&&identity()&&geometry.same()&&r.physicsSteps===w.stepnumber);
 }catch(error){r.error=String(error.stack??error);}
 finally{r.final=snapshot(game);r.completed=r.won=game.state==='won';r.worldStepDelta=w.stepnumber;r.sameCargo=game.cargo===original.cargo&&game.cargo.group===original.group;r.sameBody=game.physics.cargoBody===original.body&&b.shapes[0]===original.shape;r.sameGeometry=geometry.same();r.originalCargo=identity();game.updatePlaying=old.update;game.resetRun=old.reset;game.respawn=old.respawn;game.physics.resetCargo=old.cargoReset;game.interact=old.interact;game.firePortal=old.fire;}
 return r;
}
export async function observeBiosphereEarlyAttack(game,entry){return observeBiosphereAttempt(game,entry,BIOSPHERE_EARLY_ATTACKS);}
export function summarizeBiosphereEarlyAttacks(cases){return {...BIOSPHERE_ATTACK_OPEN_SCOPES,group:'early',edition:'foundation',scope:'Ten specified finite ordinary-input attempts in rooms21–25; reached target, original mechanical consequences, no exhaustive bypass claim.',cases,counts:{attempts:cases.length,completed:cases.filter(r=>r.completed).length,errors:cases.filter(r=>r.error).length,physicsSteps:cases.reduce((a,r)=>a+r.physicsSteps,0),targetFrames:cases.reduce((a,r)=>a+r.targetFrames,0)}};}
function finite(v){if(typeof v==='number')return Number.isFinite(v);if(Array.isArray(v))return v.every(finite);if(v&&typeof v==='object')return Object.values(v).every(finite);return true;}
export function assertBiosphereAttemptRows(report,catalogue,group){
 check(report?.group===group&&report.edition==='foundation'&&report.cases?.length===catalogue.length,'exact room/group case coverage required');check(finite(report),'nonfinite retained report');for(const[k,v]of Object.entries(BIOSPHERE_ATTACK_OPEN_SCOPES))check(report[k]===v,'summary acceptance scope must stay open: '+k);
 for(const[i,r]of report.cases.entries()){
  const e=catalogue[i];check(r.id===e.id&&r.index===e.index&&r.level===e.level&&r.name===e.name,'unknown, duplicate or reordered actual case');for(const[k,v]of Object.entries(BIOSPHERE_ATTACK_OPEN_SCOPES))check(r[k]===v,'case acceptance scope relabeled');
  check(r.pass===true&&r.error===null&&!r.won&&!r.completed&&r.normalSpawn===true&&r.nativeStart===true,'failed actual attempt, substituted start or unexpected victory: '+r.name);check(r.approachComplete===true&&r.targetStarted===true&&r.targetFrames>=120&&r.targetFrames<=r.journeyFrames&&r.jumpInputs>0&&r.attempt?.omitted&&r.attempt?.rush,'unreached target or missing actual input');
  check(r.sameCargo&&r.sameBody&&r.sameGeometry&&r.originalCargo&&r.geometryMeshes>0&&r.resets===0&&r.respawns===0,'replaced actor or reset');check(r.journey?.pass&&r.journey.resets===0&&r.journey.respawns===0&&r.journeyFrames===r.journey.frames&&r.physicsSteps===r.worldStepDelta&&r.physicsSteps===r.journeyFrames*2&&r.physicsSteps>0&&r.physicsSteps<=60000,'production clock does not close');check(Math.abs(r.simulationSeconds-r.physicsSteps/120)<1e-6,'clock duration differs');
  const a=r.attempt.rush;check(a.frames===a.requestedFrames&&a.frames>=240&&a.jumpRequests>0&&a.takeoffs>0&&a.from.length===3&&a.to.length===3&&a.min.every((n,j)=>n<=a.to[j])&&a.max.every((n,j)=>n>=a.to[j]),'actual bounded sprint/jump target incomplete');
  check(r.trajectory.length===Math.floor(r.physicsSteps/24)+1,'retained production trajectory missing');for(const[j,s]of r.trajectory.entries())check(s.worldStep===j*24&&s.state==='playing'&&!s.won&&s.player.length===3&&s.cargo.length===3&&s.causes,'unsolved trajectory clock/state missing');
  check(r.shots.length===e.impacts.length&&r.shots.every((shot,j)=>shot.impact?.valid===e.impacts[j]),'actual exact charged impact catalogue differs');for(const shot of r.shots)check(shot.requested===true&&shot.impact&&Number.isSafeInteger(shot.impactStep)&&shot.impactStep>shot.worldStep&&shot.impactStep<=r.physicsSteps,'charged projectile result unresolved');
  check(r.initial.worldStep===0&&r.initial.state==='playing'&&r.final.worldStep===r.physicsSteps&&r.final.state==='playing'&&!r.final.won,'initial/final production clock/win differs');let previous=0;for(const m of r.milestones){check(Number.isSafeInteger(m.worldStep)&&m.worldStep>=previous&&m.worldStep<=r.physicsSteps&&m.state==='playing'&&!m.won&&m.player.length===3&&m.cargo.length===3&&m.causes,'actual ordered unsolved milestone missing');previous=m.worldStep;}check(r.milestones.some(m=>m.phase==='target'&&m.name!=='Bounded attempt ends'),'actual target snapshot missing');const terminal=r.milestones.at(-1);check(terminal?.name==='Bounded attempt ends'&&terminal.phase==='target'&&terminal.worldStep===r.physicsSteps,'complete terminal target missing');for(const key of Object.keys(r.final))check(JSON.stringify(terminal[key])===JSON.stringify(r.final[key]),'terminal state differs: '+key);
 }
 return report;
}
export function assertBiosphereEarlyAttacks(report){
 assertBiosphereAttemptRows(report,BIOSPHERE_EARLY_ATTACKS,'early');
 for(const r of report.cases){const c=r.final.causes,a=r.attempt.rush;
  if(r.id==='braked-cassette-hidden-edge-charges')check(c.loaded&&c.braked&&r.final.cargo[1]<4&&r.attempt.shots.length===2&&r.attempt.shots.every(s=>s.valid===false),'independent original load/brake or real occluded cassette shot absent');
  if(r.id==='lower-receiver-partition-loaded-jump')check(r.final.held&&!c.loaded&&r.final.teleports===0&&a.max[0]<4.8&&a.max[1]<2,'freight partition attack gained an unrequested transport or receiver weight');
  if(r.id==='closed-ground-shutter-loaded-jamb-jumps')check(!c.loaded&&c.progress<.01&&a.max[0]<.5&&r.final.held,'closed lower gate was not retained');
  if(r.id==='upper-opposed-shutter-still-loaded')check(c.loaded&&c.progress>.99&&a.min[2]>-8.1,'loaded opposite upper gate was crossed');
  if(r.id==='empty-pan-clutch-and-passenger-jumps')check(c.clutch&&!c.brake&&c.eastLoad<1&&c.westY<1&&c.ownership&&!c.fault,'unloaded physical cabin supplied an ascent');
  if(r.id==='loaded-east-pan-without-clutch')check(!c.clutch&&!c.brake&&r.milestones.some(m=>m.phase==='target'&&m.causes.eastLoad>50)&&r.final.cargo[1]>19&&c.westY<1&&c.ownership&&!c.fault,'unengaged clutch transmitted the real original freight load');
  if(r.id==='unturned-courtyard-diagonal-corner-jump')check(Math.abs(c.angle)<.02&&r.final.held&&r.final.player[1]<7,'unturned door supplied a different raised courtyard');
  if(r.id==='ground-pavilion-skirt-and-side-jumps')check(a.max[1]<3&&r.final.held&&r.final.player[2]>-12,'ground pavilion skirt failed to arrest the loaded jump');
  if(r.id==='unloaded-shadow-ray-and-passenger-jump')check(!c.loaded&&c.travel<.01&&c.hoistHeight<.2&&a.max[1]<3,'unloaded optical machine gained its withheld physical support');
  if(r.id==='loaded-lit-hoist-without-motor-switch')check(c.loaded&&c.motorLit&&c.driveEnabled===false&&r.milestones.find(m=>m.phase==='target'&&m.name!=='Bounded attempt ends')?.causes.driveEnabled===false&&c.hoistHeight<.2&&a.max[1]<3,'uncommanded optical freight hoist rose or motor input was not actually withheld');
 }
 check(report.counts?.attempts===10&&report.counts.completed===0&&report.counts.errors===0&&report.counts.physicsSteps===report.cases.reduce((a,r)=>a+r.physicsSteps,0)&&report.counts.targetFrames===report.cases.reduce((a,r)=>a+r.targetFrames,0),'actual early summary differs');return report;
}
