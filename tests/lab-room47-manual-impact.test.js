import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

test('47: real direct free-cargo energy fractures ceramic and jointly wins without any portal transfer',async()=>{
 const g=await createHeadlessGame();g.chamberEdition='foundation';await g.selectLevel(46,false);
 const cargo=g.cargo,body=g.physics.cargoBody,l=g.firstLevel;
 const plate=g.colliders.find(c=>Math.abs(c.box.min.x+3.3)<1e-7&&Math.abs(c.box.max.x-3.3)<1e-7&&Math.abs(c.box.min.y)<1e-7&&Math.abs(c.box.max.y-5.2)<1e-7);
 assert.ok(plate,'The real ceramic target must exist');
 let strongFreeContact=false,maximumObservedEnergy=0,frames=0;
 const collide=e=>{
  if(e.body.labId!==plate.mesh.uuid)return;
  const energy=.5*e.target.mass*e.contact.getImpactVelocityAlongNormal()**2;
  if(!g.heldCube){maximumObservedEnergy=Math.max(maximumObservedEnergy,energy);if(energy>=175)strongFreeContact=true;}
 };
 body.addEventListener('collide',collide);
 const visuals=g.updateVisuals;
 g.updateVisuals=function(...args){
  const result=visuals.apply(this,args);frames++;
  assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);
  assert.equal(g.teleportCount,0);assert.equal(g.physics.portalTransports,0);
  assert.equal(g.portals.ready,false);assert.ok(g.portals.portals.every(p=>!p));
  return result;
 };
 try{
  const route=await runV8Journey(g,{journeyOptions:{alternative:'manual-impact'}});
  assert.equal(route.pass,true);assert.equal(route.alternative,'manual-impact');
  assert.equal(route.resets+route.respawns,0);assert.ok(frames>0);
  assert.ok(strongFreeContact,'A merely missed target cannot pass the direct-impact alternate');
  assert.ok(maximumObservedEnergy>=175);assert.ok(l.fuse.energy>=175);
  assert.equal(l.fuse.broken,true);assert.equal(l.fuse.bodies.length,16);
  assert.equal(plate.enabled,false);assert.equal(g.physics.solids.get(plate.mesh.uuid).body.collisionFilterMask,0);
  assert.equal(g.state,'won');assert.equal(g.heldCube,cargo);assert.ok(g.playerGrounded);
  assert.ok(l.goal.contains(g.playerPosition)&&l.goal.contains(g.cargo.position));
 }finally{body.removeEventListener('collide',collide);g.updateVisuals=visuals;g.firstLevel.dispose?.();g.physics.dispose();g.portals.dispose();}
});
