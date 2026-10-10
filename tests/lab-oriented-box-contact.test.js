import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
 createOrientedBoxContact, syncOrientedBoxContact, capsuleBoxContact,
 resolveCapsuleBoxMotion, orientedBoxSupport,
 constrainBoxToOrientedCollider, boxIntersectsOrientedCollider,
} from '../src/game/LabOrientedBoxContact.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const Q=angle=>new THREE.Quaternion().setFromAxisAngle(V(0,0,1),angle);
const close=(actual,expected,tolerance=1e-6)=>assert.ok(
 Math.abs(actual-expected)<=tolerance,`${actual} must be within ${tolerance} of ${expected}`);
const closeVector=(actual,expected,tolerance=1e-6)=>assert.ok(
 actual.distanceTo(expected)<=tolerance,
 `${actual.toArray()} must be within ${tolerance} of ${expected.toArray()}`);
function fixture(half,position=V(),angle=0,offset=V()){
 const body={position:position.clone(),quaternion:Q(angle),velocity:V(),angularVelocity:V()};
 return {body,box:createOrientedBoxContact(body,half,offset,0)};
}
const bounds=(center,half)=>new THREE.Box3(center.clone().sub(half),center.clone().add(half));

test('capsule uses a rounded horizontal corner instead of square radius expansion',()=>{
 const {box}=fixture(V(1,1,1)),radius=.4,height=1.8;
 // Both coordinates lie inside a square expanded by .4, but the real corner
 // is sqrt(.3²+.3²) away from the central segment and must remain clear.
 const clear=V(1.3,-.5,1.3),clearHit=capsuleBoxContact(clear,radius,height,box);
 close(clearHit.distance,Math.SQRT2*.3);
 close(clearHit.depth,radius-Math.SQRT2*.3);
 assert.ok(clearHit.depth<0);
 const position=clear.clone(),velocity=V(-2,0,-2);
 assert.equal(resolveCapsuleBoxMotion(position,clear,velocity,radius,height,box).contacts,0);
 closeVector(position,clear);closeVector(velocity,V(-2,0,-2));
 const hit=capsuleBoxContact(V(1.2,-.5,1.2),radius,height,box);
 close(hit.distance,Math.SQRT2*.2);close(hit.depth,radius-Math.SQRT2*.2);
 closeVector(hit.normal,V(Math.SQRT1_2,0,Math.SQRT1_2));
 close(hit.point.x,1);close(hit.point.z,1);
});

test('empty space inside a diagonal beam AABB does not contact capsule or cargo',()=>{
 const {box}=fixture(V(10,.25,.4),V(0,2,0),Math.PI/4);
 const foot=V(4,0,0),position=foot.clone(),velocity=V(0,-1,2);
 assert.ok(capsuleBoxContact(foot,.4,1.8,box).depth<0);
 const result=resolveCapsuleBoxMotion(position,foot,velocity,.4,1.8,box);
 assert.equal(result.contacts,0);assert.equal(result.grounded,false);
 closeVector(position,foot);closeVector(velocity,V(0,-1,2));
 assert.equal(boxIntersectsOrientedCollider(box,bounds(V(4,.9,0),V(.3,.3,.3))),false);
 assert.equal(orientedBoxSupport(box,4,0,1.8),null);
});

for(const angle of [-Math.PI/6,Math.PI/6]){
 const side=angle<0?'negative':'positive';
 test(`${side} beam angle resolves the real upper face and preserves tangential motion`,()=>{
  const {box}=fixture(V(3,.25,.5),V(0,3,0),angle),radius=.4,height=1.8;
  const normal=V(0,1,0).applyQuaternion(Q(angle)),tangent=V(1,0,0).applyQuaternion(Q(angle));
  const foot=V(0,3+(.25+radius-.06)/Math.cos(angle)-radius,0);
  const hit=capsuleBoxContact(foot,radius,height,box);
  close(hit.distance,radius-.06);close(hit.depth,.06);closeVector(hit.normal,normal);
  close(hit.point.clone().sub(box.current.center).dot(normal),.25);
  const position=foot.clone(),velocity=tangent.clone().multiplyScalar(3).add(V(0,0,1)).addScaledVector(normal,-2);
  const result=resolveCapsuleBoxMotion(position,foot,velocity,radius,height,box,{sweep:false});
  assert.ok(result.contacts>0);assert.equal(result.grounded,true);
  assert.ok(capsuleBoxContact(position,radius,height,box).depth<=1e-6);
  assert.ok(velocity.dot(normal)>=-1e-6);close(velocity.dot(tangent),3);close(velocity.z,1);
 });

 test(`${side} beam angle resolves its underside without grounding the player`,()=>{
  const {box}=fixture(V(3,.25,.5),V(0,3,0),angle),radius=.4,height=1.8;
  const normal=V(0,-1,0).applyQuaternion(Q(angle));
  // The top endpoint of the upright capsule, rather than its foot, touches.
  const foot=V(0,3-(.25+radius-.06)/Math.cos(angle)-(height-radius),0);
  const hit=capsuleBoxContact(foot,radius,height,box);
  close(hit.distance,radius-.06);close(hit.depth,.06);closeVector(hit.normal,normal);
  const position=foot.clone(),velocity=normal.clone().multiplyScalar(-2);
  const result=resolveCapsuleBoxMotion(position,foot,velocity,radius,height,box,{sweep:false});
  assert.ok(result.contacts>0);assert.equal(result.grounded,false);
  assert.ok(capsuleBoxContact(position,radius,height,box).depth<=1e-6);
  assert.ok(velocity.dot(normal)>=-1e-6);
 });

 test(`${side} finite upper face supplies its exact sloped support height`,()=>{
  const {box}=fixture(V(3,.25,.5),V(0,3,0),angle);
  const support=orientedBoxSupport(box,0,0,4);
  assert.ok(support);close(support.height,3+.25/Math.cos(angle));
  closeVector(support.normal,V(0,1,0).applyQuaternion(Q(angle)));
  assert.equal(orientedBoxSupport(box,0,0,3),null);
  assert.equal(orientedBoxSupport(box,0,.6,4),null,'finite z extent excludes an infinite face extension');
 });
}

test('continuous player motion cannot cross a thin real face with two clear endpoints',()=>{
 const {box}=fixture(V(.05,3,1)),previous=V(-2,0,0),position=V(2,0,0),velocity=V(10,0,2);
 assert.ok(capsuleBoxContact(previous,.4,1.8,box).depth<0);
 assert.ok(capsuleBoxContact(position,.4,1.8,box).depth<0);
 const result=resolveCapsuleBoxMotion(position,previous,velocity,.4,1.8,box);
 assert.ok(result.contacts>0);assert.equal(result.grounded,false);
 close(position.x,-.45,5e-4);close(position.y,0);close(position.z,0);
 close(velocity.x,0);close(velocity.z,2);
});

test('a rotating beam contacts a stationary capsule even when both beam endpoints are clear',()=>{
 const {body,box}=fixture(V(10,.15,.5),V(0,2,0),-.12);
 const foot=V(8,1.6,0),radius=.35,height=.8;
 assert.ok(capsuleBoxContact(foot,radius,height,box).depth<0);
 body.quaternion.copy(Q(.12));body.angularVelocity.z=.24*120;
 syncOrientedBoxContact(box,body,1);
 assert.ok(capsuleBoxContact(foot,radius,height,box).depth<0);
 const position=foot.clone(),velocity=V();
 const result=resolveCapsuleBoxMotion(position,foot,velocity,radius,height,box);
 assert.ok(result.contacts>0,'the middle of the angular sweep crosses the capsule');
 assert.ok(position.distanceTo(foot)>.1,'a stationary player must be displaced by the real rotating face');
 assert.ok(velocity.length()>.1,'real angular point velocity must reach the stationary player');
 assert.ok(capsuleBoxContact(position,radius,height,box).depth<=1e-6);
});

test('a translating face transfers its normal velocity while leaving tangent velocity intact',()=>{
 const {body,box}=fixture(V(1,1,1));
 body.position.x=.2;body.velocity.x=5;syncOrientedBoxContact(box,body,1);
 const foot=V(1.45,-.5,0),position=foot.clone(),velocity=V(0,0,3);
 const result=resolveCapsuleBoxMotion(position,foot,velocity,.4,1.8,box);
 assert.ok(result.contacts>0);assert.equal(result.grounded,false);
 close(position.x,1.6,5e-4);close(position.y,foot.y);close(position.z,0);
 close(velocity.x,5);close(velocity.z,3);
});

test('held-box sweep and box intersection agree on the same real tilted face',()=>{
 const angle=Math.PI/4,{box}=fixture(V(3,.25,.6),V(0,2,0),angle);
 const half=V(.2,.2,.2),quaternion=new THREE.Quaternion(),start=V(0,4,0),target=V(0,0,0);
 const corrected=constrainBoxToOrientedCollider(box,start,target,half,quaternion);
 assert.notEqual(corrected,target);closeVector(target,V(0,0,0));
 const normal=V(0,1,0).applyQuaternion(Q(angle));
 const projectedHalf=Math.abs(normal.x)*half.x+Math.abs(normal.y)*half.y;
 close(corrected.clone().sub(box.current.center).dot(normal),.25+projectedHalf,5e-4);
 assert.equal(boxIntersectsOrientedCollider(box,bounds(corrected,half)),false);
 assert.equal(boxIntersectsOrientedCollider(box,bounds(V(0,2,0),half)),true);
 const clearTarget=V(-2,4,0);
 closeVector(constrainBoxToOrientedCollider(box,start,clearTarget,half,quaternion),clearTarget);
});

test('held-box clearance accounts for the cargo quaternion and keeps original inputs intact',()=>{
 const {box}=fixture(V(3,.25,.6),V(0,2,0),Math.PI/4),half=V(.4,.1,.2),cargoRotation=Q(Math.PI/4);
 const start=V(0,4,0),target=V(0,0,0),before=cargoRotation.clone();
 const corrected=constrainBoxToOrientedCollider(box,start,target,half,cargoRotation);
 const normal=V(0,1,0).applyQuaternion(box.current.quaternion);
 close(corrected.clone().sub(box.current.center).dot(normal),.25+half.y,5e-4);
 closeVector(start,V(0,4,0));closeVector(target,V(0,0,0));closeVector(half,V(.4,.1,.2));
 close(cargoRotation.angleTo(before),0);
});

test('fixed-step pose history preserves the previous frame across repeated render syncs',()=>{
 const half=V(3,.25,.6),offset=V(1,0,0),{body,box}=fixture(half,V(),Math.PI/2,offset);
 closeVector(box.current.center,V(0,1,0));closeVector(box.previous.center,V(0,1,0));
 half.x=100;offset.x=100;close(box.half.x,3);close(box.offset.x,1);
 body.position.x=2;body.quaternion.copy(Q(Math.PI));syncOrientedBoxContact(box,body,1);
 closeVector(box.previous.center,V(0,1,0));closeVector(box.current.center,V(1,0,0));
 body.position.x=3;syncOrientedBoxContact(box,body,1);
 closeVector(box.previous.center,V(0,1,0));closeVector(box.current.center,V(2,0,0));
 close(box.previous.quaternion.angleTo(Q(Math.PI/2)),0);
 body.position.x=4;body.quaternion.copy(Q(0));syncOrientedBoxContact(box,body,2);
 closeVector(box.previous.center,V(2,0,0));closeVector(box.current.center,V(5,0,0));
 syncOrientedBoxContact(box,body,2,true);
 closeVector(box.previous.center,box.current.center);close(box.previous.quaternion.angleTo(box.current.quaternion),0);
});

test('a 200 metre parallel capsule path .001 beyond a rounded beam corner stays unchanged',()=>{
 const {box}=fixture(V(120,.1,.5)),radius=.4,height=1.8;
 // The lower central-segment endpoint is .3 above the beam. This radial
 // corner gap remains .001 throughout the 200 m path, while the capsule's
 // broadphase AABB still overlaps the beam, requiring a narrowphase answer.
 const z=.5+Math.sqrt(.401**2-.3**2),previous=V(-100,0,z),target=V(100,0,z);
 close(capsuleBoxContact(previous,radius,height,box).distance,.401);
 const position=target.clone(),velocity=V(200,0,0);
 const result=resolveCapsuleBoxMotion(position,previous,velocity,radius,height,box);
 assert.equal(result.contacts,0);assert.equal(result.grounded,false);
 closeVector(position,target);closeVector(velocity,V(200,0,0));
});

test('a tiny inward slope after a .001 gap cannot hide a later capsule contact during 200 metre travel',()=>{
 const {box}=fixture(V(120,.1,.5)),radius=.4,height=1.8;
 const previous=V(-100,0,.5+Math.sqrt(.401**2-.3**2));
 const target=V(100,0,.5+Math.sqrt(.399**2-.3**2));
 close(capsuleBoxContact(previous,radius,height,box).depth,-.001);
 close(capsuleBoxContact(target,radius,height,box).depth,.001);
 const position=target.clone(),velocity=target.clone().sub(previous);
 const result=resolveCapsuleBoxMotion(position,previous,velocity,radius,height,box);
 assert.ok(result.contacts>0,'the almost parallel path eventually reaches the real rounded corner');
 close(position.x,100);close(velocity.x,200);
 assert.ok(position.distanceTo(target)>.0009,'the target penetrating the real corner must be corrected');
 assert.ok(capsuleBoxContact(position,radius,height,box).depth<=1e-6);
});

test('a later almost parallel contact is found even when both 200 metre path endpoints are clear',()=>{
 const {box}=fixture(V(90,.1,.5)),radius=.4,height=1.8;
 const previous=V(-100,0,.5+Math.sqrt(.401**2-.3**2));
 const target=V(100,0,.5+Math.sqrt(.399**2-.3**2));
 assert.ok(capsuleBoxContact(previous,radius,height,box).depth<0);
 assert.ok(capsuleBoxContact(target,radius,height,box).depth<0);
 const middle=previous.clone().lerp(target,.75);
 assert.ok(capsuleBoxContact(middle,radius,height,box).depth>0);
 const position=target.clone(),velocity=target.clone().sub(previous);
 const result=resolveCapsuleBoxMotion(position,previous,velocity,radius,height,box);
 assert.ok(result.contacts>0);close(position.x,100);close(velocity.x,200);
 assert.ok(position.y>.0001,'the real corner transfers its upward normal during the middle of the path');
 assert.ok(capsuleBoxContact(position,radius,height,box).depth<=1e-6);
});

test('an exactly tangent rounded end corner does not divert a straight side-grazing path',()=>{
 const {box}=fixture(V(1,1,1)),previous=V(-4,-.5,1.4),target=V(4,-.5,1.4);
 const position=target.clone(),velocity=V(8,0,0);
 const result=resolveCapsuleBoxMotion(position,previous,velocity,.4,1.8,box);
 assert.equal(result.grounded,false);
 // Touching the rounded end at x=-1 has only a z normal; x travel and its
 // tangent velocity remain available, with at most a small contact skin.
 closeVector(position,target,5e-4);closeVector(velocity,V(8,0,0),5e-4);
});

test('a steep real beam face resolves contact without becoming walkable ground',()=>{
 const angle=Math.PI/3,{box}=fixture(V(3,.25,.5),V(0,3,0),angle),radius=.4,height=1.8;
 const normal=V(0,1,0).applyQuaternion(Q(angle));
 const foot=V(0,3+(.25+radius-.06)/Math.cos(angle)-radius,0);
 const position=foot.clone(),velocity=normal.clone().multiplyScalar(-2);
 closeVector(capsuleBoxContact(foot,radius,height,box).normal,normal);
 close(normal.y,.5);
 const result=resolveCapsuleBoxMotion(position,foot,velocity,radius,height,box,{sweep:false});
 assert.ok(result.contacts>0);assert.equal(result.grounded,false);
 assert.ok(capsuleBoxContact(position,radius,height,box).depth<=1e-6);
 assert.equal(orientedBoxSupport(box,0,0,10),null);
});

for(const angle of [-Math.PI/6,0,Math.PI/6]){
 test(`an upward jump leaving a real upper face at ${angle} radians is not regrounded`,()=>{
  const {box}=fixture(V(3,.25,.5),V(0,3,0),angle),radius=.4,height=1.8;
  const foot=V(0,3+(.25+radius)/Math.cos(angle)-radius,0);
  close(capsuleBoxContact(foot,radius,height,box).depth,0);
  const target=foot.clone().add(V(0,.15,0)),position=target.clone(),velocity=V(0,5,0);
  const result=resolveCapsuleBoxMotion(position,foot,velocity,radius,height,box);
  assert.equal(result.grounded,false);closeVector(position,target,2e-4);closeVector(velocity,V(0,5,0));
 });
}

test('a held box can travel 200 metres parallel to a real face with .001 clearance',()=>{
 const {box}=fixture(V(120,.1,.5)),half=V(.2,.2,.2),start=V(-100,.301,0),target=V(100,.301,0);
 const corrected=constrainBoxToOrientedCollider(box,start,target,half,new THREE.Quaternion());
 closeVector(corrected,target);assert.equal(boxIntersectsOrientedCollider(box,bounds(corrected,half)),false);
});

test('a held box tiny inward slope finds its late real face despite 200 metre tangential travel',()=>{
 const {box}=fixture(V(120,.1,.5)),half=V(.2,.2,.2),start=V(-100,.301,0),target=V(100,.299,0);
 const corrected=constrainBoxToOrientedCollider(box,start,target,half,new THREE.Quaternion());
 close(corrected.x,100);close(corrected.y,.3001);close(corrected.z,0);
 assert.equal(boxIntersectsOrientedCollider(box,bounds(corrected,half)),false);
 closeVector(target,V(100,.299,0));
});

test('leaving a finite flat beam edge loses ground despite its earlier upward contact',()=>{
 const {box}=fixture(V(1,.25,.5)),previous=V(0,.25,0),position=V(3,.249,0),velocity=V(3,-.001,0);
 const result=resolveCapsuleBoxMotion(position,previous,velocity,.43,2.4,box);
 assert.ok(result.contacts>0,'the beginning of the step really touched the upper face');
 const final=capsuleBoxContact(position,.43,2.4,box);
 assert.ok(final.depth< -1.6,'the final capsule is far beyond the finite edge');
 close(final.distance,Math.hypot(position.x-1,position.y+.43-.25));
 assert.equal(orientedBoxSupport(box,position.x,position.z,10),null);
 assert.equal(result.grounded,false,'an earlier TOI cannot support the final position');
});

test('walking within a finite flat upper face keeps real ground with or without downward drift',()=>{
 const {box}=fixture(V(1,.25,.5));
 for(const dy of [0,-.001]){
  const previous=V(0,.25,0),position=V(.5,.25+dy,0),velocity=V(.5,dy,0);
  const result=resolveCapsuleBoxMotion(position,previous,velocity,.43,2.4,box);
  assert.equal(result.grounded,true);
  const final=capsuleBoxContact(position,.43,2.4,box);
  close(final.depth,0,2e-4);closeVector(final.normal,V(0,1,0));
  const support=orientedBoxSupport(box,position.x,position.z,position.y+.001);
  assert.ok(support);close(support.height,.25);
 }
});

for(const angle of [-Math.PI/6,Math.PI/6]){
 test(`walking within a real finite upper face at ${angle} radians stays grounded`,()=>{
  const {box}=fixture(V(1,.25,.5),V(),angle),radius=.43,height=2.4;
  const previous=V(0,(.25+radius)/Math.cos(angle)-radius,0);
  const tangent=V(1,0,0).applyQuaternion(Q(angle));
  const delta=tangent.clone().multiplyScalar(.25).add(V(0,-.001,0));
  const position=previous.clone().add(delta),velocity=delta.clone();
  const result=resolveCapsuleBoxMotion(position,previous,velocity,radius,height,box);
  assert.ok(result.contacts>0);assert.equal(result.grounded,true);
  const final=capsuleBoxContact(position,radius,height,box);
  close(final.depth,0,2e-4);closeVector(final.normal,V(0,1,0).applyQuaternion(Q(angle)));
  assert.ok(orientedBoxSupport(box,position.x,position.z,position.y+.1));
 });

 test(`leaving a finite upper face at ${angle} radians removes its earlier grounding`,()=>{
  const {box}=fixture(V(1,.25,.5),V(),angle),radius=.43,height=2.4;
  const previous=V(0,(.25+radius)/Math.cos(angle)-radius,0);
  const delta=V(1,0,0).applyQuaternion(Q(angle)).multiplyScalar(3).add(V(0,-.001,0));
  const position=previous.clone().add(delta),velocity=delta.clone();
  const result=resolveCapsuleBoxMotion(position,previous,velocity,radius,height,box);
  assert.ok(result.contacts>0);
  assert.ok(capsuleBoxContact(position,radius,height,box).depth< -.8);
  assert.equal(orientedBoxSupport(box,position.x,position.z,10),null);
  assert.equal(result.grounded,false);
 });
}

for(const fromAngle of [-.08,.08]){
 test(`a rotating finite beam sweep from ${fromAngle} radians cannot ground a departed player`,()=>{
  const toAngle=-fromAngle,{body,box}=fixture(V(1,.25,.5),V(),fromAngle),radius=.43,height=2.4;
  const previous=V(0,(.25+radius)/Math.cos(fromAngle)-radius,0);
  close(capsuleBoxContact(previous,radius,height,box).depth,0);
  body.quaternion.copy(Q(toAngle));body.angularVelocity.z=(toAngle-fromAngle)*120;
  syncOrientedBoxContact(box,body,1);
  const position=previous.clone().add(V(3,-.001,0)),velocity=V(3,-.001,0);
  const result=resolveCapsuleBoxMotion(position,previous,velocity,radius,height,box);
  assert.ok(result.contacts>0,'the rotating real upper face had a sweep contact');
  assert.ok(capsuleBoxContact(position,radius,height,box).depth< -1.5);
  assert.equal(orientedBoxSupport(box,position.x,position.z,10),null);
  assert.equal(result.grounded,false,'the final real shape is no longer under this player');
 });
}
