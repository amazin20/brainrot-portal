import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {finishWindGuard} from '../src/game/LabWindGuardFinish.js';
import {assertWindGuard} from './helpers/lab-wind-guard-contract.js';

test('room11 pressed shroud keeps one closed opaque volume and the exact original envelope', () => {
  const original = new THREE.BoxGeometry(1.95, 2.1, .15), palette = new THREE.MeshStandardMaterial();
  const mesh = new THREE.Mesh(original, palette); let retired = 0;
  original.addEventListener('dispose', () => retired++);
  try {
    assert.equal(finishWindGuard(mesh), mesh); assert.equal(retired, 1);
    assertWindGuard(mesh); assert.notEqual(mesh.material, palette);
    mesh.geometry.setDrawRange(0, 0); assert.throws(() => assertWindGuard(mesh)); mesh.geometry.setDrawRange(0, Infinity);
    mesh.updateMatrixWorld(true);
    for (const x of [-.9, -.7, -.595, -.4, 0, .4, .605, .9]) for (const y of [-1, -.8, 0, .8, 1]) {
      for (const side of [-1, 1]) {
        const hits = new THREE.Raycaster(new THREE.Vector3(x, y, side), new THREE.Vector3(0, 0, -side), 0, 2).intersectObject(mesh);
        assert.ok(hits.length > 0, 'The pressed recess may not create an opening through the physical guard');
        assert.ok(Math.abs(hits[0].point.z) <= Math.fround(.075) + 1e-12);
      }
    }
  } finally {mesh.geometry.dispose(); mesh.material.dispose(); palette.dispose();}
});
