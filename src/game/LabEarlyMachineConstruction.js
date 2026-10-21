import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const V=(...p)=>new THREE.Vector3(...p);
const C={frame:0x365564,core:0x243c48,enamel:0xb9c8c6,service:0x759aa6,metal:0x9eafb0,copper:0xbe8e5c};

function boxPiece(parts,p,size,color){
 const g=new THREE.BoxGeometry(...size).toNonIndexed();g.translate(...p);
 const c=new THREE.Color(color),a=new Float32Array(g.attributes.position.count*3);
 for(let i=0;i<a.length;i+=3){a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b;}
 g.setAttribute('color',new THREE.BufferAttribute(a,3));parts.push(g);
}
function merge(parts,name,parameters){
 const g=mergeGeometries(parts);for(const p of parts)p.dispose();
 g.name=name;g.parameters=parameters;g.computeBoundingBox();g.computeBoundingSphere();return g;
}

/** Broad structural masses become closed service enclosures, rather than a
 * repeated cupboard texture. Four fabricated vertical faces share a solid
 * core. The walking top and all outer frame planes retain the original box.
 * Shallow returns are too small to admit either traveller into the recess. */
export function serviceMassGeometry(width,height,depth){
 if(![width,height,depth].every(n=>Number.isFinite(n)&&n>.6))throw new RangeError('A substantial closed chassis is required');
 const parts=[],well=Math.min(.18,Math.min(width,depth)*.08),rim=Math.min(.42,width*.06,depth*.06,height*.07);
 boxPiece(parts,[0,0,0],[width-2*well,height-2*rim,depth-2*well],C.core);
 // One continuous roof remains at exactly the authored floor/contact plane.
 boxPiece(parts,[0,(height-rim)/2,0],[width,rim,depth],C.enamel);
 boxPiece(parts,[0,-(height-rim)/2,0],[width,rim,depth],C.frame);
 const face=(axis,sign)=>{
  const span=axis===2?width:depth,thick=axis===2?depth:width;
  const add=(u,y,n,w,h,d,color)=>boxPiece(parts,axis===2?[u,y,sign*n]:[sign*n,y,u],axis===2?[w,h,d]:[d,h,w],color);
  const outer=thick/2,bodyHeight=height-2*rim;
  for(const s of [-1,1])add(s*(span-rim)/2,0,outer-well/2,rim,bodyHeight,well,C.frame);
  // An offset service spine divides the body into a large removable process
  // cover and a narrow mechanical bay. They have different actual depths.
  const usable=span-2*rim,spine=-usable*.22,rail=Math.min(.28,usable*.055);
  add(spine,0,outer-well/2,rail,bodyHeight,well,C.metal);
  const fields=[[-usable/2,spine-rail/2,C.service,.78],[spine+rail/2,usable/2,C.enamel,.42]];
  for(const [lo,hi,color,recess]of fields){
   const w=hi-lo-.045;if(w<=.04)continue;
   const n=outer-well*recess-.025;
   add((lo+hi)/2,0,n,w,bodyHeight,.045,color);
   // A broad plinth, a waist rail and an upper removable service cassette
   // replace the previous equal grid of tiny doors and repeated louvres.
   const band=Math.min(.30,bodyHeight*.075),waist=-bodyHeight*.14;
   add((lo+hi)/2,waist,outer-well*.25,w,band,well*.34,C.frame);
   if(w>1.3&&bodyHeight>2){
    const ventW=Math.min(w*.72,3.8),ventH=Math.min(bodyHeight*.19,1.8),vy=bodyHeight*.25;
    add((lo+hi)/2,vy,outer-well*.61,ventW,ventH,.035,C.core);
    for(let i=0;i<4;i++)add((lo+hi)/2,vy+ventH*(i-1.5)/4,outer-well*.40,ventW-.04,Math.min(.095,ventH*.12),.055,C.metal);
   }
  }
 };
 for(const axis of [0,2])for(const sign of [-1,1])face(axis,sign);
 return merge(parts,'Fabricated process enclosure / continuous frame, offset spine and recessed service bays',{width,height,depth});
}

/** A tread has an integral central pan and two continuous inclined edge
 * channels. Their slope follows the next tread; every vertex stays in this
 * tread's original solid casing, including both extreme contact planes. */
export function treadChassisGeometry(width,height,depth,rise){
 const parts=[],edge=Math.min(.24,width*.085),beam=Math.max(.055,height-Math.abs(rise)-.025);
 if(beam<=0||Math.abs(rise)>=height)throw new RangeError('The inclined channel must fit in the original tread casing');
 boxPiece(parts,[0,0,0],[width-2*edge,height,depth],C.core);
 for(const s of [-1,1]){
  const g=new THREE.BoxGeometry(edge,beam,depth).toNonIndexed(),p=g.attributes.position;
  for(let i=0;i<p.count;i++)p.setY(i,p.getY(i)+rise*p.getZ(i)/depth);
  g.translate(s*(width-edge)/2,0,0);
  const c=new THREE.Color(C.service),a=new Float32Array(p.count*3);for(let i=0;i<a.length;i+=3){a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b;}
  g.setAttribute('color',new THREE.BufferAttribute(a,3));g.computeVertexNormals();parts.push(g);
 }
 return merge(parts,'Folded stair / closed pan with continuous inclined side channels',{width,height,depth});
}

function foundedStairGeometry(width,height,depth,rise){
 const parts=[],edge=Math.min(.28,width*.09),top=height/2;
 boxPiece(parts,[0,0,0],[width-2*edge,height,depth],C.core);
 for(const s of [-1,1]){
  // A closed triangular side cheek carries all treads. Its sloping top is
  // recessed into the old stepped foundation; the bottom remains founded.
  const front=Math.max(-height/2+.015,top-Math.abs(rise)-.025),back=top-.025;
  const shape=new THREE.Shape([new THREE.Vector2(-depth/2,-height/2),new THREE.Vector2(depth/2,-height/2),
   new THREE.Vector2(depth/2,front),new THREE.Vector2(-depth/2,back)]);
  const g=new THREE.ExtrudeGeometry(shape,{depth:edge,bevelEnabled:false,steps:1,curveSegments:1});
  // Shape X is the stair's depth, extrusion is its narrow width.
  g.rotateY(-Math.PI/2);g.translate(s<0?-width/2+edge:width/2,0,0);
  const c=new THREE.Color(C.service),a=new Float32Array(g.attributes.position.count*3);
  for(let i=0;i<a.length;i+=3){a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b;}g.setAttribute('color',new THREE.BufferAttribute(a,3));
  // mergeGeometries expects the same non-indexed position/normal/uv streams.
  parts.push(g.index?g.toNonIndexed():g);
 }
 return merge(parts,'Founded stair / continuous load cheeks and solid central plinth',{width,height,depth});
}

function shieldBackGeometry(width,height,depth){
 const p=[],edge=.23;
 boxPiece(p,[0,0,0],[width,height,depth*.40],C.core);
 for(const z of [-1,1]){
  const at=z*depth*.35;
  for(const s of [-1,1])boxPiece(p,[s*(width-edge)/2,0,at],[edge,height,depth*.30],C.frame);
  for(const s of [-1,1])boxPiece(p,[0,s*(height-edge)/2,at],[width-2*edge,edge,depth*.30],C.metal);
  boxPiece(p,[0,0,z*depth*.29],[width-2*edge,height-2*edge,depth*.16],C.service);
  boxPiece(p,[-width*.19,0,z*depth*.42],[.18,height-2*edge,depth*.16],C.metal);
  boxPiece(p,[width*.17,-height*.13,z*depth*.42],[width*.46,.16,depth*.16],C.copper);
 }
 return merge(p,'Optical shield / closed folded rear chassis and integral service returns',{width,height,depth});
}

function busGeometry(width,height,depth){
 const size=[width,height,depth],axis=size.indexOf(Math.max(...size)),parts=[],cross=[0,1,2].filter(a=>a!==axis);
 const s=size.slice();s[cross[0]]*=.72;s[cross[1]]*=.72;boxPiece(parts,[0,0,0],s,C.core);
 for(const a of cross)for(const sign of [-1,1]){
  const p=[0,0,0],span=size.slice(),edge=size[a]*.14;p[a]=sign*(size[a]-edge)/2;span[a]=edge;
  if(a===cross[1])span[cross[0]]*=.72;
  boxPiece(parts,p,span,a===cross[0]?C.service:C.metal);
 }
 return merge(parts,'Closed utility bus / folded cover and load-bearing returns',{width,height,depth});
}

function mountTo(owner,target,name){
 const mount=new THREE.Group();mount.name=name;mount.matrixAutoUpdate=false;owner.renderRoot.add(mount);
 owner.followers.push({target,mount});return mount;
}
function machineSkid(owner,target,material){
 target.updateWorldMatrix(true,true);const inverse=target.matrixWorld.clone().invert(),bounds=new THREE.Box3();
 target.traverse(n=>{if(!n.isMesh)return;n.geometry.computeBoundingBox();bounds.union(n.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(n.matrixWorld)));});
 const s=bounds.getSize(V()),c=bounds.getCenter(V()),h=s.y*.065,parts=[];
 // These load shoes occupy the existing machine's solid collision envelope.
 // The front bumper and corner returns are broad enough to read beyond the
 // model's two separate feet; no imported rotor/housing is hidden or moved.
 const bar=Math.min(s.x,s.z)*.11;
 for(const side of [-1,1])boxPiece(parts,[c.x+side*(s.x-bar)/2,bounds.min.y+h/2,c.z],[bar,h,s.z],C.frame);
 for(const side of [-1,1])boxPiece(parts,[c.x,bounds.min.y+h/2,c.z+side*(s.z-bar)/2],[s.x-2*bar,h,bar],C.frame);
 const g=merge(parts,'Machine skid / continuous founded outer load frame',{}),mesh=new THREE.Mesh(g,material());
 owner.geometry.push(g);mountTo(owner,target,'Machine skid / actual source pose').add(mesh);
 owner.stats.machineSkids++;
}

const MASSES={
 11:[[-12.5,3.3,-11.25,11,6.6,7.5],[16.5,13,1,3,26,32],[9.15,13,-12.5,11.7,26,5],[-2.5,7.5,2.5,5,15,7]],
 12:[[4,2,0,18,12,11],[-18.8,3,0,2.4,6,24],[16,11,-5,2,22,8]],
 13:[[16,12.5,-11,8,25,34],[-6,12.5,-21,12,25,14],[3.5,6.6,-25.75,7,13.2,3.5]],
 14:[[11,6,2,20,12,12],[-14.5,1,-10,9,2,6],[-14.5,5.575,-10.5,9,4.05,5],[1,8.5,-10,5,17,10]],
 15:[[-17.5,2.8,0,7,5.6,6],[18,6.6,-3,6,13.2,20],[-16,6.6,-10,8,13.2,6],[12.35,22.5,-10,18.7,9,6.9]],
};

function retireCoat(level,target,owner){
 for(const old of level.secondChapterArt?.mounts??[])if(old.target===target){
  for(const part of old.parts){
   owner.retiredCoat.push({part,matrix:part.matrix.clone()});part.matrix.makeScale(0,0,0);
   part.mesh.setMatrixAt(part.index,part.matrix);part.mesh.instanceMatrix.needsUpdate=true;
  }
 }
}

export function finishEarlyMachineConstruction(level,index,owner,replace,material){
 owner.retiredCoat??=[];owner.stats.serviceEnclosures=0;owner.stats.stairPans=0;owner.stats.integralGalleryGirders=0;owner.stats.machineSkids=0;owner.stats.bearingBlocks=0;owner.stats.opticalHousings=0;owner.stats.utilityBusBodies=0;
 const meshes=[];level.world.root.updateWorldMatrix(true,true);level.world.root.traverse(n=>{if(n.isMesh&&!n.isInstancedMesh&&!n.userData.collisionProxy)meshes.push(n);});
 for(const row of MASSES[index]??[]){
  const [x,y,z,w,h,d]=row,target=meshes.find(n=>{
   const p=n.geometry?.parameters;return p&&Math.abs(p.width-w)<.015&&Math.abs(p.height-h)<.015&&Math.abs(p.depth-d)<.015&&n.getWorldPosition(V()).distanceTo(V(x,y,z))<.035;
  });
  if(!target)throw new Error(`Missing room ${index+1} process mass at ${x},${y},${z}`);
  retireCoat(level,target,owner);replace(owner,target,serviceMassGeometry(w,h,d),material());owner.stats.serviceEnclosures++;
 }
 for(const mesh of meshes){
  const stair=mesh.userData.earlyAuditStair;if(!stair)continue;
  const p=mesh.geometry.parameters;retireCoat(level,mesh,owner);
  const g=stair.foundation?foundedStairGeometry(p.width,p.height,p.depth,stair.rise):treadChassisGeometry(p.width,p.height,p.depth,stair.rise);
  replace(owner,mesh,g,material());owner.stats.stairPans++;
 }
 if(index===5){
  const back=level.panels['light-outlet'].backing,p=back.geometry.parameters;
  replace(owner,back,shieldBackGeometry(p.width,p.height,p.depth),material());owner.stats.opticalHousings++;
  const emitter=level.mechanismArt.earlyOptics.emitter.group,mount=mountTo(owner,emitter,'Optical emitter / closed barrel at real source');
  const profile=[[.64,-.325],[.64,-.12],[.56,-.025],[.47,-.025],[.47,-.25],[.64,-.325]].map(p=>new THREE.Vector2(...p));
  const g=new THREE.LatheGeometry(profile,32);g.rotateX(Math.PI/2);owner.geometry.push(g);
  const m=new THREE.MeshStandardMaterial({color:C.frame,metalness:.62,roughness:.38});owner.materials.push(m);
  mount.add(new THREE.Mesh(g,m));owner.stats.opticalHousings++;
 }
 if(index===6){
  level.state.rig.fixed.traverse(mesh=>{
   if(!mesh.isMesh||mesh.name!=='Stationary bearing housing')return;
   const p=mesh.geometry.parameters,r=p.radiusTop;
   const g=new THREE.BoxGeometry(2*r,p.height,2*r);
   const m=new THREE.MeshStandardMaterial({color:C.service,roughness:.4,metalness:.65});owner.materials.push(m);
   replace(owner,mesh,g,m);owner.stats.bearingBlocks++;
  });
 }
 if(index===7)machineSkid(owner,level.state.sourceFan.art,material);
 if(index===10){machineSkid(owner,level.state.blower.art.art,material);machineSkid(owner,level.state.flywheel.art.art,material);}
 for(const mesh of meshes)if(mesh.userData.earlyAuditMachineHousing){
  const p=mesh.geometry.parameters;replace(owner,mesh,serviceMassGeometry(p.width,p.height,p.depth),material());owner.stats.serviceEnclosures++;
 }
 for(const mesh of meshes)if(mesh.userData.earlyAuditBus){
  const p=mesh.geometry.parameters;replace(owner,mesh,busGeometry(p.width,p.height,p.depth),material());owner.stats.utilityBusBodies++;
 }
 if(index===7){
  // The former thin rectangular beams become actual folded girders; the
  // original physical extents and every guard/landing plane stay unchanged.
  for(const mesh of level.mechanismArt?.airGalleryStructure??[]){
   const p=mesh.geometry.parameters;
   if(!/girder|solid .*guard/.test(mesh.name))continue;
   let g;
   if(p.width>.6&&p.depth>.6)continue;
   const long=p.width>p.depth;
   // Recesses on both broad faces expose a continuous load-bearing web.
   const a=long?p.width:p.depth,b=p.height,c=long?p.depth:p.width;
   const parts=[],flange=Math.min(b*.24,.10),web=c*.34;
   boxPiece(parts,[0,0,0],[a,b,web],C.service);
   for(const s of [-1,1])boxPiece(parts,[0,s*(b-flange)/2,0],[a,flange,c],C.frame);
   g=merge(parts,'Receiving gallery / folded girder and structural guard',{width:a,height:b,depth:c});
   if(!long)g.rotateY(Math.PI/2);g.parameters={width:p.width,height:p.height,depth:p.depth};
   replace(owner,mesh,g,material());owner.stats.integralGalleryGirders++;
  }
 }
}
