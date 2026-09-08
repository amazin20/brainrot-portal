import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {LAB_PLAYER_BONE,resolveLabPlayerSkin} from '../src/game/LabPlayerAnimator.js';

test('rib cage and shoulders counter-rotate while the original physics root stays untouched',async()=>{
 const g=await createHeadlessGame(),a=g.animator,origin=g.playerPosition.clone();
 assert.equal(a.bones.ArmL.parent,a.bones.Chest);assert.equal(a.bones.Head.parent,a.bones.Chest);
 assert.equal(a.bones.ThighL.parent,a.bones.Body);
 let cross=0,bb=0,cc=0;
 for(let i=0;i<180;i++){
  a.update({dt:1/60,speed:2.6,grounded:true,weapon:false});
  if(i>40){const b=a.bones.Body.rotation.z,c=a.bones.Chest.rotation.z;cross+=b*c;bb+=b*b;cc+=c*c;}
 }
 assert.ok(cross/Math.sqrt(bb*cc)<-.65,'shoulders and pelvis must oppose each other, not move as one block');
 assert.ok(cc>.1,'chest motion must be visible, not a numerically tiny test-only change');
 assert.ok(g.playerPosition.equals(origin));assert.equal(a.rig.skeleton.bones.length,15);
 a.reset();assert.ok(a.bones.Chest.quaternion.w>.999999);
 g.physics.dispose();g.portals.dispose();
});
test('upper pack is rigid on chest; device docking region is rigid on pelvis',()=>{
 for(const p of [[0,-.25,-.52],[-.21,-.28,-.56],[.2,-.24,-.60]]){
  const skin=resolveLabPlayerSkin(...p);assert.equal(skin.indices[0],LAB_PLAYER_BONE.Chest);assert.equal(skin.weights[0],1);
 }
 const dock=resolveLabPlayerSkin(.1545,-.141,-.455);
 assert.equal(dock.indices[0],LAB_PLAYER_BONE.Body);assert.equal(dock.weights[0],1);
});

test('a fast vertical flight braces the upper body and releases smoothly at the apex and landing',async()=>{
 const g=await createHeadlessGame(),a=g.animator;
 const origin=g.playerPosition.clone(),velocity=g.playerVelocity.clone();
 try{
  for(const flight of [{x:16,y:0,z:0},{x:0,y:-16,z:0},{x:0,y:16,z:0}]){
   // Slow flight has the same base ascent/fall phase, isolating the extra
   // high-speed brace from the rib cage's normal counter-rotation.
   const slow=Object.fromEntries(Object.entries(flight).map(([axis,value])=>[axis,value*3/16]));
   a.reset();
   for(let i=0;i<90;i++)a.update({dt:1/60,grounded:false,velocity:slow,weapon:false});
   const relaxed=a.bones.Chest.quaternion.clone();
   a.reset();
   for(let i=0;i<90;i++)a.update({dt:1/60,grounded:false,velocity:flight,weapon:false});
   assert.ok(a.flightBrace>.98,'A high-speed fall must brace just like a lateral portal launch');
   assert.ok(a.bones.Chest.quaternion.angleTo(relaxed)>.05,'High speed must visibly change the chest pose');
   const before=a.bones.Chest.quaternion.clone();
   a.update({dt:1/60,grounded:false,velocity:{x:0,y:0,z:0},weapon:false});
   assert.ok(a.bones.Chest.quaternion.angleTo(before)<.08,'The apex must not snap the ribs');
   for(let i=0;i<90;i++)a.update({dt:1/60,grounded:true,velocity:{x:0,y:0,z:0},weapon:false});
   assert.ok(a.flightBrace<.001,'Landing must release the flight posture');
  }
  assert.ok(g.playerPosition.equals(origin));assert.ok(g.playerVelocity.equals(velocity));
  assert.deepEqual(a.bones.Chest.scale.toArray(),[1,1,1]);
 }finally{g.physics.dispose();g.portals.dispose();}
});
