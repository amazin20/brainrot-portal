import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {LabPortalActors}from'../src/game/LabPortalActors.js';
import {makePortalFrame}from'../src/game/LabPortals.js';
import {createTower41CameraObserverApi,TOWER41_CAMERA_OBSERVER_BROWSER_FACTORY}from'../scripts/lib/tower41-camera-observer-baseline-v3.mjs';
// Actual production clipping controller in a synthetic scene; these tests do
// not run a game, browser, traversal or physical camera acceptance.
test('baseline v3 snapshots only actual production wall/floor frame fields without mutating their orientation',()=>{
 const wall=makePortalFrame(new THREE.Vector3(2,3,4),new THREE.Vector3(0,0,-1)),floor=makePortalFrame(new THREE.Vector3(-1,0,9),new THREE.Vector3(0,1,0)),before=JSON.stringify([wall,floor]),api=createTower41CameraObserverApi();
 assert.equal(wall.right,undefined);assert.equal(floor.up,undefined);
 const snapshot=api.snapshotPortalFrames([wall,floor]);assert.deepEqual(snapshot.map(p=>p.quaternion),[wall.quaternion.toArray(),floor.quaternion.toArray()]);assert.equal(JSON.stringify([wall,floor]),before);
 assert.deepEqual(api.snapshotPortalFrames([null,wall]),[null,snapshot[0]]);
 const serialized=(0,eval)('('+TOWER41_CAMERA_OBSERVER_BROWSER_FACTORY+')')();assert.deepEqual(serialized.snapshotPortalFrames([wall,floor]),snapshot);
 assert.throws(()=>api.snapshotPortalFrames([{...wall,quaternion:undefined},null]),/portal quaternion unavailable/);
});
function fixture(shader=false){
 const scene=new THREE.Scene(),root=new THREE.Group(),source=shader?new THREE.ShaderMaterial({vertexShader:'void main() { gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',fragmentShader:'void main() { gl_FragColor=vec4(1.0); }',uniforms:{strength:{value:1}}}):new THREE.MeshStandardMaterial({color:0x123456,roughness:.7,metalness:.2});
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(.4,1,.4),source);root.add(mesh);scene.add(root);
 const portals={ready:true,portals:[makePortalFrame(new THREE.Vector3(),new THREE.Vector3(0,0,1)),makePortalFrame(new THREE.Vector3(4,0,0),new THREE.Vector3(0,0,-1))]};
 const controller=new LabPortalActors({scene,portals}),actor=controller.register(root,{radius:1,centerOffset:[0,0,0]});controller.prepare();controller.update();
 const refs={portalActors:controller,playerPortalActor:actor,root},g={portalActors:controller},row={mesh,material:source},check=()=>createTower41CameraObserverApi().validateMaterialProvenance(g,refs,row);
 return{scene,root,mesh,source,controller,actor,refs,g,row,check,dispose(){controller.dispose();mesh.geometry.dispose();source.dispose();}};
}
test('baseline v3 accepts only the original active controller clone with original standard style and owned plane',()=>{
 const f=fixture();try{assert.equal(f.check().kind,'original-portal-actor-owned-clipping-material');assert.equal(f.mesh.geometry,f.actor.pairs.find(p=>p.source===f.mesh).destination.geometry);
  f.mesh.material.color.setHex(0xffffff);assert.throws(f.check,/colors\/textures/);
 }finally{f.dispose();}
});
test('baseline v3 shader provenance accepts exact production clipping includes and shared original uniforms',()=>{
 const f=fixture(true);try{assert.equal(f.check().kind,'original-portal-actor-owned-clipping-material');f.mesh.material.uniforms={...f.source.uniforms};assert.throws(f.check,/shared shader uniforms/);}finally{f.dispose();}
});
test('material guard rejects unowned substitutions, extra planes and inactive-controller impersonation',()=>{
 const f=fixture();try{const owned=f.mesh.material;f.mesh.material=f.source.clone();assert.throws(f.check,/provenance/);f.mesh.material.dispose();f.mesh.material=owned;
  owned.clippingPlanes.push(new THREE.Plane());assert.throws(f.check,/actor-owned/);owned.clippingPlanes.pop();f.actor.active=false;assert.throws(f.check,/active portal actor/);
 }finally{f.dispose();}
});
