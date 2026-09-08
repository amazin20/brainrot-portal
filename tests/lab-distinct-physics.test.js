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
 await g.selectLevel(6,false);g.resetRun(true);const l=g.firstLevel,s=l.state;s.counterIndex=2;
 // The shorter counterweight arm takes longer to raise the unloaded deck.
 // Still compare the cargo box and the player plane at a substantial tilt.
 step(480);
 const f=g.floors.find(f=>f.heightAt),p=g.physics.solids.get(s.collider.mesh.uuid).body;
 assert.ok(s.angle>.2);const q=s.bridge.getWorldQuaternion(new THREE.Quaternion());assert.ok(Math.abs(new THREE.Quaternion().copy(p.quaternion).dot(q))>.99999);
 for(const z of [-8,0,8])assert.ok(Math.abs(f.heightAt(0,z)-(s.bridge.position.y+s.surfaceOffset/Math.cos(s.angle)-Math.tan(s.angle)*z))<1e-8);
 assert.equal(f.heightAt(3,0),null);
});
test('fan is a sustained force, not a scripted launch, and fully stops after rotor coast',async()=>{
 await g.selectLevel(7,false);g.resetRun(true);const l=g.firstLevel;
 assert.equal(l.playerAcceleration(V(0,0,0),V()).lengthSq(),0);assert.equal(l.getLaunch(V()),null);
 l.state.enabled=true;for(let n=0;n<120;n++)l.update(1/120);assert.ok(l.playerAcceleration(l.state.airOrigin.clone().add(V(1,-1.1,0)),V()).x>19.5);
 assert.equal(l.playerAcceleration(V(-5,1,0),V()).lengthSq(),0);l.state.enabled=false;
 for(let n=0;n<360;n++)l.update(1/120);
 assert.equal(l.playerAcceleration(l.state.airOrigin.clone().add(V(1,-1.1,0)),V()).lengthSq(),0);
});
test('weak resting load cannot latch the spring cup; a real drop can',async()=>{
 await g.selectLevel(8,false);const p=g.firstLevel.state.piston;
 const trial=height=>{g.resetRun(true);cargoAt(V(0,height,-5));let peak=0;for(let n=0;n<480;n++){g.updatePlaying(1/120);peak=Math.max(peak,p.compression);}return {latched:p.latched,peak};};
 const weak=trial(p.restY+.54),strong=trial(p.restY+6.35);assert.equal(weak.latched,false);assert.ok(strong.latched,JSON.stringify({weak,strong}));
 g.resetRun(true);assert.equal(p.latched,false);assert.equal(p.body.type,1);assert.ok(Math.abs(p.body.position.y-p.restY)<1e-8);
});
test('physical crane pulls the same cargo with force and never assigns its position',async()=>{
 await g.selectLevel(13,false);g.resetRun(true);const l=g.firstLevel,b=g.physics.cargoBody,id=b.id,before=b.position.clone(),c=l.state.crane;
 c.attached=true;l.applyCargoForces(1/120);assert.ok(b.force.y>0);assert.deepEqual(b.position,before);
 b.force.setZero();g.heldCube=g.cargo;l.applyCargoForces(1/120);assert.equal(b.force.lengthSquared(),0);assert.equal(b.id,id);g.heldCube=null;
 assert.equal(l.playerAcceleration,undefined);assert.equal(l.state.direction,undefined,'Retired remote vector UI is not active');
});
test('sealed claw well prevents pickup through its glass cover',async()=>{
 await g.selectLevel(13,false);g.resetRun(true);g.playerPosition.set(-5,0,-.1);g.previousPlayerPosition.copy(g.playerPosition);g.interact();assert.equal(g.heldCube,null);
});
test('calibration cabin cannot be entered by walking around any of its four sides',async()=>{
 await g.selectLevel(5,false);
 for(const [start,dir]of [[[-11,0,-4.5],[1,0]],[[-3,0,-4.5],[-1,0]],[[-8,0,0],[0,-1]],[[-8,0,-8.7],[0,1]]])for(const jump of [false,true]){
  g.resetRun(true);g.playerPosition.fromArray(start);g.previousPlayerPosition.copy(g.playerPosition);g.playerGrounded=true;g.yaw=0;
  g.input.getMove=()=>new THREE.Vector2(...dir);g.input.jumpQueued=jump;g.input.keys.add('ShiftLeft');
  for(let n=0;n<360;n++){g.updatePlayer(1/120);const p=g.playerPosition;assert.ok(!(p.x> -9.65&&p.x< -5.4&&p.z> -6.5&&p.z< -2.5),'cabin bypass');}
 }
});
test('vertical piston has matching player, camera and cargo obstruction',async()=>{
 await g.selectLevel(8,false);g.resetRun(true);const p=g.firstLevel.state.piston;
 assert.ok(g.colliders.includes(p.collider));assert.ok(g.cameraBlockers.includes(p.top));
 p.body.position.y-=.30;p.render();assert.ok(Math.abs(p.collider.box.getCenter(V()).y-p.body.position.y)<1e-9);
 assert.ok(Math.abs(p.floor.y-(p.body.position.y+.11))<1e-9);
});
test('optical and impact doors start closed; restarting clears actuator state',async()=>{
 for(const i of [5,8]){await g.selectLevel(i,false);g.resetRun(true);assert.equal(g.firstLevel.state.door.open,false);assert.equal(g.firstLevel.isWon(),false);}
 g.physics.dispose();g.portals.dispose();
});
