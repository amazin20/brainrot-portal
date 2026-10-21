import * as THREE from 'three';
import {CASTLE_WING_FINISHES} from './LabCastleMaterials.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);

/** A closed casing with inset fields on both sides. Bounds and mesh identity
 * stay exact: physical cells keep their original contact/ray object and no
 * child can enlarge Box3.setFromObject during the cell's pose sync. */
export function castleMachineCasingGeometry(size,{axis='z',bays=1}={}){
 if(!size.every(v=>Number.isFinite(v)&&v>0))throw new RangeError('Positive castle casing dimensions required');
 const [sx,sy,sz]=size,width=axis==='x'?sz:sx,height=axis==='y'?sz:sy,depth=axis==='x'?sx:axis==='y'?sy:sz;
 const rim=Math.min(.22,width*.09,height*.09),recess=Math.min(.10,depth*.18),bevel=Math.min(.045,depth*.07,rim*.2);
 const positions=[],colors=[],uv=[];
 function vertex(p,tone){let [x,y,z]=p;if(axis==='x')[x,y,z]=[z,y,-x];else if(axis==='y')[x,y,z]=[x,z,-y];
  positions.push(x/sx,y/sy,z/sz);colors.push(tone,tone,tone);uv.push(p[0]/width+.5,p[1]/height+.5);}
 const tri=(a,b,c,t)=>[a,b,c].forEach(p=>vertex(p,t));
 const quad=(a,b,c,d,t)=>{tri(a,b,c,t);tri(a,c,d,t);};
 const x0=-width/2,x1=width/2,y0=-height/2,y1=height/2,z0=-depth/2,z1=depth/2;
 quad([x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],.65);
 quad([x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0],.88);
 quad([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],.60);
 quad([x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],.60);
 const count=Math.min(5,Math.max(1,bays)),span=width/count;
 for(const sign of [-1,1])for(let i=0;i<count;i++){
  const a=x0+i*span,b=a+span,f=sign*depth/2,flatTop=axis==='y'&&sign===1,r=flatTop?f:sign*(depth/2-recess);
  const outer=[[a,y0,f],[b,y0,f],[b,y1,f],[a,y1,f]];
  const insetZ=flatTop?f:f-sign*bevel;
  const inner=[[a+rim,y0+rim,insetZ],[b-rim,y0+rim,insetZ],
   [b-rim,y1-rim,insetZ],[a+rim,y1-rim,insetZ]];
  const field=inner.map(p=>[p[0],p[1],r]);
  const face=(a,b,c,d,t)=>sign>0?quad(a,b,c,d,t):quad(d,c,b,a,t);
  for(let j=0;j<4;j++){const n=(j+1)%4;face(outer[j],outer[n],inner[n],inner[j],.70);if(!flatTop)face(inner[j],inner[n],field[n],field[j],.40);}
  face(...field,1);
 }
 const geometry=new THREE.BufferGeometry();geometry.name='Castle / closed folded equipment casing';
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
 geometry.parameters={width:1,height:1,depth:1};geometry.userData.architecturalBatch=true;return geometry;
}

/** Pre-batch construction occupies existing equipment and the actual floor
 * union. No new collider, portal address, light or walkable surface. */
export function buildCastleAuditConstruction({game,k,rooms,machines,edges}){
 if(k.root.userData.castleVisualAudit)return k.root.userData.castleVisualAudit;
 const source=[...k.meshes],materials=new Map(),counts=new Map([...rooms.keys()].map(id=>[id,0]));
 const counters={casings:0,structuralMembers:0,tankShells:0,bearingBodies:0,coilWindings:0,instrumentCases:0,inlays:0,finaleMeshes:0};
 const roomFor=mesh=>[...rooms.values()].find(r=>mesh.position.y>=r.def.at[1]-.8&&mesh.position.y<=r.def.at[1]+r.def.h&&
  mesh.position.x>r.b.x0-.5&&mesh.position.x<r.b.x1+.5&&mesh.position.z>r.b.z0-.5&&mesh.position.z<r.b.z1+.5);
 const finish=(original,id,role,geometry)=>{
  // Wing tint lives in vertices, not twelve copies of every material. The
  // static merger can still join equipment by finish inside each spatial cell.
  const tint=original.color.clone().lerp(new THREE.Color(role==='structure'?0x344b59:CASTLE_WING_FINISHES[id]?.accent??0xb69b68),role==='structure'?.24:.10);
  const count=geometry.attributes.position.count;
  if(!geometry.attributes.color)geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(count*3).fill(1),3));
  const colors=geometry.attributes.color;
  for(let i=0;i<count;i++)colors.setXYZ(i,colors.getX(i)*tint.r,colors.getY(i)*tint.g,colors.getZ(i)*tint.b);
  if(materials.has(role))return materials.get(role);
  const material=k.mat(0xffffff,role==='bearing'?.56:.68,role==='bearing'?.38:.20);
  material.name='Castle equipment / shared '+role;material.vertexColors=true;materials.set(role,material);return material;
 };
 function casing(mesh,room,structural=false){
  if(mesh.userData.castleAuditCasing||!mesh.userData.collider||mesh.userData.floor||mesh.userData.collisionProxy||k.panels.includes(mesh)||
   mesh.geometry.parameters?.width!==1||mesh.geometry.parameters?.height!==1||mesh.geometry.parameters?.depth!==1||mesh.material.transparent)return;
  const size=mesh.scale.toArray().map(Math.abs),[x,y,z]=size,axis=['x','y','z'][size.indexOf(Math.min(...size))];
  if(structural?!(y>5&&Math.max(x,z)<1.4):!(Math.max(x,y,z)>3&&size.filter(v=>v>1.25).length>=2))return;
  mesh.geometry=k.geo(castleMachineCasingGeometry(size,{axis,bays:structural?1:Math.min(4,Math.max(1,Math.floor((axis==='x'?z:x)/5)))}));
  mesh.material=finish(mesh.material,room.def.id,structural?'structure':'casing',mesh.geometry);mesh.userData.castleAuditCasing=true;
  counts.set(room.def.id,counts.get(room.def.id)+1);counters[structural?'structuralMembers':'casings']++;
 }
 for(const mesh of source){
  const r=roomFor(mesh);if(!r)continue;
  if(!/Castle wing wall|Portal address|Castle fixed glazed|castle cast-in floor/i.test(mesh.material?.name??'')){casing(mesh,r);casing(mesh,r,true);}
  if(r.def.id==='sluice'&&mesh.geometry.type==='CylinderGeometry'&&Math.abs(mesh.scale.x-3)<.01&&[3,7,10].includes(mesh.scale.y)){
   const points=[[0,-.5],[.68,-.5],[.93,-.47],[1,-.45],[1,-.40],[.94,-.37],[.94,.32],
    [1,.35],[1,.40],[.94,.43],[.72,.48],[.42,.5],[0,.5]].map(([x,y])=>new THREE.Vector2(x,y));
   mesh.geometry=k.geo(new THREE.LatheGeometry(points,24));mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
   mesh.geometry.name='Castle tank / rolled barrel, base flange and shouldered head';counters.tankShells++;counts.set('sluice',counts.get('sluice')+1);
  }
  // Finite bearing boxes keep their exact collider and pose. Their new
  // shouldered flange profile reads as a rotary joint inside that same box.
  if(mesh.userData.collider&&!mesh.userData.collisionProxy&&/hinge bearing|rotor \d+ hub|fixed bearing axle|rotary hydraulic damper|fixed retaining catch axle/.test(mesh.name)){
   const profile=[[0,-.5],[.5,-.5],[.5,-.35],[.40,-.29],[.40,.29],[.5,.35],[.5,.5],[0,.5]].map(([x,y])=>new THREE.Vector2(x,y));
   const geometry=k.geo(new THREE.LatheGeometry(profile,16)),axis=mesh.scale.toArray().indexOf(Math.min(...mesh.scale.toArray()));
   if(axis===0)geometry.rotateZ(Math.PI/2);else if(axis===2)geometry.rotateX(Math.PI/2);
   geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.name='Castle / flanged bearing body';geometry.userData.architecturalBatch=true;
   mesh.geometry=geometry;mesh.material=finish(mesh.material,r.def.id,'bearing',geometry);counters.bearingBodies++;counts.set(r.def.id,counts.get(r.def.id)+1);
  }
  if(r.def.id==='magnet'&&mesh.geometry.type==='TorusGeometry'&&mesh.geometry.parameters.arc<Math.PI*1.1&&mesh.geometry.parameters.radius>2.5){
   const {radius,arc}=mesh.geometry.parameters,points=[],turns=18;
   for(let i=0;i<=216;i++){
    const t=i/216,angle=t*arc,phase=t*Math.PI*2*turns,radial=radius+.145*Math.cos(phase);
    points.push(V(radial*Math.cos(angle),radial*Math.sin(angle),.145*Math.sin(phase)));
   }
   const geometry=k.geo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),216,.035,5,false));
   const material=k.mat(0xae713d,.59,.40);material.name='Castle magnet / copper winding inside horseshoe guard';
   const winding=k.mesh(geometry,material,mesh.position.toArray());winding.quaternion.copy(mesh.quaternion);
   winding.name='Castle magnet / visible eighteen-turn winding';winding.userData.visualOnly=true;
   counters.coilWindings++;counts.set(r.def.id,counts.get(r.def.id)+1);
  }
 }
 const instrumentMaterial=k.mat(0x354d59,.73,.18);instrumentMaterial.vertexColors=true;instrumentMaterial.name='Castle instruments / dark folded enclosure';
 for(const sign of source){
  if(sign.geometry.type!=='PlaneGeometry'||!sign.material?.map?.isCanvasTexture||sign.userData.castleAuditInstrument)continue;
  const {width,height}=sign.geometry.parameters;if(width<.5||height<.1)continue;
  const normal=V(0,0,1).applyQuaternion(sign.quaternion),p=sign.position.clone().addScaledVector(normal,-.105);
  const body=k.mesh(k.geo(castleMachineCasingGeometry([width+.16,height+.16,.18])),instrumentMaterial,p.toArray(),[width+.16,height+.16,.18]);
  body.quaternion.copy(sign.quaternion);body.name='Castle instrument / mounted folded case';body.userData.visualOnly=true;
  sign.userData.castleAuditInstrument=true;counters.instrumentCases++;
 }
 // Work-bay stone is part of the non-overlapping floor union. Its rectangle
 // is clipped by the real room's pit/floor ownership; it never bridges a gap.
 const bays={freight:[[-15,-5,3,15]],sluice:[[-19,19,-15,-5]],optics:[[-28,20,-15,10]],hoist:[[-16,7,-14,4]],
  archive:[[-15,12,-12,12]],flywheel:[[-14,13,-15,-7]],magnet:[[-16,16,-4,14]],migrant:[[-11,13,-5,5]],
  pendulum:[[-20,-14,-5,5]],inertia:[[-31,-23,-17,13]],impulse:[[-1,15,-3,11]],crown:[[-13,-5,3,16]]};
 for(const room of rooms.values()){
  const palette=CASTLE_WING_FINISHES[room.def.id],material=k.mat(palette.floor,.84,.035);
  material.name='Castle work bay / '+room.def.id;material.color.lerp(new THREE.Color(palette.accent),.22);material.map=k.m.floor.map;
  for(const [x0,x1,z0,z1]of bays[room.def.id]??[]){
   k.floorInlays.push({minX:room.def.at[0]+x0,maxX:room.def.at[0]+x1,minZ:room.def.at[2]+z0,maxZ:room.def.at[2]+z1,y:room.def.at[1],material,baseOnly:true});counters.inlays++;
  }
 }
 // A deliberately transparent energy crown marks the real final contact in
 // three dimensions. It cannot be mistaken for an uncollidable solid gate.
 const crown=rooms.get('crown'),contact=machines.get('crown')?.state.contact,socket=machines.get('crown')?.state.socket;
 if(crown&&contact&&socket){
  const energy=k.mat(0xffd18a,1,0,0xffd18a,true);energy.name='Castle finale / amber energy aperture';energy.transparent=true;energy.opacity=.72;
  energy.depthWrite=false;energy.blending=THREE.AdditiveBlending;energy.side=THREE.DoubleSide;
  const halo=k.geo(new THREE.TorusGeometry(1,.025,6,64,Math.PI*1.75));
  for(const [radius,dy,dz,angle]of [[2.4,3.3,1.1,.12],[2.9,3.3,1.16,Math.PI*.82],[3.45,3.3,1.22,Math.PI*1.35]]){
   const mesh=k.mesh(halo,energy,[contact[0],contact[1]+dy,contact[2]+dz],[radius,radius,radius]);mesh.rotation.z=angle;
   mesh.name='Castle finale / suspended energy crown';mesh.userData.visualOnly=true;counters.finaleMeshes++;
  }
  const beam=k.geo(new THREE.CylinderGeometry(.023,.023,1,8));
  for(const p of [contact,socket]){
   const ring=k.mesh(k.geo(new THREE.TorusGeometry(p===contact?1.2:1.5,.045,6,48)),energy,[p[0],p[1]+.085,p[2]]);
   ring.rotation.x=-Math.PI/2;ring.name='Castle finale / independent docking halo';ring.userData.visualOnly=true;counters.finaleMeshes++;
   for(const side of [-1,1]){
    const mesh=k.mesh(beam,energy,[p[0]+side*(p===contact?1.35:1.65),p[1]+1.6,p[2]],[1,3.1,1]);
    mesh.name='Castle finale / docking energy filament';mesh.userData.visualOnly=true;counters.finaleMeshes++;
   }
  }
  const rear=source.find(mesh=>mesh.userData.collider&&!mesh.userData.collider.kinematic&&mesh.material?.name==='Castle wing wall / crown'&&
   mesh.scale.z<.8&&Math.abs(mesh.position.z-crown.b.z1)<.8&&mesh.scale.x>20);
  if(rear){casing(rear,crown);rear.userData.castleFinaleBackdrop=true;}
 }
 const result=Object.freeze({revision:66,...counters,sharedEquipmentFinishes:materials.size,sections:Object.freeze(Object.fromEntries(counts)),extraColliders:0,extraLights:0,perFrameCallbacks:0});
 k.root.userData.castleVisualAudit=result;return result;
}

export function finishVisualAuditCastle(game,level,index,roots){
 if(!level?.tower||!level.singularity)return level;
 level.visualAuditCastle=level.structure?.userData.castleVisualAudit??null;return level;
}
