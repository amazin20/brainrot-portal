import * as THREE from 'three';

// This is an opt-in affordance of the velocity relay, never campaign aim lock.
export const VELOCITY_ASSIST = Object.freeze({
  aimAngle: THREE.MathUtils.degToRad(18), aimRange: 200,
  approachDistance: 26, approachTime: 1.1, maximumMiss: 6,
  acceleration: 26, minimumClosingSpeed: 6,
});
const V = () => new THREE.Vector3();
const GRAVITY = new THREE.Vector3(0, -19.5, 0);

/** Select only the current lesson's same-colour relay. The trace callback uses
 * the weapon's real first-blocker query, including its tilted support rules.
 * Returned points guide a visible charge; they never install a portal. */
export function findVelocityAimTarget(game, slot, trace) {
  if (!game.epicMode || ![0, 1].includes(slot) || typeof trace !== 'function') return null;
  const targets = game.firstLevel?.getShotTargets?.() || [];
  const camera = game.camera;
  if (!camera || !targets.length) return null;
  const origin = camera.getWorldPosition(V()), forward = camera.getWorldDirection(V());
  let best = null;
  for (const target of targets) {
    const panel = target.panel;
    if (target.slot !== slot || !panel?.userData.portalable
      || !game.aimBlockers.includes(panel) || !game.isActiveBlocker(panel)) continue;
    const frame = panel.userData.portalFrame?.() || panel.userData;
    const point = frame.center?.clone() || panel.getWorldPosition(V());
    const direction = point.clone().sub(origin), distance = direction.length();
    if (distance < .1 || distance > VELOCITY_ASSIST.aimRange) continue;
    direction.divideScalar(distance);
    const angle = forward.angleTo(direction);
    if (angle > VELOCITY_ASSIST.aimAngle || (frame.normal && direction.dot(frame.normal) >= -.02)) continue;
    const ndc = point.clone().project(camera);
    // The centre must be visibly on screen, even with a narrow portrait FOV.
    if (ndc.z < -1 || ndc.z > 1 || Math.abs(ndc.x) > .94 || Math.abs(ndc.y) > .94) continue;
    if (best && angle >= best.angle) continue;
    const hit = trace(origin, direction, distance + .06);
    if (!hit || hit.object !== panel) continue;
    best = { ...target, point, ndc, angle, distance };
  }
  return best;
}

function arrivalTime(distance, velocity, acceleration) {
  if (Math.abs(acceleration) < 1e-8) return -distance / velocity;
  const discriminant = velocity * velocity - 2 * acceleration * distance;
  if (discriminant < 0) return Infinity;
  const root = Math.sqrt(discriminant);
  const times = [(-velocity - root) / acceleration, (-velocity + root) / acceleration].filter(t => t > 0);
  return times.length ? Math.min(...times) : Infinity;
}

/** An actual acceleration in the plane of an already installed relay. It
 * corrects a modest predicted miss but preserves approach momentum and leaves
 * wall/capsule collision and the exact portal aperture fully authoritative.
 * No position, camera, portal or level-progression state is changed. */
export function applyVelocityFlightAssist(game, dt) {
  if (!game.epicMode || game.playerGrounded || !game.portals?.ready || !(dt > 0)) return null;
  const target = game.firstLevel?.getFlightTarget?.();
  if (!target?.panel || ![0, 1].includes(target.slot)
    || game.portalSurfaceIds?.[target.slot] !== target.panel.uuid) return null;
  const portal = game.portals.portals[target.slot];
  if (!portal) return null;
  const velocity = game.playerVelocity;
  const center = game.playerPosition.clone().add(new THREE.Vector3(0, 1.2, 0));
  const offset = center.clone().sub(portal.position), distance = offset.dot(portal.normal);
  const closing = velocity.dot(portal.normal);
  if (distance <= 0 || distance > VELOCITY_ASSIST.approachDistance
    || closing >= -VELOCITY_ASSIST.minimumClosingSpeed) return null;
  const time = arrivalTime(distance, closing, GRAVITY.dot(portal.normal));
  if (!Number.isFinite(time) || time > VELOCITY_ASSIST.approachTime || time < dt * .5) return null;
  const miss = offset.addScaledVector(velocity, time).addScaledVector(GRAVITY, .5 * time * time);
  miss.addScaledVector(portal.normal, -miss.dot(portal.normal));
  if (miss.length() > VELOCITY_ASSIST.maximumMiss) return null;
  const local = miss.clone().applyQuaternion(portal.quaternion.clone().invert());
  const width = Math.max(.1, portal.width - .43), height = Math.max(.1, portal.height - .43);
  // Leave a well-centred ballistic path exact. A small safe ellipse also
  // avoids last-millisecond oscillation and preserves manual micro-steering.
  if ((local.x / width) ** 2 + (local.y / height) ** 2 < .36) return null;
  const acceleration = miss.multiplyScalar(-2 / Math.max(time * time, .0144));
  acceleration.clampLength(0, VELOCITY_ASSIST.acceleration);
  velocity.addScaledVector(acceleration, dt);
  return acceleration;
}
