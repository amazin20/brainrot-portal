import test from 'node:test';
import assert from 'node:assert/strict';
import {Body,Box,Quaternion,Vec3,World} from 'cannon-es';
import {applyCastlePortalRecoil,solveCastlePortalRecoil} from '../src/game/LabCastlePortalRecoil.js';
import {castleMovingFrameVelocity,createCastleMovingEntrySupport} from '../src/game/LabCastleMovingFrameTransport.js';

// These deliberately isolated small worlds load no game, scene, asset or win
// state. They prove candidate physics operators, not an ordinary room journey.
const V=(x=0,y=0,z=0)=>new Vec3(x,y,z);
const near=(a,b,e=1e-8)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b} (tolerance ${e})`);
const vectorNear=(a,b,e=1e-8)=>{near(a.x,b.x,e);near(a.y,b.y,e);near(a.z,b.z,e);};
const linearEnergy=b=>.5*b.mass*b.velocity.lengthSquared();
const shape=new Box(V(.39,.39,.39));
const transport=(from,to)=>{const a=from.unit(),b=to.unit(),q=new Quaternion();q.setFromVectors(a,b);return q;};
function recoilWorld(carrierSpeed=0,incoming=V(0,-Math.sqrt(390),0)){
 const world=new World({gravity:V()});
 const cargo=new Body({mass:3.2,shape,position:V(0,10,0),velocity:incoming,
  angularVelocity:V(.7,-.2,.3),linearDamping:0,angularDamping:0,collisionFilterMask:0});
 const carrier=new Body({mass:12,shape:new Box(V(1,.4,.4)),position:V(3,0,0),
  velocity:V(carrierSpeed,0,0),linearFactor:V(1,0,0),fixedRotation:true,
  linearDamping:0,angularDamping:0,collisionFilterMask:0});
 world.addBody(cargo);world.addBody(carrier);return{world,cargo,carrier};
}
function mechanicalSnapshot(body){return{position:body.position.toArray(),quaternion:body.quaternion.toArray(),
 angularVelocity:body.angularVelocity.toArray(),mass:body.mass,type:body.type,shapes:[...body.shapes]};}
function assertLedger(result,cargo,carrier,beforeP,beforeK){
 near(linearEnergy(cargo)+linearEnergy(carrier),beforeK,1e-7);
 const afterP=cargo.velocity.scale(cargo.mass).vadd(carrier.velocity.scale(carrier.mass));
 vectorNear(afterP.vsub(beforeP).vadd(result.fixedEntryImpulse).vadd(result.exitGuideImpulse),V(),1e-7);
 vectorNear(result.momentumResidual,V(),1e-7);
 near(result.totalDynamicRailMomentumAfter-result.totalDynamicRailMomentumBefore+result.fixedEntryRailImpulse,0,1e-7);
 near(result.railMomentumAfter,result.railMomentumBefore,1e-7);
 assert.ok(result.outgoingVelocity.vsub(result.carrierVelocityAfter).dot(result.carrierImpulse) <= 1e-7);
}

test('Freight recoil preserves energy and explicit support momentum for arbitrary initial rail velocity',()=>{
 for(const speed of [-30,-12,-4,0,4,12,30])for(const normalSpeed of [0,.5,8,Math.sqrt(390),35])for(const sign of [-1,1]){
  const incoming=V(2.3,-normalSpeed,-1.7),f=recoilWorld(speed,incoming),normal=V(sign,0,0);
  const q=new Quaternion();q.setFromAxisAngle(V(0,0,1),sign*Math.PI/2);
  const before=[mechanicalSnapshot(f.cargo),mechanicalSnapshot(f.carrier)],k=linearEnergy(f.cargo)+linearEnergy(f.carrier),
   p=f.cargo.velocity.scale(f.cargo.mass).vadd(f.carrier.velocity.scale(f.carrier.mass));
  const result=applyCastlePortalRecoil({cargoBody:f.cargo,carrierBody:f.carrier,
   transportRotation:q,railAxis:V(1,0,0),exitNormal:normal});
  assertLedger(result,f.cargo,f.carrier,p,k);
  assert.deepEqual(mechanicalSnapshot(f.cargo),before[0]);assert.deepEqual(mechanicalSnapshot(f.carrier),before[1]);
  vectorNear(f.cargo.velocity,result.outgoingVelocity);vectorNear(f.carrier.velocity,result.carrierVelocityAfter);
  assert.ok(f.cargo.velocity.vsub(f.carrier.velocity).dot(normal)>=-1e-8,'Cargo must separate through the outward moving mouth');
  assert.equal(result.cargoMass,3.2);assert.equal(result.carrierMass,12);
 }
});

test('A ten-metre drop transfers finite recoil energy into the real 12 kg carrier',t=>{
 const f=recoilWorld(),result=applyCastlePortalRecoil({cargoBody:f.cargo,carrierBody:f.carrier,
  transportRotation:transport(f.cargo.velocity,V(1,0,0)),railAxis:V(1,0,0),exitNormal:V(1,0,0)});
 near(result.kineticBefore,624);near(result.kineticAfter,624);
 near(f.cargo.mass*f.cargo.velocity.x+f.carrier.mass*f.carrier.velocity.x,0);
 assert.ok(f.carrier.velocity.x < -4.6 && f.carrier.velocity.x > -4.8);
 const carrierEnergy=linearEnergy(f.carrier),twelveMetreBudget=4*12+.5*.2*12**2;
 assert.ok(carrierEnergy>twelveMetreBudget);
 t.diagnostic(JSON.stringify({dropJ:result.kineticBefore,cargoOutMps:f.cargo.velocity.x,
  carrierMps:f.carrier.velocity.x,carrierJ:carrierEnergy,railFrictionPlusSpringJ:twelveMetreBudget,
  scope:'Impulse prototype only; no room route or coast distance certified'}));
});

test('Repeated isolated crossing operators reuse both bodies without replacing poses, masses or injecting energy',()=>{
 // Stimulated velocity-boundary activations, not geometrical aperture events
 // or a room journey. There is no gravity/friction in this operator fixture.
 const f=recoilWorld(7),initialK=linearEnergy(f.cargo)+linearEnergy(f.carrier),ids=[f.cargo.id,f.carrier.id];
 for(let i=0;i<128;i++){
  const normal=V(i%2?-1:1,0,0),beforeP=f.cargo.velocity.scale(f.cargo.mass).vadd(f.carrier.velocity.scale(f.carrier.mass)),
   beforeK=linearEnergy(f.cargo)+linearEnergy(f.carrier),poses=[mechanicalSnapshot(f.cargo),mechanicalSnapshot(f.carrier)];
  const result=applyCastlePortalRecoil({cargoBody:f.cargo,carrierBody:f.carrier,
   transportRotation:transport(f.cargo.velocity,normal),railAxis:V(1,0,0),exitNormal:normal});
  assertLedger(result,f.cargo,f.carrier,beforeP,beforeK);
  assert.deepEqual(mechanicalSnapshot(f.cargo),poses[0]);assert.deepEqual(mechanicalSnapshot(f.carrier),poses[1]);
  f.world.step(1/120);near(linearEnergy(f.cargo)+linearEnergy(f.carrier),initialK,2e-7);
  assert.deepEqual(f.world.bodies.map(b=>b.id),ids);
 }
});

test('Zero-energy crossing creates no motion; invalid recoil input leaves bodies untouched',()=>{
 const f=recoilWorld(0,V()),options={cargoBody:f.cargo,carrierBody:f.carrier,
  transportRotation:new Quaternion(),railAxis:V(1,0,0),exitNormal:V(1,0,0)};
 const zero=applyCastlePortalRecoil(options);near(zero.kineticAfter,0);vectorNear(f.cargo.velocity,V());vectorNear(f.carrier.velocity,V());
 const state=f.world.bodies.map(b=>({snapshot:mechanicalSnapshot(b),velocity:b.velocity.toArray()}));
 assert.throws(()=>applyCastlePortalRecoil({...options,transportRotation:{x:0,y:0,z:0,w:2}}),RangeError);
 assert.throws(()=>applyCastlePortalRecoil({...options,exitNormal:V(0,1,0)}),RangeError);
 assert.throws(()=>solveCastlePortalRecoil({cargoMass:0,carrierMass:12}),RangeError);
 f.world.removeBody(f.carrier);assert.throws(()=>applyCastlePortalRecoil(options),TypeError);f.world.addBody(f.carrier);
 assert.deepEqual(f.world.bodies.map(b=>({snapshot:mechanicalSnapshot(b),velocity:b.velocity.toArray()})),state);
});

function supportWorld(withCargo=true){
 const world=new World({gravity:V(0,-19.5,0)});world.solver.iterations=40;world.solver.tolerance=1e-10;
 const fixture=createCastleMovingEntrySupport(world);let cargo=null;
 if(withCargo){cargo=new Body({mass:3.2,shape:new Box(V(.39,.39,.39)),position:V(-2,4+.25+.39,0),
  linearDamping:0,angularDamping:0,allowSleep:false,collisionFilterGroup:2,collisionFilterMask:1});world.addBody(cargo);}
 return{world,...fixture,cargo};
}
const systemEnergy=f=>[f.support,f.counter,...(f.cargo?[f.cargo]:[])].reduce((sum,b)=>{
 const local=b.quaternion.conjugate().vmult(b.angularVelocity),rot=.5*(b.inertia.x*local.x**2+b.inertia.y*local.y**2+b.inertia.z*local.z**2);
 return sum+linearEnergy(b)+rot+19.5*b.mass*b.position.y;
},0);

test('Balanced live counterweights stay still without freight; original-mass contact alone drives the stroke',t=>{
 const unloaded=supportWorld(false);for(let i=0;i<120;i++)unloaded.world.step(1/120);
 near(unloaded.support.position.y,4,1e-5);near(unloaded.counter.position.y,4,1e-5);near(unloaded.support.velocity.y,0,1e-5);
 unloaded.dispose();assert.equal(unloaded.world.bodies.length,0);assert.equal(unloaded.world.constraints.length,0);
 const f=supportWorld(),initialEnergy=systemEnergy(f);let peakEnergy=initialEnergy,mid=null,maxError=0;
 for(let i=0;i<144;i++){
  f.world.step(1/120);peakEnergy=Math.max(peakEnergy,systemEnergy(f));
  maxError=Math.max(maxError,Math.abs(f.sample().pulleyError));
  if(!mid&&f.support.position.y<2.5)mid={sample:f.sample(),cargoY:f.cargo.position.y,cargoV:f.cargo.velocity.y};
 }
 assert.ok(mid,'Actual contact must accelerate the loaded support through its middle stroke');
 assert.ok(mid.sample.supportVelocity[1]<-2.5);assert.ok(mid.sample.counterVelocity[1]>2.5);
 near(mid.sample.supportVelocity[1]+mid.sample.counterVelocity[1],0,.003);
 near(mid.cargoV,mid.sample.supportVelocity[1],.01);near(mid.cargoY-mid.sample.supportPosition[1],.64,.003);
 assert.equal(f.cargo.mass,3.2);assert.equal(f.support.mass,10);assert.equal(f.counter.mass,10);
 assert.equal(f.support.type,Body.DYNAMIC);assert.equal(f.counter.type,Body.DYNAMIC);
 assert.ok(maxError<.003,`Pulley drift ${maxError}`);assert.ok(peakEnergy-initialEnergy<.1,`Energy gain ${peakEnergy-initialEnergy}`);
 t.diagnostic(JSON.stringify({mid,maxPulleyError:maxError,maximumEnergyGainJ:peakEnergy-initialEnergy}));f.dispose();
 assert.deepEqual(f.world.bodies,[f.cargo]);assert.throws(()=>f.sample(),/disposed/);f.dispose();
});

test('Contact stops bound the real stroke without changing dynamic mass or assigning actor poses',t=>{
 const f=supportWorld();let min=4,max=4,contacts=0;
 f.support.addEventListener('collide',e=>{if(e.body.type===Body.STATIC)contacts++;});
 for(let i=0;i<480;i++){f.world.step(1/120);min=Math.min(min,f.support.position.y);max=Math.max(max,f.counter.position.y);}
 assert.ok(contacts>0,'The lower stop must be reached through an actual contact');
 // At 1/120 s the approaching support travels roughly 33 mm per step. A
 // discrete contact can initially penetrate the stop; allow 20 mm, still well
 // below one step of travel, and report its measured maximum explicitly.
 assert.ok(min>=1-.02&&min<1.02,`Lower stroke ${min}`);assert.ok(max<=7+.02&&max>6.98,`Upper stroke ${max}`);
 t.diagnostic(JSON.stringify({minimumSupportY:min,maximumCounterY:max,
  stopPenetrationBudgetM:.02,measuredSupportPenetrationM:Math.max(0,1-min),actualStaticContacts:contacts}));
 near(f.support.mass,10);near(f.counter.mass,10);assert.equal(f.support.type,Body.DYNAMIC);assert.equal(f.counter.type,Body.DYNAMIC);f.dispose();
});

test('Moving-frame transport reads the contact-driven entry velocity and differs from static fall transport',t=>{
 const f=supportWorld();while(f.support.position.y>2.5)f.world.step(1/120);
 const before=f.world.bodies.map(b=>({snapshot:mechanicalSnapshot(b),velocity:b.velocity.toArray()})),q=new Quaternion();q.setFromAxisAngle(V(0,0,1),Math.PI/2);
 const input=V(0,-14,0),point=f.support.position.vadd(V(0,.25,0)),result=castleMovingFrameVelocity({incomingVelocity:input,
  transportRotation:q,entryBody:f.support,entryPoint:point});
 vectorNear(result.entryVelocity,f.support.velocity);near(result.outputVelocity.x,14+f.support.velocity.y,1e-7);
 assert.ok(result.outputVelocity.x>9&&result.outputVelocity.x<12);assert.ok(result.outputVelocity.x<q.vmult(input).x-2.5);
 const fallTime=Math.sqrt(2/19.5);assert.ok(result.outputVelocity.x*fallTime<q.vmult(input).x*fallTime-.8);
 assert.deepEqual(f.world.bodies.map(b=>({snapshot:mechanicalSnapshot(b),velocity:b.velocity.toArray()})),before);
 t.diagnostic(JSON.stringify({entryMps:result.entryVelocity.y,staticExitMps:q.vmult(input).x,
  movingExitMps:result.outputVelocity.x,oneMetreFallRangeM:result.outputVelocity.x*fallTime,
  scope:'Kinematics only; no dynamic player mass or complete transport energy ledger claimed'}));
 f.dispose();assert.throws(()=>castleMovingFrameVelocity({incomingVelocity:input,transportRotation:q,entryBody:f.support,entryPoint:point}),TypeError);
});

test('Velocity at each aperture includes its actual angular point velocity and exit translation',()=>{
 const world=new World(),entry=new Body({mass:10,shape,position:V(1,2,3),velocity:V(1,-2,3),angularVelocity:V(0,0,2)}),
  exit=new Body({mass:12,shape,position:V(-3,2,1),velocity:V(-4,2,0),angularVelocity:V(0,1,0)});
 world.addBody(entry);world.addBody(exit);
 const r=castleMovingFrameVelocity({incomingVelocity:V(9,-7,4),transportRotation:new Quaternion(),entryBody:entry,
  entryPoint:V(2,2,3),exitBody:exit,exitPoint:V(-3,2,2)});
 vectorNear(r.entryVelocity,V(1,0,3));vectorNear(r.exitVelocity,V(-3,2,0));vectorNear(r.outputVelocity,V(5,-5,1));
 assert.throws(()=>castleMovingFrameVelocity({incomingVelocity:V(),transportRotation:new Quaternion(),entryBody:entry,entryPoint:V(NaN,0,0)}),RangeError);
});
