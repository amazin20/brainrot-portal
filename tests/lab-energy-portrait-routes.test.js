import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

for(const number of [12,13,18])for(const [view,aspect]of [['wide',16/9],['portrait',390/844]])
test(`${number}: ordinary ${view} route reaches the same exit through real access and service sight lines`,async()=>{
 const g=await createHeadlessGame();g.chamberEdition='foundation';g.camera.aspect=aspect;g.camera.updateProjectionMatrix();
 await g.selectLevel(number-1,true);
 const original={cargo:g.cargo,group:g.cargo.group,body:g.physics.cargoBody,shape:g.physics.cargoBody.shapes[0],world:g.physics.world};
 const impacts=new Map();let observedSteps=0,previousStep=g.physics.world.stepnumber;
 const observe=()=>{
  assert.equal(g.cargo,original.cargo);assert.equal(g.cargo.group,original.group);assert.equal(g.physics.cargoBody,original.body);assert.equal(original.body.shapes[0],original.shape);
  assert.equal(g.physics.world,original.world);assert.equal(g.physics.world.stepnumber,previousStep+1);previousStep++;observedSteps++;
  const hit=g.portalShots.lastImpact;if(hit)impacts.set(hit.index+':'+hit.sequence,structuredClone(hit));
 };
 original.world.addEventListener('postStep',observe);
 try{
  const route=await runV8Journey(g,{journeyOptions:{nativeStart:true}});
  assert.equal(route.pass,true);assert.equal(g.state,'won');assert.equal(route.resets+route.respawns,0);
  assert.ok(observedSteps>1000);assert.equal(observedSteps,g.physics.world.stepnumber);
  assert.ok(impacts.size>=(number===18?2:4));assert.ok([...impacts.values()].every(hit=>hit.valid),'Every observed charged shot must reach an actual accepted ceramic');
  if(number===12){
   assert.ok(route.milestones.some(m=>m.name==='friend reaches the crossing dock'&&m.cargo[1]>8.9&&m.cargo[2]>1.2));
   assert.ok(route.milestones.some(m=>m.name==='spent portal becomes the lateral exit'));
  }
  if(number===13)assert.ok(route.milestones.some(m=>m.name==='live weight turns the mirror'));
  if(number===18){assert.ok(g.firstLevel.circuit.stroke>6.49);assert.equal(g.firstLevel.circuit.current,0);assert.deepEqual(g.firstLevel.circuit.contacts,[false,false]);}
  if(process.env.ENERGY_ROUTE_REPORT)fs.appendFileSync(process.env.ENERGY_ROUTE_REPORT,JSON.stringify({number,view,aspect,route,observedSteps,impacts:[...impacts.values()],bodyId:original.body.id,shapeId:original.shape.id,sameOriginal:true})+'\n');
 }finally{original.world.removeEventListener('postStep',observe);g.firstLevel.dispose();g.physics.dispose();g.portals.dispose();}
});
