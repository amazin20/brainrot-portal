import {Body, Box, Vec3} from 'cannon-es';

const EPS = 1e-10, AXES = [new Vec3(1, 0, 0), new Vec3(0, 1, 0), new Vec3(0, 0, 1)];
const finite = v => v && ['x', 'y', 'z'].every(k => Number.isFinite(v[k]));
const unit = q => finite(q) && Number.isFinite(q.w)
  && Math.abs(q.x*q.x + q.y*q.y + q.z*q.z + q.w*q.w - 1) <= 1e-8;
const positive = v => finite(v) && Math.min(v.x, v.y, v.z) > 0;
const radius = (box, axis) => box.axes.reduce((n, e, i) =>
  n + [box.half.x, box.half.y, box.half.z][i] * Math.abs(e.dot(axis)), 0);

/** Actual native Box transform. Shape offsets and local orientations belong to
 * the existing body; neither the registry AABB nor a replacement body is used. */
export function exactTransitBoxPose(body, position = body?.position) {
  const shape = body?.shapes?.[0], offset = body?.shapeOffsets?.[0], local = body?.shapeOrientations?.[0];
  if (!(body instanceof Body) || body.shapes.length !== 1 || !(shape instanceof Box)
    || shape.body !== body || !positive(shape.halfExtents) || !finite(offset)
    || !finite(position) || !unit(body.quaternion) || !unit(local)) return null;
  const quaternion = body.quaternion.mult(local);
  return {body, shape, half: shape.halfExtents.clone(),
    center: body.quaternion.vmult(offset).vadd(position),
    axes: AXES.map(axis => quaternion.vmult(axis))};
}

function separatingAxes(a, b) {
  const result = [...a.axes, ...b.axes];
  for (const x of a.axes) for (const y of b.axes) {
    const n = x.cross(y);
    if (n.lengthSquared() > 1e-16) { n.normalize(); result.push(n); }
  }
  return result;
}

/** Exact interval SAT for two fixed-orientation Boxes and a translating cargo.
 * Strict intersection excludes tangent motion and a touching box moving away.
 * Initial penetration uses the shortest normalized separating-axis escape.
 * Deterministic axis order is A faces, B faces, then the nine edge crosses. */
export function sweepExactTransitBox(start, target, obstacle) {
  const delta = start.center.vsub(obstacle.center), travel = target.center.vsub(start.center);
  const axes = separatingAxes(start, obstacle);
  let gap = -Infinity, escape = null, enter = 0, leave = 1, normal = null;
  for (const axis of axes) {
    const distance = delta.dot(axis), rate = travel.dot(axis), size = radius(start, axis) + radius(obstacle, axis);
    const separation = Math.abs(distance) - size;
    if (separation > gap) {
      gap = separation;
      const sign = distance > EPS ? 1 : distance < -EPS ? -1 : rate > 0 ? -1 : 1;
      escape = axis.scale(sign);
    }
  }
  if (gap < -EPS) return {t: 0, normal: escape, overlap: true, depth: -gap};
  for (const axis of axes) {
    const distance = delta.dot(axis), rate = travel.dot(axis), size = radius(start, axis) + radius(obstacle, axis);
    if (Math.abs(rate) <= EPS) {
      if (Math.abs(distance) >= size - EPS) return null;
      continue;
    }
    let near = (-size - distance) / rate, far = (size - distance) / rate;
    if (near > far) [near, far] = [far, near];
    if (near > enter || (normal === null && near >= -EPS)) {
      enter = Math.max(0, near); normal = axis.scale(rate > 0 ? -1 : 1);
    }
    leave = Math.min(leave, far);
    if (enter >= leave - EPS || leave <= EPS || enter >= 1) return null;
  }
  return normal ? {t: enter, normal, overlap: false, depth: 0} : null;
}

/** Preserve the existing transit registry, ignore list, ramp exclusion and
 * kinematic endpoint policy. Unsupported eligible ownership falls back before
 * any body, carry target, interpolation, velocity or broadphase write. */
function prepare(physics, from, ignoreIds) {
  const body = physics.cargoBody, cargo = exactTransitBoxPose(body);
  if (!cargo || !finite(from) || !finite(body.velocity)) return null;
  const ignored = new Set(ignoreIds), obstacles = [];
  for (const [id, item] of physics.solids) {
    const solid = item?.body;
    if (ignored.has(id)) continue;
    if (!item || !solid) return null;
    if (!solid.collisionFilterMask || item.kind === 'ramp') continue;
    if (!(solid instanceof Body) || ![Body.STATIC, Body.KINEMATIC].includes(solid.type)
      || solid.mass !== 0 || !positive(item.half)) return null;
    const center = solid.type === Body.KINEMATIC && item.remaining > 0 ? item.target : solid.position;
    const box = exactTransitBoxPose(solid, center);
    if (!box || ['x', 'y', 'z'].some(k => Math.abs(box.half[k] - item.half[k]) > EPS)) return null;
    obstacles.push({id, box});
  }
  return {body, cargo, obstacles};
}

/** Room-local opt-in for the destination segment of a portal transfer. This
 * refines its old coarse expanded AABB; Cannon's ordinary contact shapes and
 * integration remain unchanged. null means atomic legacy fallback. */
export function resolveExactBoxPortalTransit(physics, from, {ignoreIds = []} = {}) {
  const ready = prepare(physics, from, ignoreIds);
  if (!ready) return null;
  const {body, cargo, obstacles} = ready, start = new Vec3(from.x, from.y, from.z);
  const target = body.position.clone(), original = body.position.clone(), margin = .0001;
  const extent = new Vec3(...AXES.map(axis => radius(cargo, axis)));
  let contacts = 0;
  for (let pass = 0; pass < 8; pass++) {
    const a = exactTransitBoxPose(body, start), b = exactTransitBoxPose(body, target);
    let first = null;
    for (const obstacle of obstacles) {
      const hit = sweepExactTransitBox(a, b, obstacle.box);
      if (hit && (!first || hit.t < first.t)) first = hit;
    }
    if (!first) { start.copy(target); break; }
    const {normal} = first;
    if (first.overlap) start.vadd(normal.scale(first.depth + margin), start);
    else {
      start.vadd(target.vsub(start).scale(first.t), start);
      start.vadd(normal.scale(margin), start);
    }
    const inward = target.vsub(start).dot(normal);
    if (inward < 0) target.vsub(normal.scale(inward), target);
    const inwardVelocity = body.velocity.dot(normal);
    if (inwardVelocity < 0) body.velocity.vsub(normal.scale(inwardVelocity), body.velocity);
    contacts++;
  }
  body.position.copy(start);
  const correction = body.position.vsub(original);
  physics.carryTarget?.position.vadd(correction, physics.carryTarget.position);
  body.previousPosition.copy(body.position); body.interpolatedPosition.copy(body.position);
  body.aabbNeedsUpdate = true; physics.world.broadphase.dirty = true;
  physics.portalTransitContacts = (physics.portalTransitContacts || 0) + contacts;
  return {contacts, position: body.position.clone(), extent, mode: 'oriented-sat-v1'};
}
