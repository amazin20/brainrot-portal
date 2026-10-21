import test from 'node:test';
import assert from 'node:assert/strict';
import {Body} from 'cannon-es';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runPuzzleProgression47} from '../src/game/LabPuzzleProgression47Journey.js';

let shared;
for(const [yaw,pitch]of [[.1,-.08],[-1.02,-.26]])for(const angles of [[0,0,0],[.25,.60,.12]]){
 test(`47 original cargo retrieval uses the real broken opening at camera ${yaw}, cargo Euler ${angles}`,async()=>{
  shared??=await createHeadlessGame();const g=shared;
  g.chamberEdition='foundation';g.puzzleProgression=true;await g.selectLevel(46,false);
  // Disclosed initial-condition fixtures only. Camera choices are valid
  // ordinary spawns; the same original body starts at its native location.
  // No pose, contact, route target or solver state is assigned mid-journey.
  g.firstLevel.spawnView={yaw,pitch};
  const cargo=g.cargo,body=g.physics.cargoBody,player=g.playerGroup,l=g.firstLevel;
  let cargoShardContacts=0,shardFloorContacts=0;
  const inspect=()=>{
   const shards=new Set(l.fuse.bodies);
   for(const c of g.physics.world.contacts){
    if((c.bi===body&&shards.has(c.bj))||(c.bj===body&&shards.has(c.bi)))cargoShardContacts++;
    if((shards.has(c.bi)&&c.bj.type===Body.STATIC)||(shards.has(c.bj)&&c.bi.type===Body.STATIC))shardFloorContacts++;
   }
  };
  g.physics.world.addEventListener('postStep',inspect);
  try{
   const route=await runV8Journey(g,{scenario:d=>{
    body.quaternion.setFromEuler(...angles);body.previousQuaternion.copy(body.quaternion);body.interpolatedQuaternion.copy(body.quaternion);
    body.aabbNeedsUpdate=true;body.wakeUp();g.physics.world.broadphase.dirty=true;
    runPuzzleProgression47(d);
   }});
   assert.equal(route.pass,true);assert.equal(g.state,'won');assert.equal(route.resets,0);assert.equal(route.respawns,0);
   assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);assert.equal(g.playerGroup,player);
   assert.equal(route.teleports,1);assert.ok(g.physics.portalTransports>=1);
   assert.ok(l.fuse.energy>=175);assert.equal(l.fuse.bodies.length,16);
   assert.ok(cargoShardContacts>0,'Original cargo must keep real contacts with physical debris');
   assert.ok(shardFloorContacts>0,'Every route retains real debris/floor collision solving');
   assert.ok(l.fuse.bodies.every(b=>b.type===Body.DYNAMIC&&b.collisionFilterGroup===3&&b.collisionFilterMask===3&&g.physics.world.bodies.includes(b)));
   assert.equal(l.drive.body.type,Body.DYNAMIC);assert.ok(l.drive.pinInserted);assert.ok(l.drive.contacts>0);
   assert.ok(route.milestones.some(m=>m.name.includes('true pin contact')));
  }finally{g.physics.world.removeEventListener('postStep',inspect);}
 });
}
