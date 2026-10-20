import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {disposeLabLevel} from '../src/game/LabLevelLifecycle.js';
import {ACTIVE_FOUNDATION_RUNTIME_FLAGS} from '../src/game/ReleaseIdentity.js';

// CPU integration of the ordinary production route from public start().
// This supplies no browser UI, WebGL, recording or publication evidence.
const game = await createHeadlessGame();
game.audio.unlock = () => {};
after(() => disposeLabLevel(game));

async function fresh(index) {
  Object.assign(game, {chamberEdition: 'foundation', ...ACTIVE_FOUNDATION_RUNTIME_FLAGS});
  await game.selectLevel(index, false);
  assert.equal(game.state, 'ready');
  game.start();
  assert.equal(game.state, 'playing');
  assert.equal(game.physics.world.stepnumber, 0);
  assert.equal(game.elapsed, 0);
  assert.equal(game.firstLevel.index, index);
  assert.deepEqual(game.playerPosition.toArray(), game.firstLevel.spawn.toArray?.() ?? game.firstLevel.spawn);
  assert.deepEqual(game.cargo.position.toArray(), game.firstLevel.cargoSpawn.toArray?.() ?? game.firstLevel.cargoSpawn);
  assert.equal(game.heldCube, null);
  assert.equal(game.teleportCount, 0);
  assert.equal(game.portals.ready, false);
  assert.ok(game.portals.portals.every(portal => !portal));
  assert.equal(game.portalShots.queue.length, 0);
  assert.equal(game.portalShots.active.length, 0);
}

for (let index = 30; index < 40; index++) test(`nativeStart room ${index + 1} reaches actual WON from public zero-step Play with no post-start reset`, async t => {
  await fresh(index);
  const level = game.firstLevel, world = game.physics.world, cargo = game.cargo, body = game.physics.cargoBody;
  const shape = body.shapes[0], player = game.playerVisual, weapon = game.weapon, cargoVisual = cargo.visual;
  const camera = game.camera, cameraRig = game.cameraRig, buffers = [];
  for (const root of [player, weapon, cargoVisual]) root.traverse(mesh => {
    if (!mesh.isMesh) return;
    const attributes = Object.entries(mesh.geometry.attributes).map(([key, attribute]) => ({key, attribute, array: attribute.array ?? attribute.data?.array}));
    buffers.push({mesh, geometry: mesh.geometry, attributes, index: mesh.geometry.index});
  });
  const resets = {resetRun: 0, respawn: 0, resetCargo: 0, levelReset: 0};
  const original = {resetRun: game.resetRun, respawn: game.respawn, resetCargo: game.physics.resetCargo, levelReset: level.reset, visual: game.updateVisuals};
  const reject = name => function () { resets[name]++; throw Error('Forbidden post-start reset: ' + name); };
  game.resetRun = reject('resetRun'); game.respawn = reject('respawn'); game.physics.resetCargo = reject('resetCargo');
  if (typeof level.reset === 'function') level.reset = reject('levelReset');
  let steps = 0, visualFrames = 0;
  const clock = [], milestones = [];
  const snapshot = phase => ({phase, visualFrame: visualFrames, worldStep: world.stepnumber, elapsedMilliseconds: game.elapsed, state: game.state});
  clock.push(snapshot('start'));
  game.updateVisuals = function (...args) {
    const result = original.visual.apply(this, args);
    visualFrames++;
    if (visualFrames % 1200 === 0) clock.push(snapshot('interval'));
    return result;
  };
  const onStep = () => {
    assert.equal(world.stepnumber, ++steps);
    assert.ok(steps <= 300 * 120, 'Finite CPU route exceeded 300 simulation seconds');
    assert.equal(game.firstLevel, level); assert.equal(game.physics.world, world);
    assert.equal(game.cargo, cargo); assert.equal(game.physics.cargoBody, body); assert.equal(body.world, world);
    assert.equal(body.shapes.length, 1); assert.equal(body.shapes[0], shape); assert.equal(body.mass, 3.2);
    assert.deepEqual(shape.halfExtents.toArray(), [.39, .39, .39]);
    assert.equal(game.playerVisual, player); assert.equal(game.weapon, weapon); assert.equal(cargo.visual, cargoVisual);
    assert.equal(game.camera, camera); assert.equal(game.cameraRig, cameraRig);
    for (const position of [game.playerPosition, cargo.position]) assert.ok(position.toArray().every(Number.isFinite));
  };
  world.addEventListener('postStep', onStep);
  try {
    const result = await runV8Journey(game, {journeyOptions: {nativeStart: true}, onMilestone: mark => milestones.push({name: mark.name, ...snapshot('milestone')})});
    clock.push(snapshot('terminal'));
    assert.equal(result.pass, true); assert.equal(result.level, index + 1); assert.equal(result.id, level.id);
    assert.equal(game.state, 'won'); assert.equal(level.isWon(), true);
    assert.equal(result.frames, visualFrames);
    assert.ok(steps === visualFrames * 2 || steps === visualFrames * 2 - 1, 'Every visual frame has two real physics steps except the terminal step');
    assert.ok(Math.abs(game.elapsed - steps * (1000 / 120)) < 1e-5);
    assert.equal(result.resets, 0); assert.equal(result.respawns, 0);
    assert.deepEqual(resets, {resetRun: 0, respawn: 0, resetCargo: 0, levelReset: 0});
    for (const row of buffers) {
      assert.equal(row.mesh.geometry, row.geometry); assert.equal(row.mesh.geometry.index, row.index);
      for (const attribute of row.attributes) {
        assert.equal(row.geometry.attributes[attribute.key], attribute.attribute);
        assert.equal(attribute.attribute.array ?? attribute.attribute.data?.array, attribute.array);
      }
    }
    t.diagnostic(JSON.stringify({scope: 'CPU ordinary production route only', room: index + 1, id: level.id,
      visualFrames, worldSteps: steps, simulationSeconds: steps / 120, teleports: result.teleports,
      resets, sameOriginalActorsAndBuffers: true, clock, milestones}));
  } finally {
    world.removeEventListener('postStep', onStep);
    game.resetRun = original.resetRun; game.respawn = original.respawn; game.physics.resetCargo = original.resetCargo;
    game.updateVisuals = original.visual;
    if (typeof original.levelReset === 'function') level.reset = original.levelReset;
  }
});

test('nativeStart rejects prepared optics states, mismatched rooms and room41 before changing input, clocks, poses or resets', async () => {
  const mutations = [
    g => {g.state = 'ready';}, g => {g.levelIndex = 30;},
    g => {g.levelIndex = 40; g.firstLevel.index = 40;}, g => {g.chamberEdition = 'open';},
    g => {g.physics.world.stepnumber = 1;}, g => {g.elapsed = .01;},
    g => {g.playerPosition.x += .01;}, g => {g.cargo.position.z += .01;},
    g => {g.heldCube = g.cargo;}, g => {g.teleportCount = 1;},
    g => {g.portals.portals[0] = {};}, g => {g.portals.portals = [{}, {}];},
    g => {g.portalShots.queue.push({});}, g => {g.portalShots.active.push({});},
  ];
  for (const mutate of mutations) {
    await fresh(35);
    const levelIndex = game.firstLevel.index, portals = game.portals.portals.slice();
    mutate(game);
    const move = game.input.getMove, step = game.physics.world.stepnumber, elapsed = game.elapsed;
    const player = game.playerPosition.toArray(), cargo = game.cargo.position.toArray(), body = game.physics.cargoBody;
    const reset = game.resetRun;
    let resets = 0;
    game.resetRun = () => { resets++; throw Error('A rejected native start tried to reset'); };
    try {
      await assert.rejects(runV8Journey(game, {journeyOptions: {nativeStart: true}}), /Native chapter start/);
      assert.equal(resets, 0); assert.equal(game.input.getMove, move);
      assert.equal(game.physics.world.stepnumber, step); assert.equal(game.elapsed, elapsed);
      assert.deepEqual(game.playerPosition.toArray(), player); assert.deepEqual(game.cargo.position.toArray(), cargo);
      assert.equal(game.physics.cargoBody, body);
    } finally {
      game.resetRun = reset; game.portals.portals = portals; game.firstLevel.index = levelIndex;
    }
  }
});
