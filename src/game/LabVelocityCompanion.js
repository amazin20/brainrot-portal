import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const CONNECT_RANGE = 3.2;
const FOLLOW_SPEED = 72;

/** A velocity-course stabilizer for the existing companion rigid body.
 * It owns a carry constraint, never the player's hands or an extra cargo copy.
 * The normal physics solver and swept contacts remain active while connected.
 */
export class LabVelocityCompanion {
  constructor(game) {
    this.game = game;
    this.physics = game.physics;
    this.connected = false;
    this.disposed = false;
    this.forward = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.orientation = new THREE.Quaternion();
    this.resetForward();
    this.raycaster = new THREE.Raycaster();
    this.visual = new THREE.Group();
    this.visual.name = 'Velocity companion stabilizer — separate from source model';
    const ringGeometry = new THREE.TorusGeometry(.57, .025, 5, 28);
    this.ringMaterial = new THREE.MeshBasicMaterial({ color: 0x78f4ea, transparent: true, opacity: .8, depthWrite: false });
    this.rings = [0, 1].map(() => {
      const ring = new THREE.Mesh(ringGeometry, this.ringMaterial);
      this.visual.add(ring);
      return ring;
    });
    this.lineGeometry = new THREE.BufferGeometry();
    this.lineGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(27), 3));
    this.lineMaterial = new THREE.LineBasicMaterial({ color: 0x78f4ea, transparent: true, opacity: .65, depthWrite: false });
    this.line = new THREE.Line(this.lineGeometry, this.lineMaterial);
    this.line.frustumCulled = false;
    this.visual.add(this.line);
    this.visual.visible = false;
    game.scene?.add(this.visual);
  }

  resetForward() {
    const facing = Number.isFinite(this.game.facing) ? this.game.facing : Math.PI;
    this.forward.set(Math.sin(facing), 0, Math.cos(facing));
  }

  canConnect() {
    const game = this.game, body = this.physics?.cargoBody;
    if (this.disposed || !game.epicMode || !body || game.heldCube || game.externalBlocked || game.state !== 'playing') return false;
    if (this.connected) return true;
    const origin = game.playerPosition.clone().addScaledVector(UP, 1.1);
    const delta = new THREE.Vector3().copy(body.position).sub(origin), distance = delta.length();
    if (distance > CONNECT_RANGE) return false;
    if (distance < .05) return true;
    game.scene?.updateMatrixWorld(true);
    this.raycaster.set(origin, delta.multiplyScalar(1 / distance));
    this.raycaster.far = Math.max(0, distance - .12);
    return !this.raycaster.intersectObjects(game.cameraBlockers ?? [], true)
      .some(hit => game.isActiveBlocker?.(hit.object) ?? true);
  }

  connect() {
    if (this.connected) return true;
    if (!this.canConnect()) return false;
    this.connected = true;
    this.previousSpeedLimit = this.physics.maxLinearSpeed;
    // The campaign's 22 m/s cargo cap must not strand a friend behind a 52 m/s
    // player. The existing sweep still catches ordinary thin-wall contacts.
    this.physics.maxLinearSpeed = Math.max(this.previousSpeedLimit, FOLLOW_SPEED);
    this.resetForward();
    this.update(0);
    this.game.companionAnimator?.trigger?.('pickup');
    this.game.audio?.pickup?.();
    return true;
  }

  interact() {
    if (!this.canConnect()) return false;
    if (!this.connected && !this.connect()) return false;
    this.game.callbacks?.onToast?.('Брейнрот закреплён. Руки свободны — можно ставить порталы!');
    this.game.emitHud?.();
    return true;
  }

  get prompt() {
    return !this.connected && this.canConnect() ? 'E — закрепить брейнрота • руки останутся свободны' : '';
  }

  update(dt) {
    if (!this.connected || this.disposed || !this.physics?.cargoBody) return;
    const game = this.game, v = game.playerVelocity;
    const planar = Math.hypot(v.x, v.z);
    if (planar > 1) {
      const desired = new THREE.Vector3(v.x / planar, 0, v.z / planar);
      const angle = Math.atan2(desired.x, desired.z) - Math.atan2(this.forward.x, this.forward.z);
      const turn = Math.atan2(Math.sin(angle), Math.cos(angle));
      const next = Math.atan2(this.forward.x, this.forward.z) + turn * (1 - Math.exp(-10 * Math.max(0, dt)));
      this.forward.set(Math.sin(next), 0, Math.cos(next));
    }
    const side = new THREE.Vector3(this.forward.z, 0, -this.forward.x);
    // Fixed side offset leaves the weapon and centre sightline unobstructed;
    // the friend follows travel heading rather than snapping with every aim.
    this.target.copy(game.playerPosition).addScaledVector(UP, 1.18)
      .addScaledVector(side, .86).addScaledVector(this.forward, -.32);
    this.orientation.setFromAxisAngle(UP, Math.atan2(this.forward.x, this.forward.z));
    this.physics.setCarryTarget(this.target, { velocity: v, quaternion: this.orientation, dt });
  }

  /** Called after LabGame transports the actual body and its carry target
   * through the same entry/exit transform as the player. No second teleport.
   */
  onPortalTransport(rotation) {
    if (!this.connected || !rotation) return;
    this.forward.applyQuaternion(rotation);
    this.forward.y = 0;
    if (this.forward.lengthSq() > .001) this.forward.normalize();
    else this.resetForward();
    this.game.companionBehavior?.reanchor?.(this.physics.cargoBody.position);
  }

  /** Explicit checkpoint recovery only; normal motion never rewrites pose.
   * Player position/facing must already be restored by the course checkpoint.
   */
  recover({ position, connected = true } = {}) {
    if (this.disposed || !this.physics?.cargoBody) return false;
    this.disconnect();
    this.resetForward();
    const p = position ? new THREE.Vector3().copy(position)
      : this.game.playerPosition.clone().addScaledVector(UP, 1.18)
        .add(new THREE.Vector3(this.forward.z, 0, -this.forward.x).multiplyScalar(.86))
        .addScaledVector(this.forward, -.32);
    this.orientation.setFromAxisAngle(UP, Math.atan2(this.forward.x, this.forward.z));
    this.physics.resetCargo({ position: p, quaternion: this.orientation });
    const cargo = this.game.cargo;
    cargo.position.copy(p); cargo.velocity.set(0, 0, 0); cargo.quaternion.copy(this.orientation);
    cargo.group?.position.copy(p); cargo.group?.quaternion.copy(this.orientation);
    this.game.companionBehavior?.reanchor?.(p);
    if (connected) {
      this.connected = true;
      this.previousSpeedLimit = this.physics.maxLinearSpeed;
      this.physics.maxLinearSpeed = Math.max(this.previousSpeedLimit, FOLLOW_SPEED);
      this.update(0);
    }
    return true;
  }

  isNear(position = this.game.playerPosition, radius = 3) {
    if (!this.connected || !this.physics?.cargoBody) return false;
    const p = this.physics.cargoBody.position;
    return Math.hypot(p.x - position.x, p.y - position.y - 1.1, p.z - position.z) <= radius;
  }

  renderUpdate(time = 0) {
    if (this.disposed) return;
    const game = this.game;
    this.visual.visible = Boolean(game.epicMode && game.cargo);
    if (!this.visual.visible) return;
    const point = game.cargo.group?.position ?? game.cargo.position;
    const motion = game.epicOptions?.reducedMotion !== true;
    for (let i = 0; i < this.rings.length; i++) {
      const ring = this.rings[i];
      ring.position.copy(point);
      ring.rotation.set(Math.PI / 2 + i * .8, i * 1.1, motion ? time * (i ? -.7 : .5) : 0);
    }
    this.ringMaterial.color.setHex(this.connected ? 0x78f4ea : 0xffc577);
    this.line.visible = this.connected;
    if (!this.connected) return;
    const origin = (game.playerGroup?.position ?? game.playerPosition).clone().addScaledVector(UP, 1.05);
    const attribute = this.lineGeometry.getAttribute('position');
    for (let i = 0; i < attribute.count; i++) {
      const t = i / (attribute.count - 1);
      attribute.setXYZ(i, THREE.MathUtils.lerp(origin.x, point.x, t),
        THREE.MathUtils.lerp(origin.y, point.y, t) - Math.sin(t * Math.PI) * .09,
        THREE.MathUtils.lerp(origin.z, point.z, t));
    }
    attribute.needsUpdate = true;
  }

  disconnect() {
    if (!this.connected) return;
    this.physics?.release();
    if (Number.isFinite(this.previousSpeedLimit)) this.physics.maxLinearSpeed = this.previousSpeedLimit;
    this.connected = false;
    this.previousSpeedLimit = undefined;
  }

  reset() {
    this.disconnect();
    this.resetForward();
    this.visual.visible = false;
  }

  get diagnostics() {
    return { connected: this.connected, handsFree: !this.game.heldCube,
      actualBodyId: this.physics?.cargoBody?.id ?? null, nearPlayer: this.isNear(),
      distance: this.physics?.cargoBody ? new THREE.Vector3().copy(this.physics.cargoBody.position)
        .distanceTo(this.game.playerPosition) : null };
  }

  dispose() {
    if (this.disposed) return;
    this.reset(); this.disposed = true;
    this.visual.removeFromParent();
    this.rings[0].geometry.dispose(); this.ringMaterial.dispose();
    this.lineGeometry.dispose(); this.lineMaterial.dispose();
  }
}
