import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {LabCamera} from '../src/game/LabCamera.js';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runWorkshopJourney} from '../src/game/LabWorkshopJourney.js';

function fixture({blockedPreferred=false}={}) {
  const camera=new THREE.PerspectiveCamera(62,390/844,.06,160);
  const rig=new LabCamera({camera}),target=new THREE.Vector3(),meshes=[];
  rig.reset(target,0,0);
  function wall(size,position) {
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
    mesh.position.fromArray(position);mesh.updateMatrixWorld(true);rig.blockers.push(mesh);meshes.push(mesh);return mesh;
  }
  if(blockedPreferred) {
    wall([4,8,16],[2.45,3,6]);
    // Camera-only fixture: its real actor and original aiming ray remain fixed.
    camera.position.set(-2.2,1.72,5.6);
  }
  return {rig,camera,target,wall,dispose(){for(const mesh of meshes){mesh.geometry.dispose();mesh.material.dispose();}}};
}

function observeCandidates(rig) {
  const original=rig.constrain,candidates=[];
  rig.constrain=function(origin,end,...rest) {
    if(origin===this.playerPivot)candidates.push(end.clone().sub(origin).dot(this.right));
    return original.call(this,origin,end,...rest);
  };
  return {candidates,restore(){rig.constrain=original;}};
}

function assertSafeFrame(rig,frame) {
  assert.ok(frame&&frame.fov<=110);
  assert.equal(rig.ordinaryPortraitAimClear(frame.position),true);
  assert.ok(rig.silhouetteFovAt(frame.position)<=frame.fov+1e-7);
  const fromActor=frame.position.clone(),fromEye=frame.position.clone();
  rig.constrain(rig.playerPivot,fromActor,110);rig.constrain(rig.camera.position,fromEye,110);
  assert.ok(fromActor.distanceTo(frame.position)<1e-7,'The final near plane crosses a blocker from the actor');
  assert.ok(fromEye.distanceTo(frame.position)<1e-7,'The shoulder transition crosses a blocker from the live eye');
}

test('a clear preferred shoulder never inspects opposite candidates',()=>{
  const f=fixture(),seen=observeCandidates(f.rig);
  try {
    const frame=f.rig.ordinaryPortraitEscape();
    assert.ok(frame&&f.rig.ordinaryPortraitRecipe.lateral>0);
    assert.equal(seen.candidates.length,18);
    assert.ok(seen.candidates.every(lateral=>lateral>0));
    assert.equal(f.rig.ordinaryPortraitAimClear(frame.position),true);
    assert.ok(f.rig.silhouetteFovAt(frame.position)<=frame.fov+1e-7);
    seen.candidates.length=0;
    assert.deepEqual(f.rig.ordinaryPortraitEscape(),frame);
    assert.equal(seen.candidates.length,1,'The existing preferred cache must retain its single live revalidation');
  } finally {seen.restore();f.dispose();}
});

test('a real preferred-side wall admits only a bounded, swept opposite escape and revalidates its cache',()=>{
  const f=fixture({blockedPreferred:true}),seen=observeCandidates(f.rig);
  try {
    const frame=f.rig.ordinaryPortraitEscape();
    assert.ok(f.rig.ordinaryPortraitRecipe.lateral<0);
    assert.equal(seen.candidates.length,36);
    assert.ok(seen.candidates.slice(0,18).every(lateral=>lateral>0));
    assert.ok(seen.candidates.slice(18).every(lateral=>lateral<0));
    seen.restore();assertSafeFrame(f.rig,frame);
    const cached=f.rig.ordinaryPortraitRecipe;
    const again=observeCandidates(f.rig);
    assert.deepEqual(f.rig.ordinaryPortraitEscape(),frame);assert.equal(again.candidates.length,1);again.restore();
    // Close both shoulders in front of the actor after caching a safe view.
    f.wall([30,12,.2],[0,3,1.7]);
    const closed=observeCandidates(f.rig);
    assert.equal(f.rig.ordinaryPortraitEscape(),null);
    assert.equal(f.rig.ordinaryPortraitRecipe,null);
    assert.equal(closed.candidates.length,36,'The rejected cached recipe must not be queried a second time');
    assert.ok(cached.lateral<0);closed.restore();
  } finally {seen.restore();f.dispose();}
});

test('an opposite endpoint across a newly inserted wall is rejected even when its actor sweep remains clear',()=>{
  const f=fixture({blockedPreferred:true});
  try {
    const recipe={rear:5.6,lateral:-1.4,height:.4};
    const endpoint=f.rig.playerPivot.clone().add(new THREE.Vector3(-1.4,.4,5.6));
    f.wall([.1,8,1.2],[-1.8,3,5.6]);
    const actorSweep=endpoint.clone(),eyeSweep=endpoint.clone();
    assert.equal(f.rig.constrain(f.rig.playerPivot,actorSweep,110),false);
    assert.equal(f.rig.ordinaryPortraitAimClear(endpoint),true);
    assert.ok(f.rig.silhouetteFovAt(endpoint)<110);
    assert.equal(f.rig.constrain(f.camera.position,eyeSweep,110),true);
    assert.ok(eyeSweep.distanceTo(endpoint)>.7,'The fixture must separate endpoint safety from transport safety');
    f.rig.ordinaryPortraitRecipe=recipe;
    const frame=f.rig.ordinaryPortraitEscape();
    assert.notDeepEqual(f.rig.ordinaryPortraitRecipe,recipe);
    assertSafeFrame(f.rig,frame);
  } finally {f.dispose();}
});

test('only the temporary opposite cache retires when the ordinary boom clears',()=>{
  for(const lateral of [2.2,-2.2]) {
    const f=fixture(),recipe={rear:5.6,lateral,height:.4};
    try {
      f.rig.ordinaryPortraitRecipe=recipe;
      f.rig.update({dt:1/60,target:f.target,yaw:0,pitch:0});
      assert.equal(f.rig.obstructed,false);
      assert.equal(f.rig.ordinaryPortraitRecipe,lateral<0?null:recipe);
    } finally {f.dispose();}
  }
});

test('wide, square and specialized portrait camera paths never enter the ordinary escape search',()=>{
  for(const mode of ['wide','square','silhouette','mechanism']) {
    const f=fixture();
    try {
      if(mode==='wide')f.camera.aspect=16/9;
      if(mode==='square')f.camera.aspect=1;
      if(mode==='silhouette')f.rig.configureSilhouette({enabled:true});
      if(mode==='mechanism')f.rig.configureMechanismFraming({enabled:true});
      f.camera.updateProjectionMatrix();f.rig.reset(f.target,0,-.12);
      f.wall([20,12,.3],[0,4,5]);
      f.rig.ordinaryPortraitEscape=()=>assert.fail(`${mode} entered ordinary shoulder search`);
      for(let frame=0;frame<120;frame++)f.rig.update({dt:1/60,target:f.target,yaw:0,pitch:-.12});
      assert.equal(f.rig.ordinaryPortraitRecipe,null);
    } finally {f.dispose();}
  }
});

test('the ordinary room9 portrait route repeatedly exposes the linkage without changing either actor or crossing walls',async()=>{
  const g=await createHeadlessGame();g.chamberEdition='foundation';g.camera.aspect=390/844;g.camera.updateProjectionMatrix();await g.selectLevel(8,true);
  const body=g.physics.cargoBody,shape=body.shapes[0],cargo=g.cargo,visual=g.updateVisuals;
  let inspection=false,inspectionFrames=0,oppositeFrames=0,transportFrames=0;
  g.updateVisuals=function(...args) {
    const previous=this.camera.position.clone();visual.apply(this,args);
    assert.equal(this.cargo,cargo);assert.equal(this.physics.cargoBody,body);assert.equal(body.shapes[0],shape);
    const r=this.cameraRig;
    if(r.ordinaryPortraitRecipe?.lateral<0) {
      oppositeFrames++;
      const swept=this.camera.position.clone();r.constrain(previous,swept,110);
      assert.ok(swept.distanceTo(this.camera.position)<1e-7,'The live route shoulder crossed production geometry');transportFrames++;
    }
    if(inspection) {
      inspectionFrames++;
      assert.ok(r.ordinaryPortraitRecipe?.lateral<0);
      assert.equal(r.ordinaryPortraitAimClear(this.camera.position),true,'The character covers the centre aiming ray');
      assert.ok(r.silhouetteFovAt(this.camera.position)<=this.camera.fov+1e-5,'The actual final lens clips the retained character envelope');
      assert.ok(this.camera.fov<=110);
      const swept=this.camera.position.clone();r.constrain(r.playerPivot,swept,this.camera.fov);
      assert.ok(swept.distanceTo(this.camera.position)<1e-7,'The displayed near plane crosses production geometry');
      const target=new THREE.Vector3(-3.2,1.35,-5).project(this.camera);
      assert.ok(Math.abs(target.x)<.04&&Math.abs(target.y)<.04,'The unchanged inspection controls must still point at the linkage');
    }
  };
  try {
    const report=await runV8Journey(g,{journeyOptions:{nativeStart:true},scenario:async d=>{
      await runWorkshopJourney({...d,mark(name){d.mark(name);if(name==='inspected spring linkage and guard slot'){inspection=true;d.wait(.5);inspection=false;}}});
    }});
    assert.equal(report.pass,true);assert.equal(g.state,'won');assert.equal(report.resets,0);assert.equal(report.respawns,0);
    assert.equal(inspectionFrames,30);assert.ok(oppositeFrames>inspectionFrames);assert.equal(transportFrames,oppositeFrames);
    assert.equal(g.physics.cargoBody,body);assert.equal(body.shapes[0],shape);
  } finally {g.updateVisuals=visual;g.firstLevel.dispose();g.physics.dispose();g.portals.dispose();}
});
