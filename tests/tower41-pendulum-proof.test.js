import test from 'node:test';
import assert from 'node:assert/strict';
import {assertPendulumPhysicalProof} from '../scripts/lib/tower41-pendulum-proof.mjs';

// A synthetic receipt exercises the independent frozen-evidence contract.
// Actual gravity, contacts and controller support are tested in the separate
// live-world cell/crossing tests and ordinary whole-castle route.
function receipt(){
 const body=id=>({id,type:1,mass:1,position:[0,0,0],velocity:[0,0,0],angularVelocity:[0,0,0],inertia:[1,1,1],quaternion:[0,0,0,1]});
 const load=worldStep=>({worldStep,originalCargoBodyId:8,originalCargoShapeId:80,cupBodyId:3,cupShapeId:31,normalForce:60,bridgeAngle:-.12,freeOriginal:true});
 const founded=(name,worldStep)=>({name,kind:'founded-floor',worldStep,grounded:true,live:true,footprintInside:true,foot:[0,0,0],velocity:[0,0,0],supportNormal:[0,1,0],supportHeight:0,supportGap:0,bodyId:9,shapeId:90,shapeIndex:0,colliderId:'founded-island',bodyPosition:[0,-.2,0],bodyQuaternion:[0,0,0,1],shapeHalf:[2,.2,4],bounds:[[-2,-.4,-4],[2,0,4]]});
 const deck=(name,worldStep,x)=>({...founded(name,worldStep),kind:'owned-oriented-deck',foot:[x,.2,0],supportHeight:.2,bodyPosition:[0,0,0],bodyId:3,shapeId:30,shapeIndex:0,colliderId:'owned-deck',originalCargoBodyId:8,capsuleGrounded:true,localFoot:[x,.2,0],shapeHalf:[6,.2,2],shapeOffset:[0,0,0],pose:{step:worldStep,center:[0,0,0],quaternion:[0,0,0,1],bounds:[[-6,-.2,-2],[6,.2,2]]}});
 return{physicalLowerCatch:true,upperCatchKinematic:true,originalCargo:true,lowerAngle:.02,upperHeight:6,lowerPhysicalCell:{ready:true,disposed:false,latched:true,catchArmed:true,bodiesPresent:true,constraintsPresent:true,originalCargoPresent:true,originalCargoIdentityValid:true,originalCargoFree:true,currentCollisionValid:true,unloadedRetained:true,readyForCrossing:true,loadContact:false,loadNormalForce:0,loadContactCount:0,originalCargoRawContact:false,originalCargoRawContactCount:0,originalCargoClearedCup:true,worldStep:300,contactStep:300,loadedStep:100,loadedTicks:80,loadedNormalImpulse:40,lastLoadedNormalForce:60,retainedStartStep:120,retainedTicks:181,pawlContactCount:2,pawlNormalForce:15,seatContactCount:4,seatNormalForce:8,angle:.02,pawlAngle:0,bodyIds:[1,2,3,4],constraintIds:[10,11],constraintEquationCounts:[5,5],constraintMotorEnabled:[false,false],constraintMotorEquationPresent:[false,false],originalCargoBodyId:8,originalCargoShapeId:80,cupShapeId:31,deckShapeId:30,pawlShapeId:40,pawlHeelShapeId:41,seatBodyId:2,seatShapeId:20,bridge:{...body(3),COMOffset:[-.5,-.47,0]},pawl:body(4),loadedWitness:{first:load(20),last:load(100)},handCount:1,handAngularImpulse:1.2,catchWitness:{worldStep:70,handCount:1,bridgeAngle:-.12,angularImpulse:-1.2,action:'close',qualifiedLoad:true,loadContact:true,loadedStep:70,loadedAtStep:70,loadNormalForce:60,originalCargoBodyId:8,originalCargoShapeId:80,cupBodyId:3,cupShapeId:31,pawlBodyId:4,angularMomentumBefore:0,angularMomentumAfter:-1.2}},lowerCrossing:{complete:true,supportedDeckSteps:46,deckBodyId:3,deckShapeIndex:0,originalCargoBodyId:8,nearLandingStep:150,firstStep:160,midStep:180,farStep:200,islandStep:210,nearLanding:founded('near-landing',150),checkpoints:[deck('near',160,-4),deck('mid',180,0),deck('far',200,4),founded('island',210)]}};
}

test('frozen pendulum receipt binds original load, finite hand work, live unloaded retention and ordered actual support',()=>{
 assert.equal(assertPendulumPhysicalProof(receipt(),8).pass,true);
});

const forgeries={
 'held original':p=>p.lowerPhysicalCell.originalCargoFree=false,
 'raw cup contact after nominal unload':p=>p.lowerPhysicalCell.originalCargoRawContact=true,
 'cargo still within finite cup':p=>p.lowerPhysicalCell.originalCargoClearedCup=false,
 'stale retention contact':p=>p.lowerPhysicalCell.contactStep--,
 'missing real pawl reaction':p=>p.lowerPhysicalCell.pawlNormalForce=0,
 'removed heel seat':p=>p.lowerPhysicalCell.seatContactCount=0,
 'motor-powered bridge':p=>p.lowerPhysicalCell.constraintMotorEquationPresent[0]=true,
 'foreign cargo shape load':p=>p.lowerPhysicalCell.loadedWitness.last.originalCargoShapeId=81,
 'forged load history':p=>p.lowerPhysicalCell.loadedWitness.last.worldStep=99,
 'raised bridge at hand input':p=>p.lowerPhysicalCell.catchWitness.bridgeAngle=.42,
 'stale original contact at hand input':p=>{p.lowerPhysicalCell.catchWitness.loadedStep=20;p.lowerPhysicalCell.catchWitness.loadedAtStep=20;},
 'invented load step count':p=>p.lowerPhysicalCell.loadedTicks=10000,
 'invented support step count':p=>p.lowerCrossing.supportedDeckSteps=10000,
 'invented founded normal':p=>p.lowerCrossing.checkpoints[3].supportNormal=[0,100,0],
 'invented finite deck bounds':p=>p.lowerCrossing.checkpoints[0].pose.bounds=[[100,100,100],[101,101,101]],
 'unloaded hand input':p=>p.lowerPhysicalCell.catchWitness.qualifiedLoad=false,
 'unbounded hand impulse':p=>p.lowerPhysicalCell.catchWitness.angularImpulse=-12,
 'invented angular work':p=>p.lowerPhysicalCell.catchWitness.angularMomentumAfter=0,
 'crossing before unloading':p=>p.lowerCrossing.nearLandingStep=100,
 'middle before near':p=>p.lowerCrossing.midStep=155,
 'coordinate-only exit':p=>p.lowerCrossing.checkpoints.pop(),
 'stale support pose':p=>p.lowerCrossing.checkpoints[1].pose.step--,
 'invented body pose':p=>p.lowerCrossing.checkpoints[1].bodyPosition[1]=1,
 'inconsistent foot position':p=>p.lowerCrossing.checkpoints[1].foot[0]=3,
 'different deck shape':p=>p.lowerCrossing.checkpoints[1].shapeId=31,
 'jump support':p=>p.lowerCrossing.checkpoints[1].grounded=false,
 'foot outside finite deck':p=>p.lowerCrossing.checkpoints[1].localFoot[2]=2,
 'deck used as founded island':p=>p.lowerCrossing.checkpoints[3].bodyId=3,
 'mislabelled upper physics':p=>p.twoPhysicalCatches=true,
 'nonfinite measured normal':p=>p.lowerPhysicalCell.pawlNormalForce=NaN,
};
for(const [name,mutate]of Object.entries(forgeries))test('frozen pendulum receipt rejects '+name,()=>{const proof=receipt();mutate(proof);assert.throws(()=>assertPendulumPhysicalProof(proof,8));});
