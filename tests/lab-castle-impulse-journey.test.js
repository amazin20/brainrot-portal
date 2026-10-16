import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runSingularityJourney} from '../src/game/LabSingularityJourney.js';
import {assertCastleImpulsePhysicalProof} from '../scripts/lib/castle-impulse-native-proof.mjs';

const oldOrder=['freight','sluice','optics','hoist','archive','flywheel','magnet','migrant','pendulum','inertia','crown'];
const after=id=>{const order=[...oldOrder];order.splice(order.indexOf(id)+1,0,'impulse');return order;};
const cases=[
 {name:'the default late impulse branch',order:undefined,expected:after('inertia'),hubY:36},
 {name:'the impulse branch immediately after the hoist',order:after('hoist'),expected:after('hoist'),hubY:18},
 {name:'the impulse branch immediately after the magnetic transfer',order:after('magnet'),expected:after('magnet'),hubY:36},
];

for(const scenario of cases)test(`One untouched ordinary-input castle attempt wins with ${scenario.name}`,{timeout:1200000},async()=>{
 const game=await createHeadlessGame();game.chamberEdition='foundation';await game.selectLevel(40,true);
 const original=game.cargo,body=game.physics.cargoBody,shape=body.shapes[0],samples={};
 const cell=game.firstLevel.machines.get('impulse').state.cell,current=new Map();let completionObserved=false;
 const observe=()=>{if(scenario.order!==undefined||completionObserved||!cell.impacted||!cell.open)return;const d=cell.diagnostics();current.set(d.worldStep,structuredClone(d));for(const step of current.keys())if(step<d.worldStep-3)current.delete(step);};
 game.physics.world.addEventListener('postStep',observe);
 try{
  const report=await runSingularityJourney(game,{order:scenario.order,onFrame(){
   if(scenario.order!==undefined||completionObserved)return;
   const event=game.firstLevel.getTowerMetrics().events.find(e=>e.id==='impulse');if(!event)return;
   const d=event.proof.impulseCell;assert.deepEqual(current.get(d.worldStep),d,'The ordinary completion must equal the same actual postStep snapshot retained for the movie observer');completionObserved=true;
  },onMilestone(mark){
   if(mark.name.startsWith('Solved ')||mark.name==='Start impulse')console.log('Tower41 ordinary order progress '+JSON.stringify({order:scenario.name,milestone:mark.name,seconds:mark.seconds}));
   if(mark.name==='Start impulse')samples.start={cargo:game.cargo.position.toArray(),worldStep:game.physics.world.stepnumber};
   if(mark.name==='Original companion released into impulse fall')samples.release={held:Boolean(game.heldCube),cargo:game.cargo.position.toArray(),worldStep:game.physics.world.stepnumber,seconds:mark.seconds};
   if(mark.name==='Original companion crosses bistable spring barrier')samples.barrier=structuredClone(mark.physicsProof);
   if(mark.name==='Original companion recovered from impulse scoop')samples.retrieval={held:game.heldCube===original,bodyId:game.physics.cargoBody.id,shapeId:game.physics.cargoBody.shapes[0].id,worldStep:game.physics.world.stepnumber};
   if(mark.name==='Impulse actual scoop return departure')samples.returnDeparture={grounded:mark.grounded,coyoteTime:mark.coyoteTime,velocity:mark.velocity};
   if(mark.name==='Impulse actual scoop return takeoff')samples.returnTakeoff={grounded:mark.grounded,velocity:mark.velocity};
   if(mark.name==='Solved impulse')samples.finish={cargo:game.cargo.position.toArray(),held:Boolean(game.heldCube),worldStep:game.physics.world.stepnumber};
  }});
  assert.equal(report.pass,true);assert.equal(game.state,'won');assert.equal(report.sameCompanion,true);
  assert.equal(game.cargo,original);assert.equal(game.physics.cargoBody,body);assert.equal(body.shapes[0],shape);
  assert.equal(report.resets+report.respawns+report.cargoResets,0);assert.equal(report.metrics.checkpoints,false);
  assert.deepEqual(report.milestones.filter(m=>m.name.startsWith('Solved ')).map(m=>m.name.slice(7)),scenario.expected);
  assert.deepEqual(report.metrics.solvedIds,scenario.expected);assert.equal(report.metrics.completedStages,12);
  assert.equal(new Set(report.metrics.events.map(e=>e.rule)).size,12);assert.equal(report.metrics.events.at(-1).id,'crown');
  assert.ok(Math.abs(samples.start.cargo[1]-scenario.hubY)<1,'The new branch must pick up the original from this order’s actual gallery');
  assert.equal(samples.release.held,false);assert.ok(samples.release.cargo[1]>62,'A real high release supplies the fall energy');
  const d=samples.barrier,impact=d.firstImpact;
  assert.equal(d.open,true);assert.equal(d.impacted,true);assert.equal(d.readyForProof,true);assert.equal(d.currentCollisionValid,true);
  assert.equal(d.originalCargoBodyId,body.id);assert.equal(d.originalCargoShapeId,shape.id);assert.equal(d.originalCargoIdentityValid,true);
  assert.equal(d.originalCargoFree,true);assert.ok(d.x>10.9&&d.x<11.1);assert.ok(d.stableTicks>=24);
  assert.equal(d.freeXEquationAbsent,true);assert.deepEqual(d.constraintEquationCounts,[5]);assert.equal(d.constraintsPresent,true);
  assert.ok(d.barrierEnergy>10);assert.ok(impact.normalImpulse>0&&impact.relativeVelocityBefore>3);
  assert.equal(impact.cargoBodyId,body.id);assert.equal(impact.cargoShapeId,shape.id);assert.equal(impact.worldStep,impact.forceStep+1);assert.equal(impact.dt,1/120);
  assert.ok(samples.release.worldStep<impact.worldStep);assert.ok(impact.worldStep<samples.retrieval.worldStep);
  assert.equal(samples.retrieval.held,true);assert.equal(samples.retrieval.bodyId,body.id);assert.equal(samples.retrieval.shapeId,shape.id);
  assert.ok(samples.returnDeparture.grounded||samples.returnDeparture.coyoteTime>0);assert.equal(samples.returnTakeoff.grounded,false);assert.ok(samples.returnTakeoff.velocity[1]>3);
  assert.equal(samples.finish.held,false);assert.ok(Math.abs(samples.finish.cargo[1]-scenario.hubY)<1,'An early branch must restore its actual incoming hub before the older route continues');
  const event=report.metrics.events.find(e=>e.id==='impulse');assert.ok(event);assert.ok(event.seconds>samples.release.seconds);
  const proof=event.proof;assert.equal(proof.physicalOriginalCargoImpulse,true);assert.equal(proof.passiveBistableCarriage,true);
  assert.equal(assertCastleImpulsePhysicalProof(proof,body.id,shape.id),proof);
  assert.equal(proof.physicalImpulseCell.currentCollisionValid,true);assert.equal(proof.physicalImpulseCell.readyForProof,true);
  assert.equal(proof.originalCargoBodyId,body.id);assert.equal(proof.originalCargoShapeId,shape.id);
  assert.equal(proof.actualServiceCrossing.originalCargoBodyId,body.id);assert.ok(proof.actualServiceCrossing.worldStep>impact.worldStep);
  assert.ok(proof.actualServiceCrossing.arrivalWorldStep>proof.actualServiceCrossing.worldStep);
  assert.equal(proof.sameOriginalCargoRetrieved,true);assert.equal(proof.cargoRetrieval.originalCargoBodyId,body.id);assert.equal(proof.cargoRetrieval.originalCargoShapeId,shape.id);
  assert.ok(proof.cargoRetrieval.worldStep>proof.actualServiceCrossing.arrivalWorldStep);
  assert.ok(proof.receiverContact.normalForce>0&&proof.receiverContact.contacts>0&&proof.receiverContact.stableTicks>=24);
  assert.equal(proof.receiverContact.cargoBodyId,body.id);assert.equal(proof.receiverContact.cargoShapeId,shape.id);assert.equal(proof.receiverContact.originalCargoFree,true);
  if(scenario.order===undefined){
   assert.equal(completionObserved,true);
   const reject=mutate=>{const forged=structuredClone(proof);mutate(forged);assert.throws(()=>assertCastleImpulsePhysicalProof(forged,body.id,shape.id));};
   for(const key of ['actualServiceCrossing','cargoRetrieval','receiverContact'])reject(p=>{delete p[key];});
   reject(p=>{p.receiverContact.worldStep--;});reject(p=>{p.receiverContact.normalForce=0;});reject(p=>{p.receiverContact.contacts=0;});
   reject(p=>{p.cargoRetrieval.originalCargoBodyId++;});reject(p=>{p.cargoRetrieval.originalCargoShapeId++;});
   reject(p=>{p.cargoRetrieval.worldStep=p.actualServiceCrossing.arrivalWorldStep;});reject(p=>{p.independentLoads=false;});
  }
  assert.ok(report.actions.filter(a=>a.kind==='shoot').length>=14);assert.ok(report.actions.some(a=>a.kind==='walk'&&a.target[1]===63));
  console.log('Tower41 actual impulse route '+JSON.stringify({order:scenario.expected,pass:report.pass,physicsSteps:report.physicsSteps,seconds:report.seconds,resets:report.resets,respawns:report.respawns,cargoResets:report.cargoResets,originalCargoBodyId:body.id,originalCargoShapeId:shape.id,normalImpulse:impact.normalImpulse,impactStep:impact.worldStep,retrievalStep:samples.retrieval.worldStep,hubY:scenario.hubY}));
 }finally{game.physics.world.removeEventListener('postStep',observe);game.firstLevel.dispose();game.physics.dispose();game.portals.dispose();}
});
