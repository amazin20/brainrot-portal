import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

export const OPTICS_ART_REVISION='optics-owned-receivers-and-thermal-cassettes-v2';
const V=(...p)=>new THREE.Vector3(...p),Q=()=>new THREE.Quaternion();
const IVORY=0xc5c6b8,STEEL=0x576d76,DARK=0x293e49,COPPER=0xbd8d60,COOL=0x91c6cb;

function originalReceiver(root,position){
 const matches=[];root.updateWorldMatrix(true,true);
 root.traverse(node=>{
  if(!node.isGroup||node.getWorldPosition(V()).distanceTo(V(...position))>.001)return;
  const barrel=node.children.find(mesh=>mesh.geometry?.type==='CylinderGeometry'&&Math.abs(mesh.geometry.parameters.height-1.7)<.0001);
  const rotor=node.children.find(group=>group.isGroup&&group.children.length===6&&group.children.every(mesh=>mesh.geometry?.type==='BoxGeometry'));
  const ring=node.children.find(mesh=>mesh.geometry?.type==='TorusGeometry'&&Math.abs(mesh.geometry.parameters.tube-.035)<.0001);
  if(barrel&&rotor&&ring)matches.push({barrel,rotor,ring});
 });
 if(matches.length!==1)throw new Error(`Optics art requires one original air receiver at ${position}; found ${matches.length}`);
 return matches[0];
}

/** Room-local manufactured replacements stay inside their existing closed
 * mesh volumes. They follow full source matrices from sibling instance banks:
 * source children, measured boxes, portal materials and physical owners stay
 * intact. Room35's receiver readouts use its real flow/latch and gate position. */
export function installOpticsArt(game,level){
 if(game.chamberEdition!=='foundation'||!level?.world||![34,38].includes(level.index)||level.opticsArt)return level;
 const root=new THREE.Group();root.name='Optics / manufactured receiver and thermal hardware';
 root.userData={visualOnly:true,revision:OPTICS_ART_REVISION};level.world.root.add(root);
 // The bearing faces sit below their captive heads, with a bevel into the
 // raised rim. Previously the flat end caps completely covered those heads.
 // Both end rims and the load flanges keep the original cylindrical volume.
 const profile=[[0,-.44],[.82,-.44],[.88,-.5],[.94,-.5],[1,-.44],[1,-.28],[.87,-.28],[.87,.28],[1,.28],[1,.44],[.94,.5],[.88,.5],[.82,.44],[0,.44]];
 const geometries={box:new RoundedBoxGeometry(1,1,1,1,.025),casing:new THREE.LatheGeometry(profile.map(p=>new THREE.Vector2(...p)),32),bolt:new THREE.CylinderGeometry(1,1,1,6)};
 const materials={paint:new THREE.MeshStandardMaterial({name:'Optics folded mineral enamel',color:0xffffff,roughness:.58,metalness:.22,envMapIntensity:.6}),metal:new THREE.MeshStandardMaterial({name:'Optics machined copper and steel',color:0xffffff,roughness:.39,metalness:.72,envMapIntensity:.7})};
 const mounts=[],banks=new Map(),replacements=[],readouts=[];
 const stats={parts:0,batches:0,mounts:[],extraLights:0,extraColliders:0,independentClocks:0,renderCallbacks:1};
 function replacement(target,{hidden=false}={}){
  const original=target.material,clones=[];
  const clone=material=>{const copy=material.clone();copy.visible=!hidden;clones.push(copy);return copy;};
  target.material=Array.isArray(original)?original.map(clone):clone(original);
  replacements.push({target,original,replacement:target.material,clones});return target.material;
 }
 function mount(target,name,{cylindrical=false}={}){
  if(!target?.isMesh||target.userData.portalable||target.userData.portalTile)throw new Error(`Optics art requires an original closed owner: ${name}`);
  target.geometry.computeBoundingBox();
  const owner={target,name,bounds:target.geometry.boundingBox.clone(),parts:[],cylindrical};
  if(cylindrical){const p=target.geometry.parameters;if(p.radiusTop!==p.radiusBottom||!(p.radiusTop>0))throw new Error('Optics receiver requires its original round barrel');owner.radius=p.radiusTop;owner.height=p.height;}
  replacement(target,{hidden:true});mounts.push(owner);stats.mounts.push(name);return owner;
 }
 function part(owner,position,size,{geometry='box',color=IVORY,metal=false,rotation=Q()}={}){
  if(![...position,...size,...rotation.toArray()].every(Number.isFinite)||size.some(n=>n<=0))throw new Error('Optics hardware requires finite positive dimensions');
  const matrix=new THREE.Matrix4().compose(V(...position),rotation,V(...size));
  geometries[geometry].computeBoundingBox();const bounds=geometries[geometry].boundingBox.clone().applyMatrix4(matrix);
  if(!owner.bounds.clone().expandByScalar(.00001).containsBox(bounds))throw new Error(`Optics hardware escaped original closed volume: ${owner.name}`);
  if(owner.cylindrical){const vertices=geometries[geometry].attributes.position,p=V();for(let n=0;n<vertices.count;n++){
   p.fromBufferAttribute(vertices,n).applyMatrix4(matrix);
   if(Math.hypot(p.x,p.z)>owner.radius+.00001||Math.abs(p.y)>owner.height/2+.00001)throw new Error(`Optics hardware escaped original round casing: ${owner.name}`);
  }}
  const entry={owner,matrix,bounds,color,index:-1},key=`${geometry}:${metal?'metal':'paint'}`,list=banks.get(key)??[];
  list.push(entry);banks.set(key,list);owner.parts.push(entry);stats.parts++;return entry;
 }
 function receiverCasting(target,name){
  const owner=mount(target,name,{cylindrical:true}),r=owner.radius,h=owner.height;
  part(owner,[0,0,0],[r,h,r],{geometry:'casing',color:IVORY});
  // Axial cast ribs terminate on both flanges; recessed hex fasteners sit on
  // the bearing faces. Every vertex remains in the original round casting.
  for(let n=0;n<6;n++){
   const angle=n*Math.PI/3,rotation=Q().setFromAxisAngle(V(0,1,0),-angle);
   part(owner,[Math.cos(angle)*r*.90,0,Math.sin(angle)*r*.90],[r*.10,h*.64,r*.10],{color:STEEL,metal:true,rotation});
   for(const sign of [-1,1])part(owner,[Math.cos(angle)*r*.72,sign*h*.465,Math.sin(angle)*r*.72],[r*.052,h*.06,r*.052],{geometry:'bolt',color:COPPER,metal:true});
  }
 }
 function thermalLeaf(target,name,paint){
  const owner=mount(target,name),size=owner.bounds.getSize(V()),center=owner.bounds.getCenter(V());
  // The original leaf has an .08 m roundover. Keep the facade inside its
  // flat face footprint as well as its AABB, including every corner fitting.
  owner.roundedRadius=.08;const w=size.x-.16,h=size.y-.16,d=size.z;
  const box=(x,y,z,a,b,c,color=paint,metal=false)=>part(owner,center.clone().add(V(x,y,z)).toArray(),[a,b,c],{color,metal});
  const flange=.20,well=d*.27;
  box(0,0,0,w,h,d-2*well,DARK);
  for(const sign of [-1,1]){
   for(const x of [-1,1])box(x*(w-flange)/2,0,sign*(d/2-well/2),flange,h,well,STEEL,true);
   for(const y of [-1,1])box(0,y*(h-flange)/2,sign*(d/2-well/2),w-2*flange,flange,well,STEEL,true);
   const cw=(w-2*flange)/3,inner=h-2*flange;
   for(let n=0;n<3;n++){
    const x=(n-1)*cw;
    box(x,0,sign*(d/2-well*.72),cw-.045,inner-.045,well*.35,n===1?paint:IVORY);
    for(const side of [-1,1])box(x+side*(cw/2-.08),0,sign*(d/2-well*.39),.09,inner-.12,well*.58,paint);
    // Folded horizontal copper returns expose a real recessed, closed leaf;
    // they do not imply another motor or a separate thermal measurement.
    for(const y of [-1,1]){
     box(x,y*inner*.29,sign*(d/2-well*.34),cw-.24,.09,well*.38,COPPER,true);
     part(owner,center.clone().add(V(x,y*(inner/2-.14),sign*(d/2-well*.18))).toArray(),[.043,well*.15,.043],{geometry:'bolt',metal:true,color:COPPER,rotation:Q().setFromAxisAngle(V(1,0,0),Math.PI/2)});
    }
   }
  }
 }
 if(level.index===34){
  for(const [index,position]of [[-19,3,23],[-19,3,4]].entries()){
   const receiver=originalReceiver(level.world.root,position);
   receiverCasting(receiver.barrel,`35 / air receiver ${index+1} flanged bearing casting`);
   const material=replacement(receiver.ring),rotation=receiver.rotor.rotation.z;
   readouts.push({...receiver,index,material,rotation});
  }
 }else{
  thermalLeaf(level.first.mesh,'39 / original expansion-driven thermal cassette',COPPER);
  thermalLeaf(level.second.mesh,'39 / original illuminated return cassette',COOL);
 }
 for(const [key,list]of banks){
  const [geometry,material]=key.split(':'),mesh=new THREE.InstancedMesh(geometries[geometry],materials[material],list.length);
  mesh.name=`Optics manufactured ${key}`;mesh.castShadow=false;mesh.receiveShadow=true;mesh.frustumCulled=false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);root.add(mesh);
  list.forEach((entry,index)=>{entry.mesh=mesh;entry.index=index;mesh.setColorAt(index,new THREE.Color(entry.color));});mesh.instanceColor.needsUpdate=true;stats.batches++;
 }
 root.userData.stats=stats;
 const inverse=new THREE.Matrix4(),pose=new THREE.Matrix4(),matrix=new THREE.Matrix4();let disposed=false;
 function sync(){
  if(disposed)return;
  if(readouts.length){
   const powered=level.powered();
   for(const readout of readouts){
    const gate=readout.index===0?level.first:level.second,latched=readout.index===0?level.isFirstLatched():level.isLatched();
    // These are position indicators for the actual driven gate, not free
    // running decorative motors. A retained gate stays at its real position.
    readout.rotor.rotation.z=gate.progress*Math.PI*1.5;
    const color=powered[readout.index]?0x9ce7ed:latched?0xe3b577:0x354e59;
    readout.material.color.setHex(color);readout.material.emissive?.setHex(color);
   }
  }
  root.updateWorldMatrix(true,false);inverse.copy(root.matrixWorld).invert();
  for(const owner of mounts){owner.target.updateWorldMatrix(true,false);pose.multiplyMatrices(inverse,owner.target.matrixWorld);
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
  for(const list of banks.values())list[0].mesh.dispose();root.clear();
  for(const entry of replacements){if(entry.target.material===entry.replacement)entry.target.material=entry.original;for(const copy of entry.clones)copy.dispose();}
  for(const readout of readouts)readout.rotor.rotation.z=readout.rotation;
  for(const geometry of Object.values(geometries))geometry.dispose();for(const material of Object.values(materials))material.dispose();
  if(level.renderUpdate===render)level.renderUpdate=oldRender;if(level.reset===reset)level.reset=oldReset;
  if(restoreLifecycle&&level.dispose===dispose)level.dispose=oldDispose;if(level.opticsArt===root)delete level.opticsArt;
 }
 root.dispose=()=>release(true);root.mounts=mounts;root.readouts=readouts;
 root.ownedResources=[...banks.values()].map(list=>list[0].mesh).concat(Object.values(geometries),Object.values(materials),replacements.flatMap(entry=>entry.clones));
 level.renderUpdate=render;level.reset=reset;level.dispose=dispose;level.opticsArt=root;sync();return level;
}
