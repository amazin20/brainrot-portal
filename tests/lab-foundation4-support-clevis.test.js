import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {disposeLabLevel} from '../src/game/LabLevelLifecycle.js';
import {gameplayContract} from './helpers/lab-art-contract.js';
import {foundation4SupportContract,foundation4SupportGeometry,foundation4SupportNames,normalizeFoundation4SupportQueries} from './helpers/lab-foundation4-support-contract.js';

const V=(...a)=>new THREE.Vector3(...a),game=await createHeadlessGame();game.chamberEdition='foundation';await game.selectLevel(3,true);
after(()=>disposeLabLevel(game));

test('both closed supports stay inside the same real Cannon backing while their visible triangles own camera and aim',()=>{
 foundation4SupportContract(game);
 for(const name of foundation4SupportNames){
  const mesh=game.scene.getObjectByName(name),center=mesh.getWorldPosition(V()),ray=new THREE.Raycaster(center.clone().add(V(.7,0,0)),V(-1,0,0),0,1.4);
  for(const registry of [game.cameraBlockers,game.aimBlockers]){
   const hits=ray.intersectObjects(registry,true).filter(h=>(h.object.visible||h.object.userData.collisionProxy)&&game.isActiveBlocker(h.object));
   assert.equal(hits[0]?.object,mesh,'The actual closed drawing, not an invisible old stand-in, must stop the query');
  }
 }
});

test('the complete lower caps sit inside finite visible column saddles and the upper caps meet the actual tilted crossheads',()=>{
 const panel=game.firstLevel.panels['inclined-exit'],frame=panel.getFrame();game.scene.updateMatrixWorld(true);
 for(const name of foundation4SupportNames){
  const mesh=game.scene.getObjectByName(name),column=game.scene.getObjectByProperty('uuid',mesh.userData.clevisColumnId),head=game.scene.getObjectByProperty('uuid',mesh.userData.clevisCrossheadId);
  assert.equal(column.name,'Load-bearing telescopic column');assert.equal(head.parent,panel.group);
  const saddle=column.getObjectByName('Closed structural column / bearing saddles');assert.ok(saddle);
  head.geometry.computeBoundingBox();const b=mesh.geometry.boundingBox,p=mesh.geometry.attributes.position;
  for(let i=0;i<p.count;i++){
   const local=V().fromBufferAttribute(p,i),world=local.clone().applyMatrix4(mesh.matrixWorld),inPanel=panel.group.worldToLocal(world.clone());
   assert.ok(Math.abs(inPanel.y)>panel.height/2+.15,'No support may cover any part of the finite working porcelain');
   assert.ok(inPanel.z<-.24,'The support must remain behind the working face');
   if(Math.abs(local.y-b.min.y)<1e-6){
    const hit=new THREE.Raycaster(V(world.x,9.2,world.z),V(0,-1,0),0,1).intersectObject(saddle)[0];
    assert.ok(hit&&Math.abs(hit.point.y-8.8)<1e-5,'Each foot corner must lie on the actual top saddle, not its whole tall AABB');
    assert.ok(world.y<hit.point.y&&world.y>hit.point.y-.24);
   }
   if(Math.abs(local.y-b.max.y)<1e-6){
    const point=head.worldToLocal(world.clone()),box=head.geometry.boundingBox;
    assert.ok(box.containsPoint(point));
    assert.ok(Math.abs(point.x)<box.max.x-.06&&Math.abs(point.y)<box.max.y-.06,'The anchor must be inside the finite flat portion, clear of the rounded frame edges');
    const origin=world.clone().addScaledVector(frame.normal,-1),hit=new THREE.Raycaster(origin,frame.normal,0,1).intersectObject(head)[0];
    assert.ok(hit&&hit.distance<.99,'The actual closed crosshead surface must precede the embedded anchor');
   }
  }
 }
 // The old proposed contact directly above either column is outside the
 // thin tilted ray owner; a mere enclosing AABB never certified a mount.
 const point=panel.mesh.worldToLocal(V(-9,8.8,-16.3));assert.ok(point.z<-.12-1);
});

test('the strict query allowance rejects shifted/resized/invisible/extra owners and changes to any old obstacle or portal',()=>{
 const contract=gameplayContract(game),geometry=foundation4SupportGeometry(game);
 const reject=mutate=>{const c=structuredClone(contract),g=structuredClone(geometry);mutate(c,g);assert.throws(()=>normalizeFoundation4SupportQueries(c,g),assert.AssertionError);};
 reject(c=>c.camera.find(x=>x.name===foundation4SupportNames[0]).matrix[12]+=.1);
 reject(c=>c.aim.find(x=>x.name===foundation4SupportNames[0]).visible=false);
 reject(c=>c.camera.push(structuredClone(c.camera.find(x=>x.name===foundation4SupportNames[0]))));
 reject((c,g)=>g[0].positionHash='larger support');
 reject((c,g)=>g[0].normalHash='broken surface');
 reject(c=>c.colliders[0].box.min[0]-=.1);
 reject(c=>c.colliders.push(structuredClone(c.colliders[0])));
 reject(c=>c.panels['inclined-exit'].center[1]+=.1);
 const mesh=game.scene.getObjectByName(foundation4SupportNames[0]),source=mesh.userData.physicalSourceId;
 try{mesh.userData.physicalSourceId='unrelated physical box';assert.throws(()=>foundation4SupportGeometry(game),assert.AssertionError);}finally{mesh.userData.physicalSourceId=source;}
 const owner=game.physics.solids.get(game.firstLevel.panels['inclined-exit'].mesh.uuid).body;
 try{owner.collisionResponse=false;assert.throws(()=>foundation4SupportGeometry(game),assert.AssertionError);}finally{owner.collisionResponse=true;}
});

test('render and reset retain original body/shape identities, exact registrations and the two accepted visible owners',()=>{
 const owned=[...game.physics.solids].map(([id,e])=>({id,body:e.body,shape:e.body.shapes[0]})),cargo=game.cargo,body=game.physics.cargoBody,shape=body.shapes[0],meshes=foundation4SupportNames.map(n=>game.scene.getObjectByName(n));
 for(let i=0;i<5;i++)game.firstLevel.renderUpdate(.37);game.firstLevel.reset();game.firstLevel.renderUpdate(1);
 foundation4SupportContract(game);
 assert.equal(game.cargo,cargo);assert.equal(game.physics.cargoBody,body);assert.equal(body.shapes[0],shape);
 for(const entry of owned){assert.equal(game.physics.solids.get(entry.id).body,entry.body);assert.equal(entry.body.shapes[0],entry.shape);}
 for(const mesh of meshes){assert.equal(game.scene.getObjectByName(mesh.name),mesh);assert.equal(game.cameraBlockers.filter(x=>x===mesh).length,1);assert.equal(game.aimBlockers.filter(x=>x===mesh).length,1);}
});
