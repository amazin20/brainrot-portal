import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {LabPlayerAnimator} from '../src/game/LabPlayerAnimator.js';

function fixture(follow=true){
  const root=new THREE.Group(),visual=new THREE.Group();root.add(visual);visual.scale.setScalar(2.21);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,-.1,.1,-.17,.1,.1,-.17,0,0,-1.085],3));
  const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());mesh.rotation.x=Math.PI/2;visual.add(mesh);
  const animator=new LabPlayerAnimator({visual});
  // A paired control isolates this additive layer from the established gait.
  if(!follow)animator.stepGroundedFollowThrough=()=>{};
  return {root,visual,animator};
}
function advance(a,frames,input={}){for(let i=0;i<frames;i++)a.update({dt:1/60,...input});}

test('braking and lateral reversal move the ribs after the pelvis, then settle without altering feet or device joints',()=>{
  const live=fixture(),control=fixture(false),a=live.animator,b=control.animator;
  const original=Array.from(a.rig.mesh.geometry.getAttribute('position').array);
  let maxBrake=0,maxChest=0,minTurn=0;
  const sequence=[
    [120,{speed:5.7,velocity:{x:0,y:0,z:5.7}},'run'],
    [120,{speed:0,velocity:{x:0,y:0,z:0}},'brake'],
    [120,{speed:5.7,moveForward:0,moveRight:1,velocity:{x:5.7,y:0,z:0}},'right'],
    [120,{speed:5.7,moveForward:0,moveRight:-1,velocity:{x:-5.7,y:0,z:0}},'reverse'],
    [120,{speed:0,velocity:{x:0,y:0,z:0}},'settle'],
  ];
  const untouched=['Body','ThighL','ShinL','FootL','ThighR','ShinR','FootR','ArmR','ForearmR','HandR'];
  for(const [frames,input,phase] of sequence)for(let i=0;i<frames;i++){
    a.update(input);b.update(input);
    if(phase==='brake'){
      maxBrake=Math.max(maxBrake,a.groundFollow.forward);
      maxChest=Math.max(maxChest,a.bones.Chest.quaternion.angleTo(b.bones.Chest.quaternion));
    }
    if(phase==='reverse')minTurn=Math.min(minTurn,a.groundFollow.right);
    for(const name of untouched){
      assert.deepEqual(a.bones[name].quaternion.toArray(),b.bones[name].quaternion.toArray(),`${name} must retain its gait/device pose`);
      assert.deepEqual(a.bones[name].position.toArray(),b.bones[name].position.toArray());
    }
  }
  assert.ok(maxBrake>.09&&maxChest>.07,'Fast braking needs visible upper-body follow-through');
  assert.ok(minTurn<-.07,'Reversing lateral travel must reverse the balance response');
  assert.ok(Math.abs(a.groundFollow.forward)+Math.abs(a.groundFollow.right)<.00001,'A stop must settle fully instead of introducing idle jitter');
  assert.ok(a.bones.Chest.quaternion.angleTo(b.bones.Chest.quaternion)<.00002);
  assert.deepEqual(live.root.position.toArray(),[0,0,0]);
  assert.deepEqual(live.root.quaternion.toArray(),[0,0,0,1]);
  assert.deepEqual(live.visual.scale.toArray(),[2.21,2.21,2.21]);
  assert.deepEqual(Array.from(a.rig.mesh.geometry.getAttribute('position').array),original);
});

test('grounded follow-through yields to precise aim and airborne poses while carry wrists retain exact contact',()=>{
  const brakePeak=(aiming)=>{
    const a=fixture().animator;advance(a,120,{speed:5.7,aiming});let peak=0;
    for(let i=0;i<60;i++){a.update({speed:0,aiming});peak=Math.max(peak,a.groundFollow.forward);}
    return peak;
  };
  assert.ok(brakePeak(true)<brakePeak(false)*.12,'Precision aiming must suppress the new follow-through');
  const a=fixture().animator,b=fixture(false).animator;
  for(let i=0;i<90;i++){
    const input={speed:i<40?8:0,grounded:false,velocity:{x:8,y:-16,z:0}};
    a.update(input);b.update(input);
    assert.deepEqual(a.bones.Chest.quaternion.toArray(),b.bones.Chest.quaternion.toArray(),'Grounded inertia must not overwrite the portal-flight pose');
  }
  a.reset();advance(a,90);
  a.rig.mesh.updateWorldMatrix(true,true);
  const carryGripTargets=Object.fromEntries([['left',-.07],['right',.08]].map(([key,x])=>[key,a.rig.mesh.localToWorld(new THREE.Vector3(x,.17,-.47))]));
  advance(a,90,{carrying:true,carryGripTargets});
  for(let i=0;i<180;i++){
    const speed=i<60?5.7:i<120?0:4;
    a.update({speed,moveForward:i<120?1:0,moveRight:i<120?0:-1,carrying:true,carryGripTargets});
    for(const side of ['left','right'])assert.ok(a.diagnostics.carryReach[`${side}Error`]<1e-7,'Follow-through must preserve the companion wrist contact');
    for(const bone of Object.values(a.bones))assert.deepEqual(bone.scale.toArray(),[1,1,1]);
  }
  a.reset();assert.deepEqual(a.groundFollow,{forward:0,right:0,forwardVelocity:0,rightVelocity:0});
});

test('stop and reversal follow-through remains equivalent at 30, 60 and 144 render Hz',()=>{
  const run=(hz)=>{
    const a=fixture().animator,samples=[];
    for(const input of [{speed:5.7},{speed:0},{speed:5.7,moveForward:0,moveRight:1},{speed:5.7,moveForward:0,moveRight:-1},{speed:0}]){
      for(let i=0;i<hz/2;i++)a.update({dt:1/hz,...input});
      samples.push({follow:{...a.groundFollow},chest:a.bones.Chest.quaternion.clone(),arm:a.bones.ArmL.quaternion.clone()});
    }
    return samples;
  };
  const reference=run(60);
  for(const hz of [30,144])run(hz).forEach((sample,i)=>{
    for(const axis of ['forward','right'])assert.ok(Math.abs(sample.follow[axis]-reference[i].follow[axis])<.001,`${hz} Hz changed the settling response`);
    assert.ok(sample.chest.angleTo(reference[i].chest)<.01);
    assert.ok(sample.arm.angleTo(reference[i].arm)<.01);
  });
});
