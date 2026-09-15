import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createHeadlessGame } from '../scripts/lab-headless.mjs';
import { runV8Journey } from '../src/game/LabV8Journey.js';
import { room21Climb, room21PrepareSource, room21Aim, runRoom21 } from '../src/game/LabRoom21Journey.js';
import { CAMPAIGN } from '../src/game/LabCampaignLevels.js';

const game = await createHeadlessGame();
await game.selectLevel(20, false);
after(() => { game.physics.dispose(); game.portals.dispose(); });

for (const options of [
  { order: 'cargo-first' }, { order: 'scout-first' }, { recovery: true },
  { launchOffset: -.35 }, { launchOffset: .35 },
]) test(`room21 ordinary full route ${JSON.stringify(options)} retains one companion and never resets`, async () => {
  const report = await runV8Journey(game, { journeyOptions: options });
  assert.equal(report.pass, true); assert.equal(game.state, 'won');
  assert.equal(report.respawns, 0); assert.equal(report.resets, 0);
  assert.equal(game.firstLevel.isWon(), true); assert.ok(game.playerGrounded);
  const marks = report.milestones.map(mark => mark.name);
  const freight = marks.findIndex(s => s.includes('same cargo loads'));
  const scout = marks.findIndex(s => s.includes('mechanical brake retains'));
  assert.ok(options.order === 'scout-first' ? scout < freight : freight < scout);
  if (options.recovery) assert.ok(marks.some(s => s.includes('failed flight lands safely')));
});

for (const x of [-.30, 0, .30]) for (const z of [-.12, .12]) test(`displaced freight remains retrievable through joint exit x=${x}, edge=${z}`, async () => {
  const report = await runV8Journey(game, { scenario: async d => {
    // Perturb ordinary walking/edge choices only. No actor transforms assigned.
    const walk = d.walk;
    d.walk = (tx, tz, seconds) => walk(tx === -10 ? tx + x : tx, tz === 11.65 ? tz + z : tz, seconds);
    await runRoom21(d);
    assert.equal(game.state, 'won'); assert.equal(game.firstLevel.isWon(), true);
  } });
  assert.equal(report.resets, 0); assert.equal(report.respawns, 0);
});

test('carrying the only load through the high route cannot erase the physical closed guard', async () => {
  await runV8Journey(game, { scenario: d => {
    room21PrepareSource(d);
    const p = game.firstLevel.panels;
    d.walk(0, 14); d.walk(0, -1);
    d.walk(-6, -1); d.walk(-6, 5); d.aim(0, p['shared-drop'].getFrame().center.clone().setZ(10.8));
    d.walk(-6, -1); d.walk(0, -1); d.walk(0, 14);
    // Bring the cargo with ordinary commands to the retained source, then
    // put it on safe floor while changing the exit, and pick it up again.
    d.walk(-10,14); d.aim(1,p['source-carriage'].getFrame().center);
    d.walk(game.cargo.position.x + 1, game.cargo.position.z); d.pickup();
    d.walk(-10,11.65); const access=game.teleportCount;
    for(let n=0;n<300&&game.playerGrounded;n++){d.worldMove(0,-.12);d.frame();}
    d.until(()=>game.teleportCount>access,5,'Carried source access');d.until(()=>game.playerGrounded,6,'Source landing');
    d.walk(-10,14);d.look(new THREE.Vector3(-9,18,14));d.wait(.5);game.interact();d.wait(.5);
    d.walk(-10,11.65);room21Aim(d,1,p['rising-out'].getFrame().center);
    d.walk(game.cargo.position.x+1,game.cargo.position.z);d.pickup();d.walk(-10,11.65);
    const before = game.teleportCount;
    for (let i = 0; i < 300 && game.playerGrounded; i++) { d.worldMove(0, -.12); d.frame(); }
    d.stop(); d.until(() => game.teleportCount > before, 4, 'Carried launch');
    d.until(() => game.playerGrounded, 8, 'Closed-guard landing');
    assert.equal(game.state, 'playing'); assert.ok(game.playerPosition.x < 4);
    assert.equal(game.firstLevel.state.freightGuard.loaded, false);
    assert.equal(game.firstLevel.state.freightGuard.progress, 0);
    assert.ok(game.heldCube, 'The failed carried attempt must keep its companion');
  } });
});

test('a missed cargo drop is retrievable by ordinary walking and E, without a respawn', async () => {
  await runV8Journey(game, { scenario: d => {
    d.walk(game.cargo.position.x + 1, game.cargo.position.z); d.pickup();
    d.walk(-10, 14); d.look(new THREE.Vector3(-10, 7, 0));
    d.walk(-10, 11.65); d.wait(.5); game.interact(); // No portal pair on purpose.
    d.until(() => game.cargo.position.y < .8, 5, 'Unprepared cargo drop');
    d.walk(0, 14); d.walk(0, -1); d.walk(-10, -1);
    d.walk(game.cargo.position.x, game.cargo.position.z - 1); d.pickup();
    assert.ok(game.heldCube); assert.equal(game.state, 'playing');
    d.walk(-10, -1); d.walk(0, -1); d.walk(0, 14);
    assert.ok(game.playerPosition.y > 6.9);
  } });
});

test('freight aperture blocks the actual standing capsule, including a jump', () => {
  // Narrow contact fixture, NOT a claimed level route. Positions initialize this experiment only.
  for (const jump of [false, true]) {
    game.resetRun(true); game.playerPosition.set(3, 7.4, 3);
    game.previousPlayerPosition.copy(game.playerPosition); game.playerVelocity.set(7, jump ? 7.8 : 0, 0);
    game.playerGrounded = !jump; const before = game.input.getMove;
    game.yaw = 0; game.input.getMove = () => new THREE.Vector2(1, 0);
    try { for (let i = 0; i < 240; i++) game.updatePlaying(1 / 120); }
    finally { game.input.getMove = before; }
    assert.ok(game.playerPosition.x < 3.3, 'Capsule passed a 2.1 m opening');
    assert.equal(game.firstLevel.isWon(), false);
  }
});

test('return ceramic is blocked from sampled early views but visible from the permanent niche', () => {
  game.resetRun(true); game.firstLevel.renderUpdate(1); game.scene.updateMatrixWorld(true);
  const target = game.firstLevel.panels['receiving-return'];
  const ray = new THREE.Raycaster(), end = target.getFrame().center;
  const sees = p => {
    const origin = new THREE.Vector3(...p); ray.set(origin, end.clone().sub(origin).normalize());
    const hit = ray.intersectObjects(game.aimBlockers, true).find(h => game.isActiveBlocker(h.object));
    return hit?.object === target.mesh;
  };
  for (const origin of [[0, 8.2, 15], [-10, 19.2, 12], [-19, 15.2, -5.5], [-6, 1.2, 5], [12, 1.2, -8]])
    assert.equal(sees(origin), false, `Premature receiver shot from ${origin}`);
  assert.equal(sees([14, 13.2, -7]), true);
});

test('art follows the load-controlled guard without expanding its collider or touching character sources', () => {
  const l = game.firstLevel, gate = l.state.freightGuard;
  assert.ok(l.browser3DArt && l.premiumBrowser3DArt && l.architecture && l.authoredArt);
  assert.equal(l.authoredArt.userData.colliderIndependent, true);
  const childCount = gate.mesh.children.length;
  for (const progress of [0, .2, .5, 1]) {
    gate.previous = gate.progress = progress; l.renderUpdate(1);
    const box = new THREE.Box3().setFromObject(gate.mesh), size = box.getSize(new THREE.Vector3());
    assert.ok(Math.abs(size.y - 12.2) < 1e-5); assert.ok(Math.abs(size.z - 12) < 1e-5);
    const visual = l.authoredArt.getObjectByName('Load-controlled safety shutter');
    assert.ok(visual.position.distanceTo(gate.mesh.position) < 1e-8);
  }
  assert.equal(gate.mesh.children.length, childCount);
  game.resetRun(true);
  assert.deepEqual(CAMPAIGN[20].assets, [1, 2, 11, 19, 22, 23, 24, 31, 35]);
});

test('room21 victory checks only real joint arrival, never a visited-panel or stage checklist', () => {
  game.resetRun(true); const l = game.firstLevel;
  game.playerPosition.copy(l.goal.position); game.playerGrounded = true;
  assert.equal(l.isWon(), false, 'Player alone must not finish');
  game.cargo.position.copy(l.goal.position).y += .4;
  assert.equal(l.isWon(), true, 'A physically valid alternative is not rejected by hidden flags');
  game.playerGrounded = false; assert.equal(l.isWon(), false);
});
