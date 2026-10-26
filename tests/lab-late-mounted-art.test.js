import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {gameplayContract,digest} from './helpers/lab-art-contract.js';

// Captured from immutable 901ff9d, before this presentation change. Every
// physical/query row and portal frame remains covered, without normalization.
const original={45:'241272bee72746712c1e901d7a38f89626b46443e7c866a6e40b7dd96681fff5',47:'b8c4b52cedcdf1c07def32196720823d3b83999c703ae24f1218cde44d75d836',48:'594aa9736ef0fb8d699d196508d6fd3b278d4e67c3b4758c4568a7186e5f0a17',49:'61c0f24ac0a5b0ada0e714e539d1e0ad77fbacbec6b874fc7d56d5f23085dfc6',51:'aa5a940580f3a720be397d67b5959f6861fe9154d331ff3e88e584cad59b2c42'};
const V=(...a)=>new THREE.Vector3(...a);
let shared;
async function room(n){shared??=await createHeadlessGame();shared.chamberEdition='foundation';shared.puzzleProgression=true;await shared.selectLevel(n-1,false);shared.firstLevel.renderUpdate(0);return shared;}

test('late fixture mounts and the continuous spring preserve all five original room contracts',async()=>{
 for(const n of [45,47,48,49,51]){const g=await room(n);assert.equal(digest(gameplayContract(g)),original[n],`room${n}`);}
});

test('each new luminaire suspension intersects the finite roof and actual closed housing at both ends',async()=>{
 for(const [n,count]of [[45,3],[47,3],[49,3],[51,4]]){
  const g=await room(n),mounts=g.firstLevel.workshop.lateRoofSuspensions;
  assert.equal(mounts.length,count);
  for(const mount of mounts){
   assert.equal(mount.mesh.visible,true);assert.equal(mount.mesh.parent,g.firstLevel.world.root);
   assert.equal(g.colliders.some(c=>c.mesh===mount.mesh),false);assert.equal(g.cameraBlockers.includes(mount.mesh),false);assert.equal(g.aimBlockers.includes(mount.mesh),false);
   // Source meshes may have been merged for drawing, but these are their
   // original finite triangles and retained world matrices, not AABBs alone.
   for(const end of mount.ends){
    for(const [target,box,direction,y]of [[mount.roof,end.top,V(0,1,0),mount.roofBounds.min.y-.20],[mount.housing,end.bottom,V(0,-1,0),mount.housingBounds.max.y+.20]]){
     for(const x of [box.min.x+.005,box.max.x-.005])for(const z of [box.min.z+.005,box.max.z-.005]){
      const hits=new THREE.Raycaster(V(x,y,z),direction,0,.3).intersectObject(target,false);
      assert.ok(hits.length,`room${n} suspension end misses the actual ${target.name}`);
      assert.ok(box.containsPoint(hits[0].point),'the foot must overlap the real finite face');
     }
    }
   }
   const p=mount.mesh.geometry.attributes.position;assert.ok([...p.array].every(Number.isFinite));
   assert.ok(mount.mesh.geometry.boundingBox.min.y<mount.housingBounds.max.y);
   assert.ok(mount.mesh.geometry.boundingBox.max.y>mount.roofBounds.min.y);
  }
 }
});

test('the single rail spring is closed, mounted, clear of the buffer and cargo, and keeps its wire gauge through the actual guided stroke',async()=>{
 const g=await room(48),l=g.firstLevel,m=l.machine,s=l.workshop.lateRailSpring;
 const originalBody=g.physics.cargoBody,originalShape=originalBody.shapes[0],bodies=[...g.physics.world.bodies];
 assert.equal(s.originalMovingParent,m.carGroup);assert.equal(s.turns,18);
 const oldRings=[];l.world.root.traverse(o=>{if(o.name==='48 / actual spring extension winding')oldRings.push(o);});assert.equal(oldRings.length,0);
 const buffer=m.bodies.find(b=>b.name==='left spring travel buffer');assert.ok(buffer);
 const bufferBox=new THREE.Box3(V(buffer.position.x-.25,buffer.position.y-.7,buffer.position.z-.2),V(buffer.position.x+.25,buffer.position.y+.7,buffer.position.z+.2));
 const cargoCorridor=new THREE.Box3(V(-10,4.21,-14.99),V(20,4.99,-14.21));
 const wall=g.colliders.find(c=>Math.abs(c.box.min.x+10.4)<.001&&Math.abs(c.box.max.x+10)<.001&&c.box.min.z<-16.5);assert.ok(wall,'actual closed left channel endwall');
 // Explicit geometry fixtures; the existing ordinary route test exercises
 // actual contacts separately. No fixture is claimed as a human playthrough.
 for(const x of [-.15,0,4.4,12]){
  m.body.position.x=x;m.sync(0);const pose=m.body.position.clone(),velocity=m.body.velocity.clone(),force=m.body.force.clone();s.sync();
  assert.equal(s.mesh.visible,true);assert.ok(Math.abs(s.end.x-s.anchor.x-s.restLength-x)<1e-10);
  assert.deepEqual(m.body.linearFactor.toArray(),[1,0,0]);
  const forces=m.bodies.map(b=>[b,b.force.clone()]);m.body.force.setZero();m.body.velocity.setZero();m.preStep();
  assert.ok(Math.abs(m.body.force.x+s.stiffness*(s.end.x-s.anchor.x-s.restLength))<1e-10,'the drawn extension must describe the actual production spring force');
  for(const [body,saved]of forces)body.force.copy(saved);m.body.velocity.copy(velocity);
  assert.ok(wall.box.containsPoint(s.anchor));
  const shoe=m.carProxies[0].box;assert.ok(shoe.containsPoint(s.end),'moving end belongs to the finite physical carriage cheek');
  const geometry=s.mesh.geometry,p=geometry.attributes.position,normal=geometry.attributes.normal,index=geometry.index;
  assert.ok([...p.array,...normal.array].every(Number.isFinite));
  for(let j=0;j<7;j++){
   assert.ok(wall.box.containsPoint(V().fromBufferAttribute(p,j)),'the complete fixed cap belongs to the real endwall');
   assert.ok(shoe.containsPoint(V().fromBufferAttribute(p,216*7+j)),'the complete moving cap belongs to the real carriage cheek');
  }
  assert.deepEqual(m.body.position,pose);assert.deepEqual(m.body.velocity,velocity);assert.deepEqual(m.body.force,force);
  const a=V(),b=V(),c=V(),triangle=new THREE.Triangle(a,b,c),edges=new Map();
  const key=i=>[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e5)).join(',');
  for(let i=0;i<index.count;i+=3){
   const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];a.fromBufferAttribute(p,ids[0]);b.fromBufferAttribute(p,ids[1]);c.fromBufferAttribute(p,ids[2]);
   const face=triangle.getNormal(V()),outward=ids.reduce((sum,id)=>sum.add(V().fromBufferAttribute(normal,id)),V()).normalize();
   assert.ok(face.dot(outward)>0,'the closed spring must expose its outside faces to a FrontSide material');
   assert.equal(bufferBox.intersectsTriangle(triangle),false,'spring crosses the actual travel buffer');
   assert.equal(cargoCorridor.intersectsTriangle(triangle),false,'spring enters the original cargo corridor');
   for(let j=0;j<3;j++){const pair=[key(ids[j]),key(ids[(j+1)%3])].sort().join('|');edges.set(pair,(edges.get(pair)??0)+1);}
  }
  assert.ok([...edges.values()].every(n=>n===2),'the welded helix and its embedded caps form one closed surface');
  for(let ring=0;ring<=216;ring+=9){const first=ring*7,center=V().fromBufferAttribute(p,first).add(V().fromBufferAttribute(p,first+3)).multiplyScalar(.5);for(let j=0;j<6;j++)assert.ok(Math.abs(V().fromBufferAttribute(p,first+j).distanceTo(center)-s.wireRadius)<2e-6,'wire thickness must not stretch with the carriage');}
 }
 assert.equal(g.physics.cargoBody,originalBody);assert.equal(originalBody.shapes[0],originalShape);assert.deepEqual(g.physics.world.bodies,bodies);
 l.reset();l.renderUpdate(0);assert.ok(Math.abs(s.end.x+1.4)<1e-10,'reset follows the same real carriage home pose');
});
