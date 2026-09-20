import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Room24Accumulator} from '../src/game/LabRoom24Pneumatics.js';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runRoom24} from '../src/game/LabRoom24Journey.js';
const g=await createHeadlessGame();after(()=>{g.physics.dispose();g.portals.dispose();});
test('the pressure reservoir cannot create energy, charges only from feed, leaks and pays for cylinder displacement',()=>{
 const p=new Room24Accumulator();p.step(30);assert.equal(p.pressure,0);p.step(2,{feed:true});assert.ok(p.pressure>2.9&&p.pressure<3);
 const charged=p.pressure;p.step(0,{liftTravel:.5});assert.ok(Math.abs(charged-p.pressure-1.1)<1e-9);
 const afterLift=p.pressure;p.step(0,{bridgeTravel:.2});assert.ok(Math.abs(afterLift-p.pressure-.56)<1e-9);
 p.step(1000);assert.equal(p.pressure,0);assert.ok(p.used>1.6);assert.throws(()=>p.step(-1),RangeError);
});
for(const options of [{},{order:'isolate-first',interruptFeed:true,storageDelay:60}])test(`room24 real pressure/cargo route ${JSON.stringify(options)}`,async()=>{
 await g.selectLevel(23,false);const body=g.physics.cargoBody;let filled=0;
 const r=await runV8Journey(g,{scenario:d=>runRoom24({...d,mark(name){
  const p=d.level.state.pneumatic;
  if(name==='closed cylinder retains the first crossing'){filled=p.pressure;assert.equal(p.liftValve,false);assert.ok(filled>9.7);}
  if(name==='portal pair retrieves the original friend'){assert.equal(p.feed,false);assert.ok(p.pressure<filled);assert.ok(d.level.state['pressure-lift'].position.y>7.9);assert.ok(g.cargo.position.y>8);}
  if(name==='finite reserve carries both travellers'){assert.equal(p.bridgeValve,true);assert.equal(g.heldCube,null);assert.ok(g.playerPosition.y>7.9);}
  d.mark(name);
 }},options)});
 assert.equal(g.state,'won');assert.equal(r.resets+r.respawns,0);assert.equal(g.physics.cargoBody,body);assert.ok(g.firstLevel.state.pneumatic.used>4.9);assert.ok(g.heldCube);
 for(const name of ['pressure-lift deck','pressure-ferry deck']){const surface=g.firstLevel.world.surfaces.find(s=>s.name===name),backing=g.colliders.find(c=>c.mesh===surface.backing);assert.equal(backing,undefined);assert.equal(surface.collider.kinematic,true);assert.ok(surface.collider.box.equals(new THREE.Box3().setFromObject(surface.mesh)));}
});
