import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

test('23 ordinary shaft fall restarts the entire physical room with the same original',async()=>{
 const g=await createHeadlessGame();g.room23PhysicalPrototype=true;await g.selectLevel(22,false);
 const m=g.firstLevel.balance,original=g.physics.cargoBody,shape=original.shapes[0],traveller=m.traveller.body;
 let lowestFoot=Infinity,observedRestart=false;
 const observe=()=>{lowestFoot=Math.min(lowestFoot,g.playerPosition.y);};g.physics.world.addEventListener('postStep',observe);
 try{
  // The proof driver rejects in-route deaths by design. This deliberately
  // walks off the ordinary court into the open east shaft and expects that
  // rejection only after the game's whole-room restart has actually occurred.
  await assert.rejects(runV8Journey(g,{scenario:async d=>{
   d.walk(10,10);d.walk(10,3);d.worldMove(-1,0);
   for(let n=0;n<480;n++)d.frame();
  }}),error=>{observedRestart=/unexpected reset/.test(error.message);return observedRestart;});
  assert.ok(lowestFoot<-12);assert.ok(lowestFoot>-13,'The character must not continue falling indefinitely');
  assert.equal(g.physics.cargoBody,original);assert.equal(original.shapes[0],shape);assert.equal(m.traveller.body,traveller);
  assert.equal(m.ownershipValid(),true);assert.equal(m.diagnostics().fault,null);
  assert.ok(g.playerPosition.distanceTo({x:-17,y:0,z:15})<.02);
  assert.ok(original.position.distanceTo({x:-3.1,y:.6,z:3})<.02);
  assert.ok(Math.abs(m.height)<.01);assert.equal(m.clutchRequested,false);assert.equal(m.brakeRequested,true);
  assert.ok(g.portals.portals.every(p=>p===null));assert.equal(g.state,'playing');
  assert.equal(g.firstLevel.puzzleGeometry.declaredInitialComponentFixture,false);
 }finally{g.physics.world.removeEventListener('postStep',observe);g.firstLevel.dispose();g.physics.dispose();g.portals.dispose();}
});
