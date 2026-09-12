import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {CAMPAIGN} from '../src/game/LabCampaignLevels.js';
const g=await createHeadlessGame();
test('twenty-course registry preserves accepted rooms and gives every later room a distinct spatial premise',async()=>{
 assert.equal(CAMPAIGN.length,20);assert.equal(CAMPAIGN[11].id,'folded-junction');
 assert.deepEqual(CAMPAIGN.slice(12,15).map(room=>room.id),['optical-paradox','light-weave','countercurrent-weave']);
 const ids=[],concepts=[],shapes=[];
 for(let i=5;i<CAMPAIGN.length;i++){
  await g.selectLevel(i,false);const l=g.firstLevel;ids.push(l.id);concepts.push(l.world.root.userData.distinctConcept);
  shapes.push(Object.keys(l.panels).join(','));assert.equal(l.stages,undefined);assert.equal(l.lift,null);assert.equal(l.launchPad,null);
  assert.equal(l.getLaunch(l.goal.position),null);assert.ok(typeof l.world.root.userData.distinctConcept==='string'&&l.world.root.userData.distinctConcept.length>0, 'Each room declares its physical or spatial premise');assert.equal(l.isWon(),false);
 }
 assert.deepEqual(ids,CAMPAIGN.slice(5).map(s=>s.id));assert.ok(!ids.includes('impact-workshop')&&!ids.includes('vector-vault')); 
 assert.equal(new Set(concepts).size,CAMPAIGN.length-5);assert.equal(new Set(shapes).size,CAMPAIGN.length-5);
});
test('carried brainrot is expressive even when its dynamic body is not grounded',()=>{
 const rig=g.companionRig;rig.reset();const rotations=[];
 for(let n=0;n<180;n++){
  rig.update({dt:1/60,elapsed:n/60,speed:2,grounded:false,carrying:true,tumbling:true});rotations.push(rig.bones.Tail.rotation.z);
 }
 assert.ok(rig.alert>.7);assert.ok(Math.max(...rotations)-Math.min(...rotations)>.12);
 for(const bone of Object.values(rig.bones))assert.ok(bone.quaternion.toArray().every(Number.isFinite));
});
test('new courses have no hidden mechanism-use victory requirement',()=>{
 const l=g.firstLevel;g.playerGrounded=true;g.playerPosition.copy(l.goal.position);g.cargo.position.copy(l.goal.position).y+=.4;
 assert.equal(l.isWon(),true);g.playerGrounded=false;assert.equal(l.isWon(),false);
});
test('new rooms release colliders and reuse the original player asset on switching',async()=>{
 await g.selectLevel(0,false);const base=g.colliders.length,roots=g.scene.children.length,asset=g.assets.get(1);
 for(let i=5;i<CAMPAIGN.length;i++)await g.selectLevel(i,false);await g.selectLevel(0,false);
 assert.equal(g.colliders.length,base);assert.equal(g.scene.children.length,roots);assert.equal(g.assets.get(1),asset);
 g.physics.dispose();g.portals.dispose();
});
