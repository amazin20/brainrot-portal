import * as THREE from 'three';

/** Finish the existing atrium structure without participating in simulation.
 * All panels are attached to authored solids, never across a window, floor or
 * portal field. Only two instanced batches are added to the level root, so the
 * regular level material/geometry disposal also owns this detail pass. */
export function buildRoom12Architecture(world) {
  const root = new THREE.Group();
  root.name = 'Atrium structural finishes';
  root.userData.visualOnly = true;
  world.root.add(root);

  const solid = [], lamps = [];
  const add = (list, position, size, color) => list.push({ position, size, color });
  const plateColors = [0x4b5b63, 0x52616a, 0x4e5e66, 0x4b5b63];
  const brass = 0x9c8060, sage = 0x69847c, freight = 0x786d59;
  const plateDepth = .026, reveal = .065, seat = .003;

  // Each rectangle is one existing solid's vertical face, rather than one
  // continuous grid over the whole wall. This preserves all optical openings.
  const face = (axis, coordinate, u0, u1, y0, y1, side) => {
    const columns = Math.max(1, Math.ceil((u1 - u0) / 2.75));
    const rows = Math.max(1, Math.ceil((y1 - y0) / 3));
    const du = (u1 - u0) / columns, dy = (y1 - y0) / rows;
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      const u = u0 + du * (column + .5), y = y0 + dy * (row + .5);
      const normal = coordinate + side * (seat + plateDepth / 2);
      const position = axis === 'x' ? [normal, y, u] : [u, y, normal];
      const size = axis === 'x' ? [plateDepth, dy - reveal, du - reveal]
        : [du - reveal, dy - reveal, plateDepth];
      add(solid, position, size, plateColors[(column + 2 * row) % plateColors.length]);
    }
  };
  const slabX = (x, thickness, z0, z1, y0, y1) => {
    for (const side of [-1, 1]) face('x', x + side * thickness / 2, z0, z1, y0, y1, side);
  };
  const slabZ = (z, thickness, x0, x1, y0, y1) => {
    for (const side of [-1, 1]) face('z', z + side * thickness / 2, x0, x1, y0, y1, side);
  };

  // The two tall baffles read as assembled metal plates, providing a visible
  // three-metre scale from the court and during the long vertical transfer.
  slabX(12, .65, -35, -12.8, 0, 30);
  slabX(12, .65, -8.5, .25, 0, 30);
  // The physical pieces overlap by .5m; their visible faces must not.
  slabX(12, .65, -12.8, -8.5, 0, 22);
  slabX(12, .65, -12.8, -8.5, 26, 30);
  slabX(9, .55, -33, -8.5, 0, 30);
  slabX(9, .55, -4.2, 4, 0, 30);
  slabX(9, .55, -8.5, -4.2, 0, 22);
  slabX(9, .55, -8.5, -4.2, 28, 30);
  slabX(20.6, .5, -26, 0, 0, 30);
  slabZ(-26, .5, 12.4, 20.6, 0, 30);
  slabZ(0, .5, 12.3, 20.7, 0, 18.2);
  slabZ(0, .5, 12.3, 20.7, 26, 30);

  // Fascias sit on the existing .34m deck beams, below the walkable tile.
  // Their desaturated colours distinguish inhabited bays without using the
  // blue/orange portal colours or suggesting another ceramic target.
  const fascia = (x0, x1, z0, z1, y, color) => {
    const minX = x0 + .04, maxX = x1 - .04;
    const minZ = z0 + .04, maxZ = z1 - .04;
    for (const [axis, coordinate, a, b, side] of [
      ['x', minX, minZ, maxZ, -1], ['x', maxX, minZ, maxZ, 1],
      ['z', minZ, minX, maxX, -1], ['z', maxZ, minX, maxX, 1],
    ]) {
      const n = Math.max(1, Math.ceil((b - a) / 3));
      const length = (b - a) / n;
      for (let i = 0; i < n; i++) {
        const u = a + length * (i + .5), normal = coordinate + side * .016;
        add(solid, axis === 'x' ? [normal, y - .33, u] : [u, y - .33, normal],
          axis === 'x' ? [.026, .25, length - .055] : [length - .055, .25, .026], color);
        // A short light sits within its fascia's footprint, not as a floating
        // line in the air. Its small size cannot be mistaken for a portal tile.
        if (i % 2 === 0) {
          const lampNormal = coordinate + side * .032;
          add(lamps, axis === 'x' ? [lampNormal, y - .33, u] : [u, y - .33, lampNormal],
            axis === 'x' ? [.008, .032, Math.min(.65, length - .20)]
              : [Math.min(.65, length - .20), .032, .008], 0xc1b99d);
        }
      }
    }
  };
  fascia(-29, -16, 8, 20, 8, brass);
  fascia(-29, -12, -32, -26, 22, brass);
  fascia(-16, -8, 18, 23, 6, freight);
  fascia(12, 29, 0, 26, 12, sage);
  fascia(21, 29, -3, 0, 12, sage);

  // Broad, muted receiver backing is already solid. Keep the cargo clearance
  // and arch jambs untouched: these finishes are above the lintel and on the
  // far stopping wall, with no extra lip at the low passage.
  for (const z of [13.661, 14.339]) add(solid, [24, 16.05, z], [6.88, 5.16, .026], sage);
  for (const z of [25.136, 25.664]) add(solid, [20.5, 13.05, z], [16.86, 1.96, .026], sage);

  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), scale = new THREE.Vector3();
  const quaternion = new THREE.Quaternion(), color = new THREE.Color();
  const batch = (name, entries, material) => {
    const mesh = new THREE.InstancedMesh(geometry, material, entries.length);
    mesh.name = name;
    mesh.userData.visualOnly = true;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    entries.forEach((entry, i) => {
      matrix.compose(position.fromArray(entry.position), quaternion, scale.fromArray(entry.size));
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, color.setHex(entry.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    root.add(mesh);
  };
  batch('Non-portal plate cladding and gallery fascias', solid,
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .86, metalness: .13 }));
  batch('Mounted fascia light inserts', lamps,
    new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: true }));
  root.userData.finishCount = solid.length;
  root.userData.lightInsertCount = lamps.length;
  return root;
}
