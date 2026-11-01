import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {LabPhysics} from '../src/game/LabPhysics.js';
import {playerFixture, portalPair, wall} from '../scripts/lib/adversarial-core-cases.mjs';

// Explicit small component setup; these are the real production updateCubes,
// LabPhysics and LabPortals, not an ordinary uploaded-actor campaign route.
// A free native Box actually crosses the pair before the dispatcher is read.
for (const c of [
  {name:'declared top-level mode',mode:'oriented-sat-v1',nested:null,expected:'oriented-sat-v1'},
  {name:'nested readability lookalike alone',mode:null,nested:'oriented-sat-v1',expected:null},
  {name:'top-level mode with a conflicting nested lookalike',mode:'oriented-sat-v1',nested:'not-the-mode',expected:'oriented-sat-v1'},
]) test('production free-cargo transit dispatch uses the level declaration: '+c.name,()=>{
  const g=playerFixture(),calls=[];
  try {
    portalPair(g); wall(g,20.94,5,0,.02,10,8);
    g.physics=new LabPhysics({gravity:0});
    for (const collider of g.colliders) g.physics.addStaticBox(collider.mesh.uuid,collider.box);
    const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI/4);
    g.cargo={position:new THREE.Vector3(0,5,.05),velocity:new THREE.Vector3(0,0,-22),quaternion:q,group:new THREE.Group()};
    const body=g.physics.createCargo({position:g.cargo.position,velocity:g.cargo.velocity,quaternion:q}),shape=body.shapes[0];
    g.companionAnimator={trigger(){}};
    g.playerPosition.set(100,0,100);
    Object.assign(g.firstLevel,{cargoOnAnyPad:()=>false,getLaunch:()=>null});
    if (c.mode!==null) g.firstLevel.cargoPortalTransitMode=c.mode;
    if (c.nested!==null) g.firstLevel.readability={cargoPortalTransitMode:c.nested};
    const resolve=g.physics.resolveCargoTransit;
    g.physics.resolveCargoTransit=function(from,options){
      const result=resolve.call(this,from,options);
      calls.push({mode:options.mode??null,resultMode:result.mode??null,contacts:result.contacts});
      return result;
    };
    g.updateCubes(1/120);
    assert.equal(g.physics.portalTransports,1,'The actual original native Box must cross before transit dispatch');
    assert.equal(calls.length,1,'The actual production destination resolver is called once');
    assert.equal(calls[0].mode,c.expected);
    assert.equal(calls[0].resultMode,c.expected,'The declared mode must reach the real implementation, including default legacy behavior');
    assert.ok(calls[0].contacts>0,'The genuine nearby destination wall remains physical');
    assert.equal(g.physics.cargoBody,body); assert.equal(body.shapes[0],shape);
    assert.equal(body.mass,3.2); assert.deepEqual(shape.halfExtents.toArray(),[.39,.39,.39]);
    assert.deepEqual(g.cargo.position.toArray(),body.position.toArray());
  } finally {g.physics?.dispose();g.portals.dispose();}
});
