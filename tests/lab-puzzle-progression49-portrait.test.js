import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

for(const aspect of [390/844,9/16,16/9])test(`49 complete route ${aspect} boards at the actual deck height and retains every original actor`,async()=>{
 const g=await createHeadlessGame();g.chamberEdition='foundation';g.puzzleProgression=true;g.camera.aspect=aspect;g.camera.updateProjectionMatrix();await g.selectLevel(48,false);
 const l=g.firstLevel,original={player:g.playerGroup,cargo:g.cargo.group,body:g.physics.cargoBody,shape:g.physics.cargoBody.shapes[0],carriage:l.carriage.body};
 const request=g.portalShots.request,visual=g.updateVisuals,clear=g.clearPortals,requests=[],impacts=[],closures=[];let last='',frames=0,boarding=null;
 g.portalShots.request=function(index){
  this.captureTarget(index);const hit=this.firstHit(),entry={index,surface:hit?.object.uuid,point:hit?.point.toArray()};
  const accepted=request.call(this,index);if(accepted)requests.push(entry);return accepted;
 };
 g.updateVisuals=function(...args){
  assert.equal(g.playerGroup,original.player);assert.equal(g.cargo.group,original.cargo);assert.equal(g.physics.cargoBody,original.body);assert.equal(original.body.shapes[0],original.shape);assert.equal(l.carriage.body,original.carriage);frames++;
  const impact=g.portalShots.lastImpact,key=impact?`${impact.index}:${impact.sequence}`:'';
  if(impact&&key!==last){last=key;impacts.push({...impact,surfaceId:g.portals.portals[impact.index]?.surfaceId});}
  return visual.apply(this,args);
 };
 g.clearPortals=function(){
  const entry={grounded:g.playerGrounded,player:g.playerPosition.toArray(),floor:l.carriage.floor.y,teleports:g.teleportCount,braked:l.carriage.braked,loaded:l.carriage.loaded()},cargo=original.body.position.clone();
  assert.equal(entry.grounded,true);assert.equal(entry.teleports,1);assert.ok(Math.abs(entry.player[1]-entry.floor)<.04);assert.equal(entry.braked,true);assert.equal(entry.loaded,true);
  const result=clear.call(this);assert.deepEqual(original.body.position,cargo,'closing the unused pair must not relocate the free original weight');closures.push(entry);return result;
 };
 try{
  const r=await runV8Journey(g,{onMilestone:item=>{if(item.name.startsWith('The moving passenger aperture'))boarding={...item,grounded:g.playerGrounded,floor:l.carriage.floor.y,entry:g.portals.portals[0].position.toArray(),exit:g.portals.portals[1].position.toArray()};}});
  assert.equal(r.pass,true);assert.equal(g.state,'won');assert.equal(r.resets,0);assert.equal(r.respawns,0);assert.equal(r.teleports,1);assert.ok(frames>4000);
  assert.ok(boarding);assert.equal(boarding.grounded,true);assert.ok(Math.abs(boarding.player[1]-boarding.floor)<.04);assert.ok(Math.abs((boarding.exit[1]-boarding.entry[1])-(boarding.floor-8))<.01,'both apertures preserve the actual floor-height difference');
  assert.equal(closures.length,aspect<.75?1:0);
  const expected=['cargo-feed','mirror-freight','optical-source','optical-branch-a','carriage-freight','mirror-freight','gallery-passenger','passenger','optical-source','optical-branch-b'].map(name=>l.panels[name].mesh.uuid);
  assert.equal(requests.length,10);assert.equal(impacts.length,10);assert.ok(impacts.every(hit=>hit.valid));assert.deepEqual(requests.map(r=>r.surface),expected);assert.deepEqual(impacts.map(r=>r.surfaceId),expected);
  assert.ok(l.carriage.position.x>23.8);assert.ok(g.physics.portalTransports>=2);
  console.info('49 complete original-actor route',JSON.stringify({aspect,frames:r.frames,visualFrames:frames,shots:impacts.length,allSweptImpactsValid:true,boarding,closures,resets:r.resets,respawns:r.respawns,state:g.state,sameOriginalActors:true}));
 }finally{g.portalShots.request=request;g.updateVisuals=visual;g.clearPortals=clear;g.physics.dispose();g.portals.dispose();}
});
