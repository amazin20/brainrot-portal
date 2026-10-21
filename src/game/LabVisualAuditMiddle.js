import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const V=(...a)=>new THREE.Vector3(...a),Q=()=>new THREE.Quaternion();
export const MIDDLE_AUDIT_REVISION='v66-authored-machine-finishes';
const COLORS={paint:0x709b94,dark:0x243d48,metal:0x9fafab,copper:0xd0a26d,ivory:0xc9d1c2};

/** Two broad moving arrow arms, one instanced draw, point along actual belt
 * traction. The top remains a visual marking, below foot contact tolerance. */
export function conveyorChevronGeometry(width){
 const span=(width-.4)/2,run=.42,length=Math.hypot(span,run),parts=[];
 for(const side of [-1,1]){
  const g=new THREE.BoxGeometry(length,.025,.085);
  g.rotateY(side*Math.atan2(run,span));g.translate(side*span/2,0,run/2);parts.push(g);
 }
 const geometry=mergeGeometries(parts,false);for(const g of parts)g.dispose();geometry.name='Conveyor directional chevron';return geometry;
}

/** Render owners remain siblings of the measured collision meshes. A trim
 * child would change Box3.setFromObject in the live door/ram solvers. Every
 * replacement vertex instead stays inside its original closed source volume,
 * follows its complete matrix, and adds no contact, ray or portal surface. */
function makeWorkshop(k,number){
 const root=new THREE.Group();root.name=`Visual audit ${number} / authored machinery`;root.userData={visualOnly:true,keepMaterial:true};k.world.root.add(root);
 const geometry={box:new RoundedBoxGeometry(1,1,1,1,.025),cylinder:new THREE.CylinderGeometry(1,1,1,24),wheel:new THREE.TorusGeometry(.84,.16,8,32),
  turned:new THREE.LatheGeometry([[0,-.5],[.87,-.5],[.94,-.46],[1,-.40],[1,-.31],[.84,-.27],[.84,.27],[1,.31],[1,.40],[.94,.46],[.87,.5],[0,.5]].map(p=>new THREE.Vector2(...p)),32)};
 const materials={paint:new THREE.MeshStandardMaterial({name:'Audit satin machine enamel',color:0xffffff,roughness:.64,metalness:.19}),
  metal:new THREE.MeshStandardMaterial({name:'Audit brushed machine alloy',color:0xffffff,roughness:.43,metalness:.68})};
 const mounts=[],banks=new Map(),restores=[],ownedMaterials=[],extras=[],cleanup=[];
 const meshes=[];k.world.root.traverse(m=>{if(m.isMesh&&!m.isInstancedMesh&&!m.userData?.collisionProxy&&!m.userData?.portalable&&!m.userData?.portalTile)meshes.push(m);});
 const boxMeshes=()=>meshes.filter(m=>{const p=m.geometry?.parameters;return p&&[p.width,p.height,p.depth].every(Number.isFinite)&&p.width>0&&p.height>0&&p.depth>0;});
 const visible=m=>m&&m.visible!==false&&(Array.isArray(m.material)?m.material.some(a=>a.visible!==false):m.material?.visible!==false);
 const named=name=>meshes.find(m=>m.name===name);
 const at=(p,size)=>boxMeshes().find(m=>m.position.distanceTo(V(...p))<.015&&V(m.geometry.parameters.width,m.geometry.parameters.height,m.geometry.parameters.depth).distanceTo(V(...size))<.015);
 const stats={revision:MIDDLE_AUDIT_REVISION,number,mounts:[],parts:0,batches:0,extraColliders:0,extraLights:0,independentClocks:0};
 function owner(target,name){
  if(!visible(target)||mounts.some(a=>a.target===target))return null;
  target.geometry.computeBoundingBox();const bounds=target.geometry.boundingBox.clone();
  const m={target,name,bounds,parts:[],cylindrical:target.geometry.type==='CylinderGeometry'};
  const original=target.material,clones=[];
  const hide=mat=>{const copy=mat.clone();copy.visible=false;copy.userData={...copy.userData,middleAuditOwner:root.uuid};clones.push(copy);ownedMaterials.push(copy);return copy;};
  target.material=Array.isArray(original)?original.map(hide):hide(original);
  // ResearchChamber's pending static bins are keyed by the old material.
  // Keep this hidden owner out of that bake; otherwise flush would revive a
  // plain original shell around the recessed replacement and occlude it.
  for(const list of k.artBins?.values?.()||[]){const i=list.indexOf(target);if(i>=0)list.splice(i,1);}
  restores.push({target,original,replacement:target.material});mounts.push(m);stats.mounts.push(name);return m;
 }
 function part(o,p,size,color=COLORS.paint,{kind='box',metal=false,q=Q()}={}){
  if(!o)return;
  const matrix=new THREE.Matrix4().compose(V(...p),q,V(...size)),g=geometry[kind];g.computeBoundingBox();
  const bounds=g.boundingBox.clone().applyMatrix4(matrix);
  if(!o.bounds.clone().expandByScalar(.0001).containsBox(bounds))throw new Error(`Audit ${number}: ${o.name} trim escaped its original box`);
  if(o.cylindrical){
   const r=o.target.geometry.parameters.radiusTop,h=o.target.geometry.parameters.height,point=V(),vertices=g.attributes.position;
   for(let n=0;n<vertices.count;n++){point.fromBufferAttribute(vertices,n).applyMatrix4(matrix);if(Math.hypot(point.x,point.z)>r+.0001||Math.abs(point.y)>h/2+.0001)throw new Error(`Audit ${number}: ${o.name} trim escaped its original cylinder`);}
  }
  const key=kind+':'+(metal?'metal':'paint'),row={owner:o,matrix,bounds,color};
  const list=banks.get(key)||[];list.push(row);banks.set(key,list);o.parts.push(row);stats.parts++;return row;
 }
 function chamber(target,name,{axis,paint=COLORS.paint,style='panel'}={}){
  const o=owner(target,name);if(!o)return;
  const s=o.bounds.getSize(V()),c=o.bounds.getCenter(V());axis??=(s.x<s.z?0:2);
  const n=axis===0?V(1,0,0):axis===1?V(0,1,0):V(0,0,1),right=axis===0?V(0,0,-1):V(1,0,0),up=axis===1?V(0,0,-1):V(0,1,0);
  const rotation=Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,n));
  const w=Math.abs(s.dot(right))*.985,h=Math.abs(s.dot(up))*.985,d=Math.abs(s.dot(n))*.985;
  const b=(x,y,z,a,b,e,col=paint,metal=false)=>part(o,c.clone().addScaledVector(right,x).addScaledVector(up,y).addScaledVector(n,z).toArray(),[a,b,e],col,{q:rotation,metal});
  const rim=Math.min(.20,w*.11,h*.11),well=d*.24;
  b(0,0,0,w,h,d-2*well,COLORS.dark);
  for(const sign of [-1,1]){
   const front=sign*(d/2-well/2),field=sign*(d/2-well*.78);
   b(0,0,field,w-rim*2,h-rim*2,well*.34,paint);
   for(const x of [-1,1])b(x*(w-rim)/2,0,front,rim,h,well,COLORS.metal,true);
   for(const y of [-1,1])b(0,y*(h-rim)/2,front,w-rim*2,rim,well,COLORS.dark);
   if(style==='electrode'){
    for(let i=0;i<5;i++)b(0,(i-2)*(h-rim*2)/5,sign*(d/2-well*.32),w-rim*2,(h-rim*2)*.075,well*.40,COLORS.copper,true);
   }else if(style==='rack'){
    const count=Math.min(18,Math.max(3,Math.floor(w/.7)));
    for(let i=0;i<count;i++)b(-w/2+rim+(w-rim*2)*(i+.5)/count,0,sign*(d/2-well*.35),(w-rim*2)/count*.33,h-rim*2,well*.42,COLORS.copper,true);
   }else{
    const count=Math.min(5,Math.max(1,Math.floor(w/3)));
    for(let i=0;i<count;i++){
     const x=(i-(count-1)/2)*(w-rim*2)/count;
     b(x,0,sign*(d/2-well*.37),Math.min(.085,w*.045),h-rim*3,well*.40,COLORS.dark);
     for(const y of [-1,1])b(x,y*(h-rim*2)*.31,sign*(d/2-well*.31),(w-rim*2)/count*.68,Math.min(.10,h*.06),well*.38,COLORS.copper,true);
    }
   }
  }
  return o;
 }
 function vessel(target,name,{paint=COLORS.ivory}={}){
  const o=owner(target,name);if(!o)return;
  const p=target.geometry.parameters,size=o.bounds.getSize(V()),r=Math.min(p.radiusTop,p.radiusBottom,size.x/2,size.z/2)*.985,h=p.height*.995;
  if(!(r>0&&h>0))return;
  part(o,[0,0,0],[r,h,r],paint,{kind:'turned'});
  for(const sign of [-1,1]){
   part(o,[0,sign*h*.40,0],[r*.985,h*.10,r*.985],COLORS.metal,{kind:'cylinder',metal:true});
   part(o,[0,sign*h*.468,0],[r*.69,h*.048,r*.69],COLORS.dark,{kind:'cylinder'});
  }
  for(let i=0;i<6;i++){
   const a=i*Math.PI/3;
   part(o,[Math.cos(a)*r*.79,0,Math.sin(a)*r*.79],[r*.075,h*.52,r*.075],COLORS.copper,{metal:true,q:Q().setFromAxisAngle(V(0,1,0),-a)});
  }
  return o;
 }
 function coat(target,color){if(!target?.material)return;const original=target.material;
  const copy=mat=>{const m=mat.clone();m.color?.setHex(color);m.roughness=.56;m.metalness=.36;ownedMaterials.push(m);return m;};
  target.material=Array.isArray(original)?original.map(copy):copy(original);restores.push({target,original,replacement:target.material});}
 function nearestBox(p,predicate=()=>true){return boxMeshes().filter(m=>visible(m)&&predicate(m.geometry.parameters,m)).sort((a,b)=>a.getWorldPosition(V()).distanceToSquared(V(...p))-b.getWorldPosition(V()).distanceToSquared(V(...p)))[0];}
 function handwheel(target,name){
  const o=owner(target,name);if(!o)return;
  const s=o.bounds.getSize(V()),c=o.bounds.getCenter(V()),r=Math.min(s.x,s.y)*.485;
  const q=Q().setFromAxisAngle(V(1,0,0),Math.PI/2);
  part(o,c.toArray(),[r*.34,s.z*.98,r*.34],COLORS.metal,{kind:'cylinder',metal:true,q});
  for(const sign of [-1,1]){
   part(o,c.clone().add(V(0,0,sign*s.z*.34)).toArray(),[r,r,s.z*.70],COLORS.copper,{kind:'wheel',metal:true});
   for(let i=0;i<3;i++){const angle=i*Math.PI*2/3;
    part(o,c.clone().add(V(Math.cos(angle)*r*.40,Math.sin(angle)*r*.40,sign*s.z*.34)).toArray(),[r*.70,r*.12,s.z*.13],COLORS.dark,{q:Q().setFromAxisAngle(V(0,0,1),angle)});
   }
  }
  return o;
 }
 function finish(){
  for(const [key,list]of banks){const [kind,mat]=key.split(':'),batch=new THREE.InstancedMesh(geometry[kind],materials[mat],list.length);
   batch.name=`Audit ${number} / ${key}`;batch.castShadow=false;batch.receiveShadow=true;batch.frustumCulled=false;batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);root.add(batch);
   list.forEach((p,i)=>{p.mesh=batch;p.index=i;batch.setColorAt(i,new THREE.Color(p.color));});batch.instanceColor.needsUpdate=true;stats.batches++;
  }
  const inv=new THREE.Matrix4(),pose=new THREE.Matrix4(),matrix=new THREE.Matrix4();let disposed=false;
  const sync=()=>{if(disposed)return;root.updateWorldMatrix(true,false);inv.copy(root.matrixWorld).invert();
   for(const o of mounts){o.target.updateWorldMatrix(true,false);pose.multiplyMatrices(inv,o.target.matrixWorld);for(const p of o.parts)p.mesh.setMatrixAt(p.index,matrix.multiplyMatrices(pose,p.matrix));}
   for(const list of banks.values())list[0].mesh.instanceMatrix.needsUpdate=true;for(const fn of extras)fn();};
  k.renders.push(sync);k.resets.push(sync);sync();
  root.userData.stats=stats;root.mounts=mounts;
  root.dispose=()=>{if(disposed)return;disposed=true;root.removeFromParent();for(const row of restores){
   const current=Array.isArray(row.target.material)?row.target.material:[row.target.material];
   if(row.target.material===row.replacement||current.every(m=>m?.userData?.middleAuditOwner===root.uuid))row.target.material=row.original;
  }
   for(const fn of cleanup)fn();for(const list of banks.values())list[0].mesh.dispose();for(const g of Object.values(geometry))g.dispose();for(const m of Object.values(materials))m.dispose();for(const m of ownedMaterials)m.dispose();root.clear();};
  return {root,stats,sync};
 }
 return {root,meshes,boxMeshes,named,at,visible,chamber,vessel,coat,nearestBox,handwheel,extras,cleanup,stats,finish};
}

/** Pre-flush entry for ResearchChamber and ordinary Workshop builders. */
export function installVisualAuditMiddleKit(k,number){
 if(k.game.chamberEdition!=='foundation'||number<18||number>34||k.visualAuditMiddle)return k.visualAuditMiddle;
 const a=makeWorkshop(k,number),{named,at,chamber,vessel,coat,nearestBox}=a;
 switch(number){
  case 18:
   for(const e of k.world.root.children.filter(m=>m.name==='Spring-loaded insulated electrode'))chamber(e,'18 / ribbed ceramic clamping jaw',{axis:0,paint:0xb8c6ba,style:'electrode'});
   chamber(at([10.35,5.1,-6.1],[2,1.4,1.25]),'18 / screw-drive motor casting',{paint:0x506c72});
   break;
  case 19:
   chamber(nearestBox([-17,.7,9],p=>p.width>1&&p.width<7&&p.height<4&&p.depth>1&&p.depth<7),'19 / fan founded service plinth',{paint:0x6c7f72});
   break;
  case 20:
   a.handwheel(named('Finite motor-free hook hand rotor'),'20 / cast handwheel and passive coupling');
   for(const name of ['Loaded near-hook bearing arm','Near connector neck','Bearing-arm neck connection','Rigid hook back connector','Actual hook closed seat'])coat(named(name),0xcfa467);
   chamber(named('Tension-driven horizontal bulkhead'),'20 / tension door closed casing',{paint:0x8b9b91});
   break;
  case 21:
   chamber(named('Cassette rear header / solid'),'21 / counterweight return upper casing',{axis:0,paint:0x7b9a88});
   chamber(named('Cassette north enclosure / solid'),'21 / counterweight north load frame',{paint:0x5f807b});
   break;
  case 22:
   // The ordinary shutter cassettes have their own existing follower banks;
   // staircase geometry and central structural finish belong to the shared pass.
   chamber(nearestBox([-12,.45,-5.75],p=>p.width>2&&p.width<5&&p.height<1.5&&p.depth>1&&p.depth<3),'22 / winch founded load pedestal',{paint:0x587b70});
   break;
  case 23:
   for(const car of [k.state.balance?.west,k.state.balance?.east].filter(Boolean)){
    const source=car.group.children.find(m=>m.geometry?.parameters?.height===.5);
    chamber(source,'23 / suspended car ribbed load chassis',{axis:1,paint:0x6d9385});
   }
   for(const part of k.state.balance?.parts||[])if(/counterweight|hood/i.test(part.mesh?.name||''))chamber(part.mesh,'23 / actual guided load casing',{axis:1});
   break;
  case 24:{
   const coral=a.boxMeshes().filter(m=>{const p=m.geometry.parameters,c=m.material?.color;return a.visible(m)&&p.height>4&&Math.min(p.width,p.depth)<1&&c&&c.r>c.g*1.14;}).sort((x,y)=>y.geometry.parameters.height*Math.max(y.geometry.parameters.width,y.geometry.parameters.depth)-x.geometry.parameters.height*Math.max(x.geometry.parameters.width,x.geometry.parameters.depth))[0];
   chamber(coral,'24 / pavilion coral access cassettes',{paint:0xb87b6b});break;
  }
  case 25:
   for(const blade of k.state.optical?.blades||[])coat(blade.mesh,0x436d74);
   chamber(named('Room25 optical freight carriage'),'25 / guided optical carriage channel',{axis:1,paint:0x628b8c});
   for(const m of a.meshes.filter(m=>m.name==='Room25 founded shutter end stop'))chamber(m,'25 / shutter founded stop shoe',{paint:0x7d9294});
   break;
  case 26:
   chamber(at([-6,12,-8],[.4,24,16]),'26 / central crossflow service enclosure',{axis:0,paint:0x668d83});
   break;
  case 27:
   for(const band of k.state.conveyors?.bands||[]){
    const body=nearestBox([band.x,band.y-.24,(band.z0+band.z1)/2],p=>p.width<1&&p.height<1&&p.depth>5);
    chamber(body,`27 / ${band.name} formed belt edge`,{axis:0,paint:0xd1a249,style:'rack'});
   }
   break;
  case 28:
   for(const mesh of a.meshes){
    if(/Basin [AB] gauge backing/.test(mesh.name))chamber(mesh,mesh.name+' / sealed instrument housing',{paint:0x507c78});
    if(/live water-level gauge|near-mouth live status|Conserved tidal circuit and live flow status/.test(mesh.name)&&mesh.geometry.type==='PlaneGeometry'){
     const scale=mesh.scale.clone();mesh.scale.multiplyScalar(.72);a.stats.reducedReadouts=(a.stats.reducedReadouts||0)+1;
     // Only a non-interactive label is scaled; its housing and collider remain.
     a.cleanup.push(()=>mesh.scale.copy(scale));
    }
   }
   break;
  case 29:
   for(const mesh of k.world.root.children.filter(m=>m.isInstancedMesh&&m.geometry?.type==='ConeGeometry'&&m.count===40)){
    const originalMaterial=mesh.material,originalGeometry=mesh.geometry,mat=mesh.material.clone(),g=mesh.geometry.clone();
    mat.color.setHex(0xffd164);mat.toneMapped=false;g.scale(1.32,1.17,1.32);mesh.material=mat;mesh.geometry=g;
    a.cleanup.push(()=>{mesh.material=originalMaterial;mesh.geometry=originalGeometry;mat.dispose();g.dispose();});a.stats.gravityMarkers=40;
   }
   break;
  case 30:
   chamber(named('Hub-to-outlet sightline screen'),'30 / launch separator structural bays',{axis:0,paint:0x4b809b});
   break;
  case 31:
   chamber(named('Cargo-driven rack contact'),'31 / bronze rack contact shoe',{axis:0,paint:0xc49b61,style:'rack'});
   chamber(at([-14.5,2.14,11.4],[13.6,.12,.20]),'31 / visible rack guide channel',{axis:2,paint:0x688b98,style:'rack'});
   break;
  case 32:
   chamber(named('Source optical trunk / lower solid cheek'),'32 / optical trunk folded lower casting',{paint:0x455d6e});
   chamber(named('Cargo-shadow inspection cover'),'32 / inspection cassette',{paint:0x6d8999});
   break;
  case 33:
   chamber(named('Hydraulic ram cylinder base'),'33 / founded hydraulic valve body',{paint:0x5c839b});
   vessel(named('Water driven telescopic piston rod'),'33 / machined telescopic ram');
   for(const m of a.meshes.filter(m=>m.name==='Pressure line external sleeve'))vessel(m,'33 / flanged pressure-line coupling',{paint:0x819caa});
   break;
  case 34:
   vessel(named('Compressed air reservoir'),'34 / flanged pressure vessel',{paint:0xb9ccc6});
   for(const m of a.meshes.filter(m=>m.name==='Pressure manifold tube'))vessel(m,'34 / formed manifold quick-coupling ends',{paint:0x7c9e9e});
   chamber(named('Pressure-driven guided door'),'34 / pressure actuator door casing',{paint:0x698a9a});
   break;
 }
 const result=a.finish();k.visualAuditMiddle=result;return result;
}

export function finishVisualAuditMiddle(game,level,index=level.index){
 if(game.chamberEdition!=='foundation'||index<17||index>33||level.visualAuditMiddle)return level;
 const k=level.workshop;if(!k)return level;
 const art=k.visualAuditMiddle||installVisualAuditMiddleKit(k,index+1);if(!art)return level;
 const oldRender=level.renderUpdate,oldReset=level.reset,oldDispose=level.dispose;
 // Pre-flush installations already share the Workshop clock; the fallback
 // is also in k.renders, so this wrapper only owns deterministic cleanup.
 level.dispose=function(...args){art.root.dispose();return oldDispose?.apply(this,args);};
 level.visualAuditMiddle=art;art.root.ownedLifecycle={oldRender,oldReset};return level;
}
