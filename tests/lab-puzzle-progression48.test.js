import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Body} from 'cannon-es';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runPuzzleProgression48} from '../src/game/LabPuzzleProgression48Journey.js';
import {installPreciseLateAim,aimLateSurface} from '../src/game/LabLateCampaignAim.js';
import {PROGRESSION48_SPEC} from '../src/game/LabPuzzleProgression48.js';
let shared;
async function room(){shared??=await createHeadlessGame();shared.chamberEdition='foundation';shared.puzzleProgression=true;await shared.selectLevel(47,false);return shared;}
const scenario=(g,route)=>runV8Journey(g,{scenario:route});
const contact=(g,a,b)=>g.physics.world.contacts.some(c=>(c.bi===a&&c.bj===b)||(c.bi===b&&c.bj===a));
function dryReturn(d){const g=d.game;d.walk(27.8,-21);d.walk(27.8,-6);d.walk(29,-6);d.until(()=>g.playerPosition.y<3,5,'Leave the gallery');d.walk(28.2,-6);d.until(()=>g.playerGrounded&&g.playerPosition.y<.3,5,'Reach the dry service floor');d.walk(28.2,5.5);d.walk(-16,5.5);d.walk(-16,-7);d.walk(-22,-7);d.walk(-22,14);d.walk(-18,20);}
for(const aspect of [16/9,16/10])test(`48 ordinary original-cargo contact route wins at aspect ${aspect}`,async()=>{
 const g=await room();g.camera.aspect=aspect;g.camera.updateProjectionMatrix();const cargo=g.cargo,body=g.physics.cargoBody;
 const report=await runV8Journey(g,{scenario:d=>runPuzzleProgression48(d)});
 assert.equal(report.pass,true);assert.equal(g.state,'won');assert.equal(report.resets,0);assert.equal(report.respawns,0);assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);assert.equal(g.firstLevel.id,PROGRESSION48_SPEC.id);
 const m=g.firstLevel.machine;for(const b of [m.body,m.pinBody,m.roofBody,m.stopBody,m.trapBody])assert.equal(b.type,Body.DYNAMIC);
 assert.ok(m.contacts.cargoCarriage>100);assert.ok(m.contacts.pinCarriage>20);assert.ok(m.contacts.cargoStop>20);assert.ok(g.physics.portalTransports>=3);assert.equal(report.teleports,2);assert.ok(report.milestones.length>=9);
});
test('48 pin is real contact support; removing it after cargo extraction loses the first alignment',async()=>{
 const g=await room();await scenario(g,d=>{runPuzzleProgression48(d,{stopAfter:'retrieved'});const m=d.level.machine;assert.ok(m.x>11.4&&m.contacts.pinCarriage>0);d.walk(27.8,-24);d.walk(18,-26);d.walk(18,-24);assert.ok(g.interact());d.until(()=>m.x<.2&&m.pinExtension<.2,20,'The real withdrawn pin must release the empty spring carriage');assert.ok(m.x<.2);assert.ok(m.pinExtension<.2);assert.equal(m.roofOpen,false);assert.notEqual(g.state,'won');});
});
test('48 retained final address depends on original cargo contacting its solid rear socket',async()=>{
 const g=await room();await scenario(g,d=>{runPuzzleProgression48(d,{stopAfter:'stopped'});const m=d.level.machine;assert.ok(m.x>4.8&&m.x<6.5);d.until(()=>contact(g,g.physics.cargoBody,m.body)&&contact(g,g.physics.cargoBody,m.stopBody),2,'The original cargo must simultaneously touch the actual carriage and rear socket');assert.equal(contact(g,m.body,m.stopBody),false);assert.equal(g.heldCube,null);assert.ok(g.cargo.position.y<5);assert.equal(m.pinBody.type,Body.DYNAMIC);assert.ok(m.pinExtension<.2);assert.notEqual(g.state,'won');});
});
test('48 raised socket wall alone does not stop the returning carriage after real pin removal',async()=>{
 const g=await room();await scenario(g,d=>{runPuzzleProgression48(d,{stopAfter:'retrieved'});const m=d.level.machine;d.walk(26,-23);assert.ok(g.interact());d.until(()=>m.stopBody.position.y>4.15,3,'Raise the real rear socket wall');d.walk(27.8,-23);d.walk(18,-23);d.walk(18,-24);assert.ok(g.interact());d.until(()=>m.pinExtension<.2&&m.x<.2,15,'Rear wall without the original cargo incorrectly retained the carriage');assert.equal(m.stopRaised,true);assert.ok(g.cargo.position.y>8);assert.equal(m.contacts.cargoStop,0);assert.equal(contact(g,m.body,m.stopBody),false);assert.notEqual(g.state,'won');});
});
test('48 actual pin-linked closed roof blocks the original cargo window from the retained gallery',async()=>{
 const g=await room();await scenario(g,d=>{runPuzzleProgression48(d,{stopAfter:'gallery'});d.walk(27.8,-6);d.walk(27.8,-21.5);d.walk(23,-23);d.walk(20,-30);d.walk(10.3,-30);d.walk(10.3,-26.1);d.look(d.level.recover.surface.getFrame().center);assert.ok(g.firePortal(0));d.until(()=>!g.portalShots.queue.length&&!g.portalShots.active.length,3,'Closed freight cover shot unresolved');assert.notEqual(g.portals.portals[0]?.surfaceId,d.level.recover.surface.mesh.uuid);assert.equal(d.level.machine.pinRequested,false);assert.equal(d.level.machine.roofOpen,false);assert.equal(g.physics.portalTransports,0);});
});
test('48 ordinary diagonal carry transports the rotated original cargo into a live two-contact stop',async()=>{
 const g=await room(),cargo=g.cargo,body=g.physics.cargoBody;let releaseQuaternion;
 const report=await scenario(g,d=>{runPuzzleProgression48(d,{stopAfter:'retrieved'});const m=d.level.machine,p=d.level.panels;
  d.walk(26,-23);assert.ok(g.interact());d.until(()=>m.stopBody.position.y>4.15,3,'Raise the rear socket');d.walk(20,-30);d.walk(3.8,-30);d.walk(3.8,-26.1);aimLateSurface(d,1,p['socket-mouth']);d.walk(3.8,-30);d.walk(23,-30);d.walk(23,-24);const aim=p['gallery-reunion'].getFrame().center.clone();aim.x+=.10;aimLateSurface(d,0,p['gallery-reunion'],aim);d.wait(1.2);d.until(()=>g.physics.grounded&&body.velocity.length()<.3,6,'Settle the actual upper cargo');
  for(let i=0;i<6&&!g.heldCube;i++){const c=cargo.position.clone();d.walk(c.x+.85,c.z);g.interact();d.wait(g.heldCube?.55:.3);}assert.ok(g.heldCube);
  d.walk(20-Math.tan(.15)*2.25,-23);d.wait(.6);d.worldMove(Math.sin(.15),Math.cos(.15));for(let i=0;i<180&&g.playerPosition.z<-20.75;i++)d.frame();releaseQuaternion=body.quaternion.toArray();assert.ok(Math.abs(releaseQuaternion[1])>.06,'The original box must really rotate before transfer');assert.ok(g.interact()&&!g.heldCube);d.stop();d.wait(.65);d.until(()=>cargo.position.y<5&&cargo.position.x>3&&cargo.position.x<5.1,6,'The rotated original cargo missed the real freight aperture');
  d.walk(27.8,-23);d.walk(18,-23);d.walk(18,-24);assert.ok(g.interact());d.until(()=>m.pinExtension<.2&&m.x>4.8&&m.x<6.5&&Math.abs(m.body.velocity.x)<.06&&contact(g,body,m.body)&&contact(g,body,m.stopBody),20,'The rotated cargo must really bridge carriage and rear socket');assert.equal(contact(g,m.body,m.stopBody),false);assert.equal(g.state,'playing');
 });assert.equal(report.resets,0);assert.equal(report.respawns,0);assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);assert.equal(g.physics.portalTransports,2);assert.ok(releaseQuaternion);
});
for(const name of ['gallery-reunion','socket-mouth'])test(`48 standing player cannot exit the actual cargo head ${name}`,async()=>{
 const g=await room();await scenario(g,d=>{runPuzzleProgression48(d,{stopAfter:'retrieved'});const p=d.level.panels;if(name==='socket-mouth'){d.walk(20,-30);d.walk(3.8,-30);d.walk(3.8,-26.1);aimLateSurface(d,1,p[name]);d.walk(3.8,-30);d.walk(23,-30);d.walk(23,-23);}else{d.walk(23,-24);aimLateSurface(d,1,p[name]);}dryReturn(d);aimLateSurface(d,0,p.departure);const before=g.teleportCount;d.walk(-18,20.65);g.input.keys.add('ShiftLeft');try{for(let i=0;i<240;i++){if(i%45===0)g.input.jumpQueued=true;d.worldMove(0,1);d.frame();}d.stop();d.wait(.5);}finally{g.input.keys.delete('ShiftLeft');}assert.equal(g.teleportCount,before);assert.ok(g.playerPosition.z<22);assert.equal(g.state,'playing');});
});
test('48 final-shore player alone cannot satisfy the joint original-companion goal',async()=>{
 const g=await room();await scenario(g,d=>{runPuzzleProgression48(d,{stopAfter:'final'});d.walk(5.6,-7.5);d.walk(0,1);d.wait(1.5);assert.notEqual(g.state,'won');assert.ok(g.cargo.position.y<5);});
});
test('48 departure cannot target hidden new-view cargo or destination addresses early',async()=>{
 const g=await room();await scenario(g,d=>{installPreciseLateAim(d);for(const s of [d.level.panels['gallery-reunion'],d.level.panels['final-address'],d.level.panels['original-cargo-window'],d.level.panels['shore-stop']]){d.look(s.getFrame().center);assert.ok(g.firePortal(0));d.until(()=>!g.portalShots.queue.length&&!g.portalShots.active.length,3,'Early charge failed');assert.notEqual(g.portals.portals[0]?.surfaceId,s.mesh.uuid);}assert.notEqual(g.state,'won');assert.equal(g.physics.portalTransports,0);});
});
test('48 actual lower service fall and west ramp preserve original actors without a reset',async()=>{
 const g=await room();const cargo=g.cargo,body=g.physics.cargoBody;await scenario(g,d=>{runPuzzleProgression48(d,{stopAfter:'gallery'});d.walk(27.8,-6);d.walk(29,-6);d.until(()=>g.playerPosition.y<3,5,'Leave the upper gallery');d.walk(28.2,-6);d.until(()=>g.playerGrounded&&g.playerPosition.y<.2,6,'The lower service floor missed');d.walk(28.2,5.5);d.walk(-16,5.5);d.walk(-16,-7);d.walk(-22,-7);d.walk(-22,18);assert.ok(g.playerGrounded&&g.playerPosition.y>7.9);assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);assert.notEqual(g.state,'won');});
});
test('48 moving physical proxies follow actual bodies; reset and disposal release all owned mechanisms',async()=>{
 const g=await room();await scenario(g,d=>{runPuzzleProgression48(d,{stopAfter:'pinned'});const m=d.level.machine,f=m.moving.getFrame();assert.ok(Math.abs(f.center.x-m.body.position.x)<1e-8);for(const c of [m.roofProxy,m.roofSkirtProxy,m.pinProxy,m.stopProxy,m.trapProxy,m.trapGuardProxy,...m.carProxies])assert.equal(g.physics.solids.has(c.mesh.uuid),false);assert.ok(m.pinProxy.box.containsPoint(new THREE.Vector3(...m.pinBody.position.toArray())));});
 const m=g.firstLevel.machine,world=g.physics.world,bodies=[...m.bodies],originalMechanisms=[m.body,m.pinBody,m.roofBody,m.stopBody,m.trapBody],cargo=g.cargo;g.resetRun(true);assert.equal(g.cargo,cargo);assert.deepEqual([m.body,m.pinBody,m.roofBody,m.stopBody,m.trapBody],originalMechanisms);assert.ok(Math.abs(m.x)<1e-8);assert.equal(m.pinRequested,false);assert.equal(m.stopRaised,false);assert.equal(m.trapLowered,false);await g.selectLevel(47,false);assert.ok(bodies.every(b=>!world.bodies.includes(b)));assert.equal(world.hasEventListener('preStep',m.preStep),false);
});
