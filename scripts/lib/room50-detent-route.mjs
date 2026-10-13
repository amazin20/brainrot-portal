import * as THREE from 'three';
import {runExpansionBJourney} from '../../src/game/LabExpansionJourneyB.js';
import {installPreciseLateAim,aimLateSurface} from '../../src/game/LabLateCampaignAim.js';

const V=(...p)=>new THREE.Vector3(...p);
const check=(condition,message)=>{if(!condition)throw Error(message);};

/** Ordinary controller route, reproduced from the actual weak-contact audit.
 * A lower-floor sprint/jump/E delivers the original free cargo onto the guard.
 * It then gently contacts the real hinged wall. No fixture transforms, body
 * velocities, portal frames, mechanism state or completion flags are assigned.
 * Calling this route alone does not prove contact; the regression observes
 * actual cargo/top.body collision events and fails if the target is missed. */
export async function runRoom50WeakDetentDelivery(d,{onMark=()=>{}}={}){
 const {game:g,level:l}=d;
 check(l.index===49&&l.top?.body,'Weak detent route requires room 50');
 const mark=name=>{d.mark(name);onMark(name,g);};
 d.wait(.1);
 await runExpansionBJourney(d,{stopBeforeDelivery:true});
 mark('Ordinary room50 portal setup before any cargo delivery');
 d.walk(-23,17);d.walk(-23,-17);d.walk(-15,-17);d.walk(-15,7);
 installPreciseLateAim(d);
 aimLateSurface(d,0,l.well.surface,l.well.surface.getFrame().center.clone().setZ(8.3));
 d.walk(-15,-17);d.walk(-23,-17);d.walk(-23,11);d.walk(-8,17);
 d.until(()=>g.playerGrounded&&g.playerPosition.y<.5,5,'Initial south dock landing failed');
 d.walk(8,17);d.walk(8,1);d.walk(0,1);
 // The requested aim remains subject to the production surface fit clamp.
 aimLateSurface(d,1,l.outlet,l.outlet.getFrame().center.clone().setY(10.2));
 d.walk(8,1);d.walk(8,17);d.walk(-15,17);
 d.until(()=>g.playerGrounded&&g.playerPosition.y< -3.8,5,'West service landing failed');
 d.walk(-15,-17);d.walk(-23,-17);d.walk(-23,11);d.walk(-20,17);
 mark('Actual high outlet and lower-floor jump inlet prepared');
 let collected=false;
 for(let k=0;k<8&&!collected;k++){
  const p=g.cargo.position.clone();d.walk(p.x+1.4,p.z);d.stop();d.wait(.15);
  if(g.playerPosition.clone().add(V(0,1.1,0)).distanceTo(g.cargo.position)<2.2&&g.interact()&&g.heldCube){collected=true;d.wait(.55);}
 }
 check(collected,'Original cargo collection failed through ordinary E');
 d.walk(-23,17);d.walk(-23,-17);d.walk(-15,-17);d.walk(-16,-3);d.stop();
 mark('Original cargo at the lower-floor run start');
 g.input.keys.add('ShiftLeft');
 let queued=false,takeoff=null,released=false;
 const transports=g.physics.portalTransports;
 for(let n=0;n<300&&!released;n++){
  if(!queued&&g.playerPosition.z>.65&&g.playerGrounded){g.input.jumpQueued=true;queued=true;mark('Ordinary Space queued before the real inlet');}
  d.worldMove(0,1);d.frame();
  if(queued&&takeoff===null&&!g.playerGrounded&&g.playerVelocity.y>6)takeoff=n;
  if(takeoff!==null&&n-takeoff===4){check(g.interact()&&!g.heldCube,'Lower-floor E release failed');released=true;d.stop();mark('Free original cargo released after one actual jump');}
 }
 check(released,'Ordinary jump release did not complete');
 d.until(()=>g.physics.portalTransports>transports,6,'Original lower-floor delivery missed the real inlet');
 mark('Original free cargo emerged from the actual high outlet');
 d.wait(8);
 mark('Weak-contact detent observation finished');
}

/** The rejected weak delivery leaves the companion resting atop the solid
 * guard. Reach its visible upper face with one normal jump and the normal E
 * interaction, then carry the same body back onto the south dock. */
export function recoverRoom50WeakCargo(d,{onMark=()=>{},freeJumps=0,pickupDelayFrames=0}={}){
 const {game:g,level:l}=d;
 const cargo=g.cargo,body=g.physics.cargoBody;
 const mark=name=>{d.mark(name);onMark(name,g);};
 check(!g.heldCube&&g.state==='playing'&&!l.bumper.target,'Recovery requires the rejected free weak delivery');
 d.walk(-15,-2);d.walk(0,-2);d.walk(0,15.3);d.walk(-8,15.3);d.walk(-8,-1);d.walk(0,-1);
 d.walk(g.cargo.position.x,-3.05);d.stop();
 check(g.playerGrounded&&Math.abs(g.playerPosition.y)<.01,'Guard recovery must start on the actual south deck');
 mark('South deck reached below the rejected original cargo');
 // A player may test the reachable lip before taking hold. These are real
 // capsule/free-body contacts, including the attack that previously supplied
 // enough moment to bypass the low guard after only one gentle delivery.
 for(let attempt=0;attempt<freeJumps;attempt++){
  d.walk(g.cargo.position.x,-3.05);d.stop();
  g.input.jumpQueued=true;for(let n=0;n<100;n++)d.frame();d.wait(.5);
  mark('Ordinary free-cargo recovery jump completed without E');
 }
 if(freeJumps){d.walk(g.cargo.position.x,-3.05);d.stop();}
 g.input.jumpQueued=true;
 let recovered=false,eligibleFrame=null;
 for(let n=0;n<100&&!recovered;n++){
  d.frame();
  if(eligibleFrame===null&&!g.playerGrounded&&g.playerPosition.y>1.05)eligibleFrame=n;
  if(!g.playerGrounded&&g.playerPosition.y>1.05&&eligibleFrame!==null&&n-eligibleFrame>=pickupDelayFrames&&g.interact()&&g.heldCube){recovered=true;d.stop();mark('Original cargo recovered by ordinary airborne E above the guard');}
 }
 check(recovered,'Ordinary jump and E did not retrieve the guard-supported original cargo');
 d.walk(0,3);d.until(()=>g.playerGrounded,3,'Recovery did not land on the actual south dock');d.wait(.5);
 check(g.cargo===cargo&&g.physics.cargoBody===body&&g.heldCube===cargo,'Recovery changed the original cargo body');
 check(g.cargo.position.y<2&&g.cargo.position.z>1,'Original carried body did not physically leave the guard');
 mark('Same original cargo physically returned to the south dock');
}
