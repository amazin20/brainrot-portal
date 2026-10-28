import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {ACTIVE_FOUNDATION_RUNTIME_FLAGS} from '../src/game/ReleaseIdentity.js';
import {gameplayContract,digest} from './helpers/lab-art-contract.js';
import {disposeLabLevel} from '../src/game/LabLevelLifecycle.js';
import {installOpticsArchitecture} from '../src/game/LabOpticsArchitecture.js';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/optics-architecture-before.json',import.meta.url)));
const V=(...p)=>new THREE.Vector3(...p);let g;
before(async()=>{g=await createHeadlessGame();Object.assign(g,{chamberEdition:'foundation',...ACTIVE_FOUNDATION_RUNTIME_FLAGS});});
after(()=>disposeLabLevel(g));
for(const f of fixture)test(`Observatory ${f.index+1}: original gameplay and all new relief vertices remain within the old wall panels`,async()=>{
 await g.selectLevel(f.index,true);const l=g.firstLevel,a=l.opticsArchitecture;assert.ok(a);assert.equal(l.id,f.id);
 assert.equal(digest(gameplayContract(g)),f.hash,'An actual physics, camera, aim, portal or interaction owner changed');
 assert.equal(a.stats.batches,8);assert.ok(a.stats.triangles<100000);assert.equal(a.stats.newColliders,0);assert.equal(a.stats.newLights,0);
 assert.ok(a.stats.irises>0&&a.stats.archives>0);assert.equal(a.panels.length,a.stats.panels);
 const matrix=new THREE.Matrix4(),point=V();
 for(const [key,entries]of a.banks){
  const mesh=a.root.children.find(m=>m.name==='Observatory / '+key);assert.ok(mesh);assert.equal(mesh.count,entries.length);
  assert.ok(!g.colliders.some(c=>c.mesh===mesh)&&!g.aimBlockers.includes(mesh)&&!g.cameraBlockers.includes(mesh)&&!g.portalPanels.includes(mesh));
  assert.ok(mesh.visible&&mesh.material.visible&&!mesh.material.transparent);
  for(let i=0;i<entries.length;i++){
   const p=a.panels[entries[i].panel],inverse=new THREE.Matrix4().fromArray(p.frame).invert();mesh.getMatrixAt(i,matrix);matrix.premultiply(inverse);
   const limit=new THREE.Box3(V(-p.width/2,-p.height/2,-.04),V(p.width/2,p.height/2,.04)).expandByScalar(.00003),vertices=mesh.geometry.attributes.position;
   for(let n=0;n<vertices.count;n++)assert.ok(limit.containsPoint(point.fromBufferAttribute(vertices,n).applyMatrix4(matrix)),key+' escapes the precise old panel');
  }
 }
 const before=g.scene.children.length;installOpticsArchitecture(g,l);assert.equal(l.opticsArchitecture,a);assert.equal(g.scene.children.length,before);
});
test('Original GLB geometry/materials and original portal porcelain retain their identities',async()=>{
 const assets=[];for(const source of g.assets.values())source.traverse(m=>{if(m.isMesh)assets.push([m,m.geometry,m.material]);});
 await g.selectLevel(32,true);const l=g.firstLevel,a=l.opticsArchitecture,portals=g.portalPanels.map(m=>[m,m.material]);
 const body=g.physics.cargoBody,shape=body.shapes[0],cargo=g.cargo;
 l.update(.1);l.renderUpdate(1);assert.ok(a.time.value>0);
 g.epicOptions={...g.epicOptions,reducedMotion:true};l.renderUpdate(1);assert.equal(a.time.value,0);g.epicOptions.reducedMotion=false;
 for(const [m,geo,mat]of assets){assert.equal(m.geometry,geo);assert.equal(m.material,mat);}
 for(const [m,mat]of portals)assert.equal(m.material,mat);
 assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);assert.equal(body.shapes[0],shape);
});
test('Architecture releases its buffers/materials once and restores visibility without a stale render callback',async()=>{
 await g.selectLevel(38,true);const l=g.firstLevel,a=l.opticsArchitecture,contract=digest(gameplayContract(g));
 const source=l.world.root.children.find(n=>n.name==='Manufactured architecture / Inset mineral wall cassettes');assert.ok(source&&!source.visible);
 const resources=[...Object.values(a.geometry),...Object.values(a.materials),...a.clones.values()],counts=new Map(resources.map(r=>[r,0]));
 for(const resource of resources)resource.addEventListener('dispose',()=>counts.set(resource,counts.get(resource)+1));
 const callback=l.renderUpdate;a.release();a.release();assert.ok(a.disposed);assert.equal(a.root.parent,null);assert.ok(source.visible);assert.notEqual(l.renderUpdate,callback);
 assert.equal(digest(gameplayContract(g)),contract);assert.ok([...counts.values()].every(n=>n===1));
 await g.selectLevel(0,true);assert.equal(g.firstLevel.opticsArchitecture,undefined);assert.ok([...counts.values()].every(n=>n===1));
});
test('The chapter bounds do not recolour other rooms',async()=>{
 for(const index of [19,29,41]){await g.selectLevel(index,true);assert.equal(g.firstLevel.opticsArchitecture,undefined);}
});
