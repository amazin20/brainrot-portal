import * as THREE from 'three';

const visibleInHierarchy=object=>{for(let p=object;p;p=p.parent)if(!p.visible)return false;return true;};
const nextFrame=()=>new Promise(resolve=>typeof requestAnimationFrame==='function'?requestAnimationFrame(resolve):resolve());
const renderable=object=>object.isMesh||object.isLine||object.isPoints||object.isSprite;
const collisionHierarchy=object=>{for(let p=object;p;p=p.parent)if(p.userData.collisionProxy)return true;return false;};
const BATCH_SIZE=24;

/** Warm the actual WebGL shader variants, not just material definitions.
 * Bound first-use shader/link/upload work to small renderable batches. Do not
 * precede this with a whole-scene compile: Three also traverses hidden meshes.
 * Each batch draws canvas/linear output with ordinary/exit clipping and warms
 * local-clipped shadow depth once. Global clipping does not affect shadows.
 * Run ONLY behind the loading screen, with the animation loop stopped.
 * No actor, camera or portal placement is advanced by this operation. */
export async function warmPortalRendering(game){
 const {renderer,scene,camera,portals,portalActors}=game;
 portals.prepare();portalActors.prepare();
 if(!renderer?.getContext)return;
 const gl=renderer.getContext();if(!gl)return;
 const start=performance.now(),states=[];
 scene.traverse(object=>states.push({object,visible:object.visible,frustumCulled:object.frustumCulled,
  layers:object.layers.mask,renderable:renderable(object),lit:object.isLight&&visibleInHierarchy(object),
  lodUpdate:object.isLOD?object.autoUpdate:undefined,shadowNeeds:object.shadow?.needsUpdate}));
 const objects=states.filter(state=>state.renderable&&!collisionHierarchy(state.object));
 const lights=states.filter(state=>state.lit);
 const shadowLights=lights.filter(state=>state.object.castShadow&&state.object.shadow&&state.object.layers.test(camera.layers));
 const saved={target:renderer.getRenderTarget(),face:renderer.getActiveCubeFace?.()||0,mip:renderer.getActiveMipmapLevel?.()||0,
  viewport:renderer.getViewport(new THREE.Vector4()),scissor:renderer.getScissor(new THREE.Vector4()),scissorTest:renderer.getScissorTest(),
  planes:renderer.clippingPlanes,autoShadow:renderer.shadowMap.autoUpdate,shadowNeeds:renderer.shadowMap.needsUpdate};
 const target=new THREE.WebGLRenderTarget(16,16,{type:portals.targets[0].texture.type,colorSpace:THREE.LinearSRGBColorSpace,depthBuffer:true});
 const cut=[...saved.planes,new THREE.Plane(new THREE.Vector3(0,1,0),1000000)];
 const batches=Math.max(1,Math.ceil(objects.length/BATCH_SIZE));let complete=false,draws=0;
 const checkContext=()=>{if(gl.isContextLost?.())throw new Error('WebGL context lost during portal warmup');};
 try{
  for(const state of states)if(state.object.isLOD)state.object.autoUpdate=false;
  scene.updateMatrixWorld(true);
  renderer.shadowMap.autoUpdate=false;
  for(let batchIndex=0;batchIndex<batches;batchIndex++){
   const chosen=new Set(objects.slice(batchIndex*BATCH_SIZE,(batchIndex+1)*BATCH_SIZE).map(state=>state.object));
   const ancestors=new Set();
   for(const object of [...chosen,...lights.map(state=>state.object)])for(let p=object.parent;p;p=p.parent)ancestors.add(p);
   // Hiding a Mesh ancestor would also hide selected children or live lights.
   // Keep those ancestors traversable while layers=0 suppresses their own draw.
   // This also permits geometry below a hidden light without activating it.
   for(const state of states){const o=state.object,selected=chosen.has(o),through=ancestors.has(o);
    if(o.isLight){o.visible=state.lit||through;o.layers.mask=state.lit?state.layers:0;}
    else if(state.renderable){o.visible=selected||through;o.layers.mask=selected?state.layers:0;}
    else o.visible=true;
    o.frustumCulled=false;
   }
   let first=true;
   for(const planes of [saved.planes,cut])for(const output of [target,null]){
    checkContext();renderer.clippingPlanes=planes;renderer.setRenderTarget(output);
    const ratio=renderer.getPixelRatio()||1;
    renderer.setViewport(0,0,16/ratio,16/ratio);renderer.setScissor(0,0,16/ratio,16/ratio);renderer.setScissorTest(true);
    // Both renderer and individual lights can have automatic shadows disabled.
    // Force the actual depth pass for every new batch, not merely the first one.
    renderer.shadowMap.needsUpdate=first;
    if(first)for(const state of shadowLights)state.object.shadow.needsUpdate=true;
    renderer.render(scene,camera);draws++;
    renderer.shadowMap.needsUpdate=false;first=false;
    gl.flush?.();checkContext();await nextFrame();
   }
  }
  // No pending first-use uploads or driver links may spill into the first shot.
  gl.finish();checkContext();complete=true;
 }finally{
  for(const {object,visible,frustumCulled,layers,lodUpdate,shadowNeeds}of states){
   object.visible=visible;object.frustumCulled=frustumCulled;object.layers.mask=layers;
   if(object.isLOD)object.autoUpdate=lodUpdate;
   if(object.shadow)object.shadow.needsUpdate=shadowNeeds;
  }
  renderer.clippingPlanes=saved.planes;renderer.shadowMap.autoUpdate=saved.autoShadow;
  // Batch depth renders overwrite the live maps. After success, let the next
  // ordinary scene render refresh the full maps even with autoUpdate=false.
  // A failed warmup restores the exact previous update flags.
  renderer.shadowMap.needsUpdate=complete?true:saved.shadowNeeds;
  if(complete)for(const state of shadowLights)state.object.shadow.needsUpdate=true;
  try{
   renderer.setRenderTarget(saved.target,saved.face,saved.mip);renderer.setViewport(saved.viewport);
   renderer.setScissor(saved.scissor);renderer.setScissorTest(saved.scissorTest);
  }finally{target.dispose();}
 }
 game.portalWarmup={milliseconds:performance.now()-start,programs:renderer.info.programs.length,
  renderables:objects.length,batches,batchSize:BATCH_SIZE,draws,
  variants:'batched canvas + linear portal target; ordinary + exit clipping; actor clipping and shadow depth per batch'};
}
