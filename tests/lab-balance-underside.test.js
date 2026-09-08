import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createHeadlessGame } from '../scripts/lab-headless.mjs';

const game = await createHeadlessGame();
await game.selectLevel(6, true);
const level = game.firstLevel, rig = level.state.rig;
const V = (...v) => new THREE.Vector3(...v);
const height = 2.4, radius = .43;
function setAngle(angle) {
  game.clearPortals(); game.playerGrounded = false;
  level.state.angle = level.state.previousAngle = angle;
  level.state.omega = 0; level.update(0);
}
function insideCapsule(point, feet) {
  const spine = new THREE.Line3(feet.clone().add(V(0, radius, 0)), feet.clone().add(V(0, height - radius, 0)));
  return spine.closestPointToPoint(point, true, V()).distanceTo(point) < radius - 1e-5;
}

test('the complete visible balance beam and under-tray rails reject a player capsule entering from below', () => {
  const beam = rig.moving.children.find(mesh => mesh.name === 'Continuous structural box beam');
  const rails = rig.moving.children.filter(mesh => mesh.name === 'Load tray lower rail');
  assert.ok(beam); assert.equal(rails.length, 4);
  for (const angle of [-.38, 0, .38]) {
    setAngle(angle);
    const points = [-2.4, 2.4].map(z => rig.moving.localToWorld(V(0, beam.position.y, z)));
    points.push(...rails.map(mesh => mesh.getWorldPosition(V())));
    for (const point of points) {
      const feet = V(point.x, Math.max(0, point.y - height / 2), point.z);
      assert.ok(insideCapsule(point, feet), 'Invalid regression fixture: capsule misses the real visible member');
      const previous = feet.clone();
      game.resolveBody(feet, previous, V(), radius, height, true);
      assert.ok(!insideCapsule(point, feet), `Player remains inside the visible rocker at angle ${angle}, member ${point.toArray()}`);
    }
  }
});

test('solid balance undersides do not push a player already walking on either tray or the narrow spine', () => {
  for (const angle of [-.38, 0, .38]) {
    setAngle(angle); game.playerGrounded = true;
    for (const [index, part] of rig.deckSurfaces.entries()) {
      const top = index < 2 ? level.state.surfaceOffset : rig.layout.deckTop;
      for (const x of (index < 2 ? [-1.3, 0, 1.3] : [-.3, 0, .3])) {
        const feet = rig.moving.localToWorld(V(x, top, part.center.z)), previous = feet.clone();
        const expected = feet.clone();
        game.resolveBody(feet, previous, V(.2, 0, 0), radius, height, true);
        assert.ok(feet.distanceTo(expected) < 1e-6, `An underside pushes a valid top contact at angle ${angle}, tray ${index}, x ${x}`);
      }
    }
  }
});

test('each tilted tray admits a full portal and opens only its own registered structural backing', () => {
  for (const angle of [-.38, 0, .38]) for (const name of ['balance-launch', 'lever-load']) {
    setAngle(angle);
    const panel = level.panels[name], frame = panel.getFrame(), other = level.panels['balance-drop'];
    game.yaw = 0;
    assert.equal(game.placeOnPanel(0, panel.mesh, frame.center), true, `Portal rejected on ${name} at angle ${angle}`);
    assert.equal(game.placeOnPanel(1, other.mesh, other.getFrame().center), true);
    assert.equal(game.portals.ready, true);
    const ids = panel.mesh.userData.portalBackingIds;
    assert.equal(ids.length, 4, 'Expected the tray, one central beam segment and its two lower rails');
    for (const id of ids) {
      const collider = game.colliders.find(c => c.mesh.uuid === id);
      assert.ok(collider); assert.equal(collider.portalOwner, panel.mesh);
      assert.equal(game.portalOpensCollider(collider, game.portals.portals[0].position, radius), true);
    }
    const opposite = level.panels[name === 'balance-launch' ? 'lever-load' : 'balance-launch'];
    for (const id of opposite.mesh.userData.portalBackingIds) {
      const collider = game.colliders.find(c => c.mesh.uuid === id);
      assert.equal(game.portalOpensCollider(collider, game.portals.portals[0].position, radius), false, 'Portal opens the opposite physical tray');
    }
  }
});

test.after(() => { game.physics.dispose(); game.portals.dispose(); });
