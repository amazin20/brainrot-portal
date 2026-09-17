import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {OBB} from 'three/addons/math/OBB.js';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {visibleBounds,glassPlaneCrossings} from '../scripts/lib/pocket-clearance.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {installRoom21Aim} from '../src/game/LabRoom21Journey.js';
const g=await createHeadlessGame();await g.selectLevel(20,false);
after(()=>{g.physics.dispose();g.portals.dispose();});
const named=name=>{const m=g.scene.getObjectByName(name);assert.ok(m?.isMesh,name);return m;};
const planeName='Counterweight inspection glass / solid';

// Explicit poses here are clearance fixtures, not evidence of player traversal.
test('old glass plane cuts real moving triangles; repaired rear clears all visible panel vertices at 241 poses',()=>{
 const c=g.firstLevel.cassette,glass=named(planeName);
 const old=new T.Mesh(new T.BoxGeometry(.14,13,6));old.position.set(-12.8,11,-6);old.updateMatrixWorld(true);
 const hitCounts=[];let rearGap=Infinity,northGap=Infinity,southGap=Infinity;
 const innerRear=-14.28,innerNorth=-10.625,innerSouth=-1.375;
 for(let i=0;i<=240;i++){
  c.pose(c.low+(c.high-c.low)*i/240);g.scene.updateMatrixWorld(true);
  const b=visibleBounds(c.face.group);
  rearGap=Math.min(rearGap,b.min.x-innerRear);northGap=Math.min(northGap,b.min.z-innerNorth);southGap=Math.min(southGap,innerSouth-b.max.z);
  assert.equal(glassPlaneCrossings(c.face.group,glass).length,0);
  if(i%60===0)hitCounts.push(glassPlaneCrossings(c.face.group,old).length);
 }
 assert.ok(hitCounts.every(n=>n>0),'Regression must reproduce actual triangle crossings of the old plane');
 assert.ok(rearGap>.12&&northGap>.15&&southGap>.15,JSON.stringify({rearGap,northGap,southGap}));
 old.geometry.dispose();old.material.dispose();g.resetRun(true);
});

test('every changed enclosure skin is visible, registered and owns its actual collision and ray shape',()=>{
 const meshes=[];g.scene.traverse(o=>{if(o.userData.cassetteEnclosure)meshes.push(o);});assert.equal(meshes.length,13);
 for(const m of meshes){
  assert.ok(m.visible&&!m.userData.portalable);
  const c=g.colliders.find(c=>c.mesh===m);assert.ok(c?.enabled,m.name);
  const box=new T.Box3().setFromObject(m);assert.ok(c.box.min.distanceTo(box.min)<1e-5&&c.box.max.distanceTo(box.max)<1e-5,m.name);
  assert.ok(g.aimBlockers.includes(m)&&g.cameraBlockers.includes(m));
 }
 const glass=named(planeName);const ray=new T.Raycaster(new T.Vector3(-17,10,-6),new T.Vector3(1,0,0));
 assert.ok(ray.intersectObject(glass).length>0,'Transparent glass must remain a real closed skin');
});

test('folded rear profile is sealed, without an exposed diagonal corner',()=>{
 const skins=[];g.scene.traverse(o=>{if(o.userData.cassetteEnclosure)skins.push(new T.Box3().setFromObject(o));});
 const glass=named(planeName),pane=new T.Box3().setFromObject(glass);
 const cheeks=[];g.scene.traverse(o=>{if(o.name==='Cassette rear folded cheek / solid')cheeks.push(new T.Box3().setFromObject(o));});
 assert.equal(cheeks.length,2);for(const cheek of cheeks)assert.ok(cheek.clone().expandByScalar(1e-6).intersectsBox(pane));
 // Sweep exterior rays across the complete closed folded rear cross-section,
 // including its glass, metal stiles and depth changes; not an assumed flat wall.
 for(let y=.1;y<24;y+=.37)for(let z=-11.1;z<-.9;z+=.31){
  const ray=new T.Ray(new T.Vector3(-18,y,z),new T.Vector3(1,0,0));
  assert.ok(skins.some(b=>ray.intersectBox(b,new T.Vector3())),`Rear seam y${y} z${z}`);
 }
});

test('all moving visible parts, including instanced ceramic, clear every altered skin for both directions',()=>{
 const c=g.firstLevel.cassette,skins=[];g.scene.traverse(o=>{if(o.userData.cassetteEnclosure)skins.push({name:o.name,box:new T.Box3().setFromObject(o)});});
 const moving=[];c.face.group.traverseVisible(o=>{if(o.isMesh){o.geometry.computeBoundingBox();moving.push(o);}});
 const failures=[];
 for(let i=0;i<=240;i++){
  const height=i<=120?c.low+(c.high-c.low)*i/120:c.high-(c.high-c.low)*(i-120)/120;
  c.pose(height);g.scene.updateMatrixWorld(true);
  for(const mesh of moving)for(let n=0;n<(mesh.isInstancedMesh?mesh.count:1);n++){
   const matrix=mesh.matrixWorld.clone();if(mesh.isInstancedMesh){const instance=new T.Matrix4();mesh.getMatrixAt(n,instance);matrix.multiply(instance);}
   const box=new OBB().fromBox3(mesh.geometry.boundingBox).applyMatrix4(matrix);
   for(const skin of skins)if(box.intersectsBox3(skin.box))failures.push({height,mesh:mesh.name,skin:skin.name});
  }
 }
 assert.deepEqual(failures,[]);g.resetRun(true);
});

test('protected outlet extent, portal dimensions and kinematic rules are unchanged',()=>{
 const c=g.firstLevel.cassette,b=new T.Box3().setFromObject(named('Cassette upper side return / solid'));
 assert.ok(Math.abs(b.max.x+2.05)<1e-5);assert.equal(g.portalPanels.length,5);
 assert.equal(c.low,3.8);assert.equal(c.high,15.8);
 for(const h of [c.low,9.8,c.high]){
  c.pose(h);const f=c.face.getFrame();assert.equal(f.halfWidth,3);assert.equal(f.halfHeight,3);
  assert.ok(f.center.distanceTo(new T.Vector3(-10,h,-6))<1e-9);assert.ok(Math.abs(f.normal.x-.45)<1e-9);
 }
 g.resetRun(true);
});

test('release, mid-travel brake, reverse and reset keep real actuator inside the clear housing',()=>{
 g.resetRun(true);const l=g.firstLevel,c=l.cassette,seat=l.state.cargoSeat.surface.getFrame();
 // Narrow mechanism fixture: place the real existing body on the real tray.
 g.cargo.position.copy(seat.center).add(new T.Vector3(0,.39,0));g.cargo.velocity.set(0,0,0);g.cargo.quaternion.identity();
 const id=g.physics.cargoBody.id;c.toggleBrake();
 for(let n=0;n<120;n++)l.update(1/120);
 assert.ok(c.height<c.high-2);c.toggleBrake();const held=c.height;
 for(let n=0;n<240;n++)l.update(1/120);assert.equal(c.height,held);
 g.heldCube=g.cargo;c.toggleBrake();for(let n=0;n<240;n++)l.update(1/120);assert.equal(c.height,c.high);
 g.resetRun(true);assert.equal(g.physics.cargoBody.id,id);assert.equal(c.braked,true);
});

for(const x of [-14,-13.8,-13.6])test(`existing brake shot remains available from departure x=${x}`,async()=>{
 const r=await runV8Journey(g,{scenario:d=>{
  installRoom21Aim(d);d.walk(-10,14);d.aim(0,d.level.panels['departure-entry'].getFrame().center);
  d.walk(x,13);d.aim(1,d.level.panels['brake-bay'].getFrame().center);
  assert.equal(g.portals.portals[1].surfaceId,d.level.panels['brake-bay'].mesh.uuid);
  d.enter(d.level.panels['departure-entry']);d.walk(-15.5,-12.2);
  assert.equal(g.interact(),true);assert.equal(d.level.cassette.braked,false);
 }});assert.equal(r.resets+r.respawns,0);
});

test('room teardown disposes changed shell and re-entry creates just one inspection window',async()=>{
 const geometries=new Set(),disposed=new Set();g.scene.traverse(o=>{if(o.userData.cassetteEnclosure)geometries.add(o.geometry);});
 geometries.forEach(geo=>geo.addEventListener('dispose',()=>disposed.add(geo)));
 await g.selectLevel(0,false);assert.equal(disposed.size,geometries.size);
 await g.selectLevel(20,false);let count=0;g.scene.traverse(o=>{if(o.name===planeName)count++;});assert.equal(count,1);
});
