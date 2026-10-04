// Geometry fixtures protect the catcher that closed the reproduced exterior
// hand-delivery skip. These inspect production collision geometry; actual
// input-only reproduction lives in qa-speedrun-castle-new.mjs.
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runSingularityJourney} from '../src/game/LabSingularityJourney.js';
import {hoistCatcherOffset} from '../src/game/LabSingularityLevel.js';

const V=(...p)=>new THREE.Vector3(...p);
let fixture;
async function castle(){
  fixture??=(async()=>{const g=await createHeadlessGame();g.chamberEdition='foundation';await g.selectLevel(40,true);return g;})();
  return fixture;
}
const centre=b=>b.getCenter(new THREE.Vector3());
const movingParts=g=>g.colliders.filter(c=>c.mesh.name==='Hoist catcher / service hatch'||c.mesh.name==='Hoist catcher / runner');
const penetrates=(a,b)=>['x','y','z'].every(axis=>Math.min(a.max[axis],b.max[axis])-Math.max(a.min[axis],b.min[axis])>1e-6);
const description=c=>`${c.mesh.name||'static solid'} at ${centre(c.box).toArray()}`;
after(async()=>{if(!fixture)return;const g=await fixture;g.firstLevel.dispose();g.physics.dispose();g.portals.dispose();});

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

test('Geometry fixture: the entire two-stage hatch stroke clears real solids and the upper exit corridor',async()=>{
  const g=await castle(),r=g.firstLevel.rooms.get('hoist'),parts=movingParts(g);
  assert.equal(parts.length,6,'Four barrier sections travel with two load-bearing runners');
  const fixed=g.colliders.filter(c=>c.enabled!==false&&!c.kinematic);
  const corridor=new THREE.Box3(V(...r.P(-18-.43,10-.43,18)),V(...r.P(-18+.43,10+.43,20.4)));
  const closed=parts.map(c=>({c,box:c.box.clone()}));
  // Each phase is translation on one axis, so the union of its end boxes is
  // the exact continuous swept volume, not merely a sampled approximation.
  for(const[from,to]of [[V(0,0,0),V(0,0,-.75)],[V(0,0,-.75),V(-7,0,-.75)]])for(const{c,box}of closed){
    const sweep=box.clone().translate(from).union(box.clone().translate(to));
    for(const obstacle of fixed)assert.ok(!penetrates(sweep,obstacle.box),'Continuous stroke: '+c.mesh.name+' intersects '+description(obstacle));
    assert.ok(!penetrates(sweep,corridor),'The exact continuous stroke clears the upper exit corridor');
  }
  // This is a geometric pose fixture, not a staged gameplay completion. It
  // samples the production stroke without assigning any actor or machine state.
  for(let i=0;i<=200;i++){
    const progress=i/200,offset=hoistCatcherOffset(progress);
    if(offset.x<0)assert.equal(offset.z,-.75,'Left travel starts only after clearing the bay front');
    if(progress<=.2)assert.equal(Math.abs(offset.x),0);
    for(const{c,box}of closed){
      const swept=box.clone().translate(V(offset.x,0,offset.z));
      assert.equal(swept.min.y,box.min.y);assert.equal(swept.max.y,box.max.y);
      assert.ok(swept.min.x>=r.b.x0&&swept.max.x<=r.b.x1,'The cassette stays inside the room');
      for(const obstacle of fixed)assert.ok(!penetrates(swept,obstacle.box),`Stroke ${progress}: ${c.mesh.name} penetrates ${description(obstacle)}`);
      assert.ok(!penetrates(swept,corridor),'The existing upper exit remains clear during the complete stroke');
    }
  }
  assert.deepEqual(hoistCatcherOffset(0),{x:-0,z:-0});
  assert.deepEqual(hoistCatcherOffset(.2),{x:-0,z:-.75});
  assert.deepEqual(hoistCatcherOffset(1),{x:-7,z:-.75});
  const stowed=closed.filter(({c})=>c.mesh.name==='Hoist catcher / service hatch').reduce((box,{box:part})=>box.union(part.clone().translate(V(-7,0,-.75))),new THREE.Box3());
  assert.deepEqual(stowed.min.toArray(),r.P(-22,10.75,18));
  assert.deepEqual(stowed.max.toArray(),r.P(-16,11.25,24));
  const guides=g.colliders.filter(c=>c.mesh.name==='Hoist catcher / founded guide');
  assert.equal(guides.filter(c=>c.box.min.y<=.001&&c.box.max.y>24).length,2,'Both overhead guide supports stand on the real ground deck');
  assert.ok(guides.every(c=>c.box.min.x>=r.b.x0&&c.box.max.x<=r.b.x1),'Guide supports fit inside the room walls');
});

test('Ordinary-input freight and hoist route opens the physical hatch, retrieves the same companion and resets the stroke',async()=>{
  const g=await castle(),r=g.firstLevel.rooms.get('hoist'),s=g.firstLevel.machines.get('hoist').state;
  const parts=movingParts(g),closed=parts.map(c=>c.box.clone()),companion=g.cargo,body=g.physics.cargoBody.id;
  const fixed=g.colliders.filter(c=>c.enabled!==false&&!c.kinematic);
  let openingFrames=0,sawOutward=false,sawLeft=false,lastProgress=0;
  const report=await runSingularityJourney(g,{order:['freight','hoist'],stopAfter:'hoist',onFrame:()=>{
    const p=s.catcherProgress;if(p<=0)return;openingFrames++;
    assert.ok(p>=lastProgress&&p<=1);lastProgress=p;
    const offset=hoistCatcherOffset(p);sawOutward||=p>0&&p<.2;sawLeft||=offset.x<0;
    for(let i=0;i<parts.length;i++){
      const c=parts[i],expected=closed[i].clone().translate(V(offset.x,0,offset.z));
      assert.ok(c.box.min.distanceTo(expected.min)<1e-6&&c.box.max.distanceTo(expected.max)<1e-6,'The live collision body follows the visible hatch');
      const physical=g.physics.solids.get(c.mesh.uuid)?.body;
      assert.ok(physical,'Every moving hatch part has a Cannon body');
      assert.ok(V(physical.position.x,physical.position.y,physical.position.z).distanceTo(centre(c.box))<1e-6,'Cannon and rendered geometry have the same pose');
      for(const obstacle of fixed)assert.ok(!penetrates(c.box,obstacle.box),'Actual hatch motion intersects '+description(obstacle));
    }
  }});
  assert.equal(report.partial,true);assert.deepEqual(report.metrics.solvedIds,['freight','hoist']);
  assert.equal(report.resets+report.respawns+report.cargoResets,0);assert.equal(report.sameCompanion,true);
  assert.equal(g.cargo,companion);assert.equal(g.physics.cargoBody.id,body);
  assert.ok(openingFrames>60&&sawOutward&&sawLeft,'Both sequential strokes occur during the actual route');
  assert.equal(s.catcherProgress,1,'The physical door reaches its fully stowed pose');
  const proof=report.metrics.events.find(e=>e.id==='hoist').proof;
  assert.ok(proof.locked&&proof.upperCatcherLoaded&&proof.cargoPortalTransports>=1,'The sealed receiver still needs a real portal cargo arrival');
  g.resetRun();assert.equal(s.catcherProgress,0);assert.equal(s.locked,false);
  parts.forEach((c,i)=>assert.ok(c.box.min.distanceTo(closed[i].min)<1e-6&&c.box.max.distanceTo(closed[i].max)<1e-6,'Reset restores the physical closed hatch'));
});
