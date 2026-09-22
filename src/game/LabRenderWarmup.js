import * as THREE from 'three';

/** Prepare the actual canvas/HDR, global-plane and split-actor variants during
 * loading. compileAsync alone doesn't initialize WebGLClipping's per-material
 * state, and compiling to the canvas doesn't compile the linear HDR program.
 * The one-pixel draws initialize those real renderer paths before player input.
 * No portal is placed and no physical body, camera or quality setting changes. */
export async function warmPortalPipeline(game){
 const r=game.renderer;if(!r?.getRenderTarget||!r?.render)return;
 const target=r.getRenderTarget(),face=r.getActiveCubeFace?.()||0,mip=r.getActiveMipmapLevel?.()||0;
 const viewport=r.getViewport(new THREE.Vector4()),scissor=r.getScissor(new THREE.Vector4()),scissorTest=r.getScissorTest();
 const clipping=r.clippingPlanes,shadowAuto=r.shadowMap.autoUpdate,shadowNeeds=r.shadowMap.needsUpdate;
 const actors=[...(game.portalActors?.actors||[])],nodes=[];
 const neutral=new THREE.Plane(new THREE.Vector3(0,1,0),100000);
 const started=performance.now(),before=r.info?.programs?.length||0;
 try{
  // Offscreen geometry must warm too: otherwise the first portal view can be
  // the first time its material is rendered. Invisible collision proxies stay invisible.
  game.scene.traverse(o=>{if(o.isMesh){nodes.push([o,o.frustumCulled]);o.frustumCulled=false;}});
  r.shadowMap.autoUpdate=false;r.shadowMap.needsUpdate=true;
  for(const split of [false,true]){
   for(const a of actors){
    a.sourcePlane.copy(neutral);a.destinationPlane.copy(neutral);
    if(split){
     for(const record of a.materials)record.source.material=record.sourceClipped;
     a.clone.visible=true;
     a.clone.traverse(o=>{if(o.isLight)o.visible=false;});
    }else game.portalActors._restore(a);
   }
   for(const [out,plane]of [[null,false],[game.portals.targets[0],false],[null,true]]){
    r.setRenderTarget(out);r.setScissor(0,0,1,1);r.setScissorTest(true);
    r.clippingPlanes=plane?[neutral]:[];
    r.render(game.scene,game.camera);
    await new Promise(resolve=>setTimeout(resolve,0));
   }
  }
 }finally{
  for(const a of actors)game.portalActors._restore(a);
  for(const [o,value]of nodes)o.frustumCulled=value;
  r.clippingPlanes=clipping;r.shadowMap.autoUpdate=shadowAuto;r.shadowMap.needsUpdate=shadowNeeds||shadowAuto;
  r.setRenderTarget(target,face,mip);r.setViewport(viewport);r.setScissor(scissor);r.setScissorTest(scissorTest);
 }
 game.portalWarmup={ms:performance.now()-started,programsPrepared:(r.info?.programs?.length||0)-before,scope:'canvas, HDR portal views, transported camera and split actors'};
}
