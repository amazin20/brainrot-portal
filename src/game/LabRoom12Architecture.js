import * as THREE from 'three';

/** A room-local architectural skin: real ceramic stays ivory, structural
 * metal has a quiet colour and a readable human scale. Nothing in this module
 * registers a collision, a camera blocker, a portal or a puzzle condition. */
export function buildRoom12Architecture(world) {
  const root = new THREE.Group();
  root.name = 'Atrium structural finishes';
  root.userData.visualOnly = true;
  world.root.add(root);

  const solid = [], lamps = [], lettering = [];
  const add = (list, position, size, color) => list.push({ position, size, color });
  const plateColors = [0x768a8c, 0x7b8e8f, 0x72878a, 0x768a8c];
  const brass = 0xb6a277, sage = 0x87aa97, freight = 0xad8d72;
  const dark = 0x314b53, edge = 0x5d787c;
  const metal = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .76, metalness: .17 });
  const plateDepth = .026, reveal = .065, seat = .003;

  // Reuse the room's real tile meshes. Per-instance paint changes neither
  // their bevels nor the registered front plane. No ceramic tile is touched.
  const transform = new THREE.Matrix4(), tint = new THREE.Color(), tilePoint = new THREE.Vector3();
  for (const surface of world.surfaces || []) {
    if (surface.portal) continue;
    surface.group.updateWorldMatrix(true, true);
    surface.group.traverse(mesh => {
      if (!mesh.isInstancedMesh || mesh.userData.portalTile) return;
      mesh.material = metal;
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, transform);
        tilePoint.setFromMatrixPosition(transform).applyMatrix4(mesh.matrixWorld);
        let paint = 0x7e9192;
        if (surface.normal?.y > .9) {
          paint = surface.name === 'Arrival gallery' || surface.name === 'Freight receiving floor' ? 0x91a79a
            : surface.name.includes('Freight') ? 0xa49480
              : surface.name.includes('Observation') || surface.name.includes('High return') || surface.name.includes('reservoir') ? 0xa6aa99 : 0x8b9c9c;
        } else if (surface.normal?.y < -.9) paint = 0x6f8789;
        else if (tilePoint.y > 23) paint = 0x9aaaa7;
        else if (tilePoint.x > 29) paint = tilePoint.y > 10 && tilePoint.y < 16 ? sage : 0x708b87;
        else if (tilePoint.x < -29) paint = tilePoint.y > 7 && tilePoint.y < 11 ? brass : 0x7a8e8d;
        else if (tilePoint.z > 35) paint = tilePoint.y < 7 ? 0x708589 : 0x849794;
        tint.setHex(paint).multiplyScalar(i % 5 === 0 ? .97 : 1);
        mesh.setColorAt(i, tint);
      }
      mesh.instanceColor.needsUpdate = true;
    });
  }

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
      add(solid, position, size, y > 26 ? 0x9aa9a4 : y < 3 ? dark : plateColors[(column + 2 * row) % plateColors.length]);
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
  slabX(12, .65, -35, -13.8, 0, 30);
  slabX(12, .65, -8.5, .25, 0, 30);
  // Separate rectangles preserve the full physical flight apertures.
  slabX(12, .65, -13.8, -8.5, 0, 22);
  slabX(12, .65, -13.8, -8.5, 26, 30);
  slabX(9, .55, -33, -9.5, 0, 30);
  slabX(9, .55, -3.2, 4, 0, 30);
  slabX(9, .55, -9.5, -3.2, 0, 22);
  slabX(9, .55, -9.5, -3.2, 28, 30);
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

  // The existing freight gallery is a solid envelope. Its apron, overhead
  // load beam and stopping wall now read as one receiving dock; the low
  // opening itself remains exactly the original size.
  slabX(28.8, .4, -1.75, 25.75, 0, 11.8);
  slabZ(-2.9, .3, 20.3, 28.9, 0, 11.8);
  for (const side of [-1, 1]) {
    const x = 20.65 + side * .354;
    add(solid, [x, 13.4, 14], [.026, 2.72, 3.9], edge);
    add(solid, [27.35 + side * .354, 13.4, 14], [.026, 2.72, 3.9], edge);
  }
  for (const z of [13.639, 14.361]) {
    for (const x of [21, 27]) add(solid, [x, 15.95, z], [.10, 4.9, .018], dark);
    add(solid, [24, 18.52, z], [6.85, .18, .025], dark);
    add(lamps, [24, 18.50, z + Math.sign(z - 14) * .019], [4.5, .055, .009], 0xd1e4d1);
  }

  // Cap the black structural columns with inset metal collars. All faces
  // stay on the existing .44m posts; there is no invisible new support in a
  // walkable area. Repeated joints explain how the high decks are assembled.
  for (const [x0, x1, z0, z1, height, paint] of [
    [-29, -16, 8, 20, 8, brass], [-29, -12, -32, -26, 22, brass],
    [-16, -8, 18, 23, 6, freight], [12, 29, 0, 26, 12, sage],
    [21, 29, -3, 0, 12, sage],
  ]) for (const x of [x0 + .38, x1 - .38]) for (const z of [z0 + .38, z1 - .38]) {
    for (const side of [-1, 1]) {
      add(solid, [x + side * .232, (height - .51) / 2, z], [.024, height - .56, .37], edge);
      add(solid, [x, (height - .51) / 2, z + side * .232], [.37, height - .56, .024], edge);
      for (const y of [.5, height - .9]) {
        add(solid, [x + side * .247, y, z], [.014, .25, .4], paint);
        add(solid, [x, y, z + side * .247], [.4, .25, .014], paint);
      }
    }
  }

  // Continuous side stringers sit inside each stair's existing stepped
  // envelope. A shallow painted triangle replaces the black comb silhouette
  // without adding a rail across an intentional drop or a new collision.
  const stairSkin = (x0, x1, z0, z1, low, high, paint) => {
    const vertices = [], colours = [], c = new THREE.Color(paint);
    const run = z1 - z0, start = z0 + run * .026, bottom = low - .065;
    for (const x of [x0 + .021, x1 - .021]) {
      vertices.push(x, bottom, start, x, high - .24, z1 - run * .002, x, bottom, z1 - run * .002);
      for (let i = 0; i < 3; i++) colours.push(c.r, c.g, c.b);
    }
    const skinGeometry = new THREE.BufferGeometry();
    skinGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    skinGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
    skinGeometry.computeVertexNormals();
    const skin = new THREE.Mesh(skinGeometry, new THREE.MeshStandardMaterial({
      color: 0xffffff, vertexColors: true, roughness: .8, metalness: .14, side: THREE.DoubleSide,
    }));
    skin.name = 'Existing stair stringer cladding'; skin.userData.visualOnly = true;
    // These thin decorative faces sit 19 mm from the original step bodies.
    // Receiving their nearby shadow samples creates a dotted surface; keep
    // the scene's lighting and real tread shadows on the original geometry.
    skin.receiveShadow = false; root.add(skin);
    const count = Math.ceil((high - low) / .26), dz = run / count;
    for (let i = 1; i < count; i++) {
      const z = z0 + dz * i, top = low + (high - low) * (i + 1) / count;
      // This is the exposed riser, below the topmost walkable tile.
      add(solid, [(x0 + x1) / 2, top - .17, z - Math.sign(dz) * .014],
        [x1 - x0 - .12, .17, .025], i % 4 === 0 ? paint : edge);
    }
  };
  stairSkin(-29, -25, 8, -26, 8, 22, brass);
  stairSkin(-11, -8, 33, 23, 0, 6, freight);

  // Every light is mounted to a real column or roof beam. Broad ceiling
  // trays are visibly luminous, narrow service inserts cannot be mistaken
  // for another portal field. No point lights or per-frame work are added.
  for (const z of [-29, -17, -5, 7, 19, 31]) {
    for (const side of [-1, 1]) {
      const x = side * 29.708;
      add(solid, [x, 17, z], [.025, 17, .58], edge);
      for (const y of [8, 12, 22]) add(solid, [x - side * .014, y, z], [.012, .28, .6], y === 12 ? sage : brass);
      add(solid, [x - side * .018, 25.5, z], [.016, 3.8, .30], dark);
      add(lamps, [x - side * .032, 25.5, z], [.009, 3.4, .095], 0xd4e0d5);
      add(solid, [side * 18, 28.982, z], [12, .028, .46], edge);
      add(lamps, [side * 18, 28.959, z], [11.3, .015, .21], 0xd9e1d4);
    }
  }

  // The scale belongs to the continuous west face of the optical baffle.
  // It gives falling height a physical reference, without indicating an
  // answer, adding a countdown or marking the hidden airborne target.
  add(solid, [8.676, 14, 2.72], [.036, 27, 1.34], dark);
  for (let y = 1; y <= 27; y++) {
    add(lamps, [8.651, y, 2.78], [.009, y % 2 ? .035 : .06, y % 2 ? .25 : .62], 0xacb8ae);
  }

  // A small vector stencil shares one instanced batch: no web fonts,
  // downloadable image, canvas allocation or text in the player HUD.
  const glyphs = {
    'О':['01110','10001','10001','10001','10001','10001','01110'],
    'Б':['11111','10000','10000','11110','10001','10001','11110'],
    'З':['11110','00001','00001','01110','00001','00001','11110'],
    'Р':['11110','10001','10001','11110','10000','10000','10000'],
    'Г':['11111','10000','10000','10000','10000','10000','10000'],
    'У':['10001','10001','10001','01111','00001','00001','11110'],
    'В':['11110','10001','10001','11110','10001','10001','11110'],
    'Ы':['10001','10001','10001','11101','10011','10011','11101'],
    'С':['01111','10000','10000','10000','10000','10000','01111'],
    'Т':['11111','00100','00100','00100','00100','00100','00100'],
    'А':['01110','10001','10001','11111','10001','10001','10001'],
    'П':['11111','10001','10001','10001','10001','10001','10001'],
    'И':['10001','10001','10011','10101','11001','10001','10001'],
    'Ё':['01010','00000','11111','10000','11110','10000','11111'],
    'М':['10001','11011','10101','10101','10001','10001','10001'],
    '0':['01110','10001','10011','10101','11001','10001','01110'],
    '1':['00100','01100','00100','00100','00100','00100','01110'],
    '2':['01110','10001','00001','00010','00100','01000','11111'],
    '6':['01110','10000','10000','11110','10001','10001','01110'],
    '8':['01110','10001','10001','01110','10001','10001','01110'],
  };
  const stencil = (text, axis, normal, coordinate, u, y, width, paint) => {
    const step = width / (text.length * 6 - 1), right = axis === 'x' ? -normal : normal;
    const rectangle = (list, du, dy, w, h, offset, color) => add(list,
      axis === 'x' ? [coordinate + normal * offset, y + dy, u + right * du]
        : [u + right * du, y + dy, coordinate + normal * offset],
      axis === 'x' ? [.009, h, w] : [w, h, .009], color);
    rectangle(solid, 0, 0, width + .6, step * 9.8, -.018, dark);
    rectangle(solid, 0, -step * 4.35, width + .6, step * .75, -.009, paint);
    [...text].forEach((letter, n) => {
      const rows = glyphs[letter]; if (!rows) return;
      rows.forEach((row, r) => {
        for (let c = 0; c < row.length;) {
          if (row[c] !== '1') { c++; continue; }
          const start = c; while (row[c] === '1') c++;
          rectangle(lettering, -width / 2 + (n * 6 + (start + c) / 2) * step,
            (3 - r) * step, (c - start) * step, step * .87, 0, 0xcfd8c6);
        }
      });
    });
  };
  stencil('ОБЗОР 08', 'x', 1, -30.958, 14, 12, 10.2, brass);
  stencil('ГРУЗ 06', 'z', -1, 36.958, -10, 8.4, 9.5, freight);
  stencil('ВЫСОТА 22', 'z', 1, -34.958, -20, 25.6, 12.8, brass);
  stencil('ПРИЁМ 12', 'x', -1, 30.958, 17, 17.2, 10.5, sage);

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
  batch('Non-portal plate cladding and gallery fascias', solid, metal);
  batch('Mounted fascia light inserts', lamps,
    new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: true }));
  batch('Mounted district name stencils', lettering,
    new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: true }));
  root.userData.finishCount = solid.length;
  root.userData.lightInsertCount = lamps.length;
  root.userData.districts = ['observation', 'freight', 'reservoir', 'arrival'];
  return root;
}
