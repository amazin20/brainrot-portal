import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {ACTIVE_FOUNDATION_RUNTIME_FLAGS} from '../src/game/ReleaseIdentity.js';

async function fixture(){
 const g=await createHeadlessGame();Object.assign(g,{chamberEdition:'foundation',...ACTIVE_FOUNDATION_RUNTIME_FLAGS});await g.selectLevel(0,false);g.resetRun(true);return g;
}
test('a fresh native Play route completes the first room without an extra fixture reset',async()=>{
 const g=await fixture(),body=g.physics.cargoBody,shape=body.shapes[0],cargo=g.cargo;
 let resets=0;const reset=g.resetRun;g.resetRun=function(...args){resets++;return reset.apply(this,args);};
 const result=await runV8Journey(g,{journeyOptions:{nativeStart:true}});
 assert.equal(result.pass,true);assert.equal(g.state,'won');assert.equal(resets,0);assert.equal(result.resets,0);assert.equal(result.respawns,0);assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);assert.equal(body.shapes[0],shape);
});
test('native start rejects a prepared, advanced or wrong-room fixture before changing input or resetting it',async()=>{
 const g=await fixture();
 const mutations=[
  x=>{x.state='ready';},x=>{x.physics.world.stepnumber=1;},x=>{x.elapsed=.01;},
  x=>{x.playerPosition.x+=.01;},x=>{x.cargo.position.z+=.01;},x=>{x.heldCube=x.cargo;},
  x=>{x.teleportCount=1;},x=>{x.portalShots.queue.push({});},x=>{x.portalShots.active.push({});},
  x=>{x.levelIndex=20;},x=>{x.chamberEdition='open';},
 ];
 for(const mutate of mutations){
  g.chamberEdition='foundation';await g.selectLevel(0,false);g.resetRun(true);mutate(g);
  const move=g.input.getMove,step=g.physics.world.stepnumber,player=g.playerPosition.toArray();let resets=0;
  const reset=g.resetRun;g.resetRun=function(...args){resets++;return reset.apply(this,args);};
  try{await assert.rejects(runV8Journey(g,{journeyOptions:{nativeStart:true}}),/Native chapter start/);}
  finally{g.resetRun=reset;}
  assert.equal(resets,0);assert.equal(g.input.getMove,move);assert.equal(g.physics.world.stepnumber,step);assert.deepEqual(g.playerPosition.toArray(),player);
 }
});
