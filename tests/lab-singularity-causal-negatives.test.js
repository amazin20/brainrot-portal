import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runSingularityCausalNegativeJourney} from '../src/game/LabSingularityCausalNegativeJourney.js';

async function execute(scenario){
 const game=await createHeadlessGame();
 try{game.chamberEdition='foundation';await game.selectLevel(40,true);return await runSingularityCausalNegativeJourney(game,{scenario});}
 finally{game.firstLevel?.dispose();game.physics?.dispose();game.portals?.dispose();}
}
function assertOrdinary(report){
 assert.equal(report.sameCargo,true);assert.equal(report.observersRestored,true);assert.equal(report.resets+report.respawns+report.cargoResets,0);
 assert.ok(report.routePrefix.partial);assert.ok(report.inputAttackStarted,'The attack itself must actually begin');
 assert.equal(report.fullBypassResistanceAccepted,false);assert.notEqual(report.status,'NOTREACHED/OPEN',JSON.stringify(report.failure));
 assert.notEqual(report.status,'BYPASS_OBSERVED',JSON.stringify(report.finish));
}
function logEvidence(label,report){
 // Keep each structured TAP record below Node's pipe-chunk boundary. The
 // complete ordinary prefix remains in memory for assertions; its repeated
 // per-walk snapshots do not add causal evidence to this omitted-step proof.
 const{routePrefix,actions,...evidence}=report;
 const prefix={partial:routePrefix?.partial,physicsSteps:routePrefix?.physicsSteps,seconds:routePrefix?.seconds,resets:routePrefix?.resets,respawns:routePrefix?.respawns,cargoResets:routePrefix?.cargoResets,sameCompanion:routePrefix?.sameCompanion,metrics:routePrefix?.metrics};
 const text=JSON.stringify({...evidence,routePrefix:prefix,actions:actions.filter(a=>a.kind!=='walk'),walkTargets:actions.filter(a=>a.kind==='walk').map(a=>({target:a.target,startFrame:a.start.frame}))});
 assert.ok(Buffer.byteLength(text)<60000,'Structured causal proof must remain one independently parseable TAP record');
 console.log(label+' '+text);
}

test('Tower41 real roof/south-slit attack encounters the archive boundary after live hydraulic/optical release without either wall control',{timeout:300000},async()=>{
 const report=await execute('archive-roof-without-controls');
 logEvidence('Tower41 archive ordinary causal omission',report);
 assertOrdinary(report);assert.equal(report.pass,true);assert.equal(report.status,'ARCHIVE_BOUNDARY_REJECTED');
 const a=report.archive;assert.equal(a.availabilityBeforeAttack.released,true);assert.equal(a.availabilityBeforeAttack.readsAchievements,false);
 assert.ok(a.availabilityBeforeAttack.hydraulic.retainingNotch>0&&a.availabilityBeforeAttack.optical.retainingNotch>0);
 assert.deepEqual(a.controlsBefore,{A:false,B:false});assert.deepEqual(a.controlsAfter,{A:false,B:false});
 assert.equal(a.boundaryEncountered,true);assert.ok(a.roofSupportedTicks+a.southApertureApproachTicks>0);assert.ok(a.attackPhysicsSteps>0);
 assert.equal(a.stoppedByPhysicalCollision,true);assert.equal(a.receivingPlateReached,false);assert.ok(!report.metrics.solvedIds.includes('archive'));
 assert.ok(a.blockingGeometry.some(c=>c.enabled&&c.staticRegistryPresent&&Math.abs(c.horizontalCapsuleGap)<.002),'The observed stopping point touches an actual enabled registered blocking box');
 assert.ok(report.samples.every(s=>!s.A&&!s.B&&s.availability.released));
 assert.equal(report.actions.filter(a=>a.kind==='E'&&a.id.startsWith('archive:')).length,0);
});

test('Tower41 actual correctly geared engaged unclamped speed-band shaft runs over two seconds while the original free cargo stays outside its physical tray and cannot solve',{timeout:300000},async()=>{
 const report=await execute('flywheel-without-load');
 logEvidence('Tower41 flywheel ordinary causal omission',report);
 assertOrdinary(report);assert.equal(report.pass,true);assert.equal(report.status,'LOAD_OMISSION_REJECTED');
 const f=report.flywheel;assert.ok(f.maxConsecutiveOtherConditionsTicks>240,'At least 241 consecutive actual in-band physics steps isolate only the omitted original load');
 assert.equal(f.actualTrayContactTicks,0);assert.equal(f.positiveTrayNormalImpulse,0);
 assert.ok(report.prefixCargoSupportObservations.some(s=>s.bodyId===report.originalCargoBodyId&&s.free&&s.contacts.every(c=>c.enabled&&c.normalForce>0)),'The actual original free cargo has a positive ordinary support contact witness');
 assert.ok(f.originalCargoSupportedTicks+f.sleepingGroundedCargoTicks>0,'The original cargo remains supported; sleeping support is recorded separately from fresh contacts');
 assert.equal(f.crankCountAfter-f.crankCountBefore,5);assert.equal(f.finish.ratio,1);assert.equal(f.finish.clutch,true);assert.equal(f.finish.brake,false);
 assert.equal(f.finish.loadContact,false);assert.equal(f.finish.readyForProof,false);assert.equal(f.finish.loadWork,0);
 assert.ok(!report.metrics.solvedIds.includes('flywheel'));assert.deepEqual(report.routePrefix.metrics.solvedIds,['sluice','optics','archive']);
 const qualified=report.samples.filter(s=>s.cell.output>4.9&&s.cell.output<6.1);
 assert.ok(qualified.length>=8);for(const sample of qualified){assert.equal(sample.cell.worldStep,sample.worldStep);assert.equal(sample.cell.contactStep,sample.worldStep);assert.equal(sample.cell.ratio,1);assert.equal(sample.cell.ratioValue,2/3);assert.equal(sample.cell.clutch,true);assert.equal(sample.cell.brake,false);assert.equal(sample.cell.loadContact,false);assert.equal(sample.cell.loadNormalForce,0);assert.equal(sample.outsideTray,true);assert.equal(sample.held,false);assert.equal(sample.cell.originalCargoBodyId,report.originalCargoBodyId);}
});
