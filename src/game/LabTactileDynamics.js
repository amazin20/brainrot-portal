/** Physical, renderer-independent mechanisms for the next authored workshops.
 * All quantities use seconds, metres, kilograms and radians. Nothing here
 * modifies a player, teleports cargo, or decides whether a level is complete.
 * Game adapters must apply the returned coordinate to BOTH visible geometry
 * and the corresponding physical collider, on the fixed simulation step.
 */
const finite = (value, name) => {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
};
const positive = (value, name) => {
  finite(value, name);
  if (value <= 0) throw new RangeError(`${name} must be positive`);
  return value;
};
const nonnegative = (value, name) => {
  finite(value, name);
  if (value < 0) throw new RangeError(`${name} must be nonnegative`);
  return value;
};
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
function integrate(duration, callback) {
  nonnegative(duration, 'duration');
  // An unbounded tab-resume delta must be handled by the game clock, not by
  // silently dropping elapsed time or applying a giant mechanical impulse.
  if (duration > 1) throw new RangeError('mechanical step exceeds one second');
  if (!duration) return;
  const steps = Math.ceil(duration * 240), h = duration / steps;
  for (let i = 0; i < steps; i++) callback(h);
}

/** A wind-driven flywheel with a real clutch: stored kinetic energy can lift a
 * load after airflow disappears. Engaging the brake dissipates energy instead
 * of granting a completed-state flag. Angular damping is integrated exactly.
 */
export class LabFlywheelDynamics {
  constructor({ inertia = 16, damping = .6, brakeDamping = 18, maxSpeed = 12 } = {}) {
    this.inertia = positive(inertia, 'inertia');
    this.damping = nonnegative(damping, 'damping');
    this.brakeDamping = nonnegative(brakeDamping, 'brakeDamping');
    this.maxSpeed = positive(maxSpeed, 'maxSpeed');
    this.reset();
  }
  reset() { this.angle = 0; this.speed = 0; this.dissipated = 0; }
  get energy() { return .5 * this.inertia * this.speed * this.speed; }
  applyAngularImpulse(impulse) {
    finite(impulse, 'impulse');
    this.speed = clamp(this.speed + impulse / this.inertia, -this.maxSpeed, this.maxSpeed);
  }
  step(dt, { torque = 0, brake = false } = {}) {
    finite(torque, 'torque');
    const damping = this.damping + (brake ? this.brakeDamping : 0);
    integrate(dt, h => {
      const before = this.speed;
      if (damping > 0) {
        const rate = damping / this.inertia, equilibrium = torque / damping;
        const decay = Math.exp(-rate * h);
        this.speed = equilibrium + (before - equilibrium) * decay;
        this.angle += equilibrium * h + (before - equilibrium) * (1 - decay) / rate;
      } else {
        this.speed = before + torque / this.inertia * h;
        this.angle += before * h + .5 * torque / this.inertia * h * h;
      }
      const unclamped = this.speed;
      this.speed = clamp(this.speed, -this.maxSpeed, this.maxSpeed);
      this.dissipated += Math.max(0, .5 * this.inertia * (unclamped * unclamped - this.speed * this.speed));
      if (torque === 0) this.dissipated += Math.max(0, .5 * this.inertia * (before * before - unclamped * unclamped));
    });
    return this.snapshot();
  }
  /** Consume only available energy. A stalled wheel cannot lift a load. */
  performWork(joules) {
    nonnegative(joules, 'work');
    const available = this.energy, delivered = Math.min(joules, available);
    const sign = Math.sign(this.speed);
    this.speed = sign * Math.sqrt(Math.max(0, 2 * (available - delivered) / this.inertia));
    return delivered;
  }
  snapshot() { return { angle: this.angle, speed: this.speed, energy: this.energy, dissipated: this.dissipated }; }
}

/** One-degree-of-freedom two-tray hoist with an inextensible cable.
 * Left and right displacements are opposite; loading either tray changes
 * acceleration continuously. A brake holds the present height, not a target.
 * Removal of a load is reversible. Work and energy remain measurable.
 */
export class LabCounterweightDynamics {
  constructor({ travel = 6, trayMass = 8, counterMass = 8, gravity = 18,
    damping = 9, pulleyInertia = 4, initialPosition = 0 } = {}) {
    this.travel = positive(travel, 'travel');
    this.trayMass = positive(trayMass, 'trayMass');
    this.counterMass = positive(counterMass, 'counterMass');
    this.gravity = positive(gravity, 'gravity');
    this.damping = nonnegative(damping, 'damping');
    this.pulleyInertia = nonnegative(pulleyInertia, 'pulleyInertia');
    this.initialPosition = clamp(finite(initialPosition, 'initialPosition'), 0, this.travel);
    this.reset();
  }
  reset() { this.position = this.initialPosition; this.velocity = 0; this.braked = true; }
  setBrake(engaged) { this.braked = Boolean(engaged); if (this.braked) this.velocity = 0; }
  step(dt, { leftLoad = 0, rightLoad = 0 } = {}) {
    nonnegative(leftLoad, 'leftLoad'); nonnegative(rightLoad, 'rightLoad');
    const left = this.trayMass + leftLoad, right = this.counterMass + rightLoad;
    const total = left + right + this.pulleyInertia;
    integrate(dt, h => {
      if (this.braked) { this.velocity = 0; return; }
      const force = (right - left) * this.gravity;
      const before = this.velocity, damping = this.damping;
      let change;
      if (damping > 0) {
        const rate = damping / total, eq = force / damping, decay = Math.exp(-rate * h);
        this.velocity = eq + (before - eq) * decay;
        change = eq * h + (before - eq) * (1 - decay) / rate;
      } else {
        const acceleration = force / total;
        this.velocity = before + acceleration * h;
        change = before * h + .5 * acceleration * h * h;
      }
      const proposed = this.position + change;
      this.position = clamp(proposed, 0, this.travel);
      if ((proposed <= 0 && this.velocity < 0) || (proposed >= this.travel && this.velocity > 0)) this.velocity = 0;
    });
    return this.snapshot();
  }
  snapshot() { return { leftHeight: this.position, rightHeight: this.travel - this.position,
    velocity: this.velocity, braked: this.braked }; }
}

/** A damped spring latch actuated by collision impulse, not by a button.
 * The pawl is a visible mechanical catch. Release allows the spring to return.
 */
export class LabSpringLatchDynamics {
  constructor({ mass = 6, stiffness = 45, damping = 7, stroke = 1.6, catchAt = 1.2 } = {}) {
    this.mass = positive(mass, 'mass'); this.stiffness = positive(stiffness, 'stiffness');
    this.damping = nonnegative(damping, 'damping'); this.stroke = positive(stroke, 'stroke');
    this.catchAt = positive(catchAt, 'catchAt');
    if (this.catchAt > this.stroke) throw new RangeError('catch lies outside the physical stroke');
    this.reset();
  }
  reset() { this.compression = 0; this.velocity = 0; this.latched = false; this.catchEnabled = true; }
  release() { this.latched = false; this.catchEnabled = false; }
  applyImpulse(impulse) { finite(impulse, 'impulse'); if (!this.latched) this.velocity += impulse / this.mass; }
  step(dt, { force = 0 } = {}) {
    finite(force, 'force');
    integrate(dt, h => {
      if (this.latched) { this.compression = this.catchAt; this.velocity = 0; return; }
      const acceleration = (force - this.stiffness * this.compression - this.damping * this.velocity) / this.mass;
      this.velocity += acceleration * h;
      this.compression += this.velocity * h;
      if (this.catchEnabled && this.compression >= this.catchAt) {
        this.compression = this.catchAt; this.velocity = 0; this.latched = true;
      } else if (this.compression <= 0) {
        this.compression = 0; this.velocity = Math.max(0, this.velocity); this.catchEnabled = true;
      } else if (this.compression > this.stroke) {
        this.compression = this.stroke; this.velocity = Math.min(0, this.velocity);
      }
    });
    return this.snapshot();
  }
  snapshot() { return { compression: this.compression, velocity: this.velocity, latched: this.latched,
    springEnergy: .5 * this.stiffness * this.compression * this.compression }; }
}
