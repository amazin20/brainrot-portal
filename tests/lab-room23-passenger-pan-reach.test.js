import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

test('23 ordinary repeated backstop jumps cannot load the freight spring with the passenger',async()=>{
 const g=await createHeadlessGame();g.room23PhysicalPrototype=true;await g.selectLevel(22,false);
 const m=g.firstLevel.balance,original=g.physics.cargoBody,shape=original.shapes[0];
 let maxPanSupport=0,maxCabinSupport=0;
 const observe=()=>{
  for(const c of g.physics.world.contacts){
   if(c.enabled===false||c.multiplier<=0)continue;
   const other=c.bi===m.traveller.body?c.bj:c.bj===m.traveller.body?c.bi:null;
   const up=c.bi===m.traveller.body?-c.ni.y:c.bj===m.traveller.body?c.ni.y:0;
   if(up<.65)continue;
   if(m.cars.some(car=>car.panBody===other))maxPanSupport=Math.max(maxPanSupport,c.multiplier*up);
   if(m.cars.some(car=>car.body===other))maxCabinSupport=Math.max(maxCabinSupport,c.multiplier*up);
  }
 };g.physics.world.addEventListener('postStep',observe);
 try{
  const report=await runV8Journey(g,{scenario:async d=>{
   d.walk(-7.5,5.6);assert.ok(g.interact());d.wait(6);
   d.walk(-8.5,3);d.walk(-8.5,-1);d.walk(-5.5,-1);d.walk(-5.5,1);assert.ok(g.interact());d.wait(20);
   // This exact ordinary-input approach previously put 1,117 N on the
   // pan-mounted bumper without the original touching either freight spring.
   for(let n=0;n<480;n++){
    if(g.playerGrounded&&n%10===0)g.input.jumpQueued=true;
    const dx=-1.1-g.playerPosition.x,dz=4.7-g.playerPosition.z,len=Math.hypot(dx,dz);
    d.worldMove(len>.05?dx/len:0,len>.05?dz/len:0);d.frame();
   }d.stop();
  }});
  assert.equal(report.resets+report.respawns,0);assert.equal(g.state,'playing');
  assert.ok(maxCabinSupport>950,'The same real passenger must still load its cabin');
  assert.ok(maxPanSupport<1,'A reachable bumper top must not feed passenger weight into the cargo-only spring');
  assert.equal(g.physics.cargoBody,original);assert.equal(original.shapes[0],shape);assert.equal(m.ownershipValid(),true);
  assert.ok(m.height<.01,'No initial ascent may be obtained without the raised original');
 }finally{g.physics.world.removeEventListener('postStep',observe);g.firstLevel.dispose();g.physics.dispose();g.portals.dispose();}
});
