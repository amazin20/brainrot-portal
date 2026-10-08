import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runRoom50WeakDetentDelivery,recoverRoom50WeakCargo} from '../scripts/lib/room50-detent-route.mjs';

async function room(){const g=await createHeadlessGame();g.chamberEdition='foundation';await g.selectLevel(49,false);return g;}
function dispose(g){g.firstLevel.dispose?.();g.physics.dispose();g.portals.dispose();}

test('50: genuine weak contact and three free recovery jumps stay behind the detent before late original-cargo pickup',async()=>{
 const g=await room(),cargo=g.cargo,body=g.physics.cargoBody,l=g.firstLevel;
 const contacts=[];let minimumAngle=0,maximumGuard=0;
 const collide=e=>{if(e.body===l.top.body&&!g.heldCube)contacts.push({step:g.physics.world.stepnumber,speed:e.contact.getImpactVelocityAlongNormal()});};
 const visuals=g.updateVisuals;
 body.addEventListener('collide',collide);
 g.updateVisuals=function(...args){const result=visuals.apply(this,args);minimumAngle=Math.min(minimumAngle,l.top.angle);maximumGuard=Math.max(maximumGuard,l.bumper.progress);return result;};
 try{
  const route=await runV8Journey(g,{scenario:async d=>{
   await runRoom50WeakDetentDelivery(d);
   // Require the real gentle target contact and closed physical crossing
   // before recovery: retrieving a missed delivery cannot pass this test.
   assert.ok(contacts.length>0,'A missed actual top.body contact is an incomplete test');
   assert.ok(Math.abs(contacts[0].speed)>0&&Math.abs(contacts[0].speed)<2,'The original free body must reach the real wall gently');
   assert.ok(minimumAngle>-.14,'A weak genuine contact must stay inside the manufactured detent');
   assert.ok(Math.abs(l.top.angle)<.03,'The wall must settle near upright after actual weak contact');
   assert.equal(l.bumper.target,false);assert.equal(maximumGuard,0);assert.equal(g.state,'playing');
   // Without early E the old thin guard let one jump push the still-free
   // cargo into the wall, release its detent and reach joint victory. Require
   // that exact ordinary interaction family to hold after a reached target.
   recoverRoom50WeakCargo(d,{freeJumps:3,pickupDelayFrames:3});
  }});
  assert.equal(route.pass,true);assert.equal(route.resets+route.respawns,0);
  assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);
  assert.equal(g.physics.portalTransports,1);
  assert.equal(g.heldCube,cargo,'The same original body must be recoverable without restarting');
  assert.ok(g.playerGrounded&&Math.abs(g.playerPosition.y)<.01,'Recovery must return to the actual south dock');
  assert.ok(g.cargo.position.y<2&&g.cargo.position.z>1,'The held body must physically leave its guard support');
  assert.ok(minimumAngle>-.14,'Ordinary recovery must preserve the stable detent');
  assert.equal(l.bumper.target,false);assert.equal(maximumGuard,0);assert.equal(g.state,'playing');
 }finally{body.removeEventListener('collide',collide);g.updateVisuals=visuals;dispose(g);}
});

for(const alternative of [undefined,'free-cargo-bridge'])test(`50: a strong real impact still completes ${alternative||'canonical'} with the original companion`,async()=>{
 const g=await room(),cargo=g.cargo,body=g.physics.cargoBody,l=g.firstLevel;
 let strongFreeContact=false;
 const collide=e=>{if(e.body===l.top.body&&!g.heldCube&&Math.abs(e.contact.getImpactVelocityAlongNormal())>15)strongFreeContact=true;};
 body.addEventListener('collide',collide);
 try{
  const route=await runV8Journey(g,{journeyOptions:alternative?{alternative}:{}});
  assert.equal(route.pass,true);assert.equal(route.resets+route.respawns,0);
  assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);
  assert.ok(strongFreeContact,'The route must actually strike top.body with the original free cargo');
  assert.ok(l.top.angle< -1.45);assert.ok(l.bumper.progress>.95);assert.equal(g.state,'won');
 }finally{body.removeEventListener('collide',collide);dispose(g);}
});
