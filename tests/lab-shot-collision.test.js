import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {LabGame} from '../src/game/LabGame.js';
import {LabPortals} from '../src/game/LabPortals.js';
import {LabPortalShots} from '../src/game/LabPortalShots.js';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';

const V=(...p)=>new THREE.Vector3(...p);
function aim(g,origin,point){
 g.camera.position.copy(origin);g.camera.lookAt(point);g.camera.updateMatrixWorld(true);
}
function finish(g,dt=1/120){for(let n=0;n<Math.ceil(3/dt)&&(g.portalShots.queue.length||g.portalShots.active.length);n++)g.portalShots.step(dt);}
// Isolated adversarial geometry uses the production input, timed shot and
// placement modules. Successful campaign coverage below additionally uses real
// decoded uploaded meshes, animated muzzle, mechanisms and fixed physics ticks.
function fixture(){
 const g=new LabGame({container:null,touch:false});g.scene=new THREE.Scene();g.camera=new THREE.PerspectiveCamera(57,16/9,.1,130);
 g.state='playing';g.audio={};g.playerPosition.set(0,.6,5);g.facing=Math.PI;
 const emitter=new THREE.Object3D();emitter.position.set(0,2,5);g.scene.add(emitter);g.heldDevice={emitter,fire(){}};
 g.portals=new LabPortals({scene:g.scene});g.portalShots=new LabPortalShots(g);
 const panel=g.box(0,2,-.1,8,6,.2,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),{solid:true});
 g.markPortalSurface(panel,V(0,2,0),V(0,0,1),4,3);panel.name='fixture white face';
 aim(g,V(0,2,5),V(0,2,0));return {g,panel,emitter};
}

test('real room eleven: delayed firePortal uses animated muzzle and creates both channels on flush tiled walls',async()=>{
 const g=await createHeadlessGame();await g.selectLevel(10,false);g.resetRun(true);
 try{
  for(const [index,name] of [[0,'wind-intake'],[1,'wind-outlet']]){
   const f=g.firstLevel.panels[name].getFrame();g.playerPosition.copy(f.center).addScaledVector(f.normal,6);g.playerPosition.y=0;g.previousPlayerPosition.copy(g.playerPosition);g.facing=Math.PI/2;g.updateVisuals(0,1);
   aim(g,g.playerPosition.clone().add(V(0,1.8,0)),f.center);assert.equal(g.firePortal(index),true);assert.equal(g.portals.portals[index],null);
   for(let n=0;n<80;n++){g.updatePlaying(1/120);g.updatePlaying(1/120);g.updateVisuals(1/60,1);}
   assert.equal(g.portalShots.lastImpact?.valid,true);assert.ok(g.portals.portals[index]);
  }
  assert.equal(g.portals.ready,true);
 }finally{g.physics.dispose();g.portals.dispose();}
});

test('real tilted GLB: its registered collision proxy cannot occlude its own precise face',async()=>{
 const g=await createHeadlessGame();await g.selectLevel(4,false);g.resetRun(true);
 try{
  const p=g.firstLevel.receiverPanel;p.progress=1;p.mechanism.update(1);g.syncCollision(p.collider,p.mechanism.getPanelBox(),0);
  // Adversarial registry regression: the camera/physics AABB is also in the
  // shot list. Ownership must still defer only this proxy to its actual mesh.
  g.aimBlockers.push(p.collider.mesh);const f=p.mechanism.getPortalFrame(),origin=f.center.clone().addScaledVector(f.normal,6);
  g.playerPosition.copy(origin).add(V(0,-1.4,0));g.heldDevice.emitter.getWorldPosition=out=>out.copy(origin);aim(g,origin,f.center);
  assert.equal(g.firePortal(0),true);finish(g);assert.equal(g.portalShots.lastImpact?.valid,true);assert.ok(g.portals.portals[0]);
  const oldNormal=g.portals.portals[0].normal.clone();p.mechanism.update(.3);g.portals.syncMovingSurfaces();assert.ok(g.portals.portals[0].normal.distanceTo(oldNormal)>.1);
 }finally{g.physics.dispose();g.portals.dispose();}
});

test('static panels reject their back face and preserve a prior valid portal',()=>{
 const {g,panel,emitter}=fixture();panel.scale.z=.5;panel.position.z=-.05;g.colliders.find(c=>c.mesh===panel).box.setFromObject(panel);
 assert.equal(g.firePortal(0),true);finish(g);const previous=g.portals.portals[0];assert.ok(previous);
 g.playerPosition.set(0,.6,-3);emitter.position.set(0,2,-3);aim(g,V(0,2,-3),V(0,2,0));assert.equal(g.firePortal(0),true);finish(g);
 assert.equal(g.portalShots.lastImpact.valid,false);assert.equal(g.portalShots.lastImpact.reason,'back-face');assert.equal(g.portals.portals[0],previous);g.portals.dispose();
});

test('the windup consumes simulation time before flight; impact pulses survive a long frame',()=>{
 const {g}=fixture();assert.equal(g.firePortal(0),true);const wait=g.portalShots.queue[0].delay;
 g.portalShots.step(wait);assert.ok(g.portals.portals[0]===null,'The charge must not arrive during its windup');assert.equal(g.portalShots.active.length,1);
 const shot=g.portalShots.active[0];assert.equal(shot.position.distanceTo(shot.start),0);
 g.portalShots.step(.5);assert.equal(g.portalShots.lastImpact.valid,true);assert.ok(g.portalShots.pulses.length>0);g.portalShots.dispose?.();g.portals.dispose();
});

test('live wall matrices and a thin first obstacle determine actual impact at low update frequency',()=>{
 const {g,panel}=fixture();const blocker=g.box(3,2,2,1,5,.02,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),{solid:true});blocker.name='thin moving obstruction';
 assert.equal(g.firePortal(0),true);while(g.portalShots.queue.length)g.portalShots.step(1/120);blocker.position.x=0; // deliberately not rendered/updated yet
 finish(g,.1);assert.equal(g.portalShots.lastImpact.valid,false);assert.equal(g.portalShots.lastImpact.surface,blocker.name);assert.ok(g.portalShots.lastImpact.position[2]>1.98);assert.equal(g.portals.portals[0],null);
 // Ownership is specific: an unrelated plate cannot acquire portalability.
 assert.equal(panel.userData.portalable,true);g.portals.dispose();
});

test('paused/ad-blocked simulation freezes preparation and travel; reset invalidates old launches',()=>{
 const {g}=fixture();g.firePortal(0);const old={...g.portalShots.queue[0]};g.state='paused';g.portalShots.step(1);assert.equal(g.portalShots.time,0);assert.equal(g.portalShots.queue.length,1);
 g.state='playing';g.externalBlocked=true;g.portalShots.step(1);assert.equal(g.portalShots.time,0);g.externalBlocked=false;
 g.portalShots.reset();g.firePortal(0);g.portalShots.launch(old);assert.equal(g.portalShots.active.length,0);finish(g);assert.equal(g.portalShots.lastImpact.valid,true);
 g.portalShots.reset();assert.deepEqual(g.portalShots.diagnostics,{pending:0,flying:0,lastImpact:null});g.portals.dispose();
});

test('new same-channel input supersedes an older flying charge and a miss preserves the other channel',()=>{
 const {g}=fixture();g.firePortal(1);finish(g);const other=g.portals.portals[1];assert.ok(other);
 g.portalShots.cooldown=0;aim(g,V(0,2,5),V(2.7,2,0));g.firePortal(0);while(g.portalShots.queue.length)g.portalShots.step(1/120);
 const old=g.portalShots.active[0];g.portalShots.cooldown=0;aim(g,V(0,2,5),V(-2.7,2,0));g.firePortal(0);finish(g);assert.ok(g.portals.portals[0].position.x<0);assert.equal(old.sequence,1);
 g.portalShots.cooldown=0;aim(g,V(0,2,5),V(0,30,5));g.firePortal(0);finish(g);
 assert.equal(g.portalShots.lastOutcome?.reason,'miss');assert.equal(g.portals.portals[1],other);assert.equal(g.portalShots.active.length,0);g.portals.dispose();
});

test('a muzzle beyond a thin wall impacts its near side while camera sees the target',()=>{
 const {g,emitter}=fixture();const wall=g.box(0,2,4,6,5,.025,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),{solid:true});wall.name='muzzle contact';
 emitter.position.z=3.8;aim(g,V(0,2,3.7),V(0,2,0));g.firePortal(0);finish(g);
 assert.equal(g.portalShots.lastImpact.valid,false);assert.equal(g.portalShots.lastImpact.surface,wall.name);assert.ok(g.portalShots.lastImpact.position[2]>4);g.portals.dispose();
});

test('owning-proxy exemption requires an actual front-face intersection; uncovered support still blocks',()=>{
 const {g,panel,emitter}=fixture();const proxy=g.box(0,2,-.1,12,6,.2,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),{solid:true});
 proxy.name='wide registered backing';proxy.visible=false;proxy.userData.collisionProxy=true;panel.userData.portalColliderId=proxy.uuid;
 g.colliders.find(c=>c.mesh===proxy).frontPlane=()=>({center:V(0,2,0),normal:V(0,0,1)});
 g.playerPosition.x=5;emitter.position.x=5;aim(g,V(5,2,5),V(5,2,0));g.firePortal(0);finish(g);
 assert.equal(g.portalShots.lastImpact.valid,false);assert.equal(g.portalShots.lastImpact.surface,proxy.name);g.portals.dispose();
});
