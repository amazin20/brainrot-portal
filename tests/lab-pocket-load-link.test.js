import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPocketLoadLinkModel, attachPocketLoadLink, LOAD_LINK_MOUNTS } from '../src/game/LabPocketLoadLink.js';
import { createHeadlessGame } from '../scripts/lab-headless.mjs';

function dispose(model) {
  const geo = new Set(), mat = new Set();
  model.root.traverse(o => { if (o.geometry) geo.add(o.geometry); if(o.material) mat.add(o.material); });
  geo.forEach(x=>x.dispose()); mat.forEach(x=>x.dispose()); model.root.removeFromParent();
}
function fixture() {
  let loaded=false;
  const kit={world:{root:new THREE.Group()},ticks:[],renders:[],resets:[],state:{}};
  const model=attachPocketLoadLink(kit,{loaded:()=>loaded});
  return {kit,model,load:value=>{loaded=value;}};
}

test('one batched visual assembly has finite vertices, 5 draw meshes and no textures',()=>{
  const model=createPocketLoadLinkModel(); let meshes=0,triangles=0;
  model.root.traverse(o=>{
    if(!o.isMesh)return; meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;
    for(const attr of Object.values(o.geometry.attributes))assert.ok(attr.array.every(Number.isFinite));
    assert.ok(!Object.values(o.material).some(v=>v?.isTexture));
  });
  assert.equal(meshes,5);assert.ok(triangles<6000);assert.equal(model.pointers.length,2);
  assert.equal(model.mounts[0].position.x,LOAD_LINK_MOUNTS.sender[0]);
  model.set(1);assert.equal(model.pointers[0].rotation.z,model.pointers[1].rotation.z);dispose(model);
});

test('zero, half and full load have distinct pointer positions without colour changes',()=>{
  const m=createPocketLoadLinkModel(),c=m.pointers[0].children[0].material.color.getHex();
  for(const [value,angle]of [[0,.87],[.5,0],[1,-.87]]){m.set(value);assert.ok(Math.abs(m.pointers[0].rotation.z-angle)<1e-12);}
  assert.equal(m.pointers[0].children[0].material.color.getHex(),c);dispose(m);
});

test('step smoothing is independent of display grouping at 30/60/120 Hz and a long frame',()=>{
  const results=[];
  for(const hz of [30,60,120]){const f=fixture();f.load(true);for(let i=0;i<hz;i++)f.model.tick(1/hz);results.push(f.model.value);dispose(f.model);}
  const f=fixture();f.load(true);f.model.tick(.25);for(let i=0;i<90;i++)f.model.tick(1/120);results.push(f.model.value);dispose(f.model);
  for(const n of results)assert.ok(Math.abs(n-results[0])<1e-12);
});

test('render interpolation and repeated paused renders do not advance or change contact state',()=>{
  const f=fixture();f.load(true);f.model.tick(.1);const v=f.model.value;
  f.model.render(0);assert.equal(f.model.pointers[0].rotation.z,.87);
  f.model.render(1);const angle=f.model.pointers[0].rotation.z;
  for(let i=0;i<100;i++)f.model.render(1);
  assert.equal(f.model.value,v);assert.equal(f.model.pointers[0].rotation.z,angle);dispose(f.model);
});

test('invalid inputs are rejected before changing the presentation state',()=>{
 const f=fixture();for(const dt of [-1,NaN,Infinity])assert.throws(()=>f.model.tick(dt));
 assert.equal(f.model.value,0);for(const v of [-1,2,NaN])assert.throws(()=>f.model.set(v));
 assert.throws(()=>f.model.render(NaN));dispose(f.model);
});

const g=await createHeadlessGame();await g.selectLevel(20,false);
after(()=>{g.physics.dispose();g.portals.dispose();});
function supported(){g.resetRun(true);g.cargo.position.set(13,3.49,6);g.cargo.velocity.set(0,0,0);g.cargo.quaternion.identity();}
for(const brake of [true,false])test(`actual tray contact sets both indicators while brake=${brake}`,()=>{
 supported();const l=g.firstLevel,c=l.cassette,link=l.state.loadLink;c.braked=brake;
 // Narrow contact fixture. Not a route: only the display's read-only contract.
 assert.equal(l.state.cargoSeat.loaded(),true);
 for(let i=0;i<120;i++)link.tick(1/120);link.render(1);
 assert.equal(link.loaded,true);assert.ok(link.value>.9999);
 assert.equal(c.height,c.high);assert.equal(c.braked,brake,'Visual indication cannot release the brake');
 assert.equal(link.pointers[0].rotation.z,link.pointers[1].rotation.z);
});
for(const kind of ['held','airborne','outside'])test(`${kind} cargo does not assert a supported load`,()=>{
 supported();const link=g.firstLevel.state.loadLink;
 if(kind==='held')g.heldCube=g.cargo;
 else if(kind==='airborne')g.cargo.position.y+=1;
 else g.cargo.position.x=22;
 for(let i=0;i<120;i++)link.tick(1/120);link.render(1);assert.equal(link.loaded,false);assert.equal(link.value,0);
});

test('link meshes never become aim/camera/physics blockers or floor supports',()=>{
 const link=g.firstLevel.state.loadLink,nodes=new Set();link.root.traverse(n=>nodes.add(n));
 for(const registry of [g.colliders,g.floors,g.aimBlockers,g.cameraBlockers,g.portalPanels])
   for(const item of registry)assert.ok(!nodes.has(item.mesh??item));
 assert.equal(g.portalPanels.length,5);
});

test('reset removes residual loaded pose without replacing the companion or sound',()=>{
 supported();const link=g.firstLevel.state.loadLink;link.tick(2);link.render();assert.ok(link.value>.99);
 const body=g.physics.cargoBody.id;g.resetRun(true);assert.equal(g.physics.cargoBody.id,body);
 assert.equal(link.value,0);assert.equal(link.loaded,false);assert.equal(link.pointers[0].rotation.z,.87);
});

test('level exit disposes generated linkage geometry; return creates exactly one assembly',async()=>{
 const root=g.firstLevel.state.loadLink.root,geometries=new Set(),disposed=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});
 for(const geometry of geometries)geometry.addEventListener('dispose',()=>disposed.add(geometry));
 await g.selectLevel(0,false);assert.equal(disposed.size,geometries.size);
 await g.selectLevel(20,false);let count=0;g.scene.traverse(o=>{if(o.name==='Receiver to cassette / load linkage')count++;});assert.equal(count,1);
});
