import assert from 'node:assert/strict';

const integer=(value,min=0)=>assert.ok(Number.isSafeInteger(value)&&value>=min,'A finite integer physical witness is required');
const finite=value=>assert.ok(Number.isFinite(value),'A finite measured physical value is required');
const vector=(value,length)=>{assert.equal(value?.length,length);value.forEach(finite);};
const positive=value=>{finite(value);assert.ok(value>0);};
const ids=(values,count)=>{assert.equal(values?.length,count);values.forEach(value=>integer(value));assert.equal(new Set(values).size,count);};
const quaternion=value=>{vector(value,4);assert.ok(Math.abs(value.reduce((sum,n)=>sum+n*n,0)-1)<1e-5);};
const closeVector=(a,b)=>assert.ok(a.every((n,i)=>Math.abs(n-b[i])<1e-5),'Recorded support pose must match its actual body and foot');
const rotate=(v,q)=>{
 const [x,y,z]=v,[qx,qy,qz,qw]=q,tx=2*(qy*z-qz*y),ty=2*(qz*x-qx*z),tz=2*(qx*y-qy*x);
 return[x+qw*tx+qy*tz-qz*ty,y+qw*ty+qz*tx-qx*tz,z+qw*tz+qx*ty-qy*tx];
};

/** Validate a frozen ordinary-route event. This does not substitute for the
 * real world/capsule checks which create the witnesses, or claim that every
 * possible route and camera/device condition has been tested. */
export function assertPendulumPhysicalProof(proof,originalCargoBodyId){
 integer(originalCargoBodyId);
 assert.equal(proof?.physicalLowerCatch,true);assert.equal(proof.upperCatchKinematic,true);assert.equal(proof.originalCargo,true);
 assert.equal(Object.hasOwn(proof,'twoPhysicalCatches'),false,'The unchanged upper authored lift is not a second physical catch');
 const cell=proof.lowerPhysicalCell,crossing=proof.lowerCrossing;
 for(const flag of ['ready','latched','catchArmed','bodiesPresent','constraintsPresent','originalCargoPresent','originalCargoIdentityValid','originalCargoFree','currentCollisionValid','unloadedRetained','readyForCrossing'])assert.equal(cell?.[flag],true,flag);
 assert.equal(cell.disposed,false);assert.equal(cell.loadContact,false);assert.equal(cell.loadNormalForce,0);assert.equal(cell.loadContactCount,0);
 assert.equal(cell.originalCargoRawContact,false);assert.equal(cell.originalCargoRawContactCount,0);assert.equal(cell.originalCargoClearedCup,true);
 integer(cell.worldStep,1);assert.equal(cell.contactStep,cell.worldStep,'Retention must use the current completed physics step');
 integer(cell.loadedStep,1);integer(cell.loadedTicks,2);positive(cell.loadedNormalImpulse);positive(cell.lastLoadedNormalForce);
 integer(cell.retainedStartStep,1);integer(cell.retainedTicks,24);assert.ok(cell.loadedStep<cell.retainedStartStep);assert.equal(cell.retainedStartStep+cell.retainedTicks-1,cell.worldStep);
 integer(cell.pawlContactCount,1);positive(cell.pawlNormalForce);integer(cell.seatContactCount,1);positive(cell.seatNormalForce);
 finite(cell.angle);finite(cell.pawlAngle);assert.ok(Math.abs(cell.angle)<.055&&Math.abs(cell.pawlAngle)<.07);assert.equal(proof.lowerAngle,cell.angle);
 finite(proof.upperHeight);assert.ok(proof.upperHeight>5.78&&proof.upperHeight<=6.01);
 ids(cell.bodyIds,4);ids(cell.constraintIds,2);assert.deepEqual(cell.constraintEquationCounts,[5,5]);
 assert.deepEqual(cell.constraintMotorEnabled,[false,false]);assert.deepEqual(cell.constraintMotorEquationPresent,[false,false]);
 assert.equal(cell.originalCargoBodyId,originalCargoBodyId);integer(cell.originalCargoShapeId);assert.ok(!cell.bodyIds.includes(originalCargoBodyId));
 for(const key of ['cupShapeId','deckShapeId','pawlShapeId','pawlHeelShapeId','seatBodyId','seatShapeId'])integer(cell[key]);
 assert.equal(new Set([cell.cupShapeId,cell.deckShapeId,cell.pawlShapeId,cell.pawlHeelShapeId,cell.seatShapeId]).size,5);assert.ok(cell.bodyIds.includes(cell.seatBodyId));
 for(const body of [cell.bridge,cell.pawl]){integer(body?.id);assert.ok(cell.bodyIds.includes(body.id));assert.equal(body.type,1);positive(body.mass);vector(body.position,3);vector(body.velocity,3);vector(body.angularVelocity,3);vector(body.inertia,3);body.inertia.forEach(positive);quaternion(body.quaternion);}
 assert.notEqual(cell.bridge.id,cell.pawl.id);assert.ok(Math.abs(cell.bridge.angularVelocity[2])<.10);vector(cell.bridge.COMOffset,3);assert.ok(Math.hypot(...cell.bridge.COMOffset)>.1,'Gravity requires the actual eccentric centre of mass');
 const loaded=cell.loadedWitness;assert.ok(loaded?.first&&loaded.last);
 for(const load of [loaded.first,loaded.last]){integer(load.worldStep,1);assert.equal(load.originalCargoBodyId,originalCargoBodyId);assert.equal(load.originalCargoShapeId,cell.originalCargoShapeId);assert.equal(load.cupBodyId,cell.bridge.id);assert.equal(load.cupShapeId,cell.cupShapeId);positive(load.normalForce);finite(load.bridgeAngle);assert.equal(load.freeOriginal,true);}
 assert.ok(loaded.first.worldStep<=loaded.last.worldStep);assert.equal(loaded.last.worldStep,cell.loadedStep);assert.equal(loaded.last.normalForce,cell.lastLoadedNormalForce);
 assert.ok(cell.loadedTicks<=loaded.last.worldStep-loaded.first.worldStep+1,'Load ticks cannot exceed distinct completed steps');
 const hand=cell.catchWitness;integer(hand?.worldStep,1);integer(hand.handCount,1);assert.equal(hand.handCount,cell.handCount);finite(hand.angularImpulse);assert.ok(hand.angularImpulse<0&&Math.abs(hand.angularImpulse)<=1.2);assert.equal(Math.abs(hand.angularImpulse),cell.handAngularImpulse);assert.equal(hand.action,'close');assert.equal(hand.qualifiedLoad,true);assert.equal(hand.loadContact,true);assert.equal(hand.loadedAtStep,hand.loadedStep);positive(hand.loadNormalForce);assert.equal(hand.originalCargoBodyId,originalCargoBodyId);assert.equal(hand.originalCargoShapeId,cell.originalCargoShapeId);assert.equal(hand.cupBodyId,cell.bridge.id);assert.equal(hand.cupShapeId,cell.cupShapeId);assert.equal(hand.pawlBodyId,cell.pawl.id);finite(hand.angularMomentumBefore);finite(hand.angularMomentumAfter);assert.ok(Math.abs(hand.angularMomentumAfter-hand.angularMomentumBefore-hand.angularImpulse)<1e-7);integer(hand.loadedStep,1);assert.ok(loaded.first.worldStep<=hand.loadedStep&&hand.loadedStep<=hand.worldStep&&hand.worldStep<=cell.loadedStep);
 assert.equal(hand.loadedStep,hand.worldStep,'Hand input needs current actual original-cup contact');finite(hand.bridgeAngle);assert.ok(hand.bridgeAngle<-.08);
 assert.equal(crossing?.complete,true);integer(crossing.supportedDeckSteps,24);assert.equal(crossing.deckBodyId,cell.bridge.id);assert.equal(crossing.deckShapeIndex,0);
 const steps=['nearLandingStep','firstStep','midStep','farStep','islandStep'].map(key=>{integer(crossing[key],1);return crossing[key];});
 assert.ok(steps[0]>=cell.retainedStartStep+23);assert.ok(steps.every((step,i)=>step<=cell.worldStep&&(i===0||step>steps[i-1])),'Actual unloaded near/middle/far/island support must occur in causal order');
 assert.ok(crossing.supportedDeckSteps<=crossing.islandStep-crossing.firstStep,'Support ticks cannot exceed distinct completed traversal steps');
 const witnesses=crossing.checkpoints;assert.deepEqual(witnesses?.map(w=>w.name),['near','mid','far','island']);
 assert.equal(crossing.originalCargoBodyId,originalCargoBodyId);
 function supportWitness(witness){
  assert.equal(witness.grounded,true);assert.equal(witness.live,true);assert.equal(witness.footprintInside,true);vector(witness.foot,3);vector(witness.velocity,3);vector(witness.supportNormal,3);finite(witness.supportHeight);finite(witness.supportGap);assert.ok(Math.abs(witness.supportGap)<.003);assert.ok(Math.abs(witness.foot[1]-witness.supportHeight-witness.supportGap)<1e-7);assert.ok(witness.supportNormal[1]>.65);integer(witness.bodyId);integer(witness.shapeId);integer(witness.shapeIndex);assert.equal(typeof witness.colliderId,'string');assert.ok(witness.colliderId.length>0);vector(witness.bodyPosition,3);vector(witness.bodyQuaternion,4);vector(witness.shapeHalf,3);witness.shapeHalf.forEach(positive);
 }
 function foundedWitness(witness){
  assert.equal(witness.kind,'founded-floor');assert.ok(!cell.bodyIds.includes(witness.bodyId),'The landing must be a separately founded floor');assert.equal(witness.shapeIndex,0);quaternion(witness.bodyQuaternion);closeVector(witness.bodyQuaternion,[0,0,0,1]);assert.equal(witness.bounds?.length,2);witness.bounds.forEach(bound=>vector(bound,3));
  closeVector(witness.bounds[0].map((n,i)=>(n+witness.bounds[1][i])/2),witness.bodyPosition);closeVector(witness.bounds[0].map((n,i)=>(witness.bounds[1][i]-n)/2),witness.shapeHalf);
  closeVector(witness.supportNormal,[0,1,0]);
  assert.ok(witness.foot[0]>=witness.bounds[0][0]+.43&&witness.foot[0]<=witness.bounds[1][0]-.43&&witness.foot[2]>=witness.bounds[0][2]+.43&&witness.foot[2]<=witness.bounds[1][2]-.43);assert.ok(Math.abs(witness.supportHeight-witness.bounds[1][1])<.003);
 }
 const landing=crossing.nearLanding;assert.equal(landing?.worldStep,steps[0]);supportWitness(landing);foundedWitness(landing);
 for(const [index,witness]of witnesses.entries()){
  assert.equal(witness.worldStep,steps[index+1]);supportWitness(witness);
  if(index<3){
   assert.equal(witness.kind,'owned-oriented-deck');assert.equal(witness.capsuleGrounded,true);assert.equal(witness.originalCargoBodyId,originalCargoBodyId);assert.equal(witness.bodyId,cell.bridge.id);assert.equal(witness.shapeId,cell.deckShapeId);assert.equal(witness.shapeIndex,0);vector(witness.localFoot,3);vector(witness.shapeOffset,3);assert.deepEqual(witness.shapeHalf,[6,.2,2]);assert.ok(Math.abs(witness.localFoot[2])<2-.43);assert.ok(Math.abs(witness.localFoot[0])<6-.43);assert.ok(Math.abs(witness.localFoot[1]-.2)<.003);vector(witness.pose?.center,3);vector(witness.pose?.quaternion,4);assert.equal(witness.pose.step,witness.worldStep);
   quaternion(witness.bodyQuaternion);quaternion(witness.pose.quaternion);closeVector(witness.pose.quaternion,witness.bodyQuaternion);closeVector(rotate(witness.shapeOffset,witness.bodyQuaternion).map((n,i)=>n+witness.bodyPosition[i]),witness.pose.center);closeVector(rotate(witness.localFoot,witness.pose.quaternion).map((n,i)=>n+witness.pose.center[i]),witness.foot);closeVector(rotate([0,1,0],witness.pose.quaternion),witness.supportNormal);
   const axes=[[1,0,0],[0,1,0],[0,0,1]].map(axis=>rotate(axis,witness.pose.quaternion)),extent=[0,1,2].map(i=>axes.reduce((sum,axis,j)=>sum+Math.abs(axis[i])*witness.shapeHalf[j],0));assert.equal(witness.pose.bounds?.length,2);witness.pose.bounds.forEach(bound=>vector(bound,3));closeVector(witness.pose.bounds[0],witness.pose.center.map((n,i)=>n-extent[i]));closeVector(witness.pose.bounds[1],witness.pose.center.map((n,i)=>n+extent[i]));
  }else foundedWitness(witness);
 }
 assert.ok(witnesses[0].localFoot[0]<=-3&&witnesses[1].localFoot[0]>=-.9&&witnesses[2].localFoot[0]>=3);
 return {pass:true,originalCargoBodyId,loadedStep:cell.loadedStep,retainedStartStep:cell.retainedStartStep,currentStep:cell.worldStep,supportedDeckSteps:crossing.supportedDeckSteps,islandStep:crossing.islandStep,physicalLowerCatch:true,upperCatchKinematic:true};
}
