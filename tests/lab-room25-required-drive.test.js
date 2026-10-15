import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import {makePortalFrame,orientedBoxFitsPortal,uprightCapsuleFitsPortal,portalCrossing} from '../src/game/LabPortals.js';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runRoom25NormalPlay} from './helpers/lab-room25-normal-play-driver.js';

const game=await createHeadlessGame(),observations=[];
after(()=>{game.firstLevel?.dispose?.();game.physics.dispose();game.portals.dispose();
 if(process.env.ROOM25_REQUIRED_EVIDENCE_DIR){fs.mkdirSync(process.env.ROOM25_REQUIRED_EVIDENCE_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.ROOM25_REQUIRED_EVIDENCE_DIR,'normal-play-paired-causal-observations.json'),JSON.stringify({kind:'isolated Room25 actual normal Play paired optical-drive review',observations,fullRoomAccepted:false,nativeAccepted:false,publicationAccepted:false,allBypassesAccepted:false},null,2));}});

async function observe(label,run){
 await game.selectLevel(24,true);
 const cargo=game.cargo,body=game.physics.cargoBody,shape=body.shapes[0],world=game.physics.world,m=game.firstLevel.state.optical.machine,o=game.firstLevel.state.optical;
 const r={label,normalPlaySpawn:game.playerPosition.toArray(),normalState:game.state,bodyId:body.id,bodyMass:body.mass,physicsSteps:0,maxHeight:-Infinity,minHeight:Infinity,maxCargoY:-Infinity,positiveMotorSteps:0,firstReceiverSteps:0,secondReceiverSteps:0,motorLitSteps:0,loadedSteps:0,invalidOriginalSteps:0,samples:[],report:null,error:null};
 assert.equal(game.state,'playing');assert.equal(game.portals.ready,false);assert.deepEqual(game.playerPosition.toArray(),game.firstLevel.spawn.toArray?.()??game.firstLevel.spawn);
 const post=()=>{r.physicsSteps++;r.maxHeight=Math.max(r.maxHeight,m.height);r.minHeight=Math.min(r.minHeight,m.height);r.maxCargoY=Math.max(r.maxCargoY,body.position.y);
  if(m.diagnostics().lastForce?.motorForce>0)r.positiveMotorSteps++;if(o.motorLit)r.motorLitSteps++;if(o.receivers[0])r.firstReceiverSteps++;if(o.receivers[1])r.secondReceiverSteps++;if(m.loaded)r.loadedSteps++;
  if(game.cargo!==cargo||game.physics.cargoBody!==body||body.shapes[0]!==shape||body.mass!==3.2||body.type!==1||body.world!==world)r.invalidOriginalSteps++;
  if(world.stepnumber%120===0)r.samples.push({step:world.stepnumber,player:game.playerPosition.toArray(),cargo:body.position.toArray(),held:Boolean(game.heldCube),height:m.height,velocity:m.velocity,normalLoad:m.normalLoad,pressureFraction:m.pressureFraction,receivers:[...o.receivers],motorEnabled:m.motorEnabled,motorLit:o.motorLit,motorForce:m.diagnostics().lastForce?.motorForce??null});};
 world.addEventListener('postStep',post);
 try{r.report=await run({m,o,r});}catch(e){r.error=String(e.stack??e);throw e;}finally{world.removeEventListener('postStep',post);r.finish={state:game.state,sameCargo:game.cargo===cargo,sameBody:game.physics.cargoBody===body,sameShape:body.shapes[0]===shape,motorWork:m.diagnostics().motorWork,rackWork:m.diagnostics().rackWork,height:m.height,cargo:body.position.toArray(),motorEnabled:m.motorEnabled,receivers:[...o.receivers]};observations.push(r);}
 assert.equal(r.invalidOriginalSteps,0);return r;
}
for(const order of ['weight-first','light-first'])test(`25 required drive: ${order} ordinary normal Play route raises original cargo and completes both optical passenger lifts`,async()=>{
 const r=await observe(order,async()=>runRoom25NormalPlay(game,{journeyOptions:{order,interruptLight:order==='light-first'}}));
 assert.equal(game.state,'won');assert.equal(r.report.pass,true);assert.equal(r.report.resets+r.report.respawns+r.report.cargoResets,0);
 assert.ok(r.maxHeight>8.95&&r.maxCargoY>9.1);assert.ok(r.positiveMotorSteps>100&&r.loadedSteps>100);assert.ok(r.firstReceiverSteps>100&&r.secondReceiverSteps>100);
 assert.ok(r.report.milestones.some(s=>s.name==='first optical receiver raised the loaded counterweight onto a physical balcony'));
 assert.ok(r.report.milestones.some(s=>s.name==='balcony retrieval reverses both linked shadows without a cargo portal'));
});
test('25 required drive: ordinary current-light interruption and lower-floor recovery complete the full route with the same original body',async()=>{
 const r=await observe('freight-light-cut-and-recovery',async()=>runRoom25NormalPlay(game,{journeyOptions:{interruptFreightLight:true}}));
 assert.equal(game.state,'won');assert.equal(r.report.pass,true);assert.equal(r.report.resets+r.report.respawns+r.report.cargoResets,0);
 assert.ok(r.report.milestones.some(s=>s.name.startsWith('retargeted portal removes current freight mirror supply')));
 assert.ok(r.report.milestones.some(s=>s.name.startsWith('ordinary lower-floor portal restores light')));
 assert.ok(r.samples.some(s=>s.motorEnabled&&!s.motorLit&&s.velocity<-.2));
 assert.ok(r.samples.some(s=>s.motorEnabled&&s.motorLit&&s.velocity>.2));
});
async function attemptAuthoredFirstAscentDespiteDisconnect(d){
 const {walk,pickup,wait,aim,until,level}=d,p=level.panels;
 walk(-14,9);pickup();walk(-14,8.7);walk(-7,8.7);game.input.jumpQueued=true;walk(-7,10);
 walk(-7,13.8);walk(-7,12.7);wait(.5);assert.equal(game.interact(),true);wait(1.2);
 until(()=>level.state.optical.travel>.85,15,'The unchanged original load did not clear its real first shutter');
 walk(-7,6);walk(17,6);walk(17,12);const centre=p['light-intake'].getFrame().center;
 aim(0,centre);aim(0,centre.clone().add(centre.clone().sub(game.portals.portals[0].position)));
 walk(17,6);walk(-20,6);walk(-20,-10);walk(-14,-10);walk(-15.2,-10.7);aim(1,p['lower-relay'].getFrame().center);wait(.2);
 walk(-14,-10);walk(-7,-10);walk(-7,7.9);assert.equal(game.interact(),true);
 walk(-7,-10);walk(-14,-10);
 until(()=>game.playerPosition.y>8.97,25,'Declared optical-drive disconnect prevents the first passenger ascent');
}
for(const component of ['moving-mirror-reflection','motor-force-supply'])test(`25 required drive: declared ${component} disconnect prevents the same authored normal Play cargo ascent`,async()=>{
 let result;
 const r=await observe(component,async({m,o,r})=>{
  const oldRadius=o.movingMirror.radius,oldForce=m.budget.motorForce;
  if(component==='moving-mirror-reflection')o.movingMirror.radius=0;else m.budget.motorForce=0;
  r.declaredComponentMutation=component==='moving-mirror-reflection'?{property:'movingMirror.radius',from:oldRadius,to:0}:{property:'budget.motorForce',from:oldForce,to:0};
  try{await assert.rejects(runRoom25NormalPlay(game,{scenario:attemptAuthoredFirstAscentDespiteDisconnect}),error=>{assert.match(error.message,/Declared optical-drive disconnect prevents the first passenger ascent/);r.expectedFailureReport=error.ordinaryReport;return true;});result={expectedAuthoredRouteFailure:true};return result;}
  finally{o.movingMirror.radius=oldRadius;m.budget.motorForce=oldForce;}
 });
 assert.equal(game.state,'playing');assert.equal(r.expectedFailureReport.resets+r.expectedFailureReport.respawns+r.expectedFailureReport.cargoResets,0);assert.equal(r.positiveMotorSteps,0);assert.equal(r.firstReceiverSteps,0);assert.equal(r.secondReceiverSteps,0);
 assert.ok(Math.abs(r.maxHeight)<.01&&Math.abs(r.minHeight)<.01);assert.ok(r.maxCargoY<3);assert.ok(r.loadedSteps>100);assert.equal(r.finish.motorEnabled,true);
});
test('25 required drive: manufactured nonportal freight deck retains its original dynamic load support',async()=>{
 await observe('nonportal-deck',async({m})=>runRoom25NormalPlay(game,{scenario:d=>{
  const deck=d.level.mechanismSurfaces['shadow-counterweight'];assert.equal(deck.portal,false);assert.equal(deck.mesh.userData.portalable,undefined);assert.equal(game.portalPanels.includes(deck.mesh),false);
  assert.ok(m.parts.some(p=>p.mesh===deck.mesh&&p.body===m.deckBody));assert.ok(game.colliders.includes(deck.collider));assert.ok(game.floors.some(f=>f.mesh===deck.mesh));
  const tiles=[];deck.group.traverse(n=>{if(n.isInstancedMesh)tiles.push(n);});assert.ok(tiles.length>0&&tiles.every(n=>!n.userData.portalTile));
  d.walk(-7,6);d.walk(-7,7.9);d.look(deck.getFrame().center);assert.equal(game.firePortal(0),true);
  d.until(()=>!game.portalShots.queue.length&&!game.portalShots.active.length,2,'Deck shot did not resolve');assert.equal(game.portalShots.lastImpact?.valid,false);assert.equal(game.portalShots.lastImpact?.reason,'surface');
 }}));
});

test('25 required drive: real optical mouths reject the entire unmodified cargo and capsule in either direction',async()=>{
 await game.selectLevel(24,true);
 const body=game.physics.cargoBody,shape=body.shapes[0],V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
 assert.deepEqual(shape.halfExtents.toArray(),[.39,.39,.39]);assert.equal(body.mass,3.2);
 for(const name of ['light-intake','lower-relay','upper-relay']){
  const panel=game.firstLevel.panels[name],f=panel.getFrame();assert.equal(panel.width,.82);assert.equal(panel.height,.82);
  assert.deepEqual(panel.mesh.userData.portalSize,{width:.32,height:.32});
  const tiny=makePortalFrame(f.center,f.normal,f.up,panel.mesh.userData.portalSize);
  const full=makePortalFrame(f.center.clone().add(V(20,0,0)),V(-1,0,0));
  assert.equal(uprightCapsuleFitsPortal(tiny,2.4,.43),false);
  // Every rotated cube contains its 0.39 m inscribed sphere, already wider
  // than this 0.32 m half aperture. These 1000 orientations also exercise the
  // production whole-corner predicate without resizing the original shape.
  for(let i=0;i<10;i++)for(let j=0;j<10;j++)for(let k=0;k<10;k++){
   const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(i*Math.PI/5,j*Math.PI/5,k*Math.PI/5));
   assert.equal(orientedBoxFitsPortal(tiny,tiny.position,q,shape.halfExtents.x),false);
  }
  for(const [entry,exit] of [[tiny,full],[full,tiny]]){
   const front=entry.position.clone().addScaledVector(entry.normal,1),back=entry.position.clone().addScaledVector(entry.normal,-1),velocity=entry.normal.clone().multiplyScalar(-6);
   assert.equal(portalCrossing(entry,exit,back,front,velocity,.43,{capsuleHeight:2.4}),null);
   assert.equal(portalCrossing(entry,exit,back,front,velocity,.39,{boxQuaternion:new THREE.Quaternion(),boxHalfSize:shape.halfExtents.x}),null);
  }
 }
 assert.equal(game.physics.cargoBody,body);assert.equal(body.shapes[0],shape);
});

test('25 required drive: legal tiny relay charges pass while timed original-held ground ferry meets the physical housing',async()=>{
 const r=await observe('small-optical-mouth-held-ferry',async()=>runRoom25NormalPlay(game,{scenario:d=>{
  const p=d.level.panels;
  for(const target of [[-7,6],[17,6],[17,-5]])d.walk(...target);
  d.aim(1,p['upper-relay'].getFrame().center);d.walk(17,12);d.aim(0,p['light-intake'].getFrame().center);
  assert.equal(game.portals.ready,true);assert.ok(game.portals.portals.every(p=>p.width===.32&&p.height===.32));
  for(const target of [[17,6],[-7,6]])d.walk(...target);
  for(let n=0;n<3&&!game.heldCube;n++){d.walk(game.cargo.position.x+1.1,game.cargo.position.z);game.interact();if(!game.heldCube)d.wait(.2);}
  assert.equal(game.heldCube,game.cargo);d.wait(.55);
  for(const target of [[-7,6],[17,6],[15,16]])d.walk(...target);
  let jumps=0;
  for(let attempt=0;attempt<3;attempt++){
   d.walk(15,16);game.input.keys.add('ShiftLeft');d.worldMove(-1,0);let queued=false;
   for(let n=0;n<240;n++){if(!queued&&game.playerPosition.x<10.15&&game.playerGrounded){game.input.jumpQueued=true;queued=true;jumps++;}d.frame();}
   d.stop();d.wait(1);
  }
  assert.equal(jumps,3);assert.equal(game.teleportCount,0);assert.ok(game.playerPosition.x>9.4&&game.playerPosition.y<.1);assert.equal(game.heldCube,game.cargo);
  assert.equal(game.state,'playing');assert.equal(d.level.state.optical.machine.motorEnabled,false);
 }}));
 assert.equal(r.report.resets+r.report.respawns+r.report.cargoResets,0);assert.equal(r.positiveMotorSteps,0);assert.equal(r.firstReceiverSteps,0);assert.ok(r.maxHeight<.01);
});

