import * as THREE from 'three';
import { transformPortalDirection, pointInsidePortal } from './LabPortals.js';

const V = () => new THREE.Vector3();
const mod = (n, d) => ((n % d) + d) % d;
const smooth = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);
const UP = new THREE.Vector3(0, 1, 0);

/** Deterministic metres-per-second tracers, not a second physics simulation.
 * One pool spans the whole air path; portals transport its transverse basis.
 * Never draws a line across the empty space BETWEEN a portal pair.
 * A fixed-size instanced buffer is reused at every render (including portals).
 */
export class LabAirflowVisual {
  constructor(parent, { capacity = 180, speed = 5.6, radius = .42 } = {}) {
    if (!Number.isInteger(capacity) || capacity < 12 || capacity > 512 || !Number.isFinite(speed) || speed <= 0 || !Number.isFinite(radius) || radius <= 0) throw new RangeError('Invalid airflow visual budget');
    this.capacity = capacity; this.speed = speed; this.radius = radius;
    this.distance = this.previousDistance = this.time = this.previousTime = 0;
    this.strength = this.previousStrength = 0; this.path = []; this.length = 0;
    this._p = V(); this._q = new THREE.Quaternion(); this._temp = V();
    const geometry = new THREE.InstancedBufferGeometry();
    const vertices = [], uv = [], indices = [];
    // Curved, feathered ribbons rather than hard opaque dust spheres.
    for (let j = 0; j <= 6; j++) for (let side = 0; side < 2; side++) { vertices.push(0, 0, 0); uv.push(j / 6, side); }
    for (let j = 0; j < 6; j++) { const a = j * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    geometry.setIndex(indices); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    this.center = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.tangent = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.shape = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aCenter', this.center); geometry.setAttribute('aTangent', this.tangent); geometry.setAttribute('aShape', this.shape);
    const material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide, toneMapped: false,
      uniforms: { tint: { value: new THREE.Color(0xcbe6e9) } },
      vertexShader: `
        attribute vec3 aCenter;
        attribute vec3 aTangent;
        attribute vec4 aShape;
        varying vec2 vUv;
        varying float vAlpha;
        void main() {
          vUv = uv; vAlpha = aShape.z;
          vec4 centre = viewMatrix * vec4(aCenter, 1.0);
          vec3 axis = (viewMatrix * vec4(aTangent, 0.0)).xyz;
          vec2 perpendicular = length(axis.xy) > 0.0001 ? normalize(vec2(-axis.y, axis.x)) : vec2(0.0, 1.0);
          vec4 p = centre + vec4(axis * ((uv.x - 0.5) * aShape.x), 0.0);
          p.xy += perpendicular * ((uv.y - 0.5 + 0.22 * sin(uv.x * 6.28318 + aShape.w)) * aShape.y);
          gl_Position = projectionMatrix * p;
        }`,
      fragmentShader: `
        uniform vec3 tint;
        varying vec2 vUv;
        varying float vAlpha;
        void main() {
          float edge = max(0.0, 1.0 - abs(vUv.y * 2.0 - 1.0));
          float taper = pow(max(0.0, sin(vUv.x * 3.14159265)), 0.7);
          float opacity = vAlpha * edge * edge * taper;
          if (opacity < 0.002) discard;
          gl_FragColor = vec4(tint, opacity);
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(geometry, material); this.mesh.name = 'Soft advected airflow';
    this.mesh.frustumCulled = false; this.mesh.visible = false; parent.add(this.mesh);
    this.seeds = Array.from({ length: capacity }, (_, i) => ({
      phase: i * 83 / capacity, angle: i * 2.3999632297,
      radial: .18 + .82 * Math.sqrt(mod(i * .754877666, 1)),
      length: i % 13 === 0 ? 1.15 : i % 3 === 0 ? .13 : .48 + mod(i * .618033989, 1) * .40,
      width: i % 13 === 0 ? .34 : i % 3 === 0 ? .085 : .105,
      alpha: i % 13 === 0 ? .12 : i % 3 === 0 ? .40 : .47,
    }));
    this.reset();
  }

  step(dt, strength) {
    if (!Number.isFinite(dt) || dt < 0 || !Number.isFinite(strength)) throw new RangeError('Finite airflow time and strength required');
    this.previousDistance = this.distance; this.previousTime = this.time; this.previousStrength = this.strength;
    this.strength = THREE.MathUtils.clamp(strength, 0, 1);
    this.time += dt; this.distance += dt * this.speed * (.5 + .5 * (this.previousStrength + this.strength) / 2);
  }

  /** Path is rebuilt only from committed tracing data, with no per-particle raycast. */
  setPath(segments, portals = []) {
    this.path.length = 0; this.length = 0;
    for (let i = 0; i < Math.min(segments.length, 6); i++) {
      const s = segments[i];
      if (!Number.isFinite(s.length) || s.length <= .01 || !s.a?.toArray().every(Number.isFinite) || !s.direction?.toArray().every(Number.isFinite)) continue;
      const d = s.direction.clone().normalize(); if (d.lengthSq() < .99) continue;
      let right = V(), up = V();
      const prev = this.path[this.path.length - 1];
      if (prev) {
        const entry = portals.find(p => p && prev.kind === 'portal' && Math.abs(prev.b.clone().sub(p.position).dot(p.normal)) < .09 && pointInsidePortal(p, prev.b, .04));
        const exit = entry && portals.find(p => p && p !== entry);
        if (entry && exit) { right = transformPortalDirection(prev.right, entry, exit).normalize(); up = transformPortalDirection(prev.up, entry, exit).normalize(); }
        else { this._q.setFromUnitVectors(prev.direction, d); right.copy(prev.right).applyQuaternion(this._q); up.copy(prev.up).applyQuaternion(this._q); }
      } else {
        right.crossVectors(d, UP); if (right.lengthSq() < .001) right.set(1, 0, 0); right.normalize(); up.crossVectors(right, d).normalize();
      }
      this.path.push({ a: s.a.clone(), b: s.a.clone().addScaledVector(d, s.length), direction: d, length: s.length, kind: s.kind, right, up, start: this.length });
      this.length += s.length;
    }
  }

  /** Buffer contents are deterministic for a given physical time + render alpha. */
  render(alpha = 1, quality = 'balanced') {
    const blend = THREE.MathUtils.clamp(Number.isFinite(alpha) ? alpha : 1, 0, 1);
    const distance = THREE.MathUtils.lerp(this.previousDistance, this.distance, blend);
    const time = THREE.MathUtils.lerp(this.previousTime, this.time, blend);
    const strength = THREE.MathUtils.lerp(this.previousStrength, this.strength, blend);
    const count = quality === 'low' ? Math.round(this.capacity * .55) : this.capacity;
    this.mesh.geometry.instanceCount = count;
    this.mesh.visible = strength > .005 && this.length > .02;
    for (let i = 0; i < count; i++) {
      const seed = this.seeds[Math.floor(i * this.capacity / count)], progress = mod(distance + seed.phase, 83) - .6;
      const s = this.path.find(p => progress >= p.start && progress < p.start + p.length);
      if (!this.mesh.visible || !s) { this.shape.setXYZW(i, 0, 0, 0, 0); continue; }
      const local = progress - s.start, remaining = s.length - local;
      // Each ribbon stays entirely in ONE traced segment; no portal-spanning tail.
      const span = Math.min(seed.length, local * 1.9, remaining * 1.9);
      const lip = smooth(0, .5, local) * smooth(0, .5, remaining);
      const envelope = (.16 + .84 * lip) * this.radius * seed.radial;
      const curl = seed.angle + time * .34 + progress * .24;
      this._p.copy(s.a).addScaledVector(s.direction, local)
        .addScaledVector(s.right, Math.cos(curl) * envelope).addScaledVector(s.up, Math.sin(curl) * envelope);
      const opacity = seed.alpha * strength * smooth(0, .14, local) * smooth(0, .20, remaining)
        * (.78 + .22 * Math.sin(time * 1.3 + seed.angle) ** 2);
      this.center.setXYZ(i, this._p.x, this._p.y, this._p.z);
      this.tangent.setXYZ(i, s.direction.x, s.direction.y, s.direction.z);
      this.shape.setXYZW(i, span, seed.width * (.65 + .35 * lip), opacity, curl);
    }
    this.center.needsUpdate = this.tangent.needsUpdate = this.shape.needsUpdate = true;
  }

  reset() {
    this.distance = this.previousDistance = this.time = this.previousTime = this.strength = this.previousStrength = this.length = 0;
    this.path.length = 0; this.shape.array.fill(0); this.shape.needsUpdate = true; this.mesh.visible = false;
  }
}
