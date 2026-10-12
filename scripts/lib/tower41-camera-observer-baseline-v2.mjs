/** PRIVATE external observation only. Nothing runs until install() is called.
 * The factory is self-contained and may be serialized into the native page.
 * It never starts a route, renders, steps physics, moves an actor/lens, fires,
 * changes a puzzle or installs a portal. No camera correction is implemented.
 */
export function createTower41CameraObserverApi() {
  const PINS = {
    sourceCommit: '5e552e9c3ac248b535d619741f15e99e29979cbf',
    tree: '8d573c22140eeb9625fff94ca14efd3f97978c17',
    sourceInputsSha256: '35ec4b0d586d0e6f96e2570605295c77e3ee73de5fff22a4a5ee8a726858b69c',
    sourceReview: {runId: 38291320140, runAttempt: 1},
    packageFilesSha256: 'e6a18309eb5b5008c194774eb998340c2c5a14493730639eeac99ff03c2b313f',
    journeySha256: 'bdb97352b644a504c8f3154b027171252d10bd75a7354c61aa6c67fd4689388e',
    browserSeamSha256: '9ac768fcd09f0c01339f367915e0f1b704bbb67dab45bf5ae2ee9763748ce5dd',
  };
  const fail = message => {throw new Error('Tower41 camera observer: ' + message);};
  const require = (condition, message) => {if (!condition) fail(message);};
  const finite = (value, label) => {require(Number.isFinite(value), label + ' must be finite');return value;};
  const integer = (value, min, max, label) => {
    require(Number.isSafeInteger(value) && value >= min && value <= max, label + ' outside finite budget');return value;
  };
  const clone = value => JSON.parse(JSON.stringify(value));
  const array = (value, length, label) => {
    require(value && typeof value.toArray === 'function', label + ' unavailable');
    const result = value.toArray();require(result.length === length, label + ' length');
    result.forEach(v => finite(v, label));return result;
  };
  const jsonBytes = value => new TextEncoder().encode(JSON.stringify(value)).byteLength;
  function validateIdentity(identity, buildInfo) {
    require(identity && buildInfo, 'actual source receipt and fetched build-info required');
    for (const key of ['sourceCommit', 'tree', 'sourceInputsSha256', 'packageFilesSha256'])
      require(identity[key] === PINS[key], 'frozen ' + key + ' mismatch');
    require(identity.sourceReview?.runId === PINS.sourceReview.runId
      && identity.sourceReview?.runAttempt === PINS.sourceReview.runAttempt, 'exact SOURCE run/attempt required');
    require(buildInfo.commit === identity.sourceCommit
      && buildInfo.sourceInputsSha256 === identity.sourceInputsSha256, 'actual build-info/source mismatch');
    return clone(identity);
  }
  function normalizeOptions(options = {}) {
    require(options && typeof options === 'object' && !Array.isArray(options),'options object required');
    if(options.expectedPrefixStop!==undefined)require(options.expectedPrefixStop==='pendulum','only declared pendulum prefix supported');
    const defaults = [
      {id: 'ceiling-to-floor-shot-and-load', start: 43813, end: 44260, stride: 1},
      {id: 'physical-catch', start: 44420, end: 44470, stride: 1},
      {id: 'cargo-recovery-and-first-jump', start: 44620, end: 44740, stride: 1},
      {id: 'founded-deck-and-island', start: 45410, end: 45695, stride: 5},
    ];
    const result = {
      windows: clone(options.windows ?? defaults),
      maxRecords: options.maxRecords ?? 1000,
      maxShots: options.maxShots ?? 32,
      maxFrames: options.maxFrames ?? 60000,
      maxPayloadBytes: options.maxPayloadBytes ?? 25000000,
      width: options.width ?? 640, height: options.height ?? 360,
      expectedInitialWorldStepOffset: options.expectedInitialWorldStepOffset ?? null,
      expectedPrefixStop: 'pendulum',
    };
    integer(result.maxRecords, 1, 2000, 'maxRecords');integer(result.maxShots, 1, 64, 'maxShots');
    integer(result.maxFrames, 1, 60000, 'maxFrames');integer(result.maxPayloadBytes, 1024, 25000000, 'payload bytes');
    integer(result.width, 1, 4096, 'width');integer(result.height, 1, 4096, 'height');
    if (result.expectedInitialWorldStepOffset !== null)
      integer(result.expectedInitialWorldStepOffset, 0, 10000, 'initial world-step offset');
    require(Array.isArray(result.windows) && result.windows.length > 0 && result.windows.length <= 12, '1..12 explicit windows required');
    let previousEnd = -1, expectedRecords = 0;const ids = new Set();
    for (const w of result.windows) {
      require(typeof w.id === 'string' && /^[a-z0-9-]{1,80}$/.test(w.id) && !ids.has(w.id), 'unique simple window ID required');ids.add(w.id);
      integer(w.start, 0, result.maxFrames - 1, 'window start');integer(w.end, w.start, result.maxFrames - 1, 'window end');
      integer(w.stride, 1, 60, 'window stride');require(w.start > previousEnd, 'windows must be ordered and disjoint');previousEnd = w.end;
      expectedRecords += Math.floor((w.end - w.start) / w.stride) + 1;
    }
    require(expectedRecords <= result.maxRecords, 'declared windows exceed maxRecords; no silent truncation');
    result.expectedRecords = expectedRecords;return result;
  }
  function selectedWindow(frame, options) {
    integer(frame, 0, options.maxFrames - 1, 'visual frame');
    return options.windows.find(w => frame >= w.start && frame <= w.end && (frame - w.start) % w.stride === 0) ?? null;
  }
  function advanceClock(previous, state, worldStep, options) {
    integer(state?.visualFrame, 0, options.maxFrames - 1, 'actual visualFrame');integer(worldStep, 0, 200000, 'actual worldStep');
    finite(state.seconds, 'route physics seconds');
    const frame = state.visualFrame;
    require(frame === (previous ? previous.visualFrame + 1 : 0), 'all actual route frames must be consecutive from zero');
    require(Math.abs(state.seconds - (frame + 1) / 60) < 1e-8, 'actual 60Hz/120Hz prefix clock mismatch');
    const offset = worldStep - 2 * (frame + 1);require(offset >= 0, 'world clock precedes route clock');
    if (previous) require(worldStep === previous.worldStep + 2 && offset === previous.worldStepOffset, 'actual fixed world steps were omitted/repeated');
    if (options.expectedInitialWorldStepOffset !== null) require(offset === options.expectedInitialWorldStepOffset, 'initial clock binding mismatch');
    return {visualFrame: frame, worldStep, worldStepOffset: offset, routePhysicsSteps: 2 * (frame + 1), routeSeconds: state.seconds};
  }
  function projectionAccumulator() {
    return {vertices: 0, minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity,
      minDepth: Infinity, maxDepth: -Infinity, outsideLensCount: 0, behindCount: 0,
      nearCount: 0, extremaWitnesses: {}};
  }
  function addProjection(p, sample) {
    const {ndc, depth, near, witness} = sample;
    require(Array.isArray(ndc) && ndc.length === 3, 'projection requires actual NDC xyz');ndc.forEach(v => finite(v, 'NDC'));
    finite(depth, 'camera depth');finite(near, 'near');require(near > 0, 'positive near plane');
    p.vertices++;
    for (const [key, value, direction] of [['minX', ndc[0], -1], ['maxX', ndc[0], 1],
      ['minY', ndc[1], -1], ['maxY', ndc[1], 1], ['minDepth', depth, -1], ['maxDepth', depth, 1]]) {
      if (direction * value > direction * p[key]) {p[key] = value;p.extremaWitnesses[key] = clone(witness);}
    }
    if (depth <= 0) p.behindCount++;
    if (depth <= near) p.nearCount++;
    if (depth <= 0 || Math.abs(ndc[0]) > 1 || Math.abs(ndc[1]) > 1 || ndc[2] < -1 || ndc[2] > 1) p.outsideLensCount++;
  }
  function finishProjection(p) {
    require(p.vertices > 0, 'empty projection');for (const key of ['minX','maxX','minY','maxY','minDepth','maxDepth']) finite(p[key], key);
    return {...p, insideLens: p.outsideLensCount === 0};
  }
  function preserveFrameHook(previous, observe, active) {
    require(typeof previous==='function'&&typeof observe==='function'&&typeof active==='function','actual frame hook/observer/lifetime callbacks required');
    return async function(...args) {
      const result=await previous.apply(this,args);
      if(active())await observe.apply(this,args);
      return result;
    };
  }
  async function guardedRead(read, assertIdentity) {
    require(typeof read==='function'&&typeof assertIdentity==='function','read and identity callbacks required');
    assertIdentity();const result=await read();assertIdentity();return result;
  }
  async function sha(bytes) {
    require(globalThis.crypto?.subtle, 'native WebCrypto required for read-only appearance hashes');
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, '0')).join('');
  }

    function validateMaterialProvenance(g,refs,row) {
      const actor=refs.playerPortalActor,controller=refs.portalActors,current=row.mesh.material;
      if(current===row.material)return {kind:'original-authored-material',sourceMaterialUuid:(Array.isArray(row.material)?row.material:[row.material]).map(material=>material.uuid)};
      require(g.portalActors===controller&&controller?.actors?.has(actor)&&actor.root===refs.root&&actor.active===true
        &&(actor.entryIndex===0||actor.entryIndex===1),'material '+row.mesh.uuid+' changed without the original active portal actor');
      const record=actor.materials.find(record=>record.source===row.mesh);
      require(record&&record.original===row.material&&record.sourceClipped===current,
        'material '+row.mesh.uuid+' has no exact original owned clipping provenance');
      const base=Array.isArray(row.material)?row.material:[row.material],clipped=Array.isArray(current)?current:[current];
      require(record.sourceList.length===base.length&&record.sourceMaterials.length===base.length&&clipped.length===base.length
        &&base.every((material,index)=>record.sourceList[index]===material&&record.sourceMaterials[index]===clipped[index]),
        'material '+row.mesh.uuid+' original/owned clipping lists changed');
      const scalarKeys=['opacity','transparent','alphaTest','alphaHash','alphaToCoverage','depthWrite','depthTest','colorWrite',
        'side','visible','wireframe','roughness','metalness','emissiveIntensity','intensity','transmission','thickness','envMapIntensity'];
      const colorKeys=['color','emissive','specular','attenuationColor'];
      const textureKeys=['map','normalMap','roughnessMap','metalnessMap','emissiveMap','alphaMap','bumpMap','displacementMap','aoMap','envMap','lightMap'];
      const shaderWithClip=(shader,fragment)=>{
        const include=fragment?'clipping_planes_pars_fragment':'clipping_planes_pars_vertex';
        if(shader.includes(include))return shader;
        const body=fragment?'#include <clipping_planes_fragment>':'#if NUM_CLIPPING_PLANES > 0\n vClipPosition = -(modelViewMatrix * vec4(position, 1.0)).xyz;\n#endif';
        return '#include <'+include+'>\n'+shader.replace(/void\s+main\s*\(\s*\)\s*\{/,match=>match+'\n'+body+'\n');
      };
      for(let index=0;index<base.length;index++){
        const source=base[index],target=clipped[index];
        require(source!==target&&source.type===target.type&&scalarKeys.every(key=>source[key]===undefined||target[key]===source[key]),
          'material '+row.mesh.uuid+' authored scalar style changed');
        require(colorKeys.every(key=>!source[key]?.isColor||target[key]?.isColor&&source[key].equals(target[key]))
          &&textureKeys.every(key=>source[key]===target[key]),'material '+row.mesh.uuid+' authored colors/textures changed');
        require(target.onBeforeCompile===source.onBeforeCompile&&target.customProgramCacheKey===source.customProgramCacheKey,
          'material '+row.mesh.uuid+' original shader callbacks changed');
        const planes=[...(source.clippingPlanes??[]),actor.sourcePlane];
        require(target.clipIntersection===false&&target.clipShadows===true&&target.clippingPlanes?.length===planes.length
          &&planes.every((plane,index)=>target.clippingPlanes[index]===plane),'material '+row.mesh.uuid+' clipping plane is not exactly actor-owned');
        if(source.isShaderMaterial)require(target.uniforms===source.uniforms&&target.clipping===true
          &&target.vertexShader===shaderWithClip(source.vertexShader,false)&&target.fragmentShader===shaderWithClip(source.fragmentShader,true),
          'material '+row.mesh.uuid+' original shared shader uniforms or owned clipping program changed');
      }
      return {kind:'original-portal-actor-owned-clipping-material',sourceMaterialUuid:base.map(material=>material.uuid),
        currentMaterialUuid:clipped.map(material=>material.uuid),entryIndex:actor.entryIndex,sourcePlane:[...actor.sourcePlane.normal.toArray(),actor.sourcePlane.constant]};
    }


  async function install({game: g, sourceIdentity, buildInfo, options = {}}) {
    const identity = validateIdentity(sourceIdentity, buildInfo), config = normalizeOptions(options);
    require(g?.firstLevel?.singularity === true && g.levelIndex === 40 && g.state === 'playing', 'fresh actual ordinary Tower41 Play required');
    require(g.chamberEdition === 'foundation' && !g.kineticMode && !g.epicMode, 'ordinary Foundation camera required');
    require(g.firstLevel.completedStages === 0, 'untouched prefix required');
    const refs = {game: g, world: g.physics?.world, physics: g.physics, camera: g.camera, rig: g.cameraRig,
      playerPosition: g.playerPosition, root: g.playerGroup, visual: g.playerVisual, animator: g.animator,
      cargo: g.cargo, cargoBody: g.physics?.cargoBody, cargoGroup: g.cargo?.group, cargoVisual: g.cargo?.visual,
      renderer: g.renderer, portalActors:g.portalActors, level: g.firstLevel, portals: g.portals, shots: g.portalShots};
    require(refs.world && refs.renderer?.domElement && refs.cargoBody?.mass === 3.2, 'actual native renderer/world/original 3.2kg cargo required');
    refs.playerPortalActor=[...(refs.portalActors?.actors??[])].find(actor=>actor.root===refs.root);
    require(refs.playerPortalActor,'original registered player portal actor required');
    const cargoShapes = refs.cargoBody.shapes.slice();require(cargoShapes.length === 1 && cargoShapes[0].halfExtents, 'original single cargo Box required');
    require(array(cargoShapes[0].halfExtents, 3, 'cargo half').every(v => v === .39), 'original .78m cargo Box required');
    const meshes = [], nodes = [], boneSet = new Set();
    refs.visual.traverse(mesh => {
      nodes.push(mesh);
      if (!mesh.isMesh) return;
      const geometry = mesh.geometry, position = geometry?.attributes?.position;
      require(position && position.count > 0 && typeof mesh.getVertexPosition === 'function', 'current original geometry unavailable');
      const attributes = Object.entries(geometry.attributes).map(([name, attribute]) => ({name, attribute,
        array: attribute.array ?? attribute.data?.array, count: attribute.count, itemSize: attribute.itemSize, normalized: attribute.normalized}));
      if (geometry.index) attributes.push({name: '$index', attribute: geometry.index, array: geometry.index.array,
        count: geometry.index.count, itemSize: geometry.index.itemSize, normalized: geometry.index.normalized});
      require(!geometry.morphAttributes || Object.values(geometry.morphAttributes).every(a => a.length === 0), 'unsupported morph attributes cannot be omitted');
      for (const row of attributes) require(ArrayBuffer.isView(row.array), 'actual typed geometry buffer required');
      const skeleton = mesh.skeleton, bones = skeleton?.bones.slice() ?? [];
      bones.forEach(b => boneSet.add(b));meshes.push({mesh, geometry, position, attributes, skeleton, bones,
        material: mesh.material, vertices: position.count});
    });
    const vertices = meshes.reduce((n, m) => n + m.vertices, 0);
    require(vertices === 96753 && boneSet.size === 15 && Math.max(...meshes.map(m => m.bones.length)) === 15, 'every original 96753 vertex and 15 bone identities required');
    const animatorBones=refs.animator.bones,animatorBoneEntries=Object.entries(animatorBones??{});
    require(animatorBoneEntries.length===15&&animatorBoneEntries.every(([,bone])=>boneSet.has(bone)),
      'actual animator must use the same fifteen original skeleton bones');
    const resets = {resetRun: 0, respawn: 0, resetCargo: 0, levelReset: 0, pendulumReset: 0};
    const records = [], shotRequests = [], encodedBindings = [], wrappers = [], sweepFrames = new Map();
    let insideFit = false;
    let clock = null, finished = false, disposed = false, busy = false, payloadBytes = 0, callsAttached = false;
    function liveIdentity() {
      require(!disposed && g.physics === refs.physics && g.physics.world === refs.world && g.camera === refs.camera
        && g.cameraRig === refs.rig && g.playerPosition === refs.playerPosition && g.playerGroup === refs.root
        && g.playerVisual === refs.visual && g.animator === refs.animator && g.cargo === refs.cargo
        && g.physics.cargoBody === refs.cargoBody && g.cargo.group === refs.cargoGroup && g.cargo.visual === refs.cargoVisual
        && g.firstLevel === refs.level && g.portals === refs.portals && g.portalShots === refs.shots && g.renderer === refs.renderer,
      'actual original actor/world/lens identity changed');
      require(refs.cargoBody.mass === 3.2 && refs.cargoBody.shapes.length === cargoShapes.length
        && cargoShapes.every((shape, i) => refs.cargoBody.shapes[i] === shape)
        && array(cargoShapes[0].halfExtents,3,'current cargo half').every(v=>v===.39)
        && refs.cargoBody.world===refs.world&&refs.world.bodies.includes(refs.cargoBody), 'original cargo body/shape/world ownership changed');
      require(refs.animator.bones===animatorBones&&Object.keys(animatorBones).length===15
        && animatorBoneEntries.every(([name,bone])=>animatorBones[name]===bone),'original animator bones replaced');
      const currentMeshes=[];refs.visual.traverse(node=>{if(node.isMesh)currentMeshes.push(node);});
      require(currentMeshes.length===meshes.length&&currentMeshes.every(mesh=>meshes.some(row=>row.mesh===mesh)),
        'current original visual meshes were added/removed; no current vertex may be omitted');
      for (const row of meshes) {
        validateMaterialProvenance(g,refs,row);
        require(row.mesh.geometry === row.geometry && row.geometry.attributes.position === row.position
          && row.position.count === row.vertices && row.mesh.skeleton === row.skeleton ,
        'original mesh/geometry/skeleton replaced: '+row.mesh.uuid);
        require(row.bones.length === (row.skeleton?.bones.length ?? 0)
          && row.bones.every((bone, i) => row.skeleton.bones[i] === bone), 'original bone replaced');
        for (const a of row.attributes) {
          const current = a.name === '$index' ? row.geometry.index : row.geometry.attributes[a.name];
          require(current === a.attribute && (current.array ?? current.data?.array) === a.array
            && current.count === a.count && current.itemSize === a.itemSize && current.normalized === a.normalized,
          'original attribute/array replaced');
        }
        require(Object.keys(row.geometry.attributes).length === row.attributes.filter(a => a.name !== '$index').length, 'original attributes added/removed');
      }
      require(Object.values(resets).every(n => n === 0), 'an in-route reset/respawn occurred');
      require(refs.renderer.domElement.width === config.width && refs.renderer.domElement.height === config.height,
        'actual native canvas dimensions changed');
      require(Math.abs(refs.camera.aspect - config.width / config.height) < 1e-8, 'actual canvas/lens aspect mismatch');
    }
    const transform = node => ({uuid: node.uuid,parentUuid:node.parent?.uuid??null,position: array(node.position, 3, 'position'),
      quaternion: array(node.quaternion, 4, 'quaternion'), scale: array(node.scale, 3, 'scale'), visible: node.visible});
    function materialSnapshot(material) {
      return (Array.isArray(material) ? material : [material]).map(m => ({uuid: m.uuid, visible: m.visible,
        opacity: m.opacity, transparent: m.transparent, side: m.side, wireframe: m.wireframe,
        color: m.color?.toArray() ?? null, emissive: m.emissive?.toArray() ?? null,
        map: m.map?.uuid ?? null, clipping: (m.clippingPlanes ?? []).map(p => [...p.normal.toArray(), p.constant])}));
    }
    function watchedState() {
      const bodies = refs.world.bodies.map(b => ({id: b.id, type: b.type, mass: b.mass,
        position: array(b.position, 3, 'body position'), quaternion: array(b.quaternion, 4, 'body quaternion'),
        velocity: array(b.velocity, 3, 'body velocity'), angularVelocity: array(b.angularVelocity, 3, 'body angular velocity'),
        force: array(b.force, 3, 'body force'), torque: array(b.torque, 3, 'body torque'),
        masks: [b.collisionFilterGroup, b.collisionFilterMask], shapes: b.shapes.map(s => s.id), sleepState: b.sleepState}));
      return JSON.stringify({world: [refs.world.stepnumber, refs.world.time, refs.world.dt], bodies,
        state: g.state, elapsed: g.elapsed, player: array(g.playerPosition, 3, 'player'),
        previousPlayer: array(g.previousPlayerPosition, 3, 'previous player'), velocity: array(g.playerVelocity, 3, 'velocity'),
        grounded: g.playerGrounded, facing: g.facing, previousFacing: g.previousFacing, yaw: g.yaw, pitch: g.pitch,
        held: g.heldCube?.group?.uuid ?? null, teleports: g.teleportCount, towerMetrics: refs.level.getTowerMetrics(),
        shotPoseTime: g.shotPoseTime, shotAimPoint: g.shotAimPoint?.toArray() ?? null,
        shots: {time: refs.shots.time, queue: refs.shots.queue.map(s => [s.index,s.sequence,s.delay,s.point.toArray()]),
          active: refs.shots.active.map(s => [s.index,s.sequence,s.position.toArray(),s.travel])},
        root: transform(refs.root), cargo: transform(refs.cargoGroup), actorLocalTransforms: nodes.map(transform),
        materials: meshes.map(row => materialSnapshot(row.mesh.material)),
        portals: refs.portals.portals.map(p => p ? {position: p.position.toArray(), normal: p.normal.toArray(),
          right: p.right.toArray(), up: p.up.toArray(), width: p.width, height: p.height} : null),
        camera: {transform: transform(refs.camera), up: refs.camera.up.toArray(), fov: refs.camera.fov,
          aspect: refs.camera.aspect, near: refs.camera.near, far: refs.camera.far,
          projection: refs.camera.projectionMatrix.toArray(), projectionInverse: refs.camera.projectionMatrixInverse.toArray()},
      });
    }
    async function appearanceHash() {
      const attrs = meshes.flatMap(row => row.attributes.map(a => ({mesh: row.mesh.uuid, name: a.name,
        count: a.count, itemSize: a.itemSize, normalized: a.normalized, type: a.array.constructor.name,
        bytes: new Uint8Array(a.array.buffer, a.array.byteOffset, a.array.byteLength)})));
      const header = new TextEncoder().encode(JSON.stringify(attrs.map(({bytes,...a}) => ({...a,bytes: bytes.length}))));
      const size = header.length + attrs.reduce((n, a) => n + a.bytes.length, 0);require(size <= 64000000, 'appearance buffer budget exceeded');
      const joined = new Uint8Array(size);joined.set(header);let offset = header.length;
      for (const a of attrs) {joined.set(a.bytes, offset);offset += a.bytes.length;}return sha(joined);
    }
    function addBounded(target, record, limit, label) {
      require(target.length < limit, label + ' count budget exhausted; observation stopped');
      const size = jsonBytes(record);require(size <= 80000, 'single record exceeds80KB');
      require(payloadBytes + size <= config.maxPayloadBytes, 'payload byte budget exhausted; no silent truncation');
      payloadBytes += size;target.push(record);
    }
    function lens() {
      const c = refs.camera, rig = refs.rig;
      const vectors = {};
      for (const name of ['focus','focusVelocity','goal','lastTarget','playerPivot','desired','lookPoint','forward','right',
        'viewUp','boomDirection','avoidance','avoidanceVelocity']) vectors[name] = array(rig[name],3,name);
      const quaternions = {};
      for (const name of ['orbitQuaternion','portalOrientation','portalUpOrientation']) quaternions[name] = array(rig[name],4,name);
      const springs = {};
      for (const name of ['yaw','pitch','yawVelocity','pitchVelocity','distance','distanceVelocity','fovVelocity','aimBlend',
        'aimBlendVelocity','upwardBackoff','upwardBackoffVelocity','epicFraming','epicFramingVelocity']) springs[name] = finite(rig[name],name);
      const flags = {};
      for (const name of ['fullBodyFraming','confinedFraming','inclinedFraming','obstructed','avoidanceActive',
        'portalFramingActive','rampFraming']) flags[name] = Boolean(rig[name]);
      require(rig.mainClippingPlanes.length <= 8, 'clipping-plane budget');
      return {eye: array(c.position,3,'eye'), quaternion: array(c.quaternion,4,'eye quaternion'), up: array(c.up,3,'eye up'),
        fov: finite(c.fov,'fov'), aspect: finite(c.aspect,'aspect'), near: finite(c.near,'near'), far: finite(c.far,'far'),
        matrixWorld: array(c.matrixWorld,16,'camera world matrix'), matrixWorldInverse: array(c.matrixWorldInverse,16,'camera inverse'),
        projection: array(c.projectionMatrix,16,'projection'), projectionInverse: array(c.projectionMatrixInverse,16,'projection inverse'),
        rig: {vectors,quaternions,springs,flags,portalExit: rig.portalExit ? {position: rig.portalExit.position.toArray(),
          normal: rig.portalExit.normal.toArray()} : null, clipping: rig.mainClippingPlanes.map(p => [...p.normal.toArray(),p.constant])}};
    }
    function envelope() {
      const p = projectionAccumulator(), point = refs.playerPosition.clone(), view = point.clone();let tangent = 0;
      for (const x of [-.65,.65]) for (const y of [-1.52,1.52]) for (const z of [-.65,.65]) {
        point.set(x,y,z).add(refs.rig.playerPivot);view.copy(point).applyMatrix4(refs.camera.matrixWorldInverse);
        const depth = -view.z;
        tangent = depth <= refs.camera.near ? Infinity : Math.max(tangent,Math.abs(view.y)/(depth*.96),
          Math.abs(view.x)/(depth*refs.camera.aspect*.96));
        const world = point.toArray(), ndc = point.project(refs.camera).toArray();
        addProjection(p,{ndc,depth,near: refs.camera.near,witness: {corner:[x,y,z],world,ndc,depth}});
      }
      const upright = refs.rig.viewUp.y >= Math.cos(.01), cap = refs.rig.confinedFraming && upright ? 120 : 102;
      const needed = 2*Math.atan(tangent)*180/Math.PI;
      return {...finishProjection(p),requiredFovUncapped: needed, cap, exceedsCap: needed > cap,
        fitEligibleByCurrentGate: refs.rig.fullBodyFraming && (!upright || refs.rig.confinedFraming && refs.rig.obstructed),
        source:'conservative eight-corner envelope; separate from actual original skin'};
    }
    function measureSkin() {
      const p = projectionAccumulator(), point = refs.playerPosition.clone(), view = point.clone();
      for (const row of meshes) for (let i=0;i<row.vertices;i++) {
        row.mesh.getVertexPosition(i,point).applyMatrix4(row.mesh.matrixWorld);
        view.copy(point).applyMatrix4(refs.camera.matrixWorldInverse);const depth = -view.z, world = point.toArray();
        const ndc = point.project(refs.camera).toArray();
        addProjection(p,{ndc,depth,near: refs.camera.near,witness:{meshUuid:row.mesh.uuid,vertex:i,world,ndc,depth}});
      }
      require(p.vertices === 96753,'an original current skinned vertex was omitted');
      return {...finishProjection(p),bones:15,source:'every actual current getVertexPosition of the original player visual; not proxy corners or authored bounds'};
    }
    const initialGuard = watchedState();const initialAppearanceSha256 = await guardedRead(appearanceHash,liveIdentity);
    require(initialGuard === watchedState(),'initial read-only hash advanced or changed gameplay/lens/appearance pose');
    async function collect(state,w) {
      require(!busy && !finished,'overlapping or finished observation');busy = true;
      try {
        liveIdentity();const before = watchedState(), beforeHash = await guardedRead(appearanceHash,liveIdentity);
        require(before === watchedState(),'background simulation advanced during hash');
        require(beforeHash === initialAppearanceSha256,'original geometry attribute bytes changed before sample');
        // Derived read-projection preparation only: no animation/render/physics.
        // Local actor/bone transforms, lens intrinsics and all physical bodies
        // are guarded below. These update cached world and skeleton matrices.
        g.scene.updateMatrixWorld(true);refs.camera.updateWorldMatrix(true,false);
        for (const skeleton of new Set(meshes.map(row=>row.skeleton).filter(Boolean))) skeleton.update();
        const camera = lens(), bodyVertexProjection = measureSkin(), conservativeEnvelope = envelope();
        const afterHash = await guardedRead(appearanceHash,liveIdentity);
        require(beforeHash === afterHash,'projection changed original attribute bytes');
        require(before === watchedState(),'read-projection preparation changed physical state/lens/local appearance pose');
        addBounded(records,{...clock,windowId:w.id,nativeCanvas:{width:config.width,height:config.height},
          sourceCommit:identity.sourceCommit,player:{current:g.playerPosition.toArray(),previous:g.previousPlayerPosition.toArray(),
            velocity:g.playerVelocity.toArray(),grounded:g.playerGrounded,renderedPosition:refs.root.position.toArray(),
            renderedQuaternion:refs.root.quaternion.toArray(),renderedScale:refs.root.scale.toArray()},
          cargo:{bodyId:refs.cargoBody.id,shapeId:cargoShapes[0].id,held:g.heldCube===refs.cargo,position:refs.cargoBody.position.toArray(),
            quaternion:refs.cargoBody.quaternion.toArray(),velocity:refs.cargoBody.velocity.toArray(),
            angularVelocity:refs.cargoBody.angularVelocity.toArray(),masks:[refs.cargoBody.collisionFilterGroup,refs.cargoBody.collisionFilterMask]},
          controls:{yaw:g.yaw,pitch:g.pitch,aimHeld:Boolean(g.aimHeld),isAiming:g.isAiming(),facing:g.facing,
            shotPoseTime:g.shotPoseTime,shotAimPoint:g.shotAimPoint?.toArray()??null},
          camera,bodyVertexProjection,conservativeEnvelope,
          materialProvenance:meshes.map(row=>({meshUuid:row.mesh.uuid,...validateMaterialProvenance(g,refs,row)})),
          actualCameraCalls:sweepFrames.get(clock.visualFrame)??{constrain:[],fit:[],scope:'no actual camera call observed'},
          readPurity:{physicalStateUnchanged:true,lensAndLocalAppearancePoseUnchanged:true,attributeBytesUnchanged:true,
            appearanceSha256:afterHash,derivedWorldAndSkeletonMatricesPrepared:true},
          encodedBinding:clone(encodedBindings.find(b=>b.visualFrame===clock.visualFrame)??null),
          scope:'actual selected visual-step optical diagnostic; no independent render/pixel or full camera acceptance'},config.maxRecords,'sample');
      } finally {if(clock)sweepFrames.delete(clock.visualFrame);busy=false;}
    }
    async function onFrame(state) {
      require(!finished && !busy,'frame arrived during/after collection');liveIdentity();
      require(callsAttached,'attach actual shot/reset/camera-call observers before the prefix');
      require(g.state === 'playing' && state.state === 'playing','bounded prefix must remain ordinarily playing');
      require(state.cargoBodyId === refs.cargoBody.id,'actual seam cargo identity mismatch');
      clock = advanceClock(clock,state,refs.world.stepnumber,config);
      const w = selectedWindow(clock.visualFrame,config);if (w) await collect(state,w);
    }
    function wrapFrameHook(previous) {
      require(typeof previous === 'function','existing native __SINGULARITY_FRAME__ callback required');
      return preserveFrameHook(previous,onFrame,()=>!finished&&!disposed);
    }
    function attachCallObservers() {
      require(wrappers.length === 0,'call observers already installed');
      function wrap(target,name,callback) {
        require(typeof target?.[name] === 'function','actual method '+name+' unavailable');const original=target[name];
        const wrapper=function(...args){
          if(finished||disposed)return original.apply(this,args);
          return callback.call(this,original,args);
        };target[name]=wrapper;wrappers.push({target,name,original,wrapper});
      }
      for (const [counter,target,name] of [['resetRun',g,'resetRun'],['respawn',g,'respawn'],['resetCargo',refs.physics,'resetCargo'],
        ['levelReset',refs.level,'reset'],['pendulumReset',refs.level.machines.get('pendulum').state.cell,'reset']])
        wrap(target,name,function(original,args){resets[counter]++;return original.apply(this,args);});
      function currentCameraWindow() {
        const frame=clock?clock.visualFrame+1:0;if(frame>=config.maxFrames)return null;
        if(!selectedWindow(frame,config))return null;
        if(!sweepFrames.has(frame))sweepFrames.set(frame,{constrain:[],fit:[],
          scope:'actual original camera methods during the production visual update; no additional sweep/fit was invoked'});
        return sweepFrames.get(frame);
      }
      wrap(refs.rig,'constrain',function(original,args){
        const telemetry=currentCameraWindow(),entry=telemetry?{origin:args[0].toArray(),inputEye:args[1].toArray(),
          worldStep:refs.world.stepnumber,phase:insideFit?'actual-fit-call':'actual-update-call'}:null;
        const result=original.apply(this,args);
        if(telemetry){require(telemetry.constrain.length<256,'actual sweep-call budget exhausted');
          telemetry.constrain.push({...entry,outputEye:args[1].toArray(),pulledIn:result});}
        return result;
      });
      wrap(refs.rig,'fitSilhouetteLens',function(original,args){
        const telemetry=currentCameraWindow(),before=telemetry?{eye:refs.camera.position.toArray(),fov:refs.camera.fov,
          envelope:envelope(),step:finite(args[0],'actual fit step')}:null;
        const oldInsideFit=insideFit;insideFit=true;let result;
        try{result=original.apply(this,args);}finally{insideFit=oldInsideFit;}
        if(telemetry){require(telemetry.fit.length<4,'actual fit-call budget exhausted');
          telemetry.fit.push({before,after:{eye:refs.camera.position.toArray(),fov:refs.camera.fov,envelope:envelope()}});}
        return result;
      });
      wrap(g,'firePortal',function(original,args){
        require(!finished && !disposed,'shot after collector lifetime');
        const beforeLens={eye:refs.camera.position.toArray(),q:refs.camera.quaternion.toArray(),fov:refs.camera.fov,
          projection:refs.camera.projectionMatrix.toArray()};
        const previousRequest=refs.shots.lastRequest;
        const requestWorldStep=refs.world.stepnumber,result=original.apply(this,args);
        const afterLens={eye:refs.camera.position.toArray(),q:refs.camera.quaternion.toArray(),fov:refs.camera.fov,
          projection:refs.camera.projectionMatrix.toArray()};
        require(JSON.stringify(beforeLens)===JSON.stringify(afterLens),'actual fire request changed the optical lens');
        const request=refs.shots.lastRequest??null,emitted=request!==previousRequest;
        const shot=emitted?[...refs.shots.queue,...refs.shots.active,refs.shots.buffered].filter(Boolean)
          .find(s=>s.index===request?.index&&s.sequence===request?.sequence):null;
        const ray=refs.shots.ray.ray;
        addBounded(shotRequests,{requestWorldStep,afterObservedVisualFrame:clock?.visualFrame??null,
          beforeNextVisualFrame:clock?clock.visualFrame+1:null,inputChannel:args[0],returned:result,
          portalShotsRequestEmitted:emitted,lastRequestObserved:clone(request),
          capturedTarget:shot?.point.toArray()??null,capturedTargetNdc:shot?shot.point.clone().project(refs.camera).toArray():null,
          actualCaptureRay:emitted&&request?.accepted?{origin:ray.origin.toArray(),direction:ray.direction.toArray()}:null,
          lensUnchangedByRequest:true,lens:beforeLens,
          scope:'actual public firePortal call; request frame is anchored between actual observed frames, not invented from video stride'},config.maxShots,'shot');
        return result;
      });
      callsAttached=true;
    }
    function bindEncodedSample({encodedFrame,visualFrame,terminal=false}) {
      // Call only from an actual encoder/capture event, never from frame/15.
      require(!finished&&!disposed,'encoder binding after observation lifetime');
      integer(encodedFrame,0,10000,'actual encodedFrame');integer(visualFrame,0,config.maxFrames-1,'actual encoded visualFrame');
      require(typeof terminal==='boolean','terminal must be boolean');
      require(encodedBindings.every(b=>b.encodedFrame!==encodedFrame&&b.visualFrame!==visualFrame),'duplicate encoder binding');
      require(encodedBindings.length<5000,'encoder binding budget');
      const binding={encodedFrame,visualFrame,terminal,source:'actual encoder/capture event supplied by external harness'};
      const size=jsonBytes(binding);require(payloadBytes+size<=config.maxPayloadBytes,'encoder payload budget');payloadBytes+=size;
      encodedBindings.push(binding);const record=records.find(r=>r.visualFrame===visualFrame);if(record)record.encodedBinding=clone(binding);
    }
    async function finish(routeResult) {
      require(!busy&&!finished,'finish once after completed observation');liveIdentity();
      require(clock && routeResult?.partial === true && routeResult.sameCompanion === true,'actual bounded ordinary prefix result required');
      require(routeResult.frames===clock.visualFrame+1 && routeResult.physicsSteps===clock.routePhysicsSteps,'prefix final clocks mismatch');
      require(routeResult.resets===0&&routeResult.respawns===0&&routeResult.cargoResets===0,'prefix reset counters must remain zero');
      require(JSON.stringify(routeResult.metrics?.solvedIds)===JSON.stringify([
        'freight','sluice','optics','hoist','archive','flywheel','magnet','migrant','pendulum']),
        'exact ordinary nine-machine stopAfter pendulum prefix required; no substituted order/continuation');
      require(records.length===config.expectedRecords,'declared camera window samples missing');
      const before=watchedState(),finalAppearanceSha256=await guardedRead(appearanceHash,liveIdentity);
      require(before===watchedState() && finalAppearanceSha256===initialAppearanceSha256,'final appearance/purity mismatch');
      const outside=records.filter(r=>!r.bodyVertexProjection.insideLens).map(r=>r.visualFrame);
      const report={kind:'private-actual-bounded-camera-observer',sourceIdentity:identity,sourcePins:clone(PINS),
        runtimeObserved:true,accepted:false,ordinaryPrefixAccepted:false,fullRoomAccepted:false,allCameraAccepted:false,
        knownSourceCropClosed:false,config,records,shotRequests,encodedBindings,resetCounters:{...resets},
        prefix:{frames:routeResult.frames,physicsSteps:routeResult.physicsSteps,seconds:routeResult.seconds,
          partial:true,sameCompanion:true,solvedIds:routeResult.metrics.solvedIds},
        identity:{playerRootUuid:refs.root.uuid,playerVisualUuid:refs.visual.uuid,cargoUuid:refs.cargoGroup.uuid,
          cargoBodyId:refs.cargoBody.id,cargoShapeId:cargoShapes[0].id,vertices:96753,bones:15,
          initialAppearanceSha256,finalAppearanceSha256},
        selectedSamplesOutside:outside,selectedSamplesAllInside:outside.length===0,
        dataIntegrity:{allDeclaredSamplesPresent:true,allActualFramesAndWorldStepsObserved:true,readPurityGuardsPassed:true},
        payloadRecordBytes:payloadBytes,
        scope:'Selected actual unchanged-source prefix visual steps only. This collector does not prove pixel visibility, occlusion, every encoded/render frame, human/device UX or camera correction.'};
      report.outputJSONBytes=0;for(let i=0;i<3;i++)report.outputJSONBytes=jsonBytes(report);
      require(jsonBytes(report)===report.outputJSONBytes&&report.outputJSONBytes<=config.maxPayloadBytes,'complete output JSON budget');
      finished=true;return clone(report);
    }
    function dispose() {
      require(!busy,'cannot dispose during asynchronous sample');const cleanup=[];
      for (const row of wrappers.reverse()) {
        const stillOwned=row.target[row.name]===row.wrapper;
        if(stillOwned)row.target[row.name]=row.original;
        cleanup.push({method:row.name,restoredOwnedWrapper:stillOwned,foreignOrAlreadyRestoredMethodPreserved:!stillOwned});
      }
      disposed=true;return {cleanup,physicalStateOrLensWritten:false};
    }
    return {onFrame,wrapFrameHook,attachCallObservers,bindEncodedSample,finish,dispose,
      configuration:clone(config),sourceIdentity:clone(identity),
      initialIdentity:{vertices,bones:boneSet.size,initialAppearanceSha256},
      status:()=>({runtimeObserved:clock!==null,framesObserved:clock?clock.visualFrame+1:0,records:records.length,
        shotRequests:shotRequests.length,resetCounters:{...resets},finished,disposed,accepted:false,allCameraAccepted:false})};
  }
  return {PINS:clone(PINS),validateIdentity,normalizeOptions,selectedWindow,advanceClock,
    projectionAccumulator,addProjection,finishProjection,preserveFrameHook,guardedRead,validateMaterialProvenance,install};
}

export const TOWER41_CAMERA_OBSERVER_BROWSER_FACTORY = createTower41CameraObserverApi.toString();
