import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
const game=await createHeadlessGame(),V=(...p)=>new THREE.Vector3(...p);
test('roller receiving cup cannot be reached by hand through any closed side',async()=>{
 await game.selectLevel(17,false);
 for(const [actor,cargo]of [ [[0,0,-7.4],[0,.57,-5.6]], [[2.3,0,-4.6],[.5,.57,-4.6]], [[-2.3,0,-4.6],[-.5,.57,-4.6]] ]){
  game.resetRun(true);game.playerPosition.fromArray(actor);game.previousPlayerPosition.copy(game.playerPosition);
  game.cargo.position.fromArray(cargo);game.physics.resetCargo(game.cargo.position);
  assert.ok(game.playerPosition.clone().add(V(0,1.1,0)).distanceTo(game.cargo.position)<2.25,'Probe must be inside normal pickup reach');
  assert.equal(game.toggleCube(),false,'Closed physical cover must stop direct pickup');
  assert.equal(game.heldCube,null);assert.equal(game.firstLevel.state['sort-lock'].engaged,false);
 }
});
test('sorter access physically opens after load and closes on restart without changing its pad',async()=>{
 await game.selectLevel(17,false);game.resetRun(true);const l=game.firstLevel,shields=l.state.sorterShields;
 assert.equal(shields.length,6);const initial=shields.map(s=>s.mesh.position.clone());
 // Deliberate actuator fixture, distinct from the normal-control solution route.
 l.state['sort-lock'].engaged=true;for(let n=0;n<240;n++)l.update(1/120);
 for(let i=0;i<shields.length;i++)assert.ok(shields[i].mesh.position.y>initial[i].y+5.9);
 game.resetRun(true);for(let i=0;i<shields.length;i++)assert.ok(shields[i].mesh.position.distanceTo(initial[i])<1e-8);
 assert.equal(l.state['sort-lock'].engaged,false);
});
test('fan rotor accelerates and coasts smoothly while disabled fan supplies no invisible air',async()=>{
 await game.selectLevel(10,false);game.resetRun(true);const fan=game.firstLevel.state.blower;
 fan.enabled=true;fan.update(.2);assert.ok(fan.rotorSpeed>0&&fan.rotorSpeed<9);const moving=fan.rotorSpeed;
 fan.enabled=false;fan.update(.2);assert.ok(fan.rotorSpeed>0&&fan.rotorSpeed<moving);assert.equal(fan.segments.length,0);
 assert.deepEqual(fan.acceleration(V(),V()).toArray(),[0,0,0]);
 game.resetRun(true);assert.equal(fan.rotorSpeed,0);assert.equal(fan.art.pivot.rotation.z,0);
});
test('fan rotor integration matches elapsed time at 30, 60 and 144 render Hz',async()=>{
 await game.selectLevel(10,false);const values=[];
 for(const hz of [30,60,144]){game.resetRun(true);const f=game.firstLevel.state.blower;f.enabled=true;for(let i=0;i<hz*2;i++)f.update(1/hz);f.enabled=false;for(let i=0;i<hz;i++)f.update(1/hz);values.push([f.rotorSpeed,f.art.pivot.rotation.z]);}
 for(const pair of values)pair.forEach((value,i)=>assert.ok(Math.abs(value-values[0][i])<1e-9));
});
test('manual ferry winch has a physical return direction and bounded movement without a portal pair',async()=>{
 await game.selectLevel(16,false);game.resetRun(true);const l=game.firstLevel,s=l.state;
 s['sail-returnControl'].action();assert.equal(s.sailPhysics.recalling,true);
 // At the west end the spool releases, rather than oscillating past its stop.
 for(let n=0;n<60;n++)l.update(1/120);assert.equal(s.sailPhysics.recalling,false);assert.equal(s.sail.progress,0);assert.equal(s.sailPhysics.velocity,0);
 assert.equal(game.portals.ready,false);assert.ok(l.fixtures.some(f=>f.id===39));
});
test('winch reset clears the recall state and spool motion',async()=>{
 await game.selectLevel(16,false);const s=game.firstLevel.state;s.sailPhysics.recalling=true;game.resetRun(true);
 assert.equal(s.sailPhysics.recalling,false);assert.equal(s.sailPhysics.velocity,0);assert.equal(s.sail.progress,0);
 game.physics.dispose();game.portals.dispose();
});
