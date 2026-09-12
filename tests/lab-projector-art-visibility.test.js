import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createHeadlessGame } from '../scripts/lab-headless.mjs';

// The original emitter bar covered the central lens; an unrelated extension
// bridge covered it from above. Test actual scene geometry from both approaches.
test('room 14 projector lens is exposed from frontal and raised approaches without changing its blockers', async () => {
  const game = await createHeadlessGame();
  try {
    await game.selectLevel(13, false);
    const world = game.firstLevel.world.root;
    world.updateWorldMatrix(true, true);
    const projector = world.getObjectByName('Browser 3D hard-light projector');
    assert.ok(projector);

    let cover, strip;
    world.traverse(node => {
      const p = node.geometry?.parameters;
      if (!node.isMesh || !p || node.position.x !== -10 || node.position.y !== 5.1) return;
      if (p.width === 2.4 && p.height === .45 && p.depth === .5 && node.position.z === -6.75) cover = node;
      if (p.width === 2.2 && p.height === .12 && p.depth === .08 && node.position.z === -6.97) strip = node;
    });
    assert.ok(cover && strip, 'retain the original source geometry in the scene');
    for (const mesh of [cover, strip]) {
      assert.equal(mesh.visible, true, 'render substitution must not change mesh visibility used by game ray tests');
      assert.equal(mesh.material.visible, false);
      assert.ok(game.cameraBlockers.includes(mesh));
      assert.ok(game.aimBlockers.includes(mesh));
    }
    const collider = game.colliders.find(c => c.mesh === cover);
    assert.ok(collider && collider.enabled !== false);
    assert.ok(collider.box.getSize(new THREE.Vector3()).distanceTo(new THREE.Vector3(2.4, .45, .5)) < 1e-5);
    assert.ok(collider.box.getCenter(new THREE.Vector3()).distanceTo(new THREE.Vector3(-10, 5.1, -6.75)) < 1e-5);

    const opaqueMeshes = [];
    world.traverseVisible(node => {
      if (!node.isMesh) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      if (materials.some(m => m.visible && (!m.transparent || m.opacity >= .99))) opaqueMeshes.push(node);
    });
    const belongsToProjector = node => {
      for (let p = node; p; p = p.parent) if (p === projector) return true;
      return false;
    };
    const cameras = [[-10, 5.1, -8], [-9.5, 5.1, -8], [-10.5, 5.1, -8], [-10, 5.6, -8]];
    const targets = [[-10, 5.1, -6.87], [-9.85, 5.1, -6.87], [-10.15, 5.1, -6.87]];
    for (const camera of cameras) for (const target of targets) {
      const origin = new THREE.Vector3(...camera);
      const ray = new THREE.Raycaster(origin, new THREE.Vector3(...target).sub(origin).normalize());
      const hit = ray.intersectObjects(opaqueMeshes, false).find(h => {
        const material = Array.isArray(h.object.material) ? h.object.material[h.face.materialIndex] : h.object.material;
        return material.visible && (!material.transparent || material.opacity >= .99);
      });
      assert.ok(hit && belongsToProjector(hit.object), `lens covered from ${camera} by ${hit?.object.name}`);
      assert.equal(hit.object.material.name, 'Recessed signal glass', 'the actual central lens must be visible before any opaque cover');
    }
  } finally {
    game.physics.dispose(); game.portals.dispose();
  }
});
