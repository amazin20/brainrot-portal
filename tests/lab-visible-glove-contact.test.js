import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {LabVisibleGripProbe} from '../scripts/lib/lab-visible-grip.mjs';
import {LabCarrySurfaceContact} from '../src/game/LabCarrySurfaceContact.js';
import {runAnimationJourney} from '../src/game/LabAnimationJourney.js';
import {runV8Journey} from '../src/game/LabV8Journey.js';

// This acceptance check samples production skin triangles, independently of
// the reach solver and its wrist/target diagnostics. A 2 cm bone-landmark error
// would not establish that the actual visible glove meets the source cargo.
let fixture;
async function room() {
  fixture ??= createHeadlessGame();
  const game = await fixture;
  if (game.levelIndex !== 8) await game.selectLevel(8, false);
  return game;
}
after(async () => {
  if (!fixture) return;
  const game = await fixture;
  game.physics.dispose(); game.portals.dispose();
});

const array = value => value.toArray ? value.toArray() : [value.x, value.y, value.z];
const objectTransform = object => [array(object.position), array(object.quaternion), array(object.scale)];
function physicsSnapshot(game) {
  const body = game.physics.cargoBody;
  return {
    player: array(game.playerPosition), velocity: array(game.playerVelocity),
    cargo: array(body.position), cargoVelocity: array(body.velocity),
    cargoRotation: [body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w],
    grounded: game.playerGrounded, facing: game.facing,
  };
}
function geometryFingerprint(mesh) {
  const hash = createHash('sha256');
  for (const name of Object.keys(mesh.geometry.attributes).sort()) {
    const attribute = mesh.geometry.getAttribute(name), data = attribute.array;
    hash.update(`${name}:${attribute.itemSize}:${attribute.normalized}:`);
    hash.update(Buffer.from(data.buffer, data.byteOffset, data.byteLength));
  }
  const index = mesh.geometry.index?.array;
  if (index) hash.update(Buffer.from(index.buffer, index.byteOffset, index.byteLength));
  return hash.digest('hex');
}

function installContact(game, enabled = true) {
  const animator = game.animator, update = animator.update.bind(animator);
  const surface = enabled ? new LabCarrySurfaceContact({
    playerRig: animator.rig, companionRig: game.companionRig, visual: game.cargo.visual,
  }) : null;
  let corrections = 0;
  if (surface) {
    const apply = surface.apply.bind(surface);
    surface.apply = (owner, blend) => {
      const bones = Object.values(owner.rig.bones);
      const before = bones.map(bone => [array(bone.position), array(bone.scale)]);
      const hands = ['HandL', 'HandR'].map(name => ({name, rotation: owner.rig.bones[name].quaternion.clone()}));
      const physics = physicsSnapshot(game);
      const root = objectTransform(game.playerGroup), cargo = objectTransform(game.cargo.group);
      const visual = objectTransform(game.cargo.visual), identity = game.physics.cargoBody;
      apply(owner, blend);
      assert.deepEqual(bones.map(bone => [array(bone.position), array(bone.scale)]), before,
        'Surface correction changed source bone lengths or scales');
      assert.deepEqual(physicsSnapshot(game), physics, 'Surface correction changed physical state');
      assert.deepEqual(objectTransform(game.playerGroup), root, 'Surface correction moved the physical root');
      assert.deepEqual(objectTransform(game.cargo.group), cargo, 'Surface correction moved the carried object');
      assert.deepEqual(objectTransform(game.cargo.visual), visual, 'Surface correction moved the source cargo visual');
      assert.equal(game.physics.cargoBody, identity, 'Surface correction replaced the original cargo body');
      if (surface.diagnostics.active) {
        corrections++;
        for (const side of ['left', 'right']) assert.ok(surface.diagnostics[`${side}Correction`] <= .080000001,
          `${side} wrist correction exceeded its 8 cm visual bound`);
        for (const {name, rotation} of hands) assert.ok(rotation.angleTo(owner.rig.bones[name].quaternion) <= .450000001,
          `${name} surface correction exceeded its 0.45 rad local rotation bound`);
      }
    };
  }
  // Keep the helper after physical release: its stored local rotation overlay
  // fades with the ordinary carry envelope, without retaining the cargo.
  animator.update = input => update({...input, carrySurfaceContact: surface});
  return {surface, count: () => corrections, restore: () => {animator.update = update;}};
}

function sampler(game, probe, label) {
  const maximum = {left: 0, right: 0}, phases = new Set(), trajectory = [];
  let samples = 0, accepted = 0, next = 0;
  return {
    maximum, phases, trajectory,
    onFrame(frame) {
      // Time-based sampling avoids favouring a particular FPS. Every 15 FPS
      // sample is retained; at higher FPS the interval stays at about 0.1 s.
      if (frame.time + 1e-9 < next) return;
      next = frame.time + .09;
      const grip = probe.sample(); samples++;
      trajectory.push({time: frame.time, ...physicsSnapshot(game)});
      phases.add(frame.state);
      for (const side of ['left', 'right']) {
        const contact = grip[side];
        assert.ok(Number.isFinite(contact.distance) && contact.gloveTriangles > 30,
          `${label}: source glove contact region was not measured`);
        if (contact.reachBlend > .999 && !contact.clamped) {
          accepted++;
          maximum[side] = Math.max(maximum[side], contact.distance);
          assert.ok(contact.distance <= .02,
            `${label} ${side} visible glove gap ${(contact.distance * 100).toFixed(3)} cm at ${frame.time.toFixed(3)} s (${frame.state})`);
        }
      }
    },
    check() {
      assert.ok(samples >= 20 && accepted >= samples,
        `${label}: insufficient sustained reachable production grip samples (${accepted}/${samples})`);
      for (const phase of ['jump', 'fall', 'landing']) assert.ok(phases.has(phase), `${label}: no ${phase} mesh sample`);
    },
  };
}

test('actual production gloves stay within 2 cm of fixed cargo surfaces at 15–144 presentation FPS', async t => {
  const game = await room(), meshes = [game.animator.rig.mesh, game.companionRig.mesh];
  const geometry = meshes.map(geometryFingerprint);
  for (const fps of [15, 20, 30, 60, 120, 144]) {
    const installed = installContact(game), probe = new LabVisibleGripProbe(game);
    const samples = sampler(game, probe, `${fps} FPS`);
    try {
      const {route, motion} = await runAnimationJourney(game, {fps, carrying: true, onFrame: samples.onFrame});
      samples.check();
      assert.ok(route.pass && !route.respawns && !route.resets);
      assert.equal(motion.physicsSteps, 384);
      assert.ok(installed.count() > 30);
      t.diagnostic(`${fps} FPS source triangle maximum: L ${(samples.maximum.left * 100).toFixed(3)} cm, R ${(samples.maximum.right * 100).toFixed(3)} cm`);
    } finally { installed.restore(); }
  }
  assert.deepEqual(meshes.map(geometryFingerprint), geometry,
    'Presentation altered production positions, normals, UVs, skin weights or topology');
});

async function interruptedFrames(game, dt, onFrame) {
  let steps = 0, jumpIssued = false;
  return runV8Journey(game, {scenario: driver => {
    const friend = game.cargo.position.clone();
    driver.walk(friend.x + 1.2, friend.z); driver.pickup();
    driver.walk(-4.7, 10.6); driver.wait(.3);
    const body = game.physics.cargoBody;
    for (let i = 0; i < Math.round(3.2 / dt); i++) {
      const time = i * dt;
      if (time < 1.2) {driver.worldMove(1, 0); game.input.keys.add('ShiftLeft');}
      else if (time < 1.8) {driver.worldMove(0, -1); game.input.keys.add('ShiftLeft');}
      else driver.stop();
      if (!jumpIssued && time >= .6) {game.input.jumpQueued = true; jumpIssued = true;}
      const needed = Math.floor((i + 1) * dt * 120 + 1e-8);
      while (steps < needed) {game.updatePlaying(1 / 120); steps++;}
      game.updateVisuals(dt, 1);
      assert.equal(game.state, 'playing');
      assert.equal(game.heldCube, game.cargo);
      assert.equal(game.physics.cargoBody, body);
      onFrame({frame: i, time, state: game.animator.diagnostics.state});
    }
    driver.stop();
    assert.ok(game.playerGrounded && Math.hypot(game.playerVelocity.x, game.playerVelocity.z) < .03,
      'Ordinary interrupted-frame route did not recover to a stop');
  }});
}

test('80–100 ms presentation frames preserve real glove contact through ordinary turn, jump and stop', async t => {
  const game = await room();
  for (const dt of [.08, .1]) {
    const installed = installContact(game), probe = new LabVisibleGripProbe(game);
    const samples = sampler(game, probe, `${dt * 1000} ms`);
    try {
      const route = await interruptedFrames(game, dt, samples.onFrame);
      samples.check();
      assert.ok(route.pass && !route.respawns && !route.resets);
      t.diagnostic(`${dt * 1000} ms source triangle maximum: L ${(samples.maximum.left * 100).toFixed(3)} cm, R ${(samples.maximum.right * 100).toFixed(3)} cm`);
    } finally { installed.restore(); }
  }
});

test('surface correction preserves ordinary physical trajectories and zero-time focus pause', async () => {
  const game = await room();
  const trajectory = [];
  const baseline = installContact(game, false);
  try {
    await runAnimationJourney(game, {fps: 30, carrying: true, onFrame: () => trajectory.push(physicsSnapshot(game))});
  } finally { baseline.restore(); }
  const corrected = installContact(game);
  let frame = 0;
  try {
    await runAnimationJourney(game, {fps: 30, carrying: true, onFrame: () => {
      assert.deepEqual(physicsSnapshot(game), trajectory[frame++], 'Visual correction changed the ordinary physical route');
    }});
    assert.equal(frame, trajectory.length);
    const pose = () => JSON.stringify({
      player: Object.values(game.animator.rig.bones).map(objectTransform),
      cargo: Object.values(game.companionRig.bones).map(objectTransform),
      elapsed: [game.animator.elapsed, game.companionAnimator.elapsed, game.companionRig.elapsed],
      interaction: game.animator.diagnostics.interaction,
      surface: corrected.surface.diagnostics,
    });
    const before = pose(), calls = corrected.count();
    for (let n = 0; n < 30; n++) game.updateVisuals(0, 1, 0);
    assert.equal(pose(), before, 'Zero permitted presentation time changed the real mesh pose');
    assert.equal(corrected.count(), calls, 'Paused frames invoked contact correction');
  } finally { corrected.restore(); }
});

test('native pickup reaches actual glove surfaces and release fades without a pose pop', async t => {
  const game = await room(), installed = installContact(game), probe = new LabVisibleGripProbe(game);
  let supported = 0, maximumGap = 0, maximumStep = 0;
  try {
    const route = await runV8Journey(game, {scenario: driver => {
      const friend = game.cargo.position.clone();
      driver.walk(friend.x + 1.2, friend.z);
      game.interact();
      assert.equal(game.heldCube, game.cargo, 'Native interaction did not pick up the original friend');
      let reachedAt = null;
      for (let n = 0; n < 90; n++) {
        driver.frame();
        const contacts = probe.sample();
        if (game.animator.carryReach.blend > .999) reachedAt ??= n / 60;
        if (reachedAt !== null && n / 60 - reachedAt >= .15) {
          for (const side of ['left', 'right']) {
            if (contacts[side].clamped) continue;
            maximumGap = Math.max(maximumGap, contacts[side].distance); supported++;
            assert.ok(contacts[side].distance <= .02,
              `Pickup ${side} source glove still had ${(contacts[side].distance * 100).toFixed(3)} cm gap after contact settle`);
          }
        }
      }
      assert.ok(supported >= 60, 'Native pickup did not produce sustained reachable real glove contacts');
      const names = ['ArmL', 'ForearmL', 'HandL', 'ArmR', 'ForearmR', 'HandR'];
      let previous = names.map(name => game.animator.rig.bones[name].quaternion.clone());
      game.interact();
      assert.equal(game.heldCube, null, 'Visible fade delayed physical cargo release');
      const body = game.physics.cargoBody;
      for (let n = 0; n < 60; n++) {
        driver.frame();
        assert.equal(game.physics.cargoBody, body, 'Native release replaced the original cargo body');
        for (let i = 0; i < names.length; i++) {
          const rotation = game.animator.rig.bones[names[i]].quaternion;
          const step = previous[i].angleTo(rotation); maximumStep = Math.max(maximumStep, step);
          assert.ok(step <= .16, `Release ${names[i]} jumped ${(step * 180 / Math.PI).toFixed(2)}° in one 60 FPS frame`);
          previous[i].copy(rotation);
        }
      }
    }});
    assert.ok(route.pass && !route.respawns && !route.resets);
    t.diagnostic(`Pickup real-glove maximum ${(maximumGap * 100).toFixed(3)} cm; release arm/hand maximum ${(maximumStep * 180 / Math.PI).toFixed(2)}° per 60 FPS frame`);
  } finally { installed.restore(); }
});
