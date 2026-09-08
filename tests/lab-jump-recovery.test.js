import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LabPlayerAnimator, LAB_PLAYER_JOINTS } from '../src/game/LabPlayerAnimator.js';

function fixture() {
  const root = new THREE.Group(), visual = new THREE.Group();
  root.add(visual); visual.scale.setScalar(2.21);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0, -.1, .1, -.17, .1, .1, -.17, 0, 0, -1.085,
  ], 3));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  mesh.rotation.x = Math.PI / 2; visual.add(mesh);
  return { root, animator: new LabPlayerAnimator({ visual }) };
}
const advance = (a, frames, input = {}) => {
  for (let frame = 0; frame < frames; frame++) a.update({ dt: 1 / 60, ...input });
};

test('running jumps stop footfall cadence in flight and receive both boots before releasing a recovery step', () => {
  for (const speed of [0, 2.2, 5]) for (const startFrames of [61, 79, 92]) {
    const { animator } = fixture();
    advance(animator, startFrames, { speed });
    const takeoffGait = animator.gait;
    animator.triggerJump();
    advance(animator, 24, { speed, grounded: false, velocity: { y: 4 } });
    advance(animator, 22, { speed, grounded: false, velocity: { y: -6 } });
    assert.equal(animator.gait, takeoffGait, 'airborne speed generated footfalls');
    assert.deepEqual(animator.footContact, { L: 0, R: 0 });
    for (let frame = 0; frame < 6; frame++) {
      animator.update({ speed });
      assert.ok(animator.footContact.L > .6 && animator.footContact.R > .6,
        `${speed} m/s landing resumed with a boot in swing at frame ${frame}`);
    }
    let recoverySteps = 0;
    for (let frame = 0; frame < 45; frame++) {
      animator.update({ speed });
      if (animator.footContact.L === 0 || animator.footContact.R === 0) recoverySteps++;
    }
    if (speed) assert.ok(recoverySteps > 8, 'reception prevented the next walking step');
    else assert.ok(animator.footContact.L > .99 && animator.footContact.R > .99);
  }
});

test('stationary falls absorb impact through knees, then ribs, and recover without shifting the physics root', () => {
  const results = [];
  for (const impact of [2, 9]) {
    const { root, animator } = fixture();
    root.position.set(2, 0, -3); root.rotation.y = .6;
    const initialPosition = root.position.clone(), initialQ = root.quaternion.clone();
    advance(animator, 90);
    advance(animator, 45, { grounded: false, velocity: { y: -impact } });
    const incomingKnee = (animator.bones.ShinL.rotation.x + animator.bones.ShinR.rotation.x) / 2;
    let pelvisPeak = 0, chestPeak = 0, pelvisTime = 0, chestTime = 0, maximumKnee = 0;
    for (let frame = 0; frame < 120; frame++) {
      animator.update();
      const compression = animator.bones.Body.position.z - animator.rig.rest.Body.z;
      if (compression > pelvisPeak) { pelvisPeak = compression; pelvisTime = frame; }
      if (animator.landingChest > chestPeak) { chestPeak = animator.landingChest; chestTime = frame; }
      if (frame >= 2 && frame < 15) maximumKnee = Math.max(maximumKnee,
        (animator.bones.ShinL.rotation.x + animator.bones.ShinR.rotation.x) / 2);
    }
    assert.ok(chestTime > pelvisTime, 'ribs did not follow the initial pelvis compression');
    assert.ok(Math.abs(animator.bones.Body.position.z - animator.rig.rest.Body.z) < .0001);
    assert.ok(Math.abs(animator.landingChest) < .0001);
    assert.deepEqual(root.position.toArray(), initialPosition.toArray());
    assert.deepEqual(root.quaternion.toArray(), initialQ.toArray());
    for (const name of ['ThighL', 'ThighR', 'ShinL', 'ShinR', 'FootL', 'FootR']) {
      assert.deepEqual(animator.bones[name].position.toArray(), animator.rig.rest[name].toArray());
      assert.deepEqual(animator.bones[name].scale.toArray(), [1, 1, 1]);
    }
    results.push({ pelvisPeak, chestPeak, kneeReception: maximumKnee - incomingKnee });
  }
  assert.ok(results[1].pelvisPeak > results[0].pelvisPeak * 2);
  assert.ok(results[1].chestPeak > results[0].chestPeak * 2);
  assert.ok(results[1].kneeReception > .3 && results[1].kneeReception > results[0].kneeReception + .2,
    `a harder landing only moved the torso over unchanged legs: ${JSON.stringify(results)}`);
});

test('jump and recovery remain equivalent across 30, 60, 120 and 144 Hz', () => {
  const stages = [
    { speed: 4 }, { speed: 4, grounded: false, velocity: { y: 5 } },
    { speed: 4, grounded: false, velocity: { y: -6 } }, { speed: 4 }, {},
  ];
  const simulate = fps => {
    const { animator } = fixture();
    return stages.map((input, index) => {
      if (index === 1) animator.triggerJump();
      for (let frame = 0; frame < fps / 2; frame++) animator.update({ dt: 1 / fps, ...input });
      return { position: animator.bones.Body.position.clone(), chest: animator.landingChest,
        feet: { ...animator.footContact },
        bones: Object.fromEntries(LAB_PLAYER_JOINTS.map(({ name }) => [name, animator.bones[name].quaternion.clone()])) };
    });
  };
  const reference = simulate(60);
  for (const fps of [30, 120, 144]) simulate(fps).forEach((sample, i) => {
    assert.ok(sample.position.distanceTo(reference[i].position) < .002);
    assert.ok(Math.abs(sample.chest - reference[i].chest) < .002);
    for (const { name } of LAB_PLAYER_JOINTS)
      assert.ok(sample.bones[name].angleTo(reference[i].bones[name]) < .018,
        `${name} diverged at ${fps} Hz, stage ${i}`);
  });
});

test('both companion grips remain exact through jump, impact and turning recovery', () => {
  const { root, animator } = fixture();
  for (let frame = 0; frame < 220; frame++) {
    const air = frame >= 80 && frame < 135;
    root.rotation.y += .003;
    root.position.z += .018;
    root.position.y = air ? Math.sin((frame - 80) / 55 * Math.PI) : 0;
    animator.rig.mesh.updateWorldMatrix(true, true);
    const targets = Object.fromEntries([['left', -.15], ['right', .16]].map(([key, x]) => [key,
      animator.rig.mesh.localToWorld(new THREE.Vector3(x, .16, -.46))]));
    animator.update({ carrying: true, carryGripTargets: targets, speed: 1.8,
      grounded: !air, velocity: { y: air ? 6 - (frame - 80) * .22 : 0 }, turnRate: .18 });
    if (frame > 40) for (const key of ['left', 'right']) {
      assert.equal(animator.diagnostics.carryReach[`${key}Clamped`], false);
      assert.ok(animator.diagnostics.carryReach[`${key}Error`] < 1e-7,
        `${key} hand lost its grip at frame ${frame}`);
    }
  }
});
