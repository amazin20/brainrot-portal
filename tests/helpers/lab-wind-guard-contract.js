import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';

export function assertWindGuard(mesh) {
  assert.equal(mesh.userData.windGuardFinish, 'closed-pressed-steel-v1');
  assert.equal(mesh.children.length, 0, 'The shroud is its original single physical/query mesh');
  const geometry = mesh.geometry, material = mesh.material;
  assert.equal(geometry.name, 'Wind clutch / closed pressed guard volume');
  assert.equal(material.name, 'Wind clutch / pressed steel guard');
  assert.equal(material.isMeshStandardMaterial, true);
  assert.equal(material.vertexColors, true); assert.equal(material.color.getHex(), 0xffffff);
  assert.equal(material.roughness, .54); assert.equal(material.metalness, .62);
  assert.equal(material.opacity, 1); assert.equal(material.transparent, false);
  assert.equal(material.depthWrite, true); assert.equal(material.depthTest, true); assert.equal(material.side, THREE.FrontSide);
  assert.equal(material.alphaTest, 0); assert.equal(material.clippingPlanes, null);
  assert.equal(material.map, null); assert.equal(material.alphaMap, null);
  assert.deepEqual(geometry.drawRange, {start: 0, count: Infinity}); assert.equal(geometry.groups.length, 0);
  geometry.computeBoundingBox();
  const half = [1.95, 2.1, .15].map(n => Math.fround(n / 2));
  assert.deepEqual(geometry.boundingBox.min.toArray(), half.map(n => -n));
  assert.deepEqual(geometry.boundingBox.max.toArray(), half);
  const positions = geometry.attributes.position, index = geometry.index;
  assert.equal(positions.count, 432); assert.equal(geometry.attributes.color.count, positions.count);
  assert.equal(index.count, 2580);
  const signature = createHash('sha256');
  for (const data of [positions.array, geometry.attributes.color.array, index.array])
    signature.update(Buffer.from(data.buffer, data.byteOffset, data.byteLength));
  assert.equal(signature.digest('hex'), 'f0bbc61b0fe3a921692c4333521f282c6123873c0729da7f334d8f9975ad21b6', 'Only the approved integral guard shape and vertex finish may replace the old box');
  const edges = new Map(), a = new THREE.Vector3(), b = a.clone(), c = a.clone();
  let volume = 0;
  for (let i = 0; i < index.count; i += 3) {
    const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    a.fromBufferAttribute(positions, ids[0]); b.fromBufferAttribute(positions, ids[1]); c.fromBufferAttribute(positions, ids[2]);
    assert.ok(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() > 1e-12, 'A guard face is degenerate');
    volume += a.dot(b.clone().cross(c)) / 6;
    for (let n = 0; n < 3; n++) {
      const from = ids[n], to = ids[(n + 1) % 3], key = [Math.min(from, to), Math.max(from, to)].join(':');
      const edge = edges.get(key) || {count: 0, orientation: 0};
      edge.count++; edge.orientation += from < to ? 1 : -1; edges.set(key, edge);
    }
  }
  assert.ok([...edges.values()].every(edge => edge.count === 2 && edge.orientation === 0), 'The actual guard surface must be closed and consistently wound');
  assert.equal(positions.count - edges.size + index.count / 3, 2);
  assert.ok(volume > .4 && volume < 1.95 * 2.1 * .15, 'The recess must keep one solid outward volume');
}
