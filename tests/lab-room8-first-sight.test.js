import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createHeadlessGame } from '../scripts/lab-headless.mjs';
import { runV8Journey } from '../src/game/LabV8Journey.js';
import { gameplayContract, digest } from './helpers/lab-art-contract.js';

test('room eight reveals its real fan and shaft at entry, without changing the puzzle', async () => {
  const game = await createHeadlessGame();
  try {
    await game.selectLevel(7, false);
    game.resetRun(true);
    const level = game.firstLevel;
    assert.deepEqual(level.spawnView, { yaw: .75, pitch: -.15 });
    const contract = gameplayContract(game);
    delete contract.room.spawnView;
    assert.equal(digest(contract), 'f31a739cd4e1c5cdc16e7b6cb106cdaeb4611678728b9f662f9aa9fc31b16ecc',
      'The portal, collision, load and interaction geometry must stay at its audited baseline');

    for (const aspect of [1.6, 16 / 9]) {
      game.camera.aspect = aspect;
      game.camera.updateProjectionMatrix();
      game.cameraRig.reset(game.playerPosition, game.yaw, game.pitch);
      game.camera.updateMatrixWorld(true);
      const fan = new THREE.Box3().setFromObject(level.state.sourceFan.art).getCenter(new THREE.Vector3());
      const shaft = new THREE.Vector3(0, 5, 0);
      const dock = new THREE.Vector3(0, 7, -3.2);
      for (const [name, point] of [['source fan', fan], ['air shaft', shaft], ['upper dock', dock]]) {
        const ndc = point.project(game.camera);
        assert.ok(Math.abs(ndc.x) < .9 && Math.abs(ndc.y) < .9 && ndc.z < 1,
          `${name} should enter the ordinary ${aspect} camera frame: ${ndc.toArray()}`);
      }
    }

    const art = level.earlyMechanismArt.getObjectByName('Wind column / source and shaft fittings');
    assert.ok(art?.userData.visualOnly);
    const track = art.getObjectByName('Wind column / six forward floor chevrons');
    const shaft = art.getObjectByName('Wind column / shaft edge gauges');
    const rails = art.getObjectByName('Wind column / continuous shaft edge rails');
    assert.equal(track.count, 12);
    assert.equal(shaft.count, 12);
    assert.equal(rails.count, 2);
    assert.equal(track.material.color.getHex(), 0x456c75);
    assert.equal(shaft.material.color.getHex(), 0x456c75);
    level.state.enabled = true;
    for (let n = 0; n < 50; n++) level.update(1 / 120);
    level.renderUpdate(1);
    assert.equal(track.material.color.getHex(), 0x8de6d9);
    assert.equal(shaft.material.color.getHex(), 0x456c75,
      'An unconnected fan must not falsely signal a live vertical air route');

    const report = await runV8Journey(game, { onMilestone: mark => {
      if (mark.name === 'sustained portal-routed air supports both travellers') {
        assert.ok(level.state.segments.some(part => part.direction.y > .72));
        assert.equal(shaft.material.color.getHex(), 0x8de6d9);
      }
    } });
    assert.equal(report.pass, true);
    assert.equal(report.resets + report.respawns, 0);
  } finally {
    game.physics.dispose();
    game.portals.dispose();
  }
});
