import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Body} from 'cannon-es';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runPuzzleProgression47} from '../src/game/LabPuzzleProgression47Journey.js';
import {PROGRESSION47_SPEC} from '../src/game/LabPuzzleProgression47.js';
import {installPreciseLateAim,aimLateSurface} from '../src/game/LabLateCampaignAim.js';
import {uprightCapsuleFitsPortal} from '../src/game/LabPortals.js';
let shared;async function room(){shared??=await createHeadlessGame();shared.chamberEdition='foundation';shared.puzzleProgression=true;await shared.selectLevel(46,false);shared.camera.aspect=16/9;shared.camera.updateProjectionMatrix();return shared;}
const scenario=(g,f)=>runV8Journey(g,{scenario:f});
for(const [aspect,recover]of [[16/9,false],[16/10,true]])test(`47 ordinary impact/contact journey, ${aspect}, dry recovery ${recover}`,async()=>{
 const g=await room();g.camera.aspect=aspect;g.camera.updateProjectionMatrix();const original=g.cargo,body=g.physics.cargoBody;
 const report=await scenario(g,d=>runPuzzleProgression47(d,{recover}));
 assert.equal(report.pass,true);assert.equal(g.state,'won');assert.equal(report.resets,0);assert.equal(report.respawns,0);assert.equal(g.cargo,original);assert.equal(g.physics.cargoBody,body);
 assert.equal(g.firstLevel.id,PROGRESSION47_SPEC.id);assert.equal(g.firstLevel.drive.body.type,Body.DYNAMIC);assert.ok(g.firstLevel.drive.contacts>0);assert.ok(g.firstLevel.fuse.energy>=175);assert.equal(g.firstLevel.fuse.bodies.length,16);
 assert.ok(report.milestones.some(m=>m.name.includes('true pin contact')));assert.ok(g.physics.portalTransports>=1);assert.equal(report.teleports,1);
});
test('47 early gravity/outlet pair passes original cargo but rejects the standing capsule',async()=>{
 const g=await room();await scenario(g,d=>{runPuzzleProgression47(d,{stopAfter:'routed'});assert.equal(uprightCapsuleFitsPortal(g.portals.portals[1],2.4,.46),false);const before=g.teleportCount;d.walk(0,3);for(let n=0;n<150;n++){d.worldMove(0,1);d.frame();}d.stop();assert.equal(g.teleportCount,before);assert.equal(d.level.fuse.broken,false);assert.notEqual(g.state,'won');});
});
test('47 cargo removal leaves a dynamic piston held by real contact, and removing the pin releases it',async()=>{
 const g=await room();await scenario(g,d=>{runPuzzleProgression47(d,{stopAfter:'retrieved'});const l=d.level,x=l.drive.body.position.x;assert.equal(l.drive.body.type,Body.DYNAMIC);assert.ok(l.drive.contacts>0);assert.equal(l.loaded(),false);
 d.walk(-16,-8);d.stop();d.wait(.2);assert.equal(g.interact(),true);assert.ok(!g.heldCube);d.wait(.5);d.walk(20,-12);d.walk(22,-10.5);assert.equal(g.interact(),true);d.until(()=>l.drive.body.position.x<x-2,6,'Retracting the true pin must release the actual returning piston');assert.equal(l.drive.body.type,Body.DYNAMIC);assert.notEqual(g.state,'won');});
});
test('47 early observer shot cannot hit the masked moving address',async()=>{
 const g=await room();await scenario(g,d=>{runPuzzleProgression47(d,{stopAfter:'inspected'});d.walk(0,-16);d.walk(8.3,-16);d.walk(8.3,-14.8);d.look(d.level.address.getFrame().center);g.scene.updateMatrixWorld(true);const o=g.camera.position.clone(),n=d.level.address.getFrame().center.clone().sub(o).normalize(),hits=new THREE.Raycaster(o,n).intersectObjects(g.aimBlockers,true);assert.ok(hits.length);assert.notEqual(hits[0].object.uuid,d.level.address.mesh.uuid);assert.notEqual(g.state,'won');});
});
test('47 the player alone cannot complete the high archive exit',async()=>{const g=await room();await scenario(g,d=>runPuzzleProgression47(d,{noCargo:true}));assert.notEqual(g.state,'won');assert.ok(g.playerPosition.y>7.8);assert.ok(g.cargo.position.y<3);});
test('47 reset restores the original body and dynamic mechanisms; disposal is idempotent',async()=>{const g=await room();await scenario(g,d=>runPuzzleProgression47(d,{stopAfter:'retrieved'}));const cargo=g.cargo,body=g.physics.cargoBody,l=g.firstLevel;g.resetRun(true);assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);assert.equal(l.fuse.broken,false);assert.equal(l.fuse.energy,0);assert.equal(l.drive.pinInserted,false);assert.equal(l.drive.body.type,Body.DYNAMIC);assert.ok(l.drive.body.position.x< -7.9);const count=g.physics.world.bodies.length;l.dispose();l.dispose();assert.ok(g.physics.world.bodies.length<count);});

test('47 physical contact fixture: twelve weak contacts never accumulate; one sufficient real contact fractures and shards meet floor',async()=>{
 const g=await room();g.state='playing';const l=g.firstLevel,b=g.physics.cargoBody,original=g.cargo;g.resetRun(true);l.fuse.ensure();let peakSum=0;
 // Contact laboratory setup only: the original box starts tangent to the real
 // sheet; production fixed-step Cannon resolves each actual collide event.
 // This is not an ordinary-input route or a method of transporting cargo.
 function contact(speed){b.position.set(0,2.6,0);b.velocity.setZero();b.aabbNeedsUpdate=true;b.wakeUp();g.physics.step(1/120);b.position.set(0,2.6,-3.52);b.previousPosition.copy(b.position);b.interpolatedPosition.copy(b.position);b.quaternion.set(0,0,0,1);b.velocity.set(0,0,-speed);b.angularVelocity.setZero();b.force.setZero();b.aabbNeedsUpdate=true;g.physics.world.broadphase.dirty=true;b.wakeUp();for(let n=0;n<20;n++)g.physics.step(1/120);}
 for(let n=0;n<12;n++){contact(9);assert.ok(l.fuse.energy>120&&l.fuse.energy<175);assert.equal(l.fuse.broken,false);peakSum+=l.fuse.energy;}
 assert.ok(peakSum>1500);assert.ok(l.fuse.energy<175);contact(10.6);assert.equal(l.fuse.broken,true);assert.ok(l.fuse.energy>=175);assert.equal(l.fuse.bodies.length,16);assert.equal(g.cargo,original);assert.equal(g.physics.cargoBody,b);
 for(let n=0;n<300;n++)g.physics.step(1/120);assert.ok(l.fuse.bodies.every(f=>f.position.y>.05),'Compatible masks keep every independent shard above the real floor');
});

test('47 adversarial rapid pickup with preplaced off-centre final pair cannot skip the actual retaining pin',async()=>{
 const g=await room();await scenario(g,d=>{
  runPuzzleProgression47(d,{stopAfter:'powered'});const l=d.level;
  d.walk(-20,-8);aimLateSurface(d,0,l.entrance);d.walk(0,-16);d.walk(8.3,-16);d.walk(8.3,-14.8);aimLateSurface(d,1,l.address,l.address.getFrame().center.clone().add(new THREE.Vector3(.8,0,0)));
  d.walk(0,-16);d.walk(-17.15,-14.8);d.stop();assert.equal(g.interact(),true);assert.ok(g.heldCube);const before=g.teleportCount;
  // Immediate production E followed by full-speed walking; no pickup wait.
  d.walk(-23.65,-9);for(let n=0;n<180;n++){if(n%30===0)g.input.jumpQueued=true;d.worldMove(-1,0);d.frame();}d.stop();
  if(g.teleportCount>before){for(let n=0;n<180;n++){d.worldMove(0,1);d.frame();}d.stop();}
  assert.equal(l.drive.pinInserted,false);assert.equal(l.drive.contacts,0);assert.notEqual(g.state,'won');assert.ok(g.playerPosition.y<7.8,'Removing the live load must return the unretained address before a joint high landing');
 });
});

test('47 actual shattered bodies contact one another, the real floor and a gentle original cargo drop',async()=>{
 const g=await room();g.state='playing';g.resetRun(true);const l=g.firstLevel,b=g.physics.cargoBody,original=g.cargo;l.fuse.ensure();
 // Disclosed contact fixture: fracture the real sheet with the original body,
 // settle its sixteen generated bodies, then gently drop the same cargo on one.
 b.position.set(0,2.6,-3.52);b.previousPosition.copy(b.position);b.interpolatedPosition.copy(b.position);b.quaternion.set(0,0,0,1);b.velocity.set(0,0,-10.6);b.angularVelocity.setZero();b.force.setZero();b.aabbNeedsUpdate=true;b.wakeUp();g.physics.world.broadphase.dirty=true;
 let shardPairContacts=0;for(let n=0;n<1800;n++){g.physics.step(1/120);const fragments=new Set(l.fuse.bodies);shardPairContacts+=g.physics.world.contacts.filter(c=>fragments.has(c.bi)&&fragments.has(c.bj)).length;}
 assert.equal(l.fuse.broken,true);assert.equal(l.fuse.bodies.length,16);assert.ok(shardPairContacts>0,'Physical shards must interact with one another');assert.ok(l.fuse.bodies.every(f=>f.position.y>.05),'Every shard must stay above the actual floor');
 const f=l.fuse.bodies.find(a=>a.position.y<.10)||l.fuse.bodies[0];assert.ok((f.collisionFilterMask&b.collisionFilterGroup)&&(b.collisionFilterMask&f.collisionFilterGroup));
 b.position.set(f.position.x,f.position.y+1.2,f.position.z);b.previousPosition.copy(b.position);b.interpolatedPosition.copy(b.position);b.quaternion.set(0,0,0,1);b.velocity.setZero();b.angularVelocity.setZero();b.force.setZero();b.aabbNeedsUpdate=true;b.wakeUp();g.physics.world.broadphase.dirty=true;
 let cargoShardContacts=0;for(let n=0;n<600;n++){g.physics.step(1/120);cargoShardContacts+=g.physics.world.contacts.filter(c=>(c.bi===b&&l.fuse.bodies.includes(c.bj))||(c.bj===b&&l.fuse.bodies.includes(c.bi))).length;}
 assert.ok(cargoShardContacts>0,'A gentle original cargo drop must generate real shard contacts');assert.equal(g.cargo,original);assert.equal(g.physics.cargoBody,b);
});
