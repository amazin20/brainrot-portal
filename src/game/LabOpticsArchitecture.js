import * as THREE from 'three';
import {observatoryWallProfile,OBSERVATORY_WALL_PROFILE_REVISION} from './LabObservatoryWallProfiles.js';
import {installObservatoryShadows} from './LabObservatoryShadows.js';
import {observatoryFieldFinish,OBSERVATORY_FIELD_GLSL,OBSERVATORY_FIELD_REVISION} from './LabObservatoryFieldFinishes.js';

export const OPTICS_ARCHITECTURE_REVISION=OBSERVATORY_WALL_PROFILE_REVISION;
const V=(...p)=>new THREE.Vector3(...p),Q=()=>new THREE.Quaternion();

/** Read existing geometry and authored translation stations once. This does
 * not alter geometry, transforms, input, callbacks or physical/query owners. */
export function assertObservatoryMovingFloorExcluded(fieldFinish,carrier,world){
 const check=(ok,message)=>{if(!ok)throw new Error('Moving floor exclusion: '+message);};
 const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],near=(a,b)=>Math.abs(a-b)<1e-8;
 check(fieldFinish?.floorHeight&&fieldFinish.floorCutouts&&carrier?.mesh?.isMesh,'actual field metadata and visible carrier skin');
 check(world.matrixWorld.elements.every((value,i)=>near(value,identity[i])),'untransformed laboratory world');
 const mesh=carrier.mesh,group=carrier.group;
 for(const object of [group,mesh])check(object.matrixAutoUpdate&&object.matrixWorldAutoUpdate&&object.quaternion.toArray().every((value,i)=>near(value,i===3?1:0))&&object.scale.toArray().every(value=>near(value,1)),'translation-only unit carrier and skin');
 check(mesh.parent===group&&group.parent===world,'authored carrier parent chain');
 for(const [object,translation]of [[group,group.position.toArray()],[mesh,group.position.toArray().map((value,i)=>value+mesh.position.toArray()[i])]]){
  check(object.matrixWorld.elements.every((value,i)=>near(value,i>=12&&i<=14?translation[i-12]:identity[i])),'current world matrix matches the actual unit translation pose');
 }
 check(!mesh.isInstancedMesh&&!mesh.isSkinnedMesh&&!(mesh.geometry.morphAttributes.position?.length),'one rigid noninstanced floor geometry');
 const position=mesh.geometry.attributes.position,min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 check(position?.count>0&&position.itemSize===3,'actual position attribute');
 for(let i=0;i<position.count;i++)for(let axis=0;axis<3;axis++){
  const value=axis===0?position.getX(i):axis===1?position.getY(i):position.getZ(i);
  check(Number.isFinite(value),'finite existing geometry');min[axis]=Math.min(min[axis],value);max[axis]=Math.max(max[axis],value);
 }
 check(Array.isArray(carrier.stations)&&carrier.stations.length>=2,'actual translation stations');
 const poses=[...carrier.stations,carrier.position,group.position].map(value=>value.toArray()),local=mesh.position.toArray();
 check([...poses.flat(),...local].every(Number.isFinite),'finite actual poses and stations');
 const lower=min.map((value,axis)=>value+local[axis]+Math.min(...poses.map(p=>p[axis]))),upper=max.map((value,axis)=>value+local[axis]+Math.max(...poses.map(p=>p[axis])));
 const [low,high]=fieldFinish.floorHeight;
 if(upper[1]<low||lower[1]>high)return Object.freeze({kind:'height',bodyMin:lower,bodyMax:upper,floorHeight:[low,high]});
 check(poses.every(p=>near(p[0],poses[0][0])&&near(p[2],poses[0][2])),'overlapping-height carrier remains vertically translated at fixed XZ');
 const cutout=fieldFinish.floorCutouts.find(region=>region.shape==='rect'&&Math.min(lower[0]-region.p[0],lower[2]-region.p[1],region.p[2]-upper[0],region.p[3]-upper[2])>.05);
 check(cutout,'entire rigid skin stays strictly inside the canonical one-sided cutout');
 return Object.freeze({kind:'cutout',bodyMin:lower,bodyMax:upper,floorHeight:[low,high],cutout:[...cutout.p],minimumMargin:Math.min(lower[0]-cutout.p[0],lower[2]-cutout.p[1],cutout.p[2]-upper[0],cutout.p[3]-upper[2])});
}

/** An enclosed observatory, not a new puzzle. Replaces only the old 80 mm
 * mineral cladding; every new vertex stays in that same closed envelope.
 * Celestial inscriptions are a finish on the existing solid roof. Walking
 * faces use derivative-filtered joints in their own material, never decals.
 * No collision, portal, aim, actor or progress record is added or removed. */
export function installOpticsArchitecture(game,level){
 if(game.chamberEdition!=='foundation'||level.index<30||level.index>39||level.opticsArchitecture)return level;
 const k=level.workshop,world=level.world?.root;if(!k||!world)return level;
 const stable=level.index+1,fieldFinish=observatoryFieldFinish(stable),originalFloor=k.m.floor;
 // Authored carrier records identify their visible skins before any clone or
 // registry replacement. Their floor.mesh is a separate physical proxy.
 const movingBindings={31:['rack-driven-crossing','bridge'],33:['Liquid driven archive lift','lift'],36:['angular-bridge-cassette','bridge'],38:['original-cargo-hoist','freight']};
 const movingBinding=movingBindings[stable];let movingCarrier=null;
 if(movingBinding){
  const [name,field]=movingBinding,carrier=k.state[name];
  if(!carrier||carrier!==level[field]||carrier.name!==name||!carrier.mesh?.isMesh||!carrier.mesh.visible
   ||carrier.mesh.parent!==carrier.group||carrier.group.parent!==world||carrier.mesh.material!==originalFloor
   ||carrier.floor.mesh===carrier.mesh||!game.floors.includes(carrier.floor)||!k.world.floors.includes(carrier.floor))
   throw new Error('Observatory moving floor requires its exact authored carrier record');
  movingCarrier=carrier;
 }
 world.updateWorldMatrix(true,true);
 const movingExclusion=movingCarrier?assertObservatoryMovingFloorExcluded(fieldFinish,movingCarrier,world):null;
 const sources=[];world.traverse(m=>{
  if(m.isMesh&&m.visible&&m.name==='Manufactured architecture / Inset mineral wall cassettes')sources.push(m);
 });
 if(sources.length!==1)throw new Error(`Observatory requires one original cladding owner, got ${sources.length}`);
 for(const source of sources)if(game.colliders.some(c=>c.mesh===source)||game.cameraBlockers.includes(source)||game.aimBlockers.includes(source)||game.portalPanels.includes(source))throw new Error('Refusing to hide a gameplay owner');
 const root=new THREE.Group();root.name='Optics / distinct continuous instrument panels';root.userData={visualOnly:true,keepMaterial:true};world.add(root);
 const profile=observatoryWallProfile(level.index+1),geometry={profile:profile.geometry},time={value:0};
 const make=(name,roughness,metalness)=>new THREE.MeshStandardMaterial({name,color:0xffffff,roughness,metalness});
 const materials={enamel:make('Observatory / indigo vitreous enamel',.56,.22),silver:make('Observatory / brushed silver frames',.38,.72),recess:make('Observatory / sealed dark optical cavities',.84,.08),glass:make('Observatory / opaque blue instrument glass',.24,.4)};
 materials.enamel.vertexColors=true;
 const banks=new Map(),panels=[],changed=[],lights=[],isolatedMaterials=[],sourceVisibility=sources.map(m=>[m,m.visible]);
 const stats={revision:OPTICS_ARCHITECTURE_REVISION,profile:profile.name,rimAreaRatio:profile.rimAreaRatio,panels:0,parts:0,batches:0,triangles:0,newColliders:0,newLights:0};
 let envelope;
 function part(frame,kind,p,size,color,shape='box',angle=0){
  if([...p,...size,angle].some(n=>!Number.isFinite(n))||size.some(n=>n<=0))throw new Error('Invalid optical architecture dimensions');
  const local=new THREE.Matrix4().compose(V(...p),Q().setFromAxisAngle(V(0,0,1),angle),V(...size));
  const geo=geometry[shape];if(!geo.boundingBox)geo.computeBoundingBox();
  const box=geo.boundingBox.clone().applyMatrix4(local);
  if(!envelope.clone().expandByScalar(.00001).containsBox(box))throw new Error(`Optical relief escaped original panel: ${kind}/${shape}`);
  const key=kind+':'+shape,list=banks.get(key)||[];list.push({matrix:frame.clone().multiply(local),color,localBounds:box,panel:panels.length});banks.set(key,list);stats.parts++;
 }
 const {minX,maxX,minZ,maxZ}=k.bounds,w=maxX-minX,d=maxZ-minZ,h=k.ceiling-k.base;
 const walls=[[(minX+maxX)/2,minZ,w,true,1],[minX,(minZ+maxZ)/2,d,false,1],[(minX+maxX)/2,maxZ,w,true,-1],[maxX,(minZ+maxZ)/2,d,false,-1]];
 const inv=world.matrixWorld.clone().invert();
 for(const [wallIndex,[x,z,span,alongX,inward]]of walls.entries()){
  const n=Math.ceil(span/10),bay=span/n,rows=Math.max(1,Math.min(3,Math.ceil(h/14))),rowH=Math.max(2,h-4.4)/rows;
  for(let i=0;i<n;i++)for(let row=0;row<rows;row++){
   const at=-span/2+(i+.5)*bay,y=k.base+2.1+(row+.5)*rowH,ww=bay-.72,hh=rowH-.28;
   const position=alongX?V(x+at,y,z+inward*.68):V(x+inward*.68,y,z+at),normal=alongX?V(0,0,inward):V(inward,0,0);
   const frame=new THREE.Matrix4().compose(position,Q().setFromUnitVectors(V(0,0,1),normal),V(1,1,1));
   frame.premultiply(inv);envelope=new THREE.Box3(V(-ww/2,-hh/2,-.04),V(ww/2,hh/2,.04));
   const add=(kind,p,size,color,shape='box',angle=0)=>part(frame,kind,p,size,color,shape,angle);
   add('enamel',[0,0,0],[ww,hh,1],0xffffff,'profile');
   panels.push({frame:frame.toArray(),width:ww,height:hh,depth:.08,wall:wallIndex,type:profile.name});stats.panels++;
  }
 }
 for(const [key,entries]of banks){
  const [kind,shape]=key.split(':'),geo=geometry[shape],mesh=new THREE.InstancedMesh(geo,materials[kind],entries.length);
  mesh.name='Observatory / '+key;mesh.userData={visualOnly:true,keepMaterial:true};mesh.castShadow=false;mesh.receiveShadow=true;
  entries.forEach((e,i)=>{mesh.setMatrixAt(i,e.matrix);mesh.setColorAt(i,new THREE.Color(e.color));});mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;
  mesh.computeBoundingBox();mesh.computeBoundingSphere();root.add(mesh);stats.batches++;stats.triangles+=entries.length*(geo.index?.count??geo.attributes.position.count)/3;
 }
 for(const s of sources)s.visible=false;
 const clones=new Map();
 world.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.visible||Array.isArray(mesh.material)||mesh.userData.collisionProxy||mesh.userData.portalTile||mesh.userData.portalable||game.portalPanels.includes(mesh))return;
  const original=mesh.material,roof=original.name==='Structural laboratory wall',floor=/^(Honed mineral walking deck|Foundation service floor)$/.test(original.name);
  if(!roof&&!floor)return;
  const fields=fieldFinish?(roof?fieldFinish.roof:fieldFinish.floor):null;
  const fieldRole=roof?'roof':original.name==='Foundation service floor'?'service-floor':'floor';
  if(changed.some(record=>record.mesh===mesh))throw new Error('Architecture mesh already has a material restoration owner');
  if(!clones.has(original)){
   const m=original.clone(),prior=original.onBeforeCompile,priorKey=original.customProgramCacheKey.bind(original);m.name=original.name;
   m.color.setHex(roof?0x74809e:original.name==='Foundation service floor'?0x4c5d7a:0x97a5bf);m.roughness=roof?.72:.64;m.metalness=roof?.18:.18;
   if(floor)m.map=null;
   m.onBeforeCompile=(shader,renderer)=>{
    prior.call(m,shader,renderer);shader.uniforms.opticsClock=time;
    shader.vertexShader='varying vec3 vOpticsWorld;\nvarying vec3 vOpticsNormal;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
     vec4 op=vec4(transformed,1.0);
     #ifdef USE_INSTANCING
      op=instanceMatrix*op;
     #endif
     vOpticsWorld=(modelMatrix*op).xyz;
     vOpticsNormal=inverseTransformDirection(transformedNormal,viewMatrix);`);
    shader.fragmentShader=(fields?OBSERVATORY_FIELD_GLSL:'')+'varying vec3 vOpticsWorld;\nvarying vec3 vOpticsNormal;\nuniform float opticsClock;\n'+shader.fragmentShader;
    let finish=floor?`
     vec2 tile=vOpticsWorld.xz/vec2(7.0,12.0);
     tile.x+=mod(floor(tile.y),2.0)*.5;
     vec2 edge=abs(fract(tile+.5)-.5)*vec2(7.0,12.0);
     float joint=min(edge.x,edge.y),aa=max(fwidth(joint),.004);
     float groove=1.0-smoothstep(.014-aa,.014+aa,joint);
     diffuseColor.rgb*=1.0-groove*.36;
     float satin=sin(vOpticsWorld.x*.24+vOpticsWorld.z*.18)*.014;
     diffuseColor.rgb*=1.0+satin;
    `:`
     if(vOpticsWorld.y>${(k.ceiling-.02).toFixed(4)} && normalize(vOpticsNormal).y<-.8){
      vec2 p=vOpticsWorld.xz-vec2(${((minX+maxX)/2).toFixed(4)},${((minZ+maxZ)/2).toFixed(4)});
      float rr=length(p),ring=abs(fract(rr/4.8+.5)-.5)*4.8;
      float aa=max(fwidth(rr),.008);
      float orbit=1.0-smoothstep(.028-aa,.028+aa,ring);
      vec2 grid=p/1.7,cell=floor(grid),uv=fract(grid)-.5;
      float hash=fract(sin(dot(cell,vec2(127.1,311.7)))*43758.5453);
      float star=step(.94,hash)*(1.0-smoothstep(.023,.023+max(length(fwidth(grid)),.008),length(uv)));
      float phase=.88+.12*sin(opticsClock*.16+hash*6.2831);
      diffuseColor.rgb=mix(vec3(.035,.05,.10),vec3(.43,.53,.76),max(orbit*.22,star*phase));
     }
    `;
    if(fields)finish=floor?finish+'\n'+fields:`
     if(vOpticsWorld.y>${(k.ceiling-.02).toFixed(4)} && normalize(vOpticsNormal).y<-.8){
      ${fields}
     }
    `;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+finish);
   };
   m.customProgramCacheKey=()=>priorKey()+'|'+OPTICS_ARCHITECTURE_REVISION+(roof?'roof':'floor')+(fieldFinish?'|'+OBSERVATORY_FIELD_REVISION+'|'+stable+'|'+fieldRole:'');m.needsUpdate=true;clones.set(original,m);
  }
  changed.push({mesh,original,replacement:clones.get(original)});mesh.material=clones.get(original);
 });
 // Only room32's closed drawing faces the entry camera. Its actual porcelain
 // front, portal master and measured frame retain their original materials.
 if(level.index===31){
  const intakes=k.world.surfaces.filter(surface=>surface.name==='double-ray-intake');
  if(intakes.length!==1)throw new Error('Optical intake requires one authored surface');
  const covers=intakes[0].group.children.filter(mesh=>{
   const p=mesh.geometry?.parameters;
   return mesh.isMesh&&mesh.visible&&p&&Math.abs(mesh.position.x)<1e-6&&Math.abs(mesh.position.y)<1e-6&&Math.abs(mesh.position.z+.19)<1e-6
    &&Math.abs(p.width-4)<1e-6&&Math.abs(p.height-2.14)<1e-6&&Math.abs(p.depth-.22)<1e-6;
  });
  if(covers.length!==1)throw new Error('Optical intake requires one closed rear drawing');
  const mesh=covers[0],original=mesh.material;
  if(!original?.isMeshStandardMaterial||Array.isArray(original)||original.transparent||original.visible===false
   ||mesh.userData.collisionProxy||mesh.userData.portalable||mesh.userData.portalTile
   ||game.colliders.some(c=>c.mesh===mesh)||game.floors.some(f=>f.mesh===mesh)
   ||game.cameraBlockers.includes(mesh)||game.aimBlockers.includes(mesh)||game.portalPanels.includes(mesh))
   throw new Error('Refusing to finish an optical gameplay owner');
  if(original!==k.m.dark||original.name!=='Dark anodised load frame'||clones.has(original)||changed.some(record=>record.mesh===mesh))
   throw new Error('Optical rear drawing requires one untouched load-frame material');
  const replacement=original.clone();replacement.name='Optical intake / closed rear service cover';
  replacement.onBeforeCompile=original.onBeforeCompile;replacement.customProgramCacheKey=original.customProgramCacheKey;
  replacement.color.setHex(0x7a6f7d);replacement.roughness=.82;replacement.metalness=.08;replacement.needsUpdate=true;
  mesh.material=replacement;changed.push({mesh,original,replacement});isolatedMaterials.push(replacement);
 }
 // Instruments and moving decks resolve the same floor through the kit's
 // registries. Keep those references on the actual rendered finish, and
 // restore them before the original world disposes its owned materials.
 const bindings=[];
 for(const registry of new Set([k.m,level.world.materials].filter(Boolean))){
  for(const [key,original]of Object.entries(registry))if(clones.has(original)){
   const replacement=clones.get(original);bindings.push({registry,key,original,replacement});registry[key]=replacement;
  }
 }
 game.scene.traverse(light=>{
  if(light.isHemisphereLight){lights.push({light,intensity:light.intensity,color:light.color.clone(),ground:light.groundColor.clone()});light.intensity=.78;light.color.setHex(0xc8d7ff);light.groundColor.setHex(0x344360);}
  else if(light===game.keyLight){lights.push({light,intensity:light.intensity,color:light.color.clone()});light.intensity=2.7;light.color.setHex(0xe4eaff);}
 });
 const shadows=installObservatoryShadows(game,level);
 const oldRender=level.renderUpdate,oldDispose=level.dispose;let disposed=false;
 const render=function(...args){const result=oldRender?.apply(this,args);if(!disposed)time.value=game.epicDirector?.options?.reducedMotion||game.epicOptions?.reducedMotion||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches?0:k.time;return result;};
 level.renderUpdate=render;
 function release(){
  if(disposed)return;disposed=true;
  shadows?.release();
  for(const [source,visible]of sourceVisibility)source.visible=visible;
  for(const {mesh,original,replacement}of changed)if(mesh.material===replacement)mesh.material=original;
  for(const {registry,key,original,replacement}of bindings)if(registry[key]===replacement)registry[key]=original;
  for(const {light,intensity,color,ground}of lights){light.intensity=intensity;light.color.copy(color);if(ground)light.groundColor.copy(ground);}
  root.removeFromParent();root.children.forEach(m=>m.dispose());root.clear();Object.values(geometry).forEach(g=>g.dispose());Object.values(materials).forEach(m=>m.dispose());clones.forEach(m=>m.dispose());isolatedMaterials.forEach(m=>m.dispose());
  if(level.renderUpdate===render)level.renderUpdate=oldRender;
 }
 level.dispose=function(...args){release();return oldDispose?.apply(this,args);};
 level.opticsArchitecture={root,stats,panels,banks,geometry,materials,clones,fieldFinish,movingExclusion,time,shadows,release,get disposed(){return disposed;}};return level;
}
