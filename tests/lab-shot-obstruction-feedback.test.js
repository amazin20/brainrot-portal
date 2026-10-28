import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {LabGame} from '../src/game/LabGame.js';
import {LabPortals} from '../src/game/LabPortals.js';
import {LabPortalShots} from '../src/game/LabPortalShots.js';
const V=(...p)=>new THREE.Vector3(...p);
function fixture(){
 const g=new LabGame({container:null,touch:false});g.scene=new THREE.Scene();g.camera=new THREE.PerspectiveCamera(57,16/9,.1,130);g.state='playing';g.audio={};g.playerPosition.set(0,.6,5);g.facing=Math.PI;
 const messages=[];g.callbacks.onToast=s=>messages.push(s);
 const emitter=new THREE.Object3D();emitter.position.set(0,2,5);g.scene.add(emitter);g.heldDevice={emitter,fire(){}};
 g.portals=new LabPortals({scene:g.scene});g.portalShots=new LabPortalShots(g);
 const panel=g.box(0,2,-.1,8,6,.2,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),{solid:true});g.markPortalSurface(panel,V(0,2,0),V(0,0,1),4,3);
 const look=(from,to)=>{g.camera.position.copy(from);g.camera.lookAt(to);g.camera.updateMatrixWorld(true);};
 const finish=()=>{for(let i=0;i<360&&(g.portalShots.queue.length||g.portalShots.active.length);i++)g.portalShots.step(1/120);};
 look(V(0,2,5),V(-2.5,2,0));return{g,panel,emitter,messages,look,finish,close(){g.portals.dispose();g.portalShots.root.removeFromParent();}};
}
test('a visible panel blocked only from the muzzle reports obstruction and retains the original portal',()=>{
 const f=fixture(),{g,panel,emitter,messages,look,finish}=f;
 try{
  assert.ok(g.firePortal(0));finish();const previous=g.portals.portals[0];assert.ok(previous);
  // The camera looks over a real short wall. The low muzzle cannot shoot
  // through it; no geometric query, impact or aperture is replaced.
  const wall=g.box(0,1.8,3,6,2.6,.05,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),{solid:true});wall.name='actual low barrier';
  look(V(0,6,5),V(0,2,0));g.portalShots.cooldown=0;
  assert.ok(g.firePortal(0));assert.equal(g.portalShots.queue[0].targetSurfaceId,panel.uuid);finish();
  assert.equal(g.portalShots.lastImpact.valid,false);assert.equal(g.portalShots.lastImpact.surface,wall.name);assert.equal(g.portalShots.lastImpact.reason,'surface');
  assert.equal(g.portals.portals[0],previous);assert.equal(messages.at(-1),'Панель видна, но путь от пушки перекрыт. Смени угол выстрела');
 }finally{f.close();}
});
test('an ordinary non-white target is not misreported as a blocked white panel',()=>{
 const f=fixture(),{g,messages,look,finish}=f;
 try{g.box(0,2,3,6,5,.1,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),{solid:true});look(V(0,2,5),V(0,2,0));assert.ok(g.firePortal(0));assert.equal(g.portalShots.queue[0].targetSurfaceId,null);finish();assert.equal(messages.at(-1),'Заряд попал в препятствие. Нужна свободная белая поверхность');assert.equal(g.portals.portals[0],null);}finally{f.close();}
});
test('a queued click retains its own target classification after another aim query and reset clears it',()=>{
 const f=fixture(),{g,panel,look,finish}=f;
 try{assert.ok(g.firePortal(0));const shot=g.portalShots.queue[0];assert.equal(shot.targetSurfaceId,panel.uuid);look(V(0,2,5),V(0,40,5));g.portalShots.captureTarget(1);assert.equal(g.portalShots.targetSurfaceId,null);assert.equal(shot.targetSurfaceId,panel.uuid);finish();assert.equal(g.portalShots.lastImpact.valid,true);g.portalShots.reset();assert.equal(g.portalShots.targetSurfaceId,null);}finally{f.close();}
});
