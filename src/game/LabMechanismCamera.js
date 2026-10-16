import * as THREE from 'three';

export const MECHANISM_CAMERA_BUDGET = 12;
export const MECHANISM_CAMERA_FOV = 96;
export const MECHANISM_CAMERA_MAX_REAR = 14.5;
const UP = new THREE.Vector3(0, 1, 0);

/** Production policy, deliberately confined to the two vertical mechanisms.
 * Other castle wings and the accepted Foundation20 camera keep their policy. */
export function mechanismCameraArea(level, index, target) {
  if (index === 24 && level?.id === 'opposed-shadows' && level.state?.optical?.machine) return true;
  const room = level?.rooms?.get('pendulum');
  const deck = level?.machines?.get('pendulum')?.state.upperCell?.deckPart;
  if (index !== 40 || !level.singularity || !room || !deck) return false;
  return target.x >= deck.mesh.position.x - deck.half.x - 3 && target.x <= room.b.x1
    && target.z >= room.b.z0 && target.z <= room.b.z1
    && target.y >= room.def.at[1] - .5 && target.y <= room.def.at[1] + room.def.h;
}

/** Eight conservative actor/gun corners, never production vertex projection.
 * Measure against the unchanged centre look point. The actual animated root
 * rotation also covers the brief transported pose after a portal passage. */
export function measureMechanismFrame({eye, target, rotation, lookPoint, up = UP, aspect, near, fov}) {
  const forward = lookPoint.clone().sub(eye).normalize();
  const right = new THREE.Vector3().crossVectors(forward, up).normalize();
  if (right.lengthSq() < .01) right.set(1, 0, 0);
  const vertical = new THREE.Vector3().crossVectors(right, forward).normalize();
  const tangent = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, needed = 0;
  for (const x of [-1.05, 1.05]) for (const y of [-.2, 2.84]) for (const z of [-1.05, 1.05]) {
    const point = new THREE.Vector3(x, y, z);
    if (rotation) point.applyQuaternion(rotation);
    point.add(target).sub(eye);
    const depth = point.dot(forward);
    if (depth <= near) return {penalty: 1000, neededFov: 180, height: Infinity, aimGap: -Infinity, fits: false};
    const horizontal = point.dot(right) / (depth * aspect), v = point.dot(vertical) / depth;
    minX = Math.min(minX, horizontal / tangent);maxX = Math.max(maxX, horizontal / tangent);
    minY = Math.min(minY, v / tangent);maxY = Math.max(maxY, v / tangent);
    needed = Math.max(needed, Math.abs(horizontal) / .9, Math.abs(v) / .9);
  }
  const outside = Math.max(0, -minX - .9, maxX - .9, -minY - .9, maxY - .9);
  const height = (maxY - minY) / 2;
  needed = Math.max(needed, height * tangent / .62);
  // The reticle stays the same pixel size on an ultrawide display. Express
  // its horizontal clearance in height-relative units beyond16:9, rather
  // than demanding a larger physical shoulder just because more wall is seen.
  const horizontalClearance = .08 * Math.min(1, (16 / 9) / aspect);
  const aimGap = Math.max(Math.max(minX, -maxX) / horizontalClearance, Math.max(minY, -maxY) / .07);
  const penalty = outside ** 2 * 100 + Math.max(0, height - .62) ** 2 * 12
    + Math.max(0, 1 - aimGap) ** 2 * 3;
  return {penalty, neededFov: THREE.MathUtils.radToDeg(2 * Math.atan(needed)), height, aimGap,
    bounds: {minX, maxX, minY, maxY}, fits: outside < 1e-5 && height <= .62 && aimGap >= 1};
}

// A shoulder family, not an orbit around a puzzle target. Both shoulders are
// bounded; the camera never chooses a yaw, pitch, actor pose or aiming point.
export const MECHANISM_CAMERA_OFFSETS = Object.freeze([6.5, 8].flatMap(rear =>
  [3, -3].flatMap(side => [0, 1.8, 3.2].map(rise => Object.freeze({rear, side, rise})))));
