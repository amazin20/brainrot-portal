import {Body, Vec3} from 'cannon-es';

function finiteVector(value, label) {
  if (!value || ![value.x,value.y,value.z].every(Number.isFinite))
    throw new RangeError(label+' must be a finite vector');
  return new Vec3(value.x,value.y,value.z);
}

/** Prescribed ideal magnetic field, with qB expressed in kg/s.
 * dv/dt = v cross qB / m. The exact rotation preserves kinetic energy;
 * gravity, contacts and damping remain the physics world's responsibility.
 * This is a local operator prototype, not an integrated castle mechanism.
 * Switching a prescribed field omits induction and its external supply.
 */
export function castleMagneticBendVelocity({velocity, mass, qB, dt}) {
  const before=finiteVector(velocity,'Velocity'),field=finiteVector(qB,'qB');
  if (!Number.isFinite(mass)||mass<=0||!Number.isFinite(dt)||dt<0)
    throw new RangeError('Positive finite mass and nonnegative finite dt required');
  const magnitude=field.length();
  if (!Number.isFinite(magnitude))throw new RangeError('Field magnitude must be finite');
  const angle=magnitude/mass*dt;
  if (!Number.isFinite(angle))throw new RangeError('Field rotation must be finite');
  let after=before.clone();
  if (magnitude>0&&dt>0) {
    const axis=field.scale(1/magnitude),parallel=axis.scale(before.dot(axis));
    const perpendicular=before.vsub(parallel),turn=before.cross(axis);
    after=parallel.vadd(perpendicular.scale(Math.cos(angle))).vadd(turn.scale(Math.sin(angle)));
  }
  const kineticBefore=.5*mass*before.lengthSquared(),kineticAfter=.5*mass*after.lengthSquared();
  if (![after.x,after.y,after.z,kineticBefore,kineticAfter].every(Number.isFinite))
    throw new RangeError('Finite magnetic output and kinetic energy required');
  return {velocityBefore:before,velocityAfter:after,magneticImpulse:after.vsub(before).scale(mass),
    kineticBefore,kineticAfter,magneticWork:kineticAfter-kineticBefore,angle};
}

/** A finite spatial field acting at the actual original body's charge centre.
 * No waypoint, target attraction, snap, position edit or extra body exists.
 * The room owner calls apply once per physics step; no global hook is added.
 */
export function createCastleMagneticBend({body,centre,halfExtents,qB}) {
  if (!body?.world || body.type!==Body.DYNAMIC || !(body.mass>0)
    || !body.world.bodies.includes(body))throw new TypeError('A live dynamic body is required');
  const world=body.world,c=finiteVector(centre,'Field centre'),half=finiteVector(halfExtents,'Field half extents');
  const field=finiteVector(qB,'qB');
  if (![half.x,half.y,half.z].every(v=>v>0))throw new RangeError('Positive field extents required');
  let enabled=true,polarity=1,disposed=false,lastWorldStep=null;
  const inside=()=>Math.abs(body.position.x-c.x)<=half.x
    &&Math.abs(body.position.y-c.y)<=half.y&&Math.abs(body.position.z-c.z)<=half.z;
  return {
    body,world,centre:c,halfExtents:half,
    setEnabled(value){if(typeof value!=='boolean')throw new TypeError('Boolean supply state required');enabled=value;},
    setPolarity(value){if(value!==1&&value!==-1)throw new RangeError('Polarity must be +1 or -1');polarity=value;},
    resetClock(){lastWorldStep=null;},
    apply(dt){
      if(disposed)throw new Error('Magnetic field is disposed');
      if(!Number.isFinite(dt)||dt<0)throw new RangeError('Nonnegative finite dt required');
      if(body.world!==world||!world.bodies.includes(body))throw new Error('Magnetic body owner changed');
      if(!enabled||!inside()||body.type!==Body.DYNAMIC)return {applied:false,worldStep:world.stepnumber,bodyId:body.id};
      if(dt>0&&lastWorldStep===world.stepnumber)return {applied:false,duplicate:true,worldStep:world.stepnumber,bodyId:body.id};
      const result=castleMagneticBendVelocity({velocity:body.velocity,mass:body.mass,qB:field.scale(polarity),dt});
      body.applyImpulse(result.magneticImpulse);
      if(dt>0)lastWorldStep=world.stepnumber;
      return {...result,applied:true,worldStep:world.stepnumber,bodyId:body.id,
        actualVelocityAfter:body.velocity.clone(),polarity};
    },
    dispose(){disposed=true;enabled=false;},
  };
}
