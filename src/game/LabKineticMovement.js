import * as THREE from 'three';
import { sweepBox } from './LabSweep.js';
import {sweepRampContact} from './LabRampContact.js';
import { applyVelocityFlightAssist } from './LabVelocityAssist.js';

// Separate, opt-in tuning: the puzzle campaign retains its authored timing.
export const KINETIC_MOVEMENT = Object.freeze({
  cruise: 7.8, sprint: 15, jump: 9.6, maximumSpeed: 52,
  groundAcceleration: 42, groundBrake: 34, airAcceleration: 8,
  airBrake: 12, slideDrag: .03, slideMinimum: 4,
});

const clamp = THREE.MathUtils.clamp;
const approach = (current, target, amount) => current + clamp(target - current, -amount, amount);

/** Input changes the momentum vector, never replaces a portal/launcher impulse. */
export function updateKineticVelocity(game, dt, move, { sprint = false } = {}) {
  const velocity = game.playerVelocity, keys = game.input.keys;
  const state = game.kinetic ??= {};
  const inputLength = Math.min(1, move.length());
  const wish = new THREE.Vector3(move.x, 0, move.y).applyAxisAngle(new THREE.Vector3(0, 1, 0), game.yaw);
  if (inputLength > 0) wish.normalize();
  let speed = Math.hypot(velocity.x, velocity.z);
  const slideHeld = Boolean(game.slideHeld || keys.has('KeyC'));
  state.sliding = game.playerGrounded && slideHeld && speed > KINETIC_MOVEMENT.slideMinimum;
  state.sprinting = sprint && inputLength > 0 && !state.sliding;
  const targetSpeed = (sprint ? KINETIC_MOVEMENT.sprint : KINETIC_MOVEMENT.cruise) * inputLength;
  const heading = speed > 1e-8 ? Math.atan2(velocity.x, velocity.z) : Math.atan2(wish.x, wish.z);
  const desiredHeading = Math.atan2(wish.x, wish.z);
  const angle = inputLength ? Math.atan2(Math.sin(desiredHeading - heading), Math.cos(desiredHeading - heading)) : 0;
  const reverse = inputLength > 0 && Math.abs(angle) > Math.PI * .62;
  let nextHeading = heading;

  if (state.sliding) {
    // A real momentum slide: no scripted boost, and 97% retention after 1 s.
    speed *= Math.exp(-KINETIC_MOVEMENT.slideDrag * dt);
    if (inputLength) nextHeading += clamp(angle, -.75 * dt, .75 * dt);
  } else if (game.playerGrounded) {
    if (!inputLength) speed = approach(speed, 0, KINETIC_MOVEMENT.groundBrake * dt);
    else if (reverse && speed > .3) speed = approach(speed, 0, KINETIC_MOVEMENT.groundBrake * 1.35 * dt);
    else {
      const turnRate = speed > KINETIC_MOVEMENT.sprint ? 3 : 9;
      nextHeading += clamp(angle, -turnRate * dt, turnRate * dt);
      // Holding the exit direction preserves earned overspeed on landing.
      // Releasing input remains an intentional, responsive brake.
      speed = speed > targetSpeed + .01
        ? Math.max(targetSpeed, speed - .6 * dt)
        : approach(speed, targetSpeed, KINETIC_MOVEMENT.groundAcceleration * dt);
    }
  } else if (inputLength) {
    if (reverse && speed > .3) speed = approach(speed, 0, KINETIC_MOVEMENT.airBrake * dt);
    else {
      const turnRate = clamp(12 / Math.max(speed, 1), .24, 2.4);
      nextHeading += clamp(angle, -turnRate * dt, turnRate * dt);
      if (speed < targetSpeed) speed = Math.min(targetSpeed, speed + KINETIC_MOVEMENT.airAcceleration * dt);
    }
  }
  // With no airborne input these assignments retain both planar components.
  if (game.playerGrounded || inputLength || state.sliding) {
    if (speed <= .3 && reverse) nextHeading = desiredHeading;
    velocity.x = Math.sin(nextHeading) * speed;
    velocity.z = Math.cos(nextHeading) * speed;
  }

  game.coyoteTime = game.playerGrounded ? .1 : Math.max(0, (game.coyoteTime || 0) - dt);
  game.jumpBuffer = game.input.consumeJump() ? .12 : Math.max(0, (game.jumpBuffer || 0) - dt);
  game.jumpWindup = 0;
  if (game.jumpBuffer > 0 && game.coyoteTime > 0) {
    // Jump input takes effect on this physics tick, even when sliding.
    velocity.y = KINETIC_MOVEMENT.jump;
    game.playerGrounded = false;
    game.coyoteTime = game.jumpBuffer = 0;
    state.sliding = false;
    game.animator.triggerJump?.();
    game.audio.jump();
  }
  state.guidance = Boolean(applyVelocityFlightAssist(game, dt));
  limitKineticSpeed(velocity);
  state.speed = velocity.length();
  state.planarSpeed = Math.hypot(velocity.x, velocity.z);
}

export function limitKineticSpeed(velocity) {
  const magnitude = velocity.length();
  if (magnitude > KINETIC_MOVEMENT.maximumSpeed) velocity.multiplyScalar(KINETIC_MOVEMENT.maximumSpeed / magnitude);
}

/** Sweep the entire body against solid volumes, removing only contact-normal
 * momentum. Up to four contacts handle corners without tunnelling thin walls.
 * Portal TOI clips the source-world search: geometry behind a crossed portal
 * cannot consume its impulse. The destination segment is swept separately. */
export function sweepKineticBody(game, position, previous, velocity, radius, height, { portalLimit = true } = {}) {
  const from = previous.clone(), target = position.clone();
  const min = new THREE.Vector3(), max = new THREE.Vector3();
  const center = new THREE.Vector3(), hitPosition = new THREE.Vector3();
  let grounded = false;
  for (let pass = 0; pass < 4; pass++) {
    const delta = target.clone().sub(from);
    if (delta.lengthSq() < 1e-14) break;
    let contact = null;
    const predictedPortal = portalLimit && game.portals.ready
      ? game.portals.tryTeleport(target.clone().add(new THREE.Vector3(0, height / 2, 0)),
        from.clone().add(new THREE.Vector3(0, height / 2, 0)), velocity, radius)
      : null;
    const portalFraction = predictedPortal?.crossingFraction ?? 1;
    for (const collider of game.colliders) {
      if (!collider.enabled || (collider.walkablePlane && !collider.solidUnderside)) continue;
      const box = collider.box;
      // Match production broad-phase rejection for tilted authored surfaces.
      if (collider.frontPlane) {
        const face = collider.frontPlane();
        const extent = radius + (height / 2 - radius) * Math.abs(face.normal.y);
        if (center.copy(target).add(new THREE.Vector3(0, height / 2, 0)).sub(face.center).dot(face.normal) > extent + .05) continue;
        if (collider.solidUnderside && target.clone().sub(face.center).dot(face.normal) >= -.035) continue;
      }
      min.set(box.min.x - radius, box.min.y - height, box.min.z - radius);
      max.set(box.max.x + radius, box.max.y, box.max.z + radius);
      const hit = sweepBox(from, target, min, max);
      if (!hit || hit.t > portalFraction + 1e-8 || velocity[hit.axis] * hit.sign >= 0) continue;
      hitPosition.copy(from).lerp(target, hit.t);
      center.copy(hitPosition).y += height / 2;
      if (game.portalOpensCollider(collider, center, radius)) continue;
      // Preserve the existing grounded step-up affordance for small lips.
      if (hit.axis !== 'y' && game.playerGrounded
        && box.max.y > from.y && box.max.y - from.y <= .37) continue;
      if (!contact || hit.t < contact.t) contact = hit;
    }
    for(const ramp of game.ramps||[]){
      const hit=sweepRampContact(ramp,from,target,radius,height);
      if(hit&&hit.t<=portalFraction+1e-8&&(!contact||hit.t<contact.t))contact=hit;
    }
    if (!contact) { from.copy(target); break; }
    if(contact.normal){
      from.lerp(target,contact.t).addScaledVector(contact.normal,.0001);
      const remaining=delta.multiplyScalar(1-contact.t),inward=remaining.dot(contact.normal);
      if(inward<0)remaining.addScaledVector(contact.normal,-inward);
      target.copy(from).add(remaining);
      const normalSpeed=velocity.dot(contact.normal);
      if(normalSpeed<0)velocity.addScaledVector(contact.normal,-normalSpeed);
      grounded ||= contact.kind==='ramp-top';
      continue;
    }
    from.lerp(target, contact.t);
    from[contact.axis] += contact.sign * .0001;
    const remaining = delta.multiplyScalar(1 - contact.t);
    remaining[contact.axis] = 0;
    target.copy(from).add(remaining);
    if (contact.axis === 'y' && contact.sign > 0) grounded = true;
    velocity[contact.axis] = 0;
  }
  position.copy(from);
  return grounded;
}
