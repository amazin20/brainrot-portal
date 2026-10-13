import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runTower41RatchetCellJourney,runTower41RatchetQualification} from '../src/game/LabTower41RatchetCellJourney.js';

test('Tower41 ordinary CPU route retains two loads, recovers the original cargo and observes bounded held pressure',{timeout:240000},async()=>{
 const g=await createHeadlessGame();
 let observedWorld,recordPostStep;
 try{
  g.chamberEdition='foundation';g.tower41RatchetQualification=true;await g.selectLevel(40,true);
  const cargo=g.cargo,body=g.physics.cargoBody,cell=g.firstLevel.ratchetCell;
  assert.ok(cell,'The fixture explicitly opts into the production physical cell');
  const completedTicks=new Map();let measuredFrame=0;
  observedWorld=g.physics.world;
  recordPostStep=()=>completedTicks.set(observedWorld.stepnumber,{step:observedWorld.stepnumber,frame:measuredFrame,bodyPosition:body.position.toArray()});
  observedWorld.addEventListener('postStep',recordPostStep);
  let report;
  try{report=await runTower41RatchetCellJourney(g,{scenario:runTower41RatchetQualification,onFrame:s=>{measuredFrame=s.frame;},onMilestone:m=>console.log('Tower41 ratchet milestone '+JSON.stringify({name:m.name,frame:m.frame,player:m.player,cargo:m.cargo,held:m.held,rackTravel:m.cell.rack?.travel,rackVelocity:m.cell.rack?.velocity,pawlAngle:m.cell.pawl?.angle}))});}catch(error){console.log('Tower41 ratchet input failure '+JSON.stringify(error.ratchetInputReport??error.singularityReport));throw error;}finally{observedWorld.removeEventListener('postStep',recordPostStep);recordPostStep=null;}
  console.log('Tower41 ratchet production input coverage '+JSON.stringify(report));
  assert.equal(report.pass,true);assert.equal(report.sameCargo,true);assert.equal(report.observersRestored,true);
  assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);assert.equal(g.heldCube,cargo);
  assert.equal(report.heldContact.status,'CONTACT_OBSERVED');assert.ok(report.heldContact.actualHeldPositiveContactTicks>0&&report.heldContact.normalImpulse>0&&report.heldContact.verticalImpulseOnRack<0);
  assert.equal(report.heldContact.ECommands,0);assert.equal(report.heldContact.fullServoResistanceAccepted,false);
  assert.equal(report.fastRelease.pass,true);assert.equal(report.fastRelease.all124PostProductionTicksObserved,true);assert.ok(report.fastRelease.maxGuardPenetration<.002);
  assert.equal(report.boarding.pass,true);assert.equal(report.boarding.attemptOutcome,'ACTUAL_TRAY_BOARDING_OBSERVED');assert.ok(report.boarding.actualBoardedSamples>0);assert.deepEqual(report.boarding.completedMechanismsAfter,report.boarding.completedMechanismsBefore);
  for(const sample of report.boarding.samples.filter(x=>x.boarded)){
   assert.equal(sample.actualTraySupport.bodyId,cell.rack.id);assert.equal(sample.actualTraySupport.shapeId,cell.rack.shapes[0].id);
   assert.ok(sample.grounded&&sample.player[1]>.1&&Math.abs(sample.player[1]-sample.actualTraySupport.height)<.015&&sample.actualTraySupport.normal[1]>.5,'Every claimed boarding sample is elevated and supported by the actual tray shape');
  }
  for(const sample of report.fastRelease.postPhysicsTrace){assert.equal(sample.compoundSweep.worldStep,sample.step);assert.equal(sample.compoundSweep.cannonContactEquationsAdded,0);}
  assert.equal(report.resets+report.respawns+report.cargoResets+report.mechanismResets,0);
  assert.equal(report.cargoTransfers.length,0);assert.equal(report.teleports,0);
  assert.ok(report.retention.first>.12&&report.retention.second>report.retention.first+.15,'Both retained positions follow measured free cargo cycles');
  const phase=name=>report.phases.find(p=>p.name===name),pair=(p,a,b)=>p.contacts.filter(c=>(c.bodyA===a&&c.bodyB===b)||(c.bodyA===b&&c.bodyB===a));
  for(const name of ['first free load','same body reload'])assert.ok(pair(phase(name),body.id,cell.rack.id).some(c=>c.freeCargoTicks>0),'Original free cargo makes real rack contact during '+name);
  assert.equal(report.loads.length,2);
  for(const load of report.loads){
   assert.equal(load.neutralWindow.length,2,'Two ordinary frames observe the real settled held endpoint');
   assert.ok(load.neutralWindow[1].step-load.neutralWindow[0].step>=2);
   for(const s of [...load.neutralWindow,load.beforeQueuedE,load.release.before]){
    assert.ok(s.bodySpeed<.15&&s.bodyAngularSpeed<.15,'The actual original cargo has little full velocity before E');
    assert.ok(s.cargoMinY>s.trayMaxY+.015&&s.guards.every(guard=>guard.gap>=0),'The true oriented cargo clears the real tray and every fixed Box guard before E');
   }
   assert.deepEqual(load.release.after.bodyPosition,load.release.before.bodyPosition);
   assert.deepEqual(load.release.after.bodyVelocity,load.release.before.bodyVelocity);
   assert.deepEqual(load.release.after.bodyAngularVelocity,load.release.before.bodyAngularVelocity);
   assert.deepEqual(load.release.after.bodyQuaternion,load.release.before.bodyQuaternion);
   assert.equal(load.release.after.carryTarget,null,'Native E releases the servo without rewriting measured pose or momentum');
   assert.ok(load.trace.length>=4&&load.trace.length<=96,'The 120 Hz pose/target/SAT trace stays within the bounded load window');
   assert.equal(load.trace.length%2,0);
   for(const [i,sample] of load.trace.entries()){
    assert.deepEqual({step:sample.step,frame:sample.frame,bodyPosition:sample.bodyPosition},completedTicks.get(sample.step),'Each trace pose is bound to the independently observed actual completed step and local frame');
    if(i)assert.equal(sample.step,load.trace[i-1].step+1,'Bounded trace ticks are consecutive');
    assert.equal(sample.frame,load.trace[0].frame+Math.floor(i/2),'Two completed physics ticks belong to each ordinary input frame');
   }
   assert.ok(load.actualFreeContacts.fixedGuardMaxPenetration<load.historicalFirstLoad.fixedGuardMaxPenetration/2,'Actual free-load guard penetration is materially below the historical transient release');
   assert.ok(Number.isInteger(load.actualFreeContacts.roofShape));
   assert.ok(load.actualFreeContacts.roofMaxPenetration<load.historicalFirstLoad.roofMaxPenetration/2,'Actual free-load roof penetration is materially below the historical transient release');
  }
  for(const name of ['first E unload and retention','second E unload and retention']){
   const p=phase(name);assert.ok(pair(p,cell.rack.id,cell.pawl.id).some(c=>(c.shapeTypeA==='ConvexPolyhedron'||c.shapeTypeB==='ConvexPolyhedron')&&c.contactTicks>60&&c.lastStep>=p.end.step-1),'The real retaining tooth still contacts the pawl after settling during '+name);
  }
  assert.equal(pair(phase('held clearance'),body.id,cell.rack.id).length,0,'The clearance case has no real cargo/rack contact');
  const recovery=phase('local fall and floor E recovery');
  assert.ok(recovery.player.maxFootY-recovery.player.minFootY>1&&recovery.player.fallingTicks>0&&recovery.player.landings>0,'The ordinary local jump includes a measured fall and real floor landing');
  assert.ok(recovery.dynamicBodies[body.id].max[1]-recovery.dynamicBodies[body.id].min[1]>.4,'The original free cargo also falls to the real floor before E recovery');
 }finally{if(recordPostStep)observedWorld.removeEventListener('postStep',recordPostStep);g.firstLevel?.dispose();g.physics?.dispose();g.portals?.dispose();}
});
