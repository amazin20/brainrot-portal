import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createProductionBudgetFixture} from '../tests/helpers/room20-production-budget-fixture.js';

const revision='PRIVATE-BUDGET-C08-MIRROR-ATTEMPT1';
const output=path.resolve('diagnostic/room20-production-budget');
const inputs=['src/game/LabRoom20ProductionBudgetPrototype.js','src/game/LabRoom20ProductionBudgetSlipPrototype.js','tests/helpers/room20-production-budget-fixture.js','scripts/qa-room20-production-budget-c08.mjs'];
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const hashes=()=>inputs.map(p=>({path:p,sha256:sha(p)}));
const report={revision,scope:'Isolated actual solver budget experiment; fixed nominal portal fairlead points only. Production ledge, actual portals, player, far catch, broad aperture offsets and full room omitted.',sourceAccepted:false,ordinaryRoom20Accepted:false,prototypeAccepted:false,caseAccepted:false,closingBase:8,closingSlope:1.2,trainMass:8,gateDamping:1.1,handMagnitude:.7,handWorldAngularImpulse:-.7,torqueCeiling:4,inputsBefore:hashes(),stages:[],rateCases:[],unrun:[],failure:null};
const compact=d=>({worldStep:d.worldStep,contactStep:d.contactStep,opening:d.opening,hookAngle:d.hookAngle,bearingForce:d.bearingForce,bearingContacts:d.bearingContacts,bearingGeometryCurrent:d.bearingGeometryCurrent,captureForce:d.captureForce,captureContacts:d.captureContacts,tension:d.tension,stretch:d.stretch,originalFree:d.originalFree,cargoPosition:d.cargoPosition,gatePosition:d.gatePosition,hookPosition:d.hookPosition,hookQuaternion:d.hookQuaternion,cablePath:d.cablePath,lastCableForce:d.lastCableForce,cableWork:d.cableWork,handCount:d.handCount,lastHand:d.lastHand,slip:{lastForce:d.slip.lastForce,maxAbsTorque:d.slip.maxAbsTorque,maxTotalCouplingPower:d.slip.maxTotalCouplingPower,registryValid:d.slip.registryValid},ownedPartsValid:d.ownedPartsValid,bodiesPresent:d.bodiesPresent,constraintEquationCounts:d.constraintEquationCounts,motorEquationPresent:d.motorEquationPresent,motorEnabled:d.motorEnabled});
let fixture=null,stage='setup';
function snapshot(name,f){const row={name,diagnostics:compact(f.cell.diagnostics()),tray:f.traySupport(),bodyIds:[f.cell.gateBody,f.cell.hookBody,f.cell.driverBody,f.cargo,f.tray].map(b=>b.id),shapeIds:[f.cargo.shapes[0].id,f.tray.shapes[0].id],maxBearingDepth:f.raw.maxBearingDepth,maxHingeDrift:f.raw.maxHingeDrift};report.stages.push(row);return row.diagnostics;}
try{
 fixture=createProductionBudgetFixture({closingBase:8});
 stage='initial640-real-loaded-tray';fixture.step(640);const loaded=snapshot(stage,fixture);
 assert.ok(loaded.originalFree&&loaded.bearingGeometryCurrent&&loaded.bearingContacts>0&&loaded.bearingForce>7,'C08 actual closed face must carry its return load');
 assert.ok(fixture.traySupport().normalForce>50&&fixture.traySupport().contacts>0,'The same original cargo must be supported by the real tray');
 assert.equal(loaded.tension,0,'Initial original gravity is supported; current near/far spans are genuinely slack');
 assert.ok(loaded.slip.registryValid&&loaded.ownedPartsValid&&loaded.bodiesPresent,'All exact body/shape/hinge ownership guards must be live');
 assert.deepEqual(loaded.constraintEquationCounts,[5,5]);assert.deepEqual(loaded.motorEnabled,[false,false]);assert.deepEqual(loaded.motorEquationPresent,[false,false]);
 stage='same-finite-E-under-loaded-bearing';assert.equal(fixture.cell.hand(),true);const hand=fixture.cell.diagnostics().lastHand;
 assert.ok(Math.abs(hand.driverAngularMomentumAfter-hand.driverAngularMomentumBefore+.7)<1e-8,'Mirrored finite E must apply actual −.7Nms to the rotor');
 const start=fixture.trace.length;fixture.step(240);const held=snapshot(stage,fixture),after=fixture.trace.slice(start);
 const firstOverride=after.find(d=>d.opening>=.005||d.hookAngle>=.01);
 report.loadedInputWitness={hand,maxOpening:Math.max(...after.map(d=>d.opening)),maxHookAngle:Math.max(...after.map(d=>d.hookAngle)),firstOverride:firstOverride?compact(firstOverride):null,allIntervalsZeroTraction:after.every(d=>d.tension===0),requestedInputs:1,actualInputs:held.handCount};
 assert.equal(firstOverride,undefined,'C08 same finite E must remain blocked under genuine bearing load without original traction');
 assert.ok(held.bearingForce>7,'Loaded original hand input must preserve real near bearing');
 stage='real-tray-withdrawal-and-original-gravity-relief';fixture.releaseTray();fixture.step(600);const relieved=snapshot(stage,fixture);
 assert.equal(fixture.traySupport().contacts,0);assert.ok(relieved.originalFree&&relieved.tension>40);assert.ok(relieved.opening>.59&&relieved.opening<.66);assert.equal(relieved.bearingForce,0);assert.ok(relieved.captureForce>15&&relieved.captureContacts>0);
 stage='identical-E-after-real-relief';assert.equal(fixture.cell.hand(),true);assert.ok(Math.abs(fixture.cell.diagnostics().lastHand.angularImpulse+.7)<1e-12);
 const opens=fixture.until(()=>fixture.cell.diagnostics().opening>7.19,2400);const opened=snapshot(stage,fixture);assert.ok(opens&&opened.hookAngle>2.7,'Identical physical E must release the hook; actual cable must drive the nominal full stroke');
 stage='actual-cable-cut-and-return';fixture.cell.cutCable();fixture.step(1800);const returned=snapshot(stage,fixture);assert.ok(Math.abs(returned.opening+.05)<.005&&returned.tension===0,'Cable loss must permit actual passive return to the founded seat');
 assert.ok(fixture.raw.maxBearingDepth<.005&&fixture.raw.maxHingeDrift<.005);assert.ok(returned.slip.maxTotalCouplingPower<=1e-10);
 report.causalUnitPassed=true;
 fs.writeFileSync(path.join(output,'c08-causal-actual-trace.json'),JSON.stringify(fixture.trace.map(compact),null,2)+'\n');
 fixture.dispose();fixture=null;
 for(const rate of [30,120]){
  stage=`reached-zero-original-traction-${rate}Hz`;fixture=createProductionBudgetFixture({closingBase:8});fixture.cell.cutCable();fixture.step(640,{record:false});const initial=compact(fixture.cell.diagnostics()),tray=fixture.traySupport();assert.ok(initial.bearingForce>7&&tray.normalForce>50&&initial.tension===0);
  const periods=120/rate;let requests=0,maxOpening=initial.opening,maxHookAngle=initial.hookAngle;
  for(let i=0;i<3600;i++){if(i%periods===0){assert.equal(fixture.cell.hand(),true);requests++;}fixture.step(1,{record:false});const d=fixture.cell.diagnostics();maxOpening=Math.max(maxOpening,d.opening);maxHookAngle=Math.max(maxHookAngle,d.hookAngle);assert.equal(d.tension,0);if(d.opening>=.005||d.hookAngle>=.01){report.rateCases.push({rate,initial,tray,requests,actualInputs:d.handCount,actualIntervals:i+1,maxOpening,maxHookAngle,firstOverride:compact(d),passed:false});assert.fail('Actual reached loaded input cadence overrides the C08 bearing');}}
  report.rateCases.push({rate,initial,tray,requests,actualIntervals:3600,actualInputs:fixture.cell.diagnostics().handCount,maxOpening,maxHookAngle,final:compact(fixture.cell.diagnostics()),passed:true});fixture.dispose();fixture=null;
 }
 report.caseAccepted=true;
}catch(error){
 report.failure={stage,name:error.name,message:error.message};report.caseAccepted=false;report.unrun=['Any later causal stages or rate cases after the first failure','No C0 retuning or second candidate','No ordinary/full-room/source acceptance'];
 if(fixture){report.failure.actualFinal=compact(fixture.cell.diagnostics());report.failure.actualTray=fixture.traySupport();fs.writeFileSync(path.join(output,'c08-failed-actual-trace.json'),JSON.stringify(fixture.trace.map(compact),null,2)+'\n');}
 process.exitCode=1;
}finally{
 if(fixture)fixture.dispose();report.inputsAfter=hashes();report.inputsUnchanged=JSON.stringify(report.inputsBefore)===JSON.stringify(report.inputsAfter);fs.writeFileSync(path.join(output,'c08-actual-result.json'),JSON.stringify(report,null,2)+'\n');
 console.info('ROOM20_PRODUCTION_BUDGET_C08',JSON.stringify({revision,caseAccepted:report.caseAccepted,causalUnitPassed:report.causalUnitPassed??false,failure:report.failure?{stage:report.failure.stage,message:report.failure.message}:null,rateCases:report.rateCases.map(r=>({rate:r.rate,passed:r.passed,requests:r.requests,actualIntervals:r.actualIntervals})),inputsUnchanged:report.inputsUnchanged,sourceAccepted:false,ordinaryRoom20Accepted:false,prototypeAccepted:false}));
}
