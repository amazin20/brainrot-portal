import * as THREE from 'three';

const V = (...v) => new THREE.Vector3(...v);
const clamp = THREE.MathUtils.clamp;

/** All dimensions are metres, relative to the axle. The two broad end decks
 * have a genuine narrow connecting spine; collider specs describe the same
 * visible pieces, with no extra floor spanning the open sides of the axle. */
export const BALANCE_RIG_LAYOUT = Object.freeze({
  length: 8.8, width: 3.6, deckTop: .15, deckThickness: .24,
  pivotHeight: 2.1, maxAngle: .38,
  deckEnds: Object.freeze([-2.4, 2.4]), endLength: 4.0, spineWidth: 1.2, spineLength: .8,
  counterweight: Object.freeze({ x: 2.15, y: -.64, minZ: -2.8, maxZ: -1.2, mass: 2.5 }),
});

// A small chamfer catches room lighting without a texture or a stack of
// almost-coplanar boxes. Shape is in X/Y, extrusion is Z, then centred.
function bevelBox(width, height, depth, radius = .035) {
  const r = Math.min(radius, width / 5, height / 5, depth / 5);
  const x = width / 2 - r, y = height / 2 - r;
  const shape = new THREE.Shape();
  shape.moveTo(-x, -y); shape.lineTo(x, -y); shape.lineTo(x, y); shape.lineTo(-x, y); shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: depth - 2 * r, bevelEnabled: true, bevelSegments: 1,
    steps: 1, bevelSize: r, bevelThickness: r, curveSegments: 1,
  });
  geometry.translate(0, 0, -depth / 2 + r);
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

/** Code-native replacement for the broken scanned balance model. Geometry
 * owns presentation only. A caller supplies fixed-step physics and drives the
 * angle/counterweight; no clocks, actor movement or collider registration are
 * hidden here. Root position is the axle, and feet touch world-local floor 0.
 * All moving specs are in `moving` local space; fixedSupportBoxes are world
 * AABBs sampled from individual feet, A-frame legs, bearings and end stops.
 */
export function buildBalanceRig(parent, { position = [0, 2.1, 0] } = {}) {
  if (!Array.isArray(position) || position.length !== 3 || !position.every(Number.isFinite) || position[1] < 1.95)
    throw new RangeError('Balance axle must have enough height for its full travel');
  const root = new THREE.Group(); root.name = 'Inertial balance rocker'; root.position.fromArray(position); parent.add(root);
  const fixed = new THREE.Group(); fixed.name = 'Grounded A frames and stationary bearings';
  const moving = new THREE.Group(); moving.name = 'Rigid two-pad rocker and axle';
  root.add(fixed, moving);
  const materials = {
    shell: new THREE.MeshStandardMaterial({ color: 0xdadbd0, metalness: .28, roughness: .43 }),
    graphite: new THREE.MeshStandardMaterial({ color: 0x36434b, metalness: .48, roughness: .39 }),
    deck: new THREE.MeshStandardMaterial({ color: 0x68797c, metalness: .25, roughness: .53 }),
    mint: new THREE.MeshStandardMaterial({ color: 0x96bdb1, metalness: .28, roughness: .4 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc5a667, metalness: .66, roughness: .35 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x7c898e, metalness: .72, roughness: .3 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x253034, metalness: .03, roughness: .85 }),
  };
  const supportMeshes = [], movingCollisionParts = [], deckSurfaces = [];
  const boxCache = new Map(), cylinderCache = new Map();
  function add(group, name, geometry, material, center = [0, 0, 0]) {
    const mesh = new THREE.Mesh(geometry, materials[material]); mesh.name = name;
    mesh.position.fromArray(center); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); return mesh;
  }
  function box(group, name, size, center, material, chamfer = .035) {
    const key = [...size, chamfer].join(',');
    if (!boxCache.has(key)) boxCache.set(key, bevelBox(...size, chamfer));
    return add(group, name, boxCache.get(key), material, center);
  }
  function cylinder(group, name, radius, length, center, material, axis = 'y', sides = 16) {
    const key = [radius, length, sides].join(',');
    if (!cylinderCache.has(key)) cylinderCache.set(key, new THREE.CylinderGeometry(radius, radius, length, sides));
    const mesh = add(group, name, cylinderCache.get(key), material, center);
    if (axis === 'x') mesh.rotation.z = Math.PI / 2;
    if (axis === 'z') mesh.rotation.x = Math.PI / 2;
    return mesh;
  }
  function strut(group, name, from, to, width, depth, material) {
    const a = V(...from), b = V(...to), delta = b.clone().sub(a);
    const mesh = box(group, name, [width, delta.length(), depth], a.clone().add(b).multiplyScalar(.5).toArray(), material, .045);
    mesh.quaternion.setFromUnitVectors(V(0, 1, 0), delta.normalize()); return mesh;
  }
  function collider(mesh, size, center = mesh.position.toArray(), rotationX = 0) {
    const spec = { mesh, center: V(...center), size: V(...size), rotationX };
    movingCollisionParts.push(spec); return spec;
  }
  function bolt(group, center, axis = 'y') {
    return cylinder(group, 'Recessed hex fastener', .058, .036, center, 'steel', axis, 6);
  }

  // Broad load trays and an actual 1.2 m spine. The portal ceramic surfaces
  // belong to the room; these deck bodies terminate below them at y=.15.
  for (const z of BALANCE_RIG_LAYOUT.deckEnds) {
    const size = [3.6, .24, 4.0], center = [0, .03, z];
    const mesh = box(moving, z > 0 ? 'Receiving load tray' : 'Approach load tray', size, center, 'deck', .04);
    const spec = collider(mesh, size); deckSurfaces.push(spec);
    for (const x of [-1.76, 1.76]) {
      box(moving, 'Tray protective edge', [.09, .2, 3.98], [x, -.015, z], 'shell', .02);
      for (const end of [-1.84, 1.84]) {
        box(moving, 'Tray corner guard', [.23, .28, .26], [x, .025, z + end], 'graphite', .03);
        bolt(moving, [x, .17, z + end]);
      }
    }
    for (const dz of [-1.95, 1.95]) box(moving, 'Tray end fascia', [3.42, .16, .09], [0, -.02, z + dz], 'shell', .018);
    // Two under-tray rails and real crossheads transmit its broad load into
    // the centre beam. All members remain rigid with the same rocker group.
    for (const x of [-1.18, 1.18]) box(moving, 'Load tray lower rail', [.2, .34, 3.84], [x, -.25, z], 'graphite');
    for (const dz of [-1.41, 1.41]) box(moving, 'Load tray crosshead', [2.58, .25, .2], [0, -.29, z + dz], 'graphite');
  }
  const spineSize = [1.2, .24, .8];
  const spine = box(moving, 'Narrow central walking spine', spineSize, [0, .03, 0], 'graphite', .028);
  deckSurfaces.push(collider(spine, spineSize));
  const beam = box(moving, 'Continuous structural box beam', [1.02, .44, 8.35], [0, -.31, 0], 'graphite', .055);
  collider(beam, [1.02, .44, 8.35]);
  // Side gussets tie shaft and box section without crossing the walk surface.
  for (const x of [-.54, .54]) {
    box(moving, 'Axle saddle side cheek', [.15, .5, .94], [x, -.20, 0], 'steel');
    for (const z of [-.3, .3]) bolt(moving, [x + Math.sign(x) * .083, -.2, z], 'x');
  }
  cylinder(moving, 'Single continuous load-bearing axle', .115, 4.55, [0, 0, 0], 'steel', 'x', 20);
  for (const sign of [-1, 1]) cylinder(moving, 'Axle retaining cap', .18, .09, [sign * 2.31, 0, 0], 'brass', 'x', 20);

  // Low receiving lips leave the entire walking spine, tray entrance and
  // portal aperture clear. They are genuine moving collision geometry.
  for (const x of [-1.77, 1.77]) {
    const size = [.06, .34, 2.5], center = [x, .30, 3.0];
    const lip = box(moving, 'Receiving tray low side lip', size, center, 'mint', .04);
    collider(lip, size);
  }
  const backLipSize = [3.6, .25, .14], backLipCenter = [0, .275, 4.33];
  const backLip = box(moving, 'Receiving tray low rear lip', backLipSize, backLipCenter, 'mint', .025);
  collider(backLip, backLipSize);

  // The open A-frame legs and feet are all outboard of the 3.6 m platforms.
  // Each leg gets a separate support box; nothing fills the axle's open span.
  const ground = -position[1], frameX = 2.18, footZ = 1.13;
  for (const sign of [-1, 1]) {
    const x = sign * frameX;
    for (const z of [-footZ, footZ]) {
      const foot = box(fixed, 'Grounded bearing foot', [.64, .17, .68], [x, ground + .085, z], 'graphite', .035);
      supportMeshes.push(foot);
      const leg = strut(fixed, 'A-frame bearing leg', [x, ground + .17, z], [x, -.04, 0], .31, .30, 'shell');
      supportMeshes.push(leg);
      for (const dz of [-.21, .21]) bolt(fixed, [x, ground + .19, z + dz]);
    }
    const tie = box(fixed, 'A-frame lower tie', [.28, .22, 1.4], [x, ground + .65, 0], 'shell');
    supportMeshes.push(tie);
    const collar = cylinder(fixed, 'Stationary bearing housing', .355, .29, [x, 0, 0], 'shell', 'x', 24);
    supportMeshes.push(collar);
    cylinder(fixed, 'Dark bearing seal', .27, .035, [x + sign * .162, 0, 0], 'rubber', 'x', 24);
    cylinder(fixed, 'Brass bearing race', .217, .05, [x + sign * .184, 0, 0], 'brass', 'x', 24);
    for (let i = 0; i < 4; i++) {
      const angle = Math.PI / 4 + i * Math.PI / 2;
      bolt(fixed, [x + sign * .165, .285 * Math.cos(angle), .285 * Math.sin(angle)], 'x');
    }
  }

  // Each coil has one anchored tail and one on the rocker. setAngle changes
  // twist along the coil continuously, without replacing GPU geometries.
  const coilUpdaters = [];
  for (const sign of [-1, 1]) {
    const segments = 60, sides = 6, turns = 4.5, radius = .182, wire = .019;
    const geometry = new THREE.BufferGeometry();
    const points = new Float32Array((segments + 1) * (sides + 1) * 3), normals = new Float32Array(points.length), indices = [];
    for (let i = 0; i < segments; i++) for (let j = 0; j < sides; j++) {
      const a = i * (sides + 1) + j, b = a + sides + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
    geometry.setIndex(indices);
    geometry.setAttribute('position', new THREE.BufferAttribute(points, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3).setUsage(THREE.DynamicDrawUsage));
    const coil = add(fixed, 'Working torsion spring', geometry, 'steel');
    const update = angle => {
      for (let i = 0; i <= segments; i++) {
        const t = i / segments, phi = turns * Math.PI * 2 * t + angle * t;
        const cx = sign * (2.005 - .23 * t), cy = radius * Math.cos(phi), cz = radius * Math.sin(phi);
        for (let j = 0; j <= sides; j++) {
          const theta = j / sides * Math.PI * 2, nx = Math.sin(theta), ny = Math.cos(theta) * Math.cos(phi), nz = Math.cos(theta) * Math.sin(phi);
          const index = (i * (sides + 1) + j) * 3;
          points[index] = cx + wire * nx; points[index + 1] = cy + wire * ny; points[index + 2] = cz + wire * nz;
          normals[index] = nx; normals[index + 1] = ny; normals[index + 2] = nz;
        }
      }
      geometry.attributes.position.needsUpdate = geometry.attributes.normal.needsUpdate = true;
    };
    update(0); geometry.computeBoundingSphere(); coilUpdaters.push(update);
    cylinder(fixed, 'Spring anchored tail', .02, .22, [sign * 2.005, .285, 0], 'steel');
    // 4.5 turns finish on the negative-Y side of the axle.
    cylinder(moving, 'Spring rocker tail', .02, .18, [sign * 1.775, -.26, 0], 'steel');
  }

  // Rubber stops sit under actual tray rails at the mechanical angle limit.
  // They neither float with the rocker nor enter the walkway above it.
  for (const z of [-3.78, 3.78]) for (const x of [-1.18, 1.18]) {
    const foot = box(fixed, 'End-stop floor shoe', [.36, .09, .42], [x, ground + .045, z], 'graphite', .015);
    const rubber = cylinder(fixed, 'Replaceable rubber end-stop', .115, .15, [x, ground + .165, z], 'rubber', 'y');
    supportMeshes.push(foot, rubber);
    bolt(fixed, [x, ground + .102, z + .155]);
  }

  // The counterweight is a real sliding assembly on twin rails. Root supplies
  // its position from the same state that contributes torque to the solver.
  const cw = BALANCE_RIG_LAYOUT.counterweight;
  for (const z of [-3.17, -.83]) {
    box(moving, 'Counterweight rail mounting arm', [.94, .15, .16], [1.72, -.20, z], 'graphite', .022);
    box(moving, 'Counterweight rail hanger', [.45, .52, .16], [cw.x, -.435, z], 'mint', .025);
  }
  for (const dx of [-.125, .125]) cylinder(moving, 'Counterweight guide rail', .042, 2.35, [cw.x + dx, cw.y, -2], 'brass', 'z', 12);
  const counterweight = new THREE.Group(); counterweight.name = 'Sliding 2.5 kg trim weight';
  counterweight.position.set(cw.x, cw.y, -2); moving.add(counterweight);
  box(counterweight, 'Trim-weight cast core', [.55, .5, .66], [0, 0, 0], 'graphite', .06);
  for (const z of [-.25, .25]) {
    box(counterweight, 'Trim-weight guide collar', [.57, .53, .11], [0, 0, z], 'mint', .024);
    for (const dx of [-.125, .125]) cylinder(counterweight, 'Rail sliding bush', .075, .1, [dx, 0, z], 'steel', 'z', 12);
  }
  // Its collider spec includes a reference to the moving subgroup: callers
  // can update local centre after setCounterweight without a phantom rail box.
  const weightSpec = { mesh: counterweight, center: counterweight.position.clone(), size: V(.57, .53, .76), rotationX: 0, dynamicCenter: true };
  movingCollisionParts.push(weightSpec);

  root.updateWorldMatrix(true, true);
  const fixedSupportBoxes = supportMeshes.map(mesh => new THREE.Box3().setFromObject(mesh));
  const item = { root, fixed, moving, deckSurfaces, fixedSupportBoxes, movingCollisionParts, counterweight,
    layout: BALANCE_RIG_LAYOUT, materials, angle: 0, counterweightZ: -2,
    role: 'Two load decks on a rigid rocker with grounded bearings, torsion springs and a sliding trim weight',
    setAngle(value) {
      const angle = clamp(Number.isFinite(value) ? value : 0, -.38, .38);
      moving.rotation.x = angle;
      for (const update of coilUpdaters) update(angle);
      item.angle = angle; moving.updateWorldMatrix(true, true); return angle;
    },
    setCounterweight(value) {
      const z = clamp(Number.isFinite(value) ? value : -2, cw.minZ, cw.maxZ);
      counterweight.position.z = z; weightSpec.center.copy(counterweight.position);
      item.counterweightZ = z; counterweight.updateWorldMatrix(true, true); return z;
    },
  };
  root.userData.gameplayRole = item.role;
  item.setAngle(0); item.setCounterweight(-2);
  return item;
}
