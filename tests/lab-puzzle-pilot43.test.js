import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runPuzzlePilot43} from '../src/game/LabPuzzlePilot43Journey.js';
import {PILOT43_SPEC} from '../src/game/LabPuzzlePilot43.js';
import {installPreciseLateAim} from '../src/game/LabLateCampaignAim.js';
let shared;
async function room(){shared??=await createHeadlessGame();shared.chamberEdition='foundation';shared.puzzlePilot43=true;await shared.selectLevel(42,false);return shared;}

for(const [aspect,recover] of [[16/9,false],[16/10,true]]){
 test(`pilot43 ordinary route keeps original actors and requires two different portal uses: ${aspect}, recovery ${recover}`,async()=>{
  const g=await room();g.camera.aspect=aspect;g.camera.updateProjectionMatrix();const cargo=g.cargo,body=g.physics.cargoBody;
  const report=await runV8Journey(g,{journeyOptions:{recover}});
  assert.equal(report.pass,true);assert.equal(report.resets,0);assert.equal(report.respawns,0);assert.equal(g.state,'won');
  assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);assert.equal(report.teleports,2);
  assert.ok(report.milestones.some(m=>m.name.includes('returns the original weight')&&m.player[1]>14&&m.cargo[1]>15));
  assert.ok(report.milestones.some(m=>m.name.includes('real fall and upward flight')&&m.player[1]>21));
 });
}
test('pilot is opt-in and leaves the established chamber 43 intact',async()=>{
 const g=await room();assert.equal(g.firstLevel.id,PILOT43_SPEC.id);assert.equal(g.firstLevel.puzzleGeometry.noProgressFlags,true);
 g.puzzlePilot43=false;await g.selectLevel(42,false);assert.notEqual(g.firstLevel.id,PILOT43_SPEC.id);assert.equal(g.firstLevel.pilot43,undefined);
});

test('removing the original live weight closes the shutter without a visited-stage latch',async()=>{
 const g=await room();const r=await runV8Journey(g,{scenario:d=>{
  runPuzzlePilot43(d,{stopAfter:'weighted'});assert.ok(d.level.shutter.progress>.98);
  const cp=g.cargo.position;d.walk(cp.x+1.3,cp.z);d.pickup();d.walk(-12,21);d.wait(2);
  assert.equal(d.level.button.loaded(),false);assert.ok(d.level.shutter.progress<.01);assert.equal(g.state,'playing');
 }});assert.equal(r.resets,0);assert.equal(r.respawns,0);
});

test('lower-floor direct shot attacks cannot address the raised gallery through its shutter or closed apron',async()=>{
 const g=await room();let shots=0;
 const r=await runV8Journey(g,{scenario:d=>{
  installPreciseLateAim(d);
  for(const [x,z]of [[-14,22],[-9,25],[24,25],[24,0],[20,-12]]){
   // The eastern attempts exercise ordinary lower-floor walking around the
   // partition, rather than just ray casting from a convenient fixture.
   if(x>0){d.walk(-5,25);d.until(()=>g.playerGrounded&&g.playerPosition.y<-3.8,4,'Service attack floor missed');d.walk(x,25);d.walk(x,z);}
   else d.walk(x,z);
   for(const offset of [0,.65,-.65]){
    const target=d.level.gallery.getFrame().center.clone().add(new THREE.Vector3(0,offset,0));d.look(target);assert.equal(g.firePortal(1),true);shots++;
    d.until(()=>g.portalShots.queue.length===0&&g.portalShots.active.length===0,3,'Direct attack charge did not resolve');
    assert.notEqual(g.portals.portals[1]?.surfaceId,d.level.gallery.mesh.uuid,`Lower direct address escaped at ${x}/${z}/${offset}`);
   }
  }
  assert.equal(g.state,'playing');assert.ok(g.playerPosition.y<.1);assert.equal(d.level.shutter.pressed,false);
 }});assert.equal(shots,15);assert.equal(r.teleports,0);assert.equal(r.respawns,0);assert.equal(r.resets,0);
});

test('standing on the live button cannot prepare the gallery portal from its centre or shoulders',async()=>{
 const g=await room();let shots=0;
 const r=await runV8Journey(g,{scenario:d=>{
  installPreciseLateAim(d);d.walk(-20,18.5);
  for(const [x,z]of [[-20,14],[-17.5,14],[-20,11.5],[-22.5,14],[-20,16.5]]){
   d.walk(x,z);d.wait(1);assert.equal(d.level.shutter.pressed,true,'Player is genuinely holding the visible button');
   d.look(d.level.gallery.getFrame().center);assert.equal(g.firePortal(1),true);shots++;
   d.until(()=>!g.portalShots.queue.length&&!g.portalShots.active.length,3,'Button attack charge unresolved');
   assert.notEqual(g.portals.portals[1]?.surfaceId,d.level.gallery.mesh.uuid,`Player-button address escaped at ${x}/${z}`);
  }
  assert.equal(g.heldCube,null);assert.equal(g.state,'playing');
 }});assert.equal(shots,5);assert.equal(r.teleports,0);assert.equal(r.respawns,0);assert.equal(r.resets,0);
});

test('retrieving the button weight before entering a prepared pair cannot bypass the physical receiving door',async()=>{
 const g=await room();const cargo=g.cargo,body=g.physics.cargoBody;
 const r=await runV8Journey(g,{scenario:d=>{
  runPuzzlePilot43(d,{stopAfter:'connected'});
  const cp=g.cargo.position;d.walk(cp.x+1.3,cp.z);d.pickup();d.walk(-14,22);d.wait(1);
  assert.ok(d.level.ingress.progress<.01,'Removing weight actually closes the receiving leaf');
  d.enter(d.level.entry);d.until(()=>g.playerGrounded,4,'Prepared-pair attack did not land inside the vestibule');
  assert.throws(()=>d.walk(-27,-14),/Blocked walking/,'A closed actual leaf must block the original carried-companion shortcut');
  assert.ok(g.playerPosition.x>-25.4&&g.playerPosition.x<-14,'Attacker remains inside the receiving housing');
  assert.equal(g.heldCube,cargo);assert.equal(g.state,'playing');
  // The inspection slit is deliberately shorter than the standing actor.
  // Repeated ordinary forward jumps must not turn it into a second exit.
  d.walk(-20,-11);d.worldMove(0,1);
  for(let i=0;i<300;i++){if(i%35===0)g.input.jumpQueued=true;d.frame();}
  d.stop();assert.ok(g.playerPosition.z<-8.2,'Jumping escaped through the inspection slit');
 }});
 assert.equal(r.teleports,1);assert.equal(r.resets,0);assert.equal(r.respawns,0);assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);
});

test('an original carried companion mistakenly taken into the closed vestibule can return through the original portal by an ordinary jump',async()=>{
 const g=await room();const cargo=g.cargo,body=g.physics.cargoBody;
 const r=await runV8Journey(g,{scenario:d=>{
  runPuzzlePilot43(d,{stopAfter:'connected'});const cp=g.cargo.position;d.walk(cp.x+1.3,cp.z);d.pickup();d.walk(-14,22);d.enter(d.level.entry);
  d.until(()=>g.playerGrounded,4,'Mistaken companion ingress did not reach its visible steps');
  const before=g.teleportCount;g.input.jumpQueued=true;
  for(let i=0;i<180&&g.teleportCount===before;i++){d.worldMove(0,-1);d.frame();}
  d.stop();assert.equal(g.teleportCount,before+1,'The visible steps must permit jumping back into the ingress portal');
  d.until(()=>g.playerGrounded&&g.playerPosition.y<1,5,'The same lower court did not recover both travellers');
  assert.equal(g.heldCube,cargo);d.walk(-20,17);d.walk(-20,14.72);d.stop();d.wait(.3);assert.equal(g.interact(),true);d.wait(1);
  assert.equal(d.level.button.loaded(),true,'Recovered original companion can restore the same live gate');assert.ok(d.level.ingress.progress>.98);
 }});
 assert.equal(r.teleports,2);assert.equal(r.resets,0);assert.equal(r.respawns,0);assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);
});
