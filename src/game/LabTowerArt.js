import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {towerPoint} from './LabTowerLayout.js';

// The reliefs sit on the room side of the solid wall by at most 17 cm. The
// existing wall and ceiling remain their collision backings; there is no
// free-standing decorative machine for the player or cargo to walk through.
const DECK_COLOURS=[0x52d7e5,0xffbb70,0xb1a5ff,0x81e7b1,0xff9dbb,0xf7db82];
const UP=new THREE.Vector3(0,1,0);
const BOX_ROT=new THREE.Quaternion();
const DISC_ROT=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2);
const FLOOR_ROT=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2);
const SPIN_AXIS=new THREE.Vector3(0,0,1);
const DECK_LANGUAGE=['prism','foundry','orbits','lattice','storm','crown'];

function wallBasis(def,sign=1){
 const [dx,dz]=def.direction;
 return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
  new THREE.Vector3(-dx*sign,0,-dz*sign),UP,new THREE.Vector3(dz*sign,0,-dx*sign)));
}
function endBasis(def){
 const [dx,dz]=def.direction;
 return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
  new THREE.Vector3(-dz,0,dx),UP,new THREE.Vector3(-dx,0,-dz)));
}

/** Browser-sized architectural finish for the final Tower. All fixed pieces
 * are instanced by deck/material/shape. Every visible wing detail is a thin
 * backed relief, an inlaid floor line, or a high ceiling member. Mechanisms,
 * portal targets, physics, and structural collisions remain owned by Level.
 *
 * @returns {{update:(dt:number)=>void, dispose:()=>void, stats:object}}
 */
export function decorateTower({root,rooms,stairs=[]}){
 const art=new THREE.Group();art.name='Tower / backed architectural art';art.userData.visualOnly=true;root.add(art);
 const geometries={
  box:new THREE.BoxGeometry(1,1,1),
  casing:new RoundedBoxGeometry(1,1,1,2,.105),
  ring:new THREE.TorusGeometry(1,.042,7,40),
  fineRing:new THREE.TorusGeometry(1,.018,5,40),
  disc:new THREE.CylinderGeometry(1,1,1,32),
  jewel:new THREE.OctahedronGeometry(1,0),
 };
 const materials={
  graphite:new THREE.MeshStandardMaterial({name:'Tower graphite enamel',color:0x1b303c,metalness:.48,roughness:.57}),
  alloy:new THREE.MeshStandardMaterial({name:'Tower satin alloy',color:0xb2c8ca,metalness:.73,roughness:.30}),
  porcelain:new THREE.MeshStandardMaterial({name:'Tower ceramic porcelain',color:0xd7e6e2,metalness:.15,roughness:.55}),
  recess:new THREE.MeshStandardMaterial({name:'Tower recessed optical glass',color:0x244758,metalness:.52,roughness:.23}),
  shadow:new THREE.MeshStandardMaterial({name:'Tower deep machine cavities',color:0x101e29,metalness:.28,roughness:.76}),
  accent:new THREE.MeshStandardMaterial({name:'Tower anodised colour',color:0xffffff,metalness:.50,roughness:.34}),
  signal:new THREE.MeshBasicMaterial({name:'Tower signal glass',color:0xffffff,toneMapped:false}),
 };
 const batches=new Map();let instanceCount=0,time=0;
 const list=(deck,geometry,material)=>{
  const key=`${deck}/${geometry}/${material}`;
  if(!batches.has(key))batches.set(key,{deck,geometry,material,items:[]});
  return batches.get(key).items;
 };
 function piece(deck,geometry,material,point,quaternion,scale,color=0xffffff){
  const matrix=new THREE.Matrix4().compose(point,quaternion,scale);
  list(deck,geometry,material).push({matrix,color});instanceCount++;
 }
 const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
 const tint=(def)=>new THREE.Color(DECK_COLOURS[def.deck]).offsetHSL((def.branch-1)*.036,0,.005);

 /** Stage wall coordinates: X points toward the hub; +Z faces the player. */
 function face(def,origin,q){
  // The solid wall's inner face is n=6.04. Recess the base 3 cm behind it;
  // the deepest signal ring projects less than 17 cm into the chamber.
  const place=(geometry,material,x,up,z,sx,sy,sz,color=0xffffff,angle=0)=>{
   const local=v(x,up,z).applyQuaternion(q).add(origin);
   const rot=q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(v(0,0,1),angle));
   piece(def.deck,geometry,material,local,rot,v(sx,sy,sz),color);
  };
  const rail=(x0,y0,x1,y1,material='alloy',width=.075,z=.087,color=0xffffff)=>{
   const dx=x1-x0,dy=y1-y0;
   place('box',material,(x0+x1)/2,(y0+y1)/2,z,Math.hypot(dx,dy),width,.055,color,Math.atan2(dy,dx));
  };
  const ring=(x,y,r,material='alloy',color=0xffffff,z=.10)=>
   place('ring',material,x,y,z,r,r,1,color);
  const dot=(x,y,r=.09,material='alloy',color=0xffffff)=>{
   const p=v(x,y,.125).applyQuaternion(q).add(origin);
   piece(def.deck,'disc',material,p,q.clone().multiply(DISC_ROT),v(r,.065,r),color);
  };
  const polygon=(sides,r,material='alloy',phase=0,color=0xffffff)=>{
   for(let i=0;i<sides;i++){
    const a=phase+Math.PI*2*i/sides,b=phase+Math.PI*2*(i+1)/sides;
    rail(Math.cos(a)*r,Math.sin(a)*r,Math.cos(b)*r,Math.sin(b)*r,material,.075,.11,color);
   }
  };
  return {place,rail,ring,dot,polygon,q,origin};
 }
 function wall(def,s,y,sign=1){
  return face(def,new THREE.Vector3(...towerPoint(def,s,sign*6.07,def.baseY+y)),wallBasis(def,sign));
 }
 function terminus(def,y){
  // The end wall has a real backing at s=41.825. Its reliefs face the
  // player and never enter the reactor's four-metre approach.
  return face(def,new THREE.Vector3(...towerPoint(def,41.82,0,def.baseY+y)),endBasis(def));
 }

 // Each graphic traces the working dependency, not an arbitrary number stamp.
 // They sit high on the +n wall, s=17, clear of every white portal panel.
 function signature(def,g,c){
  const {rail,ring,dot,polygon}=g,id=def.id;
  const A=(x0,y0,x1,y1,w=.09)=>rail(x0,y0,x1,y1,'signal',w,.155,c);
  const R=(x,y,r)=>ring(x,y,r,'signal',c,.155);
  switch(id){
   case 'prism':
    polygon(3,1.24,'alloy',Math.PI/2);polygon(3,.94,'signal',Math.PI/2,c);
    R(0,0,.32);A(-1.55,-.2,-.48,-.2);A(.5,.2,1.5,.72);break;
   case 'freight':
    for(const x of [-1.05,1.05]){R(x,.51,.48);A(x,-1.12,x,.07,.12);}
    A(-1.05,.51,1.05,.51);A(-1.5,-1.12,1.5,-1.12,.13);break;
   case 'exchange':
    R(-.66,.10,.67);R(.66,-.10,.67);
    A(-1.65,-.9,1.65,.9);A(-1.65,.9,1.65,-.9);dot(0,0,.15,'signal',c);break;
   case 'turbine':
    R(0,0,1.15);R(0,0,.38);
    for(let i=0;i<7;i++){const a=i*Math.PI*2/7;A(Math.cos(a)*.49,Math.sin(a)*.49,
     Math.cos(a+.42)*.98,Math.sin(a+.42)*.98,.13);}break;
   case 'double-prism':
    for(const x of [-.88,.88]){const p=wallPolygonOffset(g,x,0);p(6,.58,'signal',Math.PI/6,c);}
    A(-.30,0,.30,0);dot(0,0,.15,'signal',c);break;
   case 'levitator':
    for(const y of [-.76,0,.76]){rail(-1.25,y,1.25,y,'alloy',.12);R(0,y,.28);}
    A(-.85,-1.2,-.85,1.2);A(.85,-1.2,.85,1.2);break;
   case 'battery':
    for(const x of [-.95,0,.95])for(const y of [-.55,.55]){
     rail(x-.29,y-.33,x+.29,y+.33,'signal',.07,.15,c);
     rail(x-.29,y+.33,x+.29,y-.33,'alloy',.07);
    }A(-1.5,0,1.5,0);break;
   case 'windway':
    for(let i=0;i<5;i++){
     const y=(i-2)*.48;A(-1.45,y-.17,-.45,y+.17,.10);
     A(-.35,y+.17,.82,y-.10,.10);
    }A(.82,-1.07,1.5,0);A(.82,1.07,1.5,0);break;
   case 'vault':
    polygon(8,1.16,'alloy',Math.PI/8);polygon(8,.78,'signal',Math.PI/8,c);
    for(let i=0;i<8;i++){const a=i*Math.PI/4;A(Math.cos(a)*.4,Math.sin(a)*.4,
     Math.cos(a+.3)*.74,Math.sin(a+.3)*.74,.1);}break;
   case 'magnet':
    for(const x of [-1,1]){R(x,.62,.32);A(x,-.94,x,.34,.15);}
    A(-1,-.94,1,-.94,.15);R(0,.62,.56);break;
   case 'press':
    for(const x of [-.9,.9]){
     A(x,-1.22,x,1.22,.15);dot(x,.82,.21,'signal',c);
    }A(-1.45,-.52,1.45,-.52,.18);A(-1.25,-.78,1.25,-.78,.15);break;
   case 'refraction':
    polygon(3,1.08,'signal',Math.PI/2,c);
    A(-1.6,0,-.55,0);A(.45,.2,1.55,.75);A(.45,-.2,1.55,-.75);
    A(-.12,-.98,-.12,.8);break;
   case 'storm':
    R(0,0,1.28);for(let i=0;i<3;i++){
     const x=(i-1)*.8;A(x-.16,1.08,x+.13,.37);
     A(x+.13,.37,x-.1,-.23);A(x-.1,-.23,x+.19,-1.08);
    }break;
   case 'relay':
    for(const y of [-.85,0,.85]){R(-.96,y,.2);A(-.72,y,.15,y);}
    A(.15,-.85,.15,.85);A(.15,0,1.35,0);R(1.4,0,.25);break;
   case 'balance':
    A(-1.48,.55,1.48,.55,.17);A(0,.55,0,-1.15,.13);
    for(const x of [-1.04,1.04]){
     A(x,.5,x,-.53);A(x-.5,-.55,x+.5,-.55,.13);R(x,-.3,.27);
    }break;
   case 'confluence':
    for(const y of [-.85,0,.85]){
     A(-1.6,y,-.48,y*.40);A(-.48,y*.40,.7,0);
    }R(.8,0,.50);A(1.2,0,1.65,0,.12);break;
   case 'crown-drive':
    polygon(9,1.25,'alloy',Math.PI/2);R(0,0,.74);
    for(let i=0;i<9;i++){const a=i*2*Math.PI/9;A(Math.cos(a)*1.22,Math.sin(a)*1.22,
     Math.cos(a)*1.44,Math.sin(a)*1.44,.14);}break;
   case 'last-aperture':
    R(0,0,1.31);polygon(7,1.07,'signal',Math.PI/2,c);
    for(let i=0;i<7;i++){const a=i*2*Math.PI/7;
     A(Math.cos(a)*.34,Math.sin(a)*.34,Math.cos(a+.56)*1.00,Math.sin(a+.56)*1.00,.11);
    }break;
  }
 }
 function wallPolygonOffset(g,x,y){return(sides,r,material,phase,color)=>{
  for(let i=0;i<sides;i++){
   const a=phase+2*Math.PI*i/sides,b=phase+2*Math.PI*(i+1)/sides;
   g.rail(x+Math.cos(a)*r,y+Math.sin(a)*r,x+Math.cos(b)*r,y+Math.sin(b)*r,
    material,.075,.11,color);
  }
 };}

 function entranceBadge(def,c){
  // The same machine glyph is legible from the hub before the player commits
  // to a branch. It is a family marker, not a numbered or forced route.
  const face=wall(def,3.45,5.38),k=.47;
  face.place('casing','graphite',0,0,-.025,2.62,2.20,.10);
  face.place('casing','alloy',0,0,.038,2.43,2.01,.055);
  face.place('casing','recess',0,0,.076,2.25,1.83,.027);
  for(const x of [-1.09,1.09])for(const y of [-.89,.89])face.dot(x,y,.055,'porcelain');
  const mini={
   rail:(x0,y0,x1,y1,mat,w,z,col)=>face.rail(x0*k,y0*k,x1*k,y1*k,mat,w*k,z,col),
   ring:(x,y,r,mat,col,z)=>face.ring(x*k,y*k,r*k,mat,col,z),
   dot:(x,y,r,mat,col)=>face.dot(x*k,y*k,r*k,mat,col),
   polygon:(sides,r,mat,phase,col)=>{
    for(let i=0;i<sides;i++){
     const a=phase+2*Math.PI*i/sides,b=phase+2*Math.PI*(i+1)/sides;
     face.rail(Math.cos(a)*r*k,Math.sin(a)*r*k,
      Math.cos(b)*r*k,Math.sin(b)*r*k,mat,.075*k,.11,col);
    }
   },
  };
  signature(def,mini,c);
 }

 // Each storey has a different construction rhythm. These are wall-backed
 // reliefs, never blocks in the player's path. Their silhouettes stay clear
 // of the portal ceramics on s=8, 14 and 20.
 function wallBay(def,s,sign,serial,c){
  const g=wall(def,s,4.36,sign),{place,rail,ring,dot,polygon}=g;
  const kind=DECK_LANGUAGE[def.deck],shift=(def.branch-1)*.21;
  place('casing','graphite',0,0,-.025,3.42,4.77,.10);
  place('casing','alloy',0,0,.037,3.22,4.56,.055);
  place('casing','shadow',0,0,.073,2.96,4.30,.025);
  for(const x of [-1.48,1.48])for(const y of [-2.12,2.12])
   place('box','porcelain',x,y,.113,.10,.10,.032);
  for(const y of [-2.04,2.04])rail(-1.20,y,1.20,y,'accent',.075,.125,c);
  const L=(x0,y0,x1,y1,w=.075)=>rail(x0,y0,x1,y1,'signal',w,.15,c);
  switch(kind){
   case 'prism': {
    const lean=(serial%2?1:-1)*.26+shift;
    for(const scale of [.67,.94,1.2]){
     L(lean,1.53*scale,lean-1.05*scale,-.92*scale);
     L(lean-1.05*scale,-.92*scale,lean+1.05*scale,-.92*scale);
     L(lean+1.05*scale,-.92*scale,lean,1.53*scale);
    }
    ring(lean,-.15,.22,'porcelain');break;
   }
   case 'foundry':
    for(const radius of [.45,.79,1.11])ring(shift,0,radius,radius===.79?'signal':'alloy',c);
    for(let i=0;i<8;i++){
     const a=(i+serial*.25)*Math.PI/4;
     L(shift+Math.cos(a)*1.12,Math.sin(a)*1.12,
      shift+Math.cos(a)*1.40,Math.sin(a)*1.40,.12);
    }
    for(const y of [-1.69,1.69])L(-1.17,y,1.17,y,.14);
    break;
   case 'orbits':
    for(const [x,y,r] of [[-.35,0,1.14],[.34,.36,.78],[.45,-.62,.47]])
     ring(x+shift,y,r,'signal',c);
    for(const [x,y] of [[-.95,.6],[.76,1.17],[.39,-1.26]])
     dot(x+shift,y,.13,'porcelain');
    L(-1.23,-1.75,.88,1.74,.11);break;
   case 'lattice':
    for(let i=0;i<5;i++){
     const y=-1.63+i*.81,flip=(i+serial+def.branch)%2?1:-1;
     L(-1.27,y,.0,y+flip*.49,.105);
     L(0,y+flip*.49,1.27,y,.105);
    }
    for(const x of [-1.27,1.27])rail(x,-1.78,x,1.78,'alloy',.12,.13);
    break;
   case 'storm':
    for(let i=0;i<3;i++){
     const x=-.91+i*.90+shift;
     L(x-.12,1.74,x+.27,.49,.11);
     L(x+.27,.49,x-.20,-.24,.13);
     L(x-.20,-.24,x+.19,-1.57,.11);
    }
    for(const y of [-1.8,1.8])rail(-1.25,y,1.25,y,'alloy',.12,.12);
    break;
   case 'crown':
    polygon(7,1.31,'alloy',Math.PI/2);
    for(let i=0;i<7;i++){
     const a=(i+.5)*Math.PI*2/7;
     L(Math.cos(a)*.55,Math.sin(a)*.55,
      Math.cos(a)*1.32,Math.sin(a)*1.32,.12);
    }
    ring(0,0,.43,'signal',c);dot(0,0,.15,'porcelain');break;
  }
  // A different number of charged terminals identifies the wing even when
  // several rooms share the same storey's material language.
  for(let i=0;i<def.branch+1;i++)
   dot(-.70+i*.70,-1.89,.077,'signal',c);
 }

 function overheadLine(def,s0,n0,s1,n1,material,c,width=.06,y=7.41,height=.036){
  const a=v(...towerPoint(def,s0,n0,def.baseY+y));
  const b=v(...towerPoint(def,s1,n1,def.baseY+y));
  const delta=b.clone().sub(a),q=new THREE.Quaternion().setFromUnitVectors(v(1,0,0),delta.clone().normalize());
  piece(def.deck,'box',material,a.add(b).multiplyScalar(.5),q,v(delta.length(),height,width),c);
 }
 function ceilingLanguage(def,c){
  for(const s of [5.7,12.8,21.6,29.8,37.5]){
   // Shallow soffits sit immediately below the solid ceiling. Their open
   // centers leave the mechanisms and white portal faces visually distinct.
   const p=v(...towerPoint(def,s,0,def.baseY+7.54));
   piece(def.deck,'casing','graphite',p,wallBasis(def),v(.22,.17,11.75));
   p.y-=.12;
   piece(def.deck,'box','accent',p,wallBasis(def),v(.075,.026,10.88),c);
  }
  for(const s of [13.1,22.0,35.1]){
   const p=v(...towerPoint(def,s,0,def.baseY+7.54));
   piece(def.deck,'disc','shadow',p,BOX_ROT,v(2.55,.15,2.55));
   const ringAt=(radius,material='signal')=>
    piece(def.deck,'fineRing',material,
     v(p.x,def.baseY+7.39,p.z),FLOOR_ROT,v(radius,radius,1),c);
   const R=(u0,n0,u1,n1,w=.08)=>overheadLine(def,s+u0,n0,s+u1,n1,'signal',c,w,7.38);
   switch(DECK_LANGUAGE[def.deck]){
    case 'prism':
     for(const size of [.85,1.62])for(let j=0;j<3;j++){
      const a=j*2*Math.PI/3+Math.PI/2,b=(j+1)*2*Math.PI/3+Math.PI/2;
      R(Math.cos(a)*size,Math.sin(a)*size,Math.cos(b)*size,Math.sin(b)*size);
     }break;
    case 'foundry':
     ringAt(.75);ringAt(1.58,'alloy');
     for(let j=0;j<8;j++){const a=j*Math.PI/4;
      R(Math.cos(a)*1.13,Math.sin(a)*1.13,Math.cos(a)*1.92,Math.sin(a)*1.92,.13);
     }break;
    case 'orbits':
     for(const [u,n,r] of [[-.55,0,1.10],[.50,.44,.86],[.57,-.75,.47]])
      piece(def.deck,'fineRing','signal',
       v(...towerPoint(def,s+u,n,def.baseY+7.38)),FLOOR_ROT,v(r,r,1),c);
     break;
    case 'lattice':
     for(let j=-2;j<=2;j++){R(-1.6,j*.48,.1,(j+.5)*.42);R(.1,(j+.5)*.42,1.6,j*.48);}
     break;
    case 'storm':
     for(let j=-1;j<=1;j++){
      const n=j*.72;R(-1.7,n-.27,-.4,n+.25,.10);
      R(-.4,n+.25,.40,n-.22,.12);R(.40,n-.22,1.7,n+.29,.10);
     }break;
    case 'crown':
     ringAt(.52);
     for(let j=0;j<9;j++){const a=j*2*Math.PI/9;
      R(Math.cos(a)*.56,Math.sin(a)*.56,Math.cos(a)*1.91,Math.sin(a)*1.91,.11);
     }break;
   }
  }
 }
 function floorLanguage(def,course,c){
  // These short markings sit on the actual course. A continuous line in the
  // original aisle would now lead through the annex's solid partition, while
  // a flat line over the causeway would disappear inside its real risers.
  if(course.topology==='momentum-shaft'){
   // Repeated transverse marks lead to the catwalk lip and reveal the raised
   // receiving shelf. Their height follows those two real support surfaces.
   for(const s of [11.8,13.2,14.6])overheadLine(def,s,-1.8,s,1.8,'signal',c,.085,5.02,.012);
   for(const s of [23.4,25.2,27,29])overheadLine(def,s,3.55,s,5.55,'signal',c,.07,2.07,.012);
   return;
  }
  if(course.topology==='raised-causeway'||course.topology==='broken-skybridge'){
   for(const tread of course.solids.filter(item=>item.role==='step')){
    const y=tread.y+tread.height/2;
    overheadLine(def,tread.s-tread.along*.42,-tread.across*.43,
     tread.s-tread.along*.42,tread.across*.43,'graphite',0xffffff,.19,y+.010,.012);
    overheadLine(def,tread.s-tread.along*.42,-tread.across*.43,
     tread.s-tread.along*.42,tread.across*.43,'signal',c,.056,y+.021,.012);
   }
   if(course.topology==='broken-skybridge'){
    // Trace only supported pieces of the high catwalk. A floating cable over
    // its missing span would falsely suggest that walking across is safe.
    for(const [s0,n0,s1,n1]of [[30,13.6,30,20.7],
     [30.1,20.8,32.03,20.8],[34.11,20.8,35.9,20.8],
     [36,20.7,36,13.6]]){
     overheadLine(def,s0,n0,s1,n1,'graphite',0xffffff,.19,1.213,.012);
     overheadLine(def,s0,n0,s1,n1,'signal',c,.056,1.224,.012);
    }
   }
   return;
  }
  const points=[{s:28.65,n:0},...course.waypoints];
  for(let i=1;i<points.length;i++){
   const a=points[i-1],b=points[i],ds=b.s-a.s,dn=b.n-a.n;
   const length=Math.hypot(ds,dn);
   if(length<.7)continue;
   // A pair of inset dashes suggests the route without drawing a false
   // continuous cable over machine housings or through walls.
   const u0=.34,u1=.69,offset=.22;
   for(const side of [-1,1]){
    const ns=side*offset*ds/length,ss=-side*offset*dn/length;
    overheadLine(def,a.s+ds*u0+ss,a.n+dn*u0+ns,
     a.s+ds*u1+ss,a.n+dn*u1+ns,'graphite',0xffffff,.19,.010,.012);
    overheadLine(def,a.s+ds*u0+ss,a.n+dn*u0+ns,
     a.s+ds*u1+ss,a.n+dn*u1+ns,'signal',c,.055,.021,.012);
   }
  }
 }

 function wingTerminus(def,c){
  const g=terminus(def,4.05),{place,rail,ring,dot}=g;
  place('casing','graphite',0,0,-.036,10.20,6.74,.10);
  place('casing','alloy',0,0,.034,9.88,6.48,.056);
  place('casing','shadow',0,0,.078,9.55,6.18,.027);
  for(const x of [-4.65,4.65])for(const y of [-2.97,2.97])
   dot(x,y,.11,'porcelain');
  for(const y of [-2.83,2.83])rail(-4.37,y,4.37,y,'accent',.095,.125,c);
  // Unlike the side-wall signature, the terminus shows the actual dependency
  // graph: the required inputs converge on the center and feed the exit.
  const requirements=def.puzzle.requirements;
  for(let i=0;i<requirements.length;i++){
   const y=(i-(requirements.length-1)/2)*1.42;
   const radius=.38+(requirements[i].length%3)*.09;
   ring(-2.76,y,radius,'signal',c,.13);
   dot(-2.76,y,.11,'porcelain');
   rail(-2.34,y,-.62,y*.49,'alloy',.12,.13);
   rail(-2.10,y,-.59,y*.49,'signal',.043,.155,c);
  }
  ring(0,0,.94,'alloy');ring(0,0,.70,'signal',c,.15);
  dot(0,0,.23,'porcelain');
  for(let i=0;i<5+def.branch;i++){
   const a=-Math.PI*.55+i*Math.PI*.18;
   rail(.95*Math.cos(a),.95*Math.sin(a),
    1.32*Math.cos(a),1.32*Math.sin(a),'signal',.10,.15,c);
  }
  rail(.76,0,3.70,0,'alloy',.22,.13);
  rail(1.22,0,3.70,0,'signal',.070,.157,c);
  for(const x of [2.05,2.84,3.64])dot(x,0,.085,'porcelain');
 }

 const rotors=[];
 function wing(room){
  const {definition:def,course}=room,c=tint(def),entry=wall(def,17,4.85);
  const backed=(s,sign,halfWidth=.3)=>!course.wallGaps.some(gap=>
   gap.sign===sign&&s+halfWidth>gap.s0&&s-halfWidth<gap.s1);
  entranceBadge(def,c);
  for(const [i,s] of [12.2,22.2,39.0].entries())if(backed(s,1,1.82))wallBay(def,s,1,i,c);
  for(const [i,s] of [7.6,31.5].entries())if(backed(s,-1,1.82)&&!(def.id==='balance'&&s===7.6))
   wallBay(def,s,-1,i+3,c);
  for(const sign of [-1,1]){
   const gaps=course.wallGaps.filter(gap=>gap.sign===sign).sort((a,b)=>a.s0-b.s0);
   let cursor=2.8;
   for(const gap of [...gaps,{s0:39.2,s1:39.2}]){
    const end=Math.min(39.2,gap.s0-.04),length=end-cursor;
    if(length>.15){
     const line=wall(def,(cursor+end)/2,6.84,sign);
     line.rail(-length/2,0,length/2,0,'graphite',.29,.07);
     line.rail(-length/2+.12,-.11,length/2-.12,-.11,'accent',.052,.125,c);
    }
    cursor=Math.max(cursor,gap.s1+.04);
   }
  }
  ceilingLanguage(def,c);
  floorLanguage(def,course,c);
  wingTerminus(def,c);
  // Layered die-cast case, inset optical glass, satin retaining strips and
  // recessed fasteners. The back is inside the already solid side wall.
  entry.place('casing','graphite',0,0,-.025,4.72,3.63,.12);
  entry.place('casing','alloy',0,0,.039,4.49,3.40,.065);
  entry.place('casing','recess',0,0,.082,4.25,3.15,.028);
  for(const x of [-2.07,2.07])for(const y of [-1.53,1.53])entry.dot(x,y,.073,'porcelain');
  for(const y of [-1.73,1.73])entry.rail(-1.84,y,1.84,y,'accent',.08,.12,c);
  for(const x of [-1.98,1.98])entry.rail(x,-1.42,x,1.42,'graphite',.11,.12);
  signature(def,entry,c);
  const marker=entry.origin.clone().add(v(0,0,.185).applyQuaternion(entry.q));
  rotors.push({deck:def.deck,position:marker,basis:entry.q,colour:c,
   index:rotors.length,phase:def.index*1.618,speed:((def.index%4)+1)*.15});

  // The working surfaces remain visually legible: a clean line to the gate
  // and an overhead pair of power conduits, with no geometry over a portal.
  const side=wall(def,18,6.88);
  for(const y of [-.16,.16]){
   side.rail(-7.3,y,9.1,y,'graphite',.14,.06);
   side.rail(-7.05,y,8.87,y,'accent',.033,.12,c);
  }
  for(const s of [.8,11.3,25.3,31.2,36.7,40.5]){
   if(!backed(s,1))continue;
   const frame=wall(def,s,5.4);
   frame.place('casing','alloy',0,0,-.035,.37,4.20,.09);
   frame.place('box','graphite',0,0,.025,.19,3.94,.08);
   frame.place('box','accent',0,1.46,.083,.11,.58,.024,c);
  }
  for(const s of [3,12,25,31,38]){
   const p=new THREE.Vector3(...towerPoint(def,s,0,def.baseY+7.49));
   const q=wallBasis(def);
   piece(def.deck,'casing','alloy',p,q,v(.24,.13,11.65));
   p.y-=.11;
   piece(def.deck,'box','signal',p,q,v(.08,.026,10.85),c);
  }
  // The solved gallery has its own recessed medallion; it reinforces the
  // direction toward the actual reactor without pretending to be a switch.
  const exit=backed(34.1,1,1.03)?wall(def,34.1,5.0):null;
  if(exit){
  exit.place('casing','graphite',0,0,-.025,2.05,1.84,.10);
  exit.ring(0,0,.69,'accent',c,.11);
  exit.ring(0,0,.46,'signal',c,.13);
  for(let i=0;i<5;i++){
   const a=i*2*Math.PI/5;
   exit.dot(Math.cos(a)*.92,Math.sin(a)*.80,.055,'porcelain');
  }
  }
 }
 rooms.forEach(wing);

 // Six stacked switchyards get a large, low-profile annulus under their real
 // floor/roof slabs. At floor level only light inlays touch the walking area.
 for(let deck=0;deck<6;deck++){
  const y=deck*8,c=new THREE.Color(DECK_COLOURS[deck]);
  for(const r of [2.45,4.05,5.85]){
   piece(deck,'fineRing','signal',v(0,y+.033,0),FLOOR_ROT,v(r,r,1),c);
   piece(deck,'ring','alloy',v(0,y+7.47,0),FLOOR_ROT,v(r,r,1));
  }
  // Each completed branch feeds the center along a recognizable radial run.
  for(const [x,z,sx,sz] of [[6.5,0,5.6,.10],[-6.5,0,5.6,.10],[0,-6.5,.10,5.6]]){
   piece(deck,'box','graphite',v(x,y+.023,z),BOX_ROT,v(sx,.025,sz));
   piece(deck,'box','signal',v(x,y+.048,z),BOX_ROT,v(sx*.83,.018,sz*.83),c);
  }
  // Hub relay nodes are backed by the overhead slab and far above the actors.
  for(const [x,z] of [[0,4.8],[-4.8,0],[4.8,0]]){
   piece(deck,'disc','graphite',v(x,y+7.44,z),BOX_ROT,v(.35,.13,.35));
   piece(deck,'ring','signal',v(x,y+7.35,z),FLOOR_ROT,v(.24,.24,1),c);
  }
 }

 const built=[];
 for(const {deck,geometry,material,items} of batches.values()){
  if(!items.length)continue;
  const mesh=new THREE.InstancedMesh(geometries[geometry],materials[material],items.length);
  mesh.name=`Tower deck ${deck+1} / ${material} ${geometry}`;
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  items.forEach(({matrix,color},i)=>{
   mesh.setMatrixAt(i,matrix);
   if(material==='accent'||material==='signal')mesh.setColorAt(i,color);
  });
  mesh.instanceMatrix.needsUpdate=true;
  if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  mesh.castShadow=false;mesh.receiveShadow=material!=='signal';
  art.add(mesh);built.push(mesh);
 }
 // One shared dynamic instanced draw replaces individual animated lamp meshes.
 const rotor=new THREE.InstancedMesh(geometries.jewel,materials.signal,rotors.length);
 rotor.name='Tower eighteen optical status rotors';rotor.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
 for(const r of rotors)rotor.setColorAt(r.index,r.colour);
 rotor.instanceColor.needsUpdate=true;rotor.frustumCulled=false;art.add(rotor);
 const spin=new THREE.Quaternion(),orientation=new THREE.Quaternion(),pose=new THREE.Matrix4();
 const rotorScale=v(.24,.31,.055);
 let disposed=false;
 function update(dt){
  if(disposed)return;
  time+=Math.min(Math.max(Number(dt)||0,0),.1);
  for(const r of rotors){
   spin.setFromAxisAngle(SPIN_AXIS,r.phase+time*r.speed);
   orientation.copy(r.basis).multiply(spin);
   pose.compose(r.position,orientation,rotorScale);
   rotor.setMatrixAt(r.index,pose);
  }
  rotor.instanceMatrix.needsUpdate=true;
 }
 update(0);
 function dispose(){
  if(disposed)return;disposed=true;art.removeFromParent();
  for(const mesh of built)mesh.dispose?.();rotor.dispose?.();
  Object.values(geometries).forEach(geometry=>geometry.dispose());
  Object.values(materials).forEach(material=>material.dispose());
 }
 return {update,dispose,stats:{wings:rooms.length,decks:6,draws:built.length+1,instances:instanceCount+rotors.length}};
}
