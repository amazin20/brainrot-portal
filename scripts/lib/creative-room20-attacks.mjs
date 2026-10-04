import assert from 'node:assert/strict';
import * as THREE from 'three';
import {installRoom21Aim} from '../../src/game/LabRoom21Journey.js';
import {runCreative20,creative20Floor,creative20Inspect,creative20Descend} from '../../src/game/LabCreativeRoom20Journey.js';
const V=(...p)=>new THREE.Vector3(...p);
function collect(d){const c=d.game.cargo.position;d.walk(c.x+1.2,c.z);d.pickup();}
function rush(d,x,z,seconds=3,{jump=true}={}){
 const g=d.game;g.input.keys.add('ShiftLeft');
 for(let n=0;n<seconds*60;n++){
  const delta=V(x,0,z).sub(g.playerPosition);delta.y=0;delta.normalize();d.worldMove(delta.x,delta.z);
  if(jump&&n%35===0)g.input.jumpQueued=true;d.frame();
 }
 d.stop();
}
function closed(d,label){assert.ok(d.level.rope.opening<.05,label);assert.equal(d.game.state,'playing');}
async function pair(d){await runCreative20(d,{stopAt:'pair-prepared'});}
async function hanging(d){await runCreative20(d,{stopAt:'cargo-hanging'});}
function cargoRelease(d){d.walk(-9,24);d.look(V(-9,2,10));d.walk(-9,19.25);d.wait(.4);assert.ok(d.game.interact());assert.equal(d.game.heldCube,null);d.wait(.7);}
export const creative20Attacks=[
 {name:'20 held companion cannot traverse the genuinely small floor-to-weight aperture',async run(d){
  await pair(d);collect(d);d.walk(-9,22);
  const point=d.game.portals.portals.find(p=>p.surfaceId===d.level.feed.surface.mesh.uuid).position;
  for(let n=0;n<240;n++){d.worldMove(0,n%120<60?-1:1);if(n%24===0)d.game.input.jumpQueued=true;d.frame();}d.stop();
  assert.equal(d.game.teleportCount,0);assert.ok(d.game.heldCube);assert.ok(d.game.playerPosition.z>0);closed(d,'Held cargo and player must leave the low freight gate closed');
  d.mark('held crossing crosses the actual loading footprint; small far aperture rejects the capsule');
 }},
 {name:'20 real held scaffold endpoints cannot reach the finite far cable end',async run(d){
  await pair(d);collect(d);d.walk(-15,28.5);d.walk(-21,28.5);d.walk(-21,19);d.walk(-21,8);
  for(const [x,z]of [[-23.5,6],[-13.5,6],[-13.5,15.5],[-23.5,15.5],[-16,6]]){d.walk(x,z);d.look(d.level.outlet.getFrame().center);d.wait(.35);closed(d,'No held scaffold corner can tension the remote finite cable');}
  assert.ok(d.game.heldCube);assert.equal(d.game.physics.portalTransports,0);assert.equal(d.game.teleportCount,0);
  const p=d.level.rope.currentPath();assert.ok(!p||p.length>d.level.rope.length+d.level.rope.maxExtension,'A current geometrically clear near endpoint must still be beyond the physical end reach');
 }},
 {name:'20 a single floor address does not deliver the original body or provide cable tension',run(d){
  installRoom21Aim(d);creative20Floor(d);collect(d);cargoRelease(d);d.wait(3);
  assert.equal(d.game.physics.portalTransports,0);assert.ok(d.game.cargo.position.z>0);closed(d,'One source does not make a cable path');
 }},
 {name:'20 remote ceramic and held near cargo alone cannot open a physical return shutter',run(d){
  installRoom21Aim(d);creative20Inspect(d);creative20Descend(d);collect(d);rush(d,3,0,4);closed(d,'A remote outlet without its source leaves the real spring closed');
  assert.equal(d.game.physics.portalTransports,0);assert.ok(d.game.playerPosition.z>.4);
 }},
 {name:'20 cargo release on an erased source remains on its true manufactured plate',async run(d){
  await pair(d);d.game.clearPortals();collect(d);cargoRelease(d);d.wait(2);rush(d,2,-4,4);
  assert.equal(d.game.physics.portalTransports,0);assert.ok(d.game.cargo.position.z>0);closed(d,'Missing apertures cannot fake the hanging load');
 }},
 {name:'20 erasing a live hanging pair restores the real cutset before a sprinting entry',async run(d){
  await hanging(d);d.game.clearPortals();d.wait(3);closed(d,'Uncoupled spring must shut the door');
  d.walk(2,6);rush(d,2,-5,4);assert.ok(d.game.playerPosition.z>.4);assert.equal(d.level.rope.pinTravel,0);assert.ok(d.game.cargo.position.z< -8);
 }},
 {name:'20 sprinting recovery without the retaining finger cannot outrun the closing doorway',async run(d){
  await hanging(d);d.walk(2,7);d.walk(2,-3);d.walk(9,-12);d.walk(-7,-12);d.walk(-12,-14);
  // Keep the live pair: this attacks the stronger shortcut where a held body
  // initially retains some tension, rather than voluntarily erasing it first.
  const c=d.game.cargo.position;d.walk(c.x+1.2,Math.max(c.z,-20.25));d.pickup();
  d.game.input.keys.add('ShiftLeft');d.walk(-12,-14);d.walk(-7,-14);d.walk(16,-3);
  rush(d,16,6,4);assert.equal(d.level.rope.pinTravel,0);assert.equal(d.game.state,'playing');assert.ok(d.game.playerPosition.z< .2,'Same body cannot return through an unretained door');assert.ok(d.game.heldCube);
 }},
];
export const creative20EarlyAttacks=[
 {name:'20 early paired sightlines without freight cannot replace gravity work',async run(d){
  await pair(d);d.walk(2,7);rush(d,2,-5,4);closed(d,'A prepared empty pair performs no work');assert.ok(d.game.playerPosition.z>.4);
 }},
 {name:'20 early double slit physically rejects sprinting and jumping with the original cargo',async run(d){
  await pair(d);collect(d);d.walk(-15,28.5);d.walk(-21,28.5);d.walk(-21,19);d.walk(-21,8);d.walk(-16,5.5);
  rush(d,-16,-10,4);assert.ok(d.game.playerPosition.z>.4);assert.ok(d.game.heldCube);assert.equal(d.game.teleportCount,0);closed(d,'64 cm sight slit cannot hand-feed a 78 cm rigid body');
 }},
 {name:'20 early cargo-bearing run around both actual partition ends remains inside the entry court',run(d){
  collect(d);d.walk(-12,5);rush(d,-27,-10,4);assert.ok(d.game.playerPosition.z>.4);d.walk(-12,5);rush(d,27,-10,5);assert.ok(d.game.playerPosition.z>.4);
  d.walk(3,5);rush(d,16,23,4);assert.ok(d.game.playerPosition.x<7.5,'The court divider must block the tempting near-side joint exit');closed(d,'Full-height enclosed partition has no outside skirt');assert.ok(d.game.heldCube);
 }},
];

// Additional production-input aperture-offset probes keep the shared finite
// seven-case registry stable while covering both diagonal extreme addresses.
export async function creative20HeldOffset(d,sourceOffset,exitOffset){
 installRoom21Aim(d);d.walk(-9,24);d.aim(0,d.level.feed.surface.getFrame().center.clone().add(V(sourceOffset,0,0)));
 creative20Inspect(d);d.aim(1,d.level.outlet.getFrame().center.clone().add(V(exitOffset,0,0)));creative20Descend(d);
 collect(d);d.walk(-15,28.5);d.walk(-21,28.5);d.walk(-21,19);d.walk(-21,8);
 for(const [x,z]of [[-23.5,6],[-13.5,6],[-13.5,15.5],[-23.5,15.5]]){d.walk(x,z);d.look(d.level.outlet.getFrame().center);d.wait(.4);closed(d,'Offset active apertures cannot give a held near endpoint the missing finite cable reach');}
 assert.ok(d.game.heldCube);assert.equal(d.game.physics.portalTransports,0);assert.equal(d.game.teleportCount,0);
}
