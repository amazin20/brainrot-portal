import * as THREE from 'three';
import {architecturalCassetteGeometry} from './LabArchitecturalModels.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {installObservatoryShadows} from './LabObservatoryShadows.js';

export const OPTICS_ARCHITECTURE_REVISION='observatory-arched-archive-and-celestial-soffit-v1';
const V=(...p)=>new THREE.Vector3(...p),Q=()=>new THREE.Quaternion();
const C={indigo:0x303c66,deep:0x18233e,silver:0xa6b4cc,pearl:0xc1cadd,brass:0xa7a0bc,glass:0x2b4272};

function archPath(path,x,bottom,spring,rise){
 path.moveTo(-x,bottom);path.lineTo(x,bottom);path.lineTo(x,spring);
 path.absellipse(0,spring,x,rise,0,Math.PI,false,0);path.lineTo(-x,bottom);path.closePath();return path;
}
function extrude(shape){
 const g=new THREE.ExtrudeGeometry(shape,{depth:1,bevelEnabled:false,curveSegments:16});
 g.translate(0,0,-.5);g.computeBoundingBox();g.computeBoundingSphere();return g;
}
function architectureGeometry(){
 const field=archPath(new THREE.Shape(),.405,-.45,.08,.37);
 const ring=archPath(new THREE.Shape(),.427,-.472,.08,.392);
 ring.holes.push(archPath(new THREE.Path(),.399,-.444,.08,.364));
 const circle=new THREE.Shape();circle.absarc(0,0,1,0,Math.PI*2,false);
 const hole=new THREE.Path();hole.absarc(0,0,.88,0,Math.PI*2,true);circle.holes.push(hole);
 const blade=new THREE.Shape();blade.moveTo(.23,-.01);blade.lineTo(.85,.02);blade.lineTo(.63,.50);blade.lineTo(.14,.18);blade.closePath();
 const g=extrude(blade),blades=[];
 for(let i=0;i<8;i++)blades.push(g.clone().rotateZ(i*Math.PI/4));
 const iris=mergeGeometries(blades,false);g.dispose();blades.forEach(g=>g.dispose());iris.computeBoundingBox();iris.computeBoundingSphere();
 const disk=new THREE.CylinderGeometry(1,1,1,32);disk.rotateX(Math.PI/2);
 return {box:new THREE.BoxGeometry(1,1,1),cassette:architecturalCassetteGeometry({corner:.018,inset:.008}),field:extrude(field),arch:extrude(ring),ring:extrude(circle),disk,iris};
}

/** An enclosed observatory, not a new puzzle. Replaces only the old 80 mm
 * mineral cladding; every new vertex stays in that same closed envelope.
 * Celestial inscriptions are a finish on the existing solid roof. Walking
 * faces use derivative-filtered joints in their own material, never decals.
 * No collision, portal, aim, actor or progress record is added or removed. */
export function installOpticsArchitecture(game,level){
 if(game.chamberEdition!=='foundation'||level.index<30||level.index>39||level.opticsArchitecture)return level;
 const k=level.workshop,world=level.world?.root;if(!k||!world)return level;
 world.updateWorldMatrix(true,true);
 const sources=[];world.traverse(m=>{
  if(m.isMesh&&m.visible&&m.name==='Manufactured architecture / Inset mineral wall cassettes')sources.push(m);
 });
 if(sources.length!==1)throw new Error(`Observatory requires one original cladding owner, got ${sources.length}`);
 for(const source of sources)if(game.colliders.some(c=>c.mesh===source)||game.cameraBlockers.includes(source)||game.aimBlockers.includes(source)||game.portalPanels.includes(source))throw new Error('Refusing to hide a gameplay owner');
 const root=new THREE.Group();root.name='Optics / arched silver archive';root.userData={visualOnly:true,keepMaterial:true};world.add(root);
 const geometry=architectureGeometry(),time={value:0};
 const make=(name,roughness,metalness)=>new THREE.MeshStandardMaterial({name,color:0xffffff,roughness,metalness});
 const materials={enamel:make('Observatory / indigo vitreous enamel',.56,.22),silver:make('Observatory / brushed silver frames',.38,.72),recess:make('Observatory / sealed dark optical cavities',.84,.08),glass:make('Observatory / opaque blue instrument glass',.24,.4)};
 const banks=new Map(),panels=[],changed=[],lights=[],sourceVisibility=sources.map(m=>[m,m.visible]);
 const stats={revision:OPTICS_ARCHITECTURE_REVISION,panels:0,irises:0,archives:0,parts:0,batches:0,triangles:0,newColliders:0,newLights:0};
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
   // Opaque rear plate closes the old cassette footprint. The arch lining
   // and its inset have distinct faces separated by centimetres, not z bias.
   add('enamel',[0,0,-.031],[ww,hh,.018],C.indigo,'cassette');
   add('recess',[0,0,-.012],[ww,hh,.014],C.deep,'field');
   add('silver',[0,0,.008],[ww,hh,.025],C.silver,'arch');
   for(const s of [-1,1])add('silver',[s*ww*.477,0,.010],[ww*.018,hh*.92,.024],C.silver);
   const iris=(i+wallIndex+level.index)%3===0;
   if(iris){
    const radius=Math.min(ww*.31,hh*.25),cy=hh*.035;
    add('glass',[0,cy,-.001],[radius,radius,.012],C.glass,'disk');
    add('silver',[0,cy,.021],[radius,radius,.018],C.pearl,'ring');
    add('enamel',[0,cy,.006],[radius*.91,radius*.91,.010],0x6575a0,'iris',(level.index%4)*Math.PI/8);
    add('silver',[0,cy,.024],[radius*.29,radius*.29,.014],0x8d9dc5,'ring');
    for(let t=0;t<12;t++){
     const a=t*Math.PI/6,rr=radius*1.12;
     add('silver',[Math.cos(a)*rr,cy+Math.sin(a)*rr,.017],[Math.min(.13,radius*.06),t%3===0?.25:.12,.014],C.silver,'box',a-Math.PI/2);
    }
    add('silver',[0,-hh*.33,.018],[ww*.44,.045,.016],C.brass);stats.irises++;
   }else{
    // Archive drawers stay in the straight lower part of the arch. Broad
    // stepped faces read from the ordinary shoulder camera, without text.
    for(let r=0;r<4;r++){
     const yy=-hh*.345+r*hh*.105;
     for(let c=0;c<3;c++){
      add('enamel',[(c-1)*ww*.22,yy,.002],[ww*.195,hh*.077,.018],(r+c+level.index)%3===0?0x6f799c:0x414e77);
      add('silver',[(c-1)*ww*.22,yy-hh*.024,.018],[ww*.13,.035,.012],C.silver);
     }
    }
    const radius=Math.min(ww*.22,hh*.13);add('silver',[0,hh*.23,.017],[radius,radius,.016],C.silver,'ring');
    add('glass',[0,hh*.23,-.001],[radius*.84,radius*.84,.012],C.glass,'disk');stats.archives++;
   }
   panels.push({frame:frame.toArray(),width:ww,height:hh,depth:.08,wall:wallIndex,type:iris?'sealed-iris':'archive'});stats.panels++;
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
    shader.fragmentShader='varying vec3 vOpticsWorld;\nvarying vec3 vOpticsNormal;\nuniform float opticsClock;\n'+shader.fragmentShader;
    const finish=floor?`
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
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+finish);
   };
   m.customProgramCacheKey=()=>priorKey()+'|'+OPTICS_ARCHITECTURE_REVISION+(roof?'roof':'floor');m.needsUpdate=true;clones.set(original,m);
  }
  changed.push({mesh,original,replacement:clones.get(original)});mesh.material=clones.get(original);
 });
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
  root.removeFromParent();root.children.forEach(m=>m.dispose());root.clear();Object.values(geometry).forEach(g=>g.dispose());Object.values(materials).forEach(m=>m.dispose());clones.forEach(m=>m.dispose());
  if(level.renderUpdate===render)level.renderUpdate=oldRender;
 }
 level.dispose=function(...args){release();return oldDispose?.apply(this,args);};
 level.opticsArchitecture={root,stats,panels,banks,geometry,materials,clones,time,shadows,release,get disposed(){return disposed;}};return level;
}
