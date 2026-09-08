import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BALANCE_RIG_LAYOUT, buildBalanceRig } from '../src/game/LabBalanceRig.js';

const V = (...v) => new THREE.Vector3(...v);
function dispose(item) {
  const geometries = new Set();
  item.root.traverse(mesh => { if (mesh.isMesh) geometries.add(mesh.geometry); });
  for (const geometry of geometries) geometry.dispose();
  for (const material of Object.values(item.materials)) material.dispose();
}

test('the new rocker has two broad trays and a narrow real spine with no phantom central floor', () => {
  const item = buildBalanceRig(new THREE.Group());
  const ray = new THREE.Raycaster(V(1.25, 5, .30), V(0, -1, 0));
  assert.equal(ray.intersectObject(item.moving, true).length, 0, 'The open side of the axle was filled by a broad substitute floor');
  for (const angle of [-.38, -.19, 0, .19, .38]) {
    item.setAngle(angle);
    for (const spec of item.deckSurfaces) {
      for (const dx of [-.35, 0, .35]) for (const dz of [-.35, 0, .35]) {
        const expected = spec.center.clone().add(V(dx * spec.size.x, spec.size.y / 2, dz * spec.size.z));
        const origin = expected.clone().add(V(0, 2, 0)).applyMatrix4(item.moving.matrixWorld);
        const direction = V(0, -1, 0).transformDirection(item.moving.matrixWorld);
        ray.set(origin, direction);
        const hit = ray.intersectObject(spec.mesh, false)[0];
        assert.ok(hit, 'A declared walkable surface has no visible geometry');
        assert.ok(hit.point.distanceTo(expected.applyMatrix4(item.moving.matrixWorld)) < 1e-6, 'Physics top differs from rendered deck');
      }
    }
  }
  dispose(item);
});

test('bearing feet remain grounded while the whole rocker clears the floor throughout its travel', () => {
  const item = buildBalanceRig(new THREE.Group(), { position: [3, 2.1, -4] });
  const fixedBefore = item.fixedSupportBoxes.map(box => box.clone());
  const feet = item.fixed.children.filter(mesh => mesh.name === 'Grounded bearing foot');
  for (const foot of feet) assert.ok(Math.abs(new THREE.Box3().setFromObject(foot).min.y) < 1e-6);
  for (let i = 0; i <= 24; i++) {
    item.setAngle(-.38 + i / 24 * .76);
    for (const z of [-2.8, -2, -1.2]) {
      item.setCounterweight(z);
      const moving = new THREE.Box3().setFromObject(item.moving);
      assert.ok(moving.min.y > .045, `Rocker pierces the floor: angle=${item.angle}, clearance=${moving.min.y}`);
      assert.ok(item.fixedSupportBoxes.every((box, index) => box.equals(fixedBefore[index])));
      for (const foot of feet) assert.ok(Math.abs(new THREE.Box3().setFromObject(foot).min.y) < 1e-6);
    }
  }
  // The bearing supports cannot form a wall across either end platform.
  for (const mesh of item.fixed.children.filter(mesh => mesh.name.includes('A-frame') || mesh.name.includes('bearing'))) {
    if (!mesh.isMesh) continue;
    const box = new THREE.Box3().setFromObject(mesh);
    assert.ok(box.max.x < 3 - 1.8 || box.min.x > 3 + 1.8, `${mesh.name} enters the walking width`);
  }
  dispose(item);
});

test('animation preserves rigid deck geometry, keeps bearing housings still and twists the anchored springs', () => {
  const item = buildBalanceRig(new THREE.Group());
  const geometries = item.deckSurfaces.map(spec => Array.from(spec.mesh.geometry.attributes.position.array));
  const housings = item.fixed.children.filter(mesh => mesh.name === 'Stationary bearing housing');
  const before = housings.map(mesh => mesh.matrixWorld.clone());
  const coils = item.fixed.children.filter(mesh => mesh.name === 'Working torsion spring');
  const coilPositions = coils.map(mesh => Array.from(mesh.geometry.attributes.position.array));
  const coilGeometries = coils.map(mesh => mesh.geometry);
  item.setAngle(.38); item.root.updateWorldMatrix(true, true);
  for (const [index, spec] of item.deckSurfaces.entries()) assert.deepEqual(Array.from(spec.mesh.geometry.attributes.position.array), geometries[index]);
  for (const [index, mesh] of housings.entries()) assert.ok(mesh.matrixWorld.equals(before[index]), 'A fixed bearing rotates with the deck');
  for (const [index, coil] of coils.entries()) {
    assert.equal(coil.geometry, coilGeometries[index], 'Animation allocates a new geometry each frame');
    assert.deepEqual(Array.from(coil.geometry.attributes.position.array.slice(0, 21)), coilPositions[index].slice(0, 21), 'Anchored coil end moved');
    assert.notDeepEqual(Array.from(coil.geometry.attributes.position.array.slice(-21)), coilPositions[index].slice(-21), 'Moving coil end does not follow the axle');
  }
  item.setAngle(-10); assert.equal(item.angle, -BALANCE_RIG_LAYOUT.maxAngle);
  item.setAngle(10); assert.equal(item.angle, BALANCE_RIG_LAYOUT.maxAngle);
  item.setCounterweight(-10); assert.equal(item.counterweight.position.z, -2.8);
  item.setCounterweight(10); assert.equal(item.counterweight.position.z, -1.2);
  const weight = item.movingCollisionParts.find(spec => spec.dynamicCenter);
  assert.ok(weight.center.equals(item.counterweight.position), 'Sliding mass geometry and collider centre diverge');
  dispose(item);
});
