import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {ACTIVE_FOUNDATION_RUNTIME_FLAGS} from '../src/game/ReleaseIdentity.js';

// CPU integration of the real ordinary driver and untouched normal start.
// A headless fixture is never reported as UI, WebGL or recorded evidence.
async function fresh(index){
 const g=await createHeadlessGame();Object.assign(g,{chamberEdition:'foundation',...ACTIVE_FOUNDATION_RUNTIME_FLAGS});await g.selectLevel(index,false);g.resetRun(true);return g;
}
for(const index of [10,19])test(`nativeStart completes current room ${index+1} from its normal zero-step start with the original actors and no reset`,async()=>{
 const g=await fresh(index),level=g.firstLevel,cargo=g.cargo,body=g.physics.cargoBody,shape=body.shapes[0],player=g.playerVisual,cargoVisual=cargo.visual;
 const buffers=[];for(const root of [player,g.weapon,cargoVisual])root.traverse(mesh=>{if(mesh.isMesh)buffers.push({mesh,geometry:mesh.geometry,attributes:Object.entries(mesh.geometry.attributes).map(([key,attribute])=>({key,attribute,array:attribute.array??attribute.data?.array}))});});
 assert.equal(g.state,'playing');assert.equal(g.physics.world.stepnumber,0);assert.equal(g.elapsed,0);assert.equal(g.heldCube,null);assert.equal(g.portals.ready,false);assert.equal(g.teleportCount,0);
 const resets={resetRun:0,respawn:0,resetCargo:0,levelReset:0},original={resetRun:g.resetRun,respawn:g.respawn,resetCargo:g.physics.resetCargo,levelReset:level.reset},reject=name=>function(){resets[name]++;throw Error('Forbidden post-start reset: '+name);};
 g.resetRun=reject('resetRun');g.respawn=reject('respawn');g.physics.resetCargo=reject('resetCargo');if(typeof level.reset==='function')level.reset=reject('levelReset');
 let postSteps=0,previous=0;const onStep=()=>{assert.equal(g.physics.world.stepnumber,previous+1);previous=g.physics.world.stepnumber;postSteps++;assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);assert.equal(body.shapes[0],shape);};g.physics.world.addEventListener('postStep',onStep);
 try{
  const result=await runV8Journey(g,{journeyOptions:{nativeStart:true}});
  assert.equal(result.pass,true);assert.equal(result.level,index+1);assert.equal(result.id,level.id);assert.equal(g.state,'won');assert.equal(level.isWon(),true);assert.equal(result.resets,0);assert.equal(result.respawns,0);assert.deepEqual(resets,{resetRun:0,respawn:0,resetCargo:0,levelReset:0});
  assert.ok(postSteps===result.frames*2||postSteps===result.frames*2-1);assert.equal(g.physics.world.stepnumber,postSteps);assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);assert.equal(body.shapes[0],shape);assert.equal(body.mass,3.2);assert.deepEqual(shape.halfExtents.toArray(),[.39,.39,.39]);assert.equal(g.playerVisual,player);assert.equal(cargo.visual,cargoVisual);
  for(const row of buffers){assert.equal(row.mesh.geometry,row.geometry);for(const a of row.attributes){assert.equal(row.geometry.attributes[a.key],a.attribute);assert.equal(a.attribute.array??a.attribute.data?.array,a.array);}}
 }finally{g.physics.world.removeEventListener('postStep',onStep);g.resetRun=original.resetRun;g.respawn=original.respawn;g.physics.resetCargo=original.resetCargo;if(typeof original.levelReset==='function')level.reset=original.levelReset;}
});

test('nativeStart rejects unsupported room index 40 and prepared second-chapter starts before movement, time or reset changes',async()=>{
 const g=await fresh(19),mutations=[x=>{x.levelIndex=40;},x=>{x.physics.world.stepnumber=1;},x=>{x.elapsed=.01;},x=>{x.playerPosition.x+=.01;},x=>{x.cargo.position.z+=.01;},x=>{x.heldCube=x.cargo;},x=>{x.portalShots.queue.push({});}];
 for(const mutate of mutations){
  await g.selectLevel(19,false);g.resetRun(true);mutate(g);const move=g.input.getMove,step=g.physics.world.stepnumber,elapsed=g.elapsed,player=g.playerPosition.toArray(),cargo=g.cargo.position.toArray(),reset=g.resetRun;let resets=0;g.resetRun=function(...args){resets++;return reset.apply(this,args);};
  try{await assert.rejects(runV8Journey(g,{journeyOptions:{nativeStart:true}}),/Native chapter start/);}finally{g.resetRun=reset;}
  assert.equal(resets,0);assert.equal(g.input.getMove,move);assert.equal(g.physics.world.stepnumber,step);assert.equal(g.elapsed,elapsed);assert.deepEqual(g.playerPosition.toArray(),player);assert.deepEqual(g.cargo.position.toArray(),cargo);
 }
});
