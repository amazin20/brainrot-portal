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
 const ride=(worldStep,height)=>({worldStep,bodyId:14,shapeId:140,colliderId:'upper-owned-deck',foot:[-41,36+height,33],height,supportHeight:36+height,normal:[0,1,0],grounded:true});
 const upper={ready:true,disposed:false,worldStep:300,contactStep:300,height:6,pawlAngle:-.016,latched:true,retained:true,retainedTicks:24,powered:true,direction:-1,lastForce:75.85,pressureWork:32,forceBalance:{forceStep:299,contactStep:300,dt:1/120,liftBodyId:14,velocityBefore:0,velocityAfter:0,appliedPressure:75.85,inertialForce:0},gravity:[0,-19.5,0],catchForce:8,catchContacts:2,seatForce:0,seatContacts:0,topForce:0,bottomForce:0,handCount:1,handImpulse:1.2,catchWitness:{worldStep:260,action:'close',handCount:1,angularImpulse:-1.2,angularMomentumBefore:.3,angularMomentumAfter:-.9,height:6.49,liftBodyId:14,pawlBodyId:15},rideComplete:true,rideTicks:70,rideLow:ride(220,.2),rideHigh:ride(250,5.8),bodyIds:[12,13,14,15],bodiesPresent:true,constraintIds:[20,21],constraintsPresent:true,currentCollisionValid:true,constraintEquationCounts:[5,5],constraintMotorEquationPresent:[false,false],lift:{...body(14),mass:4.3,position:[-41,41.8,33]},pawl:{...body(15),mass:.28,quaternion:[0,Math.sin(-.016/2),0,Math.cos(-.016/2)]},deckShapeId:140,pawlShapeId:150,pawlHeelShapeId:151,seatBodyId:13,seatShapeId:130};
 return{physicalLowerCatch:true,physicalUpperCatch:true,twoPhysicalCatches:true,upperPhysicalCell:upper,originalCargo:true,lowerAngle:.02,upperHeight:6,lowerPhysicalCell:{ready:true,disposed:false,latched:true,catchArmed:true,bodiesPresent:true,constraintsPresent:true,originalCargoPresent:true,originalCargoIdentityValid:true,originalCargoFree:true,currentCollisionValid:true,unloadedRetained:true,readyForCrossing:true,loadContact:false,loadNormalForce:0,loadContactCount:0,originalCargoRawContact:false,originalCargoRawContactCount:0,originalCargoClearedCup:true,worldStep:300,contactStep:300,loadedStep:100,loadedTicks:80,loadedNormalImpulse:40,lastLoadedNormalForce:60,retainedStartStep:120,retainedTicks:181,pawlContactCount:2,pawlNormalForce:15,seatContactCount:4,seatNormalForce:8,angle:.02,pawlAngle:0,bodyIds:[1,2,3,4],constraintIds:[10,11],constraintEquationCounts:[5,5],constraintMotorEnabled:[false,false],constraintMotorEquationPresent:[false,false],originalCargoBodyId:8,originalCargoShapeId:80,cupShapeId:31,deckShapeId:30,pawlShapeId:40,pawlHeelShapeId:41,seatBodyId:2,seatShapeId:20,bridge:{...body(3),COMOffset:[-.5,-.47,0]},pawl:body(4),loadedWitness:{first:load(20),last:load(100)},handCount:1,handAngularImpulse:1.2,catchWitness:{worldStep:70,handCount:1,bridgeAngle:-.12,angularImpulse:-1.2,action:'close',qualifiedLoad:true,loadContact:true,loadedStep:70,loadedAtStep:70,loadNormalForce:60,originalCargoBodyId:8,originalCargoShapeId:80,cupBodyId:3,cupShapeId:31,pawlBodyId:4,angularMomentumBefore:0,angularMomentumAfter:-1.2}},lowerCrossing:{complete:true,supportedDeckSteps:46,deckBodyId:3,deckShapeIndex:0,originalCargoBodyId:8,nearLandingStep:150,firstStep:160,midStep:180,farStep:200,islandStep:210,nearLanding:founded('near-landing',150),checkpoints:[deck('near',160,-4),deck('mid',180,0),deck('far',200,4),founded('island',210)]}};
}

test('frozen pendulum receipt binds two physical catches, original load, finite hand work and ordered actual support',()=>{
 const result=assertPendulumPhysicalProof(receipt(),8);assert.equal(result.pass,true);assert.equal(result.physicalUpperCatch,true);assert.equal(result.twoPhysicalCatches,true);assert.equal(Object.hasOwn(result,'upperCatchKinematic'),false);
});

test('frozen upper catch receipt accepts full gravity retention after pressure is removed without inventing a heel reaction',()=>{
 const proof=receipt(),upper=proof.upperPhysicalCell;upper.powered=false;upper.lastForce=upper.forceBalance.appliedPressure=0;upper.catchForce=upper.lift.mass*19.5;
 assert.equal(upper.seatForce,0);assert.equal(upper.seatContacts,0);assert.equal(assertPendulumPhysicalProof(proof,8).pass,true);
});

test('frozen upper receipt accepts measured settling acceleration without pretending that the contact is static',()=>{
 const proof=receipt(),upper=proof.upperPhysicalCell,velocityBefore=.008144706578635742,velocityAfter=.005722116141124358;
 upper.lastForce=75.78484234737093;upper.catchForce=6.8150774464477495;upper.lift.velocity[1]=velocityAfter;
 upper.forceBalance={forceStep:299,contactStep:300,dt:1/120,liftBodyId:upper.lift.id,velocityBefore,velocityAfter,appliedPressure:upper.lastForce,inertialForce:upper.lift.mass*(velocityAfter-velocityBefore)*120};
 assert.ok(Math.abs(upper.catchForce-(upper.lift.mass*19.5-upper.lastForce))>.75,'This measured transient genuinely fails the invalid static assumption');
 assert.equal(assertPendulumPhysicalProof(proof,8).pass,true);
});

const forgeries={
 'missing actual force interval':p=>delete p.upperPhysicalCell.forceBalance,
 'stale force application step':p=>p.upperPhysicalCell.forceBalance.forceStep--,
 'stale force contact step':p=>p.upperPhysicalCell.forceBalance.contactStep--,
 'wrong force interval dt':p=>p.upperPhysicalCell.forceBalance.dt=1/60,
 'foreign force body':p=>p.upperPhysicalCell.forceBalance.liftBodyId=15,
 'force velocity detached from current body':p=>p.upperPhysicalCell.forceBalance.velocityAfter=.001,
 'force pressure detached from actual actuator':p=>p.upperPhysicalCell.forceBalance.appliedPressure=0,
 'invented inertial force':p=>p.upperPhysicalCell.forceBalance.inertialForce=2,
 'invented previous velocity':p=>p.upperPhysicalCell.forceBalance.velocityBefore=.1,
 'coherent invented acceleration with unbalanced contact':p=>{const u=p.upperPhysicalCell;u.forceBalance.velocityBefore=.1;u.forceBalance.inertialForce=-u.lift.mass*.1*120;},

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
 'missing physical upper catch':p=>p.physicalUpperCatch=false,
 'missing second physical catch':p=>delete p.twoPhysicalCatches,
 'legacy kinematic upper claim':p=>p.upperCatchKinematic=false,
 'missing upper dynamics':p=>delete p.upperPhysicalCell,
 'stale upper event step':p=>p.upperPhysicalCell.worldStep--,
 'stale upper contact step':p=>p.upperPhysicalCell.contactStep--,
 'removed upper body':p=>p.upperPhysicalCell.bodiesPresent=false,
 'detached upper collision':p=>p.upperPhysicalCell.currentCollisionValid=false,
 'removed upper constraint':p=>p.upperPhysicalCell.constraintsPresent=false,
 'motor-held upper catch':p=>p.upperPhysicalCell.constraintMotorEquationPresent[1]=true,
 'six-equation upper lock':p=>p.upperPhysicalCell.constraintEquationCounts[0]=6,
 'shared lower upper body':p=>p.upperPhysicalCell.bodyIds[0]=1,
 'shared lower upper constraint':p=>p.upperPhysicalCell.constraintIds[0]=10,
 'kinematic upper car':p=>p.upperPhysicalCell.lift.type=4,
 'static upper pawl':p=>p.upperPhysicalCell.pawl.mass=0,
 'upper still moving':p=>p.upperPhysicalCell.lift.velocity[1]=1,
 'tilted upper deck':p=>p.upperPhysicalCell.lift.quaternion=[0,Math.sin(.1),0,Math.cos(.1)],
 'invented upper pawl angle':p=>p.upperPhysicalCell.pawlAngle=.01,
 'upper height detached from goal':p=>p.upperPhysicalCell.height=5.99,
 'upper height detached from body':p=>p.upperPhysicalCell.lift.position[1]--,
 'unretained upper catch':p=>p.upperPhysicalCell.retainedTicks=23,
 'no upper catch reaction':p=>p.upperPhysicalCell.catchForce=0,
 'upper reaction does not carry load':p=>p.upperPhysicalCell.catchForce=80,
 'missing upper catch contact':p=>p.upperPhysicalCell.catchContacts=0,
 'end-stop-supported upper car':p=>p.upperPhysicalCell.topForce=8,
 'faked upper gravity':p=>p.upperPhysicalCell.gravity[1]=0,
 'unbounded upper drive force':p=>p.upperPhysicalCell.lastForce=2000,
 'powered-off upper drive':p=>p.upperPhysicalCell.powered=false,
 'nonfinite upper pressure work':p=>p.upperPhysicalCell.pressureWork=NaN,
 'wrong upper hand action':p=>p.upperPhysicalCell.catchWitness.action='release',
 'foreign upper hand body':p=>p.upperPhysicalCell.catchWitness.liftBodyId=3,
 'foreign upper pawl hand body':p=>p.upperPhysicalCell.catchWitness.pawlBodyId=4,
 'unbounded upper hand impulse':p=>p.upperPhysicalCell.handImpulse=12,
 'upper hand angular work invented':p=>p.upperPhysicalCell.catchWitness.angularMomentumAfter=0,
 'upper hand before high ride':p=>p.upperPhysicalCell.catchWitness.worldStep=249,
 'upper retention before hand':p=>p.upperPhysicalCell.retainedTicks=42,
 'upper ride omitted':p=>p.upperPhysicalCell.rideComplete=false,
 'upper low support missing':p=>p.upperPhysicalCell.rideLow=null,
 'upper high support missing':p=>p.upperPhysicalCell.rideHigh=null,
 'upper ride before lower crossing':p=>p.upperPhysicalCell.rideLow.worldStep=200,
 'upper ride checkpoints reversed':p=>p.upperPhysicalCell.rideLow.worldStep=255,
 'upper ride insufficient distinct steps':p=>p.upperPhysicalCell.rideHigh.worldStep=225,
 'upper ride tick invention':p=>p.upperPhysicalCell.rideTicks=10000,
 'upper high support on different body':p=>p.upperPhysicalCell.rideHigh.bodyId=3,
 'upper low support on different shape':p=>p.upperPhysicalCell.rideLow.shapeId=150,
 'upper support on different collider':p=>p.upperPhysicalCell.rideHigh.colliderId='other',
 'upper airborne ride':p=>p.upperPhysicalCell.rideHigh.grounded=false,
 'upper invented normal':p=>p.upperPhysicalCell.rideHigh.normal=[0,100,0],
 'upper low checkpoint too high':p=>p.upperPhysicalCell.rideLow.height=1,
 'upper high checkpoint too low':p=>p.upperPhysicalCell.rideHigh.height=5,
 'upper support detached from foot':p=>p.upperPhysicalCell.rideHigh.foot[1]++,
 'upper support detached from height':p=>{p.upperPhysicalCell.rideHigh.foot[1]++;p.upperPhysicalCell.rideHigh.supportHeight++;},
 'upper foot outside finite deck':p=>p.upperPhysicalCell.rideHigh.foot[0]+=8,
 'nonfinite measured normal':p=>p.lowerPhysicalCell.pawlNormalForce=NaN,
};
for(const [name,mutate]of Object.entries(forgeries))test('frozen pendulum receipt rejects '+name,()=>{const proof=receipt();mutate(proof);assert.throws(()=>assertPendulumPhysicalProof(proof,8));});
