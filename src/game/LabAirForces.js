import * as THREE from 'three';
/** Samples the same finite, obstructed segments used by the airflow rendering.
 * A body radius intersects the plume; this is drag toward moving air, not a
 * per-frame position nudge or an instantaneous launch impulse. */
export function airAcceleration(segments, point, velocity, { strength=1, speed=12, radius=.82, bodyRadius=0, response=7, maximum=75 }={}) {
  const result = new THREE.Vector3();
  if (!(strength>0) || !point || !velocity) return result;
  for (const segment of segments) {
    const d=segment.direction, offset=new THREE.Vector3().subVectors(point,segment.a), t=offset.dot(d);
    if(t<0 || t>segment.length)continue;
    offset.addScaledVector(d,-t);
    const radial=offset.length(), outer=radius+bodyRadius;
    if(radial>=outer)continue;
    const edge=1-THREE.MathUtils.smoothstep(radial,Math.max(0,radius*.7),outer);
    result.copy(d).multiplyScalar(THREE.MathUtils.clamp((speed*strength-velocity.dot(d))*response*strength*edge,-maximum,maximum));
    return result;
  }
  return result;
}
