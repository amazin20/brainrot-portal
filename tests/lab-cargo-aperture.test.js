import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Quaternion as CannonQuaternion, Vec3} from 'cannon-es';
import {makePortalFrame, orientedBoxFitsPortal, portalCrossing, portalRotation,
  transformPortalPoint} from '../src/game/LabPortals.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const diagonalUp = new THREE.Quaternion().setFromUnitVectors(V(1, 1, 1).normalize(), V(0, 1, 0));
function frames() {
  const entry = makePortalFrame(V(), V(0, 1, 0), V(0, 0, -1), {width: 2.8, height: 2.1});
  const exit = makePortalFrame(V(20, 1.2, 0), V(1, 0, 0), undefined, {width: .95, height: .65});
  return {entry, exit, rotation: portalRotation(entry, exit)};
}

test('original tilted cube cannot fit a cargo aperture that admits its centre and upright shape', () => {
  const {entry, exit, rotation} = frames();
  assert.equal(orientedBoxFitsPortal(exit, exit.position, new THREE.Quaternion()), true);
  assert.equal(orientedBoxFitsPortal(exit, new Vec3(...exit.position.toArray()), new CannonQuaternion()), true,
    'the source backing receives the actual Cannon body pose');
  assert.equal(orientedBoxFitsPortal(exit, exit.position, diagonalUp), false);
  const sourceQuaternion = diagonalUp.clone().premultiply(rotation.clone().invert());
  assert.equal(orientedBoxFitsPortal(entry, entry.position, sourceQuaternion), true);
  const corner = V(.39, .39, .39).applyQuaternion(diagonalUp);
  assert.ok(Math.abs(corner.y - .39 * Math.sqrt(3)) < 1e-12);
  assert.ok(Math.abs((corner.y / exit.height) ** 2 - 1.08) < 1e-12);
});

test('swept cargo admission rejects the rotated destination while preserving upright transfer', () => {
  const {entry, exit, rotation} = frames();
  const from = V(0, .01, 0), to = V(0, -.01, 0), velocity = V(0, -8, 0);
  const tilted = diagonalUp.clone().premultiply(rotation.clone().invert());
  assert.ok(portalCrossing(entry, exit, to, from, velocity, .39), 'the old centre-radius check alone admits the problematic footprint');
  assert.equal(portalCrossing(entry, exit, to, from, velocity, .39, {boxQuaternion: tilted}), null);
  const upright = new THREE.Quaternion().premultiply(rotation.clone().invert());
  const result = portalCrossing(entry, exit, to, from, velocity, .39, {boxQuaternion: upright});
  assert.ok(result);
  const cannonQuaternion = new CannonQuaternion(...upright.toArray());
  assert.ok(portalCrossing(entry, exit, to, from, velocity, .39, {boxQuaternion: cannonQuaternion}),
    'shape options also accept the actual Cannon body quaternion');
  assert.equal(orientedBoxFitsPortal(exit, transformPortalPoint(result.crossingPoint, result.entryFrame, exit),
    upright.clone().premultiply(result.rotation)), true);
});

test('source cargo aperture also rejects protruding box corners', () => {
  const {entry, exit} = frames();
  const from = exit.position.clone().addScaledVector(exit.normal, .01);
  const to = exit.position.clone().addScaledVector(exit.normal, -.01);
  assert.equal(portalCrossing(exit, entry, to, from, V(-8, 0, 0), .39, {boxQuaternion: diagonalUp}), null);
});

test('box admission uses the body orientation at the crossing time', () => {
  const {entry, exit, rotation} = frames();
  const inverse = rotation.clone().invert();
  const previous = diagonalUp.clone().premultiply(inverse), current = inverse.clone();
  const options = {boxQuaternion: current, previousBoxQuaternion: previous};
  assert.equal(portalCrossing(entry, exit, V(0, -.099, 0), V(0, .001, 0), V(0, -8, 0), .39, options), null,
    'an early crossing still has the unfit diagonal orientation');
  assert.ok(portalCrossing(entry, exit, V(0, -.001, 0), V(0, .099, 0), V(0, -8, 0), .39, options),
    'a late crossing admits the genuinely fitting orientation');
});
