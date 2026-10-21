import * as THREE from 'three';

/** Pigment and surface response on the one existing architectural skin.
 * Broad plinths separate walls from walking decks; restrained mineral variation
 * replaces the uniformly flat tint. No extra faces, lights or contact volumes. */
export function finishArchitecturalMaterials(game,level,roots){
 if(level.tower)return {materials:0,meshes:0};
 const portals=new Set(game.portalPanels||[]),protectedMaterials=new Set(),copies=new Map(),changed=[];
 for(const asset of game.assets?.values?.()||[])asset.traverse(n=>{
  for(const m of Array.isArray(n.material)?n.material:[n.material])if(m)protectedMaterials.add(m);
 });
 // A tile renderer may share a material with a porcelain master: never tint
 // that shared reference indirectly through another unmarked render owner.
 for(const mesh of portals)for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])protectedMaterials.add(m);
 const base=level.workshop?.base??level.base??0;
 function finish(source,role){
  if(copies.has(source))return copies.get(source);
  const material=source.clone(),prior=source.onBeforeCompile,priorKey=source.customProgramCacheKey.bind(source);
  const isFloor=role==='floor'||role==='service';
  material.name=source.name;material.userData={...source.userData,architecturalFinish:67};
  material.roughness=Math.max(source.roughness,isFloor?.82:.64);
  material.onBeforeCompile=(shader,renderer)=>{
   prior.call(material,shader,renderer);
   shader.uniforms.labFinishBase={value:base};
   shader.vertexShader='varying vec3 vLabFinishWorld;\nvarying vec3 vLabFinishNormal;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
    vec4 finishPosition=vec4(transformed,1.0);
    #ifdef USE_INSTANCING
     finishPosition=instanceMatrix*finishPosition;
    #endif
    vLabFinishWorld=(modelMatrix*finishPosition).xyz;
    vLabFinishNormal=inverseTransformDirection(transformedNormal,viewMatrix);`);
   shader.fragmentShader='varying vec3 vLabFinishWorld;\nvarying vec3 vLabFinishNormal;\nuniform float labFinishBase;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float finishHeight=max(0.0,vLabFinishWorld.y-labFinishBase);
    float finishVertical=1.0-smoothstep(.28,.70,abs(normalize(vLabFinishNormal).y));
    float finishPlinth=1.0-smoothstep(1.75,1.95,finishHeight);
    // Centimetre joints remain geometry. This broad two-tone painted band
    // does not create another grid or shimmer through the portal cameras.
    diffuseColor.rgb*=1.0-finishVertical*finishPlinth*.31;
    // The lower court is a darker working surface. Raised walking decks keep
    // their lighter mineral skin, so floor, platform and wall no longer merge
    // into one pale field even in the first grey laboratory.
    float finishCourt=1.0-smoothstep(.20,1.40,finishHeight);
    diffuseColor.rgb*=1.0-(1.0-finishVertical)*finishCourt*.14;
    float finishGrain=sin(vLabFinishWorld.x*.47+sin(vLabFinishWorld.z*.31))*sin(vLabFinishWorld.y*.39+vLabFinishWorld.z*.23);
    diffuseColor.rgb*=1.0+finishGrain*.016;
    diffuseColor.rgb*=mix(.91,1.0,smoothstep(0.0,8.0,finishHeight))*finishVertical+(1.0-finishVertical);`);
  };
  material.customProgramCacheKey=()=>priorKey()+'|architectural-plinth67';material.needsUpdate=true;copies.set(source,material);return material;
 }
 const worldRoot=level.world?.root||level.workshop?.world?.root;
 for(const root of roots)root.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.visible||mesh.userData?.collisionProxy||mesh.userData?.portalTile||mesh.userData?.portalable||portals.has(mesh))return;
  for(let n=mesh;n;n=n.parent)if(n.visible===false||(n!==worldRoot&&n.userData?.keepMaterial===true))return;
  const source=mesh.material;if(Array.isArray(source)||!source?.isMeshStandardMaterial||source.userData?.keepMaterial||source.visible===false||source.transparent||protectedMaterials.has(source))return;
  let role=source.userData?.architecturalRole;
  if(!role&&mesh.name==='Architectural coat / cassette')role='wall';
  if(!role&&/Structural laboratory wall|wall cassette/i.test(source.name))role='wall';
  if(!['wall','floor','shell','paint','service'].includes(role))return;
  // Do not recolour commissioned machinery. Its local cast/enamel/bronze
  // hierarchy belongs to the authored room rather than the building pigment.
  if(mesh.userData.visualAuditEarly||mesh.userData.visualAuditObservatory||mesh.userData.visualAuditMiddleShape||mesh.userData.visualAuditLateShape)return;
  changed.push({mesh,source,replacement:finish(source,role)});mesh.material=changed.at(-1).replacement;
 });
 // Mechanisms also resolve their walking material through these authored
 // dictionaries. Keep those references coherent with the finished drawing,
 // then restore them before the original world releases its resources.
 const bindings=[];
 for(const registry of new Set([level.workshop?.m,level.world?.materials,level.workshop?.world?.materials].filter(Boolean))){
  for(const [key,source]of Object.entries(registry))if(copies.has(source)){
   const replacement=copies.get(source);bindings.push({registry,key,source,replacement});registry[key]=replacement;
  }
 }
 let disposed=false;
 return {materials:copies.size,meshes:changed.length,dispose(){
  if(disposed)return;disposed=true;
  for(const {mesh,source,replacement}of changed)if(mesh.material===replacement)mesh.material=source;
  for(const {registry,key,source,replacement}of bindings)if(registry[key]===replacement)registry[key]=source;
  for(const material of copies.values())material.dispose();
 }};
}
