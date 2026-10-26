import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

for(const aspect of [390/844,9/16])test(`47 portrait ${aspect} sees the actual upper address from the west court and completes the joint route`,async()=>{
 const g=await createHeadlessGame();g.chamberEdition='foundation';g.puzzleProgression=true;g.camera.aspect=aspect;g.camera.updateProjectionMatrix();await g.selectLevel(46,false);
 const cargo=g.cargo.group,body=g.physics.cargoBody,shape=body.shapes[0],level=g.firstLevel,piston=level.drive.body,address=level.address;
 const requests=[],impacts=[],request=g.portalShots.request,visual=g.updateVisuals;let last='',frames=0;
 g.portalShots.request=function(index){
  this.captureTarget(index);const hit=this.firstHit(),entry={index,player:g.playerPosition.toArray(),camera:g.camera.position.toArray(),surface:hit?.object.uuid,point:hit?.point.toArray()};
  const accepted=request.call(this,index);if(accepted)requests.push(entry);return accepted;
 };
 g.updateVisuals=function(...args){
  assert.equal(g.cargo.group,cargo);assert.equal(g.physics.cargoBody,body);assert.equal(body.shapes[0],shape);assert.equal(level.drive.body,piston);frames++;
  const impact=g.portalShots.lastImpact,key=impact?`${impact.index}:${impact.sequence}`:'';
  if(impact&&key!==last){last=key;impacts.push({...impact});}
  return visual.apply(this,args);
 };
 try{
  const report=await runV8Journey(g);
  assert.equal(report.pass,true);assert.equal(g.state,'won');assert.equal(report.resets,0);assert.equal(report.respawns,0);assert.equal(report.teleports,1);assert.ok(frames>6500);
  const shots=requests.filter(r=>r.surface===address.mesh.uuid);assert.equal(shots.length,1);assert.equal(shots[0].index,1);
  assert.ok(Math.abs(shots[0].player[0]+6)<.3&&Math.abs(shots[0].player[2]+6)<.3,'real west-court approach');
  assert.ok(shots[0].point[1]>address.getFrame().center.y+1.1,'real upper part of the same white address');
  assert.equal(impacts.length,requests.length);assert.equal(requests.length,4);assert.ok(impacts.every(hit=>hit.valid),'every actual swept charge must hit its intended physical route');
  assert.equal(piston.type,1);assert.ok(level.drive.contacts>0);assert.equal(level.fuse.broken,true);
  console.info('47 complete portrait route',JSON.stringify({aspect,frames:report.frames,requests:requests.length,impacts:impacts.length,addressShot:shots[0],resets:report.resets,respawns:report.respawns,sameCargo:true,sameBody:true,sameShape:true,state:g.state}));
 }finally{g.portalShots.request=request;g.updateVisuals=visual;g.physics.dispose();g.portals.dispose();}
});
