import {Body, Quaternion, Vec3} from 'cannon-es';

const vector = (v, name) => {
  if (!v || ![v.x, v.y, v.z].every(Number.isFinite)) throw new RangeError(`${name} must be finite`);
  return new Vec3(v.x, v.y, v.z);
};
const unit = (v, name) => {
  const out = vector(v, name), length = out.length();
  if (length < 1e-10) throw new RangeError(`${name} must have a direction`);
  return out.scale(1 / length);
};
const rotation = q => {
  if (!q || ![q.x,q.y,q.z,q.w].every(Number.isFinite)) throw new RangeError('A finite rigid transport rotation is required');
  const norm = Math.hypot(q.x,q.y,q.z,q.w);
  if (Math.abs(norm - 1) > 1e-7) throw new RangeError('Transport rotation must be unit length');
  return new Quaternion(q.x / norm, q.y / norm, q.z / norm, q.w / norm);
};

/** Isolated prototype for a freight mouth on a freely translating rail body.
 * The fixed entry receives incoming momentum. The exit guide receives the
 * outgoing transverse momentum; its free rail coordinate receives the normal
 * recoil. These separate support impulses are explicit in the returned ledger.
 *
 * Tangential velocity is rigidly mapped. The remaining normal kinetic energy
 * is shared by the original cargo and finite-mass carrier. This is an elastic
 * one-dimensional scattering model, not the existing default portal rule.
 * It has no position, progression, berth, motor, or gameplay-win owner.
 */
export function solveCastlePortalRecoil({cargoMass, carrierMass, incomingVelocity,
  carrierVelocity, transportRotation, railAxis, exitNormal}) {
  if (![cargoMass,carrierMass].every(v => Number.isFinite(v) && v > 0))
    throw new RangeError('Actual positive cargo and carrier masses are required');
  const incoming = vector(incomingVelocity, 'Incoming velocity');
  const oldCarrier = vector(carrierVelocity, 'Carrier velocity');
  const axis = unit(railAxis, 'Rail axis'), normal = unit(exitNormal, 'Exit normal');
  const sign = normal.dot(axis);
  if (Math.abs(Math.abs(sign) - 1) > 1e-8) throw new RangeError('Exit normal must be parallel to the free rail coordinate');
  const mapped = rotation(transportRotation).vmult(incoming);
  const normalSpeed = mapped.dot(normal);
  if (normalSpeed < -1e-8) throw new RangeError('Cargo must emerge through the front of the freight mouth');
  const tangent = mapped.vsub(normal.scale(normalSpeed));
  const oldRailSpeed = oldCarrier.dot(axis), totalMass = cargoMass + carrierMass;
  const centreSpeed = carrierMass * oldRailSpeed / totalMass;
  const relativeSpeed = Math.sign(sign) * Math.sqrt(oldRailSpeed ** 2
    + totalMass / carrierMass * normalSpeed ** 2);
  const cargoRailSpeed = centreSpeed + carrierMass / totalMass * relativeSpeed;
  const nextRailSpeed = centreSpeed - cargoMass / totalMass * relativeSpeed;
  const outgoing = tangent.vadd(axis.scale(cargoRailSpeed));
  const nextCarrier = oldCarrier.vadd(axis.scale(nextRailSpeed - oldRailSpeed));
  const carrierImpulse = axis.scale(carrierMass * (nextRailSpeed - oldRailSpeed));
  const fixedEntryImpulse = incoming.scale(cargoMass);
  const exitGuideImpulse = tangent.scale(-cargoMass);
  const kineticBefore = .5 * cargoMass * incoming.lengthSquared() + .5 * carrierMass * oldCarrier.lengthSquared();
  const kineticAfter = .5 * cargoMass * outgoing.lengthSquared() + .5 * carrierMass * nextCarrier.lengthSquared();
  const dynamicMomentumBefore = incoming.scale(cargoMass).vadd(oldCarrier.scale(carrierMass));
  const dynamicMomentumAfter = outgoing.scale(cargoMass).vadd(nextCarrier.scale(carrierMass));
  // The fixed entry is grounded and has zero velocity: it can absorb the
  // incoming vector momentum without doing support work. M*V is the rail
  // budget AFTER that support reaction, not pre-crossing total momentum when
  // the incoming cargo itself already has a rail-axis velocity component.
  const railMomentumBefore = dynamicMomentumBefore.dot(axis)-fixedEntryImpulse.dot(axis);
  const railMomentumAfter = cargoMass * outgoing.dot(axis) + carrierMass * nextCarrier.dot(axis);
  return {cargoMass,carrierMass,incomingVelocity:incoming,outgoingVelocity:outgoing,
    carrierVelocityBefore:oldCarrier,carrierVelocityAfter:nextCarrier,carrierImpulse,
    fixedEntryImpulse,exitGuideImpulse,railMomentumBefore,railMomentumAfter,
    dynamicMomentumBefore,dynamicMomentumAfter,
    totalDynamicRailMomentumBefore:dynamicMomentumBefore.dot(axis),
    totalDynamicRailMomentumAfter:dynamicMomentumAfter.dot(axis),
    fixedEntryRailImpulse:fixedEntryImpulse.dot(axis),
    momentumResidual:dynamicMomentumAfter.vsub(dynamicMomentumBefore).vadd(fixedEntryImpulse).vadd(exitGuideImpulse),
    kineticBefore,kineticAfter,kineticDifference:kineticAfter-kineticBefore,
    scope:'Finite-mass freight crossing operator; default portals and actor poses are unchanged'};
}

/** Apply at the canonical velocity-transform boundary, INSTEAD of applying
 * the default velocity rotation a second time. Geometric aperture crossing,
 * body orientation, cooldown and positions must remain the normal transport
 * owner's job. Not integrated into a castle room by this prototype. */
export function applyCastlePortalRecoil({cargoBody,carrierBody,...options}) {
  if (!cargoBody || !carrierBody || cargoBody === carrierBody
    || cargoBody.type !== Body.DYNAMIC || carrierBody.type !== Body.DYNAMIC
    || !cargoBody.world || cargoBody.world !== carrierBody.world
    || !cargoBody.world.bodies.includes(cargoBody) || !carrierBody.world.bodies.includes(carrierBody))
    throw new TypeError('Two live, separate dynamic bodies in the same world are required');
  const result = solveCastlePortalRecoil({...options,cargoMass:cargoBody.mass,
    carrierMass:carrierBody.mass,incomingVelocity:cargoBody.velocity,carrierVelocity:carrierBody.velocity});
  const cargoImpulse = result.outgoingVelocity.vsub(cargoBody.velocity).scale(cargoBody.mass);
  cargoBody.applyImpulse(cargoImpulse);
  carrierBody.applyImpulse(result.carrierImpulse);
  return {...result,cargoBodyId:cargoBody.id,carrierBodyId:carrierBody.id,
    worldStep:cargoBody.world.stepnumber};
}
