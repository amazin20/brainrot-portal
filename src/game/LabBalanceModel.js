import * as THREE from 'three';

// Measured in game.model(34, 1) coordinates, not guessed from a world AABB.
// The uploaded asset was scanned with its beam tilted. Its old Moving node
// included only one end, leaving the other end welded to the stationary base.
export const BALANCE_BIND = Object.freeze({
  pivot: Object.freeze([0, .237, 0]),
  tilt: Math.atan(.203),
  scale: 21.5,
  surfaceOffset: 1.05,
});

/** Re-articulate the complete supplied beam without deforming its triangles.
 * Fixed stand and bearing caps retain their bind pose. Both ends and the
 * central beam share one rigid transform. The initial photographed tilt is
 * removed once, not compounded with the physical rotation every frame.
 * A separately visible walkable deck is attached above the beam: it is the
 * same geometry used for physics, never an invisible floor below the artwork.
 */
export function buildBalanceModel(game, parent, bridge) {
  const source = game.model(34, 1);
  source.updateWorldMatrix(true, true);
  const fixed = new THREE.Group(); fixed.name = 'Balance stationary stand';
  parent.add(fixed);
  const moving = new THREE.Group(); moving.name = 'Balance complete rigid beam';
  bridge.add(moving);
  const pivot = new THREE.Vector3(...BALANCE_BIND.pivot);
  const scale = new THREE.Matrix4().makeScale(BALANCE_BIND.scale, BALANCE_BIND.scale, BALANCE_BIND.scale);
  const yaw = new THREE.Matrix4().makeRotationY(Math.PI / 2);
  const neutral = new THREE.Matrix4().makeRotationZ(-BALANCE_BIND.tilt);
  const origin = new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z);
  const movingMap = yaw.clone().multiply(scale).multiply(neutral).multiply(origin);
  const fixedMap = new THREE.Matrix4().makeTranslation(0, bridge.position.y, 0)
    .multiply(yaw).multiply(scale).multiply(origin);
  let sourceTriangles = 0, movingTriangles = 0, fixedTriangles = 0;
  const center = new THREE.Vector3(), point = new THREE.Vector3();
  source.traverse(node => {
    if (!node.isMesh) return;
    const geometry = node.geometry.clone().applyMatrix4(node.matrixWorld);
    const positions = geometry.attributes.position, index = geometry.index;
    const groups = [[], []];
    for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
      const ids = [0, 1, 2].map(k => index ? index.getX(i + k) : i + k);
      center.set(0, 0, 0);
      for (const id of ids) center.add(point.fromBufferAttribute(positions, id));
      center.multiplyScalar(1 / 3);
      const aboveBeamBottom = center.y - .203 * center.x > .190;
      // Outside the central axle every upper face moves. Inside it, only the
      // actual narrow beam moves between the two fixed bearing cheeks.
      const onBeam = aboveBeamBottom && (Math.abs(center.x) > .16 || Math.abs(center.z) < .055);
      groups[onBeam ? 1 : 0].push(...ids); sourceTriangles++;
    }
    for (const [part, ids] of groups.entries()) {
      if (!ids.length) continue;
      const indexed = geometry.clone(); indexed.setIndex(ids);
      const piece = indexed.toNonIndexed(); indexed.dispose();
      piece.applyMatrix4(part ? movingMap : fixedMap);
      piece.computeBoundingBox(); piece.computeBoundingSphere();
      const mesh = new THREE.Mesh(piece, node.material);
      mesh.name = part ? 'Uploaded beam and both end trays' : 'Uploaded stand and bearing cheeks';
      mesh.receiveShadow = true; mesh.castShadow = node.castShadow;
      (part ? moving : fixed).add(mesh);
      if (part) movingTriangles += ids.length / 3; else fixedTriangles += ids.length / 3;
    }
    geometry.dispose();
  });
  // The stand is tapered. Its whole bounding box would form an invisible
  // rectangular wall across the lowered deck. Clip its triangles into short
  // horizontal bands so the broad base cannot block the walkway near the axle.
  const supportBoxes = [];
  const bounds = new THREE.Box3().setFromObject(fixed);
  const clip = (polygon, height, above) => {
    const out = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length];
      const insideA = above ? a.y >= height : a.y <= height;
      const insideB = above ? b.y >= height : b.y <= height;
      if (insideA) out.push(a);
      if (insideA !== insideB) out.push(a.clone().lerp(b, (height - a.y) / (b.y - a.y)));
    }
    return out;
  };
  for (let y = bounds.min.y; y < bounds.max.y; y += .36) {
    const top = Math.min(y + .36, bounds.max.y), box = new THREE.Box3();
    fixed.traverse(node => {
      if (!node.isMesh) return;
      const p = node.geometry.attributes.position;
      for (let i = 0; i < p.count; i += 3) {
        const triangle = [0,1,2].map(k => new THREE.Vector3().fromBufferAttribute(p, i + k));
        for (const vertex of clip(clip(triangle, y, true), top, false)) box.expandByPoint(vertex);
      }
    });
    if (!box.isEmpty()) supportBoxes.push(box);
  }
  const item = {id:34, role:'Rigid balanced beam on a fixed bearing, supporting the visible walkable deck',
    art:moving, fixed, moving, supportBoxes, sourceTriangles, movingTriangles, fixedTriangles,
    uniformScale:BALANCE_BIND.scale, surfaceOffset:BALANCE_BIND.surfaceOffset};
  moving.userData.gameplayRole = item.role;
  moving.userData.partition = {sourceTriangles, movingTriangles, fixedTriangles};
  return item;
}
