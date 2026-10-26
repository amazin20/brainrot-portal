import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';

const V=(...a)=>new THREE.Vector3(...a);
function drawn(hit){
 for(let n=hit.object;n;n=n.parent)if(!n.visible)return false;
 const m=Array.isArray(hit.object.material)?hit.object.material[hit.face?.materialIndex??0]:hit.object.material;
 return m?.visible!==false&&!m?.transparent;
}

test('room-one calibration arcs remain visible below the actual cornice that hid the old mounts',async()=>{
 const g=await createHeadlessGame();g.chamberEdition='foundation';await g.selectLevel(0,false);
 try{
  const l=g.firstLevel,root=l.campaignEnvironment.root,arc=root.getObjectByName('Chapter ornament / arc / frame');
  assert.ok(arc?.isInstancedMesh);assert.equal(arc.count,2);
  assert.equal(l.campaignEnvironment.diagnostics.extraColliders,0);assert.equal(l.campaignEnvironment.diagnostics.extraLights,0);
  g.scene.updateMatrixWorld(true);
  const mounts=root.userData.mounts;
  assert.deepEqual(mounts.map(s=>s.center[1]),[8.81,8.81]);
  // This front-facing sample is on the high part of the real open torus.
  // Both old world-space mount centres were y=9.8 in the captured source.
  const sample=V(Math.cos(Math.PI/2+.36),Math.sin(Math.PI/2+.36),.065),matrix=new THREE.Matrix4();
  for(let i=0;i<arc.count;i++){
   arc.getMatrixAt(i,matrix);matrix.premultiply(arc.matrixWorld);
   const target=sample.clone().applyMatrix4(matrix),normal=V(...mounts[i].normal);
   const first=p=>new THREE.Raycaster(p.clone().addScaledVector(normal,3),normal.clone().negate(),0,4).intersectObjects(g.scene.children,true).find(drawn);
   const visible=first(target);assert.equal(visible?.object,arc,'The real upper arc must be the first opaque drawn surface');
   // Restore only this drawing to its recorded former mount. The solid
   // cornice stays untouched: the same sample must reproduce its occlusion.
   const old=new THREE.Matrix4();arc.getMatrixAt(i,old);const saved=old.clone();old.elements[13]+=.99;arc.setMatrixAt(i,old);arc.instanceMatrix.needsUpdate=true;
   const blocked=first(target.clone().add(V(0,.99,0)));
   assert.notEqual(blocked?.object,arc,'The recorded former position must reproduce the defect');
   assert.match(blocked?.object.material?.name??'',/Satin enamel \/ structural shell/);
   arc.setMatrixAt(i,saved);arc.instanceMatrix.needsUpdate=true;
  }
 }finally{g.firstLevel.dispose();g.physics.dispose();g.portals.dispose();}
});

test('the reviewed opening-room mount repair retains the recorded later-chapter mount heights',async()=>{
 const g=await createHeadlessGame();g.chamberEdition='foundation';
 try{
  // Recorded before the repair; these rooms share the enclosure builder but
  // their artwork has not received this opening-chapter visual review.
  for(const [number,y]of [[18,9.8],[20,9.8],[32,8.9],[34,11.2],[37,11.2],[39,11.2]]){
   await g.selectLevel(number-1,false);
   assert.deepEqual(g.firstLevel.campaignEnvironment.root.userData.mounts.map(s=>s.center[1]),[y,y],`Room ${number} changed outside the reviewed scope`);
  }
 }finally{g.firstLevel.dispose();g.physics.dispose();g.portals.dispose();}
});
