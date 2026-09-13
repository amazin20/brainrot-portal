import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/** Reproducible room-local hard-surface assembly. Only sibling visual groups
 * are animated: the guard collider and its original bounds are never expanded
 * by bevels, fasteners, rails or the rack-and-pinion dressing. */
export function addRoom21Art(kit, gate) {
  const root = new THREE.Group(); root.name = 'Gravity pocket · engineered guard and source supports';
  root.userData.visualOnly = true; kit.world.root.add(root);
  const shell = new THREE.MeshStandardMaterial({ color: 0x647e7a, metalness: .32, roughness: .55 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x879b9a, metalness: .7, roughness: .34 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x304d51, metalness: .4, roughness: .54 });
  const light = new THREE.MeshStandardMaterial({ color: 0xefd09b, emissive: 0xe6ba78, emissiveIntensity: .22, roughness: .6 });
  const unit = new RoundedBoxGeometry(1, 1, 1, 2, .06), m = new THREE.Matrix4(), q = new THREE.Quaternion();
  function batch(parent, entries, material, name) {
    const mesh = new THREE.InstancedMesh(unit, material, entries.length); mesh.name = name;
    entries.forEach(([p, s], i) => mesh.setMatrixAt(i, m.compose(new THREE.Vector3(...p), q, new THREE.Vector3(...s))));
    mesh.castShadow = false; mesh.receiveShadow = true; mesh.computeBoundingSphere(); parent.add(mesh); return mesh;
  }
  function rod(parent, a, b, radius, material = steel) {
    a = new THREE.Vector3(...a); b = new THREE.Vector3(...b);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, a.distanceTo(b), 12), material);
    mesh.position.copy(a).add(b).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    parent.add(mesh); return mesh;
  }
  const moving = new THREE.Group(); moving.name = 'Load-controlled safety shutter'; root.add(moving);
  const panels = [], seams = [], inlays = [];
  for (let row = 0; row < 6; row++) for (let col = 0; col < 6; col++) {
    panels.push([[0, -5.05 + row * 2.02, -5 + col * 2], [.40, 1.92, 1.90]]);
    if (col === 0 || col === 5) inlays.push([[.215, -5.05 + row * 2.02, -5 + col * 2], [.023, .055, .50]]);
  }
  for (const y of [-6.03, 6.03]) seams.push([[0, y, 0], [.45, .13, 12]]);
  for (const z of [-5.93, 5.93]) seams.push([[0, 0, z], [.45, 12.1, .14]]);
  batch(moving, panels, shell, 'Bevelled shutter modules'); batch(moving, seams, steel, 'Continuous load frame');
  batch(moving, inlays, light, 'Inset end-position marks');
  const hidden = gate.mesh.material.clone(); hidden.visible = false; gate.mesh.material = hidden;
  const rack = [];
  for (const z of [-5.75, 5.75]) for (let y = -5.9; y < 6; y += .24) rack.push([[.24, y, z], [.12, .11, .20]]);
  batch(moving, rack, steel, 'Driven rack teeth');
  const mount = [], rollers = [];
  for (const z of [-13.3, -.7]) {
    mount.push([[4.5, .18, z], [1.45, .36, 1.4]], [[4.5, 27.75, z], [1.45, .36, 1.4]]);
    for (const y of [2.8, 8.8, 14.8, 20.8, 26]) {
      mount.push([[4.45, y, z], [.82, .62, .85]]);
      // Guide wheels spin by actual shutter displacement; no autonomous animation.
      const roller = rod(root, [3.99, y, z], [4.75, y, z], .21, dark);
      rollers.push({ mesh: roller, rest: roller.quaternion.clone() });
    }
  }
  batch(root, mount, steel, 'Grounded guide shoes and bearing brackets');
  // The elevated ceramic sources have distinct structural support, not hovering panels.
  const sourceMount = [[[-9, .18, -5], [5.2, .36, 5.2]]];
  batch(root, sourceMount, dark, 'Source foundation and back mast');
  const frame = kit.panels['rising-out'].getFrame();
  for (const side of [-1, 1]) {
    const b = frame.center.clone().addScaledVector(frame.right, side * 2.3).addScaledVector(frame.up, -.8)
      .addScaledVector(frame.normal, -.30);
    rod(root, [b.x, .2, b.z], b.toArray(), .17);
  }
  let lastLoaded = false;
  kit.ticks.push(dt => {
    if (dt > 0 && gate.loaded !== lastLoaded) kit.game.audio?.mechanism?.(gate.loaded ? 'switch' : 'close');
    lastLoaded = gate.loaded;
  });
  const render = (alpha = 1) => {
    const progress = THREE.MathUtils.lerp(gate.previous, gate.progress, alpha);
    moving.position.set(4, 21.1 - progress * 12.5, -7);
    for (const { mesh, rest } of rollers) mesh.quaternion.copy(rest).multiply(
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), progress * 12.5 / .21));
  };
  kit.renders.push(render); kit.resets.push(() => { lastLoaded = false; render(1); }); render(1);
  root.userData.source = 'src/game/LabRoom21Art.js';
  root.userData.guardDimensions = [.46, 12.2, 12]; root.userData.colliderIndependent = true;
  return root;
}
