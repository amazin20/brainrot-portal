import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {BALANCE_BIND} from '../src/game/LabBalanceModel.js';
import {runV8Journey} from '../src/game/LabV8Journey.js';
const game=await createHeadlessGame();
const V=(...v)=>new THREE.Vector3(...v);
function triangleAreas(root){
 const areas=[];root.updateWorldMatrix(true,true);
 root.traverse(m=>{if(!m.isMesh)return;const p=m.geometry.attributes.position,index=m.geometry.index;
  for(let i=0;i<(index?.count??p.count);i+=3){const a=[0,1,2].map(k=>V().fromBufferAttribute(p,index?index.getX(i+k):i+k).applyMatrix4(m.matrixWorld));areas.push(a[1].sub(a[0]).cross(a[2].sub(a[0])).length()/2);}
 });return areas.sort((a,b)=>a-b);
}
test('the supplied seesaw retains all triangles and one uniform scale, not a squeezed model',async()=>{
 await game.selectLevel(6,false);game.resetRun(true);const {balanceArt:a}=game.firstLevel.state;
 const source=game.model(34,1),before=triangleAreas(source),after=[...triangleAreas(a.fixed),...triangleAreas(a.moving)].sort((a,b)=>a-b);
 assert.equal(a.sourceTriangles,4198);assert.equal(a.sourceTriangles,a.fixedTriangles+a.movingTriangles);assert.equal(after.length,before.length);
 for(let i=0;i<before.length;i++)assert.ok(Math.abs(after[i]/(BALANCE_BIND.scale**2)-before[i])<2e-8,'Triangle deformation');
 assert.ok(a.fixedTriangles>0&&a.movingTriangles>0);assert.deepEqual(a.moving.scale.toArray(),[1,1,1]);
});
test('both ends move around the same real bearing; the stand and end-tray materials remain intact',async()=>{
 await game.selectLevel(6,false);game.resetRun(true);const s=game.firstLevel.state,a=s.balanceArt;
 const fixed=new THREE.Box3().setFromObject(a.fixed).clone();
 const vertices=[];a.moving.traverse(m=>{if(m.isMesh){assert.ok(m.geometry.attributes.color);const p=m.geometry.attributes.position;for(let i=0;i<p.count;i++)vertices.push(V().fromBufferAttribute(p,i));}});
 const negative=vertices.reduce((a,b)=>a.z<b.z?a:b),positive=vertices.reduce((a,b)=>a.z>b.z?a:b);
 assert.ok(negative.z< -10&&positive.z>10);
 const samples=[];
 for(const angle of [-.32,0,.32]){s.angle=s.previousAngle=angle;game.firstLevel.update(0);game.firstLevel.renderUpdate(1);game.scene.updateMatrixWorld(true);
  assert.ok(new THREE.Box3().setFromObject(a.fixed).equals(fixed));
  samples.push([negative.clone().applyMatrix4(a.moving.matrixWorld).y,positive.clone().applyMatrix4(a.moving.matrixWorld).y]);
 }
 assert.ok(samples[2][0]>samples[0][0]+5&&samples[2][1]<samples[0][1]-5);
});
test('visible walkable deck is above the supplied moving artwork and matches the supported plane',async()=>{
 await game.selectLevel(6,false);game.resetRun(true);const l=game.firstLevel,s=l.state,deck=s.collider.mesh;
 assert.equal(deck.visible,true);assert.notEqual(deck.userData.collisionProxy,true);
 const highest=Math.max(...s.balanceArt.moving.children.map(m=>m.geometry.boundingBox.max.y));
 assert.ok(highest<BALANCE_BIND.surfaceOffset-.07,'Source artwork protrudes through the walking surface');
 assert.ok(Math.abs(new THREE.Box3().setFromObject(s.balanceArt.fixed).min.y+4)<.06,'Stand is hovering or deeply buried');
 for(const angle of [-.32,-.15,0,.15,.32]){s.angle=s.previousAngle=angle;l.update(0);game.scene.updateMatrixWorld(true);
  for(const z of [-9,-4,0,4,9]){const ray=new THREE.Raycaster(V(.5,14,z),V(0,-1,0));const hit=ray.intersectObject(deck,false)[0];assert.ok(hit);
   const floor=game.floors.find(f=>f.mesh===deck);assert.ok(Math.abs(floor.heightAt(.5,z)-hit.point.y)<1e-6);
   const body=game.physics.solids.get(deck.uuid).body;const normal=V(0,1,0).applyQuaternion(body.quaternion);
   const point=V().copy(body.position).addScaledVector(normal,body.shapes[0].halfExtents.y);
   assert.ok(Math.abs(point.clone().sub(hit.point).dot(normal))<1e-6);
  }
 }
});
test('stand collisions taper: broad foot does not create an invisible wall across the beam',async()=>{
 await game.selectLevel(6,false);game.resetRun(true);const a=game.firstLevel.state.balanceArt;
 assert.ok(a.supportBoxes.length>8);
 const low=a.supportBoxes[0],high=a.supportBoxes.at(-1);
 assert.ok(low.max.z-low.min.z>high.max.z-high.min.z+3);
 assert.ok(a.supportBoxes.every(b=>b.min.toArray().concat(b.max.toArray()).every(Number.isFinite)));
 const floor=game.floors.find(f=>f.mesh===game.firstLevel.state.collider.mesh);
 for(const angle of [-.32,.32]){game.firstLevel.state.angle=game.firstLevel.state.previousAngle=angle;game.firstLevel.update(0);
  for(const b of a.supportBoxes)for(const z of [b.min.z,b.max.z])assert.ok(b.max.y<floor.heightAt(0,z)+.05,'Stand proxy covers walkable top');
 }
});
test('level eight uses the front impeller on grounded feet, with soft portal-traced air',async()=>{
 await game.selectLevel(7,false);game.resetRun(true);const l=game.firstLevel,s=l.state;
 const box=new THREE.Box3().setFromObject(s.sourceFan.art);assert.ok(Math.abs(box.min.y)<1e-4);assert.ok(box.min.x>l.bounds.minX&&box.max.x<l.bounds.maxX);
 assert.equal(s.sourceFan.id,31);assert.equal(s.airflow.mesh.name,'Soft advected airflow');assert.ok(s.airOrigin.x>box.max.x);
 const start=V(0,0,1).applyQuaternion(s.sourceFan.art.quaternion);assert.ok(start.dot(V(1,0,0))>.9999);
 s.enabled=true;for(let i=0;i<120;i++)l.update(1/120);l.renderUpdate(.5);
 assert.ok(s.sourceFan.pivot.rotation.z>0);assert.equal(s.airflow.mesh.visible,true);assert.ok(s.segments[0].a.distanceTo(s.airOrigin)<1e-6);
 l.reset();assert.equal(s.fanPhase,0);assert.equal(s.airflow.mesh.visible,false);assert.deepEqual(s.segments,[]);
});
test('rooms seven and eight still complete with ordinary input and the same companion',async()=>{
 for(const index of [6,7]){await game.selectLevel(index,false);const route=await runV8Journey(game);assert.ok(route.pass);assert.equal(route.resets,0);assert.equal(route.respawns,0);}
});
test('switching away releases the repaired mechanism without modifying the cached model',async()=>{
 const src=game.assets.get(34),areas=triangleAreas(src);await game.selectLevel(0,false);const count=game.colliders.length;
 await game.selectLevel(6,false);await game.selectLevel(7,false);await game.selectLevel(0,false);
 assert.equal(game.colliders.length,count);assert.equal(game.assets.get(34),src);assert.deepEqual(triangleAreas(src),areas);
 game.physics.dispose();game.portals.dispose();
});
