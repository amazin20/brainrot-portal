import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createHeadlessGame } from '../scripts/lab-headless.mjs';
import { runPortalEdgeJourney } from '../src/game/LabPortalEdgeJourney.js';
import { LabCamera } from '../src/game/LabCamera.js';
import { makePortalFrame } from '../src/game/LabPortals.js';

test('recorded floor rim walks keep the capsule inside the opening until its real transfer', async () => {
  const game = await createHeadlessGame();
  try {
    await game.selectLevel(8, false);
    const respawn = game.respawn;
    for (const offset of [0, .55, .7]) for (const sprint of [false, true]) {
      game.respawn = respawn; game.resetRun(true);
      let resets = 0;
      game.respawn = function (...args) {
        if (args[0] !== false) resets++;
        return respawn.apply(this, args);
      };
      // Isolated contact fixture: exact recorded aperture and lateral offsets.
      // Motion after setup is ordinary W/Shift, with production physics/render.
      for (const [index, name] of [[0, 'work-left'], [1, 'loading-floor']]) {
        const panel = game.firstLevel.panels[name];
        assert.equal(game.portals.placeOnPanel(index, panel.mesh, panel.getFrame().center).ok, true);
        game.portalSurfaceIds[index] = panel.mesh.uuid;
      }
      game.playerPosition.set(-7 + offset, 0, 9);
      game.previousPlayerPosition.copy(game.playerPosition);
      game.playerGroup.position.copy(game.playerPosition);
      game.yaw = 0; game.pitch = -.5; game.playerVelocity.set(0, 0, 0);
      game.playerGrounded = true;
      game.cameraRig.reset(game.playerPosition, game.yaw, game.pitch);
      game.input.keys = new Set(sprint ? ['KeyW', 'ShiftLeft'] : ['KeyW']);
      let minY = 0, minCameraDistance = Infinity;
      for (let frame = 0; frame < 180 && !resets; frame++) {
        game.updatePlaying(1 / 120); game.updatePlaying(1 / 120);
        game.updateVisuals(1 / 60, 1);
        minY = Math.min(minY, game.playerPosition.y);
        minCameraDistance = Math.min(minCameraDistance, game.camera.position.distanceTo(
          game.playerGroup.position.clone().add(new THREE.Vector3(0, 1.32, 0))));
      }
      const label = `offset ${offset}, sprint ${sprint}`;
      assert.equal(resets, 0, label);
      assert.equal(game.teleportCount, 1, label);
      assert.ok(minY > -1.3, `${label}: escaped through solid floor`);
      assert.ok(minCameraDistance > 2.7, `${label}: exit backing folded camera into player`);
      assert.equal(game.playerGrounded, true, label);
    }
  } finally { game.physics.dispose(); game.portals.dispose(); }
});

test('ordinary floor and wall passage keeps the same held friend and the third-person framing', async () => {
  const game = await createHeadlessGame();
  try {
    await game.selectLevel(8, false);
    const cameraInsideFloor = sample => {
      if (sample.teleports > 0) assert.ok(sample.camera[1] > .1,
        `The recovering lens escaped under the physical floor: ${JSON.stringify(sample)}`);
    };
    for (const carrying of [false, true]) for (const sprint of [false, true]) {
      for (const offset of [0, .55, .7]) {
        const { route, travel } = await runPortalEdgeJourney(game, { carrying, sprint, offset, onFrame: cameraInsideFloor });
        assert.equal(route.pass, true);
        assert.equal(route.resets + route.respawns, 0);
        assert.equal(travel.teleports, 1);
        assert.ok(travel.minCameraDistance > 2.7, JSON.stringify(travel));
      }
      const { route, travel } = await runPortalEdgeJourney(game, { carrying, sprint, reverse: true, offset: 0, onFrame: cameraInsideFloor });
      assert.equal(route.pass, true);
      assert.equal(travel.teleports, 1);
      assert.ok(travel.minCameraDistance > 2.7, JSON.stringify(travel));
    }
  } finally { game.physics.dispose(); game.portals.dispose(); }
});

test('transported camera clips only its exit backing while its eye is still behind that exit', () => {
  const camera = new THREE.PerspectiveCamera(62, 16 / 9, .1, 130);
  const rig = new LabCamera({ camera });
  const exit = makePortalFrame(new THREE.Vector3(0, 2.3, 0), new THREE.Vector3(1, 0, 0));
  const backing = new THREE.Box3(new THREE.Vector3(-.25, 0, -8), new THREE.Vector3(0, 12, 8));
  const pillar = new THREE.Box3(new THREE.Vector3(2, 0, -1), new THREE.Vector3(3, 8, 1));
  const floor = new THREE.Box3(new THREE.Vector3(-10, -.25, -10), new THREE.Vector3(10, 0, 10));
  camera.position.set(-3, 2, 0); camera.lookAt(4, 2, 0); camera.updateMatrixWorld(true);
  rig.portalExit = exit; rig.updatePortalClipping();
  assert.equal(rig.clipsPortalBacking(backing), true);
  assert.equal(rig.clipsPortalBacking(pillar), false);
  assert.equal(rig.clipsPortalBacking(floor), false);
  assert.ok(exit.position.clone().project(camera).z < -1);
  camera.lookAt(-8, 2, 0); camera.updateMatrixWorld(true);
  assert.equal(rig.clipsPortalBacking(backing), false, 'turning away must restore ordinary wall collision');
  camera.position.set(.3, 2, 0); camera.lookAt(4, 2, 0); camera.updateMatrixWorld(true);
  rig.updatePortalClipping();
  assert.equal(rig.portalExit, null);
  assert.equal(rig.clipsPortalBacking(backing), false);
});

test('jumping through the floor and turning during recovery keeps the camera usable', async () => {
  const game = await createHeadlessGame();
  try {
    await game.selectLevel(8, false);
    for (const carrying of [false, true]) {
      const samples = [];
      const { route, travel } = await runPortalEdgeJourney(game, {
        offset: 0, jump: true, turn: true, carrying, onFrame: frame => samples.push(frame),
      });
      assert.equal(route.pass, true);
      assert.equal(route.resets + route.respawns, 0);
      assert.equal(travel.teleports, 1);
      assert.ok(travel.minCameraDistance > 2.7, JSON.stringify(travel));
      assert.ok(Math.abs(travel.finalPitch + .5) < .001, 'The view was left pointing into the ceiling');
      for (const frame of samples.filter(frame => frame.teleports > 0)) {
        assert.ok(frame.camera[1] > .1, 'The camera went below the room');
        assert.ok(frame.portalClipped || frame.camera[0] > -12,
          `An unclipped camera escaped behind the outer wall: ${JSON.stringify(frame)}`);
      }
    }
  } finally { game.physics.dispose(); game.portals.dispose(); }
});
