import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {room23PhysicalFixture} from '../tests/fixtures/room23-physical-fixture.js';

/** Reproducible declared-initial-state component experiment, not a campaign
 * route, native capture, publisher run or user acceptance artifact. */
const root=fileURLToPath(new URL('../',import.meta.url));
const out=path.resolve(process.argv[2]??path.join(root,'research','local-room23-review'));
fs.mkdirSync(out,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const sourcePaths=['src/game/LabPortalRoom23.js','src/game/LabRoom23PhysicalPrototype.js','src/game/LabRoom23PhysicalMachine.js','src/game/LabRoom23DynamicTraveller.js','tests/fixtures/room23-physical-fixture.js','tests/lab-room23-physical-prototype.test.js','research/room23-physical-prototype-reproduce.mjs','research/room23-docked-handoff-probe.mjs'];
const sourceFiles=sourcePaths.map(p=>{const b=fs.readFileSync(path.join(root,p));return{path:p,bytes:b.length,sha256:sha(b)};});
const cases=[
 {name:'east-original-west-passenger-positive',options:{},motor:true,clutch:true},
 {name:'east-original-west-passenger-no-motor',options:{},motor:false,clutch:true},
 {name:'east-original-west-passenger-open-clutch',options:{},motor:true,clutch:false},
 {name:'west-original-east-passenger-reverse-positive',options:{cargoSide:'west',passengerSide:'east',initialDisplacement:10},motor:true,clutch:true},
 {name:'west-original-east-passenger-reverse-no-motor',options:{cargoSide:'west',passengerSide:'east',initialDisplacement:10},motor:false,clutch:true}
];
const experiments=[];
for(const control of cases){
 const f=room23PhysicalFixture(control.options),m=f.machine,rows=[],original=f.original,shape=f.shape;
 let maxClockError=0,maxClutchPower=0,maxBrakePower=0,maxCableError=0,maxTorque=0,maxPower=0;
 try{
  m.requestMotorSupply(control.motor);const energyStart=m.energy();
  const capture=d=>{
   const force=d.lastForce;assert.ok(force);assert.equal(force.dt,1/120);if(force.worldStep>0)assert.equal(force.frictionContactStep,force.worldStep);
   assert.equal(d.ownershipValid,true);assert.equal(f.original,original);assert.equal(original.shapes[0],shape);assert.equal(original.mass,3.2);
   maxClockError=Math.max(maxClockError,Math.abs(d.worldStep-(force.worldStep+1)));maxCableError=Math.max(maxCableError,Math.abs(force.cableLengthError));
   maxTorque=Math.max(maxTorque,Math.abs(force.motorTorque));maxPower=Math.max(maxPower,force.motorPower);
   maxClutchPower=Math.max(maxClutchPower,d.clutchTorque*d.clutchSlipRate);
   maxBrakePower=Math.max(maxBrakePower,d.brakeTorque*m.drumBody.angularVelocity.x);
   assert.ok(Math.abs(d.clutchTorque)<=force.clutchCapacity+1e-5);assert.ok(Math.abs(d.brakeTorque)<=force.brakeCapacity+1e-5);
   rows.push({worldStep:d.worldStep,contactStep:d.contactStep,force,clutchTorque:d.clutchTorque,brakeTorque:d.brakeTorque,
    clutchSlipRate:d.clutchSlipRate,west:d.west,east:d.east,original:original.position.toArray(),originalVelocity:original.velocity.toArray(),
    passenger:f.game.playerPosition.toArray(),passengerVelocity:m.traveller.body.velocity.toArray(),traveller:m.traveller.diagnostics()});
  };
  f.step(3,capture);m.requestClutch(control.clutch);f.step(6,capture);const beforeRelease=m.diagnostics();m.requestBrake(false);f.step(12,capture);
  const d=m.diagnostics(),energyEnd=m.energy(),file=path.join(out,control.name+'.jsonl');
  fs.writeFileSync(file,[JSON.stringify({kind:'room23-actual-declared-component-journal',scope:f.scope,control,sourceFiles,
   originalBodyId:original.id,originalShapeId:shape.id,originalMass:3.2,passengerBodyId:m.traveller.body.id,passengerMass:50}),...rows.map(r=>JSON.stringify(r))].join('\n')+'\n');
  const raw=fs.readFileSync(file),deltaEnergy=energyEnd.total-energyStart.total,
   sourceWork=energyEnd.sourceWork-energyStart.sourceWork,recordedLosses=(energyEnd.recordedDragWork-energyStart.recordedDragWork)+(energyEnd.recordedClutchWork-energyStart.recordedClutchWork)+(energyEnd.recordedBrakeWork-energyStart.recordedBrakeWork);
  const positive=control.motor&&control.clutch;
  if(control.options.initialDisplacement===10){if(positive)assert.ok(d.east.y>19.99&&d.west.y<.01);else assert.ok(d.east.y<10.01&&d.west.y>9.99);}
  else{if(positive)assert.ok(d.west.y>9.99&&d.east.y<10.01);else assert.ok(d.west.y<.01&&d.east.y>19.99);}
  if(positive)assert.ok(d.motorWork>9126);if(!control.motor)assert.equal(d.motorWork,0);
  assert.equal(maxClockError,0);assert.ok(maxCableError<.005);assert.ok(maxPower<=1200+1e-8);assert.ok(maxTorque<=448+1e-8);
  experiments.push({name:control.name,initialConditions:control.options,scope:f.scope,normalPlay:false,fullOrdinaryRouteAccepted:false,
   physicsSteps:rows.length,seconds:rows.length/120,beforeRelease:{westY:beforeRelease.west.y,eastY:beforeRelease.east.y,clutchNormal:beforeRelease.clutchNormal,brakeNormal:beforeRelease.brakeNormal},
   terminal:{west:d.west,east:d.east,original:original.position.toArray(),passenger:f.game.playerPosition.toArray()},
   sourceWork:d.motorWork,actuatorWork:d.actuatorWork,energyStart,energyEnd,deltaEnergy,recordedSourceWork:sourceWork,recordedLosses,numericalAndUnrecordedContactResidual:deltaEnergy-sourceWork-recordedLosses,
   residualScope:'120 Hz rectangular work quadrature; normal impacts and generic contact friction are not silently claimed conservative',
   maxClockError,maxCableError,maxMotorPower:maxPower,maxMotorTorque:maxTorque,maxObservedPositiveClutchPower:maxClutchPower,maxObservedPositiveBrakePower:maxBrakePower,
   sameOriginal:true,originalMass:3.2,passengerMass:50,componentChecksPassed:true,
   journal:{path:file,bytes:raw.length,sha256:sha(raw),rows:rows.length,allBytesReadForHash:true}});
 }finally{f.dispose();}
}
const summary={kind:'room23-physical-component-reproduction',createdAt:new Date().toISOString(),baseCommit:'f4ede3632d82494c768f7cc4f03d596c698d3b3d',baseTree:'4de59ef15cb0aaa5fa773c34da418695c333de26',sourceFiles,
 experiments,componentChecksPassed:true,productionAccepted:false,sourceAccepted:false,publicAccepted:false,nativeAccepted:false,fullOrdinaryRouteAccepted:false,
 directLoadHandoffProved:false,ordinaryAuthoredRouteProved:false,playerPortalTransportImplemented:false};
const file=path.join(out,'component-reproduction.json');fs.writeFileSync(file,JSON.stringify(summary,null,2)+'\n');
const raw=fs.readFileSync(file);console.log(JSON.stringify({file,bytes:raw.length,sha256:sha(raw),experiments:experiments.map(e=>({name:e.name,sourceWork:e.sourceWork,westY:e.terminal.west.y,eastY:e.terminal.east.y,residual:e.numericalAndUnrecordedContactResidual}))}));
