import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runExpansionAJourney} from '../src/game/LabExpansionJourneyA.js';
import {EXPANSION_A_SPECS} from '../src/game/LabExpansionRoomsA.js';

const game=await createHeadlessGame();game.chamberEdition='foundation';
after(()=>{game.physics?.dispose();game.portals?.dispose();});
async function room(n){await game.selectLevel(n-1,false);return game;}
const alternatives=['observe-open-branches','inspect-empty-field','observe-unladen-overspeed','observe-unbalanced-thrust','light-before-damp'];
for(let n=42;n<=46;n++)for(const route of [undefined,alternatives[n-42]])test(`${n}: ${route||'canonical'} uses ordinary inputs and the original rigid companion`,async()=>{
 const g=await room(n),cargo=g.cargo,body=g.physics.cargoBody.id;
 const r=await runV8Journey(g,{journeyOptions:route?{route}:{}});
 assert.equal(r.pass,true);assert.equal(g.state,'won');assert.equal(r.resets+r.respawns,0);assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody.id,body);
 assert.equal(g.firstLevel.id,EXPANSION_A_SPECS[n-42].id);assert.ok(g.firstLevel.workshop.enclosed);assert.ok(g.firstLevel.puzzleGeometry.noProgressFlags);
 g.resetRun(true);assert.equal(g.state,'playing');assert.equal(g.portals.ready,false);assert.equal(g.physics.cargoBody.id,body);
 if(n===42){assert.equal(g.firstLevel.pressure.left,0);assert.equal(g.firstLevel.pressure.right,0);assert.equal(g.firstLevel.shuttle.position.x,0);}
 if(n===43){assert.equal(g.firstLevel.induction.current,0);assert.equal(g.firstLevel.induction.energy,0);assert.equal(g.firstLevel.induction.passes,0);}
 if(n===44){assert.equal(g.firstLevel.governor.omega,0);assert.equal(g.firstLevel.governor.pawl,null);}
 if(n===45){assert.ok(g.firstLevel.boat.at(0));assert.equal(g.firstLevel.trim.traction,0);}
 if(n===46){assert.equal(g.firstLevel.oscillator.clamped,false);assert.equal(g.firstLevel.oscillator.frequency,5.2);assert.ok(g.firstLevel.bridge.at(0));}
});

for(const [n,route,stopAfter]of [[42,alternatives[0],'open-branches'],[43,alternatives[1],'stationary'],[44,alternatives[2],'overspeed'],[45,alternatives[3],'unbalanced'],[46,alternatives[4],'undamped']])test(`${n}: portal power alone cannot replace the actual physical companion effect`,async()=>{
 const g=await room(n);const r=await runV8Journey(g,{scenario:d=>{runExpansionAJourney(d,{route,stopAfter});d.wait(2);assert.equal(g.state,'playing');assert.equal(g.physics.portalTransports,0);}});
 assert.equal(r.resets+r.respawns,0);
});

for(const [n,z]of [[43,-1],[44,-2]])test(`${n}: repeated sprint jumps at the centre and both partition ends cannot bypass the unpowered actuator`,async()=>{
 const g=await room(n);await runV8Journey(g,{scenario:d=>{
  for(const x of [-23,0,23]){
   d.walk(x,z+4);g.input.keys.add('ShiftLeft');
   for(let frame=0;frame<180;frame++){if(frame%30===0)g.input.jumpQueued=true;d.worldMove(0,-1);d.frame();}
   d.stop();assert.ok(g.playerPosition.z>z+.3,`Bypass at ${x},${g.playerPosition.toArray()}`);assert.equal(g.state,'playing');
  }
 }});
});

test('42,45 and46: an original held companion, sprint and repeated jumping cannot climb a remote upper dock from the recovery floor',async()=>{
 for(const n of [42,45,46]){const g=await room(n);await runV8Journey(g,{scenario:d=>{
  d.walk(g.cargo.position.x+1.3,g.cargo.position.z);d.pickup();
  d.walk(n===42?22:n===45?-16:-7,9);d.until(()=>g.playerGrounded&&g.playerPosition.y<-3.9,6,'Actual recovery deck was not reached');
  d.walk(n===42?-32:25,9);g.input.keys.add('ShiftLeft');
  let highest=-4;for(let frame=0;frame<240;frame++){if(frame%35===0)g.input.jumpQueued=true;d.worldMove(0,-1);d.frame();highest=Math.max(highest,g.playerPosition.y);}
  d.stop();assert.ok(highest<2.9,'Recovery floor jumped directly to upper finish');assert.equal(g.state,'playing');assert.equal(g.teleportCount,0);
 }});}
});

test('42: a seated original A valve cannot drive any stroke without actual portal air',async()=>{
 const g=await room(42);await runV8Journey(g,{scenario:d=>{
  runExpansionAJourney(d,{stopAfter:'valveA'});d.wait(6);assert.equal(d.level.pressure.left,0);assert.equal(d.level.shuttle.position.x,0);assert.equal(g.state,'playing');
 }});
});

test('42: removing the original A valve dissipates its live pressure and cannot create the mandatory negative stroke',async()=>{
 const g=await room(42);await runV8Journey(g,{scenario:d=>{
  runExpansionAJourney(d,{stopAfter:'positive'});const before=d.level.pressure.left;
  d.walk(g.cargo.position.x+1.3,g.cargo.position.z);d.pickup();d.wait(3);
  assert.equal(d.level.pressure.coverA,0);assert.ok(d.level.pressure.left<before*.2);assert.equal(d.level.pressure.right,0);assert.ok(d.level.shuttle.position.x>19.9);assert.equal(g.state,'playing');
 }});
});

test('42: even a sprint-jump view from the initial court cannot address the upward-facing high B branch',async()=>{
 const g=await room(42);await runV8Journey(g,{scenario:d=>{
  const l=d.level;d.walk(18,25);g.input.jumpQueued=true;d.frame();d.look(l.mouthB.getFrame().center);
  const f=l.mouthB.getFrame();assert.ok(g.camera.position.y<f.center.y,'Initial observer unexpectedly obtained the upper court viewpoint');
  assert.ok(g.firePortal(1));d.until(()=>!g.portalShots.queue.length&&!g.portalShots.active.length,2,'Branch B attack charge did not resolve');
  assert.notEqual(g.portals.portals[1]?.surfaceId,l.mouthB.mesh.uuid);assert.equal(l.pressure.right,0);assert.equal(g.state,'playing');
 }});
});

test('43: one physical induction pass cannot provide sufficient actuator work',async()=>{
 const g=await room(43);await runV8Journey(g,{scenario:d=>{
  runExpansionAJourney(d,{stopAfter:'prepared'});d.walk(-6,18);d.aim(0,d.level.floor.getFrame().center);
  d.until(()=>d.level.induction.passes===1&&!d.level.induction.inField,6,'First real induction pass did not end');
  const firstPassEnergy=d.level.induction.energy;g.clearPortals();d.wait(2);
  assert.ok(firstPassEnergy>0&&firstPassEnergy<650,`One pass incorrectly supplied ${firstPassEnergy} J`);assert.equal(d.level.induction.passes,1);assert.ok(d.level.door.progress<.01);assert.equal(g.state,'playing');
 }});
});

test('43: recurring falls create induced work, and recovering the same body stops the generator',async()=>{
 const g=await room(43);await runV8Journey(g,{scenario:d=>{
  runExpansionAJourney(d,{stopAfter:'recovered'});assert.ok(d.level.induction.passes>2);assert.ok(d.level.induction.energy>1000);
  const before=d.level.induction.energy;d.wait(1);assert.equal(d.level.induction.current,0);assert.equal(d.level.induction.power,0);assert.ok(d.level.induction.energy<before);assert.equal(g.state,'playing');
 }});
});

test('44: sprinting during the initial unladen working-speed transient cannot slip through the heavy governor sleeve',async()=>{
 const g=await room(44);await runV8Journey(g,{scenario:d=>{
  const l=d.level;d.walk(0,8);d.walk(18,8);d.aim(0,l.input.getFrame().center);d.walk(0,8);d.walk(-2.6,1.1);d.aim(1,l.mouth.getFrame().center);
  g.input.keys.add('ShiftLeft');let crossed=false;
  for(let frame=0;frame<210;frame++){if(frame%35===0)g.input.jumpQueued=true;d.worldMove(0,-1);d.frame();crossed||=g.playerPosition.z<-2.4;}
  d.stop();assert.equal(crossed,false);assert.equal(g.state,'playing');assert.ok(l.governor.omega>10);
 }});
});

test('43: carrying the original body and jumping into the low inspection window cannot avoid the second portal transfer',async()=>{
 const g=await room(43);await runV8Journey(g,{scenario:d=>{
  runExpansionAJourney(d,{stopAfter:'recovered'});d.walk(0,5);d.walk(0,-11);
  g.input.keys.add('ShiftLeft');for(let frame=0;frame<240;frame++){if(frame%30===0)g.input.jumpQueued=true;d.worldMove(0,-1);d.frame();}
  d.stop();assert.ok(g.playerPosition.z>-13.2);assert.equal(g.teleportCount,0);assert.equal(g.state,'playing');
 }});
});

test('46: real cargo damping at the resonant excitation cannot replace the detuning decision',async()=>{
 const g=await room(46);await runV8Journey(g,{scenario:d=>{
  runExpansionAJourney(d,{stopAfter:'loaded-before-tuning'});const l=d.level;assert.equal(l.oscillator.frequency,5.2);
  d.walk(-24,9);d.aim(0,l.input.getFrame().center);d.walk(-14,-6);d.aim(1,l.mouth.getFrame().center);d.stop();
  let highest=-4;for(let frame=0;frame<600;frame++){d.frame();highest=Math.max(highest,l.bridge.position.y);}
  assert.ok(l.oscillator.loaded);assert.ok(highest<3,'Resonant excitation incorrectly reached the upper docks');assert.equal(g.state,'playing');
 }});
});

test('all five authored puzzle causes and portal role sets are distinct',()=>{
 assert.equal(new Set(EXPANSION_A_SPECS.map(s=>s.id)).size,5);
 assert.equal(new Set(EXPANSION_A_SPECS.map(s=>s.concept)).size,5);
});
