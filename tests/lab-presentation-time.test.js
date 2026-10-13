import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LabPlayerAnimator } from '../src/game/LabPlayerAnimator.js';
import { LabCompanionAnimator } from '../src/game/LabCompanionAnimator.js';
import { LabCompanionRig } from '../src/game/LabCompanionRig.js';
import { LabHeldDevice } from '../src/game/LabHeldDevice.js';
import { permittedVisualSeconds } from '../src/game/LabVisualTime.js';

function fixture() {
  const root = new THREE.Group(), playerVisual = new THREE.Group(), friendVisual = new THREE.Group();
  playerVisual.scale.setScalar(2.21); root.add(playerVisual, friendVisual);
  const playerGeometry = new THREE.BufferGeometry();
  playerGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0,0,0, -.1,.1,-.17, .1,.1,-.17, 0,0,-1.085,
  ],3));
  const playerMesh = new THREE.Mesh(playerGeometry,new THREE.MeshBasicMaterial());
  playerMesh.rotation.x = Math.PI/2; playerVisual.add(playerMesh);
  friendVisual.add(new THREE.Mesh(new THREE.BoxGeometry(.6,.5,.7),new THREE.MeshBasicMaterial()));
  const player = new LabPlayerAnimator({visual:playerVisual});
  const friend = new LabCompanionAnimator({visual:friendVisual});
  const rig = new LabCompanionRig(friendVisual);
  const model = new THREE.Group();
  model.add(new THREE.Mesh(new THREE.BoxGeometry(.7,.3,.3),new THREE.MeshBasicMaterial()));
  const device = new LabHeldDevice({model,bones:player.bones,playerRoot:root});
  return {root, player, friend, rig, device};
}

function advance(all, seconds, fps, input={}) {
  for(let elapsed=0;elapsed<seconds-1e-10;){
    const dt=Math.min(1/fps,seconds-elapsed);
    for(const consumer of [all.player,all.friend,all.rig,all.device]) consumer.update({dt,...input});
    elapsed+=dt;
  }
}

test('all four presentation consumers spend the same permitted interval at 15–144 FPS and 80–100 ms frames',()=>{
  for(const dt of [1/15,1/20,1/30,1/60,1/120,1/144,.08,.1,.32]){
    const all=fixture(), input={carrying:true,speed:2,velocity:{x:2,y:0,z:0}};
    all.player.triggerInteraction('pickup'); all.friend.trigger('curious');
    for(const consumer of [all.player,all.friend,all.rig,all.device]) consumer.update({dt,...input});
    for(const consumer of [all.player,all.friend,all.rig]) assert.ok(Math.abs(consumer.elapsed-dt)<1e-12);
    assert.ok(Math.abs(all.player.diagnostics.interaction.elapsed-dt)<1e-12);
    assert.ok(Math.abs(all.friend.diagnostics.clips.curious.elapsed-dt)<1e-12);
    const expected=Math.min(1,dt/.32);
    assert.ok(Math.abs(all.player.holsterProgress-expected)<1e-12,'player handoff lost time');
    assert.ok(Math.abs(all.device.holsterProgress-expected)<1e-12,'device handoff lost time');
    assert.deepEqual(all.root.position.toArray(),[0,0,0]);
    assert.deepEqual(all.root.quaternion.toArray(),[0,0,0,1]);
  }
  assert.equal(permittedVisualSeconds(.4),.1);
  assert.equal(permittedVisualSeconds(20,false),0);
});

test('zero-time focus loss preserves every pose and cue even when a caller supplies a wall-clock jump',()=>{
  const all=fixture(),input={carrying:true,speed:2,velocity:{x:2,y:0,z:0}};
  all.player.triggerInteraction('pickup'); all.friend.trigger('curious');
  advance(all,.16,60,input);
  const snapshot=()=>JSON.stringify({
    clocks:[all.player.elapsed,all.friend.elapsed,all.rig.elapsed],
    interaction:all.player.diagnostics.interaction, reaction:all.friend.diagnostics.reaction,
    handoffs:[all.player.holsterProgress,all.device.holsterProgress],
    bones:Object.fromEntries([...Object.entries(all.player.bones),...Object.entries(all.rig.bones)]
      .map(([name,bone])=>[bone.name,{position:bone.position.toArray(),quaternion:bone.quaternion.toArray()}])),
    friend:[all.friend.visual.position.toArray(),all.friend.visual.quaternion.toArray()],
  });
  const before=snapshot();
  for(let i=0;i<120;i++) for(const consumer of [all.player,all.friend,all.rig,all.device])
    consumer.update({dt:0,elapsed:900,grounded:false,recovering:true,tumbling:true,...input});
  assert.equal(snapshot(),before);
  advance(all,.08,60,input);
  for(const consumer of [all.player,all.friend,all.rig])assert.ok(Math.abs(consumer.elapsed-.24)<1e-12);
});

test('carried fins and attention follow acceleration then settle, preserving the physical body and boots across FPS',()=>{
  const run=fps=>{
    const all=fixture(), samples=[];
    for(const velocity of [{x:4,y:0,z:0},{x:0,y:0,z:0},{x:-4,y:0,z:0},{x:0,y:0,z:0}]){
      advance(all,.5,fps,{carrying:true,grounded:true,velocity});
      samples.push({follow:all.rig.carryFollow.clone(),fins:all.rig.bones.FinL.quaternion.clone(),head:all.rig.bones.Head.quaternion.clone()});
      assert.deepEqual(all.rig.bones.Body.quaternion.toArray(),[0,0,0,1]);
    }
    advance(all,2,fps,{carrying:true,grounded:true,velocity:{x:0,y:0,z:0}});
    assert.ok(all.rig.carryFollow.length()<1e-6,'carried inertia must finish settling');
    assert.deepEqual(all.root.position.toArray(),[0,0,0]);
    for(const bone of Object.values(all.rig.bones))assert.deepEqual(bone.scale.toArray(),[1,1,1]);
    return samples;
  };
  const reference=run(60);
  assert.ok(reference[0].follow.x>.29 && reference[1].follow.x<-.27,'start and braking must have visibly opposite responses');
  for(const fps of [15,20,30,120,144])run(fps).forEach((sample,i)=>{
    assert.ok(sample.follow.distanceTo(reference[i].follow)<1e-10);
    assert.ok(sample.fins.angleTo(reference[i].fins)<1e-7);
    assert.ok(sample.head.angleTo(reference[i].head)<1e-7);
  });
});

test('repeated pickup preserves its contact phase; jump, shot and portal interrupt from the current reach',()=>{
  const all=fixture(),a=all.player;
  advance(all,1,60);
  a.triggerInteraction('pickup'); advance(all,.2,60);
  const age=a.interaction.elapsed,blend=a.interactionBlend;
  a.triggerInteraction('pickup');assert.equal(a.interaction.elapsed,age);
  a.triggerOperate();a.triggerJump();
  assert.equal(a.interaction,null);assert.equal(a.operateTime,2);assert.equal(a.interactionBlend,blend);
  a.update({dt:1/60,grounded:false,velocity:{y:5}});
  assert.equal(a.state,'jump');assert.ok(a.interactionBlend>blend*.65,'jump snapped the existing hand reach');
  advance(all,1,60);
  a.triggerInteraction('place');advance(all,.2,60);a.triggerOperate();
  const hand=a.bones.HandR.quaternion.clone();
  assert.equal(a.triggerShot(),true);assert.equal(a.interaction,null);assert.equal(a.operateTime,2);
  a.update({dt:1/60});assert.ok(a.bones.HandR.quaternion.angleTo(hand)<.12,'shoot interruption snapped the wrist');
  a.triggerInteraction('pickup');a.triggerOperate();a.update({dt:1/60,phase:true});
  assert.equal(a.interaction,null);assert.equal(a.operateTime,2);assert.equal(a.state,'phase');
});
