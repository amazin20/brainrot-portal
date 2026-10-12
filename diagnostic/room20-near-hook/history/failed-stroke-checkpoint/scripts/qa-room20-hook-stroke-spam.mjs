import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createHookFixture} from '../tests/helpers/room20-hook-prototype-fixture.js';
const paths=['src/game/LabRoom20NearHookPrototype.js','src/game/LabRoom20NearHookStrokePrototype.js','tests/helpers/room20-hook-prototype-fixture.js','scripts/qa-room20-hook-stroke-spam.mjs'];
const inputs=()=>paths.map(path=>{const b=fs.readFileSync(path);return{path,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')};});
const before=inputs(),cases=[];
for(const config of [{rate:15,batch:1},{rate:30,batch:1},{rate:60,batch:1},{rate:120,batch:1},{rate:60,batch:8},{rate:120,batch:8}]){
 const f=createHookFixture({strokeDrive:true}),samples=[];let error=null;
 try{f.cell.cutCable();f.step(240,{record:false});const initial=f.cell.diagnostics(),initialTray=f.traySupport();let maxOpening=initial.opening,maxAngle=initial.hookAngle,maxStroke=initial.drive.stroke,stopSteps=0,minTension=initial.tension,maxTension=initial.tension,applied=0;const period=120/config.rate;
  for(let n=0;n<3600;n+=config.batch){for(let j=0;j<config.batch;j++)if((n+j)%period===0){if(f.cell.hand())applied++;}f.step(config.batch,{record:false,frameSteps:config.batch});const d=f.cell.diagnostics();maxOpening=Math.max(maxOpening,d.opening);maxAngle=Math.max(maxAngle,d.hookAngle);maxStroke=Math.max(maxStroke,d.drive.stroke);minTension=Math.min(minTension,d.tension);maxTension=Math.max(maxTension,d.tension);if(d.drive.stopContacts>0)stopSteps++;if(n%120===0||n+config.batch===3600)samples.push({elapsedPhysicsSteps:n+config.batch,opening:d.opening,hookAngle:d.hookAngle,bearingForce:d.bearingForce,rawBearingForce:d.rawBearingForce,tension:d.tension,drive:d.drive,handCount:d.handCount,manualWork:d.manualWork});}
  const d=f.cell.diagnostics();cases.push({scope:'DIAGNOSTIC reached-state input-rate attack, no ordinary portal/player/human acceptance',...config,physicsSteps:f.world.stepnumber,actualE:applied,expectedE:3600/period,initialReached:initial.bearingForce>15&&initial.bearingContacts>0&&initial.originalFree&&initial.tension===0&&initialTray.contacts>0&&initialTray.normalForce>50&&initialTray.bodiesPresent,initial,initialTray,final:d,finalTray:f.traySupport(),maxOpening,maxHookAngle:maxAngle,maxDriverStroke:maxStroke,stopSampleSteps:stopSteps,minTension,maxTension,hookOverrideObserved:maxAngle>.7||maxOpening>.4,fullStrokeObserved:maxOpening>2.3,samples,error});
  console.log(JSON.stringify({rate:config.rate,batch:config.batch,E:applied,maxOpening,maxAngle,maxStroke,stopSteps,finalOpening:d.opening,tension:maxTension}));
 }catch(e){error={name:e.name,message:e.message,stack:e.stack};cases.push({config,error});}
 finally{f.dispose();}
}
const after=inputs(),output=process.env.OUT||'/workspace/scratch/1949b02c22bb/room20-preparation/hook-stroke-spam-attempt1.json';fs.writeFileSync(output,JSON.stringify({sourceAccepted:false,ordinaryAccepted:false,prototypeAccepted:false,runtimeObserved:true,sourceBefore:before,sourceAfter:after,sourceUnchanged:JSON.stringify(before)===JSON.stringify(after),cases},null,2));
