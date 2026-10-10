import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {LabGame} from '../src/game/LabGame.js';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {createOrientedBoxContact,syncOrientedBoxContact,capsuleBoxContact,boxIntersectsOrientedCollider} from '../src/game/LabOrientedBoxContact.js';
const V=(...p)=>new THREE.Vector3(...p),Q=a=>new THREE.Quaternion().setFromAxisAngle(V(0,0,1),a);
function beam(angle=Math.PI/4){
 const body={position:V(0,2,0),quaternion:Q(angle),velocity:V(0,0,0),angularVelocity:V(0,0,0)},half=V(10,.25,.4),mesh=new THREE.Mesh(new THREE.BoxGeometry(20,.5,.8));
 mesh.position.copy(body.position);mesh.quaternion.copy(body.quaternion);mesh.updateWorldMatrix(true,false);
 return{mesh,enabled:true,box:new THREE.Box3().setFromObject(mesh),orientedBox:createOrientedBoxContact(body,half)};
}
test('room50 opts in precisely its two original rotor shapes and resets only contact history',async()=>{
 const g=await createHeadlessGame();g.chamberEdition='foundation';g.puzzleProgression=true;await g.selectLevel(49,false);const r=g.firstLevel.rotor,cargo=g.cargo,cargoBody=g.physics.cargoBody,player=g.playerGroup;
 assert.equal(g.colliders.filter(c=>c.orientedBox).length,2);assert.ok(r.parts.every(c=>c.orientedBox.body===r.body));assert.equal(r.body.mass,20);assert.equal(r.body.shapes.length,2);
 for(const [i,c]of r.parts.entries()){
  assert.deepEqual(c.orientedBox.half.toArray(),Object.values(r.body.shapes[i].halfExtents));assert.deepEqual(c.orientedBox.offset.toArray(),Object.values(r.body.shapeOffsets[i]));assert.equal(g.physics.solids.has(c.mesh.uuid),false);
 }
 const snapshots=r.parts.map(c=>({previous:c.orientedBox.previous.center.clone(),quaternion:c.orientedBox.previous.quaternion.clone(),step:c.orientedBox.step}));
 for(let n=0;n<5;n++)r.sync(0);
 for(const [i,c]of r.parts.entries()){assert.ok(c.orientedBox.previous.center.equals(snapshots[i].previous));assert.equal(c.orientedBox.previous.quaternion.angleTo(snapshots[i].quaternion),0);assert.equal(c.orientedBox.step,snapshots[i].step);}
 g.resetRun(true);assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,cargoBody);assert.equal(g.playerGroup,player);
 for(const c of r.parts){assert.ok(c.orientedBox.previous.center.equals(c.orientedBox.current.center));assert.equal(c.orientedBox.previous.quaternion.angleTo(c.orientedBox.current.quaternion),0);assert.equal('lastPlayerSweepStep' in c.orientedBox,false,'an unrelated body path cannot consume a collider-wide sweep');}
 await g.selectLevel(48,false);assert.equal(g.colliders.some(c=>c.orientedBox),false,'retained room49 has no opt-in descriptor');
});
test('controller dispatch frees a true beam wedge while unmarked legacy collision stays identical',()=>{
 const c=beam(),foot=V(4,0,0),position=foot.clone(),velocity=V(0,-1,0),g={colliders:[c],playerGrounded:false,heldCube:null,groundedByCollider:false};
 LabGame.prototype.resolveBody.call(g,position,foot,velocity,.43,2.4,false);assert.ok(position.equals(foot));assert.ok(velocity.equals(V(0,-1,0)));assert.equal(g.groundedByCollider,false);
 delete c.orientedBox;const legacy=foot.clone(),legacyVelocity=V(0,-1,0);
 LabGame.prototype.resolveBody.call(g,legacy,foot,legacyVelocity,.43,2.4,false);assert.ok(legacy.distanceTo(foot)>.1,'legacy AABB dispatch remains unchanged for every unmarked collider');
});
test('production foot support returns only a real finite inclined beam face',()=>{
 const c=beam(Math.PI/6),g={colliders:[c],ramps:[],floors:[],floorHeight:()=>null},support=LabGame.prototype.sampleFootSupport.call(g,0,0,4);
 assert.ok(support);assert.ok(Math.abs(support.height-(2+.25/Math.cos(Math.PI/6)))<1e-8);assert.ok(support.normal.distanceTo(V(0,1,0).applyQuaternion(Q(Math.PI/6)))<1e-8);
 assert.equal(LabGame.prototype.sampleFootSupport.call(g,4,0,1.8),null);assert.equal(LabGame.prototype.sampleFootSupport.call(g,0,1,4),null);
});
test('held target controller uses real beam SAT clearance and preserves the original grip',()=>{
 // A controller fixture, not a production journey: interrupt exactly at the
 // existing servo call to inspect the production target calculation.
 const c=beam(),cargo={position:V(3,6.16,0),quaternion:new THREE.Quaternion()},sentinel={},g={colliders:[c],cargo,heldCube:cargo,playerPosition:V(3,5.1,0),playerVelocity:V(0,0,0),playerGrounded:false,facing:Math.PI/2,portalOpensCollider:()=>false};let target;
 g.physics={cargoBody:{quaternion:new THREE.Quaternion()},setCarryTarget(p){target=p.clone();throw sentinel;}};
 assert.throws(()=>LabGame.prototype.updateCubes.call(g,1/120),error=>error===sentinel);assert.equal(g.heldCube,cargo);assert.ok(target);
 assert.ok(target.x<3.72-.01);assert.ok(target.y>6.16+.01);const half=V(.425,.425,.425),bounds=new THREE.Box3().setFromCenterAndSize(target,half.clone().multiplyScalar(2));assert.equal(boxIntersectsOrientedCollider(c.orientedBox,bounds),false);
 const clearCargo={position:V(4,1.06,.72),quaternion:new THREE.Quaternion()};g.cargo=clearCargo;g.heldCube=clearCargo;g.playerPosition.set(4,0,0);g.facing=0;
 assert.throws(()=>LabGame.prototype.updateCubes.call(g,1/120),error=>error===sentinel);assert.ok(target.distanceTo(V(4,1.06,.72))<1e-8);assert.equal(g.heldCube,clearCargo);
});
test('an unrelated far controller path does not consume a later nearby angular contact',()=>{
 const c=beam(.01);c.orientedBox.body.position.y=16;syncOrientedBoxContact(c.orientedBox,c.orientedBox.body,0,true);c.orientedBox.body.quaternion.copy(Q(.04));c.orientedBox.body.angularVelocity.z=3.6;syncOrientedBoxContact(c.orientedBox,c.orientedBox.body,1);
 const g={colliders:[c],playerGrounded:false,heldCube:null,groundedByCollider:false},far=V(100,0,0);LabGame.prototype.resolveBody.call(g,far,far.clone(),V(0,0,0),.43,2.4,false);assert.ok(far.equals(V(100,0,0)));
 const foot=V(10.4325,15.57,0),position=foot.clone(),velocity=V(0,0,0);assert.ok(capsuleBoxContact(foot,.43,2.4,c.orientedBox,c.orientedBox.previous).depth<0);assert.ok(capsuleBoxContact(foot,.43,2.4,c.orientedBox).depth<0);
 LabGame.prototype.resolveBody.call(g,position,foot,velocity,.43,2.4,false);assert.ok(position.distanceTo(foot)>.0005,'the angular middle must contact this second path');assert.ok(velocity.length()>0);assert.ok(capsuleBoxContact(position,.43,2.4,c.orientedBox).depth<=1e-6);
});
test('portal arrival sweeps only the residual interval and cannot replay a pre-arrival rotating beam',()=>{
 const c=beam(.01);c.orientedBox.body.position.y=16;syncOrientedBoxContact(c.orientedBox,c.orientedBox.body,0,true);c.orientedBox.body.quaternion.copy(Q(.04));c.orientedBox.body.angularVelocity.z=3.6;syncOrientedBoxContact(c.orientedBox,c.orientedBox.body,1);
 const g={colliders:[c],playerGrounded:false,heldCube:null,groundedByCollider:false},foot=V(10.4325,15.57,0),late=foot.clone(),velocity=V(0,0,0);assert.ok(capsuleBoxContact(foot,.43,2.4,c.orientedBox).depth<0);
 LabGame.prototype.resolveBody.call(g,late,foot,velocity,.43,2.4,false,false,{from:.95,to:1});assert.ok(late.equals(foot),'a late portal arrival was absent during the earlier beam crossing');assert.ok(velocity.equals(V(0,0,0)));assert.equal(g.groundedByCollider,false);
 const whole=foot.clone();LabGame.prototype.resolveBody.call(g,whole,foot,V(0,0,0),.43,2.4,false);assert.ok(whole.distanceTo(foot)>.0005,'the full-interval control proves there really was an earlier contact');
});
test('oriented source support is evaluated at crossing time and replaced by the destination support',()=>{
 const c=beam(0);c.orientedBox.body.position.y=0;syncOrientedBoxContact(c.orientedBox,c.orientedBox.body,0,true);c.orientedBox.body.position.y=-2;c.orientedBox.body.velocity.y=-2;syncOrientedBoxContact(c.orientedBox,c.orientedBox.body,1);
 const g={colliders:[c],playerGrounded:false,heldCube:null,groundedByCollider:false},source=V(0,-.25,0),velocity=V(0,-2,0);
 LabGame.prototype.resolveBody.call(g,source,source.clone(),velocity,.43,2.4,false,false,{from:.25,to:.25});assert.equal(g.groundedByOrientedCollider,true,'the actual source-end face is at y=-.25 at crossing quarter-time');assert.equal(g.groundedByCollider,false,'legacy ramp/AABB support state is independent');
 const destination=V(100,0,0);LabGame.prototype.resolveBody.call(g,destination,destination.clone(),V(0,0,0),.43,2.4,false,false,{from:.25,to:1});assert.equal(g.groundedByOrientedCollider,false,'source OBB support cannot survive a portal destination with no real contact');assert.equal(g.groundedByCollider,false);
});
