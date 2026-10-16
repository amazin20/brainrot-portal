import * as THREE from 'three';
import { LabCameraBroadPhase } from './LabCameraBroadPhase.js';
import { portalTransformMatrix, portalBacksCollider } from './LabPortals.js';
import {MECHANISM_CAMERA_BUDGET, MECHANISM_CAMERA_FOV, MECHANISM_CAMERA_MAX_REAR, MECHANISM_CAMERA_OFFSETS, measureMechanismFrame} from './LabMechanismCamera.js';

const UP = new THREE.Vector3(0, 1, 0);
const IDENTITY = new THREE.Quaternion();
export const CAMERA_PITCH_MIN = -1.56;
export const CAMERA_PITCH_MAX = 1.15;
const SAMPLE_OFFSETS = [
  [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1],
  [Math.SQRT1_2, Math.SQRT1_2], [-Math.SQRT1_2, Math.SQRT1_2],
  [Math.SQRT1_2, -Math.SQRT1_2], [-Math.SQRT1_2, -Math.SQRT1_2],
];

// Exact solution of a critically damped spring for a stationary goal. Unlike
// Euler integration it cannot explode or oscillate at a low render rate.
function spring(value, velocity, goal, frequency, dt) {
  const displacement = value - goal;
  const impulse = velocity + frequency * displacement;
  const decay = Math.exp(-frequency * dt);
  return [
    goal + (displacement + impulse * dt) * decay,
    (velocity - frequency * impulse * dt) * decay,
  ];
}

/**
 * Third-person camera. `target` is the player's world-space foot position.
 * Keep the blockers array itself alive: moving doors / added walls may share it.
 * Call reset after spawning; linked passages use applyPortalTransform.
 * This module never changes player meshes, materials, or the renderer.
 */
export class LabCamera {
  constructor({ camera, blockers = [], isBlocker = () => true, epic = false, dynamicFov = true, fullBodyFraming = false, currentBlocker = null, currentBlockersValid = null }) {
    this.camera = camera;
    this.blockers = blockers;
    this.isBlocker = isBlocker;
    this.currentBlocker = currentBlocker;
    this.currentBlockersValid = currentBlockersValid;
    this.foundation20EscapeOffset = null;
    this.currentBlockerMeshes = new WeakMap();
    this.currentBlockerSources = new WeakMap();
    this.queryBlockers = blockers;
    this.focus = new THREE.Vector3();
    this.focusVelocity = new THREE.Vector3();
    this.lastTarget = new THREE.Vector3();
    this.goal = new THREE.Vector3();
    this.playerPivot = new THREE.Vector3();
    this.forward = new THREE.Vector3();
    this.right = new THREE.Vector3();
    this.desired = new THREE.Vector3();
    this.boomDirection = new THREE.Vector3();
    this.lookPoint = new THREE.Vector3();
    this.portalFramingPoint = new THREE.Vector3();
    this.castDirection = new THREE.Vector3();
    this.castRight = new THREE.Vector3();
    this.castUp = new THREE.Vector3();
    this.castOrigin = new THREE.Vector3();
    this.clipDirection = new THREE.Vector3();
    this.silhouettePoint = new THREE.Vector3();
    this.avoidance = new THREE.Vector3();
    this.avoidanceVelocity = new THREE.Vector3();
    this.avoidanceActive = false;
    this.raycaster = new THREE.Raycaster();
    this.broadPhase = new LabCameraBroadPhase();
    this.rayHits = [];
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.orbitQuaternion = new THREE.Quaternion();
    this.portalOrientation = new THREE.Quaternion();
    this.portalUpOrientation = new THREE.Quaternion();
    this.viewUp = UP.clone();
    this.portalExit = null;
    this.portalFramingActive = false;
    this.inclinedFraming = false;
    this.portalClipPlane = new THREE.Plane();
    this.mainClippingPlanes = [];
    this.yaw = 0;
    this.pitch = -0.2;
    this.yawVelocity = 0;
    this.pitchVelocity = 0;
    this.distance = 6.5;
    this.distanceVelocity = 0;
    this.fovVelocity = 0;
    this.aimBlend = 0;
    this.aimBlendVelocity = 0;
    this.initialized = false;
    this.obstructed = false;
    this.epicMode = !!epic;
    this.dynamicFov = dynamicFov !== false;
    this.epicFraming = 0;
    this.epicFramingVelocity = 0;
    // Large vertical mechanisms need more room below an upward centre ray.
    // Keep this chamber-specific: existing campaign camera contracts retain
    // their exact lens and FOV unless the chamber explicitly opts in.
    this.fullBodyFraming = !!fullBodyFraming;
    this.confinedFraming = false;
    this.foundation20Framing = false;
    this.upwardBackoff = 0;
    this.upwardBackoffVelocity = 0;
    this.mechanismFramingEnabled = this.mechanismFramingActive = false;
    this.mechanismCurrentBlocker = this.mechanismCurrentBlockersValid = null;
    this.mechanismEscape = null;
    this.mechanismHadObstruction = false;
    this.mechanismSubjectRotation = null;
    this.mechanismLensGoal = 0;
    this.mechanismStats = {candidateBudget: MECHANISM_CAMERA_BUDGET, candidates: 0, cacheHit: false};
    this.queryStats = {sweeps: 0, rays: 0, candidateMeshes: 0};
  }

  configureEpic({ enabled = this.epicMode, dynamicFov = this.dynamicFov } = {}) {
    this.epicMode = !!enabled;
    this.dynamicFov = dynamicFov !== false;
    return this;
  }

  configureSilhouette({ enabled = this.fullBodyFraming, confined = false, foundation20 = false } = {}) {
    this.foundation20EscapeOffset = null;
    this.fullBodyFraming = !!enabled;
    this.confinedFraming = !!confined;
    this.foundation20Framing = Boolean(foundation20 && enabled && confined);
    return this;
  }

  configureMechanismFraming({enabled = false, currentBlocker = null, currentBlockersValid = null} = {}) {
    this.mechanismFramingEnabled = !!enabled;
    this.mechanismFramingActive = false;
    this.mechanismCurrentBlocker = currentBlocker;
    this.mechanismCurrentBlockersValid = currentBlockersValid;
    this.mechanismEscape = null;this.mechanismLensGoal = 0;this.mechanismHadObstruction = false;
    return this;
  }

  updateCurrentBlockers() {
    const provider = this.foundation20Framing ? this.currentBlocker
      : this.mechanismFramingActive ? this.mechanismCurrentBlocker : null;
    if (!provider) { this.queryBlockers = this.blockers; return; }
    // These private query meshes never enter the scene or any aim/physics
    // collection. Keep every original blocker and map each valid owned proxy
    // to its exact current physical Box; all original hit policies still run.
    this.queryBlockers = this.blockers.map(source => {
      const descriptor = provider(source);
      if (!descriptor) return source;
      let mesh = this.currentBlockerMeshes.get(source);
      if (!mesh) {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), source.material);
        this.currentBlockerMeshes.set(source, mesh);this.currentBlockerSources.set(mesh, source);
      }
      mesh.material = source.material;mesh.layers.mask = source.layers.mask;
      mesh.position.copy(descriptor.current.center);mesh.quaternion.copy(descriptor.current.quaternion);
      mesh.scale.copy(descriptor.half).multiplyScalar(2);mesh.updateMatrixWorld(true);
      return mesh;
    });
  }

  reusableFoundation20Escape() {
    if (!this.foundation20Framing || !this.foundation20EscapeOffset) return null;
    // An offset is only a search hint. Rebuild its endpoint around the actual
    // current actor and reject it unless every owned moving Box is fresh and
    // the current cap sweep and unchanged look point still admit the full gun.
    if (this.currentBlockersValid?.() !== true) { this.foundation20EscapeOffset = null; return null; }
    const candidate = this.playerPivot.clone().add(this.foundation20EscapeOffset);
    if (this.constrain(this.playerPivot, candidate, 120)
      || candidate.distanceTo(this.playerPivot) < 2.4 || this.silhouetteFovAt(candidate) > 120) {
      this.foundation20EscapeOffset = null; return null;
    }
    return candidate;
  }

  reset(target, yaw = 0, pitch = -0.2) {
    this.foundation20EscapeOffset = null;
    this.mechanismEscape = null;this.mechanismLensGoal = 0;this.mechanismHadObstruction = false;
    this.broadPhase.clear(); this.rayHits.length = 0;
    this.focus.copy(target).y += 1.32;
    this.lastTarget.copy(target);
    this.focusVelocity.set(0, 0, 0);
    this.portalOrientation.identity();
    this.portalUpOrientation.identity();
    this.portalExit = null;
    this.portalFramingActive = false;
    this.inclinedFraming = false;
    this.mainClippingPlanes.length = 0;
    this.avoidance.set(0, 0, 0); this.avoidanceVelocity.set(0, 0, 0); this.avoidanceActive = false;
    this.yaw = yaw;
    this.pitch = THREE.MathUtils.clamp(pitch, CAMERA_PITCH_MIN, CAMERA_PITCH_MAX);
    this.yawVelocity = 0;
    this.pitchVelocity = 0;
    this.distance = 6.5;
    this.distanceVelocity = 0;
    this.fovVelocity = 0;
    this.aimBlend = 0;
    this.aimBlendVelocity = 0;
    this.epicFraming = this.epicFramingVelocity = 0;
    this.upwardBackoff = this.upwardBackoffVelocity = 0;
    this.camera.fov = this.epicMode ? 68 : 62;
    this.camera.updateProjectionMatrix();
    this.initialized = true;
    return this.update({ dt: 0, target, yaw, pitch });
  }

  /** Carry the live rig through the same rigid mapping as the visible portal
   * camera. Respawns use reset(); portals preserve spring momentum, aim, FOV
   * and boom length. Any capsule safety correction is followed by the existing
   * focus spring rather than added as an instantaneous full-screen translation.
   * `target` is the final destination foot position after physical clearance.
   * The returned yaw/pitch replace the game's orbit controls exactly once. */
  applyPortalTransform(entryOrMatrix, exit, { target, yaw = this.yaw, pitch = this.pitch, clipExit = true } = {}) {
    this.foundation20EscapeOffset = null;
    this.mechanismEscape = null;
    this.mechanismHadObstruction = false;
    const matrix = entryOrMatrix?.isMatrix4 ? entryOrMatrix : portalTransformMatrix(entryOrMatrix, exit);
    const rotation = new THREE.Quaternion().setFromRotationMatrix(matrix).normalize();
    const control = rotation.clone().multiply(this.portalOrientation).multiply(
      new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ')));
    const currentOrbit = this.portalOrientation.clone().multiply(new THREE.Quaternion().setFromEuler(
      new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ')));
    const transportedOrbit = rotation.clone().multiply(currentOrbit);
    const angles = new THREE.Euler().setFromQuaternion(transportedOrbit, 'YXZ');
    const newYaw = angles.y;
    // The transported lens retains the exact view at the aperture, but the
    // player's gravity-relative mouse pitch must not become a permanent look
    // at the ceiling after a floor/wall passage. Recover toward the pitch the
    // player selected; portalOrientation holds the temporary rigid rotation.
    const newPitch = THREE.MathUtils.clamp(this.pitch, CAMERA_PITCH_MIN, CAMERA_PITCH_MAX);
    // Euler rates are basis dependent: transport a tiny tangent step instead
    // of discarding velocity or treating a floor exit as a yaw-only rotation.
    const tangent = rotation.clone().multiply(this.portalOrientation).multiply(new THREE.Quaternion().setFromEuler(
      new THREE.Euler(this.pitch + this.pitchVelocity * 1e-4, this.yaw + this.yawVelocity * 1e-4, 0, 'YXZ')));
    const tangentAngles = new THREE.Euler().setFromQuaternion(tangent, 'YXZ');
    this.yawVelocity = Math.atan2(Math.sin(tangentAngles.y - newYaw), Math.cos(tangentAngles.y - newYaw)) / 1e-4;
    this.pitchVelocity = (tangentAngles.x - angles.x) / 1e-4;
    // Yaw is undefined at a vertical view. Do not turn its Euler singularity
    // into thousands of radians per second after a floor-to-wall passage.
    if (Math.abs(Math.cos(angles.x)) < .12) this.yawVelocity = this.pitchVelocity = 0;
    this.yaw = newYaw; this.pitch = newPitch;
    const uprightOrbit = new THREE.Quaternion().setFromEuler(new THREE.Euler(newPitch, newYaw, 0, 'YXZ'));
    this.portalOrientation.copy(transportedOrbit).multiply(uprightOrbit.invert()).normalize();
    this.portalUpOrientation.premultiply(rotation).normalize();
    for (const point of [this.focus, this.lastTarget, this.goal, this.playerPivot, this.desired, this.lookPoint]) point.applyMatrix4(matrix);
    for (const direction of [this.focusVelocity, this.forward, this.right, this.boomDirection, this.viewUp, this.avoidance, this.avoidanceVelocity]) direction.applyQuaternion(rotation);
    if (target) this.lastTarget.copy(target);
    this.camera.position.applyMatrix4(matrix);
    this.camera.quaternion.premultiply(rotation);
    this.camera.up.applyQuaternion(rotation);
    this.camera.updateMatrixWorld(true);
    this.camera.updateProjectionMatrix();
    const vertical = Math.abs(exit?.normal?.y ?? 0);
    this.inclinedFraming = vertical > .001 && vertical < .999;
    this.portalExit = clipExit && exit?.normal ? exit : null;
    this.portalFramingActive = false;
    this.updatePortalClipping();
    const controls = new THREE.Euler().setFromQuaternion(control, 'YXZ');
    return { yaw: controls.y, pitch: THREE.MathUtils.clamp(pitch, CAMERA_PITCH_MIN, CAMERA_PITCH_MAX), rotation };
  }

  update({ dt, target, yaw, pitch, velocity, aiming = false, teleported = false,
    epic = this.epicMode, dynamicFov = this.dynamicFov, rampFraming = false,
    mechanismFraming = false, subjectRotation = null }) {
    this.mechanismFramingActive = Boolean(this.mechanismFramingEnabled && mechanismFraming && !this.foundation20Framing);
    this.mechanismSubjectRotation = subjectRotation;
    this.mechanismStats = {candidateBudget: MECHANISM_CAMERA_BUDGET, candidates: 0, cacheHit: false};
    this.queryStats = {sweeps: 0, rays: 0, candidateMeshes: 0};
    if (!this.mechanismFramingActive) {this.mechanismEscape = null;this.mechanismLensGoal = 0;this.mechanismHadObstruction = false;}
    this.rampFraming = rampFraming;
    this.epicMode = !!epic;
    this.dynamicFov = dynamicFov !== false;
    if (!this.initialized || teleported || this.lastTarget.distanceToSquared(target) > 64) {
      return this.reset(target, yaw, pitch);
    }
    const step = Math.min(Math.max(Number.isFinite(dt) ? dt : 0, 0), 0.1);
    this.lastTarget.copy(target);
    this.playerPivot.copy(target).y += 1.32;
    // Clipping only bridges the lens that still trails a traveller emerging
    // in front of an exit. Walking around the panel onto its back side ends
    // that transit even if the lens never crossed the plane itself. Keeping
    // the old plane there would discard the traveller and the whole room.
    const exit = this.portalExit;
    if (exit && this.playerPivot.dot(exit.normal) - exit.position.dot(exit.normal) < -.6) {
      this.portalExit = null;
      this.mainClippingPlanes.length = 0;
    }
    this.goal.copy(this.playerPivot);
    const speed = velocity ? Math.hypot(velocity.x, velocity.z) : 0;
    // Full physical speed includes vertical dives and launches. This changes
    // composition only: the control ray, horizon, recoil and capsule stay intact.
    const flightSpeed = velocity ? Math.hypot(...['x', 'y', 'z'].map(axis =>
      Number.isFinite(velocity[axis]) ? velocity[axis] : 0)) : 0;
    const epicSpeed = epic ? THREE.MathUtils.smoothstep(flightSpeed, 8, 36) : 0;
    [this.epicFraming, this.epicFramingVelocity] = spring(
      this.epicFraming, this.epicFramingVelocity, epic ? .35 + (dynamicFov ? epicSpeed * .8 : 0) : 0, 7, step,
    );
    // Less than half a metre of anticipation. The camera has no head bob, roll,
    // shake, or vertical velocity look-ahead, keeping jumps readable and calm.
    if (speed > 0.001) {
      const anticipation = Math.min(speed * 0.065, 0.42) / speed;
      this.goal.x += velocity.x * anticipation;
      this.goal.z += velocity.z * anticipation;
    }
    for (const axis of ['x', 'y', 'z']) {
      [this.focus[axis], this.focusVelocity[axis]] = spring(
        this.focus[axis], this.focusVelocity[axis], this.goal[axis], axis === 'y' ? 16 : 22, step,
      );
    }
    const yawGoal = this.yaw + Math.atan2(Math.sin(yaw - this.yaw), Math.cos(yaw - this.yaw));
    [this.yaw, this.yawVelocity] = spring(this.yaw, this.yawVelocity, yawGoal, 38, step);
    [this.pitch, this.pitchVelocity] = spring(
      this.pitch, this.pitchVelocity, THREE.MathUtils.clamp(pitch, CAMERA_PITCH_MIN, CAMERA_PITCH_MAX), 38, step,
    );
    // A shot must never move the whole frame. Even an explicit aim change moves
    // the shoulder and boom continuously instead of switching their direction
    // in one frame (which used to look like recoil despite a smooth FOV).
    [this.aimBlend, this.aimBlendVelocity] = spring(
      this.aimBlend, this.aimBlendVelocity, aiming ? 1 : 0, 12, step,
    );
    // At steep upward aim the ground clamps the boom's low end; the old
    // 62-degree lens then aimed above the feet even in an empty chamber.
    // Recover composition with a continuous horizontal retreat plus a
    // bounded wide lens. The unchanged 16 m look point still defines the
    // screen-centre shot; no player, reticle or weapon ray is substituted.
    const upwardFraming = this.fullBodyFraming
      ? THREE.MathUtils.smoothstep(this.pitch, .35, CAMERA_PITCH_MAX) : 0;
    [this.upwardBackoff, this.upwardBackoffVelocity] = spring(
      this.upwardBackoff, this.upwardBackoffVelocity, upwardFraming * 13, 20, step,
    );
    let fovGoal = (epic
      ? (this.dynamicFov ? (aiming ? 64 + epicSpeed * 6 : 68 + epicSpeed * 14) : 68)
      : aiming ? 59.5 : 62 + THREE.MathUtils.clamp((speed - 4) * 0.4, 0, 2.2))
      + upwardFraming * 20;
    if (this.mechanismFramingActive) fovGoal = Math.min(MECHANISM_CAMERA_FOV, Math.max(fovGoal, this.mechanismLensGoal));
    const oldFov = this.camera.fov;
    [this.camera.fov, this.fovVelocity] = spring(oldFov, this.fovVelocity, fovGoal,
      this.fullBodyFraming && upwardFraming > 0 ? 12 : 7, step);
    if (Math.abs(oldFov - this.camera.fov) > 0.00001) this.camera.updateProjectionMatrix();

    // A wall-to-floor passage initially retains the exact transported view.
    // Gravity returns the horizon gradually; there is no one-frame roll snap.
    this.portalOrientation.slerp(IDENTITY, 1 - Math.exp(-3.8 * step));
    this.portalUpOrientation.slerp(IDENTITY, 1 - Math.exp(-3.8 * step));
    // Keep composition recovery until the transported horizon settles, even
    // after the exit discard plane has gone. Flat transfers/reset clear it.
    if (this.portalUpOrientation.angleTo(IDENTITY) < .01) this.inclinedFraming = false;
    this.orbitQuaternion.setFromEuler(this.euler.set(this.pitch, this.yaw, 0, 'YXZ')).premultiply(this.portalOrientation);
    this.forward.set(0, 0, -1).applyQuaternion(this.orbitQuaternion);
    this.right.set(1, 0, 0).applyQuaternion(this.orbitQuaternion);
    this.viewUp.copy(UP).applyQuaternion(this.portalUpOrientation);
    const length = THREE.MathUtils.lerp(6.5, 5.7, this.aimBlend)
      + this.epicFraming * (1 - .65 * this.aimBlend);
    // Near a vertical downward shot the normal shoulder creates a lateral
    // blind spot directly below the traveller. Follow the already-smoothed
    // orbit into an overhead view; ordinary walking/aiming keeps its shoulder.
    const overhead = THREE.MathUtils.smoothstep(-this.pitch, 1.08, -CAMERA_PITCH_MIN);
    const shoulder = THREE.MathUtils.lerp(1.4, 1.56, this.aimBlend)
      * THREE.MathUtils.lerp(1, .035, overhead)
      * (this.fullBodyFraming ? Math.min(1, this.camera.aspect / .9) : 1);
    this.desired.copy(this.focus).addScaledVector(this.forward, -length)
      .addScaledVector(this.right, shoulder);
    // The normal shoulder view leaves the centre ray beside the visible body.
    // Looking up must not drive the boom underground and force collision to
    // collapse it into the backpack. Keep its low end above the feet while
    // retaining the complete wall/near-plane sweep below. Transported viewUp
    // preserves this construction through floor and tilted portal transitions.
    const belowFocus = this.desired.dot(this.viewUp) - this.focus.dot(this.viewUp);
    if (belowFocus < -.65) this.desired.addScaledVector(this.viewUp, -.65 - belowFocus);
    // Retreat in the transported horizontal plane instead of driving the
    // lens through the ground. This plane follows the same rigid portal
    // mapping as forward/up, preserving the live lens at dt=0 on passage.
    if (this.fullBodyFraming && !this.mechanismFramingActive && this.upwardBackoff > .00001) {
      const horizontal = this.forward.clone().addScaledVector(this.viewUp, -this.forward.dot(this.viewUp)).normalize();
      this.desired.addScaledVector(horizontal, -this.upwardBackoff);
    }
    // The rigidly transported view is exact at dt=0. On subsequent frames
    // gravity still defines the physical floor even while the visual horizon
    // is rolling back. An inclined trailing exit lens is the exception: its back-side
    // geometry is discarded, so forcing it up to the upright traveller would
    // prematurely break the rigid view and retire the exit plane.
    const inclinedExitClip = this.isInclinedExitLens();
    if (step > 0 && !inclinedExitClip && this.blockers.length && this.portalUpOrientation.angleTo(IDENTITY) > .01) {
      this.desired.y = Math.max(this.desired.y, target.y + .67);
    }
    for (const object of this.blockers) object.updateWorldMatrix(true, true);
    this.updateCurrentBlockers();

    this.broadPhase.begin(this.queryBlockers);
    try {
    // Resolve both the smoothed pivot and the actual player. The latter matters
    // when crossing a doorway: a lagging focus must never see through its wall.
    this.obstructed = this.constrain(this.focus, this.desired);
    this.obstructed = this.constrain(this.playerPivot, this.desired) || this.obstructed;
    if (this.mechanismFramingActive && this.obstructed) this.mechanismHadObstruction = true;
    // A straight retracting boom can end inside the head/backpack at a wall.
    // Start routing it upward before it reaches the body, and sweep every
    // alternative against the same walls and near-plane volume. This is camera
    // collision only; neither the player nor its aim controls are moved.
    const directDistance = this.desired.distanceTo(this.playerPivot);
    this.lookPoint.copy(this.focus).addScaledVector(this.forward, 16);
    const avoidGoal = new THREE.Vector3();
    let escapePosition = null;
    if (this.mechanismFramingActive && step > 0) {
      escapePosition = this.mechanismEscapePosition();
      if (escapePosition) {avoidGoal.copy(escapePosition).sub(this.desired);this.avoidanceActive = true;}
      else this.avoidanceActive = false;
    } else if (!this.mechanismFramingActive && (directDistance < (this.avoidanceActive ? 4.1 : 3.1)
      || this.camera.position.distanceTo(this.playerPivot) < 3.1
      || ((this.rampFraming || this.fullBodyFraming) && this.framingPenalty(this.desired) > .005)) && this.blockers.length) {
      const direct = this.desired.clone().sub(this.playerPivot);
      let best = null, bestScore = Infinity;
      const longitudinal = this.forward.clone().setY(0).normalize();
      const heights = this.inclinedFraming ? [2.5, 3, 4, 5.5] : [2.5, 4, 5.5];
      const advances = this.inclinedFraming ? [0, .6, 1.2] : [0];
      // A tilted return makes right non-horizontal. A side-only search can
      // jump to the opposite shoulder at an aperture. Also sample short
      // gravity-horizontal advances; every endpoint uses the same sweep.
      for (const height of heights) for (const side of [0, 1.8, -1.8]) for (const ahead of advances) {
        const candidate = this.playerPivot.clone().addScaledVector(direct, .7)
          .addScaledVector(this.right, side).addScaledVector(longitudinal, ahead);
        candidate.y = Math.max(candidate.y, this.playerPivot.y + height);
        this.constrain(this.playerPivot, candidate, this.foundation20Framing ? 120 : this.camera.fov);
        const clearance = candidate.distanceTo(this.playerPivot);
        if (clearance < 3.2) continue;
        const score = this.framingPenalty(candidate) * 100
          + candidate.distanceToSquared(this.desired)
          + candidate.distanceToSquared(this.camera.position) * (this.inclinedFraming ? 3 : .15);
        if (score < bestScore) { bestScore = score; best = candidate; }
      }
      // Beneath a ceiling or after a high wall exit the upward escape can be
      // blocked, or leave the traveller below the picture. Try a lateral ring
      // in either case. Every candidate retains the same near-plane sweep.
      if (!best || this.framingPenalty(best) > 0) {
        const lateral = this.right.clone().setY(0).normalize();
        if (lateral.lengthSq() < .01) lateral.set(1, 0, 0);
        const along = new THREE.Vector3().crossVectors(lateral, UP);
        for (const height of (this.inclinedFraming ? [0, -1.5, 1.5, 3, 4.5, 5.5] : [0, -1.5, 1.5])) for (let sector = 0; sector < 8; sector++) {
          const angle = sector * Math.PI / 4;
          const candidate = this.playerPivot.clone()
            .addScaledVector(lateral, Math.cos(angle) * 3.6)
            .addScaledVector(along, Math.sin(angle) * 3.6);
          candidate.y += height;
          this.constrain(this.playerPivot, candidate, this.foundation20Framing ? 120 : this.camera.fov);
          if (candidate.distanceTo(this.playerPivot) < 2.4) continue;
          const score = this.framingPenalty(candidate) * 100
            + candidate.distanceToSquared(this.desired)
            + candidate.distanceToSquared(this.camera.position) * (this.inclinedFraming ? 3 : .15);
          if (score < bestScore) { bestScore = score; best = candidate; }
        }
      }
      // An upright castle bay can block the rear boom while a high escape
      // still needs more than the finite lens budget. Search farther sideways
      // only for that measured failure. Prefer a swept, cap-fitting view over
      // a shorter endpoint that merely leaves physical space around the body.
      if (this.fullBodyFraming && this.confinedFraming && this.viewUp.dot(UP) >= Math.cos(.01)
        && (!best || this.silhouetteFovAt(best) > 120)) {
        const lateral = this.right.clone().setY(0).normalize();
        if (lateral.lengthSq() < .01) lateral.set(1, 0, 0);
        const along = new THREE.Vector3().crossVectors(lateral, UP);
        let fitted = this.reusableFoundation20Escape(), fittedScore = Infinity;
        // Keep both the shoulder-relative and world-cardinal directions.
        // Near a corner, rotating the sparse ring with aim can miss the only
        // clear direction parallel to its wall.
        // The actual Foundation20 back corridor has legal cap-fitting views
        // beyond the castle ring, including a higher eye over its stair rail.
        // Retain the exact existing search for every other chamber.
        const radii = this.foundation20Framing ? [5.6, 7.2, 8, 10, 12] : [5.6, 7.2, 8];
        const searchHeights = this.foundation20Framing ? [0, 1.5, 3, 4.5, 5.5, 8] : [0, 1.5, 3];
        const sectors = this.foundation20Framing ? 32 : 16;
        if (!fitted) for (const basis of [lateral, new THREE.Vector3(1, 0, 0)])
        for (const radius of radii) for (const height of searchHeights) for (let sector = 0; sector < sectors; sector++) {
          const angle = this.foundation20Framing ? sector * Math.PI / 16 : sector * Math.PI / 8;
          const tangent = new THREE.Vector3().crossVectors(basis, UP);
          const candidate = this.playerPivot.clone()
            .addScaledVector(basis, Math.cos(angle) * radius)
            .addScaledVector(tangent, Math.sin(angle) * radius);
          candidate.y += height;
          this.constrain(this.playerPivot, candidate, this.foundation20Framing ? 120 : this.camera.fov);
          if (candidate.distanceTo(this.playerPivot) < 2.4 || this.silhouetteFovAt(candidate) > 120) continue;
          const score = candidate.distanceToSquared(this.desired)
            + candidate.distanceToSquared(this.camera.position) * .15;
          if (score < fittedScore) { fittedScore = score; fitted = candidate; }
        }
        if (fitted) {
          best = fitted;
          if (this.foundation20Framing) this.foundation20EscapeOffset = fitted.clone().sub(this.playerPivot);
        }
      }
      if (best) { escapePosition = best; avoidGoal.copy(best).sub(this.desired); this.avoidanceActive = true; }
      else this.avoidanceActive = false;
    } else this.avoidanceActive = false;
    for (const axis of ['x', 'y', 'z']) {
      [this.avoidance[axis], this.avoidanceVelocity[axis]] = spring(
        // Rising terrain closes the boom quickly. Keep a damped response but
        // recover before animated boots move below the bottom of the lens.
        this.avoidance[axis], this.avoidanceVelocity[axis], avoidGoal[axis], this.rampFraming ? 36 : 16, step);
    }
    if (this.avoidance.lengthSq() > .00001) {
      this.desired.add(this.avoidance);
      this.constrain(this.playerPivot, this.desired, this.mechanismFramingActive ? Math.max(MECHANISM_CAMERA_FOV, this.camera.fov)
        : this.foundation20Framing && escapePosition ? 120 : this.camera.fov);
    }
    const safeLength = this.desired.distanceTo(this.focus);
    if (safeLength < this.distance) {
      this.distance = safeLength;
      this.distanceVelocity = 0;
    } else {
      [this.distance, this.distanceVelocity] = spring(
        this.distance, this.distanceVelocity, safeLength,
        this.fullBodyFraming && upwardFraming > 0 && !this.obstructed ? 16 : 9, step,
      );
      this.distance = Math.min(this.distance, safeLength);
    }
    this.boomDirection.copy(this.desired).sub(this.focus).normalize();
    this.camera.position.copy(this.focus).addScaledVector(this.boomDirection, this.distance);
    // The shortened/smoothed position follows a different ray at a corner;
    // validate that final position too, never just the desired endpoint.
    // A Foundation20 escape can widen the final lens after this interpolation.
    // Validate the actual intermediate eye against that same finite cap now,
    // so a later wider near-plane sweep cannot collapse it into the actor.
    const pulledIn = this.constrain(this.playerPivot, this.camera.position,
      this.mechanismFramingActive ? Math.max(MECHANISM_CAMERA_FOV, this.camera.fov) : this.foundation20Framing && this.obstructed ? 120 : this.camera.fov);
    this.obstructed = this.obstructed || pulledIn;
    if (pulledIn) {
      this.distance = this.camera.position.distanceTo(this.focus);
      this.distanceVelocity = 0;
    }
    // A fast fall past a balcony can close the available boom in one physics
    // step. In that exceptional case collision safety outranks spring lag:
    // use the already swept escape rather than render from inside the body.
    // A confined upright view also cannot interpolate through a lens that
    // exceeds its finite budget when the swept endpoint already fits it.
    const confinedOverBudget = this.fullBodyFraming && this.confinedFraming
      && this.viewUp.dot(UP) >= Math.cos(.01) && this.silhouetteFovAt(this.camera.position) > 120
      && escapePosition && this.silhouetteFovAt(escapePosition) <= 120;
    if (escapePosition && (this.camera.position.distanceTo(this.playerPivot) < 2.2 || confinedOverBudget)) {
      this.camera.position.copy(escapePosition);
      this.distance = this.camera.position.distanceTo(this.focus);
      this.distanceVelocity = 0;
      this.avoidance.copy(avoidGoal); this.avoidanceVelocity.set(0, 0, 0);
    }
    this.lookPoint.copy(this.focus).addScaledVector(this.forward, 16);
    // A floor/wall transfer can leave the rigidly transported view aimed at
    // the ceiling while the traveller is already through the aperture. Keep
    // the body in view during the brief gravity-relative horizon recovery.
    // The lens, mouse controls and portal clipping remain untouched.
    const tilt = this.viewUp.angleTo(UP);
    // Other portal rotations can invert the horizon during an airborne shot;
    // their preserved aim must not receive this quarter-turn correction.
    if (!this.mechanismFramingActive && step > 0 && Math.abs(tilt - Math.PI / 2) < .2
      && this.framingPenalty(this.camera.position) > .02)
      this.portalFramingActive = true;
    if (tilt < .1) this.portalFramingActive = false;
    if (!this.mechanismFramingActive && step > 0 && this.portalFramingActive) {
      const assist = .92 * THREE.MathUtils.smoothstep(tilt, .1, 1.3);
      if (assist > 0) {
        this.portalFramingPoint.copy(this.playerPivot).addScaledVector(this.forward, .8);
        this.lookPoint.lerp(this.portalFramingPoint, assist);
      }
    }
    this.camera.up.copy(this.viewUp);
    this.camera.lookAt(this.lookPoint);
    this.camera.updateMatrixWorld();
    const wasClipped = this.isInclinedExitLens();
    this.updatePortalClipping();
    // A surface ignored by the exit's discard plane is solid again as soon
    // as that plane retires. Sweep in the NEW render state in this same frame,
    // not one update later (also covers looking away / a removed exit).
    if (wasClipped && !this.mainClippingPlanes.length
      && this.constrain(this.playerPivot, this.camera.position)) {
      this.obstructed = true;
      this.distance = this.camera.position.distanceTo(this.focus);
      this.distanceVelocity = 0;
      this.camera.lookAt(this.lookPoint);
      this.camera.updateMatrixWorld();
    }
    if (!this.mechanismFramingActive) this.fitSilhouetteLens(step);
    if (this.mechanismFramingActive && step > 0) {
      const frame = this.measureMechanismFrame(this.camera.position);
      this.mechanismLensGoal = Math.min(MECHANISM_CAMERA_FOV, Math.max(62, frame.neededFov + 1));
      this.mechanismStats.final = frame;
    }
    return this;
    } finally { this.broadPhase.end(); this.rayHits.length = 0; }
  }

  measureMechanismFrame(eye, fov = this.camera.fov) {
    return measureMechanismFrame({eye, target: this.lastTarget, rotation: this.mechanismSubjectRotation,
      lookPoint: this.lookPoint, up: this.viewUp, aspect: this.camera.aspect, near: this.camera.near, fov});
  }

  mechanismEscapePosition() {
    const stats = this.mechanismStats;
    const valid = this.mechanismCurrentBlockersValid?.() !== false;
    stats.currentBodiesValid = valid;
    const recipes = this.mechanismEscape && valid
      ? [this.mechanismEscape, ...MECHANISM_CAMERA_OFFSETS.filter(r => r !== this.mechanismEscape)] : MECHANISM_CAMERA_OFFSETS;
    const fitted = eye => {
      const frame = this.measureMechanismFrame(eye);
      return this.measureMechanismFrame(eye, Math.min(MECHANISM_CAMERA_FOV, Math.max(62, frame.neededFov + 1)));
    };
    let best = this.desired.clone(), bestFrame = fitted(best);
    let bestScore = bestFrame.penalty * 100 + (bestFrame.fits ? 0 : 50), chosen = null;
    let cached = null;
    if (bestFrame.fits && !this.mechanismEscape) return null;
    for (const recipe of recipes) {
      stats.candidates++;
      const upward = Math.max(0, this.forward.dot(this.viewUp));
      const retreat = this.forward.clone().addScaledVector(this.viewUp, -upward).normalize();
      // The maximum manual upward angle needs a longer horizontal boom to
      // include the feet under the unchanged high centre ray. Grow the same
      // twelve shoulder recipes continuously, with an explicit14.5m limit.
      const rear = recipe.rear + (MECHANISM_CAMERA_MAX_REAR - 8)
        * THREE.MathUtils.smoothstep(upward, Math.sin(.7), Math.sin(CAMERA_PITCH_MAX));
      const portrait = THREE.MathUtils.clamp(1 - this.camera.aspect / .9, 0, 1);
      const side = recipe.side * (1 - portrait * (.4 + .4 * THREE.MathUtils.smoothstep(upward, .1, .5)));
      const candidate = this.focus.clone().addScaledVector(retreat, -rear)
        .addScaledVector(this.right, side).addScaledVector(this.viewUp, recipe.rise);
      const below = candidate.clone().sub(this.focus).dot(this.viewUp);
      if (below < -.65) candidate.addScaledVector(this.viewUp, -.65 - below);
      // Entering from another castle wing can retain a wider old lens while
      // its FOV spring narrows. Sweep that actual volume throughout the blend.
      this.constrain(this.playerPivot, candidate, Math.max(MECHANISM_CAMERA_FOV, this.camera.fov));
      const frame = fitted(candidate);
      const score = frame.penalty * 100 + (frame.fits ? 0 : 50) + candidate.distanceToSquared(this.desired) * .02
        + candidate.distanceToSquared(this.camera.position) * .06;
      if (recipe === this.mechanismEscape && valid) cached = {candidate, frame, score, recipe};
      if (score < bestScore) {best = candidate;bestScore = score;bestFrame = frame;chosen = recipe;}
      // The conservative box can graze its framing margin while the actual
      // skin remains clear. Retain that freshly swept shoulder through small
      // changes instead of chasing a different height on each mouse movement.
      const b = frame.bounds;
      const stableFrame = frame.fits || this.mechanismHadObstruction && b
        && Math.max(-b.minX, b.maxX, -b.minY, b.maxY) <= .95 && frame.height <= .68 && frame.aimGap >= .25;
      if (recipe === this.mechanismEscape && stableFrame && valid) {
        best = candidate;chosen = recipe;bestFrame = frame;stats.cacheHit = true;break;
      }
    }
    // A constrained shoulder may have no perfect envelope. Do not oscillate
    // between nearly equal safe views as a spring or a moving platform settles.
    if (cached && chosen && cached.frame.fits === bestFrame.fits && cached.score <= bestScore + 3) {
      best = cached.candidate;bestFrame = cached.frame;chosen = cached.recipe;stats.cacheHit = true;
    }
    this.mechanismEscape = chosen;
    stats.selected = chosen;stats.selectedFrame = bestFrame;
    return chosen ? best : null;
  }

  // A portal's rolling horizon and a newly solid backing can retract the
  // final lens AFTER escape candidates were scored. Fit that actual view,
  // rather than a desired boom or the pitch alone. Keep the same optical axis;
  // The optional castle lens also fits upright collision-limited views. Its
  // narrower loading bays can leave a safe swept eye beside the character.
  // Other upright rooms retain their exact previous camera and sweep.
  fitSilhouetteLens(step) {
    const upright = this.viewUp.dot(UP) >= Math.cos(.01);
    if (!this.fullBodyFraming || step <= 0 || (upright && !(this.confinedFraming && this.obstructed))) return;
    const halfWidth = this.foundation20Framing && upright ? 1.35 : this.confinedFraming && upright ? .85 : .65;
    for (let pass = 0; pass < 3; pass++) {
      let tangent = 0;
      for (const x of [-halfWidth, halfWidth]) for (const y of [-1.52, 1.52]) for (const z of [-halfWidth, halfWidth]) {
        this.silhouettePoint.set(x, y, z).add(this.playerPivot)
          .applyMatrix4(this.camera.matrixWorldInverse);
        const depth = -this.silhouettePoint.z;
        // A near/behind-eye corner cannot fit by changing FOV. Reach the
        // bounded budget without claiming that collision-limited view fits.
        tangent = depth <= this.camera.near ? Infinity : Math.max(tangent,
          Math.abs(this.silhouettePoint.y) / (depth * .96),
          Math.abs(this.silhouettePoint.x) / (depth * this.camera.aspect * .96));
      }
      // The measured falling third-portal view needs 100.1 degrees for a
      // small feet envelope, including the margin. Leave a finite reserve
      // for its last collision sweep; tighter views can still exceed it.
      const needed = Math.min(this.confinedFraming && upright ? 120 : 102,
        THREE.MathUtils.radToDeg(2 * Math.atan(tangent)));
      if (needed <= this.camera.fov + .00001) return;
      this.camera.fov = needed;
      this.fovVelocity = Math.max(0, this.fovVelocity);
      this.camera.updateProjectionMatrix();
      // A wider lens can have a wider near-plane volume. Retain the same
      // aperture/backing rules and validate any newly solid surface now.
      const wasClipped = this.isInclinedExitLens();
      let pulledIn = this.constrain(this.playerPivot, this.camera.position);
      this.camera.lookAt(this.lookPoint);
      this.camera.updateMatrixWorld();
      this.updatePortalClipping();
      if (wasClipped && !this.mainClippingPlanes.length) {
        pulledIn = this.constrain(this.playerPivot, this.camera.position) || pulledIn;
        this.camera.lookAt(this.lookPoint);
        this.camera.updateMatrixWorld();
        this.updatePortalClipping();
      }
      if (pulledIn) {
        this.obstructed = true;
        this.distance = this.camera.position.distanceTo(this.focus);
        this.distanceVelocity = 0;
      }
    }
  }

  // Evaluate the same eight-corner margin as the final fit without writing
  // the live lens. The look point and centre-ray target stay unchanged.
  silhouetteFovAt(position) {
    const forward = this.lookPoint.clone().sub(position).normalize();
    const right = new THREE.Vector3().crossVectors(forward, this.viewUp).normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();
    const point = new THREE.Vector3();let tangent = 0;
    // The measured original Foundation20 gun/pulse extends 1.30m from its
    // ordinary actor; the castle proxy must keep its existing dimensions.
    const halfWidth = this.foundation20Framing ? 1.35 : .85;
    for (const x of [-halfWidth, halfWidth]) for (const y of [-1.52, 1.52]) for (const z of [-halfWidth, halfWidth]) {
      point.set(x, y, z).add(this.playerPivot).sub(position);
      const depth = point.dot(forward);
      if (depth <= this.camera.near) return 180;
      tangent = Math.max(tangent, Math.abs(point.dot(up)) / (depth * .96),
        Math.abs(point.dot(right)) / (depth * this.camera.aspect * .96));
    }
    return THREE.MathUtils.radToDeg(2 * Math.atan(tangent));
  }

  // An escape must retain the traveller in the lens, not merely leave space
  // around the body. In a narrow flight channel an upward route can be clear
  // while pointing above the character. Score the same unchanged look point
  // from every swept position; no orbit or weapon aim is substituted.
  framingPenalty(position) {
    const forward = this.lookPoint.clone().sub(position).normalize();
    const right = new THREE.Vector3().crossVectors(forward, this.viewUp).normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();
    if (!this.inclinedFraming && !this.rampFraming && !this.fullBodyFraming) {
      const subject = this.playerPivot.clone().sub(position);
      const depth = subject.dot(forward);
      if (depth <= .1) return 100;
      const height = depth * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
      const x = Math.abs(subject.dot(right)) / (height * this.camera.aspect);
      const y = Math.abs(subject.dot(up)) / height;
      return Math.max(0, x - .7) ** 2 + Math.max(0, y - .6) ** 2;
    }
    // Test the full envelope on ordinary slopes as well as portal exits.
    // A chest-only score admitted uphill views that cut off the head/backpack.
    // Slopes reserve another .4 m for animated boots and jump poses.
    let penalty = 0;
    const subject = new THREE.Vector3();
    for (const y of (this.rampFraming ? [-1.72, 0, 1.72] : [-1.32, 0, 1.32])) {
      subject.copy(this.playerPivot).addScaledVector(UP, y).sub(position);
      const depth = subject.dot(forward);
      if (depth <= .1) return 100;
      const height = depth * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
      const x = (Math.abs(subject.dot(right)) + .65) / (height * this.camera.aspect);
      const v = (Math.abs(subject.dot(up)) + .2) / height;
      penalty += Math.max(0, x - .9) ** 2 + Math.max(0, v - .9) ** 2;
    }
    return penalty;
  }

  updatePortalClipping() {
    this.mainClippingPlanes.length = 0;
    // Keep ordinary depth precision all the way through a crossing. An oblique
    // near plane becomes ill-conditioned as the real eye approaches that plane;
    // tiled walls then z-fight although their geometry has a proper separation.
    // The main render uses a world-space discard plane instead. Virtual portal
    // cameras retain their own independently constructed oblique projection.
    this.camera.updateProjectionMatrix();
    if (!this.portalExit) return;
    const exit = this.portalExit;
    if (exit.group && !exit.group.parent) { this.portalExit = null; return; }
    const distance = this.camera.position.clone().sub(exit.position).dot(exit.normal);
    if (distance >= 0) { this.portalExit = null; return; }
    const direction = this.camera.getWorldDirection(this.castDirection);
    if (direction.dot(exit.normal) <= .04) return;
    this.portalClipPlane.setFromNormalAndCoplanarPoint(exit.normal,
      exit.position.clone().addScaledVector(exit.normal, .025));
    this.mainClippingPlanes.push(this.portalClipPlane);
  }

  // The transported lens can still be behind its exit while the traveller is
  // already in front. That one backing surface is removed by the world
  // clipping plane, so colliding the boom with it would contradict the rendered
  // passage and collapse the lens into the character. Other walls still block.
  clipsPortalBacking(box, colliderId) {
    return !!this.portalExit && (this.portalExit.backingIds?.has(colliderId) || portalBacksCollider(this.portalExit, box))
      && this.camera.getWorldDirection(this.clipDirection).dot(this.portalExit.normal) > .04;
  }

  // During an inclined exit-lens phase, use the same world discard plane for camera
  // contacts as for the main render; physical actor collision is unchanged.
  isInclinedExitLens() {
    const vertical = Math.abs(this.portalExit?.normal.y ?? 0);
    return this.mainClippingPlanes.length > 0 && vertical > .001 && vertical < .999;
  }

  clipsPortalHit(point) {
    return !!point && this.isInclinedExitLens() && this.mainClippingPlanes.some(plane => plane.distanceToPoint(point) < 0);
  }

  constrain(origin, position, sweepFov = this.camera.fov) {
    if (this.broadPhase.active) this.queryStats.sweeps++;
    this.castDirection.copy(position).sub(origin);
    const distance = this.castDirection.length();
    if (distance < 0.0001 || this.blockers.length === 0) return false;
    this.castDirection.multiplyScalar(1 / distance);
    this.castRight.crossVectors(UP, this.castDirection).normalize();
    if (this.castRight.lengthSq() < 0.01) this.castRight.set(1, 0, 0);
    this.castUp.crossVectors(this.castDirection, this.castRight).normalize();
    // Cover the near-plane corners as well as the lens centre. At normal
    // display sizes the 24 cm minimum gives walls a comfortable safety margin.
    const halfNearHeight = this.camera.near * Math.tan(THREE.MathUtils.degToRad(sweepFov * 0.5));
    const radius = Math.max(0.24, halfNearHeight * Math.hypot(this.camera.aspect, 1) + 0.08);
    let safeDistance = distance;
    this.raycaster.near = 0;
    this.raycaster.far = distance + radius;
    const privateQueries = this.foundation20Framing || this.mechanismFramingActive;
    const blockers = privateQueries ? this.queryBlockers : this.blockers;
    const candidates = this.broadPhase.select(blockers, origin, this.castDirection, distance, radius);
    if (this.broadPhase.active) this.queryStats.candidateMeshes += candidates.length;
    for (const [x, y] of SAMPLE_OFFSETS) {
      if (this.broadPhase.active) this.queryStats.rays++;
      this.castOrigin.copy(origin).addScaledVector(this.castRight, x * radius)
        .addScaledVector(this.castUp, y * radius);
      this.raycaster.set(this.castOrigin, this.castDirection);
      this.rayHits.length = 0;
      const hits = this.raycaster.intersectObjects(candidates, true, this.rayHits);
      const hit = hits.find(candidate => {
        if (this.clipsPortalHit(candidate.point)) return false;
        const source = privateQueries ? this.currentBlockerSources.get(candidate.object) : null;
        return source ? this.isBlocker(source, { ...candidate, object: source }) : this.isBlocker(candidate.object, candidate);
      });
      if (hit) safeDistance = Math.min(safeDistance, Math.max(0, hit.distance - radius - 0.035));
    }
    if (safeDistance >= distance) return false;
    position.copy(origin).addScaledVector(this.castDirection, safeDistance);
    return true;
  }
}
