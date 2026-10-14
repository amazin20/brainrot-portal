import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { DistributorBench } from './DistributorRig.js';

// Editable procedural review model. It is not a final exported campaign asset.
const bench = new DistributorBench();
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15; document.body.prepend(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xdce8e7);
scene.fog = new THREE.Fog(0xdce8e7, 20, 45);
const camera = new THREE.PerspectiveCamera(43, innerWidth / innerHeight, .1, 70);
camera.position.set(8.8, 9.2, 10.6);
const orbit = new OrbitControls(camera, renderer.domElement); orbit.target.set(.35, .9, 0); orbit.enableDamping = true;
orbit.minDistance = 7; orbit.maxDistance = 22; orbit.maxPolarAngle = Math.PI * .47; orbit.update();
scene.add(new THREE.HemisphereLight(0xf2fbff, 0x748582, 2.6));
const light = new THREE.DirectionalLight(0xffeed9, 3.2); light.position.set(-5, 12, 8); light.castShadow = true;
light.shadow.mapSize.set(1024, 1024); Object.assign(light.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9 });
light.shadow.normalBias = .025; scene.add(light);
const mats = {
  shell: new THREE.MeshStandardMaterial({ color: 0xe5e9dc, metalness: .12, roughness: .43 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x788d96, metalness: .72, roughness: .3 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x293e49, metalness: .4, roughness: .5 }),
  accent: new THREE.MeshStandardMaterial({ color: 0x63b4b3, metalness: .2, roughness: .42 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xd9aa55, metalness: .64, roughness: .36 }),
};
const owned = new Set();
function mesh(parent, geometry, material, position = [0, 0, 0]) {
  owned.add(geometry); const m = new THREE.Mesh(geometry, material); m.position.fromArray(position);
  m.castShadow = m.receiveShadow = true; parent.add(m); return m;
}
function box(parent, size, pos, material = mats.shell, radius = .035) {
  return mesh(parent, new RoundedBoxGeometry(...size, 2, Math.min(radius, ...size.map(n => n * .3))), material, pos);
}
function cylinder(parent, radius, height, pos, material = mats.steel) {
  return mesh(parent, new THREE.CylinderGeometry(radius, radius, height, 32), material, pos);
}
box(scene, [16, .4, 16], [0, -.2, 0], mats.shell, .03);
const grid = new THREE.GridHelper(16, 8, 0xa8bab9, 0xc6d3cf); grid.position.y = .004; scene.add(grid);
const fixed = new THREE.Group(); fixed.position.fromArray(bench.rig.origin.toArray()); scene.add(fixed);
// Central bearing and foundation visualize the hinge support, not a walkable room.
box(fixed, [1.5, .20, 1.5], [0, -1.3, 0], mats.dark);
cylinder(fixed, .38, 1.12, [0, -.64, 0]);
cylinder(fixed, .54, .17, [0, -.08, 0], mats.brass);
for (const x of [-.53, .53]) for (const z of [-.53, .53]) cylinder(fixed, .06, .06, [x, -1.17, z]);
const rotor = new THREE.Group(); scene.add(rotor);
for (const p of bench.rig.parts) box(rotor, p.half.map(n => n * 2), p.offset,
  p.name.includes('paddle') ? mats.accent : p.name.includes('rail') ? mats.dark : mats.shell, .02);
// Recessed tray wear strips and a broad paddle frame are attached to the same body.
for (const x of [-2.45, -1.7, -.95, -.2, .55, 1.3, 2.05]) box(rotor, [.50, .025, .98], [x, .132, 0], mats.steel, .008);
for (const x of [1.03, 2.57]) box(rotor, [.09, 1.23, .235], [x, .84, 0], mats.dark, .016);
box(rotor, [1.65, .09, .23], [1.8, 1.49, 0], mats.dark);
cylinder(rotor, .42, .18, [0, .22, 0], mats.steel);
for (const item of bench.rig.fixed) {
  const pos = item.body.position.toArray(); box(scene, item.half.map(n => n * 2), pos, mats.dark);
  box(scene, [.55, .14, .55], [pos[0], .07, pos[2]], mats.steel);
  box(scene, [.22, .85, .22], [pos[0], .55, pos[2]], mats.steel);
}
// A visible cam roller follows the same passive periodic spring used by the rig.
const cam = new THREE.Group(); fixed.add(cam);
const ring = mesh(cam, new THREE.TorusGeometry(.77, .052, 8, 64), mats.brass, [0, -.35, 0]); ring.rotation.x = Math.PI / 2;
const follower = cylinder(fixed, .095, .12, [.8, -.35, 0], mats.dark);
box(fixed, [.7, .11, .17], [1.12, -.35, 0], mats.steel);
const coils = new THREE.Curve(); coils.getPoint = t => new THREE.Vector3(.92 + .43 * t, -.35 + .07 * Math.cos(t * Math.PI * 14), .07 * Math.sin(t * Math.PI * 14));
mesh(fixed, new THREE.TubeGeometry(coils, 70, .013, 6, false), mats.brass);
const cargo = new THREE.Group(); scene.add(cargo);
let loaded = false, frozen = false, last = performance.now();
function render(alpha = 1) {
  const r = bench.rig.rotor, b = bench.cargo;
  rotor.position.lerpVectors(new THREE.Vector3(...r.previousPosition.toArray()), new THREE.Vector3(...r.position.toArray()), alpha);
  rotor.quaternion.copy(new THREE.Quaternion(...r.previousQuaternion.toArray())).slerp(new THREE.Quaternion(...r.quaternion.toArray()), alpha);
  cargo.position.lerpVectors(new THREE.Vector3(...b.previousPosition.toArray()), new THREE.Vector3(...b.position.toArray()), alpha);
  cargo.quaternion.copy(new THREE.Quaternion(...b.previousQuaternion.toArray())).slerp(new THREE.Quaternion(...b.quaternion.toArray()), alpha);
  follower.position.x = .80 + .055 * (1 - Math.cos(2 * Math.PI * bench.rig.angle / bench.rig.pitch));
  cam.rotation.y = bench.rig.angle;
  document.querySelector('#status').textContent = `${(bench.rig.angle * 180 / Math.PI).toFixed(1)}° · ${bench.rig.rotor.angularVelocity.y.toFixed(2)} рад/с`;
  orbit.update(); renderer.render(scene, camera);
}
function syncBrake() { const e = document.querySelector('#brake'); e.textContent = bench.rig.braked ? 'Тормоз включён' : 'Тормоз выключен'; e.setAttribute('aria-pressed', String(bench.rig.braked)); }
function launch(options, text) { bench.launch(options); syncBrake(); document.querySelector('#scenario').textContent = text; render(); }
function brake() { bench.rig.setBrake(!bench.rig.braked); syncBrake(); }
const listeners = [];
for (const [id, fn] of Object.entries({ weak: () => launch({ speed: .5, distance: .52 }, 'Слабый удар: возврат к исходному положению'),
  left: () => launch({ side: 1, speed: 8 }, 'Удар слева: поворот от контакта'), right: () => launch({ side: -1, speed: 8 }, 'Удар справа: противоположный поворот'),
  reverse: () => launch({ side: bench.rig.angle > 0 ? -1 : 1, speed: 8, reset: false }, 'Обратный удар тем же грузом'), brake,
  reset: () => launch({ speed: 0, distance: 3 }, 'Исходная конфигурация стенда') })) {
  const e = document.getElementById(id); e.addEventListener('click', fn); listeners.push([e, fn]);
}
const resize = () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); };
addEventListener('resize', resize);
const draco = new DRACOLoader().setDecoderPath('./draco/');
try {
  const gltf = await new GLTFLoader().setDRACOLoader(draco).loadAsync('./models/runtime/model-02-cargo.glb');
  const model = gltf.scene, bounds = new THREE.Box3().setFromObject(model), size = bounds.getSize(new THREE.Vector3());
  model.scale.multiplyScalar(.82 / Math.max(size.x, size.y, size.z)); bounds.setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3()); model.position.set(-center.x, -.39 - bounds.min.y, -center.z);
  model.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; }); cargo.add(model); loaded = true;
  launch({ speed: 0, distance: 3 }, 'Готово. Выберите сторону удара.');
  window.__W02__ = { bench, loaded, freeze: () => { frozen = true; },
    launch: (options, text = 'Техническое испытание') => launch(options, text),
    frame: (dt = 1 / 30) => { bench.advance(dt); render(1); return bench.snapshot(); },
    snapshot: () => bench.snapshot() };
} catch (error) { document.querySelector('#error').textContent = error.message; throw error; }
finally { draco.dispose(); }
renderer.setAnimationLoop(now => { const dt = Math.min(.1, (now - last) / 1000); last = now;
  if (!frozen && loaded && !document.hidden) { bench.advance(dt); render(bench.accumulator / (1 / 120)); } });
let disposed = false;
addEventListener('pagehide', e => { if (e.persisted || disposed) return; disposed = true;
  renderer.setAnimationLoop(null); orbit.dispose(); bench.dispose(); removeEventListener('resize', resize);
  for (const [element, listener] of listeners) element.removeEventListener('click', listener);
  const materials = new Set(Object.values(mats)), textures = new Set();
  scene.traverse(object => {
    if (object.geometry) owned.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material) continue; materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  for (const geometry of owned) geometry.dispose(); for (const material of materials) material.dispose();
  for (const texture of textures) texture.dispose(); light.shadow.dispose(); renderer.dispose();
});
