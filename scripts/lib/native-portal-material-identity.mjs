/** Browser-safe read-only guard for original authored model materials.
 * The production portal renderer temporarily assigns its own clipping clone.
 * Only that exact active registry record may substitute the original material. */
export function createNativePortalMaterialIdentityGuard(game,rows) {
 const check=(value,message)=>{if(!value)throw Error('Original material identity: '+message);};
 const controller=game.portalActors,registry=controller?.actors,actors=[...(registry??[])];
 check(controller&&registry&&actors.length>0,'actual portal actor registry required');
 const actorRoots=actors.map(actor=>actor.root),actorPlanes=actors.map(actor=>actor.sourcePlane),scene=controller.scene,portals=controller.portals;
 const scalarKeys=['opacity','transparent','alphaTest','alphaHash','alphaToCoverage','depthWrite','depthTest','colorWrite',
  'side','visible','wireframe','roughness','metalness','emissiveIntensity','intensity','transmission','thickness','envMapIntensity',
  'blending','blendSrc','blendDst','blendEquation','blendSrcAlpha','blendDstAlpha','blendEquationAlpha','blendAlpha','premultipliedAlpha','toneMapped','fog','flatShading','dithering','vertexColors',
  'normalMapType','displacementScale','displacementBias','bumpScale','ior','reflectivity','clearcoat','clearcoatRoughness','sheen','sheenRoughness','iridescence','iridescenceIOR','specularIntensity','attenuationDistance'];
 const colorKeys=['color','emissive','specular','attenuationColor','blendColor','sheenColor','specularColor'];
 const vectorKeys=['normalScale','clearcoatNormalScale'];
 const textureKeys=['map','normalMap','roughnessMap','metalnessMap','emissiveMap','alphaMap','bumpMap','displacementMap','aoMap','envMap','lightMap',
  'clearcoatMap','clearcoatNormalMap','clearcoatRoughnessMap','transmissionMap','thicknessMap','specularColorMap','specularIntensityMap'];
 const shaderWithClip=(shader,fragment)=>{
  const include=fragment?'clipping_planes_pars_fragment':'clipping_planes_pars_vertex';if(shader.includes(include))return shader;
  const body=fragment?'#include <clipping_planes_fragment>':'#if NUM_CLIPPING_PLANES > 0\n vClipPosition = -(modelViewMatrix * vec4(position, 1.0)).xyz;\n#endif';
  return '#include <'+include+'>\n'+shader.replace(/void\s+main\s*\(\s*\)\s*\{/,match=>match+'\n'+body+'\n');
 };
 const snapshot=source=>({source,type:source.type,scalars:scalarKeys.map(key=>source[key]),colors:colorKeys.map(key=>source[key]?.isColor?source[key].toArray():null),vectors:vectorKeys.map(key=>source[key]?.toArray?.()??null),
  textures:textureKeys.map(key=>source[key]),onBeforeCompile:source.onBeforeCompile,customProgramCacheKey:source.customProgramCacheKey,
  vertexShader:source.vertexShader,fragmentShader:source.fragmentShader,uniforms:source.uniforms,
  clippingPlanes:source.clippingPlanes,planes:[...(source.clippingPlanes??[])]});
 const protectedRows=rows.map(row=>({mesh:row.mesh,material:row.material,base:(Array.isArray(row.material)?row.material:[row.material]).map(snapshot)}));
 let invocations=0,originalChecks=0,ownedClippingChecks=0;
 function assertMaterials(){
  check(game.portalActors===controller&&controller.scene===scene&&controller.portals===portals&&controller.actors===registry&&registry.size===actors.length&&actors.every((actor,index)=>registry.has(actor)&&actor.root===actorRoots[index]&&actor.sourcePlane===actorPlanes[index]),'portal controller or actor handles replaced');
  invocations++;
  for(const row of protectedRows){
   for(const b of row.base){
    const source=b.source;
    check(source.type===b.type&&scalarKeys.every((key,index)=>Object.is(source[key],b.scalars[index])),'authored scalar style changed on '+row.mesh.uuid);
    check(colorKeys.every((key,index)=>b.colors[index]===null?!source[key]?.isColor:source[key]?.isColor&&source[key].toArray().every((value,i)=>value===b.colors[index][i])),'authored color style changed on '+row.mesh.uuid);
    check(vectorKeys.every((key,index)=>b.vectors[index]===null?!source[key]?.toArray:source[key]?.toArray&&source[key].toArray().every((value,i)=>value===b.vectors[index][i])),'authored normal-map scale changed on '+row.mesh.uuid);
    check(textureKeys.every((key,index)=>source[key]===b.textures[index]),'authored texture references changed on '+row.mesh.uuid);
    check(source.onBeforeCompile===b.onBeforeCompile&&source.customProgramCacheKey===b.customProgramCacheKey&&source.vertexShader===b.vertexShader&&source.fragmentShader===b.fragmentShader&&source.uniforms===b.uniforms,'authored shader program changed on '+row.mesh.uuid);
    check(source.clippingPlanes===b.clippingPlanes&&(source.clippingPlanes?.length??0)===b.planes.length&&b.planes.every((plane,index)=>source.clippingPlanes[index]===plane),'authored clipping planes changed on '+row.mesh.uuid);
   }
   const current=row.mesh.material;
   if(current===row.material){originalChecks++;continue;}
   const owner=actors.find(actor=>actor.active===true&&(actor.entryIndex===0||actor.entryIndex===1)&&actor.materials.some(record=>record.source===row.mesh));
   check(owner,'changed without an original active portal actor on '+row.mesh.uuid);
   const record=owner.materials.find(record=>record.source===row.mesh),base=row.base.map(b=>b.source),clipped=Array.isArray(current)?current:[current];
   check(record.original===row.material&&record.sourceClipped===current,'no exact owned clipping provenance on '+row.mesh.uuid);
   check(record.sourceList.length===base.length&&record.sourceMaterials.length===base.length&&clipped.length===base.length&&base.every((material,index)=>record.sourceList[index]===material&&record.sourceMaterials[index]===clipped[index]),'original and owned clipping material lists changed');
   check(owner.sourcePlane?.normal?.toArray().every(Number.isFinite)&&Number.isFinite(owner.sourcePlane.constant)&&Math.abs(owner.sourcePlane.normal.length()-1)<1e-6,'owned plane is nonfinite or nonunit');
   for(let index=0;index<base.length;index++){
    const source=base[index],target=clipped[index];
    check(source!==target&&source.type===target.type&&scalarKeys.every(key=>source[key]===undefined||target[key]===source[key]),'owned clone scalar style changed');
    check(colorKeys.every(key=>!source[key]?.isColor||target[key]?.isColor&&source[key].equals(target[key]))&&textureKeys.every(key=>source[key]===target[key]),'owned clone colors or textures changed');
    check(vectorKeys.every(key=>!source[key]?.toArray||target[key]?.toArray&&source[key].toArray().every((value,i)=>target[key].toArray()[i]===value)),'owned clone normal-map scale changed');
    check(target.onBeforeCompile===source.onBeforeCompile&&target.customProgramCacheKey===source.customProgramCacheKey,'owned clone shader callbacks changed');
    const planes=[...(source.clippingPlanes??[]),owner.sourcePlane];
    check(target.clipIntersection===false&&target.clipShadows===true&&target.clippingPlanes?.length===planes.length&&planes.every((plane,i)=>target.clippingPlanes[i]===plane),'clipping plane is not exactly actor-owned');
    if(source.isShaderMaterial)check(target.uniforms===source.uniforms&&target.clipping===true&&target.vertexShader===shaderWithClip(source.vertexShader,false)&&target.fragmentShader===shaderWithClip(source.fragmentShader,true),'owned shader clipping program or shared uniforms changed');
   }
   ownedClippingChecks++;
  }
  return true;
 }
 return {assertMaterials,diagnostics:()=>({pass:true,protectedMeshes:protectedRows.length,originalActorHandles:actors.length,invocations,originalChecks,ownedClippingChecks,
  scope:'Original authored scalar/color/texture/shader references plus only exact active production portal-actor clipping provenance; read-only checks.'})};
}
