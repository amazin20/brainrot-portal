import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {cargoLoadsPlate} from '../src/game/LabPlateContact.js';
import {V,tracePortalRay,rayTouches,integrateBalance} from '../src/game/LabPuzzleMechanics.js';
import {makePortalFrame} from '../src/game/LabPortals.js';
const g=await createHeadlessGame();
const step=(n=60)=>{for(let i=0;i<n;i++)g.updatePlaying(1/120);};
function cargoAt(p){g.physics.resetCargo({position:p});g.cargo.position.copy(p);g.cargo.velocity.set(0,0,0);g.cargo.quaternion.identity();}

test('real pressure inset detects eight edges/corners and centre, not only its old radius',async()=>{
 await g.selectLevel(1,false);const pad=g.firstLevel.pads[0];
 for(const x of [-1,0,1])for(const z of [-1,0,1]){
  g.resetRun(true);const f=pad.mechanism.getLoadFrame();const at=f.center.clone().addScaledVector(f.right,x*(f.halfWidth-.38)).addScaledVector(f.up,z*(f.halfHeight-.38)).addScaledVector(f.normal,.43);
  cargoAt(at);step(180);assert.equal(pad.pressed,true,`edge ${x},${z} not active`);
  assert.ok(pad.progress>.9);assert.equal(g.firstLevel.gates[0].opened,true);
 }
});
test('contact rejects hovering, carried load and the stationary frame, including rotated boxes',async()=>{
 await g.selectLevel(1,false);const f=g.firstLevel.pads[0].mechanism.getLoadFrame();
 const cargo={position:f.center.clone().addScaledVector(f.normal,.39),velocity:V(),quaternion:new THREE.Quaternion()};
 assert.ok(cargoLoadsPlate(cargo,false,f));assert.equal(cargoLoadsPlate(cargo,true,f),false);
 cargo.position.addScaledVector(f.normal,.3);assert.equal(cargoLoadsPlate(cargo,false,f),false);
 cargo.position.copy(f.center).addScaledVector(f.normal,.39).addScaledVector(f.right,f.halfWidth+.5);assert.equal(cargoLoadsPlate(cargo,false,f),false);
 cargo.quaternion.setFromAxisAngle(V(0,1,0),Math.PI/4);cargo.position.copy(f.center).addScaledVector(f.normal,.39).addScaledVector(f.right,f.halfWidth-.1);
 assert.ok(cargoLoadsPlate(cargo,false,f));cargo.velocity.y=2;assert.equal(cargoLoadsPlate(cargo,false,f),false);
});
test('a plate loaded at an outer corner releases when the actual load is removed',async()=>{
 await g.selectLevel(1,false);g.resetRun(true);const p=g.firstLevel.pads[0],f=p.mechanism.getLoadFrame();
 cargoAt(f.center.clone().addScaledVector(f.right,1.75).addScaledVector(f.up,1.75).addScaledVector(f.normal,.42));step(150);assert.ok(p.pressed);
 cargoAt(V(3,.5,12));step(180);assert.equal(p.pressed,false);assert.equal(g.firstLevel.gates[0].opened,false);
});
test('ray transport uses actual portal transforms, then mirror reflection',()=>{
 const a=makePortalFrame(V(3,1,0),V(-1,0,0)),b=makePortalFrame(V(0,1,4),V(0,0,1));
 const ps=[a,b];
 const fake={colliders:[],portals:{ready:true,portals:ps}};
 const reflector={position:V(0,1,7),normal:V(1,0,-1).normalize(),radius:.8};
 const path=tracePortalRay(fake,V(0,1,0),V(1,0,0),{reflectors:[reflector],length:20});
 assert.equal(path[0].kind,'portal');assert.equal(path[1].kind,'mirror');assert.ok(path[2].direction.x>.99);
 assert.ok(rayTouches(path,V(4,1,7)));assert.equal(rayTouches(path,V(-4,1,7)),false);
});
test('opaque objects stop both media; closed glass passes light but stops air',()=>{
 const c={enabled:true,box:new THREE.Box3(V(2,-1,-1),V(2.2,1,1)),opticallyTransparent:true};
 const fake={colliders:[c],portals:{ready:false}};
 assert.equal(tracePortalRay(fake,V(),V(1,0,0),{medium:'air'})[0].kind,'wall');
 assert.equal(tracePortalRay(fake,V(),V(1,0,0))[0].kind,'end');c.opticallyTransparent=false;
 assert.ok(Math.abs(tracePortalRay(fake,V(),V(1,0,0))[0].length-2)<1e-8);
});
test('moment of force changes with sign and arm length, with bounded damped motion',()=>{
 const a={angle:0,omega:0},b={angle:0,omega:0},c={angle:0,omega:0};
 for(let n=0;n<120;n++){integrateBalance(a,40,1/120);integrateBalance(b,80,1/120);integrateBalance(c,-80,1/120);}
 assert.ok(a.angle>0&&b.angle>a.angle);assert.ok(Math.abs(b.angle+c.angle)<1e-9);
 for(let n=0;n<2400;n++)integrateBalance(b,0,1/120);assert.ok(Math.abs(b.angle)<.003);
});
test('balance deck physical shape and player support refer to the same rotated plane',async()=>{
 await g.selectLevel(6,false);g.resetRun(true);const l=g.firstLevel,s=l.state;s.counterIndex=2;step(180);
 const f=g.floors.find(f=>f.heightAt),p=g.physics.solids.get(s.collider.mesh.uuid).body;
 assert.ok(s.angle>.2);const q=s.bridge.getWorldQuaternion(new THREE.Quaternion());assert.ok(Math.abs(new THREE.Quaternion().copy(p.quaternion).dot(q))>.99999);
 for(const z of [-8,0,8])assert.ok(Math.abs(f.heightAt(0,z)-(2.2-Math.tan(s.angle)*z))<1e-8);
 assert.equal(f.heightAt(3,0),null);
});
test('fan is a sustained force, not a scripted launch, and no force survives switching it off',async()=>{
 await g.selectLevel(7,false);g.resetRun(true);const l=g.firstLevel;
 assert.equal(l.playerAcceleration(V(0,0,0),V()).lengthSq(),0);assert.equal(l.getLaunch(V()),null);
 l.state.enabled=true;l.update(1/120);assert.ok(l.playerAcceleration(V(-5,1,7),V()).x>19.5);
 assert.equal(l.playerAcceleration(V(-5,1,0),V()).lengthSq(),0);l.state.enabled=false;l.update(1/120);assert.equal(l.playerAcceleration(V(-5,1,7),V()).lengthSq(),0);
});
test('weak and strong direct physical impacts differ without assigning piston success',async()=>{
 await g.selectLevel(8,false);const l=g.firstLevel,p=l.state.piston;
 const trial=speed=>{g.resetRun(true);cargoAt(V(0,.42,-7.05));g.physics.cargoBody.velocity.z=-speed;g.cargo.velocity.z=-speed;
  let peak=0;for(let n=0;n<360;n++){g.updatePlaying(1/120);peak=Math.max(peak,p.compression);}return {latched:p.latched,peak};};
 const weak=trial(2),strong=trial(12);assert.equal(weak.latched,false);assert.ok(strong.latched,JSON.stringify({weak,strong}));
 g.resetRun(true);assert.equal(p.latched,false);assert.equal(p.body.type,1);assert.ok(Math.abs(p.body.position.z-p.restZ)<1e-8);
});
test('vector field applies forces to the same companion but never to a held load or player',async()=>{
 await g.selectLevel(9,false);g.resetRun(true);const l=g.firstLevel,b=g.physics.cargoBody,id=b.id;const before=b.position.clone();
 l.state.enabled=true;l.applyCargoForces(1/120);assert.ok(b.force.x>0);assert.deepEqual(b.position,before);
 b.force.setZero();l.state.direction=1;l.applyCargoForces(1/120);assert.ok(b.force.z<0);assert.equal(l.playerAcceleration,undefined);
 b.force.setZero();g.heldCube=g.cargo;l.applyCargoForces(1/120);assert.equal(b.force.lengthSquared(),0);assert.equal(b.id,id);g.heldCube=null;
});
test('low glass cover prevents retrieving the companion directly from the upper walkway',async()=>{
 await g.selectLevel(9,false);g.resetRun(true);g.playerPosition.set(-6,3,6);g.previousPlayerPosition.copy(g.playerPosition);g.interact();assert.equal(g.heldCube,null);
});
test('optical and impact doors start closed; restarting clears actuator state',async()=>{
 for(const i of [5,8]){await g.selectLevel(i,false);g.resetRun(true);assert.equal(g.firstLevel.state.door.open,false);assert.equal(g.firstLevel.isWon(),false);}
 g.physics.dispose();g.portals.dispose();
});
