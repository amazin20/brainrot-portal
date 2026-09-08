import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
const game=await createHeadlessGame(),V=(...p)=>new THREE.Vector3(...p);
after(()=>{game.physics.dispose();game.portals.dispose();});

// The sorter and ferry rooms were retired. These tests exercise the shared
// actuator components in explicit test fixtures, without restoring old rooms.
async function fixture(){
 await game.selectLevel(9,false);game.resetRun(true);
 return game.firstLevel.workshop;
}
test('fan rotor accelerates and coasts smoothly while disabled fan supplies no invisible air',async()=>{
 const kit=await fixture(),fan=kit.fan('rotor-test',[8,2.1,10],[-1,0,0]);
 fan.enabled=true;fan.update(.2);assert.ok(fan.rotorSpeed>0&&fan.rotorSpeed<9);const moving=fan.rotorSpeed;
 fan.enabled=false;fan.update(.2);assert.ok(fan.rotorSpeed>0&&fan.rotorSpeed<moving);assert.equal(fan.segments.length,0);
 assert.deepEqual(fan.acceleration(V(),V()).toArray(),[0,0,0]);
 game.resetRun(true);assert.equal(fan.rotorSpeed,0);assert.equal(fan.art.pivot.rotation.z,0);
});
test('fan rotor integration matches elapsed time at 30, 60 and 144 render Hz',async()=>{
 const kit=await fixture(),f=kit.fan('rotor-time-test',[8,2.1,10],[-1,0,0]),values=[];
 for(const hz of [30,60,144]){
  game.resetRun(true);f.enabled=true;for(let i=0;i<hz*2;i++)f.update(1/hz);
  f.enabled=false;for(let i=0;i<hz;i++)f.update(1/hz);values.push([f.rotorSpeed,f.art.pivot.rotation.z]);
 }
 for(const pair of values)pair.forEach((value,i)=>assert.ok(Math.abs(value-values[0][i])<1e-9));
});
test('render interpolation never adds phantom deck travel to the physical passenger',async()=>{
 const kit=await fixture(),lift=kit.slider('interpolation-test',[8,0,10],[8,5,10],{portal:false,asset:37}),heights=[];
 // This fixture is attached after room construction, so register its moving
 // body exactly as the game does for authored colliders during buildLevel.
 game.physics.addStaticBox(lift.mesh.uuid,lift.collider.box,{kinematic:true});
 for(const alpha of [1,0,.37]){
  game.resetRun(true);game.playerPosition.copy(lift.position);game.previousPlayerPosition.copy(game.playerPosition);game.playerGrounded=true;lift.target=1;
  for(let n=0;n<240;n++){
   lift.update(1/120);assert.ok(Math.abs(game.playerPosition.y-lift.floor.y)<1e-9,'Passenger was carried by render history instead of committed physical travel');
   lift.render(alpha);
  }
  heights.push(game.playerPosition.y);
 }
 assert.ok(heights.every(y=>Math.abs(y-heights[0])<1e-9));
});
