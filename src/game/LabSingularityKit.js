import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {terminalAccessible} from './LabPuzzleMechanics.js';
export const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
export const clamp=THREE.MathUtils.clamp;
const UP=V(0,1,0),Z=V(0,0,1);
const corners=box=>[...Array(8)].map((_,i)=>V(i&1?box.max.x:box.min.x,i&2?box.max.y:box.min.y,i&4?box.max.z:box.min.z));
const sameMatrix=(a,b)=>a.elements.every((v,i)=>Math.abs(v-b.elements[i])<1e-10);
// Narrow strips follow the circular silhouette instead of enclosing a drum in
// an invisible square. The maximum excess is below 2% of its radius.
function cylinderParts(radius,height){
 const parts=[];for(let i=0;i<16;i++){
  const a=-Math.PI/2+i*Math.PI/16,b=a+Math.PI/16,near=a<=0&&b>=0?0:Math.abs(a)<Math.abs(b)?a:b;
  parts.push(corners(new THREE.Box3(V(Math.sin(a)*radius,-height/2,-Math.cos(near)*radius),V(Math.sin(b)*radius,height/2,Math.cos(near)*radius))));
 }return parts;
}

/** Shared construction primitives, NOT shared puzzle recipes. All solids have
 * matching player/cargo collision. Static ornament is instanced by material. */
export class SingularityKit {
 constructor(game){
  this.game=game;this.root=new THREE.Group();this.root.name='SINGULARITY / continuous machine cathedral';game.scene.add(this.root);
  this.meshes=[];this.colliders=[];this.floors=[];this.panels=[];this.terminals=[];this.controlResets=[];this.geometries=new Set();this.materials=new Set();this.static=[];this.dynamic=[];this.compounds=[];this.batches=[];this.textures=[];
  this.cube=this.geo(new THREE.BoxGeometry(1,1,1));this.round=this.geo(new RoundedBoxGeometry(1,1,1,2,.09));
  this.torusCache=new Map();this.cylinder=this.geo(new THREE.CylinderGeometry(1,1,1,24));
  this.m={steel:this.mat(0x516b7c,.52,.35),dark:this.mat(0x152d3b,.72,.24),floor:this.mat(0xb2c9d3,.84,.05),
   wall:this.mat(0x839fae,.7,.08),ivory:this.mat(0xf2e9d4,.48,.15),copper:this.mat(0xd89c60,.38,.65),
   cyan:this.mat(0x61dcea,.3,.3,0x17434b),mint:this.mat(0x88efb8,.35,.2,0x26472c),rose:this.mat(0xf198be,.44,.2),
   violet:this.mat(0xb5a5ed,.4,.3),lamp:this.mat(0xffedc2,1,0,0xffedc2,true),idle:this.mat(0xdab074,1,0,0xdab074,true),
   live:this.mat(0x87f4c8,1,0,0x87f4c8,true),ceramic:this.mat(0xf4f4eb,.58,.08,0x303b37)};
  // Broad architectural seams are built as geometry. Repeating one-pixel
  // noise and borders across this enormous floor caused distance shimmer.
 }
 geo(g){this.geometries.add(g);return g;}
 mat(color,roughness=.6,metalness=.2,emissive=0,basic=false){const m=basic?new THREE.MeshBasicMaterial({color}):new THREE.MeshStandardMaterial({color,roughness:Math.max(.44,roughness),metalness,emissive,emissiveIntensity:.35});this.materials.add(m);return m;}
 mesh(geometry,material,p,s=[1,1,1],{solid=false,dynamic=false,round=false}={}){
  const m=new THREE.Mesh(geometry,material);m.position.fromArray(p);m.scale.fromArray(s);m.receiveShadow=true;this.root.add(m);this.meshes.push(m);
  if(solid){m.updateWorldMatrix(true,false);const c={mesh:m,box:new THREE.Box3().setFromObject(m),enabled:true,kinematic:dynamic};
   this.colliders.push(c);this.game.colliders.push(c);this.game.cameraBlockers.push(m);this.game.aimBlockers.push(m);m.userData.collider=c;}
  if(dynamic)this.dynamic.push(m);else this.static.push(m);return m;
 }
 compound(owner,parts,{dynamic=false,spinAxis=null}={}){
  const compound={owner,dynamic,spinAxis,parts:[],matrix:new THREE.Matrix4(),pose:new THREE.Matrix4(),spin:new THREE.Matrix4(),enabled:true};owner.userData.compound=compound;this.compounds.push(compound);
  for(const points of parts){
   const proxy=this.mesh(this.cube,this.m.dark,[0,0,0],[1,1,1],{solid:true,dynamic:true});proxy.name='Machine contact / '+owner.name;
   proxy.visible=false;proxy.userData.collisionProxy=true;proxy.userData.collider.kinematic=dynamic;
   compound.parts.push({points,proxy,collider:proxy.userData.collider});
  }
  this.sync(owner,0,true);return owner;
 }
 sync(mesh,dt=0,force=false){
  mesh.updateWorldMatrix(true,false);const compound=mesh.userData.compound,c=mesh.userData.collider;
  if(compound){
   compound.pose.copy(mesh.matrixWorld);
   if(compound.spinAxis==='z')compound.pose.multiply(compound.spin.makeRotationZ(-mesh.rotation.z));
   if(!force&&sameMatrix(compound.matrix,compound.pose))return false;compound.matrix.copy(compound.pose);
   const point=V();for(const part of compound.parts){
    const {proxy,collider,points}=part;collider.box.makeEmpty();for(const p of points)collider.box.expandByPoint(point.copy(p).applyMatrix4(compound.pose));
    collider.box.getCenter(proxy.position);collider.box.getSize(proxy.scale);proxy.updateWorldMatrix(true,false);
    if(this.game.physics?.solids?.has(proxy.uuid))this.game.physics.updateStaticBox(proxy.uuid,collider.box,dt,collider.enabled);
   }return true;
  }
  if(!c)return false;
  if(!force&&c.matrix?.equals(mesh.matrixWorld))return false;c.matrix??=new THREE.Matrix4();c.matrix.copy(mesh.matrixWorld);c.box.setFromObject(mesh);
  if(this.game.physics?.solids?.has(mesh.uuid))this.game.physics.updateStaticBox(mesh.uuid,c.box,dt,c.enabled);return true;
 }
 syncDynamic(dt=0){
  for(const mesh of this.dynamic)if(!mesh.userData.collisionProxy)this.sync(mesh,dt);
  for(const compound of this.compounds)if(compound.dynamic)this.sync(compound.owner,dt);
 }
 box(p,s,m=this.m.steel,options={}){return this.mesh(options.round?this.round:this.cube,m,p,s,{solid:options.solid!==false,dynamic:!!options.dynamic});}
 decor(p,s,m=this.m.copper){return this.box(p,s,m,{solid:false});}
 drum(p,r,h,m=this.m.copper,options={}){const solid=options.solid??!options.dynamic,mesh=this.mesh(this.cylinder,m,p,[r,h,r],{...options,solid:false});mesh.name='Circular machine body';return solid?this.compound(mesh,cylinderParts(1,1),options):mesh;}
 floor(x0,x1,z0,z1,y=0,m=this.m.floor,{dynamic=false,enabled=true}={}){
  const mesh=this.box([(x0+x1)/2,y-.2,(z0+z1)/2],[x1-x0,.4,z1-z0],m,{dynamic});
  const f={minX:x0,maxX:x1,minZ:z0,maxZ:z1,y,mesh,enabled};this.game.floors.push(f);this.floors.push(f);mesh.userData.floor=f;
  if(!enabled){mesh.visible=false;mesh.userData.collider.enabled=false;}return mesh;
 }
 enable(mesh,on,dt=0){mesh.visible=on;const compound=mesh.userData.compound,colliders=compound?compound.parts.map(p=>p.collider):[mesh.userData.collider].filter(Boolean);
  if(compound)compound.enabled=on;for(const c of colliders){c.enabled=on;if(this.game.physics?.solids?.has(c.mesh.uuid))this.game.physics.updateStaticBox(c.mesh.uuid,c.box,dt,on);}
  if(mesh.userData.floor)mesh.userData.floor.enabled=on;}
 move(mesh,p,dt){
  const before=mesh.position.clone(),f=mesh.userData.floor,g=this.game;
  if(before.distanceToSquared(V(...p))<1e-14){this.sync(mesh,dt);return;}
  const rides=f&&g.playerGrounded&&Math.abs(g.playerPosition.y-f.y)<.21&&g.playerPosition.x>f.minX-.05&&g.playerPosition.x<f.maxX+.05&&g.playerPosition.z>f.minZ-.05&&g.playerPosition.z<f.maxZ+.05;
  mesh.position.fromArray(p);const delta=mesh.position.clone().sub(before);
  if(f){f.minX+=delta.x;f.maxX+=delta.x;f.minZ+=delta.z;f.maxZ+=delta.z;f.y+=delta.y;}
  if(rides&&dt){g.playerPosition.add(delta);g.previousPlayerPosition.add(delta);}
  this.sync(mesh,dt);
 }
 panel(name,p,n,w=4.8,h=4.8,{moving=false}={}){
  const normal=V(...n).normalize(),q=new THREE.Quaternion().setFromUnitVectors(Z,normal);
  const center=V(...p),mesh=this.box(center.clone().addScaledVector(normal,-.12).toArray(),[w,h,.24],this.m.ceramic,{dynamic:true});
  mesh.quaternion.copy(q);mesh.updateWorldMatrix(true,false);mesh.userData.collider.box.setFromObject(mesh);
  const frame=()=>({center:mesh.position.clone().addScaledVector(Z.clone().applyQuaternion(mesh.quaternion),.12),normal:Z.clone().applyQuaternion(mesh.quaternion),
   right:V(1,0,0).applyQuaternion(mesh.quaternion),up:UP.clone().applyQuaternion(mesh.quaternion),halfWidth:w/2,halfHeight:h/2});
  this.game.markPortalSurface(mesh,center,normal,w/2,h/2);mesh.userData.portalUp=frame().up;mesh.userData.portalColliderId=mesh.uuid;
  if(moving)mesh.userData.portalFrame=frame;
  const c=mesh.userData.collider;c.frontPlane=frame;mesh.name=`Portal ceramic / ${name}`;this.panels.push(mesh);
  // Light edges sit outside the collider and portal opening, never enlarge it.
  const edges=[];for(const side of [-1,1]){
   const edge=this.box(center.clone().addScaledVector(frame().right,side*(w/2+.06)).toArray(),[.09,h+.12,.12],this.m.cyan,{solid:false,dynamic:true});edge.quaternion.copy(q);edges.push(edge);
  }
  return {mesh,center,normal,frame,edges,move:(to,dt)=>{const old=frame().center;this.move(mesh,V(...to).addScaledVector(normal,-.12).toArray(),dt);const delta=V(...to).sub(old);edges.forEach(e=>e.position.add(delta));}};
 }
 control(id,p,action,text,material=this.m.copper){
  const casing=this.box([p[0],p[1]+.62,p[2]],[.88,1.24,.7],this.m.dark,{round:true});
  const head=this.box([p[0],p[1]+1.28,p[2]],[.78,.17,.64],material,{round:true});
  for(const x of [-.22,0,.22])this.decor([p[0]+x,p[1]+1.39,p[2]-.13],[.08,.035,.09],this.m.ivory);
  const screen=this.mesh(this.cube,this.m.cyan,[p[0],p[1]+1.39,p[2]+.10],[.5,.018,.18],{dynamic:true});
  const actuator=this.mesh(this.round,this.m.copper,[p[0]+.28,p[1]+1.51,p[2]+.13],[.08,.32,.08],{dynamic:true});
  this.controlResets.push(()=>{actuator.rotation.x=0;screen.material=this.m.cyan;});
  const wrapped=()=>{const result=action();if(result!==false){actuator.rotation.x=actuator.rotation.x<0?.35:-.35;screen.material=screen.material===this.m.live?this.m.cyan:this.m.live;}return result;};
  const t={id,kind:id,position:V(p[0],p[1]+1,p[2]),collider:casing.userData.collider,action:wrapped,lesson:text,art:casing,head,screen,actuator};
  this.terminals.push(t);return t;
 }
 resetControls(){for(const reset of this.controlResets)reset();}
 nearest(){return this.terminals.filter(t=>terminalAccessible(this.game,t)).sort((a,b)=>a.position.distanceToSquared(this.game.playerPosition)-b.position.distanceToSquared(this.game.playerPosition))[0];}
 ring(p,r,m=this.m.copper,{normal=[0,1,0],tube=.12,dynamic=false,solid=true,arc=Math.PI*2}={}){
  if(!Number.isFinite(arc)||arc<=0||arc>Math.PI*2)throw new RangeError('Ring arc must be between zero and one complete turn');
  const key=`${r}:${tube}:${arc}`;if(!this.torusCache.has(key))this.torusCache.set(key,this.geo(new THREE.TorusGeometry(r,tube,8,40,arc)));const geometry=this.torusCache.get(key),mesh=this.mesh(geometry,m,p,[1,1,1],{dynamic});mesh.name=arc<Math.PI*2?'Open horseshoe coil':'Open machine ring';mesh.quaternion.setFromUnitVectors(Z,V(...normal).normalize());
  if(!solid)return mesh;
  const position=geometry.attributes.position,parts=[];
  // Each segment uses the actual torus vertices; there is no full-disc
  // collider across its opening. Cameras, rays, players and cargo share it.
  for(let j=0;j<40;j++){const points=[];for(let i=0;i<=8;i++)for(const t of [j,j+1])points.push(V().fromBufferAttribute(position,i*41+t));parts.push(points);}
  return this.compound(mesh,parts,{dynamic});
 }
 gear(p,r,teeth=18,m=this.m.copper,{solid=true}={}){
  const group=new THREE.Group();group.position.fromArray(p);this.root.add(group);
  const axle=new THREE.Mesh(this.geo(new THREE.CylinderGeometry(r*.70,r*.70,.3,32)),m);axle.rotation.x=Math.PI/2;group.add(axle);
  const instances=new THREE.InstancedMesh(this.round,m,teeth),matrix=new THREE.Matrix4();
  for(let i=0;i<teeth;i++){const a=i*Math.PI*2/teeth;matrix.compose(V(Math.sin(a)*r*.8,Math.cos(a)*r*.8,0),new THREE.Quaternion().setFromAxisAngle(Z,-a),V(r*.22,r*.35,.34));instances.setMatrixAt(i,matrix);}
  // The gear's swept teeth have no traveller-sized gaps. A circular envelope
  // preserves the external silhouette without reshaping Cannon every tick.
  const axleRotation=new THREE.Matrix4().makeRotationX(Math.PI/2),parts=cylinderParts(Math.hypot(.975,.11)*r,.34).map(points=>points.map(p=>p.applyMatrix4(axleRotation)));
  group.add(instances);instances.computeBoundingSphere();this.batches.push(instances);group.name='Rotating transmission gear';return solid?this.compound(group,parts,{dynamic:true,spinAxis:'z'}):group;
 }
 stairs(from,to,width=4,m=this.m.floor){
  // A level landing precedes the upper junction. Adjacent cross-corridors
  // therefore cannot cover the final risers with an un-climbable high lip.
  const [x,y,z]=from,[tx,ty,tz]=to,length=Math.hypot(tx-x,tz-z),landing=Math.min(3.6,length*.24);
  if(Math.abs(x-tx)>.01&&Math.abs(z-tz)>.01)throw Error('Stair flights must follow an axis');
  const rise=Math.abs(ty-y),steps=Math.ceil(rise/.23),rising=ty>y;
  const start=rising?0:landing/length,end=rising?1-landing/length:1;
  if(!rising)this.floor(Math.min(x,x+(tx-x)*start)-(tx===x?width/2:0),Math.max(x,x+(tx-x)*start)+(tx===x?width/2:0),Math.min(z,z+(tz-z)*start)-(tz===z?width/2:0),Math.max(z,z+(tz-z)*start)+(tz===z?width/2:0),y,m);
  for(let i=0;i<steps;i++){
   const t0=start+(end-start)*i/steps,t1=start+(end-start)*(i+1)/steps;
   const a=[x+(tx-x)*t0,z+(tz-z)*t0],b=[x+(tx-x)*t1,z+(tz-z)*t1],top=y+(ty-y)*(i+1)/steps;
   this.floor(Math.min(a[0],b[0])-(tx===x?width/2:0),Math.max(a[0],b[0])+(tx===x?width/2:0),Math.min(a[1],b[1])-(tz===z?width/2:0),Math.max(a[1],b[1])+(tz===z?width/2:0),top,m);
  }
  if(rising)this.floor(Math.min(x+(tx-x)*end,tx)-(tx===x?width/2:0),Math.max(x+(tx-x)*end,tx)+(tx===x?width/2:0),Math.min(z+(tz-z)*end,tz)-(tz===z?width/2:0),Math.max(z+(tz-z)*end,tz)+(tz===z?width/2:0),ty,m);
 }
 corridor(a,b,width=5,{rails=true}={}){
  if(Math.abs(a[1]-b[1])>.01)return this.stairs(a,b,width);
  const x0=Math.min(a[0],b[0]),x1=Math.max(a[0],b[0]),z0=Math.min(a[2],b[2]),z1=Math.max(a[2],b[2]),alongX=x1-x0>z1-z0;
  const deck=this.floor(x0-(alongX?0:width/2),x1+(alongX?0:width/2),z0-(alongX?width/2:0),z1+(alongX?width/2:0),a[1]);
  if(rails&&Math.max(x1-x0,z1-z0)>7)for(const sign of [-1,1])this.box([(x0+x1)/2+(alongX?0:sign*(width/2+.08)),a[1]+.58,(z0+z1)/2+(alongX?sign*(width/2+.08):0)],
   [alongX?Math.max(.2,x1-x0-7):.16,1.16,alongX?.16:Math.max(.2,z1-z0-7)],this.m.steel);
  return deck;
 }
 room(def){
  const [x,y,z]=def.at,{w,d,h=12,entry='s'}=def,b={x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2};
  const gaps={n:[],s:[],w:[],e:[]};gaps[entry]=[-3.4,3.4];
  for(const side of ['n','s','w','e']){
   const vertical=side==='w'||side==='e',length=vertical?d:w,fixed=side==='w'?b.x0:side==='e'?b.x1:side==='n'?b.z0:b.z1;
   const spans=side===entry?[[-length/2,-3.4],[3.4,length/2]]:[[-length/2,length/2]];
   for(const [a,c]of spans)this.box(vertical?[fixed,y+h/2,z+(a+c)/2]:[x+(a+c)/2,y+h/2,fixed],vertical?[.5,h,c-a]:[c-a,h,.5],this.m.wall);
   if(side===entry){const opening=def.highDoor?18:5;this.box(vertical?[fixed,y+(h+opening)/2,z]:[x,y+(h+opening)/2,fixed],vertical?[.5,h-opening,6.8]:[6.8,h-opening,.5],this.m.wall);}
  }
  // Each room has a complete physical ceiling. Architectural fins and recesses
  // differ by footprint; no plants or purposeless collision-free props.
  this.box([x,y+h+.22,z],[w+.7,.44,d+.7],this.m.dark);
  for(const sx of [-1,1])for(const sz of [-1,1]){
   this.box([x+sx*(w/2-.5),y+h/2,z+sz*(d/2-.5)],[.62,h,.62],this.m.steel);
   this.decor([x+sx*(w/2-.14),y+h*.64,z+sz*(d/2-.14)],[.06,h*.5,.06],this.m.lamp);
  }
  for(let i=0;i<3;i++)this.decor([x+(i-1)*w*.27,y+h-.08,z],[Math.min(4,w*.18),.09,d*.72],this.m.lamp);
  const color=this.m[def.color]??this.m.cyan;
  const door=entry==='s'?[x,y,z+d/2]:entry==='n'?[x,y,z-d/2]:entry==='e'?[x+w/2,y,z]:[x-w/2,y,z];
  const isX=entry==='e'||entry==='w';
  for(const sign of [-1,1])this.box([door[0]+(isX?0:sign*3.55),y+2.6,door[2]+(isX?sign*3.55:0)],[isX?.65:.2,5.2,isX?.2:.65],color);
  return {def,b,door,P:(a,c=0,dy=0)=>[x+a,y+dy,z+c],V:(a,c=0,dy=0)=>V(x+a,y+dy,z+c)};
 }
 batchFloors(){
  // Build a non-overlapping union of coplanar floor rectangles. Physical
  // supports retain their exact authored IDs; visible junctions have one top.
  const planes=new Map(),byMaterial=new Map();
  for(const mesh of this.static)if(mesh.userData.floor&&mesh.visible){
   const f=mesh.userData.floor,key=f.y.toFixed(5),items=planes.get(key)??[];items.push(f);planes.set(key,items);
  }
  function quad(out,a,b,c,d){out.push(...a,...b,...c,...a,...c,...d);}
  for(const [key,rects]of planes){
   const y=Number(key),xs=[...new Set(rects.flatMap(r=>[r.minX,r.maxX]))].sort((a,b)=>a-b),zs=[...new Set(rects.flatMap(r=>[r.minZ,r.maxZ]))].sort((a,b)=>a-b);
   const cells=[];
   for(let ix=1;ix<xs.length;ix++){
    const x0=xs[ix-1],x1=xs[ix],cx=(x0+x1)/2,active=rects.filter(r=>cx>r.minX-1e-7&&cx<r.maxX+1e-7);
    const row=[];cells.push(row);
    for(let iz=1;iz<zs.length;iz++){
     const cz=(zs[iz-1]+zs[iz])/2;row.push(active.findLast(r=>cz>r.minZ-1e-7&&cz<r.maxZ+1e-7));
    }
   }
   for(let ix=0;ix<cells.length;ix++)for(let iz=0;iz<zs.length-1;iz++){
     const owner=cells[ix][iz];if(!owner)continue;
     const x0=xs[ix],x1=xs[ix+1],z0=zs[iz],z1=zs[iz+1],material=owner.mesh.material,out=byMaterial.get(material)??[];byMaterial.set(material,out);
     quad(out,[x0,y,z0],[x0,y,z1],[x1,y,z1],[x1,y,z0]);
     quad(out,[x0,y-.4,z0],[x1,y-.4,z0],[x1,y-.4,z1],[x0,y-.4,z1]);
     // Only exposed boundaries have side walls. The old per-cell boxes
     // created coincident opposing faces through every internal junction.
     if(!cells[ix][iz-1])quad(out,[x0,y,z0],[x1,y,z0],[x1,y-.4,z0],[x0,y-.4,z0]);
     if(!cells[ix][iz+1])quad(out,[x1,y,z1],[x0,y,z1],[x0,y-.4,z1],[x1,y-.4,z1]);
     if(!cells[ix-1]?.[iz])quad(out,[x0,y,z1],[x0,y,z0],[x0,y-.4,z0],[x0,y-.4,z1]);
     if(!cells[ix+1]?.[iz])quad(out,[x1,y,z0],[x1,y,z1],[x1,y-.4,z1],[x1,y-.4,z0]);
   }
   for(const r of rects){r.mesh.visible=false;r.mesh.userData.collisionProxy=true;}
  }
  for(const [material,positions]of byMaterial){const geometry=this.geo(new THREE.BufferGeometry());geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));const uv=[];for(let i=0;i<positions.length;i+=3)uv.push(positions[i]/4,positions[i+2]/4);geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.computeVertexNormals();geometry.computeBoundingSphere();const mesh=new THREE.Mesh(geometry,material);mesh.name='Unioned floors / no coincident tops';mesh.receiveShadow=true;this.root.add(mesh);}
 }
 batch(){
  for(const mesh of this.meshes)if(!mesh.userData.collisionProxy)this.sync(mesh,0);
  for(const compound of this.compounds)this.sync(compound.owner,0);
  this.batchFloors();
  this.root.updateWorldMatrix(true,true);const groups=new Map();
  for(const mesh of this.static){if(!mesh.visible)continue;
   // Torus and cylindrical detail is expensive. Keep each instance cloud
   // local so distant/off-screen rooms can be culled as independent groups.
   const cell=mesh.geometry===this.cube||mesh.geometry===this.round||mesh.geometry.userData.architecturalBatch?'':`:${Math.floor(mesh.position.x/64)}:${Math.floor(mesh.position.y/24)}:${Math.floor(mesh.position.z/64)}`;
   const key=mesh.geometry.uuid+mesh.material.uuid+cell;const list=groups.get(key)??[];list.push(mesh);groups.set(key,list);
  }
  for(const meshes of groups.values()){
   const batch=new THREE.InstancedMesh(meshes[0].geometry,meshes[0].material,meshes.length);batch.name='Instanced cathedral construction';batch.receiveShadow=true;
   meshes.forEach((mesh,i)=>{batch.setMatrixAt(i,mesh.matrixWorld);mesh.visible=false;if(mesh.userData.collider)mesh.userData.collisionProxy=true;});
   batch.instanceMatrix.needsUpdate=true;batch.computeBoundingSphere();this.root.add(batch);this.batches.push(batch);
  }
  this.game.indexColliders?.();
 }
 dispose(){
  for(const c of this.colliders)this.game.physics?.removeStaticBox(c.mesh.uuid);
  const remove=(array,items)=>{const set=new Set(items);let n=0;for(const v of array)if(!set.has(v))array[n++]=v;array.length=n;};
  remove(this.game.colliders,this.colliders);remove(this.game.floors,this.floors);remove(this.game.cameraBlockers,this.meshes);remove(this.game.aimBlockers,this.meshes);remove(this.game.portalPanels,this.panels);
  this.root.removeFromParent();this.batches.forEach(m=>m.dispose());this.geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());this.textures.forEach(t=>t.dispose());this.game.indexColliders?.();
 }
}
