import * as THREE from 'three';
import {campaignTheme} from './LabCampaignThemes.js';

/** Restyle only authored architecture, not source models, portal porcelain,
 * interaction signals or moving-state materials. No colliders or puzzle state
 * are modified. Shared materials are copied into the room's lifetime. */
export function finishCampaignTheme(game,level,index,roots){
 if(game.chamberEdition!=='foundation')return level;
 const theme=campaignTheme(index),sourceMaterials=new Set(),roles=new Map(),copies=new Map();
 for(const asset of game.assets?.values?.()||[])asset.traverse(o=>{
  for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)sourceMaterials.add(m);
 });
 const kit=level.workshop,world=level.world||kit?.world;
 let architecturalInstances=0;
 const artistMaterials=world?.root?.userData?.browserArtMaterials;
 for(const [key,m]of Object.entries(artistMaterials||{})){
  if(['graphite','steel','blackSteel'].includes(key))roles.set(m,key==='graphite'?'wall':key==='steel'?'floor':'dark');
 }
 for(const [key,m] of Object.entries(world?.materials||{})){
  if(['wall','floor','trim'].includes(key))roles.set(m,key==='trim'?'paint':key);
 }
 for(const [key,m]of Object.entries(kit?.m||{})){
  if(['shell','floor','paint','secondary','dark','service'].includes(key))roles.set(m,key==='secondary'?'paint':key);
 }
 function role(material){
  if(sourceMaterials.has(material)||!material?.color)return null;
  const name=material.name||'';
  if(/portal|porcelain|signal|light|diffuser|lens|screen|glass|receiver|emitter|contact on actual/i.test(name))return null;
  if(/castle wing (enamel|structural accent)/i.test(name))return null; // Keep eleven navigational wing identities.
  if(/structural laboratory wall|wall cassette|castle wing wall|roof soffit/i.test(name))return 'wall';
  if(/walking deck|cast-in floor/i.test(name))return 'floor';
  if(/service floor/i.test(name))return 'service';
  if(/structural shell|integral flange/i.test(name))return 'shell';
  if(/machine family|machine fascia/i.test(name))return 'paint';
  if(/anodised load frame/i.test(name))return 'dark';
  return roles.get(material)||null;
 }
 // Older rooms render their large panels using instance colours, not the
 // hidden source tile's material colour. Finish that one existing skin too;
 // never add geometry or recolour a portal tile. Local +Z is the panel normal.
 for(const root of roots)root.updateWorldMatrix(true,true);
 const matrix=new THREE.Matrix4(),worldMatrix=new THREE.Matrix4(),normal=new THREE.Vector3(),color=new THREE.Color();
 for(const root of roots)root.traverse(node=>{
  if(!node.isMesh)return;
  if(node.isInstancedMesh&&node.name==='Architectural coat / cassette'&&node.instanceColor){
   for(let i=0;i<node.count;i++){
    node.getMatrixAt(i,matrix);worldMatrix.multiplyMatrices(node.matrixWorld,matrix);
    normal.set(0,0,1).transformDirection(worldMatrix);
    const kind=normal.y>.8?'floor':normal.y<-.8?'shell':Math.abs(normal.x)>.65?'paint':'wall';
    color.setHex(theme[kind]);node.setColorAt(i,color);architecturalInstances++;
   }
   node.instanceColor.needsUpdate=true;node.userData.campaignTheme=theme.id;
  }
  const original=Array.isArray(node.material)?node.material:[node.material];
  const changed=original.map(material=>{
   const kind=role(material);if(!kind)return material;
   if(!copies.has(material)){
    const copy=material.clone();copy.color.setHex(theme[kind]);
    copy.roughness=Math.max(copy.roughness||0,kind==='floor'||kind==='service'?.86:.62);
    copy.name=material.name;copy.userData={...copy.userData,campaignTheme:theme.id,architecturalRole:kind};
    copies.set(material,copy);
   }
   return copies.get(material);
  });
  node.material=Array.isArray(node.material)?changed:changed[0];
 });
 // Update material references used by architecture instruments without touching
 // signals. Original room-owned materials still have their normal disposal path.
 for(const registry of [world?.materials,kit?.m,artistMaterials])if(registry)for(const key of Object.keys(registry))if(copies.has(registry[key]))registry[key]=copies.get(registry[key]);
 const oldDispose=level.dispose;
 const shared=new Set(Object.values(game.materials||{}));
 level.dispose=function(...args){
  try{return oldDispose?.apply(this,args);}finally{
   for(const [original,copy]of copies){copy.dispose();if(!shared.has(original)&&!sourceMaterials.has(original))original.dispose();}
   copies.clear();
  }
 };
 if(game.scene.background?.isColor)game.scene.background.setHex(theme.sky);
 if(game.scene.fog?.color)game.scene.fog.color.setHex(theme.sky);
 level.campaignTheme={...theme,changedMaterials:copies.size,architecturalInstances};
 for(const root of roots)root.userData.campaignTheme=theme.id;
 return level;
}
