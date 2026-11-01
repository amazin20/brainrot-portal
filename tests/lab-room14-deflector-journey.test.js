import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {ACTIVE_FOUNDATION_RUNTIME_FLAGS} from '../src/game/ReleaseIdentity.js';
import {loadRoom14Freight,prepareRoom14Freight,room14InputControls,room14CargoSettled} from '../src/game/LabRoom14Journey.js';
import {compoundCargoBoxPose,compoundCargoBoxSeparation} from '../src/game/LabCompoundCargoSweep.js';

const V=(...p)=>new THREE.Vector3(...p);
async function game14(aspect=16/9){
 const game=await createHeadlessGame();game.chamberEdition='foundation';
 Object.assign(game,ACTIVE_FOUNDATION_RUNTIME_FLAGS);
 game.camera.aspect=aspect;game.camera.updateProjectionMatrix();
 await game.selectLevel(13,true);return game;
}
function dispose(game){game.firstLevel?.dispose?.();game.physics?.dispose();game.portals?.dispose();}
function identity(game){return {cargo:game.cargo,body:game.physics.cargoBody,shape:game.physics.cargoBody.shapes[0]};}
function same(game,id){
 assert.equal(game.cargo,id.cargo);assert.equal(game.physics.cargoBody,id.body);
 assert.equal(id.body.shapes[0],id.shape);assert.equal(id.body.mass,3.2);
 assert.deepEqual(id.shape.halfExtents.toArray(),[.39,.39,.39]);
}
function evidence(game,id){
 const samples={oblique:false,contact:false};
 const record=(p,normal,point)=>{
  samples.contact=true;
  const q=p.mesh.quaternion,longNormal=V(0,0,1).applyQuaternion(q);
  const localPoint=point.clone().sub(p.mesh.position).applyQuaternion(q.clone().invert());
  samples.oblique ||= Math.abs(normal.dot(longNormal))>.99
   &&Math.abs(longNormal.x)>.6&&Math.abs(longNormal.z)>.6
   &&Math.abs(localPoint.x)<p.mesh.scale.x/2-.04;
 };
 const observe=()=>{
  const pieces=game.firstLevel.state.lightContact.pieces;
  for(const p of pieces){
   for(const c of game.physics.world.contacts){
    if(c.bi!==id.body&&c.bj!==id.body)continue;
    if(c.bi!==p.body&&c.bj!==p.body)continue;
    const r=c.bi===p.body?c.ri:c.rj;
    record(p,V().copy(c.ni),V().copy(p.body.position).add(V().copy(r)));
   }
   for(const c of game.physics.lastCompoundCargoSweep?.corrections??[]){
    if(c.registrationId!==p.mesh.uuid||c.guardBodyId!==p.body?.id||c.shapeId!==p.shape?.id)continue;
    record(p,V(...c.normal),V(...c.point));
   }
  }
 };
 game.physics.world.addEventListener('postStep',observe);
 return {samples,dispose(){game.physics.world.removeEventListener('postStep',observe);}};
}
function noResets(report){assert.equal(report.resets,0);assert.equal(report.respawns,0);assert.equal(report.pass,true);}

for(const [aspect,order] of [[16/9,'freight-first'],[390/844,'scout-first']]){
 test(`room14 current ${order} route at ${aspect} uses a real light contact and the unchanged original body`,{timeout:180000},async()=>{
  const game=await game14(aspect),id=identity(game),proof=evidence(game,id);
  try{
   const report=await runV8Journey(game,{journeyOptions:{nativeStart:true,order}});
   noResets(report);same(game,id);assert.equal(game.state,'won');
   assert.ok(proof.samples.contact&&proof.samples.oblique,'Delivery must include the actual configured registered contact normal');
   assert.ok(report.milestones.some(m=>m.name==='light contact carries the original companion across the unsupported turn'));
   assert.ok(game.teleportCount>=1);assert.equal(game.physics.portalTransports,0,'The narrow optical mouth does not secretly transport the cargo');
   console.log('ROOM14_CONTACT_ROUTE',JSON.stringify({aspect,order,frames:report.frames,teleports:report.teleports,
    cargo:game.cargo.position.toArray(),player:game.playerPosition.toArray(),body:id.body.id,shape:id.shape.id,contact:proof.samples}));
  }finally{proof.dispose();dispose(game);}
 });
}

test('room14 real charged light readdressing with the blower off cannot deliver the waiting original', {timeout:180000},async()=>{
 const game=await game14(),id=identity(game);
 let maxCargoX=-Infinity,everInTarget=false;
 const observe=()=>{maxCargoX=Math.max(maxCargoX,id.body.position.x);everInTarget ||= game.firstLevel.readability.cargoTarget.containsPoint(id.body.position);};
 game.physics.world.addEventListener('postStep',observe);
 try{
  const report=await runV8Journey(game,{journeyOptions:{nativeStart:true},scenario:async d=>{
   const t=await prepareRoom14Freight(d,{light:'none'}),level=game.firstLevel;
   assert.equal(level.readability.fan.enabled,false);
   t.north();d.walk(2,5);t.shot(1,'contact-turn');d.wait(2);
   // These are ordinary charged impacts on both actual addresses. They do
   // not clear the portals, write an actor pose or alter a mechanism flag.
   d.walk(12,5);d.walk(12,-7);t.shot(1,'passenger-arrival');d.walk(12,5);d.walk(2,5);t.shot(1,'contact-turn');d.wait(5);
   assert.equal(level.readability.fan.enabled,false);assert.equal(game.state,'playing');
   assert.equal(level.readability.cargoTarget.containsPoint(game.cargo.position),false);
   assert.ok(maxCargoX< -3,'Quiet curiosity must not cross the horizontal feeding distance');
   assert.equal(everInTarget,false,'The original must never enter freight during the actual charged-shot negative');
   d.mark('real charged readdressing leaves the unpowered original outside freight');
  }});
  noResets(report);same(game,id);
  console.log('ROOM14_NO_AIR',JSON.stringify({maxCargoX,everInTarget,frames:report.frames,resets:report.resets,respawns:report.respawns}));
 }finally{game.physics.world.removeEventListener('postStep',observe);dispose(game);}
});

test('room14 genuine charged readdress materializes up to a nearby original cargo instead of ejecting it with the fan off',{timeout:180000},async()=>{
 const game=await game14(),id=identity(game);
 try{
  const report=await runV8Journey(game,{journeyOptions:{nativeStart:true},scenario:d=>{
   const t=room14InputControls(d),level=game.firstLevel;
   d.walk(-15,4);t.shot(0,'contact-intake');
   for(let n=0;n<5&&!game.heldCube;n++){
    d.walk(game.cargo.position.x,game.cargo.position.z+1.2);game.interact();d.wait(.3);
   }
   assert.equal(game.heldCube,id.cargo);t.north();d.walk(-5,5);d.walk(-5,1.5);d.walk(-3.7,1.5);d.walk(-3.7,2.7);
   for(let n=0;n<30;n++){d.worldMove(.18,0);d.frame();}d.stop();d.wait(.5);game.interact();d.wait(.3);
   assert.equal(game.heldCube,null);assert.equal(level.readability.fan.enabled,false);
   const point=level.panels['contact-turn'].getFrame().center.clone();point.y=1.25;d.look(point);
   const before=game.cargo.position.clone();assert.equal(game.firePortal(1),true);
   d.until(()=>game.portalShots.queue.length===0&&game.portalShots.active.length===0,2,'The actual nearby readdress never completed its charge');d.wait(.05);
   assert.equal(game.portalShots.lastImpact?.valid,true);
   const mesh=level.panels['contact-turn'].mesh;assert.equal(game.portalSurfaceIds[1],mesh.userData.portalColliderId??mesh.uuid);
   assert.equal(level.state.lightContact.materializationBlocked,true,'The ordinary release must occupy the actual new sheet sweep');
   d.wait(.35);
   const displacement=Math.hypot(game.cargo.position.x-before.x,game.cargo.position.z-before.z);
   assert.ok(displacement<.15,'A charged readdress must not manufacture the old multi-metre penetration launch');
   assert.equal(level.readability.fan.enabled,false);assert.equal(level.readability.cargoTarget.containsPoint(game.cargo.position),false);assert.equal(game.state,'playing');
   d.mark('the new sheet ends at the nearby unchanged original instead of appearing inside it');
   console.log('ROOM14_CHARGED_MATERIALIZATION',JSON.stringify({before:before.toArray(),after:game.cargo.position.toArray(),displacement,blocked:level.state.lightContact.materializationBlocked}));
  }});
  noResets(report);same(game,id);
 }finally{dispose(game);}
});

for(const light of ['none','wrong-target'])test(`room14 ${light} misses the turn and the same original is recoverable for a complete retry`,{timeout:240000},async()=>{
 const game=await game14(),id=identity(game);let miss;
 try{
  const report=await runV8Journey(game,{journeyOptions:{nativeStart:true},scenario:async d=>{
   const t=await prepareRoom14Freight(d,{light}),level=game.firstLevel;t.useFan();
   d.until(()=>game.cargo.position.x>9,12,'The genuine failed optical setup did not reach the straight catch route');
   t.useFan();assert.equal(level.readability.fan.enabled,false);d.wait(3);
   assert.equal(game.state,'playing');assert.equal(level.readability.cargoTarget.containsPoint(game.cargo.position),false);
   miss=game.cargo.position.toArray();
   d.mark('actual straight-path miss remains in the connected recovery geometry');
   t.north();d.walk(2,5);t.shot(1,'contact-turn');d.walk(12,5);
   if(game.cargo.position.y< -1.5){d.walk(17,5);d.walk(17,-12.3);}
   for(let n=0;n<5&&!game.heldCube;n++){
    d.walk(game.cargo.position.x,game.cargo.position.z+1.2);game.interact();d.wait(.3);
   }
   assert.equal(game.heldCube,id.cargo,'The retry must recover the actual missed body');
   if(game.playerPosition.y< -1.5){d.walk(17,-12.3);d.walk(14,-12.3);d.walk(14,-6);}
   d.walk(12,5);t.west();await loadRoom14Freight(d,t);t.useFan();
   d.until(()=>room14CargoSettled(game,level),12,'The recovered original did not land the real second attempt');
   t.passengerPair();d.enter(level.panels['passenger-departure']);d.walk(2.65,-3.1);
   d.until(()=>game.state==='won',4,'A recoverable physical miss did not lead to a complete retry');
   d.mark('the same original finishes after the real optical miss and recovery');
  }});
  noResets(report);same(game,id);assert.equal(game.state,'won');
  console.log('ROOM14_MISS_RECOVERY',JSON.stringify({light,miss,finish:game.cargo.position.toArray(),frames:report.frames,resets:report.resets,respawns:report.respawns,body:id.body.id,shape:id.shape.id}));
 }finally{dispose(game);}
});

test('room14 carrying along the passenger route and pushing at the real window cannot satisfy the spatial freight target',{timeout:180000},async()=>{
 const game=await game14(),id=identity(game);
 try{
  const report=await runV8Journey(game,{journeyOptions:{nativeStart:true},scenario:d=>{
   const t=room14InputControls(d),level=game.firstLevel;t.passengerPair();
   for(let n=0;n<5&&!game.heldCube;n++){
    d.walk(game.cargo.position.x,game.cargo.position.z+1.2);game.interact();d.wait(.3);
   }
   assert.equal(game.heldCube,id.cargo);d.enter(level.panels['passenger-departure']);d.walk(3,-3.1);
   for(let n=0;n<180;n++){d.worldMove(-1,0);d.frame();}d.stop();
   assert.equal(game.heldCube,id.cargo);assert.equal(game.state,'playing');
   const window=level.readability.window,guard=game.physics.solids.get(window.uuid);
   assert.ok(guard?.inWorld,'The observed glass must own a current actual solid');
   const separation=compoundCargoBoxSeparation(compoundCargoBoxPose(id.body,0),compoundCargoBoxPose(guard.body,0));
   assert.ok(separation.gap>=-2e-4,'The full original body must remain outside the glass');
   assert.ok(game.cargo.position.x>2.1);assert.equal(level.readability.cargoTarget.containsPoint(game.cargo.position),false);
   game.interact();d.wait(.6);assert.equal(game.heldCube,null);
   assert.equal(game.state,'playing');assert.ok(game.cargo.position.x>2.1);
   // Check the entire reachable hand-height window grid against the actual
   // rendered blocker. These are rays, never actor-position assignments.
   for(const y of [-.3,.2,.7])for(const z of [-3.9,-3.1,-2.3]){
    const from=V(2.45,y,z),to=V(.9,-1.01,z),delta=to.clone().sub(from),ray=new THREE.Raycaster(from,delta.normalize(),0,from.distanceTo(to));
    assert.ok(ray.intersectObject(window,false).length>0,'The real glass must block every tested near-hand line');
   }
   d.mark('carried original reaches passenger gallery but the solid partition keeps it outside freight');
   console.log('ROOM14_CARRY_WINDOW',JSON.stringify({cargo:game.cargo.position.toArray(),player:game.playerPosition.toArray(),separation:separation.gap,handRays:9,won:game.state==='won'}));
  }});
  noResets(report);same(game,id);
 }finally{dispose(game);}
});
