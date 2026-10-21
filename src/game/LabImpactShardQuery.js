import * as THREE from 'three';
import {Box} from 'cannon-es';

/** A query against the one existing physical shard Box. The invisible AABB
 * mesh remains unchanged for the character broadphase; it cannot turn an
 * empty corner beside a rotated fragment into an opaque pickup/shot wall. */
export function bindImpactShardRayQuery(physics,collider,body){
 const world=physics?.world,mesh=collider?.mesh,shape=body?.shapes?.[0];
 if(!world||!mesh?.isMesh||body?.world!==world||world.getBodyById(body.id)!==body||body.shapes.length!==1||!(shape instanceof Box)||shape.body!==body)
  throw new TypeError('Impact shard query requires its original owned Cannon Box');
 const half=shape.halfExtents,geometry=new THREE.BoxGeometry(half.x*2,half.y*2,half.z*2);
 const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),query=new THREE.Mesh(geometry,material);
 geometry.computeBoundingBox();geometry.computeBoundingSphere();query.matrixAutoUpdate=false;
 const original=mesh.raycast,pose=new THREE.Matrix4(),local=new THREE.Matrix4(),physicalNormal=new THREE.Matrix3(),proxyLocalNormal=new THREE.Matrix3(),p=new THREE.Vector3(),q=new THREE.Quaternion(),unit=new THREE.Vector3(1,1,1),hits=[];
 let disposed=false;
 function raycast(raycaster,result){
  if(collider.enabled===false)return;
  if(disposed||physics.world!==world||body.world!==world||world.getBodyById(body.id)!==body||body.shapes.length!==1||body.shapes[0]!==shape||shape.body!==body)
   throw new Error('Impact shard query lost its original physical owner');
  const position=body.position,orientation=body.quaternion,offset=body.shapeOffsets[0],rotation=body.shapeOrientations[0];
  if(![position.x,position.y,position.z,orientation.x,orientation.y,orientation.z,orientation.w,offset.x,offset.y,offset.z,rotation.x,rotation.y,rotation.z,rotation.w,half.x,half.y,half.z].every(Number.isFinite)
   ||Math.min(half.x,half.y,half.z)<=0||Math.abs(geometry.parameters.width-half.x*2)>1e-9||Math.abs(geometry.parameters.height-half.y*2)>1e-9||Math.abs(geometry.parameters.depth-half.z*2)>1e-9)
   throw new Error('Impact shard query requires the unchanged finite physical Box');
  pose.compose(p.copy(position),q.copy(orientation),unit);
  local.compose(p.copy(offset),q.copy(rotation),unit);query.matrixWorld.multiplyMatrices(pose,local);
  hits.length=0;query.raycast(raycaster,hits);
  if(hits.length){mesh.updateWorldMatrix(true,false);physicalNormal.getNormalMatrix(query.matrixWorld);proxyLocalNormal.setFromMatrix4(mesh.matrixWorld).transpose();}
  for(const hit of hits){
   for(const normal of [hit.face?.normal,hit.normal])normal?.applyNormalMatrix(physicalNormal).applyMatrix3(proxyLocalNormal).normalize();
   hit.object=mesh;result.push(hit);
  }
 }
 mesh.raycast=raycast;
 return {dispose(){if(disposed)return;disposed=true;if(mesh.raycast===raycast)mesh.raycast=original;geometry.dispose();material.dispose();}};
}
