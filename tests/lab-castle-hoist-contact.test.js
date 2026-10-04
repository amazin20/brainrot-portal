// Geometry fixtures protect the catcher that closed the reproduced exterior
// hand-delivery skip. These inspect production collision geometry; actual
// input-only reproduction lives in qa-speedrun-castle-new.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';

const V=(...p)=>new THREE.Vector3(...p);
let fixture;
async function castle(){
  fixture??=(async()=>{const g=await createHeadlessGame();g.chamberEdition='foundation';await g.selectLevel(40,true);return g;})();
  return fixture;
}
const centre=b=>b.getCenter(new THREE.Vector3());

test('Hoist requires a marked two-dimensional receiving tray inside the closed bay',async()=>{
  const g=await castle(),l=g.firstLevel,r=l.rooms.get('hoist'),s=l.machines.get('hoist').state;
  assert.deepEqual(s.receiver,r.P(-12,15,18));
  const tray=V(...s.receiver);
  assert.ok(g.floors.some(f=>f.enabled!==false&&Math.abs(f.y-18)<1e-6&&tray.x>=f.minX&&tray.x<=f.maxX&&tray.z>=f.minZ&&tray.z<=f.maxZ),'The catcher needs real floor support');
  let marked=false;l.structure.traverse(mesh=>{if(!mesh.isMesh)return;const p=mesh.getWorldPosition(new THREE.Vector3());marked||=Math.abs(p.x-tray.x)<.1&&Math.abs(p.z-tray.z)<.1&&p.y>18&&p.y<18.2;});assert.ok(marked,'The marked receiving tray must exist');
  const oldWrongDrop=V(...r.P(-12,10,18));
  assert.ok(oldWrongDrop.distanceTo(tray)>4.9,'The old x-only completion point remains outside the catcher');
  assert.equal(s.catcherProgress,0);
});

test('Catcher sight slit admits the real muzzle ray and rejects the smallest cargo cross-section',async()=>{
  const g=await castle(),r=g.firstLevel.rooms.get('hoist'),z=r.P(0,11.75)[2];
  const hatch=g.colliders.filter(c=>c.enabled!==false&&c.kinematic&&Math.abs(centre(c.box).z-z)<1e-5&&centre(c.box).x>29&&centre(c.box).x<35&&c.box.min.y>=17.99&&c.box.max.y<25);
  assert.equal(hatch.length,4,'The service hatch has two sides, a sill and a head');
  const shot=V(31.2923,19.5328,z);
  assert.ok(hatch.every(c=>!c.box.containsPoint(shot)),'The production off-axis portal muzzle shot needs the sight slit');
  const half=g.physics.cargoBody.shapes[0].halfExtents;
  const cargo=new THREE.Box3(shot.clone().sub(V(half.x,half.y,half.z)),shot.clone().add(V(half.x,half.y,half.z)));
  assert.ok(hatch.some(c=>c.box.intersectsBox(cargo)),'The cargo body cannot replace a portal shot through the sight slit');
  const sill=hatch.find(c=>Math.abs(centre(c.box).x-32)<.01&&c.box.max.y<20),head=hatch.find(c=>Math.abs(centre(c.box).x-32)<.01&&c.box.min.y>19.8);
  const aperture=head.box.min.y-sill.box.max.y;
  assert.ok(aperture>0&&aperture<2*Math.min(half.x,half.y,half.z),'Rotating a cube cannot reduce its projected height below its minimum diameter');
});

test('Upper catcher has solid roof, side walls and rear wall',async()=>{
  const g=await castle(),r=g.firstLevel.rooms.get('hoist');
  for(const point of [r.P(-15,16,21),r.P(-9,16,21),r.P(-12,20.25,21),r.P(-12,16,24.2)]){
    assert.ok(g.colliders.some(c=>c.enabled!==false&&c.box.containsPoint(V(...point))),'Missing catcher boundary at '+point);
  }
});
