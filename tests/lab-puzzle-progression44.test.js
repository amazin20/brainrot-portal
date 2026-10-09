import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runPuzzleProgression44} from '../src/game/LabPuzzleProgression44Journey.js';
import {installPreciseLateAim,aimLateSurface} from '../src/game/LabLateCampaignAim.js';
let shared;
async function room(){shared??=await createHeadlessGame();shared.chamberEdition='foundation';shared.puzzleProgression=true;await shared.selectLevel(43,false);assert.equal(shared.firstLevel.progression44,true);return shared;}
test('progression44 real route uses original cargo and three physical bridge directions',async()=>{
 const g=await room(),cargo=g.cargo,body=g.physics.cargoBody;
 const r=await runV8Journey(g,{scenario:d=>runPuzzleProgression44(d)});
 assert.equal(g.state,'won');assert.equal(r.resets,0);assert.equal(r.respawns,0);assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);assert.equal(g.teleportCount,0);
 assert.equal(r.milestones.length,5);assert.ok(g.physics.portalTransports>=1);
 console.log('PROGRESSION44_ROUTE',JSON.stringify({frames:r.frames,seconds:r.frames/60,teleports:r.teleports,cargoTransports:g.physics.portalTransports,milestones:r.milestones.map(m=>m.name)}));
});
test('progression44 a real lower-floor fall recovers through the western ramp at a second camera aspect',async()=>{
 const g=await room();g.camera.aspect=16/10;g.camera.updateProjectionMatrix();
 const r=await runV8Journey(g,{scenario:d=>runPuzzleProgression44(d,{recover:true})});
 assert.equal(g.state,'won');assert.equal(r.resets,0);assert.equal(r.respawns,0);assert.equal(g.teleportCount,0);assert.equal(r.milestones.length,6);
});
test('lawful off-centre bridge routing still completes without a centre-shot recognition rule',async()=>{
 const g=await room();const r=await runV8Journey(g,{scenario:d=>runPuzzleProgression44(d,{bridgeOffset:.3})});
 assert.equal(g.state,'won');assert.equal(r.resets,0);assert.equal(r.respawns,0);assert.equal(g.teleportCount,0);
});
test('departure positions cannot address late cargo floor, north bridge or exit bridge through actual walls',async()=>{
 const g=await room();let attempts=0;
 const r=await runV8Journey(g,{scenario:d=>{
  installPreciseLateAim(d);
  for(const [x,z]of [[-24,24],[-19,27],[-24,16]]){
   d.walk(x,z);
   for(const s of [d.level.second,d.level.final,d.level.load.surface]){
    d.look(s.getFrame().center);assert.equal(g.firePortal(1),true);attempts++;
    d.until(()=>!g.portalShots.queue.length&&!g.portalShots.active.length,3,'Early shot unresolved');
    assert.notEqual(g.portals.portals[1]?.surfaceId,s.mesh.uuid,`Early address escaped from ${x}/${z} to ${s.name}`);
   }
  }
  assert.equal(g.state,'playing');assert.ok(g.cargo.position.x<-18&&g.cargo.position.y<5);assert.equal(g.teleportCount,0);
 }});assert.equal(attempts,9);assert.equal(r.resets,0);assert.equal(r.respawns,0);
});
test('reaching the visible exit alone cannot complete without extracting the original companion',async()=>{
 const g=await room();
 const r=await runV8Journey(g,{scenario:d=>{
  runPuzzleProgression44(d,{stopAfter:'observation'});
  d.walk(5,-21);aimLateSurface(d,0,d.level.source);aimLateSurface(d,1,d.level.final);d.walk(24,-21);d.wait(1);
  assert.ok(d.level.goal.contains(g.playerPosition));assert.equal(g.state,'playing');
  assert.ok(g.cargo.position.x<-18&&g.cargo.position.y<5);assert.equal(g.physics.portalTransports,0);
 }});assert.equal(r.resets,0);assert.equal(r.respawns,0);
});
test('losing an active bridge is a physical fall with a usable return, not a checkpoint or cargo reset',async()=>{
 const g=await room();
 const r=await runV8Journey(g,{scenario:d=>{
  runPuzzleProgression44(d,{stopAfter:'middle'});
  d.walk(0,21);aimLateSurface(d,1,d.level.second);
  d.walk(-12,16);d.until(()=>g.playerGrounded&&g.playerPosition.y<-3.8,5,'Rerouting did not produce a real lower-floor fall');
  d.walk(-17,0);d.walk(-25,0);d.walk(-25,24);assert.ok(g.playerPosition.y>7.9);
  runPuzzleProgression44(d);assert.equal(g.state,'won');
 }});assert.equal(r.resets,0);assert.equal(r.respawns,0);
});
test('low bridge receiving aperture blocks repeated ordinary player jumps while original cargo remains recoverable',async()=>{
 const g=await room();
 const r=await runV8Journey(g,{scenario:d=>{
  runPuzzleProgression44(d,{stopAfter:'middle'});d.walk(5.8,16);
  for(let n=0;n<240;n++){if(n%38===0)g.input.jumpQueued=true;d.worldMove(1,0);d.frame();}
  d.stop();assert.equal(g.teleportCount,0);assert.equal(g.state,'playing');assert.ok(g.playerPosition.x<6.6);
 }});assert.equal(r.resets,0);assert.equal(r.respawns,0);
});
test('room reset preserves both original actor identities and selecting another room removes owned light-bridge pieces',async()=>{
 const g=await room(),cargo=g.cargo,body=g.physics.cargoBody,level=g.firstLevel,pieces=level.bridge.pieces;
 await runV8Journey(g,{scenario:d=>runPuzzleProgression44(d,{stopAfter:'middle'})});
 g.resetRun(true);assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);assert.ok(g.cargo.position.x<-18&&g.cargo.position.y<5);
 await g.selectLevel(42,false);
 for(const p of pieces){assert.equal(g.colliders.includes(p.collider),false);assert.equal(g.floors.includes(p.floor),false);assert.equal(g.cameraBlockers.includes(p.mesh),false);assert.equal(g.aimBlockers.includes(p.mesh),false);assert.equal(p.mesh.parent,null);}
});
