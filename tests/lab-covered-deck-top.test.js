import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {omitCoveredDeckTop} from '../src/game/LabCoveredDeckTop.js';
import {renderedTopArea} from './helpers/lab-deck-top-proof.js';

test('a complete existing deck seals the joined plinth while the independent physical/query owner stays untouched',()=>{
 const root=new THREE.Group(),material=new THREE.MeshStandardMaterial(),plinth=new THREE.Mesh(new RoundedBoxGeometry(10,2,16,1,.08),material),deck=new THREE.Mesh(new RoundedBoxGeometry(10,.6,16,1,.035),material);
 plinth.position.set(-18,1,-17);deck.position.set(-18,1.7,-17);root.add(plinth,deck);
 const proxy=new THREE.Mesh(new THREE.BoxGeometry(10,2,16),material);proxy.userData.collisionProxy=true;proxy.position.copy(plinth.position);proxy.visible=false;root.add(proxy);
 const source={geometry:proxy.geometry,matrix:proxy.matrix.clone(),position:proxy.position.clone(),children:proxy.children.slice()};
 const rectangle={minX:-22.8,maxX:-13.2,minZ:-24.8,maxZ:-9.2},expected=9.6*15.6;
 assert.ok(Math.abs(renderedTopArea(root,rectangle,2)-2*expected)<.0001,'Negative control must see the original double surface');
 const result=omitCoveredDeckTop(plinth,{name:'Low freight inspection berth',minX:-23,maxX:-13,minZ:-25,maxZ:-9,y:2});
 assert.ok(result.removedTriangles>0);assert.ok(Math.abs(renderedTopArea(root,rectangle,2)-expected)<.0001);
 assert.equal(proxy.geometry,source.geometry);assert.deepEqual(proxy.position,source.position);assert.deepEqual(proxy.children,source.children);
 root.updateWorldMatrix(true,true);const hits=new THREE.Raycaster(new THREE.Vector3(-18.1,3,-18.2),new THREE.Vector3(0,-1,0)).intersectObjects([plinth,deck]);
 assert.equal(hits.filter(h=>Math.abs(h.point.y-2)<.0001).length,1);
 for(const mesh of [plinth,deck,proxy])mesh.geometry.dispose();material.dispose();
});

test('a missing, displaced or partial covering deck cannot silently open a plinth',()=>{
 for(const patch of [{y:2.1},{minX:-22},{maxZ:-10}]){
  const mesh=new THREE.Mesh(new RoundedBoxGeometry(10,2,16,1,.08),new THREE.MeshStandardMaterial());mesh.position.set(-18,1,-17);
  const old=mesh.geometry;assert.throws(()=>omitCoveredDeckTop(mesh,{name:'cover',minX:-23,maxX:-13,minZ:-25,maxZ:-9,y:2,...patch}),RangeError);
  assert.equal(mesh.geometry,old);mesh.geometry.dispose();mesh.material.dispose();
 }
});
