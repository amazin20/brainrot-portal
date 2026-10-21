import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const V=(...p)=>new THREE.Vector3(...p),Q=()=>new THREE.Quaternion();
const STABLE_LEVELS=new Set([35,36,37,38,39,40,42,43,44,45,46,47,48,49,50,51]);

function coloured(geometry,tone){
 const g=geometry.index?geometry.toNonIndexed():geometry;
 if(g!==geometry)geometry.dispose();
 const c=new Float32Array(g.attributes.position.count*3);
 for(let i=0;i<c.length;i+=3)c.set(Array.isArray(tone)?tone:[tone,tone,tone],i);
 g.setAttribute('color',new THREE.BufferAttribute(c,3));return g;
}

/** This is a closed manufactured volume, not a front decal. Both faces have
 * recesses; the unchanged perimeter owns the exact original physical box.
 * All fittings stay behind that perimeter, including live dial pointers. */
export function lateMachineHousingGeometry(width,height,depth,{kind='drive',axis='z'}={}){
 const w=axis==='x'?depth:width,h=axis==='y'?depth:height,d=axis==='x'?width:axis==='y'?height:depth;
 if(![w,h,d].every(v=>Number.isFinite(v)&&v>0))throw new RangeError('Finite positive machine housing dimensions required');
 const parts=[],rim=Math.min(w*.095,h*.095,.44),fieldW=w-2*rim,fieldH=h-2*rim;
 const box=(x,y,z,a,b,c,t=.9,angle=0)=>{
  if(Math.min(a,b,c)<=0)return;
  const g=coloured(new THREE.BoxGeometry(a,b,c),t);if(angle)g.rotateZ(angle);g.translate(x,y,z);parts.push(g);
 };
 // Four non-overlapping folded rails and a genuinely recessed closed field.
 for(const x of [-1,1])box(x*(w-rim)/2,0,0,rim,h,d,.53);
 for(const y of [-1,1])box(0,y*(h-rim)/2,0,fieldW,rim,d,.66);
 box(0,0,0,fieldW,fieldH,d*.62,.96);
 for(const sign of [-1,1]){
  const z=sign*d*.395,skin=d*.09;
  if(kind==='weight'){
   // Captive straps and recessed cast-in lifting pads on the actual weight.
   for(const x of [-1,1])box(x*fieldW*.31,0,z,Math.min(.22,fieldW*.09),fieldH*.96,skin,.30);
   for(const y of [-1,1])box(0,y*fieldH*.34,z,fieldW*.76,Math.min(.2,fieldH*.08),skin,.64);
   box(0,0,z,fieldW*.34,fieldH*.37,skin,.76);
  }else if(kind==='rail'){
   for(const y of [-1,1])box(0,y*fieldH*.30,z,fieldW*.93,Math.min(.16,fieldH*.11),skin,.34);
   for(const x of [-1,1])box(x*fieldW*.36,0,z,Math.min(.24,fieldW*.1),fieldH*.75,skin,.70);
  }else if(kind==='pressure'){
   for(const x of [-1,1])box(x*fieldW*.31,0,z,fieldW*.21,fieldH*.72,skin,.43);
   box(0,-fieldH*.26,z,fieldW*.83,Math.min(.18,fieldH*.13),skin,.65);
   box(0,fieldH*.28,z,fieldW*.70,Math.min(.11,fieldH*.09),skin,.28);
  }else if(kind==='thermal'){
   const count=Math.min(7,Math.max(3,Math.floor(fieldW/1.1)));
   for(let i=0;i<count;i++)box((i-(count-1)/2)*fieldW/(count+1),0,z,fieldW/(count+1)*.37,fieldH*.66,skin,.38);
   for(const y of [-1,1])box(0,y*fieldH*.39,z,fieldW*.85,Math.min(.13,fieldH*.06),skin,.63);
  }else if(kind==='sluice'){
   for(const x of [-1,1])box(x*fieldW*.40,0,z,fieldW*.07,fieldH*.87,skin,.26);
   box(0,0,z,fieldW*.60,Math.min(.18,fieldH*.065),skin,.41);
   box(0,fieldH*.32,z,fieldW*.63,Math.min(.16,fieldH*.08),skin,.67);
  }else{
   const count=Math.min(6,Math.max(3,Math.floor(fieldW/1.2)));
   for(let i=0;i<count;i++)box((i-(count-1)/2)*fieldW/(count+1),-fieldH*.18,z,fieldW/(count+1)*.45,fieldH*.36,skin,.35);
   box(0,fieldH*.28,z,fieldW*.78,Math.min(.18,fieldH*.11),skin,.66);
  }
 }
 const g=mergeGeometries(parts,false);parts.forEach(p=>p.dispose());
 if(axis==='x')g.rotateY(Math.PI/2);else if(axis==='y')g.rotateX(Math.PI/2);
 g.name='Closed late mechanism / '+kind;
 g.parameters={width,height,depth};g.computeBoundingBox();g.computeBoundingSphere();return g;
}

function removeBin(k,mesh){const bin=k.artBins.get(mesh.material),i=bin?.indexOf(mesh)??-1;if(i>=0)bin.splice(i,1);return i>=0;}
function mechanismMaterial(k,original,kind){
 k.visualAuditLateMaterials??=new Map();
 const variants=k.visualAuditLateMaterials.get(original)??new Map();
 if(!variants.has(kind)){
  const material=original.clone();material.name=(original.name||'Late mechanism enamel')+' / machined '+kind;
  material.vertexColors=true;material.needsUpdate=true;variants.set(kind,material);k.visualAuditLateMaterials.set(original,variants);
 }
 return variants.get(kind);
}
function boxSize(mesh){
 const p=mesh.geometry?.parameters;
 if(![p?.width,p?.height,p?.depth].every(Number.isFinite))return null;
 return [p.width,p.height,p.depth];
}
function machineBox(k,mesh,kind='drive',axis){
 if(!mesh?.isMesh||mesh.userData?.collisionProxy||mesh.userData?.visualAuditLateShape||Array.isArray(mesh.material))return false;
 const s=boxSize(mesh);if(!s||Math.min(...s)<.12)return false;
 if(!axis)axis=s[0]<s[1]&&s[0]<s[2]?'x':s[1]<s[2]?'y':'z';
 const old=mesh.geometry,batched=removeBin(k,mesh),material=mechanismMaterial(k,mesh.material,kind);
 old.computeBoundingBox();const localCenter=old.boundingBox.getCenter(V());
 mesh.geometry=lateMachineHousingGeometry(...s,{kind,axis});mesh.geometry.translate(...localCenter.toArray());mesh.material=material;mesh.userData.visualAuditLateShape=kind;old.dispose();
 if(batched){const bin=k.artBins.get(material)||[];bin.push(mesh);k.artBins.set(material,bin);}
 return true;
}
function at(mesh,p,tolerance=.025){return p.every((v,i)=>Math.abs(mesh.position.getComponent(i)-v)<tolerance);}
function beforeMeshes(k){const a=[];k.world.root.traverse(m=>{if(m.isMesh&&!m.userData?.collisionProxy)a.push(m);});return a;}
function select(k,predicate,kind,axis){let n=0;for(const m of beforeMeshes(k))if(predicate(m)&&machineBox(k,m,kind,axis))n++;return n;}

/** Keep the original torus' clear inner opening and outer envelope, while a
 * continuous copper winding gives the field coil a real mechanical body. */
export function lateToroidalWindingGeometry(radius=1.35,tube=.18){
 const wire=tube*.21,minor=tube*.72,points=[];
 for(let i=0;i<=240;i++){
  const a=i/240*Math.PI*2,b=a*16,r=radius+Math.cos(b)*minor;
  points.push(V(Math.cos(a)*r,Math.sin(a)*r,Math.sin(b)*minor));
 }
 const g=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points,true),240,wire,5,true);
 g.name='Continuous toroidal copper winding';g.computeBoundingBox();g.computeBoundingSphere();return g;
}

function finishProjectorBarrels(k){
 let n=0;
 for(const mesh of beforeMeshes(k)){
  const p=mesh.geometry?.parameters;
  if(mesh.geometry?.type!=='CylinderGeometry'||!p||p.height<1||p.height>2.1||p.radiusTop<.45||mesh.material!==k.m.shell)continue;
  const h=p.height,r=Math.max(p.radiusTop,p.radiusBottom),profile=[
   [0,-h/2],[r*.80,-h/2],[r,-h*.38],[r,-h*.26],[r*.83,-h*.20],
   [r*.83,h*.18],[r,h*.24],[r,h*.39],[r*.8,h/2],[0,h/2],
  ];
  const g=new THREE.LatheGeometry(profile.map(([x,y])=>new THREE.Vector2(x,y)),24);
  g.parameters={...p};g.name='Stepped sealed emitter barrel';g.computeBoundingBox();g.computeBoundingSphere();
  const old=mesh.geometry;mesh.geometry=g;old.dispose();mesh.userData.visualAuditLateShape='barrel';n++;
 }
 return n;
}

function dressDeckUnderfaces(k,stable){
 // Replace only the original .6–1m deep underdeck box, never the walking skin.
 // Two longitudinal ribs then read as a closed load chassis in the same box.
 const targets=new Set(stable===38?['North flight catch','Catch apron','West acceleration balcony']:
  stable===43?['Side observation return','High receiving terrace']:stable===46?['High joint receiving terrace']:
  stable===44?['Eastern receiving gallery']:[]);
 let n=0;
 for(const d of k.decks||[]){
  if(targets.size&&!targets.has(d.name)&&!/(receiving|gallery|island)/i.test(d.name))continue;
  if(!targets.size&&stable!==36&&stable!==40)continue;
  const x=(d.minX+d.maxX)/2,z=(d.minZ+d.maxZ)/2;
  for(const m of beforeMeshes(k))if(at(m,[x,d.y-.9,z])&&m.geometry?.parameters?.height===1&&machineBox(k,m,'rail','y'))n++;
 }
 return n;
}

function dressPilotBacks(k){
 let n=0;
 for(const mesh of beforeMeshes(k)){
  if(mesh.name==='Pilot / integral engineered observation casing'&&machineBox(k,mesh,'sluice'))n++;
  if(mesh.name==='Pilot / tapered closed platform sill'){
   mesh.geometry.computeBoundingBox();const size=mesh.geometry.boundingBox.getSize(V());
   mesh.geometry.parameters={width:size.x,height:size.y,depth:size.z};
   if(machineBox(k,mesh,'rail','y'))n++;
  }
 }
 return n;
}

function rampWebGeometry(source){
 source.computeBoundingBox();const b=source.boundingBox,positions=source.attributes.position;
 const x0=b.min.x,x1=b.max.x,z0=b.min.z,z1=b.max.z,base=b.min.y;
 let y0=-Infinity,y1=-Infinity;
 for(let i=0;i<positions.count;i++){
  if(Math.abs(positions.getZ(i)-z0)<.00001)y0=Math.max(y0,positions.getY(i));
  if(Math.abs(positions.getZ(i)-z1)<.00001)y1=Math.max(y1,positions.getY(i));
 }
 const parts=[],top=z=>THREE.MathUtils.lerp(y0,y1,(z-z0)/(z1-z0));
 const wedge=(a,c,p,q,bottomA,bottomC,topA,topC,tone)=>{
  const v=[[a,bottomA,p],[c,bottomA,p],[c,topA,p],[a,topA,p],[a,bottomC,q],[c,bottomC,q],[c,topC,q],[a,topC,q]];
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v.flat(),3));
  g.setIndex([0,3,2,0,2,1,4,5,6,4,6,7,0,1,5,0,5,4,2,3,7,2,7,6,0,4,7,0,7,3,1,2,6,1,6,5]);
  const n=g.toNonIndexed();g.dispose();n.computeVertexNormals();n.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count*2),2));parts.push(coloured(n,tone));
 };
 const inset=(x1-x0)*.23;
 wedge(x0+inset,x1-inset,z0,z1,base,base,y0,y1,.72);
 // A closed recessed web, full-depth top/bottom chords and short vertical
 // stiffeners follow the real inclined silhouette. They do not create steps.
 wedge(x0,x1,z0,z1,Math.max(base,y0-.16),Math.max(base,y1-.16),y0,y1,.43);
 wedge(x0,x1,z0,z1,base,base,Math.min(base+.12,y0),Math.min(base+.12,y1),.50);
 for(let i=1;i<=4;i++){
  const z=z0+(z1-z0)*i/5,a=z-.11,c=z+.11,h=Math.min(top(a),top(c));
  if(h>base+.16)wedge(x0,x1,a,c,base,base,h,h,.49);
 }
 const g=mergeGeometries(parts,false);parts.forEach(p=>p.dispose());g.computeBoundingBox();g.computeBoundingSphere();g.name='Recessed closed incline web with structural chords';return g;
}

function dressImpactRamp(k){
 let n=0;
 for(const mesh of beforeMeshes(k))if(mesh.name==='Continuous ramp cheek'){
  const old=mesh.geometry,batched=removeBin(k,mesh),material=mechanismMaterial(k,mesh.material,'incline web');
  mesh.geometry=rampWebGeometry(old);mesh.material=material;mesh.userData.visualAuditLateShape='incline web';old.dispose();
  if(batched){const bin=k.artBins.get(material)||[];bin.push(mesh);k.artBins.set(material,bin);}n++;
 }
 return n;
}

function finishSightHoops(k){
 let n=0,projection;
 for(const mesh of beforeMeshes(k))if(mesh.name==='51 / real packet sight hoop'){
  // These are projected range marks, deliberately distinct from the solid
  // metal rails. An interrupted translucent cyan arc cannot be mistaken for
  // a gold physical ring inexplicably suspended without legs or a collider.
  const batched=removeBin(k,mesh);
  projection??=new THREE.MeshBasicMaterial({name:'Echo / projected range calibration arc',color:0x72d2df,transparent:true,opacity:.34,depthWrite:false});
  mesh.material=projection;
  const old=mesh.geometry;mesh.geometry=new THREE.TorusGeometry(.75,.045,6,28,Math.PI*1.72);mesh.geometry.rotateZ(Math.PI*.64);old.dispose();
  mesh.userData.visualAuditLateShape='projected range arc';
  if(batched){const bin=k.artBins.get(projection)||[];bin.push(mesh);k.artBins.set(projection,bin);}
  n++;
 }
 for(const mesh of beforeMeshes(k))if(mesh.name==='51 / finite travelling packet'){
  mesh.material=mesh.material.clone();mesh.material.name='Echo / finite amber impulse';mesh.material.color.setHex(0xffd77c);
 }
 return n;
}

/** Runs while individual author meshes still exist, before OpenChamber's
 * static flush. Exact mesh identities, moving parents, colliders, normals of
 * portal planes, target registries and every solver state stay unchanged. */
export function dressVisualAuditLate(k,stableLevel=k.index+1){
 if(!STABLE_LEVELS.has(stableLevel)||k.visualAuditLate)return k.visualAuditLate??null;
 const stats={stableLevel,housings:0,barrels:0,windings:0,sightHoops:0,extraLights:0,downloadBytes:0};
 const shape=(predicate,kind,axis)=>{stats.housings+=select(k,predicate,kind,axis);};
 const largePanel=m=>{const s=boxSize(m);return s&&Math.max(...s)>5&&Math.min(...s)<1.2&&m.material===k.m.shell;};
 switch(stableLevel){
  case 35:
   shape(m=>/^Freight III \/ (opaque north wall|closed side|closed roof)/.test(m.name),'sluice');
   // installOpticsArt owns these two original receiver barrels and resolves
   // them by their primitive master before installing its bounded castings.
   break;
  case 36:
   shape(m=>m.name==='Angular impact paddle','drive','z');
   // The original bearing rings remain on their true stationary spindle.
   stats.housings+=dressDeckUnderfaces(k,stableLevel);break;
  case 37:
   for(const mesh of beforeMeshes(k))if(/^Magnetic field winding /.test(mesh.name)){
    const old=mesh.geometry;mesh.geometry=lateToroidalWindingGeometry();old.dispose();
    mesh.material.color.setHex(0xc2864b);mesh.material.roughness=.38;mesh.material.metalness=.74;stats.windings++;
   }
   shape(m=>{const s=boxSize(m);return s&&s[1]===.55&&s[0]>=3&&s[2]>=3&&Math.abs(m.position.y-1.98)<.01;},'rail','y');break;
  case 38:
   shape(m=>at(m,[24,21,-20]),'drive','x');
   stats.housings+=dressDeckUnderfaces(k,stableLevel);break;
  case 39:
   shape(m=>at(m,[8.2,1.8,4]),'thermal','x');
   // The existing optics pass owns both moving thermal leaf castings.
   break;
  case 40:
   shape(m=>/calibrated slit jaw|Optical overhead|Optical sill/.test(m.name),'rail','z');
   stats.housings+=dressDeckUnderfaces(k,stableLevel);break;
  case 42:
   shape(m=>m.name==='Differential cylinder crosshead','pressure','z');
   stats.barrels=finishProjectorBarrels(k);break;
  case 43:
   shape(m=>largePanel(m)&&m.position.y>2,'sluice');
   stats.housings+=dressDeckUnderfaces(k,stableLevel)+dressPilotBacks(k);break;
  case 44:
   shape(m=>largePanel(m)&&Math.abs(m.position.x+12)<.03,'rail','x');
   stats.housings+=dressDeckUnderfaces(k,stableLevel);break;
  case 45:
   shape(m=>m.parent?.name==='Countercurrent / live rising air valve','pressure','y');
   stats.barrels=finishProjectorBarrels(k);break;
  case 46:
   shape(m=>at(m,[10.65,20,8])||at(m,[-22,20,-19.4]),'sluice');
   stats.housings+=dressDeckUnderfaces(k,stableLevel);break;
  case 47:
   shape(m=>m.parent?.name==='47 / actual dynamic piston address'&&boxSize(m),'drive');
   shape(m=>largePanel(m)&&m.position.z===-17.2,'sluice','z');
   stats.housings+=dressImpactRamp(k);break;
  case 48:
   shape(m=>['48 / dynamic spring rail carriage','48 / physical pin-operated freight roof'].includes(m.parent?.name),'rail');
   shape(m=>m.name==='48 / real movable rear socket back','drive','z');break;
  case 49:
   shape(m=>m.parent?.name==='49 / actual force driven rail carriage'&&/side cheek|enclosed carriage roof|rear portal cheek/.test(m.name),'rail');
   shape(m=>/opaque receiver tube|closed receiver back/.test(m.name),'drive');break;
  case 50:
   shape(m=>m.name==='50 / rigid common lower counterweight','weight','z');
   shape(m=>/^50 \/ gravity suspended cup /.test(m.parent?.name)&&at(m,[0,-7,0]),'weight','z');
   shape(m=>/^50 \/ upper-pane fixed casing/.test(m.name),'rail');break;
  case 51:
   shape(m=>/51 \/ (long|short) spring receiver|51 \/ actual counterweighted door|51 \/ gravity counterweight|51 \/ real spring striker/.test(m.name),'weight');
   stats.sightHoops=finishSightHoops(k);stats.barrels=finishProjectorBarrels(k);break;
 }
 k.visualAuditLate=stats;k.world.root.userData.visualAuditLate=stats;return stats;
}

function dialOnMesh(k,host,{read,min=0,max=100,range=2.5}={}){
 const s=boxSize(host);if(!s||s[0]<.5||s[1]<.5||s[2]<.25)return null;
 const radius=Math.min(.38,s[0]*.19,s[1]*.29),z=s[2]*.47;
 const face=new THREE.MeshStandardMaterial({name:'Late mechanism / recessed ivory instrument face',color:0xe7ead9,roughness:.62,metalness:.06});
 const ink=new THREE.MeshStandardMaterial({name:'Late mechanism / moving physical reading needle',color:0x293f49,roughness:.55,metalness:.25});
 const group=new THREE.Group();group.name='Recessed live machine instrument';host.add(group);
 group.position.set(0,0,z);
 const faceMesh=k.geometry(new THREE.CylinderGeometry(radius,radius,s[2]*.018,24),face,[0,0,0],Q().setFromAxisAngle(V(1,0,0),Math.PI/2),{parent:group,batch:false,name:'Physical dial face'});
 const pointer=k.geometry(new THREE.BoxGeometry(radius*.10,radius*.78,s[2]*.014),ink,[0,radius*.31,s[2]*.018],Q(),{parent:group,batch:false,name:'Needle reading actual room mechanism'});
 for(let i=0;i<=8;i++){
  const a=-range/2+i*range/8;
  k.geometry(new THREE.BoxGeometry(radius*.08,radius*.16,s[2]*.012),ink,[Math.sin(a)*radius*.78,Math.cos(a)*radius*.78,s[2]*.016],Q().setFromAxisAngle(V(0,0,1),-a),{parent:group,batch:false,name:'Engraved physical scale'});
 }
 const update=()=>{const f=THREE.MathUtils.clamp((read()-min)/(max-min),0,1);pointer.rotation.z=range/2-range*f;pointer.position.x=-Math.sin(pointer.rotation.z)*radius*.31;pointer.position.y=Math.cos(pointer.rotation.z)*radius*.31;};
 k.renders.push(update);update();return {group,faceMesh,pointer};
}

/** Post-theme binding uses actual continuous mechanism values. It introduces
 * no independent progress, solution flag or timer; instruments ride the same
 * moving leaf whose physical box bounds still contain the complete dial. */
export function finishVisualAuditLate(game,level,index=level.index,roots=[]){
 const stable=index+1,k=level.workshop;
 if(!STABLE_LEVELS.has(stable)||!k||level.visualAuditLateBound)return level;
 const stats=k.visualAuditLate??dressVisualAuditLate(k,stable);
 let instruments=0;
 const named=name=>{let found;for(const root of roots.length?roots:[level.world.root])root.traverse(o=>{if(o.name===name&&!o.userData?.collisionProxy)found=o;});return found;};
 if(stable===42&&level.pressure){
  const host=named('Differential cylinder crosshead');
  if(host&&dialOnMesh(k,host,{read:()=>level.pressure.difference,min:-100,max:100}))instruments++;
 }
 if(stable===35)for(const gate of [level.first,level.second])for(const leaf of gate?.leaves||[])
  if(machineBox(k,leaf,'sluice','z'))stats.housings++;
 if(stable===35||stable===39)stats.barrels+=finishProjectorBarrels(k);
 if(stable===39&&level.thermal&&level.first?.mesh){
  if(dialOnMesh(k,level.first.mesh,{read:()=>level.thermal.temperature,min:20,max:470}))instruments++;
 }
 if(stable===40)for(const s of level.shutters||[]){
  const host=s.parts?.[2]?.mesh;
  if(host&&dialOnMesh(k,host,{read:()=>s.offset,min:-4,max:4}))instruments++;
 }
 level.visualAuditLateBound={...stats,instruments,perFrameReadings:instruments};return level;
}
