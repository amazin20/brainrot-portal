import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

export const SECOND_CHAPTER_ART_REVISION='second-chapter-industrial-energy-v1';
const V=(...p)=>new THREE.Vector3(...p),Q=()=>new THREE.Quaternion();
const COPPER=0xb4774e,ENAMEL=0xd3c3a7,STEEL=0x879990,DARK=0x293f3c;

function localBounds(object){
 object.updateWorldMatrix(true,true);
 if(object.isMesh){object.geometry.computeBoundingBox();return object.geometry.boundingBox.clone();}
 const inverse=object.matrixWorld.clone().invert(),box=new THREE.Box3();
 object.traverse(node=>{
  if(!node.isMesh)return;
  node.geometry.computeBoundingBox();
  box.union(node.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(node.matrixWorld)));
 });
 return box;
}

function boxAt(root,position,size){
 const at=V(...position),span=V(...size),found=[];
 root.updateWorldMatrix(true,true);
 root.traverse(node=>{
  if(!node.isMesh||node.isInstancedMesh||node.userData?.portalTile||node.userData?.collisionProxy)return;
  const p=node.geometry?.parameters;
  if(!p||![p.width,p.height,p.depth].every(Number.isFinite))return;
  if(V(p.width,p.height,p.depth).distanceTo(span)>.025)return;
  if(node.getWorldPosition(V()).distanceTo(at)<.035)found.push(node);
 });
 if(found.length!==1)throw new Error(`Second chapter art: expected one closed chassis at ${position}; found ${found.length}`);
 return found[0];
}

/** The manufactured coat is wholly inside a previously closed solid. The
 * original ray/physics mesh keeps its visibility, geometry, matrix and parent.
 * Only its room-local render material is replaced by an invisible copy; no
 * imported asset, portal, mirror or independently controlled signal is coated.
 * Followers are siblings, because several actuators measure their own subtree
 * with Box3.setFromObject every physical step. */
export function installSecondChapterArt(game,level){
 if(game.chamberEdition!=='foundation'||!level?.world||level.index<10||level.index>19||level.secondChapterArt)return level;
 const root=new THREE.Group();root.name='Second chapter / founded manufactured energy machinery';
 root.userData={visualOnly:true,revision:SECOND_CHAPTER_ART_REVISION};level.world.root.add(root);
 const geometries={box:new RoundedBoxGeometry(1,1,1,1,.035),bolt:new THREE.CylinderGeometry(1,1,1,6)};
 const materials={
  enamel:new THREE.MeshStandardMaterial({name:'Second chapter baked copper enamel',color:0xffffff,roughness:.62,metalness:.14,envMapIntensity:.55}),
  metal:new THREE.MeshStandardMaterial({name:'Second chapter machined steel and copper',color:0xffffff,roughness:.39,metalness:.72,envMapIntensity:.7}),
 };
 const mounts=[],hidden=[],banks=new Map(),entries=[];
 const stats={chassis:0,pedestals:0,parts:0,batches:0,extraLights:0,extraColliders:0,independentClocks:0,renderCallbacks:1,mounts:[]};
 const mount=(target,name,bounds=localBounds(target))=>{
  const entry={target,name,bounds,parts:[]};mounts.push(entry);stats.mounts.push(name);return entry;
 };
 function part(owner,position,size,{material='enamel',color=ENAMEL,rotation=Q(),geometry='box'}={}){
  if(![...position,...size,...rotation.toArray()].every(Number.isFinite)||size.some(n=>n<=0))throw new Error('Finite manufactured part required');
  const matrix=new THREE.Matrix4().compose(V(...position),rotation,V(...size));
  geometries[geometry].computeBoundingBox();
  const bounds=geometries[geometry].boundingBox.clone().applyMatrix4(matrix),allowed=owner.bounds.clone().expandByScalar(.00001);
  if(!allowed.containsBox(bounds))throw new Error(`Second chapter art escaped original chassis: ${owner.name}`);
  const key=`${geometry}:${material}`,entry={owner,matrix,bounds,color,key,index:-1};
  const bank=banks.get(key)||[];bank.push(entry);banks.set(key,bank);owner.parts.push(entry);entries.push(entry);stats.parts++;
 }
 function coat(target,name,{axis=2,paint=COPPER,vents=true,walkingTop=false}={}){
  const owner=mount(target,name),b=owner.bounds,size=b.getSize(V()),center=b.getCenter(V());
  if(Math.min(size.x,size.y,size.z)<.15)throw new Error(`Closed chassis too thin: ${name}`);
  const original=target.material;
  const hide=material=>{const copy=material.clone();copy.visible=false;hidden.push({copy});return copy;};
  target.material=Array.isArray(original)?original.map(hide):hide(original);hidden.push({target,original,replacement:target.material});
  const normal=V(),right=V(),up=V();
  if(axis===0){normal.set(1,0,0);right.set(0,0,-1);up.set(0,1,0);}
  else if(axis===1){normal.set(0,1,0);right.set(1,0,0);up.set(0,0,-1);}
  else{normal.set(0,0,1);right.set(1,0,0);up.set(0,1,0);}
  const width=Math.abs(size.dot(right)),height=Math.abs(size.dot(up)),depth=Math.abs(size.dot(normal));
  const basis=new THREE.Matrix4().makeBasis(right,up,normal),rotation=Q().setFromRotationMatrix(basis);
  const border=Math.min(.25,width*.085,height*.085),well=Math.min(.16,depth*.26);
  const p=(x,y,z)=>center.clone().addScaledVector(right,x).addScaledVector(up,y).addScaledVector(normal,z).toArray();
  const box=(x,y,z,w,h,d,color,metal=false)=>part(owner,p(x,y,z),[w,h,d],{color,rotation,material:metal?'metal':'enamel'});
  // One recessed, opaque core closes both wells. Folded perimeter returns
  // reach the original body envelope; there are no holes through the solid.
  box(0,0,0,width,height,depth-2*well,DARK);
  for(const side of [-1,1]){
   const face=side*(depth/2-well/2);
   for(const x of [-1,1])box(x*(width-border)/2,0,face,border,height,well,paint);
   for(const y of [-1,1])box(0,y*(height-border)/2,face,width-2*border,border,well,paint);
   // A walking beam keeps its top within half a millimetre of its physical
   // plane. Only its underside receives a deep service recess.
   if(walkingTop&&axis===1&&side===1){box(0,0,depth/2-.0155,width-2*border,height-2*border,.03,ENAMEL);continue;}
   const columns=width>7?3:width>3?2:1,rows=height>8?3:height>3?2:1;
   const cellW=(width-2*border)/columns,cellH=(height-2*border)/rows;
   for(let col=0;col<columns;col++)for(let row=0;row<rows;row++){
    const x=-width/2+border+cellW*(col+.5),y=-height/2+border+cellH*(row+.5);
    const seam=Math.min(.065,cellW*.055,cellH*.055),cw=cellW-seam,ch=cellH-seam;
    const z=side*(depth/2-well*.57),cover=Math.min(.035,well*.3);
    box(x,y,z,cw,ch,cover,(row+col)%3===0?ENAMEL:paint);
    // The service panel sits below its folded flange. Its stamped steel
    // stiffener and louvres have real depth, with a closed dark well behind.
    const rail=Math.min(.10,ch*.12),inset=Math.min(.12,cw*.13,ch*.18);
    box(x,y-ch/2+rail*.75,z+side*cover,Math.max(.02,cw-.03),rail,cover,STEEL,true);
    if(vents&&ch>.65&&cw>.8){
     const vh=Math.min(.72,ch*.32),vw=Math.min(1.6,cw*.64),vy=y-ch*.18;
     box(x,vy,z+side*(cover*.55),vw,vh,cover,DARK);
     for(let slat=0;slat<5;slat++)box(x,vy-vh*.36+slat*vh*.18,z+side*cover,vw-.055,Math.min(.055,vh*.09),cover,STEEL,true);
    }
    const r=Math.min(.045,cw*.035,ch*.065),length=Math.min(.025,well*.18);
    const boltRotation=Q().setFromUnitVectors(V(0,1,0),normal.clone().multiplyScalar(side));
    for(const sx of [-1,1])for(const sy of [-1,1])part(owner,p(x+sx*(cw/2-inset),y+sy*(ch/2-inset),z+side*(cover+length/2)),[r,length,r],{geometry:'bolt',material:'metal',color:STEEL,rotation:boltRotation});
   }
  }
  stats.chassis++;return owner;
 }
 function pedestal(art,name){
  const owner=mount(art,name),b=owner.bounds,s=b.getSize(V()),c=b.getCenter(V());
  const height=Math.min(.22,s.y*.09),bottom=b.min.y+.006;
  // A grounded shoe is within the existing solid machine proxy. Source GLB
  // triangles and paint remain fully visible, including every blade and foot.
  part(owner,[c.x,bottom+height/2,c.z],[s.x*.88,height,s.z*.88],{color:DARK});
  part(owner,[c.x,bottom+height*.78,c.z],[s.x*.84,height*.26,s.z*.84],{color:STEEL,material:'metal'});
  const radius=Math.min(.065,s.x*.025,s.z*.025),length=height*.22;
  for(const sx of [-1,1])for(const sz of [-1,1])part(owner,[c.x+sx*s.x*.34,bottom+height*.96,c.z+sz*s.z*.34],[radius,length,radius],{geometry:'bolt',material:'metal',color:COPPER});
  stats.pedestals++;
 }
 function underLift(panel,name){
  const parent=panel?.group?.parent;
  if(!parent)throw new Error(`Second chapter art missing lift: ${name}`);
  const chassis=parent.children.find(n=>n.isMesh&&n.geometry?.parameters?.height===.4&&Math.abs(n.position.y+.25)<.001);
  if(!chassis)throw new Error(`Second chapter art missing closed underside: ${name}`);
  coat(chassis,name,{axis:1,paint:ENAMEL,vents:false,walkingTop:true});
 }
 const w=level.world;
 switch(level.index){
  case 10:
   pedestal(level.state.blower.art.art,'11 / original blower grounded load shoe');
   pedestal(level.state.flywheel.art.art,'11 / turning receiver grounded load shoe');
   break;
  case 11:
   coat(boxAt(w.root,[-12.5,3.3,-11.25],[11,6.6,7.5]),'12 / folded landing load enclosure',{paint:ENAMEL});
   coat(boxAt(w.root,[10,13.9,.4],[6.3,6.7,.6]),'12 / freight receiver bulkhead',{paint:COPPER});
   break;
  case 12:
   coat(boxAt(w.root,[4,2,0],[18,12,11]),'13 / optical branch separation enclosure',{paint:ENAMEL});
   for(const name of ['north-cage','south-cage']){
    const surface=w.surfaces.find(s=>s.name===name);underLift(surface,`13 / ${name} optical lift underside`);
   }
   break;
  case 13:
   coat(boxAt(w.root,[-10,5.1,-6.75],[2.4,.45,.5]),'14 / closed light-sheet projector chassis',{paint:COPPER,vents:false});
   for(const n of [2,7,12])coat(level.state.counterweightStair.parts[n].casing,`14 / counterweighted tread ${n+1} closed casing`,{axis:1,paint:ENAMEL,vents:false,walkingTop:true});
   break;
  case 14:
   coat(level.state.funnel.housing,'15 / reversible field closed backplate',{axis:1,paint:COPPER,vents:false});
   break;
  case 15:
   underLift(w.surfaces.find(s=>s.name==='counterweight-lift'),'16 / counterweight lift load chassis');
   coat(w.root.getObjectByName('Service dock retaining plinth'),'16 / founded service dock retaining chassis',{axis:2,paint:ENAMEL,vents:false});
   break;
  case 16:
   coat(w.root.getObjectByName('Continuously cable-supported walking floor'),'17 / continuous cable-supported load beam',{axis:1,paint:ENAMEL,vents:false,walkingTop:true});
   break;
  case 17:
   coat(level.door.mesh,'18 / self-locking electrical door enclosure',{paint:ENAMEL});
   coat(level.hatch[4].mesh,'18 / driven contact-cell roof casing',{axis:1,paint:COPPER,vents:false,walkingTop:true});
   break;
  case 18:
   underLift(w.surfaces.find(s=>s.name==='glass-observer'),'19 / optical observer guided underside');
   coat(boxAt(w.root,[-12.5,7.72,-11.5],[9,.32,3]),'19 / permanent drive landing load fascia',{axis:1,paint:COPPER,vents:false,walkingTop:true});
   break;
  case 19:
   coat(level.leaf.mesh,'20 / massive entry gate manufactured leaf',{paint:ENAMEL,vents:false});
   coat(level.returnLeaf.mesh,'20 / massive return gate manufactured leaf',{paint:COPPER,vents:false});
   break;
 }
 for(const [key,list]of banks){
  const [geometry,material]=key.split(':'),mesh=new THREE.InstancedMesh(geometries[geometry],materials[material],list.length);
  mesh.name=`Second chapter manufactured ${key}`;mesh.castShadow=false;mesh.receiveShadow=true;mesh.frustumCulled=false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);root.add(mesh);list.forEach((entry,index)=>{entry.mesh=mesh;entry.index=index;mesh.setColorAt(index,new THREE.Color(entry.color));});
  mesh.instanceColor.needsUpdate=true;stats.batches++;
 }
 root.userData.stats=stats;
 const inverse=new THREE.Matrix4(),pose=new THREE.Matrix4(),matrix=new THREE.Matrix4();
 let disposed=false;
 function sync(){
  if(disposed)return;
  root.updateWorldMatrix(true,false);inverse.copy(root.matrixWorld).invert();
  for(const owner of mounts){
   owner.target.updateWorldMatrix(true,false);pose.multiplyMatrices(inverse,owner.target.matrixWorld);
   for(const entry of owner.parts)entry.mesh.setMatrixAt(entry.index,matrix.multiplyMatrices(pose,entry.matrix));
  }
  for(const list of banks.values())list[0].mesh.instanceMatrix.needsUpdate=true;
 }
 const oldRender=level.renderUpdate,oldReset=level.reset,oldDispose=level.dispose;
 const render=function(...args){const result=oldRender?.apply(this,args);sync();return result;};
 const reset=function(...args){const result=oldReset?.apply(this,args);sync();return result;};
 const dispose=function(...args){if(disposed)return;release(false);return oldDispose?.apply(this,args);};
 function release(restoreLifecycle=true){
  if(disposed)return;disposed=true;root.removeFromParent();
  for(const list of banks.values())list[0].mesh.dispose();
  root.clear();
  for(const entry of hidden)if(entry.target&&entry.target.material===entry.replacement)entry.target.material=entry.original;
  for(const geometry of Object.values(geometries))geometry.dispose();
  for(const material of Object.values(materials))material.dispose();
  for(const entry of hidden)entry.copy?.dispose();
  if(level.renderUpdate===render)level.renderUpdate=oldRender;
  if(level.reset===reset)level.reset=oldReset;
  if(restoreLifecycle&&level.dispose===dispose)level.dispose=oldDispose;
  if(level.secondChapterArt===root)delete level.secondChapterArt;
 }
 // Explicit release is useful when the presentation is rebuilt while the
 // physics owner survives. Normal level lifetime calls the wrapper above.
 root.dispose=()=>release(true);root.mounts=mounts;root.ownedResources=[...banks.values()].map(list=>list[0].mesh).concat(Object.values(geometries),Object.values(materials),hidden.flatMap(e=>e.copy?[e.copy]:[]));
 level.renderUpdate=render;level.reset=reset;level.dispose=dispose;level.secondChapterArt=root;sync();
 return level;
}
