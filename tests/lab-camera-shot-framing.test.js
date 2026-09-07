import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';

const V=(...p)=>new THREE.Vector3(...p);

test('normal production camera reveals travelling charges and impacts beside the animated uploaded player',async()=>{
 const g=await createHeadlessGame();
 function frame(){g.updatePlaying(1/120);g.updatePlaying(1/120);g.updateVisuals(1/60,1);}
 function prepareSkin(){
  g.scene.updateMatrixWorld(true);
  g.playerGroup.traverse(m=>{if(m.isSkinnedMesh){m.skeleton.update();m.computeBoundingSphere();}});
 }
 function obscured(point){
  const direction=point.clone().sub(g.camera.position);
  return new THREE.Raycaster(g.camera.position,direction.clone().normalize(),0,direction.length()-.04).intersectObject(g.playerGroup,true).length>0;
 }
 function aim(point){
  // The same yaw/pitch controls used by real mouse input; no direct lens,
  // character, emitter, portal or mechanism placement for these scenarios.
  for(let n=0;n<300;n++){
   const ndc=point.clone().project(g.camera);
   if(point.clone().sub(g.camera.position).dot(g.camera.getWorldDirection(V()))<0)g.yaw+=.18;
   else{g.yaw-=THREE.MathUtils.clamp(ndc.x,-1,1)*.22;g.pitch=THREE.MathUtils.clamp(g.pitch+THREE.MathUtils.clamp(ndc.y,-1,1)*.19,-1.15,1.15);}
   frame();
  }
 }
 try{
  for(const [level,name] of [[0,'entry'],[0,'exit'],[10,'wind-intake'],[10,'high']]){
   await g.selectLevel(level,false);g.resetRun(true);for(let n=0;n<30;n++)frame();
   const point=name==='high'?V(0,8,14.975):g.firstLevel.panels[name].getFrame().center;
   aim(point);prepareSkin();const tag=`room ${level+1} / ${name}`;
   assert.equal(obscured(point),false,`${tag}: the player's actual skin covers the reticle`);
   const projected=point.clone().project(g.camera);assert.ok(Math.abs(projected.x)<.01&&Math.abs(projected.y)<.01,`${tag}: ordinary controls cannot reach target`);
   if(name==='high')assert.ok(g.camera.position.distanceTo(g.playerPosition)>3,`${tag}: ground collision collapsed the boom into a close-up`);
   const before=g.camera.position.clone(),view=g.camera.quaternion.clone(),fov=g.camera.fov;
   assert.equal(g.firePortal(0),true);assert.ok(g.camera.position.equals(before)&&g.camera.quaternion.equals(view));assert.equal(g.camera.fov,fov);
   let visible=0,total=0;
   for(let n=0;n<50;n++){
    frame();prepareSkin();
    for(const shot of g.portalShots.active){total++;if(!obscured(shot.position))visible++;}
   }
   assert.ok(total>0&&visible>=total/2,`${tag}: only ${visible}/${total} charge frames visible beside the player`);
   assert.ok(g.portalShots.lastImpact,`${tag}: no real impact`);
   assert.equal(obscured(V(...g.portalShots.lastImpact.position)),false,`${tag}: body hides the impact`);
   let onscreen=0,samples=0;
   g.playerGroup.traverse(mesh=>{
    if(!mesh.isMesh)return;
    for(let i=0;i<mesh.geometry.attributes.position.count;i+=197){
     const p=mesh.getVertexPosition(i,V()).applyMatrix4(mesh.matrixWorld).project(g.camera);samples++;
     if(Math.abs(p.x)<1&&Math.abs(p.y)<1&&p.z>-1&&p.z<1)onscreen++;
    }
   });
   assert.ok(onscreen>samples*.15,`${tag}: camera lost the visible character`);
  }
 }finally{g.physics.dispose();g.portals.dispose();}
});
