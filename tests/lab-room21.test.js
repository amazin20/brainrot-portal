import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {room21PrepareSource,room21RestoreWell,room21Climb} from '../src/game/LabRoom21Journey.js';
const game=await createHeadlessGame();await game.selectLevel(20,false);
after(()=>{game.physics.dispose();game.portals.dispose();});

for(const options of [{order:'cargo-first'},{order:'source-first'},{recovery:true},{launchOffset:-.35},{launchOffset:.35}])
 test(`rebuilt room21: complete ordinary route ${JSON.stringify(options)}`,async()=>{
  const r=await runV8Journey(game,{journeyOptions:options});
  assert.equal(r.pass,true);assert.equal(game.state,'won');assert.equal(game.firstLevel.isWon(),true);
  assert.equal(r.resets,0);assert.equal(r.respawns,0);assert.equal(r.teleports,options.recovery?3:2);
  const marks=r.milestones.map(m=>m.name),source=marks.findIndex(s=>s.includes('airflow docked')),
    freight=marks.findIndex(s=>s.includes('same cargo loads'));
  assert.ok(options.order==='source-first'?source<freight:freight<source);
  assert.equal(game.firstLevel.state.sourceDrive.latched,true);
  assert.equal(game.firstLevel.state.freightGuard.loaded,false);
  assert.ok(game.heldCube);assert.ok(game.playerPosition.y>19.9);
 });

test('the old cradle is not a secretly forbidden white surface: the whole freight tray is structural metal',()=>{
 game.resetRun(true);const surface=game.firstLevel.state.freightSeat.surface;
 assert.equal(surface.portal,false);assert.ok(!surface.mesh.userData.portalable);
 assert.ok(!game.portalPanels.includes(surface.mesh));
 let white=false;surface.group.traverse(o=>{if(o.userData.portalTile)white=true;});assert.equal(white,false);
 for(const p of Object.values(game.firstLevel.panels))assert.equal(p.mesh.userData.portalable,true,'Every actual ceramic remains eligible');
});

test('a camera ray along the previously demonstrated direct-cradle target hits a non-portal surface',()=>{
 // Narrow line-of-sight fixture: known player-side view and target, not a full route.
 game.resetRun(true);game.scene.updateMatrixWorld(true);
 const origin=new THREE.Vector3(-10,8.4,11.65),target=new THREE.Vector3(10.4,7.38,1.8),ray=new THREE.Raycaster(origin,target.sub(origin).normalize());
 const hit=ray.intersectObjects(game.aimBlockers,true).find(h=>game.isActiveBlocker(h.object)&&(h.object.visible||h.object.userData.collisionProxy));
 assert.ok(hit);assert.ok(!hit.object.userData.portalable);
});

test('new final ceramic is occluded from the sampled lower perimeter and source views, including its corners',()=>{
 game.resetRun(true);game.scene.updateMatrixWorld(true);
 const target=game.firstLevel.panels['second-rise'],f=target.getFrame(),ray=new THREE.Raycaster();
 const points=[];let rays=0;
 for(let x=-37;x<=39;x+=3)for(let z=-39;z<=23;z+=3)for(const y of [1.2,2.8,4])points.push(new THREE.Vector3(x,y,z));
 for(let x=-32;x<=3;x+=2)for(let z=11.5;z<=21;z+=2)for(const y of [8.2,10,19.2,20.8])points.push(new THREE.Vector3(x,y,z));
 for(const from of points)for(const u of [-2.4,0,2.4])for(const v of [-2.4,0,2.4]){
  const to=f.center.clone().addScaledVector(f.right,u).addScaledVector(f.up,v),dir=to.sub(from).normalize();
  if(dir.dot(f.normal)>=-.02)continue;rays++;ray.set(from,dir);
  const hit=ray.intersectObjects(game.aimBlockers,true).find(h=>game.isActiveBlocker(h.object)&&(h.object.visible||h.object.userData.collisionProxy));
  assert.notEqual(hit?.object,target.mesh,`Early face sight from ${from.toArray()} to corner ${u},${v}`);
 }
 assert.equal(rays,1888); // Declared finite matrix, never an exhaustive proof.
});

test('source bridge requires an actual air route and keeps its dock when both portals are removed',async()=>{
 await runV8Journey(game,{scenario:d=>{
  d.wait(4);assert.equal(d.level.state.sourceDrive.bridge.progress,0);
  room21PrepareSource(d);game.clearPortals();d.wait(4);
  assert.equal(d.level.state.sourceDrive.air,false);assert.equal(d.level.state.sourceDrive.latched,true);
  assert.ok(d.level.state.sourceDrive.bridge.position.y>6.99);
  room21Climb(d);assert.ok(game.playerPosition.y>17.9);
 }});
});

test('a carried first fling without parking the load meets the real closed guard',async()=>{
 await runV8Journey(game,{scenario:d=>{
  room21PrepareSource(d);room21RestoreWell(d);d.walk(-10,11.65);
  d.aim(1,d.level.panels['rising-out'].getFrame().center);
  d.walk(game.cargo.position.x+1,game.cargo.position.z);d.pickup();
  room21Climb(d);d.walk(-10,11.65);const before=game.teleportCount;
  for(let i=0;i<300&&game.playerGrounded;i++){d.worldMove(0,-.12);d.frame();}
  d.stop();d.until(()=>game.teleportCount>before,5,'Carried first transfer');
  d.until(()=>game.playerGrounded,8,'Closed guard recovery');
  assert.equal(game.state,'playing');assert.equal(d.level.state.freightGuard.progress,0);
  assert.ok(game.playerPosition.x<4);assert.ok(game.heldCube);
 }});
});

test('standing capsule still cannot fit the low freight mouth, with or without a jump',()=>{
 for(const jump of [false,true]){
  game.resetRun(true);game.playerPosition.set(3,7.4,3);game.previousPlayerPosition.copy(game.playerPosition);
  game.playerVelocity.set(7,jump?7.8:0,0);game.playerGrounded=!jump;const old=game.input.getMove;
  game.yaw=0;game.input.getMove=()=>new THREE.Vector2(1,0);
  try{for(let i=0;i<240;i++)game.updatePlaying(1/120);}finally{game.input.getMove=old;}
  assert.ok(game.playerPosition.x<3.3);assert.equal(game.firstLevel.isWon(),false);
 }
});

test('guard art and collision stay separate at every sampled actuator position',()=>{
 const l=game.firstLevel,gate=l.state.freightGuard,n=gate.mesh.children.length;
 for(const progress of [0,.2,.5,1]){
  gate.previous=gate.progress=progress;l.renderUpdate(1);
  const size=new THREE.Box3().setFromObject(gate.mesh).getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.y-12.2)<1e-5);assert.ok(Math.abs(size.z-12)<1e-5);
  assert.ok(l.authoredArt.getObjectByName('Load-controlled safety shutter').position.distanceTo(gate.mesh.position)<1e-8);
 }
 assert.equal(gate.mesh.children.length,n);game.resetRun(true);
});

test('first receiving niche is no longer the goal; real joint arrival is still sufficient without a stage checklist',()=>{
 game.resetRun(true);const l=game.firstLevel;
 game.playerPosition.set(14,12,-5);game.cargo.position.set(14,12.4,-5);game.playerGrounded=true;
 assert.equal(l.isWon(),false);
 game.playerPosition.copy(l.goal.position);assert.equal(l.isWon(),false);
 game.cargo.position.copy(l.goal.position).y+=.4;assert.equal(l.isWon(),true);
 game.playerGrounded=false;assert.equal(l.isWon(),false);
});

test('source gantry stays grounded while its accurate twelve-metre deck and ropes follow the slider',()=>{
 game.resetRun(true);const drive=game.firstLevel.state.sourceDrive,p=drive.presentation,bridge=drive.bridge;
 const before=new THREE.Box3().setFromObject(p.frame);
 assert.ok(Math.abs(before.min.y-.08)<1e-6);assert.ok(before.min.z>17);
 assert.equal(bridge.art.art.visible,false);assert.equal(game.firstLevel.state.freightSeat.surface.group.userData.keepMaterial,true);
 for(const y of [0,3.5,7]){
  bridge.group.position.y=y;p.render();game.scene.updateMatrixWorld(true);
  assert.ok(new THREE.Box3().setFromObject(p.frame).equals(before));
  const deck=new THREE.Box3().setFromObject(p.chassis);
  assert.ok(Math.abs(deck.max.y-(y-.1))<1e-5);
  for(const rope of p.ropes)assert.ok(Math.abs(rope.mesh.scale.y-(rope.top.y-y+.15))<1e-6);
 }
 game.resetRun(true);
});
