import { LabPortalShots } from './LabPortalShots.js';
import { sweepBox } from './LabSweep.js';
import { cargoLoadsPlate } from './LabPlateContact.js';
import * as THREE from 'three';
import { InputController } from './InputController.js';
import { AudioController } from './AudioController.js';
import { LabCamera, CAMERA_PITCH_MIN, CAMERA_PITCH_MAX } from './LabCamera.js';
import { LabPortalActors } from './LabPortalActors.js';
import { LabPlayerAnimator } from './LabPlayerAnimator.js';
import { LabHeldDevice } from './LabHeldDevice.js';
import { LabPortals, portalBacksCollider, transformPortalPoint, pointInsidePortal } from './LabPortals.js';
import { LabPhysics, sampleRampSurface } from './LabPhysics.js';
import { loadLabModels } from './LabAssetLoader.js';
import { ALL_LAB_ASSETS } from './labAssets.js';
import { LabCompanionAnimator } from './LabCompanionAnimator.js';
import { LabCompanionBehavior } from './LabCompanionBehavior.js';
import { LabCompanionRig } from './LabCompanionRig.js';
import { LabPerformance } from './LabPerformance.js';
import { LabTutorial } from './LabTutorial.js';
import { buildLabCampaignLevel, CAMPAIGN } from './LabCampaignLevels.js';
import { disposeLabLevel } from './LabLevelLifecycle.js';

const UP = new THREE.Vector3(0, 1, 0);
const PLAYER_HEIGHT = 2.4;
const PLAYER_RADIUS = 0.43;
const CENTER_HEIGHT = PLAYER_HEIGHT / 2;
const CUBE_RADIUS = 0.39;
const FIXED_STEP = 1 / 120;
const CARGO_START = [4.6, 0.6, 15.2];
export const CHAMBERS = [
  { name: '01 / МОСТ ДЛЯ ДВОИХ', start: [0, 0, 18], end: -3, button: [3.5, 0, 1.2], cube: CARGO_START, panels: [[-11.65, 1.6, 15, 1], [-11.65, 1.6, 1, 1]], objective: 'Доберитесь до следующей комнаты вместе.' },
  { name: '02 / ВЫШЕ НОС', start: [0, 0, -6], end: -26, button: [-5, 2.2, -23], cube: CARGO_START, panels: [[11.65, 1.6, -9, -1], [11.65, 1.6, -21, -1]], objective: 'Проведите брейнрота через мастерскую подъёмника.' },
  { name: '03 / НИКОГО НЕ ЗАБЫТЬ', start: [0, 0, -29], end: -47, button: [0, 0, -44], cube: CARGO_START, panels: [[-11.65, 1.6, -30, 1], [11.65, 1.6, -43, -1]], objective: 'Выход рядом. Доберитесь до него вдвоём.' },
];

export class LabGame {
  constructor({ container, touch, onProgress = () => {}, onReady = () => {}, onHud = () => {}, onToast = () => {}, onPause = () => {}, onWin = () => {}, onRestartRequest = null }) {
    this.container = container; this.touch = touch;
    this.callbacks = { onProgress, onReady, onHud, onToast, onPause, onWin, onRestartRequest };
    this.assets = new Map(); this.failures = [];
    this.colliders = []; this.cameraBlockers = []; this.aimBlockers = []; this.portalPanels = [];
    this.floors = []; this.ramps = []; this.sectorProps = [[], [], []]; this.cubes = []; this.doors = [];
    this.carryGripTargets = { left: new THREE.Vector3(), right: new THREE.Vector3() };
    this.portalCargoColliders = new Set();
    this.portalVisualOffset = new THREE.Vector3();
    this.portalVisualRotation = new THREE.Quaternion();
    this.levelIndex = 0; this.quality = { pixelRatio: 1.5, portalResolution: 960 }; this.performanceMonitor = new LabPerformance(); this.tutorial = new LabTutorial(this);
    this.state = 'loading'; this.elapsed = 0; this.stage = 0; this.thirdPerson = true;
    this.playerPosition = new THREE.Vector3(); this.playerVelocity = new THREE.Vector3();
    this.previousPlayerPosition = new THREE.Vector3(); this.previousFacing = Math.PI;
    this.renderFrames = 0; this.animationFrames = 0; this.jumpBuffer = 0; this.coyoteTime = 0;
    this.playerGrounded = true; this.yaw = 0; this.pitch = -0.15; this.facing = Math.PI;
    this.portalCooldown = 0; this.heldCube = null; this.interactQueued = false;
    this.accumulator = 0; this.lastFrame = 0; this.hudTimer = 0; this.visualTime = 0;
    this.raycaster = new THREE.Raycaster(); this.cameraForward = new THREE.Vector3(0, 0, -1);
    this.portalSurfaceIds = [null, null]; this.lastLanding = 0; this.teleportCount = 0;
    this.animate = this.animate.bind(this);
  }

  async init() {
    this.createScene();
    this.input = new InputController(this.touch); this.audio = new AudioController();
    this.setupControls();
    await this.loadAssets();
    this.callbacks.onProgress({ percent: 92, label: 'Настраиваем движения и физику' });
    await new Promise(requestAnimationFrame);
    const rigStart = performance.now();
    this.buildLevel();
    this.loadingProfile.rigAndLevelMs = performance.now() - rigStart;
    this.callbacks.onProgress({ percent: 95, label: 'Готовим первый кадр' });
    await new Promise(requestAnimationFrame);
    const compileStart = performance.now();
    this.portalActors.prepare();
    await this.renderer.compileAsync(this.scene, this.camera);
    this.render();
    this.loadingProfile.firstFrameMs = performance.now() - compileStart;
    this.callbacks.onProgress({ percent: 100, label: 'Можно отправляться' });
    this.state = 'ready'; this.lastFrame = performance.now();
    this.renderer.setAnimationLoop(this.animate);
    this.callbacks.onReady(); this.emitHud();
  }

  createScene() {
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0xaac9d4);
    this.scene.fog = new THREE.Fog(0xb3ced6, 64, 120);
    this.camera = new THREE.PerspectiveCamera(57, innerWidth / innerHeight, 0.1, 130);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.quality.pixelRatio));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = this.quality.shadows !== false; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.localClippingEnabled = true;
    this.container.appendChild(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight(0xe7f5ff, 0x9aa7ac, 2.5));
    this.keyLight = new THREE.DirectionalLight(0xfff0d9, 2.1);
    this.keyLight.position.set(-7, 30, 14); this.keyLight.target.position.set(0, 0, -14.5); this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(this.quality.shadowSize || 1024, this.quality.shadowSize || 1024);
    Object.assign(this.keyLight.shadow.camera, { left: -20, right: 20, top: 48, bottom: -48, near: 1, far: 100 });
    this.keyLight.shadow.bias = -0.00015; this.keyLight.shadow.normalBias = 0.04;
    this.scene.add(this.keyLight, this.keyLight.target);
    this.materials = {
      wall: new THREE.MeshStandardMaterial({ color: 0xe3ebe5, roughness: .87 }),
      floor: new THREE.MeshStandardMaterial({ color: 0xd2dfdc, roughness: .9 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x456879, roughness: .78, metalness: .05 }),
      trim: new THREE.MeshStandardMaterial({ color: 0x475563, roughness: .48, metalness: .4 }),
      cyan: new THREE.MeshBasicMaterial({ color: 0x50dfff }),
      amber: new THREE.MeshBasicMaterial({ color: 0xffc168 }),
      glass: new THREE.MeshStandardMaterial({ color: 0x60a9bf, transparent: true, opacity: .16, roughness: .35, depthWrite: false }),
    };
    addEventListener('resize', () => { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); this.renderer.setSize(innerWidth, innerHeight); });
  }

  async loadAssets() {
    const missing = ALL_LAB_ASSETS.filter(a => CAMPAIGN[this.levelIndex].assets.includes(a.id) && !this.assets.has(a.id));
    if (!missing.length) return;
    const result = await loadLabModels({ renderer: this.renderer, onProgress: this.callbacks.onProgress, models: missing });
    for (const [id, model] of result.assets) this.assets.set(id, model);
    this.loadingProfile = result.profile;
  }

  model(id, size, height = false) {
    const source = this.assets.get(id);
    if (!source) throw new Error('Отсутствует модель ' + id);
    const root = new THREE.Group(); root.userData.assetId = id;
    const mesh = source.clone(true);
    mesh.traverse(child => {
      if (!child.isMesh) return;
      child.castShadow = id === 1 || id === 2;
      child.receiveShadow = true;
    });
    let bounds = new THREE.Box3().setFromObject(mesh);
    const dimensions = bounds.getSize(new THREE.Vector3());
    mesh.scale.multiplyScalar(size / Math.max(height ? dimensions.y : Math.max(dimensions.x, dimensions.y, dimensions.z), .001));
    bounds = new THREE.Box3().setFromObject(mesh);
    const center = bounds.getCenter(new THREE.Vector3());
    mesh.position.x -= center.x; mesh.position.z -= center.z; mesh.position.y -= bounds.min.y;
    root.add(mesh); return root;
  }

  box(x, y, z, w, h, d, material, { solid = false, camera = true, aim = true, parent = this.scene } = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z); mesh.receiveShadow = true;
    parent.add(mesh); mesh.updateWorldMatrix(true, false);
    if (solid) this.colliders.push({ mesh, box: new THREE.Box3().setFromObject(mesh), enabled: true });
    if (camera) this.cameraBlockers.push(mesh);
    if (aim) this.aimBlockers.push(mesh);
    return mesh;
  }

  floor(minZ, maxZ) {
    this.floors.push({ minX: -12, maxX: 12, minZ, maxZ, y: 0 });
    this.box(0, -.25, (minZ + maxZ) / 2, 24, .5, maxZ - minZ, this.materials.floor, { aim: true });
    // Fine seams and edges are geometry, leaving imported modules at useful scale.
    for (let x = -12; x <= 12; x += 3) this.box(x, .008, (minZ + maxZ) / 2, .022, .014, maxZ - minZ, this.materials.trim, { camera: false, aim: false });
    for (let z = Math.ceil(minZ / 3) * 3; z <= maxZ; z += 3) this.box(0, .009, z, 24, .015, .022, this.materials.trim, { camera: false, aim: false });
  }

  label(text, x, y, z, size = 5, color = '#bdefff', rotateY = 0) {
    // Signage is communicated by geometry, indicator lights and optional bottom lessons.
    return new THREE.Group();
  }

  addProp(id, size, position, stage = 0, rotation = 0, options = {}) {
    const model = this.model(id, size, Boolean(options.height));
    model.position.fromArray(position); model.rotation.y = rotation; this.scene.add(model);
    this.sectorProps[stage].push(model);
    if (options.solid) {
      model.updateWorldMatrix(true, true);
      const b = new THREE.Box3().setFromObject(model); const s = b.getSize(new THREE.Vector3()); const p = b.getCenter(new THREE.Vector3());
      const proxy = this.box(p.x, p.y, p.z, s.x, s.y, s.z, this.materials.dark, { solid: true });
      proxy.visible = false;
    }
    return model;
  }

  collisionProxy(bounds, { kinematic = false, aim = true } = {}) {
    const size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
    const mesh = this.box(center.x, center.y, center.z, size.x, size.y, size.z, this.materials.dark, { solid: true, aim });
    mesh.visible = false; mesh.userData.collisionProxy = true;
    const collider = this.colliders.at(-1); collider.kinematic = kinematic;
    return collider;
  }

  syncCollision(collider, bounds, dt) {
    const oldSize = collider.box.getSize(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
    collider.mesh.position.copy(bounds.getCenter(new THREE.Vector3()));
    if (oldSize.distanceToSquared(size) > 1e-10) {
      // A moving AABB is a proxy, not a changing mesh topology. Reuse its GPU
      // geometry instead of allocating/discarding BoxGeometry at 120 Hz.
      if (!collider.geometrySize) {
        collider.mesh.geometry.computeBoundingBox();
        collider.geometrySize = collider.mesh.geometry.boundingBox.getSize(new THREE.Vector3());
      }
      collider.mesh.scale.set(size.x / collider.geometrySize.x, size.y / collider.geometrySize.y, size.z / collider.geometrySize.z);
    }
    collider.mesh.updateWorldMatrix(true, false); collider.box.copy(bounds);
    this.physics?.updateStaticBox(collider.mesh.uuid, bounds, dt, collider.enabled);
  }

  addPortalPanel(x, z, sign, stage, width = 6.8, height = 4.6) {
    const art = this.addProp(24, height, [x - sign * .05, 0, z], stage, sign * Math.PI / 2, { height: true });
    art.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(art), dimensions = bounds.getSize(new THREE.Vector3());
    art.scale.x *= width / dimensions.z; art.scale.z *= .10 / dimensions.x;
    art.updateWorldMatrix(true, true);
    const panel = this.box(x + sign * .025, height / 2, z, .08, height, width,
      this.materials.wall, { solid: true });
    panel.visible = false; panel.userData.collisionProxy = true;
    panel.userData.portalable = true; panel.userData.stage = stage;
    panel.userData.normal = new THREE.Vector3(sign, 0, 0);
    panel.userData.center = new THREE.Vector3(x + sign * .075, 1.68, z);
    // The geometric centre differs from the useful waist-height aiming mark.
    panel.userData.portalBounds = undefined;
    this.portalPanels.push(panel);
    this.box(x + sign * .02, .055, z, .15, .11, width + .12, this.materials.cyan, { camera: false, aim: false });
    this.label('БЕЛАЯ ПАНЕЛЬ • ПРОХОД', x + sign * .15, height + .35, z, width - .3, '#d8fbff', sign * Math.PI / 2);
    return panel;
  }

  markPortalSurface(mesh, center, normal, halfWidth, halfHeight) {
    Object.assign(mesh.userData, { portalable: true, center: center.clone(), normal: normal.clone(),
      portalUp: Math.abs(normal.y) > .9 ? new THREE.Vector3(0, 0, -1) : UP.clone(),
      portalBounds: { halfWidth, halfHeight } });
    this.portalPanels.push(mesh); return mesh;
  }


  buildLevel() {
    const previousRoots = new Set(this.scene.children);
    this.firstLevel = buildLabCampaignLevel(this, this.levelIndex);
    this.mechanisms = this.firstLevel;
    this.launchPad = this.firstLevel.launchPad;
    this.playerGroup = new THREE.Group();
    this.playerVisual = this.model(1, PLAYER_HEIGHT, true);
    this.playerGroup.add(this.playerVisual); this.scene.add(this.playerGroup);
    this.carrier = new THREE.Group(); this.scene.add(this.carrier);
    this.animator = new LabPlayerAnimator({ visual: this.playerVisual, carrier: this.carrier });
    this.weapon = this.model(11, .7);
    this.heldDevice = new LabHeldDevice({ model: this.weapon, bones: this.animator.bones, playerRoot: this.playerGroup });
    this.cameraRig = new LabCamera({ camera: this.camera, blockers: this.cameraBlockers,
      isBlocker: (object, hit) => this.isCameraBlocker(object, hit) });
    this.portals = new LabPortals({ scene: this.scene, renderer: this.renderer, camera: this.camera, maxResolution: this.quality.portalResolution, samples: 2 });
    const group = new THREE.Group(); group.name = 'Persistent brainrot companion';
    const visual = new THREE.Group(); const brainrot = this.model(2, .82);
    brainrot.name = 'Companion source mesh — no visible collider';
    brainrot.position.y = -CUBE_RADIUS; visual.add(brainrot); group.add(visual); this.scene.add(group);
    this.cargo = { group, visual, position: new THREE.Vector3(...CARGO_START), velocity: new THREE.Vector3(), quaternion: new THREE.Quaternion(), stage: 0 };
    this.cubes = [this.cargo];
    this.companionAnimator = new LabCompanionAnimator({ visual });
    this.companionRig = new LabCompanionRig(brainrot);
    this.physics = new LabPhysics({ fixedStep: FIXED_STEP });
    for (const collider of this.colliders) this.physics.addStaticBox(collider.mesh.uuid, collider.box, { kinematic: Boolean(collider.kinematic) });
    for (const ramp of this.ramps) this.physics.addStaticRamp(ramp.id, ramp);
    this.physics.createCargo({ position: this.cargo.position, size: CUBE_RADIUS * 2, mass: 3.2 });
    this.companionBehavior = new LabCompanionBehavior(this.physics);
    this.portalActors = new LabPortalActors({ scene: this.scene, portals: this.portals });
    this.portalActors.register(this.playerGroup, { radius: 1.5, centerOffset: [0, 1.2, 0] });
    this.portalActors.register(this.cargo.group, { radius: .75, centerOffset: [0, 0, 0] });
    this.portalShots = new LabPortalShots(this);
    this.createOverlay(); this.resetRun(false);
    this.levelRoots = this.scene.children.filter(root => !previousRoots.has(root));
  }

  async selectLevel(index, playing = true) {
    if (!Number.isInteger(index) || index < 0 || index >= CAMPAIGN.length) throw new RangeError('Unknown campaign level');
    this.portalShots?.cancelBuffered('level-change');
    this.audio?.flight?.(0,true);
    this.state = 'loading'; this.renderer?.setAnimationLoop(null); this.input?.keys.clear();
    this.audio?.motor?.(false);
    this.levelIndex = index;
    if (CAMPAIGN[index].assets.some(id => !this.assets.has(id))) await this.loadAssets();
    disposeLabLevel(this); this.buildLevel();
    this.portalActors.prepare();
    if (this.renderer?.compileAsync) await this.renderer.compileAsync(this.scene, this.camera);
    this.performanceMonitor.reset(); this.accumulator = 0; this.lastFrame = performance.now();
    this.state = playing ? 'playing' : 'ready'; this.emitHud();
    this.renderer?.setAnimationLoop(this.animate);
  }

  createOverlay() {
    if (this.reticle) return;
    this.reticle = document.createElement('div'); this.reticle.className = 'lab-reticle';
    this.reticle.innerHTML = '<i></i><i></i>'; document.body.appendChild(this.reticle);
    this.help = document.createElement('div'); this.help.className = 'lab-controls';
    this.help.innerHTML = '<span><b class="blue">ЛКМ</b> голубой</span><span><b class="amber">ПКМ</b> оранжевый</span><span><b>E</b> брейнрот</span>';
    document.body.appendChild(this.help);
    this.prompt = document.createElement('div'); this.prompt.className = 'lab-prompt'; document.body.appendChild(this.prompt);
    this.surfaceHint = document.createElement('div'); this.surfaceHint.className = 'lab-surface-hint'; document.body.appendChild(this.surfaceHint);
    const mobile = document.createElement('div'); mobile.className = 'lab-mobile';
    for (const [label, action] of [['①', () => this.firePortal(0)], ['②', () => this.firePortal(1)], ['E', () => this.interact()], ['Пауза', () => this.togglePause(true)]]) {
      const button = document.createElement('button'); button.textContent = label;
      button.addEventListener('pointerdown', e => { e.preventDefault(); action(); }); mobile.appendChild(button);
    }
    document.body.appendChild(mobile);
    this.fpsElement = document.createElement('output'); this.fpsElement.className = 'lab-fps'; this.fpsElement.setAttribute('aria-label', 'Частота кадров'); document.body.appendChild(this.fpsElement);
    this.tutorialElement = document.createElement('div'); this.tutorialElement.className = 'lab-tutorial'; this.tutorialElement.innerHTML = '<kbd></kbd><span></span>'; document.body.appendChild(this.tutorialElement);
  }

  setupControls() {
    const canvas = this.renderer.domElement;
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('pointerdown', e => {
      if (this.state !== 'playing' || e.pointerType === 'touch') return;
      if (document.pointerLockElement !== canvas) { canvas.requestPointerLock?.()?.catch?.(() => {}); return; }
      if (e.button === 0 || e.button === 2) this.firePortal(e.button === 0 ? 0 : 1);
    });
    addEventListener('mousemove', e => {
      if (document.pointerLockElement !== canvas || this.state !== 'playing') return;
      this.yaw -= e.movementX * .002; this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * .0018, CAMERA_PITCH_MIN, CAMERA_PITCH_MAX);
    });
    let lastTouch = null;
    canvas.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') lastTouch = { x: e.clientX, y: e.clientY, id: e.pointerId }; });
    canvas.addEventListener('pointermove', e => {
      if (!lastTouch || lastTouch.id !== e.pointerId || this.state !== 'playing') return;
      this.yaw -= (e.clientX - lastTouch.x) * .005;
      this.pitch = THREE.MathUtils.clamp(this.pitch - (e.clientY - lastTouch.y) * .004, CAMERA_PITCH_MIN, CAMERA_PITCH_MAX);
      lastTouch = { x: e.clientX, y: e.clientY, id: e.pointerId };
    });
    canvas.addEventListener('pointerup', () => { lastTouch = null; });
    addEventListener('keydown', e => {
      if (e.repeat || this.state !== 'playing') return;
      if (e.code === 'KeyE') this.interactQueued = true;
      if (e.code === 'KeyV') { this.animator?.trigger?.('celebrate'); this.companionAnimator?.trigger?.('celebrate'); }
    });
    addEventListener('blur', () => { this.input.keys.clear(); if (this.state === 'playing') this.togglePause(true); });
  }

  isActiveBlocker(object) {
    // Visibility is independent of collision: invisible proxies deliberately
    // protect authored meshes. Disabled fields, however, must stop blocking all
    // interaction, carry and camera rays as soon as their physical field opens.
    for (let node = object; node; node = node.parent) {
      const collider = this.colliders.find(candidate => candidate.mesh === node);
      if (collider) return collider.enabled !== false;
    }
    return true;
  }

  isCameraBlocker(object, hit) {
    if (!this.isActiveBlocker(object)) return false;
    if (!hit || !this.portals?.ready) return true;
    const collider = this.colliders.find(c => c.mesh === object);
    const box = collider?.box ?? new THREE.Box3().setFromObject(object);
    if (this.cameraRig?.clipsPortalBacking?.(box)) return false;
    // A camera is not a traveller: letting its boom pass through an entry
    // aperture before the player crosses puts it outside the room, looking at
    // the solid back of that same wall. Only a transported exit lens is exempt.
    const direction = this.cameraRig.raycaster.ray.direction;
    return !this.portals.portals.some(p => p && direction.dot(p.normal) >= -.00001
      && pointInsidePortal(p, hit.point, .04) && portalBacksCollider(p, box));
  }

  firePortal(index) {
    if(this.heldCube){this.callbacks.onToast('Сначала поставь друга [E]');return false;}
    return this.portalShots?.request(index)??false;
  }

  // Immediate geometric placement remains available to isolated geometry tests.
  // Mouse/touch input and complete playthroughs use firePortal and its flight.
  placePortal(index) {
    if (this.externalBlocked || this.state !== 'playing') return false;
    if (this.heldCube) { this.callbacks.onToast('Сначала поставь брейнрота [E], чтобы взять пушку'); return false; }
    // Shooting animates only the hand/device. Camera framing belongs to F.
    this.animator?.triggerShot?.(); this.heldDevice?.fire(index);
    this.scene.updateMatrixWorld(true);
    this.raycaster.setFromCamera(new THREE.Vector2(), this.camera);
    const hit = this.raycaster.intersectObjects(this.aimBlockers, true).find(h =>
      (h.object.visible || h.object.userData.collisionProxy) &&
      this.isActiveBlocker(h.object));
    if (!hit?.object.userData.portalable) {
      this.callbacks.onToast('Наведи прицел на белую фазовую панель'); return false;
    }
    const movingFrame = hit.object.userData.portalFrame?.();
    if (movingFrame && hit.face) {
      const geometricNormal = hit.face.normal.clone().applyMatrix3(
        new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();
      if (geometricNormal.dot(movingFrame.normal) <= .15
        || this.raycaster.ray.direction.dot(movingFrame.normal) >= -.02) {
        this.callbacks.onToast('Установи проход на лицевую поверхность панели'); return false;
      }
    }
    if (!this.placeOnPanel(index, hit.object, hit.point)) return false;
    if(this.audio.portal)this.audio.portal(index);else this.audio.tone(index ? 450 : 680, .13, 'sine', .04);
    return true;
  }

  clearPortals() {
    if (this.externalBlocked || this.state !== 'playing') return false;
    this.portals.clear(); this.portalSurfaceIds = [null, null];
    for (const id of this.portalCargoColliders) this.physics.setStaticEnabled(id,
      this.colliders.find(c => c.mesh.uuid === id)?.enabled !== false);
    this.portalCargoColliders.clear();
    this.callbacks.onToast('Пара сброшена. Один портал можно оставить под брейнротом, второй открыть позже.');
    return true;
  }

  isAiming() {
    return !this.heldCube && Boolean(this.aimHeld); // internal debug framing only; no player aim button
  }

  placeOnPanel(index, panel, hitPoint = panel.userData.center) {
    const normal = panel.userData.portalFrame?.()?.normal ?? panel.userData.normal;
    const preferredUp = normal && Math.abs(normal.y) > .6
      ? new THREE.Vector3(0, 0, -1).applyAxisAngle(UP, this.yaw) : undefined;
    const result = this.portals.placeOnPanel(index, panel, hitPoint, { blockers: this.colliders, preferredUp });
    if (!result.ok) {
      this.callbacks.onToast(result.reason === 'overlap' ? 'Раздвинь проходы немного дальше'
        : result.reason === 'obstructed' ? 'Перед проходом нужно свободное место'
          : 'Здесь проход не помещается. Выбери свободную белую панель');
      return false;
    }
    this.portalSurfaceIds[index] = panel.userData.portalColliderId ?? panel.uuid;
    this.callbacks.onToast(this.portals.ready ? 'Пара связана. Войди в любой проход' : 'Первый проход готов. Установи второй');
    return true;
  }

  updateAimHint() {
    // Only the cursor aims. No prospective ellipse, surface glow, or placement
    // prediction follows the mouse; an invalid shot explains itself on fire.
    this.reticle?.removeAttribute('data-surface');
    if (this.surfaceHint) this.surfaceHint.textContent = this.state === 'playing' && this.heldCube
      ? 'Обе руки заняты · E — поставить' : '';
  }

  start() { this.audio.unlock(); this.resetRun(true); this.renderer.domElement.requestPointerLock?.()?.catch?.(() => {}); }
  restart() { this.resetRun(true); this.callbacks.onPause(false); }
  resetRun(playing = true) {
    this.audio?.flight?.(0,true);
    for (const id of this.portalCargoColliders) this.physics.setStaticEnabled(id, true);
    this.portalCargoColliders.clear();
    this.state = playing ? 'playing' : 'ready'; this.stage = 0; this.elapsed = 0; this.teleportCount = 0;
    this.portalShots?.reset(); this.shotPoseTime=0; this.shotAimPoint=null;this.windStrength=0;this.lastCompanionState=null;
    this.heldCube = null; this.portalCooldown = 0; this.portals.clear(); this.portalSurfaceIds = [null, null];
    this.launchTime = 0; this.aimHeld = false; this.aimingTime = 0; this.completedStages = 0;
    this.socialClock = 0; this.jumpBuffer = this.coyoteTime = 0; this.jumpWindup = 0; this.carryMotionPhase = 0; this.interactQueued = false;
    const cargoStart = this.firstLevel?.cargoSpawn?.toArray?.() ?? this.firstLevel?.cargoSpawn ?? CARGO_START;
    this.physics.resetCargo({ position: new THREE.Vector3(...cargoStart) });
    this.cargo.position.fromArray(cargoStart); this.cargo.group.position.copy(this.cargo.position);
    this.cargo.group.quaternion.identity(); this.cargo.velocity.set(0, 0, 0);
    this.companionAnimator.reset();
    this.companionRig?.reset(); this.companionBehavior?.reset(); this.cargoPortalCooldown = 0;
    if (this.firstLevel) this.firstLevel.reset();
    else {
    this.mechanisms.bridges.forEach(b => { b.active = false; b.progress = b.previousProgress = 0; b.y = b.previousY = b.minY; });
    this.mechanisms.terminals.forEach(t => { t.activated = false; t.indicator.material.color.setHex(0xffbb63); });
    const lift = this.mechanisms.lift; lift.active = false; lift.dwell = 0; lift.y = lift.previousY = lift.minY;
    this.mechanisms.barrier.opened = false; this.mechanisms.barrier.progress = 0; this.mechanisms.barrier.contact = 0;
    this.doors.forEach(d => { d.opened = false; d.progress = d.previousProgress = d.contact = 0; });
    this.updateMechanisms(0); this.updateDoors(0);
    }
    this.respawn(false); this.emitHud();
  }

  respawn(announce = true) {
    // There are no checkpoints. An actual out-of-bounds failure restarts this
    // level with the same companion instance and all mechanisms reset together.
    if (announce && this.firstLevel) { this.resetRun(true); return; }
    if (this.heldCube) { this.physics.release(); this.heldCube = null; }
    const checkpoint = this.firstLevel?.spawn ?? CHAMBERS[this.stage].start;
    this.playerPosition.fromArray(checkpoint.toArray?.() ?? checkpoint); this.playerVelocity.set(0, 0, 0);
    this.previousPlayerPosition.copy(this.playerPosition);
    this.playerGrounded = true; this.yaw = 0; this.pitch = -.15; this.facing = this.previousFacing = Math.PI; this.launchTime = 0;
    this.portalVisualOffset.set(0, 0, 0); this.portalVisualRotation.identity();
    this.playerGroup.position.copy(this.playerPosition); this.playerGroup.rotation.y = this.facing;
    this.aimingTime = 0; this.aimHeld = false; this.motion = null;
    this.animator.reset(); this.heldDevice.reset(); this.cameraRig.reset(this.playerPosition, this.yaw, this.pitch);
    this.input?.keys.clear(); this.accumulator = 0;

  }

  togglePause(force) {
    if (this.externalBlocked || !['playing', 'paused'].includes(this.state)) return;
    const paused = force ?? this.state === 'playing';
    // Repeated blur/pointer-lock notifications must not rebuild an open hint menu.
    if ((this.state === 'paused') === paused) { if (paused) document.exitPointerLock?.(); return; }
    this.state = paused ? 'paused' : 'playing';
    if (paused) this.portalShots?.cancelBuffered('paused');
    if (paused) this.audio?.flight?.(0,true);
    this.input.keys.clear(); this.lastFrame = performance.now(); this.accumulator = 0;
    if (paused) document.exitPointerLock?.(); else this.renderer.domElement.requestPointerLock?.()?.catch?.(() => {});
    this.callbacks.onPause(paused);
  }

  animate(now) {
    const frameMs = Math.max(0, now - this.lastFrame);
    const dt = Math.min(.1, frameMs / 1000); this.lastFrame = now;
    if (this.state === 'playing') this.performanceMonitor.sample(frameMs, now, this.renderer?.info?.render);
    if (!this.externalBlocked && this.input.consumePause()) this.togglePause();
    if (!this.externalBlocked && this.state === 'playing' && this.input.consumeRestart()) {
      if(this.callbacks.onRestartRequest)this.callbacks.onRestartRequest();else this.restart();
    }
    if (this.state === 'playing' && !this.externalBlocked) {
      this.accumulator += dt;
      while (this.accumulator + 1e-10 >= FIXED_STEP) {
        this.updatePlaying(FIXED_STEP); this.accumulator = Math.max(0, this.accumulator - FIXED_STEP);
      }
    }
    this.updateVisuals(this.state === 'paused' || this.externalBlocked ? 0 : dt, this.accumulator / FIXED_STEP);
    this.render(); this.renderFrames++;
    if (this.fpsElement && now - (this.lastUiUpdate ?? 0) > 180) {
      this.lastUiUpdate = now; const stats = this.performanceMonitor.stats;
      this.fpsElement.textContent = stats.fps ? `${Math.round(stats.fps)} FPS · ${stats.frameMs.toFixed(1)} мс` : 'FPS …';
      this.fpsElement.title = `1% low: ${stats.low1Fps.toFixed(0)} FPS; p99: ${stats.p99Ms.toFixed(1)} ms; ${stats.calls} draws; ${stats.triangles} triangles`;
      const lesson = this.tutorial.update();
      this.tutorialElement.hidden = !lesson;
      if (lesson) { this.tutorialElement.querySelector('kbd').textContent = lesson.key; this.tutorialElement.querySelector('span').textContent = lesson.text; }
    }
  }

  updatePlaying(dt) {
    // Restore physical support poses before snapshotting newly placed portals.
    // Render interpolation must never become the previous physics plane.
    this.firstLevel?.renderUpdate?.(1);
    this.portals.beginPhysicsStep?.();
    this.previousPlayerPosition.copy(this.playerPosition); this.previousFacing = this.facing;
    this.elapsed += dt * 1000; this.portalCooldown = Math.max(0, this.portalCooldown - dt);
    this.aimingTime = Math.max(0, (this.aimingTime ?? 0) - dt);
    const playerLaunch = this.firstLevel ? this.firstLevel.getLaunch(this.playerPosition)
      : this.stage === 2 && Math.hypot(this.playerPosition.x, this.playerPosition.z + 31.5) < 1.05
        ? { velocity: new THREE.Vector3(0, 10, -10), duration: 1.15 } : null;
    if (playerLaunch && this.playerGrounded && this.launchTime <= 0) {
      this.launchVector = playerLaunch.velocity.clone(); this.playerVelocity.copy(this.launchVector); this.launchTime = playerLaunch.duration;
      this.playerGrounded = false; this.animator.trigger?.('jump'); this.audio.jump();
    }
    this.launchTime = Math.max(0, this.launchTime - dt);
    if (this.interactQueued) { this.interactQueued = false; this.interact(); }
    this.shotPoseTime=Math.max(0,(this.shotPoseTime||0)-dt);
    this.updateMechanisms(dt); this.portalShots?.step(dt); this.updatePlayer(dt); this.updateCubes(dt); this.updateDoors(dt);
    this.portals.endPhysicsStep?.();
    const nextStage = this.firstLevel ? 0 : this.playerPosition.z < -27 ? 2 : this.playerPosition.z < -4 ? 1 : 0;
    if (nextStage !== this.stage) {
      this.stage = nextStage; this.emitHud();
      // Crossing a doorway never mutates, reassigns or hides the companion.
    }
    if (this.firstLevel ? this.firstLevel.isWon() : this.playerPosition.z < -48 && this.cargo.position.z < -47.1 && this.playerPosition.distanceTo(this.cargo.position) < 4) this.win();
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) { this.emitHud(); this.hudTimer = .12; }
  }

  updatePlayer(dt) {
    const previous = this.playerPosition.clone();
    const wasGrounded = this.playerGrounded;
    const move = this.input.getMove();
    const aiming = this.isAiming();
    const sprint = (this.input.keys.has('ShiftLeft') || this.input.keys.has('ShiftRight')) && !aiming;
    const speed = this.heldCube ? (sprint ? 4.5 : 2.9) : aiming ? 2.55 : sprint ? 5.0 : 3.3;
    const desired = new THREE.Vector3(move.x, 0, move.y).applyAxisAngle(UP, this.yaw).multiplyScalar(speed);
    const acceleration = this.playerGrounded ? (move.lengthSq() ? 10.5 : 15) : 3;
    if (this.playerGrounded || !this.firstLevel?.momentum) {
      this.playerVelocity.x = THREE.MathUtils.damp(this.playerVelocity.x, desired.x, acceleration, dt);
      this.playerVelocity.z = THREE.MathUtils.damp(this.playerVelocity.z, desired.z, acceleration, dt);
    } else {
      // Air control is an acceleration, not a velocity reset. A portal fling
      // retains its energy when no movement key is pressed.
      const steer = desired.clone().multiplyScalar(1 / Math.max(speed, .001));
      this.playerVelocity.addScaledVector(steer, dt * 2.8);
    }
    if (this.launchTime > 0) {
      this.playerVelocity.x = this.launchVector?.x ?? 0;
      this.playerVelocity.z = this.launchVector?.z ?? -10;
    }
    this.coyoteTime = this.playerGrounded ? .1 : Math.max(0, this.coyoteTime - dt);
    this.jumpBuffer = this.input.consumeJump() ? .12 : Math.max(0, this.jumpBuffer - dt);
    if (this.jumpBuffer > 0 && this.coyoteTime > 0 && !(this.jumpWindup > 0)) {
      this.jumpWindup = this.playerGrounded ? .05 : dt;
      this.coyoteTime = this.jumpBuffer = 0; this.animator.triggerJump?.();
    }
    if (this.jumpWindup > 0) {
      this.jumpWindup = Math.max(0, this.jumpWindup - dt);
      if (this.jumpWindup < 1e-8) {
        this.jumpWindup = 0; this.playerVelocity.y = 7.8; this.playerGrounded = false;
        this.audio.jump();
      }
    }
    const field=this.firstLevel?.playerAcceleration?.(this.playerPosition,this.playerVelocity);
    this.windStrength=field?Math.min(1,field.length()/55):0;
    if(field){this.playerVelocity.addScaledVector(field,dt);if(field.y>19.5)this.playerGrounded=false;}
    this.playerVelocity.y -= 19.5 * dt;
    this.playerPosition.addScaledVector(this.playerVelocity, dt);
    this.constrainPortalThroat(this.playerPosition, previous, this.playerVelocity);
    const center = this.playerPosition.clone().addScaledVector(UP, CENTER_HEIGHT);
    const previousCenter = previous.clone().addScaledVector(UP, CENTER_HEIGHT);
    const teleport = this.portals.tryTeleport(center, previousCenter, this.playerVelocity, PLAYER_RADIUS);
    this.groundedByCollider = false;
    const downwardImpact = Math.max(0, -this.playerVelocity.y);
    if (teleport) {
      const entry = this.portals.portals[teleport.entryIndex], exit = this.portals.portals[teleport.exitIndex];
      const transportedVisual = transformPortalPoint(this.playerGroup.position, entry, exit);
      const transportedQ = this.playerGroup.quaternion.clone().premultiply(teleport.rotation);
      const oldYaw = this.yaw, oldPitch = this.pitch;
      const capsuleExtent = PLAYER_RADIUS + (CENTER_HEIGHT - PLAYER_RADIUS) * Math.abs(exit.normal.y);
      const clearance = capsuleExtent + .025 - teleport.position.clone().sub(exit.position).dot(exit.normal);
      if (clearance > 0) teleport.position.addScaledVector(exit.normal, clearance);
      if (this.heldCube) {
        const exitShift = teleport.position.clone().sub(transformPortalPoint(center, entry, exit));
        const cargoPosition = transformPortalPoint(this.cargo.position, entry, exit).add(exitShift);
        const cargoClearance = CUBE_RADIUS * Math.sqrt(3) + .06 - cargoPosition.clone().sub(exit.position).dot(exit.normal);
        if (cargoClearance > 0) {
          cargoPosition.addScaledVector(exit.normal, cargoClearance);
          teleport.position.addScaledVector(exit.normal, cargoClearance);
        }
        this.physics.teleportCargo({ position: cargoPosition, rotation: teleport.rotation });
        this.cargo.position.copy(cargoPosition);
        this.companionBehavior?.reanchor(cargoPosition); this.cargoPortalCooldown = .07;
        this.companionAnimator.trigger('portal');
      }
      this.playerPosition.copy(teleport.position).addScaledVector(UP, -CENTER_HEIGHT);
      this.playerVelocity.copy(teleport.velocity);
      // A launcher impulse belongs to the traveller frame too. Keeping the old
      // world-space impulse forced the next tick backwards into the exit wall.
      if (this.launchTime > 0 && this.launchVector) this.launchVector.applyQuaternion(teleport.rotation);
      const view = new THREE.Vector3(0, 0, -1).applyAxisAngle(UP, oldYaw).applyQuaternion(teleport.rotation);
      if (Math.hypot(view.x, view.z) > .001) this.yaw = Math.atan2(-view.x, -view.z);
      const facing = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing)).applyQuaternion(teleport.rotation);
      if (Math.hypot(facing.x, facing.z) > .001) this.facing = Math.atan2(facing.x, facing.z);
      this.portalCooldown = .07; this.teleportCount++;
      this.lastPortalTravel = { entry: teleport.entryIndex, exit: teleport.exitIndex, speed: teleport.velocity.length() };
      this.firstLevel?.onTeleport?.(teleport);
      this.previousPlayerPosition.copy(this.playerPosition); this.previousFacing = this.facing;
      previous.copy(this.playerPosition);
      this.animator.groundContact?.reset();
      if (this.cameraRig.applyPortalTransform) {
        const controls = this.cameraRig.applyPortalTransform(entry, exit, { target: this.playerPosition, yaw: oldYaw, pitch: oldPitch });
        this.yaw = controls.yaw; this.pitch = controls.pitch;
      } else this.cameraRig.reset(this.playerPosition, this.yaw, this.pitch);
      this.portalVisualOffset.copy(transportedVisual).sub(this.playerPosition);
      const upright = new THREE.Quaternion().setFromAxisAngle(UP, this.facing);
      this.portalVisualRotation.copy(transportedQ).multiply(upright.invert());
      if(this.audio.travel)this.audio.travel(teleport.velocity.length());else this.audio.tone(620, .12, 'triangle', .035);
    } else this.resolveBody(this.playerPosition, previous, this.playerVelocity, PLAYER_RADIUS, PLAYER_HEIGHT, true);
    this.playerGrounded = Boolean(this.groundedByCollider);
    if (this.playerGrounded && !wasGrounded && downwardImpact > 1) {
      this.animator.triggerLanding(downwardImpact); this.audio.land?.(downwardImpact); this.lastLanding = downwardImpact;
    }
    const floor = this.floorHeight(this.playerPosition.x, this.playerPosition.z, Math.max(previous.y, this.playerPosition.y) + .38, true);
    if (floor !== null && previous.y >= floor - .38 && this.playerPosition.y <= floor + .008 && this.playerVelocity.y <= 0) {
      const impact = -this.playerVelocity.y;
      this.playerPosition.y = floor; this.playerVelocity.y = 0; this.playerGrounded = true;
      if (!wasGrounded && impact > 1) { this.animator.triggerLanding(impact); this.audio.land?.(impact); this.lastLanding = impact; }
    }
    if (this.playerPosition.y < -12) { this.respawn(); return; }
    const planar = Math.hypot(this.playerVelocity.x, this.playerVelocity.z);
    const priorFacing = this.facing;
    if ((this.shotPoseTime>0&&!this.heldCube) || aiming || planar > .12) {
      const target = this.shotPoseTime>0&&!this.heldCube ? this.shotFacing : aiming ? this.yaw + Math.PI : Math.atan2(this.playerVelocity.x, this.playerVelocity.z);
      const turn = Math.atan2(Math.sin(target - this.facing), Math.cos(target - this.facing)) * (1 - Math.exp(-12 * dt));
      this.facing += this.heldCube ? THREE.MathUtils.clamp(turn, -8 * dt, 8 * dt) : turn;
    }
    const directionScale = planar > .01 ? 1 / planar : 0;
    this.motion = {
      speed: planar, turnRate: Math.atan2(Math.sin(this.facing - priorFacing), Math.cos(this.facing - priorFacing)) / Math.max(dt, .001),
      moveForward: (this.playerVelocity.x * Math.sin(this.facing) + this.playerVelocity.z * Math.cos(this.facing)) * directionScale,
      moveRight: (this.playerVelocity.x * Math.cos(this.facing) - this.playerVelocity.z * Math.sin(this.facing)) * directionScale,
    };
  }

  floorHeight(x, z, maxY = Infinity, throughPortals = false) {
    let height = null;
    for (const f of this.floors) {
      const y = f.heightAt ? f.heightAt(x,z) : (f.y ?? 0);
      if(y===null)continue;
      if (throughPortals && f.mesh && this.portalOpensCollider({ mesh: f.mesh,
        box: this.colliders.find(c => c.mesh === f.mesh)?.box }, new THREE.Vector3(x, y + CENTER_HEIGHT, z), PLAYER_RADIUS)) continue;
      if (f.enabled !== false && y <= maxY + .001 && x >= f.minX && x <= f.maxX && z >= f.minZ && z <= f.maxZ) height = height === null ? y : Math.max(height, y);
    }
    for (const ramp of this.ramps) {
      if (x < ramp.minX || x > ramp.maxX || z < ramp.minZ || z > ramp.maxZ) continue;
      const y = sampleRampSurface(ramp, z).height;
      if (y <= maxY + .001) height = height === null ? y : Math.max(height, y);
    }
    return height;
  }

  // Once the feet enter a floor aperture its rim is a real lateral contact.
  // Previously the capsule could run out of the ellipse while its centre was
  // still above the transfer plane, then fall behind the intact floor without
  // ever crossing either portal. Sweep to the rim and remove only the outward
  // contact velocity; gravity and the ordinary centre-plane transfer continue.
  constrainPortalThroat(position, previous, velocity) {
    if (!this.portals.ready) return;
    for (const portal of this.portals.portals) {
      if (portal.normal.y < .65) continue;
      const inverse = portal.quaternion.clone().invert();
      const before = previous.clone().addScaledVector(UP, CENTER_HEIGHT).sub(portal.position).applyQuaternion(inverse);
      const extent = PLAYER_RADIUS + (CENTER_HEIGHT - PLAYER_RADIUS) * portal.normal.y;
      if (before.z <= 0 || before.z >= extent - .008) continue;
      const width = portal.width - PLAYER_RADIUS, height = portal.height - PLAYER_RADIUS;
      const inside = p => (p.x / width) ** 2 + (p.y / height) ** 2;
      if (inside(before) > 1 + 1e-8) continue;
      const after = position.clone().addScaledVector(UP, CENTER_HEIGHT).sub(portal.position).applyQuaternion(inverse);
      if (inside(after) <= 1) continue;
      let low = 0, high = 1;
      const contact = before.clone();
      for (let n = 0; n < 24; n++) {
        const middle = (low + high) / 2;
        contact.copy(before).lerp(after, middle);
        if (inside(contact) <= 1) low = middle; else high = middle;
      }
      contact.copy(before).lerp(after, Math.max(0, low - 1e-6));
      const correction = new THREE.Vector3(contact.x - after.x, contact.y - after.y, 0).applyQuaternion(portal.quaternion);
      position.add(correction);
      const normal = new THREE.Vector3(contact.x / (width * width), contact.y / (height * height), 0)
        .normalize().applyQuaternion(portal.quaternion);
      const outward = velocity.dot(normal);
      if (outward > 0) velocity.addScaledVector(normal, -outward);
    }
  }

  sampleFootSupport(x, z, maxY) {
    let height = this.floorHeight(x, z, maxY), normal = UP.clone();
    for (const c of this.colliders) if (!c.walkablePlane && c.enabled !== false && c.box.max.y <= maxY
      && x >= c.box.min.x && x <= c.box.max.x && z >= c.box.min.z && z <= c.box.max.z
      && (height === null || c.box.max.y > height)) height = c.box.max.y;
    for (const ramp of this.ramps) {
      if (height === null || x < ramp.minX || x > ramp.maxX || z < ramp.minZ || z > ramp.maxZ) continue;
      const surface = sampleRampSurface(ramp, z);
      if (Math.abs(surface.height - height) < .015) normal.copy(surface.normal);
    }
    for(const f of this.floors)if(f.heightAt&&Math.abs((f.heightAt(x,z)??-1e9)-height)<.015&&f.normalAt)normal.copy(f.normalAt());
    return height === null ? null : { height, normal };
  }

  portalOpensCollider(collider, center, radius) {
    if (!this.portals.ready) return false;
    return this.portals.portals.some((portal, index) => {
      if (!portal || !this.portals.isInsideAperture(index, center, radius)) return false;
      const planeDistance = Math.abs(center.clone().sub(portal.position).dot(portal.normal));
      if (planeDistance > radius + .7 + Math.abs(portal.normal.y) * CENTER_HEIGHT) return false;
      // The aperture opens both its thin white panel and the structural wall behind it.
      return collider.mesh.uuid === this.portalSurfaceIds[index]
        || (collider.portalOwner && collider.portalOwner.userData.portalColliderId === this.portalSurfaceIds[index])
        || portalBacksCollider(portal, collider.box);
    });
  }

  resolveBody(position, previous, velocity, radius, height, allowPortals = false) {
    for (let iteration = 0; iteration < 3; iteration++) for (const collider of this.colliders) {
      if (!collider.enabled || (collider.walkablePlane && !collider.solidUnderside)) continue;
      // A walkable moving top is not an empty volume from below. Its floor
      // solver owns feet on the plane; the real deck and beams block a body
      // approaching the underside. Only explicitly authored tops use this.
      if (collider.solidUnderside && collider.frontPlane) {
        const top = collider.frontPlane();
        if (position.clone().sub(top.center).dot(top.normal) >= -.035) continue;
      }
      // A tilted plate's world AABB includes empty air in front of its real
      // surface. Reject that broad-phase false positive before resolution.
      if (collider.frontPlane) {
        const f=collider.frontPlane(),centre=position.clone().addScaledVector(UP,height/2);
        const extent=radius+(height/2-radius)*Math.abs(f.normal.y);
        if(centre.sub(f.center).dot(f.normal)>extent+.05)continue;
      }
      const b = collider.box;
      // The combined traveller needs elbow/box clearance beside tall walls.
      // Floor edges, small steps and portal apertures keep the actual capsule
      // footprint; expanding those would prevent leaving a narrow platform.
      const contactRadius = allowPortals && this.heldCube && b.min.y < position.y + .5
        && b.max.y > position.y + height ? Math.max(radius,.62) : radius;
      if (position.y + height <= b.min.y + .001 || position.y >= b.max.y - .001) continue;
      const nearestX = THREE.MathUtils.clamp(position.x, b.min.x, b.max.x);
      const nearestZ = THREE.MathUtils.clamp(position.z, b.min.z, b.max.z);
      const dx = position.x - nearestX, dz = position.z - nearestZ;
      if (dx * dx + dz * dz >= contactRadius * contactRadius) continue;
      const center = position.clone().addScaledVector(UP, height / 2);
      if (allowPortals && this.portalOpensCollider(collider, center, Math.min(radius, PLAYER_RADIUS))) continue;
      if (velocity.y <= 0 && previous.y >= b.max.y - .035) {
        position.y = b.max.y; velocity.y = 0; this.groundedByCollider = true; continue;
      }
      if (this.playerGrounded && velocity.y <= 0 && b.max.y - previous.y <= .37 && b.max.y - previous.y > 0) {
        position.y = b.max.y; velocity.y = 0; this.groundedByCollider = true; continue;
      }
      if (velocity.y > 0 && previous.y + height <= b.min.y + .02) {
        position.y = b.min.y - height; velocity.y = 0; continue;
      }
      const length = Math.hypot(dx, dz);
      if (length > .00001) {
        const nx = dx / length, nz = dz / length;
        position.x += nx * (contactRadius - length + .0001); position.z += nz * (contactRadius - length + .0001);
        const inward = velocity.x * nx + velocity.z * nz;
        if (inward < 0) { velocity.x -= nx * inward; velocity.z -= nz * inward; }
      } else {
        const options = [[Math.abs(position.x - b.min.x + contactRadius), 'x', b.min.x - contactRadius], [Math.abs(b.max.x + contactRadius - position.x), 'x', b.max.x + contactRadius],
          [Math.abs(position.z - b.min.z + contactRadius), 'z', b.min.z - contactRadius], [Math.abs(b.max.z + contactRadius - position.z), 'z', b.max.z + contactRadius]].sort((a, b) => a[0] - b[0]);
        position[options[0][1]] = options[0][2]; velocity[options[0][1]] = 0;
      }
    }
  }

  nearbyTerminal() {
    if (this.firstLevel) return null;
    return this.mechanisms.terminals.find(t => !t.activated && Math.hypot(t.position.x - this.playerPosition.x, t.position.z - this.playerPosition.z) < 2.4);
  }

  interact() {
    if (this.externalBlocked || this.state !== 'playing') return false;
    // E puts down a held friend. Nearby controls must not steal pickup input.
    if (this.heldCube) return this.toggleCube();
    const hand = this.playerPosition.clone().addScaledVector(UP, 1.1);
    const controlDistance = Math.min(Infinity, ...(this.firstLevel?.terminals ?? []).map(t => hand.distanceTo(t.position)));
    if (this.cargo && hand.distanceTo(this.cargo.position) < Math.min(2.25, controlDistance)
      && this.toggleCube()) return true;
    if (this.firstLevel?.interact()) return true;
    const terminal = this.nearbyTerminal();
    if (terminal) {
      terminal.activated = true; this.mechanisms.bridges[terminal.bridgeIndex].active = true;
      terminal.indicator.material.color.setHex(0x81ebba);
      this.animator.trigger?.('curious'); this.audio.checkpoint(); this.callbacks.onToast('Мост включён'); return true;
    }
    return this.toggleCube();
  }

  toggleCube() {
    if (this.externalBlocked || this.state !== 'playing') return false;
    if (this.heldCube) {
      this.physics.release(); this.heldCube = null;
      this.animator.triggerInteraction('place'); this.companionAnimator.trigger('release');
      return true;
    }
    const origin = this.playerPosition.clone().addScaledVector(UP, 1.1);
    const delta = this.cargo.position.clone().sub(origin); const distance = delta.length();
    if (distance > 2.25) return false;
    this.scene.updateMatrixWorld(true);
    this.raycaster.set(origin, delta.clone().normalize()); this.raycaster.far = Math.max(0, distance - .1);
    const blocked = this.raycaster.intersectObjects(this.cameraBlockers, true)
      .some(hit => hit.distance < distance - .1 && this.isActiveBlocker(hit.object));
    this.raycaster.far = Infinity;
    if (blocked) { this.callbacks.onToast('Между вами препятствие'); return false; }
    this.heldCube = this.cargo; this.aimingTime = 0; this.aimHeld = false;
    this.portalShots?.cancelBuffered('hands-full');
    this.animator.triggerInteraction('pickup'); this.companionAnimator.trigger('pickup'); this.audio.pickup();
    return true;
  }

  updateCubes(dt) {
    if (this.cargoLaunchFrictionSuppress) { this.physics.cargoBody.material.friction = 1; this.cargoLaunchFrictionSuppress = false; }
    this.cargoPortalCooldown = Math.max(0, (this.cargoPortalCooldown ?? 0) - dt);
    const beforeStep = this.cargo.position.clone();
    if (this.heldCube) {
      const forward = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
      const walking = Math.min(1, Math.hypot(this.playerVelocity.x, this.playerVelocity.z) / 2.7);
      this.carryMotionPhase = (this.carryMotionPhase ?? 0) + dt * (3 + walking * 12);
      const bob = this.playerGrounded ? Math.sin(this.carryMotionPhase * 2) * walking * .017 : 0;
      const origin = this.playerPosition.clone().addScaledVector(UP, 1.06 + bob);
      const side = new THREE.Vector3(forward.z, 0, -forward.x);
      const target = origin.clone().addScaledVector(forward, .72)
        .addScaledVector(side, Math.sin(this.carryMotionPhase) * walking * .012);
      const quaternion = new THREE.Quaternion().setFromAxisAngle(UP, this.facing);
      // Constrain the complete held box, including its corners during turns,
      // not just a single centre ray. The target may slide/retract, never ask
      // the body to accelerate through the wall at the player's shoulder.
      const e = CUBE_RADIUS * (Math.abs(Math.sin(this.facing)) + Math.abs(Math.cos(this.facing))) + .035;
      const extent = new THREE.Vector3(e, CUBE_RADIUS + .035, e);
      const expanded=new THREE.Box3();
      for (let pass = 0; pass < 3; pass++) for (const c of this.colliders) {
        if (c.enabled === false || c.walkablePlane || this.portalOpensCollider(c, origin, CUBE_RADIUS)) continue;
        if (c.frontPlane) {
          const f=c.frontPlane();if(target.clone().sub(f.center).dot(f.normal)>CUBE_RADIUS*Math.sqrt(3)+.05)continue;
        }
        const nearMin=this.cargo.position;
        if(Math.min(origin.x,target.x,nearMin.x)>c.box.max.x+e||Math.max(origin.x,target.x,nearMin.x)<c.box.min.x-e||Math.min(origin.z,target.z,nearMin.z)>c.box.max.z+e||Math.max(origin.z,target.z,nearMin.z)<c.box.min.z-e||Math.min(origin.y,target.y,nearMin.y)>c.box.max.y+extent.y||Math.max(origin.y,target.y,nearMin.y)<c.box.min.y-extent.y)continue;
        const b=expanded.copy(c.box).expandByVector(extent);
        const start=b.containsPoint(origin)?this.cargo.position:origin;
        const hit=sweepBox(start,target,b.min,b.max);
        if(hit){target[hit.axis]=start[hit.axis]+(target[hit.axis]-start[hit.axis])*hit.t+hit.sign*.002;}
        else if(b.containsPoint(target)){
          // The player can stand closer to a wall than a rotated box. Pick the
          // face facing that player, not the opposite side of the wall.
          const faces=[];
          for(const key of ['x','y','z']){
            if(origin[key]<=c.box.min[key])faces.push({key,v:b.min[key]-.002,d:Math.abs(origin[key]-b.min[key])});
            if(origin[key]>=c.box.max[key])faces.push({key,v:b.max[key]+.002,d:Math.abs(origin[key]-b.max[key])});
          }
          faces.sort((a,b)=>a.d-b.d);if(faces[0])target[faces[0].key]=faces[0].v;
        }
      }
      this.physics.setCarryTarget(target, { velocity: this.playerVelocity, quaternion, dt });
      // Only E releases the friend. Contacts do not silently drop the grip.
    }
    // A free companion passes through the same apertures. Collision is opened
    // only while this body's centre fits inside the actual portal footprint.
    const nextPortalColliders = new Set();
    for (const collider of this.colliders) if(collider.enabled && collider.frontPlane) {
      const f=collider.frontPlane(),localNormal=f.normal.clone().applyQuaternion(this.cargo.quaternion.clone().invert());
      const extent=CUBE_RADIUS*(Math.abs(localNormal.x)+Math.abs(localNormal.y)+Math.abs(localNormal.z));
      if(this.cargo.position.clone().sub(f.center).dot(f.normal)>extent+.05) {
        nextPortalColliders.add(collider.mesh.uuid);this.physics.setStaticEnabled(collider.mesh.uuid,false);
      }
    }
    if (this.portals.ready) {
      for (const collider of this.colliders) if (collider.enabled &&
        (this.portalOpensCollider(collider, this.cargo.position, CUBE_RADIUS) ||
          (this.heldCube && this.portalOpensCollider(collider, this.playerPosition.clone().addScaledVector(UP, 1.2), PLAYER_RADIUS)))) {
        nextPortalColliders.add(collider.mesh.uuid);
        this.physics.setStaticEnabled(collider.mesh.uuid, false);
      }
    }
    for (const id of this.portalCargoColliders) if (!nextPortalColliders.has(id)) {
      this.physics.setStaticEnabled(id, this.colliders.find(c => c.mesh.uuid === id)?.enabled !== false);
    }
    this.portalCargoColliders = nextPortalColliders;
    this.companionBehavior?.update(dt, { held: Boolean(this.heldCube),
      onPad: this.firstLevel ? this.firstLevel.cargoOnAnyPad() : this.cargoOnPad(this.mechanisms.chargePad.position) || CHAMBERS.some(c => this.cargoOnPad(c.button)),
      canMove: (p, nx, nz) => this.companionCanStep(p, nx, nz) });
    const cargoLaunch = this.firstLevel ? this.firstLevel.getLaunch(this.cargo.position)
      : Math.hypot(this.cargo.position.x, this.cargo.position.z + 31.5) < 1.05
        ? { velocity: new THREE.Vector3(0, 10, -10), duration: 1.15 } : null;
    if (!this.heldCube && this.physics.grounded && (this.cargoLaunchCooldown ?? 0) <= 0 && cargoLaunch) {
      this.physics.cargoBody.velocity.copy(cargoLaunch.velocity); this.physics.cargoBody.wakeUp();
      this.physics.cargoBody.material.friction = 0; this.cargoLaunchFrictionSuppress = true;
      this.cargoLaunchCooldown = cargoLaunch.duration + .1; this.companionAnimator.trigger('startle');
    }
    this.cargoLaunchCooldown = Math.max(0, (this.cargoLaunchCooldown ?? 0) - dt);
    this.firstLevel?.applyCargoForces?.(dt);
    this.physics.setPlayerProxy({ position: this.playerPosition, radius: PLAYER_RADIUS, height: PLAYER_HEIGHT, velocity: this.playerVelocity }, dt);
    this.physics.step(dt);
    let sample = this.physics.sample(1);
    if (!this.heldCube) {
      const travel = this.portals.tryTeleport(new THREE.Vector3().copy(sample.position), beforeStep,
        new THREE.Vector3().copy(sample.velocity), CUBE_RADIUS);
      if (travel) {
        const exit = this.portals.portals[travel.exitIndex];
        const q = new THREE.Quaternion().copy(sample.quaternion).premultiply(travel.rotation);
        const n = exit.normal.clone().applyQuaternion(q.clone().invert());
        const extent = CUBE_RADIUS * (Math.abs(n.x) + Math.abs(n.y) + Math.abs(n.z));
        const clear = extent + .07 - travel.position.clone().sub(exit.position).dot(exit.normal);
        if (clear > 0) travel.position.addScaledVector(exit.normal, clear);
        this.physics.teleportCargo({ position: travel.position, rotation: travel.rotation });
        this.companionBehavior?.reanchor(travel.position); this.companionAnimator.trigger('portal');
        this.cargoPortalCooldown = .07; sample = this.physics.sample(1);
      }
    }
    this.cargo.position.copy(sample.position); this.cargo.velocity.copy(sample.velocity); this.cargo.quaternion.copy(sample.quaternion);
    if (this.firstLevel && this.cargo.position.y < -12) this.resetRun(true);
  }

  companionCanStep(position, nx, nz) {
    const x = position.x + nx * .62, z = position.z + nz * .62;
    const support = this.sampleFootSupport(x, z, position.y + .12);
    if (!support || Math.abs(support.height - (position.y - CUBE_RADIUS)) > .22) return false;
    const test = new THREE.Box3(new THREE.Vector3(x - .34, position.y - .24, z - .34),
      new THREE.Vector3(x + .34, position.y + .35, z + .34));
    return !this.colliders.some(c => c.enabled !== false && c.box.intersectsBox(test));
  }

  cargoOnPad(position, radius = .86) {
    if(position?.center&&position?.right)return cargoLoadsPlate(this.cargo,this.heldCube,position,CUBE_RADIUS);
    const p = Array.isArray(position) ? new THREE.Vector3(...position) : position;
    return !this.heldCube && Math.hypot(this.cargo.position.x - p.x, this.cargo.position.z - p.z) < radius
      && this.cargo.position.y > p.y + .18 && this.cargo.position.y < p.y + .75 && this.cargo.velocity.length() < 1.0;
  }

  moveMechanism(m, y, dt) {
    m.previousY = m.y ?? y; m.y = y; m.group.position.y = y; m.floor.y = y;
    m.group.updateWorldMatrix(true, true); m.collider.box.setFromObject(m.mesh);
    this.physics?.updateStaticBox(m.mesh.uuid, m.collider.box, dt);
    const f = m.floor, p = this.playerPosition;
    if (dt > 0 && this.playerGrounded && p.x > f.minX - .1 && p.x < f.maxX + .1 && p.z > f.minZ - .1 && p.z < f.maxZ + .1 && Math.abs(p.y - m.previousY) < .12) {
      p.y += y - m.previousY; this.previousPlayerPosition.y += y - m.previousY;
    }
  }

  updateMechanisms(dt) {
    if (this.firstLevel) { this.firstLevel.update(dt); return; }
    for (const bridge of this.mechanisms.bridges) {
      const y = THREE.MathUtils.damp(bridge.y ?? bridge.minY, bridge.active ? bridge.maxY : bridge.minY, 1.7, dt);
      this.moveMechanism(bridge, Math.abs(y - (bridge.active ? bridge.maxY : bridge.minY)) < .003 ? (bridge.active ? bridge.maxY : bridge.minY) : y, dt);
      bridge.links.forEach(l => l.material.color.setHex(bridge.active ? 0x73dabb : 0xffbb63));
    }
    const barrier = this.mechanisms.barrier;
    barrier.contact = this.cargoOnPad(this.mechanisms.chargePad.position) ? (barrier.contact ?? 0) + dt : 0;
    const wasOpen = barrier.opened;
    if (dt > 0) barrier.opened = barrier.contact > .16;
    if (barrier.opened && !wasOpen) { this.companionAnimator.trigger('nod'); this.audio.checkpoint(); }
    barrier.previousProgress = barrier.progress;
    const occupied = Math.abs(this.playerPosition.z + 15) < .75 && Math.abs(this.playerPosition.x) < 2.5
      || Math.abs(this.cargo.position.z + 15) < .8 && Math.abs(this.cargo.position.x) < 2.5;
    const safeOpen = barrier.opened || barrier.progress > .8 && occupied;
    barrier.progress = THREE.MathUtils.damp(barrier.progress, safeOpen ? 1 : 0, 4.6, dt);
    barrier.mechanism?.update(barrier.progress, this.visualTime);
    barrier.collider.enabled = barrier.progress < .92;
    this.physics?.setStaticEnabled(barrier.mesh.uuid, barrier.collider.enabled);
    barrier.mesh.visible = false;
    const color = barrier.opened ? 0x73dabb : 0xffbb63;
    barrier.indicator.material.color.setHex(color); this.mechanisms.chargePad.ring.material.color.setHex(color);
    barrier.links.forEach(l => l.material.color.setHex(color));
    this.animatePressurePad(this.mechanisms.chargePad, barrier.opened, dt);
    const lift = this.mechanisms.lift, f = lift.floor;
    const on = (p, tolerance) => p.x > f.minX + .12 && p.x < f.maxX - .12 && p.z > f.minZ + .12 && p.z < f.maxZ - .12 && Math.abs(p.y - lift.y) < tolerance;
    const loaded = on(this.playerPosition, .2) || on(this.cargo.position, .85);
    lift.dwell = loaded ? Math.min(.6, (lift.dwell ?? 0) + dt) : Math.max(0, (lift.dwell ?? 0) - dt * .4);
    if (lift.dwell >= .5) lift.active = true;
    if (!loaded && lift.dwell === 0 && this.playerPosition.distanceTo(lift.position) > 4) lift.active = false;
    const liftGoal = lift.active ? lift.maxY : lift.minY;
    const liftY = THREE.MathUtils.damp(lift.y ?? 0, liftGoal, 1.4, dt);
    this.moveMechanism(lift, Math.abs(liftY - liftGoal) < .003 ? liftGoal : liftY, dt);
  }

  updateDoors(dt) {
    if (this.firstLevel) return;
    this.doors.forEach((door, index) => {
      door.contact = this.cargoOnPad(CHAMBERS[index].button) ? door.contact + dt : 0;
      const wasOpen = door.opened;
      if (dt > 0) door.opened = door.contact > .16;
      if (door.opened && !wasOpen) {
        this.audio.checkpoint(); this.companionAnimator.trigger('nod');
        this.callbacks.onToast('Вес держит дверь открытой. Портал в плите поможет забрать друга.');
      }
      door.previousProgress = door.progress;
      const occupied = Math.abs(this.playerPosition.z - door.z) < .8 && Math.abs(this.playerPosition.x) < 2.8
        || Math.abs(this.cargo.position.z - door.z) < .85 && Math.abs(this.cargo.position.x) < 2.8;
      // A safety beam protects the crossing, then the weight circuit closes.
      const safeOpen = door.opened || door.progress > .72 && occupied;
      door.progress = THREE.MathUtils.damp(door.progress, safeOpen ? 1 : 0, 4.3, dt);
      if (door.mechanism) {
        door.mechanism.update(door.progress);
        door.mechanism.getLeafBoxes(door.progress).forEach((box, i) => this.syncCollision(door.leafColliders[i], box, dt));
      } else {
        door.collider.enabled = door.progress < .92;
        this.physics?.setStaticEnabled(door.mesh.uuid, door.collider.enabled);
      }
      const color = door.opened ? 0x73dabb : 0xffbb63;
      door.buttonRing.material.color.setHex(color); this.mechanisms.doorLinks[index].material.color.setHex(color);
      this.animatePressurePad(door.pad, door.opened, dt);
    });
  }

  animatePressurePad(pad, pressed, dt) {
    if (!pad?.art) return;
    pad.compression = THREE.MathUtils.damp(pad.compression ?? 0, pressed ? 1 : 0, 12, dt);
    pad.art.position.y = (pad.baseY ?? pad.position.y) - pad.compression * .014;
  }

  updateVisuals(dt, alpha = 1) {
    this.audio?.flight?.(this.playerVelocity.length(),this.playerGrounded||this.state!=='playing'||this.externalBlocked);
    const active = this.state === 'playing' || this.state === 'won' || this.state === 'ready';
    const visualDt = active ? dt : 0;
    this.visualTime += visualDt;
    const blend = THREE.MathUtils.clamp(alpha, 0, 1);
    this.playerGroup.position.lerpVectors(this.previousPlayerPosition, this.playerPosition, blend);
    this.playerGroup.rotation.set(0, this.previousFacing + Math.atan2(Math.sin(this.facing - this.previousFacing), Math.cos(this.facing - this.previousFacing)) * blend, 0);
    this.playerGroup.position.add(this.portalVisualOffset);
    this.playerGroup.quaternion.premultiply(this.portalVisualRotation);
    this.portalVisualOffset.multiplyScalar(Math.exp(-10 * visualDt));
    this.portalVisualRotation.slerp(new THREE.Quaternion(), 1 - Math.exp(-10 * visualDt));
    const cargo = this.physics.sample(blend);
    this.cargo.group.position.copy(cargo.position); this.cargo.group.quaternion.copy(cargo.quaternion);
    const companionState=this.companionBehavior?.state;
    if(visualDt>0&&companionState!==this.lastCompanionState){
      if(companionState==='wandering')this.companionAnimator.trigger('curious');
      if(this.lastCompanionState==='getting_up'&&companionState!=='getting_up'&&cargo.grounded)this.companionAnimator.trigger('nod');
      this.lastCompanionState=companionState;
    }
    this.companionAnimator.update({ dt: visualDt, elapsed: this.visualTime, speed: cargo.velocity.length(),
      velocity: cargo.velocity, angularVelocity: cargo.angularVelocity, impact: cargo.impact,
      grounded: cargo.grounded, carrying: Boolean(this.heldCube), curious: this.playerPosition.distanceTo(this.cargo.position) < 2.5, celebrating:this.state==='won' });
    this.companionRig?.update({ dt: visualDt, elapsed: this.visualTime, speed: Math.hypot(cargo.velocity.x, cargo.velocity.z),
      velocity: cargo.velocity,
      grounded: cargo.grounded, carrying: Boolean(this.heldCube), recovering: this.companionBehavior?.state === 'getting_up',
      tumbling: !cargo.grounded || cargo.angularVelocity.length() > 3, celebrating:this.state==='won', reaction:this.companionAnimator.reactionClip });
    const gripVisual = this.cargo.visual ?? this.cargo.group;
    gripVisual.updateWorldMatrix(true, true);
    gripVisual.localToWorld(this.carryGripTargets.left.set(-.20, -.015, -.20));
    gripVisual.localToWorld(this.carryGripTargets.right.set(.20, -.015, -.20));
    this.animator.update({ dt: visualDt, ...(this.motion ?? {}), velocity: this.playerVelocity, grounded: this.playerGrounded,
      carrying: Boolean(this.heldCube), carryGripTargets: this.heldCube ? this.carryGripTargets : null,
      lookTarget: this.playerPosition.distanceTo(this.cargo.position) < 3.2 ? this.cargo.group.position : null,
      sampleGround: (x, z, maxY) => this.sampleFootSupport(x, z, maxY),
      windStrength:this.windStrength||0,shooting: this.shotPoseTime>0&&!this.heldCube, phase: this.portalCooldown > .2, elapsed: this.visualTime, weapon: true, aiming: this.isAiming() || (this.shotPoseTime>0&&!this.heldCube), aimPitch: this.shotPoseTime>0&&this.shotAimPoint ? Math.atan2(this.shotAimPoint.y-this.playerPosition.y-1.4, Math.hypot(this.shotAimPoint.x-this.playerPosition.x,this.shotAimPoint.z-this.playerPosition.z)) : this.pitch });
    if (visualDt > 0) {
      const contacts = this.animator.diagnostics?.footContact;
      for (const side of ['L', 'R']) {
        if (contacts?.[side] > .6 && !(this.lastFootContacts?.[side] > .6) && (this.motion?.speed ?? 0) > .4)
          this.audio.step?.(side, Math.min(1, (this.motion?.speed ?? 0) / 4.6));
      }
      if (contacts) this.lastFootContacts = { ...contacts };
    }
    this.socialClock = (this.socialClock ?? 0) + visualDt;
    if (this.socialClock > 7.5 && (this.motion?.speed ?? 0) < .15 && this.playerGrounded && !this.isAiming()
      && this.playerPosition.distanceTo(this.cargo.position) < 3.2) {
      this.socialClock = 0; this.animator.trigger?.('curious'); this.companionAnimator.trigger('nod');
    }
    this.heldDevice.update({ dt: visualDt, carrying: Boolean(this.heldCube) }); this.animationFrames++;
    if (this.firstLevel) this.firstLevel.renderUpdate?.(blend, this.visualTime);
    else {
    for (const moving of [...this.mechanisms.bridges, this.mechanisms.lift]) moving.group.position.y = THREE.MathUtils.lerp(moving.previousY, moving.y, blend);
    this.doors.forEach(door => {
      const progress = THREE.MathUtils.lerp(door.previousProgress, door.progress, blend);
      door.mechanism?.update(progress);
    });
    const barrier = this.mechanisms.barrier;
    const barrierProgress = THREE.MathUtils.lerp(barrier.previousProgress ?? barrier.progress, barrier.progress, blend);
    barrier.mechanism?.update(barrierProgress, this.visualTime);
    }
    this.cameraRig.update({ dt: visualDt, target: this.playerGroup.position, yaw: this.yaw, pitch: this.pitch, velocity: this.playerVelocity, aiming: this.isAiming() });
    this.camera.getWorldDirection(this.cameraForward);
    this.updateAimHint(visualDt);
    // The light and shadow frustum stay fixed across the complete level.
    this.portals.update(this.visualTime); this.portalShots?.render(blend);
    const nearbyAction = this.firstLevel?.nearbyInteraction?.();
    this.prompt.textContent = (typeof nearbyAction === 'string' ? nearbyAction : nearbyAction?.label) || (this.nearbyTerminal() ? 'E — включить мост' : this.heldCube ? 'E — отпустить брейнрота' : this.playerPosition.distanceTo(this.cargo.position) < 2.25 ? 'E — взять брейнрота' : '');
  }

  render() {
    if (this.renderer.info) { this.renderer.info.autoReset = false; this.renderer.info.reset(); }
    this.portalActors?.update();
    this.portals.render(this.visualTime);
    // Only the main lens needs its transitional world plane. Applying it while
    // drawing the portal textures would clip unrelated destination chambers.
    const previousClipping = this.renderer.clippingPlanes;
    this.renderer.clippingPlanes = this.cameraRig.mainClippingPlanes;
    try { this.renderer.render(this.scene, this.camera); }
    finally { this.renderer.clippingPlanes = previousClipping; }
  }

  emitHud() {
    this.callbacks.onHud({ chamber: this.firstLevel ? this.firstLevel.title : CHAMBERS[this.stage].name, objective: this.firstLevel?.getObjective() ?? CHAMBERS[this.stage].objective,
      hasCargo: Boolean(this.heldCube), portalsReady: Boolean(this.portals?.ready), stage: this.stage,
      friendStatus: this.heldCube ? 'Друг на руках' : this.companionBehavior?.state === 'getting_up' ? 'Друг поднимается'
        : this.companionBehavior?.state === 'waiting_on_pad' ? 'Друг держит плиту'
          : this.companionBehavior?.state === 'wandering' ? 'Друг исследует рядом' : 'Друг рядом' });
  }

  diagnostics() {
    return { levelIndex: this.levelIndex, checkpoints: false, performance: this.performanceMonitor.stats, state: this.state, modelsLoaded: this.assets.size, missingModels: this.failures, thirdPerson: true, stage: this.stage,
      portalsReady: this.portals.ready, teleportCount: this.teleportCount, cameraDistance: this.camera.position.distanceTo(this.playerPosition),
      animation: this.animator.diagnostics, device: this.heldDevice.diagnostics, aiming: this.isAiming(),
      cargo: { identity: this.cargo.group.uuid, count: this.cubes.length, position: this.cargo.position.toArray(), held: Boolean(this.heldCube), visible: this.cargo.group.visible, physics: this.physics.sample(1), animation: this.companionAnimator.diagnostics,
        behavior: this.companionBehavior?.diagnostics },
      portalRendering: this.portals.diagnostics, renderFrames: this.renderFrames, animationFrames: this.animationFrames, physicsHz: 120,
      loading: this.loadingProfile,
      mechanisms: this.firstLevel ? this.firstLevel.diagnostics() : { bridges: this.mechanisms.bridges.map(b => ({ active: b.active, height: b.y })), barrierOpen: this.mechanisms.barrier.opened,
        liftHeight: this.mechanisms.lift.y, doors: this.doors.map(d => d.opened) },
    };
  }

  win() {
    if (this.state === 'won') return;
    this.state = 'won'; this.playerVelocity.set(0, 0, 0); this.motion = { speed: 0, turnRate: 0 };
    this.audio?.flight?.(0,true);
    this.audio.win(); document.exitPointerLock?.();
    this.animator.trigger?.('celebrate'); this.companionAnimator.trigger('celebrate'); this.callbacks.onWin({});
  }
}
