import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {observatoryWallProfile} from '../src/game/LabObservatoryWallProfiles.js';
import {closedObservatoryCasingGeometry,observatoryMachinePalette} from '../src/game/LabObservatoryRoomFinishes.js';

const V=(...p)=>new THREE.Vector3(...p),hash=a=>createHash('sha256').update(Buffer.from(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
test('Ten wall families use distinct continuous geometry contained in the old 80 mm panel',()=>{
 const hashes=new Set(),names=new Set();
 for(let stable=31;stable<=40;stable++){
  const profile=observatoryWallProfile(stable),g=profile.geometry,p=g.attributes.position;
  names.add(profile.name);hashes.add(hash(p.array));assert.ok(p.count/3<1600);
  for(let i=0;i<p.count;i++){
   assert.ok(Math.abs(p.getX(i))<.499&&Math.abs(p.getY(i))<.499);
   assert.ok(p.getZ(i)>=-.039&&p.getZ(i)<=.037);
  }
  assert.equal(g.attributes.color.count,p.count);assert.equal(profile.rimAreaRatio,.1172);
  let rimArea=0,fieldArea=0;const edges=new Map(),key=i=>[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e6)).join(',');
  for(let i=0;i<p.count;i+=3){
   const a=V().fromBufferAttribute(p,i),b=V().fromBufferAttribute(p,i+1),c=V().fromBufferAttribute(p,i+2),area=b.clone().sub(a).cross(c.clone().sub(a)).length()/2;
   assert.ok(area>1e-12,'No degenerate profile triangle');
   if([a,b,c].every(v=>Math.abs(v.z-.036)<1e-7))rimArea+=area;
   if([a,b,c].every(v=>Math.abs(v.z-.001)<1e-7))fieldArea+=area;
   for(const[x,y]of[[i,i+1],[i+1,i+2],[i+2,i]]){const k=[key(x),key(y)].sort().join('|');edges.set(k,(edges.get(k)??0)+1);}
  }
  assert.ok(rimArea>0&&fieldArea>0);assert.ok(Math.abs(rimArea/(rimArea+fieldArea)-.1172)<1e-6,'Rim area measured from actual cap triangles');
  assert.ok([...edges.values()].every(n=>n===2),'Every closed-part triangle edge has two owners');
  assert.ok(profile.regions.length>=1&&profile.regions.every(points=>points.length>=4));
  const material=new THREE.MeshStandardMaterial({vertexColors:true}),mesh=new THREE.Mesh(g,material);mesh.updateMatrixWorld();
  // Ordinary opaque front AND rear intersections, without DoubleSide or a
  // shader depth exemption. The back closes the complete old footprint.
  const target=profile.regions[0].reduce((sum,p)=>sum.add(V(p[0],p[1],0)),V()).multiplyScalar(1/profile.regions[0].length);
  const ray=new THREE.Raycaster(target.clone().add(V(0,0,1)),V(0,0,-1));assert.ok(ray.intersectObject(mesh).length>0);
  ray.set(target.clone().add(V(0,0,-1)),V(0,0,1));assert.ok(ray.intersectObject(mesh).length>0);
  g.dispose();material.dispose();
 }
 assert.equal(hashes.size,10);assert.equal(names.size,10);
});

test('Formed machine casings retain one millimetre source clearance and real front/rear faces',()=>{
 const sizes=[[16.6,1.4,.75],[.95,14,1.75],[2.7,2.6,2.3],[1,.9,.9],[4,2.6,4],[1,23.4,1.4],[21.8,1,1.8]];
 for(const stable of[31,32,33,34,36,37,38,39,40])for(const size of sizes)for(const axis of['x','z']){
  const g=closedObservatoryCasingGeometry(stable,size,{axis}),p=g.attributes.position;
  assert.ok(p.count/3<700);assert.equal(g.attributes.color.count,p.count);
  for(let i=0;i<p.count;i++)for(let a=0;a<3;a++)assert.ok(Math.abs(p.array[i*3+a])<=size[a]/2-.0009995);
  const material=new THREE.MeshStandardMaterial({vertexColors:true}),mesh=new THREE.Mesh(g,material);mesh.updateMatrixWorld();
  const normal=axis==='x'?V(1,0,0):V(0,0,1),reach=Math.max(...size)+1,depth=size[axis==='x'?0:2]-.002,ray=new THREE.Raycaster(normal.clone().multiplyScalar(reach),normal.clone().negate());
  const front=ray.intersectObject(mesh);assert.ok(front.length>0&&front[0].point.dot(normal)>depth*.25,'Front field is distinct from the inner core');
  ray.set(normal.clone().multiplyScalar(-reach),normal);const rear=ray.intersectObject(mesh);assert.ok(rear.length>0&&rear[0].point.dot(normal)<-depth*.25,'Rear field is distinct from the inner core');
  g.dispose();material.dispose();
 }
});

test('Machine palette identities are separate while the existing sluice enamel remains fixed',()=>{
 const paints=new Set();for(let stable=31;stable<=40;stable++)paints.add(observatoryMachinePalette(stable).paint);
 assert.equal(paints.size,10);assert.equal(observatoryMachinePalette(35).paint,0x527c83);
 assert.throws(()=>observatoryWallProfile(30));assert.throws(()=>closedObservatoryCasingGeometry(33,[1,0,1]));
});
