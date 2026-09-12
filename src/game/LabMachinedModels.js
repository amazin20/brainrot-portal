import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/*
 * Original, dimensioned laboratory mechanism masters. Metres, Y up, emitter +Z.
 * Only render geometry is authored here. The existing game owns every collider,
 * interaction point and moving surface. Static fittings are welded by material.
 * These builders are also the editable sources for public/models/art/*.glb.
 */
const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const CACHE = new Map();

function palette(accent) {
  return {
    ceramic: new THREE.MeshStandardMaterial({ name: 'Satin warm ceramic', color: 0xe4e5de, roughness: .32, metalness: .08 }),
    alloy: new THREE.MeshStandardMaterial({ name: 'Brushed titanium alloy', color: 0x88999e, roughness: .3, metalness: .74 }),
    graphite: new THREE.MeshStandardMaterial({ name: 'Graphite structural composite', color: 0x263039, roughness: .48, metalness: .32 }),
    signal: new THREE.MeshStandardMaterial({ name: 'Recessed signal glass', color: accent, emissive: accent, emissiveIntensity: .65, roughness: .23, metalness: .16 }),
  };
}

function createBatch(name, mats) {
  const bins = Object.fromEntries(Object.keys(mats).map(key => [key, []]));
  return {
    add(geometry, material, position = [0, 0, 0], rotation = [0, 0, 0]) {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation));
      geometry.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...position), q, new THREE.Vector3(1, 1, 1)));
      const expanded = geometry.index ? geometry.toNonIndexed() : geometry;
      expanded.deleteAttribute('uv');
      // Export has no texture dependency; delete unused attributes before welding.
      if (expanded !== geometry) geometry.dispose();
      bins[material].push(expanded);
    },
    finish() {
      const group = new THREE.Group(); group.name = name; group.userData.visualOnly = true;
      for (const [key, geometries] of Object.entries(bins)) {
        if (!geometries.length) continue;
        const merged = mergeGeometries(geometries, false);
        const welded = mergeVertices(merged, 1e-6);
        removeCollapsedFaces(welded);
        welded.computeBoundingBox(); welded.computeBoundingSphere();
        const mesh = new THREE.Mesh(welded, mats[key]);
        mesh.name = `${name} / ${key}`; mesh.receiveShadow = true; mesh.castShadow = false;
        mesh.userData.visualOnly = true; group.add(mesh);
        merged.dispose(); geometries.forEach(geo => geo.dispose());
      }
      return group;
    },
  };
}

// Lathed poles share coincident vertices. Drop the zero-area end cells instead
// of retaining degenerate triangles in the exported mesh.
function removeCollapsedFaces(geometry) {
  const p = geometry.attributes.position, indices = geometry.index.array, kept = [];
  const a = new THREE.Vector3(), ab = new THREE.Vector3(), ac = new THREE.Vector3();
  for (let i = 0; i < indices.length; i += 3) {
    a.fromBufferAttribute(p, indices[i]);
    ab.fromBufferAttribute(p, indices[i + 1]).sub(a);
    ac.fromBufferAttribute(p, indices[i + 2]).sub(a);
    if (ab.cross(ac).lengthSq() > 1e-18) kept.push(indices[i], indices[i + 1], indices[i + 2]);
  }
  geometry.setIndex(kept);
}

// Closed radial section; small changes in radius are real machined bevels.
function turned(profile, segments = 64) {
  const points = profile.map(([r, z]) => new THREE.Vector2(r, z));
  if (!points[0].equals(points.at(-1))) points.push(points[0].clone());
  return new THREE.LatheGeometry(points, segments).rotateX(Math.PI / 2);
}

function annulus(outer, inner, depth, bevel = .02, segments = 64) {
  const b = Math.min(bevel, depth * .3, (outer - inner) * .3);
  return turned([[inner, -depth / 2 + b], [inner + b, -depth / 2], [outer - b, -depth / 2],
    [outer, -depth / 2 + b], [outer, depth / 2 - b], [outer - b, depth / 2],
    [inner + b, depth / 2], [inner, depth / 2 - b]], segments);
}

function plate(points, depth = .1, bevel = .02, holes = []) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const hole of holes) shape.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y))));
  const geo = new THREE.ExtrudeGeometry(shape, { depth, steps: 1, bevelEnabled: bevel > 0,
    bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 4 });
  return geo.translate(0, 0, -depth / 2);
}

function bevelPanel(width, height, depth, corner = .06, bevel = .018) {
  const x = width / 2, y = height / 2, c = Math.min(corner, x * .35, y * .35);
  return plate([[-x + c, -y], [x - c, -y], [x, -y + c], [x, y - c],
    [x - c, y], [-x + c, y], [-x, y - c], [-x, -y + c]], depth, bevel);
}

function cylinder(radius, depth, sides = 20) {
  return new THREE.CylinderGeometry(radius, radius, depth, sides).rotateX(Math.PI / 2);
}

function fastener(batch, x, y, z, radius = .037) {
  batch.add(annulus(radius * 1.26, radius * .65, .014, .003, 12), 'alloy', [x, y, z]);
  batch.add(cylinder(radius, .026, 6), 'graphite', [x, y, z + .009]);
}

function radialFasteners(batch, radius, z, count = 8, phase = 0, size = .033) {
  for (let i = 0; i < count; i++) {
    const a = i / count * TAU + phase;
    fastener(batch, Math.cos(a) * radius, Math.sin(a) * radius, z, size);
  }
}

function beam(batch, start, end, radius, material) {
  const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end), length = a.distanceTo(b);
  const geo = new THREE.CylinderGeometry(radius, radius, length, 8);
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, b.clone().sub(a).normalize()));
  batch.add(geo, material, a.add(b).multiplyScalar(.5).toArray());
}

function metadata(root, type, options) {
  root.userData = { ...root.userData, visualOnly: true, authoredAsset: type, revision: 1,
    source: 'src/game/LabMachinedModels.js', units: 'metres', upAxis: '+Y', forwardAxis: '+Z', options };
  return root;
}

function cached(key, make) {
  if (!CACHE.has(key)) CACHE.set(key, make());
  // Geometry and materials are immutable and shared between repeated machines.
  return CACHE.get(key).clone(true);
}

export function createMachinedProjector({ radius = 1.15, accent = 0x7ee9ef } = {}) {
  const root = cached(`projector:${accent}`, () => {
    const mats = palette(accent), b = createBatch('Hard-light projector • six-jaw collimator', mats);
    b.add(turned([[.52, -.65], [.84, -.65], [.96, -.52], [1.015, -.35], [1.015, -.13],
      [.99, -.075], [.925, -.045], [.82, -.12], [.72, -.2], [.52, -.27]], 64), 'graphite');
    // Broad ceramic shell has a rolled lip and a genuine recessed optical throat.
    b.add(turned([[.81, -.32], [.895, -.56], [.955, -.54], [1.055, -.38], [1.072, -.2],
      [1.052, -.065], [1.015, -.005], [.95, .028], [.875, -.015], [.835, -.09]], 64), 'ceramic');
    b.add(annulus(.873, .76, .11, .025), 'alloy', [0, 0, -.025]);
    b.add(annulus(.758, .708, .022, .005), 'signal', [0, 0, -.027]);
    b.add(annulus(.706, .574, .055, .012), 'graphite', [0, 0, -.06]);
    b.add(annulus(.58, .525, .04, .01), 'alloy', [0, 0, -.09]);
    b.add(cylinder(.515, .032, 48), 'graphite', [0, 0, -.142]);
    b.add(cylinder(.235, .018, 40), 'signal', [0, 0, -.12]);
    b.add(annulus(.25, .23, .028, .004, 40), 'alloy', [0, 0, -.12]);
    // Six shaped overlapping iris leaves, inset behind the protective rim.
    const leaf = [[.26, -.016], [.40, -.10], [.565, -.072], [.554, .11], [.425, .24], [.285, .125]];
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU;
      b.add(plate(leaf, .018, .006), 'alloy', [0, 0, -.107], [0, 0, a]);
      b.add(plate([[.845, -.11], [1.08, -.09], [1.13, -.055], [1.12, .06], [1.02, .12], [.87, .1]], .095, .018),
        'alloy', [0, 0, -.09], [0, 0, a]);
      b.add(bevelPanel(.13, .045, .018, .018, .005), 'signal', [Math.cos(a) * 1.003, Math.sin(a) * 1.003, -.022], [0, 0, a]);
      fastener(b, Math.cos(a) * .946, Math.sin(a) * .946, .012, .036);
    }
    // Rear cooling channels and bolted mounting flange are visible from side views.
    b.add(annulus(.9, .50, .075, .018, 48), 'alloy', [0, 0, -.615]);
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * TAU;
      b.add(bevelPanel(.105, .038, .23, .009, .007), 'graphite', [Math.cos(a) * .982, Math.sin(a) * .982, -.405], [0, 0, a]);
    }
    radialFasteners(b, .81, -.659, 6, Math.PI / 6);
    return metadata(b.finish(), 'hard-light-projector', { radius: 1 });
  });
  root.scale.setScalar(radius); root.userData.options = { radius, accent }; return root;
}

export function createMachinedTurbine({ radius = 2.15, accent = 0x7edee8 } = {}) {
  const root = cached(`turbine:${accent}`, () => {
    const mats = palette(accent), b = createBatch('Transfer-field turbine • duct and stator', mats);
    b.add(turned([[.78, -.55], [1.02, -.55], [1.07, -.45], [1.09, -.24], [1.06, -.035],
      [1.005, .025], [.87, .025], [.79, -.065]], 64), 'graphite');
    b.add(turned([[.864, -.18], [.915, -.42], [1.025, -.42], [1.093, -.3], [1.114, -.14],
      [1.094, -.02], [1.055, .055], [.995, .084], [.924, .073], [.871, .025]], 64), 'ceramic');
    b.add(annulus(.89, .813, .072, .018), 'alloy', [0, 0, -.055]);
    b.add(annulus(.814, .793, .025, .006), 'signal', [0, 0, -.02]);
    b.add(annulus(1.046, .88, .062, .013), 'alloy', [0, 0, -.47]);
    b.add(annulus(.82, .765, .33, .015), 'graphite', [0, 0, -.26]);
    // Twelve stationary guide vanes connect the duct to its rear bearing block.
    const stator = [[.22, -.04], [.745, -.11], [.785, -.045], [.754, .024], [.24, .034]];
    for (let i = 0; i < 12; i++) b.add(plate(stator, .028, .007), 'graphite', [0, 0, -.36], [0, 0, i / 12 * TAU]);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU;
      b.add(plate([[.98, -.072], [1.16, -.056], [1.18, -.016], [1.165, .056], [.985, .083]], .20, .014),
        'alloy', [0, 0, -.22], [0, 0, a]);
      b.add(bevelPanel(.09, .047, .023, .012, .005), 'signal', [Math.cos(a) * 1.064, Math.sin(a) * 1.064, -.101], [0, 0, a]);
      fastener(b, Math.cos(a) * .968, Math.sin(a) * .968, .088, .031);
    }
    radialFasteners(b, .968, -.51, 8, Math.PI / 8, .029);
    const group = b.finish();
    const rotor = createBatch('transfer-rotor', mats);
    // Each rotor blade is a closed, twisted airfoil, not a rotated rectangular bar.
    for (let i = 0; i < 9; i++) rotor.add(turbineBlade(), 'alloy', [0, 0, -.13], [0, 0, i / 9 * TAU]);
    rotor.add(turned([[0, -.19], [.225, -.19], [.242, -.15], [.244, -.075], [.227, .045],
      [.181, .13], [.108, .198], [.042, .224], [0, .226]], 40), 'alloy', [0, 0, -.10]);
    rotor.add(annulus(.244, .216, .06, .009, 40), 'graphite', [0, 0, -.2]);
    group.add(rotor.finish());
    return metadata(group, 'transfer-field-turbine', { radius: 1, rotorNode: 'transfer-rotor', rotorAxis: '+Z' });
  });
  root.scale.setScalar(radius); root.userData.options = { radius, accent, rotorNode: 'transfer-rotor' }; return root;
}

function turbineBlade() {
  const positions = [], indices = [], rows = 7, columns = 6;
  // The leading edge sweeps back while pitch relaxes toward the outer shroud.
  for (let side = 0; side < 2; side++) for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
    const t = row / rows, u = column / columns, r = .208 + t * .556;
    const chord = .125 + Math.sin(t * Math.PI * .72) * .135;
    const sweep = -.03 - .15 * t * t;
    const pitch = .40 - .23 * t;
    const y = sweep + (u - .5) * chord;
    const z = (u - .5) * pitch + Math.sin(u * Math.PI) * .037 + (side ? -.012 : .012);
    positions.push(r, y, z);
  }
  const stride = columns + 1, layer = (rows + 1) * stride;
  for (let side = 0; side < 2; side++) for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const a = side * layer + row * stride + col, b = a + stride;
    if (side === 0) indices.push(a, b, a + 1, b, b + 1, a + 1);
    else indices.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const perimeter = [];
  for (let r = 0; r <= rows; r++) perimeter.push(r * stride);
  for (let c = 1; c <= columns; c++) perimeter.push(rows * stride + c);
  for (let r = rows - 1; r >= 0; r--) perimeter.push(r * stride + columns);
  for (let c = columns - 1; c > 0; c--) perimeter.push(c);
  for (let i = 0; i < perimeter.length; i++) {
    const a = perimeter[i], b = perimeter[(i + 1) % perimeter.length];
    indices.push(a, a + layer, b, b, a + layer, b + layer);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices); geo.computeVertexNormals(); return geo;
}

export function createMachinedChassis({ width = 4, depth = 4, height = .75, y = -.42, accent = 0x7edee8 } = {}) {
  const key = `chassis:${width}:${depth}:${height}:${accent}`;
  const root = cached(key, () => {
    const mats = palette(accent), b = createBatch('Lift chassis • perforated load frame', mats);
    const x = width / 2 - .22, z = depth / 2 - .22, h = height / 2;
    function rail(length) {
      const l = length / 2;
      const outer = [[-l + .12, -h], [l - .12, -h], [l, -h + .13], [l, h - .10], [l - .10, h],
        [-l + .10, h], [-l, h - .10], [-l, -h + .13]];
      const holes = [], count = Math.max(2, Math.floor(length / .65));
      const cell = (length - .6) / count;
      for (let i = 0; i < count; i++) {
        const cx = -length / 2 + .3 + cell * (i + .5), w = cell * .67, hh = height * .18;
        holes.push([[cx - w / 2, -hh], [cx - w / 2 + .08, hh], [cx + w / 2, hh], [cx + w / 2 - .08, -hh]]);
      }
      return plate(outer, .11, .018, holes);
    }
    for (const sign of [-1, 1]) {
      b.add(rail(width - .4), 'alloy', [0, 0, sign * z]);
      b.add(rail(depth - .4), 'alloy', [sign * x, 0, 0], [0, Math.PI / 2, 0]);
      b.add(bevelPanel(width - .58, .11, .16, .025, .014), 'graphite', [0, -h + .02, sign * z]);
      b.add(bevelPanel(depth - .58, .11, .16, .025, .014), 'graphite', [sign * x, -h + .02, 0], [0, Math.PI / 2, 0]);
      b.add(bevelPanel(Math.min(1.2, width * .34), .08, .035, .027, .006), 'signal', [0, h - .08, sign * (z + .085)]);
    }
    // Shaped corner saddles join upper ceramic deck to four isolation cartridges.
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const cx = sx * (x - .10), cz = sz * (z - .10);
      b.add(bevelPanel(.59, .47, .15, .1, .025), 'ceramic', [cx, h - .105, cz], [-Math.PI / 2, 0, 0]);
      b.add(turned([[.067, -.25], [.125, -.25], [.16, -.20], [.16, -.105], [.135, -.076], [.115, .02],
        [.15, .04], [.15, .092], [.068, .092]], 20), 'alloy', [cx, .02, cz], [-Math.PI / 2, 0, 0]);
      b.add(annulus(.155, .126, .095, .01, 20), 'graphite', [cx, -.13, cz], [Math.PI / 2, 0, 0]);
      b.add(cylinder(.069, height * .71, 16), 'graphite', [cx, 0, cz], [Math.PI / 2, 0, 0]);
      for (const dx of [-.16, .16]) b.add(cylinder(.038, .02, 6), 'graphite', [cx + dx, h - .016, cz], [Math.PI / 2, 0, 0]);
    }
    beam(b, [-x + .3, -h + .07, -z + .3], [x - .3, -h + .07, z - .3], .063, 'graphite');
    beam(b, [-x + .3, -h + .09, z - .3], [x - .3, -h + .09, -z + .3], .063, 'graphite');
    b.add(bevelPanel(.62, .46, .17, .08, .02), 'ceramic', [0, -h + .08, 0], [Math.PI / 2, 0, 0]);
    return metadata(b.finish(), 'lift-pressure-chassis', { width, depth, height, y: 0 });
  });
  root.position.y = y; root.userData.options = { width, depth, height, y, accent }; return root;
}

export function createMachinedGimbal({ accent = 0xffc879 } = {}) {
  return cached(`gimbal:${accent}`, () => {
    const mats = palette(accent), b = createBatch('optical-cradle', mats), ring = createBatch('optical-ring', mats);
    // 1.66 m clear bore preserves the existing 2.4 x 2.2 m mirror corners.
    // The bearing is vertical: the existing optical controller rotates about Y.
    ring.add(annulus(1.94, 1.76, .20, .038, 72), 'alloy');
    ring.add(annulus(1.755, 1.671, .11, .022, 64), 'graphite', [0, 0, .012]);
    ring.add(annulus(1.682, 1.66, .025, .006, 64), 'signal', [0, 0, .074]);
    radialFasteners(ring, 1.847, .113, 12, Math.PI / 12, .034);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const a = Math.atan2(sy * 1.2, sx * 1.1);
      ring.add(plate([[1.586, -.044], [1.79, -.055], [1.82, .045], [1.591, .046]], .08, .011),
        'alloy', [0, 0, .075], [0, 0, a]);
    }
    ring.add(turned([[.10, -.12], [.19, -.12], [.21, -.075], [.21, .16], [.16, .20], [.10, .20]], 28),
      'alloy', [0, -1.995, 0], [-Math.PI / 2, 0, 0]);
    b.add(turned([[.10, -.14], [.31, -.14], [.38, -.075], [.38, .12], [.29, .18], [.10, .18]], 36),
      'graphite', [0, -2.20, 0], [-Math.PI / 2, 0, 0]);
    b.add(annulus(.37, .29, .07, .014, 32), 'alloy', [0, -2.06, 0], [Math.PI / 2, 0, 0]);
    b.add(bevelPanel(3.35, .26, .88, .095, .036), 'ceramic', [0, -2.45, 0]);
    b.add(bevelPanel(1.02, .12, .78, .085, .025), 'alloy', [0, -2.285, 0]);
    for (const sign of [-1, 1]) {
      b.add(bevelPanel(.46, .14, 1.16, .065, .025), 'graphite', [sign * 1.30, -2.64, 0]);
      b.add(bevelPanel(.67, .075, .035, .025, .008), 'signal', [sign * 1.075, -2.45, .484]);
      for (const z of [-.32, .32]) b.add(cylinder(.065, .025, 6), 'graphite', [sign * 1.34, -2.298, z], [Math.PI / 2, 0, 0]);
    }
    const group = new THREE.Group(); group.name = 'Optical gimbal • vertical-axis bearing cradle';
    group.add(b.finish(), ring.finish());
    return metadata(group, 'optical-trunnion-gimbal', { accent, ringNode: 'optical-ring', cradleNode: 'optical-cradle', ringAxis: '+Y', clearBore: 3.32 });
  });
}
