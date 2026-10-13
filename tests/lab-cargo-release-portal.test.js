import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {releaseFixture,releaseStep,releaseSnapshot,runReleaseAttempt} from '../scripts/lib/cargo-release-portal-cases.mjs';
import {playerFixture,wall} from '../scripts/lib/adversarial-core-cases.mjs';
import {LabPhysics} from '../src/game/LabPhysics.js';
const H=1/120,V=(...p)=>new THREE.Vector3(...p);

for(const depth of [.7,.4,.3,.2,.1])for(const clearDelayTicks of [0,1,5,30,null]){
 test(`release at throat ${depth}, clear delay ${clearDelayTicks??'open pair'} stays on original side`,()=>{
  const r=runReleaseAttempt({depth,clearDelayTicks});assert.equal(r.sameBody,true);assert.equal(r.after.playerTeleports,0);assert.equal(r.after.cargoTransports,0);
  assert.ok(r.before.cargo[2]<.02,'The adversarial release starts with a genuinely behind-plane held centre');
  assert.ok(r.afterRelease.cargo[2]>.41,'E must start the original free box in front of its owned backing');
  assert.deepEqual(r.afterRelease.velocity,r.before.velocity,'An open release preserves earned linear momentum');
  assert.ok(r.minimumZ>.37,'Release/clear timing cannot send the original box behind its source wall');
 });
}

for(const depth of [.7,.4,.3,.2,.1]){
 test(`internal pair closing then ordinary release remains a front-side contact at throat ${depth}`,()=>{
  const r=runReleaseAttempt({depth,clearFirst:true});assert.ok(r.afterClear.cargo[2]>.41);assert.ok(r.minimumZ>.37);
 });
 test(`clear while still holding the original box recovers the complete grip at throat ${depth}`,()=>{
  const r=runReleaseAttempt({depth,directClear:true});assert.ok(r.afterClear.cargo[2]>.41);assert.ok(r.minimumZ>.37);
  assert.equal(r.after.held,true);assert.equal(r.after.playerTeleports,0);assert.equal(r.after.cargoTransports,0);
  if(depth<=.3)assert.ok(r.before.cargo[2]<-.39,'The actual carried box must be entirely behind the old source plane');
 });
}

test('an ordinary moving release retains earned inward speed and sends the original free box through the pair',()=>{
 const g=releaseFixture();try{
  assert.ok(g.interact()&&g.heldCube);g.move.set(0,-1);
  for(let n=0;n<180&&g.playerPosition.z>.7;n++)releaseStep(g);g.move.set(0,0);
  const id=g.physics.cargoBody.id,before=releaseSnapshot(g);assert.ok(before.velocity[2]<-2,'The body must acquire inward speed from actual controller movement');
  assert.ok(g.interact()&&!g.heldCube);assert.deepEqual(g.physics.cargoBody.velocity.toArray(),before.velocity);
  for(let n=0;n<120&&g.physics.portalTransports===0;n++)releaseStep(g);
  assert.equal(g.physics.portalTransports,1);assert.equal(g.physics.cargoBody.id,id);assert.equal(g.teleportCount,0);
  assert.ok(g.cargo.position.x<19.98,'A lawful independent cargo delivery must still reach the real outlet');
 }finally{g.physics.dispose();g.portals.dispose();}
});

test('legal free cargo behind a backing is never pulled to the player side',()=>{
 const g=releaseFixture();try{
  // Explicit backside fixture setup, with no current or previous grip.
  g.cargo.position.set(0,4.86,-1);g.physics.resetCargo({position:g.cargo.position});const before=releaseSnapshot(g);
  g.recoverCargoFromClosingPortals(g.portals.portals,g.portalSurfaceIds,{beforeRelease:true});assert.deepEqual(releaseSnapshot(g),before);
  g.clearPortals();assert.deepEqual(g.cargo.position.toArray(),before.cargo);for(let n=0;n<120;n++)releaseStep(g);
  assert.ok(g.cargo.position.z<-.9);assert.equal(g.physics.portalTransports,0);
 }finally{g.physics.dispose();g.portals.dispose();}
});

test('the same original free cargo still traverses a real smaller floor-to-wall portal',()=>{
 const g=playerFixture();g.physics=new LabPhysics({gravity:-19.5});try{
  const floor=wall(g,0,-.1,0,40,.2,40),destination=wall(g,20.1,5,0,.2,10,10);
  g.floors.push({minX:-20,maxX:20,minZ:-20,maxZ:20,y:0,mesh:floor});for(const c of g.colliders)g.physics.addStaticBox(c.mesh.uuid,c.box);
  g.portals.place(0,V(0,.02,0),V(0,1,0),V(0,0,-1));g.portals.place(1,V(19.98,5,0),V(-1,0,0),undefined,{width:.95,height:.65});g.portalSurfaceIds=[floor.uuid,destination.uuid];
  g.cargo={position:V(0,1,0),velocity:V(0,-4,0),quaternion:new THREE.Quaternion(),group:new THREE.Group()};g.physics.createCargo({position:g.cargo.position,velocity:g.cargo.velocity});
  g.playerPosition.set(10,0,10);g.companionAnimator={trigger(){}};g.firstLevel.cargoOnAnyPad=()=>false;g.firstLevel.getLaunch=()=>null;const id=g.physics.cargoBody.id;
  for(let n=0;n<120&&g.physics.portalTransports===0;n++)g.updateCubes(H);
  assert.equal(g.physics.portalTransports,1);assert.equal(g.physics.cargoBody.id,id);assert.ok(g.cargo.position.x<19.98);const before=g.cargo.position.clone();g.clearPortals();
  assert.ok(g.cargo.position.distanceTo(before)<1e-9,'A completed original free transfer must remain at its legitimate exit');
 }finally{g.physics.dispose();g.portals.dispose();}
});
