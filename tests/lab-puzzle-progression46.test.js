import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runPuzzleProgression46} from '../src/game/LabPuzzleProgression46Journey.js';
import {PROGRESSION46_SPEC} from '../src/game/LabPuzzleProgression46.js';
import {installPreciseLateAim,aimLateSurface} from '../src/game/LabLateCampaignAim.js';
import {uprightCapsuleFitsPortal} from '../src/game/LabPortals.js';
let shared;
async function room(){shared??=await createHeadlessGame();shared.chamberEdition='foundation';shared.puzzleProgression=true;await shared.selectLevel(45,false);return shared;}
const scenario=(g,route)=>runV8Journey(g,{scenario:route});
for(const [aspect,recover]of [[16/9,false],[16/10,true]])test(`46 ordinary synthesis preserves original actor identity: ${aspect}, recovery ${recover}`,async()=>{
 const g=await room();g.camera.aspect=aspect;g.camera.updateProjectionMatrix();const cargo=g.cargo,body=g.physics.cargoBody;
 const report=await runV8Journey(g,{journeyOptions:{recover}});
 assert.equal(report.pass,true);assert.equal(g.state,'won');assert.equal(report.resets,0);assert.equal(report.respawns,0);
 assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);assert.equal(g.firstLevel.id,PROGRESSION46_SPEC.id);
 assert.equal(report.teleports,1);assert.ok(g.physics.portalTransports>=1);
 assert.ok(report.milestones.some(m=>m.name.includes('temporary light')));
 assert.ok(report.milestones.some(m=>m.name.includes('original companion out')));
 assert.ok(report.milestones.some(m=>m.name.includes('parks original cargo')));
 assert.ok(report.milestones.some(m=>m.name.includes('deep island fall')&&m.player[1]>21));
});

test('46 bridge support is real, temporary and cannot be reconfigured early without a physical fall',async()=>{
 const g=await room();await scenario(g,d=>{
  runPuzzleProgression46(d,{stopAfter:'bridge'});
  d.walk(-22,8);d.walk(-8,8);d.wait(.3);assert.ok(g.playerGrounded&&g.playerPosition.y>14.9);
  installPreciseLateAim(d);aimLateSurface(d,0,d.level.panels['field-intake']);
  assert.ok(!d.level.light.pieces.some(p=>p.floor.enabled&&p.floor.maxX>0));
  d.until(()=>g.playerPosition.y<14,5,'Removing actual light support must cause a real fall');
  d.walk(-8,4);d.until(()=>g.playerGrounded&&g.playerPosition.y<-3.8,5,'The accidental lower landing must have a physical service recovery');
  assert.notEqual(g.state,'won');
  d.walk(-8,-17.4);d.walk(-26,-17.4);d.walk(-26,8);d.walk(-22,16);
  assert.ok(g.playerGrounded&&g.playerPosition.y>14.9);
 });
});

test('46 direct freight portal remains cargo sized and cannot transport the standing player',async()=>{
 const g=await room();await scenario(g,d=>{
  runPuzzleProgression46(d,{stopAfter:'routed'});
  assert.ok(g.portals.ready);
  for(const p of g.portals.portals)assert.equal(uprightCapsuleFitsPortal(p,2.4,.46),false);
  const before=g.teleportCount;
  d.walk(3,-9);d.walk(7,-11);for(let n=0;n<120;n++){d.worldMove(0,-1);d.frame();}d.stop();
  assert.equal(g.teleportCount,before);assert.ok(g.cargo.position.x<-17);assert.notEqual(g.state,'won');
 });
});

test('46 side-view enclosure blocks extraction address from the entry court',async()=>{
 const g=await room();await scenario(g,d=>{
  installPreciseLateAim(d);d.look(d.level.freight.getFrame().center);
  const origin=g.camera.position.clone(),direction=d.level.freight.getFrame().center.clone().sub(origin).normalize();
  g.scene.updateMatrixWorld(true);const hits=new THREE.Raycaster(origin,direction).intersectObjects(g.aimBlockers,true);
  assert.ok(hits.length);assert.notEqual(hits[0].object.uuid,d.level.freight.mesh.uuid);
  assert.ok(g.cargo.position.x<-17);assert.notEqual(g.state,'won');
 });
});

test('46 player-only impulse reaches the terrace but cannot complete the joint exit',async()=>{
 const g=await room();await scenario(g,d=>runPuzzleProgression46(d,{noCargo:true}));
 assert.notEqual(g.state,'won');assert.ok(g.playerPosition.y>21.9);assert.ok(g.cargo.position.y<16);
});

test('46 release uses real gravity; reset restores ordinary switches and disposal removes light solids',async()=>{
 const g=await room();let light;
 await scenario(g,d=>{
  runPuzzleProgression46(d,{stopAfter:'extracted'});light=d.level.light;
  assert.equal(d.level.funnel.enabled,true);assert.ok(g.cargo.position.y>15.7);
  d.walk(d.level.power.position.x,d.level.power.position.z-1.5);assert.equal(g.interact(),true);
  d.until(()=>g.physics.grounded,5,'Released original cargo must land');assert.ok(g.cargo.position.y<15.7);
 });
 g.resetRun(true);assert.equal(g.firstLevel.funnel.enabled,false);assert.equal(g.firstLevel.funnel.reversed,false);
 assert.ok(g.cargo.position.x<-17);assert.equal(g.teleportCount,0);assert.ok(!g.portals.ready);
 light.dispose();light.dispose();assert.ok(light.pieces.every(p=>!g.colliders.includes(p.collider)&&!g.floors.includes(p.floor)));
});

test('46 visible mint cladding clears the real freight inspection throat',async()=>{
 const g=await room();g.scene.updateMatrixWorld(true);
 const mint=[];g.firstLevel.world.root.traverse(o=>{if(o.isMesh&&o.material?.name==='46 / folded sea glass architecture')mint.push(o);});
 assert.ok(mint.length);
 for(const y of [15.27,15.5,16.2,16.9,17.08])for(const z of [-28.98,-28.5,-24,-19.5,-19.02]){
  const ray=new THREE.Raycaster(new THREE.Vector3(-18,y,z),new THREE.Vector3(1,0,0),0,4);
  assert.equal(ray.intersectObjects(mint,true).length,0,`Solid-looking mint may not occupy the open throat at ${y}, ${z}`);
 }
});
