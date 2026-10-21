import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const V=(...p)=>new THREE.Vector3(...p),Q=()=>new THREE.Quaternion();
function tint(g,tone){
 const n=g.index?g.toNonIndexed():g;if(n!==g)g.dispose();
 const rgb=Array.isArray(tone)?tone:[tone,tone,tone],c=new Float32Array(n.attributes.position.count*3);
 for(let i=0;i<c.length;i+=3)c.set(rgb,i);
 n.setAttribute('color',new THREE.BufferAttribute(c,3));return n;
}
function join(parts,name){const g=mergeGeometries(parts,false);parts.forEach(p=>p.dispose());g.name=name;g.computeBoundingBox();g.computeBoundingSphere();return g;}
function builder(){
 const parts=[];
 return{parts,box(p,s,t=.8){if(Math.min(...s)<=0)return;parts.push(tint(new THREE.BoxGeometry(...s),t).translate(...p));},
  cylinder(p,r,h,t=.8,q=Q(),segments=16){const g=tint(new THREE.CylinderGeometry(r,r,h,segments),t);g.applyQuaternion(q);g.translate(...p);parts.push(g);},
  plate(p,w,h,d,t=.8){
   const x=w/2,y=h/2,c=Math.min(w*.12,h*.12,.35),s=new THREE.Shape();
   [[-x+c,-y],[x-c,-y],[x,-y+c],[x,y-c],[x-c,y],[-x+c,y],[-x,y-c],[-x,-y+c]].forEach((p,i)=>i?s.lineTo(...p):s.moveTo(...p));s.closePath();
   const g=new THREE.ExtrudeGeometry(s,{depth:d,steps:1,bevelEnabled:false});g.translate(p[0],p[1],p[2]-d/2);parts.push(tint(g,t));
  }};
}

/** Closed bilateral pressed cassettes replace one opaque structural box.
 * The rear skin, rolled perimeter, deep mullions and stepped removable fields
 * all remain inside the original box; apertures are authored elsewhere. */
export function lateCassetteBulkheadGeometry(width,height,depth,axis='z'){
 const w=axis==='x'?depth:width,h=axis==='x'?height:axis==='y'?depth:height,d=axis==='x'?width:axis==='y'?height:depth;
 if(![w,h,d].every(v=>Number.isFinite(v)&&v>0))throw new RangeError('Positive closed cassette dimensions required');
 const rgb=hex=>new THREE.Color(hex).toArray(),paint=rgb(0x608b87),dark=rgb(0x263f49),metal=rgb(0xb4c4bc),warm=rgb(0xba8964),field=rgb(0xa1bab0);
 const b=builder(),rim=Math.min(.42,w*.08,h*.08),iw=w-2*rim,ih=h-2*rim;
 b.box([0,0,0],[iw,ih,d*.42],dark);
 for(const x of [-1,1])b.box([x*(w-rim)/2,0,0],[rim,h,d],metal);
 for(const y of [-1,1])b.box([0,y*(h-rim)/2,0],[iw,rim,d],dark);
 // Large pressure-painted bays belong to the real partition. They replace
 // the former office-like grid of identical beige tiles; a continuous dark
 // service plinth and broad vertical spine make each closed wall legible.
 const nx=Math.max(1,Math.ceil(iw/10.5)),ny=Math.max(1,Math.ceil(ih/9)),cw=iw/nx,ch=ih/ny,gap=Math.min(.18,cw*.04,ch*.04);
 for(let x=0;x<nx;x++)for(let y=0;y<ny;y++){
  const px=-iw/2+(x+.5)*cw,py=-ih/2+(y+.5)*ch;
  for(const sign of [-1,1]){
   b.plate([px,py,sign*d*.275],cw-gap,ch-gap,d*.13,dark);
   const inset=Math.min(.28,cw*.14,ch*.14),fw=cw-gap-inset,fh=ch-gap-inset;
   b.plate([px,py,sign*d*.355],fw,fh,d*.13,(x+y)%2===0?paint:field);
   const strip=Math.min(.34,fw*.10),skirt=Math.min(1.15,fh*.21);
   b.box([px-fw*.37,py,sign*d*.457],[strip,fh*.91,d*.076],metal);
   b.box([px,py-fh*.34,sign*d*.444],[fw*.87,skirt,d*.072],dark);
   if(fw>2.2&&fh>2.2){
    const count=Math.min(7,Math.max(3,Math.floor(fw/.9))),span=fw*.57;
    for(let j=0;j<count;j++)b.box([px+fw*.08-span/2+(j+.5)*span/count,py-fh*.34,sign*d*.485],[span/count*.45,skirt*.58,d*.022],metal);
    b.box([px+fw*.31,py+fh*.32,sign*d*.447],[fw*.14,Math.min(.28,fh*.08),d*.075],warm);
   }
  }
 }
 const g=join(b.parts,'Closed bilateral large-bay pressure-painted bulkhead');
 if(axis==='x')g.rotateY(Math.PI/2);else if(axis==='y')g.rotateX(Math.PI/2);
 g.parameters={width,height,depth};g.computeBoundingBox();g.computeBoundingSphere();return g;
}

/** One cast opposed-pressure head, aligned to the original cylinder's Y
 * axis. It has sealed chambers, full flanges and four captive tie rods. */
export function latePressureManifoldGeometry(radius,height){
 const b=builder(),r=radius,h=height,rgb=hex=>new THREE.Color(hex).toArray();
 const paint=rgb(0x527e7d),metal=rgb(0xb4c5be),dark=rgb(0x28434c),copper=rgb(0xc79560);
 b.cylinder([0,0,0],r*.76,h*.90,paint,Q(),20);
 for(const sign of [-1,1]){
  b.cylinder([0,sign*h*.43,0],r,h*.10,metal,Q(),24);
  b.cylinder([0,sign*h*.34,0],r*.91,h*.10,dark,Q(),24);
 }
 for(const x of [-1,1])for(const z of [-1,1]){
  b.cylinder([x*r*.60,0,z*r*.60],r*.075,h*.79,copper,Q(),8);
  for(const sign of [-1,1])b.cylinder([x*r*.60,sign*h*.47,z*r*.60],r*.12,h*.06,dark,Q(),6);
 }
 // Cast saddle and a connected square side manifold fit behind the end flange.
 b.box([0,0,-r*.72],[r*1.45,h*.56,r*.30],dark);
 b.box([r*.64,-h*.06,0],[r*.36,h*.43,r*.88],paint);
 for(const sign of [-1,1])b.cylinder([r*.83,sign*h*.12,0],r*.135,r*.34,metal,Q().setFromAxisAngle(V(0,0,1),Math.PI/2),10);
 const g=join(b.parts,'Closed opposed-pressure manifold with captive tie rods');
 g.parameters={radiusTop:r,radiusBottom:r,height:h,width:r*2,depth:r*2};return g;
}

/** Real undercarriage: wheels bear on the authored three-rail bed. The
 * closed truck lies completely below the existing walking deck and follows
 * its actual parent. Wheel travel reads that parent's displacement. */
export function installOpticalRailTruck(k,parent,material){
 if(!parent||parent.userData.lateOpticalRailTruck)return null;
 const b=builder();
 for(const z of [1,11]){
  b.box([0,-1.75,z],[9.4,.60,.66],.44);
  b.box([0,-1.10,z],[8.4,.58,.60],.61);
  for(const x of [-3.8,3.8]){
   b.box([x,-1.75,z],[1.7,1.1,.70],.40);
   b.box([x,-1.04,z],[1.35,.38,.68],.76);
   b.cylinder([x,-2.46,z],.34,.7,.68,Q().setFromAxisAngle(V(1,0,0),Math.PI/2));
  }
 }
 for(const x of [-3.8,3.8])b.box([x,-1.70,6],[.64,.76,9.35],.50);
 const chassis=k.geometry(join(b.parts,'Closed optical truck / axle boxes and load saddles'),material,[0,0,0],Q(),{parent,batch:false,name:'49 / rail truck attached to actual walking chassis'});
 chassis.userData.visualAuditLateShape='rail truck';
 const wheels=[];
 for(const x of [-3.8,3.8])for(const z of [1,11]){
  const w=builder();
  w.cylinder([0,0,0],.67,.53,.38,Q().setFromAxisAngle(V(1,0,0),Math.PI/2),24);
  w.cylinder([0,0,(z===1?1:-1)*.23],.75,.14,.58,Q().setFromAxisAngle(V(1,0,0),Math.PI/2),24);
  w.cylinder([0,0,(z===1?-1:1)*.30],.27,.10,.77,Q().setFromAxisAngle(V(1,0,0),Math.PI/2),12);
  for(let i=0;i<6;i++){const a=i*Math.PI/3;w.box([Math.cos(a)*.42,Math.sin(a)*.42,(z===1?-1:1)*.275],[.12,.12,.065],.68);}
  const mesh=k.geometry(join(w.parts,'Flanged optical guide wheel'),material,[x,-2.50,z],Q(),{parent,batch:false,name:'49 / flanged wheel on real running rail'});
  mesh.userData.visualAuditLateShape='rail wheel';wheels.push(mesh);
 }
 k.renders.push(()=>{for(const mesh of wheels)mesh.rotation.z=-(parent.position.x+24)/.67;});
 const bounds=new THREE.Box3(V(-4.7,-3.25,.65),V(4.7,-.80,11.35));
 const receipt={chassis,wheels,bounds,originalMovingParent:parent};parent.userData.lateOpticalRailTruck=true;return receipt;
}
