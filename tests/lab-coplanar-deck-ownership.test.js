import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {ACTIVE_FOUNDATION_RUNTIME_FLAGS} from '../src/game/ReleaseIdentity.js';

test('the ordinary countercurrent court has one visible top owner without removing either physical support',async()=>{
 const g=await createHeadlessGame();g.chamberEdition='foundation';Object.assign(g,ACTIVE_FOUNDATION_RUNTIME_FLAGS);
 try{
  await g.selectLevel(44,true);const k=g.firstLevel.workshop;
  assert.ok(k.manufacturedFinish.coplanarFields>=1);
  const service=k.decks.find(d=>d.name==='Continuous service and recovery floor');
  const court=k.decks.find(d=>d.name==='Countercurrent source court');
  assert.equal(service.y,court.y);
  for(const support of [service,court]){
   const collider=g.colliders.find(c=>c.mesh===support.mesh);assert.ok(collider&&collider.enabled!==false);
   assert.ok(Math.abs(collider.box.max.y-support.y)<1e-6);
  }
  const a=new THREE.Vector3(),b=a.clone(),c=a.clone(),n=a.clone(),center=a.clone();let outside=0;
  g.firstLevel.world.root.updateWorldMatrix(true,true);
  g.firstLevel.world.root.traverse(mesh=>{
   if(!mesh.isMesh||mesh.material?.name!=='Foundation service floor')return;
   const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry,p=geometry.attributes.position;
   for(let i=0;i<p.count;i+=3){
    a.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);b.fromBufferAttribute(p,i+1).applyMatrix4(mesh.matrixWorld);c.fromBufferAttribute(p,i+2).applyMatrix4(mesh.matrixWorld);
    n.crossVectors(b.clone().sub(a),c.clone().sub(a)).normalize();
    if(n.y<.999||[a,b,c].some(v=>Math.abs(v.y-service.y)>.0001))continue;
    center.copy(a).add(b).add(c).divideScalar(3);
    assert.ok(!(center.x>court.minX+.04&&center.x<court.maxX-.04&&center.z>court.minZ+.04&&center.z<court.maxZ-.04),'A second painted service-floor triangle overlaps the authored court');
    outside++;
   }
   if(geometry!==mesh.geometry)geometry.dispose();
  });
  assert.ok(outside>0,'The surrounding recovery floor must remain visibly present');
 }finally{g.firstLevel?.dispose?.();g.physics?.dispose();g.portals?.dispose();}
});
