import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {LabGame} from '../src/game/LabGame.js';import {LabPhysics} from '../src/game/LabPhysics.js';
import {createPlanter,createDrive,createCanopy,createGuideRing,createCrystal,createPontoon,createSolarObservatory,bindSolidModel} from '../src/game/LabSolidModels.js';
const factories={planter:createPlanter,drive:createDrive,canopy:createCanopy,ring:createGuideRing,crystal:createCrystal,pontoon:()=>createPontoon(8.8,7.8),observatory:createSolarObservatory};
for(const [name,make] of Object.entries(factories))test(`${name}: opaque closed geometry, finite compound collision and four-material budget`,()=>{
 const model=make(),materials=new Set();let triangles=0;
 assert.ok(model.userData.collisionParts.length);for(const {min,max} of model.userData.collisionParts)for(let i=0;i<3;i++){assert.ok(Number.isFinite(min[i])&&Number.isFinite(max[i]));assert.ok(max[i]>min[i]);}
 model.traverse(n=>{if(!n.isMesh)return;materials.add(n.material);assert.equal(n.material.transparent,false);assert.equal(n.material.opacity,1);assert.equal(n.material.depthWrite,true);assert.equal(n.material.depthTest,true);assert.equal(n.material.side,THREE.FrontSide);
  const g=n.geometry,p=g.attributes.position,normal=g.attributes.normal;triangles+=g.index.count/3;
  for(const f of [...p.array,...normal.array])assert.ok(Number.isFinite(f));
  // Quantized positional edges ignore intended material/normal splits.
  const edges=new Map(),key=i=>[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e4)).join(',');
  for(let i=0;i<g.index.count;i+=3){const v=[0,1,2].map(j=>key(g.index.getX(i+j)));for(let j=0;j<3;j++){const a=v[j],b=v[(j+1)%3];if(a===b)continue;const k=[a,b].sort().join('|');edges.set(k,(edges.get(k)||0)+1);}}
  assert.equal([...edges.values()].filter(n=>n===1).length,0,`${name}: open boundary edges`);
 });assert.ok(materials.size<=4);assert.ok(triangles<15000);
});
function game(){const g=new LabGame({container:null,touch:false});g.scene=new THREE.Scene();g.materials={dark:new THREE.MeshBasicMaterial()};g.portals={ready:false};g.physics=new LabPhysics();return g;}
test('the guide collar blocks the rim, not its empty aperture; player resolution stops at the solid envelope',()=>{
 const g=game(),model=createGuideRing();g.scene.add(model);const binding=bindSolidModel(g,model);
 g.scene.updateMatrixWorld(true);const ray=new THREE.Raycaster(new THREE.Vector3(0,0,3),new THREE.Vector3(0,0,-1),0,6);
 assert.equal(ray.intersectObjects(g.aimBlockers,false).length,0);
 ray.ray.origin.x=6;assert.ok(ray.intersectObjects(g.aimBlockers,false).length>0);
 const position=new THREE.Vector3(6,-.8,.48),previous=new THREE.Vector3(6,-.8,.8),velocity=new THREE.Vector3(0,0,-4);
 g.resolveBody(position,previous,velocity,.46,1.6);assert.ok(position.z>.60);assert.equal(velocity.z,0);
 assert.ok(binding.colliders.every(c=>!c.box.containsPoint(new THREE.Vector3())));g.physics.dispose();
});
test('compound collision follows translation, rotation and scale at fixed-step poses',()=>{
 const g=game(),model=createGuideRing();g.scene.add(model);const binding=bindSolidModel(g,model,{kinematic:true});
 for(const c of binding.colliders)g.physics.addStaticBox(c.mesh.uuid,c.box,{kinematic:true});
 model.position.set(5,7,3);model.rotation.set(.7,.4,0);model.scale.setScalar(1.3);binding.sync(1/120);
 binding.colliders.forEach((c,i)=>{const part=model.userData.collisionParts[i],b=new THREE.Box3(new THREE.Vector3(...part.min),new THREE.Vector3(...part.max)).applyMatrix4(model.matrixWorld);assert.ok(c.box.equals(b));assert.ok(c.kinematic);assert.ok(g.physics.solids.has(c.mesh.uuid));});g.physics.dispose();
});
