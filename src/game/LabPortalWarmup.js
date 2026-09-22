import * as THREE from 'three';

const visibleInHierarchy=object=>{for(let p=object;p;p=p.parent)if(!p.visible)return false;return true;};
const nextFrame=()=>new Promise(resolve=>typeof requestAnimationFrame==='function'?requestAnimationFrame(resolve):resolve());

/** Warm the actual WebGL shader variants, not just material definitions.
 * Three's compileAsync alone does not establish local/global clipping state,
 * the offscreen output mode, shadow depth variants or hidden effect geometry.
 * Run ONLY behind the loading screen, with the animation loop stopped.
 * No actor, camera or portal placement is advanced by this operation. */
export async function warmPortalRendering(game){
 const {renderer,scene,camera,portals,portalActors}=game;
 portals.prepare();portalActors.prepare();
 if(!renderer?.getContext)return;
 const start=performance.now(),states=[];
 scene.traverse(object=>states.push({object,visible:object.visible,frustumCulled:object.frustumCulled,lit:object.isLight&&visibleInHierarchy(object)}));
 const saved={target:renderer.getRenderTarget(),face:renderer.getActiveCubeFace?.()||0,mip:renderer.getActiveMipmapLevel?.()||0,
  viewport:renderer.getViewport(new THREE.Vector4()),scissor:renderer.getScissor(new THREE.Vector4()),scissorTest:renderer.getScissorTest(),
  planes:renderer.clippingPlanes,autoShadow:renderer.shadowMap.autoUpdate,shadowNeeds:renderer.shadowMap.needsUpdate};
 const target=new THREE.WebGLRenderTarget(16,16,{type:portals.targets[0].texture.type,colorSpace:THREE.LinearSRGBColorSpace,depthBuffer:true});
 const cut=[...saved.planes,new THREE.Plane(new THREE.Vector3(0,1,0),1000000)];
 try{
  // Reveal geometry for preloading only. Cloned/hidden lights must NOT change
  // the lighting signature used by the real scene. Collision proxies are not art.
  for(const state of states){const o=state.object;o.visible=o.isLight?state.lit:!o.userData.collisionProxy;o.frustumCulled=false;}
  scene.updateMatrixWorld(true);
  // A small real draw establishes WebGLClipping's state for each combination.
  // Both source and destination actor materials share these compiled programs.
  for(const planes of [saved.planes,cut])for(const output of [target,null]){
   renderer.clippingPlanes=planes;renderer.setRenderTarget(output);
   const ratio=renderer.getPixelRatio()||1;
   renderer.setViewport(0,0,16/ratio,16/ratio);renderer.setScissor(0,0,16/ratio,16/ratio);renderer.setScissorTest(true);
   renderer.render(scene,camera);
   // Shadow variants are identical for both colour output modes; warm once.
   renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;
   await nextFrame();
  }
  // No pending first-use uploads or driver links may spill into the first shot.
  renderer.getContext().finish();
 }finally{
  for(const {object,visible,frustumCulled}of states){object.visible=visible;object.frustumCulled=frustumCulled;}
  renderer.clippingPlanes=saved.planes;renderer.shadowMap.autoUpdate=saved.autoShadow;
  renderer.shadowMap.needsUpdate=true;
  renderer.setRenderTarget(saved.target,saved.face,saved.mip);renderer.setViewport(saved.viewport);
  renderer.setScissor(saved.scissor);renderer.setScissorTest(saved.scissorTest);target.dispose();
 }
 game.portalWarmup={milliseconds:performance.now()-start,programs:renderer.info.programs.length,variants:'canvas + linear portal target; ordinary + exit clipping; actor clipping and shadow depth'};
}
