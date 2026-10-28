import * as THREE from 'three';
import {architecturalCassetteGeometry,clipArchitecturalRect} from './LabArchitecturalModels.js';

export const BIOSPHERE_ARCHITECTURE_REVISION='biosphere-conservatory-architecture-v1';
const V=(...p)=>new THREE.Vector3(...p),Q=()=>new THREE.Quaternion();
const PALETTE={stone:0xc8c6af,jade:0x365b50,deep:0x182f2c,brass:0xa88a52,rim:0x647b6e,floor:0x9caaa0};

// All relief remains in the former cassette's 80 mm closed envelope. It is
// not a second layer over that face and cannot add a ledge or cover a portal.
function leafGeometry(){
 const p=[0,-.5,0,-.25,-.16,.08,-.30,.14,.12,-.12,.38,.09,0,.5,0,.12,.38,.09,.30,.14,.12,.25,-.16,.08,0,0,.5];
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
 g.setIndex([0,1,8,1,2,8,2,3,8,3,4,8,4,5,8,5,6,8,6,7,8,7,0,8]);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}
function surfaceMaterial(name,{color=0xffffff,roughness=.8,metalness=.05,mineral=false,emissive=0,emissiveIntensity=0}={}){
 const m=new THREE.MeshStandardMaterial({name,color,roughness,metalness,emissive,emissiveIntensity});
 if(mineral){
  m.onBeforeCompile=shader=>{
   shader.vertexShader='varying vec3 vConservatoryWorld;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
    vec4 conservatoryPoint=vec4(transformed,1.0);
    #ifdef USE_INSTANCING
     conservatoryPoint=instanceMatrix*conservatoryPoint;
    #endif
    vConservatoryWorld=(modelMatrix*conservatoryPoint).xyz;`);
   shader.fragmentShader='varying vec3 vConservatoryWorld;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    vec3 cp=vConservatoryWorld;
    float vein=sin(cp.x*.74+cp.y*.58+cp.z*.81+sin(cp.z*.33-cp.x*.24)*2.2);
    float broad=sin(cp.x*2.1+cp.z*1.4)*sin(cp.y*.71+cp.z*1.9);
    float footprint=max(length(dFdx(cp)),length(dFdy(cp)));
    float fine=sin(cp.x*18.0+cp.z*13.0)*sin(cp.y*14.0-cp.z*16.0);
    diffuseColor.rgb*=.96+vein*.035+broad*.018+fine*.011*(1.0-smoothstep(.025,.10,footprint));`);
  };
  m.customProgramCacheKey=()=>BIOSPHERE_ARCHITECTURE_REVISION+'-mineral';
 }
 return m;
}

/** Replace the complete building finish of campaign rooms 21–30. The original
 * portal-clipped panel footprints are reused verbatim. Physics/ray owners,
 * original GLB actors, machinery, goals and the previous chapter stay intact.
 * New parts live in bounded material batches, not per-panel draw calls. */
export function installBiosphereArchitecture(game,level){
 if(game.chamberEdition!=='foundation'||level.index<20||level.index>29||!level.world||level.biosphereArchitecture)return level;
 const world=level.world.root,sources=[];world.updateWorldMatrix(true,true);
 world.traverse(n=>{if(n.isInstancedMesh&&n.name==='Architectural coat / cassette'&&n.visible)sources.push(n);});
 // The flight hangar deliberately retains its own long-span architecture.
 // Refinish its original deck footprints without moving its ballistic paths.
 const tileRestores=[];
 if(!sources.length&&level.index===29){
  const matrices=[],portals=level.world.surfaces.filter(s=>s.portal).map(s=>s.getFrame());
  for(const s of level.world.surfaces){
   if(s.portal||s.collider?.kinematic||s.getFrame().normal.y<.9)continue;
   const f=s.getFrame(),nx=Math.ceil(s.width/6.5),ny=Math.ceil(s.height/6.5),cw=s.width/nx,ch=s.height/ny;
   s.group.updateWorldMatrix(true,false);
   for(let x=0;x<nx;x++)for(let y=0;y<ny;y++){
    const rect={x0:-s.width/2+x*cw,x1:-s.width/2+(x+1)*cw,y0:-s.height/2+y*ch,y1:-s.height/2+(y+1)*ch};
    for(const r of clipArchitecturalRect(rect,f,portals)){
     const w=r.x1-r.x0-.035,h=r.y1-r.y0-.035;if(w<.1||h<.1)continue;
     matrices.push(world.matrixWorld.clone().invert().multiply(s.group.matrixWorld).multiply(new THREE.Matrix4().compose(V((r.x0+r.x1)/2,(r.y0+r.y1)/2,-.044),Q(),V(w,h,.08))));
    }
   }
   for(const node of s.group.children)if(node.isInstancedMesh&&!node.userData.portalTile&&node.visible){tileRestores.push({source:node,visible:true});node.visible=false;}
  }
  if(matrices.length)sources.push({visible:true,count:matrices.length,matrixWorld:world.matrixWorld,getMatrixAt:(i,m)=>m.copy(matrices[i])});
 }
 if(!sources.length)return level;
 const root=new THREE.Group();root.name='Biosphere / conservatory architecture';root.userData={visualOnly:true,keepMaterial:true,revision:BIOSPHERE_ARCHITECTURE_REVISION};world.add(root);
 const geometry={box:new THREE.BoxGeometry(1,1,1),cassette:architecturalCassetteGeometry({corner:.018,inset:.012}),leaf:leafGeometry()};
 const material={
  mineral:surfaceMaterial('Conservatory / honed limestone and terrazzo',{mineral:true,roughness:.79}),
  enamel:surfaceMaterial('Conservatory / satin jade architectural enamel',{roughness:.64,metalness:.20}),
  metal:surfaceMaterial('Conservatory / aged bronze inlay',{roughness:.42,metalness:.67}),
  shadow:surfaceMaterial('Conservatory / closed botanical recess',{roughness:.93}),
  leaf:surfaceMaterial('Conservatory / folded botanical relief',{roughness:.73}),
  light:surfaceMaterial('Conservatory / shielded warm daylight diffuser',{color:0xffefc7,roughness:.63,emissive:0xffe2a3,emissiveIntensity:.43}),
 };
 material.leaf.side=THREE.DoubleSide;
 const time={value:0};
 material.leaf.onBeforeCompile=shader=>{
  shader.uniforms.conservatoryTime=time;
  shader.vertexShader='uniform float conservatoryTime;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   float leafPhase=0.0;
   #ifdef USE_INSTANCING
    leafPhase=instanceMatrix[3].x*.31+instanceMatrix[3].y*.23+instanceMatrix[3].z*.41;
   #endif
   transformed.x+=sin(conservatoryTime*.52+leafPhase)*.018*max(0.0,position.y+.2);`);
 };
 material.leaf.customProgramCacheKey=()=>BIOSPHERE_ARCHITECTURE_REVISION+'-leaf';
 const banks=new Map(),records=[],hidden=[...tileRestores],inverse=world.matrixWorld.clone().invert();
 let envelope=null;
 const stats={revision:BIOSPHERE_ARCHITECTURE_REVISION,sourcePanels:0,floorPanels:0,wallPanels:0,ceilingPanels:0,botanicalPanels:0,leaves:0,parts:0,batches:0,triangles:0,newColliders:0,newLights:0};
 const m=new THREE.Matrix4(),rotation=Q(),position=V(),scale=V(),local=new THREE.Matrix4();
 function part(frame,kind,p,size,color=0xffffff,shape='box',angle=0){
  if(size.some(s=>!Number.isFinite(s)||s<=0))throw new Error('Invalid conservatory part');
  const key=kind+':'+shape,list=banks.get(key)||[];
  local.compose(V(...p),Q().setFromAxisAngle(V(0,0,1),angle),V(...size));
  const bounds=geometry[shape].boundingBox||((geometry[shape].computeBoundingBox()),geometry[shape].boundingBox);
  const occupied=bounds.clone().applyMatrix4(local);
  if(!envelope.clone().expandByScalar(.00001).containsBox(occupied))throw new Error(`Conservatory detail escaped its panel: ${kind}/${shape}`);
  const entry={matrix:frame.clone().multiply(local),color};list.push(entry);banks.set(key,list);stats.parts++;
 }
 const base=level.bounds?.base??level.workshop?.base??0;
 for(const source of sources){
  hidden.push({source,visible:source.visible});source.visible=false;
  for(let i=0;i<source.count;i++){
   source.getMatrixAt(i,m);const transform=inverse.clone().multiply(source.matrixWorld).multiply(m);
   transform.decompose(position,rotation,scale);const w=scale.x,h=scale.y,depth=scale.z,frame=new THREE.Matrix4().compose(position,rotation,V(1,1,1));
   envelope=new THREE.Box3(V(-w/2,-h/2,-depth/2),V(w/2,h/2,depth/2));
   const normal=V(0,0,1).applyQuaternion(rotation);
   const top=depth/2,front=top-.002,back=-depth/2;
   const add=(kind,p,s,color,shape,angle)=>part(frame,kind,p,s,color,shape,angle);
   const seed=i+level.index*17;stats.sourcePanels++;
   // Preserve even narrow stair treads. Their walking plane does not recede.
   if(normal.y>.80){
    stats.floorPanels++;
    add('mineral',[0,0,-.001],[w,h,depth-.002],position.y>base+3?0xb8bfae:PALETTE.floor,'cassette');
    if(w>1.5&&h>1.5){
     const inset=Math.min(.13,w*.08,h*.08),d=.008;
     for(const sign of [-1,1]){
      add('metal',[sign*(w/2-inset),0,front-.004],[.018,h-inset*2,d],PALETTE.brass);
      add('metal',[0,sign*(h/2-inset),front-.004],[w-inset*2,.018,d],PALETTE.brass);
     }
     if(seed%9===0){
      add('enamel',[-w*.34,-h*.34,front-.004],[Math.min(.32,w*.12),Math.min(.32,h*.12),.008],PALETTE.jade,'box',Math.PI/4);
     }
    }
   }else if(normal.y<-.80){
    stats.ceilingPanels++;
    add('shadow',[0,0,back+.010],[w,h,.020],PALETTE.deep);
    const border=Math.min(.14,w*.08,h*.08),innerW=w-2*border,innerH=h-2*border;
    for(const sign of [-1,1]){
     add('metal',[sign*(w-border)/2,0,0],[border,h,depth],PALETTE.rim);
     add('metal',[0,sign*(h-border)/2,0],[innerW,border,depth],PALETTE.rim);
    }
    if(innerW>.4&&innerH>.4){
     const luminous=(seed%5===0||seed%5===1);
     add(luminous?'light':'enamel',[0,0,back+.036],[innerW-.05,innerH-.05,.018],luminous?0xffffff:0x314d43,'cassette');
     const bars=Math.max(2,Math.ceil(innerW/1.1));
     for(let b=1;b<bars;b++)add('metal',[-innerW/2+innerW*b/bars,0,front-.010],[.045,innerH,.020],0x58695a);
     if(innerH>1.2)add('metal',[0,0,front-.010],[innerW,.045,.020],0x58695a);
    }
   }else{
    stats.wallPanels++;
    const b=Math.min(.13,w*.09,h*.09),wide=w>2.1&&h>1.9;
    const botanical=wide&&Math.abs(normal.y)<.02&&position.y>base+2.4&&((Math.floor(position.x/5)+Math.floor(position.z/5)+seed)%4===0);
    const limestone=position.y>base+10||(Math.floor(position.x/7)+Math.floor(position.z/7)+level.index)%4===0;
    add('shadow',[0,0,back+.010],[w,h,.020],PALETTE.deep);
    for(const sign of [-1,1]){
     add('enamel',[sign*(w-b)/2,0,0],[b,h,depth],PALETTE.jade);
     add('enamel',[0,sign*(h-b)/2,0],[w-2*b,b,depth],PALETTE.jade);
    }
    const iw=w-2*b-.025,ih=h-2*b-.025;
    if(iw>.05&&ih>.05){
     add(botanical?'shadow':'mineral',[0,0,back+.034],[iw,ih,.026],botanical?0x203b29:limestone?PALETTE.stone:0x557968,'cassette');
     if(wide){
      // The open reveal is dark at its rear and metallic at its edge. This
      // changes the building's silhouette/light response without protrusion.
      for(const sign of [-1,1])add('metal',[sign*(iw/2-.05),0,front-.010],[.025,ih-.08,.020],PALETTE.brass);
      if(botanical){
       stats.botanicalPanels++;
       const leaves=Math.min(44,Math.max(12,Math.round(iw*ih*2.1)));
       for(let n=0;n<leaves;n++){
        const random=k=>{const a=Math.sin((seed+1)*12.9898+(n+1)*78.233+k*41.17)*43758.5453;return a-Math.floor(a);};
        const lw=Math.min(.84,iw*.29)*( .65+random(0)*.35),lh=Math.min(1.2,ih*.32)*(.65+random(1)*.35);
        const angle=(random(4)-.5)*2.8,rx=Math.abs(Math.cos(angle))*lw*.32+Math.abs(Math.sin(angle))*lh*.51,ry=Math.abs(Math.sin(angle))*lw*.32+Math.abs(Math.cos(angle))*lh*.51;
        const x=(random(2)-.5)*Math.max(0,iw-2*rx-.04),y=(random(3)-.5)*Math.max(0,ih-2*ry-.04),z=back+.045;
        const colors=[0x487243,0x719051,0x315a36,0x91a264,0x395f47];
        add('leaf',[x,y,z],[lw,lh,.035],colors[n%5],'leaf',angle);stats.leaves++;
       }
       // Root collar belongs to this recessed planter, not a floating pot.
       add('metal',[0,-ih/2+.08,front-.009],[iw-.12,.12,.018],PALETTE.brass);
      }else{
       const flutes=Math.min(6,Math.max(2,Math.floor(iw/.5)));
       for(let n=0;n<flutes;n++)add('enamel',[-iw/2+.22+n*(iw-.44)/Math.max(1,flutes-1),0,front-.016],[.055,ih-.28,.032],limestone?0x999e8b:0x3a5d50);
       if(seed%4===0)add('metal',[0,-ih*.30,front-.009],[iw-.16,.045,.018],PALETTE.brass);
      }
     }
    }
   }
   records.push({sourceIndex:i,width:w,height:h,depth,frame:frame.clone(),normal:normal.toArray()});
  }
 }
 for(const [key,entries]of banks){
  const [kind,shape]=key.split(':'),geo=geometry[shape],mesh=new THREE.InstancedMesh(geo,material[kind],entries.length);
  mesh.name=`Conservatory / ${key}`;mesh.userData={visualOnly:true,keepMaterial:true,biosphereArchitecture:true};mesh.receiveShadow=true;mesh.castShadow=false;
  const color=new THREE.Color();entries.forEach((e,i)=>{mesh.setMatrixAt(i,e.matrix);mesh.setColorAt(i,color.setHex(e.color));});
  mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();root.add(mesh);
  stats.batches++;stats.triangles+=entries.length*(geo.index?.count??geo.attributes.position.count)/3;
 }
 const hangarMaterials=[];
 if(level.index===29)world.traverse(mesh=>{
  if(!mesh.isMesh||!['Solid hangar roof','Solid hangar side wall','Solid hangar end wall','Lower hangar service deck'].includes(mesh.name))return;
  const original=mesh.material,replacement=surfaceMaterial('Conservatory hangar / '+mesh.name,{color:mesh.name.includes('roof')?0x53786b:mesh.name.includes('deck')?0x658174:PALETTE.stone,mineral:true,roughness:.84});
  replacement.vertexColors=original.vertexColors;hangarMaterials.push({mesh,original,replacement});mesh.material=replacement;
 });
 // Reshape illumination instead of piling lights on the already bright lab.
 const savedLights=[];game.scene.traverse(light=>{
  if(light.isHemisphereLight){savedLights.push({light,intensity:light.intensity,color:light.color.clone(),ground:light.groundColor.clone()});light.intensity=.82;light.color.setHex(0xd9ece3);light.groundColor.setHex(0x354d41);}
  else if(light===game.keyLight){savedLights.push({light,intensity:light.intensity,color:light.color.clone()});light.intensity=2.7;light.color.setHex(0xffe4b6);}
  else if(light.isDirectionalLight&&light.name==='Architectural edge fill'){savedLights.push({light,intensity:light.intensity,color:light.color.clone()});light.intensity=.48;light.color.setHex(0xb7dece);}
 });
 let elapsed=0,previous=0,disposed=false;const old={update:level.update,renderUpdate:level.renderUpdate,reset:level.reset,dispose:level.dispose};
 const reduced=()=>game.epicDirector?.options?.reducedMotion===true||game.epicOptions?.reducedMotion===true||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;
 level.update=function(dt,...args){const r=old.update?.call(this,dt,...args);previous=elapsed;if(Number.isFinite(dt)&&dt>0)elapsed+=dt;return r;};
 level.renderUpdate=function(alpha=1,...args){const r=old.renderUpdate?.call(this,alpha,...args);time.value=reduced()?0:THREE.MathUtils.lerp(previous,elapsed,THREE.MathUtils.clamp(alpha,0,1));return r;};
 level.reset=function(...args){const r=old.reset?.apply(this,args);elapsed=previous=time.value=0;return r;};
 function release(){
  if(disposed)return;disposed=true;
  for(const {source,visible}of hidden)source.visible=visible;
  for(const {light,intensity,color,ground}of savedLights){light.intensity=intensity;light.color.copy(color);if(ground)light.groundColor.copy(ground);}
  for(const {mesh,original,replacement}of hangarMaterials){mesh.material=original;replacement.dispose();}
  root.removeFromParent();root.children.forEach(n=>n.dispose());root.clear();Object.values(geometry).forEach(g=>g.dispose());Object.values(material).forEach(m=>m.dispose());
 }
 level.dispose=function(...args){release();return old.dispose?.apply(this,args);};
 level.biosphereArchitecture={root,stats,records,geometry,materials:material,time,release,get disposed(){return disposed;}};
 return level;
}
