import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';

async function room(n){const g=await createHeadlessGame();g.chamberEdition='foundation';await g.selectLevel(n-1,false);return g;}
function close(g){g.firstLevel.dispose?.();g.physics?.dispose();g.portals?.dispose();}
function intersectsSegment(box,start,end){
 const delta=end.clone().sub(start),length=delta.length(),hit=new THREE.Ray(start,delta.normalize()).intersectBox(box,new THREE.Vector3());
 return hit&&hit.distanceTo(start)<length-.001;
}

for(const n of [39,40])test(`observatory ${n}: new physical housings preserve the actual optical working axis`,async()=>{
 const g=await room(n);
 try{
  const l=g.firstLevel,parts=g.colliders.filter(c=>c.visualAuditObservatory);
  assert.ok(parts.length>0,'new large machinery requires its own physical volumes');
  const [from,to]=n===39?[new THREE.Vector3(15.96,3.2,17),new THREE.Vector3(-11.99,3.2,17)]:
   [new THREE.Vector3(0,3,12.9),new THREE.Vector3(0,3,-11)];
  for(const c of parts){assert.ok(!c.box.isEmpty());assert.ok(!intersectsSegment(c.box,from,to),`${c.mesh.name} blocks the original optical axis`);}
  assert.equal(l.workshop.visualAuditObservatory.stableLevel,n);
 }finally{close(g);}
});

test('hoist guide shoes follow the actual freight carrier with tight moving physical boxes',async()=>{
 const g=await room(38);
 try{
  const l=g.firstLevel,k=l.workshop,carrier=l.freight,boxes=g.colliders.filter(c=>c.visualAuditObservatory&&c.kinematic);
  assert.equal(boxes.length,2);
  for(const height of [0,7.5,15]){
   carrier.group.position.y=height;
   // The last observer callback reads the carrier, rather than driving it.
   k.ticks.at(-1)(0);
   const members=[];l.world.root.traverse(m=>{if(m.isMesh&&m.name==='Observatory / hoist travelling guide shoe')members.push(m);});
   assert.equal(members.length,2);
   for(const m of members){
    const bounds=new THREE.Box3().setFromObject(m),c=boxes.find(c=>c.box.min.distanceTo(bounds.min)<1e-5);
    assert.ok(c&&c.box.max.distanceTo(bounds.max)<1e-5,'moving guide has an oversized or stale physical volume');
    assert.ok(Math.abs(bounds.getCenter(new THREE.Vector3()).y-(height-.72))<1e-5);
   }
  }
 }finally{close(g);}
});
