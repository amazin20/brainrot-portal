import * as THREE from 'three';

/** Prepare the actual canvas/HDR, global-plane and split-actor variants during
 * loading. compileAsync alone doesn't initialize WebGLClipping's per-material
 * state, and compiling to the canvas doesn't compile the linear HDR program.
 * Tiny covered-pixel draws initialize those real paths before player input.
 * No portal is placed and no physical body, camera or quality setting changes. */
export async function warmPortalPipeline(game){
 const r=game.renderer;if(!r?.getRenderTarget||!r?.render)return;
 const target=r.getRenderTarget(),face=r.getActiveCubeFace?.()||0,mip=r.getActiveMipmapLevel?.()||0;
 const viewport=r.getViewport(new THREE.Vector4()),scissor=r.getScissor(new THREE.Vector4()),scissorTest=r.getScissorTest();
 const clipping=r.clippingPlanes,shadowAuto=r.shadowMap.autoUpdate,shadowNeeds=r.shadowMap.needsUpdate;
 const actors=[...(game.portalActors?.actors||[])],nodes=[];
 const quads=new THREE.Scene();quads.fog=game.scene.fog;
 const quadCamera=new THREE.OrthographicCamera(-1,1,1,-1,.01,5);
 const geometry=new THREE.PlaneGeometry(2,2),quad=new THREE.Mesh(geometry,null);
 quad.position.z=-1;quad.frustumCulled=false;quads.add(quad);
 const portalMaterials=(game.portals?._visuals||[]).flatMap(v=>[v.surface.material,v.rim.material,v.halo.material]);
 const effectMaterials=[];game.portalShots?.root?.traverse(o=>{if(o.material)effectMaterials.push(...(Array.isArray(o.material)?o.material:[o.material]));});
 const poolMaterials=[...new Set([...portalMaterials,...effectMaterials])];
 const links=new Map(portalMaterials.filter(m=>m.uniforms?.linked).map(m=>[m,m.uniforms.linked.value]));
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
    r.setRenderTarget(out);r.setViewport(0,0,8,8);r.setScissor(0,0,8,8);r.setScissorTest(true);
    r.clippingPlanes=plane?[neutral]:[];
    r.render(game.scene,game.camera);
    await new Promise(resolve=>setTimeout(resolve,0));
   }
  }
  // Hidden portal/charge pools are not rasterized by scene warmup. Exercise
  // their real materials on a covered pixel, including the HDR sampler. This
  // primes driver pipelines too, not just Three's program objects. No portal,
  // charge, actor pose, camera or simulation state is staged in the live scene.
  r.clippingPlanes=[];
  for(const target of game.portals.targets||[]){r.setRenderTarget(target);r.setScissorTest(false);r.clear?.();}
  for(const [out,plane]of [[null,false],[game.portals.bounceTarget,false],[null,true]]){
   if(out===undefined)continue;
   r.setRenderTarget(out);r.setViewport(0,0,8,8);r.setScissor(0,0,1,1);r.setScissorTest(true);r.clippingPlanes=plane?[neutral]:[];
   for(const material of poolMaterials){
    quad.material=material;if(links.has(material))material.uniforms.linked.value=1;
    r.render(quads,quadCamera);await new Promise(resolve=>setTimeout(resolve,0));
   }
  }
  // Keep asynchronous driver work behind the loading screen instead of the
  // first click. WebGL2 fences avoid a blocking gl.finish on the UI thread.
  const gl=r.getContext?.();
  if(gl?.fenceSync&&gl.clientWaitSync){
   const sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();
   if(sync)try{for(let i=0;i<15000&&!gl.isContextLost();i++){
    const result=gl.clientWaitSync(sync,0,0);
    if(result===gl.ALREADY_SIGNALED||result===gl.CONDITION_SATISFIED||result===gl.WAIT_FAILED)break;
    await new Promise(resolve=>setTimeout(resolve,8));
   }}finally{gl.deleteSync(sync);}
  }
 }finally{
  for(const [material,value]of links)material.uniforms.linked.value=value;
  geometry.dispose();quad.removeFromParent();
  for(const a of actors)game.portalActors._restore(a);
  for(const [o,value]of nodes)o.frustumCulled=value;
  r.clippingPlanes=clipping;r.shadowMap.autoUpdate=shadowAuto;r.shadowMap.needsUpdate=shadowNeeds||shadowAuto;
  r.setRenderTarget(target,face,mip);r.setViewport(viewport);r.setScissor(scissor);r.setScissorTest(scissorTest);
 }
 game.portalWarmup={ms:performance.now()-started,programsPrepared:(r.info?.programs?.length||0)-before,scope:'canvas, HDR portal views, transported camera, split actors and covered-pixel portal/charge pools'};
}
