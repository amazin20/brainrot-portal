import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {loadHeadlessGLB} from '../scripts/lab-headless.mjs';
import {LabCompanionRig} from '../src/game/LabCompanionRig.js';

test('carry follow-through visibly articulates the real fin mesh while body and shoe vertices retain their supported pose',async()=>{
  const source=await loadHeadlessGLB(new URL('../public/models/runtime/model-02-cargo.glb',import.meta.url));
  const make=()=>{
    const visual=source.clone(true);
    const box=new THREE.Box3().setFromObject(visual),size=box.getSize(new THREE.Vector3());
    visual.scale.setScalar(.82/Math.max(size.x,size.y,size.z));
    return new LabCompanionRig(visual);
  };
  const moving=make(),settled=make();
  moving.update({dt:.125,elapsed:.125,grounded:true,carrying:true,velocity:{x:4,y:0,z:0}});
  settled.update({dt:.125,elapsed:.125,grounded:true,carrying:true,velocity:{x:0,y:0,z:0}});
  const geometry=moving.mesh.geometry,ids=geometry.getAttribute('skinIndex'),weights=geometry.getAttribute('skinWeight');
  const a=new THREE.Vector3(),b=new THREE.Vector3();
  let fins=0,rigid=0,maximumFin=0,maximumRigid=0;
  for(let i=0;i<ids.count;i++){
    // Transition seams deliberately blend neighbouring joints. Only vertices
    // with a complete rigid assignment define the body/shoe support contract.
    if(weights.getX(i)!==1)continue;
    const bone=ids.getX(i);
    if(![0,3,4,5,6].includes(bone))continue;
    moving.mesh.getVertexPosition(i,a);moving.mesh.localToWorld(a);
    settled.mesh.getVertexPosition(i,b);settled.mesh.localToWorld(b);
    const distance=a.distanceTo(b);
    if(bone===3||bone===4){fins++;maximumFin=Math.max(maximumFin,distance);}
    else{rigid++;maximumRigid=Math.max(maximumRigid,distance);}
  }
  assert.ok(fins>30 && maximumFin>.004,`Source fins did not visibly articulate: ${fins} vertices, ${maximumFin} metres`);
  assert.ok(rigid>30 && maximumRigid<1e-9,`Rigid body/shoes shifted their physical support by ${maximumRigid} metres`);
  assert.deepEqual(moving.mesh.geometry.getAttribute('position').array,settled.mesh.geometry.getAttribute('position').array);
  assert.deepEqual(moving.mesh.geometry.getAttribute('uv').array,settled.mesh.geometry.getAttribute('uv').array);
});
