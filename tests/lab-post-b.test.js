import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runPostB} from '../src/game/LabPostJourneyB.js';
import {POST_B_SPECS} from '../src/game/LabPostCampaignB.js';

async function room(number){
 const game=await createHeadlessGame();
 game.chamberEdition='foundation';
 await game.selectLevel(number-1,false);
 return game;
}

const alternatives=new Map([
 [36,'prepare-light-first'],[37,'dispatch-cargo-first'],
 [38,'send-freight-early'],[39,'scout-first'],[40,'bridge-prepared-first'],
]);
for(let number=36;number<=40;number++)for(const route of [undefined,alternatives.get(number)]){
 test(`new room ${number}: ${route||'ordinary route'} physically reaches the shared exit`,async()=>{
  const game=await room(number),original=game.cargo,originalBody=game.physics.cargoBody.id;
  const report=await runV8Journey(game,{journeyOptions:route?{route}:{}});
  assert.equal(report.pass,true);
  assert.equal(game.state,'won');
  assert.equal(report.resets,0);assert.equal(report.respawns,0);
  assert.equal(game.cargo,original);assert.equal(game.physics.cargoBody.id,originalBody);
  assert.equal(game.firstLevel.id,POST_B_SPECS[number-36].id);
  assert.equal(game.firstLevel.puzzleGeometry.noProgressFlags,true);
  assert.ok(game.firstLevel.workshop.enclosed);
  assert.ok(game.firstLevel.workshop.decks.every(d=>d.maxX-d.minX>=8&&d.maxZ-d.minZ>=8));
 });
}

for(const number of [36,38,39])test(`new room ${number}: missed approach returns by built service route`,async()=>{
 const game=await room(number),originalBody=game.physics.cargoBody.id;
 const report=await runV8Journey(game,{journeyOptions:{recover:true}});
 assert.equal(report.pass,true);assert.equal(game.state,'won');
 assert.equal(report.resets,0);assert.equal(report.respawns,0);
 assert.equal(game.physics.cargoBody.id,originalBody);
 assert.ok(report.milestones.some(m=>/recover|missed|Lower floor/.test(m.name)));
});

test('36: first bridge alone cannot cross the actual gap to the last gallery',async()=>{
 const game=await room(36),l=game.firstLevel;
 const report=await runV8Journey(game,{scenario:d=>{
  runPostB(d,{stopAfterFirstBridge:true});
  assert.equal(game.state,'playing');
  assert.ok(game.heldCube,'The original companion must remain on the first island');
  const island=l.workshop.decks.find(deck=>deck.name==='Permanent relay island');
  const exit=l.workshop.decks.find(deck=>deck.name==='Exit receiving balcony');
  assert.ok(island.minZ-exit.maxZ>=10.9,'A running jump must not replace the second light route');
  d.walk(5,-34);
  assert.equal(game.state,'playing');
  assert.ok(game.playerGrounded&&game.playerPosition.y<1,'Attempted crossing must reach the lower recovery floor');
  assert.equal(l.light.segments.length>1,true,'First transverse bridge still exists');
 }});
 assert.equal(report.respawns,0);assert.equal(report.resets,0);
});

test('36: running jump with original companion cannot skip the perpendicular light bridge',async()=>{
 const game=await room(36);
 const report=await runV8Journey(game,{scenario:d=>{
  runPostB(d,{stopAfterFirstBridge:true});
  d.walk(5,-18);
  game.input.keys.add('ShiftLeft');game.input.jumpQueued=true;
  for(let n=0;n<145;n++){d.worldMove(0,-1);d.frame();}
  d.stop();
  assert.equal(game.state,'playing');
  assert.ok(game.heldCube,'The original companion was carried during the attempted shortcut');
  assert.ok(game.playerPosition.y<1,'The running jump must reach the physical service floor');
 }});
 assert.equal(report.respawns,0);assert.equal(report.resets,0);
});

test('40: closed shutter physically blocks held companion before plate is loaded',async()=>{
 const game=await room(40),l=game.firstLevel;
 const report=await runV8Journey(game,{scenario:d=>{
  runPostB(d,{stopBeforePlate:true});
  assert.equal(game.state,'playing');
  assert.ok(game.heldCube);assert.equal(l.plate.loaded(),false);
  assert.ok(l.shutter.position.y<9.1);
  assert.ok(game.colliders.includes(l.shutterCollider)&&l.shutterCollider.enabled!==false);
  assert.ok(new THREE.Box3().setFromObject(l.shutter).equals(l.shutterCollider.box));
  assert.throws(()=>d.walk(19,-17),/Blocked walking/);
  assert.ok(game.playerPosition.x<12&&game.playerPosition.y>5.8);
  assert.equal(game.state,'playing');
 }});
 assert.equal(report.respawns,0);assert.equal(report.resets,0);
});

test('38: manufactured walking decks have no overlapping coplanar top faces',async()=>{
 const game=await room(38),decks=game.firstLevel.workshop.decks;
 for(let i=0;i<decks.length;i++)for(let j=i+1;j<decks.length;j++){
  const a=decks[i],b=decks[j];
  if(Math.abs(a.y-b.y)>.001)continue;
  const overlapX=Math.min(a.maxX,b.maxX)-Math.max(a.minX,b.minX);
  const overlapZ=Math.min(a.maxZ,b.maxZ)-Math.max(a.minZ,b.minZ);
  assert.ok(overlapX<.001||overlapZ<.001,`${a.name} and ${b.name} would shimmer across ${overlapX} × ${overlapZ} m`);
 }
});

test('36–40: restarting after the exit restores cargo and physical mechanisms',async()=>{
 for(let number=36;number<=40;number++){
  const game=await room(number),l=game.firstLevel,body=game.physics.cargoBody.id;
  const report=await runV8Journey(game);
  assert.equal(report.pass,true);
  if(number===39){
   assert.equal(l.first.segments.length,1,'Rerouting extinguishes the first crossing');
   assert.ok(l.first.pieces.slice(1).every(p=>!p.mesh.visible&&!p.collider.enabled&&!p.floor.enabled));
   assert.ok(l.second.segments.length>1,'The final crossing uses the second projector');
  }
  game.resetRun(true);
  assert.equal(game.state,'playing',`Room ${number} remained won after restart`);
  assert.equal(game.physics.cargoBody.id,body,`Room ${number} replaced its companion`);
  assert.ok(game.cargo.position.distanceTo(new THREE.Vector3(...l.cargoSpawn))<.001);
  assert.equal(game.portals.ready,false);
  const lift=l.cabin||l.car||l.freight;
  if(lift)assert.ok(lift.at(0),`Room ${number} lift did not return to its starting station`);
  if(l.drive){assert.equal(l.drive.heights[0],0);assert.equal(l.drive.wheel.omega,0);}
  if(l.shutter){
   assert.equal(l.shutter.position.y,9);
   assert.ok(new THREE.Box3().setFromObject(l.shutter).equals(l.shutterCollider.box));
  }
  if(l.second)assert.equal(l.second.segments.length,1,'Second bridge remained connected after restart');
  game.updatePlaying(1/60);
  assert.equal(game.state,'playing',`Room ${number} won again immediately after restart`);
 }
});
