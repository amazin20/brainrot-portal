import * as THREE from 'three';

/** One closed pressed guard, fitted to the existing room-eleven shroud.
 * The front's recess and ribs are part of the volume. There is no second
 * skin, opening, extra query owner or geometry outside the original box. */
export function finishWindGuard(mesh) {
  const xs = [-.975, -.88, -.82, -.63, -.595, -.56, -.23, -.195, -.16, .17, .205, .24, .57, .605, .64, .82, .88, .975];
  const ys = [-1.05, -.95, -.85, -.74, -.69, -.64, .64, .69, .74, .85, .95, 1.05];
  const steel = new THREE.Color(0x78888e), field = new THREE.Color(0x29363d);
  const rib = new THREE.Color(0x52666e), brass = new THREE.Color(0x9b784b);
  const positions = [], colors = [], indices = [], count = xs.length * ys.length;
  for (let side = 0; side < 2; side++) for (const y of ys) for (const x of xs) {
    const edge = Math.min(.975 - Math.abs(x), 1.05 - Math.abs(y));
    const frame = 1 - THREE.MathUtils.smoothstep(edge, .095, .155);
    const nearestRib = Math.min(...[-.595, -.195, .205, .605].map(center => Math.abs(x - center)));
    const raisedRib = (1 - THREE.MathUtils.smoothstep(nearestRib, 0, .035))
      * (1 - THREE.MathUtils.smoothstep(Math.abs(y), .64, .74));
    const z = side ? -.075 : .030 + .045 * Math.max(frame, .64 * raisedRib);
    positions.push(x, y, z);
    const color = side ? field : field.clone().lerp(rib, raisedRib).lerp(steel, frame);
    if (!side && Math.abs(y) > .85 && Math.abs(y) < 1 && Math.abs(x) < .88) color.copy(brass);
    colors.push(color.r, color.g, color.b);
  }
  const at = (x, y, back = false) => y * xs.length + x + (back ? count : 0);
  for (let y = 0; y < ys.length - 1; y++) for (let x = 0; x < xs.length - 1; x++) {
    const a = at(x, y), b = at(x + 1, y), c = at(x + 1, y + 1), d = at(x, y + 1);
    indices.push(a, b, c, a, c, d, a + count, c + count, b + count, a + count, d + count, c + count);
  }
  // Follow the complete front perimeter counter-clockwise. Each boundary
  // edge has one front face and one outward side face, including the corners.
  const boundary = [];
  for (let x = 0; x < xs.length; x++) boundary.push(at(x, 0));
  for (let y = 1; y < ys.length; y++) boundary.push(at(xs.length - 1, y));
  for (let x = xs.length - 2; x >= 0; x--) boundary.push(at(x, ys.length - 1));
  for (let y = ys.length - 2; y > 0; y--) boundary.push(at(0, y));
  for (let i = 0; i < boundary.length; i++) {
    const a = boundary[i], b = boundary[(i + 1) % boundary.length];
    indices.push(a, a + count, b + count, a, b + count, b);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.name = 'Wind clutch / closed pressed guard volume';
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const material = new THREE.MeshStandardMaterial({color: 0xffffff, vertexColors: true, roughness: .54, metalness: .62});
  material.name = 'Wind clutch / pressed steel guard';
  const previousGeometry = mesh.geometry;
  mesh.geometry = geometry; mesh.material = material;
  mesh.userData.windGuardFinish = 'closed-pressed-steel-v1';
  previousGeometry.dispose();
  return mesh;
}
