import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runFoundation20PhysicalJourney} from '../src/game/LabFoundation20PhysicalJourney.js';
import {assertFoundation20Route} from '../scripts/lib/foundation20-native-proof.mjs';

const dispose = g => {g.firstLevel?.dispose();g.physics?.dispose();g.portals?.dispose();};
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const V = () => new THREE.Vector3();

test('Foundation20 framing activates only for the manufactured Foundation room and clears across entry transitions', async () => {
  const g = await createHeadlessGame();
  try {
    for (const edition of ['classic', 'open', 'foundation']) {
      g.chamberEdition = edition;await g.selectLevel(19, true);
      const expected = edition === 'foundation';
      assert.equal(g.cameraRig.fullBodyFraming, expected);
      assert.equal(g.cameraRig.confinedFraming, expected);
      assert.equal(g.cameraRig.foundation20Framing, expected);
      assert.equal(g.firstLevel.id === 'foundation-portal-tension', expected);
      await g.selectLevel(18, true);
      assert.equal(g.cameraRig.fullBodyFraming, false);
      assert.equal(g.cameraRig.confinedFraming, false);
      assert.equal(g.cameraRig.foundation20Framing, false);
    }
    g.chamberEdition = 'foundation';
    for (const qualification of [false, true]) {
      g.tower41RatchetQualification = qualification;await g.selectLevel(40, true);
      assert.equal(g.cameraRig.fullBodyFraming, true);
      assert.equal(g.cameraRig.confinedFraming, true);
      assert.equal(g.cameraRig.foundation20Framing, false);
      await g.selectLevel(19, true);
      assert.equal(g.cameraRig.fullBodyFraming, true);
      assert.equal(g.cameraRig.confinedFraming, true);
      assert.equal(g.cameraRig.foundation20Framing, true);
    }
    g.puzzleProgression = true;
    for (const index of [49, 50]) {
      await g.selectLevel(index, true);
      assert.equal(g.firstLevel.puzzleProgression, index + 1);
      assert.equal(g.cameraRig.fullBodyFraming, true);
      assert.equal(g.cameraRig.confinedFraming, false);
      assert.equal(g.cameraRig.foundation20Framing, false);
    }
    g.puzzleProgression = false;await g.selectLevel(0, true);
    assert.equal(g.cameraRig.fullBodyFraming, false);
    assert.equal(g.cameraRig.confinedFraming, false);
    assert.equal(g.cameraRig.foundation20Framing, false);
  } finally {dispose(g);}
});

async function measureOrdinaryRoute(options) {
  const g = await createHeadlessGame();g.chamberEdition = 'foundation';await g.selectLevel(19, true);
  // Actual normal production updates, with empty initial controls, reproduce
  // the twelve pre-route physics steps in the independently recorded native
  // cargo-first attempt. Neither the actor nor the camera receives a pose.
  for (let n = 0; n < 6; n++) {g.updatePlaying(1 / 120);g.updatePlaying(1 / 120);g.updateVisuals(1 / 60, 1);}
  const initialStep = g.physics.world.stepnumber;
  const original = {root:g.playerGroup,visual:g.playerVisual,animator:g.animator,
    weapon:g.weapon,device:g.heldDevice,cargo:g.cargo,body:g.physics.cargoBody,shape:g.physics.cargoBody.shapes[0]};
  const rows = [], bones = new Set();
  original.visual.traverse(mesh => {
    if (!mesh.isMesh) return;
    const attributes = Object.entries(mesh.geometry.attributes).map(([name, attribute]) => ({name,attribute,array:attribute.array}));
    if (mesh.geometry.index) attributes.push({name:'$index',attribute:mesh.geometry.index,array:mesh.geometry.index.array});
    const skeleton = mesh.skeleton, skeletonBones = skeleton?.bones.slice() ?? [];
    skeletonBones.forEach(bone => bones.add(bone));
    rows.push({mesh,geometry:mesh.geometry,attributes,skeleton,skeletonBones,
      bindMatrix:mesh.bindMatrix?.toArray(),bindMode:mesh.bindMode,updateMatrixWorld:mesh.updateMatrixWorld,
      boneInverses:skeleton?.boneInverses.map(matrix => matrix.toArray()),vertices:mesh.geometry.attributes.position.count});
  });
  const appearance = () => rows.flatMap((row, meshIndex) => row.attributes.map(a => ({meshIndex,name:a.name,
    bytes:a.array.byteLength,sha256:hash(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength))})));
  const initialAppearance = appearance(), samples = [], shots = [], point = V();
  assert.equal(rows.reduce((n, row) => n + row.vertices, 0), 96753);assert.equal(bones.size, 15);
  function identity() {
    g.scene.updateMatrixWorld(true);
    for (const [name, value] of Object.entries({root:g.playerGroup,visual:g.playerVisual,animator:g.animator,
      weapon:g.weapon,device:g.heldDevice,cargo:g.cargo,body:g.physics.cargoBody,shape:g.physics.cargoBody.shapes[0]})) assert.ok(value===original[name],`Original ${name} changed`);
    assert.deepEqual(g.playerGroup.scale.toArray(), [1, 1, 1]);
    const current = [];g.playerVisual.traverse(mesh => {if(mesh.isMesh) current.push(mesh);});
    // The production held-device controller moves the same gun between its
    // hand and backpack sockets; that changes traversal order, not membership.
    assert.ok(current.length===rows.length&&current.every(mesh=>rows.some(row=>row.mesh===mesh)),'Original mesh membership changed');
    for (const row of rows) {
      assert.ok(row.mesh.geometry===row.geometry&&row.mesh.skeleton===row.skeleton,'Original geometry/skeleton changed');
      for (const a of row.attributes) assert.ok((a.name === '$index' ? row.geometry.index : row.geometry.attributes[a.name])===a.attribute,'Original attribute changed');
      assert.deepEqual(row.mesh.bindMatrix?.toArray(), row.bindMatrix);
      assert.equal(row.mesh.bindMode,row.bindMode);assert.equal(row.mesh.updateMatrixWorld,row.updateMatrixWorld);
      // Attached SkinnedMesh.updateMatrixWorld recomputes this inverse from
      // the current root transform during ordinary animation. Check that
      // production relation rather than freezing a legitimate derived cache.
      if(row.mesh.isSkinnedMesh) {
        const expected=(row.bindMode==='attached'?row.mesh.matrixWorld:row.mesh.bindMatrix).clone().invert().toArray();
        assert.ok(row.mesh.bindMatrixInverse.toArray().every((value,index)=>Math.abs(value-expected[index])<1e-10));
      }
      assert.deepEqual(row.skeleton?.boneInverses.map(matrix => matrix.toArray()), row.boneInverses);
      assert.ok((row.skeleton?.bones.length??0)===row.skeletonBones.length&&row.skeletonBones.every((bone,index)=>bone===row.skeleton.bones[index]),'Original skeleton membership changed');
    }
  }
  function capture(state, terminal = false) {
    identity();g.camera.updateWorldMatrix(true, false);
    for (const skeleton of new Set(rows.map(row => row.skeleton).filter(Boolean))) skeleton.update();
    const projection = {vertices:0,bones:bones.size,minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity,
      minDepth:Infinity,maxDepth:-Infinity,outside:0,behind:0,near:0,renderEligibleVertices:0,renderEligibleOutside:0,extrema:{}};
    const eligibility = [];
    for (const row of rows) {
      let objectVisible = true;for(let node=row.mesh;node;node=node.parent) objectVisible &&= node.visible;
      const materialVisible = (Array.isArray(row.mesh.material) ? row.mesh.material : [row.mesh.material]).some(material => material.visible);
      const layerMatch = row.mesh.layers.test(g.camera.layers), renderEligible = objectVisible && materialVisible && layerMatch;
      eligibility.push({meshUuid:row.mesh.uuid,vertices:row.vertices,objectVisible,materialVisible,layerMatch,renderEligible});
      for (let index=0;index<row.vertices;index++) {
        row.mesh.getVertexPosition(index,point).applyMatrix4(row.mesh.matrixWorld);
        const world=point.toArray(),depth=-point.clone().applyMatrix4(g.camera.matrixWorldInverse).z;
        point.project(g.camera);const ndc=point.toArray();assert.ok(ndc.every(Number.isFinite));projection.vertices++;
        for(const [key,value,direction] of [['minX',point.x,-1],['maxX',point.x,1],['minY',point.y,-1],['maxY',point.y,1],['minDepth',depth,-1],['maxDepth',depth,1]]) {
          if(value*direction>projection[key]*direction) {projection[key]=value;projection.extrema[key]={meshUuid:row.mesh.uuid,vertex:index,world,ndc,depth};}
        }
        const outside=depth<=0||Math.abs(point.x)>1||Math.abs(point.y)>1||point.z< -1||point.z>1;
        if(outside)projection.outside++;if(depth<=0)projection.behind++;if(depth<=g.camera.near)projection.near++;
        if(renderEligible){projection.renderEligibleVertices++;if(outside)projection.renderEligibleOutside++;}
      }
    }
    assert.equal(projection.vertices, 96753);assert.ok(g.camera.fov>0&&g.camera.fov<=120);
    samples.push({visualFrame:state.visualFrame,terminal,worldStep:state.worldStep,routeSeconds:state.seconds,
      player:state.player,cargo:state.cargo,state:state.state,
      camera:{eye:g.camera.position.toArray(),quaternion:g.camera.quaternion.toArray(),fov:g.camera.fov,
        aspect:g.camera.aspect,near:g.camera.near,far:g.camera.far,matrixWorldInverse:g.camera.matrixWorldInverse.toArray(),projection:g.camera.projectionMatrix.toArray(),
        flags:{fullBodyFraming:g.cameraRig.fullBodyFraming,confinedFraming:g.cameraRig.confinedFraming,foundation20Framing:g.cameraRig.foundation20Framing,obstructed:g.cameraRig.obstructed}},
      controls:{yaw:g.yaw,pitch:g.pitch,aimHeld:Boolean(g.aimHeld)},projection,eligibility});
  }
  const target = g.portalShots.captureTarget;
  let lastState = null;
  g.portalShots.captureTarget = function(index) {
    const eye=g.camera.position.clone(),quaternion=g.camera.quaternion.clone(),fov=g.camera.fov,step=g.physics.world.stepnumber;
    const result=target.call(this,index),ndc=result.clone().project(g.camera);
    assert.ok(g.camera.position.equals(eye)&&g.camera.quaternion.equals(quaternion));assert.equal(g.camera.fov,fov);
    assert.equal(g.physics.world.stepnumber,step);assert.ok(Math.abs(ndc.x)<1e-9&&Math.abs(ndc.y)<1e-9);
    assert.ok(result.clone().sub(eye).dot(g.camera.getWorldDirection(V()))>0);
    shots.push({slot:index,requestAfterVisualFrame:lastState?.visualFrame??-1,requestWorldStep:step,
      worldTarget:result.toArray(),ndc:ndc.toArray(),eye:eye.toArray(),quaternion:quaternion.toArray(),fov,
      actualRay:{origin:this.ray.ray.origin.toArray(),direction:this.ray.ray.direction.toArray()}});
    return result;
  };
  let route;
  try {
    route=await runFoundation20PhysicalJourney(g,{...options,onMilestone:mark=>console.log('CAMERA_POLICY_MILESTONE',options.order,mark.name,mark.frame),onFrame:state=>{
      assert.equal(state.worldStep, initialStep+(state.visualFrame+1)*2);lastState=state;
      if(state.visualFrame%15===0)capture(state);
    }});
    if(samples.at(-1).visualFrame!==route.frames-1)capture(lastState,true);
    assertFoundation20Route(route);identity();assert.deepEqual(appearance(),initialAppearance);
    assert.equal(g.state,'won');assert.equal(g.heldCube,original.cargo);assert.equal(shots.length,route.shots);
    return {kind:'ordinary-foundation20-cpu-camera-policy-diagnostic',options,route,
      sampledVertices:96753,bones:15,initialStep,samplingStride:15,samples,shots,
      originalAppearance:initialAppearance,geometryUnchanged:true,skinBindingsUnchanged:true,
      scope:'Actual ordinary production CPU routes and original animated vertex projections at the 4fps schedule plus terminal. No WebGL film, occlusion, every-render-frame or native lens acceptance.',
      accepted:false,nativeOpticalAccepted:false,room20CameraAccepted:false,sourceAccepted:false,publicationAccepted:false};
  } finally {g.portalShots.captureTarget=target;dispose(g);}
}

for (const [name, options] of [
  ['cargo-first',{order:'cargo-first'}],
  ['scout-first-recovery',{order:'scout-first',recovery:true}],
  ['post-near-release-recovery',{order:'cargo-first',recovery:true,recoveryPhase:'after-near-release'}],
]) {
  test(`ordinary Foundation20 ${name} retains the original rig and screen-centre shots through all scheduled camera samples`, {timeout:600000}, async () => {
    const report=await measureOrdinaryRoute(options);
    if(process.env.FOUNDATION20_CAMERA_DIAG_DIR) {
      fs.mkdirSync(process.env.FOUNDATION20_CAMERA_DIAG_DIR,{recursive:true});
      fs.writeFileSync(path.join(process.env.FOUNDATION20_CAMERA_DIAG_DIR,`${name}.json`),JSON.stringify(report)+'\n');
    }
    assert.equal(report.samples.at(-1).visualFrame,report.route.frames-1);
    assert.equal(report.samples.length,Math.ceil(report.route.frames/15)+(report.route.frames%15===1?0:1));
    assert.deepEqual(report.samples.filter(sample=>sample.projection.outside>0).map(sample=>({visualFrame:sample.visualFrame,outside:sample.projection.outside,minY:sample.projection.minY})), []);
    if(name==='cargo-first') {
      const cropWindow=report.samples.find(sample=>sample.visualFrame===3075);
      assert.ok(cropWindow,'Retain the genuine previously cropped ordinary frame');
      assert.equal(cropWindow.projection.outside,0);assert.ok(cropWindow.projection.minY>=-1);
    }
  });
}
