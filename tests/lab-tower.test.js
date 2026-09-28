import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {TOWER_STAGE_COUNT,TOWER_SIDE,TOWER_RISE,TOWER_ENTRY_S,TOWER_ENTRY_MAX_S,TOWER_EXIT_S,
 TOWER_MANDATORY_DISTANCE,TOWER_MINIMUM_SECONDS,TOWER_STAGES,
 towerHeight,towerPoint,towerCoordinates} from '../src/game/LabTowerLayout.js';

async function tower(){
 const game=await createHeadlessGame();
 game.chamberEdition='foundation';await game.selectLevel(40,false);game.resetRun(true);
 return game;
}
function dispose(game){game.firstLevel.dispose?.();game.physics.dispose();game.portals.dispose();}
// These deliberately positioned fixtures probe the progress sensors and reset
// contract. They are not a route, a duration measurement or recording evidence.
function probe(game,index,s,n=0,y=towerHeight(index,s)){
 game.playerPosition.fromArray(towerPoint(index,s,n,y));
 game.playerVelocity.set(0,0,0);game.playerGrounded=true;
 game.cargo.position.copy(game.playerPosition).add(new THREE.Vector3(0,.7,0));
 game.firstLevel.update(1/120);
}
function completeFixture(game,index){
 probe(game,index,TOWER_ENTRY_S+.01);
 for(const plate of TOWER_STAGES[index].plates)probe(game,index,plate.s,plate.n);
 probe(game,index,TOWER_EXIT_S+.01);
 assert.equal(game.firstLevel.completedStages,index+1);
}

test('Tower contains 500 individually numbered, connected stages rising a full kilometre',()=>{
 assert.equal(TOWER_STAGE_COUNT,500);
 assert.equal(TOWER_STAGES.length,TOWER_STAGE_COUNT);
 assert.deepEqual(TOWER_STAGES.map(s=>s.number),Array.from({length:500},(_,i)=>i+1));
 assert.ok(new Set(TOWER_STAGES.map(s=>s.pattern)).size>=10,'The ascent must include different physical route patterns');
 for(const stage of TOWER_STAGES){
  assert.equal(stage.baseY,stage.index*TOWER_RISE);
  assert.equal(towerHeight(stage,0),stage.baseY);
  assert.equal(towerHeight(stage,TOWER_SIDE),stage.baseY+TOWER_RISE);
  assert.equal(towerCoordinates(stage,stage.entry).s,TOWER_ENTRY_S);
  assert.equal(towerCoordinates(stage,stage.exit).s,TOWER_EXIT_S);
  assert.ok(stage.plates.length>0,'Every stage requires its own physical activation');
  for(const waypoint of stage.waypoints){
   const coordinate=towerCoordinates(stage,waypoint.position);
   assert.ok(Math.abs(coordinate.s-waypoint.s)<1e-9);
   assert.ok(Math.abs(coordinate.n-waypoint.n)<1e-9);
  }
  if(stage.number<TOWER_STAGE_COUNT){
   assert.deepEqual(towerPoint(stage,TOWER_SIDE),towerPoint(stage.number,0),`Stage ${stage.number} is disconnected from the next flight`);
  }
 }
 assert.equal(towerHeight(TOWER_STAGES.at(-1),TOWER_SIDE),1000);
});

test('Tower minimum route length exceeds fifteen minutes at the ordinary maximum sprint speed',()=>{
 assert.ok(TOWER_ENTRY_MAX_S>TOWER_ENTRY_S,'The entry sensor has a real, explicitly bounded width');
 assert.equal(TOWER_MANDATORY_DISTANCE,TOWER_STAGE_COUNT*(TOWER_EXIT_S-TOWER_ENTRY_MAX_S));
 assert.equal(TOWER_MINIMUM_SECONDS,TOWER_MANDATORY_DISTANCE/5);
 assert.ok(TOWER_MINIMUM_SECONDS>=900,'The minimum must come from mandatory physical travel, without an elapsed-time gate');
});

test('Tower entry tolerance and actual sprint physics agree with the minimum-distance bound',async()=>{
 const game=await tower(),level=game.firstLevel;
 try{
  probe(game,0,TOWER_ENTRY_MAX_S+.001);
  for(const plate of TOWER_STAGES[0].plates)probe(game,0,plate.s,plate.n);
  probe(game,0,TOWER_EXIT_S);
  assert.equal(level.completedStages,0,'The entry sensor cannot admit a shorter route beyond its declared maximum');
  game.resetRun(true);
  probe(game,0,TOWER_ENTRY_MAX_S);
  for(const plate of TOWER_STAGES[0].plates)probe(game,0,plate.s,plate.n);
  probe(game,0,TOWER_EXIT_S);
  assert.equal(level.completedStages,1,'The declared sensor boundary must be playable');
  game.resetRun(true);game.input.keys.add('ShiftLeft');game.input.keys.add('KeyW');
  let maxSpeed=0;
  for(let step=0;step<120;step++){
   if(step===60)game.input.jumpQueued=true;
   game.updatePlaying(1/120);
   maxSpeed=Math.max(maxSpeed,Math.hypot(game.playerVelocity.x,game.playerVelocity.z));
  }
  assert.ok(maxSpeed>4.9,'The bound must allow the actual ordinary sprint');
  assert.ok(maxSpeed<=5.000001,'The Tower must not inherit kinetic sprint, launch or airborne boosts');
 }finally{dispose(game);}
});

test('Tower rejects the roof, an untouched exit and an exit without its own floor contacts',async()=>{
 const game=await tower(),level=game.firstLevel;
 try{
  assert.equal(game.kineticMode,false);
  assert.equal(game.portalPanels.length,0,'No portal pair may bypass mandatory tower flights');
  assert.equal(level.getLaunch(game.playerPosition),null);
  probe(game,499,TOWER_EXIT_S+.01);
  assert.equal(level.completedStages,0);assert.equal(level.isWon(),false);
  probe(game,0,TOWER_EXIT_S+.01);
  assert.equal(level.completedStages,0);
  probe(game,0,TOWER_ENTRY_S+.01);probe(game,0,TOWER_EXIT_S+.01);
  assert.equal(level.completedStages,0,'Entry alone must not bypass the physical contacts');
  game.resetRun(true);
  level.update(3600);
  assert.equal(level.completedStages,0,'Standing for an hour must not complete a stage');
  assert.equal(level.isWon(),false);
  for(let index=0;index<4;index++)completeFixture(game,index);
  probe(game,499,TOWER_EXIT_S+.01);
  assert.equal(level.completedStages,4,'A high later exit cannot advance the next mandatory stage');
  assert.equal(level.isWon(),false);
 }finally{dispose(game);}
});

test('Tower restart, failure and re-entry always return to the foot with zero completed stages',async()=>{
 const game=await tower(),level=game.firstLevel,companion=game.cargo,body=game.physics.cargoBody.id;
 try{
  assert.equal(level.restoreCheckpoint,undefined);
  assert.equal(level.getTowerMetrics().checkpoints,false);
  for(let index=0;index<8;index++)completeFixture(game,index);
  game.restartCheckpoint();
  assert.equal(level.completedStages,0);
  assert.ok(game.playerPosition.distanceTo(level.spawn)<1e-9);
  assert.equal(game.cargo,companion);assert.equal(game.physics.cargoBody.id,body);
  assert.deepEqual(level.getTowerMetrics().stageEvents,[]);
  for(let index=0;index<3;index++)completeFixture(game,index);
  probe(game,3,2,0,-4);
  assert.equal(level.completedStages,0,'A fall cannot resume the last passed stage');
  assert.ok(game.playerPosition.distanceTo(level.spawn)<1e-9);
  assert.equal(level.getTowerMetrics().failures,1);
  completeFixture(game,0);
  await game.selectLevel(0,false);
  await game.selectLevel(40,false);
  assert.equal(game.firstLevel.completedStages,0,'Reopening the level must not restore a stage checkpoint');
  assert.ok(game.playerPosition.distanceTo(game.firstLevel.spawn)<1e-9);
 }finally{dispose(game);}
});

test('Tower streams bounded live geometry and releases its old collision and rendering resources',async()=>{
 const game=await tower(),level=game.firstLevel;
 try{
  const initialColliders=game.colliders.length;
  const root=game.scene.children.find(child=>child.name.startsWith('The final tower'));
  assert.ok(root);
  let geometry;root.traverse(node=>{geometry??=node.geometry;});
  let disposed=false;geometry.addEventListener('dispose',()=>{disposed=true;});
  for(let index=0;index<64;index++){
   completeFixture(game,index);
   const metrics=level.getTowerMetrics();
   assert.ok(metrics.residentStages<=12,'Streaming cannot retain every already visited flight');
   assert.ok(game.colliders.length<=initialColliders+24,'Old module colliders must leave the live collision registry');
   assert.equal(game.physics.solids.size,game.colliders.length,'Physics boxes and game collision registry must stay synchronized');
   assert.ok(game.floors.length<=12*11,'Retired walking surfaces must be removed');
   assert.equal(new Set(game.cameraBlockers).size,game.cameraBlockers.length);
   assert.equal(new Set(game.aimBlockers).size,game.aimBlockers.length);
  }
  await game.selectLevel(0,false);
  assert.equal(root.parent,null);
  assert.equal(disposed,true,'The shared Tower geometry must be released when leaving the level');
  assert.equal(level.getTowerMetrics().residentStages,0);
 }finally{dispose(game);}
});
