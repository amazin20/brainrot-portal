import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {LabPortals,makePortalFrame,portalIntersectsBox,portalBacksCollider} from '../src/game/LabPortals.js';
import {LabCamera} from '../src/game/LabCamera.js';
import {LabPortalRenderCulling} from '../src/game/LabPortalRenderCulling.js';
const V=THREE.Vector3;
let seed=98321;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
function oldBacking(frame,box,maxDepth=.7){
 if(!box||box.isEmpty())return false;
 const inv=frame.quaternion.clone().invert(),points=[];
 for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(new V(x,y,z).sub(frame.position).applyQuaternion(inv));
 const local=new THREE.Box3().setFromPoints(points);
 return local.max.z<=.08&&local.max.z>=-maxDepth&&local.min.z<.08&&portalIntersectsBox(frame,box,-maxDepth,.08);
}
test('backing-wall early rejection preserves the original predicate on 8000 tilted/elongated/nearby boxes',()=>{
 for(let i=0;i<8000;i++){
  const p=new V(rand()*20-10,rand()*20-10,rand()*20-10),n=new V(rand()-.5,rand()-.5,rand()-.5).normalize();
  const f=makePortalFrame(p,n),c=p.clone().add(new V((rand()-.5)*16,(rand()-.5)*16,(rand()-.5)*16));
  const size=new V(rand()*15+.01,rand()*15+.01,rand()*15+.01),box=new THREE.Box3().setFromCenterAndSize(c,size),depth=.1+rand()*2;
  assert.equal(portalBacksCollider(f,box,depth),oldBacking(f,box,depth),`sample${i}`);
 }
 const f=makePortalFrame(new V(),new V(0,0,1));
 for(const z of [-.700000001,-.7,-.699999999,.079999999,.08,.080000001]){
  const b=new THREE.Box3(new V(-2,-2,z-.1),new V(2,2,z));assert.equal(portalBacksCollider(f,b),oldBacking(f,b));
 }
 assert.equal(portalBacksCollider(f,null),false);assert.equal(portalBacksCollider(f,new THREE.Box3()),false);
});
test('distant backing queries no longer construct an eight-corner local box',()=>{
 const f=makePortalFrame(new V(),new V(0,0,1)),box=new THREE.Box3(new V(100,100,100),new V(101,101,101));
 const original=THREE.Box3.prototype.setFromPoints;let calls=0;
 THREE.Box3.prototype.setFromPoints=function(...args){calls++;return original.apply(this,args);};
 try{for(let i=0;i<100;i++)assert.equal(portalBacksCollider(f,box),false);assert.equal(calls,0);
  oldBacking(f,box);assert.equal(calls,1);
 }finally{THREE.Box3.prototype.setFromPoints=original;}
});
function anchorFixture(){const scene=new THREE.Scene(),portals=new LabPortals({scene});const parent=new THREE.Group(),anchor=new THREE.Object3D();parent.add(anchor);scene.add(parent);
 portals.place(0,new V(1,2,3),new V(0,0,1));portals.attachToSurface(0,anchor);return{scene,portals,parent,anchor,frame:portals.portals[0]};}
test('identical anchor synchronization avoids group updates but fixed-step history still commits independently',()=>{
 const {portals,frame}=anchorFixture();let updates=0;const original=frame.group.updateMatrixWorld;
 frame.group.updateMatrixWorld=function(...a){updates++;return original.apply(this,a);};
 try{portals.syncMovingSurfaces();assert.equal(updates,1);
  for(let i=0;i<100;i++){portals.beginPhysicsStep();portals.endPhysicsStep();portals.update(i/60);}
  assert.equal(updates,1);assert.deepEqual(portals.committedPhysicsFrames[0].pose.position.toArray(),[1,2,3]);
 }finally{portals.dispose();}
});
test('parent motion, local anchor edits and externally modified frame/group invalidate synchronization',()=>{
 const {portals,parent,frame}=anchorFixture();
 try{
  portals.syncMovingSurfaces();parent.position.set(4,0,0);portals.syncMovingSurfaces();assert.deepEqual(frame.position.toArray(),[5,2,3]);
  frame.anchor.position.x=2;portals.syncMovingSurfaces();assert.deepEqual(frame.position.toArray(),[6,2,3]);
  frame.position.x=99;frame.group.position.x=999;portals.syncMovingSurfaces();assert.equal(frame.position.x,6);assert.equal(frame.group.position.x,6);
  parent.rotation.y=.5;portals.syncMovingSurfaces();const normal=new V(0,0,1).applyAxisAngle(new V(0,1,0),.5);assert.ok(frame.normal.distanceTo(normal)<1e-12);
  frame.anchor.normal.set(1,0,0);portals.syncMovingSurfaces();assert.ok(frame.normal.distanceTo(normal)>.5);
  portals.clear();assert.equal(portals.portals[0],null);assert.ok(!portals.physicsFrames?.[0]);assert.ok(!portals.committedPhysicsFrames?.[0]);
 }finally{portals.dispose();}
});
function viewFixture(){const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(60,16/9,.1,100);camera.updateMatrixWorld(true);
 const culling=new LabPortalRenderCulling(),rect={x:540,y:280,width:200,height:160};
 const add=(x,y,z)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(.2,.2,.2),new THREE.MeshBasicMaterial());m.position.set(x,y,z);scene.add(m);return m;};
 const start=()=>{scene.updateMatrixWorld(true);culling.begin(scene,camera,rect,1280,720);};
 const dispose=()=>{culling.end();scene.traverse(o=>{o.geometry?.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m?.dispose();});};
 return{scene,camera,culling,rect,add,start,dispose};}
test('portal crop culls off-aperture geometry but preserves camera projection and visible geometry',()=>{
 const f=viewFixture(),near=f.add(0,0,-10),side=f.add(5,0,-10),back=f.add(0,0,10);const projection=f.camera.projectionMatrix.clone();
 try{f.start();assert.equal(near.visible,true);assert.equal(side.visible,false);assert.equal(back.visible,false);assert.equal(f.culling.hidden.length,2);
  assert.ok(f.camera.projectionMatrix.equals(projection));f.culling.end();assert.ok(near.visible&&side.visible&&back.visible);assert.equal(f.culling.hidden.length,0);
 }finally{f.dispose();}
});
test('crop does not discard sampled triangles that reach the existing pixel rectangle',()=>{
 const f=viewFixture(),point=new V();
 try{
  for(let i=0;i<1000;i++){const m=f.add((rand()-.5)*30,(rand()-.5)*20,-rand()*35-.2);m.rotation.set(rand()*3,rand()*3,rand()*3);m.scale.setScalar(rand()*5+.1);}
  f.start();let inside=0;
  for(const m of f.scene.children){for(let i=0;i<m.geometry.attributes.position.count;i++){
   point.fromBufferAttribute(m.geometry.attributes.position,i).applyMatrix4(m.matrixWorld).project(f.camera);
   const x=(point.x*.5+.5)*1280,y=(point.y*.5+.5)*720;
   if(point.z>=-1&&point.z<=1&&x>=f.rect.x&&x<=f.rect.x+f.rect.width&&y>=f.rect.y&&y<=f.rect.y+f.rect.height){inside++;assert.equal(m.visible,true);}
  }}assert.ok(inside>30);assert.ok(f.culling.hidden.length>200);
 }finally{f.dispose();}
});
test('custom vertex shaders, morphs, callbacks, never-culled meshes and parents with children retain full path',()=>{
 const f=viewFixture(),objects=Array.from({length:5},()=>f.add(5,0,-10));
 objects[0].material.dispose();objects[0].material=new THREE.ShaderMaterial();
 objects[1].geometry.morphAttributes.position=[objects[1].geometry.attributes.position.clone()];
 objects[2].onBeforeRender=()=>{};objects[3].frustumCulled=false;objects[4].add(new THREE.Group());
 const preHidden=f.add(7,0,-10);preHidden.visible=false;
 try{f.start();for(const m of objects)assert.ok(m.visible);f.culling.end();assert.equal(preHidden.visible,false);}
 finally{f.dispose();}
});
test('moving and instanced meshes use current bounds, with no retained previous-room objects',()=>{
 const f=viewFixture(),m=f.add(7,0,-10),i=new THREE.InstancedMesh(new THREE.BoxGeometry(.2,.2,.2),new THREE.MeshBasicMaterial(),1);
 f.scene.add(i);i.setMatrixAt(0,new THREE.Matrix4().makeTranslation(0,0,-10));i.computeBoundingSphere();
 try{f.start();assert.equal(m.visible,false);assert.equal(i.visible,true);f.culling.end();
  m.position.set(0,0,-10);i.setMatrixAt(0,new THREE.Matrix4().makeTranslation(7,0,-10));i.computeBoundingSphere();
  f.start();assert.equal(m.visible,true);assert.equal(i.visible,false);f.culling.end();f.scene.remove(i);f.start();f.culling.end();assert.equal(f.culling.hidden.length,0);
 }finally{i.geometry.dispose();i.material.dispose();f.dispose();}
});
test('full or invalid rectangles keep the old render path and repeated end is harmless',()=>{
 const f=viewFixture(),m=f.add(7,0,-10);
 try{for(const rect of [{x:0,y:0,width:1280,height:720},{x:0,y:0,width:NaN,height:1}]){
  f.scene.updateMatrixWorld(true);f.culling.begin(f.scene,f.camera,rect,1280,720);assert.equal(m.visible,true);f.culling.end();f.culling.end();}
 }finally{f.dispose();}
});

test('portal draw restores culling and world-update policy on a render exception',()=>{
 const f=viewFixture();const m=f.add(7,0,-10);
 const renderer={shadowMap:{needsUpdate:false},setRenderTarget(){},setViewport(){},setScissor(){},setScissorTest(){},clear(){},render(){assert.equal(m.visible,false);throw new Error('injected render failure');}};
 const p=new LabPortals({scene:f.scene,camera:f.camera,renderer});
 try{assert.throws(()=>p._draw({width:1280,height:720},f.camera,f.rect),/injected render failure/);assert.equal(m.visible,true);assert.equal(f.scene.matrixWorldAutoUpdate,true);assert.equal(p.renderCulling.hidden.length,0);
  renderer.shadowMap.needsUpdate=true;renderer.render=()=>assert.equal(m.visible,true);p._draw({width:1280,height:720},f.camera,f.rect);
 }finally{p.dispose();f.dispose();}
});

test('200 portal placements and clears reuse only six geometries/materials, while frames and physics stay fresh',()=>{
 const scene=new THREE.Scene(),p=new LabPortals({scene});
 p.prepare();assert.equal(p.ready,false);assert.ok(p.visuals.every(v=>!v.group.visible));
 const geometries=p.visuals.flatMap(v=>v.group.children.map(o=>o.geometry));
 const materials=p.visuals.flatMap(v=>v.group.children.map(o=>o.material));
 let geometryDisposals=0,materialDisposals=0,targetDisposals=0;
 for(const g of geometries)g.addEventListener('dispose',()=>geometryDisposals++);
 for(const m of materials)m.addEventListener('dispose',()=>materialDisposals++);
 for(const t of [...p.targets,p.bounceTarget])t.addEventListener('dispose',()=>targetDisposals++);
 let previous=null;
 for(let i=0;i<200;i++){
  const index=i%2,frame=p.place(index,new V(i,2,0),new V(0,0,1));
  assert.notEqual(frame,previous);previous=frame;
  assert.equal(frame.surface.geometry,geometries[index*3]);assert.equal(frame.surface.material,materials[index*3]);
  p.beginPhysicsStep();p.endPhysicsStep();assert.equal(p.committedPhysicsFrames[index].frame,frame);
  if(i%5===0){p.clear();assert.ok(!p.ready);assert.equal(scene.children.length,0);assert.ok(p.committedPhysicsFrames.every(f=>f===null));}
 }
 assert.equal(geometryDisposals+materialDisposals+targetDisposals,0);
 p.dispose();p.dispose();assert.equal(geometryDisposals,6);assert.equal(materialDisposals,6);assert.equal(targetDisposals,3);
 assert.equal(scene.children.length,0);assert.ok(p.visuals.every(v=>v===null));assert.throws(()=>p.prepare(),/disposed/);
});
test('replacing a portal resets recycled visibility and texture without reusing its old anchor',()=>{
 const {portals:p,frame}=anchorFixture();
 try{
  const material=frame.surface.material;p.update(1);frame.surface.visible=false;
  material.uniforms.view.value=p.bounceTarget.texture;
  const next=p.place(0,new V(9,5,3),new V(1,0,0));
  assert.notEqual(next,frame);assert.equal(next.anchor,undefined);assert.equal(next.surface.visible,true);
  assert.equal(next.surface.material,material);assert.equal(material.uniforms.view.value,p.targets[0].texture);
  assert.deepEqual(next.position.toArray(),[9,5,3]);p.syncMovingSurfaces();assert.deepEqual(next.position.toArray(),[9,5,3]);
 }finally{p.dispose();}
});


test('compile-only portal nodes detach afterwards without disposing resources or hiding active frames',()=>{
 const scene=new THREE.Scene(),p=new LabPortals({scene});
 try{
  p.prepare();assert.equal(scene.children.length,2);
  const geometry=p.visuals[0].surface.geometry;
  p.finishPreparation();p.finishPreparation();assert.equal(scene.children.length,0);
  const frame=p.place(0,new V(),new V(0,0,1));
  p.prepare();p.finishPreparation();assert.equal(scene.children.length,1);
  assert.equal(frame.group.parent,scene);assert.equal(frame.group.visible,true);
  assert.equal(frame.surface.geometry,geometry);assert.equal(p.ready,false);
 }finally{p.dispose();}
});


test('replacing an exit retires the old logical scene root even though GPU resources are pooled',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(62,16/9,.1,100);
 const p=new LabPortals({scene,camera}),rig=new LabCamera({camera});
 const exit=p.place(1,new V(),new V(0,0,1));
 const oldRoot=exit.group,oldMaterial=exit.surface.material,oldGeometry=exit.surface.geometry;
 camera.position.set(0,0,-1);camera.lookAt(0,0,1);camera.updateMatrixWorld(true);
 rig.portalExit=exit;rig.updatePortalClipping();assert.equal(rig.mainClippingPlanes.length,1);
 try{
  const replacement=p.place(1,new V(10,0,0),new V(0,0,1));
  assert.notEqual(replacement.group,oldRoot,'A stale exit must not borrow the live replacement scene root');
  assert.equal(oldRoot.parent,null);assert.equal(replacement.group.parent,scene);
  assert.equal(replacement.surface.material,oldMaterial);assert.equal(replacement.surface.geometry,oldGeometry);
  rig.updatePortalClipping();assert.equal(rig.portalExit,null);assert.equal(rig.mainClippingPlanes.length,0);
 }finally{p.dispose();}
});
