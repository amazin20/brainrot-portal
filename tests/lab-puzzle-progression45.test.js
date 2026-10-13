import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runPuzzleProgression45} from '../src/game/LabPuzzleProgression45Journey.js';
import {PROGRESSION45_SPEC} from '../src/game/LabPuzzleProgression45.js';
import {installPreciseLateAim,aimLateSurface} from '../src/game/LabLateCampaignAim.js';
let shared;
async function room(){shared??=await createHeadlessGame();shared.chamberEdition='foundation';shared.puzzleProgression=true;await shared.selectLevel(44,false);assert.equal(shared.firstLevel.id,PROGRESSION45_SPEC.id);return shared;}
for(const [aspect,recover,wrongReverse]of [[16/9,false,false],[16/10,true,true]])test(`45 ordinary six-phase route retains original actors at ${aspect}`,async()=>{
 const g=await room();g.camera.aspect=aspect;g.camera.updateProjectionMatrix();const cargo=g.cargo,body=g.physics.cargoBody;
 const r=await runV8Journey(g,{scenario:d=>runPuzzleProgression45(d,{recover,wrongReverse})});
 assert.equal(r.pass,true);assert.equal(r.resets,0);assert.equal(r.respawns,0);assert.equal(g.state,'won');assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);
 assert.ok(g.physics.portalTransports>=2);assert.ok(r.milestones.some(m=>m.name.includes('low freight throat')));assert.ok(r.milestones.some(m=>m.name.includes('unused air valve closes')));assert.ok(r.milestones.some(m=>m.name.includes('suspended receiving bay')));
});
test('45 variant opt-in keeps the established room45 intact',async()=>{const g=await room();assert.equal(g.firstLevel.puzzleGeometry.noProgressFlags,true);g.puzzleProgression=false;await g.selectLevel(44,false);assert.notEqual(g.firstLevel.id,PROGRESSION45_SPEC.id);});
test('45 real visor blocks the concrete lower-court crossing shortcut before any cargo or lift',async()=>{
 const g=await room();const cargo=g.cargo,body=g.physics.cargoBody;let shots=0;
 const r=await runV8Journey(g,{scenario:d=>{installPreciseLateAim(d);for(const [x,z]of [[20,25],[20,23],[27,25],[0,25],[-9,23],[-26,25],[20,13]]){d.walk(x,z);for(const y of [0,1.7,-1.7]){d.look(d.level.crossing.getFrame().center.clone().add(new THREE.Vector3(0,y,0)));assert.equal(g.firePortal(1),true);d.until(()=>!g.portalShots.queue.length&&!g.portalShots.active.length,3,'Early crossing attack unresolved');assert.notEqual(g.portals.portals[1]?.surfaceId,d.level.crossing.mesh.uuid);shots++;}}assert.equal(g.state,'playing');assert.equal(d.level.load.loaded(),false);}});
 assert.equal(shots,21);assert.equal(r.resets,0);assert.equal(r.respawns,0);assert.equal(r.teleports,0);assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);
});
test('45 a prepared forward pair without cargo hits the actual closed air valve and cannot reach the retained gallery',async()=>{
 const g=await room();const r=await runV8Journey(g,{scenario:d=>{installPreciseLateAim(d);d.walk(-12,13);aimLateSurface(d,0,d.level.source);aimLateSurface(d,1,d.level.panels.shaft);d.walk(-12,9);d.wait(2);for(let i=0;i<180;i++){if(i%40===0)g.input.jumpQueued=true;d.worldMove(0,-.15);d.frame();}d.stop();assert.ok(g.playerPosition.y<3);assert.ok(d.level.door.progress<.02);assert.equal(d.level.load.loaded(),false);assert.equal(g.state,'playing');assert.equal(g.physics.portalTransports,0);}});assert.equal(r.resets,0);assert.equal(r.respawns,0);
});
test('45 removing live weight closes the air branch and reset/dispose restores owned machinery without progress latches',async()=>{
 const g=await room();let art;
 const r=await runV8Journey(g,{scenario:d=>{runPuzzleProgression45(d,{stopAfter:'weighted'});const l=d.level;art=l.art;assert.ok(l.door.progress>.98);const p=g.cargo.position;d.walk(p.x+1.3,p.z);d.pickup();d.walk(-10,23);d.wait(2);assert.equal(l.load.loaded(),false);assert.ok(l.door.progress<.02);assert.equal(l.puzzleGeometry.noProgressFlags,true);}});
 assert.equal(r.resets,0);assert.equal(r.respawns,0);g.resetRun(true);assert.equal(g.firstLevel.field.reversed,false);assert.ok(g.firstLevel.door.progress<.02);assert.equal(g.firstLevel.load.loaded(),false);assert.deepEqual(g.cargo.position.toArray(),[-18,2.6,-10.8]);await g.selectLevel(43,false);assert.equal(art.disposed,true);
});
test('45 wrong free-cargo stream direction can be corrected at the real handle with the unchanged pair and original body',async()=>{
 const g=await room(),cargo=g.cargo,body=g.physics.cargoBody;const r=await runV8Journey(g,{scenario:d=>{
  runPuzzleProgression45(d,{stopAfter:'extracted'});const l=d.level,ids=g.portals.portals.map(p=>p.surfaceId);d.walk(-14.4,23);d.walk(-14.4,25);
  assert.equal(l.field.reversed,true);const before=g.cargo.position.x;assert.equal(g.interact(),true);assert.equal(l.field.reversed,false);d.wait(1);assert.ok(g.cargo.position.x>before+.5);assert.ok(body.velocity.x>2);
  const wrong=g.cargo.position.x;assert.equal(g.interact(),true);assert.equal(l.field.reversed,true);d.wait(2);assert.ok(g.cargo.position.x<wrong-2);assert.deepEqual(g.portals.portals.map(p=>p.surfaceId),ids);assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);assert.equal(g.state,'playing');
 }});assert.equal(r.resets,0);assert.equal(r.respawns,0);
});
test('45 front jumps and rear service approach cannot pick the untouched deep original cargo through the standing-height throat',async()=>{
 const g=await room(),cargo=g.cargo,body=g.physics.cargoBody;const r=await runV8Journey(g,{scenario:d=>{
  d.walk(-25,23);d.walk(-25,8);d.walk(-18,8);d.walk(-18,-6.9);
  for(let i=0;i<360;i++){if(i%45===0)g.input.jumpQueued=true;d.worldMove(0,-1);d.frame();if(i%5===0)assert.equal(g.interact(),false);}d.stop();assert.equal(g.heldCube,null);assert.ok(g.playerPosition.z>-7.7);assert.ok(Math.abs(g.cargo.position.z+10.8)<.02);
  d.walk(-18,8);d.walk(-18,23);d.walk(28,23);d.walk(28,-32.1);d.walk(-22.25,-32.1);d.walk(-22.25,-23);d.walk(-18,-22);d.walk(-18,-14);
  for(let i=0;i<180;i++){d.worldMove(0,1);d.frame();if(i%5===0)assert.equal(g.interact(),false);}d.stop();assert.ok(g.playerPosition.z<-13.3);assert.equal(g.heldCube,null);assert.equal(g.physics.portalTransports,0);assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);
 }});assert.equal(r.resets,0);assert.equal(r.respawns,0);
});
