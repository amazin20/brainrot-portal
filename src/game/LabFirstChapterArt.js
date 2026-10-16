import * as THREE from 'three';

const V=(...p)=>new THREE.Vector3(...p),Q=()=>new THREE.Quaternion();
const COLOURS=Object.freeze({recess:0x263c41,bronze:0xb99564,nickel:0xa9b5b1});
const MAX_PANELS=16,MAX_INSTANCES=480,PROJECTION=.001;

/** A finish on a real portal-support chassis, never another portal target.
 * Both frame designs already exist in the opening ten rooms. Their complete
 * ceramic fields, signal strips, brackets and controls remain untouched. */
function chassis(surface){
 if(!surface?.group||!Number.isFinite(surface.width)||!Number.isFinite(surface.height)||surface.width<2||surface.height<2)return null;
 if(surface.frameColliders?.length)return {surface,wide:true,offset:.30,width:.58,height:.58,front:.13};
 if(surface.group.getObjectByName('Portal machinery frame / '+surface.name))return {surface,wide:false,offset:.18,width:.18,height:.18,front:-.08};
 return null;
}

function fittings(host){
 const {surface:s,wide,offset,width,height,front}=host,w=s.width,h=s.height,parts=[];
 const add=(role,p,size,tone)=>parts.push({host,role,p,size,tone,local:new THREE.Matrix4().compose(V(...p),Q(),V(...size))});
 // Keep a true depth rather than a coplanar decal. The one-millimetre exposed
 // face catches light; the rest lies in the existing opaque metal member.
 const depth=.006,z=front+PROJECTION-.0007-depth/2,plateWidth=wide?.26:.115,plateHeight=Math.min(h*(wide?.25:.21),wide?1.9:1.3);
 for(const side of [-1,1]){
  const x=side*(w/2+offset+(wide?.025:0));
  for(const sy of [-1,1]){
   const y=sy*h*.275;
   add('upright service recess',[x,y,z],[plateWidth,plateHeight,depth],'recess');
   // These are broad machined end-caps, with no ticker, colour transition or
   // autonomous motion that could be mistaken for powered puzzle machinery.
   for(const sign of [-1,1])add('upright bearing cap',[x,y+sign*(plateHeight/2-.055),z+.0007],[plateWidth*.82,.065,depth],'bronze');
   if(wide)for(const sign of [-1,1])add('upright cassette split',[x,y+sign*plateHeight*.15,z+.0007],[plateWidth*.72,.032,depth],'nickel');
  }
 }
 const y=h/2+offset,capHeight=height*(wide?.40:.56),capWidth=Math.min(w*.19,wide?2.1:2.3);
 // Three separate covers preserve the negative space around the actual
 // upper fastening heads. They read as one manufactured family at a distance.
 for(const x of [-w*.27,0,w*.27]){
  add('upper crosshead recess',[x,y,z],[capWidth+.055,capHeight,depth],'recess');
  add('upper crosshead cover',[x,y,z+.0007],[capWidth,capHeight*.55,depth],'bronze');
 }
 return parts;
}

/** Unify the first chapter through the physical frames already in the room.
 * The fixed and moving fittings share at most two instanced submissions. All
 * moving matrices come from the actual rendered support group, after its
 * normal interpolation: there is no separate animation clock or mechanism
 * state. A sibling root keeps Box3.setFromObject(device) and collider meshes
 * unchanged. Original GLB geometry and material assignments are not edited. */
export function installFirstChapterArt(game,level,index=level?.index){
 if(game.chamberEdition!=='foundation'||!Number.isInteger(index)||index<0||index>=10||level.firstChapterArt)return level;
 const parent=level.structure||level.world?.root||level.workshop?.world?.root;if(!parent)return level;
 const hosts=[...new Set(Object.values(level.panels||{}))].map(chassis).filter(Boolean).slice(0,MAX_PANELS);
 if(!hosts.length)return level;
 const parts=hosts.flatMap(fittings);if(parts.length>MAX_INSTANCES)throw new RangeError('First-chapter fitting budget exceeded');
 const root=new THREE.Group();root.name='First chapter / machined support fittings';root.userData.visualOnly=true;root.userData.keepMaterial=true;
 // A separate scene child cannot enlarge the room's structural bounds or a
 // moving surface's mesh hierarchy. The scene matrix is removed below too.
 game.scene.add(root);
 const geometry=new THREE.BoxGeometry(1,1,1),material=new THREE.MeshStandardMaterial({name:'First chapter / satin service metals',color:0xffffff,roughness:.68,metalness:.42});
 const batches=[],matrix=new THREE.Matrix4(),inverse=new THREE.Matrix4(),colour=new THREE.Color();let disposed=false;
 const dynamicHost=host=>host.surface.collider?.kinematic===true||host.surface.group.parent!==parent;
 for(const dynamic of [false,true]){
  const entries=parts.filter(p=>dynamicHost(p.host)===dynamic);if(!entries.length)continue;
  const mesh=new THREE.InstancedMesh(geometry,material,entries.length);
  mesh.name='First chapter / '+(dynamic?'actual moving frame fittings':'fixed frame fittings');
  mesh.userData.visualOnly=true;mesh.castShadow=false;mesh.receiveShadow=true;
  if(dynamic)mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  entries.forEach((p,i)=>mesh.setColorAt(i,colour.setHex(COLOURS[p.tone])));
  mesh.instanceColor.needsUpdate=true;root.add(mesh);batches.push({mesh,entries,dynamic});
 }
 const write=batch=>{
  root.updateWorldMatrix(true,false);inverse.copy(root.matrixWorld).invert();
  const updated=new Set();
  for(let i=0;i<batch.entries.length;i++){
   const p=batch.entries[i],group=p.host.surface.group;
   if(!updated.has(group)){group.updateWorldMatrix(true,false);updated.add(group);}
   matrix.multiplyMatrices(inverse,group.matrixWorld).multiply(p.local);batch.mesh.setMatrixAt(i,matrix);
  }
  batch.mesh.instanceMatrix.needsUpdate=true;batch.mesh.computeBoundingBox();batch.mesh.computeBoundingSphere();
 };
 const update=()=>{if(disposed)return;for(const batch of batches)if(batch.dynamic)write(batch);};
 batches.forEach(write);
 const renderUpdate=level.renderUpdate,reset=level.reset,dispose=level.dispose;
 level.renderUpdate=function(...args){const result=renderUpdate?.apply(this,args);update();return result;};
 level.reset=function(...args){const result=reset?.apply(this,args);if(!disposed)batches.forEach(write);return result;};
 level.dispose=function(...args){
  if(disposed)return;disposed=true;root.removeFromParent();for(const {mesh}of batches)mesh.dispose();
  // LabGame's levelRoots retains direct root references after detachment.
  // Empty this owned sibling as well, so its later generic traversal cannot
  // dispose the shared instanced geometry/material a second time.
  root.clear();geometry.dispose();material.dispose();
  return dispose?.apply(this,args);
 };
 const diagnostics=Object.freeze({chapter:'discovery',panels:hosts.length,instances:parts.length,batches:batches.length,
  movingPanels:hosts.filter(dynamicHost).length,extraColliders:0,extraLights:0,maxProjection:PROJECTION,autonomousAnimations:0});
 root.userData.stats=diagnostics;
 level.firstChapterArt={root,batches:batches.map(b=>b.mesh),mounts:parts,hosts,diagnostics,update,get disposed(){return disposed;}};
 return level;
}
