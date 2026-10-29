import * as THREE from 'three';

const CAMERA_KEYS=['left','right','bottom','top','near','far'];
const WALL_RECEIVER='Observatory / recessed structural service bays';
const RECEIVER_LINE='shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias';
export const OBSERVATORY_SHADOW_POLICY=Object.freeze({
 revision:'room-fitted-observatory-shadow-v1',
 roomPadding:2,planePadding:1,depthPadding:2,
 normalTexels:1.5,minNormalBias:.035,maxNormalBias:.15,
});

/** Directional light position and bearing stay exactly as authored by the
 * enclosed-room kit. In particular, do not move an interior key above its
 * closed roof merely to cover the room behind that key's original near plane.
 * This fixes precision within the existing lit volume, not that older depth
 * coverage limitation. The signed rear depth is retained in the report.
 */
export function observatoryShadowPlan(light,kit,policy=OBSERVATORY_SHADOW_POLICY){
 const b=kit.bounds,p=policy.roomPadding;
 if(![b?.minX,b?.maxX,b?.minZ,b?.maxZ,kit.base,kit.ceiling].every(Number.isFinite)
   ||b.maxX<=b.minX||b.maxZ<=b.minZ||kit.ceiling<=kit.base)throw new Error('A finite enclosed room is required for observatory shadows');
 light.updateWorldMatrix(true,false);light.target.updateWorldMatrix(true,false);
 const view=new THREE.OrthographicCamera(),eye=light.getWorldPosition(new THREE.Vector3()),target=light.target.getWorldPosition(new THREE.Vector3());
 view.position.copy(eye);view.lookAt(target);view.updateMatrixWorld(true);
 const bounds=new THREE.Box3(),corners=[];
 for(const x of [b.minX-p,b.maxX+p])for(const y of [kit.base-p,kit.ceiling+p])for(const z of [b.minZ-p,b.maxZ+p]){
  const point=new THREE.Vector3(x,y,z).applyMatrix4(view.matrixWorldInverse);bounds.expandByPoint(point);corners.push(point.toArray());
 }
 const near=light.shadow.camera.near;
 const camera={left:Math.floor(bounds.min.x-policy.planePadding),right:Math.ceil(bounds.max.x+policy.planePadding),
  bottom:Math.floor(bounds.min.y-policy.planePadding),top:Math.ceil(bounds.max.y+policy.planePadding),
  near,far:Math.max(near+1,Math.ceil(-bounds.min.z+policy.depthPadding))};
 const worldTexel=Math.max((camera.right-camera.left)/light.shadow.mapSize.x,(camera.top-camera.bottom)/light.shadow.mapSize.y);
 const normalBias=policy.receiverNormalBias??light.shadow.normalBias;
 const depthBiasWorld=policy.depthBiasWorld??light.shadow.bias*(light.shadow.camera.far-light.shadow.camera.near);
 const wallNormalBias=Math.max(normalBias,THREE.MathUtils.clamp(worldTexel*policy.normalTexels,policy.minNormalBias,policy.maxNormalBias));
 return {revision:policy.revision,camera,worldTexel,
  normalBias,wallNormalBias,wallNormalExtra:wallNormalBias-normalBias,depthBiasWorld,
  bias:depthBiasWorld/(camera.far-camera.near),receiverPolicy:'vertical-service-bay-only',
  coverage:{corners,rearmostDepth:-bounds.max.z,farthestDepth:-bounds.min.z,preservesAuthoredNearPlane:true,fullRoomDepthCovered:-bounds.max.z>=near},
  lightPosition:eye.toArray(),lightTarget:target.toArray(),mapSize:light.shadow.mapSize.toArray()};
}

function extendWallReceiver(shader,uniform){
 const chunk=THREE.ShaderChunk.shadowmap_vertex;
 if(!shader.vertexShader.includes('#include <shadowmap_vertex>')||!chunk.includes(RECEIVER_LINE))
  throw new Error('Observatory wall precision requires the original Three.js directional shadow receiver chunk');
 shader.uniforms.observatoryWallShadowExtra=uniform;
 shader.vertexShader='uniform float observatoryWallShadowExtra;\n'+shader.vertexShader;
 // Only the shadow lookup position of these manufactured vertical faces
 // receives the larger offset. Horizontal support faces in the same merged
 // material retain the exact global offset, as do all actors and other floors.
 // Rendered positions, depth/caster passes and other light types are unchanged.
 const receiver=chunk.replace(RECEIVER_LINE,
  'shadowWorldNormal * (directionalLightShadows[ i ].shadowNormalBias + observatoryWallShadowExtra * (1.0 - smoothstep(0.75, 0.90, abs(shadowWorldNormal.y))))');
 shader.vertexShader=shader.vertexShader.replace('#include <shadowmap_vertex>',receiver);
}

/** Own this chapter's frustum and the private service-bay receiver hooks.
 * Global receiver offsets retain their previous world-space values. Quality owns map size,
 * enabled/castShadow and shadow targets. Refresh after an actual preset change
 * without allocating or disposing a warmed render target or moving the light.
 */
export function installObservatoryShadows(game,level){
 if(game.chamberEdition!=='foundation'||level.index<30||level.index>39||!game.keyLight?.isDirectionalLight)return null;
 if(level.observatoryShadow)return level.observatoryShadow;
 const light=game.keyLight,shadow=light.shadow,kit=level.workshop;
 const original={camera:Object.fromEntries(CAMERA_KEYS.map(key=>[key,shadow.camera[key]])),bias:shadow.bias,normalBias:shadow.normalBias};
 const policy={...OBSERVATORY_SHADOW_POLICY,receiverNormalBias:original.normalBias,depthBiasWorld:original.bias*(original.camera.far-original.camera.near)};
 const uniform={value:0},materials=new Map();let receiverMeshCount=0;
 (level.world?.root??kit.world?.root)?.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.visible||Array.isArray(mesh.material)||mesh.material?.name!==WALL_RECEIVER)return;
  const material=mesh.material;receiverMeshCount++;
  if(materials.has(material))return;
  // This named vertex-coloured material is created once per level by the
  // observatory builder. Own just its hooks; no extra material, geometry,
  // shadow map or mutation of imported actor materials is needed.
  const prior=material.onBeforeCompile,priorCache=material.customProgramCacheKey,cache=priorCache.call(material);
  const compile=function(shader,renderer){prior.call(this,shader,renderer);extendWallReceiver(shader,uniform);};
  const cacheKey=()=>cache+'|observatory-vertical-shadow-receiver-v1';
  materials.set(material,{prior,priorCache,compile,cacheKey});
  material.onBeforeCompile=compile;material.customProgramCacheKey=cacheKey;material.needsUpdate=true;
 });
 let disposed=false,current=null;
 const owner={
  refresh(){
   if(disposed||game.keyLight!==light)return current;
   current=observatoryShadowPlan(light,kit,policy);current.receiverMaterialCount=materials.size;current.receiverMeshCount=receiverMeshCount;
   uniform.value=current.wallNormalExtra;
   Object.assign(shadow.camera,current.camera);shadow.bias=current.bias;shadow.normalBias=current.normalBias;
   shadow.camera.updateProjectionMatrix();shadow.needsUpdate=true;return current;
  },
  release(){
   if(disposed)return;disposed=true;
   uniform.value=0;
   for(const [material,{prior,priorCache,compile,cacheKey}]of materials){
    if(material.onBeforeCompile===compile)material.onBeforeCompile=prior;
    if(material.customProgramCacheKey===cacheKey)material.customProgramCacheKey=priorCache;
    material.needsUpdate=true;
   }
   Object.assign(shadow.camera,original.camera);shadow.bias=original.bias;shadow.normalBias=original.normalBias;
   shadow.camera.updateProjectionMatrix();shadow.needsUpdate=true;
   if(level.observatoryShadow===owner)delete level.observatoryShadow;
  },
  get report(){return current;},get disposed(){return disposed;},
 };
 level.observatoryShadow=owner;owner.refresh();return owner;
}
