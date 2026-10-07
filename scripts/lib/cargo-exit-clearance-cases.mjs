// Isolated production-controller fixtures. Planes/body poses are setup; these
// checks are not authored-level ordinary-input speedruns or exhaustive proof.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {playerFixture,portalPair,wall} from './adversarial-core-cases.mjs';
import {LabPhysics} from '../../src/game/LabPhysics.js';
import {releaseFixture,releaseStep,releaseSnapshot} from './cargo-release-portal-cases.mjs';
const H=1/120, V=(...p)=>new THREE.Vector3(...p);
const normalExtent=(quaternion,normal,half=.39)=>half*[V(1,0,0),V(0,1,0),V(0,0,1)]
 .reduce((sum,axis)=>sum+Math.abs(axis.applyQuaternion(quaternion).dot(normal)),0);
function setup({distance,angle=0,cargo=false}){
 const g=playerFixture();portalPair(g);
 const backing=wall(g,19.98,5,0,.04,10,10);g.portalSurfaceIds[1]=backing.uuid;
 const obstacle=wall(g,20+distance,5,0,.02,10,8);
 g.physics=new LabPhysics({gravity:0});for(const c of g.colliders)g.physics.addStaticBox(c.mesh.uuid,c.box);
 const q=new THREE.Quaternion().setFromAxisAngle(V(0,1,0),angle);
 // Match the actual oriented local box used by production moving balance decks.
 obstacle.quaternion.copy(q);obstacle.updateWorldMatrix(true,false);g.colliderForMesh(obstacle).box.setFromObject(obstacle);
 const solid=g.physics.solids.get(obstacle.uuid);solid.body.quaternion.copy(q);solid.body.previousQuaternion.copy(q);
 solid.body.aabbNeedsUpdate=true;g.physics.world.broadphase.dirty=true;
 if(cargo){
  g.cargo={position:V(0,5,.05),velocity:V(0,0,-22),quaternion:new THREE.Quaternion(),group:new THREE.Group()};
  g.physics.createCargo({position:g.cargo.position,velocity:g.cargo.velocity});
  g.companionAnimator={trigger(){}};g.playerPosition.set(100,0,100);
  g.firstLevel.cargoOnAnyPad=()=>false;g.firstLevel.getLaunch=()=>null;
 }else{g.playerPosition.set(0,3.8,.05);g.playerVelocity.set(0,0,-80);}
 return {g,backing,obstacle,normal:V(1,0,0).applyQuaternion(q)};
}
const dispose=g=>{g.physics.dispose();g.portals.dispose();};
export function runCargoExitClearance(){
 const results=[];
 for(const angleDegrees of [0,10,30,45,60])for(const distance of [.03,.08,.2,.94]){
  const {g,obstacle,normal}=setup({distance,angle:angleDegrees*Math.PI/180,cargo:true});
  try{
   const body=g.physics.cargoBody,id=body.id;g.updateCubes(H);
   const signedDistance=g.cargo.position.clone().sub(obstacle.position).dot(normal);
   const extent=normalExtent(g.cargo.quaternion,normal);
   assert.equal(g.physics.portalTransports,1);assert.equal(body.id,id);
   assert.ok(signedDistance+extent<=-.01+1e-5,`angle ${angleDegrees}, gap ${distance}: full cargo stays on approach side on actual transfer tick`);
   assert.deepEqual(g.cargo.position.toArray(),body.position.toArray());
   const firstPosition=g.cargo.position.toArray(),firstVelocity=body.velocity.toArray();
   for(let tick=0;tick<12;tick++)g.updateCubes(H);
   const afterDistance=g.cargo.position.clone().sub(obstacle.position).dot(normal);
   assert.ok(afterDistance+normalExtent(g.cargo.quaternion,normal)<=-.01+1e-5,'later physics cannot eject this cargo onto the far side');
   assert.equal(body.id,id);
   results.push({angleDegrees,distance,bodyId:id,signedDistance,extent,firstPosition,firstVelocity,afterPosition:g.cargo.position.toArray(),transports:g.physics.portalTransports});
  }finally{dispose(g);}
 }
 return {scope:'Isolated production updateCubes fixtures, setup portal planes/body poses. Not authored-level input runs.',physicsHz:120,results};
}
export function runPlayerExitClearance(){
 const results=[];
 for(const distance of [.01,.03,.08,.10,.20,.40]){
  const {g,obstacle}=setup({distance});try{
   g.updatePlayer(H);assert.equal(g.teleportCount,1);
   assert.ok(g.playerPosition.x+.43<=g.colliderForMesh(obstacle).box.min.x+1e-4,`gap ${distance}: complete player capsule cannot arrive through a separate wall`);
   const firstPosition=g.playerPosition.toArray(),firstVelocity=g.playerVelocity.toArray();
   g.clearPortals();g.updatePlayer(H);
   assert.equal(g.teleportCount,1,'clear is not another transfer');
   assert.ok(g.playerPosition.x+.43<=g.colliderForMesh(obstacle).box.min.x+1e-4,`gap ${distance}: clearing the blocked outlet cannot push the player through that separate wall`);
   results.push({distance,firstPosition,firstVelocity,afterClearPosition:g.playerPosition.toArray(),teleports:g.teleportCount});
  }finally{dispose(g);}
 }
 return {scope:'Isolated production updatePlayer plus clearPortals fixtures, setup portal planes/player momentum. Not authored-level input runs.',physicsHz:120,results};
}
export function runPermittedSkinPlacement(){
 const {g,backing,obstacle}=setup({distance:.03,cargo:true});try{
  Object.assign(backing.userData,{portalable:true,center:V(20,5,0),normal:V(1,0,0),
   portalBounds:{halfWidth:5,halfHeight:5},portalColliderId:backing.uuid});
  assert.ok(g.placeOnPanel(1,backing,V(20,5,0)),
   'production placement permits this distinct wall inside its 8 cm skin allowance');
  g.updateCubes(H);
  assert.equal(g.physics.portalTransports,1);
  assert.ok(g.cargo.position.x+.39<=g.colliderForMesh(obstacle).box.min.x+1e-5,
   'a permitted near-skin placement still cannot transport cargo through the separate wall');
  return {scope:'Isolated plane/body fixture with production placeOnPanel validation. Not an authored-level projectile/input run.',
   distance:.03,placementAccepted:true,position:g.cargo.position.toArray(),transports:g.physics.portalTransports};
 }finally{dispose(g);}
}
export function runRotatedTransitMomentum(){
 const physics=new LabPhysics({gravity:0});try{
  const obstacle=physics.addStaticBox('tilted-outlet-obstacle',{min:[20.93,0,-4],max:[20.95,10,4]});
  const angle=Math.PI/4,q=new THREE.Quaternion().setFromAxisAngle(V(0,1,0),angle);
  obstacle.quaternion.copy(q);obstacle.aabbNeedsUpdate=true;
  const n=V(1,0,0).applyQuaternion(q),t=V(0,0,1).applyQuaternion(q),velocity=n.clone().multiplyScalar(18).addScaledVector(t,6).add(V(0,2,0));
  const body=physics.createCargo({position:[0,5,.05],velocity:velocity,angularVelocity:[.4,.5,.6]});
  const id=body.id;physics.teleportCargo({position:[20.8,5,0]});
  const angular=body.angularVelocity.clone(),contact=physics.resolveCargoTransit([20,5,0]);
  const resulting=V().copy(body.velocity);
  assert.equal(body.id,id);assert.equal(physics.portalTransports,1);assert.ok(contact.contacts>0);
  assert.ok(Math.abs(resulting.dot(n))<1e-10,'contact stops only inward normal momentum');
  assert.ok(Math.abs(resulting.dot(t)-6)<1e-10,'tangential momentum is retained');
  assert.equal(body.velocity.y,2);assert.deepEqual(body.angularVelocity,angular);
  assert.deepEqual(physics.sample(0).position,physics.sample(1).position,'correction does not leave an interpolated trail through the wall');
  const signedDistance=V().copy(body.position).sub(V().copy(obstacle.position)).dot(n);
  assert.ok(signedDistance+normalExtent(new THREE.Quaternion().copy(body.quaternion),n)<=-.01+1e-5);
  return {bodyId:id,position:body.position.toArray(),velocity:body.velocity.toArray(),angularVelocity:angular.toArray(),contacts:contact.contacts};
 }finally{physics.dispose();}
}
export function runHeldExitClearance(){
 const results=[];
 for(const distance of [.03,.08,.20,.40,.70,.94]){
  const g=releaseFixture(),obstacle=wall(g,19.98-distance,5,0,.02,10,8);
  g.physics.addStaticBox(obstacle.uuid,g.colliderForMesh(obstacle).box);
  try{
   const body=g.physics.cargoBody,id=body.id;
   assert.ok(g.interact()&&g.heldCube,'ordinary initial pickup succeeds');g.move.set(0,-1);
   let tick=0;
   for(;tick<120;tick++){
    g.updatePlayer(H);
    if(g.teleportCount)break;
    g.updateCubes(H);
   }
   assert.ok(tick<120,'ordinary held approach reaches the source portal');
   assert.equal(g.teleportCount,1);assert.equal(g.physics.portalTransports,1);assert.equal(body.id,id);
   const limit=g.colliderForMesh(obstacle).box.max.x;
   const fullNearSide=()=>g.cargo.position.x-normalExtent(g.cargo.quaternion,V(1,0,0))>=limit-1e-5;
   assert.ok(fullNearSide(),`gap ${distance}: the held cargo cannot arrive beyond a separate wall on its owner's transfer tick`);
   const immediate=releaseSnapshot(g);g.move.set(0,0);
   for(let i=0;i<30;i++)releaseStep(g);
   assert.ok(fullNearSide(),'the grip spring cannot push the original body through the destination barrier');
   g.clearPortals();assert.ok(g.interact()&&!g.heldCube,'internal pair closing and ordinary release preserve body');
   let minimumReleasedCentreDistance=Infinity,maximumReleasedContactPenetration=0;
   for(let i=0;i<30;i++){
    releaseStep(g);
    const centreDistance=g.cargo.position.x-obstacle.position.x;
    minimumReleasedCentreDistance=Math.min(minimumReleasedCentreDistance,centreDistance);
    maximumReleasedContactPenetration=Math.max(maximumReleasedContactPenetration,
     limit-(g.cargo.position.x-normalExtent(g.cargo.quaternion,V(1,0,0))));
    // The ordinary Cannon solver permits partial contact penetration in this
    // deliberately narrow trap after release. The exploit is crossing the
    // barrier to its other side, which must never occur in any fixed step.
    assert.ok(centreDistance>=.01-1e-5,'clear then release cannot cross the cargo centre through the destination barrier');
   }
   assert.equal(body.id,id);
   results.push({distance,ticksToTransfer:tick+1,immediate,minimumReleasedCentreDistance,maximumReleasedContactPenetration,afterClearRelease:releaseSnapshot(g)});
  }finally{dispose(g);}
 }
 return {scope:'Isolated geometry and initial actor/portal setup. Subsequent pickup, approach, transfer and release use production controller methods; pair closing is an internal lifecycle fixture, not a player input. Not an authored-level speedrun.',physicsHz:120,results};
}
