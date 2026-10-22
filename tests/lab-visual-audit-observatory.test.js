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

test('return sluice partition junctions have one visible face while physical frame returns retain their original width',async()=>{
 const g=await room(35);
 try{
  const surfaces=g.firstLevel.world.surfaces.filter(s=>s.name==='Sealed partition'&&Math.abs(s.width-4.8)<.001);
  assert.equal(surfaces.length,4,'both sides of both actual sluice headers must be covered');
  const drawing=[];g.scene.updateMatrixWorld(true);
  g.scene.traverse(m=>{if(m.isMesh&&m.visible&&m.material?.visible!==false)drawing.push(m);});
  for(const surface of surfaces){
   const returns=surface.frameColliders.filter(c=>c.local.getSize(new THREE.Vector3()).x>4);
   assert.equal(returns.length,2);
   for(const physical of returns){
    assert.ok(Math.abs(physical.local.getSize(new THREE.Vector3()).x-4.8)<1e-9,'visual joint must not shorten its original physical/query return');
    const actual=new THREE.Box3().setFromObject(physical.mesh);
    assert.ok(actual.min.distanceTo(physical.box.min)<1e-7&&actual.max.distanceTo(physical.box.max)<1e-7);
    const y=physical.box.getCenter(new THREE.Vector3()).y,z=surface.group.position.z,sign=surface.normal.z;
    for(const x of [-2.1,2.1]){
     // These are the actual neighbouring jambs where a dark horizontal
     // return previously shared exactly the same white exterior triangles.
     const ray=new THREE.Raycaster(new THREE.Vector3(x,y,z+sign*2),new THREE.Vector3(0,0,-sign));
     const hits=ray.intersectObjects(drawing,false);assert.ok(hits.length);
     const nearest=hits.filter(h=>Math.abs(h.distance-hits[0].distance)<1e-7);
     assert.equal(new Set(nearest.map(h=>h.object)).size,1,'two painted members own the same visible junction plane');
    }
   }
  }
 }finally{close(g);}
});

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
