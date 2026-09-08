import * as THREE from 'three';

const V = (...v) => new THREE.Vector3(...v);
const clamp = THREE.MathUtils.clamp;

// The derived GLBs' old Frame/Moving split was a spatial mask, not a rig:
// it moved a spring's end bearing and half of the bridge cassette. Work in
// normalized game.model(id, 1) space and keep every supplied triangle rigid.
function assembly(game, parent, id, { position, size, yaw }, moves) {
  const source = game.model(id, 1); source.updateWorldMatrix(true, true);
  const art = new THREE.Group(); art.name = `Supplied mechanism ${id}`;
  art.position.fromArray(position); art.rotation.y = yaw; parent.add(art);
  const fixed = new THREE.Group(), moving = new THREE.Group();
  fixed.name = 'Stationary supplied frame'; moving.name = 'Complete supplied moving assembly';
  art.add(fixed, moving);
  let sourceTriangles = 0, fixedTriangles = 0, movingTriangles = 0;
  const center = V(), vertex = V();
  source.traverse(node => {
    if (!node.isMesh) return;
    const geometry = node.geometry.clone().applyMatrix4(node.matrixWorld);
    const p = geometry.attributes.position, index = geometry.index, groups = [[], []];
    for (let i = 0; i < (index?.count ?? p.count); i += 3) {
      const ids = [0, 1, 2].map(k => index ? index.getX(i + k) : i + k);
      center.set(0, 0, 0);
      for (const id of ids) center.add(vertex.fromBufferAttribute(p, id));
      center.multiplyScalar(1 / 3);
      groups[moves(center) ? 1 : 0].push(...ids); sourceTriangles++;
    }
    for (const [part, ids] of groups.entries()) {
      if (!ids.length) continue;
      const indexed = geometry.clone(); indexed.setIndex(ids);
      const piece = indexed.toNonIndexed(); indexed.dispose();
      piece.scale(size, size, size); piece.computeBoundingBox(); piece.computeBoundingSphere();
      const mesh = new THREE.Mesh(piece, node.material);
      mesh.receiveShadow = true; mesh.castShadow = node.castShadow;
      mesh.name = part ? 'Supplied moving triangles' : 'Supplied stationary triangles';
      (part ? moving : fixed).add(mesh);
      if (part) movingTriangles += ids.length / 3; else fixedTriangles += ids.length / 3;
    }
    geometry.dispose();
  });
  art.updateWorldMatrix(true, true);
  return { id, art, fixed, moving, uniformScale: size, sourceTriangles, fixedTriangles, movingTriangles };
}

/** Uploaded 37 is a telescopic bridge, not a wheeled carriage. Its cassette
 * stays bolted to the near bank while the complete narrow span slides into it.
 * The original deck is the visible surface; no replacement slab is added.
 * `deck.slabs` are collider specifications in `moving` coordinates. */
export function buildExtensionBridgeModel(game, parent, {
  position = [0, 0, 0], size = 12, yaw = 0, stroke = 3.6,
} = {}) {
  if (!(size > 0 && stroke >= 0 && stroke <= size * .32)) throw new RangeError('Bridge stroke exceeds its cassette');
  const item = assembly(game, parent, 37, { position, size, yaw }, p => p.z > -.17);
  const { art, fixed, moving } = item;
  fixed.name = 'Bridge stationary cassette'; moving.name = 'Bridge rigid telescoping span';
  const width = .24 * size, start = -.15 * size, end = .46 * size, depth = end - start;
  const sourceMeshes = moving.children.filter(child => child.isMesh);
  const ray = new THREE.Raycaster(), origin = V(), down = V(0, -1, 0), local = V();
  const worldHeight = (x, z) => {
    moving.updateWorldMatrix(true, true);
    origin.set(x, art.position.y + size * 2, z);
    ray.set(origin, down);
    return ray.intersectObjects(sourceMeshes, false)[0]?.point.y ?? -Infinity;
  };
  const localHeight = (x, z) => {
    moving.updateWorldMatrix(true, true);
    local.set(x, 0, z).applyMatrix4(moving.matrixWorld);
    const y = worldHeight(local.x, local.z);
    return Number.isFinite(y) ? moving.worldToLocal(V(local.x, y, local.z)).y : -Infinity;
  };
  const slabs = [], slices = 12, length = depth / slices, thickness = .09;
  for (let i = 0; i < slices; i++) {
    const z0 = start + i * length, z1 = z0 + length;
    const y0 = localHeight(0, z0), y1 = localHeight(0, z1), rotationX = Math.atan2(y0 - y1, length);
    const normal = V(0, Math.cos(rotationX), Math.sin(rotationX));
    slabs.push({ center: V(0, (y0 + y1) / 2, (z0 + z1) / 2).addScaledVector(normal, -thickness / 2),
      size: V(width, thickness, length / Math.cos(rotationX) + .006), rotationX });
  }
  const center = V(0, localHeight(0, (start + end) / 2), (start + end) / 2);
  const deck = { width, depth, center, mesh: moving.children[0], slabs, start, end,
    heightAt: worldHeight,
    bounds() {
      moving.updateWorldMatrix(true, true);
      const box = new THREE.Box3();
      for (const x of [-width / 2, width / 2]) for (const z of [start, end]) {
        const p = V(x, 0, z).applyMatrix4(moving.matrixWorld);
        p.y = worldHeight(p.x, p.z); box.expandByPoint(p);
      }
      return box;
    },
  };
  item.deck = deck;
  item.supportBoxes = [new THREE.Box3().setFromObject(fixed)];
  item.setProgress = t => {
    item.progress = clamp(Number.isFinite(t) ? t : 0, 0, 1);
    moving.position.z = -stroke * (1 - item.progress);
    moving.updateWorldMatrix(true, true);
    return item.progress;
  };
  item.role = 'Uploaded telescopic bridge: stationary cassette, sliding original deck';
  art.userData.gameplayRole = item.role;
  item.setProgress(0);
  return item;
}

function rod(parent, name, material, radius = .055) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 10), material);
  mesh.name = name; mesh.receiveShadow = true; parent.add(mesh);
  const up = V(0, 1, 0), delta = V();
  return { mesh, set(a, b) {
    delta.copy(b).sub(a); mesh.position.copy(a).add(b).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(up, delta.clone().normalize()); mesh.scale.y = delta.length();
  } };
}

/** The original 32 remains horizontal and grounded. A visible, fixed-pivot
 * bell crank transmits the impact plate's vertical travel to the true central
 * ram. Both source end bearings and the base stay still. Added links have
 * constant physical lengths; their endpoints solve the two slider constraints.
 * `position` is the frame's floor origin; `plateCenter` is the world rest center
 * of the physical impact plate. All animation is driven by its compression. */
export function buildSpringRamModel(game, parent, {
  position = [-3.9, 0, -5], size = 4.5, yaw = Math.PI / 2,
  plateCenter = [0, 1.8, -5], stroke = .72,
} = {}) {
  const item = assembly(game, parent, 32, { position, size, yaw }, p =>
    p.y > .185 && ((p.z > -.15 && p.z < -.025) || (p.z >= -.025 && p.z < .23 && Math.abs(p.x) < .055)));
  const { art, fixed, moving } = item;
  fixed.name = 'Spring fixed bed and both end bearings'; moving.name = 'Spring central ram and rod';
  const plate = art.worldToLocal(V(...plateCenter));
  // Linkage runs on the near side of the supplied frame, clear of the falling
  // companion. A transverse pin joins each slider to this one working plane.
  const planeX = size * .255, ramZ = -.085 * size, ramY = .28 * size;
  const direction = Math.sign(plate.z - ramZ) || 1, pivotZ = ramZ + direction * .7;
  const inputRadius = Math.max(1.3, Math.abs(plate.z - pivotZ));
  const outputRadius = Math.min(inputRadius * .6, 1.6), pivotY = ramY + outputRadius;
  const inputZ = pivotZ + direction * inputRadius;
  const verticalOffset = plate.y - pivotY, verticalSign = Math.sign(verticalOffset) || -1;
  const inputLength = Math.max(.9, Math.abs(verticalOffset));
  // If the actual plate is close to the pivot height, a rigid downstand keeps
  // the connecting link long enough throughout the allowed stroke.
  const downstand = verticalOffset - verticalSign * inputLength;
  const outputLength = Math.abs(pivotZ - ramZ);
  const links = new THREE.Group(); links.name = 'Physical bell crank linkage'; art.add(links);
  const metal = new THREE.MeshStandardMaterial({ color: 0x394651, metalness: .65, roughness: .35 });
  const accent = new THREE.MeshStandardMaterial({ color: 0xdcb254, metalness: .42, roughness: .4 });
  const pivot = V(planeX, pivotY, pivotZ);
  const inputArm = rod(links, 'Rigid input crank arm', accent, .09);
  const outputArm = rod(links, 'Rigid output crank arm', accent, .09);
  const inputLink = rod(links, 'Rigid impact connecting rod', metal);
  const outputLink = rod(links, 'Rigid ram connecting rod', metal);
  const platePin = rod(links, 'Impact plate transverse pin', metal, .07);
  const ramPin = rod(links, 'Ram transverse pin', metal, .07);
  const plateStand = rod(links, 'Impact plate rigid downstand', metal, .07);
  const support = rod(links, 'Bell crank grounded bearing pedestal', metal, .14);
  support.set(V(planeX, 0, pivotZ), pivot);
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(.18, .18, .24, 16), accent);
  axle.rotation.z = Math.PI / 2; axle.position.copy(pivot); links.add(axle);
  const a = V(), b = V(), inputSlider = V(), outputSlider = V(), platePoint = V();
  function plateAt(angle) {
    const side = inputRadius * (1 - Math.cos(angle));
    return pivotY + inputRadius * Math.sin(angle) + verticalSign * Math.sqrt(Math.max(0, inputLength ** 2 - side ** 2));
  }
  item.setCompression = value => {
    const compression = clamp(Number.isFinite(value) ? value : 0, 0, stroke);
    const target = plate.y - downstand - compression;
    let lo = -.85, hi = 0;
    for (let i = 0; i < 32; i++) { const mid = (lo + hi) / 2; if (plateAt(mid) < target) lo = mid; else hi = mid; }
    const angle = (lo + hi) / 2;
    a.set(planeX, pivotY + inputRadius * Math.sin(angle), pivotZ + direction * inputRadius * Math.cos(angle));
    b.set(planeX, pivotY - outputRadius * Math.cos(angle), pivotZ + direction * outputRadius * Math.sin(angle));
    const dy = ramY - b.y;
    const shaftZ = b.z - direction * Math.sqrt(Math.max(0, outputLength ** 2 - dy ** 2));
    moving.position.z = shaftZ - ramZ;
    inputSlider.set(planeX, target, inputZ); outputSlider.set(planeX, ramY, shaftZ);
    platePoint.copy(plate); platePoint.y -= compression;
    inputArm.set(pivot, a); outputArm.set(pivot, b);
    inputLink.set(a, inputSlider); outputLink.set(b, outputSlider);
    plateStand.set(V(planeX, platePoint.y, inputZ), inputSlider);
    platePin.set(platePoint, V(planeX, platePoint.y, inputZ));
    ramPin.set(V(0, ramY, shaftZ), outputSlider);
    item.compression = compression; item.ramTravel = moving.position.z;
    item.linkLengths = [inputArm, outputArm, inputLink, outputLink].map(l => l.mesh.scale.y);
    art.updateWorldMatrix(true, true);
    return compression;
  };
  item.linkage = links;
  // Separate feet/bearings leave the working gap empty; an AABB around the
  // whole machine would falsely block the linkage and the open central bed.
  item.supportBoxes = [];
  for (const [z0, z1, y0, y1] of [[-.5, .45, 0, .1], [-.5, -.16, .1, .45], [.24, .5, .1, .38]]) {
    const box = new THREE.Box3(V(-.2 * size, y0 * size, z0 * size), V(.2 * size, y1 * size, z1 * size));
    item.supportBoxes.push(box.applyMatrix4(art.matrixWorld));
  }
  item.role = 'Uploaded horizontal spring ram driven by the impact plate through a fixed bell crank';
  art.userData.gameplayRole = item.role;
  item.setCompression(0);
  return item;
}
