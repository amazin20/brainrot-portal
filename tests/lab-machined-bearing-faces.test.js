import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';

const game=await createHeadlessGame();game.chamberEdition='foundation';game.room23PhysicalPrototype=true;
after(()=>{game.firstLevel?.dispose?.();game.physics?.dispose();game.portals?.dispose();});
const V=(...p)=>new THREE.Vector3(...p);
function assertClosedCasting(geometry){
 const vertices=geometry.attributes.position,index=geometry.index,edges=new Map();
 const vertex=n=>V().fromBufferAttribute(vertices,index?index.getX(n):n).toArray().map(v=>Math.round(v*1e6)).join(',');
 for(let n=0;n<(index?.count??vertices.count);n+=3){
  const triangle=[vertex(n),vertex(n+1),vertex(n+2)];if(new Set(triangle).size<3)continue;
  for(let e=0;e<3;e++){const key=[triangle[e],triangle[(e+1)%3]].sort().join('/');edges.set(key,(edges.get(key)||0)+1);}
 }
 assert.ok(edges.size>0&&[...edges.values()].every(n=>n===2),'Recessed casting must remain a closed volume');
}
const oldProfiles={
 23:[[0,-.5],[.62,-.5],[.74,-.24],[.90,-.24],[.94,-.5],[1,-.5],[1,.5],[.94,.5],[.90,.24],[.74,.24],[.62,.5],[0,.5]],
 35:[[0,-.5],[.88,-.5],[.88,-.44],[1,-.44],[1,-.28],[.87,-.28],[.87,.28],[1,.28],[1,.44],[.88,.44],[.88,.5],[0,.5]],
};

// Sample the actual rendered instance triangles from just outside each
// bearing face. A ray through the bolt centre alone could miss an overlap
// at its corners; four further points check a finite exposed head surface.
function fastenerSightlines(art,owner){
 const result=[];
 for(const part of owner.parts.filter(p=>p.mesh.geometry.type==='CylinderGeometry')){
  const centre=V().setFromMatrixPosition(part.matrix),scale=V().setFromMatrixScale(part.matrix),sign=Math.sign(centre.y);
  const direction=V(0,-sign,0).transformDirection(owner.target.matrixWorld);
  const offset=owner.height?owner.height*.15:.025;
  for(const [x,z]of [[0,0],[.3,0],[-.3,0],[0,.3],[0,-.3]]){
   const origin=centre.clone().add(V(x*scale.x,sign*offset,z*scale.z)).applyMatrix4(owner.target.matrixWorld);
   const first=new THREE.Raycaster(origin,direction,0,offset*2).intersectObjects(art.children,false)[0];
   result.push({part,first,exposed:first?.object===part.mesh&&first.instanceId===part.index});
  }
 }
 return result;
}

for(const room of [23,35])test(`room ${room}: closed recessed bearing faces expose their existing finite captive heads`,async()=>{
 await game.selectLevel(room-1,true);
 const art=game.firstLevel.biosphereArt??game.firstLevel.opticsArt;
 art.updateWorldMatrix(true,true);
 const owners=art.mounts.filter(o=>o.cylindrical);assert.equal(owners.length,2);
 for(const owner of owners){
  const rays=fastenerSightlines(art,owner);
  assert.equal(rays.length,60);
  assert.ok(rays.every(r=>r.exposed),`${owner.name}: a casting still hides a head`);
  const casting=owner.parts.find(p=>p.mesh.geometry.type==='LatheGeometry');
  assertClosedCasting(casting.mesh.geometry);
  // Reintroducing the previous drawing alone must reproduce the defect;
  // no actor, mechanism pose or physics owner is changed in this comparison.
  const mesh=casting.mesh,geometry=mesh.geometry;
  const old=new THREE.LatheGeometry(oldProfiles[room].map(p=>new THREE.Vector2(...p)),32);
  try{mesh.geometry=old;assert.ok(fastenerSightlines(art,owner).every(r=>!r.exposed),'The old caps no longer reproduce the hidden-head defect');}
  finally{mesh.geometry=geometry;old.dispose();}
  // Each head retains positive embedding in its own closed face, while its
  // outer cap stays strictly behind the original physical cylinder end.
  const scale=V().setFromMatrixScale(casting.matrix),end=scale.y*.5;
  const face=scale.y*(room===23?.42:.44);
  for(const part of owner.parts.filter(p=>p.mesh.geometry.type==='CylinderGeometry')){
   const centre=V().setFromMatrixPosition(part.matrix),s=V().setFromMatrixScale(part.matrix);
   assert.ok(Math.abs(centre.y)-s.y*.5<face,'A captive head floats above its mounting face');
   assert.ok(Math.abs(centre.y)+s.y*.5>face,'A captive head is fully buried');
   assert.ok(Math.abs(centre.y)+s.y*.5<end,'A head crosses the existing contact envelope');
  }
 }
});

const previousVesselProfile=[[0,-.5],[.87,-.5],[.94,-.46],[1,-.40],[1,-.31],[.84,-.27],[.84,.27],[1,.31],[1,.40],[.94,.46],[.87,.5],[0,.5]];
for(const [room,count]of [[34,4]])test(`room ${room}: pressure casings have visible embedded ribs and closed recessed bearing covers`,async()=>{
 await game.selectLevel(room-1,true);
 const owners=game.firstLevel.visualAuditMiddle.root.mounts.filter(o=>o.cylindrical);assert.equal(owners.length,count);
 for(const owner of owners){
  // A source-local triangle fixture isolates this casting from neighbouring
  // pipes. It retains every real part geometry and matrix; it is not a claim
  // that every side can be seen simultaneously from the gameplay camera.
  const group=new THREE.Group(),parts=new Map();
  for(const part of owner.parts){const mesh=new THREE.Mesh(part.mesh.geometry,part.mesh.material);mesh.matrixAutoUpdate=false;mesh.matrix.copy(part.matrix);group.add(mesh);parts.set(part,mesh);}
  group.updateMatrixWorld(true);
  const casting=owner.parts.find(p=>p.mesh.geometry.type==='LatheGeometry'),scale=V().setFromMatrixScale(casting.matrix),r=scale.x,h=scale.y;
  assertClosedCasting(casting.mesh.geometry);
  const ribs=owner.parts.filter(p=>p.color===0xd0a26d),covers=owner.parts.filter(p=>p.color===0x243d48);
  assert.equal(ribs.length,6);assert.equal(covers.length,2);
  const ribVisible=(part,at)=>{
   const normal=V().setFromMatrixPosition(parts.get(part).matrix).setY(0).normalize();
   const origin=normal.clone().multiplyScalar(r*1.2).setY(at*h);
   return new THREE.Raycaster(origin,normal.negate(),0,r*.5).intersectObject(group,true)[0]?.object===parts.get(part);
  };
  const coverVisible=part=>{
   const sign=Math.sign(parts.get(part).matrix.elements[13]);
   return new THREE.Raycaster(V(0,sign*h*.65,0),V(0,-sign,0),0,h*.4).intersectObject(group,true)[0]?.object===parts.get(part);
  };
  for(const part of ribs){
   assert.ok([-.2,0,.2].every(at=>ribVisible(part,at)),`${owner.name}: an axial rib is hidden by its own casing`);
   const mesh=parts.get(part),before=mesh.matrix.clone();
   mesh.matrix.elements[12]*=.79/.86;mesh.matrix.elements[14]*=.79/.86;group.updateMatrixWorld(true);
   assert.ok([-.2,0,.2].every(at=>!ribVisible(part,at)),'Old rib location must reproduce complete burial');
   mesh.matrix.copy(before);group.updateMatrixWorld(true);
   const centre=V().setFromMatrixPosition(part.matrix),half=V().setFromMatrixScale(part.matrix).x/2;
   assert.ok(Math.hypot(centre.x,centre.z)-half<r*.84,'Rib needs positive attachment to the barrel');
  }
  assert.ok(covers.every(coverVisible),`${owner.name}: a flat cap still hides a bearing cover`);
  const mesh=parts.get(casting),original=mesh.geometry,old=new THREE.LatheGeometry(previousVesselProfile.map(p=>new THREE.Vector2(...p)),32);
  try{mesh.geometry=old;assert.ok(covers.every(p=>!coverVisible(p)),'Old caps must reproduce hidden covers');}
  finally{mesh.geometry=original;old.dispose();}
  // Check real vertices rather than only an AABB around the cylinder.
  for(const part of owner.parts){const p=V(),vertices=part.mesh.geometry.attributes.position;
   for(let n=0;n<vertices.count;n++){p.fromBufferAttribute(vertices,n).applyMatrix4(part.matrix);
    assert.ok(Math.hypot(p.x,p.z)<=owner.target.geometry.parameters.radiusTop+1e-6);
    assert.ok(Math.abs(p.y)<=owner.target.geometry.parameters.height/2+1e-6);
   }
  }
 }
});

test('room33 retains the original inner casings beneath its authored physical telescopic sleeves and conduits',async()=>{
 await game.selectLevel(32,true);
 const owners=game.firstLevel.visualAuditMiddle.root.mounts.filter(o=>o.cylindrical);assert.equal(owners.length,7);
 const original=new THREE.LatheGeometry(previousVesselProfile.map(p=>new THREE.Vector2(...p)),32);
 try{for(const owner of owners){
  const casting=owner.parts.find(p=>p.mesh.geometry.type==='LatheGeometry'),scale=V().setFromMatrixScale(casting.matrix);
  for(const key of ['position','normal','uv'])assert.deepEqual(casting.mesh.geometry.attributes[key].array,original.attributes[key].array);
  assert.deepEqual(casting.mesh.geometry.index.array,original.index.array);
  for(const rib of owner.parts.filter(p=>p.color===0xd0a26d)){
   const centre=V().setFromMatrixPosition(rib.matrix);assert.ok(Math.abs(Math.hypot(centre.x,centre.z)-scale.x*.79)<1e-12);
  }
 }}finally{original.dispose();}
});

test('biosphere gate, backstop and service-cover fasteners mount in their actual recessed plates without an air gap',async()=>{
 let count=0,formerlyUnsupported=0;
 for(const room of [21,22,23,26,29]){
  await game.selectLevel(room-1,true);const art=game.firstLevel.biosphereArt;
  for(const owner of art.mounts.filter(o=>!o.cylindrical)){
   const bolts=owner.parts.filter(p=>p.mesh.geometry.type==='CylinderGeometry');if(!bolts.length)continue;
   const group=new THREE.Group();
   for(const part of owner.parts.filter(p=>p.mesh.geometry.type!=='CylinderGeometry')){
    const mesh=new THREE.Mesh(part.mesh.geometry,part.mesh.material);mesh.matrixAutoUpdate=false;mesh.matrix.copy(part.matrix);group.add(mesh);
   }
   group.updateMatrixWorld(true);
   const centre=owner.bounds.getCenter(V()),size=owner.bounds.getSize(V());
   for(const bolt of bolts){
    count++;
    const at=V().setFromMatrixPosition(bolt.matrix),scale=V().setFromMatrixScale(bolt.matrix),normal=V(0,1,0).transformDirection(bolt.matrix);
    const sign=Math.sign(at.clone().sub(centre).dot(normal));normal.multiplyScalar(sign);
    const depth=Math.abs(size.dot(normal)),right=V(1,0,0).transformDirection(bolt.matrix),up=V(0,0,1).transformDirection(bolt.matrix);
    let oldGap=false;
    for(const [x,z]of [[0,0],[.3,0],[-.3,0],[0,.3],[0,-.3]]){
     const sample=at.clone().addScaledVector(right,x*scale.x).addScaledVector(up,z*scale.z);
     const origin=sample.clone().addScaledVector(normal,depth);
     const face=new THREE.Raycaster(origin,normal.clone().negate(),0,depth*2).intersectObject(group,true)[0];
     assert.ok(face,`${owner.name}: head has no supporting face`);
     const height=sample.clone().sub(face.point).dot(normal),half=scale.y/2;
     assert.ok(height-half<-.000001,`${owner.name}: captive fastener floats above its plate`);
     assert.ok(height+half>.000001,`${owner.name}: captive fastener is buried`);
     // Restore just the previous flange-derived height mathematically:
     // the same finite backing triangles expose its positive air gap.
     const oldFraction=/passenger car load chassis|founded upper stop underside/.test(owner.name)?.32:.456;
     const oldDelta=depth*oldFraction-at.clone().sub(centre).dot(normal);
     const previousGap=height+oldDelta-half;
     if(owner.name.includes('freight backstop'))assert.ok(previousGap<0,'Original backstop heads were already seated in their transverse brace');
     else{assert.ok(previousGap>.000001,'Previous mounting height must reproduce the unsupported head');oldGap=true;}
    }
    if(oldGap)formerlyUnsupported++;
   }
  }
 }
 assert.equal(count,84);
 assert.equal(formerlyUnsupported,68);
});
