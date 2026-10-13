import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runRoom14} from '../src/game/LabRoom14Journey.js';
import {installRoom21Aim} from '../src/game/LabRoom21Journey.js';

function measure(g){
 const stair=g.firstLevel.state.counterweightStair;
 return stair.parts.flatMap(part=>part.colliders.map(c=>({c,local:c.mesh.position.clone(),scale:c.mesh.scale.clone(),quaternion:c.mesh.quaternion.clone()})));
}
function assertPose(g,reference,label){
 const stair=g.firstLevel.state.counterweightStair;
 for(const {c,local,scale,quaternion}of reference){
  assert.ok(c.mesh.position.distanceTo(local)<1e-8,`${label}: a parented step changed its authored local position`);
  assert.ok(c.mesh.scale.distanceTo(scale)<1e-8,`${label}: a parented step changed its authored scale`);
  assert.ok(c.mesh.quaternion.angleTo(quaternion)<1e-8,`${label}: a parented step changed its authored orientation`);
  const world=new THREE.Box3().setFromObject(c.mesh);
  assert.ok(c.box.min.distanceTo(world.min)<1e-7&&c.box.max.distanceTo(world.max)<1e-7,`${label}: collision diverged from the actual world mesh`);
  const item=g.physics.solids.get(c.mesh.uuid);
  assert.ok(item,`${label}: the original physical step body must remain registered`);
  assert.ok(item.target.distanceTo(world.getCenter(new THREE.Vector3()))<1e-7,`${label}: the original Cannon body must target the actual world bounds`);
 }
 for(const part of stair.parts)assert.ok(Math.abs(part.surface.floor.y-part.baseY-stair.offset)<1e-8,`${label}: walking top must follow the same absolute stair pose`);
}

test('room14 unloaded steps keep their local pose, visible world bounds and real physical targets after long idle and normal restarts',async()=>{
 const g=await createHeadlessGame();g.chamberEdition='foundation';await g.selectLevel(13,false);
 try{
  const reference=measure(g),cargo=g.cargo,body=g.physics.cargoBody;
  assertPose(g,reference,'initial normal Play');
  for(let n=0;n<3600;n++){
   g.updatePlaying(1/120);if(n%2===1)g.updateVisuals(1/60,1);
   if(n%120===0)assertPose(g,reference,`idle tick ${n}`);
  }
  assertPose(g,reference,'30-second idle');
  for(let n=0;n<3;n++){g.restart();g.updatePlaying(1/120);g.updateVisuals(1/60,1);assertPose(g,reference,`normal restart ${n}`);}
  assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);assert.equal(g.firstLevel.state.counterweightStair.offset,-7.2);
 }finally{g.physics.dispose();g.portals.dispose();}
});

test('room14 canonical ordinary-input route preserves parented geometry through actual unloaded, loaded and separately delivered cargo transitions',async()=>{
 const g=await createHeadlessGame();g.chamberEdition='foundation';await g.selectLevel(13,false);
 const reference=measure(g),cargo=g.cargo,body=g.physics.cargoBody,update=g.updatePlaying;
 let low=false,raised=false,lowering=false,previousOffset=g.firstLevel.state.counterweightStair.offset,steps=0;
 g.updatePlaying=function(dt){const value=update.call(this,dt),offset=this.firstLevel.state.counterweightStair.offset;steps++;if(offset< -7.19)low=true;if(offset>-.01)raised=true;if(offset<previousOffset-.0001)lowering=true;previousOffset=offset;assertPose(this,reference,`ordinary route physics tick ${steps}`);return value;};
 try{
  const result=await runV8Journey(g,{scenario:async d=>{installRoom21Aim(d);await runRoom14(d);}});
  assert.equal(g.state,'won');assert.equal(result.resets,0);assert.equal(result.respawns,0);
  assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);
  assert.ok(low&&raised&&lowering,'The same real stair must lower and raise under actual cargo load changes');
  assert.ok(g.physics.portalTransports>0,'The original companion must still use the independent authored freight route');
 }finally{g.updatePlaying=update;g.physics.dispose();g.portals.dispose();}
});
