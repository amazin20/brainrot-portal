import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {ACTIVE_FOUNDATION_RUNTIME_FLAGS} from '../src/game/ReleaseIdentity.js';
import {gameplayContract,digest} from './helpers/lab-art-contract.js';

const baseline=JSON.parse(fs.readFileSync(new URL('./fixtures/ornament-mounts-901ff9d.json',import.meta.url),'utf8'));
const g=await createHeadlessGame();Object.assign(g,ACTIVE_FOUNDATION_RUNTIME_FLAGS);g.chamberEdition='foundation';
after(()=>{g.firstLevel?.dispose();g.physics?.dispose();g.portals?.dispose();});
const V=(...a)=>new THREE.Vector3(...a);
function drawn(hit){
 for(let n=hit.object;n;n=n.parent)if(!n.visible)return false;
 const m=Array.isArray(hit.object.material)?hit.object.material[hit.face?.materialIndex??0]:hit.object.material;
 return m?.visible!==false&&!m?.transparent;
}

for(const number of [18,20,32,34,37,39])test(`room ${number}: actual wall ornament clears the finished cornice and finite machinery`,async()=>{
 const before=baseline.rows.find(r=>r.n===number);await g.selectLevel(number-1,false);g.scene.updateMatrixWorld(true);
 const l=g.firstLevel,root=l.campaignEnvironment.root,mounts=root.userData.mounts;
 assert.equal(mounts.length,2);assert.equal(l.campaignEnvironment.diagnostics.extraColliders,0);assert.equal(l.campaignEnvironment.diagnostics.extraLights,0);
 assert.equal(digest(gameplayContract(g)),before.contractSha256,'A wall drawing changed a physical, query or portal owner');
 assert.notDeepEqual(mounts,before.mounts);
 for(const mount of mounts)assert.ok(mount.center[1]+mount.halfHeight<=l.workshop.roomEnvelope.roof-2.95-.12+1e-8,'Reserved field crosses the actual cornice bottom');
 let exposed=0,oldOccluded=0;
 for(const mesh of root.children.filter(m=>m.isInstancedMesh&&m.geometry.type==='BoxGeometry')){
  mesh.geometry.computeBoundingBox();
  for(let i=0;i<mesh.count;i++){
   const local=new THREE.Matrix4();mesh.getMatrixAt(i,local);
   const world=local.clone().premultiply(mesh.matrixWorld),target=V(0,0,mesh.geometry.boundingBox.max.z).applyMatrix4(world);
   const mount=mounts.reduce((a,b)=>target.distanceTo(V(...a.center))<target.distanceTo(V(...b.center))?a:b);
   if(target.y<mount.center[1]+.7)continue;
   const normal=V(...mount.normal),first=p=>new THREE.Raycaster(p.clone().addScaledVector(normal,2),normal.clone().negate(),0,3).intersectObjects(g.scene.children,true).find(drawn);
   const hit=first(target);assert.equal(hit?.object,mesh);assert.equal(hit.instanceId,i);exposed++;
   // Put this one drawing back at its exact recorded old wall field; the
   // cornice and finite manufactured structure stay unchanged.
   const old=before.mounts.find(m=>V(...m.normal).distanceTo(normal)<1e-8),delta=V(...old.center).sub(V(...mount.center));
   const restored=local.clone();restored.elements[12]+=delta.x;restored.elements[13]+=delta.y;restored.elements[14]+=delta.z;
   mesh.setMatrixAt(i,restored);mesh.instanceMatrix.needsUpdate=true;
   const oldHit=first(target.clone().add(delta));
   if(oldHit?.object!==mesh||oldHit?.instanceId!==i){assert.match(oldHit?.object.material?.name??'',/structural shell|anodised load frame|integral flange/);oldOccluded++;}
   mesh.setMatrixAt(i,local);mesh.instanceMatrix.needsUpdate=true;
  }
 }
 assert.ok(exposed>=2);assert.ok(oldOccluded>=2,'Recorded former placement must reproduce actual opaque occlusion');
 assert.equal(digest(gameplayContract(g)),before.contractSha256);
});
