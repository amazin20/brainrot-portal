import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {ACTIVE_FOUNDATION_RUNTIME_FLAGS} from '../src/game/ReleaseIdentity.js';
import {gameplayContract,digest} from './helpers/lab-art-contract.js';
import {disposeLabLevel} from '../src/game/LabLevelLifecycle.js';
import {installBiosphereArchitecture} from '../src/game/LabBiosphereArchitecture.js';
const fixtures=JSON.parse(fs.readFileSync(new URL('./fixtures/biosphere-architecture-before.json',import.meta.url)));

test('Every Biosphere room receives the remaster while preserving its complete old gameplay contract',async()=>{
 const g=await createHeadlessGame();Object.assign(g,{chamberEdition:'foundation',...ACTIVE_FOUNDATION_RUNTIME_FLAGS});
 for(const f of fixtures){
  await g.selectLevel(f.index,true);const l=g.firstLevel,a=l.biosphereArchitecture;assert.ok(a,`No artwork in room ${f.index+1}`);
  assert.equal(l.id,f.id);assert.equal(digest(gameplayContract(g)),f.hash,'Physics, aim, camera, portal or objective contract changed');
  assert.ok(a.stats.floorPanels>0);assert.ok(a.stats.sourcePanels>100);assert.ok(a.stats.batches<=8);assert.ok(a.stats.triangles<180000);
  assert.equal(a.stats.newColliders,0);assert.equal(a.stats.newLights,0);
  for(const mesh of a.root.children){assert.ok(mesh.isInstancedMesh);assert.ok(!g.colliders.some(c=>c.mesh===mesh));assert.ok(!g.aimBlockers.includes(mesh));assert.ok(!g.cameraBlockers.includes(mesh));assert.ok(!g.portalPanels.includes(mesh));}
  const oldRoot=a.root,oldCounts=a.stats.parts;installBiosphereArchitecture(g,l);assert.equal(l.biosphereArchitecture.root,oldRoot);assert.equal(a.stats.parts,oldCounts);
 }
 disposeLabLevel(g);
});

test('Imported source models and white portal materials are not recoloured; resources release once',async()=>{
 const g=await createHeadlessGame();Object.assign(g,{chamberEdition:'foundation',...ACTIVE_FOUNDATION_RUNTIME_FLAGS});
 const cache=[];for(const asset of g.assets.values())asset.traverse(o=>{if(o.geometry)cache.push([o,o.geometry,o.material]);});
 await g.selectLevel(23,true);const l=g.firstLevel,a=l.biosphereArchitecture,portal=g.portalPanels.map(m=>[m,m.material]);
 const counts=new Map([...Object.values(a.geometry),...Object.values(a.materials)].map(x=>[x,0]));for(const [r]of counts)r.addEventListener('dispose',()=>counts.set(r,counts.get(r)+1));
 const contract=digest(gameplayContract(g));a.release();a.release();assert.equal(digest(gameplayContract(g)),contract);assert.ok([...counts.values()].every(n=>n===1));
 for(const [m,mat]of portal)assert.equal(m.material,mat);for(const [o,geo,mat]of cache){assert.equal(o.geometry,geo);assert.equal(o.material,mat);}
 assert.equal(a.root.parent,null);await g.selectLevel(0,true);assert.equal(g.firstLevel.biosphereArchitecture,undefined);disposeLabLevel(g);
});

test('Botanical movement uses simulation time and reduced motion, never physics or actor transforms',async()=>{
 const g=await createHeadlessGame();Object.assign(g,{chamberEdition:'foundation',...ACTIVE_FOUNDATION_RUNTIME_FLAGS});await g.selectLevel(24,true);
 const l=g.firstLevel,a=l.biosphereArchitecture;assert.ok(a.stats.leaves>0);const body=g.physics.cargoBody,shape=body.shapes[0],cargo=g.cargo,p=g.playerPosition.clone();
 l.update(.1);l.renderUpdate(1);assert.ok(a.time.value>0);g.epicOptions={reducedMotion:true};l.renderUpdate(1);assert.equal(a.time.value,0);
 assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);assert.equal(body.shapes[0],shape);assert.deepEqual(g.playerPosition.toArray(),p.toArray());
 l.reset();assert.equal(a.time.value,0);disposeLabLevel(g);
});

test('Bronze floor inlay has a real four-millimetre depth separation, not coincident faces',async()=>{
 const g=await createHeadlessGame();Object.assign(g,{chamberEdition:'foundation',...ACTIVE_FOUNDATION_RUNTIME_FLAGS});
 for(const index of [20,29]){
  await g.selectLevel(index,true);const a=g.firstLevel.biosphereArchitecture;
  const r=a.records.find(r=>r.normal[1]>.9&&r.width>1.5&&r.height>1.5);assert.ok(r);
  const inset=Math.min(.13,r.width*.08,r.height*.08),point=new THREE.Vector3(r.width/2-inset,0,1).applyMatrix4(r.frame);
  a.root.updateWorldMatrix(true,true);point.applyMatrix4(a.root.matrixWorld);
  const normal=new THREE.Vector3(...r.normal).transformDirection(a.root.matrixWorld),ray=new THREE.Raycaster(point,normal.negate(),0,2);
  const hits=ray.intersectObject(a.root,true),metal=hits.find(h=>h.object.material.name.includes('bronze')),stone=hits.find(h=>h.object.material.name.includes('limestone'));
  assert.ok(metal&&stone);assert.ok(Math.abs(stone.distance-metal.distance-.004)<.00003,'Floor face and inlay are coplanar or separated by the wrong depth');
  assert.equal(hits[0].object,metal.object);assert.equal(hits[0].instanceId,metal.instanceId);
 }
 disposeLabLevel(g);
});
