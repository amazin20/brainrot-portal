import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Body} from 'cannon-es';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runExpansionAJourney} from '../src/game/LabExpansionJourneyA.js';
import {aimLateSurface,installPreciseLateAim} from '../src/game/LabLateCampaignAim.js';
import {OpenChamber} from '../src/game/LabOpenArchitecture.js';

const g=await createHeadlessGame();g.chamberEdition='foundation';
after(()=>{g.physics?.dispose();g.portals?.dispose();});
async function room(){await g.selectLevel(45,false);return {cargo:g.cargo,body:g.physics.cargoBody};}
function dial(d){d.walk(-11.3,7);assert.ok(g.interact());d.walk(-14,-6);}
function collect(d){for(let i=0;i<12;i++){const p=g.cargo.position;d.walk(p.x+1.3,p.z);if(g.playerPosition.distanceTo(g.cargo.position)<2.2){d.pickup();return;}}throw Error('Original cargo pickup not reached');}
function deposit(d,x,z){d.walk(x,z+3);d.walk(x,z+.72);d.stop();d.wait(.3);assert.ok(g.interact());assert.equal(g.heldCube,null);d.wait(.85);}
function measure(d,seconds){
 d.stop();let highest=-4,minTarget=Infinity,maxTarget=-Infinity,contacts=0,powers=0,square=0;
 for(let i=0;i<seconds*60;i++){
  const before=d.level.bed.floor.y;d.frame();const l=d.level;
  square+=((l.bed.floor.y-before)*60)**2;highest=Math.max(highest,l.bridge.position.y);
  minTarget=Math.min(minTarget,l.bridge.stations[1].y);maxTarget=Math.max(maxTarget,l.bridge.stations[1].y);
  contacts+=Number(l.oscillator.loaded);powers+=Number(l.optical.powered);
 }
 return {highest,minTarget,maxTarget,rms:Math.sqrt(square/(seconds*60)),contactFraction:contacts/(seconds*60),powerFraction:powers/(seconds*60)};
}

test('46: visible bed survives static assembly and its kinematic body shares motion, sensor and reset pose',async()=>{
 const flush=OpenChamber.prototype.flush;let captured,disposed=0;
 OpenChamber.prototype.flush=function(){
  if(this.index!==45)return flush.call(this);
  captured=this.world.root.getObjectByName('Driven damping bed');assert.ok(captured);
  assert.ok(![...this.artBins.values()].some(bin=>bin.includes(captured)),'Do not bake a frozen copy of the moving bed');
  captured.geometry.addEventListener('dispose',()=>disposed++);const result=flush.call(this);
  assert.equal(this.world.root.getObjectById(captured.id),captured);assert.equal(disposed,0);return result;
 };
 let original;try{original=await room();}finally{OpenChamber.prototype.flush=flush;}
 await runV8Journey(g,{scenario:d=>{
  const l=d.level,solid=g.physics.solids.get(l.bed.collider.mesh.uuid);assert.equal(solid.body.type,Body.KINEMATIC);
  assert.equal(l.bed.mesh,captured);let min=Infinity,max=-Infinity;
  for(let i=0;i<600;i++){
   d.frame();const visible=new THREE.Box3().setFromObject(captured),proxy=l.bed.collider.box;
   assert.ok(visible.min.distanceTo(proxy.min)<1e-6&&visible.max.distanceTo(proxy.max)<1e-6);
   assert.ok(Math.abs(visible.max.y-l.bed.floor.y)<1e-6);
   assert.ok(Math.abs(solid.body.velocity.y-l.oscillator.bedVelocity)<1e-5,'Cargo solver must receive the actual support velocity');
   assert.ok(Math.abs(solid.body.position.y-visible.getCenter(new THREE.Vector3()).y)<1e-6);
   min=Math.min(min,visible.max.y);max=Math.max(max,visible.max.y);
  }
  assert.ok(max-min>.1,'Actually exercise visible suspension travel');
  const state=JSON.stringify({x:l.oscillator.x,v:l.oscillator.v,r:l.oscillator.meanSquareVelocity,s:l.oscillator.stroke,y:l.bed.floor.y});
  for(const alpha of [0,.25,.5,1])l.renderUpdate(alpha);
  assert.equal(JSON.stringify({x:l.oscillator.x,v:l.oscillator.v,r:l.oscillator.meanSquareVelocity,s:l.oscillator.stroke,y:l.bed.floor.y}),state);
 }});
 g.resetRun(true);const l=g.firstLevel;
 assert.ok(Math.abs(l.bed.floor.y-(4.16+l.oscillator.x*.15))<1e-10);assert.equal(l.oscillator.meanSquareVelocity,0);assert.equal(l.oscillator.stroke,0);
 assert.equal(g.cargo,original.cargo);assert.equal(g.physics.cargoBody,original.body);assert.equal(disposed,0);
 await g.selectLevel(44,false);assert.equal(disposed,1,'The live bed geometry must be released once on a real room switch');
});

test('46: real low-frequency light without the original friction shoe cannot fill the bridge actuator',async t=>{
 const original=await room();
 const proof=await runV8Journey(g,{scenario:d=>{
  runExpansionAJourney(d,{route:'light-before-damp',stopAfter:'undamped'});dial(d);
  const all=measure(d,32);assert.equal(all.contactFraction,0);assert.equal(all.powerFraction,1);
  t.diagnostic(JSON.stringify({case:'unloaded detuned',...all}));
  assert.ok(all.highest<2.9,'Unloaded quiet intervals filled an upper-dock crossing');
  assert.ok(all.rms>.04,'Unloaded bed must actually move, rather than retain a contact lock');
  assert.equal(g.state,'playing');assert.equal(g.firstLevel.oscillator.clamped,false);
 }});
 assert.equal(proof.resets+proof.respawns,0);assert.equal(g.cargo,original.cargo);assert.equal(g.physics.cargoBody,original.body);
});

test('46: original removal, reloading and real beam diversion control the actuator before the downstream clamp',async t=>{
 const original=await room();
 const proof=await runV8Journey(g,{scenario:d=>{
  runExpansionAJourney(d,{stopAfter:'damped'});const l=d.level;d.wait(12);
  const quiet=measure(d,12);assert.equal(quiet.contactFraction,1);assert.equal(quiet.powerFraction,1);assert.equal(quiet.minTarget,4);
  collect(d);d.walk(-25,7);deposit(d,-25,4);d.walk(-14,-6);d.wait(6);
  const removed=measure(d,18);assert.equal(removed.contactFraction,0);assert.equal(removed.powerFraction,1);
  t.diagnostic(JSON.stringify({case:'loaded/removed actual bed RMS',loaded:quiet,removed}));
  assert.ok(removed.rms>quiet.rms*1.3);assert.ok(removed.highest<-3.9);assert.equal(removed.maxTarget,-4);
  collect(d);deposit(d,-18,4);d.walk(-14,-6);
  d.until(()=>l.bridge.position.y>3.98,16,'Same original body did not restore the motion-controlled actuator');
  const frame=l.mouth.getFrame();aimLateSurface(d,1,l.mouth,frame.center.clone().addScaledVector(frame.right,1.5));
  d.wait(3);const dark=measure(d,10);assert.equal(dark.contactFraction,1);assert.equal(dark.powerFraction,0);
  assert.ok(dark.rms<.04);assert.equal(dark.maxTarget,-4);assert.ok(dark.highest<-3.9);
  aimLateSurface(d,1,l.mouth);d.until(()=>l.optical.powered&&l.bridge.position.y>3.98,8,'Real normal shot did not restore powered pressure');
  d.walk(-15,-15);d.walk(14,-15);d.walk(16.7,-17);assert.ok(g.interact());assert.equal(l.oscillator.clamped,true);
  d.walk(14,-15);d.walk(-15,-15);collect(d);d.walk(-25,4);d.wait(6);
  const retained=measure(d,12);assert.equal(retained.contactFraction,0);assert.equal(retained.minTarget,4);
  deposit(d,-25,4);d.walk(-15,-15);d.walk(14,-15);d.walk(16.7,-17);
  assert.ok(g.interact());assert.equal(l.oscillator.clamped,false);d.wait(2);
  const released=measure(d,4);assert.equal(released.contactFraction,0);assert.equal(released.maxTarget,-4);assert.ok(released.highest<-3.9);
  t.diagnostic(JSON.stringify({case:'real optical diversion and clamp release',dark,retained,released}));
  // Return through the actual lower floor and western ramp, without reset.
  d.walk(14,9);d.walk(0,9);d.until(()=>g.playerGrounded&&g.playerPosition.y<-3.9,3,'Lower recovery floor not reached');
  d.walk(-24,27);d.walk(-24,9);assert.ok(g.playerPosition.y>3.9,'Western recovery ramp not climbed');
  collect(d);deposit(d,-18,4);d.walk(-14,-6);d.until(()=>l.bridge.position.y>3.98,16,'Original body did not restore pressure after actual clamp release');
  d.walk(-15,-15);d.walk(14,-15);d.walk(16.7,-17);assert.ok(g.interact());assert.equal(l.oscillator.clamped,true);
  d.walk(14,-15);d.walk(-15,-15);collect(d);d.walk(-15,-12);d.walk(14,-12);d.walk(22,-12);d.walk(22,-15);
  d.until(()=>g.state==='won',3,'Both original bodies did not use the retained crossing after recovery');
 }});
 assert.equal(proof.pass,true);assert.equal(proof.resets+proof.respawns,0);assert.equal(g.cargo,original.cargo);assert.equal(g.physics.cargoBody,original.body);
});

for(const loaded of [false,true])test(`46: earliest reachable optical pair and real sprint jumps cannot cross ${loaded?'loaded resonant':'unloaded'} startup`,async t=>{
 const original=await room();
 const proof=await runV8Journey(g,{scenario:d=>{
  if(loaded)runExpansionAJourney(d,{stopAfter:'loaded-before-tuning'});
  else installPreciseLateAim(d);
  const l=d.level;aimLateSurface(d,0,l.input);aimLateSurface(d,1,l.mouth);
  d.until(()=>l.optical.powered,1,'Early real optical pair did not hit receiver');
  const firstConfirmedPowerSimSeconds=l.oscillator.phase/5.2;
  assert.equal(l.oscillator.frequency,5.2);
  d.walk(-9.5,-17);assert.ok(g.playerPosition.y>3.9&&Math.abs(g.playerPosition.x+9.5)<.3,'Actually reach the upper bridge lip');
  g.input.keys.add('ShiftLeft');let highestBridge=-4,highestEast=-4;
  for(let i=0;i<480;i++){
   if(i%45===0)g.input.jumpQueued=true;d.worldMove(1,0);d.frame();
   highestBridge=Math.max(highestBridge,l.bridge.position.y);
   if(g.playerPosition.x>8)highestEast=Math.max(highestEast,g.playerPosition.y);
  }
  d.stop();assert.ok(highestBridge<2.9);assert.ok(highestEast<3.1,'Sprint/jump reached the upper eastern dock');
  t.diagnostic(JSON.stringify({case:loaded?'loaded resonant startup':'unloaded startup',firstConfirmedPowerSimSeconds,highestBridge,highestEast,player:g.playerPosition.toArray()}));
  assert.equal(g.state,'playing');assert.equal(l.oscillator.clamped,false);
 }});
 assert.equal(proof.resets+proof.respawns,0);assert.equal(g.cargo,original.cargo);assert.equal(g.physics.cargoBody,original.body);
});

test('46: ordinary rapid frequency changes without cargo cannot accumulate a dock-height actuator stroke',async t=>{
 const original=await room();
 const proof=await runV8Journey(g,{scenario:d=>{
  installPreciseLateAim(d);const l=d.level;aimLateSurface(d,0,l.input);aimLateSurface(d,1,l.mouth);
  d.walk(-11.3,7);let highest=-4;
  for(const frames of [1,8,31,90,10,2,120,60,3,24,75,13,1,91,7,30]){
   assert.ok(g.interact(),'Actual frequency dial E must be accessible');
   for(let i=0;i<frames;i++){d.frame();highest=Math.max(highest,l.bridge.position.y);}
  }
  if(l.oscillator.frequency>4)assert.ok(g.interact());
  const low=measure(d,32);highest=Math.max(highest,low.highest);
  assert.equal(low.powerFraction,1);assert.equal(low.contactFraction,0);assert.ok(highest<2.9);
  t.diagnostic(JSON.stringify({case:'rapid E frequencies',highest,...low}));
  assert.equal(g.state,'playing');assert.equal(l.oscillator.clamped,false);
 }});
 assert.equal(proof.resets+proof.respawns,0);assert.equal(g.cargo,original.cargo);assert.equal(g.physics.cargoBody,original.body);
});
