import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runPortalFloorJourney} from '../src/game/LabPortalFloorJourney.js';
import {makePortalFrame,portalBacksCollider,portalIntersectsBox} from '../src/game/LabPortals.js';
import {applyLabQuality} from '../src/game/LabPreferences.js';
let shared;
async function scene(){shared??=await createHeadlessGame();shared.chamberEdition='open';await shared.selectLevel(23,false);return shared;}
for(const options of [{},{offset:-.45},{offset:.45},{carry:true},{returnTrip:true}])test(`floor portal opens the full host deck, ordinary input ${JSON.stringify(options)}`,async()=>{
 const g=await scene(),r=await runPortalFloorJourney(g,options);
 assert.equal(r.pass,true);assert.equal(r.resets,0);assert.equal(r.respawns,0);assert.ok(r.teleports>=1);assert.ok(r.milestones.some(m=>m.name==='floor to wall crossed'));
});
test('owned hull opens only inside a linked aperture; supports, far depths and unlinked decks stay solid',async()=>{
 const g=await scene(),pad=g.firstLevel.loadPads[0],ids=pad.surface.mesh.userData.portalBackingIds;
 assert.ok(ids.length>=3);const hull=g.colliders.find(c=>c.mesh.name.includes('Closed load-bearing hull / Departure plaza'));
 assert.ok(ids.includes(hull.mesh.uuid));
 const p=pad.surface.getFrame().center.clone();
 assert.equal(g.portalOpensCollider(hull,p,.43),false);
 g.portals.placeOnPanel(0,pad.surface.mesh,p);
 g.portals.placeOnPanel(1,g.firstLevel.car.panel.mesh,g.firstLevel.car.panel.getFrame().center);
 assert.equal(g.portalOpensCollider(hull,p,.43),true);
 assert.equal(g.portalOpensCollider(hull,p.clone().add(new THREE.Vector3(3,0,0)),.43),false);
 assert.equal(g.portalOpensCollider(hull,p.clone().add(new THREE.Vector3(0,-6,0)),.43),false);
 const unowned={mesh:{uuid:'unrelated-solid'},box:hull.box.clone()};
 assert.equal(g.portalOpensCollider(unowned,p,.43),false,'Do not globally widen backing depth');
 g.portals.clear();assert.equal(g.portalOpensCollider(hull,p,.43),false);
});
test('scalar normal rejection equals the original eight-corner test for rotated portals',()=>{
 let seed=17;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296),r=(a,b)=>a+(b-a)*random();
 for(let i=0;i<2000;i++){
  const frame=makePortalFrame(new THREE.Vector3(r(-4,4),r(-4,4),r(-4,4)),new THREE.Vector3(r(-1,1),r(-1,1),r(-1,1)).normalize());
  const c=frame.position.clone().add(new THREE.Vector3(r(-3,3),r(-3,3),r(-3,3))),size=new THREE.Vector3(r(.01,8),r(.01,8),r(.01,8)),box=new THREE.Box3().setFromCenterAndSize(c,size),depth=r(.1,1.5);
  const inverse=frame.quaternion.clone().invert(),points=[];
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(new THREE.Vector3(x,y,z).sub(frame.position).applyQuaternion(inverse));
  const local=new THREE.Box3().setFromPoints(points),expected=local.max.z<=.08&&local.max.z>=-depth&&local.min.z<.08&&portalIntersectsBox(frame,box,-depth,.08);
  assert.equal(portalBacksCollider(frame,box,depth),expected);
 }
});
test('reapplying the saved quality retains warmed shadows, real size changes recreate them',()=>{
 let disposed=0;const map={dispose(){disposed++;}},shadow={map,mapSize:new THREE.Vector2(1024,1024),needsUpdate:false};
 const game={keyLight:{shadow},portals:{}};applyLabQuality(game,'balanced',1);
 assert.equal(shadow.map,map);assert.equal(disposed,0);assert.equal(shadow.needsUpdate,false);
 applyLabQuality(game,'high',1);assert.equal(disposed,1);assert.equal(shadow.map,null);assert.equal(shadow.mapSize.x,2048);assert.equal(shadow.needsUpdate,true);
});
