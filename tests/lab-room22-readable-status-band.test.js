import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {gameplayContract} from './helpers/lab-art-contract.js';

test('room22 status stripe reveals the real gate cassettes while retaining its original signal and moving ownership',async()=>{
 const game=await createHeadlessGame();game.chamberEdition='foundation';
 try{
  await game.selectLevel(21,true);const level=game.firstLevel,art=level.biosphereArt;
  const band=level.freightArchitecture.bands[0],geometry=band.geometry,material=band.material;
  assert.deepEqual([geometry.parameters.width,geometry.parameters.height,geometry.parameters.depth],[.05,.37,5.4]);
  assert.equal(game.colliders.some(c=>c.mesh===band),false);assert.equal(game.cameraBlockers.includes(band),false);assert.equal(game.aimBlockers.includes(band),false);
  const before=gameplayContract(game),bodies=game.physics.world.bodies.slice(),shapes=bodies.map(b=>b.shapes.slice());
  const cast=y=>{
   game.scene.updateMatrixWorld(true);
   return new THREE.Raycaster(new THREE.Vector3(-2,y,12),new THREE.Vector3(1,0,0),0,4).intersectObjects([band,...art.children],false)[0];
  };
  for(const y of [1.5,3.9])assert.ok(art.children.includes(cast(y)?.object),'The upper and lower cassette fields must remain visible beside the strip');
  assert.equal(cast(2.7)?.object,band,'The live central stripe remains visible');
  const old=new THREE.BoxGeometry(.05,4.95,5.4);
  try{
   band.geometry=old;
   for(const y of [1.5,2.7,3.9])assert.equal(cast(y)?.object,band,'The former broad luminous panel must reproduce the covered cassettes');
   assert.deepEqual(gameplayContract(game),before,'A paint-band dimension must not affect physics, aiming or portals');
  }finally{band.geometry=geometry;old.dispose();}
  for(const progress of [.5,1,0]){
   level.shutters.progress=progress;level.update(0);level.renderUpdate(1);
   assert.equal(band.material,material);
   assert.ok(band.position.distanceTo(level.shutters.lower.mesh.position.clone().add(new THREE.Vector3(-.35,0,0)))<1e-10);
   assert.equal(level.freightArchitecture.signals[0].material===material,progress>.95);
  }
  assert.deepEqual(game.physics.world.bodies,bodies);
  for(let n=0;n<bodies.length;n++)assert.deepEqual(bodies[n].shapes,shapes[n]);
 }finally{game.firstLevel?.dispose?.();game.physics?.dispose();game.portals?.dispose();}
});
