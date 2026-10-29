/** Room 11's two mechanically exclusive transmission positions.
 * The inlet collar closes before the output dog engages. Live air loads the
 * spring-return shroud; when it meets the fork it throws that dog back out.
 * Neither an elapsed-time latch nor an accumulated-work milestone opens the
 * door: useful shaft work turns its hinges against 420 J of total resistance.
 */
export class WindClutchDrive {
  constructor(wheel) {
    this.wheel = wheel;
    this.energyPerStroke = 420;
    this.outputLoad = 8;
    this.cover = { opening: 2.2, velocity: 0, travel: 2.2, clearance: 1.65 };
    this.reset();
  }
  reset() {
    this.wheel.reset();
    this.airflow = this.inputTorque = this.lastOutputWork = 0;
    this.stroke = this.previousStroke = 0;
    this.clutch = false;
    this.cover.opening = this.cover.travel;
    this.cover.velocity = 0;
  }
  leverClear() { return this.cover.opening >= this.cover.clearance; }
  toggleClutch() {
    if (!this.leverClear()) return false;
    this.clutch = !this.clutch;
    return true;
  }
  step(airflow, dt) {
    if (![airflow, dt].every(Number.isFinite) || airflow < 0 || airflow > 1 || dt < 0)
      throw new RangeError('Normalized inlet flow and nonnegative finite dt required');
    this.previousStroke = this.stroke;
    this.airflow = airflow;
    if (!dt) { this.lastOutputWork = 0; return 0; }
    // Exact critically damped spring solution for a constant physical inlet
    // pressure over this fixed step: m=1, k=16, c=8, F_air=64*flow^2.
    const cover = this.cover, equilibrium = cover.travel - 4 * airflow * airflow;
    const offset = cover.opening - equilibrium, coefficient = cover.velocity + 4 * offset;
    const decay = Math.exp(-4 * dt);
    cover.opening = equilibrium + (offset + coefficient * dt) * decay;
    cover.velocity = (cover.velocity - 4 * coefficient * dt) * decay;
    if (cover.opening <= 0) { cover.opening = 0; cover.velocity = Math.max(0, cover.velocity); }
    if (cover.opening >= cover.travel) { cover.opening = cover.travel; cover.velocity = Math.min(0, cover.velocity); }
    // The moving shroud physically ejects the coupling fork. An already
    // engaged output closes the inlet collar even before that contact occurs,
    // so pre-engaging an empty wheel can never feed live power to the door.
    if (!this.leverClear()) this.clutch = false;
    this.inputTorque = this.clutch ? 0 : 24 * airflow;
    this.lastOutputWork = this.wheel.step(this.inputTorque,
      this.clutch && this.stroke < 1 ? this.outputLoad : 0, dt);
    // A mechanical pawl holds every partial hinge angle. At the end stop any
    // remaining fraction of this step's work is dissipated, never refunded.
    this.stroke = Math.min(1, this.stroke + this.lastOutputWork / this.energyPerStroke);
    return this.lastOutputWork;
  }
}

/** The shared gate eases its animation parameter. Invert it so normalized
 * transmission stroke corresponds to proportional hinge angle and work. */
export function windDoorParameter(stroke) {
  if (stroke <= 0) return 0;
  if (stroke >= 1) return 1;
  return .5 - Math.sin(Math.asin(1 - 2 * stroke) / 3);
}
