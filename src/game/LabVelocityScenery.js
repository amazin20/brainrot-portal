import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const WHITE = 0xd9e9f0;

function point(value, fallback = new THREE.Vector3()) {
  if (value?.isVector3) return value.clone();
  if (Array.isArray(value)) return new THREE.Vector3(...value);
  if (value?.getFrame) return point(value.getFrame().position ?? value.getFrame().center, fallback);
  if (value?.center) return point(value.center, fallback);
  if (value?.position) return point(value.position, fallback);
  if (value?.group?.position) return point(value.group.position, fallback);
  return fallback.clone();
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function horizontalDistance(p, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const t = THREE.MathUtils.clamp(((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1), 0, 1);
  return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz);
}

/** Decorative architecture only. It never registers a collider or touches an
 * actor. All scenery uses world coordinates and deterministic, absolute-time
 * motion, so pausing, restarting and reduced motion cannot accumulate drift.
 * Four relay sections cost at most seven draw calls, including both storms. */
export function buildVelocityScenery({ root, segments = [], chapter = 1, game = {} }) {
  const group = new THREE.Group();
  group.name = 'Velocity / distant fracture architecture';
  root.add(group);
  const random = seededRandom(chapter === 2 ? 20390817 : 10390511);
  const storm = chapter === 2;
  const lowQuality = game.quality?.shadows === false;
  const routes = segments.map(segment => {
    const start = point(segment.spawn ?? segment.start ?? segment.runway?.center);
    const intake = point(segment.intake, start);
    const exit = point(segment.exit, intake);
    const landing = point(segment.landing, exit.clone().add(new THREE.Vector3(0, 0, -60)));
    return { start, intake, exit, landing };
  });
  if (!routes.length) routes.push({ start: point([0, 70, 0]), intake: point([0, 20, -30]), exit: point([40, 90, -60]), landing: point([-60, 70, -60]) });
  const paths = routes.flatMap(({ start, intake, exit, landing }) => [[start, intake], [intake, exit], [exit, landing]]);
  const anchors = routes.flatMap(route => [route.start, route.intake, route.exit, route.landing]);
  const center = anchors.reduce((sum, anchor) => sum.add(anchor), new THREE.Vector3()).divideScalar(anchors.length);
  const clearOfRoute = (p, radius) => paths.every(([a, b]) => horizontalDistance(p, a, b) > radius);
  const geometries = new Set(), materials = new Set();
  const ownGeometry = geometry => (geometries.add(geometry), geometry);
  const ownMaterial = material => (materials.add(material), material);
  const lineMaterial = opacity => ownMaterial(new THREE.LineBasicMaterial({ color: WHITE, transparent: true, opacity, depthWrite: false }));
  const makeLines = (vertices, material) => {
    const geometry = ownGeometry(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    return new THREE.LineSegments(geometry, material);
  };

  // Broken double rings sit alongside each launch corridor, never across it.
  // Depth rails and irregular missing sectors make their scale readable even
  // with simple line geometry, without luminous panels masking portal targets.
  const rings = [];
  routes.forEach((route, index) => {
    const forward = route.landing.clone().sub(route.exit).setY(0).normalize();
    if (forward.lengthSq() < .1) forward.set(0, 0, -1);
    const side = new THREE.Vector3().crossVectors(forward, UP).normalize();
    const radius = (storm ? 53 : 40) + index * 3;
    const location = route.exit.clone().lerp(route.landing, .48);
    let sideDistance = radius + 79;
    let position = location.clone().addScaledVector(side, sideDistance);
    for (let attempt = 0; attempt < 6 && !clearOfRoute(position, radius + 30); attempt++) {
      sideDistance += 28;
      position = location.clone().addScaledVector(side, sideDistance * (attempt % 2 ? -1 : 1));
    }
    if (!clearOfRoute(position, radius + 30)) return;
    position.y += 9 + (index % 2) * 19;
    const vertices = [];
    for (let layer = 0; layer < 2; layer++) {
      const r = radius + layer * 9, depth = 1.8 + layer * 1.1;
      const add = (a, b) => vertices.push(...a, ...b);
      const tilt = layer * .23;
      const polar = (angle, distance, z) => {
        const x = Math.cos(angle + layer * .6) * distance, y = Math.sin(angle + layer * .6) * distance;
        return [x, y * Math.cos(tilt) - z * Math.sin(tilt), y * Math.sin(tilt) + z * Math.cos(tilt)];
      };
      for (let step = 0; step < 112; step++) {
        if ((step + index * 9 + layer * 5) % 28 > 20) continue;
        const a = step / 112 * Math.PI * 2, b = (step + 1) / 112 * Math.PI * 2;
        for (const edge of [r, r + 1.15]) for (const z of [-depth, depth]) add(polar(a, edge, z), polar(b, edge, z));
        if (step % 4 === 0) {
          add(polar(a, r, -depth), polar(a, r + 1.15, depth));
          add(polar(a, r + 1.15, -depth), polar(a, r, depth));
        }
      }
    }
    const material = lineMaterial(.38);
    const mesh = makeLines(vertices, material);
    mesh.name = `Fractured orbital ring pair ${index + 1}`;
    mesh.position.copy(position);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), side.clone().addScaledVector(UP, .19).normalize());
    group.add(mesh);
    rings.push({ mesh, material, index, base: mesh.quaternion.clone(), phase: index * 1.7, speed: .018 * (index % 2 ? -1 : 1) });
  });

  // One instanced draw call for every dark monolith, one batched line call for
  // their silhouettes. Tilted towers provide parallax with no moving obstacles.
  const towers = [], outline = [], dummy = new THREE.Object3D();
  const boxGeometry = ownGeometry(new THREE.BoxGeometry(1, 1, 1));
  const dark = ownMaterial(new THREE.MeshBasicMaterial({ color: 0x070c14 }));
  for (let i = 0; i < (lowQuality ? 18 : storm ? 55 : 34); i++) {
    const anchor = anchors[Math.floor(random() * anchors.length)];
    const angle = random() * Math.PI * 2, distance = 105 + random() * 135;
    const position = anchor.clone().add(new THREE.Vector3(Math.cos(angle) * distance, 0, Math.sin(angle) * distance));
    if (!clearOfRoute(position, 78)) continue;
    const height = 62 + random() * (storm ? 112 : 75);
    position.y = center.y - 55 + random() * 28;
    dummy.position.copy(position);
    dummy.rotation.set((random() - .5) * .45, random() * Math.PI, (random() - .5) * .55);
    dummy.scale.set(6 + random() * 12, height, 5 + random() * 11);
    dummy.updateMatrix(); towers.push(dummy.matrix.clone());
    const corners = Array.from({ length: 8 }, (_, n) => new THREE.Vector3(n & 1 ? .5 : -.5, n & 2 ? .5 : -.5, n & 4 ? .5 : -.5).applyMatrix4(dummy.matrix));
    for (let n = 0; n < 8; n++) for (const bit of [1, 2, 4]) if (!(n & bit)) outline.push(...corners[n].toArray(), ...corners[n | bit].toArray());
  }
  const monoliths = new THREE.InstancedMesh(boxGeometry, dark, towers.length);
  monoliths.name = 'Distant leaning monoliths';
  towers.forEach((matrix, index) => monoliths.setMatrixAt(index, matrix));
  monoliths.instanceMatrix.needsUpdate = true;
  monoliths.computeBoundingSphere(); group.add(monoliths);
  const contours = makeLines(outline, lineMaterial(storm ? .39 : .30));
  contours.name = 'Batched architectural contours'; group.add(contours);

  const stormGroup = new THREE.Group(); stormGroup.name = 'Distant fragments'; group.add(stormGroup);
  const shards = [];
  for (let i = 0; i < (lowQuality ? 0 : storm ? 260 : 105); i++) {
    const anchor = anchors[Math.floor(random() * anchors.length)];
    const angle = random() * Math.PI * 2, distance = 32 + random() * 115;
    const position = anchor.clone().add(new THREE.Vector3(Math.cos(angle) * distance, (random() - .4) * 170, Math.sin(angle) * distance));
    if (!clearOfRoute(position, 28)) continue;
    dummy.position.copy(position); dummy.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
    const size = .28 + random() * 1.8;
    dummy.scale.set(size * .33, size * (storm ? 3.8 : 2.4), size * .22); dummy.updateMatrix(); shards.push(dummy.matrix.clone());
  }
  const shardMaterial = ownMaterial(new THREE.MeshBasicMaterial({ color: WHITE, transparent: true, opacity: storm ? .40 : .27, depthWrite: false }));
  const fragments = new THREE.InstancedMesh(ownGeometry(new THREE.OctahedronGeometry(1, 0)), shardMaterial, shards.length);
  fragments.name = 'Instanced white fragments'; shards.forEach((matrix, index) => fragments.setMatrixAt(index, matrix));
  fragments.instanceMatrix.needsUpdate = true; fragments.computeBoundingSphere(); stormGroup.add(fragments);
  group.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(group);
  const spin = new THREE.Quaternion(), axis = new THREE.Vector3(0, 0, 1);
  let disposed = false;
  const update = (time = 0, stage = 0) => {
    if (disposed) return;
    const options = game.epicDirector?.options ?? game.epicOptions ?? {};
    const motionTime = options.reducedMotion ? 0 : Number.isFinite(time) ? time : 0;
    for (const ring of rings) {
      spin.setFromAxisAngle(axis, ring.phase + motionTime * ring.speed);
      ring.mesh.quaternion.copy(ring.base).multiply(spin);
      ring.material.opacity = .28 + (ring.index === stage ? .10 : 0);
    }
    stormGroup.visible = !lowQuality && options.speedLines !== false;
    stormGroup.position.y = options.reducedMotion ? 0 : Math.sin(motionTime * .13) * (storm ? 2.1 : .9);
  };
  update(0, 0);
  return {
    group, bounds,
    diagnostics: Object.freeze({ chapter: storm ? 2 : 1, drawCalls: rings.length + (lowQuality ? 2 : 3), monoliths: towers.length, fragments: shards.length, rings: rings.length * 2, corridorClearance: 28, lowQuality }),
    update,
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      monoliths.dispose(); fragments.dispose();
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
    },
  };
}
