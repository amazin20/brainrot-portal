import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {buildRoom12Architecture} from '../src/game/LabRoom12Architecture.js';

const game = await createHeadlessGame();
after(() => { game.physics.dispose(); game.portals.dispose(); });

test('junction finishes leave the actual cargo and lateral flight apertures clear', async () => {
  await game.selectLevel(11, false);
  const skin = game.firstLevel.world.root.getObjectByName('Folded junction structural finishes');
  assert.ok(skin); skin.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  const clear = (origin, direction, length) => {
    ray.set(new THREE.Vector3(...origin), new THREE.Vector3(...direction));
    ray.near = 0; ray.far = length;
    assert.deepEqual(ray.intersectObject(skin, true), [], `A cosmetic insert obstructs the aperture at ${origin}`);
  };
  const geometry = game.firstLevel.puzzleGeometry;
  for (const x of [7.5, 10, 12.5]) for (const y of [9.15, 9.7, geometry.cargoWindow.maxY - .15]) {
    clear([x, y, geometry.cargoWindow.z - .7], [0, 0, 1], 1.4);
  }
  for (const y of [10.55, 11.1, 11.65]) for (const z of [-8, -4, 0]) {
    clear([6.3, y, z], [1, 0, 0], 1.2);
  }
  for (const y of [18.65, 21, 23.85]) for (const z of [.4, 3, 5.6]) {
    clear([geometry.launchWindow.x - .6, y, z], [1, 0, 0], 1.2);
  }
  const sight = geometry.returnSightWindow;
  for (const x of [sight.x[0] + .1, 5, sight.x[1] - .1]) for (const y of [sight.y[0] + .1, 18.8, sight.y[1] - .1]) {
    clear([x, y, sight.z - .6], [0, 0, 1], 1.2);
  }
});

test('ordinary junction floors meet at edges without duplicate coplanar walking surfaces', async () => {
  await game.selectLevel(11, false);
  const floors = game.firstLevel.world.surfaces.filter(surface => surface.floor && !surface.portal);
  for (let i = 0; i < floors.length; i++) for (let j = i + 1; j < floors.length; j++) {
    const a = floors[i], b = floors[j], first = a.floor, second = b.floor;
    if (Math.abs(first.y - second.y) > 1e-6) continue;
    const overlapX = Math.min(first.maxX, second.maxX) - Math.max(first.minX, second.minX);
    const overlapZ = Math.min(first.maxZ, second.maxZ) - Math.max(first.minZ, second.minZ);
    assert.ok(overlapX <= 1e-6 || overlapZ <= 1e-6,
      `${a.name} and ${b.name} overlap at y=${first.y}: ${overlapX} by ${overlapZ}m causes visible z-fighting`);
  }
});

test('finishes preserve ceramic transforms and all gameplay registries without adding shadow-overlapping stair skins', async () => {
  await game.selectLevel(11, false);
  const world = game.firstLevel.world;
  const ceramic = [];
  for (const surface of world.surfaces.filter(s => s.portal)) surface.group.traverse(mesh => {
    if (mesh.isInstancedMesh && mesh.userData.portalTile) ceramic.push({mesh,
      material: mesh.material, matrices: Array.from(mesh.instanceMatrix.array), colors: mesh.instanceColor});
  });
  const registries = [game.colliders, game.aimBlockers, game.cameraBlockers, game.portalPanels, world.surfaces];
  const before = registries.map(items => [...items]);
  const skin = buildRoom12Architecture(world);
  registries.forEach((items, i) => assert.deepEqual(items, before[i]));
  for (const saved of ceramic) {
    assert.equal(saved.mesh.material, saved.material);
    assert.equal(saved.mesh.instanceColor, saved.colors);
    assert.deepEqual(Array.from(saved.mesh.instanceMatrix.array), saved.matrices);
  }
  assert.ok(skin.children.length > 0);
  skin.traverse(object => {
    assert.equal(Boolean(object.isLight), false);
    if (!object.isMesh) return;
    assert.equal(object.isInstancedMesh, true, 'Stair-side overlay geometry must not reappear');
    assert.equal(object.castShadow, false); assert.equal(object.receiveShadow, false);
    assert.equal(game.aimBlockers.includes(object), false);
    assert.equal(game.cameraBlockers.includes(object), false);
  });
});
