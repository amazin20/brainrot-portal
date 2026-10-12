import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createHookFixture} from '../room20-hook-prototype/tests/helpers/room20-hook-prototype-fixture.js';

const prototype = '/workspace/scratch/1949b02c22bb/room20-hook-prototype/src/game/LabRoom20NearHookPrototype.js';
const fingerprint = () => createHash('sha256').update(fs.readFileSync(prototype)).digest('hex');
const before = fingerprint(), cases = [];
for (const frequency of [0, 1, 5, 10, 15, 30, 60, 120]) {
 const f = createHookFixture();
 try {
  // Explicit UNIT setup: disconnected fixed-fairlead primitive; no ordinary
  // portal action or player route is claimed. Original remains on a real tray.
  f.cell.cutCable();f.step(240,{record:false});
  const initial = f.cell.diagnostics();
  let maxOpening = initial.opening,maxHookAngle = initial.hookAngle,firstHookWithdrawn=null;
  let signedHandWork=0,positiveHandWork=0,allImpulsesApplied=true;
  for(let tick=0;tick<3600;tick++){
   if(frequency&&tick%Math.round(120/frequency)===0){
    const h=f.cell.hookBody,omega=h.angularVelocity.z,impulse=f.cell.handAngularImpulse,previousCount=f.cell.diagnostics().handCount;
    const work=impulse*omega+impulse**2/(2*h.inertia.z);signedHandWork+=work;positiveHandWork+=Math.max(0,work);
    const applied=f.cell.hand();allImpulsesApplied&&=applied&&f.cell.diagnostics().handCount===previousCount+1;
   }
   f.step(1,{record:false});maxOpening=Math.max(maxOpening,f.cell.opening);maxHookAngle=Math.max(maxHookAngle,f.cell.hookAngle);
   if(firstHookWithdrawn===null&&f.cell.hookAngle>.8)firstHookWithdrawn=f.world.stepnumber;
  }
  const end=f.cell.diagnostics();
  cases.push({frequencyHz:frequency,durationSeconds:30,reachedLoadedState:initial.bearingContacts>0&&initial.bearingForce>1,initial:{worldStep:initial.worldStep,opening:initial.opening,hookAngle:initial.hookAngle,bearingForce:initial.bearingForce,bearingContacts:initial.bearingContacts,originalFree:initial.originalFree,tension:initial.tension,cableConnected:initial.cableConnected},allImpulsesApplied,handCount:end.handCount,signedHandWork,positiveHandWork,maxOpening,maxHookAngle,firstHookWithdrawn,end:{worldStep:end.worldStep,opening:end.opening,hookAngle:end.hookAngle,bearingForce:end.bearingForce,captureForce:end.captureForce,tension:end.tension,cargoPosition:end.cargoPosition,originalFree:end.originalFree,originalCargoBodyId:end.originalCargoBodyId,originalCargoShapeId:end.originalCargoShapeId},status:firstHookWithdrawn===null?'BOUNDED_LOADED_HAND_ATTACK_REJECTED':'HOOK_OVERRIDE_OBSERVED'});
 } finally {f.dispose();}
}
const after=fingerprint();
const report={schemaVersion:1,kind:'independent-near-hook-loaded-hand-rate-probe',scope:'Private unit actual Cannon120Hz; fixed-fairlead cable disconnected in fixture setup; original supported on actual tray; no portal, player, room completion or ordinary human-rate acceptance',prototypeSha256:before,prototypeSha256After:after,prototypeChangedDuringProbe:before!==after,sourceAccepted:false,ordinaryRouteAccepted:false,physicalDesignAccepted:false,allTestsActuallyReachedLoadedState:cases.every(c=>c.reachedLoadedState),anyHandInputIgnored:cases.some(c=>!c.allImpulsesApplied),cases};
const destination='/workspace/scratch/1949b02c22bb/room20-preparation/hook-independent-loaded-spam.json';
fs.writeFileSync(destination,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({destination,...report}));
