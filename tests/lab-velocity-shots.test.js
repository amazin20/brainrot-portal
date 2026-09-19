import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LabPortalShots, VELOCITY_SHOT_PROFILE } from '../src/game/LabPortalShots.js';

const V=(...values)=>new THREE.Vector3(...values);

// Real camera and swept mesh intersections; only portal installation is an
// observer so the tests isolate input latency and projectile lifetime.
function fixture(epicMode=true){
 const placements=[],events=[],fired=[],slots=[null,null];
 const g={epicMode,state:'playing',scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera(62,1,.1,500),
  playerPosition:V(0,.6,5),playerGrounded:false,facing:Math.PI,teleportCount:0,
  aimBlockers:[],colliders:[],portalPanels:[],isActiveBlocker:()=>true,
  audio:{shot:index=>fired.push(index)},
  firstLevel:{recordShot:(index,panel,data)=>events.push({index,panel,...data})},
  placeOnPanel(index,panel,point){const placement={index,panel,point:point.clone()};placements.push(placement);slots[index]=placement;return true;},
 };
 const emitter=new THREE.Object3D();emitter.position.set(0,2,5);g.scene.add(emitter);
 g.heldDevice={emitter,holsterProgress:0,fire(){}};
 g.portalShots=new LabPortalShots(g);
 const panel=(x,z,name='white panel',portalable=true)=>{
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(10,8,.02),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  mesh.position.set(x,2,z-.01);mesh.name=name;mesh.userData.portalable=portalable;mesh.userData.normal=V(0,0,1);
  g.scene.add(mesh);g.aimBlockers.push(mesh);if(portalable)g.portalPanels.push(mesh);return mesh;
 };
 const aim=(x,z)=>{g.camera.position.copy(emitter.position);g.camera.lookAt(V(x,2,z));g.camera.updateMatrixWorld(true);};
 const advance=(time,dt=1/120)=>{for(let elapsed=0;elapsed<time-1e-9;elapsed+=dt)g.portalShots.step(Math.min(dt,time-elapsed));};
 return {g,emitter,panel,aim,advance,placements,events,fired,slots};
}

test('velocity shot places a surface 190 m away within 125 ms with an actual visible projectile',()=>{
 const f=fixture(),target=f.panel(0,-185);f.aim(0,-185);
 assert.equal(f.g.portalShots.request(0),true);
 f.advance(.03);assert.equal(f.placements.length,0);assert.equal(f.g.portalShots.active.length,0);
 f.advance(.01);assert.equal(f.g.portalShots.active.length,1);assert.equal(f.g.portalShots.active[0].slot.group.visible,true);
 f.advance(.085);assert.equal(f.placements.length,1);assert.equal(f.slots[0].panel,target);
 assert.deepEqual(f.fired,[0]);assert.equal(f.events.length,1);assert.equal(f.events[0].wasAirborne,true);
 assert.ok(f.events[0].impactTime<=.125+1e-9);assert.ok(f.g.portalShots.pulses.length>0);
});

test('campaign retains its existing preparation, cooldown and projectile flight',()=>{
 const f=fixture(false);f.panel(0,0);f.aim(0,0);assert.equal(f.g.portalShots.request(0),true);
 assert.equal(f.g.portalShots.queue[0].delay,.23);assert.equal(f.g.portalShots.cooldown,.20);
 f.advance(.125);assert.equal(f.fired.length,0);assert.equal(f.placements.length,0);
 f.advance(.20);assert.equal(f.placements.length,1);
});

test('one rapid opposite-slot input preserves its clicked target and does not restart the first shot',()=>{
 const f=fixture(),left=f.panel(-8,0,'left'),right=f.panel(8,0,'right');
 f.aim(-8,0);assert.equal(f.g.portalShots.request(0),true);const first=f.g.portalShots.queue[0];
 f.aim(8,0);assert.equal(f.g.portalShots.request(1),true);assert.equal(first.delay,VELOCITY_SHOT_PROFILE.prepare);
 assert.equal(f.g.portalShots.request(0),false);f.aim(100,0);f.advance(.4);
 assert.deepEqual(f.fired,[0,1]);assert.equal(f.slots[0].panel,left);assert.equal(f.slots[1].panel,right);
 assert.equal(f.events.length,2);f.advance(1);assert.deepEqual(f.fired,[0,1]);
});

test('queued click crosses with the player; flying charge retains its pre-transit world path',()=>{
 const f=fixture(),entryRoom=f.panel(0,-185,'entry-room target'),exitRoom=f.panel(100,0,'exit-room target');
 f.aim(0,-185);assert.equal(f.g.portalShots.request(0),true);f.advance(.04);
 const flying=f.g.portalShots.active[0],start=flying.start.clone(),direction=flying.direction.clone();
 assert.equal(f.g.portalShots.request(1),true);
 f.g.playerPosition.x=100;f.emitter.position.x=100;f.g.teleportCount=1;f.aim(100,0);
 f.advance(.3);
 assert.deepEqual(flying.start,start);assert.deepEqual(flying.direction,direction);
 assert.equal(f.slots[0].panel,entryRoom);assert.equal(f.slots[1].panel,exitRoom);
 const event=f.events.find(e=>e.index===1);
 assert.equal(event.requestTeleportCount,0);assert.equal(event.launchTeleportCount,1);assert.equal(event.rebasedAfterTransit,true);
});

test('high projectile speed still strikes the first thin blocker and cannot place beyond 200 m',()=>{
 const f=fixture();f.panel(0,-185);const wall=f.panel(0,-60,'thin intervening wall',false);f.aim(0,-185);
 assert.equal(f.g.portalShots.request(0),true);f.advance(.25,.1);
 assert.equal(f.placements.length,0);assert.equal(f.g.portalShots.lastImpact.surface,wall.name);assert.equal(f.events.length,0);
 const far=fixture();far.panel(0,-201);far.aim(0,-201);far.g.portalShots.request(0);far.advance(.3);
 assert.equal(far.placements.length,0);assert.equal(far.g.portalShots.lastImpact.reason,'miss');
});

test('airborne metadata reflects the click, and pause cancels the extra buffered input',()=>{
 const f=fixture();f.panel(0,0);f.aim(0,0);f.g.playerGrounded=true;
 assert.equal(f.g.portalShots.request(0),true);f.g.playerGrounded=false;assert.equal(f.g.portalShots.request(1),true);
 f.g.state='paused';f.g.portalShots.step(.2);f.g.state='playing';f.advance(.4);
 assert.deepEqual(f.fired,[0]);assert.equal(f.events.length,1);assert.equal(f.events[0].wasAirborne,false);
 assert.equal(f.g.portalShots.buffered,null);
});
