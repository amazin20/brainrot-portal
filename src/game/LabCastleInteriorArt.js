import * as THREE from 'three';
import {CASTLE_WING_FINISHES} from './LabCastleMaterials.js';
import {architecturalRectOverlapsPortal} from './LabArchitecturalModels.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),UP=V(0,1,0),Z=V(0,0,1);

/** Interior finishes are mounted on individual real wall slabs, never on the
 * enclosing room rectangle. Doorways, glazing and the spaces between piers
 * therefore remain open. Each piece stays within nine centimetres of stone. */
export function castleInteriorFields(game,level){
 if(!level.tower||!level.rooms?.values)return [];
 const fields=[];
 for(const room of level.rooms.values()){
  const {def}=room,center=V(...def.at),palette=CASTLE_WING_FINISHES[def.id];if(!palette)continue;
  for(const c of game.colliders||[]){
   if(c.enabled===false||c.kinematic||c.mesh.material?.name!=='Castle wing wall / '+def.id)continue;
   const size=c.box.getSize(V()),middle=c.box.getCenter(V());
   if(size.y<2||Math.min(size.x,size.z)>.8||Math.max(size.x,size.z)<2)continue;
   const normal=size.x<size.z?V(Math.sign(center.x-middle.x),0,0):V(0,0,Math.sign(center.z-middle.z));
   if(normal.lengthSq()!==1)continue;
   const surface=middle.clone().addScaledVector(normal,Math.min(size.x,size.z)/2);
   fields.push({id:def.id,center:surface,normal,right:V().crossVectors(UP,normal),up:UP.clone(),
    span:Math.max(size.x,size.z),height:size.y,base:def.at[1],roof:def.at[1]+def.h,support:c.box,palette});
  }
 }
 return fields;
}

function reservedFaces(game,level){
 const faces=[],seen=new Set(),q=new THREE.Quaternion();
 for(const mesh of game.portalPanels||[]){
  const d=mesh.userData,frame=d.portalFrame?.();
  if(frame){faces.push(frame);seen.add(mesh);continue;}
  if(d.center&&d.normal){faces.push({center:d.center,normal:d.normal,up:d.portalUp||UP,
   right:V().crossVectors(d.portalUp||UP,d.normal),halfWidth:d.portalBounds?.halfWidth,halfHeight:d.portalBounds?.halfHeight});seen.add(mesh);}
 }
 // Reserve original labels and instrument plates as well as portal targets.
 level.structure?.traverse(node=>{
  if(!node.isMesh||seen.has(node)||node.geometry?.type!=='PlaneGeometry')return;
  const p=node.geometry.parameters;node.getWorldQuaternion(q);
  faces.push({center:node.getWorldPosition(V()),normal:Z.clone().applyQuaternion(q),
   right:V(1,0,0).applyQuaternion(q),up:UP.clone().applyQuaternion(q),halfWidth:p.width/2,halfHeight:p.height/2});
 });
 return faces;
}

export function installCastleInteriorArt(game,level){
 if(level.castleInteriorArt)return level;
 const fields=castleInteriorFields(game,level),parent=level.structure;if(!fields.length||!parent)return level;
 const excluded=reservedFaces(game,level),groups={panel:[],stone:[],bronze:[]},mounts=[];
 const box=new THREE.BoxGeometry(1,1,1),materials={
  panel:new THREE.MeshStandardMaterial({name:'Castle interior / recessed mineral panel',color:0xffffff,roughness:.9,metalness:.01}),
  stone:new THREE.MeshStandardMaterial({name:'Castle interior / dressed pilaster stone',color:0xffffff,roughness:.8,metalness:.03}),
  bronze:new THREE.MeshStandardMaterial({name:'Castle interior / satin cornice bronze',color:0xffffff,roughness:.62,metalness:.36}),
 };
 const matrix=new THREE.Matrix4(),local=new THREE.Matrix4(),quaternion=new THREE.Quaternion();
 function add(field,role,x,y,width,height,depth,projection,angle=0){
  if(width<.1||height<.07)return;
  const center=field.center.clone().addScaledVector(field.right,x);center.y=y;
  const c=Math.abs(Math.cos(angle)),s=Math.abs(Math.sin(angle)),halfWidth=(width*c+height*s)/2,halfHeight=(height*c+width*s)/2;
  const rect={...field,center,halfWidth:halfWidth+.10,halfHeight:halfHeight+.10};
  // The whole mounted field must be backed by this one fixed slab.
  if(![-1,1].every(u=>[-1,1].every(v=>field.support.containsPoint(center.clone()
   .addScaledVector(field.right,u*rect.halfWidth).addScaledVector(UP,v*rect.halfHeight).addScaledVector(field.normal,-.05)))))return;
  if(excluded.some(face=>{
   const distance=face.center.clone().sub(center).dot(field.normal);if(Math.abs(distance)>3.2)return false;
   const projected={...face,center:face.center.clone().addScaledVector(field.normal,-distance)};
   return architecturalRectOverlapsPortal(rect,projected,.48);
  }))return;
  const position=center.clone().addScaledVector(field.normal,projection-depth/2);
  const basis=new THREE.Matrix4().makeBasis(field.right,UP,field.normal).setPosition(position);
  quaternion.setFromAxisAngle(Z,angle);
  matrix.multiplyMatrices(basis,local.compose(V(),quaternion,V(width,height,depth)));
  const color=new THREE.Color(role==='bronze'?field.palette.accent:field.palette.wall);
  if(role==='panel')color.lerp(new THREE.Color(0x344653),.36);
  if(role==='stone')color.lerp(new THREE.Color(0xf3ebda),.37);
  groups[role].push({matrix:matrix.clone(),color});
  mounts.push({id:field.id,role,center:center.toArray(),normal:field.normal.toArray(),right:field.right.toArray(),
   halfWidth,halfHeight,projection,support:field.support.clone()});
 }
 for(const field of fields){
  const y0=Math.max(field.base+.24,field.center.y-field.height/2+.16),y1=Math.min(field.roof-.3,field.center.y+field.height/2-.16);
  if(y1-y0<1.4)continue;
  const bays=Math.max(1,Math.ceil((field.span-.4)/6.5)),width=(field.span-.4)/bays;
  const dado=Math.min(field.base+3.1,y1-.2),lowTop=Math.min(dado-.14,y1-.32);
  for(let i=0;i<bays;i++){
   const x=-field.span/2+.2+width*(i+.5);
   if(lowTop-y0>.9){
    add(field,'panel',x,(y0+lowTop)/2,width-.52,lowTop-y0,.025,.034);
    add(field,'bronze',x,lowTop-.14,width-.74,.08,.045,.062);
   }
   // Broad mineral ribs give the tall slabs scale from both ground routes
   // and upper balconies; the cap is safely backed and too shallow to stand on.
   for(const side of [-1,1]){
    const px=x+side*(width/2-.17);
    add(field,'stone',px,(y0+y1)/2,.38,y1-y0,.055,.082);
    add(field,'bronze',px,y1-.27,.52,.22,.07,.089);
   }
   if(dado>y0+.9)add(field,'stone',x,dado,width-.44,.18,.06,.078);
   add(field,'stone',x,y1-.10,width-.44,.15,.06,.078);
   // A long, quiet upper inset breaks large blank walls without resembling a
   // white portal address, adding a lamp or introducing fine texture noise.
   const upperBottom=Math.max(dado+.7,y0+.4),upperTop=y1-.65;
   if(upperTop-upperBottom>2.2){
    const h=Math.min(3.4,upperTop-upperBottom),cy=upperTop-h/2;
    add(field,'panel',x,cy,width-.84,h,.018,.026);
    add(field,'bronze',x,upperTop-.12,width-1.1,.10,.04,.056);
    // A pointed vault head is architectural construction, rather than another
    // emblem pasted on a wall. Both legs stay backed by this exact wall slab.
    const run=Math.min((width-1.15)*.36,1.4),rise=Math.min(h*.38,1.1),length=Math.hypot(run,rise);
    const angle=Math.atan2(run,rise);
    for(const side of [-1,1])add(field,'bronze',x+side*run/2,cy+h*.10+rise/2,.105,length,.045,.067,side*angle);
   }
  }
 }
 const root=new THREE.Group();root.name='Castle wing interior architecture';root.userData.visualOnly=true;root.userData.keepMaterial=true;
 parent.updateWorldMatrix(true,false);root.matrix.copy(parent.matrixWorld).invert();root.matrixAutoUpdate=false;parent.add(root);
 for(const [role,entries]of Object.entries(groups)){
  if(!entries.length)continue;
  const mesh=new THREE.InstancedMesh(box,materials[role],entries.length);mesh.name='Castle interior / '+role;mesh.userData.visualOnly=true;
  mesh.receiveShadow=true;mesh.castShadow=false;
  entries.forEach((entry,i)=>{mesh.setMatrixAt(i,entry.matrix);mesh.setColorAt(i,entry.color);});
  mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();root.add(mesh);
 }
 let disposed=false;const dispose=level.dispose;
 level.dispose=function(...args){
  if(disposed)return;disposed=true;root.removeFromParent();for(const mesh of root.children)mesh.dispose();
  box.dispose();for(const material of Object.values(materials))material.dispose();return dispose?.apply(this,args);
 };
 level.castleInteriorArt={root,mounts,diagnostics:Object.freeze({fields:fields.length,wings:new Set(mounts.map(m=>m.id)).size,
  instances:mounts.length,batches:root.children.length,triangles:mounts.length*12,maxProjection:.089,extraColliders:0,extraLights:0}),get disposed(){return disposed;}};
 return level;
}
