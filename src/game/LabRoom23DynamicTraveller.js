import * as THREE from 'three';
import {Body,Material,PointToPointConstraint,Sphere,Vec3} from 'cannon-es';
import {captureRoom23BodyOwner,room23BodyOwnerValid,captureRoom23ConstraintOwner,room23ConstraintOwnerValid} from './LabRoom23Ownership.js';

const C=(x=0,y=0,z=0)=>new Vec3(x,y,z),UP=new THREE.Vector3(0,1,0);
const clamp=(v,limit)=>Math.max(-limit,Math.min(limit,v));

/** Room23 prototype only. The traveller has a persistent real 50 kg body.
 * Foot loads and finite hand-joint reactions reach the cabins through Cannon
 * contacts. Shared mass-zero walking/carry servos are restored on disposal.
 * Normal body poses/velocities are never assigned by movement or holding. */
export function buildRoom23DynamicTraveller(game,{spawn=[-17,0,15],mass=50,owns=()=>true,onOwnershipFault=()=>{}}={}){
 let owner=null,body=null,hand=null,disposed=false,grounded=false,contactStep=-1;
 let controls={move:new THREE.Vector2(),sprint:false,jump:false},lastHandPivot=null;
 let controlWork=0,jumpWork=0,handServoWork=0,companionWork=0,portalTransferWork=0,portalTransitWork=0,portalEvents=[],footLoad=0,forceCount=0,lastForce=null,lastCompanionForce=null;
 const wrappers=[],originals={},staticMasks=new Map(),shapeRadius=.43,height=2.4,maxHandForce=250,handReachSpeed=.5;
 let ownedWorld=null,bodyOwner=null,originalOwner=null,handOwner=null,handFacts=null,proxy=null,fault=null;
 const context=()=>!disposed&&!!owner&&owner===game.physics&&owns();
 const active=()=>{try{return!fault&&context()&&owner.world===ownedWorld&&owner.cargoBody===originalOwner?.body
  &&room23BodyOwnerValid(originalOwner,{bodyMask:()=>owner.carryTarget||owner.releasePlayerGrace?1:5})
  &&room23BodyOwnerValid(bodyOwner)&&owner.playerProxy===proxy&&proxy.body===body&&proxy.remaining===0
  &&(!hand||(handOwner?.constraint===hand&&room23ConstraintOwnerValid(handOwner)&&hand.pivotA===handFacts?.pivotA&&hand.pivotB===handFacts.pivotB
   &&hand.pivotA.almostEquals(lastHandPivot,1e-12)&&hand.pivotB.almostEquals(handFacts.pivotBValue,1e-12)
   &&handFacts.limits.every(row=>row.equation.minForce===row.minForce&&row.equation.maxForce===row.maxForce)));}catch{return false;}};
 function stopOwnedForces(reason){if(fault)return;fault=reason;if(hand){
  if(!room23ConstraintOwnerValid(handOwner)&&ownedWorld.constraints.includes(hand))ownedWorld.removeConstraint(hand);
  for(const e of new Set([...(handOwner?.equations.map(v=>v.equation)??[]),...(Array.isArray(hand.equations)?hand.equations:[])]))if(e&&typeof e==='object'){try{e.enabled=false;}catch{if(ownedWorld.constraints.includes(hand))ownedWorld.removeConstraint(hand);}}
 }}
 function ready(){if(active())return true;if(context()){
  const reason='current owned traveller/original body/shape/constraint no longer matches';
  stopOwnedForces(reason);onOwnershipFault(reason);
 }return false;}
 function wrap(object,key,factory){const original=object[key],descriptor=Object.getOwnPropertyDescriptor(object,key),wrapper=factory(original);originals[key]=original;object[key]=wrapper;wrappers.push({object,key,descriptor,wrapper});}
 function removeHand(){if(hand&&ownedWorld?.constraints.includes(hand))ownedWorld.removeConstraint(hand);hand=null;handOwner=null;handFacts=null;lastHandPivot=null;}
 function cargoEnergy(){const b=owner.cargoBody,omega=b.quaternion.conjugate().vmult(b.angularVelocity);return .5*b.mass*b.velocity.lengthSquared()+.5*(b.inertia.x*omega.x**2+b.inertia.y*omega.y**2+b.inertia.z*omega.z**2)-b.mass*owner.world.gravity.dot(b.position);}
 function setHand(target,dt=owner?.fixedStep??1/120){
  if(!ready()||!owner.cargoBody||!game.heldCube)return;
  // cannon-es 0.20 GSSolver clamps lambda as an impulse and reports lambda/dt.
  // Passing N*dt keeps the physical grip bounded at 250 N per axis.
  if(!hand){const start=owner.cargoBody.position.vsub(body.position);hand=new PointToPointConstraint(body,start,owner.cargoBody,C(),maxHandForce/Math.sqrt(3)*owner.fixedStep);hand.collideConnected=false;owner.world.addConstraint(hand);handOwner=captureRoom23ConstraintOwner(hand,ownedWorld);lastHandPivot=start.clone();
   handFacts={pivotA:hand.pivotA,pivotB:hand.pivotB,pivotBValue:hand.pivotB.clone(),limits:hand.equations.map(equation=>({equation,minForce:equation.minForce,maxForce:equation.maxForce}))};}
  const desired=C(target.x-body.position.x,target.y-body.position.y,target.z-body.position.z),delta=desired.vsub(hand.pivotA);
  const distance=delta.length();if(distance>handReachSpeed*dt)delta.scale(handReachSpeed*dt/distance,delta);
  const p=hand.pivotA.vadd(delta);
  if(lastHandPivot){const delta=p.vsub(lastHandPivot);const force=C(hand.equationX.multiplier,hand.equationY.multiplier,hand.equationZ.multiplier);handServoWork+=force.dot(delta);}
  hand.pivotA.copy(p);lastHandPivot=p.clone();
 }
 function readPose(){
  if(!active())return;
  game.playerPosition.set(body.position.x,body.position.y-height/2,body.position.z);
  game.playerVelocity.set(body.velocity.x,body.velocity.y,body.velocity.z);
  game.playerGrounded=grounded;game.groundedByCollider=grounded;game.groundedByOrientedCollider=grounded;
 }
 function resetBody(){
  if(!active())return;removeHand();const position=C(spawn[0],spawn[1]+height/2,spawn[2]);
  body.position.copy(position);body.previousPosition.copy(position);body.interpolatedPosition.copy(position);
  body.quaternion.set(0,0,0,1);body.previousQuaternion.copy(body.quaternion);body.interpolatedQuaternion.copy(body.quaternion);
  body.velocity.setZero();body.angularVelocity.setZero();body.force.setZero();body.torque.setZero();body.aabbNeedsUpdate=true;body.wakeUp();
  grounded=false;contactStep=-1;footLoad=controlWork=jumpWork=handServoWork=companionWork=portalTransferWork=portalTransitWork=forceCount=0;portalEvents=[];lastForce=lastCompanionForce=null;
  controls={move:new THREE.Vector2(),sprint:false,jump:false};
 }
 const traveller={
  get body(){return body;},get handJoint(){return hand;},get grounded(){return grounded;},get owner(){return owner;},
  ensure(){
   if(disposed||!game.physics?.cargoBody||!owns()||(owner&&owner!==game.physics))return false;if(owner)return ready();
   owner=game.physics;ownedWorld=owner.world;originalOwner=captureRoom23BodyOwner(owner.cargoBody,ownedWorld);
   if(mass!==50||owner.cargoBody.mass!==3.2){stopOwnedForces('current owned traveller/original mass definition no longer matches');return false;}
   body=new Body({mass,position:C(spawn[0],spawn[1]+height/2,spawn[2]),allowSleep:false,fixedRotation:true,
    linearDamping:0,angularDamping:0,collisionFilterGroup:4,collisionFilterMask:1|2,
    material:new Material({friction:.08,restitution:0})});
   for(const y of [-.77,0,.77]){const shape=new Sphere(shapeRadius);shape.collisionFilterGroup=4;body.addShape(shape,C(0,y,0));}owner.world.addBody(body);bodyOwner=captureRoom23BodyOwner(body,ownedWorld);
   for(const item of owner.solids.values()){staticMasks.set(item.body,item.body.collisionFilterMask);if(item.body.collisionFilterMask)item.body.collisionFilterMask|=1|4|16;}
   const oldProxy=owner.playerProxy;if(oldProxy?.body?.world===owner.world)owner.world.removeBody(oldProxy.body);
   owner.playerProxy={body,target:body.position.clone(),remaining:0};proxy=owner.playerProxy;
   wrap(game,'updatePlayer',original=>function(dt){
    if(!context())return original.call(this,dt);if(!ready())return;
    // The dynamic controller replaces shared walking, including its void
    // check. Keep the same whole-room restart at the shared -12 m boundary;
    // do this between physics steps, never inside Cannon's postStep event.
    if(body.position.y-height/2<-12&&typeof this.respawn==='function'){this.respawn();return;}
    const move=this.input.getMove();controls={move:move.clone(),sprint:this.input.keys.has('ShiftLeft')||this.input.keys.has('ShiftRight')||this.input.mobileSprint,jump:this.input.consumeJump()};
   });
   wrap(owner,'setPlayerProxy',original=>function(...args){return context()?(ready()?body:null):original.apply(this,args);});
   // This real dynamic traveller never uses the shared mass-zero walking
   // proxy servo, including after malformed proxy metadata is detected.
   wrap(owner,'_advanceKinematic',original=>function(record,...args){if(context()&&record===this.playerProxy){ready();return;}return original.call(this,record,...args);});
   wrap(owner,'setStaticEnabled',original=>function(id,enabled){const result=original.call(this,id,enabled);const item=this.solids.get(id);if(active()&&item&&game.colliderForId?.(id)?.enabled!==false)item.body.collisionFilterMask|=1|4|16;return result;});
   // Cargo-distance streaming cannot remove the founded drive bay or a wall
   // in a moving car's path. This small prototype keeps its statics resident.
   wrap(owner,'_streamDistantStatic',original=>function(...args){if(!context())return original.apply(this,args);if(!ready())return;for(const item of this.solids.values())if(!item.inWorld){this.world.addBody(item.body);item.inWorld=true;}});
   wrap(owner,'_carryForces',original=>function(...args){if(!context())return original.apply(this,args);ready();});
   wrap(owner,'setCarryTarget',original=>function(target,options){if(context()&&!ready())return false;const result=original.call(this,target,options);if(context())setHand(target,options?.dt??this.fixedStep);return result;});
   wrap(owner,'release',original=>function(...args){if(context()){if(!ready())return false;removeHand();}return original.apply(this,args);});
   wrap(owner,'teleportCargo',original=>function(...args){
    if(!context())return original.apply(this,args);if(!ready())return false;
    const before=cargoEnergy(),position=owner.cargoBody.position.toArray(),count=owner.portalTransports,result=original.apply(this,args);
    if(owner.portalTransports===count+1){const work=cargoEnergy()-before;portalTransferWork+=work;
     portalEvents.push({kind:'shared-geometric-cargo-portal-event',worldStep:owner.world.stepnumber,from:position,to:owner.cargoBody.position.toArray(),work,
      pair:game.portals.portals.map(p=>p?{position:p.position.toArray(),normal:p.normal.toArray()}:null)});if(portalEvents.length>16)portalEvents.shift();}return result;
   });
   wrap(owner,'resolveCargoTransit',original=>function(...args){if(!context())return original.apply(this,args);if(!ready())return false;const before=cargoEnergy(),result=original.apply(this,args);portalTransitWork+=cargoEnergy()-before;return result;});
   if(game.companionBehavior)wrap(game.companionBehavior,'update',original=>function(dt,...args){
    if(!context())return original.call(this,dt,...args);if(!ready())return;
    const cargo=owner.cargoBody,before=cargo.force.clone(),result=original.call(this,dt,...args);
    // The shared companion walks with actual horizontal forces. Bound and
    // account that separate powered source instead of hiding it in residuals.
    const force=C(clamp(cargo.force.x-before.x,60),0,clamp(cargo.force.z-before.z,60));
    let power=force.dot(cargo.velocity);if(power>100){force.scale(100/power,force);power=100;}
    cargo.force.x=before.x+force.x;cargo.force.z=before.z+force.z;
    if(dt>0)companionWork+=power*dt;
    lastCompanionForce={worldStep:owner.world.stepnumber,dt,force:force.toArray(),power,maxAxisForce:60,positivePreStepPowerBound:100};return result;
   });
   traveller.oldProxy=oldProxy;
   return true;
  },
  ownershipValid:active,
  stopOwnedForces,
  applyForces(dt){
   if(!(dt>0)||!traveller.ensure())return;
   const move=new THREE.Vector3(controls.move.x,0,controls.move.y).applyAxisAngle(UP,game.yaw);
   // Camera/avatar bearing follows the requested ordinary walking direction,
   // with a finite turn rate. Inertial settling after input release must not
   // turn the powered hand away from the surface the traveller approached.
   // The massive fixed-rotation body receives no orientation assignment.
   if(move.lengthSq()>.005){const target=Math.atan2(move.x,move.z),turn=Math.atan2(Math.sin(target-game.facing),Math.cos(target-game.facing))*(1-Math.exp(-12*dt));
    game.facing+=game.heldCube?clamp(turn,8*dt):turn;}
   const speed=game.heldCube?(controls.sprint?7.2:4.8):(controls.sprint?11:6.5);
   const gain=grounded?8:1.5,force=C(clamp((move.x*speed-body.velocity.x)*mass*gain,550),0,clamp((move.z*speed-body.velocity.z)*mass*gain,550));
   body.applyForce(force);controlWork+=force.dot(body.velocity)*dt;
   if(controls.jump&&grounded&&contactStep===owner.world.stepnumber){
    const before=.5*mass*body.velocity.lengthSquared();body.applyImpulse(C(0,mass*7.8,0));
    jumpWork+=.5*mass*body.velocity.lengthSquared()-before;grounded=false;
   }
   controls.jump=false;forceCount++;lastForce={worldStep:owner.world.stepnumber,dt,force:force.toArray(),power:force.dot(body.velocity),mass,grounded,footLoad,
    handForces:hand?[hand.equationX.multiplier,hand.equationY.multiplier,hand.equationZ.multiplier]:null};
  },
  postStep(){
   if(!ready())return;contactStep=owner.world.stepnumber;footLoad=0;grounded=false;
   for(const c of owner.world.contacts){if(c.enabled===false||c.multiplier<=1e-7)continue;
    const n=c.bi===body?-c.ni.y:c.bj===body?c.ni.y:0;
    if(n>.65){grounded=true;footLoad+=n*c.multiplier;}
   }
   if(!game.heldCube&&hand)removeHand();readPose();
  },
  reset(){if(traveller.ensure())resetBody();},
  diagnostics(){const valid=active();return{scope:'unaccepted Room23 real dynamic traveller prototype',ready:valid,ownershipValid:valid,fault,mass:body?.mass,bodyId:body?.id,
   grounded,footLoad,contactStep,forceCount,controlWork,jumpWork,handServoWork,companionWork,portalTransferWork,portalTransitWork,portalEvents,lastForce,lastCompanionForce,
   handJointPresent:!!hand,handJointOwned:valid&&!!hand&&room23ConstraintOwnerValid(handOwner),
   maxHandForce,handReachSpeed,handServoPowerBound:maxHandForce*handReachSpeed,playerPortalTransportImplemented:false};},
  dispose(){
   if(disposed)return;removeHand();disposed=true;
   for(const {object,key,descriptor,wrapper} of wrappers.reverse())if(object[key]===wrapper){if(descriptor)Object.defineProperty(object,key,descriptor);else delete object[key];}
   for(const [b,mask]of staticMasks)if(b.world===owner?.world)b.collisionFilterMask=mask;
   const restoreProxy=owner?.playerProxy===proxy;if(restoreProxy)owner.playerProxy=traveller.oldProxy??null;
   if(body?.world===ownedWorld)ownedWorld.removeBody(body);
   if(restoreProxy&&traveller.oldProxy?.body&&!ownedWorld.bodies.includes(traveller.oldProxy.body))ownedWorld.addBody(traveller.oldProxy.body);
  }
 };
 return traveller;
}
