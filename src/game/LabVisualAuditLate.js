import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {lateCassetteBulkheadGeometry,latePressureManifoldGeometry,installOpticalRailTruck} from './LabLateMachineConstruction.js';

const V=(...p)=>new THREE.Vector3(...p),Q=()=>new THREE.Quaternion();
const STABLE_LEVELS=new Set([35,36,37,38,39,40,42,43,44,45,46,47,48,49,50,51]);
// Archive builders share these stable numbers with the newer progression,
// but contain different physical mechanisms. Bind the new castings only to
// their authored variant; a missing owner in that variant still throws.
const TARGET_CASTING_VARIANTS=new Map([[44,'puzzle-progression44-rearrange-the-path'],[49,'puzzle-progression49-optical-transfer'],[50,'puzzle-progression50-folded-rift']]);
export const LATE_VISUAL_COMPLETION_REVISION='v67-pressure-painted-machinery';
const RGB=hex=>new THREE.Color(hex).toArray();
const LATE_DEVICE_COLORS=Object.freeze({paint:RGB(0x658f88),dark:RGB(0x253e4a),metal:RGB(0xb6c3ba),copper:RGB(0xc99665),ivory:RGB(0xc1cec2)});

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
 const colors=LATE_DEVICE_COLORS;
 const shade=t=>Array.isArray(t)?t:t<.40?colors.dark:t<.60?colors.metal:t<.76?colors.copper:t<.9?colors.ivory:colors.paint;
 const box=(x,y,z,a,b,c,t=.9,angle=0)=>{
  if(Math.min(a,b,c)<=0)return;
  const g=coloured(new THREE.BoxGeometry(a,b,c),shade(t));if(angle)g.rotateZ(angle);g.translate(x,y,z);parts.push(g);
 };
 // Four non-overlapping folded rails and a genuinely recessed closed field.
 for(const x of [-1,1])box(x*(w-rim)/2,0,0,rim,h,d,.53);
 for(const y of [-1,1])box(0,y*(h-rim)/2,0,fieldW,rim,d,.66);
 box(0,0,0,fieldW,fieldH,d*.62,.96);
 for(const sign of [-1,1]){
  const z=sign*d*.395,skin=d*.09;
  if(kind==='chassis'){
   // Full-depth perimeter girders and deep inspection coffers remain wholly
   // within the existing one-metre load chassis below the walking surface.
   const bays=Math.max(2,Math.min(5,Math.ceil(fieldW/7)));
   for(let i=0;i<bays;i++){
    const x=(i-(bays-1)/2)*fieldW/bays,span=fieldW/bays;
    box(x,0,z,span*.78,fieldH*.76,skin,colors.dark);
    box(x,0,sign*d*.437,Math.min(.24,span*.10),fieldH*.89,d*.070,colors.metal);
    for(const y of [-1,1])box(x,y*fieldH*.37,sign*d*.46,span*.87,Math.min(.23,fieldH*.11),d*.075,colors.copper);
   }
  }else if(kind==='weight'){
   // Captive straps and recessed cast-in lifting pads on the actual weight.
   for(const x of [-1,1])box(x*fieldW*.31,0,z,Math.min(.22,fieldW*.09),fieldH*.96,skin,.30);
   for(const y of [-1,1])box(0,y*fieldH*.34,sign*d*.455,fieldW*.76,Math.min(.2,fieldH*.08),skin*.7,.64);
   box(0,0,z,fieldW*.34,fieldH*.37,skin,.76);
  }else if(kind==='rail'){
   for(const y of [-1,1])box(0,y*fieldH*.30,z,fieldW*.93,Math.min(.16,fieldH*.11),skin,.34);
   for(const x of [-1,1])box(x*fieldW*.36,0,sign*d*.455,Math.min(.24,fieldW*.1),fieldH*.75,skin*.7,.70);
  }else if(kind==='valve'||kind==='piston'){
   // A cast closed pressure cover, captive fastening pads and radial drive
   // ribs belong to this real leaf/head, rather than an unrelated front decal.
   const r=Math.min(fieldW,fieldH)*.29;
   const disk=coloured(new THREE.CylinderGeometry(r,r,skin*1.7,24),colors.metal);
   disk.rotateX(Math.PI/2);disk.translate(0,0,z);parts.push(disk);
   for(let i=0;i<4;i++){
    const a=i*Math.PI/2,cx=Math.cos(a),cy=Math.sin(a);
    box(cx*fieldW*.32,cy*fieldH*.32,sign*d*.455,Math.max(.12,fieldW*.07),Math.max(.12,fieldH*.07),skin*.7,.28);
    const rib=coloured(new THREE.BoxGeometry(Math.min(fieldW,fieldH)*.25,Math.min(.22,r*.22),skin),colors.dark);
    rib.rotateZ(a);rib.translate(cx*r*1.02,cy*r*1.02,z);parts.push(rib);
   }
   const hub=coloured(new THREE.CylinderGeometry(r*.34,r*.34,skin*2,12),colors.copper);
   hub.rotateX(Math.PI/2);hub.translate(0,0,z);parts.push(hub);
  }else if(kind==='pressure'){
   for(const x of [-1,1])box(x*fieldW*.31,0,z,fieldW*.21,fieldH*.72,skin,.43);
   box(0,-fieldH*.26,sign*d*.455,fieldW*.78,Math.min(.18,fieldH*.13),skin*.7,.65);
   box(0,fieldH*.28,sign*d*.455,fieldW*.70,Math.min(.11,fieldH*.09),skin*.7,.28);
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
  const material=original.clone();material.name='Fabricated device enamel / '+kind;
  // Preserve the authored device materials through chapter tinting. Internal
  // partitions and moving machines must not collapse into the beige room skin.
  material.color.setHex(['bulkhead','drive','sluice','weight','rail','pressure','thermal','piston','valve','chassis','incline web','cast pneumatic manifold','sealed axle cartridge'].includes(kind)?0xffffff:kind==='rail truck'?0xc1d0c9:0xa1bab3);
  material.vertexColors=true;material.roughness=kind==='rail truck'?.44:.62;material.metalness=kind==='rail truck'?.54:.24;
  material.userData={...material.userData,keepMaterial:true,lateDeviceFinish:true};material.needsUpdate=true;variants.set(kind,material);k.visualAuditLateMaterials.set(original,variants);
 }
 return variants.get(kind);
}
function boxSize(mesh){
 const p=mesh.geometry?.parameters;
 if([p?.width,p?.height,p?.depth].every(Number.isFinite))return [p.width,p.height,p.depth];
 // Earlier folded-cassette builders emit BufferGeometry with no parameters.
 // Exact source-local bounds preserve those already translated hulls too.
 if(mesh.geometry?.type==='BufferGeometry'){
  mesh.geometry.computeBoundingBox();const s=mesh.geometry.boundingBox?.getSize(V());
  if(s&&[s.x,s.y,s.z].every(v=>Number.isFinite(v)&&v>0))return s.toArray();
 }
 return null;
}
function machineBox(k,mesh,kind='drive',axis){
 if(!mesh?.isMesh||mesh.userData?.collisionProxy||mesh.userData?.visualAuditLateShape||Array.isArray(mesh.material))return false;
 const s=boxSize(mesh);if(!s||Math.min(...s)<.12)return false;
 if(!axis)axis=s[0]<s[1]&&s[0]<s[2]?'x':s[1]<s[2]?'y':'z';
 const old=mesh.geometry,batched=removeBin(k,mesh),material=mechanismMaterial(k,mesh.material,kind);
 old.computeBoundingBox();const localCenter=old.boundingBox.getCenter(V());
 mesh.geometry=kind==='bulkhead'?lateCassetteBulkheadGeometry(...s,axis):lateMachineHousingGeometry(...s,{kind,axis});mesh.geometry.translate(...localCenter.toArray());mesh.material=material;mesh.userData.visualAuditLateShape=kind;old.dispose();
 if(batched){const bin=k.artBins.get(material)||[];bin.push(mesh);k.artBins.set(material,bin);}
 return true;
}

/** Delegate only drawing. Several late devices measure their real source
 * mesh on every step; a sibling casting retains its exact triangles, child
 * list and box, while using the same local pose and existing moving parent. */
function castMeasuredSource(k,source,kind='drive',axis='z',role=kind){
 if(!source?.isMesh||source.userData?.visualAuditLateShape||source.userData?.collisionProxy||Array.isArray(source.material))return null;
 const size=boxSize(source);if(!size)return null;
 source.geometry.computeBoundingBox();const center=source.geometry.boundingBox.getCenter(V());
 const geometry=kind==='bulkhead'?lateCassetteBulkheadGeometry(...size,axis):lateMachineHousingGeometry(...size,{kind,axis});geometry.translate(...center.toArray());
 const original=source.material,hidden=original.clone();hidden.name='Late mechanism / retained measured query owner';hidden.visible=false;hidden.userData={...hidden.userData,keepMaterial:true};source.material=hidden;
 const material=mechanismMaterial(k,original,kind),visual=k.geometry(geometry,material,source.position.toArray(),source.quaternion,{parent:source.parent,batch:false,name:'Late casting / '+role});
 visual.scale.copy(source.scale);visual.castShadow=source.castShadow;visual.receiveShadow=source.receiveShadow;
 visual.userData.visualAuditLateShape=kind;visual.userData.physicalSourceId=source.uuid;source.userData.visualAuditLateShape='measured '+role;
 const receipt={role,source,visual,size,axis};(k.visualAuditLateTargetBindings??=[]).push(receipt);
 const restore=k.restoreLight.bind(k);let disposed=false;
 k.restoreLight=()=>{if(!disposed){disposed=true;if(source.material===hidden)source.material=original;hidden.dispose();}restore();};
 return receipt;
}

function dressLowPortalBacks(k){
 let count=0;
 for(const name of ['bridge-source','first-bridge','north-bridge','exit-bridge','freight-return']){
  const panel=k.panels[name],back=panel?.group.children.find(m=>m.isMesh&&m.name==='Folded dark casing'&&at(m,[0,0,-.19]));
  if(!back)throw new Error('Missing actual low portal back casing: '+name);
  if(castMeasuredSource(k,back,'bulkhead','z','44 / '+name+' closed rear casing'))count++;
 }
 return count;
}

function dressFreightField(k){
 // This source is the reversible freight field, independent of the two
 // optical receiver tubes. Its real backplate is behind the emitted ray.
 const parent=k.world.root.children.find(n=>n.isGroup&&at(n,[-4.6,9.33,10.5]));
 const source=parent?.children.find(n=>n.isMesh&&n.geometry?.type==='BoxGeometry'&&at(n,[0,-.27,0]));
 if(!source)throw new Error('Missing actual 49 freight field backplate');
 const casing=castMeasuredSource(k,source,'drive','y','49 / reversible freight field enclosure');
 const rim=parent.children.find(n=>n.isMesh&&n.geometry?.type==='TorusGeometry'&&Math.abs(n.geometry.parameters.radius-2.02)<.001);
 if(!rim)throw new Error('Missing actual 49 freight field collar');
 const old=rim.geometry;rim.geometry=coloured(old.clone(),LATE_DEVICE_COLORS.copper);old.dispose();
 rim.material=mechanismMaterial(k,rim.material,'rail');rim.userData.visualAuditLateShape='freight field collar';
 // The original light ring still follows field.enabled/reversed. Only the
 // solid collar gains its cast metal finish; no signal or radius changes.
 return {casings:casing?1:0,collars:1};
}

function dressSuspendedCupBodies(k){
 let cups=0,hoods=0;
 const rotor=k.state.rotor;if(!rotor)throw new Error('Missing actual 50 folding rotor');
 for(const cup of rotor.cups)for(const source of cup.meshes){
  const size=boxSize(source);if(!size||Math.min(...size)<.2||Math.max(...size)<2||source.userData.visualAuditLateShape)continue;
  const axis=size[0]<size[1]&&size[0]<size[2]?'x':size[1]<size[2]?'y':'z';
  if(castMeasuredSource(k,source,'rail',axis,'50 / '+cup.name+' suspended load cup casting'))cups++;
 }
 for(const source of [...rotor.root.children])if(source.isMesh&&['50 / low freight hood side','50 / true oblique rebound freight roof'].includes(source.name)){
  const size=boxSize(source),axis=size[0]<size[1]&&size[0]<size[2]?'x':size[1]<size[2]?'y':'z';
  if(castMeasuredSource(k,source,'rail',axis,'50 / rotating freight hood casting'))hoods++;
 }
 return {cups,hoods};
}

function quietRailCourtBulkheads(k){
 const base=new THREE.Color(0x6d817b),retain=.18,rows=[];
 for(const mesh of beforeMeshes(k)){
  if(mesh.parent!==k.world.root||mesh.userData.visualAuditLateShape!=='bulkhead'||
   !(Math.abs(mesh.position.z-9)<.01||Math.abs(mesh.position.z+10.6)<.01||Math.abs(mesh.position.x-8.5)<.01))continue;
  const color=mesh.geometry.attributes.color;if(!color)continue;
  for(let i=0;i<color.count;i++)color.setXYZ(i,base.r+(color.getX(i)-base.r)*retain,base.g+(color.getY(i)-base.g)*retain,base.b+(color.getZ(i)-base.b)*retain);
  color.needsUpdate=true;mesh.userData.quietPassiveBulkhead=true;
  rows.push({position:mesh.position.toArray(),size:boxSize(mesh)});
 }
 k.visualAuditLateQuietWalls=rows;return rows.length;
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

function finishProjectorBarrels(k,{pressure=false}={}){
 let n=0;
 for(const mesh of beforeMeshes(k)){
  const p=mesh.geometry?.parameters;
  if(mesh.geometry?.type!=='CylinderGeometry'||!p||p.height<1||p.height>2.1||p.radiusTop<.45||mesh.material!==k.m.shell)continue;
  const h=p.height,r=Math.max(p.radiusTop,p.radiusBottom),profile=[
   [0,-h/2],[r*.80,-h/2],[r,-h*.38],[r,-h*.26],[r*.83,-h*.20],
   [r*.83,h*.18],[r,h*.24],[r,h*.39],[r*.8,h/2],[0,h/2],
  ];
  const g=pressure?latePressureManifoldGeometry(r,h):new THREE.LatheGeometry(profile.map(([x,y])=>new THREE.Vector2(x,y)),24);
  if(!pressure)g.parameters={...p};g.name=pressure?'Closed opposed-pressure manifold':'Stepped sealed emitter barrel';g.computeBoundingBox();g.computeBoundingSphere();
  const old=mesh.geometry;mesh.geometry=g;old.dispose();mesh.userData.visualAuditLateShape=pressure?'pressure manifold':'barrel';
  if(pressure){mesh.material=mechanismMaterial(k,mesh.material,'cast pneumatic manifold');mesh.userData.pressureManifold=true;}
  n++;
 }
 return n;
}

function dressDeckUnderfaces(k,stable){
 // Replace only the original .6–1m deep underdeck box, never the walking skin.
 // Two longitudinal ribs then read as a closed load chassis in the same box.
 const targets=new Set(stable===38?['North flight catch','Catch apron','West acceleration balcony']:
  stable===43?['Side observation return','High receiving terrace']:stable===46?['High joint receiving terrace']:
  stable===44?['Eastern receiving gallery']:stable===50?['Fold departure court','Permanent west cup gallery','Permanent east cup gallery','High returned portal court','Service return head']:[]);
 let n=0;
 for(const d of k.decks||[]){
  if(targets.size&&!targets.has(d.name)&&!/(receiving|gallery|island)/i.test(d.name))continue;
  if(!targets.size&&stable!==36&&stable!==40&&stable<42)continue;
  const x=(d.minX+d.maxX)/2,z=(d.minZ+d.maxZ)/2;
  for(const m of beforeMeshes(k))if(at(m,[x,d.y-.9,z])&&m.geometry?.parameters?.height===1&&machineBox(k,m,'chassis','y'))n++;
 }
 return n;
}

function dressPilotBacks(k){
 let n=0;
 for(const mesh of beforeMeshes(k)){
  if(mesh.name==='Pilot / integral engineered observation casing'&&machineBox(k,mesh,'bulkhead'))n++;
  if(mesh.name==='Pilot / tapered closed platform sill'){
   mesh.geometry.computeBoundingBox();const size=mesh.geometry.boundingBox.getSize(V());
   mesh.geometry.parameters={width:size.x,height:size.y,depth:size.z};
   if(machineBox(k,mesh,'rail','y'))n++;
  }
 }
 return n;
}

function dressFoldingSpindle(k){
 const mesh=k.world.root.getObjectByName('50 / actual common bearing spindle'),p=mesh?.geometry?.parameters;
 if(!mesh||!p||mesh.userData.visualAuditLateShape)return 0;
 const old=mesh.geometry;mesh.geometry=latePressureManifoldGeometry(p.radiusTop,p.height);
 mesh.geometry.name='Sealed split bearing cartridge on actual common axle';mesh.material=mechanismMaterial(k,mesh.material,'sealed axle cartridge');
 mesh.userData.visualAuditLateShape='axle cartridge';old.dispose();return 1;
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
  const n=g.toNonIndexed();g.dispose();n.computeVertexNormals();n.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count*2),2));parts.push(coloured(n,tone===.72?LATE_DEVICE_COLORS.dark:tone===.43?LATE_DEVICE_COLORS.metal:tone===.50?LATE_DEVICE_COLORS.copper:LATE_DEVICE_COLORS.paint));
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
  projection??=new THREE.MeshBasicMaterial({name:'Echo / projected range calibration arc',color:0x72d2df,transparent:true,opacity:.54,depthWrite:false});
  mesh.material=projection;
  const old=mesh.geometry;mesh.geometry=new THREE.TorusGeometry(.75,.065,6,36,Math.PI*1.72);mesh.geometry.rotateZ(Math.PI*.64);old.dispose();
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
 const targetCastingVariant=TARGET_CASTING_VARIANTS.get(stableLevel)===k.spec?.id;
 const stats={stableLevel,revision:LATE_VISUAL_COMPLETION_REVISION,housings:0,barrels:0,windings:0,sightHoops:0,railTrucks:0,portalBackCasings:0,freightFieldCasings:0,freightFieldCollars:0,suspendedCupCasings:0,freightHoodCasings:0,quietPassiveBulkheads:0,extraLights:0,downloadBytes:0};
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
   stats.barrels=finishProjectorBarrels(k,{pressure:true});break;
  case 43:
   shape(m=>largePanel(m)&&m.parent===k.world.root&&m.position.y>2,'bulkhead');
   stats.housings+=dressDeckUnderfaces(k,stableLevel)+dressPilotBacks(k);break;
  case 44:
   shape(m=>largePanel(m)&&m.parent===k.world.root,'bulkhead');
   if(targetCastingVariant){stats.portalBackCasings=dressLowPortalBacks(k);stats.housings+=stats.portalBackCasings;}
   stats.housings+=dressDeckUnderfaces(k,stableLevel);break;
  case 45:
   shape(m=>m.parent?.name==='Countercurrent / live rising air valve','valve','y');
   stats.barrels=finishProjectorBarrels(k);break;
  case 46:
   shape(m=>at(m,[10.65,20,8])||at(m,[-22,20,-19.4]),'bulkhead');
   stats.housings+=dressDeckUnderfaces(k,stableLevel);break;
  case 47:
   shape(m=>m.parent?.name==='47 / actual dynamic piston address'&&boxSize(m),'piston');
   shape(m=>largePanel(m)&&m.parent===k.world.root,'bulkhead');
   stats.housings+=dressImpactRamp(k);break;
  case 48:
   shape(m=>['48 / dynamic spring rail carriage','48 / physical pin-operated freight roof'].includes(m.parent?.name),'rail');
   shape(m=>m.name==='48 / real movable rear socket back','drive','z');
   shape(m=>largePanel(m)&&m.parent===k.world.root,'bulkhead');
   if(k.spec?.id==='puzzle-progression48-open-rail')stats.quietPassiveBulkheads=quietRailCourtBulkheads(k);break;
  case 49:
   shape(m=>m.parent?.name==='49 / actual force driven rail carriage'&&/side cheek|enclosed carriage roof|rear portal cheek/.test(m.name),'rail');
   shape(m=>/opaque receiver tube|closed receiver back/.test(m.name),'drive');
   if(targetCastingVariant){const field=dressFreightField(k);stats.freightFieldCasings=field.casings;stats.freightFieldCollars=field.collars;stats.housings+=field.casings;}
   {const parent=k.world.root.getObjectByName('49 / actual force driven rail carriage');
    if(parent){k.visualAuditLateRailTruck=installOpticalRailTruck(k,parent,mechanismMaterial(k,k.m.metal,'rail truck'));stats.railTrucks=k.visualAuditLateRailTruck?1:0;}}
   break;
  case 50:
   shape(m=>m.name==='50 / rigid common lower counterweight','weight','z');
   shape(m=>/^50 \/ gravity suspended cup /.test(m.parent?.name)&&at(m,[0,-7,0]),'weight','z');
   shape(m=>/^50 \/ upper-pane fixed casing/.test(m.name),'bulkhead');
   if(targetCastingVariant){const bodies=dressSuspendedCupBodies(k);stats.suspendedCupCasings=bodies.cups;stats.freightHoodCasings=bodies.hoods;stats.housings+=bodies.cups+bodies.hoods;}
   stats.housings+=dressDeckUnderfaces(k,stableLevel)+dressFoldingSpindle(k);break;
  case 51:
   shape(m=>/51 \/ (long|short) spring receiver|51 \/ real spring striker/.test(m.name),'piston');
   shape(m=>/51 \/ actual counterweighted door|51 \/ gravity counterweight/.test(m.name),'weight');
   stats.sightHoops=finishSightHoops(k);stats.barrels=finishProjectorBarrels(k);break;
 }
 if(stableLevel>=42)stats.housings+=dressDeckUnderfaces(k,stableLevel);
 k.visualAuditLate=stats;k.world.root.userData.visualAuditLate=stats;return stats;
}

function dialOnMesh(k,host,{read,min=0,max=100,range=2.5,mount}={}){
 const s=boxSize(host);if(!s||s[0]<.5||s[1]<.5||s[2]<.25)return null;
 const radius=Math.min(.38,s[0]*.19,s[1]*.29),z=s[2]*.47;
 const face=new THREE.MeshStandardMaterial({name:'Late mechanism / recessed ivory instrument face',color:0xe7ead9,roughness:.62,metalness:.06});
 const ink=new THREE.MeshStandardMaterial({name:'Late mechanism / moving physical reading needle',color:0x293f49,roughness:.55,metalness:.25});
 const group=new THREE.Group();group.name='Recessed live machine instrument';host.add(group);
 group.position.fromArray(mount?.position??[0,0,z]);if(mount?.quaternion)group.quaternion.copy(mount.quaternion);
 const faceMesh=k.geometry(new THREE.CylinderGeometry(radius,radius,s[2]*.018,24),face,[0,0,0],Q().setFromAxisAngle(V(1,0,0),Math.PI/2),{parent:group,batch:false,name:'Physical dial face'});
 const pointer=k.geometry(new THREE.BoxGeometry(radius*.10,radius*.78,s[2]*.014),ink,[0,radius*.31,s[2]*.018],Q(),{parent:group,batch:false,name:'Needle reading actual room mechanism'});
 for(let i=0;i<=8;i++){
  const a=-range/2+i*range/8;
  k.geometry(new THREE.BoxGeometry(radius*.08,radius*.16,s[2]*.012),ink,[Math.sin(a)*radius*.78,Math.cos(a)*radius*.78,s[2]*.016],Q().setFromAxisAngle(V(0,0,1),-a),{parent:group,batch:false,name:'Engraved physical scale'});
 }
 const update=()=>{const f=THREE.MathUtils.clamp((read()-min)/(max-min),0,1);pointer.rotation.z=range/2-range*f;pointer.position.x=-Math.sin(pointer.rotation.z)*radius*.31;pointer.position.y=Math.cos(pointer.rotation.z)*radius*.31;};
 k.renders.push(update);update();return {group,faceMesh,pointer};
}

/** A ground-aligned projected occupancy field marks only the real joint goal.
 * It is deliberately rectangular and flat, distinct from every portal and
 * from the castle's finale. The field creates no body, trigger or progress. */
function finishLateGoalField(level,stable){
 const position=level.goal?.position,parent=level.world?.root;
 if(!position||!parent)return null;
 const root=new THREE.Group();root.name='Late finish / true joint occupancy field';root.userData={visualOnly:true,keepMaterial:true};
 root.position.copy(position);root.position.y+=.028;parent.add(root);
 const shape=new THREE.Shape(),w=4.0,h=3.8,c=.42;
 [[-w/2+c,-h/2],[w/2-c,-h/2],[w/2,-h/2+c],[w/2,h/2-c],[w/2-c,h/2],[-w/2+c,h/2],[-w/2,h/2-c],[-w/2,-h/2+c]].forEach(([x,z],i)=>i?shape.lineTo(x,z):shape.moveTo(x,z));shape.closePath();
 const baseGeometry=new THREE.ShapeGeometry(shape);baseGeometry.rotateX(-Math.PI/2);
 const emphasized=stable===40||level.puzzleProgression===46;
 const baseMaterial=new THREE.MeshBasicMaterial({name:'Late finish / projected mineral occupancy field',color:emphasized?0x183239:0x31575a,transparent:true,opacity:emphasized?.86:.48,depthWrite:false,toneMapped:false});
 const base=new THREE.Mesh(baseGeometry,baseMaterial);base.name='Late finish / ground projection on actual finish';root.add(base);
 const geometry=new THREE.PlaneGeometry(1,1);geometry.rotateX(-Math.PI/2);
 const material=new THREE.MeshBasicMaterial({name:'Late finish / illuminated inset corner field',color:emphasized?0xe6be70:0xf4cf8a,transparent:true,opacity:emphasized?1:.84,depthWrite:false,toneMapped:false});
 const entries=[];
 for(const x of [-1,1])for(const z of [-1,1]){
  entries.push({p:[x*1.28,.006,z*1.65],s:[.84,1,.16]});
  entries.push({p:[x*1.78,.006,z*1.23],s:[.16,1,.96]});
 }
 // The short paired seams describe a shared docking zone without a new label
 // or a made-up completion indicator. Actual victory still uses goal.contains.
 for(const x of [-.72,.72])entries.push({p:[x,.006,0],s:[.18,1,.74]});
 const marks=new THREE.InstancedMesh(geometry,material,entries.length),matrix=new THREE.Matrix4();
 for(const [i,e]of entries.entries())marks.setMatrixAt(i,matrix.compose(V(...e.p),Q(),V(...e.s)));
 marks.instanceMatrix.needsUpdate=true;marks.computeBoundingBox();marks.computeBoundingSphere();marks.name='Late finish / broad inset occupancy corners';root.add(marks);
 const oldDispose=level.dispose;let disposed=false;
 level.dispose=function(...args){if(!disposed){disposed=true;root.removeFromParent();root.clear();marks.dispose();baseGeometry.dispose();geometry.dispose();baseMaterial.dispose();material.dispose();}return oldDispose?.apply(this,args);};
 return{root,position:position.toArray(),footprint:[w,h],extraColliders:0,extraLights:0,perFrameCallbacks:0};
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
  level.world.root.updateWorldMatrix(true,true);
  level.world.root.traverse(mesh=>{
   if(!mesh.userData?.pressureManifold)return;
   const h=mesh.geometry.parameters.height,world=mesh.parent.getWorldPosition(V()),right=world.z>30,source=world.z>10&&!right;
   const read=()=>right?level.pressure.right:source?level.pressure.difference:level.pressure.left;
   if(dialOnMesh(k,mesh,{read,min:source?-100:0,max:100,mount:{position:[0,-h*.44,0],quaternion:Q().setFromAxisAngle(V(1,0,0),Math.PI/2)}}))instruments++;
  });
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
 const finishField=stable===40||stable>=42?finishLateGoalField(level,stable):null;
 level.visualAuditLateGoal=finishField;level.visualAuditLateBound={...stats,instruments,perFrameReadings:instruments,finishField:finishField?{position:finishField.position,footprint:finishField.footprint}:null};return level;
}
