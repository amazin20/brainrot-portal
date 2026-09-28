import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runTowerJourney} from '../src/game/LabTowerJourney.js';
import {TOWER_STAGES} from '../src/game/LabTowerLayout.js';

// The journey changes only input and camera controls. Unlike positioned sensor
// fixtures it exercises the real movement, interaction and portal simulation.
test('The first deck solves out of order and climbs its real stair with the companion',async()=>{
 const game=await createHeadlessGame();
 game.chamberEdition='foundation';
 await game.selectLevel(40,true);
 const level=game.firstLevel,companion=game.cargo,body=game.physics.cargoBody.id;
 try{
  const relayAfterWing=[];
  const route=await runTowerJourney(game,{branchOrder:[2,0,1],stopAfterTransitionDeck:0,
   onMilestone:milestone=>{
    if(milestone.name.startsWith('Solved '))relayAfterWing.push({
     completed:level.completedStages,relay:level.getTowerMetrics().deckRelays[0]});
   }});
  assert.equal(route.partial,true);
  assert.equal(route.stagesCompleted,3);
  assert.deepEqual(route.stageEvents.map(event=>event.id),[2,0,1].map(branch=>
   TOWER_STAGES.find(stage=>stage.deck===0&&stage.branch===branch).id));
  assert.deepEqual(route.stageEvents.map(event=>event.branch),[2,0,1]);
  assert.equal(new Set(route.stageEvents.map(event=>event.id)).size,3);
  assert.equal(route.respawns,0);assert.equal(route.resets,0);assert.equal(route.cargoResets,0);
  assert.equal(game.cargo,companion);assert.equal(game.physics.cargoBody.id,body);
  assert.ok(route.physicsSteps>0&&route.activeMovementSeconds>0);
  assert.ok(route.shots>=2&&route.teleports>=1,'The portal wing must actually fire and cross a pair');
  const inputs=new Set(route.inputEvents.map(event=>event.type));
  for(const kind of ['shoot','use','drop','pickup'])
   assert.ok(inputs.has(kind),`The first deck must exercise ${kind} through an ordinary control`);
  assert.equal(level.getTowerMetrics().checkpoints,false);
  assert.equal(level.getTowerMetrics().solvedIds.length,3);
  assert.deepEqual(relayAfterWing,[
   {completed:1,relay:false},{completed:2,relay:false},{completed:3,relay:true},
  ],'The deck relay may unlock only after all three different reactors are solved');
  assert.equal(level.getTowerMetrics().deckRelays[0],true,'Only all three solved branches power the next deck');
  assert.equal(route.keystoneEvents.length,1);
  assert.equal(route.keystoneEvents[0].deck,0);
  assert.equal(level.getTowerKeystoneState(0).solved,true,
   'The central mechanism needs its own physical completion after the wing relay');
  assert.equal(level.getTowerMetrics().keystoneSolved[0],true);
  assert.ok(game.playerPosition.y>7.5&&game.playerPosition.y<8.5,
   'The released stair must physically lift the player to the second deck');
  assert.ok(game.heldCube,'The original companion must still be held after the climb');
  assert.ok(game.cargo.position.distanceTo(game.playerPosition)<3.2,
   'The companion must arrive on the second deck with the player');
  assert.equal(level.getTowerMetrics().deckRelays[1],false,
   'Climbing the stair cannot bypass the next deck puzzles');
  assert.equal(game.state,'playing','The first deck is not the final crown');
  game.restartCheckpoint();
  assert.equal(level.completedStages,0);
  assert.deepEqual(level.getTowerMetrics().solvedIds,[]);
  assert.equal(level.getTowerMetrics().deckRelays[0],false);
  assert.equal(level.getTowerKeystoneState(0).solved,false);
  assert.ok(level.getTowerKeystoneState(0).feeds.every(feed=>feed===false));
  assert.deepEqual(level.getTowerMetrics().keystoneEvents,[]);
  const exchange=TOWER_STAGES.find(stage=>stage.id==='exchange');
  assert.notEqual(level.getTowerStageState(exchange.index).signals.transit,true,
   'Restart must clear the portal crossing signal as well as the solved counter');
  assert.equal(level.getTowerStageState(exchange.index).gateOpen,false);
  assert.ok(game.playerPosition.distanceTo(level.spawn)<1e-9);
 }finally{
  game.firstLevel.dispose?.();game.physics.dispose();game.portals.dispose();
 }
});

test('The optional service link opens only from its live feed and admits both directions on foot',async()=>{
 const game=await createHeadlessGame();
 game.chamberEdition='foundation';
 await game.selectLevel(40,true);
 const level=game.firstLevel,companion=game.cargo,body=game.physics.cargoBody.id;
 const interlock=game.colliders.find(c=>c.mesh.name==='Tower service link / physical interlock');
 assert.ok(interlock,'The side link needs an actual blocking collider');
 try{
  assert.deepEqual(level.getTowerServiceState(),{unlocked:false,open:false});
  assert.equal(interlock.enabled,true);
  for(const stage of [TOWER_STAGES[0],TOWER_STAGES[2]]){
   assert.equal(level.getTowerStageState(stage.index).gateOpen,false,
    'A lateral doorway must not bypass either wing reactor gate');
  }
  for(const [x,z]of [[12,-8],[12,-12],[8,-12]])
   assert.ok(game.floors.some(f=>f.enabled!==false&&f.minX<=x&&f.maxX>=x&&f.minZ<=z&&f.maxZ>=z),
    `The service link needs a real supporting floor at ${x},${z}`);

  const route=await runTowerJourney(game,{stopAfterDeck:0});
  assert.equal(route.partial,true);
  assert.equal(route.stagesCompleted,3);
  assert.equal(level.getTowerKeystoneState(0).feeds[0],true);
  assert.deepEqual(level.getTowerServiceState(),{unlocked:true,open:true});
  assert.equal(interlock.enabled,false,'The powered feed removes the physical interlock');

  const originalMove=game.input.getMove,move=new THREE.Vector2(),up=new THREE.Vector3(0,1,0);
  game.input.getMove=()=>move.clone();game.input.keys.add('ShiftLeft');
  const walk=target=>{
   for(let step=0;step<1800;step++){
    const dx=target[0]-game.playerPosition.x,dz=target[2]-game.playerPosition.z;
    const distance=Math.hypot(dx,dz);
    if(distance<.24)return;
    const desired=Math.atan2(-dx,-dz);
    const turn=Math.atan2(Math.sin(desired-game.yaw),Math.cos(desired-game.yaw));
    game.yaw+=THREE.MathUtils.clamp(turn,-.07,.07);
    const world=new THREE.Vector3(dx/distance,0,dz/distance).applyAxisAngle(up,-game.yaw);
    move.set(world.x,world.z);
    game.updatePlaying(1/120);
    assert.equal(game.state,'playing');
   }
   assert.fail(`The grounded actor could not walk to ${target} from ${game.playerPosition.toArray()}`);
  };
  try{
   // Enter through the east wing mouth, cross the powered link to the north
   // mouth, then walk back through the same physical opening.
   for(const point of [[0,0,0],[12,0,0],[12,0,-8],[12,0,-12],[8,0,-12],[4,0,-12],
    [8,0,-12],[12,0,-12],[12,0,-8],[12,0,0]])walk(point);
  }finally{move.set(0,0);game.input.keys.delete('ShiftLeft');game.input.getMove=originalMove;}
  assert.equal(level.completedStages,3);
  assert.equal(level.getTowerMetrics().failures,0);
  assert.equal(game.cargo,companion);
  assert.equal(game.physics.cargoBody.id,body);
  assert.ok(game.heldCube&&game.cargo.position.distanceTo(game.playerPosition)<3.2);
  assert.equal(game.playerGrounded,true);
 }finally{game.firstLevel.dispose?.();game.physics.dispose();game.portals.dispose();}
});
