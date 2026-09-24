import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';

test('room22 visibly joins both shutters to one physical winch without closing their routes',async()=>{
 const game=await createHeadlessGame();
 try{
  await game.selectLevel(21,false);
  const level=game.firstLevel,{winch,conduitNames,signals,bands,staticBatches,staticSourceDraws}=level.freightArchitecture;
  assert.ok(staticSourceDraws>=20&&staticBatches.length<=4,'Fixed room-22 machinery is batched into at most four material draws');
  assert.equal(staticBatches.reduce((sum,batch)=>sum+batch.count,0),staticSourceDraws);
  assert.ok(level.spec.assets.includes(39),'The real winch model must load with this room');
  const west=level.world.surfaces.find(surface=>surface.name==='West freight court');
  const east=level.world.surfaces.find(surface=>surface.name==='East inspection court');
  assert.equal(west.floor.maxX,east.floor.minX,'The two coloured courts join without a floor gap');
  assert.equal(west.group.userData.keepMaterial,true);
  assert.equal(east.group.userData.keepMaterial,true);
  assert.ok(winch.art.getObjectByName('Moving'),'The winch uses its articulated GLB source');
  assert.ok(game.colliders.some(entry=>entry.mesh.userData.collisionProxy&&entry.box.intersectsBox(new THREE.Box3().setFromObject(winch.art))),'The winch has a matching physical housing');

  const lowClearance=new THREE.Box3(new THREE.Vector3(-1.05,.25,9.8),new THREE.Vector3(1.05,4.9,14.2));
  const highClearance=new THREE.Box3(new THREE.Vector3(3.4,7.4,-8.3),new THREE.Vector3(20.9,13.8,-7.2));
  for(const name of [...conduitNames,'Freight press upright','Freight press overhead yoke','Freight winch footing','Lower shutter jamb','Upper shutter jamb']){
   const meshes=game.colliders.filter(entry=>entry.mesh.name===name);
   assert.ok(meshes.length,`The ${name} is a physical part of the chamber`);
   for(const entry of meshes){
    assert.equal(entry.box.intersectsBox(lowClearance),false,`${name} obstructs the lower door`);
    assert.equal(entry.box.intersectsBox(highClearance),false,`${name} obstructs the high gallery`);
   }
  }
  const frameDoesNotJamDoors=()=>{
   for(const [shutter,names] of [[level.shutters.lower,['Lower shutter jamb']],[level.shutters.upper,['Upper shutter jamb','Upper gate lintel']]]){
    for(const entry of game.colliders.filter(item=>names.includes(item.mesh.name)))
     assert.equal(entry.box.intersectsBox(shutter.collider.box),false,`${entry.mesh.name} intersects the real moving shutter`);
   }
  };
  frameDoesNotJamDoors();
  for(const [i,mesh] of bands.entries()){
   assert.ok(mesh,'Each moving shutter needs its own clearly visible status band');
   assert.equal(mesh.position.y,[level.shutters.lower,level.shutters.upper][i].mesh.position.y);
   assert.equal(mesh.parent,level.world.root,"Decorative band cannot enlarge its parent's physical collision box");
   assert.equal(game.aimBlockers.includes(mesh),false,'Inlaid status art cannot steal a portal shot');
   assert.equal(game.cameraBlockers.includes(mesh),false,'Inlaid status art cannot clip the camera');
  }
  const milestones=new Set();
  const report=await runV8Journey(game,{onMilestone:mark=>{
   if(mark.name==='original cargo opens ground passage and closes upper inspection'){
    milestones.add('loaded');
    assert.ok(level.shutters.progress>.95);
    frameDoesNotJamDoors();
    assert.ok(winch.pivot.rotation.z>3,'Physical load winds the visible drum');
    assert.equal(bands[0].position.y,level.shutters.lower.mesh.position.y);
    assert.equal(bands[1].position.y,level.shutters.upper.mesh.position.y);
    assert.equal(signals[0].material.color.getHex(),0x94ead4);
    assert.equal(signals[1].material.color.getHex(),0xb9a276);
   }
   if(mark.name==='permanent gallery retains height while the same cargo reverses both shutters'){
    milestones.add('released');
    assert.ok(level.shutters.progress<.05);
    frameDoesNotJamDoors();
    assert.ok(Math.abs(winch.pivot.rotation.z)<.05,'The same drum reverses when the freight leaves the pad');
    assert.equal(bands[0].position.y,level.shutters.lower.mesh.position.y);
    assert.equal(bands[1].position.y,level.shutters.upper.mesh.position.y);
    assert.equal(signals[0].material.color.getHex(),0xb9a276);
    assert.equal(signals[1].material.color.getHex(),0x94ead4);
   }
  }});
  assert.equal(report.pass,true);
  assert.deepEqual([...milestones],['loaded','released']);
 }finally{game.physics.dispose();game.portals.dispose();}
});
