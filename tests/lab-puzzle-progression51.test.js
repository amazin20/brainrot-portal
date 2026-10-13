import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Body} from 'cannon-es';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runPuzzleProgression51} from '../src/game/LabPuzzleProgression51Journey.js';
import {installPreciseLateAim,aimLateSurface} from '../src/game/LabLateCampaignAim.js';
import {makePortalFrame,orientedBoxFitsPortal,uprightCapsuleFitsPortal,resolvePortalPlacement} from '../src/game/LabPortals.js';
import {tracePortalRay} from '../src/game/LabPuzzleMechanics.js';
const V=(...p)=>new THREE.Vector3(...p);let shared;
async function room(){shared??=await createHeadlessGame();shared.chamberEdition='foundation';shared.puzzleProgression=true;await shared.selectLevel(50,false);return shared;}
const scenario=(g,fn)=>runV8Journey(g,{scenario:fn});
const clean=r=>{assert.equal(r.pass,true);assert.equal(r.resets,0);assert.equal(r.respawns,0);};
function launch(d){const a=d.level.apparatus,before=a.impactCount;assert.equal(d.game.interact(),true);d.until(()=>a.impactCount>before,4,'True striker contact missing');}
for(const [aspect,missFirst,swapColours] of [[16/9,false,false],[16/10,true,true]])test(`51 ordinary original actors ${aspect}, wrong timing recovery ${missFirst}`,async()=>{
 const g=await room();g.camera.aspect=aspect;g.camera.updateProjectionMatrix();const cargo=g.cargo,body=g.physics.cargoBody;
 const r=await scenario(g,d=>runPuzzleProgression51(d,{missFirst,swapColours}));clean(r);assert.equal(g.state,'won');assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);assert.ok(r.milestones.length>=9);assert.equal(r.teleports,0);assert.ok(g.physics.portalTransports>=2);
 const l=g.firstLevel;assert.equal(l.apparatus.cup.type,Body.DYNAMIC);assert.equal(l.apparatus.gate.type,Body.DYNAMIC);assert.equal(l.apparatus.weight.type,Body.DYNAMIC);assert.ok(l.apparatus.gate.position.y>12);assert.equal(l.apparatus.loaded(),false);assert.equal(l.field.arrivals.filter(a=>a.receiver==='long').length,missFirst?2:1);assert.equal(l.field.arrivals.filter(a=>a.receiver==='short').length,1);
 if(missFirst)assert.ok(r.milestones.some(m=>/missed overlap/.test(m.name)));
});
test('51 passenger alone in the opened return court cannot complete',async()=>{
 const g=await room(),cargo=g.cargo,body=g.physics.cargoBody;const r=await scenario(g,d=>runPuzzleProgression51(d,{leaveCargo:true}));clean(r);assert.equal(g.state,'playing');assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);assert.equal(g.heldCube,null);assert.ok(g.playerPosition.distanceTo(g.cargo.position)>4);assert.equal(g.firstLevel.apparatus.opened,true);
});
test('51 real cargo contact depresses the dynamic cup and alone supplies rewind power',async()=>{
 const g=await room();const r=await scenario(g,d=>{runPuzzleProgression51(d,{stopAfter:'loaded'});const a=d.level.apparatus;assert.equal(a.loaded(),true);assert.equal(a.powered(),true);assert.equal(a.cup.mass,6);assert.equal(a.cup.type,Body.DYNAMIC);assert.ok(a.cup.position.y<.34);assert.ok(g.physics.world.contacts.some(c=>(c.bi===a.cup&&c.bj===g.physics.cargoBody)||(c.bj===a.cup&&c.bi===g.physics.cargoBody)));d.wait(2);assert.ok(a.cup.position.y<.2);});clean(r);
});
test('51 E releases a real lock; the head collision emits and the live motor rewinds',async()=>{
 const g=await room();const r=await scenario(g,d=>{runPuzzleProgression51(d,{stopAfter:'loaded'});const l=d.level,a=l.apparatus;d.walk(-1,14.7);aimLateSurface(d,0,l.source);aimLateSurface(d,1,l.long);assert.ok(a.pistonLock&&g.physics.world.constraints.includes(a.pistonLock));const before=l.field.emitted;assert.equal(g.interact(),true);assert.equal(a.pistonLock,null);assert.equal(l.field.emitted,before);d.until(()=>a.impactCount===1,4,'Physical collision not reached');assert.equal(l.field.emitted,before+1);assert.equal(a.piston.type,Body.DYNAMIC);assert.ok(a.piston.position.x<4.2);d.until(()=>a.ready,4,'True rewind did not capture');assert.ok(a.piston.position.x>4.65);assert.ok(g.physics.world.constraints.includes(a.pistonLock));});clean(r);
});
test('51 departed packet reaches its old long branch after current aperture is retargeted',async()=>{
 const g=await room();const r=await scenario(g,d=>{runPuzzleProgression51(d,{stopAfter:'retargeted'});const l=d.level,a=l.apparatus,p=l.field.packets.find(p=>p.portalCrossings===1);assert.ok(p);assert.ok(p.position.x>14.8);assert.ok(p.position.z<18);assert.ok(g.portals.portals[1].position.x<-14.8);assert.equal(l.field.arrivals.length,0);const id=p.id;d.until(()=>l.field.arrivals.some(e=>e.packet===id),6,'Departed packet recalled');const e=l.field.arrivals.find(e=>e.packet===id);assert.equal(e.receiver,'long');assert.ok(e.travel>35);assert.equal(e.portalCrossings,1);assert.equal(e.actualReceiverBody,a.heads[0].body.id);assert.equal(a.opened,false);});clean(r);
});
test('51 prematurely addressed short branch and repeated short arrivals cannot free the long stop',async()=>{
 const g=await room();const r=await scenario(g,d=>{runPuzzleProgression51(d,{stopAfter:'loaded'});const l=d.level,a=l.apparatus;d.walk(-1,14.7);aimLateSurface(d,0,l.source);aimLateSurface(d,1,l.short);launch(d);d.until(()=>a.ready,5,'Rewind missing');launch(d);d.wait(6);assert.ok(l.field.arrivals.length>=2);assert.ok(l.field.arrivals.every(e=>e.receiver==='short'));assert.equal(a.opened,false);assert.ok(a.gate.position.y<4.3);assert.ok(a.heads[0].body.position.z<22.3);assert.ok(g.physics.world.contacts.some(c=>(c.bi===a.gate&&c.bj===a.heads[0].body)||(c.bj===a.gate&&c.bi===a.heads[0].body)));});clean(r);
});
test('51 lone real long receiver motion returns by spring while the other actual pin holds door',async()=>{
 const g=await room();const r=await scenario(g,d=>{runPuzzleProgression51(d,{stopAfter:'retargeted'});const l=d.level,a=l.apparatus;let max=22;for(let i=0;i<420;i++){d.frame();max=Math.max(max,a.heads[0].body.position.z);}d.stop();assert.ok(max>23);assert.ok(a.heads[0].body.position.z<22.2);assert.ok(a.gate.position.y<4.3);assert.ok(a.ropeTension>330);assert.equal(a.weight.type,Body.DYNAMIC);assert.ok(a.weight.position.y<12);assert.equal(l.field.arrivals.length,1);assert.equal(a.opened,false);});clean(r);
});
test('51 long then much later short cannot remember a previously withdrawn stopper',async()=>{
 const g=await room();const r=await scenario(g,d=>{runPuzzleProgression51(d,{stopAfter:'retargeted'});const l=d.level,a=l.apparatus;d.wait(12);assert.equal(l.field.arrivals.length,1);assert.equal(l.field.arrivals[0].receiver,'long');assert.ok(a.heads[0].body.position.z<22.3);assert.ok(a.gate.position.y<4.3);launch(d);d.wait(6);assert.equal(l.field.arrivals.length,2);assert.equal(l.field.arrivals[1].receiver,'short');assert.equal(a.opened,false);assert.ok(a.gate.position.y<4.3);assert.ok(g.physics.world.contacts.some(c=>(c.bi===a.gate&&c.bj===a.heads[0].body)||(c.bj===a.gate&&c.bi===a.heads[0].body)));});clean(r);
});
test('51 freight and signal apertures fit actual cube and reject a standing passenger',async()=>{
 const g=await room(),l=g.firstLevel;for(const p of [l.source,l.long,l.short,l.freight]){const f=p.getFrame();assert.equal(resolvePortalPlacement(p.mesh,f.center,{blockers:g.colliders}).ok,true);assert.equal(uprightCapsuleFitsPortal(makePortalFrame(f.center,f.normal,f.up,p.mesh.userData.portalSize),2.4,.43),false);}
 const f=l.freight.getFrame(),p=makePortalFrame(f.center,f.normal,f.up,l.freight.mesh.userData.portalSize);for(const x of [0,.18,Math.PI/4])for(const y of [0,Math.PI/4,Math.PI/2])for(const z of [0,.18,Math.PI/4])assert.equal(orientedBoxFitsPortal(p,p.position,new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z)),.39),true);
 const r=await scenario(g,d=>{installPreciseLateAim(d);d.walk(-9,16);aimLateSurface(d,0,l.cargoInput.surface);d.walk(8,14);aimLateSurface(d,1,l.freight);d.walk(-1,14);d.walk(-6,17);d.walk(-6,21);for(let i=0;i<150;i++){g.input.keys.add('Space');d.frame();}d.stop();assert.equal(g.teleportCount,0);assert.equal(l.apparatus.loaded(),false);});clean(r);
});
test('51 closed door is opaque to signal rays and ordinary early goal charges',async()=>{
 const g=await room(),l=g.firstLevel;const direct=tracePortalRay(g,V(0,2,-8),V(0,0,-1),{medium:'air',length:30});assert.equal(direct[0].kind,'wall');assert.ok(direct[0].length<4);assert.equal(l.apparatus.opened,false);
 const r=await scenario(g,d=>{installPreciseLateAim(d);d.walk(0,-8);d.look(l.returnPad.surface.getFrame().center);assert.equal(g.firePortal(1),true);d.until(()=>!g.portalShots.active.length&&!g.portalShots.queue.length,3,'Shot stalled');assert.equal(g.portalShots.lastImpact.valid,false);assert.equal(g.teleportCount,0);assert.equal(g.state,'playing');for(let i=0;i<120;i++){d.worldMove(0,-1);g.input.keys.add('Space');d.frame();}d.stop();assert.ok(g.playerPosition.z>-11.3);assert.ok(l.apparatus.gate.position.y<4.3);});clean(r);
});
test('51 unloaded initial striker rejects E and a returned cup loses power without forgetting actors',async()=>{
 const g=await room();const r=await scenario(g,d=>{installPreciseLateAim(d);d.walk(-1,14.7);const a=d.level.apparatus;assert.equal(a.loaded(),false);assert.equal(a.powered(),false);assert.equal(g.interact(),true);d.wait(2);assert.equal(a.impactCount,0);assert.equal(d.level.field.emitted,0);assert.ok(a.pistonLock);});clean(r);
 const returned=await scenario(g,d=>{runPuzzleProgression51(d,{stopAfter:'returned'});const a=d.level.apparatus;assert.equal(a.loaded(),false);assert.equal(a.powered(),false);d.wait(2);assert.ok(Math.abs(a.cup.position.y-.44)<.005);const before=d.level.field.emitted;assert.equal(a.fire(),false);assert.equal(d.level.field.emitted,before);assert.ok(a.pistonLock);});clean(returned);
});
test('51 reset keeps original actors and disposal removes all owned dynamic bodies and listeners',async()=>{
 const g=await room(),cargo=g.cargo,body=g.physics.cargoBody;const r=await scenario(g,d=>runPuzzleProgression51(d,{stopAfter:'door'}));clean(r);const l=g.firstLevel,a=l.apparatus,owned=[...a.bodies,a.anchor];g.resetRun(true);assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);assert.equal(a.opened,false);assert.equal(a.impactCount,0);assert.equal(l.field.emitted,0);assert.ok(a.pistonLock);l.dispose();for(const b of owned)assert.equal(g.physics.world.bodies.includes(b),false);assert.equal(g.physics.world.constraints.some(c=>owned.includes(c.bodyA)||owned.includes(c.bodyB)),false);assert.equal(g.physics.world.hasEventListener('preStep',a.preStep),false);assert.equal(g.physics.cargoBody,body);
});
