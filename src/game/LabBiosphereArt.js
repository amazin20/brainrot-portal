import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

export const BIOSPHERE_ART_REVISION='biosphere-founded-drive-and-shutters-v2';
const V=(...v)=>new THREE.Vector3(...v),Q=()=>new THREE.Quaternion();
const JADE=0x6b9585,MINERAL=0xb7aa8c,STEEL=0x526b68,BRONZE=0xb58b58,DARK=0x263e40;
const TARGET_ROOMS=new Set([20,21,22,25,28]);

function meshBounds(mesh){
 if(!mesh?.isMesh||!mesh.geometry)throw new Error('Biosphere art requires an original closed mesh');
 mesh.geometry.computeBoundingBox();return mesh.geometry.boundingBox.clone();
}
function uniqueBox(root,position,size){
 const found=[];root.updateWorldMatrix(true,true);
 root.traverse(mesh=>{
  if(!mesh.isMesh||mesh.isInstancedMesh||mesh.userData?.portalable||mesh.userData?.portalTile)return;
  const p=mesh.geometry?.parameters;
  if(!p||![p.width,p.height,p.depth].every(Number.isFinite))return;
  if(V(p.width,p.height,p.depth).distanceTo(V(...size))>.0001)return;
  if(mesh.getWorldPosition(V()).distanceTo(V(...position))<.001)found.push(mesh);
 });
 if(found.length!==1)throw new Error(`Biosphere art expected one original closed box at ${position}; found ${found.length}`);
 return found[0];
}

/** These models occupy original closed chassis volumes. The original meshes
 * remain the actual collision, ray, portal and contact owners, with unchanged
 * geometry, visibility and children. Only room-local render material copies
 * are hidden. Every manufactured model follows its source's full matrix from
 * a separate sibling batch: Box3.setFromObject(source) stays authoritative. */
export function installBiosphereArt(game,level){
 if(game.chamberEdition!=='foundation'||!level?.world||!TARGET_ROOMS.has(level.index)||level.biosphereArt)return level;
 if(level.index===22&&(!level.room23PhysicalPrototype||!level.balance?.parts))return level;
 const root=new THREE.Group();root.name='Biosphere / founded manufactured drive machinery';
 root.userData={visualOnly:true,revision:BIOSPHERE_ART_REVISION};level.world.root.add(root);
 // The recessed bearing faces expose the existing captive fasteners. The
 // earlier full-height centre caps buried every head inside the casting.
 // The unchanged outer friction rim still owns the full original envelope.
 const latheProfile=[[0,-.42],[.62,-.42],[.74,-.24],[.90,-.24],[.94,-.5],[1,-.5],[1,.5],[.94,.5],[.90,.24],[.74,.24],[.62,.42],[0,.42]];
 const geometries={
  box:new RoundedBoxGeometry(1,1,1,1,.025),
  disc:new THREE.LatheGeometry(latheProfile.map(p=>new THREE.Vector2(...p)),32),
  bolt:new THREE.CylinderGeometry(1,1,1,6),
 };
 const materials={
  enamel:new THREE.MeshStandardMaterial({name:'Biosphere folded jade enamel',color:0xffffff,roughness:.61,metalness:.19,envMapIntensity:.55}),
  metal:new THREE.MeshStandardMaterial({name:'Biosphere bronze drive and machined steel',color:0xffffff,roughness:.38,metalness:.72,envMapIntensity:.7}),
 };
 const mounts=[],hidden=[],banks=new Map();
 const stats={chassis:0,driveDiscs:0,parts:0,batches:0,extraLights:0,extraColliders:0,independentClocks:0,renderCallbacks:1,mounts:[]};
 function mount(target,name,{hide=true,cylindrical=false}={}){
  const owner={target,name,bounds:meshBounds(target),parts:[],cylindrical};
  if(cylindrical){const p=target.geometry.parameters;if(p.radiusTop!==.4||p.radiusBottom!==.4||p.height!==.08)throw new Error('Biosphere art requires the original Room23 drive disc');}
  if(hide){
   if(target.userData?.portalable||target.userData?.portalTile)throw new Error(`Biosphere art cannot coat a portal: ${name}`);
   const original=target.material;
   const copy=mat=>{const replacement=mat.clone();replacement.visible=false;hidden.push({copy:replacement});return replacement;};
   target.material=Array.isArray(original)?original.map(copy):copy(original);hidden.push({target,original,replacement:target.material});
  }
  mounts.push(owner);stats.mounts.push(name);return owner;
 }
 function part(owner,position,size,{color=JADE,metal=false,rotation=Q(),geometry='box'}={}){
  if(![...position,...size,...rotation.toArray()].every(Number.isFinite)||size.some(n=>n<=0))throw new Error('Finite biosphere manufactured part required');
  const matrix=new THREE.Matrix4().compose(V(...position),rotation,V(...size));
  geometries[geometry].computeBoundingBox();
  const bounds=geometries[geometry].boundingBox.clone().applyMatrix4(matrix);
  if(!owner.bounds.clone().expandByScalar(.00001).containsBox(bounds))throw new Error(`Biosphere art escaped original chassis: ${owner.name}`);
  // Axis-aligned bounds alone would allow square corners outside a round
  // drum. Check the actual transformed triangles against its circular rim.
  if(owner.cylindrical){const vertices=geometries[geometry].attributes.position,p=V();
   for(let i=0;i<vertices.count;i++){p.fromBufferAttribute(vertices,i).applyMatrix4(matrix);if(Math.hypot(p.x,p.z)>.400001||Math.abs(p.y)>.040001)throw new Error(`Biosphere art escaped original round drive: ${owner.name}`);}
  }
  const key=`${geometry}:${metal?'metal':'enamel'}`,entry={owner,matrix,bounds,color,index:-1};
  const list=banks.get(key)??[];list.push(entry);banks.set(key,list);owner.parts.push(entry);stats.parts++;return entry;
 }
 function faceFrame(owner,axis){
  const center=owner.bounds.getCenter(V()),size=owner.bounds.getSize(V()),normal=V(),right=V(),up=V();
  if(axis===0){normal.set(1,0,0);right.set(0,0,-1);up.set(0,1,0);}
  else if(axis===1){normal.set(0,1,0);right.set(1,0,0);up.set(0,0,-1);}
  else{normal.set(0,0,1);right.set(1,0,0);up.set(0,1,0);}
  const rotation=Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,normal));
  const width=Math.abs(size.dot(right)),height=Math.abs(size.dot(up)),depth=Math.abs(size.dot(normal));
  const p=(x,y,z)=>center.clone().addScaledVector(right,x).addScaledVector(up,y).addScaledVector(normal,z).toArray();
  const box=(x,y,z,w,h,d,color=JADE,metal=false,angle=0)=>part(owner,p(x,y,z),[w,h,d],{color,metal,rotation:rotation.clone().multiply(Q().setFromAxisAngle(V(0,0,1),angle))});
  const bolt=(x,y,z,r,length,color=BRONZE)=>part(owner,p(x,y,z),[r,length,r],{color,metal:true,geometry:'bolt',rotation:Q().setFromUnitVectors(V(0,1,0),normal)});
  return{width,height,depth,p,box,bolt};
 }
 function shutter(target,name,{axis=2,paint=JADE,segments=3,diagonal=false}={}){
  const owner=mount(target,name),f=faceFrame(owner,axis),{width:w,height:h,depth:d,box,bolt}=f;
  const flange=Math.min(.23,w*.06,h*.06),well=d*.22,core=d-2*well;
  // A complete closed core supports two recessed faces. Broad folded leaves
  // and the load-carrying returns establish the gate before small fittings.
  box(0,0,0,w,h,core,DARK);
  for(const sign of [-1,1]){
   const z=sign*(d/2-well/2),skin=well*.34,fieldZ=sign*(d/2-well*.70);
   for(const x of [-1,1])box(x*(w-flange)/2,0,z,flange,h,well,STEEL,true);
   for(const y of [-1,1])box(0,y*(h-flange)/2,z,w-2*flange,flange,well,STEEL,true);
   const cellW=(w-2*flange)/segments,innerH=h-2*flange;
   for(let n=0;n<segments;n++){
    const x=-w/2+flange+cellW*(n+.5),cw=cellW-.045;
    box(x,0,fieldZ,cw,innerH-.045,skin,n%2?MINERAL:paint);
    // Each cassette has two deep rolled vertical returns rather than a
    // flat coloured rectangle with a bolt grid pasted over it.
    for(const sx of [-1,1])box(x+sx*(cw/2-.055),0,sign*(d/2-well*.42),.075,innerH-.12,well*.57,paint);
    if(diagonal){
     const spanX=Math.max(.1,cw-.3),spanY=innerH*.62,length=Math.hypot(spanX,spanY),angle=(n%2?1:-1)*Math.atan2(spanY,spanX);
     box(x,0,sign*(d/2-well*.37),length,.10,well*.38,BRONZE,true,angle);
    }else for(const y of [-1,1])box(x,y*innerH*.30,sign*(d/2-well*.37),Math.max(.1,cw-.18),.09,well*.38,BRONZE,true);
    // Seat the existing heads in their own cassette skin. The shallow
    // freight backstop has its transverse brace under these heads, so its
    // original raised seat is already supported and must remain above it.
    const headY=innerH/2-.16,onBrace=!diagonal&&Math.abs(headY-innerH*.30)<.045;
    const headZ=onBrace?sign*(d/2-well*.20):fieldZ+sign*(skin/2+well*.04);
    for(const y of [-1,1])bolt(x,y*headY,headZ,Math.min(.043,cw*.04),well*.16);
   }
  }
  stats.chassis++;return owner;
 }
 function deckChassis(target,name,{paint=MINERAL}={}){
  const owner=mount(target,name),{width:w,height:h,depth:d,box,bolt}=faceFrame(owner,1),well=d*.30;
  // The top plate remains at its actual support plane. Under it, a deep
  // closed gearbox well is bounded by two longitudinal rails and cross ribs.
  box(0,0,d/2-.012,w,h,.024,paint);
  box(0,0,.025,w,h,Math.max(.01,d-2*well),DARK);
  const rail=Math.min(.22,w*.08,h*.08);
  for(const x of [-1,1])box(x*(w-rail)/2,0,-d/2+well/2,rail,h,well,STEEL,true);
  for(const y of [-1,1])box(0,y*(h-rail)/2,-d/2+well/2,w-2*rail,rail,well,paint);
  for(const y of [-.25,0,.25])box(0,y*h,-d/2+well*.72,w-2*rail,.10,well*.43,BRONZE,true);
  const panelW=w*.55,panelH=h*.55;
  const panelZ=-d/2+well*.88,panelDepth=Math.min(.035,well*.25),headLength=well*.18;
  box(0,0,panelZ,panelW,panelH,panelDepth,paint);
  // The lower service cover carries its own fasteners; derive their seat
  // from that real cover, not the deeper perimeter rails beside it.
  for(const x of [-1,1])for(const y of [-1,1])bolt(x*panelW*.39,y*panelH*.38,panelZ-panelDepth/2-headLength*.25,Math.min(.05,w*.02,h*.02),headLength);
  stats.chassis++;return owner;
 }
 function freightHood(target,name){
  const owner=mount(target,name),{width:w,height:h,depth:d,box}=faceFrame(owner,1);
  // Shallow pressed cover; its original 1.80 m freight clearance remains
  // exact. All channels lie above its unchanged lower contact envelope.
  box(0,0,d*.22,w,h,d*.56,JADE);
  for(const x of [-1,1])box(x*(w-.10)/2,0,-d*.25,.10,h,d*.5,STEEL,true);
  for(const y of [-1,1])box(0,y*(h-.12)/2,-d*.25,w-.20,.12,d*.5,BRONZE,true);
  for(const x of [-.25,0,.25])box(x*w,0,-d*.27,.055,h-.24,d*.46,STEEL,true);
  stats.chassis++;return owner;
 }
 function driveDisc(target,name,paint){
  const owner=mount(target,name,{cylindrical:true});
  part(owner,[0,0,0],[.4,.08,.4],{geometry:'disc',color:paint,metal:true});
  for(const sign of [-1,1])for(let n=0;n<6;n++){
   const angle=n*Math.PI/3;
   part(owner,[Math.cos(angle)*.20,sign*.035,Math.sin(angle)*.20],[.018,.008,.018],{geometry:'bolt',color:BRONZE,metal:true});
  }
  stats.driveDiscs++;return owner;
 }

 const w=level.world;
 switch(level.index){
  case 20:{
   const parent=level.serviceCar?.surface?.group?.parent;
   const chassis=parent?.children.find(mesh=>mesh.isMesh&&mesh.geometry.parameters?.height===.48&&Math.abs(mesh.position.y+.28)<.0001);
   if(!chassis)throw new Error('Biosphere art missing original service car chassis');
   deckChassis(chassis,'21 / shared-counterweight passenger car load chassis');break;
  }
  case 21:
   shutter(level.shutters.lower.mesh,'22 / opposed lower freight gate cassettes',{axis:0,paint:JADE,segments:3});
   shutter(level.shutters.upper.mesh,'22 / opposed upper inspection gate cassettes',{paint:MINERAL,segments:5,diagonal:true});break;
  case 22:{
   const machine=level.balance;
   driveDisc(w.root.getObjectByName('Room23 finite supply rotor'),'23 / original finite supply recessed flywheel',BRONZE);
   driveDisc(w.root.getObjectByName('Room23 common wound cable drum'),'23 / original wound drum and friction flange',STEEL);
   for(const [n,car]of machine.cars.entries()){
    const hood=machine.parts.find(p=>p.index===n&&p.mesh.name==='Room23 physical freight pan hood');
    const back=machine.parts.find(p=>p.index===n&&p.mesh.name==='Room23 freight pan backstop');
    if(!hood||!back)throw new Error('Biosphere art missing original physical freight cabin');
    freightHood(hood.mesh,`23 / ${car.name} pressed freight hood`);
    shutter(back.mesh,`23 / ${car.name} folded freight backstop`,{paint:JADE,segments:2});
   }
   break;
  }
  case 25:
   shutter(level.state.shutter.mesh,'26 / actual load-operated crossflow guillotine',{axis:0,paint:JADE,segments:3,diagonal:true});
   for(const [n,p]of [[-12,13.8,8],[12,23,-8]].entries())deckChassis(uniqueBox(w.root,p,[5.5,.4,5.5]),`26 / shaft ${n+1} founded upper stop underside`,{paint:JADE});break;
  case 28:
   shutter(level.state.gardenLatch.shutter,'29 / cargo-released garden return manufactured shutter',{paint:JADE,segments:3,diagonal:true});break;
 }
 for(const [key,list]of banks){
  const [geometry,material]=key.split(':'),mesh=new THREE.InstancedMesh(geometries[geometry],materials[material],list.length);
  mesh.name=`Biosphere manufactured ${key}`;mesh.castShadow=false;mesh.receiveShadow=true;mesh.frustumCulled=false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);root.add(mesh);
  list.forEach((entry,index)=>{entry.mesh=mesh;entry.index=index;mesh.setColorAt(index,new THREE.Color(entry.color));});
  mesh.instanceColor.needsUpdate=true;stats.batches++;
 }
 root.userData.stats=stats;
 const inverse=new THREE.Matrix4(),pose=new THREE.Matrix4(),matrix=new THREE.Matrix4();let disposed=false;
 function sync(){
  if(disposed)return;
  root.updateWorldMatrix(true,false);inverse.copy(root.matrixWorld).invert();
  for(const owner of mounts){owner.target.updateWorldMatrix(true,false);pose.multiplyMatrices(inverse,owner.target.matrixWorld);
   for(const entry of owner.parts)entry.mesh.setMatrixAt(entry.index,matrix.multiplyMatrices(pose,entry.matrix));
  }
  for(const list of banks.values())list[0].mesh.instanceMatrix.needsUpdate=true;
 }
 const oldRender=level.renderUpdate,oldReset=level.reset,oldDispose=level.dispose;
 const render=function(...args){const value=oldRender?.apply(this,args);sync();return value;};
 const reset=function(...args){const value=oldReset?.apply(this,args);sync();return value;};
 const dispose=function(...args){if(disposed)return;release(false);return oldDispose?.apply(this,args);};
 function release(restoreLifecycle=true){
  if(disposed)return;disposed=true;root.removeFromParent();
  for(const list of banks.values())list[0].mesh.dispose();root.clear();
  for(const entry of hidden)if(entry.target&&entry.target.material===entry.replacement)entry.target.material=entry.original;
  for(const geometry of Object.values(geometries))geometry.dispose();
  for(const material of Object.values(materials))material.dispose();for(const entry of hidden)entry.copy?.dispose();
  if(level.renderUpdate===render)level.renderUpdate=oldRender;if(level.reset===reset)level.reset=oldReset;
  if(restoreLifecycle&&level.dispose===dispose)level.dispose=oldDispose;if(level.biosphereArt===root)delete level.biosphereArt;
 }
 root.dispose=()=>release(true);root.mounts=mounts;
 root.ownedResources=[...banks.values()].map(list=>list[0].mesh).concat(Object.values(geometries),Object.values(materials),hidden.flatMap(entry=>entry.copy?[entry.copy]:[]));
 level.renderUpdate=render;level.reset=reset;level.dispose=dispose;level.biosphereArt=root;sync();return level;
}
