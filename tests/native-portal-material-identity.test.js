import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {LabPortalActors} from '../src/game/LabPortalActors.js';
import {makePortalFrame} from '../src/game/LabPortals.js';
import {createNativePortalMaterialIdentityGuard} from '../scripts/lib/native-portal-material-identity.mjs';

// Real production clipping controller in a synthetic scene. These are guard
// regression tests, not a game route, browser render or camera acceptance.
function fixture({shader=false,array=false}={}){
 const scene=new THREE.Scene(),root=new THREE.Group();scene.add(root);
 const source=shader?new THREE.ShaderMaterial({vertexShader:'void main() { gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',fragmentShader:'void main() { gl_FragColor=vec4(1.0); }',uniforms:{strength:{value:1}}}):new THREE.MeshStandardMaterial({color:0x123456,roughness:.7,metalness:.2,map:new THREE.Texture()});
 const material=array?[source,source.clone()]:source,mesh=new THREE.Mesh(new THREE.BoxGeometry(.4,1,.4),material);root.add(mesh);
 const portals={ready:true,portals:[makePortalFrame(new THREE.Vector3(),new THREE.Vector3(0,0,1)),makePortalFrame(new THREE.Vector3(4,0,0),new THREE.Vector3(0,0,-1))]};
 const controller=new LabPortalActors({scene,portals}),actor=controller.register(root,{radius:1,centerOffset:[0,0,0]}),game={portalActors:controller};
 const guard=createNativePortalMaterialIdentityGuard(game,[{mesh,material}]);controller.prepare();
 return {scene,root,mesh,source,material,controller,actor,game,guard,activate(){controller.update();},dispose(){controller.dispose();mesh.geometry.dispose();for(const m of Array.isArray(material)?material:[material])m.dispose();source.map?.dispose();}};
}
test('material guard accepts authored originals and only real controller-owned standard clipping clones, then restoration',()=>{
 const f=fixture();try{
  assert.equal(f.guard.assertMaterials(),true);f.activate();assert.equal(f.actor.active,true);assert.notEqual(f.mesh.material,f.material);
  assert.equal(f.guard.assertMaterials(),true);assert.equal(f.guard.diagnostics().ownedClippingChecks,1);
  f.root.position.z=4;f.controller.update();assert.equal(f.mesh.material,f.material);assert.equal(f.guard.assertMaterials(),true);
 }finally{f.dispose();}
});
test('material guard preserves exact multi-material and shader clipping provenance without replacing source uniforms',()=>{
 for(const options of [{array:true},{shader:true}]){const f=fixture(options);try{
  f.activate();assert.equal(f.guard.assertMaterials(),true);
  if(options.shader){f.mesh.material.uniforms={...f.source.uniforms};assert.throws(()=>f.guard.assertMaterials(),/shared uniforms/);}
  else{f.mesh.material[0].normalMap=new THREE.Texture();assert.throws(()=>f.guard.assertMaterials(),/colors or textures/);f.mesh.material[0].normalMap.dispose();}
 }finally{f.dispose();}}
});
test('material guard rejects mutations of the original authored style even when the material reference is unchanged',()=>{
 for(const property of ['opacity','color','map']){const f=fixture();try{
  if(property==='color')f.source.color.setHex(0xffffff);else if(property==='map')f.source.map=new THREE.Texture();else f.source.opacity=.1;
  assert.equal(f.mesh.material,f.material);assert.throws(()=>f.guard.assertMaterials(),/authored/);
 }finally{f.dispose();}}
});
test('material guard rejects unowned clones, extra clipping planes, inactive actor impersonation and replaced actor handles',()=>{
 for(const mutant of ['unowned','plane','inactive','handle']){const f=fixture();try{
  f.activate();const owned=f.mesh.material;
  if(mutant==='unowned'){const foreign=f.source.clone();f.mesh.material=foreign;assert.throws(()=>f.guard.assertMaterials(),/provenance/);foreign.dispose();f.mesh.material=owned;}
  else if(mutant==='plane'){owned.clippingPlanes.push(new THREE.Plane());assert.throws(()=>f.guard.assertMaterials(),/actor-owned/);owned.clippingPlanes.pop();}
  else if(mutant==='inactive'){f.actor.active=false;assert.throws(()=>f.guard.assertMaterials(),/active portal actor/);}
  else{f.actor.root=new THREE.Group();assert.throws(()=>f.guard.assertMaterials(),/handles replaced/);f.actor.root=f.root;}
 }finally{f.dispose();}}
});
