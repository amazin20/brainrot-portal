import test from 'node:test';
import assert from 'node:assert/strict';
import {Body} from 'cannon-es';
import {room23PhysicalFixture} from './fixtures/room23-physical-fixture.js';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {ROOM23_DOCKED_INITIAL_STATE,runRoom23DockedHandoff} from '../research/room23-docked-handoff-probe.mjs';

test('23 prototype actual massive passenger ascent requires the bounded motor and contacted clutch',()=>{
 const outcomes=[];
 for(const control of ['positive','motor-off','clutch-open']){
  const f=room23PhysicalFixture(),m=f.machine,initial=f.original;try{
   if(control==='motor-off')m.requestMotorSupply(false);
   f.step(3);const start=m.energy();if(control!=='clutch-open')m.requestClutch(true);f.step(6);
   const braked=m.diagnostics();assert.ok(Math.abs(braked.west.y)<.005);assert.ok(braked.brakeNormal>1000);
   if(control!=='clutch-open')assert.ok(braked.clutchNormal>1000);
   m.requestBrake(false);let maxError=0,maxGrip=0,minLoad=Infinity;
   f.step(12,d=>{
    if(!d.lastForce)return;const p=d.lastForce;
    maxError=Math.max(maxError,Math.abs(p.cableLengthError));minLoad=Math.min(minLoad,d.west.passengerLoad);
    assert.ok(Math.abs(p.motorTorque)<=448+1e-8);assert.ok(p.motorPower<=1200+1e-8);
    assert.ok(Math.abs(d.clutchTorque)<=p.clutchCapacity+1e-5);assert.ok(Math.abs(d.brakeTorque)<=p.brakeCapacity+1e-5);
    assert.equal(p.frictionContactStep,p.worldStep);assert.equal(p.dt,1/120);assert.equal(d.ownershipValid,true);
    maxGrip=Math.max(maxGrip,d.clutchCapacity);
   });
   const end=m.diagnostics(),energy=m.energy();assert.equal(f.original,initial);assert.equal(initial.shapes[0],f.shape);assert.equal(initial.mass,3.2);
   assert.equal(m.traveller.body.mass,50);assert.equal(m.traveller.body.type,Body.DYNAMIC);assert.ok(maxError<.005);
   if(control==='positive'){assert.ok(end.west.y>9.99&&end.east.y<10.01);assert.ok(f.game.playerPosition.y>9.99);
    assert.ok(initial.position.y<10.65&&initial.position.y>10.4);assert.ok(end.motorWork-start.sourceWork>9000);
    assert.ok(end.west.passengerLoad>900);assert.ok(end.east.normalLoad>50);assert.ok(maxGrip>500);
   }else{assert.ok(end.west.y<.005);assert.ok(end.east.y>19.99);if(control==='motor-off')assert.equal(end.motorWork,0);else assert.equal(end.clutchNormal,0);}
   outcomes.push({control,westY:end.west.y,eastY:end.east.y,motorWork:end.motorWork,passengerLoad:end.west.passengerLoad,
    originalLoad:end.east.normalLoad,energyDelta:energy.total-start.total,recordedWork:energy.sourceWork-start.sourceWork,
    residual:(energy.total-start.total)-(energy.sourceWork-start.sourceWork)-(energy.recordedDragWork-start.recordedDragWork)-(energy.recordedClutchWork-start.recordedClutchWork)-(energy.recordedBrakeWork-start.recordedBrakeWork)});
  }finally{f.dispose();}
 }
 assert.ok(outcomes[0].motorWork>9126);assert.ok(outcomes[1].westY<.005&&outcomes[2].westY<.005);
});

test('23 prototype common actual brake arrests midstroke, holds changed supply and releases the same bodies',()=>{
 const f=room23PhysicalFixture(),m=f.machine;try{
  f.step(3);m.requestClutch(true);f.step(6);m.requestBrake(false);f.step(4);
  assert.ok(m.height>3&&m.height<6);assert.ok(m.velocity>.5);
  const atBrake=m.height;m.requestBrake(true);f.step(2);const held=m.diagnostics();
  assert.ok(held.brakeNormal>1000&&held.brakeCapacity>400);assert.ok(Math.abs(m.velocity)<.02);
  assert.ok(m.height>atBrake&&m.height<atBrake+.4,'Finite jaw actuation must arrest travel without assigning a height');
  m.requestMotorSupply(false);const atHold=m.height;f.step(2);assert.ok(Math.abs(m.height-atHold)<.005);
  assert.ok(Math.abs(m.diagnostics().brakeTorque)>200);m.requestBrake(false);f.step(.8);assert.ok(m.height<atHold-.1);
  m.requestMotorSupply(true);f.step(12);assert.ok(m.height>9.99);assert.equal(f.original.shapes[0],f.shape);
 }finally{f.dispose();}
});

test('23 prototype initialized reverse leg lifts an actual east passenger while the west original descends',()=>{
 const outcomes=[];for(const motor of [true,false]){
  const f=room23PhysicalFixture({cargoSide:'west',passengerSide:'east',initialDisplacement:10}),m=f.machine;
  try{m.requestMotorSupply(motor);f.step(3);m.requestClutch(true);f.step(6);m.requestBrake(false);f.step(12);const d=m.diagnostics();
   assert.equal(m.traveller.body.mass,50);assert.equal(f.original.mass,3.2);assert.equal(f.original.shapes[0],f.shape);assert.ok(d.west.normalLoad>50);
   if(motor){assert.ok(d.east.y>19.99&&d.west.y<.01);assert.ok(f.game.playerPosition.y>19.99);assert.ok(d.motorWork>9126);assert.ok(d.east.passengerLoad>900);}
   else{assert.ok(d.east.y<10.01&&d.west.y>9.99);assert.equal(d.motorWork,0);}
   outcomes.push(d);
  }finally{f.dispose();}
 }assert.ok(outcomes[0].east.y>outcomes[1].east.y+9.9);
});

test('23 prototype false current ownership closes force supply and preserves a foreign registry replacement',()=>{
 const f=room23PhysicalFixture(),m=f.machine;try{
  f.step(1);const p=m.parts.find(x=>x.kind==='car'),old=f.game.physics.bodyBoxes.get(p.mesh.uuid),foreign={...old,shapeIndex:999};
  f.game.physics.bodyBoxes.set(p.mesh.uuid,foreign);const count=m.diagnostics().forceCount;f.step(.02);
  const d=m.diagnostics();assert.match(d.fault,/owned body/);assert.equal(d.forceCount,count);assert.equal(d.ownershipValid,false);
  m.reset();assert.equal(m.diagnostics().forceCount,count);assert.ok(m.constraints.every(c=>c.equations.every(e=>e.enabled===false)));
  m.dispose();assert.equal(f.game.physics.bodyBoxes.get(p.mesh.uuid),foreign);
 }finally{f.dispose();}
});

test('23 prototype disabled real deck or shape cannot continue receiving actuator work',()=>{
 for(const control of ['disabled-collider','disabled-shape']){
  const f=room23PhysicalFixture(),m=f.machine;try{
   f.step(1);const p=m.parts.find(x=>x.kind==='car');if(control==='disabled-collider')p.collider.enabled=false;else p.shape.collisionResponse=false;
   const before=m.diagnostics().forceCount;f.step(.02);const d=m.diagnostics();assert.match(d.fault,/owned body/);assert.equal(d.forceCount,before);assert.equal(d.ownershipValid,false);
  }finally{f.dispose();}
 }
});

test('23 prototype zero-time sync cannot advance mechanics; repeated reset/dispose restores callbacks and all owned bodies',()=>{
 const f=room23PhysicalFixture(),m=f.machine,owner=f.game.physics;try{
  f.step(1);const n=owner.world.stepnumber,force=m.diagnostics().forceCount;
  for(let k=0;k<20;k++){m.syncPose();m.diagnostics();}
  assert.equal(owner.world.stepnumber,n);assert.equal(m.diagnostics().forceCount,force);
  const hingeMotors=m.constraints.flatMap(c=>c.equations).filter(e=>e.constructor.name==='RotationalMotorEquation');assert.equal(hingeMotors.length,2);
  assert.ok(hingeMotors.every(e=>e.enabled===false));
  // Healthy reset preserves the authored disabled motors. A motor enabled by
  // corruption is now an ownership fault, covered by the fail-closed probes;
  // reset must not silently repair that altered physical owner.
  for(let k=0;k<3;k++){m.reset();f.step(.5);assert.equal(m.ownershipValid(),true);assert.equal(m.traveller.body.mass,50);assert.ok(hingeMotors.every(e=>e.enabled===false));}
  const own=[...m.bodies,m.traveller.body],rows=[...m.constraints],ids=m.parts.map(p=>p.mesh.uuid);m.dispose();m.dispose();
  assert.ok(own.every(b=>!owner.world.bodies.includes(b)));assert.ok(rows.every(c=>!owner.world.constraints.includes(c)));
  assert.ok(ids.every(id=>!owner.bodyBoxes.has(id)));assert.equal(owner.world.subsystems.length,0);assert.equal(owner.world.solver.iterations,18);
  assert.equal(Object.hasOwn(owner.world.solver,'solve'),false);assert.equal(Object.hasOwn(owner,'_carryForces'),false);
 }finally{f.dispose();}
});

test('23 opt-in public-input courtyard pickup has real hand reaction and powered finite reach; it is a partial route',async()=>{
 const g=await createHeadlessGame(),baseUpdate=g.updatePlayer;g.room23PhysicalPrototype=true;await g.selectLevel(22,false);
 const body=g.physics.cargoBody,shape=body.shapes[0];let before=null,held=null,released=null,maxGrip=0;
 try{
  const r=await runV8Journey(g,{scenario:async d=>{
   d.walk(-6.5,8);d.walk(-3.1,8);d.walk(-3.1,3.8);d.wait(1);before=d.level.balance.traveller.diagnostics();
   d.pickup();for(let k=0;k<240;k++){d.frame();const joint=d.level.balance.traveller.handJoint;if(joint)maxGrip=Math.max(maxGrip,Math.hypot(...joint.equations.map(e=>e.multiplier)));}
   held=d.level.balance.traveller.diagnostics();assert.ok(g.interact());d.wait(2);released=d.level.balance.traveller.diagnostics();
   d.mark('actual dynamic traveller picks up and releases original in starting court');
  }});
  assert.equal(r.resets+r.respawns,0);assert.equal(g.physics.cargoBody,body);assert.equal(body.shapes[0],shape);assert.equal(body.mass,3.2);
  assert.ok(before.footLoad>950&&before.footLoad<1000);assert.ok(held.footLoad>1020&&held.footLoad<1060);
  assert.ok(held.handJointOwned);assert.ok(held.handServoWork>20);assert.equal(held.handServoPowerBound,125);assert.ok(maxGrip<=250+1e-5);
  assert.equal(released.handJointPresent,false);assert.ok(released.footLoad>950&&released.footLoad<1000);assert.equal(g.state,'playing');
  assert.equal(g.firstLevel.puzzleGeometry.fullOrdinaryRouteAccepted,false);
  g.room23PhysicalPrototype=false;await g.selectLevel(21,false);assert.equal(g.updatePlayer,baseUpdate);assert.equal(Object.hasOwn(g,'updatePlayer'),false);assert.equal(g.physics.world.solver.iterations,18);
 }finally{g.firstLevel?.dispose?.();g.physics.dispose();g.portals.dispose();}
});

test('23 opt-in actual finite jump impulse lifts held original mass and reduces the traveller apex',async()=>{
 const outcomes=[];
 for(const held of [false,true]){
  const g=await createHeadlessGame();g.room23PhysicalPrototype=true;await g.selectLevel(22,false);const original=g.physics.cargoBody;
  try{let top=0;const report=await runV8Journey(g,{scenario:async d=>{
   d.walk(-6.5,8);d.walk(-3.1,8);d.walk(-3.1,3.8);d.wait(1);if(held){d.pickup();d.wait(4);}
   const base=g.playerPosition.y;g.input.jumpQueued=true;
   for(let n=0;n<100;n++){d.frame();top=Math.max(top,g.playerPosition.y-base);}
  }});
  const d=g.firstLevel.balance.traveller.diagnostics();assert.equal(report.resets+report.respawns,0);assert.equal(g.physics.cargoBody,original);
  assert.equal(original.mass,3.2);assert.equal(d.mass,50);assert.ok(d.jumpWork>1520&&d.jumpWork<1522);assert.ok(top>1.2&&top<1.6);
  outcomes.push({held,top,jumpWork:d.jumpWork});
  }finally{g.firstLevel?.dispose?.();g.physics.dispose();g.portals.dispose();}
 }
 assert.ok(outcomes[1].top<outcomes[0].top-.1,'Equal real leg impulse must carry the original mass through the finite hand joint');
});

test('23 declared middle fixture hands the same original between actual cabins and requires supply and clutch for the loaded return',async()=>{
 const outcomes=[];
 for(const control of ['positive','motor-off','clutch-open']){
  const g=await createHeadlessGame();g.room23PhysicalPrototype=true;g.room23PhysicalPrototypeInitialState=ROOM23_DOCKED_INITIAL_STATE;await g.selectLevel(22,false);
  const original=g.physics.cargoBody,shape=original.shapes[0];let eastLoad=0,heldEastSteps=0,heldWestSteps=0,result=null,transfer=null,sourceWorkBeforeReturn=0;
  const m=g.firstLevel.balance,driveBodies=new Set([m.inputRotor,m.drumBody,m.forkBody,...m.jawBodies]);
  const observe=()=>{const d=m.diagnostics();if(g.heldCube){if(d.east.passengerLoad>1000)heldEastSteps++;if(d.west.passengerLoad>1000)heldWestSteps++;}
   assert.equal(d.ownershipValid,true);assert.equal(g.physics.cargoBody,original);assert.equal(original.shapes[0],shape);
   assert.ok([...g.physics.solids.values()].every(item=>item.inWorld),'The founded drive bay and all scene statics must remain real collision bodies');
   for(const c of g.physics.world.contacts)if(c.enabled!==false&&c.multiplier>1e-7){
    const car=m.cars.find(car=>c.bi===car.body||c.bj===car.body);
    if(car)assert.ok(!driveBodies.has(c.bi===car.body?c.bj:c.bi),'The complete swept cabin stroke must clear the drive hardware');
    if(driveBodies.has(c.bi)||driveBodies.has(c.bj)){const other=driveBodies.has(c.bi)?c.bj:c.bi;assert.ok(![...g.physics.solids.values()].some(item=>item.body===other),'The moving clutch and brake commands must clear actual static scene geometry');}
   }
  };
  g.physics.world.addEventListener('postStep',observe);
  try{
   const report=await runV8Journey(g,{scenario:async d=>{
    result=await runRoom23DockedHandoff({...d,mark(name){if(name==='declared middle docking holds real east cargo and passenger')eastLoad=m.diagnostics().east.normalLoad;d.mark(name);}});
    transfer=m.diagnostics();
    assert.ok(transfer.west.normalLoad>50);assert.equal(transfer.east.normalLoad,0);
    assert.ok(transfer.sourceInput<-.8&&transfer.brakeNormal>1000&&Math.abs(transfer.brakeTorque)>200);
    assert.ok(Math.abs(transfer.west.y-10)<.01&&Math.abs(transfer.east.y-10)<.01);
    d.walk(-3.1,1);d.walk(3.1,1);d.walk(5.5,4.5);sourceWorkBeforeReturn=m.diagnostics().motorWork;
    if(control==='motor-off')m.requestMotorSupply(false);if(control==='clutch-open'){m.requestClutch(false);d.wait(2);}
    assert.ok(g.interact(),'The actual E control must withdraw the brake shoes');
    d.wait(14);const end=m.diagnostics();
    if(control==='positive'){
     assert.ok(end.east.y>19.99&&end.west.y<.01);assert.ok(g.playerPosition.y>19.99);assert.ok(original.position.y<.7);
     assert.ok(end.motorWork-sourceWorkBeforeReturn>9126);assert.ok(end.east.passengerLoad>900&&end.west.normalLoad>50);
     d.walk(5.5,8.2);assert.ok(g.playerPosition.y>19.98,'Real feet must transfer onto the permanent upper exit apron');
    }else{
     assert.ok(end.east.y<10.01&&end.west.y>9.99);assert.ok(end.east.passengerLoad>900&&end.west.normalLoad>50);
     if(control==='motor-off')assert.equal(end.motorWork,sourceWorkBeforeReturn);else assert.equal(end.clutchNormal,0);
    }
    outcomes.push({control,westY:end.west.y,eastY:end.east.y,returnWork:end.motorWork-sourceWorkBeforeReturn});
   }});
   assert.equal(report.resets+report.respawns,0);assert.equal(g.state,'playing');assert.equal(g.heldCube,null);
   assert.equal(original.mass,3.2);assert.equal(m.traveller.body.mass,50);assert.ok(eastLoad>50);
   assert.ok(heldEastSteps>0&&heldWestSteps>0,'Real held mass must load each actual cabin through foot contacts during the direct transfer');
   assert.equal(result.normalAuthoredSpawn,false);assert.equal(result.fullOrdinaryRouteAccepted,false);assert.equal(m.diagnostics().fullOrdinaryRouteAccepted,false);
  }finally{g.physics.world.removeEventListener('postStep',observe);g.firstLevel.dispose();g.physics.dispose();g.portals.dispose();}
 }
 assert.ok(outcomes[0].eastY>outcomes[1].eastY+9.9&&outcomes[0].eastY>outcomes[2].eastY+9.9);
});
