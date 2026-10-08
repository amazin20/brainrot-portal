import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

// Real ordinary route, animated uploaded GLB and production camera projection.
// This checks the source composition; native rendered-pixel review remains
// necessary for occlusion, materials and the finished recording.
test('50 recording route restores body and feet after the high outlet aim',async()=>{
 const g=await createHeadlessGame();g.chamberEdition='foundation';await g.selectLevel(49,false);
 const originalCargo=g.cargo,originalBody=g.physics.cargoBody,visual=g.updateVisuals;
 const mesh=g.animator.rig.mesh,skin=mesh.geometry.getAttribute('skinIndex'),weights=mesh.geometry.getAttribute('skinWeight');
 const regions={FootL:[],FootR:[],Body:[],Head:[]},actions=[],milestones=[];
 for(let i=0;i<skin.count;i++){
  let component=0;for(let k=1;k<4;k++)if(weights.getComponent(i,k)>weights.getComponent(i,component))component=k;
  const bone=mesh.skeleton.bones[skin.getComponent(i,component)].name.replace(/^Lab/,''),name=bone==='Chest'?'Body':bone;
  regions[name]?.push(i);
 }
 function assertSkinInFrame(label){
  g.scene.updateMatrixWorld(true);mesh.skeleton.update();
  for(const [name,indices] of Object.entries(regions)){
   assert.ok(indices.length>0,`${name} original GLB skin region`);
   for(const i of indices){
    const p=mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld).project(g.camera);
    assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1&&p.z> -1&&p.z<1,`${label}: ${name} skin vertex ${i} leaves camera frustum`);
   }
  }
 }
 let frames=0,galleryChecked=false;
 g.updateVisuals=function(...args){const result=visual.apply(this,args);if(args[0]>0){frames++;if(frames===4500){assertSkinInFrame('lower recovery gallery');galleryChecked=true;}}return result;};
 const observedVisual=g.updateVisuals;
 const fire=g.firePortal,interact=g.interact;
 g.firePortal=function(index){const result=fire.call(this,index);actions.push(['shot',frames,index,!!result]);return result;};
 g.interact=function(...args){const result=interact.apply(this,args);actions.push(['E',frames,!!result,!!g.heldCube]);return result;};
 try{
  const journey=await runV8Journey(g,{onMilestone:({name})=>{
   milestones.push([name,frames]);assertSkinInFrame(name);
   if(name.startsWith('Rigid wall')){
    const wall=g.scene.getObjectByName('Hinged wall becomes structural bridge');
    const bridge=new THREE.Vector3(0,0,.31).applyMatrix4(wall.matrixWorld).project(g.camera);
    assert.ok(Math.abs(bridge.x)<1&&Math.abs(bridge.y)<1&&bridge.z> -1&&bridge.z<1,'Actual bridge face center must enter the recording frustum');
   }
  }});
  assert.equal(journey.pass,true);assert.equal(g.state,'won');assert.equal(galleryChecked,true);
  assert.equal(journey.resets+journey.respawns,0);assert.equal(g.cargo,originalCargo);assert.equal(g.physics.cargoBody,originalBody);
  // Exact CPU baseline events, not MP4 or native-browser frame numbers.
  assert.equal(frames,5566);assert.equal(journey.frames,frames);
  assert.deepEqual(actions,[['shot',738,0,true],['shot',1959,1,true],['E',3274,true,true],['E',3496,true,false],['E',5278,true,true]]);
  assert.deepEqual(milestones,[['Rigid wall rotates under gravity into the only bridge',3844],['both at exit',5566]]);
  assert.equal(g.updateVisuals,observedVisual);
 }finally{
  g.updateVisuals=visual;g.firePortal=fire;g.interact=interact;g.firstLevel.dispose?.();g.physics.dispose();g.portals.dispose();
 }
});
