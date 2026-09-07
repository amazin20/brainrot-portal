import * as THREE from 'three';
import { Workshop, Flywheel, V, tracePortalRay } from './LabWorkshopKit.js';
import { LabAirflowVisual } from './LabAirflowVisual.js';

/** Room 11 only. No new device, game rule or campaign entry.
 * Existing source meshes, air tracing, inertia and door actuator are retained.
 * User's model roles: round model 31 is the blower; louvred model 35 is
 * the receiving drive. Only the blower's front impeller rotates. */
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
      const radius = Math.hypot(center.x + .00096, center.y - .39807);
      const color = geometry.attributes.color;
      const paint = color ? ids.reduce((sum, j) => sum + .2126 * color.getX(j) + .7152 * color.getY(j) + .0722 * color.getZ(j), 0) / 3 : 0;
      // The white intake rim meets blade tips in the same mesh. Keep its
      // painted faces fixed; rotating the whole radial slice tears that rim.
      const spins = center.z > .20 && radius < .275 && (radius < .14 || paint < .18);
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
  k.panel('work-left', [-13.975, 2.3, 2], [1, 0, 0], 23);
  k.panel('work-right', [13.975, 2.3, 12], [-1, 0, 0], 5);
  k.panel('wind-intake', [13.975, 2.1, 4], [-1, 0, 0], 9);
  k.panel('wind-outlet', [13.975, 2.1, -5], [-1, 0, 0], 8);

  // Requested role swap: the round impeller model PRODUCES the air.
  // Keep its proven front-only partition, grounded feet and fixed painted rim.
  const blowerArt = generatorSkin(game);
  blowerArt.art.scale.setScalar(5.27596);
  blowerArt.art.rotation.y = Math.PI / 2;
  blowerArt.art.position.set(-8.3, 0, 4);
  blowerArt.art.userData.gameplayRole = 'Fan: emits air through its rotating front impeller';
  w.root.add(blowerArt.art); k.fixtures.push(blowerArt);
  const blowerBox = new THREE.Box3().setFromObject(blowerArt.art);
  game.collisionProxy(blowerBox);
  const origin = V(blowerBox.max.x + .04, 2.1, 4);
  const fan = { art: blowerArt, origin, direction: V(1, 0, 0), enabled: false, segments: [], rotorSpeed: 0, angle: 0 };
  k.state.blower = fan;

  // The louvred model RECEIVES the stream and drives the existing door.
  // Its grille and fixed housing are not a propeller; never spin the whole model.
  const turbineArt = k.staticFixture(35, [-5.4, 0, -5], 3.3, Math.PI / 2);
  turbineArt.art.userData.gameplayRole = 'Drive: receives airflow at the front grille and powers the door';
  const turbineBox = new THREE.Box3().setFromObject(turbineArt.art);
  const housing = game.colliders.find(c => c.box.equals(turbineBox));
  const inlet = V(turbineBox.max.x + .025, 2.1, -5);
  const wheel = new Flywheel();
  const turbine = { art: turbineArt, wheel, position: inlet, normal: V(1, 0, 0), power: false, clutch: false, housing };
  k.state.flywheel = turbine;

  // Keep the existing exit and physical latch. Remove the unrelated loose
  // cable reel and hovering progress stick; neither explained the old device.
  const door = k.door(-12);
  const pawl = w.box([-2.65, 1.7, -11.63], [.6, .2, .7], w.materials.accent, false);
  const ratchet = { engaged: false, progress: 0 }; k.state.ratchet = ratchet;
  const fanControl = k.control('fan-switch', [-4.7, 0, 6], () => { fan.enabled = !fan.enabled; }, 'E — включить вентилятор.');
  const clutchControl = k.control('clutch', [-.6, 0, -4], () => { turbine.clutch = !turbine.clutch; }, 'E — подключить привод двери.');
  // A single grounded, continuous existing cable route, not a floating wire.
  k.wire([[turbineBox.min.x - .02, .065, -5], [turbineBox.min.x - .02, .065, -9], [-2.65, .065, -9], [-2.65, .065, -11.4], [-2.65, 1.7, -11.4]], () => turbine.clutch && wheel.omega > .1);

  // Soft, path-advected wisps replace opaque dots. They share the exact traced
  // blockers/portal mapping and a physical-time clock; no extra physics/labels.
  const airflow = new LabAirflowVisual(w.root);
  const dust = airflow.mesh; // retained diagnostics alias; no sphere instances
  let previousAngle = 0, previousPawl = 0;
  const lights = [];
  door.art.traverse(o => { if (o.isMesh && o.material.isMeshBasicMaterial) lights.push(o); });
  k.ticks.push(dt => {
    previousAngle = fan.angle; previousPawl = ratchet.progress;
    const target = fan.enabled ? 12 : 0, rate = fan.enabled ? 3.5 : 2.7, old = fan.rotorSpeed;
    fan.rotorSpeed = THREE.MathUtils.damp(old, target, rate, dt);
    fan.angle += target * dt + (old - target) * (1 - Math.exp(-rate * dt)) / rate;
    const strength = fan.rotorSpeed / 12;
    fan.segments = strength > .005 ? tracePortalRay(game, origin, fan.direction, { medium: 'air', length: 80 }) : [];
    airflow.step(dt, strength); airflow.setPath(fan.segments, game.portals?.portals || []);
    turbine.power = receivesFrontAir(fan.segments, inlet, turbine.normal, 1.0);
    wheel.step(turbine.power ? 24 * strength : 0, turbine.clutch && !ratchet.engaged ? 2.2 : 0, dt);
    if (wheel.work > 70) ratchet.engaged = true;
    ratchet.progress = THREE.MathUtils.damp(ratchet.progress, ratchet.engaged ? 1 : 0, 6, dt);
    door.update(ratchet.engaged, dt, k.time);
    fanControl.lesson = fan.enabled ? 'E — выключить вентилятор.' : 'E — включить вентилятор.';
    clutchControl.lesson = turbine.clutch ? 'E — отключить привод двери.' : 'E — подключить привод двери. Поток воздуха передаст ему усилие.';
  });
  k.renders.push(alpha => {
    blowerArt.spin(THREE.MathUtils.lerp(previousAngle, fan.angle, alpha));
    pawl.rotation.z = -.6 * THREE.MathUtils.lerp(previousPawl, ratchet.progress, alpha);
    for (const light of lights) light.material.color.setHex(ratchet.engaged ? 0x82d6c1 : 0xd4a254);
    airflow.render(alpha, game.quality?.shadows === false ? 'low' : 'balanced');
  });
  k.resets.push(() => {
    fan.enabled = false; fan.segments = []; turbine.power = turbine.clutch = false; wheel.reset();
    ratchet.engaged = false; ratchet.progress = previousPawl = previousAngle = 0;
    fan.rotorSpeed = fan.angle = 0; blowerArt.spin(0); pawl.rotation.z = 0; airflow.reset();
  });
  const level = k.finish([-1, 0, 8], [1.5, .55, 7.5], [0, 0, -16], { workshop: k, readability: { inlet, housing, dust, airflow, pawl, fanControl, clutchControl } });
  // Context comes from the nearby existing control, not instructions painted
  // on the wall or a central overlay. No solution markers or forced ordering.
  level.getContextLesson = () => {
    const action = level.nearbyInteraction();
    return action ? ['room11-' + action.kind, 'E', action.text.replace(/^E — /, ''), false] : null;
  };
  level.reset(); return level;
}
