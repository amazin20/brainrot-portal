import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import * as THREE from 'three';
import { LabCamera } from '../src/game/LabCamera.js';
import { LabCameraBroadPhase } from '../src/game/LabCameraBroadPhase.js';
import { createHeadlessGame } from '../scripts/lab-headless.mjs';
import { runV8Journey } from '../src/game/LabV8Journey.js';

const V = THREE.Vector3;
const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
function box(x = 0, y = 0, z = 0, size = [1, 1, 1]) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  m.position.set(x, y, z); m.updateMatrixWorld(true); return m;
}
function checkCast(rig, origin, desired) {
  rig.broadPhase.end(); const brute = desired.clone(), hit = rig.constrain(origin, brute);
  rig.broadPhase.begin(rig.blockers); const candidate = desired.clone(), selected = rig.constrain(origin, candidate);
  rig.broadPhase.end(); assert.equal(selected, hit); assert.deepEqual(candidate.toArray(), brute.toArray());
}

test('conservative nine-ray volume agrees with the unfiltered query on 1200 seeded casts', () => {
  let seed = 0x34da6f13;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  const blockers = [];
  for (let i = 0; i < 70; i++) {
    const m = box(random() * 40 - 20, random() * 20 - 4, random() * 40 - 20,
      [.05 + random() * 14, .05 + random() * 14, .05 + random() * 14]);
    m.rotation.set(random() * 3, random() * 3, random() * 3);
    m.scale.set(.2 + random() * 2, .2 + random() * 2, .2 + random() * 2); m.updateMatrixWorld(true); blockers.push(m);
  }
  const camera = new THREE.PerspectiveCamera(62, 16 / 9, .1, 150);
  const rig = new LabCamera({ camera, blockers, isBlocker: m => blockers.indexOf(m) % 7 !== 0 });
  for (let i = 0; i < 1200; i++) {
    camera.aspect = [.55, 1, 16 / 9, 3.2][i % 4]; camera.near = [.06, .1, .3][i % 3];
    const origin = new V(random() * 30 - 15, random() * 16, random() * 30 - 15);
    const endpoint = origin.clone().add(new V(random() * 20 - 10, random() * 20 - 10, random() * 20 - 10));
    checkCast(rig, origin, endpoint);
  }
  blockers.forEach(m => m.geometry.dispose());
});

test('invisible proxies, ray starts inside a volume, tangents and far-extension stay solid', () => {
  const near = box(.6, 1, 3, [.22, 8, .2]), big = box(0, 0, 0, [30, 30, 30]);
  near.visible = false; near.userData.collisionProxy = true;
  const rig = new LabCamera({ camera: new THREE.PerspectiveCamera(62, 3.2, .3, 150), blockers: [near, big] });
  for (const origin of [new V(), new V(.24, 0, 0), new V(0, 0, 2.9)])
    for (const endpoint of [new V(1.4, 2.6, 6.3), new V(0, 4, 0), new V(0, 0, 3.05), new V(20, 0, 0)]) checkCast(rig, origin, endpoint);
  near.geometry.dispose(); big.geometry.dispose();
});

test('parent transforms, geometry edits, swaps and blocker-list replacement refresh on the next update', () => {
  const parent = new THREE.Group(), wall = box(0, 1, 3, [5, 5, .2]); parent.add(wall);
  const rig = new LabCamera({ camera: new THREE.PerspectiveCamera(62, 16 / 9, .1, 150), blockers: [wall] });
  const origin = new V(0, 1, 0), endpoint = new V(0, 1, 8);
  for (const x of [0, 100, -3, 0]) { parent.position.x = x; parent.rotation.y += .3; parent.updateMatrixWorld(true); checkCast(rig, origin, endpoint); }
  wall.geometry.translate(10, 0, 0); parent.updateMatrixWorld(true); checkCast(rig, origin, endpoint);
  wall.geometry.translate(-10, 0, 0); checkCast(rig, origin, endpoint);
  const old = wall.geometry; wall.geometry = new THREE.BoxGeometry(3, 3, .2); checkCast(rig, origin, endpoint); old.dispose();
  rig.blockers.splice(0, 1, box(0, 1, 2, [5, 5, .2])); checkCast(rig, origin, endpoint);
  rig.blockers.length = 0; checkCast(rig, origin, endpoint);
  wall.geometry.dispose();
});

test('custom, hierarchical, instanced and deformed shapes always retain original raycast semantics', () => {
  const custom = box(900, 900, 900); custom.raycast = (_ray, out) => out.push({ distance: 2, point: new V(0, 0, 2), object: custom });
  const group = new THREE.Group(); const child = box(0, 0, 4); group.add(child); group.updateMatrixWorld(true);
  const instance = new THREE.InstancedMesh(new THREE.BoxGeometry(), material, 1);
  const morph = box(100, 100, 100); morph.geometry.morphAttributes.position = [morph.geometry.attributes.position.clone()];
  const b = new LabCameraBroadPhase();
  const all = [custom, group, instance, morph]; b.begin(all);
  assert.deepEqual(b.select(all, new V(), new V(0, 0, 1), 3, .24), all);
  b.end(); assert.equal(b.select(all, new V(), new V(0, 0, 1), 3, .24), all);
  const rig = new LabCamera({ camera: new THREE.PerspectiveCamera(), blockers: [custom, group] });
  checkCast(rig, new V(), new V(0, 0, 8));
  [custom, child, instance, morph].forEach(m => m.geometry.dispose());
});

test('duplicate roots and layer masks retain intersection order and filtering', () => {
  const a = box(0, 0, 3), b = box(0, 0, 3); b.layers.set(2);
  const rig = new LabCamera({ camera: new THREE.PerspectiveCamera(), blockers: [b, a, a] });
  rig.raycaster.layers.enable(2); checkCast(rig, new V(), new V(0, 0, 7));
  rig.raycaster.layers.disable(2); checkCast(rig, new V(), new V(0, 0, 7));
  a.geometry.dispose(); b.geometry.dispose();
});

test('selection does not mutate geometry bounds or retain old rooms when cleared', () => {
  const far = box(100, 100, 100), near = box(0, 0, 2), b = new LabCameraBroadPhase();
  assert.equal(far.geometry.boundingBox, null); b.begin([far, near]);
  assert.equal(far.geometry.boundingBox, null);
  assert.deepEqual(b.select([far, near], new V(), new V(0, 0, 1), 4, .24), [near]);
  b.end(); assert.equal(b.active, false); assert.equal(b.candidates.length, 0);
  b.clear(); assert.equal(b.entries.length, 0); b.begin([]); assert.equal(b.entries.length, 0);
  near.geometry.dispose(); far.geometry.dispose();
});

test('interleaved position updates cannot retain stale bounds', () => {
  const data = new THREE.InterleavedBuffer(new Float32Array([-1,-1,2, 1,-1,2, 0,1,2]), 3);
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.InterleavedBufferAttribute(data,3,0));
  const mesh = new THREE.Mesh(geometry, material), b = new LabCameraBroadPhase(); mesh.updateMatrixWorld(true);
  b.begin([mesh]); assert.equal(b.select([mesh],new V(),new V(0,0,1),4,.24).length,1);
  for (let i=0;i<data.array.length;i+=3) data.array[i]+=100; data.needsUpdate=true;
  b.begin([mesh]); assert.equal(b.select([mesh],new V(),new V(0,0,1),4,.24).length,0); geometry.dispose();
});

test('an exceptional filter leaves no active cached broad phase', () => {
  const wall = box(0, 2, 3, [12, 8, .2]);
  const rig = new LabCamera({ camera: new THREE.PerspectiveCamera(), blockers: [wall], isBlocker: () => { throw Error('test filter'); } });
  assert.throws(() => rig.reset(new V()), /test filter/);
  assert.equal(rig.broadPhase.active, false); assert.equal(rig.rayHits.length, 0); wall.geometry.dispose();
});

for (const recovery of [false, true]) test(`full room21 route has identical camera/actor trace with culling enabled or disabled; recovery=${recovery}`, async () => {
  const results = [];
  for (const accelerated of [false, true]) {
    const game = await createHeadlessGame(); await game.selectLevel(20, false);
    if (!accelerated) game.cameraRig.broadPhase.begin = () => {}; // Same nine original full raycasts.
    const original = game.updateVisuals, hash = crypto.createHash('sha256');
    game.updateVisuals = function (...args) {
      const result = original.apply(this, args), r = this.cameraRig;
      hash.update(JSON.stringify([...this.camera.position, ...this.camera.quaternion, this.camera.fov,
        ...r.focus, ...r.avoidance, ...r.portalOrientation, ...this.playerPosition, ...this.cargo.position, this.state])); return result;
    };
    try {
      const route = await runV8Journey(game, { journeyOptions: { recovery } });
      assert.ok(route.pass); assert.equal(route.resets + route.respawns, 0);
      results.push({ hash: hash.digest('hex'), frames: route.frames, teleports: game.teleportCount });
    } finally { game.updateVisuals = original; game.firstLevel?.dispose?.(); game.physics.dispose(); game.portals.dispose(); }
  }
  assert.deepEqual(results[0], results[1]);
});
