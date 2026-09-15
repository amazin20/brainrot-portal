import * as THREE from 'three';
import { rayTouches } from './LabPuzzleMechanics.js';

/** Room-local composition of the existing pneumatic motor, guided carriage,
 * manual brake, load linkage and service hood. All changes have physical
 * collision geometry; none of these states is consulted by isWon(). */
export function room21Preparation(k, deck) {
  const w = k.world;
  deck('West pneumatic service loop', -31, -23.6, -18, 18, 7);
  deck('Drive inspection landing', -24, -15.5, -16, -7, 7);
  deck('Carriage boarding apron', -24, -15.5, 11.5, 18, 7);
  // The bent service route provides two working views, not another free stair.
  w.box([-23.4, 10.2, 1], [.45, 6.4, 16], w.materials.wall);
  k.panel('pressure-intake', [-27, 9.3, 1.2], [0, 0, 1], 5.6, 4.6);
  k.panel('drive-outlet', [-27, 9.3, -12], [1, 0, 0], 5.6, 4.6);
  const fan = k.fan('source-air', [-27, 9.3, 9], [0, 0, -1], { radius: 1.1 });
  k.forces.push(() => {
    const body = k.game.physics?.cargoBody; if (!body || k.game.heldCube) return;
    const acceleration = fan.acceleration(k.game.cargo.position, k.game.cargo.velocity);
    body.force.x += acceleration.x * body.mass; body.force.y += acceleration.y * body.mass; body.force.z += acceleration.z * body.mass;
    if (acceleration.lengthSq() > .001) body.wakeUp();
  });
  const turbine = k.fixture(35, [-19, 7, -12], 3.6, Math.PI / 2);
  const receiver = new THREE.Vector3(-19, 9.3, -12);
  const car = k.slider('source-carriage', [-19, 7, 14], [-19, 18, 14],
    { width: 5, depth: 5, portal: true, asset: 19, assetSize: 4.4, wallSide: true });
  car.panel.group.position.x = 2.65;
  car.group.updateWorldMatrix(true, true);
  // Unlike an automatically completed "visit", the brake holds its actual
  // current height. Releasing it without power lets the counterweight return.
  const drive = { powered: false, brake: false, angle: 0, speed: 0, car, fan, turbine };
  k.ticks.unshift(dt => {
    drive.powered = fan.enabled && rayTouches(fan.segments, receiver, 1.4);
    drive.speed = THREE.MathUtils.damp(drive.speed, drive.powered ? 8 : 0, 4, dt);
    drive.angle += drive.speed * dt; turbine.spin(drive.angle);
    car.target = drive.powered ? 1 : 0;
    car.rate = drive.powered ? .16 : .085;
    car.locked = drive.brake;
  });
  k.control('source-brake', [-23, 7, 16.7], () => {
    drive.brake = !drive.brake; car.locked = drive.brake;
  }, 'Тормоз удерживает текущую высоту. Без воздуха и тормоза кабина опускается.');
  k.wire([[-19, 7.2, -12], [-16.2, 7.2, -12], [-16.2, 7.2, 10], [-19, 7.2, 11]], () => drive.powered);
  for (const x of [-21.8, -16.2]) {
    w.box([x, 10.8, 11.15], [.3, 21.6, .35], w.materials.trim);
    w.box([x, .2, 11.15], [1.4, .4, 1.4], w.materials.trim);
  }
  // Ceiling above the freight floor prevents the early floor/floor shortcut.
  // It can only be opened with the real service control on the far gallery.
  const hood = w.box([10.25, 13.7, 4.5], [12.1, 2.4, 9.5], w.materials.wall);
  const hoodCollider = k.game.colliders.at(-1); hoodCollider.kinematic = true;
  const service = { open: false, progress: 0, previous: 0, mesh: hood, collider: hoodCollider };
  const pose = p => { hood.position.z = 4.5 + 11.5 * p; hood.updateWorldMatrix(true, false); };
  k.control('freight-hood', [17.7, 12, -5], () => { service.open = !service.open; },
    'Сервисный колпак открывает грузовую опору. При снятии нагрузки перестраивается обратный путь.');
  k.ticks.push(dt => {
    service.previous = service.progress;
    service.progress += THREE.MathUtils.clamp((service.open ? 1 : 0) - service.progress, -dt * .4, dt * .4);
    pose(service.progress); k.game.syncCollision(hoodCollider, new THREE.Box3().setFromObject(hood), dt);
  });
  k.renders.push(a => pose(THREE.MathUtils.lerp(service.previous, service.progress, a)));
  k.resets.push(() => {
    fan.enabled = true; drive.powered = drive.brake = false; drive.angle = drive.speed = 0;
    car.locked = false; service.open = false; service.progress = service.previous = 0; pose(0);
  });
  k.state.sourceDrive = drive; k.state.freightHood = service;
  return { drive, service };
}

/** One load linkage has opposite strokes: it retracts the high shutter and
 * lowers the final bridge. Standing on permanent ground frees the same cargo
 * for retrieval; unloading raises the return bridge without a win flag. */
export function room21ReturnBridge(k, gate) {
  const w = k.world, g = k.game, group = new THREE.Group(); w.root.add(group);
  group.position.set(13, 12, -16.5);
  const surface = w.surface({ name: 'Counterstroke return bridge', position: [0, 0, 0], normal: [0, 1, 0],
    width: 5, height: 8, parent: group, moving: true, portal: false });
  const backing = g.colliders.find(c => c.mesh === surface.backing); if (backing) backing.kinematic = true;
  const floor = { minX: 10.5, maxX: 15.5, minZ: -20.5, maxZ: -12.5, y: 12, mesh: surface.mesh, enabled: true };
  g.floors.push(floor); w.floors.push(floor);
  const bridge = { group, floor, progress: 0, surface, low: 2.5, high: 12 };
  const pose = p => { group.position.y = 12 - 9.5 * p; group.updateWorldMatrix(true, true); };
  k.ticks.push(dt => {
    const old = floor.y;
    pose(gate.progress); floor.y = group.position.y; bridge.progress = gate.progress;
    const p = g.playerPosition;
    if (g.playerGrounded && Math.abs(p.y - old) < .18 && p.x > floor.minX && p.x < floor.maxX && p.z > floor.minZ && p.z < floor.maxZ) {
      p.y += floor.y - old; g.previousPlayerPosition.y += floor.y - old;
    }
    for (const c of [surface.collider, backing].filter(Boolean)) g.syncCollision(c, new THREE.Box3().setFromObject(c.mesh), dt);
  });
  k.renders.push(a => pose(THREE.MathUtils.lerp(gate.previous, gate.progress, a)));
  k.resets.push(() => { pose(0); floor.y = 12; bridge.progress = 0; });
  for (const x of [10.05, 15.95]) {
    w.box([x, 7.1, -16.5], [.32, 14.2, 8.7], w.materials.trim);
    w.box([x, .2, -16.5], [1, .4, 8.7], w.materials.trim);
  }
  k.wire([[4.7, 14.7, -.7], [6.2, 14.7, -.7], [6.2, 14.7, -17], [10, 14.7, -17]], () => gate.loaded);
  k.state.returnBridge = bridge;
  return bridge;
}
