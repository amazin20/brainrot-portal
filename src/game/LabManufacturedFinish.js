import * as THREE from 'three';
import {mapDeckUV} from './LabDeckUV.js';

/** The room kit uses a few honest finishes. Reflection comes from LabGame's
 * shared filtered environment; a low-resolution private sky used to turn
 * bearings into a repeating chrome stripe in every chamber. */
export function manufacturedMaterials(palette){
 const finish=(name,color,roughness,metalness=0,extra={})=>new THREE.MeshStandardMaterial({
  name,color,roughness,metalness,envMap:null,envMapIntensity:.80,...extra,
 });
 const shell=finish('Satin enamel / structural shell',palette.paint,.68,.10);
 const secondary=finish('Satin enamel / machine family',palette.secondary,.66,.10);
 return {
  shell,secondary,
  floor:finish('Honed mineral walking deck',palette.floor,.88,.025,{vertexColors:true}),
  dark:finish('Dark anodised load frame',0x34434c,.68,.24),
  metal:finish('Satin nickel / machined bearing',0xb4bdbb,.48,.70),
  ceramic:finish('Portal porcelain',0xf8f4dd,.63,.025),
  rubber:finish('Rubber isolation gasket',0x202b30,.94),
  light:new THREE.MeshBasicMaterial({name:'Inset signal diffuser',color:palette.accent}),
  white:new THREE.MeshBasicMaterial({name:'Warm service light',color:0xffefc7}),
  shellPanel:finish('Folded enamel / integral flange',palette.paint,.68,.10,{vertexColors:true}),
  secondaryPanel:finish('Folded enamel / machine fascia',palette.secondary,.66,.10,{vertexColors:true}),
 };
}

/** Local contact depth survives the low preset without another shadow pass.
 * Only the existing static solids can darken a deck, and the top remains at
 * its exact standing height. The one closed mesh replaces the source slab;
 * its vertex colours contain broad contact falloff, not a hovering decal. */
function mineralDeckGeometry(width,height,depth,mesh,contacts){
 const bevel=Math.min(.035,height*.12),x0=-width/2,x1=width/2,z0=-depth/2,z1=depth/2;
 const axes=(lo,hi,key)=>{
  const count=Math.min(16,Math.max(2,Math.ceil((hi-lo)/2.5)));
  const values=[lo,lo+bevel,hi-bevel,hi];
  for(let i=1;i<count;i++)values.push(lo+(hi-lo)*i/count);
  // Include the actual joint and its broad falloff so a slender mounting
  // foot is not lost between otherwise metre-scale vertex samples.
  const offset=mesh.position[key];
  for(const box of contacts)for(const edge of [box.min[key],box.max[key]])for(const d of [-.65,0,.65]){
   const value=edge+d-offset;if(value>lo+bevel&&value<hi-bevel)values.push(value);
  }
  const sorted=[...new Set(values.map(v=>Math.round(v*1e5)/1e5))].sort((a,b)=>a-b);
  // Keep a bounded geometry budget even in the largest equipment halls.
  if(sorted.length<=36)return sorted;
  const bounded=[sorted[0],sorted[1]];
  for(let i=1;i<32;i++)bounded.push(sorted[Math.round(1+(sorted.length-4)*i/32)]);
  bounded.push(sorted.at(-2),sorted.at(-1));return [...new Set(bounded)];
 };
 const xs=axes(x0,x1,'x'),zs=axes(z0,z1,'z'),positions=[],colors=[];
 const point=(x,z)=>[x,height/2-Math.max(0,bevel-Math.min(x-x0,x1-x,z-z0,z1-z)),z];
 const shade=(x,z)=>{
  const wx=x+mesh.position.x,wz=z+mesh.position.z;let occlusion=0;
  for(const box of contacts){
   const dx=Math.max(box.min.x-wx,0,wx-box.max.x),dz=Math.max(box.min.z-wz,0,wz-box.max.z);
   const falloff=Math.max(0,1-Math.hypot(dx,dz)/.85);
   occlusion=Math.max(occlusion,falloff*falloff);
  }
  return 1-.24*occlusion;
 };
 const tri=(a,b,c,{top=false,value=.79}={})=>{for(const p of [a,b,c]){positions.push(...p);const tone=top?shade(p[0],p[2]):value;colors.push(tone,tone,tone);}};
 for(let ix=0;ix<xs.length-1;ix++)for(let iz=0;iz<zs.length-1;iz++){
  const a=point(xs[ix],zs[iz]),b=point(xs[ix],zs[iz+1]),c=point(xs[ix+1],zs[iz+1]),d=point(xs[ix+1],zs[iz]);
  tri(a,b,c,{top:true});tri(a,c,d,{top:true});
 }
 const side=(a,b)=>{const c=[b[0],-height/2,b[2]],d=[a[0],-height/2,a[2]];tri(a,b,c);tri(a,c,d);};
 for(let ix=0;ix<xs.length-1;ix++){side(point(xs[ix],z0),point(xs[ix+1],z0));side(point(xs[ix+1],z1),point(xs[ix],z1));}
 for(let iz=0;iz<zs.length-1;iz++){side(point(x1,zs[iz]),point(x1,zs[iz+1]));side(point(x0,zs[iz+1]),point(x0,zs[iz]));}
 tri([x0,-height/2,z0],[x1,-height/2,z0],[x1,-height/2,z1],{value:.70});
 tri([x0,-height/2,z0],[x1,-height/2,z1],[x0,-height/2,z1],{value:.70});
 const geometry=new THREE.BufferGeometry();geometry.name='Mineral deck / integral static contact relief';
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
 geometry.parameters={width,height,depth};return geometry;
}

function finishMineralDecks(k){
 const materials=new Set([k.m.floor,k.m.service].filter(Boolean)),up=new THREE.Vector3(0,1,0);
 for(const material of materials){material.vertexColors=true;material.needsUpdate=true;}
 let decks=0,contactJoints=0,triangles=0;
 k.world.root.updateWorldMatrix(true,true);
 k.world.root.traverse(mesh=>{
  if(!mesh.isMesh||mesh.isInstancedMesh||!materials.has(mesh.material)||mesh.userData?.collisionProxy)return;
  const old=mesh.geometry,p=old.parameters;
  const horizontal=up.clone().applyQuaternion(mesh.quaternion).dot(up)>.9999;
  if(mesh.parent===k.world.root&&horizontal&&p?.width>=8&&p?.depth>=8&&p?.height>=.15&&p?.height<=.8){
   const y=mesh.position.y+p.height/2,bounds=new THREE.Box3().setFromObject(mesh);
   const contacts=k.game.colliders.filter(c=>c.enabled!==false&&!c.kinematic&&c.box.min.y<=y+.06&&c.box.max.y>=y+.18&&
    c.box.max.x>bounds.min.x&&c.box.min.x<bounds.max.x&&c.box.max.z>bounds.min.z&&c.box.min.z<bounds.max.z).map(c=>c.box);
   // Coarse box proxies may surround a whole machine. Avoid baking a large
   // false black pool beneath housings that do not have a local contact.
   const local=contacts.filter(b=>Math.min(b.max.x-b.min.x,b.max.z-b.min.z)<3.2);
   if(!local.length){
    // A clear unsupported landing gains no contact detail from subdivision.
    // Keep its existing cheap rounded slab and only match the batch contract.
    if(!old.attributes.color)old.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(old.attributes.position.count*3).fill(1),3));
    return;
   }
   mesh.geometry=mineralDeckGeometry(p.width,p.height,p.depth,mesh,local);
   mapDeckUV(mesh);old.dispose();decks++;contactJoints+=local.length;
   triangles+=mesh.geometry.attributes.position.count/3;
   mesh.userData.mineralContactFinish=true;
  }else if(!old.attributes.color){
   // Static batching requires the same attributes for ramps, decks and
   // painted walking slabs sharing this material. Untouched faces stay white.
   old.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(old.attributes.position.count*3).fill(1),3));
  }
 });
 return {decks,contactJoints,triangles};
}

/** A closed folded bulkhead with its border and recessed field in ONE mesh.
 * The maximum extents equal the source box, including the front and back.
 * This is a finish inside the authored envelope, not another thin front skin.
 * Large flanges carry the construction; no screws or noisy repeating grain
 * are needed to make a six-metre door read as manufactured equipment. */
export function manufacturedBulkheadGeometry(width,height,depth){
 const rim=Math.min(.34,width*.055,height*.055),bevel=Math.min(.07,rim*.28,depth*.16);
 const fieldDepth=Math.min(.12,depth*.22),corner=Math.min(.14,width*.026,height*.026);
 const loop=(w,h,z,c)=>[
  [-w/2+c,-h/2,z],[w/2-c,-h/2,z],[w/2,-h/2+c,z],[w/2,h/2-c,z],
  [w/2-c,h/2,z],[-w/2+c,h/2,z],[-w/2,h/2-c,z],[-w/2,-h/2+c,z],
 ];
 const vertices=[],colors=[],uv=[];
 const tri=(a,b,c,value)=>{for(const p of [a,b,c]){vertices.push(...p);uv.push(p[0]/width+.5,p[1]/height+.5);colors.push(value,value,value);}};
 const sideBack=loop(width,height,-depth/2+bevel,corner);
 const sideFront=loop(width,height,depth/2-bevel,corner);
 const front=loop(width-2*bevel,height-2*bevel,depth/2,Math.max(.01,corner-bevel));
 const back=loop(width-2*bevel,height-2*bevel,-depth/2,Math.max(.01,corner-bevel));
 const innerFront=loop(width-rim*2,height-rim*2,depth/2,corner*.6);
 const innerBack=loop(width-rim*2,height-rim*2,-depth/2,corner*.6);
 const recessedFront=loop(width-rim*2-2*bevel,height-rim*2-2*bevel,depth/2-fieldDepth,corner*.4);
 const recessedBack=loop(width-rim*2-2*bevel,height-rim*2-2*bevel,-depth/2+fieldDepth,corner*.4);
 const strip=(a,b,value,reverse=false)=>{for(let i=0;i<8;i++){const j=(i+1)%8;if(reverse){tri(a[i],b[j],a[j],value);tri(a[i],b[i],b[j],value);}else{tri(a[i],a[j],b[j],value);tri(a[i],b[j],b[i],value);}}};
 strip(sideBack,sideFront,.58);strip(sideFront,front,.80);strip(sideBack,back,.80,true);
 strip(front,innerFront,.63);strip(back,innerBack,.63,true);
 strip(innerFront,recessedFront,.48);strip(innerBack,recessedBack,.48,true);
 for(let i=0;i<8;i++){const j=(i+1)%8;tri([0,0,depth/2-fieldDepth],recessedFront[i],recessedFront[j],1);tri([0,0,-depth/2+fieldDepth],recessedBack[j],recessedBack[i],1);}
 const geometry=new THREE.BufferGeometry();
 geometry.name='Integral folded bulkhead / recessed field';
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
 // Retain the dimensions for the existing moving-part diagnostics.
 geometry.parameters={width,height,depth};
 return geometry;
}

/** Finish existing factory partitions and real moving leaves. Geometry and
 * material are the only writes: no collider, floor, ray target, transform,
 * mechanism state or per-frame callback is introduced. */
export function finishManufacturedChamber(k){
 if(k.manufacturedFinish)return k.manufacturedFinish;
 const mineral=finishMineralDecks(k);
 let foldedPanels=0,springWinding=0;const bins=k.artBins;
 k.world.root.traverse(mesh=>{
  if(!mesh.isMesh||mesh.isInstancedMesh||mesh.userData?.collisionProxy)return;
  if(mesh.name==='Return spring winding'){
   // The existing spring follows actual bulkhead displacement. A wound
   // torsion strip replaces its old single torus inside the same envelope;
   // the current pivot and reversible mechanical animation remain intact.
   const points=[];
   for(let i=0;i<=160;i++){
    const t=i/160,angle=t*Math.PI*6.5,r=.13+t*.315;
    points.push(new THREE.Vector3(Math.cos(angle)*r,Math.sin(angle)*r,0));
   }
   const old=mesh.geometry;mesh.geometry=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),160,.025,6,false);
   mesh.geometry.name='Wound bulkhead return spring';old.dispose();springWinding++;
  }
  const source=mesh.material,p=mesh.geometry?.parameters;
  if(!p||![p.width,p.height,p.depth].every(Number.isFinite))return;
  const replacement=source===k.m.shell?k.m.shellPanel:source===k.m.secondary?k.m.secondaryPanel:null;
  const shallowChassis=p.height>=.5&&p.height<=1.3&&Math.min(p.width,p.depth)>=6&&Math.max(p.width,p.depth)>=8;
  const upright=p.height>=2.8&&Math.max(p.width,p.depth,p.height)>=4&&Math.max(p.width,p.depth)>=.8&&Math.min(p.width,p.depth)>=.34&&Math.min(p.width,p.depth)<=1.8;
  if(!replacement||(!shallowChassis&&!upright))return;
  const axis=shallowChassis?'y':p.width<p.depth?'x':'z';
  const geometry=axis==='y'?manufacturedBulkheadGeometry(p.width,p.depth,p.height):
   manufacturedBulkheadGeometry(axis==='x'?p.depth:p.width,p.height,axis==='x'?p.width:p.depth);
  if(axis==='x')geometry.rotateY(Math.PI/2);else if(axis==='y')geometry.rotateX(-Math.PI/2);
  geometry.parameters={width:p.width,height:p.height,depth:p.depth};
  // The visual box remains inside its original physical box. Ray registries
  // keep this same mesh, and moving leaves still share the same actual pivot.
  const old=mesh.geometry;mesh.geometry=geometry;mesh.material=replacement;
  mesh.userData.manufacturedFinish=true;old.dispose();foldedPanels++;
  const oldBin=bins.get(source),index=oldBin?.indexOf(mesh)??-1;
  if(index>=0){oldBin.splice(index,1);const newBin=bins.get(replacement)||[];newBin.push(mesh);bins.set(replacement,newBin);}
 });
 // Finish existing envelope cassettes as broad warm mineral fields. A pair
 // of wall families has a distinct colour, so both pilot rooms read in depth.
 const wallMaterials=new Set();
 k.world.root.traverse(mesh=>{
  if(!mesh.isMesh)return;
  const mat=mesh.material;
  if(mat?.name==='Structural laboratory wall'){
   mat.color.setHex(0x66797d);mat.roughness=.84;mat.metalness=.045;mat.envMap=null;mat.envMapIntensity=.45;wallMaterials.add(mat);
  }else if(mat?.name==='Inset mineral wall cassettes'){
   mat.color.setHex(0xb2c0b4);mat.roughness=.88;mat.metalness=.025;mat.envMap=null;mat.envMapIntensity=.45;wallMaterials.add(mat);
  }
 });
 const result=Object.freeze({revision:50,foldedPanels,springWinding,wallFinishes:wallMaterials.size,mineralDecks:mineral.decks,staticContactJoints:mineral.contactJoints,mineralTriangles:mineral.triangles,extraLights:0,perFrameCallbacks:0});
 k.manufacturedFinish=result;k.world.root.userData.manufacturedFinish=result;return result;
}
