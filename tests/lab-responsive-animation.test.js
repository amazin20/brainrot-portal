import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LabPlayerAnimator } from '../src/game/LabPlayerAnimator.js';
import { LabCompanionAnimator } from '../src/game/LabCompanionAnimator.js';
import { LabCompanionRig } from '../src/game/LabCompanionRig.js';

function player() {
  const root=new THREE.Group(),visual=new THREE.Group();root.add(visual);visual.scale.setScalar(2.21);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,-.1,.1,-.17,.1,.1,-.17,0,0,-1.085],3));
  const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());mesh.rotation.x=Math.PI/2;visual.add(mesh);
  return {root,visual,animator:new LabPlayerAnimator({visual})};
}
function companion() {
  const root=new THREE.Group(),visual=new THREE.Group(),model=new THREE.Group();root.add(visual);visual.add(model);
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(.6,.5,.7),new THREE.MeshBasicMaterial());mesh.rotation.x=Math.PI/2;model.add(mesh);
  return {root,visual,animator:new LabCompanionAnimator({visual}),rig:new LabCompanionRig(model)};
}
function advance(animator,seconds,input={},hz=60) {
  const frames=Math.round(seconds*hz);
  for(let i=0;i<frames;i++)animator.update({dt:seconds/frames,...input});
}
const transform=o=>[o.position.toArray(),o.quaternion.toArray(),o.scale.toArray()];

test('player head leads real turning, shoulders follow, aim takes priority and every response settles',()=>{
  const {root,visual,animator:a}=player(),physical=transform(root),scale=visual.scale.toArray();
  const positions=Array.from(a.rig.mesh.geometry.attributes.position.array);
  advance(a,.25,{turnRate:2});
  assert.ok(a.turnLook>.055,'Face must visibly lead an actual turn');
  assert.ok(a.chestTurn>0&&a.chestTurn<a.turnLook*.45,'Shoulders must follow after the head');
  let previous=a.bones.Head.quaternion.clone();
  for(let n=0;n<60;n++){
    a.update({turnRate:-2});
    assert.ok(previous.angleTo(a.bones.Head.quaternion)<.035,'Reversal snapped the head');previous.copy(a.bones.Head.quaternion);
  }
  assert.ok(a.turnLook<-.1&&a.chestTurn<-.04,'Attention must follow a reversal');
  advance(a,2,{turnRate:2,aiming:true});
  assert.ok(Math.abs(a.turnLook)<.0001,'Camera aim must retain its bearing');
  advance(a,2,{turnRate:0});
  assert.ok(Math.abs(a.turnLook)+Math.abs(a.chestTurn)<.00001);
  assert.deepEqual(transform(root),physical);assert.deepEqual(visual.scale.toArray(),scale);
  assert.deepEqual(Array.from(a.rig.mesh.geometry.attributes.position.array),positions);
  a.reset();assert.equal(a.turnLook+a.chestTurn,0);
});

test('companion physical turns create smooth opposite bank and source head gaze without moving its body',()=>{
  const {root,animator:a,rig}=companion(),physical=transform(root);
  advance(a,.5,{grounded:true,angularVelocity:{y:1}});
  advance(rig,.5,{grounded:true,angularVelocity:{y:1}});
  assert.ok(a.turnLean>.04&&rig.turnFocus<-.9);
  assert.ok(rig.bones.Head.rotation.z<-.1,'Source face should follow the actual yaw');
  const first=rig.bones.Head.quaternion.clone();
  rig.update({dt:1/60,grounded:true,angularVelocity:{y:-1}});
  assert.ok(first.angleTo(rig.bones.Head.quaternion)<.04,'Turn reversal snapped the source head');
  advance(rig,1,{grounded:true,angularVelocity:{y:-1}});
  assert.ok(rig.bones.Head.rotation.z>.1);
  advance(rig,2,{carrying:true,grounded:true,angularVelocity:{y:2}});
  advance(a,2,{carrying:true,grounded:true,angularVelocity:{y:2}});
  assert.ok(Math.abs(rig.turnFocus)+Math.abs(a.turnLean)<.00001,'Held support must take priority');
  assert.deepEqual(transform(root),physical);
});

test('reduced motion quiets optional idle cues while gait, flight brace and carried support remain available',()=>{
  const p=player().animator,c=companion();
  advance(p,2,{reducedMotion:true,turnRate:2});
  advance(c.animator,2,{reducedMotion:true,curious:true,celebrating:true});
  advance(c.rig,2,{reducedMotion:true,celebrating:true});
  assert.ok(p.decorativeBlend<1e-9&&Math.abs(p.turnLook)<.00001);
  assert.ok(c.animator.visual.position.distanceTo(c.animator.restPosition)<1e-9);
  assert.ok(c.animator.visual.quaternion.angleTo(c.animator.restQuaternion)<1e-7);
  for(const name of ['Head','Tail','FinL','FinR'])assert.ok(c.rig.bones[name].quaternion.angleTo(new THREE.Quaternion())<1e-7);
  advance(p,1,{reducedMotion:true,speed:5.7});assert.ok(p.cadenceHz>2,'Reduced motion must retain readable locomotion');
  advance(c.rig,1,{reducedMotion:true,grounded:false,carrying:true,velocity:{x:0,y:16,z:0}});
  assert.ok(c.rig.flightBrace>.99);assert.ok(Math.abs(c.rig.bones.FinL.rotation.x)>.17);
  for(const side of ['L','R'])assert.deepEqual(c.rig.bones[`Foot${side}`].position.toArray(),c.rig.restPositions[`Foot${side}`].toArray());
  advance(c.animator,1,{reducedMotion:false});assert.ok(c.animator.decorativeBlend>.999);
});

test('boot cadence and physical-turn expressions are equivalent across 15–144 presentation Hz',()=>{
  function run(hz) {
    const c=companion(),p=player().animator,samples=[];
    for(const input of [{speed:.4,angularVelocity:{y:1},turnRate:2},{speed:0,angularVelocity:{y:-1},turnRate:-2},{speed:.4,angularVelocity:{y:0},turnRate:0},{speed:0,reducedMotion:true}]){
      advance(c.rig,.5,input,hz);advance(c.animator,.5,input,hz);advance(p,.5,input,hz);
      samples.push({head:c.rig.bones.Head.quaternion.clone(),boots:['L','R'].map(side=>c.rig.bones[`Foot${side}`].position.clone()),phase:c.rig.phase,visual:c.animator.visual.quaternion.clone(),player:p.bones.Head.quaternion.clone()});
    }
    return samples;
  }
  const reference=run(60);
  for(const hz of [15,20,30,120,144])run(hz).forEach((sample,i)=>{
    assert.ok(Math.abs(sample.phase-reference[i].phase)<1e-10,`${hz} Hz changed boot cadence`);
    assert.ok(sample.head.angleTo(reference[i].head)<1e-7);
    sample.boots.forEach((position,j)=>assert.ok(position.distanceTo(reference[i].boots[j])<1e-10));
    assert.ok(sample.visual.angleTo(reference[i].visual)<1e-7);
    assert.ok(sample.player.angleTo(reference[i].player)<.005,`${hz} Hz changed player attention`);
  });
});

test('free boot lifts require upright support and never play during physical recovery or tumbling',()=>{
  for(const input of [{recovering:true},{tumbling:true},{grounded:false},{carrying:true}]){
    const {rig}=companion();advance(rig,.5,{speed:.4,grounded:true,...input});
    for(const side of ['L','R'])assert.deepEqual(rig.bones[`Foot${side}`].position.toArray(),rig.restPositions[`Foot${side}`].toArray());
  }
  const {root,rig}=companion();root.rotation.z=Math.PI/2;advance(rig,.5,{speed:.4,grounded:true});
  assert.ok(Math.abs(rig.sourceUp.y)<1e-10);
  for(const side of ['L','R'])assert.deepEqual(rig.bones[`Foot${side}`].position.toArray(),rig.restPositions[`Foot${side}`].toArray());
});

test('real source boot vertices lift only upward while the other boot stays in stance; carry restores both',async()=>{
  const {loadHeadlessGLB}=await import('../scripts/lab-headless.mjs');
  const source=await loadHeadlessGLB(new URL('../public/models/runtime/model-02-cargo.glb',import.meta.url));
  const physical=new THREE.Group(),visual=source.clone(true);physical.add(visual);
  const sourceTransform=transform(physical),rig=new LabCompanionRig(visual),geometry=rig.mesh.geometry;
  const attributes=Object.fromEntries(['position','normal','uv'].map(key=>[key,geometry.attributes[key].array.slice()]));
  const ids=geometry.attributes.skinIndex,weights=geometry.attributes.skinWeight,bootVertices={L:[],R:[]};
  for(let i=0;i<ids.count;i++)if(weights.getX(i)===1){if(ids.getX(i)===5)bootVertices.L.push(i);if(ids.getX(i)===6)bootVertices.R.push(i);}
  assert.ok(bootVertices.L.length>30&&bootVertices.R.length>30,'Both real source boots must participate');
  let maximumLift=0,swingSides=new Set();
  for(let n=0;n<90;n++){
    rig.update({dt:1/60,speed:.4,grounded:true});
    const lifts=['L','R'].map(side=>rig.restPositions[`Foot${side}`].z-rig.bones[`Foot${side}`].position.z);
    assert.ok(lifts.every(lift=>lift>=0&&lift<=.008));assert.ok(Math.min(...lifts)===0,'One boot must remain in stance');
    const side=lifts[0]>0?'L':'R',foot=rig.bones[`Foot${side}`],pose=foot.position.clone(),current=new THREE.Vector3();
    const index=bootVertices[side][0];rig.mesh.getVertexPosition(index,current);rig.mesh.localToWorld(current);
    foot.position.copy(rig.restPositions[`Foot${side}`]);rig.mesh.updateWorldMatrix(true,true);rig.skeleton.update();
    const planted=new THREE.Vector3();rig.mesh.getVertexPosition(index,planted);rig.mesh.localToWorld(planted);
    assert.ok(current.y>=planted.y-1e-10,'New source boot motion must never lower its sole');
    maximumLift=Math.max(maximumLift,current.y-planted.y);if(current.y-planted.y>.004)swingSides.add(side);
    foot.position.copy(pose);rig.mesh.updateWorldMatrix(true,true);rig.skeleton.update();
  }
  assert.ok(maximumLift>.007&&swingSides.size===2,'Both source boots need visible alternating steps');
  rig.update({dt:1/60,carrying:true,grounded:true,speed:.4});
  for(const side of ['L','R'])assert.deepEqual(rig.bones[`Foot${side}`].position.toArray(),rig.restPositions[`Foot${side}`].toArray());
  assert.deepEqual(transform(physical),sourceTransform);
  for(const [key,array]of Object.entries(attributes))assert.deepEqual(geometry.attributes[key].array,array);
  rig.reset();for(const [name,bone]of Object.entries(rig.bones))assert.deepEqual(bone.position.toArray(),rig.restPositions[name].toArray());
});
