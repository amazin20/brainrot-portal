import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createPocketReceiverModel,attachPocketReceiver} from '../src/game/LabPocketReceiver.js';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
const dispose=root=>{const gg=new Set(),mm=new Set();root.traverse(o=>{if(o.geometry)gg.add(o.geometry);if(o.material)mm.add(o.material)});gg.forEach(g=>g.dispose());mm.forEach(m=>m.dispose());};

test('full-area deck uses five meshes, no textures/lights and less than 2000 triangles',()=>{
 const m=createPocketReceiverModel(),bounds=new THREE.Box3().setFromObject(m.root);let meshes=0,triangles=0;
 m.root.traverse(o=>{assert.ok(!o.isLight);if(!o.isMesh)return;meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;
  for(const a of Object.values(o.geometry.attributes))assert.ok(a.array.every(Number.isFinite));
  assert.ok(!Object.values(o.material).some(v=>v?.isTexture));assert.equal(o.castShadow,false);
 });
 assert.equal(meshes,5);assert.ok(triangles<2000);assert.ok(bounds.max.z<1e-7); // Float32 geometry tolerance, no raised physical lip.assert.ok(bounds.min.z>=-.101);
 assert.ok(Math.abs(bounds.min.x+6.25)<1e-6&&Math.abs(bounds.max.x-6.25)<1e-6);assert.ok(Math.abs(bounds.min.y+4)<1e-6&&Math.abs(bounds.max.y-4)<1e-6);
 for(const value of [0,.5,1]){m.set(value);assert.equal(m.needles[0].rotation.z,.85-1.7*value);assert.equal(m.needles[0].rotation.z,m.needles[1].rotation.z);}
 for(const value of [-1,2,NaN,Infinity])assert.throws(()=>m.set(value));dispose(m.root);
});

test('contact motion is time based and paused rendering cannot advance it',()=>{
 const values=[];
 for(const hz of [30,60,120]){
  const surface={width:12.5,height:8,group:new THREE.Group()};const k={ticks:[],renders:[],resets:[],state:{}};
  const m=attachPocketReceiver(k,{surface,loaded:()=>true});for(let i=0;i<hz;i++)m.tick(1/hz);m.render(1);values.push(m.value);
  const a=m.needles[0].rotation.z;for(let i=0;i<50;i++)m.render(1);assert.equal(m.needles[0].rotation.z,a);
  m.reset();assert.equal(m.value,0);assert.equal(m.needles[0].rotation.z,.85);dispose(m.root);
 }
 for(const v of values)assert.ok(Math.abs(v-values[0])<1e-12);
});

const g=await createHeadlessGame();await g.selectLevel(20,false);after(()=>{g.physics.dispose();g.portals.dispose();});
test('receiver contact frame and collider are unchanged; only its own authored tiles were replaced',()=>{
 const s=g.firstLevel.state.cargoSeat.surface,f=s.getFrame();
 assert.deepEqual(f.center.toArray(),[13.25,3.10,6]);assert.equal(f.halfWidth,6.25);assert.equal(f.halfHeight,4);
 assert.equal(s.portal,false);assert.ok(s.group.children.includes(s.mesh));assert.ok(s.group.children.includes(s.backing));
 assert.equal(s.group.children.filter(o=>o.isInstancedMesh).length,0);assert.ok(s.mesh.userData.collisionProxy);
 assert.ok(s.collider.box.equals(new THREE.Box3().setFromObject(s.mesh)));assert.equal(g.portalPanels.length,5);
 for(const p of Object.values(g.firstLevel.panels))assert.ok(p.group.children.some(o=>o.isInstancedMesh));
 const nodes=new Set();g.firstLevel.state.receiverDeck.root.traverse(o=>nodes.add(o));
 for(const reg of [g.colliders,g.cameraBlockers,g.aimBlockers,g.floors])for(const x of reg)assert.ok(!nodes.has(x.mesh??x));
});
for(const state of ['supported','edge','held','hovering','outside'])test(`visible deck and remote cable use the same real ${state} load`,()=>{
 g.resetRun(true);const l=g.firstLevel,s=l.state;
 // Explicit contact fixture, NOT a route or visibility proof.
 g.cargo.position.set(state==='edge'?19.65:13.25,3.49,6);g.cargo.quaternion.identity();g.cargo.velocity.set(0,0,0);
 if(state==='held')g.heldCube=g.cargo;if(state==='hovering')g.cargo.position.y+=1;if(state==='outside')g.cargo.position.x=22;
 for(let i=0;i<120;i++){s.receiverDeck.tick(1/120);s.loadLink.tick(1/120);}s.receiverDeck.render(1);s.loadLink.render(1);
 assert.equal(s.receiverDeck.loaded,state==='supported'||state==='edge');assert.equal(s.receiverDeck.loaded,s.loadLink.loaded);assert.equal(s.receiverDeck.value,s.loadLink.value);
 assert.equal(l.cassette.height,l.cassette.high,'Read-only indicators cannot move cassette');
});

test('framed observation windows tile the old solid wall and still block shots and cameras',()=>{
 const {panes,solids}=g.firstLevel.state.receiverObservation;
 const expected=new THREE.Box3(new THREE.Vector3(5.15,7.2,2),new THREE.Vector3(5.85,16.2,10)),all=new THREE.Box3();let volume=0;
 for(const m of solids){const b=new THREE.Box3().setFromObject(m),size=b.getSize(new THREE.Vector3());all.union(b);volume+=size.x*size.y*size.z;
  assert.ok(g.colliders.some(c=>c.mesh===m));assert.ok(g.aimBlockers.includes(m)&&g.cameraBlockers.includes(m));assert.ok(!m.userData.portalable);
 }
 assert.ok(all.min.distanceTo(expected.min)<1e-6&&all.max.distanceTo(expected.max)<1e-6);assert.ok(Math.abs(volume-.7*9*8)<1e-4);
 for(const z of [2.2,3.375,4.5,5,6,7,7.5,8.625,9.8])for(const y of [7.25,8.3,9.3,10,16.1]){
  const ray=new THREE.Raycaster(new THREE.Vector3(3,y,z),new THREE.Vector3(1,0,0),0,4);
  const hits=ray.intersectObjects(solids,false);assert.ok(hits.length>0,`hole at${y},${z}`);
 }
 for(const p of panes){assert.equal(p.visible,true);assert.equal(p.material.transparent,true);assert.ok(p.material.opacity>=.1);assert.equal(p.material.depthWrite,false);}
});

test('restart keeps the same cargo body and clears load display; leaving releases generated resources',async()=>{
 const body=g.physics.cargoBody.id,model=g.firstLevel.state.receiverDeck;model.tick(1);model.render(1);g.resetRun(true);
 assert.equal(g.physics.cargoBody.id,body);assert.equal(model.value,0);
 const geos=new Set(),freed=new Set();model.root.traverse(o=>{if(o.geometry)geos.add(o.geometry)});geos.forEach(q=>q.addEventListener('dispose',()=>freed.add(q)));
 await g.selectLevel(0,false);assert.equal(freed.size,geos.size);await g.selectLevel(20,false);
 let n=0;g.scene.traverse(o=>{if(o.name==='Cargo receiver / full-area weighing deck')n++});assert.equal(n,1);
});
