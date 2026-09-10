/** Reduced-coordinate block-and-tackle. q is the rise of A; B descends ratio*q.
 * Light can release either directional brake, but never supplies lifting work.
 * Masses use the same game units as the 3.2-unit player and Cannon companion.
 */
export class CounterweightDynamics {
  constructor({travel=14, ratio=1.4, massA=4, massB=2.5, inertia=2,
    gravity=19.5, damping=8, brakeAcceleration=7, initial=0}={}) {
    const positive={travel,ratio,massA,massB,inertia,gravity,damping,brakeAcceleration};
    for (const [name,value] of Object.entries(positive)) {
      if (!Number.isFinite(value)||value<=0) throw new RangeError(`${name} must be positive and finite`);
    }
    if (!Number.isFinite(initial)||initial<0||initial>travel) throw new RangeError('initial lies outside the guides');
    Object.assign(this,positive,{initial}); this.reset();
  }
  reset() {
    this.q=this.previousQ=this.initial; this.velocity=0; this.loadA=this.loadB=0;
    this.releaseUp=this.releaseDown=false; this.braking=true; this.drive=0;
  }
  step(dt,{loadA=0,loadB=0,releaseUp=false,releaseDown=false}={}) {
    if (!Number.isFinite(dt)||dt<0||dt>1) throw new RangeError('dt must be finite, within [0,1]');
    if (![loadA,loadB].every(x=>Number.isFinite(x)&&x>=0)) throw new RangeError('Loads must be finite and nonnegative');
    this.previousQ=this.q;
    Object.assign(this,{loadA,loadB,releaseUp:!!releaseUp,releaseDown:!!releaseDown});
    const totalA=this.massA+loadA, totalB=this.massB+loadB;
    const mass=totalA+totalB*this.ratio*this.ratio+this.inertia;
    const drive=this.gravity*(this.ratio*totalB-totalA); this.drive=drive;
    const count=Math.max(1,Math.ceil(dt*240)), h=dt/count;
    for (let i=0;i<count;i++) {
      const intended=Math.abs(this.velocity)>1e-8?Math.sign(this.velocity):Math.sign(drive);
      const released=intended>0?this.releaseUp:intended<0?this.releaseDown:false;
      this.braking=!released;
      if (!released) {
        // A clamped caliper resists the gravity load and dissipates kinetic
        // energy. It holds exactly at rest, rather than oscillating around a target.
        const speed=Math.abs(this.velocity), next=Math.max(0,speed-this.brakeAcceleration*h);
        this.q+=Math.sign(this.velocity)*(speed+next)*.5*h;
        this.velocity=Math.sign(this.velocity)*next;
      } else {
        // Analytic viscous-drag integration over each small contact interval.
        const rate=this.damping/mass, terminal=drive/this.damping;
        const old=this.velocity, decay=Math.exp(-rate*h);
        this.velocity=terminal+(old-terminal)*decay;
        this.q+=terminal*h+(old-terminal)*(1-decay)/rate;
      }
      if (this.q<=0) {this.q=0;this.velocity=Math.max(0,this.velocity);}
      if (this.q>=this.travel) {this.q=this.travel;this.velocity=Math.min(0,this.velocity);}
    }
    return this.q;
  }
  get heightA(){return this.q;}
  get heightB(){return this.ratio*(this.travel-this.q);}
  get speedB(){return -this.ratio*this.velocity;}
  get kineticEnergy(){return .5*(this.massA+this.loadA+(this.massB+this.loadB)*this.ratio**2+this.inertia)*this.velocity**2;}
}
