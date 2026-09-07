import { Vec3 } from 'cannon-es';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const UP = new Vec3(0, 1, 0);

/** Local curiosity, not pathfinding. All recovery and walking use bounded
 * forces on the SAME rigid body. Airborne motion is always owned by physics. */
export class LabCompanionBehavior {
  constructor(physics) { this.physics = physics; this.reset(); }
  reset() {
    this.anchor = null; this.target = null; this.age = 0; this.restTime = 0;
    this.standGoal=null;this.clearanceReady=false;this.supportGrace=0;this.state = 'settling'; this.wasHeld = false; this.wasGrounded = false;
    this.visit = 0; this.randomState=0x47a6c51; this.recovery = 0; this.blockedTime = 0;
  }
  reanchor(position) {
    this.anchor = new Vec3(position.x, position.y, position.z);
    this.target = null; this.restTime = 0; this.blockedTime = 0;
  }
  random(){this.randomState=(Math.imul(this.randomState,1664525)+1013904223)>>>0;return this.randomState/4294967296;}
  update(dt, { held = false, onPad = false, canMove = () => true } = {}) {
    const body = this.physics.cargoBody;
    if (!body || !(dt > 0)) return;
    body.material.friction = 1;
    this.age += dt;
    if (held) { this.state = 'held'; this.wasHeld = true; this.wasGrounded = false; return; }
    this.supportGrace=this.physics.grounded?.12:Math.max(0,this.supportGrace-dt);
    const grounded = this.physics.grounded || (this.recovery>0 && this.supportGrace>0 && Math.abs(body.velocity.y)<1.2);
    if (this.wasHeld) { this.reanchor(body.position); this.wasHeld = false; this.wasGrounded = false; }
    if (!grounded) { this.state = 'airborne'; this.restTime = 0; this.wasGrounded = false; return; }
    if (!this.wasGrounded || !this.anchor) this.reanchor(body.position);
    this.wasGrounded = true;
    this.restTime += dt;
    const speed = body.velocity.length(), spin = body.angularVelocity.length();
    if (speed > 1.5 || spin > 5) { this.state = 'settling'; this.restTime = 0; return; }
    const up = body.quaternion.vmult(UP);
    const upright = clamp(up.dot(UP), -1, 1);
    // Let impacts tumble naturally, then brace and stand under motor torque.
    if (upright < .965 && this.restTime > .55) {
      this.state = 'getting_up'; this.recovery = Math.min(1, this.recovery + dt * 2.5);
      const axis = up.cross(UP);
      if (axis.lengthSquared() < 1e-8) axis.set(1, 0, 0);
      axis.normalize();
      const angle = Math.acos(upright), inertia = body.mass * this.physics.cargoSize ** 2 / 6;
      const gain = this.recovery * this.recovery * (3 - 2 * this.recovery);
      for (const k of ['x', 'z']) body.torque[k] += inertia * gain * (angle * axis[k] * 55 - body.angularVelocity[k] * 12);
      // Standing needs room for the box's rotating corners. Scoot away from
      // actual side contacts rather than repeatedly levering into a wall.
      const away=new Vec3();
      for(const contact of this.physics.world.contacts){
        const sign=contact.bi===body?-1:contact.bj===body?1:0;
        if(sign&&Math.abs(contact.ni.y)<.55){away.x+=contact.ni.x*sign;away.z+=contact.ni.z*sign;}
      }
      // A flat resting face may be a centimetre from the wall, so Cannon
      // has no side contact yet. Check the clearance the rotating corners
      // will need BEFORE standing; otherwise each attempt hits the same wall.
      const clearance=this.physics.cargoSize*1.3;
      for(const item of this.physics.solids.values()){
        const wall=item.body;if(!wall.collisionFilterMask||item.kind==='ramp')continue;
        if(Math.abs(wall.quaternion.x)+Math.abs(wall.quaternion.y)+Math.abs(wall.quaternion.z)>.00001)continue;
        if(wall.position.y+item.half.y<body.position.y+.2||wall.position.y-item.half.y>body.position.y+.3)continue;
        const nx=body.position.x-clamp(body.position.x,wall.position.x-item.half.x,wall.position.x+item.half.x);
        const nz=body.position.z-clamp(body.position.z,wall.position.z-item.half.z,wall.position.z+item.half.z);
        const distance=Math.hypot(nx,nz);
        if(distance>.0001&&distance<clearance){away.x+=nx/distance;away.z+=nz/distance;}
      }
      if(!this.clearanceReady&&!this.standGoal&&away.lengthSquared()>.01){
        away.normalize();
        this.standGoal=new Vec3(body.position.x+away.x*1.05,body.position.y,body.position.z+away.z*1.05);
      }
      if(this.standGoal){
        const dx=this.standGoal.x-body.position.x,dz=this.standGoal.z-body.position.z,distance=Math.hypot(dx,dz);
        if(distance<.07){this.standGoal=null;this.clearanceReady=true;}
        else if(canMove(body.position,dx/distance,dz/distance)){
          body.material.friction=0;
          // Finish one short clearance shuffle before rolling upright. A
          // threshold checked every frame alternated stand/scoot forever.
          body.torque.x=-body.angularVelocity.x*inertia*6;
          body.torque.z=-body.angularVelocity.z*inertia*6;
          const pace=Math.min(.85,distance*3);
          body.force.x+=body.mass*(dx/distance*pace-body.velocity.x)*12;
          body.force.z+=body.mass*(dz/distance*pace-body.velocity.z)*12;
        }else{this.standGoal=null;this.clearanceReady=true;}
      }
      body.wakeUp(); return;
    }
    this.recovery = 0;if(upright>=.965){this.standGoal=null;this.clearanceReady=false;}
    if (upright < .965 || this.restTime < 1.6) { this.state = 'settling'; return; }
    // Weight switches are a deliberate command to stay. Cosmetic tail/head
    // motion can continue without invalidating a solved pressure circuit.
    if (onPad) { this.state = 'waiting_on_pad'; this.target = null; return; }
    if (!this.target) {
      if (this.restTime < 2.0 + (this.visit % 3) * .65) { this.state = 'looking'; return; }
      this.visit++;
      const angle = this.random()*Math.PI*2, radius=.8+this.random()*1.3;
      this.target = new Vec3(body.position.x + Math.cos(angle)*radius, body.position.y,body.position.z + Math.sin(angle)*radius);
      const dx=this.target.x-this.anchor.x,dz=this.target.z-this.anchor.z,range=Math.hypot(dx,dz);
      if(range>3.2){this.target.x=this.anchor.x+dx*3.2/range;this.target.z=this.anchor.z+dz*3.2/range;}
    }
    const dx = this.target.x - body.position.x, dz = this.target.z - body.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < .085) { this.target = null; this.restTime = 0; this.state = 'looking'; return; }
    const nx = dx / distance, nz = dz / distance;
    if (!canMove(body.position, nx, nz)) {
      this.target = null; this.restTime = 0; this.state = 'looking'; return;
    }
    this.state = 'wandering';
    const pace = Math.min(.48, distance * .9);
    // Friction feed-forward allows a very slow walk without making the body
    // slippery during normal falls, pushes, carrying or landings.
    // During a step the foot lifts and transfers load. A box has four static
    // contacts, so retaining resting friction here pins even an active motor.
    // Restore the original high friction in every non-walking state above.
    body.material.friction = 0;
    const friction = 0;
    body.force.x += body.mass * clamp((nx * pace - body.velocity.x) * 30 + nx * friction, -18, 18);
    body.force.z += body.mass * clamp((nz * pace - body.velocity.z) * 30 + nz * friction, -18, 18);
    const facing = body.quaternion.vmult(new Vec3(-1, 0, 0));
    const turn = Math.atan2(facing.z * nx - facing.x * nz, facing.x * nx + facing.z * nz);
    const inertia = body.mass * this.physics.cargoSize ** 2 / 6;
    body.torque.y += inertia * clamp(turn * 9 - body.angularVelocity.y * 6, -9, 9);
    for (const k of ['x', 'z']) body.torque[k] -= inertia * body.angularVelocity[k] * 5;
    body.wakeUp();
    if (speed < .025) this.blockedTime += dt; else this.blockedTime = 0;
    if (this.blockedTime > .9) { this.target = null; this.restTime = 0; this.blockedTime = 0; }
  }
  get diagnostics() {
    return { state: this.state, anchor: this.anchor?.toArray() ?? null,
      target: this.target?.toArray() ?? null, recovery: this.recovery, wanderRadius: 3.2 };
  }
}
