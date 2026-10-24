import * as THREE from 'three';
import {CASTLE_WING_FINISHES} from './LabCastleMaterials.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
function castleFollowerSync(root,followers){
 const inverse=new THREE.Matrix4(),relative=new THREE.Matrix4(),position=V(),quaternion=new THREE.Quaternion(),sourceScale=V(),unitScale=V(1,1,1);
 return ()=>{
  root.updateWorldMatrix(true,false);inverse.copy(root.matrixWorld).invert();
  for(const {target,mount}of followers){
   target.updateWorldMatrix(true,false);relative.multiplyMatrices(inverse,target.matrixWorld);
   // The target's scale stores its physical deck dimensions. The suspension is
   // already authored in metres and must follow only the target's rigid pose.
   relative.decompose(position,quaternion,sourceScale);mount.matrix.compose(position,quaternion,unitScale);mount.matrixWorldNeedsUpdate=true;
  }
 };
}
function vertexTint(geometry,color){
 const c=new THREE.Color(color),values=new Float32Array(geometry.attributes.position.count*3);
 for(let i=0;i<values.length;i+=3)values.set([c.r,c.g,c.b],i);
 geometry.setAttribute('color',new THREE.BufferAttribute(values,3));return geometry;
}

/** A single closed top, with broad engraved fields instead of a second decal
 * fighting the plate. The socket and traveller contact stay at their original
 * coordinates and retain their original tiny, nonblocking vertical envelope. */
export function castleDockingFaceGeometry({socket=false}={}){
 const positions=[],colors=[],uv=[],segments=64,radii=[0,.23,.285,.36,.405,.465];
 const palette=(socket?[0x779e94,0x2a4746,0xc6d4bb,0x314f49,0x99c3ae,0x273b3b]:[0xd8b56d,0x453e30,0xefd6a0,0x514631,0xc69d50,0x293a3b]).map(c=>new THREE.Color(c));
 function point(radius,angle,outer=false){const r=outer ? .5/Math.max(Math.abs(Math.cos(angle)),Math.abs(Math.sin(angle))) : radius;return [Math.cos(angle)*r,.5,Math.sin(angle)*r];}
 const triangle=(a,b,c,color)=>{for(const p of [a,b,c]){positions.push(...p);colors.push(color.r,color.g,color.b);uv.push(p[0]+.5,p[2]+.5);}};
 for(let band=0;band<radii.length;band++)for(let i=0;i<segments;i++){
  const a=i*Math.PI*2/segments,b=(i+1)*Math.PI*2/segments,outer=band===radii.length-1;
  const color=socket&&band===2&&Math.floor(i/8)%2?palette[1]:palette[band];
  const p=point(radii[band],a),q=point(radii[band],b),r=point(outer?0:radii[band+1],b,outer),s=point(outer?0:radii[band+1],a,outer);
  triangle(p,q,r,color);triangle(p,r,s,color);
 }
 const dark=palette.at(-1),corners=[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]];
 for(let i=0;i<4;i++){
  const a=corners[i],b=corners[(i+1)%4],c=[b[0],.5,b[2]],d=[a[0],.5,a[2]];
  triangle(a,c,b,dark);triangle(a,d,c,dark);
 }
 triangle(corners[0],corners[1],corners[2],dark);triangle(corners[0],corners[2],corners[3],dark);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.name='Castle crown / integral '+(socket?'cargo socket':'traveller contact')+' engraving';return geometry;
}

/** Closed radial machinery is mounted inside the solid rear wall's recessed
 * field. There is no door-sized hole, fictitious portal or walk-through prop. */
function crownReceiverGeometry(radius,depth){
 const parts=[],add=(g,c)=>{parts.push(vertexTint(g,c));};
 const disk=new THREE.CylinderGeometry(radius,radius,depth*.55,48);disk.rotateX(Math.PI/2);add(disk,0x263d42);
 for(const [r,tube,c]of [[radius*.94,radius*.045,0xa77e40],[radius*.77,radius*.025,0xd6b86c],[radius*.32,radius*.032,0xba9551]]){
  const g=new THREE.TorusGeometry(r,tube,6,48);g.scale(1,1,depth/(tube*2)*.65);g.translate(0,0,-depth*.08);add(g,c);
 }
 for(let i=0;i<12;i++){
  const a=i*Math.PI/6,c=Math.cos(a),s=Math.sin(a),g=new THREE.BoxGeometry(radius*.34,radius*.09,depth*.7);
  g.rotateZ(a+.30);g.translate(c*radius*.53,s*radius*.53,-depth*.12);add(g,i%3===0?0xc6a464:0x69817d);
 }
 const hub=new THREE.CylinderGeometry(radius*.23,radius*.23,depth*.90,12);hub.rotateX(Math.PI/2);hub.rotateZ(Math.PI/12);hub.translate(0,0,-depth*.03);add(hub,0xd1ad68);
 const geometry=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());geometry.computeBoundingBox();geometry.computeBoundingSphere();
 geometry.name='Castle crown / closed twelve-sector receiving iris';geometry.userData.architecturalBatch=true;return geometry;
}
function mergeParts(parts,groups=false){
 const inputs=parts.map(geometry=>geometry.index?geometry.toNonIndexed():geometry),merged=mergeGeometries(inputs,groups);
 inputs.forEach((geometry,i)=>{if(geometry!==parts[i])geometry.dispose();});return merged;
}

function closedInspectionPanel(width,height,depth,windows){
 const shape=new THREE.Shape();shape.moveTo(-width/2,-height/2);shape.lineTo(width/2,-height/2);
 shape.lineTo(width/2,height/2);shape.lineTo(-width/2,height/2);shape.closePath();
 const rings=[];
 for(const [x,y,r]of windows){
  const hole=new THREE.Path();hole.absarc(x,y,r,0,Math.PI*2,true);shape.holes.push(hole);
  const ring=new THREE.TorusGeometry(r,.045,6,64);ring.translate(x,y,.02);rings.push(ring);
 }
 const shell=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:32,steps:1});shell.translate(0,0,-depth/2);
 const metal=mergeParts([shell,...rings]);shell.dispose();rings.forEach(g=>g.dispose());
 const glass=new THREE.BoxGeometry(width,height,depth*.075);glass.translate(0,0,-depth*.4625);
 const geometry=mergeParts([metal,glass],true);metal.dispose();glass.dispose();
 geometry.scale(1/width,1/height,1/depth);geometry.computeBoundingBox();geometry.computeBoundingSphere();
 geometry.name='Castle flywheel / closed inspection fascia with three glazed windows';
 return geometry;
}

function mirrorCassette(width,height,depth){
 const outer=new THREE.Shape();outer.moveTo(-width/2,-height/2);outer.lineTo(width/2,-height/2);outer.lineTo(width/2,height/2);outer.lineTo(-width/2,height/2);outer.closePath();
 const inner=new THREE.Path(),w=width*.79,h=height*.81;inner.moveTo(-w/2,-h/2);inner.lineTo(-w/2,h/2);inner.lineTo(w/2,h/2);inner.lineTo(w/2,-h/2);inner.closePath();outer.holes.push(inner);
 const frame=new THREE.ExtrudeGeometry(outer,{depth,bevelEnabled:false,steps:1});frame.translate(0,0,-depth/2);
 const mirror=new THREE.BoxGeometry(w,h,depth*.18);mirror.translate(0,0,depth*.30);
 const back=new THREE.BoxGeometry(w,h,depth*.16);back.translate(0,0,-depth*.42);
 const shell=mergeParts([frame,back]),geometry=mergeParts([shell,mirror],true);
 for(const g of [frame,mirror,back,shell])g.dispose();
 geometry.scale(1/width,1/height,1/depth);geometry.computeBoundingBox();geometry.computeBoundingSphere();
 geometry.name='Castle optics / closed gimballed mirror cassette';return geometry;
}

export function castleLoadSectionGeometry(size,{rail=false}={}){
 const [x,y,z]=size;if(!size.every(n=>Number.isFinite(n)&&n>0))throw new RangeError('Positive structural section required');
 const parts=[],add=(p,s,tone)=>{const g=vertexTint(new THREE.BoxGeometry(...s),tone);g.translate(...p);parts.push(g);};
 if(rail){
  const flange=y*.22;
  for(const sign of [-1,1])add([0,sign*(y-flange)/2,0],[x,flange,z],0xc3b08c);
  add([0,0,0],[x,y-2*flange,z*.24],0x3c5157);
 }else{
  const flange=z*.23;
  for(const sign of [-1,1])add([0,0,sign*(z-flange)/2],[x,y,flange],0x9aada8);
  add([0,0,0],[x*.30,y,z-2*flange],0x344b55);
 }
 const geometry=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());geometry.scale(1/x,1/y,1/z);
 geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.parameters={width:1,height:1,depth:1};
 geometry.name='Castle / actual '+(rail?'overhead rail section':'flanged load-bearing section');geometry.userData.architecturalBatch=true;return geometry;
}

export function castleCarriageDeckGeometry(size){
 const [x,y,z]=size,parts=[],add=(p,s,color)=>{const g=vertexTint(new THREE.BoxGeometry(...s),color);g.translate(...p);parts.push(g);};
 const top=Math.min(.09,y*.24),rim=Math.min(.34,x*.12,z*.12),under=y-top;
 add([0,(y-top)/2,0],[x,top,z],0xd8dfd3);
 for(const sign of [-1,1]){
  add([sign*(x-rim)/2,-top/2,0],[rim,under,z],0x3b535d);
  add([0,-top/2,sign*(z-rim)/2],[x-2*rim,under,rim],0x567b83);
 }
 add([0,-y/2+under*.31,0],[x-2*rim,under*.62,z-2*rim],0x263e48);
 const geometry=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());geometry.scale(1/x,1/y,1/z);
 geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.name='Castle carriage / closed walking deck and captive underframe';return geometry;
}

/** A closed casing with inset fields on both sides. Bounds and mesh identity
 * stay exact: physical cells keep their original contact/ray object and no
 * child can enlarge Box3.setFromObject during the cell's pose sync. */
export function castleMachineCasingGeometry(size,{axis='z',bays=1,sculpt=false}={}){
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
  face(...field,sculpt&&!flatTop ? .86 : 1);
  const fw=b-a-2*rim,fh=height-2*rim;
  if(sculpt&&axis!=='y'&&fw>1.8&&fh>3.2){
   // Broad pressed ribs and a sealed service bay emerge from the closed
   // recessed field. Their outer faces stay below the original frame plane;
   // there are no coplanar overlay skins or unrelated walk-through props.
   const back=r,front=r+sign*recess*.78;
   const raised=(cx,cy,w,h,tone)=>{
    const a=cx-w/2,b=cx+w/2,c=cy-h/2,d=cy+h/2;
    face([a,c,front],[b,c,front],[b,d,front],[a,d,front],tone);
    face([a,c,back],[a,c,front],[a,d,front],[a,d,back],tone*.52);
    face([b,c,front],[b,c,back],[b,d,back],[b,d,front],tone*.64);
    face([a,c,back],[b,c,back],[b,c,front],[a,c,front],tone*.60);
    face([a,d,front],[b,d,front],[b,d,back],[a,d,back],tone*.90);
   };
   for(const side of [-1,1])raised((a+b)/2+side*fw*.28,0,Math.min(.62,fw*.14),fh*.84,1.17);
   raised((a+b)/2,-fh*.22,fw*.32,Math.min(1.35,fh*.22),.52);
  }
 }
 const geometry=new THREE.BufferGeometry();geometry.name='Castle / closed folded equipment casing';
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
 geometry.parameters={width:1,height:1,depth:1};geometry.userData.architecturalBatch=true;return geometry;
}

/** Existing equipment and the actual floor union retain their envelopes.
 * The real optical source gains one founded projector behind its ray origin,
 * with matching box/cylinder contact. No portal, light or floor is added. */
export function buildCastleAuditConstruction({game,k,rooms,machines,edges}){
 if(k.root.userData.castleVisualAudit)return k.root.userData.castleVisualAudit;
 const source=[...k.meshes],initialColliders=k.colliders.length,materials=new Map(),counts=new Map([...rooms.keys()].map(id=>[id,0])),followers=[];
 const counters={casings:0,structuralMembers:0,tankShells:0,bearingBodies:0,coilWindings:0,hydraulicGauges:0,flywheelInspectionWindows:0,opticalMirrorCassettes:0,opticalProjectors:0,instrumentCases:0,inlays:0,finaleMeshes:0,carriageChassis:0,carriageSuspensions:0};
 let projector=null,windingMaterial=null,tankMaterial=null;
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
  const size=mesh.scale.toArray().map(Math.abs),[x,y,z]=size,axis=y>2.5?(x<z?'x':'z'):['x','y','z'][size.indexOf(Math.min(...size))];
  if(structural?!(y>5&&Math.max(x,z)<1.4):!(Math.max(x,y,z)>3&&size.filter(v=>v>1.25).length>=2))return;
  mesh.geometry=k.geo(structural?castleLoadSectionGeometry(size):castleMachineCasingGeometry(size,{axis,bays:Math.min(4,Math.max(1,Math.floor((axis==='x'?z:x)/5))),sculpt:true}));
  mesh.material=finish(mesh.material,room.def.id,structural?'structure':'casing',mesh.geometry);mesh.userData.castleAuditCasing=true;
  counts.set(room.def.id,counts.get(room.def.id)+1);counters[structural?'structuralMembers':'casings']++;
 }
 const migrant=rooms.get('migrant');
 if(migrant){
  const platform=source.find(mesh=>mesh.userData.floor&&mesh.userData.collider?.kinematic&&roomFor(mesh)?.def.id==='migrant'&&
   Math.abs(mesh.scale.x-6)<.01&&Math.abs(mesh.scale.y-.4)<.01&&Math.abs(mesh.scale.z-8)<.01);
  const rail=source.find(mesh=>!mesh.userData.collider&&Math.abs(mesh.scale.x-30)<.01&&Math.abs(mesh.scale.y-.4)<.01&&Math.abs(mesh.scale.z-.5)<.01&&
   Math.abs(mesh.position.x-migrant.def.at[0])<.01&&Math.abs(mesh.position.z-migrant.def.at[2])<.01&&Math.abs(mesh.position.y-migrant.def.at[1]-10)<.01);
  if(platform&&rail){
   const alloy=k.mat(0xffffff,.61,.34);alloy.name='Castle machinery / carriage porcelain and captive graphite chassis';alloy.vertexColors=true;
   platform.geometry=k.geo(castleCarriageDeckGeometry(platform.scale.toArray()));platform.material=alloy;platform.userData.castleCarriageChassis=true;
   rail.geometry=k.geo(castleLoadSectionGeometry(rail.scale.toArray(),{rail:true}));rail.material=alloy;rail.name='Castle carriage / actual formed overhead running rail';
   const mount=new THREE.Group();mount.name='Castle carriage / source-pose suspension and captive bogies';mount.userData.visualOnly=true;mount.matrixAutoUpdate=false;k.root.add(mount);
   const wireParts=[],bogieParts=[],height=rail.position.y-platform.position.y;
   for(const x of [-2.65,2.65]){
    for(const side of [-1,1]){
     const a=V(x,.20,side*3.55),b=V(x,height-.20,0),delta=b.clone().sub(a),g=new THREE.CylinderGeometry(.035,.035,delta.length(),6);
     g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0,1,0),delta.normalize()));g.translate(...a.add(b).multiplyScalar(.5).toArray());wireParts.push(vertexTint(g,0x4b6267));counters.carriageSuspensions++;
    }
    const wheel=new THREE.CylinderGeometry(.103,.103,.12,16);wheel.rotateX(Math.PI/2);wheel.translate(x,height,.15);bogieParts.push(vertexTint(wheel,0x344b51));
    const pin=new THREE.CylinderGeometry(.032,.032,.13,12);pin.rotateX(Math.PI/2);pin.translate(x,height,.155);bogieParts.push(vertexTint(pin,0xc9aa6a));
   }
   for(const [parts,name]of [[wireParts,'thin suspension legs to the real rail'],[bogieParts,'captive wheels inside the actual rail section']]){
    const geometry=k.geo(mergeGeometries(parts,false));parts.forEach(g=>g.dispose());const mesh=new THREE.Mesh(geometry,alloy);
    mesh.name='Castle carriage / '+name;mesh.userData.visualOnly=true;mesh.receiveShadow=true;mount.add(mesh);
   }
   followers.push({target:platform,mount});castleFollowerSync(k.root,followers)();counters.carriageChassis++;
  }
 }
 for(const mesh of source){
  const r=roomFor(mesh);if(!r)continue;
  const wall=/^Castle wing wall \/ /.test(mesh.material?.name??''),perimeter=wall&&
   [Math.abs(mesh.position.x-r.b.x0),Math.abs(mesh.position.x-r.b.x1),Math.abs(mesh.position.z-r.b.z0),Math.abs(mesh.position.z-r.b.z1)].some(d=>d<.8);
  // Wing material names are also assigned to internal machine partitions.
  // Preserve the actual perimeter's architectural skin, not every object
  // carrying its palette. The ten large internal panels need both sides too.
  if(!perimeter&&!/Portal address|Castle fixed glazed|castle cast-in floor/i.test(mesh.material?.name??'')){casing(mesh,r);casing(mesh,r,true);}
  if(r.def.id==='sluice'&&mesh.geometry.type==='CylinderGeometry'&&Math.abs(mesh.scale.x-3)<.01&&[3,7,10].includes(mesh.scale.y)){
   const points=[[0,-.5],[.68,-.5],[.93,-.47],[1,-.45],[1,-.40],[.94,-.37],[.94,-.31],[.94,-.27],[.94,.22],[.94,.28],[.94,.32],
    [1,.35],[1,.40],[.94,.43],[.72,.48],[.42,.5],[0,.5]].map(([x,y])=>new THREE.Vector2(x,y));
   mesh.geometry=k.geo(new THREE.LatheGeometry(points,24));mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
   const p=mesh.geometry.attributes.position,colors=new Float32Array(p.count*3);
   for(let i=0;i<p.count;i++){
    const y=p.getY(i),color=new THREE.Color(y<-.36||y>.42?0xa6b6a9:y<-.30||y>.31?0x304a4b:y>.23?0xb59b68:0x789c8e);
    colors.set([color.r,color.g,color.b],i*3);
   }
   mesh.geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
   tankMaterial??=k.mat(0xffffff,.62,.27);tankMaterial.vertexColors=true;tankMaterial.name='Castle hydraulics / enamel barrel and dark pressure collars';mesh.material=tankMaterial;
   mesh.geometry.name='Castle tank / rolled barrel, base flange and shouldered head';counters.tankShells++;counts.set('sluice',counts.get('sluice')+1);
  }
  if(r.def.id==='sluice'&&!mesh.userData.collider&&mesh.material===k.m.cyan&&Math.abs(mesh.scale.x-3.8)<.01&&Math.abs(mesh.scale.z-.10)<.01){
   const x=mesh.position.x-r.def.at[0],capacity=[10,7,3][Math.round((x+14)/14)];
   if(capacity){
    // Keep the actual fill mesh, its vertical scaling and its update callback.
    // Only its width changes: a calibrated sight glass replaces the blue board.
    mesh.geometry=k.geo(new THREE.BoxGeometry(.22,1,1));mesh.name='Castle hydraulics / actual volume sight glass';
    const centreZ=mesh.position.z;
    for(const side of [-1,1]){
     const bar=k.decor([mesh.position.x+side*.49,r.def.at[1]+capacity/2+.1,centreZ],[.12,capacity+.22,.08],k.m.dark);
     bar.name='Castle hydraulics / sight-glass channel';
    }
    for(const y of [r.def.at[1]+.045,r.def.at[1]+capacity+.155]){
     const cap=k.decor([mesh.position.x,y,centreZ],[1.1,.11,.08],k.m.copper);cap.name='Castle hydraulics / sight-glass end union';
    }
    counters.hydraulicGauges++;
   }
  }
  if(r.def.id==='flywheel'&&mesh.name==='41 founded flywheel guard'&&mesh.material.transparent&&Math.abs(mesh.scale.x-25)<.01&&Math.abs(mesh.scale.y-8)<.01){
   const metal=k.mat(0x365060,.67,.30),glass=k.mat(0x9fc7ce,.55,.06);metal.name='Castle flywheel / founded inspection cabinet';
   glass.name='Castle flywheel / real safety glass';glass.transparent=true;glass.opacity=.16;glass.depthWrite=false;
   mesh.geometry=k.geo(closedInspectionPanel(25,8,.16,[[-7.5,0,3.67],[.5,0,2.48],[7.5,0,3.08]]));
   mesh.material=[metal,glass];mesh.userData.castleInspectionCabinet=true;counters.flywheelInspectionWindows+=3;counts.set('flywheel',counts.get('flywheel')+1);
  }
  if(r.def.id==='optics'&&mesh.userData.collider&&mesh.userData.collider.ignorePropagation&&Math.abs(mesh.scale.x-2.8)<.01&&Math.abs(mesh.scale.y-3.1)<.01){
   const metal=k.mat(0x47718a,.60,.35),mirror=k.mat(0xb6d2d8,.24,.86);metal.name='Castle optics / reflector gimbal housing';mirror.name='Castle optics / actual moving reflector';
   mesh.geometry=k.geo(mirrorCassette(2.8,3.1,.12));mesh.material=[metal,mirror];mesh.userData.castleMirrorCassette=true;
   counters.opticalMirrorCassettes++;counts.set('optics',counts.get('optics')+1);
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
   // The original solid-colour torus hid the complete winding. A dark core
   // and an exposed copper helix now share the old .24m tube envelope.
   mesh.geometry=k.geo(new THREE.TorusGeometry(radius,.15,8,40,arc));mesh.material=k.m.dark;
   for(let i=0;i<=216;i++){
    const t=i/216,angle=.025+t*(arc-.05),phase=t*Math.PI*2*turns,radial=radius+.19*Math.cos(phase);
    points.push(V(radial*Math.cos(angle),radial*Math.sin(angle),.19*Math.sin(phase)));
   }
   const geometry=k.geo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),216,.045,5,false));
   windingMaterial??=k.mat(0xc88b4d,.56,.42);windingMaterial.name='Castle magnet / exposed copper winding';
   const winding=k.mesh(geometry,windingMaterial,mesh.position.toArray());winding.quaternion.copy(mesh.quaternion);
   winding.name='Castle magnet / visible eighteen-turn winding';winding.userData.visualOnly=true;
   winding.userData.castleCoilEnvelope={radius,tube:.24,arc};mesh.userData.castleCoilCore={radius,tube:.15,arc};
   counters.coilWindings++;counts.set(r.def.id,counts.get(r.def.id)+1);
  }
 }
 const optics=rooms.get('optics');
 if(optics&&machines.get('optics')?.state.intake){
  const {P}=optics,body=k.box(P(-27.4,-5,1.8),[2.2,3.6,2.4],k.m.steel);
  body.name='Castle optics / founded beam projector';body.geometry=k.geo(castleMachineCasingGeometry([2.2,3.6,2.4],{axis:'x',bays:1}));
  body.material=finish(k.m.steel,'optics','casing',body.geometry);body.userData.castleAuditCasing=true;
  const barrel=k.drum(P(-26.17,-5,2.4),.72,.32,k.m.dark);barrel.quaternion.setFromUnitVectors(V(0,1,0),V(1,0,0));
  barrel.name='Castle optics / physical projector lens barrel';k.sync(barrel,0,true);
  const bronze=k.mat(0xc49a60,.57,.36),lensMaterial=k.mat(0x73d8e6,.33,.22,0x165b67);
  bronze.name='Castle optics / projector focusing collar';lensMaterial.name='Castle optics / beam source lens';
  const collar=k.mesh(k.geo(new THREE.TorusGeometry(.65,.055,6,40)),bronze,P(-26.15,-5,2.4));collar.rotation.y=Math.PI/2;
  collar.name='Castle optics / focusing collar inside barrel';
  const lens=k.mesh(k.geo(new THREE.CylinderGeometry(1,1,1,32)),lensMaterial,P(-26.025,-5,2.4),[.56,.02,.56]);
  lens.quaternion.copy(barrel.quaternion);lens.name='Castle optics / lens behind actual ray origin';
  for(let i=0;i<5;i++){
   const fin=k.decor(P(-27.55,-3.82,2.0+i*.22),[1.1,.055,.035],k.m.dark);fin.name='Castle optics / integral cooling louvre';
  }
  body.geometry.computeBoundingBox();body.updateWorldMatrix(true,false);k.sync(body,0,true);
  projector={source:P(-26,-5,2.4),normal:[1,0,0],bodyId:body.uuid,bodyBounds:[...body.userData.collider.box.min.toArray(),...body.userData.collider.box.max.toArray()],
   barrelId:barrel.uuid,barrelColliderIds:barrel.userData.compound.parts.map(p=>p.proxy.uuid),frontLocalX:-26.01};
  counters.opticalProjectors++;counts.set('optics',counts.get('optics')+1);
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
 // The final receiver is backed by a real closed wall. Its radial mechanism
 // and two engraved docking contacts read as one installation, not a pink
 // square underneath an unrelated floating doorway.
 const crown=rooms.get('crown'),contact=machines.get('crown')?.state.contact,socket=machines.get('crown')?.state.socket;
 if(crown&&contact&&socket){
  const rear=source.find(mesh=>mesh.userData.collider&&!mesh.userData.collider.kinematic&&mesh.material?.name==='Castle wing wall / crown'&&
   mesh.scale.z<.8&&Math.abs(mesh.position.z-crown.b.z1)<.8&&mesh.scale.x>20);
  const energy=k.mat(0xf0c676,1,0,0,true);energy.name='Castle finale / warm docking illumination';energy.transparent=true;energy.opacity=.58;
  energy.depthWrite=false;energy.side=THREE.DoubleSide;energy.toneMapped=false;
  const socketEnergy=energy.clone();socketEnergy.color.setHex(0x89c9b4);socketEnergy.name='Castle finale / companion docking illumination';k.materials.add(socketEnergy);
  const wallZ=rear?rear.position.z-rear.scale.z/2-.025:crown.b.z1-.275,receiverY=contact[1]+3.4;
  if(rear){
   const material=k.mat(0xffffff,.56,.49);material.vertexColors=true;material.name='Castle crown / bronze and graphite receiving mechanism';
   const iris=k.mesh(k.geo(crownReceiverGeometry(2.8,.10)),material,[contact[0],receiverY,rear.position.z-rear.scale.z/2+.077]);
   iris.name='Castle crown / twelve-sector receiver founded in rear wall';iris.userData.visualOnly=true;
   iris.userData.wallBacking=rear.uuid;rear.userData.castleFinaleBackdrop=true;
   // Subsequent wall dressing must leave the actual receiver visible, just
   // as it already reserves a portal address or an instrument face.
   k.root.userData.castleReservedFaces??=[];
   k.root.userData.castleReservedFaces.push({id:'crown-closed-receiver',center:[contact[0],receiverY,rear.position.z-rear.scale.z/2],normal:[0,0,-1],right:[1,0,0],up:[0,1,0],halfWidth:2.8,halfHeight:2.8});
   iris.updateWorldMatrix(true,false);const bounds=new THREE.Box3().setFromObject(iris);
   if(!rear.userData.collider.box.clone().expandByScalar(1e-4).containsBox(bounds))throw new Error('Final receiver escaped its closed physical wall');
  }
  for(const [radius,phase]of [[2.58,0],[2.06,Math.PI/6],[.78,Math.PI/12]]){
   const pieces=[];
   for(let i=0;i<6;i++)pieces.push(new THREE.RingGeometry(radius-.045,radius,16,1,phase+i*Math.PI/3+.065,Math.PI/3-.13));
   const geometry=k.geo(mergeGeometries(pieces,false));pieces.forEach(g=>g.dispose());
   const mesh=k.mesh(geometry,energy,[contact[0],receiverY,wallZ]);
   mesh.name='Castle finale / wall-receiver segmented light scale';mesh.userData.visualOnly=true;counters.finaleMeshes++;
  }
  const beam=k.geo(new THREE.CylinderGeometry(.035,.065,.45,8)),plateMaterial=k.mat(0xffffff,.63,.35);plateMaterial.vertexColors=true;plateMaterial.name='Castle crown / integral engraved docking plates';
  for(const p of [contact,socket]){
   const isSocket=p===socket,light=isSocket?socketEnergy:energy;
   const physicalSocket=machines.get('crown')?.state.receiverMesh;
   if(physicalSocket){
    // The new load tray owns its real top face. Cut its socket engraving
    // into that same closed envelope instead of hovering a legacy halo and
    // two field posts above the original body's actual support contact.
    if(isSocket){physicalSocket.geometry=k.geo(castleDockingFaceGeometry({socket:true}));physicalSocket.material=plateMaterial;physicalSocket.name='Castle crown / physical engraved original-load tray';}
    continue;
   }
   const plate=source.find(mesh=>Math.abs(mesh.position.x-p[0])<.01&&Math.abs(mesh.position.y-p[1]-.065)<.01&&Math.abs(mesh.position.z-p[2])<.01&&Math.abs(mesh.scale.y-.035)<.002);
   if(plate){plate.geometry=k.geo(castleDockingFaceGeometry({socket:isSocket}));plate.material=plateMaterial;plate.name='Castle crown / '+(isSocket?'companion socket':'traveller contact')+' engraved face';}
   const ring=k.mesh(k.geo(new THREE.TorusGeometry(isSocket?1.41:1.12,.035,6,48)),light,[p[0],p[1]+.092,p[2]]);
   ring.rotation.x=-Math.PI/2;ring.name='Castle finale / independent docking halo';ring.userData.visualOnly=true;counters.finaleMeshes++;
   for(const side of [-1,1]){
    const mesh=k.mesh(beam,light,[p[0]+side*(isSocket?1.55:1.25),p[1]+.30,p[2]]);
    mesh.name='Castle finale / low docking field marker';mesh.userData.visualOnly=true;counters.finaleMeshes++;
   }
  }
 }
 k.root.userData.castleVisualFollowers=followers;
 const result=Object.freeze({revision:67,...counters,projector,sharedEquipmentFinishes:materials.size,sections:Object.freeze(Object.fromEntries(counts)),extraColliders:k.colliders.length-initialColliders,extraLights:0,perFrameCallbacks:followers.length?1:0});
 k.root.userData.castleVisualAudit=result;return result;
}

export function finishVisualAuditCastle(game,level,index,roots){
 if(!level?.tower||!level.singularity)return level;
 level.visualAuditCastle=level.structure?.userData.castleVisualAudit??null;
 const followers=level.structure?.userData.castleVisualFollowers??[];
 if(followers.length&&!level.castleFollowerClock){
  const syncPose=castleFollowerSync(level.structure,followers),oldRender=level.renderUpdate,oldReset=level.reset,oldDispose=level.dispose;let disposed=false;
  const sync=()=>{if(!disposed)syncPose();};
  level.renderUpdate=function(...args){const result=oldRender?.apply(this,args);sync();return result;};
  level.reset=function(...args){const result=oldReset?.apply(this,args);sync();return result;};
  level.dispose=function(...args){if(disposed)return;disposed=true;return oldDispose?.apply(this,args);};
  level.castleFollowerClock={sync,followers:followers.length};sync();
 }
 return level;
}
