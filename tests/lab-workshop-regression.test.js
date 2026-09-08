import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {Flywheel} from '../src/game/LabWorkshopKit.js';
import {createHeadlessGame,loadHeadlessGLB} from '../scripts/lab-headless.mjs';
import {CAMPAIGN} from '../src/game/LabCampaignLevels.js';
const V=(...p)=>new THREE.Vector3(...p);
const hash=b=>createHash('sha256').update(b).digest('hex');

test('nine supplied derived GLBs have full binary length, exact hashes, frame and articulated parts',async()=>{
 const assets=JSON.parse(fs.readFileSync('docs/WORKSHOP_ASSETS.json'));
 assert.equal(assets.length,9);
 for(const a of assets){
  const bytes=fs.readFileSync('public/models/runtime/'+a.filename);
  assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(8),bytes.length);assert.equal(hash(bytes),a.outputSHA256);
  const model=await loadHeadlessGLB('public/models/runtime/'+a.filename);
  assert.ok(model.getObjectByName('Frame'));assert.ok(model.getObjectByName('Moving'));
  let count=0;model.traverse(m=>{if(!m.isMesh)return;count+=m.geometry.index.count/3;for(const value of m.geometry.attributes.position.array)assert.ok(Number.isFinite(value));assert.ok(m.geometry.attributes.color,'Original source colors are retained as baked vertex colors');});
  assert.ok(count>500&&count<7500);
  // The rejected scanned rocker is retained and hash-checked as a source,
  // while the rebuilt seventh room uses its own articulated geometry.
  assert.equal(CAMPAIGN.some(l=>l.assets.includes(a.id)),![34,36].includes(a.id));
 }
});
test('an idle flywheel cannot do work against a positive load or create stored energy',()=>{
 const w=new Flywheel();for(let n=0;n<600;n++)assert.equal(w.step(0,2.2,1/60),0);
 assert.equal(w.omega,0);assert.equal(w.energy,0);assert.equal(w.work,0);
});
test('flywheel coast loses energy to useful work and friction; a brake dissipates without reverse motion',()=>{
 const w=new Flywheel();for(let n=0;n<300;n++)w.step(24,0,1/60);const initial=w.energy;
 for(let n=0;n<600;n++)w.step(0,2.2,1/60);
 assert.ok(w.work>0&&w.work<initial);assert.ok(w.energy+w.work<initial);
 w.brake=true;for(let n=0;n<3600;n++)w.step(0,0,1/60);assert.ok(w.omega<1e-10);assert.ok(w.angle>0);
});
test('constant-torque and coast solutions agree at 30, 60 and 144 Hz',()=>{
 const results=[30,60,144].map(hz=>{const w=new Flywheel();for(let n=0;n<hz*5;n++)w.step(24,2.2,1/hz);for(let n=0;n<hz*7;n++)w.step(0,2.2,1/hz);return [w.energy,w.work,w.angle];});
 for(const r of results)r.forEach((v,i)=>assert.ok(Math.abs(v-results[0][i])<1e-7));
});
test('nonfinite and negative actuator input is rejected atomically',()=>{
 const w=new Flywheel();w.step(20,2,.1);const before=[w.angle,w.omega,w.work];
 for(const args of [[NaN,0,1],[2,-1,1],[2,0,-1],[2,Infinity,1]])assert.throws(()=>w.step(...args),RangeError);
 assert.deepEqual([w.angle,w.omega,w.work],before);
});
const g=await createHeadlessGame();
test('new plate centre, edge and corner support count, held or hovering objects do not',async()=>{
 await g.selectLevel(17,false);g.resetRun(true);const p=g.firstLevel.workshop.pad('contact-test',[8,0,10],4,4),f=p.surface.getFrame();
 for(const [x,z]of [[0,0],[1.9,0],[-1.9,0],[0,1.9],[0,-1.9],[1.9,1.9],[-1.9,-1.9]]){
  g.cargo.position.copy(f.center).add(V(x,.39,z));g.cargo.velocity.set(0,0,0);g.cargo.quaternion.identity();assert.equal(p.loaded(),true);
 }
 g.heldCube=g.cargo;assert.equal(p.loaded(),false);g.heldCube=null;g.cargo.position.y+=.5;assert.equal(p.loaded(),false);
});
test('articulation changes the derived moving part, not source cache or stationary frame',async()=>{
 await g.selectLevel(10,false);const f=g.firstLevel.fixtures.find(a=>a.id===31),frame=f.art.getObjectByName('Frame');
 f.art.updateWorldMatrix(true,true);const stationary=frame.matrixWorld.clone(),source=g.assets.get(31),sourceBefore=[];
 source.traverse(n=>sourceBefore.push(...n.position.toArray(),...n.quaternion.toArray(),...n.scale.toArray()));
 f.spin(1.1);f.art.updateWorldMatrix(true,true);assert.ok(frame.matrixWorld.equals(stationary));assert.ok(f.pivot.rotation.z>1);
 const sourceAfter=[];source.traverse(n=>sourceAfter.push(...n.position.toArray(),...n.quaternion.toArray(),...n.scale.toArray()));assert.deepEqual(sourceAfter,sourceBefore);
});
test('spring room latch resets physically and never stays enabled after restart',async()=>{
 await g.selectLevel(8,false);g.resetRun(true);const s=g.firstLevel.state.piston;s.latched=true;s.forces();g.resetRun(true);
 assert.equal(s.latched,false);assert.equal(s.body.type,1);assert.equal(g.firstLevel.state.door.open,false);assert.ok(s.body.position.y===s.restY);
});
test('power removal lowers an unsecured foundry lift, but the brake holds its actual location',async()=>{
 await g.selectLevel(19,false);g.resetRun(true);const l=g.firstLevel,s=l.state,lift=s['foundry-lift'],wheel=s.generator?.wheel||s.flywheel?.wheel;
 const turbine=Object.values(s).find(o=>o?.wheel);assert.ok(turbine);turbine.wheel.work=100;turbine.wheel.omega=20;
 for(let n=0;n<800;n++)l.update(1/120);assert.ok(lift.progress>.95);
 turbine.wheel.omega=0;for(let n=0;n<600;n++)l.update(1/120);assert.ok(lift.progress<.3);
 lift.locked=true;const position=lift.position.clone();for(let n=0;n<600;n++)l.update(1/120);assert.ok(lift.position.distanceTo(position)<1e-9);
});
test('twenty-level switching leaves no extra scene roots, bodies or collider references',async()=>{
 await g.selectLevel(0,false);const roots=g.scene.children.length,colliders=g.colliders.length,bodies=g.physics.world.bodies.length;
 for(let i=19;i>=0;i--)await g.selectLevel(i,false);
 assert.equal(g.scene.children.length,roots);assert.equal(g.colliders.length,colliders);assert.equal(g.physics.world.bodies.length,bodies);
 g.physics.dispose();g.portals.dispose();
});
