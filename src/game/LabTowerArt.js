import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {towerPoint} from './LabTowerLayout.js';
import {TOWER_ROUTE_OBSTACLES} from './LabTowerRoutes.js';

// The reliefs sit on the room side of the solid wall by at most 17 cm. The
// existing wall and ceiling remain their collision backings; there is no
// free-standing decorative machine for the player or cargo to walk through.
const DECK_COLOURS=[0x52d7e5,0xffbb70,0xb1a5ff,0x81e7b1,0xff9dbb,0xf7db82];
const UP=new THREE.Vector3(0,1,0);
const BOX_ROT=new THREE.Quaternion();
const DISC_ROT=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2);
const FLOOR_ROT=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2);
const SPIN_AXIS=new THREE.Vector3(0,0,1);

function wallBasis(def){
 const [dx,dz]=def.direction;
 return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
  new THREE.Vector3(-dx,0,-dz),UP,new THREE.Vector3(dz,0,-dx)));
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
 function wall(def,s,y){
  // The solid wall's inner face is n=6.04. Recess the base 3 cm behind it;
  // the deepest signal ring projects less than 17 cm into the chamber.
  const q=wallBasis(def),origin=new THREE.Vector3(...towerPoint(def,s,6.07,def.baseY+y));
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

 function baffleGuides(def,c){
  const [dx,dz]=def.direction,d=v(dx,0,dz),across=v(-dz,0,dx);
  for(const b of TOWER_ROUTE_OBSTACLES[def.id]??[]){
   const gapSide=b.n<0?1:-1,edge=b.n+gapSide*b.across/2;
   // The real slab occupies the wall's entire lower height. Keep this
   // high-contrast metal reveal above the actors and against its solid edge.
   const edgePoint=new THREE.Vector3(...towerPoint(def,b.s,edge,def.baseY+5.24));
   piece(def.deck,'box','alloy',edgePoint,wallBasis(def),v(.62,4.14,.12));
   const signalPoint=new THREE.Vector3(...towerPoint(def,b.s-.32,edge-gapSide*.14,def.baseY+5.16));
   piece(def.deck,'box','signal',signalPoint,wallBasis(def),v(.028,3.72,.065),c);
   for(const forward of [-1,1]){
    // A backed arrow on both sides makes the actual 4 m side passage legible
    // on entry and on the return trip. Both signs sit on the slab, y>3.5.
    const q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
     across.clone().multiplyScalar(forward),UP,d.clone().multiplyScalar(-forward)));
    const point=new THREE.Vector3(...towerPoint(def,b.s-forward*.33,b.n,def.baseY+4.91));
    const add=(shape,mat,x,y,z,sx,sy,sz,color=0xffffff,angle=0)=>{
     const p=v(x,y,z).applyQuaternion(q).add(point);
     const r=q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(v(0,0,1),angle));
     piece(def.deck,shape,mat,p,r,v(sx,sy,sz),color);
    };
    const line=(x0,y0,x1,y1,width,mat='signal',color=c)=>{
     const ax=x1-x0,ay=y1-y0;
     add('box',mat,(x0+x1)/2,(y0+y1)/2,.125,Math.hypot(ax,ay),width,.045,color,Math.atan2(ay,ax));
    };
    add('casing','graphite',0,0,-.025,3.35,2.42,.10);
    add('casing','alloy',0,0,.038,3.18,2.25,.055);
    add('casing','recess',0,0,.076,3.02,2.08,.026);
    const side=gapSide*forward;
    line(-.95*side,0,.88*side,0,.15);
    line(.88*side,0,.25*side,.51,.13);
    line(.88*side,0,.25*side,-.51,.13);
    for(const x of [-1.36,1.36])for(const y of [-.91,.91])
     add('box','porcelain',x,y,.13,.12,.12,.06);
   }
  }
 }

 const rotors=[];
 function wing(def){
  const c=tint(def),entry=wall(def,17,4.85);
  entranceBadge(def,c);
  baffleGuides(def,c);
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
  const exit=wall(def,34.1,5.0);
  exit.place('casing','graphite',0,0,-.025,2.05,1.84,.10);
  exit.ring(0,0,.69,'accent',c,.11);
  exit.ring(0,0,.46,'signal',c,.13);
  for(let i=0;i<5;i++){
   const a=i*2*Math.PI/5;
   exit.dot(Math.cos(a)*.92,Math.sin(a)*.80,.055,'porcelain');
  }
 }
 rooms.forEach(room=>wing(room.definition));

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
