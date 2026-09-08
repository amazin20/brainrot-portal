import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildRoom12Architecture } from '../src/game/LabRoom12Architecture.js';

test('atrium finishes preserve both flight windows and the low freight opening', () => {
  const world = { root: new THREE.Group(), surfaces: [] };
  const skin = buildRoom12Architecture(world);
  skin.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  const clear = (origin, direction, length) => {
    ray.set(new THREE.Vector3(...origin), new THREE.Vector3(...direction));
    ray.near = 0; ray.far = length;
    assert.deepEqual(ray.intersectObject(skin, true), [], `Visual skin obscured opening at ${origin}`);
  };
  for (const y of [22.1, 24, 25.9]) for (const z of [-13.7, -11.15, -8.6]) clear([11.4, y, z], [1, 0, 0], 1.2);
  for (const y of [22.1, 25, 27.9]) for (const z of [-9.4, -6.35, -3.3]) clear([8.4, y, z], [1, 0, 0], 1.2);
  for (const x of [12.6, 16.5, 20.4]) for (const y of [18.28, 22, 25.92]) clear([x, y, -.6], [0, 0, 1], 1.2);
  for (const x of [21.08, 24, 26.92]) for (const y of [12.08, 12.7, 13.27]) clear([x, y, 13.4], [0, 0, 1], 1.2);
});

test('district paint retains ceramic material and the exact existing tile transforms', () => {
  const geometry = new THREE.BoxGeometry(1, 1, .1), structuralMaterial = new THREE.MeshStandardMaterial();
  const ceramic = new THREE.MeshStandardMaterial({ color: 0xfffbed });
  const structural = new THREE.InstancedMesh(geometry, structuralMaterial, 2);
  const portal = new THREE.InstancedMesh(geometry, ceramic, 2);
  portal.userData.portalTile = true;
  const transform = new THREE.Matrix4().makeTranslation(3, 8, 2);
  for (const mesh of [structural, portal]) {
    mesh.setMatrixAt(0, transform); mesh.setMatrixAt(1, new THREE.Matrix4().makeTranslation(5, 8, 2));
  }
  const structure = new THREE.Group(), target = new THREE.Group(); structure.add(structural); target.add(portal);
  const root = new THREE.Group(); root.add(structure, target);
  const before = Array.from(structural.instanceMatrix.array), portalBefore = Array.from(portal.instanceMatrix.array);
  const skin = buildRoom12Architecture({ root, surfaces: [
    { group: structure, portal: false, normal: new THREE.Vector3(0, 1, 0), name: 'Observation balcony' },
    { group: target, portal: true, normal: new THREE.Vector3(0, 0, 1), name: 'observation' },
  ] });
  assert.deepEqual(Array.from(structural.instanceMatrix.array), before);
  assert.deepEqual(Array.from(portal.instanceMatrix.array), portalBefore);
  assert.equal(portal.material, ceramic); assert.equal(portal.instanceColor, null);
  assert.ok(structural.instanceColor); assert.notEqual(structural.material, structuralMaterial);
  assert.equal(skin.children.filter(o => o.isMesh).length, 3);
  assert.equal(skin.children.filter(o => o.isLight).length, 0);
});
