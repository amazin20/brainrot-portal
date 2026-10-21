import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {LabCamera} from '../src/game/LabCamera.js';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runTower41RatchetCellJourney} from '../src/game/LabTower41RatchetCellJourney.js';

const V = (...p) => new THREE.Vector3(...p);
const dispose = g => {g.firstLevel?.dispose();g.physics?.dispose();g.portals?.dispose();};

test('castle silhouette fitting is scoped to room41 and clears on ordinary and accepted finale transitions', async () => {
  const g = await createHeadlessGame();
  try {
    g.chamberEdition = 'foundation';
    assert.equal(g.cameraRig.fullBodyFraming, false);
    assert.equal(g.cameraRig.confinedFraming, false);
    for (const qualification of [false, true]) {
      g.tower41RatchetQualification = qualification;
      await g.selectLevel(40, false);
      assert.equal(g.firstLevel.singularity, true);
      assert.equal(g.cameraRig.fullBodyFraming, true);
      assert.equal(g.cameraRig.confinedFraming, true);
      assert.equal(Boolean(g.firstLevel.ratchetCell), qualification);
      await g.selectLevel(0, false);
      assert.equal(g.cameraRig.fullBodyFraming, false);
      assert.equal(g.cameraRig.confinedFraming, false);
    }
    g.puzzleProgression = true;
    for (const index of [49, 50]) {
      await g.selectLevel(index, false);
      assert.equal(g.firstLevel.puzzleProgression, index + 1);
      assert.equal(g.cameraRig.fullBodyFraming, true);
      assert.equal(g.cameraRig.confinedFraming, false,
        'Accepted room50/51 must retain their existing tilted-only lens fit');
    }
    await g.selectLevel(0, false);
    assert.equal(g.cameraRig.fullBodyFraming, false);
    assert.equal(g.cameraRig.confinedFraming, false);
  } finally {dispose(g);}
});

test('upright confined fit preserves the optical axis, frozen frames and a finite obstruction budget', () => {
  // Optical replay of the measured 2535-frame collision-limited castle lens.
  // This fixture cannot establish that a synthetic camera pose is reachable.
  const camera = new THREE.PerspectiveCamera(62.036750294412926, 16 / 9, .1, 130);
  const rig = new LabCamera({camera, fullBodyFraming: true});
  rig.playerPivot.fromArray([-33.66789055483616, 1.3199528060377628, 44.978853225899144]);
  rig.focus.fromArray([-33.70931270888078, 1.3197181997178546, 45.04636459535939]);
  rig.lookPoint.fromArray([-18.489969544151315, -.9129716345899288, 49.44939647555072]);
  camera.position.fromArray([-34.30182006025366, 1.338936390456719, 41.958788230902414]);
  camera.quaternion.fromArray([-.034200371740996174, -.8432914829498752, -.05404584299762244, .5336373826969528]);
  camera.updateMatrixWorld(true);camera.updateProjectionMatrix();
  const oldFov = camera.fov, eye = camera.position.clone(), axis = camera.getWorldDirection(V());
  rig.obstructed = true;
  rig.fitSilhouetteLens(1 / 60);
  assert.equal(camera.fov, oldFov, 'The existing upright room50/51 branch remains unchanged');
  rig.configureSilhouette({enabled: true, confined: true});
  rig.obstructed = false;rig.fitSilhouetteLens(1 / 60);
  assert.equal(camera.fov, oldFov, 'Clear upright views retain the normal lens');
  rig.obstructed = true;rig.fitSilhouetteLens(0);
  assert.equal(camera.fov, oldFov, 'Pause cannot advance the fitting state');
  rig.fitSilhouetteLens(1 / 60);
  assert.equal(camera.fov, 120);
  assert.ok(camera.position.distanceTo(eye) < 1e-10);
  assert.ok(camera.getWorldDirection(V()).distanceTo(axis) < 1e-9,
    'The visible optical axis and screen-centre shot ray must be retained');
  let envelopeOutside = 0;
  for (const x of [-.65, .65]) for (const y of [-1.52, 1.52]) for (const z of [-.65, .65]) {
    const point = V(x, y, z).add(rig.playerPivot).project(camera);
    assert.ok(point.toArray().every(Number.isFinite));
    if (Math.abs(point.x) > 1 || Math.abs(point.y) > 1) envelopeOutside++;
  }
  assert.ok(envelopeOutside > 0,
    'Keep the explicit finite budget limit: empty envelope corners can exceed the lens');
  const fitted = {fov: camera.fov, velocity: rig.fovVelocity};
  rig.fitSilhouetteLens(0);
  assert.deepEqual({fov: camera.fov, velocity: rig.fovVelocity}, fitted);
  rig.configureSilhouette({enabled: false});
  assert.equal(rig.confinedFraming, false);
});

/** Historical negative control for the recorded v66 camera defect. In
 * fa37048, applyCastleMaterials left these wing-wall query owners on k.cube;
 * v67 carves their actual geometry into closed coffers. Reproduce only that
 * documented historical query surface in the legacy run, using the unchanged
 * original shared unit cube already present in this very castle. This is not
 * a current-scene art adjustment, and it never runs on the fixed-camera path.
 * Collider bounds, poses, physical bodies, rendered batches and new exterior
 * columns remain actual v67; this comparator is specifically the old flat
 * wing-wall camera-query scene, not a claim to replay the entire old build. */
function historicalV66FlatWallQueries(g) {
  const walls = [...new Set(g.cameraBlockers)].filter(mesh => mesh.userData.castlePerimeterCoffer);
  assert.equal(walls.length, 109, 'Declare every new coffer wall participating in the historical comparator');
  const originalUnitCubes = [...new Set(g.cameraBlockers.filter(mesh => !mesh.userData.castlePerimeterCoffer
    && mesh.geometry?.type === 'BoxGeometry'
    && ['width', 'height', 'depth'].every(key => mesh.geometry.parameters[key] === 1)).map(mesh => mesh.geometry))];
  assert.equal(originalUnitCubes.length, 1, 'Use the genuine unchanged shared k.cube, never a synthetic camera blocker');
  const [originalUnitCube] = originalUnitCubes;
  assert.equal(originalUnitCube.attributes.position.count, 24);
  assert.equal(originalUnitCube.index.count, 36);
  const registries = [g.colliders, g.aimBlockers, g.cameraBlockers, g.portalPanels, g.floors];
  const before = registries.map(items => [...items]);
  for (const mesh of walls) {
    const geometry = mesh.geometry, collider = mesh.userData.collider;
    assert.equal(geometry.name, 'Castle perimeter / closed load-bearing stone coffers');
    assert.ok(collider && !collider.kinematic);
    const box = collider.box.clone(), pose = mesh.matrixWorld.clone();
    mesh.geometry = originalUnitCube;
    assert.deepEqual(collider.box, box, 'The historical query comparator must not alter physical wall bounds');
    assert.deepEqual(mesh.matrixWorld, pose, 'Historical flat queries retain the actual wall pose');
  }
  registries.forEach((items, i) => assert.deepEqual(items, before[i]));
  return {kind: 'historical-v66-flat-wing-wall-camera-query', sourceCommit: 'fa37048d48a279203a6eae7e945f5f5880a2b499', restoredWallQueries: walls.length,
    physicalBoundsUnchanged: true, exteriorColumnsUnchanged: true};
}

async function measureRoute(legacy) {
  const g = await createHeadlessGame();
  let originalVisual;
  try {
    g.chamberEdition = 'foundation';g.tower41RatchetQualification = true;
    await g.selectLevel(40, true);
    const currentCoffers = [...new Set(g.cameraBlockers)].filter(mesh => mesh.userData.castlePerimeterCoffer)
      .map(mesh => ({mesh, geometry: mesh.geometry}));
    const comparisonScene = legacy ? historicalV66FlatWallQueries(g) : {kind: 'current-actual-v67-coffer-scene'};
    if (legacy) g.cameraRig.configureSilhouette({enabled: false});
    const cargo = g.cargo, body = g.physics.cargoBody, root = g.playerGroup, visual = g.playerVisual;
    const meshes = [];
    visual.traverse(mesh => {if (mesh.isMesh) meshes.push({mesh, geometry: mesh.geometry,
      position: mesh.geometry.attributes.position, index: mesh.geometry.attributes.skinIndex,
      weight: mesh.geometry.attributes.skinWeight, skeleton: mesh.skeleton});});
    assert.equal(meshes.reduce((n, {position}) => n + position.count, 0), 96753);
    assert.equal(Math.max(...meshes.map(({skeleton}) => skeleton?.bones.length ?? 0)), 15);
    const samples = [], point = V();let frames = 0, maxFov = 0;
    function capture(frame, terminal = false) {
      g.scene.updateMatrixWorld(true);
      let outside = 0, vertices = 0;
      for (const row of meshes) {
        assert.equal(row.mesh.geometry, row.geometry);
        assert.equal(row.geometry.attributes.position, row.position);
        assert.equal(row.geometry.attributes.skinIndex, row.index);
        assert.equal(row.geometry.attributes.skinWeight, row.weight);
        assert.equal(row.mesh.skeleton, row.skeleton);
        row.skeleton?.update();
        for (let i = 0; i < row.position.count; i++) {
          row.mesh.getVertexPosition(i, point).applyMatrix4(row.mesh.matrixWorld).project(g.camera);
          assert.ok(point.toArray().every(Number.isFinite));vertices++;
          if (Math.abs(point.x) > 1 || Math.abs(point.y) > 1 || point.z < -1 || point.z > 1) outside++;
        }
      }
      assert.equal(vertices, 96753);
      const safe = g.camera.position.clone();g.cameraRig.constrain(g.cameraRig.playerPivot, safe);
      assert.ok(safe.distanceTo(g.camera.position) < 1e-7,
        'The fitted final lens must still obey the current near-plane collision sweep');
      assert.equal(g.cargo, cargo);assert.equal(g.physics.cargoBody, body);
      assert.equal(g.playerGroup, root);assert.equal(g.playerVisual, visual);
      samples.push({frame, terminal, outside, vertices, fov: g.camera.fov});
    }
    originalVisual = g.updateVisuals;
    g.updateVisuals = function (...args) {
      originalVisual.apply(this, args);maxFov = Math.max(maxFov, this.camera.fov);
      if (frames % 15 === 0) capture(frames);
      frames++;
    };
    const route = await runTower41RatchetCellJourney(g);
    capture(frames - 1, true);
    assert.equal(route.pass, true);
    assert.equal(route.resets + route.respawns + route.cargoResets + route.mechanismResets, 0);
    assert.equal(route.fastRelease.pass, true);assert.equal(route.boarding.pass, true);
    assert.equal(route.heldContact.status, 'CONTACT_OBSERVED');
    assert.equal(route.preparation.sameCompanion, true);
    assert.equal(g.heldCube, cargo);
    if (!legacy) for (const row of currentCoffers) assert.equal(row.mesh.geometry, row.geometry,
      'The fixed-camera run must keep every actual new coffer query geometry');
    return {frames, samples, maxFov, comparisonScene, outside: samples.filter(s => s.outside > 0)};
  } finally {if (originalVisual) g.updateVisuals = originalVisual;dispose(g);}
}

test('historical v66 flat-wall queries reproduce fifteen camera crop samples while the actual current castle route fits',
  {timeout: 600000}, async () => {
    // Both runs use the unchanged ordinary freight preparation, then native
    // move/jump/E and the real four-body contact cell. This CPU optical evidence
    // is sampled at 4fps plus the terminal frame; it is not a WebGL, occlusion,
    // every-render-frame, portrait-device or human-usability acceptance.
    const old = await measureRoute(true), fixed = await measureRoute(false);
    assert.equal(old.comparisonScene.kind, 'historical-v66-flat-wing-wall-camera-query');
    assert.equal(fixed.comparisonScene.kind, 'current-actual-v67-coffer-scene');
    assert.equal(old.frames, 7248);assert.equal(fixed.frames, old.frames);
    assert.equal(old.samples.length, 485);assert.equal(fixed.samples.length, old.samples.length);
    assert.equal(old.outside.length, 15, 'Retain the accepted recorded-route crop witness');
    assert.ok(old.samples.find(s => s.frame === 2535).outside > 70000,
      'The severe upright approach failure must remain reproducible');
    assert.ok(old.samples.at(-1).outside > 250, 'Retain the persistent final shoulder crop');
    assert.deepEqual(fixed.outside, [], 'Every declared original-skin sample must fit the actual lens');
    assert.ok(fixed.maxFov > 102 && fixed.maxFov <= 120,
      'This confined-view correction needs a separate finite castle lens budget');
  });
