/** New finite production-input omission/corner/cargo attacks. Every actor pose,
 * velocity, mechanism target and win state is produced by the real simulation.
 * A setup failure is explicitly different from a defended attack. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from './lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {installPreciseLateAim,aimLateSurface} from '../src/game/LabLateCampaignAim.js';
import {runPostA} from '../src/game/LabPostJourneyA.js';
import {runPostB} from '../src/game/LabPostJourneyB.js';
import {runRoom30} from '../src/game/LabRoom30Journey.js';
const V=(...a)=>new THREE.Vector3(...a), results=[];
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function sourceHashes(){return Object.fromEntries(fs.readdirSync('src/game').filter(n=>n.endsWith('.js')).sort().map(n=>['src/game/'+n,digest(fs.readFileSync('src/game/'+n))]));}
const before=sourceHashes(),harnessBefore=digest(fs.readFileSync(fileURLToPath(import.meta.url)));
const selection=process.argv.find(x=>x.startsWith('--levels='))?.slice(9);
const levels=selection?selection.split(',').flatMap(s=>s.includes('-')?Array.from({length:+s.split('-')[1]-+s.split('-')[0]+1},(_,i)=>+s.split('-')[0]+i):[+s]):Array.from({length:12},(_,i)=>i+29);
const out=process.argv.find(x=>x.startsWith('--out='))?.slice(6)||'qa/speedrun-late-new.json';
function snapshot(g){const l=g.firstLevel;return {player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),cargoQuaternion:g.cargo.quaternion.toArray(),cargoUuid:g.cargo.group.uuid,cargoBodyId:g.physics.cargoBody.id,won:g.state==='won',held:!!g.heldCube,teleports:g.teleportCount,airflow:l.powered?.(),firstLatched:l.isFirstLatched?.(),secondLatched:l.isLatched?.(),cargoTransports:g.physics.portalTransports,rack:l.rack&&{stroke:l.rack.stroke,latched:l.rack.latched},optics:l.optics&&{...l.optics},spring:l.spring&&{compression:l.spring.compression,held:l.spring.held,loaded:l.spring.loaded()},pressure:l.pressureState&&{pressure:l.pressureState.pressure,coverage:l.pressureState.coverage,doorTravel:l.pressureState.doorTravel,mode:l.pressureState.mode},magnet:l.getMagnet?.(),calibration:l.getCalibration?.(),thermal:l.thermal&&{temperature:l.thermal.temperature,remote:l.thermal.remote,powered:l.thermal.powered},rotor:l.rotor&&{angle:l.rotor.angle},first:l.first&&{progress:l.first.progress},second:l.second&&{progress:l.second.progress},freight:l.freight&&{height:l.freight.position.y,target:l.freight.target},gardenLatch:l.state?.gardenLatch&&{engaged:l.state.gardenLatch.engaged}};}
function collect(d){const g=d.game;for(let i=0;i<12;i++){const c=g.cargo.position;d.walk(c.x+1.25,c.z);if(!g.kineticMode&&g.playerPosition.clone().add(V(0,1.1,0)).distanceTo(g.cargo.position)>2.2)continue;if(g.interact()){d.wait(.4);if(g.heldCube||g.velocityCompanion?.connected)return;}}throw Error('pickup interaction failed after repeated moving-cargo approaches');}
function release(d){d.stop();d.wait(.3);assert.ok(d.game.interact()&&!d.game.heldCube,'cargo release failed');d.wait(.6);}
function bounded(d,x,z,seconds=6){try{d.walk(x,z,seconds);return true;}catch(e){if(!/Blocked walking|Walk timed out/.test(e.message))throw e;return false;}}
function push(d,x,z,seconds=3,{jump=true,sprint=true}={}){for(let n=0;n<seconds*60&&d.game.state==='playing';n++){const delta=V(x,0,z).sub(d.game.playerPosition);delta.y=0;delta.normalize();d.worldMove(delta.x,delta.z);if(sprint)d.game.input.keys.add('ShiftLeft');if(jump&&n%45===0)d.game.input.jumpQueued=true;d.frame();}d.stop();}
function dash(d,x,z,seconds=10){for(let n=0;n<seconds*60&&d.game.state==='playing';n++){const delta=V(x,0,z).sub(d.game.playerPosition);delta.y=0;const dist=delta.length();if(dist<.18){d.stop();return true;}delta.normalize();d.worldMove(delta.x,delta.z);d.game.input.keys.add('ShiftLeft');d.frame();}d.stop();return false;}
function use(d,x,z){d.walk(x,z);d.wait(.25);assert.ok(d.game.interact(),'mechanism interaction failed');d.wait(.2);}
function save(){const after=sourceHashes(),harnessAfter=digest(fs.readFileSync(fileURLToPath(import.meta.url)));fs.mkdirSync('qa',{recursive:true});fs.writeFileSync(out,JSON.stringify({fingerprint:{before,after,harnessBefore,harnessAfter,drift:JSON.stringify(before)!==JSON.stringify(after)||harnessBefore!==harnessAfter},scope:'Finite new speedrun attacks using only walking, sprint/jump input, camera orientation, real projectiles, E interaction and clear-pair action; no actor/body/velocity/mechanism state is assigned. Setup failures are not passing attack evidence.',pass:JSON.stringify(before)===JSON.stringify(after)&&harnessBefore===harnessAfter&&results.every(r=>['blocked','legitimate_alternative'].includes(r.outcome)),attemptedLevels:[...new Set(results.map(r=>r.level))],results},null,2)+'\n');}
async function run(level,name,attack,metadata={}){const g=await createHeadlessGame();g.chamberEdition='foundation';await g.selectLevel(level-1,false);const originalCargo=g.cargo,originalCargoUuid=g.cargo.group.uuid,originalBody=g.physics.cargoBody,originalBodyId=originalBody.id;const t=Date.now(),record={level,id:g.firstLevel.id,name,outcome:'setup_failure',checkpoints:[]};let started=false;try{const report=await runV8Journey(g,{scenario:async d=>{if(level!==30)installPreciseLateAim(d);const start=()=>{started=true;record.start=snapshot(g);};const note=(text)=>record.checkpoints.push({text,state:snapshot(g)});await attack(d,start,note);record.outcome=g.state==='won'?(metadata.legitimate?'legitimate_alternative':'bypass_candidate'):'blocked';record.classification=metadata.legitimate?'Supported physical alternative: both portal-mediated airflow causes remain required; no collision or hidden-state bypass':undefined;}});record.frames=report.frames;record.resets=report.resets;record.respawns=report.respawns;}catch(e){record.outcome=started?'attack_error':'setup_failure';record.error=e.message;}finally{record.final=snapshot(g);record.sameCompanion=g.cargo===originalCargo&&g.cargo.group.uuid===originalCargoUuid;record.sameCargoBody=g.physics.cargoBody===originalBody&&g.physics.cargoBody.id===originalBodyId;record.originalCargoUuid=originalCargoUuid;record.originalCargoBodyId=originalBodyId;record.seconds=(Date.now()-t)/1000;g.physics.dispose();g.portals.dispose();results.push(record);save();console.log(record.outcome.toUpperCase(),level,name,record.error||'');}}
const cases={
29:[['dry-observation-ribbon-jump-wall-corners',async(d,start,note)=>{collect(d);for(const [x,z]of [[-14,4],[-18,4],[-18,18],[-8,18],[-8,6],[15,6]])d.walk(x,z);start();for(const x of [7,10,13,16,19]){bounded(d,x,1.2,4);push(d,x,-4,3);note('Sprint-jump receiving garden seam at x='+x);if(d.game.playerPosition.z<0&&d.game.playerPosition.y>8.7){bounded(d,17,-13,7);break;}bounded(d,x,5,4);} }]],
30:[['second-flight-without-outlet-angle-control',async(d,start,note)=>{const stop=Symbol('first flight');try{await runRoom30({...d,mark:text=>{d.mark(text);if(text.includes('physical arc reaches'))throw stop;}});}catch(e){if(e!==stop)throw e;}note('Normal first flight is the setup; second outlet control intentionally omitted');assert.ok(d.game.clearPortals());d.walk(42,30);start();try{aimLateSurface(d,1,d.level.panels['sunward-outlet']);}catch(e){if(!/rejected/i.test(e.message))throw e;note('Unadjusted outlet remained behind the real sightline screen: '+e.message);return;}d.walk(40,45);for(let i=0;i<1200;i++){const dx=43.7-d.game.playerPosition.x,dz=45-d.game.playerPosition.z,dist=Math.hypot(dx,dz);if(dist<.07&&Math.hypot(d.game.playerVelocity.x,d.game.playerVelocity.z)<.35){d.stop();d.wait(.2);break;}const pace=Math.min(.5,dist*.35);d.worldMove(dx/Math.max(dist,.001)*pace,dz/Math.max(dist,.001)*pace);d.frame();}aimLateSurface(d,0,d.level.panels['second-well']);d.walk(42,30);d.walk(60,30);const n=d.game.teleportCount;for(let i=0;i<240&&d.game.playerGrounded;i++){d.worldMove(0,1);d.game.input.keys.add('ShiftLeft');d.frame();}d.stop();try{d.until(()=>d.game.teleportCount>n,7,'Omitted-angle fall');d.until(()=>d.game.playerGrounded,12,'Omitted-angle landing');}catch(e){note(e.message);}bounded(d,200,31,8);note('Final shot kept its unadjusted physical outlet pose');}]],
31:[['empty-rack-player-push-through-inspection-seams',async(d,start,note)=>{for(const [x,z]of [[-15,21],[-15,16],[0,16],[-3,8]])d.walk(x,z);start();for(const z of [5.7,6.4,8,9.6,10.3]){bounded(d,-5.8,z,4);push(d,-12,z,3);note('Player body sprint-jump pushing inspection seam '+z);bounded(d,-3,8,4);}assert.ok(d.level.rack.stroke<.02,'Player body moved the isolated cargo rack');}],['initial-bridge-rim-jump-before-rack-motion',async(d,start,note)=>{collect(d);for(const [x,z]of [[-15,21],[-15,16],[-28.1,16],[-28.1,6],[-28.1,-16],[-24,-20]])d.walk(x,z);start();bounded(d,-15,-14,4);push(d,-18,-4,5);note('Jumped toward the idle cassette instead of extending it with cargo');push(d,2,-17,5);bounded(d,18,-20,5);assert.equal(d.level.rack.latched,false); }]],
32:[['upstream-source-shadow-skips-freight-dispatch',async(d,start,note)=>{d.walk(18,12);aimLateSurface(d,0,d.level.source);d.walk(-7,-1);aimLateSurface(d,1,d.level.relay);collect(d);d.walk(18,20);d.walk(16.6,18.0);start();bounded(d,15.4,17.06,4);release(d);d.wait(.2);note('Original cargo shadows the lower upstream source ray outside guarded receiving hood');if(d.level.optics.valid){dash(d,15.4,20);dash(d,13,20);dash(d,0,-12);dash(d,5.5,-13);assert.ok(d.game.interact(),'upstream ratchet action failed');note('Downstream diaphragm ratchet reached without any cargo portal transport');d.walk(0,-12);d.walk(0,4);d.walk(18,12);collect(d);d.walk(0,4);d.walk(0,-19);d.wait(.5);}else push(d,0,-12,4);}],['rotated-held-box-low-optical-slot',async(d,start,note)=>{collect(d);d.walk(-7,-1);start();for(const [x,z]of [[-12.7,-1],[-12.7,-1.9],[-12.7,-.1]]){bounded(d,x,z,5);d.look(V(-17,.55,-1));push(d,-18,-1,3);release(d);d.wait(.4);note('Yaw-rotated release at manufactured optical charge slot');if(!d.game.heldCube){const c=d.game.cargo.position;if(c.x> -14){try{collect(d);}catch(e){note('Cargo cannot be collected: '+e.message);break;}}else{note('Cargo crossed the protected hood without dispatch');break;}}} }]],
33:[['cargo-self-compression-and-release-without-player-load',async(d,start,note)=>{d.walk(0,10);aimLateSurface(d,1,d.level.mouth);aimLateSurface(d,0,d.level.ceiling);collect(d);d.walk(-15,14);d.walk(-8,14);d.walk(-8,12.75);d.game.input.jumpQueued=true;d.wait(.2);assert.ok(d.game.interact()&&!d.game.heldCube);d.wait(.8);start();d.wait(4);note('Only original cargo loads spring, player stays off its bed');d.walk(3.5,6);for(let i=0;i<4;i++){assert.ok(d.game.interact());d.wait(1);}note('Repeated outside release without observer-supplied compression');if(d.level.door.progress>.9){bounded(d,0,-12,8);bounded(d,5.5,-13,5);d.game.interact();d.wait(3);bounded(d,-12,-12,5);try{collect(d);}catch(e){note(e.message);}bounded(d,0,-21,8);} }]],
34:[['free-cargo-hand-feed-across-low-pressure-mouth',async(d,start,note)=>{collect(d);d.walk(-13,6.5);start();for(const z of [6.5,5.8,7.2]){bounded(d,-14.7,z,4);d.look(V(-17,.8,6.5));push(d,-17,z,2);release(d);d.wait(1);note('Rotated hand release through low cargo pressure inlet at z='+z);if(d.game.cargo.position.x< -15.5){note('Cargo entered sleeve without pressure-feed portal');break;}collect(d);}d.wait(5);bounded(d,-9,8.65,5);for(let i=0;i<2;i++){d.game.interact();d.wait(3);}push(d,0,-13,5);note('Tried valve discharge and closed human opening'); }]],
35:[['closing-door-sprint-skips-both-physical-latches',async(d,start,note)=>{
 d.walk(0,21);aimLateSurface(d,0,d.level.panels['air-origin']);aimLateSurface(d,1,d.level.panels['first-receiver']);d.until(()=>d.level.first.progress>.94,5,'First gate opening');
 d.walk(0,11);d.walk(0,0);aimLateSurface(d,1,d.level.panels['second-receiver']);d.until(()=>d.level.second.progress>.94,5,'Second gate opening');
 for(const [x,z]of [[0,-5],[0,-12],[8,-12],[8,-24.4],[0,-24.4]])d.walk(x,z);
 start();assert.ok(d.game.clearPortals());
 for(const [x,z]of [[8,-24.4],[8,-12],[0,-12]])d.walk(x,z);
 push(d,0,0,8);note('Real flow removed at the far inspection stance; sprint-jump return meets the closing second sluice with neither latch retained');
 assert.equal(d.level.isFirstLatched(),false);assert.equal(d.level.isLatched(),false);assert.ok(d.game.playerPosition.z<-7.4);assert.equal(d.game.physics.portalTransports,0);
 }]],
36:[['idle-rotor-cassette-corner-platform-jumps',async(d,start,note)=>{collect(d);d.walk(-12,-13);start();push(d,-4,-10,4);push(d,6,-6,4);bounded(d,19,-13,8);note('Upper corner jumps toward idle cassette and opposite gallery without momentum cargo strike');assert.ok(d.level.rotor.angle<.01); }]],
37:[['magnetic-control-preselection-hand-feed-slots',async(d,start,note)=>{collect(d);d.walk(-16,7);start();for(const x of [-16,-16.4,-15.6]){bounded(d,x,5,5);d.look(V(-16,.65,2));push(d,x,2,2);release(d);d.wait(.8);note('Free original cargo release through low inspection slit at x='+x);if(d.game.cargo.position.z<4){note('Cargo reached guarded duct without feed portal');break;}try{collect(d);}catch(e){note('Cargo retrieval blocked by real slit: '+e.message);break;}}if(d.game.heldCube)release(d);for(const [x,z]of [[-9,5.2],[0,.2],[8,.2]]){if(bounded(d,x,z,5)){d.game.interact();d.wait(5);}}note('All three coils requested from accessible observer controls');push(d,0,-16,5); }]],
38:[['lower-dispatch-sprint-jump-chase-ascending-freight',async(d,start,note)=>{collect(d);d.walk(11,6.8);d.walk(11,2);release(d);d.walk(17,13);start();assert.ok(d.game.interact(),'lower dispatch not within reach');note('Requested lower freight dispatch then chased its rising near lip');push(d,11,-4,5);d.wait(5);note('Cargo hoist attempted as player elevator instead of west gravity launch');if(d.game.playerPosition.y>14)bounded(d,16,-19,6); }]],
39:[['warming-first-door-optical-slot-corners',async(d,start,note)=>{collect(d);d.walk(-10,8);start();for(const x of [-12.7,-10,-7.2]){bounded(d,x,5,4);push(d,x,1,3);note('Sprint-jump optical inspection slit at x='+x);bounded(d,x,7,4);}push(d,0,-21,5);note('Tried the slit and partition while the physical heat store was warming; remote beam remained unconfigured'); }]],
40:[['common-trim-only-offset-source-sampling',async(d,start,note)=>{d.walk(18,23);aimLateSurface(d,0,d.level.input);d.walk(18,24.5);d.walk(8,24.5);d.walk(-6,18);d.walk(-6,10);aimLateSurface(d,1,d.level.outlet);start();d.walk(6,9.2);for(let i=0;i<7;i++){d.game.interact();d.wait(.7);note('Common trim only '+i);if(d.level.getCalibration().lit)break;}push(d,0,-21,5);note('Opposed slits tested with every common trim setting and no cargo lever arm'); }]],
};
cases[32].push(['cargo-portal-into-raised-source-instead-of-shadow-hood',async(d,start,note)=>{
 d.walk(18,12);aimLateSurface(d,1,d.level.source);
 collect(d);d.walk(0,20);d.walk(0,16.75);release(d);
 const at=d.game.cargo.position.clone();at.y=d.level.dispatch.surface.getFrame().center.y;
 start();aimLateSurface(d,0,d.level.dispatch.surface,at);
 try{d.until(()=>d.game.physics.portalTransports>0,6,'Cargo source dispatch');}catch(e){note(e.message);return;}
 d.wait(2);note('Original cargo dispatched into raised source, testing frame support before optical reuse');
 d.walk(-7,-1);aimLateSurface(d,1,d.level.relay);
 d.walk(18,12);aimLateSurface(d,0,d.level.source);d.wait(3);
 note('Source pair readdressed for both actual rays after freight was sent to wrong receiver');
 if(d.level.optics.valid){dash(d,0,4);dash(d,0,-12);dash(d,5.5,-13);d.game.interact();note('Wrong-source occlusion attempted downstream latch');}
 else push(d,0,-12,4);
}]);
cases[35].push(['carry-middle-cargo-keeps-second-flow-skips-both-latches',async(d,start,note)=>{
 d.walk(0,21);aimLateSurface(d,0,d.level.panels['air-origin']);aimLateSurface(d,1,d.level.panels['first-receiver']);
 d.until(()=>d.level.first.progress>.94,5,'First gate opening');note('The first real portal-mediated airflow opens only the first door');
 d.walk(0,11);d.walk(0,0);
 aimLateSurface(d,1,d.level.panels['second-receiver']);d.until(()=>d.level.second.progress>.94,5,'Second gate opening');note('Readdressed real portal-mediated airflow opens the second door while first closes');
 for(const [x,z]of [[0,-5],[0,-12],[8,-12],[8,-24.4],[0,-24.4]])d.walk(x,z);
 start();push(d,0,-20,4);assert.equal(d.game.interact(),false);assert.equal(d.game.heldCube,null);
 note('The old live-flow carry attempt physically reaches the inspection louvers, which exclude both the observer and the same original sealed cargo');
 d.walk(d.level.bay.aim[0],d.level.bay.aim[2]);aimLateSurface(d,0,d.level.panels['companion-address']);d.wait(2);
 note('A genuine floor shot paired with the narrow second air grille cannot dispatch the rigid cargo; the live flow ends without a retained latch');
 for(const [x,z]of [[8,-24.4],[8,-12],[0,-12]])d.walk(x,z);push(d,0,0,8);
 assert.equal(d.level.isFirstLatched(),false);assert.equal(d.level.isLatched(),false);
 assert.equal(d.game.physics.portalTransports,0);assert.deepEqual(d.level.powered(),[false,false]);assert.ok(d.game.playerPosition.z<-7.4);
}]);
cases[37].push(['last-coil-only-after-physical-feed-skips-two-bend-controls',async(d,start,note)=>{
 d.walk(-16,7);aimLateSurface(d,1,d.level.mouth);collect(d);
 d.walk(-16,17);d.walk(-16,15.5);release(d);d.walk(-10,18);
 const at=d.game.cargo.position.clone();at.y=d.level.entry.surface.getFrame().center.y;
 aimLateSurface(d,0,d.level.entry.surface,at);
 d.until(()=>d.game.physics.portalTransports>0&&d.game.cargo.position.z<6,6,'Cargo guarded duct feed');
 start();use(d,8,.2);assert.equal(d.level.getMagnet(),2);
 d.wait(25);note('Only distant third field pulls the actual original body against both real duct bends');
 if(d.level.receiver.loaded()){push(d,0,-16,5);note('Last field alone reached receiver');throw Error('Omission bypass: final coil loaded the receiver without either bend control');}
 assert.ok(d.level.door.progress<.01);assert.equal(d.game.state,'playing');
}]);
cases[36].push(['dry-balcony-drop-on-rotor-without-portal-impulse',async(d,start,note)=>{
 collect(d);d.walk(-14,-12);d.walk(-10,-7);start();
 d.game.input.jumpQueued=true;
 for(let i=0;i<18;i++){d.worldMove(.6,.5);d.game.input.keys.add('ShiftLeft');d.frame();}
 assert.ok(d.game.interact()&&!d.game.heldCube);d.stop();d.wait(8);
 note('Original cargo dropped from high balcony near the paddle without any linked portals');
 if(d.level.rotor.angle>1.54)throw Error('Omission bypass: dry balcony drop fully ratcheted the rotor without tangential portal impulse');
 assert.equal(d.game.physics.portalTransports,0);assert.equal(d.game.state,'playing');
}]);
// Left and right perimeter approaches are separate spawn-to-seam routes.
// They also explore the real lower recovery flooring below raised puzzles.
for(const n of Array.from({length:12},(_,i)=>29+i))for(const side of [-1,1]){
 cases[n].push([`${side<0?'west':'east'}-perimeter-foundation-and-wall-endaround`,async(d,start,note)=>{
  if(n===35)start();else{collect(d);start();}const b=d.level.bounds,x=n===35?side*24.9:side<0?b.minX+1.4:b.maxX-1.4;
  const initial=d.game.playerPosition.z;
  bounded(d,x,initial,5);if(n===35){d.wait(.8);assert.ok(d.game.playerPosition.y<-.5,'The actual 35 perimeter attack must descend to its lower chassis ledge');note('Native perimeter approach actually descends below the main deck onto its physical outer chassis ledge');}push(d,x,b.minZ+1.4,4);
  note('Sprint-jump against the '+(side<0?'western':'eastern')+' floor perimeter and north wall end');
  bounded(d,x,b.minZ+1.4,5);
  const goal=d.level.goal.position;push(d,goal.x,goal.z,4);bounded(d,goal.x,goal.z,5);
  note('Attempted to return from the perimeter or lower service floor directly to the joint goal');
  if(n===35){assert.equal(d.game.heldCube,null);assert.equal(d.game.physics.portalTransports,0);assert.ok(d.game.cargo.position.z<-16);note('The original cargo remains inside the closed far bay; no pickup-at-spawn setup was assumed');}
 }]);
}
export {cases as lateSpeedrunAttacks};
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){
 for(const n of levels)for(const [name,fn,metadata]of cases[n]||[])await run(n,name,fn,metadata);
 console.log('Report',out);if(results.some(r=>!['blocked','legitimate_alternative'].includes(r.outcome))||JSON.stringify(before)!==JSON.stringify(sourceHashes()))process.exitCode=1;
}
