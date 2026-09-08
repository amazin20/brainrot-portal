import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createHeadlessGame } from '../scripts/lab-headless.mjs';
import { buildExtensionBridgeModel, buildSpringRamModel } from '../src/game/LabWorkshopModels.js';

const game = await createHeadlessGame(), V = (...v) => new THREE.Vector3(...v);
function areas(root) {
  const result = []; root.updateWorldMatrix(true, true);
  root.traverse(mesh => {
    if (!mesh.isMesh) return;
    const p = mesh.geometry.attributes.position, index = mesh.geometry.index;
    for (let i = 0; i < (index?.count ?? p.count); i += 3) {
      const points = [0, 1, 2].map(k => V().fromBufferAttribute(p, index ? index.getX(i + k) : i + k).applyMatrix4(mesh.matrixWorld));
      result.push(points[1].sub(points[0]).cross(points[2].sub(points[0])).length() / 2);
    }
  });
  return result.sort((a, b) => a - b);
}

test('workshop repairs preserve every supplied triangle, vertex color and material at one uniform scale', () => {
  for (const [id, build, size] of [[32, buildSpringRamModel, 4.5], [37, buildExtensionBridgeModel, 12]]) {
    const parent = new THREE.Group(), before = areas(game.model(id, 1));
    const item = build(game, parent, { size });
    const after = [...areas(item.fixed), ...areas(item.moving)].sort((a, b) => a - b);
    assert.equal(item.sourceTriangles, 4198); assert.equal(item.fixedTriangles + item.movingTriangles, 4198);
    assert.equal(after.length, before.length);
    for (let i = 0; i < before.length; i++) assert.ok(Math.abs(after[i] / size ** 2 - before[i]) < 2e-8);
    for (const root of [item.fixed, item.moving]) root.traverse(mesh => {
      if (!mesh.isMesh) return;
      assert.ok(mesh.geometry.attributes.color); assert.deepEqual(mesh.scale.toArray(), [1, 1, 1]);
    });
    assert.deepEqual(areas(game.model(id, 1)), before, 'Cached source was changed');
  }
});

test('the bridge moves its entire original span while its broad cassette stays bolted down', () => {
  const parent = new THREE.Group();
  const item = buildExtensionBridgeModel(game, parent, { position: [-2, .4, 3], yaw: Math.PI / 2 });
  const fixed = new THREE.Box3().setFromObject(item.fixed).clone(), samples = [];
  assert.ok(Math.abs(fixed.min.y - .4) < .001);
  for (const progress of [0, .25, .5, .75, 1]) {
    item.setProgress(progress);
    assert.ok(new THREE.Box3().setFromObject(item.fixed).equals(fixed));
    assert.ok(Math.abs(item.moving.position.z + 3.6 * (1 - progress)) < 1e-10);
    const box = item.deck.bounds(); samples.push(box.max.x);
    assert.ok(Math.abs(box.max.z - box.min.z - 2.88) < 1e-8);
    assert.ok(Math.abs(box.max.x - box.min.x - 7.32) < 1e-8);
    assert.ok(Number.isFinite(box.max.y) && box.max.y > .4);
  }
  assert.ok(Math.abs(samples.at(-1) - samples[0] - 3.6) < 1e-8);
  item.setProgress(-2); assert.equal(item.progress, 0);
  item.setProgress(2); assert.equal(item.progress, 1);
  assert.throws(() => buildExtensionBridgeModel(game, parent, { stroke: 10 }), RangeError);
});

test('bridge physics slices track the actual source deck profile through the full travel and yaw', () => {
  for (const yaw of [0, Math.PI / 2, -.4]) {
    const item = buildExtensionBridgeModel(game, new THREE.Group(), { position: [2, .8, -3], yaw });
    for (const t of [0, .5, 1]) {
      item.setProgress(t);
      for (const slab of item.deck.slabs) {
        const q = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), slab.rotationX);
        for (const x of [-.8, 0, .8]) {
          const p = V(x, slab.size.y / 2, 0).applyQuaternion(q).add(slab.center).applyMatrix4(item.moving.matrixWorld);
          const top = item.deck.heightAt(p.x, p.z);
          assert.ok(Number.isFinite(top));
          assert.ok(Math.abs(top - p.y) < .03, `Collider drifts off original deck by ${top - p.y}`);
        }
      }
    }
    assert.equal(item.art.children.length, 2, 'A substitute visible slab was added over the source');
  }
});

test('the falling plate drives a closed rigid linkage and axial ram, with both source bearings stationary', () => {
  const item = buildSpringRamModel(game, new THREE.Group());
  const fixed = new THREE.Box3().setFromObject(item.fixed).clone(), lengths = item.linkLengths.slice();
  let previous = 0;
  for (let i = 0; i <= 72; i++) {
    item.setCompression(i / 100);
    assert.ok(new THREE.Box3().setFromObject(item.fixed).equals(fixed));
    assert.equal(item.moving.position.x, 0); assert.equal(item.moving.position.y, 0);
    assert.ok(item.ramTravel <= previous + 1e-8); previous = item.ramTravel;
    for (const [j, length] of item.linkLengths.entries()) assert.ok(Math.abs(length - lengths[j]) < 1e-7, 'A supposedly rigid connecting rod changes length');
  }
  assert.ok(item.ramTravel < -.30 && item.ramTravel > -.36);
  item.setCompression(-2); assert.equal(item.compression, 0);
  item.setCompression(4); assert.equal(item.compression, .72);
  item.setCompression(0); assert.ok(Math.abs(item.ramTravel) < 1e-8);
  assert.ok(Math.abs(fixed.min.y) < 1e-6, 'Supplied bed is floating');
});

test('mechanism presentation does not register phantom floors or mutate shared actor or camera state', () => {
  const colliders = game.colliders.length, floors = game.floors.length;
  const player = game.playerPosition.clone(), camera = game.camera.position.clone();
  const a = buildExtensionBridgeModel(game, new THREE.Group()), b = buildSpringRamModel(game, new THREE.Group());
  for (let i = 0; i < 30; i++) { a.setProgress(i / 29); b.setCompression(i / 29 * .72); }
  assert.equal(game.colliders.length, colliders); assert.equal(game.floors.length, floors);
  assert.ok(game.playerPosition.equals(player)); assert.ok(game.camera.position.equals(camera));
  game.physics.dispose(); game.portals.dispose();
});
