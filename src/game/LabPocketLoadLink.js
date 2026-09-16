import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const V = p => new THREE.Vector3(...p);
export const LOAD_LINK_MOUNTS = Object.freeze({
  // Both instruments bolt onto existing solid casing, outside every portal face.
  sender: Object.freeze([5.10, 8.65, 6]),
  receiver: Object.freeze([-7.3, 14, -.99]),
});

/** Visual cable-operated load indication for the existing reduced actuator.
 * It reads contact; it NEVER drives the cassette, floor, cargo or portal state.
 * Two mechanical pointers and one continuous sheathed cable explain the link.
 * This is a presentation of a load command, not a new hydraulic/energy solver. */
export function createPocketLoadLinkModel() {
  const root = new THREE.Group(); root.name = 'Receiver to cassette / load linkage';
  root.userData.keepMaterial = true;
  root.userData.source = 'src/game/LabPocketLoadLink.js';
  const materials = {
    body: new THREE.MeshStandardMaterial({ name: 'Load link graphite enamel', color: 0x30494e, metalness: .30, roughness: .46 }),
    steel: new THREE.MeshStandardMaterial({ name: 'Load link machined alloy', color: 0xb2beb5, metalness: .66, roughness: .35 }),
    signal: new THREE.MeshStandardMaterial({ name: 'Load link brass markers', color: 0xdab76b, metalness: .44, roughness: .40 }),
  };
  const fixed = new Map(Object.values(materials).map(m => [m, []]));
  const unit = new THREE.Vector3(1, 1, 1), matrix = new THREE.Matrix4();
  function bake(geometry, material, position, rotation = [0, 0, 0], parent = null) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation));
    matrix.compose(V(position), q, unit);
    if (parent) { parent.updateMatrixWorld(true); matrix.premultiply(parent.matrixWorld); }
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g !== geometry) geometry.dispose();
    g.applyMatrix4(matrix); fixed.get(material).push(g);
  }
  const box = (size, pos, mat, parent, rotation) => bake(
    new RoundedBoxGeometry(...size, 1, Math.min(.065, ...size.map(s => s * .2))), mat, pos, rotation, parent);
  const pin = (radius, depth, pos, mat, parent) => bake(
    new THREE.CylinderGeometry(radius, radius, depth, 16), mat, pos, [Math.PI / 2, 0, 0], parent);
  const pointers = [], mounts = [];
  function instrument(name, position, yaw) {
    const mount = new THREE.Group(); mount.position.fromArray(position); mount.rotation.y = yaw;
    mount.name = name; root.add(mount); mounts.push(mount);
    box([2.35, 2.05, .16], [0, 0, .04], materials.steel, mount);
    box([2.12, 1.83, .18], [0, 0, .17], materials.body, mount);
    // Raised weight-and-support pictogram: readable by silhouette, not colour.
    const icon = new THREE.Shape(); icon.moveTo(-.86, -.12); icon.lineTo(-.72, .28);
    icon.lineTo(-.36, .28); icon.lineTo(-.23, -.12); icon.closePath();
    bake(new THREE.ExtrudeGeometry(icon, { depth: .045, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: .018, bevelThickness: .01 }),
      materials.steel, [0, 0, .29], [0, 0, 0], mount);
    bake(new THREE.TorusGeometry(.085, .026, 6, 16), materials.steel, [-.54, .33, .315], [0, 0, 0], mount);
    box([.83, .08, .05], [-.54, -.25, .30], materials.steel, mount);
    for (const x of [-.84, -.24]) box([.08, .14, .05], [x, -.32, .30], materials.steel, mount);
    // Broad arc with physical end marks; the pointer sweeps 100 degrees.
    bake(new THREE.TorusGeometry(.63, .034, 6, 32, Math.PI * .62), materials.steel,
      [.40, -.38, .30], [0, 0, Math.PI * .19], mount);
    for (const angle of [-.87, 0, .87]) {
      box([.05, .13, .04], [.40 + Math.sin(angle) * .67, -.38 + Math.cos(angle) * .67, .33],
        materials.signal, mount, [0, 0, -angle]);
    }
    for (const x of [-1.02, 1.02]) for (const y of [-.88, .88]) pin(.068, .06, [x, y, .15], materials.steel, mount);
    pin(.15, .1, [.40, -.38, .34], materials.steel, mount);
    const pivot = new THREE.Group(); pivot.name = name + ' / contact pointer'; pivot.position.set(.40, -.38, .38); mount.add(pivot);
    const needleShape = new THREE.Shape(); needleShape.moveTo(-.08, -.1); needleShape.lineTo(-.07, .45);
    needleShape.lineTo(0, .59); needleShape.lineTo(.07, .45); needleShape.lineTo(.08, -.1); needleShape.closePath();
    const pointer = new THREE.Mesh(new THREE.ExtrudeGeometry(needleShape, { depth: .035, bevelEnabled: false }), materials.signal);
    pointer.castShadow = false; pivot.add(pointer); pointers.push(pivot);
    // Ferrule and fixed sleeve connect the instrument to the cable above it.
    bake(new THREE.CylinderGeometry(.105, .105, .30, 16), materials.steel, [0, 1.1, .10], [0, 0, 0], mount);
    return mount;
  }
  instrument('Receiver load sender', LOAD_LINK_MOUNTS.sender, -Math.PI / 2);
  instrument('Cassette load follower', LOAD_LINK_MOUNTS.receiver, 0);
  const controlCable = new THREE.CatmullRomCurve3([
    V([5, 9.90, 6]), V([5, 12.5, 6]), V([5, 15.45, 6]), V([3.9, 15.6, 5.65]),
    V([.1, 14.35, 3.85]), V([-4.9, 14.2, 1.05]), V([-7.3, 15.2, -.89]), V([-7.3, 15.1, -.89]),
  ], false, 'centripetal');
  bake(new THREE.TubeGeometry(controlCable, 80, .065, 8, false), materials.body, [0, 0, 0]);
  // The vertical run is clamped to the receiver's existing wall. The single
  // suspended span stays above the departure and outside both flight windows.
  for (const y of [10.4, 12.6, 14.8]) {
    box([.13, .18, .40], [5.095, y, 6], materials.steel);
    pin(.12, .10, [5, y, 6.1], materials.signal);
  }
  for (const [material, parts] of fixed) {
    const geometry = mergeGeometries(parts);
    if (!geometry) throw new Error('Load linkage geometry could not be batched');
    parts.forEach(p => p.dispose()); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material); mesh.name = material.name + ' / batched';
    mesh.receiveShadow = true; mesh.castShadow = false; root.add(mesh);
  }
  const set = value => {
    if (!Number.isFinite(value) || value < 0 || value > 1) throw new RangeError('Load indication must be in [0,1]');
    for (const pointer of pointers) pointer.rotation.z = .87 - 1.74 * value;
  };
  set(0); root.updateMatrixWorld(true);
  return { root, pointers, mounts, set, cable: controlCable };
}

/** Owned by the room lifecycle. No listeners, textures, clocks or colliders. */
export function attachPocketLoadLink(k, seat) {
  const model = createPocketLoadLinkModel(); k.world.root.add(model.root);
  let previous = 0, current = 0;
  const state = { ...model, loaded: false, value: 0,
    tick(dt) {
      if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Nonnegative finite step required');
      previous = current; state.loaded = Boolean(seat.loaded());
      current = THREE.MathUtils.damp(current, Number(state.loaded), 12, dt);
      state.value = current;
    },
    render(alpha = 1) {
      if (!Number.isFinite(alpha)) throw new TypeError('Finite interpolation required');
      model.set(THREE.MathUtils.lerp(previous, current, THREE.MathUtils.clamp(alpha, 0, 1)));
    },
    reset() { previous = current = state.value = 0; state.loaded = false; model.set(0); },
  };
  k.ticks.push(state.tick); k.renders.push(state.render); k.resets.push(state.reset);
  k.state.loadLink = state; return state;
}
