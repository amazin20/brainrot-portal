import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {ACTIVE_FOUNDATION_RUNTIME_FLAGS} from '../src/game/ReleaseIdentity.js';

// These are CPU route checks through the real production simulation. Browser
// Play, full WebGL movies and publication require their separate native proof.
async function fresh(index){
 const g=await createHeadlessGame();Object.assign(g,{chamberEdition:'foundation',...ACTIVE_FOUNDATION_RUNTIME_FLAGS});await g.selectLevel(index,false);g.resetRun(true);return g;
}

for(let index=20;index<30;index++)test(`nativeStart room ${index+1} reaches actual WON from original zero-step spawns within 300 simulation seconds`,async t=>{
 const g=await fresh(index),level=g.firstLevel,world=g.physics.world,cargo=g.cargo,body=g.physics.cargoBody,shape=body.shapes[0],player=g.playerVisual,cargoVisual=cargo.visual;
 assert.equal(g.state,'playing');assert.equal(world.stepnumber,0);assert.equal(g.elapsed,0);assert.equal(g.heldCube,null);assert.equal(g.portals.ready,false);assert.equal(g.teleportCount,0);
 assert.deepEqual(g.playerPosition.toArray(),level.spawn.toArray?.()??level.spawn);assert.deepEqual(cargo.position.toArray(),level.cargoSpawn.toArray?.()??level.cargoSpawn);
 const buffers=[];for(const root of [player,g.weapon,cargoVisual])root.traverse(mesh=>{if(mesh.isMesh)buffers.push({mesh,geometry:mesh.geometry,attributes:Object.entries(mesh.geometry.attributes).map(([key,attribute])=>({key,attribute,array:attribute.array??attribute.data?.array}))});});
 const resets={resetRun:0,respawn:0,resetCargo:0,levelReset:0},original={resetRun:g.resetRun,respawn:g.respawn,resetCargo:g.physics.resetCargo,levelReset:level.reset},reject=name=>function(){resets[name]++;throw Error('Forbidden post-start reset: '+name);};
 g.resetRun=reject('resetRun');g.respawn=reject('respawn');g.physics.resetCargo=reject('resetCargo');if(typeof level.reset==='function')level.reset=reject('levelReset');
 let postSteps=0;const onStep=()=>{
  assert.equal(world.stepnumber,++postSteps);assert.ok(postSteps<=300*120,'Native route exceeded its finite 300-second budget');
  assert.equal(g.physics.world,world);assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);assert.equal(body.shapes[0],shape);assert.equal(body.mass,3.2);assert.deepEqual(shape.halfExtents.toArray(),[.39,.39,.39]);
  for(const position of [g.playerPosition,cargo.position])assert.ok(position.toArray().every(Number.isFinite),'Native route produced a nonfinite actor position');
 };world.addEventListener('postStep',onStep);
 try{
  const result=await runV8Journey(g,{journeyOptions:{nativeStart:true}});
  assert.equal(result.pass,true);assert.equal(result.level,index+1);assert.equal(result.id,level.id);assert.equal(g.state,'won');assert.equal(level.isWon(),true);assert.equal(result.resets,0);assert.equal(result.respawns,0);assert.deepEqual(resets,{resetRun:0,respawn:0,resetCargo:0,levelReset:0});
  assert.ok(postSteps===result.frames*2||postSteps===result.frames*2-1);assert.equal(world.stepnumber,postSteps);assert.ok(Math.abs(g.elapsed-postSteps*(1000/120))<1e-5,'Elapsed clock lost a real physics step');assert.equal(g.playerVisual,player);assert.equal(cargo.visual,cargoVisual);
  for(const row of buffers){assert.equal(row.mesh.geometry,row.geometry);for(const a of row.attributes){assert.equal(row.geometry.attributes[a.key],a.attribute);assert.equal(a.attribute.array??a.attribute.data?.array,a.array);}}
  t.diagnostic(JSON.stringify({room:index+1,id:level.id,visualFrames:result.frames,worldSteps:postSteps,simulationSeconds:postSteps/120,teleports:result.teleports,milestones:result.milestones.length,resets:0,respawns:0}));
 }finally{world.removeEventListener('postStep',onStep);g.resetRun=original.resetRun;g.respawn=original.respawn;g.physics.resetCargo=original.resetCargo;if(typeof original.levelReset==='function')level.reset=original.levelReset;}
});

test('nativeStart rejects prepared biosphere states before changing input, clocks, poses or resetting',async()=>{
 const g=await fresh(20),mutations=[x=>{x.state='ready';},x=>{x.levelIndex=30;},x=>{x.chamberEdition='open';},x=>{x.physics.world.stepnumber=1;},x=>{x.elapsed=.01;},x=>{x.playerPosition.x+=.01;},x=>{x.cargo.position.z+=.01;},x=>{x.heldCube=x.cargo;},x=>{x.teleportCount=1;},x=>{x.portals.portals=[{},{}];},x=>{x.portals.portals[0]={};},x=>{x.portalShots.queue.push({});},x=>{x.portalShots.active.push({});}];
 for(const mutate of mutations){
  Object.assign(g,{chamberEdition:'foundation',...ACTIVE_FOUNDATION_RUNTIME_FLAGS});await g.selectLevel(20,false);g.resetRun(true);const portals=g.portals.portals.slice();mutate(g);const move=g.input.getMove,step=g.physics.world.stepnumber,elapsed=g.elapsed,player=g.playerPosition.toArray(),cargo=g.cargo.position.toArray(),reset=g.resetRun;let resets=0;g.resetRun=function(...args){resets++;return reset.apply(this,args);};
  try{await assert.rejects(runV8Journey(g,{journeyOptions:{nativeStart:true}}),/Native chapter start/);}finally{g.resetRun=reset;g.portals.portals=portals;}
  assert.equal(resets,0);assert.equal(g.input.getMove,move);assert.equal(g.physics.world.stepnumber,step);assert.equal(g.elapsed,elapsed);assert.deepEqual(g.playerPosition.toArray(),player);assert.deepEqual(g.cargo.position.toArray(),cargo);
 }
});

test('ordinary non-native journey retains its one legacy fixture reset',async()=>{
 const g=await fresh(20),reset=g.resetRun;let resets=0;g.resetRun=function(...args){resets++;return reset.apply(this,args);};
 try{const result=await runV8Journey(g,{scenario:({game,frame})=>{assert.equal(game.physics.world.stepnumber,60);frame();}});assert.equal(result.pass,true);assert.equal(result.kind,'recovery');assert.equal(resets,1);assert.equal(g.physics.world.stepnumber,62);}finally{g.resetRun=reset;}
});
