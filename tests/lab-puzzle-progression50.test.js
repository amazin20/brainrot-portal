import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Body,HingeConstraint,LockConstraint} from 'cannon-es';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runPuzzleProgression50,recoverPuzzleProgression50} from '../src/game/LabPuzzleProgression50Journey.js';
import {installPreciseLateAim} from '../src/game/LabLateCampaignAim.js';
import {makePortalFrame,uprightCapsuleFitsPortal,orientedBoxFitsPortal} from '../src/game/LabPortals.js';

const V=(...p)=>new THREE.Vector3(...p);
let shared;
async function room(){shared??=await createHeadlessGame();shared.chamberEdition='foundation';shared.puzzleProgression=true;await shared.selectLevel(49,false);return shared;}
const scenario=(g,fn)=>runV8Journey(g,{scenario:fn});
function clean(r){assert.equal(r.pass,true);assert.equal(r.resets,0);assert.equal(r.respawns,0);}
function cargoContact(g,cup){return g.physics.world.contacts.some(j=>(j.bi===cup.body&&j.bj===g.physics.cargoBody)||(j.bj===cup.body&&j.bi===g.physics.cargoBody));}
function frame(surface){const f=surface.getFrame();return makePortalFrame(f.center,f.normal,f.up,surface.mesh.userData.portalSize);}
function rawShot(d,surface){d.look(surface.getFrame().center);assert.equal(d.game.firePortal(1),true);d.until(()=>!d.game.portalShots.queue.length&&!d.game.portalShots.active.length,3,'Ordinary charge did not complete');return d.game.portalShots.lastImpact;}

for(const [aspect,recover]of [[16/9,false],[16/10,true]])test(`50 ordinary joint route ${aspect}; dry recovery ${recover}`,async()=>{
 const g=await room();g.camera.aspect=aspect;g.camera.updateProjectionMatrix();const cargo=g.cargo,body=g.physics.cargoBody,player=g.playerGroup;
 let preparedB,preparedNormal,finalExit,wallNormal,aSamples=0,aFit=0,bFit=0;
 const returnStarts=[],passiveReturns=[],interact=g.interact;
 g.interact=function(...args){const r=this.firstLevel.rotor,before=this.heldCube,start={time:this.physics.world.time,angle:r.angle,omega:r.body.angularVelocity.z,contact:r.loaded('a')||r.loaded('b')};const result=interact.apply(this,args);if(!before&&this.heldCube&&Math.abs(start.angle)>1.4)returnStarts.push(start);return result;};
 const update=g.updatePlaying;
 g.updatePlaying=function(dt){update.call(this,dt);if(this.firstLevel.rotor.body){aSamples++;if(uprightCapsuleFitsPortal(frame(this.firstLevel.rotor.cups[0].feed),2.4,.43))aFit++;if(uprightCapsuleFitsPortal(frame(this.firstLevel.rotor.cups[1].feed),2.4,.43))bFit++;}};
 let receipt;
 try{receipt=await scenario(g,d=>{
  const mark=d.mark;
  d.mark=name=>{
   const r=d.level.rotor;
   if(name.startsWith('Retrieve the original')||name.startsWith('Removing the second')){const start=returnStarts.shift();assert.ok(start?.contact);passiveReturns.push({...start,elapsed:g.physics.world.time-start.time,returnedAngle:r.angle,returnedOmega:r.body.angularVelocity.z,cupOmegas:r.cups.map(c=>c.body.angularVelocity.z)});assert.ok(Math.abs(r.body.angularVelocity.z)<.008);}
   if(name.startsWith('Original free weight')){assert.ok(r.angle>1.48);assert.equal(r.loaded('a'),true);assert.ok(cargoContact(g,r.cups[0]));assert.equal(g.physics.portalTransports,1);}
   if(name.startsWith('First weighted pose')){preparedB=g.portals.portals[1];preparedNormal=preparedB.normal.clone();assert.equal(preparedB.surfaceId,r.cups[1].feed.mesh.uuid);assert.equal(r.loaded('b'),false);}
   if(name.startsWith('Retrieve the original')){assert.equal(g.portals.portals[1],preparedB);assert.ok(preparedB.normal.distanceTo(preparedNormal)>.8);assert.ok(Math.abs(r.angle)<.061);assert.equal(g.heldCube,cargo);assert.equal(r.loaded('a'),false);}
   if(name.startsWith('The same cargo')){assert.ok(r.angle< -1.48);assert.equal(r.loaded('b'),true);assert.ok(cargoContact(g,r.cups[1]));assert.equal(g.physics.portalTransports,2,'The two free deliveries must not bounce through the same aperture');}
   if(name.startsWith('Prepare the final')){
    finalExit=g.portals.portals[1];wallNormal=finalExit.normal.clone();assert.equal(finalExit.surfaceId,r.paneB.mesh.uuid);assert.equal(r.loaded('b'),true);
    if(recover){d.walk(16,-7);d.walk(16,-18);d.walk(11,-18);d.wait(.5);assert.equal(g.state,'playing');assert.equal(g.heldCube,null);assert.equal(r.loaded('b'),true);assert.ok(g.cargo.position.distanceTo(V(11,22,-18))>10);d.walk(16,-18);d.walk(16,-7);d.walk(12,-7);}
   }
   if(name.startsWith('Removing the second')){assert.equal(g.portals.portals[1],finalExit);assert.ok(finalExit.normal.distanceTo(wallNormal)>.9);assert.ok(finalExit.normal.y>.99);assert.equal(g.heldCube,cargo);assert.equal(r.loaded('b'),false);}
   mark(name);
  };
  runPuzzleProgression50(d,{recover});
 });}finally{g.updatePlaying=update;g.interact=interact;}
 clean(receipt);assert.equal(g.state,'won');assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);assert.equal(g.playerGroup,player);assert.ok(receipt.milestones.length>=9);assert.ok(receipt.teleports>=3);assert.ok(aSamples>1000);assert.equal(aFit,0,'Actual first-delivery transient must not admit an upright passenger');assert.ok(g.playerPosition.y>21.9);assert.equal(bFit,0,'Actual second freight head must not admit an upright passenger');assert.equal(passiveReturns.length,2);console.info('50 measured passive returns',JSON.stringify({aspect,passiveReturns}));
 if(recover)assert.match(receipt.milestones[0].name,/Continuous dry service floor/);
});

test('50 unweighted actual spring hinge and both cups remain at equilibrium',async()=>{
 const g=await room(),cargo=g.cargo,body=g.physics.cargoBody;
 const receipt=await scenario(g,d=>runPuzzleProgression50(d,{noCargo:true}));clean(receipt);const r=g.firstLevel.rotor;
 assert.equal(r.body.type,Body.DYNAMIC);assert.equal(r.counterweight.type,Body.DYNAMIC);assert.ok(r.counterweightLock instanceof LockConstraint);
 for(const c of r.cups){assert.equal(c.body.type,Body.DYNAMIC);assert.ok(c.hinge instanceof HingeConstraint);assert.equal(r.loaded(c.name),false);}
 assert.ok(r.hinge instanceof HingeConstraint);assert.ok(Math.abs(r.angle)<.01);assert.equal(g.teleportCount,0);assert.equal(g.physics.portalTransports,0);assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);
});

test('50 the old touching-court route falls to the service floor and recovers without portals',async()=>{
 const g=await room();const receipt=await scenario(g,d=>{
  d.walk(-29,14);d.walk(-12,13);d.wait(.5);assert.ok(g.playerPosition.y< -3.8);assert.equal(g.teleportCount,0);
  d.walk(-4.65,13.5);assert.ok(g.playerPosition.y< -3.8);assert.equal(d.level.rotor.loaded('a'),false);assert.equal(d.level.rotor.loaded('b'),false);assert.equal(g.portals.ready,false);
  recoverPuzzleProgression50(d);assert.ok(g.playerPosition.y>7.9);assert.equal(g.teleportCount,0);
 });clean(receipt);
});

test('50 initial court floor shots cannot bypass first cargo contact through the west gallery',async()=>{
 const g=await room();const receipt=await scenario(g,d=>{
  installPreciseLateAim(d);d.walk(-30,25);d.aim(0,d.level.departureEntry.getFrame().center);
  for(const [x,z]of [[-30,25],[-22,13.2]]){d.walk(x,z);const shot=rawShot(d,d.level.galleryFeed.surface);assert.equal(Boolean(shot.valid&&g.portals.portals[1]?.surfaceId===d.level.galleryFeed.surface.mesh.uuid),false);}
  assert.equal(g.teleportCount,0);assert.equal(g.physics.portalTransports,0);assert.equal(d.level.rotor.loaded('a'),false);assert.equal(d.level.rotor.loaded('b'),false);
 });clean(receipt);
});

test('50 empty opposite freight and early final pane cannot be addressed from the first court or old northern service views',async()=>{
 const g=await room();const receipt=await scenario(g,d=>{
  installPreciseLateAim(d);const target=d.level.rotor.cups[1].feed;
  for(const [x,z]of [[-22,25],[-4.7,-23],[8,-30.5],[-40,-30.5]]){
   if(z<0&&g.playerPosition.y>7.9){d.walk(-29,11);d.until(()=>g.playerGrounded&&g.playerPosition.y< -3.8,6,'Ordinary service descent failed');d.walk(-36,-28);}
   if(x>0)d.walk(x,-28);d.walk(x,z);const shot=rawShot(d,target);
   assert.equal(Boolean(shot.valid&&g.portals.portals[1]?.surfaceId===target.mesh.uuid),false);const earlyGoal=rawShot(d,d.level.rotor.paneB);assert.equal(Boolean(earlyGoal.valid&&g.portals.portals[1]?.surfaceId===d.level.rotor.paneB.mesh.uuid),false);
  }
  assert.equal(g.teleportCount,0);assert.equal(g.physics.portalTransports,0);assert.equal(d.level.rotor.loaded('b'),false);assert.ok(Math.abs(d.level.rotor.angle)<.01);
 });clean(receipt);
});

test('50 B-first free delivery remains on the real original pad after the wrong cup shot is blocked',async()=>{
 const g=await room(),cargo=g.cargo,body=g.physics.cargoBody;const receipt=await scenario(g,d=>{
  installPreciseLateAim(d);d.walk(-22,25);d.aim(0,d.level.cargoFeed.surface.getFrame().center);const shot=rawShot(d,d.level.rotor.cups[1].feed);assert.equal(shot.valid,false);
  d.walk(-30,29);d.pickup();const p=d.level.cargoFeed.surface.getFrame().center;d.look(p);d.walk(p.x,p.z+2.5);d.walk(p.x,p.z+.72);d.wait(.6);assert.equal(g.interact(),true);assert.equal(g.heldCube,null);d.walk(p.x,p.z+2.8);d.wait(2);
  assert.equal(g.physics.portalTransports,0);assert.equal(g.teleportCount,0);assert.equal(d.level.cargoFeed.loaded(),true);assert.equal(d.level.rotor.loaded('a'),false);assert.equal(d.level.rotor.loaded('b'),false);assert.ok(Math.abs(d.level.rotor.angle)<.01);
 });clean(receipt);assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);
});

test('50 ordinary passenger reaches the upper joint goal alone and cannot finish',async()=>{
 const g=await room(),cargo=g.cargo,body=g.physics.cargoBody,player=g.playerGroup;g.camera.aspect=16/9;g.camera.updateProjectionMatrix();
 const receipt=await scenario(g,d=>runPuzzleProgression50(d,{leaveCargo:true}));clean(receipt);assert.equal(g.state,'playing');assert.equal(g.heldCube,null);assert.ok(g.playerPosition.distanceTo(V(11,22,-18))<.4);assert.ok(g.playerPosition.distanceTo(g.cargo.position)>4);assert.ok(g.cargo.position.y<10);assert.equal(g.physics.portalTransports,2);assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);assert.equal(g.playerGroup,player);
});

test('50 prepared B freight rejects an ordinary passenger holding the first retrieved weight',async()=>{
 const g=await room(),cargo=g.cargo,body=g.physics.cargoBody;const receipt=await scenario(g,d=>{
  runPuzzleProgression50(d,{stopAfter:'returned'});const before=g.teleportCount,r=d.level.rotor;
  assert.equal(g.heldCube,cargo);assert.equal(r.loaded('b'),false);assert.equal(uprightCapsuleFitsPortal(g.portals.portals[1],2.4,.43),false);
  d.walk(-12,-5.5);d.walk(-12,-9);d.wait(1);
  let highest=g.playerPosition.y;for(let i=0;i<120;i++){if(i%45===0)g.input.jumpQueued=true;d.frame();highest=Math.max(highest,g.playerPosition.y);}d.stop();d.wait(.5);assert.ok(highest>7.1,'The adversary must actually jump above the floor');
  assert.equal(g.teleportCount,before);assert.equal(g.state,'playing');assert.equal(r.loaded('b'),false);assert.equal(g.physics.portalTransports,1);assert.equal(g.heldCube,cargo);assert.ok(g.playerPosition.y<10);
 });clean(receipt);assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);
});

test('50 the genuine A inspection lintel blocks the confirmed passenger boarding while outside E still retrieves original freight',async()=>{
 const g=await room(),cargo=g.cargo,body=g.physics.cargoBody,player=g.playerGroup;g.camera.aspect=16/9;g.camera.updateProjectionMatrix();
 let highest=0,closestZ=Infinity,lintelTop;
 const receipt=await scenario(g,d=>{
  runPuzzleProgression50(d,{stopAfter:'gallery-a'});const r=d.level.rotor,c=r.cups[0];
  assert.equal(r.loaded('a'),true);assert.equal(g.physics.portalTransports,1);lintelTop=new THREE.Box3().setFromObject(c.freightLintel).max.y;
  // Replay the independently successful old boarding: normal jumps to the
  // cup centre, steering until near the target and actually grounded.
  d.walk(-12,-3);d.walk(c.group.position.x-.2,-3);const x=c.group.position.x-.2;let near=false;
  for(let n=0;n<360;n++){
   const dx=x-g.playerPosition.x,dz=-.1-g.playerPosition.z,distance=Math.hypot(dx,dz);if(distance<.25)near=true;if(near&&g.playerGrounded&&distance<.2)break;
   if(!near&&n%60===0)g.input.jumpQueued=true;const pace=Math.min(1,distance*1.5);d.worldMove(dx/(distance||1)*pace,dz/(distance||1)*pace);d.frame();highest=Math.max(highest,g.playerPosition.y);closestZ=Math.min(closestZ,Math.abs(g.playerPosition.z));
  }
  d.stop();d.until(()=>g.playerGrounded,3,'Blocked A inspection jumps did not land on the real gallery');
  assert.ok(highest>7.4,'The adversary must really jump at the former boarding approach');assert.ok(highest<lintelTop-.5,'The front lintel top must remain beyond this actual ordinary jump');assert.ok(closestZ>1.5,'Confirmed old steering must remain outside the freight-only inspection opening');assert.equal(r.loaded('a'),true);
  const p=g.cargo.position.clone();d.walk(-12,-3);d.walk(p.x,-3);d.walk(p.x,-1.95);d.pickup();d.walk(p.x,-4);d.walk(-12,-4);d.walk(-12,-5);
  d.until(()=>Math.abs(r.angle)<.06&&Math.abs(r.body.angularVelocity.z)<.008&&r.cups.every(c=>Math.abs(c.body.angularVelocity.z)<.015),35,'Actual unloaded A hinge did not freely return after outside inspection');
  assert.equal(g.heldCube,cargo);assert.ok(g.playerGrounded&&g.playerPosition.y<7,'Outside extraction must leave the passenger on the fixed gallery');assert.ok(c.group.position.y>20,'The empty physical cup must actually return to its upper berth');assert.equal(r.loaded('a'),false);assert.equal(r.loaded('b'),false);assert.equal(g.state,'playing');d.mark('Real freight-only front lintel rejects A boarding while the original live cargo is recovered through E outside');
 });clean(receipt);assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);assert.equal(g.playerGroup,player);console.info('50 A freight inspection',JSON.stringify({highest,closestZ,lintelTop}));
});

test('50 initial inclined freight fits the original oriented box and its Cannon skin is an actual OBB',async()=>{
 const g=await room();const receipt=await scenario(g,d=>{
  d.wait(.1);const r=d.level.rotor,p=r.cups[1].feed,f=frame(p),skin=g.physics.solids.get(p.mesh.uuid).body;
  assert.equal(uprightCapsuleFitsPortal(f,2.4,.43),false);
  for(const x of [0,.4,Math.PI/4])for(const y of [0,Math.PI/4,Math.PI/2])for(const z of [0,.4,Math.PI/4])assert.equal(orientedBoxFitsPortal(f,f.position,new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z)),.39),true);
  assert.equal(skin.type,Body.KINEMATIC);assert.ok(new THREE.Quaternion().copy(skin.quaternion).angleTo(p.group.getWorldQuaternion(new THREE.Quaternion()))<.001);assert.ok(Math.abs(skin.shapes[0].halfExtents.z-.12)<1e-8);assert.ok(Math.abs(skin.shapes[0].halfExtents.x-1.6)<1e-6);
 });clean(receipt);
});

test('50 reset preserves original actors and disposal removes owned physical bodies, joints and force listener',async()=>{
 const g=await room(),cargo=g.cargo,body=g.physics.cargoBody;const receipt=await scenario(g,d=>d.wait(.2));clean(receipt);const l=g.firstLevel,r=l.rotor;
 const owned=[r.body,r.anchor,r.stop,r.counterweight,r.hoodBody,...r.cups.map(c=>c.body)],joints=[r.hinge,r.counterweightLock,...r.cups.map(c=>c.hinge)],listener=r.preStep;
 g.resetRun(true);assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);assert.ok(Math.abs(r.angle)<1e-8);assert.ok(joints.every(j=>g.physics.world.constraints.includes(j)));
 l.dispose();for(const b of owned)assert.equal(g.physics.world.bodies.includes(b),false);for(const j of joints)assert.equal(g.physics.world.constraints.includes(j),false);assert.equal(g.physics.world.hasEventListener('preStep',listener),false);assert.equal(g.physics.cargoBody,body);
});
