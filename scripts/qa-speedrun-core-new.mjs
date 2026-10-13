import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import * as THREE from 'three';
import {playerFixture,wall} from './lib/adversarial-core-cases.mjs';
import {LabPhysics} from '../src/game/LabPhysics.js';
import {orientedBoxFitsPortal} from '../src/game/LabPortals.js';
import {runReleaseAttempt} from './lib/cargo-release-portal-cases.mjs';
import {runAuthoredReleaseCases} from './qa-authored-cargo-release.mjs';

const H=1/120,V=(...p)=>new THREE.Vector3(...p);
function fixture(kind='floor',{thickness=.2,gravity=0}={}){
 const g=playerFixture();g.physics=new LabPhysics({gravity});
 let backing,position,normal;
 if(kind==='floor'){
  backing=wall(g,0,-.1,0,20,.2,20);position=V(0,.02,0);normal=V(0,1,0);
  g.floors.push({minX:-10,maxX:10,minZ:-10,maxZ:10,y:0,mesh:backing});g.playerPosition.set(0,2,0);
 }else if(kind==='ceiling'){
  backing=wall(g,0,4.1,0,20,.2,20);position=V(0,3.98,0);normal=V(0,-1,0);
  g.playerPosition.set(0,1.2,0);g.playerVelocity.set(0,7.8,0);
 }else{
  backing=wall(g,0,5,-thickness/2,20,10,thickness);position=V(0,5,.02);normal=V(0,0,1);
  g.playerPosition.set(0,3.8,1);g.playerVelocity.set(0,0,-4);
 }
 g.portals.place(0,position,normal,V(0,0,-1));
 const destination=wall(g,20.1,5,0,.2,10,10);
 g.portals.place(1,V(19.98,5,0),V(-1,0,0));
 g.portalSurfaceIds=[backing.uuid,destination.uuid];
 for(const c of g.colliders)g.physics.addStaticBox(c.mesh.uuid,c.box);
 return {g,backing,destination};
}
function dispose(g){g.physics.dispose();g.portals.dispose();}
function carryFixture(smallOutlet){
 const {g}=fixture('wall',{thickness:.02,gravity:-19.5});
 const floor=wall(g,0,3.7,3,20,.2,20);
 g.floors.push({minX:-10,maxX:10,minZ:-7,maxZ:13,y:3.8,mesh:floor});
 g.physics.addStaticBox(floor.uuid,g.colliderForMesh(floor).box);
 if(smallOutlet)g.portals.place(1,V(19.98,5,0),V(-1,0,0),undefined,{width:.95,height:.65});
 g.cargo={position:V(0,4.86,.45),velocity:V(),quaternion:new THREE.Quaternion(),group:new THREE.Group()};
 g.physics.createCargo({position:g.cargo.position});g.playerPosition.set(0,3.8,1.3);g.playerGrounded=true;g.playerVelocity.set(0,0,0);g.facing=Math.PI;
 g.animator.triggerInteraction=()=>{};g.companionAnimator={trigger(){}};g.audio.pickup=()=>{};
 g.firstLevel.cargoOnAnyPad=()=>false;g.firstLevel.getLaunch=()=>null;
 assert.equal(g.interact(),true);assert.equal(g.heldCube,g.cargo);
 return g;
}
function carryStep(g){g.updatePlayer(H);g.updateCubes(H);}
function enterThroat(g,depth=.55){
 const p=g.portals.portals[0];let frames=0;
 const distance=()=>g.playerPosition.clone().add(V(0,1.2,0)).sub(p.position).dot(p.normal);
 while(distance()>depth&&frames++<180)g.updatePlayer(H);
 assert.ok(distance()>0&&distance()<=depth,'the ordinary controller must actually enter the throat before crossing');
 assert.equal(g.teleportCount,0);return frames;
}
function panel(mesh,center,normal,size){Object.assign(mesh.userData,{portalable:true,center,normal,portalBounds:{halfWidth:10,halfHeight:10},...(size?{portalSize:size}:{})});return mesh;}
function checkRecovery(g,before,normal){
 const after=g.playerPosition.clone(),delta=after.clone().sub(before);
 assert.ok(delta.length()<1.3,'closing a throat cannot eject the actor to a distant floor edge');
 assert.ok(delta.dot(normal)>0,'partial entry recovers to the same front side');
 assert.ok(delta.clone().addScaledVector(normal,-delta.dot(normal)).length()<1e-8,'contact correction cannot introduce tangential displacement');
 assert.equal(g.teleportCount,0,'normal contact recovery is not a portal traversal');
 for(let i=0;i<30;i++)g.updatePlayer(H);
 assert.ok(g.playerPosition.clone().sub(after).dot(normal)>=-.06,'closed backing must prevent leaving through its underside or opposite face; ordinary tangential gravity remains free');
 assert.ok(Math.abs(g.playerPosition.x-after.x)<.01,'contact recovery cannot eject to a distant lateral edge');
 return {before:before.toArray(),corrected:after.toArray(),after30Frames:g.playerPosition.toArray(),teleports:g.teleportCount};
}
export const newCoreCases=[
 {id:'clear-floor-portal-during-partial-entry',run(){
  const results=[];for(const depth of [1.1,.8,.4,.1]){const {g}=fixture();try{
   const frames=enterThroat(g,depth),before=g.playerPosition.clone(),normal=g.portals.portals[0].normal.clone();
   assert.equal(g.clearPortals(),true);results.push({depth,frames,...checkRecovery(g,before,normal)});
  }finally{dispose(g);}}return results;
 }},
 {id:'clear-wall-and-ceiling-partial-entry',run(){
  const results=[];for(const kind of ['wall','ceiling']){const {g}=fixture(kind);try{
   const frames=enterThroat(g,kind==='wall'?.3:.8),before=g.playerPosition.clone(),normal=g.portals.portals[0].normal.clone();
   assert.equal(g.clearPortals(),true);results.push({kind,frames,...checkRecovery(g,before,normal)});
  }finally{dispose(g);}}return results;
 }},
 {id:'replace-floor-portal-during-partial-entry',run(){
  const {g,backing}=fixture();try{
   enterThroat(g,.7);const before=g.playerPosition.clone(),normal=g.portals.portals[0].normal.clone();
   panel(backing,V(0,.02,0),normal);assert.equal(g.placeOnPanel(0,backing,V(6,.02,0)),true);
   assert.ok(g.portals.portals[0].position.x>5.9);
   return checkRecovery(g,before,normal);
  }finally{dispose(g);}
 }},
 {id:'replace-outlet-with-cargo-only-aperture-during-player-entry',run(){
  const {g,destination}=fixture();try{
   enterThroat(g,.7);const before=g.playerPosition.clone(),normal=g.portals.portals[0].normal.clone();
   panel(destination,V(19.98,5,0),V(-1,0,0),{width:.95,height:.65});
   assert.equal(g.placeOnPanel(1,destination,V(19.98,5,0)),true);
   return checkRecovery(g,before,normal);
  }finally{dispose(g);}
 }},
 {id:'rejected-replacement-and-clear-away-from-throat-do-not-move-actors',run(){
  const {g,backing}=fixture();try{
   const before=g.playerPosition.clone();assert.equal(g.clearPortals(),true);assert.deepEqual(g.playerPosition.toArray(),before.toArray());
   g.portals.place(0,V(0,.02,0),V(0,1,0),V(0,0,-1));g.portals.place(1,V(19.98,5,0),V(-1,0,0));
   g.portalSurfaceIds[0]=backing.uuid;enterThroat(g,.7);panel(backing,V(0,.02,0),V(0,1,0));backing.userData.portalForbidden=true;
   const partial=g.playerPosition.clone(),old=g.portals.portals[0];assert.equal(g.placeOnPanel(0,backing,V(6,.02,0)),false);
   assert.equal(g.portals.portals[0],old);assert.deepEqual(g.playerPosition.toArray(),partial.toArray());
   for(let n=0;n<80&&g.teleportCount===0;n++)g.updatePlayer(H);
   assert.equal(g.teleportCount,1,'an invalid shot must leave the legitimate transit available');
   return {clearBefore:before.toArray(),rejectedPartial:partial.toArray(),legitimateTeleports:g.teleportCount};
  }finally{dispose(g);}
 }},
 {id:'clear-floor-portal-while-free-cargo-straddles-backing',run(){
  const {g}=fixture();try{
   g.playerPosition.set(100,0,100);g.cargo={position:V(0,1,0),velocity:V(0,-8,0),quaternion:new THREE.Quaternion(),group:new THREE.Group()};
   g.physics.createCargo({position:g.cargo.position,velocity:g.cargo.velocity});g.companionAnimator={trigger(){}};
   g.firstLevel.cargoOnAnyPad=()=>false;g.firstLevel.getLaunch=()=>null;
   const id=g.physics.cargoBody.id;let frames=0;
   while(g.cargo.position.y>.25&&frames++<30)g.updateCubes(H);
   assert.equal(g.physics.portalTransports,0);assert.ok(g.cargo.position.y>.02&&g.cargo.position.y<.39);
   const before=g.cargo.position.clone();g.clearPortals();
   for(let n=0;n<30;n++)g.updateCubes(H);
   assert.equal(g.physics.cargoBody.id,id);assert.equal(g.physics.portalTransports,0);
   assert.ok(g.cargo.position.y>=.389,'restoring the floor cannot choose the cargo underside or drop the original body below it');
   assert.ok(Math.hypot(g.cargo.position.x,g.cargo.position.z)<.1);
   return {frames,before:before.toArray(),after:g.cargo.position.toArray(),bodyId:id,portalTransports:0};
  }finally{dispose(g);}
 }},
 {id:'held-cargo-cannot-enter-rejected-player-aperture-before-release-clear',run(){
  const results=[];for(const releaseFirst of [false,true]){const g=carryFixture(true);try{
   const id=g.physics.cargoBody.id;g.move.set(0,-1);let minimumHeldZ=Infinity;
   for(let n=0;n<180;n++){carryStep(g);minimumHeldZ=Math.min(minimumHeldZ,g.cargo.position.z);}
   assert.equal(g.teleportCount,0);assert.equal(g.physics.portalTransports,0);
   assert.ok(minimumHeldZ>.38,'a held box cannot protrude through a cargo-only backing before its blocked owner');
   g.move.set(0,0);if(releaseFirst)g.interact();g.clearPortals();if(!releaseFirst)g.interact();
   let minimumFreeZ=Infinity;for(let n=0;n<90;n++){carryStep(g);minimumFreeZ=Math.min(minimumFreeZ,g.cargo.position.z);}
   assert.equal(g.physics.cargoBody.id,id);assert.equal(g.physics.portalTransports,0);
   assert.ok(minimumFreeZ>.38,'release/clear ordering cannot eject the original body behind the thin source wall');
   results.push({releaseFirst,gravity:-19.5,backingThickness:.02,minimumHeldZ,minimumFreeZ,bodyId:id,portalTransports:0});
  }finally{dispose(g);}}return results;
 }},
 {id:'closing-valid-player-portal-recovers-a-straddling-held-box',run(){
  const g=carryFixture(false);try{
   const id=g.physics.cargoBody.id;g.move.set(0,-1);let n=0;
   while(g.playerPosition.z>.70&&n++<160)carryStep(g);g.move.set(0,0);
   assert.equal(g.teleportCount,0);assert.ok(g.cargo.position.z<.39,'the legitimate open aperture must admit a box ahead of its owner');
   const before=g.cargo.position.clone();g.clearPortals();const corrected=g.cargo.position.clone();
   assert.ok(corrected.z>=.41,'the still-held box must be returned to the original front side before restoring contact');
   assert.ok(corrected.distanceTo(before)<.9);g.interact();
   for(let tick=0;tick<90;tick++){carryStep(g);assert.ok(g.cargo.position.z>.38);}
   assert.equal(g.physics.cargoBody.id,id);assert.equal(g.physics.portalTransports,0);
   return {gravity:-19.5,backingThickness:.02,before:before.toArray(),corrected:corrected.toArray(),after:g.cargo.position.toArray(),bodyId:id};
  }finally{dispose(g);}
 }},
 {id:'held-cargo-release-and-deep-clear-preserve-original-side',run(){
  const attempts=[];
  for(const depth of [.7,.4,.3,.2,.1]){
   for(const clearDelayTicks of [0,1,5,30,null])attempts.push(runReleaseAttempt({depth,clearDelayTicks}));
   attempts.push(runReleaseAttempt({depth,clearFirst:true}));
   attempts.push(runReleaseAttempt({depth,directClear:true}));
  }
  for(const r of attempts){
   assert.ok(r.before.cargo[2]<.02,'Ordinary pickup and movement must actually put the held centre behind the old aperture');
   assert.ok(r.afterRelease.cargo[2]>.41,'Release or direct clear returns the entire owned box to its source front side');
   assert.ok(r.minimumZ>.37,'A released or still-carried original body cannot escape behind its restored wall');
   assert.equal(r.after.playerTeleports,0);assert.equal(r.after.cargoTransports,0);assert.equal(r.sameBody,true);
   if(!r.clearFirst&&!r.directClear)assert.deepEqual(r.afterRelease.velocity,r.before.velocity,'A still-open aperture must retain earned release momentum');
   if(r.depth<=.3)assert.ok(r.before.cargo[2]<-.39,'Deep cases must start with the full original grip behind the old source plane');
  }
  return {scope:'Initial front-side fixture poses/planes only; every throat depth is reached by actual pickup and movement, then production E and wait, plus internal pair-closing lifecycle calls without a player binding. No actor state writes after fixture setup.',gravity:-19.5,sourceWallThickness:.02,attempts};
 }},
];
export async function runNewCoreCases(){
 const results=[];for(const c of newCoreCases){try{results.push({id:c.id,pass:true,evidence:await c.run()});}catch(error){results.push({id:c.id,pass:false,error:String(error)});}}
 return {scope:'Explicit isolated production controller/physics fixtures. Initial poses and portal planes are setup; subsequent motion, internal pair closing and successful/rejected replacement use production methods. These are stress regressions, not authored-level walkthroughs or exhaustive exploit proof.',physicsHz:120,pass:results.every(r=>r.pass),results};
}
export async function runRoom31HeldCargoAttempt(){
 const {createHeadlessGame}=await import('./lab-headless.mjs');
 const {runV8Journey}=await import('../src/game/LabV8Journey.js');
 const {runPost31}=await import('../src/game/LabPostJourneyA.js');
 const g=await createHeadlessGame();g.chamberEdition='foundation';await g.selectLevel(30,false);
 const record={scope:'Authored room 31, ordinary movement, jump, pickup, aim projectiles and release, plus internal pair-closing stress with no player binding. This is not a wholly ordinary-input proof. No actor/body pose, velocity, mechanism target or portal plane is assigned. Full box fit is checked only as evidence; it does not drive gameplay.',level:31,pass:false};
 try{
  const journey=await runV8Journey(g,{scenario:async d=>{
   runPost31(d,{route:'inspect-rack-first',stopBeforeCargoDelivery:true});
   for(const [x,z]of[[0,16],[-15,16],[-15,21]])d.walk(x,z);
   const cargo=g.cargo.position;d.walk(cargo.x+1.25,cargo.z);d.pickup();
   for(const [x,z]of[[-15,21],[-15,16],[0,16],[10,19],[13,19],[13,23],[24,23],[24,20]])d.walk(x,z);
   const source=g.portals.portals[0],bodyId=g.physics.cargoBody.id;
   assert.ok(source.position.distanceTo(d.level.intake.getFrame().center)<.1);
   let minimumHeldDistance=Infinity,minimumFitDistance=Infinity,fullFitFrames=0;
   for(let n=0;n<600;n++){
    if(n%70===0)g.input.jumpQueued=true;
    d.worldMove(-1,THREE.MathUtils.clamp((20-g.playerPosition.z)*3,-1,1));d.frame();
    const distance=g.cargo.position.clone().sub(source.position).dot(source.normal);
    minimumHeldDistance=Math.min(minimumHeldDistance,distance);
    if(orientedBoxFitsPortal(source,g.cargo.position,g.physics.cargoBody.quaternion)){
     fullFitFrames++;minimumFitDistance=Math.min(minimumFitDistance,distance);
    }
   }
   d.stop();assert.ok(fullFitFrames>10,'The attack must actually bring the complete carried box into the aperture footprint');
   assert.ok(minimumHeldDistance>.38);assert.equal(g.physics.portalTransports,0);assert.equal(g.teleportCount,0);
   g.clearPortals();assert.ok(g.interact()&&!g.heldCube);let minimumReleasedDistance=Infinity;
   for(let n=0;n<120;n++){d.frame();minimumReleasedDistance=Math.min(minimumReleasedDistance,g.cargo.position.clone().sub(source.position).dot(source.normal));}
   Object.assign(record,{bodyId,fullFitFrames,minimumHeldDistance,minimumFitDistance,minimumReleasedDistance,player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),playerTeleports:g.teleportCount,cargoTransports:g.physics.portalTransports,rackStroke:d.level.rack.stroke});
   // The impact plane is 10 mm in front of the authored panel; free Cannon
   // contact rests at the physical face with its ordinary solver tolerance.
   assert.ok(minimumReleasedDistance>.37);assert.equal(g.physics.cargoBody.id,bodyId);assert.equal(g.physics.portalTransports,0);
   assert.ok(d.level.rack.stroke<.02);assert.equal(g.state,'playing');
   d.mark('Repeated jump and held-box insertion at the real cargo-only intake remains on the original front side');
  }});
  Object.assign(record,{pass:true,frames:journey.frames,resets:journey.resets,respawns:journey.respawns});
 }catch(error){record.error=String(error);}finally{dispose(g);}
 return record;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const report=await runNewCoreCases();
 if(process.argv.includes('--room31')){report.authoredLevelAttempt=await runRoom31HeldCargoAttempt();report.pass&&=report.authoredLevelAttempt.pass;report.authoredReleaseAttempts=await runAuthoredReleaseCases();report.pass&&=report.authoredReleaseAttempts.pass;}
 fs.mkdirSync('qa',{recursive:true});fs.writeFileSync(process.env.OUT||'qa/speedrun-core-new.json',JSON.stringify(report,null,2)+'\n');
 for(const row of report.results)console.log(row.pass?'PASS':'FAIL',row.id,row.error||'');if(!report.pass)process.exitCode=1;
 if(report.authoredLevelAttempt)console.log(report.authoredLevelAttempt.pass?'PASS':'FAIL','room31-held-box-cargo-only-intake',report.authoredLevelAttempt.error||'');
}
