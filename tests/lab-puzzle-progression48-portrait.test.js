import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runPuzzleProgression48} from '../src/game/LabPuzzleProgression48Journey.js';

for(const aspect of [390/844,9/16])test(`48 portrait ${aspect} uses one real inspection jump and wins with the original contact weight`,async()=>{
 const g=await createHeadlessGame();g.chamberEdition='foundation';g.puzzleProgression=true;g.camera.aspect=aspect;g.camera.updateProjectionMatrix();await g.selectLevel(47,false);
 const cargo=g.cargo.group,body=g.physics.cargoBody,shape=body.shapes[0],window=g.firstLevel.panels['original-cargo-window'];
 const requests=[],impacts=[],request=g.portalShots.request,visual=g.updateVisuals;let last='',frames=0;
 g.portalShots.request=function(index){
  this.captureTarget(index);const hit=this.firstHit(),entry={index,airborne:!g.playerGrounded,player:g.playerPosition.toArray(),camera:g.camera.position.toArray(),surface:hit?.object.uuid,worldStep:g.physics.world.stepnumber};
  const accepted=request.call(this,index);if(accepted)requests.push(entry);return accepted;
 };
 g.updateVisuals=function(...args){
  assert.equal(g.cargo.group,cargo);assert.equal(g.physics.cargoBody,body);assert.equal(body.shapes[0],shape);frames++;
  const impact=g.portalShots.lastImpact,key=impact?`${impact.index}:${impact.sequence}`:'';
  if(impact&&key!==last){last=key;impacts.push({...impact});}
  return visual.apply(this,args);
 };
 try{
  const report=await runV8Journey(g,{scenario:d=>runPuzzleProgression48(d)});
  assert.equal(report.pass,true);assert.equal(g.state,'won');assert.equal(report.resets,0);assert.equal(report.respawns,0);assert.ok(frames>9000);
  const airborne=requests.filter(r=>r.airborne);assert.equal(airborne.length,1);assert.equal(airborne[0].surface,window.mesh.uuid);assert.equal(airborne[0].index,0);
  assert.ok(airborne[0].player[1]>8.15&&airborne[0].player[1]<9.6,'actual ordinary jump above its eight-metre gallery');
  assert.equal(impacts.length,requests.length);assert.ok(impacts.every(hit=>hit.valid),'every actual swept shot must reach a valid real surface');
  assert.ok(g.firstLevel.machine.contacts.cargoCarriage>100);assert.ok(g.firstLevel.machine.contacts.pinCarriage>20);assert.ok(g.firstLevel.machine.contacts.cargoStop>20);
  console.info('48 complete portrait route',JSON.stringify({aspect,frames:report.frames,requests:requests.length,impacts:impacts.length,inspectionJump:airborne[0],resets:report.resets,respawns:report.respawns,sameCargo:true,sameBody:true,sameShape:true,state:g.state}));
 }finally{g.portalShots.request=request;g.updateVisuals=visual;g.physics.dispose();g.portals.dispose();}
});
