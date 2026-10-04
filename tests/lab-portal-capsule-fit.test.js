import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makePortalFrame,portalCrossing,uprightCapsuleFitsPortal} from '../src/game/LabPortals.js';
const v=(...p)=>new THREE.Vector3(...p);

test('capsule admission follows upright orientation: low wall admits cargo, floor admits player footprint',()=>{
 const wall=makePortalFrame(v(20,2,0),v(1,0,0),null,{width:.95,height:.65});
 const floor=makePortalFrame(v(0,0,0),v(0,1,0),null,{width:.95,height:.65});
 assert.equal(uprightCapsuleFitsPortal(wall,2.4,.43),false);
 assert.equal(uprightCapsuleFitsPortal(floor,2.4,.43),true);
 const wide=makePortalFrame(v(0,0,0),v(0,1,0));
 const from=v(0,.1,0),to=v(0,-.3,0),velocity=v(0,-80,0);
 assert.equal(portalCrossing(wide,wall,to,from,velocity,.43,{capsuleHeight:2.4}),null);
 const cargo=portalCrossing(wide,wall,to,from,velocity,.39);
 assert.ok(cargo);assert.ok(Math.abs(cargo.velocity.x-80)<1e-8);
});

test('small wall entry stays closed even when linked to a full sized exit',()=>{
 const wall=makePortalFrame(v(0,2,0),v(0,0,1),null,{width:.95,height:.65});
 const exit=makePortalFrame(v(20,5,0),v(1,0,0));
 assert.equal(portalCrossing(wall,exit,v(0,2,-.3),v(0,2,.1),v(0,0,-80),.43,{capsuleHeight:2.4}),null);
 assert.ok(portalCrossing(wall,exit,v(0,2,-.3),v(0,2,.1),v(0,0,-80),.39));
});

test('ordinary and rotated full-sized apertures remain available',()=>{
 for(const n of [v(0,1,0),v(0,0,1),v(1,1,0).normalize(),v(1,0,1).normalize()]){
  const frame=makePortalFrame(v(0,0,0),n);
  assert.equal(uprightCapsuleFitsPortal(frame,2.4,.43),true);
 }
});

test('a wide cargo entry cannot place a body outside the narrow exit aperture',()=>{
 const entry=makePortalFrame(v(0,0,0),v(0,1,0));
 const exit=makePortalFrame(v(20,2,0),v(1,0,0),null,{width:.95,height:.65});
 const from=v(.7,.1,0),to=v(.7,-.3,0),velocity=v(0,-80,0);
 assert.equal(portalCrossing(entry,exit,to,from,velocity,.39),null);
 assert.ok(portalCrossing(entry,exit,v(0,-.3,0),v(0,.1,0),velocity,.39));
});
