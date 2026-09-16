import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {OBB} from 'three/addons/math/OBB.js';
import {createPocketSuspension,SUSPENSION as P} from '../src/game/LabPocketSuspension.js';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
const g=await createHeadlessGame();await g.selectLevel(20,false);after(()=>{g.physics.dispose();g.portals.dispose();});
const all=[];const model=()=>{const m=createPocketSuspension();all.push(m);return m;};
after(()=>{for(const m of all){const gs=new Set(),ms=new Set();m.root.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)ms.add(o.material);});gs.forEach(g=>g.dispose());ms.forEach(g=>g.dispose());}});

test('batched suspension has finite geometry and bounded resources, no textures',()=>{
 const m=model();let count=0,triangles=0;
 m.root.traverse(o=>{if(!o.isMesh)return;count++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;
  for(const a of Object.values(o.geometry.attributes))assert.ok(a.array.every(Number.isFinite));
  assert.ok(!Object.values(o.material).some(v=>v?.isTexture));
 });
 assert.ok(count<=16);assert.ok(triangles<=15000);assert.equal(m.ropes.length,4);
});

test('four taut cables meet real carriage/weight anchors and drum tangencies at 121 heights',()=>{
 const m=model();
 for(let i=0;i<=120;i++){
  const h=P.low+(P.high-P.low)*i/120;m.pose(h);m.root.updateMatrixWorld(true);
  for(const r of m.ropes){
   const lower=r.mesh.localToWorld(new T.Vector3(0,-.5,0)),upper=r.mesh.localToWorld(new T.Vector3(0,.5,0));
   assert.ok(lower.distanceTo(r.eye.getWorldPosition(new T.Vector3()))<1e-8,'Dangling cable');
   assert.ok(upper.distanceTo(r.top)<1e-8,'Cable misses drum');
   assert.ok(Math.abs(lower.x-upper.x)<1e-8&&Math.abs(lower.z-upper.z)<1e-8,'Cable must be vertical');
   const centerZ=-6+r.side*P.drumZ;
   assert.ok(Math.abs(Math.abs(r.drumTangent.z-centerZ)-r.radius)<1e-9,'Incorrect drum radius');
  }
 }
});

test('retained 0.78 travel ratio agrees with drum rotation and cable payout in both directions',()=>{
 const m=model();let prior;
 for(const h of [15.8,13,9,3.8,9,13,15.8]){
  m.pose(h);
  const s={height:h,weight:m.weights.position.y,angle:m.drums[1].rotation.x};
  assert.ok(Math.abs(s.weight-(4+(15.8-h)*.78))<1e-12);
  if(prior){assert.ok(Math.abs((s.angle-prior.angle)*P.driveRadius+ s.height-prior.height)<1e-12);
   assert.ok(Math.abs((s.angle-prior.angle)*P.returnRadius-(s.weight-prior.weight))<1e-12);}
  prior=s;
 }
});

test('paused repetition and rejected input leave every visible pose unchanged',()=>{
 const m=model();m.pose(9.8);m.root.updateMatrixWorld(true);
 const snapshot=()=>{m.root.updateMatrixWorld(true);const a=[];m.root.traverse(o=>a.push(...o.matrixWorld.elements));return a;};
 const expected=snapshot();for(let i=0;i<120;i++)m.pose(9.8);assert.deepEqual(snapshot(),expected);
 for(const bad of [NaN,Infinity,-1,20])assert.throws(()=>m.pose(bad),RangeError);
 assert.deepEqual(snapshot(),expected);
});


test('split ballast no longer intersects inclined backing through the full retained motion',()=>{
 const c=g.firstLevel.cassette,m=c.suspension;
 const backing=c.face.group.children.find(o=>o.isMesh&&o.position.z===-.36);assert.ok(backing);backing.geometry.computeBoundingBox();
 const overlap=[];
 for(let i=0;i<=240;i++){
  const h=c.low+(c.high-c.low)*i/240;c.pose(h);g.scene.updateMatrixWorld(true);
  const surface=new OBB().fromBox3(backing.geometry.boundingBox).applyMatrix4(backing.matrixWorld);
  // Test the actual vertex clouds of both batched ballast meshes, not only
  // the lightweight authoring descriptors. Separate side AABBs stay conservative.
  const sides=[new T.Box3(),new T.Box3()];
  m.weights.traverse(o=>{if(!o.isMesh)return;const a=o.geometry.attributes.position;
   for(let n=0;n<a.count;n++){const p=new T.Vector3().fromBufferAttribute(a,n);const side=p.z<0?0:1;p.applyMatrix4(o.matrixWorld);sides[side].expandByPoint(p);}
  });
  for(let side=0;side<2;side++)if(surface.intersectsBox3(sides[side]))overlap.push({h,side});
 }
 assert.deepEqual(overlap,[]);g.resetRun(true);
});

test('suspension cannot change panel dimensions or participate in collisions, rays or floor support',()=>{
 const c=g.firstLevel.cassette,m=c.suspension,nodes=new Set();m.root.traverse(o=>nodes.add(o));
 for(const registry of [g.colliders,g.floors,g.aimBlockers,g.cameraBlockers,g.portalPanels])for(const entry of registry)assert.ok(!nodes.has(entry.mesh??entry));
 assert.equal(g.portalPanels.length,5);
 for(const h of [c.low,9.8,c.high]){
  c.pose(h);g.scene.updateMatrixWorld(true);const f=c.face.getFrame();
  assert.ok(Math.abs(f.center.y-h)<1e-9);assert.ok(Math.abs(f.normal.x-.45)<1e-9);
  assert.equal(f.halfWidth*2,6);assert.equal(f.halfHeight*2,6);
 }
 g.resetRun(true);
});

test('actual reset restores all suspension parts and preserves the same cargo body',()=>{
 const l=g.firstLevel,c=l.cassette,m=c.suspension,id=g.physics.cargoBody.id;c.pose(c.low);
 g.resetRun(true);assert.equal(c.height,c.high);assert.equal(c.braked,true);
 assert.equal(m.carriage.position.y,c.high);assert.equal(m.weights.position.y,4);assert.equal(g.physics.cargoBody.id,id);
 for(const d of m.drums)assert.ok(Math.abs(d.rotation.x)<1e-12);
});

test('ordinary level teardown releases every generated geometry without leaving a duplicate',async()=>{
 const root=g.firstLevel.cassette.suspension.root,gs=new Set(),disposed=new Set();root.traverse(o=>{if(o.geometry)gs.add(o.geometry);});
 gs.forEach(geo=>geo.addEventListener('dispose',()=>disposed.add(geo)));
 await g.selectLevel(0,false);assert.equal(disposed.size,gs.size);
 await g.selectLevel(20,false);let count=0;g.scene.traverse(o=>{if(o.name===root.name)count++;});assert.equal(count,1);
});
