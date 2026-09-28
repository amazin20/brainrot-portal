import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {TOWER_STAGE_COUNT,TOWER_STAGES,towerPoint,towerCoordinates} from '../src/game/LabTowerLayout.js';
import {KEYSTONE_SPECS,KEYSTONE_FEED_MODES} from '../src/game/LabTowerKeystones.js';
import {towerDeckRoute} from '../src/game/LabTowerRoutes.js';

async function tower(){
 const game=await createHeadlessGame();
 game.chamberEdition='foundation';
 await game.selectLevel(40,false);
 game.resetRun(true);
 return game;
}
function dispose(game){game.firstLevel.dispose?.();game.physics.dispose();game.portals.dispose();}
function at(game,position,{cargo=true,grounded=true}={}){
 game.playerPosition.fromArray(position);
 game.playerVelocity.set(0,0,0);
 game.playerGrounded=grounded;
 if(cargo)game.cargo.position.copy(game.playerPosition).add(new THREE.Vector3(0,.7,0));
 game.firstLevel.update(1/120);
}

// Descriptor checks prove authored variety, not a completed gameplay route.
test('Tower authors 18 distinct puzzle wings in six decks with three free-order branches each',()=>{
 assert.equal(TOWER_STAGE_COUNT,18);
 assert.equal(TOWER_STAGES.length,18);
 assert.deepEqual(TOWER_STAGES.map(s=>s.number),Array.from({length:18},(_,i)=>i+1));
 assert.equal(new Set(TOWER_STAGES.map(s=>s.id)).size,18,'Every wing needs a persistent unique identity');
 const configurations=new Set(),mechanics=new Set(),actionKinds=new Set();
 for(let deck=0;deck<6;deck++){
  const wings=TOWER_STAGES.filter(s=>s.deck===deck);
  assert.equal(wings.length,3,`Deck ${deck+1} must contain three independent puzzles`);
  assert.deepEqual(wings.map(s=>s.branch).sort(),[0,1,2]);
  assert.ok(wings.every(s=>s.baseY===wings[0].baseY),'A deck has one shared hub elevation');
  if(deck)assert.ok(wings[0].baseY>TOWER_STAGES[(deck-1)*3].baseY,'The next deck must rise');
 }
 for(const stage of TOWER_STAGES){
  assert.ok(typeof stage.name==='string'&&stage.name.length>2);
  assert.ok(Array.isArray(stage.entry)&&stage.entry.length===3);
  assert.ok(Array.isArray(stage.reactor)&&stage.reactor.length===3);
  assert.ok(stage.puzzle&&typeof stage.puzzle.family==='string');
  assert.ok(Array.isArray(stage.puzzle.requirements)&&stage.puzzle.requirements.length>=2,
   `Wing ${stage.number} needs a causal multistep puzzle`);
  assert.ok(Array.isArray(stage.route)&&stage.route.length>=2,
   `Wing ${stage.number} needs a playable input route`);
  assert.ok(stage.route.every(action=>typeof action.kind==='string'&&action.kind.length>0));
  const kinds=new Set(stage.route.map(action=>action.kind)),requirements=stage.puzzle.requirements;
  if(requirements.some(signal=>['beamA','beamB','airA','transit'].includes(signal)))
   assert.ok(kinds.has('shoot'),`Wing ${stage.id} must fire an actual portal`);
  if(requirements.includes('transit'))
   assert.ok(kinds.has('enter'),`Wing ${stage.id} must cross a portal, not just place it`);
  if(requirements.some(signal=>['cargo','gravity'].includes(signal)))
   assert.ok(kinds.has('drop')&&kinds.has('pickup'),`Wing ${stage.id} must place and recover the companion`);
  if(requirements.some(signal=>['mirror','control'].includes(signal)))
   assert.ok(kinds.has('use'),`Wing ${stage.id} must operate a mechanism`);
  configurations.add(JSON.stringify({family:stage.puzzle.family,requirements:stage.puzzle.requirements}));
  mechanics.add(stage.puzzle.family);
  for(const action of stage.route)actionKinds.add(action.kind);
  const point=towerPoint(stage,2,.4),local=towerCoordinates(stage,point);
  assert.ok(Math.abs(local.s-2)<1e-6&&Math.abs(local.n-.4)<1e-6,
   `Wing ${stage.number} must share the layout's local coordinate contract`);
 }
 assert.equal(configurations.size,18,'Renaming or recoloring a repeated puzzle is not a new challenge');
 assert.ok(mechanics.size>=6,'The ascent should draw on substantially different mechanic families');
 assert.ok(actionKinds.size>=5,'The solution routes should use more than walking and carrying');
});

test('Every deck authors a different central puzzle with ordered live feeds from its wings',()=>{
 assert.equal(KEYSTONE_SPECS.length,6);
 assert.equal(KEYSTONE_FEED_MODES.length,6);
 assert.equal(new Set(KEYSTONE_SPECS.map(spec=>spec.id)).size,6);
 assert.equal(new Set(KEYSTONE_SPECS.map(spec=>JSON.stringify(spec.sequence))).size,6);
 for(let deck=0;deck<6;deck++){
  const feeds=KEYSTONE_FEED_MODES[deck],stages=TOWER_STAGES.filter(stage=>stage.deck===deck);
  const route=towerDeckRoute(deck,{feedModes:feeds,stages});
  assert.ok(KEYSTONE_SPECS[deck].sequence.length>=2);
  assert.ok(feeds.length>=2&&feeds.length<=3,'A keystone must depend on multiple distinct wings');
  assert.equal(new Set(feeds.map(feed=>feed.branch)).size,feeds.length);
  assert.ok(feeds.every(feed=>stages.some(stage=>stage.branch===feed.branch)));
  assert.ok(route.length>=25,`Deck ${deck+1} needs a substantial authored route`);
  assert.ok(route.some(action=>action.kind==='walk'));
  assert.ok(route.some(action=>['shoot','drop','use','enter'].includes(action.kind)),
   `Deck ${deck+1} must demand actual puzzle interaction`);
 }
});

test('An untouched reactor, roof shortcut and idle time cannot advance any wing',async()=>{
 const game=await tower(),level=game.firstLevel;
 try{
  assert.equal(level.completedStages,0);
  assert.equal(level.getTowerMetrics().checkpoints,false);
  assert.equal(level.restoreCheckpoint,undefined);
  for(let deck=0;deck<6;deck++){
   const keystone=level.getTowerKeystoneState(deck);
   assert.equal(keystone.ready,false);
   assert.equal(keystone.solved,false);
   assert.ok(keystone.feeds.every(value=>value===false));
  }
  for(const index of [0,1,2,9,17]){
   const stage=TOWER_STAGES[index];
   at(game,stage.reactor);
   assert.equal(level.completedStages,0,`Reactor ${stage.id} cannot be reached as a shortcut`);
   assert.equal(level.getTowerStageState(index).solved,false);
   assert.equal(level.isWon(),false);
  }
  game.resetRun(true);
  at(game,[0,40,30]);
  assert.equal(level.isWon(),false,'The crown cannot be reached before the six central mechanisms');
  assert.deepEqual(level.getTowerMetrics().keystoneSolved,[false,false,false,false,false,false]);
  game.resetRun(true);
  level.update(3600);
  assert.equal(level.completedStages,0,'Waiting cannot finish a puzzle');
  assert.equal(level.isWon(),false);
 }finally{dispose(game);}
});

test('The crown return gallery stays open while its side chamber is physically gated',async()=>{
 const game=await tower(),level=game.firstLevel;
 try{
  assert.equal(level.getTowerKeystoneState(5).solved,false);
  // A player's upright body must be able to return from the last stair along
  // the x=8 gallery, before the final keystone unlocks the separate exit.
  for(let z=8.5;z<=35.5;z+=.5){
   const body=new THREE.Box3(new THREE.Vector3(7.62,40.05,z-.22),
    new THREE.Vector3(8.38,41.75,z+.22));
   const blocker=game.colliders.find(c=>c.enabled!==false&&c.box.intersectsBox(body));
   assert.equal(blocker,undefined,`Crown return gallery is blocked at z=${z} by ${blocker?.mesh?.name}`);
  }
  const gateBody=new THREE.Box3(new THREE.Vector3(11.8,40.05,34.1),
   new THREE.Vector3(12.2,41.75,34.5));
  assert.ok(game.colliders.some(c=>c.enabled!==false&&c.box.intersectsBox(gateBody)),
   'The side chamber must still have a real closed collider before its keystone is solved');
  assert.equal(level.isWon(),false);
 }finally{dispose(game);}
});

// Deliberate position fixtures isolate the causal interlock. This is not a
// traversed route or a duration claim; the journey test covers real input.
test('Freight control needs the original companion on its pad before it can power the gate',async()=>{
 const game=await tower(),level=game.firstLevel,stage=TOWER_STAGES[1];
 try{
  at(game,towerPoint(stage,5,-2.9),{cargo:false});
  assert.equal(game.interact(),false,'An unpowered control cannot be used first');
  assert.equal(level.getTowerStageState(stage.index).gateOpen,false);
  at(game,stage.cargoPad);
  assert.equal(level.getTowerStageState(stage.index).signals.cargo,true);
  assert.equal(level.getTowerStageState(stage.index).gateOpen,false);
  at(game,towerPoint(stage,5,-2.9),{cargo:false});
  assert.equal(game.interact(),true,'The same cargo now powers the reachable console');
  at(game,towerPoint(stage,6,-2.9),{cargo:false});
  assert.equal(level.getTowerStageState(stage.index).signals.control,true);
  assert.equal(level.getTowerStageState(stage.index).gateOpen,true);
  assert.equal(level.completedStages,0,'Opening a gate is not the reactor completion');
  assert.equal(level.getTowerMetrics().deckRelays[0],false,'One wing cannot open the deck stair');
 }finally{dispose(game);}
});

test('Prism lever alone does not fabricate the portal-linked optical signal',async()=>{
 const game=await tower(),level=game.firstLevel,stage=TOWER_STAGES[0];
 try{
  at(game,towerPoint(stage,5,-2.9),{cargo:false});
  assert.equal(game.interact(),true);
  const state=level.getTowerStageState(stage.index);
  assert.equal(state.signals.mirror,true);
  assert.notEqual(state.signals.beamA,true,'The receiver needs an actual ray through a portal');
  assert.equal(state.gateOpen,false);
  assert.equal(state.solved,false);
  assert.equal(level.completedStages,0);
 }finally{dispose(game);}
});

test('An early portal crossing cannot be redeemed after the exchange beam powers up',async()=>{
 const game=await tower(),level=game.firstLevel,stage=TOWER_STAGES[2];
 try{
  const panel=key=>game.portalPanels.find(mesh=>mesh.userData.towerWing===stage.id
   &&mesh.name.includes(`/ ${key} /`));
  const input=panel('input'),output=panel('outputA');
  assert.ok(input&&output);
  // Immediate panel placement and the crossing callback isolate the ordered
  // sensor contract; the separate journey test exercises actual gun input.
  assert.equal(game.placeOnPanel(0,input,input.userData.center),true);
  assert.equal(game.placeOnPanel(1,output,output.userData.center),true);
  level.onTeleport({entryIndex:1,exitIndex:0});
  assert.notEqual(level.getTowerStageState(stage.index).signals.transit,true);
  at(game,towerPoint(stage,11,0),{cargo:false});
  for(let step=0;step<120&&!level.getTowerStageState(stage.index).signals.beamA;step++)
   level.update(1/120);
  assert.equal(level.getTowerStageState(stage.index).signals.beamA,true);
  assert.notEqual(level.getTowerStageState(stage.index).signals.transit,true,
   'The earlier crossing is not saved as a future transit request');
  assert.equal(level.getTowerStageState(stage.index).gateOpen,false);
  level.onTeleport({entryIndex:1,exitIndex:0});
  level.update(1/120);
  assert.equal(level.getTowerStageState(stage.index).signals.transit,true);
  assert.equal(level.getTowerStageState(stage.index).gateOpen,true);
 }finally{dispose(game);}
});

test('Cargo loaded before turbine airflow requires a new physical pad contact afterwards',async()=>{
 const game=await tower(),level=game.firstLevel,stage=TOWER_STAGES[3];
 try{
  const pad=new THREE.Vector3(...stage.cargoPad);
  at(game,stage.cargoPad);
  assert.notEqual(level.getTowerStageState(stage.index).signals.cargo,true);
  const panel=key=>game.portalPanels.find(mesh=>mesh.userData.towerWing===stage.id
   &&mesh.name.includes(`/ ${key} /`));
  const input=panel('input'),output=panel('outputA');
  assert.equal(game.placeOnPanel(0,input,input.userData.center),true);
  assert.equal(game.placeOnPanel(1,output,output.userData.center),true);
  for(let step=0;step<200&&!level.getTowerStageState(stage.index).signals.airA;step++)
   level.update(1/120);
  assert.equal(level.getTowerStageState(stage.index).signals.airA,true);
  assert.notEqual(level.getTowerStageState(stage.index).signals.cargo,true);
  assert.equal(level.getTowerStageState(stage.index).gateOpen,false);
  game.cargo.position.copy(pad).add(new THREE.Vector3(5,.6,0));level.update(1/120);
  game.cargo.position.copy(pad).add(new THREE.Vector3(0,.6,0));level.update(1/120);
  assert.equal(level.getTowerStageState(stage.index).signals.cargo,true);
  assert.equal(level.getTowerStageState(stage.index).gateOpen,true);
 }finally{dispose(game);}
});

test('The kinetic plate requires forward speed along the wing after its prerequisite',async()=>{
 const game=await tower(),level=game.firstLevel,stage=TOWER_STAGES[10];
 try{
  at(game,stage.cargoPad);
  assert.equal(level.getTowerStageState(stage.index).signals.cargo,true);
  at(game,towerPoint(stage,22.4,0));
  const [dx,dz]=stage.direction;
  game.playerVelocity.set(-dz*7,0,dx*7);
  level.update(1/120);
  assert.notEqual(level.getTowerStageState(stage.index).signals.kinetic,true,
   'Sideways speed cannot charge the plate');
  game.playerVelocity.set(-dx*7,0,-dz*7);
  level.update(1/120);
  assert.notEqual(level.getTowerStageState(stage.index).signals.kinetic,true,
   'Backward speed cannot charge the plate');
  game.playerVelocity.set(dx*7,0,dz*7);
  level.update(1/120);
  assert.equal(level.getTowerStageState(stage.index).signals.kinetic,true);
  assert.equal(level.getTowerStageState(stage.index).gateOpen,true);
 }finally{dispose(game);}
});

test('Gravity wing lifts the original physical companion before it grants its first signal',async()=>{
 const game=await tower(),level=game.firstLevel,stage=TOWER_STAGES[5];
 try{
  const pad=new THREE.Vector3(...stage.cargoPad),body=game.physics.cargoBody;
  game.playerPosition.copy(pad);game.previousPlayerPosition.copy(pad);
  game.playerVelocity.set(0,0,0);game.playerGrounded=true;
  game.physics.resetCargo({position:pad.clone().add(new THREE.Vector3(0,.57,0))});
  game.cargo.position.copy(body.position);game.cargo.group.position.copy(game.cargo.position);
  assert.equal(game.physics.cargoBody,body,'The mechanism must act on the original body');
  assert.notEqual(level.getTowerStageState(stage.index).signals.gravity,true);
  for(let step=0;step<480&&!level.getTowerStageState(stage.index).signals.gravity;step++)
   game.updatePlaying(1/120);
  assert.equal(level.getTowerStageState(stage.index).signals.gravity,true,
   'The original cargo body must physically reach the overhead coil');
  assert.ok(game.cargo.position.y>stage.baseY+3.4);
  assert.equal(level.getTowerStageState(stage.index).gateOpen,false,
   'The subsequent control step remains mandatory');
 }finally{dispose(game);}
});

test('Restart, fall and re-entry erase all solved wings without replacing the companion',async()=>{
 const game=await tower(),level=game.firstLevel,companion=game.cargo,body=game.physics.cargoBody.id;
 try{
  assert.equal(level.getTowerMetrics().checkpoints,false);
  assert.equal(level.restoreCheckpoint,undefined);
  at(game,TOWER_STAGES[0].entry);
  game.restartCheckpoint();
  assert.equal(level.completedStages,0);
  assert.ok(game.playerPosition.distanceTo(level.spawn)<1e-9);
  assert.equal(game.cargo,companion);
  assert.equal(game.physics.cargoBody.id,body);
  assert.deepEqual(level.getTowerMetrics().stageEvents,[]);
  at(game,[game.playerPosition.x,-20,game.playerPosition.z],{cargo:false});
  assert.equal(level.completedStages,0);
  assert.ok(game.playerPosition.distanceTo(level.spawn)<1e-9,'A fall returns to the entrance');
  await game.selectLevel(0,false);
  await game.selectLevel(40,false);
  assert.equal(game.firstLevel.completedStages,0);
  assert.ok(game.playerPosition.distanceTo(game.firstLevel.spawn)<1e-9);
  assert.deepEqual(game.firstLevel.getTowerMetrics().solvedIds,[]);
 }finally{dispose(game);}
});

test('Tower frees streamed geometry, colliders and portal panels when leaving the room',async()=>{
 const game=await tower(),level=game.firstLevel;
 try{
  const root=game.scene.children.find(child=>child.name.startsWith('The final tower'));
  assert.ok(root);
  const geometry=new Set();root.traverse(node=>{if(node.geometry)geometry.add(node.geometry);});
  assert.ok(geometry.size>0);
  const disposed=new Set();
  for(const item of geometry)item.addEventListener('dispose',()=>disposed.add(item));
  assert.ok(game.portalPanels.length>=2,'Portal puzzles need playable portal surfaces');
  assert.equal(game.physics.solids.size,game.colliders.length);
  assert.equal(new Set(game.cameraBlockers).size,game.cameraBlockers.length);
  assert.equal(new Set(game.aimBlockers).size,game.aimBlockers.length);
  await game.selectLevel(0,false);
  assert.equal(root.parent,null);
  assert.ok(disposed.size>0,'Tower-owned geometry must be disposed');
  assert.equal(level.getTowerMetrics().residentStages,0);
  assert.equal(game.physics.solids.size,game.colliders.length);
 }finally{dispose(game);}
});
