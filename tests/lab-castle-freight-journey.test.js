import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runSingularityJourney} from '../src/game/LabSingularityJourney.js';
import {SINGULARITY_ROOMS} from '../src/game/LabSingularityLayout.js';

const V=(...v)=>new THREE.Vector3(...v);
const positiveOverlap=(a,b)=>['x','y','z'].every(axis=>Math.min(a.max[axis],b.max[axis])-Math.max(a.min[axis],b.min[axis])>1e-6);
function supportWitness(game,mesh,originalBody,originalShape){
 const entry=game.physics.solids.get(mesh.uuid),support=entry?.body,shape=support?.shapes[0];
 assert.ok(entry&&support&&shape,'The authored tray must retain its actual supporting Cannon Box');
 const equations=game.physics.world.contacts.filter(c=>c.enabled!==false&&c.multiplier>1e-6
  &&[c.bi,c.bj].includes(originalBody)&&[c.bi,c.bj].includes(support)
  &&[c.si,c.sj].includes(originalShape)&&[c.si,c.sj].includes(shape)
  &&(c.bi===originalBody?-c.ni.y:c.ni.y)>.65);
 assert.ok(equations.length>0,'A loaded tray requires current positive original-body support contacts');
 assert.equal(entry.inWorld,true);assert.equal(support.world,game.physics.world);
 assert.equal(game.heldCube,null);assert.equal(game.physics.carryTarget,null);
 return{worldStep:game.physics.world.stepnumber,bodyId:support.id,shapeId:shape.id,
  normalForce:equations.reduce((n,c)=>n+(c.bi===originalBody?-c.ni.y:c.ni.y)*c.multiplier,0)};
}

// Both runs use the production journey's walk, aimed portal shots, E, release
// and pickup inputs. The observer reads live actors and colliders only; it
// never stages a tray contact, opens a gate or grants a completed mechanism.
for(const freightReturn of ['gate','portal'])test(`freight ordinary ${freightReturn} return keeps the original free load and physical gate sequence`,{timeout:300000},async()=>{
 const game=await createHeadlessGame();game.chamberEdition='foundation';await game.selectLevel(40,true);
 try{
  const level=game.firstLevel,state=level.machines.get('freight').state;
  const cargo=game.cargo,body=game.physics.cargoBody,shape=body.shapes[0];
  assert.equal(state.leaves.length,2,'The return opening has two real moving leaves');
  const closed=state.leaves.map(mesh=>mesh.userData.collider.box.clone());
  const throat=closed.reduce((box,b)=>box.union(b),new THREE.Box3()),plane=throat.getCenter(V()).x;
  const fixed=game.colliders.filter(c=>c.enabled!==false&&!c.kinematic);
  const stamps={},witnesses={},counts={movingFrames:0,innerSamples:0,returnSamples:0};
  let previous=null,playerCrossing=null,cargoCrossing=null,passableTransits=null;
  const stamp=name=>{stamps[name]??=game.physics.world.stepnumber;};
  let report;
  try{report=await runSingularityJourney(game,{order:['freight'],stopAfter:'freight',freightReturn,onFrame:()=>{
   const step=game.physics.world.stepnumber,player=game.playerPosition,position=body.position;
   assert.equal(game.cargo,cargo);assert.equal(game.physics.cargoBody,body);assert.equal(body.shapes[0],shape);
   assert.ok(Number.isFinite(state.progress)&&state.progress>=0&&state.progress<=1);
   assert.ok(Number.isFinite(state.boltLift)&&state.boltLift>=0&&state.boltLift<=1);
   if(state.innerLoaded){stamp('inner');counts.innerSamples++;witnesses.inner=supportWitness(game,state.receiverMesh,body,shape);}
   if(state.boltLift>.001){stamp('bolt');assert.ok(stamps.inner!==undefined,'The bolt cannot retract before the actual inner load');}
   if(state.progress>.001){stamp('motion');assert.ok(stamps.bolt!==undefined,'The leaves cannot move before the actual bolt');}
   if(state.passable){stamp('passable');passableTransits??={player:game.teleportCount,cargo:game.physics.portalTransports};}
   if(state.returnLoaded){stamp('return');counts.returnSamples++;witnesses.return=supportWitness(game,state.returnMesh,body,shape);}
   if(level.getTowerMetrics().solvedIds.includes('freight')){stamp('solved');assert.ok(stamps.return!==undefined,'Completion cannot precede the actual returned free load');}
   if(state.progress>0&&state.progress<1)counts.movingFrames++;
   for(const mesh of state.leaves){
    const collider=mesh.userData.collider,solid=game.physics.solids.get(mesh.uuid),physical=solid?.body;
    assert.ok(collider?.enabled&&collider.kinematic&&physical,'Every visible moving leaf has a live collider and registered Cannon body');
    assert.ok(V().copy(physical.position).distanceTo(collider.box.getCenter(V()))<1e-6,'Cannon and rendered leaf positions diverged');
    const half=collider.box.getSize(V()).multiplyScalar(.5),actual=physical.shapes[0]?.halfExtents;
    assert.ok(actual&&half.distanceTo(V().copy(actual))<1e-7,'The physical leaf shape differs from its visible envelope');
    assert.equal(solid.inWorld,physical.world===game.physics.world,'Streaming registry and actual Cannon ownership disagree');
    for(const obstacle of fixed)assert.equal(positiveOverlap(collider.box,obstacle.box),false,
     `The moving return leaf intersects ${obstacle.mesh.name||'a fixed physical surface'}`);
   }
   if(stamps.passable!==undefined&&previous&&previous.step<step&&game.teleportCount===previous.teleports
    &&player.distanceTo(previous.player)<.25){
    const inside=p=>p.z>throat.min.z+.5&&p.z<throat.max.z-.5&&p.y>=throat.min.y-.02&&p.y+2.4<throat.max.y+.02;
    if(!playerCrossing&&previous.player.x<plane&&player.x>=plane&&inside(player)&&game.heldCube===cargo)
     playerCrossing={worldStep:step,player:player.toArray(),heldOriginal:true};
    if(!cargoCrossing&&previous.cargo.x<plane&&position.x>=plane&&position.z>throat.min.z+.5&&position.z<throat.max.z-.5
     &&V().copy(position).distanceTo(previous.cargo)<.35&&game.heldCube===cargo)
     cargoCrossing={worldStep:step,cargo:position.toArray(),heldOriginal:true};
   }
   previous={step,player:player.clone(),cargo:V().copy(position),teleports:game.teleportCount};
  }});
  }catch(error){
   console.error('Freight ordinary failure',JSON.stringify({freightReturn,stamps,counts,failure:error.singularityReport?.failure??String(error),
    live:{player:game.playerPosition.toArray(),cargo:body.position.toArray(),held:game.heldCube===cargo,progress:state.progress,boltLift:state.boltLift}}));
   throw error;
  }
  assert.equal(report.partial,true);assert.equal(report.sameCompanion,true);assert.equal(game.state,'playing');
  assert.equal(report.resets+report.respawns+report.cargoResets,0);
  assert.deepEqual(report.metrics.solvedIds,['freight']);assert.equal(report.metrics.completedStages,1);
  assert.equal(report.metrics.totalStages,SINGULARITY_ROOMS.length);assert.equal(report.metrics.checkpoints,false);
  assert.equal(report.metrics.events.length,1);
  for(const name of ['inner','bolt','motion','passable','return','solved'])assert.ok(stamps[name]!==undefined,`The ordinary route never reached ${name}`);
  assert.ok(stamps.inner<stamps.bolt&&stamps.bolt<=stamps.motion&&stamps.motion<stamps.passable
   &&stamps.passable<stamps.return&&stamps.return<=stamps.solved,'The real physical sequence was not observed in order');
  assert.ok(counts.movingFrames>20&&counts.innerSamples>10&&counts.returnSamples>0,'The route must observe real motion and sustained original load contacts');
  assert.ok(report.actions.some(a=>a.kind==='use'&&a.id==='freight:return'),'The ordinary E control must actually release the physical gate');
  const proof=report.metrics.events[0].proof,release=proof.physicalLoadRelease,returned=proof.returnedOriginalLoad;
  assert.equal(proof.sameBody,true);assert.equal(proof.physicalWall,true);assert.equal(proof.readsAchievements,false);
  for(const [witness,mesh]of [[release,state.receiverMesh],[returned,state.returnMesh]]){
   const supporting=game.physics.solids.get(mesh.uuid).body;
   assert.equal(witness.originalCargoBodyId,body.id);assert.equal(witness.originalCargoShapeId,shape.id);
   assert.equal(witness.supportBodyId,supporting.id);assert.equal(witness.supportShapeId,supporting.shapes[0].id);
   assert.equal(witness.freeOriginal,true);assert.ok(witness.normalForce>0&&witness.contacts>0);
  }
  assert.ok(release.worldStep>=stamps.inner&&release.worldStep<returned.worldStep);
  assert.ok(proof.returnGate.progress>0&&proof.returnGate.boltLift>.95&&proof.returnGate.clearWidth>=4.35);
  assert.ok(passableTransits&&passableTransits.player>=1&&passableTransits.cargo>=1,'The initial joint portal delivery is genuine');
  if(freightReturn==='gate'){
   assert.ok(playerCrossing&&cargoCrossing,'The player and held original cargo must physically cross the open return doorway');
   assert.equal(game.teleportCount,passableTransits.player);assert.equal(game.physics.portalTransports,passableTransits.cargo);
  }else{
   assert.ok(game.teleportCount>passableTransits.player&&game.physics.portalTransports>passableTransits.cargo,
    'The alternative must actually carry both original travellers back through the retained portal pair');
  }
  assert.equal(game.cargo,cargo);assert.equal(game.physics.cargoBody,body);assert.equal(body.shapes[0],shape);
  // This explicit post-route restart is a reset regression, not a hidden
  // checkpoint or a reset inside either accepted ordinary-input attempt.
  game.resetRun();assert.deepEqual(level.getTowerMetrics().solvedIds,[]);
  assert.equal(state.progress,0);assert.equal(state.boltLift,0);assert.equal(state.innerLoaded,false);assert.equal(state.returnLoaded,false);
  state.leaves.forEach((mesh,i)=>assert.ok(mesh.userData.collider.box.equals(closed[i]),'Reset failed to restore a closed leaf'));
  assert.equal(game.cargo,cargo);assert.equal(game.physics.cargoBody,body);assert.equal(body.shapes[0],shape);
  console.info('Freight ordinary route witness',JSON.stringify({freightReturn,stamps,counts,playerCrossing,cargoCrossing,
   bodyId:body.id,shapeId:shape.id,resetsDuringRoute:0,routeFrames:report.frames,routeSeconds:report.seconds}));
 }finally{game.firstLevel.dispose();game.physics.dispose();game.portals.dispose();}
});
