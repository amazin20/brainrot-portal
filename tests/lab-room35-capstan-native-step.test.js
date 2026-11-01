import test from 'node:test';
import assert from 'node:assert/strict';
import {Body,Material} from 'cannon-es';
import {LabPhysics} from '../src/game/LabPhysics.js';
import {createRoom35CapstanCell} from '../src/game/LabRoom35CapstanCell.js';

const H=1/120;
function nativeCell({position=[-18,6.39,16],velocity=[0,0,0],fixedStep=H,cellStep=fixedStep}={}){
 const physics=new LabPhysics({fixedStep}),world=physics.world;
 const cargo=physics.createCargo({position,velocity,size:.78,mass:3.2});
 const shape=cargo.shapes[0],material=cargo.material,solver=world.solver,broadphase=world.broadphase,contact=world.defaultContactMaterial;
 const initial={bodies:[...world.bodies],constraints:[...world.constraints],contacts:[...world.contactmaterials]};
 const settings=()=>({fixedStep:physics.fixedStep,maxFrame:physics.maxFrame,worldSleep:world.allowSleep,
  gravity:world.gravity.toArray(),iterations:world.solver.iterations,tolerance:world.solver.tolerance,
  contact:{...world.defaultContactMaterial},cargoSleep:cargo.allowSleep,sleepSpeed:cargo.sleepSpeedLimit,sleepTime:cargo.sleepTimeLimit,
  linearDamping:cargo.linearDamping,angularDamping:cargo.angularDamping,maxLinearSpeed:physics.maxLinearSpeed});
 const settingsBefore=settings(),ownerStep=physics.step,worldStep=world.step;
 const cell=createRoom35CapstanCell({world,cargoBody:cargo,dt:cellStep});
 function identity(){
  assert.ok(physics.world===world);assert.ok(physics.cargoBody===cargo);assert.ok(cargo.world===world);
  assert.ok(cargo.shapes[0]===shape);assert.ok(cargo.material===material);assert.equal(cargo.mass,3.2);
  assert.deepEqual(shape.halfExtents.toArray(),[.39,.39,.39]);
  assert.ok(world.solver===solver);assert.ok(world.broadphase===broadphase);assert.ok(world.defaultContactMaterial===contact);
  assert.equal(physics.step,ownerStep);assert.equal(world.step,worldStep);assert.deepEqual(settings(),settingsBefore);
 }
 function advance(count=1){
  for(let i=0;i<count;i++){
   const beforeWorld=world.stepnumber,beforeOwner=physics.steps,beforeTime=world.time;
   const bridgePosition=cell.bridge.position.clone(),cargoPosition=cargo.position.clone();
   cell.prepareStep(fixedStep);
   assert.equal(world.stepnumber,beforeWorld);assert.equal(world.time,beforeTime);assert.equal(physics.steps,beforeOwner);
   assert.ok(cell.bridge.position.almostEquals(bridgePosition,0));assert.ok(cargo.position.almostEquals(cargoPosition,0));
   physics.step(fixedStep);
   assert.equal(world.stepnumber,beforeWorld+1);assert.equal(physics.steps,beforeOwner+1);
   const afterWorld=world.stepnumber,afterTime=world.time;
   cell.finishStep();
   assert.equal(world.stepnumber,afterWorld);assert.equal(world.time,afterTime);assert.equal(physics.steps,beforeOwner+1);
  }
 }
 function dispose(){
  cell.dispose();identity();
  // Additional owner-authored solids can survive in physics.solids while
  // streaming removes them from the world. The cell removes only its owners.
  for(const body of initial.bodies)assert.ok(world.bodies.includes(body));
  assert.equal(world.constraints.length,initial.constraints.length);assert.ok(world.constraints.every((item,i)=>item===initial.constraints[i]));
  assert.equal(world.contactmaterials.length,initial.contacts.length);assert.ok(world.contactmaterials.every((item,i)=>item===initial.contacts[i]));
  physics.dispose();
 }
 return {physics,world,cargo,shape,material,cell,advance,identity,dispose};
}

test('35 native component: one original LabPhysics step owns streaming, integration and original cargo identity',()=>{
 const f=nativeCell();try{
  // The real owner enables streaming at750 authored solids; a small fixture
  // correctly keeps its solids registered. Exercise that unchanged threshold.
  for(let i=0;i<750;i++)f.physics.addStaticBox('native-owner-far-solid-'+i,{min:{x:100+i*2,y:0,z:100},max:{x:101+i*2,y:1,z:101}});
  const far=f.physics.solids.get('native-owner-far-solid-0').body;assert.ok(far.world===f.world);
  assert.throws(()=>f.cell.step(),/borrowed world/);assert.equal(f.world.stepnumber,0);
  f.advance(3*120);assert.equal(f.cell.ledger.manualWork,0);
  assert.ok(far.world===null&&f.physics.streamingStatic,'The original owner streams its distant solid, rather than a raw world-only shortcut');
  f.cell.control.pressed=true;f.advance(120);
  assert.ok(f.cell.ledger.manualWork>0);assert.ok(f.cell.ledger.maxManualPower<=240+1e-6);
  assert.ok(f.cell.ledger.maxManualForce<=405);
  const work=f.cell.ledger.manualWork;
  f.cell.control.position=[20,6,22];f.advance(120);
  assert.equal(f.cell.ledger.manualWork,work);
  const d=f.cell.diagnostics();assert.equal(d.steps,600);assert.equal(f.world.stepnumber,600);assert.equal(f.physics.steps,600);
  assert.equal(d.phase,'idle');assert.equal(d.budget.surrogatePlayerMass,0);assert.equal(d.manualApplications,120);
  assert.equal(d.ledger.maxSlipEnergyGain,0);assert.equal(d.ledger.maxConeViolation,0);
  f.identity();
 }finally{f.dispose();}
});

test('35 native component: the owner still runs its thin-wall CCD after its original world step',()=>{
 const f=nativeCell({position:[-18,-9.5,16],velocity:[22,0,0]});try{
  f.cell.setPortal(null);
  f.physics.addStaticBox('native-owner-thin-wall',{min:{x:-17.5,y:-10,z:15},max:{x:-17.48,y:-8,z:17}});
  f.advance();
  assert.ok(f.physics.sweptContacts>0,'An actual native swept-cargo correction must occur');
  assert.ok(f.cargo.position.x<=-17.5-.78*.48+1e-6);
  assert.equal(f.cargo.velocity.x,0);assert.equal(f.physics.steps,1);assert.equal(f.cell.diagnostics().steps,1);
  f.identity();
 }finally{f.dispose();}
});

test('35 native component: disconnected resting original cargo sleeps and zero forces do not wake it',()=>{
 const f=nativeCell({position:[-18,-9.61,16]});try{
  f.cell.setPortal(null);f.advance(3*120);
  assert.equal(f.cargo.sleepState,Body.SLEEPING);
  let wakeEvents=0;const onWake=()=>wakeEvents++;f.cargo.addEventListener('wakeup',onWake);
  f.advance(120);f.cargo.removeEventListener('wakeup',onWake);
  assert.equal(f.cargo.sleepState,Body.SLEEPING);assert.equal(wakeEvents,0);
  assert.equal(f.cell.ledger.manualWork,0);assert.equal(f.cell.diagnostics().steps,480);f.identity();
 }finally{f.dispose();}
});

test('35 native component: preparation cannot double-apply work or accept a missing or duplicated completion',()=>{
 const f=nativeCell();try{
  assert.throws(()=>f.cell.finishStep(),/No capstan step/);
  assert.throws(()=>f.cell.prepareStep(H/2),/configured fixed step/);
  f.cell.control.pressed=true;f.cell.prepareStep();
  const velocity=f.cell.bridge.velocity.clone(),angular=f.cell.bridge.angularVelocity.clone(),force=f.cargo.force.clone();
  assert.throws(()=>f.cell.prepareStep(),/Finish the prepared/);
  assert.throws(()=>f.cell.setPortal(null),/Finish the prepared/);
  assert.throws(()=>f.cell.finishStep(),/exactly one native world step/);
  assert.ok(f.cell.bridge.velocity.almostEquals(velocity,0));assert.ok(f.cell.bridge.angularVelocity.almostEquals(angular,0));assert.ok(f.cargo.force.almostEquals(force,0));
  assert.equal(f.world.stepnumber,0);assert.equal(f.cell.ledger.steps,0);
  f.physics.step(H);assert.equal(f.cell.finishStep(),1);
  assert.throws(()=>f.cell.finishStep(),/No capstan step/);assert.equal(f.world.stepnumber,1);
 }finally{f.dispose();}
});

test('35 native component: skipped, doubled and wrong-duration world steps are rejected without accepted ledger samples',()=>{
 for(const scenario of ['skipped','double','wrong-duration']){
  const f=nativeCell({fixedStep:scenario==='wrong-duration'?H/2:H,cellStep:H});
  try{
   if(scenario==='skipped'){
    f.physics.step(H);assert.throws(()=>f.cell.prepareStep(),/advanced without a prepared/);
   }else{
    f.cell.prepareStep();f.physics.step(scenario==='double'?2*H:H/2);
    assert.throws(()=>f.cell.finishStep(),scenario==='double'?/exactly one native world step/:/different capstan fixed step/);
   }
   assert.equal(f.cell.ledger.steps,0);assert.equal(f.cell.diagnostics().time,0);
  }finally{f.dispose();}
 }
});

test('35 native component: original material identity and pending-force ownership survive refusal and disposal',()=>{
 const f=nativeCell({velocity:[1,0,0]});try{
  const replacement=new Material();f.cargo.material=replacement;
  assert.throws(()=>f.cell.prepareStep(),/original cargo body, shape or material/);f.cargo.material=f.material;
  f.cargo.force.set(3,4,5);const ownerForce=f.cargo.force.clone();
  f.cell.prepareStep();assert.notDeepEqual(f.cargo.force.toArray(),ownerForce.toArray());
  f.cell.dispose();assert.deepEqual(f.cargo.force.toArray(),ownerForce.toArray());
  assert.equal(f.world.stepnumber,0);assert.equal(f.physics.steps,0);f.identity();
  assert.throws(()=>f.cell.prepareStep(),/disposed/);
 }finally{f.dispose();}
});

test('35 native component: nonnative gravity is refused before constructing a misleading energy ledger',()=>{
 const physics=new LabPhysics({gravity:-9.81}),cargo=physics.createCargo({position:[-18,6.39,16]});
 const bodies=[...physics.world.bodies],constraints=[...physics.world.constraints],contacts=[...physics.world.contactmaterials];
 try{
  assert.throws(()=>createRoom35CapstanCell({world:physics.world,cargoBody:cargo}),/native downward19.5 gravity/);
  assert.equal(physics.world.bodies.length,bodies.length);assert.ok(physics.world.bodies.every((b,i)=>b===bodies[i]));
  assert.equal(physics.world.constraints.length,constraints.length);assert.equal(physics.world.contactmaterials.length,contacts.length);
 }finally{physics.dispose();}
});
