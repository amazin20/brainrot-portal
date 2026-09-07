import * as THREE from 'three';
import { Workshop, Flywheel, V, tracePortalRay } from './LabWorkshopKit.js';

/** Room 11 only. No new device, game rule or campaign entry.
 * Existing source meshes, air tracing, inertia and door actuator are retained.
 * The blower grille faces its emitted air; the generator's FRONT rotor receives
 * it. Unlike the generic derivative partition, its rear cap never rotates. */
export function generatorSkin(game) {
  const source = game.model(31, 1);
  source.updateWorldMatrix(true, true);
  const art = new THREE.Group(); art.userData.assetId = 31;
  const fixed = new THREE.Group(); fixed.name = 'Frame'; art.add(fixed);
  const rotor = new THREE.Group(); rotor.name = 'Moving';
  rotor.position.set(-.00096, .39807, .432875); art.add(rotor);
  let sourceTriangles = 0, movingTriangles = 0;
  source.traverse(node => {
    if (!node.isMesh) return;
    const geometry = node.geometry.clone().applyMatrix4(node.matrixWorld);
    const p = geometry.attributes.position, idx = geometry.index;
    const still = [], moving = [];
    for (let i = 0; i < idx.count; i += 3) {
      const ids = [idx.getX(i), idx.getX(i + 1), idx.getX(i + 2)];
      const center = ids.reduce((v, j) => v.add(new THREE.Vector3().fromBufferAttribute(p, j)), V()).multiplyScalar(1 / 3);
      // Native unit-size model: front impeller is +Z. Housing/stand and
      // the sealed -Z motor cap remain fixed. No triangles are dropped.
      const spins = center.z > .20 && Math.hypot(center.x + .00096, center.y - .39807) < .275;
      (spins ? moving : still).push(...ids); sourceTriangles++;
    }
    for (const [indices, parent] of [[still, fixed], [moving, rotor]]) {
      if (!indices.length) continue;
      const piece = geometry.clone(); piece.setIndex(indices);
      if (parent === rotor) piece.translate(-rotor.position.x, -rotor.position.y, -rotor.position.z);
      piece.computeBoundingBox(); piece.computeBoundingSphere();
      const mesh = new THREE.Mesh(piece, node.material); mesh.receiveShadow = true; parent.add(mesh);
    }
    movingTriangles += moving.length / 3; geometry.dispose();
  });
  art.userData.partition = { sourceTriangles, movingTriangles };
  return { id: 31, art, pivot: rotor, fixed, spin: angle => { rotor.rotation.z = angle; } };
}

/** A receiver admits only air reaching its FRONT disc; passing behind the
 * machine or hitting its housing is not interchangeable with driving it. */
export function receivesFrontAir(segments, inlet, normal, radius) {
  return segments.some(s => {
    const den = s.direction.dot(normal);
    if (den >= -.5) return false;
    const distance = inlet.clone().sub(s.a).dot(normal) / den;
    if (distance < 0 || distance > s.length + .025) return false;
    return s.a.clone().addScaledVector(s.direction, distance).distanceTo(inlet) < radius;
  });
}

export function buildReadableWindRoom(game, spec) {
  const k = new Workshop(game, spec, 10), w = k.world;
  const bounds = { minX: -14, maxX: 14, minZ: -19, maxZ: 15 };
  k.shell(bounds, 9);
  w.materials.wall.color.setHex(0x3b4750);
  w.materials.floor.color.setHex(0x56616a);
  w.materials.trim.color.setHex(0x25303a);
  w.materials.ceramic.emissiveIntensity = .10;

  // Flush wall-mounted areas, no duplicate coplanar panels or opaque billboard
  // in the middle of the room. All stop BEFORE the locked doorway partition.
  k.panel('work-front', [0, 2.3, 14.975], [0, 0, -1], 27);
  k.panel('work-left', [-13.975, 2.3, 8], [1, 0, 0], 10);
  k.panel('work-right', [13.975, 2.3, -7], [-1, 0, 0], 5);
  k.panel('wind-intake', [13.975, 2.1, 5], [-1, 0, 0], 16);
  k.panel('wind-outlet', [-13.975, 2.1, -5], [1, 0, 0], 12);

  // Existing louvred blower (35), standing on its own feet. Its grille is not
  // an impeller: do not spin its casing or its complete bank of louvres.
  const blowerArt = k.staticFixture(35, [-11.3, 0, 5], 3.3, Math.PI / 2);
  const blowerBox = new THREE.Box3().setFromObject(blowerArt.art);
  const origin = V(blowerBox.max.x + .04, 2.1, 5);
  const fan = { art: blowerArt, origin, direction: V(1, 0, 0), enabled: false, segments: [] };
  k.state.blower = fan;

  // The actual front impeller, not the closed rear cap, is the moving part.
  const turbineArt = generatorSkin(game);
  turbineArt.art.scale.setScalar(5.27596); // native axle height .39807 -> 2.10 m
  turbineArt.art.rotation.y = -Math.PI / 2;
  turbineArt.art.position.set(-5.4, 0, -5);
  turbineArt.art.userData.gameplayRole = 'Receives air and stores rotational energy';
  w.root.add(turbineArt.art); k.fixtures.push(turbineArt);
  const turbineBox = new THREE.Box3().setFromObject(turbineArt.art);
  const housing = game.collisionProxy(turbineBox);
  const inlet = V(turbineBox.min.x - .025, .39807 * 5.27596, -5);
  const wheel = new Flywheel();
  const turbine = { art: turbineArt, wheel, position: inlet, normal: V(-1, 0, 0), power: false, clutch: false, housing };
  k.state.flywheel = turbine;

  // Keep the existing exit and physical latch. Remove the unrelated loose
  // cable reel and hovering progress stick; neither explained the old device.
  const door = k.door(-12);
  const pawl = w.box([-2.65, 1.7, -11.63], [.6, .2, .7], w.materials.accent, false);
  const ratchet = { engaged: false, progress: 0 }; k.state.ratchet = ratchet;
  const fanControl = k.control('fan-switch', [-9.5, 0, 8.3], () => { fan.enabled = !fan.enabled; }, 'E — включить вентилятор.');
  const clutchControl = k.control('clutch', [-.6, 0, -4], () => { turbine.clutch = !turbine.clutch; }, 'E — подключить привод двери.');
  // A single grounded, continuous existing cable route, not a floating wire.
  k.wire([[-3.04, .065, -5], [-2.65, .065, -5], [-2.65, .065, -11.4], [-2.65, 1.7, -11.4]], () => turbine.clutch && wheel.omega > .1);

  // Air is visible as drifting dust, never a glowing vector line through the
  // room. Particles stop at the same real blockers used by the air simulation.
  const dust = new THREE.InstancedMesh(new THREE.SphereGeometry(.045, 5, 4), new THREE.MeshBasicMaterial({ color: 0xb7d8de }), 72);
  dust.frustumCulled = false; w.root.add(dust);
  const matrix = new THREE.Matrix4(), right = V(), up = V(), position = V(), axisUp = V(0, 1, 0);
  let previousAngle = 0, previousPawl = 0;
  const lights = [];
  door.art.traverse(o => { if (o.isMesh && o.material.isMeshBasicMaterial) lights.push(o); });
  k.ticks.push(dt => {
    previousAngle = wheel.angle; previousPawl = ratchet.progress;
    fan.segments = fan.enabled ? tracePortalRay(game, origin, fan.direction, { medium: 'air', length: 80 }) : [];
    turbine.power = receivesFrontAir(fan.segments, inlet, turbine.normal, 1.0);
    wheel.step(turbine.power ? 24 : 0, turbine.clutch && !ratchet.engaged ? 2.2 : 0, dt);
    if (wheel.work > 70) ratchet.engaged = true;
    ratchet.progress = THREE.MathUtils.damp(ratchet.progress, ratchet.engaged ? 1 : 0, 6, dt);
    door.update(ratchet.engaged, dt, k.time);
    fanControl.lesson = fan.enabled ? 'E — выключить вентилятор.' : 'E — включить вентилятор.';
    clutchControl.lesson = turbine.clutch ? 'E — отключить привод двери.' : 'E — подключить привод двери. Вращение турбины передаст ему усилие.';
  });
  k.renders.push(alpha => {
    turbineArt.spin(THREE.MathUtils.lerp(previousAngle, wheel.angle, alpha));
    pawl.rotation.z = -.6 * THREE.MathUtils.lerp(previousPawl, ratchet.progress, alpha);
    for (const light of lights) light.material.color.setHex(ratchet.engaged ? 0x82d6c1 : 0xd4a254);
    dust.visible = fan.enabled && fan.segments.length > 0;
    for (let i = 0; i < dust.count; i++) {
      const s = fan.segments[i % Math.max(1, fan.segments.length)];
      if (!s) break;
      right.crossVectors(s.direction, axisUp); if (right.lengthSq() < .01) right.set(1, 0, 0); right.normalize();
      up.crossVectors(right, s.direction).normalize();
      position.copy(s.a).addScaledVector(s.direction, ((k.time * .22 + i / 72) % 1) * s.length)
        .addScaledVector(right, Math.sin(i * 2.4) * .28).addScaledVector(up, Math.cos(i * 3.7) * .28);
      dust.setMatrixAt(i, matrix.makeTranslation(position.x, position.y, position.z));
    }
    dust.instanceMatrix.needsUpdate = true;
  });
  k.resets.push(() => {
    fan.enabled = false; fan.segments = []; turbine.power = turbine.clutch = false; wheel.reset();
    ratchet.engaged = false; ratchet.progress = previousPawl = previousAngle = 0;
    turbineArt.spin(0); pawl.rotation.z = 0; dust.visible = false;
  });
  const level = k.finish([2, 0, 11], [0, .55, 9], [0, 0, -16], { workshop: k, readability: { inlet, housing, dust, pawl, fanControl, clutchControl } });
  // Context comes from the nearby existing control, not instructions painted
  // on the wall or a central overlay. No solution markers or forced ordering.
  level.getContextLesson = () => {
    const action = level.nearbyInteraction();
    return action ? ['room11-' + action.kind, 'E', action.text.replace(/^E — /, ''), false] : null;
  };
  level.reset(); return level;
}
