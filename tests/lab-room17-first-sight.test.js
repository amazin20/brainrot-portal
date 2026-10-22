import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {gameplayContract,digest} from './helpers/lab-art-contract.js';

const V=(...p)=>new THREE.Vector3(...p);
const previousView={yaw:.2,pitch:-.08};
const previousContract='4094bd7e08520ed80fc0efe1f3b7817f67aece6f1c08079f7106d68c37681032';
const currentContract='1b7ee778e2a2e2b6c96214f097ae23cd95b2f2208a9a22916fe1e4aaedc4dbaf';

test('room17 native bearing reveals the supported span and both branch addresses from the unchanged spawn',async()=>{
 const g=await createHeadlessGame();g.chamberEdition='foundation';
 const document=globalThis.document;
 // Only enable construction of the production instrument plane. The inert
 // canvas context supplies no pixels and cannot establish a WebGL result.
 const context=new Proxy({measureText:text=>({width:String(text).length*8})},{get:(target,key)=>target[key]??(()=>{})});
 globalThis.document={...document,createElement:()=>({getContext:()=>context})};
 try{
  await g.selectLevel(16,false);
  const l=g.firstLevel,original=g.physics.cargoBody,shape=original.shapes[0],contract=gameplayContract(g);
  assert.equal(l.id,'foundation-cable-supported-architecture');
  assert.deepEqual(l.spawnView,{yaw:-.60,pitch:-.08});
  assert.equal(digest(contract),currentContract,'The complete current physical and interaction fixture changed');
  const restored=structuredClone(contract);restored.room.spawnView=previousView;
  assert.equal(digest(restored),previousContract,
   'Restoring only the exact former spawnView must recover the complete previous fixture');
  assert.deepEqual(contract.room.spawn,[-22,6,12]);
  assert.deepEqual(contract.room.cargoSpawn,[-18,6.57,10]);

  // These are current scene owners, rather than a replacement camera or a
  // staged actor pose. The uncharged copper cable is correctly hidden until
  // a real paired branch exists; its founded fairleads and free beam are the
  // initial task that the player needs to see.
  const readout=l.world.root.getObjectByName('Process instrument');assert.ok(readout);
  readout.geometry.computeBoundingBox();readout.updateWorldMatrix(true,false);
  const readoutCorners=[];
  for(const x of [readout.geometry.boundingBox.min.x,readout.geometry.boundingBox.max.x])
   for(const y of [readout.geometry.boundingBox.min.y,readout.geometry.boundingBox.max.y])
    readoutCorners.push(V(x,y,0).applyMatrix4(readout.matrixWorld));
  const features=[
   ['original companion',g.cargo.position.clone()],['freight floor',l.feed.surface.getFrame().center.clone()],
   ['founded hinge',V(-8,6,0)],['unsupported free end',l.beam.point(18)],
   ['upper branch',l.highLead.getFrame().center.clone()],['lower branch',l.lowLead.getFrame().center.clone()],
   ['permanent receiving shore',V(15,6,0)],
   ...readoutCorners.map((point,i)=>['actual instrument corner '+i,point]),
  ];
  for(const aspect of [16/9,1.6]){
   g.camera.aspect=aspect;g.camera.updateProjectionMatrix();
   g.cameraRig.reset(g.playerPosition,g.yaw,g.pitch);g.updateVisuals(0,1,0);g.camera.updateMatrixWorld(true);
   assert.equal(g.camera.fov,62,'Initial orientation must retain the production lens');
   for(const [name,point]of features){
    const ndc=point.clone().project(g.camera);
    assert.ok(Math.abs(ndc.x)<.94&&Math.abs(ndc.y)<.94&&ndc.z>-1&&ndc.z<1,
     `${name} must be inside the ordinary ${aspect} frame: ${ndc.toArray()}`);
   }
   let vertices=0,worst=0,minDepth=Infinity;const point=V(),local=V();
   g.playerGroup.updateWorldMatrix(true,true);
   g.playerGroup.traverse(mesh=>{
    if(!mesh.isMesh)return;
    for(let i=0;i<mesh.geometry.attributes.position.count;i++){
     mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld);
     local.copy(point).applyMatrix4(g.camera.matrixWorldInverse);minDepth=Math.min(minDepth,-local.z);
     point.project(g.camera);worst=Math.max(worst,Math.abs(point.x),Math.abs(point.y));vertices++;
    }
   });
   assert.ok(vertices>90000,'Project the supplied animated hero and held device');
   assert.ok(worst<.9&&minDepth>.1,'The complete original hero must remain visible');
   g.cameraRig.reset(g.playerPosition,previousView.yaw,previousView.pitch);g.camera.updateMatrixWorld(true);
   assert.ok(readoutCorners.some(point=>Math.abs(point.clone().project(g.camera).x)>1),
    'The retained old bearing must expose its actual clipped instrument');
   assert.ok(Math.abs(l.beam.point(18).project(g.camera).x)>1,
    'The retained old bearing must expose its missing free span');
   assert.equal(digest(gameplayContract(g)),currentContract,'Camera measurement must not change physical state');
  }
  assert.equal(g.physics.cargoBody,original);assert.equal(original.shapes[0],shape);
  assert.equal(original.mass,3.2);assert.equal(g.physics.world.stepnumber,0);assert.equal(g.elapsed,0);
 }finally{globalThis.document=document;g.firstLevel?.dispose?.();g.physics.dispose();g.portals.dispose();}
});

for(const aspect of [16/9,1.6])test(`room17 lower support preparation tolerates initial look bearings at aspect ${aspect}`,async()=>{
 const g=await createHeadlessGame();g.chamberEdition='foundation';
 try{
  for(const yaw of [.2,-.60,-1.2,.8]){
   await g.selectLevel(16,false);g.camera.aspect=aspect;g.camera.updateProjectionMatrix();
   // A declared initial-look fixture tests the ordinary route's independence
   // from presentation. No actor, original body or mechanism is assigned.
   g.firstLevel.spawnView={yaw,pitch:-.08};
   g.resetRun(true);
   assert.equal(g.yaw,yaw,'Play must actually use each requested initial-look fixture');
   assert.equal(g.pitch,-.08);assert.equal(g.physics.world.stepnumber,0);
   const original=g.physics.cargoBody,shape=original.shapes[0];
   const report=await runV8Journey(g,{journeyOptions:{nativeStart:true,route:'lower-branch'}});
   assert.equal(report.pass,true,`Lower route failed from initial yaw ${yaw}`);
   assert.equal(g.state,'won');assert.equal(report.resets+report.respawns,0);
   assert.equal(g.physics.cargoBody,original);assert.equal(original.shapes[0],shape);
   assert.equal(original.mass,3.2);assert.equal(g.physics.portalTransports,2);
   assert.ok(report.milestones.some(m=>m.name==='observer leaves the live ramp onto the permanent lower gallery'));
  }
 }finally{g.firstLevel?.dispose?.();g.physics.dispose();g.portals.dispose();}
});
