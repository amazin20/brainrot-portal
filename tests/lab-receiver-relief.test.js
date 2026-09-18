import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createPocketReceiverModel} from '../src/game/LabPocketReceiver.js';
const dispose=root=>{const gg=new Set(),mm=new Set();root.traverse(o=>{if(o.geometry)gg.add(o.geometry);if(o.material)mm.add(o.material)});gg.forEach(g=>g.dispose());mm.forEach(m=>m.dispose());};


test('brushed running ribs and edge strips are above the deck, not hidden inside it',()=>{
 const m=createPocketReceiverModel();m.root.updateMatrixWorld(true);
 for(const [x,y]of [[-4.9,0],[-5.8,.18],[5.8,.18]]){
  const ray=new THREE.Raycaster(new THREE.Vector3(x,y,1),new THREE.Vector3(0,0,-1));
  const hit=ray.intersectObject(m.root,true)[0];assert.ok(hit);
  assert.equal(hit.object.material,m.materials.metal,`Unseen metal relief at ${x},${y}`);
  assert.ok(hit.point.z>-.005&&hit.point.z<0);
 }
 for(const dimensions of [[NaN,8],[12.5,Infinity],[4,4]])assert.throws(()=>createPocketReceiverModel(...dimensions));
 dispose(m.root);
});
