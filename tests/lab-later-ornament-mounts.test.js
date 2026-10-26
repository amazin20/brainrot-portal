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
const repairedCenters={18:[[-4.5,8.81,-24.23],[-26.23,8.81,0]],20:[[-4.666666666666664,8.81,-27.23],[-27.23,8.81,5.833333333333336]],
 32:[[-13,8.81,-24.23],[-25.23,8.81,10]],34:[[-13.5,10.81,-25.23],[-26.23,10.81,4.333333333333336]],37:[[-14,10.81,-26.23],[-27.23,10.81,2.75]]};
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
 if(repairedCenters[number])assert.deepEqual(mounts.map(m=>m.center),repairedCenters[number],'The complete room-39 field check must not move another repaired room');
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
   mesh.setMatrixAt(i,restored);mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();
   const oldHit=first(target.clone().add(delta));
   if(oldHit?.object!==mesh||oldHit?.instanceId!==i){
    assert.ok(oldHit?.distance<2-1e-5,'The blocker must be in front of the recorded old face, not a wall behind a missed instance');
    assert.match(oldHit?.object.material?.name??'',/structural shell|anodised load frame|integral flange/);oldOccluded++;
   }
   mesh.setMatrixAt(i,local);mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();
  }
 }
 assert.ok(exposed>=2);assert.ok(oldOccluded>=2,'Recorded former placement must reproduce actual opaque occlusion');
 assert.equal(digest(gameplayContract(g)),before.contractSha256);
});

test('room 39: every painted front triangle clears the narrow service bay that escaped the former nine rays',async()=>{
 await g.selectLevel(38,false);g.scene.updateMatrixWorld(true);
 const l=g.firstLevel,root=l.campaignEnvironment.root,mounts=root.userData.mounts,meshes=root.children.filter(m=>m.name.startsWith('Chapter ornament /'));
 const ray=new THREE.Raycaster(),a=V(),b=V(),c=V(),edge=V(),cross=V(),point=V();let checked=0;
 const hitsAt=(target,normal)=>{
  ray.set(target.clone().addScaledVector(normal,2),normal.clone().negate());ray.near=0;ray.far=3;
  return ray.intersectObjects(g.scene.children,true).filter(drawn);
 };
 // Include both rings and every tick, including their lower portions. Four
 // interior samples cover every actual front-facing triangle; neither a
 // bounding rectangle nor the centre of a top tick stands in for the art.
 for(const mesh of meshes)for(let instance=0;instance<mesh.count;instance++){
  const matrix=new THREE.Matrix4();mesh.getMatrixAt(instance,matrix);matrix.premultiply(mesh.matrixWorld);
  const center=V().setFromMatrixPosition(matrix),mount=mounts.reduce((x,y)=>center.distanceTo(V(...x.center))<center.distanceTo(V(...y.center))?x:y),normal=V(...mount.normal);
  const geometry=mesh.geometry,positions=geometry.attributes.position,index=geometry.index,count=index?.count??positions.count;
  for(let i=0;i<count;i+=3){
   for(const [vertex,offset]of [[a,0],[b,1],[c,2]])vertex.fromBufferAttribute(positions,index?index.getX(i+offset):i+offset).applyMatrix4(matrix);
   cross.subVectors(b,a).cross(edge.subVectors(c,a));if(cross.dot(normal)<1e-8)continue;
   for(const weights of [[1/3,1/3,1/3],[.8,.1,.1],[.1,.8,.1],[.1,.1,.8]]){
    point.copy(a).multiplyScalar(weights[0]).addScaledVector(b,weights[1]).addScaledVector(c,weights[2]);
    const hits=hitsAt(point,normal),art=hits.find(h=>h.object===mesh&&h.instanceId===instance);
    assert.ok(art,'A sample must land on its actual painted triangle');
    assert.equal(hits[0]?.object.parent,root,`${mesh.name} / ${instance} is hidden by ${hits[0]?.object.name}`);checked++;
   }
  }
 }
 assert.ok(checked>=3000,'All front triangles of both complete instruments must be checked');
 // Restore the western outer ring to the previous attempted field. The
 // actual bay must be closer than the real ring, proving genuine occlusion
 // rather than a ray that simply missed an out-of-date instance bound.
 const ring=root.getObjectByName('Chapter ornament / ring / frame'),west=mounts.find(m=>m.normal[0]>.99),oldCenter=V(-27.23,10.81,4.5);
 const matrix=new THREE.Matrix4();let restored=-1;
 for(let i=0;i<ring.count;i++){ring.getMatrixAt(i,matrix);if(V().setFromMatrixPosition(matrix).distanceTo(V(...west.center))<.2){restored=i;break;}}
 assert.ok(restored>=0);const saved=matrix.clone(),delta=oldCenter.clone().sub(V(...west.center));matrix.elements[12]+=delta.x;matrix.elements[13]+=delta.y;matrix.elements[14]+=delta.z;
 try{
  ring.setMatrixAt(restored,matrix);ring.computeBoundingBox();ring.computeBoundingSphere();
  const hits=hitsAt(V(-27.23,9.326,4.288),V(1,0,0)),art=hits.find(h=>h.object===ring&&h.instanceId===restored);
  assert.ok(art);assert.match(hits[0]?.object.material?.name??'',/recessed structural service bays/);
  assert.ok(hits[0].distance<art.distance-.1,'The real service bay must be in front of the restored ring');
 }finally{ring.setMatrixAt(restored,saved);ring.computeBoundingBox();ring.computeBoundingSphere();}
 assert.equal(digest(gameplayContract(g)),baseline.rows.find(r=>r.n===39).contractSha256);
});
