import * as THREE from 'three';

const COLORS = {
  lower: 0x758c8d, ledge: 0x9c9e8d, freight: 0xab8877,
  high: 0xaaa38d, receiving: 0x91a68f, return: 0x708e89,
  wall: 0x72827d, ceiling: 0x85918a, dark: 0x344e50,
};

/** Smooth painted type on the same real plaque. The previous 5×7 box font
 * was literal staircase geometry, so raising its resolution could never make
 * it look like finished signage. No web font, network or frame clock is used. */
function antialiasedLocationPlaque(root,text,position,normal,width,height){
 const canvas=globalThis.document?.createElement?.('canvas'),context=canvas?.getContext?.('2d');
 // CPU simulation has no pixels to draw; label metadata is still declared by
 // its caller. There is intentionally no second low-quality rendering path.
 if(!context)return false;
 canvas.width=1024;canvas.height=Math.max(256,Math.round(1024*height/width));
 context.fillStyle='#263f48';context.fillRect(0,0,canvas.width,canvas.height);
 context.font=`600 ${Math.round(canvas.height*.64)}px sans-serif`;
 context.textAlign='center';context.textBaseline='middle';context.fillStyle='#f0e8cc';
 context.fillText(text,canvas.width/2,canvas.height*.52,canvas.width*.92);
 const texture=new THREE.CanvasTexture(canvas);texture.name='Junction AA location / '+text;
 texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=true;
 texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.anisotropy=8;
 const material=new THREE.MeshBasicMaterial({map:texture,toneMapped:false});
 let disposed=false;material.addEventListener('dispose',()=>{if(!disposed){disposed=true;texture.dispose();}});
 const mesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(width,height),material,1);
 mesh.name='Antialiased wall location plaque / '+text;mesh.userData={visualOnly:true,labelText:text,keepMaterial:true};
 const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(...normal));
 mesh.setMatrixAt(0,new THREE.Matrix4().compose(new THREE.Vector3(...position),q,new THREE.Vector3(1,1,1)));
 mesh.castShadow=mesh.receiveShadow=false;mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();root.add(mesh);return true;
}

function district(name) {
  if (/Receiving|throat/i.test(name)) return 'receiving';
  if (/freight lip/i.test(name)) return 'freight';
  if (/high lip|Spine stair|North stair|North cross/i.test(name)) return 'high';
  if (/West landing|Underpass/i.test(name)) return 'ledge';
  if (/pocket/i.test(name)) return 'return';
  return 'lower';
}

/** Finishes for the folded junction, derived from the authored structure.
 * Only the six original ivory surfaces accept portals. This module adds no
 * surfaces, colliders, lights, camera blockers or frame-by-frame work. */
export function buildRoom12Architecture(world) {
  const root = new THREE.Group();
  root.name = 'Folded junction structural finishes';
  root.userData.visualOnly = true;
  world.root.add(root);
  const solid = [], inserts = [];
  const add = (list, position, size, color) => list.push({position, size, color});
  const metal = new THREE.MeshStandardMaterial({color:0xffffff, roughness:.84, metalness:.12});
  const matrix = new THREE.Matrix4(), tint = new THREE.Color();

  // The structural boxes use their own room-local materials, separately from
  // the tiled faces above. Keep their mass visible beneath crossing decks;
  // the small ambient floor in the material adds no point light or white target.
  world.materials.wall.color.setHex(0x728780);
  world.materials.wall.roughness = .9;
  world.materials.wall.emissive.setHex(0x728780);
  world.materials.wall.emissiveIntensity = .045;
  world.materials.trim.color.setHex(0x657570);
  world.materials.trim.roughness = .84;
  world.materials.trim.metalness = .1;
  world.materials.trim.emissive.setHex(0x657570);
  world.materials.trim.emissiveIntensity = .12;

  // Pigment belongs to existing tile instances, not a second facing floating
  // over them. Muted differences identify overlapping levels without making
  // extra white targets or a decorative grid of false panels.
  for (const surface of world.surfaces) {
    if (surface.portal) continue;
    const paint = surface.normal.y > .9 ? COLORS[district(surface.name)]
      : surface.normal.y < -.9 ? COLORS.ceiling : COLORS.wall;
    surface.group.traverse(mesh => {
      if (!mesh.isInstancedMesh || mesh.userData.portalTile) return;
      mesh.material = metal;
      for (let i = 0; i < mesh.count; i++) {
        // A restrained five-tile cadence shows assembly without noise.
        mesh.setColorAt(i, tint.setHex(paint).multiplyScalar(i % 5 === 0 ? .97 : 1));
      }
      mesh.instanceColor.needsUpdate = true;
    });
  }

  const floors = world.surfaces.filter(s => s.floor && !s.portal);
  const decks = floors.filter(s => s.floor.y > 1 && !/stair/i.test(s.name));
  // These strips stay entirely on the side of each real deck beam. They
  // never extend above its floor or create rails across a jumping opening.
  for (const deck of decks) {
    const f = deck.floor, paint = COLORS[district(deck.name)];
    const faces = [
      ['x', f.minX, f.minZ, f.maxZ, -1], ['x', f.maxX, f.minZ, f.maxZ, 1],
      ['z', f.minZ, f.minX, f.maxX, -1], ['z', f.maxZ, f.minX, f.maxX, 1],
    ];
    for (const [axis, coordinate, a, b, side] of faces) {
      const count = Math.max(1, Math.ceil((b - a) / 3.2)), span = (b - a) / count;
      for (let i = 0; i < count; i++) {
        const u = a + span * (i + .5), outward = coordinate + side * .014;
        add(solid, axis === 'x' ? [outward, f.y - .27, u] : [u, f.y - .27, outward],
          axis === 'x' ? [.022, .20, span - .055] : [span - .055, .20, .022], paint);
        // Tiny recessed lamps are visibly mounted in the beam, never long
        // floating wires. At most two appear along any individual edge.
        if (i === 0 || i === count - 1) {
          const face = outward + side * .014;
          add(inserts, axis === 'x' ? [face, f.y - .27, u] : [u, f.y - .27, face],
            axis === 'x' ? [.005, .032, Math.min(.38, span * .22)]
              : [Math.min(.38, span * .22), .032, .005], 0xcac9ac);
        }
      }
    }
  }

  // Three location names are painted on existing vertical material. Find a
  // real wall near each deck; this follows geometry tuning and avoids placing
  // a sign in an optical aperture or manufacturing a free-standing board.
  world.root.updateWorldMatrix(true, true);
  const wallFaces = [];
  for (const surface of world.surfaces) {
    if (surface.portal || Math.abs(surface.normal.y) > .1) continue;
    const frame = surface.getFrame(), axis = Math.abs(frame.normal.x) > .9 ? 'x' : 'z';
    const side = Math.sign(frame.normal[axis]);
    const u = axis === 'x' ? frame.center.z : frame.center.x;
    wallFaces.push({axis, side, coordinate:frame.center[axis],
      a:u - frame.halfWidth, b:u + frame.halfWidth,
      low:frame.center.y - frame.halfHeight, high:frame.center.y + frame.halfHeight});
  }
  for (const node of world.root.children) {
    if (!node.isMesh || !node.visible || node.material !== world.materials.wall) continue;
    const box = new THREE.Box3().setFromObject(node);
    if (box.max.y - box.min.y < 2) continue;
    for (const [axis, other] of [['x','z'],['z','x']]) for (const side of [-1,1]) {
      wallFaces.push({axis, side, coordinate:side < 0 ? box.min[axis] : box.max[axis],
        a:box.min[other], b:box.max[other], low:box.min.y, high:box.max.y});
    }
  }

  // Sparse construction joints on the three large structural masses explain
  // where the lower ledge and upper crossing meet the shell. They are narrow
  // beam reveals on an existing solid face, not extra panels or floating rails.
  // Small baffles and the surfaces surrounding optical slots stay unadorned.
  let structuralJoints = 0;
  for (const node of world.root.children) {
    if (!node.isMesh || node.material !== world.materials.wall) continue;
    const box = new THREE.Box3().setFromObject(node);
    if (box.max.y - box.min.y < 14 || box.max.x - box.min.x < 1 || box.max.z - box.min.z < 1) continue;
    for (const [axis, other] of [['x','z'], ['z','x']]) for (const side of [-1,1]) {
      const a = box.min[other] + .12, b = box.max[other] - .12;
      if (b - a < 4.5) continue;
      const coordinate = (side < 0 ? box.min[axis] : box.max[axis]) + side * .013;
      for (const y of [7, 18]) {
        if (y < box.min.y + .4 || y > box.max.y - .4) continue;
        const count = Math.ceil((b - a) / 5.8), span = (b - a) / count;
        for (let i = 0; i < count; i++) {
          const u = a + span * (i + .5);
          add(solid, axis === 'x' ? [coordinate, y - .19, u] : [u, y - .19, coordinate],
            axis === 'x' ? [.018, .12, span - .04] : [span - .04, .12, .018], 0x8e9a8d);
          structuralJoints++;
        }
      }
    }
  }
  const labels = [
    ['Underpass ledge', 'УЗЕЛ', COLORS.ledge],
    ['Same-shaft high lip', 'ВЕРХ', COLORS.high],
    ['Receiving dock', 'ПРИЁМ', COLORS.receiving],
  ];
  const mountedLabels = [];let antialiasedLabels=0;
  for (const [name, text, paint] of labels) {
    const deck = floors.find(s => s.name === name);
    if (!deck) continue;
    const f = deck.floor, centre = {x:(f.minX + f.maxX) / 2, z:(f.minZ + f.maxZ) / 2};
    const width = 2.45, y = f.y + 2.25;
    const candidate = wallFaces.map(face => {
      const other = face.axis === 'x' ? 'z' : 'x';
      const distance = (centre[face.axis] - face.coordinate) * face.side;
      const u = THREE.MathUtils.clamp(centre[other], face.a + width / 2 + .18, face.b - width / 2 - .18);
      return {...face, u, distance, score:distance + Math.abs(u - centre[other])};
    }).filter(face => face.b - face.a > width + .36 && face.distance > .1 && face.distance < 4.5
      && y > face.low + .6 && y < face.high - .6)
      .sort((a,b) => a.score - b.score)[0];
    if (!candidate) continue;
    const {axis, side, coordinate, u} = candidate;
    const step = width / (text.length * 6 - 1), right = axis === 'x' ? -side : side;
    const rectangle = (list, du, dy, w, h, color, offset=.012) => add(list,
      axis === 'x' ? [coordinate + side * offset, y + dy, u + right * du]
        : [u + right * du, y + dy, coordinate + side * offset],
      axis === 'x' ? [.007, h, w] : [w, h, .007], color);
    // A complete opaque instrument plaque closes the decorative louvres
    // behind the stencil. The lettering used to sit naked over the door's
    // vents and read like text accidentally superimposed on a source model.
    // Both the plaque and paint are on this same actual closed wall face.
    rectangle(solid, 0, 0, width+.24, step*8.3, 0x263f48, .018);
    rectangle(solid, 0, -step * 4.35, width, .045, paint, .029);
    const position=axis==='x'?[coordinate+side*.029,y,u]:[u,y,coordinate+side*.029];
    const normal=axis==='x'?[side,0,0]:[0,0,side];
    if(antialiasedLocationPlaque(root,text,position,normal,width,step*7.7))antialiasedLabels++;
    mountedLabels.push(text);
  }

  const geometry = new THREE.BoxGeometry(1,1,1), p = new THREE.Vector3();
  const scale = new THREE.Vector3(), rotation = new THREE.Quaternion();
  const batch = (name, entries, material) => {
    if (!entries.length) return;
    const mesh = new THREE.InstancedMesh(geometry, material, entries.length);
    mesh.name = name; mesh.userData.visualOnly = true;
    // Small painted trims do not cast or sample a second near-coplanar shadow.
    mesh.castShadow = false; mesh.receiveShadow = false;
    entries.forEach((entry,i) => {
      matrix.compose(p.fromArray(entry.position), rotation, scale.fromArray(entry.size));
      mesh.setMatrixAt(i, matrix); mesh.setColorAt(i, tint.setHex(entry.color));
    });
    mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere(); root.add(mesh);
  };
  batch('Junction deck beam finishes', solid, metal);
  const painted = new THREE.MeshBasicMaterial({color:0xffffff, toneMapped:true});
  batch('Mounted deck light inserts', inserts, painted);
  root.userData.finishCount = solid.length;
  root.userData.lightInsertCount = inserts.length;
  root.userData.structuralJointCount = structuralJoints;
  root.userData.districts = ['lower return','folded ledge','shared shaft','receiving dock'];
  root.userData.mountedLabels = mountedLabels;
  root.userData.antialiasedLabels = antialiasedLabels;
  return root;
}
