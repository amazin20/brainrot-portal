import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';

const game = await createHeadlessGame();
game.chamberEdition = 'foundation';
await game.selectLevel(40, true);
after(() => {game.firstLevel.dispose(); game.physics.dispose(); game.portals.dispose();});

// Inspect the actual merged production triangles, not blocker bounds or a
// duplicated clipping implementation. The affected skin intentionally has no
// collider, so camera-collision idempotence could not detect its opaque face.
game.scene.updateMatrixWorld(true);
const architecture = [], relief = [];
game.firstLevel.structure.traverse(mesh => {
  if (mesh.name === 'Machined architectural construction / joined by finish') architecture.push(mesh);
  if (mesh.name.startsWith('Castle attached wall relief / ')) relief.push(mesh);
});
const raycaster = new THREE.Raycaster();
function ray(origin, direction, far = 1) {
  raycaster.set(origin, direction); raycaster.near = 0; raycaster.far = far;
  return raycaster.intersectObjects(architecture, false);
}
function entrance(room, landing = 0) {
  const side = room.def.entry === 'w' ? -1 : 1;
  return {
    side, outward: new THREE.Vector3(side, 0, 0),
    center: new THREE.Vector3(room.door[0], room.def.at[1] + landing + 2.5, room.door[2]),
    opening: new THREE.Box3(
      new THREE.Vector3(room.door[0] - .30, room.def.at[1] + landing, room.door[2] - 3.4),
      new THREE.Vector3(room.door[0] + .30, room.def.at[1] + landing + 5, room.door[2] + 3.4),
    ),
  };
}

test('the ordinary magnet-entry camera ray no longer meets opaque relief 32 cm from its lens', () => {
  const origin = new THREE.Vector3(23.826632849212285, 20.227030245187535, 36.39997588338088);
  const direction = new THREE.Vector3(.988304746753773, -.13927376858765456, -.06210108636209921);
  assert.ok(architecture.length > 10 && relief.length > 30, 'The real production architectural batches must be inspected');
  const hits = ray(origin, direction, 1);
  assert.equal(hits.length, 0,
    `Magnet entry still presents opaque architectural art immediately in front of the ordinary lens: ${hits[0]?.distance}`);
  // The physical shell contract is unchanged: its two entrance piers still
  // frame the same 6.8 m doorway; the finish cannot fill their gap.
  const room = game.firstLevel.rooms.get('magnet');
  assert.deepEqual(room.door, [24, 18, 35]);
  assert.ok(game.colliders.some(c => c.enabled && c.box.min.x === 23.75 && c.box.max.x === 24.25
    && c.box.max.z === 31.6), 'The original lower entrance pier disappeared');
});

test('real lower and upper shell openings remain clear of all attached opaque wall skins', () => {
  let openings = 0, upper = 0, samples = 0;
  for (const room of game.firstLevel.rooms.values()) {
    assert.ok(['w', 'e'].includes(room.def.entry));
    for (const landing of [0, ...(room.def.upperDoor ? [room.def.upperDoor] : [])]) {
      openings++; if (landing) upper++;
      const entry = entrance(room, landing);
      for (const mesh of relief.filter(mesh => mesh.name.endsWith(`/ ${room.def.id}`))) {
        // At the opposite side of a room, its original finish is retained.
        if (Math.abs(mesh.position.x - room.door[0]) > .3) continue;
        const overlap = new THREE.Box3().setFromObject(mesh).intersect(entry.opening);
        assert.ok(overlap.isEmpty() || overlap.getSize(new THREE.Vector3()).lengthSq() < 1e-12,
          `${room.def.id} ${landing ? 'upper' : 'lower'} doorway overlaps an opaque source relief`);
      }
      for (const z of [-3.1, -1.6, 0, 1.6, 3.1]) for (const y of [.3, 1.3, 2.5, 3.7, 4.7]) {
        const target = new THREE.Vector3(room.door[0], room.def.at[1] + landing + y, room.door[2] + z);
        const from = target.clone().addScaledVector(entry.outward, .8);
        const hits = ray(from, entry.outward.clone().negate(), 1);
        assert.equal(hits.length, 0,
          `${room.def.id} ${landing ? 'upper' : 'lower'} shell opening is visually closed at ${target.toArray()}`);
        samples++;
      }
    }
  }
  assert.equal(openings, 12); assert.equal(upper, 1); assert.equal(samples, 300);
});

test('magnet wall relief outside the actual entry stays visible and the opposite wall stays finished', () => {
  for (const z of [22.4, 47.6]) {
    const hits = ray(new THREE.Vector3(23.2, 21.85, z), new THREE.Vector3(1, 0, 0), 1.5);
    assert.ok(hits.some(h => h.object.material.name === 'Castle wing enamel / magnet'),
      `Doorway clipping removed supported wall relief at z=${z}`);
    const hit = hits.find(h => h.object.material.name === 'Castle wing enamel / magnet');
    assert.ok(Math.abs(hit.point.x - 24.14) < 1e-5, 'Supported relief depth or orientation changed');
  }
  const opposite = ray(new THREE.Vector3(68.8, 21.45, 35), new THREE.Vector3(-1, 0, 0), 1.5);
  assert.ok(opposite.some(h => h.object.material.name === 'Castle wing enamel / magnet'),
    'The room-wide clipping cut the opposite wall that has no doorway');
  for (const mesh of relief) {
    assert.equal(mesh.userData.collider, undefined, 'Architectural finish created a physical solid');
    assert.equal(game.cameraBlockers.includes(mesh), false, 'Doorway clipping changed camera collision registration');
  }
});

test('existing portal-address reveals retain their real opaque-art clearance', () => {
  let samples = 0;
  for (const panel of game.portalPanels) {
    const f = panel.userData.portalFrame?.() ?? {
      center: panel.userData.center, normal: panel.userData.normal,
      right: new THREE.Vector3(1, 0, 0).applyQuaternion(panel.quaternion),
      up: new THREE.Vector3(0, 1, 0).applyQuaternion(panel.quaternion),
      halfWidth: panel.userData.portalBounds?.halfWidth ?? panel.scale.x / 2,
      halfHeight: panel.userData.portalBounds?.halfHeight ?? panel.scale.y / 2,
    };
    if (!f.center || !f.normal) continue;
    for (const x of [-.6, 0, .6]) for (const y of [-.6, 0, .6]) {
      const target = f.center.clone().addScaledVector(f.right, f.halfWidth * x).addScaledVector(f.up, f.halfHeight * y);
      const origin = target.clone().addScaledVector(f.normal, .30);
      const hits = ray(origin, f.normal.clone().negate(), .29);
      assert.equal(hits.length, 0, `Architectural skin covers the front of ${panel.name} at ${x},${y}`);
      samples++;
    }
  }
  assert.ok(samples >= 100, 'Inspect actual production portal-address rectangles');
});
