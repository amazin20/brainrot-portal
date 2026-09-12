import * as THREE from 'three';

/** A small neutral workshop reflection source, authored in linear radiance.
 * It supplies broad ceiling/floor tones and two service-light strips, not a
 * second scene or a claimed real-time reflection. Three r180 automatically
 * PMREM-filters material.envMap equirects and caches the result per texture. */
function workshopReflection(){
  const width=256,height=128,data=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const u=(x+.5)/width,v=(y+.5)/height,altitude=Math.sin((v-.5)*Math.PI);
    let tone=altitude>0?.29+altitude*.19:.10+(altitude+1)*.16;
    for(const at of [.17,.67]){
      const du=Math.min(Math.abs(u-at),1-Math.abs(u-at));
      tone+=.58*Math.exp(-Math.pow(du/.040,4)-Math.pow((v-.70)/.18,8));
    }
    const i=(y*width+x)*4;
    data[i]=Math.round(Math.min(1,tone*.95)*255);
    data[i+1]=Math.round(Math.min(1,tone*.98)*255);
    data[i+2]=Math.round(Math.min(1,tone)*255);data[i+3]=255;
  }
  const texture=new THREE.DataTexture(data,width,height,THREE.RGBAFormat,THREE.UnsignedByteType);
  texture.name='Local machinery workshop reflection';
  texture.mapping=THREE.EquirectangularReflectionMapping;
  texture.colorSpace=THREE.LinearSRGBColorSpace;
  texture.wrapS=THREE.RepeatWrapping;texture.wrapT=THREE.ClampToEdgeWrapping;
  texture.magFilter=texture.minFilter=THREE.LinearFilter;texture.needsUpdate=true;
  return texture;
}

function isMachinedMesh(node){
  for(let parent=node;parent;parent=parent.parent)if(parent.userData?.source==='src/game/LabMachinedModels.js')return true;
  return false;
}

function isOpticalMirror(node,level){
  if(level.index!==12||!level.workshop?.state?.optical)return false;
  const p=node.geometry?.parameters,mat=node.material;
  // weightedOptics owns this unique unregistered .11 x 2.4 x 2.2 slab.
  // Match its authored geometry/material; no gameplay transform is changed.
  return p&&Math.abs(p.width-.11)<1e-6&&Math.abs(p.height-2.4)<1e-6&&Math.abs(p.depth-2.2)<1e-6
    &&mat?.isMeshStandardMaterial&&Math.abs(mat.metalness-.92)<1e-6&&Math.abs(mat.roughness-.12)<1e-6;
}

export function applyMechanismReflections(level){
  if(!level?.world||level.index<11||level.index>14||level.mechanismReflections)return level;
  const owner=level.world.root.userData.browserArtMaterials?.ceramic;
  if(!owner)return level;
  const targets=[];
  level.world.root.traverse(node=>{
    if(!node.isMesh)return;
    const mirror=isOpticalMirror(node,level),machined=isMachinedMesh(node);
    if(mirror||machined)targets.push({node,mirror});
  });
  if(!targets.length)return level;
  const texture=workshopReflection(),materials=new Map();let meshes=0,mirrors=0;
  for(const {node,mirror} of targets){
    let changed=false;
    const convert=source=>{
      if(!source?.isMeshStandardMaterial)return source;
      if(!mirror&&!['Brushed titanium alloy','Graphite structural composite'].includes(source.name))return source;
      if(!materials.has(source)){
        // The machined model cache shares immutable materials across rooms.
        // Keep the room-specific environment out of that cache and all actors.
        const mat=source.clone();mat.envMap=texture;
        mat.envMapIntensity=mirror?.95:source.name==='Brushed titanium alloy'?.70:.40;
        mat.needsUpdate=true;materials.set(source,mat);
      }
      changed=true;return materials.get(source);
    };
    node.material=Array.isArray(node.material)?node.material.map(convert):convert(node.material);
    if(changed){meshes++;if(mirror)mirrors++;}
  }
  let disposed=false;
  owner.addEventListener('dispose',()=>{if(disposed)return;disposed=true;texture.dispose();});
  level.mechanismReflections={texture,stats:{meshes,materials:materials.size,mirrors,width:256,height:128,sourceBytes:256*128*4}};
  return level;
}
