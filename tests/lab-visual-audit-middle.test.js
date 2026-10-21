import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {finishVisualAuditMiddle,conveyorChevronGeometry} from '../src/game/LabVisualAuditMiddle.js';
import {gameplayContract} from './helpers/lab-art-contract.js';

const game=await createHeadlessGame();game.chamberEdition='foundation';
after(()=>{game.firstLevel?.dispose?.();game.physics?.dispose();game.portals?.dispose();});
const V=(...a)=>new THREE.Vector3(...a);

for(let index=17;index<=33;index++)test(`visual audit ${index+1}: exact gameplay owners and measured collision subtrees survive the authored models`,async()=>{
 await game.selectLevel(index,true);const level=game.firstLevel;
 finishVisualAuditMiddle(game,level,index);level.visualAuditMiddle.root.dispose();
 delete level.workshop.visualAuditMiddle;delete level.visualAuditMiddle;
 const before=gameplayContract(game),originals=new Map();
 for(const mesh of new Set([...game.colliders.map(c=>c.mesh),...game.aimBlockers,...game.cameraBlockers,...game.portalPanels])){
  originals.set(mesh,{geometry:mesh.geometry,children:mesh.children.slice(),bounds:new THREE.Box3().setFromObject(mesh),matrix:mesh.matrix.clone()});
 }
 const bodies=game.physics.world.bodies.slice(),constraints=game.physics.world.constraints.slice(),portalMaterials=game.portalPanels.map(m=>[m,m.material]);
 finishVisualAuditMiddle(game,level,index);const art=level.visualAuditMiddle;
 assert.deepEqual(gameplayContract(game),before);
 assert.deepEqual(game.physics.world.bodies,bodies);assert.deepEqual(game.physics.world.constraints,constraints);
 for(const [mesh,snapshot]of originals){assert.equal(mesh.geometry,snapshot.geometry);assert.deepEqual(mesh.children,snapshot.children);assert.deepEqual(new THREE.Box3().setFromObject(mesh),snapshot.bounds);assert.deepEqual(mesh.matrix,snapshot.matrix);}
 for(const [mesh,material]of portalMaterials)assert.equal(mesh.material,material);
 if(index!==21&&index!==28)assert.ok(art.stats.parts>=17,`Room ${index+1} did not receive its intended machinery`);
 if(index===28)assert.equal(art.stats.gravityMarkers,40);
 assert.ok(art.stats.batches<=5);assert.equal(art.stats.extraColliders,0);assert.equal(art.stats.extraLights,0);
 const count=level.world.root.children.length;finishVisualAuditMiddle(game,level,index);assert.equal(level.world.root.children.length,count);
 const actual=new THREE.Matrix4(),expected=new THREE.Matrix4(),world=new THREE.Matrix4();
 level.renderUpdate(.37);art.root.updateWorldMatrix(true,true);
 for(const mount of art.root.mounts){
  mount.target.updateWorldMatrix(true,false);
  for(const part of mount.parts){
   assert.ok(mount.bounds.clone().expandByScalar(.0001).containsBox(part.bounds));
   part.mesh.getMatrixAt(part.index,actual);world.multiplyMatrices(art.root.matrixWorld,actual);expected.multiplyMatrices(mount.target.matrixWorld,part.matrix);
   for(let i=0;i<16;i++)assert.ok(Math.abs(world.elements[i]-expected.elements[i])<.00003,`${mount.name} does not follow its source`);
  }
 }
 const matrices=art.root.children.filter(m=>m.isInstancedMesh).map(m=>Array.from(m.instanceMatrix.array));
 level.renderUpdate(.37);assert.deepEqual(art.root.children.filter(m=>m.isInstancedMesh).map(m=>Array.from(m.instanceMatrix.array)),matrices,'A render-only call advanced a private mechanism clock');
});

test('belt chevrons reverse with the actual traction setting while original colliders and portal surfaces remain exact',async()=>{
 await game.selectLevel(26,true);const level=game.firstLevel,belt=level.state.conveyors;
 const slats=[];level.world.root.traverse(m=>{if(m.isInstancedMesh&&m.name.endsWith('travelling belt slats'))slats.push(m);});
 assert.equal(slats.length,2);assert.ok(slats.every(m=>m.geometry.name==='Conveyor directional chevron'));
 const before=gameplayContract(game),m=new THREE.Matrix4(),q=new THREE.Quaternion(),s=V(),p=V();
 belt.reversed=true;level.renderUpdate(1);slats[0].getMatrixAt(0,m);m.decompose(p,q,s);assert.ok(Math.abs(q.y)<.0001);
 belt.reversed=false;level.renderUpdate(1);slats[0].getMatrixAt(0,m);m.decompose(p,q,s);assert.ok(Math.abs(Math.abs(q.y)-1)<.0001);
 belt.reversed=true;assert.deepEqual(gameplayContract(game),before);
 const g=conveyorChevronGeometry(4.6);g.computeBoundingBox();assert.ok(g.boundingBox.getSize(V()).x<4.6);assert.ok(g.boundingBox.getSize(V()).z>.35);g.dispose();
});
