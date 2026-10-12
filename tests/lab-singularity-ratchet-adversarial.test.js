import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runTower41RatchetCellJourney} from '../src/game/LabTower41RatchetCellJourney.js';
import {runTower41RatchetAdversarialJourney} from '../src/game/LabTower41RatchetAdversarialJourney.js';

test('Tower41 ordinary repeated boarding and five reachable early-E trajectories retain bounded truthful evidence',{timeout:240000},async()=>{
 const g=await createHeadlessGame();
 try{
  g.chamberEdition='foundation';g.tower41RatchetQualification=true;await g.selectLevel(40,true);
  const cargo=g.cargo,body=g.physics.cargoBody;let report;
  try{report=await runTower41RatchetCellJourney(g,{scenario:runTower41RatchetAdversarialJourney});}
  catch(error){const r=error.ratchetInputReport;console.log('Tower41 adversarial input failure '+JSON.stringify({failure:r?.failure,latestMilestone:r?.milestones.at(-1),repeatedBoarding:r?.repeatedBoarding}));throw error;}
  assert.equal(report.pass,true);assert.equal(report.sameCargo,true);assert.equal(report.observersRestored,true);
  assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);assert.equal(g.heldCube,cargo);
  assert.equal(report.resets+report.respawns+report.cargoResets+report.mechanismResets,0);
  assert.equal(report.teleports,0);assert.equal(report.cargoTransfers.length,0);
  assert.equal(report.repeatedHeldTopContacts.rounds.length,3);
  for(const contact of report.repeatedHeldTopContacts.rounds){
   assert.equal(contact.status,'CONTACT_OBSERVED');assert.ok(contact.actualHeldPositiveContactTicks>0);
   assert.ok(contact.normalImpulse>0&&contact.verticalImpulseOnRack<0);assert.equal(contact.ECommands,0);
   assert.equal(contact.actualCargoBodyId,body.id);assert.equal(contact.actualRackBodyId,g.firstLevel.ratchetCell.rack.id);
  }
  const repeated=report.repeatedBoarding;
  assert.equal(repeated.rounds.length,5);assert.equal(repeated.allTargetsReached,true);assert.ok(repeated.totalActualBoardedTicks>0);
  assert.equal(repeated.fullBoardingResistanceAccepted,false);
  for(const round of repeated.rounds){
   assert.equal(round.status,'ACTUAL_TRAY_BOARDING_OBSERVED');assert.ok(round.actualBoardedTicks>0);assert.equal(round.ECommands,0);
   assert.deepEqual(round.solvedBefore,round.solvedAfter);
   assert.ok(round.samples.every(s=>s.held),'All observed ticks retain the real original grip');
   for(const s of round.samples.filter(s=>s.support?.boarded)){
    assert.equal(s.support.bodyId,g.firstLevel.ratchetCell.rack.id);assert.equal(s.support.shapeId,g.firstLevel.ratchetCell.rack.shapes[0].id);
    assert.ok(s.grounded&&s.player[1]>.1&&Math.abs(s.player[1]-s.support.height)<.015&&s.support.normal[1]>.5);
   }
  }
  const early=report.earlyEVariations;assert.equal(early.variations.length,5);assert.equal(early.fullHighSpeedEnvelopeAccepted,false);
  let encountered=0;
  for(const v of early.variations){
   assert.equal(v.pass,true);assert.ok(v.postReleaseTicks>=150);assert.ok(v.maxGuardPenetration<.002);assert.deepEqual(v.solvedBefore,v.solvedAfter);
   for(const key of ['bodyPosition','bodyQuaternion','bodyVelocity','bodyAngularVelocity'])assert.deepEqual(v.release.before[key],v.release.after[key]);
   assert.equal(v.release.after.carryTarget,null);
   for(const [i,s] of v.samples.entries()){
    if(i)assert.equal(s.step,v.samples[i-1].step+1);
    assert.equal(s.compoundSweep.worldStep,s.step);assert.equal(s.compoundSweep.cannonContactEquationsAdded,0);
   }
   if(v.actualFreeGuardContactTicks||v.actualGuardCCDEvents.length){encountered++;assert.equal(v.guardTargetStatus,'GUARD_ENCOUNTER_OBSERVED');}
   else assert.equal(v.guardTargetStatus,'NOTREACHED/OPEN');
  }
  assert.ok(encountered>0,'At least one ordinary variation actually encounters the real fixed compound guards');
  const high=early.old22MetresPerSecondEnvelope;
  assert.equal(high.fullEnvelopeAccepted,false);
  if(high.maxReleaseSpeed<22-high.numericTolerance&&high.maxFreeSpeed<22-high.numericTolerance&&high.maxMeasuredGuardSpeed<22-high.numericTolerance)
   assert.equal(high.status,'NOTREACHED/OPEN','An unattained 22 m/s envelope remains open');
  console.log('Tower41 bounded adversarial coverage '+JSON.stringify({frames:report.frames,physicsTicks:report.physicsTicks,
   repeatedHeldTopContacts:report.repeatedHeldTopContacts,
   repeatedBoarding:{rounds:repeated.rounds.map(r=>({round:r.round,status:r.status,actualBoardedTicks:r.actualBoardedTicks,heldPositiveCargoRackContactTicks:r.heldPositiveCargoRackContactTicks,startTravel:r.startTravel,endTravel:r.endTravel})),retainedAdvance:repeated.retainedAdvance},
   earlyE:early.variations.map(v=>({name:v.name,releaseSpeed:v.release.before.bodySpeed,maxFreeSpeed:v.maxFreeSpeed,maxGuardPenetration:v.maxGuardPenetration,ccdCorrections:v.ccdCorrections,actualFreeGuardContactTicks:v.actualFreeGuardContactTicks,actualGuardCCDCount:v.actualGuardCCDEvents.length,actualGuardShapesEncountered:v.actualGuardShapesEncountered,guardTargetStatus:v.guardTargetStatus,actualRoofContactTicks:v.actualRoofContactTicks,actualRoofCCDCount:v.actualRoofCCDEvents.length,roofTargetStatus:v.roofTargetStatus})),
   old22MetresPerSecondEnvelope:high}));
 }finally{g.firstLevel?.dispose();g.physics?.dispose();g.portals?.dispose();}
});
