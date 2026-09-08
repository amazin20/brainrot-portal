import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {BALANCE_RIG_LAYOUT as L} from '../src/game/LabBalanceRig.js';
import {resolvePortalPlacement} from '../src/game/LabPortals.js';
import {runV8Journey} from '../src/game/LabV8Journey.js';
const game=await createHeadlessGame();
const V=(...v)=>new THREE.Vector3(...v);
function triangleAreas(root){
 const areas=[];root.updateWorldMatrix(true,true);
 root.traverse(m=>{if(!m.isMesh)return;const p=m.geometry.attributes.position,index=m.geometry.index;
  for(let i=0;i<(index?.count??p.count);i+=3){const a=[0,1,2].map(k=>V().fromBufferAttribute(p,index?index.getX(i+k):i+k).applyMatrix4(m.matrixWorld));areas.push(a[1].sub(a[0]).cross(a[2].sub(a[0])).length()/2);}
 });return areas.sort((a,b)=>a-b);
}
test('room seven uses the new articulated rocker with independent trays and a narrow supported spine',async()=>{
 await game.selectLevel(6,false);game.resetRun(true);const s=game.firstLevel.state,a=s.rig;
 assert.equal(s.balanceArt,a);assert.ok(game.firstLevel.fixtures.includes(a));
 assert.deepEqual(a.root.scale.toArray(),[1,1,1]);assert.deepEqual(a.moving.scale.toArray(),[1,1,1]);
 assert.equal(s.support.length,3);assert.equal(a.deckSurfaces.length,3);
 for(const c of s.support){assert.ok(game.colliders.includes(c));assert.ok(game.physics.solids.has(c.mesh.uuid));}
 assert.ok(s.support.every(c=>c.floor.heightAt(1.25,0)===null),'A broad invisible deck fills the open side of the axle');
 assert.equal(s.support[2].floor.heightAt(0,0),L.pivotHeight+L.deckTop);
});
test('both trays tilt around the stationary bearing and moving portal apertures remain usable',async()=>{
 await game.selectLevel(6,false);game.resetRun(true);const s=game.firstLevel.state,a=s.rig;
 const fixed=a.fixedSupportBoxes.map(b=>b.clone()),samples=[];
 for(const angle of [-L.maxAngle,0,L.maxAngle]){
  s.angle=s.previousAngle=angle;s.omega=0;game.firstLevel.update(0);game.firstLevel.renderUpdate(1);game.scene.updateMatrixWorld(true);
  assert.ok(a.fixedSupportBoxes.every((b,i)=>b.equals(fixed[i])));
  samples.push(L.deckEnds.map(z=>a.moving.localToWorld(V(0,L.deckTop,z)).y));
  for(const name of ['balance-launch','lever-load']){
   const p=game.firstLevel.panels[name],f=p.getFrame();
   assert.ok(f.normal.dot(V(0,Math.cos(angle),Math.sin(angle)))>.999999);
   const placement=resolvePortalPlacement(p.mesh,f.center,{blockers:game.colliders});
   assert.ok(placement.ok,`${name} does not fit at ${angle}: ${placement.reason}`);
  }
 }
 assert.ok(samples[2][0]>samples[0][0]+1.5&&samples[2][1]<samples[0][1]-1.5);
});
test('each rotated player support plane matches its real Cannon top and visible deck',async()=>{
 await game.selectLevel(6,false);game.resetRun(true);const l=game.firstLevel,s=l.state;
 for(const angle of [-L.maxAngle,-.15,0,.15,L.maxAngle]){
  s.angle=s.previousAngle=angle;s.omega=0;l.update(0);game.scene.updateMatrixWorld(true);
  for(const [i,c] of s.support.entries()){
   const part=s.rig.deckSurfaces[i],point=s.rig.moving.localToWorld(V(0,c.surfaceOffset,part.center.z));
   const y=c.floor.heightAt(point.x,point.z);assert.ok(Math.abs(y-point.y)<1e-8);
   const body=game.physics.solids.get(c.mesh.uuid).body,normal=V(0,1,0).applyQuaternion(body.quaternion);
   const top=V().copy(body.position).addScaledVector(normal,body.shapes[0].halfExtents.y);
   assert.ok(Math.abs(top.clone().sub(point).dot(normal))<1e-6,'Player and cargo have different support heights');
   const ray=new THREE.Raycaster(point.clone().addScaledVector(normal,1),normal.clone().negate());
   const hit=ray.intersectObject(part.mesh,false)[0];assert.ok(hit,'No visible deck under its support');
   const cladding=i<2?c.surfaceOffset-L.deckTop:0;
   assert.ok(Math.abs(point.clone().sub(hit.point).dot(normal)-cladding)<1e-6,'Deck support is detached from its artwork');
  }
 }
});
test('grounded support proxies do not occupy any point above the moving walk surface',async()=>{
 await game.selectLevel(6,false);game.resetRun(true);const s=game.firstLevel.state,a=s.rig;
 assert.ok(a.fixedSupportBoxes.length>8);
 for(const b of a.fixedSupportBoxes){
  assert.ok(b.min.toArray().concat(b.max.toArray()).every(Number.isFinite));
  assert.ok(game.colliders.some(c=>c.box.min.distanceTo(b.min)<1e-6&&c.box.max.distanceTo(b.max)<1e-6),'A visible bearing support has no collision');
 }
 for(const angle of [-L.maxAngle,L.maxAngle]){
  s.angle=s.previousAngle=angle;game.firstLevel.update(0);
  for(const b of a.fixedSupportBoxes)for(const c of s.support)for(const x of [b.min.x,b.max.x])for(const z of [b.min.z,b.max.z]){
   const y=c.floor.heightAt(x,z);if(y!==null)assert.ok(b.max.y<y-.05,'Fixed support proxy covers a usable deck top');
  }
 }
});
test('a real free companion reverses the rocker torque and a longer arm increases its moment',async()=>{
 await game.selectLevel(6,false);
 // These explicit contact fixtures isolate the load law; the separate
 // ordinary-control test supplies the complete playable solution.
 const measure=(z,held=false)=>{
  game.resetRun(true);const s=game.firstLevel.state,p=V(0,L.pivotHeight+s.surfaceOffset+.39,z);
  game.physics.resetCargo({position:p});game.cargo.position.copy(p);game.cargo.velocity.set(0,0,0);game.cargo.quaternion.identity();
  if(held)game.heldCube=game.cargo;
  game.firstLevel.update(0);return {torque:s.torque,loaded:s.loaded};
 };
 const unloaded=measure(3.4,true),near=measure(1.1),far=measure(3.4),opposite=measure(-3.4);
 assert.equal(unloaded.loaded,false);assert.equal(near.loaded,true);assert.equal(far.loaded,true);assert.equal(opposite.loaded,true);
 assert.ok(near.torque>unloaded.torque&&far.torque>0&&opposite.torque<unloaded.torque);
 assert.ok((far.torque-unloaded.torque)>2*(near.torque-unloaded.torque),'Increasing the actual arm did not increase the load moment');
 assert.ok(Math.abs((far.torque-unloaded.torque)+(opposite.torque-unloaded.torque))<1e-7,'Opposite equal loads do not give opposite moments');
 game.resetRun(true);
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
test('room eight still completes with ordinary input and the same companion',async()=>{
 for(const index of [7]){await game.selectLevel(index,false);const route=await runV8Journey(game);assert.ok(route.pass);assert.equal(route.resets,0);assert.equal(route.respawns,0);}
});
test('switching away releases the repaired mechanism without modifying the cached model',async()=>{
 const src=game.assets.get(31),areas=triangleAreas(src);await game.selectLevel(0,false);const count=game.colliders.length;
 await game.selectLevel(6,false);await game.selectLevel(7,false);await game.selectLevel(0,false);
 assert.equal(game.colliders.length,count);assert.equal(game.assets.get(31),src);assert.deepEqual(triangleAreas(src),areas);
 game.physics.dispose();game.portals.dispose();
});
