import * as THREE from 'three';
import { addRoom21Art } from './LabRoom21Art.js';
import { Workshop } from './LabWorkshopKit.js';
import { cargoLoadsPlate } from './LabPlateContact.js';
import { addRoom21SourceDrive } from './LabRoom21SourceDrive.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const ROOM21_SPEC = {
  id: 'gravity-pocket', title: 'Гравитационный карман',
  concept: 'Две независимые подготовки освобождают общую шахту для двух разных траекторий и возвращения с грузом',
  description: 'Одна шахта, два перелёта. Подготовь высоту и грузовую ветвь, затем вернись за другом.',
  hints: ['Высота и направление решают разные задачи. Нижний обход возвращает к новой попытке.',
    'Низкий проём пропускает свободный груз. Его вес убирает верхнюю защитную створку, но не создаёт импульс.',
    'Поток поднимает переход к верхнему источнику, фиксатор удерживает его без питания. Отправь друга в низкий грузовой карман; с приёмной галереи открой второе направление, забери друга и повторно используй шахту.'],
  accent: 0x91cfca, assets: [1, 2, 11, 23, 24, 31, 33, 35],
};

/** No progression flags, scripted launches or special traveller velocities.
 * The retained production gravity/portal/cargo solvers execute every transfer.
 * The loaded cradle operates an ordinary retracting guard, never a win latch. */
export function buildRoom21(game, index = 20) {
  const k = new Workshop(game, ROOM21_SPEC, index), w = k.world;
  w.highFidelity = true;
  k.bounds = { minX: -38, maxX: 40, minZ: -40, maxZ: 24 };
  k.ceiling = 34;
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
  deck('Continuous recovery court', -38, 40, -40, 24, 0);
  deck('Low freight balcony', -22, 3, 11.5, 22, 7);
  stairs('Recovery stair', -1.4, 1.4, 1, 11.5, 0, 7);
  // The western source is no longer a free staircase. Its first tread is
  // seven metres above the recovery court, separated by a 10 m service gap.
  // Redirected air lifts a real bridge. A visible top pawl retains that bridge
  // when the portal pair is reused for freight and both subsequent falls.
  deck('Western bridge landing', -37, -32, 11.5, 18, 7);
  stairs('West source stair', -36, -32, 11.5, -4.5, 7, 14);
  deck('Middle source gallery', -36, -28, -7, -4.5, 14);
  stairs('Returning upper stair', -32, -28, -4.5, 4.5, 14, 18);
  deck('Upper west return', -32, -28, 4.5, 12, 18);
  deck('High fall balcony', -32, -6.5, 11.5, 16, 18);
  const sourceDrive = addRoom21SourceDrive(k);
  // Guard outer edges, not the deliberately open freight/fall lips.
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
  // The structural metal tray is covered by a real protective roof. It is
  // deliberately not a white portal surface. Cargo lands below the throat lip
  // and stays accessible from the far-side service descent.
  deck('Permanent cargo pocket', 4.8, 16, 0, 9, 7.2);
  const seat = w.surface({ name: 'dark freight tray', position: [10.4, 7.38, 4.5],
    normal: [0, 1, 0], width: 11.2, height: 9, portal: false, authored: true, kind: 'floor' });
  seat.group.userData.keepMaterial = true; // Never dress the metal load tray as pale ceramic.
  const cradle = { surface: seat, position: V(10.4, 7.2, 4.5),
    loaded: () => cargoLoadsPlate(game.cargo, game.heldCube, seat.getFrame()) };
  k.pads.push(cradle); k.state.freightSeat = cradle;
  game.floors.push({ minX: 4.8, maxX: 16, minZ: 0, maxZ: 9, y: 7.38, mesh: seat.mesh, enabled: true });
  // Its entire visible top is structural graphite, not a ceramic portal plate.
  // Retrieval is from the service side after the first crossing, not a hidden
  // ban on a valid portal or a checklist at the finish.
  w.box([10.4, 10.25, 4.5], [11.2, .35, 9], w.materials.wall);
  w.box([9.75, 8.0, -.15], [12.5, 1.2, .3], w.materials.wall);
  w.box([9.75, 9.0, 9.15], [12.5, 3.2, .3], w.materials.wall);
  w.box([16.15, 9.0, .65], [.3, 3.2, 1.3], w.materials.wall);
  w.box([16.15, 9.0, 7.75], [.3, 3.2, 2.5], w.materials.wall);
  deck('Freight extraction landing', 16, 20.5, 2, 6, 7.38);
  stairs('Freight service descent', 17, 20.5, 4, -4, 7.38, 12);

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

  deck('High receiving niche', 5.8, 25, -24, -2, 12);
  for (const [x, width] of [[5.95, .3], [21.8, .3]])
    w.box([x, 12.65, -1.85], [width, 1.3, .3], w.materials.wall);
  // An intentional open inspection edge exposes the freight floor below.
  w.box([11.05, 12.04, -1.94], [9.9, .08, .12], w.materials.trim);
  w.box([12.9, 12.65, -18.15], [14.2, 1.3, .3], w.materials.wall);
  // The ceramic faces away from all departure galleries. Its solid back and
  // the permanent niche floor block premature shots from above and below.
  const finalDirection = V(.36, .78, -.51).normalize();
  const finalSlope = k.panel('second-rise', [14, 14.3, -10], finalDirection.toArray(), 6, 6);
  finalSlope.collider.frontPlane = () => finalSlope.getFrame();
  // The ceramic faces away from every starting gallery. The thick back is
  // structural and the whole white face is available from the service gallery.
  w.box([11.2, 13.7, -8], [.7, 3.4, 4.1], w.materials.trim);
  deck('Final high catch dock', 23, 39, -39, -26, 20);
  for (const [x,z,sx,sz] of [[23, -32.5,.24,13],[39,-32.5,.24,13],[31,-39,16,.24]])
    w.box([x,20.8,z],[sx,1.6,sz],w.materials.wall);
  // The far dock is a separate arrival: reaching the first niche is not victory.
  // The same well must be used again after physically recovering the companion.


  const authoredArt = addRoom21Art(k, gate);
  const level = k.finish([0, 7, 12.8], [-2, 7.55, 15], [32, 20, -34], {
    authoredArt, sourceDrive, workshop: k, spec: ROOM21_SPEC, portalPuzzle: true,
    playerAcceleration: (p,v) => sourceDrive.fan.acceleration(p.clone().add(V(0,1.2,0)),v),
  });
  level.spawnView = { yaw: -.60, pitch: .08 };
  level.conceptLesson = { position: [0, 7, 15], range: 8, key: '↗',
    text: 'Высота даёт скорость, поверхность меняет её направление. Нижний обход возвращает к новой попытке.' };
  level.puzzleGeometry = {
    footprint: 78 * 64, safeFloor: 0, freightHeight: 7, dropHeight: 18, goalHeight: 20,
    orders: ['cargo-first', 'source-first'], noProgressFlags: true,
    cargoWindow: { x: [3.675, 4.325], z: [0, 6], minY: 7.4, maxY: 9.5 },
    portalRoles: {
      'shared-drop': 'same safe well receives low freight and high player falls',
      'freight-out': 'horizontal low route delivers the free load through a visible narrow throat',
      'rising-out': 'an inclined exit turns fall energy upward over the loaded guard housing',
      'drive-intake': 'redirect air from the physical source into the bridge drive',
      'drive-out': 'air receiver powers a dockable bridge to the high source',
      'second-rise': 'service-side ceramic redirects the same fall toward the final upper dock',
    },
    deductions: ['height and orientation are independent', 'the low throat fits free cargo, not a carried pair',
      'traced airflow docks a bridge and the top pawl retains the high source',
      'the load opens a real obstruction but must leave with the player',
      'the service side reveals a second direction for the same shaft',
      'preparing the final pair before retrieving the load preserves the return route'],
    stableCargoPockets: ['dark freight tray'],
    inclineNormal: slope.getFrame().normal.toArray(),
  };
  return level;
}
