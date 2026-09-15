import * as THREE from 'three';
import { addRoom21RebuildArt } from './LabRoom21RebuildArt.js';
import { addRoom21Art } from './LabRoom21Art.js';
import { room21Preparation, room21ReturnBridge } from './LabRoom21Preparation.js';
import { Workshop } from './LabWorkshopKit.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const ROOM21_SPEC = {
  id: 'gravity-pocket', title: 'Гравитационный карман',
  concept: 'Удержи высоту без питания, разнеси груз и игрока по траекториям и обрати нагрузку для общего выхода',
  description: 'Одна пара нужна приводу и перевозке. Сохрани высоту, подготовь грузовую ветвь и верни обратный мост.',
  hints: ['Воздух поднимает источник падения, тормоз сохраняет его высоту. Грузовая ветвь готовится независимо.',
    'Нагрузка убирает высокую створку, но опускает обратный мост. Низкий проём и высокий вылет решают разные задачи.',
    'Зафиксируй поднятую кабину, отправь друга на грузовую опору. Через ту же шахту доберись до высокого края и используй наклонный выход. С постоянной галереи открой колпак, извлеки друга и дождись обратного хода моста.'],
  accent: 0x91cfca, assets: [1, 2, 11, 19, 22, 23, 24, 31, 35],
};

/** No progression flags, scripted launches or special traveller velocities.
 * The retained production gravity/portal/cargo solvers execute every transfer.
 * The loaded cradle operates an ordinary retracting guard, never a win latch. */
export function buildRoom21(game, index = 20) {
  const k = new Workshop(game, ROOM21_SPEC, index), w = k.world;
  w.highFidelity = true;
  k.bounds = { minX: -32, maxX: 20, minZ: -25, maxZ: 22 };
  k.ceiling = 28;
  w.walls(k.bounds, k.ceiling, -1);
  w.materials.wall.color.setHex(0x6c807f);
  w.materials.floor.color.setHex(0x869993);
  const deck = (name, x0, x1, z0, z1, y) => {
    const surface = w.floor(x0, x1, z0, z1, y, { name });
    w.box([(x0 + x1) / 2, y - .30, (z0 + z1) / 2], [x1 - x0, .26, z1 - z0], w.materials.trim);
    return surface;
  };
  const stairs = (name, x0, x1, z0, z1, low, high) => {
    const count = Math.ceil((high - low) / .25);
    for (let i = 0; i < count; i++) {
      const a = z0 + (z1 - z0) * i / count, b = z0 + (z1 - z0) * (i + 1) / count;
      const y = low + (high - low) * (i + 1) / count;
      deck(name, x0, x1, Math.min(a, b), Math.max(a, b), y);
    }
  };
  // All missed flights meet one connected floor. Nothing respawns on landing.
  deck('Continuous recovery court', -32, 20, -25, 22, 0);
  deck('Low freight balcony', -22, 3, 11.5, 18, 7);
  stairs('Recovery stair', -2.5, 2.5, 1, 11.5, 0, 7);
  deck('High fall balcony', -13.5, -6.5, 11.5, 16, 18);
  w.box([-6.30, 19.6, 13.75], [.25, 3.2, 4.5], w.materials.wall);

  const drop = k.panel('shared-drop', [-10, .025, 9.5], [0, 1, 0], 6, 9);
  k.panel('freight-out', [-3, 9.9, 3], [1, 0, 0], 5.6, 4.6);
  w.box([-3.4, 3.9, 3], [1.05, 7.8, 4], w.materials.trim);
  w.box([-3.4, .18, 3], [2.1, .36, 5.1], w.materials.trim);
  const slope = k.panel('rising-out', [-9, 4.6, -5], [.4, Math.sqrt(.84), 0], 6, 6);
  // The broad-phase AABB includes air above a tilted plate. Use the existing
  // production front-plane contract, as the early tilted receiver does.
  slope.collider.frontPlane = () => slope.getFrame();
  w.box([-9, 1.35, -5], [4, 2.7, 4], w.materials.trim);

  // A cross-section, not an invisible route filter: low freight throat, solid
  // bulkhead and an observation pane. Standing/carrying players do not fit.
  w.box([4, 7.5, -8], [.65, 15, 16], w.materials.wall); // z -16..0
  w.box([4, 3.7, 3], [.65, 7.4, 6], w.materials.wall);
  w.box([4, 12.25, 3], [.65, 5.5, 6], w.materials.wall); // throat 7.4..9.5
  w.box([4, 4.1, 8.75], [.65, 8.2, 5.5], w.materials.wall);
  w.box([4, 14.8, 8.75], [.65, .4, 5.5], w.materials.wall);
  const glass = new THREE.MeshStandardMaterial({ color: 0x9dcbd1, roughness: .2,
    metalness: .05, transparent: true, opacity: .20, depthWrite: false });
  w.box([4, 11.4, 8.75], [.18, 6.4, 5.5], glass);
  for (const z of [6, 11.5]) w.box([3.9, 11.4, z], [.24, 6.4, .13], w.materials.trim);

  deck('Low freight throat', 3.6, 4.8, 0, 6, 7.4);
  // The low throat feeds a freight pocket with a separately retractable service hood.
  // The broad pad extends beyond the normal landing envelope so a displaced
  // cargo still has space for an entire return aperture, not merely its own box.
  // Its unloaded top is below the throat floor: a slow cargo meets a downward
  // step, never an unintended raised lip that arrests it before the load area.
  deck('Permanent cargo pocket', 4.8, 16, 0, 9, 7.2);
  const cradle = k.pad('freight-cradle', [10.4, 7.2, 4.5], 11.2, 9);
  w.box([9.75, 8.0, -.15], [12.5, 1.2, .3], w.materials.wall);
  w.box([9.75, 9.0, 9.15], [12.5, 3.2, .3], w.materials.wall);
  w.box([16.15, 9.0, 4.5], [.3, 3.2, 9], w.materials.wall);

  // The load keeps the guard inside its visible lower housing. Removing the
  // same load restores it; a traveller already on the permanent niche is safe.
  w.box([4, 21.1, -14.5], [.65, 12.2, 3], w.materials.wall);
  w.box([4, 21.1, 5.25], [.65, 12.2, 12.5], w.materials.wall);
  const guard = w.box([4, 21.1, -7], [.46, 12.2, 12], w.materials.trim);
  const guardCollider = game.colliders.at(-1);
  guardCollider.kinematic = true;
  const gate = { progress: 0, previous: 0, loaded: false, mesh: guard, collider: guardCollider };
  const pose = progress => { guard.position.y = 21.1 - progress * 12.5; guard.updateWorldMatrix(true, false); };
  k.state.freightGuard = gate;
  k.ticks.push(dt => {
    gate.previous = gate.progress;
    gate.loaded = cradle.loaded();
    const target = gate.loaded ? 1 : 0;
    gate.progress += THREE.MathUtils.clamp(target - gate.progress, -dt * .7, dt * .7);
    pose(gate.progress);
    const bounds = new THREE.Box3().setFromObject(guard);
    game.syncCollision(guardCollider, bounds, dt);
  });
  k.renders.push(alpha => pose(THREE.MathUtils.lerp(gate.previous, gate.progress, alpha)));
  k.resets.push(() => { gate.progress = gate.previous = 0; gate.loaded = false; pose(0); });
  // Guides and a visible mechanical linkage communicate what carries the load.
  for (const z of [-13.3, -.7]) w.box([4.5, 14, z], [.55, 28, .55], w.materials.trim);
  k.wire([[10, 7.15, 3], [5, 7.15, 3], [5, 7.15, 10.7], [4.7, 14.7, 10.7]], () => gate.loaded);

  deck('High receiving niche', 5.8, 20, -13, -2, 12);
  for (const [x, width] of [[5.95, .3], [18.0, 4.0]])
    w.box([x, 12.65, -1.85], [width, 1.3, .3], w.materials.wall);
  // An intentional open inspection edge exposes the freight floor below.
  w.box([11.05, 12.04, -1.94], [9.9, .08, .12], w.materials.trim);
  for (const [x,width] of [[8,4.4],[17.95,4.1]]) w.box([x,12.65,-13.15],[width,1.3,.3],w.materials.wall);
  // The ceramic faces away from all departure galleries. Its solid back and
  // the permanent niche floor block premature shots from above and below.
  w.box([7.65, 15, -10], [.65, 6, 5.6], w.materials.wall);
  k.panel('receiving-return', [8.01, 14.3, -10], [1, 0, 0], 5.4, 4.6);

  const preparation = room21Preparation(k, deck);
  const returnBridge = room21ReturnBridge(k, gate);
  deck('Final north arrival', 10.5, 20, -25, -20.5, 12);
  // Fixed guard rails surround the return route; the high shutter still shields early trajectories.
  w.box([9.9, 20, -22.75], [.5, 16, 4.5], w.materials.wall);
  w.box([18.3, 20, -20.25], [3.4, 16, .5], w.materials.wall);
  const authoredArt = addRoom21Art(k, gate);
  const preparationArt = addRoom21RebuildArt(k, preparation, returnBridge);
  const level = k.finish([0, 7, 12.8], [-2, 7.55, 15], [14, 12, -23], {
    authoredArt, preparationArt, workshop: k, spec: ROOM21_SPEC, portalPuzzle: true,
    playerAcceleration: (p, v) => preparation.drive.fan.acceleration(p.clone().add(V(0, 1.2, 0)), v),
  });
  level.spawnView = { yaw: -.60, pitch: .08 };
  level.conceptLesson = { position: [0, 7, 15], range: 8, key: '↗',
    text: 'Одна пара передаёт воздух или перевозит вас. Тормоз сохраняет высоту после отключения питания.' };
  level.puzzleGeometry = {
    footprint: 52 * 47, safeFloor: 0, freightHeight: 7, dropHeight: 18, goalHeight: 12,
    orders: ['cargo-first', 'scout-first'], noProgressFlags: true, revision: 'r2-physical-preparation',
    independentPreparations: ['braked-source-carriage', 'loaded-freight-cradle'],
    cargoWindow: { x: [3.675, 4.325], z: [0, 6], minY: 7.4, maxY: 9.5 },
    portalRoles: {
      'pressure-intake': 'portal entry for air power, distinct from transport',
      'drive-outlet': 'air reaches the lift motor around the service bulkhead',
      'source-carriage': 'retained height becomes a new source; no free stair',
      'shared-drop': 'same safe well receives low freight and high player falls',
      'freight-out': 'horizontal low route delivers the free load through a visible narrow throat',
      'rising-out': 'an inclined exit turns fall energy upward over the loaded guard housing',
      'freight-cradle': 'real load holds the guard; later its floor becomes the return entry',
      'receiving-return': 'new face available only after reaching the permanent receiving niche',
    },
    deductions: ['height and orientation are independent', 'the low throat fits free cargo, not a carried pair',
      'parking the load changes a real obstruction rather than a progression flag',
      'gravity lands the rising traveller behind the bulkhead', 'standing on permanent support frees the shared portals and load'],
    stableCargoPockets: ['freight-cradle'],
    inclineNormal: slope.getFrame().normal.toArray(),
  };
  return level;
}
