import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {CAMPAIGN} from '../src/game/LabCampaignLevels.js';
const g=await createHeadlessGame();
test('ten courses retain the original five and add growing multistage compositions',async()=>{
 assert.equal(CAMPAIGN.length,10);const counts=[];let previousArea=0;
 for(let i=5;i<10;i++){
  await g.selectLevel(i,false);const l=g.firstLevel;counts.push(l.stages.length);
  const area=(l.bounds.maxX-l.bounds.minX)*(l.bounds.maxZ-l.bounds.minZ);assert.ok(area>previousArea);previousArea=area;
  assert.equal(l.launchPad,null);for(const f of l.fixtures){assert.ok(CAMPAIGN[i].assets.includes(f.id));assert.ok(f.role.length>8);}
 }
 assert.deepEqual(counts,[1,2,3,4,5]);
});
test('load-driven lift is reversible and has a single visible deck',async()=>{
 await g.selectLevel(5,false);g.resetRun(true);const l=g.firstLevel,lift=l.lifts[0],pad=l.pads[0];
 assert.equal(lift.mesh.visible,false);g.cargo.position.copy(pad.mechanism.getPortalFrame().center);g.cargo.position.y+=.4;g.cargo.velocity.set(0,0,0);
 for(let n=0;n<600;n++)l.update(1/120);assert.ok(lift.y>4.9);
 g.cargo.position.x+=8;for(let n=0;n<600;n++)l.update(1/120);assert.ok(lift.y<.1);assert.equal(pad.pressed,false);
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
 for(let i=5;i<10;i++)await g.selectLevel(i,false);await g.selectLevel(0,false);
 assert.equal(g.colliders.length,base);assert.equal(g.scene.children.length,roots);assert.equal(g.assets.get(1),asset);
 g.physics.dispose();g.portals.dispose();
});
