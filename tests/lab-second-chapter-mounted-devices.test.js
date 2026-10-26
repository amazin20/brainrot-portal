import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {originalSecondChapterContract} from './helpers/lab-second-chapter-mount-contract.js';
const V=(...p)=>new THREE.Vector3(...p);let game;
before(async()=>{game=await createHeadlessGame();game.chamberEdition='foundation';});
after(()=>{game.firstLevel?.dispose();game.physics.dispose();game.portals.dispose();});
function surfaceHit(at,direction,far,accept=()=>true){
 const art=game.firstLevel.secondChapterArt,excluded=new Set(art.mounting.meshes),ray=new THREE.Raycaster(V(...at),V(...direction),0,far);
 game.scene.updateMatrixWorld(true);
 return ray.intersectObject(game.scene,true).find(hit=>{
  if(excluded.has(hit.object)||!accept(hit))return false;
  for(let p=hit.object;p;p=p.parent)if(!p.visible)return false;
  const material=Array.isArray(hit.object.material)?hit.object.material[hit.face?.materialIndex??0]:hit.object.material;
  return material?.visible!==false&&!material?.transparent;
 });
}
function actualContact(casting,at,direction,far,label,accept){
 const hit=surfaceHit(at,direction,far,accept);assert.ok(hit,`${label}: no actual opaque support triangle`);
 assert.ok(casting.meshes.some(mesh=>new THREE.Box3().setFromObject(mesh).expandByScalar(.00001).containsPoint(hit.point)),`${label}: drawing detached from actual visible support at ${hit.point.toArray()}`);return hit;
}

test('room13 receiver castings bear on finite visible rails, existing lugs and permanent entrance tiles',async()=>{
 await game.selectLevel(12,true);const {meshes,castings}=game.firstLevel.secondChapterArt.mounting;
 for(const mesh of castings){const d=mesh.metadata;
  if(d.mountRole==='receiver-arm'){
   const x=-10+d.sign*2.28;actualContact(mesh,[x,8,-9.1],[0,0,1],.6,'North guide back face');
   actualContact(mesh,[-10+d.sign*1.10,8,-8.5],[0,0,-1],.6,'North actual ring front',hit=>Math.abs(hit.object.geometry.parameters?.radius-1.05)<1e-8);
  }else if(d.mountRole==='receiver-standard'){
   const x=-10+d.sign*1.15;actualContact(mesh,[x+.12,6.3,8.78],[0,-1,0],.5,'South permanent deck');
   actualContact(mesh,[-10+d.sign*1.10,7.9,8.5],[0,0,1],.6,'South actual ring front',hit=>Math.abs(hit.object.geometry.parameters?.radius-1.05)<1e-8);
  }
 }
 // The mounts lie to the sides. A full 1.8 m approach and the actual central
 // incoming optical ray remain open; no bar spans either receiving lens.
 for(const z of [-9,9]){
  const caster=new THREE.Raycaster(V(-10,8,0),V(0,0,Math.sign(z)),0,Math.abs(z)+.4);
  assert.equal(caster.intersectObjects(meshes,true).length,0,'Mount intruded into the live optical axis');
 }
 for(const m of meshes.filter(m=>m.userData.mountRole.startsWith('receiver'))){const b=new THREE.Box3().setFromObject(m);assert.ok(b.max.x<=-10.9||b.min.x>=-9.1,'Keep the centre approach open');}
 for(const name of ['north-cage','south-cage']){const surface=game.firstLevel.world.surfaces.find(s=>s.name===name),swept=new THREE.Box3().setFromObject(surface.group.parent);swept.max.y+=6;for(const collider of game.firstLevel.secondChapterArt.mounting.colliders)assert.equal(swept.intersectsBox(collider.box),false,`${collider.mesh.name} entered ${name}'s complete swept volume`);}
 originalSecondChapterContract(game);
});

test('room14 closed brackets reach the real wall skin and the projector underside without covering its emitted sheet',async()=>{
 await game.selectLevel(13,true);const {meshes,castings}=game.firstLevel.secondChapterArt.mounting;
 for(const m of castings){const x=-10+m.metadata.sign*.82;
  actualContact(m,[x,4.56,-8.3],[0,0,-1],.6,'Projector wall bearing');
  actualContact(m,[x,4.6,-6.79],[0,1,0],.5,'Projector underside');
  const b=new THREE.Box3();m.meshes.forEach(mesh=>b.union(new THREE.Box3().setFromObject(mesh)));assert.ok(b.min.y>4.19&&b.max.y<4.95);assert.ok(b.max.x<-10.65||b.min.x>-9.35);
 }
 const sheet=new THREE.Raycaster(V(-10,5.1,-7),V(0,0,-1),0,3);assert.equal(sheet.intersectObjects(meshes,true).length,0);
 originalSecondChapterContract(game);
});

test('the narrow mount exception rejects hidden, shifted, rescaled, duplicate and altered-triangle query owners',async()=>{
 await game.selectLevel(12,true);const art=game.firstLevel.secondChapterArt,m=art.mounting.meshes[0];
 const cases=[
  [()=>m.visible=false,()=>m.visible=true],
  [()=>m.material.visible=false,()=>m.material.visible=true],
  [()=>m.position.x+=.001,()=>m.position.x=originalX],
  [()=>m.scale.y=1.001,()=>m.scale.y=1],
  [()=>game.cameraBlockers.push(m),()=>game.cameraBlockers.pop()],
  [()=>{const a=m.geometry.attributes.position.array;a[0]+=.01;},()=>{const a=m.geometry.attributes.position.array;a[0]=vertex;}],
 ];const vertex=m.geometry.attributes.position.array[0],originalX=m.position.x;
 for(const [mutate,restore]of cases){try{mutate();assert.throws(()=>originalSecondChapterContract(game));}finally{restore();}}
 originalSecondChapterContract(game);
 const old=game.cameraBlockers.slice(),oldAim=game.aimBlockers.slice(),oldColliders=game.colliders.slice(),owned=new Set(art.mounting.meshes),bodies=art.mounting.meshes.map(m=>game.physics.solids.get(m.uuid).body);art.dispose();
 assert.deepEqual(game.cameraBlockers,old.filter(m=>!owned.has(m)));assert.deepEqual(game.aimBlockers,oldAim.filter(m=>!owned.has(m)));assert.deepEqual(game.colliders,oldColliders.filter(c=>!owned.has(c.mesh)));for(const body of bodies)assert.equal(game.physics.world.bodies.includes(body),false);
});

test('reachable southern standards have real Cannon contact with the original companion, not cosmetic pass-through posts',async()=>{
 await game.selectLevel(12,true);const mesh=game.firstLevel.secondChapterArt.mounting.meshes.find(m=>m.name==='13 / south optical receiver right grounded standard / receiver saddle');
 const support=game.physics.solids.get(mesh.uuid).body,body=game.physics.cargoBody,shape=body.shapes[0],cargo=game.cargo.group,top=game.colliders.find(c=>c.mesh===mesh).box.max.y;
 // Explicit contact fixture, not ordinary-route evidence: drop the same real
 // body vertically on a reachable new bearing to observe actual solver contact.
 body.position.set(mesh.position.x,top+.65,mesh.position.z);body.velocity.setZero();body.angularVelocity.setZero();body.quaternion.set(0,0,0,1);body.wakeUp();game.cargo.position.copy(mesh.position).setY(top+.65);
 let contact=false;
 for(let i=0;i<150;i++){game.updatePlaying(1/120);contact ||= game.physics.world.contacts.some(c=>(c.bi===body&&c.bj===support)||(c.bi===support&&c.bj===body));}
 assert.equal(contact,true);assert.ok(Math.abs(body.position.y-.39-top)<.025,'Companion rests on the actual saddle top');
 assert.equal(game.physics.cargoBody,body);assert.equal(body.shapes[0],shape);assert.equal(game.cargo.group,cargo);
 originalSecondChapterContract(game);
});

test('every casting is a connected assembly of visible per-piece solids with no enclosing void collider',async()=>{
 for(const room of [13,14]){
  await game.selectLevel(room-1,true);const mounting=game.firstLevel.secondChapterArt.mounting;
  for(const casting of mounting.castings){
   const boxes=casting.meshes.map(mesh=>game.colliders.find(c=>c.mesh===mesh).box),seen=new Set([0]);
   for(let pass=0;pass<boxes.length;pass++)for(let i=0;i<boxes.length;i++)if(!seen.has(i)&&[...seen].some(j=>boxes[i].intersectsBox(boxes[j])))seen.add(i);
   assert.equal(seen.size,boxes.length,`${casting.name} has a disconnected component`);
  }
  const mesh=mounting.meshes[0],body=game.physics.solids.get(mesh.uuid).body,mask=body.collisionFilterMask,x=body.position.x;
  try{body.collisionFilterMask=0;assert.throws(()=>originalSecondChapterContract(game));}finally{body.collisionFilterMask=mask;}
  try{body.position.x+=.01;assert.throws(()=>originalSecondChapterContract(game));}finally{body.position.x=x;}
  const resources=new Map([mounting.material,...mounting.meshes.map(m=>m.geometry)].map(r=>[r,0]));for(const r of resources.keys())r.addEventListener('dispose',()=>resources.set(r,resources.get(r)+1));
  game.firstLevel.secondChapterArt.dispose();game.firstLevel.secondChapterArt?.dispose();assert.ok([...resources.values()].every(n=>n===1));
 }
});
