import fs from 'node:fs';
import crypto from 'node:crypto';
import {createRoom35CapstanCell} from '../src/game/LabRoom35CapstanCell.js';
import {LabPhysics} from '../src/game/LabPhysics.js';
const output=process.argv[2]??'/tmp/brainrot-room35-capstan-120hz.json',HZ=120;
const report={scope:'assetless120Hz mechanics component using the original LabPhysics step; not a full-game route, owned-shape CCD/query coverage or exact-energy claim',source:{},ordinary:[],unpowered:[],surrogate:null};
for(const file of ['LabRoom35CapstanGeometry.js','LabRoom35CapstanCell.js','LabPhysics.js'])report.source[file]=crypto.createHash('sha256').update(fs.readFileSync(new URL('../src/game/'+file,import.meta.url))).digest('hex');
report.source['qa-room35-capstan-120hz.mjs']=crypto.createHash('sha256').update(fs.readFileSync(new URL(import.meta.url))).digest('hex');
function actualCell(options={}){
 const physics=new LabPhysics(),body=physics.createCargo({position:[-18,6.39,16],size:.78,mass:3.2}),shape=body.shapes[0];
 const settings=()=>JSON.stringify({iterations:physics.world.solver.iterations,tolerance:physics.world.solver.tolerance,contact:{...physics.world.defaultContactMaterial}});
 const before=settings(),c=createRoom35CapstanCell({world:physics.world,cargoBody:body,dt:1/HZ,...options}),dispose=c.dispose;
 const originalMaterial=body.material,ownerStep=physics.step,worldStep=physics.world.step;
 c.binding={scope:'Actual LabPhysics world, original cargo body/shape/material and original owner step; assetless native fixture position',bodyId:body.id,shapeId:shape.id,defaultsUnchangedOnCreate:before===settings(),preparedSteps:0,finishedSteps:0};
 c.advance=(count=1)=>{
  for(let n=0;n<count;n++)try{
   c.prepareStep(physics.fixedStep);c.binding.preparedSteps++;
   physics.step(physics.fixedStep);
   c.finishStep();c.binding.finishedSteps++;
  }catch(error){
   report.executionFailure={message:String(error?.stack??error),worldStep:physics.world.stepnumber,ownerSteps:physics.steps,binding:{...c.binding},diagnostics:c.diagnostics()};save();throw error;
  }
  return c.diagnostics();
 };
 c.dispose=()=>{dispose();c.binding.originalRetainedBeforeFixtureTeardown=physics.cargoBody===body&&body.shapes[0]===shape&&body.material===originalMaterial&&body.world===physics.world&&physics.world.bodies.includes(body);c.binding.defaultsUnchangedOnDispose=before===settings();c.binding.originalStepMethodsRetained=physics.step===ownerStep&&physics.world.step===worldStep;c.binding.worldSteps=physics.world.stepnumber;c.binding.ownerSteps=physics.steps;physics.dispose();};
 return c;
}
function save(){fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');}
for(const theta of [.35,4.8]){
 const c=actualCell({theta});try{
  c.advance(3*HZ);const before=c.diagnostics();c.control.pressed=true;c.advance(14*HZ);const wound=c.diagnostics(),work=c.ledger.manualWork;
  c.control.position=[20,6,22];c.advance(8*HZ);const after=c.diagnostics();
  report.ordinary.push({theta,binding:c.binding,before,wound,after,workAfterDeparture:c.ledger.manualWork-work,
   observedExpectedBehavior:theta<1?after.angle<-.7:after.angle>-.02});
 }finally{c.dispose();}save();
}
for(const protocol of ['continuous-readdress','cut-and-rethread']){
 const c=actualCell();try{
  const short=c.guide.portalAt(.35),long=c.guide.portalAt(4.8);let previousTaut=false,captures=0,slackReturns=0,accepted=0,rejected=0;
  const observe=()=>{const d=c.diagnostics(),taut=d.tensions.leftTension>1e-7&&d.tensions.rightTension>1e-7;if(taut&&!previousTaut)captures++;if(!taut&&previousTaut)slackReturns++;previousTaut=taut;};
  for(let i=0;i<1000;i++){
   if(protocol==='cut-and-rethread'){c.setPortal(null);c.advance();observe();}
   if(c.setPortal(i%2?short:long))accepted++;else rejected++;
   for(let n=0;n<5;n++){c.advance();observe();}
  }
  c.advance(5*HZ);const final=c.diagnostics();
  report.unpowered.push({protocol,binding:c.binding,cycles:1000,accepted,rejected,actualSlackCaptures:captures,actualTautToSlack:slackReturns,final,
   horizontalBarrierToWorstGain:final.ledger.maxResidual?final.energyBarriers[1].minimumNetExternalWork/final.ledger.maxResidual:null,
   evenMinusHalfRadianBarrierToWorstGain:final.ledger.maxResidual?final.energyBarriers[0].minimumNetExternalWork/final.ledger.maxResidual:null,
   observedNoOpen:final.maxAngle<-.5,observedNoManualSource:final.manualApplications===0&&final.ledger.manualWork===0});
 }finally{c.dispose();}save();
}
{
 const c=actualCell();try{
  c.advance(3*HZ);c.control.pressed=true;c.advance(14*HZ);const wound=c.diagnostics(),surrogate=c.addContactSurrogate();c.control.position=[20,6,22];
  let maxContactForce=0,maxContacts=0;for(let n=0;n<8*HZ;n++){c.advance();const p=c.diagnostics().surrogateContacts[0];maxContactForce=Math.max(maxContactForce,p.normalForce);maxContacts=Math.max(maxContacts,p.contacts);}
  report.surrogate={label:'Separate3.2kg dynamic contact fixture; real game avatar remains mass0',binding:c.binding,wound,bodyId:surrogate.id,maxContactForce,maxContacts,final:c.diagnostics()};
 }finally{c.dispose();}save();
}
report.peakRssBytes=process.resourceUsage().maxRSS*1024;save();
console.log(JSON.stringify({output,peakRssBytes:report.peakRssBytes,ordinary:report.ordinary.map(r=>({theta:r.theta,angle:r.after.angle,workAfterDeparture:r.workAfterDeparture})),
 unpowered:report.unpowered.map(r=>({protocol:r.protocol,accepted:r.accepted,captures:r.actualSlackCaptures,maxAngle:r.final.maxAngle,maxResidual:r.final.ledger.maxResidual,netHorizontalBarrier:r.final.energyBarriers[1].minimumNetExternalWork})),
 surrogate:{angle:report.surrogate.final.angle,contacts:report.surrogate.final.surrogateContacts,maxContactForce:report.surrogate.maxContactForce}}));
