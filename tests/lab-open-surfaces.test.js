import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {BALANCE_RIG_LAYOUT as L} from '../src/game/LabBalanceRig.js';
import {resolvePortalPlacement} from '../src/game/LabPortals.js';
const g=await createHeadlessGame();
test('every room offers additional continuous portal areas without changing its physical concept',async()=>{
 for(let i=0;i<20;i++){
  await g.selectLevel(i,false);const l=g.firstLevel;
  assert.ok(l.explorationSurfaces.length>=2,`Course ${i+1} lacks choice`);
  assert.ok(g.portalPanels.length>=3,`Course ${i+1} still has only two slots`);
  assert.ok(l.world.surfaces.some(s=>s.portal&&s.width>=5.5));
  const luminance=c=>.2126*c.r+.7152*c.g+.0722*c.b;
  assert.ok(luminance(l.world.materials.ceramic.color)>luminance(l.world.materials.wall.color)*3);
  for(const a of l.world.surfaces.filter(s=>s.portal))a.group.traverse(o=>{
   if(o.isInstancedMesh&&o.userData.portalTile)assert.equal(o.material,l.world.materials.ceramic,'A gray authored albedo must not disguise portalability');
  });
 }
});
test('a full recovery wall accepts widely separated shots, including tile seams, not a fixed centre',async()=>{
 await g.selectLevel(9,false);const area=g.firstLevel.panels['work-front'];g.scene.updateMatrixWorld(true);
 for(const x of [-7,-4,0,4,7])for(const y of [2.0,2.45]){
  const point=new THREE.Vector3(x,y,14.75);
  const result=resolvePortalPlacement(area.mesh,point,{blockers:g.colliders});
  assert.ok(result.ok,`Rejected wall point ${point.toArray()}: ${result.reason}`);
  assert.ok(result.position.distanceTo(point)<1e-6,'Shot snapped to a designated slot');
 }
});
test('the receiving balcony is above rocker jumping and its floor hides the portal from below',async()=>{
 await g.selectLevel(6,false);const l=g.firstLevel;
 const maximumLeverHeight=L.pivotHeight+Math.sin(L.maxAngle)*L.length/2+l.state.surfaceOffset;
 const jumpRise=7.8*7.8/(2*19.5);
 assert.ok(l.goal.position.y>maximumLeverHeight+jumpRise+.9);
 const receiver=l.panels['lever-receiver'].getFrame();
 assert.ok(receiver.normal.y>.999999,'The receiving portal must face upward on the actual dock floor');
 assert.ok(Math.abs(receiver.center.y-l.goal.position.y-.025)<1e-6);
 const origin=receiver.center.clone().add(new THREE.Vector3(0,-5,0));
 const hits=new THREE.Raycaster(origin,new THREE.Vector3(0,1,0)).intersectObjects(g.aimBlockers,true);
 assert.ok(hits.length>0);assert.ok(hits[0].distance<5-.1,'A lower shot can reach the exposed back of the receiving portal');
 assert.notEqual(hits[0].object,l.panels['lever-receiver'].mesh);
 assert.equal(l.isWon(),false);
});
test('wide portal areas are released on a level change',async()=>{
 await g.selectLevel(0,false);const count=g.colliders.length,roots=g.scene.children.length;
 await g.selectLevel(9,false);await g.selectLevel(6,false);await g.selectLevel(0,false);
 assert.equal(g.colliders.length,count);assert.equal(g.scene.children.length,roots);
 g.physics.dispose();g.portals.dispose();
});
