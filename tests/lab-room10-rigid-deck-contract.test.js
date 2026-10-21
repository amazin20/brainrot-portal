import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {gameplayContract,digest} from './helpers/lab-art-contract.js';
import {originalRoom10Contract,ROOM10_ORIGINAL_CONTRACT_DIGEST} from './helpers/lab-room10-rigid-deck-contract.js';

const game=await createHeadlessGame();
after(()=>{game.physics.dispose();game.portals.dispose();});

for(const edition of ['classic','foundation'])test(`room10 ${edition} retains its old exact golden around the approved rigid deck and receiver frame`,async()=>{
 game.chamberEdition=edition;await game.selectLevel(9,false);
 const actual=gameplayContract(game),before=structuredClone(actual);
 assert.equal(digest(originalRoom10Contract(actual)),ROOM10_ORIGINAL_CONTRACT_DIGEST);
 assert.deepEqual(actual,before,'Normalization must not write to the actual captured contract');
});

test('room10 exception rejects changed approved geometry, rogue registrations and unrelated original mechanics',async()=>{
 game.chamberEdition='classic';await game.selectLevel(9,false);const actual=gameplayContract(game);
 const mutations=[];
 // Every individual approved steel body is guarded, not just the prefix or
 // its enclosing aggregate. Moving/removed/doubled parts cannot be hidden.
 for(const i of [...Array.from({length:20},(_,n)=>34+n),...Array.from({length:14},(_,n)=>67+n)]){
  mutations.push(c=>c.colliders[i].box.min[0]-=.01);
  mutations.push(c=>c.colliders[i].mesh.matrix[13]+=.01);
 }
 for(const key of ['camera','aim'])for(const i of [33,34,...Array.from({length:21},(_,n)=>59+n),...Array.from({length:14},(_,n)=>92+n)])
  mutations.push(c=>c[key][i].visible=!c[key][i].visible);
 mutations.push(
  c=>c.colliders[9].box.max[1]+=.001,
  c=>c.colliders[9].kinematic=true,
  c=>c.colliders[54].box.max[1]+=.01,
  c=>c.colliders[54].kinematic=false,
  c=>c.colliders[54].enabled=false,
  c=>c.colliders[54].mesh.ancestorsVisible=true,
  c=>c.colliders.splice(54,1),
  c=>c.colliders.push(structuredClone(c.colliders[34])),
  c=>c.colliders[34].mesh.name='Freight receiving frame / unapproved barrier',
  c=>c.colliders[34].mesh.raycastChildren.push(structuredClone(c.camera[59])),
  c=>c.camera[34].raycastChildren.push(structuredClone(c.camera[34].raycastChildren[0])),
  c=>c.aim[34].raycastChildren[0].matrix[13]+=.1,
  c=>c.aim.splice(59,1),
  c=>c.portalRegistry.push(structuredClone(c.camera[59])),
  c=>c.floors[11].y+=.01,
  c=>c.floors[11].minX-=.1,
  c=>c.state.freight.position[1]+=.01,
  c=>c.state.freight.rate+=.01,
  c=>c.state['dock-lock'].engaged=true,
  c=>c.panels['dock-feed-ceiling'].center[1]+=.01,
  c=>c.panels['unloading-dock'].halfWidth+=.1,
  c=>c.terminals[0].position[0]+=.1,
  c=>c.room.cargoSpawn[0]+=.1,
  c=>c.colliders[55].box.min[1]+=.1, // Original dispatch-terminal solid.
  c=>c.colliders[56].box.min[1]+=.1, // Original moving glass hood, not exempt.
 );
 for(const [i,mutate]of mutations.entries()){
  const changed=structuredClone(actual);mutate(changed);
  assert.throws(()=>originalRoom10Contract(changed),assert.AssertionError,`Mutation ${i} escaped the exact bounded exception`);
 }
 assert.ok(mutations.length>150);
});
