import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

const g=await createHeadlessGame();
g.chamberEdition='foundation';
g.room23PhysicalPrototype=true;
after(()=>{g.firstLevel?.dispose?.();g.physics?.dispose();g.portals?.dispose();});

for(const aspect of [16/9,1.6])test(`room23 native bearing keeps the same original retrievable through the real hood at aspect ${aspect}`,async()=>{
 await g.selectLevel(22,false);g.camera.aspect=aspect;g.camera.updateProjectionMatrix();
 assert.equal(g.firstLevel.spawnView.yaw,-.8);
 assert.equal(g.firstLevel.puzzleGeometry.declaredInitialComponentFixture,false);
 const original=g.physics.cargoBody,shape=original.shapes[0],balance=g.firstLevel.balance;
 let actualPanCharge=false,passiveSamples=0,unloadedSamples=0;
 const behavior=g.companionBehavior,update=behavior.update;
 behavior.update=function(dt,options){
  const contact=balance.west.loaded()||balance.east.loaded();
  assert.equal(options.passiveSupport,contact);
  const force=original.force.clone(),torque=original.torque.clone();
  const result=update.call(this,dt,options);
  if(contact&&!options.held){
   passiveSamples++;assert.equal(this.state,'waiting_on_pad');
   assert.deepEqual(original.force.toArray(),force.toArray(),'A supported original must receive no powered walking force');
   assert.deepEqual(original.torque.toArray(),torque.toArray(),'A supported original must receive no powered recovery torque');
  }else if(!contact)unloadedSamples++;
  return result;
 };
 let report;
 try{report=await runV8Journey(g,{journeyOptions:{onPhase(name){
  assert.equal(g.physics.cargoBody,original);assert.equal(original.shapes[0],shape);
  assert.equal(balance.ownershipValid(),true);
  if(name==='actual-original-upper-retrieval'){
   assert.equal(g.portalShots.lastImpact?.valid,true);
   assert.equal(g.portals.portals[0].surfaceId,g.firstLevel.panels['west-load-car-pan'].mesh.uuid);
   actualPanCharge=true;
  }
 }}});}finally{behavior.update=update;}
 assert.equal(actualPanCharge,true);assert.equal(report.pass,true);assert.equal(g.state,'won');
 assert.ok(passiveSamples>100);assert.ok(unloadedSamples>100);
 assert.equal(report.resets+report.respawns,0);assert.equal(g.physics.cargoBody,original);
 assert.equal(original.shapes[0],shape);assert.equal(original.mass,3.2);
 assert.ok(report.milestones.some(m=>m.name==='same original physically retrieved through pan and high receiver'));
});
