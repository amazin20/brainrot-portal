import * as THREE from 'three';

/** Read-only native observation only. Nothing runs until install() is called.
 * The factory is self-contained and may be serialized into the native page.
 * It never starts a route, renders, steps physics, moves an actor/lens, fires,
 * changes a puzzle or installs a portal. No camera correction is implemented. External callers must verify exact current source/package receipts before injecting the factory.
 */
export function createTower41NativeCameraObserverApi(expectedPins) {
  if(!expectedPins || typeof expectedPins!=='object')throw new Error('Actual externally verified camera source pins required');
  const PINS = JSON.parse(JSON.stringify(expectedPins));
  for(const key of ['sourceCommit','tree'])if(!/^[a-f0-9]{40}$/.test(PINS[key]??''))throw new Error('Invalid actual source '+key);
  for(const key of ['sourceInputsSha256','packageFilesSha256','journeySha256','browserSeamSha256'])
    if(!/^[a-f0-9]{64}$/.test(PINS[key]??''))throw new Error('Invalid actual source '+key);
  if(!Number.isSafeInteger(PINS.sourceReview?.runId)||PINS.sourceReview.runId<=0
    ||!Number.isSafeInteger(PINS.sourceReview?.runAttempt)||PINS.sourceReview.runAttempt<=0)throw new Error('Actual source review run/attempt required');
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
  const recordKeys=['visualFrame','worldStep','worldStepOffset','routePhysicsSteps','routeSeconds','windowId','nativeCanvas','sourceCommit','player','cargo','controls','camera','bodyVertexProjection','conservativeEnvelope','materialProvenance','actualCameraCalls','readPurity','encodedBinding','scope'];
  const liftedRecordKeys=new Set(['nativeCanvas','sourceCommit','readPurity','scope']);
  const extremaOrder=['minX','maxX','minY','maxY','minDepth','maxDepth'];
  const same=(a,b,label)=>require(JSON.stringify(a)===JSON.stringify(b),'lossless record '+label+' mismatch');
  const exactKeys=(object,keys,label)=>require(object&&typeof object==='object'&&!Array.isArray(object)&&JSON.stringify(Object.keys(object))===JSON.stringify(keys),'lossless record '+label+' keys');
  const finiteTuple=(value,length,label)=>require(Array.isArray(value)&&value.length===length&&value.every(Number.isFinite),'lossless record '+label+' finite tuple');
  function createRecordEncoding({sourceCommit,nativeCanvas,appearanceSha256,meshDictionary}) {
    require(sourceCommit===PINS.sourceCommit,'lossless record actual source commit mismatch');
    exactKeys(nativeCanvas,['width','height'],'canvas');integer(nativeCanvas.width,1,4096,'record canvas width');integer(nativeCanvas.height,1,4096,'record canvas height');
    require(/^[a-f0-9]{64}$/.test(appearanceSha256),'lossless record actual appearance SHA required');
    require(Array.isArray(meshDictionary)&&meshDictionary.length>0&&meshDictionary.length<=100,'lossless record original mesh dictionary required');
    const ids=new Set();for(const mesh of meshDictionary){
      exactKeys(mesh,['meshUuid','vertices','bones','skinned'],'mesh dictionary');
      require(typeof mesh.meshUuid==='string'&&mesh.meshUuid.length>0&&!ids.has(mesh.meshUuid),'lossless record unique original mesh dictionary');ids.add(mesh.meshUuid);
      integer(mesh.vertices,1,96753,'original mesh vertices');integer(mesh.bones,0,15,'original mesh bones');require(typeof mesh.skinned==='boolean','original mesh skin flag');
    }
    return {kind:'tower41-lossless-native-records-v1',
      extremaOrder:clone(extremaOrder),extremaTuple:['meshIndex','vertex','world','ndc','depth'],
      eligibilityTuple:['meshIndex','objectVisible','materialVisible','layerMatch','renderEligible'],
      meshDictionary:clone(meshDictionary),recordConstants:{sourceCommit,nativeCanvas:clone(nativeCanvas),appearanceSha256,
        readPurity:{physicalStateUnchanged:true,lensAndLocalAppearancePoseUnchanged:true,attributeBytesUnchanged:true,appearanceSha256,derivedWorldAndSkeletonMatricesPrepared:true},
        bodySource:'Every current getVertexPosition of all original96753 vertices, including original inactive pulse/dock reserve. Separate object/material/layer eligibility counts do not assert pixel visibility or occlusion.',
        envelopeSource:'conservative eight-corner envelope; separate from actual original skin',
        callScope:'Compact counts and lens values from every actual observed camera method call at this native sample; detailed call paths are retained separately by the frozen baseline diagnostic.',
        rowScope:'actual selected visual-step optical diagnostic; no independent render/pixel or full camera acceptance'}};
  }
  function validateRecordEncoding(encoding,identity,canvas) {
    require(encoding?.kind==='tower41-lossless-native-records-v1','unsupported lossless record encoding');
    const constants=encoding.recordConstants;
    same(encoding,createRecordEncoding({sourceCommit:constants?.sourceCommit,nativeCanvas:constants?.nativeCanvas,appearanceSha256:constants?.appearanceSha256,meshDictionary:encoding.meshDictionary}),'fixed encoding header');
    if(identity){same(encoding.meshDictionary,identity.meshes,'independent mesh dictionary/identity');
      require(constants.appearanceSha256===identity.initialAppearanceSha256&&constants.appearanceSha256===identity.finalAppearanceSha256,'lossless record independently measured appearance/identity mismatch');}
    if(canvas)same(constants.nativeCanvas,canvas,'actual canvas/header');
    return encoding;
  }
  function expandRecord(compact,encoding) {
    validateRecordEncoding(encoding);
    exactKeys(compact,recordKeys.filter(key=>!liftedRecordKeys.has(key)),'compact row');
    require(compact.windowId==='actual-native-capture'||compact.windowId==='actual-terminal-native-capture','lossless record actual capture window');
    exactKeys(compact.encodedBinding,['encodedFrame','visualFrame','terminal','source'],'actual encoded binding');
    integer(compact.encodedBinding.encodedFrame,0,6000,'actual encoded binding index');integer(compact.encodedBinding.visualFrame,0,89999,'actual encoded binding frame');
    require(compact.encodedBinding.visualFrame===compact.visualFrame&&typeof compact.encodedBinding.terminal==='boolean'
      &&compact.encodedBinding.terminal===(compact.windowId==='actual-terminal-native-capture')
      &&compact.encodedBinding.source==='actual encoder/capture event supplied by external harness','lossless record actual capture binding/window');
    const constants=encoding.recordConstants,expanded={};
    for(const key of recordKeys){
      if(key==='nativeCanvas')expanded[key]=clone(constants.nativeCanvas);
      else if(key==='sourceCommit')expanded[key]=constants.sourceCommit;
      else if(key==='readPurity')expanded[key]=clone(constants.readPurity);
      else if(key==='scope')expanded[key]=constants.rowScope;
      else expanded[key]=clone(compact[key]);
    }
    const projection=expanded.bodyVertexProjection;
    exactKeys(projection.extremaWitnesses,extremaOrder,'six extrema');
    for(const key of extremaOrder){const t=projection.extremaWitnesses[key];
      require(Array.isArray(t)&&t.length===5,'lossless record extrema tuple length');integer(t[0],0,encoding.meshDictionary.length-1,'actual extrema mesh index');
      const mesh=encoding.meshDictionary[t[0]];integer(t[1],0,mesh.vertices-1,'actual extrema vertex index');finiteTuple(t[2],3,'world');finiteTuple(t[3],3,'NDC');finite(t[4],'actual extrema depth');
      projection.extremaWitnesses[key]={meshUuid:mesh.meshUuid,vertex:t[1],world:clone(t[2]),ndc:clone(t[3]),depth:t[4]};
    }
    require(Array.isArray(projection.renderEligibility)&&projection.renderEligibility.length===encoding.meshDictionary.length,'lossless record all mesh eligibility tuples');
    projection.renderEligibility=projection.renderEligibility.map((t,index)=>{
      require(Array.isArray(t)&&t.length===5&&t[0]===index&&t.slice(1).every(value=>typeof value==='boolean'),'lossless record exact ordered eligibility tuple');
      const mesh=encoding.meshDictionary[index];return {meshUuid:mesh.meshUuid,vertices:mesh.vertices,objectVisible:t[1],materialVisible:t[2],layerMatch:t[3],renderEligible:t[4]};
    });
    require(projection.source===undefined&&expanded.conservativeEnvelope.source===undefined&&expanded.actualCameraCalls.scope===undefined,'lossless record duplicated lifted source/scope');
    projection.source=constants.bodySource;expanded.conservativeEnvelope.source=constants.envelopeSource;expanded.actualCameraCalls.scope=constants.callScope;
    return expanded;
  }
  function compactRecord(row,encoding) {
    validateRecordEncoding(encoding);exactKeys(row,recordKeys,'actual row');
    const constants=encoding.recordConstants;
    same(row.nativeCanvas,constants.nativeCanvas,'emitted actual canvas');same(row.sourceCommit,constants.sourceCommit,'emitted actual source');same(row.readPurity,constants.readPurity,'emitted actual purity/hash');
    same(row.scope,constants.rowScope,'emitted row scope');same(row.bodyVertexProjection.source,constants.bodySource,'emitted body source');same(row.conservativeEnvelope.source,constants.envelopeSource,'emitted proxy source');same(row.actualCameraCalls.scope,constants.callScope,'emitted camera call scope');
    const compact=clone(row);for(const key of liftedRecordKeys)delete compact[key];
    const projection=compact.bodyVertexProjection;exactKeys(projection.extremaWitnesses,extremaOrder,'emitted six extrema');
    for(const key of extremaOrder){const witness=projection.extremaWitnesses[key];exactKeys(witness,['meshUuid','vertex','world','ndc','depth'],'emitted extrema witness');
      const index=encoding.meshDictionary.findIndex(mesh=>mesh.meshUuid===witness.meshUuid);integer(index,0,encoding.meshDictionary.length-1,'emitted original mesh index');
      projection.extremaWitnesses[key]=[index,witness.vertex,witness.world,witness.ndc,witness.depth];
    }
    require(Array.isArray(projection.renderEligibility)&&projection.renderEligibility.length===encoding.meshDictionary.length,'emitted complete mesh eligibility');
    projection.renderEligibility=projection.renderEligibility.map((mesh,index)=>{
      exactKeys(mesh,['meshUuid','vertices','objectVisible','materialVisible','layerMatch','renderEligible'],'emitted original eligibility');
      require(mesh.meshUuid===encoding.meshDictionary[index].meshUuid&&mesh.vertices===encoding.meshDictionary[index].vertices,'emitted original eligibility dictionary changed');
      return [index,mesh.objectVisible,mesh.materialVisible,mesh.layerMatch,mesh.renderEligible];
    });
    delete projection.source;delete compact.conservativeEnvelope.source;delete compact.actualCameraCalls.scope;
    same(expandRecord(compact,encoding),row,'complete exact value/order round trip');
    return compact;
  }
  function snapshotPortalFrames(frames) {
    require(Array.isArray(frames)&&frames.length===2,'actual two portal frame slots required');
    return frames.map(frame=>frame?{
      position:array(frame.position,3,'portal position'),normal:array(frame.normal,3,'portal normal'),
      quaternion:array(frame.quaternion,4,'portal quaternion'),
      width:finite(frame.width,'portal width'),height:finite(frame.height,'portal height'),
    }:null);
  }
  function validateIdentity(identity, buildInfo) {
    require(identity && buildInfo, 'actual source receipt and fetched build-info required');
    for (const key of ['sourceCommit', 'tree', 'sourceInputsSha256', 'packageFilesSha256'])
      require(identity[key] === PINS[key], 'externally verified ' + key + ' mismatch');
    require(identity.sourceReview?.runId === PINS.sourceReview.runId
      && identity.sourceReview?.runAttempt === PINS.sourceReview.runAttempt, 'exact SOURCE run/attempt required');
    require(buildInfo.commit === identity.sourceCommit
      && buildInfo.sourceInputsSha256 === identity.sourceInputsSha256
      && buildInfo.packageFilesSha256 === identity.packageFilesSha256, 'actual build-info/source/package mismatch');
    return clone(identity);
  }
  function normalizeOptions(options = {}) {
    require(options && typeof options === 'object' && !Array.isArray(options),'options object required');
    const result = {maxRecords:options.maxRecords??6001,maxShots:options.maxShots??64,
      maxFrames:options.maxFrames??90000,maxPayloadBytes:options.maxPayloadBytes??24000000,
      width:options.width??640,height:options.height??360,stride:options.stride??15,
      expectedInitialWorldStepOffset:options.expectedInitialWorldStepOffset??null};
    integer(result.maxRecords,1,6001,'maxRecords');integer(result.maxShots,1,64,'maxShots');
    integer(result.maxFrames,1,90000,'maxFrames');integer(result.maxPayloadBytes,1024,24000000,'payload bytes');
    integer(result.width,1,4096,'width');integer(result.height,1,4096,'height');integer(result.stride,1,60,'stride');
    if(result.expectedInitialWorldStepOffset!==null)integer(result.expectedInitialWorldStepOffset,0,10000,'initial world-step offset');
    require(Math.ceil(result.maxFrames/result.stride)+1<=result.maxRecords,'capture declaration exceeds record budget');
    return result;
  }
  function selectedWindow(frame,options) {
    integer(frame,0,options.maxFrames-1,'visual frame');
    return frame%options.stride===0?{id:'actual-native-capture'}:null;
  }
  function advanceClock(previous,state,worldStep,options) {
    integer(state?.visualFrame,0,options.maxFrames-1,'actual visualFrame');integer(worldStep,0,200000,'actual worldStep');
    finite(state.seconds,'route physics seconds');const frame=state.visualFrame;
    require(frame===(previous?previous.visualFrame+1:0),'all actual route frames must be consecutive from zero');
    const routePhysicsSteps=Math.round(state.seconds*120);
    require(Math.abs(routePhysicsSteps-state.seconds*120)<1e-7,'actual120Hz route clock mismatch');
    const increment=routePhysicsSteps-(previous?.routePhysicsSteps??0);
    require(increment===2||(increment===1&&state.state==='won'),'two real world steps except the actual terminal won step required');
    const offset=worldStep-routePhysicsSteps;require(offset>=0,'world clock precedes route clock');
    if(previous)require(worldStep===previous.worldStep+increment&&offset===previous.worldStepOffset,'actual fixed world steps omitted/repeated');
    if(options.expectedInitialWorldStepOffset!==null)require(offset===options.expectedInitialWorldStepOffset,'initial clock binding mismatch');
    return {visualFrame:frame,worldStep,worldStepOffset:offset,routePhysicsSteps,routeSeconds:state.seconds};
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

    function captureAuthoredMaterialStyle(material) {
      return (Array.isArray(material)?material:[material]).map(source=>({source,
        scalars:Object.fromEntries(['opacity','transparent','alphaTest','alphaHash','alphaToCoverage','depthWrite','depthTest','colorWrite','side','visible','wireframe','roughness','metalness','emissiveIntensity','intensity','transmission','thickness','envMapIntensity'].map(key=>[key,source[key]])),
        colors:Object.fromEntries(['color','emissive','specular','attenuationColor'].map(key=>[key,source[key]?.isColor?source[key].toArray():null])),
        textures:Object.fromEntries(['map','normalMap','roughnessMap','metalnessMap','emissiveMap','alphaMap','bumpMap','displacementMap','aoMap','envMap','lightMap'].map(key=>[key,source[key]])),
        onBeforeCompile:source.onBeforeCompile,customProgramCacheKey:source.customProgramCacheKey,
        vertexShader:source.vertexShader,fragmentShader:source.fragmentShader,uniforms:source.uniforms}));
    }
    function validateMaterialProvenance(g,refs,row) {
      require(Array.isArray(row.authoredMaterialStyle),'initial authored material style receipt missing');
      for(const style of row.authoredMaterialStyle){const source=style.source;require(Object.entries(style.scalars).every(([key,value])=>source[key]===value)
        &&Object.entries(style.colors).every(([key,value])=>value===null?!source[key]?.isColor:source[key]?.isColor&&source[key].toArray().every((n,index)=>n===value[index]))
        &&Object.entries(style.textures).every(([key,value])=>source[key]===value)
        &&source.onBeforeCompile===style.onBeforeCompile&&source.customProgramCacheKey===style.customProgramCacheKey
        &&source.vertexShader===style.vertexShader&&source.fragmentShader===style.fragmentShader&&source.uniforms===style.uniforms,'original authored material style changed: '+row.mesh.uuid);}
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
      renderer: g.renderer, portalActors:g.portalActors, scene:g.scene, device:g.heldDevice, level: g.firstLevel, portals: g.portals, shots: g.portalShots};
    require(refs.world && refs.renderer?.domElement && refs.cargoBody?.mass === 3.2, 'actual native renderer/world/original 3.2kg cargo required');
    require(refs.renderer.isWebGLRenderer===true&&typeof refs.renderer.getContext==='function','actual production WebGLRenderer required');
    refs.context=refs.renderer.getContext();require(refs.context&&typeof refs.context.isContextLost==='function'&&!refs.context.isContextLost(),'actual live native WebGL context required');
    if(config.expectedInitialWorldStepOffset===null)config.expectedInitialWorldStepOffset=integer(refs.world.stepnumber,0,10000,'actual initial world-step offset');
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
        material: mesh.material,authoredMaterialStyle:captureAuthoredMaterialStyle(mesh.material), vertices: position.count,getVertexPosition:mesh.getVertexPosition,
        bindMatrix:mesh.bindMatrix,bindMatrixElements:mesh.bindMatrix?.elements.slice()??null,
        bindMatrixInverse:mesh.bindMatrixInverse,bindMode:mesh.bindMode,
        boneInverses:skeleton?.boneInverses.map(matrix=>({matrix,elements:matrix.elements.slice()}))??[]});
    });
    const nodeParents=nodes.map(node=>({node,parent:node.parent}));
    const vertices = meshes.reduce((n, m) => n + m.vertices, 0);
    require(vertices === 96753 && boneSet.size === 15 && Math.max(...meshes.map(m => m.bones.length)) === 15, 'every original 96753 vertex and 15 bone identities required');
    const animatorBones=refs.animator.bones,animatorBoneEntries=Object.entries(animatorBones??{});
    require(animatorBoneEntries.length===15&&animatorBoneEntries.every(([,bone])=>boneSet.has(bone)),
      'actual animator must use the same fifteen original skeleton bones');
    const resets = {resetRun: 0, respawn: 0, resetCargo: 0, levelReset: 0, pendulumReset: 0};
    const records = [], shotRequests = [], encodedBindings = [], wrappers = [], sweepFrames = new Map();
    let insideFit = false;
    let clock = null, finished = false, disposed = false, busy = false, payloadBytes = 0, callsAttached = false, recordEncoding=null;
    function liveIdentity() {
      require(!disposed && g.physics === refs.physics && g.physics.world === refs.world && g.camera === refs.camera
        && g.cameraRig === refs.rig && g.playerPosition === refs.playerPosition && g.playerGroup === refs.root
        && g.playerVisual === refs.visual && g.animator === refs.animator && g.cargo === refs.cargo
        && g.physics.cargoBody === refs.cargoBody && g.cargo.group === refs.cargoGroup && g.cargo.visual === refs.cargoVisual
        && g.firstLevel === refs.level && g.portals === refs.portals && g.portalShots === refs.shots && g.renderer === refs.renderer && g.scene===refs.scene && g.heldDevice===refs.device,
      'actual original actor/world/lens identity changed');
      require(refs.cargoBody.mass === 3.2 && refs.cargoBody.shapes.length === cargoShapes.length
        && cargoShapes.every((shape, i) => refs.cargoBody.shapes[i] === shape)
        && array(cargoShapes[0].halfExtents,3,'current cargo half').every(v=>v===.39)
        && refs.cargoBody.world===refs.world&&refs.world.bodies.includes(refs.cargoBody), 'original cargo body/shape/world ownership changed');
      require(refs.root.scale.x===1&&refs.root.scale.y===1&&refs.root.scale.z===1,'original player root scale must staycanonical');
      require(refs.animator.bones===animatorBones&&Object.keys(animatorBones).length===15
        && animatorBoneEntries.every(([name,bone])=>animatorBones[name]===bone),'original animator bones replaced');
      const currentMeshes=[];refs.visual.traverse(node=>{if(node.isMesh)currentMeshes.push(node);});
      require(currentMeshes.length===meshes.length&&currentMeshes.every(mesh=>meshes.some(row=>row.mesh===mesh)),
        'current original visual meshes were added/removed; no current vertex may be omitted');
      require(nodeParents.every(({node,parent})=>node===refs.device?.attachment
        ? node.parent===animatorBones.HandR||node.parent===animatorBones.Body : node.parent===parent),
        'original actor hierarchy changed beyond the original hand/body holster socket');
      for (const row of meshes) {
        validateMaterialProvenance(g,refs,row);
        const expectedBindInverse=row.bindMatrixInverse&&row.bindMode!=='attached'?row.bindMatrix.clone().invert().elements:null;
        require(row.mesh.bindMatrix===row.bindMatrix&&row.mesh.bindMatrixInverse===row.bindMatrixInverse
          &&(!row.bindMatrix||row.bindMatrix.elements.every((value,index)=>value===row.bindMatrixElements[index]))
          &&row.mesh.bindMode===row.bindMode
          &&(!row.bindMatrixInverse||row.bindMatrixInverse.elements.every((value,index)=>Number.isFinite(value)&&(expectedBindInverse===null||Math.abs(value-expectedBindInverse[index])<1e-8)))
          &&row.boneInverses.length===(row.skeleton?.boneInverses.length??0)
          &&row.boneInverses.every(({matrix,elements},index)=>row.skeleton.boneInverses[index]===matrix&&matrix.elements.every((value,i)=>value===elements[i])),
          'original bind mode/matrix/bone inverses changed, or attached inverse cache contradicts its world matrix');
        require(row.mesh.geometry === row.geometry && row.geometry.attributes.position === row.position
          && row.position.count === row.vertices && row.mesh.skeleton === row.skeleton  && row.mesh.getVertexPosition===row.getVertexPosition,
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
      require(refs.renderer.getContext()===refs.context&&!refs.context.isContextLost(),'original native WebGL context changed/lost');
      require(refs.renderer.domElement.width === config.width && refs.renderer.domElement.height === config.height,
        'actual native canvas dimensions changed');
      require(Math.abs(refs.camera.aspect - config.width / config.height) < 1e-8, 'actual canvas/lens aspect mismatch');
    }
    function materialProvenanceSummary() {
      const rows=meshes.map(row=>validateMaterialProvenance(g,refs,row));
      const clipped=rows.filter(row=>row.kind==='original-portal-actor-owned-clipping-material');
      return {validatedMeshes:rows.length,originalAuthoredMeshes:rows.length-clipped.length,ownedClippedMeshes:clipped.length,
        originalStylesTexturesAndProgramsPreserved:true,activeEntryIndex:clipped.length?refs.playerPortalActor.entryIndex:null,
        sourcePlane:clipped.length?[...refs.playerPortalActor.sourcePlane.normal.toArray(),refs.playerPortalActor.sourcePlane.constant]:null};
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
        portals: snapshotPortalFrames(refs.portals.portals),
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
      const size = jsonBytes(record);require(size <= 100000, 'single record exceeds100KB');
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
      const halfWidth=refs.rig.confinedFraming&&refs.rig.viewUp.y>=Math.cos(.01)?.85:.65;
      for (const x of [-halfWidth,halfWidth]) for (const y of [-1.52,1.52]) for (const z of [-halfWidth,halfWidth]) {
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
      const renderEligibility=[];let renderEligibleVertices=0,renderEligibleOutsideLensCount=0;
      for(const row of meshes){
        let objectVisible=true;for(let node=row.mesh;node;node=node.parent)if(node.visible===false){objectVisible=false;break;}
        const materials=Array.isArray(row.mesh.material)?row.mesh.material:[row.mesh.material];
        const materialVisible=materials.some(material=>material.visible!==false),layerMatch=refs.camera.layers.test(row.mesh.layers);
        const renderEligible=objectVisible&&materialVisible&&layerMatch;
        renderEligibility.push({meshUuid:row.mesh.uuid,vertices:row.vertices,objectVisible,materialVisible,layerMatch,renderEligible});
        for(let i=0;i<row.vertices;i++){
          row.mesh.getVertexPosition(i,point).applyMatrix4(row.mesh.matrixWorld);
          view.copy(point).applyMatrix4(refs.camera.matrixWorldInverse);const depth=-view.z,world=point.toArray();
          const ndc=point.project(refs.camera).toArray();
          addProjection(p,{ndc,depth,near:refs.camera.near,witness:{meshUuid:row.mesh.uuid,vertex:i,world,ndc,depth}});
          if(renderEligible){renderEligibleVertices++;if(depth<=0||Math.abs(ndc[0])>1||Math.abs(ndc[1])>1||ndc[2]<-1||ndc[2]>1)renderEligibleOutsideLensCount++;}
        }
      }
      require(p.vertices===96753,'an original current skinned vertex was omitted');
      return {...finishProjection(p),bones:15,renderEligibility,renderEligibleVertices,renderEligibleOutsideLensCount,
        renderEligibleInsideLens:renderEligibleOutsideLensCount===0,
        source:'Every current getVertexPosition of all original96753 vertices, including original inactive pulse/dock reserve. Separate object/material/layer eligibility counts do not assert pixel visibility or occlusion.'};
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
        for(const row of meshes)if(row.bindMatrixInverse&&row.bindMode==='attached'){const expected=row.mesh.matrixWorld.clone().invert().elements;require(row.bindMatrixInverse.elements.every((value,index)=>Math.abs(value-expected[index])<1e-8),'prepared attached skin inverse cache contradicts original world matrix');}
        for (const skeleton of new Set(meshes.map(row=>row.skeleton).filter(Boolean))) skeleton.update();
        const actualLens = lens(), bodyVertexProjection = measureSkin();
        const {extremaWitnesses:proxyWitnesses,...conservativeEnvelope} = envelope();
        const camera={eye:actualLens.eye,quaternion:actualLens.quaternion,up:actualLens.up,fov:actualLens.fov,aspect:actualLens.aspect,near:actualLens.near,far:actualLens.far,
          matrixWorldInverse:actualLens.matrixWorldInverse,projection:actualLens.projection,
          rig:{vectors:{playerPivot:actualLens.rig.vectors.playerPivot,lookPoint:actualLens.rig.vectors.lookPoint,viewUp:actualLens.rig.vectors.viewUp},flags:actualLens.rig.flags,
            springs:{yaw:actualLens.rig.springs.yaw,pitch:actualLens.rig.springs.pitch,distance:actualLens.rig.springs.distance},clipping:actualLens.rig.clipping}};
        const actualCalls=sweepFrames.get(clock.visualFrame);
        const actualCameraCalls={constrainCalls:actualCalls?.constrain.length??0,pulledInCalls:actualCalls?.constrain.filter(c=>c.pulledIn).length??0,fitCalls:actualCalls?.fit.length??0,
          fit:(actualCalls?.fit??[]).map(c=>({beforeFov:c.before.fov,afterFov:c.after.fov,requiredFovBefore:c.before.envelope.requiredFovUncapped,requiredFovAfter:c.after.envelope.requiredFovUncapped})),
          scope:'Compact counts and lens values from every actual observed camera method call at this native sample; detailed call paths are retained separately by the frozen baseline diagnostic.'};
        const afterHash = await guardedRead(appearanceHash,liveIdentity);
        require(beforeHash === afterHash,'projection changed original attribute bytes');
        require(before === watchedState(),'read-projection preparation changed physical state/lens/local appearance pose');
        const record={...clock,windowId:w.id,nativeCanvas:{width:config.width,height:config.height},
          sourceCommit:identity.sourceCommit,player:{current:g.playerPosition.toArray(),previous:g.previousPlayerPosition.toArray(),
            velocity:g.playerVelocity.toArray(),grounded:g.playerGrounded,renderedPosition:refs.root.position.toArray(),
            renderedQuaternion:refs.root.quaternion.toArray(),renderedScale:refs.root.scale.toArray()},
          cargo:{bodyId:refs.cargoBody.id,shapeId:cargoShapes[0].id,held:g.heldCube===refs.cargo,position:refs.cargoBody.position.toArray(),
            quaternion:refs.cargoBody.quaternion.toArray(),velocity:refs.cargoBody.velocity.toArray(),
            angularVelocity:refs.cargoBody.angularVelocity.toArray(),masks:[refs.cargoBody.collisionFilterGroup,refs.cargoBody.collisionFilterMask]},
          controls:{yaw:g.yaw,pitch:g.pitch,aimHeld:Boolean(g.aimHeld),isAiming:g.isAiming(),facing:g.facing,
            shotPoseTime:g.shotPoseTime,shotAimPoint:g.shotAimPoint?.toArray()??null},
          camera,bodyVertexProjection,conservativeEnvelope,
          materialProvenance:materialProvenanceSummary(),
          actualCameraCalls,
          readPurity:{physicalStateUnchanged:true,lensAndLocalAppearancePoseUnchanged:true,attributeBytesUnchanged:true,
            appearanceSha256:afterHash,derivedWorldAndSkeletonMatricesPrepared:true},
          encodedBinding:clone(encodedBindings.find(b=>b.visualFrame===clock.visualFrame)??null),
          scope:'actual selected visual-step optical diagnostic; no independent render/pixel or full camera acceptance'};
        if(!recordEncoding){recordEncoding=createRecordEncoding({sourceCommit:record.sourceCommit,nativeCanvas:record.nativeCanvas,appearanceSha256:afterHash,
          meshDictionary:meshes.map(row=>({meshUuid:row.mesh.uuid,vertices:row.vertices,bones:row.bones.length,skinned:Boolean(row.skeleton)}))});
          const bytes=jsonBytes(recordEncoding);require(payloadBytes+bytes<=config.maxPayloadBytes,'encoding header payload budget');payloadBytes+=bytes;}
        addBounded(records,compactRecord(record,recordEncoding),config.maxRecords,'sample');
      } finally {if(clock)sweepFrames.delete(clock.visualFrame);busy=false;}
    }
    async function onFrame(state) {
      require(!finished && !busy,'frame arrived during/after collection');liveIdentity();
      require(callsAttached,'attach actual shot/reset/camera-call observers before the prefix');
      require((g.state === 'playing'||g.state==='won') && state.state===g.state,'actual ordinary playing/won state required');
      require(state.cargoBodyId === refs.cargoBody.id,'actual seam cargo identity mismatch');
      clock = advanceClock(clock,state,refs.world.stepnumber,config);
      const w = selectedWindow(clock.visualFrame,config);if (w) {require(encodedBindings.some(b=>b.visualFrame===clock.visualFrame),'native sample must come from an actual capture event');await collect(state,w);} else sweepFrames.delete(clock.visualFrame);
    }
    function wrapFrameHook(previous) {
      require(typeof previous === 'function','existing native __SINGULARITY_FRAME__ callback required');
      return preserveFrameHook(previous,onFrame,()=>!finished&&!disposed);
    }
    function attachCallObservers() {
      require(wrappers.length === 0,'call observers already installed');
      for(const [target,name]of [[g,'resetRun'],[g,'respawn'],[refs.physics,'resetCargo'],[refs.level,'reset'],[refs.level.machines.get('pendulum').state.cell,'reset'],[refs.rig,'constrain'],[refs.rig,'fitSilhouetteLens'],[g,'firePortal']])
        require(typeof target?.[name]==='function','all actual method targets must be available before installing wrappers: '+name);
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
        if(telemetry){require(telemetry.constrain.length<384,'actual sweep-call budget exhausted');
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
          projection:refs.camera.projectionMatrix.toArray(),aspect:refs.camera.aspect,near:refs.camera.near,far:refs.camera.far};
        const previousRequest=refs.shots.lastRequest;
        const requestWorldStep=refs.world.stepnumber,result=original.apply(this,args);
        const afterLens={eye:refs.camera.position.toArray(),q:refs.camera.quaternion.toArray(),fov:refs.camera.fov,
          projection:refs.camera.projectionMatrix.toArray(),aspect:refs.camera.aspect,near:refs.camera.near,far:refs.camera.far};
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
      integer(encodedFrame,0,6000,'actual encodedFrame');integer(visualFrame,0,config.maxFrames-1,'actual encoded visualFrame');
      require(typeof terminal==='boolean','terminal must be boolean');
      require(encodedBindings.every(b=>b.encodedFrame!==encodedFrame&&b.visualFrame!==visualFrame),'duplicate encoder binding');
      require(encodedBindings.length<6001,'encoder binding budget');
      require(encodedFrame===encodedBindings.length,'actual encoder indexes must be consecutive');
      require(terminal?visualFrame===clock?.visualFrame:visualFrame===encodedFrame*config.stride,'actual capture frame/stride mismatch');
      const binding={encodedFrame,visualFrame,terminal,source:'actual encoder/capture event supplied by external harness'};
      const size=jsonBytes(binding);require(payloadBytes+size<=config.maxPayloadBytes,'encoder payload budget');payloadBytes+=size;
      encodedBindings.push(binding);const record=records.find(r=>r.visualFrame===visualFrame);if(record)record.encodedBinding=clone(binding);
    }
    async function observeTerminalCapture(state) {
      require(clock&&state?.visualFrame===clock.visualFrame&&state.cargoBodyId===refs.cargoBody.id,
        'actual terminal sample must reuse the final route frame without advancing the world');
      require(!records.some(r=>r.visualFrame===clock.visualFrame),'terminal cannot duplicate an already observed capture');
      const binding=encodedBindings.find(b=>b.visualFrame===clock.visualFrame);
      require(binding?.terminal===true,'actual terminal capture event required');
      await collect(state,{id:'actual-terminal-native-capture'});
    }
    async function finish(routeResult) {
      require(!busy&&!finished,'finish once after completed observation');liveIdentity();
      require(clock&&routeResult?.pass===true&&routeResult.partial!==true&&g.state==='won'
        &&routeResult.sameCompanion===true,'actual complete ordinary castle result required');
      require(routeResult.frames===clock.visualFrame+1&&routeResult.physicsSteps===clock.routePhysicsSteps,'complete route final clocks mismatch');
      require(routeResult.resets===0&&routeResult.respawns===0&&routeResult.cargoResets===0,'route reset counters must stayzero');
      require(JSON.stringify(routeResult.metrics?.solvedIds)===JSON.stringify([
        'freight','sluice','optics','hoist','archive','flywheel','magnet','migrant','pendulum','inertia','crown']),
        'exact complete ordinary eleven-machine route required');
      const regularCount=Math.floor(clock.visualFrame/config.stride)+1;
      const hasTerminal=clock.visualFrame%config.stride!==0;
      require(records.length===regularCount+(hasTerminal?1:0)&&encodedBindings.length===records.length,
        'one actual original-skin measurement for every real native capture including terminal required');
      for(let i=0;i<records.length;i++)require(records[i].encodedBinding?.encodedFrame===i
        &&records[i].visualFrame===encodedBindings[i].visualFrame,'exact optical/native capture binding required');
      const before=watchedState(),finalAppearanceSha256=await guardedRead(appearanceHash,liveIdentity);
      require(before===watchedState()&&finalAppearanceSha256===initialAppearanceSha256,'final appearance/purity mismatch');
      const outside=records.filter(r=>!r.bodyVertexProjection.insideLens).map(r=>r.visualFrame);
      const report={kind:'actual-complete-native-camera-observer',sourceIdentity:identity,sourcePins:clone(PINS),
        runtimeObserved:true,accepted:false,fullRoomAccepted:false,allCameraAccepted:false,
        config,recordEncoding,records,shotRequests,encodedBindings,resetCounters:{...resets},
        route:{frames:routeResult.frames,physicsSteps:routeResult.physicsSteps,seconds:routeResult.seconds,
          pass:true,sameCompanion:true,solvedIds:routeResult.metrics.solvedIds},
        identity:{playerRootUuid:refs.root.uuid,playerVisualUuid:refs.visual.uuid,cargoUuid:refs.cargoGroup.uuid,
          cargoBodyId:refs.cargoBody.id,cargoShapeId:cargoShapes[0].id,vertices:96753,bones:15,
          meshes:meshes.map(row=>({meshUuid:row.mesh.uuid,vertices:row.vertices,bones:row.bones.length,skinned:Boolean(row.skeleton)})),
          initialAppearanceSha256,finalAppearanceSha256},
        encodedSamplesOutside:outside,allEncodedSamplesInside:outside.length===0,
        dataIntegrity:{everyActualNativeCaptureBound:true,allActualFramesAndWorldStepsObserved:true,readPurityGuardsPassed:true},
        payloadRecordBytes:payloadBytes,
        scope:'Every actual native capture at the declared rate plus terminal, original current animated skin and whole ordinary11-machine route. This collector does not prove pixel visibility, occlusion, every render frame or human/device usability.'};
      validateRecordEncoding(recordEncoding,report.identity,{width:config.width,height:config.height});
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
    return {onFrame,wrapFrameHook,attachCallObservers,bindEncodedSample,observeTerminalCapture,finish,dispose,
      configuration:clone(config),sourceIdentity:clone(identity),
      initialIdentity:{vertices,bones:boneSet.size,initialAppearanceSha256},
      status:()=>({runtimeObserved:clock!==null,framesObserved:clock?clock.visualFrame+1:0,records:records.length,
        shotRequests:shotRequests.length,resetCounters:{...resets},finished,disposed,accepted:false,allCameraAccepted:false})};
  }
  return {PINS:clone(PINS),validateIdentity,normalizeOptions,selectedWindow,advanceClock,
    projectionAccumulator,addProjection,finishProjection,preserveFrameHook,guardedRead,captureAuthoredMaterialStyle,validateMaterialProvenance,snapshotPortalFrames,
    createRecordEncoding,validateRecordEncoding,compactRecord,expandRecord,install};
}

export const TOWER41_NATIVE_CAMERA_OBSERVER_BROWSER_FACTORY = createTower41NativeCameraObserverApi.toString();

/** Decode stored lossless rows. This does not validate native provenance or lens
 * acceptance; callers use the source-bound assertion below for those checks. */
export function expandTower41NativeCameraObservation(observation,{sourceIdentity=observation?.sourceIdentity}={}) {
 if(observation?.recordEncoding===undefined)return observation;
 const api=createTower41NativeCameraObserverApi(sourceIdentity);
 api.validateRecordEncoding(observation.recordEncoding,observation.identity,{width:observation.config?.width,height:observation.config?.height});
 if(!Array.isArray(observation.records)||observation.records.length>6001)throw Error('Tower41 camera observer: bounded lossless record array required');
 return {...observation,records:observation.records.map(row=>api.expandRecord(row,observation.recordEncoding))};
}

/** Validate actual native optical data against independently verified receipts
 * and the completed recording. A sampled skin fit is separate from occlusion,
 * every-render-frame composition, physical-device and human acceptance. */
export function assertTower41NativeCameraObservation(observation,{sourceIdentity,bodyId,video,result}){
 const check=(condition,message)=>{if(!condition)throw Error('Tower41 native camera proof: '+message);};
 const storedObservation=observation,storedOutputBytes=new TextEncoder().encode(JSON.stringify(storedObservation)).byteLength;
 check(storedOutputBytes<=24000000,'actual stored compact JSON exceeds24M finite cap');
 observation=expandTower41NativeCameraObservation(observation,{sourceIdentity});
 check(observation?.kind==='actual-complete-native-camera-observer','actual complete native observer required');
 check(observation.runtimeObserved===true&&observation.accepted===false&&observation.fullRoomAccepted===false&&observation.allCameraAccepted===false,'honest declared observation scope required');
 for(const key of ['sourceCommit','tree','sourceInputsSha256','packageFilesSha256','journeySha256','browserSeamSha256']){check(typeof sourceIdentity?.[key]==='string'&&observation.sourceIdentity?.[key]===sourceIdentity[key],'exact actual '+key+' mismatch');check(observation.sourcePins?.[key]===sourceIdentity[key],'exact source pin '+key+' mismatch');}
 check(JSON.stringify(observation.sourceIdentity.sourceReview)===JSON.stringify(sourceIdentity.sourceReview)&&JSON.stringify(observation.sourcePins.sourceReview)===JSON.stringify(sourceIdentity.sourceReview),'actual source run/attempt mismatch');
 check(observation.identity?.cargoBodyId===bodyId&&observation.identity.vertices===96753&&observation.identity.bones===15,'same actual original cargo and complete player skin required');
 const meshRows=observation.identity.meshes;check(Array.isArray(meshRows)&&meshRows.length>0&&meshRows.length<=100,'actual original mesh manifest required');
 const meshMap=new Map();for(const mesh of meshRows){check(typeof mesh.meshUuid==='string'&&mesh.meshUuid.length>0&&!meshMap.has(mesh.meshUuid)&&Number.isSafeInteger(mesh.vertices)&&mesh.vertices>0&&Number.isSafeInteger(mesh.bones)&&mesh.bones>=0&&mesh.bones<=15&&typeof mesh.skinned==='boolean','invalid actual original mesh manifest');meshMap.set(mesh.meshUuid,mesh);}
 check(meshRows.reduce((sum,mesh)=>sum+mesh.vertices,0)===96753&&Math.max(...meshRows.map(mesh=>mesh.bones))===15,'complete actual original mesh/bone manifest required');
 check(/^[a-f0-9]{64}$/.test(observation.identity.initialAppearanceSha256)&&observation.identity.initialAppearanceSha256===observation.identity.finalAppearanceSha256,'unchanged actual geometry bytes required');
 check(observation.route?.pass===true&&observation.route.sameCompanion===true&&observation.route.frames===result.frames&&observation.route.physicsSteps===result.physicsSteps,'same actual completed route clocks required');
 check(JSON.stringify(observation.route.solvedIds)===JSON.stringify(result.metrics.solvedIds),'same actual completed mechanisms required');
 check(Object.values(observation.resetCounters??{}).length===5&&Object.values(observation.resetCounters).every(value=>value===0),'no route resets required');
 check(observation.dataIntegrity?.everyActualNativeCaptureBound===true&&observation.dataIntegrity.allActualFramesAndWorldStepsObserved===true&&observation.dataIntegrity.readPurityGuardsPassed===true,'complete read-only clocks and captures required');
 const normalized=createTower41NativeCameraObserverApi(sourceIdentity).normalizeOptions(observation.config);
 check(JSON.stringify(normalized)===JSON.stringify(observation.config),'exact finite collector configuration required');
 check(Number.isSafeInteger(observation.config.expectedInitialWorldStepOffset),'actual initial world step must be pinned');
 const outputBytes=storedOutputBytes;
 check(observation.outputJSONBytes===outputBytes&&outputBytes<=observation.config.maxPayloadBytes,'actual complete compact JSON byte count/budget mismatch');
 const rows=observation.records,bindings=observation.encodedBindings;
 check(Array.isArray(rows)&&Array.isArray(bindings)&&rows.length===video.frames&&bindings.length===video.frames,'every actual MP4 capture must have one optical row');
 check(Number.isSafeInteger(result.frames)&&result.frames>0&&result.frames<=observation.config.maxFrames&&rows.length<=observation.config.maxRecords&&Array.isArray(observation.shotRequests)&&observation.shotRequests.length<=observation.config.maxShots,'actual route/capture/shot counts exceed declared finite limits');
 check(observation.config.stride===video.stride&&observation.config.width===video.width&&observation.config.height===video.height,'actual recording format mismatch');
 const offStride=(result.frames-1)%video.stride!==0;
 check(video.terminalSample===offStride&&video.lastVisualFrame===result.frames-1,'actual final recorded route frame required');
 check(rows.length===Math.floor((result.frames-1)/video.stride)+1+(offStride?1:0),'complete native capture count mismatch');
 let maxFov=0;
 for(let i=0;i<rows.length;i++){
  const row=rows[i],binding=bindings[i],terminal=offStride&&i===rows.length-1;
  check(binding.encodedFrame===i&&binding.visualFrame===(terminal?result.frames-1:i*video.stride)&&binding.terminal===terminal,'actual consecutive capture event mismatch');
  check(JSON.stringify(row.encodedBinding)===JSON.stringify(binding)&&row.visualFrame===binding.visualFrame,'exact optical/capture binding mismatch');
  check(row.sourceCommit===sourceIdentity.sourceCommit&&row.cargo?.bodyId===bodyId,'original source/cargo changed during measurement');
  const vector=(value,size)=>Array.isArray(value)&&value.length===size&&value.every(Number.isFinite);
  const unitQuaternion=value=>vector(value,4)&&Math.abs(value.reduce((sum,n)=>sum+n*n,0)-1)<1e-8;
  check(row.cargo.shapeId===observation.identity.cargoShapeId&&vector(row.cargo.position,3)&&unitQuaternion(row.cargo.quaternion)&&vector(row.cargo.velocity,3)&&vector(row.cargo.angularVelocity,3)&&Array.isArray(row.cargo.masks)&&row.cargo.masks.length===2&&row.cargo.masks.every(Number.isSafeInteger),'actual original cargo shape/transform invalid');
  check(row.player&&vector(row.player.current,3)&&vector(row.player.previous,3)&&vector(row.player.velocity,3)&&typeof row.player.grounded==='boolean'&&vector(row.player.renderedPosition,3)&&unitQuaternion(row.player.renderedQuaternion)&&vector(row.player.renderedScale,3)&&row.player.renderedScale.every(value=>value===1),'actual original player transforms invalid');
  check(vector(row.camera.eye,3)&&unitQuaternion(row.camera.quaternion)&&vector(row.camera.up,3)&&Math.abs(row.camera.aspect-video.width/video.height)<1e-10&&Number.isFinite(row.camera.near)&&row.camera.near>0&&Number.isFinite(row.camera.far)&&row.camera.far>row.camera.near,'actual native camera intrinsics/pose invalid');
  const inverse=new THREE.Matrix4().compose(new THREE.Vector3().fromArray(row.camera.eye),new THREE.Quaternion().fromArray(row.camera.quaternion),new THREE.Vector3(1,1,1)).invert();
  const projectionMatrix=new THREE.PerspectiveCamera(row.camera.fov,row.camera.aspect,row.camera.near,row.camera.far).projectionMatrix;
  check(vector(row.camera.matrixWorldInverse,16)&&inverse.elements.every((value,index)=>Math.abs(value-row.camera.matrixWorldInverse[index])<1e-8),'actual camera inverse contradicts eye/quaternion');
  check(vector(row.camera.projection,16)&&projectionMatrix.elements.every((value,index)=>Math.abs(value-row.camera.projection[index])<1e-8),'actual camera projection contradicts intrinsics');
  const steps=i===rows.length-1?result.physicsSteps:2*(row.visualFrame+1),offset=observation.config.expectedInitialWorldStepOffset;
  check(row.routePhysicsSteps===steps&&Number.isFinite(row.routeSeconds)&&Math.abs(row.routeSeconds-steps/120)<1e-8&&row.worldStepOffset===offset&&row.worldStep===offset+steps,'actual sample world/120Hz route clock mismatch');
  check(row.bodyVertexProjection?.vertices===96753&&row.bodyVertexProjection.bones===15,'an actual original skinned vertex/bone was omitted');
  check(row.bodyVertexProjection.insideLens===true&&row.bodyVertexProjection.outsideLensCount===0&&row.bodyVertexProjection.behindCount===0&&row.bodyVertexProjection.nearCount===0,'original skin outside lens at visual frame '+row.visualFrame);
  const materialProof=row.materialProvenance;
  check(materialProof?.validatedMeshes===meshRows.length&&Number.isSafeInteger(materialProof.originalAuthoredMeshes)&&Number.isSafeInteger(materialProof.ownedClippedMeshes)&&materialProof.originalAuthoredMeshes>=0&&materialProof.ownedClippedMeshes>=0&&materialProof.originalAuthoredMeshes+materialProof.ownedClippedMeshes===meshRows.length&&materialProof.originalStylesTexturesAndProgramsPreserved===true,'original material/clipping provenance summary missing or invalid');
  check(materialProof.ownedClippedMeshes?((materialProof.activeEntryIndex===0||materialProof.activeEntryIndex===1)&&vector(materialProof.sourcePlane,4)&&Math.abs(materialProof.sourcePlane.slice(0,3).reduce((sum,value)=>sum+value*value,0)-1)<1e-8):(materialProof.activeEntryIndex===null&&materialProof.sourcePlane===null),'owned clipping plane/provenance contradiction');
  const projection=row.bodyVertexProjection;
  check(Array.isArray(projection.renderEligibility)&&projection.renderEligibility.length===meshRows.length,'every original mesh render eligibility must be recorded');
  const eligibilityIds=new Set();let eligibleVertices=0;for(const mesh of projection.renderEligibility){check(meshMap.has(mesh.meshUuid)&&!eligibilityIds.has(mesh.meshUuid)&&mesh.vertices===meshMap.get(mesh.meshUuid).vertices&&['objectVisible','materialVisible','layerMatch','renderEligible'].every(key=>typeof mesh[key]==='boolean')&&mesh.renderEligible===(mesh.objectVisible&&mesh.materialVisible&&mesh.layerMatch),'actual render eligibility manifest mismatch');eligibilityIds.add(mesh.meshUuid);if(mesh.renderEligible)eligibleVertices+=mesh.vertices;}
  check(projection.renderEligibleVertices===eligibleVertices&&eligibleVertices>0&&projection.renderEligibleOutsideLensCount===0&&projection.renderEligibleInsideLens===true,'actual render-eligible original geometry outside the lens');
  for(const key of ['minX','maxX','minY','maxY','minDepth','maxDepth'])check(Number.isFinite(projection[key]),'non-finite original skin extent '+key);
  check(projection.minX>=-1&&projection.maxX<=1&&projection.minX<=projection.maxX&&projection.minY>=-1&&projection.maxY<=1&&projection.minY<=projection.maxY&&projection.minDepth>row.camera.near&&projection.minDepth<=projection.maxDepth&&projection.maxDepth<=row.camera.far,'contradictory original skin extent at visual frame '+row.visualFrame);
  for(const [key,axis]of [['minX',0],['maxX',0],['minY',1],['maxY',1],['minDepth',null],['maxDepth',null]]){
   const witness=projection.extremaWitnesses?.[key],mesh=meshMap.get(witness?.meshUuid);
   check(mesh&&Number.isSafeInteger(witness.vertex)&&witness.vertex>=0&&witness.vertex<mesh.vertices&&Array.isArray(witness.world)&&witness.world.length===3&&witness.world.every(Number.isFinite)&&Array.isArray(witness.ndc)&&witness.ndc.length===3&&witness.ndc.every(Number.isFinite)&&Number.isFinite(witness.depth),'invalid actual original skin witness '+key);
   check(witness.ndc.every(value=>Math.abs(value)<=1)&&witness.depth>row.camera.near&&witness.depth<=row.camera.far,'original skin witness outside finite lens '+key);
   check(Math.abs((axis===null?witness.depth:witness.ndc[axis])-projection[key])<1e-9,'original skin extrema/witness mismatch '+key);
   const view=new THREE.Vector3().fromArray(witness.world).applyMatrix4(inverse),ndc=view.clone().applyMatrix4(projectionMatrix);
   check(Math.abs(-view.z-witness.depth)<1e-8&&ndc.toArray().every((value,index)=>Math.abs(value-witness.ndc[index])<1e-8),'actual world witness contradicts lens '+key);
  }
  check(row.readPurity?.physicalStateUnchanged===true&&row.readPurity.lensAndLocalAppearancePoseUnchanged===true&&row.readPurity.attributeBytesUnchanged===true&&row.readPurity.appearanceSha256===observation.identity.initialAppearanceSha256,'sample purity/hash mismatch');
  check(Number.isFinite(row.camera?.fov)&&row.camera.fov>0&&row.camera.fov<=120,'finite castle lens budget exceeded');maxFov=Math.max(maxFov,row.camera.fov);
  for(const [key,length]of [['eye',3],['quaternion',4],['matrixWorldInverse',16],['projection',16]])check(Array.isArray(row.camera[key])&&row.camera[key].length===length&&row.camera[key].every(Number.isFinite),'invalid actual lens '+key);
  check(row.controls?.aimHeld===false&&row.controls.isAiming===false&&Number.isFinite(row.controls.yaw)&&Number.isFinite(row.controls.pitch)&&Number.isFinite(row.controls.facing)&&Number.isFinite(row.controls.shotPoseTime)&&(row.controls.shotAimPoint===null||vector(row.controls.shotAimPoint,3)),'ordinary actual aim/control state invalid');
 }
 check(observation.allEncodedSamplesInside===true&&observation.encodedSamplesOutside.length===0,'honest all-sample skin results required');
 check(observation.shotRequests.length===result.shots,'every actual ordinary fire request must be observed');
 const previousShotSequence=[0,0];let previousShotWorldStep=-Infinity;
 for(const shot of observation.shotRequests){
  check(shot.returned===true&&shot.portalShotsRequestEmitted===true&&shot.lastRequestObserved?.accepted===true&&shot.lensUnchangedByRequest===true,'ordinary original request/lens mismatch');
  const request=shot.lastRequestObserved,after=shot.afterObservedVisualFrame,before=shot.beforeNextVisualFrame,offset=observation.config.expectedInitialWorldStepOffset;
  check((request.index===0||request.index===1)&&request.index===shot.inputChannel&&Number.isSafeInteger(request.sequence)&&request.sequence>previousShotSequence[request.index],'actual shot index/sequence is invalid or repeated');
  check(Number.isSafeInteger(shot.requestWorldStep)&&shot.requestWorldStep>=previousShotWorldStep,'actual shot clock is invalid or reordered');
  if(after===null){check(before===null&&shot.requestWorldStep===offset,'initial actual shot clock must precede the first observed frame');}
  else{
   check(Number.isSafeInteger(after)&&after>=0&&after<result.frames-1&&before===after+1,'actual shot must be anchored between consecutive route frames');
   const priorStep=offset+2*(after+1),nextStep=offset+(before===result.frames-1?result.physicsSteps:2*(before+1));
   check(shot.requestWorldStep>=priorStep&&shot.requestWorldStep<=nextStep,'actual shot clock is outside its observed frame interval');
  }
  previousShotSequence[request.index]=request.sequence;previousShotWorldStep=shot.requestWorldStep;
  const vector=(value,size)=>Array.isArray(value)&&value.length===size&&value.every(Number.isFinite),lens=shot.lens,ray=shot.actualCaptureRay;
  check(vector(shot.capturedTarget,3)&&vector(shot.capturedTargetNdc,3)&&vector(lens?.eye,3)&&vector(lens?.q,4)&&vector(lens?.projection,16)&&Number.isFinite(lens.fov)&&lens.fov>0&&lens.fov<=120&&Math.abs(lens.aspect-video.width/video.height)<1e-10&&Number.isFinite(lens.near)&&lens.near>0&&Number.isFinite(lens.far)&&lens.far>lens.near&&Math.abs(lens.q.reduce((sum,value)=>sum+value*value,0)-1)<1e-8,'actual captured shot target/lens missing or invalid');
  const q=new THREE.Quaternion().fromArray(lens.q),eye=new THREE.Vector3().fromArray(lens.eye),inverse=new THREE.Matrix4().compose(eye,q,new THREE.Vector3(1,1,1)).invert(),projection=new THREE.PerspectiveCamera(lens.fov,lens.aspect,lens.near,lens.far).projectionMatrix;
  check(projection.elements.every((value,index)=>Math.abs(value-lens.projection[index])<1e-8),'request lens contradicts actual perspective intrinsics');
  const view=new THREE.Vector3().fromArray(shot.capturedTarget).applyMatrix4(inverse),ndc=view.clone().applyMatrix4(projection);
  check(-view.z>lens.near&&-view.z<lens.far&&ndc.toArray().every((value,index)=>Math.abs(value-shot.capturedTargetNdc[index])<1e-8)&&Math.abs(ndc.x)<1e-7&&Math.abs(ndc.y)<1e-7&&Math.abs(ndc.z)<=1,'captured actual world shot target must reproject to the visible centre ray');
  check(vector(ray?.origin,3)&&vector(ray?.direction,3)&&new THREE.Vector3().fromArray(ray.origin).distanceTo(eye)<1e-8&&new THREE.Vector3().fromArray(ray.direction).distanceTo(new THREE.Vector3(0,0,-1).applyQuaternion(q))<1e-8,'actual captured shot ray contradicts unchanged request eye/quaternion');
 }
 return{pass:true,sampleRateHz:60/video.stride,encodedSamples:rows.length,verticesPerSample:96753,bones:15,measuredVertexSamples:rows.length*96753,maxFov,allEncodedOriginalSkinSamplesInside:true,originalCargoBodyId:bodyId,geometryBytesUnchanged:true,readOnlyPurity:true,ordinaryAimInputs:true,scope:'All original animated geometry (including inactive pulse/dock reserve) and its separately declared render-eligible subset fit every complete native MP4 capture at the declared rate plus terminal. Occlusion, every render frame, physical devices and human usability remain unaccepted.',allCameraAccepted:false};
}
