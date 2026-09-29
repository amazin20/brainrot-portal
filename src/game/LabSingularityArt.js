import * as THREE from 'three';
import {V} from './LabSingularityKit.js';
const UP=V(0,1,0);
/** Mechanism-specific construction and building services. No puzzle state is
 * assigned here; lamps only display the existing live machine outputs. */
export function buildSingularityArt({game,k,rooms,edges,solved}){
 const m=k.m,ivory=k.mat(0xcfdcdd,.74,.08),inset=k.mat(0x526c7a,.74,.12),caution=k.mat(0xf0bd61,.64,.1),blue=k.mat(0x83bcda,.54,.16);
 const updates=[],lights=[];
 function pipe(a,b,r=.11,material=m.copper,{solid=false}={}){
  const va=V(...a),vb=V(...b),d=vb.clone().sub(va),mesh=k.mesh(k.cylinder,material,va.clone().add(vb).multiplyScalar(.5).toArray(),[r,d.length(),r],{solid});mesh.quaternion.setFromUnitVectors(UP,d.normalize());
  if(mesh.userData.collider){mesh.updateWorldMatrix(true,false);mesh.userData.collider.box.setFromObject(mesh);}return mesh;
 }
 function rail(a,b,material=m.steel){return pipe(a,b,.1,material);}
 function bolt(p,normal=[0,0,1],size=.065){const mesh=k.mesh(k.cylinder,m.copper,p,[size,.055,size]);mesh.quaternion.setFromUnitVectors(UP,V(...normal));return mesh;}
 function bearing(p,r,normal=[0,0,1],material=m.steel){
  k.ring(p,r,material,{normal,tube:r*.14});k.ring(p,r*.67,m.copper,{normal,tube:r*.075});
  const n=V(...normal),right=V(1,0,0).cross(n);if(right.lengthSq()<.1)right.set(0,0,1);right.normalize();const u=n.clone().cross(right);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;bolt(V(...p).addScaledVector(right,Math.cos(a)*r).addScaledVector(u,Math.sin(a)*r).toArray(),normal,r*.055);}
 }
 function text(str,p,w=8,normal=[0,0,1],sub=''){
  if(typeof document?.createElement!=='function')return;
  const c=document.createElement('canvas');c.width=1024;c.height=256;const ctx=c.getContext('2d');if(!ctx)return;
  ctx.fillStyle='#1e3946';ctx.fillRect(0,0,1024,256);ctx.fillStyle='#8ef1d2';ctx.fillRect(0,0,14,256);
  ctx.font='bold 62px sans-serif';ctx.textAlign='center';ctx.fillStyle='#edf3e7';ctx.fillText(str,522,111,958);
  ctx.font='28px sans-serif';ctx.fillStyle='#a6c5d0';ctx.fillText(sub,522,188,958);
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;k.textures.push(texture);const mat=new THREE.MeshBasicMaterial({map:texture});k.materials.add(mat);
  const mesh=k.mesh(k.geo(new THREE.PlaneGeometry(w,w/4)),mat,p);mesh.quaternion.setFromUnitVectors(V(0,0,1),V(...normal));
 }
 // Recessed modular skins sit on existing wall collision skins. The large
 // laboratory structure reads at both ground level and on the upper paths.
 for(const r of rooms.values()){
  const {def:d,b,P}=r,[x,y,z]=d.at,color=m[d.color];
  for(const side of ['n','s','w','e']){
   const vertical=side==='w'||side==='e',length=vertical?d.d:d.w,sign=side==='n'||side==='w'?1:-1;
   const fixed=side==='w'?b.x0:side==='e'?b.x1:side==='n'?b.z0:b.z1;
   const bays=Math.max(3,Math.round(length/7));
   for(let i=0;i<bays;i++){
    const along=-length/2+(i+.5)*length/bays;if(side===d.entry&&Math.abs(along)<6)continue;
    const point=vertical?[fixed+sign*.28,y+d.h*.48,z+along]:[x+along,y+d.h*.48,fixed+sign*.28];
    k.decor(point,vertical?[.06,d.h*.75,length/bays-.3]:[length/bays-.3,d.h*.75,.06],(i%3===1)?inset:ivory);
    const bottom=[...point];bottom[1]=y+.75;k.decor(bottom,vertical?[.09,.3,length/bays-.4]:[length/bays-.4,.3,.09],color);
    const seam=[...point];seam[1]=y+d.h*.9;k.decor(seam,vertical?[.11,.13,length/bays-.5]:[length/bays-.5,.13,.11],m.lamp);
   }
   // Structural cornice and a parallel electrical channel avoid a wall of
   // featureless flat colour while never crossing the entrance opening.
   k.decor(vertical?[fixed+sign*.4,y+d.h-.65,z]:[x,y+d.h-.65,fixed+sign*.4],vertical?[.38,.4,length]:[length,.4,.38],m.steel);
  }
  const vertical=d.entry==='w'||d.entry==='e',normal=d.entry==='w'?[-1,0,0]:d.entry==='e'?[1,0,0]:d.entry==='n'?[0,0,-1]:[0,0,1];
  const door=V(...r.door).addScaledVector(V(...normal),.37);
  const lamp=k.box([door.x,y+3,door.z],[vertical?.12:4.8,.16,vertical?4.8:.12],m.idle,{solid:false,dynamic:true});updates.push(()=>{lamp.material=solved.has(d.id)?m.live:m.idle;});
  // Overhead service pipes and hangers physically fit between room roof and
  // the top of each machine; they cannot intersect the normal player's path.
  for(const sign of [-1,1]){
   pipe(P(sign*(d.w/2-1.5),-d.d/2+.7,d.h-1.4),P(sign*(d.w/2-1.5),d.d/2-.7,d.h-1.4),.18,color);
   for(const zz of [-d.d*.3,0,d.d*.3])k.decor(P(sign*(d.w/2-1.5),zz,d.h-.8),[.12,1.2,.3],m.steel);
  }
  text(d.name,P(0,-d.d/2+.42,Math.min(d.h-2.5,8.5)),Math.min(14,d.w*.6),[0,0,1],d.requires.length?'ПИТАНИЕ: НЕСКОЛЬКО ЛИНИЙ':'АВТОНОМНЫЙ МАШИННЫЙ ЗАЛ');
 }
 // Interlocking beams support the long stairs; the light channels run below
 // the deck and do not paint imaginary navigation arrows on the floor.
 for(const [a,b] of edges){
  const v=V(...b).sub(V(...a)),horizontal=V(v.x,0,v.z).normalize(),side=V(-horizontal.z,0,horizontal.x);
  for(const s of [-1,1]){
   const aa=V(...a).addScaledVector(side,s*1.9).add(V(0,-.65,0)),bb=V(...b).addScaledVector(side,s*1.9).add(V(0,-.65,0));
   pipe(aa.toArray(),bb.toArray(),.24,m.steel);pipe(aa.clone().add(V(0,-.32,0)).toArray(),bb.clone().add(V(0,-.32,0)).toArray(),.055,m.cyan);
  }
 }
 for(const z of [-73,-49,-25,25,49,69]){
  k.box([0,-1.5,z],[16,2,.6],m.steel);
  for(const x of [-7.5,7.5]){k.box([x,-8.5,z],[.65,14.2,.65],m.steel);bearing([x,-.9,z],.4,[0,0,1]);}
 }
 // Suspended central dynamo: a readable landmark, with an unobstructed ground
 // concourse under it and a real collision shell above head height.
 k.drum([0,36,0],3.5,48,m.dark);k.drum([0,11,0],4.6,2.2,m.steel);
 for(let y=14;y<=62;y+=8){k.ring([0,y,0],4.9,m.steel,{tube:.38});k.ring([0,y+.65,0],4.7,m.cyan,{tube:.13});}
 for(let i=0;i<8;i++){const a=i*Math.PI/4,x=Math.cos(a)*3.6,z=Math.sin(a)*3.6;k.decor([x,37,z],[.28,47,.28],m.live);k.box([Math.cos(a)*5.2,38,Math.sin(a)*5.2],[.3,57,.3],m.steel);}
 k.ring([0,9.5,0],4,m.copper,{tube:.34});text('СИНГУЛЯРНОСТЬ',[0,7.5,4.5],11,[0,0,1],'РАЗНЫЕ МАШИНЫ · ОБЩАЯ ВЕРШИНА');
 // Instruments are different because the underlying problem is different.
 {
  const {P}=rooms.get('orrery');
  for(const x of [-12,0,12]){
   k.drum(P(x,0,-1.2),1.35,2,m.steel);bearing(P(x,0,-.15),2.1,[0,1,0]);
   for(let i=0;i<12;i++){const a=i*Math.PI/6;const p=P(x+Math.cos(a)*5.3,Math.sin(a)*5.3,1.74);k.decor(p,[.3,.12,.3],m.ivory);}
  }
  pipe(P(-19,-3.5,4),P(-21,-3.5,5.1),.7,m.ivory);bearing(P(-19,-3.5,4),.78,[1,0,0]);
  text('АЗИМУТ / СОСЕДНЯЯ ПЕРЕДАЧА',P(0,19.55,5),14,[0,0,-1],'ОСМОТРИ ПОЛОЖЕНИЕ ПРОЛЁТОВ');
 }
 {
  const {P}=rooms.get('drydock');
  for(const x of [-4,4]){bearing(P(x,0,12.6),1,[0,0,1]);pipe(P(x,0,1),P(x,0,12.5),.07,m.copper);}
  for(const x of [-15,-10,-5,0,5,10]){k.decor(P(x,6,7.62),[.22,.5,13],m.steel);k.decor(P(x,19.5,8.04),[2,.018,.32],caution);}
  k.decor(P(18,18,1.7),[.15,.12,5],m.copper);
  text('ПРОТИВОВЕСНЫЙ ПРИВОД',P(0,-26.55,8),15,[0,0,1],'НАГРУЗКА ВНИЗУ / ФИКСАТОР НАВЕРХУ');
 }
 {
  const {P}=rooms.get('optics');
  k.box(P(-26,-5,1),[1.3,2,1.3],m.steel,{round:true});bearing(P(-26,-5,2.4),.65,[1,0,0]);
  for(const x of [-23,-19,-15])k.decor(P(x,-5,.055),[1.3,.025,.16],m.cyan);
  k.box(P(0,5,.2),[3,.4,3],m.steel);bearing(P(0,5,.42),1.15,[0,1,0]);
  text('ОПТИЧЕСКИЙ ТРАКТ',P(23,16.5,5),11,[0,0,-1],'БЕЛАЯ КЕРАМИКА / ОТРАЖЕНИЕ / ПРИЁМНИК');
 }
 {
  const {P}=rooms.get('reservoir');
  for(const [x,h]of [[-14,8],[0,5],[14,3]]){
   for(const yy of [.35,h-.3])bearing(P(x,-10,yy),3.12,[0,1,0]);
   k.drum(P(x,-10,h+.2),2.6,.4,m.ivory);pipe(P(x,-12,h+.2),P(x,-12,11.6),.27,m.copper);
   for(let i=1;i<=h;i++){k.decor(P(x+2.45,-6.93,i),[.65,.055,.14],m.ivory);}
  }
  pipe(P(-14,-12,11.6),P(14,-12,11.6),.27,m.copper);
  for(const z of [14.2,20.1])for(const x of [-10,-6,6,10])k.decor(P(x,z,.05),[1.4,.03,.35],caution);
 }
 {
  const {P}=rooms.get('echo');
  for(const [x,z]of [[-19,-9],[22,12]]){k.ring(P(x,z,.10),2.4,m.rose,{tube:.06});for(const s of [-1,1])k.decor(P(x+s*2.7,z,.07),[.2,.035,5],m.ivory);}
  // A recording head is recessed in the wall, not an arbitrary object in the room.
  k.decor(P(0,21.6,5),[23,7,.2],m.dark);for(let i=0;i<19;i++){const h=1.3+Math.sin(i*1.7)**2*4;k.decor(P((i-9)*1.03,21.42,5),[.32,h,.1],m.rose);}
  text('ЭХО НЕ ИЗМЕНЯЕТ ПРОШЛОЕ',P(0,21.3,10),15,[0,0,-1],'ЗАПИШИ ПУТЬ / ВСТРЕТЬ ЕГО В ДРУГОЙ ТОЧКЕ');
 }
 {
  const {P}=rooms.get('magnet');
  for(const [x,z]of [[-12,0],[0,11],[12,0]]){
   // Coil windings and pole shoes, entirely inside the existing apparatus volume.
   for(const dz of [-.4,-.2,0,.2,.4])k.ring(P(x,z+dz,4.8),2.45,m.copper,{normal:[0,0,1],tube:.085});
   bearing(P(x,z,4.8),2.8,[0,0,1],m.cyan);
  }
  for(const x of [-3,-1,1,3])k.decor(P(x,4.95,2.6),[.09,4.6,.07],m.copper);
 }
 {
  const {P}=rooms.get('transmission');
  k.box(P(0,-13.8,4),[25,8.5,1.2],m.dark,{round:true});k.box(P(0,-13.8,.6),[28,1.2,3],m.steel);
  for(const [x,r]of [[-8,3.9],[0,2.6],[7,3.2]]){bearing(P(x,-10.72,4),r*.32,[0,0,1]);pipe(P(x,-13,4),P(x,-10.6,4),r*.13,m.copper);}
  for(const x of [-13,13])k.decor(P(x,-13,4.7),[.15,7.4,.2],caution);
 }
 {
  const {P}=rooms.get('accumulator');
  // Separate bank of capacitor canisters on the wall behind the charge tray.
  for(const x of [-13,-9,-5]){k.box(P(x,-19.8,2.6),[2.2,5.2,1.7],m.dark,{round:true});k.decor(P(x,-18.9,2.6),[.18,4.2,.12],m.violet);bearing(P(x,-19.8,5.3),.7,[0,1,0]);}
  pipe(P(-13,-20.5,6),P(-5,-20.5,6),.16,m.copper);text('БАНК НАКОПИТЕЛЕЙ',P(0,21.5,9),13,[0,0,-1],'ЗАРЯД СОХРАНЯЕТСЯ НЕДОЛГО');
 }
 {
  const {P}=rooms.get('archive');
  for(const z of [-13,13]){pipe(P(-19,z,10.3),P(19,z,10.3),.22,m.copper);}
  for(const mesh of k.meshes.filter(mesh=>mesh.userData.collider?.kinematic&&mesh.material===m.rose)){
   if(Math.abs(mesh.position.y-18.7)>.1)continue;
   // Dynamic bookshelf fronts move with the exact collision-bearing wall.
   for(let i=0;i<6;i++){const decoration=new THREE.Mesh(k.cube,m.dark);decoration.position.set(.55,0,(i-2.5)/6);decoration.scale.set(.045,.90,.12);mesh.add(decoration);}
  }
 }
 {
  const {P}=rooms.get('migrant');
  for(const z of [-.6,.6])pipe(P(-15,z,10.6),P(15,z,10.6),.16,m.copper);
  for(const x of [-14,14])k.box(P(x,-15,6.5),[.7,13,.7],m.steel);
  text('ПОДВИЖНАЯ ПОРТАЛЬНАЯ ПОВЕРХНОСТЬ',P(0,22.45,10),19,[0,0,-1],'ВЫХОД ЕДЕТ ВМЕСТЕ С КАРЕТКОЙ');
 }
 {
  const {P}=rooms.get('parallax');
  for(const x of [-8,2,13]){pipe(P(x,-17,.14),P(x,17,.14),.09,m.copper);for(const z of [-14,-7,0,7,14])k.decor(P(x,z,.08),[1.2,.055,.14],m.ivory);}
  k.ring(P(-18,0,.1),2.2,m.rose,{tube:.07});
  text('ОДИН ВЗГЛЯД / ТРИ ПРОСВЕТА',P(0,19.45,9),15,[0,0,-1],'ПРОСТРАНСТВО ВАЖНЕЕ ПОЛОЖЕНИЯ РЫЧАГА');
 }
 {
  const {P}=rooms.get('inertia');
  for(const y of [1,4,7,10]){k.decor(P(-29,-9,y),[.18,.12,4],caution);}
  k.decor(P(4.5,-7,4),[.17,8,4],m.cyan);for(const x of [8,12,16,20,24])k.decor(P(x,-2.65,-3.43),[2.1,.04,.25],caution);
  text('ВЫСОТА → СКОРОСТЬ → ДАЛЬНОСТЬ',P(0,-18.48,16),22,[0,0,1],'ПАДЕНИЕ СОХРАНЯЕТ ИМПУЛЬС ПРИ ПЕРЕНОСЕ');
 }
 {
  const {P}=rooms.get('inversion');
  for(const x of [-4,4])for(const z of [-4,4])for(const y of [2,6,10,14]){k.decor(P(x,z,y),[.8,.2,.8],m.copper);}
  for(const z of [-5.8,5.8])pipe(P(-4,z,18),P(4,z,18),.2,m.violet);
 }
 // Level-local fill light; all lighting changes are disposed with this level.
 const fill=new THREE.HemisphereLight(0xd8f4ff,0x668598,.75);game.scene.add(fill);lights.push(fill);
 return {update(){updates.forEach(f=>f());},dispose(){lights.forEach(l=>{l.removeFromParent();l.dispose?.();});}};
}
