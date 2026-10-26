import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const V=(...a)=>new THREE.Vector3(...a),Q=()=>new THREE.Quaternion();
export const MIDDLE_AUDIT_REVISION='v67-readably-built-middle-machines';
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
 const geometry={box:new RoundedBoxGeometry(1,1,1,1,.025),riser:new THREE.BoxGeometry(1,1,1),plate:new THREE.BoxGeometry(1,1,1),cylinder:new THREE.CylinderGeometry(1,1,1,24),wheel:new THREE.TorusGeometry(.84,.16,8,32),
  // Room33's inner hydraulic hardware already sits inside later authored
  // physical sleeves. Preserve that drawing; expose the bearing covers only
  // on Room34's visible reservoir and manifold, without adding hidden detail.
  turned:new THREE.LatheGeometry((number===34?
   [[0,-.455],[.75,-.455],[.87,-.5],[.94,-.46],[1,-.40],[1,-.31],[.84,-.27],[.84,.27],[1,.31],[1,.40],[.94,.46],[.87,.5],[.75,.455],[0,.455]]:
   [[0,-.5],[.87,-.5],[.94,-.46],[1,-.40],[1,-.31],[.84,-.27],[.84,.27],[1,.31],[1,.40],[.94,.46],[.87,.5],[0,.5]]).map(p=>new THREE.Vector2(...p)),32)};
 const materials={paint:new THREE.MeshStandardMaterial({name:'Audit satin machine enamel',color:0xffffff,roughness:.64,metalness:.19}),
  metal:new THREE.MeshStandardMaterial({name:'Audit brushed machine alloy',color:0xffffff,roughness:.43,metalness:.68}),
  deck:new THREE.MeshStandardMaterial({name:'Launch closed plate / distance-filtered seams',color:0xffffff,roughness:.80,metalness:.025})};
 materials.deck.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 vPlateWorld;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
   vec4 platePosition=vec4(transformed,1.0);
   #ifdef USE_INSTANCING
    platePosition=instanceMatrix*platePosition;
   #endif
   vPlateWorld=(modelMatrix*platePosition).xyz;`);
  shader.fragmentShader='varying vec3 vPlateWorld;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   vec3 plateNormal=abs(cross(dFdx(vPlateWorld),dFdy(vPlateWorld)));
   vec2 plateCoord=plateNormal.y>plateNormal.x&&plateNormal.y>plateNormal.z?vPlateWorld.xz:plateNormal.x>plateNormal.z?vPlateWorld.zy:vPlateWorld.xy;
   vec2 plateCell=plateCoord/6.5;
   vec2 plateAA=max(fwidth(plateCell),vec2(.00001));
   vec2 plateEdge=abs(fract(plateCell+.5)-.5);
   vec2 plateSeam=1.0-smoothstep(vec2(.002)-plateAA,vec2(.002)+plateAA,plateEdge);
   float plateFade=1.0-smoothstep(.018,.075,max(plateAA.x,plateAA.y));
   diffuseColor.rgb*=1.0-.13*max(plateSeam.x,plateSeam.y)*plateFade;`);
 };
 materials.deck.customProgramCacheKey=()=> 'launch-closed-aa-plate-v1';
 const mounts=[],banks=new Map(),restores=[],ownedMaterials=[],extras=[],cleanup=[];
 const meshes=[];k.world.root.traverse(m=>{if(m.isMesh&&!m.isInstancedMesh&&!m.userData?.collisionProxy&&!m.userData?.portalable&&!m.userData?.portalTile)meshes.push(m);});
 const boxMeshes=()=>meshes.filter(m=>{const p=m.geometry?.parameters;return p&&[p.width,p.height,p.depth].every(Number.isFinite)&&p.width>0&&p.height>0&&p.depth>0;});
 const visible=m=>m&&m.visible!==false&&(Array.isArray(m.material)?m.material.some(a=>a.visible!==false):m.material?.visible!==false);
 const named=name=>meshes.find(m=>m.name===name);
 const at=(p,size)=>boxMeshes().find(m=>m.position.distanceTo(V(...p))<.015&&V(m.geometry.parameters.width,m.geometry.parameters.height,m.geometry.parameters.depth).distanceTo(V(...size))<.015);
 const stats={revision:MIDDLE_AUDIT_REVISION,number,mounts:[],parts:0,batches:0,extraColliders:0,extraLights:0,independentClocks:0};
 function owner(target,name,{physicalSurface=false}={}){
  if((!visible(target)&&!(physicalSurface&&target?.userData?.collisionProxy))||mounts.some(a=>a.target===target))return null;
  target.geometry.computeBoundingBox();const bounds=target.geometry.boundingBox.clone();
  const m={target,name,bounds,parts:[],cylindrical:target.geometry.type==='CylinderGeometry'};
  const original=target.material,clones=[];
  const hide=mat=>{const copy=mat.clone();copy.visible=false;copy.userData={...copy.userData,middleAuditOwner:root.uuid};clones.push(copy);ownedMaterials.push(copy);return copy;};
  // A registered hidden surface proxy already has no visible skin. Its
  // canonical material is part of portal ownership and must stay untouched.
  if(!physicalSurface)target.material=Array.isArray(original)?original.map(hide):hide(original);
  // ResearchChamber's pending static bins are keyed by the old material.
  // Keep this hidden owner out of that bake; otherwise flush would revive a
  // plain original shell around the recessed replacement and occlude it.
  for(const list of k.artBins?.values?.()||[]){const i=list.indexOf(target);if(i>=0)list.splice(i,1);}
  if(!physicalSurface)restores.push({target,original,replacement:target.material});mounts.push(m);stats.mounts.push(name);return m;
 }
 function part(o,p,size,color=COLORS.paint,{kind='box',metal=false,material,q=Q()}={}){
  if(!o)return;
  const matrix=new THREE.Matrix4().compose(V(...p),q,V(...size)),g=geometry[kind];g.computeBoundingBox();
  const bounds=g.boundingBox.clone().applyMatrix4(matrix);
  if(!o.bounds.clone().expandByScalar(.0001).containsBox(bounds))throw new Error(`Audit ${number}: ${o.name} trim escaped its original box`);
  if(o.cylindrical){
   const r=o.target.geometry.parameters.radiusTop,h=o.target.geometry.parameters.height,point=V(),vertices=g.attributes.position;
   for(let n=0;n<vertices.count;n++){point.fromBufferAttribute(vertices,n).applyMatrix4(matrix);if(Math.hypot(point.x,point.z)>r+.0001||Math.abs(point.y)>h/2+.0001)throw new Error(`Audit ${number}: ${o.name} trim escaped its original cylinder`);}
  }
  const key=kind+':'+(material||(metal?'metal':'paint')),row={owner:o,matrix,bounds,color};
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
   // Room34's ribs cross the .84r barrel skin with positive embed. The former
   // .79r centres hid the entire rib inside the barrel. The recessed end
   // faces likewise leave the existing dark bearing covers visible, still
   // below the unchanged end rims and within the original pressure volume.
   const ribRadius=r*(number===34?.86:.79);
   part(o,[Math.cos(a)*ribRadius,0,Math.sin(a)*ribRadius],[r*.075,h*.52,r*.075],COLORS.copper,{metal:true,q:Q().setFromAxisAngle(V(0,1,0),-a)});
  }
  return o;
 }
 function cabinet(target,name,{paint=COLORS.paint}={}){
  const o=owner(target,name);if(!o)return;
  const s=o.bounds.getSize(V()),c=o.bounds.getCenter(V()),b=(p,size,color=paint,metal=false)=>part(o,c.clone().add(V(...p)).toArray(),size,color,{metal});
  // Closed source-bound shell with shallow formed doors on all four sides.
  // Relief is centimetres deep, so the full physical cabinet never appears
  // to contain a metre-deep cavity that the player cannot enter.
  b([0,0,0],[s.x-.10,s.y-.10,s.z-.10],COLORS.dark);
  b([0,s.y/2-.055,0],[s.x-.045,.065,s.z-.045],COLORS.metal,true);
  b([0,-s.y/2+.13,0],[s.x-.04,.22,s.z-.04],COLORS.dark);
  for(const sign of [-1,1]){
   const count=Math.max(2,Math.min(4,Math.ceil(s.x/4))),bay=(s.x-.22)/count;
   for(let i=0;i<count;i++){
    const x=(i-(count-1)/2)*bay,z=sign*(s.z/2-.052);
    b([x,0,z],[bay-.075,s.y-.40,.075],paint);
    b([x,0,sign*(s.z/2-.009)],[Math.min(.10,bay*.08),Math.min(.68,s.y*.15),.014],COLORS.copper,true);
    for(const y of [-1,1])b([x,y*(s.y/2-.43),sign*(s.z/2-.008)],[bay-.27,.07,.012],COLORS.metal,true);
   }
   const sideCount=Math.max(2,Math.min(3,Math.ceil(s.z/3))),span=(s.z-.24)/sideCount;
   for(let i=0;i<sideCount;i++){
    const z=(i-(sideCount-1)/2)*span;
    b([sign*(s.x/2-.052),0,z],[.075,s.y-.42,span-.075],paint);
    b([sign*(s.x/2-.009),s.y*.22,z],[.014,Math.min(.48,s.y*.12),span*.72],COLORS.dark);
    for(let n=0;n<4;n++)b([sign*(s.x/2-.004),s.y*.22,z+(n-1.5)*span*.16],[.006,Math.min(.32,s.y*.08),.035],COLORS.metal,true);
   }
  }
  stats.cabinets=(stats.cabinets||0)+1;return o;
 }
 /** The large sight baffles were still plain cream sheets after the first
  * pass. Their actual CLOSED collision box now supplies the complete outer
  * silhouette, deep perimeter, coloured structural skirt and wide enamel
  * bays on BOTH sides. No trim projects into an aperture or walking lane. */
 function bulkhead(target,name,{paint=COLORS.paint,accent=COLORS.copper,axis,theme='service'}={}){
  const o=owner(target,name);if(!o)return;
  const s=o.bounds.getSize(V()),c=o.bounds.getCenter(V());axis??=(s.x<s.z?0:2);
  const n=axis===0?V(1,0,0):V(0,0,1),right=axis===0?V(0,0,-1):V(1,0,0),up=V(0,1,0);
  const q=Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,n));
  const w=Math.abs(s.dot(right))*.996,h=s.y*.996,d=Math.abs(s.dot(n))*.996;
  const rim=Math.min(.28,w*.065,h*.055),skin=d*.075,face=d*.462;
  const b=(x,y,z,a,b,e,col=paint,metal=false)=>part(o,c.clone().addScaledVector(right,x).addScaledVector(up,y).addScaledVector(n,z).toArray(),[a,b,e],col,{q,metal});
  // Closed core: dark panel seams are shallow recesses backed by solid metal.
  b(0,0,0,w,h,d*.78,COLORS.dark);
  const bays=Math.max(1,Math.min(7,Math.ceil(w/5.7))),rows=Math.max(1,Math.min(3,Math.ceil(h/9))),bw=(w-rim*2)/bays,rh=(h-rim*2)/rows;
  for(const sign of [-1,1]){
   for(const x of [-1,1])b(x*(w-rim)/2,0,sign*face,rim,h,skin,COLORS.metal,true);
   for(const y of [-1,1])b(0,y*(h-rim)/2,sign*face,w-rim*2,rim,skin,COLORS.dark);
   for(let i=0;i<bays;i++)for(let j=0;j<rows;j++){
    const x=-w/2+rim+bw*(i+.5),y=-h/2+rim+rh*(j+.5),gap=Math.min(.105,bw*.04,rh*.04);
    const color=new THREE.Color(paint).multiplyScalar(theme==='garden'&&j===rows-1?.86:j%2===0?1:.93).getHex();
    b(x,y,sign*d*.422,bw-gap,rh-gap,skin,color);
    // Broad lower service bands, rather than a repetitive bolt texture.
    // The bottom row already has the broad continuous skirt below. A
    // second band there shared the same exterior z-plane over part of its
    // height; retain only one visible face instead of masking the overlap.
    if(j>0)b(x,y-rh*.30,sign*face,bw*.83,Math.min(.30,rh*.085),skin,COLORS.dark);
    if(theme==='garden'){
     b(x,y+rh*.37,sign*face,bw*.74,Math.min(.21,rh*.06),skin,accent,true);
     for(const edge of [-1,1])b(x+edge*bw*.31,y+rh*.07,sign*face,Math.min(.12,bw*.05),rh*.44,skin,COLORS.dark);
    }else{
     const at=x+(i%2?-.27:.27)*bw;
     b(at,y+rh*.03,sign*face,Math.min(.16,bw*.055),rh*.42,skin,COLORS.dark);
     b(x,y+rh*.32,sign*face,bw*.70,Math.min(.12,rh*.045),skin,accent,true);
    }
   }
   // A wide founded skirt helps a 20 m partition read as architecture rather
   // than an enormous untextured cupboard suspended over the puzzle.
   b(0,-h/2+rim+Math.min(.68,h*.075),sign*face,w-rim*2,Math.min(1.1,h*.11),skin,COLORS.dark);
  }
  const keep=target.userData.keepMaterial;target.userData.keepMaterial=true;
  cleanup.push(()=>{if(keep===undefined)delete target.userData.keepMaterial;else target.userData.keepMaterial=keep;});
  stats.largeBulkheads=(stats.largeBulkheads||0)+1;return o;
 }
 /** Retain the real readout and its update callback, while making its board
  * an instrument IN a housing, not a billboard floating over the machine.
  * Only a render-only Plane is resized. The original measured support box,
  * all mechanism children, portals and the device's current values stay exact. */
 function instrumentFascia(target,name,{paint=COLORS.paint}={}){
  const o=owner(target,name);if(!o)return;
  const s=o.bounds.getSize(V()),c=o.bounds.getCenter(V()),axis=s.x<s.z?0:2;
  const n=axis===0?V(1,0,0):V(0,0,1),right=axis===0?V(0,0,-1):V(1,0,0),up=V(0,1,0),q=Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,n));
  const w=Math.abs(s.dot(right))*.995,h=s.y*.995,d=Math.abs(s.dot(n))*.995;
  const b=(x,y,z,a,b,e,col=paint,metal=false)=>part(o,c.clone().addScaledVector(right,x).addScaledVector(up,y).addScaledVector(n,z).toArray(),[a,b,e],col,{q,metal});
  b(0,0,0,w,h,d*.81,COLORS.dark);
  for(const sign of [-1,1]){
   b(0,0,sign*d*.43,w*.97,h*.88,d*.08,paint);
   for(const x of [-1,1]){
    b(x*w*.45,0,sign*d*.475,w*.045,h*.90,d*.04,COLORS.metal,true);
    for(let i=0;i<4;i++)b(x*w*.35,(i-1.5)*h*.14,sign*d*.475,w*.12,h*.055,d*.04,COLORS.dark);
   }
   // End before the side rails. Their outward planes are equal by design,
   // so the copper must not enter their x-range at either corner.
   for(const y of [-1,1])b(0,y*h*.43,sign*d*.475,w*.84,h*.045,d*.04,COLORS.copper,true);
  }
  stats.instrumentFascias=(stats.instrumentFascias||0)+1;return o;
 }
 function compactReadout(mesh,scale){
  if(mesh?.geometry?.type!=='PlaneGeometry'||!mesh.material?.map||mesh.userData?.middleCompactReadout)return;
  const original=mesh.scale.clone();mesh.scale.x*=scale;mesh.scale.y*=.83;mesh.userData.middleCompactReadout=true;
  cleanup.push(()=>{mesh.scale.copy(original);delete mesh.userData.middleCompactReadout;});
  stats.compactReadouts=(stats.compactReadouts||0)+1;
 }
 /** A closed steel caisson with continuous perimeter returns and a few deep
  * transverse webs. It uses the ACTUAL shallow slab, not a suspended false
  * floor below it. Large dark members replace the former many copper slats. */
 function deckCaisson(target,name){
  const o=owner(target,name);if(!o)return;
  const s=o.bounds.getSize(V()),c=o.bounds.getCenter(V()),w=s.x*.995,h=s.y*.995,d=s.z*.995;
  const b=(x,y,z,a,b,e,col=COLORS.dark)=>part(o,c.clone().add(V(x,y,z)).toArray(),[a,b,e],col);
  const side=Math.min(.34,w*.08),end=Math.min(.32,d*.12);
  b(0,h*.45,0,w,h*.10,d,0x8a9e97);
  b(0,-h*.02,0,w-side*2-.05,h*.84,d-end*2-.05,0x46696b);
  for(const x of [-1,1])b(x*(w-side)/2,-h*.05,0,side,h*.90,d,0x28474c);
  for(const z of [-1,1])b(0,-h*.05,z*(d-end)/2,w-side*2-.025,h*.90,end,0x46696b);
  const webs=Math.max(1,Math.min(5,Math.floor(w/5))),spacing=(w-side*2)/(webs+1);
  for(let i=1;i<=webs;i++)b(-w/2+side+i*spacing,-h*.14,0,Math.min(.24,spacing*.12),h*.72,d-end*2-.025,0x47676b);
  stats.closedDeckCaissons=(stats.closedDeckCaissons||0)+1;return o;
 }
 /** The hook loads the near edge of this REAL moving gate. A broad top
  * flange, closed bearing-side return and diagonal plate webs explain that
  * transmission. They follow the original rigid train, not a display clock. */
 function tractionGate(target,name){
  const o=owner(target,name);if(!o)return;
  const s=o.bounds.getSize(V()),c=o.bounds.getCenter(V()),w=s.x*.99,h=s.y*.99,d=s.z*.99;
  const b=(x,y,z,a,b,e,col=COLORS.dark,angle=0)=>part(o,c.clone().add(V(x,y,z)).toArray(),[a,b,e],col,{q:Q().setFromAxisAngle(V(0,0,1),angle)});
  const rail=Math.min(.42,w*.08,h*.08),innerW=w-rail*2,innerH=h-rail*2;
  b(0,0,0,innerW,innerH,d*.52,0x527675);
  for(const x of [-1,1])b(x*(w-rail)/2,0,0,rail,h,d,0x263f48);
  for(const y of [-1,1])b(0,y*(h-rail)/2,0,innerW,rail,d,0x4c6b70);
  // Webs do not overlap one another or the perimeter in their outside plane.
  // Their raised faces sit in front of a complete closed enamel backing.
  const dy=innerH*.25,thickness=Math.min(.30,innerH*.09);
  for(const sign of [-1,1]){
   for(const [x,run,direction]of [[-.23,.38,-1],[.12,.22,1]]){
    const dx=innerW*run,length=Math.hypot(dx,dy),angle=direction*Math.atan2(dy,dx);
    b(x*innerW,0,sign*d*.375,length,thickness,d*.18,0xb89b68,angle);
   }
   b(innerW*.33,0,sign*d*.375,Math.min(.30,innerW*.055),innerH*.83,d*.18,0x263f48);
  }
  stats.tractionGates=(stats.tractionGates||0)+1;return o;
 }
 /** The terminal already owns this full collision envelope. A founded
  * closed lower casting replaces its visually weightless stalk while the
  * original GLB display, input point, height and physical bounds stay exact. */
 function terminalCasting(terminal){
  const target=terminal?.collider?.mesh;if(!target)return;
  const o=owner(target,`${number} / ${terminal.kind} founded control casting`,{physicalSurface:true});if(!o)return;
  const s=o.bounds.getSize(V()),c=o.bounds.getCenter(V()),b=(p,size,color)=>part(o,c.clone().add(V(...p)).toArray(),size,color);
  b([0,-s.y*.445,0],[s.x*.90,s.y*.10,s.z*.90],0x263f48);
  b([0,-s.y*.15,0],[s.x*.70,s.y*.50,s.z*.64],0x64867d);
  b([0,s.y*.11,0],[s.x*.84,s.y*.08,s.z*.78],0x9caea3);
  for(const side of [-1,1])b([side*s.x*.36,-s.y*.15,0],[s.x*.07,s.y*.43,s.z*.69],0x304d54);
  b([0,-s.y*.12,s.z*.345],[s.x*.45,s.y*.25,s.z*.04],0x314f55);
  stats.foundedControls=(stats.foundedControls||0)+1;return o;
 }
 function stairRiser(target){
  const o=owner(target,number+' / closed structural riser below the finished tread');if(!o)return;
  const size=o.bounds.getSize(V()),center=o.bounds.getCenter(V()),recess=Math.min(.12,size.y*.48);
  // The source stays a complete original Box, including all six ray/contact
  // faces. The render top ends inside the tread backing. Its side walls are
  // also inset20mm: the full-width backing and lower trim occupy the same
  // vertical z/x planes as the source box, so merely lowering the top leaves
  // a second coplanar conflict on their side faces.
  const keep=target.userData.keepMaterial,shape=target.userData.visualAuditMiddleShape;
  target.userData.keepMaterial=true;target.userData.visualAuditMiddleShape=true;
  cleanup.push(()=>{if(keep===undefined)delete target.userData.keepMaterial;else target.userData.keepMaterial=keep;
   if(shape===undefined)delete target.userData.visualAuditMiddleShape;else target.userData.visualAuditMiddleShape=shape;});
  part(o,center.add(V(0,-recess/2,0)).toArray(),[size.x-.04,size.y-recess,size.z-.04],COLORS.ivory,{kind:'riser'});
  o.stairTopRecess=recess;o.stairSideRecess=.02;stats.stairRisers=(stats.stairRisers||0)+1;
 }
 function smoothSurface(surface){
  const o=owner(surface.mesh,number+' / closed '+(surface.portal?'white portal face / ':'walking plate / ')+surface.name,{physicalSurface:true});if(!o)return;
  const size=o.bounds.getSize(V()),center=o.bounds.getCenter(V());
  // The original proxy owns exactly the same local box, ray target, portal
  // frame and moving parent. A closed sibling fills its interior and ends
  // six millimetres behind the established contact/portal plane.
  part(o,center.toArray(),[size.x,size.y,size.z-.012],surface.portal?0xf0f0e1:0xafbcae,{kind:'plate',material:'deck'});
  const keep=surface.group.userData.keepMaterial;surface.group.userData.keepMaterial=true;
  const sources=surface.group.children.filter(m=>m.isInstancedMesh),visibility=sources.map(m=>m.visible);
  for(const mesh of sources)mesh.visible=false;
  cleanup.push(()=>{sources.forEach((m,i)=>m.visible=visibility[i]);if(keep===undefined)delete surface.group.userData.keepMaterial;else surface.group.userData.keepMaterial=keep;});
  o.surface=surface;o.contactPlaneInset=.006;stats.closedSurfacePlates=(stats.closedSurfacePlates||0)+1;
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
 return {root,meshes,boxMeshes,named,at,visible,chamber,vessel,cabinet,bulkhead,instrumentFascia,compactReadout,deckCaisson,tractionGate,terminalCasting,stairRiser,smoothSurface,coat,nearestBox,handwheel,extras,cleanup,stats,finish};
}

/** Authored large-scale construction for the second and third chapters.
 * These are original thin CLOSED structural boxes, never the white portal
 * sheets or imported actors. Keep the garden, workshop and launch identities
 * separate; one consistent palette per chapter still leaves room-specific
 * silhouettes, windows and all their original occlusion relationships. */
function finishMiddleComposition(a,k,number){
 if(number<18||number>30)return;
 const palette=number<=20?{paint:0x718b8d,accent:0xd4ad68,theme:'service'}:
  number===24?{paint:0xaf7565,accent:0xeac57e,theme:'garden'}:
  number===27?{paint:0x637c9a,accent:0xe5b55e,theme:'service'}:
  number===28?{paint:0xbf7d69,accent:0x8bcac0,theme:'garden'}:
  number===29?{paint:0x827e9d,accent:0xe2c974,theme:'garden'}:
  {paint:0x63877c,accent:0xb5c4a4,theme:'garden'};
 for(const mesh of a.boxMeshes()){
  const p=mesh.geometry.parameters;
  if(mesh.parent!==k.world.root||!a.visible(mesh)||mesh.userData?.keepMaterial||mesh.userData?.portalable||mesh.userData?.portalTile||mesh.userData?.recoveryStairRiser||mesh.userData?.freightStairRiser)continue;
  if(p.height<4.5||Math.min(p.width,p.depth)>.85||Math.max(p.width,p.depth)<5.0||p.height*Math.max(p.width,p.depth)<38)continue;
  a.bulkhead(mesh,`${number} / closed architectural service bay`,palette);
 }
 if([19,21,22,23,27,29].includes(number))for(const mesh of a.boxMeshes()){
  const p=mesh.geometry.parameters;
  if(mesh.parent!==k.world.root||!a.visible(mesh)||mesh.userData?.keepMaterial||mesh.position.y<2||p.height<.20||p.height>.61||p.width<5||p.depth<2)continue;
  // The source's complete shallow steel box is still the load envelope.
  // A dark edge, milled perimeter and broad folded underside now separate
  // it from the light walking mineral, instead of reading as white paper.
  const made=number===23?a.deckCaisson(mesh,'23 / closed permanent load-bearing caisson'):
   a.chamber(mesh,`${number} / folded permanent deck underside`,{axis:1,paint:0x5b7b77,style:'rack'});
  if(made){
   a.stats.deckFascias=(a.stats.deckFascias||0)+1;
   const keep=mesh.userData.keepMaterial;mesh.userData.keepMaterial=true;
   a.cleanup.push(()=>{if(keep===undefined)delete mesh.userData.keepMaterial;else mesh.userData.keepMaterial=keep;});
  }
 }
 if(number===18||number===20){
  for(const mesh of a.meshes){
   if(mesh.name==='Process instrument')a.compactReadout(mesh,number===20?.47:.64);
   if(number===20&&/^Station wayfinding \/ (?:БЛИЖНИЙ КРЮК|ТОЛЬКО ОБЗОР|СТОПОР ЗУБА)/.test(mesh.name))a.compactReadout(mesh,.72);
   const p=mesh.geometry?.parameters;
   if(mesh.parent===k.world.root&&a.visible(mesh)&&mesh.name==='Folded dark casing'&&p?.height>1.8&&p.height<2.8&&p.width>9&&p.width<15&&p.depth<.35)
    a.instrumentFascia(mesh,`${number} / enclosed process instrument`,{paint:0x506b73});
  }
 }
 if(number===28){
  // The same tide values remain visible at every original observation site.
  // Reduction is proportional to the real cabinet: no replacement values or
  // fabricated status animation can drift away from the conserved water.
  for(const mesh of a.meshes)if(mesh.userData?.tideInstrument)a.compactReadout(mesh,.64);
 }
}

/** Pre-flush entry for ResearchChamber and ordinary Workshop builders. */
export function installVisualAuditMiddleKit(k,number){
 if(k.game.chamberEdition!=='foundation'||number<18||number>34||k.visualAuditMiddle)return k.visualAuditMiddle;
 const a=makeWorkshop(k,number),{named,at,chamber,vessel,coat,nearestBox}=a;
 switch(number){
  case 18:
   for(const x of [-22,19])a.cabinet(at([x,2.5,14],[4.2,5,4.4]),'18 / closed generator cabinet with cooling cheeks',{paint:0x8c9f92});
   for(const e of k.world.root.children.filter(m=>m.name==='Spring-loaded insulated electrode'))chamber(e,'18 / ribbed ceramic clamping jaw',{axis:0,paint:0xb8c6ba,style:'electrode'});
   chamber(at([10.35,5.1,-6.1],[2,1.4,1.25]),'18 / screw-drive motor casting',{paint:0x506c72});
   chamber(at([-14,1.4,9.8],[4.85,2.8,.35]),'18 / closed contact-cell rear service casting',{axis:2,paint:0x779994});
   // This fixed 1.2m wall is deliberately outside the general thin-baffle
   // selector. Finish its own closed hull without widening that selector.
   a.bulkhead(at([18.5,7,-7],[17,14,1.2]),'18 / right fixed circuit service bulkhead',{paint:0x718b8d,accent:0xd4ad68,theme:'service'});
   for(const mesh of a.meshes){
    const p=mesh.geometry?.parameters;
    if(/^Electrical cell service hatch$/.test(mesh.name))chamber(mesh,'18 / divided insulated service hatch',{paint:0x708e91});
    else if(mesh.name==='Electrical cell sliding roof')chamber(mesh,'18 / closed sliding conductor cover',{axis:1,paint:0x64878b});
    else if(mesh.parent===k.world.root&&a.visible(mesh)&&p?.height===1.8&&p.width===.35&&p.depth===6.3)
     chamber(mesh,'18 / insulated contact-cell enclosure',{axis:0,paint:0x779994});
   }
   break;
  case 19:
   chamber(nearestBox([-17,.7,9],p=>p.width>1&&p.width<7&&p.height<4&&p.depth>1&&p.depth<7),'19 / fan founded service plinth',{paint:0x6c7f72});
   break;
  case 20:
   a.handwheel(named('Finite motor-free hook hand rotor'),'20 / cast handwheel and passive coupling');
   for(const name of ['Loaded near-hook bearing arm','Near connector neck','Bearing-arm neck connection','Rigid hook back connector','Actual hook closed seat'])coat(named(name),0xcfa467);
   a.tractionGate(named('Tension-driven horizontal bulkhead'),'20 / framed load-bearing traction gate');
   a.tractionGate(named('Rigidly linked return-court bulkhead'),'20 / linked return traction gate');
   for(const name of ['Current near cable branch','Current far hanging cable branch','Near fairlead to active aperture','Active aperture to far fairlead','Cargo tether sleeve'])coat(named(name),0xe5c17e);
   for(const terminal of k.terminals)a.terminalCasting(terminal);
   break;
  case 21:
   for(const mesh of a.meshes.filter(m=>m.userData.recoveryStairRiser))a.stairRiser(mesh);
   a.cabinet(at([13.1,12.25,6],[14.5,7.5,8]),'21 / receiver upper equipment cabinet',{paint:0x819c91});
   chamber(named('Cassette rear header / solid'),'21 / counterweight return upper casing',{axis:0,paint:0x7b9a88});
   chamber(named('Cassette north enclosure / solid'),'21 / counterweight north load frame',{paint:0x5f807b});
   break;
  case 22:
   for(const mesh of a.meshes.filter(m=>m.userData.freightStairRiser))a.stairRiser(mesh);
   chamber(nearestBox([-12,.45,-5.75],p=>p.width>2&&p.width<5&&p.height<1.5&&p.depth>1&&p.depth<3),'22 / winch founded load pedestal',{paint:0x587b70});
   break;
  case 23:
   for(const terminal of k.terminals)a.terminalCasting(terminal);
   if(k.state.balance?.parts){
    // The ordinary campaign uses the physical machine, whose car and freight
    // pan are separately owned massive bodies. The thin car backing is an
    // authored body shape, not the retired half-metre decorative slab.
    for(const car of k.state.balance.cars){
     if(chamber(car.surface.backing,`23 / ${car.name} actual load-bearing folded underside`,{axis:2,paint:0x6d9385}))a.stats.physicalCarChassis=(a.stats.physicalCarChassis||0)+1;
    }
    for(const part of k.state.balance.parts){
     if(/founded lower cabin corner foot|travelling guide stop ear|powered clutch thrust fork/.test(part.mesh?.name||''))
      chamber(part.mesh,'23 / '+part.mesh.name+' formed shoe',{paint:0x719587});
    }
    // BiosphereArt owns the original moving hood, backstop and drive discs;
    // no second model is layered over those already manufactured parts.
   }else for(const car of [k.state.balance?.west,k.state.balance?.east].filter(Boolean)){
    const source=car.group.children.find(m=>m.geometry?.parameters?.height===.5);
    chamber(source,'23 / suspended car ribbed load chassis',{axis:1,paint:0x6d9385});
   }
   break;
  case 24:{
   const coral=a.boxMeshes().filter(m=>{const p=m.geometry.parameters,c=m.material?.color;return a.visible(m)&&p.height>4&&Math.min(p.width,p.depth)<1&&c&&c.r>c.g*1.14;}).sort((x,y)=>y.geometry.parameters.height*Math.max(y.geometry.parameters.width,y.geometry.parameters.depth)-x.geometry.parameters.height*Math.max(x.geometry.parameters.width,x.geometry.parameters.depth))[0];
   a.bulkhead(coral,'24 / pavilion coral access cassettes',{paint:0xb87b6b,accent:0xe6c777,theme:'garden'});break;
  }
  case 25:
   for(const blade of k.state.optical?.blades||[])coat(blade.mesh,0x436d74);
   a.bulkhead(at([11.1,13.5,-13.75],[.3,27,8.5]),'25 / fixed reverse optical screen casing',{axis:0,paint:0x406775,accent:0xe5b864,theme:'service'});
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
    if(/Basin [AB] (?:gauge|near-mouth readout) backing|Tidal circuit rear-wall backing/.test(mesh.name))a.instrumentFascia(mesh,mesh.name+' / sealed instrument housing',{paint:0x507c78});
   }
   // The coral shells are intentional authored colour, so the ordinary
   // automatic structural pass skips them. Their broad backs were still
   // featureless in the camera; finish those very same closed tank walls.
   for(const mesh of a.boxMeshes()){
    const p=mesh.geometry.parameters,color=mesh.material?.color;
    if(mesh.parent===k.world.root&&a.visible(mesh)&&mesh.userData?.keepMaterial&&color&&color.r>color.g*1.2&&p.height>5&&Math.min(p.width,p.depth)<.6&&Math.max(p.width,p.depth)>5)
     a.bulkhead(mesh,'28 / coral basin formed structural wall',{paint:0xbb7c68,accent:0x90c6bb,theme:'garden'});
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
   for(const surface of k.world.surfaces)if(surface.floor||surface.portal)a.smoothSurface(surface);
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
 finishMiddleComposition(a,k,number);
 const result=a.finish();k.visualAuditMiddle=result;return result;
}

export function finishVisualAuditMiddle(game,level,index=level.index){
 if(game.chamberEdition!=='foundation'||index<17||index>33||level.visualAuditMiddle)return level;
 const k=level.workshop;if(!k)return level;
 const art=k.visualAuditMiddle||installVisualAuditMiddleKit(k,index+1);if(!art)return level;
 if(index===22&&!art.stats.workingFloorFields){
  // Pigment belongs to the existing recovery floor, never an overlay plane.
  // The broad west operating court and real south control bay establish
  // scale around the actual machine without filling the clear floor with
  // decorative props or implying another route/powered platform.
  const copies=new Map(),changes=[],roots=[level.world.root,level.premiumBrowser3DArt].filter(Boolean),seen=new Set();
  for(const root of roots)root.traverse(mesh=>{
   if(seen.has(mesh)||!mesh.isMesh||!mesh.visible||mesh.userData?.portalTile||mesh.userData?.portalable||mesh.userData?.collisionProxy)return;seen.add(mesh);
   for(let node=mesh;node;node=node.parent)if(node.visible===false)return;
   const source=mesh.material;
   if(!source?.isMeshStandardMaterial||Array.isArray(source)||!source.visible||source.transparent)return;
   if(mesh.name!=='Architectural coat / cassette'&&source.userData?.architecturalRole!=='floor')return;
   let material=copies.get(source);
   if(!material){
    material=source.clone();const previous=source.onBeforeCompile,key=source.customProgramCacheKey.bind(source);
    material.onBeforeCompile=(shader,renderer)=>{
     previous.call(material,shader,renderer);
     shader.vertexShader='varying vec3 vCounterweightFloor;\nvarying vec3 vCounterweightNormal;\n'+shader.vertexShader;
     shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
      vec4 counterweightVertex=vec4(transformed,1.0);
      #ifdef USE_INSTANCING
       counterweightVertex=instanceMatrix*counterweightVertex;
      #endif
      vCounterweightFloor=(modelMatrix*counterweightVertex).xyz;
      vCounterweightNormal=inverseTransformDirection(transformedNormal,viewMatrix);`);
     shader.fragmentShader='varying vec3 vCounterweightFloor;\nvarying vec3 vCounterweightNormal;\n'+shader.fragmentShader;
     shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float counterweightGround=(1.0-smoothstep(.10,.25,abs(vCounterweightFloor.y)))*smoothstep(.85,.98,normalize(vCounterweightNormal).y);
      vec2 counterweightP=vCounterweightFloor.xz;
      float westCourt=smoothstep(-22.0,-21.84,counterweightP.x)*(1.0-smoothstep(-6.76,-6.6,counterweightP.x))*smoothstep(-14.0,-13.84,counterweightP.y)*(1.0-smoothstep(17.84,18.0,counterweightP.y));
      float controlBay=smoothstep(-6.4,-6.24,counterweightP.x)*(1.0-smoothstep(6.24,6.4,counterweightP.x))*smoothstep(6.8,6.96,counterweightP.y)*(1.0-smoothstep(14.64,14.8,counterweightP.y));
      diffuseColor.rgb*=mix(vec3(1.0),vec3(.52,.71,.73),counterweightGround*westCourt*.78);
      diffuseColor.rgb*=mix(vec3(1.0),vec3(.80,.86,.66),counterweightGround*controlBay*.55);`);
    };
    material.customProgramCacheKey=()=>key()+'|counterweight-working-courts-v1';material.needsUpdate=true;copies.set(source,material);
   }
   mesh.material=material;changes.push({mesh,source,material});
  });
  const dispose=art.root.dispose;let released=false;
  art.root.dispose=()=>{if(released)return;released=true;for(const {mesh,source,material}of changes)if(mesh.material===material)mesh.material=source;for(const material of copies.values())material.dispose();dispose();};
  art.stats.workingFloorFields=2;art.stats.workingFloorMeshes=changes.length;
 }
 const oldRender=level.renderUpdate,oldReset=level.reset,oldDispose=level.dispose;
 // Pre-flush installations already share the Workshop clock; the fallback
 // is also in k.renders, so this wrapper only owns deterministic cleanup.
 level.dispose=function(...args){art.root.dispose();return oldDispose?.apply(this,args);};
 level.visualAuditMiddle=art;art.root.ownedLifecycle={oldRender,oldReset};return level;
}
