import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {LabPortalActors} from '../src/game/LabPortalActors.js';
import {makePortalFrame} from '../src/game/LabPortals.js';
import {createTower41NativeCameraObserverApi} from '../scripts/lib/tower41-native-camera-observer.mjs';
const pins={sourceCommit:'a'.repeat(40),tree:'b'.repeat(40),sourceInputsSha256:'c'.repeat(64),packageFilesSha256:'d'.repeat(64),journeySha256:'e'.repeat(64),browserSeamSha256:'f'.repeat(64),sourceReview:{runId:123,runAttempt:2}};
const api=createTower41NativeCameraObserverApi(pins);
// Real production clipping controller in a synthetic scene only. This does
// not exercise a native game, original GLB, traversal or render acceptance.
function fixture(){
 const scene=new THREE.Scene(),root=new THREE.Group(),material=new THREE.MeshStandardMaterial({color:0x123456,roughness:.7}),mesh=new THREE.Mesh(new THREE.BoxGeometry(.4,1,.4),material);root.add(mesh);scene.add(root);
 const row={mesh,material,authoredMaterialStyle:api.captureAuthoredMaterialStyle(material)};
 const portals={ready:true,portals:[makePortalFrame(new THREE.Vector3(),new THREE.Vector3(0,0,1)),makePortalFrame(new THREE.Vector3(4,0,0),new THREE.Vector3(0,0,-1))]},controller=new LabPortalActors({scene,portals}),actor=controller.register(root,{radius:1,centerOffset:[0,0,0]});controller.prepare();controller.update();
 const check=()=>api.validateMaterialProvenance({portalActors:controller},{portalActors:controller,playerPortalActor:actor,root},row);
 return {material,mesh,controller,actor,check,dispose(){controller.dispose();mesh.geometry.dispose();material.dispose();}};
}
test('native original material identity accepts an exact owned production clipping clone',()=>{const f=fixture();try{assert.equal(f.check().kind,'original-portal-actor-owned-clipping-material');}finally{f.dispose();}});
test('changing both original and owned clone cannot forge preserved authored appearance',()=>{const f=fixture();try{f.material.color.setHex(0xffffff);f.mesh.material.color.setHex(0xffffff);assert.throws(f.check,/original authored material style changed/);}finally{f.dispose();}});
test('replacing the original texture on both materials still violates the initial authored identity',()=>{const f=fixture();try{const texture=new THREE.Texture();f.material.map=texture;f.mesh.material.map=texture;assert.throws(f.check,/original authored material style changed/);texture.dispose();}finally{f.dispose();}});
