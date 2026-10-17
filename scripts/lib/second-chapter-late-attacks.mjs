import {prepareSupport17} from '../../src/game/LabCreativeRoom17Journey.js';
import {runCreative18} from '../../src/game/LabCreativeRoom18Journey.js';
import {room19Ascent} from '../../src/game/LabRoom19Journey.js';
import {runCreative20} from '../../src/game/LabCreativeRoom20Journey.js';
import {aimLateSurface} from '../../src/game/LabLateCampaignAim.js';

const check=(ok,message)=>{if(!ok)throw Error(`Second chapter late attack: ${message}`);};
const finiteVector=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
const handDistance=g=>g.playerPosition.clone().add({x:0,y:1.1,z:0}).distanceTo(g.cargo.position);

/** Read current mechanics. These values never supply puzzle inputs. */
function cause(g){
 const l=g.firstLevel;
 if(g.levelIndex===15)return {padLoaded:l.pads[0].loaded(),playerOnPad:l.pads[0].player(),liftY:l.state['counterweight-lift'].position.y,lightPieces:l.state.lightBridge.pieces.filter(p=>p.floor.enabled).length,portalPair:g.portals.ready,portalCount:g.portals.portals.filter(Boolean).length};
 if(g.levelIndex===16)return {angle:l.beam.angle,tension:l.beam.tension,currentCable:Boolean(l.beam.cablePath())};
 if(g.levelIndex===17)return {mode:l.circuit.mode,current:l.circuit.current,stroke:l.circuit.stroke,contacts:[...l.circuit.contacts],clamped:l.circuit.clamped};
 if(g.levelIndex===18){const s=l.state;return {opticalLit:s.optical.lit,wheelOmega:s.inertia.wheel.omega,wheelEnergy:s.inertia.wheel.energy,gear:s.inertia.gear,ferryProgress:s['inertial-ferry'].progress};}
 const n=l.nearHook.diagnostics(),f=l.stopFinger.diagnostics();
 return {opening:l.rope.opening,tension:l.rope.tension,currentCable:Boolean(l.rope.currentPath()),nearHandCount:n.handCount,bearingForce:n.bearingForce,hookAngle:n.hookAngle,farHandCount:f.handCount,fingerTravel:f.travel,retainingContacts:f.retainingContacts,retainingForce:f.retainingForce,liveOwnership:n.slip?.liveOwnership===true&&f.liveOwnership===true};
}

function sample(g){return {worldStep:g.physics.world.stepnumber,player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),playerGrounded:g.playerGrounded,held:Boolean(g.heldCube),state:g.state,handDistance:handDistance(g),cause:cause(g)};}

/** A finite attempt uses the real move, sprint and jump inputs. It records
 * the approached barrier as well as the outcome, including failed jumps. */
function rush(d,{x=0,z=0,frames=300,jumps=[0,100,200]}={}){
 const g=d.game,r={from:g.playerPosition.toArray(),to:null,requestedDirection:[x,z],requestedFrames:frames,frames:0,jumpRequests:0,takeoffSamples:0,minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity,minZ:Infinity,maxZ:-Infinity,receivingGalleryContacts:0,farDockContacts:0};
 g.input.keys.add('ShiftLeft');
 for(let f=0;f<frames;f++){
  if(jumps.includes(f)){g.input.jumpQueued=true;r.jumpRequests++;}
  d.worldMove(x,z);d.frame();r.frames++;
  const p=g.playerPosition;r.minX=Math.min(r.minX,p.x);r.maxX=Math.max(r.maxX,p.x);r.minY=Math.min(r.minY,p.y);r.maxY=Math.max(r.maxY,p.y);r.minZ=Math.min(r.minZ,p.z);r.maxZ=Math.max(r.maxZ,p.z);
  if(!g.playerGrounded&&g.playerVelocity.y>5)r.takeoffSamples++;
  if(g.playerGrounded&&p.x>10.1&&p.y> -1.5)r.receivingGalleryContacts++;
  if(g.playerGrounded&&p.z>=9&&Math.abs(p.y-8)<.3)r.farDockContacts++;
 }
 d.stop();r.to=g.playerPosition.toArray();return r;
}

function loaded(g,d){d.walk(g.cargo.position.x-1,g.cargo.position.z);d.pickup();check(g.heldCube===g.cargo,'Original cargo pickup missed');}
function interact(d,label){check(d.game.interact(),`Ordinary E missed ${label}`);}

const definitions=[
 [16,'loaded-service-plinth',d=>{loaded(d.game,d);d.walk(13,17.1);return {rush:rush(d,{z:-1,frames:360,jumps:[0,110,220]}),cargoHeld:Boolean(d.game.heldCube)};}],
 [16,'loaded-counterweight-housing',d=>{loaded(d.game,d);d.walk(0,5);return {rush:rush(d,{z:-1}),cargoHeld:Boolean(d.game.heldCube)};}],
 [17,'unsupported-lower-jump',d=>{d.walk(-10,0);return {before:cause(d.game),rush:rush(d,{x:1})};}],
 [17,'erase-support-before-crossing',d=>{prepareSupport17(d);const supported=cause(d.game);check(supported.tension>30&&supported.currentCable,'Current upper support was not established');aimLateSurface(d,0,d.level.feed.surface);d.wait(3);const erased=cause(d.game);d.walk(-10,0);return {supported,erased,rush:rush(d,{x:1})};}],
 [18,'closed-hatch-retrieval',d=>{runCreative18(d,{stopBeforePower:true});const chargedCell=cause(d.game);d.walk(-14,0);const attempt=rush(d,{z:1}),pickupResults=[];for(let n=0;n<3;n++){pickupResults.push(d.game.interact());d.wait(.2);}return {chargedCell,rush:attempt,pickupResults,handDistance:handDistance(d.game)};}],
 [18,'small-stroke-door',d=>{runCreative18(d,{stopBeforePower:true});d.walk(-4,7.65);interact(d,'forward knife switch');d.wait(.15);const forward=cause(d.game);interact(d,'reverse knife switch');d.wait(.1);const reverse=cause(d.game);interact(d,'open knife switch');d.wait(.2);const retained=cause(d.game);d.walk(-8,0);d.walk(0,1);return {forward,reverse,retained,rush:rush(d,{z:-1})};}],
 [19,'glazed-roof-retrieval',d=>{room19Ascent(d);d.walk(0,-5.12);d.walk(0,-3);d.until(()=>d.game.playerGrounded,3,'Closed inspection roof landing');d.walk(0,0);const before=sample(d.game),pickupResults=[];for(let n=0;n<3;n++){pickupResults.push(d.game.interact());d.wait(.2);}const roof=d.level.inspectionRoof,collider=d.game.colliders.find(c=>c.mesh===roof||c.mesh.uuid===roof.uuid);check(collider,'Production inspection roof collider missing');return {before,pickupResults,roofName:roof.name,roofCollider:{enabled:collider.enabled!==false,min:collider.box.min.toArray(),max:collider.box.max.toArray()},after:sample(d.game)};}],
 [19,'uncharged-ferry-jump',d=>{room19Ascent(d);d.walk(0,-6.5);d.walk(4,-6.5);d.walk(10.1,-6.5);d.walk(10.1,-4.6);d.walk(10.1,-4.8);interact(d,'uncharged ferry clutch');const before=cause(d.game);return {before,rush:rush(d,{z:1}),after:cause(d.game)};}],
 [20,'loaded-near-hook-spam',d=>{d.walk(6,4.5);const before=cause(d.game),handResults=[];for(let n=0;n<6;n++){handResults.push(d.game.interact());d.wait(.8);}return {before,handResults,after:cause(d.game)};}],
 [20,'omit-far-retaining-finger',async d=>{await runCreative20(d,{stopAt:'cargo-hanging'});const loadedGate=cause(d.game);d.walk(-9,22);d.aim(1,d.level.recovery.surface.getFrame().center);check(d.game.portals.portals[1]?.surfaceId===d.level.recovery.surface.mesh.uuid,'Recovery charge hit a different manufactured surface');d.wait(4);const unsupported=cause(d.game);d.walk(2,7);return {loadedGate,unsupported,rush:rush(d,{z:-1}),after:cause(d.game)};}],
];

export const SECOND_CHAPTER_LATE_ATTACKS=Object.freeze(definitions.map(([level,id,run])=>Object.freeze({id,index:level-1,level,name:id,run})));

/** Run on a supplied fresh ordinary driver. The caller owns its normal Play
 * start; this observer never selects a level or resets an attempt. */
export async function runSecondChapterLateAttack(d,attack){
 check(SECOND_CHAPTER_LATE_ATTACKS.includes(attack),'Use an original catalogue entry');
 const g=d.game,l=g.firstLevel,b=g.physics.cargoBody,w=g.physics.world,shape=b.shapes[0],cargo=g.cargo;
 check(g.chamberEdition==='foundation'&&g.levelIndex===attack.index&&g.state==='playing','Wrong actual room or edition');
 check(!g.heldCube&&b.mass===3.2&&b.type===1,'Use the original free 3.2 kg cargo');
 const r={id:attack.id,index:attack.index,level:attack.level,name:attack.name,attempted:false,start:sample(g),finish:null,physicsSteps:0,samples:[],contactSamples:[0,0,0],oneContactPoweredSteps:0,originalCargo:true,goalReached:false,won:false,teleportsBefore:g.teleportCount,player:null,cargo:null,cargoHeld:false,teleports:0,requiredCause:null,attempt:null,error:null};
 let previous=w.stepnumber;
 const post=()=>{
  check(g.firstLevel===l&&g.physics.world===w&&g.cargo===cargo&&g.physics.cargoBody===b&&b.shapes[0]===shape,'Original actors, body, shape or world changed');
  check(b.mass===3.2&&b.type===1,'Original cargo physical properties changed');
  check(w.stepnumber===previous+1,'Physics world clock reset or skipped');previous=w.stepnumber;r.physicsSteps++;
  if(attack.level===18){const c=l.circuit.contacts.filter(Boolean).length;r.contactSamples[c]++;if(c<2&&l.circuit.current!==0)r.oneContactPoweredSteps++;}
  if(r.physicsSteps%10===0){check(r.samples.length<2500,'Finite attack trace cap exceeded');r.samples.push(sample(g));}
 };
 w.addEventListener('postStep',post);
 try{r.attempted=true;r.attempt=await attack.run(d);r.finish=sample(g);r.goalReached=g.state==='won';r.won=r.goalReached;r.player=g.playerPosition.toArray();r.cargo=g.cargo.position.toArray();r.cargoHeld=Boolean(g.heldCube);r.teleports=g.teleportCount;r.requiredCause=cause(g);return r;}
 catch(error){r.error=String(error.stack??error);r.finish=sample(g);error.secondChapterLateObservation=r;throw error;}
 finally{w.removeEventListener('postStep',post);}
}

function allFinite(value){if(typeof value==='number')return Number.isFinite(value);if(Array.isArray(value))return value.every(allFinite);if(value&&typeof value==='object')return Object.values(value).every(allFinite);return true;}
function rushProof(a){const p=a.rush;check(p&&p.frames===p.requestedFrames&&p.frames>=300&&p.jumpRequests===3&&p.takeoffSamples>0,'Incomplete actual sprint/jump approach');check(finiteVector(p.from)&&finiteVector(p.to)&&p.maxY>p.minY,'Missing measured approach bounds');}

export function assertSecondChapterLateAttacks(report){
 check(report?.group==='later'&&report.edition==='foundation','Actual later Foundation group required');
 check(Array.isArray(report.cases)&&report.cases.length===SECOND_CHAPTER_LATE_ATTACKS.length,'Exact finite catalogue coverage required');
 const ids=new Set();
 for(const r of report.cases){
  const def=SECOND_CHAPTER_LATE_ATTACKS.find(a=>a.id===r.id);check(def&&def.index===r.index&&def.level===r.level&&!ids.has(r.id),'Unknown, duplicate or mismatched case');ids.add(r.id);
  check(allFinite(r)&&r.error===null&&r.attempted&&r.originalCargo===true&&!r.won&&!r.goalReached,'Case error, nonfinite value, changed original cargo or unexpected victory');
  check(r.start?.state==='playing'&&r.finish?.state==='playing'&&r.physicsSteps>0&&r.finish.worldStep-r.start.worldStep===r.physicsSteps,'Discontinuous actual physics attempt');
  check(Array.isArray(r.samples)&&r.samples.length>=1&&r.samples.length<=2500&&r.samples.length===Math.floor(r.physicsSteps/10),'Missing bounded actual physics trace');
  check(finiteVector(r.player)&&finiteVector(r.cargo)&&Number.isInteger(r.teleports)&&r.teleports>=r.teleportsBefore,'Invalid actor coordinates or transport count');
  check(r.journey?.pass===true&&r.journey.resets===0&&r.journey.respawns===0&&r.journey.frames>0,'Ordinary route failed or reset');
  const a=r.attempt,c=r.requiredCause;check(a&&c,'Missing actual approach or required cause');
  if(a.rush)rushProof(a);
  if(r.id==='loaded-service-plinth'){check(a.cargoHeld&&r.cargoHeld&&a.rush.minZ<16.4&&a.rush.minZ>15.8&&a.rush.maxY<1.86&&!c.padLoaded&&c.liftY<2.1&&!c.portalPair&&c.portalCount===0,'Loaded service dock jump was incomplete or reached the raised dock');}
  else if(r.id==='loaded-counterweight-housing'){check(a.cargoHeld&&r.cargoHeld&&a.rush.minZ<4.1&&a.rush.minZ>3.3&&a.rush.maxY<2&&!c.padLoaded&&c.liftY<2.1&&!c.portalPair&&c.portalCount===0,'Original load entered the sealed weight housing from below');}
  else if(r.id==='unsupported-lower-jump'||r.id==='erase-support-before-crossing'){
   check(a.rush.maxX>12.4&&a.rush.receivingGalleryContacts===0&&a.rush.to[1]< -9.9&&c.tension===0&&!c.currentCable&&c.angle<-.65,'Unsupported floor jump did not approach the far side or reached a permanent receiving gallery');
   if(a.supported)check(a.supported.tension>30&&a.supported.currentCable&&a.erased.tension===0&&!a.erased.currentCable&&a.erased.angle<-.65,'Current support was not really established and erased');
  }else if(r.id==='closed-hatch-retrieval'){check(a.chargedCell.contacts.every(Boolean)&&a.chargedCell.stroke===0&&a.rush.maxZ>.9&&a.rush.maxZ<1.5&&a.pickupResults.length===3&&a.pickupResults.every(v=>v===false)&&!r.cargoHeld&&c.stroke===0&&a.handDistance>2.25,'Closed cell approach failed or original conductor was retrieved through its closed hatch');}
  else if(r.id==='small-stroke-door'){check(a.forward.current>0&&a.reverse.mode===2&&a.retained.mode===0&&a.retained.current===0&&a.retained.stroke>0&&a.retained.stroke<.15&&Math.abs(c.stroke-a.retained.stroke)<1e-10&&a.rush.minZ< -6.1&&a.rush.minZ> -6.3,'Small physical screw stroke was not tested at the actual door face');}
  else if(r.id==='glazed-roof-retrieval'){check(a.roofCollider.enabled&&a.roofName==='Solid charge-transmitting inspection roof'&&a.before.playerGrounded&&Math.abs(a.before.player[1]-a.roofCollider.max[1])<1e-6&&Math.hypot(a.before.player[0],a.before.player[2])<.15&&a.pickupResults.length===3&&a.pickupResults.every(v=>v===false)&&!r.cargoHeld&&a.after.cargo[1]<.6&&a.after.handDistance>6,'Closed production roof was not approached above the original cargo');}
  else if(r.id==='uncharged-ferry-jump'){check(a.before.gear===1&&a.before.wheelOmega===0&&a.before.ferryProgress===0&&a.after.wheelOmega===0&&a.after.ferryProgress===0&&a.rush.maxZ>8.4&&a.rush.maxZ<9&&a.rush.farDockContacts===0&&a.rush.to[1]<.1,'Zero-drive ferry attempt did not reach the shaft boundary or crossed the far dock');}
  else if(r.id==='loaded-near-hook-spam'){check(a.handResults.length===6&&a.handResults.every(v=>v===true)&&a.after.nearHandCount-a.before.nearHandCount===6&&a.after.bearingForce>1&&a.after.opening<.15&&a.after.tension===0&&a.after.farHandCount===0&&a.after.liveOwnership,'Loaded original near hook was not actually exercised by six finite hand inputs');}
  else if(r.id==='omit-far-retaining-finger'){check(a.loadedGate.opening>6.95&&a.loadedGate.tension>0&&a.unsupported.opening<.15&&a.unsupported.tension===0&&!a.unsupported.currentCable&&a.after.farHandCount===0&&a.after.fingerTravel===0&&a.after.retainingContacts===0&&a.after.opening<.15&&a.rush.minZ<.9&&a.rush.minZ>0,'Unretained train did not physically return before the gate-face jump');}
  if(r.level===18)check(r.contactSamples.reduce((a,b)=>a+b,0)===r.physicsSteps&&r.oneContactPoweredSteps===0,'An incomplete real series contact supplied motor current');
 }
 return report;
}
