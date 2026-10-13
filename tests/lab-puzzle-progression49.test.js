import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Body} from 'cannon-es';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runPuzzleProgression49} from '../src/game/LabPuzzleProgression49Journey.js';
import {installPreciseLateAim,aimLateSurface} from '../src/game/LabLateCampaignAim.js';
import {reflectedReceiverLit,traceProgression49Light} from '../src/game/LabPuzzleProgression49.js';
import {tracePortalRay} from '../src/game/LabPuzzleMechanics.js';
import {makePortalFrame,orientedBoxFitsPortal,uprightCapsuleFitsPortal} from '../src/game/LabPortals.js';
const V=(...p)=>new THREE.Vector3(...p);
let shared;
async function room(){shared??=await createHeadlessGame();shared.chamberEdition='foundation';shared.puzzleProgression=true;await shared.selectLevel(48,false);return shared;}
const scenario=(g,fn)=>runV8Journey(g,{scenario:fn});
const clean=r=>{assert.equal(r.pass,true);assert.equal(r.resets,0);assert.equal(r.respawns,0);};
function rawShot(d,color,surface,point=surface.getFrame().center){d.look(point);assert.equal(d.game.firePortal(color),true);d.until(()=>!d.game.portalShots.queue.length&&!d.game.portalShots.active.length,3,'Ordinary portal charge stalled');return d.game.portalShots.lastImpact;}

for(const [aspect,recover] of [[16/9,false],[16/10,true]])test(`49 ordinary joint route ${aspect}, dry recovery ${recover}`,async()=>{
 const g=await room();g.camera.aspect=aspect;g.camera.updateProjectionMatrix();const cargo=g.cargo,body=g.physics.cargoBody;
 const r=await scenario(g,d=>runPuzzleProgression49(d,{recover,cargoReleaseOffset:recover?.4:0,sourceAimOffset:recover?.18:0}));clean(r);assert.equal(g.state,'won');assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);assert.ok(r.milestones.length>=8);assert.equal(r.teleports,1);assert.ok(g.physics.portalTransports>=2);
 if(recover)assert.match(r.milestones[0].name,/Dry service floor/);
});

test('49 passenger alone after both optical strokes cannot finish the joint dock',async()=>{
 const g=await room(),cargo=g.cargo,body=g.physics.cargoBody;const r=await scenario(g,d=>runPuzzleProgression49(d,{leaveCargo:true}));clean(r);
 assert.equal(g.state,'playing');assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);assert.ok(g.firstLevel.carriage.position.x>23.8);assert.equal(g.heldCube,null);assert.ok(g.playerPosition.distanceTo(g.cargo.position)>3.3);
});

test('49 actual cargo contact rotates the hinge; physical clamp retains and release frees it',async()=>{
 const g=await room();const r=await scenario(g,d=>{
  runPuzzleProgression49(d,{stopAfter:'loaded'});const l=d.level;
  assert.equal(l.mirror.loaded(),true);assert.equal(l.mirror.body.type,Body.DYNAMIC);assert.ok(l.mirror.angle<-.15);assert.ok(g.physics.world.contacts.some(c=>(c.bi===l.mirror.body&&c.bj===g.physics.cargoBody)||(c.bj===l.mirror.body&&c.bi===g.physics.cargoBody)));
 });clean(r);
 const retained=await scenario(g,d=>{
  runPuzzleProgression49(d,{stopAfter:'extracted'});const l=d.level;
  d.walk(0,-8.6);assert.equal(g.interact(),true);d.wait(2);assert.equal(l.field.enabled,false);assert.equal(l.mirror.loaded(),false);assert.equal(l.carriage.loaded(),true);
  const held=l.mirror.angle;assert.ok(g.physics.world.constraints.includes(l.mirror.lock));d.wait(2);assert.ok(Math.abs(l.mirror.angle-held)<.002);
  d.walk(4,-8.6);assert.equal(g.interact(),true);assert.equal(l.mirror.lock,null);d.until(()=>Math.abs(l.mirror.angle)<.035,6,'Released unloaded real hinge did not spring back');assert.ok(Math.abs(l.mirror.angle-held)>.1);
 });clean(retained);
});

test('49 actual rail lock captures and releases a dynamic body under live light force',async()=>{
 const g=await room();const r=await scenario(g,d=>{
  runPuzzleProgression49(d,{stopAfter:'optical-a'});const l=d.level,c=l.carriage;
  assert.equal(c.body.type,Body.DYNAMIC);assert.equal(c.body.mass,45);assert.equal(c.braked,true);assert.ok(g.physics.world.constraints.includes(c.lock));const held=c.position.x;d.wait(1.5);assert.ok(Math.abs(c.position.x-held)<.01);assert.equal(l.receiverA.lit,true);
  d.walk(-33,15);d.walk(-24,15);d.walk(-24,10);d.walk(-24,5.4);assert.equal(g.interact(),true);assert.equal(c.lock,null);d.wait(2);assert.ok(c.position.x>held+1);assert.ok(c.body.velocity.x>0);assert.ok(Math.abs(g.playerPosition.x-c.position.x)<.3);
  assert.equal(g.interact(),true);assert.ok(g.physics.world.constraints.includes(c.lock));const captured=c.anchor.position.x;d.wait(1.5);assert.ok(Math.abs(c.position.x-captured)<.03,JSON.stringify({captured,position:c.position.x,body:c.body.position.x}));assert.equal(c.body.type,Body.DYNAMIC);
  assert.equal(g.interact(),true);d.wait(1);assert.ok(c.position.x>captured+.5);
 });clean(r);
});

test('49 fixed gallery feet are not carried by the returning moving deck',async()=>{
 const g=await room();const r=await scenario(g,d=>{
  runPuzzleProgression49(d,{stopAfter:'gallery'});const l=d.level;
  d.walk(-.5,-2);d.wait(.8);assert.equal(g.playerPosition.y,8);assert.equal(l.carriage.floor.y,8.15);
  aimLateSurface(d,0,l.carriage.freight);d.wait(.15);const x=g.playerPosition.x,z=g.playerPosition.z;
  d.wait(2);assert.ok(l.carriage.position.x<-1);assert.ok(Math.abs(g.playerPosition.x-x)<.12,JSON.stringify({x,z,player:g.playerPosition.toArray(),car:l.carriage.position.toArray()}));assert.ok(Math.abs(g.playerPosition.z-z)<.12,JSON.stringify({x,z,player:g.playerPosition.toArray(),car:l.carriage.position.toArray()}));assert.equal(g.playerPosition.y,8);
 });clean(r);
});

test('49 low freight admits the original cube with orientation margin and rejects standing passenger',async()=>{
 const g=await room(),l=g.firstLevel;
 for(const p of [l.source,l.outletA,l.outletB]){const f=p.getFrame();assert.equal(uprightCapsuleFitsPortal(makePortalFrame(f.center,f.normal,f.up,p.mesh.userData.portalSize),2.4,.43),false);}
 for(const p of [l.freight,l.carriage.freight]){
  const f=p.getFrame(),frame=makePortalFrame(f.center,f.normal,f.up,p.mesh.userData.portalSize);
  assert.equal(uprightCapsuleFitsPortal(frame,2.4,.42),false);
  for(const x of [0,.18,Math.PI/4,Math.acos(1/Math.sqrt(3))])for(const y of [0,Math.PI/4,Math.PI/2])for(const z of [0,.18,Math.PI/4])assert.equal(orientedBoxFitsPortal(frame,frame.position,new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z)),.39),true);
 }
 const r=await scenario(g,d=>{installPreciseLateAim(d);d.walk(-17,23);aimLateSurface(d,0,l.cargoInput.surface);aimLateSurface(d,1,l.freight);d.walk(-29,20);d.wait(1);for(let i=0;i<120;i++){g.input.keys.add('Space');d.frame();}d.stop();d.wait(.5);assert.equal(g.teleportCount,0);assert.ok(g.playerPosition.y>7.9);assert.equal(l.mirror.loaded(),false);});clean(r);
});

test('49 exact optical plate blocks closed and off-centre rays but releases positive-side emission',async()=>{
 const g=await room(),l=g.firstLevel,p=l.outletB,f=p.getFrame(),forward=f.normal.clone().negate();
 const closed=traceProgression49Light(g,f.center.clone().addScaledVector(f.normal,1.5),forward,l.mirror,p);
 assert.equal(closed[0].kind,'wall');assert.ok(Math.abs(closed[0].length-1.5)<.01);assert.ok(closed[0].b.distanceTo(f.center)<.01);
 const off=f.center.clone().addScaledVector(f.right,1.9);const opaque=traceProgression49Light(g,off.clone().addScaledVector(f.normal,1),forward,l.mirror,p);assert.equal(opaque[0].kind,'wall');assert.ok(opaque[0].b.distanceTo(off)<.01);
 const emission=traceProgression49Light(g,f.center.clone().addScaledVector(f.normal,.07),f.normal,l.mirror,p);assert.ok(emission[0].length>2);assert.equal(emission[0].kind,'mirror');
 const outside=f.center.clone().addScaledVector(f.right,2.8);const rim=traceProgression49Light(g,outside.clone().addScaledVector(f.normal,2),forward,l.mirror,p);assert.equal(rim[0].kind,'wall');assert.ok(rim[0].length<2);
 for(const r of [l.receiverA,l.receiverB]){
  const direct=tracePortalRay(g,r.position.clone().addScaledVector(r.incoming,-3),r.incoming,{length:6});assert.equal(direct[0].kind,'wall');assert.ok(direct[0].length>3);assert.ok(direct[0].length<3.5);
  const axis=['x','y','z'].find(a=>Math.abs(r.incoming[a])<.7),offset=V();offset[axis]=1.05;
  const blocked=tracePortalRay(g,r.position.clone().addScaledVector(r.incoming,-3).add(offset),r.incoming,{length:6});assert.equal(blocked[0].kind,'wall');assert.ok(blocked[0].length<3);
 }
});

test('49 early court and western walk cannot address the protected passenger gallery',async()=>{
 const g=await room();const r=await scenario(g,d=>{installPreciseLateAim(d);for(const [x,z]of [[-17,23],[-33,-13]]){if(z<0)d.walk(-33,18);d.walk(x,z);const shot=rawShot(d,1,d.level.galleryEntry);assert.equal(Boolean(shot.valid&&g.portals.portals[1]?.surfaceId===d.level.galleryEntry.mesh.uuid),false);}assert.equal(g.teleportCount,0);assert.equal(d.level.carriage.braked,true);});clean(r);
});

test('49 B-only off-centre beam cannot drive an unweighted mirror with the original cargo aboard',async()=>{
 const g=await room(),cargo=g.cargo,body=g.physics.cargoBody;const r=await scenario(g,d=>{
  installPreciseLateAim(d);const l=d.level;d.walk(-31,24);d.pickup();d.walk(-24,24);d.walk(-24,15);d.walk(-24,10);d.walk(-24,8);d.look(V(-24,8.15,6));d.wait(.2);assert.equal(g.interact(),true);d.wait(1);assert.equal(l.carriage.loaded(),true);assert.equal(l.mirror.loaded(),false);
  d.walk(-24,15);d.walk(-33,15);d.walk(-33,-1);aimLateSurface(d,0,l.source);d.walk(-33,-31.97);
  const f=l.outletB.getFrame(),point=f.center.clone().addScaledVector(f.right,.6).addScaledVector(f.up,-.1);aimLateSurface(d,1,l.outletB,point);d.wait(1);assert.equal(l.receiverB.lit,false);assert.equal(l.receiverA.lit,false);assert.ok(Math.abs(l.mirror.angle)<.001);
  d.walk(-33,-13);d.walk(-41,-13);d.walk(-41,15);d.walk(-33,15);d.walk(-24,15);d.walk(-26,10);d.walk(-26,2.6);d.walk(-24,2.6);assert.equal(g.interact(),true);assert.equal(l.carriage.braked,false);d.wait(4);assert.ok(Math.abs(l.carriage.position.x+24)<.02);assert.equal(g.state,'playing');assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);
 });clean(r);
});

test('49 actual rear leaves retain their local pose and closed inspection slots reject a standing exit',async()=>{
 const g=await room();const r=await scenario(g,d=>{
  runPuzzleProgression49(d,{stopAfter:'aboard'});const c=d.level.carriage;
  d.wait(1);assert.equal(c.powerA,false);assert.ok(c.gateProgress<.01);
  const names=['49 / light powered rear lower leaf','49 / real rear inspection mullion','49 / light powered rear upper leaf'];
  for(const name of names){const mesh=c.group.children.find(o=>o.name===name);assert.ok(mesh);const box=new THREE.Box3().setFromObject(mesh),collider=g.colliders.find(x=>x.mesh===mesh);assert.ok(box.min.y>=c.body.position.y-.01&&box.max.y<c.body.position.y+6.1);assert.ok(box.min.distanceTo(collider.box.min)<1e-6&&box.max.distanceTo(collider.box.max)<1e-6);}
  d.walk(0,1.2);const before=g.teleportCount;for(let i=0;i<120;i++){d.worldMove(0,-1);d.frame();}d.stop();d.wait(.5);assert.ok(g.playerPosition.z>0);assert.equal(g.teleportCount,before);assert.ok(g.playerPosition.y>=8.15);
 });clean(r);
});

test('49 receiver requires a finite immediately reflected beam in its narrow physical direction',()=>{
 const p=V(0,0,0),down=V(0,-1,0),s={a:V(0,3,0),b:V(0,-2,0),direction:down,length:5,kind:'wall'};
 assert.equal(reflectedReceiverLit([s],p,down),false);assert.equal(reflectedReceiverLit([{kind:'mirror'},s],p,down),true);assert.equal(reflectedReceiverLit([{kind:'mirror'},s],p,down.clone().negate()),false);assert.equal(reflectedReceiverLit([{kind:'portal'},s],p,down),false);assert.equal(reflectedReceiverLit([{kind:'mirror'},{...s,length:1}],p,down),false);
 const tilted=down.clone().applyAxisAngle(V(0,0,1),.12);assert.equal(reflectedReceiverLit([{kind:'mirror'},{...s,direction:tilted}],V(0,3,0).addScaledVector(tilted,2),down),false);
});

test('49 reset retains original actors and disposal removes every owned constraint and physical body',async()=>{
 const g=await room(),cargo=g.cargo,body=g.physics.cargoBody;const r=await scenario(g,d=>runPuzzleProgression49(d,{stopAfter:'clamped'}));clean(r);const l=g.firstLevel,m=l.mirror,c=l.carriage;
 const owned=[m.body,m.anchor,m.stop,c.body,c.anchor,...c.stops];assert.ok(m.lock&&c.lock);g.resetRun(true);assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);assert.equal(m.clamped,false);assert.equal(m.lock,null);assert.equal(c.braked,true);assert.equal(c.body.type,Body.DYNAMIC);assert.ok(Math.abs(c.body.position.x+24)<.001);
 l.dispose();for(const b of owned)assert.equal(g.physics.world.bodies.includes(b),false);assert.equal(g.physics.world.constraints.some(j=>owned.includes(j.bodyA)||owned.includes(j.bodyB)),false);assert.equal(g.physics.cargoBody,body);
});
