import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {ACTIVE_FOUNDATION_RUNTIME_FLAGS} from '../src/game/ReleaseIdentity.js';

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

test('reviewed wall mounts retain the recorded placement in every other active room',async()=>{
 const g=await createHeadlessGame();Object.assign(g,ACTIVE_FOUNDATION_RUNTIME_FLAGS);g.chamberEdition='foundation';
 const baseline=JSON.parse(fs.readFileSync(new URL('./fixtures/ornament-mounts-901ff9d.json',import.meta.url),'utf8'));
 try{
  // The follow-up review deliberately extends the opening-room repair to
  // six later enclosures. The other 45 rooms retain their exact whole mounts.
  assert.equal(baseline.commit,'901ff9d43dff2642b8125a4ac36540ae863ec9f5');assert.equal(baseline.rows.length,51);
  for(const row of baseline.rows.filter(r=>![18,20,32,34,37,39].includes(r.n))){
   await g.selectLevel(row.n-1,false);
   assert.equal(g.firstLevel.id,row.id);
   assert.deepEqual(g.firstLevel.campaignEnvironment?.root.userData.mounts??[],row.mounts,`Room ${row.n} changed outside the reviewed scope`);
  }
 }finally{g.firstLevel.dispose();g.physics.dispose();g.portals.dispose();}
});
