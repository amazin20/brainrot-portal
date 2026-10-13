import {actualBox,observeLoad,runTower41RatchetCellCycle,runTower41RatchetHeldContact} from './LabTower41RatchetCellJourney.js';
import {orientedBoxSupport} from './LabOrientedBoxContact.js';

// All poses below are observations. Only the driver's ordinary movement,
// sprint, jump and E input surface controls the original production actors.
function positions(d){
 const tray=actualBox(d.cell.rack,0),front=tray.centre[2]+tray.half.reduce((n,h,i)=>n+h*Math.abs(tray.axes[i][2]),0);
 const radius=d.game.physics.playerProxy.body.shapes.find(s=>Number.isFinite(s.radius)).radius;
 return {loader:[d.cell.centre.x,d.cell.centre.y,front+radius+.02],clear:[d.cell.centre.x,d.cell.centre.y,front+radius+1.02]};
}

function trayWitness(d){
 const {game:g,cell}=d,s=orientedBoxSupport(cell.rackParts[0].collider.orientedBox,g.playerPosition.x,g.playerPosition.z,g.playerPosition.y+.02);
 return s?{height:s.height,normal:s.normal.toArray(),bodyId:cell.rack.id,shapeId:cell.rack.shapes[0].id,
  boarded:Boolean(g.playerGrounded&&g.playerPosition.y>cell.centre.y+.1&&Math.abs(g.playerPosition.y-s.height)<.015&&s.normal.y>.5)}:null;
}

function cargoRackContacts(d,phase){
 const cargo=d.originalBody.id,rack=d.cell.rack.id;
 return phase.contacts.filter(c=>(c.bodyA===cargo&&c.bodyB===rack)||(c.bodyB===cargo&&c.bodyA===rack));
}

export async function runTower41RatchetRepeatedBoarding(d,{rounds=5}={}){
 const {game:g,cell,originalCargo:cargo}=d;
 const result={kind:'ordinary repeated tray boarding',rounds:[],allTargetsReached:true,fullBoardingResistanceAccepted:false};
 for(let round=0;round<rounds;round++){
  await d.walk(positions(d).clear,{sprint:false,tolerance:.06});
  await d.walk(positions(d).loader,{sprint:false,tolerance:.04});await d.wait(.35);
  const start=d.snapshot(),solvedBefore=d.level.getTowerMetrics().solvedIds.slice(),samples=[],actionStart=d.report.actions.length;
  d.phase('repeated actual tray boarding '+(round+1));
  d.setTickObserver(snapshot=>{
   const support=trayWitness(d);samples.push({step:snapshot.step,frame:snapshot.frame,player:snapshot.player,grounded:snapshot.grounded,held:snapshot.held,support});
   d.check(g.heldCube===cargo,'Repeated boarding silently changed the original grip');
  });
  try{
   g.input.keys.add('ShiftLeft');d.worldMove(0,-1);await d.jump();
   for(let frame=0;frame<80;frame++){d.worldMove(0,-1);await d.frame();}
   d.stop();await d.wait(.5);
  }finally{d.setTickObserver(null);}
  const phase=d.report.phases.at(-1),contacts=cargoRackContacts(d,phase);
  await d.walk(positions(d).clear,{sprint:false,tolerance:.06});await d.wait(2);
  const actualBoardedTicks=samples.filter(s=>s.support?.boarded).length,solvedAfter=d.level.getTowerMetrics().solvedIds.slice();
  const record={round:round+1,status:actualBoardedTicks?'ACTUAL_TRAY_BOARDING_OBSERVED':'NOTREACHED/OPEN',actualBoardedTicks,
   actualTrayBodyId:cell.rack.id,actualTrayShapeId:cell.rack.shapes[0].id,startTravel:start.cell.rack.travel,endTravel:cell.diagnostics().rack.travel,
   heldPositiveCargoRackContactTicks:contacts.reduce((n,c)=>n+c.heldPositiveContactTicks,0),heldNormalImpulse:contacts.reduce((n,c)=>n+c.normalImpulse,0),
   maxCargoRackPenetration:Math.max(0,...contacts.map(c=>c.maxPenetration)),solvedBefore,solvedAfter,
   ECommands:d.report.actions.slice(actionStart).filter(a=>a.kind==='E').length,samples};
  d.check(JSON.stringify(solvedAfter)===JSON.stringify(solvedBefore),'Repeated tray boarding changed unrelated solved mechanisms');
  result.rounds.push(record);result.allTargetsReached&&=actualBoardedTicks>0;
  d.mark('Repeated boarding '+(round+1)+' withdrawn');
 }
 result.startTravel=result.rounds[0].startTravel;result.endTravel=result.rounds.at(-1).endTravel;result.retainedAdvance=result.endTravel-result.startTravel;
 result.totalActualBoardedTicks=result.rounds.reduce((n,r)=>n+r.actualBoardedTicks,0);
 result.limitation='Five actual supported jumps/contacts and withdrawals with the original cargo continuously held. Retained travel is reported as a finding; this does not establish resistance to arbitrary servo-pressure trajectories.';
 d.report.repeatedBoarding=result;
}

export async function runTower41RatchetRepeatedHeldContact(d,{rounds=3}={}){
 const contacts=[];
 for(let i=0;i<rounds;i++){
  await runTower41RatchetHeldContact(d);contacts.push({round:i+1,...d.report.heldContact});
 }
 d.report.repeatedHeldTopContacts={rounds:contacts,fullServoResistanceAccepted:false,
  retainedAdvance:contacts.at(-1).endRetainedTravel-contacts[0].startRetainedTravel,
  limitation:'Three reached held top-face contacts with actual positive Cannon impulses, followed by withdrawal and settled retention measurements. Arbitrary servo trajectories remain open.'};
}

const RELEASE_VARIATIONS=[
 {name:'immediate sprint jump-buffer E',releaseAfterFrames:1,moves:[[0,-1]]},
 {name:'ascending sprint E',releaseAfterFrames:5,moves:[[0,-1]]},
 {name:'sprint lateral reversal E',releaseAfterFrames:11,moves:[[0,-1],[1,0],[-1,0]]},
 {name:'late roof approach E',releaseAfterFrames:22,moves:[[0,-1]]},
 {name:'diagonal roof reversal E',releaseAfterFrames:20,moves:[[.7,-.7],[-.7,-.7]]},
];

export async function runTower41RatchetEarlyEVariations(d){
 const {game:g,cell,originalCargo:cargo}=d,variations=[];
 for(const config of RELEASE_VARIATIONS){
  if(g.heldCube!==cargo)await d.pickup();
  await d.walk(positions(d).clear,{sprint:false,tolerance:.06});
  await d.walk(positions(d).loader,{sprint:false,tolerance:.04});await d.wait(.35);
  d.phase(config.name);const solvedBefore=d.level.getTowerMetrics().solvedIds.slice(),phase=d.report.phases.at(-1),beforeCorrections=g.physics.compoundCargoSweepCorrections??0;
  let release=null,lastStep=g.physics.world.stepnumber;const samples=[],nativeRelease=g.physics.release;
  d.setTickObserver(()=>{
   const sample=observeLoad(d,'completed production tick'),sweep=g.physics.lastCompoundCargoSweep;
   d.check(sample.step===lastStep+1,'An adversarial release trace skipped a real physics tick');lastStep=sample.step;
   sample.compoundSweep=sweep?{worldStep:sweep.worldStep,corrections:sweep.corrections.map(c=>({...c})),maxResidualPenetration:sweep.maxResidualPenetration,
    beforeCorrection:sweep.beforeCorrection,afterCorrection:sweep.afterCorrection,
    budgetFallback:Boolean(sweep.budgetFallback),velocityConstraintFallback:Boolean(sweep.velocityConstraintFallback),cannonContactEquationsAdded:sweep.cannonContactEquationsAdded}:null;
   if(sweep)d.check(sweep.worldStep===sample.step,'The compound sweep is not paired with this completed tick');
   samples.push(sample);
  });
  g.physics.release=function(...args){release={before:observeLoad(d,'before native E')};const result=nativeRelease.apply(this,args);release.after=observeLoad(d,'after native E');return result;};
  try{
   g.input.keys.add('ShiftLeft');d.worldMove(...config.moves[0]);await d.jump();
   for(let frame=1;frame<config.releaseAfterFrames;frame++){
    const move=config.moves[Math.min(config.moves.length-1,Math.floor(frame/config.releaseAfterFrames*config.moves.length))];
    d.worldMove(...move);await d.frame();
   }
   d.check(await d.interact()&&g.heldCube!==cargo,'The varied early E did not release the original cargo');
   for(let frame=0;frame<74;frame++){d.stop();await d.frame();}
  }finally{g.physics.release=nativeRelease;d.setTickObserver(null);}
  d.check(release,'The native release observer did not run');
  for(const property of ['bodyPosition','bodyQuaternion','bodyVelocity','bodyAngularVelocity'])
   d.check(JSON.stringify(release.before[property])===JSON.stringify(release.after[property]),'E rewrote measured '+property);
  d.check(release.after.carryTarget===null,'Native E retained the hand target');
  const free=samples.filter(s=>!s.held),maxFreeSpeed=Math.max(0,...free.map(s=>s.bodySpeed)),maxObservedSpeed=Math.max(0,...samples.map(s=>s.bodySpeed));
  const maxGuardPenetration=Math.max(0,...free.flatMap(s=>s.guards.map(guard=>guard.penetration)));
  const guardContacts=phase.contacts.filter(c=>c.freeCargoTicks>0&&((c.bodyA===d.originalBody.id&&c.bodyB===cell.stops.id)||(c.bodyB===d.originalBody.id&&c.bodyA===cell.stops.id)));
  const corrections=(g.physics.compoundCargoSweepCorrections??0)-beforeCorrections,actualGuardTicks=guardContacts.reduce((n,c)=>n+c.freeCargoTicks,0);
  const actualGuardCCDEvents=free.flatMap(s=>s.compoundSweep?.corrections??[]).filter(c=>c.guardBodyId===cell.stops.id);
  const roofShapeId=cell.stops.shapes[cell.stopParts.findIndex(p=>p.half.y===.125&&p.offset.y===2.925)].id;
  const actualRoofContactTicks=guardContacts.filter(c=>c.shapeA===roofShapeId||c.shapeB===roofShapeId).reduce((n,c)=>n+c.freeCargoTicks,0);
  const actualRoofCCDEvents=actualGuardCCDEvents.filter(c=>c.shapeId===roofShapeId);
  const actualGuardCCDWitnesses=free.filter(s=>s.compoundSweep?.corrections.some(c=>c.guardBodyId===cell.stops.id)).map(s=>({step:s.step,
   beforeCCDSpeed:Math.hypot(...s.compoundSweep.beforeCorrection.velocity),afterProductionSpeed:s.bodySpeed,
   shapeIndices:[...new Set(s.compoundSweep.corrections.filter(c=>c.guardBodyId===cell.stops.id).map(c=>c.shapeIndex))]}));
  const solvedAfter=d.level.getTowerMetrics().solvedIds.slice();
  const variation={...config,release,samples,postReleaseTicks:free.length,maxFreeSpeed,maxObservedSpeed,maxGuardPenetration,ccdCorrections:corrections,
   actualFreeGuardContactTicks:actualGuardTicks,actualGuardCCDEvents,actualGuardCCDWitnesses,
   actualGuardShapesEncountered:[...new Set([...guardContacts.flatMap(c=>[c.shapeA,c.shapeB]).filter(id=>cell.stops.shapes.some(s=>s.id===id)),...actualGuardCCDEvents.map(c=>c.shapeId)])].map(id=>({shapeId:id,name:cell.stopParts[cell.stops.shapes.findIndex(s=>s.id===id)].mesh.name})),
   guardTargetStatus:actualGuardTicks||actualGuardCCDEvents.length?'GUARD_ENCOUNTER_OBSERVED':'NOTREACHED/OPEN',
   roofShapeId,actualRoofContactTicks,actualRoofCCDEvents,roofTargetStatus:actualRoofContactTicks||actualRoofCCDEvents.length?'ROOF_ENCOUNTER_OBSERVED':'NOTREACHED/OPEN',
   solvedBefore,solvedAfter,pass:maxGuardPenetration<.002};
  variations.push(variation);
  d.check(variation.pass,'A reachable early-E variation penetrated a real compound safety guard: '+config.name);
  d.check(JSON.stringify(solvedBefore)===JSON.stringify(solvedAfter),'A varied local E completed an unrelated castle mechanism');
  await d.pickup();await d.walk(positions(d).clear,{sprint:false,tolerance:.06});await d.wait(.4);
 }
 const releaseSpeed=Math.max(...variations.map(v=>v.release.before.bodySpeed)),maxFreeSpeed=Math.max(...variations.map(v=>v.maxFreeSpeed));
 const numericTolerance=1e-6,maxMeasuredGuardSpeed=Math.max(0,...variations.flatMap(v=>v.actualGuardCCDWitnesses.map(w=>w.beforeCCDSpeed)));
 d.report.earlyEVariations={variations,allReleasesPreserveOriginalMomentum:true,maxReleaseSpeed:releaseSpeed,maxFreeSpeed,
  old22MetresPerSecondEnvelope:{threshold:22,numericTolerance,status:maxMeasuredGuardSpeed>=22-numericTolerance?'ACTUAL_GUARD_CCD_SPEED_REACHED':releaseSpeed>=22-numericTolerance?'RELEASE_SPEED_REACHED':maxFreeSpeed>=22-numericTolerance?'FREE_SPEED_REACHED':'NOTREACHED/OPEN',
   maxReleaseSpeed:releaseSpeed,maxFreeSpeed,maxMeasuredGuardSpeed,fullEnvelopeAccepted:false,
   limitation:'The test does not inject the historical 22 m/s body velocity. It measures only momentum actually attained by these sprint/jump/reversal/E inputs.'},
  fullHighSpeedEnvelopeAccepted:false};
}

export async function runTower41RatchetAdversarialJourney(d){
 await runTower41RatchetCellCycle(d);
 await runTower41RatchetRepeatedHeldContact(d);
 await runTower41RatchetRepeatedBoarding(d);
 await runTower41RatchetEarlyEVariations(d);
}
