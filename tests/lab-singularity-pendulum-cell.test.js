import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Body,Box,HingeConstraint,Vec3} from 'cannon-es';
import {LabPhysics} from '../src/game/LabPhysics.js';
import {SingularityKit} from '../src/game/LabSingularityKit.js';
import {orientedBoxSupport} from '../src/game/LabOrientedBoxContact.js';
import {buildTower41PendulumCell} from '../src/game/LabTower41PendulumCell.js';

const DT=1/120;
const THREE_VECTOR=v=>new THREE.Vector3(v.x,v.y,v.z);
const quaternionDot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z+a.w*b.w;

// This fixture uses the same real 120 Hz world, original cargo body, visible
// Kit geometry and shape registry as the game. Its remote floor never props
// up the bridge: only the module's actual stop and pawl can support it.
function fixture({loaded=true,centre=[0,0,0]}={}){
 const game={scene:new THREE.Scene(),colliders:[],floors:[],cameraBlockers:[],aimBlockers:[],portalPanels:[],cargo:new THREE.Object3D(),heldCube:null};
 const kit=new SingularityKit(game);kit.floor(centre[0]-32,centre[0]+32,centre[2]-32,centre[2]+32,centre[1]-25);
 const cell=buildTower41PendulumCell(game,kit,{centre});assert.equal(cell.ensure(),false);
 game.physics=new LabPhysics();for(const c of game.colliders)game.physics.addStaticBox(c.mesh.uuid,c.box,{kinematic:c.kinematic});
 game.physics.createCargo({position:[centre[0]+24,centre[1]+2,centre[2]+14]});const originalSubsystems=[...game.physics.world.subsystems];assert.equal(cell.ensure(),true);
 const cargo=game.physics.cargoBody,world=game.physics.world;
 function placeCargo(position){
  game.heldCube=null;game.physics.release();cargo.position.set(position.x,position.y,position.z);cargo.previousPosition.copy(cargo.position);cargo.interpolatedPosition.copy(cargo.position);
  cargo.quaternion.set(0,0,0,1);cargo.previousQuaternion.copy(cargo.quaternion);cargo.interpolatedQuaternion.copy(cargo.quaternion);cargo.velocity.setZero();cargo.angularVelocity.setZero();cargo.force.setZero();cargo.torque.setZero();cargo.aabbNeedsUpdate=true;cargo.wakeUp();world.broadphase.dirty=true;
 }
 if(loaded)placeCargo(cell.loadCargoPosition.clone().add(new THREE.Vector3(0,.16,0)));
 const measure={loadSteps:0,loadImpulse:0,pawlSteps:0,pawlImpulse:0,maxLoadPenetration:0,maxHingeDrift:0,distinctLoadSteps:new Set(),distinctPawlSteps:new Set()};
 const positiveContacts=(a,b,shape)=>world.contacts.filter(c=>c.enabled!==false&&[c.bi,c.bj].includes(a)&&[c.bi,c.bj].includes(b)&&(!shape||[c.si,c.sj].includes(shape))&&c.multiplier>1e-6);
 function step(seconds=DT){for(let i=0;i<Math.round(seconds/DT);i++){
  cell.updateForces(DT);game.physics.step(DT);
  for(const h of cell.hinges){const a=h.bodyA.position.vadd(h.bodyA.quaternion.vmult(h.pivotA)),b=h.bodyB.position.vadd(h.bodyB.quaternion.vmult(h.pivotB));measure.maxHingeDrift=Math.max(measure.maxHingeDrift,a.distanceTo(b));}
  const cup=cell.bridgeBody?.shapes[cell.cupShapeIndex];
  const loads=positiveContacts(cargo,cell.bridgeBody,cup);
  if(loads.length){measure.loadSteps++;measure.distinctLoadSteps.add(world.stepnumber);for(const c of loads){measure.loadImpulse+=c.multiplier*DT;const a=c.bi.position.vadd(c.ri),b=c.bj.position.vadd(c.rj);measure.maxLoadPenetration=Math.max(measure.maxLoadPenetration,Math.max(0,-c.ni.dot(b.vsub(a))));}}
  const catches=positiveContacts(cell.bridgeBody,cell.pawlBody);
  if(catches.length){measure.pawlSteps++;measure.distinctPawlSteps.add(world.stepnumber);for(const c of catches)measure.pawlImpulse+=c.multiplier*DT;}
 }}
 function until(predicate,seconds,message){for(let i=0;i<Math.ceil(seconds/DT);i++){if(predicate())return;step();}assert.ok(predicate(),message+' '+JSON.stringify(cell.diagnostics()));}
 function withdrawCargo(){placeCargo(new THREE.Vector3(centre[0]+24,centre[1]+2,centre[2]+14));}
 return{game,kit,cell,cargo,world,originalSubsystems,measure,step,until,placeCargo,withdrawCargo,positiveContacts,dispose(){cell.dispose();kit.dispose();game.physics.dispose();}};
}

function allParts(cell){return [...cell.bridgeParts,...cell.pawlParts,...cell.fixedParts];}
function settleLoad(f){f.until(()=>f.cell.loadContact&&f.cell.angle<-.10,12,'Original free load did not lower the actual bridge onto its lower stop');}
function armAndUnload(f){settleLoad(f);assert.equal(f.cell.armCatch(),true,'The accessible loaded catch accepts one hand impulse');f.step(1.4);f.withdrawCargo();f.until(()=>f.cell.unloadedRetained,8,'The physical pawl did not retain the unloaded bridge');}

test('Tower41 pendulum gravity load moves the actual hinged bridge and the original free cargo supplies positive cup contact',()=>{
 const f=fixture();try{
  const initial=f.cell.angle,initialPosition=f.cell.bridgeBody.position.clone();settleLoad(f);
  assert.equal(f.cell.originalCargoBody,f.cargo);assert.equal(f.cell.originalCargo,f.game.cargo);assert.ok(initial-f.cell.angle>.4);assert.ok(f.cell.bridgeBody.position.distanceTo(initialPosition)>.25,'The eccentric centre of mass translates around its actual hinge, not only its rendered model');assert.ok(f.measure.maxHingeDrift<.003,'Actual pivot constraints retain their founded position while the bridge turns');
  const contacts=f.positiveContacts(f.cargo,f.cell.bridgeBody,f.cell.bridgeBody.shapes[f.cell.cupShapeIndex]);assert.ok(contacts.length>0);assert.ok(f.cell.loadNormalForce>1);assert.ok(f.measure.loadSteps>8&&f.measure.loadImpulse>1);assert.equal(f.measure.distinctLoadSteps.size,f.measure.loadSteps);
  assert.ok(f.measure.maxLoadPenetration<.035,'The initial normal 120 Hz landing cannot embed the original cargo by more than 35 mm');assert.equal(f.cell.readyForCrossing,false,'The current load by itself cannot substitute for the unloaded catch');assertGeometry(f);
  console.info('41 physical pendulum load',JSON.stringify({cell:f.cell.diagnostics(),measure:{...f.measure,distinctLoadSteps:f.measure.distinctLoadSteps.size,distinctPawlSteps:f.measure.distinctPawlSteps.size}}));
 }finally{f.dispose();}
});

test('Tower41 pendulum is retained by actual positive pawl contact after the original load is recovered',()=>{
 const f=fixture();try{
  armAndUnload(f);const retainedAngle=f.cell.angle,unloadStep=f.world.stepnumber;f.step(2);
  assert.equal(f.cell.loadContact,false);assert.equal(f.cell.latched,true);assert.equal(f.cell.unloadedRetained,true);assert.equal(f.cell.readyForCrossing,true);assert.ok(Math.abs(retainedAngle)<.08&&Math.abs(f.cell.angle)<.08,JSON.stringify(f.cell.diagnostics()));assert.ok(Math.abs(f.cell.angle-retainedAngle)<.03);
  assert.ok(f.positiveContacts(f.cell.bridgeBody,f.cell.pawlBody).length>0);assert.ok(f.measure.pawlSteps>120&&f.measure.pawlImpulse>1);assert.ok([...f.measure.distinctPawlSteps].some(n=>n>unloadStep+120),'Support remains after distinct completed unloaded world steps');assert.equal(f.cell.originalCargoBody,f.cargo);assert.equal(f.game.physics.cargoBody,f.cargo);assertGeometry(f);
  const box=f.cell.deckPart.collider.orientedBox,normal=new THREE.Vector3(0,1,0).applyQuaternion(box.current.quaternion),face=box.current.center.clone().addScaledVector(normal,box.half.y);
  const support=orientedBoxSupport(box,face.x,face.z,face.y+.01);assert.ok(support&&support.normal.y>.99);assert.ok(Math.abs(support.height-face.y)<1e-9,'Crossing support follows the same caught physical deck face');
  console.info('41 physical pendulum unloaded retention',JSON.stringify({cell:f.cell.diagnostics(),loadSteps:f.measure.loadSteps,pawlSteps:f.measure.pawlSteps,loadImpulse:f.measure.loadImpulse,pawlImpulse:f.measure.pawlImpulse}));
 }finally{f.dispose();}
});

test('Tower41 pendulum empty waiting and repeated catch input cannot create a load history or qualify the lower crossing',()=>{
 const f=fixture({loaded:false});try{
  for(let i=0;i<720;i++){f.cell.armCatch();f.step();assert.equal(f.cell.loadContact,false);assert.equal(f.cell.unloadedRetained,false);assert.equal(f.cell.readyForCrossing,false);}
  assert.equal(f.measure.loadSteps,0);assert.equal(f.measure.loadImpulse,0);assert.ok(f.cell.angle>.15,'No free cargo gravity load lowers the physical span');assert.ok(f.cell.constraints.every(c=>c instanceof HingeConstraint&&!c.equations.includes(c.motorEquation)));
 }finally{f.dispose();}
});

test('Tower41 pendulum rejects a held original cargo even while its preceding actual cup contact remains positive',()=>{
 const f=fixture();try{
  settleLoad(f);assert.ok(f.positiveContacts(f.cargo,f.cell.bridgeBody,f.cell.bridgeBody.shapes[f.cell.cupShapeIndex]).length>0);f.game.heldCube=f.game.cargo;
  assert.equal(f.cell.loadContact,false,'Held render identity invalidates the current otherwise genuine original contact');assert.equal(f.cell.readyForCrossing,false);
  f.game.heldCube=null;f.step();assert.equal(f.cell.loadContact,true);f.game.physics.setCarryTarget(f.cell.loadCargoPosition.toArray());assert.equal(f.cell.loadContact,false,'An actual carry servo is independently disqualifying even before the render held flag changes');f.step(.4);assert.equal(f.cell.readyForCrossing,false);
 }finally{f.dispose();}
});

test('Tower41 pendulum rejects a foreign cargo identity while the original physical cup support stays intact',()=>{
 const f=fixture();try{
  settleLoad(f);const foreign=new Body({mass:f.cargo.mass,position:f.cargo.position.clone(),shape:new Box(f.cargo.shapes[0].halfExtents.clone())});f.world.addBody(foreign);
  assert.ok(f.positiveContacts(f.cargo,f.cell.bridgeBody,f.cell.bridgeBody.shapes[f.cell.cupShapeIndex]).length>0);f.game.physics.cargoBody=foreign;
  assert.equal(f.cell.loadContact,false);assert.equal(f.cell.readyForCrossing,false);f.game.physics.cargoBody=f.cargo;f.world.removeBody(foreign);f.step();assert.equal(f.cell.loadContact,true);
  const original=f.game.cargo;f.game.cargo=new THREE.Object3D();assert.equal(f.cell.loadContact,false);assert.equal(f.cell.readyForCrossing,false);f.game.cargo=original;f.step();assert.equal(f.cell.loadContact,true);
 }finally{f.dispose();}
});

test('Tower41 pendulum current physical collision and world ownership must remain live for original load proof',()=>{
 const f=fixture();try{
  settleLoad(f);const shape=f.cargo.shapes[0],cup=f.cell.bridgeBody.shapes[f.cell.cupShapeIndex];
  for(const object of [f.cargo,shape,cup,f.cell.bridgeBody]){
   assert.equal(f.cell.loadContact,true);object.collisionResponse=false;assert.equal(f.cell.loadContact,false);assert.equal(f.cell.readyForCrossing,false);object.collisionResponse=true;f.step();assert.equal(f.cell.loadContact,true,'Restore the one tested contact property before the next cause');
  }
  const mask=f.cargo.collisionFilterMask;f.cargo.collisionFilterMask=0;assert.equal(f.cell.loadContact,false);assert.equal(f.cell.readyForCrossing,false);f.cargo.collisionFilterMask=mask;f.step();assert.equal(f.cell.loadContact,true);
  f.world.removeBody(f.cargo);assert.equal(f.cell.loadContact,false);assert.equal(f.cell.readyForCrossing,false);f.world.addBody(f.cargo);f.step();assert.equal(f.cell.originalCargoBody,f.cargo);assert.equal(f.cell.loadContact,true);
 }finally{f.dispose();}
});

test('Tower41 pendulum same-step cargo and face reposes cannot reuse an old positive contact as current load proof',()=>{
 const cases=[
  {name:'original cargo far outside the cup',cleared:true,change(f){f.cargo.position.set(24,2,14);}},
  {name:'original cargo raised 25 cm inside the cup wall volume',cleared:false,change(f){f.cargo.position.y+=.25;}},
  {name:'current cup support face inverted with a matching finite original Box pose',cleared:false,change(f){f.cell.bridgeBody.quaternion.setFromAxisAngle(new Vec3(0,0,1),Math.PI);f.cell.syncPose();const p=f.cell.loadCargoPosition;f.cargo.position.set(p.x,p.y,p.z);f.cargo.quaternion.copy(f.cell.bridgeBody.quaternion);}},
 ];
 for(const scenario of cases){const f=fixture();try{
  settleLoad(f);f.step(2);assert.equal(f.cell.loadContact,true);assert.ok(f.cell.loadNormalForce>50);const step=f.world.stepnumber,originalPosition=f.cargo.position.clone(),originalQuaternion=f.cargo.quaternion.clone(),bridgeQuaternion=f.cell.bridgeBody.quaternion.clone(),history=f.cell.diagnostics();
  const positive=f.positiveContacts(f.cargo,f.cell.bridgeBody,f.cell.bridgeBody.shapes[f.cell.cupShapeIndex]);assert.ok(positive.length>0);scenario.change(f);
  assert.equal(f.world.stepnumber,step);assert.equal(f.game.physics.cargoBody,f.cargo);assert.equal(f.cell.originalCargoBody,f.cargo);assert.equal(f.game.heldCube,null);assert.equal(f.game.physics.carryTarget,null);assert.equal(f.cell.originalCargoRawContact,true,'This fixture retains the preceding real contact equations');assert.ok(positive.every(c=>c.multiplier>1e-6&&f.world.contacts.includes(c)),'No contact impulse was cleared to make the negative case pass');assert.equal(f.cell.originalCargoClearedCup,scenario.cleared,scenario.name);
  const p=f.cell.cupPart,inspection=f.game.physics.inspectBodyBox(p.mesh.uuid,{bounds:p.collider.box});assert.equal(inspection.valid,true,'The current cup descriptor is still an actual live shape: '+JSON.stringify(inspection));
  assert.equal(f.cell.loadContact,false,scenario.name+' cannot be certified by the earlier supporting multiplier');assert.equal(f.cell.loadNormalForce,0);assert.equal(f.cell.readyForCrossing,false);assert.equal(f.cell.diagnostics().loadedStep,history.loadedStep);assert.equal(f.cell.diagnostics().loadedTicks,history.loadedTicks);assert.equal(f.cell.diagnostics().loadedNormalImpulse,history.loadedNormalImpulse);
  assert.equal(f.cell.armCatch(),true,'The bounded physical hand action remains distinct from a qualified load witness');assert.equal(f.cell.diagnostics().catchWitness.qualifiedLoad,false);assert.equal(f.cell.diagnostics().catchWitness.loadContact,false);assert.equal(f.cell.diagnostics().catchWitness.loadedAtStep,-1);assert.equal(f.cell.diagnostics().catchWitness.loadNormalForce,0);
  f.cell.bridgeBody.quaternion.copy(bridgeQuaternion);f.cargo.position.copy(originalPosition);f.cargo.quaternion.copy(originalQuaternion);f.cargo.aabbNeedsUpdate=true;f.cell.bridgeBody.aabbNeedsUpdate=true;f.world.broadphase.dirty=true;f.cell.syncPose();assert.equal(f.world.stepnumber,step);assert.equal(f.cell.loadContact,true,'Restoring the one changed live pose restores the otherwise genuine same-step tuple');f.step();assert.equal(f.world.stepnumber,step+1);assert.equal(f.cell.loadContact,true);assert.equal(f.cell.loadedStep,step+1);assert.equal(f.cell.diagnostics().loadedTicks,history.loadedTicks+1);
 }finally{f.dispose();}}
});

test('Tower41 pendulum positive contact on the bridge deck cannot impersonate the authored original load cup',()=>{
 const f=fixture({loaded:false});try{
  const box=f.cell.deckPart.collider.orientedBox,normal=new THREE.Vector3(0,1,0).applyQuaternion(box.current.quaternion);f.placeCargo(box.current.center.clone().addScaledVector(normal,box.half.y+.56));
  let nonCupSteps=0;for(let i=0;i<240;i++){f.step();const contacts=f.positiveContacts(f.cargo,f.cell.bridgeBody);if(contacts.some(c=>![c.si,c.sj].includes(f.cell.bridgeBody.shapes[f.cell.cupShapeIndex])))nonCupSteps++;assert.equal(f.cell.loadContact,false);assert.equal(f.cell.readyForCrossing,false);}
  assert.ok(nonCupSteps>5,'This negative fixture actually makes positive original-body contact with the different deck shape');assert.equal(f.measure.loadSteps,0,'The correct shape has never received a qualified support impulse');
 }finally{f.dispose();}
});

test('Tower41 pendulum a secondary Box on the same original cargo body cannot impersonate its original support shape',()=>{
 const f=fixture({loaded:false});try{
  const originalShape=f.cargo.shapes[0],secondary=new Box(originalShape.halfExtents.clone());f.cargo.addShape(secondary,new Vec3(0,-3,0));f.placeCargo(f.cell.loadCargoPosition.clone().add(new THREE.Vector3(0,3.16,0)));
  let secondaryContactSteps=0,primaryContactSteps=0;for(let i=0;i<360;i++){
   f.step();const contacts=f.positiveContacts(f.cargo,f.cell.bridgeBody,f.cell.bridgeBody.shapes[f.cell.cupShapeIndex]);if(contacts.some(c=>[c.si,c.sj].includes(secondary)))secondaryContactSteps++;
   if(contacts.some(c=>[c.si,c.sj].includes(originalShape)))primaryContactSteps++;
   assert.equal(f.game.physics.cargoBody,f.cargo);assert.equal(f.cell.originalCargoBody,f.cargo);assert.equal(f.cargo.shapes[0],originalShape);assert.equal(f.game.heldCube,null);assert.equal(f.game.physics.carryTarget,null);assert.equal(f.cargo.collisionResponse,true);assert.equal(f.cell.loadContact,false,'A genuine cup impulse from another shape of the same original body is not the accepted original support tuple');assert.equal(f.cell.readyForCrossing,false);
  }
  assert.ok(secondaryContactSteps>10,'The negative fixture must produce actual positive secondary Box contact with the authored cup');assert.equal(primaryContactSteps,0,'The genuine original shape stays away from the cup, isolating only the secondary-shape substitution');assert.equal(f.cell.loadedStep,-1);assert.equal(f.cell.diagnostics().loadedTicks,0);assert.equal(f.cell.diagnostics().loadedNormalImpulse,0);
 }finally{f.dispose();}
});

test('Tower41 pendulum a genuinely qualified retained bridge immediately rejects lost free-cargo, shape, body, joint and seat ownership',()=>{
 const f=fixture();try{
  armAndUnload(f);f.step(.6);assert.equal(f.cell.readyForCrossing,true);assert.ok(f.positiveContacts(f.cell.bridgeBody,f.cell.pawlBody).length>0);
  function invalid(label,change,restore){assert.equal(f.cell.readyForCrossing,true,label+' baseline is genuinely qualified');change();try{assert.equal(f.cell.readyForCrossing,false,label+' must invalidate the current qualified bridge');}finally{restore();}assert.equal(f.cell.readyForCrossing,true,label+' must be the only changed cause');}
  invalid('held original',()=>{f.game.heldCube=f.game.cargo;},()=>{f.game.heldCube=null;});
  invalid('live carry servo',()=>{f.game.physics.setCarryTarget(f.cargo.position.toArray());},()=>{f.game.physics.release();});
  const original=f.game.cargo;invalid('render companion identity',()=>{f.game.cargo=new THREE.Object3D();},()=>{f.game.cargo=original;});
  const foreign=new Body({mass:f.cargo.mass,position:f.cargo.position.clone(),shape:new Box(f.cargo.shapes[0].halfExtents.clone()),collisionFilterGroup:f.cargo.collisionFilterGroup,collisionFilterMask:f.cargo.collisionFilterMask});f.world.addBody(foreign);invalid('foreign live cargo body',()=>{f.game.physics.cargoBody=foreign;},()=>{f.game.physics.cargoBody=f.cargo;});f.world.removeBody(foreign);
  for(const [label,object]of [['original body',f.cargo],['original shape',f.cargo.shapes[0]],['cup shape',f.cell.bridgeBody.shapes[f.cell.cupShapeIndex]],['retaining arm',f.cell.pawlBody.shapes[0]],['retaining heel',f.cell.pawlBody.shapes[1]],['founded heel seat',f.cell.fixedBody.shapes[2]]])invalid(label+' collision disabled',()=>{object.collisionResponse=false;},()=>{object.collisionResponse=true;});
  const mask=f.cargo.collisionFilterMask;invalid('original cargo mask',()=>{f.cargo.collisionFilterMask=0;},()=>{f.cargo.collisionFilterMask=mask;});
  invalid('original body detached',()=>{f.world.removeBody(f.cargo);},()=>{f.world.addBody(f.cargo);});
  invalid('bridge body detached',()=>{f.world.removeBody(f.cell.bridgeBody);},()=>{f.world.addBody(f.cell.bridgeBody);});
  const hinge=f.cell.hinges[0];invalid('actual hinge detached',()=>{f.world.removeConstraint(hinge);},()=>{f.world.addConstraint(hinge);});
  const part=f.cell.deckPart,entry=f.game.physics.bodyBoxes.get(part.mesh.uuid);invalid('actual deck registry removed',()=>{f.game.physics.removeBodyBox(part.mesh.uuid);},()=>{f.game.physics.bodyBoxes.set(part.mesh.uuid,entry);});
  assert.equal(f.world.stepnumber,f.cell.diagnostics().contactStep);assert.ok(f.positiveContacts(f.cell.bridgeBody,f.cell.pawlBody).length>0,'The independent mutations never remove the baseline current physical contact equation');
 }finally{f.dispose();}
});

test('Tower41 pendulum disabling the actual pawl releases the unloaded bridge to its counterweight',()=>{
 const f=fixture();try{
  armAndUnload(f);assert.equal(f.cell.readyForCrossing,true);assert.ok(f.positiveContacts(f.cell.bridgeBody,f.cell.pawlBody).length>0);
  f.cell.pawlBody.collisionResponse=false;assert.equal(f.cell.latched,false);assert.equal(f.cell.unloadedRetained,false);assert.equal(f.cell.readyForCrossing,false,'A retained Boolean cannot substitute for the removed real support');
  f.until(()=>f.cell.angle>.25,6,'Counterweight did not lift the unloaded span after pawl support was removed');assert.equal(f.cell.loadContact,false);assert.equal(f.cell.readyForCrossing,false);assertGeometryAfterDisabledPawl(f);
 }finally{f.dispose();}
});

function assertGeometryAfterDisabledPawl(f){
 for(const p of f.cell.bridgeParts){const inspection=f.game.physics.inspectBodyBox(p.mesh.uuid,{bounds:p.collider.box});assert.equal(inspection.valid,true,JSON.stringify(inspection));}
 // Restore collision before disposal so this test does not leave a stale
 // disabled body property as an unrelated cause in lifecycle verification.
 f.cell.pawlBody.collisionResponse=true;
}

test('Tower41 pendulum force and pose updates cannot duplicate physics work or advance load and retention witnesses',()=>{
 const f=fixture();try{
  settleLoad(f);f.cell.updateForces(DT);
  const state=JSON.stringify(f.cell.diagnostics()),step=f.world.stepnumber,forces=f.cell.bodies.map(b=>({force:b.force.clone(),torque:b.torque.clone()})),history=allParts(f.cell).map(p=>({center:p.collider.orientedBox.previous.center.clone(),quaternion:p.collider.orientedBox.previous.quaternion.clone()}));
  for(let i=0;i<100;i++){f.cell.updateForces(DT);f.cell.syncPose();}
  assert.equal(f.world.stepnumber,step);assert.equal(JSON.stringify(f.cell.diagnostics()),state,'Only completed postStep sampling may advance load or retention evidence');
  for(const [i,b]of f.cell.bodies.entries()){assert.equal(b.force.distanceTo(forces[i].force),0);assert.equal(b.torque.distanceTo(forces[i].torque),0);}
  for(const [i,p]of allParts(f.cell).entries()){assert.equal(p.collider.orientedBox.previous.center.distanceTo(history[i].center),0);assert.deepEqual(p.collider.orientedBox.previous.quaternion.toArray(),history[i].quaternion.toArray());}
  f.step();assert.equal(f.world.stepnumber,step+1);assert.equal(f.cell.loadedStep,f.world.stepnumber,'The current genuine original cup witness belongs to this completed physics step');
 }finally{f.dispose();}
});

test('Tower41 pendulum passive gravity, bearing friction and catch spring cannot manufacture empty-machine energy',()=>{
 const f=fixture({loaded:false});try{
  const initial=f.cell.diagnostics(),initialEnergy=initial.kinetic+initial.potential;let maximum=initialEnergy;
  for(let i=0;i<960;i++){f.step();const d=f.cell.diagnostics(),energy=d.kinetic+d.potential;assert.ok(Number.isFinite(energy));maximum=Math.max(maximum,energy);assert.ok(energy<=initialEnergy+.05,'The real gravity-plus-spring energy exceeds its initial budget: '+JSON.stringify({initialEnergy,energy,step:f.world.stepnumber}));assert.equal(d.handCount,0);assert.equal(f.cell.readyForCrossing,false);}
  const end=f.cell.diagnostics();assert.ok(end.kinetic<.01,'The empty machine settles on its real travel stops');assert.ok(end.kinetic+end.potential<=initialEnergy);assert.equal(f.measure.loadSteps,0);
  console.info('41 physical pendulum passive energy',JSON.stringify({initialEnergy,maximum,finalEnergy:end.kinetic+end.potential,gravityPotential:end.gravityPotential,springPotential:end.springPotential}));
 }finally{f.dispose();}
});

test('Tower41 pendulum catch input is a bounded physical angular impulse with zero net linear impulse and a same-step cooldown',()=>{
 const f=fixture({loaded:false});try{
  f.step(1);const b=f.cell.pawlBody,beforeVelocity=b.velocity.clone(),beforeMomentum=b.inertia.z*b.angularVelocity.z,beforeAngular=b.angularVelocity.z,beforeKinetic=f.cell.diagnostics().kinetic;
  assert.equal(f.cell.armCatch(),true);assert.ok(Math.abs(b.inertia.z*b.angularVelocity.z-beforeMomentum+f.cell.handAngularImpulse)<1e-9);assert.ok(b.velocity.distanceTo(beforeVelocity)<1e-12,'The hand couple cannot launch the catch off its hinge');
  const impulseWork=-f.cell.handAngularImpulse*beforeAngular+f.cell.handAngularImpulse**2/(2*b.inertia.z);assert.ok(Math.abs(f.cell.diagnostics().kinetic-beforeKinetic-impulseWork)<1e-9);
  const velocity=b.angularVelocity.clone(),count=f.cell.diagnostics().handCount;for(let i=0;i<100;i++)assert.equal(f.cell.armCatch(),false);assert.equal(b.angularVelocity.distanceTo(velocity),0);assert.equal(f.cell.diagnostics().handCount,count);assert.equal(count,1);assert.equal(f.cell.readyForCrossing,false);assert.ok(f.cell.handAngularImpulse>0&&f.cell.handAngularImpulse<=1.2);
  assert.throws(()=>buildTower41PendulumCell(f.game,f.kit,{centre:[60,0,0],handAngularImpulse:1.21}),RangeError);assert.throws(()=>buildTower41PendulumCell(f.game,f.kit,{centre:[60,0,0],handAngularImpulse:Infinity}),RangeError);
 }finally{f.dispose();}
});

test('Tower41 pendulum 120, 60, 30 and 15 Hz frames apply passive forces once per actual 120 Hz interval and produce the same loaded and retained mechanism',()=>{
 let reference=null;
 for(const frameSteps of [1,2,4,8]){
  const f=fixture();try{
   const calls=new Map(),apply=f.cell.pawlSpring.applyForce.bind(f.cell.pawlSpring);f.cell.pawlSpring.applyForce=()=>{calls.set(f.world.stepnumber,(calls.get(f.world.stepnumber)??0)+1);return apply();};
   function toStep(target){while(f.world.stepnumber<target){const before=f.world.stepnumber;f.cell.updateForces(frameSteps*DT);f.cell.updateForces(frameSteps*DT);f.game.physics.step(frameSteps*DT);assert.equal(f.world.stepnumber,before+frameSteps);}assert.equal(f.world.stepnumber,target);}
   function snapshot(){const d=f.cell.diagnostics();return{worldStep:d.worldStep,angle:d.angle,pawlAngle:d.pawlAngle,loadedStep:d.loadedStep,loadedTicks:d.loadedTicks,loadedNormalImpulse:d.loadedNormalImpulse,loadNormalForce:d.loadNormalForce,loadContactCount:d.loadContactCount,pawlNormalForce:d.pawlNormalForce,pawlContactCount:d.pawlContactCount,seatNormalForce:d.seatNormalForce,seatContactCount:d.seatContactCount,retainedTicks:d.retainedTicks,retainedStartStep:d.retainedStartStep,readyStep:d.readyStep,handCount:d.handCount,kinetic:d.kinetic,potential:d.potential,readyForCrossing:d.readyForCrossing,bodies:[f.cell.bridgeBody,f.cell.pawlBody,f.cargo].map(b=>({position:b.position.toArray(),quaternion:b.quaternion.toArray(),velocity:b.velocity.toArray(),angularVelocity:b.angularVelocity.toArray()}))};}
   const observed=[];toStep(320);assert.equal(f.cell.loadContact,true);assert.ok(f.cell.angle<-.10);observed.push(snapshot());assert.equal(f.cell.armCatch(),true);toStep(488);observed.push(snapshot());f.withdrawCargo();toStep(800);observed.push(snapshot());toStep(1600);observed.push(snapshot());assert.equal(f.cell.readyForCrossing,true);assert.ok(f.cell.diagnostics().retainedTicks>900);assert.ok(f.positiveContacts(f.cell.bridgeBody,f.cell.pawlBody).length>0);assertGeometry(f);
   assert.equal(calls.size,1600,'Every completed 120 Hz interval receives its own force application');for(let step=0;step<1600;step++)assert.equal(calls.get(step),1,'Repeated frame hooks and the world subsystem must not double the interval force');
   if(reference)assert.deepEqual(observed,reference,'Batched rendered frames cannot alter the underlying fixed-step contact, work, poses or proof history');else reference=observed;
   console.info('41 physical pendulum batched frames',JSON.stringify({renderHz:120/frameSteps,actualPhysicsSteps:f.world.stepnumber,forceApplications:calls.size,loadedTicks:f.cell.diagnostics().loadedTicks,retainedTicks:f.cell.diagnostics().retainedTicks,angle:f.cell.angle,pawlAngle:f.cell.pawlAngle}));
  }finally{f.dispose();}
 }
});


function assertGeometry(f){
 const {game,cell,world}=f,parts=allParts(cell);
 assert.equal(new Set(parts.map(p=>p.mesh.uuid)).size,parts.length);
 assert.equal(game.physics.bodyBoxes.size,parts.length,'Each physical visible Box owns one existing compound shape');
 for(const p of parts){
  const descriptor=p.collider.orientedBox,entry=game.physics.bodyBoxes.get(p.mesh.uuid);
  assert.ok(entry&&descriptor,'Physical visible members must have live shape ownership');assert.equal(entry.orientedBox,descriptor);assert.equal(entry.body,descriptor.body);assert.equal(entry.shape,entry.body.shapes[entry.shapeIndex]);
  assert.ok(cell.bodies.includes(entry.body)&&world.bodies.includes(entry.body));assert.ok(entry.shape instanceof Box);assert.equal(game.physics.solids.has(p.mesh.uuid),false,'An owned compound must not be duplicated by an AABB body');
  assert.ok(game.colliders.includes(p.collider)&&game.cameraBlockers.includes(p.mesh)&&game.aimBlockers.includes(p.mesh));assert.equal(p.collider.enabled,true);
  const inspected=game.physics.inspectBodyBox(p.mesh.uuid,{orientedBox:descriptor,bounds:p.collider.box,enabled:p.collider.enabled});assert.equal(inspected.valid,true,JSON.stringify({name:p.mesh.name,errors:inspected.errors}));
  const offset=entry.body.quaternion.vmult(entry.body.shapeOffsets[entry.shapeIndex]),center=entry.body.position.vadd(offset);
  assert.ok(p.mesh.position.distanceTo(THREE_VECTOR(center))<1e-9);assert.ok(p.mesh.quaternion.angleTo(new THREE.Quaternion(entry.body.quaternion.x,entry.body.quaternion.y,entry.body.quaternion.z,entry.body.quaternion.w))<1e-7);assert.equal(descriptor.step,world.stepnumber);
 }
}

test('Tower41 pendulum compounds keep visible, camera, aim and support geometry on the actual tilted Cannon shapes',()=>{
 const f=fixture({centre:[-48,36,33]});try{
  assert.ok(f.cell.angle>.3,'The lower bridge starts visibly raised');assertGeometry(f);
  const deck=f.cell.deckPart,box=deck.collider.orientedBox,normal=new THREE.Vector3(0,1,0).applyQuaternion(box.current.quaternion),center=box.current.center.clone().addScaledVector(normal,box.half.y);
  const sample=orientedBoxSupport(box,center.x,center.z,center.y+.01);assert.ok(sample);assert.ok(Math.abs(sample.height-center.y)<1e-9);assert.ok(sample.normal.distanceTo(normal)<1e-9);
  assert.equal(orientedBoxSupport(box,box.current.bounds.max.x+1,center.z,center.y+10),null,'The finite deck cannot support a player beyond its visible extent');
  f.step(.5);assertGeometry(f);
  const previous=box.previous.center.clone(),previousRotation=box.previous.quaternion.toArray();f.cell.syncPose();f.cell.syncPose();assert.equal(box.previous.center.distanceTo(previous),0);assert.deepEqual(box.previous.quaternion.toArray(),previousRotation,'Render synchronisation cannot create another physics history interval');
 }finally{f.dispose();}
});

test('Tower41 pendulum reset and idempotent disposal preserve the original cargo and remove every actual owned resource',()=>{
 const f=fixture();try{
  const {cell,game,world,cargo}=f,owned=[...cell.bodies],joints=[...cell.constraints],unowned=world.bodies.filter(b=>!owned.includes(b)),listenerCount=world._listeners.postStep.length,ownedSubsystems=world.subsystems.filter(s=>!f.originalSubsystems.includes(s));assert.equal(ownedSubsystems.length,1,'This cell owns one fixed-step passive-force subsystem');
  let foreignUpdates=0;const foreignSubsystem={update(){foreignUpdates++;}};world.subsystems.push(foreignSubsystem);const retainedSubsystems=[...world.subsystems];
  const poses=owned.map(b=>({body:b,position:b.position.clone(),quaternion:b.quaternion.clone()}));
  assert.ok(owned.includes(cell.bridgeBody)&&owned.includes(cell.pawlBody));assert.equal(cell.bridgeBody.type,Body.DYNAMIC);assert.equal(cell.pawlBody.type,Body.DYNAMIC);
  assert.ok(joints.length>0&&joints.every(c=>c instanceof HingeConstraint&&!c.equations.includes(c.motorEquation)),'Both pivoted bodies remain unpowered Cannon hinges');
  const resources=[world.bodies.length,world.constraints.length,listenerCount,game.physics.bodyBoxes.size,game.physics.cargoSweepBoxes.size];cell.ensure();cell.ensure();assert.deepEqual([world.bodies.length,world.constraints.length,world._listeners.postStep.length,game.physics.bodyBoxes.size,game.physics.cargoSweepBoxes.size],resources);assert.deepEqual(world.subsystems,retainedSubsystems,'Idempotent ownership must not duplicate or replace a world force subsystem');
  f.step(.5);const cargoPosition=cargo.position.clone(),cargoQuaternion=cargo.quaternion.clone();cell.reset();cell.reset();
  for(const p of poses){assert.ok(p.body.position.distanceTo(p.position)<1e-10);assert.ok(Math.abs(quaternionDot(p.body.quaternion,p.quaternion))>1-1e-10);assert.equal(p.body.velocity.length(),0);assert.equal(p.body.angularVelocity.length(),0);assert.equal(p.body.force.length(),0);assert.equal(p.body.torque.length(),0);}
  assert.equal(game.physics.cargoBody,cargo);assert.equal(cell.originalCargo,game.cargo);assert.equal(cell.originalCargoBody,cargo);assert.equal(cargo.position.distanceTo(cargoPosition),0);assert.ok(Math.abs(quaternionDot(cargo.quaternion,cargoQuaternion))>1-1e-10);assert.equal(cell.loadContact,false);assert.equal(cell.unloadedRetained,false);assert.equal(cell.readyForCrossing,false);assertGeometry(f);assert.deepEqual(world.subsystems,retainedSubsystems,'Whole-attempt reset retains the same live fixed-step hook');
  const removeBody=world.removeBody.bind(world);world.removeBody=body=>{if(owned.includes(body)){assert.ok([...game.physics.bodyBoxes.values()].every(e=>e.body!==body),'Remove live shape registry before its Cannon body');assert.ok([...game.physics.cargoSweepBoxes.values()].every(e=>e.body!==body),'Remove cargo sweep ownership before its Cannon body');assert.ok(world.constraints.every(c=>c.bodyA!==body&&c.bodyB!==body),'Remove constraints before the body they own');assert.ok(ownedSubsystems.every(s=>!world.subsystems.includes(s)),'Remove the actual cell force hook before its Cannon bodies');assert.ok(world.subsystems.includes(foreignSubsystem),'Other systems retain their own world hook');}return removeBody(body);};
  cell.dispose();cell.dispose();assert.equal(cell.ensure(),false);cell.updateForces(DT);cell.syncPose();cell.reset();assert.equal(cell.loadContact,false);assert.equal(cell.unloadedRetained,false);assert.equal(cell.readyForCrossing,false);
  assert.deepEqual(new Set(world.bodies),new Set(unowned));for(const c of joints)assert.equal(world.constraints.includes(c),false);assert.equal(world._listeners.postStep.length,listenerCount-1);assert.equal(game.physics.bodyBoxes.size,0);assert.equal(game.physics.cargoSweepBoxes.size,0);assert.equal(game.physics.cargoBody,cargo);assert.ok(world.bodies.includes(cargo));assert.deepEqual(world.subsystems,[...f.originalSubsystems,foreignSubsystem]);const beforeForeign=foreignUpdates;game.physics.step(DT);assert.equal(foreignUpdates,beforeForeign+1,'The foreign hook remains operational after this cell is disposed');
  for(const p of allParts(cell)){assert.equal(p.collider.enabled,false);assert.equal(p.collider.orientedBox,undefined);}
 }finally{f.dispose();}
});
