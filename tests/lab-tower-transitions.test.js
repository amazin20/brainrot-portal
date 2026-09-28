import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {TOWER_STAGES,towerPoint,towerCoordinates} from '../src/game/LabTowerLayout.js';

// These are movement regressions, not positioned sensor fixtures. After the
// normal level initialization every change of position comes from production
// physics responding to movement, sprint, E and (in the second case) Space.
async function withTower(run){
 const game=await createHeadlessGame();game.chamberEdition='foundation';
 await game.selectLevel(40,true);
 const original={move:game.input.getMove,reset:game.resetRun,respawn:game.respawn,cargoReset:game.physics.resetCargo};
 const move=new THREE.Vector2(),up=new THREE.Vector3(0,1,0),identity=game.cargo;
 const calls={reset:0,respawn:0,cargoReset:0};let physicsSteps=0;
 game.input.getMove=()=>move.clone();
 game.resetRun=function(...args){calls.reset++;return original.reset.apply(this,args);};
 game.respawn=function(...args){calls.respawn++;return original.respawn.apply(this,args);};
 game.physics.resetCargo=function(...args){calls.cargoReset++;return original.cargoReset.apply(this,args);};
 function frame(){
  assert.equal(game.state,'playing');
  for(let step=0;step<2;step++){
   game.updatePlaying(1/120);physicsSteps++;
   assert.deepEqual(calls,{reset:0,respawn:0,cargoReset:0},'A transition must not reset or relocate either traveller');
   assert.equal(game.cargo,identity);assert.equal(game.heldCube,identity);
  }
  game.updateVisuals(1/60,1);
 }
 function steer(dx,dz){
  const direction=new THREE.Vector3(dx,0,dz).applyAxisAngle(up,-game.yaw);
  move.set(direction.x,direction.z);game.input.keys.add('ShiftLeft');
 }
 function walk(point,{airborne=false}={}){
  for(let frameIndex=0;frameIndex<900;frameIndex++){
   const dx=point[0]-game.playerPosition.x,dz=point[2]-game.playerPosition.z,distance=Math.hypot(dx,dz);
   if(distance<.1&&(airborne||Math.abs(point[1]-game.playerPosition.y)<.5))return;
   steer(dx/Math.max(.001,distance),dz/Math.max(.001,distance));frame();
  }
  assert.fail(`Ordinary movement blocked before ${point}: player ${game.playerPosition.toArray()}, completed ${game.firstLevel.completedStages}`);
 }
 function land(){move.set(0,0);for(let n=0;n<60;n++)frame();}
 try{
  assert.ok(game.interact(),'E must collect the original companion at the ordinary spawn');
  assert.equal(game.heldCube,identity);
  await run({game,walk,land});
  assert.equal(game.firstLevel.completedStages,2);
  assert.deepEqual(game.firstLevel.getTowerMetrics().stageEvents.map(event=>event.stage),[1,2]);
  assert.deepEqual(calls,{reset:0,respawn:0,cargoReset:0});
  assert.ok(physicsSteps>600,'Both stages must actually be traversed through physics');
 }finally{
  move.set(0,0);game.input.keys.clear();game.input.getMove=original.move;
  game.resetRun=original.reset;game.respawn=original.respawn;game.physics.resetCargo=original.cargoReset;
  game.firstLevel.dispose?.();game.physics.dispose();game.portals.dispose();
 }
}

test('Tower inward corner cut starts the next stage without an invisible backwards detour',async()=>{
 await withTower(({game,walk,land})=>{
  for(const waypoint of TOWER_STAGES[0].waypoints){
   walk(waypoint.s>=11.5?towerPoint(0,waypoint.s,-1.3):waypoint.position);
  }
  land();assert.equal(game.firstLevel.completedStages,1);
  const turn=towerCoordinates(1,game.playerPosition);
  assert.ok(turn.s>1.12&&turn.s<2,'The physical corner cut must reproduce the former missed entry band');
  // Advance from the cut corner directly to the next contact and exit. There
  // is no return to the previous 1.00–1.12 entry band anywhere in this route.
  for(const waypoint of TOWER_STAGES[1].waypoints)walk(waypoint.position);
  land();
 });
});

test('Tower diagonal jump across a corner credits the airborne exit and next entry',async()=>{
 await withTower(({game,walk,land})=>{
  for(const waypoint of TOWER_STAGES[0].waypoints.filter(waypoint=>waypoint.s<12))walk(waypoint.position);
  walk(towerPoint(0,12.4));game.input.jumpQueued=true;
  // Ordinary sprint-jump diagonally around the corner, without waiting to
  // land on the old exit stripe or inside the next entry sensor.
  walk(towerPoint(1,3),{airborne:true});land();
  assert.equal(game.firstLevel.completedStages,1,'Crossing the upper exit in the air must complete its stage');
  assert.ok(towerCoordinates(1,game.playerPosition).s>3,'The jump must land beyond the entry area');
  for(const waypoint of TOWER_STAGES[1].waypoints.filter(waypoint=>waypoint.s>=3.3))walk(waypoint.position);
  land();
 });
});
