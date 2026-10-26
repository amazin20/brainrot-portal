import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {Body,Box} from 'cannon-es';
import {gameplayContract,digest} from './lab-art-contract.js';

export const foundation4SupportFixture=JSON.parse(fs.readFileSync(new URL('../fixtures/foundation4-support-clevis-contract.json',import.meta.url),'utf8'));
export const foundation4SupportNames=foundation4SupportFixture.geometry.map(x=>x.name);

/** Only two accepted, visible query owners may be subtracted. The complete
 * original physical, panel, camera and aim contract still has its old digest.
 * Geometry hashes prevent the allowance from accepting a larger/blank mesh. */
export function normalizeFoundation4SupportQueries(contract,geometry){
 assert.equal(contract.room.id,'foundation-earned-momentum');assert.equal(contract.room.index,3);
 assert.deepEqual(geometry,foundation4SupportFixture.geometry);
 const copy=structuredClone(contract);
 for(const kind of ['camera','aim']){
  assert.deepEqual(copy[kind].filter(x=>foundation4SupportNames.includes(x.name)),foundation4SupportFixture[kind]);
  copy[kind]=copy[kind].filter(x=>!foundation4SupportNames.includes(x.name));
 }
 assert.equal(digest(copy),foundation4SupportFixture.baselineGameplayDigest,'An original gameplay/query owner changed outside the two exact approved supports');
 return copy;
}

export function foundation4SupportGeometry(game){
 const panel=game.firstLevel.panels['inclined-exit'],entry=game.physics.solids.get(panel.mesh.uuid),body=entry?.body,shape=body?.shapes[0];
 assert.ok(entry?.inWorld&&body.world===game.physics.world&&body.type===Body.STATIC&&shape instanceof Box);
 assert.equal(panel.collider.enabled,true);assert.equal(body.collisionResponse,true);assert.equal(shape.collisionResponse,true);
 assert.ok(game.physics.world.bodies.includes(body)&&shape.body===body);
 assert.ok((body.collisionFilterMask&game.physics.cargoBody.collisionFilterGroup)!==0&&(game.physics.cargoBody.collisionFilterMask&body.collisionFilterGroup)!==0,'The same original physical owner must still collide with the cargo');
 assert.deepEqual(body.quaternion.toArray(),[0,0,0,1]);
 const physical=new THREE.Box3(new THREE.Vector3().copy(body.position).sub(new THREE.Vector3().copy(shape.halfExtents)),new THREE.Vector3().copy(body.position).add(new THREE.Vector3().copy(shape.halfExtents)));
 assert.ok(physical.min.distanceTo(panel.collider.box.min)<1e-10&&physical.max.distanceTo(panel.collider.box.max)<1e-10,'The registered shape must reproduce the exact authored box to floating-point precision');
 game.scene.updateMatrixWorld(true);
 return foundation4SupportNames.map(name=>{
  const mesh=game.scene.getObjectByName(name);assert.ok(mesh?.isMesh&&mesh.visible&&mesh.material.visible!==false);
  for(let p=mesh;p;p=p.parent)assert.equal(p.visible,true);
  assert.equal(game.cameraBlockers.filter(x=>x===mesh).length,1);assert.equal(game.aimBlockers.filter(x=>x===mesh).length,1);
  assert.equal(mesh.userData.collisionProxy,undefined);assert.equal(mesh.userData.physicalSourceId,panel.mesh.uuid);
  assert.equal(game.colliders.some(c=>c.mesh===mesh),false,'The brace must not manufacture a second physical body');
  const vertices=mesh.geometry.attributes.position;
  for(let i=0;i<vertices.count;i++)assert.ok(physical.containsPoint(new THREE.Vector3().fromBufferAttribute(vertices,i).applyMatrix4(mesh.matrixWorld)),'A rendered vertex escaped the SAME registered Cannon Box');
  return{name,parameters:mesh.geometry.parameters,positionHash:digest(Array.from(vertices.array)),normalHash:digest(Array.from(mesh.geometry.attributes.normal.array))};
 });
}

export function foundation4SupportContract(game){return normalizeFoundation4SupportQueries(gameplayContract(game),foundation4SupportGeometry(game));}
