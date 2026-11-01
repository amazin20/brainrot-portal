import test from 'node:test';
import assert from 'node:assert/strict';
import {Body,Box,Quaternion,Vec3} from 'cannon-es';
import {LabPhysics} from '../src/game/LabPhysics.js';
import {solveCastlePortalRecoil} from '../src/game/LabCastlePortalRecoil.js';
const V=(x=0,y=0,z=0)=>new Vec3(x,y,z),Q=()=>new Quaternion();
const near=(a,b,e=1e-8)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
const vectorNear=(a,b)=>{near(a.x,b.x);near(a.y,b.y);near(a.z,b.z);};
const snapshot=b=>({position:b.position.toArray(),quaternion:b.quaternion.toArray(),velocity:b.velocity.toArray(),
 angularVelocity:b.angularVelocity.toArray(),force:b.force.toArray(),torque:b.torque.toArray(),mass:b.mass,type:b.type});
function fixture(){
 const physics=new LabPhysics({gravity:0}),cargo=physics.createCargo({position:[-3,10,2],velocity:[0,-20,0],angularVelocity:[.2,.3,.4]});
 const carrier=new Body({mass:12,shape:new Box(V(3,.2,4)),position:V(2,3,2),velocity:V(4,0,0),linearDamping:0,fixedRotation:true});physics.world.addBody(carrier);
 const rotation=Q();rotation.setFromAxisAngle(V(0,0,1),-Math.PI/2);
 const destination=V(3,5,2),result=solveCastlePortalRecoil({cargoMass:cargo.mass,carrierMass:carrier.mass,
  incomingVelocity:cargo.velocity,carrierVelocity:carrier.velocity,transportRotation:rotation,railAxis:V(1,0,0),exitNormal:V(-1,0,0)});
 const plan={sourceBody:cargo,sourceShape:cargo.shapes[0],sourceMass:cargo.mass,sourcePosition:cargo.position.clone(),sourceQuaternion:cargo.quaternion.clone(),
  sourceVelocity:cargo.velocity.clone(),world:physics.world,worldStep:physics.world.stepnumber,portalTransports:physics.portalTransports,
  entrySurfaceId:'actual-fixed-entry',exitSurfaceId:'actual-carrier-mouth',velocity:result.outgoingVelocity,
  reaction:{body:carrier,mass:carrier.mass,position:carrier.position.clone(),quaternion:carrier.quaternion.clone(),velocity:carrier.velocity.clone(),impulse:result.carrierImpulse,point:carrier.position.clone()},ledger:result};
 return{physics,cargo,carrier,rotation,destination,plan,result};
}

test('No-plan cargo transport retains rigid position, orientation, linear and angular transform',()=>{
 const f=fixture(),v=f.rotation.vmult(f.cargo.velocity),w=f.rotation.vmult(f.cargo.angularVelocity),q=f.rotation.mult(f.cargo.quaternion),carrier=snapshot(f.carrier);
 f.physics.teleportCargo({position:f.destination,rotation:f.rotation});
 vectorNear(f.cargo.position,f.destination);vectorNear(f.cargo.velocity,v);vectorNear(f.cargo.angularVelocity,w);
 assert.deepEqual(f.cargo.quaternion.toArray(),q.toArray());assert.deepEqual(snapshot(f.carrier),carrier);
 assert.equal(f.physics.lastPortalVelocityTransfer,null);assert.equal(f.physics.portalTransports,1);f.physics.dispose();
});

test('Valid declarative transfer commits once after cargo mutation with full vector support momentum balance',()=>{
 const f=fixture(),initialP=f.cargo.velocity.scale(f.cargo.mass).vadd(f.carrier.velocity.scale(f.carrier.mass)),
  initialK=.5*f.cargo.mass*f.cargo.velocity.lengthSquared()+.5*f.carrier.mass*f.carrier.velocity.lengthSquared(),carrierPose=f.carrier.position.toArray();
 const originalApply=f.carrier.applyImpulse.bind(f.carrier);let calls=0;
 f.carrier.applyImpulse=(impulse,point)=>{calls++;vectorNear(f.cargo.position,f.destination);assert.equal(f.physics.portalTransports,1);originalApply(impulse,point);};
 f.physics.teleportCargo({position:f.destination,rotation:f.rotation,velocityTransfer:f.plan});
 vectorNear(f.cargo.velocity,f.result.outgoingVelocity);vectorNear(f.carrier.velocity,f.result.carrierVelocityAfter);
 const afterP=f.cargo.velocity.scale(f.cargo.mass).vadd(f.carrier.velocity.scale(f.carrier.mass));
 vectorNear(afterP.vsub(initialP).vadd(f.result.fixedEntryImpulse).vadd(f.result.exitGuideImpulse),V());
 near(.5*f.cargo.mass*f.cargo.velocity.lengthSquared()+.5*f.carrier.mass*f.carrier.velocity.lengthSquared(),initialK);
 assert.equal(calls,1);assert.deepEqual(f.carrier.position.toArray(),carrierPose);assert.equal(f.physics.lastPortalVelocityTransfer.plan,f.plan);
 const committed=[snapshot(f.cargo),snapshot(f.carrier)];assert.throws(()=>f.physics.teleportCargo({position:f.destination,rotation:f.rotation,velocityTransfer:f.plan}),/Invalid or stale/);
 assert.deepEqual([snapshot(f.cargo),snapshot(f.carrier)],committed);assert.equal(calls,1);assert.equal(f.physics.portalTransports,1);f.physics.dispose();
});

test('Malformed or stale local transfer plans fail before either body or transport state changes',()=>{
 const corruptions=[p=>p.velocity=V(NaN,0,0),p=>p.reaction.impulse=V(Infinity,0,0),p=>p.sourcePosition.x+=.001,
  p=>p.sourceQuaternion.setFromAxisAngle(V(0,1,0),.01),p=>p.sourceVelocity.y-=.01,p=>p.sourceMass=99,
  p=>p.sourceShape={},p=>p.world={},p=>p.worldStep++,p=>p.portalTransports++,p=>p.entrySurfaceId=p.exitSurfaceId,
  p=>p.reaction.mass=99,p=>p.reaction.position.x+=.001,p=>p.reaction.velocity.x+=.01,
  p=>p.reaction.quaternion.setFromAxisAngle(V(1,0,0),.01),p=>p.reaction.body=p.sourceBody,p=>p.reaction.point=V(NaN,0,0),
  p=>p.velocity=V(1e308,0,0),p=>p.reaction.impulse=V(1e308,0,0),p=>p.reaction=null];
 for(const corrupt of corruptions){const f=fixture();corrupt(f.plan);const before=[snapshot(f.cargo),snapshot(f.carrier)];
  assert.throws(()=>f.physics.teleportCargo({position:f.destination,rotation:f.rotation,velocityTransfer:f.plan}),TypeError);
  assert.deepEqual([snapshot(f.cargo),snapshot(f.carrier)],before);assert.equal(f.physics.portalTransports,0);assert.equal(f.physics.lastPortalVelocityTransfer,null);f.physics.dispose();}
});

test('Malformed destination, zero rotation or nonfinite rotation fails before an otherwise valid reaction plan commits',()=>{
 for(const field of ['position','rotation','zero']){const f=fixture(),before=[snapshot(f.cargo),snapshot(f.carrier)];
  const options={position:f.destination,rotation:f.rotation,velocityTransfer:f.plan};
  if(field==='zero')options.rotation={x:0,y:0,z:0,w:0};else options[field]=field==='position'?V(NaN,0,0):{x:NaN,y:0,z:0,w:1};
  assert.throws(()=>f.physics.teleportCargo(options),TypeError);
  assert.deepEqual([snapshot(f.cargo),snapshot(f.carrier)],before);assert.equal(f.physics.portalTransports,0);f.physics.dispose();}
});

test('Held freight and a detached reaction body cannot enter the local free-cargo contract',()=>{
 for(const mode of ['held','detached']){const f=fixture();
  if(mode==='held')f.physics.setCarryTarget({position:V(-3,10,2),quaternion:Q()});else f.physics.world.removeBody(f.carrier);
  const before=[snapshot(f.cargo),snapshot(f.carrier)];assert.throws(()=>f.physics.teleportCargo({position:f.destination,rotation:f.rotation,velocityTransfer:f.plan}),TypeError);
  assert.deepEqual([snapshot(f.cargo),snapshot(f.carrier)],before);assert.equal(f.physics.portalTransports,0);f.physics.dispose();}
});
