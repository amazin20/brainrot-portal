import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {LabCamera} from '../src/game/LabCamera.js';
import {makePortalFrame} from '../src/game/LabPortals.js';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

const V = THREE.Vector3;
function rigFixture() {
  const camera = new THREE.PerspectiveCamera(62,16/9,.1,150);
  const rig = new LabCamera({camera});
  const target = new V(0,2,1); rig.reset(target);
  const entry = makePortalFrame(new V(0,0,0),new V(0,1,0));
  const exit = makePortalFrame(new V(0,2,0),new V(.45,Math.sqrt(1-.45**2),0));
  return {camera,rig,target,entry,exit};
}

test('inclined composition lasts beyond discard-plane retirement, but not beyond horizon recovery',()=>{
  const {rig,target,entry,exit}=rigFixture();
  const controls=rig.applyPortalTransform(entry,exit,{target});
  assert.equal(rig.inclinedFraming,true);
  // Synthetic lens phase change, not a gameplay route or actor teleport.
  rig.portalExit=null;rig.updatePortalClipping();
  rig.update({dt:1/60,target,...controls});
  assert.equal(rig.mainClippingPlanes.length,0);assert.equal(rig.inclinedFraming,true);
  for(let i=0;i<150;i++)rig.update({dt:1/60,target,...controls});
  assert.equal(rig.inclinedFraming,false);
});

test('flat exits, unframed transforms and respawns do not retain the inclined search',()=>{
  const {rig,target,entry,exit}=rigFixture();
  for(const normal of [new V(0,0,1),new V(0,1,0)]){
    rig.applyPortalTransform(entry,exit,{target});assert.equal(rig.inclinedFraming,true);
    rig.applyPortalTransform(entry,makePortalFrame(new V(0,2,0),normal),{target});
    assert.equal(rig.inclinedFraming,false);
  }
  rig.applyPortalTransform(entry,exit,{target});rig.applyPortalTransform(new THREE.Matrix4(),null,{target});
  assert.equal(rig.inclinedFraming,false);
  rig.applyPortalTransform(entry,exit,{target});rig.reset(target);assert.equal(rig.inclinedFraming,false);
});

test('a chest-only frame is penalized when the upper silhouette extends past the lens',()=>{
  const {rig,camera}=rigFixture();
  // Numerical camera fixture from the retained failing frame, not passage evidence.
  rig.playerPivot.set(-4.4649941948438165,22.72441420262602,-5.5943016435846);
  rig.lookPoint.set(2.073518974511762,7.491880867301031,-5.758502582799861);
  rig.viewUp.set(-0.09874902423126633,0.955523371075072,-0.27789155716340697);
  camera.fov=63.411129619112124;camera.updateProjectionMatrix();
  const lens=new V(-8.02370488665636,24.055465250376344,-6.729233603545463);
  camera.position.copy(lens);camera.up.copy(rig.viewUp);camera.lookAt(rig.lookPoint);camera.updateMatrixWorld(true);
  const chest=rig.playerPivot.clone().project(camera);
  const head=rig.playerPivot.clone().add(new V(0,1.32,0)).project(camera);
  assert.ok(Math.abs(chest.y)<1);assert.ok(Math.abs(head.y)>1);
  rig.inclinedFraming=false;const old=rig.framingPenalty(lens);
  rig.inclinedFraming=true;assert.ok(rig.framingPenalty(lens)>old+.15);
  rig.inclinedFraming=false;assert.equal(rig.framingPenalty(lens),old);
});

for(const side of [-1,1]) for(const hz of [30,60,120,'long']) test(`inclined recovery keeps final collision sweep at side=${side}, display=${hz}`,()=>{
  const {rig,camera,target,entry}=rigFixture();
  const wall=new THREE.Mesh(new THREE.BoxGeometry(.3,9,12),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  wall.position.set(-side*3.8,4,0);wall.updateMatrixWorld(true);rig.blockers.push(wall);
  const exit=makePortalFrame(new V(0,2,0),new V(side*.45,Math.sqrt(1-.45**2),0));
  const controls=rig.applyPortalTransform(entry,exit,{target});
  let elapsed=0;const deltas=hz==='long'?[.25,...Array(105).fill(1/60)]:Array(hz*2).fill(1/hz);
  try{
    for(const dt of deltas){
      elapsed+=dt;target.set(side*elapsed,2+Math.sin(elapsed)*.2,1);
      rig.update({dt,target,velocity:new V(side,.2*Math.cos(elapsed),0),...controls});
      assert.ok([...camera.position,...camera.quaternion,camera.fov].every(Number.isFinite));
      const safe=camera.position.clone();rig.constrain(rig.playerPivot,safe);
      assert.ok(safe.distanceTo(camera.position)<1e-7,'Unswept camera');
    }
    assert.equal(rig.inclinedFraming,false);
  }finally{wall.geometry.dispose();wall.material.dispose();}
});

function measureSkin(game) {
  const point=new V();let retained=0,outside=0;
  game.scene.updateMatrixWorld(true);game.portalActors.update();
  game.playerGroup.traverse(mesh=>{
    if(!mesh.isMesh)return;for(let n=mesh;n;n=n.parent)if(!n.visible)return;
    if(mesh.isSkinnedMesh)mesh.skeleton.update();
    const mat=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;
    if(!mat.visible)return;
    const planes=[...game.cameraRig.mainClippingPlanes,...(mat.clippingPlanes||[])];
    for(let i=0;i<mesh.geometry.attributes.position.count;i++){
      mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld);
      if(planes.some(p=>p.distanceToPoint(point)<0))continue;
      retained++;point.project(game.camera);
      if(Math.abs(point.x)>1||Math.abs(point.y)>1||point.z < -1||point.z>1)outside++;
    }
  });return {retained,outside};
}

test('ordinary room21 solo and joint flights retain the actual skin for the full two-second window',async()=>{
  const game=await createHeadlessGame();await game.selectLevel(20,false);
  const original=game.updateVisuals;let previous=0,since=999,lastLens=null;
  const counts=new Map(),held=new Map();let maxLateStep=0;
  game.updateVisuals=function(...args){
    original.apply(this,args);
    if(this.teleportCount!==previous){previous=this.teleportCount;since=0;lastLens=null;}
    if(previous>=3&&since<120){
      const skin=measureSkin(this),rig=this.cameraRig,safe=this.camera.position.clone();rig.constrain(rig.playerPivot,safe);
      assert.ok(skin.retained>500,'Do not pass by discarding or hiding the actor');
      assert.equal(skin.outside,0,`event${previous},tick${since}: ${skin.outside}/${skin.retained} uncut vertices outside`);
      assert.ok(safe.distanceTo(this.camera.position)<1e-7,'Final pose must obey the current render-state sweep');
      if(previous===4&&since>=24&&lastLens)maxLateStep=Math.max(maxLateStep,lastLens.distanceTo(this.camera.position));
      lastLens=this.camera.position.clone();counts.set(previous,(counts.get(previous)||0)+1);held.set(previous,!!this.heldCube);
    }
    since++;
  };
  try{
    const result=await runV8Journey(game);
    assert.ok(result.pass);assert.equal(result.resets+result.respawns,0);
    assert.deepEqual([...counts.entries()],[[3,120],[4,120]]);assert.equal(held.get(3),false);assert.equal(held.get(4),true);
    // Retained baseline had two late emergency moves, up to 3.4782 m.
    // This bound prevents a framing-only "fix" worsening that correction;
    // it does not claim all collision-driven camera movement is now smooth.
    assert.ok(maxLateStep<3.48,`Late correction grew beyond baseline: ${maxLateStep}`);
  }finally{game.updateVisuals=original;game.firstLevel.dispose?.();game.physics.dispose();game.portals.dispose();}
});
