import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createHeadlessGame } from '../scripts/lab-headless.mjs';

// Real scene geometry, including decoded source GLBs, detects opaque machinery
// accidentally covering the impeller. This is an occlusion regression check;
// target-browser screenshots remain the evidence for lighting/material quality.
test('room 15 exposes turbine hub and blades while preserving the original solid backplate', async () => {
  const game = await createHeadlessGame();
  try {
    await game.selectLevel(14, false);
    const level = game.firstLevel, field = level.workshop.state.funnel;
    const turbine = level.world.root.getObjectByName('Browser 3D transfer-field turbine');
    const rotor = turbine?.getObjectByName('transfer-rotor');
    assert.ok(rotor, 'the field emitter must contain its authored impeller');
    level.world.root.updateWorldMatrix(true, true);

    // Hiding a render material must retain the original body, aim blocker and
    // camera blocker. Reversal must not re-enable the discarded flat backplate.
    const collider = game.colliders.find(c => c.mesh === field.housing);
    assert.ok(collider && collider.enabled !== false);
    assert.ok(game.aimBlockers.includes(field.housing));
    assert.ok(game.cameraBlockers.includes(field.housing));
    assert.equal(field.housing.visible, true);
    assert.equal(field.housing.material.visible, false);
    assert.ok(collider.box.getSize(new THREE.Vector3()).distanceTo(new THREE.Vector3(.3, 4.65, 4.65)) < 1e-5);
    field.reversed = true; field.render();
    assert.equal(field.housing.material.visible, false);

    const opaqueMeshes = [];
    level.world.root.traverseVisible(node => {
      if (!node.isMesh) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      if (materials.some(m => m.visible && (!m.transparent || m.opacity >= .99))) opaqueMeshes.push(node);
    });
    const belongsToRotor = node => {
      for (let parent = node; parent; parent = parent.parent) if (parent === rotor) return true;
      return false;
    };
    const firstVisibleHit = ray => ray.intersectObjects(opaqueMeshes, false).find(hit => {
      const material = Array.isArray(hit.object.material)
        ? hit.object.material[hit.face.materialIndex] : hit.object.material;
      return material.visible && (!material.transparent || material.opacity >= .99);
    });
    const direction = field.direction.clone(), towardEmitter = direction.clone().negate();
    const centerRay = new THREE.Raycaster(field.origin.clone().addScaledVector(direction, 8), towardEmitter);
    const hubHit = firstVisibleHit(centerRay);
    assert.ok(hubHit && belongsToRotor(hubHit.object), `hub covered by ${hubHit?.object.name}`);

    // Find blade targets around the upper impeller, away from the central hub
    // and the floor. Every target is then checked against the whole scene, not
    // just the rotor. The former generator/fan overlays and solid backplate
    // both fail these rays even though the GLB itself remains valid.
    let visibleBladeSamples = 0;
    for (let i = 0; i < 24; i++) {
      const theta = (i + .37) / 24 * Math.PI * 2;
      const local = new THREE.Vector3(Math.cos(theta) * .52, Math.sin(theta) * .52, 0);
      if (local.y < -.30) continue;
      const target = turbine.localToWorld(local), ray = new THREE.Raycaster(target.clone().addScaledVector(direction, 8), towardEmitter);
      const bladeHit = ray.intersectObject(rotor, true)[0];
      if (!bladeHit) continue;
      const front = firstVisibleHit(ray);
      assert.ok(front && belongsToRotor(front.object), `blade sample ${i} covered by ${front?.object.name}`);
      visibleBladeSamples++;
    }
    assert.ok(visibleBladeSamples >= 5, `expected multiple exposed blades; found ${visibleBladeSamples}`);
  } finally {
    game.physics.dispose(); game.portals.dispose();
  }
});
