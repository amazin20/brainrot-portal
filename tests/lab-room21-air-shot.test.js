import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createHeadlessGame } from '../scripts/lab-headless.mjs';
import { runV8Journey } from '../src/game/LabV8Journey.js';
import { installRoom21Aim } from '../src/game/LabRoom21Journey.js';
import { room21AirShotAttempt } from '../scripts/room21-air-shot-scenario.mjs';
const g = await createHeadlessGame(); await g.selectLevel(20, false);
after(() => { g.physics.dispose(); g.portals.dispose(); });
for (const targetU of [.7, 1.4, 2]) for (const fireAfterJump of [25, 30, 35]) {
  test(`airborne high-face shot u=${targetU}, frame=${fireAfterJump} hits visible casing; same friend remains recoverable`, async () => {
    let audit;
    const r = await runV8Journey(g, { scenario: d => {
      installRoom21Aim(d); audit = room21AirShotAttempt(d, { targetU, fireAfterJump });
    } });
    assert.equal(audit.requestAccepted, true, 'The click must be processed, not disabled');
    assert.equal(audit.earlyPortal, false);
    assert.equal(audit.shot.valid, false);
    assert.equal(audit.shot.reason, 'surface');
    assert.equal(audit.shortcutWon, false);
    assert.equal(audit.recovered, true);
    assert.equal(audit.final.braked, true);
    assert.equal(audit.final.height, g.firstLevel.cassette.high);
    assert.equal(audit.final.loaded, false);
    assert.equal(r.resets + r.respawns, 0);
  });
}
test('side return is visible solid geometry; its actual mesh owns the same collider and has no portal exception', () => {
  g.resetRun(true);
  const mesh = g.scene.getObjectByName('Cassette upper side return / solid');
  assert.ok(mesh?.isMesh && mesh.visible);
  const collider = g.colliders.find(c => c.mesh === mesh);
  assert.ok(collider?.enabled);
  assert.ok(collider.box.equals(new THREE.Box3().setFromObject(mesh)));
  assert.ok(!mesh.userData.portalable);
  assert.ok(Math.abs(collider.box.max.x + 2.05) < 1e-5);
  for (const p of Object.values(g.firstLevel.panels)) {
    assert.equal(p.mesh.userData.portalable, true);
    assert.ok(!p.mesh.userData.portalForbidden);
  }
});
