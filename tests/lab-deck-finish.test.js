import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {mapDeckUV} from '../src/game/LabDeckUV.js';
import {OpenChamber} from '../src/game/LabOpenArchitecture.js';

test('deck finish has nonzero area on all six faces, including vertical rims',()=>{
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(12,1,18));mapDeckUV(mesh);
 const uv=mesh.geometry.attributes.uv;
 for(let i=0;i<uv.count;i+=3){
  const area=(uv.getX(i+1)-uv.getX(i))*(uv.getY(i+2)-uv.getY(i))-(uv.getY(i+1)-uv.getY(i))*(uv.getX(i+2)-uv.getX(i));
  assert.ok(Math.abs(area)>1e-5,`collapsed texture at triangle ${i/3}`);
 }
});
test('translated, rotated and scaled carrier decks keep physical texture scale and attached UVs',()=>{
 const parent=new THREE.Group();parent.position.set(13,4,-7);parent.rotation.y=Math.PI/2;parent.scale.set(2,1,3);
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(6,6));mesh.rotation.x=-Math.PI/2;parent.add(mesh);mapDeckUV(mesh);
 const uv=mesh.geometry.attributes.uv;
 const span=axis=>Math.max(...Array.from({length:uv.count},(_,i)=>uv[axis](i)))-Math.min(...Array.from({length:uv.count},(_,i)=>uv[axis](i)));
 assert.ok(Math.abs(span('getX')-3)<1e-6);assert.ok(Math.abs(span('getY')-2)<1e-6);
 const before=Array.from(uv.array);parent.position.x+=20;parent.updateMatrixWorld(true);assert.deepEqual(Array.from(uv.array),before);
});
test('architecture batching preserves decorative and structural shadow behavior',()=>{
 const root=new THREE.Group(),mat=new THREE.MeshStandardMaterial(),meshes=[];
 for(const castShadow of [true,false,false]){const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),mat);mesh.castShadow=castShadow;mesh.receiveShadow=true;root.add(mesh);meshes.push(mesh);}
 const kit={world:{root},artBins:new Map([[mat,meshes]])};OpenChamber.prototype.flush.call(kit);
 assert.equal(root.children.length,2);assert.equal(root.children.filter(m=>m.castShadow).length,1);
 assert.equal(root.children.find(m=>m.castShadow).geometry.attributes.position.count,36);
 assert.equal(root.children.find(m=>!m.castShadow).geometry.attributes.position.count,72);
 assert.ok(root.children.every(m=>m.receiveShadow));assert.equal(kit.artBins.size,0);
});
