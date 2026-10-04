import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {TOWER_STAGES,towerPoint} from '../src/game/LabTowerLayout.js';
import {createTowerMechanism} from '../src/game/LabTowerMechanisms.js';

test('balance catch rejects held cargo and direct placement without an escorted crossing',()=>{
 const definition=TOWER_STAGES.find(stage=>stage.id==='balance'),root=new THREE.Group();
 const material=new THREE.MeshBasicMaterial(),meshes=[],colliders=[];
 const position=new THREE.Vector3(...towerPoint(definition,5.1,0,definition.baseY+.58));
 const body={position:position.clone(),velocity:new THREE.Vector3(),force:new THREE.Vector3(),mass:3.2,wakeUp(){}};
 const game={colliders,heldCube:null,playerGrounded:true,
  playerPosition:new THREE.Vector3(...towerPoint(definition,4,0)),
  cargo:{position:position.clone()},physics:{grounded:true,cargoBody:body},
  portals:{ready:false,portals:[null,null]}};
 const box=(p,size,mat)=>{
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),mat);mesh.position.fromArray(p);
  mesh.updateWorldMatrix(true,false);root.add(mesh);meshes.push(mesh);
  colliders.push({mesh,box:new THREE.Box3().setFromObject(mesh),enabled:true});return mesh;
 };
 const mechanism=createTowerMechanism({game,definition,group:root,box,
  materials:{dark:material,ivory:material}});
 const at=(s,n,y)=>{const p=towerPoint(definition,s,n,definition.baseY+y);
  body.position.fromArray(p);body.velocity.set(0,0,0);game.cargo.position.fromArray(p);};
 try{
  at(5.1,0,3.7);assert.equal(mechanism.update(1/120).gravity,true);
  at(11.1,-9.25,3.74);
  assert.equal(mechanism.update(1/120).bridgeCatch,false,'A cargo placed on the remote platform is not a crossing');
  game.playerPosition.fromArray(towerPoint(definition,11,-3.5));
  game.heldCube=game.cargo;
  assert.equal(mechanism.update(1/120).bridgeCatch,false,'Carried cargo never charges the catch');
  game.heldCube=null;
  assert.equal(mechanism.update(1/120).bridgeCatch,false,'Releasing at the catch cannot invent the approach');
  at(9,-5.6,3.74);mechanism.update(1/120);
  assert.equal(mechanism.state.bridgeApproach,true,'Free cargo in the physical opening registers approach');
  at(11.1,-9.25,3.74);
  assert.equal(mechanism.update(1/120).bridgeCatch,true,'The free body must reach the elevated catch after the opening');
  mechanism.reset();assert.equal(mechanism.getSignals().bridgeCatch,false);
 }finally{mechanism.dispose();for(const mesh of meshes)mesh.geometry.dispose();material.dispose();}
});
