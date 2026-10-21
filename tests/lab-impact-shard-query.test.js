import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Body,Box,Vec3,World} from 'cannon-es';
import {bindImpactShardRayQuery} from '../src/game/LabImpactShardQuery.js';

function fixture(){
 const physics={world:new World()},body=new Body({mass:.12,shape:new Box(new Vec3(.80,.625,.065))});
 // Captured native v66 shard232 at the actual failed recovery, not an
 // invented axis rotation chosen merely to make an AABB test pass.
 body.position.set(-2.635634387569456,.9208966098865022,-4.375061039605228);
 body.quaternion.set(.5413574554447916,.5334586923725417,-.43603654169360273,.4818983951772421);physics.world.addBody(body);
 const physical=new THREE.Mesh(new THREE.BoxGeometry(1.6,1.25,.13),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
 physical.position.copy(body.position);physical.quaternion.copy(body.quaternion);physical.updateWorldMatrix(true,false);
 const box=new THREE.Box3().setFromObject(physical),mesh=new THREE.Mesh(new THREE.BoxGeometry(...box.getSize(new THREE.Vector3()).toArray()),physical.material);
 mesh.position.copy(box.getCenter(new THREE.Vector3()));mesh.updateWorldMatrix(true,false);
 return {physics,body,physical,collider:{mesh,box,enabled:true}};
}

test('native tilted shard AABB false hit becomes an exact physical Box miss without changing any collider or body pose',()=>{
 const f=fixture(),origin=new THREE.Vector3(-.22876919623261263,1.7478265431788222,-5.660096909326454),target=new THREE.Vector3(-2.9246982175156258,.4735129061781807,-4.539679018077329);
 const ray=new THREE.Raycaster(origin,target.clone().sub(origin).normalize(),0,origin.distanceTo(target)-.1);
 assert.ok(ray.intersectObject(f.collider.mesh).length,'Captured legacy AABB really blocks this reach');
 assert.equal(ray.intersectObject(f.physical).length,0,'The same ray misses the actual Cannon Box');
 const bounds=f.collider.box.clone(),matrix=f.collider.mesh.matrixWorld.clone(),position=f.body.position.clone(),quaternion=f.body.quaternion.clone(),original=f.collider.mesh.raycast;
 const binding=bindImpactShardRayQuery(f.physics,f.collider,f.body);
 assert.equal(ray.intersectObject(f.collider.mesh).length,0);
 assert.ok(f.collider.box.equals(bounds));assert.ok(f.collider.mesh.matrixWorld.equals(matrix));assert.ok(f.body.position.almostEquals(position));assert.deepEqual(f.body.quaternion.toArray(),quaternion.toArray());
 binding.dispose();binding.dispose();assert.equal(f.collider.mesh.raycast,original);assert.ok(ray.intersectObject(f.collider.mesh).length);
});

test('real shard Box hits remain opaque and retain the original collider identity, distance and physical normal',()=>{
 const f=fixture(),normal=new THREE.Vector3(0,0,1).applyQuaternion(f.physical.quaternion),origin=f.physical.position.clone().addScaledVector(normal,2);
 const ray=new THREE.Raycaster(origin,normal.clone().negate(),0,4),expected=ray.intersectObject(f.physical)[0],binding=bindImpactShardRayQuery(f.physics,f.collider,f.body),actual=ray.intersectObject(f.collider.mesh)[0];
 assert.ok(expected&&actual);assert.equal(actual.object,f.collider.mesh);assert.ok(Math.abs(actual.distance-expected.distance)<1e-9);assert.ok(actual.point.distanceTo(expected.point)<1e-9);
 const n=actual.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(actual.object.matrixWorld));assert.ok(n.dot(normal)>.999999);
 f.physics.world.removeBody(f.body);assert.throws(()=>ray.intersectObject(f.collider.mesh),/lost its original physical owner/);binding.dispose();
});
