import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Body,HingeConstraint} from 'cannon-es';
import {LabPhysics} from '../src/game/LabPhysics.js';
import {SingularityKit} from '../src/game/LabSingularityKit.js';
import {buildTower41FlywheelCell} from '../src/game/LabTower41FlywheelCell.js';

const DT=1/120;
function fixture({loaded=true,centre=[0,0,0]}={}){
 const game={scene:new THREE.Scene(),colliders:[],floors:[],cameraBlockers:[],aimBlockers:[],portalPanels:[],cargo:new THREE.Object3D(),heldCube:null};
 const kit=new SingularityKit(game);kit.floor(centre[0]-20,centre[0]+20,centre[2]-20,centre[2]+20,centre[1]);
 const cell=buildTower41FlywheelCell(game,kit,{centre});assert.equal(cell.ensure(),false);
 game.physics=new LabPhysics();for(const c of game.colliders)game.physics.addStaticBox(c.mesh.uuid,c.box,{kinematic:c.kinematic});
 game.physics.createCargo({position:[centre[0]+(loaded?11:16),centre[1]+1.2,centre[2]+5]});cell.ensure();
 const cargo=game.physics.cargoBody,world=game.physics.world;
 const measure={actualLoadTicks:0,normalImpulse:0,maxGearError:0,maxHingeDrift:0,minimumRotorY:Infinity,maxLoadPenetration:0};
 const step=(seconds=DT)=>{for(let i=0;i<Math.round(seconds/DT);i++){
  cell.updateForces(DT);game.physics.step(DT);
  measure.maxGearError=Math.max(measure.maxGearError,Math.abs(cell.output-cell.omega*cell.ratioValue));
  for(const [j,b]of cell.rotors.entries()){measure.maxHingeDrift=Math.max(measure.maxHingeDrift,b.position.distanceTo(cell.rotorOrigins[j]));b.updateAABB();measure.minimumRotorY=Math.min(measure.minimumRotorY,b.aabb.lowerBound.y);}
  const contacts=world.contacts.filter(c=>[c.bi,c.bj].includes(cargo)&&[c.bi,c.bj].includes(cell.fixedBody)&&[c.si,c.sj].includes(cell.fixedBody.shapes[cell.trayShapeIndex])&&c.multiplier>1e-6);
  for(const c of contacts){const a=c.bi.position.vadd(c.ri),b=c.bj.position.vadd(c.rj);measure.maxLoadPenetration=Math.max(measure.maxLoadPenetration,Math.max(0,-c.ni.dot(b.vsub(a))));measure.normalImpulse+=c.multiplier*DT;}
  measure.actualLoadTicks+=Number(contacts.length>0);
 }};
 const charge=()=>{cell.cycleRatio();for(let i=0;i<5;i++){assert.equal(cell.crank(),true);step(.28);}};
 return{game,kit,cell,cargo,world,measure,step,charge,dispose(){cell.dispose();kit.dispose();game.physics.dispose();}};
}

test('Tower41 hand impulse charges three actual inertial bodies through a passive ratio and the original contact load',()=>{
 const f=fixture();try{
  const{cell,charge,step,measure,cargo}=f;step(.8);assert.equal(cell.loadContact,true);assert.ok(cell.loadNormalForce>55&&cell.loadNormalForce<70);
  assert.ok(cell.rotors.every(b=>b.type===Body.DYNAMIC));assert.ok(cell.hinges.every(h=>h instanceof HingeConstraint&&!h.equations.includes(h.motorEquation)));
  charge();step(3);cell.toggleClutch();let continuous=0;for(let i=0;i<240;i++){step();continuous=cell.readyForProof?continuous+DT:0;}
  assert.ok(continuous>=2-1e-8,JSON.stringify(cell.diagnostics()));assert.equal(cell.originalCargoBody,cargo);
  assert.ok(measure.actualLoadTicks>400&&measure.normalImpulse>200,'The real original cargo supports the tray on positive contact impulses');
  assert.ok(measure.maxGearError<.002,JSON.stringify(measure));assert.ok(measure.maxHingeDrift<.001);assert.ok(measure.minimumRotorY>.08,'The complete rotating silhouette clears the uncut floor');assert.ok(measure.maxLoadPenetration<.022,'The real free-fall contact is bounded to 22mm at the initial 120Hz landing');
  assert.ok(cell.diagnostics().loadWork>0);assert.ok(cell.energy>1000);
  console.info('41 physical flywheel ordinary five-pulse fixture',JSON.stringify({cell:cell.diagnostics(),measure}));
 }finally{f.dispose();}
});

test('Tower41 empty tray, held cargo, foreign body and withdrawing the free load cannot enable proof',()=>{
 const empty=fixture({loaded:false}),loaded=fixture();try{
  empty.step(1);empty.charge();empty.cell.toggleClutch();empty.step(2);assert.equal(empty.cell.loadContact,false);assert.equal(empty.cell.readyForProof,false);assert.equal(empty.measure.actualLoadTicks,0);assert.equal(empty.cell.diagnostics().loadWork,0);
  loaded.step(.8);loaded.charge();loaded.cell.toggleClutch();loaded.step(.2);assert.equal(loaded.cell.readyForProof,true);
  // Removing collision response preserves apparent pad position, but removes
  // actual supporting load. Distance flags cannot qualify the shaft.
  loaded.cargo.collisionResponse=false;loaded.step(DT);assert.equal(loaded.cell.loadContact,false);assert.equal(loaded.cell.readyForProof,false);loaded.cargo.collisionResponse=true;
  loaded.game.physics.setCarryTarget([11,1.8,5]);loaded.game.heldCube=loaded.game.cargo;loaded.step(.5);assert.equal(loaded.cell.loadContact,false);assert.equal(loaded.cell.readyForProof,false);
  loaded.game.heldCube=null;loaded.game.physics.release();loaded.step(1);assert.equal(loaded.cell.loadContact,true);
  const foreign=new Body({mass:3.2,position:loaded.cargo.position.clone()});foreign.addShape(loaded.cargo.shapes[0]);loaded.world.addBody(foreign);loaded.game.physics.cargoBody=foreign;loaded.step();assert.equal(loaded.cell.loadContact,false);assert.equal(loaded.cell.readyForProof,false);loaded.world.removeBody(foreign);loaded.game.physics.cargoBody=loaded.cargo;
  loaded.game.physics.setCarryTarget([16,1.8,5]);loaded.step(2);assert.equal(loaded.cell.loadContact,false);assert.equal(loaded.cell.readyForProof,false);
 }finally{empty.dispose();loaded.dispose();}
});

test('Tower41 passive ratio selection preserves or dissipates energy and the real brake drains stored momentum',()=>{
 const f=fixture({loaded:false});try{
  f.charge();const charged=f.cell.energy;f.step(2);assert.ok(f.cell.energy<charged&&f.cell.energy>charged*.94);
  const beforeGear=f.cell.energy;f.cell.cycleRatio();f.step(.5);assert.ok(f.cell.energy<=beforeGear+1e-6,'Changing a passive gear cannot manufacture energy');assert.ok(Math.abs(f.cell.output-f.cell.omega*1.5)<.002);
  const beforeBrake=f.cell.energy;f.cell.toggleBrake();let maximum=beforeBrake;for(let i=0;i<720;i++){f.step();assert.ok(f.cell.energy<maximum+1e-7,JSON.stringify(f.cell.diagnostics()));maximum=f.cell.energy;}
  assert.ok(f.cell.energy<beforeBrake*.001);assert.ok(Math.abs(f.cell.omega)<.01);assert.ok(f.cell.diagnostics().brakeWork>beforeBrake*.90);assert.equal(f.cell.readyForProof,false);
  f.cell.toggleBrake();f.step(3);assert.ok(f.cell.energy<1e-7,'Stopped shaft has no spring or automatic drive');
 }finally{f.dispose();}
});

test('Tower41 a genuinely loaded speed-band shaft still rejects wrong gears, disengaged clutch and a live brake',()=>{
 const low=fixture(),high=fixture();try{
  low.step(.8);for(let i=0;i<6;i++){low.cell.crank();low.step(.28);}low.cell.toggleClutch();low.step(.2);
  assert.ok(low.cell.loadContact&&low.cell.output>4.9&&low.cell.output<6.1,JSON.stringify(low.cell.diagnostics()));assert.equal(low.cell.ratio,0);assert.equal(low.cell.readyForProof,false,'Six low-gear turns reach the speed band but do not solve the actual 2:3 coupling');
  high.step(.8);high.cell.cycleRatio();high.cell.cycleRatio();for(let i=0;i<3;i++){high.cell.crank();high.step(.28);}high.cell.toggleClutch();high.step(.2);
  assert.ok(high.cell.loadContact&&high.cell.output>4.9&&high.cell.output<6.1,JSON.stringify(high.cell.diagnostics()));assert.equal(high.cell.ratio,2);assert.equal(high.cell.readyForProof,false,'Three high-gear turns cannot substitute for the correct coupling');
  high.cell.reset();high.step(.3);high.charge();assert.equal(high.cell.loadContact,true);assert.equal(high.cell.readyForProof,false,'The actual loaded shaft still needs its clutch');high.cell.toggleClutch();assert.equal(high.cell.readyForProof,true);high.cell.toggleBrake();assert.equal(high.cell.readyForProof,false,'The service brake invalidates the proof immediately, before the next slow-down tick');
  high.cell.toggleBrake();assert.equal(high.cell.readyForProof,true);high.cell.dispose();assert.equal(high.cell.loadContact,false);assert.equal(high.cell.readyForProof,false,'Disposed modules cannot expose the final tick as a live load witness');
 }finally{low.dispose();high.dispose();}
});

test('Tower41 repeated passive selector cycles cannot increase stored kinetic energy or drive an initially empty shaft',()=>{
 const f=fixture({loaded:false});try{
  for(let i=0;i<30;i++){f.cell.cycleRatio();f.step(.04);}assert.ok(f.cell.energy<1e-12,'Unpowered gear changes do no work');
  f.charge();let prior=f.cell.energy;for(let i=0;i<45;i++){f.cell.cycleRatio();f.step(.05);const next=f.cell.energy;assert.ok(next<=prior+1e-8,JSON.stringify({cycle:i,prior,next,cell:f.cell.diagnostics()}));prior=next;}
  assert.equal(f.cell.diagnostics().crankCount,5);assert.equal(f.cell.loadContact,false);assert.equal(f.cell.readyForProof,false);
 }finally{f.dispose();}
});

test('Tower41 lazy ownership, real shape descriptors, idempotent force updates and reset/disposal preserve cargo identity',()=>{
 const f=fixture({centre:[-48,18,-37]});try{
  const{cell,world,cargo,game,step}=f,owned=[...cell.bodies],joints=[...cell.constraints];
  const counts=[world.bodies.length,world.constraints.length,world._listeners.postStep.length,game.physics.cargoSweepBoxes.size,game.physics.bodyBoxes.size];
  cell.ensure();cell.ensure();assert.deepEqual([world.bodies.length,world.constraints.length,world._listeners.postStep.length,game.physics.cargoSweepBoxes.size,game.physics.bodyBoxes.size],counts);
  assert.equal(owned.length,5);assert.deepEqual(joints.map(c=>c.equations.length),[5,5,5,1,1]);
  const parts=[...cell.rotorParts.flat(),...cell.fixedParts];assert.equal(game.physics.bodyBoxes.size,parts.length);
  for(const p of parts){
   assert.equal(game.physics.solids.has(p.mesh.uuid),false);assert.ok(p.collider.orientedBox);assert.equal(p.collider.orientedBox.body===cell.fixedBody||cell.rotors.includes(p.collider.orientedBox.body),true);
   const entry=game.physics.bodyBoxes.get(p.mesh.uuid);assert.ok(entry,'Every visible physical Box owns an explicit registry entry');assert.equal(entry.orientedBox,p.collider.orientedBox);assert.equal(entry.body,p.collider.orientedBox.body);assert.equal(entry.shape,entry.body.shapes[entry.shapeIndex]);assert.ok(game.cameraBlockers.includes(p.mesh)&&game.aimBlockers.includes(p.mesh)&&game.colliders.includes(p.collider));
  }
  assert.equal(game.physics.cargoSweepBoxes.size,cell.fixedParts.length-1,'Real guards are swept; the load face keeps its ordinary positive contact equation');
  cell.crank();cell.updateForces(DT);const torque=cell.rotor.torque.clone();cell.updateForces(DT);assert.equal(cell.rotor.torque.distanceTo(torque),0);game.physics.step(DT);step(1);
  for(const p of parts){const entry=game.physics.bodyBoxes.get(p.mesh.uuid),offset=entry.body.quaternion.vmult(entry.body.shapeOffsets[entry.shapeIndex]),center=entry.body.position.vadd(offset);assert.ok(p.mesh.position.distanceTo(new THREE.Vector3(center.x,center.y,center.z))<1e-10);assert.ok(entry.orientedBox.current.center.distanceTo(p.mesh.position)<1e-10);assert.equal(entry.orientedBox.step,world.stepnumber);}
  const cargoPose=cargo.position.clone();cell.reset();cell.reset();assert.equal(cargo.position.distanceTo(cargoPose),0);assert.equal(game.physics.cargoBody,cargo);assert.equal(cell.originalCargo,game.cargo);assert.equal(cell.omega,0);assert.equal(cell.output,0);assert.equal(cell.clutch,false);assert.equal(cell.brake,false);assert.equal(cell.ratio,0);assert.equal(cell.loadContact,false);
  const p=cell.rotorParts[0][0],previous=p.collider.orientedBox.previous.center.clone();cell.syncPose();cell.syncPose();assert.equal(p.collider.orientedBox.previous.center.distanceTo(previous),0);
  const removeBody=world.removeBody.bind(world);world.removeBody=body=>{if(owned.includes(body))assert.ok([...game.physics.bodyBoxes.values()].every(entry=>entry.body!==body),'Registry ownership is removed before its actual Cannon body');return removeBody(body);};
  cell.dispose();cell.dispose();assert.equal(cell.ensure(),false);for(const b of owned)assert.equal(world.bodies.includes(b),false);for(const c of joints)assert.equal(world.constraints.includes(c),false);assert.equal(game.physics.cargoSweepBoxes.size,0);assert.equal(game.physics.bodyBoxes.size,0);assert.equal(game.physics.cargoBody,cargo);assert.ok(world.bodies.includes(cargo));cell.updateForces(DT);
  assert.deepEqual([world.bodies.length,world.constraints.length,world._listeners.postStep.length],[counts[0]-5,counts[1]-5,counts[2]-1]);
 }finally{f.dispose();}
});
