import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {ROOM21_SPEC} from '../src/game/LabPortalRoom21.js';
import {installRoom21Aim} from '../src/game/LabRoom21Journey.js';
import {runV8Journey} from '../src/game/LabV8Journey.js';
const g=await createHeadlessGame();
// Model cache intentionally contains ONLY this room's declared dependencies.
for(const id of g.assets.keys())if(!ROOM21_SPEC.assets.includes(id))g.assets.delete(id);
await g.selectLevel(20,false);
after(()=>{g.physics.dispose();g.portals.dispose();});
for(const opts of [{order:'cargo-first'},{order:'brake-first'},{recovery:true},{offset:-.3},{offset:.3}])
 test(`new cassette room full ordinary journey ${JSON.stringify(opts)}`,async()=>{
  let anchor,lowY;const r=await runV8Journey(g,{journeyOptions:opts,onMilestone:m=>{
   if(m.name.startsWith('move only')){anchor=g.portals.portals[1].surfaceId;lowY=g.portals.portals[1].position.y;}
   if(m.name.startsWith('lower service fall')){assert.equal(g.portals.portals[1].surfaceId,anchor);assert.ok(Math.abs(g.portals.portals[1].position.y-lowY-12)<1e-6);}
  }});
  assert.equal(r.pass,true);assert.equal(g.state,'won');assert.equal(r.resets,0);assert.equal(r.respawns,0);assert.equal(r.teleports,4);
  assert.equal(g.firstLevel.state.cargoSeat.loaded(),false);assert.ok(g.heldCube);
  assert.equal(g.firstLevel.cassette.height,g.firstLevel.cassette.high);
 });
test('reset preserves one original cargo and returns brake and cassette to their actual initial configuration',()=>{
 const id=g.physics.cargoBody.id;for(let i=0;i<10;i++){g.resetRun(true);const c=g.firstLevel.cassette;assert.equal(c.braked,true);assert.equal(c.height,c.high);assert.equal(g.physics.cargoBody.id,id);assert.equal(g.firstLevel.isWon(),false);}
});
test('only five ceramic faces remain, no fan/turbine/bridge/second-launch apparatus',()=>{
 const l=g.firstLevel;assert.equal(g.portalPanels.length,5);assert.equal(l.fixtures.length,0);
 assert.equal(l.state.sourceDrive,undefined);assert.equal(l.state.freightGuard,undefined);
 assert.equal(l.state.cargoSeat.surface.portal,false);
 for(const p of Object.values(l.panels))assert.equal(p.mesh.userData.portalable,true);
});
test('cassette local transform, collision bounds and portal frame agree after repeated fixed ticks and render interpolation',()=>{
 g.resetRun(true);const c=g.firstLevel.cassette,local=c.face.mesh.position.clone();c.toggleBrake();
 for(let i=0;i<500;i++){g.updatePlaying(1/120);g.updateVisuals(1/120,1);assert.ok(c.face.mesh.position.distanceTo(local)<1e-10);assert.ok(c.face.collider.box.equals(new THREE.Box3().setFromObject(c.face.mesh)));}
 assert.equal(c.height,c.high); // Empty receiver cannot drive the panel down.
});
test('goal still requires actual joint grounded arrival; no checklist creates a win',()=>{
 g.resetRun(true);const l=g.firstLevel;g.playerPosition.copy(l.goal.position);g.playerGrounded=true;assert.equal(l.isWon(),false);
 g.cargo.position.copy(l.goal.position).y+=.4;assert.equal(l.isWon(),true);
 g.playerGrounded=false;assert.equal(l.isWon(),false);
});

test('missed cargo on the lower floor is recovered and carried up the open return stair without a reset',async()=>{
 const r=await runV8Journey(g,{scenario:d=>{
  installRoom21Aim(d);d.walk(g.cargo.position.x+1,g.cargo.position.z);d.pickup();
  d.walk(0,12);d.walk(0,7.85);d.wait(.4);g.interact();d.wait(4);
  assert.ok(g.cargo.position.y<1,'Miss must really reach the recovery basin');
  d.walk(-10,17.5);d.walk(-17,17.5);d.walk(-17,0);d.walk(0,0);
  d.walk(g.cargo.position.x-.8,g.cargo.position.z);d.pickup();
  d.walk(0,0);d.walk(-17,0);d.walk(-17,17.5);d.walk(-10,17.5);
  assert.ok(g.playerPosition.y>9.9);assert.ok(g.heldCube);
 }});
 assert.equal(r.resets,0);assert.equal(r.respawns,0);
});
