import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {mechanismCameraArea} from '../src/game/LabMechanismCamera.js';

const V = (...p) => new THREE.Vector3(...p);
function prepareSkin(game) {
  game.scene.updateMatrixWorld(true);
  game.playerGroup.traverse(mesh => {if (mesh.isSkinnedMesh) {mesh.skeleton.update();mesh.computeBoundingSphere();}});
}
function skinBounds(game) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, outside = 0, vertices = 0;
  // Full real-mesh projection is a test measurement only. Runtime evaluates
  // eight actor-envelope corners and at most twelve swept shoulder candidates.
  game.playerGroup.traverse(mesh => {
    if (!mesh.isMesh) return;
    for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
      const p = mesh.getVertexPosition(i, V()).applyMatrix4(mesh.matrixWorld).project(game.camera);
      vertices++;minX = Math.min(minX, p.x);maxX = Math.max(maxX, p.x);minY = Math.min(minY, p.y);maxY = Math.max(maxY, p.y);
      if (Math.abs(p.x) > 1 || Math.abs(p.y) > 1 || Math.abs(p.z) > 1) outside++;
    }
  });
  return {minX, maxX, minY, maxY, outside, vertices, height: (maxY - minY) / 2};
}

test('measured Room25 gallery pose exposes the real opaque player and reachable wall target with ordinary look controls', async () => {
  const game = await createHeadlessGame();
  try {
    await game.selectLevel(24, true);
    const target = game.firstLevel.panels['freight-receiver'].getFrame().center;
    const materialState = [];
    game.playerGroup.traverse(mesh => {if (mesh.isMesh) for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materialState.push([m, m.opacity, m.transparent, m.visible, m.depthWrite]);});
    const bodyState = game.physics.world.bodies.map(b => [b.id, b.position.toArray(), b.velocity.toArray(), b.quaternion.toArray()]);
    const results = [];
    for (const enabled of [false, true]) {
      // Optical regression fixture at the measured original 77-second route
      // position. It establishes camera composition, not ordinary reachability.
      game.cameraRig.mechanismFramingEnabled = enabled;
      game.playerPosition.set(-3.00544194417, 9, -14.49721045752);
      game.previousPlayerPosition.copy(game.playerPosition);game.playerVelocity.set(0, 0, 0);
      game.playerGrounded = true;game.facing = game.previousFacing = 2.01;
      game.yaw = 0;game.pitch = -.15;game.cameraRig.reset(game.playerPosition, game.yaw, game.pitch);
      for (let n = 0; n < 480; n++) {
        const p = target.clone().project(game.camera);
        if (target.clone().sub(game.camera.position).dot(game.camera.getWorldDirection(V())) < 0) game.yaw += .18;
        else {
          game.yaw -= THREE.MathUtils.clamp(p.x, -1, 1) * .22;
          game.pitch = THREE.MathUtils.clamp(game.pitch + THREE.MathUtils.clamp(p.y, -1, 1) * .19, -1.15, 1.15);
        }
        game.updateVisuals(1 / 60, 1);
      }
      prepareSkin(game);
      const bounds = skinBounds(game), direction = target.clone().sub(game.camera.position);
      const obscured = new THREE.Raycaster(game.camera.position, direction.clone().normalize(), 0, direction.length() - .04).intersectObject(game.playerGroup, true).length > 0;
      results.push({bounds, obscured, target: target.clone().project(game.camera), eye: game.camera.position.clone()});
    }
    const [old, current] = results;
    assert.ok(old.bounds.height > .55, 'fixture must reproduce the wall close-up');
    assert.ok(current.bounds.height < old.bounds.height * .8, JSON.stringify(results));
    assert.equal(current.bounds.outside, 0);assert.ok(current.bounds.vertices > 90000);
    assert.equal(current.obscured, false, 'original animated backpack covers the centre shot');
    assert.ok(Math.hypot(current.target.x, current.target.y) < .01, `ordinary look controls cannot settle: ${current.target.toArray()}`);
    assert.ok(game.cameraRig.lookPoint.distanceTo(game.cameraRig.focus.clone().addScaledVector(game.cameraRig.forward, 16)) < 1e-9);
    const before = {eye: game.camera.position.clone(), q: game.camera.quaternion.clone(), fov: game.camera.fov};
    assert.equal(game.firePortal(0), true);
    assert.ok(game.camera.position.equals(before.eye));assert.ok(game.camera.quaternion.equals(before.q));assert.equal(game.camera.fov, before.fov);
    assert.deepEqual(game.physics.world.bodies.map(b => [b.id, b.position.toArray(), b.velocity.toArray(), b.quaternion.toArray()]), bodyState);
    for (const [m, opacity, transparent, visible, depthWrite] of materialState) assert.deepEqual([m.opacity, m.transparent, m.visible, m.depthWrite], [opacity, transparent, visible, depthWrite]);
  } finally {game.firstLevel?.dispose?.();game.physics.dispose();game.portals.dispose();}
});

test('production current-box ownership is fresh and the accepted Foundation20 provider remains independent', async () => {
  const game = await createHeadlessGame();
  try {
    await game.selectLevel(24, true);
    for (let n = 0; n < 6; n++) {game.updatePlaying(1 / 120);game.updateVisuals(1 / 120, 1);}
    assert.equal(game.cameraRig.mechanismFramingActive, true);
    const collider = game.colliders.find(c => c.orientedBox?.body === game.firstLevel.state.optical.machine.deckBody);
    assert.ok(collider);const descriptor = collider.orientedBox;
    assert.equal(game.mechanismCameraDescriptor(collider.mesh), descriptor);
    const source = collider.mesh.matrixWorld.toArray(), step = descriptor.step;
    descriptor.step--;assert.equal(game.mechanismCameraDescriptor(collider.mesh), null);descriptor.step = step;
    const entry = game.physics.bodyBoxes.get(collider.mesh.uuid), shapeIndex = entry.shapeIndex;
    entry.shapeIndex = -1;assert.equal(game.mechanismCameraDescriptor(collider.mesh), null);entry.shapeIndex = shapeIndex;
    const half = descriptor.half.x;descriptor.half.x = NaN;assert.equal(game.mechanismCameraDescriptor(collider.mesh), null);descriptor.half.x = half;
    assert.equal(game.mechanismCameraDescriptor(collider.mesh), descriptor);
    assert.deepEqual(collider.mesh.matrixWorld.toArray(), source);
    game.chamberEdition = 'foundation';await game.selectLevel(19, true);
    assert.equal(game.cameraRig.foundation20Framing, true);assert.equal(game.cameraRig.mechanismFramingEnabled, false);
    assert.equal(game.cameraRig.mechanismFramingActive, false);assert.equal(mechanismCameraArea(game.firstLevel, 19, game.playerPosition), false);
    assert.ok(game.cameraRig.currentBlocker);assert.ok(game.cameraRig.currentBlockersValid);
    await game.selectLevel(40, true);
    assert.equal(game.cameraRig.currentBlocker, null);assert.equal(game.cameraRig.currentBlockersValid, null);
    assert.equal(game.cameraRig.mechanismFramingEnabled, true);
    for (const [name, room] of game.firstLevel.rooms) {
      const at = V(...room.def.at);
      assert.equal(mechanismCameraArea(game.firstLevel, 40, at), name === 'pendulum', name);
    }
    const deck = game.firstLevel.machines.get('pendulum').state.upperCell.deckPart;
    assert.equal(mechanismCameraArea(game.firstLevel, 40, deck.mesh.position), true);
  } finally {game.firstLevel?.dispose?.();game.physics.dispose();game.portals.dispose();}
});
