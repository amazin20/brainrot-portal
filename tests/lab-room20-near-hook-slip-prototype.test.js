import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Body,Box,Vec3} from 'cannon-es';
import {createOrientedBoxContact} from '../src/game/LabOrientedBoxContact.js';
import {LabPhysics} from '../src/game/LabPhysics.js';
import {createHookFixture} from './helpers/room20-hook-prototype-fixture.js';
import {DT} from './helpers/room20-hook-prototype-fixture.js';
const close=(a,b,t=1e-6)=>assert.ok(Math.abs(a-b)<=t,`${a} differs from ${b}`);
function snap(f){const d=f.cell.diagnostics();return{worldStep:d.worldStep,contactStep:d.contactStep,opening:d.opening,hookAngle:d.hookAngle,bearingForce:d.bearingForce,captureForce:d.captureForce,cableWork:d.cableWork,driverOmega:d.slip.driverOmega,maxTorque:d.slip.maxAbsTorque,maxPower:d.slip.maxTotalCouplingPower,poses:[f.cell.gateBody,f.cell.hookBody,f.cell.driverBody,f.cargo,f.tray].map(b=>({p:b.position.toArray(),q:b.quaternion.toArray(),v:b.velocity.toArray(),w:b.angularVelocity.toArray()}))};}

test('DIAGNOSTIC passive slip drive blocks the same finite input under bearing load and releases after real original gravity unloading',()=>{
 const f=createHookFixture({slipDrive:true});try{f.step(240);const original=f.cargo,shape=original.shapes[0],loaded=f.cell.diagnostics();assert.ok(loaded.bearingForce>10&&loaded.bearingContacts>0);assert.ok(f.traySupport().normalForce>50);assert.equal(f.cell.hand(),true);let hand=f.cell.diagnostics().lastHand;close(hand.driverAngularMomentumAfter-hand.driverAngularMomentumBefore,.7,1e-8);const start=f.trace.length;f.step(240);const held=f.cell.diagnostics();assert.ok(f.trace.slice(start).every(d=>Math.abs(d.opening)<.005&&Math.abs(d.hookAngle)<.01));assert.ok(held.bearingForce>10);assert.equal(held.slip.maxAbsTorque,4);
  f.releaseTray();f.step(600);const relieved=f.cell.diagnostics();assert.equal(f.traySupport().contacts,0);assert.equal(relieved.originalFree,true);assert.ok(relieved.tension>50);assert.ok(relieved.opening>.59&&relieved.opening<.66);assert.equal(relieved.bearingForce,0);assert.ok(relieved.captureForce>20&&relieved.captureContacts>0);assert.equal(f.cargo,original);assert.equal(f.cell.originalCargoShape,shape);assert.equal(f.cell.hand(),true);hand=f.cell.diagnostics().lastHand;close(hand.driverAngularMomentumAfter-hand.driverAngularMomentumBefore,.7,1e-8);f.step(480);const opened=f.cell.diagnostics();assert.ok(opened.opening>2.39&&opened.hookAngle>2.7);f.cell.cutCable();f.step(960);const returned=f.cell.diagnostics();close(returned.opening,-.05);assert.equal(returned.tension,0);assert.equal(f.cargo,original);assert.equal(original.shapes[0],shape);assert.ok(f.raw.maxBearingDepth<.005&&f.raw.maxHingeDrift<.005);assert.deepEqual(returned.constraintEquationCounts,[5,5]);assert.deepEqual(returned.motorEnabled,[false,false]);assert.deepEqual(returned.motorEquationPresent,[false,false]);assert.ok(returned.slip.maxTotalCouplingPower<=1e-10);console.info('ROOM20_HOOK_SLIP_CAUSAL',JSON.stringify({ordinaryAccepted:false,sourceAccepted:false,prototypeAccepted:false,loaded,held,relieved,opened,returned,maxBearingDepth:f.raw.maxBearingDepth,maxHingeDrift:f.raw.maxHingeDrift}));
 }finally{f.dispose();}
});

test('DIAGNOSTIC free original gravity alone cannot release the smaller captive faces over 30 actual seconds',()=>{
 const f=createHookFixture({slipDrive:true});try{f.step(240,{record:false});f.releaseTray();f.step(4200,{record:false});const d=f.cell.diagnostics();assert.equal(d.handCount,0);assert.ok(d.tension>50&&d.originalFree&&d.captureForce>20);assert.ok(f.raw.maxOpening<.66&&f.raw.maxHookAngle<.04);assert.ok(f.raw.captureSteps>3000);assert.equal(f.traySupport().contacts,0);}finally{f.dispose();}
});

test('DIAGNOSTIC reached loaded face and real original tray resist every 15/30/60/120 Hz input plus long-frame bursts with zero original traction',()=>{
 const receipts=[];
 for(const config of [{rate:15,batch:1},{rate:30,batch:1},{rate:60,batch:1},{rate:120,batch:1},{rate:60,batch:8},{rate:120,batch:8}]){const f=createHookFixture({slipDrive:true});try{f.cell.cutCable();f.step(240,{record:false});const initial=f.cell.diagnostics(),tray=f.traySupport();assert.ok(initial.bearingForce>15&&initial.bearingContacts>0&&initial.originalFree);assert.ok(tray.normalForce>50&&tray.contacts>0&&tray.bodiesPresent);assert.equal(initial.tension,0);let requests=0,maxAngle=initial.hookAngle,maxOpening=initial.opening;const period=120/config.rate;for(let i=0;i<3600;i+=config.batch){for(let j=0;j<config.batch;j++)if((i+j)%period===0){assert.equal(f.cell.hand(),true);requests++;}f.step(config.batch,{frameSteps:config.batch,record:false});const d=f.cell.diagnostics();assert.equal(d.tension,0);assert.ok(d.slip.maxAbsTorque<=4+1e-12);assert.ok(Math.abs(d.slip.lastForce.totalTorque)<1e-12);assert.ok(d.slip.maxTotalCouplingPower<=1e-10);maxAngle=Math.max(maxAngle,d.hookAngle);maxOpening=Math.max(maxOpening,d.opening);}const d=f.cell.diagnostics();assert.equal(requests,config.rate*30);assert.equal(d.handCount,requests,'Every E really reaches the massive rotor');assert.ok(maxAngle<.01&&maxOpening<.005);assert.ok(d.bearingForce>15);assert.equal(f.cell.slipForceApplications.size,3840);for(let n=0;n<3840;n++)assert.equal(f.cell.slipForceApplications.get(n),1);receipts.push({...config,requests,initialBearing:initial.bearingForce,initialTrayForce:tray.normalForce,maxAngle,maxOpening,maxTorque:d.slip.maxAbsTorque,maxPower:d.slip.maxTotalCouplingPower,finalBearing:d.bearingForce,manualWork:d.manualWork,driverOmega:d.slip.driverOmega});}finally{f.dispose();}}
 console.info('ROOM20_HOOK_SLIP_REACHED_RATES',JSON.stringify({ordinaryAccepted:false,prototypeAccepted:false,receipts}));
});

test('DIAGNOSTIC passive torque and actual body trajectories are invariant across fixed-step frame batching',()=>{
 let reference=null;for(const frameSteps of [1,2,4,8]){const f=createHookFixture({slipDrive:true});try{f.step(240,{frameSteps,record:false});f.cell.hand();f.step(240,{frameSteps,record:false});f.releaseTray();f.step(640,{frameSteps,record:false});assert.equal(f.world.stepnumber,1120);assert.equal(f.cell.slipForceApplications.size,1120);for(let i=0;i<1120;i++)assert.equal(f.cell.slipForceApplications.get(i),1);const observed=snap(f);if(reference)assert.deepEqual(observed,reference);else reference=observed;const work=observed.cableWork;f.cell.updateForces(DT*frameSteps);const queued=JSON.stringify(snap(f));f.cell.updateForces(DT*frameSteps);f.cell.syncPose();assert.equal(JSON.stringify(snap(f)),queued);assert.equal(f.cell.diagnostics().cableWork,work);}finally{f.dispose();}}
});

test('DIAGNOSTIC slip rotor registry, mask identity, same IDs and both motor-free hinges survive reset and fully dispose',()=>{
 const f=createHookFixture({slipDrive:true});try{const {cell,world,game}=f;f.step(240,{record:false});const ids=cell.bodies.map(b=>b.id),joints=cell.constraints.map(c=>c.id),owned=[...cell.bodies],unowned=world.bodies.filter(b=>!owned.includes(b)),originalPosition=f.cargo.position.clone(),foreign={update(){}};world.subsystems.push(foreign);const subsystems=[...world.subsystems];assert.equal(cell.diagnostics().slip.registryValid,true);const saved=cell.driverBody.collisionFilterMask;cell.driverBody.collisionFilterMask=0;assert.equal(cell.diagnostics().slip.registryValid,false);cell.driverBody.collisionFilterMask=saved;assert.equal(cell.diagnostics().slip.registryValid,true);cell.reset();cell.reset();assert.deepEqual(cell.bodies.map(b=>b.id),ids);assert.deepEqual(cell.constraints.map(c=>c.id),joints);assert.equal(f.cargo.position.distanceTo(originalPosition),0);assert.deepEqual(world.subsystems,subsystems);assert.equal(cell.diagnostics().slip.registryValid,true);const remove=world.removeBody.bind(world);world.removeBody=b=>{if(owned.includes(b)){assert.deepEqual(world.subsystems,[foreign]);assert.ok([...game.physics.bodyBoxes.values()].every(e=>e.body!==b));assert.ok([...game.physics.cargoSweepBoxes.values()].every(e=>e.body!==b));assert.ok(world.constraints.every(c=>c.bodyA!==b&&c.bodyB!==b));}return remove(b);};cell.dispose();cell.dispose();assert.deepEqual(world.bodies,unowned);assert.equal(game.physics.bodyBoxes.size,0);assert.equal(game.physics.cargoSweepBoxes.size,0);assert.equal(cell.hand(),false);}finally{f.dispose();}
});

test('DIAGNOSTIC real detached or invalid driver cannot supply phantom coupling torque',()=>{
 const mutations=[
  ['detached-driver',f=>f.world.removeBody(f.cell.driverBody)],
  ['detached-driver-hinge',f=>f.world.removeConstraint(f.cell.driverHinge)],
  ['detached-hook-hinge',f=>f.world.removeConstraint(f.cell.hinge)],
  ['detached-foundation',f=>f.world.removeBody(f.cell.hinge.bodyA)],
  ['removed-driver-shape',f=>f.cell.driverBody.removeShape(f.cell.driverBody.shapes[0])],
  ['driver-body-mask',f=>{f.cell.driverBody.collisionFilterMask=0;}],
  ['driver-shape-mask',f=>{f.cell.driverBody.shapes[0].collisionFilterMask=0;}],
  ['driver-contact-response',f=>{f.cell.driverBody.collisionResponse=false;}],
  ['foreign-driver-registration',f=>{const id=f.cell.driverMesh.uuid,e=f.game.physics.bodyBoxes.get(id);f.game.physics.bodyBoxes.set(id,{...e});}],
  ['disabled-driver-joint-equation',f=>{f.cell.driverHinge.equations[0].enabled=false;}],
  ['hook-authored-type',f=>{f.cell.hookBody.type=Body.STATIC;}],
  ['gate-authored-type',f=>{f.cell.gateBody.type=Body.STATIC;}],
  ['fixed-authored-type',f=>{f.cell.fixedBody.type=Body.DYNAMIC;}],
  ['hook-authored-mass',f=>{f.cell.hookBody.mass+=1;}],
  ['gate-authored-mass',f=>{f.cell.gateBody.mass+=1;}],
  ['fixed-authored-mass',f=>{f.cell.fixedBody.mass=1;}]
 ];
 const receipts=[];
 for(const[name,mutate]of mutations){const f=createHookFixture({slipDrive:true});try{
  f.step(240,{record:false});assert.ok(f.cell.diagnostics().bearingForce>10);assert.equal(f.cell.hand(),true);f.step(1,{record:false});assert.ok(f.cell.driverBody.angularVelocity.z>1);
  mutate(f);const count=f.cell.diagnostics().handCount;assert.equal(f.cell.ensure(),false,name);assert.equal(f.cell.hand(),false,name);assert.equal(f.cell.diagnostics().handCount,count);
  let before=null,seen=0;const prepare={update(){before=[f.cell.hookBody.torque.z,f.cell.driverBody.torque.z];}},observe={update(){const actual=[f.cell.hookBody.torque.z-before[0],f.cell.driverBody.torque.z-before[1]];assert.deepEqual(actual,[0,0],name);const last=f.cell.diagnostics().slip.lastForce;assert.equal(last.worldStep,f.world.stepnumber);assert.equal(last.liveOwnership,false);assert.equal(last.actualHookTorque,0);assert.equal(last.actualDriverTorque,0);seen++;}};
  f.world.subsystems.splice(1,0,prepare);f.world.subsystems.push(observe);f.step(20,{record:false});assert.equal(seen,20);for(let n=0;n<261;n++)assert.equal(f.cell.slipForceApplications.get(n),1);
  receipts.push({name,actualIntervals:seen,phantomHookTorque:0,phantomDriverTorque:0,ownershipErrors:f.cell.diagnostics().slip.ownershipErrors});
 }finally{f.dispose();}}
 console.info('ROOM20_HOOK_SLIP_LIVE_OWNERSHIP',JSON.stringify({ordinaryAccepted:false,prototypeAccepted:false,receipts}));
});

test('DIAGNOSTIC actual solver clock reads E and current original identity after public frame preparation',()=>{
 const f=createHookFixture({slipDrive:true});try{
  f.step(240,{record:false});f.cell.hand();f.step(240,{record:false});f.releaseTray();f.step(600,{record:false});f.cell.hand();f.step(23,{record:false});assert.equal(f.world.stepnumber,1103);
  const before=[f.cell.hookBody.torque.z,f.cell.driverBody.torque.z],previousForce=f.cell.diagnostics().slip.lastForce;
  f.cell.updateForces(DT);assert.deepEqual([f.cell.hookBody.torque.z,f.cell.driverBody.torque.z],before);assert.deepEqual(f.cell.diagnostics().slip.lastForce,previousForce);
  assert.equal(f.cell.hand(),true);const currentDrive=f.cell.driverBody.angularVelocity.z;f.cell.updateForces(DT);assert.deepEqual([f.cell.hookBody.torque.z,f.cell.driverBody.torque.z],before);
  const foreign={update(){const d=f.cell.diagnostics().slip.lastForce;assert.equal(d.worldStep,1103);assert.equal(d.forceClock,'actual-world-subsystem');close(d.omegaDrive,currentDrive,1e-12);assert.ok(d.tau>0&&d.totalCouplingPower<=0);close(d.totalTorque,0,1e-12);f.cell.hookBody.torque.z+=.13;f.cell.driverBody.torque.z-=.07;}};
  f.world.subsystems.push(foreign);f.step(1,{record:false});f.world.subsystems.splice(f.world.subsystems.indexOf(foreign),1);assert.equal(f.cell.slipForceApplications.get(1103),1);
 }finally{f.dispose();}
 const mutants=[['held-original',f=>{f.game.heldCube=f.game.cargo;}],['carried-original',f=>{f.game.physics.setCarryTarget(f.cargo.position);}],['original-mask',f=>{f.cargo.collisionFilterMask=0;}],['original-response',f=>{f.cargo.collisionResponse=false;}],['detached-original',f=>{f.world.removeBody(f.cargo);}],['replaced-original-shape',f=>{const half=f.cargo.shapes[0].halfExtents.clone();f.cargo.removeShape(f.cargo.shapes[0]);f.cargo.addShape(new Box(half));}],['replaced-original-identity',f=>{f.game.cargo=new THREE.Object3D();}]];
 for(const[name,mutate]of mutants){const f=createHookFixture({slipDrive:true});try{f.step(240,{record:false});f.releaseTray();f.step(600,{record:false});assert.ok(f.cell.diagnostics().tension>50);const force=f.cargo.force.clone();f.cell.updateForces(DT);assert.equal(f.cargo.force.distanceTo(force),0);mutate(f);let observed=false,solverForce;f.world.subsystems.unshift({update(){solverForce=f.cargo.force.clone();}});f.world.subsystems.push({update(){assert.equal(f.cell.diagnostics().tension,0,name);assert.equal(f.cargo.force.distanceTo(solverForce),0,name);observed=true;}});f.step(1,{record:false});assert.equal(observed,true,name);}finally{f.dispose();}}
 const g=createHookFixture({slipDrive:true}),originalPhysics=g.game.physics,replacement=new LabPhysics();try{g.step(240,{record:false});g.releaseTray();g.step(600,{record:false});assert.ok(g.cell.diagnostics().tension>50);replacement.createCargo({position:[30,5,0]});g.game.physics=replacement;assert.equal(g.cell.originalFree,false);assert.equal(g.cell.ensure(),false);assert.equal(g.cell.hand(),false);g.world.step(DT);const d=g.cell.diagnostics();assert.equal(d.originalFree,false);assert.equal(d.tension,0);assert.equal(d.slip.lastForce.liveOwnership,false);assert.equal(d.slip.lastForce.actualHookTorque,0);assert.equal(d.slip.lastForce.actualDriverTorque,0);}finally{g.game.physics=originalPhysics;g.dispose();replacement.dispose();}
});

test('DIAGNOSTIC disposal preserves valid foreign bodyBox and static sweep replacements under owned UUIDs',()=>{
 const f=createHookFixture({slipDrive:true});try{
  f.step(240,{record:false});const physics=f.game.physics,world=f.world,owned=[...f.cell.bodies],foreign=new Body({mass:0,position:new Vec3(30,2,0),collisionFilterGroup:1,collisionFilterMask:3});for(let i=0;i<3;i++)foreign.addShape(new Box(new Vec3(.2,.2,.2)),new Vec3(i,0,0));world.addBody(foreign);
  const ids=[f.cell.driverMesh.uuid,f.cell.bearingLug.mesh.uuid,f.cell.fixedParts[0].mesh.uuid],entries=[];
  for(let i=0;i<ids.length;i++){const id=ids[i];physics.removeBodyBox(id);const orientedBox=createOrientedBoxContact(foreign,new THREE.Vector3(.2,.2,.2),new THREE.Vector3(i,0,0),world.stepnumber);physics.registerBodyBox(id,{body:foreign,shapeIndex:i,orientedBox});entries.push(physics.bodyBoxes.get(id));assert.equal(physics.inspectBodyBox(id).valid,true);}
  physics.removeCargoSweepBox(ids[2]);physics.registerCargoSweepBox(ids[2],{body:foreign,shapeIndex:2});const sweep=physics.cargoSweepBoxes.get(ids[2]),foreignSystem={update(){}};world.subsystems.push(foreignSystem);
  const original=f.cargo,shape=f.cargo.shapes[0];f.cell.dispose();f.cell.dispose();assert.equal(original.world,world);assert.equal(original.shapes[0],shape);assert.equal(foreign.world,world);assert.ok(world.bodies.includes(foreign));assert.deepEqual(world.subsystems,[foreignSystem]);assert.equal(world.constraints.length,0);assert.ok(owned.every(b=>!world.bodies.includes(b)));
  for(let i=0;i<ids.length;i++){assert.equal(physics.bodyBoxes.get(ids[i]),entries[i]);assert.equal(physics.inspectBodyBox(ids[i]).valid,true);}assert.equal(physics.bodyBoxes.size,3);assert.equal(physics.cargoSweepBoxes.get(ids[2]),sweep);assert.equal(physics.cargoSweepBoxes.size,1);
 }finally{f.dispose();}
});
