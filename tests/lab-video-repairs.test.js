import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Quaternion,Vec3} from 'cannon-es';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {LabPhysics} from '../src/game/LabPhysics.js';
import {LabCompanionBehavior} from '../src/game/LabCompanionBehavior.js';
import {airAcceleration} from '../src/game/LabAirForces.js';
import {sweepBox} from '../src/game/LabSweep.js';
const V=(...p)=>new THREE.Vector3(...p),g=await createHeadlessGame();
await g.selectLevel(10,false);
function tick(n=1){for(let i=0;i<n;i++){g.updatePlaying(1/120);g.updatePlaying(1/120);g.updateVisuals(1/60,1);}}
function placeFixture(player,cargo){g.resetRun(true);g.playerPosition.fromArray(player);g.previousPlayerPosition.copy(g.playerPosition);if(cargo){g.physics.resetCargo(cargo);g.cargo.position.fromArray(cargo);g.companionBehavior.reanchor(g.cargo.position);}g.updateVisuals(0,1);}

test('video regression: sprint, jumps and fast alternating turns keep the same brainrot in both hands at 30/60/144 Hz',()=>{
 for(const fps of [30,60,144]){
  placeFixture([1.5,0,8.6]);g.facing=Math.PI;g.updateVisuals(0,1);g.interact();assert.equal(g.heldCube,g.cargo);
  const body=g.physics.cargoBody,geometry=g.assets.get(2);let accumulator=0,maxBody=0,maxHand=0;
  for(let frame=0;frame<fps*10;frame++){
   const time=frame/fps;
   if(time>1){g.input.keys.add('KeyW');g.input.keys.add('ShiftLeft');g.yaw=time<4?time*4:-time*6;}
   if(frame%Math.round(fps*.7)===0&&time>1)g.input.jumpQueued=true;
   accumulator+=1/fps;while(accumulator>=1/120){g.updatePlaying(1/120);accumulator-=1/120;}
   g.updateVisuals(1/fps,accumulator*120);
   assert.equal(g.heldCube,g.cargo,'Contacts must not secretly release the grip');assert.equal(g.physics.cargoBody,body);assert.equal(g.assets.get(2),geometry);
   if(time>1){const t=g.physics.carryTarget;maxBody=Math.max(maxBody,t.position.distanceTo(body.position));const h=g.animator.diagnostics.carryReach;maxHand=Math.max(maxHand,h.leftError||0,h.rightError||0);}
  }
  assert.ok(maxBody<.002,`${fps} Hz body lag ${maxBody}`);assert.ok(maxHand<.035,`${fps} Hz hand error ${maxHand}`);
 }
});

test('held wall and corner pressure stays on the near side, releases naturally and never resets the room',()=>{
 for(const angle of [0,Math.PI/4,Math.PI/2]){
  placeFixture([12,0,12],[12,.5,12.85]);g.facing=0;g.updateVisuals(0,1);g.interact();assert.equal(g.heldCube,g.cargo);tick(60);
  g.yaw=angle+Math.PI;g.input.keys.add('KeyW');g.input.keys.add('ShiftLeft');const body=g.physics.cargoBody;
  g.firstLevel.state.ratchet.engaged=true;
  for(let i=0;i<300;i++){if(i%41===0)g.input.jumpQueued=true;tick();assert.ok(g.cargo.position.x<13.65&&g.cargo.position.z<14.65);assert.equal(g.heldCube,g.cargo);assert.equal(g.firstLevel.state.ratchet.engaged,true);}
  g.input.keys.clear();g.interact();assert.equal(g.heldCube,null);tick(240);assert.equal(g.physics.cargoBody,body);assert.ok(g.cargo.position.y>-.1);assert.equal(g.firstLevel.state.ratchet.engaged,true);
 }
});

test('a toppled body makes standing room beside a wall instead of levering into it',()=>{
 for(const angle of [Math.PI/2,Math.PI]){
  const p=new LabPhysics();p.addStaticBox('floor',{min:[-8,-1,-8],max:[8,0,8]});p.addStaticBox('wall',{min:[0,0,-8],max:[.08,8,8]});
  const body=p.createCargo({position:[-.405,.43,0],quaternion:new Quaternion().setFromAxisAngle(new Vec3(0,0,1),angle)}),behavior=new LabCompanionBehavior(p);
  for(let i=0;i<120*10;i++){behavior.update(1/120,{onPad:true});p.step(1/120);assert.ok(body.position.x<-.25,'Body crossed the wall');}
  assert.ok(body.quaternion.vmult(new Vec3(0,1,0)).y>.94,`Still toppled ${angle}`);assert.equal(p.cargoBody,body);assert.equal(p.portalTransports,0);p.dispose();
 }
});

test('swept collision catches fast crossings but allows tangential motion and disabled portal backing',()=>{
 const min={x:0,y:0,z:-1},max={x:.04,y:4,z:1};
 assert.deepEqual(sweepBox({x:-2,y:1,z:0},{x:3,y:1,z:0},min,max),{axis:'x',sign:-1,t:.4});
 assert.equal(sweepBox({x:-2,y:1,z:0},{x:-2,y:1,z:5},min,max),null);
 const p=new LabPhysics(),body=p.createCargo({position:[-2,1,0]});p.addStaticBox('wall',{min:[0,0,-2],max:[.04,4,2]});
 for(let n=0;n<400;n++){body.velocity.set(80,0,1);p.step(1/120);if(Math.abs(body.position.z)<1.5)assert.ok(body.position.x<-.25);}
 p.resetCargo([-2,1,0]);p.setStaticEnabled('wall',false);for(let n=0;n<25;n++){body.velocity.set(20,0,0);p.step(1/120);}assert.ok(body.position.x>1);p.dispose();
});

test('air drag uses the finite physical path, portal direction and plume radius, not a visual-only effect',()=>{
 const segments=[{a:V(0,2,0),direction:V(1,0,0),length:4},{a:V(20,1,0),direction:V(0,1,0),length:6}];
 assert.ok(airAcceleration(segments,V(2,2,0),V()).x>0);
 assert.equal(airAcceleration(segments,V(7,2,0),V()).length(),0);
 assert.equal(airAcceleration(segments,V(2,8,0),V()).length(),0);
 assert.ok(airAcceleration(segments,V(20,4,0),V()).y>19.5);
 assert.equal(airAcceleration(segments,V(2,2,0),V(),{strength:0}).length(),0);
 assert.ok(airAcceleration(segments,V(2,2,0),V(25,0,0)).x<0,'Drag cannot accelerate a body already faster than the air');
});

test('room eleven wind moves the real grounded player and unheld companion',()=>{
 placeFixture([-2,0,4],[-2,.4,2]);g.firstLevel.state.blower.enabled=true;const playerX=g.playerPosition.x;tick(75);assert.ok(g.playerPosition.x>playerX+1,'Player was not blown sideways');
 placeFixture([-2,0,8],[-2,.4,4]);g.firstLevel.state.blower.enabled=true;const body=g.physics.cargoBody,x=g.cargo.position.x;tick(150);assert.ok(g.cargo.position.x>x+1,'Grounded friend was not blown');assert.equal(g.physics.cargoBody,body);
});

test('portal shots have wind-up and travel, animate the shooter, and never enable camera aim',()=>{
 placeFixture([-1,0,8]);g.camera.position.set(-1,1.8,8);g.camera.lookAt(13.975,2.1,4);g.camera.updateMatrixWorld(true);
 const view=g.camera.quaternion.clone();assert.equal(g.firePortal(0),true);assert.equal(g.portals.portals[0],null);assert.equal(g.portalShots.diagnostics.pending,1);
 assert.equal(g.isAiming(),false);tick(6);assert.equal(g.portals.portals[0],null,'Portal appeared before the charge left the gun');
 tick(75);assert.equal(g.portalShots.lastImpact?.valid,true);assert.ok(g.portals.portals[0]);assert.equal(g.isAiming(),false);
 assert.ok(Number.isFinite(g.facing));assert.ok(view.toArray().every(Number.isFinite));
});

test('invalid shots visibly impact, preserve the old portal and cannot spawn beyond a wall touched by the muzzle',()=>{
 placeFixture([-1,0,8]);const panel=g.firstLevel.panels['work-left'];assert.ok(g.placeOnPanel(0,panel.mesh,panel.getFrame().center));const old=g.portals.portals[0];
 g.camera.position.set(0,2,8);g.camera.lookAt(0,7,-12);g.camera.updateMatrixWorld(true);assert.ok(g.firePortal(0));tick(90);
 assert.equal(g.portalShots.lastImpact.valid,false);assert.equal(g.portals.portals[0],old);
 // Adversarial muzzle pose, never a positive walkthrough: shoulder is west of
 // the wall, muzzle is east. This must hit the near side, not shoot through it.
 g.portalShots.reset();const muzzle=g.heldDevice.emitter,original=muzzle.getWorldPosition;
 g.playerPosition.set(13.5,0,4);muzzle.getWorldPosition=out=>out.set(14.8,1.4,4);
 g.portalShots.serial[1]=1;g.portalShots.launch({index:1,sequence:1,point:V(16,1.4,4)});g.portalShots.step(.02);
 muzzle.getWorldPosition=original;assert.ok(g.portalShots.lastImpact);assert.ok(g.portalShots.lastImpact.position[0]<14.1,'Shot spawned beyond the wall');
});

test('shot queues are bounded, render-only updates freeze travel and reset clears every charge',()=>{
 placeFixture([-1,0,8]);g.camera.position.set(-1,1.8,8);g.camera.lookAt(13.975,2.1,4);g.camera.updateMatrixWorld(true);assert.ok(g.firePortal(0));
 assert.equal(g.firePortal(1),false,'Rate limit missing');const t=g.portalShots.time;for(let n=0;n<80;n++)g.portalShots.render(.5);assert.equal(g.portalShots.time,t);
 g.resetRun(true);assert.deepEqual(g.portalShots.diagnostics,{pending:0,flying:0,lastImpact:null});assert.ok(g.portalShots.pool.every(p=>!p.group.visible));
});

test('automatic receiving drive has no second terminal and the normal route opens it using real travelling shots',async()=>{
 const {runV8Journey}=await import('../src/game/LabV8Journey.js');g.resetRun(true);assert.equal(g.firstLevel.terminals.length,1);assert.equal(g.firstLevel.state.clutchControl,undefined);
 const r=await runV8Journey(g);assert.ok(r.pass);assert.equal(r.resets,0);assert.equal(r.respawns,0);assert.ok(g.firstLevel.state.ratchet.engaged);
 g.physics.dispose();g.portals.dispose();
});
