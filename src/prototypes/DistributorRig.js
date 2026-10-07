import { Body, Box, Cylinder, HingeConstraint, Vec3, World } from 'cannon-es';

export const DISTRIBUTOR_STEP = 1 / 120;
const UP = new Vec3(0, 1, 0);
const v = a => new Vec3(...a);
const finite = (value, name) => {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
};

/** Isolated W02 mechanism prototype, NOT integrated into the campaign.
 * Contacts transfer momentum to a hinged rigid rotor. A passive periodic spring
 * models an indexed detent; its energy is explicit and cannot select a target.
 * Physical posts, not an angle clamp, bound rotation. No cargo identity checks. */
export class DistributorRig {
  constructor(world, { position = [0, 1.4, 0], mass = 8, detentEnergy = .5,
    pitch = .60, damping = 16, brakeTorque = 28 } = {}) {
    if (!(world instanceof World)) throw new TypeError('A cannon-es World is required');
    for (const [name, value] of Object.entries({ mass, detentEnergy, pitch, damping, brakeTorque })) finite(value, name);
    if (mass <= 0 || detentEnergy < 0 || pitch <= 0 || damping < 0 || brakeTorque < 0) throw new RangeError('Invalid mechanism parameters');
    if (position.length !== 3 || !position.every(Number.isFinite)) throw new TypeError('position must be a finite xyz tuple');
    this.world = world; this.origin = v(position); this.pitch = pitch;
    this.detentEnergy = detentEnergy; this.damping = damping; this.brakeTorque = brakeTorque;
    this.braked = false; this.disposed = false; this.contactCount = 0; this.paddleContacts = 0; this.peakImpact = 0;
    this.fixed = []; this.parts = [];
    this.anchor = new Body({ mass: 0, position: this.origin.clone() });
    this.anchor.addShape(new Box(new Vec3(.75, .10, .75)), new Vec3(0, -1.3, 0));
    this.anchor.addShape(new Cylinder(.38, .38, 1.12, 24), new Vec3(0, -.64, 0));
    this.anchor.addShape(new Cylinder(.54, .54, .17, 24), new Vec3(0, -.08, 0));
    world.addBody(this.anchor);
    this.rotor = new Body({ mass, position: this.origin.clone(), allowSleep: false, angularDamping: 0, linearDamping: .05 });
    const shape = (name, half, offset) => {
      const collisionShape = new Box(v(half));
      this.rotor.addShape(collisionShape, v(offset));
      if (name === 'broad impulse paddle') this.paddleShape = collisionShape;
      this.parts.push({ name, half, offset });
    };
    shape('load tray', [2.9, .12, .6], [0, 0, 0]);
    shape('near rail', [2.85, .10, .055], [0, .21, -.655]);
    shape('far rail', [2.85, .10, .055], [0, .21, .655]);
    shape('broad impulse paddle', [.8, .65, .10], [1.8, .84, 0]);
    world.addBody(this.rotor);
    this.hinge = new HingeConstraint(this.anchor, this.rotor, {
      pivotA: new Vec3(), pivotB: new Vec3(), axisA: UP, axisB: UP, collideConnected: false, maxForce: 1e7,
    });
    world.addConstraint(this.hinge);
    // Post placement leaves three broad indexed orientations and real collision stops.
    for (const sign of [-1, 1]) {
      const azimuth = sign * .965, radius = 2.72;
      const offset = [Math.cos(azimuth) * radius, 0, -Math.sin(azimuth) * radius];
      const half = [.15, .45, .15];
      const body = new Body({ mass: 0, position: this.origin.vadd(v(offset)), shape: new Box(v(half)) });
      body.addShape(new Box(new Vec3(.11, .425, .11)), new Vec3(0, .55 - position[1], 0));
      body.addShape(new Box(new Vec3(.275, .07, .275)), new Vec3(0, .07 - position[1], 0));
      world.addBody(body); this.fixed.push({ name: 'mechanical stop', body, half });
    }
    this.onContact = event => {
      this.contactCount++;
      if (event.contact.si === this.paddleShape || event.contact.sj === this.paddleShape) this.paddleContacts++;
      this.peakImpact = Math.max(this.peakImpact, Math.abs(event.contact.getImpactVelocityAlongNormal()));
    };
    this.rotor.addEventListener('collide', this.onContact);
  }

  get angle() {
    const q = this.rotor.quaternion;
    return Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.z * q.z));
  }

  get springEnergy() { return this.detentEnergy * (1 - Math.cos(2 * Math.PI * this.angle / this.pitch)); }

  beforeStep(dt = DISTRIBUTOR_STEP) {
    if (this.disposed) throw new Error('Distributor disposed');
    if (!(Number.isFinite(dt) && dt > 0 && dt <= 1 / 60)) throw new RangeError('Use a fixed physics step no longer than 1/60');
    const omega = this.rotor.angularVelocity.y, wave = 2 * Math.PI / this.pitch;
    const elastic = -this.detentEnergy * wave * Math.sin(wave * this.angle);
    // Brake removes angular momentum. Never reverses omega by itself in one tick.
    const brake = this.braked ? -Math.sign(omega) * Math.min(this.brakeTorque,
      Math.abs(omega) / Math.max(this.rotor.invInertia.y * dt, 1e-12)) : 0;
    this.rotor.torque.y += elastic - this.damping * omega + brake;
  }

  setBrake(active) { if (this.disposed) throw new Error('Distributor disposed'); this.braked = Boolean(active); this.rotor.wakeUp(); }

  reset() {
    if (this.disposed) throw new Error('Distributor disposed');
    const b = this.rotor; b.position.copy(this.origin); b.quaternion.set(0, 0, 0, 1);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    b.previousQuaternion.copy(b.quaternion); b.interpolatedQuaternion.copy(b.quaternion);
    b.velocity.setZero(); b.angularVelocity.setZero(); b.force.setZero(); b.torque.setZero();
    b.aabbNeedsUpdate = true; b.wakeUp(); this.world.broadphase.dirty = true;
    this.braked = false; this.contactCount = 0; this.paddleContacts = 0; this.peakImpact = 0;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.rotor.removeEventListener('collide', this.onContact);
    this.world.removeConstraint(this.hinge);
    for (const b of [this.rotor, this.anchor, ...this.fixed.map(p => p.body)]) this.world.removeBody(b);
  }
}

/** Test fixture: initial body placement is allowed here, not a playthrough.
 * Same persistent cargo body is reset between trials. No runtime teleporting. */
export class DistributorBench {
  constructor(options = {}) {
    this.world = new World({ gravity: new Vec3(0, -19.5, 0), allowSleep: false });
    this.world.solver.iterations = 30; this.world.solver.tolerance = 1e-9;
    Object.assign(this.world.defaultContactMaterial, { friction: .32, restitution: .04,
      contactEquationStiffness: 1e8, contactEquationRelaxation: 4 });
    this.floor = new Body({ mass: 0, position: new Vec3(0, -.2, 0), shape: new Box(new Vec3(8, .2, 8)) });
    this.world.addBody(this.floor);
    this.rig = new DistributorRig(this.world, options);
    this.cargo = new Body({ mass: 3.2, shape: new Box(new Vec3(.39, .39, .39)), position: new Vec3(1.8, 2.24, 3),
      linearDamping: .05, angularDamping: .25, allowSleep: false });
    this.world.addBody(this.cargo);
    this.elapsed = 0; this.accumulator = 0; this.steps = 0; this.maxAngle = 0;
  }

  launch({ side = 1, speed = 8, lever = 1.8, reset = true, distance = .68 } = {}) {
    for (const [name, value] of Object.entries({ side, speed, lever, distance })) finite(value, name);
    if (![-1, 1].includes(side) || speed < 0 || distance < .51) throw new RangeError('Invalid launch');
    if (reset) this.rig.reset();
    const b = this.cargo, local = new Vec3(lever, .84, side * distance);
    this.rig.rotor.pointToWorldFrame(local, b.position);
    this.rig.rotor.vectorToWorldFrame(new Vec3(0, 0, -side * speed), b.velocity);
    b.quaternion.copy(this.rig.rotor.quaternion); b.angularVelocity.setZero(); b.force.setZero(); b.torque.setZero();
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    b.previousQuaternion.copy(b.quaternion); b.interpolatedQuaternion.copy(b.quaternion);
    b.aabbNeedsUpdate = true; b.wakeUp(); this.world.broadphase.dirty = true;
    this.elapsed = 0; this.accumulator = 0; this.steps = 0; this.maxAngle = Math.abs(this.rig.angle);
  }

  step() {
    this.rig.beforeStep(DISTRIBUTOR_STEP); this.world.step(DISTRIBUTOR_STEP);
    this.elapsed += DISTRIBUTOR_STEP; this.steps++;
    this.maxAngle = Math.max(this.maxAngle, Math.abs(this.rig.angle));
  }

  advance(frameSeconds) {
    if (!Number.isFinite(frameSeconds) || frameSeconds < 0 || frameSeconds > 1) throw new RangeError('frame must be between 0 and 1 second');
    this.accumulator += frameSeconds;
    while (this.accumulator + 1e-12 >= DISTRIBUTOR_STEP) { this.step(); this.accumulator = Math.max(0, this.accumulator - DISTRIBUTOR_STEP); }
  }

  snapshot() { return { angle: this.rig.angle, omega: this.rig.rotor.angularVelocity.y,
    maxAngle: this.maxAngle, contacts: this.rig.contactCount, paddleContacts: this.rig.paddleContacts, peakImpact: this.rig.peakImpact,
    cargo: this.cargo.position.toArray(), bodyCount: this.world.bodies.length, steps: this.steps }; }
  dispose() { this.rig.dispose(); this.world.removeBody(this.cargo); this.world.removeBody(this.floor); }
}
