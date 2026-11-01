import test, {after, before} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {ACTIVE_FOUNDATION_RUNTIME_FLAGS} from '../src/game/ReleaseIdentity.js';
import {disposeLabLevel} from '../src/game/LabLevelLifecycle.js';
import {originalRoom13EntryContract} from './helpers/lab-room13-entry-view-contract.js';
import {gameplayContract} from './helpers/lab-art-contract.js';

let game;
before(async () => {game = await createHeadlessGame(); Object.assign(game, {chamberEdition: 'foundation', ...ACTIVE_FOUNDATION_RUNTIME_FLAGS});});
after(() => disposeLabLevel(game));

for (const room of [11, 13]) for (const aspect of [16 / 9, 390 / 844])
  test(`room ${room} CPU normal-spawn view retains the full original player above the floor at aspect ${aspect}`, async () => {
    await game.selectLevel(room - 1, false);
    game.camera.aspect = aspect; game.camera.updateProjectionMatrix(); game.resetRun(true); game.updateVisuals(0, 1);
    assert.equal(game.camera.aspect, aspect);
    const level = game.firstLevel, point = new THREE.Vector3();
    assert.deepEqual(game.playerPosition.toArray(), level.spawn);
    assert.deepEqual(game.cargo.position.toArray(), level.cargoSpawn);
    assert.equal(game.physics.world.stepnumber, 0); assert.equal(game.elapsed, 0);
    assert.ok(game.camera.position.y > level.spawn[1] + 1.5, 'The initial lens must not fall to floor height');
    let vertices = 0, outside = 0;
    game.scene.updateMatrixWorld(true);
    game.playerGroup.traverse(mesh => {
      if (!mesh.isMesh) return;
      if (mesh.isSkinnedMesh) mesh.skeleton.update();
      for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
        mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld).project(game.camera); vertices++;
        if (Math.abs(point.x) > 1 || Math.abs(point.y) > 1 || Math.abs(point.z) > 1) outside++;
      }
    });
    assert.equal(vertices, 96753); assert.equal(outside, 0); assert.ok(game.camera.fov <= 96);
    if (room === 13) {
      const current = gameplayContract(game), original = originalRoom13EntryContract(current);
      assert.deepEqual(original.room.spawnView, {yaw: 1.55, pitch: .12});
      for (const yaw of [0, 1.19, 1.21]) {
        const attack = structuredClone(current); attack.room.spawnView.yaw = yaw;
        assert.throws(() => originalRoom13EntryContract(attack));
      }
      const attack = structuredClone(current); attack.room.spawnView.pitch += .01;
      assert.throws(() => originalRoom13EntryContract(attack));
    }
  });
