import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LabPortals, resolvePortalPlacement, makePortalFrame, PORTAL_HALF_WIDTH, PORTAL_HALF_HEIGHT } from '../src/game/LabPortals.js';

const V = (...args) => new THREE.Vector3(...args);
function panel(width = 12, height = 10, size = { width: 2.2, height: 2.8 }) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, .2), new THREE.MeshBasicMaterial());
  mesh.position.set(0, 5, 0); mesh.updateMatrixWorld(true);
  Object.assign(mesh.userData, { portalable: true, center: V(0, 5, .1), normal: V(0, 0, 1), portalSize: size });
  return mesh;
}

test('opted-in relay dimensions govern the real aperture and all three rendered rings', () => {
  const scene = new THREE.Scene(), portals = new LabPortals({ scene }), surface = panel(); scene.add(surface);
  const result = portals.placeOnPanel(0, surface, V(0, 5, .1));
  assert.equal(result.ok, true); assert.equal(result.frame.width, 2.2); assert.equal(result.frame.height, 2.8);
  for (const mesh of [result.frame.surface, result.frame.rim, result.frame.halo]) assert.deepEqual(mesh.scale.toArray(), [2.2, 2.8, 1]);
  portals.place(1, V(20, 5, 0), V(1, 0, 0), undefined, { width: 2.2, height: 2.8 });
  assert.equal(portals.isInsideAperture(0, V(1.5, 5, .1), .43), true);
  const transit = portals.tryTeleport(V(1.5, 5, -.2), V(1.5, 5, .4), V(0, 0, -40), .43);
  assert.ok(transit, 'the larger visible opening must really accept an off-centre capsule');
  assert.ok(Math.abs(transit.velocity.length() - 40) < 1e-8);
  assert.equal(portals.isInsideAperture(0, V(2, 7.5, .1), .43), false, 'the elliptical rim still rejects a corner miss');
  portals.dispose();
});

test('large rim placement checks fitting, the enlarged first blocker footprint and peer overlap', () => {
  const surface = panel();
  const edge = resolvePortalPlacement(surface, V(5.9, 9.9, .1));
  assert.equal(edge.ok, true); assert.ok(edge.position.x + 2.2 * 1.1 <= 5.980001);
  assert.ok(edge.position.y + 2.8 * 1.1 <= 9.980001);
  assert.equal(resolvePortalPlacement(panel(4, 6), V(0, 5, .1)).reason, 'too-small');
  const pillar = { box: new THREE.Box3(V(1.7, 4.8, .3), V(1.9, 5.2, .8)), enabled: true };
  assert.equal(resolvePortalPlacement(surface, V(0, 5, .1), { blockers: [pillar] }).reason, 'obstructed');
  delete surface.userData.portalSize;
  assert.equal(resolvePortalPlacement(surface, V(0, 5, .1), { blockers: [pillar] }).ok, true, 'ordinary opening does not reach this pillar');
  surface.userData.portalSize = { width: 2.2, height: 2.8 };
  const peer = makePortalFrame(V(3, 5, .1), V(0, 0, 1));
  assert.equal(resolvePortalPlacement(surface, V(0, 5, .1), { otherPortal: peer }).reason, 'overlap');
});

test('attached enlarged portals keep their physical and visual dimensions after anchor motion', () => {
  const portals = new LabPortals({ scene: new THREE.Scene() }), surface = panel();
  const result = portals.placeOnPanel(0, surface, V(0, 5, .1));
  surface.position.x = 8; surface.rotation.y = Math.PI / 2;
  portals.beginPhysicsStep(); portals.syncMovingSurfaces(); portals.endPhysicsStep();
  const frame = result.frame;
  assert.ok(frame.position.distanceTo(V(8.1, 5, 0)) < 1e-8);
  assert.ok(frame.normal.distanceTo(V(1, 0, 0)) < 1e-8);
  assert.equal(frame.width, 2.2); assert.equal(frame.height, 2.8);
  assert.deepEqual(frame.surface.scale.toArray(), [2.2, 2.8, 1]);
  assert.equal(portals.committedPhysicsFrames[0].pose.width, 2.2);
  assert.equal(portals.committedPhysicsFrames[0].pose.height, 2.8);
  portals.dispose();
});

test('invalid explicit sizes preserve existing portals, and ordinary campaign defaults are unchanged', () => {
  const portals = new LabPortals({ scene: new THREE.Scene() }), surface = panel();
  delete surface.userData.portalSize;
  const before = portals.placeOnPanel(0, surface, V(0, 5, .1)).frame;
  assert.equal(before.width, PORTAL_HALF_WIDTH); assert.equal(before.height, PORTAL_HALF_HEIGHT);
  for (const size of [null, {}, { width: NaN, height: 2.8 }, { width: 2.2, height: Infinity },
    { width: 0, height: 2.8 }, { width: -1, height: 2.8 }, { width: '2.2', height: 2.8 }, { width: 8, height: 2.8 }]) {
    surface.userData.portalSize = size;
    assert.equal(portals.placeOnPanel(0, surface, V(0, 5, .1)).reason, 'size');
    assert.equal(portals.portals[0], before);
  }
  portals.dispose();
});
